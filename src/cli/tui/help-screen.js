// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { truncateLines } = require("../../lib/fit");
const { RESET } = require("./state");

function shortcutGroups(ascii) {
  const arrowLR = ascii ? "<- ->" : "← →";
  const arrowUD = ascii ? "up/down" : "↑ ↓";
  const shiftUD = ascii ? "Shift+up/down" : "⇧↑↓";
  const sep = ascii ? "-" : "·";
  return [
    {
      title: "Navigation",
      rows: [
        [`${arrowLR} / Tab`, "Switch tabs (w o t l p i jump directly)"],
        [`${arrowUD} / Wheel`, `Move cursor ${sep} Click selects or activates`],
        ["Esc", "Back to Widgets or clear active filter"],
      ],
    },
    {
      title: "Widgets (w)",
      rows: [
        ["Enter / Space", "Edit selected widget options"],
        [`${shiftUD} / [ ]`, "Reorder widget, flex space, or new row"],
        [`a ${sep} s ${sep} n`, `Add widget ${sep} Flex space ${sep} New row`],
        [`x / Del ${sep} d`, `Remove item ${sep} Reset to defaults`],
      ],
    },
    {
      title: "Quick Actions & Preview",
      rows: [
        ["Enter / Space", "Toggle or cycle option (Settings, Edit, Powerline)"],
        [`/ ${sep} c / e`, `Filter Themes & Presets ${sep} Custom theme colors`],
        [`, / . ${sep} - / +`, `Preview scenario ${sep} Preview bar width`],
        [`g ${sep} ? ${sep} q`, `Star on GitHub ${sep} Toggle help ${sep} Save & quit`],
      ],
    },
  ];
}

// Renders a centered keyboard & mouse shortcut modal constrained to fit inside
// any window down to 60x16 (and stays pure ASCII / no-color when requested).
function overlayHelpModal(state, frameLines, width, height) {
  const ui = state.ui;
  const ascii = state.config.ascii === true;
  const boxWidth = Math.min(width - 2, 76);
  const innerWidth = Math.max(20, boxWidth - 4);
  const keyCol = Math.min(16, Math.floor(innerWidth * 0.3));
  const rawLines = [];
  const groups = shortcutGroups(ascii);

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (i > 0) {
      rawLines.push("");
    }
    rawLines.push(ui.heading(group.title));
    for (const [key, desc] of group.rows) {
      const label = key.padEnd(keyCol);
      const line = `${ui.accentText(label)} ${desc}`;
      rawLines.push(truncateLines(line, innerWidth, ascii));
    }
  }

  const maxBodyRows = Math.max(4, height - 4);
  const body =
    rawLines.length > maxBodyRows
      ? [
          ...rawLines.slice(0, maxBodyRows - 1),
          ui.muted("Resize terminal taller to view every shortcut."),
        ]
      : rawLines;

  const modal = ui.panel("Keyboard & Mouse Shortcuts", body, boxWidth, {
    focused: true,
    below: "Esc / ? close",
  });
  const modalHeight = modal.length;
  const top = Math.max(0, Math.floor((height - modalHeight) / 2));
  const left = Math.max(0, Math.floor((width - boxWidth) / 2));
  const out = [...frameLines];

  while (out.length < top + modalHeight && out.length < height) {
    out.push("");
  }

  const margin = " ".repeat(left);
  for (let i = 0; i < modalHeight && top + i < out.length; i++) {
    out[top + i] = `${RESET}${margin}${modal[i]}`;
  }

  return out.slice(0, height);
}

module.exports = {
  shortcutGroups,
  overlayHelpModal,
};
