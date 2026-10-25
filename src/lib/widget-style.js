// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { parseColor } = require("./colors");
const { clipText, stripControl, visibleWidth } = require("./formatters");
const { DEFAULT_LANGUAGE, t } = require("./i18n");

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

// Each widget's icon and label, shared by both layouts so Pills and Lines
// read the same. name is the English label (configure shows it), key its
// message in i18n.js. iconOnly: with emojis on, the icon stands in for the label
// (a meter or the model name already says what it is).
const WIDGET_TAGS = {
  model: { icon: "🤖", name: "Model", key: "tag_model", iconOnly: true },
  quota: { icon: "⏳", name: "Quota", key: "tag_quota" },
  fiveHourBar: { icon: "⏳", name: "5h", key: "tag_5h", iconOnly: true },
  fiveHourPct: { icon: "⏳", name: "5h", key: "tag_5h" },
  fiveHourReset: { icon: "🔄", name: "Reset", key: "tag_reset" },
  weeklyBar: { icon: "📅", name: "7d", key: "tag_7d", iconOnly: true },
  weeklyPct: { icon: "📅", name: "7d", key: "tag_7d" },
  weeklyReset: { icon: "🔄", name: "Reset", key: "tag_reset" },
  thirdPartyFiveHour: { icon: "🧪", name: "3P 5h", key: "tag_3p_5h" },
  thirdPartyWeekly: { icon: "🧪", name: "3P 7d", key: "tag_3p_7d" },
  argonWeekly: { icon: "🔮", name: "Argon 7d", key: "tag_argon_7d" },
  argonReset: { icon: "🔄", name: "Argon reset", key: "tag_argon_reset" },
  context: { icon: "💾", name: "Context", key: "tag_context", iconOnly: true },
  contextPct: { icon: "💾", name: "Context", key: "tag_context" },
  contextTokens: { icon: "💾", name: "Context", key: "tag_context" },
  cwd: { icon: "📂", name: "Dir", key: "tag_dir" },
  project: { icon: "📦", name: "Project", key: "tag_project" },
  os: { icon: "💻", name: "" },
  host: { icon: "👤", name: "Host", key: "tag_host", iconOnly: true },
  git: { icon: "🌿", name: "" },
  gitChanges: { icon: "📝", name: "Lines", key: "tag_lines" },
  gitFiles: { icon: "📄", name: "Files", key: "tag_files" },
  gitSha: { icon: "📌", name: "Commit", key: "tag_commit" },
  gitStash: { icon: "💼", name: "Stash", key: "tag_stash" },
  gitWorktree: { icon: "🌳", name: "Worktree", key: "tag_worktree" },
  plan: { icon: "⭐", name: "Plan", key: "tag_plan" },
  agentState: { icon: "🟣", name: "Agent", key: "tag_agent" },
  artifacts: { icon: "📎", name: "Artifacts", key: "tag_artifacts" },
  tasks: { icon: "👥", name: "" },
  mode: { icon: "🧭", name: "" },
  title: { icon: "💬", name: "" },
  sessionTime: { icon: "⏱️", name: "Session", key: "tag_session" },
  ram: { icon: "💻", name: "RAM", key: "tag_ram" },
  version: { icon: "🔖", name: "" },
  sandbox: { icon: "🔒", name: "" },
  cacheRead: { icon: "📥", name: "Cache read", key: "tag_cache_read" },
  cacheCreate: { icon: "📤", name: "Cache create", key: "tag_cache_create" },
  cacheHit: { icon: "⚡", name: "Cache hit", key: "tag_cache_hit" },
  totalTokens: { icon: "🪙", name: "Tokens", key: "tag_tokens" },
  clock: { icon: "🕒", name: "Clock", key: "tag_clock", iconOnly: true },
  tokensToday: { icon: "📈", name: "Today", key: "tag_today" },
  tokensWeek: { icon: "📊", name: "7d", key: "tag_7d" },
  customText: { icon: "🏷️", name: "" },
};

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

// RAM use (%) that turns the ram widget to the caution, then danger color.
const RAM_CAUTION = 80;
const RAM_DANGER = 90;

// Widgets whose visibility follows quota or context use the normalized
// session fields below. Reset widgets follow their own quota window.
const QUOTA_WIDGETS = new Set([
  "quota",
  "fiveHourBar",
  "fiveHourPct",
  "weeklyBar",
  "weeklyPct",
  "thirdPartyFiveHour",
  "thirdPartyWeekly",
  "argonWeekly",
]);
const CONTEXT_WIDGETS = new Set(["context", "contextPct", "contextTokens"]);
const RESET_WIDGETS = new Set(["fiveHourReset", "weeklyReset", "argonReset"]);
const SHOW_BELOW_SESSION_KEYS = {
  quota: "tightestQuota",
  fiveHourBar: "fiveHour",
  fiveHourPct: "fiveHour",
  fiveHourReset: "fiveHour",
  weeklyBar: "weekly",
  weeklyPct: "weekly",
  weeklyReset: "weekly",
  thirdPartyFiveHour: "thirdPartyFiveHour",
  thirdPartyWeekly: "thirdPartyWeekly",
  argonWeekly: "argonWeekly",
  argonReset: "argonWeekly",
};
const USAGE_WIDGETS = new Set(["cacheRead", "cacheCreate", "cacheHit"]);

function isVisibilityThreshold(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
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

  // Past 200k tokens the context widgets are in danger: they show whatever
  // the percentage says.
  if (CONTEXT_WIDGETS.has(id) && isVisibilityThreshold(widget?.showAbove)) {
    const used = session?.contextPct;
    return (
      session?.hasContext === true &&
      !session?.exceeds200k &&
      typeof used === "number" &&
      Number.isFinite(used) &&
      used < widget.showAbove
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
  METER_STYLES,
  METER_STYLE_IDS,
  isMeterStyle,
  meterStyle,
  QUOTA_WIDGETS,
  CONTEXT_WIDGETS,
  RESET_WIDGETS,
  isVisibilityThreshold,
  hiddenByThreshold,
  hasNoData,
  RAM_CAUTION,
  RAM_DANGER,
  TITLE_MAX,
};
