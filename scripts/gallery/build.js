"use strict";

// Builds the theme gallery, the site's home page: every theme rendered by the
// real statusline code, on dark and light terminals, with a color-blindness
// simulation toggle. The whole site (scripts/site/build.js) uses it for / and
// /fr/; on its own it writes one English page for a quick look.
// Usage: npm run gallery [-- <out.html>]   (default: ./gallery.html)
const fs = require("fs");
const path = require("path");

const repo = path.join(__dirname, "..", "..");

const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const { THEMES, THEME_ORDER } = require(path.join(repo, "src/lib/themes"));
const { version } = require(path.join(repo, "package.json"));
const { ansiToHtml } = require("../site/ansi");
const { injectSiteChrome, REPO_URL, NPM_URL, SITE_URL, OG_IMAGE } = require("../site/layout");
const { HOME_TEXT } = require("../site/home-text");
const { encodeConfig } = require("../configurator/page");

const FAKE_DIR = "/home/you/projects/agy-powerline";
const TERM = { dark: [29, 31, 39], light: [251, 251, 248] };
// Screenshots from assets/screenshots/, served under descriptive names.
const SCREENSHOTS = ["windows", "pills-dark", "lines-light", "classic-dark"];
const screenshotUrl = (name) => `/img/agy-statusline-${name}.png`;

// The page's bars: a blank line between rows, and gaps that stretch to the box.
const PREVIEW = { config: { rowGap: true }, render: { color: "truecolor", flexGaps: true } };

function payload(overrides = {}) {
  const data = sampleData();
  data.cwd = FAKE_DIR;
  data.workspace = { current_dir: FAKE_DIR, project_dir: FAKE_DIR };
  data.terminal_width = 96;
  return { ...data, ...overrides };
}

function withFiveHour(fraction) {
  const data = payload();
  data.quota = {
    ...data.quota,
    "gemini-5h": { ...data.quota["gemini-5h"], remaining_fraction: fraction },
  };
  return data;
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

// Width and height from a PNG's header, so images reserve their space.
function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function buildThemes() {
  return THEME_ORDER.filter((id) => id !== "custom").map((id) => {
    const t = THEMES[id];
    const target = t.kind === "light" || id.endsWith("-light") ? "light" : "dark";
    const render = (data, config) =>
      ansiToHtml(
        renderStatusline(
          data,
          { ...defaultConfig(), ...PREVIEW.config, theme: id, ...config },
          PREVIEW.render
        )
      );
    const status = [0.8, 0.22, 0.06]
      .map((f) => render(withFiveHour(f), { layout: "pills", widgets: [{ id: "fiveHourBar" }] }))
      .join("");
    return {
      id,
      name: t.name,
      kind: t.kind,
      description: t.description,
      target,
      pills: render(payload(), { layout: "pills" }),
      lines: render(payload(), { layout: "lines" }),
      classic: render(payload(), { layout: "classic" }),
      status,
      configHash: encodeConfig({ ...defaultConfig(), theme: id }),
      states: ["fiveHour", "caution", "warn"].map((k) => hexOf(t.colors[k])),
      pillContrast: Math.min(...KEYS.map((k) => contrast(t.colors.text, t.colors[k]))),
      termContrast: Math.min(...KEYS.map((k) => contrast(t.colors[k], TERM[target]))),
    };
  });
}

function card(t, text) {
  return `
<article class="theme" data-kind="${t.kind}" data-target="${t.target}" id="${t.id}">
  <header class="theme-head">
    <div class="theme-name">
      <h3><a class="theme-anchor" href="#${t.id}">${esc(t.name)}</a></h3>
      <code class="theme-id">${t.id}</code>
    </div>
    <p class="theme-desc">${esc(t.description)}</p>
    <dl class="metrics">
      <div><dt>${text.pillText}</dt><dd>${t.pillContrast.toFixed(1)}:1</dd></div>
      <div><dt>${text.onTerminal}</dt><dd>${t.termContrast.toFixed(1)}:1</dd></div>
      <div class="states"><dt>${text.states}</dt><dd>${t.states
        .map((c) => `<span class="dot" style="background:${c}" title="${c}"></span>`)
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
    <div class="term" data-bg="${t.target}">
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
  <footer class="theme-actions" aria-label="${text.useLabel} ${attr(t.name)}">
    <div class="cli-pill">
      <code>npx agy-powerline theme ${t.id}</code>
      <button
        type="button"
        class="btn-copy"
        data-copy="npx agy-powerline theme ${t.id}"
        aria-label="${text.copyCommandFor} ${attr(t.name)}"
      >
        <span class="copy-label">${text.copy}</span>
      </button>
    </div>
    <a class="btn-use-theme" href="/configure/#${t.configHash}">${text.useTheme}</a>
  </footer>
</article>`;
}

function introHtml(text) {
  const shots = SCREENSHOTS.map((name) => {
    const { width, height } = pngSize(path.join(repo, "assets", "screenshots", `${name}.png`));
    return `<li><figure>
            <img src="${screenshotUrl(name)}" alt="${attr(text.shots[name])}" width="${width}" height="${height}" loading="lazy" decoding="async" />
            <figcaption>${text.shotCaptions[name]}</figcaption>
          </figure></li>`;
  }).join("\n          ");
  return `<div class="intro">
        <section class="panel" aria-labelledby="what">
          <h2 id="what">${text.whatTitle}</h2>
          ${text.whatBody.map((p) => `<p>${p}</p>`).join("\n          ")}
        </section>
        <section class="panel" id="install" aria-labelledby="install-title">
          <h2 id="install-title">${text.installTitle}</h2>
          <ol class="steps">
            ${text.installSteps.map((s) => `<li>${s}</li>`).join("\n            ")}
          </ol>
          <p style="margin-top: 12px">${text.installMore}</p>
        </section>
      </div>

      <section aria-labelledby="shots">
        <h2 class="section-title" id="shots" style="margin-bottom: 14px">${text.shotsTitle}</h2>
        <ul class="shots">
          ${shots}
        </ul>
      </section>

      <div class="intro">
        <section class="panel" aria-labelledby="learn">
          <h2 id="learn">${text.learnTitle}</h2>
          <ul class="steps" style="padding-left: 18px">
            ${text.learnLinks.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("\n            ")}
          </ul>
        </section>
        <section class="panel" aria-labelledby="trust">
          <h2 id="trust">${text.trustTitle}</h2>
          <p>${text.trustBody}</p>
          <ul class="trust">
            ${text.trust.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("\n            ")}
          </ul>
        </section>
      </div>`;
}

// The home page's structured data: the site (for the site name in search
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
        url: "https://github.com/wassim-azi",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}#app`,
        name: "agy-powerline",
        description,
        url: SITE_URL,
        image: SITE_URL + OG_IMAGE.path,
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

// lang: "en" for /, "fr" for /fr/.
function buildGalleryHtml({ lang = "en" } = {}) {
  const text = HOME_TEXT[lang];
  const themes = buildThemes();
  const heroBar = ansiToHtml(
    renderStatusline(payload(), { ...defaultConfig(), ...PREVIEW.config }, PREVIEW.render)
  );
  const rawTemplate = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
  const filled = rawTemplate.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key === "facts") {
      return text
        .facts(themes.length)
        .map((f) => `<li>${f}</li>`)
        .join("\n          ");
    }
    return typeof text[key] === "string" ? text[key] : match;
  });
  const page = injectSiteChrome(filled, {
    title: text.title,
    description: text.description,
    currentPage: "themes",
    pagePath: lang === "en" ? "" : `${lang}/`,
    lang,
    alternates: [
      { hreflang: "en", path: "" },
      { hreflang: "fr", path: "fr/" },
      { hreflang: "x-default", path: "" },
    ],
    structuredData: lang === "en" ? homeStructuredData(text.description) : undefined,
  });
  return page
    .replace("<!--HERO_BAR-->", heroBar)
    .replace("<!--INTRO-->", introHtml(text))
    .replace("<!--CARDS-->", themes.map((t) => card(t, text)).join("\n"));
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(repo, "gallery.html"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildGalleryHtml(), "utf8");
  console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

module.exports = { buildGalleryHtml, homeStructuredData, SCREENSHOTS, screenshotUrl, pngSize };
