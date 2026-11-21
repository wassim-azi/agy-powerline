// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const {
  rgb,
  fg,
  mix,
  RESET,
  DIM,
  BOLD,
  NORMAL,
  BLINK,
  gradientColors,
  withContrast,
} = require("../colors");
const { gradientStops, terminalBackground } = require("../themes");
const {
  formatResetText,
  paceIndex,
  paceGlyph,
  formatPaceDelta,
  formatQuotaForecast,
  formatContextTokens,
  resolveQuotaThresholds,
  resolveContextThresholds,
  shouldBlink,
} = require("../formatters");
const { alignGroups } = require("./pills");
const { execWidgetOutput, restoreAfterReset } = require("../exec");
const {
  NAMED_COLORS,
  resolveColor,
  widgetColors,
  widgetTag,
  OS_ICONS,
  isRaw,
  isPaced,
  showsPaceDelta,
  showsForecast,
  METER_STYLES,
  meterStyle,
  resolveContextView,
  resolveQuotaView,
  hiddenByThreshold,
  hasNoData,
  RAM_CAUTION,
  RAM_DANGER,
  TITLE_MAX,
  subagentDetail,
  readEnvValue,
} = require("../widget-style");
const { renderWidget } = require("../widgets");
const { t } = require("../i18n");

const LINES = NAMED_COLORS;

function deriveLinesPalette(colors) {
  if (!colors) {
    return LINES;
  }
  return {
    model: colors.model || LINES.blue,
    location: colors.meta || LINES.cyan,
    git: colors.git || LINES.green,
    gitDirty: colors.gitDirty || LINES.red,
    agent: colors.model || LINES.magenta,
    text: colors.meta || LINES.white,
    context: colors.context || LINES.blue,
    quotaLow: colors.fiveHour || LINES.green,
    // Quota/context states: ok -> caution -> danger. The medium band stays
    // "ok" so each state has one unmistakable color (also for color-blind users).
    quotaMed: colors.fiveHour || LINES.green,
    quotaHigh: colors.caution || LINES.yellow,
    quotaCrit: colors.warn || LINES.red,
    track: colors.track || rgb(60, 65, 75),
  };
}

function colorForUsedPct(pct, palette = LINES, options = {}) {
  const crit = options.crit ?? 90;
  const warn = options.warn ?? 70;
  const med = options.med ?? 50;

  const critCol = palette.quotaCrit || palette.red || LINES.red;
  const highCol = palette.quotaHigh || palette.yellow || LINES.yellow;
  const medCol = palette.quotaMed || palette.orange || LINES.orange;
  const lowCol = palette.quotaLow || palette.green || LINES.green;

  if (pct >= crit) {
    return critCol;
  }

  if (pct >= warn) {
    return highCol;
  }

  if (pct >= med) {
    return medCol;
  }

  return lowCol;
}

function colorForRemainingPct(pct, palette = LINES, options = {}) {
  const crit = options.crit ?? 10;
  const warn = options.warn ?? 30;
  const med = options.med ?? 50;

  const critCol = palette.quotaCrit || palette.red || LINES.red;
  const highCol = palette.quotaHigh || palette.yellow || LINES.yellow;
  const medCol = palette.quotaMed || palette.orange || LINES.orange;
  const lowCol = palette.quotaLow || palette.green || LINES.green;

  if (pct <= crit) {
    return critCol;
  }

  if (pct <= warn) {
    return highCol;
  }

  if (pct <= med) {
    return medCol;
  }

  return lowCol;
}

function renderDotMeter(
  pctVal,
  width = 25,
  ascii = false,
  palette = LINES,
  isRemaining = false,
  options = {}
) {
  const pct = Math.max(0, Math.min(100, Number(pctVal)));
  const fillPct = isRemaining ? Math.max(0, Math.min(100, 100 - pct)) : pct;
  const filled = Math.min(width, Math.round((fillPct * width) / 100));
  const empty = width - filled;
  const color =
    options.color ??
    (isRemaining
      ? colorForRemainingPct(pct, palette, options)
      : colorForUsedPct(pct, palette, options));

  const marker = paceIndex(options.elapsedPct, width);
  const [full, blank, pace] = METER_STYLES[options.style] || METER_STYLES.dots;
  // A Classic meter is one color: the empty glyph's own texture (░) sets it
  // apart, and the pace marker is a thin line.
  const classic = options.classic === true;
  const track = palette.track || rgb(60, 65, 75);
  // ramp shades each filled cell by its place, from the theme's ok color to
  // caution to danger, over the track; rings keeps the fill's color, faded.
  const ramp = options.style === "ramp";
  const trackColor = ramp
    ? track
    : options.style === "rings"
      ? mix(color, track, 0.5)
      : classic
        ? color
        : track;
  const fillColor = (i) => (ramp ? rampColor(width > 1 ? i / (width - 1) : 0, palette) : color);
  const markerColor = palette.text || LINES.white;

  if (marker < 0 && !ramp) {
    if (ascii) {
      return fg(color) + "#".repeat(filled) + DIM + "-".repeat(empty) + RESET;
    }
    return fg(color) + full.repeat(filled) + fg(trackColor) + blank.repeat(empty) + RESET;
  }

  // The marker replaces the dot where the quota window currently is.
  const markGlyph = ascii ? paceGlyph(true) : pace || paceGlyph(false);
  // ASCII empties are dim; NORMAL ends that without dropping a blink.
  const undim = ascii ? NORMAL : "";
  let out = "";
  for (let i = 0; i < width; i++) {
    if (i === marker) {
      out += undim + fg(markerColor) + markGlyph;
    } else if (i < filled) {
      out += undim + fg(fillColor(i)) + (ascii ? "#" : full);
    } else {
      out += ascii ? DIM + "-" : fg(trackColor) + blank;
    }
  }
  return out + RESET;
}

// A point along the meter, 0 to 1, as a color between ok, caution and danger.
function rampColor(at, palette) {
  const ok = palette.quotaLow || LINES.green;
  const caution = palette.quotaHigh || LINES.yellow;
  const danger = palette.quotaCrit || LINES.red;
  return at <= 0.5 ? mix(ok, caution, at * 2) : mix(caution, danger, (at - 0.5) * 2);
}

function buildLinesSegment(id, session, palette, emojis, ascii = false, widget = {}, config = {}) {
  // Raw widgets keep only their value: no icon, no label.
  const raw = isRaw(widget, config);
  const tag = (icon) => widgetTag(id, { emojis, raw, icon, widget, ascii, lang: session.lang });
  // Meters: 25 cells, or 12 when the bar is fitted to a narrow terminal;
  // Classic draws the same cells as blocks.
  const classic = config.layout === "classic";
  const dots = widget?.compact ? 12 : 25;
  const style = meterStyle(widget, config, classic ? "classic" : "lines");
  const pace = (quota, thresh) => ({
    ...thresh,
    style,
    classic,
    elapsedPct: isPaced(widget, config) ? quota.elapsedPct : null,
  });

  const paceDelta = (quota) => {
    const delta = showsPaceDelta(widget) ? formatPaceDelta(quota, ascii) : "";
    return delta ? ` ${delta}` : "";
  };

  const forecast = (quota) => {
    const text = showsForecast(widget)
      ? formatQuotaForecast(quota, {
          format: widget.forecast,
          fallback: config.resetFormat || "countdown",
          clock: config.clock,
          lang: session.lang,
        })
      : "";
    return text ? `${ascii ? ", " : " · "}${text}` : "";
  };

  function quotaState(quota) {
    const thresh = resolveQuotaThresholds(widget, config);
    const view = resolveQuotaView(quota, config, session.lang);
    const level =
      view.remaining <= thresh.crit ? "crit" : view.remaining <= thresh.warn ? "warn" : "normal";
    const blinkSeq = !ascii && shouldBlink(level, thresh.blink) ? BLINK : "";
    const color = colorForRemainingPct(Math.round(view.remaining), palette, thresh);
    return { thresh, view, blinkSeq, color };
  }

  // A quota meter with its remaining or used %, for the 5h, 7d and third-party bars.
  function quotaMeter(quota) {
    const { thresh, view, blinkSeq, color } = quotaState(quota);
    return (
      blinkSeq +
      fg(palette.text) +
      tag() +
      renderDotMeter(view.pct, dots, ascii, palette, view.isRemaining, {
        ...pace(quota, thresh),
        color,
      }) +
      " " +
      fg(color) +
      view.text +
      RESET
    );
  }

  function quotaPct(quota) {
    const { view, blinkSeq, color } = quotaState(quota);
    const eta = forecast(quota);
    return (
      blinkSeq +
      fg(palette.text) +
      tag() +
      fg(color) +
      `${view.text}${paceDelta(quota)}` +
      (eta ? fg(palette.text) + eta : "") +
      RESET
    );
  }

  function quotaReset(quota, weekly) {
    const text = quota
      ? formatResetText(quota, {
          format: widget.format,
          fallback: config.resetFormat || "countdown",
          weekly,
          clock: config.clock,
        })
      : "";
    // No usable reset in the payload: hide rather than claim "now".
    return text ? fg(palette.text) + tag() + text + RESET : null;
  }

  // Context widgets share their state color and blink.
  function contextState() {
    const thresh = resolveContextThresholds(widget, config);
    const { size, pct, exceeds200k } = resolveContextView(widget, session);
    const isCrit = exceeds200k || pct >= thresh.crit;
    const isWarn = pct >= thresh.warn;
    const level = isCrit ? "crit" : isWarn ? "warn" : "normal";
    const blinkSeq = !ascii && shouldBlink(level, thresh.blink) ? BLINK : "";
    const contextPalette = palette.context
      ? { ...palette, quotaLow: palette.context, quotaMed: palette.context }
      : palette;
    const color = exceeds200k
      ? palette.quotaCrit || palette.red || LINES.red
      : colorForUsedPct(Math.round(pct), contextPalette, thresh);
    const over200k = exceeds200k ? ` ${t("over_200k", session.lang)}` : "";
    return { thresh, size, pct, over200k, blinkSeq, color };
  }

  if (hasNoData(id, session) || hiddenByThreshold(id, widget, session)) {
    return null;
  }

  const resolveLinesColor = (slot) => {
    if (slot === "caution") {
      return palette.quotaHigh || palette.yellow || LINES.yellow;
    }
    return palette[slot] || palette.text;
  };

  return renderWidget(id, {
    session,
    widget,
    config,
    emojis,
    ascii,
    raw,
    isLines: true,
    osIcons: OS_ICONS,
    ramCaution: RAM_CAUTION,
    ramDanger: RAM_DANGER,
    titleMax: TITLE_MAX,
    subagentDetail,
    readEnvValue,
    widgetTag,
    execWidgetOutput,
    text: (value, { linesColor = "text", icon } = {}) =>
      fg(resolveLinesColor(linesColor)) + tag(icon) + value + RESET,
    taggedText: (tagText, value) => fg(palette.text) + tagText + value + RESET,
    valueWithLevel: (value, level) => {
      const col =
        level === "danger"
          ? palette.quotaCrit
          : level === "caution"
            ? palette.quotaHigh
            : palette.text;
      return fg(palette.text) + tag() + fg(col) + value + RESET;
    },
    cacheHit: (pct) => {
      const color =
        pct >= 80
          ? palette.quotaLow || palette.green || LINES.green
          : pct >= 50
            ? palette.quotaMed || palette.orange || LINES.orange
            : palette.text;
      return fg(palette.text) + tag() + fg(color) + `${pct}%` + RESET;
    },
    quotaMeter: (quota) => quotaMeter(quota),
    quotaPct: (quota) => quotaPct(quota),
    quotaReset: (quota, _colorSlot, weekly = false) => quotaReset(quota, weekly),
    tightestQuota: (quota) => {
      const { view, blinkSeq, color } = quotaState(quota);
      const reset = quota.reset ? `${ascii ? ", " : " · "}${quota.reset}` : "";
      return (
        blinkSeq +
        fg(palette.text) +
        tag() +
        `${quota.label} ` +
        fg(color) +
        `${view.text}${paceDelta(quota)}` +
        fg(palette.text) +
        forecast(quota) +
        reset +
        RESET
      );
    },
    contextBar: () => {
      const { thresh, size, pct, over200k, blinkSeq, color } = contextState();
      return (
        blinkSeq +
        fg(palette.text) +
        tag() +
        renderDotMeter(pct, dots, ascii, palette, false, {
          ...thresh,
          color,
          style,
          classic,
        }) +
        " " +
        fg(color) +
        `${formatContextTokens(session.usedTokens, size)} ` +
        `(${pct.toFixed(1)}%)${over200k}` +
        RESET
      );
    },
    contextPct: () => {
      const { pct, over200k, blinkSeq, color } = contextState();
      return (
        blinkSeq + fg(palette.text) + tag() + fg(color) + `${pct.toFixed(1)}%${over200k}` + RESET
      );
    },
    contextTokens: () => {
      const { size, blinkSeq, color } = contextState();
      return (
        blinkSeq +
        fg(palette.text) +
        tag() +
        fg(color) +
        formatContextTokens(session.usedTokens, size) +
        RESET
      );
    },
    budgetText: (text, pct) => {
      // A budget alerts like the context widgets: caution, then danger.
      const thresh = resolveContextThresholds(widget, config);
      const level =
        pct === null
          ? "normal"
          : pct >= thresh.crit
            ? "crit"
            : pct >= thresh.warn
              ? "warn"
              : "normal";
      const color =
        level === "crit" ? palette.quotaCrit : level === "warn" ? palette.quotaHigh : palette.text;
      const blinkSeq = !ascii && shouldBlink(level, thresh.blink) ? BLINK : "";
      return blinkSeq + fg(palette.text) + tag() + fg(color) + text + RESET;
    },
    gitBranch: ({ branch, dirty, opStr, syncPart }) =>
      fg(palette.git) +
      tag() +
      "(" +
      branch +
      (dirty ? `${fg(palette.gitDirty)}*` : "") +
      (opStr ? `${fg(palette.gitDirty)} ${opStr}` : "") +
      (syncPart ? `${fg(palette.git)}${syncPart}` : "") +
      fg(palette.git) +
      ")" +
      RESET,
    gitChanges: (parts) => {
      const shade = { added: palette.quotaLow, removed: palette.quotaCrit };
      return (
        fg(palette.git) +
        tag() +
        parts.map((part) => fg(shade[part.kind]) + part.text).join(" ") +
        RESET
      );
    },
    gitFiles: (parts) => {
      const shade = (kind) => (kind === "conflicts" ? palette.quotaCrit : palette.git);
      return (
        fg(palette.git) +
        tag() +
        parts.map((part) => fg(shade(part.kind)) + part.text).join(" ") +
        RESET
      );
    },
    agentState: ({ text, idle, critical }) => {
      const color = idle
        ? DIM
        : fg(
            critical
              ? palette.quotaCrit || palette.agent || palette.magenta || LINES.magenta
              : palette.agent || palette.magenta || LINES.magenta
          );
      return color + tag(idle ? "🟢" : undefined) + text + RESET;
    },
    sandbox: ({ text, net }) => {
      const color = net ? palette.quotaMed || palette.orange || LINES.orange : palette.git;
      return fg(color) + tag(net ? "🌐" : undefined) + text + RESET;
    },
    execSegment: (output) => {
      const icon = widget.icon !== undefined ? widget.icon : "⚡";
      const named = widget.label && !raw ? `${widget.label}: ` : "";
      // buildLinesRows already swapped the widget's color into the palette.
      const col = palette.location;
      const iconPart = emojis && icon && !raw ? `${icon} ` : "";
      return fg(col) + iconPart + named + restoreAfterReset(output, fg(col)) + RESET;
    },
  });
}

// A widget's own color and text color become a palette for that widget only.
function widgetPalette(widget, palette, colors) {
  if (!colors || (!widget.color && !widget.textColor)) {
    return palette;
  }
  const own = deriveLinesPalette(widgetColors(widget, colors));
  const text = resolveColor(widget.textColor, colors);
  return text ? { ...own, text } : own;
}

function buildLinesRows(session, config, palette, emojis, ascii = false, colors = null) {
  const widgetList = Array.isArray(config?.widgets) ? config.widgets : [];
  if (!widgetList.length) {
    return [];
  }

  // Split widgets by lineBreak into row definition lists
  const rowDefs = [];
  let currentRowDef = [];

  for (const widget of widgetList) {
    if (widget.id === "lineBreak") {
      rowDefs.push(currentRowDef);
      currentRowDef = [];
    } else {
      currentRowDef.push(widget);
    }
  }
  rowDefs.push(currentRowDef);

  const rows = [];
  const gradient = colors ? gradientStops(config?.gradient) : null;
  const background = terminalBackground(colors);

  function renderItem(widget, widgetPal) {
    const item = buildLinesSegment(widget.id, session, widgetPal, emojis, ascii, widget, config);
    // Bold has to survive the resets inside the segment.
    return item && widget.bold === true
      ? BOLD + item.split(RESET).join(RESET + BOLD) + RESET
      : item;
  }

  for (const def of rowDefs) {
    const groups = [];
    let currentGroup = [];
    // The widgets shown in this row, so a gradient spreads over exactly those.
    const placed = [];

    function flushGroup() {
      if (currentGroup.length) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }

    for (const widget of def) {
      if (!widget) {
        continue;
      }

      if (widget.id === "separator") {
        flushGroup();
        continue;
      }

      const item = renderItem(widget, widgetPalette(widget, palette, colors));

      if (item) {
        placed.push({ widget, group: currentGroup, index: currentGroup.length });
        currentGroup.push(item);
      }
    }

    flushGroup();

    // Each widget's text takes its step of the gradient, made readable on the
    // terminal background; alert colors and a widget's own color stay.
    if (gradient && placed.length) {
      const shades = gradientColors(gradient, placed.length);
      placed.forEach(({ widget, group, index }, i) => {
        if (resolveColor(widget.color, colors)) {
          return;
        }
        const shade = withContrast(shades[i], background);
        const item = renderItem(
          widget,
          widgetPalette({ ...widget, color: shade }, palette, colors)
        );
        if (item) {
          group[index] = item;
        }
      });
    }

    if (groups.length) {
      rows.push(groups);
    }
  }

  return rows;
}

function renderLinesLayout(session, emojis, ascii = false, colors, config) {
  const palette = deriveLinesPalette(colors);
  const rows = buildLinesRows(session, config, palette, emojis, ascii, colors);

  if (!rows.length) {
    return RESET;
  }

  const pipe = ` ${DIM}${ascii || config.layout === "classic" ? "|" : "│"}${RESET} `;

  return (
    rows
      .map((groups) =>
        alignGroups(
          groups,
          config.alignment,
          session.terminalWidth,
          session.flexGaps === true,
          (group) => group.join(pipe)
        )
      )
      // rowGap: a line holding a space, as in Pills, so a host keeps it.
      .join(config.rowGap === true ? "\n \n" : "\n") + RESET
  );
}

module.exports = {
  LINES,
  deriveLinesPalette,
  colorForUsedPct,
  colorForRemainingPct,
  renderDotMeter,
  buildLinesSegment,
  buildLinesRows,
  renderLinesLayout,
};
