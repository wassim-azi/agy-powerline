// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { defaultConfig, DEFAULT_THRESHOLDS, themeColors } = require("../../lib/shared");
const {
  RESET_FORMAT_ORDER,
  resolveResetFormat,
  ALIGNMENT_ORDER,
  resolveAlignment,
  OVERFLOW_ORDER,
  resolveOverflow,
  QUOTA_MODE_ORDER,
  resolveQuotaMode,
} = require("../../lib/config");
const { METER_STYLES, METER_STYLE_IDS } = require("../../lib/widget-style");
const { GRADIENTS, GRADIENT_ORDER, gradientStops } = require("../../lib/themes");
const { SUPPORTED_LANGUAGES, resolveLanguage } = require("../../lib/i18n");
const { fg, bg, mix, getActiveDepth } = require("../../lib/colors");
const { RESET, moveCursor, backToMain, persist } = require("./state");
const { dim, tabKeys, screenFrame } = require("./frame");

const LANGUAGE_LABELS = {
  en: "English (en)",
  fr: "French (fr)",
  es: "Spanish (es)",
  ja: "Japanese (ja)",
  "zh-CN": "Simplified Chinese (zh-CN)",
  ko: "Korean (ko)",
  de: "German (de)",
};

const CLOCK_FORMAT_OPTIONS = [
  { value: null, label: "auto (locale)" },
  { value: false, label: "24h" },
  { value: true, label: "12h" },
];

const THRESHOLD_PRESETS = [
  {
    id: "default",
    label: "default",
    quotaWarn: DEFAULT_THRESHOLDS.quotaWarn,
    quotaCrit: DEFAULT_THRESHOLDS.quotaCrit,
    contextWarn: DEFAULT_THRESHOLDS.contextWarn,
    contextCrit: DEFAULT_THRESHOLDS.contextCrit,
  },
  {
    id: "early",
    label: "early",
    quotaWarn: 40,
    quotaCrit: 20,
    contextWarn: 60,
    contextCrit: 80,
  },
  {
    id: "relaxed",
    label: "relaxed",
    quotaWarn: 20,
    quotaCrit: 5,
    contextWarn: 80,
    contextCrit: 95,
  },
];

const RESET_FORMAT_EXAMPLES = {
  countdown: "2hr 47m",
  time: "6:33pm",
  both: "6:33pm (2hr 47m)",
};

const MAX_WIDTH_PRESETS = [null, 100, 120, 140, 160];

const ALIGNMENT_DESCRIPTIONS = {
  left: "default (flex spaces only at Separator items)",
  center: "compact centered row inside terminal width",
  spread: "even flex gaps across rows without Separators",
};

const QUOTA_MODE_DESCRIPTIONS = {
  remaining: "72.0% rem (capacity remaining)",
  used: "28.0% used (quota consumed)",
};

const OVERFLOW_DESCRIPTIONS = {
  fit: "shrink labels, drop low-priority widgets, then truncate",
  wrap: "keep every widget and wrap overflowing ones onto new rows",
};

const SETTINGS_ROWS = [
  {
    id: "language",
    label: "Bar language",
    help: "Language used for labels, units and captions inside the statusline bar. Payload values and dates keep their own format.",
  },
  {
    id: "clockFormat",
    label: "Clock format",
    help: "Time format for Clock and exact reset times: auto follows your locale (12h in the built-in style), or force 24h or 12h.",
  },
  {
    id: "resetFormat",
    label: "Reset format",
    help: "Default format for reset timer widgets without their own Format option: countdown, exact reset time, or both.",
  },
  {
    id: "gradient",
    label: "Bar gradient",
    help: "Sweep one color gradient across each row on top of the theme. Custom hex gradients stay in the cycle until reset.",
  },
  {
    id: "meterStyle",
    label: "Meter style",
    help: "Shape used for quota and context meters across the bar. Cells applies to Pills (Lines draws dots, Classic draws blocks); per-widget Meter options still win.",
  },
  {
    id: "emojis",
    label: "Emojis",
    help: "Show icons next to widget values across the bar. Turned off automatically while ASCII mode is on.",
  },
  {
    id: "minimalist",
    label: "Minimalist mode",
    help: "Show widget values only, hiding labels and icons unless a widget sets its own Label option.",
  },
  {
    id: "pacing",
    label: "Quota pace marker",
    help: "Draw the current-time tick mark on quota meters so you can tell whether usage runs ahead of time before reset.",
  },
  {
    id: "sensitivity",
    label: "Warning sensitivity",
    help: "When quota and context widgets turn to the caution and danger colors. Per-widget warn and crit options still override this.",
  },
  {
    id: "blink",
    label: "Alert blink",
    help: "Flash critical warning widgets (below 10% quota left or above 90% context used) when your terminal supports blink.",
  },
  {
    id: "rowGap",
    label: "Space between rows",
    help: "Put a blank line between statusline rows in every layout so stacked pills don't touch and text rows get more air.",
  },
  {
    id: "maxWidth",
    label: "Max bar width",
    help: "Cap the bar width on wide terminals instead of stretching flex spaces across the entire window.",
  },
  {
    id: "alignment",
    label: "Row alignment",
    help: "How widgets sit across each row: left (default, flex spaces only at Separator items), center (compact centered bar), or spread (even gaps across unseparated rows).",
  },
  {
    id: "quotaMode",
    label: "Quota display",
    help: "Show quota bars and percentages as remaining capacity (72.0% rem) or quota consumed (28.0% used). Caution and danger colors trigger at the same usage levels in both modes.",
  },
  {
    id: "overflow",
    label: "Row overflow",
    help: "What happens when a row is wider than the terminal: fit (default, shrink labels and drop low-priority widgets) or wrap (keep every widget and break onto continuation rows).",
  },
  {
    id: "ascii",
    label: "ASCII mode",
    help: "Draw plain ASCII glyphs and boxes instead of Nerd Font caps, emojis and Unicode box-drawing characters.",
  },
];

function detectThresholdPreset(thresholds = {}) {
  const qw = thresholds.quotaWarn ?? DEFAULT_THRESHOLDS.quotaWarn;
  const qc = thresholds.quotaCrit ?? DEFAULT_THRESHOLDS.quotaCrit;
  const cw = thresholds.contextWarn ?? DEFAULT_THRESHOLDS.contextWarn;
  const cc = thresholds.contextCrit ?? DEFAULT_THRESHOLDS.contextCrit;
  return (
    THRESHOLD_PRESETS.find(
      (preset) =>
        preset.quotaWarn === qw &&
        preset.quotaCrit === qc &&
        preset.contextWarn === cw &&
        preset.contextCrit === cc
    ) ?? null
  );
}

function maxWidthValue(config) {
  if (!config.maxWidth) {
    return "full";
  }
  return MAX_WIDTH_PRESETS.includes(config.maxWidth)
    ? `${config.maxWidth} cols`
    : `${config.maxWidth} cols (custom)`;
}

function clockFormatValue(config) {
  const hour12 = typeof config.clock?.hour12 === "boolean" ? config.clock.hour12 : null;
  return CLOCK_FORMAT_OPTIONS.find((opt) => opt.value === hour12)?.label ?? "auto (locale)";
}

function gradientValue(config) {
  if (!config.gradient) {
    return "off";
  }
  return GRADIENTS[config.gradient]?.name ?? `custom (${config.gradient})`;
}

function renderMeterSample(state, styleId) {
  const ascii = state.config.ascii === true;
  const plain = getActiveDepth() === "none";
  if (ascii) {
    return "#####-----";
  }
  const colors = themeColors(state.config.theme, state.config.customTheme);
  const ok = colors.fiveHour;
  const caution = colors.caution;
  const danger = colors.warn;
  const track = colors.track;
  const paint = (color, ch) => (plain ? ch : `${fg(color)}${ch}`);
  const end = plain ? "" : RESET;

  if (!styleId) {
    return state.config.layout === "pills"
      ? `${paint(ok, "•••●•")}${paint(track, "•••••")}${end}`
      : state.config.layout === "classic"
        ? `${paint(ok, "█████░░░░░")}${end}`
        : `${paint(ok, "●●●●●")}${paint(track, "●●●●●")}${end}`;
  }
  if (styleId === "cells") {
    if (plain) {
      return "#####.....  (Pills only)";
    }
    const dark = mix(ok, [0, 0, 0], 0.45);
    return `${bg(ok)}     ${bg(dark)}     ${RESET}  ${dim(state, "Pills only")}`;
  }
  if (styleId === "ramp") {
    if (plain) {
      return "█████░░░░░";
    }
    const stops = [0, 0.25, 0.5, 0.75, 1].map((t) =>
      t <= 0.5 ? mix(ok, caution, t * 2) : mix(caution, danger, (t - 0.5) * 2)
    );
    return stops.map((c) => `${fg(c)}█`).join("") + `${fg(track)}░░░░░${RESET}`;
  }
  const [full, blank, pace] = METER_STYLES[styleId] || METER_STYLES.dots;
  if (styleId === "rings") {
    return `${paint(ok, full.repeat(5))}${paint(mix(ok, track, 0.5), blank.repeat(5))}${end}`;
  }
  if (pace) {
    return `${paint(ok, full.repeat(3))}${paint(colors.meta, pace)}${paint(ok, full)}${paint(track, blank.repeat(5))}${end}`;
  }
  return `${paint(ok, full.repeat(5))}${paint(track, blank.repeat(5))}${end}`;
}

function settingValue(config, row) {
  if (row.id === "language") {
    const code = resolveLanguage(config.language);
    return LANGUAGE_LABELS[code] || code;
  }

  if (row.id === "clockFormat") {
    return clockFormatValue(config);
  }

  if (row.id === "resetFormat") {
    return resolveResetFormat(config.resetFormat);
  }

  if (row.id === "gradient") {
    return gradientValue(config);
  }

  if (row.id === "meterStyle") {
    return config.meterStyle || "layout default";
  }

  if (row.id === "emojis") {
    return config.emojis !== false ? (config.ascii ? "on (off in ASCII)" : "on") : "off";
  }

  if (row.id === "minimalist") {
    return config.minimalist ? "on (values only)" : "off";
  }

  if (row.id === "pacing") {
    return config.pacing !== false ? "on" : "off";
  }

  if (row.id === "sensitivity") {
    return detectThresholdPreset(config.thresholds)?.label ?? "custom";
  }

  if (row.id === "blink") {
    return config.thresholds?.blink ? "on" : "off";
  }

  if (row.id === "rowGap") {
    return config.rowGap ? "on" : "off";
  }

  if (row.id === "maxWidth") {
    return maxWidthValue(config);
  }

  if (row.id === "alignment") {
    return resolveAlignment(config.alignment);
  }

  if (row.id === "quotaMode") {
    return resolveQuotaMode(config.quotaMode);
  }

  if (row.id === "overflow") {
    return resolveOverflow(config.overflow);
  }

  return config.ascii ? "on" : "off";
}

function settingsDetails(state, row) {
  if (!row) {
    return null;
  }

  const config = state.config;
  const lines = [row.help];
  if (row.id === "language") {
    const active = resolveLanguage(config.language);
    lines.push(
      "",
      ...SUPPORTED_LANGUAGES.map((code) => {
        const mark = code === active ? state.ui.glyph.on : state.ui.glyph.off;
        const label = LANGUAGE_LABELS[code] || code;
        return code === active
          ? { raw: state.ui.accentText(`${mark} ${label}`) }
          : { dim: `${mark} ${label}` };
      })
    );
  } else if (row.id === "clockFormat") {
    const active = typeof config.clock?.hour12 === "boolean" ? config.clock.hour12 : null;
    lines.push(
      "",
      ...CLOCK_FORMAT_OPTIONS.map((opt) => {
        const mark = opt.value === active ? state.ui.glyph.on : state.ui.glyph.off;
        const text = `${mark} ${opt.label}`;
        return opt.value === active ? { raw: state.ui.accentText(text) } : { dim: text };
      })
    );
  } else if (row.id === "resetFormat") {
    const active = resolveResetFormat(config.resetFormat);
    lines.push(
      "",
      ...RESET_FORMAT_ORDER.map((fmt) => {
        const mark = fmt === active ? state.ui.glyph.on : state.ui.glyph.off;
        const text = `${mark} ${fmt.padEnd(10)} ${RESET_FORMAT_EXAMPLES[fmt]}`;
        return fmt === active ? { raw: state.ui.accentText(text) } : { dim: text };
      })
    );
  } else if (row.id === "gradient") {
    const active = config.gradient || null;
    const choices = [
      { id: null, label: "off" },
      ...GRADIENT_ORDER.map((id) => ({ id, label: GRADIENTS[id].name })),
      ...(state.customGradientSpec
        ? [{ id: state.customGradientSpec, label: `custom (${state.customGradientSpec})` }]
        : []),
    ];
    lines.push(
      "",
      ...choices.map((item) => {
        const isCurrent = item.id === active;
        const mark = isCurrent ? state.ui.glyph.on : state.ui.glyph.off;
        const swatch =
          item.id && !config.ascii && getActiveDepth() !== "none"
            ? "  " + (gradientStops(item.id) || []).map((color) => `${fg(color)}■`).join("") + RESET
            : "";
        const text = `${mark} ${item.label}`;
        return isCurrent
          ? { raw: `${state.ui.accentText(text)}${swatch}` }
          : { raw: `${dim(state, text)}${swatch}` };
      })
    );
  } else if (row.id === "meterStyle") {
    const active = config.meterStyle || null;
    const choices = [
      { id: null, label: "layout default" },
      ...METER_STYLE_IDS.map((id) => ({ id, label: id })),
    ];
    lines.push(
      "",
      ...choices.map((item) => {
        const isCurrent = item.id === active;
        const mark = isCurrent ? state.ui.glyph.on : state.ui.glyph.off;
        const text = `${mark} ${item.label.padEnd(15)}`;
        const sample = renderMeterSample(state, item.id);
        return isCurrent
          ? { raw: `${state.ui.accentText(text)}  ${sample}` }
          : { raw: `${dim(state, text)}  ${sample}` };
      })
    );
  } else if (row.id === "sensitivity") {
    const thresholds = config.thresholds || {};
    const qw = thresholds.quotaWarn ?? DEFAULT_THRESHOLDS.quotaWarn;
    const qc = thresholds.quotaCrit ?? DEFAULT_THRESHOLDS.quotaCrit;
    const cw = thresholds.contextWarn ?? DEFAULT_THRESHOLDS.contextWarn;
    const cc = thresholds.contextCrit ?? DEFAULT_THRESHOLDS.contextCrit;
    const active = detectThresholdPreset(thresholds);
    lines.push(
      "",
      `Active: quota ${qw}% / ${qc}% left, context ${cw}% / ${cc}% used`,
      "",
      ...THRESHOLD_PRESETS.map((preset) => {
        const isCurrent = active?.id === preset.id;
        const mark = isCurrent ? state.ui.glyph.on : state.ui.glyph.off;
        const text = `${mark} ${preset.id.padEnd(8)} quota ${preset.quotaWarn}%/${preset.quotaCrit}%, context ${preset.contextWarn}%/${preset.contextCrit}%`;
        return isCurrent ? { raw: state.ui.accentText(text) } : { dim: text };
      }),
      ...(!active
        ? [
            {
              raw: state.ui.accentText(
                `${state.ui.glyph.on} ${"custom".padEnd(8)} quota ${qw}%/${qc}%, context ${cw}%/${cc}%`
              ),
            },
          ]
        : [])
    );
  } else if (row.id === "maxWidth") {
    const active = config.maxWidth ?? null;
    const isPreset = MAX_WIDTH_PRESETS.includes(active);
    lines.push(
      "",
      ...MAX_WIDTH_PRESETS.map((width) => {
        const isCurrent = width === active;
        const mark = isCurrent ? state.ui.glyph.on : state.ui.glyph.off;
        const label = width === null ? "full (no cap)" : `${width} cols`;
        const text = `${mark} ${label}`;
        return isCurrent ? { raw: state.ui.accentText(text) } : { dim: text };
      }),
      ...(!isPreset
        ? [{ raw: state.ui.accentText(`${state.ui.glyph.on} ${active} cols (custom)`) }]
        : [])
    );
  } else if (row.id === "alignment") {
    const active = resolveAlignment(config.alignment);
    lines.push(
      "",
      ...ALIGNMENT_ORDER.map((mode) => {
        const mark = mode === active ? state.ui.glyph.on : state.ui.glyph.off;
        const text = `${mark} ${mode.padEnd(8)} ${ALIGNMENT_DESCRIPTIONS[mode]}`;
        return mode === active ? { raw: state.ui.accentText(text) } : { dim: text };
      })
    );
  } else if (row.id === "quotaMode") {
    const active = resolveQuotaMode(config.quotaMode);
    lines.push(
      "",
      ...QUOTA_MODE_ORDER.map((mode) => {
        const mark = mode === active ? state.ui.glyph.on : state.ui.glyph.off;
        const text = `${mark} ${mode.padEnd(10)} ${QUOTA_MODE_DESCRIPTIONS[mode]}`;
        return mode === active ? { raw: state.ui.accentText(text) } : { dim: text };
      })
    );
  } else if (row.id === "overflow") {
    const active = resolveOverflow(config.overflow);
    lines.push(
      "",
      ...OVERFLOW_ORDER.map((mode) => {
        const mark = mode === active ? state.ui.glyph.on : state.ui.glyph.off;
        const text = `${mark} ${mode.padEnd(8)} ${OVERFLOW_DESCRIPTIONS[mode]}`;
        return mode === active ? { raw: state.ui.accentText(text) } : { dim: text };
      })
    );
  }
  return { title: row.label, lines };
}

function drawSettings(state) {
  const items = SETTINGS_ROWS.map((row) => ({
    text: row.label,
    value: settingValue(state.config, row),
  }));

  return screenFrame(state, {
    title: "Settings",
    items,
    notes: [
      "Enter / Space cycles or toggles; x resets to default.",
      "Bar-wide defaults that apply across layouts and presets.",
    ],
    details: settingsDetails(state, SETTINGS_ROWS[state.cursor]),
    keys: tabKeys(state, [
      [state.ui.glyph.upDown, "move"],
      ["enter", "toggle / cycle"],
      ["x", "reset"],
    ]),
  });
}

function openSettings(state) {
  state.screen = "settings";
  state.cursor = 0;
}

function toggleRowGap(state) {
  state.config.rowGap = !state.config.rowGap;
  if (persist(state)) {
    state.flashMessage = `Space between rows: ${state.config.rowGap ? "on" : "off"}`;
  }
}

function toggleOrCycleSetting(state, row) {
  const config = state.config;
  if (row.id === "language") {
    const next = SUPPORTED_LANGUAGES.indexOf(resolveLanguage(config.language)) + 1;
    config.language = SUPPORTED_LANGUAGES[next % SUPPORTED_LANGUAGES.length];
    if (persist(state)) {
      state.flashMessage = `Bar language: ${LANGUAGE_LABELS[config.language] || config.language}`;
    }
    return;
  }

  if (row.id === "clockFormat") {
    const current = typeof config.clock?.hour12 === "boolean" ? config.clock.hour12 : null;
    const idx = CLOCK_FORMAT_OPTIONS.findIndex((opt) => opt.value === current);
    const next = CLOCK_FORMAT_OPTIONS[(idx + 1) % CLOCK_FORMAT_OPTIONS.length];
    config.clock = { ...(config.clock || {}), hour12: next.value };
    if (persist(state)) {
      state.flashMessage = `Clock format: ${next.label}`;
    }
    return;
  }

  if (row.id === "resetFormat") {
    const current = resolveResetFormat(config.resetFormat);
    const next =
      RESET_FORMAT_ORDER[(RESET_FORMAT_ORDER.indexOf(current) + 1) % RESET_FORMAT_ORDER.length];
    config.resetFormat = next;
    if (persist(state)) {
      state.flashMessage = `Reset format: ${next}`;
    }
    return;
  }

  if (row.id === "gradient") {
    const choices = [
      undefined,
      ...GRADIENT_ORDER,
      ...(state.customGradientSpec ? [state.customGradientSpec] : []),
    ];
    const current = config.gradient || undefined;
    const idx = choices.indexOf(current);
    const next = choices[(idx + 1) % choices.length];
    if (next === undefined) {
      delete config.gradient;
    } else {
      config.gradient = next;
    }
    if (persist(state)) {
      state.flashMessage = `Bar gradient: ${gradientValue(config)}`;
    }
    return;
  }

  if (row.id === "meterStyle") {
    const choices = [undefined, ...METER_STYLE_IDS];
    const current = config.meterStyle || undefined;
    const idx = choices.indexOf(current);
    const next = choices[(idx + 1) % choices.length];
    if (next === undefined) {
      delete config.meterStyle;
    } else {
      config.meterStyle = next;
    }
    if (persist(state)) {
      state.flashMessage = `Meter style: ${next || "layout default"}`;
    }
    return;
  }

  if (row.id === "emojis") {
    config.emojis = config.emojis === false;
    if (persist(state)) {
      state.flashMessage = `Emojis: ${config.emojis ? "on" : "off"}`;
    }
    return;
  }

  if (row.id === "minimalist") {
    config.minimalist = !config.minimalist;
    if (persist(state)) {
      state.flashMessage = `Minimalist mode: ${config.minimalist ? "on (values only)" : "off"}`;
    }
    return;
  }

  if (row.id === "pacing") {
    config.pacing = config.pacing === false;
    if (persist(state)) {
      state.flashMessage = `Quota pace marker: ${config.pacing ? "on" : "off"}`;
    }
    return;
  }

  if (row.id === "sensitivity") {
    const current = detectThresholdPreset(config.thresholds);
    const idx = current ? THRESHOLD_PRESETS.indexOf(current) : -1;
    const next = THRESHOLD_PRESETS[(idx + 1) % THRESHOLD_PRESETS.length];
    config.thresholds = {
      ...(config.thresholds || {}),
      quotaWarn: next.quotaWarn,
      quotaCrit: next.quotaCrit,
      contextWarn: next.contextWarn,
      contextCrit: next.contextCrit,
    };
    if (persist(state)) {
      state.flashMessage = `Warning sensitivity: ${next.label}`;
    }
    return;
  }

  if (row.id === "blink") {
    config.thresholds = config.thresholds || {};
    config.thresholds.blink = !config.thresholds.blink;
    if (persist(state)) {
      state.flashMessage = `Alert blink: ${config.thresholds.blink ? "on" : "off"}`;
    }
    return;
  }

  if (row.id === "rowGap") {
    toggleRowGap(state);
    return;
  }

  if (row.id === "maxWidth") {
    const current = config.maxWidth ?? null;
    const idx = MAX_WIDTH_PRESETS.indexOf(current);
    const next = MAX_WIDTH_PRESETS[(idx + 1) % MAX_WIDTH_PRESETS.length];
    if (next === null) {
      delete config.maxWidth;
    } else {
      config.maxWidth = next;
    }
    if (persist(state)) {
      state.flashMessage = `Max bar width: ${maxWidthValue(config)}`;
    }
    return;
  }

  if (row.id === "alignment") {
    const current = resolveAlignment(config.alignment);
    const next = ALIGNMENT_ORDER[(ALIGNMENT_ORDER.indexOf(current) + 1) % ALIGNMENT_ORDER.length];
    config.alignment = next;
    if (persist(state)) {
      state.flashMessage = `Row alignment: ${next}`;
    }
    return;
  }

  if (row.id === "quotaMode") {
    const current = resolveQuotaMode(config.quotaMode);
    const next =
      QUOTA_MODE_ORDER[(QUOTA_MODE_ORDER.indexOf(current) + 1) % QUOTA_MODE_ORDER.length];
    config.quotaMode = next;
    if (persist(state)) {
      state.flashMessage = `Quota display: ${next}`;
    }
    return;
  }

  if (row.id === "overflow") {
    const current = resolveOverflow(config.overflow);
    const next = OVERFLOW_ORDER[(OVERFLOW_ORDER.indexOf(current) + 1) % OVERFLOW_ORDER.length];
    config.overflow = next;
    if (persist(state)) {
      state.flashMessage = `Row overflow: ${next}`;
    }
    return;
  }

  config.ascii = !config.ascii;
  if (persist(state)) {
    state.flashMessage = `ASCII mode: ${config.ascii ? "on" : "off"}`;
  }
}

function resetSetting(state, row) {
  const config = state.config;
  const defaults = defaultConfig();
  if (row.id === "language") {
    config.language = defaults.language;
  } else if (row.id === "clockFormat") {
    config.clock = { ...(config.clock || {}), hour12: defaults.clock.hour12 };
  } else if (row.id === "gradient") {
    delete config.gradient;
  } else if (row.id === "meterStyle") {
    delete config.meterStyle;
  } else if (row.id === "sensitivity") {
    config.thresholds = {
      ...(config.thresholds || {}),
      quotaWarn: defaults.thresholds.quotaWarn,
      quotaCrit: defaults.thresholds.quotaCrit,
      contextWarn: defaults.thresholds.contextWarn,
      contextCrit: defaults.thresholds.contextCrit,
    };
  } else if (row.id === "blink") {
    config.thresholds = config.thresholds || {};
    config.thresholds.blink = defaults.thresholds.blink;
  } else if (row.id === "maxWidth") {
    delete config.maxWidth;
  } else {
    config[row.id] = defaults[row.id];
  }
  if (persist(state)) {
    state.flashMessage = `Reset ${row.label.toLowerCase()} to default.`;
  }
}

function onSettings(state, key) {
  if (key.name === "escape") {
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, SETTINGS_ROWS.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, SETTINGS_ROWS.length);
    return;
  }

  const row = SETTINGS_ROWS[state.cursor];
  if (!row) {
    return;
  }

  if (key.name === "return" || key.name === "space") {
    toggleOrCycleSetting(state, row);
    return;
  }

  if (key.name === "x" || key.name === "delete" || key.name === "backspace") {
    resetSetting(state, row);
  }
}

module.exports = {
  SETTINGS_ROWS,
  drawSettings,
  openSettings,
  onSettings,
};
