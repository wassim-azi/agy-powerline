"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { record, runCli, stageInstall, NODE, PAYLOAD, ROOT } = require("../helpers");
const {
  LOG_NAME,
  MAX_ENTRIES,
  isLogEnabled,
  setLogDir,
  redact,
  jsonErrorMessage,
  describeError,
  readLog,
  logEvent,
  logError,
  setBundleLines,
} = require("../../src/lib/log");
const { buildRuntimeBundle } = require("../../src/cli/bundle");
const { RUNTIME_FILES } = require("../../src/lib/paths");
const { safePayload } = require("../../src/lib/payload-dump");
const { renderStatusline, defaultConfig, mergeConfig } = require("../../src/lib/shared");
const { VALID_WIDGET_IDS } = require("../../src/lib/config");

// Personal values a payload can carry; none may reach the log or the report.
const SECRETS = ["someone@example.com", "abc123secret", "client-acme", "conv-98765"];

function secretPayload() {
  return JSON.stringify({
    ...JSON.parse(PAYLOAD),
    email: "someone@example.com",
    session_id: "abc123secret",
    conversation_id: "conv-98765",
    cwd: "/home/someone/projects/client-acme",
    version: "1.4.2",
  });
}

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `agy-verify-${name}-`));
}

function sandbox(name) {
  const root = tempDir(name);
  const installDir = path.join(root, ".agy-powerline");
  const env = { ...process.env, HOME: root, USERPROFILE: root, AGY_POWERLINE_HOME: installDir };
  delete env.AGY_POWERLINE_LOG;
  return { root, installDir, env, logFile: path.join(installDir, LOG_NAME) };
}

function testRedaction() {
  const who = { home: "C:\\Users\\jdoe", user: "jdoe", host: "JDOE-LAPTOP" };
  const cases = [
    ["open 'C:\\Users\\jdoe\\work\\client\\file.json'", "jdoe"],
    ["open 'C:/Users/jdoe/work/client/file.json'", "jdoe"],
    ["failed for /home/jdoe/projects/secret-app/x.js", "secret-app"],
    ["mail jdoe@corp.example now", "jdoe@corp.example"],
    ["fetch https://user:pass@example.com/api failed", "pass@example"],
    ["connect 192.168.1.20 refused", "192.168.1.20"],
    ["token ghp_0123456789abcdefABCDEF0123456789abcd leaked", "ghp_0123456789"],
    ["hash 3f2a9b7c1d4e5f60718293a4b5c6d7e8 seen", "3f2a9b7c1d4e"],
    ["host JDOE-LAPTOP down", "JDOE-LAPTOP"],
    ["user jdoe denied", "jdoe"],
  ];
  const leaks = cases.filter(([input, secret]) => redact(input, who).includes(secret));
  record(
    "redact removes paths, emails, URLs, IPs, tokens, the username and the hostname",
    leaks.length === 0,
    leaks.map(([input]) => redact(input, who)).join(" | ")
  );
  record(
    "redact keeps ordinary error text readable",
    redact("Cannot read properties of undefined (reading 'color')", who) ===
      "Cannot read properties of undefined (reading 'color')"
  );
  record(
    "redact strips control characters and caps the length",
    !redact("a\x1b[2Jb", who).includes("\x1b") && redact("x".repeat(500), who).length <= 200
  );
}

function testErrorDescription() {
  let jsonError;
  try {
    JSON.parse('{ "email": "someone@example.com", }');
  } catch (err) {
    jsonError = err;
  }
  const described = describeError(jsonError);
  record(
    "JSON errors keep only the position, never the quoted text",
    described.type === "SyntaxError" &&
      /^invalid JSON/.test(described.message) &&
      !JSON.stringify(described).includes("someone"),
    described.message
  );
  record(
    "jsonErrorMessage reads Node's line/column and position forms",
    jsonErrorMessage("Unexpected token in JSON at position 42 (line 3 column 7)") ===
      "invalid JSON at line 3 column 7" &&
      jsonErrorMessage("Unexpected token } in JSON at position 42") ===
        "invalid JSON at position 42" &&
      jsonErrorMessage("Unexpected token 'x', \"secret\" is not valid JSON") === "invalid JSON"
  );

  const err = new TypeError("boom");
  err.stack = [
    "TypeError: boom",
    `    at renderGroup (${path.join(__dirname, "..", "..", "src", "lib", "layouts", "pills.js")}:612:9)`,
    "    at Module._compile (node:internal/modules/cjs/loader:1781:14)",
    "    at foreign (/home/someone/other/app.js:1:1)",
  ].join("\n");
  const frames = describeError(err).frames || [];
  record(
    "stack frames keep only our own files, relative to the code",
    frames.length === 1 && frames[0] === "renderGroup lib/layouts/pills.js:612",
    JSON.stringify(frames)
  );
  record(
    "describeError survives odd input",
    describeError("x").message === "x" &&
      describeError(null).message === "" &&
      describeError({}).type === "Error"
  );
}

function testLogFile() {
  const dir = tempDir("log-file");
  const file = path.join(dir, LOG_NAME);

  try {
    setLogDir(null);
    logEvent("warn", "NOWHERE");
    record("nothing is written until a log dir is set", !fs.existsSync(file));

    setLogDir(dir);
    logEvent("warn", "CONFIG_INVALID", { message: "invalid JSON" });
    logEvent("warn", "CONFIG_INVALID", { message: "invalid JSON" });
    let entries = readLog(file);
    record(
      "a repeat within a minute doesn't rewrite the entry",
      entries.length === 1 && entries[0].count === 1
    );

    entries[0].last = "2000-01-01T00:00Z";
    fs.writeFileSync(file, JSON.stringify(entries[0]) + "\n");
    logEvent("warn", "CONFIG_INVALID", { message: "invalid JSON" });
    entries = readLog(file);
    record("a later repeat bumps the count", entries.length === 1 && entries[0].count === 2);

    fs.appendFileSync(file, 'not json at all\n{"half":\n');
    logError("RENDER_CRASH", new Error("broke"));
    entries = readLog(file);
    record(
      "broken lines are skipped, not fatal",
      entries.length === 2 && entries[1].code === "RENDER_CRASH"
    );

    for (let i = 0; i < MAX_ENTRIES + 20; i++) {
      logEvent("warn", `CODE_${i}`);
    }
    record("the log keeps at most MAX_ENTRIES entries", readLog(file).length === MAX_ENTRIES);

    const entry = readLog(file).at(-1);
    record(
      "entries carry versions and the platform, nothing personal",
      entry.version && entry.node && entry.os && !("hostname" in entry) && !("user" in entry)
    );

    record(
      'AGY_POWERLINE_LOG=0 and "log": false opt out',
      !isLogEnabled({}, { AGY_POWERLINE_LOG: "0" }) &&
        !isLogEnabled({ log: false }, {}) &&
        isLogEnabled({}, {}) &&
        isLogEnabled(null, {})
    );
  } finally {
    setLogDir(null);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runStatusline(box, input) {
  return spawnSync(NODE, [path.join(box.installDir, "statusline.js")], {
    input,
    encoding: "utf8",
    env: box.env,
  });
}

function testRuntime() {
  const box = sandbox("log-runtime");

  try {
    stageInstall(box.installDir);
    runStatusline(box, "{not json");
    runStatusline(box, secretPayload());
    fs.writeFileSync(path.join(box.installDir, "statusline.config.json"), "{ broken", "utf8");
    const res = runStatusline(box, secretPayload());

    const text = fs.existsSync(box.logFile) ? fs.readFileSync(box.logFile, "utf8") : "";
    const codes = readLog(box.logFile).map((entry) => entry.code);
    record(
      "the statusline logs a bad payload and a broken config",
      codes.includes("PAYLOAD_INVALID_JSON") &&
        codes.includes("CONFIG_INVALID") &&
        res.status === 0,
      codes.join(", ")
    );
    record(
      "the log keeps the Antigravity version and no payload data",
      text.includes('"antigravity":"1.4.2"') && SECRETS.every((secret) => !text.includes(secret)),
      SECRETS.filter((secret) => text.includes(secret)).join(", ")
    );

    fs.rmSync(box.logFile, { force: true });
    runStatusline({ ...box, env: { ...box.env, AGY_POWERLINE_LOG: "0" } }, "{not json");
    record(
      "AGY_POWERLINE_LOG=0 writes nothing, even with a broken config",
      !fs.existsSync(box.logFile)
    );

    fs.writeFileSync(
      path.join(box.installDir, "statusline.config.json"),
      '{ "log": false }',
      "utf8"
    );
    runStatusline(box, "{not json");
    record('"log": false in the config writes nothing', !fs.existsSync(box.logFile));
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true });
  }
}

function testReportCommand() {
  const box = sandbox("log-report");

  try {
    stageInstall(box.installDir);
    runStatusline(box, "{not json");
    runStatusline(box, secretPayload());

    const res = runCli(["report"], { env: box.env });
    const out = res.stdout;
    const home = os.homedir();
    let user = "";
    try {
      user = os.userInfo().username;
    } catch {
      // No passwd entry.
    }
    const personal = [home, home.replace(/\\/g, "/"), box.root, os.hostname(), ...SECRETS];
    if (user.length >= 3) {
      personal.push(user);
    }
    const found = personal.filter(
      (value) => value && out.toLowerCase().includes(value.toLowerCase())
    );

    record(
      "report has system, agy-powerline and log sections",
      res.code === 0 &&
        /### System/.test(out) &&
        /\| CPU \|/.test(out) &&
        /\| Disk \(install drive\) \|/.test(out) &&
        /### agy-powerline/.test(out) &&
        /PAYLOAD_INVALID_JSON/.test(out),
      `exit ${res.code}`
    );
    record(
      "report contains no home folder, username, hostname or payload data",
      found.length === 0,
      found.join(", ")
    );

    const target = path.join(box.root, "report.md");
    const written = runCli(["report", "--output", target], { env: box.env });
    record(
      "report --output writes the same report to a file",
      written.code === 0 && fs.readFileSync(target, "utf8").includes("## agy-powerline report")
    );

    const cleared = runCli(["report", "--clear"], { env: box.env });
    record("report --clear empties the log", cleared.code === 0 && !fs.existsSync(box.logFile));

    runStatusline(box, "{not json");
    const uninstall = runCli(["uninstall", "--yes", "--delete"], { env: box.env });
    record(
      "uninstall --delete removes the log with the other installed files",
      uninstall.code === 0 && !fs.existsSync(box.logFile)
    );
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true });
  }
}

function personalPayload() {
  return {
    ...JSON.parse(secretPayload()),
    vcs: { type: "git", branch: "feature/client-acme-123", dirty: true },
    workspace: {
      current_dir: "/home/someone/projects/client-acme/src",
      project_dir: "/home/someone/projects/client-acme",
    },
    subagents: [{ name: "research", role: "summarize client-acme contract", status: "running" }],
    conversation_title: "client-acme contract review",
    mcp_servers: ["corp-internal.host"],
    quota: {
      "gemini-5h": {
        remaining_fraction: 0.4,
        reset_in_seconds: 3600,
        reset_time: "2026-10-08T18:33:00Z",
      },
    },
  };
}

function testPayloadDump() {
  const raw = personalPayload();
  const safe = safePayload(raw);
  const text = JSON.stringify(safe);
  const leaks = [...SECRETS, "someone", "corp-internal", "contract"].filter((secret) =>
    text.includes(secret)
  );

  record(
    "the debug dump drops email, session/conversation IDs, paths, task text and server names",
    leaks.length === 0 &&
      !("email" in safe) &&
      !("session_id" in safe) &&
      !("conversation_id" in safe) &&
      !("mcp_servers" in safe),
    leaks.join(", ")
  );
  record(
    "the dump keeps only the conversation title's length",
    safe.conversation_title.length === raw.conversation_title.length &&
      safe.conversation_title.startsWith("title")
  );
  record(
    "the dump keeps only each subagent's status",
    JSON.stringify(safe.subagents) === JSON.stringify([{ status: "running" }])
  );
  record(
    "paths keep their relationship and the branch keeps its length",
    safe.workspace.project_dir === "/home/user/project" &&
      safe.workspace.current_dir === "/home/user/project/subfolder" &&
      safe.vcs.branch.length === raw.vcs.branch.length
  );
  record(
    "the dump keeps what the bar needs (model, quotas, tokens, version)",
    safe.model.display_name === raw.model.display_name &&
      safe.quota["gemini-5h"].remaining_fraction === 0.4 &&
      safe.context_window.used_percentage === raw.context_window.used_percentage &&
      safe.version === "1.4.2"
  );

  // Every widget that doesn't show a path or the branch must render the same
  // from the dump as from the real payload. ram reads live memory, so it's out.
  const skip = new Set([
    "cwd",
    "project",
    "git",
    "gitChanges",
    "gitFiles",
    "gitSha",
    "gitStash",
    "gitWorktree",
    "ram",
    "exec",
    "customText",
    "separator",
    "lineBreak",
  ]);
  const widgets = [...VALID_WIDGET_IDS].filter((id) => !skip.has(id)).map((id) => ({ id }));
  const config = { ...defaultConfig(), widgets };
  const overrides = { color: "none", env: {} };
  record(
    "a dump renders the same bar as the payload it came from",
    renderStatusline(raw, config, overrides) === renderStatusline(safe, config, overrides)
  );

  record(
    "there are no email or session ID widgets, and configs listing them skip them",
    !VALID_WIDGET_IDS.has("email") &&
      !VALID_WIDGET_IDS.has("sessionId") &&
      mergeConfig({ widgets: [{ id: "email" }, { id: "sessionId" }, { id: "model" }] }).widgets
        .length === 1
  );

  const box = sandbox("log-dump");
  try {
    stageInstall(box.installDir);
    const env = { ...box.env, AGY_POWERLINE_DEBUG: "1" };
    const dumpFile = path.join(box.installDir, "last-payload.json");

    spawnSync(NODE, [path.join(box.installDir, "statusline.js")], {
      input: JSON.stringify(raw),
      encoding: "utf8",
      env,
    });
    const dumped = fs.existsSync(dumpFile) ? fs.readFileSync(dumpFile, "utf8") : "";
    record(
      "AGY_POWERLINE_DEBUG writes the cleaned dump, not the raw payload",
      dumped.includes('"gemini-5h"') && SECRETS.every((secret) => !dumped.includes(secret)),
      SECRETS.filter((secret) => dumped.includes(secret)).join(", ")
    );

    spawnSync(NODE, [path.join(box.installDir, "statusline.js")], {
      input: '{"email": "someone@example.com", broken',
      encoding: "utf8",
      env,
    });
    const invalid = fs.readFileSync(dumpFile, "utf8");
    record(
      "an unparseable payload is recorded as invalid, never copied",
      invalid.includes('"invalid_json": true') && !invalid.includes("someone")
    );

    const cliDump = path.join(box.root, "cli-dump.json");
    runCli(["render", "--dump-payload", cliDump], { env: box.env, input: JSON.stringify(raw) });
    const cliText = fs.existsSync(cliDump) ? fs.readFileSync(cliDump, "utf8") : "";
    record(
      "render --dump-payload writes the cleaned dump too",
      cliText.includes('"gemini-5h"') && SECRETS.every((secret) => !cliText.includes(secret))
    );

    // The statusline runs in the user's project: a relative dump name lands in
    // the install dir, never next to the user's code.
    const workspace = path.join(box.root, "workspace");
    fs.mkdirSync(workspace);
    spawnSync(NODE, [path.join(box.installDir, "statusline.js")], {
      input: JSON.stringify(raw),
      encoding: "utf8",
      cwd: workspace,
      env: { ...box.env, AGY_POWERLINE_DUMP_PAYLOAD: "custom-dump.json" },
    });
    record(
      "a relative AGY_POWERLINE_DUMP_PAYLOAD file is written in the install dir",
      fs.existsSync(path.join(box.installDir, "custom-dump.json")) &&
        !fs.existsSync(path.join(workspace, "custom-dump.json"))
    );
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true });
  }
}

async function run() {
  testRedaction();
  testErrorDescription();
  testLogFile();
  testRuntime();
  testReportCommand();
  testPayloadDump();
  testBundleFrames();
}

// The installed statusline.js is the runtime files joined into one. Its line
// table must point at each file's first line, and the problem log must turn a
// line of the bundle back into the original file and line.
function testBundleFrames() {
  const bundle = buildRuntimeBundle();
  const bundleLines = bundle.split("\n");
  const table = JSON.parse(/setBundleLines\((\[.*\])\);/.exec(bundle)[1]);
  const source = (key) =>
    key === "statusline.js"
      ? path.join(ROOT, "src", "runtime", "statusline.js")
      : path.join(ROOT, "src", "lib", ...key.split("/"));
  const firstLine = (key) =>
    fs
      .readFileSync(source(key), "utf8")
      .replace(/^#!.*\n/, "")
      .split("\n")[0];
  const wrong = table.filter(([start, key]) => bundleLines[start - 1] !== firstLine(key));
  record(
    "the one-file runtime records where each runtime file starts",
    table.length === RUNTIME_FILES.length + 1 && wrong.length === 0,
    wrong.map(([, key]) => key).join(", ")
  );

  const pills = table.find(([, key]) => key === "layouts/pills.js");
  const err = new Error("boom");
  err.stack = `Error: boom\n    at buildSegment (${path.join(ROOT, "src", "statusline.js")}:${pills[0] + 41}:7)`;
  setBundleLines(table);
  const described = describeError(err);
  setBundleLines(null);
  record(
    "a crash in the one-file runtime is logged with the original file and line",
    described.frames?.[0] === "buildSegment layouts/pills.js:42",
    JSON.stringify(described.frames)
  );
}

module.exports = { run };
