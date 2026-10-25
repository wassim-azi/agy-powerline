// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, runCli, stripAnsi, PAYLOAD } = require("../helpers");
const { renderStatusline, defaultConfig, mergeConfig } = require("../../src/lib/shared");
const { renderGroup } = require("../../src/lib/layouts/pills");
const { setActiveDepth, getActiveDepth } = require("../../src/lib/colors");
const {
  STYLES,
  STYLE_ORDER,
  parseGlyph,
  applyStyle,
  detectStyle,
  glyphChar,
} = require("../../src/lib/powerline");

const POWERLINE_RANGE = /[-]/g;
const char = (hex) => String.fromCodePoint(parseInt(hex, 16));
const payload = () => JSON.parse(PAYLOAD);

function render(powerline, widgets, overrides = {}) {
  return renderStatusline(
    payload(),
    { ...defaultConfig(), powerline, widgets },
    { color: "truecolor", env: {}, ...overrides }
  );
}

function testParseGlyph() {
  record(
    "parseGlyph accepts hex code points in several spellings",
    parseGlyph("E0B0") === "E0B0" &&
      parseGlyph("u+e0b4") === "E0B4" &&
      parseGlyph("0xE0B6") === "E0B6" &&
      parseGlyph("2588") === "2588" &&
      parseGlyph("1F984") === "1F984"
  );

  const rejected = [
    "1B",
    "7F",
    "9B",
    "200B",
    "202E",
    "20",
    "D800",
    "110000",
    "zz",
    "",
    "E0B0 E0B2",
  ];
  record(
    "parseGlyph rejects control, format, whitespace, surrogate and malformed values",
    rejected.every((value) => parseGlyph(value) === null) &&
      parseGlyph(5) === null &&
      parseGlyph(null) === null,
    rejected.filter((value) => parseGlyph(value) !== null).join(", ")
  );
}

function testConfigNormalization() {
  const merged = mergeConfig({
    capStyle: "angled",
    powerline: {
      separator: "triangle",
      startCap: "none",
      capStyle: "slanted",
      separators: ["E0B0", "1B", "U+e0b2", 7, "200B"],
      separatorInvert: ["yes", true, true, true],
      startCaps: "E0B6",
      endCaps: [],
    },
  }).powerline;

  record(
    "invalid separators are dropped and invert flags line up with what is left",
    JSON.stringify(merged.separators) === '["E0B0","E0B2"]' &&
      JSON.stringify(merged.separatorInvert) === "[false,true]",
    JSON.stringify(merged)
  );
  record(
    "a non-list cap falls back to the default; an empty list means no cap",
    JSON.stringify(merged.startCaps) === '["E0B6"]' && merged.endCaps.length === 0
  );
  record(
    "old cap settings are not kept in the config",
    !("capStyle" in merged) &&
      !("separator" in merged) &&
      !("startCap" in merged) &&
      !("capStyle" in mergeConfig({ capStyle: "angled" }))
  );

  const long = mergeConfig({ powerline: { separators: Array(40).fill("E0B0") } }).powerline;
  record("glyph lists are capped at 16 entries", long.separators.length === 16);

  record(
    "the default config is the round style",
    detectStyle(defaultConfig().powerline) === "round"
  );
  record(
    "a hand-edited setup is reported as custom",
    detectStyle({ ...defaultConfig().powerline, endCaps: ["E0B0"] }) === null
  );
}

function testStyles() {
  const widgets = [{ id: "model" }, { id: "context" }];

  for (const id of STYLE_ORDER) {
    const style = STYLES[id];
    const out = render(applyStyle({}, id), widgets);
    const expected = [...style.startCaps, ...style.separators, ...style.endCaps].map(char);
    const found = out.match(POWERLINE_RANGE) || [];
    record(
      `${id} style draws its caps and join`,
      found.join("") === expected.join(""),
      `got ${found.map((c) => c.codePointAt(0).toString(16)).join(" ")}`
    );
  }
}

function testCycling() {
  const out = render(
    {
      separators: ["E0B0", "E0B4"],
      startCaps: ["E0B6", "E0BA"],
      endCaps: ["E0B4"],
    },
    [{ id: "model" }, { id: "context" }, { id: "git" }, { id: "separator" }, { id: "ram" }]
  );
  const glyphs = (out.match(POWERLINE_RANGE) || []).map((c) => c.codePointAt(0).toString(16));

  record(
    "separators cycle per join and caps cycle per pill",
    glyphs.join(" ") === "e0b6 e0b0 e0b4 e0b4 e0ba e0b4",
    glyphs.join(" ")
  );
}

function testSeparatorColors() {
  const previousDepth = getActiveDepth();
  setActiveDepth("truecolor");

  try {
    const colors = { text: [9, 9, 9], terminal: null };
    const left = { color: [1, 2, 3], text: "a" };
    const right = { color: [4, 5, 6], text: "b" };
    const powerline = (invert) => ({
      separators: ["E0B0"],
      separatorInvert: [invert],
      startCaps: [],
      endCaps: [],
    });
    const glyph = char("E0B0");

    const normal = renderGroup([left, right], colors, { powerline: powerline(false) });
    record(
      "a separator takes the previous color on the next background",
      normal.includes(`\x1b[38;2;1;2;3m\x1b[48;2;4;5;6m${glyph}`)
    );

    const inverted = renderGroup([left, right], colors, { powerline: powerline(true) });
    record(
      "an inverted separator takes the next color on the previous background",
      inverted.includes(`\x1b[38;2;4;5;6m\x1b[48;2;1;2;3m${glyph}`)
    );

    const twin = { color: [1, 2, 3], text: "c" };
    const same = renderGroup([left, twin], colors, { powerline: powerline(false) });
    const join = (hex) =>
      renderGroup([left, twin], colors, { powerline: { ...powerline(false), separators: [hex] } });
    const textOn = `\x1b[38;2;9;9;9m\x1b[48;2;1;2;3m`;
    record(
      "between same-colored widgets the separator is a thin line in the text color",
      same.includes(`${textOn}${char("E0B1")}`) &&
        !same.includes(glyph) &&
        join("E0B4").includes(`${textOn}│`) &&
        !join("E0B4").includes(char("E0B5")) &&
        join("2A").includes(`${textOn}*`)
    );

    const none = renderGroup([left, right], colors, {
      powerline: { separators: [], separatorInvert: [], startCaps: [], endCaps: [] },
    });
    record("empty lists draw no caps and no separator", !/[-]/.test(none));
  } finally {
    setActiveDepth(previousDepth);
  }
}

function testAscii() {
  const widgets = [{ id: "model" }, { id: "context" }, { id: "separator" }, { id: "git" }];
  const nonAscii = (text) => [...stripAnsi(text)].filter((c) => c.codePointAt(0) > 127);

  const overridden = render(defaultConfig().powerline, widgets, { ascii: true });
  record(
    "the --ascii override reaches caps and joins, not just the config flag",
    nonAscii(overridden).length === 0,
    [...new Set(nonAscii(overridden))].join(" ")
  );

  const viaEnv = render(defaultConfig().powerline, widgets, { env: { AGY_POWERLINE_ASCII: "1" } });
  record("AGY_POWERLINE_ASCII=1 renders pure ASCII pills", nonAscii(viaEnv).length === 0);

  record(
    "round caps stay brackets in ASCII but join with arrows",
    glyphChar("E0B6", "startCap", true) === "[" &&
      glyphChar("E0B4", "endCap", true) === "]" &&
      glyphChar("E0B4", "separator", true) === ">" &&
      glyphChar("E0B6", "separator", true) === "<"
  );
  record(
    "custom glyphs fall back to > between widgets and to nothing as caps",
    glyphChar("E0C0", "separator", true) === ">" &&
      glyphChar("E0C0", "startCap", true) === "" &&
      glyphChar("E0C0", "endCap", true) === ""
  );
}

// Visual edges of a pill: what is drawn around and between the widgets.
function testPillEdges() {
  const quotas = [
    { id: "fiveHourBar" },
    { id: "fiveHourReset" },
    { id: "separator" },
    { id: "weeklyBar" },
  ];
  const wide = (powerline, overrides = {}) =>
    renderStatusline(
      { ...payload(), terminal_width: 140 },
      { ...defaultConfig(), powerline, widgets: quotas },
      { color: "truecolor", env: {}, ...overrides }
    );
  const round = defaultConfig().powerline;

  // Walk the output and note whether bold is on at each Powerline glyph.
  const boldGlyphs = (out) => {
    let bold = false;
    let count = 0;
    for (const part of out.split(/(\x1b\[[0-9;]*m)/)) {
      const code = part.match(/^\x1b\[([0-9;]*)m$/);
      if (code) {
        const params = code[1].split(";");
        if (params.includes("1")) bold = true;
        if (params.includes("22") || params.includes("0") || code[1] === "") bold = false;
      } else if (bold) {
        count += (part.match(POWERLINE_RANGE) || []).length;
      }
    }
    return count;
  };
  record(
    "caps and separators are drawn without bold",
    boldGlyphs(wide(round)) === 0 && boldGlyphs(wide(applyStyle({}, "angled"))) === 0
  );

  const flat = wide(applyStyle({}, "flat"));
  record(
    "without end caps a pill still ends on the terminal background, so the padding stays clear",
    /\x1b\[49m {10,}/.test(flat),
    flat.replace(/\x1b/g, "\\e")
  );

  const separate = stripAnsi(wide({ ...round, enabled: false }));
  record(
    "with joins off the pills of one group sit a space apart and only the Flex Separator spreads",
    /rem  /.test(separate) && / {10,}/.test(separate),
    separate
  );

  const plain = wide(round, { color: "none" });
  record(
    "without color there are no solid caps or joins, only thin lines between widgets",
    !/[-]/.test(plain) && plain.includes("│")
  );

  const previousDepth = getActiveDepth();
  setActiveDepth("256");
  try {
    const colors = { text: [22, 22, 28], terminal: null };
    // Two different colors that land on the same 256-color code.
    const out = renderGroup(
      [
        { color: [86, 156, 214], text: "a" },
        { color: [90, 160, 210], text: "b" },
      ],
      colors,
      { powerline: round }
    );
    record(
      "at 256 colors widgets that land on the same code are divided by a thin line",
      out.includes("│") && !/[-].*[-].*[-]/.test(out)
    );

    const ascii = renderGroup(
      [
        { color: [86, 156, 214], text: "a" },
        { color: [197, 134, 192], text: "b" },
      ],
      colors,
      { powerline: round, ascii: true }
    );
    record(
      "ASCII joins are drawn in the text color so they read on any pill",
      ascii.includes("\x1b[38;5;234m\x1b[48;5;175m>")
    );
  } finally {
    setActiveDepth(previousDepth);
  }
}

function testNoInjection() {
  const out = render(
    { separators: ["1B", "\x1b[2J", "9B"], startCaps: ["\x07"], endCaps: ["E0B4"] },
    [{ id: "model" }, { id: "context" }],
    { color: "truecolor" }
  );
  record(
    "glyphs from the config can't emit escape sequences",
    !/\x1b/.test(out.replace(/\x1b\[[0-9;]*m/g, "")) && !out.includes("\x07")
  );
}

function testCapsCommand() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-caps-"));
  const installDir = path.join(root, ".agy-powerline");
  const env = { ...process.env, HOME: root, USERPROFILE: root, AGY_POWERLINE_HOME: installDir };

  try {
    const set = runCli(["caps", "slanted"], { env });
    const saved = JSON.parse(
      fs.readFileSync(path.join(installDir, "statusline.config.json"), "utf8")
    );
    record(
      "caps <style> writes the style's caps and separators",
      set.code === 0 &&
        JSON.stringify(saved.powerline.startCaps) === '["E0BA"]' &&
        JSON.stringify(saved.powerline.separators) === '["E0BC"]' &&
        JSON.stringify(saved.powerline.endCaps) === '["E0BC"]',
      `exit ${set.code}`
    );

    const list = runCli(["caps", "--list"], { env });
    record(
      "caps --list marks the active style",
      list.code === 0 && /current\s+.*slanted/.test(stripAnsi(list.stdout))
    );

    saved.powerline.endCaps = ["E0B0"];
    fs.writeFileSync(path.join(installDir, "statusline.config.json"), JSON.stringify(saved));
    const custom = runCli(["caps", "--list"], { env });
    record(
      "caps --list reports a hand-edited setup as custom",
      custom.code === 0 && /current\s+custom/.test(stripAnsi(custom.stdout))
    );

    const bad = runCli(["caps", "wavy"], { env });
    record(
      "caps rejects an unknown style",
      bad.code === 1 && /unknown cap style/i.test(bad.stderr)
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function run() {
  testParseGlyph();
  testConfigNormalization();
  testStyles();
  testCycling();
  testSeparatorColors();
  testAscii();
  testPillEdges();
  testNoInjection();
  testCapsCommand();
}

module.exports = { run };
