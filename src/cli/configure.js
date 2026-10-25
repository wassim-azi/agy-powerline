// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const readline = require("readline");
const { spawn } = require("child_process");
const {
  InvalidConfigError,
  saveConfig,
  setConfigDir,
  getConfigPath,
  WIDGET_CATALOG,
  THEMES,
  THEME_ORDER,
  LAYOUTS,
  LAYOUT_ORDER,
  widgetLabel,
  renderStatusline,
  sampleData,
  defaultConfig,
  mergeConfig,
  themeColors,
  PRESETS,
  PRESET_ORDER,
  applyPreset,
} = require("../lib/shared");
const { resolveInstallDir } = require("../lib/paths");
const { WIDGET_TAGS } = require("../lib/widget-style");
const { SUPPORTED_LANGUAGES, resolveLanguage } = require("../lib/i18n");
const { editFields: getEditFields, stepNumberField } = require("../lib/widget-options");
const { loadEditableConfig } = require("./config-guard");
const {
  parseColor,
  fg,
  setActiveDepth,
  getActiveDepth,
  resolveColorDepth,
} = require("../lib/colors");
const { makeUi, wrapText } = require("./tui-style");
const { visibleWidth, stripControl } = require("../lib/formatters");
const {
  STYLES,
  STYLE_ORDER,
  SLOT_PRESETS,
  INVERTED_BY_DEFAULT,
  MAX_GLYPHS,
  normalizePowerline,
  applyStyle,
  detectStyle,
  parseGlyph,
  glyphChar,
  glyphName,
} = require("../lib/powerline");

const { REPO_URL } = require("./repo-url");

const CSI = "\x1b[";
const RESET = `${CSI}0m`;
const BOLD = `${CSI}1m`;
const HIDE = `${CSI}?25l`;
const SHOW = `${CSI}?25h`;
const ALT_ON = `${CSI}?1049h`;
const ALT_OFF = `${CSI}?1049l`;
const HOME_CLEAR = `${CSI}H${CSI}J`;

const { version: VERSION } = require("../../package.json");

const CUSTOM_COLOR_SLOTS = [
  { key: "model", label: "Model" },
  { key: "fiveHour", label: "5h Quota" },
  { key: "weekly", label: "7d Quota" },
  { key: "context", label: "Context Window" },
  { key: "git", label: "VCS Git" },
  { key: "meta", label: "Metadata & Details" },
  { key: "caution", label: "Caution (getting low)" },
  { key: "warn", label: "Danger (critical)" },
];

const CURATED_HEX_PALETTE = [
  "#bd93f9", // Purple
  "#50fa7b", // Green
  "#ffb86c", // Orange
  "#ff79c6", // Pink
  "#f1fa8c", // Yellow
  "#ff5555", // Red
  "#8be9fd", // Cyan
  "#f8f8f2", // White
  "#6272a4", // Slate
  "#e06c75", // Coral
  "#98c379", // Mint
  "#61afef", // Sky
];

// Rows of the Powerline screen; rows with a slot open the glyph editor.
const POWERLINE_ROWS = [
  { id: "enabled", label: "Join adjacent widgets" },
  { id: "rowGap", label: "Space between rows" },
  { id: "style", label: "Style" },
  { id: "separators", label: "Separators", slot: "separator" },
  { id: "startCaps", label: "Start caps", slot: "startCap" },
  { id: "endCaps", label: "End caps", slot: "endCap" },
  { id: "theme", label: "Themes" },
];

const GLYPH_SLOTS = {
  separator: { key: "separators", title: "Separators" },
  startCap: { key: "startCaps", title: "Start caps" },
  endCap: { key: "endCaps", title: "End caps" },
};

function configureCommand() {
  setConfigDir(resolveInstallDir());
  runTui();
}

let config;
let screen = "main";
let cursor = 0;
let previewData;
let exiting = false;
let flashMessage = "";
let searchQuery = "";
let glyphSlot = "separator";
// null while browsing the glyph list; a string while typing a code point.
let hexInput = null;
// The widget being edited (its index in the list), and the text being typed
// into one of its fields (null when not typing).
let editIndex = 0;
let textInput = null;

function openUrl(url) {
  const target = String(url || "").trim();
  if (!target) {
    return;
  }

  // Only http(s) URLs, passed as a single argument with no shell involved.
  if (!/^https?:\/\//i.test(target)) {
    return;
  }

  let file = "xdg-open";
  if (process.platform === "win32") {
    file = "explorer.exe";
  } else if (process.platform === "darwin") {
    file = "open";
  }

  try {
    const child = spawn(file, [target], { stdio: "ignore", detached: true, windowsHide: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Graceful fallback
  }
}

function openRepo() {
  openUrl(REPO_URL);
  flashMessage = "⭐ Opened repo in browser";
}

function usedIds() {
  return new Set(
    config.widgets
      .filter((widget) => widget.id !== "separator" && widget.id !== "lineBreak")
      .map((widget) => widget.id)
  );
}

function addableWidgets() {
  const used = usedIds();

  return WIDGET_CATALOG.filter((widget) => !widget.unique || !used.has(widget.id));
}

function filteredAddableWidgets() {
  const items = addableWidgets();
  if (!searchQuery.trim()) {
    return items;
  }
  const q = searchQuery.toLowerCase().trim();
  return items.filter(
    (w) =>
      w.label.toLowerCase().includes(q) ||
      w.id.toLowerCase().includes(q) ||
      (w.description && w.description.toLowerCase().includes(q))
  );
}

function clampCursor(length) {
  if (length <= 0) {
    cursor = 0;
    return;
  }

  cursor = Math.max(0, Math.min(cursor, length - 1));
}

function wrapCursor(current, delta, length) {
  if (length <= 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(current, length - 1));
  return (((clamped + delta) % length) + length) % length;
}

function moveCursor(delta, length) {
  cursor = wrapCursor(cursor, delta, length);
}

// The file can break while the TUI is open (edited by hand); keep the TUI
// running and say why changes stop being saved instead of crashing.
function persist() {
  try {
    saveConfig(config);
    return true;
  } catch (error) {
    if (!(error instanceof InvalidConfigError)) {
      throw error;
    }
    flashMessage = `⚠ Not saved: ${error.file} is no longer valid JSON. Fix it or delete it.`;
    return false;
  }
}

function moveItem(offset) {
  const next = cursor + offset;

  if (next < 0 || next >= config.widgets.length) {
    return;
  }

  const items = config.widgets;
  const current = items[cursor];
  items[cursor] = items[next];
  items[next] = current;
  cursor = next;
  persist();
}

function removeItem() {
  if (!config.widgets.length) {
    return;
  }

  config.widgets.splice(cursor, 1);
  clampCursor(config.widgets.length);
  persist();
}

function addItem(id) {
  let widget = { id };
  if (id === "customText") {
    widget = { id, text: "Custom" };
  } else if (id === "exec") {
    widget = { id, cmd: "git stash list | wc -l" };
    flashMessage = `⚠ Shell Command runs "${widget.cmd}" on every refresh. Edit "cmd" in ${getConfigPath()}`;
  }

  if (!config.widgets.length) {
    config.widgets.push(widget);
    cursor = 0;
  } else {
    config.widgets.splice(cursor + 1, 0, widget);
    cursor += 1;
  }

  persist();
}

function insertSeparator() {
  addItem("separator");
}

function insertLineBreak() {
  addItem("lineBreak");
}

const TABS = [
  { id: "main", label: "Widgets", key: "w" },
  { id: "presets", label: "Presets", key: "o" },
  { id: "themes", label: "Themes", key: "t" },
  { id: "layout", label: "Layout", key: "l" },
  { id: "powerline", label: "Powerline", key: "p" },
];

const TAB_OF_SCREEN = {
  main: "main",
  add: "main",
  edit: "main",
  presets: "presets",
  themes: "themes",
  customTheme: "themes",
  layout: "layout",
  powerline: "powerline",
  glyphs: "powerline",
};

const PRESET_ICONS = {
  default: "🎯",
  compact: "⚡",
  agent: "🧠",
  git: "🔀",
  tokens: "📊",
  quotas: "🔋",
  full: "🚀",
};

// Set by renderFrame so tests can draw a screen at a fixed size.
let columnsOverride = null;
let rowsOverride = null;
let ui;

// Window sizes where the editor changes shape: from MEDIUM columns the
// descriptions line up in a column; from WIDE the list gets a details panel
// next to it.
const MEDIUM = 80;
const WIDE = 140;
// A list taller than the window scrolls, but keeps at least this many rows
// before the editor gives up its spacing and the preview's toggles.
const MIN_LIST_ROWS = 6;
// What a short window gives up, one step at a time, so the list keeps rows.
const COMPACT_STEPS = [
  { tagline: true, gaps: true, notes: true, chips: true },
  { tagline: false, gaps: true, notes: true, chips: true },
  { tagline: false, gaps: false, notes: true, chips: true },
  { tagline: false, gaps: false, notes: false, chips: true },
  { tagline: false, gaps: false, notes: false, chips: false },
];

// First visible row of a scrolled list, kept between frames so the list only
// moves when the cursor leaves the window.
let scrollTop = 0;
let scrollScreen = null;

// The editor fills the window, so the live preview has the room the real bar
// gets in agy.
function frameWidth() {
  const columns = columnsOverride || process.stdout.columns || 100;
  return Math.max(50, columns - 1);
}

function frameHeight() {
  return Math.max(12, rowsOverride || process.stdout.rows || 40);
}

function previewConfig() {
  if (screen === "themes") {
    const hovered = THEME_ORDER[cursor];
    return hovered ? { ...config, theme: hovered } : config;
  }

  if (screen === "customTheme") {
    return { ...config, theme: "custom" };
  }

  if (screen === "presets") {
    const hovered = PRESET_ORDER[cursor];
    return hovered ? applyPreset(config, hovered) : config;
  }

  if (screen === "layout") {
    const hovered = LAYOUT_ORDER[cursor];
    return hovered ? { ...config, layout: hovered } : config;
  }

  return config;
}

// Secondary text in the theme's readable gray (see tui-style.js).
function dim(text) {
  return ui.muted(text);
}

// What the preview shows that isn't applied yet: the hovered theme, preset
// or layout. Empty when the preview is the saved setup.
function previewPending() {
  if (screen === "themes") {
    const hovered = THEME_ORDER[cursor];
    return hovered && hovered !== config.theme ? "theme" : "";
  }
  if (screen === "presets") {
    const hovered = PRESET_ORDER[cursor];
    return hovered && hovered !== currentPreset() ? "preset" : "";
  }
  if (screen === "layout") {
    const hovered = LAYOUT_ORDER[cursor];
    return hovered && hovered !== config.layout ? "layout" : "";
  }
  return "";
}

// The preset whose widgets are exactly the current ones, if any.
function currentPreset() {
  const mine = JSON.stringify(config.widgets);
  return PRESET_ORDER.find((id) => JSON.stringify(applyPreset(config, id).widgets) === mine);
}

// The bar's rows and the toggle chips under them.
function previewParts(width) {
  const preview = previewConfig();
  const { dot } = ui.glyph;
  previewData.terminal_width = width - 4;
  let rendered;

  try {
    rendered = renderStatusline(previewData, preview, { color: getActiveDepth() });
  } catch (error) {
    rendered = `Preview failed: ${error.message}`;
  }

  const layout = LAYOUTS[preview.layout]?.name ?? preview.layout;
  const style =
    preview.layout === "pills" ? ` ${dot} ${detectStyle(preview.powerline) ?? "custom"}` : "";
  const pending = previewPending();
  const note = pending ? ` ${ui.accentText(`${dot} ${pending} preview, enter to apply`)}` : "";
  const title = `Live preview ${dim(`${dot} ${layout} ${dot} ${preview.theme}${style}`)}${note}`;
  // The toggle keys work on the widget list, so only that screen names them.
  const key = (letter) => (screen === "main" ? letter : "");
  const chips = [
    ui.chip("gaps", preview.rowGap, key("v")),
    ui.chip("emojis", preview.emojis, key("e")),
    ui.chip("minimal", preview.minimalist, key("m")),
    ui.chip("pace", preview.pacing, key("r")),
    ui.chip("blink", Boolean(preview.thresholds?.blink), key("b")),
    ui.chip("ascii", preview.ascii, key("i")),
  ];
  if (preview.layout === "pills") {
    chips.unshift(ui.chip("joins", preview.powerline.enabled, key("j")));
  }
  // Only worth a chip once there is a language to switch to.
  if (SUPPORTED_LANGUAGES.length > 1) {
    chips.push(ui.chip(`lang ${resolveLanguage(preview.language)}`, true, key("u")));
  }

  return { title, bar: String(rendered).split("\n"), chips: chips.join("   ") };
}

// Keeps the cursor's row inside a window of `space` rows; returns the slice
// of the list to show.
function windowRows(count, selected, space) {
  if (scrollScreen !== screen) {
    scrollScreen = screen;
    scrollTop = 0;
  }
  if (count <= space) {
    scrollTop = 0;
    return { start: 0, end: count };
  }
  if (selected >= 0) {
    if (selected < scrollTop) {
      scrollTop = selected;
    } else if (selected >= scrollTop + space) {
      scrollTop = selected - space + 1;
    }
  }
  scrollTop = Math.max(0, Math.min(scrollTop, count - space));
  return { start: scrollTop, end: scrollTop + space };
}

// List items are { text, extra, value, number } or a plain line: extra is a
// description, value a setting's current value. From MEDIUM columns they
// line up in one column.
function listRows(items, selected, rowWidth) {
  const shown = (item) => item.value ?? item.extra ?? "";
  const entries = items.filter((item) => typeof item !== "string");
  const labels = entries.filter((item) => shown(item));
  // A badge follows its label, so it counts toward the label's width.
  const labelWidth = (item) =>
    visibleWidth(item.text) + (item.badge ? 1 + visibleWidth(item.badge) : 0);
  const widest = Math.max(0, ...labels.map(labelWidth));
  const pad = frameWidth() >= MEDIUM ? Math.min(widest, Math.floor(rowWidth * 0.45)) : 0;
  const leadWidth = Math.max(0, ...entries.map((item) => visibleWidth(item.lead ?? "")));
  const lead = (item) =>
    leadWidth ? (item.lead ?? "") + " ".repeat(leadWidth - visibleWidth(item.lead ?? "")) : "";
  return items.map((item, index) =>
    typeof item === "string"
      ? item
      : ui.row(index === selected, item.text, shown(item), item.number ?? null, {
          pad,
          lead: lead(item),
          badge: item.badge,
        })
  );
}

// A widget's icon from the bar, when the bar shows icons.
function widgetIcon(id) {
  return config.emojis !== false && !config.ascii ? (WIDGET_TAGS[id]?.icon ?? "") : "";
}

// On a wide window the list and the details panel share the width evenly.
function splitWidths(width) {
  const list = Math.floor((width - 1) / 2);
  return { list, details: width - 1 - list };
}

// Details entries are plain strings (wrapped to the panel), { dim: text }
// (wrapped, in the muted color) or { raw: line } (as is: a rendered widget,
// a heading, a row of tags).
function detailsBody(lines, panelWidth) {
  const wrapWidth = Math.min(panelWidth - 4, 88);
  return lines.flatMap((entry) => {
    if (typeof entry === "string") {
      return wrapText(entry, wrapWidth);
    }
    if ("raw" in entry) {
      return [entry.raw];
    }
    return wrapText(entry.dim, wrapWidth).map((line) => dim(line));
  });
}

// Top lines, then blank lines, then bottom lines, in exactly `tall` rows;
// when both don't fit, the top wins.
function anchor(top, bottom, tall) {
  const free = tall - top.length - bottom.length;
  if (free < 0) {
    return [...top, ...bottom].slice(0, tall);
  }
  return [...top, ...Array(free).fill(""), ...bottom];
}

// Every screen: brand line and tabs, the screen's list (with a details panel
// beside it on a wide window, both as tall as the longer one, notes at the
// bottom), the live preview and the keys. Panels fit their content rather
// than the window, so a tall window doesn't get rows of empty boxes. A short
// window gives up blank lines, the tagline, the notes and the preview's
// toggles before the list starts to scroll.
function screenFrame({ title, head = [], items, selected = cursor, notes = [], keys, details }) {
  const width = frameWidth();
  const height = frameHeight();
  const wide = Boolean(details) && width >= WIDE;
  const widths = wide ? splitWidths(width) : { list: width, details: 0 };
  const preview = previewParts(width);
  const hints = ui.hints(keys, width - 1);
  const notesWidth = wide ? widths.details : widths.list;
  const noteLines = (step) =>
    step.notes && notes.length
      ? [
          "",
          ...detailsBody(
            notes.map((n) => ({ dim: n })),
            notesWidth
          ),
        ]
      : [];
  const detailLines = wide ? detailsBody(details.lines, widths.details) : [];

  // Rows left for the list panel's body once everything else is drawn: the
  // brand and tabs, both panels' borders, the preview and the key hints.
  const bodySpace = (step) =>
    height -
    1 -
    (step.gaps ? 3 : 0) -
    (step.tagline ? 1 : 0) -
    2 -
    2 -
    (2 + preview.bar.length + (step.chips ? 2 : 0)) -
    hints.length;
  const listSpace = (step) => bodySpace(step) - head.length - (wide ? 0 : noteLines(step).length);
  const fits = (step) =>
    listSpace(step) >= items.length &&
    (!wide || detailLines.length + noteLines(step).length <= bodySpace(step));
  const step =
    COMPACT_STEPS.find(fits) ||
    COMPACT_STEPS.find((s) => listSpace(s) >= MIN_LIST_ROWS) ||
    COMPACT_STEPS[COMPACT_STEPS.length - 1];

  const content = Math.max(
    head.length + items.length + (wide ? 0 : noteLines(step).length),
    wide ? detailLines.length + noteLines(step).length : 0
  );
  const tall = Math.max(1, Math.min(content, bodySpace(step)));
  const { start, end } = windowRows(items.length, selected, Math.max(1, listSpace(step)));
  const rows = listRows(items, selected, widths.list - 4).slice(start, end);
  const { up, down } = ui.glyph;
  const counts = {
    above: start > 0 ? `${up} ${start} more` : "",
    below: end < items.length ? `${down} ${items.length - end} more` : "",
  };

  const body = wide
    ? ui.beside(
        ui.panel(title, anchor([...head, ...rows], [], tall), widths.list, counts),
        ui.panel(details.title, anchor(detailLines, noteLines(step), tall), widths.details)
      )
    : ui.panel(title, anchor([...head, ...rows], noteLines(step), tall), width, counts);

  // The star link sits at the right end of the brand line, shortened to the
  // star alone when the line is tight.
  const link = (text) => `\x1b]8;;${REPO_URL}\x07${text}\x1b]8;;\x07`;
  const star = link(`${ui.glyph.star} ${dim("Star on GitHub")}`);
  const starShort = link(ui.glyph.star);
  const toast = flashMessage ? `   ${ui.toast(flashMessage)}` : "";
  const brand = ` ${ui.wordmark("agy-powerline")} ${ui.tag(`v${VERSION}`)}${toast}`;
  const gap = step.gaps ? [""] : [];

  return [
    ...gap,
    ui.spread(brand, star) ?? ui.spread(brand, starShort) ?? `${brand}  ${starShort}`,
    ...(step.tagline ? [` ${dim(`${ui.glyph.sparkle} Make agy feel like yours`)}`] : []),
    ...(step.gaps ? [ui.rule()] : []),
    ui.tabs(TABS, TAB_OF_SCREEN[screen]),
    ...gap,
    ...body,
    ...ui.panel(preview.title, [...preview.bar, ...(step.chips ? ["", preview.chips] : [])], width),
    ...hints,
  ];
}

// One widget drawn on its own with the previewed theme and layout, for the
// details panel; a widget with nothing to show in the sample data says so.
function widgetPreview(widget) {
  const width = splitWidths(frameWidth()).details - 4;
  let rendered = "";
  try {
    rendered = renderStatusline(
      { ...previewData, terminal_width: width },
      { ...previewConfig(), widgets: [widget] },
      { color: getActiveDepth() }
    );
  } catch {
    // The full preview below reports render errors.
  }
  const lines = String(rendered).split("\n");
  if (lines.every((line) => !line.replace(/\x1b\[[0-9;]*m/g, "").trim())) {
    return [{ dim: "Hidden in this preview: the sample data has nothing for it." }];
  }
  return lines.map((line) => ({ raw: line }));
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const EXEC_NOTE = {
  dim: "Runs only in agy, from your install folder; previews here show [cmd].",
};

const heading = (text) => ({ raw: ui.heading(text) });

function presetsUsing(id) {
  const names = PRESET_ORDER.filter((name) =>
    PRESETS[name].widgets.some((widget) => widget.id === id)
  ).map((name) => PRESETS[name].name);
  return [
    heading("In presets"),
    names.length ? { raw: names.map(ui.tag).join(" ") } : { dim: "none" },
  ];
}

// A widget's own settings from the config file, cleaned of control
// characters before they reach the terminal.
function widgetOptions(widget) {
  return Object.entries(widget)
    .filter(([key]) => key !== "id")
    .map(([key, value]) => ({
      raw: `${dim(key)}  ${stripControl(typeof value === "string" ? value : JSON.stringify(value))}`,
    }));
}

function widgetDetails(widget) {
  if (!widget) {
    return { title: "No widgets", lines: ["Press a to add your first widget."] };
  }
  if (widget.id === "separator") {
    return {
      title: "Flex space",
      lines: [
        "Grows to fill the free space in its row, pushing the widgets after it to the right. In Pills it also starts a new pill.",
      ],
    };
  }
  if (widget.id === "lineBreak") {
    return {
      title: "New row",
      lines: ["Starts a new row: the widgets after it go on the next line of the bar."],
    };
  }

  const meta = WIDGET_CATALOG.find((item) => item.id === widget.id);
  const options = widgetOptions(widget);
  return {
    title: [widgetIcon(widget.id), widgetLabel(widget.id)].filter(Boolean).join(" "),
    lines: [
      `${capitalize(meta?.description ?? widget.id)}.`,
      "",
      heading("Preview"),
      ...widgetPreview(widget),
      "",
      heading("Options"),
      ...(options.length
        ? options
        : [{ dim: "Defaults. Colors, labels and thresholds per widget: docs/configuration.md" }]),
      "",
      ...presetsUsing(widget.id),
      ...(widget.id === "exec" ? ["", EXEC_NOTE] : []),
    ],
  };
}

function widgetCount() {
  const count = config.widgets.filter((w) => w.id !== "separator" && w.id !== "lineBreak").length;
  return `${count} widget${count === 1 ? "" : "s"}`;
}

function drawMain() {
  const { upDown, shift } = ui.glyph;
  // Flex spaces and new rows are layout, not widgets: they get no number, so
  // the numbers match the widget count in the title.
  let number = 0;
  const items = config.widgets.length
    ? config.widgets.map((widget) => {
        const meta = WIDGET_CATALOG.find((item) => item.id === widget.id);
        let extra = meta?.summary ?? "";
        if (widget.id === "exec" && widget.cmd) {
          extra = `cmd: ${widget.cmd}`;
        } else if (widget.text) {
          extra = `text: ${widget.text}`;
        } else if (widget.warn != null || widget.crit != null) {
          const parts = [];
          if (widget.warn != null) parts.push(`warn ${widget.warn}%`);
          if (widget.crit != null) parts.push(`crit ${widget.crit}%`);
          if (widget.blink) parts.push("blink");
          extra = parts.join(", ");
        }
        // Layout items read as quiet dividers, not as widgets.
        if (widget.id === "separator" || widget.id === "lineBreak") {
          const divider =
            widget.id === "separator"
              ? `${config.ascii ? "..." : "╌╌"} flex space`
              : `${config.ascii ? "--" : "↵"} new row`;
          return { text: dim(divider), number: "" };
        }
        number += 1;
        return {
          lead: widgetIcon(widget.id),
          text: widgetLabel(widget.id),
          extra: stripControl(extra),
          number,
        };
      })
    : [dim(`${ui.glyph.sparkle} nothing here yet. Press a to add your first widget.`)];

  return screenFrame({
    title: `Your widgets ${dim(`${ui.glyph.dot} ${widgetCount()}`)}`,
    items,
    selected: config.widgets.length ? cursor : -1,
    details: widgetDetails(config.widgets[cursor]),
    keys: [
      [upDown, "move"],
      [`${shift}${upDown}`, "reorder"],
      ["enter", "edit"],
      ["a", "add"],
      ["s", "flex space"],
      ["n", "new row"],
      ["x", "remove"],
      ["d", "reset"],
      ["g", "star"],
      ["q", "save & quit"],
    ],
  });
}

// Longest custom badge text; the badge is meant to be a word or two.
const TEXT_MAX = 40;

function editFields(widget) {
  return getEditFields(widget, config, {
    colorName: (value) => (value === undefined ? "theme default" : colorName(value)),
    cmdHelp: `The command runs only in agy, from your install folder. Edit it in ${getConfigPath()}.`,
  });
}

// A theme slot's color name, in that color.
function colorName(slot) {
  const colors = themeColors(config.theme, config.customTheme);
  const block = config.ascii ? "#" : "■";
  return colors[slot] ? `${fg(colors[slot])}${block}${RESET} ${slot}` : String(slot);
}

function editedWidget() {
  return config.widgets[editIndex];
}

function drawEdit() {
  const widget = editedWidget();
  const fields = editFields(widget);
  const field = fields[cursor];
  const typing = textInput !== null;
  const caret = config.ascii ? "_" : "▏";
  const items = fields.map((item) => ({
    text: item.label,
    value:
      typing && item === field
        ? `${BOLD}${textInput}${RESET}${caret}`
        : stripControl(item.show(widget[item.key])),
  }));
  const label = [widgetIcon(widget.id), widgetLabel(widget.id)].filter(Boolean).join(" ");
  const changeKeys = field?.text
    ? [["enter", "type"]]
    : field?.number !== undefined
      ? [[ui.glyph.leftRight, "change"]]
      : field?.fixed
        ? []
        : [[`enter ${ui.glyph.leftRight}`, "change"]];

  return screenFrame({
    title: `Edit ${dim(`${ui.glyph.dot} ${label}`)}`,
    items,
    // A wide window shows the help in the details panel instead.
    notes: field && frameWidth() < WIDE ? [field.help] : [],
    details: field && {
      title: field.label,
      lines: [field.help, "", heading("Preview"), ...widgetPreview(widget)],
    },
    keys: typing
      ? [
          ["type", "text"],
          ["enter", "keep"],
          ["esc", "cancel"],
        ]
      : [
          [ui.glyph.upDown, "option"],
          ...changeKeys,
          ...(field?.fixed ? [] : [["x", "default"]]),
          ["esc", "back"],
        ],
  });
}

function openEdit() {
  const widget = config.widgets[cursor];
  if (!widget || widget.id === "separator" || widget.id === "lineBreak") {
    return;
  }
  editIndex = cursor;
  textInput = null;
  screen = "edit";
  cursor = 0;
}

function closeEdit() {
  textInput = null;
  screen = "main";
  cursor = editIndex;
  clampCursor(config.widgets.length);
}

// Sets one option, or removes it when the value is undefined, then saves.
function setOption(key, value) {
  const widget = editedWidget();
  if (value === undefined) {
    delete widget[key];
  } else {
    widget[key] = value;
  }
  persist();
}

function stepOption(field, direction) {
  const current = editedWidget()[field.key];
  if (field.number !== undefined) {
    setOption(field.key, stepNumberField(field, current, direction));
    return;
  }
  const index = field.values.findIndex((value) => value === current);
  const next = (Math.max(0, index) + direction + field.values.length) % field.values.length;
  setOption(field.key, field.values[next]);
}

function onEdit(key) {
  const fields = editFields(editedWidget());
  const field = fields[cursor];

  if (textInput !== null) {
    if (key.name === "escape") {
      textInput = null;
    } else if (key.name === "return") {
      const text = stripControl(textInput).trim();
      setOption(field.key, text || undefined);
      textInput = null;
    } else if (key.name === "backspace" || key.name === "delete") {
      textInput = Array.from(textInput).slice(0, -1).join("");
    } else if (key.sequence && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(key.sequence)) {
      // An emoji arrives as one key with two UTF-16 units, so count code points.
      const max = field?.maxLength ?? TEXT_MAX;
      if (Array.from(textInput + key.sequence).length <= max) {
        textInput += key.sequence;
      }
    }
    return;
  }

  if (key.name === "escape") {
    closeEdit();
    return;
  }
  if (key.name === "up") {
    moveCursor(-1, fields.length);
    return;
  }
  if (key.name === "down") {
    moveCursor(1, fields.length);
    return;
  }
  if (!field || field.fixed) {
    return;
  }
  if (key.name === "x" || key.name === "delete" || key.name === "backspace") {
    setOption(field.key, undefined);
    return;
  }
  if (field.text) {
    if (key.name === "return") {
      textInput = editedWidget()[field.key] ?? "";
    }
    return;
  }
  if (key.name === "left" || key.name === "right") {
    stepOption(field, key.name === "left" ? -1 : 1);
    return;
  }
  if (key.name === "return" && field.values) {
    stepOption(field, 1);
  }
}

function drawAdd() {
  const widgets = filteredAddableWidgets();
  const caret = config.ascii ? "_" : "▏";
  const search = searchQuery
    ? `${BOLD}${searchQuery}${RESET}${caret}`
    : `${caret}${dim("type to filter")}`;
  const head = [`${config.ascii ? "search:" : "🔎"} ${search}`, ""];
  const items = widgets.length
    ? widgets.map((widget) => ({
        lead: widgetIcon(widget.id),
        text: widget.label,
        extra: widget.summary,
      }))
    : [dim(`No widget matches "${searchQuery}". Backspace to edit, Esc to go back.`)];
  const hovered = widgets[cursor];

  return screenFrame({
    title: "Add a widget",
    head,
    items,
    selected: widgets.length ? cursor : -1,
    details: hovered
      ? {
          title: [widgetIcon(hovered.id), hovered.label].filter(Boolean).join(" "),
          lines: [
            `${capitalize(hovered.description)}.`,
            "",
            heading("Preview"),
            ...widgetPreview({ id: hovered.id }),
            "",
            ...presetsUsing(hovered.id),
            "",
            { dim: hovered.unique ? "One per bar." : "Can be added more than once." },
            ...(hovered.id === "exec" ? [EXEC_NOTE] : []),
          ],
        }
      : { title: "No match", lines: ["Backspace edits the search, Esc clears it."] },
    keys: [
      ["type", "filter"],
      [ui.glyph.upDown, "move"],
      ["enter", "add"],
      ["backspace", "delete"],
      ["esc", "back"],
    ],
  });
}

function presetDetails(id) {
  const preset = PRESETS[id];
  if (!preset) {
    return null;
  }
  const rows = [[]];
  for (const widget of preset.widgets) {
    if (widget.id === "lineBreak") {
      rows.push([]);
    } else if (widget.id !== "separator") {
      const icon = widgetIcon(widget.id);
      rows[rows.length - 1].push(
        icon ? `${icon} ${widgetLabel(widget.id)}` : widgetLabel(widget.id)
      );
    }
  }
  const count = rows.flat().length;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return {
    title: preset.name,
    lines: [
      `${preset.description}.`,
      "",
      heading(`${plural(count, "widget")} on ${plural(rows.length, "row")}`),
      ...rows.map((labels, index) => ({
        raw: `${ui.accentText(String(index + 1))}  ${labels.join(dim(" · "))}`,
      })),
    ],
  };
}

function drawPresets() {
  const current = currentPreset();
  const items = PRESET_ORDER.map((id) => {
    const preset = PRESETS[id];
    const lead = config.ascii ? "" : (PRESET_ICONS[id] ?? "");
    const badge = id === current ? ui.chip("current", true) : "";
    return { lead, text: preset.name, badge, extra: preset.description };
  });

  return screenFrame({
    title: "Presets",
    items,
    notes: ["A preset swaps your widgets; your layout and theme stay."],
    details: presetDetails(PRESET_ORDER[cursor]),
    keys: [
      [ui.glyph.upDown, "preview"],
      ["enter", "apply"],
      ["esc", "back"],
    ],
  });
}

function themeSwatch(colors) {
  if (!colors || config.ascii) {
    return "";
  }
  return (
    ["model", "context", "fiveHour", "caution", "warn"]
      .map((slot) => `${fg(colors[slot])}●`)
      .join("") + RESET
  );
}

const toHex = (rgb) => `#${rgb.map((part) => part.toString(16).padStart(2, "0")).join("")}`;

// One color as a pill in that color with the theme's pill text, the way the
// bar draws it, then its hex value.
function colorCell(label, rgb, ink) {
  return `${ui.pill(` ${label.padEnd(9)}`, rgb, ink)}  ${dim(toHex(rgb))}`;
}

// Widget colors on the left, states on the right; a blank line between rows
// keeps the pills from touching.
const PALETTE_ROWS = [
  [
    ["model", "Model"],
    ["fiveHour", "OK"],
  ],
  [
    ["context", "Context"],
    ["caution", "Caution"],
  ],
  [
    ["git", "Git"],
    ["warn", "Danger"],
  ],
  [
    ["weekly", "7d quota"],
    ["meta", "Details"],
  ],
];

function paletteLines(colors) {
  return PALETTE_ROWS.flatMap((row, index) => [
    ...(index ? [""] : []),
    { raw: row.map(([slot, label]) => colorCell(label, colors[slot], colors.text)).join("    ") },
  ]);
}

function themeDetails(id) {
  if (id === "custom") {
    return {
      title: "Custom",
      lines: [
        "Your own colors, on top of a base theme.",
        "",
        "Enter opens the color editor; the preview follows every change.",
      ],
    };
  }
  const theme = THEMES[id];
  if (!theme) {
    return null;
  }
  const background = { dark: "dark terminals", light: "light terminals" }[theme.kind];
  return {
    title: theme.name,
    lines: [
      `${theme.description}.`,
      ...(background ? [{ raw: `${dim("For")} ${ui.tag(background)}` }] : []),
      "",
      heading("Palette"),
      ...paletteLines(theme.colors),
      "",
      heading("Sample"),
      ...themeSample(theme.colors),
    ],
  };
}

// The editor drawn in the hovered theme: a selected and a normal row, and the
// three states quotas and the context go through.
function themeSample(colors) {
  const { on } = ui.glyph;
  const state = (slot, label) => `${fg(colors[slot])}${on} ${label}${RESET}`;
  return [
    { raw: ui.row(true, "Selected item", "its description") },
    { raw: ui.row(false, "Normal item", "its description") },
    {
      raw: `  ${state("fiveHour", "ok")}   ${state("caution", "caution")}   ${state("warn", "danger")}`,
    },
  ];
}

function drawThemes() {
  const items = THEME_ORDER.map((id) => {
    const theme =
      THEMES[id] || (id === "custom" ? { name: "Custom", description: "Your own colors" } : null);
    if (!theme) {
      return "";
    }
    const swatch = themeSwatch(id === "custom" ? null : theme.colors);
    const badge = id === config.theme ? ui.chip("current", true) : "";
    const extra = id === "custom" ? `${theme.description}, Enter to edit` : theme.description;
    return { lead: swatch, text: theme.name, badge, extra };
  });

  return screenFrame({
    title: "Themes",
    items,
    details: themeDetails(THEME_ORDER[cursor]),
    keys: [
      [ui.glyph.upDown, "preview"],
      ["enter", "apply"],
      ["esc", "back"],
    ],
  });
}

function hexSwatch(hex) {
  if (!hex || hex === "(base)") return "from base theme";
  try {
    return `${fg(parseColor(hex))}${config.ascii ? "#" : "■"}${RESET} ${hex}`;
  } catch {
    return hex;
  }
}

// The curated colors in a row, the slot's current one in brackets.
function curatedPalette(current) {
  const block = config.ascii ? "#" : "■";
  return CURATED_HEX_PALETTE.map((hex) => {
    const swatch = `${fg(parseColor(hex))}${block}${RESET}`;
    return hex === current ? `[${swatch}]` : ` ${swatch} `;
  }).join("");
}

function drawCustomTheme() {
  const customColors = config.customTheme?.colors || {};
  const items = CUSTOM_COLOR_SLOTS.map((slot) => ({
    text: slot.label,
    value: hexSwatch(customColors[slot.key] || "(base)"),
  }));
  const slot = CUSTOM_COLOR_SLOTS[cursor];
  const current = customColors[slot?.key];

  return screenFrame({
    title: "Custom theme",
    items,
    notes: ["Cycle a slot through curated colors; the preview updates as you go."],
    details: slot && {
      title: slot.label,
      lines: [
        current ? `Now ${current}.` : "Now the base theme's color.",
        "",
        curatedPalette(current),
        "",
        { dim: "← → and Enter step through these colors." },
      ],
    },
    keys: [
      [ui.glyph.upDown, "slot"],
      [ui.glyph.leftRight, "cycle color"],
      ["enter", "next color"],
      ["esc", "back"],
    ],
  });
}

function glyphLabel(hex, slot) {
  return `${glyphChar(hex, slot, config.ascii)}  ${glyphName(hex)} (U+${hex})`;
}

function glyphSummary(slot) {
  const list = config.powerline[GLYPH_SLOTS[slot].key];
  if (!list.length) {
    return "none";
  }

  return list.map((hex) => `${glyphChar(hex, slot, config.ascii)} ${glyphName(hex)}`).join(", ");
}

function powerlineRowValue(row) {
  if (row.id === "enabled") {
    return config.powerline.enabled ? "on" : "off";
  }

  if (row.id === "rowGap") {
    return config.rowGap ? "on" : "off";
  }

  if (row.id === "style") {
    const style = detectStyle(config.powerline);
    return style ? STYLES[style].name : "custom";
  }

  if (row.slot) {
    return glyphSummary(row.slot);
  }

  return THEMES[config.theme]?.name ?? config.theme;
}

const POWERLINE_HELP = {
  enabled:
    "On: adjacent widgets share one pill, with a separator between them. Off: every widget gets its own pill.",
  rowGap:
    "Puts a blank line between rows, in every layout, so stacked pills don't touch and text rows get more air. The bar takes more lines (three rows become five).",
  style: "Sets start caps, end caps and separators in one go. Enter cycles the styles.",
  separators: "Glyphs between widgets of a pill. With several, they cycle per join, left to right.",
  startCaps: "Glyphs that open each pill. With several, they cycle per pill, left to right.",
  endCaps: "Glyphs that close each pill. With several, they cycle per pill, left to right.",
  theme: "Enter opens the Themes tab.",
};

function powerlineDetails(row) {
  if (!row) {
    return null;
  }
  const lines = [POWERLINE_HELP[row.id] ?? ""];
  if (row.id === "style") {
    const width = Math.max(...STYLE_ORDER.map((id) => STYLES[id].name.length));
    lines.push(
      "",
      ...STYLE_ORDER.map((id) => `${STYLES[id].name.padEnd(width)}  ${dim(STYLES[id].description)}`)
    );
  }
  if (row.slot) {
    lines.push("", "Enter edits the list.");
  }
  return { title: row.label, lines };
}

function drawPowerline() {
  const items = POWERLINE_ROWS.map((row) => ({ text: row.label, value: powerlineRowValue(row) }));
  const notes =
    config.layout !== "pills"
      ? ["Powerline shapes apply to Pills. Switch layout with l."]
      : [
          "A style sets caps and separators together; edit a list to fine-tune it.",
          "Lists with several glyphs cycle left to right. A Flex Separator starts a new pill.",
        ];

  return screenFrame({
    title: "Powerline",
    items,
    notes,
    details: powerlineDetails(POWERLINE_ROWS[cursor]),
    keys: [
      [ui.glyph.upDown, "move"],
      ["enter", "toggle / cycle / edit"],
      ["esc", "back"],
    ],
  });
}

function drawGlyphs() {
  const { key, title } = GLYPH_SLOTS[glyphSlot];
  const list = config.powerline[key];
  const isSeparator = glyphSlot === "separator";

  if (hexInput !== null) {
    return screenFrame({
      title: `Powerline ${ui.glyph.dot} ${title}`,
      items: [
        `Code point: ${BOLD}U+${hexInput}${RESET}${dim("_".repeat(6 - hexInput.length))}`,
        "",
        dim("Type 4-6 hex digits, e.g. E0B0 (Powerline), E0C0 (flame), 2588 (block)."),
      ],
      selected: -1,
      keys: [
        ["enter", "apply"],
        ["esc", "cancel"],
      ],
    });
  }

  const items = list.length
    ? list.map((hex, index) => {
        const inverted = isSeparator && config.powerline.separatorInvert[index] ? "inverted" : "";
        return { text: glyphLabel(hex, glyphSlot), value: inverted };
      })
    : [
        dim(
          `None: ${isSeparator ? "widgets in a pill touch directly" : "pills have no cap on this side"}. Press a to add one.`
        ),
      ];
  const hovered = list[cursor];

  return screenFrame({
    title: `Powerline ${ui.glyph.dot} ${title}`,
    items,
    selected: list.length ? cursor : -1,
    notes: isSeparator
      ? ["Invert swaps the separator colors; left-pointing glyphs get it automatically."]
      : [],
    details: {
      title,
      lines: hovered
        ? [
            `${glyphChar(hovered, glyphSlot, config.ascii)}  ${glyphName(hovered)}`,
            { dim: `U+${hovered}, ${cursor + 1} of ${list.length}` },
            "",
            POWERLINE_HELP[key],
          ]
        : [POWERLINE_HELP[key]],
    },
    keys: [
      [ui.glyph.upDown, "select"],
      [ui.glyph.leftRight, "cycle preset"],
      ["a", "add"],
      ["i", "insert"],
      ["x", "remove"],
      ["c", "clear"],
      ["h", "hex"],
      ...(isSeparator ? [["v", "invert"]] : []),
      ["esc", "back"],
    ],
  });
}

// Three short paragraphs per layout, each under 90 columns so a wide panel
// shows them unwrapped.
const LAYOUT_HELP = {
  pills: [
    "Widgets sit in colored pills, joined by powerline caps and separators.",
    "Meters draw as small dots on the pill's color, with a larger dot as the pace marker.",
    "The Powerline tab sets the caps, separators, joins and the space between rows.",
  ],
  lines: [
    "Colored text on the terminal background, with thin │ dividers between widgets.",
    "Meters draw as dots in the ok, caution or danger color, over a dim track.",
    "Powerline shapes don't apply; the theme, widgets and space between rows do.",
  ],
  classic: [
    "Colored text on the terminal background, with | dividers between widgets.",
    "Meters draw as blocks in one color: █ filled, ░ empty and │ as the pace marker.",
    "Powerline shapes don't apply; the theme, widgets and space between rows do.",
  ],
};

function drawLayout() {
  const items = LAYOUT_ORDER.map((id) => {
    const layout = LAYOUTS[id];
    const badge = id === config.layout ? ui.chip("current", true) : "";
    return { text: layout.name, badge, extra: layout.description };
  });
  const hovered = LAYOUTS[LAYOUT_ORDER[cursor]];

  return screenFrame({
    title: "Layout",
    items,
    details: hovered && {
      title: hovered.name,
      lines: LAYOUT_HELP[hovered.id].flatMap((line, i) => (i ? ["", line] : [line])),
    },
    keys: [
      [ui.glyph.upDown, "preview"],
      ["enter", "apply"],
      ["esc", "back"],
    ],
  });
}

function frameLines() {
  const shown = previewConfig();
  ui = makeUi(themeColors(shown.theme, shown.customTheme), {
    ascii: config.ascii === true,
    width: frameWidth(),
  });

  if (screen === "add") return drawAdd();
  if (screen === "edit") return drawEdit();
  if (screen === "themes") return drawThemes();
  if (screen === "customTheme") return drawCustomTheme();
  if (screen === "presets") return drawPresets();
  if (screen === "powerline") return drawPowerline();
  if (screen === "glyphs") return drawGlyphs();
  if (screen === "layout") return drawLayout();
  return drawMain();
}

function draw() {
  process.stdout.write(HOME_CLEAR + HIDE + frameLines().join("\n") + "\n");
}

// Draws one screen without a terminal, for tests. Options: config, screen,
// cursor, columns, rows, scroll (the first row shown of a long list), color
// ("truecolor", "256", "none"), search, flash, editIndex and textInput (the
// widget editor), and
// widgets (a list used as is, even empty, which a saved config never is).
function renderFrame(options = {}) {
  config = mergeConfig(options.config || {});
  if (options.widgets) {
    config.widgets = options.widgets;
  }
  screen = options.screen || "main";
  cursor = options.cursor || 0;
  searchQuery = options.search || "";
  flashMessage = options.flash || "";
  glyphSlot = options.glyphSlot || "separator";
  hexInput = options.hexInput ?? null;
  editIndex = options.editIndex ?? 0;
  textInput = options.textInput ?? null;
  previewData = options.data || sampleData();
  columnsOverride = options.columns || 100;
  rowsOverride = options.rows || 50;
  scrollTop = options.scroll || 0;
  scrollScreen = screen;
  const previousDepth = getActiveDepth();
  setActiveDepth(options.color || "truecolor");
  try {
    return frameLines().join("\n");
  } finally {
    columnsOverride = null;
    rowsOverride = null;
    setActiveDepth(previousDepth);
  }
}

function openAdd() {
  screen = "add";
  searchQuery = "";
  cursor = 0;
  clampCursor(filteredAddableWidgets().length);
}

function openPresets() {
  screen = "presets";
  cursor = 0;
}

function openCustomTheme() {
  screen = "customTheme";
  cursor = 0;
}

function openThemes() {
  screen = "themes";
  cursor = Math.max(0, THEME_ORDER.indexOf(config.theme));
}

function openPowerline() {
  screen = "powerline";
  cursor = 0;
}

function openGlyphs(slot) {
  screen = "glyphs";
  glyphSlot = slot;
  hexInput = null;
  cursor = 0;
}

function openLayout() {
  screen = "layout";
  cursor = Math.max(0, LAYOUT_ORDER.indexOf(config.layout));
}

function backToMain() {
  screen = "main";
  clampCursor(config.widgets.length);
}

const TAB_OPENERS = {
  main: () => {
    backToMain();
    cursor = 0;
  },
  presets: () => openPresets(),
  themes: () => openThemes(),
  layout: () => openLayout(),
  powerline: () => openPowerline(),
};

// ← → and Tab / Shift+Tab move between the tabs, and each tab's letter opens
// it. Sub-screens (adding a widget, the color and glyph editors) keep those
// keys for themselves. Returns the tab to open, or null when the key doesn't
// switch tabs.
function tabAfter(current, key) {
  if (!TABS.some((tab) => tab.id === current) || !key) {
    return null;
  }
  const byLetter = !key.ctrl && TABS.find((tab) => tab.key && tab.key === key.name);
  if (byLetter) {
    return byLetter.id === current ? null : byLetter.id;
  }
  const back = key.name === "left" || (key.name === "tab" && key.shift);
  if (!back && key.name !== "right" && key.name !== "tab") {
    return null;
  }
  const index = TABS.findIndex((tab) => tab.id === current);
  return TABS[(index + (back ? -1 : 1) + TABS.length) % TABS.length].id;
}

function switchTab(key) {
  const next = tabAfter(screen, key);
  if (!next) {
    return false;
  }
  TAB_OPENERS[next]();
  return true;
}

function onMain(key) {
  if (key.name === "up") {
    if (key.shift) {
      moveItem(-1);
    } else {
      moveCursor(-1, config.widgets.length);
    }
    return;
  }

  if (key.name === "down") {
    if (key.shift) {
      moveItem(1);
    } else {
      moveCursor(1, config.widgets.length);
    }
    return;
  }

  if (key.sequence === "[" || key.name === "[") {
    moveItem(-1);
    return;
  }

  if (key.sequence === "]" || key.name === "]") {
    moveItem(1);
    return;
  }

  if (key.name === "i") {
    config.ascii = !config.ascii;
    persist();
    return;
  }

  if (key.name === "return") {
    openEdit();
    return;
  }

  if (key.name === "a") {
    openAdd();
    return;
  }

  if (key.name === "s") {
    insertSeparator();
    return;
  }

  if (key.name === "n") {
    insertLineBreak();
    return;
  }

  if (key.name === "x" || key.name === "delete" || key.name === "backspace") {
    removeItem();
    return;
  }

  if (key.name === "d") {
    config = defaultConfig();
    if (persist()) {
      flashMessage = "Reset to default configuration.";
    }
    clampCursor(config.widgets.length);
    return;
  }

  if (key.name === "b") {
    config.thresholds = config.thresholds || {};
    config.thresholds.blink = !config.thresholds.blink;
    if (persist()) {
      flashMessage = `Alert blink: ${config.thresholds.blink ? "on" : "off"}`;
    }
    return;
  }

  if (key.name === "j") {
    setPowerline({ enabled: !config.powerline.enabled });
    return;
  }

  if (key.name === "v") {
    toggleRowGap();
    return;
  }

  if (key.name === "e") {
    config.emojis = !config.emojis;
    persist();
    return;
  }

  if (key.name === "m") {
    config.minimalist = !config.minimalist;
    if (persist()) {
      flashMessage = `Minimalist: ${config.minimalist ? "on (values only)" : "off"}`;
    }
    return;
  }

  if (key.name === "r") {
    config.pacing = !config.pacing;
    if (persist()) {
      flashMessage = `Pace marker: ${config.pacing ? "on" : "off"}`;
    }
    return;
  }

  if (key.name === "u" && SUPPORTED_LANGUAGES.length > 1) {
    const next = SUPPORTED_LANGUAGES.indexOf(resolveLanguage(config.language)) + 1;
    config.language = SUPPORTED_LANGUAGES[next % SUPPORTED_LANGUAGES.length];
    if (persist()) {
      flashMessage = `Bar language: ${config.language}`;
    }
  }
}

function onAdd(key) {
  const items = filteredAddableWidgets();

  if (key.name === "escape") {
    if (searchQuery.length > 0) {
      searchQuery = "";
      cursor = 0;
      clampCursor(filteredAddableWidgets().length);
      return;
    }
    backToMain();
    return;
  }

  if (key.name === "up") {
    moveCursor(-1, items.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(1, items.length);
    return;
  }

  if (key.name === "return" && items[cursor]) {
    addItem(items[cursor].id);
    backToMain();
    return;
  }

  if (key.name === "backspace" || key.name === "delete") {
    if (searchQuery.length > 0) {
      searchQuery = searchQuery.slice(0, -1);
      cursor = 0;
      clampCursor(filteredAddableWidgets().length);
    }
    return;
  }

  if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
    const char = key.sequence;
    if (char >= " " && char <= "~") {
      searchQuery += char;
      cursor = 0;
      clampCursor(filteredAddableWidgets().length);
    }
  }
}

function cycleCustomColor(slotKey, dir = 1) {
  if (!config.customTheme) {
    config.customTheme = { colors: {} };
  }
  if (!config.customTheme.colors) {
    config.customTheme.colors = {};
  }
  const current = config.customTheme.colors[slotKey];
  const idx = CURATED_HEX_PALETTE.indexOf(current);
  let nextIdx;
  if (idx === -1) {
    nextIdx = dir >= 0 ? 0 : CURATED_HEX_PALETTE.length - 1;
  } else {
    nextIdx = (idx + dir + CURATED_HEX_PALETTE.length) % CURATED_HEX_PALETTE.length;
  }
  config.customTheme.colors[slotKey] = CURATED_HEX_PALETTE[nextIdx];
  config.theme = "custom";
  persist();
}

function onCustomTheme(key) {
  if (key.name === "escape") {
    backToMain();
    return;
  }

  if (key.name === "up") {
    moveCursor(-1, CUSTOM_COLOR_SLOTS.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(1, CUSTOM_COLOR_SLOTS.length);
    return;
  }

  if (key.name === "left") {
    const slot = CUSTOM_COLOR_SLOTS[cursor];
    if (slot) {
      cycleCustomColor(slot.key, -1);
    }
    return;
  }

  if (key.name === "right" || key.name === "return" || key.name === "space") {
    const slot = CUSTOM_COLOR_SLOTS[cursor];
    if (slot) {
      cycleCustomColor(slot.key, 1);
    }
  }
}

function onPresets(key) {
  if (key.name === "escape") {
    backToMain();
    return;
  }

  if (key.name === "up") {
    moveCursor(-1, PRESET_ORDER.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(1, PRESET_ORDER.length);
    return;
  }

  if (key.name === "return") {
    const presetId = PRESET_ORDER[cursor];
    if (presetId && PRESETS[presetId]) {
      config = applyPreset(config, presetId);
      if (persist()) {
        flashMessage = `Applied preset: ${PRESETS[presetId].name}`;
      }
    }
    backToMain();
  }
}

function onThemes(key) {
  if (key.name === "escape") {
    backToMain();
    return;
  }

  if (key.name === "up") {
    moveCursor(-1, THEME_ORDER.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(1, THEME_ORDER.length);
    return;
  }

  if (key.name === "c" || key.name === "e") {
    openCustomTheme();
    return;
  }

  if (key.name === "return") {
    const selected = THEME_ORDER[cursor];
    if (selected === "custom") {
      openCustomTheme();
      return;
    }
    config.theme = selected;
    persist();
    backToMain();
  }
}

function onLayout(key) {
  if (key.name === "escape") {
    backToMain();
    return;
  }

  if (key.name === "up") {
    moveCursor(-1, LAYOUT_ORDER.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(1, LAYOUT_ORDER.length);
    return;
  }

  if (key.name === "return") {
    config.layout = LAYOUT_ORDER[cursor];
    persist();
    backToMain();
  }
}

function toggleRowGap() {
  config.rowGap = !config.rowGap;
  if (persist()) {
    flashMessage = `Space between rows: ${config.rowGap ? "on" : "off"}`;
  }
}

function setPowerline(changes) {
  config.powerline = normalizePowerline({ ...config.powerline, ...changes });
  persist();
}

function onPowerline(key) {
  if (key.name === "escape") {
    backToMain();
    return;
  }

  if (key.name === "up") {
    moveCursor(-1, POWERLINE_ROWS.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(1, POWERLINE_ROWS.length);
    return;
  }

  if (key.name !== "return") {
    return;
  }

  const row = POWERLINE_ROWS[cursor];

  if (row.id === "enabled") {
    setPowerline({ enabled: !config.powerline.enabled });
  } else if (row.id === "rowGap") {
    toggleRowGap();
  } else if (row.id === "style") {
    // A customized setup restarts the cycle at the first style.
    const current = STYLE_ORDER.indexOf(detectStyle(config.powerline));
    const next = STYLE_ORDER[(current + 1) % STYLE_ORDER.length];
    config.powerline = applyStyle(config.powerline, next);
    persist();
  } else if (row.slot) {
    openGlyphs(row.slot);
  } else {
    openThemes();
  }
}

// Writes a new glyph list for the open slot. Separators carry their invert
// flags along so a flag stays with its glyph when the list is edited.
function setGlyphs(list, invert) {
  const changes = { [GLYPH_SLOTS[glyphSlot].key]: list };
  if (glyphSlot === "separator") {
    changes.separatorInvert = invert;
  }
  setPowerline(changes);
  clampCursor(list.length);
}

function onGlyphHex(key) {
  if (key.name === "escape") {
    hexInput = null;
    return;
  }

  if (key.name === "backspace" || key.name === "delete") {
    hexInput = hexInput.slice(0, -1);
    return;
  }

  if (key.name === "return") {
    const hex = hexInput.length >= 4 ? parseGlyph(hexInput) : null;
    if (!hex) {
      flashMessage = `⚠ U+${hexInput || "?"} is not a printable glyph`;
      return;
    }

    const list = [...config.powerline[GLYPH_SLOTS[glyphSlot].key]];
    const invert = [...config.powerline.separatorInvert];
    const index = list.length ? cursor : 0;
    list[index] = hex;
    invert[index] = INVERTED_BY_DEFAULT.has(hex);
    hexInput = null;
    setGlyphs(list, invert);
    return;
  }

  const char = key.sequence;
  if (char && /^[0-9a-f]$/i.test(char) && hexInput.length < 6) {
    hexInput += char.toUpperCase();
  }
}

function onGlyphs(key) {
  if (hexInput !== null) {
    onGlyphHex(key);
    return;
  }

  const presets = SLOT_PRESETS[glyphSlot];
  const list = [...config.powerline[GLYPH_SLOTS[glyphSlot].key]];
  const invert = [...config.powerline.separatorInvert];

  if (key.name === "escape") {
    screen = "powerline";
    cursor = POWERLINE_ROWS.findIndex((row) => row.slot === glyphSlot);
    return;
  }

  if (key.name === "up") {
    moveCursor(-1, list.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(1, list.length);
    return;
  }

  if ((key.name === "left" || key.name === "right") && list.length) {
    // Custom glyphs jump to the first (or last) preset.
    const current = presets.indexOf(list[cursor]);
    const step = key.name === "right" ? 1 : -1;
    let next;
    if (current === -1) {
      next = step === 1 ? 0 : presets.length - 1;
    } else {
      next = (current + step + presets.length) % presets.length;
    }
    list[cursor] = presets[next];
    invert[cursor] = INVERTED_BY_DEFAULT.has(presets[next]);
    setGlyphs(list, invert);
    return;
  }

  if (key.name === "a" || key.name === "i") {
    if (list.length >= MAX_GLYPHS) {
      flashMessage = `⚠ At most ${MAX_GLYPHS} glyphs per list`;
      return;
    }
    const at = list.length && key.name === "a" ? cursor + 1 : Math.min(cursor, list.length);
    list.splice(at, 0, presets[0]);
    invert.splice(at, 0, INVERTED_BY_DEFAULT.has(presets[0]));
    cursor = at;
    setGlyphs(list, invert);
    return;
  }

  if ((key.name === "x" || key.name === "delete") && list.length) {
    list.splice(cursor, 1);
    invert.splice(cursor, 1);
    setGlyphs(list, invert);
    return;
  }

  if (key.name === "c") {
    cursor = 0;
    setGlyphs([], []);
    return;
  }

  if (key.name === "h") {
    hexInput = "";
    return;
  }

  if (key.name === "v" && glyphSlot === "separator" && list.length) {
    invert[cursor] = !invert[cursor];
    setGlyphs(list, invert);
  }
}

// While a text field is open (widget search, glyph code), "q" is a letter
// ("quota"), not quit. Ctrl+C always quits.
function isQuitKey(key, typing) {
  return Boolean((key.ctrl && key.name === "c") || (key.name === "q" && !typing));
}

function onKey(_str, key) {
  if (!key || exiting) {
    return;
  }

  const typing = screen === "add" || hexInput !== null || textInput !== null;
  if (isQuitKey(key, typing)) {
    quit();
    return;
  }

  if (key.ctrl && key.name === "g") {
    openRepo();
    draw();
    return;
  }

  if (!typing && key.name === "g") {
    openRepo();
    draw();
    return;
  }

  flashMessage = "";

  if (switchTab(key)) {
    draw();
    return;
  }

  if (screen === "add") {
    onAdd(key);
  } else if (screen === "edit") {
    onEdit(key);
  } else if (screen === "themes") {
    onThemes(key);
  } else if (screen === "customTheme") {
    onCustomTheme(key);
  } else if (screen === "presets") {
    onPresets(key);
  } else if (screen === "powerline") {
    onPowerline(key);
  } else if (screen === "glyphs") {
    onGlyphs(key);
  } else if (screen === "layout") {
    onLayout(key);
  } else {
    onMain(key);
  }

  draw();
}

function quit() {
  if (exiting) {
    return;
  }

  exiting = true;
  persist();
  process.stdin.setRawMode?.(false);
  process.stdout.write(SHOW + ALT_OFF);
  process.exit(0);
}

function start() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("Run this in an interactive terminal:");
    console.error("  npx agy-powerline configure");
    process.exit(1);
  }

  config = loadEditableConfig();
  if (!config) {
    process.exit(1);
  }
  previewData = sampleData();
  setActiveDepth(resolveColorDepth({ configColor: config.color, env: process.env }));
  screen = "main";
  cursor = 0;
  exiting = false;

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("keypress", onKey);
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
  // The frame follows the window width, so redraw before a resize wraps it.
  process.stdout.on("resize", draw);
  process.stdout.write(ALT_ON + HIDE);
  draw();
}

function runTui() {
  start();
}

module.exports = {
  configureCommand,
  renderFrame,
  tabAfter,
  isQuitKey,
  wrapCursor,
  openUrl,
  REPO_URL,
};

if (require.main === module) {
  configureCommand();
}
