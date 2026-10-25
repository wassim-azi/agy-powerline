// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const { record, runCli } = require("../helpers");
const { VALID_WIDGET_IDS, PRESETS, LAYOUT_ORDER } = require("../../src/lib/config");
const { THEME_ORDER } = require("../../src/lib/themes");

// The README and every README.<lang>.md translation list the same widgets,
// themes, presets and commands, and link each other from their language
// switcher, so a translation can't quietly fall behind the code.
const ROOT = path.join(__dirname, "..", "..");
// Same file-name pattern as the npm package check in ci.yml.
const README_FILE = /^README(\.[a-z]{2}(-[A-Z]{2})?)?\.md$/;
// Layout pieces rather than widgets: the READMEs describe them in prose.
const UNLISTED_WIDGETS = new Set(["separator", "lineBreak"]);

function readmeFiles() {
  return fs
    .readdirSync(ROOT)
    .filter((file) => README_FILE.test(file))
    .sort();
}

// From --help, so the list of commands lives in one place (src/index.js).
function commandNames() {
  const help = runCli(["--help"]).stdout;
  const commands = help.slice(help.indexOf("Commands:"));
  return [...commands.matchAll(/^ {2}([a-z]+)/gm)].map((match) => match[1]);
}

async function run() {
  const files = readmeFiles();
  const commands = commandNames();
  const ids = [
    ...[...VALID_WIDGET_IDS].filter((id) => !UNLISTED_WIDGETS.has(id)),
    ...THEME_ORDER,
    ...Object.keys(PRESETS),
  ];

  record(
    "the README check finds README.md and the commands",
    files.includes("README.md") && commands.includes("init"),
    `${files.join(", ")} / ${commands.join(", ")}`
  );

  for (const file of files) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    const missingIds = ids.filter((id) => !text.includes(`\`${id}\``));
    const missingCommands = commands.filter((name) => !text.includes(`npx agy-powerline ${name}`));
    const missingLinks = files.filter((other) => other !== file && !text.includes(`](${other})`));

    record(
      `${file} lists every widget, theme and preset id`,
      missingIds.length === 0,
      `missing: ${missingIds.join(", ")}`
    );
    record(
      `${file} lists every command`,
      missingCommands.length === 0,
      `missing: ${missingCommands.join(", ")}`
    );
    record(
      `${file} links every other README from its language switcher`,
      missingLinks.length === 0,
      `missing: ${missingLinks.join(", ")}`
    );
  }

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  const missingLlmsIds = ids.filter((id) => !llms.includes(`\`${id}\``));
  const missingLayouts = LAYOUT_ORDER.filter((id) => !llms.includes(`\`${id}\``));
  const missingCommands = commands.filter((name) => !llms.includes(`npx agy-powerline ${name}`));

  record(
    "llms.txt lists every widget, theme and preset id",
    missingLlmsIds.length === 0,
    `missing: ${missingLlmsIds.join(", ")}`
  );
  record(
    "llms.txt lists every layout id",
    missingLayouts.length === 0,
    `missing: ${missingLayouts.join(", ")}`
  );
  record(
    "llms.txt lists every command",
    missingCommands.length === 0,
    `missing: ${missingCommands.join(", ")}`
  );
  record(
    "llms.txt contains no email addresses",
    !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(llms),
    "no email addresses allowed"
  );
}

module.exports = { run };
