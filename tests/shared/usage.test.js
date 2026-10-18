"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, stripAnsi } = require("../helpers");
const { renderStatusline, defaultConfig, sampleData } = require("../../src/lib/shared");
const { getConfigDir, setConfigDir } = require("../../src/lib/config");
const { setLogDir, readLog, getLogPath } = require("../../src/lib/log");
const {
  USAGE_CACHE_NAME,
  stats,
  loadSqlite,
  decodeMessage,
  clearUsageCache,
} = require("../../src/lib/usage");

const DAY = 86400000;
const NOW = Date.parse("2026-10-18T12:00:00.000Z");

// A tiny protobuf encoder for the fields usage.js reads.
function varint(n) {
  const out = [];
  do {
    let byte = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) {
      byte |= 0x80;
    }
    out.push(byte);
  } while (n > 0);
  return out;
}

function field(number, value) {
  if (typeof value === "number") {
    return [...varint(number * 8), ...varint(value)];
  }
  const bytes = typeof value === "string" ? [...Buffer.from(value)] : [...value];
  return [...varint(number * 8 + 2), ...varint(bytes.length), ...bytes];
}

const message = (...fields) => Uint8Array.from(fields.flat());
const timestamp = (ms) => message(field(1, Math.floor(ms / 1000)), field(2, (ms % 1000) * 1e6));
const usage = ({ input, output, id }) =>
  message(field(2, input), field(3, output), id ? field(11, id) : []);

// gen_metadata.data: chat message (1) with usage (4), retries (17 → 2) and
// generation info (9 → timestamp in 4).
function generator(tokens, ms, retries = []) {
  return message(
    field(
      1,
      message(
        field(4, usage(tokens)),
        ms ? field(9, message(field(4, timestamp(ms)))) : [],
        ...retries.map((retry) => field(17, message(field(2, usage(retry)))))
      )
    )
  );
}

// steps.metadata: usage (9), timestamp (8).
const step = (tokens, ms) => message(field(9, usage(tokens)), ms ? field(8, timestamp(ms)) : []);

// A conversation database the way agy lays it out, dated `mtime`.
function makeConversationDb(file, { gens = [], steps = [], trajectory, mtime = Date.now() } = {}) {
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(file);
  db.exec(
    "CREATE TABLE gen_metadata (idx INTEGER, data BLOB);" +
      "CREATE TABLE steps (idx INTEGER, metadata BLOB);" +
      "CREATE TABLE trajectory_metadata_blob (data BLOB);"
  );
  gens.forEach((data, idx) => db.prepare("INSERT INTO gen_metadata VALUES (?, ?)").run(idx, data));
  steps.forEach((data, idx) => db.prepare("INSERT INTO steps VALUES (?, ?)").run(idx, data));
  if (trajectory) {
    db.prepare("INSERT INTO trajectory_metadata_blob VALUES (?)").run(
      message(field(2, timestamp(trajectory)))
    );
  }
  db.close();
  fs.utimesSync(file, new Date(mtime), new Date(mtime));
}

// Runs fn with the clock at NOW and HOME at `home`, so the real conversations
// are never read.
function inHome(home, fn) {
  const realNow = Date.now;
  const env = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  Date.now = () => NOW;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    return fn();
  } finally {
    Date.now = realNow;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function conversations(home) {
  const dir = path.join(home, ".gemini", "antigravity-cli", "conversations");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function run() {
  if (!loadSqlite()?.DatabaseSync) {
    record(`usage widgets skipped: needs node:sqlite (Node ${process.version})`, true);
    return;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-usage-"));
  const previousConfigDir = getConfigDir();
  try {
    const home = path.join(root, "home");
    const dir = conversations(home);
    const install = path.join(root, "install");
    fs.mkdirSync(install);
    fs.writeFileSync(path.join(install, "statusline.config.json"), "{}");
    setConfigDir(install);

    const at = (hoursAgo) => NOW - hoursAgo * 3600000;
    // Today (UTC): 1000+200 and a retry of 300+50; r1 again in steps is the
    // same response. 02:00 UTC is still yesterday in Los Angeles.
    makeConversationDb(path.join(dir, "a.db"), {
      gens: [
        generator({ input: 1000, output: 200, id: "r1" }, at(2), [
          { input: 300, output: 50, id: "r3" },
        ]),
        generator({ input: 4000, output: 1000, id: "r2" }, at(30)),
        generator({ input: 900, output: 0, id: "early" }, Date.parse("2026-10-18T02:00:00Z")),
      ],
      steps: [
        step({ input: 1000, output: 200, id: "r1" }, at(2)),
        step({ input: 70000, output: 0, id: "old" }, NOW - 7 * DAY - 3600000),
        step({ input: 600, output: 0, id: "sixdays" }, NOW - 6 * DAY),
      ],
      mtime: at(1),
    });
    // A row without a timestamp takes the conversation's own time.
    makeConversationDb(path.join(dir, "b.db"), {
      gens: [generator({ input: 5, output: 5, id: "b1" })],
      trajectory: at(3),
      mtime: at(1),
    });
    // Older than the 7-day window plus margin: never opened.
    makeConversationDb(path.join(dir, "old.db"), {
      gens: [generator({ input: 999999, output: 0, id: "o" }, NOW - 20 * DAY)],
      mtime: NOW - 20 * DAY,
    });

    const widgets = [{ id: "tokensToday" }, { id: "tokensWeek" }];
    const config = (extra = {}, list = widgets) => ({
      ...defaultConfig(),
      widgets: list,
      clock: { timeZone: "UTC" },
      ...extra,
    });
    const render = (cfg = config(), read = true) =>
      stripAnsi(
        renderStatusline({ ...sampleData(), terminal_width: 0 }, cfg, {
          color: "none",
          env: {},
          ...(read ? { usage: "read" } : {}),
        })
      );

    clearUsageCache();
    const opensBefore = stats.opens;
    const out = inHome(home, () => render());
    // today: 1000+200 + 300+50 + 900 + 10 (b) = 2460; the week adds 5000 and 600.
    record(
      "tokensToday and tokensWeek add input and output, once per response, retries included",
      out.includes("📈 Today: 2.5K") && out.includes("📊 7d: 8.1K"),
      out
    );
    record(
      "databases older than the 7-day window aren't opened",
      stats.opens - opensBefore === 2,
      `${stats.opens - opensBefore} opens`
    );

    const exact = inHome(home, () =>
      render(
        config({}, [
          { id: "tokensToday", split: true },
          { id: "tokensWeek", split: true },
        ])
      )
    );
    record(
      '"split": true shows input and output apart',
      exact.includes("Today: 2.2K↑ 255↓") && exact.includes("7d: 6.8K↑ 1.3K↓"),
      exact
    );

    const la = inHome(home, () => render(config({ clock: { timeZone: "America/Los_Angeles" } })));
    record("days are counted in the configured time zone", la.includes("Today: 1.6K"), la);

    // Unchanged databases are read from the cache, also by the next process.
    inHome(home, () => render());
    clearUsageCache();
    const cached = stats.opens;
    const again = inHome(home, () => render());
    record(
      "a second refresh opens no database: totals come from the cache file",
      stats.opens === cached && again.includes("Today: 2.5K"),
      `${stats.opens - cached} opens`
    );
    const cacheText = fs.readFileSync(path.join(install, USAGE_CACHE_NAME), "utf8");
    record(
      `${USAGE_CACHE_NAME} holds dates and numbers only, keyed by a hash of each path`,
      !/a\.db|b\.db|r1|conversations/.test(cacheText) && /2026-10-18/.test(cacheText),
      cacheText.slice(0, 200)
    );
    fs.utimesSync(path.join(dir, "b.db"), new Date(at(0.5)), new Date(at(0.5)));
    inHome(home, () => render());
    record("a changed database is read again, alone", stats.opens === cached + 1);

    const preview = inHome(home, () => render(config(), false));
    record(
      "previews show the cached totals without opening a database",
      preview.includes("Today: 2.5K") && stats.opens === cached + 1,
      preview
    );

    const budget = inHome(home, () =>
      render(config({}, [{ id: "tokensToday", budget: 3000, warn: 70, crit: 90 }]))
    );
    record("a budget adds the share used", budget.includes("Today: 2.5K (82%)"), budget);
    const colored = inHome(home, () =>
      renderStatusline(
        { ...sampleData(), terminal_width: 0 },
        config({}, [{ id: "tokensToday", budget: 3000 }]),
        { color: "truecolor", env: {}, usage: "read" }
      )
    );
    const plainColor = inHome(home, () =>
      renderStatusline(
        { ...sampleData(), terminal_width: 0 },
        config({}, [{ id: "tokensToday" }]),
        { color: "truecolor", env: {}, usage: "read" }
      )
    );
    record("past the caution share the widget takes the caution color", colored !== plainColor);

    const wrong = inHome(home, () =>
      ["2000", { x: 1 }, -5, null, [1]].map((value) =>
        render(config({}, [{ id: "tokensToday", budget: value }]))
      )
    );
    record(
      "a budget of the wrong type is ignored",
      wrong.every((text) => text.includes("Today: 2.5K") && !text.includes("%")),
      wrong.join(" / ")
    );

    // Locked, corrupt or foreign databases are skipped and logged, without a path.
    setLogDir(install, true);
    try {
      fs.writeFileSync(path.join(dir, "corrupt.db"), "not a database at all");
      makeConversationDb(path.join(dir, "badblob.db"), {
        gens: [Uint8Array.from([0x0f, 0x01])],
        mtime: at(1),
      });
      makeConversationDb(path.join(dir, "locked.db"), {
        gens: [generator({ input: 50000, output: 0, id: "l" }, at(1))],
        mtime: at(1),
      });
      const { DatabaseSync } = loadSqlite();
      const holder = new DatabaseSync(path.join(dir, "locked.db"));
      holder.exec("BEGIN EXCLUSIVE");
      let skipped;
      try {
        skipped = inHome(home, () => render());
      } finally {
        holder.exec("ROLLBACK");
        holder.close();
      }
      const logged = readLog(getLogPath()).filter((entry) => entry.code === "USAGE_DB_UNREADABLE");
      const logText = fs.readFileSync(getLogPath(), "utf8");
      record(
        "a locked, corrupt or foreign database is skipped and logged without its name",
        skipped.includes("Today: 2.5K") &&
          logged.length > 0 &&
          !/corrupt|locked|badblob|conversations/.test(logText),
        `${skipped} / ${logText.slice(0, 200)}`
      );
      const unlocked = inHome(home, () => render());
      record(
        "once unlocked it is read on the next refresh",
        unlocked.includes("Today: 52.5K"),
        unlocked
      );
    } finally {
      setLogDir(null);
    }

    const empty = path.join(root, "empty-home");
    fs.mkdirSync(empty);
    const install2 = path.join(root, "install2");
    fs.mkdirSync(install2);
    fs.writeFileSync(path.join(install2, "statusline.config.json"), "{}");
    setConfigDir(install2);
    clearUsageCache();
    const none = inHome(empty, () => render());
    record("with no conversations folder both widgets hide", none.trim() === "", none);
    clearUsageCache();
    setConfigDir(install2);
    record(
      "with no cache, previews hide the widgets",
      inHome(home, () => render(config(), false)).trim() === ""
    );

    let rejected = 0;
    let deep = [];
    for (let i = 0; i < 12; i++) {
      deep = field(1, deep);
    }
    for (const bad of [[0x0a, 0x05, 0x01], [0xff, 0xff, 0xff], [0x0b], deep]) {
      try {
        let msg = decodeMessage(Uint8Array.from(bad));
        for (let i = 0; i < 10; i++) {
          msg = decodeMessage(msg.fields.get(1)?.[0], msg.depth + 1);
        }
      } catch {
        rejected += 1;
      }
    }
    record("truncated, malformed or too deeply nested protobuf is rejected", rejected === 4);
  } catch (err) {
    record("usage suite ran without errors", false, String(err.stack || err));
  } finally {
    setConfigDir(previousConfigDir);
    clearUsageCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run, makeConversationDb, generator };
