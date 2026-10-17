"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execSync } = require("child_process");
const { stripControl } = require("./formatters");
const { logWarning } = require("./log");
const { PRIVATE_FILE_MODE } = require("./paths");

const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_INTERVAL_SEC = 10;
const MAX_CACHE_AGE_SEC = 3600;
const MAX_OUTPUT_CHARS = 80;

// Placeholders shown instead of running the command.
const EXEC_PREVIEW_TEXT = "[cmd]";
const EXEC_BLOCKED_TEXT = "[blocked]";

const memoryCache = new Map();

function getCacheFilePath() {
  try {
    const { getConfigDir } = require("./config");
    const dir = getConfigDir();
    if (dir && fs.existsSync(path.join(dir, "statusline.config.json"))) {
      return path.join(dir, ".exec-cache.json");
    }
  } catch {
    // Fallback
  }
  // Per-user name so other accounts on a shared machine cannot pre-create it.
  let user = "user";
  try {
    user = os.userInfo().username.replace(/[^A-Za-z0-9_.-]/g, "_") || user;
  } catch {
    // userInfo can throw when the account has no name entry
  }
  return path.join(os.tmpdir(), `agy-powerline-exec-cache-${user}.json`);
}

function loadDiskCache() {
  try {
    const file = getCacheFilePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return typeof data === "object" && data !== null ? data : {};
    }
  } catch {
    // Graceful fallback
  }
  return {};
}

// Several agy windows refresh at once, so the cache is written to a fresh temp
// file and renamed into place: a reader never sees half a file. "wx" refuses a
// file that already exists (or a planted link) in a shared temp folder, and the
// file is owner-only because it holds the output of the user's commands.
function saveDiskCache(cache) {
  let tmp = "";
  try {
    const file = getCacheFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache), {
      encoding: "utf8",
      flag: "wx",
      mode: PRIVATE_FILE_MODE,
    });
    fs.renameSync(tmp, file);
  } catch {
    // The cache is best effort: skip this write rather than risk a torn file.
    try {
      if (tmp) {
        fs.rmSync(tmp, { force: true });
      }
    } catch {
      // Nothing else to do; a stray temp file is harmless.
    }
  }
}

function cacheKey(cmd, cwd = "") {
  return crypto
    .createHash("sha256")
    .update(`${String(cmd).trim()}::${String(cwd).trim()}`)
    .digest("hex")
    .slice(0, 16);
}

// Command output is untrusted text: strip terminal control and cap length.
function sanitizeExecOutput(text) {
  const clean = stripControl(text).trim();
  const chars = Array.from(clean);

  if (chars.length <= MAX_OUTPUT_CHARS) {
    return clean;
  }

  return chars.slice(0, MAX_OUTPUT_CHARS - 1).join("") + "…";
}

// session.execMode: "run" executes the command, "blocked" marks a config the
// user does not own, anything else (CLI previews) shows a placeholder.
function execWidgetOutput(widget, session = {}) {
  if (!String(widget?.cmd || "").trim()) {
    return "";
  }

  if (session.execMode === "run") {
    // Fitting the bar to the terminal can draw a row several times; a command
    // still runs at most once per refresh, even with "interval": 0.
    const memo = session.execMemo;
    const key = cacheKey(widget.cmd, session.cwd || process.cwd());
    if (memo?.has(key)) {
      return memo.get(key);
    }
    const output = sanitizeExecOutput(runExecWidget(widget, session));
    memo?.set(key, output);
    return output;
  }

  return session.execMode === "blocked" ? EXEC_BLOCKED_TEXT : EXEC_PREVIEW_TEXT;
}

function runExecWidget(widget, session = {}) {
  const cmd = String(widget?.cmd || "").trim();
  if (!cmd) {
    return "";
  }

  const cwd = session.cwd || process.cwd();
  const key = cacheKey(cmd, cwd);
  const now = Date.now();

  let intervalMs = DEFAULT_INTERVAL_SEC * 1000;
  if (widget.interval != null) {
    const parsed = Number(widget.interval);
    if (Number.isFinite(parsed) && parsed >= 0) {
      intervalMs = parsed * 1000;
    }
  }

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (widget.timeout != null) {
    const parsed = Number(widget.timeout);
    if (Number.isFinite(parsed) && parsed > 0) {
      timeoutMs = Math.min(parsed, 5000);
    }
  }

  // 1. Check memory cache (in-process)
  const memHit = memoryCache.get(key);
  if (memHit && now - memHit.timestamp < intervalMs) {
    return memHit.output;
  }

  // 2. Check disk cache (cross-process, zero-spawn)
  const diskCache = loadDiskCache();
  const diskHit = diskCache[key];
  if (diskHit && now - diskHit.timestamp < intervalMs) {
    memoryCache.set(key, diskHit);
    return diskHit.output;
  }

  // 3. Cache expired or missing: execute command with timeout
  let output = diskHit?.output || memHit?.output || "";
  try {
    const stdout = execSync(cmd, {
      cwd,
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    output =
      String(stdout || "")
        .trim()
        .split(/\r?\n/)[0]
        ?.trim() || "";
  } catch (err) {
    // Keep the previous output. A non-zero exit is normal for many commands
    // (grep with no match), so only timeouts and missing commands are logged,
    // and never the command itself.
    if (err.code === "ETIMEDOUT" || err.signal === "SIGTERM") {
      logWarning("EXEC_TIMEOUT", { timeoutMs });
    } else if (err.status === 127 || err.code === "ENOENT") {
      logWarning("EXEC_COMMAND_NOT_FOUND");
    }
  }

  const entry = { output, timestamp: now };
  memoryCache.set(key, entry);
  diskCache[key] = entry;

  for (const k of Object.keys(diskCache)) {
    if (now - diskCache[k].timestamp > MAX_CACHE_AGE_SEC * 1000) {
      delete diskCache[k];
    }
  }

  saveDiskCache(diskCache);
  return output;
}

function clearExecCache() {
  memoryCache.clear();
  try {
    const file = getCacheFilePath();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {
    // Ignore
  }
}

module.exports = {
  runExecWidget,
  execWidgetOutput,
  sanitizeExecOutput,
  cacheKey,
  clearExecCache,
  getCacheFilePath,
  loadDiskCache,
  saveDiskCache,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_INTERVAL_SEC,
  EXEC_PREVIEW_TEXT,
  EXEC_BLOCKED_TEXT,
};
