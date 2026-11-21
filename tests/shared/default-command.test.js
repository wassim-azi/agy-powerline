// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { PassThrough } = require("stream");
const { spawnSync } = require("child_process");
const { record, runCli, stripAnsi, ROOT, NODE, PAYLOAD } = require("../helpers");
const {
  configureCommand,
  deprecatedConfigureCommand,
  DEPRECATED_CONFIGURE_DELAY_MS,
} = require("../../src/cli/configure");
const { version: VERSION } = require("../../package.json");

function sandbox(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `agy-default-${name}-`));
  const home = path.join(root, "home");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;
  return {
    root,
    home,
    env,
    installDir: path.join(home, ".agy-powerline"),
    settingsPath: path.join(home, ".gemini", "antigravity-cli", "settings.json"),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function writeSettings(box, content) {
  fs.mkdirSync(path.dirname(box.settingsPath), { recursive: true });
  fs.writeFileSync(
    box.settingsPath,
    typeof content === "string" ? content : JSON.stringify(content, null, 2),
    "utf8"
  );
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// Runs a script inside a fresh Node process with sandbox HOME/USERPROFILE so
// AGY_SETTINGS and resolveInstallDir() point strictly inside the sandbox.
function runInSandbox(box, script) {
  const res = spawnSync(NODE, ["-e", script], {
    cwd: ROOT,
    env: box.env,
    encoding: "utf8",
    timeout: 15000,
    windowsHide: true,
  });
  return {
    code: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || (res.error ? String(res.error) : ""),
  };
}

function testPipedStdinAndNonTtyStdout() {
  const box = sandbox("dispatch");
  try {
    const piped = runCli([], { env: box.env, input: PAYLOAD });
    record(
      "bare command with piped stdin renders the statusline and exits 0",
      piped.code === 0 && /Gemini/.test(stripAnsi(piped.stdout)),
      `exit ${piped.code}: ${piped.stderr}`
    );

    const empty = runCli([], { env: box.env, input: "" });
    record(
      "bare command with empty piped stdin exits 0 without hanging",
      empty.code === 0 && empty.stdout === "",
      `exit ${empty.code}`
    );

    const nonTtyOut = runInSandbox(
      box,
      [
        "process.stdin.isTTY = true;",
        "Object.defineProperty(process.stdout, 'isTTY', { value: false });",
        "require('./src/index.js');",
      ].join(" ")
    );
    record(
      "bare command with TTY stdin and non-TTY stdout prints programHelp() and exits 0",
      nonTtyOut.code === 0 &&
        /Usage: agy-powerline/.test(nonTtyOut.stdout) &&
        /Commands:/.test(nonTtyOut.stdout) &&
        !fs.existsSync(box.installDir) &&
        !fs.existsSync(box.settingsPath),
      `exit ${nonTtyOut.code}: ${nonTtyOut.stderr}`
    );
  } finally {
    box.cleanup();
  }
}

function testFreshUnifiedInstall() {
  const box = sandbox("fresh");
  try {
    writeSettings(box, { theme: "dark" });
    const res = runInSandbox(
      box,
      `
      const { PassThrough } = require("stream");
      const { defaultInteractiveCommand } = require("./src/cli/default");
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      stdin.isTTY = true;
      stdin.setRawMode = () => {};
      stdout.isTTY = true;
      stdout.columns = 100;
      stdout.rows = 30;
      let sentQuit = false;
      let tuiOutput = "";
      stdout.on("data", (chunk) => {
        tuiOutput += chunk.toString("utf8");
        if (!sentQuit && tuiOutput.includes("Your widgets")) {
          sentQuit = true;
          stdin.write("q");
        }
      });
      defaultInteractiveCommand({ stdin, stdout }).then((ok) => {
        process.stdout.write(JSON.stringify({ ok, exitCode: process.exitCode || 0 }));
      });
      `
    );

    const settings = readJson(box.settingsPath);
    const config = readJson(path.join(box.installDir, "statusline.config.json"));
    const meta = readJson(path.join(box.installDir, "install.json"));
    const hasCmd =
      process.platform !== "win32" || fs.existsSync(path.join(box.installDir, "statusline.cmd"));
    const summary = stripAnsi(res.stdout);

    record(
      "bare interactive fresh install creates scripts, config, settings backup, launches TUI and prints summary",
      res.code === 0 &&
        res.stdout.includes('{"ok":true,"exitCode":0}') &&
        fs.existsSync(path.join(box.installDir, "statusline.js")) &&
        hasCmd &&
        Boolean(config?.$schema) &&
        meta?.version === VERSION &&
        settings?.theme === "dark" &&
        settings?.statusLine?.type === "command" &&
        /statusline\.(js|cmd)/.test(settings.statusLine.command || "") &&
        fs.existsSync(`${box.settingsPath}.agy-powerline.bak`) &&
        /Installed/.test(summary) &&
        /Restart `agy`/.test(summary),
      `exit ${res.code}: ${res.stderr}\n${summary}`
    );
  } finally {
    box.cleanup();
  }
}

function testExistingAndStaleInstall() {
  const box = sandbox("existing");
  try {
    runCli(["init", "--yes"], { env: box.env });
    const cfgPath = path.join(box.installDir, "statusline.config.json");
    const cfg = readJson(cfgPath);
    fs.writeFileSync(cfgPath, JSON.stringify({ ...cfg, theme: "dark-ocean" }, null, 2), "utf8");

    const settings = readJson(box.settingsPath);
    settings.statusLine.command += " --theme light-paper";
    writeSettings(box, settings);

    // Up-to-date existing install keeps config and render flags, invokes TUI without reinstalling.
    const upToDate = runInSandbox(
      box,
      `
      const { PassThrough } = require("stream");
      const { defaultInteractiveCommand } = require("./src/cli/default");
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      stdin.isTTY = true;
      stdout.isTTY = true;
      let launched = 0;
      defaultInteractiveCommand({
        stdin,
        stdout,
        launchTui: async () => { launched += 1; return true; },
      }).then((ok) => {
        process.stdout.write(JSON.stringify({ ok, launched }));
      });
      `
    );
    record(
      "existing up-to-date install preserves config and appendedRenderFlags and opens TUI",
      upToDate.code === 0 &&
        upToDate.stdout.includes('{"ok":true,"launched":1}') &&
        readJson(cfgPath)?.theme === "dark-ocean" &&
        readJson(box.settingsPath)?.statusLine?.command === settings.statusLine.command,
      upToDate.stderr || upToDate.stdout
    );

    // Stale install.json version refreshes scripts without overwriting config or render flags.
    const metaPath = path.join(box.installDir, "install.json");
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ ...readJson(metaPath), version: "0.0.1" }, null, 2),
      "utf8"
    );
    const scriptPath = path.join(box.installDir, "statusline.js");
    fs.appendFileSync(scriptPath, "\n// stale bundle\n", "utf8");

    const stale = runInSandbox(
      box,
      `
      const { PassThrough } = require("stream");
      const { defaultInteractiveCommand } = require("./src/cli/default");
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      stdin.isTTY = true;
      stdout.isTTY = true;
      let receivedFlash = "";
      defaultInteractiveCommand({
        stdin,
        stdout,
        launchTui: async (opts) => { receivedFlash = opts.flash || ""; return true; },
      }).then((ok) => {
        process.stdout.write(JSON.stringify({ ok, receivedFlash }));
      });
      `
    );
    const staleSummary = stripAnsi(stale.stdout);
    record(
      "outdated install refreshes scripts and install.json while keeping config and appendedRenderFlags",
      stale.code === 0 &&
        stale.stdout.includes('"ok":true') &&
        readJson(metaPath)?.version === VERSION &&
        !fs.readFileSync(scriptPath, "utf8").includes("// stale bundle") &&
        readJson(cfgPath)?.theme === "dark-ocean" &&
        readJson(box.settingsPath)?.statusLine?.command === settings.statusLine.command &&
        /Updated scripts/.test(staleSummary),
      stale.stderr || staleSummary
    );
  } finally {
    box.cleanup();
  }
}

function testGuardsAndPartialInstall() {
  // Invalid settings.json
  const badSettings = sandbox("bad-settings");
  try {
    const raw = '{\n  // comment\n  "theme": "dark"\n}\n';
    writeSettings(badSettings, raw);
    const res = runInSandbox(
      badSettings,
      `
      const { PassThrough } = require("stream");
      const { defaultInteractiveCommand } = require("./src/cli/default");
      let launched = false;
      defaultInteractiveCommand({
        stdin: Object.assign(new PassThrough(), { isTTY: true }),
        stdout: Object.assign(new PassThrough(), { isTTY: true }),
        launchTui: async () => { launched = true; return true; },
      }).then((ok) => {
        process.stdout.write(JSON.stringify({ ok, launched, exitCode: process.exitCode || 0 }));
      });
      `
    );
    record(
      "invalid settings.json aborts cleanly before touching files or entering TUI",
      res.code === 1 &&
        res.stdout.includes('{"ok":false,"launched":false,"exitCode":1}') &&
        /not valid JSON/i.test(res.stderr) &&
        fs.readFileSync(badSettings.settingsPath, "utf8") === raw &&
        !fs.existsSync(path.join(badSettings.installDir, "statusline.js")),
      res.stderr || res.stdout
    );
  } finally {
    badSettings.cleanup();
  }

  // Invalid statusline.config.json
  const badConfig = sandbox("bad-config");
  try {
    runCli(["init", "--yes"], { env: badConfig.env });
    const cfgPath = path.join(badConfig.installDir, "statusline.config.json");
    const broken = '{ "theme": ';
    fs.writeFileSync(cfgPath, broken, "utf8");
    const res = runInSandbox(
      badConfig,
      `
      const { PassThrough } = require("stream");
      const { defaultInteractiveCommand } = require("./src/cli/default");
      let launched = false;
      defaultInteractiveCommand({
        stdin: Object.assign(new PassThrough(), { isTTY: true }),
        stdout: Object.assign(new PassThrough(), { isTTY: true }),
        launchTui: async () => { launched = true; return true; },
      }).then((ok) => {
        process.stdout.write(JSON.stringify({ ok, launched, exitCode: process.exitCode || 0 }));
      });
      `
    );
    record(
      "invalid statusline.config.json aborts via printInvalidConfig before entering TUI",
      res.code === 1 &&
        res.stdout.includes('{"ok":false,"launched":false,"exitCode":1}') &&
        /not valid JSON/i.test(res.stderr) &&
        fs.readFileSync(cfgPath, "utf8") === broken,
      res.stderr || res.stdout
    );
  } finally {
    badConfig.cleanup();
  }

  // Foreign statusLine: decline then accept
  const foreign = sandbox("foreign");
  try {
    const original = JSON.stringify(
      { theme: "dark", statusLine: { type: "command", command: "other-tool" } },
      null,
      2
    );
    writeSettings(foreign, original);

    const declined = runInSandbox(
      foreign,
      `
      const { PassThrough } = require("stream");
      const { defaultInteractiveCommand } = require("./src/cli/default");
      let launched = false;
      defaultInteractiveCommand({
        stdin: Object.assign(new PassThrough(), { isTTY: true }),
        stdout: Object.assign(new PassThrough(), { isTTY: true }),
        createRl: () => ({ question: (_q, cb) => cb("n"), close: () => {} }),
        launchTui: async () => { launched = true; return true; },
      }).then((ok) => {
        process.stdout.write(JSON.stringify({ ok, launched, exitCode: process.exitCode || 0 }));
      });
      `
    );
    record(
      "declining foreign statusLine leaves settings.json untouched, prints manual command, and skips TUI",
      declined.code === 0 &&
        declined.stdout.includes('{"ok":false,"launched":false,"exitCode":0}') &&
        fs.readFileSync(foreign.settingsPath, "utf8") === original &&
        /Set statusLine\.command to:/.test(stripAnsi(declined.stdout)),
      declined.stderr || declined.stdout
    );

    const accepted = runInSandbox(
      foreign,
      `
      const { PassThrough } = require("stream");
      const { defaultInteractiveCommand } = require("./src/cli/default");
      let launched = false;
      defaultInteractiveCommand({
        stdin: Object.assign(new PassThrough(), { isTTY: true }),
        stdout: Object.assign(new PassThrough(), { isTTY: true }),
        createRl: () => ({ question: (_q, cb) => cb("y"), close: () => {} }),
        launchTui: async () => { launched = true; return true; },
      }).then((ok) => {
        process.stdout.write(JSON.stringify({ ok, launched }));
      });
      `
    );
    record(
      "accepting foreign statusLine backs up settings.json, wires it, and launches TUI",
      accepted.code === 0 &&
        accepted.stdout.includes('{"ok":true,"launched":true}') &&
        readJson(foreign.settingsPath)?.statusLine?.command !== "other-tool" &&
        fs.existsSync(`${foreign.settingsPath}.agy-powerline.bak`),
      accepted.stderr || accepted.stdout
    );
  } finally {
    foreign.cleanup();
  }

  // Partial install: statusline.js exists without settings.json entry
  const partial = sandbox("partial");
  try {
    fs.mkdirSync(partial.installDir, { recursive: true });
    fs.writeFileSync(path.join(partial.installDir, "statusline.js"), "// old", "utf8");
    const cfgPath = path.join(partial.installDir, "statusline.config.json");
    fs.writeFileSync(cfgPath, JSON.stringify({ theme: "dark-ember" }, null, 2), "utf8");

    const res = runInSandbox(
      partial,
      `
      const { PassThrough } = require("stream");
      const { defaultInteractiveCommand } = require("./src/cli/default");
      let launched = false;
      defaultInteractiveCommand({
        stdin: Object.assign(new PassThrough(), { isTTY: true }),
        stdout: Object.assign(new PassThrough(), { isTTY: true }),
        createRl: () => ({ question: (_q, cb) => cb("y"), close: () => {} }),
        launchTui: async () => { launched = true; return true; },
      }).then((ok) => {
        process.stdout.write(JSON.stringify({ ok, launched }));
      });
      `
    );
    record(
      "partial install repairs scripts and settings.json while keeping existing config",
      res.code === 0 &&
        res.stdout.includes('{"ok":true,"launched":true}') &&
        readJson(cfgPath)?.theme === "dark-ember" &&
        /statusline\.(js|cmd)/.test(readJson(partial.settingsPath)?.statusLine?.command || ""),
      res.stderr || res.stdout
    );
  } finally {
    partial.cleanup();
  }
}

async function testConfigureCleanup() {
  const box = sandbox("configure-cleanup");
  try {
    fs.mkdirSync(box.installDir, { recursive: true });
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const rawModes = [];
    let pauseCalls = 0;
    let onExitCalls = 0;

    stdin.isTTY = true;
    stdin.setRawMode = (mode) => {
      rawModes.push(mode);
    };
    const origPause = stdin.pause.bind(stdin);
    stdin.pause = () => {
      pauseCalls += 1;
      return origPause();
    };
    stdout.isTTY = true;
    stdout.columns = 100;
    stdout.rows = 30;

    let rendered = "";
    let quitSent = false;
    stdout.on("data", (chunk) => {
      rendered += chunk.toString("utf8");
      if (!quitSent && rendered.includes("Your widgets")) {
        quitSent = true;
        stdin.write("q");
      }
    });

    const sigintBefore = process.listenerCount("SIGINT");
    const sigtermBefore = process.listenerCount("SIGTERM");

    const result = await configureCommand({
      stdin,
      stdout,
      configDir: box.installDir,
      onExit: () => {
        onExitCalls += 1;
      },
    });

    const sigintAfter = process.listenerCount("SIGINT");
    const sigtermAfter = process.listenerCount("SIGTERM");

    record(
      "configureCommand resolves cleanly, detaches listeners, and restores terminal state",
      result === true &&
        onExitCalls === 1 &&
        stdin.listenerCount("keypress") === 0 &&
        stdout.listenerCount("resize") === 0 &&
        sigintAfter === sigintBefore &&
        sigtermAfter === sigtermBefore &&
        rawModes[0] === true &&
        rawModes.at(-1) === false &&
        pauseCalls >= 1 &&
        rendered.startsWith("\x1b[?1049h\x1b[?25l") &&
        rendered.endsWith("\x1b[?25h\x1b[?1049l"),
      JSON.stringify({
        result,
        onExitCalls,
        keypress: stdin.listenerCount("keypress"),
        resize: stdout.listenerCount("resize"),
        sigintBefore,
        sigintAfter,
        sigtermBefore,
        sigtermAfter,
        rawModes,
        pauseCalls,
      })
    );
  } finally {
    box.cleanup();
  }
}

async function testDeprecatedConfigureWarning() {
  const box = sandbox("deprecated-configure");
  try {
    fs.mkdirSync(box.installDir, { recursive: true });
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    stdin.isTTY = true;
    stdin.setRawMode = () => {};
    stdout.isTTY = true;
    stdout.columns = 100;
    stdout.rows = 30;

    let rendered = "";
    let warnings = "";
    let quitSent = false;
    stderr.on("data", (chunk) => {
      warnings += chunk.toString("utf8");
    });
    stdout.on("data", (chunk) => {
      rendered += chunk.toString("utf8");
      if (!quitSent && rendered.includes("Your widgets")) {
        quitSent = true;
        stdin.write("q");
      }
    });

    const pending = deprecatedConfigureCommand({
      stdin,
      stdout,
      stderr,
      configDir: box.installDir,
      delayMs: 30,
    });
    // Immediately after invoking, warning is shown but TUI alternate screen must not have opened yet.
    const openedBeforeDelay = rendered.length > 0;
    const result = await pending;

    const nonTty = runCli(["configure"], { env: box.env });
    record(
      "deprecated configure prints obsolete warning, delays before opening TUI, and defaults to 5s",
      result === true &&
        DEPRECATED_CONFIGURE_DELAY_MS === 5000 &&
        !openedBeforeDelay &&
        /Warning: The 'configure' parameter.*obsolete.*removed in the next releases.*npx agy-powerline/i.test(
          warnings
        ) &&
        /Opening editor in 1s/.test(warnings) &&
        rendered.includes("Your widgets") &&
        nonTty.code === 1 &&
        /Warning: The 'configure' parameter.*obsolete/i.test(nonTty.stderr),
      JSON.stringify({ result, openedBeforeDelay, warnings, nonTtyStderr: nonTty.stderr })
    );
  } finally {
    box.cleanup();
  }
}

async function run() {
  testPipedStdinAndNonTtyStdout();
  testFreshUnifiedInstall();
  testExistingAndStaleInstall();
  testGuardsAndPartialInstall();
  await testConfigureCleanup();
  await testDeprecatedConfigureWarning();
}

module.exports = { run };
