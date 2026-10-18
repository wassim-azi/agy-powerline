"use strict";

const fs = require("fs");
const path = require("path");
const { resolveColorModeId } = require("./colors");
const { resolveThemeId, normalizeGradient } = require("./themes");
const { stripControl, normalizeClock } = require("./formatters");
const { normalizePowerline } = require("./powerline");
const { writeFileAtomic, PRIVATE_FILE_MODE } = require("./paths");

// Display text in widget configs is printed as-is, so strip terminal control
// from it. cmd/command are left alone: they are executed, not printed.
function cleanWidget(widget) {
  const out = { ...widget };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string" && key !== "cmd" && key !== "command") {
      out[key] = stripControl(value);
    }
  }
  return out;
}

const VALID_WIDGET_IDS = new Set([
  "model",
  "quota",
  "fiveHourPct",
  "fiveHourReset",
  "fiveHourBar",
  "weeklyPct",
  "weeklyReset",
  "weeklyBar",
  "thirdPartyFiveHour",
  "thirdPartyWeekly",
  "argonWeekly",
  "argonReset",
  "context",
  "contextPct",
  "contextTokens",
  "cwd",
  "project",
  "git",
  "gitChanges",
  "gitFiles",
  "gitSha",
  "gitStash",
  "gitWorktree",
  "plan",
  "agentState",
  "artifacts",
  "tasks",
  "mode",
  "title",
  "ram",
  "version",
  "sandbox",
  "cacheRead",
  "cacheCreate",
  "cacheHit",
  "totalTokens",
  "exec",
  "customText",
  "separator",
  "lineBreak",
]);

let configDir = __dirname;

function setConfigDir(dir) {
  configDir = dir;
}

function getConfigDir() {
  return configDir;
}

function getConfigPath() {
  return path.join(configDir, "statusline.config.json");
}

const LAYOUTS = {
  pills: {
    id: "pills",
    name: "Pills",
    description: "Powerline clusters with caps, joins and meters",
  },
  lines: {
    id: "lines",
    name: "Lines",
    description: "Plain colored text with dividers and dot meters",
  },
};

const LAYOUT_ORDER = ["pills", "lines"];

function resolveLayoutId(layoutId) {
  return LAYOUTS[layoutId] ? layoutId : "pills";
}

const DEFAULT_THRESHOLDS = {
  quotaWarn: 30,
  quotaCrit: 10,
  contextWarn: 70,
  contextCrit: 90,
  blink: false,
};

function defaultConfig() {
  return {
    theme: "dark-aurora",
    emojis: true,
    ascii: false,
    color: "auto",
    layout: "pills",
    pacing: true,
    minimalist: false,
    rowGap: false,
    log: true,
    clock: normalizeClock(),
    thresholds: { ...DEFAULT_THRESHOLDS },
    powerline: normalizePowerline(),
    widgets: [
      { id: "model" },
      { id: "separator" },
      { id: "context" },
      { id: "separator" },
      { id: "git" },
      { id: "lineBreak" },
      { id: "fiveHourBar" },
      { id: "fiveHourReset" },
      { id: "separator" },
      { id: "weeklyBar" },
      { id: "weeklyReset" },
    ],
  };
}

function mergeConfig(raw) {
  const fallback = defaultConfig();
  const powerline = normalizePowerline(raw?.powerline);

  let widgetsList = fallback.widgets;
  if (Array.isArray(raw?.widgets)) {
    const normalized = raw.widgets
      .filter((widget) => widget && VALID_WIDGET_IDS.has(widget.id))
      .map(cleanWidget);
    widgetsList = normalized.length ? normalized : fallback.widgets;
  }

  const rawThresholds =
    raw && typeof raw.thresholds === "object" && raw.thresholds !== null ? raw.thresholds : {};
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...rawThresholds,
  };
  if (typeof rawThresholds.quotaWarn === "number") thresholds.quotaWarn = rawThresholds.quotaWarn;
  if (typeof rawThresholds.quotaCrit === "number") thresholds.quotaCrit = rawThresholds.quotaCrit;
  if (typeof rawThresholds.contextWarn === "number")
    thresholds.contextWarn = rawThresholds.contextWarn;
  if (typeof rawThresholds.contextCrit === "number")
    thresholds.contextCrit = rawThresholds.contextCrit;
  if (rawThresholds.blink !== undefined) thresholds.blink = rawThresholds.blink;

  const result = {
    theme: resolveThemeId(raw?.theme ?? fallback.theme),
    emojis: raw?.emojis !== false,
    ascii: raw?.ascii === true,
    color: resolveColorModeId(raw?.color ?? fallback.color),
    layout: resolveLayoutId(raw?.layout ?? fallback.layout),
    pacing: raw?.pacing !== false,
    minimalist: raw?.minimalist === true,
    rowGap: raw?.rowGap === true,
    log: raw?.log !== false,
    clock: normalizeClock(raw?.clock),
    thresholds,
    powerline,
    widgets: widgetsList,
  };

  if (raw && typeof raw.customTheme === "object" && raw.customTheme !== null) {
    result.customTheme = raw.customTheme;
  }

  // Only a valid gradient is kept; anything else renders the plain theme.
  const gradient = normalizeGradient(raw?.gradient);
  if (gradient) {
    result.gradient = gradient;
  }

  return result;
}

// A missing or empty file just means defaults. A file that can't be read or
// parsed is reported in `error` so nobody saves defaults over a config the
// user can still fix; `config` then holds the defaults to render with.
function readConfigFile() {
  let text;

  try {
    text = fs.readFileSync(getConfigPath(), "utf8").replace(/^\uFEFF/, "");
  } catch (err) {
    if (err.code === "ENOENT") {
      return { exists: false, config: defaultConfig() };
    }
    return { exists: true, config: defaultConfig(), error: stripControl(err.message) };
  }

  if (!text.trim()) {
    return { exists: true, config: defaultConfig() };
  }

  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { exists: true, config: defaultConfig(), error: "top-level value is not an object" };
    }
    return { exists: true, config: mergeConfig(raw) };
  } catch (err) {
    // Newer Node quotes part of the file in the message; it may hold anything.
    return { exists: true, config: defaultConfig(), error: stripControl(err.message) };
  }
}

function loadConfig() {
  return readConfigFile().config;
}

class InvalidConfigError extends Error {
  constructor(file, reason) {
    super(`${file} is not valid JSON (${reason})`);
    this.name = "InvalidConfigError";
    this.file = file;
    this.reason = reason;
  }
}

// Refuses to replace a config that exists but can't be parsed: the caller
// only ever saw defaults, and writing them would erase the user's widgets.
function saveConfig(config) {
  const current = readConfigFile();
  if (current.error) {
    throw new InvalidConfigError(getConfigPath(), current.error);
  }

  writeFileAtomic(getConfigPath(), JSON.stringify(mergeConfig(config), null, 2) + "\n", {
    mode: PRIVATE_FILE_MODE,
  });
}

// Presets set the widget list only; the layout (Pills or Lines) stays the one
// the user picked. Each keeps all its widgets at 80 columns (full at 100).
const PRESETS = {
  default: {
    id: "default",
    name: "Everyday",
    description: "Model, context and git; 5h and 7d quotas with resets on a second row",
    widgets: [
      { id: "model" },
      { id: "separator" },
      { id: "context" },
      { id: "separator" },
      { id: "git" },
      { id: "lineBreak" },
      { id: "fiveHourBar" },
      { id: "fiveHourReset" },
      { id: "separator" },
      { id: "weeklyBar" },
      { id: "weeklyReset" },
    ],
  },
  compact: {
    id: "compact",
    name: "One line",
    description: "Short model, tightest quota, context % and git on a single row",
    widgets: [{ id: "model", short: true }, { id: "quota" }, { id: "contextPct" }, { id: "git" }],
  },
  workspace: {
    id: "workspace",
    name: "Several repos",
    description: "Project, git, agent state and model; context, tightest quota and mode below",
    widgets: [
      { id: "project" },
      { id: "git" },
      { id: "agentState" },
      { id: "separator" },
      { id: "model", short: true },
      { id: "lineBreak" },
      { id: "context" },
      { id: "separator" },
      { id: "quota" },
      { id: "mode" },
    ],
  },
  limits: {
    id: "limits",
    name: "Heavy usage",
    description: "5h, 7d, third-party and Argon quotas with resets, one quota per row",
    widgets: [
      { id: "fiveHourBar" },
      { id: "fiveHourReset" },
      { id: "lineBreak" },
      { id: "weeklyBar" },
      { id: "weeklyReset" },
      { id: "lineBreak" },
      { id: "thirdPartyFiveHour" },
      { id: "thirdPartyWeekly" },
      { id: "lineBreak" },
      { id: "argonWeekly" },
      { id: "argonReset" },
    ],
  },
  full: {
    id: "full",
    name: "Everything",
    description: "Session, project and git; context, tokens and cache; both quotas, on three rows",
    widgets: [
      { id: "agentState" },
      { id: "tasks" },
      { id: "model" },
      { id: "plan" },
      { id: "sandbox" },
      { id: "separator" },
      { id: "project" },
      { id: "git" },
      { id: "lineBreak" },
      { id: "context" },
      { id: "totalTokens", split: true },
      { id: "cacheHit" },
      { id: "mode" },
      { id: "lineBreak" },
      { id: "fiveHourBar" },
      { id: "fiveHourReset" },
      { id: "separator" },
      { id: "weeklyBar" },
      { id: "weeklyReset" },
    ],
  },
};

const PRESET_ORDER = ["default", "compact", "workspace", "limits", "full"];

function applyPreset(baseConfig, presetName) {
  const preset = PRESETS[presetName] || PRESETS.default;
  return mergeConfig({
    ...baseConfig,
    widgets: preset.widgets.map((w) => ({ ...w })),
  });
}

module.exports = {
  setConfigDir,
  getConfigDir,
  getConfigPath,
  LAYOUTS,
  LAYOUT_ORDER,
  DEFAULT_THRESHOLDS,
  VALID_WIDGET_IDS,
  resolveLayoutId,
  defaultConfig,
  mergeConfig,
  readConfigFile,
  loadConfig,
  InvalidConfigError,
  saveConfig,
  PRESETS,
  PRESET_ORDER,
  applyPreset,
};
