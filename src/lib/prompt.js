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

module.exports = {
  createRl,
  question,
  confirm,
};
