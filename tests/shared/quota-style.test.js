// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { record, stripAnsi, PAYLOAD } = require("../helpers");
const { renderStatusline, defaultConfig, mergeConfig } = require("../../src/lib/shared");
const { visibleWidth, normalizeClock, formatClockTime } = require("../../src/lib/formatters");
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
    plain({ widgets: [{ id: "model", raw: true }] }).trim() === "Gemini 3.8 Flash (High)"
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
  testResetTimes();
  testStyling();
  testMinimalist();
}

module.exports = { run };
