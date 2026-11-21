// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const { defaultConfig, saveConfig, setConfigDir, readConfigFile } = require("../lib/shared");
const { CONFIG_SCHEMA_URL } = require("../lib/config");
const {
  AGY_SETTINGS,
  resolveInstallDir,
  statuslineCommand,
  appendedRenderFlags,
  windowsLauncherPath,
  readInstallMeta,
  readSettingsForUpdate,
  cmdBreakingChars,
  cmdBreakingMessage,
} = require("../lib/paths");
const { createRl, confirm } = require("../lib/prompt");
const { printInvalidConfig } = require("./config-guard");
const { configureCommand } = require("./configure");
const {
  assertUnixNode,
  reportUnreadableSettings,
  installScripts,
  updateAgySettings,
  looksLikeOurStatusline,
} = require("./init");
const { version: VERSION } = require("../../package.json");

const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function printPostTuiSummary({
  installed,
  updatedScripts,
  updatedSettings,
  installDir,
  destConfig,
}) {
  if (!installed && !updatedScripts && !updatedSettings) {
    return;
  }

  console.log();
  if (installed) {
    console.log(`${GREEN} Installed${RESET}`);
  } else if (updatedScripts && !updatedSettings) {
    console.log(`${GREEN} Updated${RESET} scripts to v${VERSION}`);
  } else {
    console.log(`${GREEN} Ready${RESET}`);
  }
  console.log(`  scripts  ${DIM}${installDir}${RESET}`);
  console.log(`  config   ${DIM}${destConfig}${RESET}`);
  if (updatedSettings) {
    console.log(`  settings ${DIM}${AGY_SETTINGS}${RESET}`);
    console.log();
    console.log(" Restart `agy` (or open a new session) so Antigravity picks up settings.json.");
  } else {
    console.log();
    console.log(" Restart `agy` (or open a new session) to load the updated scripts.");
  }
  console.log();
}

async function defaultInteractiveCommand(options = {}) {
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;
  const launchTui = options.launchTui || configureCommand;
  const createReadline = options.createRl || createRl;

  assertUnixNode();

  const installDir = resolveInstallDir();
  const command = statuslineCommand(installDir);
  const destStatusline = path.join(installDir, "statusline.js");
  const destLauncher = windowsLauncherPath(installDir);
  const destConfig = path.join(installDir, "statusline.config.json");

  const breaking = cmdBreakingChars(installDir);
  if (breaking.length) {
    console.error(`${RED}error${RESET} ${cmdBreakingMessage(breaking)}`);
    process.exitCode = 1;
    return false;
  }

  const settingsState = readSettingsForUpdate();
  if (settingsState.error) {
    reportUnreadableSettings(settingsState.error, command);
    process.exitCode = 1;
    return false;
  }

  setConfigDir(installDir);
  const configState = readConfigFile();
  if (configState.error) {
    printInvalidConfig(configState.error);
    process.exitCode = 1;
    return false;
  }

  const meta = readInstallMeta(installDir);
  const hasStatusline = fs.existsSync(destStatusline);
  const hasLauncher = process.platform !== "win32" || fs.existsSync(destLauncher);
  const hasConfig = fs.existsSync(destConfig);
  const configured = settingsState.settings?.statusLine?.command;
  const flags = appendedRenderFlags(configured, command);
  const settingsWired = flags !== null && settingsState.settings?.statusLine?.enabled !== false;

  const isFresh = !hasStatusline && !hasConfig && !meta && !settingsWired;
  const isUpToDate = hasStatusline && hasLauncher && settingsWired && meta?.version === VERSION;
  const isStale = hasStatusline && hasLauncher && settingsWired && meta?.version !== VERSION;

  let installed = false;
  let updatedScripts = false;
  let updatedSettings = false;
  let flash = "";

  if (isUpToDate) {
    if (!hasConfig) {
      saveConfig({ $schema: CONFIG_SCHEMA_URL, ...defaultConfig() });
    }
  } else if (isStale) {
    let writeScripts = true;
    if (!looksLikeOurStatusline(destStatusline)) {
      const rl = createReadline(stdin, stdout);
      try {
        writeScripts = await confirm(
          rl,
          `statusline.js in ${installDir} looks customized. Overwrite scripts?`,
          false
        );
      } finally {
        rl.close();
      }
    }
    if (writeScripts) {
      installScripts(installDir, { writeScripts: true });
      updatedScripts = true;
      flash = `Updated scripts to v${VERSION}`;
    }
    if (!hasConfig) {
      saveConfig({ $schema: CONFIG_SCHEMA_URL, ...defaultConfig() });
    }
  } else {
    let rl = null;
    const getRl = () => {
      if (!rl) {
        rl = createReadline(stdin, stdout);
      }
      return rl;
    };

    let writeScripts = true;
    try {
      if (hasStatusline && !looksLikeOurStatusline(destStatusline)) {
        writeScripts = await confirm(
          getRl(),
          `statusline.js already exists in ${installDir}. Overwrite scripts?`,
          false
        );
      }

      installScripts(installDir, { writeScripts });

      if (!hasConfig) {
        saveConfig({ $schema: CONFIG_SCHEMA_URL, ...defaultConfig() });
      }

      if (!settingsWired) {
        const needsConfirm = Boolean(configured) && flags === null;
        const statusLine = await updateAgySettings(command, settingsState, {
          yes: false,
          rl: needsConfirm ? getRl() : null,
        });
        if (!statusLine) {
          console.log(` Run ${CYAN}npx agy-powerline${RESET} anytime to customize.`);
          return false;
        }
        updatedSettings = true;
      }
    } finally {
      rl?.close();
    }

    if (isFresh) {
      installed = true;
      flash = "Installed! Press i for ASCII";
    } else {
      updatedScripts = writeScripts;
      if (updatedScripts && !updatedSettings) {
        flash = `Updated scripts to v${VERSION}`;
      }
    }
  }

  const ran = await launchTui({ stdin, stdout, configDir: installDir, flash });
  if (!ran) {
    return false;
  }

  printPostTuiSummary({
    installed,
    updatedScripts,
    updatedSettings,
    installDir,
    destConfig,
  });

  return true;
}

module.exports = {
  defaultInteractiveCommand,
};
