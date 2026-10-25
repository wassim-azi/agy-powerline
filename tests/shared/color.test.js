// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { LAYOUT_ORDER } = require("../../src/lib/config");
const { record, stripAnsi, PAYLOAD } = require("../helpers");
const {
  renderStatusline,
  defaultConfig,
  mergeConfig,
  resolveColorDepth,
  rgbToAnsi256,
} = require("../../src/lib/shared");
const { METER_STYLE_IDS } = require("../../src/lib/widget-style");

async function run() {
  const base = {
    ...JSON.parse(PAYLOAD),
    vcs: { type: "git", branch: "main", dirty: true },
  };
  const emptyEnv = {};

  for (const layout of LAYOUT_ORDER) {
    const out = stripAnsi(
      renderStatusline(base, { ...defaultConfig(), layout, ascii: true }, { env: emptyEnv })
    );
    const nonAscii = [...out].filter((c) => c.codePointAt(0) > 127);
    record(
      `ascii ${layout} layout is pure ASCII`,
      nonAscii.length === 0,
      nonAscii.length ? [...new Set(nonAscii)].join(" ") : "no caps/joins/dots outside ASCII"
    );

    const styled = METER_STYLE_IDS.filter((meterStyle) => {
      const text = stripAnsi(
        renderStatusline(
          base,
          { ...defaultConfig(), layout, ascii: true, meterStyle },
          { env: emptyEnv }
        )
      );
      return [...text].some((c) => c.codePointAt(0) > 127);
    });
    record(
      `ascii ${layout} layout stays pure ASCII with every meter style`,
      !styled.length,
      styled
    );
  }

  const colored = renderStatusline(base, defaultConfig(), {
    color: "256",
    env: emptyEnv,
  });
  record(
    "256-color mode uses 38;5/48;5 only",
    /38;5;/.test(colored) && !/38;2;/.test(colored) && !/48;2;/.test(colored)
  );

  const plain = renderStatusline(base, defaultConfig(), {
    color: "none",
    env: emptyEnv,
  });
  record(
    "no-color mode emits no fg/bg sequences",
    !/\x1b\[(38|48);/.test(plain) && /Gemini/.test(stripAnsi(plain))
  );

  record(
    "NO_COLOR env resolves to none",
    resolveColorDepth({ configColor: "auto", env: { NO_COLOR: "1" } }) === "none"
  );
  record(
    "256color TERM resolves to 256",
    resolveColorDepth({ configColor: "auto", env: { TERM: "xterm-256color" } }) === "256"
  );
  record(
    "COLORTERM truecolor resolves to truecolor",
    resolveColorDepth({ configColor: "auto", env: { COLORTERM: "truecolor" } }) === "truecolor"
  );
  record(
    "empty env keeps historical truecolor default",
    resolveColorDepth({ configColor: "auto", env: {} }) === "truecolor"
  );
  record(
    "explicit CLI flag beats NO_COLOR",
    resolveColorDepth({ configColor: "auto", cliColor: "256", env: { NO_COLOR: "1" } }) === "256"
  );
  record("pure red maps to xterm 196", rgbToAnsi256([255, 0, 0]) === 196);
  record(
    "256 colors pick the nearest cube level or gray: near-black text stays gray, not navy",
    rgbToAnsi256([22, 22, 28]) === 234 &&
      rgbToAnsi256([86, 156, 214]) === 74 &&
      rgbToAnsi256([128, 128, 128]) === 244 &&
      rgbToAnsi256([0, 0, 0]) === 16 &&
      rgbToAnsi256([255, 255, 255]) === 231
  );
  record(
    "mergeConfig keeps ascii and color",
    (() => {
      const merged = mergeConfig({ ascii: true, color: "256" });
      return merged.ascii === true && merged.color === "256";
    })()
  );
}

module.exports = { run };
