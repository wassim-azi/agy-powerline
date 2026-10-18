"use strict";

const {
  RESET,
  BLINK,
  BLINK_OFF,
  setActiveDepth,
  getActiveDepth,
  resolveColorDepth,
  resolveAscii,
  rgbToAnsi256,
  parseColor,
} = require("./colors");

const {
  THEMES,
  THEME_ORDER,
  THEME_KINDS,
  THEME_ALIASES,
  canonicalThemeId,
  buildCustomTheme,
  resolveTheme,
  themeColors,
} = require("./themes");

const {
  setConfigDir,
  getConfigDir,
  getConfigPath,
  LAYOUTS,
  LAYOUT_ORDER,
  DEFAULT_THRESHOLDS,
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
} = require("./config");

const {
  quotaColor,
  contextColor,
  resolveQuotaThresholds,
  resolveContextThresholds,
  shouldBlink,
  basenameOf,
  homePath,
  sanitizeDeep,
} = require("./formatters");

const { extractSession } = require("./session");
const { execPayloadJson } = require("./exec");
const { fitWidgets, truncateLines, widestLine } = require("./fit");

const {
  deriveLinesPalette,
  colorForRemainingPct,
  renderDotMeter,
  buildLinesSegment,
  buildLinesRows,
  renderLinesLayout,
} = require("./layouts/lines");

const { buildRows, renderPillRows } = require("./layouts/pills");
const { applyStyle, detectStyle } = require("./powerline");

// Silently rendering defaults would leave a broken config unnoticed, so the
// bar gets a warning line on top. The reason goes to stderr, not the bar.
function configWarning(overrides) {
  const env = overrides.env || process.env;
  const plain = "[agy-powerline: invalid statusline.config.json, showing defaults]";
  const depth = resolveColorDepth({ cliColor: overrides.color, env });
  return depth === "none" ? plain : `\x1b[33m${plain}${RESET}`;
}

function renderStatusline(data, config, overrides = {}) {
  const out = renderBar(data, config, overrides);
  return overrides.configError ? `${configWarning(overrides)}\n${out}` : out;
}

function renderBar(data, config, overrides) {
  const resolved = mergeConfig(config);
  const env = overrides.env || process.env;
  const ascii = resolveAscii(resolved, overrides, env);
  const emojis = resolved.emojis && !ascii;
  const colors = themeColors(resolved.theme, resolved.customTheme);
  // Payload fields and branch names are untrusted: strip terminal control
  // sequences from every string before any layout prints it.
  // Valid JSON can still be null, a number or an array; read those as empty.
  const payload = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const session = sanitizeDeep(
    extractSession(payload, resolved, { readUsage: overrides.usage === "read" })
  );
  // Exec widgets only run when the caller opts in ("run"); CLI previews keep
  // the default placeholder so rendering a config never executes it.
  session.execMode =
    overrides.exec === "run" || overrides.exec === "blocked" ? overrides.exec : "preview";
  session.execMemo = new Map();
  // Built only when a command will run and asked for it.
  if (
    session.execMode === "run" &&
    resolved.widgets.some((widget) => widget.id === "exec" && widget.payload === true)
  ) {
    session.execPayload = execPayloadJson(payload);
  }

  const prevDepth = getActiveDepth();

  setActiveDepth(
    resolveColorDepth({
      configColor: resolved.color,
      cliColor: overrides.color,
      env,
    })
  );

  try {
    const draw = (widgets) =>
      renderLayout(session, { ...resolved, widgets }, emojis, ascii, colors);
    const width = session.terminalWidth;
    let out = draw(resolved.widgets);

    // A bar wider than the terminal wraps into a mess, so overflowing rows
    // lose labels, then their least useful widgets, and are cut as a last resort.
    if (width > 0 && widestLine(out) > width) {
      out = draw(fitWidgets(resolved.widgets, width, (row) => widestLine(draw(row))));
      out = truncateLines(out, width, ascii);
    }

    return out;
  } finally {
    setActiveDepth(prevDepth);
  }
}

function renderLayout(session, config, emojis, ascii, colors) {
  if (config.layout === "lines") {
    return renderLinesLayout(session, emojis, ascii, colors, config);
  }

  // Pills read ascii from the config, so CLI and env overrides must land there.
  const pillConfig = { ...config, emojis, ascii };
  const rows = buildRows(session, pillConfig, colors);

  if (!rows.length) {
    return RESET;
  }

  return renderPillRows(rows, session, colors, pillConfig) + RESET;
}

module.exports = {
  // Config
  setConfigDir,
  getConfigDir,
  getConfigPath,
  LAYOUTS,
  LAYOUT_ORDER,
  resolveLayoutId,
  defaultConfig,
  readConfigFile,
  loadConfig,
  InvalidConfigError,
  saveConfig,
  mergeConfig,
  PRESETS,
  PRESET_ORDER,
  applyPreset,
  applyStyle,
  detectStyle,

  // Widget Catalog (lazy loaded)
  get WIDGET_CATALOG() {
    return require("./catalog").WIDGET_CATALOG;
  },
  get WIDGET_BY_ID() {
    return require("./catalog").WIDGET_BY_ID;
  },
  widgetLabel: (id) => require("./catalog").widgetLabel(id),

  // Themes
  THEMES,
  THEME_ORDER,
  THEME_KINDS,
  THEME_ALIASES,
  canonicalThemeId,
  themeColors,
  resolveTheme,
  buildCustomTheme,

  // Rendering
  renderStatusline,
  deriveLinesPalette,
  colorForRemainingPct,
  renderDotMeter,
  buildLinesSegment,
  buildLinesRows,

  // Mock Data (lazy loaded)
  sampleData: () => require("./mock-data").sampleData(),

  // Colors & String Helpers
  parseColor,
  homePath,
  basenameOf,
  resolveColorDepth,
  resolveAscii,
  rgbToAnsi256,
  BLINK,
  BLINK_OFF,

  // Thresholds & Alerts
  DEFAULT_THRESHOLDS,
  resolveQuotaThresholds,
  resolveContextThresholds,
  shouldBlink,
  quotaColor,
  contextColor,

  // Exec Widget
  runExecWidget: (widget, session) => require("./exec").runExecWidget(widget, session),
  sanitizeExecOutput: (text) => require("./exec").sanitizeExecOutput(text),
  clearExecCache: () => require("./exec").clearExecCache(),
  cacheKey: (cmd, cwd) => require("./exec").cacheKey(cmd, cwd),
};
