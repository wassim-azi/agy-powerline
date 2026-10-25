// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Tokens used today and over the last 7 days, for the tokensToday and
// tokensWeek widgets. agy keeps each conversation in a SQLite database of its
// own; only the usage numbers, response IDs (to drop duplicates) and
// timestamps are read from it, never a message, a model prompt or a name.
// The field numbers and the way duplicates are dropped follow ccusage's
// Antigravity adapter (MIT, rust/adapters/antigravity/src/parser.rs).

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { logWarning } = require("./log");
const { writeFileAtomic, PRIVATE_FILE_MODE } = require("./paths");

const USAGE_CACHE_NAME = ".usage-cache.json";
// Reading databases stops for this refresh past this budget; the cache keeps
// the totals and the rest is read on the next refresh.
const READ_BUDGET_MS = 100;
const DAY_MS = 86400000;
// How many days back each widget looks, today included.
const USAGE_PERIODS = { tokensToday: 1, tokensWeek: 7 };
// Usage metadata is a few hundred bytes; anything this big isn't.
const MAX_BLOB_BYTES = 4 * 1024 * 1024;
const MAX_DEPTH = 8;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Database opens, so tests can check that unchanged files aren't read again.
const stats = { opens: 0 };
let memoryCache = null;
let sqlite;

// node:sqlite is built into Node 22.13 / 23.4 and newer. Node 22 prints an
// ExperimentalWarning on stderr when it loads, which must not reach the bar's
// stderr: that one warning is swallowed while it loads, every other one goes on.
function loadSqlite() {
  if (sqlite !== undefined) {
    return sqlite;
  }
  const emitWarning = process.emitWarning;
  process.emitWarning = function (warning, ...rest) {
    const type = typeof rest[0] === "string" ? rest[0] : rest[0]?.type;
    const name = type || warning?.name;
    if (name === "ExperimentalWarning" && /sqlite/i.test(String(warning?.message ?? warning))) {
      return undefined;
    }
    return emitWarning.call(this, warning, ...rest);
  };
  try {
    sqlite = require("node:sqlite");
  } catch {
    sqlite = null;
  } finally {
    process.emitWarning = emitWarning;
  }
  return sqlite;
}

function usageAvailable() {
  return Boolean(loadSqlite()?.DatabaseSync);
}

// A minimal protobuf reader: varints and length-delimited fields, fixed-width
// fields skipped. Truncated or oversized input, groups and nesting deeper
// than MAX_DEPTH throw; the database is then skipped for this refresh.
function readVarint(buf, pos) {
  let value = 0;
  for (let shift = 0; shift < 64; shift += 7) {
    if (pos >= buf.length) {
      throw new Error("truncated varint");
    }
    const byte = buf[pos++];
    value += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) {
      return [value, pos];
    }
  }
  throw new Error("varint too long");
}

function decodeMessage(buf, depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new Error("message nested too deep");
  }
  if (!(buf instanceof Uint8Array) || buf.length > MAX_BLOB_BYTES) {
    throw new Error("not a protobuf message");
  }
  const fields = new Map();
  let pos = 0;
  while (pos < buf.length) {
    let key;
    [key, pos] = readVarint(buf, pos);
    const field = Math.floor(key / 8);
    const wire = key % 8;
    let value;
    if (wire === 0) {
      [value, pos] = readVarint(buf, pos);
    } else if (wire === 2) {
      let length;
      [length, pos] = readVarint(buf, pos);
      if (pos + length > buf.length) {
        throw new Error("truncated field");
      }
      value = buf.subarray(pos, pos + length);
      pos += length;
    } else if (wire === 1 || wire === 5) {
      pos += wire === 1 ? 8 : 4;
      if (pos > buf.length) {
        throw new Error("truncated field");
      }
      continue;
    } else {
      throw new Error("unsupported wire type");
    }
    if (field < 1) {
      throw new Error("bad field number");
    }
    if (!fields.has(field)) {
      fields.set(field, []);
    }
    fields.get(field).push(value);
  }
  return { fields, depth };
}

function nested(msg, field) {
  return (msg?.fields.get(field) ?? [])
    .filter((value) => value instanceof Uint8Array)
    .map((value) => decodeMessage(value, msg.depth + 1));
}

function child(msg, field) {
  return nested(msg, field)[0] ?? null;
}

function number(msg, field) {
  const value = msg?.fields.get(field)?.[0];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function text(msg, field) {
  const value = msg?.fields.get(field)?.[0];
  return value instanceof Uint8Array ? Buffer.from(value).toString("utf8") : "";
}

// Timestamp message: 1 = seconds, 2 = nanoseconds.
function timestamp(msg) {
  const seconds = number(msg, 1);
  return seconds > 0 ? seconds * 1000 + Math.floor(number(msg, 2) / 1e6) : null;
}

// ModelUsage: 2 = input, 3 = total output; 11, 12 and 7 = response, provider
// message and message IDs, the first one present names the response.
function usageEntry(msg, ts) {
  if (!msg) {
    return null;
  }
  return {
    input: number(msg, 2),
    output: number(msg, 3),
    id: text(msg, 11) || text(msg, 12) || text(msg, 7),
    ts,
  };
}

// gen_metadata.data: GeneratorMetadata. 1 = chat-model message, whose 4 is
// the usage, 17 the retries (each with its usage in 2) and 9 the generation
// info (timestamp in 4).
function generatorEntries(data) {
  const chat = child(decodeMessage(data), 1);
  const ts = timestamp(child(child(chat, 9), 4));
  return [
    usageEntry(child(chat, 4), ts),
    ...nested(chat, 17).map((r) => usageEntry(child(r, 2), ts)),
  ];
}

// steps.metadata: CortexStepMetadata. 9 = usage, 28 = retries (usage in 2),
// 8 or else 1 = timestamp.
function stepEntries(data) {
  const step = decodeMessage(data);
  const ts = timestamp(child(step, 8)) ?? timestamp(child(step, 1));
  return [
    usageEntry(child(step, 9), ts),
    ...nested(step, 28).map((r) => usageEntry(child(r, 2), ts)),
  ];
}

function blob(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!(value instanceof Uint8Array)) {
    throw new Error("not a blob");
  }
  return value;
}

const dayFormats = new Map();

// "2026-10-18" for a moment, in the time zone given (the machine's own when "").
function dayKey(ms, timeZone = "") {
  if (!dayFormats.has(timeZone)) {
    dayFormats.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone || undefined,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    );
  }
  const parts = {};
  for (const part of dayFormats.get(timeZone).formatToParts(new Date(ms))) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Today and the days before it, `count` in all. Half-day steps never skip a
// day, even across a daylight saving change.
function recentDays(now, count, timeZone) {
  const keys = new Set();
  for (let t = now; keys.size < count; t -= DAY_MS / 2) {
    keys.add(dayKey(t, timeZone));
  }
  return [...keys];
}

// Input and output tokens per day in one conversation database.
function readDatabase(file, timeZone, fallbackMs) {
  const db = new sqlite.DatabaseSync(file, { readOnly: true });
  stats.opens += 1;
  try {
    const tables = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name)
    );
    if (!tables.has("gen_metadata")) {
      throw new Error("no gen_metadata table");
    }

    // The conversation's own time, for rows that carry none.
    let conversationTs = null;
    if (tables.has("trajectory_metadata_blob")) {
      for (const row of db.prepare("SELECT data FROM trajectory_metadata_blob").all()) {
        const data = blob(row.data);
        conversationTs = (data && timestamp(child(decodeMessage(data), 2))) ?? conversationTs;
      }
    }

    const entries = [];
    for (const row of db.prepare("SELECT idx, data FROM gen_metadata ORDER BY idx ASC").all()) {
      const data = blob(row.data);
      if (data) {
        entries.push(...generatorEntries(data));
      }
    }
    if (tables.has("steps")) {
      for (const row of db.prepare("SELECT idx, metadata FROM steps ORDER BY idx ASC").all()) {
        const data = blob(row.metadata);
        if (data) {
          entries.push(...stepEntries(data));
        }
      }
    }

    // The same response can be in both tables and among the retries.
    const seen = new Set();
    const days = {};
    for (const entry of entries) {
      if (!entry || entry.input + entry.output <= 0) {
        continue;
      }
      if (entry.id) {
        if (seen.has(entry.id)) {
          continue;
        }
        seen.add(entry.id);
      }
      const day = dayKey(entry.ts ?? conversationTs ?? fallbackMs, timeZone);
      days[day] = days[day] || { input: 0, output: 0 };
      days[day].input += entry.input;
      days[day].output += entry.output;
    }
    return days;
  } finally {
    db.close();
  }
}

function conversationsDir() {
  return path.join(os.homedir(), ".gemini", "antigravity-cli", "conversations");
}

// agy may still have recent writes in the -wal file next to the database.
function signature(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) {
      return null;
    }
    let mtimeMs = stat.mtimeMs;
    let size = stat.size;
    try {
      const wal = fs.statSync(`${file}-wal`);
      mtimeMs = Math.max(mtimeMs, wal.mtimeMs);
      size += wal.size;
    } catch {
      // No write-ahead log.
    }
    return { mtimeMs, size };
  } catch {
    return null;
  }
}

// The file name is a conversation ID: the cache only keeps a hash of the path.
function fileKey(file) {
  return crypto.createHash("sha256").update(file).digest("hex").slice(0, 16);
}

// Only next to a real install's config, like the git caches.
function cachePath() {
  try {
    const { getConfigDir } = require("./config");
    const dir = getConfigDir();
    return dir && fs.existsSync(path.join(dir, "statusline.config.json"))
      ? path.join(dir, USAGE_CACHE_NAME)
      : null;
  } catch {
    return null;
  }
}

function validDays(days) {
  return (
    days !== null &&
    typeof days === "object" &&
    !Array.isArray(days) &&
    Object.entries(days).every(
      ([day, tokens]) =>
        DAY_KEY.test(day) &&
        ["input", "output"].every(
          (key) => Number.isFinite(tokens?.[key]) && tokens[key] >= 0 && tokens[key] <= 1e15
        )
    )
  );
}

function validEntry(entry) {
  return Number.isFinite(entry?.mtimeMs) && Number.isFinite(entry?.size) && validDays(entry.days);
}

// The cache file can be edited or torn like any file: bad entries are dropped.
function readCache(file) {
  let data = memoryCache;
  if (file) {
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      data = null;
    }
  }
  const files = {};
  if (data?.files && typeof data.files === "object") {
    for (const [key, entry] of Object.entries(data.files)) {
      if (/^[0-9a-f]{16}$/.test(key) && validEntry(entry)) {
        files[key] = entry;
      }
    }
  }
  return { tz: typeof data?.tz === "string" ? data.tz : "", files };
}

function saveCache(file, cache) {
  memoryCache = cache;
  if (!file) {
    return;
  }
  try {
    writeFileAtomic(file, JSON.stringify(cache), { mode: PRIVATE_FILE_MODE });
  } catch {
    // Best effort: the next refresh reads the databases again.
  }
}

// Reads the databases changed since the cache was written, within the time
// budget. Returns whether the cache changed.
function refresh(cache, periodDays, timeZone) {
  let names;
  try {
    names = fs.readdirSync(conversationsDir());
  } catch {
    names = [];
  }

  const now = Date.now();
  // A day of margin for time zones.
  const cutoff = now - (periodDays + 1) * DAY_MS;
  const files = {};
  let changed = false;

  for (const name of names) {
    if (!name.endsWith(".db")) {
      continue;
    }
    const file = path.join(conversationsDir(), name);
    const sig = signature(file);
    if (!sig || sig.mtimeMs < cutoff) {
      continue;
    }
    const key = fileKey(file);
    const old = cache.files[key];
    if (old && old.mtimeMs === sig.mtimeMs && old.size === sig.size) {
      files[key] = old;
      continue;
    }
    if (Date.now() - now > READ_BUDGET_MS) {
      if (old) {
        files[key] = old;
      }
      continue;
    }
    try {
      files[key] = { ...sig, days: readDatabase(file, timeZone, sig.mtimeMs) };
      changed = true;
    } catch (err) {
      // Busy, locked, not agy's format: skipped until it changes again. No
      // path or ID in the log.
      const code = typeof err?.code === "string" && /^[A-Z_]{1,40}$/.test(err.code) ? err.code : "";
      logWarning("USAGE_DB_UNREADABLE", code ? { code } : {});
      if (old) {
        files[key] = old;
      }
    }
  }

  changed = changed || Object.keys(files).length !== Object.keys(cache.files).length;
  cache.files = files;
  return changed;
}

function sum(cache, days) {
  const total = { input: 0, output: 0 };
  for (const entry of Object.values(cache.files)) {
    for (const day of days) {
      total.input += entry.days[day]?.input ?? 0;
      total.output += entry.days[day]?.output ?? 0;
    }
  }
  return total;
}

function machineZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

// { today, week } tokens ({ input, output } each), or null when no usage
// widget is on the bar or node:sqlite is missing. Only the statusline itself
// reads databases (read: true); previews use what the cache holds.
function resolveUsage(config, { read = false } = {}) {
  const periodDays = Math.max(
    0,
    ...(config?.widgets ?? []).map((widget) => USAGE_PERIODS[widget?.id] ?? 0)
  );
  if (!periodDays) {
    return null;
  }

  try {
    const timeZone = config?.clock?.timeZone || "";
    // Days are counted in this zone, so a cache made in another one is stale.
    const zone = timeZone || machineZone();
    const file = cachePath();
    let cache = readCache(file);
    if (cache.tz !== zone) {
      cache = { tz: zone, files: {} };
    }

    if (read) {
      if (!usageAvailable()) {
        return null;
      }
      if (refresh(cache, periodDays, timeZone)) {
        saveCache(file, cache);
      }
    }

    const now = Date.now();
    return {
      today: sum(cache, recentDays(now, 1, timeZone)),
      week: sum(cache, recentDays(now, 7, timeZone)),
    };
  } catch {
    return null;
  }
}

function clearUsageCache() {
  memoryCache = null;
}

module.exports = {
  USAGE_CACHE_NAME,
  USAGE_PERIODS,
  READ_BUDGET_MS,
  stats,
  loadSqlite,
  usageAvailable,
  decodeMessage,
  dayKey,
  recentDays,
  conversationsDir,
  resolveUsage,
  clearUsageCache,
};
