"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  resolveInstallDir,
  AGY_SETTINGS,
  statuslineCommand,
  readInstallMeta,
  readAgySettings,
  isWsl,
  isWindowsNodeOnWsl,
  windowsNodeOnWslMessage,
  cmdBreakingChars,
  cmdBreakingMessage,
} = require("../lib/paths");
const {
  sampleData,
  renderStatusline,
  loadConfig,
  readConfigFile,
  setConfigDir,
} = require("../lib/shared");
const { runStatuslineCommand } = require("../lib/run");
const { detectColorDepth } = require("../lib/colors");
const { readLog, getLogPath } = require("../lib/log");
const { version } = require("../../package.json");

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function line(label, value) {
  const pad = label.padEnd(14);
  console.log(`  ${DIM}${pad}${RESET}${value}`);
}

// Markdown output gets pasted into public issues, so the home folder (and
// with it the username) becomes ~, wherever it appears.
function tildify(text) {
  const home = os.homedir();
  if (!home || home.length < 4) {
    return String(text);
  }
  let out = String(text);
  for (const variant of [home, home.replace(/\\/g, "/")]) {
    out = out.split(variant).join("~");
  }
  return out;
}

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, "");
}

async function doctorCommand(options = {}) {
  const installDir = resolveInstallDir();
  const meta = readInstallMeta(installDir);
  const settings = readAgySettings();
  const expected = fs.existsSync(path.join(installDir, "statusline.js"))
    ? statuslineCommand(installDir)
    : "";
  const configured = settings?.statusLine?.command || "";
  const wsl = isWsl();
  const windowsNode = isWindowsNodeOnWsl();
  const colorDepth = detectColorDepth(process.env);
  const term = process.env.TERM || "(unset)";
  const colorterm = process.env.COLORTERM || "(unset)";

  if (options && options.markdown) {
    console.log("### System & Environment Diagnostics");
    console.log();
    console.log("| Property | Value |");
    console.log("| :--- | :--- |");
    console.log(`| **CLI Version** | \`v${version}\` |`);
    console.log(`| **Platform** | \`${process.platform}${wsl ? " (WSL)" : ""}\` |`);
    console.log(`| **Node.js** | \`${process.version}\` (\`${tildify(process.execPath)}\`) |`);
    console.log(`| **TERM** | \`${term}\` |`);
    console.log(`| **COLORTERM** | \`${colorterm}\` |`);
    console.log(`| **Color Depth** | \`${colorDepth}\` |`);
    console.log(`| **Install Dir** | \`${tildify(installDir)}\` |`);
    console.log(
      `| **Statusline Command** | \`${configured ? tildify(configured) : "(missing)"}\` |`
    );
    console.log(
      `| **Stack with Default** | \`${settings?.statusLine?.stack_with_default ? "true" : "false"}\` |`
    );
    console.log(
      `| **Enabled** | \`${settings?.statusLine?.enabled === false ? "false" : "true"}\` |`
    );
    console.log();
    console.log("```text");
    console.log("Glyph Test:     󰊤 ⚡ 💻 🌿 ⏳ 💾");
    console.log("```");
    console.log();
    return;
  }

  console.log();
  console.log(`${BOLD} agy-powerline doctor${RESET} ${DIM}v${version}${RESET}`);
  console.log();
  line("platform", `${process.platform}${wsl ? " (WSL)" : ""}`);
  line("node", `${process.version} (${process.execPath})`);
  line("term", `${term} (colorterm: ${colorterm})`);
  line("colors", `${colorDepth}`);
  line("glyphs test", `    󰊤 ⚡ 💻 🌿 ⏳ 💾`);
  line("install dir", installDir);
  line("config", path.join(installDir, "statusline.config.json"));
  line("settings", AGY_SETTINGS);
  line("command", configured || `${DIM}(missing)${RESET}`);
  const logEntries = readLog(getLogPath(installDir)).length;
  line(
    "problem log",
    logEntries
      ? `${YELLOW}${logEntries} ${logEntries === 1 ? "entry" : "entries"}${RESET} (run npx agy-powerline report)`
      : "empty"
  );
  if (settings?.statusLine?.stack_with_default) {
    line("stacked", `${CYAN}yes${RESET} (rendered below Antigravity default statusline)`);
  }
  if (typeof settings?.statusLine?.padding === "number") {
    line("padding", `${settings.statusLine.padding} blank line(s)`);
  }

  let failed = 0;

  if (windowsNode) {
    failed += 1;
    console.log();
    console.log(`${RED} Windows Node on WSL${RESET}`);
    console.log(windowsNodeOnWslMessage());
  }

  setConfigDir(installDir);
  const configState = readConfigFile();
  if (configState.error) {
    failed += 1;
    console.log();
    console.log(`${RED} statusline.config.json is not valid JSON.${RESET}`);
    console.log(`  ${DIM}${configState.error}${RESET}`);
    console.log("  The bar shows the defaults until you fix the file or delete it.");
  }

  const breaking = cmdBreakingChars(installDir);
  if (breaking.length) {
    failed += 1;
    console.log();
    console.log(`${RED} The install folder breaks the Windows statusline command.${RESET}`);
    console.log(`  ${cmdBreakingMessage(breaking)}`);
  }

  if (settings?.statusLine?.enabled === false) {
    failed += 1;
    console.log();
    console.log(
      `${RED} statusLine.enabled is false in settings.json, so Antigravity does not run the bar.${RESET}`
    );
    console.log("  Set it to true or remove it (npx agy-powerline init --yes does it for you).");
  }

  if (meta?.version && meta.version !== version) {
    console.log();
    console.log(
      `${YELLOW} Installed scripts are v${meta.version}; this CLI is v${version}.${RESET}`
    );
    console.log("  Re-run: npx agy-powerline init --yes");
  }

  if (!fs.existsSync(path.join(installDir, "statusline.js"))) {
    failed += 1;
    console.log();
    console.log(`${RED} No statusline.js in the install dir.${RESET}`);
    console.log("  Run: npx agy-powerline init --yes");
  } else if (configured && expected && configured !== expected) {
    console.log();
    console.log(`${YELLOW} settings.json command does not match this install.${RESET}`);
    console.log(`  expected  ${expected}`);
    console.log(`  actual    ${configured}`);
  }

  if (!configured) {
    failed += 1;
    console.log();
    console.log(`${RED} No statusLine.command in settings.json.${RESET}`);
    console.log("  Run: npx agy-powerline init --yes");
    console.log(`  (or inside Antigravity TUI: /statusline ${expected})`);
  }

  const command = configured || expected;

  if (command && fs.existsSync(path.join(installDir, "statusline.js"))) {
    setConfigDir(installDir);
    const payload = JSON.stringify(sampleData());
    const started = Date.now();
    const result = await runStatuslineCommand(command, payload);
    const ms = Date.now() - started;
    const preview = stripAnsi(result.stdout).split(/\r?\n/).filter(Boolean)[0] || "";

    console.log();
    if (result.code === 0 && /[A-Za-z]/.test(preview)) {
      line("spawn", `${GREEN}ok${RESET} (${ms}ms)`);
      // The flex separator pads to the terminal width; shrink those gaps so
      // the widgets fit in the preview on wide terminals.
      line("output", preview.replace(/ {3,}/g, "  ").slice(0, 120));
    } else {
      failed += 1;
      line("spawn", `${RED}failed${RESET} exit ${result.code} (${ms}ms)`);
      if (result.stderr.trim()) {
        console.log(`  ${DIM}${result.stderr.trim().slice(0, 400)}${RESET}`);
      }
    }

    const local = renderStatusline(sampleData(), loadConfig());
    if (!local) {
      failed += 1;
      console.log(`${RED} Local renderer returned empty output.${RESET}`);
    }
  }

  console.log();
  if (failed) {
    console.log(`${RED} ${failed} issue${failed === 1 ? "" : "s"}${RESET}`);
    process.exitCode = 1;
  } else {
    console.log(`${GREEN} ok${RESET}`);
  }
  console.log();
}

module.exports = {
  doctorCommand,
};
