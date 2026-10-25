// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  record,
  PAYLOAD,
  NODE,
  stageInstall,
  spawnCapture,
  looksRendered,
  runCli,
} = require("../helpers");
const { statuslineCommand } = require("../../src/lib/paths");

async function testLinuxNativeSh() {
  const dir = stageInstall(path.join(os.tmpdir(), "agy-powerline-verify-linux"));
  const command = statuslineCommand(dir, { platform: "linux", execPath: NODE });

  const sh = await spawnCapture("/bin/sh", ["-c", command], PAYLOAD);
  record(
    "Linux /bin/sh native execution of quoted node + script",
    sh.code === 0 && looksRendered(sh.stdout),
    sh.code !== 0 ? sh.stderr.trim() : `exit ${sh.code}`
  );

  const spaceDir = stageInstall(path.join(os.tmpdir(), "agy powerline verify linux"));
  const spaceCmd = statuslineCommand(spaceDir, { platform: "linux", execPath: NODE });
  const space = await spawnCapture("/bin/sh", ["-c", spaceCmd], PAYLOAD);
  record(
    "Linux /bin/sh native execution with spaces in install path",
    space.code === 0 && looksRendered(space.stdout),
    space.code !== 0 ? space.stderr.trim() : `exit ${space.code}`
  );
}

async function testLinuxInit() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-linux-init-"));
  const home = path.join(sandbox, "home");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;

  try {
    const res = runCli(["init", "--yes"], { cwd: sandbox, env });
    const installDir = path.join(home, ".agy-powerline");
    const ok =
      res.code === 0 &&
      !fs.existsSync(path.join(installDir, "statusline.cmd")) &&
      fs.existsSync(path.join(installDir, "statusline.js")) &&
      !fs.existsSync(path.join(installDir, "shared.js")) &&
      fs.existsSync(path.join(installDir, "install.json"));

    record("Linux init writes scripts with no shell launcher", ok, `exit ${res.code}`);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

async function run() {
  if (process.platform !== "linux") {
    record("Linux test suite", true, "skipped (not running on linux)");
    return;
  }
  await testLinuxNativeSh();
  await testLinuxInit();
}

module.exports = { run };
