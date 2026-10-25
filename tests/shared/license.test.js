// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Every source file names its license and copyright holder in its first lines,
// so a file copied out of the repo still says where it came from.

const fs = require("fs");
const path = require("path");
const { record } = require("../helpers");

const repo = path.join(__dirname, "..", "..");
const SOURCE = /\.(js|html|tape)$/;
const SKIP = new Set(["node_modules", "fixtures", "snapshots", "_site", "screenshots"]);
const HEADER = ["SPDX-License-Identifier: MIT", "Copyright (c) 2026 agy-powerline contributors"];

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return SOURCE.test(entry.name) ? [full] : [];
  });
}

async function run() {
  const files = [
    ...["src", "scripts", "tests"].flatMap((dir) => sourceFiles(path.join(repo, dir))),
    ...fs
      .readdirSync(repo)
      .filter((name) => name.endsWith(".js"))
      .map((name) => path.join(repo, name)),
  ];
  const missing = files.filter((file) => {
    // Pages keep doctype, <html> and <head> first, so their header sits on lines 4-5.
    const head = fs.readFileSync(file, "utf8").split("\n").slice(0, 6).join("\n");
    return !HEADER.every((line) => head.includes(line));
  });
  record(
    "every source file starts with its SPDX license and copyright lines",
    files.length > 100 && missing.length === 0,
    missing.map((file) => path.relative(repo, file)).join(", ") || `${files.length} files`
  );
}

module.exports = { run };
