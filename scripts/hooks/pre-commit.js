#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// pre-commit hook: Prettier and ESLint on the staged files only, so it stays
// fast. It checks the files as they are on disk; stage your final version.

const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

function stagedFiles() {
  const out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  return out.split("\0").filter((file) => file && fs.existsSync(path.join(root, file)));
}

// CLI entry files are looked up on disk: packages like ESLint don't expose
// their bin files through require.resolve.
function tool(relativePath) {
  const file = path.join(root, "node_modules", relativePath);
  if (!fs.existsSync(file)) {
    console.error("✖ Dev dependencies are missing. Run `npm install`, then commit again.");
    process.exit(1);
  }
  return file;
}

function run(label, script, args, fix) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(
      `\n✖ ${label} failed. Fix it with \`${fix}\`, stage the result, and commit again.`
    );
    return false;
  }
  return true;
}

const files = stagedFiles();

if (!files.length) {
  process.exit(0);
}

const jsFiles = files.filter((file) => file.endsWith(".js"));
let ok = run(
  "Formatting check",
  tool("prettier/bin/prettier.cjs"),
  // "--" so a staged file named like an option ("--config=...") stays a file.
  ["--check", "--ignore-unknown", "--log-level", "warn", "--", ...files],
  "npm run format"
);

if (jsFiles.length) {
  ok =
    run(
      "Lint",
      tool("eslint/bin/eslint.js"),
      ["--no-warn-ignored", "--max-warnings", "0", "--", ...jsFiles],
      "npm run lint:fix"
    ) && ok;
}

process.exit(ok ? 0 : 1);
