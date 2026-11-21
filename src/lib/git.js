// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const { logWarning } = require("./log");
const { firstText } = require("./text-width");
const { writeFileAtomic, PRIVATE_FILE_MODE } = require("./paths");
const {
  SYNC_CACHE_NAME,
  SYNC_CACHE_MAX,
  COMMIT,
  timeouts,
  setGitTimeouts,
  parseRemoteWebUrl,
  readOriginUrl,
  isExistingAbsoluteDir,
  findGitDir,
  readText,
  pathExists,
  isSafeBranchName,
  commonGitDir,
  readRef,
  hasPlantedGitBinary,
  safeGitEnv,
  hasRiskyRepoConfig,
  syncCachePath,
  readSyncCache,
} = require("./git-common");
const {
  STATUS_CACHE_NAME,
  STATUS_TTL_MS,
  STATUS_ARGS,
  DIFF_ARGS,
  parseStatus,
  parseShortstat,
  getGitDetails,
  resolveGitDetails,
  clearGitDetailsCache,
} = require("./git-details");

const GIT_DIRTY_MARKERS = [
  "MERGE_HEAD",
  "REBASE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "BISECT_LOG",
];

function gitHasDirtyMarkers(gitDir) {
  return GIT_DIRTY_MARKERS.some((name) => {
    try {
      fs.accessSync(path.join(gitDir, name));
      return true;
    } catch {
      return false;
    }
  });
}

const STEP_MAX = 100000;

// The repo controls these files: only a plain whole number in range counts.
function readStep(file) {
  const text = readText(file);
  const n = text !== null && /^\d{1,6}$/.test(text) ? Number(text) : 0;
  return n >= 1 && n <= STEP_MAX ? n : null;
}

// What an unfinished rebase keeps, by backend: [folder, step file, total file].
const REBASE_STATES = [
  ["rebase-merge", "msgnum", "end"],
  ["rebase-apply", "next", "last"],
];

// Checked in this order after a rebase or `git am`; the first one found wins.
const OPERATION_MARKERS = [
  ["MERGE_HEAD", "merge"],
  ["CHERRY_PICK_HEAD", "cherry-pick"],
  ["REVERT_HEAD", "revert"],
  ["BISECT_LOG", "bisect"],
];

// The operation git is in the middle of in this worktree, from files only:
// { name, step, total, folder } or null. A linked worktree keeps these in its
// own git dir, which findGitDir() returns.
function readOperation(gitDir) {
  for (const [folder, stepFile, totalFile] of REBASE_STATES) {
    const dir = path.join(gitDir, folder);
    let name = folder === "rebase-merge" || pathExists(path.join(dir, "rebasing")) ? "rebase" : "";
    if (!name && pathExists(path.join(dir, "applying"))) {
      name = "am";
    }
    if (!name || !pathExists(dir)) {
      continue;
    }
    const step = readStep(path.join(dir, stepFile));
    const total = readStep(path.join(dir, totalFile));
    const counted = step !== null && total !== null;
    return { name, step: counted ? step : null, total: counted ? total : null, folder };
  }

  for (const [file, name] of OPERATION_MARKERS) {
    if (pathExists(path.join(gitDir, file))) {
      return { name, step: null, total: null, folder: "" };
    }
  }

  return null;
}

// A rebase detaches HEAD; the branch being rebased is named in head-name.
function rebasedBranch(gitDir, operation) {
  if (operation?.name !== "rebase") {
    return "";
  }
  const ref = readText(path.join(gitDir, operation.folder, "head-name")) || "";
  const branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : "";
  return isSafeBranchName(branch) ? branch : "";
}

function getGitInfo(cwd) {
  if (!cwd) {
    return null;
  }

  try {
    const gitDir = findGitDir(cwd);

    if (!gitDir) {
      return null;
    }

    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    const operation = readOperation(gitDir);
    let branch = "";

    if (head.startsWith("ref: ")) {
      branch = head.replace(/^ref:\s+refs\/heads\//, "").replace(/^ref:\s+/, "");
    } else if (head) {
      branch = rebasedBranch(gitDir, operation) || head.slice(0, 7);
    }

    if (!branch) {
      return null;
    }

    const sync = getGitSync(gitDir, branch, cwd);

    return {
      branch,
      dirty: gitHasDirtyMarkers(gitDir),
      ahead: sync.ahead,
      behind: sync.behind,
      operation: operation && {
        name: operation.name,
        step: operation.step,
        total: operation.total,
      },
    };
  } catch {
    return null;
  }
}

// The ref a branch tracks, read from .git/config ([branch "x"] remote/merge),
// or "" when it tracks nothing.
function upstreamRef(commonDir, branch) {
  let text;
  try {
    text = fs.readFileSync(path.join(commonDir, "config"), "utf8");
  } catch {
    return "";
  }

  let inSection = false;
  let remote = "";
  let merge = "";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      inSection = line === `[branch "${branch}"]`;
      continue;
    }
    if (!inSection) {
      continue;
    }
    const match = line.match(/^(remote|merge)\s*=\s*(.+)$/i);
    if (match && match[1].toLowerCase() === "remote") {
      remote = match[2].trim();
    } else if (match) {
      merge = match[2].trim();
    }
  }

  const tracked = merge.startsWith("refs/heads/") ? merge.slice("refs/heads/".length) : "";

  // Both names come from a config the repo controls and end up in a file path.
  if (!isSafeBranchName(tracked) || (remote !== "." && !isSafeBranchName(remote))) {
    return "";
  }

  // remote = . tracks another local branch.
  return remote === "." ? merge : `refs/remotes/${remote}/${tracked}`;
}

function cachedSync(file, key) {
  const value = file ? readSyncCache(file)[key] : null;
  const valid =
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => Number.isInteger(n) && n >= 0 && n <= 1e7);
  return valid ? { ahead: value[0], behind: value[1] } : null;
}

function saveSync(file, key, sync) {
  if (!file) {
    return;
  }
  try {
    // Newest last; the oldest pairs go once there are more than SYNC_CACHE_MAX.
    const cache = readSyncCache(file);
    delete cache[key];
    cache[key] = [sync.ahead, sync.behind];
    const kept = Object.fromEntries(Object.entries(cache).slice(-SYNC_CACHE_MAX));
    writeFileAtomic(file, JSON.stringify(kept), { mode: PRIVATE_FILE_MODE });
  } catch {
    // Best effort: the next refresh runs git again.
  }
}

function getGitSync(gitDir, branch, cwd) {
  if (!gitDir || !isSafeBranchName(branch)) {
    return { ahead: 0, behind: 0 };
  }

  try {
    cwd = cwd || path.dirname(gitDir);
    const commonDir = commonGitDir(gitDir);
    if (hasRiskyRepoConfig(gitDir, commonDir)) {
      logWarning("GIT_CONFIG_SKIPPED");
      return { ahead: 0, behind: 0 };
    }
    if (process.platform === "win32" && hasPlantedGitBinary(cwd)) {
      return { ahead: 0, behind: 0 };
    }

    const localHash = readRef(commonDir, `refs/heads/${branch}`);
    const upstream = upstreamRef(commonDir, branch);

    // No commit yet, or nothing tracked: nothing to count and no git to start.
    if (!localHash || !upstream) {
      return { ahead: 0, behind: 0 };
    }

    const upstreamHash = readRef(commonDir, upstream);
    if (upstreamHash === localHash) {
      return { ahead: 0, behind: 0 };
    }

    const key =
      COMMIT.test(localHash) && COMMIT.test(upstreamHash) ? `${localHash}..${upstreamHash}` : "";
    const cacheFile = key ? syncCachePath() : null;
    const cached = cachedSync(cacheFile, key);
    if (cached) {
      return cached;
    }

    const { execFileSync } = require("child_process");
    const out = execFileSync(
      "git",
      // The branch's own upstream: during a rebase HEAD is detached and has none.
      [
        "-c",
        "protocol.allow=never",
        "rev-list",
        "--left-right",
        "--count",
        `${branch}...${branch}@{upstream}`,
        "--",
      ],
      {
        cwd,
        timeout: timeouts.sync,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
        // Antigravity may run the statusline without a console; without this,
        // Windows flashes a window for every git call.
        windowsHide: true,
        env: safeGitEnv(),
      }
    ).trim();

    const parts = out.split(/\s+/);
    if (parts.length >= 2) {
      const sync = {
        ahead: parseInt(parts[0], 10) || 0,
        behind: parseInt(parts[1], 10) || 0,
      };
      saveSync(cacheFile, key, sync);
      return sync;
    }
  } catch (err) {
    // A timeout or missing git is worth knowing about when ahead/behind
    // counts never show.
    if (err.code === "ETIMEDOUT" || err.signal === "SIGTERM") {
      logWarning("GIT_TIMEOUT", { timeoutMs: timeouts.sync });
    } else if (err.code === "ENOENT") {
      logWarning("GIT_NOT_FOUND");
    }
  }

  return { ahead: 0, behind: 0 };
}

// The bar uses vcs.branch and vcs.dirty from Antigravity's payload. Ahead and
// behind are not in it; they come from the local repository.
function findHgBranch(cwd) {
  if (!isExistingAbsoluteDir(cwd)) {
    return null;
  }

  let dir = cwd;

  for (let i = 0; i < 24; i++) {
    const hgDir = path.join(dir, ".hg");

    try {
      if (fs.statSync(hgDir).isDirectory()) {
        try {
          return firstText(fs.readFileSync(path.join(hgDir, "branch"), "utf8").trim()) || "default";
        } catch {
          return "default";
        }
      }
    } catch {
      // Keep walking up.
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }

  return null;
}

function vcsFromPayload(data) {
  const vcs = data?.vcs;

  if (!vcs || typeof vcs !== "object") {
    return null;
  }

  return { branch: firstText(vcs.branch), dirty: vcs.dirty === true };
}

function resolveGit(data, config) {
  const wantsGit =
    config?.layout === "lines" || config?.widgets?.some((widget) => widget.id === "git");

  if (!wantsGit) {
    return null;
  }

  const fromPayload = vcsFromPayload(data);
  const cwd = firstText(data.cwd, data.workspace?.current_dir);
  const local = getGitInfo(cwd);

  if (fromPayload?.branch) {
    // Counts from the local repo only describe the payload's branch if it is
    // the one checked out there.
    const same = local?.branch === fromPayload.branch;
    return {
      ...fromPayload,
      ahead: same ? local.ahead : 0,
      behind: same ? local.behind : 0,
      operation: same ? local.operation : null,
    };
  }

  if (local) {
    return {
      branch: local.branch,
      dirty: Boolean(local.dirty || fromPayload?.dirty),
      ahead: local.ahead,
      behind: local.behind,
      operation: local.operation,
    };
  }

  if (data?.vcs?.type === "hg") {
    const branch = findHgBranch(cwd);
    if (branch) {
      return {
        branch,
        dirty: Boolean(fromPayload?.dirty),
        ahead: 0,
        behind: 0,
        operation: null,
      };
    }
  }

  // No branch from the payload or the folder: nothing to show.
  return null;
}

module.exports = {
  findGitDir,
  getGitInfo,
  readOperation,
  getGitSync,
  isSafeBranchName,
  GIT_DIRTY_MARKERS,
  gitHasDirtyMarkers,
  vcsFromPayload,
  resolveGit,
  SYNC_CACHE_NAME,
  STATUS_CACHE_NAME,
  STATUS_TTL_MS,
  STATUS_ARGS,
  DIFF_ARGS,
  hasRiskyRepoConfig,
  hasPlantedGitBinary,
  parseRemoteWebUrl,
  readOriginUrl,
  parseStatus,
  parseShortstat,
  getGitDetails,
  resolveGitDetails,
  clearGitDetailsCache,
  setGitTimeouts,
};
