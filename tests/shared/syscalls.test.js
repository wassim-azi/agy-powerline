// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");
const workerThreads = require("worker_threads");
const { record, stripAnsi } = require("../helpers");
const {
  renderStatusline,
  defaultConfig,
  sampleData,
  clearExecCache,
} = require("../../src/lib/shared");
const { getConfigDir, setConfigDir } = require("../../src/lib/config");
const { STATUS_CACHE_NAME, clearGitDetailsCache, setGitTimeouts } = require("../../src/lib/git");
const {
  USAGE_CACHE_NAME,
  stats: usageStats,
  loadSqlite,
  clearUsageCache,
} = require("../../src/lib/usage");

const GIT_ENV_BASE = {
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
};

function makeGit(home) {
  const env = {
    ...process.env,
    ...GIT_ENV_BASE,
    HOME: home,
    USERPROFILE: home,
    GIT_CONFIG_GLOBAL: path.join(home, "no-global-config"),
  };
  return (cwd, ...args) =>
    childProcess.execFileSync(
      "git",
      [
        "-c",
        "user.name=test",
        "-c",
        "user.email=",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "init.defaultBranch=main",
        ...args,
      ],
      { cwd, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }
    );
}

function hasGit() {
  try {
    childProcess.execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Counts deterministic fs calls, child_process spawns, worker launches, and
// bytes read during fn(). Uses a re-entrancy depth guard so composite fs calls
// (e.g. readFileSync invoking openSync/fstatSync) count once at depth 0.
function measureSyscalls(fn) {
  const counts = {
    reads: 0,
    opens: 0,
    stats: 0,
    readdirs: 0,
    spawns: 0,
    workers: 0,
    bytesRead: 0,
    spawnCalls: [],
  };
  let fsDepth = 0;
  const originals = [];

  function wrapFs(name, counter, trackBytes = false) {
    const original = fs[name];
    originals.push([fs, name, original]);
    fs[name] = function (...args) {
      const top = fsDepth === 0;
      if (top) {
        counts[counter] += 1;
      }
      fsDepth += 1;
      try {
        const result = original.apply(this, args);
        if (top && trackBytes) {
          if (Buffer.isBuffer(result)) {
            counts.bytesRead += result.length;
          } else if (typeof result === "string") {
            counts.bytesRead += Buffer.byteLength(result, "utf8");
          }
        }
        return result;
      } finally {
        fsDepth -= 1;
      }
    };
  }

  wrapFs("readFileSync", "reads", true);
  wrapFs("openSync", "opens");
  wrapFs("statSync", "stats");
  wrapFs("lstatSync", "stats");
  wrapFs("accessSync", "stats");
  wrapFs("existsSync", "stats");
  wrapFs("readdirSync", "readdirs");

  for (const name of ["execFileSync", "spawn", "spawnSync", "execSync"]) {
    const original = childProcess[name];
    originals.push([childProcess, name, original]);
    childProcess[name] = function (file, args, ...rest) {
      counts.spawns += 1;
      counts.spawnCalls.push({
        method: name,
        file,
        args: Array.isArray(args) ? args : [],
      });
      return original.call(this, file, args, ...rest);
    };
  }

  const OriginalWorker = workerThreads.Worker;
  originals.push([workerThreads, "Worker", OriginalWorker]);
  workerThreads.Worker = class TrackedWorker extends OriginalWorker {
    constructor(...args) {
      counts.workers += 1;
      super(...args);
    }
  };

  try {
    const value = fn();
    return { value, ...counts };
  } finally {
    for (let i = originals.length - 1; i >= 0; i--) {
      const [target, prop, original] = originals[i];
      target[prop] = original;
    }
  }
}

// Minimal protobuf helpers for a deterministic SQLite conversation fixture.
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

function protoField(number, value) {
  if (typeof value === "number") {
    return [...varint(number * 8), ...varint(value)];
  }
  const bytes = typeof value === "string" ? [...Buffer.from(value)] : [...value];
  return [...varint(number * 8 + 2), ...varint(bytes.length), ...bytes];
}

const protoMessage = (...fields) => Uint8Array.from(fields.flat());

function makeUsageDb(file, nowMs) {
  const { DatabaseSync } = loadSqlite();
  const ts = protoMessage(protoField(1, Math.floor((nowMs - 3600000) / 1000)), protoField(2, 0));
  const usage = protoMessage(protoField(2, 1200), protoField(3, 300), protoField(11, "r1"));
  const gen = protoMessage(
    protoField(
      1,
      protoMessage(protoField(4, usage), protoField(9, protoMessage(protoField(4, ts))))
    )
  );
  const db = new DatabaseSync(file);
  db.exec(
    "CREATE TABLE gen_metadata (idx INTEGER, data BLOB);" +
      "CREATE TABLE steps (idx INTEGER, metadata BLOB);" +
      "CREATE TABLE trajectory_metadata_blob (data BLOB);"
  );
  db.prepare("INSERT INTO gen_metadata VALUES (?, ?)").run(0, gen);
  db.close();
  fs.utimesSync(file, new Date(nowMs - 1800000), new Date(nowMs - 1800000));
}

function statsLabel(m) {
  return `spawns=${m.spawns}, workers=${m.workers}, readdirs=${m.readdirs}, reads=${m.reads}, stats=${m.stats}, bytesRead=${m.bytesRead}`;
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-syscalls-"));
  const home = path.join(root, "home");
  const install = path.join(root, "install");
  const outside = path.join(root, "outside");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(install, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(install, "statusline.config.json"), "{}");

  const envKeys = ["HOME", "USERPROFILE", "AGY_POWERLINE_HOME"];
  const previousEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  const previousConfigDir = getConfigDir();
  const previousTimeouts = setGitTimeouts({ sync: 5000, detail: 5000 });
  const realNow = Date.now;

  // Warm up lazy module loads before measuring syscalls.
  const baseSample = sampleData();
  loadSqlite();

  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.env.AGY_POWERLINE_HOME = install;
    setConfigDir(install);

    // 1. Default preset outside a git repo: zero spawns, zero readdirs, minimal reads.
    const defaultCfg = { ...defaultConfig(), layout: "pills" };
    const outsideRun = measureSyscalls(() =>
      renderStatusline({ ...baseSample, cwd: outside, vcs: undefined }, defaultCfg, {
        color: "none",
        env: {},
      })
    );
    record(
      "default preset outside a git repo starts zero processes and reads no directories",
      outsideRun.spawns === 0 &&
        outsideRun.workers === 0 &&
        outsideRun.readdirs === 0 &&
        outsideRun.reads === 0 &&
        outsideRun.bytesRead === 0,
      statsLabel(outsideRun)
    );

    if (!hasGit()) {
      record("git syscall checks skipped: git is not installed", true);
    } else {
      const git = makeGit(home);
      const remote = path.join(root, "remote.git");
      const work = path.join(root, "work");
      git(root, "init", "-q", "--bare", remote);
      git(root, "clone", "-q", remote, work);
      fs.writeFileSync(path.join(work, "file.txt"), "one\n");
      git(work, "add", "file.txt");
      git(work, "commit", "-q", "-m", "init");
      git(work, "push", "-q", "-u", "origin", "main");
      const sha = git(work, "rev-parse", "--short=7", "HEAD").trim();

      // Leave an uncommitted change so gitFiles / gitChanges produce output.
      fs.writeFileSync(path.join(work, "file.txt"), "one\ntwo\n");

      // 1b. Default preset when vcs.branch is in payload and HEAD === upstream.
      const inSyncPayload = measureSyscalls(() =>
        renderStatusline(
          { ...baseSample, cwd: work, vcs: { type: "git", branch: "main", dirty: false } },
          defaultCfg,
          { color: "none", env: {} }
        )
      );
      record(
        "default preset in sync with upstream starts zero processes and stays within read bounds",
        inSyncPayload.spawns === 0 &&
          inSyncPayload.workers === 0 &&
          inSyncPayload.readdirs === 0 &&
          inSyncPayload.reads <= 15 &&
          inSyncPayload.stats <= 40 &&
          inSyncPayload.bytesRead <= 16384,
        statsLabel(inSyncPayload)
      );

      // 2. Default preset + gitSha, gitStash, gitWorktree in a real git repo (HEAD === upstream).
      const localGitCfg = {
        ...defaultCfg,
        widgets: [
          ...defaultCfg.widgets,
          { id: "gitSha" },
          { id: "gitStash" },
          { id: "gitWorktree" },
        ],
      };
      const localGitRun = measureSyscalls(() =>
        renderStatusline(
          { ...baseSample, cwd: work, vcs: { type: "git" }, terminal_width: 0 },
          localGitCfg,
          { color: "none", env: {} }
        )
      );
      const localGitPlain = stripAnsi(localGitRun.value);
      record(
        "default preset + gitSha, gitStash, gitWorktree inside an in-sync repo spawns zero processes",
        localGitRun.spawns === 0 &&
          localGitRun.workers === 0 &&
          localGitRun.readdirs === 0 &&
          localGitRun.reads <= 20 &&
          localGitRun.bytesRead <= 16384 &&
          localGitPlain.includes(sha),
        `${statsLabel(localGitRun)} | ${localGitPlain}`
      );

      // 3. Cold vs warm cached gitFiles and gitChanges render (within 5s TTL).
      const statusCache = path.join(install, STATUS_CACHE_NAME);
      fs.rmSync(statusCache, { force: true });
      clearGitDetailsCache();
      const detailsCfg = {
        ...defaultCfg,
        widgets: [{ id: "gitFiles" }, { id: "gitChanges" }],
      };
      const coldDetails = measureSyscalls(() =>
        renderStatusline(
          { ...baseSample, cwd: work, vcs: { type: "git" }, terminal_width: 0 },
          detailsCfg,
          { color: "none", env: {} }
        )
      );
      const warmMemDetails = measureSyscalls(() =>
        renderStatusline(
          { ...baseSample, cwd: work, vcs: { type: "git" }, terminal_width: 0 },
          detailsCfg,
          { color: "none", env: {} }
        )
      );
      clearGitDetailsCache();
      const warmDiskDetails = measureSyscalls(() =>
        renderStatusline(
          { ...baseSample, cwd: work, vcs: { type: "git" }, terminal_width: 0 },
          detailsCfg,
          { color: "none", env: {} }
        )
      );
      const warmDiskPlain = stripAnsi(warmDiskDetails.value);
      record(
        "gitFiles and gitChanges spawn 2 processes cold and 0 processes warm (memory and disk cache)",
        coldDetails.spawns === 2 &&
          coldDetails.workers === 0 &&
          coldDetails.readdirs === 0 &&
          warmMemDetails.spawns === 0 &&
          warmMemDetails.workers === 0 &&
          warmMemDetails.readdirs === 0 &&
          warmMemDetails.reads <= 10 &&
          warmMemDetails.bytesRead <= 4096 &&
          warmDiskDetails.spawns === 0 &&
          warmDiskDetails.workers === 0 &&
          warmDiskDetails.readdirs === 0 &&
          warmDiskDetails.reads <= 15 &&
          warmDiskDetails.bytesRead <= 8192 &&
          warmDiskPlain.includes("+1") &&
          warmDiskPlain.includes("●1"),
        `cold=(${statsLabel(coldDetails)}) mem=(${statsLabel(warmMemDetails)}) disk=(${statsLabel(warmDiskDetails)}) | ${warmDiskPlain}`
      );

      // 6. Multiple widgets reading git details in one render deduplicate git status/diff.
      fs.rmSync(statusCache, { force: true });
      clearGitDetailsCache();
      const allGitCfg = {
        ...defaultCfg,
        widgets: [
          { id: "git" },
          { id: "gitFiles" },
          { id: "gitFiles" },
          { id: "gitChanges" },
          { id: "gitChanges" },
          { id: "gitSha" },
          { id: "gitStash" },
          { id: "gitWorktree" },
        ],
      };
      const multiGit = measureSyscalls(() =>
        renderStatusline(
          { ...baseSample, cwd: work, vcs: { type: "git" }, terminal_width: 0 },
          allGitCfg,
          { color: "none", env: {} }
        )
      );
      const statusCalls = multiGit.spawnCalls.filter((c) => c.args.includes("status")).length;
      const diffCalls = multiGit.spawnCalls.filter((c) => c.args.includes("diff")).length;
      record(
        "combining git, gitFiles, gitChanges, gitSha, gitStash, gitWorktree runs status and diff at most once",
        multiGit.spawns === 2 && multiGit.workers === 0 && statusCalls === 1 && diffCalls === 1,
        `spawns=${multiGit.spawns}, status=${statusCalls}, diff=${diffCalls}`
      );
    }

    // 4. Cold vs warm cached tokensToday / tokensWeek render (node:sqlite opens).
    if (!loadSqlite()?.DatabaseSync) {
      record("usage syscall checks skipped: needs node:sqlite", true);
    } else {
      const nowMs = Date.parse("2026-10-18T12:00:00.000Z");
      Date.now = () => nowMs;
      try {
        const convDir = path.join(home, ".gemini", "antigravity-cli", "conversations");
        fs.mkdirSync(convDir, { recursive: true });
        makeUsageDb(path.join(convDir, "conv-1.db"), nowMs);

        const usageCfg = {
          ...defaultCfg,
          widgets: [{ id: "tokensToday" }, { id: "tokensWeek" }],
          clock: { timeZone: "UTC" },
        };
        const usageCache = path.join(install, USAGE_CACHE_NAME);
        fs.rmSync(usageCache, { force: true });
        clearUsageCache();

        const opensBeforeCold = usageStats.opens;
        const coldUsage = measureSyscalls(() =>
          renderStatusline({ ...baseSample, cwd: outside, terminal_width: 0 }, usageCfg, {
            color: "none",
            env: {},
            usage: "read",
          })
        );
        const coldOpens = usageStats.opens - opensBeforeCold;

        const opensBeforeWarmMem = usageStats.opens;
        const warmMemUsage = measureSyscalls(() =>
          renderStatusline({ ...baseSample, cwd: outside, terminal_width: 0 }, usageCfg, {
            color: "none",
            env: {},
            usage: "read",
          })
        );
        const warmMemOpens = usageStats.opens - opensBeforeWarmMem;

        clearUsageCache();
        const opensBeforeWarmDisk = usageStats.opens;
        const warmDiskUsage = measureSyscalls(() =>
          renderStatusline({ ...baseSample, cwd: outside, terminal_width: 0 }, usageCfg, {
            color: "none",
            env: {},
            usage: "read",
          })
        );
        const warmDiskOpens = usageStats.opens - opensBeforeWarmDisk;
        const warmPlain = stripAnsi(warmDiskUsage.value);

        record(
          "tokensToday/tokensWeek open unchanged .db files once cold and 0 times warm",
          coldOpens === 1 &&
            coldUsage.spawns === 0 &&
            coldUsage.workers === 0 &&
            warmMemOpens === 0 &&
            warmMemUsage.spawns === 0 &&
            warmMemUsage.workers === 0 &&
            warmDiskOpens === 0 &&
            warmDiskUsage.spawns === 0 &&
            warmDiskUsage.workers === 0 &&
            warmPlain.includes("1.5K"),
          `coldOpens=${coldOpens}, warmMemOpens=${warmMemOpens}, warmDiskOpens=${warmDiskOpens}, ${warmPlain}`
        );
      } finally {
        Date.now = realNow;
      }
    }

    // 5. Cold vs warm cached exec widget render (0 spawns and 0 worker threads warm).
    clearExecCache();
    const execCfg = {
      ...defaultCfg,
      widgets: [
        {
          id: "exec",
          cmd: `node -e "process.stdout.write('ok')"`,
          interval: 60,
          timeout: 5000,
        },
      ],
    };
    const coldExec = measureSyscalls(() =>
      renderStatusline({ ...baseSample, cwd: outside, terminal_width: 0 }, execCfg, {
        color: "none",
        env: {},
        exec: "run",
      })
    );
    const warmExec = measureSyscalls(() =>
      renderStatusline({ ...baseSample, cwd: outside, terminal_width: 0 }, execCfg, {
        color: "none",
        env: {},
        exec: "run",
      })
    );
    record(
      "warm cached exec render starts zero processes and zero worker threads",
      stripAnsi(coldExec.value).includes("ok") &&
        coldExec.workers === 1 &&
        coldExec.spawns === 0 &&
        stripAnsi(warmExec.value).includes("ok") &&
        warmExec.workers === 0 &&
        warmExec.spawns === 0 &&
        warmExec.reads === 0 &&
        warmExec.readdirs === 0,
      `cold=(${statsLabel(coldExec)}) warm=(${statsLabel(warmExec)})`
    );
  } catch (err) {
    record("syscalls suite ran without errors", false, String(err.stack || err));
  } finally {
    Date.now = realNow;
    clearExecCache();
    clearGitDetailsCache();
    clearUsageCache();
    setGitTimeouts(previousTimeouts);
    setConfigDir(previousConfigDir);
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousEnv[key];
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
