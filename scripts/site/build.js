// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Builds the whole agy-powerline.com site into one folder: the home page (in
// English, French, Spanish and Japanese), the theme gallery, the configurator, the
// docs and guides from the repo's Markdown, the widget list, the quota calculator, the
// trust pages, and the files around them (sitemap, robots.txt, feed,
// llms.txt, font, images, share cards, schema). The sitemap lists exactly the
// indexable pages this build writes.
// Usage: npm run site [-- <dir>]   (default: ./_site)
const fs = require("fs");
const path = require("path");

const repo = path.join(__dirname, "..", "..");
const { WIDGET_CATALOG } = require(path.join(repo, "src/lib/catalog"));
const { renderMarkdown, stripTags } = require("./markdown");
const { faqPageData } = require("./doc-page");
const { buildConfigSchema } = require("./config-schema");
const {
  REPO_URL,
  SITE_URL,
  esc,
  absoluteUrl,
  build404Html,
  buildStylesheet,
  STYLESHEET_URL,
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
  pngSize,
} = require("../gallery/build");
const { HOME_TEXT } = require("./home-text");
const { buildConfiguratorPage } = require("../configurator/build");
const {
  MARKDOWN_PAGES,
  GUIDES,
  SITE_PATH_OF,
  CRUMB_HOME,
  CRUMB_DOCS,
  CRUMB_GUIDES,
  docPage,
  cardTitle,
} = require("./pages-config");
const { lastCommitDate, firstCommitDate } = require("./git-dates");
const {
  docsIndexPage,
  guidesIndexPage,
  widgetsPage,
  calculatorPage,
} = require("./generated-pages");

// IndexNow (Bing, Yandex, Naver, Seznam): the key file at the site root proves
// the site is ours when .github/workflows/pages.yml announces changed pages.
// It is public by design.
const INDEXNOW_KEY = "fd008e145d1b3bc2d63c1ee54ac91e80";

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

// A repo PNG's size, read from its header; null for anything else.
function imageSize(fromSource, src) {
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromSource), src));
  const file = path.join(repo, target);
  return target.endsWith(".png") && fs.existsSync(file) ? pngSize(file) : null;
}

function renderSource(source, extra = {}) {
  const md = fs.readFileSync(path.join(repo, source), "utf8");
  return renderMarkdown(md, {
    resolveLink: resolveLinkFrom(source),
    resolveImage: (src) => imageUrl(source, src),
    imageSize: (src) => imageSize(source, src),
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

// Every release has its own "Added", "Fixed"...: a screen reader listing the
// headings also hears which release each one belongs to.
function versionedSections(html) {
  let version = "";
  return html.replace(/<h([23]) id="[^"]*">[\s\S]*?<\/h\1>/g, (tag, level) => {
    if (level === "2") {
      version = (stripTags(tag).match(/\d+\.\d+\.\d+/) || [""])[0];
      return tag;
    }
    return version
      ? tag.replace(/<\/h3>$/, `<span class="sr-only"> in ${version}</span></h3>`)
      : tag;
  });
}

function extractFaqPairs(html) {
  return html
    .split(/<h2\b[^>]*>/i)
    .slice(1)
    .map((sec) => {
      const end = sec.indexOf("</h2>");
      return end === -1 ? null : [sec.slice(0, end), sec.slice(end + "</h2>".length)];
    })
    .filter(Boolean);
}

function articleStructuredData(page, { published, modified } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.name,
    description: page.description,
    url: absoluteUrl(page.path),
    image: absoluteUrl(cardPath(page.path)),
    inLanguage: "en",
    author: { "@type": "Person", name: "Wassim AZI", url: AUTHOR_URL },
    publisher: { "@type": "Person", name: "Wassim AZI", url: AUTHOR_URL },
    isPartOf: { "@id": `${SITE_URL}#website` },
    about: { "@id": `${SITE_URL}#app` },
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
  };
}

function webPageStructuredData(page, { published, modified } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.name,
    description: page.description,
    url: absoluteUrl(page.path),
    inLanguage: "en",
    isPartOf: { "@id": `${SITE_URL}#website` },
    about: { "@id": `${SITE_URL}#app` },
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
  };
}

function pageStructuredData(page, body, { published, modified } = {}) {
  if (page.schema === "ProfilePage") return aboutStructuredData();
  if (page.schema === "FAQPage") {
    return faqPageData(extractFaqPairs(body), { url: absoluteUrl(page.path), lang: "en" });
  }
  if (page.schema === "TechArticle") return articleStructuredData(page, { published, modified });
  if (page.schema === "WebPage") return webPageStructuredData(page, { published, modified });
  return undefined;
}

function markdownPage(page, { crumbs, ogType, structuredData, article, label } = {}) {
  const { html, headings } = renderSource(page.source);
  const body =
    page.source === "scripts/site/content/about.md"
      ? html.replace("<p>CONTRIBUTORS_LIST</p>", contributorsHtml())
      : page.source === "CHANGELOG.md"
        ? versionedSections(html)
        : html;
  const lastmod = lastCommitDate([page.source]);
  const published =
    page.schema && page.schema !== "ProfilePage" ? firstCommitDate(page.source) : "";
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
      alternateMarkdown: `${page.path}index.html.md`,
      structuredData:
        structuredData || pageStructuredData(page, body, { published, modified: lastmod }),
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
  return markdownPage(guide, {
    crumbs: [CRUMB_HOME, CRUMB_GUIDES, guide],
    ogType: "article",
    structuredData: articleStructuredData(guide, { published, modified }),
    article: { published, modified },
    label: "Guide",
  });
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
      path: "es/",
      sources: HOME_SOURCES,
      html: buildHomeHtml({ lang: "es" }),
      card: { title: stripTags(HOME_TEXT.es.heroTitle), label: "Antigravity CLI", lang: "es" },
      images: SCREENSHOTS.map((name) => screenshotUrl(name)),
    },
    {
      path: "ja/",
      sources: HOME_SOURCES,
      html: buildHomeHtml({ lang: "ja" }),
      card: { title: stripTags(HOME_TEXT.ja.heroTitle), label: "Antigravity CLI", lang: "ja" },
      images: SCREENSHOTS.map((name) => screenshotUrl(name)),
    },
    {
      path: "zh-cn/",
      sources: HOME_SOURCES,
      html: buildHomeHtml({ lang: "zh-CN" }),
      card: {
        title: stripTags(HOME_TEXT["zh-CN"].heroTitle),
        label: "Antigravity CLI",
        lang: "zh-CN",
      },
      images: SCREENSHOTS.map((name) => screenshotUrl(name)),
    },
    {
      path: "ko/",
      sources: HOME_SOURCES,
      html: buildHomeHtml({ lang: "ko" }),
      card: {
        title: stripTags(HOME_TEXT.ko.heroTitle),
        label: "Antigravity CLI",
        lang: "ko",
      },
      images: SCREENSHOTS.map((name) => screenshotUrl(name)),
    },
    {
      path: "de/",
      sources: HOME_SOURCES,
      html: buildHomeHtml({ lang: "de" }),
      card: {
        title: stripTags(HOME_TEXT.de.heroTitle),
        label: "Antigravity CLI",
        lang: "de",
      },
      images: SCREENSHOTS.map((name) => screenshotUrl(name)),
    },
    {
      path: THEMES_PAGE.path,
      sources: ["scripts/gallery/themes.html", "scripts/gallery/build.js", "src/lib/themes.js"],
      html: buildThemesHtml(),
      card: { title: "Themes for the agy statusline", label: "Themes" },
    },
    configuratorPage(),
    docsIndexPage(),
    guidesIndexPage(),
    widgetsPage(),
    calculatorPage(),
    ...markdownPages,
  ];
}

function configuratorPage() {
  const { html, script } = buildConfiguratorPage();
  return {
    path: "configure/",
    sources: ["scripts/configurator/template.html", "scripts/configurator/page.js"],
    html,
    files: { [script.path]: script.code },
    card: { title: "Build your agy statusline in the browser", label: "Configurator" },
  };
}

const isIndexable = (page) => !/<meta name="robots" content="noindex/.test(page.html);

// The share cards scripts/site/images.js draws: one per indexable page.
// Built from page metadata directly so callers (images.js, site.test.js) do
// not re-render every HTML page and screenshot copy just to list card titles.
function cardPages() {
  const widgetCount = WIDGET_CATALOG.filter(
    (w) => w.id !== "separator" && w.id !== "lineBreak"
  ).length;
  const pageCard = (page, label) => ({
    path: page.path,
    ...(page.card || {
      title: cardTitle(page.title),
      label: label || (page.parent === "docs" ? "Docs" : page.name),
    }),
  });
  return [
    { path: "", title: stripTags(HOME_TEXT.en.heroTitle), label: "Antigravity CLI" },
    { path: "fr/", title: stripTags(HOME_TEXT.fr.heroTitle), label: "Antigravity CLI", lang: "fr" },
    { path: "es/", title: stripTags(HOME_TEXT.es.heroTitle), label: "Antigravity CLI", lang: "es" },
    { path: "ja/", title: stripTags(HOME_TEXT.ja.heroTitle), label: "Antigravity CLI", lang: "ja" },
    {
      path: "zh-cn/",
      title: stripTags(HOME_TEXT["zh-CN"].heroTitle),
      label: "Antigravity CLI",
      lang: "zh-CN",
    },
    { path: "ko/", title: stripTags(HOME_TEXT.ko.heroTitle), label: "Antigravity CLI", lang: "ko" },
    { path: "de/", title: stripTags(HOME_TEXT.de.heroTitle), label: "Antigravity CLI", lang: "de" },
    { path: THEMES_PAGE.path, title: "Themes for the agy statusline", label: "Themes" },
    {
      path: "configure/",
      title: "Build your agy statusline in the browser",
      label: "Configurator",
    },
    { path: "docs/", title: "Everything about the agy statusline", label: "Docs" },
    { path: "guides/", title: "Guides for Antigravity CLI's status bar", label: "Guides" },
    {
      path: "widgets/",
      title: `All ${widgetCount} agy statusline widgets, with previews`,
      label: "Widgets",
    },
    {
      path: "quota-calculator/",
      title: "Will your Antigravity quota last until it resets?",
      label: "Calculator",
    },
    ...MARKDOWN_PAGES.map((p) => pageCard(p)),
    ...GUIDES.map((g) => pageCard(g, "Guide")),
  ];
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
    for (const [rel, content] of Object.entries(page.files || {})) write(rel, content);
  }
  write("404.html", build404Html());
  write(STYLESHEET_URL.slice(1), buildStylesheet());

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
  for (const file of fs.readdirSync(path.join(repo, "assets", "site", "flags"))) {
    copy(path.join("assets", "site", "flags", file), path.join("img", `flag-${file}`));
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
