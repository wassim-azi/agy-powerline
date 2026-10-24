"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, runCli, PAYLOAD } = require("../helpers");
const { applyRenderOverrides, detectStyle } = require("../../src/lib/shared");
const { isQuitKey, wrapCursor, openUrl, REPO_URL } = require("../../src/cli/configure");

async function run() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-cli-"));
  const env = { ...process.env, AGY_POWERLINE_HOME: sandbox };

  try {
    const listTheme = runCli(["theme", "--list"], { env });
    record(
      "theme --list lists themes and indicates current",
      listTheme.code === 0 &&
        /agy-powerline themes/i.test(listTheme.stdout) &&
        /dark-aurora/i.test(listTheme.stdout) &&
        /light-paper/i.test(listTheme.stdout) &&
        /colorblind-dark/i.test(listTheme.stdout),
      `exit ${listTheme.code}`
    );

    const setTheme = runCli(["theme", "dark-ocean"], { env });
    const configPath = path.join(sandbox, "statusline.config.json");
    let cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    record(
      "theme <name> updates config to specified theme",
      setTheme.code === 0 &&
        cfg.theme === "dark-ocean" &&
        /Theme set to.*Dark Ocean/i.test(setTheme.stdout),
      `exit ${setTheme.code}`
    );

    const setAlias = runCli(["theme", "light"], { env });
    cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    record(
      "theme <alias> resolves to its theme (light -> light-paper)",
      setAlias.code === 0 && cfg.theme === "light-paper" && /alias: light/i.test(setAlias.stdout),
      `exit ${setAlias.code}`
    );

    const setInvalidTheme = runCli(["theme", "nonexistent-theme"], { env });
    record(
      "theme <invalid> rejects with exit 1",
      setInvalidTheme.code === 1 && /Unknown theme/i.test(setInvalidTheme.stderr),
      `exit ${setInvalidTheme.code}`
    );

    const listLayout = runCli(["layout", "--list"], { env });
    record(
      "layout --list lists layouts",
      listLayout.code === 0 &&
        /agy-powerline layouts/i.test(listLayout.stdout) &&
        /pills/i.test(listLayout.stdout) &&
        /lines/i.test(listLayout.stdout),
      `exit ${listLayout.code}`
    );

    const setLayout = runCli(["layout", "lines"], { env });
    cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    record(
      "layout <name> updates config to specified layout",
      setLayout.code === 0 &&
        cfg.layout === "lines" &&
        /Layout set to.*Lines/i.test(setLayout.stdout),
      `exit ${setLayout.code}`
    );

    const setInvalidLayout = runCli(["layout", "nonexistent-layout"], { env });
    record(
      "layout <invalid> rejects with exit 1",
      setInvalidLayout.code === 1 && /Unknown layout/i.test(setInvalidLayout.stderr),
      `exit ${setInvalidLayout.code}`
    );

    const listPresets = runCli(["preset", "--list"], { env });
    record(
      "preset --list lists presets",
      listPresets.code === 0 &&
        /agy-powerline presets/i.test(listPresets.stdout) &&
        ["default", "compact", "agent", "git", "tokens", "quotas", "full"].every((id) =>
          listPresets.stdout.includes(id)
        ),
      `exit ${listPresets.code}`
    );

    const layoutBefore = cfg.layout;
    const setPreset = runCli(["preset", "compact"], { env });
    cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    record(
      "preset <name> sets the preset widgets and keeps the layout",
      setPreset.code === 0 &&
        cfg.widgets.some((w) => w.id === "quota") &&
        cfg.layout === layoutBefore &&
        /Applied preset.*Compact/i.test(setPreset.stdout),
      `exit ${setPreset.code}, layout ${layoutBefore} -> ${cfg.layout}`
    );

    const setInvalidPreset = runCli(["preset", "nonexistent-preset"], { env });
    record(
      "preset <invalid> rejects with exit 1",
      setInvalidPreset.code === 1 && /Unknown preset/i.test(setInvalidPreset.stderr),
      `exit ${setInvalidPreset.code}`
    );

    const listGradients = runCli(["gradient", "--list"], { env });
    record(
      "gradient --list lists the presets and off",
      listGradients.code === 0 &&
        /agy-powerline gradients/i.test(listGradients.stdout) &&
        ["aurora", "sunset", "rainbow", "off"].every((id) => listGradients.stdout.includes(id)),
      `exit ${listGradients.code}`
    );

    const setGradient = runCli(["gradient", "Sunset"], { env });
    cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    record(
      "gradient <name> saves the preset",
      setGradient.code === 0 &&
        cfg.gradient === "sunset" &&
        /Gradient set to.*Sunset/i.test(setGradient.stdout),
      `exit ${setGradient.code}`
    );

    const setStops = runCli(["gradient", "#F00-00f"], { env });
    cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    record(
      "gradient <hex stops> saves them normalized",
      setStops.code === 0 && cfg.gradient === "#ff0000-#0000ff",
      `exit ${setStops.code}, ${cfg.gradient}`
    );

    const setInvalidGradient = runCli(["gradient", "#ff0000"], { env });
    cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    record(
      "gradient <invalid> rejects with exit 1 and keeps the saved gradient",
      setInvalidGradient.code === 1 &&
        /Unknown gradient/i.test(setInvalidGradient.stderr) &&
        cfg.gradient === "#ff0000-#0000ff",
      `exit ${setInvalidGradient.code}`
    );

    const gradientOff = runCli(["gradient", "off"], { env });
    cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    record(
      "gradient off removes the setting",
      gradientOff.code === 0 && !("gradient" in cfg),
      `exit ${gradientOff.code}`
    );

    record(
      "wrapCursor circles from last item to first item on down arrow",
      wrapCursor(3, 1, 4) === 0,
      `expected 0, got ${wrapCursor(3, 1, 4)}`
    );

    record(
      "wrapCursor circles from first item to last item on up arrow",
      wrapCursor(0, -1, 4) === 3,
      `expected 3, got ${wrapCursor(0, -1, 4)}`
    );

    record(
      "wrapCursor steps forward and backward within bounds",
      wrapCursor(1, 1, 4) === 2 && wrapCursor(2, -1, 4) === 1,
      `forward: ${wrapCursor(1, 1, 4)}, backward: ${wrapCursor(2, -1, 4)}`
    );

    record(
      "configure: q types into a text field instead of quitting; Ctrl+C always quits",
      isQuitKey({ name: "q" }, false) &&
        !isQuitKey({ name: "q" }, true) &&
        isQuitKey({ name: "c", ctrl: true }, true) &&
        !isQuitKey({ name: "c" }, false)
    );

    record(
      "wrapCursor handles empty lists safely",
      wrapCursor(0, 1, 0) === 0 && wrapCursor(0, -1, 0) === 0,
      `empty list cursor: ${wrapCursor(0, 1, 0)}`
    );

    record(
      "configure exports canonical GitHub repository URL",
      REPO_URL === "https://github.com/wassim-azi/agy-powerline"
    );

    record("openUrl is a callable redirection helper", typeof openUrl === "function");
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  testExportImport();
  testRenderOverrides();
}

function testRenderOverrides() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-render-overrides-"));
  const installDir = path.join(root, ".agy-powerline");
  const env = { ...process.env, HOME: root, USERPROFILE: root, AGY_POWERLINE_HOME: installDir };
  fs.mkdirSync(installDir, { recursive: true });
  const configPath = path.join(installDir, "statusline.config.json");
  const config = {
    theme: "dark-aurora",
    layout: "pills",
    gradient: "aurora",
    widgets: [{ id: "model" }],
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  const before = fs.readFileSync(configPath, "utf8");

  try {
    const all = applyRenderOverrides(config, {
      preset: "compact",
      layout: "lines",
      theme: "light",
      caps: "flat",
      gradient: "sunset",
      language: "en-GB",
    });
    record(
      "render overrides compose in the documented order and change only the returned config",
      all.invalid.length === 0 &&
        all.config.layout === "lines" &&
        all.config.theme === "light-paper" &&
        all.config.gradient === "sunset" &&
        all.config.language === "en" &&
        detectStyle(all.config.powerline) === "flat" &&
        JSON.stringify(all.config.widgets.map((widget) => widget.id)) ===
          JSON.stringify(["model", "quota", "contextPct", "git"])
    );

    const presetThenLayout = applyRenderOverrides(config, {
      preset: "compact",
      layout: "pills",
    });
    const noGradient = applyRenderOverrides(config, { gradient: "off" });
    record(
      "the explicit layout follows the preset and gradient off clears only the render value",
      presetThenLayout.config.layout === "pills" &&
        !Object.hasOwn(noGradient.config, "gradient") &&
        config.gradient === "aurora"
    );

    const rendered = runCli(
      [
        "render",
        "--demo",
        "--preset",
        "compact",
        "--layout",
        "lines",
        "--theme",
        "light",
        "--caps",
        "flat",
        "--gradient",
        "sunset",
        "--language",
        "en-GB",
      ],
      { env }
    );
    const expectedDir = path.join(root, "expected-config");
    fs.mkdirSync(expectedDir, { recursive: true });
    fs.writeFileSync(
      path.join(expectedDir, "statusline.config.json"),
      JSON.stringify(all.config, null, 2)
    );
    const expected = runCli(["render", "--demo"], {
      env: { ...env, AGY_POWERLINE_HOME: expectedDir },
    });
    record(
      "render overrides match the equivalent saved config without saving them",
      rendered.code === 0 &&
        expected.code === 0 &&
        rendered.stdout === expected.stdout &&
        fs.readFileSync(configPath, "utf8") === before,
      `exit ${rendered.code}: ${rendered.stderr}`
    );

    const help = runCli(["render", "--help"], { env });
    record(
      "render --help documents each per-render override",
      help.code === 0 &&
        [
          "--preset <id>",
          "--layout <id>",
          "--theme <id>",
          "--caps <style>",
          "--gradient <name|colors>",
          "--language <code>",
        ].every((option) => help.stdout.includes(option)),
      help.stdout
    );

    const plain = runCli(
      [
        "render",
        "--demo",
        "--preset",
        "compact",
        "--layout",
        "pills",
        "--theme",
        "light",
        "--caps",
        "angled",
        "--gradient",
        "sunset",
        "--ascii",
        "--color",
        "none",
      ],
      { env }
    );
    const hasColorCodes = /\u001b\[(?:\d+;)*(?:38|48);/.test(plain.stdout);
    const hasNonAscii = [...plain.stdout].some((character) => character.codePointAt(0) > 127);
    record(
      "per-render overrides preserve ASCII and no-color rendering",
      plain.code === 0 && !hasNonAscii && !hasColorCodes,
      JSON.stringify(plain.stdout)
    );

    const invalidOptions = [
      ["--preset", "unknown-preset"],
      ["--layout", "grid"],
      ["--theme", "unknown-theme"],
      ["--caps", "unknown-style"],
      ["--gradient", "unknown-gradient"],
      ["--language", "xx"],
    ];
    const invalidResults = invalidOptions.map(([flag, value]) => {
      const dump = path.join(root, `must-not-write-${flag.slice(2)}.json`);
      const result = runCli(["render", flag, value, "--dump-payload", dump], {
        env,
        input: PAYLOAD,
      });
      return { flag, value, result, dump };
    });
    // The same wording as the theme, layout, preset, caps and gradient commands.
    record(
      "each invalid render override exits before output or a requested payload dump",
      invalidResults.every(
        ({ value, result, dump }) =>
          result.code === 1 &&
          result.stdout === "" &&
          new RegExp(`Unknown [a-z ]+ "${value}"\\.\\n Available [a-z ]+: [a-z]`).test(
            result.stderr
          ) &&
          !fs.existsSync(dump)
      ) && fs.readFileSync(configPath, "utf8") === before,
      invalidResults.map(({ flag, result }) => `${flag}: ${result.stderr.trim()}`).join("; ")
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// export and import in a home of their own: round trip, merge, refusals, the
// backup, and shell commands that must never come in unnoticed.
function testExportImport() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-share-"));
  const home = path.join(root, "home");
  const installDir = path.join(home, ".agy-powerline");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home, AGY_POWERLINE_HOME: installDir };
  const configPath = path.join(installDir, "statusline.config.json");
  const readConfig = () => JSON.parse(fs.readFileSync(configPath, "utf8"));
  const file = (name, data) => {
    const target = path.join(root, name);
    fs.writeFileSync(target, typeof data === "string" ? data : JSON.stringify(data));
    return target;
  };
  const cli = (...args) => runCli(args, { env });

  try {
    cli("theme", "dark-ocean");
    cli("layout", "lines");

    const stdout = cli("export");
    let exported = null;
    try {
      exported = JSON.parse(stdout.stdout);
    } catch {
      // checked below
    }
    record(
      "export without a file prints the config as JSON with the release that wrote it",
      stdout.code === 0 &&
        exported?.agyPowerline?.version === require("../../package.json").version &&
        exported.theme === "dark-ocean" &&
        Array.isArray(exported.widgets),
      `exit ${stdout.code}`
    );

    const out = path.join(root, "my-bar.json");
    const written = cli("export", out);
    const again = cli("export", out);
    const forced = cli("export", out, "--force");
    record(
      "export <file> writes it, refuses to replace it, and replaces it with --force",
      written.code === 0 &&
        fs.existsSync(out) &&
        again.code === 1 &&
        /already exists/.test(again.stderr) &&
        forced.code === 0,
      `${written.code} ${again.code} ${forced.code}`
    );

    cli("theme", "light-paper");
    cli("layout", "pills");
    const before = fs.readFileSync(configPath, "utf8");
    const roundTrip = cli("import", out, "--yes");
    const restored = readConfig();
    record(
      "import --yes brings an exported config back as it was",
      roundTrip.code === 0 &&
        restored.theme === "dark-ocean" &&
        restored.layout === "lines" &&
        JSON.stringify(restored.widgets) === JSON.stringify(exported.widgets),
      `exit ${roundTrip.code}`
    );
    record(
      "import keeps the previous config as statusline.config.json.bak",
      fs.readFileSync(`${configPath}.bak`, "utf8") === before
    );

    const merged = cli(
      "import",
      file("theme-only.json", { theme: "dark-neon" }),
      "--merge",
      "--yes"
    );
    const afterMerge = readConfig();
    record(
      "import --merge changes only the settings the file has",
      merged.code === 0 && afterMerge.theme === "dark-neon" && afterMerge.layout === "lines",
      `exit ${merged.code}`
    );
    const replaced = cli("import", file("theme-only.json", { theme: "dark-neon" }), "--yes");
    record(
      "import without --merge replaces the whole config, with defaults for the rest",
      replaced.code === 0 && readConfig().layout === "pills",
      `exit ${replaced.code}`
    );

    const noTty = cli("import", file("theme-only.json", { theme: "dark-ember" }));
    record(
      "import without --yes and without a TTY changes nothing",
      noTty.code === 1 && /No TTY/.test(noTty.stderr) && readConfig().theme === "dark-neon",
      `exit ${noTty.code}`
    );

    const unknown = cli(
      "import",
      file("unknown.json", { widgets: [{ id: "model" }, { id: "nope" }], wat: 1 }),
      "--yes"
    );
    record(
      "import lists the widgets and settings it leaves out",
      unknown.code === 0 &&
        /unknown widget "nope"/.test(unknown.stdout) &&
        /"wat"/.test(unknown.stdout),
      unknown.stdout
    );

    const unchanged = fs.readFileSync(configPath, "utf8");
    const refusals = [
      ["a non-JSON file", file("bad.json", "{ not json")],
      ["a top-level array", file("array.json", "[]")],
      ["a file over 256 KB", file("big.json", JSON.stringify({ x: "y".repeat(300 * 1024) }))],
      ["a missing file", path.join(root, "missing.json")],
      [
        "a file from a newer major release",
        file("newer.json", { agyPowerline: { version: "99.0.0" } }),
      ],
    ];
    for (const [label, target] of refusals) {
      const result = cli("import", target, "--yes", "--allow-exec");
      record(
        `import refuses ${label} and changes nothing`,
        result.code === 1 &&
          /Nothing was changed/.test(result.stderr) &&
          fs.readFileSync(configPath, "utf8") === unchanged,
        `exit ${result.code}: ${result.stderr.trim()}`
      );
    }

    const ESC = String.fromCharCode(27);
    const withCommand = file("command.json", {
      widgets: [{ id: "model" }, { id: "exec", cmd: `echo ${ESC}]52;c;ZXZpbA==${ESC}\\ hi` }],
    });
    const blocked = cli("import", withCommand, "--yes");
    record(
      "import refuses new shell commands without --allow-exec, even with --yes",
      blocked.code === 1 &&
        /adds shell commands/.test(blocked.stderr) &&
        fs.readFileSync(configPath, "utf8") === unchanged,
      `exit ${blocked.code}`
    );
    record(
      "a new command is shown in full, with its control characters escaped",
      blocked.stdout.includes("echo \\u001b]52;c;ZXZpbA==\\u001b\\ hi") &&
        !blocked.stdout.includes(ESC + "]52"),
      JSON.stringify(blocked.stdout.slice(-200))
    );
    const allowed = cli("import", withCommand, "--yes", "--allow-exec");
    record(
      "import --yes --allow-exec brings the command in",
      allowed.code === 0 && readConfig().widgets.some((widget) => widget.id === "exec"),
      `exit ${allowed.code}`
    );
    const known = cli("import", withCommand, "--merge", "--yes");
    record(
      "a command already in the config needs no --allow-exec",
      known.code === 0 && !/adds .* shell command/.test(known.stdout),
      `exit ${known.code}`
    );
    const note = cli("export");
    record(
      "export warns on stderr when the config holds commands, and keeps stdout pure JSON",
      /exec widget command/.test(note.stderr) && JSON.parse(note.stdout).widgets.length === 2
    );

    fs.writeFileSync(configPath, "{ broken");
    const brokenImport = cli("import", out, "--yes");
    const brokenExport = cli("export");
    record(
      "export and import refuse to work over a config with a JSON error",
      brokenImport.code === 1 &&
        brokenExport.code === 1 &&
        brokenExport.stdout === "" &&
        fs.readFileSync(configPath, "utf8") === "{ broken",
      `${brokenImport.code} ${brokenExport.code}`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
