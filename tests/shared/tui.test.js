"use strict";

const { record } = require("../helpers");
const { renderFrame, tabAfter, isQuitKey } = require("../../src/cli/configure");
const {
  applyPreset,
  defaultConfig,
  renderStatusline,
  sampleData,
} = require("../../src/lib/shared");
const { visibleWidth } = require("../../src/lib/formatters");
const { WIDGET_CATALOG } = require("../../src/lib/catalog");

const SCREENS = [
  "main",
  "add",
  "presets",
  "themes",
  "customTheme",
  "layout",
  "powerline",
  "glyphs",
  "edit",
];

const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");
const widest = (text) => Math.max(...strip(text).split("\n").map(visibleWidth));

async function run() {
  testEveryScreenFits();
  testFillsWideTerminal();
  testShortWindows();
  testWidthTiers();
  testAsciiAndNoColor();
  testScreenContent();
  testStateCues();
  testWidgetEditor();
  testDepthIsRestored();
  testTabKeys();
}

// Numbers, badges and the preview title say what is a widget, what is in
// use and what is only previewed.
function testStateCues() {
  const main = strip(renderFrame({ config: defaultConfig() }));
  record(
    "only widgets are numbered, so the numbers match the widget count",
    /Your widgets · 7 widgets/.test(main) &&
      /\b7 🔄 +7d Reset Timer/.test(main) &&
      !/\b11 /.test(main)
  );

  const long = WIDGET_CATALOG.filter((widget) => widget.summary.split(" ").length > 6);
  const wide = strip(renderFrame({ config: defaultConfig(), columns: 160 }));
  record(
    "the lists show each widget's summary (six words at most), the details its description",
    !long.length &&
      /VCS Branch +branch, changes and ahead\/behind/.test(main) &&
      !/marked when there are uncommitted changes/.test(main) &&
      /The model in use\./.test(wide),
    long.map((widget) => widget.id).join(", ")
  );

  const presets = strip(renderFrame({ config: defaultConfig(), screen: "presets", columns: 160 }));
  const same = strip(renderFrame({ config: defaultConfig(), screen: "presets" }));
  record(
    "the preset matching the widgets is marked current, and its rows show the widget icons",
    /Everyday\S* +● current/.test(presets) && /🤖 Model · 💾 Context Bar/.test(presets)
  );
  record(
    "the preview title says when it shows a preset, theme or layout that isn't applied",
    !/preview, enter to apply/.test(same) &&
      /preset preview, enter to apply/.test(
        strip(renderFrame({ config: defaultConfig(), screen: "presets", cursor: 1 }))
      ) &&
      /theme preview, enter to apply/.test(
        strip(renderFrame({ config: defaultConfig(), screen: "themes", cursor: 3 }))
      ) &&
      !/preview, enter to apply/.test(
        strip(renderFrame({ config: defaultConfig(), screen: "themes", cursor: 0 }))
      )
  );

  const themes = strip(renderFrame({ config: defaultConfig(), screen: "themes", columns: 160 }));
  record(
    "the theme details show a sample of the editor in that theme",
    /SAMPLE/.test(themes) &&
      /Selected item/.test(themes) &&
      /● ok +● caution +● danger/.test(themes)
  );
}

function testWidgetEditor() {
  const widgets = [
    { id: "model", short: true },
    { id: "fiveHourBar", warn: 25 },
    { id: "fiveHourReset" },
    { id: "customText", text: "Prod" },
    { id: "exec", cmd: "echo hi" },
  ];
  const config = { ...defaultConfig(), widgets };
  const edit = (editIndex, extra = {}) =>
    strip(renderFrame({ config, screen: "edit", editIndex, columns: 160, ...extra }));

  // A selected label sits between the pill's round ends, hence the `.?`.
  const model = edit(0);
  const bar = edit(1, { cursor: 2 });
  record(
    "Enter on a widget opens its options, with the values it has set",
    /Edit · 🤖 Model/.test(model) &&
      /Short name.? +on/.test(model) &&
      /Color.? +theme default/.test(model) &&
      /Caution at.? +25%/.test(bar) &&
      /Danger at.? +default \(10%\)/.test(bar) &&
      /Pace marker/.test(bar) &&
      /Meter.? +theme default/.test(bar) &&
      /Format.? +countdown/.test(edit(2)) &&
      /Text.? +Prod/.test(edit(3)) &&
      /Command.? +echo hi/.test(edit(4))
  );
  record(
    "the editor explains the selected option and draws the widget with it",
    /╭─ Caution at ─/.test(bar) && /share left/.test(bar) && /PREVIEW/.test(bar)
  );
  record(
    "typing into a text option shows the text and keeps q for typing",
    /Text.? +Prodx/.test(edit(3, { cursor: 2, textInput: "Prodx" })) &&
      /enter.? +keep/.test(edit(3, { cursor: 2, textInput: "Prodx" })) &&
      isQuitKey({ name: "q" }, false) &&
      !isQuitKey({ name: "q" }, true)
  );
}

// The configurator redraws the whole screen: a line wider than the terminal
// would wrap, and a frame taller than it would scroll, pushing everything out
// of place.
const SIZES = [
  [60, 16],
  [60, 20],
  [80, 24],
  [100, 30],
  [140, 30],
  [160, 40],
  [220, 50],
];

function testEveryScreenFits() {
  const overflows = [];
  const full = applyPreset(defaultConfig(), "full");

  for (const screen of SCREENS) {
    for (const [columns, rows] of SIZES) {
      for (const ascii of [false, true]) {
        for (const cursor of [0, 12]) {
          const out = renderFrame({ config: { ...full, ascii }, screen, columns, rows, cursor });
          const height = out.split("\n").length;
          if (widest(out) > columns - 1 || height > rows - 1) {
            const size = `${columns}x${rows}${ascii ? "/ascii" : ""}@${cursor}`;
            overflows.push(`${screen} ${size}: ${widest(out)} wide, ${height} tall`);
          }
        }
      }
    }
  }

  record(
    "every configurator screen fits windows from 60x16 to 220x50",
    !overflows.length,
    overflows.join(", ")
  );
}

// No upper limit: on a wide terminal the panels reach the right edge.
function testFillsWideTerminal() {
  const out = renderFrame({ config: defaultConfig(), columns: 220 });
  record("the configurator fills a 220-column terminal", widest(out) === 219, `${widest(out)}`);
}

function testShortWindows() {
  const tall = strip(renderFrame({ config: defaultConfig(), rows: 50 }));
  const short = strip(renderFrame({ config: defaultConfig(), rows: 24 }));
  record(
    "a short window drops the tagline and blank lines before the list scrolls",
    /Make agy feel like yours/.test(tall) &&
      !/Make agy feel like yours/.test(short) &&
      /7d Reset Timer/.test(short) &&
      !/\d+ more/.test(short)
  );

  const header = (columns) =>
    strip(renderFrame({ config: defaultConfig(), columns }))
      .split("\n")
      .slice(0, 6);
  // At 120 columns the panels are 119 wide; the header ends inside their edge.
  const [, brand, , rule, tabs] = header(120);
  const narrowTabs = header(60)[4];
  record(
    "the header puts the star link and the navigation keys at the right end, under a rule",
    /Star on GitHub$/.test(brand) &&
      visibleWidth(brand) === 118 &&
      /^ ─+$/.test(rule) &&
      visibleWidth(rule) === 118 &&
      /navigate {3}q quit$/.test(tabs) &&
      visibleWidth(tabs) === 118 &&
      !/navigate/.test(narrowTabs)
  );

  const first = strip(renderFrame({ config: defaultConfig(), screen: "add", rows: 24 }));
  const middle = strip(
    renderFrame({ config: defaultConfig(), screen: "add", rows: 24, cursor: 20 })
  );
  const last = strip(renderFrame({ config: defaultConfig(), screen: "add", rows: 24, cursor: 99 }));
  record(
    "a long list scrolls inside its panel and counts the rows out of view",
    /↓ \d+ more ─╯/.test(first) &&
      !/↑ \d+ more/.test(first) &&
      /↑ \d+ more ─╮/.test(middle) &&
      /↓ \d+ more ─╯/.test(middle) &&
      /\ue0b1 /.test(middle) &&
      /New Line/.test(last) &&
      !/↓ \d+ more/.test(last)
  );

  const kept = strip(
    renderFrame({ config: defaultConfig(), screen: "add", rows: 24, scroll: 5, cursor: 7 })
  );
  record("moving the cursor within the visible rows keeps the scroll", /↑ 5 more/.test(kept));
}

// The column where each row's description starts, for the given labels. The
// selected label sits between the pill's round ends instead of spaces.
function descriptionColumns(out, labels) {
  const columns = [];
  for (const line of strip(out).split("\n")) {
    for (const label of labels) {
      const match = line.match(new RegExp(`${label}[ \\ue0b4] +\\S`));
      if (match) {
        columns.push(visibleWidth(line.slice(0, match.index + match[0].length - 1)));
      }
    }
  }
  return columns;
}

function testWidthTiers() {
  const labels = ["Model", "Context Bar", "VCS Branch", "5h Remaining Bar"];
  const medium = descriptionColumns(renderFrame({ config: defaultConfig(), columns: 100 }), labels);
  record(
    "from 80 columns the descriptions line up in one column",
    medium.length === labels.length && new Set(medium).size === 1,
    medium.join(",")
  );

  const wide = strip(renderFrame({ config: defaultConfig(), columns: 160 }));
  const narrow = strip(renderFrame({ config: defaultConfig(), columns: 139 }));
  record(
    "from 140 columns a details panel shows the selected item next to the list",
    /╮ ╭─ 🤖 Model ─/.test(wide) &&
      /The model in use\./.test(wide) &&
      /IN PRESETS/.test(wide) &&
      /\ue0b6Everyday\ue0b4/.test(wide) &&
      !/IN PRESETS/.test(narrow)
  );

  const top = wide.split("\n").find((line) => line.includes("╮ ╭─"));
  const [left, right] = top.split("╮ ").map(visibleWidth);
  record(
    "the list and the details panel share a wide window evenly, with the widget drawn alone",
    Math.abs(left + 1 - right) <= 1 &&
      (wide.match(/Gemini 3\.8 Flash \(High\)/g) || []).length === 2 &&
      /the model in use/.test(wide),
    `${left + 1} / ${right}`
  );

  const presets = strip(renderFrame({ config: defaultConfig(), screen: "presets", columns: 160 }));
  const themes = strip(renderFrame({ config: defaultConfig(), screen: "themes", columns: 160 }));
  record(
    "the details panel lists a preset's rows and a theme's colors",
    /1 {2}🤖 Model · 💾 Context Bar · 🌿 VCS Branch/.test(presets) &&
      /2 {2}⏳ 5h Remaining Bar/.test(presets) &&
      /Caution +\ue0b4 +#[0-9a-f]{6}/.test(themes)
  );

  const widgets = [{ id: "exec", cmd: "echo \x1b[31mhi" }];
  const exec = strip(renderFrame({ config: { ...defaultConfig(), widgets }, columns: 160 }));
  record(
    "the details panel shows a widget's options without control characters",
    /cmd: echo hi/.test(exec) && !/31m/.test(exec) && /previews here show \[cmd\]/.test(exec)
  );
}

function testAsciiAndNoColor() {
  const nonAscii = [];
  const colored = [];

  for (const screen of SCREENS) {
    const config = { ...defaultConfig(), ascii: true };
    const out = strip(renderFrame({ config, screen, columns: 60, color: "none" }));
    const found = out.match(/[^\x00-\x7f]/g);
    if (found) {
      nonAscii.push(`${screen}: ${[...new Set(found)].join("")}`);
    }

    const plain = renderFrame({ config: defaultConfig(), screen, color: "none" });
    if (/\x1b\[[34]8;/.test(plain)) {
      colored.push(screen);
    }
  }

  record("ASCII mode draws every screen in plain ASCII", !nonAscii.length, nonAscii.join("; "));
  record(
    "no-color mode draws every screen without color codes",
    !colored.length,
    colored.join(", ")
  );
}

function testScreenContent() {
  const main = strip(renderFrame({ config: defaultConfig() }));
  record(
    "main screen shows the brand, tabs, widgets, live preview and keys",
    /agy-powerline \ue0b6v\d/.test(main) &&
      /Widgets.*Presets.*Themes.*Layout.*Powerline/.test(main) &&
      /Your widgets · 7 widgets/.test(main) &&
      /flex space/.test(main) &&
      /Live preview/.test(main) &&
      /save & quit/.test(main) &&
      /joins j .* gaps v .* emojis e .* minimal m .* pace r .* blink b .* ascii i/.test(main)
  );

  const themes = strip(renderFrame({ config: defaultConfig(), screen: "themes" }));
  record(
    "toggle chips name their keys only on the widget list, where the keys work",
    /● emojis/.test(themes) && !/emojis e/.test(themes)
  );

  const search = strip(renderFrame({ config: defaultConfig(), screen: "add", search: "quo" }));
  record(
    "add screen filters widgets by the search text",
    /Tightest Quota/.test(search) && !/Context Bar/.test(search)
  );

  const presets = strip(renderFrame({ config: defaultConfig(), screen: "presets", cursor: 1 }));
  record(
    "presets screen previews the hovered preset",
    /One line/.test(presets) && /Quota: 7d/.test(presets)
  );

  const ok = strip(renderFrame({ config: defaultConfig(), flash: "Saved" }));
  const warn = strip(renderFrame({ config: defaultConfig(), flash: "⚠ At most 8 glyphs" }));
  record(
    "messages show as a success or a warning toast",
    /✓ Saved/.test(ok) && /⚠ At most 8 glyphs/.test(warn) && !/⚠ ⚠/.test(warn)
  );

  const empty = strip(renderFrame({ config: defaultConfig(), widgets: [] }));
  record("an empty widget list invites adding one", /Press a to add your first widget/.test(empty));
}

// Drawing a frame must not change how the bar renders afterwards.
function testDepthIsRestored() {
  const before = renderStatusline(sampleData(), defaultConfig());
  renderFrame({ config: defaultConfig(), color: "none" });
  const after = renderStatusline(sampleData(), defaultConfig());
  record("drawing a configurator frame leaves the bar's colors unchanged", before === after);
}

function testTabKeys() {
  const right = { name: "right" };
  const left = { name: "left" };
  record(
    "right arrow and Tab move to the next tab, wrapping around",
    tabAfter("main", right) === "presets" &&
      tabAfter("presets", { name: "tab" }) === "themes" &&
      tabAfter("powerline", right) === "main"
  );
  record(
    "left arrow and Shift+Tab move to the previous tab, wrapping around",
    tabAfter("themes", left) === "presets" &&
      tabAfter("layout", { name: "tab", shift: true }) === "themes" &&
      tabAfter("main", left) === "powerline"
  );
  record(
    "a tab's letter opens it from any tab, and does nothing on its own tab",
    tabAfter("main", { name: "t" }) === "themes" &&
      tabAfter("presets", { name: "w" }) === "main" &&
      tabAfter("powerline", { name: "o" }) === "presets" &&
      tabAfter("main", { name: "w" }) === null &&
      tabAfter("main", { name: "p", ctrl: true }) === null
  );
  record(
    "sub-screens keep their letters for typing",
    tabAfter("add", { name: "t" }) === null && tabAfter("glyphs", { name: "o" }) === null
  );
  record(
    "sub-screens keep the arrows, and other keys never switch tabs",
    tabAfter("add", right) === null &&
      tabAfter("customTheme", left) === null &&
      tabAfter("glyphs", right) === null &&
      tabAfter("main", { name: "up" }) === null
  );
}

module.exports = { run };
