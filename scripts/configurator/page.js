// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Pure page logic for the web configurator: URL hash encode/decode, share links,
// pasted config loading, sample payloads, preview rendering and widget manipulations.
// Callable in Node (for unit tests) and in the browser.

let Agy;
if (typeof require !== "undefined") {
  try {
    Agy = {
      ...require("../../src/lib/shared"),
      ...require("../../src/lib/themes"),
      ...require("../../src/lib/powerline"),
      ...require("../../src/lib/catalog"),
      ...require("../../src/lib/widget-style"),
      ...require("../../src/lib/colors"),
      ...require("../../src/lib/widget-options"),
      ...require("../../src/lib/config-check"),
      ...require("../site/ansi"),
    };
  } catch {
    // Browser environment
  }
}

function getAgy() {
  if (typeof globalThis !== "undefined" && globalThis.AgyConfigurator) {
    return globalThis.AgyConfigurator;
  }
  return Agy;
}

function toBase64Url(str) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "base64url").toString("utf8");
  }
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) {
    b64 += "=";
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function encodeConfig(config) {
  const json = JSON.stringify(config);
  return toBase64Url(json);
}

function decodeConfig(hashOrString) {
  const clean = String(hashOrString ?? "")
    .replace(/^#/, "")
    .trim();
  if (!clean) {
    return null;
  }
  const json = fromBase64Url(clean);
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Top-level config is not an object");
  }
  const agy = getAgy();
  return agy.mergeConfig(parsed);
}

const MAX_SHARE_URL_LENGTH = 2000;

function buildShareUrl(config, baseUrl = "") {
  const hash = encodeConfig(config);
  const url = `${baseUrl}#${hash}`;
  return {
    hash,
    url,
    length: url.length,
    tooLong: url.length > MAX_SHARE_URL_LENGTH,
  };
}

function loadPastedConfig(text, currentConfig) {
  const agy = getAgy();
  if (typeof text !== "string" || !text.trim()) {
    return {
      ok: false,
      error: "Empty config text",
      config: currentConfig,
      dropped: [],
    };
  }

  let raw;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (err) {
    const at = String(err.message).match(/position \d+|line \d+ column \d+/)?.[0];
    return {
      ok: false,
      error: `Not valid JSON${at ? ` (${at})` : ""}`,
      config: currentConfig,
      dropped: [],
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: "Top-level value is not an object",
      config: currentConfig,
      dropped: [],
    };
  }

  const dropped = agy.droppedSettings(raw);
  const merged = agy.mergeConfig(raw);
  return {
    ok: true,
    config: merged,
    dropped,
  };
}

const FAKE_DIR = "/home/you/projects/agy-powerline";

function withQuota(data, fiveHour, weekly, contextUsed) {
  return {
    ...data,
    quota: {
      ...data.quota,
      "gemini-5h": { ...data.quota["gemini-5h"], remaining_fraction: fiveHour },
      "gemini-weekly": { ...data.quota["gemini-weekly"], remaining_fraction: weekly },
    },
    context_window: {
      ...data.context_window,
      used_percentage: contextUsed,
      remaining_percentage: 100 - contextUsed,
    },
  };
}

function createSampleData(kind = "normal") {
  const agy = getAgy();
  const sample = {
    ...agy.sampleData(),
    cwd: FAKE_DIR,
    workspace: { current_dir: FAKE_DIR, project_dir: FAKE_DIR },
  };

  if (kind === "caution") {
    return withQuota(sample, 0.22, 0.25, 75);
  }
  if (kind === "danger") {
    return withQuota(sample, 0.05, 0.08, 95);
  }
  return sample;
}

function renderPreview(config, options = {}) {
  const agy = getAgy();
  const sampleKind = options.sampleKind || "normal";
  const terminalWidth = Number(options.terminalWidth) || 96;
  const colorDepth = options.colorDepth || config.color || "truecolor";

  const data = createSampleData(sampleKind);
  data.terminal_width = terminalWidth;

  const text = agy.renderStatusline(data, config, { color: colorDepth });
  const html = agy.ansiToHtml(text);
  return { text, html };
}

function addWidget(widgets, id, afterIndex = -1) {
  const list = [...widgets];
  let widget = { id };
  if (id === "customText") {
    widget = { id, text: "Custom" };
  } else if (id === "exec") {
    widget = { id, cmd: "git stash list | wc -l" };
  }

  if (afterIndex < 0 || afterIndex >= list.length) {
    list.push(widget);
  } else {
    list.splice(afterIndex + 1, 0, widget);
  }
  return list;
}

function removeWidget(widgets, index) {
  if (index < 0 || index >= widgets.length) {
    return [...widgets];
  }
  const list = [...widgets];
  list.splice(index, 1);
  return list;
}

function moveWidget(widgets, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    fromIndex >= widgets.length ||
    toIndex < 0 ||
    toIndex >= widgets.length ||
    fromIndex === toIndex
  ) {
    return [...widgets];
  }
  const list = [...widgets];
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
  return list;
}

function updateWidget(widgets, index, updates) {
  if (index < 0 || index >= widgets.length) {
    return [...widgets];
  }
  const list = [...widgets];
  const current = { ...list[index] };
  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) {
      delete current[key];
    } else {
      current[key] = val;
    }
  }
  list[index] = current;
  return list;
}

function widgetRows(widgets) {
  const rows = [[]];
  for (let i = 0; i < widgets.length; i++) {
    const w = widgets[i];
    if (w.id === "lineBreak") {
      rows.push([]);
    } else {
      rows[rows.length - 1].push({ ...w, index: i });
    }
  }
  return rows;
}

function hasExecWidgets(widgets) {
  return Array.isArray(widgets) && widgets.some((w) => w && w.id === "exec");
}

const pageApi = {
  encodeConfig,
  decodeConfig,
  buildShareUrl,
  loadPastedConfig,
  withQuota,
  createSampleData,
  renderPreview,
  addWidget,
  removeWidget,
  moveWidget,
  updateWidget,
  widgetRows,
  hasExecWidgets,
  MAX_SHARE_URL_LENGTH,
};

if (typeof globalThis !== "undefined") {
  globalThis.AgyPageLogic = pageApi;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = pageApi;
}
