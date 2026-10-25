// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");
const { record } = require("../helpers");
const { renderStatusline, defaultConfig, sampleData } = require("../../src/lib/shared");
const { LAYOUT_ORDER, getConfigDir, setConfigDir } = require("../../src/lib/config");
const {
  SYNC_CACHE_NAME,
  STATUS_CACHE_NAME,
  clearGitDetailsCache,
  hasRiskyRepoConfig,
  setGitTimeouts,
} = require("../../src/lib/git");

const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");

// Real repositories in a temp folder, with the user's own git config shut out
// (hooks, signing, templates) so the results only depend on this test.
function gitEnv(home) {
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: path.join(home, "no-global-config"),
    GIT_TERMINAL_PROMPT: "0",
  };
}

function makeGit(env) {
  return (cwd, ...args) =>
    childProcess.execFileSync(
      "git",
      [
        "-c",
        "user.name=test",
        "-c",
        "user.email=",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "init.defaultBranch=main",
        ...args,
      ],
      { cwd, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }
    );
}

function hasGit() {
  try {
    childProcess.execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Counts the git processes the statusline starts while fn runs.
function countGitCalls(fn) {
  const original = childProcess.execFileSync;
  let calls = 0;
  childProcess.execFileSync = (file, ...rest) => {
    if (file === "git") {
      calls += 1;
    }
    return original(file, ...rest);
  };
  try {
    fn();
  } finally {
    childProcess.execFileSync = original;
  }
  return calls;
}

const DETAIL_WIDGETS = ["gitChanges", "gitFiles", "gitSha", "gitStash", "gitWorktree"];

// The gitChanges, gitFiles, gitSha, gitStash and gitWorktree widgets on real
// repositories: values, hiding, the dirty marker, caching and hostile configs.
function testGitDetails(root, git) {
  const write = (file, text) => fs.writeFileSync(file, text);
  const widgets = (ids) => ids.map((item) => (typeof item === "string" ? { id: item } : item));
  const render = (cwd, ids = DETAIL_WIDGETS, extra = {}) => {
    clearGitDetailsCache();
    return strip(
      renderStatusline(
        { ...sampleData(), cwd, vcs: { type: "git" } },
        { ...defaultConfig(), widgets: widgets(ids), ...extra },
        { color: "none", env: {} }
      )
    );
  };

  // One commit, then: a.txt changed (+2 −1), b.txt staged (+2), c.txt untracked.
  const repo = path.join(root, "details");
  fs.mkdirSync(repo);
  git(repo, "init", "-q");
  write(path.join(repo, "a.txt"), "one\ntwo\nthree\n");
  git(repo, "add", "a.txt");
  git(repo, "commit", "-q", "-m", "base");
  write(path.join(repo, "a.txt"), "one\nTWO\nthree\nfour\n");
  write(path.join(repo, "b.txt"), "b1\nb2\n");
  git(repo, "add", "b.txt");
  write(path.join(repo, "c.txt"), "untracked\n");
  const sha = git(repo, "rev-parse", "--short=7", "HEAD").trim();

  const all = render(repo);
  record(
    "gitChanges counts lines added and removed since the last commit, staged or not",
    /Lines: \+4 −1/.test(all),
    all
  );
  record(
    "gitFiles counts staged, modified and untracked files",
    /Files: \+1 ●1 \?1/.test(all),
    all
  );
  record("gitSha shows the short commit ID", all.includes(`Commit: ${sha}`), all);
  record(
    "gitStash and gitWorktree hide with no stash and in the main worktree",
    !/Stash|Worktree/.test(all),
    all
  );
  const ascii = render(repo, DETAIL_WIDGETS, { ascii: true });
  record(
    "ASCII mode writes the counts in plain ASCII",
    /Lines: \+4 -1/.test(ascii) && /Files: S1 M1 \?1/.test(ascii) && !/[^\x00-\x7f]/.test(ascii),
    ascii
  );
  const lines = render(repo, DETAIL_WIDGETS, { layout: "lines" });
  record(
    "both layouts show the git details",
    /\+4 −1/.test(lines) && /\+1 ●1 \?1/.test(lines),
    lines
  );

  record(
    "with gitFiles on the bar, the branch is marked dirty for uncommitted files",
    /● main/.test(render(repo, ["git", "gitFiles"])) && !/●/.test(render(repo, ["git"]))
  );

  const clean = path.join(root, "clean");
  fs.mkdirSync(clean);
  git(clean, "init", "-q");
  git(clean, "commit", "-q", "--allow-empty", "-m", "base");
  const cleanOut = render(clean, ["gitChanges", "gitFiles"]);
  record("gitChanges and gitFiles hide on a clean tree", cleanOut.trim() === "", cleanOut);

  // Stashes and a linked worktree.
  write(path.join(clean, "s.txt"), "1\n");
  git(clean, "add", "s.txt");
  git(clean, "stash", "push", "-q");
  write(path.join(clean, "s.txt"), "2\n");
  git(clean, "add", "s.txt");
  git(clean, "stash", "push", "-q");
  const tree = path.join(root, "feature-tree");
  git(clean, "worktree", "add", "-q", "-b", "feature", tree);
  record("gitStash counts the stashes", /Stash: 2/.test(render(clean, ["gitStash"])));
  record(
    "gitWorktree names the linked worktree and the stash count is shared with it",
    /Worktree: feature-tree/.test(render(tree)) && /Stash: 2/.test(render(tree))
  );
  for (const layout of LAYOUT_ORDER) {
    for (const ascii of [false, true]) {
      const out = render(tree, [{ id: "gitWorktree", maxWidth: 8 }], { layout, ascii });
      const expected = ascii ? "featu..." : "feature…";
      record(
        `${layout} gitWorktree maxWidth clips its value in ${ascii ? "ASCII" : "Unicode"} mode`,
        out.includes(expected),
        out
      );
    }
    const baseline = render(tree, [{ id: "gitWorktree" }], { layout });
    for (const maxWidth of [0, -1, "5", 1e9, null]) {
      record(
        `${layout} gitWorktree ignores invalid maxWidth ${String(maxWidth)}`,
        render(tree, [{ id: "gitWorktree", maxWidth }], { layout }) === baseline
      );
    }
  }

  git(clean, "checkout", "-q", "--detach");
  const detachedSha = git(clean, "rev-parse", "--short=7", "HEAD").trim();
  record(
    "gitSha works on a detached HEAD",
    render(clean, ["gitSha"]).includes(`Commit: ${detachedSha}`)
  );

  const unborn = path.join(root, "unborn");
  fs.mkdirSync(unborn);
  git(unborn, "init", "-q");
  write(path.join(unborn, "new.txt"), "x\n");
  git(unborn, "add", "new.txt");
  const unbornOut = render(unborn);
  record(
    "before the first commit: staged files count, no SHA and no line changes",
    /Files: \+1/.test(unbornOut) && !/Commit|Lines/.test(unbornOut),
    unbornOut
  );

  // A merge conflict on one file.
  const conflict = path.join(root, "conflict");
  fs.mkdirSync(conflict);
  git(conflict, "init", "-q");
  write(path.join(conflict, "x.txt"), "base\n");
  git(conflict, "add", "x.txt");
  git(conflict, "commit", "-q", "-m", "base");
  git(conflict, "checkout", "-q", "-b", "other");
  write(path.join(conflict, "x.txt"), "theirs\n");
  git(conflict, "commit", "-q", "-am", "theirs");
  git(conflict, "checkout", "-q", "main");
  write(path.join(conflict, "x.txt"), "mine\n");
  git(conflict, "commit", "-q", "-am", "mine");
  try {
    git(conflict, "merge", "-q", "other");
  } catch {
    // The conflict is the point.
  }
  record("gitFiles counts files in conflict", /Files: ≠1/.test(render(conflict, ["gitFiles"])));

  // Caching: one git status per repo and commit within the TTL, next to a real
  // install's config; a new commit runs it again.
  const installDir = path.join(root, "details-install");
  fs.mkdirSync(installDir);
  fs.writeFileSync(path.join(installDir, "statusline.config.json"), "{}");
  const previousConfigDir = getConfigDir();
  setConfigDir(installDir);
  try {
    clearGitDetailsCache();
    const draw = () =>
      renderStatusline(
        { ...sampleData(), cwd: repo, vcs: { type: "git" } },
        { ...defaultConfig(), widgets: widgets(["gitFiles"]) },
        { color: "none", env: {} }
      );
    const first = countGitCalls(draw);
    const second = countGitCalls(draw);
    clearGitDetailsCache();
    const fromDisk = countGitCalls(draw);
    git(repo, "commit", "-q", "-m", "next");
    const afterCommit = countGitCalls(draw);
    record(
      "git status runs once per repo and commit within the cache time, shared through the cache file",
      first === 1 && second === 0 && fromDisk === 0 && afterCommit === 1,
      `${first}, ${second}, ${fromDisk}, ${afterCommit}`
    );
    record(
      `the counts are cached in ${STATUS_CACHE_NAME} next to the config`,
      fs.existsSync(path.join(installDir, STATUS_CACHE_NAME))
    );
    fs.writeFileSync(
      path.join(installDir, STATUS_CACHE_NAME),
      '{"x": [1, 2], "y": {"files": "bad"}'
    );
    clearGitDetailsCache();
    record(
      "a torn or edited cache file is ignored",
      /Files: \+1 ●1 \?1|Files: ●1 \?1/.test(strip(draw())),
      strip(draw())
    );
  } finally {
    setConfigDir(previousConfigDir);
  }

  // A repo whose own config names programs git status or diff would run.
  const marker = path.join(root, "hostile-ran").replace(/\\/g, "/");
  const drop = `node -e "require('fs').writeFileSync('${marker}', 'x')"`;
  const hostile = path.join(root, "hostile");
  fs.mkdirSync(hostile);
  git(hostile, "init", "-q");
  write(path.join(hostile, ".gitattributes"), "* filter=evil diff=evil\n");
  write(path.join(hostile, "f.txt"), "1\n");
  git(hostile, "add", ".");
  git(hostile, "commit", "-q", "-m", "base");
  git(hostile, "config", "core.fsmonitor", drop);
  git(hostile, "config", "filter.evil.clean", drop);
  git(hostile, "config", "diff.evil.textconv", drop);
  write(path.join(hostile, "f.txt"), "2\n");
  const hostileSha = git(hostile, "rev-parse", "--short=7", "HEAD").trim();
  const hostileOut = render(hostile);
  record(
    "a repo config with fsmonitor, filters or diff drivers never gets git status or diff run",
    !fs.existsSync(marker) && !/Files|Lines/.test(hostileOut) && hostileOut.includes(hostileSha),
    hostileOut
  );

  const included = path.join(root, "included");
  fs.mkdirSync(included);
  git(included, "init", "-q");
  git(included, "commit", "-q", "--allow-empty", "-m", "base");
  fs.appendFileSync(path.join(included, ".git", "config"), "[include]\n\tpath = ../evil.cfg\n");
  record(
    "so does a repo config that includes another file",
    hasRiskyRepoConfig(path.join(included, ".git"), path.join(included, ".git"))
  );
}

// A rebase, merge, cherry-pick, revert or bisect in progress, on real repos.
function testGitOperations(root, git) {
  const write = (file, text) => fs.writeFileSync(file, text);
  const render = (cwd, extra = {}, widget = {}) =>
    strip(
      renderStatusline(
        { ...sampleData(), cwd, vcs: { type: "git" } },
        { ...defaultConfig(), widgets: [{ id: "git", ...widget }], ...extra },
        { color: "none", env: {} }
      )
    );
  const attempt = (...args) => {
    try {
      git(...args);
    } catch {
      // The conflict is the point.
    }
  };

  // main: base then "main" on x.txt; feature (from base): "theirs" on x.txt,
  // then a second commit on y.txt.
  const repo = (name) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir);
    git(dir, "init", "-q");
    write(path.join(dir, "x.txt"), "base\n");
    git(dir, "add", "x.txt");
    git(dir, "commit", "-q", "-m", "base");
    git(dir, "checkout", "-q", "-b", "feature");
    write(path.join(dir, "x.txt"), "theirs\n");
    git(dir, "commit", "-q", "-am", "theirs");
    write(path.join(dir, "y.txt"), "y\n");
    git(dir, "add", "y.txt");
    git(dir, "commit", "-q", "-m", "second");
    git(dir, "checkout", "-q", "main");
    write(path.join(dir, "x.txt"), "main\n");
    git(dir, "commit", "-q", "-am", "main");
    return dir;
  };

  const rebasing = repo("op-rebase");
  git(rebasing, "checkout", "-q", "feature");
  attempt(rebasing, "rebase", "main");
  const rebaseOut = render(rebasing);
  record(
    "a stopped rebase shows REBASE with its step and the branch being rebased, not a SHA",
    /● feature\|REBASE 1\/2/.test(rebaseOut),
    rebaseOut
  );
  const rebaseLines = render(rebasing, { layout: "lines" });
  record(
    "the Lines layout shows the rebase too",
    rebaseLines.includes("(feature* REBASE 1/2)"),
    rebaseLines
  );
  const rebaseAscii = render(rebasing, { ascii: true });
  record(
    "ASCII mode shows the same label in plain ASCII",
    rebaseAscii.includes("* feature|REBASE 1/2") && !/[^\x00-\x7f]/.test(rebaseAscii),
    rebaseAscii
  );
  const hidden = render(rebasing, {}, { operation: false });
  record(
    '"operation": false hides the label and keeps the dirty marker',
    !hidden.includes("REBASE") && /● feature/.test(hidden),
    hidden
  );
  record(
    "raw mode keeps the label: it's part of the value",
    /feature\|REBASE 1\/2/.test(render(rebasing, { minimalist: true }))
  );

  // The repo controls these files: hostile values lose the step or the branch.
  const state = path.join(rebasing, ".git", "rebase-merge");
  write(path.join(state, "msgnum"), "abc\n");
  const noStep = render(rebasing);
  write(path.join(state, "msgnum"), "1e9\n");
  const exponent = render(rebasing);
  write(path.join(state, "head-name"), "refs/heads/../x\n");
  const unsafe = render(rebasing);
  record(
    "a hostile msgnum or head-name drops the step or the branch, without crashing",
    /REBASE(?! \d)/.test(noStep) &&
      /REBASE(?! \d)/.test(exponent) &&
      !unsafe.includes("../x") &&
      /[0-9a-f]{7}\|REBASE/.test(unsafe),
    [noStep, exponent, unsafe].join(" / ")
  );

  const merging = repo("op-merge");
  attempt(merging, "merge", "-q", "feature");
  record("a conflicting merge shows MERGING", /main\|MERGING/.test(render(merging)));

  const picking = repo("op-pick");
  attempt(picking, "cherry-pick", "feature~1");
  record(
    "a conflicting cherry-pick shows CHERRY-PICKING",
    /\|CHERRY-PICKING/.test(render(picking))
  );

  const reverting = repo("op-revert");
  git(reverting, "revert", "--no-commit", "HEAD");
  record("git revert --no-commit shows REVERTING", /\|REVERTING/.test(render(reverting)));

  const bisecting = repo("op-bisect");
  git(bisecting, "bisect", "start");
  record("git bisect start shows BISECTING", /\|BISECTING/.test(render(bisecting)));

  // A linked worktree keeps its merge state in its own git dir.
  const main = repo("op-tree-main");
  const tree = path.join(root, "op-tree");
  git(main, "worktree", "add", "-q", "-b", "side", tree, "HEAD~1");
  write(path.join(tree, "x.txt"), "side\n");
  git(tree, "commit", "-q", "-am", "side");
  attempt(tree, "merge", "-q", "feature");
  const treeOut = render(tree);
  const mainOut = render(main);
  record(
    "a linked worktree mid-merge shows MERGING, and only there",
    /side\|MERGING/.test(treeOut) && !/MERGING/.test(mainOut),
    `${treeOut} / ${mainOut}`
  );
}

async function run() {
  if (!hasGit()) {
    record("git suite skipped: git is not installed", true);
    return;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-git-"));
  const env = gitEnv(root);
  const git = makeGit(env);
  // These tests check what git reports, not how fast it answers: a busy
  // Windows runner sometimes needs more than the bar's 150 ms.
  const previousTimeouts = setGitTimeouts({ sync: 5000, detail: 5000 });

  try {
    // remote.git <- work (2 commits ahead), other pushes 1 commit work lacks.
    const remote = path.join(root, "remote.git");
    const work = path.join(root, "work");
    const other = path.join(root, "other");
    git(root, "init", "-q", "--bare", remote);
    git(root, "clone", "-q", remote, work);
    git(work, "commit", "-q", "--allow-empty", "-m", "base");
    git(work, "push", "-q", "-u", "origin", "main");
    git(root, "clone", "-q", remote, other);
    git(other, "commit", "-q", "--allow-empty", "-m", "theirs");
    git(other, "push", "-q", "origin", "main");
    git(work, "commit", "-q", "--allow-empty", "-m", "mine 1");
    git(work, "commit", "-q", "--allow-empty", "-m", "mine 2");
    git(work, "fetch", "-q", "origin");

    const notARepo = strip(
      renderStatusline(
        { ...sampleData(), cwd: root, vcs: { type: "git" } },
        { ...defaultConfig(), widgets: [{ id: "git" }], ascii: true }
      )
    );
    record(
      "vcs.type without a branch outside a repo hides the git widget",
      !/\[\s*\]/.test(notARepo) && notARepo.trim() === "",
      JSON.stringify(notARepo)
    );

    // Antigravity's real payload names only the VCS type.
    const payload = { ...sampleData(), cwd: work, vcs: { type: "git" } };
    const gitOnly = { ...defaultConfig(), widgets: [{ id: "git" }] };
    const render = (data, config = gitOnly) => strip(renderStatusline(data, config));

    record("ahead/behind come from the local repository (⇡2 ⇣1)", /⇡2 ⇣1/.test(render(payload)));
    record(
      "ahead/behind in ASCII mode (^2 v1)",
      /\^2 v1/.test(render(payload, { ...gitOnly, ascii: true }))
    );
    record(
      "lines layout shows ahead/behind",
      /⇡2 ⇣1/.test(render(payload, { ...defaultConfig(), layout: "lines" }))
    );

    const sameBranch = render({ ...payload, vcs: { type: "git", branch: "main" } });
    record(
      "a branch named by Antigravity still gets local ahead/behind counts",
      /main/.test(sameBranch) && /⇡2 ⇣1/.test(sameBranch),
      sameBranch
    );

    const otherBranch = render({ ...payload, vcs: { type: "git", branch: "release" } });
    record(
      "counts are not shown for a branch other than the one checked out",
      /release/.test(otherBranch) && !/⇡|⇣/.test(otherBranch),
      otherBranch
    );

    const guessed = render({
      ...payload,
      vcs: { type: "git", branch: "release", ahead: 9, behind: 9 },
      git: { branch: "x", dirty: true },
    });
    record(
      "ahead/behind and git fields Antigravity never sends are ignored",
      !/9/.test(guessed) && !/\bx\b/.test(guessed),
      guessed
    );

    git(work, "pack-refs", "--all");
    record("packed refs (after git gc) still give ahead/behind", /⇡2 ⇣1/.test(render(payload)));

    // From an install (a config next to the runtime), the counts are kept per
    // commit pair and git runs again only when one of the two commits moves.
    const installDir = path.join(root, "install");
    fs.mkdirSync(installDir);
    fs.writeFileSync(path.join(installDir, "statusline.config.json"), "{}");
    const previousConfigDir = getConfigDir();
    setConfigDir(installDir);
    try {
      const first = countGitCalls(() => render(payload));
      const second = countGitCalls(() => render(payload));
      record(
        "ahead/behind runs git once per commit pair, then reads the cache",
        first === 1 && second === 0 && /⇡2 ⇣1/.test(render(payload)),
        `${first} then ${second} calls`
      );

      git(work, "commit", "-q", "--allow-empty", "-m", "mine 3");
      const moved = countGitCalls(() => render(payload));
      record(
        "a new commit runs git again",
        moved === 1 && /⇡3 ⇣1/.test(render(payload)),
        `${moved} calls`
      );

      fs.writeFileSync(path.join(installDir, SYNC_CACHE_NAME), "not json");
      record("a broken ahead/behind cache is ignored", /⇡3 ⇣1/.test(render(payload)));
    } finally {
      setConfigDir(previousConfigDir);
    }

    git(work, "pull", "-q", "--rebase", "origin", "main");
    git(work, "push", "-q", "origin", "main");
    const inSyncCalls = countGitCalls(() => render(payload));
    record(
      "a branch in sync with its upstream starts no git process",
      inSyncCalls === 0,
      `${inSyncCalls} calls`
    );

    git(work, "switch", "-q", "-c", "local-only");
    const untrackedCalls = countGitCalls(() => render(payload));
    record(
      "a branch with no upstream starts no git process",
      untrackedCalls === 0 && !/⇡|⇣/.test(render(payload)),
      `${untrackedCalls} calls`
    );

    // A cloned repo controls .git/config: a remote name that walks out of
    // refs/ must not be used as a path.
    git(work, "config", "branch.local-only.remote", "../../../outside");
    git(work, "config", "branch.local-only.merge", "refs/heads/main");
    const hostileCalls = countGitCalls(() => render(payload));
    record(
      "a remote name with .. in .git/config is ignored",
      hostileCalls === 0 && /local-only/.test(render(payload)),
      `${hostileCalls} calls`
    );

    // A linked worktree keeps its refs in the main repository.
    git(work, "switch", "-q", "main");
    const tree = path.join(root, "tree");
    git(work, "worktree", "add", "-q", "-b", "feature", tree, "origin/main");
    git(tree, "commit", "-q", "--allow-empty", "-m", "in worktree");
    const inTree = render({ ...payload, cwd: tree });
    record(
      "a linked worktree shows its branch and ahead count",
      /feature/.test(inTree) && /⇡1/.test(inTree),
      inTree
    );
    testGitDetails(root, git);
    testGitOperations(root, git);
  } catch (err) {
    record("git suite ran without errors", false, String(err.stderr || err.message));
  } finally {
    setGitTimeouts(previousTimeouts);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
