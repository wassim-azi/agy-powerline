// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const {
  PRESETS,
  PRESET_ORDER,
  applyPreset,
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

async function presetCommand(name, options = {}) {
  const installDir = resolveInstallPath(options);
  if (!installDir) {
    return;
  }

  setConfigDir(installDir);
  const config = loadEditableConfig();
  if (!config) {
    return;
  }

  if (!name || options.list) {
    console.log();
    console.log(`${BOLD} agy-powerline presets${RESET}`);
    console.log(`  config   ${DIM}${getConfigPath()}${RESET}`);
    console.log();

    const maxIdLen = PRESET_ORDER.reduce((max, id) => Math.max(max, id.length), 0);

    for (const id of PRESET_ORDER) {
      const p = PRESETS[id];
      if (!p) {
        continue;
      }
      const idFormatted = `${BOLD}${CYAN}${id.padEnd(maxIdLen)}${RESET}`;
      console.log(`  * ${idFormatted}  ${p.name} - ${p.description}`);
    }

    console.log();
    console.log(` Run ${CYAN}npx agy-powerline preset <name>${RESET} to apply a preset.`);
    console.log();
    return;
  }

  const rawKey = String(name).trim().toLowerCase();

  if (!PRESETS[rawKey]) {
    console.error(`${RED}error${RESET} Unknown preset "${name}".`);
    console.error(` Available presets: ${PRESET_ORDER.join(", ")}`);
    console.error(` Run ${CYAN}npx agy-powerline preset --list${RESET} to view details.`);
    process.exitCode = 1;
    return;
  }

  const updatedConfig = applyPreset(config, rawKey);
  saveConfig(updatedConfig);

  const p = PRESETS[rawKey];

  console.log();
  console.log(`${GREEN}✔${RESET} Applied preset ${BOLD}${p.name}${RESET} (${rawKey})`);
  console.log(`  config  ${DIM}${getConfigPath()}${RESET}`);
  console.log();
  console.log(" Preview:");
  console.log(renderStatusline(sampleData(), updatedConfig));
  console.log();
}

module.exports = {
  presetCommand,
};
