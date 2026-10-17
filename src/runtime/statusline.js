#!/usr/bin/env node
"use strict";

const path = require("path");
const { readConfigFile, renderStatusline } = require("./shared");
const { isTrustedInstallDir } = require("./paths");
const { dumpTarget, writePayloadDump } = require("./payload-dump");
const {
  isLogEnabled,
  setLogDir,
  setLogContext,
  jsonErrorMessage,
  redact,
  logError,
  logWarning,
} = require("./log");

// A refresh slower than this is worth a line in the problem log.
const SLOW_RENDER_MS = 750;

// Antigravity can start the command and keep stdin open without writing to it
// (google-antigravity/antigravity-cli#698). A blocking read would wait until
// Antigravity kills the script, and a few kills in a row turn the custom
// statusline off, so the read gives up after this long.
const STDIN_TIMEOUT_MS = 1000;

// The config decides whether problems are logged, so it is read first. A
// broken config can't say, so logging stays on (AGY_POWERLINE_LOG=0 still
// turns it off).
const { config, error: configError } = readConfigFile();
setLogDir(__dirname, isLogEnabled(configError ? null : config));

// Antigravity can close the pipe before the statusline finishes writing. That
// is a normal shutdown, so don't treat EPIPE as a runtime crash.
process.stdout.on("error", (err) => {
  if (err?.code === "EPIPE") {
    process.exit(0);
  }

  logError("RUNTIME_CRASH", err);
  process.stderr.write(`[agy-powerline] ${redact(err?.message || err)}\n`);
  process.exit(0);
});

// A crash must not leave a stack trace in Antigravity's status bar.
process.on("uncaughtException", (err) => {
  logError("RUNTIME_CRASH", err);
  // The message can quote payload text; redact also strips escape sequences.
  process.stderr.write(`[agy-powerline] ${redact(err?.message || err)}\n`);
  process.stdout.write("\x1b[31m[agy-powerline: error, see agy-powerline.log]\x1b[0m\n");
  process.exit(0);
});

// Resolves with what stdin sent and whether it closed before the deadline.
function readStdin(timeoutMs) {
  return new Promise((resolve) => {
    const chunks = [];
    let done = false;
    const finish = (complete) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // An open stdin would keep the process alive after the bar is printed.
      process.stdin.destroy();
      resolve({ text: Buffer.concat(chunks).toString("utf8"), complete });
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => finish(true));
    process.stdin.on("error", () => finish(true));
  });
}

readStdin(STDIN_TIMEOUT_MS).then(({ text, complete }) => {
  render(text.replace(/^\uFEFF/, "").trim(), complete);
});

function render(input, complete) {
  if (!input) {
    if (!complete) {
      logWarning("STDIN_TIMEOUT", { ms: STDIN_TIMEOUT_MS });
    }
    process.exit(0);
  }

  // Debug dumps keep only the fields the bar renders, never personal ones.
  const dumpPath =
    dumpTarget(process.env.AGY_POWERLINE_DUMP_PAYLOAD, __dirname) ||
    (process.env.AGY_POWERLINE_DEBUG ? path.join(__dirname, "last-payload.json") : null);
  if (dumpPath) {
    writePayloadDump(dumpPath, input);
  }

  let data;

  try {
    data = JSON.parse(input);
  } catch (err) {
    // Stdin was cut off by the deadline: nothing worth showing.
    if (!complete) {
      logWarning("STDIN_TIMEOUT", { ms: STDIN_TIMEOUT_MS });
      process.exit(0);
    }
    logWarning("PAYLOAD_INVALID_JSON", { message: jsonErrorMessage(err.message) });
    // Node's message quotes the bad input; only say where it broke.
    process.stderr.write(`[agy-powerline] ${jsonErrorMessage(err.message)} on stdin\n`);
    process.stdout.write("\x1b[31m[agy-powerline: invalid JSON]\x1b[0m\n");
    process.exit(0);
  }

  // The one payload value the log keeps: Antigravity's version number.
  if (typeof data?.version === "string" && /^\d[\w.+-]{0,30}$/.test(data.version)) {
    setLogContext({ antigravity: data.version });
  }

  // The config lives next to this script. A copy anywhere other than the
  // global install or AGY_POWERLINE_HOME (e.g. committed inside a repo) may be
  // edited by someone else, so its exec widgets stay off.
  const exec = isTrustedInstallDir(__dirname) ? "run" : "blocked";

  if (configError) {
    logWarning("CONFIG_INVALID", {
      message: /JSON/.test(configError) ? jsonErrorMessage(configError) : redact(configError),
    });
    process.stderr.write(`[agy-powerline] invalid statusline.config.json: ${configError}\n`);
  }

  const started = Date.now();
  const output = renderStatusline(data, config, { exec, configError });
  const elapsed = Date.now() - started;

  if (elapsed > SLOW_RENDER_MS) {
    logWarning("SLOW_RENDER", { ms: elapsed, widgets: config.widgets.map((widget) => widget.id) });
  }

  process.stdout.write(output);
}
