const fs = require("fs");
const path = require("path");
const { defaultConfig, saveConfig, setConfigDir } = require("../lib/shared");
const {
  AGY_SETTINGS,
  RUNTIME_FILES,
  resolveInstallDir,
  statuslineCommand,
  writeWindowsLauncher,
  writeInstallMeta,
  readSettingsForUpdate,
  settingsBackupPath,
  writeJsonSafely,
  restrictPrivateFiles,
  isWindowsNodeOnWsl,
  windowsNodeOnWslMessage,
  cmdBreakingChars,
  cmdBreakingMessage,
} = require("../lib/paths");
const { createRl, confirm } = require("../lib/prompt");
const { buildRuntimeBundle } = require("./bundle");

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

// Up to 1.1.0 the runtime was installed as separate files next to
// statusline.js. They are part of the one-file statusline.js now; delete the
// old copies by name (regular files only), then the emptied layouts folder.
function removeSeparateRuntimeFiles(installDir) {
  for (const rel of RUNTIME_FILES) {
    const file = path.join(installDir, rel);
    try {
      if (fs.lstatSync(file).isFile()) {
        fs.unlinkSync(file);
      }
    } catch {
      // Not there: nothing to remove.
    }
  }
  try {
    fs.rmdirSync(path.join(installDir, "layouts"));
  } catch {
    // Missing, or holds something that isn't ours: leave it.
  }
}

function assertUnixNode() {
  if (!isWindowsNodeOnWsl()) {
    return;
  }

  console.error(`${RED}error${RESET} ${windowsNodeOnWslMessage()}`);
  process.exit(1);
}

function reportUnreadableSettings(error, command) {
  console.error(`${RED}error${RESET} ${AGY_SETTINGS} is not valid JSON, so it was left untouched.`);
  console.error(`  ${error}`);
  console.error(
    " Fix the file (comments and trailing commas are not allowed), or add this by hand:"
  );
  console.error(`  "statusLine": { "type": "command", "command": ${JSON.stringify(command)} }`);
}

async function initCommand(options = {}) {
  assertUnixNode();

  const yes = Boolean(options.yes);
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const installDir = resolveInstallDir();
  const command = statuslineCommand(installDir);

  console.log();
  console.log(`${CYAN}${BOLD} agy-powerline${RESET}`);
  console.log(`${DIM} Antigravity statusline installer${RESET}`);
  console.log();

  // Validate settings.json before writing anything, so a file we cannot
  // safely update never ends up half-installed or overwritten.
  const current = readSettingsForUpdate();

  if (current.error) {
    reportUnreadableSettings(current.error, command);
    process.exitCode = 1;
    return;
  }

  // A settings entry Antigravity can't start is worse than none.
  const breaking = cmdBreakingChars(installDir);
  if (breaking.length) {
    console.error(`${RED}error${RESET} ${cmdBreakingMessage(breaking)}`);
    process.exitCode = 1;
    return;
  }

  const rl = interactive && !yes ? createRl() : null;

  try {
    fs.mkdirSync(installDir, { recursive: true });
    restrictPrivateFiles(installDir);

    const destStatusline = path.join(installDir, "statusline.js");
    const destConfig = path.join(installDir, "statusline.config.json");

    let writeScripts = true;

    if (fs.existsSync(destStatusline) && !yes) {
      if (!rl) {
        console.error(`${RED}error${RESET} ${destStatusline} exists. Pass --yes to overwrite.`);
        process.exitCode = 1;
        return;
      }

      writeScripts = await confirm(
        rl,
        `statusline.js already exists in ${installDir}. Overwrite scripts?`,
        false
      );
    }

    if (writeScripts) {
      fs.writeFileSync(destStatusline, buildRuntimeBundle(), "utf8");
      removeSeparateRuntimeFiles(installDir);

      if (process.platform !== "win32") {
        try {
          fs.chmodSync(destStatusline, 0o755);
        } catch {
          // Still runnable via `node script.js`.
        }
      }
    }

    // Antigravity runs the bar through cmd on Windows, which needs a .cmd
    // launcher; macOS and Linux settings run node statusline.js directly.
    if (process.platform === "win32") {
      writeWindowsLauncher(installDir);
    }

    writeInstallMeta(installDir);

    if (!fs.existsSync(destConfig)) {
      setConfigDir(installDir);
      saveConfig(defaultConfig());
    }

    const statusLine = await updateAgySettings(command, current, {
      yes,
      rl,
      stack: options.stack,
      padding: options.padding,
    });

    console.log();
    console.log(`${GREEN} Installed${RESET}`);
    console.log(`  scripts  ${DIM}${installDir}${RESET}`);
    console.log(`  command  ${DIM}${command}${RESET}`);
    if (statusLine?.stack_with_default) {
      console.log(`  stacked  ${DIM}yes (below default statusline)${RESET}`);
    }
    if (typeof statusLine?.padding === "number") {
      console.log(`  padding  ${DIM}${statusLine.padding} line(s)${RESET}`);
    }
    console.log();
    console.log(" Next:");
    console.log(`${CYAN}  npx agy-powerline configure${RESET}`);
    console.log(`${CYAN}  npx agy-powerline doctor${RESET}`);
    console.log("  then restart Antigravity / open a new session.");
    console.log();
  } finally {
    rl?.close();
  }
}

async function updateAgySettings(command, { exists, settings }, { yes, rl, stack, padding }) {
  const current = settings.statusLine?.command;

  if (current && current !== command && !yes) {
    if (!rl) {
      console.error(
        `${RED}error${RESET} settings.json already has statusLine. Pass --yes to replace it.`
      );
      process.exitCode = 1;
      return null;
    }

    const replace = await confirm(
      rl,
      `settings.json already has statusLine (${current}). Replace it?`,
      true
    );

    if (!replace) {
      console.log();
      console.log(`${YELLOW} Scripts saved. settings.json was not changed.${RESET}`);
      console.log(` Set statusLine.command to:\n  ${command}`);
      return null;
    }
  }

  const statusLine = {
    type: "command",
    command,
  };

  if (stack === true) {
    statusLine.stack_with_default = true;
  } else if (stack === false) {
    // explicitly --no-stack, omitted
  } else if (settings.statusLine?.stack_with_default) {
    statusLine.stack_with_default = true;
  }

  if (typeof padding === "number" && !Number.isNaN(padding) && padding >= 0) {
    statusLine.padding = padding;
  } else if (typeof settings.statusLine?.padding === "number") {
    statusLine.padding = settings.statusLine.padding;
  }

  writeJsonSafely(AGY_SETTINGS, { ...settings, statusLine });

  console.log(`${DIM}  ${exists ? "updated" : "created"} ${AGY_SETTINGS}${RESET}`);
  // init means "show the bar", so a statusLine switched off with enabled: false
  // is switched back on, and the user is told.
  if (settings.statusLine?.enabled === false) {
    console.log(`${DIM}  enabled  statusLine.enabled was false; the bar is on again${RESET}`);
  }
  if (exists) {
    console.log(`${DIM}  backup  ${settingsBackupPath(AGY_SETTINGS)}${RESET}`);
  }

  return statusLine;
}

module.exports = {
  initCommand,
};
