// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/", "gallery.html", "coverage/"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      // Catch real bugs, not style: style is Prettier's job.
      "no-unused-vars": [
        "error",
        { args: "after-used", argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
      // This tool parses terminal escape sequences on purpose.
      "no-control-regex": "off",
      // Empty catch blocks are deliberate best-effort operations here.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
