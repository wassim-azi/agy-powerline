// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const readline = require("readline");

function createRl() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => resolve(String(answer || "")));
  });
}

async function confirm(rl, message, defaultYes) {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = (await question(rl, `${message} (${hint}) `)).trim().toLowerCase();

  if (!answer) {
    return defaultYes;
  }

  return answer === "y" || answer === "yes";
}

// Numbered options, answered with a number; Enter keeps the default. Anything
// else asks again, at most 3 times, then the default stands. No raw mode or
// arrow keys, so it works in every terminal and in cmd. An option can span
// several lines (a label and its preview). Returns the chosen index.
async function choose(rl, message, options, defaultIndex = 0, print = console.log) {
  print(message);
  options.forEach((option, i) => {
    const [first, ...rest] = String(option).split("\n");
    print(`  ${String(i + 1).padStart(2)}) ${first}`);
    rest.forEach((line) => print(`      ${line}`));
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = (
      await question(rl, `  Choose 1-${options.length} (Enter: ${defaultIndex + 1}) `)
    ).trim();
    if (!answer) {
      return defaultIndex;
    }
    const index = /^\d{1,3}$/.test(answer) ? Number(answer) - 1 : -1;
    if (index >= 0 && index < options.length) {
      return index;
    }
  }
  return defaultIndex;
}

module.exports = {
  createRl,
  question,
  confirm,
  choose,
};
