// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { THEMES } = require("../../lib/shared");
const { parseColor, fg } = require("../../lib/colors");
const {
  BOLD,
  RESET,
  clampCursor,
  moveCursor,
  backToMain,
  persist,
  filteredThemes,
} = require("./state");
const { dim, heading, tabKeys, screenFrame } = require("./frame");

const CUSTOM_COLOR_SLOTS = [
  { key: "model", label: "Model" },
  { key: "fiveHour", label: "5h Quota" },
  { key: "weekly", label: "7d Quota" },
  { key: "context", label: "Context Window" },
  { key: "git", label: "VCS Git" },
  { key: "meta", label: "Metadata & Details" },
  { key: "caution", label: "Caution (getting low)" },
  { key: "warn", label: "Danger (critical)" },
];

const CURATED_HEX_PALETTE = [
  "#bd93f9", // Purple
  "#50fa7b", // Green
  "#ffb86c", // Orange
  "#ff79c6", // Pink
  "#f1fa8c", // Yellow
  "#ff5555", // Red
  "#8be9fd", // Cyan
  "#f8f8f2", // White
  "#6272a4", // Slate
  "#e06c75", // Coral
  "#98c379", // Mint
  "#61afef", // Sky
];

// Widget colors on the left, states on the right; a blank line between rows
// keeps the pills from touching.
const PALETTE_ROWS = [
  [
    ["model", "Model"],
    ["fiveHour", "OK"],
  ],
  [
    ["context", "Context"],
    ["caution", "Caution"],
  ],
  [
    ["git", "Git"],
    ["warn", "Danger"],
  ],
  [
    ["weekly", "7d quota"],
    ["meta", "Details"],
  ],
];

const toHex = (rgb) => `#${rgb.map((part) => part.toString(16).padStart(2, "0")).join("")}`;

function themeSwatch(config, colors) {
  if (!colors || config.ascii) {
    return "";
  }
  return (
    ["model", "context", "fiveHour", "caution", "warn"]
      .map((slot) => `${fg(colors[slot])}●`)
      .join("") + RESET
  );
}

// One color as a pill in that color with the theme's pill text, the way the
// bar draws it, then its hex value.
function colorCell(state, label, rgb, ink) {
  return `${state.ui.pill(` ${label.padEnd(9)}`, rgb, ink)}  ${dim(state, toHex(rgb))}`;
}

function paletteLines(state, colors) {
  return PALETTE_ROWS.flatMap((row, index) => [
    ...(index ? [""] : []),
    {
      raw: row
        .map(([slot, label]) => colorCell(state, label, colors[slot], colors.text))
        .join("    "),
    },
  ]);
}

// The editor drawn in the hovered theme: a selected and a normal row, and the
// three states quotas and the context go through.
function themeSample(state, colors) {
  const { on } = state.ui.glyph;
  const item = (slot, label) => `${fg(colors[slot])}${on} ${label}${RESET}`;
  return [
    { raw: state.ui.row(true, "Selected item", "its description") },
    { raw: state.ui.row(false, "Normal item", "its description") },
    {
      raw: `  ${item("fiveHour", "ok")}   ${item("caution", "caution")}   ${item("warn", "danger")}`,
    },
  ];
}

function themeDetails(state, id) {
  if (id === "custom") {
    return {
      title: "Custom",
      lines: [
        "Your own colors, on top of a base theme.",
        "",
        "Enter opens the color editor; the preview follows every change.",
      ],
    };
  }
  const theme = THEMES[id];
  if (!theme) {
    return null;
  }
  const background = { dark: "dark terminals", light: "light terminals" }[theme.kind];
  return {
    title: theme.name,
    lines: [
      `${theme.description}.`,
      ...(background ? [{ raw: `${dim(state, "For")} ${state.ui.tag(background)}` }] : []),
      "",
      heading(state, "Palette"),
      ...paletteLines(state, theme.colors),
      "",
      heading(state, "Sample"),
      ...themeSample(state, theme.colors),
    ],
  };
}

function drawThemes(state) {
  const themes = filteredThemes(state);
  const caret = state.config.ascii ? "_" : "▏";
  const showFilter = state.filterActive || Boolean(state.searchQuery);
  const queryText = state.searchQuery
    ? `${BOLD}${state.searchQuery}${RESET}${state.filterActive ? caret : ""}`
    : `${caret}${dim(state, "type to filter")}`;
  const head = showFilter ? [`${state.config.ascii ? "filter:" : "🔎"} ${queryText}`, ""] : [];
  const items = themes.length
    ? themes.map((id) => {
        const theme =
          THEMES[id] ||
          (id === "custom" ? { name: "Custom", description: "Your own colors" } : null);
        if (!theme) {
          return "";
        }
        const swatch = themeSwatch(state.config, id === "custom" ? null : theme.colors);
        const badge = id === state.config.theme ? state.ui.chip("current", true) : "";
        const extra = id === "custom" ? `${theme.description}, Enter to edit` : theme.description;
        return { lead: swatch, text: theme.name, badge, extra };
      })
    : [dim(state, `No theme matches "${state.searchQuery}". Esc to clear filter.`)];

  return screenFrame(state, {
    title: "Themes",
    head,
    items,
    selected: themes.length ? state.cursor : -1,
    details: themes.length ? themeDetails(state, themes[state.cursor]) : null,
    keys: state.filterActive
      ? [
          ["type", "filter"],
          [state.ui.glyph.upDown, "preview"],
          ["enter", "apply"],
          ["esc", "clear"],
        ]
      : tabKeys(state, [
          [state.ui.glyph.upDown, "preview"],
          ["/", "filter"],
          ["enter", "apply"],
        ]),
  });
}

function hexSwatch(config, hex) {
  if (!hex || hex === "(base)") return "from base theme";
  try {
    return `${fg(parseColor(hex))}${config.ascii ? "#" : "■"}${RESET} ${hex}`;
  } catch {
    return hex;
  }
}

// The curated colors in a row with an active pointer row underneath so the
// selected swatch stands out cleanly across both dark and light terminals.
function curatedPaletteLines(state, current) {
  const block = state.config.ascii ? "#" : "■";
  const strip = CURATED_HEX_PALETTE.map((hex) => {
    const swatch = `${fg(parseColor(hex))}${block}${RESET}`;
    return hex === current ? `[${swatch}]` : ` ${swatch} `;
  }).join("");
  const activeIdx = CURATED_HEX_PALETTE.indexOf(current);
  const pointerChar = state.config.ascii ? "^" : "▲";
  const pointerLine =
    activeIdx >= 0 ? " ".repeat(activeIdx * 3 + 1) + state.ui.accentText(pointerChar) : "";
  return pointerLine ? [strip, { raw: pointerLine }] : [strip];
}

function drawCustomTheme(state) {
  const customColors = state.config.customTheme?.colors || {};
  const items = CUSTOM_COLOR_SLOTS.map((slot) => ({
    text: slot.label,
    value: hexSwatch(state.config, customColors[slot.key] || "(base)"),
  }));
  const slot = CUSTOM_COLOR_SLOTS[state.cursor];
  const current = customColors[slot?.key];

  return screenFrame(state, {
    title: "Custom theme",
    items,
    notes: ["Cycle a slot through curated colors; x resets a slot to the base theme."],
    details: slot && {
      title: slot.label,
      lines: [
        current ? `Now ${current}.` : "Now the base theme's color.",
        "",
        ...curatedPaletteLines(state, current),
        "",
        { dim: "← →, Space and Enter step through these colors; x resets to base." },
      ],
    },
    keys: [
      [state.ui.glyph.upDown, "slot"],
      [state.ui.glyph.leftRight, "cycle color"],
      ["x", "base"],
      ["esc", "back"],
    ],
  });
}

function openCustomTheme(state) {
  state.screen = "customTheme";
  state.cursor = 0;
}

function openThemes(state) {
  state.screen = "themes";
  state.filterActive = false;
  state.searchQuery = "";
  const themes = filteredThemes(state);
  state.cursor = Math.max(0, themes.indexOf(state.config.theme));
}

function cycleCustomColor(state, slotKey, dir = 1) {
  if (!state.config.customTheme) {
    state.config.customTheme = { colors: {} };
  }
  if (!state.config.customTheme.colors) {
    state.config.customTheme.colors = {};
  }
  const current = state.config.customTheme.colors[slotKey];
  const idx = CURATED_HEX_PALETTE.indexOf(current);
  let nextIdx;
  if (idx === -1) {
    nextIdx = dir >= 0 ? 0 : CURATED_HEX_PALETTE.length - 1;
  } else {
    nextIdx = (idx + dir + CURATED_HEX_PALETTE.length) % CURATED_HEX_PALETTE.length;
  }
  state.config.customTheme.colors[slotKey] = CURATED_HEX_PALETTE[nextIdx];
  state.config.theme = "custom";
  persist(state);
}

function resetCustomColor(state, slotKey) {
  if (state.config.customTheme?.colors && slotKey in state.config.customTheme.colors) {
    delete state.config.customTheme.colors[slotKey];
    persist(state);
  }
}

function onCustomTheme(state, key) {
  if (key.name === "escape") {
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, CUSTOM_COLOR_SLOTS.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, CUSTOM_COLOR_SLOTS.length);
    return;
  }

  const slot = CUSTOM_COLOR_SLOTS[state.cursor];
  if (!slot) {
    return;
  }

  if (key.name === "x" || key.name === "delete" || key.name === "backspace") {
    resetCustomColor(state, slot.key);
    return;
  }

  if (key.name === "left") {
    cycleCustomColor(state, slot.key, -1);
    return;
  }

  if (key.name === "right" || key.name === "return" || key.name === "space") {
    cycleCustomColor(state, slot.key, 1);
  }
}

function onThemes(state, key) {
  const themes = filteredThemes(state);

  if (state.filterActive) {
    if (key.name === "escape") {
      state.filterActive = false;
      state.searchQuery = "";
      state.cursor = Math.max(0, filteredThemes(state).indexOf(state.config.theme));
      return;
    }
    if (key.name === "up") {
      moveCursor(state, -1, themes.length);
      return;
    }
    if (key.name === "down") {
      moveCursor(state, 1, themes.length);
      return;
    }
    if (key.name === "return" && themes[state.cursor]) {
      const selected = themes[state.cursor];
      state.filterActive = false;
      state.searchQuery = "";
      if (selected === "custom") {
        openCustomTheme(state);
        return;
      }
      state.config.theme = selected;
      persist(state);
      backToMain(state);
      return;
    }
    if (key.name === "backspace" || key.name === "delete") {
      if (state.searchQuery.length > 0) {
        state.searchQuery = state.searchQuery.slice(0, -1);
        state.cursor = 0;
        clampCursor(state, filteredThemes(state).length);
      }
      return;
    }
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      const char = key.sequence;
      if (char >= " " && char <= "~") {
        state.searchQuery += char;
        state.cursor = 0;
        clampCursor(state, filteredThemes(state).length);
      }
    }
    return;
  }

  if (key.sequence === "/") {
    state.filterActive = true;
    state.searchQuery = "";
    state.cursor = 0;
    return;
  }

  if (key.name === "escape") {
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, themes.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, themes.length);
    return;
  }

  if (key.name === "c" || key.name === "e") {
    openCustomTheme(state);
    return;
  }

  if (key.name === "return") {
    const selected = themes[state.cursor];
    if (!selected) {
      return;
    }
    if (selected === "custom") {
      openCustomTheme(state);
      return;
    }
    state.config.theme = selected;
    persist(state);
    backToMain(state);
  }
}

module.exports = {
  CUSTOM_COLOR_SLOTS,
  CURATED_HEX_PALETTE,
  drawThemes,
  openThemes,
  onThemes,
  drawCustomTheme,
  openCustomTheme,
  onCustomTheme,
};
