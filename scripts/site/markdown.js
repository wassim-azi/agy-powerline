"use strict";

// A small Markdown to HTML converter for the site's doc pages, so they come
// from the same files as the docs on GitHub. It covers what our own Markdown
// uses: headings, paragraphs, nested lists, fenced code, tables, blockquotes,
// a raw HTML block, and inline code, links, images, bold and italic. The input
// is always the repo's own files, never visitor text.

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Repeats until nothing is left, so a tag split by another one ("<scr<b>ipt>")
// can't come back together.
function stripTags(html) {
  let text = String(html ?? "");
  for (let prev; prev !== text;) {
    prev = text;
    text = text.replace(/<[^>]*>/g, "");
  }
  return text;
}

// GitHub's heading anchors, so links like configuration.md#widgets keep working.
function slugify(text) {
  return stripTags(text.toLowerCase())
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");
}

// Heading text as GitHub sees it for the anchor: no Markdown syntax.
function plainText(md) {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*]/g, "")
    .replace(/(^|\W)_+|_+(\W|$)/g, "$1$2");
}

function inline(md, ctx) {
  const codes = [];
  let text = md.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_m, _ticks, code) => {
    codes.push(`<code>${esc(code.trim() === "" ? code : code.replace(/^ (.*) $/, "$1"))}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = esc(text);
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => {
    const url = ctx.resolveImage ? ctx.resolveImage(src) : src;
    return `<img src="${esc(url)}" alt="${alt}" loading="lazy" />`;
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const url = ctx.resolveLink ? ctx.resolveLink(href.replace(/&amp;/g, "&")) : href;
    return `<a href="${esc(url)}">${label}</a>`;
  });
  text = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?![\w*])/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, "$1<em>$2</em>");
  return text.replace(/\u0000(\d+)\u0000/g, (_m, i) => codes[Number(i)]);
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const FENCE = /^(\s*)(```+|~~~+)\s*([\w-]*)\s*$/;
const TABLE_RULE = /^(?=.*\|)\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function splitRow(line) {
  const cells = [];
  let cell = "";
  let inCode = false;
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && body[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (ch === "`") {
      inCode = !inCode;
      cell += ch;
    } else if (ch === "|" && !inCode) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function heading(level, md, ctx) {
  const base = slugify(plainText(md));
  const count = ctx.slugs.get(base) || 0;
  ctx.slugs.set(base, count + 1);
  const id = count ? `${base}-${count}` : base;
  ctx.headings.push({ level, id, text: plainText(md) });
  return `<h${level} id="${esc(id)}">${inline(md, ctx)}</h${level}>`;
}

function renderBlocks(lines, ctx) {
  const out = [];
  let i = 0;

  const isBlank = (line) => line === undefined || line.trim() === "";
  const startsBlock = (line) =>
    /^#{1,6}\s/.test(line) ||
    FENCE.test(line) ||
    LIST_ITEM.test(line) ||
    /^>/.test(line) ||
    /^<[a-zA-Z/]/.test(line) ||
    /^(-{3,}|\*{3,})\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      out.push(heading(h[1].length + (ctx.shift || 0), h[2], ctx));
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const indent = fence[1].length;
      const marker = fence[2];
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        body.push(lines[i].slice(Math.min(indent, lines[i].search(/\S|$/))));
        i++;
      }
      i++;
      const lang = fence[3] ? ` class="language-${esc(fence[3])}"` : "";
      out.push(`<pre><code${lang}>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^<[a-zA-Z/]/.test(line)) {
      const body = [];
      while (i < lines.length && !isBlank(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      const html = body.join("\n");
      out.push(ctx.resolveHtml ? ctx.resolveHtml(html) : html);
      continue;
    }

    if (/^>/.test(line)) {
      const body = [];
      while (i < lines.length && /^>/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderBlocks(body, ctx)}</blockquote>`);
      continue;
    }

    if (line.includes("|") && TABLE_RULE.test(lines[i + 1] || "")) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) =>
        c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""
      );
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && !isBlank(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const cell = (tag, text, n) =>
        `<${tag}${aligns[n] ? ` style="text-align:${aligns[n]}"` : ""}>${inline(text, ctx)}</${tag}>`;
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c, n) => cell("th", c, n)).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_c, n) => cell("td", r[n] || "", n)).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    const item = line.match(LIST_ITEM);
    if (item) {
      const baseIndent = item[1].length;
      const ordered = /\d/.test(item[2]);
      const start = ordered ? parseInt(item[2], 10) : 1;
      const items = [];
      let loose = false;
      while (i < lines.length) {
        const m = lines[i].match(LIST_ITEM);
        if (!m || m[1].length !== baseIndent || /\d/.test(m[2]) !== ordered) break;
        const contentIndent = lines[i].length - m[3].length;
        const body = [m[3]];
        i++;
        while (i < lines.length) {
          const next = lines[i];
          if (isBlank(next)) {
            const after = lines.slice(i + 1).find((l) => !isBlank(l));
            const indent = after === undefined ? 0 : after.search(/\S/);
            if (after !== undefined && indent >= contentIndent) {
              body.push("");
              i++;
              continue;
            }
            break;
          }
          const indent = next.search(/\S/);
          if (indent >= contentIndent) {
            body.push(next.slice(contentIndent));
          } else if (indent > baseIndent) {
            body.push(next.trimStart());
          } else if (!LIST_ITEM.test(next) && !startsBlock(next)) {
            body.push(next.trim());
          } else {
            break;
          }
          i++;
        }
        if (body.includes("")) loose = true;
        items.push(body);
        if (isBlank(lines[i])) {
          const after = lines.slice(i).find((l) => !isBlank(l));
          const m2 = after && after.match(LIST_ITEM);
          if (m2 && m2[1].length === baseIndent && /\d/.test(m2[2]) === ordered) {
            loose = true;
            while (isBlank(lines[i])) i++;
          }
        }
      }
      const tag = ordered ? "ol" : "ul";
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : "";
      const html = items
        .map((body) => {
          const inner = renderBlocks(body, ctx);
          // A tight list keeps its text out of <p>, as GitHub does.
          return `<li>${loose ? inner : inner.replace(/^<p>([\s\S]*?)<\/p>/, "$1")}</li>`;
        })
        .join("");
      out.push(`<${tag}${startAttr}>${html}</${tag}>`);
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      (para.length === 0 || !startsBlock(lines[i]))
    ) {
      if (lines[i].includes("|") && TABLE_RULE.test(lines[i + 1] || "")) break;
      para.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${inline(para.join("\n"), ctx)}</p>`);
  }

  return out.join("\n");
}

// options.resolveLink(href) and options.resolveImage(src) map repo-relative
// links to site URLs; options.resolveHtml(html) rewrites a raw HTML block.
// options.shift moves every heading down by that many levels.
function renderMarkdown(md, options = {}) {
  const ctx = { ...options, slugs: new Map(), headings: [] };
  const html = renderBlocks(String(md).replace(/\r\n?/g, "\n").split("\n"), ctx);
  return { html, headings: ctx.headings };
}

module.exports = { renderMarkdown, slugify, plainText, inline, stripTags };
