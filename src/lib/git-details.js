// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const { logWarning } = require("./log");
const { firstText } = require("./text-width");
const { writeFileAtomic, PRIVATE_FILE_MODE } = require("./paths");
const {
  timeouts,
  readOriginUrl,
  findGitDir,
  commonGitDir,
  readHead,
  hasPlantedGitBinary,
  safeGitEnv,
  hasRiskyRepoConfig,
  syncCachePath,
  readSyncCache,
} = require("./git-common");

// Working-tree details for the gitChanges, gitFiles, gitSha, gitStash and
// gitWorktree widgets. SHA, stash and worktree come from files; file and line
// counts need `git status` / `git diff`, so those run only for the widgets
// that show them and are reused for STATUS_TTL_MS per repo and commit.
const DETAIL_NEEDS = {
  gitChanges: "diff",
  gitFiles: "status",
  gitSha: "sha",
  gitStash: "stash",
  gitWorktree: "worktree",
};
const STATUS_CACHE_NAME = ".git-status-cache.json";
const STATUS_CACHE_MAX = 20;
const STATUS_TTL_MS = 5000;

// No optional locks: the bar must never hold the index lock and make the
// user's own git commands fail. The -c flags and the submodule skip keep git
// from starting programs named in the repo's own config.
const STATUS_ARGS = [
  "--no-optional-locks",
  "-c",
  "protocol.allow=never",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
  "status",
  "--porcelain=v2",
  "-z",
  "--ignore-submodules=all",
];
const DIFF_ARGS = [
  "--no-optional-locks",
  "-c",
  "protocol.allow=never",
  "-c",
  "core.fsmonitor=false",
  "diff",
  "--shortstat",
  "--no-ext-diff",
  "--no-textconv",
  "--ignore-submodules=all",
  "HEAD",
  "--",
];

const statusMemory = new Map();

// One line per stash in the stash reflog.
function stashCount(commonDir) {
  try {
    const text = fs.readFileSync(path.join(commonDir, "logs", "refs", "stash"), "utf8");
    return Math.min(text.split("\n").filter((line) => line.trim()).length, 99999);
  } catch {
    return 0;
  }
}

// A linked worktree's git dir is <main>/.git/worktrees/<name>.
function worktreeName(gitDir, commonDir) {
  if (gitDir === commonDir || path.basename(path.dirname(gitDir)) !== "worktrees") {
    return "";
  }
  return path.basename(gitDir);
}

// Porcelain v2 with -z: "1 XY ..." and "2 XY ..." (a rename, followed by its
// old path as its own entry), "u XY ..." for conflicts, "? path" for untracked.
function parseStatus(out) {
  const files = { staged: 0, modified: 0, untracked: 0, conflicts: 0 };
  const entries = String(out).split("\0");
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const kind = entry[0];
    if (kind === "1" || kind === "2") {
      if (entry[2] !== ".") files.staged++;
      if (entry[3] !== ".") files.modified++;
      if (kind === "2") i++;
    } else if (kind === "u") {
      files.conflicts++;
    } else if (kind === "?") {
      files.untracked++;
    }
  }
  return files;
}

// " 3 files changed, 128 insertions(+), 34 deletions(-)"; nothing when clean.
function parseShortstat(out) {
  const text = String(out);
  const number = (pattern) => parseInt(text.match(pattern)?.[1] ?? "0", 10) || 0;
  return { added: number(/(\d+) insertions?\(\+\)/), removed: number(/(\d+) deletions?\(-\)/) };
}

function runGitDetail(cwd, args) {
  try {
    const { execFileSync } = require("child_process");
    return execFileSync("git", args, {
      cwd,
      timeout: timeouts.detail,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      env: safeGitEnv(),
    });
  } catch (err) {
    if (err.code === "ETIMEDOUT" || err.signal === "SIGTERM") {
      logWarning("GIT_TIMEOUT", { timeoutMs: timeouts.detail });
    } else if (err.code === "ENOENT") {
      logWarning("GIT_NOT_FOUND");
    }
    return null;
  }
}

function statusCachePath() {
  const sync = syncCachePath();
  return sync ? path.join(path.dirname(sync), STATUS_CACHE_NAME) : null;
}

const DETAIL_FIELDS = {
  files: ["staged", "modified", "untracked", "conflicts"],
  changes: ["added", "removed"],
};

// The cache file can be edited or torn like any file; only whole counts count.
function validDetail(field, cached) {
  const v = cached?.v;
  return (
    typeof cached?.t === "number" &&
    v !== null &&
    typeof v === "object" &&
    DETAIL_FIELDS[field].every(
      (name) => Number.isInteger(v[name]) && v[name] >= 0 && v[name] <= 1e9
    )
  );
}

// A fresh entry is used as is; when git fails, an older one for the same repo
// and commit is still better than nothing.
function cachedDetail(key, field, compute) {
  const now = Date.now();
  const file = statusCachePath();
  let entry = statusMemory.get(key);
  if (!entry?.[field] && file) {
    entry = readSyncCache(file)[key];
  }
  const cached = validDetail(field, entry?.[field]) ? entry[field] : null;
  if (cached && now - cached.t < STATUS_TTL_MS) {
    return cached.v;
  }

  const value = compute();
  if (value === null) {
    return cached?.v ?? null;
  }

  const previous = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const next = { ...previous, [field]: { t: now, v: value } };
  statusMemory.set(key, next);
  if (file) {
    try {
      const cache = readSyncCache(file);
      delete cache[key];
      cache[key] = next;
      const kept = Object.fromEntries(Object.entries(cache).slice(-STATUS_CACHE_MAX));
      writeFileAtomic(file, JSON.stringify(kept), { mode: PRIVATE_FILE_MODE });
    } catch {
      // Best effort: the next refresh runs git again.
    }
  }
  return value;
}

function getGitDetails(cwd, needs = {}) {
  try {
    const gitDir = findGitDir(cwd);
    if (!gitDir) {
      return null;
    }
    const commonDir = commonGitDir(gitDir);
    const { branch, commit, detached } = readHead(gitDir, commonDir);
    const details = { branch };

    if (needs.remote) {
      details.detached = detached;
      details.remoteUrl = readOriginUrl(commonDir);
    }
    if (needs.sha) {
      details.sha = commit.slice(0, 7);
    }
    if (needs.stash) {
      details.stash = stashCount(commonDir);
    }
    if (needs.worktree) {
      details.worktree = worktreeName(gitDir, commonDir);
    }

    const wantsGit = needs.status || (needs.diff && commit);
    if (wantsGit && hasRiskyRepoConfig(gitDir, commonDir)) {
      logWarning("GIT_CONFIG_SKIPPED");
      return details;
    }
    if (wantsGit && process.platform === "win32" && hasPlantedGitBinary(cwd)) {
      return details;
    }

    const key = `${gitDir}\0${commit || "unborn"}`;
    if (needs.status) {
      details.files = cachedDetail(key, "files", () => {
        const out = runGitDetail(cwd, STATUS_ARGS);
        return out === null ? null : parseStatus(out);
      });
    }
    if (needs.diff && commit) {
      details.changes = cachedDetail(key, "changes", () => {
        const out = runGitDetail(cwd, DIFF_ARGS);
        return out === null ? null : parseShortstat(out);
      });
    }
    return details;
  } catch {
    return null;
  }
}

// Only what the configured widgets show is read.
function resolveGitDetails(data, config) {
  const needs = {};
  for (const widget of config?.widgets ?? []) {
    if (DETAIL_NEEDS[widget?.id]) {
      needs[DETAIL_NEEDS[widget.id]] = true;
    }
    if ((widget?.id === "git" || widget?.id === "gitSha") && widget.link === true) {
      needs.remote = true;
      if (widget.id === "gitSha") {
        needs.sha = true;
      }
    }
  }
  if (!Object.keys(needs).length) {
    return null;
  }
  return getGitDetails(firstText(data?.cwd, data?.workspace?.current_dir), needs);
}

function clearGitDetailsCache() {
  statusMemory.clear();
}

module.exports = {
  STATUS_CACHE_NAME,
  STATUS_TTL_MS,
  STATUS_ARGS,
  DIFF_ARGS,
  parseStatus,
  parseShortstat,
  getGitDetails,
  resolveGitDetails,
  clearGitDetailsCache,
};
