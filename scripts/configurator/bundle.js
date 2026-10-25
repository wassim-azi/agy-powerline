// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Builds the browser bundle for the web configurator: the renderer, catalog,
// widget options, and ANSI-to-HTML converter with zero external runtime dependencies.
// Shims fs, os, path, child_process, crypto, and process so the CommonJS codebase
// runs in standard browser environments and isolated sandboxes.

const fs = require("fs");
const path = require("path");
const { RUNTIME_FILES } = require("../../src/lib/paths");
const packageJson = require("../../package.json");

const LIB_DIR = path.join(__dirname, "..", "..", "src", "lib");
const SITE_DIR = path.join(__dirname, "..", "site");

const BROWSER_EXTRA_FILES = [
  ["mock-data.js", path.join(LIB_DIR, "mock-data.js")],
  ["catalog.js", path.join(LIB_DIR, "catalog.js")],
  ["widget-options.js", path.join(LIB_DIR, "widget-options.js")],
  ["config-check.js", path.join(LIB_DIR, "config-check.js")],
  ["ansi.js", path.join(SITE_DIR, "ansi.js")],
];

function toKey(rel) {
  return rel.split(path.sep).join("/");
}

function buildBrowserBundle() {
  const files = [
    ...RUNTIME_FILES.map((rel) => [toKey(rel), path.join(LIB_DIR, rel)]),
    ...BROWSER_EXTRA_FILES,
  ];

  const codeBlocks = files.map(([key, filePath]) => {
    const content = fs
      .readFileSync(filePath, "utf8")
      .replace(/^#!.*\n/, "")
      .replace(/\n+$/, "");
    return `__files[${JSON.stringify(key)}] = function (module, exports, require, __dirname, __filename) {\n${content}\n};`;
  });

  return `(function () {
"use strict";

// The os widget names the viewer's own system, as it would in their terminal.
function browserPlatform() {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const name = String((nav && nav.userAgentData && nav.userAgentData.platform) || (nav && nav.platform) || "").toLowerCase();
  if (name.startsWith("win")) {
    return "win32";
  }
  if (name.startsWith("mac")) {
    return "darwin";
  }
  return "linux";
}

const process = {
  env: {},
  platform: browserPlatform(),
  execPath: "/usr/bin/node",
  version: "v22.0.0",
  stdout: { columns: 80, rows: 24 },
  pid: 1,
  cwd: () => "/home/you/projects/agy-powerline",
};

function normalizeArray(parts, allowAboveRoot) {
  let up = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const last = parts[i];
    if (last === "." || last === "") {
      parts.splice(i, 1);
    } else if (last === "..") {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift("..");
    }
  }
  return parts;
}

const __shimPath = {
  sep: "/",
  isAbsolute: function (p) {
    return typeof p === "string" && p.charAt(0) === "/";
  },
  join: function (...args) {
    const paths = args.filter((p) => typeof p === "string" && p);
    if (!paths.length) return ".";
    const joined = paths.join("/");
    const isAbs = joined.charAt(0) === "/";
    const trailingSlash = joined.slice(-1) === "/";
    const segments = normalizeArray(joined.split("/"), !isAbs);
    let res = segments.join("/");
    if (!res && !isAbs) res = ".";
    if (res && trailingSlash && res.slice(-1) !== "/") res += "/";
    return (isAbs ? "/" : "") + res;
  },
  resolve: function (...args) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      const p = i >= 0 ? args[i] : "/";
      if (typeof p !== "string" || !p) continue;
      resolvedPath = p + "/" + resolvedPath;
      resolvedAbsolute = p.charAt(0) === "/";
    }
    const segments = normalizeArray(resolvedPath.split("/"), !resolvedAbsolute);
    let res = segments.join("/");
    return (resolvedAbsolute ? "/" : "") + res || "/";
  },
  dirname: function (p) {
    if (typeof p !== "string") p = "";
    if (p.length === 0) return ".";
    let code = p.charCodeAt(0);
    const hasRoot = code === 47;
    let end = -1;
    let matchedSlash = true;
    for (let i = p.length - 1; i >= 1; --i) {
      code = p.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
        matchedSlash = false;
      }
    }
    if (end === -1) return hasRoot ? "/" : ".";
    if (hasRoot && end === 1) return "//";
    return p.slice(0, end);
  },
  basename: function (p, ext) {
    if (typeof p !== "string") p = "";
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (ext !== undefined && typeof ext === "string" && ext.length <= p.length) {
      if (ext.length === p.length && ext === p) return "";
      let extIdx = ext.length - 1;
      let firstNonSlashEnd = -1;
      for (i = p.length - 1; i >= 0; --i) {
        const code = p.charCodeAt(i);
        if (code === 47) {
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else {
          if (firstNonSlashEnd === -1) {
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            if (code === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                end = i;
              }
            } else {
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }
      if (start === end) end = firstNonSlashEnd;
      else if (end === -1) end = p.length;
      return p.slice(start, end);
    }
    for (i = p.length - 1; i >= 0; --i) {
      if (p.charCodeAt(i) === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (matchedSlash) {
        matchedSlash = false;
        end = i + 1;
      }
    }
    if (end === -1) return "";
    return p.slice(start, end);
  },
  extname: function (p) {
    if (typeof p !== "string") return "";
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    for (let i = p.length - 1; i >= 0; --i) {
      const code = p.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46) {
        if (startDot === -1) startDot = i;
        else if (preDotState !== 1) preDotState = 1;
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (
      startDot === -1 ||
      end === -1 ||
      preDotState === 0 ||
      (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
    ) {
      return "";
    }
    return p.slice(startDot, end);
  },
};
__shimPath.posix = __shimPath;

const __shimFs = new Proxy(
  {},
  {
    get: (_, prop) => () => {
      const err = new Error("fs." + String(prop) + " is not available in browser");
      err.code = "ENOENT";
      throw err;
    },
  }
);

const __shimOs = {
  homedir: () => "/home/you",
  freemem: () => 8589934592,
  totalmem: () => 17179869184,
  userInfo: () => ({ username: "you" }),
  hostname: () => "devbox",
  tmpdir: () => "/tmp",
  platform: () => process.platform,
  release: () => "1.0.0",
  endianness: () => "LE",
};

const __shimChildProcess = new Proxy(
  {},
  {
    get: (_, prop) => () => {
      const err = new Error("child_process." + String(prop) + " is not available in browser");
      err.code = "ENOENT";
      throw err;
    },
  }
);

const __shimCrypto = {
  createHash: () => ({
    update: () => ({
      digest: () => "0000000000000000",
    }),
  }),
  randomUUID: () => "00000000-0000-0000-0000-000000000000",
};

const __shimSqlite = new Proxy(
  {},
  {
    get: () => {
      throw new Error("node:sqlite is not available in browser");
    },
  }
);

const __shims = {
  fs: __shimFs,
  os: __shimOs,
  path: __shimPath,
  child_process: __shimChildProcess,
  crypto: __shimCrypto,
  "node:sqlite": __shimSqlite,
  "package.json": ${JSON.stringify({ version: packageJson.version })},
};

const __files = {};
const __cache = {};

function __require(from, id) {
  if (id === "fs" || id === "os" || id === "path" || id === "child_process" || id === "crypto" || id === "node:sqlite") {
    return __shims[id];
  }
  if (id === "../../package.json" || id.endsWith("package.json")) {
    return __shims["package.json"];
  }

  let key;
  if (!id.startsWith(".")) {
    key = id;
  } else {
    key = __shimPath.posix.join(__shimPath.posix.dirname(from), id);
  }
  if (!key.endsWith(".js")) {
    key += ".js";
  }
  key = key.replace(/^\\.\\//, "");
  // ansi.js comes from scripts/site/ and requires the renderer by its repo path.
  key = key.replace(/^(\\.\\.\\/)+src\\/lib\\//, "");

  if (!__files[key]) {
    const err = new Error("Cannot find module '" + id + "' from '" + from + "'");
    err.code = "MODULE_NOT_FOUND";
    throw err;
  }

  if (!__cache[key]) {
    const mod = { exports: {} };
    __cache[key] = mod;
    const dir = __shimPath.posix.dirname("/" + key);
    const file = "/" + key;
    __files[key](mod, mod.exports, (next) => __require(key, next), dir, file);
  }
  return __cache[key].exports;
}

${codeBlocks.join("\n\n")}

const shared = __require("entry.js", "./shared");
const themes = __require("entry.js", "./themes");
const config = __require("entry.js", "./config");
const powerline = __require("entry.js", "./powerline");
const catalog = __require("entry.js", "./catalog");
const widgetStyle = __require("entry.js", "./widget-style");
const colors = __require("entry.js", "./colors");
const widgetOptions = __require("entry.js", "./widget-options");
const configCheck = __require("entry.js", "./config-check");
const ansi = __require("entry.js", "./ansi");

const AgyConfigurator = {
  renderStatusline: shared.renderStatusline,
  sampleData: shared.sampleData,
  defaultConfig: shared.defaultConfig,
  mergeConfig: shared.mergeConfig,
  CONFIG_SCHEMA_URL: config.CONFIG_SCHEMA_URL,
  THEMES: themes.THEMES,
  THEME_ORDER: themes.THEME_ORDER,
  THEME_KINDS: themes.THEME_KINDS,
  GRADIENTS: themes.GRADIENTS,
  GRADIENT_ORDER: themes.GRADIENT_ORDER,
  normalizeGradient: themes.normalizeGradient,
  PRESETS: config.PRESETS,
  PRESET_ORDER: config.PRESET_ORDER,
  applyPreset: config.applyPreset,
  LAYOUTS: shared.LAYOUTS,
  LAYOUT_ORDER: shared.LAYOUT_ORDER,
  STYLES: powerline.STYLES,
  STYLE_ORDER: powerline.STYLE_ORDER,
  detectStyle: powerline.detectStyle,
  applyStyle: powerline.applyStyle,
  WIDGET_CATALOG: catalog.WIDGET_CATALOG,
  WIDGET_TAGS: widgetStyle.WIDGET_TAGS,
  METER_STYLES: widgetStyle.METER_STYLES,
  METER_STYLE_IDS: widgetStyle.METER_STYLE_IDS,
  COLOR_MODES: colors.COLOR_MODES,
  setActiveDepth: colors.setActiveDepth,
  getActiveDepth: colors.getActiveDepth,
  editFields: widgetOptions.editFields,
  droppedSettings: configCheck.droppedSettings,
  ansiToHtml: ansi.ansiToHtml,
};

if (typeof globalThis !== "undefined") {
  globalThis.AgyConfigurator = AgyConfigurator;
}
if (typeof window !== "undefined") {
  window.AgyConfigurator = AgyConfigurator;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = AgyConfigurator;
}
})();
`;
}

module.exports = {
  buildBrowserBundle,
};
