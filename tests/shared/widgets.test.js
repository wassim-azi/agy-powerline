"use strict";

const fs = require("fs");
const path = require("path");
const { record } = require("../helpers");
const { renderStatusline, defaultConfig } = require("../../src/lib/shared");
const { shortModelName, shouldBlink, resolveQuotaThresholds } = require("../../src/lib/formatters");
const { buildCustomTheme, THEMES } = require("../../src/lib/themes");

const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8"));

function render(data, widgets, options = {}) {
  return strip(
    renderStatusline(
      { ...data, terminal_width: options.width ?? 0 },
      { ...defaultConfig(), layout: options.layout || "pills", ascii: options.ascii, widgets },
      { color: options.color || "none" }
    )
  );
}

async function run() {
  testTightestQuota();
  testSplitTokens();
  testShortModel();
  testOneFormPerSetting();
  testTasks();
  testMode();
  testTitle();
}

function testTitle() {
  const real = fixture("antigravity-1.3.3-title.json");
  const title = [{ id: "title" }];

  record("title shows the conversation title", /💬 hello /.test(render(real, title)));
  record(
    "lines title shows the conversation title",
    /💬 hello/.test(render(real, title, { layout: "lines" }))
  );

  const long = renderStatusline(
    {
      ...real,
      terminal_width: 0,
      conversation_title: "Refactor the auth\nmiddleware and add \u001b[31mtests for it",
    },
    { ...defaultConfig(), widgets: title },
    { color: "none" }
  );
  record(
    "title is one line without escape sequences, cut to 30 columns",
    /💬 Refactor the auth middleware… /.test(long) && !long.includes("\u001b[31m"),
    JSON.stringify(long)
  );
  record(
    "ASCII title ends a cut with three dots",
    /Refactor the auth middlewar\.\.\. /.test(
      render({ ...real, conversation_title: "Refactor the auth middleware and more" }, title, {
        ascii: true,
      })
    )
  );

  const untitled = { ...real };
  delete untitled.conversation_title;
  record("title hides until the conversation has one", !/💬/.test(render(untitled, title)));
}

function testMode() {
  const real = fixture("antigravity-1.3.3-modes.json");
  const mode = [{ id: "mode" }];

  record(
    "mode shows the approval mode and the Vim mode",
    /accept-edits, INSERT/.test(render(real, mode))
  );
  record(
    "lines mode shows the approval mode and the Vim mode",
    /accept-edits, INSERT/.test(render(real, mode, { layout: "lines" }))
  );

  const vimOnly = { ...real };
  delete vimOnly.cycle_mode;
  record("mode shows the Vim mode alone", /🧭 INSERT /.test(render(vimOnly, mode)));

  const approvalOnly = { ...real };
  delete approvalOnly.vim;
  record("mode shows the approval mode alone", /🧭 accept-edits /.test(render(approvalOnly, mode)));

  const neither = { ...vimOnly, cycle_mode: "default" };
  delete neither.vim;
  record("mode hides in the default mode with Vim editing off", !/🧭/.test(render(neither, mode)));
}

function testTasks() {
  const real = fixture("antigravity-1.3.3-subagents.json");
  const tasks = [{ id: "tasks" }];

  record(
    "tasks shows running subagents and background tasks",
    /1 subagent, 1 task/.test(render(real, tasks))
  );
  record(
    "lines tasks shows running subagents and background tasks",
    /1 subagent, 1 task/.test(render(real, tasks, { layout: "lines" }))
  );

  // Finished subagents stay in the payload's list; they must not count.
  const mixed = {
    ...real,
    subagents: [{ status: "running" }, { status: "running" }, { status: "completed" }],
    task_count: 3,
  };
  record("tasks counts only running subagents", /2 subagents, 3 tasks/.test(render(mixed, tasks)));

  const idle = { ...real, subagents: [{ status: "completed" }] };
  delete idle.task_count;
  record("tasks hides when nothing runs", render(idle, tasks).trim() === "");
  record(
    "tasks shows background tasks alone",
    /👥 2 tasks /.test(render({ ...idle, task_count: 2 }, tasks))
  );
}

function testTightestQuota() {
  const real = fixture("antigravity-1.3.0.json");
  const quota = [{ id: "quota" }];

  // gemini-weekly (28.6%) is lower than gemini-5h (52.3%); the exhausted 3p
  // bucket belongs to third-party models, not to the Gemini model in use.
  const gemini = render(real, quota);
  record(
    "quota shows the tightest bucket for the Gemini model in use",
    /7d 28\.6% rem/.test(gemini) && /11hr 35m/.test(gemini) && !/3P/.test(gemini),
    gemini
  );

  const claude = render({ ...real, model: { display_name: "Claude Sonnet 4.6" } }, quota);
  record(
    "quota shows the third-party buckets for a non-Gemini model",
    /3P 7d 0\.0% rem/.test(claude),
    claude
  );

  const unknown = render(
    {
      model: { display_name: "Gemini 3.8 Flash" },
      quota: { "new-bucket": { remaining_fraction: 0.4 } },
    },
    quota
  );
  record(
    "quota falls back to every bucket when none matches the model",
    /new-bucket 40\.0% rem/.test(unknown),
    unknown
  );

  const disabled = render({ quota: { "3p-5h": { remaining_fraction: 0, disabled: true } } }, quota);
  record("quota hides when every bucket is disabled", disabled.trim() === "", disabled);

  const low = renderStatusline(
    { ...fixture("antigravity-near-limits.json"), terminal_width: 0 },
    { ...defaultConfig(), widgets: quota },
    { color: "truecolor" }
  );
  // dark-aurora danger color #f48771 at 3% left.
  record("quota turns to the danger color when nearly used up", low.includes("2;244;135;113m"));

  const lines = render(real, quota, { layout: "lines" });
  record(
    "lines quota shows the bucket, % left and reset",
    /Quota: 7d 28\.6% rem · 11hr 35m/.test(strip(lines)),
    lines
  );
}

function testSplitTokens() {
  const real = fixture("antigravity-1.3.0.json");
  const split = [{ id: "totalTokens", split: true }];

  record(
    "totalTokens shows the session total by default",
    /478\.2K/.test(render(real, [{ id: "totalTokens" }]))
  );
  record("totalTokens split shows input and output", /123\.1K↑ 355\.0K↓/.test(render(real, split)));
  record(
    "totalTokens split in ASCII mode uses in/out",
    /123\.1K in 355\.0K out/.test(render(real, split, { ascii: true }))
  );
  record(
    "lines totalTokens split shows input and output",
    /123\.1K↑ 355\.0K↓/.test(render(real, split, { layout: "lines" }))
  );
}

function testShortModel() {
  record(
    "shortModelName drops Gemini and joins the variant",
    shortModelName("Gemini 3.8 Flash (High)") === "3.8 Flash·High" &&
      shortModelName("Gemini 3.8 Flash (High)", true) === "3.8 Flash High" &&
      shortModelName("Claude Sonnet 4.6") === "Claude Sonnet 4.6" &&
      shortModelName("Claude Sonnet 4.6 (Thinking)") === "Claude Sonnet 4.6·Thinking"
  );

  const real = fixture("antigravity-1.3.0.json");
  record(
    "model short option shows the short name",
    /3\.8 Flash·High/.test(render(real, [{ id: "model", short: true }]))
  );

  // At 60 columns the first default row only fits once the model name is short.
  const narrow = render(
    { ...real, vcs: { type: "git", branch: "main" } },
    defaultConfig().widgets,
    {
      width: 60,
    }
  );
  record(
    "a narrow terminal shortens the model name before dropping widgets",
    /3\.8 Flash·High/.test(narrow) && !/Gemini 3\.8/.test(narrow),
    narrow
  );
}

// Each setting has one documented form; the other spellings do nothing.
function testOneFormPerSetting() {
  const quotaOnly = (thresholds, widget = {}) => resolveQuotaThresholds(widget, { thresholds });
  record(
    "only quotaWarn/quotaCrit and a widget's warn/crit set quota thresholds",
    quotaOnly({ quotaWarn: 40, quotaCrit: 5 }).warn === 40 &&
      quotaOnly({}, { warn: 25, crit: 3 }).crit === 3 &&
      quotaOnly({ fiveHourWarn: 50, weeklyWarn: 50, warn: 50 }).warn === 30 &&
      quotaOnly({}, { threshold: { warn: 50 } }).warn === 30
  );

  record(
    'blink takes true (danger) and "warn" (caution too); other values never blink',
    shouldBlink("crit", true) &&
      !shouldBlink("warn", true) &&
      shouldBlink("warn", "warn") &&
      shouldBlink("crit", "warn") &&
      !shouldBlink("crit", "crit") &&
      !shouldBlink("crit", "all") &&
      !shouldBlink("crit", "critical")
  );

  const real = fixture("antigravity-1.3.0.json");
  record(
    "customText shows text, ignores label, and hides without text",
    /Ship it/.test(render(real, [{ id: "customText", text: "Ship it" }])) &&
      render(real, [{ id: "customText", label: "Ship it" }]).trim() === ""
  );

  const execOut = renderStatusline(
    { ...real, terminal_width: 0 },
    { ...defaultConfig(), widgets: [{ id: "exec", command: "echo hi" }] }
  );
  record("exec runs cmd only and ignores a command key", strip(execOut).trim() === "");

  const base = THEMES["dark-aurora"].colors.model.join();
  record(
    'customTheme colors are read from "colors" only',
    buildCustomTheme({ colors: { model: "#ff0000" } }).colors.model.join() === "255,0,0" &&
      buildCustomTheme({ model: "#ff0000" }).colors.model.join() === base
  );
}

module.exports = { run };
