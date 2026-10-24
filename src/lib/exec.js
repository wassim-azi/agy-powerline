"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execSync } = require("child_process");
const { stripControl, sanitizeDeep } = require("./formatters");
const { RESET, getActiveDepth } = require("./colors");
const { logWarning } = require("./log");
const { t } = require("./i18n");
const { PRIVATE_FILE_MODE } = require("./paths");

const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_INTERVAL_SEC = 10;
const MAX_CACHE_AGE_SEC = 3600;
const MAX_OUTPUT_CHARS = 80;

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

// The only escape sequence "colors": true keeps: SGR color and style. Colon
// forms (38:2::r:g:b) are dropped with the rest, since not every terminal reads them.
const SGR_SPLIT = /(\x1b\[[0-9;]*m)/;
const SGR_ALL = /\x1b\[([0-9;]*)m/g;

// Command output is untrusted text: strip terminal control and cap length.
// With colors, SGR sequences survive and the visible text alone is capped;
// the output then ends with a reset so its colors can't leak past it.
function sanitizeExecOutput(text, { colors = false } = {}) {
  if (!colors) {
    const clean = stripControl(text).trim();
    const chars = Array.from(clean);

    if (chars.length <= MAX_OUTPUT_CHARS) {
      return clean;
    }

    return chars.slice(0, MAX_OUTPUT_CHARS - 1).join("") + "…";
  }

  const parts = String(text ?? "")
    .split(SGR_SPLIT)
    .map((part, i) => (i % 2 ? part : stripControl(part)));
  const visible = parts.filter((_, i) => i % 2 === 0).join("");
  const lead = visible.length - visible.trimStart().length;
  const chars = Array.from(visible.trim());
  const cut = chars.length > MAX_OUTPUT_CHARS;
  const budget = cut ? MAX_OUTPUT_CHARS - 1 : chars.length;
  let skip = lead;
  let used = 0;
  let out = "";
  let styled = false;

  for (let i = 0; i < parts.length && used < budget; i++) {
    if (i % 2) {
      out += parts[i];
      styled = true;
      continue;
    }
    for (const char of Array.from(parts[i])) {
      if (skip > 0) {
        skip -= char.length;
        continue;
      }
      if (used === budget) {
        break;
      }
      out += char;
      used++;
    }
  }

  return out + (cut ? "…" : "") + (styled ? RESET : "");
}

// After a reset in colored output, the widget's own colors come back (the
// pill's background and text in Pills), so the rest of the widget isn't left
// in the terminal's default colors.
function restoreAfterReset(text, restore) {
  if (!restore) {
    return text;
  }
  return String(text).replace(SGR_ALL, (seq, body) => {
    const params = body === "" ? [0] : body.split(";").map((p) => (p === "" ? 0 : Number(p)));
    let lastReset = -1;
    for (let i = 0; i < params.length; i++) {
      // 38/48/58 take a color as their next parameters; a 0 there isn't a reset.
      if (params[i] === 38 || params[i] === 48 || params[i] === 58) {
        i += params[i + 1] === 5 ? 2 : params[i + 1] === 2 ? 4 : 0;
      } else if (params[i] === 0) {
        lastReset = i;
      }
    }
    if (lastReset < 0) {
      return seq;
    }
    const rest = params.slice(lastReset + 1);
    return `${RESET}${restore}${rest.length ? `\x1b[${rest.join(";")}m` : ""}`;
  });
}

// Never handed to a command: agy-powerline doesn't read the account email or
// the session and conversation IDs, so it doesn't pass them on either.
const PRIVATE_KEYS = new Set(["email", "session_id", "conversation_id"]);

function withoutPrivateKeys(value, depth = 0) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (depth > 8) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => withoutPrivateKeys(item, depth + 1));
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (!PRIVATE_KEYS.has(key)) {
      out[key] = withoutPrivateKeys(item, depth + 1);
    }
  }
  return out;
}

// The session JSON an exec widget with "payload": true reads on stdin.
function execPayloadJson(payload) {
  try {
    return JSON.stringify(sanitizeDeep(withoutPrivateKeys(payload ?? {}))) ?? "{}";
  } catch {
    return "{}";
  }
}

// Widgets that share a command but not its options must not share its output.
function widgetCacheKey(widget, cwd) {
  const variant = `${widget.payload === true ? "\0payload" : ""}${widget.colors === true ? "\0colors" : ""}`;
  return cacheKey(`${String(widget.cmd).trim()}${variant}`, cwd);
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
    const key = widgetCacheKey(widget, session.cwd || process.cwd());
    if (memo?.has(key)) {
      return memo.get(key);
    }
    const colors = widget.colors === true && getActiveDepth() !== "none";
    const output = sanitizeExecOutput(runExecWidget(widget, session), { colors });
    memo?.set(key, output);
    return output;
  }

  // Placeholders shown instead of running the command.
  return t(session.execMode === "blocked" ? "cmd_blocked" : "cmd_preview", session.lang);
}

function runExecWidget(widget, session = {}) {
  const cmd = String(widget?.cmd || "").trim();
  if (!cmd) {
    return "";
  }

  const cwd = session.cwd || process.cwd();
  const key = widgetCacheKey(widget, cwd);
  const now = Date.now();
  const input = widget.payload === true ? `${session.execPayload || "{}"}\n` : undefined;

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
  const firstLine = (stdout) =>
    String(stdout || "")
      .trim()
      .split(/\r?\n/)[0]
      ?.trim() || "";
  try {
    const stdout = execSync(cmd, {
      cwd,
      timeout: timeoutMs,
      encoding: "utf8",
      input,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    output = firstLine(stdout);
  } catch (err) {
    // A command that exits without reading the whole payload closes the pipe
    // under the write; it still succeeded, so its output counts. Otherwise the
    // previous output stays. A non-zero exit is normal for many commands (grep
    // with no match), so only timeouts and missing commands are logged, and
    // never the command itself.
    if (input !== undefined && err.status === 0 && !err.signal) {
      output = firstLine(err.stdout);
    } else if (err.code === "ETIMEDOUT" || err.signal === "SIGTERM") {
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
  restoreAfterReset,
  execPayloadJson,
  widgetCacheKey,
  cacheKey,
  clearExecCache,
  getCacheFilePath,
  loadDiskCache,
  saveDiskCache,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_INTERVAL_SEC,
};
