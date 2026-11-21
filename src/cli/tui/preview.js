// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const {
  THEME_ORDER,
  LAYOUTS,
  LAYOUT_ORDER,
  PRESET_ORDER,
  applyPreset,
  renderStatusline,
} = require("../../lib/shared");
const { getActiveDepth } = require("../../lib/colors");
const { detectStyle } = require("../../lib/powerline");
const { currentPreset } = require("./state");

const PREVIEW_WIDTH_STEPS = [60, 80, 100, 120, null];

const PREVIEW_SCENARIOS = [
  { id: "default", label: "Normal", build: (base) => base },
  {
    id: "alerts",
    label: "Near limits",
    build: (base) => {
      const now = Date.now();
      return {
        ...base,
        exceeds_200k_tokens: true,
        context_window: {
          ...base.context_window,
          used_percentage: 91,
          remaining_percentage: 9,
        },
        quota: {
          ...base.quota,
          "gemini-5h": {
            remaining_fraction: 0.08,
            reset_time: new Date(now + 42 * 60 * 1000).toISOString(),
            reset_in_seconds: 42 * 60,
          },
          "gemini-weekly": {
            remaining_fraction: 0.03,
            reset_time: new Date(now + 5 * 3600 * 1000).toISOString(),
            reset_in_seconds: 5 * 3600,
          },
          "gemini-argon-wtu-weekly": {
            remaining_fraction: 0.07,
            reset_time: new Date(now + 8 * 3600 * 1000).toISOString(),
            reset_in_seconds: 8 * 3600,
          },
          "3p-5h": {
            remaining_fraction: 0.09,
            reset_time: new Date(now + 35 * 60 * 1000).toISOString(),
            reset_in_seconds: 35 * 60,
          },
          "3p-weekly": {
            remaining_fraction: 0.04,
            reset_time: new Date(now + 9 * 3600 * 1000).toISOString(),
            reset_in_seconds: 9 * 3600,
          },
        },
      };
    },
  },
  {
    id: "agent",
    label: "Agent & modes",
    build: (base) => ({
      ...base,
      agent: { name: "reviewer" },
      agent_state: "thinking",
      tool_confirmation_pending: true,
      pending_input_count: 3,
      task_count: 2,
      cycle_mode: "accept-edits",
      vim: { mode: "NORMAL" },
      sandbox: { enabled: true, allow_network: true },
    }),
  },
];

function previewScenarioEntry(state) {
  return (
    PREVIEW_SCENARIOS.find((entry) => entry.id === state.previewScenario) || PREVIEW_SCENARIOS[0]
  );
}

function activePreviewData(state) {
  return previewScenarioEntry(state).build(state.previewData);
}

function stepScenario(state, dir) {
  const index = PREVIEW_SCENARIOS.findIndex((entry) => entry.id === state.previewScenario);
  const current = index === -1 ? 0 : index;
  const next =
    PREVIEW_SCENARIOS[(current + dir + PREVIEW_SCENARIOS.length) % PREVIEW_SCENARIOS.length];
  state.previewScenario = next.id;
  state.flashMessage = `Preview scenario: ${next.label}`;
}

function stepPreviewWidth(state, dir) {
  const index = PREVIEW_WIDTH_STEPS.indexOf(state.previewWidthOverride);
  const current = index === -1 ? PREVIEW_WIDTH_STEPS.length - 1 : index;
  state.previewWidthOverride =
    PREVIEW_WIDTH_STEPS[(current + dir + PREVIEW_WIDTH_STEPS.length) % PREVIEW_WIDTH_STEPS.length];
  state.flashMessage = state.previewWidthOverride
    ? `Preview width: ${state.previewWidthOverride} cols`
    : "Preview width: full panel";
}

function previewConfig(state) {
  if (state.screen === "themes") {
    const hovered = THEME_ORDER[state.cursor];
    return hovered ? { ...state.config, theme: hovered } : state.config;
  }

  if (state.screen === "customTheme") {
    return { ...state.config, theme: "custom" };
  }

  if (state.screen === "presets") {
    const hovered = PRESET_ORDER[state.cursor];
    return hovered ? applyPreset(state.config, hovered) : state.config;
  }

  if (state.screen === "layout") {
    const hovered = LAYOUT_ORDER[state.cursor];
    return hovered ? { ...state.config, layout: hovered } : state.config;
  }

  return state.config;
}

// What the preview shows that isn't applied yet: the hovered theme, preset
// or layout. Empty when the preview is the saved setup.
function previewPending(state) {
  if (state.screen === "themes") {
    const hovered = THEME_ORDER[state.cursor];
    return hovered && hovered !== state.config.theme ? "theme" : "";
  }
  if (state.screen === "presets") {
    const hovered = PRESET_ORDER[state.cursor];
    return hovered && hovered !== currentPreset(state.config) ? "preset" : "";
  }
  if (state.screen === "layout") {
    const hovered = LAYOUT_ORDER[state.cursor];
    return hovered && hovered !== state.config.layout ? "layout" : "";
  }
  return "";
}

// The bar's rendered rows for the live preview panel.
function previewParts(state, width) {
  const preview = previewConfig(state);
  const { dot } = state.ui.glyph;
  const targetWidth = state.previewWidthOverride
    ? Math.min(width - 4, state.previewWidthOverride)
    : width - 4;
  const statusData = { ...activePreviewData(state), terminal_width: targetWidth };
  let rendered;

  try {
    rendered = renderStatusline(statusData, preview, { color: getActiveDepth() });
  } catch (error) {
    rendered = `Preview failed: ${error.message}`;
  }

  const layout = LAYOUTS[preview.layout]?.name ?? preview.layout;
  const style =
    preview.layout === "pills" ? ` ${dot} ${detectStyle(preview.powerline) ?? "custom"}` : "";
  const scenario = previewScenarioEntry(state);
  const scenarioTag = scenario.id !== "default" ? ` ${dot} ${scenario.label}` : "";
  const widthTag = state.previewWidthOverride ? ` ${dot} ${targetWidth} cols` : "";
  const pending = previewPending(state);
  const note = pending
    ? ` ${state.ui.accentText(`${dot} ${pending} preview, enter to apply`)}`
    : "";
  const title = `Live preview ${state.ui.muted(`${dot} ${layout} ${dot} ${preview.theme}${style}${scenarioTag}${widthTag}`)}${note}`;

  return { title, bar: String(rendered).split("\n") };
}

// One widget drawn on its own with the previewed theme and layout, for the
// details panel; a widget with nothing to show in the sample data says so.
function widgetPreview(state, widget, width) {
  let rendered = "";
  try {
    rendered = renderStatusline(
      { ...activePreviewData(state), terminal_width: width },
      { ...previewConfig(state), widgets: [widget] },
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

module.exports = {
  PREVIEW_WIDTH_STEPS,
  PREVIEW_SCENARIOS,
  previewScenarioEntry,
  activePreviewData,
  stepScenario,
  stepPreviewWidth,
  previewConfig,
  previewPending,
  previewParts,
  widgetPreview,
};
