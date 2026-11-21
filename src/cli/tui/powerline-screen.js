// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { THEMES } = require("../../lib/shared");
const {
  STYLES,
  STYLE_ORDER,
  SLOT_PRESETS,
  INVERTED_BY_DEFAULT,
  MAX_GLYPHS,
  normalizePowerline,
  applyStyle,
  detectStyle,
  parseGlyph,
  glyphChar,
  glyphName,
} = require("../../lib/powerline");
const { RESET, BOLD, clampCursor, moveCursor, backToMain, persist } = require("./state");
const { dim, tabKeys, screenFrame } = require("./frame");
const { openThemes } = require("./themes-screen");

// Rows of the Powerline screen; rows with a slot open the glyph editor.
const POWERLINE_ROWS = [
  { id: "enabled", label: "Join adjacent widgets" },
  { id: "style", label: "Style" },
  { id: "separators", label: "Separators", slot: "separator" },
  { id: "startCaps", label: "Start caps", slot: "startCap" },
  { id: "endCaps", label: "End caps", slot: "endCap" },
  { id: "theme", label: "Themes" },
];

const GLYPH_SLOTS = {
  separator: { key: "separators", title: "Separators" },
  startCap: { key: "startCaps", title: "Start caps" },
  endCap: { key: "endCaps", title: "End caps" },
};

const POWERLINE_HELP = {
  enabled:
    "On: adjacent widgets share one pill, with a separator between them. Off: every widget gets its own pill.",
  style: "Sets start caps, end caps and separators in one go. Enter cycles the styles.",
  separators: "Glyphs between widgets of a pill. With several, they cycle per join, left to right.",
  startCaps: "Glyphs that open each pill. With several, they cycle per pill, left to right.",
  endCaps: "Glyphs that close each pill. With several, they cycle per pill, left to right.",
  theme: "Enter opens the Themes tab.",
};

function glyphLabel(config, hex, slot) {
  return `${glyphChar(hex, slot, config.ascii)}  ${glyphName(hex)} (U+${hex})`;
}

function glyphSummary(config, slot) {
  const list = config.powerline[GLYPH_SLOTS[slot].key];
  if (!list.length) {
    return "none";
  }

  return list.map((hex) => `${glyphChar(hex, slot, config.ascii)} ${glyphName(hex)}`).join(", ");
}

function powerlineRowValue(config, row) {
  if (row.id === "enabled") {
    return config.powerline.enabled ? "on" : "off";
  }

  if (row.id === "style") {
    const style = detectStyle(config.powerline);
    return style ? STYLES[style].name : "custom";
  }

  if (row.slot) {
    return glyphSummary(config, row.slot);
  }

  return THEMES[config.theme]?.name ?? config.theme;
}

function powerlineDetails(state, row) {
  if (!row) {
    return null;
  }
  const lines = [POWERLINE_HELP[row.id] ?? ""];
  if (row.id === "style") {
    const width = Math.max(...STYLE_ORDER.map((id) => STYLES[id].name.length));
    lines.push(
      "",
      ...STYLE_ORDER.map(
        (id) => `${STYLES[id].name.padEnd(width)}  ${dim(state, STYLES[id].description)}`
      )
    );
  }
  if (row.slot) {
    lines.push("", "Enter edits the list.");
  }
  return { title: row.label, lines };
}

function drawPowerline(state) {
  const items = POWERLINE_ROWS.map((row) => ({
    text: row.label,
    value: powerlineRowValue(state.config, row),
  }));
  const notes =
    state.config.layout !== "pills"
      ? ["Powerline shapes apply to Pills. Switch layout with l."]
      : [
          "A style sets caps and separators together; edit a list to fine-tune it.",
          "Lists with several glyphs cycle left to right. A Flex Separator starts a new pill.",
        ];

  return screenFrame(state, {
    title: "Powerline",
    items,
    notes,
    details: powerlineDetails(state, POWERLINE_ROWS[state.cursor]),
    keys: tabKeys(state, [
      [state.ui.glyph.upDown, "move"],
      ["enter", "toggle / cycle / edit"],
    ]),
  });
}

function drawGlyphs(state) {
  const { key, title } = GLYPH_SLOTS[state.glyphSlot];
  const list = state.config.powerline[key];
  const isSeparator = state.glyphSlot === "separator";

  if (state.hexInput !== null) {
    return screenFrame(state, {
      title: `Powerline ${state.ui.glyph.dot} ${title}`,
      items: [
        `Code point: ${BOLD}U+${state.hexInput}${RESET}${dim(state, "_".repeat(6 - state.hexInput.length))}`,
        "",
        dim(state, "Type 4-6 hex digits, e.g. E0B0 (Powerline), E0C0 (flame), 2588 (block)."),
      ],
      selected: -1,
      keys: [
        ["enter", "apply"],
        ["esc", "cancel"],
      ],
    });
  }

  const items = list.length
    ? list.map((hex, index) => {
        const inverted =
          isSeparator && state.config.powerline.separatorInvert[index] ? "inverted" : "";
        return { text: glyphLabel(state.config, hex, state.glyphSlot), value: inverted };
      })
    : [
        dim(
          state,
          `None: ${isSeparator ? "widgets in a pill touch directly" : "pills have no cap on this side"}. Press a to add one.`
        ),
      ];
  const hovered = list[state.cursor];

  return screenFrame(state, {
    title: `Powerline ${state.ui.glyph.dot} ${title}`,
    items,
    selected: list.length ? state.cursor : -1,
    notes: isSeparator
      ? ["Invert swaps the separator colors; left-pointing glyphs get it automatically."]
      : [],
    details: {
      title,
      lines: hovered
        ? [
            `${glyphChar(hovered, state.glyphSlot, state.config.ascii)}  ${glyphName(hovered)}`,
            { dim: `U+${hovered}, ${state.cursor + 1} of ${list.length}` },
            "",
            POWERLINE_HELP[key],
          ]
        : [POWERLINE_HELP[key]],
    },
    keys: [
      [state.ui.glyph.upDown, "select"],
      [state.ui.glyph.leftRight, "cycle preset"],
      ["a", "add"],
      ["i", "insert"],
      ["x", "remove"],
      ["c", "clear"],
      ["h", "hex"],
      ...(isSeparator ? [["v", "invert"]] : []),
      ["esc", "back"],
    ],
  });
}

function openPowerline(state) {
  state.screen = "powerline";
  state.cursor = 0;
}

function openGlyphs(state, slot) {
  state.screen = "glyphs";
  state.glyphSlot = slot;
  state.hexInput = null;
  state.cursor = 0;
}

function setPowerline(state, changes) {
  state.config.powerline = normalizePowerline({ ...state.config.powerline, ...changes });
  persist(state);
}

function onPowerline(state, key) {
  if (key.name === "escape") {
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, POWERLINE_ROWS.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, POWERLINE_ROWS.length);
    return;
  }

  if (key.name !== "return" && key.name !== "space") {
    return;
  }

  const row = POWERLINE_ROWS[state.cursor];
  if (key.name === "space" && row.id !== "enabled" && row.id !== "style") {
    return;
  }

  if (row.id === "enabled") {
    setPowerline(state, { enabled: !state.config.powerline.enabled });
  } else if (row.id === "style") {
    // A customized setup restarts the cycle at the first style.
    const current = STYLE_ORDER.indexOf(detectStyle(state.config.powerline));
    const next = STYLE_ORDER[(current + 1) % STYLE_ORDER.length];
    state.config.powerline = applyStyle(state.config.powerline, next);
    persist(state);
  } else if (row.slot) {
    openGlyphs(state, row.slot);
  } else {
    openThemes(state);
  }
}

// Writes a new glyph list for the open slot. Separators carry their invert
// flags along so a flag stays with its glyph when the list is edited.
function setGlyphs(state, list, invert) {
  const changes = { [GLYPH_SLOTS[state.glyphSlot].key]: list };
  if (state.glyphSlot === "separator") {
    changes.separatorInvert = invert;
  }
  setPowerline(state, changes);
  clampCursor(state, list.length);
}

function onGlyphHex(state, key) {
  if (key.name === "escape") {
    state.hexInput = null;
    return;
  }

  if (key.name === "backspace" || key.name === "delete") {
    state.hexInput = state.hexInput.slice(0, -1);
    return;
  }

  if (key.name === "return") {
    const hex = state.hexInput.length >= 4 ? parseGlyph(state.hexInput) : null;
    if (!hex) {
      state.flashMessage = `⚠ U+${state.hexInput || "?"} is not a printable glyph`;
      return;
    }

    const list = [...state.config.powerline[GLYPH_SLOTS[state.glyphSlot].key]];
    const invert = [...state.config.powerline.separatorInvert];
    const index = list.length ? state.cursor : 0;
    list[index] = hex;
    invert[index] = INVERTED_BY_DEFAULT.has(hex);
    state.hexInput = null;
    setGlyphs(state, list, invert);
    return;
  }

  const char = key.sequence;
  if (char && /^[0-9a-f]$/i.test(char) && state.hexInput.length < 6) {
    state.hexInput += char.toUpperCase();
  }
}

function onGlyphs(state, key) {
  if (state.hexInput !== null) {
    onGlyphHex(state, key);
    return;
  }

  const presets = SLOT_PRESETS[state.glyphSlot];
  const list = [...state.config.powerline[GLYPH_SLOTS[state.glyphSlot].key]];
  const invert = [...state.config.powerline.separatorInvert];

  if (key.name === "escape") {
    state.screen = "powerline";
    state.cursor = POWERLINE_ROWS.findIndex((row) => row.slot === state.glyphSlot);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, list.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, list.length);
    return;
  }

  if ((key.name === "left" || key.name === "right") && list.length) {
    // Custom glyphs jump to the first (or last) preset.
    const current = presets.indexOf(list[state.cursor]);
    const step = key.name === "right" ? 1 : -1;
    let next;
    if (current === -1) {
      next = step === 1 ? 0 : presets.length - 1;
    } else {
      next = (current + step + presets.length) % presets.length;
    }
    list[state.cursor] = presets[next];
    invert[state.cursor] = INVERTED_BY_DEFAULT.has(presets[next]);
    setGlyphs(state, list, invert);
    return;
  }

  if (key.name === "a" || key.name === "i") {
    if (list.length >= MAX_GLYPHS) {
      state.flashMessage = `⚠ At most ${MAX_GLYPHS} glyphs per list`;
      return;
    }
    const at =
      list.length && key.name === "a" ? state.cursor + 1 : Math.min(state.cursor, list.length);
    list.splice(at, 0, presets[0]);
    invert.splice(at, 0, INVERTED_BY_DEFAULT.has(presets[0]));
    state.cursor = at;
    setGlyphs(state, list, invert);
    return;
  }

  if ((key.name === "x" || key.name === "delete") && list.length) {
    list.splice(state.cursor, 1);
    invert.splice(state.cursor, 1);
    setGlyphs(state, list, invert);
    return;
  }

  if (key.name === "c") {
    state.cursor = 0;
    setGlyphs(state, [], []);
    return;
  }

  if (key.name === "h") {
    state.hexInput = "";
    return;
  }

  if (key.name === "v" && state.glyphSlot === "separator" && list.length) {
    invert[state.cursor] = !invert[state.cursor];
    setGlyphs(state, list, invert);
  }
}

module.exports = {
  POWERLINE_ROWS,
  GLYPH_SLOTS,
  drawPowerline,
  openPowerline,
  onPowerline,
  drawGlyphs,
  openGlyphs,
  onGlyphs,
};
