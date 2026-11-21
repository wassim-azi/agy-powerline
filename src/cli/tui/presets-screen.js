// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { widgetLabel, PRESETS, PRESET_ORDER, applyPreset } = require("../../lib/shared");
const { moveCursor, backToMain, persist, currentPreset, widgetIcon } = require("./state");
const { dim, heading, screenFrame } = require("./frame");

const PRESET_ICONS = {
  default: "🎯",
  compact: "⚡",
  agent: "🧠",
  git: "🔀",
  tokens: "📊",
  quotas: "🔋",
  full: "🚀",
};

function presetDetails(state, id) {
  const preset = PRESETS[id];
  if (!preset) {
    return null;
  }
  const rows = [[]];
  for (const widget of preset.widgets) {
    if (widget.id === "lineBreak") {
      rows.push([]);
    } else if (widget.id !== "separator") {
      const icon = widgetIcon(state.config, widget.id);
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
      heading(state, `${plural(count, "widget")} on ${plural(rows.length, "row")}`),
      ...rows.map((labels, index) => ({
        raw: `${state.ui.accentText(String(index + 1))}  ${labels.join(dim(state, " · "))}`,
      })),
    ],
  };
}

function drawPresets(state) {
  const current = currentPreset(state.config);
  const items = PRESET_ORDER.map((id) => {
    const preset = PRESETS[id];
    const lead = state.config.ascii ? "" : (PRESET_ICONS[id] ?? "");
    const badge = id === current ? state.ui.chip("current", true) : "";
    return { lead, text: preset.name, badge, extra: preset.description };
  });

  return screenFrame(state, {
    title: "Presets",
    items,
    notes: ["A preset swaps your widgets; your layout and theme stay."],
    details: presetDetails(state, PRESET_ORDER[state.cursor]),
    keys: [
      [state.ui.glyph.upDown, "preview"],
      ["enter", "apply"],
      ["esc", "back"],
    ],
  });
}

function openPresets(state) {
  state.screen = "presets";
  state.cursor = 0;
}

function onPresets(state, key) {
  if (key.name === "escape") {
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, PRESET_ORDER.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, PRESET_ORDER.length);
    return;
  }

  if (key.name === "return") {
    const presetId = PRESET_ORDER[state.cursor];
    if (presetId && PRESETS[presetId]) {
      state.config = applyPreset(state.config, presetId);
      if (persist(state)) {
        state.flashMessage = `Applied preset: ${PRESETS[presetId].name}`;
      }
    }
    backToMain(state);
  }
}

module.exports = {
  PRESET_ICONS,
  drawPresets,
  openPresets,
  onPresets,
};
