"use strict";

const { record, stripAnsi } = require("../helpers");
const {
  renderStatusline,
  defaultConfig,
  mergeConfig,
  sampleData,
  themeColors,
} = require("../../src/lib/shared");
const { METER_STYLES, METER_STYLE_IDS } = require("../../src/lib/widget-style");
const { fillMeter } = require("../../src/lib/layouts/pills");
const { renderDotMeter } = require("../../src/lib/layouts/lines");
const { visibleWidth } = require("../../src/lib/formatters");

const METER_WIDGETS = [
  "fiveHourBar",
  "weeklyBar",
  "thirdPartyFiveHour",
  "thirdPartyWeekly",
  "argonWeekly",
  "context",
];

// Every quota the meter widgets read, with a reset that puts the pace marker
// inside the window.
function payload() {
  const data = sampleData();
  const quota = { remaining_fraction: 0.6, reset_in_seconds: 3600 };
  return {
    ...data,
    quota: {
      "gemini-5h": quota,
      "gemini-weekly": quota,
      "3p-5h": quota,
      "3p-weekly": quota,
      "gemini-argon-wtu-weekly": quota,
    },
    terminal_width: 0,
  };
}

function render(widget, extra = {}, overrides = {}) {
  return renderStatusline(
    payload(),
    { ...defaultConfig(), widgets: [widget], ...extra },
    { color: "none", env: {}, ...overrides }
  );
}

async function run() {
  record(
    "every meter glyph is one column wide",
    Object.values(METER_STYLES)
      .filter(Boolean)
      .flat()
      .every((glyph) => visibleWidth(glyph) === 1)
  );

  const pillsWide = [];
  const linesWide = [];
  const markers = [];
  for (const id of METER_WIDGETS) {
    const base = {
      pills: stripAnsi(render({ id })),
      lines: stripAnsi(render({ id }, { layout: "lines" })),
      compact: stripAnsi(render({ id, compact: true }, { layout: "lines" })),
    };
    for (const style of METER_STYLE_IDS) {
      const pills = stripAnsi(render({ id, meter: style }));
      const lines = stripAnsi(render({ id, meter: style }, { layout: "lines" }));
      const compact = stripAnsi(render({ id, meter: style, compact: true }, { layout: "lines" }));
      if (visibleWidth(pills) !== visibleWidth(base.pills)) {
        pillsWide.push(`${id}/${style}`);
      }
      if (
        visibleWidth(lines) !== visibleWidth(base.lines) ||
        visibleWidth(compact) !== visibleWidth(base.compact)
      ) {
        linesWide.push(`${id}/${style}`);
      }
      // The context meter has no pace marker.
      if (id !== "context" && (pills.indexOf("┃") < 0 || lines.indexOf("┃") < 0)) {
        markers.push(`${id}/${style}: no marker`);
      } else if (
        pills.indexOf("┃") !== base.pills.indexOf("┃") ||
        lines.indexOf("┃") !== base.lines.indexOf("┃")
      ) {
        markers.push(`${id}/${style}`);
      }
    }
  }
  record(
    "every style keeps every Pills meter 12 columns wide",
    pillsWide.length === 0 &&
      METER_STYLE_IDS.every(
        (style) =>
          visibleWidth(
            fillMeter(40, 12, [1, 1, 1], [2, 2, 2], [3, 3, 3], { style, textColor: [9, 9, 9] })
          ) === 12
      ),
    pillsWide.join(", ")
  );
  record(
    "every style keeps every Lines meter 25 columns wide, 12 when fitted",
    linesWide.length === 0 &&
      METER_STYLE_IDS.every(
        (style) =>
          visibleWidth(renderDotMeter(40, 25, false, undefined, false, { style })) === 25 &&
          visibleWidth(
            renderDotMeter(40, 12, false, undefined, false, { style, textColor: [9, 9, 9] })
          ) === 12
      ),
    linesWide.join(", ")
  );
  record("the pace marker sits where it does with the default style", !markers.length, markers);

  const blocks = stripAnsi(render({ id: "fiveHourBar", meter: "blocks" }));
  const geometric = stripAnsi(
    render({ id: "fiveHourBar" }, { layout: "lines", meterStyle: "geometric" })
  );
  record(
    "a style draws its own glyphs, from the widget or the global meterStyle",
    blocks.includes("█████") &&
      blocks.includes("░░░░") &&
      geometric.includes("▰▰▰▰") &&
      geometric.includes("▱▱▱▱"),
    `${blocks} / ${geometric}`
  );
  record(
    "the widget's meter wins over the global meterStyle",
    stripAnsi(render({ id: "fiveHourBar", meter: "line" }, { meterStyle: "blocks" })).includes(
      "━━━"
    )
  );
  record(
    "cells falls back to dots in Lines, and dots draws ● in Pills",
    stripAnsi(render({ id: "fiveHourBar", meter: "cells" }, { layout: "lines" })) ===
      stripAnsi(render({ id: "fiveHourBar" }, { layout: "lines" })) &&
      stripAnsi(render({ id: "fiveHourBar", meter: "dots" })).includes("●●●●")
  );

  // On the pill's own color, filled glyphs take the pill's text color.
  const { text } = themeColors("dark-aurora");
  const colored = render({ id: "fiveHourBar", meter: "blocks" }, {}, { color: "truecolor" });
  record(
    "in Pills, a glyph style's filled glyphs use the segment's text color",
    colored.includes(`\x1b[38;2;${text.join(";")}m█`),
    JSON.stringify(colored)
  );

  const defaults = [render({ id: "fiveHourBar" }), render({ id: "context" }, { layout: "lines" })];
  const invalid = [
    render({ id: "fiveHourBar", meter: 3 }, { meterStyle: "nope" }),
    render({ id: "context", meter: "nope" }, { layout: "lines", meterStyle: 3 }),
  ];
  record(
    "unknown meter styles draw the default meter, and mergeConfig drops them",
    invalid[0] === defaults[0] &&
      invalid[1] === defaults[1] &&
      !("meterStyle" in mergeConfig({ meterStyle: "nope" })) &&
      mergeConfig({ meterStyle: "braille" }).meterStyle === "braille"
  );
}

module.exports = { run };
