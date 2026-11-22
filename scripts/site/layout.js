// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

/*
 * Shared layout of agy-powerline.com: design tokens and components, the self-
 * hosted font, header, footer, head tags (canonical, share cards, JSON-LD),
 * the site-wide script, the 404 page, sitemap and robots.txt.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { FONT_URL, SHARED_CSS } = require("./styles");
const { SITE_LANGUAGES, siteLanguage, CHROME_TEXT, buildFooterColumns } = require("./chrome-text");

const REPO_URL = "https://github.com/wassim-azi/agy-powerline";
const NPM_URL = "https://www.npmjs.com/package/agy-powerline";
// The custom domain the Pages site is served on (set in the repo's Pages settings).
const SITE_URL = "https://agy-powerline.com/";
const X_HANDLE = "wassim_azi";
const X_URL = `https://x.com/${X_HANDLE}`;
const LINKEDIN_URL = "https://www.linkedin.com/in/wassim-azi";
const AUTHOR_URL = "https://github.com/wassim-azi";
// Every indexable page has its own 1200×630 share card, drawn by
// scripts/site/images.js into assets/site/og/<slug>.jpg.
const OG_SIZE = { width: 1200, height: 630 };
// Google Analytics 4 for agy-powerline.com (stream "agy-powerline.com", ID
// 16232023254). Only the website loads it; the statusline and the CLI make no
// network calls.
const GA_MEASUREMENT_ID = "G-Z5XFJVH00H";
// The hosts Google lists for a GA4 tag behind a CSP: gtag.js comes from
// googletagmanager.com, and hits go to (region1.)google-analytics.com and
// analytics.google.com, by fetch/sendBeacon or, as a fallback, an image.
const GA_SCRIPT_SRC = "https://www.googletagmanager.com";
const GA_CONNECT_SRC =
  "https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com";
const GA_IMG_SRC = "https://*.google-analytics.com https://*.googletagmanager.com";
// Everything else loads from the site only. 'self' lets the stylesheet, the
// font, the icons, the editor recording, the manifest and tools that read robots.txt or llms.txt from
// inside the page reach this site. finishPage() swaps 'unsafe-inline' in
// script-src for the hashes of the page's own scripts. Styles stay inline-able:
// the configurator draws its preview with style attributes in the browser.
const SITE_CSP = `default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline' ${GA_SCRIPT_SRC}; img-src 'self' data: ${GA_IMG_SRC}; font-src 'self'; media-src 'self'; connect-src 'self' ${GA_CONNECT_SRC}; manifest-src 'self'; base-uri 'none'; form-action 'none'`;
// The styles every page shares (SHARED_CSS), in one file the browser keeps
// between pages.
const STYLESHEET_URL = "/site.css";
const FAVICON_PATH = path.join(__dirname, "favicon.svg");
const THEME_TOGGLE_PATH = path.join(__dirname, "theme-toggle.js");
const WEB_VITALS_PATH = path.join(__dirname, "web-vitals.js");

const FOOTER_COLUMNS = buildFooterColumns(REPO_URL, NPM_URL);

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function readFaviconSvg() {
  return fs.readFileSync(FAVICON_PATH, "utf8").trim();
}

function inlineLogoSvg(size = 28) {
  /* Strip xmlns so the raw HTML has no external w3.org URL string */
  return readFaviconSvg().replace(
    /<svg\s+xmlns="[^"]*"/,
    `<svg class="brand-logo" width="${size}" height="${size}" aria-hidden="true" focusable="false"`
  );
}

// Line icons (24×24, drawn with currentColor) and the brand marks of the
// sites the footer links to.
const ICON_PATHS = {
  system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  light:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark: '<path d="M20.5 14.1A8.5 8.5 0 1 1 9.9 3.5a7 7 0 0 0 10.6 10.6z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const BRAND_PATHS = {
  github:
    "M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z",
  x: "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z",
  linkedin:
    "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z",
  npm: "M1.76 0A1.76 1.76 0 0 0 0 1.76v20.48A1.76 1.76 0 0 0 1.76 24h20.48A1.76 1.76 0 0 0 24 22.24V1.76A1.76 1.76 0 0 0 22.24 0zm3.37 5.32 13.84.02-.01 13.84h-3.46l.01-10.38h-3.46l-.01 10.38H5.11z",
};

function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
}

function brandIcon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${BRAND_PATHS[name]}"/></svg>`;
}

// One copy button for every command on the site; the site script copies its
// data-copy text and says so in the footer's live region.
function copyButton(command, label, text = "Copy") {
  return `<button type="button" class="copy-btn" data-copy="${esc(command)}" aria-label="${esc(label)}">${icon("copy", 15)}<span class="copy-label">${esc(text)}</span></button>`;
}

// A terminal-style command with its copy button. The command can take focus,
// so on a narrow screen it can be scrolled with the keyboard.
function commandBox(command, { label, copy = "Copy", large = false } = {}) {
  return `<div class="cmd${large ? " cmd-lg" : ""}"><code tabindex="0"><span class="prompt" aria-hidden="true">$ </span>${esc(command)}</code>${copyButton(command, label || `Copy: ${command}`, copy)}</div>`;
}

const absoluteUrl = (p) => SITE_URL + String(p).replace(/^\//, "");

// A page's share card file name: "" is home, "docs/configuration/" is
// docs-configuration.
const cardSlug = (pagePath) =>
  String(pagePath || "")
    .replace(/\/+$/, "")
    .replace(/\//g, "-") || "home";
const cardPath = (pagePath) => `og/${cardSlug(pagePath)}.jpg`;

// pagePath (relative to SITE_URL) gives an indexed page its canonical URL, so
// search engines merge the github.io and custom-domain copies into one result.
// alternates lists the same page in other languages ({ hreflang, path }).
// article ({ published, modified }) adds the article:* tags of a guide.
// standalone pages carry the shared styles themselves instead of linking them.
function buildHead({
  title,
  description,
  noindex = false,
  pagePath,
  structuredData,
  lang = "en",
  alternates = [],
  ogType = "website",
  imageAlt,
  article,
  alternateMarkdown = "",
  standalone = false,
}) {
  const safeTitle = esc(title);
  const safeDesc = esc(description);
  const robots = noindex
    ? "noindex, follow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const pageUrl = !noindex && typeof pagePath === "string" ? esc(absoluteUrl(pagePath)) : "";
  const urlTags = pageUrl
    ? `
    <link rel="canonical" href="${pageUrl}" />
    <meta property="og:url" content="${pageUrl}" />`
    : "";
  const alternateTags = alternates
    .map(
      (alt) => `
    <link rel="alternate" hreflang="${esc(alt.hreflang)}" href="${esc(absoluteUrl(alt.path))}" />`
    )
    .join("");
  const discoveryTags =
    !noindex && !standalone
      ? `
    <link rel="alternate" type="application/atom+xml" title="agy-powerline releases" href="${esc(absoluteUrl("changelog.xml"))}" />
    <link rel="alternate" type="text/plain" title="llms.txt" href="${esc(absoluteUrl("llms.txt"))}" />
    <link rel="alternate" type="text/plain" title="llms-full.txt" href="${esc(absoluteUrl("llms-full.txt"))}" />${
      alternateMarkdown
        ? `
    <link rel="alternate" type="text/markdown" href="${esc(absoluteUrl(alternateMarkdown))}" />`
        : ""
    }`
      : "";
  const locale = siteLanguage(lang).locale;
  const otherLocales = alternates
    .filter((alt) => alt.hreflang !== lang && alt.hreflang !== "x-default")
    .map(
      (alt) => `
    <meta property="og:locale:alternate" content="${siteLanguage(alt.hreflang).locale}" />`
    )
    .join("");
  // JSON-LD is data, not script, so the CSP doesn't block it; "<" is escaped so
  // a value can never close the tag.
  const ldJson = (Array.isArray(structuredData) ? structuredData : [structuredData])
    .filter(Boolean)
    .map(
      (data) => `
    <script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`
    )
    .join("");
  const image = esc(absoluteUrl(cardPath(noindex ? "" : pagePath)));
  const alt = esc(
    imageAlt ||
      `${title.replace(/ - agy-powerline$/, "")}: share card with an agy-powerline statusline`
  );
  const articleTags = article
    ? [
        article.published &&
          `<meta property="article:published_time" content="${esc(article.published)}" />`,
        article.modified &&
          `<meta property="article:modified_time" content="${esc(article.modified)}" />`,
        `<meta property="article:author" content="${absoluteUrl("about/")}" />`,
      ]
        .filter(Boolean)
        .map((tag) => `\n    ${tag}`)
        .join("")
    : "";
  return `<meta
      name="description"
      content="${safeDesc}"
    />
    <meta name="robots" content="${robots}" />
    <meta name="author" content="Wassim AZI" />
    <meta name="application-name" content="agy-powerline" />${urlTags}${alternateTags}${discoveryTags}
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#f7f8fb" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0b0d12" media="(prefers-color-scheme: dark)" />
    <link rel="preload" href="${FONT_URL}" as="font" type="font/woff2" crossorigin />${
      standalone
        ? ""
        : `
    <link rel="stylesheet" href="${STYLESHEET_URL}" />`
    }
    <meta property="og:site_name" content="agy-powerline" />
    <meta property="og:locale" content="${locale}" />${otherLocales}
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:type" content="${esc(ogType)}" />${articleTags}
    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="${OG_SIZE.width}" />
    <meta property="og:image:height" content="${OG_SIZE.height}" />
    <meta property="og:image:alt" content="${alt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@${X_HANDLE}" />
    <meta name="twitter:creator" content="@${X_HANDLE}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="${alt}" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <title>${safeTitle}</title>${ldJson}
    <script>
      (function () {
        try {
          var t = localStorage.getItem("agy-powerline-theme");
          if (t === "light" || t === "dark") {
            document.documentElement.setAttribute("data-theme", t);
          }
        } catch {}
      })();
    </script>${standalone ? "" : analyticsTags()}`;
}

function webVitalsScript() {
  const code = fs.readFileSync(WEB_VITALS_PATH, "utf8");
  return `${code}\n(function () {\n  if (typeof globalThis !== "undefined" && globalThis.AgySiteVitals) {\n    globalThis.AgySiteVitals.initWebVitals();\n  }\n})();`;
}

// The Google Analytics tag and Core Web Vitals collector, on every page of the
// site. A standalone page is a local file (npm run gallery), not a visit, so it
// gets neither. Each inline script is hashed into the page's CSP by
// finishPage() like the site's other scripts.
function analyticsTags() {
  return `
    <script async src="${GA_SCRIPT_SRC}/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      gtag("js", new Date());
      gtag("config", "${GA_MEASUREMENT_ID}", {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
    </script>
    <script>
${webVitalsScript()}
    </script>`;
}

// currentPage: install, docs, themes or configurator marks that nav link as
// the current page; links are root-relative, so they work from any depth,
// including the 404 page GitHub serves at any missing path.
function buildHeader({ currentPage = "", lang = "en" } = {}) {
  const text = CHROME_TEXT[lang] || CHROME_TEXT.en;
  const home = siteLanguage(lang).href;
  const items = [
    ["install", "/install/"],
    ["docs", "/docs/"],
    ["themes", "/themes/"],
    ["configurator", "/configure/"],
  ];
  const links = (cls) =>
    items
      .map(
        ([key, href]) =>
          `<a class="${cls}" href="${href}"${currentPage === key ? ' aria-current="page"' : ""}>${esc(text.nav[key])}</a>`
      )
      .join("\n            ");
  const current = siteLanguage(lang);
  const flag = (l) => `<span class="flag flag-${l}" aria-hidden="true"></span>`;
  const languageLinks = SITE_LANGUAGES.map(
    (l) =>
      `<a class="lang-link" href="${l.href}" hreflang="${l.lang}" lang="${l.lang}"${l.lang === current.lang ? ' aria-current="true"' : ""}>${flag(l.lang)}${esc(l.label)}</a>`
  ).join("\n              ");
  const themeButtons = ["system", "light", "dark"]
    .map(
      (value) =>
        `<button type="button" class="theme-btn" data-theme-value="${value}" aria-pressed="${value === "system"}" aria-label="${esc(text[value])}" title="${esc(text[value])}">${icon(value, 15)}</button>`
    )
    .join("\n            ");

  return `<a class="skip-link" href="#main">${esc(text.skip)}</a>
    <header class="site-header">
      <div class="site-header-inner">
        <a class="brand-link" href="${home}">
          ${inlineLogoSvg()}
          <span>agy-powerline</span>
        </a>
        <nav class="site-nav" aria-label="Primary">
            ${links("nav-link")}
        </nav>
        <div class="header-actions">
          <a class="icon-btn header-github" href="${REPO_URL}" aria-label="${esc(text.github)}" title="GitHub">${brandIcon("github", 19)}</a>
          <details class="lang-menu">
            <summary class="lang-btn" aria-label="${current.lang.toUpperCase()} — ${esc(text.language)}: ${esc(current.label)}" title="${esc(text.language)}">${flag(current.lang)}<span class="lang-code">${current.lang.toUpperCase()}</span></summary>
            <nav class="lang-menu-panel" aria-label="${esc(text.language)}">
              ${languageLinks}
            </nav>
          </details>
          <div class="theme-switch" role="group" aria-label="${esc(text.pageTheme)}">
            ${themeButtons}
          </div>
          <a class="btn btn-primary btn-sm header-cta" href="/install/">${esc(text.getStarted)}</a>
          <details class="nav-menu">
            <summary class="icon-btn" aria-label="${esc(text.menu)}">${icon("menu", 20)}</summary>
            <nav class="nav-menu-panel" aria-label="${esc(text.menu)}">
            ${links("menu-link")}
              <a class="menu-link" href="${REPO_URL}">GitHub</a>
              <a class="btn btn-primary" href="/install/">${esc(text.getStarted)}</a>
            </nav>
          </details>
        </div>
      </div>
    </header>`;
}

function buildFooter({ lang = "en" } = {}) {
  const text = CHROME_TEXT[lang] || CHROME_TEXT.en;
  const home = siteLanguage(lang).href;
  const cols = FOOTER_COLUMNS.map(
    (col) => `<div class="footer-col">
            <p class="footer-title">${esc(text[col.key])}</p>
            <ul>
              ${col.links.map(([label, href]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join("\n              ")}
            </ul>
          </div>`
  ).join("\n          ");
  // rel="me" ties the author's profiles to this site.
  const social = [
    ["github", REPO_URL, "GitHub", ""],
    ["x", X_URL, `X (@${X_HANDLE})`, ' rel="me"'],
    ["linkedin", LINKEDIN_URL, "LinkedIn", ' rel="me"'],
    ["npm", NPM_URL, "npm", ""],
  ]
    .map(
      ([name, href, label, rel]) =>
        `<li><a class="icon-btn" href="${href}"${rel} aria-label="${esc(label)}" title="${esc(label)}">${brandIcon(name, 18)}</a></li>`
    )
    .join("\n            ");
  const others = SITE_LANGUAGES.filter((l) => l.lang !== siteLanguage(lang).lang)
    .map((l) => `<a href="${l.href}" hreflang="${l.lang}" lang="${l.lang}">${esc(l.label)}</a>`)
    .join("\n          ");
  return `<footer class="site-footer">
      <div class="site-footer-inner">
        <div class="footer-brand">
          <a class="brand-link" href="${home}">${inlineLogoSvg(26)}<span>agy-powerline</span></a>
          <p>${esc(text.tagline)}</p>
          <ul class="social">
            ${social}
          </ul>
        </div>
        <nav class="footer-cols" aria-label="Site">
          ${cols}
        </nav>
      </div>
      <div class="footer-bottom">
        <span>${esc(text.footerNote)}</span>
        <span class="footer-langs">
          ${others}
        </span>
      </div>
      <span class="sr-only" id="copyStatus" aria-live="polite" data-label-copy="${esc(text.copy)}" data-label-copied="${esc(text.copied)}" data-label-status="${esc(text.copiedStatus)}" data-label-code="${esc(text.copyCode)}"></span>
    </footer>`;
}

// Copy buttons ([data-copy]) and a copy button on every code block of a text
// page. The labels come from the footer, in the page's language.
const SITE_SCRIPT = `(function () {
  var status = document.getElementById("copyStatus");
  if (!status) return;
  var label = function (key) {
    return status.getAttribute("data-label-" + key) || "";
  };
  var copyIcon = ${JSON.stringify(icon("copy", 15))};
  document.querySelectorAll(".prose pre").forEach(function (pre) {
    var wrap = document.createElement("div");
    wrap.className = "pre-wrap";
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn pre-copy";
    btn.setAttribute("aria-label", label("code"));
    btn.innerHTML = copyIcon + '<span class="copy-label"></span>';
    btn.querySelector(".copy-label").textContent = label("copy");
    wrap.appendChild(btn);
  });
  function done(btn) {
    var text = btn.querySelector(".copy-label");
    if (text) text.textContent = label("copied");
    btn.classList.add("copied");
    status.textContent = label("status");
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(function () {
      if (text) text.textContent = label("copy");
      btn.classList.remove("copied");
    }, 1800);
  }
  function select(el) {
    if (!el || !window.getSelection) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button[data-copy], .pre-copy");
    if (!btn) return;
    var source = btn.classList.contains("pre-copy")
      ? btn.parentElement.querySelector("pre")
      : btn.parentElement.querySelector("code");
    var text = btn.getAttribute("data-copy") || (source ? source.innerText.replace(/\\n$/, "") : "");
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { done(btn); },
        function () { select(source); }
      );
    } else {
      select(source);
    }
  });
  // The menu closes when a link in it is followed to a section of the page.
  var menu = document.querySelector(".nav-menu");
  if (menu) {
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) menu.removeAttribute("open");
    });
  }
  // An open header menu closes on a click outside it.
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".site-header details[open]").forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute("open");
    });
  });
})();`;

function themeToggleScript() {
  const code = fs.readFileSync(THEME_TOGGLE_PATH, "utf8");
  return `${code}\n(function () {\n  if (typeof document !== "undefined" && window.AgySiteTheme) {\n    window.AgySiteTheme.initThemeToggle(document, window.localStorage);\n  }\n})();\n${SITE_SCRIPT}`;
}

// options.pageCss: styles of the page's generated markup (style-classes.js),
// last in the page's stylesheet so they win over the template's rules, as the
// style attributes they replace did. options.standalone inlines the shared
// styles, for a page opened as a single file (npm run gallery).
function injectSiteChrome(html, options) {
  const { currentPage, lang = "en", pageCss = "", standalone = false } = options;
  return html
    .replace(
      "<!--SITE_CSP-->",
      `<meta http-equiv="Content-Security-Policy" content="${SITE_CSP}" />`
    )
    .replace("<!--SITE_HEAD-->", buildHead(options))
    .replace("/* SITE_CSS */", () => (standalone ? SHARED_CSS : ""))
    .replace("</style>", () => (pageCss ? `${pageCss}\n    </style>` : "</style>"))
    .replace("<!--SITE_HEADER-->", buildHeader({ currentPage, lang }))
    .replace("<!--SITE_FOOTER-->", buildFooter({ lang }))
    .replace("/* SITE_THEME_SCRIPT */", themeToggleScript());
}

// The last step of every page, once nothing more is added to it: its CSP names
// the inline scripts it runs by their SHA-256 instead of allowing any inline
// script, so a script that got into a page through a build bug wouldn't run.
// JSON-LD isn't run and needs none. The browser hashes a script's text with its
// line breaks read as \n, so that's what is hashed here. Tags match in any case,
// and end tags with trailing text, the way the browser reads them. A page that
// loads a script file from the site (the configurator) also allows 'self'; the
// file's integrity attribute pins its content.
function finishPage(html) {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script[^>]*>/gi)].map(
    ([, body]) =>
      `'sha256-${crypto.createHash("sha256").update(body.replace(/\r\n?/g, "\n")).digest("base64")}'`
  );
  if (/<script src="\/[^/]/.test(html)) hashes.push("'self'");
  const scripts = [...new Set(hashes)].join(" ") || "'none'";
  return html.replace(SITE_CSP, () =>
    SITE_CSP.replace("script-src 'unsafe-inline'", `script-src ${scripts}`)
  );
}

// The stylesheet every page links.
function buildStylesheet() {
  return `${SHARED_CSS.replace(/^ {6}/gm, "").trim()}\n`;
}

function build404Html() {
  const title = "Page not found - agy-powerline";
  const description =
    "Page not found. Return to the agy-powerline home page, the themes, the docs or the web configurator.";
  const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Only Google Analytics loads from another site: the rest is the page's own inline style and script. -->
    <!--SITE_CSP-->
    <!--SITE_HEAD-->
    <style>
      /* SITE_CSS */
      .not-found-main {
        max-width: 720px;
        width: 100%;
        margin: 0 auto;
        padding: 96px 20px;
        display: grid;
        gap: 20px;
        justify-items: center;
        text-align: center;
      }
      .not-found-main h1 {
        margin: 0;
        font-size: clamp(2rem, 5vw, 3rem);
        letter-spacing: -0.03em;
      }
      .not-found-main p {
        margin: 0 auto;
        color: var(--muted);
        max-width: 52ch;
        font-size: 1.05rem;
      }
      .not-found-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <!--SITE_HEADER-->
    <main class="not-found-main" id="main">
      <p class="eyebrow">404 · Page not found</p>
      <h1>Nothing on this segment of the bar</h1>
      <p>
        The page you requested does not exist. Start from the home page, browse the themes, read
        the docs, or build your own bar in the browser.
      </p>
      <div class="not-found-actions">
        <a class="btn btn-primary" href="/">Home</a>
        <a class="btn btn-secondary" href="/themes/">Browse themes</a>
        <a class="btn btn-secondary" href="/docs/">Read the docs</a>
        <a class="btn btn-ghost" href="/configure/">Open the configurator →</a>
      </div>
    </main>
    <!--SITE_FOOTER-->
    <script>
      /* SITE_THEME_SCRIPT */
    </script>
  </body>
</html>
`;
  return finishPage(
    injectSiteChrome(template, {
      title,
      description,
      currentPage: "404",
      noindex: true,
    })
  );
}

// pages: [{ path, lastmod, images }], path relative to SITE_URL. lastmod is the
// last commit of the page's source files; a page without one (not committed
// yet) gets none, since search engines learn to ignore a lastmod that isn't
// accurate, and a build date would change on every deploy. images are the
// page's main pictures (its share card, screenshots), as site paths.
function buildSitemapXml(pages) {
  const urls = pages
    .map((p) => {
      const lastmod = p.lastmod ? `<lastmod>${esc(p.lastmod)}</lastmod>` : "";
      const images = (p.images || [])
        .map((img) => `<image:image><image:loc>${esc(absoluteUrl(img))}</image:loc></image:image>`)
        .join("");
      return `  <url><loc>${esc(absoluteUrl(p.path))}</loc>${lastmod}${images}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
}

// The changelog feed doubles as a second sitemap: search engines crawl feeds
// often, which brings new releases in sooner. Crawlers stay off the
// configurator's script: they would read the paths in it as links to pages
// that don't exist. The page itself shows its content without it.
function buildRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /configure/*.js$

Sitemap: ${SITE_URL}sitemap.xml
Sitemap: ${SITE_URL}changelog.xml
`;
}

// RFC 9116: where to report a vulnerability, the same private GitHub reporting
// SECURITY.md asks for. The RFC wants an Expires under a year away; each
// deploy moves it, and a site left unreleased for a year should look stale.
function buildSecurityTxt(now = new Date()) {
  const expires = new Date(now.getTime() + 365 * 86400 * 1000);
  expires.setUTCHours(0, 0, 0, 0);
  return `Contact: ${REPO_URL}/security/advisories/new
Expires: ${expires.toISOString().replace(".000Z", "Z")}
Policy: ${REPO_URL}/blob/main/SECURITY.md
Preferred-Languages: en
Canonical: ${SITE_URL}.well-known/security.txt
`;
}

module.exports = {
  REPO_URL,
  NPM_URL,
  SITE_URL,
  SITE_CSP,
  STYLESHEET_URL,
  X_URL,
  X_HANDLE,
  LINKEDIN_URL,
  AUTHOR_URL,
  OG_SIZE,
  FONT_URL,
  SHARED_CSS,
  CHROME_TEXT,
  SITE_LANGUAGES,
  FOOTER_COLUMNS,
  esc,
  absoluteUrl,
  cardSlug,
  cardPath,
  icon,
  brandIcon,
  copyButton,
  commandBox,
  readFaviconSvg,
  inlineLogoSvg,
  buildHead,
  buildHeader,
  buildFooter,
  themeToggleScript,
  injectSiteChrome,
  finishPage,
  buildStylesheet,
  build404Html,
  buildSitemapXml,
  buildRobotsTxt,
  buildSecurityTxt,
};
