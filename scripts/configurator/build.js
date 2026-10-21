"use strict";

// Builds the standalone web configurator HTML page for GitHub Pages.
// Inlines the browser bundle, page logic and styles so the page has zero external
// runtime requests and complies with the strict Content Security Policy.
// Usage: node scripts/configurator/build.js [output.html]

const fs = require("fs");
const path = require("path");
const { buildBrowserBundle } = require("./bundle");
const { injectSiteChrome } = require("../site/layout");
const {
  THEMES,
  THEME_ORDER,
  THEME_KINDS,
  GRADIENTS,
  GRADIENT_ORDER,
} = require("../../src/lib/themes");
const { WIDGET_CATALOG } = require("../../src/lib/catalog");
const { WIDGET_TAGS } = require("../../src/lib/widget-style");
const { PRESETS, PRESET_ORDER } = require("../../src/lib/config");
const { STYLES, STYLE_ORDER } = require("../../src/lib/powerline");

const repo = path.join(__dirname, "..", "..");
const defaultOut = path.join(repo, "_site", "configure", "index.html");
const out = path.resolve(process.argv[2] || defaultOut);

function buildPaletteItems() {
  return WIDGET_CATALOG.map((item) => {
    const tag = WIDGET_TAGS[item.id] || { icon: "•", label: item.label };
    return (
      `<button type="button" class="btn-palette-item" data-id="${item.id}" title="${item.summary || item.label}">` +
      `<span class="palette-icon">${tag.icon || ""}</span>` +
      `<span class="palette-name">${item.label}</span>` +
      `</button>`
    );
  }).join("\n");
}

function buildThemeOptions() {
  return THEME_KINDS.map((kind) => {
    const list = THEME_ORDER.filter((id) => THEMES[id].kind === kind.id);
    if (!list.length) return "";
    const opts = list.map((id) => `<option value="${id}">${THEMES[id].name}</option>`).join("");
    return `<optgroup label="${kind.label}">${opts}</optgroup>`;
  }).join("\n");
}

function buildPresetOptions() {
  return [
    '<option value="">(Select a preset to apply)</option>',
    ...PRESET_ORDER.map((id) => `<option value="${id}">${PRESETS[id].name}</option>`),
  ].join("\n");
}

function buildCapOptions() {
  return STYLE_ORDER.map((id) => `<option value="${id}">${STYLES[id].name}</option>`).join("\n");
}

function buildGradientOptions() {
  return [
    '<option value="off">Off (theme colors)</option>',
    ...GRADIENT_ORDER.map((id) => `<option value="${id}">${GRADIENTS[id].name}</option>`),
    '<option value="custom">Custom gradient</option>',
  ].join("\n");
}

function buildConfiguratorHtml() {
  const templatePath = path.join(__dirname, "template.html");
  const pageLogicPath = path.join(__dirname, "page.js");

  const rawTemplate = fs.readFileSync(templatePath, "utf8");
  const template = injectSiteChrome(rawTemplate, {
    title: "Build your agy statusline in the browser · agy-powerline",
    description:
      "Build your agy statusline in the browser: pick widgets, a theme and a layout with a live preview, then download the config or import it with npx agy-powerline.",
    currentPage: "configurator",
    rootPrefix: "../",
    pagePath: "configure/",
  });
  const bundleCode = buildBrowserBundle();
  const pageLogicCode = fs.readFileSync(pageLogicPath, "utf8");

  return template
    .replace("<!--PALETTE_ITEMS-->", buildPaletteItems())
    .replace("<!--THEME_OPTIONS-->", buildThemeOptions())
    .replace("<!--PRESET_OPTIONS-->", buildPresetOptions())
    .replace("<!--CAP_OPTIONS-->", buildCapOptions())
    .replace("<!--GRADIENT_OPTIONS-->", buildGradientOptions())
    .replace("/* BUNDLE_PLACEHOLDER */", bundleCode)
    .replace("/* PAGE_LOGIC_PLACEHOLDER */", pageLogicCode);
}

function buildConfigurator(dest = out) {
  const html = buildConfiguratorHtml();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html, "utf8");
  const sizeKb = (fs.statSync(dest).size / 1024).toFixed(0);
  console.log(`wrote ${dest} (${sizeKb} KB)`);
  return dest;
}

if (require.main === module) {
  buildConfigurator();
}

module.exports = {
  buildConfigurator,
  buildConfiguratorHtml,
  buildPaletteItems,
  buildThemeOptions,
  buildPresetOptions,
  buildCapOptions,
  buildGradientOptions,
};
