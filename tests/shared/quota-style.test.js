// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { record, stripAnsi, PAYLOAD } = require("../helpers");
const { renderStatusline, defaultConfig, mergeConfig } = require("../../src/lib/shared");
const {
  visibleWidth,
  normalizeClock,
  formatClockTime,
  formatPaceDelta,
  formatQuotaForecast,
} = require("../../src/lib/formatters");
const { editFields } = require("../../src/lib/widget-options");
const { droppedSettings } = require("../../src/lib/config-check");
const { buildConfigSchema } = require("../../scripts/site/config-schema");
const { resolveColor } = require("../../src/lib/widget-style");

const RESET_AT = "2026-10-08T18:33:00Z";

// 5h quota with 2h47m left (44% of the window gone) and a weekly quota with
// 1d17h left (76% gone), at fixed reset times so exact times are stable.
function payload(overrides = {}) {
  const data = JSON.parse(PAYLOAD);
  data.terminal_width = 200;
  data.quota = {
    "gemini-5h": {
      remaining_fraction: 0.72,
      reset_time: RESET_AT,
      reset_in_seconds: 2 * 3600 + 47 * 60,
    },
    "gemini-weekly": {
      remaining_fraction: 0.21,
      reset_time: "2026-10-10T14:50:00Z",
      reset_in_seconds: 86400 + 17 * 3600,
    },
  };
  return { ...data, ...overrides };
}

// Caps off so trimmed text compares cleanly.
const NO_CAPS = { ...defaultConfig().powerline, startCaps: [], endCaps: [] };

function plain(config, data = payload(), overrides = {}) {
  return stripAnsi(
    renderStatusline(
      data,
      { ...defaultConfig(), powerline: NO_CAPS, ...config },
      { env: {}, ...overrides }
    )
  );
}

function colored(config, data = payload()) {
  return renderStatusline(data, { ...defaultConfig(), ...config }, { color: "truecolor", env: {} });
}

// 5h: 28% used, 44% of the window gone -> 16 points behind. Weekly: 79% used,
// 76% gone -> 3 points ahead.
function testPaceDelta() {
  const on = (id, extra = {}) => [{ id, paceDelta: true, ...extra }];
  const layouts = ["pills", "lines", "classic"];

  record(
    "the pace delta is off unless the widget asks for it",
    layouts.every(
      (layout) =>
        !/[⇡⇣]/.test(
          plain({ layout, widgets: [{ id: "fiveHourPct" }, { id: "weeklyPct" }, { id: "quota" }] })
        )
    )
  );
  record(
    "fiveHourPct shows the headroom behind an even pace in every layout",
    layouts.every((layout) =>
      plain({ layout, widgets: on("fiveHourPct") }).includes("72.0% rem ⇣16%")
    )
  );
  record(
    "weeklyPct shows how far ahead of an even pace it is in every layout",
    layouts.every((layout) => plain({ layout, widgets: on("weeklyPct") }).includes("21.0% rem ⇡3%"))
  );
  record(
    "quota puts the delta of the tightest quota before its reset",
    layouts.every((layout) => /21\.0% rem ⇡3% · /.test(plain({ layout, widgets: on("quota") })))
  );
  record(
    "ASCII mode draws the arrows as ^ and v",
    plain({ ascii: true, widgets: on("fiveHourPct") }).includes("72.0% rem v16%") &&
      plain({ ascii: true, layout: "lines", widgets: on("weeklyPct") }).includes("21.0% rem ^3%")
  );
  record(
    "the delta follows neither pacing nor pace, and only true turns it on",
    plain({ pacing: false, widgets: on("fiveHourPct", { pace: false }) }).includes("⇣16%") &&
      !/[⇡⇣]/.test(plain({ widgets: [{ id: "fiveHourPct", paceDelta: "yes" }] }))
  );
  record(
    "the meters, which carry the marker, take no delta",
    !/[⇡⇣]/.test(plain({ widgets: on("fiveHourBar") }))
  );

  const onPace = payload();
  onPace.quota["gemini-5h"].remaining_fraction = 0.557;
  const unknown = payload();
  unknown.quota["gemini-5h"].reset_in_seconds = 9 * 3600;
  record(
    "nothing is added on pace, or when the window length is unknown",
    plain({ widgets: on("fiveHourPct") }, onPace)
      .trim()
      .endsWith("55.7% rem") &&
      plain({ widgets: on("fiveHourPct") }, unknown)
        .trim()
        .endsWith("72.0% rem")
  );
  record(
    "formatPaceDelta ignores a quota without numbers",
    formatPaceDelta(null) === "" &&
      formatPaceDelta({ remaining: 50, elapsedPct: null }) === "" &&
      formatPaceDelta({ remaining: "x", elapsedPct: 10 }) === "" &&
      formatPaceDelta({ remaining: 0, elapsedPct: 0 }) === "⇡100%" &&
      formatPaceDelta({ remaining: 100, elapsedPct: 100 }, true) === "v100%"
  );

  // Too narrow for both widgets with their deltas: the deltas go, the widgets stay.
  const narrow = payload({ terminal_width: 26 });
  const fitted = plain({ widgets: [...on("fiveHourPct"), ...on("weeklyPct")] }, narrow);
  record(
    "a row too wide for the terminal loses the delta before a widget",
    fitted.includes("72.0%") && fitted.includes("21.0%") && !/[⇡⇣]/.test(fitted),
    fitted
  );

  const fields = (id) => editFields({ id }, defaultConfig()).map((field) => field.key);
  record(
    "configure offers the pace delta on the three percentage widgets only",
    ["fiveHourPct", "weeklyPct", "quota"].every((id) => fields(id).includes("paceDelta")) &&
      !fields("fiveHourBar").includes("paceDelta") &&
      !fields("contextPct").includes("paceDelta")
  );
  record(
    "the config schema knows paceDelta",
    buildConfigSchema().definitions.widget.properties.paceDelta?.type === "boolean"
  );
}

function testPacing() {
  const bar = [{ id: "fiveHourBar" }];

  record(
    "the 5h bar marks how much of the window has passed (44% -> cell 6 of 12)",
    plain({ ascii: true, widgets: bar }).includes("[     |      ]")
  );
  record(
    "the weekly bar marks its own window (76% -> cell 10 of 12)",
    plain({ ascii: true, widgets: [{ id: "weeklyBar" }] }).includes("[         |  ]")
  );
  record(
    "the default dotted meter draws the marker as a larger dot, cells as a heavy bar",
    plain({ widgets: bar }).includes("•••••●••••••") &&
      plain({ meterStyle: "cells", widgets: bar }).includes("┃")
  );
  record(
    "pacing: false hides every marker",
    !plain({ ascii: true, pacing: false, widgets: bar }).includes("|")
  );
  record(
    "a widget can opt out (pace: false) or back in (pace: true)",
    !plain({ ascii: true, widgets: [{ id: "fiveHourBar", pace: false }] }).includes("|") &&
      plain({ ascii: true, pacing: false, widgets: [{ id: "fiveHourBar", pace: true }] }).includes(
        "|"
      )
  );

  const unknown = payload();
  unknown.quota["gemini-5h"].reset_in_seconds = 9 * 3600;
  record(
    "no marker when the reset is further out than the window",
    !plain({ ascii: true, widgets: bar }, unknown).includes("|")
  );

  const lines = plain({ layout: "lines", ascii: true, widgets: bar });
  record(
    "the Lines dot meter gets the marker too, and stays 25 cells wide",
    /#{7}-{4}\|-{13}/.test(lines),
    lines.trim()
  );
}

function testResetTimes() {
  const utc = { timeZone: "UTC" };
  const reset = (format, clock = utc, id = "fiveHourReset") =>
    plain({ clock, emojis: false, widgets: [{ id, format }] }).trim();

  record("Pills reset widgets still default to the countdown", reset() === "Reset: 2hr 47m");
  record('format "time" shows the reset time', reset("time") === "Reset: 6:33pm");
  record('format "both" shows time and countdown', reset("both") === "Reset: 6:33pm (2hr 47m)");
  record(
    "weekly resets add the date",
    reset("time", utc, "weeklyReset") === "Reset: oct 10, 2:50pm"
  );
  record(
    "hour12: false gives 24-hour times",
    reset("time", { ...utc, hour12: false }) === "Reset: 18:33"
  );
  record(
    "timeZone converts the reset time",
    reset("time", { timeZone: "Asia/Tokyo", hour12: false }) === "Reset: 03:33"
  );
  record(
    "a locale formats times its own way unless hour12 is set",
    reset("time", { ...utc, locale: "de-DE" }) === "Reset: 18:33" &&
      /^Reset: 6:33\sPM$/.test(reset("time", { ...utc, locale: "en-US" })) &&
      /^Reset: 0?6:33\sPM$/.test(reset("time", { ...utc, locale: "de-DE", hour12: true }))
  );
  record(
    "both layouts show a countdown by default",
    ["lines", "pills"].every((layout) =>
      / Reset: \d+hr \d+m/.test(plain({ layout, clock: utc, widgets: [{ id: "fiveHourReset" }] }))
    )
  );

  // Global resetFormat fallback and per-widget format override precedence.
  const resetPayload = payload({
    quota: {
      ...payload().quota,
      "gemini-argon-wtu-weekly": {
        remaining_fraction: 0.5,
        reset_time: "2026-10-12T20:00:00Z",
        reset_in_seconds: 3 * 86400,
      },
    },
  });
  for (const layout of ["pills", "lines"]) {
    const globalTime = plain(
      {
        layout,
        clock: utc,
        emojis: false,
        resetFormat: "time",
        widgets: [{ id: "fiveHourReset" }, { id: "weeklyReset" }, { id: "argonReset" }],
      },
      resetPayload
    );
    const override = plain(
      {
        layout,
        clock: utc,
        emojis: false,
        resetFormat: "both",
        widgets: [{ id: "fiveHourReset", format: "countdown" }, { id: "weeklyReset" }],
      },
      resetPayload
    );
    record(
      `${layout}: global resetFormat sets default for reset widgets and per-widget format overrides it`,
      /Reset: 6:33pm/.test(globalTime) &&
        /Reset: oct 10, 2:50pm/.test(globalTime) &&
        /Argon reset: oct 12, 8:00pm/.test(globalTime) &&
        /Reset: 2hr 47m/.test(override) &&
        !/6:33pm \(2hr 47m\)/.test(override) &&
        /Reset: oct 10, 2:50pm \(1d 17h\)/.test(override)
    );
  }

  const fmtField = editFields({ id: "fiveHourReset" }, { resetFormat: "time" }).find(
    (f) => f.key === "format"
  );
  record(
    "mergeConfig, config-check, schema and widget options support global resetFormat",
    defaultConfig().resetFormat === "countdown" &&
      mergeConfig({ resetFormat: "both" }).resetFormat === "both" &&
      mergeConfig({ resetFormat: "bogus" }).resetFormat === "countdown" &&
      droppedSettings({ resetFormat: "time" }).length === 0 &&
      droppedSettings({ resetFormat: "bogus" }).some((m) => m.includes("unknown reset format")) &&
      JSON.stringify(buildConfigSchema().properties.resetFormat?.enum) ===
        JSON.stringify(["countdown", "time", "both"]) &&
      fmtField?.values.includes("countdown") &&
      fmtField?.show(undefined) === "time (default)"
  );

  const noTime = payload();
  delete noTime.quota["gemini-5h"].reset_time;
  noTime.quota["gemini-5h"].reset_in_seconds = 0;
  record(
    "without a usable reset time the widget falls back to the countdown",
    plain({ emojis: false, widgets: [{ id: "fiveHourReset", format: "time" }] }, noTime).trim() ===
      "Reset: now"
  );

  const clock = normalizeClock({ hour12: "yes", timeZone: "Mars/Olympus", locale: "??" });
  record(
    "invalid clock settings are dropped",
    clock.hour12 === null && clock.timeZone === "" && clock.locale === ""
  );
  record(
    "the config keeps a valid clock",
    JSON.stringify(mergeConfig({ clock: { hour12: false, timeZone: "Europe/Paris" } }).clock) ===
      '{"hour12":false,"timeZone":"Europe/Paris","locale":""}'
  );
  record(
    "formatClockTime handles midnight in both styles",
    formatClockTime(new Date("2026-10-08T00:05:00Z"), utc) === "12:05am" &&
      formatClockTime(new Date("2026-10-08T00:05:00Z"), { ...utc, hour12: false }) === "00:05"
  );
}

function testStyling() {
  const hex = colored({ widgets: [{ id: "model", color: "#ff0000" }] });
  record("a widget color can be hex (pill background)", hex.includes("48;2;255;0;0m"));
  record(
    "a widget color can name a theme slot",
    colored({ widgets: [{ id: "model", color: "git" }] }).includes("48;2;78;201;176m")
  );
  record(
    "a widget color can be a basic name",
    colored({ widgets: [{ id: "model", color: "cyan" }] }).includes("48;2;86;182;194m")
  );
  record(
    "textColor changes the text on the pill",
    colored({ widgets: [{ id: "model", textColor: "#010203" }] }).includes("38;2;1;2;3m")
  );

  const low = payload();
  low.quota["gemini-5h"].remaining_fraction = 0.05;
  const alert = colored({ widgets: [{ id: "fiveHourBar", color: "#00ff00" }] }, low);
  record(
    "alert colors win over the widget color",
    alert.includes("48;2;244;135;113m") && !alert.includes("48;2;0;255;0m")
  );
  record(
    "a healthy quota uses the widget color",
    colored({ widgets: [{ id: "fiveHourBar", color: "#00ff00" }] }).includes("48;2;0;255;0m")
  );

  const notBold = colored({ widgets: [{ id: "model", bold: false }] });
  record("bold: false drops bold", notBold.includes("\x1b[22m") && !notBold.includes("\x1b[1m"));

  const lines = colored({ layout: "lines", widgets: [{ id: "model", color: "cyan", bold: true }] });
  record(
    "Lines widgets take a color and bold too",
    lines.includes("38;2;86;182;194m") && lines.startsWith("\x1b[1m")
  );
  record(
    "exec keeps accepting slot and basic color names",
    colored({ widgets: [{ id: "exec", cmd: "x", color: "model" }] }).includes(
      "48;2;197;134;192m"
    ) &&
      colored({ layout: "lines", widgets: [{ id: "exec", cmd: "x", color: "blue" }] }).includes(
        "38;2;0;153;255m"
      )
  );
  record(
    "color values that aren't colors are ignored",
    resolveColor("\x1b[2J", {}) === null &&
      resolveColor("not-a-color", {}) === null &&
      !colored({ widgets: [{ id: "model", color: "\x1b[2J" }] }).includes("\x1b[2J")
  );
}

function testMinimalist() {
  const widgets = [
    { id: "model" },
    { id: "fiveHourBar" },
    { id: "fiveHourReset" },
    { id: "contextPct" },
    { id: "git" },
  ];
  const full = plain({ widgets });
  const minimal = plain({ minimalist: true, widgets });

  record(
    "minimalist drops icons and labels",
    !/[⏳💾🌿🤖]|Reset|Context/u.test(minimal) && /72\.0% rem/.test(minimal),
    minimal.trim()
  );
  record(
    "minimalist makes the bar narrower",
    visibleWidth(minimal.trim()) < visibleWidth(full.trim()) - 15
  );
  record(
    "raw works per widget",
    plain({ widgets: [{ id: "model", raw: true }] }).trim() === "Gemini 4 Hydrogen (High)"
  );
  record(
    "raw: false keeps one widget labeled in minimalist mode",
    /Context/.test(
      plain({ minimalist: true, emojis: false, widgets: [{ id: "contextPct", raw: false }] })
    )
  );

  const lines = plain({
    layout: "lines",
    minimalist: true,
    widgets: [{ id: "fiveHourBar" }, { id: "lineBreak" }, { id: "fiveHourReset", format: "time" }],
    clock: { timeZone: "UTC" },
  });
  record(
    "minimalist works in the Lines layout",
    !/5h|⏳|🔄|Reset/.test(lines) && /6:33pm/.test(lines),
    lines.trim()
  );
  record(
    "the config keeps minimalist and pacing",
    mergeConfig({ minimalist: true, pacing: false }).minimalist === true &&
      mergeConfig({ minimalist: true, pacing: false }).pacing === false &&
      mergeConfig({}).pacing === true &&
      mergeConfig({}).minimalist === false
  );
}

async function run() {
  testPacing();
  testPaceDelta();
  testResetTimes();
  testStyling();
  testQuotaMode();
  testMinimalist();
}

function testQuotaMode() {
  const quotaData = payload({
    model: { display_name: "Gemini 4 Hydrogen (High)" },
    quota: {
      ...payload().quota,
      "3p-5h": {
        remaining_fraction: 0.65,
        reset_time: RESET_AT,
        reset_in_seconds: 3600,
      },
      "3p-weekly": {
        remaining_fraction: 0.4,
        reset_time: RESET_AT,
        reset_in_seconds: 86400,
      },
      "gemini-argon-wtu-weekly": {
        remaining_fraction: 0.85,
        reset_time: RESET_AT,
        reset_in_seconds: 86400,
      },
    },
  });

  const quotaWidgets = [
    { id: "quota" },
    { id: "fiveHourBar" },
    { id: "fiveHourPct" },
    { id: "weeklyBar" },
    { id: "weeklyPct" },
    { id: "thirdPartyFiveHour" },
    { id: "thirdPartyWeekly" },
    { id: "argonWeekly" },
  ];

  for (const layout of ["pills", "lines", "classic"]) {
    const usedText = plain(
      { layout, emojis: false, ascii: true, quotaMode: "used", widgets: quotaWidgets },
      quotaData
    );
    const remText = plain(
      { layout, emojis: false, ascii: true, quotaMode: "remaining", widgets: quotaWidgets },
      quotaData
    );

    record(
      `${layout}: quotaMode "used" flips all quota widgets from % rem to % used`,
      /7d 79\.0% used/.test(usedText) &&
        /28\.0% used/.test(usedText) &&
        /35\.0% used/.test(usedText) &&
        /60\.0% used/.test(usedText) &&
        /15\.0% used/.test(usedText) &&
        !/% rem/.test(usedText) &&
        /7d 21\.0% rem/.test(remText) &&
        /72\.0% rem/.test(remText),
      usedText.trim()
    );
  }

  // Color thresholds and Lines meter fill stay identical between remaining and used modes
  // (e.g. 21% remaining === 79% used still triggers caution at quotaWarn=30).
  const remColorBar = stripAnsi(
    renderStatusline(
      quotaData,
      {
        ...defaultConfig(),
        layout: "lines",
        ascii: true,
        quotaMode: "remaining",
        widgets: [{ id: "weeklyBar" }],
      },
      { color: "truecolor" }
    )
  ).replace("21.0% rem", "");
  const usedColorBar = stripAnsi(
    renderStatusline(
      quotaData,
      {
        ...defaultConfig(),
        layout: "lines",
        ascii: true,
        quotaMode: "used",
        widgets: [{ id: "weeklyBar" }],
      },
      { color: "truecolor" }
    )
  ).replace("79.0% used", "");
  const usedWarnRaw = renderStatusline(
    quotaData,
    {
      ...defaultConfig(),
      layout: "lines",
      quotaMode: "used",
      widgets: [{ id: "weeklyPct" }],
    },
    { color: "truecolor" }
  );
  const remWarnRaw = renderStatusline(
    quotaData,
    {
      ...defaultConfig(),
      layout: "lines",
      quotaMode: "remaining",
      widgets: [{ id: "weeklyPct" }],
    },
    { color: "truecolor" }
  );
  // Extract RGB color prefix before percentage text to ensure caution color matches.
  const warnColorHex = (rendered) => rendered.match(/\x1b\[38;2;[0-9;]+m(?=\d)/g)?.[0];
  record(
    'quotaMode "used" keeps meter fill, pace marker, and warning color thresholds aligned',
    remColorBar === usedColorBar &&
      Boolean(warnColorHex(usedWarnRaw)) &&
      warnColorHex(usedWarnRaw) === warnColorHex(remWarnRaw)
  );

  // Translation check across languages (e.g. French "util.", Japanese "使用", German "gen.").
  const frUsed = plain(
    { language: "fr", quotaMode: "used", emojis: false, widgets: [{ id: "fiveHourPct" }] },
    quotaData
  );
  const jaUsed = plain(
    { language: "ja", quotaMode: "used", emojis: false, widgets: [{ id: "fiveHourPct" }] },
    quotaData
  );
  record(
    'quotaMode "used" localizes quota suffix via i18n',
    /28\.0% util\./.test(frUsed) && /28\.0% 使用/.test(jaUsed)
  );

  // Config, config-check, and JSON schema validation.
  record(
    "config, config-check, and schema validate quotaMode values",
    mergeConfig({}).quotaMode === "remaining" &&
      mergeConfig({ quotaMode: "used" }).quotaMode === "used" &&
      mergeConfig({ quotaMode: "bogus" }).quotaMode === "remaining" &&
      droppedSettings({ quotaMode: "used" }).length === 0 &&
      droppedSettings({ quotaMode: "bogus" }).some((msg) => msg.includes("unknown quota mode")) &&
      JSON.stringify(buildConfigSchema().properties.quotaMode?.enum) ===
        JSON.stringify(["remaining", "used"])
  );

  // Quota run-out forecast (#251): countdown & exact time, auto-hide guards, compact drop, and configure options.
  const ahead5h = payload();
  // 5h window = 18000s. reset_in_seconds = 10800s -> 7200s elapsed (40%).
  // remaining = 0.25 -> used = 75%. runsOut = 25 * 7200 / 75 = 2400s (40m).
  ahead5h.quota["gemini-5h"] = {
    remaining_fraction: 0.25,
    reset_in_seconds: 10800,
    reset_time: RESET_AT,
  };
  const countdownPills = plain(
    { widgets: [{ id: "fiveHourPct", forecast: "countdown" }] },
    ahead5h
  );
  const countdownLines = plain(
    { layout: "lines", widgets: [{ id: "fiveHourPct", forecast: true }] },
    ahead5h
  );
  const countdownQuotaClassic = plain(
    { layout: "classic", widgets: [{ id: "quota", forecast: "countdown" }] },
    ahead5h
  );
  const timeLines = plain(
    {
      layout: "lines",
      clock: { timeZone: "UTC", hour12: false },
      widgets: [{ id: "fiveHourPct", forecast: "time" }],
    },
    ahead5h
  );
  const timeMatch = timeLines.match(/~(\d{2}:\d{2})/);
  const lastsWeekly = plain(
    {
      widgets: [{ id: "fiveHourPct", forecast: "countdown" }],
    },
    payload() // default 5h: 72% remaining, 44% elapsed -> lasts until reset
  );
  const compactDrop = plain(
    { widgets: [{ id: "fiveHourPct", forecast: "countdown", compact: true }] },
    ahead5h
  );
  const asciiWeekly = plain(
    {
      ascii: true,
      widgets: [{ id: "weeklyPct", forecast: "countdown" }],
    },
    ahead5h // 21% remaining, 76% elapsed -> runs out in ~122170s = ~1d 9h
  );
  const frForecast = plain(
    { language: "fr", widgets: [{ id: "fiveHourPct", forecast: "countdown" }] },
    ahead5h
  );

  const earlyFresh = formatQuotaForecast({
    remaining: 50,
    resetSeconds: 17900,
    windowSeconds: 18000,
    elapsedPct: (100 / 18000) * 100,
  });
  const unknownWin = formatQuotaForecast({
    remaining: 20,
    resetSeconds: 20000,
    windowSeconds: 0,
    elapsedPct: null,
  });

  const fiveHourFields = editFields({ id: "fiveHourPct" });
  const forecastField = fiveHourFields.find((f) => f.key === "forecast");
  const forecastSchema = buildConfigSchema().definitions.widget.properties.forecast;

  record(
    "forecast renders countdown and exact time across layouts, auto-hides safely, and is exposed in configure/schema",
    countdownPills.includes("· ~40m") &&
      countdownLines.includes("· ~40m") &&
      countdownQuotaClassic.includes("7d 21.0% rem · ~1d 9h · 1d 17h") &&
      Boolean(timeMatch) &&
      !lastsWeekly.includes("~") &&
      !compactDrop.includes("~") &&
      asciiWeekly.includes(", ~1d 9h") &&
      frForecast.includes("· ~40m") &&
      earlyFresh === "" &&
      unknownWin === "" &&
      Boolean(forecastField) &&
      JSON.stringify(forecastSchema?.enum) === JSON.stringify([true, false, "countdown", "time"]),
    JSON.stringify({
      countdownPills,
      countdownLines,
      countdownQuotaClassic,
      timeLines,
      lastsWeekly,
      compactDrop,
      asciiWeekly,
      earlyFresh,
      unknownWin,
    })
  );
}

module.exports = { run };
