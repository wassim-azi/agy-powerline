"use strict";

// Draws the site's images into assets/site/: the 1200×630 link preview card
// (og.png), the 1280×640 GitHub social preview, and the PNG and ICO icons made
// from scripts/site/favicon.svg. The card shows a bar rendered by the real
// statusline code. The PNGs are committed, so the Pages build needs no
// browser; rerun this after changing the card, the logo or the default bar.
// Needs Chrome or Chromium (CHROME=<path> to pick one).
// Usage: npm run site:images
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repo = path.join(__dirname, "..", "..");
const outDir = path.join(repo, "assets", "site");
const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const { ansiToHtml } = require("./ansi");
const { THEME_ORDER } = require(path.join(repo, "src/lib/themes"));
const { SHARED_CSS, readFaviconSvg } = require("./layout");

const FAKE_DIR = "/home/you/projects/agy-powerline";
// Drawn once with agy's image generator: no text, dark on the left for the
// headline. Only the card uses it; the site doesn't serve it.
const BACKGROUND_URL = `file:///${path
  .join(outDir, "card-background.png")
  .replace(/\\/g, "/")
  .replace(/^\//, "")}`;

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

function bar(width) {
  const data = sampleData();
  data.cwd = FAKE_DIR;
  data.workspace = { current_dir: FAKE_DIR, project_dir: FAKE_DIR };
  data.terminal_width = width;
  // A blank line between the rows, so each one reads on its own at card size.
  const config = { ...defaultConfig(), rowGap: true };
  return ansiToHtml(renderStatusline(data, config, { color: "truecolor" }));
}

function cardHtml({ width, height }) {
  const logo = readFaviconSvg().replace(/<svg /, '<svg width="56" height="56" ');
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<style>
${SHARED_CSS}
html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
body {
  background: #111319 url("${BACKGROUND_URL}") center / cover no-repeat;
  color: #eceef4; display: block; min-height: 0;
}
.card { box-sizing: border-box; width: 100%; height: 100%; padding: 60px 68px; display: grid; grid-template-rows: auto auto 1fr auto; gap: 26px; }
.brand { display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
h1 { margin: 0; font-size: 56px; line-height: 1.08; letter-spacing: -0.03em; max-width: 1000px; }
h1 em { font-style: normal; color: #8fa8ff; }
.term-frame { align-self: center; justify-self: start; }
.term { padding: 18px 22px; }
.screen { font-size: 21px; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.pill { font-family: var(--font-mono); font-size: 26px; padding: 12px 22px; border-radius: 10px; background: #181b24; border: 2px solid #636b7e; }
.facts { font-size: 22px; color: #c9cfdb; padding: 10px 18px; border-radius: 10px; background: rgba(17, 19, 25, 0.88); }
.pill { background: rgba(24, 27, 36, 0.95); }
</style>
</head>
<body>
<div class="card">
  <div class="brand">${logo}<span>agy-powerline</span></div>
  <h1>The <em>agy statusline</em> that shows your quota pace before you run out</h1>
  <div class="term-frame" data-bg="dark"><div class="term" data-bg="dark"><div class="screen">${bar(78)}</div></div></div>
  <div class="foot"><span class="pill">npx agy-powerline init</span><span class="facts">Google Antigravity CLI · ${THEME_ORDER.length - 1} themes · no telemetry</span></div>
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
    args.push(`file:///${page.replace(/\\/g, "/").replace(/^\//, "")}`);
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

function main() {
  const chrome = findChrome();
  fs.mkdirSync(outDir, { recursive: true });

  shoot(chrome, cardHtml({ width: 1200, height: 630 }), path.join(outDir, "og.png"), 1200, 630);
  shoot(
    chrome,
    cardHtml({ width: 1280, height: 640 }),
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

  for (const file of fs.readdirSync(outDir)) {
    console.log(
      `wrote ${path.join(outDir, file)} (${(fs.statSync(path.join(outDir, file)).size / 1024).toFixed(0)} KB)`
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = { cardHtml, iconHtml, pngToIco };
