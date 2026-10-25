// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const {
  THEMES,
  THEME_ORDER,
  THEME_KINDS,
  THEME_ALIASES,
  canonicalThemeId,
  buildCustomTheme,
  saveConfig,
  setConfigDir,
  getConfigPath,
  renderStatusline,
  sampleData,
  resolveColorDepth,
  resolveAscii,
  rgbToAnsi256,
} = require("../lib/shared");
const { resolveInstallDir } = require("../lib/paths");
const { loadEditableConfig } = require("./config-guard");

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function getThemeAliases() {
  const byTheme = {};
  for (const [alias, target] of Object.entries(THEME_ALIASES || {})) {
    if (!byTheme[target]) {
      byTheme[target] = [];
    }
    byTheme[target].push(alias);
  }
  return byTheme;
}

function themeSwatch(themeObj, depth, ascii) {
  if (depth === "none" || ascii) {
    return "";
  }
  const dot = "●";
  const colors = [
    themeObj.colors.model,
    themeObj.colors.context,
    themeObj.colors.fiveHour,
    themeObj.colors.caution,
    themeObj.colors.warn,
  ];
  return colors
    .map((c) => {
      if (depth === "256") {
        return `\x1b[38;5;${rgbToAnsi256(c)}m${dot}${RESET}`;
      }
      return `\x1b[38;2;${c[0]};${c[1]};${c[2]}m${dot}${RESET}`;
    })
    .join(" ");
}

function resolveInstallPath() {
  return resolveInstallDir();
}

async function themeCommand(name, options = {}) {
  const installDir = resolveInstallPath(options);
  if (!installDir) {
    return;
  }

  setConfigDir(installDir);
  const config = loadEditableConfig();
  if (!config) {
    return;
  }
  const currentTheme = config.theme;

  if (options.gallery) {
    console.log();
    console.log(`${BOLD} agy-powerline theme gallery${RESET}`);
    console.log(`  active:  ${CYAN}${currentTheme}${RESET}`);
    console.log(`  config:  ${DIM}${getConfigPath()}${RESET}`);
    console.log();

    for (const id of THEME_ORDER) {
      const t =
        id === "custom" && config.customTheme ? buildCustomTheme(config.customTheme) : THEMES[id];
      if (!t) {
        continue;
      }
      const isCurrent = id === currentTheme;
      const marker = isCurrent ? ` ${GREEN}✔ (active)${RESET}` : "";
      console.log(
        `  ${BOLD}${t.name}${RESET} ${DIM}(${id})${RESET}${marker} — ${DIM}${t.description}${RESET}`
      );
      const previewConfig = { ...config, theme: id };
      const sample = renderStatusline(sampleData(), previewConfig);
      console.log("  " + sample.trim());
      console.log();
    }

    console.log(` Run ${CYAN}npx agy-powerline theme <name>${RESET} to activate a theme.`);
    console.log();
    return;
  }

  if (!name || options.list) {
    const depth = resolveColorDepth({ configColor: config.color });
    const ascii = resolveAscii(config);
    const aliases = getThemeAliases();

    const activeThemeObj =
      currentTheme === "custom" && config.customTheme
        ? buildCustomTheme(config.customTheme)
        : THEMES[currentTheme];

    console.log();
    console.log(`${BOLD} agy-powerline themes${RESET}`);
    console.log(
      `  current  ${CYAN}${currentTheme}${RESET} ${DIM}(${activeThemeObj?.name || "Unknown"})${RESET}`
    );
    console.log(`  config   ${DIM}${getConfigPath()}${RESET}`);
    console.log();

    const maxIdLen = THEME_ORDER.reduce((max, id) => Math.max(max, id.length), 0);

    for (const kind of THEME_KINDS) {
      const ids = THEME_ORDER.filter((id) => THEMES[id]?.kind === kind.id);
      if (!ids.length) {
        continue;
      }
      console.log(`  ${DIM}${kind.label}${RESET}`);

      for (const id of ids) {
        const t =
          id === "custom" && config.customTheme ? buildCustomTheme(config.customTheme) : THEMES[id];
        const isCurrent = id === currentTheme;
        const marker = isCurrent ? `${GREEN}*${RESET}` : " ";
        const idFormatted = isCurrent
          ? `${BOLD}${CYAN}${id.padEnd(maxIdLen)}${RESET}`
          : id.padEnd(maxIdLen);
        const swatch = themeSwatch(t, depth, ascii);
        const aliasList = aliases[id] ? ` ${DIM}(alias: ${aliases[id].join(", ")})${RESET}` : "";
        console.log(
          `  ${marker} ${idFormatted}  ${swatch ? swatch + "  " : ""}${t.description}${aliasList}`
        );
      }
      console.log();
    }

    console.log(` Swatches: two widget colors, then the ok / caution / danger status colors.`);
    console.log(` Run ${CYAN}npx agy-powerline theme <name>${RESET} to switch theme.`);
    console.log();
    return;
  }

  const rawKey = String(name).trim().toLowerCase();
  const mapped = canonicalThemeId(rawKey);

  if (!THEMES[mapped]) {
    console.error(`${RED}error${RESET} Unknown theme "${name}".`);
    console.error(` Available themes: ${THEME_ORDER.join(", ")}`);
    console.error(
      ` Run ${CYAN}npx agy-powerline theme --list${RESET} to view details and aliases.`
    );
    process.exitCode = 1;
    return;
  }

  config.theme = mapped;
  saveConfig(config);

  const t =
    mapped === "custom" && config.customTheme
      ? buildCustomTheme(config.customTheme)
      : THEMES[mapped];
  const aliasNotice = mapped !== rawKey ? ` ${DIM}[alias: ${rawKey}]${RESET}` : "";

  console.log();
  console.log(`${GREEN}✔${RESET} Theme set to ${BOLD}${t.name}${RESET} (${mapped})${aliasNotice}`);
  console.log(`  config  ${DIM}${getConfigPath()}${RESET}`);
  console.log();
  console.log(" Preview:");
  console.log(renderStatusline(sampleData(), config));
  console.log();
}

module.exports = {
  themeCommand,
};
