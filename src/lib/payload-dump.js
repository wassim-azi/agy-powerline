// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Debug payload dumps (AGY_POWERLINE_DEBUG / --dump-payload). Instead of a raw
// copy of what Antigravity sends, the dump keeps only the fields agy-powerline
// renders, so it can be attached to an issue or turned into a test fixture
// as-is. Email, session and conversation IDs are never written; paths and
// branch names become placeholders. A field Antigravity adds later is left
// out until it is listed here.

const path = require("path");
const { stripControl } = require("./formatters");
const { writeFileAtomic, PRIVATE_FILE_MODE } = require("./paths");

const NUMBER = "number";
const BOOL = "boolean";
const TEXT = "text";
const TIME = "time";
const PATH = "path";
const BRANCH = "branch";
const TITLE = "title";

const QUOTA = {
  remaining_fraction: NUMBER,
  reset_time: TIME,
  reset_in_seconds: NUMBER,
  disabled: BOOL,
};
const VCS = { type: TEXT, branch: BRANCH, dirty: BOOL };

const SCHEMA = {
  model: { id: TEXT, display_name: TEXT },
  version: TEXT,
  product: TEXT,
  agent_state: TEXT,
  plan_tier: TEXT,
  cwd: PATH,
  workspace: { current_dir: PATH, project_dir: PATH },
  context_window: {
    total_input_tokens: NUMBER,
    total_output_tokens: NUMBER,
    context_window_size: NUMBER,
    used_percentage: NUMBER,
    remaining_percentage: NUMBER,
    current_usage: {
      input_tokens: NUMBER,
      output_tokens: NUMBER,
      cache_creation_input_tokens: NUMBER,
      cache_read_input_tokens: NUMBER,
    },
  },
  exceeds_200k_tokens: BOOL,
  quota: "quota",
  vcs: VCS,
  sandbox: { enabled: BOOL, allow_network: BOOL },
  artifact_count: NUMBER,
  subagents: "subagents",
  task_count: NUMBER,
  cycle_mode: TEXT,
  vim: { mode: TEXT },
  conversation_title: TITLE,
  terminal_width: NUMBER,
};

// Paths keep their relationship (same folder, subfolder, elsewhere) but none
// of their names.
function pathPlaceholder(value, seen) {
  const key = String(value);
  if (!seen.has(key)) {
    const project = seen.get("__project");
    let placeholder = "/home/user/project";
    if (project && key !== project) {
      const inside = key.startsWith(project + "/") || key.startsWith(project + "\\");
      placeholder = inside ? "/home/user/project/subfolder" : "/home/user/other";
    }
    seen.set(key, placeholder);
  }
  return seen.get(key);
}

// Branch names can hold ticket numbers or client names; the placeholder keeps
// the length, which matters for width bugs.
function branchPlaceholder(value) {
  const length = Math.min(100, Math.max(6, String(value).length));
  return "branch" + "x".repeat(length - 6);
}

function pick(value, rule, seen) {
  if (value == null) {
    return undefined;
  }

  if (rule === NUMBER) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }
  if (rule === BOOL) {
    return typeof value === "boolean" ? value : undefined;
  }
  if (rule === TEXT) {
    return typeof value === "string" ? stripControl(value).slice(0, 80) : undefined;
  }
  if (rule === TIME) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
  }
  if (rule === PATH) {
    return typeof value === "string" && value ? pathPlaceholder(value, seen) : undefined;
  }
  if (rule === BRANCH) {
    return typeof value === "string" && value ? branchPlaceholder(value) : undefined;
  }
  if (rule === TITLE) {
    // A title can name the user's work; the placeholder keeps its length.
    return typeof value === "string" && value
      ? "title" + "x".repeat(Math.max(0, Math.min(200, value.length) - 5))
      : undefined;
  }
  if (rule === "subagents") {
    // Only the status: a subagent's name and role describe the user's work.
    return Array.isArray(value)
      ? value.slice(0, 50).map((agent) => pick(agent, { status: TEXT }, seen) || {})
      : undefined;
  }
  if (rule === "quota") {
    if (typeof value !== "object") {
      return undefined;
    }
    const out = {};
    for (const [key, quota] of Object.entries(value)) {
      if (/^[\w.-]{1,40}$/.test(key)) {
        out[key] = pick(quota, QUOTA, seen);
      }
    }
    return out;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const out = {};
  for (const [key, child] of Object.entries(rule)) {
    const picked = pick(value[key], child, seen);
    if (picked !== undefined) {
      out[key] = picked;
    }
  }
  return out;
}

function safePayload(data) {
  const seen = new Map();
  // The project folder anchors the other path placeholders.
  const project = data?.workspace?.project_dir;
  if (typeof project === "string" && project) {
    seen.set("__project", project);
  }
  return pick(data, SCHEMA, seen) || {};
}

// AGY_POWERLINE_DUMP_PAYLOAD names the dump file. The statusline runs in the
// user's project folder, so a relative name resolves in the install dir
// instead, never next to the user's code.
function dumpTarget(value, installDir) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return path.resolve(installDir, value.trim());
}

// Writes the dump for the raw stdin text. Unparseable input is recorded as
// such (with the position only), never copied.
function writePayloadDump(target, rawInput) {
  let body;
  try {
    body = safePayload(JSON.parse(rawInput));
  } catch (err) {
    const position = /position (\d+)/i.exec(String(err.message));
    body = { invalid_json: true, position: position ? Number(position[1]) : undefined };
  }

  try {
    writeFileAtomic(path.resolve(target), JSON.stringify(body, null, 2) + "\n", {
      mode: PRIVATE_FILE_MODE,
    });
  } catch {
    // Best-effort debug write; the bar matters more.
  }
}

module.exports = {
  dumpTarget,
  safePayload,
  writePayloadDump,
};
