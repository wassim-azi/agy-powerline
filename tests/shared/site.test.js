// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// agy-powerline.com is built from the repo by scripts/site/build.js and
// published on GitHub Pages (.github/workflows/pages.yml). Every page must be
// complete, load nothing from other sites, link only to pages that exist, and
// the sitemap must list exactly the pages search engines should index.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { record, ROOT, NODE } = require("../helpers");
const { KNOWN_KEYS } = require("../../src/lib/config-check");
const { VALID_WIDGET_IDS, defaultConfig, mergeConfig } = require("../../src/lib/config");
const { INDEXNOW_KEY, cardPages } = require("../../scripts/site/build");
const { cardHash, stripWebpMetadata, ART_PROMPTS } = require("../../scripts/site/images");
const { SCREENSHOTS, screenshotCopies } = require("../../scripts/gallery/build");
const { decodePng, resizePng, encodePng } = require("../../scripts/site/png");
const { cardSlug } = require("../../scripts/site/layout");
const { quotaPace, formatDuration } = require("../../scripts/site/quota-pace");
const { renderMarkdown } = require("../../scripts/site/markdown");

const SITE_URL = "https://agy-powerline.com/";

// Every HTML file under dir, as site paths: "index.html", "docs/faq/index.html"...
function htmlFiles(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return htmlFiles(path.join(dir, entry.name), rel);
    return entry.name.endsWith(".html") ? [rel] : [];
  });
}

// What a page loads from elsewhere: src/srcset, stylesheets and icons, CSS
// url() and @import. Links people click (<a href>) and the canonical and
// alternate URLs only name pages, so they don't count.
function externalLoads(html) {
  const remote = (url) => /^(?:https?:)?\/\//i.test(url.trim());
  const found = [];
  for (const m of html.matchAll(/\s(?:src|srcset)="([^"]*)"/g)) {
    if (remote(m[1])) found.push(m[1]);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/g)) {
    const rel = (m[0].match(/\brel="([^"]*)"/) || [])[1] || "";
    const href = (m[0].match(/\bhref="([^"]*)"/) || [])[1] || "";
    if (!/^(canonical|alternate)$/.test(rel) && remote(href)) found.push(href);
  }
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
    if (remote(m[1])) found.push(m[1]);
  }
  for (const m of html.matchAll(/@import\s+(?:url\()?['"]?([^'");]+)/g)) {
    if (remote(m[1])) found.push(m[1]);
  }
  return found;
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-site-"));
  // A folder that doesn't exist yet, like _site/ on a fresh checkout.
  const out = path.join(root, "_site");

  try {
    const built = spawnSync(NODE, [path.join(ROOT, "scripts", "site", "build.js"), out], {
      encoding: "utf8",
      windowsHide: true,
    });
    record(
      "the site builds into a folder that doesn't exist yet",
      built.status === 0 && fs.existsSync(path.join(out, "index.html")),
      built.stderr.trim()
    );
    if (!fs.existsSync(path.join(out, "index.html"))) {
      return;
    }

    const files = htmlFiles(out);
    const pages = Object.fromEntries(
      files.map((file) => [file, fs.readFileSync(path.join(out, file), "utf8")])
    );
    const pageUrl = (file) => SITE_URL + file.replace(/(^|\/)index\.html$/, "$1");
    const indexable = files.filter(
      (file) => !/<meta name="robots" content="noindex/.test(pages[file])
    );

    const incomplete = files.filter((file) => {
      const html = pages[file];
      return !(
        /^<!doctype html>\s*<html lang="(en|fr)">\s*<head>/i.test(html) &&
        /<meta charset="utf-8"/i.test(html) &&
        /<meta name="viewport" content="width=device-width, initial-scale=1"/.test(html) &&
        /<title>[^<]+<\/title>/.test(html) &&
        /<meta\s+name="description"\s+content="[^"]+"/.test(html) &&
        (html.match(/<h1[\s>]/g) || []).length === 1 &&
        /<\/body>\s*<\/html>\s*$/.test(html)
      );
    });
    record(
      "every page is complete: doctype, language, charset, viewport, title, description, one h1",
      incomplete.length === 0,
      incomplete.join(", ")
    );

    const unfilled = files.filter((file) =>
      /\{\{\w+\}\}|<!--(SITE_\w+|PREVIEW|INTRO|CARDS|HERO_BAR|PALETTE_ITEMS|\w+_OPTIONS)-->|\/\* SITE_\w+ \*\//.test(
        pages[file]
      )
    );
    record("no page keeps a template placeholder", unfilled.length === 0, unfilled.join(", "));

    const noCsp = files.filter(
      (file) =>
        !/<meta http-equiv="Content-Security-Policy" content="default-src 'none';[^"]*img-src 'self' data:; font-src 'self';/.test(
          pages[file]
        )
    );
    record(
      "every page allows only its own inline style and script, and images and fonts from the site",
      noCsp.length === 0,
      noCsp.join(", ")
    );

    // A page runs only the inline scripts it was built with: its CSP lists each
    // one's SHA-256 (as the browser computes it) instead of 'unsafe-inline'.
    const sha256 = (text) =>
      require("crypto").createHash("sha256").update(text.replace(/\r\n?/g, "\n")).digest("base64");
    const unhashed = files.filter((file) => {
      const html = pages[file];
      const scriptSrc = (html.match(/Content-Security-Policy" content="[^"]*script-src ([^;"]*)/) ||
        [])[1];
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script[^>]*>/gi)].map((m) => m[1]);
      return (
        !scriptSrc ||
        scriptSrc.includes("'unsafe-inline'") ||
        scripts.length === 0 ||
        !scripts.every((body) => scriptSrc.includes(`'sha256-${sha256(body)}'`)) ||
        /\son[a-z]+="/.test(html) ||
        /href="javascript:/i.test(html)
      );
    });
    record(
      "every page's CSP names its inline scripts by hash, with no 'unsafe-inline' and no inline handlers",
      unhashed.length === 0,
      unhashed.join(", ")
    );

    record(
      "every page links the shared stylesheet",
      files.every((file) => pages[file].includes('<link rel="stylesheet" href="/site.css" />')) &&
        fs.readFileSync(path.join(out, "site.css"), "utf8").includes("@font-face"),
      files.filter((file) => !pages[file].includes('href="/site.css"')).join(", ")
    );

    // The bars and swatches take their colors from classes of the page's own
    // stylesheet. The configurator redraws its preview in the browser, where
    // style attributes are the only way.
    const styled = files.filter(
      (file) => file !== "configure/index.html" && /\sstyle="/.test(pages[file])
    );
    record(
      "no page but the configurator has style attributes",
      styled.length === 0,
      styled.join(", ")
    );

    // Headings make the page's outline: the h1 comes first and no level is
    // skipped (the sidebar, "On this page" and the footer use none).
    const badOutline = files.filter((file) => {
      const levels = [...pages[file].matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
      return levels[0] !== 1 || levels.some((level, i) => i > 0 && level > levels[i - 1] + 1);
    });
    record(
      "on every page the first heading is the h1, and no heading skips a level",
      badOutline.length === 0,
      badOutline.join(", ")
    );

    // Accessibility of the Markdown pages: tables are named and their header
    // cells say they head columns; a code block wider than the page can be
    // scrolled with the keyboard; images keep their space while they load.
    const a11y = files.flatMap((file) => {
      const html = pages[file];
      const problems = [];
      if (
        (html.match(/<table>/g) || []).length !==
        (html.match(/<table><caption[^>]*>[^<]+</g) || []).length
      )
        problems.push("table without caption");
      if (/<th(?![^>]*\bscope="col")[\s>]/.test(html)) problems.push("th without scope");
      if (/<pre(?![^>]*\btabindex="0")[\s>]/.test(html)) problems.push("pre without tabindex");
      if (/<div class="cmd[^"]*"><code(?! tabindex="0")/.test(html))
        problems.push("command without tabindex");
      if (
        [...html.matchAll(/<img\b[^>]*>/g)].some(
          ([tag]) => !/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)
        )
      )
        problems.push("img without width and height");
      if (/\salign="/.test(html)) problems.push("align attribute");
      return problems.map((p) => `${file}: ${p}`);
    });
    record(
      "tables have captions and column headers, code scrolls by keyboard, images have a size",
      a11y.length === 0,
      a11y.slice(0, 8).join(", ")
    );

    const loads = files.flatMap((file) =>
      externalLoads(pages[file]).map((url) => `${file}: ${url}`)
    );
    record(
      "no page loads anything from other sites",
      loads.length === 0,
      loads.slice(0, 5).join(", ")
    );

    const badCanonical = indexable.filter(
      (file) => !pages[file].includes(`<link rel="canonical" href="${pageUrl(file)}" />`)
    );
    record(
      "every indexable page names its own canonical URL",
      badCanonical.length === 0,
      badCanonical.join(", ")
    );

    // Search results show about 60 characters of a title and 160 of a
    // description; under 120 a description wastes the space.
    const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    const titleOf = (file) =>
      unescape((pages[file].match(/<title>([^<]*)<\/title>/) || [])[1] || "");
    const descriptionOf = (file) =>
      unescape(
        (pages[file].match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1] || ""
      );
    const badLength = indexable.filter(
      (file) =>
        titleOf(file).length > 60 ||
        descriptionOf(file).length < 120 ||
        descriptionOf(file).length > 160
    );
    record(
      "every indexable page has a title of at most 60 characters and a description of 120 to 160",
      badLength.length === 0,
      badLength.map((f) => `${f} (${titleOf(f).length}, ${descriptionOf(f).length})`).join(", ")
    );
    const repeated = (values) => values.filter((v, i) => values.indexOf(v) !== i);
    const sameTitle = repeated(indexable.map(titleOf));
    const sameDescription = repeated(indexable.map(descriptionOf));
    record(
      "no two indexable pages share a title or a description",
      sameTitle.length === 0 && sameDescription.length === 0,
      [...sameTitle, ...sameDescription].join(" | ")
    );

    // Share cards: X, LinkedIn, Facebook and Reddit read og:image; WhatsApp
    // drops images over about 300 KB.
    const jpegSize = (buf) => {
      for (let i = 2; i < buf.length - 9;) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xc3) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    };
    const badCards = indexable.filter((file) => {
      const html = pages[file];
      const image = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || "";
      const local = path.join(out, image.replace(SITE_URL, ""));
      if (!image.startsWith(`${SITE_URL}og/`) || !fs.existsSync(local)) return true;
      const buf = fs.readFileSync(local);
      const size = jpegSize(buf);
      return !(
        size &&
        size.width === 1200 &&
        size.height === 630 &&
        buf.length <= 300 * 1024 &&
        html.includes('<meta property="og:image:width" content="1200" />') &&
        html.includes('<meta property="og:image:height" content="630" />') &&
        /<meta property="og:image:alt" content="[^"]+"/.test(html) &&
        html.includes(`<meta name="twitter:image" content="${image}" />`) &&
        html.includes('<meta name="twitter:card" content="summary_large_image" />') &&
        html.includes('<meta name="twitter:site" content="@wassim_azi" />')
      );
    });
    record(
      "every indexable page has its own 1200×630 share card of at most 300 KB, for X too",
      badCards.length === 0,
      badCards.join(", ")
    );

    let manifest = {};
    try {
      manifest = JSON.parse(
        fs.readFileSync(path.join(ROOT, "assets", "site", "og", "manifest.json"), "utf8")
      );
    } catch {
      manifest = {};
    }
    const stale = cardPages().filter((card) => manifest[cardSlug(card.path)] !== cardHash(card));
    record(
      "every share card shows the page's current title (run npm run site:images otherwise)",
      stale.length === 0,
      stale.map((card) => card.path || "home").join(", ")
    );

    const guides = indexable.filter((file) => /^guides\/[^/]+\/index\.html$/.test(file));
    record(
      "guides are articles with their publication and update dates",
      guides.length > 0 &&
        guides.every(
          (file) =>
            pages[file].includes('<meta property="og:type" content="article" />') &&
            /<meta property="article:modified_time" content="\d{4}-/.test(pages[file]) &&
            pages[file].includes('<meta property="article:author"')
        )
    );

    const badJsonLd = [];
    for (const file of files) {
      for (const m of pages[file].matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
      )) {
        try {
          JSON.parse(m[1]);
        } catch {
          badJsonLd.push(file);
        }
      }
    }
    record("every JSON-LD block is valid JSON", badJsonLd.length === 0, badJsonLd.join(", "));

    // Root-relative links and images must reach a file this build wrote.
    const broken = new Set();
    for (const file of files) {
      for (const m of pages[file].matchAll(/\s(?:href|src)="(\/[^"#?]*)/g)) {
        const target = m[1].endsWith("/") ? `${m[1]}index.html` : m[1];
        if (!fs.existsSync(path.join(out, target))) broken.add(`${file} -> ${m[1]}`);
      }
    }
    record(
      "every link and image inside the site points to a file the build wrote",
      broken.size === 0,
      [...broken].slice(0, 8).join(", ")
    );

    const home = pages["index.html"];
    const fr = pages["fr/index.html"] || "";
    const alternates = (html) =>
      html.includes(`<link rel="alternate" hreflang="en" href="${SITE_URL}" />`) &&
      html.includes(`<link rel="alternate" hreflang="fr" href="${SITE_URL}fr/" />`) &&
      html.includes(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`);
    record(
      "the English and French home pages name each other with hreflang",
      /<html lang="fr">/.test(fr) && alternates(home) && alternates(fr)
    );

    const sitemap = fs.readFileSync(path.join(out, "sitemap.xml"), "utf8");
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
    const expected = indexable.map(pageUrl).sort();
    // A page's lastmod is the last commit that changed its source, so a page
    // whose source isn't committed yet has none.
    record(
      "sitemap.xml lists exactly the indexable pages, with valid lastmod dates",
      sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>') &&
        JSON.stringify([...locs].sort()) === JSON.stringify(expected) &&
        lastmods.length > 0 &&
        lastmods.every((d) => !Number.isNaN(Date.parse(d))) &&
        !locs.some((loc) => loc.includes("404")),
      `${locs.length} in the sitemap, ${expected.length} indexable`
    );

    const sitemapImages = [...sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(
      (m) => m[1]
    );
    const brokenImages = sitemapImages.filter(
      (url) =>
        !url.startsWith(SITE_URL) || !fs.existsSync(path.join(out, url.slice(SITE_URL.length)))
    );
    record(
      "sitemap.xml images point to files in the build",
      sitemapImages.length > 0 && brokenImages.length === 0,
      brokenImages.join(", ")
    );

    const robots = fs.readFileSync(path.join(out, "robots.txt"), "utf8");
    record(
      "robots.txt allows everything and points to the sitemap",
      /^User-agent: \*$/m.test(robots) &&
        !/^Disallow: \/\s*$/m.test(robots) &&
        robots.includes(`Sitemap: ${SITE_URL}sitemap.xml`)
    );

    const feed = fs.readFileSync(path.join(out, "changelog.xml"), "utf8");
    record(
      "changelog.xml is an Atom feed with an entry per release",
      feed.startsWith('<?xml version="1.0" encoding="utf-8"?>') &&
        feed.includes('<feed xmlns="http://www.w3.org/2005/Atom">') &&
        (feed.match(/<entry>/g) || []).length >= 1
    );

    let schema = null;
    try {
      schema = JSON.parse(fs.readFileSync(path.join(out, "schema", "v1.json"), "utf8"));
    } catch {
      schema = null;
    }
    const schemaKeys = schema ? Object.keys(schema.properties).sort() : [];
    const knownKeys = [...KNOWN_KEYS, "agyPowerline"].sort();
    record(
      "the config schema knows exactly the settings the bar reads",
      JSON.stringify(schemaKeys) === JSON.stringify(knownKeys),
      `schema: ${schemaKeys.join(" ")} / bar: ${knownKeys.join(" ")}`
    );
    const merged = mergeConfig(defaultConfig());
    const widgetIds = schema ? schema.definitions.widget.properties.id.enum : [];
    record(
      "the default config fits the schema's keys and widget ids",
      schema !== null &&
        Object.keys(merged).every((key) => schemaKeys.includes(key)) &&
        JSON.stringify([...widgetIds].sort()) === JSON.stringify([...VALID_WIDGET_IDS].sort()) &&
        merged.widgets.every((w) => widgetIds.includes(w.id))
    );

    const keyFile = path.join(out, `${INDEXNOW_KEY}.txt`);
    const workflow = fs.readFileSync(path.join(ROOT, ".github", "workflows", "pages.yml"), "utf8");
    record(
      "the IndexNow key file holds the key the Pages workflow sends",
      fs.existsSync(keyFile) &&
        fs.readFileSync(keyFile, "utf8").trim() === INDEXNOW_KEY &&
        workflow.includes(`KEY: ${INDEXNOW_KEY}`)
    );

    record(
      "llms.txt on the site is the repo's llms.txt",
      fs.readFileSync(path.join(out, "llms.txt"), "utf8") ===
        fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8")
    );

    const missingFiles = [
      "404.html",
      "llms-full.txt",
      "site.webmanifest",
      "favicon.ico",
      "icon.svg",
      "apple-touch-icon.png",
      "fonts/inter-latin.woff2",
      "fonts/OFL.txt",
      "og/home.jpg",
    ].filter((file) => !fs.existsSync(path.join(out, file)));
    record(
      "the site has its 404 page, manifest, icons, font and share card",
      missingFiles.length === 0,
      missingFiles.join(", ")
    );

    // Every image a page names in src or srcset is in the build.
    const missingImages = files.flatMap((file) =>
      [...pages[file].matchAll(/<img\b[^>]*>/g)].flatMap(([tag]) => {
        const src = (tag.match(/\bsrc="([^"]+)"/) || [])[1] || "";
        const srcset = (tag.match(/\bsrcset="([^"]+)"/) || [])[1] || "";
        const urls = [src, ...srcset.split(",").map((c) => c.trim().split(/\s+/)[0])];
        return urls
          .filter((url) => url.startsWith("/") && !fs.existsSync(path.join(out, url)))
          .map((url) => `${file}: ${url}`);
      })
    );
    record(
      "every image a page loads, srcset copies included, is in the build",
      missingImages.length === 0,
      missingImages.join(", ")
    );

    // Screenshots come with smaller copies, each lighter than the original,
    // and the feature icons with a 56 px copy for 1x screens.
    const shotTags = [...home.matchAll(/<img\b[^>]*agy-statusline-[^>]*>/g)].map(([t]) => t);
    const heavy = SCREENSHOTS.flatMap((name) =>
      screenshotCopies(name)
        .filter(({ png }) => png)
        .filter(({ png }) => {
          const original = path.join(ROOT, "assets", "screenshots", `${name}.png`);
          return png.length >= fs.statSync(original).size;
        })
        .map(({ url }) => url)
    );
    record(
      "home page screenshots have a srcset of copies lighter than the original",
      shotTags.length === SCREENSHOTS.length &&
        shotTags.every((tag) => /\bsrcset="[^"]*-1000\.png 1000w/.test(tag)) &&
        heavy.length === 0,
      heavy.join(", ")
    );
    // The icons are decoration (each repeats its tile's heading), so they are
    // CSS backgrounds rather than images with an empty alt.
    const icons = Object.keys(ART_PROMPTS).filter((name) => name.startsWith("icon-"));
    record(
      "every feature icon is a background with a 56 px copy for 1x screens",
      icons.every(
        (name) =>
          fs.existsSync(path.join(out, "img", `${name}-56.webp`)) &&
          fs.existsSync(path.join(out, "img", `${name}.webp`)) &&
          home.includes(`image-set(url("/img/${name}-56.webp") 1x,url("/img/${name}.webp") 2x)`)
      ) && !/<img[^>]*tile-icon/.test(home)
    );

    // The hero artwork is the home page's LCP element: both themes' versions
    // are preloaded at high priority, each for its own color scheme.
    const heroPreloads = ["light", "dark"].every((scheme) =>
      new RegExp(
        `<link\\s+rel="preload"\\s+href="/img/hero-${scheme}\\.webp"\\s+as="image"\\s+type="image/webp"\\s+fetchpriority="high"\\s+media="\\(prefers-color-scheme: ${scheme}\\)"`
      ).test(home)
    );
    record(
      "the home page preloads its hero artwork with fetchpriority=high",
      heroPreloads &&
        fs.existsSync(path.join(out, "img", "hero-light.webp")) &&
        fs.existsSync(path.join(out, "img", "hero-dark.webp"))
    );

    // Chrome tags its WebPs with a color profile; images.js drops it.
    const webpChunks = (buf) => {
      const types = [];
      for (let o = 12; o + 8 <= buf.length;) {
        const length = buf.readUInt32LE(o + 4);
        types.push(buf.toString("latin1", o, o + 4));
        o += 8 + length + (length & 1);
      }
      return types;
    };
    const tagged = fs
      .readdirSync(path.join(out, "img"))
      .filter((file) => file.endsWith(".webp"))
      .filter((file) =>
        webpChunks(fs.readFileSync(path.join(out, "img", file))).some((t) =>
          ["ICCP", "EXIF", "XMP "].includes(t)
        )
      );
    record("no WebP on the site carries metadata", tagged.length === 0, tagged.join(", "));
    const iccWebp = Buffer.from(
      "RIFF\x2a\0\0\0WEBPVP8X\x0a\0\0\0\x20\0\0\0\0\0\0\0\0\0ICCP\x02\0\0\0abVP8 \x02\0\0\0xy",
      "latin1"
    );
    const stripped = stripWebpMetadata(iccWebp);
    record(
      "stripWebpMetadata drops the profile and a VP8X header left with no flags",
      webpChunks(stripped).join() === "VP8 " && stripped.readUInt32LE(4) === stripped.length - 8,
      webpChunks(stripped).join()
    );

    const sample = { width: 3, height: 2, data: Buffer.alloc(3 * 2 * 4, 0) };
    sample.data.set([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0], 0);
    sample.data.set([0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255], 12);
    const half = decodePng(encodePng(resizePng(sample, 1)));
    record(
      "the PNG resizer averages by area and ignores transparent pixels' color",
      decodePng(encodePng(sample)).data.equals(sample.data) &&
        half.width === 1 &&
        half.height === 1 &&
        // 2 red + 3 blue opaque pixels out of 6, the transparent one adds no color.
        half.data[0] === 102 &&
        half.data[2] === 153 &&
        Math.abs(half.data[3] - 212.5) < 1,
      [...half.data].join(",")
    );

    // Indexed screenshots (an optimizer's palette PNGs) round-trip, and a
    // shrunk copy keeps the palette: black, white and a mid gray in between.
    const palette = [
      [0, 0, 0, 255],
      [255, 255, 255, 255],
      [128, 128, 128, 255],
    ];
    const indexed = { width: 2, height: 1, data: Buffer.from([0, 0, 0, 255, 255, 255, 255, 255]) };
    const indexedPng = encodePng({ ...indexed, palette });
    const shrunk = decodePng(encodePng(resizePng(decodePng(indexedPng), 1)));
    // A 1-bit indexed PNG: 3 pixels, indexes 1, 0, 1 packed in one byte.
    const pngChunk = (type, body) => {
      const head = Buffer.alloc(8);
      head.writeUInt32BE(body.length, 0);
      head.write(type, 4, "latin1");
      return Buffer.concat([head, body, Buffer.alloc(4)]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(3, 0);
    ihdr.writeUInt32BE(1, 4);
    ihdr.set([1, 3, 0, 0, 0], 8);
    const oneBit = decodePng(
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", ihdr),
        pngChunk("PLTE", Buffer.from([0, 0, 0, 255, 255, 255])),
        pngChunk("IDAT", require("zlib").deflateSync(Buffer.from([0, 0b10100000]))),
        pngChunk("IEND", Buffer.alloc(0)),
      ])
    );
    record(
      "the PNG resizer reads indexed PNGs and keeps their palette in shrunk copies",
      indexedPng[25] === 3 &&
        decodePng(indexedPng).data.equals(indexed.data) &&
        decodePng(indexedPng).palette.length === 3 &&
        shrunk.palette.length === 3 &&
        [...shrunk.data].join() === "128,128,128,255" &&
        [...oneBit.data].join() === "255,255,255,255,0,0,0,255,255,255,255,255",
      `${[...shrunk.data].join()} | ${[...oneBit.data].join()}`
    );

    // RFC 9116: a contact (GitHub's private reporting, never an email
    // address) and an Expires under a year away.
    const securityTxt = fs.existsSync(path.join(out, ".well-known", "security.txt"))
      ? fs.readFileSync(path.join(out, ".well-known", "security.txt"), "utf8")
      : "";
    const expires = Date.parse((securityTxt.match(/^Expires: (\S+)$/m) || [])[1]);
    record(
      "security.txt points to private vulnerability reporting and expires within a year",
      securityTxt.includes(
        "Contact: https://github.com/wassim-azi/agy-powerline/security/advisories/new\n"
      ) &&
        securityTxt.includes(`Canonical: ${SITE_URL}.well-known/security.txt\n`) &&
        !/@|mailto:/i.test(securityTxt) &&
        expires > Date.now() &&
        expires <= Date.now() + 366 * 86400 * 1000 &&
        /include-hidden-files: true/.test(workflow),
      securityTxt
    );

    // The widget previews are drawn on the build machine: none may show its
    // host name or home folder.
    const widgetsPage = pages["widgets/index.html"] || "";
    record(
      "the widget page shows nothing about the machine that built it",
      widgetsPage.length > 0 &&
        !widgetsPage.includes(os.hostname()) &&
        !widgetsPage.includes(os.homedir()) &&
        !widgetsPage.includes(os.homedir().replace(/\\/g, "/"))
    );

    // The calculator's math: 72% left with 2hr 47m to go in a 5-hour window
    // is 44.3% of the window gone and 28% used, so it lasts.
    const pace = quotaPace({ window: "5h", leftPct: 72, resetIn: 2 * 3600 + 47 * 60 });
    const behind = quotaPace({ window: "7d", leftPct: 20, resetIn: 4 * 86400 });
    record(
      "the quota calculator says whether a quota lasts until its reset",
      pace.status === "ahead" &&
        Math.abs(pace.elapsedPct - 44.33) < 0.01 &&
        Math.abs(pace.leftAtReset - 36.84) < 0.01 &&
        behind.status === "behind" &&
        behind.runsOutIn < 4 * 86400 &&
        quotaPace({ window: "5h", leftPct: 0, resetIn: 60 }).status === "empty" &&
        Boolean(quotaPace({ window: "5h", leftPct: 50, resetIn: 6 * 3600 }).error) &&
        Boolean(quotaPace({ window: "5h", leftPct: 120, resetIn: 60 }).error) &&
        formatDuration(2 * 3600 + 47 * 60) === "2hr 47m" &&
        formatDuration(86400 + 17 * 3600) === "1d 17h"
    );

    const md = renderMarkdown(
      '# Hello world\n\nSome `<b>` and **bold**.\n\n## Hello world\n\n| a | b |\n| - | -: |\n| 1 | 2 |\n\n```js\nx\n```\n\n![shot](a.png)\n\n<p align="center">\n<img src="b.png">\n</p>\n',
      { imageSize: (src) => (src === "a.png" ? { width: 10, height: 5 } : null) }
    );
    record(
      "the Markdown renderer slugs headings like GitHub, escapes code and builds tables",
      md.html.includes('id="hello-world"') &&
        md.html.includes('id="hello-world-1"') &&
        md.html.includes("<code>&lt;b&gt;</code>") &&
        md.html.includes("<strong>bold</strong>") &&
        /<table><caption class="sr-only">Hello world<\/caption>[\s\S]*<td>1<\/td>[\s\S]*<\/table>/.test(
          md.html
        ) &&
        md.html.includes('<th scope="col">a</th><th scope="col" class="align-right">b</th>') &&
        md.html.includes('<td class="align-right">2</td>') &&
        md.html.includes('<pre tabindex="0"><code class="language-js">x</code></pre>') &&
        md.html.includes('<img src="a.png" alt="shot" width="10" height="5" loading="lazy" />') &&
        md.html.includes('<p class="center">'),
      md.html
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
