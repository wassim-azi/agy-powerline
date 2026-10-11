"use strict";

// Local problem log. It records crashes, exceptions and warnings so a user can
// attach agy-powerline.log to a GitHub issue. It never leaves the machine, and
// it is built from an allowlist: event codes, error types, our own stack
// frames and redacted messages. Payload data, paths, commands and widget text
// are never written.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { writeFileAtomic, readInstallMeta, PRIVATE_FILE_MODE } = require("./paths");
const { stripControl } = require("./formatters");

const LOG_NAME = "agy-powerline.log";
const MAX_ENTRIES = 200;
const MAX_BYTES = 256 * 1024;
const MAX_MESSAGE = 200;
// The statusline runs on every refresh; a repeating problem is counted at
// most once a minute so a broken config doesn't rewrite the file constantly.
const REPEAT_WINDOW_MS = 60 * 1000;

// Code root: src/ in the repo, the install dir for the copied runtime.
const CODE_ROOT = path.basename(__dirname) === "lib" ? path.resolve(__dirname, "..") : __dirname;

const IN_REPO = path.basename(__dirname) === "lib";

let logDir = null;
let context = {};

// The copied runtime has no package.json; init records the version in
// install.json instead.
function agyPowerlineVersion() {
  try {
    return IN_REPO
      ? require("../../package.json").version
      : readInstallMeta(CODE_ROOT)?.version || "unknown";
  } catch {
    return "unknown";
  }
}

function isLogEnabled(config, env = process.env) {
  const flag = String(env.AGY_POWERLINE_LOG ?? "")
    .trim()
    .toLowerCase();
  if (["0", "false", "off", "no"].includes(flag)) {
    return false;
  }
  return config?.log !== false;
}

// Turns logging on for this process. Nothing is written until then, so a
// command that never resolved its install dir can't drop a log anywhere.
function setLogDir(dir, enabled = true) {
  logDir = enabled && dir ? dir : null;
}

function getLogPath(dir = logDir) {
  return dir ? path.join(dir, LOG_NAME) : null;
}

// Extra fields for every entry, e.g. the Antigravity version.
function setLogContext(extra) {
  context = { ...context, ...extra };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function identity() {
  let user = "";
  try {
    user = os.userInfo().username;
  } catch {
    // Some containers have no passwd entry.
  }
  return { home: os.homedir(), user, host: os.hostname() };
}

// Second line of defense for message text: anything that could identify the
// user or their projects is replaced before it reaches the file.
function redact(text, who = identity()) {
  let out = stripControl(String(text ?? ""));

  for (const home of [who.home, who.home.replace(/\\/g, "/")]) {
    if (home && home.length > 3) {
      out = out.replace(new RegExp(escapeRegExp(home), "gi"), "~");
    }
  }

  out = out
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<url>")
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "<ip>")
    .replace(/\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, "<ip>")
    // Folder names can be client or project names: any path goes.
    .replace(/(?:[A-Za-z]:|~)?(?:[\\/][^\s\\/'"`]+){2,}[\\/]?/g, "<path>")
    .replace(/(?:[A-Za-z]:|~)[\\/][^\s'"`]*/g, "<path>")
    .replace(/\b[0-9a-f]{20,}\b/gi, "<token>")
    .replace(/[A-Za-z0-9_\-+/=]{32,}/g, "<token>");

  for (const [value, mask] of [
    [who.user, "<user>"],
    [who.host, "<host>"],
  ]) {
    if (value && value.length >= 3) {
      out = out.replace(new RegExp(`\\b${escapeRegExp(value)}\\b`, "gi"), mask);
    }
  }

  return out.length > MAX_MESSAGE ? `${out.slice(0, MAX_MESSAGE - 1)}…` : out;
}

// JSON errors quote the text that failed to parse (a config, a payload), so
// only the position is kept.
function jsonErrorMessage(message) {
  const lineCol = /line (\d+) column (\d+)/i.exec(message);
  if (lineCol) {
    return `invalid JSON at line ${lineCol[1]} column ${lineCol[2]}`;
  }
  const position = /position (\d+)/i.exec(message);
  return position ? `invalid JSON at position ${position[1]}` : "invalid JSON";
}

// Only frames from our own files, relative to the code root; Node internals
// and anything else are dropped.
function ourFrames(stack) {
  const frames = [];
  for (const line of String(stack || "").split("\n")) {
    const match = /at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const file = path.resolve(match[2]);
    const rel = path.relative(CODE_ROOT, file);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel) || !rel.endsWith(".js")) {
      continue;
    }
    const fn = match[1] && /^[\w$.<> ]{1,60}$/.test(match[1]) ? `${match[1]} ` : "";
    frames.push(`${fn}${rel.split(path.sep).join("/")}:${match[3]}`);
    if (frames.length >= 8) {
      break;
    }
  }
  return frames;
}

function describeError(err) {
  if (!err || typeof err !== "object") {
    return { message: redact(err) };
  }

  const named = typeof err.name === "string" && /^\w{1,40}$/.test(err.name);
  const out = { type: named ? err.name : "Error" };
  if (typeof err.code === "string" && /^[A-Z0-9_]{1,40}$/.test(err.code)) {
    out.code = err.code;
  }
  out.message =
    err instanceof SyntaxError ? jsonErrorMessage(err.message) : redact(err.message || "");
  const frames = ourFrames(err.stack);
  if (frames.length) {
    out.frames = frames;
  }
  return out;
}

function readLog(file = getLogPath()) {
  if (!file) {
    return [];
  }
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const entries = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry === "object" && entry.code) {
        entries.push(entry);
      }
    } catch {
      // A hand-edited or truncated line is skipped, not fatal.
    }
  }
  return entries;
}

function minuteStamp(ms) {
  return new Date(ms).toISOString().slice(0, 16) + "Z";
}

function entryKey(entry) {
  return [entry.level, entry.code, entry.message || "", (entry.frames || [])[0] || ""].join("|");
}

// Records one problem. Never throws: a logging failure must not break the bar.
function logEvent(level, code, details = {}) {
  const file = getLogPath();
  if (!file) {
    return;
  }

  try {
    const now = Date.now();
    const usedRam = 1 - os.freemem() / os.totalmem();
    const entry = {
      level,
      code,
      ...details,
      count: 1,
      first: minuteStamp(now),
      last: minuteStamp(now),
      version: agyPowerlineVersion(),
      node: process.version,
      os: `${process.platform}-${process.arch}`,
      ramUsedPct: Number.isFinite(usedRam) ? Math.round(usedRam * 100) : undefined,
      ...context,
    };

    const entries = readLog(file);
    const key = entryKey(entry);
    const existing = entries.find((item) => entryKey(item) === key);

    if (existing) {
      if (now - Date.parse(existing.last) < REPEAT_WINDOW_MS) {
        return;
      }
      existing.count = (Number(existing.count) || 1) + 1;
      existing.last = entry.last;
      entries.splice(entries.indexOf(existing), 1);
      entries.push(existing);
    } else {
      entries.push(entry);
    }

    let lines = entries.slice(-MAX_ENTRIES).map((item) => JSON.stringify(item));
    while (lines.length > 1 && Buffer.byteLength(lines.join("\n")) > MAX_BYTES) {
      lines = lines.slice(1);
    }

    writeFileAtomic(file, lines.join("\n") + "\n", { mode: PRIVATE_FILE_MODE });
  } catch {
    // Read-only disk, full disk, permissions: the bar matters more.
  }
}

function logError(code, err, details = {}) {
  logEvent("error", code, { ...describeError(err), ...details });
}

function logWarning(code, details = {}) {
  logEvent("warn", code, details);
}

function clearLog(dir = logDir) {
  const file = getLogPath(dir);
  if (file) {
    fs.rmSync(file, { force: true });
  }
}

module.exports = {
  LOG_NAME,
  MAX_ENTRIES,
  MAX_BYTES,
  isLogEnabled,
  setLogDir,
  getLogPath,
  setLogContext,
  redact,
  jsonErrorMessage,
  describeError,
  readLog,
  logEvent,
  logError,
  logWarning,
  clearLog,
};
