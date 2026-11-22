// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { LAYOUT_ORDER } = require("../../src/lib/config");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { record } = require("../helpers");
const { SUPPORTED_LANGUAGES } = require("../../src/lib/i18n");
const {
  renderStatusline,
  defaultConfig,
  mergeConfig,
  sampleData,
  PRESETS,
  applyPreset,
  clearExecCache,
} = require("../../src/lib/shared");
const { droppedSettings } = require("../../src/lib/config-check");
const { buildConfigSchema } = require("../../scripts/site/config-schema");
const { visibleWidth, clipText } = require("../../src/lib/formatters");
const { DROP_ORDER, fitWidgets, truncateLines } = require("../../src/lib/fit");
const { WIDGET_CATALOG } = require("../../src/lib/catalog");

const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");
const widest = (text) => Math.max(...strip(text).split("\n").map(visibleWidth));

async function run() {
  const savedNoColor = process.env.NO_COLOR;
  const savedColor = process.env.AGY_POWERLINE_COLOR;
  delete process.env.NO_COLOR;
  process.env.AGY_POWERLINE_COLOR = "truecolor";
  try {
    testDropOrderCoversCatalog();
    testEveryPresetFits();
    testPresetsKeepEveryWidgetAt80();
    testFitOrder();
    testTruncation();
    testExecRunsOnce();
    testNumbers();
    testGlobalMaxWidth();
    testRowAlignment();
    testRowOverflowWrap();
  } finally {
    if (savedNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = savedNoColor;
    }
    if (savedColor === undefined) {
      delete process.env.AGY_POWERLINE_COLOR;
    } else {
      process.env.AGY_POWERLINE_COLOR = savedColor;
    }
  }
}

function testDropOrderCoversCatalog() {
  const missing = WIDGET_CATALOG.map((widget) => widget.id).filter(
    (id) => id !== "separator" && id !== "lineBreak" && !DROP_ORDER.includes(id)
  );
  record(
    "every widget has a place in the fit drop order",
    missing.length === 0,
    missing.join(", ")
  );
}

function testEveryPresetFits() {
  const longPath = "/home/user/projects/my-company/a-rather-long-project-name/src";
  const data = {
    ...sampleData(),
    cwd: longPath,
    workspace: { current_dir: longPath, project_dir: longPath },
  };
  const overflows = [];

  for (const width of [40, 60, 80, 100, 120, 160]) {
    for (const name of Object.keys(PRESETS)) {
      for (const layout of LAYOUT_ORDER) {
        for (const ascii of [false, true]) {
          const config = { ...applyPreset(defaultConfig(), name), layout, ascii };
          const out = renderStatusline({ ...data, terminal_width: width }, config);
          if (widest(out) > width) {
            overflows.push(`${name}/${layout}${ascii ? "/ascii" : ""}@${width}: ${widest(out)}`);
          }
        }
      }
    }
  }

  record(
    "every preset and layout fits terminals from 40 to 160 columns",
    overflows.length === 0,
    overflows.join(", ")
  );
}

// Every preset keeps all its widgets at 80 columns (full, the wide-screen one,
// at 100): labels may go, widgets may not, in either layout, with or without ASCII,
// in every language the bar speaks.
function testPresetsKeepEveryWidgetAt80() {
  const data = { ...sampleData(), terminal_width: 0 };
  const dropped = [];

  for (const name of Object.keys(PRESETS)) {
    for (const layout of LAYOUT_ORDER) {
      for (const [ascii, language] of SUPPORTED_LANGUAGES.flatMap((lang) => [
        [false, lang],
        [true, lang],
      ])) {
        const config = { ...applyPreset(defaultConfig(), name), layout, ascii, language };
        const measure = (row) => widest(renderStatusline(data, { ...config, widgets: row }));
        const content = (widgets) =>
          widgets.filter((w) => !["separator", "lineBreak"].includes(w.id));
        const width = name === "full" ? 100 : 80;
        const kept = content(fitWidgets(config.widgets, width, measure)).length;
        if (kept !== content(config.widgets).length) {
          dropped.push(`${name}/${layout}${ascii ? "/ascii" : ""}/${language}`);
        }
      }
    }
  }

  record(
    "every preset keeps all its widgets at 80 columns (full at 100)",
    dropped.length === 0,
    dropped.join(", ")
  );
}

function testFitOrder() {
  const config = defaultConfig();
  const wide = strip(renderStatusline({ ...sampleData(), terminal_width: 200 }, config));
  record(
    "a wide terminal shows the default bar with its labels",
    wide.includes("Reset: 2hr 47m") && wide.includes("149.3K/1.0M") && wide.includes("main")
  );

  const narrow = strip(renderStatusline({ ...sampleData(), terminal_width: 80 }, config));
  record(
    "a narrow terminal keeps every default widget as values only",
    narrow.includes("Gemini 4 Hydrogen (High)") &&
      narrow.includes("2hr 47m") &&
      narrow.includes("21.0% rem") &&
      narrow.includes("main") &&
      !narrow.includes("Reset:") &&
      !narrow.includes("🤖")
  );

  const tiny = strip(renderStatusline({ ...sampleData(), terminal_width: 40 }, config));
  record(
    "a tiny terminal shortens the model and drops reset timers and git before quotas",
    tiny.includes("4 Hydrogen·High") &&
      tiny.includes("72.0% rem") &&
      !tiny.includes("2hr 47m") &&
      !tiny.includes("main")
  );

  const unknownWidth = strip(renderStatusline({ ...sampleData(), terminal_width: 0 }, config));
  record(
    "an unknown terminal width renders everything unchanged",
    unknownWidth.includes("Reset: 2hr 47m") && unknownWidth.includes("🤖")
  );
}

function testTruncation() {
  const longModel = { ...sampleData(), model: { display_name: "Gemini ".repeat(60) } };
  for (const layout of LAYOUT_ORDER) {
    const out = renderStatusline(
      { ...longModel, terminal_width: 80 },
      { ...defaultConfig(), layout, widgets: [{ id: "model" }] }
    );
    record(
      `${layout}: a model name wider than the terminal is cut with an ellipsis`,
      widest(out) <= 80 && strip(out).trimEnd().endsWith("…")
    );
  }

  const ascii = strip(
    renderStatusline(
      { ...longModel, terminal_width: 80 },
      { ...defaultConfig(), ascii: true, widgets: [{ id: "model" }] }
    )
  );
  record(
    "ASCII mode cuts a long line with ... and stays plain ASCII",
    widest(ascii) <= 80 && ascii.trimEnd().endsWith("...") && !/[^\x00-\x7f]/.test(ascii)
  );

  const coder = "👩\u200d💻";
  const url = "https://example.invalid";
  record(
    "truncateLines keeps multi-codepoint grapheme clusters intact and closes open OSC 8 links",
    truncateLines(`${coder}${coder}`, 3) === `${coder}\x1b[0m…` &&
      truncateLines("🇫🇷🇩🇪", 3) === "🇫🇷\x1b[0m…" &&
      truncateLines("👍🏽👍🏽", 3) === "👍🏽\x1b[0m…" &&
      truncateLines("e\u0301e\u0301e\u0301", 2) === "e\u0301\x1b[0m…" &&
      truncateLines(`\x1b]8;;${url}\x07abcdef\x1b]8;;\x07`, 4) ===
        `\x1b]8;;${url}\x07abc\x1b]8;;\x07\x1b[0m…` &&
      truncateLines(`\x1b]8;;${url}\x1b\\abcdef\x1b]8;;\x1b\\`, 4) ===
        `\x1b]8;;${url}\x1b\\abc\x1b]8;;\x1b\\\x1b[0m…` &&
      truncateLines(`\x1b]8;;${url}\x07ab\x1b]8;;\x07cdef`, 4) ===
        `\x1b]8;;${url}\x07ab\x1b]8;;\x07c\x1b[0m…`
  );

  const plain = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");
  record(
    "ASCII cuts never outgrow a 1- or 2-column terminal or a 1- or 2-column clip",
    [1, 2, 3].every((w) => visibleWidth(plain(truncateLines("abcdef", w, true))) <= w) &&
      [1, 2, 3].every((w) => visibleWidth(plain(clipText("abcdef", w, true))) <= w) &&
      plain(truncateLines("abcdef", 1, true)) === "." &&
      plain(clipText("abcdef", 2, true)) === ".."
  );
}

function testExecRunsOnce() {
  clearExecCache();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-fit-"));
  const counter = path.join(dir, "runs.txt").replace(/\\/g, "/");
  const widget = {
    id: "exec",
    cmd: `node -e "require('fs').appendFileSync('${counter}', 'x'); console.log('ran')"`,
    interval: 0,
  };
  // Wider than 60 columns, so the row is drawn several times while it is fitted.
  const config = {
    ...defaultConfig(),
    widgets: [{ id: "model" }, { id: "customText", text: "x".repeat(80) }, widget],
  };

  try {
    renderStatusline({ ...sampleData(), terminal_width: 60 }, config, { exec: "run" });
    const runs = fs.existsSync(counter) ? fs.readFileSync(counter, "utf8").length : 0;
    record(
      "an exec widget runs once per refresh even while the bar is fitted",
      runs === 1,
      `${runs} runs`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    clearExecCache();
  }
}

function testNumbers() {
  const widgets = [
    "fiveHourBar",
    "fiveHourPct",
    "fiveHourReset",
    "weeklyBar",
    "weeklyReset",
    "context",
    "contextPct",
    "contextTokens",
    "artifacts",
    "totalTokens",
  ].map((id) => ({ id }));
  const render = (data) =>
    strip(renderStatusline({ ...data, terminal_width: 0 }, { ...defaultConfig(), widgets }));

  const hostile = render({
    quota: {
      "gemini-5h": { remaining_fraction: "abc", reset_in_seconds: "abc" },
      "gemini-weekly": { remaining_fraction: 1e9, reset_in_seconds: 99999999999 },
    },
    context_window: {
      used_percentage: 250,
      context_window_size: -5,
      current_usage: { input_tokens: -1, output_tokens: Number("1e400") },
    },
    artifact_count: 1e300,
  });
  record(
    "payload numbers never show NaN, negatives, more than 100% or absurd counts",
    !/NaN|Infinity|e\+|-\d/.test(hostile) &&
      !/[1-9]\d{3,}(\.\d)?%/.test(hostile) &&
      hostile.includes("100.0% rem"),
    hostile
  );
  record(
    "a quota without a usable fraction is hidden, not shown as 0%",
    !hostile.includes("⏳"),
    hostile
  );
  record(
    "a reset a year or more away is hidden instead of counting a million days",
    !/\d{4,}d/.test(hostile) && !/Reset/.test(hostile),
    hostile
  );

  const noReset = render({ quota: { "gemini-5h": { remaining_fraction: 0.5 } } });
  record(
    "a quota with no reset time hides its reset widget instead of saying now",
    noReset.includes("50.0% rem") && !/Reset|now/.test(noReset),
    noReset
  );

  const noContext = render({ model: { display_name: "m" } });
  record(
    "context widgets hide when the payload has no context window",
    !/0\/0|Context|0\.0%/.test(noContext),
    noContext
  );

  const empty = strip(
    renderStatusline(
      { terminal_width: 0 },
      {
        ...defaultConfig(),
        widgets: ["model", "cacheRead", "cacheCreate", "cacheHit"].map((id) => ({ id })),
      }
    )
  );
  record(
    "model and cache widgets hide without data instead of showing Unknown or 0",
    empty.trim() === "",
    JSON.stringify(empty)
  );

  const sizeless = render({
    context_window: { used_percentage: 12, current_usage: { input_tokens: 2000 } },
  });
  record(
    "context shows the used tokens alone while the window size is unknown",
    /2\.0K \(12\.0%\)/.test(sizeless) && !/\/0/.test(sizeless),
    sizeless
  );

  for (const layout of LAYOUT_ORDER) {
    const ram = (used) => {
      const { freemem, totalmem } = os;
      os.totalmem = () => 100;
      os.freemem = () => 100 - used;
      try {
        return renderStatusline(
          { terminal_width: 0 },
          { ...defaultConfig(), layout, widgets: [{ id: "ram" }] },
          { color: "truecolor" }
        );
      } finally {
        os.freemem = freemem;
        os.totalmem = totalmem;
      }
    };
    // dark-aurora: caution #cca700, danger #f48771.
    const cautionRgb = "2;204;167;0m";
    const dangerRgb = "2;244;135;113m";
    const [calm, caution, danger] = [50, 85, 95].map(ram);
    record(
      `${layout}: RAM turns to the caution color at 80% and the danger color at 90%`,
      !calm.includes(cautionRgb) &&
        !calm.includes(dangerRgb) &&
        caution.includes(cautionRgb) &&
        danger.includes(dangerRgb)
    );
  }
}

function testGlobalMaxWidth() {
  const data = sampleData();
  for (const layout of LAYOUT_ORDER) {
    const capped = strip(
      renderStatusline(
        { ...data, terminal_width: 220 },
        { ...defaultConfig(), layout, maxWidth: 100 }
      )
    );
    const uncapped = strip(
      renderStatusline(
        { ...data, terminal_width: 220 },
        { ...defaultConfig(), layout, maxWidth: "full" }
      )
    );
    const narrow = strip(
      renderStatusline(
        { ...data, terminal_width: 80 },
        { ...defaultConfig(), layout, maxWidth: 120 }
      )
    );
    record(
      `${layout}: global maxWidth caps ultrawide terminals without widening narrow ones`,
      widest(capped) === 100 && widest(uncapped) === 220 && widest(narrow) <= 80,
      `capped=${widest(capped)}, uncapped=${widest(uncapped)}, narrow=${widest(narrow)}`
    );
  }

  // Unknown terminal_width (0) stays unpadded even when maxWidth is configured.
  const unknownWidth = strip(
    renderStatusline({ ...data, terminal_width: 0 }, { ...defaultConfig(), maxWidth: 160 })
  );
  record(
    "global maxWidth does not pad rows when terminal_width is unknown (0)",
    widest(unknownWidth) < 120,
    `widest=${widest(unknownWidth)}`
  );

  // Validation in mergeConfig, droppedSettings, and JSON Schema.
  record(
    "mergeConfig validates maxWidth and treats full/null/invalid as uncapped",
    mergeConfig({ maxWidth: 120 }).maxWidth === 120 &&
      mergeConfig({ maxWidth: 2000 }).maxWidth === 1000 &&
      mergeConfig({ maxWidth: "full" }).maxWidth === undefined &&
      mergeConfig({ maxWidth: null }).maxWidth === undefined &&
      mergeConfig({ maxWidth: 0 }).maxWidth === undefined &&
      mergeConfig({ maxWidth: -5 }).maxWidth === undefined &&
      mergeConfig({ maxWidth: 12.5 }).maxWidth === undefined &&
      mergeConfig({ maxWidth: "120" }).maxWidth === undefined
  );

  record(
    "config-check and config schema accept valid maxWidth values and flag invalid ones",
    droppedSettings({ maxWidth: 120 }).length === 0 &&
      droppedSettings({ maxWidth: "full" }).length === 0 &&
      droppedSettings({ maxWidth: null }).length === 0 &&
      droppedSettings({ maxWidth: 0 }).some((msg) => msg.includes("invalid maxWidth")) &&
      Array.isArray(buildConfigSchema().properties.maxWidth?.oneOf)
  );
}

function testRowAlignment() {
  const data = sampleData();
  const unseparated = [{ id: "model" }, { id: "context" }, { id: "git" }];

  for (const layout of LAYOUT_ORDER) {
    const left = strip(
      renderStatusline(
        { ...data, terminal_width: 120 },
        { ...defaultConfig(), layout, widgets: unseparated, alignment: "left" }
      )
    );
    const center = strip(
      renderStatusline(
        { ...data, terminal_width: 120 },
        { ...defaultConfig(), layout, widgets: unseparated, alignment: "center" }
      )
    );
    const spread = strip(
      renderStatusline(
        { ...data, terminal_width: 120 },
        { ...defaultConfig(), layout, widgets: unseparated, alignment: "spread" }
      )
    );

    const expectedPad = Math.floor((120 - visibleWidth(left)) / 2);
    const actualPad = center.match(/^ */)[0].length;
    record(
      `${layout}: alignment "center" centers compact rows and "spread" spans full width without separators`,
      !left.startsWith(" ") &&
        actualPad === expectedPad &&
        center.trimStart() === left &&
        visibleWidth(spread) === 120,
      `leftWidth=${visibleWidth(left)}, expectedPad=${expectedPad}, actualPad=${actualPad}, spreadWidth=${visibleWidth(spread)}`
    );

    // Separated preset rows stay compact & centered when alignment === "center",
    // and narrow terminals still shrink/truncate to fit within terminal_width.
    const defaultCentered = strip(
      renderStatusline(
        { ...data, terminal_width: 120 },
        { ...defaultConfig(), layout, alignment: "center" }
      )
    );
    const narrowCentered = strip(
      renderStatusline(
        { ...data, terminal_width: 45 },
        { ...defaultConfig(), layout, alignment: "center" }
      )
    );
    const narrowSpread = strip(
      renderStatusline(
        { ...data, terminal_width: 45 },
        { ...defaultConfig(), layout, widgets: unseparated, alignment: "spread" }
      )
    );
    record(
      `${layout}: alignment "center" compacts separated rows and "center"/"spread" fit within narrow terminals`,
      defaultCentered
        .split("\n")
        .every((line) => line.startsWith(" ") && visibleWidth(line) < 120) &&
        widest(narrowCentered) <= 45 &&
        widest(narrowSpread) <= 45,
      `narrowCenter=${widest(narrowCentered)}, narrowSpread=${widest(narrowSpread)}`
    );
  }

  // Unknown terminal_width (0) leaves "center" unpadded instead of negative or wide padding.
  const unknownWidth = strip(
    renderStatusline(
      { ...data, terminal_width: 0 },
      { ...defaultConfig(), widgets: unseparated, alignment: "center" }
    )
  );
  record(
    'alignment "center" does not pad when terminal_width is unknown (0)',
    !unknownWidth.startsWith(" ")
  );

  // Validation across mergeConfig, droppedSettings, and JSON Schema.
  record(
    "config, config-check, and schema validate alignment values",
    mergeConfig({}).alignment === "left" &&
      mergeConfig({ alignment: "center" }).alignment === "center" &&
      mergeConfig({ alignment: "spread" }).alignment === "spread" &&
      mergeConfig({ alignment: "bogus" }).alignment === "left" &&
      droppedSettings({ alignment: "center" }).length === 0 &&
      droppedSettings({ alignment: "bogus" }).some((msg) => msg.includes("unknown alignment")) &&
      JSON.stringify(buildConfigSchema().properties.alignment?.enum) ===
        JSON.stringify(["left", "center", "spread"])
  );
}

function testRowOverflowWrap() {
  const data = sampleData();
  const oneRowWidgets = [
    { id: "model" },
    { id: "context" },
    { id: "git" },
    { id: "fiveHourBar" },
    { id: "fiveHourReset" },
    { id: "customText", text: "KeepMeVisible" },
  ];

  for (const layout of LAYOUT_ORDER) {
    // At 65 columns, "fit" strips labels and drops low-priority widgets (customText),
    // while "wrap" keeps every widget with its labels across continuation rows.
    const fitted = strip(
      renderStatusline(
        { ...data, terminal_width: 65 },
        { ...defaultConfig(), layout, widgets: oneRowWidgets, overflow: "fit" }
      )
    );
    const wrapped = strip(
      renderStatusline(
        { ...data, terminal_width: 65 },
        { ...defaultConfig(), layout, widgets: oneRowWidgets, overflow: "wrap" }
      )
    );
    const wrappedLines = wrapped.split("\n");
    record(
      `${layout}: overflow "wrap" keeps all widgets and labels across continuation lines within terminal_width`,
      !fitted.includes("KeepMeVisible") &&
        fitted.split("\n").length === 1 &&
        wrappedLines.length >= 2 &&
        widest(wrapped) <= 65 &&
        wrapped.includes("Gemini 4 Hydrogen (High)") &&
        wrapped.includes("149.3K/1.0M") &&
        wrapped.includes("main") &&
        wrapped.includes("72.0% rem") &&
        wrapped.includes("Reset: 2hr 47m") &&
        wrapped.includes("KeepMeVisible"),
      `lines=${wrappedLines.length}, widest=${widest(wrapped)}`
    );

    // Every preset fits within narrow widths (45 and 70 columns) under overflow: "wrap".
    const presetOverflows = [];
    for (const width of [45, 70]) {
      for (const name of Object.keys(PRESETS)) {
        const out = renderStatusline(
          { ...data, terminal_width: width },
          { ...applyPreset(defaultConfig(), name), layout, overflow: "wrap" }
        );
        if (widest(out) > width) {
          presetOverflows.push(`${name}@${width}:${widest(out)}`);
        }
      }
    }
    record(
      `${layout}: every preset stays within 45 and 70 columns with overflow "wrap"`,
      presetOverflows.length === 0,
      presetOverflows.join(", ")
    );
  }

  // Separator-delimited groups stay together on their continuation row when a group fits.
  const pairedQuotas = [
    { id: "fiveHourBar" },
    { id: "fiveHourReset" },
    { id: "separator" },
    { id: "weeklyBar" },
    { id: "weeklyReset" },
  ];
  const wrappedPairs = strip(
    renderStatusline(
      { ...data, terminal_width: 60 },
      { ...defaultConfig(), widgets: pairedQuotas, overflow: "wrap" }
    )
  ).split("\n");
  record(
    'overflow "wrap" keeps separator-delimited widget groups together when the group fits on a continuation line',
    wrappedPairs.length === 2 &&
      wrappedPairs[0].includes("72.0% rem") &&
      wrappedPairs[0].includes("2hr 47m") &&
      wrappedPairs[1].includes("21.0% rem") &&
      wrappedPairs[1].includes("1d 17h"),
    JSON.stringify(wrappedPairs)
  );

  // An individual segment wider than terminal_width is truncated on its own line while
  // subsequent widgets wrap cleanly onto the next line.
  const longModelData = { ...data, model: { display_name: "Gemini ".repeat(30) } };
  const oversizedWrap = strip(
    renderStatusline(
      { ...longModelData, terminal_width: 50 },
      {
        ...defaultConfig(),
        widgets: [{ id: "model" }, { id: "git" }],
        overflow: "wrap",
      }
    )
  ).split("\n");
  record(
    'overflow "wrap" truncates a single oversized widget and wraps the next widget onto a new line',
    oversizedWrap.length === 2 &&
      visibleWidth(oversizedWrap[0]) <= 50 &&
      oversizedWrap[0].trimEnd().endsWith("…") &&
      oversizedWrap[1].includes("main"),
    JSON.stringify(oversizedWrap)
  );

  // Validation across mergeConfig, droppedSettings, and JSON Schema.
  record(
    "config, config-check, and schema validate overflow values",
    mergeConfig({}).overflow === "fit" &&
      mergeConfig({ overflow: "wrap" }).overflow === "wrap" &&
      mergeConfig({ overflow: "fit" }).overflow === "fit" &&
      mergeConfig({ overflow: "bogus" }).overflow === "fit" &&
      droppedSettings({ overflow: "wrap" }).length === 0 &&
      droppedSettings({ overflow: "bogus" }).some((msg) => msg.includes("unknown overflow")) &&
      JSON.stringify(buildConfigSchema().properties.overflow?.enum) ===
        JSON.stringify(["fit", "wrap"])
  );
}

module.exports = { run };
