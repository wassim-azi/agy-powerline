// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const os = require("os");
const path = require("path");
const { fork } = require("child_process");
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { takeResults } = require("./helpers");

const WORKER_PATH = path.join(__dirname, "suite-worker.js");

function resolveConcurrency() {
  const override = Number(process.env.AGY_TEST_CONCURRENCY);
  if (Number.isInteger(override) && override >= 1) {
    return override;
  }
  const cpus =
    typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
  return Math.max(2, Math.min(cpus || 2, 6));
}

function shouldRunSerial() {
  return (
    process.env.AGY_TEST_SERIAL === "1" || process.execArgv.some((arg) => arg.includes("coverage"))
  );
}

// Runs one suite in a dedicated Node child process and returns its recorded
// checks over IPC. Each suite gets fresh process.env, globals and caches.
function runSuiteIsolated(modulePath) {
  const resolved = require.resolve(modulePath);
  return new Promise((resolve, reject) => {
    const child = fork(WORKER_PATH, [resolved], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      env: process.env,
    });
    let payload = null;
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("message", (msg) => {
      payload = msg;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (payload?.error) {
        reject(new Error(payload.error));
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `Suite worker exited with ${code !== null ? `code ${code}` : `signal ${signal}`}${stderr ? `\n${stderr.trim()}` : ""}`
          )
        );
        return;
      }
      resolve(Array.isArray(payload?.results) ? payload.results : []);
    });
  });
}

async function emitChecks(t, checks) {
  for (const { name: check, ok, detail } of checks) {
    await t.test(check, () => {
      assert.ok(ok, detail || "check failed");
    });
  }
}

// Registers a suite module (exporting `run()`) as a node:test test. Every
// check the suite records becomes a subtest, so the reporter lists them,
// `--test-name-pattern` can filter them, and any failure fails the run.
function registerSuite(name, modulePath, { isolated = false } = {}) {
  test(name, async (t) => {
    if (isolated) {
      const checks = await runSuiteIsolated(modulePath);
      await emitChecks(t, checks);
      return;
    }

    takeResults();
    await require(modulePath).run();
    await emitChecks(t, takeResults());
  });
}

// Registers multiple suites, running them concurrently in isolated OS child
// processes unless serial/coverage mode is active.
function registerSuites(groupName, suites) {
  if (shouldRunSerial()) {
    for (const [name, modulePath] of suites) {
      registerSuite(name, modulePath);
    }
    return;
  }

  describe(groupName, { concurrency: resolveConcurrency() }, () => {
    for (const [name, modulePath] of suites) {
      registerSuite(name, modulePath, { isolated: true });
    }
  });
}

module.exports = { registerSuite, registerSuites };
