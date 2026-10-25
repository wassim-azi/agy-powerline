// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { spawn } = require("child_process");

function spawnCapture(file, args, input, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const child = spawn(file, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let done = false;

    const finish = (code, extraErr) => {
      if (done) {
        return;
      }

      done = true;
      resolve({
        code,
        stdout,
        stderr: extraErr ? `${stderr}${stderr ? "\n" : ""}${extraErr}` : stderr,
      });
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(-1, "[timeout]");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      finish(1, err.message);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish(code);
    });

    if (input) {
      child.stdin.write(input);
    }

    child.stdin.end();
  });
}

function runStatuslineCommand(command, input, options = {}) {
  const platform = options.platform || process.platform;

  if (platform === "win32") {
    return spawnCapture("cmd.exe", ["/c", command], input, options.timeoutMs);
  }

  return spawnCapture("sh", ["-c", command], input, options.timeoutMs);
}

module.exports = {
  spawnCapture,
  runStatuslineCommand,
};
