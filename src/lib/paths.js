"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOCAL_DIR_NAME = ".agy-powerline";
const GLOBAL_DIR = path.join(os.homedir(), LOCAL_DIR_NAME);
const AGY_SETTINGS = path.join(os.homedir(), ".gemini", "antigravity-cli", "settings.json");

const INSTALL_META_NAME = "install.json";

// Library files the runtime needs (paths relative to src/lib). init joins them
// with src/runtime/statusline.js into the one installed statusline.js.
const RUNTIME_FILES = [
  "shared.js",
  "colors.js",
  "themes.js",
  "config.js",
  "formatters.js",
  "git.js",
  "session.js",
  "paths.js",
  "exec.js",
  "powerline.js",
  "widget-style.js",
  "fit.js",
  "log.js",
  "payload-dump.js",
  path.join("layouts", "lines.js"),
  path.join("layouts", "pills.js"),
];

// Files that can hold the user's commands, their output or session details.
// They are written readable by the owner only, so other accounts on a shared
// machine can't read them (Windows profile folders are private already).
const PRIVATE_FILES = [
  "statusline.config.json",
  ".exec-cache.json",
  "last-payload.json",
  // SYNC_CACHE_NAME in git.js: commit IDs of the repos you work in.
  ".git-sync-cache.json",
  // STATUS_CACHE_NAME in git.js: repo paths with their file and line counts.
  ".git-status-cache.json",
  // LOG_NAME in log.js, spelled out because log.js requires this file.
  "agy-powerline.log",
];
const PRIVATE_FILE_MODE = 0o600;

// Everything init or the runtime may create in the install dir. uninstall
// --delete removes only these, never the whole directory tree. RUNTIME_FILES
// are listed for installs from 1.1.0 and earlier, which copied them separately.
const INSTALLED_FILES = [
  "statusline.js",
  "statusline.cmd",
  INSTALL_META_NAME,
  ...PRIVATE_FILES,
  ...RUNTIME_FILES,
];

function readProcVersion() {
  try {
    return fs.readFileSync("/proc/version", "utf8");
  } catch {
    return "";
  }
}

function isWsl(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;

  if (env.WSL_DISTRO_NAME) {
    return true;
  }

  if (platform !== "linux") {
    return false;
  }

  const procVersion = options.procVersion != null ? options.procVersion : readProcVersion();
  return /microsoft|wsl/i.test(procVersion);
}

function isWindowsNodeOnWsl(options = {}) {
  const execPath = options.execPath || process.execPath;

  if (!isWsl(options)) {
    return false;
  }

  return /^\/mnt\/[a-z]\//i.test(toPosixPath(execPath));
}

function windowsNodeOnWslMessage(execPath = process.execPath) {
  return [
    "This Node binary is the Windows build (a /mnt/c/... path).",
    `  ${execPath}`,
    "Antigravity on Ubuntu/WSL needs Linux Node, or settings will get a Windows command.",
    "Install Node.js 20 or newer inside WSL (for example with nvm), then re-run:",
    "  npm install -g agy-powerline",
    "  agy-powerline init --yes",
  ].join("\n");
}

// Never looks at the current directory: a cloned repo must not be able to
// supply its own config (and exec widgets) to the CLI or the runtime.
function resolveInstallDir() {
  return process.env.AGY_POWERLINE_HOME || GLOBAL_DIR;
}

function safeRealpath(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

// Exec widgets only run from a config the user owns outright: the global
// install dir or an explicit AGY_POWERLINE_HOME. A copy living anywhere else
// (e.g. committed inside a repo) can be changed by whoever controls it.
function isTrustedInstallDir(dir, env = process.env) {
  if (!dir) {
    return false;
  }

  const target = safeRealpath(dir);
  const trusted = [GLOBAL_DIR, env.AGY_POWERLINE_HOME].filter(Boolean);
  const same = (a, b) =>
    process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;

  return trusted.some((candidate) => same(safeRealpath(candidate), target));
}

function toPosixPath(value) {
  return String(value).replace(/\\/g, "/");
}

function quoteForSh(value) {
  const posix = toPosixPath(value);
  return `'${posix.replace(/'/g, `'\\''`)}'`;
}

function windowsLauncherPath(installDir) {
  return path.join(installDir, "statusline.cmd");
}

function windowsLauncherBody(nodePath = process.execPath) {
  const node = String(nodePath).replace(/"/g, "").replace(/%/g, "%%");
  return [
    "@echo off",
    "setlocal DisableDelayedExpansion",
    `"${node}" "%~dp0statusline.js"`,
    "",
  ].join("\r\n");
}

function writeWindowsLauncher(installDir, nodePath = process.execPath) {
  const dest = windowsLauncherPath(installDir);
  const body = windowsLauncherBody(nodePath);
  try {
    if (fs.existsSync(dest) && fs.readFileSync(dest, "utf8") === body) {
      return;
    }
  } catch {
    // Ignore read error and proceed to write
  }

  try {
    fs.writeFileSync(dest, body, "utf8");
  } catch (err) {
    if (err.code === "EBUSY" && fs.existsSync(dest)) {
      return;
    }
    throw err;
  }
}

function installMetaPath(installDir) {
  return path.join(installDir, INSTALL_META_NAME);
}

function writeInstallMeta(installDir, extra = {}) {
  const body = {
    version: extra.version || require("../../package.json").version,
    node: extra.node || process.execPath,
    platform: extra.platform || process.platform,
    installedAt: extra.installedAt || new Date().toISOString(),
  };
  fs.writeFileSync(installMetaPath(installDir), JSON.stringify(body, null, 2) + "\n", "utf8");
  return body;
}

function readInstallMeta(installDir) {
  try {
    return JSON.parse(fs.readFileSync(installMetaPath(installDir), "utf8"));
  } catch {
    return null;
  }
}

function readAgySettings() {
  try {
    return JSON.parse(fs.readFileSync(AGY_SETTINGS, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

// Reads settings.json for modification. A file that exists but is not plain
// JSON (comments, trailing commas, a typo) is reported instead of being
// treated as empty, so writing back can never drop the user's other settings.
function readSettingsForUpdate(file = AGY_SETTINGS) {
  let text;

  try {
    text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  } catch (err) {
    if (err.code === "ENOENT") {
      return { exists: false, settings: {} };
    }
    return { exists: true, error: err.message };
  }

  if (!text.trim()) {
    return { exists: true, settings: {} };
  }

  try {
    const settings = JSON.parse(text);
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return { exists: true, error: "top-level value is not a JSON object" };
    }
    return { exists: true, settings };
  } catch (err) {
    return { exists: true, error: err.message };
  }
}

function settingsBackupPath(file = AGY_SETTINGS) {
  return `${file}.agy-powerline.bak`;
}

function settingsOriginalBackupPath(file = AGY_SETTINGS) {
  return `${file}.agy-powerline.original.bak`;
}

// Two copies before every change: the latest file, replaced each time, and
// the file as it was before agy-powerline first changed it, written once and
// never replaced, so running init again can't lose the user's own version.
// Returns the original backup's path when this call created it.
function backUpSettings(file) {
  if (!fs.existsSync(file)) {
    return null;
  }
  const original = settingsOriginalBackupPath(file);
  const created = !fs.existsSync(original);
  if (created) {
    fs.copyFileSync(file, original);
  }
  fs.copyFileSync(file, settingsBackupPath(file));
  return created ? original : null;
}

// Backs up the current file, then writes atomically. Returns what
// backUpSettings() returns.
function writeJsonSafely(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const originalBackup = backUpSettings(file);
  writeFileAtomic(file, JSON.stringify(data, null, 2) + "\n");
  return originalBackup;
}

// Dotfile managers (stow, chezmoi, yadm) link files such as settings.json
// into place. A write goes through the link to the file it points to, so the
// link stays a link and the user's real file gets the change; a rename onto
// the link itself would replace it with a plain file.
function writeTarget(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    // Missing file, or a link whose target doesn't exist yet: follow it once.
    try {
      if (fs.lstatSync(file).isSymbolicLink()) {
        return path.resolve(path.dirname(file), fs.readlinkSync(file));
      }
    } catch {
      // Nothing at that path.
    }
    return file;
  }
}

// Writes via temp file + rename so an interrupted write cannot leave a
// truncated file behind. The new file gets `mode` when given, otherwise the
// mode the existing file had, so rewriting a file never widens who can read
// it (the rename would otherwise reset it to the default).
function writeFileAtomic(file, body, { mode } = {}) {
  const dest = writeTarget(file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.tmp`;
  const target = process.platform === "win32" ? undefined : (mode ?? existingMode(dest));
  fs.writeFileSync(tmp, body, { encoding: "utf8", mode: target ?? 0o666 });
  if (target !== undefined) {
    // The mode passed to writeFileSync is reduced by the umask; set it exactly.
    // Some filesystems (e.g. Windows drives under WSL) refuse chmod; the write
    // still matters more.
    try {
      fs.chmodSync(tmp, target);
    } catch {
      // Keep the mode writeFileSync gave it.
    }
  }

  try {
    fs.renameSync(tmp, dest);
  } catch {
    // Windows can refuse to replace a file another process holds open.
    fs.writeFileSync(dest, body, "utf8");
    fs.rmSync(tmp, { force: true });
  }
}

function existingMode(file) {
  try {
    return fs.statSync(file).mode & 0o777;
  } catch {
    return undefined;
  }
}

// Installs made before the private-file change left these files readable by
// everyone; init narrows them. Best effort: a file we can't chmod stays as is.
function restrictPrivateFiles(installDir) {
  if (process.platform === "win32") {
    return;
  }
  for (const name of PRIVATE_FILES) {
    try {
      fs.chmodSync(path.join(installDir, name), PRIVATE_FILE_MODE);
    } catch {
      // Missing file, or not ours to change.
    }
  }
}

// Removes a settings.json that would be left empty. A symlinked one is emptied
// instead: deleting the link would break the user's dotfiles and leave the
// real file unchanged. Returns "deleted", "emptied" or null (nothing there).
function removeSettingsFile(file = AGY_SETTINGS) {
  if (!fs.existsSync(file)) {
    return null;
  }
  backUpSettings(file);
  if (fs.lstatSync(file).isSymbolicLink()) {
    writeFileAtomic(file, "{}\n");
    return "emptied";
  }
  fs.rmSync(file, { force: true });
  return "deleted";
}

// Antigravity runs the Windows launcher through `cmd /c`, which splits the
// command at these characters, so a launcher in such a folder never starts.
// Spaces, %, ! and brackets are fine.
const CMD_BREAKING_CHARS = /[&(^,;=]/g;

function cmdBreakingChars(installDir, platform = process.platform) {
  if (platform !== "win32") {
    return [];
  }
  return [...new Set(String(installDir).match(CMD_BREAKING_CHARS) || [])];
}

function cmdBreakingMessage(chars) {
  const list = chars.map((char) => `"${char}"`).join(", ");
  return [
    `The install folder contains ${list}. Windows splits the statusline command at`,
    "these characters, so Antigravity could not start it. Set AGY_POWERLINE_HOME",
    "permanently to a folder without them (for example: setx AGY_POWERLINE_HOME",
    "C:\\agy-powerline), open a new terminal and run npx agy-powerline init again.",
  ].join("\n  ");
}

function statuslineCommand(installDir, options = {}) {
  const platform = options.platform || process.platform;
  const execPath = options.execPath || process.execPath;
  const script = path.join(installDir, "statusline.js");

  if (platform === "win32") {
    // Antigravity runs `cmd /c <command>` via Go os/exec. Embedded quotes are
    // escaped to \" and cmd then treats them as part of the executable name.
    return toPosixPath(windowsLauncherPath(installDir));
  }

  // Antigravity runs `sh -c <command>` on macOS and Linux. Single quotes keep
  // spaces and $ in the Node or install paths from being expanded.
  return `${quoteForSh(execPath)} ${quoteForSh(script)}`;
}

module.exports = {
  LOCAL_DIR_NAME,
  GLOBAL_DIR,
  AGY_SETTINGS,
  INSTALL_META_NAME,
  RUNTIME_FILES,
  INSTALLED_FILES,
  PRIVATE_FILES,
  PRIVATE_FILE_MODE,
  restrictPrivateFiles,
  resolveInstallDir,
  isTrustedInstallDir,
  statuslineCommand,
  cmdBreakingChars,
  cmdBreakingMessage,
  windowsLauncherPath,
  writeWindowsLauncher,
  writeInstallMeta,
  readInstallMeta,
  readAgySettings,
  readSettingsForUpdate,
  settingsBackupPath,
  settingsOriginalBackupPath,
  writeJsonSafely,
  writeFileAtomic,
  removeSettingsFile,
  quoteForSh,
  toPosixPath,
  isWsl,
  isWindowsNodeOnWsl,
  windowsNodeOnWslMessage,
};
