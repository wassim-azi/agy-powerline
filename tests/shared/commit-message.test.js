// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { record } = require("../helpers");
const { checkMessage } = require("../../scripts/hooks/commit-message");

const VALID = [
  "feat: initial release",
  "feat(widget): add battery status indicator",
  "fix(windows): escape launcher path with spaces",
  "feat(config)!: rename theme ids",
  "chore(deps): bump prettier from 3.9.8 to 3.9.9",
  "ci(deps): bump actions/checkout from 7.0.1 to 7.0.2",
  "docs: update README\n\nLonger body explaining the change.",
  "# comment lines are ignored\nfix: handle empty payload",
  "Merge pull request #12 from wassim-azi/develop",
  'Revert "feat: add battery widget"',
  "fixup! fix: handle empty payload",
];

const INVALID = [
  "init project",
  "Added a new widget",
  "feat add widget",
  "feature: add widget",
  "feat: ",
  "Feat: add widget",
  "",
  `feat: ${"x".repeat(120)}`,
];

async function run() {
  for (const message of VALID) {
    const error = checkMessage(message);
    record(`commit message accepted: ${message.split("\n")[0].slice(0, 60)}`, error === "", error);
  }

  for (const message of INVALID) {
    const error = checkMessage(message);
    record(
      `commit message rejected: ${JSON.stringify(message.slice(0, 40))}`,
      error !== "",
      "was accepted"
    );
  }
}

module.exports = { run };
