"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, runCli } = require("../helpers");
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
        ["default", "compact", "workspace", "limits", "full"].every((id) =>
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
        /Applied preset.*One line/i.test(setPreset.stdout),
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
}

module.exports = { run };
