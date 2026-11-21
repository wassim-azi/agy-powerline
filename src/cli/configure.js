// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const readline = require("readline");
const { setConfigDir, sampleData, mergeConfig } = require("../lib/shared");
const { resolveInstallDir } = require("../lib/paths");
const { GRADIENTS } = require("../lib/themes");
const { loadEditableConfig } = require("./config-guard");
const { setActiveDepth, getActiveDepth, resolveColorDepth } = require("../lib/colors");
const {
  HIDE,
  SHOW,
  ALT_ON,
  ALT_OFF,
  HOME_CLEAR,
  REPO_URL,
  createState,
  persist,
  wrapCursor,
  openUrl,
} = require("./tui/state");
const { tabAfter, isQuitKey, drawFrameLines, handleKey } = require("./tui/keys");

const DEPRECATED_CONFIGURE_DELAY_MS = 5000;

function configureCommand(options = {}) {
  setConfigDir(options.configDir || resolveInstallDir());
  return runTui(options);
}

// Draws one screen without a terminal, for tests. Options: config, screen,
// cursor, columns, rows, scroll (the first row shown of a long list), color
// ("truecolor", "256", "none"), search, flash, editIndex and textInput (the
// widget editor), and widgets (a list used as is, even empty, which a saved
// config never is).
function renderFrame(options = {}) {
  const config = mergeConfig(options.config || {});
  if (options.widgets) {
    config.widgets = options.widgets;
  }
  const screen = options.screen || "main";
  const state = createState({
    config,
    customGradientSpec: config.gradient && !GRADIENTS[config.gradient] ? config.gradient : null,
    screen,
    cursor: options.cursor || 0,
    searchQuery: options.search || "",
    flashMessage: options.flash || "",
    glyphSlot: options.glyphSlot || "separator",
    hexInput: options.hexInput ?? null,
    editIndex: options.editIndex ?? 0,
    textInput: options.textInput ?? null,
    previewData: options.data || sampleData(),
    previewScenario: options.scenario || "default",
    previewWidthOverride: options.previewWidth ?? null,
    columnsOverride: options.columns || 100,
    rowsOverride: options.rows || 50,
    scrollTop: options.scroll || 0,
    scrollScreen: screen,
  });

  const previousDepth = getActiveDepth();
  setActiveDepth(options.color || "truecolor");
  try {
    return drawFrameLines(state).join("\n");
  } finally {
    setActiveDepth(previousDepth);
  }
}

function start(options = {}) {
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;

  if (!stdin.isTTY || !stdout.isTTY) {
    console.error("Run this in an interactive terminal:");
    console.error("  npx agy-powerline");
    process.exitCode = 1;
    return Promise.resolve(false);
  }

  const config = loadEditableConfig();
  if (!config) {
    process.exitCode = 1;
    return Promise.resolve(false);
  }

  setActiveDepth(resolveColorDepth({ configColor: config.color, env: process.env }));

  const state = createState({
    config,
    previewData: sampleData(),
    customGradientSpec: config.gradient && !GRADIENTS[config.gradient] ? config.gradient : null,
    flashMessage: options.flash || "",
    stdin,
    stdout,
  });

  const onExit = options.onExit || null;
  let resolvePromise = null;
  let rejectPromise = null;

  function draw() {
    stdout.write(HOME_CLEAR + HIDE + drawFrameLines(state).join("\n") + "\n");
  }

  function cleanupTui() {
    stdin.off("keypress", onKey);
    process.off("SIGINT", quit);
    process.off("SIGTERM", quit);
    stdout.off("resize", draw);
    stdin.setRawMode?.(false);
    stdin.pause?.();
    stdout.write(SHOW + ALT_OFF);
  }

  function quit() {
    if (state.exiting) {
      return;
    }

    state.exiting = true;
    let saveError = null;
    try {
      persist(state);
    } catch (err) {
      saveError = err;
    }

    const resolve = resolvePromise;
    const reject = rejectPromise;
    resolvePromise = null;
    rejectPromise = null;

    cleanupTui();

    try {
      onExit?.();
    } finally {
      if (saveError) {
        reject?.(saveError);
      } else {
        resolve?.(true);
      }
    }
  }

  function onKey(_str, key) {
    handleKey(state, key, { draw, quit });
  }

  return new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    readline.emitKeypressEvents(stdin);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("keypress", onKey);
    process.on("SIGINT", quit);
    process.on("SIGTERM", quit);
    // The frame follows the window width, so redraw before a resize wraps it.
    stdout.on("resize", draw);
    stdout.write(ALT_ON + HIDE);
    draw();
  });
}

async function deprecatedConfigureCommand(options = {}) {
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const delayMs = options.delayMs ?? DEPRECATED_CONFIGURE_DELAY_MS;
  const label = stderr.isTTY ? "\x1b[33mWarning:\x1b[0m" : "Warning:";

  stderr.write(
    `${label} The 'configure' parameter (and 'config') is obsolete and will be removed in the next releases. Run 'npx agy-powerline' instead.\n`
  );

  if (!stdin.isTTY || !stdout.isTTY) {
    return configureCommand(options);
  }

  if (delayMs > 0) {
    stderr.write(`Opening editor in ${Math.ceil(delayMs / 1000)}s...\n`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return configureCommand(options);
}

function runTui(options = {}) {
  return start(options);
}

module.exports = {
  configureCommand,
  deprecatedConfigureCommand,
  DEPRECATED_CONFIGURE_DELAY_MS,
  runTui,
  renderFrame,
  tabAfter,
  isQuitKey,
  wrapCursor,
  openUrl,
  REPO_URL,
};

if (require.main === module) {
  configureCommand().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
