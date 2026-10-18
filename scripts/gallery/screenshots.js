"use strict";

// Writes one SVG screenshot per theme (pills and lines layouts on the theme's
// target terminal), drawn from the real statusline output. CI uploads them
// with the theme preview, so reviewers can look at a pull request's bar
// without checking it out. SVG keeps it to Node: no browser or image tool.
// Usage: npm run screenshots [-- <dir>]   (default: ./screenshots)
const fs = require("fs");
const path = require("path");

const repo = path.join(__dirname, "..", "..");
const outDir = path.resolve(process.argv[2] || path.join(repo, "screenshots"));

const { renderStatusline, sampleData, defaultConfig } = require(path.join(repo, "src/lib/shared"));
const { THEMES, THEME_ORDER } = require(path.join(repo, "src/lib/themes"));
const { charWidth } = require(path.join(repo, "src/lib/formatters"));
const { ansiRuns } = require("../site/ansi");

const FAKE_DIR = "/home/you/projects/agy-powerline";
const WIDTH = 96;
const TERM = {
  dark: { bg: [29, 31, 39], fg: [220, 223, 228] },
  light: { bg: [251, 251, 248], fg: [40, 42, 46] },
};

const CELL_W = 8.4;
const CELL_H = 20;
const FONT_SIZE = 14;
const PAD = 16;
const LABEL_H = 22;
const FONT = "'JetBrains Mono', 'Cascadia Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

// Same shapes as the .g classes in scripts/site/layout.js, as unit-cell points.
const GLYPH_POINTS = {
  tri: [0, 0, 1, 0.5, 0, 1],
  "tri-l": [1, 0, 0, 0.5, 1, 1],
  "slant-ul": [0, 0, 1, 0, 0, 1],
  "slant-lr": [0, 1, 1, 0, 1, 1],
  "slant-ur": [0, 0, 1, 0, 1, 1],
  "slant-ll": [0, 0, 1, 1, 0, 1],
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rgb = (c) => `rgb(${c.join(",")})`;
const num = (n) => Number(n.toFixed(2));

function payload() {
  const data = sampleData();
  data.cwd = FAKE_DIR;
  data.workspace = { current_dir: FAKE_DIR, project_dir: FAKE_DIR };
  data.terminal_width = WIDTH;
  return data;
}

function glyphShape(name, x, y, color) {
  if (name === "cap-l" || name === "cap-r") {
    const edge = name === "cap-l" ? x + CELL_W : x;
    const sweep = name === "cap-l" ? 0 : 1;
    return `<path d="M${num(edge)} ${y}A${CELL_W} ${CELL_H / 2} 0 0 ${sweep} ${num(edge)} ${y + CELL_H}Z" fill="${color}"/>`;
  }
  const pts = GLYPH_POINTS[name];
  const coords = [];
  for (let i = 0; i < pts.length; i += 2) {
    coords.push(`${num(x + pts[i] * CELL_W)},${num(y + pts[i + 1] * CELL_H)}`);
  }
  return `<polygon points="${coords.join(" ")}" fill="${color}"/>`;
}

// Splits a run into <text> parts placed on the cell grid. Narrow characters
// share a part with one x per character, like a terminal; wide and astral
// characters (emoji) get their own, and zero-width ones (variation selectors)
// stay with the character before them.
function textParts(text, startCol) {
  const parts = [];
  let current = null;
  let col = startCol;
  for (const ch of text) {
    const w = charWidth(ch.codePointAt(0));
    if (w === 0) {
      if (current) current.text += ch;
      current = null;
      continue;
    }
    if (ch === " ") {
      current = null;
    } else if (w === 1 && ch.length === 1) {
      if (!current) {
        current = { text: "", cols: [] };
        parts.push(current);
      }
      current.text += ch;
      current.cols.push(col);
    } else {
      current = { text: ch, cols: [col] };
      parts.push(current);
      current = null;
    }
    col += w;
  }
  return { parts, cells: col - startCol };
}

// Draws one bar on the cell grid, one row per line of output.
function drawBar(text, top, term) {
  const out = [];
  let rows = 0;
  ansiRuns(text).forEach((runs, row) => {
    const y = top + row * CELL_H;
    let col = 0;
    rows = row + 1;
    for (const r of runs) {
      const x = PAD + col * CELL_W;
      if (r.glyph) {
        if (r.bg)
          out.push(
            `<rect x="${num(x)}" y="${y}" width="${CELL_W}" height="${CELL_H}" fill="${rgb(r.bg)}"/>`
          );
        out.push(glyphShape(r.glyph, x, y, rgb(r.fg || term.fg)));
        col += 1;
        continue;
      }

      const { parts, cells } = textParts(r.text, col);
      col += cells;
      if (r.bg && cells) {
        out.push(
          `<rect x="${num(x)}" y="${y}" width="${num(cells * CELL_W)}" height="${CELL_H}" fill="${rgb(r.bg)}"/>`
        );
      }
      const attrs = [`fill="${rgb(r.fg || term.fg)}"`];
      if (r.bold) attrs.push('font-weight="700"');
      if (r.dim) attrs.push('opacity="0.65"');
      for (const p of parts) {
        const xs = p.cols.map((c) => num(PAD + c * CELL_W)).join(" ");
        out.push(
          `<text x="${xs}" y="${y + CELL_H * 0.72}" ${attrs.join(" ")}>${esc(p.text)}</text>`
        );
      }
    }
  });
  return { svg: out.join(""), rows };
}

function screenshot(id) {
  const theme = THEMES[id];
  const target = theme.kind === "light" || id.endsWith("-light") ? "light" : "dark";
  const term = TERM[target];
  const render = (layout) =>
    renderStatusline(payload(), { ...defaultConfig(), theme: id, layout }, { color: "truecolor" });

  const parts = [];
  let y = PAD;
  for (const layout of ["pills", "lines"]) {
    parts.push(
      `<text x="${PAD}" y="${y + 14}" font-size="11" fill="${rgb(term.fg)}" opacity="0.7">${layout}</text>`
    );
    y += LABEL_H;
    const bar = drawBar(render(layout), y, term);
    parts.push(bar.svg);
    y += bar.rows * CELL_H + 8;
  }

  const width = num(PAD * 2 + WIDTH * CELL_W);
  const height = y + PAD - 8;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${esc(`${theme.name} (${id}) on a ${target} terminal`)}</title>`,
    "<style>rect{shape-rendering:crispEdges}</style>",
    `<rect width="100%" height="100%" rx="8" fill="${rgb(term.bg)}"/>`,
    `<g font-family="${FONT}" font-size="${FONT_SIZE}" xml:space="preserve">`,
    ...parts,
    "</g>",
    "</svg>",
    "",
  ].join("\n");
}

const ids = THEME_ORDER.filter((id) => id !== "custom");
fs.mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  fs.writeFileSync(path.join(outDir, `${id}.svg`), screenshot(id), "utf8");
}
console.log(`wrote ${ids.length} screenshots to ${outDir}`);
