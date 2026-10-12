"use strict";

const { charWidth, visibleWidth } = require("./formatters");

// When a row is wider than the terminal, widgets are dropped in this order,
// first entry first. Ids not listed (custom ones) go before all of them.
const DROP_ORDER = [
  "customText",
  "version",
  "cacheCreate",
  "cacheRead",
  "totalTokens",
  "cacheHit",
  "artifacts",
  "tasks",
  "plan",
  "ram",
  "project",
  "cwd",
  "exec",
  "agentState",
  "thirdPartyWeekly",
  "thirdPartyFiveHour",
  "weeklyReset",
  "fiveHourReset",
  "contextTokens",
  "git",
  "sandbox",
  "weeklyPct",
  "weeklyBar",
  "contextPct",
  "context",
  "fiveHourPct",
  "fiveHourBar",
  "quota",
  "model",
];

const LAYOUT_IDS = new Set(["separator", "lineBreak"]);

// Ends a cut line; ASCII mode uses "..." so it stays plain ASCII.
const ELLIPSIS = { unicode: "…", ascii: "..." };
const RESET = "\x1b[0m";
// One escape sequence: SGR colors, or an OSC 8 hyperlink.
const ESCAPE = /^(\x1b\[[0-9;]*[a-zA-Z]|\x1b\]8;;[^\x1b\x07]*(\x07|\x1b\\))/;

function dropRank(id) {
  return DROP_ORDER.indexOf(id);
}

function splitRows(widgets) {
  const rows = [[]];
  for (const widget of widgets) {
    if (widget.id === "lineBreak") {
      rows.push([]);
    } else {
      rows[rows.length - 1].push(widget);
    }
  }
  return rows;
}

function joinRows(rows) {
  return rows.flatMap((row, i) => (i === 0 ? row : [{ id: "lineBreak" }, ...row]));
}

// A dropped widget can leave separators at the edges or next to each other.
function tidySeparators(row) {
  const out = [];
  for (const widget of row) {
    if (widget.id === "separator" && (!out.length || out[out.length - 1].id === "separator")) {
      continue;
    }
    out.push(widget);
  }
  while (out.length && out[out.length - 1].id === "separator") {
    out.pop();
  }
  return out;
}

// Values only first (labels go, every widget stays), then a short model name
// and short quota meters, then the least useful widgets go one by one until
// the row fits or one widget is left.
function fitRow(row, width, measure) {
  if (measure(row) <= width) {
    return row;
  }

  let current = row.map((widget) =>
    LAYOUT_IDS.has(widget.id) ? widget : { ...widget, raw: true }
  );

  // A shorter model name ("3.8 Flash·High") and shorter meters (12 dots in
  // Lines) before any widget has to go.
  if (measure(current) > width) {
    current = current.map((widget) =>
      widget.id === "model" ? { ...widget, short: true } : { ...widget, compact: true }
    );
  }

  while (measure(current) > width) {
    const content = current.filter((widget) => !LAYOUT_IDS.has(widget.id));
    if (content.length <= 1) {
      break;
    }
    // Lowest rank goes first; on a tie, the rightmost one.
    let victim = content[0];
    for (const widget of content) {
      if (dropRank(widget.id) <= dropRank(victim.id)) {
        victim = widget;
      }
    }
    current = tidySeparators(current.filter((widget) => widget !== victim));
  }

  return current;
}

// measure(rowWidgets) returns the widest line those widgets render to.
function fitWidgets(widgets, width, measure) {
  return joinRows(splitRows(widgets).map((row) => fitRow(row, width, measure)));
}

// Last resort for a single widget wider than the terminal (a very long model
// name or path): cut the line and end it with an ellipsis.
function truncateLine(line, width, ascii = false) {
  if (visibleWidth(line) <= width) {
    return line;
  }

  const ellipsis = ascii ? ELLIPSIS.ascii : ELLIPSIS.unicode;
  const budget = width - ellipsis.length;
  let out = "";
  let used = 0;
  let rest = line;

  while (rest) {
    const escape = rest.match(ESCAPE);
    if (escape) {
      out += escape[0];
      rest = rest.slice(escape[0].length);
      continue;
    }
    const char = String.fromCodePoint(rest.codePointAt(0));
    const charCols = charWidth(char.codePointAt(0));
    if (used + charCols > budget) {
      break;
    }
    out += char;
    used += charCols;
    rest = rest.slice(char.length);
  }

  return out + RESET + ellipsis;
}

function truncateLines(text, width, ascii = false) {
  if (!(width > 0)) {
    return text;
  }
  return text
    .split("\n")
    .map((line) => truncateLine(line, width, ascii))
    .join("\n");
}

function widestLine(text) {
  return Math.max(0, ...String(text).split("\n").map(visibleWidth));
}

module.exports = {
  DROP_ORDER,
  fitWidgets,
  truncateLines,
  widestLine,
};
