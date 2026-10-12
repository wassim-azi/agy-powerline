"use strict";

const os = require("os");
const path = require("path");
const { rgb } = require("./colors");

function formatReset(seconds) {
  seconds = Number(seconds);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "now";
  }

  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}hr ${minutes}m`;
  }

  return `${Math.max(1, minutes)}m`;
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

  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }

  return `${Math.round(n)}`;
}

// "Gemini 3.8 Flash (High)" -> "3.8 Flash·High". Other names only lose a
// trailing "(...)" to the same separator.
function shortModelName(name, ascii = false) {
  return String(name ?? "")
    .replace(/^gemini\s+/i, "")
    .replace(/\s*\(([^)]+)\)\s*$/, ascii ? " $1" : "·$1");
}

// Session input and output tokens: "88.2K↑ 61.1K↓", or "88.2K in 61.1K out".
function formatTokenSplit(input, output, ascii = false) {
  return ascii
    ? `${formatTokens(input)} in ${formatTokens(output)} out`
    : `${formatTokens(input)}↑ ${formatTokens(output)}↓`;
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

function basenameOf(value) {
  if (!value) {
    return "";
  }

  return path.basename(String(value).replace(/[\\/]+$/, ""));
}

function homePath(value) {
  if (!value) {
    return "";
  }

  const resolved = path.resolve(String(value));
  const home = path.resolve(os.homedir());
  const prefix =
    process.platform === "win32"
      ? resolved.toLowerCase().startsWith(home.toLowerCase())
      : resolved.startsWith(home);

  if (prefix) {
    return "~" + resolved.slice(home.length);
  }

  return resolved;
}

function label(emojis, emoji, named, value) {
  if (emojis) {
    return named ? ` ${emoji} ${named}: ${value} ` : ` ${emoji} ${value} `;
  }

  return named ? ` ${named}: ${value} ` : ` ${value} `;
}

function charWidth(code) {
  if (
    code === 0x200d ||
    (code >= 0xfe00 && code <= 0xfe0f) ||
    code === 0xfe0e ||
    code === 0xfe0f ||
    (code >= 0x1f3fb && code <= 0x1f3ff) ||
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  ) {
    return 0;
  }

  if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
    return 0;
  }

  // Miscellaneous Technical, Symbols, Dingbats, and Arrows emojis (e.g. ⌚, ⌛, ⌨, ⏩-⏳, ⏸-⏺, ⭐, ⭕, etc.)
  if (
    code === 0x203c || // ‼️
    code === 0x2049 || // ⁉️
    code === 0x2122 || // ™️
    code === 0x2139 || // ℹ️
    (code >= 0x2194 && code <= 0x2199) || // ↔️-↙️
    (code >= 0x21a9 && code <= 0x21aa) || // ↩️, ↪️
    (code >= 0x231a && code <= 0x231b) || // ⌚, ⌛
    code === 0x2328 || // ⌨
    code === 0x23cf || // ⏏
    (code >= 0x23e9 && code <= 0x23f3) || // ⏩-⏳ (includes ⏰, ⏱, ⏲, ⏳)
    (code >= 0x23f8 && code <= 0x23fa) || // ⏸-⏺
    code === 0x24c2 || // Ⓜ️
    (code >= 0x25aa && code <= 0x25ab) || // ▪️, ▫️
    (code >= 0x25fb && code <= 0x25fe) || // ◻️-◾
    (code >= 0x2600 && code <= 0x27bf) || // Misc symbols & Dingbats (⚡, ⚠, ❌, etc.)
    (code >= 0x2934 && code <= 0x2935) || // ⤴️, ⤵️
    (code >= 0x2b05 && code <= 0x2b07) || // ⬅️-⬇️
    (code >= 0x2b1b && code <= 0x2b1c) || // ⬛, ⬜
    code === 0x2b50 || // ⭐
    code === 0x2b55 || // ⭕
    code === 0x3030 || // 〰️
    code === 0x303d || // 〽️
    code === 0x3297 || // ㊗️
    code === 0x3299 // ㊙️
  ) {
    return 2;
  }

  // East Asian Wide / Fullwidth and Supplementary Ideographic / Emoji planes
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f000 && code <= 0x1ffff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  ) {
    return 2;
  }

  return 1;
}

function visibleWidth(text) {
  const stripped = String(text).replace(
    /\x1b\[[0-9;]*[a-zA-Z]|\x1b\]8;;[^\x1b\x07]*(\x07|\x1b\\)/g,
    ""
  );
  let width = 0;

  for (const char of stripped) {
    width += charWidth(char.codePointAt(0));
  }

  return width;
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

// "2 subagents, 1 task", or "" when nothing runs.
function formatTasks(subagents, tasks) {
  const part = (n, word) => (n > 0 ? `${n} ${word}${n === 1 ? "" : "s"}` : "");
  return [part(subagents, "subagent"), part(tasks, "task")].filter(Boolean).join(", ");
}

// "accept-edits, NORMAL", or "" in the default mode with Vim editing off.
function formatMode(approval, vim) {
  return [approval === "default" ? "" : approval, vim].filter(Boolean).join(", ");
}

// Removes escape sequences and control characters from text that did not
// come from us (payload fields, branch names, command output), so it cannot
// drive the terminal: cursor moves, OSC 52 clipboard writes, hyperlinks...
function stripControl(text) {
  return (
    String(text ?? "")
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, "")
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
      .replace(/\x1b[@-_]?/g, "")
      .replace(/[\x00-\x1f\x7f-\x9f]/g, "")
      // Line/paragraph separators split the bar into extra rows in some
      // terminals, and bidi overrides can make a branch name read as another.
      // Zero-width joiners and plain RTL marks stay: emoji and RTL text need them.
      .replace(/[\u2028\u2029\u202A-\u202E\u2066-\u2069]/g, "")
  );
}

// Payload fields are untrusted in type as well as content. Returns the first
// value that is text (a string or finite number), so an object never prints
// as "[object Object]" or reaches a string method.
function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

// Applies stripControl to every string in a plain object/array tree.
function sanitizeDeep(value, depth = 0) {
  if (typeof value === "string") {
    return stripControl(value);
  }

  if (depth > 8 || value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item, depth + 1));
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = sanitizeDeep(item, depth + 1);
  }
  return out;
}

module.exports = {
  stripControl,
  firstText,
  sanitizeDeep,
  formatReset,
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
  resetInSeconds,
  formatTokens,
  formatContextTokens,
  shortModelName,
  formatTokenSplit,
  formatGitSync,
  formatTasks,
  formatMode,
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
};
