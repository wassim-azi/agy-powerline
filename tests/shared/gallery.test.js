"use strict";

// The theme gallery is the home page of agy-powerline.com, in English and in
// French. What every page of the site must do (CSP, no outside loads, sitemap,
// links that resolve) is checked in tests/shared/site.test.js.

const { record } = require("../helpers");
const { THEME_ORDER } = require("../../src/lib/themes");
const { buildGalleryHtml } = require("../../scripts/gallery/build");
const themeToggle = require("../../scripts/site/theme-toggle");
const { ansiToHtml } = require("../../scripts/site/ansi");
const { renderStatusline, sampleData, defaultConfig } = require("../../src/lib/shared");
const { FLEX_GAP_START, FLEX_GAP_END } = require("../../src/lib/layouts/pills");

const REPO_URL = "https://github.com/wassim-azi/agy-powerline";
const SITE_URL = "https://agy-powerline.com/";

async function run() {
  const html = buildGalleryHtml();
  const fr = buildGalleryHtml({ lang: "fr" });

  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let graph;
  try {
    graph = (ld && JSON.parse(ld[1])["@graph"]) || [];
  } catch {
    graph = [];
  }
  const app = graph.find((node) => node["@type"] === "SoftwareApplication");
  record(
    "the gallery describes the site and the app in JSON-LD",
    graph.some((node) => node["@type"] === "WebSite" && node.url === SITE_URL) &&
      Boolean(app) &&
      app.url === SITE_URL &&
      /agy statusline/.test(app.description) &&
      /^\d+\.\d+\.\d+/.test(app.softwareVersion)
  );
  record(
    'the gallery title and heading say "agy statusline", the phrase people search for',
    /<title>[^<]*agy statusline[^<]*<\/title>/.test(html) &&
      /<h1>[^\n]*<code>agy<\/code> statusline/.test(html)
  );

  // "custom" has no colors of its own, so the gallery leaves it out.
  const missing = THEME_ORDER.filter(
    (id) => id !== "custom" && !(html.includes(`id="${id}"`) && fr.includes(`id="${id}"`))
  );
  record(
    "the gallery shows every built-in theme, in both languages",
    missing.length === 0,
    missing.join(", ")
  );

  record(
    "the gallery has the shared header and footer, with Themes as the current page",
    /<header class="site-header">/.test(html) &&
      /<a class="nav-link" href="\/" aria-current="page">Themes<\/a>/.test(html) &&
      /<a class="nav-link" href="\/configure\/">Configurator<\/a>/.test(html) &&
      html.includes(`href="${REPO_URL}"`) &&
      /<footer class="site-footer">/.test(html)
  );

  record(
    "the gallery links to the configurator from the hero and from every theme card",
    html.includes('href="/configure/"') &&
      (html.match(/href="\/configure\/#/g) || []).length === THEME_ORDER.length - 1
  );

  // Previews mark the gaps between widget groups so the page can stretch them
  // to its own width; a bar rendered for a terminal never has the markers.
  const data = { ...sampleData(), terminal_width: 96 };
  const plain = renderStatusline(data, defaultConfig(), { color: "truecolor" });
  const marked = renderStatusline(data, defaultConfig(), { color: "truecolor", flexGaps: true });
  record(
    "only previews mark the gaps between widget groups, and the bar is otherwise the same",
    !plain.includes(FLEX_GAP_START) &&
      marked.includes(FLEX_GAP_START) &&
      marked.split(FLEX_GAP_START).join("").split(FLEX_GAP_END).join("") === plain
  );

  const preview = ansiToHtml(marked);
  record(
    "a preview's gaps stretch to the box and its emoji keep the columns the renderer counted",
    /<div class="ln flex fit" style="--cols:\d+">/.test(preview) &&
      /<span class="r gap"[^>]*> <\/span>/.test(preview) &&
      /<span class="wc" style="width:2ch">/.test(preview)
  );

  const hero = (html.match(/<figure class="term-frame hero-term"[\s\S]*?<\/figure>/) || [""])[0];
  record(
    "the home page's bars have a blank line between rows and gaps that stretch",
    /class="ln flex fit"/.test(hero) &&
      /<div class="ln fit" style="--cols:\d+"><span class="r"[^>]*> <\/span><\/div>/.test(hero)
  );

  record(
    "the French gallery is in French and links back to the English one",
    /^<!doctype html>\s*<html lang="fr">/i.test(fr) &&
      /<title>[^<]*agy[^<]*<\/title>/.test(fr) &&
      fr.includes(`<link rel="canonical" href="${SITE_URL}fr/" />`) &&
      fr.includes(`hreflang="en" href="${SITE_URL}"`) &&
      !/\{\{\w+\}\}/.test(fr)
  );

  // Theme toggle unit test in Node
  const storeMap = new Map();
  const fakeStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k),
  };
  const attrs = new Map();
  const buttons = ["system", "light", "dark"].map((val) => {
    const bAttrs = new Map([
      ["data-theme-value", val],
      ["aria-pressed", "false"],
    ]);
    return {
      getAttribute: (k) => bAttrs.get(k) ?? null,
      setAttribute: (k, v) => bAttrs.set(k, String(v)),
    };
  });
  const fakeDoc = {
    documentElement: {
      getAttribute: (k) => attrs.get(k) ?? null,
      setAttribute: (k, v) => attrs.set(k, String(v)),
      removeAttribute: (k) => attrs.delete(k),
    },
    querySelectorAll: () => buttons,
  };

  const initialTheme = themeToggle.readStoredTheme(fakeStorage);
  themeToggle.applyTheme("dark", fakeDoc, fakeStorage);
  const afterDark =
    themeToggle.readStoredTheme(fakeStorage) === "dark" &&
    fakeDoc.documentElement.getAttribute("data-theme") === "dark" &&
    buttons[2].getAttribute("aria-pressed") === "true" &&
    buttons[0].getAttribute("aria-pressed") === "false";

  themeToggle.applyTheme("light", fakeDoc, fakeStorage);
  const afterLight =
    themeToggle.readStoredTheme(fakeStorage) === "light" &&
    fakeDoc.documentElement.getAttribute("data-theme") === "light" &&
    buttons[1].getAttribute("aria-pressed") === "true";

  themeToggle.applyTheme("system", fakeDoc, fakeStorage);
  const afterSystem =
    themeToggle.readStoredTheme(fakeStorage) === "system" &&
    fakeDoc.documentElement.getAttribute("data-theme") === null &&
    buttons[0].getAttribute("aria-pressed") === "true";

  record(
    "the page theme toggle reads, stores and applies system, light and dark themes",
    initialTheme === "system" && afterDark && afterLight && afterSystem
  );
}

module.exports = { run };
