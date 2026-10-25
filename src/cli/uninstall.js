// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const {
  AGY_SETTINGS,
  INSTALL_META_NAME,
  INSTALLED_FILES,
  resolveInstallDir,
  statuslineCommand,
  readSettingsForUpdate,
  settingsBackupPath,
  writeJsonSafely,
  removeSettingsFile,
} = require("../lib/paths");
const { createRl, confirm } = require("../lib/prompt");

const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function looksLikeOurs(command) {
  return (
    typeof command === "string" &&
    /statusline\.(cmd|js)/.test(command) &&
    /agy-powerline/i.test(command)
  );
}

function looksLikeInstallDir(dir) {
  return (
    fs.existsSync(path.join(dir, INSTALL_META_NAME)) ||
    fs.existsSync(path.join(dir, "statusline.js"))
  );
}

function removeEmptyDir(dir) {
  try {
    fs.rmdirSync(dir);
    return true;
  } catch {
    return false;
  }
}

// Deletes only files init (or the runtime) creates. Anything else the user
// put in the directory stays, and the directory itself is removed only once
// it is empty. A mistyped AGY_POWERLINE_HOME can therefore never wipe a tree.
function removeInstalledFiles(dir) {
  for (const rel of INSTALLED_FILES) {
    fs.rmSync(path.join(dir, rel), { force: true });
  }

  const subdirs = new Set(
    INSTALLED_FILES.map((rel) => path.dirname(rel)).filter((rel) => rel !== ".")
  );
  for (const rel of subdirs) {
    removeEmptyDir(path.join(dir, rel));
  }

  return removeEmptyDir(dir);
}

function removeStatusLine(settings) {
  const next = { ...settings };
  delete next.statusLine;

  if (Object.keys(next).length === 0) {
    // A symlinked settings.json is emptied rather than deleted (see paths.js).
    return removeSettingsFile(AGY_SETTINGS) === "emptied"
      ? "settings file was empty, emptied (it is a symlink)"
      : "settings file was empty, deleted";
  }

  writeJsonSafely(AGY_SETTINGS, next);
  return `backup ${settingsBackupPath(AGY_SETTINGS)}`;
}

async function uninstallCommand(options = {}) {
  const yes = Boolean(options.yes);
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const installDir = resolveInstallDir();

  const rl = interactive && !yes ? createRl() : null;

  try {
    const { exists, settings, error } = readSettingsForUpdate();
    const current = settings?.statusLine?.command;
    const expected = statuslineCommand(installDir);

    if (error) {
      console.error(
        `${RED}error${RESET} ${AGY_SETTINGS} is not valid JSON, so it was left untouched.`
      );
      console.error(`  ${error}`);
      console.error(' Remove the "statusLine" entry by hand.');
      process.exitCode = 1;
      // Deleting the scripts now would leave statusLine pointing at nothing.
      if (options.delete) {
        console.error(" Nothing was deleted. Fix settings.json, then run uninstall again.");
      }
      return;
    } else if (!exists || !current) {
      console.log(`${DIM} No statusLine in ${AGY_SETTINGS}; nothing to remove.${RESET}`);
    } else if (current === expected || looksLikeOurs(current)) {
      let remove = yes;

      if (!remove) {
        if (!rl) {
          console.error(
            `${RED}error${RESET} No TTY. Pass --yes to remove statusLine non-interactively.`
          );
          process.exitCode = 1;
          return;
        }
        remove = await confirm(rl, `Remove statusLine from settings.json?\n  ${current}`, true);
      }

      if (remove) {
        const note = removeStatusLine(settings);
        console.log(
          `${GREEN} Removed${RESET} statusLine from ${DIM}${AGY_SETTINGS} (${note})${RESET}`
        );
      } else {
        console.log(`${YELLOW} settings.json was not changed.${RESET}`);
      }
    } else {
      if (!yes) {
        console.error(
          `${RED}error${RESET} statusLine points elsewhere, leaving it in place:\n  ${current}\nPass --yes to remove it anyway.`
        );
        process.exitCode = 1;
        return;
      }

      const note = removeStatusLine(settings);
      console.log(
        `${GREEN} Removed${RESET} foreign statusLine (--yes) from ${DIM}${AGY_SETTINGS} (${note})${RESET}`
      );
    }

    if (options.delete) {
      if (!fs.existsSync(installDir)) {
        console.log(`${DIM} Install dir ${installDir} does not exist; nothing to delete.${RESET}`);
      } else if (!looksLikeInstallDir(installDir)) {
        console.error(
          `${RED}error${RESET} ${installDir} has no ${INSTALL_META_NAME} or statusline.js; refusing to delete anything there.`
        );
        process.exitCode = 1;
      } else {
        let wipe = yes;

        if (!wipe) {
          if (!rl) {
            console.error(
              `${RED}error${RESET} No TTY. Pass --yes to delete ${installDir} non-interactively.`
            );
            process.exitCode = 1;
            return;
          }
          wipe = await confirm(
            rl,
            `Delete agy-powerline files in ${installDir} (scripts, config, install.json)?`,
            false
          );
        }

        if (!wipe) {
          console.log(`${YELLOW} Install dir was kept.${RESET}`);
        } else if (removeInstalledFiles(installDir)) {
          console.log(`${GREEN} Deleted${RESET} ${DIM}${installDir}${RESET}`);
        } else {
          console.log(
            `${GREEN} Deleted${RESET} agy-powerline files. ${DIM}${installDir} still holds other files, so it was kept.${RESET}`
          );
        }
      }
    } else {
      console.log(`${DIM} Install dir kept: ${installDir} (pass --delete to remove it)${RESET}`);
    }

    console.log(" Restart `agy` (or open a new session) so it reloads settings.");
  } finally {
    rl?.close();
  }
}

module.exports = {
  uninstallCommand,
};
