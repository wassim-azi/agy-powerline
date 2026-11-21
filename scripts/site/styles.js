// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const FONT_URL = "/fonts/inter-latin.woff2";

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
      /* CJK has no spaces: a heading wraps between phrases, not inside a
         word (browsers without auto-phrase wrap as before). */
      :lang(ja) :is(h1, h2, h3),
      :lang(zh-CN) :is(h1, h2, h3) {
        word-break: auto-phrase;
      }
      :lang(ko) :is(h1, h2, h3) {
        word-break: keep-all;
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
      .flag-ja {
        background-image: url("/img/flag-ja.png");
      }
      .flag-zh-CN {
        background-image: url("/img/flag-zh-CN.png");
      }
      .flag-ko {
        background-image: url("/img/flag-ko.png");
      }
      .flag-de {
        background-image: url("/img/flag-de.png");
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

module.exports = {
  FONT_URL,
  DARK_TOKENS,
  LIGHT_TOKENS,
  SHARED_CSS,
};
