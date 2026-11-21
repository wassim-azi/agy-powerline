// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { rgb } = require("./colors");
const { t } = require("./i18n");
const {
  charWidth,
  visibleWidth,
  splitGraphemes,
  graphemeWidth,
  cutToWidth,
  closeLink,
  clipText,
  isValidMaxWidth,
  limitWidth,
  stripControl,
  firstText,
  sanitizeDeep,
} = require("./text-width");
const {
  basenameOf,
  homePath,
  isValidDepth,
  shortenPath,
  fishPath,
  fishBranch,
  pathLinkUrl,
  osc8Link,
  linkPath,
  linkGitBranch,
  linkGitSha,
} = require("./links");

function formatReset(seconds, lang) {
  seconds = Number(seconds);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return t("now", lang);
  }

  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}${t("unit_d", lang)} ${hours}${t("unit_h", lang)}`;
  }

  if (hours > 0) {
    return `${hours}${t("unit_hr", lang)} ${minutes}${t("unit_m", lang)}`;
  }

  return `${Math.max(1, minutes)}${t("unit_m", lang)}`;
}

function formatSessionTime(startMs, nowMs = Date.now(), lang) {
  const start = Number(startMs);
  const now = Number(nowMs);
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(now) || now - start < 60000) {
    return "";
  }
  return formatReset((now - start) / 1000, lang);
}

const MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

function parseResetDate(quota) {
  if (!quota) {
    return null;
  }

  if (quota.resetTime) {
    const parsed = Date.parse(quota.resetTime);

    if (Number.isFinite(parsed)) {
      return new Date(parsed);
    }
  }

  const seconds = Number(quota.resetSeconds);

  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(Date.now() + seconds * 1000);
  }

  return null;
}

// Clock settings for exact reset times. hour12 null means "the usual style":
// 12-hour in the built-in format, the locale's own choice when one is set.
// Invalid time zones and locales are dropped (Intl would throw on every
// refresh otherwise).
function normalizeClock(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const hour12 = typeof source.hour12 === "boolean" ? source.hour12 : null;
  const clock = { hour12, timeZone: "", locale: "" };

  if (typeof source.timeZone === "string" && source.timeZone.trim()) {
    try {
      const timeZone = source.timeZone.trim();
      new Intl.DateTimeFormat("en-US", { timeZone });
      clock.timeZone = timeZone;
    } catch {
      // Unknown zone: keep the machine's local time.
    }
  }

  if (typeof source.locale === "string" && source.locale.trim()) {
    try {
      const [locale] = Intl.getCanonicalLocales(source.locale.trim());
      if (locale && Intl.DateTimeFormat.supportedLocalesOf(locale).length) {
        clock.locale = locale;
      }
    } catch {
      // Malformed tag: keep the built-in English format.
    }
  }

  return clock;
}

const dateFormats = new Map();

function dateFormat(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  if (!dateFormats.has(key)) {
    dateFormats.set(key, new Intl.DateTimeFormat(locale, options));
  }
  return dateFormats.get(key);
}

// Hour, minute, month and day as numbers in the configured time zone (or the
// machine's own when none is set).
function clockParts(date, clock) {
  if (!clock.timeZone) {
    return {
      hour: date.getHours(),
      minute: date.getMinutes(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  const parts = {};
  const format = dateFormat("en-US", {
    timeZone: clock.timeZone,
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
    month: "numeric",
    day: "numeric",
  });
  for (const part of format.formatToParts(date)) {
    parts[part.type] = Number(part.value);
  }
  return { hour: parts.hour % 24, minute: parts.minute, month: parts.month, day: parts.day };
}

// Without a locale, times stay in the compact built-in style ("6:33pm",
// "18:33"); with one, Intl formats them the way that locale expects.
function formatClockTime(date, clock = {}) {
  const settings = { hour12: clock.hour12 !== false, timeZone: clock.timeZone || "" };

  if (clock.locale) {
    return dateFormat(clock.locale, {
      timeStyle: "short",
      hour12: typeof clock.hour12 === "boolean" ? clock.hour12 : undefined,
      timeZone: settings.timeZone || undefined,
    }).format(date);
  }

  const { hour, minute } = clockParts(date, settings);
  const minutes = String(minute).padStart(2, "0");

  if (!settings.hour12) {
    return `${String(hour).padStart(2, "0")}:${minutes}`;
  }

  return `${hour % 12 || 12}:${minutes}${hour >= 12 ? "pm" : "am"}`;
}

function formatClockDate(date, clock = {}) {
  if (clock.locale) {
    return dateFormat(clock.locale, {
      month: "short",
      day: "numeric",
      timeZone: clock.timeZone || undefined,
    }).format(date);
  }

  const { month, day } = clockParts(date, { timeZone: clock.timeZone || "" });
  return `${MONTHS_SHORT[month - 1]} ${day}`;
}

function formatResetTime(quota, clock = {}) {
  const date = parseResetDate(quota);
  return date ? formatClockTime(date, clock) : "";
}

function formatResetDatetime(quota, clock = {}) {
  const date = parseResetDate(quota);

  if (!date) {
    return "";
  }

  return `${formatClockDate(date, clock)}, ${formatClockTime(date, clock)}`;
}

const RESET_FORMATS = new Set(["countdown", "time", "both"]);

// Text for a reset widget. 5h resets show a time of day, weekly resets add the
// date. Falls back to the countdown when the payload has no usable reset time.
function formatResetText(quota, { format, fallback, weekly = false, clock = {} } = {}) {
  const chosen = RESET_FORMATS.has(format) ? format : fallback;
  const countdown = quota.reset;

  if (chosen === "countdown") {
    return countdown;
  }

  const exact = weekly ? formatResetDatetime(quota, clock) : formatResetTime(quota, clock);

  if (!exact) {
    return countdown;
  }

  return chosen === "both" ? `${exact} (${countdown})` : exact;
}

// Which meter cell marks how much of the quota window has passed, or -1.
function paceIndex(elapsedPct, width) {
  const pct = Number(elapsedPct);

  if (elapsedPct == null || !Number.isFinite(pct)) {
    return -1;
  }

  return Math.max(0, Math.min(width - 1, Math.floor((pct / 100) * width)));
}

function paceGlyph(ascii) {
  return ascii ? "|" : "┃";
}

// Used % minus elapsed %, in whole points: "⇡15%" is 15 points faster than a
// pace that lasts until the reset, "⇣10%" is 10 points of headroom. Empty on
// pace, or when the window length is unknown.
function formatPaceDelta(quota, ascii = false) {
  const elapsed = Number(quota?.elapsedPct);
  const remaining = Number(quota?.remaining);

  if (quota?.elapsedPct == null || !Number.isFinite(elapsed) || !Number.isFinite(remaining)) {
    return "";
  }

  const delta = Math.round(100 - remaining - elapsed);

  if (delta === 0) {
    return "";
  }

  return `${delta > 0 ? (ascii ? "^" : "⇡") : ascii ? "v" : "⇣"}${Math.abs(delta)}%`;
}

const MIN_FORECAST_ELAPSED_SEC = 600;

// Estimates when the quota empties at the current window burn rate, or "" when
// the quota will last until the reset, is too early in the window, or has no known window.
function formatQuotaForecast(quota, { format, fallback = "countdown", clock = {}, lang } = {}) {
  const remaining = Number(quota?.remaining);
  const resetSeconds = Number(quota?.resetSeconds);
  const elapsedPct = quota?.elapsedPct == null ? NaN : Number(quota.elapsedPct);

  if (
    quota?.elapsedPct == null ||
    !Number.isFinite(elapsedPct) ||
    elapsedPct <= 0 ||
    elapsedPct >= 100 ||
    !Number.isFinite(remaining) ||
    remaining <= 0 ||
    remaining >= 100 ||
    !Number.isFinite(resetSeconds) ||
    resetSeconds <= 0
  ) {
    return "";
  }

  const winSeconds = Number(quota?.windowSeconds);
  const elapsedSeconds =
    Number.isFinite(winSeconds) && winSeconds > resetSeconds
      ? winSeconds - resetSeconds
      : (resetSeconds * elapsedPct) / (100 - elapsedPct);

  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < MIN_FORECAST_ELAPSED_SEC) {
    return "";
  }

  const usedPct = 100 - remaining;
  if (usedPct <= elapsedPct) {
    return "";
  }

  const runsOutInSeconds = Math.max(1, Math.floor((remaining * elapsedSeconds) / usedPct));
  if (!Number.isFinite(runsOutInSeconds) || runsOutInSeconds >= resetSeconds) {
    return "";
  }

  const chosen =
    format === "countdown" || format === "time"
      ? format
      : fallback === "time"
        ? "time"
        : "countdown";

  if (chosen === "time") {
    const target = new Date(Date.now() + runsOutInSeconds * 1000);
    const exact =
      runsOutInSeconds >= 86400
        ? `${formatClockDate(target, clock)}, ${formatClockTime(target, clock)}`
        : formatClockTime(target, clock);
    return `~${exact}`;
  }

  return `~${formatReset(runsOutInSeconds, lang)}`;
}

function resetInSeconds(quota) {
  const seconds = Number(quota?.reset_in_seconds);

  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  if (quota?.reset_time) {
    const parsed = Date.parse(quota.reset_time);

    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor((parsed - Date.now()) / 1000));
    }
  }

  return 0;
}

function formatTokens(n) {
  n = Number(n);

  if (!Number.isFinite(n) || n < 0) {
    n = 0;
  }

  if (n >= 999_950) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }

  return `${Math.round(n)}`;
}

// "Gemini 4 Hydrogen (High)" -> "4 Hydrogen·High". Other names only lose a
// trailing "(...)" to the same separator.
function shortModelName(name, ascii = false) {
  return String(name ?? "")
    .replace(/^gemini\s+/i, "")
    .replace(/\s*\(([^)]+)\)\s*$/, ascii ? " $1" : "·$1");
}

// Session input and output tokens: "88.2K↑ 61.1K↓", or "88.2K in 61.1K out".
function formatTokenSplit(input, output, ascii = false, lang) {
  return ascii
    ? `${formatTokens(input)} ${t("tokens_in", lang)} ${formatTokens(output)} ${t("tokens_out", lang)}`
    : `${formatTokens(input)}↑ ${formatTokens(output)}↓`;
}

// The usage widgets' text: "1.2M", or "1.0M↑ 245.3K↓" with "split", plus the
// share of a "budget" when one is set ("1.2M (60%)"). null with no tokens.
function formatUsage(tokens, widget = {}, ascii = false, lang) {
  const input = Number(tokens?.input) || 0;
  const output = Number(tokens?.output) || 0;
  const total = input + output;
  if (!(total > 0)) {
    return null;
  }
  const value = widget?.split ? formatTokenSplit(input, output, ascii, lang) : formatTokens(total);
  const budget = widget?.budget;
  const pct =
    typeof budget === "number" && Number.isFinite(budget) && budget > 0
      ? (total * 100) / budget
      : null;
  return { text: pct === null ? value : `${value} (${Math.round(pct)}%)`, pct };
}

// "used/window", or just the used tokens while the window size is unknown.
function formatContextTokens(used, size) {
  return size > 0 ? `${formatTokens(used)}/${formatTokens(size)}` : formatTokens(used);
}

// Quota widgets: a widget's own warn/crit, else thresholds.quotaWarn/quotaCrit.
function resolveQuotaThresholds(widget = {}, config = {}) {
  return resolveThresholds(widget, config, "quotaWarn", "quotaCrit", 30, 10);
}

// Context widgets: a widget's own warn/crit, else thresholds.contextWarn/contextCrit.
function resolveContextThresholds(widget = {}, config = {}) {
  return resolveThresholds(widget, config, "contextWarn", "contextCrit", 70, 90);
}

function resolveThresholds(widget, config, warnKey, critKey, warnDefault, critDefault) {
  const global = config?.thresholds || {};
  const warn = Number(widget?.warn ?? global[warnKey] ?? warnDefault);
  const crit = Number(widget?.crit ?? global[critKey] ?? critDefault);

  return {
    warn: Number.isFinite(warn) ? warn : warnDefault,
    crit: Number.isFinite(crit) ? crit : critDefault,
    blink: widget?.blink !== undefined ? widget.blink : (global.blink ?? false),
  };
}

// blink: true blinks danger-level widgets, "warn" caution-level ones too.
function shouldBlink(level, blinkOpt) {
  if (blinkOpt === true) {
    return level === "crit";
  }
  if (blinkOpt === "warn") {
    return level === "crit" || level === "warn";
  }
  return false;
}

function quotaColor(remainingPct, healthy, options = {}) {
  const crit = options.crit ?? 10;
  const warn = options.warn ?? 30;
  const critColor = options.critColor || rgb(255, 125, 130);
  const warnColor = options.warnColor || rgb(255, 210, 110);

  if (remainingPct <= crit) {
    return critColor;
  }

  if (remainingPct <= warn) {
    return warnColor;
  }

  return healthy;
}

function contextColor(usedPct, healthy, exceeds200k, options = {}) {
  const crit = options.crit ?? 90;
  const warn = options.warn ?? 70;
  const critColor = options.critColor || rgb(255, 125, 130);
  const warnColor = options.warnColor || rgb(255, 210, 110);

  if (exceeds200k || usedPct >= crit) {
    return critColor;
  }

  if (usedPct >= warn) {
    return warnColor;
  }

  return healthy;
}

function label(emojis, emoji, named, value) {
  if (emojis) {
    return named ? ` ${emoji} ${named}: ${value} ` : ` ${emoji} ${value} `;
  }

  return named ? ` ${named}: ${value} ` : ` ${value} `;
}

// "+128 −34" as parts, so Lines can color each; zero counts are left out.
function gitChangeParts(changes, ascii = false) {
  const parts = [];
  if (changes?.added > 0) {
    parts.push({ kind: "added", text: `+${changes.added}` });
  }
  if (changes?.removed > 0) {
    parts.push({ kind: "removed", text: `${ascii ? "-" : "−"}${changes.removed}` });
  }
  return parts;
}

const GIT_FILE_MARKS = {
  unicode: { staged: "+", modified: "●", untracked: "?", conflicts: "≠" },
  ascii: { staged: "S", modified: "M", untracked: "?", conflicts: "!" },
};

// "+2 ●3 ?1 ≠1" as parts: staged, modified, untracked, in conflict.
function gitFileParts(files, ascii = false) {
  const marks = GIT_FILE_MARKS[ascii ? "ascii" : "unicode"];
  return Object.keys(marks)
    .filter((kind) => files?.[kind] > 0)
    .map((kind) => ({ kind, text: `${marks[kind]}${files[kind]}` }));
}

function formatGitSync(ahead, behind, ascii = false) {
  const up = ascii ? "^" : "⇡";
  const down = ascii ? "v" : "⇣";
  const a = Number(ahead || 0);
  const b = Number(behind || 0);
  if (a > 0 && b > 0) {
    return `${up}${a} ${down}${b}`;
  }
  if (a > 0) {
    return `${up}${a}`;
  }
  if (b > 0) {
    return `${down}${b}`;
  }
  return "";
}

const GIT_OPERATION_LABELS = {
  rebase: "REBASE",
  am: "AM",
  merge: "MERGING",
  "cherry-pick": "CHERRY-PICKING",
  revert: "REVERTING",
  bisect: "BISECTING",
};

// "REBASE 2/5", "MERGING", or "" with no operation. Plain ASCII in both modes.
function formatGitOperation(op) {
  const name = GIT_OPERATION_LABELS[op?.name];
  if (!name) {
    return "";
  }
  return Number.isInteger(op.step) && Number.isInteger(op.total)
    ? `${name} ${op.step}/${op.total}`
    : name;
}

// "2 subagents, 1 task", or "" when nothing runs. `detail` ("research: List
// the files…") stands in for the count of a lone running subagent.
function formatTasks(subagents, tasks, lang, detail = "") {
  const part = (n, one, many) => (n > 0 ? `${n} ${t(n === 1 ? one : many, lang)}` : "");
  return [
    (subagents === 1 && detail) || part(subagents, "subagent", "subagents"),
    part(tasks, "task", "tasks"),
  ]
    .filter(Boolean)
    .join(", ");
}

// "research: List the files…" for the one running subagent, or "" when it
// has neither a name nor a role. Both are cut: a role is a whole prompt
// sentence, and must not push other widgets off the row.
function formatSubagent(subagent, nameMax, roleMax, ascii = false) {
  const cut = (value, max) => (value ? clipText(value, max, ascii) : "");
  return [cut(subagent?.name, nameMax), cut(subagent?.role, roleMax)].filter(Boolean).join(": ");
}

// "accept-edits, NORMAL", or "" in the default mode with Vim editing off.
function formatMode(approval, vim) {
  return [approval === "default" ? "" : approval, vim].filter(Boolean).join(", ");
}

function formatUsd(value) {
  const usd = Number(value);
  if (!Number.isFinite(usd) || usd < 0) {
    return "";
  }
  if (usd > 0 && usd < 0.0001) {
    return "<$0.0001";
  }
  return usd > 0 && usd < 0.00995 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

function formatCost(cost, widget = {}, ascii = false, lang) {
  if (!cost || typeof cost !== "object") {
    return "";
  }
  const usd = Number(cost.totalUsd);
  const amount = formatUsd(usd);
  if (!amount) {
    return "";
  }
  const total = cost.estimated ? `~${amount}` : amount;
  const sub = widget?.split === true && cost.subagentUsd > 0 ? formatUsd(cost.subagentUsd) : "";
  const withSub = sub ? `${total}${ascii ? ", " : " · "}${t("subagents", lang)} ${sub}` : total;
  const budget = widget?.budget;
  const pct =
    typeof budget === "number" && Number.isFinite(budget) && budget > 0
      ? (usd * 100) / budget
      : null;
  return pct === null ? withSub : `${withSub} (${Math.round(pct)}%)`;
}

module.exports = {
  stripControl,
  firstText,
  sanitizeDeep,
  formatReset,
  formatSessionTime,
  MONTHS_SHORT,
  parseResetDate,
  formatClockTime,
  formatResetTime,
  formatResetDatetime,
  formatClockDate,
  formatResetText,
  normalizeClock,
  paceIndex,
  paceGlyph,
  formatPaceDelta,
  formatQuotaForecast,
  resetInSeconds,
  formatTokens,
  formatContextTokens,
  shortModelName,
  formatTokenSplit,
  formatUsage,
  formatGitSync,
  formatGitOperation,
  gitChangeParts,
  gitFileParts,
  formatTasks,
  formatMode,
  formatCost,
  clipText,
  formatSubagent,
  limitWidth,
  isValidMaxWidth,
  shortenPath,
  fishPath,
  fishBranch,
  isValidDepth,
  quotaColor,
  contextColor,
  resolveQuotaThresholds,
  resolveContextThresholds,
  shouldBlink,
  basenameOf,
  homePath,
  label,
  charWidth,
  visibleWidth,
  splitGraphemes,
  graphemeWidth,
  cutToWidth,
  closeLink,
  pathLinkUrl,
  osc8Link,
  linkPath,
  linkGitBranch,
  linkGitSha,
};
