// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { defaultConfig, canonicalThemeId, LAYOUTS } = require("./shared");
const { THEMES, normalizeGradient } = require("./themes");
const {
  VALID_WIDGET_IDS,
  RESET_FORMAT_ORDER,
  ALIGNMENT_ORDER,
  OVERFLOW_ORDER,
  QUOTA_MODE_ORDER,
  resolveBarMaxWidth,
} = require("./config");
const { COLOR_MODES } = require("./colors");
const { isMeterStyle } = require("./widget-style");

const KNOWN_KEYS = new Set([
  ...Object.keys(defaultConfig()),
  "$schema",
  "customTheme",
  "gradient",
  "meterStyle",
  "maxWidth",
]);

// Control characters shown as \uXXXX: the text is printed, never interpreted
// by the terminal or the browser.
function visible(text) {
  return String(text).replace(
    /[\x00-\x1f\x7f-\x9f\u2028\u2029\u202A-\u202E\u2066-\u2069]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}

// Settings the raw config has that the bar can't use, so they don't come over
// on import or in the web configurator.
function droppedSettings(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return ["config is not an object"];
  }

  const dropped = [];
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
      dropped.push(`unknown setting "${visible(key)}"`);
    }
  }
  if (Array.isArray(raw.widgets)) {
    for (const widget of raw.widgets) {
      if (!widget || typeof widget !== "object" || !VALID_WIDGET_IDS.has(widget.id)) {
        dropped.push(`unknown widget ${visible(JSON.stringify(widget?.id ?? widget) ?? "")}`);
      }
    }
  } else if (raw.widgets !== undefined) {
    dropped.push("widgets (not a list)");
  }
  if (raw.theme !== undefined && !THEMES[canonicalThemeId(raw.theme)]) {
    dropped.push(`unknown theme ${visible(JSON.stringify(raw.theme))}`);
  }
  if (raw.layout !== undefined && !LAYOUTS[raw.layout]) {
    dropped.push(`unknown layout ${visible(JSON.stringify(raw.layout))}`);
  }
  if (raw.color !== undefined && !COLOR_MODES.includes(raw.color)) {
    dropped.push(`unknown color mode ${visible(JSON.stringify(raw.color))}`);
  }
  if (
    raw.gradient !== undefined &&
    raw.gradient !== null &&
    raw.gradient !== "off" &&
    !normalizeGradient(raw.gradient)
  ) {
    dropped.push(`invalid gradient ${visible(JSON.stringify(raw.gradient))}`);
  }
  if (raw.meterStyle !== undefined && !isMeterStyle(raw.meterStyle)) {
    dropped.push(`unknown meter style ${visible(JSON.stringify(raw.meterStyle))}`);
  }
  if (raw.resetFormat !== undefined && !RESET_FORMAT_ORDER.includes(raw.resetFormat)) {
    dropped.push(`unknown reset format ${visible(JSON.stringify(raw.resetFormat))}`);
  }
  if (raw.quotaMode !== undefined && !QUOTA_MODE_ORDER.includes(raw.quotaMode)) {
    dropped.push(`unknown quota mode ${visible(JSON.stringify(raw.quotaMode))}`);
  }
  if (raw.alignment !== undefined && !ALIGNMENT_ORDER.includes(raw.alignment)) {
    dropped.push(`unknown alignment ${visible(JSON.stringify(raw.alignment))}`);
  }
  if (raw.overflow !== undefined && !OVERFLOW_ORDER.includes(raw.overflow)) {
    dropped.push(`unknown overflow ${visible(JSON.stringify(raw.overflow))}`);
  }
  if (
    raw.maxWidth !== undefined &&
    raw.maxWidth !== null &&
    raw.maxWidth !== "full" &&
    resolveBarMaxWidth(raw.maxWidth) === null
  ) {
    dropped.push(`invalid maxWidth ${visible(JSON.stringify(raw.maxWidth))}`);
  }
  return dropped;
}

module.exports = {
  KNOWN_KEYS,
  visible,
  droppedSettings,
};
