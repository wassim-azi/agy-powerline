"use strict";

// Snapshot tests: render known inputs with several layouts and themes and
// compare against tests/snapshots/*.txt. Any change to what the bar prints
// shows up as a readable diff in the pull request.
//
// Update after an intended change:  npm run test:update

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, PAYLOAD } = require("../helpers");
const { LAYOUT_ORDER } = require("../../src/lib/config");
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require("../../src/lib/i18n");
const {
  renderStatusline,
  defaultConfig,
  applyPreset,
  sampleData,
} = require("../../src/lib/shared");

const SNAPSHOT_DIR = path.join(__dirname, "..", "snapshots");
const FIXTURE_DIR = path.join(__dirname, "..", "fixtures");

// Everything time-, machine- or terminal-dependent is pinned.
const FIXED_NOW = Date.parse("2026-10-06T15:00:00.000Z");
const FIXED_CWD = "/home/you/projects/agy-powerline";
const TERMINAL_WIDTH = 100;
const GIB = 1024 ** 3;

const THEMES = ["dark-aurora", "light-paper", "colorblind-dark"];

function withQuota(data, fiveHour, weekly, contextUsed) {
  return {
    ...data,
    quota: {
      ...data.quota,
      "gemini-5h": { ...data.quota["gemini-5h"], remaining_fraction: fiveHour },
      "gemini-weekly": { ...data.quota["gemini-weekly"], remaining_fraction: weekly },
    },
    context_window: {
      ...data.context_window,
      used_percentage: contextUsed,
      remaining_percentage: 100 - contextUsed,
    },
  };
}

function inputs() {
  const sample = {
    ...sampleData(),
    cwd: FIXED_CWD,
    workspace: { current_dir: FIXED_CWD, project_dir: FIXED_CWD },
  };
  const list = [
    ["sample", sample],
    ["sample-caution", withQuota(sample, 0.22, 0.25, 75)],
    ["sample-danger", withQuota(sample, 0.05, 0.08, 95)],
    ["payload", JSON.parse(PAYLOAD)],
  ];

  for (const file of fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), "utf8"));
    list.push([`fixture-${path.basename(file, ".json")}`, data]);
  }

  return list.map(([name, data]) => [name, { ...data, terminal_width: TERMINAL_WIDTH }]);
}

function cases() {
  const base = defaultConfig();
  const full = applyPreset(base, "full");
  const list = [];

  for (const theme of THEMES) {
    list.push([
      `pills default · ${theme}`,
      { ...base, theme, layout: "pills" },
      { color: "truecolor" },
    ]);
    list.push([
      `pills full · ${theme}`,
      { ...full, theme, layout: "pills" },
      { color: "truecolor" },
    ]);
    list.push([`lines · ${theme}`, { ...base, theme, layout: "lines" }, { color: "truecolor" }]);
  }

  // Each language gets its own cases, so adding one adds its snapshots.
  for (const language of SUPPORTED_LANGUAGES.filter((id) => id !== DEFAULT_LANGUAGE)) {
    list.push([`pills default · ${language}`, { ...base, language }, { color: "truecolor" }]);
    list.push([`pills full · ${language}`, { ...full, language }, { color: "truecolor" }]);
    list.push([
      `lines · ${language}`,
      { ...base, language, layout: "lines" },
      { color: "truecolor" },
    ]);
  }

  list.push([
    "pills default · ascii",
    { ...base, layout: "pills" },
    { color: "none", ascii: true },
  ]);
  list.push(["lines · 256 colors", { ...base, layout: "lines" }, { color: "256" }]);
  list.push(["classic · dark-aurora", { ...base, layout: "classic" }, { color: "truecolor" }]);
  list.push([
    "lines · meter ramp",
    { ...base, layout: "lines", meterStyle: "ramp" },
    { color: "truecolor" },
  ]);
  list.push([
    "classic · meter rings",
    { ...base, layout: "classic", meterStyle: "rings" },
    { color: "truecolor" },
  ]);
  list.push(["classic · ascii", { ...base, layout: "classic" }, { color: "none", ascii: true }]);
  list.push([
    "pills default · gradient sunset",
    { ...base, layout: "pills", gradient: "sunset" },
    { color: "truecolor" },
  ]);
  list.push([
    "lines · gradient sunset",
    { ...base, layout: "lines", gradient: "sunset" },
    { color: "truecolor" },
  ]);
  list.push([
    "pills default · meter blocks",
    { ...base, layout: "pills", meterStyle: "blocks" },
    { color: "truecolor" },
  ]);
  list.push([
    "lines · meter geometric",
    { ...base, layout: "lines", meterStyle: "geometric" },
    { color: "truecolor" },
  ]);
  list.push([
    "lines · light-paper · gradient sunset",
    { ...base, theme: "light-paper", layout: "lines", gradient: "sunset" },
    { color: "truecolor" },
  ]);
  return list;
}

// Escape codes become readable tags so snapshot diffs show color changes.
function describe(output) {
  const hex = (r, g, b) =>
    "#" + [r, g, b].map((n) => Number(n).toString(16).padStart(2, "0")).join("");

  return output.replace(/\x1b\[([0-9;]*)m/g, (_, body) => {
    const codes = body === "" ? [0] : body.split(";").map(Number);
    const tags = [];

    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if ((c === 38 || c === 48) && codes[i + 1] === 2) {
        tags.push(`${c === 38 ? "fg" : "bg"} ${hex(codes[i + 2], codes[i + 3], codes[i + 4])}`);
        i += 4;
      } else if ((c === 38 || c === 48) && codes[i + 1] === 5) {
        tags.push(`${c === 38 ? "fg" : "bg"} 256:${codes[i + 2]}`);
        i += 2;
      } else {
        const names = {
          0: "reset",
          1: "bold",
          2: "dim",
          5: "blink",
          22: "/bold",
          25: "/blink",
          39: "fg default",
          49: "bg default",
        };
        tags.push(names[c] || `sgr ${c}`);
      }
    }

    return `{${tags.join(", ")}}`;
  });
}

function renderSnapshot(name, data) {
  const sections = [`# ${name}`, ""];
  const snapshotCases = cases();

  if (name === "sample") {
    for (const layout of LAYOUT_ORDER) {
      snapshotCases.push([
        `host widget · ${layout}`,
        { ...defaultConfig(), layout, widgets: [{ id: "host" }] },
        { color: "none" },
      ]);
    }
  }

  for (const [label, config, overrides] of snapshotCases) {
    const out = renderStatusline(data, config, { ...overrides, env: {} });
    sections.push(`## ${label}`, describe(out), "");
  }

  return sections.join("\n");
}

// Pins the clock, timezone, RAM and host identity while `fn` runs.
function frozen(fn) {
  const RealDate = Date;
  const previousTz = process.env.TZ;
  const previousWsl = process.env.WSL_DISTRO_NAME;
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const readFileSync = fs.readFileSync;
  const { freemem, totalmem, hostname, userInfo } = os;

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
  Object.defineProperty(process, "platform", { ...platformDescriptor, value: "linux" });
  delete process.env.WSL_DISTRO_NAME;
  fs.readFileSync = function (file, ...args) {
    if (file === "/proc/version") {
      return "Linux version";
    }
    return readFileSync.call(fs, file, ...args);
  };
  os.freemem = () => 6 * GIB;
  os.totalmem = () => 16 * GIB;
  os.hostname = () => "devbox";
  os.userInfo = () => ({ username: "alex" });

  try {
    return fn();
  } finally {
    global.Date = RealDate;
    if (previousTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTz;
    }
    Object.defineProperty(process, "platform", platformDescriptor);
    if (previousWsl === undefined) {
      delete process.env.WSL_DISTRO_NAME;
    } else {
      process.env.WSL_DISTRO_NAME = previousWsl;
    }
    fs.readFileSync = readFileSync;
    os.freemem = freemem;
    os.totalmem = totalmem;
    os.hostname = hostname;
    os.userInfo = userInfo;
  }
}

function firstDifference(expected, actual) {
  const a = expected.split("\n");
  const b = actual.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return `line ${i + 1}\n  expected: ${a[i] ?? "(end of file)"}\n  actual:   ${b[i] ?? "(end of file)"}`;
    }
  }
  return "";
}

async function run(options = {}) {
  const update = Boolean(options.update);
  const rendered = frozen(() => inputs().map(([name, data]) => [name, renderSnapshot(name, data)]));

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  for (const [name, actual] of rendered) {
    const file = path.join(SNAPSHOT_DIR, `${name}.txt`);

    if (update) {
      fs.writeFileSync(file, actual, "utf8");
      record(`snapshot ${name} written`, true);
      continue;
    }

    if (!fs.existsSync(file)) {
      record(
        `snapshot ${name} matches`,
        false,
        `missing ${path.relative(process.cwd(), file)}; run npm run test:update`
      );
      continue;
    }

    const expected = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    record(
      `snapshot ${name} matches`,
      expected === actual,
      expected === actual
        ? ""
        : `${firstDifference(expected, actual)}\nIf this change is intended, run npm run test:update and commit tests/snapshots/.`
    );
  }
}

module.exports = { run, describe };
