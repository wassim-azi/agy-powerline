// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { themeColors } = require("../../lib/shared");
const { makeUi } = require("../tui-style");
const { TABS, backToMain, openRepo } = require("./state");
const { previewConfig, stepScenario, stepPreviewWidth } = require("./preview");
const { frameWidth } = require("./frame");
const { drawMain, onMain, drawAdd, onAdd, drawEdit, onEdit } = require("./widgets-screen");
const { drawPresets, openPresets, onPresets } = require("./presets-screen");
const {
  drawThemes,
  openThemes,
  onThemes,
  drawCustomTheme,
  onCustomTheme,
} = require("./themes-screen");
const { drawLayout, openLayout, onLayout } = require("./layout-screen");
const {
  drawPowerline,
  openPowerline,
  onPowerline,
  drawGlyphs,
  onGlyphs,
} = require("./powerline-screen");
const { drawSettings, openSettings, onSettings } = require("./settings-screen");

const TAB_OPENERS = {
  main: (state) => {
    backToMain(state);
    state.cursor = 0;
  },
  presets: openPresets,
  themes: openThemes,
  layout: openLayout,
  powerline: openPowerline,
  settings: openSettings,
};

const SCREEN_DRAWERS = {
  main: drawMain,
  add: drawAdd,
  edit: drawEdit,
  themes: drawThemes,
  customTheme: drawCustomTheme,
  presets: drawPresets,
  powerline: drawPowerline,
  glyphs: drawGlyphs,
  layout: drawLayout,
  settings: drawSettings,
};

const SCREEN_HANDLERS = {
  main: onMain,
  add: onAdd,
  edit: onEdit,
  themes: onThemes,
  customTheme: onCustomTheme,
  presets: onPresets,
  powerline: onPowerline,
  glyphs: onGlyphs,
  layout: onLayout,
  settings: onSettings,
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

function switchTab(state, key) {
  const next = tabAfter(state.screen, key);
  if (!next) {
    return false;
  }
  TAB_OPENERS[next](state);
  return true;
}

// While a text field is open (widget search, glyph code), "q" is a letter
// ("quota"), not quit. Ctrl+C always quits.
function isQuitKey(key, typing) {
  return Boolean((key.ctrl && key.name === "c") || (key.name === "q" && !typing));
}

function drawFrameLines(state) {
  const shown = previewConfig(state);
  state.ui = makeUi(themeColors(shown.theme, shown.customTheme), {
    ascii: state.config.ascii === true,
    width: frameWidth(state),
  });

  const drawScreen = SCREEN_DRAWERS[state.screen] || drawMain;
  return drawScreen(state);
}

function handleKey(state, key, { draw, quit }) {
  if (!key || state.exiting) {
    return;
  }

  const typing = state.screen === "add" || state.hexInput !== null || state.textInput !== null;
  if (isQuitKey(key, typing)) {
    quit();
    return;
  }

  if (key.ctrl && key.name === "g") {
    openRepo(state);
    draw();
    return;
  }

  if (!typing && key.name === "g") {
    openRepo(state);
    draw();
    return;
  }

  state.flashMessage = "";

  if (!typing && !key.ctrl && !key.meta) {
    if (key.sequence === "-") {
      stepPreviewWidth(state, -1);
      draw();
      return;
    }
    if (key.sequence === "+" || key.sequence === "=") {
      stepPreviewWidth(state, 1);
      draw();
      return;
    }
    if (key.sequence === ",") {
      stepScenario(state, -1);
      draw();
      return;
    }
    if (key.sequence === ".") {
      stepScenario(state, 1);
      draw();
      return;
    }
  }

  if (switchTab(state, key)) {
    draw();
    return;
  }

  const handleScreen = SCREEN_HANDLERS[state.screen] || onMain;
  handleScreen(state, key);
  draw();
}

module.exports = {
  tabAfter,
  switchTab,
  isQuitKey,
  drawFrameLines,
  handleKey,
};
