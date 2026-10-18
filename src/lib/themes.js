"use strict";

const { parseColor, parseGradientStops, luminance } = require("./colors");

// Every theme targets one terminal background:
//   dark-*        bright colors, dark pill text, for dark terminals
//   light-*       deep colors, white pill text, for light terminals
//   colorblind-*  Okabe–Ito based; ok / caution / danger stay distinct for
//                 protanopia, deuteranopia and tritanopia
// Most dark-* and light-* colors come from VS Code's default themes (Dark+
// and Light+ syntax, git decorations, warning/error and terminal colors);
// nocturne, onyx, metro, cream and macchiato take their palettes from
// community themes (credited below). A few colors are adjusted where the
// checks below need it: darkened or lightened for contrast, and gitDirty
// moved toward orange so a dirty branch never looks like the caution state.
// Palettes are checked by tests/shared/themes.test.js: pill text and lines
// text reach WCAG AA (4.5:1), the ok / caution / danger states are clearly
// different from each other, and so are gitDirty and caution.
//
// Color roles:
//   text      pill text                  track     empty dots in lines meters
//   fiveHour  healthy state (ok)         caution   warning state
//   warn      danger / critical state    gitDirty  repo with uncommitted work
//   model, weekly, thirdParty, context, git, meta: widget colors

const hex = (value) => parseColor(value);

function theme(kind, name, description, colors) {
  const parsed = {};
  for (const [key, value] of Object.entries(colors)) {
    parsed[key] = hex(value);
  }
  return { kind, name, description, colors: parsed };
}

const DARK_TEXT = "#16161c";
const LIGHT_TEXT = "#ffffff";

const THEMES = {
  "dark-aurora": theme("dark", "Dark Aurora", "VS Code Dark+ colors (default)", {
    text: DARK_TEXT,
    track: "#4b4b4b",
    model: "#c586c0",
    fiveHour: "#73c991",
    weekly: "#9cdcfe",
    thirdParty: "#ce9178",
    context: "#569cd6",
    git: "#4ec9b0",
    gitDirty: "#e2c08d",
    meta: "#cccccc",
    caution: "#cca700",
    warn: "#f48771",
  }),

  "dark-ocean": theme("dark", "Dark Ocean", "Blues and teals from VS Code Dark+", {
    text: DARK_TEXT,
    track: "#4b4b4b",
    model: "#569cd6",
    fiveHour: "#4ec9b0",
    weekly: "#9cdcfe",
    thirdParty: "#4fc1ff",
    context: "#3794ff",
    git: "#29b8db",
    gitDirty: "#e2c08d",
    meta: "#9d9d9d",
    caution: "#cca700",
    warn: "#f48771",
  }),

  "dark-ember": theme("dark", "Dark Ember", "Warm oranges and golds from VS Code Dark+", {
    text: DARK_TEXT,
    track: "#4b4b4b",
    model: "#ce9178",
    fiveHour: "#b5cea8",
    weekly: "#dcdcaa",
    thirdParty: "#d7ba7d",
    context: "#9cdcfe",
    git: "#c586c0",
    gitDirty: "#e2c08d",
    meta: "#cccccc",
    caution: "#cca700",
    warn: "#f48771",
  }),

  "dark-forest": theme("dark", "Dark Forest", "Greens and sand from VS Code Dark+", {
    text: DARK_TEXT,
    track: "#4b4b4b",
    model: "#b5cea8",
    fiveHour: "#73c991",
    weekly: "#4ec9b0",
    thirdParty: "#d7ba7d",
    context: "#9cdcfe",
    git: "#81b88b",
    gitDirty: "#e2c08d",
    meta: "#cccccc",
    caution: "#cca700",
    warn: "#f48771",
  }),

  "dark-neon": theme("dark", "Dark Neon", "VS Code's bright terminal colors", {
    text: DARK_TEXT,
    track: "#4b4b4b",
    model: "#d670d6",
    fiveHour: "#23d18b",
    weekly: "#29b8db",
    thirdParty: "#ce9178",
    context: "#4b97ec",
    git: "#b180d7",
    gitDirty: "#e2c08d",
    meta: "#e5e5e5",
    caution: "#f5f543",
    warn: "#f36767",
  }),

  "dark-mono": theme("dark", "Dark Mono", "VS Code Dark Modern grays, color only for status", {
    text: DARK_TEXT,
    track: "#4b4b4b",
    model: "#d4d4d4",
    fiveHour: "#73c991",
    weekly: "#bbbbbb",
    thirdParty: "#b0b0b0",
    context: "#c8c8c8",
    git: "#cccccc",
    gitDirty: "#e2c08d",
    meta: "#9d9d9d",
    caution: "#cca700",
    warn: "#f48771",
  }),

  // Palette from Dracula (draculatheme.com, MIT).
  "dark-nocturne": theme("dark", "Dark Nocturne", "Vivid purple, pink, cyan and green", {
    text: DARK_TEXT,
    track: "#44475a",
    model: "#bd93f9",
    fiveHour: "#50fa7b",
    weekly: "#8be9fd",
    thirdParty: "#ffb86c",
    context: "#ff79c6",
    git: "#d6acff",
    gitDirty: "#ffb86c",
    meta: "#f8f8f2",
    caution: "#f1fa8c",
    warn: "#ff5555",
  }),

  // Palette from One Dark (Atom, MIT).
  "dark-onyx": theme("dark", "Dark Onyx", "Soft purple, blue and green on gray", {
    text: DARK_TEXT,
    track: "#4b5263",
    model: "#c678dd",
    fiveHour: "#98c379",
    weekly: "#56b6c2",
    thirdParty: "#d19a66",
    context: "#61afef",
    git: "#abb2bf",
    gitDirty: "#e88a50",
    meta: "#abb2bf",
    caution: "#e5c07b",
    warn: "#e1727b",
  }),

  // Palette from Tokyo Night (enkia/tokyo-night-vscode-theme, MIT).
  "dark-metro": theme("dark", "Dark Metro", "Night-city blues, violet and teal", {
    text: DARK_TEXT,
    track: "#414868",
    model: "#bb9af7",
    fiveHour: "#9ece6a",
    weekly: "#7dcfff",
    thirdParty: "#ff9e64",
    context: "#7aa2f7",
    git: "#73daca",
    gitDirty: "#ff8b52",
    meta: "#a9b1d6",
    caution: "#e0af68",
    warn: "#f7768e",
  }),

  // Palette from Catppuccin Macchiato (catppuccin.com, MIT).
  "dark-macchiato": theme("dark", "Dark Macchiato", "Pastel mauve, teal, peach and green", {
    text: DARK_TEXT,
    track: "#494d64",
    model: "#c6a0f6",
    fiveHour: "#a6da95",
    weekly: "#7dc4e4",
    thirdParty: "#f5a97f",
    context: "#8aadf4",
    git: "#8bd5ca",
    gitDirty: "#f0c6c6",
    meta: "#b8c0e0",
    caution: "#eed49f",
    warn: "#ed8796",
  }),

  "light-paper": theme("light", "Light Paper", "VS Code Light+ colors", {
    text: LIGHT_TEXT,
    track: "#c8c8c8",
    model: "#af00db",
    fiveHour: "#107c10",
    weekly: "#247790",
    thirdParty: "#795e26",
    context: "#0451a5",
    git: "#001080",
    gitDirty: "#b04a00",
    meta: "#3b3b3b",
    caution: "#8d6503",
    warn: "#cd3131",
  }),

  "light-sky": theme("light", "Light Sky", "Blues from VS Code Light+", {
    text: LIGHT_TEXT,
    track: "#c8c8c8",
    model: "#0451a5",
    fiveHour: "#097e52",
    weekly: "#247790",
    thirdParty: "#0070c1",
    context: "#005fb8",
    git: "#001080",
    gitDirty: "#b04a00",
    meta: "#3b3b3b",
    caution: "#8d6503",
    warn: "#cd3131",
  }),

  "light-sunset": theme("light", "Light Sunset", "Warm reds and browns from VS Code Light+", {
    text: LIGHT_TEXT,
    track: "#c8c8c8",
    model: "#811f3f",
    fiveHour: "#55780c",
    weekly: "#247790",
    thirdParty: "#795e26",
    context: "#0451a5",
    git: "#bc05bc",
    gitDirty: "#b04a00",
    meta: "#616161",
    caution: "#8d6503",
    warn: "#cd3131",
  }),

  // Palette from Catppuccin Latte (catppuccin.com, MIT).
  "light-cream": theme("light", "Light Cream", "Pastel mauve, teal and peach, deepened", {
    text: LIGHT_TEXT,
    track: "#bcc0cc",
    model: "#8839ef",
    fiveHour: "#317e23",
    weekly: "#117a80",
    thirdParty: "#bb4a0b",
    context: "#1d63ee",
    git: "#a3518d",
    gitDirty: "#bb4a0b",
    meta: "#4c4f69",
    caution: "#966010",
    warn: "#d20f39",
  }),

  "colorblind-dark": theme(
    "colorblind",
    "Color-blind Dark",
    "Color-blind safe, for dark terminals",
    {
      text: DARK_TEXT,
      track: "#4a4e5e",
      model: "#cc99ff",
      fiveHour: "#56b4e9",
      weekly: "#88ccee",
      thirdParty: "#e69f00",
      context: "#7fb2ff",
      git: "#b8a6ff",
      gitDirty: "#e69f00",
      meta: "#c8c8c8",
      caution: "#f0e442",
      warn: "#ff7a3d",
    }
  ),

  "colorblind-light": theme(
    "colorblind",
    "Color-blind Light",
    "Color-blind safe, for light terminals",
    {
      text: LIGHT_TEXT,
      track: "#c8ccd4",
      model: "#5e3ea8",
      fiveHour: "#005a8c",
      weekly: "#1f6680",
      thirdParty: "#8a5200",
      context: "#2856a8",
      git: "#4e4596",
      gitDirty: "#a64800",
      meta: "#4b5466",
      caution: "#876900",
      warn: "#87002d",
    }
  ),

  custom: theme("custom", "Custom", "Your own colors from statusline.config.json", {
    text: DARK_TEXT,
    track: "#4b4b4b",
    model: "#c586c0",
    fiveHour: "#73c991",
    weekly: "#9cdcfe",
    thirdParty: "#ce9178",
    context: "#569cd6",
    git: "#4ec9b0",
    gitDirty: "#e2c08d",
    meta: "#cccccc",
    caution: "#cca700",
    warn: "#f48771",
  }),
};

const DEFAULT_THEME = "dark-aurora";

const THEME_KINDS = [
  { id: "dark", label: "Dark terminals" },
  { id: "light", label: "Light terminals" },
  { id: "colorblind", label: "Color-blind safe" },
  { id: "custom", label: "Custom" },
];

const THEME_ORDER = [
  "dark-aurora",
  "dark-ocean",
  "dark-ember",
  "dark-forest",
  "dark-neon",
  "dark-mono",
  "dark-nocturne",
  "dark-onyx",
  "dark-metro",
  "dark-macchiato",
  "light-paper",
  "light-sky",
  "light-sunset",
  "light-cream",
  "colorblind-dark",
  "colorblind-light",
  "custom",
];

// Short names shown in `theme --list`.
const THEME_ALIASES = {
  dark: "dark-aurora",
  light: "light-paper",
  colorblind: "colorblind-dark",
};

const COLOR_KEYS = [
  "text",
  "track",
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
  // Optional: pins the background behind pill caps instead of using the
  // terminal's own background.
  "terminal",
];

function canonicalThemeId(themeId) {
  const key = String(themeId ?? "")
    .trim()
    .toLowerCase();
  return THEME_ALIASES[key] ?? key;
}

function buildCustomTheme(customThemeConfig = {}) {
  const requestedBase = canonicalThemeId(customThemeConfig.base);
  const baseId =
    THEMES[requestedBase] && requestedBase !== "custom" ? requestedBase : DEFAULT_THEME;
  const baseColors = THEMES[baseId].colors;

  const rawColors =
    customThemeConfig.colors && typeof customThemeConfig.colors === "object"
      ? customThemeConfig.colors
      : {};

  const parsedColors = { ...baseColors };

  if (rawColors && typeof rawColors === "object") {
    for (const key of COLOR_KEYS) {
      if (rawColors[key] !== undefined) {
        parsedColors[key] = parseColor(rawColors[key], baseColors[key]);
      }
    }
  }

  return {
    kind: "custom",
    name: customThemeConfig.name || "Custom",
    description: customThemeConfig.description || "User-defined color palette",
    colors: parsedColors,
  };
}

function resolveThemeId(themeId) {
  const id = canonicalThemeId(themeId);
  return THEMES[id] ? id : DEFAULT_THEME;
}

function resolveTheme(themeId, customThemeConfig) {
  const id = resolveThemeId(themeId);
  if (id === "custom") {
    return buildCustomTheme(customThemeConfig);
  }
  return THEMES[id];
}

function themeColors(themeId, customThemeConfig) {
  return resolveTheme(themeId, customThemeConfig).colors;
}

// Row gradients. Pill text and Lines text are adjusted per color to stay
// readable, so a preset works on dark and light terminals alike.
const GRADIENTS = {
  aurora: { name: "Aurora", stops: ["#00c9a7", "#4facfe", "#a18cd1"] },
  sunset: { name: "Sunset", stops: ["#ffd166", "#ff8c61", "#e8457c"] },
  ocean: { name: "Ocean", stops: ["#2af598", "#009efd"] },
  forest: { name: "Forest", stops: ["#d4fc79", "#3fb68b", "#1d7a5f"] },
  neon: { name: "Neon", stops: ["#f72585", "#7209b7", "#4cc9f0"] },
  candy: { name: "Candy", stops: ["#ff9a9e", "#fbc2eb", "#a1c4fd"] },
  rainbow: { name: "Rainbow", stops: ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"] },
  mono: { name: "Mono", stops: ["#e0e0e0", "#6e6e6e"] },
};

const GRADIENT_ORDER = Object.keys(GRADIENTS);

const toHex = (rgb) => `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;

// A preset name, or hex stops written as "#rrggbb-#rrggbb"; null when the
// value is anything else (or "off").
function normalizeGradient(value) {
  if (typeof value !== "string") {
    return null;
  }
  const key = value.trim().toLowerCase();
  if (GRADIENTS[key]) {
    return key;
  }
  const stops = parseGradientStops(key);
  return stops ? stops.map(toHex).join("-") : null;
}

function gradientStops(value) {
  const key = normalizeGradient(value);
  if (!key) {
    return null;
  }
  return GRADIENTS[key]
    ? GRADIENTS[key].stops.map((stop) => parseColor(stop))
    : parseGradientStops(key);
}

// Typical terminal backgrounds, a little toward the hard side. Themes for
// light terminals have light pill text on deep colors; dark themes the reverse.
const TERMINAL_BACKGROUNDS = { dark: [40, 42, 54], light: [245, 245, 240] };

function terminalBackground(colors) {
  return luminance(colors?.text ?? [0, 0, 0]) > 0.5
    ? TERMINAL_BACKGROUNDS.light
    : TERMINAL_BACKGROUNDS.dark;
}

module.exports = {
  THEMES,
  THEME_ORDER,
  THEME_KINDS,
  THEME_ALIASES,
  DEFAULT_THEME,
  COLOR_KEYS,
  theme,
  canonicalThemeId,
  buildCustomTheme,
  resolveThemeId,
  resolveTheme,
  themeColors,
  GRADIENTS,
  GRADIENT_ORDER,
  normalizeGradient,
  gradientStops,
  TERMINAL_BACKGROUNDS,
  terminalBackground,
};
