#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Checks commit messages against Conventional Commits
// (https://www.conventionalcommits.org/). Used by the commit-msg hook and CI.
//
//   node scripts/hooks/commit-message.js <message-file>     commit-msg hook
//   node scripts/hooks/commit-message.js --message "<text>" one message (PR title)
//   node scripts/hooks/commit-message.js --range <a>..<b>    every commit in a range

const fs = require("fs");
const { execFileSync } = require("child_process");

const TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];
const MAX_SUBJECT = 100;
const PATTERN = new RegExp(`^(${TYPES.join("|")})(\\([a-z0-9 ._/-]+\\))?!?: \\S.*$`);

// Messages git or GitHub write on their own.
const EXEMPT = [/^Merge /, /^Revert "/, /^(fixup|squash|amend)! /];

function subjectOf(message) {
  return (
    String(message)
      .split(/\r?\n/)
      .find((line) => line.trim() && !line.startsWith("#")) || ""
  ).trim();
}

// Returns an error string, or "" when the message is acceptable.
function checkMessage(message) {
  const subject = subjectOf(message);

  if (!subject) {
    return "the commit message is empty";
  }
  if (EXEMPT.some((re) => re.test(subject))) {
    return "";
  }
  if (!PATTERN.test(subject)) {
    return `"${subject}" does not follow Conventional Commits`;
  }
  if (subject.length > MAX_SUBJECT) {
    return `the first line is ${subject.length} characters; keep it under ${MAX_SUBJECT + 1}`;
  }
  return "";
}

const HELP = [
  "Format:  <type>(<optional scope>): <description>",
  `Types:   ${TYPES.join(", ")}`,
  "Examples:",
  "  feat(widget): add battery status indicator",
  "  fix(windows): escape launcher path with spaces",
  "  docs: update the theme list in README",
  "Breaking change: add ! before the colon, e.g. feat(config)!: rename theme ids",
].join("\n");

function main(argv) {
  const messages = [];

  if (argv[0] === "--message") {
    messages.push(argv[1] || "");
  } else if (argv[0] === "--range") {
    const log = execFileSync("git", ["log", "--format=%H%x00%B%x01", argv[1]], {
      encoding: "utf8",
    });
    for (const entry of log.split("\x01")) {
      const [sha, body] = entry.replace(/^\s+/, "").split("\x00");
      if (sha) {
        messages.push({ sha: sha.slice(0, 7), body });
      }
    }
  } else if (argv[0]) {
    messages.push(fs.readFileSync(argv[0], "utf8"));
  } else {
    console.error("usage: commit-message.js <file> | --message <text> | --range <a>..<b>");
    return 2;
  }

  let failures = 0;
  for (const item of messages) {
    const body = typeof item === "string" ? item : item.body;
    const error = checkMessage(body);
    if (error) {
      failures += 1;
      console.error(`✖ ${typeof item === "string" ? "" : `${item.sha}: `}${error}`);
    }
  }

  if (failures) {
    console.error(`\n${HELP}`);
    return 1;
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { checkMessage, subjectOf, TYPES };
