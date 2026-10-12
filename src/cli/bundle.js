"use strict";

// Builds the installed statusline.js: the runtime script and the library
// files in RUNTIME_FILES, joined into one file. Node loads a single file much
// faster than ~16 small ones (on Windows, opening each file costs more than
// running its code), and Antigravity starts the script on every refresh.
//
// Each file keeps its own scope: its source is wrapped in a function that
// gets its own module, exports and require, the way Node wraps a file. No
// eval, no code generation beyond that wrapper. LINES records where each file
// starts, so the problem log can still name the original file and line.

const fs = require("fs");
const path = require("path");
const { RUNTIME_FILES } = require("../lib/paths");

const LIB_DIR = path.join(__dirname, "..", "lib");
const ENTRY = path.join(__dirname, "..", "runtime", "statusline.js");

// Requires between bundled files resolve inside the bundle; anything else
// (Node built-ins) goes to Node's own require.
const PRELUDE = `const __files = {};
const __cache = {};
function __require(from, id) {
  if (!id.startsWith(".")) {
    return require(id);
  }
  let key = require("path").posix.join(require("path").posix.dirname(from), id);
  if (!key.endsWith(".js")) {
    key += ".js";
  }
  if (!__files[key]) {
    const err = new Error(\`Cannot find module '\${id}' from '\${from}'\`);
    err.code = "MODULE_NOT_FOUND";
    throw err;
  }
  if (!__cache[key]) {
    const module = { exports: {} };
    __cache[key] = module;
    __files[key](module, module.exports, (next) => __require(key, next));
  }
  return __cache[key].exports;
}
`;

function toKey(rel) {
  return rel.split(path.sep).join("/");
}

function wrapperLine(key) {
  return `__files[${JSON.stringify(key)}] = function (module, exports, require) {`;
}

function buildRuntimeBundle() {
  const files = [
    ...RUNTIME_FILES.map((rel) => [toKey(rel), path.join(LIB_DIR, rel)]),
    ["statusline.js", ENTRY],
  ];
  const parts = ["#!/usr/bin/env node", PRELUDE];

  for (const [key, file] of files) {
    const body = fs
      .readFileSync(file, "utf8")
      .replace(/^#!.*\n/, "")
      .replace(/\n+$/, "");
    parts.push(wrapperLine(key), body, "};");
  }

  // [first line of the file in the bundle, file name]; 1-based like stack traces.
  const text = parts.join("\n");
  const bundleLines = text.split("\n");
  const lines = files.map(([key]) => [bundleLines.indexOf(wrapperLine(key)) + 2, key]);

  return [
    text,
    `__require("statusline.js", "./log").setBundleLines(${JSON.stringify(lines)});`,
    `__require("statusline.js", "./statusline");`,
    "",
  ].join("\n");
}

module.exports = { buildRuntimeBundle };
