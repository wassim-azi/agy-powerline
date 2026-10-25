// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, stripAnsi } = require("../helpers");
const { defaultConfig, renderStatusline, sampleData } = require("../../src/lib/shared");
const { formatSessionTime } = require("../../src/lib/formatters");
const { extractSession, readSessionStartMs } = require("../../src/lib/session");
const { clearLog, getLogPath, readLog, setLogDir } = require("../../src/lib/log");

const MINUTE = 60 * 1000;
const IDLE = 30 * MINUTE;
const NOW = Date.parse("2026-10-21T12:00:00.000Z");

function inHome(name, fn, { conversations = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `agy-session-time-${name}-`));
  const home = path.join(root, "home");
  const installDir = path.join(home, ".agy-powerline");
  const conversationsDir = path.join(home, ".gemini", "antigravity-cli", "conversations");
  fs.mkdirSync(installDir, { recursive: true });
  if (conversations) {
    fs.mkdirSync(conversationsDir, { recursive: true });
  }

  const previousEnv = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    AGY_POWERLINE_HOME: process.env.AGY_POWERLINE_HOME,
  };
  const previousLogPath = getLogPath();
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.AGY_POWERLINE_HOME = installDir;
  setLogDir(installDir);

  try {
    return fn({ home, installDir, conversationsDir });
  } finally {
    clearLog(installDir);
    setLogDir(previousLogPath ? path.dirname(previousLogPath) : null);
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function withClock(now, fn) {
  const realNow = Date.now;
  Date.now = () => now;
  try {
    return fn();
  } finally {
    Date.now = realNow;
  }
}

function withStats(times, fn) {
  const realStat = fs.statSync;
  fs.statSync = function (file, ...args) {
    const result = times.get(path.resolve(file));
    return result ? { ...result } : realStat.call(fs, file, ...args);
  };
  try {
    return fn();
  } finally {
    fs.statSync = realStat;
  }
}

function makeDb(directory, name, mtimeMs = NOW) {
  const file = path.join(directory, name);
  fs.writeFileSync(file, "");
  fs.utimesSync(file, new Date(mtimeMs), new Date(mtimeMs));
  return file;
}

async function run() {
  testFormatting();
  testReadGate();
  testNewestConversationAndLayouts();
  testIdleAndInvalidTimes();
  testMissingFolder();
  testTooManyFiles();
  testWal();
  testCache();
  test2000FileBenchmark();
}

function testFormatting() {
  const start = NOW - 60 * MINUTE;
  record(
    "sessionTime hides conversations younger than one minute",
    formatSessionTime(NOW, NOW + 59999) === ""
  );
  record(
    "sessionTime formats 1-59 minutes",
    formatSessionTime(start, start + 25 * MINUTE) === "25m"
  );
  record(
    "sessionTime formats hours and minutes",
    formatSessionTime(start, start + (2 * 60 + 5) * MINUTE) === "2hr 5m"
  );
  record(
    "sessionTime formats days and hours",
    formatSessionTime(start, start + (24 * 60 + 180) * MINUTE) === "1d 3h"
  );
  record("sessionTime hides invalid start times", formatSessionTime("not-a-time", NOW) === "");
}

function testReadGate() {
  inHome("read-gate", ({ conversationsDir }) => {
    makeDb(conversationsDir, "test-id.db");
    const originalReadDir = fs.readdirSync;
    let conversationReads = 0;
    fs.readdirSync = function (directory, ...args) {
      if (path.resolve(directory) === path.resolve(conversationsDir)) {
        conversationReads += 1;
      }
      return originalReadDir.call(fs, directory, ...args);
    };
    try {
      extractSession(sampleData(), { widgets: [{ id: "model" }] }, { readUsage: true });
      extractSession(sampleData(), { widgets: [{ id: "sessionTime" }] });
      record(
        "sessionTime reads metadata only when enabled on the live statusline",
        conversationReads === 0
      );
      extractSession(sampleData(), { widgets: [{ id: "sessionTime" }] }, { readUsage: true });
      record(
        "sessionTime reads metadata when enabled on the live statusline",
        conversationReads === 1
      );
    } finally {
      fs.readdirSync = originalReadDir;
    }
  });
}

function testNewestConversationAndLayouts() {
  inHome("newest", ({ conversationsDir }) => {
    const older = makeDb(conversationsDir, "older-id.db", NOW - 10 * MINUTE);
    const active = makeDb(conversationsDir, "active-id.db", NOW - MINUTE);
    fs.writeFileSync(path.join(conversationsDir, "notes.txt"), "ignored");
    fs.mkdirSync(path.join(conversationsDir, "directory.db"));
    const times = new Map([
      [path.resolve(older), { mtimeMs: NOW - 10 * MINUTE, birthtimeMs: NOW - 40 * MINUTE }],
      [path.resolve(active), { mtimeMs: NOW - MINUTE, birthtimeMs: NOW - 25 * MINUTE }],
    ]);

    withClock(NOW, () =>
      withStats(times, () => {
        const start = readSessionStartMs();
        record(
          "sessionTime uses the most recently modified conversation",
          start === NOW - 25 * MINUTE
        );

        const preview = stripAnsi(
          renderStatusline(
            sampleData(),
            { ...defaultConfig(), widgets: [{ id: "sessionTime" }] },
            { color: "none" }
          )
        );
        record(
          "sessionTime preview shows its synthetic sample duration",
          /Session: 25m/.test(preview)
        );

        for (const layout of ["pills", "lines"]) {
          const output = stripAnsi(
            renderStatusline(
              sampleData(),
              { ...defaultConfig(), layout, widgets: [{ id: "sessionTime" }] },
              { color: "none", usage: "read" }
            )
          );
          record(
            `${layout} sessionTime shows the active duration without a file name`,
            /Session: 25m/.test(output) &&
              !output.includes("active-id.db") &&
              !output.includes("older-id.db"),
            output
          );

          const raw = stripAnsi(
            renderStatusline(
              sampleData(),
              { ...defaultConfig(), layout, widgets: [{ id: "sessionTime", raw: true }] },
              { color: "none", usage: "read" }
            )
          );
          record(
            `${layout} sessionTime raw mode shows only the duration`,
            raw.includes("25m") && !raw.includes("Session") && !raw.includes("⏱️"),
            raw
          );
        }
      })
    );
  });
}

function testIdleAndInvalidTimes() {
  inHome("invalid-times", ({ conversationsDir }) => {
    const file = makeDb(conversationsDir, "fixture-id.db", NOW - IDLE - 1);
    const oldFileTimes = new Map([
      [path.resolve(file), { mtimeMs: NOW - IDLE - 1, birthtimeMs: NOW - 60 * MINUTE }],
    ]);
    record(
      "sessionTime hides a conversation idle for more than 30 minutes",
      withStats(oldFileTimes, () => readSessionStartMs(NOW)) === null
    );

    const mtimeMs = NOW - MINUTE;
    const invalidBirthtimes = [0, undefined, NOW + 1, mtimeMs + 1];
    for (const birthtimeMs of invalidBirthtimes) {
      const times = new Map([[path.resolve(file), { mtimeMs, birthtimeMs }]]);
      record(
        "sessionTime hides an invalid conversation creation time",
        withStats(times, () => readSessionStartMs(NOW)) === null
      );
    }

    const activeFile = makeDb(conversationsDir, "active-fixture-id.db", NOW - MINUTE);
    const oldAndActiveTimes = new Map([
      [path.resolve(file), { mtimeMs: NOW - 20 * MINUTE, birthtimeMs: 0 }],
      [path.resolve(activeFile), { mtimeMs: NOW - MINUTE, birthtimeMs: NOW - 25 * MINUTE }],
    ]);
    record(
      "sessionTime ignores an invalid creation time on an older conversation",
      withStats(oldAndActiveTimes, () => readSessionStartMs(NOW)) === NOW - 25 * MINUTE
    );
  });
}

function testMissingFolder() {
  inHome(
    "missing-folder",
    () => {
      record(
        "sessionTime hides when the conversations folder is missing",
        readSessionStartMs(NOW) === null
      );
    },
    { conversations: false }
  );
}

function testTooManyFiles() {
  inHome("too-many", ({ conversationsDir, installDir }) => {
    const realReadDir = fs.readdirSync;
    const realStat = fs.statSync;
    let conversationStats = 0;
    fs.readdirSync = function (directory, ...args) {
      if (path.resolve(directory) === path.resolve(conversationsDir)) {
        return Array.from({ length: 2001 }, (_, index) => ({
          name: `conversation-${index}.db`,
          isFile: () => true,
        }));
      }
      return realReadDir.call(fs, directory, ...args);
    };
    fs.statSync = function (file, ...args) {
      if (path.dirname(path.resolve(file)) === path.resolve(conversationsDir)) {
        conversationStats += 1;
      }
      return realStat.call(fs, file, ...args);
    };

    try {
      const result = readSessionStartMs(NOW);
      const entries = readLog(getLogPath(installDir));
      const logText = JSON.stringify(entries);
      record(
        "sessionTime hides without statting more than 2,000 files",
        result === null && conversationStats === 0
      );
      record(
        "sessionTime logs the file limit without conversation names",
        entries.some((entry) => entry.code === "SESSION_TOO_MANY_FILES") &&
          !logText.includes("conversation-0.db") &&
          !logText.includes("conversation-2000.db")
      );
    } finally {
      fs.readdirSync = realReadDir;
      fs.statSync = realStat;
    }
  });
}

function testWal() {
  inHome("wal", ({ conversationsDir }) => {
    const older = makeDb(conversationsDir, "older-id.db", NOW - 40 * MINUTE);
    const wal = `${older}-wal`;
    fs.writeFileSync(wal, "");
    const newer = makeDb(conversationsDir, "newer-id.db", NOW - 5 * MINUTE);
    const times = new Map([
      [path.resolve(older), { mtimeMs: NOW - 40 * MINUTE, birthtimeMs: NOW - 90 * MINUTE }],
      [path.resolve(wal), { mtimeMs: NOW - MINUTE, birthtimeMs: NOW - 40 * MINUTE }],
      [path.resolve(newer), { mtimeMs: NOW - 5 * MINUTE, birthtimeMs: NOW - 10 * MINUTE }],
    ]);
    record(
      "sessionTime counts a conversation's -wal writes as activity",
      withStats(times, () => readSessionStartMs(NOW)) === NOW - 90 * MINUTE
    );
  });
}

function testCache() {
  inHome("cache", ({ installDir, conversationsDir }) => {
    fs.writeFileSync(path.join(installDir, "statusline.config.json"), "{}");
    const cacheFile = path.join(installDir, ".session-cache.json");
    const idle = makeDb(conversationsDir, "idle-id.db", NOW - IDLE - MINUTE);
    const idleTimes = new Map([
      [path.resolve(idle), { mtimeMs: NOW - IDLE - MINUTE, birthtimeMs: NOW - 90 * MINUTE }],
    ]);

    const realReadDir = fs.readdirSync;
    let scans = 0;
    fs.readdirSync = function (directory, ...args) {
      if (path.resolve(directory) === path.resolve(conversationsDir)) {
        scans += 1;
      }
      return realReadDir.call(fs, directory, ...args);
    };
    try {
      withStats(idleTimes, () => {
        readSessionStartMs(NOW);
        readSessionStartMs(NOW + 30 * 1000);
      });
      record("sessionTime caches an idle result instead of rescanning", scans === 1);

      const cacheText = fs.readFileSync(cacheFile, "utf8");
      const cached = JSON.parse(cacheText);
      record(
        "sessionTime cache holds timestamps only, no file names",
        Object.keys(cached).sort().join() === "newestMtimeMs,scannedAt,startMs" &&
          !cacheText.includes("idle-id"),
        cacheText
      );

      // agy writes again: the next scan after the cache expires sees it.
      const activeTimes = new Map([
        [path.resolve(idle), { mtimeMs: NOW + MINUTE, birthtimeMs: NOW - 90 * MINUTE }],
      ]);
      const later = NOW + 2 * MINUTE;
      const start = withStats(activeTimes, () => readSessionStartMs(later));
      record(
        "sessionTime rescans once the cache is a minute old",
        scans === 2 && start === NOW - 90 * MINUTE
      );

      scans = 0;
      renderStatusline(
        sampleData(),
        { ...defaultConfig(), widgets: [{ id: "sessionTime" }] },
        { color: "none" }
      );
      record(
        "a sessionTime preview neither scans nor rewrites the cache",
        scans === 0 &&
          fs.readFileSync(cacheFile, "utf8") ===
            JSON.stringify({
              startMs: NOW - 90 * MINUTE,
              newestMtimeMs: NOW + MINUTE,
              scannedAt: later,
            })
      );
    } finally {
      fs.readdirSync = realReadDir;
    }
  });
}

function test2000FileBenchmark() {
  inHome("benchmark", ({ installDir, conversationsDir }) => {
    fs.writeFileSync(path.join(installDir, "statusline.config.json"), "{}");
    const cacheFile = path.join(installDir, ".session-cache.json");
    for (let index = 0; index < 2000; index += 1) {
      fs.writeFileSync(path.join(conversationsDir, `benchmark-${index}.db`), "");
    }

    const median = (fn) => {
      const samples = [];
      for (let sample = 0; sample < 5; sample += 1) {
        const start = process.hrtime.bigint();
        fn();
        samples.push(Number(process.hrtime.bigint() - start) / 1e6);
      }
      return samples.sort((a, b) => a - b)[2];
    };

    // A full scan runs at most once a minute: reported, not asserted, so a
    // slow CI disk can't fail the suite.
    const scanMs = median(() => {
      fs.rmSync(cacheFile, { force: true });
      readSessionStartMs();
    });
    const cachedMs = median(() => readSessionStartMs());
    record(
      `sessionTime cached refresh with 2,000 files (${cachedMs.toFixed(2)} ms cached, ${scanMs.toFixed(2)} ms full scan, ${process.platform})`,
      fs.existsSync(cacheFile) && (process.platform !== "win32" || cachedMs < 10),
      `cached ${cachedMs.toFixed(2)} ms (Windows target under 10 ms); full scan ${scanMs.toFixed(2)} ms`
    );
  });
}

module.exports = { run };
