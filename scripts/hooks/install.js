// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Runs on `npm install` (the "prepare" script) in a clone of the repo and
// points git at .githooks/. The release removes "prepare" from the published
// package (see release.yml), so installs from npm never see or run it.
// It never fails the install: outside a git checkout it does nothing.
// Messages go to stderr so they never mix with JSON output (npm pack --json).

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..", "..");

if (!fs.existsSync(path.join(root, ".git")) || !fs.existsSync(path.join(root, ".githooks"))) {
  process.exit(0);
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "ignore" });
  console.error("agy-powerline: git hooks enabled (.githooks/: formatting, lint, commit messages)");
} catch {
  console.error(
    "agy-powerline: could not enable git hooks; run `git config core.hooksPath .githooks`"
  );
}
