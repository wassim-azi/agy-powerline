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
const css = (c) => (c ? `rgb(${c.join(",")})` : null);

function ansiToHtml(text) {
  const lines = text.replace(/\x1b\[0m$/, "").split("\n");
  let fg = null,
    bg = null,
    bold = false;
  return lines
    .map((line) => {
      let html = "";
      let run = "";
      const flush = () => {
        if (!run) return;
        const style = [];
        if (fg) style.push(`color:${css(fg)}`);
        if (bg) style.push(`background:${css(bg)}`);
        if (bold) style.push("font-weight:700");
        html += `<span class="r"${style.length ? ` style="${style.join(";")}"` : ""}>${esc(run)}</span>`;
        run = "";
      };
      const glyph = (cls) => {
        flush();
        const vars = [`--c:${css(fg) || "currentColor"}`, `--b:${css(bg) || "transparent"}`];
        html += `<span class="g ${cls}" style="${vars.join(";")}"></span>`;
      };
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "\x1b" && line[i + 1] === "[") {
          const end = line.indexOf("m", i);
          const codes = line
            .slice(i + 2, end)
            .split(";")
            .map(Number);
          flush();
          for (let k = 0; k < codes.length; k++) {
            const c = codes[k];
            if (c === 0) {
              fg = null;
              bg = null;
              bold = false;
            } else if (c === 1) bold = true;
            else if (c === 22) bold = false;
            else if (c === 39) fg = null;
            else if (c === 49) bg = null;
            else if ((c === 38 || c === 48) && codes[k + 1] === 2) {
              const rgb = codes.slice(k + 2, k + 5);
              if (c === 38) fg = rgb;
              else bg = rgb;
              k += 4;
            }
          }
          i = end;
          continue;
        }
        const cp = ch.codePointAt(0);
        if (cp === 0xe0b6) glyph("cap-l");
        else if (cp === 0xe0b4) glyph("cap-r");
        else if (cp === 0xe0b0) glyph("tri");
        else run += ch;
      }
      flush();
      return `<div class="ln">${html || "&nbsp;"}</div>`;
    })
    .join("");
}

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
  return {
    id,
    name: t.name,
    kind: t.kind,
    description: t.description,
    target,
    pills: render(payload(), { layout: "pills" }),
    lines: render(payload(), { layout: "lines" }),
    status,
    states: ["fiveHour", "caution", "warn"].map((k) => hexOf(t.colors[k])),
    pillContrast: Math.min(...KEYS.map((k) => contrast(t.colors.text, t.colors[k]))),
    termContrast: Math.min(...KEYS.map((k) => contrast(t.colors[k], TERM[target]))),
  };
});

const template = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
const cards = themes
  .map(
    (t) => `
<article class="theme" data-kind="${t.kind}" data-target="${t.target}" id="${t.id}">
  <header class="theme-head">
    <div class="theme-name">
      <h2>${esc(t.name)}</h2>
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
  <div class="term" data-bg="${t.target}">
    <div class="term-label">pills</div>
    <div class="screen">${t.pills}</div>
    <div class="term-label">lines</div>
    <div class="screen">${t.lines}</div>
    <div class="term-label">5h quota at 80% · 22% · 6% left</div>
    <div class="screen">${t.status}</div>
  </div>
</article>`
  )
  .join("\n");

// The Pages workflow writes into a fresh _site/ folder.
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  template.replace("<!--CARDS-->", cards).replace("<!--COUNT-->", String(themes.length)),
  "utf8"
);
console.log(
  `wrote ${out} (${themes.length} themes, ${(fs.statSync(out).size / 1024).toFixed(0)} KB)`
);
