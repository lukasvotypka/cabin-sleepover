// Pure page logic: the isometric view of the map (the 3D world drawn by app-iso.js, and the svg on top of it).
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).
//
// The layout in config/cabin.yaml stays a flat plan (x right, y down, in map units). The page shows it from the
// south-east and above: a ground point (x, y) at height h lands on the scene (the svg viewBox) at
//   u = x·cos(az) − y·sin(az),  v = (x·sin(az) + y·cos(az))·sin(tilt) − h·cos(tilt),  then shifted by (ox, oy).
// With ISO.persp > 0 (T-135) it is a slight perspective instead: the same azimuth and tilt, a camera at distance D
// from the middle of the plan, and every point scaled by D / (D − z) with z its distance toward the camera. D follows
// from the strength: the nearest ground corner is drawn `persp` times larger than the farthest. persp 0 is the
// orthographic view above. The camera travels with the pan (T-147): the middle of the perspective is the plan point under the
// screen centre (isoSetCentre), so a house near the edge of the screen shows its outer wall. Either way the svg and the WebGL camera share the projection exactly: the svg draws beds,
// figures and boards at projected points, and app-iso.js points its camera so that its pixels land on the same units.
// The notice board and the title gate are upright signs facing the camera (isoSignBox). The night stamps, the time
// slider and the icons are the fixed HUD in index.html (T-145), not part of the scene.

var ISO = {
  azimuth: 45,          // degrees: the plan turned so that its top left corner points up
  tilt: 30,             // degrees above the horizon: sin 30° = 0.5, the classic 2:1 pixel-art isometric
  persp: 0.35,          // depth strength: the nearest ground corner is drawn this much larger than the farthest (0 = orthographic; `?persp=` tunes it, see perspSetting)
  figScale: 1.35,       // the people sprites standing on the beds
  margin: 12,           // grass around the whole scene
  headroom: 84,         // map units above the ground the world may reach (roofs, chimneys, smoke)
  wallH: 28,            // the back (north and west) outer walls of a house
  lowWall: 6,           // every other wall is cut low, so the rooms show
  doorH: 20,
  windowSill: 9,
  windowH: 10
};

// --- the four view angles (T-143) ---

// The camera azimuths the map can be turned to: from the south-east (the default), north-east, north-west and
// south-west. +90 turns the map clockwise on screen.
var ISO_ANGLES = [45, 135, 225, 315];
var ISO_ANGLE_NAMES = { 45: "z juhovýchodu", 135: "zo severovýchodu", 225: "zo severozápadu", 315: "z juhozápadu" };      // with the preposition: Slovak needs „zo“ before „severo…“

// The screen reader text for the view angle, e.g. „Pohľad zo severozápadu“.
function isoAngleText(angle) { return "Pohľad " + ISO_ANGLE_NAMES[isoAngle(angle)]; }
var ISO_NOON_SUN_AZ = -20;      // degrees from the camera axis at 45: the noon sun, shadows beside the objects (T-136)

// A stored or given angle as one of ISO_ANGLES; anything else is 45.
function isoAngle(v) {
  var n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return ISO_ANGLES.indexOf(n) >= 0 ? n : 45;
}

// The angle after `steps` quarter turns (+1 = the map turns clockwise on screen).
function isoTurnAngle(angle, steps) {
  var i = ISO_ANGLES.indexOf(isoAngle(angle));
  return ISO_ANGLES[(((i + steps) % 4) + 4) % 4];
}

// The swing between two angles (T-144): ease-in-out of the progress 0..1.
function isoEase(p) {
  p = Math.max(0, Math.min(1, p));
  return p * p * (3 - 2 * p);
}

// The camera azimuth part-way through a swing of `steps` quarter turns from angle `from` (unwrapped, so 315 to 45 goes on to 405).
function isoSwingAzimuth(from, steps, p) {
  return isoAngle(from) + 90 * steps * isoEase(p);
}

// The view of an in-between scene `mid` while the map turns from scene `from`: the old view keeps its place and size relative to
// the content (the rooms and the signs, isoContentRect), so a map at rest stays centred through the swing.
function isoSwingView(from, mid, oldView, layout) {
  var a = isoContentRect(from, layout), b = isoContentRect(mid, layout), f = b[2] / a[2];
  var cx = (oldView.x + oldView.w / 2 - a[0]) / a[2], cy = (oldView.y + oldView.h / 2 - a[1]) / a[3];
  var w = oldView.w * f, h = oldView.h * f;
  return { x: b[0] + cx * b[2] - w / 2, y: b[1] + cy * b[3] - h / 2, w: w, h: h };
}

// The sun's azimuth for a view: `az` is the sun path's value (degrees from south at the default view), turned with the view so that
// the shadows look the same from every side.
function isoSunAzimuth(az, viewAzimuth) {
  return az + (isoAngle(viewAzimuth) - 45);
}

// Which sides of a house face away from the camera at this azimuth: {n, s, w, e}. Their walls stand tall when the house is open.
function isoBackSides(azimuth) {
  var a = (azimuth === undefined ? ISO.azimuth : azimuth) * Math.PI / 180, dx = Math.sin(a), dy = Math.cos(a), E = 1e-9;      // (dx, dy): the plan direction toward the camera
  return { n: dy > E, s: dy < -E, w: dx > E, e: dx < -E };
}

// The top surface of each bed kind above the floor, and the height of each slot (bunk: the top berth is slot 0).
var ISO_BED_TOP = { bed2: 7, bed1: 7, cot: 6, mats: 2, sofa: 7, sofa1: 7, stove: 13, bunk: 5 };
var ISO_BUNK_TOP = 23;

// `persp` > 0 with the plan size `plan` [w, h] gives a perspective basis: the camera looks at the middle of the plan
// (basis.tx, basis.ty) from distance basis.D. Without them the basis is orthographic.
function isoBasis(azimuthDeg, tiltDeg, persp, plan) {
  var a = azimuthDeg * Math.PI / 180, t = tiltDeg * Math.PI / 180;
  var b = { c: Math.cos(a), s: Math.sin(a), sp: Math.sin(t), cp: Math.cos(t), D: 0, tx: 0, ty: 0 };
  if (persp > 0 && plan) {
    b.tx = plan[0] / 2;
    b.ty = plan[1] / 2;
    var zs = [[0, 0], [plan[0], 0], [0, plan[1]], [plan[0], plan[1]]].map(function (p) { return isoCamZ(b, p[0], p[1], 0); });
    var zn = Math.max.apply(null, zs), zf = Math.min.apply(null, zs);
    b.D = ((1 + persp) * zn - zf) / persp;
  }
  return b;
}

// How far a point is toward the camera from the plane through the plan's middle (perspective bases only).
function isoCamZ(basis, x, y, h) {
  return basis.cp * (basis.s * (x - basis.tx) + basis.c * (y - basis.ty)) + basis.sp * (h || 0);
}

// The scale of a point: 1 at the plan's middle, larger nearer to the camera. Always 1 for an orthographic basis.
function isoDepthScale(basis, x, y, h) {
  return basis.D ? basis.D / (basis.D - isoCamZ(basis, x, y, h)) : 1;
}

// The projected point before the scene shift: [u, v]. A perspective basis puts the plan's middle on the ground at [0, 0].
function isoRaw(basis, x, y, h) {
  h = h || 0;
  if (!basis.D) return [x * basis.c - y * basis.s, (x * basis.s + y * basis.c) * basis.sp - h * basis.cp];
  var dx = x - basis.tx, dy = y - basis.ty, f = isoDepthScale(basis, x, y, h);
  return [(dx * basis.c - dy * basis.s) * f, ((dx * basis.s + dy * basis.c) * basis.sp - h * basis.cp) * f];
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

// The whole isometric scene for a layout: the projection and the scene size. The notice board and the title gate are
// upright signs placed on the plan (isoSignBox); they have no block above the world any more (T-146).
// Returns {basis, azimuth, ox, oy, W, H, top, figScale}.
function isoScene(layout, opts) {
  var o = Object.assign({}, ISO, opts || {});
  var basis = isoBasis(o.azimuth, o.tilt, o.persp, layout.map.viewbox);
  var vb = layout.map.viewbox;
  var corners = [[0, 0], [vb[0], 0], [0, vb[1]], [vb[0], vb[1]]].map(function (p) { return isoRaw(basis, p[0], p[1], 0); });
  var tops = [[0, 0], [vb[0], 0], [0, vb[1]], [vb[0], vb[1]]].map(function (p) { return isoRaw(basis, p[0], p[1], o.headroom); });
  var uMin = Math.min.apply(null, corners.concat(tops).map(function (p) { return p[0]; }));
  var uMax = Math.max.apply(null, corners.concat(tops).map(function (p) { return p[0]; }));
  var vMin = Math.min.apply(null, tops.map(function (p) { return p[1]; }));
  var vMax = Math.max.apply(null, corners.map(function (p) { return p[1]; }));
  ["board", "gate"].forEach(function (which) {      // the signs may stand beyond the world, so the scene grows to hold them
    var at = layout.map.scene[which], size = ISO_SIGNS[which], p = isoRaw(basis, at[0], at[1], 0);
    uMin = Math.min(uMin, p[0] - size.w / 2);
    uMax = Math.max(uMax, p[0] + size.w / 2);
    vMin = Math.min(vMin, p[1] - size.h);
  });
  var worldW = uMax - uMin;
  var W = Math.ceil(worldW + 2 * o.margin);
  var top = o.margin;
  var H = Math.ceil(top + (vMax - vMin) + o.margin);
  var scene = {
    basis: basis,
    azimuth: o.azimuth,
    ox: (W - worldW) / 2 - uMin,
    oy: top - vMin,
    W: W, H: H,
    top: top,
    figScale: o.figScale
  };
  // `ref` is the same scene with the perspective centred on the middle of the plan and never moved: the frame the views and the
  // rest view are measured in (the view centre is where the centre of the perspective shows).
  scene.ref = Object.assign({}, scene, { basis: Object.assign({}, basis) });
  return scene;
}

// Centres the perspective of `scene` on the plan point that shows at the scene point (vx, vy), the middle of the view: that
// point keeps its place, everything else shifts by its parallax. Returns true when the centre moved. No-op for an orthographic scene.
function isoSetCentre(scene, vx, vy) {
  var b = scene.basis;
  if (!b.D || !scene.ref) return false;
  var c = isoUnpoint(scene.ref, vx, vy);
  if (Math.abs(c[0] - b.tx) < 1e-4 && Math.abs(c[1] - b.ty) < 1e-4 && scene.ox === vx && scene.oy === vy) return false;
  b.tx = c[0];
  b.ty = c[1];
  scene.ox = vx;
  scene.oy = vy;
  return true;
}

// A plan point at height h that an svg item hangs on, drawn at the scene's current centre: {x, y, h, p, f, scaled}. When the
// centre moves, isoAnchorTransform gives the transform that carries the item to where the new projection puts the anchor
// (T-147), so the svg follows the pan without being drawn again. The error is the change of the parallax across the item,
// well under a pixel for items the size of a bed or a house. `scaled` items also grow with the depth scale (polygons);
// signs keep their size.
function isoAnchorMake(scene, x, y, h, scaled) {
  return { x: x, y: y, h: h || 0, p: isoPoint(scene, x, y, h), f: isoDepthScale(scene.basis, x, y, h), scaled: !!scaled };
}

// The transform (a string for the svg `transform` attribute, put in front of the item's own) that moves anchor `a` to the scene's current projection.
function isoAnchorTransform(scene, a) {
  var q = isoPoint(scene, a.x, a.y, a.h), r = a.scaled ? isoDepthScale(scene.basis, a.x, a.y, a.h) / a.f : 1;
  if (!a.scaled) return "translate(" + round3(q[0] - a.p[0]) + " " + round3(q[1] - a.p[1]) + ")";
  return "translate(" + round3(q[0]) + " " + round3(q[1]) + ") scale(" + Math.round(r * 1e5) / 1e5 + ") translate(" + round3(-a.p[0]) + " " + round3(-a.p[1]) + ")";
}

// The two upright signs of the village (T-146): the notice board and the title gate. They stand on a ground point of the plan
// (`map.scene.board`, `map.scene.gate`) and always face the camera, so they are drawn flat on the scene, `size` units big,
// with the bottom middle on the projected point.
var ISO_SIGNS = { board: { w: 130, h: 82 }, gate: { w: 150, h: 66 } };

// The scene rect [x, y, w, h] of a sign: "board" or "gate".
function isoSignBox(scene, layout, which) {
  var at = layout.map.scene[which], size = ISO_SIGNS[which], p = isoPoint(scene, at[0], at[1], 0);
  return [p[0] - size.w / 2, p[1] - size.h, size.w, size.h];
}

// A ground point at height h on the scene: [x, y] in svg units.
function isoPoint(scene, x, y, h) {
  var p = isoRaw(scene.basis, x, y, h);
  return [p[0] + scene.ox, p[1] + scene.oy];
}

// The ground point [x, y] (height 0) under a scene point; the inverse of isoPoint at height 0. A perspective scene
// is inverted by a few rounds of correcting the depth scale.
function isoUnpoint(scene, px, py) {
  var b = scene.basis, u = px - scene.ox, v = py - scene.oy, f = 1, x = 0, y = 0, i;
  for (i = 0; i < 16; i++) {
    var a = u / f, c = v / f / b.sp;
    x = b.tx + a * b.c + c * b.s;
    y = b.ty - a * b.s + c * b.c;
    f = isoDepthScale(b, x, y, 0);
  }
  return [x, y];
}

// The view (see logic-view.js) after the map turned from scene `from` to scene `to`. A map at rest (`oldView` is `oldRest`)
// lands on the new rest view; otherwise the plan point under the middle of the screen stays there and the zoom
// relative to the rest zoom stays, clamped to the new bounds.
function isoTurnView(from, to, oldView, oldRest, newRest, newBounds) {
  if (!oldView || !oldRest || sameView(oldView, oldRest)) return newRest;
  var p = isoUnpoint(from.ref || from, oldView.x + oldView.w / 2, oldView.y + oldView.h / 2);
  var c = isoPoint(to.ref || to, p[0], p[1], 0), w = newRest.w * oldView.w / oldRest.w, h = w * newRest.h / newRest.w;
  return clampView({ x: c[0] - w / 2, y: c[1] - h / 2, w: w, h: h }, newBounds);
}

// The part of the scene a phone's rest view fits: [x, y, w, h], every room with its walls (projected) and the two signs,
// padded by `pad` units. The forest around it is left to panning.
function isoContentRect(scene, layout, pad) {
  pad = pad === undefined ? 12 : pad;
  scene = scene.ref || scene;      // the view frame, whatever the centre of the perspective is just now
  var rects = [isoSignBox(scene, layout, "board"), isoSignBox(scene, layout, "gate")];
  layout.rooms.forEach(function (room) { rects.push(polyBox(isoBoxOutline(scene, room.rect, 0, ISO.wallH))); });
  var u = unionRect(rects);
  return [u[0] - pad, u[1] - pad, u[2] + 2 * pad, u[3] + 2 * pad];
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
// [x, y] with scale `k`; its foot point is the projected middle of the flat sprite. In perspective `k` follows the
// depth of the foot (nearer figures are a little larger), in steps of 0.05 so the pixels stay even.
function isoFigure(scene, pos, h) {
  var foot = isoPoint(scene, pos[0] + 5, pos[1] + 7, h);
  var k = Math.round(scene.figScale * isoDepthScale(scene.basis, pos[0] + 5, pos[1] + 7, h) / 0.05) * 0.05;
  k = round3(k);
  return { x: foot[0] - 5 * k, y: foot[1] - 10 * k, k: k };
}

// The svg transform that puts a sprite drawn at (0, 0) in map units onto the scene (see isoFigure).
function isoFigureTransform(f) {
  return "translate(" + round3(f.x) + " " + round3(f.y) + ") scale(" + f.k + ")";
}

// --- walls of the 3D world ---

// The walls of a house as boxes in map units: {x, y, w, d, h, kind}. Each room edge becomes a wall (4 units thick,
// the room rect border); the edges of the house outline on the two sides facing away from the camera (isoBackSides, north and west at the default view) are tall, every other edge low. Doors cut
// gaps: the gap of a door on a tall wall keeps a lintel above `doorH`. `doors` are layout.map.doors rects.
// Pure geometry, so tests can check that no wall covers a bed.
function isoWalls(rooms, outline, doors, o) {
  o = o || ISO;
  var out = [], T = 4, back = isoBackSides(o.azimuth);
  rooms.forEach(function (room) {
    var r = room.rect;
    var edges = [
      { x: r[0], y: r[1], w: r[2], d: T, axis: "x", side: "n", outer: r[1] === outline[1] },
      { x: r[0], y: r[1] + r[3] - T, w: r[2], d: T, axis: "x", side: "s", outer: r[1] + r[3] === outline[1] + outline[3] },
      { x: r[0], y: r[1], w: T, d: r[3], axis: "y", side: "w", outer: r[0] === outline[0] },
      { x: r[0] + r[2] - T, y: r[1], w: T, d: r[3], axis: "y", side: "e", outer: r[0] + r[2] === outline[0] + outline[2] }
    ];
    edges.forEach(function (e) {
      var tall = e.outer && back[e.side], h = tall ? o.wallH : o.lowWall;
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
        box.side = e.side;
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
  var all = [], back = isoBackSides(scene.azimuth);
  layout.rooms.forEach(function (room) {
    var r = room.rect, gw = back.w ? 0 : 8, ge = back.e ? 0 : 8, gn = back.n ? 0 : 8, gs = back.s ? 0 : 8;
    var bound = convexHull(isoBoxOutline(scene, [r[0] - gw, r[1] - gn, r[2] + gw + ge, r[3] + gn + gs], 0, ISO.wallH + 16));      // the walls on the camera's side are low, so a tap area may reach over them
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

// The front rail of the top berth of a bunk, two strips (the two sides facing the camera: east and south at the default
// view) 2 units high at 21 ... 23, as scene polygons. They draw over the bottom sleeper.
function isoBunkRail(scene, bed) {
  var r = bed.rect, lo = ISO_BUNK_TOP - 2, back = isoBackSides(scene.azimuth);
  var xStrip = back.w ? [r[0] + r[2] - 2, r[1], 2, r[3]] : [r[0], r[1], 2, r[3]];
  var yStrip = back.n ? [r[0], r[1] + r[3] - 2, r[2], 2] : [r[0], r[1], r[2], 2];
  return [xStrip, yStrip].map(function (s) {
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

// The height of a walking figure after `elapsed` of `ms`: 0 on the floor, then a smooth climb onto the bed at
// ISO_HOP_STEP per ISO_HOP_MS over the end of the walk (the bunk top is the same climb, just longer).
function isoWalkHeight(elapsed, ms, hTo) {
  if (!(hTo > 0)) return 0;
  var start = ms - Math.ceil(hTo / ISO_HOP_STEP) * ISO_HOP_MS;
  if (!(elapsed >= start)) return 0;
  return Math.min(hTo, ISO_HOP_STEP * (elapsed - start) / ISO_HOP_MS);
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

// --- day, night and life in the 3D world (T-134): light colours and the cycles of the moving parts ---

// Blends two "#RRGGBB" colours linearly; t 0 gives `a`, 1 gives `b`.
function isoMix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  var out = "#";
  for (var i = 1; i < 7; i += 2) {
    var v = Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t);
    out += (v < 16 ? "0" : "") + v.toString(16);
  }
  return out.toUpperCase();
}

// The lights of the 3D world for `l` = lightAt(h): sky/ground and sun colours and intensities. Day, then the orange
// dusk (by l.dusk), then the blue night (by l.d). The sun keeps its place: only colour and strength change.
function isoLightParams(l) {
  var k = Math.min(1, l.dusk / 0.55), d = l.d;
  return {
    sky: isoMix(isoMix("#FFF4DC", "#F2B07A", k), "#3A4A7A", d),
    ground: isoMix("#5A6A30", "#1A2030", d),
    glow: isoMix("#000000", "#1B2A48", d),      // the grass is green, so blue light alone would leave it black: a little blue of its own
    hemi: 0.4 + 0.15 * d,      // low by day so the sun shadows read; at night the ambient does the lighting
    sun: isoMix(isoMix("#FFFFFF", "#FF9A4A", k), "#8FA8E0", d),
    sunPower: 2.2 - 2.05 * d,      // the shadows are what the sun adds, so they fade with it and are almost gone at night
    ao: 1 - 0.5 * d,      // the baked corner and blob darkening: full by day, half at night
    smoke: isoMix("#C9C2B6", "#8FA8E0", d * 0.6)
  };
}

// --- ambient occlusion (T-136): flat steps of darkening where boxes meet the ground, pure and baked once at build ---

var ISO_AO_STEPS = [[2, 0.7], [4, 0.8], [6, 0.9]];      // [height below which, brightness]: -30 % at the contact, 0 from 6 units up
var ISO_AO_BAND = 6;                                    // width of the dark band along the foot of a wall

// The brightness (0.7..1) of a side face at height y above the ground.
function isoAoShade(y) {
  for (var i = 0; i < ISO_AO_STEPS.length; i++) if (y < ISO_AO_STEPS[i][0]) return ISO_AO_STEPS[i][1];
  return 1;
}

// A side face of a box from h0 to h1 cut into flat bands: [{a, b, shade}], so the darkening has steps and not a gradient.
function isoAoBands(h0, h1) {
  var cuts = [h0], out = [];
  ISO_AO_STEPS.forEach(function (s) { if (s[0] > h0 && s[0] < h1) cuts.push(s[0]); });
  cuts.push(h1);
  for (var i = 0; i + 1 < cuts.length; i++) out.push({ a: cuts[i], b: cuts[i + 1], shade: isoAoShade((cuts[i] + cuts[i + 1]) / 2) });
  return out;
}

// The overlap of two plan rects [x, y, w, d], or null.
function isoRectClip(a, b) {
  var x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]);
  var x1 = Math.min(a[0] + a[2], b[0] + b[2]), y1 = Math.min(a[1] + a[3], b[1] + b[3]);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
}

// A plan rect grown by `m` on every side.
function isoGrowRect(r, m) {
  return [r[0] - m, r[1] - m, r[2] + 2 * m, r[3] + 2 * m];
}

// The stepped 8-sided blob under a crown: corners [x, y] around (cx, cy), counter-clockwise from the east, flat-sided like the voxels.
function isoBlobPolygon(cx, cy, r) {
  var k = r * 0.4142;      // an octagon of half-width r
  return [[cx + r, cy - k], [cx + r, cy + k], [cx + k, cy + r], [cx - k, cy + r], [cx - r, cy + k], [cx - r, cy - k], [cx - k, cy - r], [cx + k, cy - r]];
}

var ISO_TICK_MS = 33;                        // the one shared update of everything that moves: about 30 a second
var ISO_STEP_MS = 125;                       // the old 8 fps beat: the speed of the on/off rhythms (flicker, blink) and the base of animation lengths
var ISO_FLICKER = [1, 0.85, 1.1, 0.9];       // the campfire light, one entry per ISO_STEP_MS
var ISO_FLAME_FRAMES = [[5, 4, 2.5], [6, 5, 3.5], [5.5, 4.5, 3]];      // heights of the outer, middle and core flame per frame
var ISO_SMOKE_RISE = 18;
var ISO_SMOKE_MS = 3000;

// The frame (0..2) of the flames at `clock` ms: one every 160 ms.
function isoFlameFrame(clock) {
  return Math.floor(clock / 160) % 3;
}

function isoFlicker(clock) {
  return ISO_FLICKER[Math.floor(clock / ISO_STEP_MS) % ISO_FLICKER.length];
}

// A puff of chimney smoke: rises smoothly 18 units over 3 s, growing from 3 to 5 units and fading from 0.6 to 0; `n` (0..2) staggers by 1 s.
function isoSmoke(clock, n) {
  var age = ((clock + n * 1000) % ISO_SMOKE_MS) / ISO_SMOKE_MS;
  return { rise: age * ISO_SMOKE_RISE, size: 3 + 2 * age, opacity: 0.6 * (1 - age) };
}

// A falling leaf `i` of height `top`: falls in 4 to 6 s, drifts up to 2 units sideways per 400 ms (smoothly), then starts again.
function isoLeaf(clock, i, top) {
  var dur = 4000 + isoNoise(i, 41) * 2000, age = (clock + i * 1700) % dur, steps = Math.floor(age / 400), dx = 0, j;
  for (j = 0; j < steps; j++) dx += (isoNoise(i * 31 + j, 43) - 0.5) * 4;
  dx += (isoNoise(i * 31 + steps, 43) - 0.5) * 4 * ((age % 400) / 400);
  return { y: top * (1 - age / dur), dx: Math.max(-6, Math.min(6, dx)) };
}

// A firefly `i`: on for 0.6 s, off for 1.2 s, drifting 1 unit to a new spot every 500 ms (smoothly).
function isoFirefly(clock, i) {
  var on = (clock + i * 370) % 1800 < 600, hop = Math.floor(clock / 500), f = (clock % 500) / 500;
  function spot(h) { return [Math.round(isoNoise(i * 17 + h, 51) * 2 - 1), Math.round(isoNoise(i * 19 + h, 53) * 2 - 1)]; }
  var a = spot(hop - 1), b = spot(hop);
  return { on: on, dx: a[0] + (b[0] - a[0]) * f, dy: a[1] + (b[1] - a[1]) * f };
}

// --- fps meter (developer aid, off for everyone by default) ---

// On with `?fps=1` in the page address (remembered on this device), off again with `?fps=0`. `stored` is the
// remembered value ("1" or null).
function fpsSetting(search, stored) {
  var m = /[?&]fps=([01])(?:&|$)/.exec(search || "");
  return m ? m[1] === "1" : stored === "1";
}

// The depth strength of this device (T-147): `?persp=0.3` in the page address sets it (0 to ISO_PERSP_MAX, remembered), `?persp=` with
// no value or out of range clears it. `stored` is the remembered text or null. Returns the number, ISO.persp when unset.
var ISO_PERSP_MAX = 0.35;
function perspSetting(search, stored) {
  var m = /[?&]persp=([^&#]*)/.exec(search || ""), text = m ? m[1] : stored;
  var n = text !== null && text !== undefined && /^\d*\.?\d+$/.test(text) ? parseFloat(text) : NaN;
  return n >= 0 && n <= ISO_PERSP_MAX ? n : ISO.persp;
}

// Renders per second and render time over the last `windowMs` ms. `samples` are [{at, ms}] (when a render
// started, how long it took). Returns {fps, ms, worst}; ms and worst are 0 without samples.
function fpsStats(samples, now, windowMs) {
  var recent = samples.filter(function (s) { return now - s.at <= windowMs && s.at <= now; });
  var total = 0, worst = 0;
  recent.forEach(function (s) { total += s.ms; worst = Math.max(worst, s.ms); });
  return { fps: recent.length * 1000 / windowMs, ms: recent.length ? total / recent.length : 0, worst: worst };
}

// The meter's line, e.g. "3D 30 fps · cpu 1.2 ms (max 3.1) · gpu 2.0 ms · 140 calls · 52k tris · px 1.5". The cpu time is the
// CPU side of a render (the GPU works on after `render()` returns). `gpu` is {ms (null = no timer query), calls, tris}
// or omitted.
function fpsText(stats, pixelRatio, gpu, quality) {
  var s = "3D " + Math.round(stats.fps) + " fps · cpu " + stats.ms.toFixed(1) + " ms (max " + stats.worst.toFixed(1) + ")";
  if (gpu) {
    s += " · gpu " + (gpu.ms == null ? "?" : gpu.ms.toFixed(1) + " ms") + " · " + gpu.calls + " calls · " +
      (gpu.tris >= 10000 ? Math.round(gpu.tris / 1000) + "k" : gpu.tris) + " tris";
  }
  s += " · px " + pixelRatio;
  if (quality) s += " · q" + quality.level + (quality.soft ? "" : " hard");
  return s;
}

// --- automatic quality (T-142) ---

// The steps from the finest picture down: WebGL pixels per CSS pixel (at most the device's), then soft shadows -> hard.
var ISO_QUALITY = [{ px: 1.5, soft: true }, { px: 1.25, soft: true }, { px: 1, soft: true }, { px: 1, soft: false }];
var ISO_QUALITY_BUDGET_MS = 40;         // a frame interval above this is slow (the 30 fps budget is 33 ms, with some slack)
var ISO_QUALITY_SLOW_MS = 2000;         // this long in a row over budget steps the quality down
var ISO_QUALITY_GOOD_MS = 20000;        // a step up is tried after this long of animating at the current level ...
var ISO_QUALITY_GOOD_SHARE = 0.9;       // ... if at least this share of the frames in that stretch was within budget (a few slow frames do not matter)
var ISO_QUALITY_GAP_MS = 400;           // an interval longer than this is a pause (idle, hidden tab), not a slow frame

function isoQualityStart() {
  return { level: 0, slow: 0, win: 0, frames: 0, late: 0, upAfter: ISO_QUALITY_GOOD_MS, probation: 0 };
}

// Pure decision, one call per drawn frame while things move. `ms` is the time since the previous drawn frame.
// Returns {state, change}: change is -1 (a step down), +1 (a step up) or 0; state is a new object.
// After a step up the new level is on probation for ISO_QUALITY_GOOD_MS: a step down within it was a failed climb and doubles
// the wait for the next one (up to 8x, no flapping); once the probation passes, the wait is back at the base.
function isoQualityStep(state, ms) {
  var s = Object.assign({}, state);
  if (!(ms > 0) || ms > ISO_QUALITY_GAP_MS) { s.slow = s.win = s.frames = s.late = 0; return { state: s, change: 0 }; }      // a pause breaks the streak and the stretch
  var late = ms > ISO_QUALITY_BUDGET_MS;
  s.slow = late ? s.slow + ms : 0;
  s.win += ms;
  s.frames++;
  if (late) s.late++;
  if (s.probation > 0) {
    s.probation -= ms;
    if (s.probation <= 0) { s.probation = 0; s.upAfter = ISO_QUALITY_GOOD_MS; }
  }
  if (s.slow >= ISO_QUALITY_SLOW_MS && s.level < ISO_QUALITY.length - 1) {
    if (s.probation > 0) s.upAfter = Math.min(s.upAfter * 2, ISO_QUALITY_GOOD_MS * 8);
    s.level++;
    s.slow = s.win = s.frames = s.late = s.probation = 0;
    return { state: s, change: -1 };
  }
  if (s.slow >= ISO_QUALITY_SLOW_MS) s.slow = 0;
  if (s.win >= s.upAfter) {
    var climb = s.level > 0 && s.late <= s.frames * (1 - ISO_QUALITY_GOOD_SHARE);
    s.win = s.frames = s.late = 0;
    if (climb) {
      s.level--;
      s.probation = ISO_QUALITY_GOOD_MS;
      return { state: s, change: 1 };
    }
  }
  return { state: s, change: 0 };
}

// Labels near the screen centre (T-150): room signs, bed tags and free-place „+“ are shown fully in a soft oval around the point
// the camera follows and fade out towards the edges in pixel steps. Radii are in half-viewport units: full at r0, gone at r1.
var ISO_LABEL_RADII = { room: [0.45, 0.95], bed: [0.30, 0.70] };

// The opacity (0, .25, .5, .75 or 1) of a label of `kind` ("room" or "bed") at `pt` [x, y]. `view` is {x, y, w, h}: the part of
// the scene on screen (same units as `pt`), centred on the point the camera follows. `zoomRel` is the zoom over the rest zoom.
function labelOpacity(pt, view, zoomRel, kind) {
  var r = ISO_LABEL_RADII[kind] || ISO_LABEL_RADII.bed;
  var widen = Math.min(1.7, Math.max(1, 1 + (zoomRel - 1.6) / 2));
  var dx = (pt[0] - (view.x + view.w / 2)) / (view.w / 2), dy = (pt[1] - (view.y + view.h / 2)) / (view.h / 2);
  var d = Math.sqrt(dx * dx + dy * dy), r0 = r[0] * widen, r1 = r[1] * widen;
  var v = d <= r0 ? 1 : d >= r1 ? 0 : (r1 - d) / (r1 - r0);
  return Math.round(v * 4) / 4;
}
