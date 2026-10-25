// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, runCli } = require("../helpers");
const {
  parseColor,
  buildCustomTheme,
  renderStatusline,
  defaultConfig,
  sampleData,
} = require("../../src/lib/shared");
const { THEMES, THEME_ORDER, COLOR_KEYS, resolveThemeId } = require("../../src/lib/themes");

// Typical terminal backgrounds, slightly toward the hard side: a lighter
// dark background and an off-white light one.
const TERMINAL_BG = { dark: [40, 42, 54], light: [245, 245, 240] };
const WIDGET_KEYS = [
  "model",
  "fiveHour",
  "weekly",
  "thirdParty",
  "context",
  "git",
  "gitDirty",
  "meta",
  "caution",
  "warn",
];
const STATE_KEYS = ["fiveHour", "caution", "warn"];

function linear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function lab(rgb) {
  const [r, g, b] = rgb.map(linear);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaE(a, b) {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// Machado et al. (2009) full-severity color-vision-deficiency matrices.
const CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulate(rgb, matrix) {
  const l = rgb.map(linear);
  return matrix.map((row) => {
    const v = Math.max(0, Math.min(1, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]));
    return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
  });
}

function checkThemeQuality() {
  const builtIn = THEME_ORDER.filter((id) => id !== "custom");

  const misnamed = builtIn.filter((id) => !id.startsWith(`${THEMES[id].kind}-`));
  record(
    "theme ids start with their kind (dark-, light- or colorblind-)",
    misnamed.length === 0,
    misnamed.join(", ")
  );

  for (const id of builtIn) {
    const t = THEMES[id];
    const c = t.colors;
    const bg = TERMINAL_BG[t.kind === "light" || id.endsWith("-light") ? "light" : "dark"];
    const problems = [];

    for (const key of COLOR_KEYS.filter((k) => k !== "terminal")) {
      if (!Array.isArray(c[key])) problems.push(`missing ${key}`);
    }

    for (const key of WIDGET_KEYS) {
      if (!c[key]) continue;
      const pill = contrast(c.text, c[key]);
      const line = contrast(c[key], bg);
      if (pill < 4.5) problems.push(`pill text on ${key} ${pill.toFixed(2)}`);
      if (line < 4.5) problems.push(`${key} on terminal ${line.toFixed(2)}`);
    }

    const pairs = [
      ["fiveHour", "caution"],
      ["fiveHour", "warn"],
      ["caution", "warn"],
      ["git", "gitDirty"],
      ["gitDirty", "caution"],
    ];
    for (const healthy of ["weekly", "context"]) {
      pairs.push([healthy, "caution"], [healthy, "warn"]);
    }
    for (const [a, b] of pairs) {
      const d = deltaE(c[a], c[b]);
      if (d < 25) problems.push(`${a}/${b} too similar (ΔE ${d.toFixed(1)})`);
    }

    if (t.kind === "colorblind") {
      for (const [name, matrix] of Object.entries(CVD)) {
        for (let i = 0; i < STATE_KEYS.length; i++) {
          for (let j = i + 1; j < STATE_KEYS.length; j++) {
            const d = deltaE(
              simulate(c[STATE_KEYS[i]], matrix),
              simulate(c[STATE_KEYS[j]], matrix)
            );
            if (d < 20)
              problems.push(`${name}: ${STATE_KEYS[i]}/${STATE_KEYS[j]} ΔE ${d.toFixed(1)}`);
          }
        }
      }
    }

    record(
      `theme ${id} meets contrast and status-color targets`,
      problems.length === 0,
      problems.join("; ")
    );
  }

  record(
    "theme aliases resolve and unknown ids fall back to the default",
    resolveThemeId("dark") === "dark-aurora" &&
      resolveThemeId("light") === "light-paper" &&
      resolveThemeId("colorblind") === "colorblind-dark" &&
      resolveThemeId("oasis") === "dark-aurora" &&
      resolveThemeId("does-not-exist") === "dark-aurora"
  );
}

function checkCaps() {
  const config = { ...defaultConfig(), layout: "pills" };
  const out = renderStatusline(sampleData(), config, { color: "truecolor" });
  record(
    "pill caps use the terminal's own background (work on light terminals)",
    out.includes("\x1b[49m") && !out.includes("48;2;30;29;30")
  );

  const pinned = renderStatusline(
    sampleData(),
    { ...config, theme: "custom", customTheme: { colors: { terminal: "#102030" } } },
    { color: "truecolor" }
  );
  record("a custom theme can still pin the cap background", pinned.includes("48;2;16;32;48"));
}

// Every color pair the bar prints: pill text on its pill (bg then fg), and in
// Lines every text color on the terminal background.
function pillPairs(out) {
  return [...out.matchAll(/\x1b\[48;2;(\d+);(\d+);(\d+)m\x1b\[38;2;(\d+);(\d+);(\d+)m/g)].map(
    (m) => [m.slice(1, 4).map(Number), m.slice(4, 7).map(Number)]
  );
}

function textColors(out) {
  return [...out.matchAll(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g)].map((m) => m.slice(1, 4).map(Number));
}

// Gradients replace the theme's widget colors, so each preset has to stay
// readable with every theme kind, for any number of widgets in a row.
function checkGradientReadability() {
  const { GRADIENT_ORDER } = require("../../src/lib/themes");
  const data = sampleData();
  // Meters are left out: their fill isn't text.
  const ids = ["model", "cwd", "project", "contextPct", "fiveHourPct", "totalTokens", "git"];
  const failures = [];

  for (const gradient of GRADIENT_ORDER) {
    for (const themeId of ["dark-aurora", "light-paper", "colorblind-dark", "colorblind-light"]) {
      for (let count = 2; count <= ids.length; count++) {
        const widgets = ids.slice(0, count).flatMap((id) => [{ id }, { id: "separator" }]);
        const config = { ...defaultConfig(), theme: themeId, gradient, widgets };
        const overrides = { color: "truecolor", env: {} };

        for (const [bg, fg] of pillPairs(renderStatusline(data, config, overrides))) {
          if (contrast(bg, fg) < 4.5) {
            failures.push(`${gradient} pills ${themeId} ×${count}: ${contrast(bg, fg).toFixed(2)}`);
          }
        }

        const kind = THEMES[themeId].kind === "light" || themeId.endsWith("-light");
        const terminal = TERMINAL_BG[kind ? "light" : "dark"];
        const lines = renderStatusline(data, { ...config, layout: "lines" }, overrides);
        for (const fg of textColors(lines)) {
          if (contrast(terminal, fg) < 4.5) {
            failures.push(
              `${gradient} lines ${themeId} ×${count}: ${contrast(terminal, fg).toFixed(2)}`
            );
          }
        }
      }
    }
  }

  record(
    "gradient presets keep pill text and lines text at 4.5:1 with every theme kind",
    failures.length === 0,
    [...new Set(failures)].slice(0, 8).join("; ")
  );
}

async function run() {
  checkGradientReadability();

  const hex6 = parseColor("#ff00aa");
  const hex3 = parseColor("#f0a");
  const rgbArr = parseColor([10, 20, 30]);
  const rgbStr = parseColor("rgb(10, 20, 30)");
  const rgbObj = parseColor({ r: 10, g: 20, b: 30 });
  const clamp = parseColor([300, -10, 100]);

  const parserOk =
    hex6[0] === 255 &&
    hex6[1] === 0 &&
    hex6[2] === 170 &&
    hex3[0] === 255 &&
    hex3[1] === 0 &&
    hex3[2] === 170 &&
    rgbArr[0] === 10 &&
    rgbArr[1] === 20 &&
    rgbArr[2] === 30 &&
    rgbStr[0] === 10 &&
    rgbStr[1] === 20 &&
    rgbStr[2] === 30 &&
    rgbObj[0] === 10 &&
    rgbObj[1] === 20 &&
    rgbObj[2] === 30 &&
    clamp[0] === 255 &&
    clamp[1] === 0 &&
    clamp[2] === 100;

  record("parseColor supports hex, rgb array, rgb string, object, and clamping", parserOk);

  const custom = buildCustomTheme({
    name: "Cyberpunk",
    base: "dark-ember",
    colors: {
      model: "#ff007f",
      context: "#00ffff",
    },
  });

  const ember = THEMES["dark-ember"].colors;
  const customOk =
    custom.name === "Cyberpunk" &&
    custom.colors.model[0] === 255 &&
    custom.colors.model[1] === 0 &&
    custom.colors.model[2] === 127 &&
    custom.colors.context[0] === 0 &&
    custom.colors.context[1] === 255 &&
    custom.colors.context[2] === 255 &&
    custom.colors.git.join() === ember.git.join() &&
    custom.colors.caution.join() === ember.caution.join();

  record("buildCustomTheme overrides colors and inherits the rest from its base", customOk);

  checkThemeQuality();
  checkCaps();

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-custom-theme-"));
  const env = { ...process.env, AGY_POWERLINE_HOME: sandbox };

  try {
    const configPath = path.join(sandbox, "statusline.config.json");
    const customConfig = {
      theme: "custom",
      customTheme: {
        name: "Neon",
        colors: {
          model: "#ff007f",
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(customConfig), "utf8");

    const render = runCli(["render", "--demo", "--color", "truecolor"], { env });
    record(
      "render --demo outputs custom theme colors",
      render.code === 0 && render.stdout.includes("255;0;127"),
      `exit ${render.code}`
    );

    const setCustom = runCli(["theme", "custom"], { env });
    record(
      "theme custom switches to custom theme",
      setCustom.code === 0 && /Theme set to.*Custom/i.test(setCustom.stdout),
      `exit ${setCustom.code}`
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

module.exports = { run };
