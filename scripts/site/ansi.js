"use strict";

// Converts ANSI-colored statusline text to HTML for web previews (theme
// gallery and web configurator). Zero dependencies.
//
// Handles:
// - 24-bit RGB truecolor (\x1b[38;2;r;g;bm and 48;2;r;g;bm)
// - 256-color palette (\x1b[38;5;nm and 48;5;nm)
// - Bold (\x1b[1m), dim (\x1b[2m), normal intensity (\x1b[22m) and resets
// - Powerline glyphs: round caps, arrows and diagonal slants
// - The gaps joinFlex marks between widget groups, which stretch to the box
// - Emoji and other wide characters, held to the columns the renderer counted

const { charWidth } = require("../../src/lib/formatters");
const { FLEX_GAP_START, FLEX_GAP_END } = require("../../src/lib/layouts/pills");

const GAP_START = Number(FLEX_GAP_START.slice(2, -1));
const GAP_END = Number(FLEX_GAP_END.slice(2, -1));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const css = (c) => (c ? `rgb(${c.join(",")})` : null);

function ansi256ToRgb(n) {
  if (n < 16) {
    const std = [
      [0, 0, 0],
      [205, 0, 0],
      [0, 205, 0],
      [205, 205, 0],
      [0, 0, 238],
      [205, 0, 205],
      [0, 205, 205],
      [229, 229, 229],
      [127, 127, 127],
      [255, 0, 0],
      [0, 255, 0],
      [255, 255, 0],
      [92, 92, 255],
      [255, 0, 255],
      [0, 255, 255],
      [255, 255, 255],
    ];
    return std[n] || [0, 0, 0];
  }
  if (n >= 232) {
    const c = 8 + (n - 232) * 10;
    return [c, c, c];
  }
  const idx = n - 16;
  const b = idx % 6;
  const g = Math.floor(idx / 6) % 6;
  const r = Math.floor(idx / 36);
  const steps = [0, 95, 135, 175, 215, 255];
  return [steps[r], steps[g], steps[b]];
}

const GLYPH_MAP = {
  0xe0b0: "tri",
  0xe0b2: "tri-l",
  0xe0b4: "cap-r",
  0xe0b6: "cap-l",
  0xe0b8: "slant-ll",
  0xe0ba: "slant-lr",
  0xe0bc: "slant-ul",
  0xe0be: "slant-ur",
};

// Splits ANSI text into lines of styled runs: { text, fg, bg, bold, dim, gap }
// for text and { glyph, fg, bg } for powerline glyphs, which fonts often lack,
// so the previews draw them as shapes. Colors are [r, g, b] or null; gap marks
// the spaces between widget groups.
function ansiRuns(text) {
  const lines = String(text ?? "")
    .replace(/\x1b\[0m$/, "")
    .split("\n");
  let fg = null;
  let bg = null;
  let bold = false;
  let dim = false;
  let gap = false;

  return lines.map((line) => {
    const runs = [];
    let run = "";

    const flush = () => {
      if (!run) return;
      runs.push({ text: run, fg, bg, bold, dim, gap });
      run = "";
    };

    const glyph = (cls) => {
      flush();
      runs.push({ glyph: cls, fg, bg });
    };

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "\x1b" && line[i + 1] === "[") {
        const end = line.indexOf("m", i);
        if (end === -1) {
          i += 1;
          continue;
        }
        const codes = line
          .slice(i + 2, end)
          .split(";")
          .map(Number);
        flush();
        for (let k = 0; k < codes.length; k++) {
          const c = codes[k];
          if (c === GAP_START || c === GAP_END) {
            gap = c === GAP_START;
          } else if (c === 0) {
            fg = null;
            bg = null;
            bold = false;
            dim = false;
          } else if (c === 1) {
            bold = true;
          } else if (c === 2) {
            dim = true;
          } else if (c === 22) {
            bold = false;
            dim = false;
          } else if (c === 39) {
            fg = null;
          } else if (c === 49) {
            bg = null;
          } else if (c === 38 || c === 48) {
            if (codes[k + 1] === 2) {
              const rgb = codes.slice(k + 2, k + 5);
              if (c === 38) fg = rgb;
              else bg = rgb;
              k += 4;
            } else if (codes[k + 1] === 5) {
              const rgb = ansi256ToRgb(codes[k + 2]);
              if (c === 38) fg = rgb;
              else bg = rgb;
              k += 2;
            }
          }
        }
        i = end;
        continue;
      }

      const cp = ch.codePointAt(0);
      const cls = GLYPH_MAP[cp];
      if (cls) {
        glyph(cls);
      } else {
        run += ch;
      }
    }

    flush();
    return runs;
  });
}

// Runs that are only meter cells and pace markers. Screen readers would read
// each one as "bullet"; the percentage printed next to the meter says it all.
const METER_ONLY = /^[\s•●○◉█░▓▒┃│]*[•●○◉█░▓▒┃][\s•●○◉█░▓▒┃│]*$/;

// A font draws emoji wider or narrower than the two columns the renderer
// counts, which pushes everything after them out of line, so each character
// wider than one column gets a box of exactly its width.
function cellsToHtml(text) {
  let html = "";
  let cluster = "";
  let width = 0;
  let joined = false;
  const flush = () => {
    if (cluster) {
      html +=
        width > 1
          ? `<span class="wc" style="width:${width}ch">${esc(cluster)}</span>`
          : esc(cluster);
    }
    cluster = "";
    width = 0;
  };
  for (const ch of text) {
    const w = charWidth(ch.codePointAt(0));
    // Zero-width marks (variation selectors, skin tones, joiners) and the
    // character after a joiner belong to the cluster before them.
    if (w > 0 && !joined) flush();
    cluster += ch;
    width += w;
    joined = ch === "‍";
  }
  flush();
  return html;
}

// The columns a line needs once each of its gaps is down to one space.
function minColumns(runs) {
  let cols = 0;
  for (const r of runs) {
    if (r.glyph || r.gap) {
      cols += 1;
      continue;
    }
    for (const ch of r.text) cols += charWidth(ch.codePointAt(0));
  }
  return cols;
}

function ansiToHtml(text) {
  const lines = ansiRuns(text);
  // A bar with gaps also shrinks its font to fit a narrower box (.ln.fit), the
  // same for every line so the rows stay aligned.
  const flexible = lines.some((runs) => runs.some((r) => r.gap));
  const fit = flexible ? ` fit" style="--cols:${Math.max(...lines.map(minColumns))}` : "";
  return lines
    .map((runs) => {
      let html = "";
      for (const r of runs) {
        if (r.glyph) {
          const vars = [`--c:${css(r.fg) || "currentColor"}`, `--b:${css(r.bg) || "transparent"}`];
          html += `<span class="g ${r.glyph}" style="${vars.join(";")}"></span>`;
          continue;
        }
        const style = [];
        if (r.fg) style.push(`color:${css(r.fg)}`);
        if (r.bg) style.push(`background:${css(r.bg)}`);
        if (r.bold) style.push("font-weight:700");
        if (r.dim) style.push("opacity:0.65");
        const hidden = METER_ONLY.test(r.text) ? ' aria-hidden="true"' : "";
        const attrs = `${hidden}${style.length ? ` style="${style.join(";")}"` : ""}`;
        // A gap keeps one space and grows to fill the box (.gap), so a bar fits
        // any box as wide as its widgets, with the last group on the right edge.
        html += r.gap
          ? `<span class="r gap"${attrs}> </span>`
          : `<span class="r"${attrs}>${cellsToHtml(r.text)}</span>`;
      }
      const flex = runs.some((r) => r.gap) ? " flex" : "";
      return `<div class="ln${flex}${fit}">${html || "&nbsp;"}</div>`;
    })
    .join("");
}

module.exports = {
  ansiToHtml,
  ansiRuns,
  ansi256ToRgb,
  GLYPH_MAP,
};
