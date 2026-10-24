"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record } = require("../helpers");
const {
  isWsl,
  isWindowsNodeOnWsl,
  windowsNodeOnWslMessage,
  writeWindowsLauncher,
  readSettingsForUpdate,
} = require("../../src/lib/paths");

function withTempDir(name, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `agy-paths-${name}-`));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function withProcVersion(value, run) {
  const readFileSync = fs.readFileSync;
  fs.readFileSync = function (file, ...args) {
    if (file === "/proc/version") {
      if (value instanceof Error) {
        throw value;
      }
      return value;
    }
    return readFileSync.call(this, file, ...args);
  };
  try {
    return run();
  } finally {
    fs.readFileSync = readFileSync;
  }
}

async function run() {
  const wslByEnv = isWsl({ env: { WSL_DISTRO_NAME: "Ubuntu" }, platform: "win32" });
  const notLinux = isWsl({ env: {}, platform: "darwin", procVersion: "Microsoft WSL" });
  const wslByMicrosoft = isWsl({ env: {}, platform: "linux", procVersion: "Microsoft" });
  const wslByName = isWsl({ env: {}, platform: "linux", procVersion: "WSL2" });
  const plainLinux = isWsl({ env: {}, platform: "linux", procVersion: "Linux" });
  const fallbackMicrosoft = withProcVersion("Linux Microsoft", () =>
    isWsl({ env: {}, platform: "linux" })
  );
  const unreadableProcVersion = withProcVersion(new Error("permission denied"), () =>
    isWsl({ env: {}, platform: "linux" })
  );
  record(
    "isWsl detects its environment flag and Microsoft/WSL proc versions only on Linux",
    wslByEnv &&
      !notLinux &&
      wslByMicrosoft &&
      wslByName &&
      !plainLinux &&
      fallbackMicrosoft &&
      !unreadableProcVersion,
    JSON.stringify({
      wslByEnv,
      notLinux,
      wslByMicrosoft,
      wslByName,
      plainLinux,
      fallbackMicrosoft,
      unreadableProcVersion,
    })
  );

  const onWslWindowsNode = isWindowsNodeOnWsl({
    env: { WSL_DISTRO_NAME: "Ubuntu" },
    platform: "linux",
    execPath: "/mnt/c/Program Files/node.exe",
  });
  const onWslLinuxNode = isWindowsNodeOnWsl({
    env: { WSL_DISTRO_NAME: "Ubuntu" },
    platform: "linux",
    execPath: "/usr/bin/node",
  });
  const outsideWsl = isWindowsNodeOnWsl({
    env: {},
    platform: "linux",
    procVersion: "Linux",
    execPath: "/mnt/c/node.exe",
  });
  record(
    "isWindowsNodeOnWsl recognizes Windows executables under /mnt only in WSL",
    onWslWindowsNode && !onWslLinuxNode && !outsideWsl,
    JSON.stringify({ onWslWindowsNode, onWslLinuxNode, outsideWsl })
  );

  const message = windowsNodeOnWslMessage("/mnt/c/Program Files/node.exe");
  record(
    "windowsNodeOnWslMessage names the executable and Linux Node remedy",
    message.includes("/mnt/c/Program Files/node.exe") &&
      message.includes("Install Node.js 20 or newer inside WSL") &&
      message.includes("agy-powerline init --yes")
  );

  withTempDir("launcher", (root) => {
    const nodePath = "C:\\Program Files\\nodejs\\node.exe";
    const launcher = path.join(root, "statusline.cmd");
    writeWindowsLauncher(root, nodePath);
    const before = fs.readFileSync(launcher, "utf8");
    const writeFileSync = fs.writeFileSync;
    let writes = 0;
    fs.writeFileSync = function (...args) {
      if (args[0] === launcher) {
        writes += 1;
      }
      return writeFileSync.apply(this, args);
    };
    try {
      writeWindowsLauncher(root, nodePath);
    } finally {
      fs.writeFileSync = writeFileSync;
    }

    record(
      "writeWindowsLauncher leaves an identical launcher untouched",
      writes === 0 && fs.readFileSync(launcher, "utf8") === before,
      `writes: ${writes}`
    );
    record(
      "Windows launcher forwards statusline arguments",
      before.includes('"%~dp0statusline.js" %*')
    );
  });

  withTempDir("settings", (root) => {
    const settings = path.join(root, "settings.json");
    fs.writeFileSync(settings, "", "utf8");
    const empty = readSettingsForUpdate(settings);
    record(
      "readSettingsForUpdate treats an empty settings file as an empty object",
      empty.exists &&
        empty.settings &&
        Object.keys(empty.settings).length === 0 &&
        empty.error === undefined,
      JSON.stringify(empty)
    );

    for (const [name, text] of [
      ["array", "[]"],
      ["number", "42"],
    ]) {
      fs.writeFileSync(settings, text, "utf8");
      const result = readSettingsForUpdate(settings);
      record(
        `readSettingsForUpdate rejects a top-level JSON ${name}`,
        result.exists &&
          result.error === "top-level value is not a JSON object" &&
          result.settings === undefined,
        JSON.stringify(result)
      );
    }
  });
}

module.exports = { run };
