"use strict";

const {
  saveConfig,
  setConfigDir,
  getConfigPath,
  renderStatusline,
  sampleData,
  resolveColorDepth,
} = require("../lib/shared");
const { GRADIENTS, GRADIENT_ORDER, normalizeGradient, gradientStops } = require("../lib/themes");
const { bg, gradientColors, setActiveDepth, getActiveDepth } = require("../lib/colors");
const { resolveInstallDir } = require("../lib/paths");
const { loadEditableConfig } = require("./config-guard");

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

const STRIP_WIDTH = 24;

// A row of colored cells showing the gradient; empty without color.
function gradientStrip(value, config) {
  const stops = gradientStops(value);
  if (!stops) {
    return "";
  }
  const previous = getActiveDepth();
  setActiveDepth(resolveColorDepth({ configColor: config.color, env: process.env }));
  try {
    if (getActiveDepth() === "none") {
      return "";
    }
    const cells = gradientColors(stops, STRIP_WIDTH).map((color) => `${bg(color)} `);
    return `${cells.join("")}${RESET}`;
  } finally {
    setActiveDepth(previous);
  }
}

function listGradients(config) {
  const current = config.gradient || "off";

  console.log();
  console.log(`${BOLD} agy-powerline gradients${RESET}`);
  console.log(`  current  ${CYAN}${current}${RESET} ${gradientStrip(config.gradient, config)}`);
  console.log(`  config   ${DIM}${getConfigPath()}${RESET}`);
  console.log();

  const maxIdLen = Math.max(...GRADIENT_ORDER.map((id) => id.length), "off".length);

  for (const id of [...GRADIENT_ORDER, "off"]) {
    const isCurrent = id === current;
    const marker = isCurrent ? `${GREEN}*${RESET}` : " ";
    const idFormatted = isCurrent
      ? `${BOLD}${CYAN}${id.padEnd(maxIdLen)}${RESET}`
      : id.padEnd(maxIdLen);
    const preview = id === "off" ? `${DIM}theme colors only${RESET}` : gradientStrip(id, config);
    console.log(`  ${marker} ${idFormatted}  ${preview}`);
  }

  console.log();
  console.log(` Run ${CYAN}npx agy-powerline gradient <name>${RESET} to color each row.`);
  console.log(` Your own colors: ${CYAN}npx agy-powerline gradient "#ff5f6d-#ffc371"${RESET}`);
  console.log();
}

async function gradientCommand(name, options = {}) {
  const installDir = resolveInstallDir();
  if (!installDir) {
    return;
  }

  setConfigDir(installDir);
  const config = loadEditableConfig();
  if (!config) {
    return;
  }

  if (!name || options.list) {
    listGradients(config);
    return;
  }

  const raw = String(name).trim();
  const off = raw.toLowerCase() === "off";
  const value = off ? null : normalizeGradient(raw);

  if (!off && !value) {
    console.error(`${RED}error${RESET} Unknown gradient "${raw}".`);
    console.error(` Available gradients: ${GRADIENT_ORDER.join(", ")}, off`);
    console.error(" Or 2 to 6 hex colors joined by dashes, e.g. #ff5f6d-#ffc371");
    process.exitCode = 1;
    return;
  }

  if (off) {
    delete config.gradient;
  } else {
    config.gradient = value;
  }
  saveConfig(config);

  const title = off ? "off" : GRADIENTS[value]?.name || value;

  console.log();
  console.log(`${GREEN}✔${RESET} Gradient set to ${BOLD}${title}${RESET}`);
  console.log(`  config  ${DIM}${getConfigPath()}${RESET}`);
  console.log();
  console.log(" Preview:");
  console.log(renderStatusline(sampleData(), config));
  console.log();
}

module.exports = {
  gradientCommand,
  gradientStrip,
};
