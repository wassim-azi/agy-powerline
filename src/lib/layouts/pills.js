// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

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
  withContrast,
} = require("../colors");
const { gradientStops } = require("../themes");
const { pickGlyph, glyphChar } = require("../powerline");
const {
  quotaColor,
  contextColor,
  resolveQuotaThresholds,
  resolveContextThresholds,
  shouldBlink,
  formatContextTokens,
  label,
  visibleWidth,
  formatResetText,
  paceIndex,
  paceGlyph,
  formatPaceDelta,
  formatQuotaForecast,
} = require("../formatters");
const { execWidgetOutput, restoreAfterReset } = require("../exec");
const {
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

const WHITE = [255, 255, 255];

// The pace marker sits in the cell matching how much of the quota window has
// passed: a fill reaching past it means quota is going faster than time. It
// takes the other cell color (track on fill, fill on track) so it always shows.
function fillMeter(pct, width, fillColor, emptyColor, segmentColor, pace = {}) {
  const ratio = Math.max(0, Math.min(100, Number(pct))) / 100;
  const used = Math.round(ratio * width);
  const marker = paceIndex(pace.elapsedPct, width);
  // pips, the default, needs a Unicode font: ASCII mode keeps the cells.
  const pips = pace.style === "pips";
  if (pips && !pace.ascii && getActiveDepth() !== "none") {
    const track = withContrast(segmentColor, segmentColor, PIP_CONTRAST, pace.textColor);
    return pipMeter(used, marker, width, pace.textColor, track) + bg(segmentColor);
  }
  if (METER_STYLES[pace.style] && !(pips && pace.ascii)) {
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

// Small dots on the pill's own color: the filled ones in the pill's text color,
// the rest in the pill's color moved toward it until they reach 3:1 (WCAG's
// minimum for graphics). A light fill and a dark track can't both stand out
// on every pill: on a bright one the light dots fade, on a deep one the dark
// ones do. The pace marker is a larger dot in the other color, so nothing in
// the meter is a line.
const PIP_CONTRAST = 3;

function pipMeter(used, marker, width, fillColor, emptyColor) {
  let meter = "";
  let color = null;

  for (let i = 0; i < width; i++) {
    const filled = i < used;
    const next = i === marker ? (filled ? emptyColor : fillColor) : filled ? fillColor : emptyColor;
    if (next !== color) {
      meter += fg(next);
      color = next;
    }
    meter += i === marker ? METER_STYLES.pips[2] : METER_STYLES.pips[0];
  }

  return meter;
}

// A glyph style draws on the pill's own color, with no cells: filled glyphs in
// the pill's text color (readable on the pill, gradients included), empty
// ones in the same color dimmed. ASCII mode keeps # and -.
function glyphMeter(used, marker, width, [full, empty, pace], { ascii, textColor }) {
  let meter = fg(textColor);
  let dim = false;

  for (let i = 0; i < width; i++) {
    const blank = i !== marker && i >= used;
    if (blank !== dim) {
      meter += blank ? DIM : NORMAL;
      dim = blank;
    }
    if (i === marker) {
      meter += (!ascii && pace) || paceGlyph(ascii);
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
  const tag = (icon) => widgetTag(id, { emojis, raw, icon, widget, ascii, lang: session.lang });
  const lbl = (value, icon) => ` ${tag(icon)}${value} `;
  // The pill frames a colored meter; plain-text meters (ASCII) get brackets.
  const open = ascii ? "[" : "";
  const close = ascii ? "]" : "";
  const meterLabel = () => ` ${tag()}${open}`;
  const pace = (quota) => (isPaced(widget, config) ? quota.elapsedPct : null);
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
  const quotaState = (quota, baseColor) => {
    const thresh = resolveQuotaThresholds(widget, config);
    const view = resolveQuotaView(quota, config, session.lang);
    const level =
      view.remaining <= thresh.crit ? "crit" : view.remaining <= thresh.warn ? "warn" : "normal";
    const blink = !ascii && shouldBlink(level, thresh.blink);
    const color = quotaColor(view.remaining, baseColor, {
      crit: thresh.crit,
      warn: thresh.warn,
      critColor: colors.warn,
      warnColor: colors.caution,
    });
    return { view, blink, color };
  };
  const quotaMeter = (quota, baseColor) => {
    const { view, blink, color } = quotaState(quota, baseColor);
    return meterSegment(
      color,
      view.pct,
      meterLabel(),
      `${close} ${view.text} `,
      view.isRemaining,
      blink,
      pace(quota)
    );
  };
  const contextState = () => {
    const thresh = resolveContextThresholds(widget, config);
    const { size, pct, exceeds200k } = resolveContextView(widget, session);
    const level =
      exceeds200k || pct >= thresh.crit ? "crit" : pct >= thresh.warn ? "warn" : "normal";
    const blink = !ascii && shouldBlink(level, thresh.blink);
    const color = contextColor(pct, colors.context, exceeds200k, {
      crit: thresh.crit,
      warn: thresh.warn,
      critColor: colors.warn,
      warnColor: colors.caution,
    });
    const over200k = exceeds200k ? ` ${t("over_200k", session.lang)}` : "";
    return { size, pct, over200k, blink, color };
  };
  const quotaReset = (quota, color, weekly = false) => {
    const text = quota
      ? formatResetText(quota, {
          format: widget.format,
          fallback: config.resetFormat || "countdown",
          weekly,
          clock: config.clock,
        })
      : "";
    // No usable reset in the payload: hide rather than claim "now".
    return text ? pill(color, lbl(text)) : null;
  };

  if (hasNoData(id, session) || hiddenByThreshold(id, widget, session)) {
    return null;
  }

  return renderWidget(id, {
    session,
    widget,
    config,
    emojis,
    ascii,
    raw,
    isLines: false,
    osIcons: OS_ICONS,
    ramCaution: RAM_CAUTION,
    ramDanger: RAM_DANGER,
    titleMax: TITLE_MAX,
    subagentDetail,
    readEnvValue,
    widgetTag,
    execWidgetOutput,
    text: (value, { pillColor = "meta", icon } = {}) =>
      pill(colors[pillColor] || colors.meta, lbl(value, icon)),
    taggedText: (tagText, value) => pill(colors.meta, ` ${tagText}${value} `),
    valueWithLevel: (value, level) => {
      let color = colors.meta;
      if (level === "danger") {
        color = colors.warn;
      } else if (level === "caution") {
        color = colors.caution;
      }
      return pill(color, lbl(value));
    },
    cacheHit: (pct) => {
      let color = colors.meta;
      if (pct >= 80) {
        color = colors.fiveHour;
      } else if (pct >= 50) {
        color = colors.weekly;
      }
      return pill(color, lbl(`${pct}%`));
    },
    quotaMeter: (quota, colorSlot) => quotaMeter(quota, colors[colorSlot]),
    quotaPct: (quota, colorSlot) => {
      const { view, blink, color } = quotaState(quota, colors[colorSlot]);
      return pill(color, lbl(`${view.text}${paceDelta(quota)}${forecast(quota)}`), blink);
    },
    quotaReset: (quota, colorSlot, weekly = false) => quotaReset(quota, colors[colorSlot], weekly),
    tightestQuota: (quota) => {
      const { view, blink, color } = quotaState(quota, colors.fiveHour);
      const reset = quota.reset ? `${ascii ? ", " : " · "}${quota.reset}` : "";
      return pill(
        color,
        lbl(`${quota.label} ${view.text}${paceDelta(quota)}${forecast(quota)}${reset}`),
        blink
      );
    },
    contextBar: () => {
      const { size, pct, over200k, blink, color } = contextState();
      return meterSegment(
        color,
        pct,
        meterLabel(),
        `${close} ${formatContextTokens(session.usedTokens, size)} (${pct.toFixed(1)}%)${over200k} `,
        false,
        blink
      );
    },
    contextPct: () => {
      const { pct, over200k, blink, color } = contextState();
      return pill(color, lbl(`${pct.toFixed(1)}%${over200k}`), blink);
    },
    contextTokens: () => {
      const { size, blink, color } = contextState();
      return pill(color, lbl(formatContextTokens(session.usedTokens, size)), blink);
    },
    budgetText: (text, pct) => {
      if (pct === null) {
        return pill(colors.meta, lbl(text));
      }
      // A budget alerts like the context and token usage widgets: caution, then danger.
      const thresh = resolveContextThresholds(widget, config);
      const level = pct >= thresh.crit ? "crit" : pct >= thresh.warn ? "warn" : "normal";
      const color = contextColor(pct, colors.meta, false, {
        crit: thresh.crit,
        warn: thresh.warn,
        critColor: colors.warn,
        warnColor: colors.caution,
      });
      return pill(color, lbl(text), !ascii && shouldBlink(level, thresh.blink));
    },
    gitBranch: ({ branch, dirty, opStr, syncPart }) => {
      const mark = dirty ? `${ascii ? "* " : "● "}` : "";
      const opPart = opStr ? `|${opStr}` : "";
      return pill(
        dirty ? colors.gitDirty : colors.git,
        lbl(`${mark}${branch}${opPart}${syncPart}`)
      );
    },
    gitChanges: (parts) => pill(colors.git, lbl(parts.map((part) => part.text).join(" "))),
    gitFiles: (parts, hasConflicts) =>
      pill(
        hasConflicts ? colors.gitDirty : colors.git,
        lbl(parts.map((part) => part.text).join(" "))
      ),
    agentState: ({ text, idle }) =>
      pill(idle ? colors.meta : colors.warn, lbl(text, idle ? "🟢" : undefined)),
    sandbox: ({ text, net }) =>
      pill(net ? colors.warn : colors.git, lbl(text, net ? "🌐" : undefined)),
    execSegment: (output) => {
      const icon = widget.icon !== undefined ? widget.icon : "⚡";
      const named = widget.label || "";
      const color = colors.meta;
      if (!icon || raw) {
        return pill(color, named && !raw ? ` ${named}: ${output} ` : ` ${output} `);
      }
      return pill(color, label(emojis, icon, named, output));
    },
  });
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

    placed.push({ widget, group: current, index: current.length });
    current.push(segment);
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

// Compared as the terminal will draw them: at 256 colors two different colors
// can land on the same code, and without color everything is the same.
function sameColor(a, b) {
  return bg(a) === bg(b);
}

// Each solid Powerline glyph (U+E0B0 to U+E0BE, even code points) has a thin
// outline twin at the next code point. The round twins are drawn shorter than
// the cell in many Nerd Fonts, so round joins use a box-drawing line, which
// spans the full height.
function thinGlyph(glyph) {
  const code = glyph.codePointAt(0);
  if (glyph.length !== 1 || code < 0xe0b0 || code > 0xe0be || code % 2 !== 0) {
    return glyph;
  }
  return code === 0xe0b4 || code === 0xe0b6 ? "│" : String.fromCodePoint(code + 1);
}

// A separator between two widgets of the same color would vanish, so it is
// drawn as its thin outline in the text color instead, the way Powerline
// divides one color. ASCII joins are characters, not shapes, so they take the
// text color too, which reads on any pill. Inverted separators (meant for
// left-pointing glyphs) take the next widget's color on the previous one's.
function joinSegments(previous, next, glyph, invert, textColor, ascii = false) {
  if (!glyph) {
    return "";
  }

  if (ascii || sameColor(previous.color, next.color)) {
    return fg(next.textColor || textColor) + bg(next.color) + thinGlyph(glyph);
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
// Glyphs are drawn without bold, which some fonts draw wider or shifted, and
// the pill ends on the terminal's background so the padding after it stays
// clear even without an end cap. Without color, solid caps would be blobs of
// text color, so only ASCII brackets are kept.
function renderGroup(group, colors, config, counters = { pill: 0, separator: 0 }) {
  const { powerline } = config;
  const ascii = config.ascii === true;
  const terminal = colors.terminal;
  const pillIndex = counters.pill++;
  const caps = ascii || getActiveDepth() !== "none";
  const cap = (list, slot) => (caps ? glyphChar(pickGlyph(list, pillIndex), slot, ascii) : "");
  const startCap = cap(powerline.startCaps, "startCap");
  const endCap = cap(powerline.endCaps, "endCap");

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
      out +=
        NORMAL + joinSegments(segment, group[i + 1], glyph, invert === true, colors.text, ascii);
    }
  }

  const last = group[group.length - 1].color;
  return out + NORMAL + (endCap ? rightCap(last, terminal, endCap) : capBackground(terminal));
}

// With joins off every widget is a pill of its own, one space from the next;
// the Flex Separator still decides where the row opens up.
function renderPills(group, colors, config, counters) {
  if (config.powerline.enabled) {
    return renderGroup(group, colors, config, counters);
  }
  return group.map((segment) => renderGroup([segment], colors, config, counters)).join(" ");
}

// Web previews ask for each gap between widget groups to be marked, so the
// page can stretch it to its own width instead of these fixed columns. These
// SGR codes mean nothing to a terminal and never reach one.
const FLEX_GAP_START = "\x1b[1000m";
const FLEX_GAP_END = "\x1b[1001m";

function joinFlex(parts, terminalWidth, markGaps = false) {
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

    const gap = " ".repeat(pad);
    out += (markGaps ? FLEX_GAP_START + gap + FLEX_GAP_END : gap) + parts[i];
  }

  return out;
}

// Applies global row alignment ("left", "center", or "spread") to one row's
// pre-rendered widget groups; shared by Pills and Lines.
function alignGroups(groups, alignment, terminalWidth, markGaps, renderGroupFn) {
  const splitUnseparated = alignment === "spread" && groups.length === 1 && groups[0].length > 1;
  const parts = splitUnseparated
    ? groups[0].map((item) => renderGroupFn([item]))
    : groups.map((group) => renderGroupFn(group));

  if (alignment === "center") {
    const line = parts.join(" ");
    if (!(terminalWidth > 0)) {
      return line;
    }
    const extra = terminalWidth - visibleWidth(line);
    return extra > 0 ? " ".repeat(Math.floor(extra / 2)) + line : line;
  }

  return joinFlex(parts, terminalWidth, markGaps);
}

// Pills fill their whole cell, so stacked rows touch; rowGap puts a blank
// line between them. It holds a space so a host that drops empty lines keeps it.
function renderPillRows(rows, session, colors, config) {
  const counters = { pill: 0, separator: 0 };

  return rows
    .map((row) =>
      alignGroups(
        row,
        config.alignment,
        session.terminalWidth,
        session.flexGaps === true,
        (group) => renderPills(group, colors, config, counters)
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
  alignGroups,
  FLEX_GAP_START,
  FLEX_GAP_END,
};
