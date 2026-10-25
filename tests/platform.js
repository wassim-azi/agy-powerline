// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Native launcher tests for the current OS. Run with `npm run test:platform`.
const { registerSuite } = require("./register");

const SUITES = {
  win32: ["windows", "./platform/windows.test"],
  linux: ["linux", "./platform/linux.test"],
  darwin: ["macos", "./platform/macos.test"],
};

const suite = SUITES[process.platform];

if (suite) {
  registerSuite(`platform: ${suite[0]}`, suite[1]);
} else {
  require("node:test").test(
    `platform: ${process.platform}`,
    { skip: "no platform suite for this OS" },
    () => {}
  );
}
