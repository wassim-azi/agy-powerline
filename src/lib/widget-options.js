// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const {
  resolveQuotaThresholds,
  resolveContextThresholds,
  isValidDepth,
  isValidMaxWidth,
} = require("./formatters");
const {
  METER_STYLE_IDS,
  QUOTA_WIDGETS,
  CONTEXT_WIDGETS,
  RESET_WIDGETS,
  isVisibilityThreshold,
  WIDGET_TAGS,
  LABEL_MAX,
} = require("./widget-style");

// Widgets that take each option, as the layouts read them.
const PACED_WIDGETS = new Set([
  "fiveHourBar",
  "weeklyBar",
  "thirdPartyFiveHour",
  "thirdPartyWeekly",
  "argonWeekly",
]);
const METER_WIDGETS = new Set([...PACED_WIDGETS, "context"]);
const MAX_WIDTH_WIDGETS = new Set([
  "cwd",
  "project",
  "git",
  "title",
  "model",
  "customText",
  "exec",
  "gitWorktree",
]);
const COLOR_SLOTS = ["model", "context", "git", "weekly", "thirdParty", "fiveHour", "meta"];

const onOff = (value) => (value ? "on" : "off");

// The options of one widget: cycle fields step through values, number fields
// step by 5 with the arrows, text fields take typing, and fixed ones only show
// their value. undefined means "not set": the widget follows the global
// setting or its default.
function editFields(widget, config = {}, options = {}) {
  const quota = QUOTA_WIDGETS.has(widget.id);
  const context = CONTEXT_WIDGETS.has(widget.id);
  const thresholds = quota
    ? resolveQuotaThresholds({}, config)
    : context
      ? resolveContextThresholds({}, config)
      : null;

  const colorShow = options.colorName
    ? options.colorName
    : (value) => (value === undefined ? "theme default" : String(value));

  const fields = [
    {
      key: "color",
      label: "Color",
      values: [undefined, ...COLOR_SLOTS],
      show: colorShow,
      help: "Draws this widget in another of the theme's colors. Caution and danger colors still take over when a quota or the context runs low.",
    },
    {
      key: "raw",
      label: "Label",
      values: [undefined, false, true],
      show: (value) =>
        value === undefined
          ? `default (${config.minimalist ? "hidden" : "shown"})`
          : value
            ? "hidden, value only"
            : "shown",
      help: "Shows or hides the icon and label before the value. Default follows minimalist mode (m).",
    },
  ];

  // exec and customText have their own text options.
  const tag = WIDGET_TAGS[widget.id];
  if (tag && widget.id !== "exec" && widget.id !== "customText") {
    fields.push(
      {
        key: "label",
        label: "Label text",
        text: true,
        maxLength: LABEL_MAX,
        show: (value) =>
          typeof value === "string" ? value || "(none)" : `default (${tag.name || "none"})`,
        help: `Your own name before the value, up to ${LABEL_MAX} columns. Enter to type, Enter again to keep it; empty or x goes back to the default.`,
      },
      {
        key: "icon",
        label: "Icon",
        text: true,
        maxLength: 4,
        // ASCII mode and emojis off draw no icons, so none is shown here.
        show: (value) =>
          config.ascii || config.emojis === false
            ? "(icons are off)"
            : typeof value === "string"
              ? value || "(none)"
              : `default (${tag.icon})`,
        help: "Your own icon: one emoji or up to two characters. Enter to type, Enter again to keep it; empty or x goes back to the default.",
      }
    );
  }

  if (widget.id === "model") {
    fields.push({
      key: "short",
      label: "Short name",
      values: [undefined, true],
      show: (value) => onOff(value),
      help: "3.8 Flash·High instead of Gemini 3.8 Flash (High).",
    });
  }
  if (widget.id === "totalTokens") {
    fields.push({
      key: "split",
      label: "Split",
      values: [undefined, true],
      show: (value) => onOff(value),
      help: "Input and output tokens apart (123.1K↑ 355.0K↓) instead of one total.",
    });
  }
  if (RESET_WIDGETS.has(widget.id)) {
    fields.push({
      key: "format",
      label: "Format",
      values: [undefined, "time", "both"],
      show: (value) => value ?? "countdown",
      help: "countdown (2hr 47m), time (6:33pm) or both (6:33pm (2hr 47m)).",
    });
  }
  if (widget.id === "customText") {
    fields.push({
      key: "text",
      label: "Text",
      text: true,
      show: (value) => value || "(empty: hidden)",
      help: "The badge's text. Enter to type, Enter again to keep it, Esc to cancel.",
    });
  }
  if (widget.id === "exec") {
    const isFixed = !options.editableCmd;
    fields.push({
      key: "cmd",
      label: "Command",
      fixed: isFixed,
      text: !isFixed,
      show: (value) => value || "(none)",
      help: options.cmdHelp
        ? options.cmdHelp
        : "The command runs only in agy, from your install folder.",
    });
    fields.push(
      {
        key: "payload",
        label: "Session JSON",
        values: [undefined, true],
        show: (value) => onOff(value),
        help: "Sends the session JSON to the command on stdin, without your email or session IDs.",
      },
      {
        key: "colors",
        label: "Keep colors",
        values: [undefined, true],
        show: (value) => onOff(value),
        help: "Keeps the colors the command prints; other escape sequences are still removed.",
      }
    );
  }
  if (widget.id === "cwd") {
    fields.push({
      key: "depth",
      label: "Folder depth",
      values: [undefined, 1, 2, 3, 4],
      show: (value) =>
        !isValidDepth(value) ? "full path" : `${value} folder${value === 1 ? "" : "s"}`,
      help: "Keeps the root and last folders, replacing the middle with an ellipsis.",
    });
  }
  if (MAX_WIDTH_WIDGETS.has(widget.id)) {
    fields.push({
      key: "maxWidth",
      label: "Max width",
      number: 10,
      step: 5,
      min: 10,
      max: 80,
      show: (value) => (isValidMaxWidth(value) ? `${value} columns` : "no limit"),
      help:
        widget.id === "title"
          ? "Limits the title, replacing its default 30-column limit."
          : "Limits the displayed value; the icon and label stay the same.",
    });
  }
  if (thresholds) {
    const what = quota ? "left" : "used";
    fields.push(
      {
        key: "warn",
        label: "Caution at",
        number: thresholds.warn,
        show: (value) => (value === undefined ? `default (${thresholds.warn}%)` : `${value}%`),
        help: `Turns to the caution color at this share ${what}.`,
      },
      {
        key: "crit",
        label: "Danger at",
        number: thresholds.crit,
        show: (value) => (value === undefined ? `default (${thresholds.crit}%)` : `${value}%`),
        help: `Turns to the danger color at this share ${what}.`,
      },
      {
        key: "blink",
        label: "Blink",
        values: [undefined, true, "warn", false],
        show: (value) =>
          value === undefined
            ? `default (${thresholds.blink ? "on" : "off"})`
            : { true: "at danger", warn: "at caution and danger", false: "off" }[String(value)],
        help: "Makes the widget blink when it reaches the danger (or caution) level. ASCII mode never blinks.",
      }
    );
  }
  if (QUOTA_WIDGETS.has(widget.id) || RESET_WIDGETS.has(widget.id)) {
    fields.push({
      key: "showBelow",
      label: "Show below",
      number: 50,
      show: (value) => (isVisibilityThreshold(value) ? `${value}%` : "always"),
      help: "Shows the widget only when this share or less is left.",
    });
  }
  if (context) {
    fields.push({
      key: "showAbove",
      label: "Show above",
      number: 50,
      show: (value) => (isVisibilityThreshold(value) ? `${value}%` : "always"),
      help: "Shows the widget only when this share or more is used.",
    });
  }
  if (METER_WIDGETS.has(widget.id)) {
    fields.push({
      key: "meter",
      label: "Meter",
      values: [undefined, ...METER_STYLE_IDS],
      show: (value) => value ?? "theme default",
      help: "Meter style; ASCII mode always uses # and -",
    });
  }
  if (PACED_WIDGETS.has(widget.id)) {
    fields.push({
      key: "pace",
      label: "Pace marker",
      values: [undefined, false, true],
      show: (value) =>
        value === undefined ? `default (${onOff(config.pacing !== false)})` : onOff(value),
      help: "Marks where usage would be if it were spread evenly over the window. Default follows r.",
    });
  }
  return fields;
}

function stepNumberField(field, current, direction) {
  const from = Number.isFinite(current) ? current : field.number;
  const min = Number.isFinite(field.min) ? field.min : 0;
  const max = Number.isFinite(field.max) ? field.max : 100;
  const step = Number.isFinite(field.step) ? field.step : 5;
  return Math.max(min, Math.min(max, from + direction * step));
}

module.exports = {
  QUOTA_WIDGETS,
  PACED_WIDGETS,
  CONTEXT_WIDGETS,
  METER_WIDGETS,
  RESET_WIDGETS,
  MAX_WIDTH_WIDGETS,
  COLOR_SLOTS,
  editFields,
  stepNumberField,
};
