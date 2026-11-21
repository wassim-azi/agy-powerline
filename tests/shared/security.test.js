// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { record, NODE, PAYLOAD, stageInstall, runCli } = require("../helpers");
const { renderStatusline, defaultConfig, clearExecCache } = require("../../src/lib/shared");
const { sanitizeExecOutput } = require("../../src/lib/exec");
const { isTrustedInstallDir, GLOBAL_DIR } = require("../../src/lib/paths");
const { stripControl } = require("../../src/lib/formatters");

// An exec widget whose command drops a marker file, so each test can tell
// whether the command actually ran.
function markerConfig(markerPath) {
  const target = markerPath.replace(/\\/g, "/");
  return {
    layout: "pills",
    widgets: [
      {
        id: "exec",
        cmd: `node -e "require('fs').writeFileSync(process.argv[1], 'ran'); console.log('ran')" "${target}"`,
        interval: 0,
        timeout: 5000,
      },
    ],
  };
}

function plantConfig(dir, markerPath) {
  stageInstall(dir);
  fs.writeFileSync(
    path.join(dir, "statusline.config.json"),
    JSON.stringify(markerConfig(markerPath), null, 2),
    "utf8"
  );
}

function isolatedEnv(home, extra = {}) {
  const env = { ...process.env };
  delete env.AGY_POWERLINE_HOME;
  return { ...env, HOME: home, USERPROFILE: home, ...extra };
}

function runRuntime(installDir, cwd, env) {
  const payload = JSON.stringify({ ...JSON.parse(PAYLOAD), cwd });
  return spawnSync(NODE, [path.join(installDir, "statusline.js")], {
    input: payload,
    encoding: "utf8",
    cwd,
    env,
    windowsHide: true,
    timeout: 30000,
  });
}

function consume(markerPath) {
  const ran = fs.existsSync(markerPath);
  fs.rmSync(markerPath, { force: true });
  return ran;
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-security-"));
  const home = path.join(root, "home");
  const repo = path.join(root, "repo");
  const planted = path.join(repo, ".agy-powerline");
  const marker = path.join(root, "MARKER");
  fs.mkdirSync(home, { recursive: true });
  plantConfig(planted, marker);
  const env = isolatedEnv(home);

  try {
    // CLI commands run inside a repo must not pick up its .agy-powerline.
    runCli(["render", "--demo"], { cwd: repo, env });
    record("render --demo ignores a planted ./.agy-powerline config", !consume(marker));

    const stdinRender = spawnSync(
      NODE,
      [path.join(__dirname, "..", "..", "src", "index.js"), "render"],
      {
        input: JSON.stringify({ ...JSON.parse(PAYLOAD), cwd: repo }),
        encoding: "utf8",
        cwd: repo,
        env,
        windowsHide: true,
        timeout: 30000,
      }
    );
    record(
      "render (stdin) ignores a planted ./.agy-powerline config",
      stdinRender.status === 0 && !consume(marker),
      `code ${stdinRender.status}`
    );

    runCli(["doctor"], { cwd: repo, env });
    record("doctor ignores a planted ./.agy-powerline config", !consume(marker));

    record(
      "init --project is rejected (project installs are not supported)",
      runCli(["init", "--project", "--yes"], { cwd: repo, env }).code === 1 && !consume(marker)
    );

    // A runtime copy outside a trusted dir (e.g. committed in a repo) blocks exec.
    const blocked = runRuntime(planted, repo, env);
    record(
      "runtime outside a trusted install dir blocks exec widgets",
      blocked.status === 0 && blocked.stdout.includes("[blocked]") && !consume(marker),
      `code ${blocked.status}`
    );

    const trusted = path.join(root, "trusted");
    plantConfig(trusted, marker);
    const trustedEnv = isolatedEnv(home, { AGY_POWERLINE_HOME: trusted });

    // Previews never execute, even when the config is trusted.
    const preview = runCli(["layout", "pills"], { cwd: repo, env: trustedEnv });
    record(
      "layout previews exec widgets as a placeholder without running them",
      preview.code === 0 && preview.stdout.includes("[cmd]") && !consume(marker),
      `code ${preview.code}`
    );

    // Runtime in a trusted install dir runs the command (positive control).
    const trustedRun = runRuntime(trusted, repo, trustedEnv);
    record(
      "trusted install (AGY_POWERLINE_HOME) runtime runs exec widgets",
      trustedRun.status === 0 && /ran/.test(trustedRun.stdout) && consume(marker),
      `code ${trustedRun.status}`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  record(
    "isTrustedInstallDir accepts the global dir and rejects a project dir",
    isTrustedInstallDir(GLOBAL_DIR, {}) &&
      !isTrustedInstallDir(path.join(process.cwd(), ".agy-powerline"), {})
  );

  // In-process rendering defaults to preview mode.
  const previewOut = renderStatusline(
    { ...JSON.parse(PAYLOAD), cwd: process.cwd() },
    { ...defaultConfig(), widgets: [{ id: "exec", cmd: "echo should-not-run" }] }
  );
  record(
    "renderStatusline shows exec placeholder unless exec: run is passed",
    previewOut.includes("[cmd]") && !previewOut.includes("should-not-run")
  );

  record(
    "sanitizeExecOutput strips CSI/OSC sequences and control characters",
    sanitizeExecOutput("a\x1b[31mb\x1b[0m") === "ab" &&
      sanitizeExecOutput("x\x1b]52;c;ZXZpbA==\x07y") === "xy" &&
      sanitizeExecOutput("p\x1b]8;;http://e\x1b\\q\x1b]8;;\x1b\\r") === "pqr" &&
      sanitizeExecOutput("bell\x07\r\x9bz") === "bellz"
  );

  record(
    "stripControl removes escapes with intermediate bytes (tput sgr0, DEC)",
    stripControl("a\x1b(Bb") === "ab" &&
      stripControl("\x1b(B\x1b[mplain") === "plain" &&
      stripControl("a\x1b)0b\x1b#8c") === "abc" &&
      stripControl("a\x1b7b\x1b8c\x1bcd") === "abcd"
  );

  record(
    "stripControl removes DCS, SOS, PM and APC control strings with their body",
    stripControl("a\x1bP0;1|x\x1b\\b") === "ab" &&
      stripControl("a\x1b_Gi=1\x1b\\b") === "ab" &&
      stripControl("a\x1bXsos\x1b\\b") === "ab" &&
      stripControl("a\x1b^pm\x07b") === "ab" &&
      stripControl("a\x90dcs\x9cb") === "ab" &&
      stripControl("a\x9d52;c;SECRET\x07b") === "ab" &&
      stripControl("a\x9fapc\x1b\\b") === "ab"
  );

  record(
    "stripControl removes 8-bit CSI with parameters, a bare 0x9B only itself",
    stripControl("\x9b31mred") === "red" &&
      stripControl("a\x9b2Jb") === "ab" &&
      stripControl("a\x9b?25lb") === "ab" &&
      stripControl("bell\x07\r\x9bz") === "bellz"
  );

  record(
    "sanitizeExecOutput caps output length",
    Array.from(sanitizeExecOutput("🌿".repeat(500))).length === 80
  );

  const coder = "👩\u200d💻";
  record(
    "sanitizeExecOutput caps output by grapheme cluster, never splitting one",
    sanitizeExecOutput(`${"a".repeat(78)}${coder}👍🏽`) === `${"a".repeat(78)}${coder}👍🏽` &&
      sanitizeExecOutput(`${"a".repeat(78)}👍🏽xx`) === `${"a".repeat(78)}👍🏽…` &&
      sanitizeExecOutput(`\x1b[32m${"a".repeat(78)}${coder}xx`, { colors: true }) ===
        `\x1b[32m${"a".repeat(78)}${coder}…\x1b[0m` &&
      sanitizeExecOutput(`\x1b[32m \u0301ok`, { colors: true }) === "\x1b[32m\u0301ok\x1b[0m"
  );

  clearExecCache();
  const hostile = renderStatusline(
    { ...JSON.parse(PAYLOAD), cwd: process.cwd() },
    {
      ...defaultConfig(),
      widgets: [
        {
          id: "exec",
          cmd: `node -e "process.stdout.write(String.fromCharCode(27) + ']52;c;ZXZpbA==' + String.fromCharCode(7) + 'clean')"`,
          timeout: 5000,
        },
      ],
    },
    { exec: "run" }
  );
  record(
    "exec output escape sequences are stripped before rendering",
    hostile.includes("clean") && !hostile.includes("]52;")
  );
  clearExecCache();
}

module.exports = { run };
