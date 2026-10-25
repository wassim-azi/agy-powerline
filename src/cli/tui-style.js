// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Building blocks for the configure TUI: wordmark, tabs, panels, keycaps and
// chips. Colors come from the active theme, so the editor matches the bar.
const { fg, bg, mix, RESET, BOLD, DIM, getActiveDepth } = require("../lib/colors");
const { visibleWidth } = require("../lib/formatters");
const { truncateLines } = require("../lib/fit");

const BOX = {
  round: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
  ascii: { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" },
};

const GLYPHS = {
  fancy: {
    // A Powerline arrow: one column wide in every Nerd Font, like the pill ends.
    pointer: "\ue0b1",
    on: "●",
    off: "○",
    ok: "✓",
    star: "⭐",
    sparkle: "✨",
    dot: "·",
    up: "↑",
    down: "↓",
    upDown: "↑↓",
    leftRight: "←→",
    shift: "⇧",
  },
  ascii: {
    pointer: ">",
    on: "*",
    off: "-",
    ok: "ok",
    star: "*",
    sparkle: "*",
    dot: "-",
    up: "up",
    down: "down",
    upDown: "up/down",
    leftRight: "left/right",
    shift: "shift+",
  },
};

const REVERSE = "\x1b[7m";
// Rounded pill ends, the same glyphs as the bar's default style.
const CAP_LEFT = "\ue0b6";
const CAP_RIGHT = "\ue0b4";
const strip = (text) =>
  String(text)
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\x1b\]8;;[^\x07]*\x07/g, "");

// width: the outer width of the panels, so the tabs know when to drop their keys.
function makeUi(colors, { ascii = false, width = 100 } = {}) {
  const plain = getActiveDepth() === "none";
  const box = ascii ? BOX.ascii : BOX.round;
  const glyph = ascii ? GLYPHS.ascii : GLYPHS.fancy;
  // Blue to green from the theme: calm on dark and light terminals alike.
  const accent = colors.context;
  const accent2 = colors.fiveHour;
  // Secondary text in the theme's readable gray, not the terminal's "dim",
  // which many dark terminals draw almost invisible.
  const mutedColor = colors.meta;
  const borderColor = mix(colors.track, colors.meta, 0.4);

  function muted(text) {
    return plain ? `${DIM}${text}${RESET}` : `${fg(mutedColor)}${text}${RESET}`;
  }

  function wordmark(text) {
    if (plain) {
      return BOLD + text + RESET;
    }
    const chars = Array.from(text);
    const last = Math.max(1, chars.length - 1);
    return (
      BOLD + chars.map((char, i) => fg(mix(accent, accent2, i / last)) + char).join("") + RESET
    );
  }

  // Text on a filled, round-ended pill; ASCII mode keeps the fill and drops
  // the round ends (spaces instead), and no-color mode uses reverse video.
  function pill(text, fill = accent, ink = colors.text) {
    if (plain) {
      return `${REVERSE}${BOLD} ${text} ${RESET}`;
    }
    if (ascii) {
      return `${bg(fill)}${fg(ink)}${BOLD} ${text} ${RESET}`;
    }
    return `${fg(fill)}${CAP_LEFT}${bg(fill)}${fg(ink)}${BOLD}${text}${RESET}${fg(fill)}${CAP_RIGHT}${RESET}`;
  }

  // A quiet label, like a keycap: preset names, the version.
  function tag(text) {
    return quiet(text);
  }

  // A pill in the theme's track gray with muted text, for tags and keycaps.
  function quiet(text, weight = "") {
    if (plain) {
      return `[${text}]`;
    }
    const body = `${bg(colors.track)}${fg(mutedColor)}${weight}`;
    if (ascii) {
      return `${body} ${text} ${RESET}`;
    }
    return `${fg(colors.track)}${CAP_LEFT}${body}${text}${RESET}${fg(colors.track)}${CAP_RIGHT}${RESET}`;
  }

  function accentText(text) {
    return plain ? `${BOLD}${text}${RESET}` : `${fg(accent)}${BOLD}${text}${RESET}`;
  }

  // A small heading inside a panel.
  function heading(text) {
    return plain
      ? `${BOLD}${text.toUpperCase()}${RESET}`
      : `${fg(mutedColor)}${BOLD}${text.toUpperCase()}${RESET}`;
  }

  function keycap(key) {
    return quiet(key, BOLD);
  }

  // Key hints as keycaps, wrapped to the width without splitting a hint.
  function hints(items, lineWidth) {
    const lines = [];
    let line = "";
    for (const [key, label] of items) {
      const hint = `${keycap(key)} ${muted(label)}`;
      const next = line ? `${line}  ${hint}` : hint;
      if (line && visibleWidth(next) > lineWidth) {
        lines.push(line);
        line = hint;
      } else {
        line = next;
      }
    }
    if (line) {
      lines.push(line);
    }
    return lines.map((text) => ` ${text}`);
  }

  // left, then right ending at the panels' inner edge; null when they don't
  // both fit with room between them.
  function spread(left, right) {
    const free = width - visibleWidth(left) - visibleWidth(right) - 1;
    return free >= 3 ? left + " ".repeat(free) + right : null;
  }

  // A thin line across the panels' width, in the border color.
  function rule() {
    const line = box.h.repeat(Math.max(0, width - 2));
    return ` ${plain ? line : fg(borderColor) + line + RESET}`;
  }

  // Tabs for the main screens; the current one is a filled pill, and the
  // navigation keys sit at the right end. On a narrow terminal the navigation
  // keys go first, then the tabs' key letters.
  function tabs(items, current) {
    const draw = (withKeys) =>
      " " +
      items
        .map(({ id, label, key }) => {
          if (id === current) {
            return pill(label);
          }
          return ` ${label}${withKeys && key ? ` ${muted(key)}` : ""} `;
        })
        .join(" ");
    const nav = muted(`${glyph.leftRight} navigate   q quit`);
    const full = draw(true);
    return spread(full, nav) ?? (visibleWidth(full) <= width - 1 ? full : draw(false));
  }

  // An on/off toggle; key, when given, follows the label like a tab's letter.
  function chip(label, on, key = "") {
    const mark = on ? glyph.on : glyph.off;
    const hint = key ? ` ${muted(key)}` : "";
    return (on ? `${fg(accent2)}${mark}${RESET} ${label}` : muted(`${mark} ${label}`)) + hint;
  }

  // A rounded panel with its title in the top border. Content wider than the
  // panel is cut with an ellipsis instead of wrapping. above and below sit at
  // the right end of the top and bottom borders (a scrolled list's counts),
  // so they cost no rows.
  function panel(title, body, panelWidth = width, { above = "", below = "" } = {}) {
    const space = Math.max(10, panelWidth - 4);
    const border = (text) => (plain ? text : fg(borderColor) + text + RESET);
    const edge = (text) => (text ? ` ${muted(text)} ${border(box.h)}` : "");
    // A title too long for the border is cut, like the rows.
    const room = Math.max(1, panelWidth - 5 - visibleWidth(edge(above)));
    const label = title ? ` ${truncateLines(title, room, ascii)} ` : "";
    const ink = plain ? "" : fg(accent);
    const top =
      border(box.tl + box.h) +
      BOLD +
      ink +
      label +
      RESET +
      border(
        box.h.repeat(Math.max(0, panelWidth - 3 - visibleWidth(label) - visibleWidth(edge(above))))
      ) +
      edge(above) +
      border(box.tr);
    const rows = body.map((line) => {
      const clipped = truncateLines(line, space, ascii);
      const pad = " ".repeat(Math.max(0, space - visibleWidth(clipped)));
      return border(box.v) + " " + clipped + RESET + pad + " " + border(box.v);
    });
    const bottom =
      border(box.bl + box.h.repeat(Math.max(0, panelWidth - 2 - visibleWidth(edge(below))))) +
      edge(below) +
      border(box.br);
    return [top, ...rows, bottom];
  }

  // One list row: pointer, number, lead (an icon or swatch), the label and
  // its extra. The selected row's label is an accent pill and its pointer and
  // number light up; other labels sit where the pill's ends would be, so the
  // columns stay put. pad lines up the extras of a list in one column.
  // badge (e.g. "current") follows the label outside the pill, so it keeps
  // its own color.
  function row(selected, text, extra = "", number = null, { pad = 0, lead = "", badge = "" } = {}) {
    const index = number === null ? "" : `${String(number).padStart(2)} `;
    const front = lead ? `${lead} ` : "";
    const after = badge ? ` ${badge}` : "";
    const width = visibleWidth(text) + visibleWidth(after);
    const gap = extra ? " ".repeat(Math.max(3, pad - width + 3)) : "";
    if (selected) {
      const point = plain ? glyph.pointer : `${fg(accent)}${BOLD}${glyph.pointer}${RESET}`;
      const lit = plain ? index : `${fg(accent)}${BOLD}${index}${RESET}`;
      const note = extra ? `${gap}${BOLD}${extra}${RESET}` : "";
      return `${point} ${lit}${front}${pill(strip(text))}${after}${note}`;
    }
    const note = extra ? `${gap}${muted(extra)}` : "";
    return `  ${index ? muted(index) : ""}${front} ${text} ${after}${note}`;
  }

  // Two panels next to each other, one space apart; the shorter one is
  // padded with blank lines of its width.
  function beside(left, right) {
    const height = Math.max(left.length, right.length);
    const blank = (lines) => " ".repeat(lines.length ? visibleWidth(lines[0]) : 0);
    return Array.from(
      { length: height },
      (_, i) => `${left[i] ?? blank(left)} ${right[i] ?? blank(right)}`
    );
  }

  // Messages starting with ⚠ are warnings; everything else is a success.
  function toast(message) {
    if (!message) {
      return "";
    }
    const warning = message.startsWith("⚠");
    const text = message.replace(/^⚠\s*/, "");
    const color = warning ? colors.caution : accent2;
    const mark = warning ? (ascii ? "!" : "⚠") : glyph.ok;
    return plain ? `${BOLD}${mark} ${text}${RESET}` : `${fg(color)}${BOLD}${mark} ${text}${RESET}`;
  }

  return {
    glyph,
    muted,
    wordmark,
    pill,
    tag,
    heading,
    accentText,
    spread,
    rule,
    keycap,
    hints,
    tabs,
    chip,
    panel,
    row,
    beside,
    toast,
    accent,
  };
}

// Word wrap for plain text; a word longer than the width gets a line of its
// own and the panel cuts it.
function wrapText(text, lineWidth) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && visibleWidth(next) > lineWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}

module.exports = { makeUi, wrapText };
