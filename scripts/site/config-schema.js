// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// The JSON Schema for statusline.config.json, served at
// https://agy-powerline.com/schema/v1.json. Editors that read "$schema" (VS
// Code, JetBrains...) then complete and check the file. Every list in it comes
// from the code, so it can't drift: tests/shared/site.test.js also checks its
// top-level keys against the ones the bar reads.

const path = require("path");

const repo = path.join(__dirname, "..", "..");
const { VALID_WIDGET_IDS, LAYOUT_ORDER, CONFIG_SCHEMA_URL: SCHEMA_URL } = require(
  path.join(repo, "src/lib/config")
);
const { THEME_ORDER, THEME_ALIASES, GRADIENT_ORDER, COLOR_KEYS } = require(
  path.join(repo, "src/lib/themes")
);
const { COLOR_MODES } = require(path.join(repo, "src/lib/colors"));
const { METER_STYLE_IDS } = require(path.join(repo, "src/lib/widget-style"));
const { SUPPORTED_LANGUAGES } = require(path.join(repo, "src/lib/i18n"));

const DOCS = "https://agy-powerline.com/docs/configuration/";

const percent = (description) => ({ type: "number", minimum: 0, maximum: 100, description });
const color = {
  type: "string",
  description:
    "A theme color slot (model, git, meta, caution...), a basic name (blue, green...), a hex color or rgb(r, g, b).",
};
const glyphs = {
  type: "array",
  maxItems: 16,
  items: { type: "string", description: "A code point in hex (E0B4) or one character." },
};

function buildConfigSchema() {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: SCHEMA_URL,
    title: "agy-powerline statusline.config.json",
    description: `Config of the agy-powerline statusline for Google Antigravity CLI. ${DOCS}`,
    type: "object",
    additionalProperties: false,
    properties: {
      $schema: { type: "string", description: "This schema's URL, for editors." },
      agyPowerline: {
        type: "object",
        description: "Written by npx agy-powerline export: the release that wrote the file.",
        properties: { version: { type: "string" } },
      },
      theme: {
        description: "Theme id, or dark, light or colorblind.",
        enum: [...THEME_ORDER, ...Object.keys(THEME_ALIASES)],
      },
      layout: { description: "pills, lines or classic.", enum: [...LAYOUT_ORDER] },
      language: {
        description:
          "Language of the bar's own labels and units (default en). Dates follow clock.locale.",
        enum: [...SUPPORTED_LANGUAGES],
      },
      emojis: { type: "boolean", description: "Show emoji icons (default true)." },
      ascii: {
        type: "boolean",
        description: "Plain-text caps, separators and meters for terminals without a Nerd Font.",
      },
      color: { description: "Color depth.", enum: [...COLOR_MODES] },
      pacing: { type: "boolean", description: "Show the quota pace marker (default true)." },
      minimalist: { type: "boolean", description: "Values only, without icons or labels." },
      rowGap: { type: "boolean", description: "A blank line between rows." },
      log: { type: "boolean", description: "Keep the local problem log (default true)." },
      meterStyle: { description: "Meter style for every meter.", enum: [...METER_STYLE_IDS] },
      gradient: {
        type: "string",
        description: `A gradient preset (${GRADIENT_ORDER.join(", ")}), hex stops like #ff5f6d-#ffc371, or off.`,
      },
      clock: {
        type: "object",
        additionalProperties: false,
        description: "How times look, for the clock and the reset widgets.",
        properties: {
          hour12: { type: ["boolean", "null"], description: "true for 6:33pm, false for 18:33." },
          timeZone: { type: "string", description: "An IANA time zone, such as Europe/Paris." },
          locale: { type: "string", description: "A language tag, such as fr-FR." },
        },
      },
      thresholds: {
        type: "object",
        additionalProperties: false,
        description: "When quota and context widgets turn to the caution and danger colors.",
        properties: {
          quotaWarn: percent("Remaining quota % for the caution color (default 30)."),
          quotaCrit: percent("Remaining quota % for the danger color (default 10)."),
          contextWarn: percent("Used context % for the caution color (default 70)."),
          contextCrit: percent("Used context % for the danger color (default 90)."),
          blink: {
            enum: [true, false, "warn"],
            description: 'true blinks danger-level widgets; "warn" caution-level ones too.',
          },
        },
      },
      powerline: {
        type: "object",
        additionalProperties: false,
        description: "Pills layout caps and separators.",
        properties: {
          enabled: { type: "boolean" },
          separators: glyphs,
          separatorInvert: { type: "array", items: { type: "boolean" } },
          startCaps: glyphs,
          endCaps: glyphs,
        },
      },
      customTheme: {
        type: "object",
        description: 'Colors of the "custom" theme.',
        additionalProperties: false,
        properties: Object.fromEntries(COLOR_KEYS.map((key) => [key, color])),
      },
      widgets: {
        type: "array",
        description: `The widgets, in order. ${DOCS}#widgets`,
        items: { $ref: "#/definitions/widget" },
      },
    },
    definitions: {
      widget: {
        type: "object",
        required: ["id"],
        // Each widget takes its own options; the common ones are listed.
        additionalProperties: true,
        properties: {
          id: { description: "Widget id.", enum: [...VALID_WIDGET_IDS] },
          color,
          textColor: color,
          bold: { type: "boolean" },
          raw: { type: "boolean", description: "Value only, without icon or label." },
          label: { type: "string", maxLength: 20, description: "Your own name before the value." },
          icon: {
            type: "string",
            description: "Your own icon: one emoji or up to two characters.",
          },
          maxWidth: { type: "integer", minimum: 4, maximum: 200 },
          depth: { type: "integer", minimum: 1, maximum: 10, description: "cwd only." },
          warn: percent("Caution level for this widget."),
          crit: percent("Danger level for this widget."),
          blink: { enum: [true, false, "warn"] },
          showBelow: percent("Quota widgets: hide while more than this % is left."),
          showAbove: percent("Context widgets: hide while less than this % is used."),
          pace: { type: "boolean", description: "Quota meters: show the pace marker." },
          meterStyle: { enum: [...METER_STYLE_IDS] },
          format: { enum: ["countdown", "time", "both"], description: "Reset widgets." },
          short: { type: "boolean", description: "model: the short model name." },
          split: { type: "boolean", description: "Token widgets: input and output apart." },
          budget: { type: "number", minimum: 1, description: "tokensToday / tokensWeek." },
          text: { type: "string", description: "customText: the text to show." },
        },
      },
    },
  };
}

module.exports = { buildConfigSchema, SCHEMA_URL };
