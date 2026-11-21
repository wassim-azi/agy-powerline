// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { widgetLabel, PRESETS, applyPreset } = require("../../lib/shared");
const {
  BOLD,
  RESET,
  clampCursor,
  moveCursor,
  backToMain,
  persist,
  currentPreset,
  filteredPresets,
  widgetIcon,
} = require("./state");
const { dim, heading, tabKeys, screenFrame } = require("./frame");

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
  const presets = filteredPresets(state);
  const caret = state.config.ascii ? "_" : "▏";
  const showFilter = state.filterActive || Boolean(state.searchQuery);
  const queryText = state.searchQuery
    ? `${BOLD}${state.searchQuery}${RESET}${state.filterActive ? caret : ""}`
    : `${caret}${dim(state, "type to filter")}`;
  const head = showFilter ? [`${state.config.ascii ? "filter:" : "🔎"} ${queryText}`, ""] : [];
  const items = presets.length
    ? presets.map((id) => {
        const preset = PRESETS[id];
        const lead = state.config.ascii ? "" : (PRESET_ICONS[id] ?? "");
        const badge = id === current ? state.ui.chip("current", true) : "";
        return { lead, text: preset.name, badge, extra: preset.description };
      })
    : [dim(state, `No preset matches "${state.searchQuery}". Esc to clear filter.`)];

  return screenFrame(state, {
    title: "Presets",
    head,
    items,
    selected: presets.length ? state.cursor : -1,
    notes: ["A preset swaps your widgets; your layout and theme stay."],
    details: presetDetails(state, presets[state.cursor]),
    keys: state.filterActive
      ? [
          ["type", "filter"],
          [state.ui.glyph.upDown, "preview"],
          ["enter", "apply"],
          ["esc", "clear"],
        ]
      : tabKeys(state, [
          [state.ui.glyph.upDown, "preview"],
          ["/", "filter"],
          ["enter", "apply"],
        ]),
  });
}

function openPresets(state) {
  state.screen = "presets";
  state.filterActive = false;
  state.searchQuery = "";
  state.cursor = 0;
}

function onPresets(state, key) {
  const presets = filteredPresets(state);

  if (state.filterActive) {
    if (key.name === "escape") {
      state.filterActive = false;
      state.searchQuery = "";
      state.cursor = 0;
      return;
    }
    if (key.name === "up") {
      moveCursor(state, -1, presets.length);
      return;
    }
    if (key.name === "down") {
      moveCursor(state, 1, presets.length);
      return;
    }
    if (key.name === "return" && presets[state.cursor]) {
      const presetId = presets[state.cursor];
      state.config = applyPreset(state.config, presetId);
      if (persist(state)) {
        state.flashMessage = `Applied preset: ${PRESETS[presetId].name}`;
      }
      state.filterActive = false;
      state.searchQuery = "";
      backToMain(state);
      return;
    }
    if (key.name === "backspace" || key.name === "delete") {
      if (state.searchQuery.length > 0) {
        state.searchQuery = state.searchQuery.slice(0, -1);
        state.cursor = 0;
        clampCursor(state, filteredPresets(state).length);
      }
      return;
    }
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      const char = key.sequence;
      if (char >= " " && char <= "~") {
        state.searchQuery += char;
        state.cursor = 0;
        clampCursor(state, filteredPresets(state).length);
      }
    }
    return;
  }

  if (key.sequence === "/") {
    state.filterActive = true;
    state.searchQuery = "";
    state.cursor = 0;
    return;
  }

  if (key.name === "escape") {
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, presets.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, presets.length);
    return;
  }

  if (key.name === "return") {
    const presetId = presets[state.cursor];
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
