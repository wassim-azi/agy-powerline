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
  testDoctorMasksHost();
  testUpgradeFromSeparateFiles();
  testChoiceFlags();
  await testChoose();
}

function testChoiceFlags() {
  withBox("choices", (box) => {
    const res = runCli(
      ["init", "--yes", "--preset", "compact", "--layout", "lines", "--theme", "light"],
      {
        env: box.env,
      }
    );
    const config = readJson(path.join(box.installDir, "statusline.config.json"));
    record(
      "init --preset --layout --theme writes those three, with the light alias resolved",
      res.code === 0 &&
        config?.layout === "lines" &&
        config?.theme === "light-paper" &&
        JSON.stringify(config.widgets.map((widget) => widget.id)) ===
          JSON.stringify(["model", "quota", "contextPct", "git"]),
      res.stderr || JSON.stringify(config)
    );

    // A config of your own is kept; a flag changes only its setting.
    const file = path.join(box.installDir, "statusline.config.json");
    fs.writeFileSync(file, JSON.stringify({ ...config, theme: "dark-ocean" }, null, 2));
    runCli(["init", "--yes"], { env: box.env });
    const kept = readJson(file);
    const themed = runCli(["init", "--yes", "--theme", "dark-ember"], { env: box.env });
    const changed = readJson(file);
    record(
      "a second init keeps the config it finds, and --theme changes only the theme",
      kept?.theme === "dark-ocean" &&
        changed?.theme === "dark-ember" &&
        changed.layout === "lines" &&
        JSON.stringify(changed.widgets) === JSON.stringify(kept.widgets) &&
        /kept yours, with theme dark-ember/.test(stripAnsi(themed.stdout)),
      themed.stdout
    );
  });

  withBox("choice-unknown", (box) => {
    const res = runCli(["init", "--yes", "--preset", "nope"], { env: box.env });
    record(
      "an unknown --preset exits 1 and writes nothing: no settings, no scripts",
      res.code === 1 &&
        /Unknown preset "nope"/.test(stripAnsi(res.stderr)) &&
        /Available presets: default, compact/.test(res.stderr) &&
        !fs.existsSync(box.installDir) &&
        !fs.existsSync(box.settingsPath),
      res.stderr
    );
    const layout = runCli(["init", "--yes", "--layout", "grid"], { env: box.env });
    const theme = runCli(["init", "--yes", "--theme", "neon-pink"], { env: box.env });
    record(
      "unknown --layout and --theme values are refused the same way",
      layout.code === 1 &&
        theme.code === 1 &&
        /Unknown layout "grid"/.test(layout.stderr) &&
        /Unknown theme "neon-pink"/.test(theme.stderr) &&
        !fs.existsSync(box.installDir)
    );
  });

  withBox("choice-language", (box) => {
    const unknown = runCli(["init", "--yes", "--language", "xx"], { env: box.env });
    record(
      "an unknown --language exits 1 with the available languages and writes nothing",
      unknown.code === 1 &&
        /Unknown language "xx"/.test(stripAnsi(unknown.stderr)) &&
        /Available languages: en/.test(unknown.stderr) &&
        !fs.existsSync(box.installDir),
      unknown.stderr
    );
    const res = runCli(["init", "--yes", "--language", "en-GB"], { env: box.env });
    const config = readJson(path.join(box.installDir, "statusline.config.json"));
    record(
      "init --language saves the language it resolves to",
      res.code === 0 && config?.language === "en",
      res.stderr || JSON.stringify(config)
    );

    const file = path.join(box.installDir, "statusline.config.json");
    fs.writeFileSync(file, JSON.stringify({ ...config, language: "xx" }, null, 2));
    const doctor = stripAnsi(runCli(["doctor"], { env: box.env }).stdout);
    record(
      "doctor says when the configured language isn't available",
      /language "xx" isn't available, so the bar shows English/.test(doctor) &&
        /Available: en/.test(doctor),
      doctor.slice(-400)
    );
  });

  withBox("choice-no-tty", (box) => {
    const res = runCli(["init"], { env: box.env });
    const config = readJson(path.join(box.installDir, "statusline.config.json"));
    record(
      "without a terminal, init asks nothing and installs the default bar",
      res.code === 0 &&
        !/Which widgets|Choose 1-/.test(stripAnsi(res.stdout)) &&
        config?.theme === "dark-aurora" &&
        config?.layout === "pills",
      res.stdout + res.stderr
    );
  });
}

// choose() with a fake readline that answers from a list.
async function testChoose() {
  const { choose } = require("../../src/lib/prompt");
  const ask = async (answers, defaultIndex = 0) => {
    const asked = [];
    const rl = {
      question: (query, callback) => {
        asked.push(query);
        callback(answers.shift() ?? "");
      },
    };
    const index = await choose(rl, "Pick", ["a", "b", "c"], defaultIndex, () => {});
    return { index, asked: asked.length };
  };
  const enter = await ask([""], 1);
  const two = await ask(["2"]);
  const third = await ask(["9", "x", "1"], 2);
  const bad = await ask(["9", "x", "0"], 2);
  record(
    "choose(): Enter keeps the default, a number picks, and three bad answers keep the default",
    enter.index === 1 &&
      two.index === 1 &&
      third.index === 0 &&
      third.asked === 3 &&
      bad.index === 2 &&
      bad.asked === 3,
    JSON.stringify({ enter, two, third, bad })
  );
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
    record(
      "init ends with a link to the project page",
      stripAnsi(res.stdout)
        .split(/\r?\n/)
        .some((line) => line.trim() === "https://github.com/wassim-azi/agy-powerline"),
      res.stdout
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

    // Render flags appended to our command survive a re-run, without a prompt.
    const flagged = readJson(box.settingsPath);
    flagged.statusLine.command += " --theme light-paper --layout lines";
    writeSettings(box, flagged);
    const rerun = runCli(["init", "--yes"], { env: box.env });
    const third = readJson(box.settingsPath)?.statusLine;
    record(
      "a later init keeps render flags appended to the command",
      rerun.code === 0 &&
        third?.command === flagged.statusLine.command &&
        /kept\s+render flags --theme light-paper --layout lines/.test(stripAnsi(rerun.stdout)),
      `exit ${rerun.code}: ${JSON.stringify(third)}`
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

    const settings = readJson(box.settingsPath);
    settings.statusLine.command += " --theme light-paper --layout lines";
    writeSettings(box, settings);
    const overrideDoctor = stripAnsi(runCli(["doctor"], { env: box.env }).stdout);
    record(
      "doctor lists the configured per-render overrides",
      /overrides\s+--theme light-paper, --layout lines/.test(overrideDoctor),
      overrideDoctor.slice(0, 500)
    );
    record(
      "doctor accepts render flags after the installed command",
      !overrideDoctor.includes("does not match this install"),
      overrideDoctor.slice(-500)
    );
    const foreign = readJson(box.settingsPath);
    foreign.statusLine.command += " && other-tool";
    writeSettings(box, foreign);
    record(
      "doctor still warns about a command that only starts like the installed one",
      stripAnsi(runCli(["doctor"], { env: box.env }).stdout).includes("does not match this install")
    );
    writeSettings(box, settings);

    const markdown = runCli(["doctor", "--markdown"], { env: box.env });
    record(
      "doctor --markdown shows the home folder as ~ and lists render overrides",
      !markdown.stdout.includes(box.home) &&
        /~[\\/]\.agy-powerline/.test(markdown.stdout) &&
        markdown.stdout.includes("**Render Overrides**") &&
        markdown.stdout.includes("--theme light-paper, --layout lines"),
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

function testDoctorMasksHost() {
  const { maskHost } = require("../../src/cli/doctor");
  const names = { username: "alex", hostname: "devbox" };
  record(
    "doctor's bar preview shows user@host instead of the real names",
    maskHost("🤖 Gemini │ 👤 alex@devbox │ 🌿 main", names) ===
      "🤖 Gemini │ 👤 user@host │ 🌿 main" &&
      maskHost("👤 devbox", names) === "👤 host" &&
      maskHost("📂 ~/devboxes/app", names) === "📂 ~/devboxes/app" &&
      maskHost("👤 alex@devbox", { username: "", hostname: "" }) === "👤 alex@devbox"
  );
}

module.exports = { run };
