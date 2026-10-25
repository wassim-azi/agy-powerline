// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { takeResults } = require("./helpers");

// Registers a suite module (exporting `run()`) as a node:test test. Every
// check the suite records becomes a subtest, so the reporter lists them,
// `--test-name-pattern` can filter them, and any failure fails the run.
function registerSuite(name, modulePath) {
  test(name, async (t) => {
    takeResults();
    await require(modulePath).run();

    for (const { name: check, ok, detail } of takeResults()) {
      await t.test(check, () => {
        assert.ok(ok, detail || "check failed");
      });
    }
  });
}

module.exports = { registerSuite };
