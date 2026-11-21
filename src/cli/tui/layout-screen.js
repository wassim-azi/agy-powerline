// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { LAYOUTS, LAYOUT_ORDER } = require("../../lib/shared");
const { moveCursor, backToMain, persist } = require("./state");
const { tabKeys, screenFrame } = require("./frame");

// Three short paragraphs per layout, each under 90 columns so a wide panel
// shows them unwrapped.
const LAYOUT_HELP = {
  pills: [
    "Widgets sit in colored pills, joined by powerline caps and separators.",
    "Meters draw as small dots on the pill's color, with a larger dot as the pace marker.",
    "The Powerline tab sets caps, separators and joins; Settings sets row spacing.",
  ],
  lines: [
    "Colored text on the terminal background, with thin │ dividers between widgets.",
    "Meters draw as dots in the ok, caution or danger color, over a dim track.",
    "Powerline shapes don't apply; the theme, widgets and Settings do.",
  ],
  classic: [
    "Colored text on the terminal background, with | dividers between widgets.",
    "Meters draw as blocks in one color: █ filled, ░ empty and ┃ as the pace marker.",
    "Powerline shapes don't apply; the theme, widgets and Settings do.",
  ],
};

function drawLayout(state) {
  const items = LAYOUT_ORDER.map((id) => {
    const layout = LAYOUTS[id];
    const badge = id === state.config.layout ? state.ui.chip("current", true) : "";
    return { text: layout.name, badge, extra: layout.description };
  });
  const hovered = LAYOUTS[LAYOUT_ORDER[state.cursor]];

  return screenFrame(state, {
    title: "Layout",
    items,
    details: hovered && {
      title: hovered.name,
      lines: LAYOUT_HELP[hovered.id].flatMap((line, i) => (i ? ["", line] : [line])),
    },
    keys: tabKeys(state, [
      [state.ui.glyph.upDown, "preview"],
      ["enter", "apply"],
    ]),
  });
}

function openLayout(state) {
  state.screen = "layout";
  state.cursor = Math.max(0, LAYOUT_ORDER.indexOf(state.config.layout));
}

function onLayout(state, key) {
  if (key.name === "escape") {
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, LAYOUT_ORDER.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, LAYOUT_ORDER.length);
    return;
  }

  if (key.name === "return") {
    state.config.layout = LAYOUT_ORDER[state.cursor];
    persist(state);
    backToMain(state);
  }
}

module.exports = {
  drawLayout,
  openLayout,
  onLayout,
};
