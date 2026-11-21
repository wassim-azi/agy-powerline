// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const repo = path.join(__dirname, "..", "..");
const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const { WIDGET_CATALOG } = require(path.join(repo, "src/lib/catalog"));
const { WIDGET_TAGS } = require(path.join(repo, "src/lib/widget-style"));
const { ansiToHtml } = require("./ansi");
const { styleClasses } = require("./style-classes");
const { esc, absoluteUrl } = require("./layout");
const {
  GUIDES,
  CRUMB_HOME,
  CRUMB_DOCS,
  CRUMB_GUIDES,
  docPage,
  collectionStructuredData,
} = require("./pages-config");

const FAKE_DIR = "/home/you/projects/agy-powerline";

function cardList(items) {
  return `<ul class="card-grid">${items
    .map(
      ([href, title, text]) =>
        `<li><a class="card-link" href="${href}"><strong>${esc(title)}</strong><span>${esc(text)}</span></a></li>`
    )
    .join("")}</ul>`;
}

function docsIndexPage() {
  const body = `<h1>agy-powerline docs</h1>
        <p class="lede">Everything about the agy statusline for Google Antigravity CLI: installing it, every setting, every widget, and what to do when something goes wrong.</p>
        <h2 id="start">Start here</h2>
        ${cardList([
          [
            "/install/",
            "Install",
            "What npx agy-powerline does, the plugin route, no-npm installs, WSL, upgrades.",
          ],
          [
            "/docs/configuration/",
            "Configuration",
            "Every setting: widget options, pace marker, meters, thresholds, themes.",
          ],
          ["/widgets/", "Widgets", "Every widget with a live preview and its config line."],
          [
            "/troubleshooting/",
            "Troubleshooting",
            "doctor, common problems, reporting a bug safely.",
          ],
        ])}
        <h2 id="reference">Reference</h2>
        ${cardList([
          [
            "/docs/payload/",
            "Payload reference",
            "What Antigravity CLI sends to a status line, field by field.",
          ],
          ["/faq/", "FAQ", "Short answers to the common questions."],
          ["/security/", "Security", "What runs on your machine, and what it reads and writes."],
          ["/changelog/", "Changelog", "Release notes for every version."],
          [
            "/schema/v1.json",
            "Config schema",
            "JSON Schema for statusline.config.json, for editors.",
          ],
          ["/llms.txt", "llms.txt", "Site index and assistant rules in Markdown."],
          ["/llms-full.txt", "llms-full.txt", "All documentation in a single Markdown file."],
        ])}
        <h2 id="guides">Guides</h2>
        ${cardList(GUIDES.map((g) => [`/${g.path}`, g.name, g.description]))}
        <h2 id="tools">Tools</h2>
        ${cardList([
          ["/configure/", "Configurator", "Build your bar in the browser with a live preview."],
          ["/quota-calculator/", "Quota pace calculator", "Will your quota last until it resets?"],
          ["/themes/", "Theme gallery", "Every theme on dark and light terminals."],
        ])}`;
  const description =
    "Documentation for agy-powerline, the agy statusline for Google Antigravity CLI: install, configuration, widgets, troubleshooting, payload reference and guides.";
  return {
    path: "docs/",
    sources: ["scripts/site/build.js", "scripts/site/generated-pages.js"],
    card: { title: "Everything about the agy statusline", label: "Docs" },
    html: docPage({
      path: "docs/",
      title: "agy-powerline docs - agy statusline documentation",
      description,
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_DOCS],
      currentPage: "docs",
      toc: false,
      structuredData: collectionStructuredData({
        name: "agy-powerline docs",
        description,
        path: "docs/",
      }),
    }),
  };
}

function guidesIndexPage() {
  const body = `<h1>Guides</h1>
        <p class="lede">Step-by-step guides for Antigravity CLI's status bar: reading your quotas, setting up a status line, fixing symbols, and running a workshop.</p>
        <h2 id="all-guides">All guides</h2>
        ${cardList(GUIDES.map((g) => [`/${g.path}`, g.name, g.description]))}
        <p>Looking for every setting instead? See the <a href="/docs/">docs</a>.</p>`;
  const description =
    "Guides for Antigravity CLI's status bar: see your quota while you work, add a status line to agy, fix powerline symbols, move from Gemini CLI, run a workshop.";
  return {
    path: "guides/",
    sources: GUIDES.map((g) => g.source),
    card: { title: "Guides for Antigravity CLI's status bar", label: "Guides" },
    html: docPage({
      path: "guides/",
      title: "agy statusline guides - agy-powerline",
      description,
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_GUIDES],
      currentPage: "docs",
      toc: false,
      structuredData: collectionStructuredData({
        name: "agy statusline guides",
        description,
        path: "guides/",
        items: GUIDES.map((g) => ({ name: g.name, url: absoluteUrl(g.path) })),
      }),
    }),
  };
}

// Widgets that read the machine the site is built on (or its agy data) get no
// preview: it would show the build machine, not an example.
const NO_PREVIEW = new Set([
  "os",
  "host",
  "ram",
  "clock",
  "tokensToday",
  "tokensWeek",
  "tokensMonth",
]);
const PREVIEW_OPTIONS = {
  customText: { text: "Production" },
  exec: { cmd: "echo deploy" },
  env: { var: "NODE_ENV" },
};

function widgetPreview(id, styles) {
  if (NO_PREVIEW.has(id) || id === "separator" || id === "lineBreak") return "";
  const data = sampleData();
  data.cwd = FAKE_DIR;
  data.workspace = { current_dir: FAKE_DIR, project_dir: FAKE_DIR };
  data.terminal_width = 96;
  const config = {
    ...defaultConfig(),
    rowGap: true,
    widgets: [{ id, ...(PREVIEW_OPTIONS[id] || {}) }],
  };
  const out = renderStatusline(data, config, {
    color: "truecolor",
    flexGaps: true,
    env: id === "env" ? { NODE_ENV: "production" } : {},
  });
  if (!out.replace(/\x1b\[[0-9;]*m/g, "").trim()) return "";
  return `<div class="screen-wrap"><div class="term-frame" data-bg="dark"><div class="term" data-bg="dark"><div class="screen">${ansiToHtml(out, { styles })}</div></div></div></div>`;
}

function widgetsPage() {
  const widgets = WIDGET_CATALOG.filter((w) => w.id !== "separator" && w.id !== "lineBreak");
  const layoutHelpers = WIDGET_CATALOG.filter((w) => w.id === "separator" || w.id === "lineBreak");
  const styles = styleClasses();
  const sentence = (text) => {
    const s = String(text || "");
    return s ? `${s[0].toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? "" : "."}` : "";
  };
  const sections = widgets
    .map((w) => {
      const tag = WIDGET_TAGS[w.id] || {};
      const options = PREVIEW_OPTIONS[w.id]
        ? `, ${JSON.stringify(PREVIEW_OPTIONS[w.id]).slice(1, -1).replace(/,/g, ", ").replace(/:/g, ": ")}`
        : "";
      return `<section class="widget" aria-labelledby="${esc(w.id)}">
          <h2 id="${esc(w.id)}">${tag.icon ? `<span aria-hidden="true">${esc(tag.icon)}</span> ` : ""}${esc(w.label)} <code>${esc(w.id)}</code></h2>
          <p>${esc(sentence(w.description))}</p>
          ${widgetPreview(w.id, styles)}
          <pre tabindex="0"><code>{ "id": "${esc(w.id)}"${esc(options)} }</code></pre>
        </section>`;
    })
    .join("\n        ");
  const body = `<h1>agy statusline widgets</h1>
        <p class="lede">agy-powerline has ${widgets.length} widgets. Each preview below is drawn by the real statusline code from sample data; widgets that read your machine (operating system, user and host, RAM, clock, token totals) have none. Add any of them with <code>npx agy-powerline</code>, in the <a href="/configure/">browser configurator</a>, or with its line in <code>statusline.config.json</code>. Widget options are in <a href="/docs/configuration/#widget-options">Configuration</a>.</p>
        <nav aria-label="Widgets"><p>${widgets.map((w) => `<a href="#${esc(w.id)}"><code>${esc(w.id)}</code></a>`).join(" ")}</p></nav>
        ${sections}
        <section aria-labelledby="layout-helpers">
          <h2 id="layout-helpers">Layout helpers</h2>
          <ul>${layoutHelpers.map((w) => `<li><code>${esc(w.id)}</code>: ${esc(w.description)}</li>`).join("")}</ul>
        </section>`;
  const description =
    "Every widget of the agy-powerline statusline for Antigravity CLI, with a live preview: model, quotas with pace markers, context, git, tokens and more.";
  return {
    path: "widgets/",
    sources: ["src/lib/widgets.js", "src/lib/catalog.js", "src/lib/widget-style.js"],
    card: {
      title: `All ${widgets.length} agy statusline widgets, with previews`,
      label: "Widgets",
    },
    html: docPage({
      path: "widgets/",
      title: "agy statusline widgets - every agy-powerline widget",
      description,
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_DOCS, { name: "Widgets", path: "widgets/" }],
      currentPage: "docs",
      toc: false,
      structuredData: collectionStructuredData({
        name: "agy statusline widgets",
        description,
        path: "widgets/",
        items: widgets.map((w) => ({ name: w.id, url: absoluteUrl(`widgets/#${w.id}`) })),
      }),
      extraCss: `
      .widget pre {
        margin-top: 0;
      }
      .widget .term {
        padding: 10px 12px;
      }
${styles.css()}`,
    }),
  };
}

function calculatorPage() {
  const paceCode = fs.readFileSync(path.join(__dirname, "quota-pace.js"), "utf8");
  const body = `<h1>Antigravity quota pace calculator</h1>
        <p class="lede">Will your Antigravity CLI quota last until it resets? Enter how much is left and the time until the reset, as agy-powerline's bar or agy shows them. Everything runs in your browser.</p>
        <form class="calc" id="calc" novalidate>
          <fieldset class="calc-field">
            <legend>Quota window</legend>
            <label><input type="radio" name="window" value="5h" checked /> 5 hours</label>
            <label><input type="radio" name="window" value="7d" /> 7 days</label>
          </fieldset>
          <label class="calc-field">Quota left (%)
            <input type="number" id="left" min="0" max="100" step="0.1" value="72" inputmode="decimal" />
          </label>
          <fieldset class="calc-field calc-time">
            <legend>Resets in</legend>
            <label>Days <input type="number" id="days" min="0" max="7" step="1" value="0" inputmode="numeric" /></label>
            <label>Hours <input type="number" id="hours" min="0" max="167" step="1" value="2" inputmode="numeric" /></label>
            <label>Minutes <input type="number" id="minutes" min="0" max="59" step="1" value="47" inputmode="numeric" /></label>
          </fieldset>
        </form>
        <div class="calc-result" id="result" role="status" aria-live="polite">
          <div class="meter" aria-hidden="true"><div class="meter-used" id="meterUsed"></div><div class="meter-pace" id="meterPace"></div></div>
          <p class="calc-verdict" id="verdict">With 72% of a 5-hour quota left and 2hr 47m to the reset, it lasts until the reset at this pace.</p>
          <ul class="calc-facts" id="facts"></ul>
        </div>
        <h2 id="how-it-works">How it works</h2>
        <p>A quota window has a fixed length: 5 hours or 7 days. The time left until the reset tells how far into the window you are; with 2 hours left of a 5-hour window, 60% of it has passed. If you've used more of the quota than that share of time, you're using it faster than time passes, and at that pace it runs out before it resets.</p>
        <p>The calculator assumes you keep the pace you've had since the window started. The bar below the inputs is the same as agy-powerline's quota meter: the filled part is the quota used, and the marker is where you are in the window. Fill past the marker means trouble.</p>
        <h2 id="in-your-terminal">See it live in your terminal</h2>
        <p>agy-powerline draws this meter for every quota in agy's status bar and keeps it up to date while you work, with a caution color at 30% left and a danger color at 10%. Install it with <code>npx agy-powerline</code> and read the <a href="/guides/antigravity-quota/">quota guide</a>.</p>`;
  const script = `${paceCode}
(function () {
  const P = window.AgyQuotaPace;
  const form = document.getElementById("calc");
  const verdict = document.getElementById("verdict");
  const facts = document.getElementById("facts");
  const used = document.getElementById("meterUsed");
  const pace = document.getElementById("meterPace");
  const num = (id) => Number(document.getElementById(id).value || 0);
  const pct = (n) => (Math.round(n * 10) / 10).toLocaleString("en") + "%";
  function update() {
    const win = form.querySelector('input[name="window"]:checked').value;
    const resetIn = num("days") * 86400 + num("hours") * 3600 + num("minutes") * 60;
    const r = P.quotaPace({ window: win, leftPct: num("left"), resetIn: resetIn });
    facts.textContent = "";
    if (r.error) {
      verdict.textContent = r.error;
      used.style.width = "0";
      pace.style.left = "0";
      return;
    }
    used.style.width = Math.min(100, r.usedPct) + "%";
    pace.style.left = Math.min(100, r.elapsedPct) + "%";
    const name = win === "5h" ? "5-hour" : "7-day";
    const head = "With " + pct(r.leftPct) + " of a " + name + " quota left and " + P.formatDuration(r.resetIn) + " to the reset, ";
    if (r.status === "empty") {
      verdict.textContent = head + "it has run out until the reset.";
    } else if (r.lasts) {
      verdict.textContent = head + "it lasts until the reset at this pace, with about " + pct(r.leftAtReset) + " left then.";
    } else {
      verdict.textContent = head + "it runs out in about " + P.formatDuration(r.runsOutIn) + ", " + P.formatDuration(r.resetIn - r.runsOutIn) + " before the reset.";
    }
    const items = [
      pct(r.elapsedPct) + " of the window has passed; you've used " + pct(r.usedPct) + " of the quota.",
      "To last until the reset, use at most " + pct(r.budgetPerHour) + " of the quota per hour from now on.",
    ];
    if (r.ratio) items.unshift("You're using quota " + (Math.round(r.ratio * 100) / 100).toLocaleString("en") + "× as fast as time passes.");
    for (const text of items) {
      const li = document.createElement("li");
      li.textContent = text;
      facts.appendChild(li);
    }
  }
  form.addEventListener("input", update);
  form.addEventListener("submit", (e) => e.preventDefault());
  update();
})();`;
  return {
    path: "quota-calculator/",
    sources: ["scripts/site/quota-pace.js"],
    card: { title: "Will your Antigravity quota last until it resets?", label: "Calculator" },
    html: docPage({
      path: "quota-calculator/",
      title: "Antigravity quota pace calculator - will your quota last?",
      description:
        "Enter how much of your Antigravity CLI 5-hour or 7-day quota is left and when it resets: see whether it lasts until the reset, or when it runs out at your pace.",
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, { name: "Quota calculator", path: "quota-calculator/" }],
      currentPage: "",
      toc: false,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Antigravity quota pace calculator",
        url: absoluteUrl("quota-calculator/"),
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any (runs in the browser)",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      script,
      extraCss: `
      .calc {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 14px;
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        background: var(--surface);
        margin-bottom: 16px;
      }
      .calc-field {
        display: grid;
        gap: 6px;
        border: 0;
        margin: 0;
        padding: 0;
        font-weight: 600;
        font-size: 0.9rem;
        min-width: 0;
      }
      .calc-field legend {
        padding: 0;
        margin-bottom: 6px;
      }
      .calc-field label {
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .calc-time {
        grid-column: 1 / -1;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .calc-time label {
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
      }
      .calc input[type="number"] {
        width: 100%;
        max-width: 140px;
        padding: 6px 8px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        background: var(--bg);
        color: var(--fg);
        font: inherit;
      }
      .calc-result {
        padding: 16px;
        border: 1px solid var(--accent);
        border-radius: var(--radius-md);
        background: var(--accent-soft);
        margin-bottom: 24px;
      }
      .meter {
        position: relative;
        height: 14px;
        border-radius: var(--radius-pill);
        background: var(--term-dark-bg);
        overflow: hidden;
        margin-bottom: 12px;
      }
      .meter-used {
        position: absolute;
        inset: 0 auto 0 0;
        width: 28%;
        background: #73c991;
      }
      .meter-pace {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 44%;
        width: 4px;
        margin-left: -2px;
        background: #ffffff;
        box-shadow: 0 0 0 1px #16161c;
      }
      .calc-verdict {
        font-size: 1.05rem;
        font-weight: 600;
        color: var(--fg);
      }
      .calc-facts {
        margin: 0;
      }`,
    }),
  };
}

module.exports = {
  docsIndexPage,
  guidesIndexPage,
  widgetsPage,
  calculatorPage,
};
