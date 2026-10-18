"use strict";

const fs = require("fs");
const path = require("path");
const { readConfigFile, mergeConfig, setConfigDir } = require("../lib/shared");
const { resolveInstallDir, writeFileAtomic, PRIVATE_FILE_MODE } = require("../lib/paths");
const { printInvalidConfig } = require("./config-guard");
const { version } = require("../../package.json");

const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

// The config as the bar reads it, with the release that wrote it first, so an
// import can tell a file from a newer release.
function exportDocument(config) {
  return { agyPowerline: { version }, ...mergeConfig(config) };
}

function execCommandCount(config) {
  return (config.widgets || []).filter(
    (widget) => widget.id === "exec" && String(widget.cmd || "").trim()
  ).length;
}

async function exportCommand(file, options = {}) {
  const installDir = resolveInstallDir();
  if (!installDir) {
    return;
  }

  setConfigDir(installDir);
  const { config, error } = readConfigFile();
  if (error) {
    // Exporting the defaults would look like a backup of the user's bar.
    printInvalidConfig(error);
    process.exitCode = 1;
    return;
  }

  const body = JSON.stringify(exportDocument(config), null, 2) + "\n";

  if (file) {
    const target = path.resolve(String(file));
    let existing = null;
    try {
      existing = fs.statSync(target);
    } catch {
      // Nothing there yet.
    }
    if (existing?.isDirectory()) {
      console.error(`${RED}error${RESET} ${target} is a folder. Name a file to write.`);
      process.exitCode = 1;
      return;
    }
    if (existing && !options.force) {
      console.error(`${RED}error${RESET} ${target} already exists. Pass --force to replace it.`);
      process.exitCode = 1;
      return;
    }
    // Owner-only, like the config itself: it can hold your commands.
    writeFileAtomic(target, body, { mode: PRIVATE_FILE_MODE });
    console.error(`${GREEN}✔${RESET} Config exported to ${DIM}${target}${RESET}`);
  } else {
    process.stdout.write(body);
  }

  // Notes go to stderr, so `export > file` keeps the JSON clean.
  const commands = execCommandCount(config);
  if (commands) {
    console.error(
      `${YELLOW}note${RESET} The export holds ${commands} exec widget command${commands === 1 ? "" : "s"}; check ${commands === 1 ? "it" : "them"} before sharing the file.`
    );
  }
}

module.exports = {
  exportCommand,
  exportDocument,
};
