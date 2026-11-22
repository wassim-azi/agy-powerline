// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const {
  getConfigPath,
  WIDGET_CATALOG,
  widgetLabel,
  defaultConfig,
  themeColors,
  PRESETS,
  PRESET_ORDER,
} = require("../../lib/shared");
const { editFields: getEditFields, stepNumberField } = require("../../lib/widget-options");
const { fg } = require("../../lib/colors");
const { stripControl, splitGraphemes } = require("../../lib/formatters");
const {
  RESET,
  BOLD,
  filteredAddableWidgets,
  clampCursor,
  moveCursor,
  backToMain,
  persist,
  widgetIcon,
  widgetCount,
} = require("./state");
const { widgetPreview, widgetComparisonPreviews } = require("./preview");
const {
  WIDE,
  frameWidth,
  splitWidths,
  dim,
  heading,
  capitalize,
  tabKeys,
  screenFrame,
} = require("./frame");

const EXEC_NOTE = {
  dim: "Runs only in agy, from your install folder; previews here show [cmd].",
};

// Longest custom badge text; the badge is meant to be a word or two.
const TEXT_MAX = 40;

function moveItem(state, offset) {
  const next = state.cursor + offset;

  if (next < 0 || next >= state.config.widgets.length) {
    return;
  }

  const items = state.config.widgets;
  const current = items[state.cursor];
  items[state.cursor] = items[next];
  items[next] = current;
  state.cursor = next;
  persist(state);
}

function removeItem(state) {
  if (!state.config.widgets.length) {
    return;
  }

  state.config.widgets.splice(state.cursor, 1);
  clampCursor(state, state.config.widgets.length);
  persist(state);
}

function addItem(state, id, after = state.cursor) {
  let widget = { id };
  if (id === "customText") {
    widget = { id, text: "Custom" };
  } else if (id === "env") {
    widget = { id, var: "NODE_ENV" };
  } else if (id === "exec") {
    widget = { id, cmd: "git stash list | wc -l" };
    state.flashMessage = `⚠ Shell Command runs "${widget.cmd}" on every refresh. Edit "cmd" in ${getConfigPath()}`;
  }

  if (!state.config.widgets.length) {
    state.config.widgets.push(widget);
    state.cursor = 0;
  } else {
    state.config.widgets.splice(after + 1, 0, widget);
    state.cursor = after + 1;
  }

  persist(state);
}

function insertSeparator(state) {
  addItem(state, "separator");
}

function insertLineBreak(state) {
  addItem(state, "lineBreak");
}

function presetsUsing(state, id) {
  const names = PRESET_ORDER.filter((name) =>
    PRESETS[name].widgets.some((widget) => widget.id === id)
  ).map((name) => PRESETS[name].name);
  return [
    heading(state, "In presets"),
    names.length ? { raw: names.map(state.ui.tag).join(" ") } : { dim: "none" },
  ];
}

// A widget's own settings from the config file, cleaned of control
// characters before they reach the terminal.
function widgetOptions(state, widget) {
  return Object.entries(widget)
    .filter(([key]) => key !== "id")
    .map(([key, value]) => ({
      raw: `${dim(state, key)}  ${stripControl(typeof value === "string" ? value : JSON.stringify(value))}`,
    }));
}

function previewOneWidget(state, widget) {
  return widgetPreview(state, widget, splitWidths(frameWidth(state)).details - 4);
}

function widgetDetails(state, widget) {
  if (!widget) {
    return { title: "No widgets", lines: ["Press a to add your first widget."] };
  }
  if (widget.id === "separator") {
    return {
      title: "Flex space",
      lines: [
        "Grows to fill the free space in its row, pushing the widgets after it to the right. In Pills it also starts a new pill.",
      ],
    };
  }
  if (widget.id === "lineBreak") {
    return {
      title: "New row",
      lines: ["Starts a new row: the widgets after it go on the next line of the bar."],
    };
  }

  const meta = WIDGET_CATALOG.find((item) => item.id === widget.id);
  const options = widgetOptions(state, widget);
  const detailWidth = splitWidths(frameWidth(state)).details - 4;
  return {
    title: [widgetIcon(state.config, widget.id), widgetLabel(widget.id)].filter(Boolean).join(" "),
    lines: [
      `${capitalize(meta?.description ?? widget.id)}.`,
      "",
      heading(state, "Preview"),
      ...previewOneWidget(state, widget),
      ...widgetComparisonPreviews(state, widget, detailWidth),
      "",
      heading(state, "Options"),
      ...(options.length
        ? options
        : [{ dim: "Defaults. Press Enter to customize colors, labels, meters, or thresholds." }]),
      "",
      ...presetsUsing(state, widget.id),
      ...(widget.id === "exec" ? ["", EXEC_NOTE] : []),
    ],
  };
}

function rowDivider(state, rowNum) {
  const text = state.config.ascii ? `-- Row ${rowNum} --` : `── Row ${rowNum} ──`;
  return { divider: dim(state, text) };
}

function drawMain(state) {
  const { upDown, shift, dot } = state.ui.glyph;
  // Flex spaces and new rows are layout, not widgets: they get no number, so
  // the numbers match the widget count in the title. Row headers sit above each
  // lineBreak group without changing widget indices.
  let number = 0;
  let rowNum = 1;
  const items = [];
  const itemMap = [];

  if (state.config.widgets.length) {
    items.push(rowDivider(state, rowNum));
    itemMap.push(null);
    for (let i = 0; i < state.config.widgets.length; i++) {
      const widget = state.config.widgets[i];
      const meta = WIDGET_CATALOG.find((item) => item.id === widget.id);
      let extra = meta?.summary ?? "";
      if (widget.id === "exec" && widget.cmd) {
        extra = `cmd: ${widget.cmd}`;
      } else if (widget.text) {
        extra = `text: ${widget.text}`;
      } else if (widget.warn != null || widget.crit != null) {
        const parts = [];
        if (widget.warn != null) parts.push(`warn ${widget.warn}%`);
        if (widget.crit != null) parts.push(`crit ${widget.crit}%`);
        if (widget.blink) parts.push("blink");
        extra = parts.join(", ");
      }
      // Layout items read as quiet dividers, not as widgets.
      if (widget.id === "separator" || widget.id === "lineBreak") {
        const divider =
          widget.id === "separator"
            ? `${state.config.ascii ? "..." : "╌╌"} flex space`
            : `${state.config.ascii ? "--" : "↵"} new row`;
        items.push({ text: dim(state, divider), number: "" });
        itemMap.push(i);
        if (widget.id === "lineBreak" && i < state.config.widgets.length - 1) {
          rowNum += 1;
          items.push(rowDivider(state, rowNum));
          itemMap.push(null);
        }
        continue;
      }
      number += 1;
      items.push({
        lead: widgetIcon(state.config, widget.id),
        text: widgetLabel(widget.id),
        extra: stripControl(extra),
        number,
      });
      itemMap.push(i);
    }
  } else {
    items.push(
      dim(state, `${state.ui.glyph.sparkle} nothing here yet. Press a to add your first widget.`)
    );
    itemMap.push(null);
  }

  return screenFrame(state, {
    title: `Your widgets ${dim(state, `${dot} ${widgetCount(state.config)}`)}`,
    items,
    selected: state.config.widgets.length ? state.cursor : -1,
    itemMap,
    notes: state.config.widgets.length
      ? [
          `enter Edit ${dot} ${shift}${upDown} Reorder ${dot} s Flex space ${dot} n New row ${dot} x Remove`,
        ]
      : [],
    details: widgetDetails(state, state.config.widgets[state.cursor]),
    keys: tabKeys(state, [
      [upDown, "move"],
      ["enter", "edit"],
      ["a", "add"],
      ["x", "remove"],
    ]),
  });
}

// A theme slot's color name, in that color.
function colorName(config, slot) {
  const colors = themeColors(config.theme, config.customTheme);
  const block = config.ascii ? "#" : "■";
  return colors[slot] ? `${fg(colors[slot])}${block}${RESET} ${slot}` : String(slot);
}

function editFields(state, widget) {
  return getEditFields(widget, state.config, {
    colorName: (value) => (value === undefined ? "theme default" : colorName(state.config, value)),
    cmdHelp: `The command runs only in agy, from your install folder. Edit it in ${getConfigPath()}.`,
  });
}

function editedWidget(state) {
  return state.config.widgets[state.editIndex];
}

function drawEdit(state) {
  const widget = editedWidget(state);
  const fields = editFields(state, widget);
  const field = fields[state.cursor];
  const typing = state.textInput !== null;
  const caret = state.config.ascii ? "_" : "▏";
  const items = fields.map((item) => ({
    text: item.label,
    value:
      typing && item === field
        ? `${BOLD}${state.textInput}${RESET}${caret}`
        : stripControl(item.show(widget[item.key])),
  }));
  const label = [widgetIcon(state.config, widget.id), widgetLabel(widget.id)]
    .filter(Boolean)
    .join(" ");
  const changeKeys = field?.text
    ? [["enter", "type"]]
    : field?.number !== undefined
      ? [[state.ui.glyph.leftRight, "change"]]
      : field?.fixed
        ? []
        : [[`enter ${state.ui.glyph.leftRight}`, "change"]];

  return screenFrame(state, {
    title: `Edit ${dim(state, `${state.ui.glyph.dot} ${label}`)}`,
    items,
    // A wide window shows the help in the details panel instead.
    notes: field && frameWidth(state) < WIDE ? [field.help] : [],
    details: field && {
      title: field.label,
      lines: [field.help, "", heading(state, "Preview"), ...previewOneWidget(state, widget)],
    },
    keys: typing
      ? [
          ["type", "text"],
          ["enter", "keep"],
          ["esc", "cancel"],
        ]
      : [
          [state.ui.glyph.upDown, "option"],
          ...changeKeys,
          ...(field?.fixed ? [] : [["x", "default"]]),
          ["esc", "back"],
        ],
  });
}

function openEdit(state) {
  const widget = state.config.widgets[state.cursor];
  if (!widget || widget.id === "separator" || widget.id === "lineBreak") {
    return;
  }
  state.editIndex = state.cursor;
  state.textInput = null;
  state.screen = "edit";
  state.cursor = 0;
}

function closeEdit(state) {
  state.textInput = null;
  state.screen = "main";
  state.cursor = state.editIndex;
  clampCursor(state, state.config.widgets.length);
}

// Sets one option, or removes it when the value is undefined, then saves.
function setOption(state, key, value) {
  const widget = editedWidget(state);
  if (value === undefined) {
    delete widget[key];
  } else {
    widget[key] = value;
  }
  persist(state);
}

function stepOption(state, field, direction) {
  const current = editedWidget(state)[field.key];
  if (field.number !== undefined) {
    setOption(state, field.key, stepNumberField(field, current, direction));
    return;
  }
  const index = field.values.findIndex((value) => value === current);
  const next = (Math.max(0, index) + direction + field.values.length) % field.values.length;
  setOption(state, field.key, field.values[next]);
}

function onEdit(state, key) {
  const fields = editFields(state, editedWidget(state));
  const field = fields[state.cursor];

  if (state.textInput !== null) {
    if (key.name === "escape") {
      state.textInput = null;
    } else if (key.name === "return") {
      const text = stripControl(state.textInput).trim();
      setOption(state, field.key, text || undefined);
      state.textInput = null;
    } else if (key.name === "backspace" || key.name === "delete") {
      // A whole character: an emoji with its skin tone or ZWJ parts, a
      // letter with its accent.
      state.textInput = splitGraphemes(state.textInput).slice(0, -1).join("");
    } else if (key.sequence && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(key.sequence)) {
      // Count whole grapheme clusters so multi-codepoint emojis fit icon maxLength.
      const max = field?.maxLength ?? TEXT_MAX;
      if (splitGraphemes(state.textInput + key.sequence).length <= max) {
        state.textInput += key.sequence;
      }
    }
    return;
  }

  if (key.name === "escape") {
    closeEdit(state);
    return;
  }
  if (key.name === "up") {
    moveCursor(state, -1, fields.length);
    return;
  }
  if (key.name === "down") {
    moveCursor(state, 1, fields.length);
    return;
  }
  if (!field || field.fixed) {
    return;
  }
  if (key.name === "x" || key.name === "delete" || key.name === "backspace") {
    setOption(state, field.key, undefined);
    return;
  }
  if (field.text) {
    if (key.name === "return") {
      state.textInput = editedWidget(state)[field.key] ?? "";
    }
    return;
  }
  if (key.name === "left" || key.name === "right") {
    stepOption(state, field, key.name === "left" ? -1 : 1);
    return;
  }
  if ((key.name === "return" || key.name === "space") && field.values) {
    stepOption(state, field, 1);
  }
}

function openAdd(state) {
  // The Add list reuses state.cursor; remember the selected widget so the new
  // one goes in after it and Esc puts the cursor back where it was.
  state.addAfter = state.cursor;
  state.screen = "add";
  state.searchQuery = "";
  state.cursor = 0;
  clampCursor(state, filteredAddableWidgets(state).length);
}

function drawAdd(state) {
  const widgets = filteredAddableWidgets(state);
  const caret = state.config.ascii ? "_" : "▏";
  const search = state.searchQuery
    ? `${BOLD}${state.searchQuery}${RESET}${caret}`
    : `${caret}${dim(state, "type to filter")}`;
  const head = [`${state.config.ascii ? "search:" : "🔎"} ${search}`, ""];
  const items = widgets.length
    ? widgets.map((widget) => ({
        lead: widgetIcon(state.config, widget.id),
        text: widget.label,
        extra: widget.summary,
      }))
    : [dim(state, `No widget matches "${state.searchQuery}". Backspace to edit, Esc to go back.`)];
  const hovered = widgets[state.cursor];

  return screenFrame(state, {
    title: "Add a widget",
    head,
    items,
    selected: widgets.length ? state.cursor : -1,
    details: hovered
      ? {
          title: [widgetIcon(state.config, hovered.id), hovered.label].filter(Boolean).join(" "),
          lines: [
            `${capitalize(hovered.description)}.`,
            "",
            heading(state, "Preview"),
            ...previewOneWidget(state, { id: hovered.id }),
            "",
            ...presetsUsing(state, hovered.id),
            "",
            { dim: hovered.unique ? "One per bar." : "Can be added more than once." },
            ...(hovered.id === "exec" ? [EXEC_NOTE] : []),
          ],
        }
      : { title: "No match", lines: ["Backspace edits the search, Esc clears it."] },
    keys: [
      ["type", "filter"],
      [state.ui.glyph.upDown, "move"],
      ["enter", "add"],
      ["backspace", "delete"],
      ["esc", "back"],
    ],
  });
}

function onMain(state, key) {
  if (key.name === "up") {
    if (key.shift) {
      moveItem(state, -1);
    } else {
      moveCursor(state, -1, state.config.widgets.length);
    }
    return;
  }

  if (key.name === "down") {
    if (key.shift) {
      moveItem(state, 1);
    } else {
      moveCursor(state, 1, state.config.widgets.length);
    }
    return;
  }

  if (key.sequence === "[" || key.name === "[") {
    moveItem(state, -1);
    return;
  }

  if (key.sequence === "]" || key.name === "]") {
    moveItem(state, 1);
    return;
  }

  if (key.name === "return") {
    openEdit(state);
    return;
  }

  if (key.name === "a") {
    openAdd(state);
    return;
  }

  if (key.name === "s") {
    insertSeparator(state);
    return;
  }

  if (key.name === "n") {
    insertLineBreak(state);
    return;
  }

  if (key.name === "x" || key.name === "delete" || key.name === "backspace") {
    removeItem(state);
    return;
  }

  if (key.name === "d") {
    state.config = defaultConfig();
    state.customGradientSpec = null;
    if (persist(state)) {
      state.flashMessage = "Reset to default configuration.";
    }
    clampCursor(state, state.config.widgets.length);
  }
}

function onAdd(state, key) {
  const items = filteredAddableWidgets(state);

  if (key.name === "escape") {
    if (state.searchQuery.length > 0) {
      state.searchQuery = "";
      state.cursor = 0;
      clampCursor(state, filteredAddableWidgets(state).length);
      return;
    }
    state.cursor = state.addAfter;
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, items.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, items.length);
    return;
  }

  if (key.name === "return" && items[state.cursor]) {
    addItem(state, items[state.cursor].id, state.addAfter);
    backToMain(state);
    return;
  }

  if (key.name === "backspace" || key.name === "delete") {
    if (state.searchQuery.length > 0) {
      state.searchQuery = state.searchQuery.slice(0, -1);
      state.cursor = 0;
      clampCursor(state, filteredAddableWidgets(state).length);
    }
    return;
  }

  if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
    const char = key.sequence;
    if (char >= " " && char <= "~") {
      state.searchQuery += char;
      state.cursor = 0;
      clampCursor(state, filteredAddableWidgets(state).length);
    }
  }
}

module.exports = {
  drawMain,
  onMain,
  drawAdd,
  onAdd,
  openAdd,
  drawEdit,
  onEdit,
  openEdit,
  closeEdit,
};
