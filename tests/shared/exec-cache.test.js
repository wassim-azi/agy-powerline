// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");
const { record } = require("../helpers");
const { setLogDir, readLog, LOG_NAME } = require("../../src/lib/log");

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-exec-cache-"));
  const installDir = path.join(root, ".agy-powerline");
  const modulePath = require.resolve("../../src/lib/exec");
  const previousModule = require.cache[modulePath];
  const envKeys = ["HOME", "USERPROFILE", "AGY_POWERLINE_HOME"];
  const previousEnv = envKeys.map((key) => process.env[key]);
  const previousExec = childProcess.execSync;
  const previousTmpdir = os.tmpdir;
  const previousUserInfo = os.userInfo;
  let calls = 0;
  childProcess.execSync = () => {
    calls++;
    return "fresh output\n";
  };
  const fresh = () => {
    delete require.cache[modulePath];
    return require(modulePath);
  };

  try {
    process.env.HOME = root;
    process.env.USERPROFILE = root;
    process.env.AGY_POWERLINE_HOME = installDir;
    os.tmpdir = () => path.join(root, "fallback");
    os.userInfo = () => ({ username: "odd user/name" });
    let exec = fresh();
    const fallback = path.join(root, "fallback", "agy-powerline-exec-cache-odd_user_name.json");
    record(
      "exec fallback cache path uses a sanitised per-user name",
      exec.getCacheFilePath() === fallback
    );
    exec.saveDiskCache({ marker: { output: "saved", timestamp: Date.now() } });
    record(
      "exec cache creates a missing parent folder",
      exec.loadDiskCache().marker?.output === "saved"
    );
    os.userInfo = () => {
      throw new Error("account unavailable");
    };
    record(
      "exec fallback handles an unavailable user name",
      exec.getCacheFilePath() === path.join(root, "fallback", "agy-powerline-exec-cache-user.json")
    );

    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, "statusline.config.json"), "{}");
    const cacheFile = path.join(installDir, ".exec-cache.json");
    fs.writeFileSync(cacheFile, "{invalid json");
    record("exec ignores unreadable cache JSON", Object.keys(exec.loadDiskCache()).length === 0);
    fs.writeFileSync(cacheFile, "null");
    record("exec ignores a non-object disk cache", Object.keys(exec.loadDiskCache()).length === 0);

    const cmd = "private-command --private-argument";
    const session = { cwd: root };
    const key = exec.cacheKey(cmd, root);
    exec.saveDiskCache({ [key]: { output: "from another window", timestamp: Date.now() } });
    exec = fresh();
    record(
      "exec reads disk cache with empty memory and then retains it in memory",
      exec.runExecWidget({ cmd }, session) === "from another window" &&
        (fs.unlinkSync(cacheFile), exec.runExecWidget({ cmd }, session)) ===
          "from another window" &&
        calls === 0
    );
    record(
      "blank exec commands return without executing",
      exec.runExecWidget({ cmd: "  " }, session) === "" && calls === 0
    );

    exec.saveDiskCache({
      old: { output: "expired", timestamp: Date.now() - 3_601_000 },
      recent: { output: "keep", timestamp: Date.now() },
    });
    exec.runExecWidget({ cmd: "new-command" }, session);
    const saved = exec.loadDiskCache();
    record(
      "saving exec output prunes old entries and keeps recent entries",
      !Object.hasOwn(saved, "old") && saved.recent.output === "keep" && calls === 1
    );

    setLogDir(installDir);
    childProcess.execSync = () => {
      const error = new Error(cmd);
      error.status = 127;
      throw error;
    };
    exec = fresh();
    exec.runExecWidget({ cmd: "missing-private-command" }, session);
    const entries = readLog(path.join(installDir, LOG_NAME));
    record(
      "missing exec commands log only a fixed code, never the command",
      entries.some((entry) => entry.code === "EXEC_COMMAND_NOT_FOUND") &&
        !JSON.stringify(entries).includes("private-command")
    );
  } finally {
    setLogDir(null);
    childProcess.execSync = previousExec;
    os.tmpdir = previousTmpdir;
    os.userInfo = previousUserInfo;
    delete require.cache[modulePath];
    if (previousModule) require.cache[modulePath] = previousModule;
    envKeys.forEach((key, index) => {
      if (previousEnv[index] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[index];
    });
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
