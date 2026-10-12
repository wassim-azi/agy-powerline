"use strict";

const fs = require("fs");
const path = require("path");
const { logWarning } = require("./log");
const { firstText } = require("./formatters");
const { writeFileAtomic, PRIVATE_FILE_MODE } = require("./paths");

// Ahead/behind counts depend only on the two commits compared, so they are
// kept per commit pair: git runs again only when the branch or its upstream
// moves. Starting git costs ~60 ms on Windows, on every refresh otherwise.
const SYNC_CACHE_NAME = ".git-sync-cache.json";
const SYNC_CACHE_MAX = 20;
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

// Only an absolute folder that exists can belong to the user's session. A
// relative path (a Windows path read on Linux, for one) resolves against
// wherever this process runs, and the upward walk would then report that
// checkout's branch instead of nothing.
function isExistingAbsoluteDir(dir) {
  if (typeof dir !== "string" || !path.isAbsolute(dir)) {
    return false;
  }

  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function findGitDir(cwd) {
  if (!isExistingAbsoluteDir(cwd)) {
    return null;
  }

  let dir = cwd;

  for (let i = 0; i < 24; i++) {
    const gitPath = path.join(dir, ".git");

    try {
      const stat = fs.statSync(gitPath);

      if (stat.isDirectory()) {
        return gitPath;
      }

      if (stat.isFile()) {
        const text = fs.readFileSync(gitPath, "utf8");
        const match = text.match(/^gitdir:\s*(.+)$/m);

        if (match) {
          return path.resolve(dir, match[1].trim());
        }
      }
    } catch {
      // Keep walking up.
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  return null;
}

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
    let branch = "";

    if (head.startsWith("ref: ")) {
      branch = head.replace(/^ref:\s+refs\/heads\//, "").replace(/^ref:\s+/, "");
    } else if (head) {
      branch = head.slice(0, 7);
    }

    if (!branch) {
      return null;
    }

    const sync = getGitSync(gitDir, branch);

    return {
      branch,
      dirty: gitHasDirtyMarkers(gitDir),
      ahead: sync.ahead,
      behind: sync.behind,
    };
  } catch {
    return null;
  }
}

// The branch name comes from .git/HEAD, which a repo shipped as an archive
// fully controls. Reject anything git itself would refuse as a ref name, so
// it can neither be parsed as a git option ("-...") nor walk out of refs/
// ("..") when used as a path.
function isSafeBranchName(branch) {
  return (
    typeof branch === "string" &&
    branch.length > 0 &&
    branch.length <= 255 &&
    !branch.startsWith("-") &&
    !branch.startsWith("/") &&
    !branch.endsWith("/") &&
    !branch.endsWith(".") &&
    !branch.endsWith(".lock") &&
    !branch.includes("..") &&
    !branch.includes("//") &&
    !branch.includes("@{") &&
    !/[\x00-\x20\x7f~^:?*[\\]/.test(branch) &&
    !branch.split("/").some((part) => part.startsWith("."))
  );
}

// A linked worktree keeps HEAD in its own folder but refs and config in the
// main repository, named by its "commondir" file.
function commonGitDir(gitDir) {
  try {
    const common = fs.readFileSync(path.join(gitDir, "commondir"), "utf8").trim();
    return common ? path.resolve(gitDir, common) : gitDir;
  } catch {
    return gitDir;
  }
}

// Refs are loose files until `git gc` packs them into packed-refs.
function readRef(commonDir, ref) {
  try {
    return fs.readFileSync(path.join(commonDir, ref), "utf8").trim();
  } catch {
    // Not loose: look in packed-refs.
  }

  try {
    const packed = fs.readFileSync(path.join(commonDir, "packed-refs"), "utf8");
    for (const line of packed.split(/\r?\n/)) {
      const [hash, name] = line.trim().split(" ");
      if (name === ref) {
        return hash;
      }
    }
  } catch {
    // No packed-refs either.
  }

  return "";
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

// Only next to a real install's config (like the exec cache); CLI previews
// and other copies don't write it.
function syncCachePath() {
  try {
    const { getConfigDir } = require("./config");
    const dir = getConfigDir();
    return dir && fs.existsSync(path.join(dir, "statusline.config.json"))
      ? path.join(dir, SYNC_CACHE_NAME)
      : null;
  } catch {
    return null;
  }
}

function readSyncCache(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
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

function getGitSync(gitDir, branch) {
  if (!gitDir || !isSafeBranchName(branch)) {
    return { ahead: 0, behind: 0 };
  }

  try {
    const commonDir = commonGitDir(gitDir);
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
      ["rev-list", "--left-right", "--count", `${branch}...@{upstream}`, "--"],
      {
        cwd: path.dirname(gitDir),
        timeout: 150,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
        // Antigravity may run the statusline without a console; without this,
        // Windows flashes a window for every git call.
        windowsHide: true,
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
      logWarning("GIT_TIMEOUT", { timeoutMs: 150 });
    } else if (err.code === "ENOENT") {
      logWarning("GIT_NOT_FOUND");
    }
  }

  return { ahead: 0, behind: 0 };
}

// The bar uses vcs.branch and vcs.dirty from Antigravity's payload. Ahead and
// behind are not in it; they come from the local repository.
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
  const local = getGitInfo(firstText(data.cwd, data.workspace?.current_dir));

  if (fromPayload?.branch) {
    // Counts from the local repo only describe the payload's branch if it is
    // the one checked out there.
    const same = local?.branch === fromPayload.branch;
    return {
      ...fromPayload,
      ahead: same ? local.ahead : 0,
      behind: same ? local.behind : 0,
    };
  }

  if (local) {
    return {
      branch: local.branch,
      dirty: Boolean(local.dirty || fromPayload?.dirty),
      ahead: local.ahead,
      behind: local.behind,
    };
  }

  // No branch from the payload or the folder: nothing to show.
  return null;
}

module.exports = {
  findGitDir,
  getGitInfo,
  getGitSync,
  isSafeBranchName,
  GIT_DIRTY_MARKERS,
  gitHasDirtyMarkers,
  vcsFromPayload,
  resolveGit,
  SYNC_CACHE_NAME,
};
