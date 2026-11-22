// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const repo = path.join(__dirname, "..", "..");
const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const {
  RESET_FORMAT_ORDER,
  ALIGNMENT_ORDER,
  OVERFLOW_ORDER,
  QUOTA_MODE_ORDER,
  DEFAULT_THRESHOLDS,
} = require(path.join(repo, "src/lib/config"));
const { WIDGET_CATALOG } = require(path.join(repo, "src/lib/catalog"));
const { WIDGET_TAGS, METER_STYLE_IDS } = require(path.join(repo, "src/lib/widget-style"));
const { GRADIENT_ORDER } = require(path.join(repo, "src/lib/themes"));
const { SUPPORTED_LANGUAGES } = require(path.join(repo, "src/lib/i18n"));
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
            "/settings/",
            "Settings",
            "Every bar-wide option (alignment, overflow, meters, thresholds) with live previews.",
          ],
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
    "agy-powerline documentation for Antigravity CLI: install, configuration, widgets, bar settings, payload reference, troubleshooting, security and guides.";
  return {
    path: "docs/",
    sources: ["scripts/site/build.js", "scripts/site/generated-pages.js"],
    card: { title: "Everything about the agy statusline", label: "Docs" },
    markdown: `# agy-powerline docs\n\nEverything about the agy statusline for Google Antigravity CLI.\n\n- [Install](https://agy-powerline.com/install/)\n- [Configuration](https://agy-powerline.com/docs/configuration/)\n- [Widgets](https://agy-powerline.com/widgets/)\n- [Settings](https://agy-powerline.com/settings/)\n- [Troubleshooting](https://agy-powerline.com/troubleshooting/)\n- [Payload reference](https://agy-powerline.com/docs/payload/)\n- [FAQ](https://agy-powerline.com/faq/)\n- [Guides](https://agy-powerline.com/guides/)\n`,
    html: docPage({
      path: "docs/",
      title: "agy-powerline docs - agy statusline documentation",
      description,
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_DOCS],
      currentPage: "docs",
      toc: false,
      alternateMarkdown: "docs/index.html.md",
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
    markdown: `# Guides\n\nStep-by-step guides for Antigravity CLI's status bar.\n\n${GUIDES.map((g) => `- [${g.name}](https://agy-powerline.com/${g.path}): ${g.description}`).join("\n")}\n`,
    html: docPage({
      path: "guides/",
      title: "agy statusline guides - agy-powerline",
      description,
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_GUIDES],
      currentPage: "docs",
      toc: false,
      alternateMarkdown: "guides/index.html.md",
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
  const description = `All ${widgets.length} agy-powerline widgets with live previews: quotas and forecasts, context, 30-day tokens, cost, agent state, queue, git links, env and commands.`;
  return {
    path: "widgets/",
    sources: ["src/lib/widgets.js", "src/lib/catalog.js", "src/lib/widget-style.js"],
    card: {
      title: `All ${widgets.length} agy statusline widgets, with previews`,
      label: "Widgets",
    },
    markdown: `# agy statusline widgets\n\nagy-powerline has ${widgets.length} widgets.\n\n${widgets.map((w) => `- \`${w.id}\` (${w.label}): ${sentence(w.description)}`).join("\n")}\n\n## Layout helpers\n\n${layoutHelpers.map((w) => `- \`${w.id}\`: ${w.description}`).join("\n")}\n`,
    html: docPage({
      path: "widgets/",
      title: "agy statusline widgets - every agy-powerline widget",
      description,
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_DOCS, { name: "Widgets", path: "widgets/" }],
      currentPage: "docs",
      toc: false,
      alternateMarkdown: "widgets/index.html.md",
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

function settingRenderData({ width = 96, remainingFiveHour, contextUsed } = {}) {
  const data = sampleData();
  data.cwd = FAKE_DIR;
  data.workspace = { current_dir: FAKE_DIR, project_dir: FAKE_DIR };
  data.terminal_width = width;
  if (remainingFiveHour !== undefined) {
    data.quota = {
      ...data.quota,
      "gemini-5h": { ...data.quota["gemini-5h"], remaining_fraction: remainingFiveHour },
    };
  }
  if (contextUsed !== undefined) {
    data.context_window = {
      ...data.context_window,
      used_percentage: contextUsed,
      remaining_percentage: 100 - contextUsed,
    };
  }
  return data;
}

function settingDemo(label, config, { width = 96, remainingFiveHour, contextUsed } = {}, styles) {
  const data = settingRenderData({ width, remainingFiveHour, contextUsed });
  const merged = { ...defaultConfig(), ...config };
  const out = renderStatusline(data, merged, { color: "truecolor", flexGaps: true });
  return `<div class="setting-demo">
            <div class="setting-demo-label">${esc(label)}</div>
            <div class="screen-wrap"><div class="term-frame" data-bg="dark"><div class="term" data-bg="dark"><div class="screen">${ansiToHtml(out, { styles })}</div></div></div></div>
          </div>`;
}

function settingsPage() {
  const styles = styleClasses();
  const baseRow = [
    { id: "model" },
    { id: "context" },
    { id: "git" },
    { id: "fiveHourBar" },
    { id: "fiveHourReset" },
  ];
  const entries = [
    {
      id: "language",
      key: "language",
      title: "Bar language",
      defaultVal: '"en"',
      options: SUPPORTED_LANGUAGES.join(", "),
      desc: "Translates labels, time units, and captions rendered inside the bar while keeping payload values intact.",
      snippet: '{\n  "language": "fr"\n}',
      demos: [
        settingDemo('language: "en" (default)', { language: "en", widgets: baseRow }, {}, styles),
        settingDemo('language: "fr"', { language: "fr", widgets: baseRow }, {}, styles),
      ],
    },
    {
      id: "clock-hour12",
      key: "clock.hour12",
      title: "Clock format",
      defaultVal: "null (auto)",
      options: "null (auto locale), false (24h), true (12h)",
      desc: "Controls 12-hour vs 24-hour formatting for exact reset timestamps and the clock widget.",
      snippet: '{\n  "resetFormat": "time",\n  "clock": { "hour12": false }\n}',
      demos: [
        settingDemo(
          "clock.hour12: true (12h)",
          { resetFormat: "time", clock: { hour12: true }, widgets: [{ id: "fiveHourReset" }] },
          {},
          styles
        ),
        settingDemo(
          "clock.hour12: false (24h)",
          { resetFormat: "time", clock: { hour12: false }, widgets: [{ id: "fiveHourReset" }] },
          {},
          styles
        ),
      ],
    },
    {
      id: "resetFormat",
      key: "resetFormat",
      title: "Reset format",
      defaultVal: '"countdown"',
      options: RESET_FORMAT_ORDER.join(", "),
      desc: "Sets the global default for reset countdown widgets unless overridden per widget with format.",
      snippet: '{\n  "resetFormat": "both"\n}',
      demos: RESET_FORMAT_ORDER.map((fmt) =>
        settingDemo(
          `resetFormat: "${fmt}"`,
          { resetFormat: fmt, widgets: [{ id: "fiveHourBar" }, { id: "fiveHourReset" }] },
          {},
          styles
        )
      ),
    },
    {
      id: "gradient",
      key: "gradient",
      title: "Bar gradient",
      defaultVal: "off (unset)",
      options: `off, ${GRADIENT_ORDER.join(", ")}, or "#hex1-#hex2"`,
      desc: "Sweeps one smooth color gradient across all pills on each row instead of per-widget slot colors.",
      snippet: '{\n  "gradient": "sunset"\n}',
      demos: [
        settingDemo("Theme colors (off)", { widgets: baseRow }, {}, styles),
        settingDemo('gradient: "aurora"', { gradient: "aurora", widgets: baseRow }, {}, styles),
        settingDemo('gradient: "sunset"', { gradient: "sunset", widgets: baseRow }, {}, styles),
      ],
    },
    {
      id: "meterStyle",
      key: "meterStyle",
      title: "Meter style",
      defaultVal: "layout default",
      options: METER_STYLE_IDS.join(", "),
      desc: "Overrides the meter glyph shape globally across quota and context widgets. Per-widget meter options still win.",
      snippet: '{\n  "meterStyle": "blocks"\n}',
      demos: [
        settingDemo(
          "meterStyle: blocks",
          { meterStyle: "blocks", widgets: [{ id: "fiveHourBar" }] },
          {},
          styles
        ),
        settingDemo(
          "meterStyle: shade",
          { meterStyle: "shade", widgets: [{ id: "fiveHourBar" }] },
          {},
          styles
        ),
        settingDemo(
          "meterStyle: pips",
          { meterStyle: "pips", widgets: [{ id: "fiveHourBar" }] },
          {},
          styles
        ),
        settingDemo(
          "meterStyle: cells (Pills)",
          { meterStyle: "cells", widgets: [{ id: "fiveHourBar" }] },
          {},
          styles
        ),
      ],
    },
    {
      id: "emojis",
      key: "emojis",
      title: "Emojis",
      defaultVal: "true",
      options: "true, false",
      desc: "Shows or hides widget icons globally across the bar. Disabled automatically while ascii is true.",
      snippet: '{\n  "emojis": false\n}',
      demos: [
        settingDemo("emojis: true (default)", { emojis: true, widgets: baseRow }, {}, styles),
        settingDemo("emojis: false", { emojis: false, widgets: baseRow }, {}, styles),
      ],
    },
    {
      id: "minimalist",
      key: "minimalist",
      title: "Minimalist mode",
      defaultVal: "false",
      options: "false, true",
      desc: "Displays raw values only while hiding labels and icons unless a widget explicitly configures a label.",
      snippet: '{\n  "minimalist": true\n}',
      demos: [
        settingDemo(
          "minimalist: false (default)",
          { minimalist: false, widgets: baseRow },
          {},
          styles
        ),
        settingDemo("minimalist: true", { minimalist: true, widgets: baseRow }, {}, styles),
      ],
    },
    {
      id: "pacing",
      key: "pacing",
      title: "Quota pace marker",
      defaultVal: "true",
      options: "true, false",
      desc: "Draws the elapsed-window marker inside quota meters so you can see whether usage outpaces the clock.",
      snippet: '{\n  "pacing": false\n}',
      demos: [
        settingDemo(
          "pacing: true (default)",
          { pacing: true, widgets: [{ id: "fiveHourBar" }] },
          {},
          styles
        ),
        settingDemo(
          "pacing: false",
          { pacing: false, widgets: [{ id: "fiveHourBar" }] },
          {},
          styles
        ),
      ],
    },
    {
      id: "thresholds",
      key: "thresholds",
      title: "Warning sensitivity & alert blink",
      defaultVal: `quota ${DEFAULT_THRESHOLDS.quotaWarn}%/${DEFAULT_THRESHOLDS.quotaCrit}%, context ${DEFAULT_THRESHOLDS.contextWarn}%/${DEFAULT_THRESHOLDS.contextCrit}%, blink false`,
      options:
        'quotaWarn, quotaCrit, contextWarn, contextCrit (0-100); blink: false (off), true (danger), "warn" (caution + danger)',
      desc: "Sets caution and danger color breakpoints for quotas and context, plus optional ANSI blink alerts.",
      snippet:
        '{\n  "thresholds": {\n    "quotaWarn": 40,\n    "quotaCrit": 20,\n    "contextWarn": 60,\n    "contextCrit": 80,\n    "blink": "warn"\n  }\n}',
      demos: [
        settingDemo(
          "Normal quota (72% rem)",
          { widgets: [{ id: "fiveHourBar" }, { id: "context" }] },
          { remainingFiveHour: 0.72, contextUsed: 42 },
          styles
        ),
        settingDemo(
          "Caution (22% rem / 75% ctx)",
          { widgets: [{ id: "fiveHourBar" }, { id: "context" }] },
          { remainingFiveHour: 0.22, contextUsed: 75 },
          styles
        ),
        settingDemo(
          "Danger (6% rem / 95% ctx)",
          { widgets: [{ id: "fiveHourBar" }, { id: "context" }] },
          { remainingFiveHour: 0.06, contextUsed: 95 },
          styles
        ),
      ],
    },
    {
      id: "rowGap",
      key: "rowGap",
      title: "Space between rows",
      defaultVal: "false",
      options: "false, true",
      desc: "Inserts a blank line between statusline rows so multi-row Pills or Lines layouts breathe cleanly.",
      snippet: '{\n  "rowGap": true\n}',
      demos: [
        settingDemo("rowGap: false (default)", { rowGap: false }, {}, styles),
        settingDemo("rowGap: true", { rowGap: true }, {}, styles),
      ],
    },
    {
      id: "maxWidth",
      key: "maxWidth",
      title: "Max bar width",
      defaultVal: 'null ("full")',
      options: '"full" / null, or positive integer columns (1..1000)',
      desc: "Caps bar width on wide monitors instead of stretching separators across the full terminal width.",
      snippet: '{\n  "maxWidth": 72\n}',
      demos: [
        settingDemo("maxWidth: full (96 cols terminal)", { maxWidth: null }, { width: 96 }, styles),
        settingDemo("maxWidth: 72 cols cap", { maxWidth: 72 }, { width: 96 }, styles),
      ],
    },
    {
      id: "alignment",
      key: "alignment",
      title: "Row alignment",
      defaultVal: '"left"',
      options: ALIGNMENT_ORDER.join(", "),
      desc: "Positions widgets horizontally on each row: left-aligned with explicit separators, centered, or evenly spread.",
      snippet: '{\n  "alignment": "center"\n}',
      demos: ALIGNMENT_ORDER.map((align) =>
        settingDemo(
          `alignment: "${align}"`,
          { alignment: align, widgets: [{ id: "model" }, { id: "context" }, { id: "git" }] },
          { width: 92 },
          styles
        )
      ),
    },
    {
      id: "quotaMode",
      key: "quotaMode",
      title: "Quota display",
      defaultVal: '"remaining"',
      options: QUOTA_MODE_ORDER.join(", "),
      desc: "Displays quota meters and percentages as remaining capacity (rem) or consumed usage (used).",
      snippet: '{\n  "quotaMode": "used"\n}',
      demos: QUOTA_MODE_ORDER.map((mode) =>
        settingDemo(
          `quotaMode: "${mode}"`,
          { quotaMode: mode, widgets: [{ id: "fiveHourBar" }, { id: "weeklyBar" }] },
          {},
          styles
        )
      ),
    },
    {
      id: "zeroFiveHourWhenWeeklyEmpty",
      key: "zeroFiveHourWhenWeeklyEmpty",
      title: "Zero 5h when 7d is 0%",
      defaultVal: "false",
      options: "false, true",
      desc: "Shows 0% remaining (100% used) on all 5-hour quota widgets whenever the matching 7-day quota is at 0%, even when Antigravity marks 3p-5h disabled.",
      snippet: '{\n  "zeroFiveHourWhenWeeklyEmpty": true\n}',
      demos: [
        settingDemo(
          "zeroFiveHourWhenWeeklyEmpty: false (default)",
          {
            zeroFiveHourWhenWeeklyEmpty: false,
            widgets: [{ id: "thirdPartyFiveHour" }, { id: "thirdPartyWeekly" }],
          },
          {},
          styles
        ),
        settingDemo(
          "zeroFiveHourWhenWeeklyEmpty: true",
          {
            zeroFiveHourWhenWeeklyEmpty: true,
            widgets: [{ id: "thirdPartyFiveHour" }, { id: "thirdPartyWeekly" }],
          },
          {},
          styles
        ),
      ],
    },
    {
      id: "overflow",
      key: "overflow",
      title: "Row overflow",
      defaultVal: '"fit"',
      options: OVERFLOW_ORDER.join(", "),
      desc: "Decides what happens on narrow terminals: fit shrinks labels and drops lower-priority items, while wrap keeps everything onto new rows.",
      snippet: '{\n  "overflow": "wrap"\n}',
      demos: OVERFLOW_ORDER.map((mode) =>
        settingDemo(`overflow: "${mode}" (54 cols)`, { overflow: mode }, { width: 54 }, styles)
      ),
    },
    {
      id: "ascii",
      key: "ascii",
      title: "ASCII mode",
      defaultVal: "false",
      options: "false, true",
      desc: "Replaces Nerd Font powerline caps, emojis, and Unicode box/meter glyphs with plain ASCII characters.",
      snippet: '{\n  "ascii": true\n}',
      demos: [
        settingDemo("ascii: false (default)", { ascii: false, widgets: baseRow }, {}, styles),
        settingDemo("ascii: true", { ascii: true, widgets: baseRow }, {}, styles),
      ],
    },
  ];

  const sections = entries
    .map(
      (s) => `<section class="widget" aria-labelledby="${esc(s.id)}">
          <h2 id="${esc(s.id)}">${esc(s.title)} <code>${esc(s.key)}</code></h2>
          <p>${esc(s.desc)}</p>
          <p class="setting-meta"><strong>Default:</strong> <code>${esc(s.defaultVal)}</code> · <strong>Options:</strong> ${esc(s.options)}</p>
          ${s.demos.join("\n          ")}
          <pre tabindex="0"><code>${esc(s.snippet)}</code></pre>
        </section>`
    )
    .join("\n        ");

  const body = `<h1>agy statusline settings</h1>
        <p class="lede">Every bar-wide option in <code>statusline.config.json</code> and the CLI <code>Settings</code> tab. Every bar below is rendered by the real statusline code from sample data. Try them interactively in the <a href="/configure/">browser configurator</a>.</p>
        <nav aria-label="Settings"><p>${entries.map((s) => `<a href="#${esc(s.id)}"><code>${esc(s.key)}</code></a>`).join(" ")}</p></nav>
        ${sections}`;
  const description = `All ${entries.length} bar-wide agy-powerline settings, with live previews: quotas as left or used, reset format, meter style, alignment, overflow and width.`;
  return {
    path: "settings/",
    sources: [
      "src/lib/config.js",
      "src/lib/widget-style.js",
      "src/lib/i18n.js",
      "scripts/site/generated-pages.js",
    ],
    card: {
      title: "Every global agy statusline setting, with previews",
      label: "Settings",
    },
    markdown: `# agy statusline settings\n\n${entries.map((s) => `## ${s.key}\n${s.desc}\n- Default: \`${s.defaultVal}\`\n- Options: ${s.options}`).join("\n\n")}\n`,
    html: docPage({
      path: "settings/",
      title: "agy statusline settings - every global option explained",
      description,
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_DOCS, { name: "Settings", path: "settings/" }],
      currentPage: "docs",
      toc: false,
      alternateMarkdown: "settings/index.html.md",
      structuredData: collectionStructuredData({
        name: "agy statusline settings",
        description,
        path: "settings/",
        items: entries.map((s) => ({ name: s.key, url: absoluteUrl(`settings/#${s.id}`) })),
      }),
      extraCss: `
      .setting-meta {
        font-size: 0.9rem;
        color: var(--muted);
      }
      .setting-demo {
        margin-bottom: 10px;
      }
      .setting-demo-label {
        font-size: 0.78rem;
        font-family: var(--font-mono);
        color: var(--muted);
        margin-bottom: 4px;
      }
      .widget pre {
        margin-top: 4px;
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
    markdown: `# Antigravity quota pace calculator\n\nCalculate whether your Antigravity CLI 5-hour or 7-day quota will last until its reset based on remaining percentage and time left.\n\nUse the interactive calculator at [agy-powerline.com/quota-calculator/](https://agy-powerline.com/quota-calculator/).\n`,
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
      alternateMarkdown: "quota-calculator/index.html.md",
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
  settingsPage,
  calculatorPage,
};
