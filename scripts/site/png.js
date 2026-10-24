"use strict";

// Just enough PNG for the site build to serve smaller copies of the
// screenshots without a dependency: read 8-bit RGB or RGBA, shrink, write
// RGBA with only the chunks a browser needs.
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

// { width, height, data }: data holds width × height RGBA pixels.
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file");
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  for (let o = 8; o < buf.length;) {
    const length = buf.readUInt32BE(o);
    const type = buf.toString("latin1", o + 4, o + 8);
    const body = buf.subarray(o + 8, o + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, color, , , interlace] = body.subarray(8);
      channels = { 2: 3, 6: 4 }[color] || 0;
      if (depth !== 8 || !channels || interlace !== 0) {
        throw new Error("only 8-bit, non-interlaced RGB or RGBA PNGs are supported");
      }
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    o += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[row + x - channels] : 0;
      const b = y > 0 ? pixels[row - stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[row - stride + x - channels] : 0;
      pixels[row + x] = (line[x] + predict(filter, a, b, c)) & 0xff;
    }
  }
  if (channels === 4) return { width, height, data: pixels };
  const data = Buffer.alloc(width * height * 4, 255);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) pixels.copy(data, j, i, i + 3);
  return { width, height, data };
}

// The source pixels each output pixel covers, with how much of each: an area
// average keeps the terminal text sharp where nearest-neighbour would drop
// strokes.
function coverage(from, to) {
  const scale = from / to;
  return Array.from({ length: to }, (_, i) => {
    const start = i * scale;
    const end = start + scale;
    const taps = [];
    for (let s = Math.floor(start); s < Math.min(Math.ceil(end), from); s++) {
      taps.push([s, (Math.min(end, s + 1) - Math.max(start, s)) / scale]);
    }
    return taps;
  });
}

// Shrinks to the given width, keeping the aspect ratio. Colors are averaged
// premultiplied by alpha, so transparent pixels don't darken the edges.
function resizePng({ width, height, data }, toWidth) {
  const toHeight = Math.max(1, Math.round((height * toWidth) / width));
  const columns = coverage(width, toWidth);
  const rows = coverage(height, toHeight);
  const wide = new Float64Array(toWidth * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < toWidth; x++) {
      const out = (y * toWidth + x) * 4;
      for (const [sx, weight] of columns[x]) {
        const i = (y * width + sx) * 4;
        const alpha = (data[i + 3] / 255) * weight;
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
      for (const [sy, weight] of rows[y]) {
        const i = (sy * toWidth + x) * 4;
        r += wide[i] * weight;
        g += wide[i + 1] * weight;
        b += wide[i + 2] * weight;
        a += wide[i + 3] * weight;
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
  return { width: toWidth, height: toHeight, data: out };
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

// Each row gets the filter whose output sums smallest, the usual heuristic
// for the best compression.
function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    let best = Infinity;
    for (let filter = 0; filter < 5; filter++) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? data[row + x - 4] : 0;
        const b = y > 0 ? data[row - stride + x] : 0;
        const c = x >= 4 && y > 0 ? data[row - stride + x - 4] : 0;
        const value = (data[row + x] - predict(filter, a, b, c)) & 0xff;
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
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    // sRGB, perceptual: the colors are the screenshots' own.
    chunk("sRGB", Buffer.from([0])),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { decodePng, resizePng, encodePng };
