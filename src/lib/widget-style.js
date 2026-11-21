// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { parseColor } = require("./colors");
const {
  clipText,
  formatSubagent,
  limitWidth,
  stripControl,
  visibleWidth,
} = require("./formatters");
const { DEFAULT_LANGUAGE, t } = require("./i18n");
const {
  WIDGET_TAGS,
  QUOTA_WIDGETS,
  PACE_DELTA_WIDGETS,
  CONTEXT_WIDGETS,
  RESET_WIDGETS,
  USAGE_WIDGETS,
  SHOW_BELOW_SESSION_KEYS,
} = require("./widgets");

// Basic names the exec widget's color option always accepted; the Lines
// layout also uses them as its fallback palette.
const NAMED_COLORS = {
  blue: [0, 153, 255],
  orange: [255, 176, 85],
  green: [0, 175, 80],
  cyan: [86, 182, 194],
  red: [255, 85, 85],
  yellow: [230, 200, 0],
  white: [220, 220, 220],
  magenta: [180, 140, 255],
};

// Slots that signal state rather than identity. A widget's own color never
// replaces them, so caution/danger alerts still stand out.
const STATE_SLOTS = new Set(["text", "terminal", "track", "caution", "warn", "gitDirty"]);
const OS_ICONS = { Windows: "🪟", macOS: "🍎", Linux: "🐧", WSL: "🐧" };

// A theme slot ("git"), a basic name ("cyan"), or hex/rgb ("#ff8800").
function resolveColor(value, colors) {
  if (typeof value === "string") {
    const key = value.trim();
    if (colors && Array.isArray(colors[key])) {
      return colors[key];
    }
    if (NAMED_COLORS[key.toLowerCase()]) {
      return NAMED_COLORS[key.toLowerCase()];
    }
  } else if (!Array.isArray(value)) {
    return null;
  }

  return parseColor(value, null);
}

// The theme colors with this widget's color and text color swapped in. Every
// identity slot takes the widget color, so it applies whichever slot the
// widget normally draws with; the theme itself is left untouched.
function widgetColors(widget, colors) {
  const color = resolveColor(widget?.color, colors);
  const text = resolveColor(widget?.textColor, colors);

  if (!color && !text) {
    return colors;
  }

  const out = { ...colors };

  if (color) {
    for (const key of Object.keys(colors)) {
      if (!STATE_SLOTS.has(key) && Array.isArray(colors[key])) {
        out[key] = color;
      }
    }
  }

  if (text) {
    out.text = text;
  }

  return out;
}

// Raw widgets show only their value: no icon, no label.
function isRaw(widget, config) {
  if (widget?.raw === true || widget?.raw === false) {
    return widget.raw;
  }
  return config?.minimalist === true;
}

function isPaced(widget, config) {
  if (widget?.pace === true || widget?.pace === false) {
    return widget.pace;
  }
  return config?.pacing !== false;
}

// The pace delta is opt-in per widget, and the first thing to go when the row
// is fitted to a narrow terminal (compact).
function showsPaceDelta(widget) {
  return widget?.paceDelta === true && !widget.compact;
}

const VALID_FORECAST_VALUES = new Set([true, "countdown", "time"]);

// Run-out forecast is opt-in on percentage quota widgets and drops when fitted (compact).
function showsForecast(widget) {
  return VALID_FORECAST_VALUES.has(widget?.forecast) && !widget?.compact;
}

const VALID_ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
// Refuse credential-like variable names so a shared config cannot expose secrets on screen.
const SENSITIVE_ENV_NAME =
  /(?:TOKEN|SECRET|KEY|PASS|PWD|CREDENTIAL|AUTH|PRIVATE|COOKIE|BEARER|SESSION)/i;

function readEnvValue(widget, session, ascii = false) {
  const name = typeof widget?.var === "string" ? widget.var.trim() : "";
  if (!VALID_ENV_NAME.test(name) || SENSITIVE_ENV_NAME.test(name)) {
    return null;
  }
  const env = session?.env && typeof session.env === "object" ? session.env : process.env;
  const rawVal = Object.prototype.hasOwnProperty.call(env, name) ? env[name] : undefined;
  if (typeof rawVal !== "string") {
    return null;
  }
  const cleaned = stripControl(rawVal).replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }
  return { name, value: limitWidth(cleaned, widget, ascii) };
}

const LABEL_MAX = 20;
const ICON_MAX = 2;

// A widget's own "label": cleaned and cut to LABEL_MAX columns. "" means no
// name; anything that isn't a string leaves the built-in one.
function customLabel(widget, ascii) {
  if (typeof widget?.label !== "string") {
    return undefined;
  }
  return clipText(stripControl(widget.label).trim(), LABEL_MAX, ascii);
}

// A widget's own "icon": "" means none; one wider than ICON_MAX columns is
// ignored, like any other invalid value.
function customIcon(widget) {
  if (typeof widget?.icon !== "string") {
    return undefined;
  }
  const icon = stripControl(widget.icon).trim();
  return visibleWidth(icon) <= ICON_MAX ? icon : undefined;
}

// The text before a widget's value: "🔄 Reset: ", "Reset: ", or nothing for
// raw widgets. icon overrides the table's for state icons (idle agent,
// sandbox with network); the user's own label and icon win over both.
function widgetTag(
  id,
  { emojis = true, raw = false, icon, widget, ascii = false, lang = DEFAULT_LANGUAGE } = {}
) {
  const tag = WIDGET_TAGS[id];
  if (raw || !tag) {
    return "";
  }
  const label = customLabel(widget, ascii);
  const name = label ?? (tag.key ? t(tag.key, lang) : tag.name);
  const named = name ? `${name}: ` : "";
  if (!emojis) {
    return named;
  }
  const shown = customIcon(widget) ?? icon ?? tag.icon;
  // Icon-only widgets hide their built-in name, never one the user chose.
  const after = tag.iconOnly && label === undefined ? "" : named;
  return shown ? `${shown} ${after}` : after;
}

// Meter styles: [filled, empty] glyphs, and a pace marker for a style that
// has its own. cells has none: Pills draws it with background colors. Every
// glyph is one column wide for visibleWidth(); a two-column glyph would
// overflow the meter and throw fitting off.
const METER_STYLES = {
  pips: ["•", "•", "●"],
  cells: null,
  dots: ["●", "●"],
  blocks: ["█", "░"],
  shade: ["▓", "░"],
  line: ["━", "─"],
  geometric: ["▰", "▱"],
  squares: ["■", "□"],
  braille: ["⣿", "⣀"],
  bars: ["▮", "▯"],
  rings: ["●", "○"],
  ramp: ["█", "░"],
};
const METER_STYLE_IDS = Object.keys(METER_STYLES);

function isMeterStyle(value) {
  return typeof value === "string" && Object.hasOwn(METER_STYLES, value);
}

// The widget's "meter", else the global "meterStyle", else the layout's own;
// cells exists only in Pills, so the text layouts draw their own instead.
const OWN_METER = { pills: "pips", lines: "dots", classic: "blocks" };

function meterStyle(widget, config, layout) {
  const own = OWN_METER[layout] ?? OWN_METER.pills;
  const id = [widget?.meter, config?.meterStyle].find(isMeterStyle) ?? own;
  return id === "cells" && layout !== "pills" ? own : id;
}

// Longest conversation title shown, in terminal columns.
const TITLE_MAX = 30;

// Longest subagent name and role the tasks widget shows, in terminal columns.
const SUBAGENT_NAME_MAX = 16;
const SUBAGENT_ROLE_MAX = 30;

// What the tasks widget says about a lone running subagent, or "" to show the
// count: when the row is fitted to a narrow terminal (compact), the count is
// the short form.
function subagentDetail(session, widget, ascii) {
  return widget?.compact
    ? ""
    : formatSubagent(session.subagent, SUBAGENT_NAME_MAX, SUBAGENT_ROLE_MAX, ascii);
}

// RAM use (%) that turns the ram widget to the caution, then danger color.
const RAM_CAUTION = 80;
const RAM_DANGER = 90;

function isVisibilityThreshold(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isValidCompactionLimit(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// Resolves effective context size, percentage and 200K flag for a context widget.
// An active compactionLimit (< contextSize) scales percentage/thresholds and
// supersedes the fixed exceeds_200k_tokens heuristic.
function resolveContextView(widget, session) {
  const contextSize = session?.contextSize ?? 0;
  const usedTokens = session?.usedTokens ?? 0;
  const limit = widget?.compactionLimit;

  if (contextSize > 0 && isValidCompactionLimit(limit) && limit < contextSize) {
    return {
      size: limit,
      pct: Math.min(100, Math.max(0, (usedTokens * 100) / limit)),
      exceeds200k: false,
    };
  }

  return {
    size: contextSize,
    pct: session?.contextPct ?? 0,
    exceeds200k: Boolean(session?.exceeds200k),
  };
}

// Resolves display percentage, suffix word ("rem" or "used"), and meter
// direction from quotaMode while keeping remaining % for warning thresholds.
function resolveQuotaView(quota, config, lang) {
  const remaining = Math.max(0, Math.min(100, Number(quota?.remaining) || 0));
  const used = Math.max(0, Math.min(100, 100 - remaining));
  const isRemaining = config?.quotaMode !== "used";
  const pct = isRemaining ? remaining : used;
  const word = t(isRemaining ? "rem" : "used", lang);
  return {
    remaining,
    used,
    pct,
    isRemaining,
    text: `${pct.toFixed(1)}% ${word}`,
  };
}

// Invalid hand-edited values behave like unset options, leaving the widget
// visible as it was before per-widget visibility thresholds existed.
function hiddenByThreshold(id, widget, session) {
  const quotaKey = Object.hasOwn(SHOW_BELOW_SESSION_KEYS, id) ? SHOW_BELOW_SESSION_KEYS[id] : null;
  if (quotaKey && isVisibilityThreshold(widget?.showBelow)) {
    const remaining = session?.[quotaKey]?.remaining;
    return (
      typeof remaining === "number" && Number.isFinite(remaining) && remaining > widget.showBelow
    );
  }

  // Past 200k tokens the context widgets are in danger (unless superseded by a
  // widget's own compactionLimit): they show whatever the percentage says.
  if (CONTEXT_WIDGETS.has(id) && isVisibilityThreshold(widget?.showAbove)) {
    const { pct, exceeds200k } = resolveContextView(widget, session);
    return (
      session?.hasContext === true &&
      !exceeds200k &&
      typeof pct === "number" &&
      Number.isFinite(pct) &&
      pct < widget.showAbove
    );
  }

  return false;
}

// Widgets with no data to show hide instead of drawing zeros: no context
// window in the payload is not "0/0", no usage is not "0% cache hit".
function hasNoData(id, session) {
  return (
    (CONTEXT_WIDGETS.has(id) && !session.hasContext) || (USAGE_WIDGETS.has(id) && !session.hasUsage)
  );
}

module.exports = {
  NAMED_COLORS,
  STATE_SLOTS,
  resolveColor,
  widgetColors,
  OS_ICONS,
  WIDGET_TAGS,
  widgetTag,
  LABEL_MAX,
  isRaw,
  isPaced,
  showsPaceDelta,
  showsForecast,
  METER_STYLES,
  METER_STYLE_IDS,
  isMeterStyle,
  meterStyle,
  QUOTA_WIDGETS,
  PACE_DELTA_WIDGETS,
  CONTEXT_WIDGETS,
  RESET_WIDGETS,
  isVisibilityThreshold,
  isValidCompactionLimit,
  resolveContextView,
  resolveQuotaView,
  hiddenByThreshold,
  hasNoData,
  RAM_CAUTION,
  RAM_DANGER,
  TITLE_MAX,
  subagentDetail,
  readEnvValue,
};
