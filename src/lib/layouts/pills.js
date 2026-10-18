"use strict";

const {
  shade,
  mix,
  bg,
  bgDefault,
  fg,
  BOLD,
  DIM,
  NORMAL,
  BLINK,
  BLINK_OFF,
  getActiveDepth,
  gradientColors,
  readableText,
} = require("../colors");
const { gradientStops } = require("../themes");
const { pickGlyph, glyphChar } = require("../powerline");
const {
  quotaColor,
  contextColor,
  resolveQuotaThresholds,
  resolveContextThresholds,
  shouldBlink,
  formatTokens,
  formatContextTokens,
  shortModelName,
  formatTokenSplit,
  formatGitSync,
  formatGitOperation,
  gitChangeParts,
  gitFileParts,
  formatTasks,
  formatMode,
  clipText,
  homePath,
  basenameOf,
  label,
  visibleWidth,
  formatResetText,
  paceIndex,
  paceGlyph,
} = require("../formatters");
const { execWidgetOutput, restoreAfterReset } = require("../exec");
const {
  resolveColor,
  widgetColors,
  widgetTag,
  isRaw,
  isPaced,
  METER_STYLES,
  meterStyle,
  hasNoData,
  RAM_CAUTION,
  RAM_DANGER,
  TITLE_MAX,
} = require("../widget-style");

const WHITE = [255, 255, 255];

// The pace marker sits in the cell matching how much of the quota window has
// passed: a fill reaching past it means quota is going faster than time. It
// takes the other cell color (track on fill, fill on track) so it always shows.
function fillMeter(pct, width, fillColor, emptyColor, segmentColor, pace = {}) {
  const ratio = Math.max(0, Math.min(100, Number(pct))) / 100;
  const used = Math.round(ratio * width);
  const marker = paceIndex(pace.elapsedPct, width);
  if (METER_STYLES[pace.style]) {
    return glyphMeter(used, marker, width, METER_STYLES[pace.style], pace);
  }
  // The fill is a background color; without color it is drawn with glyphs.
  const plain = getActiveDepth() === "none";
  const glyph = (filled) => (!plain ? " " : pace.ascii ? (filled ? "#" : "-") : filled ? "█" : "░");
  let meter = "";

  for (let i = 0; i < width; i++) {
    const filled = i < used;
    const cell = bg(filled ? fillColor : emptyColor);
    meter +=
      i === marker
        ? cell + fg(filled ? emptyColor : fillColor) + paceGlyph(pace.ascii)
        : cell + glyph(filled);
  }

  return meter + bg(segmentColor);
}

// A glyph style draws on the pill's own color, with no cells: filled glyphs in
// the pill's text color (readable on the pill, gradients included), empty
// ones in the same color dimmed. ASCII mode keeps # and -.
function glyphMeter(used, marker, width, [full, empty], { ascii, textColor }) {
  let meter = fg(textColor);
  let dim = false;

  for (let i = 0; i < width; i++) {
    const blank = i !== marker && i >= used;
    if (blank !== dim) {
      meter += blank ? DIM : NORMAL;
      dim = blank;
    }
    if (i === marker) {
      meter += paceGlyph(ascii);
    } else if (ascii) {
      meter += blank ? "-" : "#";
    } else {
      meter += blank ? empty : full;
    }
  }

  return dim ? meter + NORMAL : meter;
}

function meterSegment(
  color,
  pct,
  prefix,
  suffix,
  isRemaining = false,
  blink = false,
  elapsedPct = null
) {
  // A light fill on a dark track reads at a glance on any pill color, deep
  // (light themes) or bright (dark themes).
  return {
    color,
    meter: true,
    pct,
    fill: mix(color, WHITE, 0.6),
    empty: shade(color, 0.5),
    prefix,
    suffix,
    isRemaining: Boolean(isRemaining),
    blink: Boolean(blink),
    elapsedPct,
  };
}

function pill(color, text, blink = false) {
  return { color, text, blink: Boolean(blink) };
}

function buildSegment(id, session, colors, emojis, ascii = false, widget = {}, config = {}) {
  // Raw widgets keep only their value: no icon, no label.
  const raw = isRaw(widget, config);
  const tag = (icon) => widgetTag(id, { emojis, raw, icon });
  const lbl = (value, icon) => ` ${tag(icon)}${value} `;
  // The pill frames a colored meter; plain-text meters (ASCII) get brackets.
  const open = ascii ? "[" : "";
  const close = ascii ? "]" : "";
  const meterLabel = () => ` ${tag()}${open}`;
  const pace = (quota) => (isPaced(widget, config) ? quota.elapsedPct : null);
  const over200k = session.exceeds200k ? " >200k" : "";

  if (hasNoData(id, session)) {
    return null;
  }

  switch (id) {
    case "model":
      if (!session.model) {
        return null;
      }
      return pill(
        colors.model,
        lbl(widget?.short ? shortModelName(session.model, ascii) : session.model)
      );

    case "quota": {
      const quota = session.tightestQuota;
      if (!quota) {
        return null;
      }
      const thresh = resolveQuotaThresholds(widget, config);
      const rem = quota.remaining;
      const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = quotaColor(rem, colors.fiveHour, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      const reset = quota.reset ? `${ascii ? ", " : " · "}${quota.reset}` : "";
      return pill(color, lbl(`${quota.label} ${rem.toFixed(1)}% rem${reset}`), blink);
    }

    case "fiveHourBar": {
      if (!session.fiveHour) {
        return null;
      }
      const thresh = resolveQuotaThresholds(widget, config);
      const rem = session.fiveHour.remaining;
      const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = quotaColor(rem, colors.fiveHour, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return meterSegment(
        color,
        rem,
        meterLabel(),
        `${close} ${rem.toFixed(1)}% rem `,
        true,
        blink,
        pace(session.fiveHour)
      );
    }

    case "fiveHourPct": {
      if (!session.fiveHour) {
        return null;
      }
      const thresh = resolveQuotaThresholds(widget, config);
      const rem = session.fiveHour.remaining;
      const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = quotaColor(rem, colors.fiveHour, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return pill(color, lbl(`${rem.toFixed(1)}% rem`), blink);
    }

    case "fiveHourReset": {
      const text = session.fiveHour
        ? formatResetText(session.fiveHour, {
            format: widget.format,
            fallback: "countdown",
            clock: config.clock,
          })
        : "";
      // No usable reset in the payload: hide rather than claim "now".
      if (!text) {
        return null;
      }
      return pill(colors.fiveHour, lbl(text));
    }

    case "weeklyBar": {
      if (!session.weekly) {
        return null;
      }
      const thresh = resolveQuotaThresholds(widget, config);
      const rem = session.weekly.remaining;
      const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = quotaColor(rem, colors.weekly, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return meterSegment(
        color,
        rem,
        meterLabel(),
        `${close} ${rem.toFixed(1)}% rem `,
        true,
        blink,
        pace(session.weekly)
      );
    }

    case "weeklyPct": {
      if (!session.weekly) {
        return null;
      }
      const thresh = resolveQuotaThresholds(widget, config);
      const rem = session.weekly.remaining;
      const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = quotaColor(rem, colors.weekly, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return pill(color, lbl(`${rem.toFixed(1)}% rem`), blink);
    }

    case "weeklyReset": {
      const text = session.weekly
        ? formatResetText(session.weekly, {
            format: widget.format,
            fallback: "countdown",
            weekly: true,
            clock: config.clock,
          })
        : "";
      // No usable reset in the payload: hide rather than claim "now".
      if (!text) {
        return null;
      }
      return pill(colors.weekly, lbl(text));
    }

    case "thirdPartyFiveHour": {
      if (!session.thirdPartyFiveHour || session.thirdPartyFiveHour.disabled) {
        return null;
      }
      const thresh = resolveQuotaThresholds(widget, config);
      const rem = session.thirdPartyFiveHour.remaining;
      const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = quotaColor(rem, colors.thirdParty, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return meterSegment(
        color,
        rem,
        meterLabel(),
        `${close} ${rem.toFixed(1)}% rem `,
        true,
        blink,
        pace(session.thirdPartyFiveHour)
      );
    }

    case "thirdPartyWeekly": {
      if (!session.thirdPartyWeekly) {
        return null;
      }
      const thresh = resolveQuotaThresholds(widget, config);
      const rem = session.thirdPartyWeekly.remaining;
      const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = quotaColor(rem, colors.thirdParty, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return meterSegment(
        color,
        rem,
        meterLabel(),
        `${close} ${rem.toFixed(1)}% rem `,
        true,
        blink,
        pace(session.thirdPartyWeekly)
      );
    }

    // Argon is a Gemini model, so its quota takes the Gemini 7d color; the
    // 🔮 tag tells the two apart.
    case "argonWeekly": {
      if (!session.argonWeekly) {
        return null;
      }
      const thresh = resolveQuotaThresholds(widget, config);
      const rem = session.argonWeekly.remaining;
      const level = rem <= thresh.crit ? "crit" : rem <= thresh.warn ? "warn" : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = quotaColor(rem, colors.weekly, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return meterSegment(
        color,
        rem,
        meterLabel(),
        `${close} ${rem.toFixed(1)}% rem `,
        true,
        blink,
        pace(session.argonWeekly)
      );
    }

    case "argonReset": {
      const text = session.argonWeekly
        ? formatResetText(session.argonWeekly, {
            format: widget.format,
            fallback: "countdown",
            weekly: true,
            clock: config.clock,
          })
        : "";
      if (!text) {
        return null;
      }
      return pill(colors.weekly, lbl(text));
    }

    case "context": {
      const thresh = resolveContextThresholds(widget, config);
      const level =
        session.exceeds200k || session.contextPct >= thresh.crit
          ? "crit"
          : session.contextPct >= thresh.warn
            ? "warn"
            : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = contextColor(session.contextPct, colors.context, session.exceeds200k, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return meterSegment(
        color,
        session.contextPct,
        meterLabel(),
        `${close} ${formatContextTokens(session.usedTokens, session.contextSize)} (${session.contextPct.toFixed(1)}%)${over200k} `,
        false,
        blink
      );
    }

    case "contextPct": {
      const thresh = resolveContextThresholds(widget, config);
      const level =
        session.exceeds200k || session.contextPct >= thresh.crit
          ? "crit"
          : session.contextPct >= thresh.warn
            ? "warn"
            : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = contextColor(session.contextPct, colors.context, session.exceeds200k, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return pill(color, lbl(`${session.contextPct.toFixed(1)}%${over200k}`), blink);
    }

    case "contextTokens": {
      const thresh = resolveContextThresholds(widget, config);
      const level =
        session.exceeds200k || session.contextPct >= thresh.crit
          ? "crit"
          : session.contextPct >= thresh.warn
            ? "warn"
            : "normal";
      const blink = !ascii && shouldBlink(level, thresh.blink);
      const color = contextColor(session.contextPct, colors.context, session.exceeds200k, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return pill(color, lbl(formatContextTokens(session.usedTokens, session.contextSize)), blink);
    }

    case "cwd": {
      const name = homePath(session.cwd);
      if (!name) {
        return null;
      }
      return pill(colors.meta, lbl(name));
    }

    case "project": {
      const name = basenameOf(session.project);
      if (!name) {
        return null;
      }
      return pill(colors.meta, lbl(name));
    }

    case "git": {
      // Antigravity can send vcs.type without a branch; an empty pill says nothing.
      if (!session.git?.branch) {
        return null;
      }
      const mark = session.git.dirty ? `${ascii ? "* " : "● "}` : "";
      const opStr = widget.operation === false ? "" : formatGitOperation(session.git.operation);
      const opPart = opStr ? `|${opStr}` : "";
      const syncStr = formatGitSync(session.git.ahead, session.git.behind, ascii);
      const syncPart = syncStr ? ` ${syncStr}` : "";
      return pill(
        session.git.dirty ? colors.gitDirty : colors.git,
        lbl(`${mark}${session.git.branch}${opPart}${syncPart}`)
      );
    }

    case "gitChanges": {
      const parts = gitChangeParts(session.gitDetails?.changes, ascii);
      if (!parts.length) {
        return null;
      }
      return pill(colors.git, lbl(parts.map((part) => part.text).join(" ")));
    }

    case "gitFiles": {
      const files = session.gitDetails?.files;
      const parts = gitFileParts(files, ascii);
      if (!parts.length) {
        return null;
      }
      const color = files.conflicts > 0 ? colors.gitDirty : colors.git;
      return pill(color, lbl(parts.map((part) => part.text).join(" ")));
    }

    case "gitSha":
      if (!session.gitDetails?.sha) {
        return null;
      }
      return pill(colors.git, lbl(session.gitDetails.sha));

    case "gitStash":
      if (!(session.gitDetails?.stash > 0)) {
        return null;
      }
      return pill(colors.git, lbl(String(session.gitDetails.stash)));

    case "gitWorktree":
      if (!session.gitDetails?.worktree) {
        return null;
      }
      return pill(colors.git, lbl(session.gitDetails.worktree));

    case "plan":
      if (!session.plan) {
        return null;
      }
      return pill(colors.meta, lbl(session.plan));

    case "agentState":
      if (!session.agentState) {
        return null;
      }
      return pill(
        session.agentState === "idle" ? colors.meta : colors.warn,
        lbl(session.agentState.replace(/_/g, " "), session.agentState === "idle" ? "🟢" : undefined)
      );

    case "artifacts":
      if (!session.artifacts) {
        return null;
      }
      return pill(colors.meta, lbl(String(session.artifacts)));

    case "tasks": {
      const text = formatTasks(session.subagents, session.tasks);
      if (!text) {
        return null;
      }
      return pill(colors.meta, lbl(text));
    }

    case "mode": {
      const text = formatMode(session.approvalMode, session.vimMode);
      if (!text) {
        return null;
      }
      // An approval mode like accept-edits changes what the agent may do alone.
      const approval = session.approvalMode && session.approvalMode !== "default";
      return pill(approval ? colors.caution : colors.meta, lbl(text));
    }

    case "title":
      if (!session.title) {
        return null;
      }
      return pill(colors.meta, lbl(clipText(session.title, TITLE_MAX, ascii)));

    case "ram": {
      const pct = session.ramPct ?? 0;
      let color = colors.meta;
      if (pct >= RAM_DANGER) {
        color = colors.warn;
      } else if (pct >= RAM_CAUTION) {
        color = colors.caution;
      }
      return pill(color, lbl(`${pct}%`));
    }

    case "version":
      if (!session.version) {
        return null;
      }
      return pill(colors.meta, lbl(`v${session.version}`));

    case "sandbox": {
      if (!session.sandbox) {
        return null;
      }
      const net = session.sandboxNet;
      const text = net ? "sandbox (net)" : "sandbox (isolated)";
      const color = net ? colors.warn : colors.git;
      return pill(color, lbl(text, net ? "🌐" : undefined));
    }

    case "cacheRead":
      return pill(colors.meta, lbl(formatTokens(session.cacheRead)));

    case "cacheCreate":
      return pill(colors.meta, lbl(formatTokens(session.cacheCreate)));

    case "cacheHit": {
      const pct = session.cacheHitPct ?? 0;
      let color = colors.meta;
      if (pct >= 80) {
        color = colors.fiveHour;
      } else if (pct >= 50) {
        color = colors.weekly;
      }
      return pill(color, lbl(`${pct}%`));
    }

    case "totalTokens":
      if (!session.totalTokens) {
        return null;
      }
      return pill(
        colors.meta,
        lbl(
          widget?.split
            ? formatTokenSplit(session.inputTokens, session.outputTokens, ascii)
            : formatTokens(session.totalTokens)
        )
      );

    case "customText": {
      if (!widget?.text) {
        return null;
      }
      return pill(colors.meta, lbl(widget.text));
    }

    case "exec": {
      const output = execWidgetOutput(widget, session);
      if (!output) {
        return null;
      }
      const icon = widget.icon !== undefined ? widget.icon : "⚡";
      const named = widget.label || "";
      const color = colors.meta;
      if (!icon || raw) {
        return pill(color, named && !raw ? ` ${named}: ${output} ` : ` ${output} `);
      }
      return pill(color, label(emojis, icon, named, output));
    }

    default:
      return null;
  }
}

// Pill text on a gradient color that the theme's text doesn't read on.
const READABLE_TEXT = [[22, 22, 28], WHITE, [0, 0, 0]];

function buildRows(session, config, colors) {
  const rows = [];
  let groups = [];
  let current = [];
  // The widgets shown in the current row, so a gradient can be spread over
  // exactly those once the row is complete.
  let placed = [];
  const splitEveryWidget = !config.powerline.enabled;
  const gradient = gradientStops(config.gradient);

  function styledSegment(widget, ownColors) {
    const segment = buildSegment(
      widget.id,
      session,
      ownColors,
      config.emojis,
      config.ascii === true,
      widget,
      config
    );
    if (segment) {
      segment.textColor = ownColors.text;
      segment.bold = widget.bold !== false;
      if (segment.meter) {
        segment.style = meterStyle(widget, config, "pills");
      }
    }
    return segment;
  }

  // Each widget takes its step of the gradient in place of its identity
  // color; alert colors and a widget's own color stay as they are.
  function applyGradient() {
    const shades = gradientColors(gradient, placed.length);
    placed.forEach(({ widget, group, index }, i) => {
      if (resolveColor(widget.color, colors)) {
        return;
      }
      const ownColors = widgetColors({ ...widget, color: shades[i] }, colors);
      const segment = styledSegment(widget, ownColors);
      if (!segment) {
        return;
      }
      if (!resolveColor(widget.textColor, colors)) {
        segment.textColor = readableText(segment.color, ownColors.text, READABLE_TEXT);
      }
      group[index] = segment;
    });
  }

  function flushGroup() {
    if (current.length) {
      groups.push(current);
      current = [];
    }
  }

  function flushRow() {
    flushGroup();

    if (gradient && placed.length) {
      applyGradient();
    }
    placed = [];

    if (groups.length) {
      rows.push(groups);
      groups = [];
    }
  }

  for (const widget of config.widgets) {
    if (widget.id === "lineBreak") {
      flushRow();
      continue;
    }

    if (widget.id === "separator") {
      flushGroup();
      continue;
    }

    const segment = styledSegment(widget, widgetColors(widget, colors));

    if (!segment) {
      continue;
    }

    const group = splitEveryWidget ? [] : current;
    placed.push({ widget, group, index: group.length });
    group.push(segment);

    if (splitEveryWidget) {
      groups.push(group);
    }
  }

  flushRow();
  return rows;
}

// Caps blend into the terminal background unless a theme pins one explicitly,
// so pills look right on dark and light terminals alike.
function capBackground(terminal) {
  return terminal ? bg(terminal) : bgDefault();
}

function leftCap(color, terminal, glyph) {
  return glyph ? capBackground(terminal) + fg(color) + glyph : "";
}

function rightCap(color, terminal, glyph) {
  return glyph ? fg(color) + capBackground(terminal) + glyph : "";
}

function sameColor(a, b) {
  return String(a) === String(b);
}

// A separator between two widgets of the same color would vanish, so it is
// drawn in the text color instead. Inverted separators (meant for
// left-pointing glyphs) take the next widget's color on the previous one's.
function joinSegments(previous, next, glyph, invert, textColor) {
  if (!glyph) {
    return "";
  }

  if (sameColor(previous.color, next.color)) {
    return fg(next.textColor || textColor) + bg(next.color) + glyph;
  }

  return invert
    ? fg(next.color) + bg(previous.color) + glyph
    : fg(previous.color) + bg(next.color) + glyph;
}

function segmentContent(text, color, textColor, blink = false, bold = true) {
  const blinkSeq = blink ? BLINK : "";
  const blinkOff = blink ? BLINK_OFF : "";
  // NORMAL clears bold left over from a previous widget.
  const style = bg(color) + fg(textColor) + blinkSeq + (bold ? BOLD : NORMAL);
  // Only exec output with "colors": true still holds escapes here.
  return style + (text.includes("\x1b") ? restoreAfterReset(text, style) : text) + blinkOff;
}

function renderMeterSegment(segment, colors, ascii = false) {
  const displayPct = segment.isRemaining
    ? Math.max(0, Math.min(100, 100 - Number(segment.pct)))
    : segment.pct;
  const textColor = segment.textColor || colors.text;
  const meter = fillMeter(displayPct, 12, segment.fill, segment.empty, segment.color, {
    elapsedPct: segment.elapsedPct,
    ascii,
    style: segment.style,
    textColor,
  });
  const bold = segment.bold !== false;

  return (
    segmentContent(segment.prefix, segment.color, textColor, segment.blink, bold) +
    meter +
    segmentContent(segment.suffix, segment.color, textColor, segment.blink, bold)
  );
}

// Caps cycle per pill and separators per join, counted across the whole
// statusline, so lists with several glyphs alternate from left to right.
function renderGroup(group, colors, config, counters = { pill: 0, separator: 0 }) {
  const { powerline } = config;
  const ascii = config.ascii === true;
  const terminal = colors.terminal;
  const pillIndex = counters.pill++;
  const startCap = glyphChar(pickGlyph(powerline.startCaps, pillIndex), "startCap", ascii);
  const endCap = glyphChar(pickGlyph(powerline.endCaps, pillIndex), "endCap", ascii);

  let out = leftCap(group[0].color, terminal, startCap);

  for (let i = 0; i < group.length; i++) {
    const segment = group[i];

    out += segment.meter
      ? renderMeterSegment(segment, colors, ascii)
      : segmentContent(
          segment.text,
          segment.color,
          segment.textColor || colors.text,
          segment.blink,
          segment.bold !== false
        );

    if (i < group.length - 1) {
      const slot = counters.separator++;
      const glyph = glyphChar(pickGlyph(powerline.separators, slot), "separator", ascii);
      const invert = powerline.separatorInvert[slot % (powerline.separators.length || 1)];
      out += joinSegments(segment, group[i + 1], glyph, invert === true, colors.text);
    }
  }

  out += rightCap(group[group.length - 1].color, terminal, endCap);

  return out;
}

function joinFlex(parts, terminalWidth) {
  if (parts.length <= 1) {
    return parts[0] || "";
  }

  const widths = parts.map(visibleWidth);
  const gaps = parts.length - 1;
  const minGap = 1;
  const used = widths.reduce((sum, width) => sum + width, 0) + gaps * minGap;
  const extra = Math.max(0, terminalWidth - used);
  const each = Math.floor(extra / gaps);
  let leftover = extra % gaps;
  let out = parts[0];

  for (let i = 1; i < parts.length; i++) {
    const pad = minGap + each + (leftover > 0 ? 1 : 0);

    if (leftover > 0) {
      leftover -= 1;
    }

    out += " ".repeat(pad) + parts[i];
  }

  return out;
}

// Pills fill their whole cell, so stacked rows touch; rowGap puts a blank
// line between them. It holds a space so a host that drops empty lines keeps it.
function renderPillRows(rows, session, colors, config) {
  const counters = { pill: 0, separator: 0 };

  return rows
    .map((row) =>
      joinFlex(
        row.map((group) => renderGroup(group, colors, config, counters)),
        session.terminalWidth
      )
    )
    .join(config.rowGap === true ? "\n \n" : "\n");
}

module.exports = {
  fillMeter,
  meterSegment,
  pill,
  buildSegment,
  buildRows,
  leftCap,
  rightCap,
  joinSegments,
  segmentContent,
  renderMeterSegment,
  renderGroup,
  renderPillRows,
  joinFlex,
};
