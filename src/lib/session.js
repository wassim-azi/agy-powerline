"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { formatReset, resetInSeconds, firstText, stripControl } = require("./formatters");
const { resolveGit, resolveGitDetails } = require("./git");
const { resolveUsage, conversationsDir } = require("./usage");
const { isWsl, resolveInstallDir, writeFileAtomic, PRIVATE_FILE_MODE } = require("./paths");
const { logWarning } = require("./log");
const { resolveLanguage, t } = require("./i18n");

const FIVE_HOURS = 5 * 3600;
const SEVEN_DAYS = 7 * 86400;
const ARGON_BUCKET = "gemini-argon-wtu-weekly";
// The buckets Antigravity sends, with the message key of the short name the bar shows.
const QUOTA_BUCKETS = {
  "gemini-5h": { key: "tag_5h", window: FIVE_HOURS },
  "gemini-weekly": { key: "tag_7d", window: SEVEN_DAYS },
  // Gemini 4 Argon on Google AI Pro: a weekly quota of its own, with no 5-hour
  // window, sent whatever model is in use. On Ultra Argon counts toward the
  // Gemini buckets and this one isn't sent.
  [ARGON_BUCKET]: { key: "tag_argon_7d", window: SEVEN_DAYS },
  "3p-5h": { key: "tag_3p_5h", window: FIVE_HOURS },
  "3p-weekly": { key: "tag_3p_7d", window: SEVEN_DAYS },
};
// No quota window lasts a year: a reset further out is a broken value.
const MAX_RESET_SECONDS = 366 * 86400;
const MAX_CONVERSATION_FILES = 2000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_CACHE_NAME = ".session-cache.json";
const SESSION_CACHE_TTL_MS = 60 * 1000;
const SAMPLE_SESSION_START_MS = Symbol.for("agy-powerline.sampleSessionStartMs");

function sessionCachePath() {
  try {
    const dir = resolveInstallDir();
    return dir && fs.existsSync(path.join(dir, "statusline.config.json"))
      ? path.join(dir, SESSION_CACHE_NAME)
      : null;
  } catch {
    return null;
  }
}

function readSessionCache(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (
      data &&
      typeof data === "object" &&
      (data.startMs === null || Number.isFinite(data.startMs)) &&
      (data.newestMtimeMs === null || Number.isFinite(data.newestMtimeMs)) &&
      Number.isFinite(data.scannedAt)
    ) {
      return data;
    }
  } catch {
    // Missing or invalid cache file.
  }
  return null;
}

function writeSessionCache(file, cache) {
  try {
    writeFileAtomic(file, JSON.stringify(cache), { mode: PRIVATE_FILE_MODE });
  } catch {
    // Write failure is non-fatal.
  }
}

// A scan's result, kept for SESSION_CACHE_TTL_MS. startMs is null when the
// scan found nothing to show, so an idle or unusable folder isn't rescanned on
// every refresh either.
function scanSessionStart(nowMs) {
  const directory = conversationsDir();
  const listing = fs.readdirSync(directory, { withFileTypes: true });
  const entries = listing.filter((entry) => entry.isFile() && entry.name.endsWith(".db"));
  // Only stat the -wal files the listing has: a failed stat costs as much as a
  // real one, and most databases have none.
  const wals = new Set(listing.filter((e) => e.name.endsWith(".db-wal")).map((e) => e.name));

  if (entries.length > MAX_CONVERSATION_FILES) {
    logWarning("SESSION_TOO_MANY_FILES");
    return { startMs: null, newestMtimeMs: null };
  }

  let newest = null;
  for (const entry of entries) {
    const dbPath = path.join(directory, entry.name);
    const stat = fs.statSync(dbPath);
    let mtimeMs = stat.mtimeMs;
    // agy writes to the -wal file first, like signature() in usage.js.
    if (wals.has(`${entry.name}-wal`)) {
      try {
        mtimeMs = Math.max(mtimeMs, fs.statSync(`${dbPath}-wal`).mtimeMs);
      } catch {
        // Removed since the listing.
      }
    }
    if (Number.isFinite(mtimeMs) && (!newest || mtimeMs > newest.mtimeMs)) {
      newest = { mtimeMs, birthtimeMs: stat.birthtimeMs };
    }
  }

  if (!newest) {
    return { startMs: null, newestMtimeMs: null };
  }
  const startMs = newest.birthtimeMs;
  // Some Linux filesystems report no creation time: hide rather than guess.
  const valid =
    Number.isFinite(startMs) && startMs > 0 && startMs <= newest.mtimeMs && startMs <= nowMs;
  return { startMs: valid ? startMs : null, newestMtimeMs: newest.mtimeMs };
}

// Read file metadata only. Conversation database names are IDs and never enter
// the session object, cache or log.
function readSessionStartMs(nowMs = Date.now()) {
  try {
    if (!Number.isFinite(nowMs)) {
      return null;
    }
    const cacheFile = sessionCachePath();
    let result = cacheFile ? readSessionCache(cacheFile) : null;
    if (!result || nowMs - result.scannedAt >= SESSION_CACHE_TTL_MS || result.scannedAt > nowMs) {
      result = { ...scanSessionStart(nowMs), scannedAt: nowMs };
      if (cacheFile) {
        writeSessionCache(cacheFile, result);
      }
    }
    if (result.startMs === null || nowMs - result.newestMtimeMs > SESSION_IDLE_MS) {
      return null;
    }
    return result.startMs;
  } catch {
    // A missing or unreadable conversations folder only hides this widget.
    return null;
  }
}

// Node's platform ids, spelled the way people write them.
const OS_NAMES = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux",
  android: "Android",
  freebsd: "FreeBSD",
  openbsd: "OpenBSD",
  sunos: "SunOS",
  aix: "AIX",
};

function currentOsName() {
  if (process.platform === "linux" && isWsl()) {
    return "WSL";
  }
  return OS_NAMES[process.platform] || process.platform;
}

function currentUserAndHost() {
  let userInfoName = "";
  try {
    userInfoName = os.userInfo().username;
  } catch {
    // Some containers have no passwd entry for the current user.
  }
  const username =
    [userInfoName, process.env.USER, process.env.USERNAME]
      .map((name) => stripControl(name).trim())
      .find(Boolean) || "";

  let hostname = "";
  try {
    hostname = stripControl(os.hostname()).split(".")[0].trim();
  } catch {
    // The host widget hides when the OS cannot provide a name.
  }
  return { username, hostname };
}

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

function readQuota(data, key, windowSeconds, lang) {
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
    reset: hasReset ? formatReset(resetSeconds, lang) : "",
    resetSeconds,
    elapsedPct,
    resetTime: resetValid && quota.reset_time ? String(quota.reset_time) : "",
    disabled: quota.disabled === true,
  };
}

// Which quota group a bucket belongs to.
function bucketGroup(key) {
  if (key.startsWith("gemini-argon-")) {
    return "argon";
  }
  if (key.startsWith("gemini-")) {
    return "gemini";
  }
  return key.startsWith("3p-") ? "3p" : null;
}

// The bucket closest to running out for the model in use: the Argon bucket
// for Argon models, the other gemini-* buckets for Gemini models, 3p-*
// (third-party) buckets for the others. Argon falls back to the Gemini
// buckets, where its usage counts when there is no Argon bucket. Without a
// matching bucket every bucket counts. Disabled buckets never do.
function tightestQuota(data, lang) {
  const buckets = data?.quota && typeof data.quota === "object" ? data.quota : {};
  const usable = [];

  for (const key of Object.keys(buckets)) {
    const known = QUOTA_BUCKETS[key];
    const quota = readQuota(data, key, known ? known.window : 0, lang);
    if (quota && !quota.disabled) {
      usable.push({ ...quota, key, label: known ? t(known.key, lang) : key.slice(0, 20) });
    }
  }

  const model = firstText(data?.model?.display_name, data?.model?.id).toLowerCase();
  const inGroup = (group) => usable.filter((quota) => bucketGroup(quota.key) === group);
  let pool;
  if (!model.startsWith("gemini")) {
    pool = inGroup("3p");
  } else if (model.includes("argon")) {
    pool = inGroup("argon");
    pool = pool.length ? pool : inGroup("gemini");
  } else {
    pool = inGroup("gemini");
  }
  pool = pool.length ? pool : usable;

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

// options.readUsage: the live statusline may read conversation metadata and
// databases; previews use the usage cache and a synthetic sample start time.
function extractSession(data, config, options = {}) {
  // The bar's own words follow config.language; payload text never changes.
  const lang = resolveLanguage(config?.language);
  const git = resolveGit(data, config);
  const gitDetails = resolveGitDetails(data, config);
  // Once git status has been read for gitFiles, the branch's dirty marker can
  // count uncommitted files too, not only an unfinished merge or rebase.
  const files = gitDetails?.files;
  if (git && files && gitDetails.branch === git.branch) {
    git.dirty = git.dirty || files.staged + files.modified + files.conflicts > 0;
  }
  const contextPct = percent(contextUsedPercent(data));
  const contextSize = count(data.context_window?.context_window_size);
  const current = data.context_window?.current_usage;
  // Context tokens are the used share of the window, so they always agree with
  // the percentage next to them: agy's percentage also counts cached tokens and
  // its own system prompt and tools, which no sum of current_usage reproduces.
  // Without a window size, count what current_usage lists as in the window.
  const usedTokens =
    contextSize > 0
      ? Math.round((contextPct * contextSize) / 100)
      : count(current?.input_tokens) +
        count(current?.cache_read_input_tokens) +
        count(current?.cache_creation_input_tokens);
  const requestTokens = count(current?.input_tokens) + count(current?.output_tokens);

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
  const totalTokens = sessionTokens > 0 ? sessionTokens : requestTokens;

  // Share of the prompt served from cache in the latest request.
  const cacheReadTokens = count(usage?.cache_read_input_tokens);
  const cacheTotal = cacheReadTokens + count(usage?.input_tokens);
  const cacheHitPct = cacheTotal > 0 ? Math.round((cacheReadTokens * 100) / cacheTotal) : 0;

  const modelName = firstText(data.model?.display_name, data.model?.id);
  const uses = (id) => Boolean(config?.widgets?.some((widget) => widget?.id === id));
  const osName = uses("os") ? currentOsName() : "";
  const { username, hostname } = uses("host") ? currentUserAndHost() : {};
  let sessionStartMs = null;
  if (uses("sessionTime")) {
    if (options.readUsage === true) {
      sessionStartMs = readSessionStartMs();
    } else if (Number.isFinite(data?.[SAMPLE_SESSION_START_MS])) {
      sessionStartMs = data[SAMPLE_SESSION_START_MS];
    }
  }

  return {
    lang,
    os: osName,
    ramPct,
    username: username || "",
    hostname: hostname || "",
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
    fiveHour: readQuota(data, "gemini-5h", FIVE_HOURS, lang),
    weekly: readQuota(data, "gemini-weekly", SEVEN_DAYS, lang),
    thirdPartyFiveHour: readQuota(data, "3p-5h", FIVE_HOURS, lang),
    thirdPartyWeekly: readQuota(data, "3p-weekly", SEVEN_DAYS, lang),
    argonWeekly: readQuota(data, ARGON_BUCKET, SEVEN_DAYS, lang),
    tightestQuota: tightestQuota(data, lang),
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
    sessionStartMs,
    version: firstText(data.version),
    sandbox: data.sandbox?.enabled === true,
    sandboxNet: data.sandbox?.allow_network === true,
    git,
    gitDetails,
    // Only read when tokensToday or tokensWeek is on the bar.
    usage: resolveUsage(config, { read: options.readUsage === true }),
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
  currentUserAndHost,
  readSessionStartMs,
  extractSession,
};
