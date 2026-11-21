// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");
let workerThreads = null;
try {
  workerThreads = require("worker_threads");
} catch {
  // worker_threads is absent in the browser configurator bundle.
}
const { stripControl, sanitizeDeep, splitGraphemes } = require("./formatters");
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
  // Per-user name so accounts don't share one cache. Another account could
  // still guess and pre-create it in a shared /tmp, so the runtime never comes
  // here: exec widgets only run from a config file in the install dir above.
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

// Command output is untrusted text: strip terminal control and cap length,
// counted in grapheme clusters so the cut never splits an emoji or accent.
// With colors, SGR sequences survive and the visible text alone is capped;
// the output then ends with a reset so its colors can't leak past it.
function sanitizeExecOutput(text, { colors = false } = {}) {
  if (!colors) {
    const clean = stripControl(text).trim();
    const chars = splitGraphemes(clean);

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
  const chars = splitGraphemes(visible.trim());
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
    for (let char of splitGraphemes(parts[i])) {
      if (skip > 0) {
        // Leading whitespace is skipped; a mark joined to it stays.
        if (char.length <= skip) {
          skip -= char.length;
          continue;
        }
        char = char.slice(skip);
        skip = 0;
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
function widgetCacheKey(widget, cwd, execPayload = "") {
  const payloadVariant =
    widget.payload === true
      ? `\0payload${typeof execPayload === "string" && execPayload ? `:${execPayload}` : ""}`
      : "";
  const variant = `${payloadVariant}${widget.colors === true ? "\0colors" : ""}`;
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
    const key = widgetCacheKey(widget, session.cwd || process.cwd(), session.execPayload);
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

const MAX_EXEC_STDOUT_BYTES = 1024 * 1024;
const TREE_KILL_GRACE_MS = 200;
const WORKER_WAIT_HEADROOM_MS = 3000;

let workerStarted = false;

// execSync kills only the shell on timeout, leaving anything the shell started
// running in the background. On Windows taskkill /T walks the live parent tree;
// on POSIX the detached shell heads a process group that SIGKILL clears at once.
function killProcessTree(pid) {
  if (!pid) {
    return;
  }
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/T", "/F", "/PID", String(pid)], {
        stdio: "ignore",
        windowsHide: true,
        timeout: 2000,
      });
    } catch {
      // Process or tree may already have exited.
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already exited.
    }
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // Process group may already have exited.
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Leader may already have exited.
  }
}

function runExecWorker(data) {
  if (!data || workerStarted) {
    return;
  }
  workerStarted = true;

  const { cmd, cwd, timeoutMs, input, sab, port } = data;
  let done = false;
  let timer = null;
  let graceTimer = null;
  let timedOut = false;

  const finish = (result) => {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timer);
    clearTimeout(graceTimer);
    try {
      port.postMessage(result);
      port.close();
    } catch {
      // Parent may already have timed out and closed the port.
    }
    Atomics.store(sab, 0, 1);
    Atomics.notify(sab, 0, 1);
  };

  let child;
  try {
    child = spawn(cmd, {
      shell: true,
      cwd,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
    });
  } catch (err) {
    finish({ status: null, signal: null, errorCode: err?.code, timedOut: false, stdout: "" });
    return;
  }

  const chunks = [];
  let bytes = 0;

  child.stdout?.on("data", (chunk) => {
    if (timedOut || bytes >= MAX_EXEC_STDOUT_BYTES) {
      return;
    }
    const remaining = MAX_EXEC_STDOUT_BYTES - bytes;
    const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
    chunks.push(slice);
    bytes += slice.length;
  });

  if (input !== undefined && child.stdin) {
    // A command that exits without reading the whole payload closes the pipe
    // under the write; ignore EPIPE and wait for close so stdout still counts.
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  }

  child.on("error", (err) => {
    finish({
      status: null,
      signal: null,
      errorCode: err?.code,
      timedOut,
      stdout: "",
    });
  });

  child.on("close", (status, signal) => {
    if (timedOut) {
      finish({ status: null, signal: "SIGTERM", timedOut: true, stdout: "" });
      return;
    }
    finish({
      status,
      signal,
      timedOut: false,
      stdout: Buffer.concat(chunks).toString("utf8"),
    });
  });

  timer = setTimeout(() => {
    timedOut = true;
    try {
      child.stdin?.destroy();
    } catch {
      // Ignore stream cleanup errors.
    }
    killProcessTree(child.pid);
    // Wait briefly for close so the kernel finishes reaping killed children; if
    // a detached descendant kept stdout open, close the pipe and return anyway.
    graceTimer = setTimeout(() => {
      try {
        child.stdout?.destroy();
      } catch {
        // Ignore stream cleanup errors.
      }
      finish({ status: null, signal: "SIGTERM", timedOut: true, stdout: "" });
    }, TREE_KILL_GRACE_MS);
  }, timeoutMs);
}

function runExecCommand(cmd, cwd, timeoutMs, input) {
  if (!workerThreads) {
    return { status: null, signal: null, timedOut: false, stdout: "" };
  }
  const sab = new Int32Array(new SharedArrayBuffer(4));
  const { port1, port2 } = new workerThreads.MessageChannel();
  const worker = new workerThreads.Worker(__filename, {
    workerData: {
      __agyExecWorker: true,
      cmd,
      cwd,
      timeoutMs,
      input,
      sab,
      port: port1,
    },
    transferList: [port1],
  });
  worker.unref();

  try {
    const waitStatus = Atomics.wait(sab, 0, 0, timeoutMs + WORKER_WAIT_HEADROOM_MS);
    const msg = workerThreads.receiveMessageOnPort(port2)?.message;
    if (msg) {
      return msg;
    }
    if (waitStatus === "timed-out") {
      return { status: null, signal: "SIGTERM", timedOut: true, stdout: "" };
    }
    return { status: null, signal: null, timedOut: false, stdout: "" };
  } finally {
    try {
      port2.close();
    } catch {
      // Ignore
    }
    worker.terminate().catch(() => {});
  }
}

function runExecWidget(widget, session = {}) {
  const cmd = String(widget?.cmd || "").trim();
  if (!cmd) {
    return "";
  }

  const cwd = session.cwd || process.cwd();
  const key = widgetCacheKey(widget, cwd, session.execPayload);
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
    const result = runExecCommand(cmd, cwd, timeoutMs, input);
    if (result.timedOut || result.signal === "SIGTERM") {
      logWarning("EXEC_TIMEOUT", { timeoutMs });
    } else if (result.status === 127 || result.errorCode === "ENOENT") {
      logWarning("EXEC_COMMAND_NOT_FOUND");
    } else if (result.status === 0 && !result.signal) {
      output = firstLine(result.stdout);
    }
  } catch {
    // Keep prior cached output on unexpected runner failures.
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
  runExecWorker,
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

if (
  workerThreads &&
  !workerThreads.isMainThread &&
  require.main === module &&
  workerThreads.workerData?.__agyExecWorker
) {
  runExecWorker(workerThreads.workerData);
}
