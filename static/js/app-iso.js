"use strict";

// App part: the isometric 3D world under the svg, drawn with Three.js (static/vendor/three.min.js, r158, the last
// release with a plain-script build). It shows the ground, paths, the log cabins with their walls cut low at the
// front, the furniture of every bed, trees, rocks, bushes and a campfire, as a static pixel-voxel world.
// Everything that can be tapped stays in the svg on top (beds, figures, boards): the camera here is orthographic and
// uses the same projection as logic-iso.js, and isoSync() points it at the svg's viewBox after every zoom or pan, so
// both layers always line up. Without WebGL the svg draws flat floors instead (drawBase) and the app still works.
// Roofs are left off (cutaway); a house keeps its roof colours on the cap log of its tall walls.
// The day-night slider lights this world (isoLight) and a little life moves in it: campfire, chimney smoke, falling leaves,
// fireflies (isoBuildLife, isoTick); everything moving steps on one shared 8 fps tick and sleeps while the tab is hidden.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var ISO_PIXEL_RATIO = 1;      // one WebGL pixel per CSS pixel: slightly chunky on a phone, which suits the pixel style
var ISO_CAMERA_DIST = 2500;   // the orthographic camera sits this far from the origin along its view axis
var ISO_FRAME_MS = 33;        // about 30 frames a second while something moves
var ISO_C = {
  log: "#7A4B2A", logLight: "#8E5A33", post: "#4E3020", brick: "#8E3B2A", mortar: "#6E2C20", chimneyCap: "#5A4A40", leafGreen: "#5E6B24",
  plankLine: "rgba(0,0,0,.08)", glass: "#9FD3F0", frame: "#4E3020",
  pine: "#2F5D3A", pineDark: "#234A2E", pineLight: "#3F7448", trunk: "#5C4033",
  rock: "#8C8C84", rockDark: "#6F6F68", bush: "#6B7A2E", bushRed: "#9C3B22", cap: "#C0392B", stem: "#F2E6CF",
  fireLog: "#5C3820", stone: "#7D7464", pebble: "#BFA477"
};
var ISO_PINE_MAX = 1.2;       // a taller pine would reach above the headroom the scene reserves under the boards
var iso3 = null;
var ISO_FEATURE_TREE = 1.5;      // size of the big tree that sways when tapped

// --- a box builder: every static box of the world goes into one geometry with vertex colours (one draw call) ---

// The five faces of a unit box (no bottom): normal, then the corners counter-clockwise seen from outside.
var ISO_FACES = [
  [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]],
  [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
  [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
  [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]],
  [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]
];

function IsoBoxes() {
  this.pos = [];
  this.nor = [];
  this.col = [];
  this.idx = [];
  this.colors = {};
}

// A box over the plan rect (x, y, w, d) from height h0 to h1, in map units. `color` is a CSS colour.
IsoBoxes.prototype.box = function (x, y, w, d, h0, h1, color) {
  if (!(w > 0 && d > 0 && h1 > h0)) return;
  var c = this.colors[color] || (this.colors[color] = new THREE.Color(color));
  var self = this;
  ISO_FACES.forEach(function (face) {
    var base = self.pos.length / 3;
    face[1].forEach(function (k) {
      self.pos.push(x + k[0] * w, h0 + k[1] * (h1 - h0), y + k[2] * d);
      self.nor.push(face[0][0], face[0][1], face[0][2]);
      self.col.push(c.r, c.g, c.b);
    });
    self.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
};

IsoBoxes.prototype.geometry = function () {
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
  g.setIndex(this.idx);
  return g;
};

IsoBoxes.prototype.mesh = function (material) {
  var m = new THREE.Mesh(this.geometry(), material || new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

// --- textures ---

// The grass: a 32 x 32 pixel canvas over 64 map units, tufts and fallen leaves in the scene colours.
function isoGrassTexture() {
  var cv = document.createElement("canvas"), n = 32, i;
  cv.width = cv.height = n;
  var ctx = cv.getContext("2d");
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, n, n);
  var colors = [COLORS.tuft, COLORS.tuft, COLORS.tuft, "#9AA853", COLORS.leafRust, COLORS.leafOchre, COLORS.leafRed];
  for (i = 0; i < 46; i++) {
    ctx.fillStyle = colors[Math.floor(isoNoise(i, 21) * colors.length)];
    ctx.fillRect(Math.floor(isoNoise(i, 22) * n), Math.floor(isoNoise(i, 23) * n), 1, 1 + (isoNoise(i, 24) < .3 ? 1 : 0));
  }
  var tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

// --- the world ---

function isoFloor(b, room) {
  var r = room.rect, x = r[0] + 4, y = r[1] + 4, w = r[2] - 8, d = r[3] - 8, k = 0;
  var dark = new THREE.Color(room.floor).multiplyScalar(0.88).getStyle();
  for (var px = x; px < x + w; px += 6, k++) b.box(px, y, Math.min(6, x + w - px), d, 0, 1, k % 2 ? room.floor : dark);
}

// A wall box (logs of 3.5 units, a lighter cap on top). Tall walls get darker corner posts at their ends.
function isoWall(b, wall, roof) {
  var k = 0, h;
  for (h = wall.h0; h < wall.h; h += 3.5, k++) {
    b.box(wall.x, wall.y, wall.w, wall.d, h, Math.min(wall.h, h + 3.5), k % 2 ? ISO_C.logLight : ISO_C.log);
  }
  if (!wall.tall || !roof) {
    b.box(wall.x - 0.3, wall.y - 0.3, wall.w + 0.6, wall.d + 0.6, wall.h, wall.h + 1, ISO_C.logLight);
    return;
  }
  b.box(wall.x - 0.3, wall.y - 0.3, wall.w + 0.6, wall.d + 0.6, wall.h, wall.h + 1, roof.face);      // the cap log wears the roof colours
  if (wall.w >= wall.d) b.box(wall.x, wall.y + wall.d / 2 - 0.5, wall.w, 1, wall.h + 1, wall.h + 1.3, roof.ridge);
  else b.box(wall.x + wall.w / 2 - 0.5, wall.y, 1, wall.d, wall.h + 1, wall.h + 1.3, roof.ridge);
}

function isoWindow(b, glass, w) {
  var s = ISO.windowSill, t = s + ISO.windowH, along = w[2] >= w[3];
  glass.box(w[0] + 1, w[1] - 0.4, w[2] - 2, w[3] + 0.8, s, t, ISO_C.glass);
  if (along) {
    b.box(w[0], w[1] - 0.6, w[2], w[3] + 1.2, s - 1.5, s, ISO_C.frame);
    b.box(w[0], w[1] - 0.6, w[2], w[3] + 1.2, t, t + 1.5, ISO_C.frame);
    b.box(w[0] + w[2] / 2 - 0.5, w[1] - 0.6, 1, w[3] + 1.2, s, t, ISO_C.frame);
  } else {
    b.box(w[0] - 0.6, w[1], w[2] + 1.2, w[3], s - 1.5, s, ISO_C.frame);
    b.box(w[0] - 0.6, w[1], w[2] + 1.2, w[3], t, t + 1.5, ISO_C.frame);
  }
}

function isoChimney(b, outline, x) {
  var y = outline[1] - 3, top = ISO.wallH + 10, h;
  for (h = 0; h < top; h += 3) b.box(x, y, 6, 7, h, Math.min(top, h + 3), (h / 3) % 2 ? ISO_C.mortar : ISO_C.brick);
  b.box(x - 1, y - 1, 8, 9, top, top + 1.5, ISO_C.chimneyCap);
}

function isoQuilt(b, x, y, w, d, h, quilt) {
  b.box(x, y, w, d, h, h + 0.7, COLORS[quilt[0]]);
  for (var cy = y + 2, row = 0; cy < y + d - 1; cy += 3, row++) {
    for (var cx = x + (row % 2) * 3; cx < x + w - 1; cx += 6) b.box(cx, cy, Math.min(3, x + w - cx), Math.min(3, y + d - cy), h + 0.7, h + 0.8, COLORS[quilt[2]]);
  }
  b.box(x, y, w, 2, h, h + 1, COLORS[quilt[1]]);
}

function isoPillow(b, x, y, w, h) {
  b.box(x, y, w, 5, h, h + 1.6, COLORS.pillow);
  b.box(x, y + 4, w, 1, h, h + 1.2, COLORS.pillowShade);
}

// The furniture of a bed in 3D, by `kind`, over `bed.rect` (the same parts as drawFurniture of the flat map).
function isoFurniture(b, bed) {
  var x = bed.rect[0], y = bed.rect[1], w = bed.rect[2], d = bed.rect[3], i, n, top;
  var QB = ["quiltBlue", "quiltBlueFold", "quiltBlueCheck"], QR = ["quiltRed", "quiltRedFold", "quiltRedCheck"];
  switch (bed.kind) {
    case "bed2":
    case "bed1":
      b.box(x, y, w, d, 0, 4, COLORS.bedWood);
      b.box(x, y, w, 3, 0, 13, COLORS.bedWoodDark);
      b.box(x, y + d - 2, w, 2, 0, 9, COLORS.bedWoodDark);
      b.box(x + 1.5, y + 3, w - 3, d - 5, 4, 6.5, COLORS.sheet);
      if (bed.kind === "bed2") {
        isoPillow(b, x + 3, y + 4, (w - 8) / 2, 6.5);
        isoPillow(b, x + w / 2 + 1, y + 4, (w - 8) / 2, 6.5);
      } else {
        isoPillow(b, x + 3, y + 4, w - 6, 6.5);
      }
      top = y + Math.max(11, Math.round(d * 0.42));
      isoQuilt(b, x + 1.5, top, w - 3, y + d - 2 - top, 6.5, bed.kind === "bed2" ? QR : QB);
      break;
    case "cot":
      [[x, y], [x + w - 1, y], [x, y + d - 1], [x + w - 1, y + d - 1]].forEach(function (p) { b.box(p[0], p[1], 1, 1, 0, 4, COLORS.cotSteel); });
      b.box(x, y, w, d, 4, 5, COLORS.cotSteelDark);
      b.box(x + 1, y + 1, w - 2, d - 2, 5, 5.6, COLORS.cotCanvas);
      for (i = y + 8; i < y + d - 2; i += 6) b.box(x + 1, i, w - 2, 1, 5.6, 5.8, COLORS.cotCanvasLight);
      isoPillow(b, x + 3, y + 2, w - 6, 5.6);
      break;
    case "mats":
      for (i = 0; i < bed.slots.length; i++) {
        var mx = x + i * 46;
        b.box(mx, y, 32, d, 0, 1.2, COLORS.matFoam);
        b.box(mx + 1, y + 1, 30, d - 2, 1.2, 1.6, COLORS.matFoamLight);
        isoPillow(b, mx + 3, y + 2, 26, 1.6);
        b.box(mx + 2, y + 12, 28, d - 14, 1.6, 2.8, COLORS.bag);
        b.box(mx + 2, y + 12, 28, 2, 1.6, 3, COLORS.bagLight);
        b.box(mx + 15, y + 14, 1, d - 16, 2.8, 3, COLORS.bagDark);
      }
      break;
    case "bunk":
      [[x, y], [x + w - 2, y], [x, y + d - 2], [x + w - 2, y + d - 2]].forEach(function (p) { b.box(p[0], p[1], 2, 2, 0, 30, COLORS.bedWoodDark); });
      [[2, 4], [ISO_BUNK_TOP - 3, ISO_BUNK_TOP - 1]].forEach(function (lv) {
        b.box(x, y, w, d, lv[0], lv[1], COLORS.bedWood);
        b.box(x + 1, y + 1, w - 4, d - 2, lv[1], lv[1] + 1.5, COLORS.sheet);
        isoPillow(b, x + 2, y + 2, w - 7, lv[1] + 1.5);
        isoQuilt(b, x + 1, y + d * 0.42, w - 4, d * 0.58 - 1, lv[1] + 1.5, QB);
      });
      b.box(x, y, w, 1, ISO_BUNK_TOP, ISO_BUNK_TOP + 4, COLORS.bedWood);
      b.box(x, y + d - 1, w, 1, ISO_BUNK_TOP, ISO_BUNK_TOP + 4, COLORS.bedWood);
      for (i = 6; i < ISO_BUNK_TOP + 2; i += 4) b.box(x + w - 1, y + d / 2 - 4, 1.2, 8, i, i + 1, COLORS.bedWoodLight);      // ladder
      b.box(x + w - 1, y + d / 2 - 5, 1.2, 1, 0, ISO_BUNK_TOP + 4, COLORS.bedWoodLight);
      b.box(x + w - 1, y + d / 2 + 4, 1.2, 1, 0, ISO_BUNK_TOP + 4, COLORS.bedWoodLight);
      break;
    case "sofa":
    case "sofa1":
      n = bed.slots.length;
      b.box(x, y, 6, d, 0, 14, COLORS.sofaDark);                          // the backrest is on the left
      b.box(x + 6, y, w - 6, d, 0, 4, COLORS.sofaDark);
      b.box(x + 6, y, w - 6, 4, 0, 10, COLORS.sofaDark);                   // armrests
      b.box(x + 6, y + d - 4, w - 6, 4, 0, 10, COLORS.sofaDark);
      for (i = 0; i < n; i++) {
        var py = y + 4 + i * (d - 8) / n;
        b.box(x + 6, py, w - 8, (d - 8) / n - 0.6, 4, 7, COLORS.sofaLight);
        isoPillow(b, x + 8, py + 1, w - 14, 7);
      }
      break;
    case "stove":
      b.box(x, y, w, d, 0, 12, COLORS.stoveTileDark);
      b.box(x + 0.5, y + 0.5, w - 1, d - 1, 0.5, 13, COLORS.stoveTile);
      for (i = 3.5; i < 12; i += 3.5) b.box(x + 0.3, y + 0.3, w - 0.6, d - 0.6, i, i + 0.4, COLORS.stoveTileLine);
      for (i = x + 8; i < x + w; i += 8) b.box(i, y + d - 0.4, 0.5, 0.6, 0.5, 13, COLORS.stoveTileLine);
      b.box(x + 4, y + 5, w - 8, d - 9, 13, 13.6, COLORS.stoveBlanket);
      b.box(x + 4, y + 5, w - 8, 2, 13, 13.9, COLORS.pillow);
      b.box(x + 6, y + d - 0.6, 8, 0.8, 3, 8, COLORS.stovePipe);       // the fire door
      var pipe = stovePipeRect(bed);
      b.box(pipe[0] + 1, pipe[1] + 1, pipe[2] - 2, pipe[3] - 2, 0, 34, COLORS.stovePipe);
      b.box(pipe[0], pipe[1], pipe[2], pipe[3], 34, 35.5, COLORS.stovePipeLight);
      break;
  }
}

// --- decor ---

function isoLeafTree(b, x, y, s) {
  var trunkH = 12 * s, r = 10 * s, cell = 4 * s, cx = x, cy = y, cz = trunkH + r * 0.8, i, j, k;
  b.box(x - 1.6 * s, y - 1.6 * s, 3.2 * s, 3.2 * s, 0, trunkH + 2, ISO_C.trunk);
  var n = Math.ceil(r / cell), filled = {};
  function inside(i, j, k) {
    var dx = i * cell / r, dy = j * cell / r, dz = k * cell / (r * 0.85);
    return dx * dx + dy * dy + dz * dz <= 1 + (isoNoise(i * 7 + x, j * 13 + k * 3 + y) - 0.5) * 0.35;
  }
  for (i = -n; i <= n; i++) for (j = -n; j <= n; j++) for (k = -n; k <= n; k++) if (inside(i, j, k)) filled[i + "," + j + "," + k] = 1;
  for (i = -n; i <= n; i++) for (j = -n; j <= n; j++) for (k = -n; k <= n; k++) {
    if (!filled[i + "," + j + "," + k]) continue;
    if (filled[(i + 1) + "," + j + "," + k] && filled[i + "," + (j + 1) + "," + k] && filled[i + "," + j + "," + (k + 1)] &&
      filled[(i - 1) + "," + j + "," + k] && filled[i + "," + (j - 1) + "," + k]) continue;      // hidden inside the crown
    var f = (k + n) / (2 * n), noise = isoNoise(i * 3 + j * 5 + x, k * 7 + y);
    var color = f > 0.62 ? COLORS.leafOchre : f > 0.3 ? COLORS.leafRust : COLORS.leafRed;
    if (noise < 0.12) color = COLORS.leafOchre; else if (noise > 0.93) color = ISO_C.leafGreen;
    b.box(cx + i * cell - cell / 2, cy + j * cell - cell / 2, cell, cell, cz + k * cell, cz + (k + 1) * cell, color);
  }
}

function isoPine(b, x, y, s) {
  b.box(x - 1.5 * s, y - 1.5 * s, 3 * s, 3 * s, 0, 8 * s, ISO_C.trunk);
  var tiers = [[14, 6, 13], [11, 12, 19], [8, 18, 25], [5, 24, 31], [2.4, 30, 35]];
  tiers.forEach(function (t, i) {
    var half = t[0] * s;
    b.box(x - half, y - half, 2 * half, 2 * half, t[1] * s, t[2] * s, i % 2 ? ISO_C.pine : ISO_C.pineDark);
    b.box(x - half + 1, y - half + 1, 2 * half - 2, 2 * half - 2, t[2] * s, t[2] * s + 0.6, ISO_C.pineLight);
  });
}

function isoRock(b, x, y, s) {
  b.box(x - 3 * s, y - 2 * s, 6 * s, 4 * s, 0, 3 * s, ISO_C.rock);
  b.box(x - 2 * s, y - 1 * s, 3 * s, 3 * s, 3 * s, 4.5 * s, ISO_C.rockDark);
}

function isoBush(b, x, y, s, red) {
  b.box(x - 4 * s, y - 3 * s, 8 * s, 6 * s, 0, 4 * s, red ? ISO_C.bushRed : ISO_C.bush);
  b.box(x - 2.5 * s, y - 2 * s, 5 * s, 4 * s, 4 * s, 6 * s, red ? COLORS.leafRust : COLORS.tuft);
}

function isoMushroom(b, x, y) {
  b.box(x - 0.5, y - 0.5, 1, 1, 0, 2, ISO_C.stem);
  b.box(x - 1.5, y - 1.5, 3, 3, 2, 3, ISO_C.cap);
}

// A free spot for the campfire near the preferred point: no room, path, meadow or door within `clear` units.
function isoFreeSpot(layout, candidates, clear) {
  var blocked = layout.rooms.map(function (r) { return r.rect; }).concat(layout.map.paths || [], layout.map.doors || []);
  if (layout.map.scene && layout.map.scene.meadow) blocked.push(layout.map.scene.meadow);
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!blocked.some(function (r) { return rectsOverlap([c[0] - clear, c[1] - clear, 2 * clear, 2 * clear], r); })) return c;
  }
  return null;
}

// The stones, logs and seats of the campfire; its flames move and are built by isoBuildLife.
function isoCampfire(b, x, y) {
  for (var i = 0; i < 8; i++) {
    var a = i / 8 * Math.PI * 2;
    b.box(x + Math.cos(a) * 7 - 1.5, y + Math.sin(a) * 7 - 1.5, 3, 3, 0, 2, ISO_C.stone);
  }
  b.box(x - 4, y - 1, 8, 2, 0, 2.5, ISO_C.fireLog);
  b.box(x - 1, y - 4, 2, 8, 1, 3.5, ISO_C.fireLog);
  [[-18, -4, 6, 14], [14, -6, 6, 14], [-6, 15, 14, 5]].forEach(function (s) {      // log seats around it
    b.box(x + s[0], y + s[1], s[2], s[3], 0, 4, COLORS.wood);
    b.box(x + s[0], y + s[1], s[2], s[3], 4, 4.6, COLORS.woodLight);
  });
}

// --- building, syncing and drawing ---

function isoAvailable() {
  return typeof THREE !== "undefined";
}

// The 3D world runs (WebGL worked and the canvas is alive): the svg then draws no ground of its own.
function isoActive() {
  return !!iso3 && !iso3.lost;
}

// The tall walls of a house are cut low where another house stands closer than ISO_CUT_NEAR units behind them
// (north of a north wall, west of a west wall), so a tall wall never hides the rooms of its neighbour.
var ISO_CUT_NEAR = 30;
function isoCutWalls(walls, house, layout) {
  var others = layout.rooms.filter(function (r) { return house.rooms.indexOf(r.id) < 0; });
  return walls.filter(function (w) {
    if (!w.tall) return true;
    var probe = w.w >= w.d ? [w.x, w.y - ISO_CUT_NEAR, w.w, ISO_CUT_NEAR] : [w.x - ISO_CUT_NEAR, w.y, ISO_CUT_NEAR, w.d];
    if (!others.some(function (r) { return rectsOverlap(probe, r.rect); })) return true;
    w.tall = false;
    if (w.h0 >= ISO.lowWall) return false;       // a lintel above a door: nothing left of it
    w.h = ISO.lowWall;
    return true;
  });
}

// The corner posts of a room: tall on the north and west outline of the house, low elsewhere.
function isoPosts(b, room, outline) {
  var r = room.rect, T = 4;
  [[r[0], r[1]], [r[0] + r[2] - T, r[1]], [r[0], r[1] + r[3] - T], [r[0] + r[2] - T, r[1] + r[3] - T]].forEach(function (p) {
    var tall = p[0] === outline[0] || p[1] === outline[1];
    b.box(p[0], p[1], T, T, 0, tall ? ISO.wallH + 1 : ISO.lowWall + 1, ISO_C.post);
  });
}

// Builds the WebGL world into `host` (before the svg). Returns false when WebGL is not available.
function isoBuild(host, layout, sc) {
  isoDispose();
  if (!isoAvailable()) return false;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
  } catch (e) {
    return false;
  }
  renderer.useLegacyLights = true;
  renderer.setPixelRatio(ISO_PIXEL_RATIO);
  renderer.setClearColor(COLORS.grass);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.shadowMap.autoUpdate = false;
  var canvas = renderer.domElement;
  canvas.className = "iso-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.insertBefore(canvas, host.firstChild);

  var scene = new THREE.Scene();
  var vb = layout.map.viewbox, cx = vb[0] / 2, cy = vb[1] / 2;
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 8000);
  var basis = sc.basis;
  camera.up.set(-basis.s * basis.sp, basis.cp, -basis.c * basis.sp);
  camera.position.set(basis.s * basis.cp * ISO_CAMERA_DIST, basis.sp * ISO_CAMERA_DIST, basis.c * basis.cp * ISO_CAMERA_DIST);
  camera.lookAt(0, 0, 0);

  // light: sky and ground, and the sun high in the south-east (about 55 degrees), so shadows fall north-west
  var hemi = new THREE.HemisphereLight("#FFF4DC", "#5A6A30", 0.9);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight("#FFFFFF", 0.9);
  sun.position.set(cx + 210, 420, cy + 210);
  sun.target.position.set(cx, 0, cy);
  sun.castShadow = true;
  var reach = Math.max(vb[0], vb[1]) * 0.75 + 80;
  sun.shadow.camera.left = -reach; sun.shadow.camera.right = reach;
  sun.shadow.camera.top = reach; sun.shadow.camera.bottom = -reach;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 1600;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.002;
  scene.add(sun);
  scene.add(sun.target);

  // the grass covers far more than any pan or zoom can show, so no blank background ever appears
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ map: isoGrassTexture(), emissive: new THREE.Color("#000000") }));
  ground.material.map.repeat.set(6000 / 64, 6000 / 64);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cy);
  ground.receiveShadow = true;
  scene.add(ground);

  var b = new IsoBoxes(), glass = new IsoBoxes(), chimneys = [], i;
  (layout.map.paths || []).forEach(function (p, n) {
    b.box(p[0], p[1], p[2], p[3], 0, 0.5, COLORS.path);
    for (i = 0; i < p[2] * p[3] / 90; i++) {
      b.box(p[0] + 1 + isoNoise(i, n + 31) * (p[2] - 3), p[1] + 1 + isoNoise(i, n + 37) * (p[3] - 3), 2, 1.5, 0.5, 0.8, ISO_C.pebble);
    }
  });
  var houses = (layout.houses || []).slice(), housed = {};
  houses.forEach(function (h) { h.rooms.forEach(function (id) { housed[id] = true; }); });
  layout.rooms.forEach(function (r) { if (!housed[r.id]) houses.push({ id: r.id, rooms: [r.id], chimney: null }); });
  houses.forEach(function (house) {
    var rooms = layout.rooms.filter(function (r) { return house.rooms.indexOf(r.id) >= 0; });
    var outline = houseOutline(house, layout.rooms);
    if (!outline) return;
    rooms.forEach(function (room) {
      isoFloor(b, room);
      room.beds.forEach(function (bed) { isoFurniture(b, bed); });
      isoPosts(b, room, outline);
    });
    var walls = isoCutWalls(isoWalls(rooms, outline, layout.map.doors || []), house, layout);
    walls.forEach(function (wall) { isoWall(b, wall, house.roof); });
    (layout.map.doors || []).forEach(function (d) {
      if (rooms.some(function (r) { return rectsOverlap(d, r.rect); })) b.box(d[0], d[1], d[2], d[3], 0, 1.1, doorFloorColor(layout, d) || COLORS.path);
    });
    if (typeof house.chimney === "number") {
      isoChimney(b, outline, house.chimney);
      chimneys.push([house.chimney + 3, outline[1] - 3 + 3.5, ISO.wallH + 11.5]);      // where the smoke starts
    }
  });
  (layout.map.windows || []).forEach(function (w) { isoWindow(b, glass, w); });

  // the feature tree, the campfire and the forest: nothing within 12 units of a room, path, door, meadow or bed
  var worldTop = sc.block.y + sc.block.src[3] * sc.block.k + ISO.gap;
  function underBoards(t, height) {      // its top would reach the board block on the scene
    return isoPoint(sc, t.x, t.y, height * (t.size || 1))[1] < worldTop;
  }
  var treeSpot = isoFreeSpot(layout, [[44, 222], [40, 300], [330, 200], [300, 470]], 14) || [-30, 240];
  var fireSpot = isoFreeSpot(layout, [[310, 448], [320, 220], [44, 300], [200, 220]], 22);
  if (fireSpot) isoCampfire(b, fireSpot[0], fireSpot[1]);
  var keep = [[treeSpot[0] - 20, treeSpot[1] - 20, 40, 40]];
  if (fireSpot) keep.push([fireSpot[0] - 30, fireSpot[1] - 30, 60, 60]);
  var forest = isoTrees(layout, { keepOut: keep, count: 70 }), edge = isoTrees(layout, { keepOut: keep, count: 40, clear: 12, rim: 40 });
  forest.forEach(function (t) {
    if (underBoards(t, 45)) return;
    if (t.kind === "pine") isoPine(b, t.x, t.y, Math.min(t.size, ISO_PINE_MAX)); else isoLeafTree(b, t.x, t.y, t.size);
  });
  edge.forEach(function (t, n) {
    if (underBoards(t, 8)) return;
    if (n % 3 === 0) isoRock(b, t.x, t.y, t.size * 0.8);
    else if (n % 3 === 1) isoBush(b, t.x, t.y, t.size * 0.8, n % 2 === 0);
    else { isoMushroom(b, t.x - 2, t.y); isoMushroom(b, t.x + 2, t.y + 2); }
  });
  scene.add(b.mesh());
  var tree = new IsoBoxes();      // the big tree on its own, so a tap can sway it (isoRustle)
  isoLeafTree(tree, treeSpot[0], treeSpot[1], ISO_FEATURE_TREE);
  var pivot = new THREE.Group(), crown = tree.mesh();
  pivot.position.set(treeSpot[0], 0, treeSpot[1]);
  crown.position.set(-treeSpot[0], 0, -treeSpot[1]);
  pivot.add(crown);
  scene.add(pivot);
  var glassMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color("#FFD27A"), emissiveIntensity: 0 });      // lit by the lamps at night
  if (glass.pos.length) scene.add(glass.mesh(glassMat));

  var me = iso3 = { renderer: renderer, scene: scene, camera: camera, host: host, w: 0, h: 0, dirty: true, last: 0, raf: 0, lost: false,
    hemi: hemi, sun: sun, glass: glassMat, groundMat: ground.material, sc: sc, worldTop: worldTop, clock: 0, tickAt: 0, light: null,
    tree: { x: treeSpot[0], y: treeSpot[1], size: ISO_FEATURE_TREE, pivot: pivot, timer: 0 } };
  isoBuildLife(me, layout, { chimneys: chimneys, fire: fireSpot, leafTrees: forest.filter(function (t) { return t.kind === "leaf" && !underBoards(t, 45); }),
    edge: edge.filter(function (t) { return !underBoards(t, 10); }) });
  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();      // the browser may give the context back
    if (iso3 !== me) return;      // a late event of a disposed world
    me.lost = true;
    canvas.style.display = "none";
    if (app.layers) {      // draw the flat fallback at once; a restored context rebuilds the world (and removes it again)
      clearNode(app.layers.ground);
      clearNode(app.layers.base);
      drawGround(app.layers.ground, app.bounds);
      drawBase(app.layers.base, layout);
    }
  });
  canvas.addEventListener("webglcontextrestored", function () {
    if (iso3 !== me) return;
    app.layoutKey = null;      // rebuild once: all GPU objects are gone
    render();
  });
  renderer.shadowMap.needsUpdate = true;
  isoSync();
  isoLight(isoLastLight || lightAt(12));
  isoWake();
  return true;
}

// A tap on the big tree: its crown sways for 0.7 s (the svg tree-hit polygon calls this).
function isoRustle() {
  var t = iso3 && iso3.tree;
  if (!t || iso3.lost || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var start = performance.now();
  cancelAnimationFrame(t.timer);
  (function sway(now) {
    var p = Math.min(1, Math.floor((now - start) / 90) * 90 / 700), a = Math.sin(p * Math.PI * 5) * 0.06 * (1 - p);      // 90 ms steps
    t.pivot.rotation.z = a;
    t.pivot.rotation.x = a * 0.6;
    isoDirty();
    if (p < 1 && iso3 && iso3.tree === t) t.timer = requestAnimationFrame(sway);
  })(start);
}

function isoDispose() {
  if (!iso3) return;
  cancelAnimationFrame(iso3.raf);
  iso3.scene.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
  iso3.renderer.dispose();
  iso3.renderer.forceContextLoss();      // rebuilds must not pile up live contexts (browsers cap them)
  var c = iso3.renderer.domElement;
  if (c.parentNode) c.parentNode.removeChild(c);
  iso3 = null;
}

// Points the camera at the part of the scene the svg shows. The svg keeps the viewBox's aspect ratio
// (preserveAspectRatio meet), so the shown part is the view widened to the element's shape, centred.
function isoSync() {
  if (!iso3 || !app.view || !app.iso) return;
  var host = iso3.host, w = host.clientWidth, h = host.clientHeight;
  if (!(w > 0 && h > 0)) return;
  if (w !== iso3.w || h !== iso3.h) {
    iso3.renderer.setSize(w, h, false);
    iso3.w = w;
    iso3.h = h;
  }
  var v = app.view, s = Math.min(w / v.w, h / v.h), vw = w / s, vh = h / s;
  var vx = v.x - (vw - v.w) / 2, vy = v.y - (vh - v.h) / 2, sc = app.iso, cam = iso3.camera;
  cam.left = vx - sc.ox;
  cam.right = vx + vw - sc.ox;
  cam.top = sc.oy - vy;
  cam.bottom = sc.oy - (vy + vh);
  cam.updateProjectionMatrix();
  isoDirty();
}

// --- light, life and the frame loop ---

var isoLastLight = null;      // the last lightAt() result, so a rebuilt world starts with the right light

function isoMat(color, opacity) {
  return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity || 0, blending: THREE.AdditiveBlending, depthWrite: false, visible: false });
}

// A flat additive quad on the plan rect (x, y, w, d) at height h.
function isoQuad(x, y, w, d, h, mat) {
  var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
  m.position.set(x + w / 2, h, y + d / 2);
  return m;
}

// The side of a window or door that faces the outside: away from the centre of the room it belongs to.
function isoOutside(layout, r) {
  var room = layout.rooms.filter(function (q) { return rectsOverlap(r, q.rect); })[0], along = r[2] >= r[3];
  var c = room ? (along ? room.rect[1] + room.rect[3] / 2 : room.rect[0] + room.rect[2] / 2) : -Infinity;
  return (along ? r[1] + r[3] / 2 : r[0] + r[2] / 2) >= c ? 1 : -1;
}

// A spill of light of `depth` units on the ground, outside a window or a door.
function isoSpill(layout, r, depth, mat) {
  var along = r[2] >= r[3], s = isoOutside(layout, r);
  if (along) return isoQuad(r[0], s > 0 ? r[1] + r[3] : r[1] - depth, r[2], depth, 0.9, mat);
  return isoQuad(s > 0 ? r[0] + r[2] : r[0] - depth, r[1], depth, r[3], 0.9, mat);
}

// The lamps and the moving parts. They are cheap: additive quads (no real lights, except the campfire's), plain
// boxes, and no shadows. `ctx` has the chimney tops, the campfire spot and the trees to take leaves and fireflies from.
function isoBuildLife(me, layout, ctx) {
  var scene = me.scene, unit = new THREE.BoxGeometry(1, 1, 1), L = me.life = { mats: {}, flames: [], smoke: [], leaves: [], flies: [] };
  var m = L.mats;
  m.room = isoMat("#FFC76A"); m.window = isoMat("#FFD27A"); m.door = isoMat("#FFD27A"); m.ring = isoMat("#FFB060");
  layout.rooms.forEach(function (r) {
    var q = r.rect;
    scene.add(isoQuad(q[0] + 4, q[1] + 4, q[2] - 8, q[3] - 8, ISO.lowWall - 0.5, m.room));
  });
  (layout.map.windows || []).forEach(function (w) { scene.add(isoSpill(layout, w, 6, m.window)); });
  (layout.map.doors || []).forEach(function (d) { scene.add(isoSpill(layout, d, 10, m.door)); });

  if (ctx.fire) {      // the campfire: three flames, the one point light and a ring of light on the ground
    var fx = ctx.fire[0], fy = ctx.fire[1];
    L.flames = [["#E8741E", 4], ["#FFB43A", 2.6], ["#FFE08A", 1.4]].map(function (f) {
      var mesh = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: f[0] }));
      mesh.scale.x = mesh.scale.z = f[1];
      mesh.position.set(fx, 2, fy);
      scene.add(mesh);
      return mesh;
    });
    L.fire = new THREE.PointLight("#FF8A3A", 0.3, 70);
    L.fire.position.set(fx, 8, fy);
    scene.add(L.fire);
    scene.add(new THREE.Mesh(new THREE.CircleGeometry(18, 24).rotateX(-Math.PI / 2), m.ring).translateX(fx).translateY(0.9).translateZ(fy));
  }

  (ctx.chimneys || []).forEach(function (c) {      // chimney smoke: 3 puffs each
    for (var n = 0; n < 3; n++) {
      var mat = new THREE.MeshBasicMaterial({ color: "#C9C2B6", transparent: true, opacity: 0, depthWrite: false });
      var mesh = new THREE.Mesh(unit, mat);
      mesh.visible = false;
      scene.add(mesh);
      L.smoke.push({ mesh: mesh, mat: mat, c: c, n: n });
    }
  });

  var near = ctx.leafTrees.map(function (t) {      // leaves fall from the leaf trees nearest to the cabins
    var best = Infinity;
    layout.rooms.forEach(function (r) { best = Math.min(best, Math.abs(t.x - r.rect[0] - r.rect[2] / 2) + Math.abs(t.y - r.rect[1] - r.rect[3] / 2)); });
    return { t: t, d: best };
  }).sort(function (a, b) { return a.d - b.d; });
  var leafColors = [COLORS.leafOchre, COLORS.leafRust, COLORS.leafRed];
  for (var i = 0; i < 6 && near.length; i++) {
    var tr = near[i % near.length].t;
    var leaf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.5), new THREE.MeshBasicMaterial({ color: leafColors[i % 3] }));
    leaf.visible = false;
    scene.add(leaf);
    L.leaves.push({ mesh: leaf, x: tr.x + (isoNoise(i, 61) - 0.5) * 12 * tr.size, y: tr.y + (isoNoise(i, 62) - 0.5) * 12 * tr.size, top: 18 * tr.size });
  }

  m.fly = new THREE.MeshBasicMaterial({ color: "#F6F2A0", transparent: true, opacity: 0, depthWrite: false });
  ctx.edge.slice(0, 12).forEach(function (t, k) {      // fireflies at the forest and meadow edges (never under the boards)
    var fly = new THREE.Mesh(unit, m.fly);
    fly.visible = false;
    scene.add(fly);
    L.flies.push({ mesh: fly, x: t.x + (isoNoise(k, 63) - 0.5) * 16, y: t.y + (isoNoise(k, 64) - 0.5) * 16, z: 3 + isoNoise(k, 65) * 5 });
  });
}

// Lights the world for `l` = lightAt(h) (called by dnPaint on every slider step; there is no tween).
function isoLight(l) {
  isoLastLight = l;
  var me = iso3;
  if (!me || me.lost) return;
  var p = isoLightParams(l), m = me.life.mats;
  me.light = l;
  me.hemi.color.set(p.sky);
  me.hemi.groundColor.set(p.ground);
  me.hemi.intensity = p.hemi;
  me.groundMat.emissive.set(p.glow);
  me.sun.color.set(p.sun);
  me.sun.intensity = p.sunPower;
  me.glass.emissiveIntensity = l.lamp;
  [["room", 0.4], ["window", 0.25], ["door", 0.25], ["ring", 0.3]].forEach(function (e) {
    m[e[0]].opacity = e[1] * l.lamp;
    m[e[0]].visible = l.lamp > 0.002;
  });
  me.life.smoke.forEach(function (s) { s.mat.color.set(p.smoke); });
  isoMove(me);
  isoDirty();
}

// Puts every moving part where `me.clock` says (or at rest with reduced motion); called by each tick and by isoLight.
function isoMove(me) {
  var L = me.life, l = me.light, still = prefersReducedMotion(), t = still ? 0 : me.clock, sc = me.sc;
  if (!l) return;
  var frame = still ? 1 : isoFlameFrame(t);
  L.flames.forEach(function (f, k) {
    f.scale.y = ISO_FLAME_FRAMES[frame][k];
    f.position.y = 2 + f.scale.y / 2;
  });
  if (L.fire) L.fire.intensity = (0.3 + 1.3 * l.lamp) * (still ? 1 : isoFlicker(t));
  L.smoke.forEach(function (s) {
    var q = isoSmoke(t, s.n), y = s.c[2] + q.rise;
    s.mesh.visible = !still && q.opacity > 0.01 && isoPoint(sc, s.c[0], s.c[1], y)[1] >= me.worldTop;      // never over the boards
    s.mesh.scale.set(q.size, q.size, q.size);
    s.mesh.position.set(s.c[0], y, s.c[1]);
    s.mat.opacity = q.opacity;
  });
  var fall = !still && l.d <= 0.6;
  L.leaves.forEach(function (lf, i) {
    var q = isoLeaf(t, i, lf.top);
    lf.mesh.visible = fall;
    lf.mesh.position.set(lf.x + q.dx, Math.max(0.6, q.y), lf.y);
  });
  L.mats.fly.opacity = l.fireflies;
  L.flies.forEach(function (f, i) {
    var q = still ? { on: true, dx: 0, dy: 0 } : isoFirefly(t, i);
    f.mesh.visible = l.fireflies > 0.002 && q.on;
    f.mesh.position.set(f.x + q.dx, f.z, f.y + q.dy);
  });
}

function isoDirty() {
  if (!iso3) return;
  iso3.dirty = true;
  isoWake();
}

// Starts the frame loop if it sleeps; it stops by itself when nothing moves, nothing changed or the tab is hidden.
function isoWake() {
  if (!iso3 || iso3.raf || document.hidden) return;
  iso3.raf = requestAnimationFrame(isoLoop);
}

// Draws when the view changed (isoSync), the light changed or something moved, at most every ISO_FRAME_MS, and never
// while the page is hidden. Moving parts step on one tick of ISO_TICK_MS, driven by the frame time alone (no timers).
function isoLoop(now) {
  var me = iso3;
  if (!me) return;
  me.raf = 0;
  if (document.hidden || me.lost) return;      // isoWake runs again when the page is shown
  var moving = !prefersReducedMotion();
  if (moving) {
    if (!me.tickAt) me.tickAt = now;
    if (now - me.tickAt >= ISO_TICK_MS) {
      me.clock += Math.min(now - me.tickAt, 2 * ISO_TICK_MS);      // after a pause the cycles go on where they were
      me.tickAt = now;
      isoMove(me);
      me.dirty = true;
    }
  }
  if (me.dirty && now - me.last >= ISO_FRAME_MS && !me.renderer.getContext().isContextLost()) {      // the lost event may still be on its way
    me.last = now;
    me.renderer.render(me.scene, me.camera);
    me.dirty = false;
  }
  if (moving || me.dirty) me.raf = requestAnimationFrame(isoLoop);
}

document.addEventListener("visibilitychange", function () {
  if (!iso3) return;
  iso3.tickAt = 0;      // no catching up for the time spent hidden
  iso3.dirty = true;
  isoWake();
});
