// Pure page logic: the isometric view of the map (the 3D world drawn by app-iso.js, and the svg on top of it).
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).
//
// The layout in config/cabin.yaml stays a flat plan (x right, y down, in map units). The page shows it from the
// south-east and above: a ground point (x, y) at height h lands on the scene (the svg viewBox) at
//   u = x·cos(az) − y·sin(az),  v = (x·sin(az) + y·cos(az))·sin(tilt) − h·cos(tilt),  then shifted by (ox, oy).
// That is an orthographic projection, so the svg and the WebGL camera share it exactly: the svg draws beds, figures
// and boards at projected points, and app-iso.js points its camera so that its pixels land on the same scene units.
// The boards (title, time slider, night signposts, party table) and the icon signs do not lie on the ground: they
// stand as one upright block above the world, scaled by `boardScale` so that their text stays readable on a phone.

var ISO = {
  azimuth: 45,          // degrees: the plan turned so that its top left corner points up
  tilt: 30,             // degrees above the horizon: sin 30° = 0.5, the classic 2:1 pixel-art isometric
  boardScale: 1.6,      // the board block on top of the world
  figScale: 1.35,       // the people sprites standing on the beds
  margin: 12,           // grass around the whole scene
  gap: 14,              // between the board block and the highest point of the world
  headroom: 44,         // map units above the ground the world may reach (walls, chimneys, smoke)
  iconCell: [64, 64],   // one icon sign in the grid left of the boards, block units
  iconGap: 10,          // between the icon grid and the boards, block units
  wallH: 28,            // the back (north and west) outer walls of a house
  lowWall: 6,           // every other wall is cut low, so the rooms show
  doorH: 20,
  windowSill: 9,
  windowH: 10
};

// The icon signs in the grid left of the boards, row by row: [key, column, row].
var ISO_ICON_CELLS = [["notice", 0, 0], ["legend", 1, 0], ["letter", 0, 1], ["briefing", 1, 1], ["key", 0, 2], ["locked", 1, 2]];

// The top surface of each bed kind above the floor, and the height of each slot (bunk: the top berth is slot 0).
var ISO_BED_TOP = { bed2: 7, bed1: 7, cot: 6, mats: 2, sofa: 7, sofa1: 7, stove: 13, bunk: 5 };
var ISO_BUNK_TOP = 23;

function isoBasis(azimuthDeg, tiltDeg) {
  var a = azimuthDeg * Math.PI / 180, t = tiltDeg * Math.PI / 180;
  return { c: Math.cos(a), s: Math.sin(a), sp: Math.sin(t), cp: Math.cos(t) };
}

// The projected point before the scene shift: [u, v].
function isoRaw(basis, x, y, h) {
  return [x * basis.c - y * basis.s, (x * basis.s + y * basis.c) * basis.sp - (h || 0) * basis.cp];
}

// The union rect [x, y, w, h] of the given rects.
function unionRect(rects) {
  var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  rects.forEach(function (r) {
    x1 = Math.min(x1, r[0]); y1 = Math.min(y1, r[1]);
    x2 = Math.max(x2, r[0] + r[2]); y2 = Math.max(y2, r[1] + r[3]);
  });
  return [x1, y1, x2 - x1, y2 - y1];
}

// The whole isometric scene for a layout: the projection, the scene size and where the board block stands.
// Returns {basis, ox, oy, W, H, block: {src, x, y, k}, icons: {key: rect in block units}}.
// `src` is the block's own rect in block units (the units of map.scene); on the scene it is drawn by
// translate(x y) scale(k) translate(−src.x −src.y).
function isoScene(layout, opts) {
  var o = opts || ISO;
  var basis = isoBasis(o.azimuth, o.tilt);
  var sc = layout.map.scene, vb = layout.map.viewbox;
  var boards = ["title", "time", "nights", "parties"].filter(function (k) { return sc[k]; }).map(function (k) { return sc[k]; });
  var core = unionRect(boards);
  var cw = o.iconCell[0], ch = o.iconCell[1], gx = core[0] - o.iconGap - 2 * cw, icons = {};
  ISO_ICON_CELLS.forEach(function (cell) {
    var size = sc[cell[0]] ? [Math.min(cw, sc[cell[0]][2]), Math.min(ch - 4, sc[cell[0]][3])] : [44, 44];
    icons[cell[0]] = [gx + cell[1] * cw + (cw - size[0]) / 2, core[1] + cell[2] * ch + (ch - 4 - size[1]) / 2, size[0], size[1]];
  });
  var src = [gx, core[1], core[0] + core[2] - gx, Math.max(core[3], 3 * ch)];
  var corners = [[0, 0], [vb[0], 0], [0, vb[1]], [vb[0], vb[1]]].map(function (p) { return isoRaw(basis, p[0], p[1], 0); });
  var uMin = Math.min.apply(null, corners.map(function (p) { return p[0]; }));
  var uMax = Math.max.apply(null, corners.map(function (p) { return p[0]; }));
  var vMin = Math.min.apply(null, corners.map(function (p) { return p[1]; })) - o.headroom * basis.cp;
  var vMax = Math.max.apply(null, corners.map(function (p) { return p[1]; }));
  var worldW = uMax - uMin, blockW = src[2] * o.boardScale, blockH = src[3] * o.boardScale;
  var W = Math.ceil(Math.max(worldW, blockW) + 2 * o.margin);
  var top = o.margin + blockH + o.gap;
  var H = Math.ceil(top + (vMax - vMin) + o.margin);
  return {
    basis: basis,
    ox: (W - worldW) / 2 - uMin,
    oy: top - vMin,
    W: W, H: H,
    block: { src: src, x: (W - blockW) / 2, y: o.margin, k: o.boardScale },
    icons: icons,
    figScale: o.figScale
  };
}

// A ground point at height h on the scene: [x, y] in svg units.
function isoPoint(scene, x, y, h) {
  var p = isoRaw(scene.basis, x, y, h);
  return [p[0] + scene.ox, p[1] + scene.oy];
}

// The part of the scene a phone's rest view fits: [x, y, w, h], the board block plus every room with its walls
// (projected), padded by `pad` units. The forest around it is left to panning.
function isoContentRect(scene, layout, pad) {
  pad = pad === undefined ? 12 : pad;
  var b = scene.block, rects = [[b.x, b.y, b.src[2] * b.k, b.src[3] * b.k]];
  layout.rooms.forEach(function (room) { rects.push(polyBox(isoBoxOutline(scene, room.rect, 0, ISO.wallH))); });
  var u = unionRect(rects);
  return [u[0] - pad, u[1] - pad, u[2] + 2 * pad, u[3] + 2 * pad];
}

// The svg transform of the board block.
function isoBlockTransform(scene) {
  var b = scene.block;
  return "translate(" + round3(b.x) + " " + round3(b.y) + ") scale(" + b.k + ") translate(" + round3(-b.src[0]) + " " + round3(-b.src[1]) + ")";
}

// A point of the board block (block units) on the scene.
function isoBlockPoint(scene, x, y) {
  var b = scene.block;
  return [b.x + (x - b.src[0]) * b.k, b.y + (y - b.src[1]) * b.k];
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// The convex hull of points [[x, y], ...], counter-clockwise on screen (monotone chain). Fewer than 3 distinct
// points come back as they are.
function convexHull(points) {
  var pts = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  if (pts.length < 3) return pts;
  function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  var lower = [], upper = [], i;
  for (i = 0; i < pts.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
    lower.push(pts[i]);
  }
  for (i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
    upper.push(pts[i]);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// The outline on the scene of a ground rect [x, y, w, h] raised as a box from height h0 to h1: a polygon.
function isoBoxOutline(scene, r, h0, h1) {
  var pts = [];
  [h0, h1].forEach(function (h) {
    [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]].forEach(function (p) {
      pts.push(isoPoint(scene, p[0], p[1], h));
    });
  });
  return convexHull(pts);
}

// The points of a polygon as an svg `points` attribute.
function pointsText(poly) {
  return poly.map(function (p) { return round3(p[0]) + "," + round3(p[1]); }).join(" ");
}

// The bounding box [x, y, w, h] of a polygon.
function polyBox(poly) {
  return unionRect(poly.map(function (p) { return [p[0], p[1], 0, 0]; }));
}

// The height of the top surface a figure of slot number `index` lies on.
function isoSlotHeight(bed, index) {
  if (bed.kind === "bunk") return index === 0 ? ISO_BUNK_TOP : ISO_BED_TOP.bunk;
  return ISO_BED_TOP[bed.kind] === undefined ? 6 : ISO_BED_TOP[bed.kind];
}

// Where the upright sprite of a figure goes on the scene. `pos` is its flat top left corner in map units
// (figurePosition, meadowLayout: a 10 x 12 sprite), `h` the surface it stands or lies on. The sprite is drawn at
// [x, y] with scale `k`; its foot point is the projected middle of the flat sprite.
function isoFigure(scene, pos, h) {
  var k = scene.figScale, foot = isoPoint(scene, pos[0] + 5, pos[1] + 7, h);
  return { x: foot[0] - 5 * k, y: foot[1] - 10 * k, k: k };
}

// The svg transform that puts a sprite drawn at (0, 0) in map units onto the scene (see isoFigure).
function isoFigureTransform(f) {
  return "translate(" + round3(f.x) + " " + round3(f.y) + ") scale(" + f.k + ")";
}

// --- walls of the 3D world ---

// The walls of a house as boxes in map units: {x, y, w, d, h, kind}. Each room edge becomes a wall (4 units thick,
// the room rect border); the north and west edges of the house outline are tall, every other edge low. Doors cut
// gaps: the gap of a door on a tall wall keeps a lintel above `doorH`. `doors` are layout.map.doors rects.
// Pure geometry, so tests can check that no wall covers a bed.
function isoWalls(rooms, outline, doors, o) {
  o = o || ISO;
  var out = [], T = 4;
  rooms.forEach(function (room) {
    var r = room.rect;
    var edges = [
      { x: r[0], y: r[1], w: r[2], d: T, axis: "x", outer: r[1] === outline[1] },               // north
      { x: r[0], y: r[1] + r[3] - T, w: r[2], d: T, axis: "x", outer: false },                    // south
      { x: r[0], y: r[1], w: T, d: r[3], axis: "y", outer: r[0] === outline[0] },                 // west
      { x: r[0] + r[2] - T, y: r[1], w: T, d: r[3], axis: "y", outer: false }                     // east
    ];
    edges.forEach(function (e) {
      var tall = e.outer, h = tall ? o.wallH : o.lowWall;
      var gaps = doors.filter(function (d) { return rectsOverlap(d, [e.x, e.y, e.w, e.d]); }).map(function (d) {
        return e.axis === "x" ? [d[0], d[0] + d[2]] : [d[1], d[1] + d[3]];
      }).sort(function (a, b) { return a[0] - b[0]; });
      var start = e.axis === "x" ? e.x : e.y, end = start + (e.axis === "x" ? e.w : e.d);
      var pieces = [], at = start;
      gaps.forEach(function (g) {
        if (g[0] > at) pieces.push([at, g[0], 0, h]);
        if (tall) pieces.push([Math.max(at, g[0]), Math.min(end, g[1]), o.doorH, h]);      // lintel
        at = Math.max(at, g[1]);
      });
      if (at < end) pieces.push([at, end, 0, h]);
      pieces.forEach(function (p) {
        if (p[1] - p[0] <= 0) return;
        var box = e.axis === "x" ? { x: p[0], y: e.y, w: p[1] - p[0], d: e.d } : { x: e.x, y: p[0], w: e.w, d: p[1] - p[0] };
        box.h0 = p[2];
        box.h = p[3];
        box.tall = tall;
        out.push(box);
      });
    });
  });
  return out;
}

function rectsOverlap(a, b) {
  return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

// --- decor placement ---

// A deterministic pseudo-random number in [0, 1).
function isoNoise(i, seed) {
  var v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// Trees around the cabins: [{x, y, kind: "pine" | "leaf", size}] in map units. They stand on the grass of the
// ring `rim` units around the plan and on free grass inside it, never within `clear` units of a room, a path,
// a door, the meadow or `keepOut` rects (the campfire). Deterministic, so every device sees the same forest.
function isoTrees(layout, opts) {
  var o = opts || {};
  var vb = layout.map.viewbox, rim = o.rim || 70, clear = o.clear || 14, count = o.count || 90;
  var blocked = layout.rooms.map(function (r) { return r.rect; })
    .concat(layout.map.paths || [], layout.map.doors || [], o.keepOut || []);
  if (layout.map.scene && layout.map.scene.meadow) blocked.push(layout.map.scene.meadow);
  var out = [], i, tries = 0;
  for (i = 0; out.length < count && tries < count * 30; i++, tries++) {
    var x = -rim + isoNoise(i, 1) * (vb[0] + 2 * rim), y = -rim + isoNoise(i, 2) * (vb[1] + 2 * rim);
    var inside = x > 0 && x < vb[0] && y > 0 && y < vb[1];
    if (inside && isoNoise(i, 3) < 0.55) continue;      // fewer trees in the yard than in the forest around it
    var size = 0.75 + isoNoise(i, 4) * 0.6;
    var reach = clear + 8 * size;
    if (blocked.some(function (r) { return rectsOverlap([x - reach, y - reach, 2 * reach, 2 * reach], r); })) continue;
    if (out.some(function (t) { return Math.abs(t.x - x) < 16 && Math.abs(t.y - y) < 16; })) continue;
    out.push({ x: x, y: y, kind: inside || isoNoise(i, 5) < 0.4 ? "leaf" : "pine", size: size });
  }
  return out;
}
