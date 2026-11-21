// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const readline = require("readline");
const { PassThrough } = require("stream");
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
  SYNC_ON,
  SYNC_OFF,
  MOUSE_ON,
  MOUSE_OFF,
  CURSOR_HOME,
  ERASE_LINE,
  CLEAR_BELOW,
  REPO_URL,
  createState,
  persist,
  wrapCursor,
  openUrl,
} = require("./tui/state");
const { tabAfter, isQuitKey, drawFrameLines, handleKey, handleMouse } = require("./tui/keys");

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
    filterActive: options.filter === true,
    showHelp: options.showHelp === true,
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

const SGR_MOUSE_RE = /\x1b\[<(\d+);(\d+);(\d+)([mM])/g;

function consumeMouseInput(raw, pending, onMouse) {
  const combined = pending + raw;
  let nextPending = "";
  const incomplete = combined.match(/\x1b\[<[0-9;]*$/);
  let scan = combined;
  if (incomplete && incomplete[0].length <= 24) {
    nextPending = incomplete[0];
    scan = combined.slice(0, incomplete.index);
  }
  let clean = "";
  let last = 0;
  SGR_MOUSE_RE.lastIndex = 0;
  for (const match of scan.matchAll(SGR_MOUSE_RE)) {
    clean += scan.slice(last, match.index);
    last = match.index + match[0].length;
    onMouse({
      button: Number(match[1]),
      col: Number(match[2]),
      row: Number(match[3]),
      release: match[4] === "m",
    });
  }
  clean += scan.slice(last);
  return { clean, pending: nextPending };
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

  const keyStream = new PassThrough();
  let mousePending = "";
  const onExit = options.onExit || null;
  let resolvePromise = null;
  let rejectPromise = null;

  function draw() {
    const lines = drawFrameLines(state).map((line) => line + ERASE_LINE);
    stdout.write(SYNC_ON + CURSOR_HOME + HIDE + lines.join("\n") + CLEAR_BELOW + SYNC_OFF);
  }

  function cleanupTui() {
    stdin.off("data", onData);
    keyStream.off("keypress", onKey);
    keyStream.destroy();
    process.off("SIGINT", quit);
    process.off("SIGTERM", quit);
    stdout.off("resize", draw);
    stdin.setRawMode?.(false);
    stdin.pause?.();
    stdout.write(MOUSE_OFF + SYNC_OFF + SHOW + ALT_OFF);
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

  function onMouse(event) {
    handleMouse(state, event, { draw });
  }

  function onData(chunk) {
    const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    const result = consumeMouseInput(text, mousePending, onMouse);
    mousePending = result.pending;
    if (result.clean) {
      keyStream.write(result.clean);
    }
  }

  function onKey(_str, key) {
    handleKey(state, key, { draw, quit });
  }

  return new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;

    try {
      readline.emitKeypressEvents(keyStream);
      stdin.setRawMode?.(true);
      stdin.resume();
      stdin.on("data", onData);
      keyStream.on("keypress", onKey);
      process.on("SIGINT", quit);
      process.on("SIGTERM", quit);
      // The frame follows the window width, so redraw before a resize wraps it.
      stdout.on("resize", draw);
      stdout.write(ALT_ON + HIDE + MOUSE_ON);
      draw();
    } catch (err) {
      cleanupTui();
      reject(err);
    }
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
