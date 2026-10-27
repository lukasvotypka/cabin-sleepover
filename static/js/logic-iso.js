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

// --- beds, people and the meadow in the isometric view (T-133) ---

var ISO_HIT_TARGET = 66;          // scene units of a tap target at the phone rest view (~0.67 px per unit = 44 px)
var ISO_HIT_TOP = 12;             // a bed hit area reaches this far above the furniture top
var ISO_MEADOW_TOP = 16;          // the meadow hit area reaches this high
var ISO_SHADOW = [8, 2];          // the flat shadow under a standing figure, scene units
var ISO_HOP_STEP = 4;             // a figure hops onto a bed in steps of this many units
var ISO_HOP_MS = 80;              // the time of one hop step

// The corners of a sprite standing at `pos` on height `h`: the scene rect of the 10 x 12 sprite (isoFigure).
function isoSpritePoints(scene, pos, h) {
  var f = isoFigure(scene, pos, h), k = f.k;
  return [[f.x, f.y], [f.x + 10 * k, f.y], [f.x + 10 * k, f.y + 12 * k], [f.x, f.y + 12 * k]];
}

// The shape of a bed on the scene: the convex hull of its furniture (floor to top + ISO_HIT_TOP) and its sprites.
function isoBedShape(scene, bed) {
  var top = (ISO_BED_TOP[bed.kind] === undefined ? 6 : ISO_BED_TOP[bed.kind]) + ISO_HIT_TOP;
  var pts = isoBoxOutline(scene, furnitureBounds(bed), 0, top).slice();
  bed.slots.forEach(function (slot, i) {
    pts = pts.concat(isoSpritePoints(scene, figurePosition(bed, i), isoSlotHeight(bed, i)));
  });
  return convexHull(pts);
}

// The polygon `poly` grown by gx and gy in every direction (the convex hull of its corners moved apart).
function isoGrowPoly(poly, gx, gy) {
  var pts = [];
  poly.forEach(function (p) {
    pts.push([p[0] - gx, p[1] - gy], [p[0] + gx, p[1] - gy], [p[0] + gx, p[1] + gy], [p[0] - gx, p[1] + gy]);
  });
  return convexHull(pts);
}

// Whether two convex polygons overlap (separating axis test, touching does not count).
function isoPolysOverlap(a, b) {
  return ![a, b].some(function (poly) {
    return poly.some(function (p, i) {
      var q = poly[(i + 1) % poly.length], nx = q[1] - p[1], ny = p[0] - q[0];
      function range(s) {
        var lo = Infinity, hi = -Infinity;
        s.forEach(function (r) { var d = r[0] * nx + r[1] * ny; lo = Math.min(lo, d); hi = Math.max(hi, d); });
        return [lo, hi];
      }
      var ra = range(a), rb = range(b);
      return ra[1] <= rb[0] + 1e-9 || rb[1] <= ra[0] + 1e-9;
    });
  });
}

// Whether the point is inside the convex polygon (counter-clockwise on screen, as convexHull gives it) or on its edge.
function isoPointIn(poly, p) {
  return poly.every(function (a, i) {
    var b = poly[(i + 1) % poly.length];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
  });
}

// A tap area: the shape `base` grown toward ISO_HIT_TARGET x ISO_HIT_TARGET around its centre, but never so far
// that it comes closer to a polygon of `others` than the growth of both together (the halfway line), nor out of
// the convex polygon `bound`. Growth is tried in eighths, so the result is the largest of 9 sizes that fits.
function isoGrowHit(base, others, bound) {
  var box = polyBox(base), gx = Math.max(0, (ISO_HIT_TARGET - box[2]) / 2), gy = Math.max(0, (ISO_HIT_TARGET - box[3]) / 2);
  for (var n = 8; n > 0; n--) {
    var f = n / 8, grown = isoGrowPoly(base, gx * f, gy * f);
    var free = others.every(function (o) { return !isoPolysOverlap(grown, isoGrowPoly(o.shape, o.gx * f, o.gy * f)); });
    if (free && (!bound || grown.every(function (p) { return isoPointIn(bound, p); }))) return grown;
  }
  return base;
}

// The tap polygons of all beds of a layout: {bed id: polygon}. Each is grown at most halfway toward the others.
function isoBedHits(scene, layout) {
  var all = [];
  layout.rooms.forEach(function (room) {
    var r = room.rect, bound = convexHull(isoBoxOutline(scene, [r[0], r[1], r[2] + 8, r[3] + 8], 0, ISO.wallH + 16));      // the south and east walls are low, so a tap area may reach over them
    room.beds.forEach(function (bed) {
      var shape = isoBedShape(scene, bed), box = polyBox(shape);
      all.push({ id: bed.id, shape: shape, bound: bound, gx: Math.max(0, (ISO_HIT_TARGET - box[2]) / 2), gy: Math.max(0, (ISO_HIT_TARGET - box[3]) / 2) });
    });
  });
  var out = {};
  all.forEach(function (a) {      // beds whose shapes already overlap (sprites of neighbours) share it; the nearer one is drawn on top and wins
    var apart = all.filter(function (o) { return o !== a && !isoPolysOverlap(a.shape, o.shape); });
    out[a.id] = isoGrowHit(a.shape, apart, a.bound);
  });
  return out;
}

// The tap regions of all beds in drawing order, lowest first: [{bed: id, part: "pad" | "furniture" | "figure", poly}].
// The grown tap areas (isoBedHits) come first and only claim free space; then every bed's furniture, then every
// figure sprite (and free „+“), each back to front. So the point on a bed's own furniture or figure always belongs to
// that bed, and a neighbour's padding never wins over it (T-133 test report, bug 1).
function isoHitRegions(scene, layout) {
  var hits = isoBedHits(scene, layout), beds = isoBedsBackToFront(scene, layout), out = [];
  beds.forEach(function (e) { out.push({ bed: e.bed.id, part: "pad", poly: hits[e.bed.id] }); });
  beds.forEach(function (e) {
    var top = ISO_BED_TOP[e.bed.kind] === undefined ? 6 : ISO_BED_TOP[e.bed.kind];
    out.push({ bed: e.bed.id, part: "furniture", poly: convexHull(isoBoxOutline(scene, furnitureBounds(e.bed), 0, top)) });
  });
  var figs = [];
  beds.forEach(function (e) {
    isoSlotOrder(scene, e.bed).forEach(function (i, n) {
      var pos = figurePosition(e.bed, i), h = isoSlotHeight(e.bed, i);
      figs.push({ bed: e.bed.id, bedV: e.v, n: n, slot: e.bed.slots[i], part: "figure", v: isoPoint(scene, pos[0] + 5, pos[1] + 7, h)[1], poly: convexHull(isoSpritePoints(scene, pos, h)) });
    });
  });
  figs.sort(function (a, b) { return a.v - b.v || a.bedV - b.bedV || a.n - b.n; });
  return out.concat(figs);
}

// The bed id under a scene point: the last (topmost) region that holds it, or null.
function isoHitAt(regions, p) {
  for (var i = regions.length - 1; i >= 0; i--) {
    if (isoPointIn(regions[i].poly, p)) return regions[i].bed;
  }
  return null;
}

// The tap polygon of the meadow: its rect (0 ... ISO_MEADOW_TOP high) and the waiting sprites, grown like a bed
// but never into a bed shape.
function isoMeadowHit(scene, layout, meadow, count) {
  var pts = isoBoxOutline(scene, meadow, 0, ISO_MEADOW_TOP).slice();
  meadowLayout(meadow, count).cells.forEach(function (c) { pts = pts.concat(isoSpritePoints(scene, c, 0)); });
  var others = [];
  layout.rooms.forEach(function (room) { room.beds.forEach(function (bed) { others.push({ shape: isoBedShape(scene, bed), gx: 0, gy: 0 }); }); });
  return isoGrowHit(convexHull(pts), others, null);
}

// The depth of a point on the scene: its projected v. Things with a larger v are nearer and are drawn later.
function isoBedDepth(scene, bed) {
  var r = bed.rect;
  return isoPoint(scene, r[0] + r[2] / 2, r[1] + r[3] / 2, 0)[1];
}

// The beds of a layout, back to front: [{room, bed}].
function isoBedsBackToFront(scene, layout) {
  var list = [];
  layout.rooms.forEach(function (room) { room.beds.forEach(function (bed) { list.push({ room: room, bed: bed, v: isoBedDepth(scene, bed) }); }); });
  return list.sort(function (a, b) { return a.v - b.v; });
}

// The slot numbers of a bed in drawing order: back to front by the feet of their figures. A bunk draws its bottom
// berth (slot 1) first, then the front rail (isoBunkRail), then the top berth (slot 0).
function isoSlotOrder(scene, bed) {
  var idx = bed.slots.map(function (s, i) { return i; });
  if (bed.kind === "bunk") return idx.reverse();
  var v = function (i) { var p = figurePosition(bed, i); return isoPoint(scene, p[0] + 5, p[1] + 7, isoSlotHeight(bed, i))[1]; };
  return idx.sort(function (a, b) { return v(a) - v(b) || a - b; });
}

// The front rail of the top berth of a bunk, two strips (east and south side) 2 units high at 21 ... 23, as
// scene polygons. They draw over the bottom sleeper.
function isoBunkRail(scene, bed) {
  var r = bed.rect, lo = ISO_BUNK_TOP - 2;
  return [[r[0] + r[2] - 2, r[1], 2, r[3]], [r[0], r[1] + r[3] - 2, r[2], 2]].map(function (s) {
    return isoBoxOutline(scene, s, lo, ISO_BUNK_TOP);
  });
}

// The colour key (COLORS) of the quilt that covers a sleeper in a bed of this kind.
function isoQuiltKey(kind) {
  return { bed2: "quiltRed", bed1: "quiltBlue", bunk: "quiltBlue", cot: "quiltBlue", mats: "mat", stove: "stoveBlanket", sofa: "sofaLight", sofa1: "sofaLight" }[kind] || "quiltBlue";
}

// Moves the plates up so that none overlaps another: `plates` are scene rects [x, y, w, h]. The farther plate
// (the one whose bottom is higher up) moves up by the overlap. Returns the shift (<= 0) of each plate.
function isoPlateShifts(plates) {
  var order = plates.map(function (p, i) { return i; }).sort(function (a, b) { return (plates[b][1] + plates[b][3]) - (plates[a][1] + plates[a][3]); });
  var dy = plates.map(function () { return 0; });
  order.forEach(function (i, n) {
    order.slice(n + 1).forEach(function (j) {
      var a = plates[i], b = plates[j], ay = a[1] + dy[i], by = b[1] + dy[j];
      var ox = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
      var oy = Math.min(ay + a[3], by + b[3]) - Math.max(ay, by);
      if (ox > 0 && oy > 0) dy[j] -= oy;
    });
  });
  return dy;
}

// The height of a walking figure after `elapsed` of `ms`: 0 on the floor, then a hop onto the bed in steps of
// ISO_HOP_STEP over the last steps of the walk (the bunk top is the same climb, just longer).
function isoWalkHeight(elapsed, ms, hTo) {
  if (!(hTo > 0)) return 0;
  var steps = Math.ceil(hTo / ISO_HOP_STEP), start = ms - steps * ISO_HOP_MS;
  if (!(elapsed >= start)) return 0;
  return Math.min(hTo, ISO_HOP_STEP * (1 + Math.floor((elapsed - start) / ISO_HOP_MS)));
}

// The figure (isoFigure) of a walk at progress t: positions in whole scene units.
function isoWalkFigure(scene, from, to, t, h) {
  var p = walkPosition(from, to, t), f = isoFigure(scene, p, h);
  return { x: Math.round(f.x), y: Math.round(f.y), k: f.k };
}

// The short bed names of a bed on the scene (T-133): {x, y, text}, x the middle and y the top of a flat chip
// under the front (lowest) corner of the furniture at floor height, plus 2 units. A mat has its own tag.
function isoBedTags(scene, bed) {
  var r = bed.rect, texts = bedTags(bed);
  return texts.map(function (t, i) {
    var part = bed.kind === "mats" ? [r[0] + i * 46, r[1], 32, r[3]] : r;
    var front = isoBoxOutline(scene, part, 0, 0).reduce(function (a, p) { return p[1] > a[1] ? p : a; });
    return { x: front[0], y: front[1] + 2, text: t.text };
  });
}
