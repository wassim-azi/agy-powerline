"use strict";

// Converts ANSI-colored statusline text to HTML for web previews (theme
// gallery and web configurator). Zero dependencies.
//
// Handles:
// - 24-bit RGB truecolor (\x1b[38;2;r;g;bm and 48;2;r;g;bm)
// - 256-color palette (\x1b[38;5;nm and 48;5;nm)
// - Bold (\x1b[1m), dim (\x1b[2m), normal intensity (\x1b[22m) and resets
// - Powerline glyphs: round caps, arrows and diagonal slants

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

function ansiToHtml(text) {
  const lines = String(text ?? "")
    .replace(/\x1b\[0m$/, "")
    .split("\n");
  let fg = null;
  let bg = null;
  let bold = false;
  let dim = false;

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
        if (dim) style.push("opacity:0.65");
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
            if (c === 0) {
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
      return `<div class="ln">${html || "&nbsp;"}</div>`;
    })
    .join("");
}

module.exports = {
  ansiToHtml,
  ansi256ToRgb,
  GLYPH_MAP,
};
