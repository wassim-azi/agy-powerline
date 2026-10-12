"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");
const { record } = require("../helpers");
const { renderStatusline, defaultConfig, sampleData } = require("../../src/lib/shared");
const { getConfigDir, setConfigDir } = require("../../src/lib/config");
const { SYNC_CACHE_NAME } = require("../../src/lib/git");

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

async function run() {
  if (!hasGit()) {
    record("git suite skipped: git is not installed", true);
    return;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-git-"));
  const env = gitEnv(root);
  const git = makeGit(env);

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
  } catch (err) {
    record("git suite ran without errors", false, String(err.stderr || err.message));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
