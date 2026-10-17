"use strict";

const {
  saveConfig,
  setConfigDir,
  getConfigPath,
  renderStatusline,
  sampleData,
} = require("../lib/shared");
const { resolveInstallDir } = require("../lib/paths");
const { loadEditableConfig } = require("./config-guard");
const { STYLES, STYLE_ORDER, applyStyle, detectStyle, glyphChar } = require("../lib/powerline");

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

// "start join end", e.g. the round style shows its three glyphs side by side.
function styleGlyphs(style, ascii) {
  const parts = [
    glyphChar(style.startCaps[0], "startCap", ascii),
    glyphChar(style.separators[0], "separator", ascii),
    glyphChar(style.endCaps[0], "endCap", ascii),
  ];

  return parts.some(Boolean) ? parts.map((glyph) => glyph || " ").join(" ") : "none";
}

async function capsCommand(name, options = {}) {
  const installDir = resolveInstallDir();
  if (!installDir) {
    return;
  }

  setConfigDir(installDir);
  const config = loadEditableConfig();
  if (!config) {
    return;
  }
  const currentStyle = detectStyle(config.powerline);

  if (!name || options.list) {
    console.log();
    console.log(`${BOLD} agy-powerline cap styles${RESET}`);
    console.log(
      currentStyle
        ? `  current  ${CYAN}${currentStyle}${RESET} ${DIM}(${STYLES[currentStyle].name})${RESET}`
        : `  current  ${CYAN}custom${RESET} ${DIM}(edited in configure or statusline.config.json)${RESET}`
    );
    console.log(`  config   ${DIM}${getConfigPath()}${RESET}`);
    console.log();

    const maxIdLen = STYLE_ORDER.reduce((max, id) => Math.max(max, id.length), 0);

    for (const id of STYLE_ORDER) {
      const style = STYLES[id];
      const isCurrent = id === currentStyle;
      const marker = isCurrent ? `${GREEN}*${RESET}` : " ";
      const idFormatted = isCurrent
        ? `${BOLD}${CYAN}${id.padEnd(maxIdLen)}${RESET}`
        : id.padEnd(maxIdLen);
      console.log(
        `  ${marker} ${idFormatted}  ${styleGlyphs(style, config.ascii).padEnd(6)}  ${style.description}`
      );
    }

    console.log();
    console.log(` Run ${CYAN}npx agy-powerline caps <style>${RESET} to change cap style.`);
    console.log(
      ` ${DIM}A style sets start caps, end caps and separators; fine-tune them in configure.${RESET}`
    );
    console.log();
    return;
  }

  const rawKey = String(name).trim().toLowerCase();

  if (!STYLES[rawKey]) {
    console.error(`${RED}error${RESET} Unknown cap style "${name}".`);
    console.error(` Available styles: ${STYLE_ORDER.join(", ")}`);
    console.error(` Run ${CYAN}npx agy-powerline caps --list${RESET} to view style options.`);
    process.exitCode = 1;
    return;
  }

  config.powerline = applyStyle(config.powerline, rawKey);
  saveConfig(config);

  const style = STYLES[rawKey];

  console.log();
  console.log(`${GREEN}✔${RESET} Cap style set to ${BOLD}${style.name}${RESET} (${rawKey})`);
  console.log(`  config  ${DIM}${getConfigPath()}${RESET}`);
  console.log();
  console.log(" Preview:");
  console.log(renderStatusline(sampleData(), config));
  console.log();
}

module.exports = {
  capsCommand,
};
