"use strict";

const { record, PAYLOAD } = require("../helpers");
const { renderStatusline, mergeConfig, defaultConfig } = require("../../src/lib/shared");
const { parseGradientStops, gradientColors, gradientAt } = require("../../src/lib/colors");
const {
  normalizeGradient,
  gradientStops,
  GRADIENT_ORDER,
  THEMES,
} = require("../../src/lib/themes");

const RED = "48;2;255;0;0m";
const BLUE = "48;2;0;0;255m";
const TRUECOLOR = { color: "truecolor", env: {} };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sep = { id: "separator" };

function render(widgets, extra = {}, data = JSON.parse(PAYLOAD), overrides = TRUECOLOR) {
  return renderStatusline(data, { ...defaultConfig(), widgets, ...extra }, overrides);
}

function checkParsing() {
  record(
    "gradient stops parse 2 to 6 hex colors, with or without # and in 3 digits",
    same(parseGradientStops("#ff0000-00f"), [
      [255, 0, 0],
      [0, 0, 255],
    ]) && parseGradientStops("111-222-333-444-555-666")?.length === 6
  );

  const invalid = [
    "#ff0000",
    "#f00-#0f0-#00f-#fff-#000-#111-#222",
    "#ff0000-#zzzzzz",
    "",
    42,
    null,
  ];
  record(
    "invalid gradient stops parse to null",
    invalid.every((value) => parseGradientStops(value) === null)
  );

  record(
    "gradient values normalize to a preset id or lowercase #rrggbb stops",
    normalizeGradient(" Sunset ") === "sunset" &&
      normalizeGradient("#FF5F6D-ffc371") === "#ff5f6d-#ffc371" &&
      normalizeGradient("#f00-#00f") === "#ff0000-#0000ff"
  );

  record(
    "off, unknown names and non-strings are no gradient",
    ["off", "nope", "", null, undefined, 3, ["#f00", "#00f"], { stops: 2 }].every(
      (value) => normalizeGradient(value) === null && gradientStops(value) === null
    )
  );

  record(
    "every preset has 2 to 6 stops",
    GRADIENT_ORDER.every((id) => {
      const stops = gradientStops(id);
      return stops && stops.length >= 2 && stops.length <= 6;
    })
  );

  const kept = mergeConfig({ gradient: "OCEAN" });
  const dropped = mergeConfig({ gradient: "#nothex-#000" });
  record(
    "mergeConfig keeps a valid gradient and drops an invalid one",
    kept.gradient === "ocean" && !("gradient" in dropped),
    `${kept.gradient} / ${dropped.gradient}`
  );
}

function checkInterpolation() {
  const stops = parseGradientStops("#ff0000-#00ff00-#0000ff");
  const five = gradientColors(stops, 5);
  record(
    "gradient colors start and end on the exact stops and pass through the middle ones",
    five.length === 5 &&
      same(five[0], [255, 0, 0]) &&
      same(five[2], [0, 255, 0]) &&
      same(five[4], [0, 0, 255]),
    JSON.stringify(five)
  );

  record(
    "one widget takes the first stop, none takes nothing",
    same(gradientColors(stops, 1), [[255, 0, 0]]) && gradientColors(stops, 0).length === 0
  );

  // Halfway in OKLab is a perceptual mid-gray, darker than the sRGB average (128).
  const mid = gradientAt(parseGradientStops("#000-#fff"), 0.5);
  record(
    "colors mix in OKLab, not sRGB",
    mid[0] === mid[1] && mid[1] === mid[2] && mid[0] > 90 && mid[0] < 110,
    JSON.stringify(mid)
  );
}

function checkPills() {
  // title has no data in this payload, so it hides and takes no step.
  const widgets = [{ id: "model" }, sep, { id: "title" }, sep, { id: "cwd" }];
  const out = render(widgets, { gradient: "#f00-#00f" });
  record(
    "pills: the first and last widget shown take the end stops, hidden ones don't count",
    out.includes(RED) && out.includes(BLUE),
    out
  );

  const rows = render(
    [{ id: "model" }, sep, { id: "cwd" }, { id: "lineBreak" }, { id: "project" }],
    {
      gradient: "#f00-#00f",
    }
  );
  const [first, second] = rows.split("\n");
  record(
    "pills: each row gets its own sweep",
    first.includes(RED) && first.includes(BLUE) && second.includes(RED) && !second.includes(BLUE)
  );

  const own = render([{ id: "model" }, sep, { id: "cwd", color: "#123456" }], {
    gradient: "#f00-#00f",
  });
  record(
    "pills: a widget's own color wins over the gradient",
    own.includes("48;2;18;52;86m") && !own.includes(BLUE),
    own
  );

  const danger = JSON.parse(PAYLOAD);
  danger.quota["gemini-5h"].remaining_fraction = 0.05;
  const warn = THEMES["dark-aurora"].colors.warn.join(";");
  const alert = render(
    [{ id: "model" }, sep, { id: "fiveHourPct" }],
    { gradient: "#f00-#00f" },
    danger
  );
  record(
    "pills: a quota in danger keeps the theme's danger color",
    alert.includes(`48;2;${warn}m`) && !alert.includes(BLUE),
    alert
  );

  const textColor = render([{ id: "model", textColor: "#010203" }], { gradient: "#f00-#00f" });
  record(
    "pills: a widget's own text color wins over the readable text pick",
    textColor.includes("38;2;1;2;3m"),
    textColor
  );

  const plain = render(widgets);
  record(
    "pills: without a gradient the bar is unchanged",
    plain === render(widgets, { gradient: "off" }) && !plain.includes(RED)
  );
}

function checkLines() {
  const widgets = [{ id: "model" }, sep, { id: "title" }, sep, { id: "cwd" }];
  // Both stops already read on a dark terminal, so they're used exactly.
  const out = render(widgets, { layout: "lines", gradient: "#ffd166-#9cdcfe" });
  record(
    "lines: the first and last widget shown take the end stops",
    out.includes("38;2;255;209;102m") && out.includes("38;2;156;220;254m"),
    out
  );

  const dark = render(widgets, { layout: "lines", gradient: "#f00-#00f" });
  record(
    "lines: a stop too dark for the terminal background is lightened",
    !dark.includes("38;2;0;0;255m") && !dark.includes("38;2;255;0;0m"),
    dark
  );
}

function checkDepths() {
  const widgets = [{ id: "model" }, sep, { id: "cwd" }, sep, { id: "project" }];
  for (const layout of ["pills", "lines"]) {
    const ansi256 = render(widgets, { layout, gradient: "rainbow" }, undefined, {
      color: "256",
      env: {},
    });
    const none = render(widgets, { layout, gradient: "rainbow" }, undefined, {
      color: "none",
      env: {},
    });
    record(
      `${layout}: a gradient uses 256-color codes in 256 mode and no color in none mode`,
      /[34]8;5;/.test(ansi256) &&
        !/[34]8;2;/.test(ansi256) &&
        !/[34]8;[25];/.test(none) &&
        none === render(widgets, { layout }, undefined, { color: "none", env: {} })
    );
  }
}

async function run() {
  checkParsing();
  checkInterpolation();
  checkPills();
  checkLines();
  checkDepths();
}

module.exports = { run };
