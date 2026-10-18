"use strict";

const {
  rgb,
  fg,
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
  basenameOf,
  homePath,
  formatResetText,
  paceIndex,
  paceGlyph,
  formatGitSync,
  formatGitOperation,
  gitChangeParts,
  gitFileParts,
  formatTasks,
  formatMode,
  clipText,
  formatTokens,
  formatContextTokens,
  shortModelName,
  formatTokenSplit,
  resolveQuotaThresholds,
  resolveContextThresholds,
  shouldBlink,
} = require("../formatters");
const { joinFlex } = require("./pills");
const { execWidgetOutput, restoreAfterReset } = require("../exec");
const {
  NAMED_COLORS,
  resolveColor,
  widgetColors,
  widgetTag,
  isRaw,
  isPaced,
  hasNoData,
  RAM_CAUTION,
  RAM_DANGER,
  TITLE_MAX,
} = require("../widget-style");

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

  if (marker < 0) {
    if (ascii) {
      return fg(color) + "#".repeat(filled) + DIM + "-".repeat(empty) + RESET;
    }
    const trackColor = palette.track || rgb(60, 65, 75);
    return fg(color) + "●".repeat(filled) + fg(trackColor) + "●".repeat(empty) + RESET;
  }

  // The marker replaces the dot where the quota window currently is.
  const trackColor = palette.track || rgb(60, 65, 75);
  const markerColor = palette.text || LINES.white;
  // ASCII empties are dim; NORMAL ends that without dropping a blink.
  const undim = ascii ? NORMAL : "";
  let out = "";
  for (let i = 0; i < width; i++) {
    if (i === marker) {
      out += undim + fg(markerColor) + paceGlyph(ascii);
    } else if (i < filled) {
      out += undim + fg(color) + (ascii ? "#" : "●");
    } else {
      out += ascii ? DIM + "-" : fg(trackColor) + "●";
    }
  }
  return out + RESET;
}

function buildLinesSegment(id, session, palette, emojis, ascii = false, widget = {}, config = {}) {
  // Raw widgets keep only their value: no icon, no label.
  const raw = isRaw(widget, config);
  const tag = (icon) => widgetTag(id, { emojis, raw, icon });
  // Meters: 25 dots, or 12 when the bar is fitted to a narrow terminal.
  const dots = widget?.compact ? 12 : 25;
  const pace = (quota, thresh) => ({
    ...thresh,
    elapsedPct: isPaced(widget, config) ? quota.elapsedPct : null,
  });
  const over200k = session.exceeds200k ? " >200k" : "";

  function quotaState(quota) {
    const thresh = resolveQuotaThresholds(widget, config);
    const rem = quota.remaining;
    const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
    const blinkSeq = !ascii && shouldBlink(level, thresh.blink) ? BLINK : "";
    const color = colorForRemainingPct(Math.round(rem), palette, thresh);
    return { thresh, rem, blinkSeq, color };
  }

  // A quota meter with its remaining %, for the 5h, 7d and third-party bars.
  function quotaMeter(quota) {
    const { thresh, rem, blinkSeq, color } = quotaState(quota);
    return (
      blinkSeq +
      fg(palette.text) +
      tag() +
      renderDotMeter(rem, dots, ascii, palette, true, pace(quota, thresh)) +
      " " +
      fg(color) +
      `${rem.toFixed(1)}% rem` +
      RESET
    );
  }

  function quotaPct(quota) {
    const { rem, blinkSeq, color } = quotaState(quota);
    return blinkSeq + fg(palette.text) + tag() + fg(color) + `${rem.toFixed(1)}% rem` + RESET;
  }

  function quotaReset(quota, weekly) {
    const text = quota
      ? formatResetText(quota, {
          format: widget.format,
          fallback: "countdown",
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
    const isCrit = session.exceeds200k || session.contextPct >= thresh.crit;
    const isWarn = session.contextPct >= thresh.warn;
    const level = isCrit ? "crit" : isWarn ? "warn" : "normal";
    const blinkSeq = !ascii && shouldBlink(level, thresh.blink) ? BLINK : "";
    const color = session.exceeds200k
      ? palette.quotaCrit || palette.red || LINES.red
      : colorForUsedPct(Math.round(session.contextPct), palette, thresh);
    return { thresh, blinkSeq, color };
  }

  if (hasNoData(id, session)) {
    return null;
  }

  switch (id) {
    case "model":
      if (!session.model) {
        return null;
      }
      return (
        fg(palette.model) +
        tag() +
        (widget?.short ? shortModelName(session.model, ascii) : session.model) +
        RESET
      );

    case "quota": {
      const quota = session.tightestQuota;
      if (!quota) {
        return null;
      }
      const { rem, blinkSeq, color } = quotaState(quota);
      const reset = quota.reset ? `${ascii ? ", " : " · "}${quota.reset}` : "";
      return (
        blinkSeq +
        fg(palette.text) +
        tag() +
        `${quota.label} ` +
        fg(color) +
        `${rem.toFixed(1)}% rem` +
        fg(palette.text) +
        reset +
        RESET
      );
    }

    case "agentState": {
      if (!session.agentState) {
        return null;
      }
      const idle = session.agentState === "idle";
      const color = idle ? DIM : fg(palette.agent || palette.magenta || LINES.magenta);
      return color + tag(idle ? "🟢" : undefined) + session.agentState.replace(/_/g, " ") + RESET;
    }

    case "fiveHourBar":
      return session.fiveHour ? quotaMeter(session.fiveHour) : null;

    case "fiveHourPct":
      return session.fiveHour ? quotaPct(session.fiveHour) : null;

    case "fiveHourReset":
      return quotaReset(session.fiveHour, false);

    case "weeklyBar":
      return session.weekly ? quotaMeter(session.weekly) : null;

    case "weeklyPct":
      return session.weekly ? quotaPct(session.weekly) : null;

    case "weeklyReset":
      return quotaReset(session.weekly, true);

    case "thirdPartyFiveHour":
      if (!session.thirdPartyFiveHour || session.thirdPartyFiveHour.disabled) {
        return null;
      }
      return quotaMeter(session.thirdPartyFiveHour);

    case "thirdPartyWeekly":
      return session.thirdPartyWeekly ? quotaMeter(session.thirdPartyWeekly) : null;

    case "argonWeekly":
      return session.argonWeekly ? quotaMeter(session.argonWeekly) : null;

    case "argonReset":
      return quotaReset(session.argonWeekly, true);

    case "context": {
      const { thresh, blinkSeq, color } = contextState();
      return (
        blinkSeq +
        fg(palette.text) +
        tag() +
        renderDotMeter(session.contextPct, dots, ascii, palette, false, { ...thresh, color }) +
        " " +
        fg(color) +
        `${formatContextTokens(session.usedTokens, session.contextSize)} ` +
        `(${session.contextPct.toFixed(1)}%)${over200k}` +
        RESET
      );
    }

    case "contextPct": {
      const { blinkSeq, color } = contextState();
      return (
        blinkSeq +
        fg(palette.text) +
        tag() +
        fg(color) +
        `${session.contextPct.toFixed(1)}%${over200k}` +
        RESET
      );
    }

    case "contextTokens": {
      const { blinkSeq, color } = contextState();
      return (
        blinkSeq +
        fg(palette.text) +
        tag() +
        fg(color) +
        formatContextTokens(session.usedTokens, session.contextSize) +
        RESET
      );
    }

    case "cwd": {
      const dirname = homePath(session.cwd);
      if (!dirname) {
        return null;
      }
      return fg(palette.location) + tag() + dirname + RESET;
    }

    case "project": {
      const proj = basenameOf(session.project);
      if (!proj) {
        return null;
      }
      return fg(palette.location) + tag() + proj + RESET;
    }

    case "git": {
      if (!session.git || !session.git.branch) {
        return null;
      }
      const opStr = widget.operation === false ? "" : formatGitOperation(session.git.operation);
      const syncStr = formatGitSync(session.git.ahead, session.git.behind, ascii);
      const syncPart = syncStr ? ` ${syncStr}` : "";
      return (
        fg(palette.git) +
        tag() +
        "(" +
        session.git.branch +
        (session.git.dirty ? `${fg(palette.gitDirty)}*` : "") +
        (opStr ? `${fg(palette.gitDirty)} ${opStr}` : "") +
        (syncPart ? `${fg(palette.git)}${syncPart}` : "") +
        fg(palette.git) +
        ")" +
        RESET
      );
    }

    case "gitChanges": {
      const parts = gitChangeParts(session.gitDetails?.changes, ascii);
      if (!parts.length) {
        return null;
      }
      const shade = { added: palette.quotaLow, removed: palette.quotaCrit };
      return (
        fg(palette.git) +
        tag() +
        parts.map((part) => fg(shade[part.kind]) + part.text).join(" ") +
        RESET
      );
    }

    case "gitFiles": {
      const parts = gitFileParts(session.gitDetails?.files, ascii);
      if (!parts.length) {
        return null;
      }
      const shade = (kind) => (kind === "conflicts" ? palette.quotaCrit : palette.git);
      return (
        fg(palette.git) +
        tag() +
        parts.map((part) => fg(shade(part.kind)) + part.text).join(" ") +
        RESET
      );
    }

    case "gitSha":
      if (!session.gitDetails?.sha) {
        return null;
      }
      return fg(palette.git) + tag() + session.gitDetails.sha + RESET;

    case "gitStash":
      if (!(session.gitDetails?.stash > 0)) {
        return null;
      }
      return fg(palette.git) + tag() + session.gitDetails.stash + RESET;

    case "gitWorktree":
      if (!session.gitDetails?.worktree) {
        return null;
      }
      return fg(palette.git) + tag() + session.gitDetails.worktree + RESET;

    case "plan":
      if (!session.plan) {
        return null;
      }
      return fg(palette.text) + tag() + session.plan + RESET;

    case "artifacts":
      if (!session.artifacts) {
        return null;
      }
      return fg(palette.text) + tag() + String(session.artifacts) + RESET;

    case "tasks": {
      const text = formatTasks(session.subagents, session.tasks);
      if (!text) {
        return null;
      }
      return fg(palette.text) + tag() + text + RESET;
    }

    case "mode": {
      const text = formatMode(session.approvalMode, session.vimMode);
      if (!text) {
        return null;
      }
      // An approval mode like accept-edits changes what the agent may do alone.
      const approval = session.approvalMode && session.approvalMode !== "default";
      const color = approval ? palette.quotaHigh || palette.yellow || LINES.yellow : palette.text;
      return fg(color) + tag() + text + RESET;
    }

    case "title":
      if (!session.title) {
        return null;
      }
      return fg(palette.text) + tag() + clipText(session.title, TITLE_MAX, ascii) + RESET;

    case "sandbox": {
      if (!session.sandbox) {
        return null;
      }
      const net = session.sandboxNet;
      const color = net ? palette.quotaMed || palette.orange || LINES.orange : palette.git;
      const text = net ? "sandbox (net)" : "sandbox (isolated)";
      return fg(color) + tag(net ? "🌐" : undefined) + text + RESET;
    }

    case "ram": {
      if (session.ramPct == null) {
        return null;
      }
      const ramCol =
        session.ramPct >= RAM_DANGER
          ? palette.quotaCrit
          : session.ramPct >= RAM_CAUTION
            ? palette.quotaHigh
            : palette.text;
      return fg(palette.text) + tag() + fg(ramCol) + `${session.ramPct}%` + RESET;
    }

    case "version":
      if (!session.version) {
        return null;
      }
      return fg(palette.text) + tag() + `v${session.version}` + RESET;

    case "cacheRead":
      if (session.cacheRead == null) {
        return null;
      }
      return fg(palette.text) + tag() + formatTokens(session.cacheRead) + RESET;

    case "cacheCreate":
      if (session.cacheCreate == null) {
        return null;
      }
      return fg(palette.text) + tag() + formatTokens(session.cacheCreate) + RESET;

    case "cacheHit": {
      const pct = session.cacheHitPct ?? 0;
      const color =
        pct >= 80
          ? palette.quotaLow || palette.green || LINES.green
          : pct >= 50
            ? palette.quotaMed || palette.orange || LINES.orange
            : palette.text;
      return fg(palette.text) + tag() + fg(color) + `${pct}%` + RESET;
    }

    case "totalTokens":
      if (!session.totalTokens) {
        return null;
      }
      return (
        fg(palette.text) +
        tag() +
        (widget?.split
          ? formatTokenSplit(session.inputTokens, session.outputTokens, ascii)
          : formatTokens(session.totalTokens)) +
        RESET
      );

    case "customText": {
      if (!widget?.text) {
        return null;
      }
      return fg(palette.text) + tag() + widget.text + RESET;
    }

    case "exec": {
      const output = execWidgetOutput(widget, session);
      if (!output) {
        return null;
      }
      const icon = widget.icon !== undefined ? widget.icon : "⚡";
      const named = widget.label && !raw ? `${widget.label}: ` : "";
      // buildLinesRows already swapped the widget's color into the palette.
      const col = palette.location;
      const iconPart = emojis && icon && !raw ? `${icon} ` : "";
      return fg(col) + iconPart + named + restoreAfterReset(output, fg(col)) + RESET;
    }

    default:
      return null;
  }
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

  const pipe = ` ${DIM}${ascii ? "|" : "│"}${RESET} `;

  return (
    rows
      .map((groups) => {
        const parts = groups.map((group) => group.join(pipe));
        return joinFlex(parts, session.terminalWidth);
      })
      .join("\n") + RESET
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
