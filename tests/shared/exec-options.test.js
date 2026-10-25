// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { LAYOUT_ORDER } = require("../../src/lib/config");
const { record, PAYLOAD } = require("../helpers");
const { renderStatusline, defaultConfig, clearExecCache } = require("../../src/lib/shared");
const {
  sanitizeExecOutput,
  restoreAfterReset,
  execPayloadJson,
  widgetCacheKey,
} = require("../../src/lib/exec");
const { visibleWidth } = require("../../src/lib/formatters");

const ESC = "\x1b";
const RUN = { exec: "run", color: "truecolor", env: {} };

// Prints the given parts of the payload it reads on stdin, joined by "|".
// The same stdin read as the payload recipe in docs/configuration.md.
const readPayload = (expr) =>
  `node -e "const p=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(${expr})"`;

// Prints text built from character codes, so escapes survive any shell.
const printCodes = (text) =>
  `node -e "process.stdout.write(String.fromCharCode(${[...text].map((c) => c.charCodeAt(0)).join(",")}))"`;

function render(widgets, layout = "pills", data = JSON.parse(PAYLOAD), overrides = RUN) {
  clearExecCache();
  return renderStatusline(
    { ...data, cwd: process.cwd() },
    { ...defaultConfig(), layout, widgets },
    overrides
  );
}

function checkPayload() {
  const data = {
    ...JSON.parse(PAYLOAD),
    email: "someone@example.invalid",
    session_id: "session-1",
    conversation_id: "conversation-1",
    account: { email: "nested@example.invalid", plan: "pro" },
    model: { display_name: `Gemini${ESC}[2J` },
  };
  const json = JSON.parse(execPayloadJson(data));
  record(
    "the payload for exec drops the email and session and conversation IDs at any depth",
    !("email" in json) &&
      !("session_id" in json) &&
      !("conversation_id" in json) &&
      !("email" in json.account) &&
      json.account.plan === "pro" &&
      json.terminal_width === 100,
    JSON.stringify(json).slice(0, 200)
  );
  record(
    "the payload for exec has no control characters in its strings",
    json.model.display_name === "Gemini",
    JSON.stringify(json.model.display_name)
  );
  record("an unusable payload becomes an empty object", execPayloadJson(undefined) === "{}");

  for (const layout of LAYOUT_ORDER) {
    const out = render(
      [
        {
          id: "exec",
          cmd: readPayload("[p.model.display_name, p.terminal_width, 'email' in p].join('|')"),
          payload: true,
          interval: 0,
          timeout: 5000,
        },
      ],
      layout,
      { ...JSON.parse(PAYLOAD), email: "someone@example.invalid" }
    );
    record(
      `${layout}: an exec command with "payload": true reads the session JSON on stdin`,
      out.includes("Gemini 3.8 Flash (High)|100|false"),
      out
    );
  }

  const closed = render([
    { id: "exec", cmd: readPayload("'got:' + Object.keys(p).length"), interval: 0, timeout: 5000 },
  ]);
  record(
    'without "payload", the command gets no stdin',
    !/got:[1-9]/.test(closed),
    JSON.stringify(closed)
  );

  record(
    "commands with and without payload or colors don't share cached output",
    new Set([
      widgetCacheKey({ cmd: "x" }, "/"),
      widgetCacheKey({ cmd: "x", payload: true }, "/"),
      widgetCacheKey({ cmd: "x", colors: true }, "/"),
    ]).size === 3
  );
}

function checkColors() {
  const colored = `  ${ESC}[31mred${ESC}[0m plain${ESC}]0;title\x07${ESC}[2J${ESC}]52;c;ZXZpbA==\x07 done  `;
  const kept = sanitizeExecOutput(colored, { colors: true });
  record(
    "colors keeps SGR, removes titles, clipboard writes and screen clearing, and trims",
    kept === `${ESC}[31mred${ESC}[0m plain done${ESC}[0m`,
    JSON.stringify(kept)
  );
  record(
    "without colors every escape is removed, as before",
    sanitizeExecOutput(colored) === "red plain done"
  );
  record(
    "colon-form colors are removed with the other escapes",
    !sanitizeExecOutput(`${ESC}[38:2::1:2:3mx`, { colors: true }).includes("38:2")
  );

  const long = sanitizeExecOutput(`${ESC}[32m${"x".repeat(200)}`, { colors: true });
  record(
    "colored output is capped at 80 visible characters, with a reset at the end",
    visibleWidth(long) === 80 && long.endsWith(`…${ESC}[0m`) && long.startsWith(`${ESC}[32m`),
    `${visibleWidth(long)} ${JSON.stringify(long.slice(-8))}`
  );

  record(
    "a reset gets the widget's colors back; 38;5;0 is a color, not a reset",
    restoreAfterReset(`a${ESC}[0mb${ESC}[mc${ESC}[0;31md${ESC}[38;5;0me`, "<R>") ===
      `a${ESC}[0m<R>b${ESC}[0m<R>c${ESC}[0m<R>${ESC}[31md${ESC}[38;5;0me`
  );

  const cmd = printCodes(`${ESC}[31mred${ESC}[0m after`);
  const pills = render([{ id: "exec", cmd, colors: true, interval: 0, timeout: 5000 }]);
  const pillStyle = /\x1b\[48;2;\d+;\d+;\d+m\x1b\[38;2;\d+;\d+;\d+m\x1b\[1m/.exec(pills)?.[0];
  record(
    "pills: the command's colors show and the pill's colors come back after its reset",
    pills.includes(`${ESC}[31mred${ESC}[0m${pillStyle} after`),
    JSON.stringify(pills)
  );

  const lines = render([{ id: "exec", cmd, colors: true, interval: 0, timeout: 5000 }], "lines");
  record(
    "lines: the command's colors show and the widget color comes back after its reset",
    /\x1b\[31mred\x1b\[0m\x1b\[38;2;\d+;\d+;\d+m after/.test(lines),
    JSON.stringify(lines)
  );

  const none = render(
    [{ id: "exec", cmd, colors: true, interval: 0, timeout: 5000 }],
    "pills",
    undefined,
    {
      exec: "run",
      color: "none",
      env: {},
    }
  );
  record(
    "with no color depth, the command's colors are dropped too",
    none.includes("red after") && !none.includes(`${ESC}[31m`),
    JSON.stringify(none)
  );

  const plain = render([{ id: "exec", cmd, interval: 0, timeout: 5000 }]);
  record(
    'without "colors", command colors are stripped as before',
    plain.includes("red after") && !plain.includes(`${ESC}[31m`)
  );
}

// The session-field recipe exactly as docs/configuration.md shows it.
function checkRecipe() {
  const fs = require("fs");
  const path = require("path");
  const docs = fs.readFileSync(
    path.join(__dirname, "..", "..", "docs", "configuration.md"),
    "utf8"
  );
  const block = [...docs.matchAll(/```json\n([\s\S]*?)```/g)]
    .map((m) => m[1])
    .find((json) => json.includes('"label": "Model id"'));
  let widget = null;
  try {
    widget = JSON.parse(block);
  } catch {
    // reported below
  }
  const data = { ...JSON.parse(PAYLOAD), model: { id: "gemini-3.8-flash", display_name: "Flash" } };
  const out = widget ? render([{ ...widget, timeout: 5000 }], "pills", data) : "";
  record(
    "the session-field recipe in docs/configuration.md prints the model id",
    out.includes("Model id: gemini-3.8-flash"),
    widget ? JSON.stringify(out) : "recipe block not found or not valid JSON"
  );
}

// The ccusage recipe's parsing half (after the pipe), run through the shell
// the way exec runs it, on JSON shaped like `ccusage antigravity daily --json`.
// CI has no ccusage, so the ccusage half is checked by hand.
function checkCcusageRecipe() {
  const fs = require("fs");
  const path = require("path");
  const { execSync } = require("child_process");
  const docs = fs.readFileSync(
    path.join(__dirname, "..", "..", "docs", "configuration.md"),
    "utf8"
  );
  const block = [...docs.matchAll(/```json\n([\s\S]*?)```/g)]
    .map((m) => m[1])
    .find((json) => json.includes("ccusage antigravity daily"));
  let parser = "";
  try {
    const { cmd } = JSON.parse(block);
    parser = cmd.slice(cmd.indexOf("| ") + 2);
  } catch {
    // reported below
  }
  const daily = (totalTokens) =>
    JSON.stringify({
      daily: [{ date: "2026-10-18", inputTokens: 1, outputTokens: 1, totalTokens }],
      totals: {
        inputTokens: 1,
        outputTokens: 1,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens,
      },
    });
  const parse = (input) => {
    try {
      return execSync(parser, {
        input,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      }).trim();
    } catch (err) {
      return `error: ${err.message}`;
    }
  };
  const outputs = [
    parse(daily(1234567)),
    parse(daily(845321)),
    parse(daily(512)),
    parse(daily(0)),
    parse("not json"),
  ];
  record(
    "the ccusage recipe formats today's total like the bar, and prints nothing without one",
    parser.startsWith("node -e") &&
      JSON.stringify(outputs) ===
        JSON.stringify(["1.2M today", "845.3K today", "512 today", "", ""]),
    JSON.stringify(outputs)
  );
}

async function run() {
  try {
    checkPayload();
    checkColors();
    checkRecipe();
    checkCcusageRecipe();
  } finally {
    clearExecCache();
  }
}

module.exports = { run };
