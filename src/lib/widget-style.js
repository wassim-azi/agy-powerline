"use strict";

const { parseColor } = require("./colors");

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
// read the same. iconOnly: with emojis on, the icon stands in for the label
// (a meter or the model name already says what it is).
const WIDGET_TAGS = {
  model: { icon: "🤖", name: "Model", iconOnly: true },
  quota: { icon: "⏳", name: "Quota" },
  fiveHourBar: { icon: "⏳", name: "5h", iconOnly: true },
  fiveHourPct: { icon: "⏳", name: "5h" },
  fiveHourReset: { icon: "🔄", name: "Reset" },
  weeklyBar: { icon: "📅", name: "7d", iconOnly: true },
  weeklyPct: { icon: "📅", name: "7d" },
  weeklyReset: { icon: "🔄", name: "Reset" },
  thirdPartyFiveHour: { icon: "🧪", name: "3P 5h" },
  thirdPartyWeekly: { icon: "🧪", name: "3P 7d" },
  argonWeekly: { icon: "🔮", name: "Argon 7d" },
  argonReset: { icon: "🔄", name: "Argon reset" },
  context: { icon: "💾", name: "Context", iconOnly: true },
  contextPct: { icon: "💾", name: "Context" },
  contextTokens: { icon: "💾", name: "Context" },
  cwd: { icon: "📂", name: "Dir" },
  project: { icon: "📦", name: "Project" },
  git: { icon: "🌿", name: "" },
  gitChanges: { icon: "📝", name: "Lines" },
  gitFiles: { icon: "📄", name: "Files" },
  gitSha: { icon: "📌", name: "Commit" },
  gitStash: { icon: "💼", name: "Stash" },
  gitWorktree: { icon: "🌳", name: "Worktree" },
  plan: { icon: "⭐", name: "Plan" },
  agentState: { icon: "🟣", name: "Agent" },
  artifacts: { icon: "📎", name: "Artifacts" },
  tasks: { icon: "👥", name: "" },
  mode: { icon: "🧭", name: "" },
  title: { icon: "💬", name: "" },
  ram: { icon: "💻", name: "RAM" },
  version: { icon: "🔖", name: "" },
  sandbox: { icon: "🔒", name: "" },
  cacheRead: { icon: "📥", name: "Cache read" },
  cacheCreate: { icon: "📤", name: "Cache create" },
  cacheHit: { icon: "⚡", name: "Cache hit" },
  totalTokens: { icon: "🪙", name: "Tokens" },
  customText: { icon: "🏷️", name: "" },
};

// The text before a widget's value: "🔄 Reset: ", "Reset: ", or nothing for
// raw widgets. icon overrides the table's for state icons (idle agent,
// sandbox with network).
function widgetTag(id, { emojis = true, raw = false, icon } = {}) {
  const tag = WIDGET_TAGS[id];
  if (raw || !tag) {
    return "";
  }
  const named = tag.name ? `${tag.name}: ` : "";
  if (!emojis) {
    return named;
  }
  return `${icon ?? tag.icon} ${tag.iconOnly ? "" : named}`;
}

// Longest conversation title shown, in terminal columns.
const TITLE_MAX = 30;

// RAM use (%) that turns the ram widget to the caution, then danger color.
const RAM_CAUTION = 80;
const RAM_DANGER = 90;

const CONTEXT_WIDGETS = new Set(["context", "contextPct", "contextTokens"]);
const USAGE_WIDGETS = new Set(["cacheRead", "cacheCreate", "cacheHit"]);

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
  WIDGET_TAGS,
  widgetTag,
  isRaw,
  isPaced,
  hasNoData,
  RAM_CAUTION,
  RAM_DANGER,
  TITLE_MAX,
};
