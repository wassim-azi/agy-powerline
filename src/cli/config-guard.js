// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { readConfigFile, getConfigPath } = require("../lib/shared");

const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function printInvalidConfig(reason) {
  console.error(`${RED}error${RESET} ${getConfigPath()} is not valid JSON.`);
  console.error(`  ${DIM}${reason}${RESET}`);
  console.error(" Fix the file, or delete it to start from the defaults. Nothing was changed.");
}

// Commands that save the config must not start from defaults when the file is
// broken: saving would erase the user's widgets. Returns null after printing
// the problem; the caller just returns.
function loadEditableConfig() {
  const { config, error } = readConfigFile();

  if (error) {
    printInvalidConfig(error);
    process.exitCode = 1;
    return null;
  }

  return config;
}

module.exports = {
  loadEditableConfig,
  printInvalidConfig,
};
