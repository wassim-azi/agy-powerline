// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { buildDocPage } = require("./doc-page");
const { SITE_URL, absoluteUrl } = require("./layout");

// Repo files with a page of their own, and the site path each one gets.
const MARKDOWN_PAGES = [
  {
    source: "docs/install.md",
    card: { title: "Install the agy statusline in one command", label: "Install" },
    path: "install/",
    nav: "install",
    parent: "docs",
    schema: "TechArticle",
    name: "Install",
    title: "Install agy-powerline - agy statusline setup",
    description:
      "Install agy-powerline with npx agy-powerline to wire settings.json and open the editor, or install via agy plugin, without npm, on WSL, upgrade or remove it.",
  },
  {
    source: "docs/configuration.md",
    card: { title: "Every agy-powerline setting, explained", label: "Docs" },
    path: "docs/configuration/",
    parent: "docs",
    schema: "TechArticle",
    name: "Configuration",
    title: "agy-powerline configuration - widgets, themes and options",
    description:
      "Every agy-powerline setting: 16 bar-wide options, quota pace and forecasts, budgets, compaction limits, git links, fish paths, meters, gradients and themes.",
  },
  {
    source: "docs/troubleshooting.md",
    path: "troubleshooting/",
    parent: "docs",
    schema: "TechArticle",
    name: "Troubleshooting",
    title: "Troubleshooting the agy statusline - agy-powerline",
    description:
      "Fix agy-powerline: run doctor, broken glyphs, a bar gone after a Node upgrade, config errors, Windows install paths, and how to report a bug safely.",
  },
  {
    source: "docs/payload.md",
    card: { title: "What Antigravity CLI sends to your status line", label: "Reference" },
    path: "docs/payload/",
    parent: "docs",
    schema: "TechArticle",
    name: "Payload reference",
    title: "What Antigravity CLI sends to a status line (payload)",
    description:
      "Every JSON field Antigravity CLI (agy) pipes to a status line: model, context window, quota buckets, cost, agent state, queue, subagents, git and sandbox.",
  },
  {
    source: "docs/faq.md",
    card: { title: "agy statusline questions, answered", label: "FAQ" },
    path: "faq/",
    schema: "FAQPage",
    name: "FAQ",
    title: "agy-powerline FAQ - agy statusline questions",
    description:
      "Answers about the agy-powerline statusline for Antigravity CLI: Windows support, privacy, restarts, speed, quotas, missing symbols, updates and removal.",
  },
  {
    source: "SECURITY.md",
    card: { title: "What agy-powerline does on your machine", label: "Security" },
    path: "security/",
    schema: "TechArticle",
    name: "Security",
    title: "Security and privacy of agy-powerline",
    description:
      "What the agy-powerline statusline does on your machine: no network calls or telemetry, the processes it starts, the files it reads and writes, exec safeguards.",
  },
  {
    source: "CHANGELOG.md",
    card: { title: "What's new in agy-powerline", label: "Changelog" },
    path: "changelog/",
    parent: "docs",
    schema: "WebPage",
    name: "Changelog",
    title: "agy-powerline changelog - release notes",
    description:
      "Release notes for every version of agy-powerline for Google Antigravity CLI: new widgets, bar settings, quota forecasts, themes, languages, commands and fixes.",
  },
  {
    source: "scripts/site/content/about.md",
    path: "about/",
    schema: "ProfilePage",
    name: "About",
    edit: false,
    // The share card keeps the short name; the tab and search title say what it is.
    card: { title: "About agy-powerline", label: "About" },
    title: "About agy-powerline - the open-source agy statusline",
    description:
      "Who builds agy-powerline, the open-source agy statusline for Google Antigravity CLI, its principles (no dependencies, no telemetry) and its contributors.",
  },
  {
    source: "scripts/site/content/privacy.md",
    card: { title: "Analytics on the website, none in the tool", label: "Privacy" },
    path: "privacy/",
    schema: "WebPage",
    name: "Privacy",
    edit: false,
    title: "Privacy - agy-powerline",
    description:
      "agy-powerline.com uses Google Analytics to count visits; the statusline and the CLI make no network calls and have no analytics. What is collected, and where.",
  },
];

const GUIDES = [
  {
    source: "docs/guides/antigravity-quota.md",
    path: "guides/antigravity-quota/",
    name: "See your Antigravity quota while you work",
    title: "See your Antigravity quota while you work - agy-powerline",
    description:
      "Read Antigravity CLI's 5h and 7d quotas in agy's status bar as left or used, with pace markers and run-out forecasts showing if a quota lasts.",
  },
  {
    source: "docs/guides/add-statusline-to-antigravity-cli.md",
    path: "guides/add-statusline-to-antigravity-cli/",
    name: "How to add a status line to Antigravity CLI",
    title: "How to add a status line to Antigravity CLI (agy)",
    description:
      "Set up agy's statusLine in settings.json: the one-command setup, the command on Windows, macOS and Linux, the JSON agy sends, and a minimal script of your own.",
  },
  {
    source: "docs/guides/nerd-font-symbols.md",
    path: "guides/nerd-font-symbols/",
    name: "Fix broken powerline symbols",
    title: "Fix broken powerline symbols in agy (Nerd Fonts)",
    description:
      "Boxes or question marks in agy's status bar? Install a Nerd Font in Windows Terminal, VS Code, macOS or Linux terminals, or switch agy-powerline to ASCII mode.",
  },
  {
    source: "docs/guides/moving-from-gemini-cli.md",
    path: "guides/moving-from-gemini-cli/",
    name: "Moving from Gemini CLI",
    title: "Moving from Gemini CLI to agy: customize the status bar",
    description:
      "Switching from Gemini CLI to Antigravity CLI? Set up agy's status bar with your model, Gemini quotas, context and git in about a minute with agy-powerline.",
  },
  {
    source: "docs/guides/workshop.md",
    path: "guides/workshop/",
    name: "Workshop: customize agy in 30 minutes",
    title: "Workshop: customize agy in 30 minutes - agy-powerline",
    description:
      "A free, ready-to-run 30-minute workshop for meetups and student groups: how agy's status bar works, installing one, reading quotas and making it your own.",
  },
];

// The pages a docs reader moves between: the sidebar of every text page, and
// the "Next steps" at the end of each one. [title, one line about it]
const LINKS = {
  "install/": ["Install", "One command, what it changes, upgrades and removal."],
  "docs/configuration/": ["Configuration", "Every setting, from widgets to themes."],
  "widgets/": ["Widgets", "Every widget, with a preview."],
  "settings/": ["Settings", "Global bar-wide options with live previews."],
  "troubleshooting/": ["Troubleshooting", "doctor, common problems, bug reports."],
  "docs/payload/": ["Payload reference", "What agy sends to a status line."],
  "faq/": ["FAQ", "Short answers to the common questions."],
  "security/": ["Security", "What runs on your machine."],
  "privacy/": ["Privacy", "Site analytics only, no telemetry in the tool."],
  "changelog/": ["Changelog", "Release notes for every version."],
  "about/": ["About", "Who builds it, and why."],
  "configure/": ["Configurator", "Build your bar in the browser."],
  "quota-calculator/": ["Quota calculator", "Will your quota last until it resets?"],
  "themes/": ["Themes", "Every theme on dark and light terminals."],
  "guides/antigravity-quota/": ["Antigravity quota", "Read your quotas and pace markers."],
  "guides/add-statusline-to-antigravity-cli/": [
    "Add a status line",
    "How agy runs a status line command.",
  ],
  "guides/nerd-font-symbols/": ["Powerline symbols", "Fix boxes and question marks."],
  "guides/moving-from-gemini-cli/": ["From Gemini CLI", "Set up agy's status bar in a minute."],
  "guides/workshop/": ["Workshop", "A 30-minute session for groups."],
};

const SIDEBAR = [
  ["Get started", ["install/", "docs/configuration/", "widgets/", "settings/", "troubleshooting/"]],
  [
    "Guides",
    [
      "guides/antigravity-quota/",
      "guides/add-statusline-to-antigravity-cli/",
      "guides/nerd-font-symbols/",
      "guides/moving-from-gemini-cli/",
      "guides/workshop/",
    ],
  ],
  ["Reference", ["docs/payload/", "faq/", "security/", "changelog/"]],
  ["Tools", ["configure/", "quota-calculator/", "themes/"]],
].map(([title, paths]) => ({ title, links: paths.map((p) => [`/${p}`, LINKS[p][0]]) }));

const NEXT_STEPS = {
  "install/": ["docs/configuration/", "guides/antigravity-quota/", "troubleshooting/"],
  "docs/configuration/": ["widgets/", "settings/", "configure/"],
  "troubleshooting/": ["guides/nerd-font-symbols/", "faq/", "install/"],
  "docs/payload/": ["guides/add-statusline-to-antigravity-cli/", "widgets/", "docs/configuration/"],
  "faq/": ["install/", "security/", "troubleshooting/"],
  "security/": ["privacy/", "faq/", "install/"],
  "changelog/": ["install/", "docs/configuration/", "themes/"],
  "about/": ["install/", "security/", "changelog/"],
  "privacy/": ["security/", "about/", "faq/"],
  "guides/antigravity-quota/": ["quota-calculator/", "docs/configuration/", "install/"],
  "guides/add-statusline-to-antigravity-cli/": ["docs/payload/", "install/", "docs/configuration/"],
  "guides/nerd-font-symbols/": ["troubleshooting/", "themes/", "docs/configuration/"],
  "guides/moving-from-gemini-cli/": ["install/", "guides/antigravity-quota/", "themes/"],
  "guides/workshop/": ["install/", "guides/antigravity-quota/", "configure/"],
  "widgets/": ["settings/", "docs/configuration/", "configure/"],
  "settings/": ["configure/", "docs/configuration/", "widgets/"],
  "quota-calculator/": ["guides/antigravity-quota/", "install/", "widgets/"],
};

// Every text page: the docs sidebar, and where to go next.
function docPage(options) {
  return buildDocPage({
    ...options,
    sidebar: SIDEBAR,
    next: (NEXT_STEPS[options.path] || []).map((p) => [`/${p}`, ...LINKS[p]]),
  });
}

// Every repo file that has a page, so links between them stay on the site.
const SITE_PATH_OF = Object.fromEntries([
  ["README.md", ""],
  ...[...MARKDOWN_PAGES, ...GUIDES].map((page) => [page.source, page.path]),
]);

const CRUMB_HOME = { name: "agy-powerline", path: "" };
const CRUMB_DOCS = { name: "Docs", path: "docs/" };
const CRUMB_GUIDES = { name: "Guides", path: "guides/" };

// What a page's share card shows: its title without the site name, and a
// label for the kind of page.
const cardTitle = (title) => title.replace(/ - agy-powerline$/, "");

function collectionStructuredData({ name, description, path: pagePath, items }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absoluteUrl(pagePath),
    inLanguage: "en",
    isPartOf: { "@id": `${SITE_URL}#website` },
    about: { "@id": `${SITE_URL}#app` },
    ...(items
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: items.length,
            itemListElement: items.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.name,
              url: item.url,
            })),
          },
        }
      : {}),
  };
}

module.exports = {
  MARKDOWN_PAGES,
  GUIDES,
  LINKS,
  SIDEBAR,
  NEXT_STEPS,
  SITE_PATH_OF,
  CRUMB_HOME,
  CRUMB_DOCS,
  CRUMB_GUIDES,
  docPage,
  cardTitle,
  collectionStructuredData,
};
