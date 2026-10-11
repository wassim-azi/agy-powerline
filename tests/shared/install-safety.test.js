"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { record, runCli, stageInstall, stripAnsi, NODE, PAYLOAD } = require("../helpers");
const {
  renderStatusline,
  defaultConfig,
  readConfigFile,
  saveConfig,
  setConfigDir,
  getConfigDir,
  InvalidConfigError,
} = require("../../src/lib/shared");
const { isSafeBranchName } = require("../../src/lib/git");
const { saveDiskCache } = require("../../src/lib/exec");
const { setLogDir, getLogPath, logWarning } = require("../../src/lib/log");
const { writePayloadDump } = require("../../src/lib/payload-dump");
const { stripControl } = require("../../src/lib/formatters");
const { version } = require("../../package.json");

// Fresh fake home per scenario: settings.json and ~/.agy-powerline live there.
function sandbox(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `agy-verify-${name}-`));
  const home = path.join(root, "home");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.AGY_POWERLINE_HOME;
  return {
    root,
    home,
    env,
    installDir: path.join(home, ".agy-powerline"),
    settingsPath: path.join(home, ".gemini", "antigravity-cli", "settings.json"),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function writeSettings(box, text) {
  fs.mkdirSync(path.dirname(box.settingsPath), { recursive: true });
  fs.writeFileSync(box.settingsPath, text, "utf8");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function testInitRefusesUnparseableSettings() {
  const box = sandbox("jsonc");
  const original =
    '{\n  // my settings\n  "theme": "dark",\n  "mcpServers": { "x": { "command": "foo" } }\n}\n';

  try {
    writeSettings(box, original);
    const res = runCli(["init", "--yes"], { env: box.env });
    record(
      "init refuses a settings.json with comments and leaves it byte-for-byte intact",
      res.code === 1 &&
        /not valid JSON/i.test(res.stderr) &&
        fs.readFileSync(box.settingsPath, "utf8") === original &&
        !fs.existsSync(path.join(box.installDir, "statusline.js")),
      `exit ${res.code}`
    );
  } finally {
    box.cleanup();
  }
}

function testInitPreservesSettingsAndBacksUp() {
  const box = sandbox("preserve");
  const original = JSON.stringify(
    { theme: "dark", mcpServers: { x: { command: "foo" } } },
    null,
    2
  );

  try {
    writeSettings(box, original);
    const res = runCli(["init", "--yes", "--stack"], { env: box.env });
    const settings = readJson(box.settingsPath);
    record(
      "init keeps every other settings.json key and writes a backup",
      res.code === 0 &&
        settings?.theme === "dark" &&
        settings?.mcpServers?.x?.command === "foo" &&
        settings?.statusLine?.type === "command" &&
        settings?.statusLine?.stack_with_default === true &&
        fs.readFileSync(`${box.settingsPath}.agy-powerline.bak`, "utf8") === original,
      `exit ${res.code}`
    );

    const noStack = runCli(["init", "--yes", "--no-stack"], { env: box.env });
    record(
      "init --no-stack clears a previous stack_with_default",
      noStack.code === 0 &&
        readJson(box.settingsPath)?.statusLine?.stack_with_default === undefined,
      `exit ${noStack.code}`
    );

    const uninstall = runCli(["uninstall", "--yes"], { env: box.env });
    const after = readJson(box.settingsPath);
    record(
      "uninstall removes only statusLine and keeps other settings",
      uninstall.code === 0 && after?.theme === "dark" && after?.mcpServers?.x && !after?.statusLine,
      `exit ${uninstall.code}`
    );
  } finally {
    box.cleanup();
  }
}

function testUninstallDeleteIsScoped() {
  const box = sandbox("delete");

  try {
    // AGY_POWERLINE_HOME pointing at a folder that is not an install.
    const notOurs = path.join(box.root, "documents");
    fs.mkdirSync(notOurs, { recursive: true });
    fs.writeFileSync(path.join(notOurs, "thesis.txt"), "keep me", "utf8");
    const refused = runCli(["uninstall", "--yes", "--delete"], {
      env: { ...box.env, AGY_POWERLINE_HOME: notOurs },
    });
    record(
      "uninstall --delete refuses a directory that is not an agy-powerline install",
      refused.code === 1 && fs.existsSync(path.join(notOurs, "thesis.txt")),
      `exit ${refused.code}`
    );

    // A real install with an extra user file: installed files go, the user file stays.
    runCli(["init", "--yes"], { env: box.env });
    const userFile = path.join(box.installDir, "my-notes.txt");
    fs.writeFileSync(userFile, "mine", "utf8");
    const partial = runCli(["uninstall", "--yes", "--delete"], { env: box.env });
    record(
      "uninstall --delete removes installed files but keeps unrelated files",
      partial.code === 0 &&
        fs.existsSync(userFile) &&
        !fs.existsSync(path.join(box.installDir, "statusline.js")) &&
        !fs.existsSync(path.join(box.installDir, "shared.js")) &&
        !fs.existsSync(path.join(box.installDir, "layouts")),
      `exit ${partial.code}`
    );

    // A clean install is removed completely.
    fs.rmSync(userFile);
    runCli(["init", "--yes"], { env: box.env });
    const full = runCli(["uninstall", "--yes", "--delete"], { env: box.env });
    record(
      "uninstall --delete removes a clean install directory entirely",
      full.code === 0 && !fs.existsSync(box.installDir),
      `exit ${full.code}`
    );
  } finally {
    box.cleanup();
  }
}

function testCliParser() {
  const ver = runCli(["--version"]);
  record("--version prints the package version", ver.code === 0 && ver.stdout.trim() === version);

  const unknownCmd = runCli(["frobnicate"]);
  record(
    "unknown command exits 1 with an error",
    unknownCmd.code === 1 && /unknown command/i.test(unknownCmd.stderr)
  );

  const unknownOpt = runCli(["theme", "--bogus"]);
  record(
    "unknown option exits 1 with an error",
    unknownOpt.code === 1 && /unknown option/i.test(unknownOpt.stderr)
  );

  const alias = runCli(["config", "--help"]);
  record(
    "the config alias names the configure command",
    alias.code === 0 && /configure/i.test(alias.stdout)
  );

  const help = runCli(["--help"]);
  record(
    "--help lists every command",
    help.code === 0 &&
      [
        "init",
        "configure",
        "theme",
        "layout",
        "preset",
        "caps",
        "doctor",
        "uninstall",
        "render",
      ].every((name) => help.stdout.includes(name))
  );
}

function testUntrustedTextIsStripped() {
  const osc52 = "\x1b]52;c;ZXZpbA==\x07";
  const payload = {
    ...JSON.parse(PAYLOAD),
    vcs: { type: "git", branch: `main${osc52}`, dirty: false },
    model: { display_name: `Gemini\x1b[2J\x1b[H` },
  };
  const out = renderStatusline(payload, {
    ...defaultConfig(),
    widgets: [{ id: "model" }, { id: "git" }, { id: "customText", text: `hi${osc52}` }],
  });
  record(
    "payload strings and widget text are stripped of terminal control sequences",
    /main/.test(out) &&
      /Gemini/.test(out) &&
      /hi/.test(out) &&
      !out.includes("]52;") &&
      !out.includes("[2J")
  );

  // A branch name is free text from the repo: no extra rows, no reversed text.
  const spoof = renderStatusline(
    { vcs: { type: "git", branch: "main\u2028evil\u202Egnp.exe\u2066x\u2069", dirty: false } },
    { ...defaultConfig(), widgets: [{ id: "git" }] }
  );
  const kept = stripControl("👨\u200D💻 \u200Fשלום");
  record(
    "line separators and bidi overrides are stripped; emoji joiners and RTL marks stay",
    /mainevil/.test(spoof) &&
      !/[\u2028\u2029\u202A-\u202E\u2066-\u2069]/.test(spoof) &&
      kept === "👨\u200D💻 \u200Fשלום"
  );

  record(
    "isSafeBranchName accepts normal names and rejects option/traversal shapes",
    isSafeBranchName("main") &&
      isSafeBranchName("feature/login-v2") &&
      !isSafeBranchName("--output=/tmp/x") &&
      !isSafeBranchName("../../etc/passwd") &&
      !isSafeBranchName("a b") &&
      !isSafeBranchName("x\x1b]52")
  );
}

// A config with a typo must survive every command: before, they loaded the
// defaults in its place and saved them over the user's widgets.
function testBrokenConfigIsNeverOverwritten() {
  const box = sandbox("broken-config");
  const env = { ...box.env, AGY_POWERLINE_HOME: box.installDir };
  const configPath = path.join(box.installDir, "statusline.config.json");
  const broken = '{\n  "theme": "dark-ocean",\n  "widgets": [{ "id": "model" },]\n}\n';

  try {
    stageInstall(box.installDir);
    fs.writeFileSync(configPath, broken, "utf8");

    for (const args of [
      ["caps", "angled"],
      ["theme", "dark-ember"],
      ["layout", "lines"],
      ["preset", "minimal"],
    ]) {
      const res = runCli(args, { env });
      record(
        `${args[0]} refuses an unparseable config and leaves it byte-for-byte intact`,
        res.code === 1 &&
          /not valid JSON/i.test(res.stderr) &&
          fs.readFileSync(configPath, "utf8") === broken,
        `exit ${res.code}`
      );
    }

    const runtime = spawnSync(NODE, [path.join(box.installDir, "statusline.js")], {
      input: PAYLOAD,
      encoding: "utf8",
      env,
    });
    record(
      "the bar warns about an unparseable config and still renders the defaults",
      runtime.status === 0 &&
        /invalid statusline\.config\.json/.test(runtime.stdout) &&
        /Gemini/.test(runtime.stdout) &&
        /invalid statusline\.config\.json/.test(runtime.stderr),
      `exit ${runtime.status}`
    );

    const demo = runCli(["render", "--demo", "--color", "none"], { env });
    record(
      "render --demo shows the same warning",
      demo.code === 0 && demo.stdout.startsWith("[agy-powerline: invalid statusline.config.json")
    );

    const doctor = runCli(["doctor"], { env });
    record(
      "doctor reports an unparseable config",
      doctor.code === 1 &&
        /statusline\.config\.json is not valid JSON/.test(stripAnsi(doctor.stdout))
    );

    record(
      "nothing else touched the broken config",
      fs.readFileSync(configPath, "utf8") === broken
    );
  } finally {
    box.cleanup();
  }
}

function testSaveConfigGuard() {
  const box = sandbox("save-guard");
  const previousDir = getConfigDir();
  const configPath = path.join(box.installDir, "statusline.config.json");

  try {
    setConfigDir(box.installDir);

    record(
      "a missing config is not an error",
      !readConfigFile().error && readConfigFile().exists === false
    );

    fs.mkdirSync(box.installDir, { recursive: true });
    fs.writeFileSync(configPath, "  \n", "utf8");
    record("an empty config is not an error", !readConfigFile().error);

    fs.writeFileSync(configPath, "[1, 2]", "utf8");
    record("a config that is not an object is an error", Boolean(readConfigFile().error));

    fs.writeFileSync(configPath, '{ "theme": ', "utf8");
    let thrown = null;
    try {
      saveConfig(defaultConfig());
    } catch (error) {
      thrown = error;
    }
    record(
      "saveConfig refuses to replace an unparseable config",
      thrown instanceof InvalidConfigError && fs.readFileSync(configPath, "utf8") === '{ "theme": '
    );

    fs.writeFileSync(configPath, '{ "theme": "dark-ocean" }', "utf8");
    saveConfig({ ...readConfigFile().config, layout: "lines" });
    const saved = JSON.parse(fs.readFileSync(configPath, "utf8"));
    record(
      "saveConfig still updates a valid config and leaves no temp file behind",
      saved.theme === "dark-ocean" &&
        saved.layout === "lines" &&
        fs.readdirSync(box.installDir).every((name) => !name.endsWith(".tmp"))
    );
  } finally {
    setConfigDir(previousDir);
    box.cleanup();
  }
}

function testUninstallStopsOnUnparseableSettings() {
  const box = sandbox("uninstall-jsonc");
  const original = '{\n  // my settings\n  "statusLine": { "command": "x" }\n}\n';

  try {
    stageInstall(box.installDir);
    writeSettings(box, original);
    const res = runCli(["uninstall", "--yes", "--delete"], { env: box.env });
    record(
      "uninstall --delete deletes nothing when settings.json can't be parsed",
      res.code === 1 &&
        /not valid JSON/i.test(res.stderr) &&
        fs.readFileSync(box.settingsPath, "utf8") === original &&
        fs.existsSync(path.join(box.installDir, "statusline.js")),
      `exit ${res.code}`
    );
  } finally {
    box.cleanup();
  }
}

// Our own files can hold the user's commands and their output: on a shared
// machine they must not be readable by other accounts. settings.json is the
// user's file, so it keeps whatever mode it had.
function testOwnFilesArePrivate() {
  if (process.platform === "win32") {
    record("own files are private (0600)", true, "skipped (Windows profile folders are private)");
    return;
  }

  const box = sandbox("private-files");
  const mode = (file) => fs.statSync(file).mode & 0o777;
  const configPath = path.join(box.installDir, "statusline.config.json");
  const previousConfigDir = getConfigDir();
  const previousLog = getLogPath();

  try {
    // An install from before this change: config readable by everyone.
    fs.mkdirSync(box.installDir, { recursive: true });
    fs.writeFileSync(configPath, "{}\n", { mode: 0o644 });
    fs.chmodSync(configPath, 0o644);
    writeSettings(box, '{\n  "theme": "dark"\n}\n');
    fs.chmodSync(box.settingsPath, 0o640);

    const res = runCli(["init", "--yes"], { env: box.env });

    setConfigDir(box.installDir);
    saveDiskCache({ k: { output: "secret", timestamp: Date.now() } });
    setLogDir(box.installDir);
    logWarning("private-file-test");
    const dump = path.join(box.installDir, "last-payload.json");
    writePayloadDump(dump, "{}");

    const modes = {
      config: mode(configPath),
      cache: mode(path.join(box.installDir, ".exec-cache.json")),
      log: mode(path.join(box.installDir, "agy-powerline.log")),
      dump: mode(dump),
      settings: mode(box.settingsPath),
    };
    record(
      "own files are private (0600) and settings.json keeps its mode",
      res.code === 0 &&
        modes.config === 0o600 &&
        modes.cache === 0o600 &&
        modes.log === 0o600 &&
        modes.dump === 0o600 &&
        modes.settings === 0o640,
      Object.entries(modes)
        .map(([name, m]) => `${name} ${m.toString(8)}`)
        .join(", ")
    );
  } finally {
    setConfigDir(previousConfigDir);
    setLogDir(previousLog ? path.dirname(previousLog) : null);
    box.cleanup();
  }
}

async function run() {
  testOwnFilesArePrivate();
  testUninstallStopsOnUnparseableSettings();
  testBrokenConfigIsNeverOverwritten();
  testSaveConfigGuard();
  testInitRefusesUnparseableSettings();
  testInitPreservesSettingsAndBacksUp();
  testUninstallDeleteIsScoped();
  testCliParser();
  testUntrustedTextIsStripped();
}

module.exports = { run };
