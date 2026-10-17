"use strict";

const {
  LAYOUTS,
  LAYOUT_ORDER,
  saveConfig,
  setConfigDir,
  getConfigPath,
  renderStatusline,
  sampleData,
} = require("../lib/shared");
const { resolveInstallDir } = require("../lib/paths");
const { loadEditableConfig } = require("./config-guard");

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function resolveInstallPath() {
  return resolveInstallDir();
}

async function layoutCommand(name, options = {}) {
  const installDir = resolveInstallPath(options);
  if (!installDir) {
    return;
  }

  setConfigDir(installDir);
  const config = loadEditableConfig();
  if (!config) {
    return;
  }
  const currentLayout = config.layout || "pills";

  if (!name || options.list) {
    console.log();
    console.log(`${BOLD} agy-powerline layouts${RESET}`);
    console.log(
      `  current  ${CYAN}${currentLayout}${RESET} ${DIM}(${LAYOUTS[currentLayout]?.name || "Unknown"})${RESET}`
    );
    console.log(`  config   ${DIM}${getConfigPath()}${RESET}`);
    console.log();

    const maxIdLen = LAYOUT_ORDER.reduce((max, id) => Math.max(max, id.length), 0);

    for (const id of LAYOUT_ORDER) {
      const l = LAYOUTS[id];
      if (!l) {
        continue;
      }
      const isCurrent = id === currentLayout;
      const marker = isCurrent ? `${GREEN}*${RESET}` : " ";
      const idFormatted = isCurrent
        ? `${BOLD}${CYAN}${id.padEnd(maxIdLen)}${RESET}`
        : id.padEnd(maxIdLen);
      console.log(`  ${marker} ${idFormatted}  ${l.description}`);
    }

    console.log();
    console.log(` Run ${CYAN}npx agy-powerline layout <name>${RESET} to switch layout.`);
    console.log();
    return;
  }

  const rawKey = String(name).trim().toLowerCase();

  if (!LAYOUTS[rawKey]) {
    console.error(`${RED}error${RESET} Unknown layout "${name}".`);
    console.error(` Available layouts: ${LAYOUT_ORDER.join(", ")}`);
    console.error(` Run ${CYAN}npx agy-powerline layout --list${RESET} to view layout details.`);
    process.exitCode = 1;
    return;
  }

  config.layout = rawKey;
  saveConfig(config);

  const l = LAYOUTS[rawKey];

  console.log();
  console.log(`${GREEN}✔${RESET} Layout set to ${BOLD}${l.name}${RESET} (${rawKey})`);
  console.log(`  config  ${DIM}${getConfigPath()}${RESET}`);
  console.log();
  console.log(" Preview:");
  console.log(renderStatusline(sampleData(), config));
  console.log();
}

module.exports = {
  layoutCommand,
};
