// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { spawn } = require("child_process");
const {
  InvalidConfigError,
  saveConfig,
  WIDGET_CATALOG,
  PRESET_ORDER,
  applyPreset,
} = require("../../lib/shared");
const { WIDGET_TAGS } = require("../../lib/widget-style");
const { REPO_URL } = require("../repo-url");

const CSI = "\x1b[";
const RESET = `${CSI}0m`;
const BOLD = `${CSI}1m`;
const HIDE = `${CSI}?25l`;
const SHOW = `${CSI}?25h`;
const ALT_ON = `${CSI}?1049h`;
const ALT_OFF = `${CSI}?1049l`;
const HOME_CLEAR = `${CSI}H${CSI}J`;

const TABS = [
  { id: "main", label: "Widgets", key: "w" },
  { id: "presets", label: "Presets", key: "o" },
  { id: "themes", label: "Themes", key: "t" },
  { id: "layout", label: "Layout", key: "l" },
  { id: "powerline", label: "Powerline", key: "p" },
  { id: "settings", label: "Settings", key: "i" },
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
  settings: "settings",
};

function createState(overrides = {}) {
  return {
    config: null,
    screen: "main",
    cursor: 0,
    previewData: null,
    exiting: false,
    flashMessage: "",
    searchQuery: "",
    glyphSlot: "separator",
    // null while browsing the glyph list; a string while typing a code point.
    hexInput: null,
    // The widget being edited (its index in the list), and the text being typed
    // into one of its fields (null when not typing).
    editIndex: 0,
    textInput: null,
    // Preserves a custom hex-stop gradient loaded at session start across cycles.
    customGradientSpec: null,
    previewScenario: "default",
    previewWidthOverride: null,
    // First visible row of a scrolled list, kept between frames so the list only
    // moves when the cursor leaves the window.
    scrollTop: 0,
    scrollScreen: null,
    // Set by renderFrame so tests can draw a screen at a fixed size.
    columnsOverride: null,
    rowsOverride: null,
    stdin: process.stdin,
    stdout: process.stdout,
    ui: null,
    ...overrides,
  };
}

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

function openRepo(state) {
  openUrl(REPO_URL);
  state.flashMessage = "⭐ Opened repo in browser";
}

function usedIds(config) {
  return new Set(
    config.widgets
      .filter((widget) => widget.id !== "separator" && widget.id !== "lineBreak")
      .map((widget) => widget.id)
  );
}

function addableWidgets(config) {
  const used = usedIds(config);

  return WIDGET_CATALOG.filter((widget) => !widget.unique || !used.has(widget.id));
}

function filteredAddableWidgets(state) {
  const items = addableWidgets(state.config);
  if (!state.searchQuery.trim()) {
    return items;
  }
  const q = state.searchQuery.toLowerCase().trim();
  return items.filter(
    (w) =>
      w.label.toLowerCase().includes(q) ||
      w.id.toLowerCase().includes(q) ||
      (w.description && w.description.toLowerCase().includes(q))
  );
}

function clampCursor(state, length) {
  if (length <= 0) {
    state.cursor = 0;
    return;
  }

  state.cursor = Math.max(0, Math.min(state.cursor, length - 1));
}

function wrapCursor(current, delta, length) {
  if (length <= 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(current, length - 1));
  return (((clamped + delta) % length) + length) % length;
}

function moveCursor(state, delta, length) {
  state.cursor = wrapCursor(state.cursor, delta, length);
}

function backToMain(state) {
  state.screen = "main";
  clampCursor(state, state.config.widgets.length);
}

// The file can break while the TUI is open (edited by hand); keep the TUI
// running and say why changes stop being saved instead of crashing.
function persist(state) {
  try {
    saveConfig(state.config);
    return true;
  } catch (error) {
    if (!(error instanceof InvalidConfigError)) {
      throw error;
    }
    state.flashMessage = `⚠ Not saved: ${error.file} is no longer valid JSON. Fix it or delete it.`;
    return false;
  }
}

// The preset whose widgets are exactly the current ones, if any.
function currentPreset(config) {
  const mine = JSON.stringify(config.widgets);
  return PRESET_ORDER.find((id) => JSON.stringify(applyPreset(config, id).widgets) === mine);
}

// A widget's icon from the bar, when the bar shows icons.
function widgetIcon(config, id) {
  return config.emojis !== false && !config.ascii ? (WIDGET_TAGS[id]?.icon ?? "") : "";
}

function widgetCount(config) {
  const count = config.widgets.filter((w) => w.id !== "separator" && w.id !== "lineBreak").length;
  return `${count} widget${count === 1 ? "" : "s"}`;
}

module.exports = {
  CSI,
  RESET,
  BOLD,
  HIDE,
  SHOW,
  ALT_ON,
  ALT_OFF,
  HOME_CLEAR,
  TABS,
  TAB_OF_SCREEN,
  REPO_URL,
  createState,
  openUrl,
  openRepo,
  usedIds,
  addableWidgets,
  filteredAddableWidgets,
  clampCursor,
  wrapCursor,
  moveCursor,
  backToMain,
  persist,
  currentPreset,
  widgetIcon,
  widgetCount,
};
