"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, runCli, stripAnsi } = require("../helpers");
const { RUNTIME_FILES, cmdBreakingChars, cmdBreakingMessage } = require("../../src/lib/paths");

// Every case gets its own home folder: init and doctor never see the real one.
function sandbox(name, installDir) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `agy-init-${name}-`));
  const home = path.join(root, "home");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;
  if (installDir) {
    env.AGY_POWERLINE_HOME = path.join(root, installDir);
  }
  return {
    root,
    home,
    env,
    installDir: env.AGY_POWERLINE_HOME || path.join(home, ".agy-powerline"),
    settingsPath: path.join(home, ".gemini", "antigravity-cli", "settings.json"),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function writeSettings(box, value) {
  fs.mkdirSync(path.dirname(box.settingsPath), { recursive: true });
  fs.writeFileSync(box.settingsPath, JSON.stringify(value, null, 2), "utf8");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function withBox(name, fn, installDir) {
  const box = sandbox(name, installDir);
  try {
    fn(box);
  } finally {
    box.cleanup();
  }
}

async function run() {
  testFreshInstall();
  testForeignStatusLine();
  testExistingScripts();
  testRerunKeepsOptions();
  testEnabledFalse();
  testCmdBreakingFolder();
  testDoctor();
  testUpgradeFromSeparateFiles();
}

function testFreshInstall() {
  withBox("fresh", (box) => {
    const res = runCli(["init", "--yes"], { env: box.env });
    const settings = readJson(box.settingsPath);
    const missing = ["statusline.js", "statusline.config.json", "install.json"]
      .filter((rel) => !fs.existsSync(path.join(box.installDir, rel)))
      .join(", ");
    const separate = RUNTIME_FILES.filter((rel) => fs.existsSync(path.join(box.installDir, rel)));
    record(
      "init on a fresh machine installs the one-file runtime and writes statusLine",
      res.code === 0 &&
        !missing &&
        separate.length === 0 &&
        settings?.statusLine?.type === "command" &&
        /statusline\.(js|cmd)/.test(settings.statusLine.command || ""),
      missing || separate.join(", ") || res.stderr
    );
  });
}

// Installs up to 1.1.0 copied the runtime files next to statusline.js. A new
// init removes those copies (and the emptied layouts folder), nothing else.
function testUpgradeFromSeparateFiles() {
  withBox("upgrade", (box) => {
    for (const rel of RUNTIME_FILES) {
      const file = path.join(box.installDir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "// old copy\n", "utf8");
    }
    const mine = path.join(box.installDir, "my-notes.txt");
    fs.writeFileSync(mine, "mine", "utf8");
    const res = runCli(["init", "--yes"], { env: box.env });
    const left = RUNTIME_FILES.filter((rel) => fs.existsSync(path.join(box.installDir, rel)));
    record(
      "init removes the separate runtime files of an older install and keeps other files",
      res.code === 0 &&
        left.length === 0 &&
        !fs.existsSync(path.join(box.installDir, "layouts")) &&
        fs.existsSync(mine),
      left.join(", ") || res.stderr
    );
  });
}

function testForeignStatusLine() {
  withBox("foreign", (box) => {
    const foreign = { theme: "dark", statusLine: { type: "command", command: "other-tool" } };
    writeSettings(box, foreign);
    const before = fs.readFileSync(box.settingsPath, "utf8");
    const res = runCli(["init"], { env: box.env });
    record(
      "init without --yes leaves another tool's statusLine alone",
      res.code === 1 &&
        /already has statusLine/.test(res.stderr) &&
        fs.readFileSync(box.settingsPath, "utf8") === before,
      `exit ${res.code}`
    );

    const forced = runCli(["init", "--yes"], { env: box.env });
    const after = readJson(box.settingsPath);
    record(
      "init --yes replaces it and keeps the other settings",
      forced.code === 0 &&
        after?.theme === "dark" &&
        after?.statusLine?.command !== "other-tool" &&
        fs.existsSync(`${box.settingsPath}.agy-powerline.bak`),
      `exit ${forced.code}`
    );
  });
}

function testExistingScripts() {
  withBox("existing", (box) => {
    runCli(["init", "--yes"], { env: box.env });
    const script = path.join(box.installDir, "statusline.js");
    fs.appendFileSync(script, "\n// local edit\n");
    const res = runCli(["init"], { env: box.env });
    record(
      "init without --yes does not overwrite installed scripts",
      res.code === 1 &&
        /Pass --yes to overwrite/.test(res.stderr) &&
        fs.readFileSync(script, "utf8").includes("// local edit"),
      `exit ${res.code}`
    );
  });
}

function testRerunKeepsOptions() {
  withBox("rerun", (box) => {
    runCli(["init", "--yes", "--stack", "--padding", "2"], { env: box.env });
    const first = readJson(box.settingsPath)?.statusLine;
    runCli(["init", "--yes"], { env: box.env });
    const second = readJson(box.settingsPath)?.statusLine;
    record(
      "init --stack --padding 2 sets both, and a later init keeps them",
      first?.stack_with_default === true &&
        first?.padding === 2 &&
        second?.stack_with_default === true &&
        second?.padding === 2,
      JSON.stringify(second)
    );
  });
}

function testEnabledFalse() {
  withBox("enabled", (box) => {
    runCli(["init", "--yes"], { env: box.env });
    const settings = readJson(box.settingsPath);
    writeSettings(box, { ...settings, statusLine: { ...settings.statusLine, enabled: false } });

    const doctor = runCli(["doctor"], { env: box.env });
    record(
      "doctor fails and explains when statusLine.enabled is false",
      doctor.code === 1 && /enabled is false/.test(stripAnsi(doctor.stdout)),
      `exit ${doctor.code}`
    );

    const markdown = runCli(["doctor", "--markdown"], { env: box.env });
    record(
      "doctor --markdown reports Enabled: false",
      /\*\*Enabled\*\* \| `false`/.test(markdown.stdout)
    );

    const res = runCli(["init", "--yes"], { env: box.env });
    record(
      "init switches a disabled statusLine back on and says so",
      res.code === 0 &&
        readJson(box.settingsPath)?.statusLine?.enabled === undefined &&
        /enabled was false/.test(stripAnsi(res.stdout)),
      `exit ${res.code}`
    );
  });
}

function testCmdBreakingFolder() {
  record(
    "cmd-breaking characters are found on Windows only",
    cmdBreakingChars("C:\\Users\\R&D (x)\\.agy-powerline", "win32").join("") === "&(" &&
      cmdBreakingChars("C:\\Users\\John Doe\\.agy-powerline", "win32").length === 0 &&
      cmdBreakingChars("/home/r&d/.agy-powerline", "linux").length === 0 &&
      /AGY_POWERLINE_HOME/.test(cmdBreakingMessage(["&"]))
  );

  if (process.platform !== "win32") {
    return;
  }

  withBox(
    "cmdchars",
    (box) => {
      writeSettings(box, { theme: "dark" });
      const before = fs.readFileSync(box.settingsPath, "utf8");
      const res = runCli(["init", "--yes"], { env: box.env });
      record(
        "init refuses an install folder Windows cmd would split, touching nothing",
        res.code === 1 &&
          /"&"/.test(res.stderr) &&
          fs.readFileSync(box.settingsPath, "utf8") === before &&
          !fs.existsSync(path.join(box.installDir, "statusline.js")),
        `exit ${res.code}`
      );
    },
    "R&D"
  );
}

function testDoctor() {
  withBox("doctor-none", (box) => {
    const res = runCli(["doctor"], { env: box.env });
    const out = stripAnsi(res.stdout);
    record(
      "doctor on a machine without an install fails with the fix",
      res.code === 1 && /No statusline\.js/.test(out) && /init/.test(out),
      `exit ${res.code}`
    );
  });

  withBox("doctor-ok", (box) => {
    runCli(["init", "--yes"], { env: box.env });
    const res = runCli(["doctor"], { env: box.env });
    const out = stripAnsi(res.stdout);
    record(
      "doctor on a fresh install runs the bar and reports ok",
      res.code === 0 && /spawn\s+ok/.test(out) && /\bok\b\s*$/.test(out.trim()),
      `exit ${res.code}: ${out.slice(-300)}`
    );

    const markdown = runCli(["doctor", "--markdown"], { env: box.env });
    record(
      "doctor --markdown shows the home folder as ~",
      !markdown.stdout.includes(box.home) && /~[\\/]\.agy-powerline/.test(markdown.stdout),
      markdown.stdout.slice(0, 300)
    );

    const meta = path.join(box.installDir, "install.json");
    fs.writeFileSync(meta, JSON.stringify({ ...readJson(meta), version: "0.0.1" }));
    const stale = stripAnsi(runCli(["doctor"], { env: box.env }).stdout);
    record(
      "doctor flags installed scripts older than the CLI",
      /Installed scripts are v0\.0\.1/.test(stale) && /init --yes/.test(stale)
    );
  });
}

module.exports = { run };
