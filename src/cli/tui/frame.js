// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { wrapText } = require("../tui-style");
const { visibleWidth } = require("../../lib/formatters");
const { TABS, TAB_OF_SCREEN, REPO_URL } = require("./state");
const { previewParts } = require("./preview");
const { overlayHelpModal } = require("./help-screen");
const { version: VERSION } = require("../../../package.json");

// Window sizes where the editor changes shape: from MEDIUM columns the
// descriptions line up in a column; from WIDE the list gets a details panel
// next to it.
const MEDIUM = 80;
const WIDE = 140;
// A list taller than the window scrolls, but keeps at least this many rows
// before the editor gives up its spacing and the preview's toggles.
const MIN_LIST_ROWS = 6;
// Wait for a short window to give up, one step at a time, so the list keeps rows.
const COMPACT_STEPS = [
  { tagline: true, gaps: true, notes: true },
  { tagline: false, gaps: true, notes: true },
  { tagline: false, gaps: false, notes: true },
  { tagline: false, gaps: false, notes: false },
];

// The editor fills the window, so the live preview has the room the real bar
// gets in agy.
function frameWidth(state) {
  const columns = state.columnsOverride || state.stdout.columns || 100;
  return Math.max(50, columns - 1);
}

function frameHeight(state) {
  return Math.max(12, state.rowsOverride || state.stdout.rows || 40);
}

// Secondary text in the theme's readable gray (see tui-style.js).
function dim(state, text) {
  return state.ui.muted(text);
}

function heading(state, text) {
  return { raw: state.ui.heading(text) };
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// On a wide window the list and the details panel share the width evenly.
function splitWidths(width) {
  const list = Math.floor((width - 1) / 2);
  return { list, details: width - 1 - list };
}

// Keeps the cursor's row inside a window of `space` rows; returns the slice
// of the list to show.
function windowRows(state, count, selected, space) {
  if (state.scrollScreen !== state.screen) {
    state.scrollScreen = state.screen;
    state.scrollTop = 0;
  }
  if (count <= space) {
    state.scrollTop = 0;
    return { start: 0, end: count };
  }
  if (selected >= 0) {
    if (selected < state.scrollTop) {
      state.scrollTop = selected;
    } else if (selected >= state.scrollTop + space) {
      state.scrollTop = selected - space + 1;
    }
  }
  state.scrollTop = Math.max(0, Math.min(state.scrollTop, count - space));
  return { start: state.scrollTop, end: state.scrollTop + space };
}

// List items are { text, extra, value, number }, { divider: text }, or a plain
// line: extra is a description, value a setting's current value. From MEDIUM
// columns they line up in one column.
function listRows(state, items, selected, rowWidth) {
  const shown = (item) => item.value ?? item.extra ?? "";
  const entries = items.filter((item) => typeof item !== "string" && !item.divider);
  const labels = entries.filter((item) => shown(item));
  // A badge follows its label, so it counts toward the label's width.
  const labelWidth = (item) =>
    visibleWidth(item.text) + (item.badge ? 1 + visibleWidth(item.badge) : 0);
  const widest = Math.max(0, ...labels.map(labelWidth));
  const pad = frameWidth(state) >= MEDIUM ? Math.min(widest, Math.floor(rowWidth * 0.45)) : 0;
  const leadWidth = Math.max(0, ...entries.map((item) => visibleWidth(item.lead ?? "")));
  const lead = (item) =>
    leadWidth ? (item.lead ?? "") + " ".repeat(leadWidth - visibleWidth(item.lead ?? "")) : "";
  return items.map((item, index) => {
    if (typeof item === "string") {
      return item;
    }
    if (item.divider) {
      return `  ${item.divider}`;
    }
    return state.ui.row(index === selected, item.text, shown(item), item.number ?? null, {
      pad,
      lead: lead(item),
      badge: item.badge,
    });
  });
}

// Appends consistent global hints (? all keys, q save & quit) to every tab's
// bottom bar while keeping narrow terminals concise on one row.
function tabKeys(state, primaryKeys) {
  const concise = frameWidth(state) < MEDIUM ? primaryKeys.slice(0, 3) : primaryKeys;
  return [...concise, ["?", "all keys"], ["q", "save & quit"]];
}

// Details entries are plain strings (wrapped to the panel), { dim: text }
// (wrapped, in the muted color) or { raw: line } (as is: a rendered widget,
// a heading, a row of tags).
function detailsBody(state, lines, panelWidth) {
  const wrapWidth = Math.min(panelWidth - 4, 88);
  return lines.flatMap((entry) => {
    if (typeof entry === "string") {
      return wrapText(entry, wrapWidth);
    }
    if ("raw" in entry) {
      return [entry.raw];
    }
    return wrapText(entry.dim, wrapWidth).map((line) => dim(state, line));
  });
}

// Top lines, then blank lines, then bottom lines, in exactly `tall` rows;
// when both don't fit, the top wins.
function anchor(top, bottom, tall) {
  const free = tall - top.length - bottom.length;
  if (free < 0) {
    return [...top, ...bottom].slice(0, tall);
  }
  return [...top, ...Array(free).fill(""), ...bottom];
}

// Every screen: brand line and tabs, the screen's list (with a details panel
// beside it on a wide window, both as tall as the longer one, notes at the
// bottom), the live preview and the keys. Panels fit their content rather
// than the window, so a tall window doesn't get rows of empty boxes. A short
// window gives up blank lines, the tagline and the notes before the list
// starts to scroll.
function screenFrame(
  state,
  { title, head = [], items, selected = state.cursor, itemMap = null, notes = [], keys, details }
) {
  const width = frameWidth(state);
  const height = frameHeight(state);
  const wide = Boolean(details) && width >= WIDE;
  const widths = wide ? splitWidths(width) : { list: width, details: 0 };
  const preview = previewParts(state, width);
  const hints = state.ui.hints(keys, width - 1);
  const notesWidth = wide ? widths.details : widths.list;
  const noteLines = (step) =>
    step.notes && notes.length
      ? [
          "",
          ...detailsBody(
            state,
            notes.map((n) => ({ dim: n })),
            notesWidth
          ),
        ]
      : [];
  const detailLines = wide ? detailsBody(state, details.lines, widths.details) : [];

  // Rows left for the list panel's body once everything else is drawn: the
  // brand and tabs, both panels' borders, the preview and the key hints.
  const bodySpace = (step) =>
    height -
    1 -
    (step.gaps ? 3 : 0) -
    (step.tagline ? 1 : 0) -
    2 -
    2 -
    (2 + preview.bar.length) -
    hints.length;
  const listSpace = (step) => bodySpace(step) - head.length - (wide ? 0 : noteLines(step).length);
  const fits = (step) =>
    listSpace(step) >= items.length &&
    (!wide || detailLines.length + noteLines(step).length <= bodySpace(step));
  const step =
    COMPACT_STEPS.find(fits) ||
    COMPACT_STEPS.find((s) => listSpace(s) >= MIN_LIST_ROWS) ||
    COMPACT_STEPS[COMPACT_STEPS.length - 1];

  const selectedDisplay = itemMap && selected >= 0 ? itemMap.indexOf(selected) : selected;
  const content = Math.max(
    head.length + items.length + (wide ? 0 : noteLines(step).length),
    wide ? detailLines.length + noteLines(step).length : 0
  );
  const tall = Math.max(1, Math.min(content, bodySpace(step)));
  const { start } = windowRows(state, items.length, selectedDisplay, Math.max(1, listSpace(step)));
  // Keep a leading group divider visible when scrolled back to the first item.
  const effectiveStart =
    start === 1 && items[0]?.divider && selectedDisplay === 1 && listSpace(step) >= 2 ? 0 : start;
  const effectiveEnd = Math.min(items.length, effectiveStart + Math.max(1, listSpace(step)));
  const rows = listRows(state, items, selectedDisplay, widths.list - 4).slice(
    effectiveStart,
    effectiveEnd
  );
  const { up, down } = state.ui.glyph;
  const counts = {
    above: effectiveStart > 0 ? `${up} ${effectiveStart} more` : "",
    below: effectiveEnd < items.length ? `${down} ${items.length - effectiveEnd} more` : "",
    focused: true,
  };

  const body = wide
    ? state.ui.beside(
        state.ui.panel(title, anchor([...head, ...rows], [], tall), widths.list, counts),
        state.ui.panel(details.title, anchor(detailLines, noteLines(step), tall), widths.details)
      )
    : state.ui.panel(title, anchor([...head, ...rows], noteLines(step), tall), width, counts);

  // The star link sits at the right end of the brand line, shortened to the
  // star alone when the line is tight.
  const link = (text) => `\x1b]8;;${REPO_URL}\x07${text}\x1b]8;;\x07`;
  const star = link(`${state.ui.glyph.star} ${dim(state, "Star on GitHub")}`);
  const starShort = link(state.ui.glyph.star);
  const toast = state.flashMessage ? `   ${state.ui.toast(state.flashMessage)}` : "";
  const brand = ` ${state.ui.wordmark("agy-powerline")} ${state.ui.tag(`v${VERSION}`)}${toast}`;
  const gap = step.gaps ? [""] : [];
  const tabsLine = state.ui.tabs(TABS, TAB_OF_SCREEN[state.screen]);

  const tabRow = gap.length + 1 + (step.tagline ? 1 : 0) + (step.gaps ? 1 : 0) + 1;
  const listRowStart = tabRow + gap.length + 1 + head.length + 1;
  state.hitMap = {
    tabRow,
    tabs: state.ui.tabBounds(),
    listWidth: widths.list,
    listRowStart,
    visibleItems: Array.from({ length: rows.length }, (_, offset) => {
      const idx = effectiveStart + offset;
      if (itemMap) {
        return itemMap[idx] ?? null;
      }
      return items[idx]?.divider ? null : idx;
    }),
  };

  const frameLines = [
    ...gap,
    state.ui.spread(brand, star) ?? state.ui.spread(brand, starShort) ?? `${brand}  ${starShort}`,
    ...(step.tagline
      ? [` ${dim(state, `${state.ui.glyph.sparkle} Make agy feel like yours`)}`]
      : []),
    ...(step.gaps ? [state.ui.rule()] : []),
    tabsLine,
    ...gap,
    ...body,
    ...state.ui.panel(preview.title, preview.bar, width, {
      above: preview.controls,
      fillBg: preview.canvasBg,
    }),
    ...hints,
  ];

  return state.showHelp ? overlayHelpModal(state, frameLines, width, height) : frameLines;
}

module.exports = {
  MEDIUM,
  WIDE,
  MIN_LIST_ROWS,
  COMPACT_STEPS,
  frameWidth,
  frameHeight,
  dim,
  heading,
  capitalize,
  splitWidths,
  windowRows,
  listRows,
  tabKeys,
  detailsBody,
  anchor,
  screenFrame,
};
