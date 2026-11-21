// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { THEMES, THEME_ORDER } = require("../../lib/shared");
const { parseColor, fg } = require("../../lib/colors");
const { RESET, moveCursor, backToMain, persist } = require("./state");
const { dim, heading, screenFrame } = require("./frame");

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
  const items = THEME_ORDER.map((id) => {
    const theme =
      THEMES[id] || (id === "custom" ? { name: "Custom", description: "Your own colors" } : null);
    if (!theme) {
      return "";
    }
    const swatch = themeSwatch(state.config, id === "custom" ? null : theme.colors);
    const badge = id === state.config.theme ? state.ui.chip("current", true) : "";
    const extra = id === "custom" ? `${theme.description}, Enter to edit` : theme.description;
    return { lead: swatch, text: theme.name, badge, extra };
  });

  return screenFrame(state, {
    title: "Themes",
    items,
    details: themeDetails(state, THEME_ORDER[state.cursor]),
    keys: [
      [state.ui.glyph.upDown, "preview"],
      ["enter", "apply"],
      ["esc", "back"],
    ],
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

// The curated colors in a row, the slot's current one in brackets.
function curatedPalette(config, current) {
  const block = config.ascii ? "#" : "■";
  return CURATED_HEX_PALETTE.map((hex) => {
    const swatch = `${fg(parseColor(hex))}${block}${RESET}`;
    return hex === current ? `[${swatch}]` : ` ${swatch} `;
  }).join("");
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
    notes: ["Cycle a slot through curated colors; the preview updates as you go."],
    details: slot && {
      title: slot.label,
      lines: [
        current ? `Now ${current}.` : "Now the base theme's color.",
        "",
        curatedPalette(state.config, current),
        "",
        { dim: "← → and Enter step through these colors." },
      ],
    },
    keys: [
      [state.ui.glyph.upDown, "slot"],
      [state.ui.glyph.leftRight, "cycle color"],
      ["enter", "next color"],
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
  state.cursor = Math.max(0, THEME_ORDER.indexOf(state.config.theme));
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

  if (key.name === "left") {
    const slot = CUSTOM_COLOR_SLOTS[state.cursor];
    if (slot) {
      cycleCustomColor(state, slot.key, -1);
    }
    return;
  }

  if (key.name === "right" || key.name === "return" || key.name === "space") {
    const slot = CUSTOM_COLOR_SLOTS[state.cursor];
    if (slot) {
      cycleCustomColor(state, slot.key, 1);
    }
  }
}

function onThemes(state, key) {
  if (key.name === "escape") {
    backToMain(state);
    return;
  }

  if (key.name === "up") {
    moveCursor(state, -1, THEME_ORDER.length);
    return;
  }

  if (key.name === "down") {
    moveCursor(state, 1, THEME_ORDER.length);
    return;
  }

  if (key.name === "c" || key.name === "e") {
    openCustomTheme(state);
    return;
  }

  if (key.name === "return") {
    const selected = THEME_ORDER[state.cursor];
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
