"use strict";

const fs = require("fs");
const path = require("path");
const {
  defaultConfig,
  saveConfig,
  setConfigDir,
  readConfigFile,
  applyPreset,
  renderStatusline,
  sampleData,
  resolveColorDepth,
  PRESETS,
  PRESET_ORDER,
  LAYOUTS,
  LAYOUT_ORDER,
  THEMES,
  THEME_ORDER,
  canonicalThemeId,
} = require("../lib/shared");
const {
  AGY_SETTINGS,
  RUNTIME_FILES,
  resolveInstallDir,
  statuslineCommand,
  appendedRenderFlags,
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
const { createRl, confirm, choose } = require("../lib/prompt");
const { printInvalidConfig } = require("./config-guard");
const { buildRuntimeBundle } = require("./bundle");
const { REPO_URL } = require("./repo-url");
const { CONFIG_SCHEMA_URL } = require("../lib/config");
const { homepage: SITE_URL } = require("../../package.json");

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

function unknownChoice(kind, value, ids) {
  console.error(`${RED}error${RESET} Unknown ${kind} "${value}".`);
  console.error(` Available ${kind}s: ${ids.join(", ")}`);
  console.error(` Run ${CYAN}npx agy-powerline ${kind} --list${RESET} to view details.`);
  process.exitCode = 1;
  return null;
}

// --preset, --layout and --theme, checked before anything is written. Returns
// the ids given ({} for none), or null after printing what's wrong.
function readChoiceFlags(options) {
  const choices = {};
  if (options.preset !== undefined) {
    if (!PRESETS[options.preset]) {
      return unknownChoice("preset", options.preset, PRESET_ORDER);
    }
    choices.preset = options.preset;
  }
  if (options.layout !== undefined) {
    if (!LAYOUTS[options.layout]) {
      return unknownChoice("layout", options.layout, LAYOUT_ORDER);
    }
    choices.layout = options.layout;
  }
  if (options.theme !== undefined) {
    // Aliases (dark, light, colorblind) name a theme too.
    const theme = canonicalThemeId(options.theme);
    if (!THEMES[theme]) {
      return unknownChoice("theme", options.theme, THEME_ORDER);
    }
    choices.theme = theme;
  }
  return choices;
}

function applyChoices(config, choices) {
  const next = choices.preset ? applyPreset(config, choices.preset) : { ...config };
  if (choices.layout) {
    next.layout = choices.layout;
  }
  if (choices.theme) {
    next.theme = choices.theme;
  }
  return next;
}

// The bar a choice gives, fitted to the terminal's width (less the indent).
// exec widgets keep their [cmd] placeholder: nothing runs here.
function preview(config, rows = Infinity) {
  const width = Math.max(40, (process.stdout.columns || 80) - 6);
  const color = resolveColorDepth({ configColor: config.color, env: process.env });
  return renderStatusline({ ...sampleData(), terminal_width: width }, config, { color })
    .split("\n")
    .slice(0, rows)
    .join("\n");
}

const BACKGROUNDS = [
  ["dark", "dark"],
  ["light", "light"],
  ["colorblind", "color-blind"],
];

// The questions of a first install in a terminal, for what the flags left open.
async function askChoices(rl, given) {
  const choices = { ...given };
  const base = defaultConfig();
  const option = (id, description, config, rows) =>
    `${id}${description ? `  ${DIM}${description}${RESET}` : ""}\n${preview(config, rows)}`;

  if (!choices.preset) {
    const index = await choose(
      rl,
      `\n${BOLD} Which widgets?${RESET}`,
      PRESET_ORDER.map((id) =>
        option(id, PRESETS[id].description, applyChoices(base, { ...choices, preset: id }))
      )
    );
    choices.preset = PRESET_ORDER[index];
  }

  if (!choices.layout) {
    const index = await choose(
      rl,
      `\n${BOLD} Which layout?${RESET}`,
      LAYOUT_ORDER.map((id) =>
        option(id, LAYOUTS[id].description, applyChoices(base, { ...choices, layout: id }))
      )
    );
    choices.layout = LAYOUT_ORDER[index];
  }

  if (!choices.theme) {
    const background = await choose(
      rl,
      `\n${BOLD} Your terminal's background?${RESET}`,
      BACKGROUNDS.map(([, label]) => label)
    );
    const kind = BACKGROUNDS[background][0];
    const ids = THEME_ORDER.filter((id) => THEMES[id]?.kind === kind);
    const index = await choose(
      rl,
      `\n${BOLD} Which theme?${RESET}`,
      ids.map((id) => option(id, "", applyChoices(base, { ...choices, theme: id }), 1))
    );
    choices.theme = ids[index];
  }

  return choices;
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
  const destConfig = path.join(installDir, "statusline.config.json");

  console.log();
  console.log(`${CYAN}${BOLD} agy-powerline${RESET}`);
  console.log(`${DIM} Antigravity statusline installer${RESET}`);
  console.log();

  let choices = readChoiceFlags(options);
  if (!choices) {
    return;
  }

  // Re-running init never replaces a config; flags change only their settings
  // in it, and a config with a JSON error isn't touched at all.
  const firstInstall = !fs.existsSync(destConfig);
  let existingConfig = null;
  if (!firstInstall && Object.keys(choices).length) {
    setConfigDir(installDir);
    const existing = readConfigFile();
    if (existing.error) {
      printInvalidConfig(existing.error);
      process.exitCode = 1;
      return;
    }
    existingConfig = existing.config;
  }

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
    if (firstInstall && rl) {
      choices = await askChoices(rl, choices);
      console.log();
      console.log(` ${BOLD}${choices.preset} · ${choices.layout} · ${choices.theme}${RESET}`);
      console.log(preview(applyChoices(defaultConfig(), choices)));
      console.log();
    }

    fs.mkdirSync(installDir, { recursive: true });
    restrictPrivateFiles(installDir);

    const destStatusline = path.join(installDir, "statusline.js");

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

    setConfigDir(installDir);
    if (firstInstall) {
      // A new config names its schema, so editors complete and check it.
      saveConfig({ $schema: CONFIG_SCHEMA_URL, ...applyChoices(defaultConfig(), choices) });
    } else if (existingConfig) {
      saveConfig(applyChoices(existingConfig, choices));
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
    if (existingConfig) {
      const changed = Object.entries(choices).map(([key, value]) => `${key} ${value}`);
      console.log(`  config   ${DIM}kept yours, with ${changed.join(", ")}${RESET}`);
    } else if (!firstInstall) {
      console.log(`  config   ${DIM}kept yours${RESET}`);
    }
    console.log();
    console.log(" Next:");
    console.log(`${CYAN}  npx agy-powerline configure${RESET}`);
    console.log(
      `${CYAN}  npx agy-powerline preset${RESET} / ${CYAN}layout${RESET} / ${CYAN}theme${RESET}  ${DIM}change one of your choices${RESET}`
    );
    console.log(`${CYAN}  npx agy-powerline doctor${RESET}`);
    console.log("  then restart Antigravity / open a new session.");
    console.log();
    console.log(`${DIM} Themes, docs and the browser configurator:${RESET}`);
    console.log(`${DIM}  ${SITE_URL}${RESET}`);
    console.log(`${DIM} Like it? A star on GitHub helps others find it:${RESET}`);
    console.log(`${DIM}  ${REPO_URL}${RESET}`);
    console.log();
  } finally {
    rl?.close();
  }
}

async function updateAgySettings(command, { exists, settings }, { yes, rl, stack, padding }) {
  const current = settings.statusLine?.command;
  // Render flags the user added to our command (--theme light-paper) survive an update.
  const flags = appendedRenderFlags(current, command);
  if (flags) {
    command = `${command} ${flags}`;
    console.log(`${DIM}  kept  render flags ${flags}${RESET}`);
  }

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

  const originalBackup = writeJsonSafely(AGY_SETTINGS, { ...settings, statusLine });

  console.log(`${DIM}  ${exists ? "updated" : "created"} ${AGY_SETTINGS}${RESET}`);
  // init means "show the bar", so a statusLine switched off with enabled: false
  // is switched back on, and the user is told.
  if (settings.statusLine?.enabled === false) {
    console.log(`${DIM}  enabled  statusLine.enabled was false; the bar is on again${RESET}`);
  }
  if (exists) {
    console.log(`${DIM}  backup  ${settingsBackupPath(AGY_SETTINGS)}${RESET}`);
  }
  if (originalBackup) {
    console.log(
      `${DIM}  original  ${originalBackup} (kept as it was before agy-powerline)${RESET}`
    );
  }

  return statusLine;
}

module.exports = {
  initCommand,
  askChoices,
};
