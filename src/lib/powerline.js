// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Powerline glyphs are stored as hex code points ("E0B4") so the config file
// stays readable in editors without a Nerd Font. Brackets read well as caps
// but not between two widgets, so round glyphs join with arrows in ASCII.
const GLYPHS = {
  E0B0: { name: "Triangle Right", ascii: ">" },
  E0B2: { name: "Triangle Left", ascii: "<" },
  E0B4: { name: "Round Right", ascii: "]", asciiJoin: ">" },
  E0B6: { name: "Round Left", ascii: "[", asciiJoin: "<" },
  E0B8: { name: "Diagonal \\", ascii: "\\" },
  E0BA: { name: "Diagonal /", ascii: "/" },
  E0BC: { name: "Diagonal /", ascii: "/" },
  E0BE: { name: "Diagonal \\", ascii: "\\" },
};

// What each slot offers in the configure TUI. Left-pointing separators read
// correctly only with inverted colors, so the TUI flips invert for them.
const SLOT_PRESETS = {
  separator: ["E0B0", "E0B2", "E0B4", "E0B6", "E0BC", "E0B8"],
  startCap: ["E0B6", "E0B2", "E0BA", "E0BE"],
  endCap: ["E0B4", "E0B0", "E0BC", "E0B8"],
};

const INVERTED_BY_DEFAULT = new Set(["E0B2", "E0B6"]);

// Custom glyphs have no ASCII twin: separators still need a visible divider,
// caps can simply disappear.
const ASCII_FALLBACK = {
  separator: ">",
  startCap: "",
  endCap: "",
};

const STYLES = {
  round: {
    id: "round",
    name: "Round",
    description: "Rounded capsules with rounded joins (default)",
    separators: ["E0B4"],
    startCaps: ["E0B6"],
    endCaps: ["E0B4"],
  },
  angled: {
    id: "angled",
    name: "Angled / Arrow",
    description: "Traditional Powerline arrows",
    separators: ["E0B0"],
    startCaps: ["E0B2"],
    endCaps: ["E0B0"],
  },
  slanted: {
    id: "slanted",
    name: "Slanted",
    description: "Diagonal cuts at both ends and between widgets",
    separators: ["E0BC"],
    startCaps: ["E0BA"],
    endCaps: ["E0BC"],
  },
  flat: {
    id: "flat",
    name: "Flat / Square",
    description: "Flush rectangular blocks with no caps or joins",
    separators: [],
    startCaps: [],
    endCaps: [],
  },
};

const STYLE_ORDER = ["round", "angled", "slanted", "flat"];

// Bounds a hand-edited config; nobody needs more glyphs than this to cycle.
const MAX_GLYPHS = 16;

// One printable code point only: no control, format, whitespace, combining or
// unassigned characters, so a config file can't smuggle in escape sequences or
// break the width math. Private-use code points (Nerd Font glyphs) are allowed.
const UNPRINTABLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Cn}\p{Z}\p{M}]/u;

function parseGlyph(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(?:U\+|0x)?([0-9a-fA-F]{2,6})$/i);
  if (!match) {
    return null;
  }

  const codePoint = parseInt(match[1], 16);
  if (codePoint > 0x10ffff) {
    return null;
  }

  if (UNPRINTABLE.test(String.fromCodePoint(codePoint))) {
    return null;
  }

  return codePoint.toString(16).toUpperCase().padStart(4, "0");
}

function normalizeGlyphList(value, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value.map(parseGlyph).filter(Boolean).slice(0, MAX_GLYPHS);
}

function normalizePowerline(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const fallback = STYLES.round;
  const separators = normalizeGlyphList(source.separators, fallback.separators);
  const invert = Array.isArray(source.separatorInvert) ? source.separatorInvert : [];

  return {
    enabled: source.enabled !== false,
    separators,
    separatorInvert: separators.map((_, i) => invert[i] === true),
    startCaps: normalizeGlyphList(source.startCaps, fallback.startCaps),
    endCaps: normalizeGlyphList(source.endCaps, fallback.endCaps),
  };
}

function applyStyle(powerline, styleId) {
  const style = STYLES[styleId];
  if (!style) {
    return normalizePowerline(powerline);
  }

  return normalizePowerline({
    ...powerline,
    separators: style.separators,
    separatorInvert: style.separators.map((hex) => INVERTED_BY_DEFAULT.has(hex)),
    startCaps: style.startCaps,
    endCaps: style.endCaps,
  });
}

function sameList(a, b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

// The style whose glyphs match exactly, or null once the user has customized.
function detectStyle(powerline) {
  const current = normalizePowerline(powerline);

  for (const id of STYLE_ORDER) {
    const style = STYLES[id];
    const invert = style.separators.map((hex) => INVERTED_BY_DEFAULT.has(hex));
    if (
      sameList(current.separators, style.separators) &&
      sameList(current.separatorInvert, invert) &&
      sameList(current.startCaps, style.startCaps) &&
      sameList(current.endCaps, style.endCaps)
    ) {
      return id;
    }
  }

  return null;
}

// Cycles through the list; an empty list means no glyph in that slot.
function pickGlyph(list, index) {
  return list.length ? list[index % list.length] : null;
}

function glyphChar(hex, slot, ascii = false) {
  if (!hex) {
    return "";
  }

  if (ascii) {
    const known = GLYPHS[hex];
    if (known) {
      return (slot === "separator" && known.asciiJoin) || known.ascii;
    }
    return ASCII_FALLBACK[slot] ?? "";
  }

  return String.fromCodePoint(parseInt(hex, 16));
}

function glyphName(hex) {
  return GLYPHS[hex]?.name ?? "Custom";
}

module.exports = {
  GLYPHS,
  SLOT_PRESETS,
  INVERTED_BY_DEFAULT,
  STYLES,
  STYLE_ORDER,
  MAX_GLYPHS,
  parseGlyph,
  normalizeGlyphList,
  normalizePowerline,
  applyStyle,
  detectStyle,
  pickGlyph,
  glyphChar,
  glyphName,
};
