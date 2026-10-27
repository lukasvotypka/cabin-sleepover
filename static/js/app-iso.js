"use strict";

// App part: the isometric 3D world under the svg, drawn with Three.js (static/vendor/three.min.js, r158, the last
// release with a plain-script build). It shows the ground, paths, the log cabins with their walls cut low at the
// front, the furniture of every bed, trees, rocks, bushes and a campfire, as a static pixel-voxel world.
// Everything that can be tapped stays in the svg on top (beds, figures, boards): the camera here is a slight perspective
// (orthographic with ISO.persp 0) and uses the same projection as logic-iso.js, and isoSync() points it at the svg's viewBox after every zoom or pan, so
// both layers always line up. Without WebGL the svg draws flat floors instead (drawBase) and the app still works.
// Each house is closed (tall walls, gable roof in its colours) or open (roof gone, front walls low); app-iso-roof.js builds and animates that.
// The day-night slider lights this world (isoLight) and a little life moves in it: campfire, chimney smoke, falling leaves,
// fireflies (isoBuildLife, isoTick); everything moving updates on one shared 30 fps tick and sleeps while the tab is hidden.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var ISO_PIXEL_RATIO_MAX = 1.5; // WebGL pixels per CSS pixel, at most: sharp, smooth edges on a phone without a 3x cost
var ISO_CAMERA_DIST = 2500;   // an orthographic camera (persp 0) sits this far from the origin along its view axis
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
var isoQuality = isoQualityStart();      // the automatic quality (logic-iso.js); kept across rebuilds of the world
var isoQualityExtraMs = 0;               // test hook: added to every measured frame interval to force slow frames
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

var ISO_SUN_ELEV = 24 * Math.PI / 180;      // the noon sun; later positions come from sunAt() (isoSunStep)
var ISO_SUN_AZ = ISO_NOON_SUN_AZ * Math.PI / 180;       // at the default view: west of south: shadows fall north-north-east, beside the objects as the south-east camera sees them (a sun east of south throws them straight behind the objects, out of sight)

function IsoBoxes() {
  this.pos = [];
  this.nor = [];
  this.col = [];
  this.idx = [];
  this.colors = {};
  this.boxes = [];      // boxes waiting for flush(): their faces are built once all boxes are known
}

// A box over the plan rect (x, y, w, d) from height h0 to h1, in map units. `color` is a CSS colour. `hidden` (optional)
// lists indices of ISO_FACES that touch another box and are never seen, so they are not built (crowns, stacked parts);
// `topColor` (optional) paints the top face in another colour.
IsoBoxes.prototype.box = function (x, y, w, d, h0, h1, color, hidden, topColor) {
  if (!(w > 0 && d > 0 && h1 > h0)) return;
  this.boxes.push({ x: x, y: y, w: w, d: d, h0: h0, h1: h1, color: color, hidden: hidden, top: topColor });
};

// Builds the faces of the boxes added so far, without those another box covers (stacked or touching boxes, a trunk inside
// a crown): they are never seen, and the shell of every box stays closed where it is seen. Runs once per box, on geometry().
IsoBoxes.prototype.flush = function () {
  var list = this.boxes, self = this;
  this.boxes = [];
  var grid = {}, CELL = 32;
  function cells(b, fn) {
    for (var gx = Math.floor((b.x - 1e-4) / CELL); gx <= Math.floor((b.x + b.w + 1e-4) / CELL); gx++)
      for (var gy = Math.floor((b.y - 1e-4) / CELL); gy <= Math.floor((b.y + b.d + 1e-4) / CELL); gy++) fn(gx + "," + gy);
  }
  list.forEach(function (b) { cells(b, function (k) { (grid[k] || (grid[k] = [])).push(b); }); });
  var E = 1e-4;
  list.forEach(function (b) {
    var near = [], seen = [];
    cells(b, function (k) { (grid[k] || []).forEach(function (o) { if (o !== b && seen.indexOf(o) < 0) { seen.push(o); near.push(o); } }); });
    for (var f = 0; f < ISO_FACES.length; f++) {
      if (b.hidden && b.hidden.indexOf(f) >= 0) continue;
      // the face's plane position p on its axis, and the rect it covers on the other two axes (x, y, height)
      var nx = ISO_FACES[f][0][0], ny = ISO_FACES[f][0][2], nh = ISO_FACES[f][0][1];
      var covered = near.some(function (o) {
        var lo, hi, p, inside;
        if (nh) { p = b.h1; lo = o.h0; hi = o.h1; inside = o.x <= b.x + E && o.x + o.w >= b.x + b.w - E && o.y <= b.y + E && o.y + o.d >= b.y + b.d - E; }
        else if (nx) { p = nx > 0 ? b.x + b.w : b.x; lo = o.x; hi = o.x + o.w; inside = o.y <= b.y + E && o.y + o.d >= b.y + b.d - E && o.h0 <= b.h0 + E && o.h1 >= b.h1 - E; }
        else { p = ny > 0 ? b.y + b.d : b.y; lo = o.y; hi = o.y + o.d; inside = o.x <= b.x + E && o.x + o.w >= b.x + b.w - E && o.h0 <= b.h0 + E && o.h1 >= b.h1 - E; }
        if (!inside) return false;
        var n = nh || nx || ny;
        return lo < p - E && hi > p + E || (n > 0 ? Math.abs(lo - p) < E : Math.abs(hi - p) < E) && hi - lo > 0;
      });
      if (!covered) self.face(f, b.x, b.y, b.w, b.d, b.h0, b.h1, f === 0 && b.top ? b.top : b.color);
    }
  });
};

// One face `f` (an index of ISO_FACES) of the box over (x, y, w, d, h0, h1); box() builds the visible ones, the crowns
// build merged runs of equal faces.
IsoBoxes.prototype.face = function (f, x, y, w, d, h0, h1, color) {
  var c = this.colors[color] || (this.colors[color] = new THREE.Color(color));
  var self = this, face = ISO_FACES[f];
  // the side faces are cut into flat bands near the ground (baked ambient occlusion); the top is never darkened
  var bands = f === 0 ? [{ a: h0, b: h1, shade: 1 }] : isoAoBands(h0, h1);
  bands.forEach(function (band) {
    var base = self.pos.length / 3;
    face[1].forEach(function (k) {
      self.pos.push(x + k[0] * w, f === 0 ? h0 + k[1] * (h1 - h0) : (k[1] ? band.b : band.a), y + k[2] * d);
      self.nor.push(face[0][0], face[0][1], face[0][2]);
      self.col.push(c.r * band.shade, c.g * band.shade, c.b * band.shade);
    });
    self.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
};

IsoBoxes.prototype.geometry = function () {
  this.flush();
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

// Flat dark shapes for the baked contact shadows: `polys` are lists of [x, z] corners at height y, drawn as one translucent mesh.
function isoBlobMesh(polys, y, opacity) {
  var pos = [], idx = [];
  polys.forEach(function (poly) {
    var base = pos.length / 3;
    poly.forEach(function (p) { pos.push(p[0], y, p[1]); });
    for (var i = 1; i + 1 < poly.length; i++) idx.push(base, base + i + 1, base + i);      // facing up
  });
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  var mat = new THREE.MeshBasicMaterial({ color: "#1A1020", transparent: true, opacity: opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  var m = new THREE.Mesh(g, mat);
  m.userData.aoOpacity = opacity;
  m.renderOrder = 1;
  return m;
}

function isoRectPoly(r) {
  return [[r[0], r[1]], [r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]], [r[0] + r[2], r[1]]];
}

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
  tex.magFilter = THREE.LinearFilter;
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

function isoChimney(b, y, x, top) {
  var h;
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
  function has(i, j, k) { return filled[i + "," + j + "," + k]; }
  // faces shared with a neighbouring cell are never seen: only the outside ones are built, and equally coloured
  // neighbours in one plane share one rectangle (greedy merge)
  var DIRS = [[0, 0, 0, 1], [1, 1, 0, 0], [2, -1, 0, 0], [3, 0, 1, 0], [4, 0, -1, 0]];      // face index, then the neighbour offset
  function colorAt(i, j, k) {
    var f = (k + n) / (2 * n), noise = isoNoise(i * 3 + j * 5 + x, k * 7 + y);
    if (noise < 0.12) return COLORS.leafOchre;
    if (noise > 0.93) return ISO_C.leafGreen;
    return f > 0.62 ? COLORS.leafOchre : f > 0.3 ? COLORS.leafRust : COLORS.leafRed;
  }
  DIRS.forEach(function (d) {
    var f = d[0], top = f === 0, side = f === 1 || f === 2;
    // (l, u, v): the layer along the face normal and the two axes in the face; at(l, u, v) maps back to (i, j, k)
    function at(l, u, v) { return top ? [u, v, l] : side ? [l, u, v] : [u, l, v]; }
    function shown(l, u, v) {
      var c = at(l, u, v);
      return has(c[0], c[1], c[2]) && !has(c[0] + d[1], c[1] + d[2], c[2] + d[3]);
    }
    for (var l = -n; l <= n; l++) {
      var done = {};
      for (var v = -n; v <= n; v++) for (var u = -n; u <= n; u++) {
        if (done[u + "," + v] || !shown(l, u, v)) continue;
        var c0 = at(l, u, v), color = colorAt(c0[0], c0[1], c0[2]), w = 1, h = 1, ok = true;
        function same(uu, vv) { var c = at(l, uu, vv); return !done[uu + "," + vv] && shown(l, uu, vv) && colorAt(c[0], c[1], c[2]) === color; }
        while (u + w <= n && same(u + w, v)) w++;
        while (ok && v + h <= n) {
          for (var q = 0; q < w; q++) if (!same(u + q, v + h)) { ok = false; break; }
          if (ok) h++;
        }
        for (var qv = 0; qv < h; qv++) for (var qu = 0; qu < w; qu++) done[(u + qu) + "," + (v + qv)] = 1;
        // the box that spans the merged cells: u and v span w and h cells along the face's axes
        var span = top ? [w, h, 1] : side ? [1, w, h] : [w, 1, h];
        b.face(f, cx + c0[0] * cell - cell / 2, cy + c0[1] * cell - cell / 2, span[0] * cell, span[1] * cell, cz + c0[2] * cell, cz + (c0[2] + span[2]) * cell, color);
      }
    }
  });
}

function isoPine(b, x, y, s) {
  b.box(x - 1.5 * s, y - 1.5 * s, 3 * s, 3 * s, 0, 6.5 * s, ISO_C.trunk);      // ends inside the lowest tier
  var tiers = [[14, 6, 13], [11, 12, 19], [8, 18, 25], [5, 24, 31], [2.4, 30, 35]];
  tiers.forEach(function (t, i) {
    var half = t[0] * s;
    b.box(x - half, y - half, 2 * half, 2 * half, t[1] * s, t[2] * s, i % 2 ? ISO_C.pine : ISO_C.pineDark, null, ISO_C.pineLight);      // the top is lit (replaces a thin slab)
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
// (behind it, on its outer side), so a tall wall never hides the rooms of its neighbour.
var ISO_CUT_NEAR = 30;
function isoCutWalls(walls, house, layout) {
  var others = layout.rooms.filter(function (r) { return house.rooms.indexOf(r.id) < 0; });
  return walls.filter(function (w) {
    if (!w.tall) return true;
    var N = ISO_CUT_NEAR, probe = { n: [w.x, w.y - N, w.w, N], s: [w.x, w.y + w.d, w.w, N], w: [w.x - N, w.y, N, w.d], e: [w.x + w.w, w.y, N, w.d] }[w.side];
    if (!others.some(function (r) { return rectsOverlap(probe, r.rect); })) return true;
    w.tall = false;
    if (w.h0 >= ISO.lowWall) return false;       // a lintel above a door: nothing left of it
    w.h = ISO.lowWall;
    return true;
  });
}

// The corner posts of a room: tall on the outline of the house on the two sides facing away from the camera (`b`, always
// there). The others are low once the house is open (`open`) and tall while it is closed (`closed`).
function isoPosts(b, room, outline, open, closed, azimuth) {
  var r = room.rect, T = 4, back = isoBackSides(azimuth);
  [[r[0], r[1]], [r[0] + r[2] - T, r[1]], [r[0], r[1] + r[3] - T], [r[0] + r[2] - T, r[1] + r[3] - T]].forEach(function (p) {
    if ((back.w && p[0] === outline[0]) || (back.e && p[0] + T === outline[0] + outline[2]) ||
        (back.n && p[1] === outline[1]) || (back.s && p[1] + T === outline[1] + outline[3])) {
      b.box(p[0], p[1], T, T, 0, ISO.wallH + 1, ISO_C.post);
    } else {
      open.box(p[0], p[1], T, T, 0, ISO.lowWall + 1, ISO_C.post);
      closed.box(p[0], p[1], T, T, 0, ISO.wallH + 1, ISO_C.post);
    }
  });
}

// Places the camera for a projection basis: with a slight perspective it looks at the middle of the plan from distance D
// (the frustum is set by isoSync), otherwise it sits ISO_CAMERA_DIST away on the view axis.
function isoPose(camera, basis) {
  camera.up.set(-basis.s * basis.sp, basis.cp, -basis.c * basis.sp);
  if (basis.D) {
    camera.position.set(basis.tx + basis.s * basis.cp * basis.D, basis.sp * basis.D, basis.ty + basis.c * basis.cp * basis.D);
    camera.lookAt(basis.tx, 0, basis.ty);
  } else {
    camera.position.set(basis.s * basis.cp * ISO_CAMERA_DIST, basis.sp * ISO_CAMERA_DIST, basis.c * basis.cp * ISO_CAMERA_DIST);
    camera.lookAt(0, 0, 0);
  }
}

// Builds the WebGL world into `host` (before the svg). Returns false when WebGL is not available.
function isoBuild(host, layout, sc) {
  isoDispose();
  if (!isoAvailable()) return false;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  } catch (e) {
    return false;
  }
  renderer.useLegacyLights = true;
  renderer.setPixelRatio(isoQualityRatio());
  renderer.setClearColor(COLORS.grass);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = ISO_QUALITY[isoQuality.level].soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  var canvas = renderer.domElement;
  canvas.className = "iso-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.insertBefore(canvas, host.firstChild);

  var scene = new THREE.Scene();
  var vb = layout.map.viewbox, cx = vb[0] / 2, cy = vb[1] / 2;
  var basis = sc.basis, camera;
  camera = basis.D ? new THREE.PerspectiveCamera(30, 1, 100, basis.D + 4000) : new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 8000);
  isoPose(camera, basis);

  // light: sky and ground, and a low sun (24 degrees) 20 degrees west of south, so long shadows fall north-north-east, beside the objects and away from the beds
  var hemi = new THREE.HemisphereLight("#FFF4DC", "#5A6A30", 0.9);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight("#FFFFFF", 0.9);
  var sunAz = ISO_SUN_AZ + (sc.azimuth - 45) * Math.PI / 180;      // the light turns with the view (isoSunAzimuth), so the shadows look the same from every side
  sun.position.set(cx + 600 * Math.cos(ISO_SUN_ELEV) * Math.sin(sunAz), 600 * Math.sin(ISO_SUN_ELEV), cy + 600 * Math.cos(ISO_SUN_ELEV) * Math.cos(sunAz));
  sun.target.position.set(cx, 0, cy);
  sun.castShadow = true;
  var reach = Math.hypot(vb[0], vb[1]) / 2 + 70;      // the plan and its rim of trees, as tight as the turned light camera allows
  sun.shadow.camera.left = -reach; sun.shadow.camera.right = reach;
  sun.shadow.camera.top = reach; sun.shadow.camera.bottom = -reach;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 1600;
  sun.shadow.camera.updateProjectionMatrix();      // three does not do this itself: without it the shadow camera keeps its default 10 x 10 frustum
  var small = Math.min(window.innerWidth, window.innerHeight) < 600;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
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
  var aoGround = [], aoFloor = [], aoFurn = [], floors = [], houseMeshes = [];      // contact shadows: plan polygons on the grass, on the floors, under furniture
  var houses = isoHouseList(layout);
  houses.forEach(function (house) {
    var rooms = layout.rooms.filter(function (r) { return house.rooms.indexOf(r.id) >= 0; });
    var outline = houseOutline(house, layout.rooms);
    if (!outline) return;
    var openFront = new IsoBoxes(), closedFront = new IsoBoxes(), roofs = isoRoofs(rooms, outline);
    rooms.forEach(function (room) {
      isoFloor(b, room);
      floors.push([room.rect[0] + 4, room.rect[1] + 4, room.rect[2] - 8, room.rect[3] - 8]);
      room.beds.forEach(function (bed) { isoFurniture(b, bed); aoFurn.push(isoRectPoly(isoGrowRect(bed.rect, 1))); });
      isoPosts(b, room, outline, openFront, closedFront, sc.azimuth);
    });
    var wo = Object.assign({}, ISO, { azimuth: sc.azimuth });      // the walls on the two sides facing away from the camera are tall
    var walls = isoCutWalls(isoWalls(rooms, outline, layout.map.doors || [], wo), house, layout);
    var tallKeys = {};
    walls.forEach(function (wall) { if (wall.tall) tallKeys[isoWallKey(wall)] = true; });
    // closed: every wall at full height; the ones that are not tall when open make up the "front" that sinks
    isoWalls(rooms, outline, layout.map.doors || [], Object.assign({}, wo, { lowWall: ISO.wallH })).forEach(function (wall) {
      if (!tallKeys[isoWallKey(wall)]) { wall.tall = true; isoWall(closedFront, wall, house.roof); }
    });
    walls.forEach(function (wall) {
      isoWall(wall.tall ? b : openFront, wall, house.roof);
      var band = isoGrowRect([wall.x, wall.y, wall.w, wall.d], ISO_AO_BAND);
      aoGround.push(isoRectPoly(band));
      floors.forEach(function (f) { var c = isoRectClip(band, f); if (c) aoFloor.push(isoRectPoly(c)); });
    });
    (layout.map.doors || []).forEach(function (d) {
      if (rooms.some(function (r) { return rectsOverlap(d, r.rect); })) b.box(d[0], d[1], d[2], d[3], 0, 1.1, doorFloorColor(layout, d) || COLORS.path);
    });
    if (typeof house.chimney === "number") {
      var chimneyTop = isoChimneyTop(roofs, house.chimney);
      var chimneyY = isoBackSides(sc.azimuth).n ? outline[1] - 3 : outline[1] + outline[3] - 4;      // on the wall at the back, whichever side that is
      isoChimney(b, chimneyY, house.chimney, chimneyTop);
      chimneys.push([house.chimney + 3, chimneyY + 3.5, chimneyTop + 1.5]);      // where the smoke starts
    }
    houseMeshes.push(isoHouseMeshes(scene, house, roofs, openFront, closedFront, sc.azimuth));
  });
  (layout.map.windows || []).forEach(function (w) { isoWindow(b, glass, w); });

  // the feature tree, the campfire and the forest: nothing within 12 units of a room, path, door, meadow or bed
  var worldTop = sc.top;
  function underBoards(t, height) {      // its top would reach above the scene
    return isoPoint(sc.ref, t.x, t.y, height * (t.size || 1))[1] < worldTop;
  }
  var treeSpot = isoFreeSpot(layout, [[44, 222], [40, 300], [330, 200], [300, 470]], 14) || [-30, 240];
  var fireSpot = isoFreeSpot(layout, [[310, 448], [320, 220], [44, 300], [200, 220]], 22);
  if (fireSpot) isoCampfire(b, fireSpot[0], fireSpot[1]);
  var keep = [[treeSpot[0] - 20, treeSpot[1] - 20, 40, 40]];
  if (fireSpot) keep.push([fireSpot[0] - 30, fireSpot[1] - 30, 60, 60]);
  ["board", "gate"].forEach(function (key) {      // no tree where a sign stands
    var at = layout.map.scene[key];
    if (at) keep.push([at[0] - 40, at[1] - 40, 80, 80]);
  });
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
  var aoTrees = [], aoCores = [];      // two stepped octagons per tree: the outer one -12 %, the inner one about -25 % together
  forest.forEach(function (t) {
    if (underBoards(t, 45)) return;
    var r = (t.kind === "pine" ? 9 : 8) * Math.min(t.size, t.kind === "pine" ? ISO_PINE_MAX : t.size);
    aoTrees.push(isoBlobPolygon(t.x, t.y, r));
    aoCores.push(isoBlobPolygon(t.x, t.y, r * 0.6));
  });
  aoTrees.push(isoBlobPolygon(treeSpot[0], treeSpot[1], 8 * ISO_FEATURE_TREE));
  aoCores.push(isoBlobPolygon(treeSpot[0], treeSpot[1], 8 * ISO_FEATURE_TREE * 0.6));
  var aoMeshes = [isoBlobMesh(aoGround, 0.06, 0.25), isoBlobMesh(aoFloor, 1.06, 0.25), isoBlobMesh(aoFurn, 1.06, 0.2),
    isoBlobMesh(aoTrees, 0.07, 0.12), isoBlobMesh(aoCores, 0.08, 0.14)];
  aoMeshes.forEach(function (m) { scene.add(m); });
  var tree = new IsoBoxes();      // the big tree on its own, so a tap can sway it (isoRustle)
  isoLeafTree(tree, treeSpot[0], treeSpot[1], ISO_FEATURE_TREE);
  var pivot = new THREE.Group(), crown = tree.mesh();
  pivot.position.set(treeSpot[0], 0, treeSpot[1]);
  crown.position.set(-treeSpot[0], 0, -treeSpot[1]);
  pivot.add(crown);
  scene.add(pivot);
  var glassMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color("#FFD27A"), emissiveIntensity: 0 });      // lit by the lamps at night
  glass.flush();
  if (glass.pos.length) scene.add(glass.mesh(glassMat));

  var me = iso3 = { renderer: renderer, scene: scene, camera: camera, host: host, w: 0, h: 0, dirty: true, last: 0, raf: 0, lost: false,
    hemi: hemi, sun: sun, ao: aoMeshes, glass: glassMat, groundMat: ground.material, sc: sc, worldTop: worldTop, clock: 0, tickAt: 0, light: null, houses: houseMeshes,
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
      if (app.state) renderBeds();      // the svg sprites take over
    }
  });
  canvas.addEventListener("webglcontextrestored", function () {
    if (iso3 !== me) return;
    app.layoutKey = null;      // rebuild once: all GPU objects are gone
    render();
  });
  renderer.shadowMap.needsUpdate = true;
  houseMeshes.forEach(function (h) { isoHouseApply(h, true); });
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
    var p = Math.min(1, (now - start) / 700), a = Math.sin(p * Math.PI * 5) * 0.06 * (1 - p);
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
  var sw = app.swing && app.swing.scene ? app.swing : null;      // while the map turns, the camera follows the swing (app-turn.js)
  var v = sw ? sw.view : app.view, s = Math.min(w / v.w, h / v.h), vw = w / s, vh = h / s;
  var vx = v.x - (vw - v.w) / 2, vy = v.y - (vh - v.h) / 2, sc = sw ? sw.scene : app.iso, cam = iso3.camera;
  isoSetCentre(sc, v.x + v.w / 2, v.y + v.h / 2);      // the eye travels with the pan: it stays above the plan point under the screen centre (T-147)
  if (sc.basis.D) isoPose(cam, sc.basis);
  var l = vx - sc.ox, r = vx + vw - sc.ox, t = sc.oy - vy, b = sc.oy - (vy + vh);
  if (sc.basis.D) {      // the crop of the full scene frame as an off-centre frustum (the principal point is at ox, oy), like the svg viewBox crop
    var n = cam.near / sc.basis.D;
    cam.projectionMatrix.makePerspective(l * n, r * n, t * n, b * n, cam.near, cam.far);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  } else {
    cam.left = l; cam.right = r; cam.top = t; cam.bottom = b;
    cam.updateProjectionMatrix();
  }
  if (!sw) isoAnchorsUpdate();      // the svg items follow the new centre (app-anchor.js)
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
  me.hemi.color.set(isoMix(p.sky, "#3A2E4A", 0.15));      // a cool tint, so shadowed areas lean purple like pixel-art shading
  me.hemi.groundColor.set(isoMix(p.ground, "#3A2E4A", 0.35));
  me.ao.forEach(function (a) { a.material.opacity = a.userData.aoOpacity * p.ao; });
  me.hemi.intensity = p.hemi;
  me.groundMat.emissive.set(p.glow);
  me.sun.color.set(p.sun);
  me.sun.intensity = p.sunPower;
  isoSunStep(me);
  me.glass.emissiveIntensity = l.lamp;
  [["room", 0.4], ["window", 0.25], ["door", 0.25], ["ring", 0.3]].forEach(function (e) {
    m[e[0]].opacity = e[1] * l.lamp;
    m[e[0]].visible = l.lamp > 0.002;
  });
  me.life.smoke.forEach(function (s) { s.mat.color.set(p.smoke); });
  isoMove(me);
  isoPeoplePose(me);
  isoDirty();
}

// Moves the sun (and so redraws the shadow map) only when it stands ≥ 2° (azimuth) or ≥ 1° (elevation) from where the
// shadows were last drawn, and at most once per shared tick; with reduced motion there is no tick, so it moves at once.
function isoSunStep(me) {
  var want = me.light && me.light.sun, got = me.sunDrawn;
  if (!want) return;
  var still = prefersReducedMotion();
  if (got && Math.abs(want.az - got.az) < 2 && Math.abs(want.elev - got.elev) < 1) return;
  if (got && !still && me.sunClock === me.clock) return;      // already moved on this tick; the next tick picks it up
  me.sunDrawn = { az: want.az, elev: want.elev };
  me.sunClock = me.clock;
  // Not isoSunAzimuth(): it snaps the view azimuth through isoAngle, but during a swing the sun must follow the unsnapped azimuth.
  var az = (want.az + ((app.swing && app.swing.scene ? app.swing.az : isoAngle(me.sc.azimuth)) - 45)) * Math.PI / 180, el = want.elev * Math.PI / 180, t = me.sun.target.position;
  me.sun.position.set(t.x + 600 * Math.cos(el) * Math.sin(az), 600 * Math.sin(el), t.z + 600 * Math.cos(el) * Math.cos(az));
  me.renderer.shadowMap.needsUpdate = true;
  me.shadowDraws = (me.shadowDraws || 0) + 1;
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
    s.mesh.visible = !still && q.opacity > 0.01 && isoPoint(sc.ref, s.c[0], s.c[1], y)[1] >= me.worldTop;      // never over the boards
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

function isoQualityRatio() {
  return Math.min(window.devicePixelRatio || 1, ISO_PIXEL_RATIO_MAX, ISO_QUALITY[isoQuality.level].px);
}

// Applies the current quality level to the renderer (pixel ratio, shadow filter).
function isoQualityApply(me) {
  var q = ISO_QUALITY[isoQuality.level], r = me.renderer;
  r.setPixelRatio(isoQualityRatio());
  r.setSize(me.w, me.h, false);
  var type = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (r.shadowMap.type !== type) {
    r.shadowMap.type = type;
    me.scene.traverse(function (o) { if (o.material) [].concat(o.material).forEach(function (m) { m.needsUpdate = true; }); });
  }
  r.shadowMap.needsUpdate = true;
  me.dirty = true;
}

// Feeds the time since the previous drawn frame into the automatic quality; only while things move (a still picture
// is drawn rarely, which is no sign of slowness).
function isoQualityFrame(me, now, moving) {
  var ms = moving && me.lastDraw ? now - me.lastDraw + isoQualityExtraMs : 0;
  me.lastDraw = now;
  var r = isoQualityStep(isoQuality, ms);
  isoQuality = r.state;
  if (r.change) isoQualityApply(me);
}

// Starts the frame loop if it sleeps; it stops by itself when nothing moves, nothing changed or the tab is hidden.
function isoWake() {
  if (!iso3 || iso3.raf || document.hidden) return;
  iso3.raf = requestAnimationFrame(isoLoop);
}

// Draws when the view changed (isoSync), the light changed or something moved, at most every ISO_FRAME_MS, and never
// while the page is hidden. Moving parts update on one tick of ISO_TICK_MS (~30 fps), driven by the frame time alone (no timers).
function isoLoop(now) {
  var me = iso3;
  if (!me) return;
  me.raf = 0;
  if (document.hidden || me.lost) return;      // isoWake runs again when the page is shown
  var moving = !prefersReducedMotion();
  if (moving) {
    if (!me.tickAt) me.tickAt = now;
    if (now - me.tickAt >= ISO_TICK_MS - 4) {      // a little early is fine: two 60 Hz frames are 33.3 ms
      var dt = Math.min(now - me.tickAt, 2 * ISO_STEP_MS);      // after a pause the cycles go on where they were
      me.clock += dt;
      me.tickAt = now;
      isoHousesTick(me, dt);
      isoMove(me);
      isoSunStep(me);
      isoPeopleTick(me);
      me.dirty = true;
    }
  }
  if (me.dirty && now - me.last >= ISO_FRAME_MS - 4 && !me.renderer.getContext().isContextLost()) {      // the lost event may still be on its way
    me.last = now;
    isoQualityFrame(me, now, moving);
    var started = isoFps.on ? performance.now() : 0;      // the fps meter (app-fps.js)
    if (isoFps.on) isoFpsGpuBegin(me.renderer.getContext());
    me.renderer.render(me.scene, me.camera);
    if (isoFps.on) isoFpsSample(started, me.renderer.info.render);
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
