// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");

// Ahead/behind counts depend only on the two commits compared, so they are
// kept per commit pair: git runs again only when the branch or its upstream
// moves. Starting git costs ~60 ms on Windows, on every refresh otherwise.
const SYNC_CACHE_NAME = ".git-sync-cache.json";
const SYNC_CACHE_MAX = 20;
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const SAFE_HOST = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d{1,5})?$/;

// Normalizes a git remote URL (SSH, scp-like, or HTTP(S)) into a clean web base URL
// with embedded credentials stripped, or "" when unusable or unsafe.
function parseRemoteWebUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    return "";
  }
  const url = rawUrl.trim();
  if (!url || /[\x00-\x20\x7f\\?#]/.test(url)) {
    return "";
  }

  let proto = "https:";
  let host;
  let repoPath;

  const scp = url.match(/^(?:[^@/:]+@)?([A-Za-z0-9.-]+):(.+)$/);
  if (scp && !/^[A-Za-z]:[\\/]/.test(url) && !url.includes("://")) {
    host = scp[1];
    repoPath = scp[2];
  } else {
    const uri = url.match(/^(https?|ssh|git):\/\/(?:[^@/]+@)?([^/]+)\/(.+)$/i);
    if (!uri) {
      return "";
    }
    proto = uri[1].toLowerCase() === "http" ? "http:" : "https:";
    // SSH URIs often include an SSH port (:22, :2222) that is not the HTTPS web port.
    host = uri[1].toLowerCase() === "ssh" ? uri[2].replace(/:\d+$/, "") : uri[2];
    repoPath = uri[3];
  }

  if (!SAFE_HOST.test(host) || host.includes("..")) {
    return "";
  }

  repoPath = repoPath.replace(/\/+$/, "").replace(/\.git$/i, "");
  const parts = repoPath.split("/").filter(Boolean);
  if (parts.length < 2 || parts.some((part) => part === "." || part === "..")) {
    return "";
  }

  // Azure DevOps SSH remotes (v3/org/project/repo) live on a different host
  // and path than the repository's web page.
  const azureSsh = /^(ssh\.dev\.azure\.com|vs-ssh\.visualstudio\.com)$/i.test(host);
  if (azureSsh && parts.length === 4 && parts[0].toLowerCase() === "v3") {
    const [, org, project, repo] = parts;
    return /^ssh\.dev\.azure\.com$/i.test(host)
      ? `https://dev.azure.com/${org}/${project}/_git/${repo}`
      : `https://${org}.visualstudio.com/${project}/_git/${repo}`;
  }

  return `${proto}//${host}/${parts.join("/")}`;
}

// Reads [remote "origin"] url from .git/config without spawning git.
function readOriginUrl(commonDir) {
  let text;
  try {
    text = fs.readFileSync(path.join(commonDir, "config"), "utf8");
  } catch {
    return "";
  }

  let inOrigin = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }
    if (line.startsWith("[")) {
      inOrigin = /^\[\s*remote\s+"origin"\s*\]$/i.test(line);
      continue;
    }
    if (!inOrigin) {
      continue;
    }
    const match = line.match(/^url\s*=\s*(.+)$/i);
    if (match) {
      return parseRemoteWebUrl(match[1]);
    }
  }
  return "";
}

// A git call that runs past its time is skipped until a later refresh. Tests
// give git more time: on a busy CI machine a plain call can take longer.
const timeouts = { sync: 150, detail: 300 };
function setGitTimeouts(next) {
  const previous = { ...timeouts };
  Object.assign(timeouts, next);
  return previous;
}

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
        const match = text.match(/^gitdir:[ \t]*(\S.*)$/m);

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

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
}

function pathExists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
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

// The branch checked out and its commit ("" before the first commit).
function readHead(gitDir, commonDir) {
  let head;
  try {
    head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
  } catch {
    return { branch: "", commit: "", detached: false };
  }
  if (COMMIT.test(head)) {
    return { branch: head.slice(0, 7), commit: head, detached: true };
  }
  const ref = head.replace(/^ref:\s+/, "");
  const branch = ref.replace(/^refs\/heads\//, "");
  if (!ref.startsWith("refs/heads/") || !isSafeBranchName(branch)) {
    return { branch: "", commit: "", detached: false };
  }
  const commit = readRef(commonDir, ref);
  return { branch, commit: COMMIT.test(commit) ? commit : "", detached: false };
}

// A repo opened from an archive controls its own .git/config, and git status
// and diff run the programs it names: filters on changed files, diff drivers,
// fsmonitor hooks, and anything an included file adds. A repo config with any
// of these is read for SHA, stash and worktree only; git itself isn't started.
const RISKY_CONFIG =
  /(\[\s*(filter|include|includeif|diff)\b|(?:^|\s)(fsmonitor|promisor|partialclone|sshcommand)\s*=)/im;

const PLANTED_GIT_BINARIES = ["git.exe", "git.com", "git.cmd", "git.bat"];

function hasPlantedGitBinary(cwd) {
  if (typeof cwd !== "string" || !cwd) {
    return false;
  }
  return PLANTED_GIT_BINARIES.some((name) => {
    try {
      return fs.statSync(path.join(cwd, name)).isFile();
    } catch {
      return false;
    }
  });
}

function safeGitEnv() {
  return {
    ...process.env,
    GIT_NO_LAZY_FETCH: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never",
    NoDefaultCurrentDirectoryInExePath: "1",
  };
}

function hasRiskyRepoConfig(gitDir, commonDir) {
  const files = [path.join(commonDir, "config"), path.join(gitDir, "config.worktree")];
  if (gitDir !== commonDir) {
    files.push(path.join(commonDir, "config.worktree"));
  }
  return files.some((file) => {
    try {
      return RISKY_CONFIG.test(fs.readFileSync(file, "utf8"));
    } catch {
      return false;
    }
  });
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

module.exports = {
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
  readHead,
  PLANTED_GIT_BINARIES,
  hasPlantedGitBinary,
  safeGitEnv,
  hasRiskyRepoConfig,
  syncCachePath,
  readSyncCache,
};
