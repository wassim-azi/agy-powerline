// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Property-based fuzzing with fast-check. The statusline reads JSON it doesn't
// control on every refresh; random and mangled payloads must never crash the
// renderer, leak control characters, overflow the terminal or run a command.
// A fixed seed and run counts keep CI deterministic: a failure reports the
// seed and the counterexample, so it reproduces on any machine.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const fc = require("fast-check");
const { record, NODE, stageInstall } = require("../helpers");
const {
  renderStatusline,
  defaultConfig,
  applyPreset,
  mergeConfig,
  PRESET_ORDER,
  THEME_ORDER,
  setConfigDir,
  getConfigDir,
} = require("../../src/lib/shared");
const { VALID_WIDGET_IDS } = require("../../src/lib/config");
const { visibleWidth } = require("../../src/lib/formatters");

const SEED = 118;
const RUNS = 300;
const PROCESS_RUNS = 15;

const FIXTURE_DIR = path.join(__dirname, "..", "fixtures");
const FIXED_NOW = Date.parse("2026-10-06T15:00:00.000Z");
const GIB = 1024 ** 3;

const SGR = /\x1b\[[0-9;]*m/g;
// What stripControl removes, minus the newline that separates rows.
const CONTROL = /[\x00-\x09\x0b-\x1f\x7f-\x9f\u2028\u2029\u202A-\u202E\u2066-\u2069]/;
const STACK_TRACE = /\n\s+at .+:\d+:\d+/;

const strip = (text) => text.replace(SGR, "");
const widest = (text) => Math.max(...strip(text).split("\n").map(visibleWidth));

// Escape sequences, separators, bidi overrides, lone surrogates, wide and
// combining characters: the strings most likely to break a terminal row.
const NASTY = [
  "\x1b[31m",
  "\x1b[2J",
  "\x1b]52;c;SECRET\x07",
  "\x1b]8;;https://example.invalid\x1b\\link\x1b]8;;\x1b\\",
  "\x1bP0;1|x\x1b\\",
  "\x9b31m",
  "\x07",
  "\x00",
  "\x7f",
  "\r",
  "\n",
  "\t",
  "\u2028",
  "\u202E",
  "\u2066",
  "\ud800",
  "\u0301",
  "\u200D",
  "\uD83D\uDE00",
  "\uD83D\uDC69\u200D\uD83D\uDCBB",
  "漢字",
  "ｗｉｄｅ",
  "[object Object]",
];

const nastyString = fc.oneof(
  fc.string({ unit: "binary", maxLength: 40 }),
  fc.string({ unit: "grapheme", maxLength: 40 }),
  fc
    .array(fc.oneof(fc.constantFrom(...NASTY), fc.string({ maxLength: 8 })), { maxLength: 12 })
    .map((parts) => parts.join("")),
  fc.constantFrom(...NASTY).map((part) => part.repeat(300))
);

const junk = fc.oneof(
  nastyString,
  fc.jsonValue({ maxDepth: 3 }),
  fc.constantFrom(null, true, false, 0, -1, 1e308, -1e308, 2 ** 53, 0.5, "", [], {})
);

function loadFixtures() {
  return fs
    .readdirSync(FIXTURE_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), "utf8")));
}

// Every key path in a payload, objects and arrays included.
function paths(value, at = [], list = []) {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      list.push([...at, key]);
      paths(value[key], [...at, key], list);
    }
  }
  return list;
}

// A fixture with a few fields swapped for junk or removed.
function mutatedPayload(fixtures) {
  const edit = fc.record({ at: fc.nat(), value: junk, remove: fc.boolean() });
  return fc
    .record({ fixture: fc.nat(fixtures.length - 1), edits: fc.array(edit, { maxLength: 6 }) })
    .map(({ fixture, edits }) => {
      const data = structuredClone(fixtures[fixture]);
      for (const { at, value, remove } of edits) {
        const all = paths(data);
        if (all.length === 0) break;
        const keys = all[at % all.length];
        let parent = data;
        for (const key of keys.slice(0, -1)) parent = parent[key];
        if (remove) {
          delete parent[keys[keys.length - 1]];
        } else {
          parent[keys[keys.length - 1]] = value;
        }
      }
      return data;
    });
}

// A fixture with every string swapped for a hostile one, so the fields the bar
// prints (model, folder, branch, mode...) all carry escape sequences at once.
function taintedPayload(fixtures) {
  return fc
    .record({
      fixture: fc.nat(fixtures.length - 1),
      strings: fc.array(nastyString, { minLength: 1, maxLength: 20 }),
    })
    .map(({ fixture, strings }) => {
      let next = 0;
      const taint = (value) => {
        if (typeof value === "string") return strings[next++ % strings.length];
        if (Array.isArray(value)) return value.map(taint);
        if (value && typeof value === "object") {
          return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, taint(v)]));
        }
        return value;
      };
      return taint(fixtures[fixture]);
    });
}

function payloads(fixtures) {
  return fc.oneof(
    { arbitrary: mutatedPayload(fixtures), weight: 3 },
    { arbitrary: taintedPayload(fixtures), weight: 3 },
    { arbitrary: fc.jsonValue({ maxDepth: 4 }), weight: 1 },
    { arbitrary: fc.dictionary(fc.string({ maxLength: 12 }), junk), weight: 1 }
  );
}

const ALL_WIDGETS = [...VALID_WIDGET_IDS].filter((id) => id !== "exec").map((id) => ({ id }));

// A preset or every widget at once, in either layout, any theme and color mode.
const setups = fc
  .record({
    preset: fc.constantFrom(...PRESET_ORDER, "every widget"),
    layout: fc.constantFrom("pills", "lines"),
    theme: fc.constantFrom(...THEME_ORDER),
    ascii: fc.boolean(),
    color: fc.constantFrom("truecolor", "256", "none"),
  })
  .map(({ preset, layout, theme, ascii, color }) => {
    const base =
      preset === "every widget"
        ? mergeConfig({ widgets: ALL_WIDGETS })
        : applyPreset(defaultConfig(), preset);
    return { config: { ...base, layout, theme, ascii }, overrides: { color, env: {} } };
  });

// Pins the clock, timezone and RAM like snapshots.test.js, and points the
// config dir (where the git sync cache is written) at a temp dir.
function pinned(fn) {
  const RealDate = Date;
  const previousTz = process.env.TZ;
  const previousConfigDir = getConfigDir();
  const { freemem, totalmem } = os;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "agy-fuzz-"));

  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length) {
        super(...args);
      } else {
        super(FIXED_NOW);
      }
    }

    static now() {
      return FIXED_NOW;
    }
  }

  global.Date = FixedDate;
  process.env.TZ = "UTC";
  os.freemem = () => 6 * GIB;
  os.totalmem = () => 16 * GIB;
  setConfigDir(scratch);

  try {
    return fn(scratch);
  } finally {
    global.Date = RealDate;
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
    os.freemem = freemem;
    os.totalmem = totalmem;
    setConfigDir(previousConfigDir);
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function check(name, property, numRuns = RUNS) {
  const details = fc.check(property, { seed: SEED, numRuns });
  const message = details.failed ? fc.defaultReportMessage(details) || "" : "";
  record(name, !details.failed, message.slice(0, 2000));
}

async function run() {
  const fixtures = loadFixtures();
  pinned((scratch) => {
    testNeverThrows(fixtures);
    testNoControlCharacters(fixtures);
    testFitsTerminal(fixtures);
    testPreviewNeverRunsExec(fixtures, scratch);
  });
  testRuntimeProcess();
}

function testNeverThrows(fixtures) {
  check(
    "fuzz: renderStatusline never throws on any payload",
    fc.property(payloads(fixtures), setups, (data, { config, overrides }) => {
      return typeof renderStatusline(data, config, overrides) === "string";
    })
  );
}

function testNoControlCharacters(fixtures) {
  check(
    "fuzz: output has no control characters besides our color codes",
    fc.property(payloads(fixtures), setups, (data, { config, overrides }) => {
      const out = strip(renderStatusline(data, config, overrides));
      return !out.includes("\x1b") && !CONTROL.test(out);
    })
  );
}

function testFitsTerminal(fixtures) {
  check(
    "fuzz: every row fits terminal_width from 40 to 240 columns",
    fc.property(
      payloads(fixtures),
      setups,
      fc.integer({ min: 40, max: 240 }),
      (data, { config, overrides }, width) => {
        const payload = data && typeof data === "object" && !Array.isArray(data) ? data : {};
        return (
          widest(renderStatusline({ ...payload, terminal_width: width }, config, overrides)) <=
          width
        );
      }
    )
  );
}

function testPreviewNeverRunsExec(fixtures, scratch) {
  const marker = path.join(scratch, "exec-ran");
  const cmd = `node -e "require('fs').writeFileSync(process.argv[1], 'x')" "${marker}"`;
  const execWidget = fc.record(
    {
      payload: fc.boolean(),
      colors: fc.boolean(),
      cache: fc.oneof(fc.integer({ min: -5, max: 60 }), junk),
      timeout: fc.oneof(fc.integer({ min: -5, max: 5000 }), junk),
    },
    { requiredKeys: [] }
  );

  check(
    "fuzz: previews never run exec widgets, whatever the config",
    fc.property(
      payloads(fixtures),
      setups,
      execWidget,
      fc.constantFrom(undefined, "preview", "blocked", "RUN", "", null),
      (data, { config, overrides }, extra, exec) => {
        const widgets = [...config.widgets, { ...extra, id: "exec", cmd }];
        renderStatusline(data, { ...config, widgets }, { ...overrides, exec });
        return !fs.existsSync(marker);
      }
    ),
    100
  );
}

// The installed runtime as Antigravity runs it, with random bytes or mangled
// JSON on stdin: exit 0, never a stack trace. Few runs, since each one starts Node.
function testRuntimeProcess() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "agy-fuzz-runtime-"));
  stageInstall(sandbox);
  const statusline = path.join(sandbox, "statusline.js");
  const env = { ...process.env, HOME: sandbox, USERPROFILE: sandbox, AGY_POWERLINE_HOME: sandbox };
  const input = fc.oneof(
    fc.uint8Array({ maxLength: 512 }).map((bytes) => Buffer.from(bytes)),
    fc.jsonValue({ maxDepth: 3 }).map((value) => Buffer.from(JSON.stringify(value) ?? "")),
    nastyString.map((text) => Buffer.from(text))
  );

  try {
    check(
      "fuzz: runtime statusline.js exits 0 without a stack trace on random stdin",
      fc.property(input, (bytes) => {
        const res = spawnSync(NODE, [statusline], {
          input: bytes,
          encoding: "utf8",
          env,
          timeout: 15000,
          windowsHide: true,
        });
        return (
          res.status === 0 &&
          !STACK_TRACE.test(res.stdout) &&
          !STACK_TRACE.test(res.stderr) &&
          res.stderr.trim().split("\n").length <= 1
        );
      }),
      PROCESS_RUNS
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

module.exports = { run };
