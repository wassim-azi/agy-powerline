"use strict";

/*
 * Shared layout, design tokens, header, footer, favicon and 404 page builder
 * for the agy-powerline GitHub Pages site (Theme Gallery & Web Configurator).
 */

const fs = require("fs");
const path = require("path");

const REPO_URL = "https://github.com/wassim-azi/agy-powerline";
// The custom domain the Pages site is served on (set in the repo's Pages settings).
const SITE_URL = "https://agy-powerline.com/";
// Every page search engines should index, relative to SITE_URL.
const SITE_PAGES = ["", "configure/"];
const FAVICON_PATH = path.join(__dirname, "favicon.svg");
const THEME_TOGGLE_PATH = path.join(__dirname, "theme-toggle.js");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function readFaviconSvg() {
  return fs.readFileSync(FAVICON_PATH, "utf8").trim();
}

function faviconDataUri() {
  const svg = readFaviconSvg();
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function inlineLogoSvg() {
  /* Strip xmlns so the raw HTML has no external w3.org URL string */
  return readFaviconSvg().replace(
    /<svg\s+xmlns="[^"]*"/,
    '<svg class="brand-logo" width="26" height="26" aria-hidden="true" focusable="false"'
  );
}

const SHARED_CSS = `
      :root {
        --bg: #f4f5f8;
        --surface: #ffffff;
        --surface-glass: rgba(255, 255, 255, 0.86);
        --fg: #181b22;
        --muted: #525866;
        --line: #cfd5e2;
        --border-strong: #798294;
        --accent: #2f4fb8;
        --accent-fg: #ffffff;
        --accent-soft: #eef2ff;
        --danger: #b91c1c;
        --danger-soft: #fef2f2;
        --warning: #854d0e;
        --warning-soft: #fefce8;
        --success: #15803d;
        --success-soft: #f0fdf4;
        /* Terminal grounds are content, identical in both page themes. */
        --term-dark-bg: #1d1f27;
        --term-dark-fg: #d4d6de;
        --term-dark-chrome: #161820;
        --term-dark-border: #323746;
        --term-light-bg: #fbfbf8;
        --term-light-fg: #2b2d34;
        --term-light-chrome: #efefe9;
        --term-light-border: #c6cad4;
        --term-edge: #798294;
        /* Radii, spacing and shadows */
        --radius-sm: 6px;
        --radius-md: 10px;
        --radius-lg: 14px;
        --radius-pill: 999px;
        --space-1: 4px;
        --space-2: 8px;
        --space-3: 12px;
        --space-4: 16px;
        --space-5: 24px;
        --space-6: 32px;
        --shadow-sm: 0 2px 8px rgba(15, 18, 26, 0.05);
        --shadow-md: 0 8px 24px rgba(15, 18, 26, 0.08);
        --shadow-term: 0 10px 28px rgba(10, 12, 18, 0.16);
        /* System fonts only: a web font would be a request to another site. */
        --font-ui: system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        --font-mono:
          "Cascadia Mono", ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace;
        color-scheme: light;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme="light"]) {
          --bg: #111319;
          --surface: #181b24;
          --surface-glass: rgba(24, 27, 36, 0.86);
          --fg: #eceef4;
          --muted: #9da5b4;
          --line: #2a2f3d;
          --border-strong: #636b7e;
          --accent: #8fa8ff;
          --accent-fg: #0d1017;
          --accent-soft: #1e263b;
          --danger: #ff7b72;
          --danger-soft: #3c1e22;
          --warning: #e3b341;
          --warning-soft: #382c16;
          --success: #56d364;
          --success-soft: #14321d;
          --term-edge: #636b7e;
          --shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.28);
          --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.36);
          --shadow-term: 0 12px 32px rgba(0, 0, 0, 0.45);
          color-scheme: dark;
        }
      }
      :root[data-theme="dark"] {
        --bg: #111319;
        --surface: #181b24;
        --surface-glass: rgba(24, 27, 36, 0.86);
        --fg: #eceef4;
        --muted: #9da5b4;
        --line: #2a2f3d;
        --border-strong: #636b7e;
        --accent: #8fa8ff;
        --accent-fg: #0d1017;
        --accent-soft: #1e263b;
        --danger: #ff7b72;
        --danger-soft: #3c1e22;
        --warning: #e3b341;
        --warning-soft: #382c16;
        --success: #56d364;
        --success-soft: #14321d;
        --term-edge: #636b7e;
        --shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.28);
        --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.36);
        --shadow-term: 0 12px 32px rgba(0, 0, 0, 0.45);
        color-scheme: dark;
      }
      :root[data-theme="light"] {
        --bg: #f4f5f8;
        --surface: #ffffff;
        --surface-glass: rgba(255, 255, 255, 0.86);
        --fg: #181b22;
        --muted: #525866;
        --line: #cfd5e2;
        --border-strong: #798294;
        --accent: #2f4fb8;
        --accent-fg: #ffffff;
        --accent-soft: #eef2ff;
        --danger: #b91c1c;
        --danger-soft: #fef2f2;
        --warning: #854d0e;
        --warning-soft: #fefce8;
        --success: #15803d;
        --success-soft: #f0fdf4;
        --term-edge: #798294;
        color-scheme: light;
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }
      html {
        overflow-x: hidden;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--fg);
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.5;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
      }

      /* Screen-reader only utility */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* Skip link */
      .skip-link {
        position: absolute;
        top: -100px;
        left: 16px;
        z-index: 1000;
        padding: 8px 14px;
        background: var(--accent);
        color: var(--accent-fg);
        font-weight: 600;
        border-radius: var(--radius-sm);
        text-decoration: none;
        box-shadow: var(--shadow-md);
      }
      .skip-link:focus {
        top: 12px;
        outline: 2px solid var(--fg);
        outline-offset: 2px;
      }

      /* Focus rings (WCAG AA 3:1+) */
      a:focus-visible,
      button:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      /* Shared Site Header */
      .site-header {
        position: sticky;
        top: 0;
        z-index: 20;
        background: var(--surface-glass);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--line);
      }
      .site-header-inner {
        max-width: 1240px;
        margin: 0 auto;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px 16px;
      }
      .brand-link {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--fg);
        font-weight: 700;
        font-size: 1.1rem;
        letter-spacing: -0.02em;
      }
      .brand-logo {
        flex-shrink: 0;
        border-radius: 6px;
      }
      .header-right {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px 18px;
      }
      .site-nav {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
      }
      .nav-link {
        color: var(--muted);
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 500;
        padding: 5px 10px;
        border-radius: var(--radius-sm);
        transition:
          color 120ms ease,
          background-color 120ms ease;
      }
      .nav-link:hover {
        color: var(--fg);
        background: var(--accent-soft);
      }
      .nav-link[aria-current="page"] {
        color: var(--accent);
        background: var(--accent-soft);
        font-weight: 600;
      }

      /* Page Theme Switch (System / Light / Dark) */
      .theme-switch {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        background: var(--surface);
        padding: 2px;
        gap: 2px;
      }
      .theme-btn {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--muted);
        font-family: inherit;
        font-size: 0.78rem;
        font-weight: 500;
        padding: 3px 8px;
        border-radius: 4px;
        cursor: pointer;
        transition:
          color 120ms ease,
          background-color 120ms ease;
      }
      .theme-btn:hover {
        color: var(--fg);
      }
      .theme-btn[aria-pressed="true"] {
        background: var(--accent);
        color: var(--accent-fg);
        font-weight: 600;
      }

      /* Shared Site Footer */
      .site-footer {
        margin-top: auto;
        border-top: 1px solid var(--line);
        background: var(--surface);
        color: var(--muted);
        font-size: 0.85rem;
      }
      .site-footer-inner {
        max-width: 1240px;
        margin: 0 auto;
        padding: 20px 16px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 16px;
      }
      .site-footer a {
        color: var(--accent);
        text-decoration: underline;
        text-underline-offset: 2px;
        font-weight: 500;
      }

      /* Shared Buttons */
      .btn {
        padding: 8px 16px;
        border-radius: var(--radius-sm);
        font-family: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        text-decoration: none;
        transition:
          background-color 120ms ease,
          border-color 120ms ease,
          opacity 120ms ease;
      }
      .btn-primary {
        background: var(--accent);
        color: var(--accent-fg);
      }
      .btn-primary:hover {
        opacity: 0.92;
      }
      .btn-secondary {
        background: var(--surface);
        border-color: var(--border-strong);
        color: var(--fg);
      }
      .btn-secondary:hover {
        background: var(--accent-soft);
        border-color: var(--accent);
      }

      /* Shared Segmented Radios */
      .seg {
        display: inline-flex;
        flex-wrap: wrap;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        overflow: hidden;
        background: var(--surface);
        margin: 0;
        padding: 0;
      }
      .seg input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      .seg label {
        padding: 5px 11px;
        font-size: 0.83rem;
        font-weight: 500;
        cursor: pointer;
        color: var(--fg);
        border-right: 1px solid var(--line);
        user-select: none;
        transition:
          background-color 120ms ease,
          color 120ms ease;
      }
      .seg label:last-of-type {
        border-right: 0;
      }
      .seg input:checked + label {
        background: var(--accent);
        color: var(--accent-fg);
        font-weight: 600;
      }
      .seg input:focus-visible + label {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }

      /* Terminal Window Frame */
      .term-frame {
        border: 1px solid var(--term-dark-border);
        border-radius: var(--radius-md);
        overflow: hidden;
        background: var(--term-dark-bg);
        box-shadow: var(--shadow-term);
        min-width: 0;
        contain: layout style;
      }
      .term-frame[data-bg="light"] {
        border-color: var(--term-light-border);
        background: var(--term-light-bg);
      }
      .term-titlebar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 12px;
        background: var(--term-dark-chrome);
        border-bottom: 1px solid var(--term-dark-border);
        color: #9da5b4;
        font-family: var(--font-mono);
        font-size: 0.74rem;
        user-select: none;
      }
      .term-frame[data-bg="light"] .term-titlebar {
        background: var(--term-light-chrome);
        border-bottom-color: var(--term-light-border);
        color: #525866;
      }
      .term-dots {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .term-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(157, 165, 180, 0.35);
      }
      .term-dot:nth-child(1) {
        background: #ff5f56;
      }
      .term-dot:nth-child(2) {
        background: #ffbd2e;
      }
      .term-dot:nth-child(3) {
        background: #27c93f;
      }
      .term-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .term {
        padding: 12px 14px 14px;
        overflow-x: auto;
        display: grid;
        gap: 4px;
        background: var(--term-dark-bg);
        color: var(--term-dark-fg);
      }
      .term[data-bg="dark"] {
        background: var(--term-dark-bg);
        color: var(--term-dark-fg);
      }
      .term[data-bg="light"] {
        background: var(--term-light-bg);
        color: var(--term-light-fg);
      }
      .term-label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.7;
        margin-top: 6px;
      }
      .term-label:first-child {
        margin-top: 0;
      }
      .screen {
        font-family: var(--font-mono);
        font-size: 13px;
        white-space: pre;
        width: max-content;
        contain: layout style;
      }
      .ln {
        height: 1.45em;
        line-height: 1.45em;
      }
      .r,
      .g {
        display: inline-block;
        height: 1.45em;
        vertical-align: top;
      }
      .g {
        width: 0.62em;
        background: var(--b);
        position: relative;
      }
      .g::before {
        content: "";
        position: absolute;
        inset: 0;
        background: var(--c);
      }
      .cap-l::before {
        border-radius: 999px 0 0 999px;
      }
      .cap-r::before {
        border-radius: 0 999px 999px 0;
      }
      .tri::before {
        clip-path: polygon(0 0, 100% 50%, 0 100%);
      }
      .tri-l::before {
        clip-path: polygon(100% 0, 0 50%, 100% 100%);
      }
      .slant-ul::before {
        clip-path: polygon(0 0, 100% 0, 0 100%);
      }
      .slant-lr::before {
        clip-path: polygon(0 100%, 100% 0, 100% 100%);
      }
      .slant-ur::before {
        clip-path: polygon(0 0, 100% 0, 100% 100%);
      }
      .slant-ll::before {
        clip-path: polygon(0 0, 100% 100%, 0 100%);
      }

      @media (max-width: 520px) {
        .site-header-inner {
          padding: 10px 12px;
          gap: 8px 12px;
        }
        .header-right {
          width: 100%;
          justify-content: space-between;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }
`;

// pagePath (relative to SITE_URL) gives an indexed page its canonical URL, so
// search engines merge the github.io and custom-domain copies into one result.
function buildHead({ title, description, noindex = false, pagePath, structuredData }) {
  const safeTitle = esc(title);
  const safeDesc = esc(description);
  const iconHref = faviconDataUri();
  const robots = noindex
    ? "noindex, follow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const pageUrl = !noindex && typeof pagePath === "string" ? esc(SITE_URL + pagePath) : "";
  const urlTags = pageUrl
    ? `
    <link rel="canonical" href="${pageUrl}" />
    <meta property="og:url" content="${pageUrl}" />`
    : "";
  // JSON-LD is data, not script, so the CSP doesn't block it; "<" is escaped so
  // a value can never close the tag.
  const ldJson = structuredData
    ? `
    <script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`
    : "";
  return `<meta
      name="description"
      content="${safeDesc}"
    />
    <meta name="robots" content="${robots}" />
    <meta name="author" content="Wassim AZI" />
    <meta name="application-name" content="agy-powerline" />
    <meta
      name="keywords"
      content="agy statusline, antigravity cli statusline, agy-powerline, google antigravity, agy, gemini quota, powerline statusline, terminal statusline, nerd fonts"
    />${urlTags}
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#f4f5f8" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#111319" media="(prefers-color-scheme: dark)" />
    <meta property="og:site_name" content="agy-powerline" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <link rel="icon" type="image/svg+xml" href="${iconHref}" />
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
    </script>`;
}

function buildHeader({ currentPage = "themes", rootPrefix = "./" } = {}) {
  const themesHref = rootPrefix;
  const configuratorHref = currentPage === "configurator" ? "./" : `${rootPrefix}configure/`;
  const themesCurrent = currentPage === "themes" ? ' aria-current="page"' : "";
  const configCurrent = currentPage === "configurator" ? ' aria-current="page"' : "";

  return `<a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="site-header-inner">
        <a class="brand-link" href="${themesHref}">
          ${inlineLogoSvg()}
          <span>agy-powerline</span>
        </a>
        <div class="header-right">
          <nav class="site-nav" aria-label="Primary">
            <a class="nav-link" href="${themesHref}"${themesCurrent}>Themes</a>
            <a class="nav-link" href="${configuratorHref}"${configCurrent}>Configurator</a>
            <a class="nav-link" href="${REPO_URL}">GitHub</a>
          </nav>
          <div class="theme-switch" role="group" aria-label="Page theme">
            <button type="button" class="theme-btn" data-theme-value="system" aria-pressed="true">
              System
            </button>
            <button type="button" class="theme-btn" data-theme-value="light" aria-pressed="false">
              Light
            </button>
            <button type="button" class="theme-btn" data-theme-value="dark" aria-pressed="false">
              Dark
            </button>
          </div>
        </div>
      </div>
    </header>`;
}

function buildFooter() {
  return `<footer class="site-footer">
      <div class="site-footer-inner">
        <span>MIT License · Rendered by the real statusline code</span>
        <a href="${REPO_URL}">agy-powerline on GitHub</a>
      </div>
    </footer>`;
}

function themeToggleScript() {
  const code = fs.readFileSync(THEME_TOGGLE_PATH, "utf8");
  return `${code}\n(function () {\n  if (typeof document !== "undefined" && window.AgySiteTheme) {\n    window.AgySiteTheme.initThemeToggle(document, window.localStorage);\n  }\n})();`;
}

function injectSiteChrome(
  html,
  { title, description, currentPage, rootPrefix, noindex = false, pagePath, structuredData }
) {
  return html
    .replace(
      "<!--SITE_HEAD-->",
      buildHead({ title, description, noindex, pagePath, structuredData })
    )
    .replace("/* SITE_CSS */", SHARED_CSS)
    .replace("<!--SITE_HEADER-->", buildHeader({ currentPage, rootPrefix }))
    .replace("<!--SITE_FOOTER-->", buildFooter())
    .replace("/* SITE_THEME_SCRIPT */", themeToggleScript());
}

function build404Html() {
  const title = "Page not found — agy-powerline";
  const description =
    "Page not found. Return to the agy-powerline theme gallery or web configurator.";
  const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Nothing loads from other sites: the page is its own inline style and script. -->
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"
    />
    <!--SITE_HEAD-->
    <style>
      /* SITE_CSS */
      .not-found-main {
        max-width: 720px;
        width: 100%;
        margin: 0 auto;
        padding: 64px 16px;
        display: grid;
        gap: 20px;
        text-align: center;
      }
      .not-found-code {
        font-family: var(--font-mono);
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .not-found-main h1 {
        margin: 0;
        font-size: 2rem;
        letter-spacing: -0.02em;
      }
      .not-found-main p {
        margin: 0 auto;
        color: var(--muted);
        max-width: 52ch;
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
      <div class="not-found-code">404 · Page not found</div>
      <h1>Nothing on this segment of the bar</h1>
      <p>
        The page you requested does not exist. Explore the built-in statusline themes or customize
        your own bar in the browser.
      </p>
      <div class="not-found-actions">
        <a class="btn btn-primary" href="./">Browse Themes</a>
        <a class="btn btn-secondary" href="./configure/">Open Configurator →</a>
      </div>
    </main>
    <!--SITE_FOOTER-->
    <script>
      /* SITE_THEME_SCRIPT */
    </script>
  </body>
</html>
`;
  return injectSiteChrome(template, {
    title,
    description,
    currentPage: "404",
    rootPrefix: "./",
    noindex: true,
  });
}

function build404(dest) {
  const html = build404Html();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html, "utf8");
  return dest;
}

// No <lastmod>: the build date would change on every deploy without the pages
// changing, and search engines learn to ignore a lastmod that isn't accurate.
function buildSitemapXml() {
  const urls = SITE_PAGES.map((p) => `  <url><loc>${esc(SITE_URL + p)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}sitemap.xml
`;
}

function buildSearchFiles(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "sitemap.xml"), buildSitemapXml(), "utf8");
  fs.writeFileSync(path.join(dir, "robots.txt"), buildRobotsTxt(), "utf8");
}

module.exports = {
  REPO_URL,
  SITE_URL,
  SITE_PAGES,
  SHARED_CSS,
  readFaviconSvg,
  faviconDataUri,
  inlineLogoSvg,
  buildHead,
  buildHeader,
  buildFooter,
  themeToggleScript,
  injectSiteChrome,
  build404Html,
  build404,
  buildSitemapXml,
  buildRobotsTxt,
  buildSearchFiles,
};
