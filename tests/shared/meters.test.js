// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

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
const {
  getActiveDepth,
  setActiveDepth,
  contrastRatio,
  withContrast,
} = require("../../src/lib/colors");
const { THEME_ORDER, GRADIENT_ORDER } = require("../../src/lib/themes");
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
      // The context meter has no pace marker. A style may have its own
      // marker glyph; the default ones (pips in Pills, dots in Lines) set the
      // position every other style must match.
      const mark = METER_STYLES[style]?.[2] ?? "┃";
      const pillsMark = METER_STYLES.pips[2];
      if (id !== "context" && (pills.indexOf(mark) < 0 || lines.indexOf(mark) < 0)) {
        markers.push(`${id}/${style}: no marker`);
      } else if (
        pills.indexOf(mark) !== base.pills.indexOf(pillsMark) ||
        lines.indexOf(mark) !== base.lines.indexOf("┃")
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

  const previousDepth = getActiveDepth();
  setActiveDepth("truecolor");
  try {
    // 50% filled, marker in cell 10, on a bright pill with dark text: dots in
    // the text color, then track dots, a larger dot in the text color.
    const pill = [204, 167, 0];
    const text = [22, 22, 28];
    const track = withContrast(pill, pill, 3, text);
    const pips = fillMeter(50, 12, [1, 1, 1], [2, 2, 2], pill, {
      style: "pips",
      elapsedPct: 75,
      textColor: text,
    });
    const t = (c) => `\x1b[38;2;${c.join(";")}m`;
    record(
      "Pills' default meter is small dots in the text and track colors, the marker a larger dot",
      pips.startsWith(`${t(text)}••••••${t(track)}•••${t(text)}●${t(track)}••`) &&
        contrastRatio(track, pill) >= 3 &&
        !/\x1b\[48;2;[12];/.test(pips),
      pips.replace(/\x1b/g, "\\e")
    );

    // Every pip, filled or not, stands out from its pill (3:1, WCAG's minimum
    // for graphics) with every theme and gradient: a light fill fades on the
    // bright pills of dark themes and a dark track on the deep ones of light themes.
    const faint = [];
    for (const gradient of [undefined, ...GRADIENT_ORDER]) {
      for (const theme of THEME_ORDER) {
        const config = { ...defaultConfig(), theme, ...(gradient && { gradient }) };
        const out = renderStatusline(sampleData(), config, { color: "truecolor", env: {} });
        let pillColor = null;
        let dotColor = null;
        for (const m of out.matchAll(/\x1b\[(48|38);2;(\d+);(\d+);(\d+)m|[•●]/g)) {
          if (m[1] === "48") {
            pillColor = m.slice(2, 5).map(Number);
          } else if (m[1] === "38") {
            dotColor = m.slice(2, 5).map(Number);
          } else if (contrastRatio(dotColor, pillColor) < 3) {
            faint.push(`${gradient || "-"} ${theme}: ${dotColor} on ${pillColor}`);
          }
        }
      }
    }
    record(
      "every Pills pip reaches 3:1 against its pill with every theme and gradient",
      faint.length === 0,
      [...new Set(faint)].slice(0, 5).join("; ")
    );
  } finally {
    setActiveDepth(previousDepth);
  }

  // Classic: 25 blocks, ░ for the rest, a thin pace line, | between widgets.
  const classic = stripAnsi(
    render(
      { id: "fiveHourBar" },
      { layout: "classic", widgets: [{ id: "fiveHourBar" }, { id: "fiveHourReset" }] }
    )
  );
  record(
    "Classic draws ██░│░ block meters, without brackets, and | dividers",
    / █*░*│░* \d+\.\d% rem \| /.test(classic) &&
      !/[[\]]/.test(classic) &&
      visibleWidth(classic.match(/[█░│]+/)[0]) === 25,
    classic
  );

  setActiveDepth("truecolor");
  try {
    const palette = {
      quotaLow: [0, 200, 0],
      quotaHigh: [200, 200, 0],
      quotaCrit: [200, 0, 0],
      track: [50, 50, 50],
      text: [9, 9, 9],
    };
    const cells = (out) => [...out.matchAll(/\x1b\[38;2;(\d+;\d+;\d+)m(.)/g)];

    // 100% used over 5 cells: ok, halfway to caution, caution, halfway to danger, danger.
    const ramp = cells(renderDotMeter(100, 5, false, palette, false, { style: "ramp" }));
    record(
      "ramp shades the filled cells from the theme's ok color through caution to danger",
      ramp.map((m) => m[1]).join(" ") === "0;200;0 100;200;0 200;200;0 200;100;0 200;0;0" &&
        ramp.every((m) => m[2] === "█")
    );

    const rings = renderDotMeter(40, 5, false, palette, false, {
      style: "rings",
      color: [0, 200, 0],
    });
    record(
      "rings draws ● in the fill color and ○ in that color faded toward the track",
      rings.startsWith("\x1b[38;2;0;200;0m●●\x1b[38;2;25;125;25m○○○"),
      rings.replace(/\x1b/g, "\\e")
    );
  } finally {
    setActiveDepth(previousDepth);
  }

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
