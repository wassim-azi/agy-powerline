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
// Nothing loads from other sites. 'self' lets the stylesheet, the font, the
// icons, the manifest and tools that read robots.txt or llms.txt from inside the
// page reach this site. finishPage() swaps 'unsafe-inline' in script-src for the
// hashes of the page's own scripts. Styles stay inline-able: the configurator
// draws its preview with style attributes in the browser.
const SITE_CSP =
  "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'";
const FONT_URL = "/fonts/inter-latin.woff2";
// The styles every page shares (SHARED_CSS), in one file the browser keeps
// between pages.
const STYLESHEET_URL = "/site.css";
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

const DARK_TOKENS = `
        --bg: #0b0d12;
        --bg-tint: #0f1219;
        --surface: #12151d;
        --surface-2: #191d28;
        --surface-glass: rgba(11, 13, 18, 0.74);
        --fg: #eef0f6;
        --fg-soft: #d3d7e2;
        --muted: #a0a8b9;
        --line: #232836;
        --line-strong: #323a4b;
        --border-strong: #5d6577;
        --accent: #8fa8ff;
        --accent-hover: #aabcff;
        --accent-fg: #0a0d16;
        --accent-soft: #1a2136;
        --grad: linear-gradient(100deg, #f08cc8 0%, #8fa8ff 50%, #7ee0a0 100%);
        --danger: #ff7b72;
        --danger-soft: #3c1e22;
        --warning: #e3b341;
        --warning-soft: #382c16;
        --success: #56d364;
        --success-soft: #14321d;
        --term-edge: #5d6577;
        --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
        --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.35);
        --shadow-lg: 0 30px 80px rgba(0, 0, 0, 0.55);
        --shadow-term: 0 24px 64px rgba(0, 0, 0, 0.55);
        color-scheme: dark;`;

const LIGHT_TOKENS = `
        --bg: #f7f8fb;
        --bg-tint: #eff2f8;
        --surface: #ffffff;
        --surface-2: #f1f3f8;
        --surface-glass: rgba(247, 248, 251, 0.8);
        --fg: #12141a;
        --fg-soft: #2b2f3a;
        --muted: #525a6b;
        --line: #e0e4ed;
        --line-strong: #c8cedb;
        --border-strong: #7a8294;
        --accent: #3550c8;
        --accent-hover: #2a42ad;
        --accent-fg: #ffffff;
        --accent-soft: #ebefff;
        --grad: linear-gradient(100deg, #b8327f 0%, #3550c8 50%, #13804a 100%);
        --danger: #b91c1c;
        --danger-soft: #fef2f2;
        --warning: #854d0e;
        --warning-soft: #fefce8;
        --success: #15803d;
        --success-soft: #f0fdf4;
        --term-edge: #7a8294;
        --shadow-sm: 0 1px 2px rgba(16, 20, 30, 0.06), 0 1px 1px rgba(16, 20, 30, 0.04);
        --shadow-md: 0 6px 16px rgba(16, 20, 30, 0.06), 0 14px 36px rgba(16, 20, 30, 0.08);
        --shadow-lg: 0 28px 70px rgba(16, 20, 30, 0.16);
        --shadow-term: 0 22px 56px rgba(10, 12, 18, 0.24);
        color-scheme: light;`;

const SHARED_CSS = `
      /* Inter, Latin subset, served from this site (assets/site/fonts/OFL.txt). */
      @font-face {
        font-family: "Inter";
        font-style: normal;
        font-weight: 100 900;
        font-display: swap;
        src: url("${FONT_URL}") format("woff2");
        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
          U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
          U+FEFF, U+FFFD;
      }
      /* Arial resized to Inter's metrics, so the text doesn't move when Inter arrives. */
      @font-face {
        font-family: "Inter Fallback";
        src: local("Arial"), local("Helvetica"), local("Liberation Sans");
        size-adjust: 107.06%;
        ascent-override: 90.49%;
        descent-override: 22.56%;
        line-gap-override: 0%;
      }
      :root {${LIGHT_TOKENS}
        /* Terminal grounds are content, identical in both page themes. */
        --term-dark-bg: #1d1f27;
        --term-dark-fg: #d4d6de;
        --term-dark-chrome: #15171e;
        --term-dark-border: #2e3342;
        --term-light-bg: #fbfbf8;
        --term-light-fg: #2b2d34;
        --term-light-chrome: #efefe9;
        --term-light-border: #c6cad4;
        --radius-sm: 8px;
        --radius-md: 12px;
        --radius-lg: 16px;
        --radius-xl: 22px;
        --radius-pill: 999px;
        --space-1: 4px;
        --space-2: 8px;
        --space-3: 12px;
        --space-4: 16px;
        --space-5: 24px;
        --space-6: 32px;
        --header-h: 60px;
        --font-ui: Inter, "Inter Fallback", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial,
          sans-serif;
        --font-mono:
          "Cascadia Mono", ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme="light"]) {${DARK_TOKENS}
        }
      }
      :root[data-theme="dark"] {${DARK_TOKENS}
      }
      :root[data-theme="light"] {${LIGHT_TOKENS}
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }
      html {
        overflow-x: hidden;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--fg);
        font-family: var(--font-ui);
        font-size: 16px;
        line-height: 1.6;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
        -webkit-font-smoothing: antialiased;
        font-feature-settings: "cv11", "ss01";
      }
      img {
        max-width: 100%;
      }
      h1,
      h2,
      h3 {
        line-height: 1.2;
        letter-spacing: -0.02em;
      }

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
      a:focus-visible,
      button:focus-visible,
      summary:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible,
      [tabindex="0"]:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .container {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding-inline: 20px;
      }

      /* Header */
      .site-header {
        position: sticky;
        top: 0;
        z-index: 50;
        background: var(--surface-glass);
        backdrop-filter: saturate(180%) blur(14px);
        -webkit-backdrop-filter: saturate(180%) blur(14px);
        border-bottom: 1px solid var(--line);
      }
      .site-header-inner {
        max-width: 1200px;
        height: var(--header-h);
        margin: 0 auto;
        padding: 0 20px;
        display: flex;
        align-items: center;
        gap: 28px;
      }
      .brand-link {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--fg);
        font-weight: 700;
        font-size: 1.08rem;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }
      .brand-logo {
        flex-shrink: 0;
        border-radius: 7px;
      }
      .site-nav {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .nav-link {
        color: var(--muted);
        text-decoration: none;
        font-size: 0.92rem;
        font-weight: 500;
        padding: 6px 12px;
        border-radius: var(--radius-sm);
        transition:
          color 120ms ease,
          background-color 120ms ease;
      }
      .nav-link:hover {
        color: var(--fg);
        background: var(--surface-2);
      }
      .nav-link[aria-current="page"] {
        color: var(--fg);
        background: var(--surface-2);
        font-weight: 600;
      }
      .header-actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .icon-btn {
        display: inline-grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        color: var(--muted);
        background: transparent;
        border: 0;
        cursor: pointer;
        text-decoration: none;
        transition:
          color 120ms ease,
          background-color 120ms ease;
      }
      .icon-btn:hover {
        color: var(--fg);
        background: var(--surface-2);
      }
      .theme-switch {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border: 1px solid var(--line);
        border-radius: 11px;
        background: var(--surface);
      }
      .theme-btn {
        appearance: none;
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        transition:
          color 120ms ease,
          background-color 120ms ease;
      }
      .theme-btn:hover {
        color: var(--fg);
      }
      .theme-btn[aria-pressed="true"] {
        background: var(--surface-2);
        color: var(--fg);
        box-shadow: inset 0 0 0 1px var(--line-strong);
      }
      /* The language menu: the home page in each language, with its flag. */
      .lang-menu {
        position: relative;
      }
      .lang-menu > summary {
        list-style: none;
      }
      .lang-menu > summary::-webkit-details-marker {
        display: none;
      }
      .lang-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 8px;
        border-radius: 10px;
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition:
          color 120ms ease,
          background-color 120ms ease;
      }
      .lang-btn:hover,
      .lang-menu[open] > .lang-btn {
        color: var(--fg);
        background: var(--surface-2);
      }
      /* Flags are backgrounds, not images: the link's text already names the
         language. Chrome fetches the backgrounds of a closed <details> unless
         its panel is display: none (below). */
      .flag {
        display: block;
        flex: none;
        width: 20px;
        height: 20px;
        background-size: 100% 100%;
        background-repeat: no-repeat;
      }
      .flag-en {
        background-image: url("/img/flag-en.png");
      }
      .flag-fr {
        background-image: url("/img/flag-fr.png");
      }
      .flag-es {
        background-image: url("/img/flag-es.png");
      }
      .lang-menu:not([open]) > .lang-menu-panel {
        display: none;
      }
      .lang-menu-panel {
        position: absolute;
        right: 0;
        top: calc(100% + 12px);
        min-width: 180px;
        display: grid;
        gap: 2px;
        padding: 8px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
      }
      .lang-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        color: var(--fg);
        text-decoration: none;
        font-weight: 500;
      }
      .lang-link:hover,
      .lang-link[aria-current="true"] {
        background: var(--surface-2);
      }
      /* Narrow screens: the links move into a menu that works without script. */
      .nav-menu {
        display: none;
        position: relative;
      }
      .nav-menu > summary {
        list-style: none;
      }
      .nav-menu > summary::-webkit-details-marker {
        display: none;
      }
      .nav-menu-panel {
        position: absolute;
        right: 0;
        top: calc(100% + 12px);
        width: min(260px, calc(100vw - 28px));
        display: grid;
        gap: 2px;
        padding: 8px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
      }
      .menu-link {
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        color: var(--fg);
        text-decoration: none;
        font-weight: 500;
      }
      .menu-link:hover,
      .menu-link[aria-current="page"] {
        background: var(--surface-2);
      }
      .nav-menu-panel .btn {
        margin-top: 6px;
      }
      @media (max-width: 880px) {
        .site-nav,
        .site-header .header-cta {
          display: none;
        }
        .nav-menu {
          display: block;
        }
      }
      @media (max-width: 400px) {
        .site-header-inner {
          padding: 0 14px;
        }
        .header-actions {
          gap: 4px;
        }
        .header-github,
        .lang-code {
          display: none;
        }
      }

      /* Footer */
      .site-footer {
        margin-top: auto;
        border-top: 1px solid var(--line);
        background: var(--bg-tint);
        color: var(--muted);
        font-size: 0.9rem;
      }
      .site-footer-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 56px 20px 36px;
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(0, 2.4fr);
        gap: 40px;
      }
      .footer-brand p {
        margin: 12px 0 16px;
        max-width: 34ch;
      }
      .social {
        list-style: none;
        margin: 0 0 0 -8px;
        padding: 0;
        display: flex;
        gap: 2px;
      }
      .footer-cols {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 24px;
      }
      .footer-title {
        margin: 0 0 12px;
        font-size: 0.76rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--fg);
      }
      .footer-col ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .footer-col a,
      .footer-bottom a {
        color: var(--muted);
        text-decoration: none;
      }
      .footer-col a:hover,
      .footer-bottom a:hover {
        color: var(--fg);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .footer-langs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
      }
      .footer-bottom {
        max-width: 1200px;
        margin: 0 auto;
        padding: 18px 20px 28px;
        border-top: 1px solid var(--line);
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px 16px;
        font-size: 0.85rem;
      }
      @media (max-width: 760px) {
        .site-footer-inner {
          grid-template-columns: minmax(0, 1fr);
          padding-top: 40px;
        }
        .footer-cols {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      /* Buttons */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 40px;
        padding: 8px 18px;
        border-radius: 10px;
        border: 1px solid transparent;
        font-family: inherit;
        font-size: 0.92rem;
        font-weight: 600;
        line-height: 1.2;
        text-decoration: none;
        cursor: pointer;
        transition:
          background-color 120ms ease,
          border-color 120ms ease,
          color 120ms ease,
          transform 120ms ease;
      }
      .btn:active {
        transform: translateY(1px);
      }
      .btn-primary {
        background: var(--accent);
        color: var(--accent-fg);
        box-shadow: var(--shadow-sm);
      }
      .btn-primary:hover {
        background: var(--accent-hover);
      }
      .btn-secondary {
        background: var(--surface);
        border-color: var(--line-strong);
        color: var(--fg);
      }
      .btn-secondary:hover {
        border-color: var(--border-strong);
        background: var(--surface-2);
      }
      .btn-ghost {
        background: transparent;
        color: var(--fg);
      }
      .btn-ghost:hover {
        background: var(--surface-2);
      }
      .btn-sm {
        min-height: 34px;
        padding: 6px 14px;
        font-size: 0.86rem;
      }
      .btn-lg {
        min-height: 48px;
        padding: 12px 24px;
        font-size: 1rem;
        border-radius: 12px;
      }

      /* Commands with a copy button: a terminal line in both page themes. */
      .cmd {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        max-width: 100%;
        min-width: 0;
        padding: 6px 6px 6px 16px;
        border-radius: 12px;
        background: #10131a;
        border: 1px solid #2c3242;
        color: #e9ecf2;
        font-family: var(--font-mono);
        font-size: 0.9rem;
        box-shadow: var(--shadow-sm);
      }
      .cmd code {
        font-family: inherit;
        white-space: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .cmd .prompt {
        color: #7ee0a0;
        user-select: none;
      }
      .cmd-lg {
        font-size: 1rem;
        padding: 8px 8px 8px 18px;
      }
      .copy-btn {
        appearance: none;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 11px;
        border-radius: 8px;
        border: 1px solid #3a4253;
        background: #1b1f2a;
        color: #e9ecf2;
        font-family: var(--font-ui);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition:
          background-color 120ms ease,
          border-color 120ms ease,
          color 120ms ease;
      }
      .copy-btn:hover {
        background: #262b38;
        border-color: #576075;
      }
      .copy-btn.copied {
        color: #7ee0a0;
        border-color: #3e7a55;
      }

      /* Sections, tiles, chips and tabs */
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        color: var(--accent);
      }
      .grad-text {
        background: var(--grad);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .section {
        padding-block: clamp(56px, 8vw, 104px);
        scroll-margin-top: var(--header-h);
      }
      .section-head {
        max-width: 720px;
        margin: 0 auto 44px;
        text-align: center;
        display: grid;
        gap: 12px;
        justify-items: center;
      }
      .section-head h2 {
        margin: 0;
        font-size: clamp(1.75rem, 3.4vw, 2.5rem);
        letter-spacing: -0.03em;
        text-wrap: balance;
      }
      .section-head p {
        margin: 0;
        color: var(--muted);
        font-size: 1.08rem;
        text-wrap: pretty;
      }
      .tile {
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 24px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        min-width: 0;
        transition:
          border-color 160ms ease,
          box-shadow 160ms ease,
          transform 160ms ease;
      }
      a.tile {
        color: inherit;
        text-decoration: none;
      }
      .tile:hover {
        border-color: var(--line-strong);
        box-shadow: var(--shadow-md);
      }
      a.tile:hover {
        transform: translateY(-2px);
      }
      .tile h3 {
        margin: 0;
        font-size: 1.1rem;
      }
      .tile p {
        margin: 0;
        color: var(--muted);
      }
      .tile p code,
      .section-head code {
        font-family: var(--font-mono);
        font-size: 0.88em;
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 1px 6px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 4px 13px;
        border-radius: var(--radius-pill);
        border: 1px solid var(--line-strong);
        background: var(--surface);
        color: var(--fg);
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition:
          border-color 120ms ease,
          background-color 120ms ease,
          color 120ms ease;
      }
      .chip:hover {
        border-color: var(--accent);
      }
      .chip[aria-pressed="true"] {
        border-color: var(--accent);
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 600;
      }
      .swatch {
        display: inline-flex;
      }
      .swatch i {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        box-shadow: 0 0 0 1.5px var(--surface);
      }
      .swatch i + i {
        margin-left: -3px;
      }
      .tabs {
        display: inline-flex;
        gap: 2px;
        padding: 3px;
        border-radius: 11px;
        background: var(--surface-2);
        border: 1px solid var(--line);
      }
      .tab {
        appearance: none;
        min-height: 32px;
        padding: 4px 14px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--muted);
        font-family: inherit;
        font-size: 0.86rem;
        font-weight: 600;
        cursor: pointer;
      }
      .tab:hover {
        color: var(--fg);
      }
      .tab[aria-selected="true"],
      .tab[aria-pressed="true"] {
        background: var(--surface);
        color: var(--fg);
        box-shadow: var(--shadow-sm), inset 0 0 0 1px var(--line);
      }

      /* Segmented radios */
      .seg {
        display: inline-flex;
        flex-wrap: wrap;
        border: 1px solid var(--line-strong);
        border-radius: 10px;
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
        padding: 6px 12px;
        font-size: 0.84rem;
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

      /* Terminal window frame */
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
        padding: 9px 14px;
        background: var(--term-dark-chrome);
        border-bottom: 1px solid var(--term-dark-border);
        color: #9da5b4;
        font-family: var(--font-mono);
        font-size: 0.75rem;
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
        gap: 7px;
        flex-shrink: 0;
      }
      .term-dot {
        width: 11px;
        height: 11px;
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
        padding: 14px 16px 16px;
        overflow-x: auto;
        container-type: inline-size;
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
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.7;
        margin-top: 6px;
      }
      .term-label:first-child {
        margin-top: 0;
      }
      /* At least as wide as the box, so a bar's marked gaps can stretch to it. */
      .screen {
        font-family: var(--font-mono);
        font-size: 13px;
        white-space: pre;
        width: max-content;
        min-width: 100%;
        contain: layout style;
      }
      .ln {
        height: 1.45em;
        line-height: 1.45em;
      }
      .ln.flex {
        display: flex;
      }
      .gap {
        flex: 1 0 auto;
      }
      /* A bar with gaps (ansi.js sets --cols, the columns it needs) shrinks to
         fit a narrow box, down to 10px; below that the box scrolls. */
      .ln.fit {
        font-size: clamp(10px, calc(100cqi / (var(--cols) * 0.61)), 13px);
      }
      .r,
      .g,
      .wc {
        display: inline-block;
        height: 1.45em;
        vertical-align: top;
      }
      .wc {
        text-align: center;
      }
      /* One column, like the glyph in a terminal font. */
      .g {
        width: 1ch;
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

// The languages the home page is published in, each named in itself. Every
// page's footer links to the home page in each of the others.
const SITE_LANGUAGES = [
  { lang: "en", href: "/", label: "English", locale: "en_US" },
  { lang: "fr", href: "/fr/", label: "Français", locale: "fr_FR" },
  { lang: "es", href: "/es/", label: "Español", locale: "es_ES" },
];
const siteLanguage = (lang) => SITE_LANGUAGES.find((l) => l.lang === lang) || SITE_LANGUAGES[0];

// The site's text that isn't page content, per language. The bar's own text
// stays in English (AGENTS.md); only the page around it is translated.
const CHROME_TEXT = {
  en: {
    skip: "Skip to content",
    pageTheme: "Page theme",
    language: "Language",
    system: "System",
    light: "Light",
    dark: "Dark",
    menu: "Menu",
    nav: { install: "Install", docs: "Docs", themes: "Themes", configurator: "Configurator" },
    getStarted: "Get started",
    github: "agy-powerline on GitHub",
    tagline:
      "The agy statusline for Google Antigravity CLI. Free and open source, with no telemetry.",
    product: "Product",
    docs: "Docs",
    project: "Project",
    footerNote: "MIT License · Every bar on this site is drawn by the real statusline code",
    copy: "Copy",
    copied: "Copied",
    copiedStatus: "Copied to the clipboard",
    copyCode: "Copy the code",
  },
  fr: {
    skip: "Aller au contenu",
    pageTheme: "Thème de la page",
    language: "Langue",
    system: "Système",
    light: "Clair",
    dark: "Sombre",
    menu: "Menu",
    nav: {
      install: "Installation",
      docs: "Docs",
      themes: "Thèmes",
      configurator: "Configurateur",
    },
    getStarted: "Commencer",
    github: "agy-powerline sur GitHub",
    tagline: "La statusline agy pour Google Antigravity CLI. Libre et gratuite, sans télémétrie.",
    product: "Produit",
    docs: "Docs",
    project: "Projet",
    footerNote:
      "Licence MIT · Chaque barre de ce site est dessinée par le vrai code de la statusline",
    copy: "Copier",
    copied: "Copié",
    copiedStatus: "Copié dans le presse-papiers",
    copyCode: "Copier le code",
  },
  es: {
    skip: "Ir al contenido",
    pageTheme: "Tema de la página",
    language: "Idioma",
    system: "Sistema",
    light: "Claro",
    dark: "Oscuro",
    menu: "Menú",
    nav: {
      install: "Instalación",
      docs: "Docs",
      themes: "Temas",
      configurator: "Configurador",
    },
    getStarted: "Empezar",
    github: "agy-powerline en GitHub",
    tagline: "La statusline de agy para Google Antigravity CLI. Libre y gratuita, sin telemetría.",
    product: "Producto",
    docs: "Docs",
    project: "Proyecto",
    footerNote: "Licencia MIT · Cada barra de este sitio la dibuja el código real de la statusline",
    copy: "Copiar",
    copied: "Copiado",
    copiedStatus: "Copiado al portapapeles",
    copyCode: "Copiar el código",
  },
};

// Every page links to every other page from the footer: it helps crawling and
// tells search engines which pages matter (sitelinks). Column titles aren't
// headings, so a page's own headings are the only ones in its outline.
const FOOTER_COLUMNS = [
  {
    key: "product",
    links: [
      ["Themes", "/themes/"],
      ["Configurator", "/configure/"],
      ["Install", "/install/"],
      ["Quota calculator", "/quota-calculator/"],
      ["Changelog", "/changelog/"],
    ],
  },
  {
    key: "docs",
    links: [
      ["Docs", "/docs/"],
      ["Configuration", "/docs/configuration/"],
      ["Widgets", "/widgets/"],
      ["Troubleshooting", "/troubleshooting/"],
      ["Payload reference", "/docs/payload/"],
      ["Guides", "/guides/"],
      ["FAQ", "/faq/"],
    ],
  },
  {
    key: "project",
    links: [
      ["About", "/about/"],
      ["Security", "/security/"],
      ["Privacy", "/privacy/"],
      ["License (MIT)", `${REPO_URL}/blob/main/LICENSE`],
      ["npm", NPM_URL],
      ["Report an issue", `${REPO_URL}/issues`],
    ],
  },
];

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
    <meta name="application-name" content="agy-powerline" />${urlTags}${alternateTags}
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
            <summary class="lang-btn" aria-label="${esc(text.language)}: ${esc(current.label)}" title="${esc(text.language)}">${flag(current.lang)}<span class="lang-code">${current.lang.toUpperCase()}</span></summary>
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
    <!-- Nothing loads from other sites: the page is its own inline style and script. -->
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
