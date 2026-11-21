// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const os = require("os");
const path = require("path");
const { rgb } = require("./colors");
const { t } = require("./i18n");

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

  const input = String(value);
  if (input === "~" || /^~[\\/]/.test(input)) {
    return input;
  }
  const windowsAbsolute = /^[a-z]:[\\/]|^\\\\/i.test(input);
  const posixAbsolute = input.startsWith("/");

  // Payload paths can come from another OS. Preserve absolute paths in that
  // format instead of resolving them relative to this machine's cwd.
  if (
    (windowsAbsolute && process.platform !== "win32") ||
    (posixAbsolute && process.platform === "win32")
  ) {
    return input;
  }

  const resolvePath =
    (process.platform === "win32" ? path.win32?.resolve : path.posix?.resolve) || path.resolve;
  const resolved = resolvePath(input);
  const home = resolvePath(os.homedir());
  const normResolved = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const normHome = process.platform === "win32" ? home.toLowerCase() : home;
  const nextChar = resolved[home.length];
  const hasBoundary =
    normResolved.length === normHome.length || nextChar === "/" || nextChar === "\\";

  if (normResolved.startsWith(normHome) && hasBoundary) {
    return "~" + resolved.slice(home.length);
  }

  return resolved;
}

function isValidDepth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

// Keep the path's root and final `depth` folders, replacing any middle
// folders with one ellipsis. Accept either OS's path separators on every OS.
function shortenPath(value, depth, ascii = false) {
  const text = String(value ?? "");
  if (!text || !isValidDepth(depth)) {
    return text;
  }

  let root = "";
  let rest = text;
  let separator = text.match(/[\\/]/)?.[0] || "/";
  // A network share keeps \\server\share (or //server/share) as its root.
  const unc = text.match(/^([\\/]{2}[^\\/]+[\\/][^\\/]+)([\\/])?(.*)$/);
  const drive = text.match(/^([a-z]:)([\\/])(.*)$/i);

  if (unc) {
    root = unc[1];
    separator = unc[2] || separator;
    rest = unc[3];
  } else if (drive) {
    root = drive[1];
    separator = drive[2];
    rest = drive[3];
  } else if (text === "~" || /^~[\\/]/.test(text)) {
    root = "~";
    if (text.length > 1) {
      separator = text[1];
      rest = text.slice(2);
    } else {
      rest = "";
    }
  } else if (text[0] === "/" || text[0] === "\\") {
    root = text[0];
    separator = text[0];
    rest = text.slice(1);
  }

  const folders = rest.split(/[\\/]+/).filter(Boolean);
  if (folders.length <= depth) {
    return text;
  }

  const suffix = folders.slice(-depth).join(separator);
  const ellipsis = ascii ? "..." : "…";
  if (root === "/" || root === "\\") {
    return `${root}${ellipsis}${separator}${suffix}`;
  }
  return `${root ? `${root}${separator}` : ""}${ellipsis}${separator}${suffix}`;
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
    (code >= 0xfe20 && code <= 0xfe2f) ||
    // Invisible format characters stripControl keeps (ZWSP, ZWNJ, bidi marks,
    // word joiner, BOM, Mongolian variation selectors, tags, ideographic
    // variation selectors). U+00AD and U+202F stay 1: terminals draw them,
    // and Intl puts U+202F in times ("6:33 PM").
    code === 0x061c ||
    (code >= 0x180b && code <= 0x180f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x206f) ||
    code === 0xfeff ||
    (code >= 0xe0000 && code <= 0xe01ef)
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
  // Each run between escapes is measured on its own, the way cutToWidth()
  // walks it, so a cut line never measures wider than the cut allowed.
  let width = 0;
  for (const run of String(text).split(ESCAPE_SPLIT)) {
    width += textWidth(run);
  }
  return width;
}

// Our own escapes, kept whole when text is measured or cut: SGR and other
// CSI sequences, and OSC 8 hyperlinks (URL and terminator captured).
const ESCAPE_SPLIT = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\]8;;[^\x1b\x07]*(?:\x07|\x1b\\)/;
const ESCAPE_ALL = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\]8;;([^\x1b\x07]*)(\x07|\x1b\\)/g;

// Characters that can join the one before them into a single grapheme
// cluster. Text without any (most of the bar) is measured code point by
// code point, which is both faster and the same result.
const JOINING =
  /\u200c|\u200d|[\p{M}\p{Emoji_Modifier}\u1100-\u11ff\ua960-\ua97f\uac00-\ud7a3\ud7b0-\ud7ff\uff9e\uff9f\u{1f1e6}-\u{1f1ff}\u{e0020}-\u{e007f}]/u;
const EXTEND = /^(?:\u200c|[\p{M}\p{Emoji_Modifier}\u{e0020}-\u{e007f}\uff9e\uff9f])$/u;
const PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;
const EMOJI = /^\p{Emoji}$/u;

function isRegional(code) {
  return code >= 0x1f1e6 && code <= 0x1f1ff;
}

// Hangul jamo sequences (L V T) and precomposed syllables (LV, LVT).
function hangulJoins(prev, code) {
  const L = (c) => (c >= 0x1100 && c <= 0x115f) || (c >= 0xa960 && c <= 0xa97c);
  const V = (c) => (c >= 0x1160 && c <= 0x11a7) || (c >= 0xd7b0 && c <= 0xd7c6);
  const T = (c) => (c >= 0x11a8 && c <= 0x11ff) || (c >= 0xd7cb && c <= 0xd7fb);
  const syllable = (c) => c >= 0xac00 && c <= 0xd7a3;
  const LV = (c) => syllable(c) && (c - 0xac00) % 28 === 0;
  const LVT = (c) => syllable(c) && (c - 0xac00) % 28 !== 0;
  return (
    (L(prev) && (L(code) || V(code) || syllable(code))) ||
    ((LV(prev) || V(prev)) && (V(code) || T(code))) ||
    ((LVT(prev) || T(prev)) && T(code))
  );
}

// Splits text into grapheme clusters, following Unicode's rules (UAX #29)
// for what a terminal shows as one character: a base with its combining
// marks, variation selectors, skin tones and tags; emoji joined by ZWJ; flag
// pairs; Hangul jamo. Not Intl.Segmenter: the first one built starts ICU,
// about 16 ms (a sixth of a refresh), and its clusters change with Node's
// ICU version. Prepended marks and Indic conjuncts stay split, which only
// matters for where a cut may fall: their width is the sum either way.
function splitGraphemes(text) {
  const str = String(text ?? "");
  if (!JOINING.test(str)) {
    return Array.from(str);
  }

  const clusters = [];
  let cluster = "";
  let first = 0;
  let prev = 0;
  let regionals = 0;
  for (const char of str) {
    const code = char.codePointAt(0);
    const joins =
      cluster !== "" &&
      code >= 0x300 &&
      (code === 0x200d ||
        EXTEND.test(char) ||
        (prev === 0x200d &&
          PICTOGRAPHIC.test(char) &&
          PICTOGRAPHIC.test(String.fromCodePoint(first))) ||
        (isRegional(code) && isRegional(first) && regionals === 1) ||
        hangulJoins(prev, code));
    if (joins) {
      cluster += char;
    } else {
      if (cluster) {
        clusters.push(cluster);
      }
      cluster = char;
      first = code;
      regionals = 0;
    }
    if (isRegional(code)) {
      regionals++;
    }
    prev = code;
  }
  if (cluster) {
    clusters.push(cluster);
  }
  return clusters;
}

// Terminal columns for one grapheme cluster. Emoji sequences (a flag, a ZWJ
// sequence, an emoji with VS16 or a keycap) draw as one wide glyph; anything
// else keeps the sum of its code points, as before, so CJK, combining marks
// and scripts the terminal draws piece by piece don't measure narrower.
function graphemeWidth(cluster) {
  const value = String(cluster ?? "");
  const first = value.codePointAt(0);
  if (first === undefined) {
    return 0;
  }
  if (value.length === (first > 0xffff ? 2 : 1)) {
    return charWidth(first);
  }
  if (
    isRegional(first) ||
    ((value.includes("\u200d") || value.includes("\ufe0f")) &&
      EMOJI.test(String.fromCodePoint(first)))
  ) {
    return 2;
  }
  let width = 0;
  for (const char of value) {
    width += charWidth(char.codePointAt(0));
  }
  return width;
}

// Width of text without escapes.
function textWidth(text) {
  let width = 0;
  if (!JOINING.test(text)) {
    for (const char of text) {
      width += charWidth(char.codePointAt(0));
    }
    return width;
  }
  for (const cluster of splitGraphemes(text)) {
    width += graphemeWidth(cluster);
  }
  return width;
}

// The start of `text` that fits in `budget` columns: grapheme clusters are
// never split, and our escapes are kept whole. `link` is the terminator of
// an OSC 8 hyperlink still open where the text was cut ("" if none), so the
// caller can close it before adding an ellipsis.
function cutToWidth(text, budget) {
  const value = String(text);
  let out = "";
  let width = 0;
  let link = "";
  let last = 0;
  const take = (run) => {
    for (const cluster of splitGraphemes(run)) {
      const w = graphemeWidth(cluster);
      if (width + w > budget) {
        return false;
      }
      out += cluster;
      width += w;
    }
    return true;
  };

  for (const match of value.matchAll(ESCAPE_ALL)) {
    if (!take(value.slice(last, match.index))) {
      return { out, link };
    }
    out += match[0];
    if (match[2] !== undefined) {
      link = match[1] ? match[2] : "";
    }
    last = match.index + match[0].length;
  }
  take(value.slice(last));
  return { out, link };
}

// Ends an open OSC 8 hyperlink with the terminator it was opened with.
function closeLink(terminator) {
  return terminator ? `\x1b]8;;${terminator}` : "";
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

// Cuts text to `max` terminal columns, ending with an ellipsis when cut.
function clipText(text, max, ascii = false) {
  const value = String(text);
  if (visibleWidth(value) <= max) {
    return value;
  }
  const ellipsis = ascii ? "..." : "…";
  const { out, link } = cutToWidth(value, max - ellipsis.length);
  const clipped = out.trimEnd() + closeLink(link) + ellipsis;
  return /\x1b\[[0-?]*[ -/]*m/.test(clipped) ? `${clipped}\x1b[0m` : clipped;
}

function isValidMaxWidth(value) {
  return Number.isInteger(value) && value >= 4 && value <= 200;
}

function limitWidth(value, widget, ascii = false, fallback) {
  const width = isValidMaxWidth(widget?.maxWidth)
    ? widget.maxWidth
    : isValidMaxWidth(fallback)
      ? fallback
      : null;
  return width === null ? value : clipText(value, width, ascii);
}

// Removes escape sequences and control characters from text that did not
// come from us (payload fields, branch names, command output), so it cannot
// drive the terminal: cursor moves, OSC 52 clipboard writes, hyperlinks...
function stripControl(text) {
  return (
    String(text ?? "")
      // Control strings, body included: OSC, DCS, SOS, PM and APC, as 7-bit
      // (ESC ] P X ^ _) or 8-bit C1 (0x9D 0x90 0x98 0x9E 0x9F) introducers.
      .replace(/(?:\x1b[\]PX^_]|[\x90\x98\x9d-\x9f])[^\x07\x1b\x9c]*(?:\x07|\x1b\\|\x9c)?/g, "")
      // CSI. The 8-bit form needs a parameter byte, so a stray 0x9B before
      // plain text ("\x9bz") loses only itself, not the letter after it.
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x9b[0-?]+[ -/]*[@-~]/g, "")
      // Other escapes, with intermediate bytes too: ESC ( B from `tput sgr0`,
      // ESC # 8, ESC 7, ESC c...
      .replace(/\x1b(?:[ -/]+[0-~]|[0-~])?/g, "")
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
};
