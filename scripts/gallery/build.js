// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Builds the site's home page (/ and /fr/) and the theme gallery (/themes/):
// every bar on them is rendered by the real statusline code. The home page
// shows the bar in an agy window with a few themes and the three layouts to
// switch between; the gallery shows every theme on dark and light terminals,
// with a color-blindness simulation. The whole site (scripts/site/build.js)
// uses both; on its own this writes the gallery for a quick look.
// Usage: npm run gallery [-- <out.html>]   (default: ./gallery.html)
const fs = require("fs");
const path = require("path");

const repo = path.join(__dirname, "..", "..");

const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const { THEMES, THEME_ORDER } = require(path.join(repo, "src/lib/themes"));
const { WIDGET_CATALOG } = require(path.join(repo, "src/lib/catalog"));
const { version } = require(path.join(repo, "package.json"));
const { ansiToHtml } = require("../site/ansi");
const { styleClasses } = require("../site/style-classes");
const { decodePng, resizePng, encodePng } = require("../site/png");
const {
  injectSiteChrome,
  finishPage,
  commandBox,
  icon,
  REPO_URL,
  NPM_URL,
  SITE_URL,
  X_URL,
  LINKEDIN_URL,
  AUTHOR_URL,
  absoluteUrl,
  cardPath,
} = require("../site/layout");
const { breadcrumbData } = require("../site/doc-page");
const { HOME_TEXT } = require("../site/home-text");
const { encodeConfig } = require("../configurator/page");

const FAKE_DIR = "/home/you/projects/agy-powerline";
const TERM = { dark: [29, 31, 39], light: [251, 251, 248] };
// Screenshots from assets/screenshots/, served under descriptive names.
const SCREENSHOTS = ["windows", "pills-dark", "lines-light", "classic-dark"];
const screenshotUrl = (name, width) => `/img/agy-statusline-${name}${width ? `-${width}` : ""}.png`;
// Smaller copies of each screenshot for srcset, so a browser fetches one near
// the size it shows. A copy is kept only when it is also lighter than the
// original: shrunk text can compress worse than the sharp original.
const SHOT_WIDTHS = [640, 1000, 1600];
const shotCopies = new Map();

// [{ url, width, png }] from the smallest copy to the original; png is the
// copy's bytes (null for the original).
function screenshotCopies(name) {
  if (!shotCopies.has(name)) {
    const original = fs.readFileSync(path.join(repo, "assets", "screenshots", `${name}.png`));
    const image = decodePng(original);
    const copies = SHOT_WIDTHS.filter((width) => width < image.width)
      .map((width) => ({
        url: screenshotUrl(name, width),
        width,
        png: encodePng(resizePng(image, width)),
      }))
      .filter((copy) => copy.png.length < original.length);
    copies.push({ url: screenshotUrl(name), width: image.width, png: null });
    shotCopies.set(name, copies);
  }
  return shotCopies.get(name);
}

// src, srcset and sizes for a screenshot shown at most maxWidth CSS pixels
// wide; src is the copy closest above that width, for browsers without srcset.
function screenshotAttrs(name, maxWidth) {
  const copies = screenshotCopies(name);
  const src = copies.find((copy) => copy.width >= maxWidth) || copies[copies.length - 1];
  const srcset = copies.map((copy) => `${copy.url} ${copy.width}w`).join(", ");
  return `src="${src.url}" srcset="${srcset}" sizes="(max-width: ${maxWidth}px) 100vw, ${maxWidth}px"`;
}
// The themes the home page's demo switches between.
const DEMO_THEMES = [
  "dark-aurora",
  "dark-nord",
  "dark-rose-pine",
  "light-paper",
  "light-tokyo-night",
  "colorblind-dark",
];
const LAYOUTS = ["pills", "lines", "classic"];

// The page's bars: a blank line between rows, and gaps that stretch to the box.
const PREVIEW = { config: { rowGap: true }, render: { color: "truecolor", flexGaps: true } };

// 80 columns, the width of a default terminal window.
function payload(width = 80) {
  const data = sampleData();
  data.cwd = FAKE_DIR;
  data.workspace = { current_dir: FAKE_DIR, project_dir: FAKE_DIR };
  data.terminal_width = width;
  return data;
}

function withFiveHour(fraction) {
  const data = payload();
  data.quota = {
    ...data.quota,
    "gemini-5h": { ...data.quota["gemini-5h"], remaining_fraction: fraction },
  };
  return data;
}

// styles: the page's style-classes.js stylesheet, which takes the bar's colors.
function renderBar(data, config, styles) {
  return ansiToHtml(
    renderStatusline(data, { ...defaultConfig(), ...PREVIEW.config, ...config }, PREVIEW.render),
    { styles }
  );
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");

// --- Contrast numbers shown on each card -----------------------------------
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const KEYS = [
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

const hexOf = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const targetOf = (id) => (THEMES[id].kind === "light" || id.endsWith("-light") ? "light" : "dark");
const swatch = (id, styles) =>
  `<span class="swatch" aria-hidden="true">${["model", "git", "weekly"]
    .map((k) => `<i class="${styles.cls(`background:${hexOf(THEMES[id].colors[k])}`)}"></i>`)
    .join("")}</span>`;

// Width and height from a PNG's header, so images reserve their space.
function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const galleryThemes = () => THEME_ORDER.filter((id) => id !== "custom");
const counts = () => ({
  themes: galleryThemes().length,
  widgets: WIDGET_CATALOG.filter((w) => w.id !== "separator" && w.id !== "lineBreak").length,
});

function buildThemes(styles) {
  return galleryThemes().map((id) => {
    const t = THEMES[id];
    const target = targetOf(id);
    const status = [0.8, 0.22, 0.06]
      .map((f) =>
        renderBar(
          withFiveHour(f),
          { theme: id, layout: "pills", widgets: [{ id: "fiveHourBar" }] },
          styles
        )
      )
      .join("");
    return {
      id,
      name: t.name,
      kind: t.kind,
      description: t.description,
      target,
      pills: renderBar(payload(), { theme: id, layout: "pills" }, styles),
      lines: renderBar(payload(), { theme: id, layout: "lines" }, styles),
      classic: renderBar(payload(), { theme: id, layout: "classic" }, styles),
      status,
      configHash: encodeConfig({ ...defaultConfig(), theme: id }),
      states: ["fiveHour", "caution", "warn"].map((k) => hexOf(t.colors[k])),
      pillContrast: Math.min(...KEYS.map((k) => contrast(t.colors.text, t.colors[k]))),
      termContrast: Math.min(...KEYS.map((k) => contrast(t.colors[k], TERM[target]))),
    };
  });
}

const GALLERY_TEXT = {
  pillText: "Pill text",
  onTerminal: "On terminal",
  states: "OK · caution · danger",
  termDark: "dark terminal",
  termLight: "light terminal",
  quotaRow: "5h quota at 80% · 22% · 6% left",
  useTheme: "Use this theme →",
  copy: "Copy",
};

function card(t, styles) {
  const text = GALLERY_TEXT;
  return `
<article class="theme" data-kind="${t.kind}" data-target="${t.target}" id="${t.id}">
  <header class="theme-head">
    <div class="theme-name">
      <h2><a class="theme-anchor" href="#${t.id}">${esc(t.name)}</a></h2>
      <code class="theme-id">${t.id}</code>
    </div>
    <p class="theme-desc">${esc(t.description)}</p>
    <dl class="metrics">
      <div><dt>${text.pillText}</dt><dd>${t.pillContrast.toFixed(1)}:1</dd></div>
      <div><dt>${text.onTerminal}</dt><dd>${t.termContrast.toFixed(1)}:1</dd></div>
      <div class="states"><dt>${text.states}</dt><dd>${t.states
        .map((c) => `<span class="dot ${styles.cls(`background:${c}`)}" title="${c}"></span>`)
        .join("")}</dd></div>
    </dl>
  </header>
  <div class="term-frame" data-bg="${t.target}">
    <div class="term-titlebar">
      <div class="term-dots" aria-hidden="true">
        <span class="term-dot"></span>
        <span class="term-dot"></span>
        <span class="term-dot"></span>
      </div>
      <span class="term-title">${t.id} · <span class="term-bg-label">${t.target === "light" ? text.termLight : text.termDark}</span></span>
    </div>
    <div class="term" data-bg="${t.target}" tabindex="0">
      <div class="term-label">pills</div>
      <div class="screen">${t.pills}</div>
      <div class="term-label">lines</div>
      <div class="screen">${t.lines}</div>
      <div class="term-label">classic</div>
      <div class="screen">${t.classic}</div>
      <div class="term-label">${text.quotaRow}</div>
      <div class="screen">${t.status}</div>
    </div>
  </div>
  <footer class="theme-actions">
    ${commandBox(`npx agy-powerline theme ${t.id}`, { label: `Copy the command for ${t.name}` })}
    <a class="btn btn-secondary btn-sm" href="/configure/#${t.configHash}">${text.useTheme}</a>
  </footer>
</article>`;
}

// The site's structured data: the site (for the site name in search
// results), its author and the app. No rating: Google wants real reviews for
// software rich results, and invented ones break its rules.
function homeStructuredData(description) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        name: "agy-powerline",
        alternateName: ["agy powerline", "agy statusline", "agy-powerline.com"],
        url: SITE_URL,
        inLanguage: ["en", "fr"],
        publisher: { "@id": `${SITE_URL}#author` },
      },
      {
        "@type": "Person",
        "@id": `${SITE_URL}#author`,
        name: "Wassim AZI",
        url: AUTHOR_URL,
        sameAs: [AUTHOR_URL, X_URL, LINKEDIN_URL],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}#app`,
        name: "agy-powerline",
        description,
        url: SITE_URL,
        image: absoluteUrl(cardPath("")),
        screenshot: SCREENSHOTS.map((name) => absoluteUrl(screenshotUrl(name))),
        applicationCategory: "DeveloperApplication",
        applicationSubCategory: "Terminal statusline",
        operatingSystem: "Windows, macOS, Linux",
        softwareVersion: version,
        softwareRequirements: "Node.js 20+, Antigravity CLI (agy)",
        downloadUrl: NPM_URL,
        installUrl: `${SITE_URL}install/`,
        license: "https://opensource.org/licenses/MIT",
        isAccessibleForFree: true,
        author: { "@id": `${SITE_URL}#author` },
        sameAs: [REPO_URL, NPM_URL],
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
}

// --- Home page ----------------------------------------------------------------

function demoHtml(text, language, styles) {
  const n = counts();
  const [first] = DEMO_THEMES;
  // Every theme × layout pair waits in a <template>, outside the page's DOM
  // until a button asks for it.
  const variants = DEMO_THEMES.flatMap((id) =>
    LAYOUTS.map(
      (layout) =>
        `<template data-variant="${id}:${layout}" data-bg="${targetOf(id)}">${renderBar(payload(), { theme: id, layout, language }, styles)}</template>`
    )
  ).join("\n        ");
  const chips = DEMO_THEMES.map(
    (id) =>
      `<button type="button" class="chip" data-demo-theme="${id}" aria-pressed="${id === first}">${swatch(id, styles)}${esc(THEMES[id].name)}</button>`
  ).join("\n            ");
  const tabs = LAYOUTS.map(
    (layout) =>
      `<button type="button" class="tab" data-demo-layout="${layout}" aria-pressed="${layout === "pills"}">${layout[0].toUpperCase()}${layout.slice(1)}</button>`
  ).join("");
  return `<figure class="term-frame agy-window" id="demo" data-bg="dark">
          <figcaption class="sr-only">${text.heroBarCaption}</figcaption>
          <div class="term-titlebar">
            <div class="term-dots" aria-hidden="true">
              <span class="term-dot"></span>
              <span class="term-dot"></span>
              <span class="term-dot"></span>
            </div>
            <span class="term-title">agy · <span class="demo-label">${first} · pills</span></span>
          </div>
          <div class="term agy-body" data-bg="dark" aria-hidden="true">
            <p class="agy-msg"><span class="agy-ok">✓</span> Updated 3 files. All 128 tests pass.</p>
            <div class="agy-input"><span class="agy-prompt">&gt;</span> ${text.askAgy}<span class="caret"></span></div>
            <div class="screen" id="demoBar">${renderBar(payload(), { theme: first, layout: "pills", language }, styles)}</div>
          </div>
        </figure>
        <div class="demo-controls">
          <div class="chips" role="group" aria-label="${text.demoThemes}">
            ${chips}
            <a class="chip chip-more" href="/themes/">${text.allThemes(n.themes)}</a>
          </div>
          <div class="tabs" role="group" aria-label="${text.demoLayouts}">${tabs}</div>
        </div>
        ${variants}`;
}

function anatomyHtml(text, language, styles) {
  const colors = THEMES["dark-aurora"].colors;
  const items = text.anatomy
    .map(
      ([key, title, body], i) =>
        `<li class="legend-item"><span class="legend-num ${styles.cls(`--c:${key === "pace" ? "#ffffff" : hexOf(colors[key])}`)}">${i + 1}</span><div><h3>${title}</h3><p>${body}</p></div></li>`
    )
    .join("\n            ");
  return `<figure class="term-frame anatomy-bar" data-bg="dark">
            <figcaption class="sr-only">${text.anatomyLead}</figcaption>
            <div class="term-titlebar">
              <div class="term-dots" aria-hidden="true">
                <span class="term-dot"></span>
                <span class="term-dot"></span>
                <span class="term-dot"></span>
              </div>
              <span class="term-title">dark-aurora · default preset</span>
            </div>
            <div class="term" data-bg="dark"><div class="screen">${renderBar(payload(), { language }, styles)}</div></div>
          </figure>
          <ol class="legend">
            ${items}
          </ol>`;
}

function stepsHtml(text) {
  return text.steps
    .map(
      ([title, body, command], i) =>
        `<li class="tile step"><span class="step-num" aria-hidden="true">${i + 1}</span><h3>${title}</h3><p>${body}</p>${commandBox(command, { label: `${text.copyCommand} ${command}`, copy: text.copy })}</li>`
    )
    .join("\n            ");
}

// Each icon repeats its tile's heading, so it's decoration: a CSS background,
// which screen readers skip, rather than an image with an empty alt. The 56 px
// copy is for 1x screens, the full one for 2x.
const iconStyle = (art) =>
  `background-image:url("/img/icon-${art}-56.webp");background-image:image-set(url("/img/icon-${art}-56.webp") 1x,url("/img/icon-${art}.webp") 2x)`;

function featuresHtml(text, styles) {
  return text
    .features(counts())
    .map(
      ([art, title, body, href]) =>
        `<li><a class="tile feature" href="${href}"><span class="tile-icon ${styles.cls(iconStyle(art))}"></span><h3>${title}</h3><p>${body}</p></a></li>`
    )
    .join("\n            ");
}

function shotsHtml(text) {
  const tabs = SCREENSHOTS.map(
    (name, i) =>
      `<button type="button" class="tab" role="tab" id="tab-${name}" aria-controls="shot-${name}" aria-selected="${i === 0}"${i === 0 ? "" : ' tabindex="-1"'}>${text.shots[name][0]}</button>`
  ).join("");
  const panels = SCREENSHOTS.map((name, i) => {
    const { width, height } = pngSize(path.join(repo, "assets", "screenshots", `${name}.png`));
    return `<figure class="shot" role="tabpanel" id="shot-${name}" aria-labelledby="tab-${name}"${i === 0 ? "" : " hidden"}>
              <img ${screenshotAttrs(name, 1000)} alt="${attr(text.shots[name][1])}" width="${width}" height="${height}" loading="lazy" decoding="async" />
            </figure>`;
  }).join("\n            ");
  return `<div class="tabs shot-tabs" role="tablist" aria-label="${text.shotsTitle}">${tabs}</div>
          <div class="shot-stage">
            ${panels}
          </div>`;
}

function themeStripHtml(styles) {
  return galleryThemes()
    .map(
      (id) =>
        `<li><a class="chip" href="/themes/#${id}">${swatch(id, styles)}${esc(THEMES[id].name)}</a></li>`
    )
    .join("\n            ");
}

function faqHtml(text) {
  return text.faq
    .map(([q, a]) => `<details class="faq-item"><summary>${q}</summary><p>${a}</p></details>`)
    .join("\n          ");
}

function trustHtml(text) {
  return text.trust
    .map(([href, label]) => `<li><a class="chip" href="${href}">${label}</a></li>`)
    .join("\n            ");
}

// lang: "en" for /, "fr" for /fr/.
function buildHomeHtml({ lang = "en" } = {}) {
  const text = HOME_TEXT[lang];
  const n = counts();
  const styles = styleClasses();
  const sections = {
    INSTALL_CMD: commandBox("npx agy-powerline init", {
      label: text.copyInstall,
      copy: text.copy,
      large: true,
    }),
    // The bars speak the page's language.
    DEMO: demoHtml(text, lang, styles),
    ANATOMY: anatomyHtml(text, lang, styles),
    STEPS: stepsHtml(text),
    FEATURES: featuresHtml(text, styles),
    SHOTS: shotsHtml(text),
    THEME_STRIP: themeStripHtml(styles),
    TRUST: trustHtml(text),
    FAQ: faqHtml(text),
  };
  const values = {
    heroFacts: text.heroFacts.map((f) => `<li>${f}</li>`).join(""),
    themesTitle: text.themesTitle(n.themes),
    seeAllThemes: text.seeAllThemes(n.themes),
    arrow: icon("arrow", 18),
  };
  const template = fs.readFileSync(path.join(__dirname, "home.html"), "utf8");
  const filled = template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in values ? values[key] : typeof text[key] === "string" ? text[key] : match
  );
  const page = injectSiteChrome(filled, {
    title: text.title,
    description: text.description,
    currentPage: "home",
    pagePath: lang === "en" ? "" : `${lang}/`,
    lang,
    alternates: [
      { hreflang: "en", path: "" },
      { hreflang: "fr", path: "fr/" },
      { hreflang: "x-default", path: "" },
    ],
    imageAlt:
      lang === "fr"
        ? "agy-powerline : la statusline agy qui vous dit si votre quota va tenir, avec la barre par défaut"
        : "agy-powerline: the agy statusline that tells you if your quota will last, with the default bar",
    structuredData: lang === "en" ? homeStructuredData(text.description) : undefined,
    pageCss: styles.css(),
  });
  return finishPage(
    page.replace(/<!--([A-Z_]+)-->/g, (match, key) => (key in sections ? sections[key] : match))
  );
}

// --- Theme gallery --------------------------------------------------------------

const THEMES_PAGE = {
  path: "themes/",
  title: "agy statusline themes - 20 themes for Antigravity CLI",
  description:
    "Every agy-powerline theme for the agy statusline, drawn by the real code on dark and light terminals, with contrast figures and a color-blindness simulation.",
};

function themesStructuredData(themes) {
  return [
    breadcrumbData([
      { name: "agy-powerline", path: "" },
      { name: "Themes", path: THEMES_PAGE.path },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "agy statusline themes",
      description: THEMES_PAGE.description,
      url: absoluteUrl(THEMES_PAGE.path),
      isPartOf: { "@id": `${SITE_URL}#website` },
      about: { "@id": `${SITE_URL}#app` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: themes.length,
        itemListElement: themes.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.name,
          url: absoluteUrl(`${THEMES_PAGE.path}#${t.id}`),
        })),
      },
    },
  ];
}

// standalone: the page as one file, with the shared styles in it (npm run gallery).
function buildThemesHtml({ standalone = false } = {}) {
  const styles = styleClasses();
  const themes = buildThemes(styles);
  const cards = themes.map((t) => card(t, styles)).join("\n");
  const template = fs.readFileSync(path.join(__dirname, "themes.html"), "utf8");
  const title = THEMES_PAGE.title.replace("20", String(themes.length));
  const page = injectSiteChrome(template.replace(/\{\{count\}\}/g, String(themes.length)), {
    title,
    description: THEMES_PAGE.description,
    currentPage: "themes",
    pagePath: THEMES_PAGE.path,
    structuredData: themesStructuredData(themes),
    pageCss: styles.css(),
    standalone,
  });
  return finishPage(page.replace("<!--CARDS-->", () => cards));
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(repo, "gallery.html"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildThemesHtml({ standalone: true }), "utf8");
  console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

module.exports = {
  buildHomeHtml,
  buildThemesHtml,
  homeStructuredData,
  THEMES_PAGE,
  SCREENSHOTS,
  screenshotUrl,
  screenshotCopies,
  screenshotAttrs,
  pngSize,
};
