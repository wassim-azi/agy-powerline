"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  record,
  PAYLOAD,
  NODE,
  stageInstall,
  spawnCapture,
  looksRendered,
  runCli,
  which,
  findGitSh,
  toWslPath,
} = require("../helpers");
const {
  statuslineCommand,
  writeWindowsLauncher,
  toPosixPath,
  quoteForSh,
} = require("../../src/lib/paths");

async function testWindowsAgy() {
  const dir = stageInstall(path.join(os.tmpdir(), "agy-powerline-verify-win"));
  writeWindowsLauncher(dir, NODE);
  const command = statuslineCommand(dir, { platform: "win32" });

  const agy = await spawnCapture("cmd.exe", ["/c", command], PAYLOAD);
  record(
    "Windows agy path: cmd /c statusline.cmd",
    agy.code === 0 && looksRendered(agy.stdout),
    agy.code !== 0 ? agy.stderr.trim() : `exit ${agy.code}`
  );

  const overridden = await spawnCapture(
    "cmd.exe",
    ["/c", `${command} --layout pills --caps angled`],
    PAYLOAD
  );
  record(
    "Windows statusline.cmd forwards per-render layout and caps flags",
    overridden.code === 0 && looksRendered(overridden.stdout) && overridden.stdout !== agy.stdout,
    overridden.code !== 0 ? overridden.stderr.trim() : `exit ${overridden.code}`
  );

  const old = `"${toPosixPath(NODE)}" "${toPosixPath(path.join(dir, "statusline.js"))}"`;
  const broken = await spawnCapture("cmd.exe", ["/c", old], PAYLOAD);
  record(
    "regression: quoted node.exe via cmd /c fails",
    broken.code !== 0 && /not recognized/i.test(broken.stderr),
    `exit ${broken.code}`
  );

  const spaceDir = stageInstall(path.join(os.tmpdir(), "agy powerline verify win"));
  writeWindowsLauncher(spaceDir, NODE);
  const spaceCmd = statuslineCommand(spaceDir, { platform: "win32" });
  const space = await spawnCapture("cmd.exe", ["/c", spaceCmd], PAYLOAD);
  record(
    "Windows cmd /c launcher path with spaces",
    space.code === 0 && looksRendered(space.stdout),
    space.code !== 0 ? space.stderr.trim() : `exit ${space.code}`
  );

  // This is the job's first start of Windows PowerShell, which on a fresh CI
  // runner sometimes takes more than the 15 s the check allows (usual: ~1 s).
  // Start it once, untimed, so the check below times the launcher.
  await spawnCapture(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "exit 0"],
    "",
    120000
  );
  const ps = await spawnCapture(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `& '${command.replace(/'/g, "''")}'`],
    PAYLOAD
  );
  record(
    "Windows PowerShell invokes statusline.cmd",
    ps.code === 0 && looksRendered(ps.stdout),
    ps.code !== 0 ? ps.stderr.trim().slice(0, 200) : `exit ${ps.code}`
  );

  const pwshPath = path.join(os.homedir(), "Documents", "PowerShell-7.7.0", "pwsh.exe");
  if (fs.existsSync(pwshPath) || which("pwsh")) {
    const pwsh = fs.existsSync(pwshPath) ? pwshPath : "pwsh";
    const core = await spawnCapture(
      pwsh,
      ["-NoProfile", "-NonInteractive", "-Command", `& '${command.replace(/'/g, "''")}'`],
      PAYLOAD
    );
    record(
      "PowerShell 7 invokes statusline.cmd",
      core.code === 0 && looksRendered(core.stdout),
      core.code !== 0 ? core.stderr.trim().slice(0, 200) : `exit ${core.code}`
    );
  } else {
    record("PowerShell 7 invokes statusline.cmd", true, "skipped (pwsh not found)");
  }
}

async function testWindowsInit() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-win-init-"));
  const home = path.join(sandbox, "home");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;

  try {
    const res = runCli(["init", "--yes", "--stack", "--padding", "2"], {
      cwd: sandbox,
      env,
    });
    const installDir = path.join(home, ".agy-powerline");
    const settingsPath = path.join(home, ".gemini", "antigravity-cli", "settings.json");
    let settings = {};
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {}

    const ok =
      res.code === 0 &&
      fs.existsSync(path.join(installDir, "statusline.cmd")) &&
      fs.existsSync(path.join(installDir, "statusline.js")) &&
      !fs.existsSync(path.join(installDir, "shared.js")) &&
      fs.existsSync(path.join(installDir, "install.json")) &&
      settings.statusLine?.stack_with_default === true &&
      settings.statusLine?.padding === 2;

    record(
      "Windows init writes statusline.cmd launcher, stack, and padding settings",
      ok,
      `exit ${res.code}`
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

async function testGitBash() {
  const sh = findGitSh();
  if (!sh) {
    record("Git Bash sh -c unix command", true, "skipped (Git sh.exe not found)");
    return;
  }

  const dir = stageInstall(path.join(os.tmpdir(), "agy-powerline-verify-git"));
  const command = `${quoteForSh(toPosixPath(NODE))} ${quoteForSh(toPosixPath(path.join(dir, "statusline.js")))}`;
  const git = await spawnCapture(sh, ["-c", command], PAYLOAD);
  record(
    "Git Bash sh -c (Unix agy path) quoted node + script",
    git.code === 0 && looksRendered(git.stdout),
    git.code !== 0 ? git.stderr.trim().slice(0, 240) : `exit ${git.code}`
  );

  const spaceDir = stageInstall(path.join(os.tmpdir(), "agy powerline verify git"));
  const spaceCommand = `${quoteForSh(toPosixPath(NODE))} ${quoteForSh(toPosixPath(path.join(spaceDir, "statusline.js")))}`;
  const space = await spawnCapture(sh, ["-c", spaceCommand], PAYLOAD);
  record(
    "Git Bash sh -c with spaces in the script path",
    space.code === 0 && looksRendered(space.stdout),
    space.code !== 0 ? space.stderr.trim().slice(0, 240) : `exit ${space.code}`
  );
}

async function testWsl() {
  const probe = spawnSync("wsl.exe", ["-d", "Ubuntu", "--", "sh", "-c", "uname -s"], {
    windowsHide: true,
    timeout: 20000,
    encoding: "utf8",
  });

  if (probe.error || probe.status !== 0) {
    record(
      "WSL Ubuntu sh -c",
      true,
      `skipped (${(probe.stderr || probe.error || "no distro").toString().trim()})`
    );
    return;
  }

  const dir = stageInstall(path.join(os.tmpdir(), "agy-powerline-verify-wsl"));
  const spaceDir = stageInstall(path.join(os.tmpdir(), "agy powerline verify wsl"));
  const echoName = "echo-statusline.sh";
  const echoBody = "#!/bin/sh\ncat >/dev/null\nprintf 'Gemini WSL\\n'\n";
  fs.writeFileSync(path.join(dir, echoName), echoBody, "utf8");
  fs.writeFileSync(path.join(spaceDir, echoName), echoBody, "utf8");

  const echoPath = toWslPath(path.join(dir, echoName));
  const echo = await spawnCapture(
    "wsl.exe",
    [
      "-d",
      "Ubuntu",
      "--",
      "sh",
      "-c",
      `chmod +x ${quoteForSh(echoPath)} && ${quoteForSh(echoPath)}`,
    ],
    PAYLOAD
  );
  record(
    "WSL Ubuntu sh -c quoted POSIX script (Linux agy path)",
    echo.code === 0 && /Gemini/.test(echo.stdout),
    echo.code !== 0 ? (echo.stderr || echo.stdout).trim().slice(0, 240) : `exit ${echo.code}`
  );

  const spaceEcho = toWslPath(path.join(spaceDir, echoName));
  const space = await spawnCapture(
    "wsl.exe",
    [
      "-d",
      "Ubuntu",
      "--",
      "sh",
      "-c",
      `chmod +x ${quoteForSh(spaceEcho)} && ${quoteForSh(spaceEcho)}`,
    ],
    PAYLOAD
  );
  record(
    "WSL Ubuntu sh -c with spaces in the script path",
    space.code === 0 && /Gemini/.test(space.stdout),
    space.code !== 0 ? (space.stderr || space.stdout).trim().slice(0, 240) : `exit ${space.code}`
  );

  const nodeProbe = spawnSync(
    "wsl.exe",
    ["-d", "Ubuntu", "--", "sh", "-c", "command -v node || true"],
    { windowsHide: true, timeout: 20000, encoding: "utf8" }
  );
  const linuxNode = (nodeProbe.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop();

  if (!linuxNode) {
    record(
      "WSL Ubuntu node renderer",
      true,
      "skipped (no Linux node in Ubuntu; quoting verified above)"
    );
    return;
  }

  const command = `${quoteForSh(linuxNode)} ${quoteForSh(toWslPath(path.join(dir, "statusline.js")))}`;
  const linux = await spawnCapture("wsl.exe", ["-d", "Ubuntu", "--", "sh", "-c", command], PAYLOAD);
  record(
    "WSL Ubuntu sh -c Linux node + script",
    linux.code === 0 && looksRendered(linux.stdout),
    linux.code !== 0 ? (linux.stderr || linux.stdout).trim().slice(0, 240) : `exit ${linux.code}`
  );
}

async function run() {
  if (process.platform !== "win32") {
    record("Windows test suite", true, "skipped (not running on win32)");
    return;
  }
  await testWindowsAgy();
  await testWindowsInit();
  await testGitBash();
  await testWsl();
}

module.exports = { run };
