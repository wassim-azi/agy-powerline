// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

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

function visibleWidth(text) {
  // Each run between escapes is measured on its own, the way cutToWidth()
  // walks it, so a cut line never measures wider than the cut allowed.
  let width = 0;
  for (const run of String(text).split(ESCAPE_SPLIT)) {
    width += textWidth(run);
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

// Cuts text to `max` terminal columns, ending with an ellipsis when cut.
function clipText(text, max, ascii = false) {
  const value = String(text);
  if (visibleWidth(value) <= max) {
    return value;
  }
  // The ASCII "..." is 3 columns: never let it outgrow `max`.
  const ellipsis = (ascii ? "..." : "…").slice(0, Math.max(0, max));
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
  charWidth,
  visibleWidth,
  splitGraphemes,
  graphemeWidth,
  textWidth,
  cutToWidth,
  closeLink,
  clipText,
  isValidMaxWidth,
  limitWidth,
  stripControl,
  firstText,
  sanitizeDeep,
};
