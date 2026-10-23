// Regenerates static/icons/ and static/share/ from the exact cabin sprite and palette used by the
// loading splash in static/index.html (SPLASH_SPRITE, SPLASH_CROWN, COLORS, splashHash, splashPicture),
// so the icon and the share images stay the same picture as the app's own loading screen. No
// dependencies: PNG encoding uses only Node's built-in zlib plus a hand-rolled CRC32.
//
// Run after changing the splash sprite or palette in static/index.html, mirroring the change here first:
//   node scripts/gen-icons.js
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// --- ported verbatim from the #bootLogic script in static/index.html ---

const COLORS = {
  window: "#9FD3F0", white: "#FFFFFF", wood: "#B98B56", woodLight: "#D4A870", plank: "#6B4426",
  woodDark: "#5C4033", leafRed: "#8E3424", redEdge: "#6E2414", stoveDark: "#9E9E9E", stovePipe: "#6E6E6E",
  selected: "#F2D58A", path: "#D6BC8E", grass: "#8E9B48", tuft: "#76823A", leafRust: "#B5532A", leafOchre: "#D69A2E"
};

const SPLASH_SPRITE = [
  "..............cc..",
  "........EEEE..CC..",
  "......EERRRREECC..",
  "....EERRRRRRRREE..",
  "..EERRRRRRRRRRRREE",
  "DDDDDDDDDDDDDDDDDD",
  ".WWWWWWWWWWWWWWWW.",
  ".WDDDDWDDDDWDDDDW.",
  ".WDSSDWDPPDWDSSDW.",
  ".WDSSDWDPLDWDSSDW.",
  ".WDDDDWDPPDWDDDDW.",
  ".PPPPPPDPPDPPPPPP.",
  ".WWWWWWDPPDWWWWWW.",
  ".DDDDDDDPPDDDDDDD."
];
const SPLASH_SPRITE_KEYS = {
  R: "leafRed", E: "redEdge", D: "woodDark", W: "wood", L: "woodLight", P: "plank",
  S: "selected", C: "stoveDark", c: "stovePipe"
};
const SPLASH_CROWN = [
  "..OOOO..",
  ".OUUOUO.",
  "OUURUUUO",
  ".UUUURU.",
  "..UUUU.."
];
const SPLASH_CROWN_KEYS = { O: "leafOchre", U: "leafRust", R: "leafRed" };

function splashHash(col, row) {
  let h = (Math.imul(col + 1, 374761393) + Math.imul(row + 1, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// Same picture as static/index.html's splashPicture(), plus a withTrees switch (the original always
// draws trees when the grid is wide enough; the square icon turns them off to keep the cabin legible
// at 16px).
function splashPicture(cols, rows, withTrees) {
  cols = Math.floor(cols);
  rows = Math.floor(rows);
  const spriteH = SPLASH_SPRITE.length, spriteW = SPLASH_SPRITE[0].length;
  const top = Math.floor(rows * 0.6) - (spriteH - 1);
  const horizon = top + 10;
  const left = Math.floor((cols - spriteW) / 2);
  const pic = [];
  let r, c;

  for (r = 0; r < rows; r++) {
    const line = [];
    for (c = 0; c < cols; c++) line.push(r < horizon ? "window" : "grass");
    pic.push(line);
  }
  function put(c, r, key) {
    if (c >= 0 && c < cols && r >= 0 && r < rows) pic[r][c] = key;
  }
  function cloud(c0, r0, w) {
    for (let i = 1; i < w - 1; i++) put(c0 + i, r0, "white");
    for (let j = 0; j < w; j++) put(c0 + j, r0 + 1, "white");
  }

  for (c = 0; c < cols; c++) {
    if (splashHash(c, horizon - 1) % 4 !== 0) put(c, horizon - 1, "tuft");
    if (splashHash(c, horizon - 2) % 5 === 0) put(c, horizon - 2, "tuft");
  }
  if (horizon >= 6) {
    cloud(Math.floor(cols * 0.1), Math.floor(horizon * 0.12), 6);
    cloud(Math.floor(cols * 0.7), Math.floor(horizon * 0.3), 5);
  }

  if (withTrees && left >= 8) {
    const treeBase = [top + spriteH, top + spriteH - 2];
    const treeX = [Math.floor(left / 2), Math.floor((left + spriteW + cols) / 2)];
    for (let t = 0; t < 2; t++) {
      const tx = treeX[t], tb = treeBase[t];
      for (r = 0; r < 3; r++) { put(tx - 1, tb - r, "woodDark"); put(tx, tb - r, "woodDark"); }
      for (r = 0; r < SPLASH_CROWN.length; r++) {
        for (c = 0; c < SPLASH_CROWN[r].length; c++) {
          const ck = SPLASH_CROWN_KEYS[SPLASH_CROWN[r][c]];
          if (ck) put(tx - 4 + c, tb - 3 - (SPLASH_CROWN.length - 1 - r), ck);
        }
      }
    }
  }

  const doorCol = left + 8;
  for (r = top + spriteH; r < rows; r++) {
    const extra = Math.floor((r - (top + spriteH - 1)) / 6);
    for (c = doorCol - extra; c <= doorCol + 1 + extra; c++) {
      const edge = extra > 0 && (c === doorCol - extra || c === doorCol + 1 + extra);
      if (!(edge && splashHash(c, r) % 4 === 0)) put(c, r, "path");
    }
  }

  for (r = 0; r < spriteH; r++) {
    for (c = 0; c < spriteW; c++) {
      const key = SPLASH_SPRITE_KEYS[SPLASH_SPRITE[r][c]];
      if (key) put(left + c, top + r, key);
    }
  }

  for (r = 0; r < rows; r++) {
    for (c = 0; c < cols; c++) {
      if (pic[r][c] !== "grass") continue;
      const h = splashHash(c, r) % 40;
      if (h < 4) pic[r][c] = "tuft";
      else if (h === 4) pic[r][c] = "leafRust";
      else if (h === 5) pic[r][c] = "leafOchre";
      else if (h === 6) pic[r][c] = "leafRed";
    }
  }
  return pic;
}

// --- color-key grid -> RGBA raster (nearest-neighbor, crisp: matches the app's image-rendering:pixelated) ---

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const RGB = {};
for (const k in COLORS) RGB[k] = hexToRgb(COLORS[k]);

function rasterize(grid, outW, outH) {
  const rows = grid.length, cols = grid[0].length;
  const buf = Buffer.alloc(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const gr = Math.min(rows - 1, Math.floor((y * rows) / outH));
    for (let x = 0; x < outW; x++) {
      const gc = Math.min(cols - 1, Math.floor((x * cols) / outW));
      const rgb = RGB[grid[gr][gc]];
      const o = (y * outW + x) * 4;
      buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2]; buf[o + 3] = 255;
    }
  }
  return buf;
}

// --- minimal PNG encoder (8-bit RGBA, filter 0) ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(rgbaBuf, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA, no interlace
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgbaBuf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// --- ICO container wrapping PNG entries (supported by all current browsers/OSes) ---

function encodeICO(pngEntries) {
  const count = pngEntries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
  let offset = 6 + 16 * count;
  const dirs = [], datas = [];
  for (const { size, png } of pngEntries) {
    const d = Buffer.alloc(16);
    d[0] = size >= 256 ? 0 : size; d[1] = size >= 256 ? 0 : size;
    d[2] = 0; d[3] = 0;
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(png.length, 8);
    d.writeUInt32LE(offset, 12);
    dirs.push(d); datas.push(png);
    offset += png.length;
  }
  return Buffer.concat([header, ...dirs, ...datas]);
}

// --- build & write ---

const root = path.join(__dirname, "..", "static");
fs.mkdirSync(path.join(root, "icons"), { recursive: true });
fs.mkdirSync(path.join(root, "share"), { recursive: true });

// Square icon scene: cabin + sky + grass + path, no side trees (keeps the shape legible at 16px).
const ICON_COLS = 28, ICON_ROWS = 28;
const iconGrid = splashPicture(ICON_COLS, ICON_ROWS, false);

const ICON_SIZES = [16, 32, 48, 180, 192, 512];
const pngEntries = [];
for (const size of ICON_SIZES) {
  const raster = rasterize(iconGrid, size, size);
  const png = encodePNG(raster, size, size);
  let name;
  if (size === 180) name = "apple-touch-icon.png";
  else if (size === 192 || size === 512) name = `icon-${size}.png`;
  else name = `favicon-${size}.png`;
  fs.writeFileSync(path.join(root, "icons", name), png);
  if (size === 16 || size === 32 || size === 48) pngEntries.push({ size, png });
  console.log("wrote icons/" + name, size + "x" + size);
}
fs.writeFileSync(path.join(root, "icons", "favicon.ico"), encodeICO(pngEntries));
console.log("wrote icons/favicon.ico");

// Share/OG image: the full atmospheric scene (hills, clouds, trees, path) like the loading splash,
// at the standard link-preview size used by WhatsApp, Facebook and Twitter/X.
const OG_W = 1200, OG_H = 630;
const OG_COLS = 96, OG_ROWS = 50; // close to the 1200x630 ratio, fine enough detail
const ogGrid = splashPicture(OG_COLS, OG_ROWS, true);
fs.writeFileSync(path.join(root, "share", "og-image.png"), encodePNG(rasterize(ogGrid, OG_W, OG_H), OG_W, OG_H));
console.log("wrote share/og-image.png", OG_W + "x" + OG_H);

// Square variant of the same scene, for sharing the picture itself (e.g. as a WhatsApp photo).
const SQ = 1080, SQ_COLS = 60, SQ_ROWS = 60;
const sqGrid = splashPicture(SQ_COLS, SQ_ROWS, true);
fs.writeFileSync(path.join(root, "share", "poster-square.png"), encodePNG(rasterize(sqGrid, SQ, SQ), SQ, SQ));
console.log("wrote share/poster-square.png", SQ + "x" + SQ);
