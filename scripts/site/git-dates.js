// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const path = require("path");
const { execFileSync } = require("child_process");

const repo = path.join(__dirname, "..", "..");
let commitDatesCache = null;

// Reads commit dates for all tracked files in one git invocation instead of
// spawning git per page (~30+ spawns on Windows). Tracks renames backward so
// firstCommitDate matches `git log --diff-filter=A --follow`.
function loadCommitDates() {
  if (commitDatesCache !== null) {
    return commitDatesCache;
  }
  const latest = new Map();
  const earliest = new Map();
  // Maps a historical path to the current path(s) tracking it across renames.
  const followers = new Map();
  const track = (file) => {
    let set = followers.get(file);
    if (!set) {
      set = new Set([file]);
      followers.set(file, set);
    }
    return set;
  };

  try {
    const out = execFileSync(
      "git",
      ["-c", "core.quotepath=false", "log", "-M", "--format=__COMMIT__%cI", "--name-status"],
      { cwd: repo, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 }
    );
    let order = 0;
    let currentDate = "";
    for (const rawLine of out.split(/\r?\n/)) {
      if (!rawLine) continue;
      if (rawLine.startsWith("__COMMIT__")) {
        currentDate = rawLine.slice("__COMMIT__".length);
        order += 1;
        continue;
      }
      if (!currentDate) continue;
      const parts = rawLine.split("\t");
      const status = parts[0];
      if (status.startsWith("R") && parts.length >= 3) {
        const oldPath = parts[1];
        const newPath = parts[2];
        if (!latest.has(newPath)) {
          latest.set(newPath, { order, date: currentDate });
        }
        const targets = track(newPath);
        const oldTargets = followers.get(oldPath) || new Set();
        for (const target of targets) {
          oldTargets.add(target);
          earliest.set(target, currentDate);
        }
        followers.set(oldPath, oldTargets);
      } else if (parts.length >= 2) {
        const file = parts[1];
        if (!latest.has(file)) {
          latest.set(file, { order, date: currentDate });
        }
        for (const target of track(file)) {
          earliest.set(target, currentDate);
        }
      }
    }
  } catch {
    // Missing git or non-repo checkout leaves dates empty.
  }

  commitDatesCache = { latest, earliest };
  return commitDatesCache;
}

// The last commit that touched any of the files: an accurate lastmod. With a
// shallow clone every file would get the latest commit's date, so the Pages
// workflow checks out the full history. Uncommitted files have none.
function lastCommitDate(sources) {
  const { latest } = loadCommitDates();
  let best = null;
  for (const source of sources) {
    const entry = latest.get(source.replace(/\\/g, "/"));
    if (entry && (!best || entry.order < best.order)) {
      best = entry;
    }
  }
  return best ? best.date : "";
}

function firstCommitDate(source) {
  const { earliest } = loadCommitDates();
  return earliest.get(source.replace(/\\/g, "/")) || "";
}

module.exports = {
  loadCommitDates,
  lastCommitDate,
  firstCommitDate,
};
