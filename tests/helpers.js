"use strict";

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { toPosixPath } = require("../src/lib/paths");
const { buildRuntimeBundle } = require("../src/cli/bundle");

const ROOT = path.join(__dirname, "..");
const RUNTIME_JS = path.join(ROOT, "src", "runtime", "statusline.js");
const SHARED_JS = path.join(ROOT, "src", "lib", "shared.js");
const NODE = process.execPath;

const PAYLOAD = JSON.stringify({
  model: { display_name: "Gemini 3.8 Flash (High)" },
  workspace: { current_dir: "C:/Projects/agy-powerline", project_dir: "C:/Projects/agy-powerline" },
  cwd: "C:/Projects/agy-powerline",
  agent_state: "idle",
  context_window: { used_percentage: 12, current_usage: { input_tokens: 1, output_tokens: 1 } },
  vcs: { type: "git", branch: "main", dirty: false },
  quota: {
    "gemini-5h": { remaining_fraction: 0.8, reset_time: "2026-10-06T18:00:00Z" },
    "gemini-weekly": { remaining_fraction: 0.5, reset_time: "2026-10-13T08:00:00Z" },
  },
  terminal_width: 100,
});

// Suites report checks through record(); tests/register.js turns each one
// into a node:test subtest, so the reporter shows them and failures fail the run.
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: detail || "" });
}

// Returns and clears the checks recorded since the last call.
function takeResults() {
  return results.splice(0, results.length);
}

function spawnCapture(file, args, input, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const child = spawn(file, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill();
      resolve({ code: -1, stdout, stderr: stderr + "\n[timeout]" });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: String(err.message) });
    });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function looksRendered(stdout) {
  return (
    typeof stdout === "string" &&
    stdout.length > 0 &&
    /Gemini/.test(stdout) &&
    !/not recognized as an internal or external command/i.test(stdout)
  );
}

// Installs the runtime the way init does: one statusline.js built from the
// runtime files.
function stageInstall(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "statusline.js"), buildRuntimeBundle(), "utf8");
  fs.writeFileSync(
    path.join(dir, "statusline.config.json"),
    JSON.stringify({ layout: "lines", emojis: true, widgets: [{ id: "model" }] }, null, 2),
    "utf8"
  );
  return dir;
}

function runCli(args, options = {}) {
  const result = spawnSync(NODE, [path.join(ROOT, "src", "index.js"), ...args], {
    windowsHide: true,
    timeout: 60000,
    encoding: "utf8",
    cwd: options.cwd || ROOT,
    env: options.env || process.env,
    input: options.input,
  });
  return {
    code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || (result.error ? String(result.error) : ""),
  };
}

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, "");
}

function toWslPath(windowsPath) {
  const posix = toPosixPath(windowsPath);
  const match = posix.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) return posix;
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

function which(file) {
  try {
    const result = spawnSync(file, ["-c", "exit 0"], { windowsHide: true, timeout: 5000 });
    return result.error ? null : file;
  } catch {
    return null;
  }
}

function findGitSh() {
  if (process.platform !== "win32") {
    return "/bin/sh";
  }
  const candidates = [
    "C:/Program Files/Git/usr/bin/sh.exe",
    "C:/Program Files/Git/bin/bash.exe",
    "C:/Program Files (x86)/Git/usr/bin/sh.exe",
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

module.exports = {
  ROOT,
  RUNTIME_JS,
  SHARED_JS,
  NODE,
  PAYLOAD,
  record,
  takeResults,
  spawnCapture,
  looksRendered,
  stageInstall,
  runCli,
  stripAnsi,
  toWslPath,
  which,
  findGitSh,
};
