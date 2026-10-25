// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record } = require("../helpers");
const { dumpTarget, safePayload, writePayloadDump } = require("../../src/lib/payload-dump");

const HOME_KEYS = ["HOME", "USERPROFILE", "AGY_POWERLINE_HOME"];

function withSandbox(name, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `agy-payload-dump-${name}-`));
  const home = path.join(root, "home");
  const installDir = path.join(home, ".agy-powerline");
  fs.mkdirSync(installDir, { recursive: true });

  const previous = Object.fromEntries(HOME_KEYS.map((key) => [key, process.env[key]]));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.AGY_POWERLINE_HOME = installDir;

  try {
    run({ root, home, installDir });
  } finally {
    for (const key of HOME_KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testWrongTypes() {
  const payload = safePayload({
    quota: "not an object",
    model: [],
    workspace: [],
    context_window: [],
    cwd: 42,
    vcs: { type: false, branch: 42, dirty: "false" },
    conversation_title: 42,
  });

  record(
    "wrong-typed quota, nested objects, paths, branches and titles are dropped",
    !("quota" in payload) &&
      !("model" in payload) &&
      !("workspace" in payload) &&
      !("context_window" in payload) &&
      !("cwd" in payload) &&
      Object.keys(payload.vcs || {}).length === 0 &&
      !("conversation_title" in payload),
    JSON.stringify(payload)
  );
}

function testDumpTarget() {
  const installDir = path.join(os.tmpdir(), "agy-payload-dump-target");
  record(
    "relative dump paths resolve from the install directory",
    dumpTarget("nested/payload.json", installDir) ===
      path.resolve(installDir, "nested", "payload.json")
  );
  record(
    "empty and non-string dump paths are disabled",
    dumpTarget("", installDir) === null &&
      dumpTarget(" \t\n", installDir) === null &&
      dumpTarget(null, installDir) === null
  );
}

function testPrivatePayloadDump() {
  withSandbox("privacy", ({ installDir }) => {
    const file = path.join(installDir, "payload.json");
    const privateValues = ["email-private-value", "session-private", "conversation-private"];
    const raw = JSON.stringify({
      email: privateValues[0],
      session_id: privateValues[1],
      conversation_id: privateValues[2],
      extra: { email: privateValues[0], session_id: privateValues[1] },
      model: { id: "model-id", display_name: "Model", conversation_id: privateValues[2] },
      workspace: {
        current_dir: "/home/person/project",
        project_dir: "/home/person/project",
        unexpected: { session_id: privateValues[1] },
      },
      context_window: {
        current_usage: { input_tokens: 10, email: privateValues[0] },
        unexpected: { conversation_id: privateValues[2] },
      },
      quota: { main: { remaining_fraction: 0.5, session_id: privateValues[1] } },
      subagents: [{ status: "running", name: "private agent", conversation_id: privateValues[2] }],
    });

    writePayloadDump(file, raw);

    const dumped = fs.readFileSync(file, "utf8");
    record(
      "payload dumps exclude email and session or conversation ids, including nested fields",
      privateValues.every((value) => !dumped.includes(value)) &&
        !/"(?:email|session_id|conversation_id)"\s*:/.test(dumped),
      dumped
    );
  });
}

function testInvalidJsonDump() {
  withSandbox("invalid-json", ({ installDir }) => {
    const withPosition = path.join(installDir, "invalid-with-position.json");
    const rawWithPosition = '{"email":"email-private-marker","value":"x",}';
    writePayloadDump(withPosition, rawWithPosition);

    const positionedText = fs.readFileSync(withPosition, "utf8");
    const positioned = JSON.parse(positionedText);
    record(
      "invalid JSON records only the invalid flag and an available parse position",
      positioned.invalid_json === true &&
        Number.isInteger(positioned.position) &&
        Object.keys(positioned).sort().join(",") === "invalid_json,position" &&
        !positionedText.includes("email-private-marker")
    );

    const withoutPosition = path.join(installDir, "invalid-without-position.json");
    const rawWithoutPosition = "";
    writePayloadDump(withoutPosition, rawWithoutPosition);

    const unpositioned = JSON.parse(fs.readFileSync(withoutPosition, "utf8"));
    record(
      "invalid JSON without a parse position writes only the invalid flag",
      unpositioned.invalid_json === true &&
        !("position" in unpositioned) &&
        Object.keys(unpositioned).join(",") === "invalid_json",
      JSON.stringify(unpositioned)
    );
  });
}

function testFailedWrite() {
  withSandbox("write-failure", ({ root }) => {
    const blocker = path.join(root, "not-a-directory");
    fs.writeFileSync(blocker, "file blocks the parent directory");

    let threw = false;
    try {
      writePayloadDump(path.join(blocker, "payload.json"), "{}");
    } catch {
      threw = true;
    }

    record("a failed payload dump write does not throw", !threw);
  });
}

async function run() {
  testWrongTypes();
  testDumpTarget();
  testPrivatePayloadDump();
  testInvalidJsonDump();
  testFailedWrite();
}

module.exports = { run };
