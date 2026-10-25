// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const CSI = "\x1b[";
const RESET = `${CSI}0m`;
const BOLD = `${CSI}1m`;
const DIM = `${CSI}2m`;
// Normal intensity: ends bold (and dim) without resetting colors.
const NORMAL = `${CSI}22m`;
const BLINK = `${CSI}5m`;
const BLINK_OFF = `${CSI}25m`;

let activeDepth = "truecolor";

function setActiveDepth(depth) {
  activeDepth = depth;
}

function getActiveDepth() {
  return activeDepth;
}

const COLOR_MODES = ["auto", "truecolor", "256", "none"];

function resolveColorModeId(mode) {
  return COLOR_MODES.includes(mode) ? mode : "auto";
}

function isTruthyFlag(value) {
  return /^(1|true|yes)$/i.test(String(value ?? "").trim());
}

function detectColorDepth(env = {}) {
  if (env?.NO_COLOR !== undefined && String(env.NO_COLOR) !== "") {
    return "none";
  }

  const colorterm = String(env?.COLORTERM ?? "").trim();

  if (/^(truecolor|24bit)$/i.test(colorterm)) {
    return "truecolor";
  }

  if (/256colou?r/i.test(`${env?.TERM ?? ""} ${colorterm}`)) {
    return "256";
  }

  if (String(env?.TERM ?? "").trim() === "dumb") {
    return "none";
  }

  return "truecolor";
}

function resolveColorDepth({ configColor = "auto", cliColor = "", env = {} } = {}) {
  const cli = String(cliColor || "").toLowerCase();

  if (cli === "truecolor" || cli === "256" || cli === "none") {
    return cli;
  }

  if (env?.NO_COLOR !== undefined && String(env.NO_COLOR) !== "") {
    return "none";
  }

  const fromEnv = String(env?.AGY_POWERLINE_COLOR || "").toLowerCase();

  if (fromEnv === "truecolor" || fromEnv === "256" || fromEnv === "none") {
    return fromEnv;
  }

  if (configColor === "truecolor" || configColor === "256" || configColor === "none") {
    return configColor;
  }

  return detectColorDepth(env);
}

function resolveAscii(config, overrides = {}, env = {}) {
  if (overrides.ascii === true) {
    return true;
  }

  if (overrides.ascii === false) {
    return false;
  }

  return Boolean(config?.ascii) || isTruthyFlag(env?.AGY_POWERLINE_ASCII);
}

function rgb(r, g, b) {
  return [r, g, b];
}

// The nearest xterm color: the 6x6x6 cube's levels (0, 95, 135, ... 255) are
// not evenly spaced, and a near-gray reads better from the gray ramp, so both
// candidates are measured and the closer one wins (as tmux does).
const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

function rgbToAnsi256([r, g, b]) {
  const toCube = (v) => (v < 48 ? 0 : v < 115 ? 1 : Math.floor((v - 35) / 40));
  const [cr, cg, cb] = [toCube(r), toCube(g), toCube(b)];
  const cube = [CUBE_LEVELS[cr], CUBE_LEVELS[cg], CUBE_LEVELS[cb]];

  const average = (r + g + b) / 3;
  const grayIndex = average > 238 ? 23 : Math.max(0, Math.floor((average - 3) / 10));
  const level = 8 + 10 * grayIndex;
  const distance = ([x, y, z]) => (x - r) ** 2 + (y - g) ** 2 + (z - b) ** 2;

  return distance([level, level, level]) < distance(cube)
    ? 232 + grayIndex
    : 16 + 36 * cr + 6 * cg + cb;
}

function colorSeq(kind, [r, g, b]) {
  if (activeDepth === "none") {
    return "";
  }

  if (activeDepth === "256") {
    return `${CSI}${kind};5;${rgbToAnsi256([r, g, b])}m`;
  }

  return `${CSI}${kind};2;${r};${g};${b}m`;
}

function fg(rgb) {
  return colorSeq(38, rgb);
}

function bg(rgb) {
  return colorSeq(48, rgb);
}

// Back to the terminal's own background, whatever it is (dark or light).
function bgDefault() {
  return activeDepth === "none" ? "" : CSI + "49m";
}

function shade(color, amount) {
  return color.map((n) => Math.round(n * amount));
}

// t of the way from color a to color b.
function mix(a, b, t) {
  return a.map((value, i) => Math.round(value + (b[i] - value) * t));
}

function parseColor(value, fallback = [200, 200, 200]) {
  if (value == null) {
    return fallback;
  }

  if (Array.isArray(value)) {
    if (value.length >= 3) {
      const r = Math.max(0, Math.min(255, Number(value[0])));
      const g = Math.max(0, Math.min(255, Number(value[1])));
      const b = Math.max(0, Math.min(255, Number(value[2])));
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return [Math.round(r), Math.round(g), Math.round(b)];
      }
    }
    return fallback;
  }

  if (typeof value === "object") {
    if ("r" in value && "g" in value && "b" in value) {
      const r = Math.max(0, Math.min(255, Number(value.r)));
      const g = Math.max(0, Math.min(255, Number(value.g)));
      const b = Math.max(0, Math.min(255, Number(value.b)));
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return [Math.round(r), Math.round(g), Math.round(b)];
      }
    }
    return fallback;
  }

  if (typeof value === "string") {
    const s = value.trim();

    const hexMatch = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      const num = parseInt(hex, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }

    const rgbMatch = s.match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/i);
    if (rgbMatch) {
      const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
      const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
      const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
      return [r, g, b];
    }
  }

  return fallback;
}

function linear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function gamma(v) {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

// WCAG relative luminance and contrast ratio.
function luminance([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// OKLab (Björn Ottosson): mixing there keeps the middle of a gradient as
// bright and saturated as its ends, where sRGB mixing turns it muddy.
function toOklab([r, g, b]) {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const MAX_GRADIENT_STOPS = 6;
const HEX_STOP = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

// "#ff5f6d-#ffc371" (2 to 6 hex stops, "#" optional) to RGB stops, or null.
function parseGradientStops(spec) {
  if (typeof spec !== "string") {
    return null;
  }
  const parts = spec.trim().split("-");
  if (parts.length < 2 || parts.length > MAX_GRADIENT_STOPS) {
    return null;
  }
  if (!parts.every((part) => HEX_STOP.test(part))) {
    return null;
  }
  return parts.map((part) => parseColor(part));
}

// The color t (0 to 1) of the way along the stops; the ends are exact.
function gradientAt(stops, t) {
  const clamped = Math.max(0, Math.min(1, Number(t) || 0));
  const span = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(span));
  const local = span - i;
  if (local === 0) {
    return [...stops[i]];
  }
  if (local === 1) {
    return [...stops[i + 1]];
  }
  const [a, b] = [toOklab(stops[i]), toOklab(stops[i + 1])];
  return fromOklab(a.map((value, k) => value + (b[k] - value) * local));
}

// count evenly spaced colors from the first stop to the last.
function gradientColors(stops, count) {
  if (count <= 1) {
    return count === 1 ? [[...stops[0]]] : [];
  }
  return Array.from({ length: count }, (_, i) => gradientAt(stops, i / (count - 1)));
}

const MIN_CONTRAST = 4.5;

// The preferred text color if it reads on the background, else whichever of
// the fallbacks contrasts most.
function readableText(background, preferred, fallbacks) {
  if (contrastRatio(preferred, background) >= MIN_CONTRAST) {
    return preferred;
  }
  return fallbacks.reduce((best, color) =>
    contrastRatio(color, background) > contrastRatio(best, background) ? color : best
  );
}

// The color moved toward white (on a dark background) or black (on a light
// one) just far enough to reach the minimum contrast.
function withContrast(color, background, min = MIN_CONTRAST) {
  if (contrastRatio(color, background) >= min) {
    return color;
  }
  const target = luminance(background) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  for (let step = 1; step <= 20; step++) {
    const moved = mix(color, target, step / 20);
    if (contrastRatio(moved, background) >= min) {
      return moved;
    }
  }
  return target;
}

module.exports = {
  CSI,
  RESET,
  BOLD,
  DIM,
  NORMAL,
  BLINK,
  BLINK_OFF,
  setActiveDepth,
  getActiveDepth,
  COLOR_MODES,
  resolveColorModeId,
  isTruthyFlag,
  detectColorDepth,
  resolveColorDepth,
  resolveAscii,
  rgb,
  rgbToAnsi256,
  colorSeq,
  fg,
  bg,
  bgDefault,
  shade,
  mix,
  parseColor,
  luminance,
  contrastRatio,
  toOklab,
  fromOklab,
  MAX_GRADIENT_STOPS,
  parseGradientStops,
  gradientAt,
  gradientColors,
  MIN_CONTRAST,
  readableText,
  withContrast,
};
