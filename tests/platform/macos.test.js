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
  which,
} = require("../helpers");
const { statuslineCommand } = require("../../src/lib/paths");

async function testMacNativeSh() {
  const dir = stageInstall(path.join(os.tmpdir(), "agy-powerline-verify-mac"));
  const command = statuslineCommand(dir, { platform: "darwin", execPath: NODE });

  const sh = await spawnCapture("/bin/sh", ["-c", command], PAYLOAD);
  record(
    "macOS /bin/sh native execution of quoted node + script",
    sh.code === 0 && looksRendered(sh.stdout),
    sh.code !== 0 ? sh.stderr.trim() : `exit ${sh.code}`
  );

  if (which("/bin/zsh")) {
    const zsh = await spawnCapture("/bin/zsh", ["-c", command], PAYLOAD);
    record(
      "macOS /bin/zsh native execution of quoted node + script",
      zsh.code === 0 && looksRendered(zsh.stdout),
      zsh.code !== 0 ? zsh.stderr.trim() : `exit ${zsh.code}`
    );
  }

  const spaceDir = stageInstall(path.join(os.tmpdir(), "agy powerline verify mac"));
  const spaceCmd = statuslineCommand(spaceDir, { platform: "darwin", execPath: NODE });
  const space = await spawnCapture("/bin/sh", ["-c", spaceCmd], PAYLOAD);
  record(
    "macOS /bin/sh native execution with spaces in install path",
    space.code === 0 && looksRendered(space.stdout),
    space.code !== 0 ? space.stderr.trim() : `exit ${space.code}`
  );
}

async function testMacInit() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-mac-init-"));
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

    record("macOS init writes scripts with no shell launcher", ok, `exit ${res.code}`);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

async function run() {
  if (process.platform !== "darwin") {
    record("macOS test suite", true, "skipped (not running on darwin)");
    return;
  }
  await testMacNativeSh();
  await testMacInit();
}

module.exports = { run };
