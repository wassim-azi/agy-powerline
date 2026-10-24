"use strict";

const { LAYOUT_ORDER } = require("../../src/lib/config");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { record, ROOT, NODE, PAYLOAD, stageInstall } = require("../helpers");
const { LOG_NAME, readLog } = require("../../src/lib/log");
const { getGitInfo } = require("../../src/lib/git");
const {
  renderStatusline,
  sampleData,
  defaultConfig,
  mergeConfig,
} = require("../../src/lib/shared");
const { VALID_WIDGET_IDS } = require("../../src/lib/config");

// Valid JSON with the wrong types: every widget, both layouts, every field of
// the sample payload swapped for each bad value. The bar must render and never
// show "[object Object]".
function testWrongPayloadTypes() {
  const widgets = [...VALID_WIDGET_IDS].filter((id) => id !== "exec").map((id) => ({ id }));
  const configs = LAYOUT_ORDER.map((layout) => mergeConfig({ layout, widgets }));
  const failures = [];
  const check = (label, payload) => {
    for (const config of configs) {
      try {
        const out = renderStatusline(payload, config, { color: "none" });
        if (out.includes("[object Object]")) {
          failures.push(`${label} (${config.layout}): [object Object]`);
        }
      } catch (err) {
        failures.push(`${label} (${config.layout}): ${err.message}`);
      }
    }
  };

  for (const payload of [null, [], "text", 5]) {
    check(`payload ${JSON.stringify(payload)}`, payload);
  }

  const base = sampleData();
  const leaves = [];
  (function walk(obj, at) {
    for (const [key, value] of Object.entries(obj)) {
      leaves.push([...at, key]);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value, [...at, key]);
      }
    }
  })(base, []);

  for (const at of leaves) {
    for (const bad of [{ x: 1 }, ["a"], 123, true, null, 1e12, -5]) {
      const data = structuredClone(base);
      let parent = data;
      for (const key of at.slice(0, -1)) {
        parent = parent[key];
      }
      parent[at[at.length - 1]] = bad;
      check(`${at.join(".")}=${JSON.stringify(bad)}`, data);
    }
  }

  record(
    "the bar renders any payload field of the wrong type",
    failures.length === 0,
    failures.slice(0, 5).join("; ")
  );

  // Meter styles of the wrong type or unknown fall back to the default meter.
  const meters = LAYOUT_ORDER.every((layout) => {
    try {
      const bad = mergeConfig({
        layout,
        meterStyle: { x: 1 },
        widgets: widgets.map((widget) => ({ ...widget, meter: ["blocks"] })),
      });
      return !renderStatusline(base, bad, { color: "none" }).includes("[object Object]");
    } catch {
      return false;
    }
  });
  record("meter styles of the wrong type don't break the bar", meters);

  const badWidgetOptions = LAYOUT_ORDER.every((layout) => {
    try {
      const bad = mergeConfig({
        layout,
        widgets: [
          { id: "cwd", depth: { x: 1 }, maxWidth: [8] },
          { id: "git", maxWidth: "5" },
          { id: "title", maxWidth: 1e9 },
          { id: "model", label: { x: 1 }, icon: ["🔋"] },
          { id: "fiveHourPct", label: 5, icon: null },
        ],
      });
      const out = renderStatusline(base, bad, { color: "none" });
      return !/\[object Object\]|undefined|null|🔋/.test(out);
    } catch {
      return false;
    }
  });
  record(
    "wrong-typed depth, maxWidth, label and icon options don't break the bar",
    badWidgetOptions
  );

  // The flex separator pads to terminal_width; a huge value must not allocate it.
  const widths = [1e12, "Infinity", -1, "wide"].map((width) => {
    try {
      return renderStatusline({ terminal_width: width }, defaultConfig(), { color: "none" }).length;
    } catch {
      return -1;
    }
  });
  record(
    "a bogus terminal_width neither throws nor pads past 1000 columns",
    widths.every((length) => length >= 0 && length < 5000),
    widths.join(", ")
  );
}

// Several agy windows refresh at once and share the exec cache. A reader must
// never see a half-written file while other processes rewrite it. The writers
// keep going until the reader has seen enough of their output (or a deadline
// passes), so the overlap doesn't depend on how fast the runner starts them.
async function testConcurrentExecCache() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-exec-cache-"));
  fs.writeFileSync(path.join(dir, "statusline.config.json"), "{}");
  const file = path.join(dir, ".exec-cache.json");
  const stopFile = path.join(dir, "stop");
  const lib = path.join(ROOT, "src", "lib").replace(/\\/g, "/");
  const writer = [
    'const fs = require("fs");',
    `const { setConfigDir } = require("${lib}/config");`,
    `const { saveDiskCache } = require("${lib}/exec");`,
    `setConfigDir(${JSON.stringify(dir)});`,
    "const big = { output: 'x'.repeat(200000), timestamp: Date.now() };",
    "const deadline = Date.now() + 20000;",
    `for (let i = 0; !fs.existsSync(${JSON.stringify(stopFile)}) && Date.now() < deadline; i++) {`,
    "  saveDiskCache({ [String(i)]: big });",
    "}",
  ].join("\n");

  let stderr = "";
  const writers = Array.from({ length: 4 }, () =>
    spawn(NODE, ["-e", writer], { stdio: ["ignore", "ignore", "pipe"] })
  );
  const done = Promise.all(
    writers.map(
      (child) =>
        new Promise((ok) => {
          child.stderr.on("data", (chunk) => {
            stderr += chunk;
          });
          child.on("error", (err) => {
            stderr += err.message;
            ok(-1);
          });
          child.on("exit", (code) => ok(code));
        })
    )
  );
  let reads = 0;
  let torn = 0;
  let codes = [];
  let finished = false;
  done.then((exitCodes) => {
    codes = exitCodes;
    finished = true;
  });

  const deadline = Date.now() + 15000;
  let stopped = false;
  while (!finished) {
    if (!stopped && (reads >= 50 || Date.now() > deadline)) {
      fs.writeFileSync(stopFile, "");
      stopped = true;
    }
    try {
      JSON.parse(fs.readFileSync(file, "utf8"));
      reads += 1;
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "EBUSY" && err.code !== "EPERM") {
        torn += 1;
      }
    }
    await new Promise((ok) => setImmediate(ok));
  }

  const leftovers = fs.readdirSync(dir).filter((name) => name.endsWith(".tmp"));
  fs.rmSync(dir, { recursive: true, force: true });
  record(
    "the exec cache is never seen half-written while other processes write it",
    torn === 0 && reads > 0 && leftovers.length === 0 && codes.every((code) => code === 0),
    `${reads} reads, ${torn} torn, ${leftovers.length} temp files left, ` +
      `writer exit codes ${codes.join(",")}${stderr ? `, stderr: ${stderr.slice(0, 300)}` : ""}`
  );
}

async function testStdoutEpipe() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-stdout-epipe-"));
  const home = path.join(root, "home");
  const installDir = path.join(home, ".agy-powerline");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;
  delete env.AGY_POWERLINE_LOG;
  stageInstall(installDir);

  try {
    const result = await new Promise((resolve) => {
      const child = spawn(NODE, [path.join(installDir, "statusline.js")], {
        windowsHide: true,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stderr = "";
      let settled = false;
      const timer = setTimeout(() => child.kill(), 8000);
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };

      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", (err) => finish({ code: null, signal: null, stderr: err.message }));
      child.once("close", (code, signal) => finish({ code, signal, stderr }));
      child.once("spawn", () => {
        child.stdout.destroy();
        child.stdin.end(PAYLOAD);
      });
    });
    const logFile = path.join(installDir, LOG_NAME);
    const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "";
    record(
      "runtime exits quietly when agy closes stdout early",
      result.code === 0 && result.signal === null && result.stderr === "" && log === "",
      `exit ${result.code}${result.signal ? ` (${result.signal})` : ""}, stderr ${JSON.stringify(result.stderr)}, log ${JSON.stringify(log)}`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function testStdoutErrorIsLogged() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-stdout-error-"));
  const home = path.join(root, "home");
  const installDir = path.join(home, ".agy-powerline");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;
  delete env.AGY_POWERLINE_LOG;
  stageInstall(installDir);

  try {
    const script = `require(${JSON.stringify(path.join(installDir, "statusline.js"))});
      process.stdout.emit("error", Object.assign(new Error("synthetic stdout failure"), { code: "EIO" }));`;
    const result = await new Promise((resolve) => {
      const child = spawn(NODE, ["-e", script], {
        windowsHide: true,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", (err) => resolve({ code: null, stderr: err.message }));
      child.once("close", (code) => resolve({ code, stderr }));
    });
    const logFile = path.join(installDir, LOG_NAME);
    const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "";
    record(
      "runtime logs non-EPIPE stdout errors",
      result.code === 0 &&
        result.stderr.includes("synthetic stdout failure") &&
        log.includes("synthetic stdout failure"),
      `exit ${result.code}, stderr ${JSON.stringify(result.stderr)}, log ${JSON.stringify(log)}`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// The usage widgets load node:sqlite, which prints an ExperimentalWarning on
// Node 22: the installed runtime's stderr must stay empty all the same.
function testUsageStderr() {
  const { loadSqlite } = require("../../src/lib/usage");
  if (!loadSqlite()?.DatabaseSync) {
    record(`usage stderr check skipped: needs node:sqlite (Node ${process.version})`, true);
    return;
  }
  const { makeConversationDb, generator } = require("./usage.test");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-usage-stderr-"));
  const home = path.join(root, "home");
  const installDir = path.join(home, ".agy-powerline");
  const conversations = path.join(home, ".gemini", "antigravity-cli", "conversations");
  fs.mkdirSync(conversations, { recursive: true });
  stageInstall(installDir);
  fs.writeFileSync(
    path.join(installDir, "statusline.config.json"),
    JSON.stringify({ widgets: [{ id: "tokensToday" }], color: "none" })
  );
  makeConversationDb(path.join(conversations, "c.db"), {
    gens: [generator({ input: 1200, output: 34, id: "x" }, Date.now())],
  });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;

  try {
    const result = spawnSync(NODE, [path.join(installDir, "statusline.js")], {
      input: PAYLOAD,
      env,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
    });
    record(
      "with usage widgets on the bar, the runtime's stderr stays empty",
      result.status === 0 && result.stderr === "" && /Today: 1\.2K/.test(result.stdout),
      `exit ${result.status}, stderr ${JSON.stringify(result.stderr)}, stdout ${JSON.stringify(result.stdout)}`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// An exec command handed the payload may never read it, exit before reading
// it, or hang: none of these may break or stall the bar.
function testExecPayloadFailures() {
  const { clearExecCache } = require("../../src/lib/shared");
  // Bigger than a pipe buffer, so the write is still going when the command exits.
  const data = { ...sampleData(), cwd: process.cwd(), filler: "x".repeat(200000) };
  const cases = [
    ["ignores its stdin", 'node -e "console.log(42)"', 5000, (out) => out.includes("42")],
    ["exits without reading", "exit 0", 5000, (out) => typeof out === "string"],
    [
      "times out",
      'node -e "setTimeout(() => console.log(1), 5000)"',
      300,
      (out, ms) => ms < 4000 && !out.includes("⚡ 1"),
    ],
  ];

  for (const [label, cmd, timeout, ok] of cases) {
    clearExecCache();
    const started = Date.now();
    let out = "";
    let error = "";
    try {
      out = renderStatusline(
        data,
        {
          ...defaultConfig(),
          widgets: [{ id: "model" }, { id: "exec", cmd, payload: true, interval: 0, timeout }],
        },
        { exec: "run", color: "none" }
      );
    } catch (err) {
      error = err.message;
    }
    const ms = Date.now() - started;
    record(
      `exec with "payload": true, a command that ${label}, still renders the bar`,
      !error && /Gemini/.test(out) && ok(out, ms),
      error || `${ms} ms: ${JSON.stringify(out)}`
    );
  }
  clearExecCache();
}

// A gradient of the wrong shape renders the plain theme, never an error.
function testBadGradients() {
  const bad = [
    "",
    "nope",
    "#ff0000",
    "#ff0000-#gggggg",
    "#1-#2",
    Array(8).fill("#fff").join("-"),
    42,
    true,
    [],
    ["#f00", "#00f"],
    { stops: ["#f00", "#00f"] },
  ];
  const failures = [];
  for (const layout of LAYOUT_ORDER) {
    const plain = renderStatusline(
      sampleData(),
      { ...defaultConfig(), layout },
      { color: "truecolor" }
    );
    for (const gradient of bad) {
      try {
        const out = renderStatusline(
          sampleData(),
          { ...defaultConfig(), layout, gradient },
          { color: "truecolor" }
        );
        if (out !== plain) {
          failures.push(`${layout} ${JSON.stringify(gradient)}: differs from the theme`);
        }
      } catch (err) {
        failures.push(`${layout} ${JSON.stringify(gradient)}: ${err.message}`);
      }
    }
  }
  record(
    "an invalid gradient renders the plain theme in both layouts",
    failures.length === 0,
    failures.slice(0, 5).join("; ")
  );
}

async function run() {
  testGitLookup();
  testWrongPayloadTypes();
  testBadGradients();
  testExecPayloadFailures();
  testUsageStderr();
  await testConcurrentExecCache();
  await testStdoutEpipe();
  await testStdoutErrorIsLogged();
  testRuntimeRenderOverrides();

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-bad-json-"));
  stageInstall(sandbox);
  const statuslinePath = path.join(sandbox, "statusline.js");

  try {
    const cliRes = spawnSync(NODE, [path.join(ROOT, "src", "index.js"), "render"], {
      input: "{bad json}",
      encoding: "utf8",
    });
    record(
      "render on bad JSON outputs hint on stdout and diagnostic on stderr",
      cliRes.status === 0 &&
        /invalid JSON/i.test(cliRes.stdout) &&
        /invalid JSON/i.test(cliRes.stderr),
      `code ${cliRes.status}`
    );

    const runtimeRes = spawnSync(NODE, [statuslinePath], {
      input: "not valid json at all",
      encoding: "utf8",
    });
    record(
      "runtime statusline.js on bad JSON outputs hint on stdout and diagnostic on stderr",
      runtimeRes.status === 0 &&
        /invalid JSON/i.test(runtimeRes.stdout) &&
        /invalid JSON/i.test(runtimeRes.stderr),
      `code ${runtimeRes.status}`
    );

    const emptyRes = spawnSync(NODE, [statuslinePath], {
      input: "",
      encoding: "utf8",
    });
    record(
      "runtime statusline.js on empty input exits silently with code 0",
      emptyRes.status === 0 && emptyRes.stdout === "" && emptyRes.stderr === "",
      `code ${emptyRes.status}`
    );

    // Node's "Unexpected token" error quotes the input, escape sequences included.
    const hostile = "SECRET\u001b]52;c;x\u0007";
    const echoes = (text) => text.includes("\u001b") || text.includes("SECRET");
    const cliHostile = spawnSync(NODE, [path.join(ROOT, "src", "index.js"), "render"], {
      input: hostile,
      encoding: "utf8",
    });
    const runtimeHostile = spawnSync(NODE, [statuslinePath], {
      input: hostile,
      encoding: "utf8",
    });
    record(
      "bad JSON diagnostics on stderr never quote the input",
      /invalid JSON/i.test(cliHostile.stderr) &&
        /invalid JSON/i.test(runtimeHostile.stderr) &&
        !echoes(cliHostile.stderr) &&
        !echoes(runtimeHostile.stderr),
      JSON.stringify(runtimeHostile.stderr)
    );

    await testOpenStdin(statuslinePath);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

function testRuntimeRenderOverrides() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-runtime-overrides-"));
  const home = path.join(root, "home");
  const installDir = path.join(home, ".agy-powerline");
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;
  delete env.AGY_POWERLINE_LOG;
  stageInstall(installDir);
  const statuslinePath = path.join(installDir, "statusline.js");
  const configPath = path.join(installDir, "statusline.config.json");
  const savedConfig = fs.readFileSync(configPath, "utf8");

  try {
    const baseline = spawnSync(NODE, [statuslinePath], {
      input: PAYLOAD,
      encoding: "utf8",
      env,
    });
    const valid = spawnSync(
      NODE,
      [
        statuslinePath,
        "--theme",
        "light",
        "--layout",
        "pills",
        "--caps",
        "angled",
        "--gradient",
        "sunset",
        "--preset",
        "compact",
      ],
      { input: PAYLOAD, encoding: "utf8", env }
    );
    record(
      "installed runtime applies valid flags and leaves its saved config unchanged",
      baseline.status === 0 &&
        valid.status === 0 &&
        valid.stdout.includes("Flash") &&
        valid.stdout !== baseline.stdout &&
        valid.stderr === "" &&
        fs.readFileSync(configPath, "utf8") === savedConfig,
      `exit ${valid.status}: ${valid.stderr}`
    );

    const hostile = "not-a-theme\u001b[2Jprivate-value";
    const invalid = spawnSync(
      NODE,
      [statuslinePath, "--theme", hostile, "--unknown-private-value"],
      { input: PAYLOAD, encoding: "utf8", env }
    );
    const log = readLog(path.join(installDir, LOG_NAME));
    const invalidEntries = log.filter((entry) => entry.code === "BAD_RUNTIME_FLAG");
    record(
      "runtime ignores invalid and unknown flags, logs names only, and prints one safe line",
      invalid.status === 0 &&
        invalid.stdout === baseline.stdout &&
        invalid.stderr.trim().split(/\r?\n/).length === 1 &&
        invalid.stderr.includes("--theme") &&
        invalid.stderr.includes("unknown option") &&
        !invalid.stderr.includes("private-value") &&
        !invalid.stderr.includes("\u001b") &&
        invalidEntries.length === 1 &&
        !JSON.stringify(invalidEntries).includes("private-value"),
      `exit ${invalid.status}: ${JSON.stringify(invalid.stderr)}`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// Writes `input` to the runtime's stdin and never closes it, like Antigravity
// in google-antigravity/antigravity-cli#698. Kills it after 8 s if it hangs.
function runWithOpenStdin(statuslinePath, input) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(NODE, [statuslinePath], { windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    const guard = setTimeout(() => child.kill(), 8000);
    child.on("close", (code) => {
      clearTimeout(guard);
      child.stdin.destroy();
      resolve({ code, stdout, ms: Date.now() - started });
    });
    if (input) {
      child.stdin.write(input);
    }
  });
}

async function testOpenStdin(statuslinePath) {
  const silent = await runWithOpenStdin(statuslinePath, "");
  record(
    "runtime exits quietly when stdin stays open and empty",
    silent.code === 0 && silent.stdout === "" && silent.ms < 5000,
    `code ${silent.code}, ${silent.ms} ms, stdout ${JSON.stringify(silent.stdout)}`
  );

  const full = await runWithOpenStdin(statuslinePath, PAYLOAD);
  record(
    "runtime renders a complete payload even when stdin stays open",
    full.code === 0 && /Gemini/.test(full.stdout) && full.ms < 5000,
    `code ${full.code}, ${full.ms} ms`
  );

  const partial = await runWithOpenStdin(statuslinePath, PAYLOAD.slice(0, 40));
  record(
    "runtime exits quietly on a payload cut off by the stdin deadline",
    partial.code === 0 && partial.stdout === "" && partial.ms < 5000,
    `code ${partial.code}, ${partial.ms} ms, stdout ${JSON.stringify(partial.stdout)}`
  );
}

// A fake repo (no git binary needed): .git/HEAD on a named branch.
function fakeRepo(root, name, branch) {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
  return dir;
}

function testGitLookup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-git-"));

  try {
    const repo = fakeRepo(root, "repo", "real-branch");
    fs.mkdirSync(path.join(repo, "src", "lib"), { recursive: true });

    record(
      "an existing folder inside a repo shows that repo's branch",
      getGitInfo(repo)?.branch === "real-branch" &&
        getGitInfo(path.join(repo, "src", "lib"))?.branch === "real-branch"
    );

    // Worktrees: .git is a file pointing at the real git dir.
    const worktreeGitDir = path.join(root, "worktree-gitdir");
    fs.mkdirSync(worktreeGitDir, { recursive: true });
    fs.writeFileSync(path.join(worktreeGitDir, "HEAD"), "ref: refs/heads/wt-branch\n");
    const worktree = path.join(root, "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, ".git"), `gitdir: ${worktreeGitDir}\n`);
    record(
      "a worktree (.git file) still resolves its branch",
      getGitInfo(worktree)?.branch === "wt-branch"
    );

    record(
      "a missing absolute folder or an empty cwd has no branch",
      getGitInfo(path.join(repo, "does", "not", "exist")) === null && getGitInfo("") === null
    );

    // The process runs inside a repo with a recognizable branch; relative and
    // missing payload paths must not pick it up.
    const leaky = fakeRepo(root, "surrounding", "leaked-branch");
    const probe = spawnSync(
      NODE,
      [
        "-e",
        `const g = require(${JSON.stringify(path.join(ROOT, "src", "lib", "git.js"))});
         console.log(JSON.stringify(["Projects/app", "C:/Projects/app", "./x"].map(g.getGitInfo)));`,
      ],
      { cwd: leaky, encoding: "utf8" }
    );
    record(
      "relative or Windows-style paths never pick up the surrounding checkout",
      probe.stdout.trim() === "[null,null,null]",
      probe.stdout.trim() || probe.stderr
    );

    const home = path.join(root, "home");
    const env = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      AGY_POWERLINE_HOME: path.join(home, ".agy-powerline"),
    };
    const payload = JSON.stringify({
      model: { display_name: "Gemini" },
      cwd: "C:/Projects/agy-powerline",
      terminal_width: 120,
    });
    const rendered = spawnSync(NODE, [path.join(ROOT, "src", "index.js"), "render"], {
      cwd: leaky,
      input: payload,
      encoding: "utf8",
      env,
    });
    record(
      "the bar shows no git pill for a payload folder that isn't on this machine",
      rendered.status === 0 &&
        /Gemini/.test(rendered.stdout) &&
        !/leaked-branch/.test(rendered.stdout),
      `exit ${rendered.status}`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
