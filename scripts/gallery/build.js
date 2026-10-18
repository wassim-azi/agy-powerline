"use strict";

// Builds gallery.html: every theme rendered by the real statusline code, on
// dark and light terminals, with a color-blindness simulation toggle.
// Usage: npm run gallery [-- <out.html>]   (default: ./gallery.html)
const fs = require("fs");
const path = require("path");

const repo = path.join(__dirname, "..", "..");
const out = path.resolve(process.argv[2] || path.join(repo, "gallery.html"));

const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const { THEMES, THEME_ORDER } = require(path.join(repo, "src/lib/themes"));
const { ansiToHtml } = require("../site/ansi");
const { injectSiteChrome, build404 } = require("../site/layout");
const { encodeConfig } = require("../configurator/page");

const FAKE_DIR = "/home/you/projects/agy-powerline";
const TERM = { dark: [29, 31, 39], light: [251, 251, 248] };

function payload(overrides = {}) {
  const data = sampleData();
  data.cwd = FAKE_DIR;
  data.workspace = { current_dir: FAKE_DIR, project_dir: FAKE_DIR };
  data.terminal_width = 96;
  return { ...data, ...overrides };
}

function withFiveHour(fraction) {
  const data = payload();
  data.quota = {
    ...data.quota,
    "gemini-5h": { ...data.quota["gemini-5h"], remaining_fraction: fraction },
  };
  return data;
}

// --- ANSI → HTML -----------------------------------------------------------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- Contrast numbers shown on each card -----------------------------------
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const KEYS = [
  "model",
  "fiveHour",
  "weekly",
  "thirdParty",
  "context",
  "git",
  "gitDirty",
  "meta",
  "caution",
  "warn",
];

const hexOf = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

const heroBar = ansiToHtml(renderStatusline(payload(), defaultConfig(), { color: "truecolor" }));

const themes = THEME_ORDER.filter((id) => id !== "custom").map((id) => {
  const t = THEMES[id];
  const target = t.kind === "light" || id.endsWith("-light") ? "light" : "dark";
  const render = (data, config) =>
    ansiToHtml(
      renderStatusline(data, { ...defaultConfig(), theme: id, ...config }, { color: "truecolor" })
    );
  const status = [0.8, 0.22, 0.06]
    .map((f) => render(withFiveHour(f), { layout: "pills", widgets: [{ id: "fiveHourBar" }] }))
    .join("");
  const configHash = encodeConfig({ ...defaultConfig(), theme: id });
  return {
    id,
    name: t.name,
    kind: t.kind,
    description: t.description,
    target,
    pills: render(payload(), { layout: "pills" }),
    lines: render(payload(), { layout: "lines" }),
    status,
    configHash,
    states: ["fiveHour", "caution", "warn"].map((k) => hexOf(t.colors[k])),
    pillContrast: Math.min(...KEYS.map((k) => contrast(t.colors.text, t.colors[k]))),
    termContrast: Math.min(...KEYS.map((k) => contrast(t.colors[k], TERM[target]))),
  };
});

const rawTemplate = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
const template = injectSiteChrome(rawTemplate, {
  title: "agy-powerline — Theme Gallery & Statusline for Google Antigravity CLI",
  description:
    "A powerline statusline for Google Antigravity's CLI (agy). Preview every built-in theme on dark and light terminals, or customize your bar in the browser.",
  currentPage: "themes",
  rootPrefix: "./",
});

const cards = themes
  .map(
    (t) => `
<article class="theme" data-kind="${t.kind}" data-target="${t.target}" id="${t.id}">
  <header class="theme-head">
    <div class="theme-name">
      <h2><a class="theme-anchor" href="#${t.id}">${esc(t.name)}</a></h2>
      <code class="theme-id">${t.id}</code>
    </div>
    <p class="theme-desc">${esc(t.description)}</p>
    <dl class="metrics">
      <div><dt>Pill text</dt><dd>${t.pillContrast.toFixed(1)}:1</dd></div>
      <div><dt>On terminal</dt><dd>${t.termContrast.toFixed(1)}:1</dd></div>
      <div class="states"><dt>OK · caution · danger</dt><dd>${t.states
        .map((c) => `<span class="dot" style="background:${c}" title="${c}"></span>`)
        .join("")}</dd></div>
    </dl>
  </header>
  <div class="term-frame" data-bg="${t.target}">
    <div class="term-titlebar">
      <div class="term-dots" aria-hidden="true">
        <span class="term-dot"></span>
        <span class="term-dot"></span>
        <span class="term-dot"></span>
      </div>
      <span class="term-title">${t.id} · <span class="term-bg-label">${t.target} terminal</span></span>
    </div>
    <div class="term" data-bg="${t.target}">
      <div class="term-label">pills</div>
      <div class="screen">${t.pills}</div>
      <div class="term-label">lines</div>
      <div class="screen">${t.lines}</div>
      <div class="term-label">5h quota at 80% · 22% · 6% left</div>
      <div class="screen">${t.status}</div>
    </div>
  </div>
  <footer class="theme-actions" aria-label="Use ${esc(t.name)}">
    <div class="cli-pill">
      <code>npx agy-powerline theme ${t.id}</code>
      <button
        type="button"
        class="btn-copy"
        data-copy="npx agy-powerline theme ${t.id}"
        aria-label="Copy command for ${esc(t.name)}"
      >
        <span class="copy-label">Copy</span>
      </button>
    </div>
    <a class="btn-use-theme" href="./configure/#${t.configHash}">Use this theme →</a>
  </footer>
</article>`
  )
  .join("\n");

// The Pages workflow writes into a fresh _site/ folder.
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  template
    .replace("<!--HERO_BAR-->", heroBar)
    .replace("<!--CARDS-->", cards)
    .replaceAll("<!--COUNT-->", String(themes.length)),
  "utf8"
);

// When building a site root (index.html), also write 404.html beside it.
if (path.basename(out) === "index.html") {
  build404(path.join(path.dirname(out), "404.html"));
}

console.log(
  `wrote ${out} (${themes.length} themes, ${(fs.statSync(out).size / 1024).toFixed(0)} KB)`
);
