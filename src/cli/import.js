"use strict";

const fs = require("fs");
const path = require("path");
const {
  saveConfig,
  setConfigDir,
  getConfigPath,
  mergeConfig,
  renderStatusline,
  sampleData,
  detectStyle,
} = require("../lib/shared");
const { resolveInstallDir, writeFileAtomic, PRIVATE_FILE_MODE } = require("../lib/paths");
const { createRl, confirm } = require("../lib/prompt");
const { loadEditableConfig } = require("./config-guard");
const { version } = require("../../package.json");

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

// A config is a few KB; anything this big isn't one.
const MAX_IMPORT_BYTES = 256 * 1024;
const BACKUP_SUFFIX = ".bak";
const { visible, droppedSettings } = require("../lib/config-check");
const SETTINGS = ["emojis", "ascii", "color", "pacing", "minimalist", "rowGap", "log"];

function readImportFile(file) {
  const target = path.resolve(String(file));
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return { target, error: "the file doesn't exist" };
  }
  if (!stat.isFile()) {
    return { target, error: "it isn't a file" };
  }
  if (stat.size > MAX_IMPORT_BYTES) {
    return {
      target,
      error: `it is larger than ${MAX_IMPORT_BYTES / 1024} KB, so it isn't a config`,
    };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(target, "utf8").replace(/^\uFEFF/, ""));
  } catch (err) {
    // The parser quotes the text it failed on; keep only where.
    const at = String(err.message).match(/position \d+|line \d+ column \d+/)?.[0];
    return { target, error: `it isn't valid JSON${at ? ` (${at})` : ""}` };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { target, error: "its top-level value isn't an object" };
  }
  return { target, data };
}

function majorOf(value) {
  const major = parseInt(String(value ?? "").match(/^(\d+)\./)?.[1] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

// "model context git / fiveHourBar fiveHourReset ...", one row per line break.
function widgetRows(widgets) {
  const rows = [[]];
  for (const widget of widgets) {
    if (widget.id === "lineBreak") {
      rows.push([]);
    } else if (widget.id !== "separator") {
      rows[rows.length - 1].push(widget.id);
    }
  }
  return rows.map((row) => row.join(" ") || "(empty row)");
}

function changes(before, after) {
  const lines = [];
  const show = (value) => (value === undefined || value === null ? "off" : JSON.stringify(value));
  const compare = (name, a, b) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      lines.push(`  ${name.padEnd(11)} ${DIM}${visible(show(a))}${RESET} → ${visible(show(b))}`);
    }
  };

  compare("theme", before.theme, after.theme);
  compare("layout", before.layout, after.layout);
  compare(
    "style",
    detectStyle(before.powerline) ?? "custom",
    detectStyle(after.powerline) ?? "custom"
  );
  compare("gradient", before.gradient, after.gradient);
  compare("meterStyle", before.meterStyle, after.meterStyle);
  for (const key of SETTINGS) {
    compare(key, before[key], after[key]);
  }
  compare("thresholds", before.thresholds, after.thresholds);
  compare("clock", before.clock, after.clock);
  compare("customTheme", before.customTheme, after.customTheme);

  const rowsBefore = widgetRows(before.widgets);
  const rowsAfter = widgetRows(after.widgets);
  if (JSON.stringify(before.widgets) !== JSON.stringify(after.widgets)) {
    lines.push("  widgets");
    rowsBefore.forEach((row) => lines.push(`    ${DIM}- ${visible(row)}${RESET}`));
    rowsAfter.forEach((row) => lines.push(`    + ${visible(row)}`));
    if (JSON.stringify(rowsBefore) === JSON.stringify(rowsAfter)) {
      lines.push(`    ${DIM}(same widgets, different options)${RESET}`);
    }
  }
  return lines;
}

// Exec commands the import would add: these run on every refresh.
function newCommands(before, after) {
  const known = new Set(
    before.widgets.filter((widget) => widget.id === "exec").map((widget) => String(widget.cmd))
  );
  return after.widgets
    .filter((widget) => widget.id === "exec" && String(widget.cmd || "").trim())
    .map((widget) => String(widget.cmd))
    .filter((cmd) => !known.has(cmd));
}

function fail(message, hint) {
  console.error(`${RED}error${RESET} ${message}`);
  if (hint) {
    console.error(` ${hint}`);
  }
  process.exitCode = 1;
}

async function importCommand(file, options = {}) {
  if (!file) {
    fail("Name the file to import.", "Usage: npx agy-powerline import <file> [--merge] [--yes]");
    return;
  }

  const installDir = resolveInstallDir();
  if (!installDir) {
    return;
  }
  setConfigDir(installDir);
  // A broken config is never replaced: the user can still fix it.
  const current = loadEditableConfig();
  if (!current) {
    return;
  }

  const { target, data, error } = readImportFile(file);
  if (error) {
    fail(`Can't import ${target}: ${error}. Nothing was changed.`);
    return;
  }

  const { agyPowerline, ...raw } = data;
  const fileMajor = majorOf(agyPowerline?.version);
  if (fileMajor !== null && fileMajor > majorOf(version)) {
    fail(
      `${target} comes from agy-powerline ${visible(agyPowerline.version)}, newer than this one (${version}). Nothing was changed.`,
      "Update first: npx agy-powerline@latest import <file>"
    );
    return;
  }

  const merge = Boolean(options.merge);
  const next = mergeConfig(merge ? { ...current, ...raw } : raw);

  console.log();
  console.log(`${BOLD} Import ${RESET}${DIM}${target}${RESET} ${merge ? "(merge)" : "(replace)"}`);
  const dropped = droppedSettings(raw);
  if (dropped.length) {
    console.log(`${YELLOW} Left out${RESET} (this version can't use them):`);
    dropped.forEach((item) => console.log(`  ${item}`));
  }

  const diff = changes(current, next);
  if (!diff.length) {
    console.log(" Nothing to change: the file matches your config.");
    console.log();
    return;
  }
  console.log(" Changes:");
  diff.forEach((line) => console.log(line));
  console.log();
  console.log(" Preview:");
  console.log(renderStatusline(sampleData(), next));
  console.log();

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const added = newCommands(current, next);
  const rl =
    interactive && (!options.yes || (added.length && !options["allow-exec"])) ? createRl() : null;

  try {
    if (added.length) {
      console.log(
        `${YELLOW} The file adds ${added.length} shell command${added.length === 1 ? "" : "s"}${RESET}, run on every refresh:`
      );
      added.forEach((cmd) => console.log(`  ${CYAN}${visible(cmd)}${RESET}`));
      console.log();
      if (!options["allow-exec"]) {
        if (!rl) {
          fail(
            "The file adds shell commands. Nothing was changed.",
            "Check them above, then pass --allow-exec to import them."
          );
          return;
        }
        if (!(await confirm(rl, "Run these commands in your bar?", false))) {
          console.log(" Nothing was changed.");
          return;
        }
      }
    }

    if (!options.yes) {
      if (!rl) {
        fail("No TTY. Pass --yes to import non-interactively. Nothing was changed.");
        return;
      }
      if (!(await confirm(rl, "Apply this config?", false))) {
        console.log(" Nothing was changed.");
        return;
      }
    }
  } finally {
    rl?.close();
  }

  // One import can be undone by importing the backup.
  const configPath = getConfigPath();
  const backup = `${configPath}${BACKUP_SUFFIX}`;
  let backedUp = false;
  try {
    const previous = fs.readFileSync(configPath, "utf8");
    writeFileAtomic(backup, previous, { mode: PRIVATE_FILE_MODE });
    backedUp = true;
  } catch (err) {
    if (err.code !== "ENOENT") {
      fail(`Can't back up ${configPath} (${err.code || "error"}). Nothing was changed.`);
      return;
    }
  }

  saveConfig(next);

  console.log(`${GREEN}✔${RESET} Config imported into ${DIM}${configPath}${RESET}`);
  if (backedUp) {
    console.log(
      `  previous config  ${DIM}${backup}${RESET} (undo: npx agy-powerline import "${backup}")`
    );
  }
  console.log(" The bar shows it on its next refresh.");
  console.log();
}

module.exports = {
  importCommand,
  readImportFile,
  droppedSettings,
  newCommands,
  visible,
  MAX_IMPORT_BYTES,
  BACKUP_SUFFIX,
};
