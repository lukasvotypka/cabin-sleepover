// Pure page logic, part 7: the loading intro (splash picture and its exit).
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).

// --- loading intro: a full-screen pixel picture that stands still, then a blocky iris opens from the cabin door ---
// (The exit is still called "the fall" in names: BOOT_FALL_MS, startFall, splash.falling, boot--falling.)

var BOOT_MIN_MS = 1500;          // still splash before the exit may start, from page start
var BOOT_MIN_REDUCED_MS = 800;   // still splash with prefers-reduced-motion, then hidden at once
var BOOT_FALL_MS = 1100;         // the whole exit: the iris has cleared the screen by then
var SPLASH_STEP_MS = 80;         // one held step of the exit
var SPLASH_MAX_BLOCKS = 1500, SPLASH_MIN_BLOCK = 10, SPLASH_MAX_BLOCK = 40;

// BOOT_MIN_REDUCED_MS when reducedMotion is true, else BOOT_MIN_MS.
function bootMinMs(reducedMotion) {
  return reducedMotion ? BOOT_MIN_REDUCED_MS : BOOT_MIN_MS;
}

// How long the exit lasts: nothing with reduced motion, else BOOT_FALL_MS.
function bootFallMs(reducedMotion) {
  return reducedMotion ? 0 : BOOT_FALL_MS;
}

// How many ms the loading view must still stay: max(0, minMs - (nowMs - startMs)), never more than minMs.
// Any non-finite argument returns 0, so a broken clock never holds the map back.
function bootRemaining(startMs, nowMs, minMs) {
  if (typeof startMs !== "number" || typeof nowMs !== "number" || typeof minMs !== "number") return 0;
  if (!isFinite(startMs) || !isFinite(nowMs) || !isFinite(minMs)) return 0;
  return Math.min(minMs, Math.max(0, minMs - (nowMs - startMs)));
}

// The block grid that covers a vw x vh viewport (CSS px): {size, cols, rows}. The count is capped, not the size,
// so a phone gets about 1400 blocks of 13 to 15 px and a desktop about as many bigger ones.
function splashGrid(vw, vh) {
  if (typeof vw !== "number" || typeof vh !== "number" || !isFinite(vw) || !isFinite(vh) || vw <= 0 || vh <= 0) {
    return { size: SPLASH_MIN_BLOCK, cols: 0, rows: 0 };
  }
  var size = Math.ceil(Math.sqrt(vw * vh / SPLASH_MAX_BLOCKS));
  size = Math.min(SPLASH_MAX_BLOCK, Math.max(SPLASH_MIN_BLOCK, size));
  return { size: size, cols: Math.ceil(vw / size), rows: Math.ceil(vh / size) };
}

// The keys of COLORS (in the app script) that the splash picture may use: fixed scene colors only.
var SPLASH_COLOR_KEYS = [
  "window", "white", "wood", "woodLight", "plank", "woodDark", "leafRed", "redEdge", "stoveDark", "stovePipe",
  "selected", "path", "grass", "tuft", "leafRust", "leafOchre"
];

// The cabin seen from the front, one character per block (18 x 14). "." is transparent.
var SPLASH_SPRITE = [
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
var SPLASH_SPRITE_KEYS = {
  R: "leafRed", E: "redEdge", D: "woodDark", W: "wood", L: "woodLight", P: "plank",
  S: "selected", C: "stoveDark", c: "stovePipe"
};
// An autumn tree crown (8 x 5) of leafOchre (O), leafRust (U) and leafRed (R); the trunk is woodDark.
var SPLASH_CROWN = [
  "..OOOO..",
  ".OUUOUO.",
  "OUURUUUO",
  ".UUUURU.",
  "..UUUU.."
];
var SPLASH_CROWN_KEYS = { O: "leafOchre", U: "leafRust", R: "leafRed" };

// A small deterministic hash of (col, row): the same on every reload, so the picture and the tests are stable.
function splashHash(col, row) {
  var h = (Math.imul(col + 1, 374761393) + Math.imul(row + 1, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// The picture as `rows` arrays of `cols` COLORS keys: sky with clouds, hills, grass with tufts and fallen leaves,
// a path to the door, autumn trees when there is room, and the cabin sprite centered on the horizon.
// 0 x 0 (or any non-positive size) gives [].
function splashPicture(cols, rows) {
  if (typeof cols !== "number" || typeof rows !== "number" || !(cols >= 1) || !(rows >= 1)) return [];
  cols = Math.floor(cols);
  rows = Math.floor(rows);
  var spriteH = SPLASH_SPRITE.length, spriteW = SPLASH_SPRITE[0].length;
  var top = Math.floor(rows * 0.6) - (spriteH - 1);   // first row of the sprite; its base sits a bit below the middle
  var horizon = top + 10;                              // the first grass row
  var left = Math.floor((cols - spriteW) / 2);         // negative on a very narrow grid: the sprite is clipped
  var pic = [], r, c;

  for (r = 0; r < rows; r++) {
    var line = [];
    for (c = 0; c < cols; c++) line.push(r < horizon ? "window" : "grass");
    pic.push(line);
  }
  function put(c, r, key) {
    if (c >= 0 && c < cols && r >= 0 && r < rows) pic[r][c] = key;
  }
  function cloud(c0, r0, w) {
    for (var i = 1; i < w - 1; i++) put(c0 + i, r0, "white");
    for (var j = 0; j < w; j++) put(c0 + j, r0 + 1, "white");
  }

  // far hills at the horizon, ragged
  for (c = 0; c < cols; c++) {
    if (splashHash(c, horizon - 1) % 4 !== 0) put(c, horizon - 1, "tuft");
    if (splashHash(c, horizon - 2) % 5 === 0) put(c, horizon - 2, "tuft");
  }
  if (horizon >= 6) {
    cloud(Math.floor(cols * 0.1), Math.floor(horizon * 0.12), 6);
    cloud(Math.floor(cols * 0.7), Math.floor(horizon * 0.3), 5);
  }

  // trees on both sides, only when the grid is wide enough
  if (left >= 8) {
    var treeBase = [top + spriteH, top + spriteH - 2];
    var treeX = [Math.floor(left / 2), Math.floor((left + spriteW + cols) / 2)];
    for (var t = 0; t < 2; t++) {
      var tx = treeX[t], tb = treeBase[t];
      for (r = 0; r < 3; r++) { put(tx - 1, tb - r, "woodDark"); put(tx, tb - r, "woodDark"); }
      for (r = 0; r < SPLASH_CROWN.length; r++) {
        for (c = 0; c < SPLASH_CROWN[r].length; c++) {
          var ck = SPLASH_CROWN_KEYS[SPLASH_CROWN[r][c]];
          if (ck) put(tx - 4 + c, tb - 3 - (SPLASH_CROWN.length - 1 - r), ck);
        }
      }
    }
  }

  // the path from the door down, widening a little with distance
  var doorCol = left + 8;
  for (r = top + spriteH; r < rows; r++) {
    var extra = Math.floor((r - (top + spriteH - 1)) / 6);
    for (c = doorCol - extra; c <= doorCol + 1 + extra; c++) {
      var edge = extra > 0 && (c === doorCol - extra || c === doorCol + 1 + extra);
      if (!(edge && splashHash(c, r) % 4 === 0)) put(c, r, "path");
    }
  }

  // the cabin
  for (r = 0; r < spriteH; r++) {
    for (c = 0; c < spriteW; c++) {
      var key = SPLASH_SPRITE_KEYS[SPLASH_SPRITE[r][c]];
      if (key) put(left + c, top + r, key);
    }
  }

  // tufts and fallen leaves on the plain grass
  for (r = 0; r < rows; r++) {
    for (c = 0; c < cols; c++) {
      if (pic[r][c] !== "grass") continue;
      var h = splashHash(c, r) % 40;
      if (h < 4) pic[r][c] = "tuft";
      else if (h === 4) pic[r][c] = "leafRust";
      else if (h === 5) pic[r][c] = "leafOchre";
      else if (h === 6) pic[r][c] = "leafRed";
    }
  }
  return pic;
}

// The iris center in block units {col, row}: the middle of the cabin door in splashPicture's layout
// (sprite columns 8 and 9, rows 8 to 13). Off the grid on a very small one; the iris still opens from there.
function splashIrisCenter(cols, rows) {
  var top = Math.floor(rows * 0.6) - (SPLASH_SPRITE.length - 1);
  var left = Math.floor((cols - SPLASH_SPRITE[0].length) / 2);
  return { col: left + 9, row: top + 11 };
}

// The iris radius in blocks elapsedMs after the exit started, for a cols x rows grid. Held within each
// SPLASH_STEP_MS step, grows faster and faster, and by BOOT_FALL_MS reaches past the farthest corner,
// so every block is gone. 0 before the start or for a bad argument.
function splashIrisRadius(elapsedMs, cols, rows) {
  if (typeof elapsedMs !== "number" || !(elapsedMs >= 0) || !(cols >= 1) || !(rows >= 1)) return 0;
  var center = splashIrisCenter(cols, rows);
  var dx = Math.max(center.col, cols - center.col), dy = Math.max(center.row, rows - center.row);
  var full = Math.sqrt(dx * dx + dy * dy) + 1;
  var steps = Math.ceil(BOOT_FALL_MS / SPLASH_STEP_MS);
  var p = Math.min(1, (Math.floor(elapsedMs / SPLASH_STEP_MS) + 1) / steps);
  return full * p * p;
}

// True when the block at (col, row) is inside the iris: its center is closer than radius to the iris center.
function splashIrisGone(col, row, center, radius) {
  var dx = col + 0.5 - center.col, dy = row + 0.5 - center.row;
  return dx * dx + dy * dy < radius * radius;
}

// True when the iris has reached the box {x0, y0, x1, y1} (block units): its nearest point is inside the radius.
function splashIrisReaches(box, center, radius) {
  var dx = Math.max(box.x0 - center.col, 0, center.col - box.x1);
  var dy = Math.max(box.y0 - center.row, 0, center.row - box.y1);
  return dx * dx + dy * dy < radius * radius;
}
