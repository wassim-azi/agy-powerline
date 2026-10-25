"use strict";

// Builds the whole agy-powerline.com site into one folder: the home page (in
// English and French), the theme gallery, the configurator, the docs and
// guides from the repo's Markdown, the widget list, the quota calculator, the
// trust pages, and the files around them (sitemap, robots.txt, feed,
// llms.txt, font, images, share cards, schema). The sitemap lists exactly the
// indexable pages this build writes.
// Usage: npm run site [-- <dir>]   (default: ./_site)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repo = path.join(__dirname, "..", "..");
const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const { WIDGET_CATALOG } = require(path.join(repo, "src/lib/catalog"));
const { WIDGET_TAGS } = require(path.join(repo, "src/lib/widget-style"));
const { ansiToHtml } = require("./ansi");
const { renderMarkdown, stripTags } = require("./markdown");
const { buildDocPage } = require("./doc-page");
const { buildConfigSchema } = require("./config-schema");
const {
  REPO_URL,
  SITE_URL,
  esc,
  absoluteUrl,
  build404Html,
  buildSitemapXml,
  buildRobotsTxt,
  buildSecurityTxt,
  readFaviconSvg,
  cardPath,
  AUTHOR_URL,
  X_URL,
  LINKEDIN_URL,
} = require("./layout");
const {
  buildHomeHtml,
  buildThemesHtml,
  THEMES_PAGE,
  SCREENSHOTS,
  screenshotUrl,
  screenshotCopies,
  screenshotAttrs,
} = require("../gallery/build");
const { HOME_TEXT } = require("./home-text");
const { buildConfiguratorHtml } = require("../configurator/build");

// IndexNow (Bing, Yandex, Naver, Seznam): the key file at the site root proves
// the site is ours when .github/workflows/pages.yml announces changed pages.
// It is public by design.
const INDEXNOW_KEY = "fd008e145d1b3bc2d63c1ee54ac91e80";
const FAKE_DIR = "/home/you/projects/agy-powerline";

// Repo files with a page of their own, and the site path each one gets.
const MARKDOWN_PAGES = [
  {
    source: "docs/install.md",
    card: { title: "Install the agy statusline in one command", label: "Install" },
    path: "install/",
    nav: "install",
    parent: "docs",
    name: "Install",
    title: "Install agy-powerline - agy statusline setup",
    description:
      "Install the agy statusline with npx agy-powerline init: what init changes, the agy plugin route, installing without npm, WSL, upgrading and removing it.",
  },
  {
    source: "docs/configuration.md",
    card: { title: "Every agy-powerline setting, explained", label: "Docs" },
    path: "docs/configuration/",
    parent: "docs",
    name: "Configuration",
    title: "agy-powerline configuration - widgets, themes and options",
    description:
      "Every setting of the agy-powerline statusline: widget options, the quota pace marker, meter styles, thresholds, shell commands, powerline glyphs and themes.",
  },
  {
    source: "docs/troubleshooting.md",
    path: "troubleshooting/",
    parent: "docs",
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
    name: "Payload reference",
    title: "What Antigravity CLI sends to a status line (payload)",
    description:
      "Every field of the JSON Antigravity CLI (agy) pipes to a status line command, from real payloads: model, context window, quota buckets, git, sandbox and more.",
  },
  {
    source: "docs/faq.md",
    card: { title: "agy statusline questions, answered", label: "FAQ" },
    path: "faq/",
    name: "FAQ",
    title: "agy-powerline FAQ - agy statusline questions",
    description:
      "Answers about the agy-powerline statusline for Antigravity CLI: Windows support, privacy, restarts, speed, quotas, missing symbols, updates and removal.",
  },
  {
    source: "SECURITY.md",
    card: { title: "What agy-powerline does on your machine", label: "Security" },
    path: "security/",
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
    name: "Changelog",
    title: "agy-powerline changelog - release notes",
    description:
      "Release notes for every version of agy-powerline, the agy statusline for Google Antigravity CLI: new widgets, themes, commands and fixes.",
  },
  {
    source: "scripts/site/content/about.md",
    path: "about/",
    name: "About",
    edit: false,
    title: "About agy-powerline",
    description:
      "Who builds agy-powerline, the open-source agy statusline for Google Antigravity CLI, its principles (no dependencies, no telemetry) and its contributors.",
  },
  {
    source: "scripts/site/content/privacy.md",
    card: { title: "No cookies, no analytics, no telemetry", label: "Privacy" },
    path: "privacy/",
    name: "Privacy",
    edit: false,
    title: "Privacy - agy-powerline",
    description:
      "agy-powerline.com sets no cookies, has no analytics and loads nothing from other sites, and the statusline makes no network calls. What is stored, and where.",
  },
];

const GUIDES = [
  {
    source: "docs/guides/antigravity-quota.md",
    path: "guides/antigravity-quota/",
    name: "See your Antigravity quota while you work",
    title: "See your Antigravity quota while you work - agy-powerline",
    description:
      "Read Antigravity CLI's 5-hour and 7-day quotas in agy's status bar, with pace markers that show whether a quota lasts until its reset.",
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
  "troubleshooting/": ["Troubleshooting", "doctor, common problems, bug reports."],
  "docs/payload/": ["Payload reference", "What agy sends to a status line."],
  "faq/": ["FAQ", "Short answers to the common questions."],
  "security/": ["Security", "What runs on your machine."],
  "privacy/": ["Privacy", "No cookies, analytics or telemetry."],
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
  ["Get started", ["install/", "docs/configuration/", "widgets/", "troubleshooting/"]],
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
  "docs/configuration/": ["widgets/", "themes/", "configure/"],
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
  "widgets/": ["docs/configuration/", "configure/", "themes/"],
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

// --- git dates ---------------------------------------------------------------

function gitDate(args) {
  try {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true }).trim();
  } catch {
    return "";
  }
}

// The last commit that touched any of the files: an accurate lastmod. With a
// shallow clone every file would get the latest commit's date, so the Pages
// workflow checks out the full history. Uncommitted files have none.
function lastCommitDate(sources) {
  return gitDate(["log", "-1", "--format=%cI", "--", ...sources]);
}

function firstCommitDate(source) {
  const dates = gitDate(["log", "--diff-filter=A", "--follow", "--format=%cI", "--", source]);
  return dates.split("\n").filter(Boolean).pop() || "";
}

// --- Markdown pages -------------------------------------------------------

function resolveLinkFrom(fromSource) {
  return (href) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      return href.startsWith(SITE_URL) ? `/${href.slice(SITE_URL.length)}` : href;
    }
    if (href.startsWith("#") || href.startsWith("/")) {
      return href;
    }
    const [file, hash = ""] = href.split("#");
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromSource), file));
    const anchor = hash ? `#${hash}` : "";
    if (target in SITE_PATH_OF) {
      return `/${SITE_PATH_OF[target]}${anchor}`;
    }
    const kind = file.endsWith("/") || !path.posix.extname(target) ? "tree" : "blob";
    return `${REPO_URL}/${kind}/main/${target}${anchor}`;
  };
}

// The screenshot's name when src points into assets/screenshots/.
function screenshotName(fromSource, src) {
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromSource), src));
  return (target.match(/^assets\/screenshots\/([\w-]+)\.png$/) || [])[1];
}

function imageUrl(fromSource, src) {
  const shot = screenshotName(fromSource, src);
  return shot ? screenshotUrl(shot) : resolveLinkFrom(fromSource)(src);
}

function renderSource(source, extra = {}) {
  const md = fs.readFileSync(path.join(repo, source), "utf8");
  return renderMarkdown(md, {
    resolveLink: resolveLinkFrom(source),
    resolveImage: (src) => imageUrl(source, src),
    // A screenshot with a width gets its smaller copies, sized to that width.
    resolveHtml: (html) =>
      html.replace(/<img\b[^>]*>/g, (tag) =>
        tag.replace(/\bsrc="([^"]+)"/, (_m, src) => {
          const shot = screenshotName(source, src);
          const width = Number((tag.match(/\bwidth="(\d+)"/) || [])[1]);
          const attrs =
            shot && width ? screenshotAttrs(shot, width) : `src="${esc(imageUrl(source, src))}"`;
          return `${attrs} loading="lazy" decoding="async"`;
        })
      ),
    ...extra,
  });
}

function contributorsHtml() {
  const rc = JSON.parse(fs.readFileSync(path.join(repo, ".all-contributorsrc"), "utf8"));
  const people = (rc.contributors || []).map(
    (c) =>
      `<li><a href="https://github.com/${esc(c.login)}">${esc(c.name || c.login)}</a> <span>(${esc(
        (c.contributions || []).join(", ")
      )})</span></li>`
  );
  return `<ul>${people.join("")}</ul>`;
}

const CRUMB_HOME = { name: "agy-powerline", path: "" };
const CRUMB_DOCS = { name: "Docs", path: "docs/" };
const CRUMB_GUIDES = { name: "Guides", path: "guides/" };

// What a page's share card shows: its title without the site name, and a
// label for the kind of page.
const cardTitle = (title) => title.replace(/ - agy-powerline$/, "");

function markdownPage(page, { crumbs, ogType, structuredData, article, label } = {}) {
  const { html, headings } = renderSource(page.source);
  const body =
    page.source === "scripts/site/content/about.md"
      ? html.replace("<p>CONTRIBUTORS_LIST</p>", contributorsHtml())
      : html;
  const lastmod = lastCommitDate([page.source]);
  return {
    path: page.path,
    sources: [page.source],
    card: page.card || {
      title: cardTitle(page.title),
      label: label || (page.parent === "docs" ? "Docs" : page.name),
    },
    markdown: fs.readFileSync(path.join(repo, page.source), "utf8"),
    html: docPage({
      path: page.path,
      title: page.title,
      description: page.description,
      bodyHtml: body,
      headings,
      crumbs: crumbs || [CRUMB_HOME, ...(page.parent === "docs" ? [CRUMB_DOCS] : []), page],
      currentPage: page.nav || (page.parent === "docs" ? "docs" : ""),
      source: page.edit === false ? "" : page.source,
      lastmod,
      ogType,
      structuredData:
        page.source === "scripts/site/content/about.md" ? aboutStructuredData() : structuredData,
      article,
    }),
  };
}

// The About page describes its author (ProfilePage), with the profiles that
// are theirs.
function aboutStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: absoluteUrl("about/"),
    mainEntity: {
      "@type": "Person",
      "@id": `${SITE_URL}#author`,
      name: "Wassim AZI",
      url: AUTHOR_URL,
      sameAs: [AUTHOR_URL, X_URL, LINKEDIN_URL],
    },
  };
}

function guidePage(guide) {
  const published = firstCommitDate(guide.source);
  const modified = lastCommitDate([guide.source]);
  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: guide.name,
    description: guide.description,
    url: absoluteUrl(guide.path),
    image: absoluteUrl(cardPath(guide.path)),
    inLanguage: "en",
    author: { "@type": "Person", name: "Wassim AZI", url: AUTHOR_URL },
    publisher: { "@type": "Person", name: "Wassim AZI", url: AUTHOR_URL },
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
  };
  return markdownPage(guide, {
    crumbs: [CRUMB_HOME, CRUMB_GUIDES, guide],
    ogType: "article",
    structuredData: article,
    article: { published, modified },
    label: "Guide",
  });
}

// --- generated pages -------------------------------------------------------

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
            "What npx agy-powerline init does, the plugin route, no-npm installs, WSL, upgrades.",
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
        ])}
        <h2 id="guides">Guides</h2>
        ${cardList(GUIDES.map((g) => [`/${g.path}`, g.name, g.description]))}
        <h2 id="tools">Tools</h2>
        ${cardList([
          ["/configure/", "Configurator", "Build your bar in the browser with a live preview."],
          ["/quota-calculator/", "Quota pace calculator", "Will your quota last until it resets?"],
          ["/themes/", "Theme gallery", "Every theme on dark and light terminals."],
        ])}`;
  return {
    path: "docs/",
    sources: ["scripts/site/build.js"],
    card: { title: "Everything about the agy statusline", label: "Docs" },
    html: docPage({
      path: "docs/",
      title: "agy-powerline docs - agy statusline documentation",
      description:
        "Documentation for agy-powerline, the agy statusline for Google Antigravity CLI: install, configuration, widgets, troubleshooting, payload reference and guides.",
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_DOCS],
      currentPage: "docs",
      toc: false,
    }),
  };
}

function guidesIndexPage() {
  const body = `<h1>Guides</h1>
        <p class="lede">Step-by-step guides for Antigravity CLI's status bar: reading your quotas, setting up a status line, fixing symbols, and running a workshop.</p>
        ${cardList(GUIDES.map((g) => [`/${g.path}`, g.name, g.description]))}
        <p>Looking for every setting instead? See the <a href="/docs/">docs</a>.</p>`;
  return {
    path: "guides/",
    sources: GUIDES.map((g) => g.source),
    card: { title: "Guides for Antigravity CLI's status bar", label: "Guides" },
    html: docPage({
      path: "guides/",
      title: "agy statusline guides - agy-powerline",
      description:
        "Guides for Antigravity CLI's status bar: see your quota while you work, add a status line to agy, fix powerline symbols, move from Gemini CLI, run a workshop.",
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_GUIDES],
      currentPage: "docs",
      toc: false,
    }),
  };
}

// Widgets that read the machine the site is built on (or its agy data) get no
// preview: it would show the build machine, not an example.
const NO_PREVIEW = new Set(["os", "host", "ram", "clock", "tokensToday", "tokensWeek"]);
const PREVIEW_OPTIONS = { customText: { text: "Production" }, exec: { cmd: "echo deploy" } };

function widgetPreview(id) {
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
  const out = renderStatusline(data, config, { color: "truecolor", flexGaps: true });
  if (!out.replace(/\x1b\[[0-9;]*m/g, "").trim()) return "";
  return `<div class="screen-wrap"><div class="term-frame" data-bg="dark"><div class="term" data-bg="dark"><div class="screen">${ansiToHtml(out)}</div></div></div></div>`;
}

function widgetsPage() {
  const widgets = WIDGET_CATALOG.filter((w) => w.id !== "separator" && w.id !== "lineBreak");
  const layoutHelpers = WIDGET_CATALOG.filter((w) => w.id === "separator" || w.id === "lineBreak");
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
          ${widgetPreview(w.id)}
          <pre><code>{ "id": "${esc(w.id)}"${esc(options)} }</code></pre>
        </section>`;
    })
    .join("\n        ");
  const body = `<h1>agy statusline widgets</h1>
        <p class="lede">agy-powerline has ${widgets.length} widgets. Each preview below is drawn by the real statusline code from sample data; widgets that read your machine (operating system, user and host, RAM, clock, token totals) have none. Add any of them with <code>npx agy-powerline configure</code>, in the <a href="/configure/">browser configurator</a>, or with its line in <code>statusline.config.json</code>. Widget options are in <a href="/docs/configuration/#widget-options">Configuration</a>.</p>
        <nav aria-label="Widgets"><p>${widgets.map((w) => `<a href="#${esc(w.id)}"><code>${esc(w.id)}</code></a>`).join(" ")}</p></nav>
        ${sections}
        <section aria-labelledby="layout-helpers">
          <h2 id="layout-helpers">Layout helpers</h2>
          <ul>${layoutHelpers.map((w) => `<li><code>${esc(w.id)}</code>: ${esc(w.description)}</li>`).join("")}</ul>
        </section>`;
  return {
    path: "widgets/",
    sources: ["src/lib/catalog.js", "src/lib/widget-style.js"],
    card: {
      title: `All ${widgets.length} agy statusline widgets, with previews`,
      label: "Widgets",
    },
    html: docPage({
      path: "widgets/",
      title: "agy statusline widgets - every agy-powerline widget",
      description:
        "Every widget of the agy-powerline statusline for Antigravity CLI, with a live preview: model, quotas with pace markers, context, git, tokens and more.",
      bodyHtml: body,
      headings: [],
      crumbs: [CRUMB_HOME, CRUMB_DOCS, { name: "Widgets", path: "widgets/" }],
      currentPage: "docs",
      toc: false,
      extraCss: `
      .widget pre {
        margin-top: 0;
      }
      .widget .term {
        padding: 10px 12px;
      }`,
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
        <p>agy-powerline draws this meter for every quota in agy's status bar and keeps it up to date while you work, with a caution color at 30% left and a danger color at 10%. Install it with <code>npx agy-powerline init</code> and read the <a href="/guides/antigravity-quota/">quota guide</a>.</p>`;
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

// --- feed, llms.txt, manifest ------------------------------------------------

function changelogFeed() {
  const md = fs.readFileSync(path.join(repo, "CHANGELOG.md"), "utf8");
  const parts = md.split(/^## /m).slice(1);
  const entries = parts
    .map((part) => {
      const head = part.split("\n")[0];
      const m = head.match(/^\[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/);
      if (!m) return null;
      const body = part.slice(head.length);
      const { html } = renderMarkdown(body, { resolveLink: resolveLinkFrom("CHANGELOG.md") });
      const anchor = `${m[1].replace(/\./g, "")}---${m[2]}`;
      return { version: m[1], date: `${m[2]}T00:00:00Z`, html, anchor };
    })
    .filter(Boolean);
  const updated = entries[0] ? entries[0].date : new Date(0).toISOString();
  const items = entries
    .map(
      (e) => `  <entry>
    <title>agy-powerline ${esc(e.version)}</title>
    <id>${REPO_URL}/releases/tag/v${esc(e.version)}</id>
    <link rel="alternate" type="text/html" href="${absoluteUrl(`changelog/#${e.anchor}`)}" />
    <updated>${e.date}</updated>
    <content type="html">${esc(e.html)}</content>
  </entry>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>agy-powerline releases</title>
  <subtitle>Release notes of agy-powerline, the agy statusline for Google Antigravity CLI</subtitle>
  <id>${SITE_URL}changelog/</id>
  <link rel="self" type="application/atom+xml" href="${SITE_URL}changelog.xml" />
  <link rel="alternate" type="text/html" href="${SITE_URL}changelog/" />
  <updated>${updated}</updated>
  <author><name>Wassim AZI</name><uri>https://github.com/wassim-azi</uri></author>
${items}
</feed>
`;
}

// llms.txt (llmstxt.org) for AI assistants, plus llms-full.txt with every doc
// in one file, and a Markdown copy of each page beside it (index.html.md).
function llmsFull(markdownPages) {
  const intro = fs.readFileSync(path.join(repo, "llms.txt"), "utf8").trim();
  const docs = markdownPages
    .map((p) => `\n\n---\n\nSource: ${absoluteUrl(p.path)}\n\n${p.markdown.trim()}`)
    .join("");
  return `${intro}${docs}\n`;
}

function webManifest() {
  return `${JSON.stringify(
    {
      name: "agy-powerline",
      short_name: "agy-powerline",
      description: "The agy statusline for Google Antigravity CLI",
      start_url: "/",
      scope: "/",
      display: "browser",
      background_color: "#111319",
      theme_color: "#111319",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      ],
    },
    null,
    2
  )}\n`;
}

// --- build -------------------------------------------------------------------

const HOME_SOURCES = [
  "scripts/gallery/home.html",
  "scripts/site/home-text.js",
  "src/lib/themes.js",
];

// Every page of the site, with what its share card shows.
function sitePages() {
  const markdownPages = [...MARKDOWN_PAGES.map((p) => markdownPage(p)), ...GUIDES.map(guidePage)];
  return [
    {
      path: "",
      sources: HOME_SOURCES,
      html: buildHomeHtml({ lang: "en" }),
      card: { title: stripTags(HOME_TEXT.en.heroTitle), label: "Antigravity CLI" },
      images: SCREENSHOTS.map((name) => screenshotUrl(name)),
    },
    {
      path: "fr/",
      sources: HOME_SOURCES,
      html: buildHomeHtml({ lang: "fr" }),
      card: { title: stripTags(HOME_TEXT.fr.heroTitle), label: "Antigravity CLI", lang: "fr" },
      images: SCREENSHOTS.map((name) => screenshotUrl(name)),
    },
    {
      path: THEMES_PAGE.path,
      sources: ["scripts/gallery/themes.html", "scripts/gallery/build.js", "src/lib/themes.js"],
      html: buildThemesHtml(),
      card: { title: "Themes for the agy statusline", label: "Themes" },
    },
    {
      path: "configure/",
      sources: ["scripts/configurator/template.html", "scripts/configurator/page.js"],
      html: buildConfiguratorHtml(),
      card: { title: "Build your agy statusline in the browser", label: "Configurator" },
    },
    docsIndexPage(),
    guidesIndexPage(),
    widgetsPage(),
    calculatorPage(),
    ...markdownPages,
  ];
}

const isIndexable = (page) => !/<meta name="robots" content="noindex/.test(page.html);

// The share cards scripts/site/images.js draws: one per indexable page.
function cardPages() {
  return sitePages()
    .filter(isIndexable)
    .map((page) => ({ path: page.path, ...page.card }));
}

function buildSite(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const write = (rel, content) => {
    const file = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const copy = (from, rel) => write(rel, fs.readFileSync(path.join(repo, from)));

  const pages = sitePages();
  const markdownPages = pages.filter((page) => page.markdown);

  for (const page of pages) {
    write(path.join(page.path, "index.html"), page.html);
    if (page.markdown) write(path.join(page.path, "index.html.md"), page.markdown);
  }
  write("404.html", build404Html());

  const sitemap = pages.filter(isIndexable).map((p) => ({
    path: p.path,
    lastmod: lastCommitDate(p.sources),
    images: [cardPath(p.path), ...(p.images || [])],
  }));
  write("sitemap.xml", buildSitemapXml(sitemap));
  write("robots.txt", buildRobotsTxt());
  write(".well-known/security.txt", buildSecurityTxt());
  write("changelog.xml", changelogFeed());
  write("llms.txt", fs.readFileSync(path.join(repo, "llms.txt")));
  write("llms-full.txt", llmsFull(markdownPages));
  write("schema/v1.json", `${JSON.stringify(buildConfigSchema(), null, 2)}\n`);
  write("site.webmanifest", webManifest());
  write(`${INDEXNOW_KEY}.txt`, `${INDEXNOW_KEY}\n`);
  write("icon.svg", `${readFaviconSvg()}\n`);
  for (const file of ["favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]) {
    copy(path.join("assets", "site", file), file);
  }
  copy("assets/site/fonts/inter-latin.woff2", "fonts/inter-latin.woff2");
  copy("assets/site/fonts/OFL.txt", "fonts/OFL.txt");
  // The card background is only drawn into the cards.
  for (const file of fs.readdirSync(path.join(repo, "assets", "site", "art"))) {
    if (file.endsWith(".webp") && file !== "card-background.webp") {
      copy(path.join("assets", "site", "art", file), path.join("img", file));
    }
  }
  for (const file of fs.readdirSync(path.join(repo, "assets", "site", "og"))) {
    if (file.endsWith(".jpg")) copy(path.join("assets", "site", "og", file), path.join("og", file));
  }
  for (const file of fs.readdirSync(path.join(repo, "assets", "screenshots"))) {
    if (file.endsWith(".png")) {
      for (const { url, png } of screenshotCopies(file.slice(0, -4))) {
        if (png) write(url.slice(1), png);
      }
      copy(path.join("assets", "screenshots", file), path.join("img", `agy-statusline-${file}`));
    }
  }
  return { pages: pages.length, sitemap: sitemap.length };
}

if (require.main === module) {
  const outDir = path.resolve(process.argv[2] || path.join(repo, "_site"));
  const { pages, sitemap } = buildSite(outDir);
  console.log(`wrote ${outDir} (${pages} pages, ${sitemap} in the sitemap)`);
}

module.exports = {
  buildSite,
  sitePages,
  cardPages,
  MARKDOWN_PAGES,
  GUIDES,
  INDEXNOW_KEY,
  SCREENSHOTS,
  resolveLinkFrom,
  changelogFeed,
};
