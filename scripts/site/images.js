// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Draws the site's images into assets/site/ with headless Chrome:
// - og/<slug>.jpg: a 1200×630 share card for every indexable page (X,
//   LinkedIn, Facebook, Reddit, Slack and WhatsApp previews), with the page's
//   title and a bar rendered by the real statusline code; og/manifest.json
//   records what each card shows, so a test catches a stale card;
// - github-social-preview.png (1280×640, uploaded by hand in the repo settings);
// - the PNG and ICO icons made from scripts/site/favicon.svg.
// The images are committed, so the Pages build needs no browser; rerun this
// after changing a page title, the card or the logo.
//
// The artwork in assets/site/art/ (hero backdrops, card background, feature
// icons) was drawn once with agy's image generator, from the prompts in
// ART_PROMPTS below. To redo it, save agy's PNGs under those names in a folder
// and pass it with --art: they are cropped, resized and saved as WebP. Every
// run redraws the 56 px copies of the feature icons from the 128 px ones.
//
// Needs Chrome or Chromium (CHROME=<path> to pick one).
// Usage: npm run site:images [-- --art <folder of agy PNGs>]
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const repo = path.join(__dirname, "..", "..");
const outDir = path.join(repo, "assets", "site");
const artDir = path.join(outDir, "art");
const ogDir = path.join(outDir, "og");
const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const { ansiToHtml } = require("./ansi");
const { THEME_ORDER } = require(path.join(repo, "src/lib/themes"));
const { SHARED_CSS, readFaviconSvg, cardSlug, esc } = require("./layout");

const FAKE_DIR = "/home/you/projects/agy-powerline";
// Bump when the card's design changes, so every card is redrawn and checked.
const CARD_VERSION = 2;

const STYLE =
  "No text, no letters, no numbers, no logos, no user interface, no watermark. Clean, modern, premium, minimal, high quality.";
const ICON_STYLE =
  "Square 1:1 app icon: a rounded-square tile with a subtle dark gradient (#1a1d27 to #11131a) and a thin soft border, centered flat glyph drawn with a smooth gradient from pink (#e07ab8) through blue (#7aa2f7) to green (#7ed69a), simple geometric line style, generous padding, consistent with a set of six icons.";
// What agy was asked for (agy -p "Use your image generation tool to create
// this image and save it as <file>... <prompt>"), and how each image is cut.
const ART_PROMPTS = {
  "hero-dark": {
    size: [1376, 768],
    prompt: `Wide 16:9 abstract background for the hero of a developer tool website. Very dark charcoal-navy base (#0e1016). On the right half, large flowing ribbons shaped like rounded powerline segments and chevrons, in soft gradients of pink (#e07ab8), blue (#7aa2f7) and green (#7ed69a), with a gentle glow, depth and a little bokeh blur. The left 55 percent stays mostly empty and dark so text can sit on it. ${STYLE}`,
  },
  "hero-light": {
    size: [1376, 768],
    prompt: `Wide 16:9 abstract background for the hero of a developer tool website. Very light cool-white base (#f6f7fb). On the right half, large flowing ribbons shaped like rounded powerline segments and chevrons, in soft pastel gradients of pink (#e07ab8), blue (#7aa2f7) and green (#7ed69a), airy and subtle with soft shadows. The left 55 percent stays mostly empty and light so dark text can sit on it. ${STYLE}`,
  },
  "card-background": {
    size: [1376, 768],
    prompt: `Wide 16:9 abstract background for a social media link preview card. Very dark charcoal-navy base (#111319). Decorative flowing ribbons shaped like rounded powerline chevrons in pink (#e07ab8), blue (#7aa2f7) and green (#7ed69a) with a soft glow, only along the right edge and the bottom-right corner. The center and the left two thirds stay calm, dark and empty for text. ${STYLE}`,
  },
  // Icons: the middle of agy's 1024×1024 tile, without its outer edge; the
  // page rounds the corners.
  "icon-pace": {
    size: [128, 128],
    crop: [200, 200, 624],
    prompt: `${ICON_STYLE} The glyph: a semicircular gauge with a needle and one small dot marker on the arc. ${STYLE}`,
  },
  "icon-themes": {
    size: [128, 128],
    crop: [200, 200, 624],
    prompt: `${ICON_STYLE} The glyph: a painter's palette with three paint dots. ${STYLE}`,
  },
  "icon-layouts": {
    size: [128, 128],
    crop: [200, 200, 624],
    prompt: `${ICON_STYLE} The glyph: three horizontal stacked rounded bars of different lengths, like rows of a status bar. ${STYLE}`,
  },
  "icon-widgets": {
    size: [128, 128],
    crop: [200, 200, 624],
    prompt: `${ICON_STYLE} The glyph: four puzzle-like rounded squares in a 2 by 2 grid, one slightly offset. ${STYLE}`,
  },
  "icon-configure": {
    size: [128, 128],
    crop: [200, 200, 624],
    prompt: `${ICON_STYLE} The glyph: three horizontal slider controls with knobs at different positions. ${STYLE}`,
  },
  "icon-platforms": {
    size: [128, 128],
    crop: [200, 200, 624],
    prompt: `${ICON_STYLE} The glyph: a terminal window outline with a prompt chevron and an underscore cursor. ${STYLE}`,
  },
};

// The size the home page shows the feature icons at.
const SMALL_ICON = 56;

const fileUrl = (file) => `file:///${file.replace(/\\/g, "/").replace(/^\//, "")}`;

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((file) => fs.existsSync(file));
  if (!found) {
    throw new Error("Chrome or Chromium not found; set CHROME=<path to the browser>");
  }
  return found;
}

function bar(width, language) {
  const data = sampleData();
  data.cwd = FAKE_DIR;
  data.workspace = { current_dir: FAKE_DIR, project_dir: FAKE_DIR };
  data.terminal_width = width;
  // A blank line between the rows, so each one reads on its own at card size.
  const config = { ...defaultConfig(), rowGap: true, language };
  return ansiToHtml(renderStatusline(data, config, { color: "truecolor" }));
}

// What a card shows; its hash goes in og/manifest.json.
function cardInput(card) {
  return {
    v: CARD_VERSION,
    title: card.title,
    label: card.label,
    lang: card.lang || "en",
    themes: THEME_ORDER.length - 1,
    // A page in another language shows the bar in it (left out for English,
    // so those cards keep their hash).
    ...(card.lang && card.lang !== "en" ? { barLanguage: card.lang } : {}),
  };
}

const cardHash = (card) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(cardInput(card)))
    .digest("hex")
    .slice(0, 16);

function cardHtml({ width, height, title, label, lang = "en" }) {
  const logo = readFaviconSvg().replace(/<svg /, '<svg width="52" height="52" ');
  const font = fileUrl(path.join(outDir, "fonts", "inter-latin.woff2"));
  const background = fileUrl(path.join(artDir, "card-background.webp"));
  const facts =
    lang === "fr"
      ? `${THEME_ORDER.length - 1} thèmes · 0 dépendance · sans télémétrie`
      : `${THEME_ORDER.length - 1} themes · 0 dependencies · no telemetry`;
  const size = title.length > 60 ? 50 : title.length > 40 ? 58 : 66;
  return `<!doctype html>
<html lang="${lang}" data-theme="dark">
<head>
<meta charset="utf-8" />
<style>
${SHARED_CSS}
@font-face { font-family: "Inter Card"; font-weight: 100 900; src: url("${font}") format("woff2"); }
html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
body {
  /* The artwork moves right, away from the text; its left edge fades into the ground. */
  background:
    linear-gradient(90deg, #10131a 0 90px, rgba(16, 19, 26, 0) 320px),
    #10131a url("${background}") 90px 50% / cover no-repeat;
  color: #eef0f6; display: block; min-height: 0;
  font-family: "Inter Card", sans-serif;
}
.card { box-sizing: border-box; width: 100%; height: 100%; padding: 56px 64px 52px; display: grid; grid-template-rows: auto 1fr auto auto; gap: 28px; }
.top { display: flex; align-items: center; gap: 16px; }
.brand { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; }
.label { margin-left: 8px; padding: 7px 16px; border-radius: 999px; font-size: 19px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #c9d4ff; background: rgba(143, 168, 255, 0.14); border: 1.5px solid rgba(143, 168, 255, 0.45); }
h1 { margin: 0; align-self: center; font-size: ${size}px; font-weight: 750; line-height: 1.08; letter-spacing: -0.035em; max-width: ${Math.round(width * 0.8)}px; text-wrap: balance; }
.term-frame { justify-self: start; border-radius: 14px; }
.term { padding: 14px 18px; container-type: normal; }
.screen { font-size: 16px; }
.ln.fit { font-size: inherit; }
.foot { display: flex; align-items: center; gap: 28px; font-size: 21px; }
.cmd { font-size: 24px; padding: 12px 22px; border-radius: 12px; box-shadow: none; }
.facts { color: #b9c1d1; }
</style>
</head>
<body>
<div class="card">
  <div class="top">${logo}<span class="brand">agy-powerline</span><span class="label">${esc(label)}</span></div>
  <h1>${esc(title)}</h1>
  <div class="term-frame" data-bg="dark"><div class="term" data-bg="dark"><div class="screen">${bar(78, lang)}</div></div></div>
  <div class="foot"><span class="cmd"><code><span class="prompt">$ </span>npx agy-powerline init</code></span><span class="facts">${facts}</span></div>
</div>
</body>
</html>`;
}

function iconHtml(size, { padded = false } = {}) {
  const inner = padded ? Math.round(size * 0.8) : size;
  const svg = readFaviconSvg().replace(/<svg /, `<svg width="${inner}" height="${inner}" `);
  const bg = padded ? "#13151b" : "transparent";
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
html, body { margin: 0; width: ${size}px; height: ${size}px; overflow: hidden; background: ${bg}; }
body { display: grid; place-items: center; }
svg { display: block; }
</style></head><body>${svg}</body></html>`;
}

// One of agy's PNGs, cropped and scaled to the size it is served at.
function artHtml(file, { size: [width, height], crop }) {
  const [x, y, side] = crop || [0, 0, 0];
  const scale = crop ? width / side : 1;
  const position = crop ? `${-x * scale}px ${-y * scale}px` : "0 0";
  const bgSize = crop ? `${1024 * scale}px auto` : `${width}px ${height}px`;
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
body { background: url("${fileUrl(file)}") ${position} / ${bgSize} no-repeat; }
</style></head><body></body></html>`;
}

// Chrome tags every WebP with a 456-byte sRGB color profile, a third of a
// small icon; untagged images are shown as sRGB anyway. Drops the ICCP, EXIF
// and XMP chunks, and the VP8X header when nothing else needs it.
function stripWebpMetadata(buf) {
  if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") {
    return buf;
  }
  const chunks = [];
  for (let o = 12; o + 8 <= buf.length;) {
    const type = buf.toString("latin1", o, o + 4);
    const end = o + 8 + buf.readUInt32LE(o + 4);
    chunks.push({ type, data: Buffer.from(buf.subarray(o, end + (end & 1))) });
    o = end + (end & 1);
  }
  const kept = chunks.filter(({ type }) => !["ICCP", "EXIF", "XMP "].includes(type));
  const vp8x = kept.find(({ type }) => type === "VP8X");
  if (vp8x) {
    // Flags: 0x20 ICC, 0x08 EXIF, 0x04 XMP.
    vp8x.data[8] &= ~(0x20 | 0x08 | 0x04);
    if (vp8x.data[8] === 0) kept.splice(kept.indexOf(vp8x), 1);
  }
  const body = Buffer.concat([Buffer.from("WEBP", "latin1"), ...kept.map(({ data }) => data)]);
  const head = Buffer.from("RIFF\0\0\0\0", "latin1");
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

// Chrome picks the screenshot's format from the file extension: .png, .jpg
// or .webp.
function shoot(chrome, html, file, width, height, transparent) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agy-site-images-"));
  try {
    const page = path.join(tmp, "page.html");
    fs.writeFileSync(page, html, "utf8");
    const args = [
      "--headless",
      "--no-first-run",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--user-data-dir=${path.join(tmp, "profile")}`,
      `--window-size=${width},${height}`,
      `--screenshot=${file}`,
    ];
    if (transparent) {
      args.push("--default-background-color=00000000");
    }
    args.push(fileUrl(page));
    fs.rmSync(file, { force: true });
    execFileSync(chrome, args, { stdio: "ignore", timeout: 60000 });
    // On Windows chrome.exe can return before its browser process has written
    // the file, so wait for it before the page it loads is deleted.
    const pause = new Int32Array(new SharedArrayBuffer(4));
    for (let i = 0; i < 150 && !fs.existsSync(file); i++) {
      Atomics.wait(pause, 0, 0, 200);
    }
    if (!fs.existsSync(file)) {
      throw new Error(`Chrome wrote no screenshot for ${path.basename(file)}`);
    }
    Atomics.wait(pause, 0, 0, 500);
    if (file.endsWith(".webp")) {
      fs.writeFileSync(file, stripWebpMetadata(fs.readFileSync(file)));
    }
  } finally {
    // Chrome's helper processes can hold the profile for a moment after exit.
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // A leftover temp folder is harmless.
    }
  }
}

// An ICO file holding one PNG image, which every current browser reads.
function pngToIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size >= 256 ? 0 : size, 6);
  header.writeUInt8(size >= 256 ? 0 : size, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

function convertArt(chrome, sourceDir) {
  fs.mkdirSync(artDir, { recursive: true });
  for (const [name, spec] of Object.entries(ART_PROMPTS)) {
    const source = path.join(sourceDir, `${name}.png`);
    if (!fs.existsSync(source)) {
      console.log(`skipped ${name}: no ${source}`);
      continue;
    }
    const [width, height] = spec.size;
    shoot(chrome, artHtml(source, spec), path.join(artDir, `${name}.webp`), width, height);
  }
}

// The feature icons show at 56 px: icon-<name>-56.webp is the 1x image, the
// 128 px one the 2x. Always drawn from the 128 px icon, never from itself.
function drawSmallIcons(chrome) {
  for (const name of Object.keys(ART_PROMPTS).filter((n) => n.startsWith("icon-"))) {
    const source = path.join(artDir, `${name}.webp`);
    const file = path.join(artDir, `${name}-${SMALL_ICON}.webp`);
    shoot(
      chrome,
      artHtml(source, { size: [SMALL_ICON, SMALL_ICON] }),
      file,
      SMALL_ICON,
      SMALL_ICON
    );
  }
}

function drawCards(chrome) {
  // Required here, not at the top: the site build reads this file's exports.
  const { cardPages } = require("./build");
  fs.mkdirSync(ogDir, { recursive: true });
  const manifest = {};
  for (const card of cardPages()) {
    const slug = cardSlug(card.path);
    shoot(
      chrome,
      cardHtml({ width: 1200, height: 630, ...card }),
      path.join(ogDir, `${slug}.jpg`),
      1200,
      630
    );
    manifest[slug] = cardHash(card);
  }
  // Cards of pages that no longer exist go.
  for (const file of fs.readdirSync(ogDir)) {
    if (file.endsWith(".jpg") && !(file.slice(0, -4) in manifest)) {
      fs.rmSync(path.join(ogDir, file));
    }
  }
  fs.writeFileSync(path.join(ogDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  const chrome = findChrome();
  fs.mkdirSync(outDir, { recursive: true });
  const artFlag = process.argv.indexOf("--art");
  if (artFlag !== -1) {
    convertArt(chrome, path.resolve(process.argv[artFlag + 1] || "."));
  }
  drawSmallIcons(chrome);

  drawCards(chrome);
  shoot(
    chrome,
    cardHtml({
      width: 1280,
      height: 640,
      title: "The agy statusline that tells you if your quota will last",
      label: "Antigravity CLI",
    }),
    path.join(outDir, "github-social-preview.png"),
    1280,
    640
  );
  // The touch and manifest icons sit on a solid background: some launchers
  // draw a transparent icon on black or white.
  shoot(
    chrome,
    iconHtml(180, { padded: true }),
    path.join(outDir, "apple-touch-icon.png"),
    180,
    180
  );
  shoot(chrome, iconHtml(192, { padded: true }), path.join(outDir, "icon-192.png"), 192, 192);
  shoot(chrome, iconHtml(512, { padded: true }), path.join(outDir, "icon-512.png"), 512, 512);
  const ico = path.join(outDir, "favicon-48.png");
  shoot(chrome, iconHtml(48), ico, 48, 48, true);
  fs.writeFileSync(path.join(outDir, "favicon.ico"), pngToIco(fs.readFileSync(ico), 48));
  fs.rmSync(ico);

  for (const dir of [outDir, artDir, ogDir]) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isFile()) {
        console.log(`wrote ${full} (${(fs.statSync(full).size / 1024).toFixed(0)} KB)`);
      }
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  cardHtml,
  cardInput,
  cardHash,
  iconHtml,
  pngToIco,
  convertArt,
  drawSmallIcons,
  stripWebpMetadata,
  findChrome,
  ART_PROMPTS,
  SMALL_ICON,
  CARD_VERSION,
};
