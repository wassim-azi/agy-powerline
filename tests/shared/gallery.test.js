// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// The home page (/ and /fr/) and the theme gallery (/themes/) of
// agy-powerline.com. What every page of the site must do (CSP, no outside
// loads, sitemap, share cards, links that resolve) is checked in
// tests/shared/site.test.js.

const { record } = require("../helpers");
const { THEME_ORDER } = require("../../src/lib/themes");
const { buildHomeHtml, buildThemesHtml } = require("../../scripts/gallery/build");
const themeToggle = require("../../scripts/site/theme-toggle");
const { ansiToHtml, ansiRuns } = require("../../scripts/site/ansi");
const { styleClasses } = require("../../scripts/site/style-classes");
const { stripTags } = require("../../scripts/site/markdown");
const { renderStatusline, sampleData, defaultConfig } = require("../../src/lib/shared");
const { FLEX_GAP_START, FLEX_GAP_END } = require("../../src/lib/layouts/pills");

const REPO_URL = "https://github.com/wassim-azi/agy-powerline";
const SITE_URL = "https://agy-powerline.com/";

function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return {};
      }
    }
  );
}

// Elements in the page's DOM; a <template>'s content isn't part of it.
const domSize = (html) =>
  (html.replace(/<template[\s\S]*?<\/template>/g, "").match(/<[a-z][a-z0-9-]*[\s>/]/g) || [])
    .length;

async function run() {
  const html = buildHomeHtml();
  const fr = buildHomeHtml({ lang: "fr" });
  const themes = buildThemesHtml();
  const galleryThemes = THEME_ORDER.filter((id) => id !== "custom");

  const graph = (jsonLd(html)[0] || {})["@graph"] || [];
  const app = graph.find((node) => node["@type"] === "SoftwareApplication");
  const author = graph.find((node) => node["@type"] === "Person");
  record(
    "the home page describes the site, its author and the app in JSON-LD",
    graph.some((node) => node["@type"] === "WebSite" && node.url === SITE_URL) &&
      Boolean(app) &&
      app.url === SITE_URL &&
      /agy statusline/.test(app.description) &&
      /^\d+\.\d+\.\d+/.test(app.softwareVersion) &&
      Boolean(author) &&
      ["https://x.com/wassim_azi", "https://www.linkedin.com/in/wassim-azi"].every((url) =>
        author.sameAs.some((link) => link === url)
      )
  );
  record(
    'the home page title and heading say "agy statusline", the phrase people search for',
    /<title>[^<]*agy statusline[^<]*<\/title>/.test(html) &&
      /<h1[^>]*>The agy statusline/.test(html)
  );

  record(
    "the home page leads with the install command and the configurator",
    /<div class="cmd cmd-lg"><code tabindex="0"><span class="prompt" aria-hidden="true">\$ <\/span>npx agy-powerline init<\/code>/.test(
      html
    ) && html.includes('href="/configure/"')
  );

  // The demo switches between themes and layouts kept in <template>s, so the
  // page's DOM stays small (Lighthouse warns above 1,400 elements).
  const variants = (html.match(/<template data-variant="[a-z-]+:(pills|lines|classic)"/g) || [])
    .length;
  const size = domSize(html);
  record(
    "the home page's demo has every theme and layout pair, and its DOM stays under 1,200 elements",
    variants > 0 &&
      variants % 3 === 0 &&
      (html.match(/data-demo-theme="/g) || []).length * 3 === variants &&
      size < 1200,
    `${variants} variants, ${size} elements`
  );

  record(
    "the home page has the shared header and footer, with no nav link marked current",
    /<header class="site-header">/.test(html) &&
      /<a class="nav-link" href="\/themes\/">Themes<\/a>/.test(html) &&
      /<a class="nav-link" href="\/configure\/">Configurator<\/a>/.test(html) &&
      !/class="nav-link"[^>]*aria-current/.test(html) &&
      html.includes(`href="${REPO_URL}"`) &&
      /<footer class="site-footer">/.test(html)
  );

  record(
    "the home page links to every theme on the gallery",
    galleryThemes.every((id) => html.includes(`href="/themes/#${id}"`))
  );

  // "custom" has no colors of its own, so the gallery leaves it out.
  const missing = galleryThemes.filter((id) => !themes.includes(`id="${id}"`));
  record("the gallery shows every built-in theme", missing.length === 0, missing.join(", "));

  const collection = jsonLd(themes).find((d) => d["@type"] === "CollectionPage");
  record(
    "the gallery is a CollectionPage of the themes, with Themes as the current page",
    Boolean(collection) &&
      collection.mainEntity.numberOfItems === galleryThemes.length &&
      /<a class="nav-link" href="\/themes\/" aria-current="page">Themes<\/a>/.test(themes) &&
      themes.includes(`<link rel="canonical" href="${SITE_URL}themes/" />`) &&
      new RegExp(`<title>[^<]*${galleryThemes.length} themes[^<]*</title>`).test(themes)
  );

  record(
    "the gallery links every theme card to the configurator",
    (themes.match(/href="\/configure\/#/g) || []).length === galleryThemes.length
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

  // With a page stylesheet, each style becomes a class: the same bar, cell for
  // cell, as with style attributes. Neighboring runs that look the same are
  // one span, and the text is the bar's text.
  const styles = styleClasses();
  const classed = ansiToHtml(marked, { styles });
  const rules = new Map(
    [...styles.css().matchAll(/^\.(k\w+)\{(.*)\}$/gm)].map((m) => [m[1], m[2]])
  );
  const canonical = (markup) =>
    markup.replace(/<(div|span)([^>]*)>/g, (_m, tag, attrs) => {
      const cls = ((attrs.match(/class="([^"]*)"/) || [])[1] || "").split(" ");
      const own = cls.filter((c) => !rules.has(c));
      const style =
        (attrs.match(/style="([^"]*)"/) || [])[1] ||
        cls
          .filter((c) => rules.has(c))
          .map((c) => rules.get(c))
          .join(";");
      return `<${tag} ${own.join(" ")}|${/aria-hidden/.test(attrs)}|${style}>`;
    });
  const shown = stripTags(classed)
    .replace(/&nbsp;/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  const runs = ansiRuns(marked).flat();
  const runText = runs.map((r) => (r.glyph ? "" : r.gap ? " " : r.text)).join("");
  const spans = (classed.match(/<span class="r[ "]/g) || []).length;
  record(
    "a bar drawn with classes matches its style attributes, with same-looking runs merged",
    !/\sstyle="/.test(classed) &&
      canonical(classed) === canonical(preview) &&
      shown === runText &&
      spans <= runs.filter((r) => !r.glyph).length,
    `${spans} spans for ${runs.filter((r) => !r.glyph).length} runs`
  );

  const demo = (html.match(/<div class="screen" id="demoBar">[\s\S]*?<\/figure>/) || [""])[0];
  record(
    "the home page's bars have a blank line between rows and gaps that stretch",
    /class="ln flex fit k\w+"/.test(demo) &&
      /<div class="ln fit k\w+"><span class="r[^"]*"[^>]*> <\/span><\/div>/.test(demo) &&
      !/\sstyle="/.test(html)
  );

  record(
    "the French home page is in French and links back to the English one",
    /^<!doctype html>\s*<html lang="fr">/i.test(fr) &&
      /<title>[^<]*agy[^<]*<\/title>/.test(fr) &&
      fr.includes(`<link rel="canonical" href="${SITE_URL}fr/" />`) &&
      fr.includes(`hreflang="en" href="${SITE_URL}"`) &&
      fr.includes("Copier") &&
      !/\{\{\w+\}\}|<!--[A-Z_]+-->/.test(fr)
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
