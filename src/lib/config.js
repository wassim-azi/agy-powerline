"use strict";

const fs = require("fs");
const path = require("path");
const { resolveColorModeId } = require("./colors");
const { resolveThemeId, canonicalThemeId, normalizeGradient } = require("./themes");
const { stripControl, normalizeClock } = require("./formatters");
const { normalizePowerline, applyStyle, STYLES } = require("./powerline");
const { writeFileAtomic, PRIVATE_FILE_MODE } = require("./paths");
const { isMeterStyle } = require("./widget-style");

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
  "os",
  "host",
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
  "sessionTime",
  "ram",
  "version",
  "sandbox",
  "cacheRead",
  "cacheCreate",
  "cacheHit",
  "totalTokens",
  "clock",
  "tokensToday",
  "tokensWeek",
  "exec",
  "customText",
  "separator",
  "lineBreak",
]);

// Editors that read "$schema" complete and check the config file with it.
const CONFIG_SCHEMA_URL = "https://agy-powerline.com/schema/v1.json";

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
  classic: {
    id: "classic",
    name: "Classic",
    description: "Plain colored text with | dividers and █░│ block meters",
  },
};

const LAYOUT_ORDER = ["pills", "lines", "classic"];

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
    // Kept so an editor keeps checking the file after the CLI saves it.
    ...(typeof raw?.$schema === "string" && raw.$schema.length <= 2048
      ? { $schema: stripControl(raw.$schema) }
      : {}),
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

  // An unknown meter style is left out: each layout then draws its own.
  if (isMeterStyle(raw?.meterStyle)) {
    result.meterStyle = raw.meterStyle;
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
// the user picked. Each answers one question and keeps all its widgets at 80
// columns (full at 100); widgets with nothing to show hide on their own.
const PRESETS = {
  default: {
    id: "default",
    name: "Default",
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
    name: "Compact",
    description: "One row: short model, tightest quota, context % and git",
    widgets: [{ id: "model", short: true }, { id: "quota" }, { id: "contextPct" }, { id: "git" }],
  },
  agent: {
    id: "agent",
    name: "Agent activity",
    description: "Agent state, subagents, title and mode; context, artifacts, quota",
    widgets: [
      { id: "agentState" },
      { id: "tasks" },
      { id: "title" },
      { id: "separator" },
      { id: "mode" },
      { id: "sandbox" },
      { id: "lineBreak" },
      { id: "model", short: true },
      { id: "contextPct" },
      { id: "artifacts" },
      { id: "separator" },
      { id: "quota" },
    ],
  },
  git: {
    id: "git",
    name: "Git focus",
    description: "Project, branch, worktree, stash; changed files and lines, commit",
    widgets: [
      { id: "project" },
      { id: "git" },
      { id: "gitWorktree" },
      { id: "gitStash" },
      { id: "separator" },
      { id: "model", short: true },
      { id: "lineBreak" },
      { id: "gitFiles" },
      { id: "gitChanges" },
      { id: "gitSha" },
      { id: "separator" },
      { id: "contextPct" },
      { id: "quota" },
    ],
  },
  tokens: {
    id: "tokens",
    name: "Token usage",
    description: "Session tokens in and out, cache hit; tokens today and over 7 days",
    widgets: [
      { id: "model", short: true },
      { id: "contextTokens" },
      { id: "separator" },
      { id: "totalTokens", split: true },
      { id: "cacheHit" },
      { id: "lineBreak" },
      { id: "tokensToday" },
      { id: "tokensWeek" },
      { id: "separator" },
      { id: "quota" },
    ],
  },
  quotas: {
    id: "quotas",
    name: "Quota watch",
    description: "Plan and model; 5h and 7d quotas side by side; third-party and Argon",
    widgets: [
      { id: "plan" },
      { id: "separator" },
      { id: "model", short: true },
      { id: "lineBreak" },
      { id: "fiveHourBar" },
      { id: "fiveHourReset" },
      { id: "separator" },
      { id: "weeklyBar" },
      { id: "weeklyReset" },
      { id: "lineBreak" },
      { id: "thirdPartyFiveHour" },
      { id: "thirdPartyWeekly" },
      { id: "separator" },
      { id: "argonWeekly" },
      { id: "argonReset" },
    ],
  },
  full: {
    id: "full",
    name: "Everything",
    description: "Session, project and git; context, tokens and cache; both quotas",
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

const PRESET_ORDER = ["default", "compact", "agent", "git", "tokens", "quotas", "full"];

function applyPreset(baseConfig, presetName) {
  const preset = PRESETS[presetName] || PRESETS.default;
  return mergeConfig({
    ...baseConfig,
    widgets: preset.widgets.map((w) => ({ ...w })),
  });
}

// Apply one-render settings without writing them to the user's config. Invalid
// values are reported by name only so callers can show or log a safe error.
function applyRenderOverrides(baseConfig, overrides = {}) {
  let config = mergeConfig(baseConfig);
  const invalid = [];

  if (overrides.preset !== undefined) {
    const preset =
      typeof overrides.preset === "string" ? overrides.preset.trim().toLowerCase() : "";
    if (Object.hasOwn(PRESETS, preset)) {
      config = applyPreset(config, preset);
    } else {
      invalid.push("preset");
    }
  }

  if (overrides.layout !== undefined) {
    const layout =
      typeof overrides.layout === "string" ? overrides.layout.trim().toLowerCase() : "";
    if (Object.hasOwn(LAYOUTS, layout)) {
      config = mergeConfig({ ...config, layout });
    } else {
      invalid.push("layout");
    }
  }

  if (overrides.theme !== undefined) {
    const theme = canonicalThemeId(overrides.theme);
    // resolveThemeId() falls back to the default theme for an unknown id.
    if (typeof overrides.theme === "string" && resolveThemeId(theme) === theme) {
      config = mergeConfig({ ...config, theme });
    } else {
      invalid.push("theme");
    }
  }

  if (overrides.caps !== undefined) {
    const caps = typeof overrides.caps === "string" ? overrides.caps.trim().toLowerCase() : "";
    if (Object.hasOwn(STYLES, caps)) {
      config = mergeConfig({ ...config, powerline: applyStyle(config.powerline, caps) });
    } else {
      invalid.push("caps");
    }
  }

  if (overrides.gradient !== undefined) {
    const gradient = typeof overrides.gradient === "string" ? overrides.gradient.trim() : "";
    if (gradient.toLowerCase() === "off") {
      const withoutGradient = { ...config };
      delete withoutGradient.gradient;
      config = mergeConfig(withoutGradient);
    } else {
      const normalized = normalizeGradient(gradient);
      if (normalized) {
        config = mergeConfig({ ...config, gradient: normalized });
      } else {
        invalid.push("gradient");
      }
    }
  }

  return { config, invalid };
}

module.exports = {
  CONFIG_SCHEMA_URL,
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
  applyRenderOverrides,
};
