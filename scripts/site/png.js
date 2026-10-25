// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Just enough PNG for the site build to serve smaller copies of the
// screenshots without a dependency: read RGB, RGBA or indexed PNGs, shrink,
// write RGBA or, for an indexed source, indexed with its palette, with only the
// chunks a browser needs.
const zlib = require("zlib");

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// What a row filter predicts from the bytes left (a), above (b) and above
// left (c).
function predict(filter, a, b, c) {
  switch (filter) {
    case 1:
      return a;
    case 2:
      return b;
    case 3:
      return (a + b) >> 1;
    case 4:
      return paeth(a, b, c);
    default:
      return 0;
  }
}

// { width, height, data, palette }: data holds width × height RGBA pixels;
// palette, for an indexed PNG only, its colors as [r, g, b, a].
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file");
  let width = 0;
  let height = 0;
  let depth = 0;
  let color = 0;
  let channels = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  for (let o = 8; o < buf.length;) {
    const length = buf.readUInt32BE(o);
    const type = buf.toString("latin1", o + 4, o + 8);
    const body = buf.subarray(o + 8, o + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      [depth, color] = body.subarray(8);
      channels = { 2: 3, 3: 1, 6: 4 }[color] || 0;
      const depths = color === 3 ? [1, 2, 4, 8] : [8];
      if (!channels || !depths.includes(depth) || body[12] !== 0) {
        throw new Error("only non-interlaced 8-bit RGB, RGBA or indexed PNGs are supported");
      }
    } else if (type === "PLTE") {
      plte = body;
    } else if (type === "tRNS") {
      trns = body;
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    o += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  // Filters work on whole bytes: a pixel's, or one byte for sub-byte indexes.
  const bpp = Math.max(1, (depth * channels) >> 3);
  const stride = Math.ceil((width * depth * channels) / 8);
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pixels[row + x - bpp] : 0;
      const b = y > 0 ? pixels[row - stride + x] : 0;
      const c = x >= bpp && y > 0 ? pixels[row - stride + x - bpp] : 0;
      pixels[row + x] = (line[x] + predict(filter, a, b, c)) & 0xff;
    }
  }
  if (color === 6) return { width, height, data: pixels };
  const data = Buffer.alloc(width * height * 4, 255);
  if (color === 2) {
    for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) pixels.copy(data, j, i, i + 3);
    return { width, height, data };
  }
  const palette = [];
  for (let i = 0; i * 3 < plte.length; i++) {
    const alpha = trns && i < trns.length ? trns[i] : 255;
    palette.push([plte[i * 3], plte[i * 3 + 1], plte[i * 3 + 2], alpha]);
  }
  const colors = Uint8Array.from(palette.flat());
  const mask = (1 << depth) - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = x * depth;
      const index = (pixels[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & mask;
      const o = (y * width + x) * 4;
      data[o] = colors[index * 4];
      data[o + 1] = colors[index * 4 + 1];
      data[o + 2] = colors[index * 4 + 2];
      data[o + 3] = colors[index * 4 + 3];
    }
  }
  return { width, height, data, palette };
}

// The source pixels each output pixel covers, from first on, with how much
// of each: an area average keeps the terminal text sharp where
// nearest-neighbour would drop strokes.
function coverage(from, to) {
  const scale = from / to;
  return Array.from({ length: to }, (_, i) => {
    const start = i * scale;
    const end = start + scale;
    const first = Math.floor(start);
    const weights = new Float64Array(Math.min(Math.ceil(end), from) - first);
    for (let k = 0; k < weights.length; k++) {
      const s = first + k;
      weights[k] = (Math.min(end, s + 1) - Math.max(start, s)) / scale;
    }
    return { first, weights };
  });
}

// Shrinks to the given width, keeping the aspect ratio. Colors are averaged
// premultiplied by alpha, so transparent pixels don't darken the edges. An
// indexed image keeps its palette for encodePng.
function resizePng({ width, height, data, palette }, toWidth) {
  const toHeight = Math.max(1, Math.round((height * toWidth) / width));
  const columns = coverage(width, toWidth);
  const rows = coverage(height, toHeight);
  const wide = new Float64Array(toWidth * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < toWidth; x++) {
      const out = (y * toWidth + x) * 4;
      const { first, weights } = columns[x];
      for (let k = 0; k < weights.length; k++) {
        const i = (y * width + first + k) * 4;
        const alpha = (data[i + 3] / 255) * weights[k];
        wide[out] += data[i] * alpha;
        wide[out + 1] += data[i + 1] * alpha;
        wide[out + 2] += data[i + 2] * alpha;
        wide[out + 3] += alpha;
      }
    }
  }
  const out = Buffer.alloc(toWidth * toHeight * 4);
  for (let y = 0; y < toHeight; y++) {
    for (let x = 0; x < toWidth; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const { first, weights } = rows[y];
      for (let k = 0; k < weights.length; k++) {
        const i = ((first + k) * toWidth + x) * 4;
        r += wide[i] * weights[k];
        g += wide[i + 1] * weights[k];
        b += wide[i + 2] * weights[k];
        a += wide[i + 3] * weights[k];
      }
      const o = (y * toWidth + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round(a * 255);
      }
    }
  }
  return { width: toWidth, height: toHeight, data: out, palette };
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

// The palette entry nearest to the RGBA pixel at data[i].
function nearest(palette, data, i) {
  let best = 0;
  let bestDistance = Infinity;
  palette.forEach(([r, g, b, a], index) => {
    const distance =
      (data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2 + (data[i + 3] - a) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

// With a palette, each pixel becomes its nearest palette color: a screenshot
// already holds its text's anti-aliased shades, so a shrunk copy stays sharp
// and as small as an indexed original. Indexed rows compress best unfiltered;
// RGBA rows get the filter whose output sums smallest.
function encodePng({ width, height, data, palette }) {
  const channels = palette ? 1 : 4;
  let pixels = data;
  if (palette) {
    pixels = Buffer.alloc(width * height);
    const indexOf = new Map();
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const key = data.readUInt32BE(i);
      if (!indexOf.has(key)) indexOf.set(key, nearest(palette, data, i));
      pixels[p] = indexOf.get(key);
    }
  }
  const filters = palette ? [0] : [0, 1, 2, 3, 4];
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    let best = Infinity;
    for (const filter of filters) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? pixels[row + x - channels] : 0;
        const b = y > 0 ? pixels[row - stride + x] : 0;
        const c = x >= channels && y > 0 ? pixels[row - stride + x - channels] : 0;
        const value = (pixels[row + x] - predict(filter, a, b, c)) & 0xff;
        candidate[x] = value;
        sum += value < 128 ? value : 256 - value;
      }
      if (sum < best) {
        best = sum;
        raw[y * (stride + 1)] = filter;
        candidate.copy(raw, y * (stride + 1) + 1);
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, palette ? 3 : 6, 0, 0, 0], 8);
  const paletteChunks = palette
    ? [chunk("PLTE", Buffer.from(palette.flatMap(([r, g, b]) => [r, g, b])))]
    : [];
  if (palette && palette.some(([, , , a]) => a < 255)) {
    paletteChunks.push(chunk("tRNS", Buffer.from(palette.map(([, , , a]) => a))));
  }
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    // sRGB, perceptual: the colors are the screenshots' own.
    chunk("sRGB", Buffer.from([0])),
    ...paletteChunks,
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { decodePng, resizePng, encodePng };
