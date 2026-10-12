"use strict";

const os = require("os");
const { formatReset, resetInSeconds, firstText } = require("./formatters");
const { resolveGit } = require("./git");

const FIVE_HOURS = 5 * 3600;
const SEVEN_DAYS = 7 * 86400;
// The buckets Antigravity sends, with the short names the bar shows.
const QUOTA_BUCKETS = {
  "gemini-5h": { label: "5h", window: FIVE_HOURS },
  "gemini-weekly": { label: "7d", window: SEVEN_DAYS },
  "3p-5h": { label: "3P 5h", window: FIVE_HOURS },
  "3p-weekly": { label: "3P 7d", window: SEVEN_DAYS },
};
// No quota window lasts a year: a reset further out is a broken value.
const MAX_RESET_SECONDS = 366 * 86400;

// Payload numbers can be strings, negative or absurd. The bar must never show
// NaN, a negative count or more than 100%.
function count(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER ? n : 0;
}

function percent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

function readQuota(data, key, windowSeconds) {
  const quota = data?.quota?.[key];

  if (!quota || typeof quota !== "object") {
    return null;
  }

  // Without a usable fraction there is nothing to show, not "0% left".
  const fraction = quota.remaining_fraction == null ? NaN : Number(quota.remaining_fraction);

  if (!Number.isFinite(fraction)) {
    return null;
  }

  const remaining = percent(fraction * 100);
  const untilReset = resetInSeconds(quota);
  const resetValid = untilReset <= MAX_RESET_SECONDS;
  const resetSeconds = resetValid ? untilReset : 0;
  const hasReset =
    resetValid &&
    (untilReset > 0 ||
      typeof quota.reset_in_seconds === "number" ||
      Number.isFinite(Date.parse(quota.reset_time)));
  // How far into the quota window we are; the pace marker sits there. A reset
  // further out than the window itself means the window length is unknown.
  const elapsedPct =
    resetSeconds > 0 && resetSeconds <= windowSeconds
      ? ((windowSeconds - resetSeconds) / windowSeconds) * 100
      : null;

  return {
    remaining,
    reset: hasReset ? formatReset(resetSeconds) : "",
    resetSeconds,
    elapsedPct,
    resetTime: resetValid && quota.reset_time ? String(quota.reset_time) : "",
    disabled: quota.disabled === true,
  };
}

// The bucket closest to running out for the model in use: gemini-* buckets
// for Gemini models, 3p-* (third-party) buckets for the others. Without a
// matching bucket every bucket counts. Disabled buckets never do.
function tightestQuota(data) {
  const buckets = data?.quota && typeof data.quota === "object" ? data.quota : {};
  const usable = [];

  for (const key of Object.keys(buckets)) {
    const known = QUOTA_BUCKETS[key];
    const quota = readQuota(data, key, known ? known.window : 0);
    if (quota && !quota.disabled) {
      usable.push({ ...quota, key, label: known ? known.label : key.slice(0, 20) });
    }
  }

  const model = firstText(data?.model?.display_name, data?.model?.id).toLowerCase();
  const family = model.startsWith("gemini") ? "gemini-" : "3p-";
  const forModel = usable.filter((quota) => quota.key.startsWith(family));
  const pool = forModel.length ? forModel : usable;

  return pool.reduce((low, quota) => (!low || quota.remaining < low.remaining ? quota : low), null);
}

function contextUsedPercent(data) {
  const used = Number(data.context_window?.used_percentage);

  if (Number.isFinite(used)) {
    return used;
  }

  const remaining = Number(data.context_window?.remaining_percentage);

  if (Number.isFinite(remaining)) {
    return 100 - remaining;
  }

  const size = Number(data.context_window?.context_window_size ?? 0);
  const usage = data.context_window?.current_usage ?? {};
  const current =
    Number(usage.input_tokens ?? 0) +
    Number(usage.cache_creation_input_tokens ?? 0) +
    Number(usage.cache_read_input_tokens ?? 0);

  if (!size || size <= 0) {
    return 0;
  }

  return (current * 100) / size;
}

function extractSession(data, config) {
  const contextPct = percent(contextUsedPercent(data));
  const contextSize = count(data.context_window?.context_window_size);
  const usedTokens =
    count(data.context_window?.current_usage?.input_tokens) +
    count(data.context_window?.current_usage?.output_tokens);

  // RAM is measured here; Antigravity doesn't send it.
  let ramPct = 0;
  try {
    const totalMem = os.totalmem();
    const usedMem = Math.max(0, totalMem - os.freemem());
    ramPct = totalMem > 0 ? Math.round((usedMem * 100) / totalMem) : 0;
  } catch {
    // Leave RAM at 0 when the OS won't say.
  }

  const usage = data.context_window?.current_usage;
  const inputTokens = count(data.context_window?.total_input_tokens);
  const outputTokens = count(data.context_window?.total_output_tokens);
  const sessionTokens = inputTokens + outputTokens;
  const totalTokens = sessionTokens > 0 ? sessionTokens : usedTokens;

  // Share of the prompt served from cache in the latest request.
  const cacheReadTokens = count(usage?.cache_read_input_tokens);
  const cacheTotal = cacheReadTokens + count(usage?.input_tokens);
  const cacheHitPct = cacheTotal > 0 ? Math.round((cacheReadTokens * 100) / cacheTotal) : 0;

  const modelName = firstText(data.model?.display_name, data.model?.id);

  return {
    ramPct,
    model: modelName,
    contextPct,
    contextSize,
    usedTokens,
    totalTokens,
    inputTokens,
    outputTokens,
    cacheHitPct,
    // Without a context_window the context widgets hide instead of showing 0/0.
    hasContext: Boolean(data.context_window && typeof data.context_window === "object"),
    // Cache widgets hide without usage from the latest request.
    hasUsage: Boolean(usage && typeof usage === "object"),
    exceeds200k: data.exceeds_200k_tokens === true,
    cacheRead: count(data.context_window?.current_usage?.cache_read_input_tokens),
    cacheCreate: count(data.context_window?.current_usage?.cache_creation_input_tokens),
    fiveHour: readQuota(data, "gemini-5h", FIVE_HOURS),
    weekly: readQuota(data, "gemini-weekly", SEVEN_DAYS),
    thirdPartyFiveHour: readQuota(data, "3p-5h", FIVE_HOURS),
    thirdPartyWeekly: readQuota(data, "3p-weekly", SEVEN_DAYS),
    tightestQuota: tightestQuota(data),
    cwd: firstText(data.cwd, data.workspace?.current_dir),
    project: firstText(data.workspace?.project_dir),
    plan: firstText(data.plan_tier),
    agentState: firstText(data.agent_state),
    artifacts: Math.floor(count(data.artifact_count)),
    // Finished subagents stay in the list Antigravity sends; only running ones count.
    subagents: Array.isArray(data.subagents)
      ? data.subagents.filter((agent) => agent?.status === "running").length
      : 0,
    tasks: Math.floor(count(data.task_count)),
    // Left out in the default mode, and with Vim editing off.
    approvalMode: firstText(data.cycle_mode),
    vimMode: firstText(data.vim?.mode),
    // Left out until the conversation has a title; kept to one line.
    title: firstText(data.conversation_title).replace(/\s+/g, " ").trim(),
    version: firstText(data.version),
    sandbox: data.sandbox?.enabled === true,
    sandboxNet: data.sandbox?.allow_network === true,
    git: resolveGit(data, config),
    terminalWidth: terminalWidth(data.terminal_width ?? process.stdout.columns ?? 0),
  };
}

// The flex padding repeats spaces up to this width, so a bogus value (1e12,
// "Infinity") must not reach it. Anything unusable means unknown: no padding.
function terminalWidth(value) {
  const width = Math.floor(Number(value));
  return Number.isFinite(width) && width > 0 ? Math.min(width, 1000) : 0;
}

module.exports = {
  readQuota,
  tightestQuota,
  contextUsedPercent,
  extractSession,
};
