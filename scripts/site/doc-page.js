// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// The page around the site's text pages (docs, guides, About, FAQ...): the
// shared header and footer, the docs sidebar, a breadcrumb, an "On this page"
// list built from the headings, "Next steps" at the end, and styles for the
// rendered Markdown. The site script adds a copy button to each code block.

const { injectSiteChrome, finishPage, absoluteUrl, esc, REPO_URL } = require("./layout");

const PROSE_CSS = `
      /* Text reads best at about 80 characters a line: the sidebar on the
         left and "On this page" on the right sit around it on wide screens. */
      .doc-wrap {
        max-width: 1280px;
        width: 100%;
        margin: 0 auto;
        padding: 32px 20px 72px;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 40px;
      }
      .doc-side,
      .doc-toc {
        display: none;
      }
      @media (min-width: 1040px) {
        .doc-wrap.has-toc {
          grid-template-columns: minmax(0, 1fr) 220px;
        }
        .doc-toc {
          display: block;
        }
      }
      @media (min-width: 1240px) {
        .doc-wrap.has-side {
          grid-template-columns: 220px minmax(0, 1fr);
        }
        .doc-wrap.has-side.has-toc {
          grid-template-columns: 220px minmax(0, 1fr) 220px;
        }
        .doc-side {
          display: block;
        }
      }
      .doc-side,
      .doc-toc {
        position: sticky;
        top: calc(var(--header-h) + 24px);
        align-self: start;
        max-height: calc(100vh - var(--header-h) - 48px);
        overflow-y: auto;
        font-size: 0.88rem;
      }
      .doc-side-title {
        margin: 0 0 8px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      .doc-side ul,
      .doc-toc ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 2px;
      }
      .doc-side ul {
        margin-bottom: 22px;
      }
      .doc-side a {
        display: block;
        padding: 5px 10px;
        border-radius: var(--radius-sm);
        color: var(--fg-soft);
        text-decoration: none;
      }
      .doc-side a:hover {
        background: var(--surface-2);
        color: var(--fg);
      }
      .doc-side a[aria-current="page"] {
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 600;
      }
      .doc-toc {
        border-left: 1px solid var(--line);
        padding-left: 16px;
      }
      .doc-toc ul {
        gap: 7px;
      }
      .doc-toc a {
        color: var(--muted);
        text-decoration: none;
      }
      .doc-toc a:hover {
        color: var(--accent);
      }
      .breadcrumb ol {
        list-style: none;
        margin: 0 0 12px;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 0.85rem;
        color: var(--muted);
      }
      .breadcrumb li + li::before {
        content: "›";
        margin-right: 4px;
      }
      .breadcrumb a {
        color: var(--muted);
      }
      .prose {
        min-width: 0;
        max-width: 78ch;
        font-size: 1rem;
        line-height: 1.7;
      }
      .prose > :first-child {
        margin-top: 0;
      }
      .prose h1 {
        font-size: clamp(1.9rem, 3.6vw, 2.6rem);
        letter-spacing: -0.035em;
        line-height: 1.12;
        margin: 0 0 16px;
        text-wrap: balance;
      }
      .prose h2 {
        font-size: 1.45rem;
        letter-spacing: -0.02em;
        margin: 44px 0 12px;
        padding-top: 4px;
        scroll-margin-top: calc(var(--header-h) + 16px);
      }
      .prose h3 {
        font-size: 1.12rem;
        margin: 30px 0 8px;
        scroll-margin-top: calc(var(--header-h) + 16px);
      }
      .prose h4 {
        font-size: 1rem;
        margin: 22px 0 6px;
        scroll-margin-top: calc(var(--header-h) + 16px);
      }
      .prose p,
      .prose ul,
      .prose ol,
      .prose blockquote,
      .prose pre,
      .prose .pre-wrap,
      .prose .table-wrap {
        margin: 0 0 16px;
      }
      .prose li {
        margin: 5px 0;
      }
      .prose li > ul,
      .prose li > ol {
        margin: 4px 0;
      }
      .prose a {
        color: var(--accent);
        text-underline-offset: 3px;
        text-decoration-thickness: 1px;
      }
      .prose a:hover {
        text-decoration-thickness: 2px;
      }
      .prose code {
        font-family: var(--font-mono);
        font-size: 0.86em;
        background: var(--surface-2);
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 1px 5px;
        overflow-wrap: anywhere;
      }
      .prose pre {
        background: #10131a;
        color: #e1e4ec;
        border: 1px solid #262c3a;
        border-radius: var(--radius-md);
        padding: 14px 16px;
        overflow-x: auto;
        font-size: 0.86rem;
        line-height: 1.55;
      }
      .prose pre code {
        background: none;
        border: 0;
        padding: 0;
        color: inherit;
        font-size: inherit;
        overflow-wrap: normal;
      }
      .pre-wrap {
        position: relative;
      }
      .pre-wrap pre {
        margin: 0;
        padding-right: 88px;
      }
      .pre-copy {
        position: absolute;
        top: 8px;
        right: 8px;
        opacity: 0;
        transition: opacity 120ms ease;
      }
      .pre-wrap:hover .pre-copy,
      .pre-copy:focus-visible,
      .pre-copy.copied {
        opacity: 1;
      }
      @media (hover: none) {
        .pre-copy {
          opacity: 1;
        }
      }
      .prose blockquote {
        border-left: 3px solid var(--accent);
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        padding: 10px 16px;
        color: var(--fg-soft);
        background: var(--accent-soft);
      }
      .prose blockquote > :last-child {
        margin-bottom: 0;
      }
      .prose .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
      }
      .prose table {
        border-collapse: collapse;
        width: 100%;
        font-size: 0.92rem;
      }
      .prose th,
      .prose td {
        text-align: left;
        vertical-align: top;
        padding: 9px 12px;
        border-bottom: 1px solid var(--line);
      }
      .prose th {
        background: var(--surface-2);
        font-weight: 600;
      }
      .prose tr:last-child td {
        border-bottom: 0;
      }
      .prose img {
        max-width: 100%;
        height: auto;
        border-radius: var(--radius-sm);
      }
      .prose hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 32px 0;
      }
      .prose details {
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        padding: 10px 14px;
        margin: 0 0 16px;
      }
      .prose summary {
        cursor: pointer;
        font-weight: 600;
      }
      .lede {
        font-size: 1.12rem;
        color: var(--muted);
      }
      .doc-meta {
        margin-top: 40px;
        padding-top: 16px;
        border-top: 1px solid var(--line);
        font-size: 0.86rem;
        color: var(--muted);
        display: flex;
        flex-wrap: wrap;
        gap: 6px 20px;
      }
      .doc-meta a {
        color: var(--accent);
      }
      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin: 0 0 20px;
        padding: 0;
        list-style: none;
      }
      .card-grid li {
        margin: 0;
      }
      .card-link {
        display: grid;
        gap: 4px;
        height: 100%;
        padding: 16px 18px;
        border: 1px solid var(--line);
        border-radius: var(--radius-md);
        background: var(--surface);
        color: var(--fg);
        text-decoration: none;
        box-shadow: var(--shadow-sm);
        transition:
          border-color 160ms ease,
          transform 160ms ease;
      }
      .prose .card-link {
        text-decoration: none;
      }
      .card-link:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
      }
      .card-link strong {
        color: var(--fg);
      }
      .card-link span {
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.5;
      }
      .next-steps {
        margin-top: 44px;
      }
      .next-steps h2 {
        margin-top: 0;
      }
      .next-steps .card-link strong::after {
        content: " →";
        color: var(--accent);
      }
      .prose .screen-wrap {
        margin: 0 0 16px;
      }
      .prose .align-center,
      .prose .center {
        text-align: center;
      }
      .prose .align-right {
        text-align: right;
      }
`;

function breadcrumbData(crumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => {
      const item = { "@type": "ListItem", position: i + 1, name: crumb.name };
      // The last crumb is the page itself, which takes no item URL.
      if (i < crumbs.length - 1) item.item = absoluteUrl(crumb.path);
      return item;
    }),
  };
}

function breadcrumbHtml(crumbs) {
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${crumbs
    .map((crumb, i) =>
      i < crumbs.length - 1
        ? `<li><a href="/${esc(crumb.path)}">${esc(crumb.name)}</a></li>`
        : `<li aria-current="page">${esc(crumb.name)}</li>`
    )
    .join("")}</ol></nav>`;
}

function tocHtml(headings) {
  const items = headings.filter((h) => h.level === 2);
  if (items.length < 3) return "";
  return `<aside class="doc-toc" aria-label="On this page">
        <p class="doc-side-title">On this page</p>
        <ul>
          ${items.map((h) => `<li><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join("\n          ")}
        </ul>
      </aside>`;
}

// sidebar: [{ title, links: [[href, label]] }]. The group titles aren't
// headings: the sidebar comes before the page's h1, and the nav's label already
// names it for screen readers.
function sidebarHtml(sidebar, pagePath) {
  if (!sidebar || !sidebar.length) return "";
  const current = `/${pagePath}`;
  return `<nav class="doc-side" aria-label="Docs">
        ${sidebar
          .map(
            (group) => `<p class="doc-side-title">${esc(group.title)}</p>
        <ul>
          ${group.links
            .map(
              ([href, label]) =>
                `<li><a href="${esc(href)}"${href === current ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`
            )
            .join("\n          ")}
        </ul>`
          )
          .join("\n        ")}
      </nav>`;
}

// next: [[href, title, text]]
function nextStepsHtml(next) {
  if (!next || !next.length) return "";
  return `<section class="next-steps" aria-labelledby="next-steps">
          <h2 id="next-steps">Next steps</h2>
          <ul class="card-grid">${next
            .map(
              ([href, title, text]) =>
                `<li><a class="card-link" href="${esc(href)}"><strong>${esc(title)}</strong><span>${esc(text)}</span></a></li>`
            )
            .join("")}</ul>
        </section>`;
}

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

// page: { path, title, description, bodyHtml, headings, crumbs, currentPage,
// structuredData, source, lastmod, extraCss, script, ogType, article,
// sidebar, next }
function buildDocPage(page) {
  const crumbs = page.crumbs || [{ name: "agy-powerline", path: "" }];
  const structuredData = [
    ...(crumbs.length > 1 ? [breadcrumbData(crumbs)] : []),
    ...(Array.isArray(page.structuredData)
      ? page.structuredData
      : page.structuredData
        ? [page.structuredData]
        : []),
  ];
  const toc = page.toc === false ? "" : tocHtml(page.headings || []);
  const side = sidebarHtml(page.sidebar, page.path);
  const meta = [];
  if (page.lastmod) meta.push(`<span>Updated ${esc(formatDate(page.lastmod))}</span>`);
  if (page.source) {
    meta.push(
      `<a href="${REPO_URL}/blob/main/${esc(page.source)}">Edit this page on GitHub</a>`,
      `<a href="${REPO_URL}/issues">Report a problem</a>`
    );
  }
  const classes = ["doc-wrap", side && "has-side", toc && "has-toc"].filter(Boolean).join(" ");
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
${PROSE_CSS}${page.extraCss || ""}
    </style>
  </head>
  <body>
    <!--SITE_HEADER-->
    <main class="${classes}" id="main">
      ${side}
      <article class="prose">
        ${crumbs.length > 1 ? breadcrumbHtml(crumbs) : ""}
        ${page.bodyHtml}
        ${nextStepsHtml(page.next)}
        ${meta.length ? `<footer class="doc-meta">${meta.join("\n          ")}</footer>` : ""}
      </article>
      ${toc}
    </main>
    <!--SITE_FOOTER-->
    <script>
      /* SITE_THEME_SCRIPT */
    </script>${page.script ? `\n    <script>\n${page.script}\n    </script>` : ""}
  </body>
</html>
`;
  return finishPage(
    injectSiteChrome(template, {
      title: page.title,
      description: page.description,
      currentPage: page.currentPage || "docs",
      pagePath: page.path,
      structuredData,
      ogType: page.ogType,
      article: page.article,
    })
  );
}

module.exports = { buildDocPage, breadcrumbData, PROSE_CSS, formatDate };
