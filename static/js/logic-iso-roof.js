// Pure page logic: the roofs of the isometric 3D world and the rule that opens and closes the houses (T-137).
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).
//
// At the rest view every house is closed: tall walls all round and a gable roof (app-iso-roof.js builds it from isoRoofs).
// A tap on a house, a zoom to 1.6x the rest zoom or the move mode opens it: the roof lifts away in steps, then the
// front walls sink to the low wall. All geometry comes from the room rects of config/cabin.yaml; nothing is hardcoded per house.

var ISO_ROOF = {
  overhang: 4,          // the roof reaches this far past the walls
  rise: 0.35,           // ridge height above the eaves = rise x the shorter side
  stripe: 6,            // a darker shingle row every 6 units along the slope ...
  stripeW: 1,           // ... 1 unit wide
  cap: 2,               // the ridge cap, units
  chimneyAbove: 6       // a chimney ends this far above the roof at its place
};
var ISO_OPEN_STEPS = 6;                 // 0 = closed ... 6 = open; one step per ISO_STEP_MS (125 ms)
var ISO_ROOF_LIFTS = [0, 6, 14, 26];    // the roof at steps 0..3 (gone from step 4 on)
var ISO_FRONT_MID = 0.55;               // the front walls at step 5, as a part of the closed height
var ISO_OPEN_ZOOM = 1.6;                // all houses open from this zoom (times the rest zoom) ...
var ISO_CLOSE_ZOOM = 1.15;              // ... and close again at or below this one
var ISO_HOUSE_ZOOM_MAX = 2.5;           // a tap on a house zooms in at most this far (times the rest zoom)
var ISO_HOUSE_MARGIN_PX = 16;

// The gable roofs of a house: one over the outline when its rooms fill it, otherwise one per room (same eave
// and ridge heights). Each: {x, y, w, d} the roof outline including the overhang, along "x" or "y" (the ridge
// direction, the longer side), h0 (eaves), h1 (ridge). `rooms` have `rect`; `outline` is [x, y, w, d].
function isoRoofs(rooms, outline, o) {
  o = o || ISO;
  var area = rooms.reduce(function (sum, r) { return sum + r.rect[2] * r.rect[3]; }, 0);
  var rects = area >= outline[2] * outline[3] - 1 ? [outline] : rooms.map(function (r) { return r.rect; });
  var ov = ISO_ROOF.overhang;
  return rects.map(function (r) {
    return {
      x: r[0] - ov, y: r[1] - ov, w: r[2] + 2 * ov, d: r[3] + 2 * ov,
      along: r[2] >= r[3] ? "x" : "y",
      h0: o.wallH, h1: o.wallH + ISO_ROOF.rise * Math.min(r[2], r[3])
    };
  });
}

// The height of the roofs over a plan point, or 0 outside them.
function isoRoofHeightAt(roofs, x, y) {
  var best = 0;
  roofs.forEach(function (r) {
    if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.d) return;
    var half = (r.along === "x" ? r.d : r.w) / 2, mid = r.along === "x" ? r.y + half : r.x + half;
    var off = Math.abs((r.along === "x" ? y : x) - mid);
    best = Math.max(best, r.h0 + (r.h1 - r.h0) * (1 - off / half));
  });
  return best;
}

function isoRoofTop(roofs) {
  return roofs.reduce(function (m, r) { return Math.max(m, r.h1); }, 0);
}

// The state of the opening animation at `step` (0..ISO_OPEN_STEPS, fractions in between: the roof and the walls move smoothly).
function isoOpenFrame(step) {
  var s = Math.max(0, Math.min(ISO_OPEN_STEPS, step)), i = Math.min(2, Math.floor(s)), f = Math.min(1, s - i);
  return {
    roof: s < 3.5,                             // the roof is gone from step 4 (rounded)
    lift: s >= 3 ? ISO_ROOF_LIFTS[3] : ISO_ROOF_LIFTS[i] + (ISO_ROOF_LIFTS[i + 1] - ISO_ROOF_LIFTS[i]) * f,
    front: s <= 4 ? "closed" : s < 5.5 ? "mid" : "open",
    frontScale: s <= 4 ? 1 : s >= 5 ? ISO_FRONT_MID : 1 + (ISO_FRONT_MID - 1) * (s - 4),
    svgOpen: s >= 3.5                          // the beds, figures and labels in the svg show from here
  };
}

// `step` moved by at most `delta` towards `target`.
function isoStepToward(step, target, delta) {
  var d = delta == null ? 1 : delta;
  return step < target ? Math.min(target, step + d) : step > target ? Math.max(target, step - d) : step;
}

// Whether all houses are open for a view: `rel` = zoom / rest zoom, `wasAll` = they were all open. Hysteresis
// between ISO_CLOSE_ZOOM and ISO_OPEN_ZOOM keeps the current state.
function isoZoomOpensAll(rel, wasAll) {
  if (rel >= ISO_OPEN_ZOOM) return true;
  if (rel <= ISO_CLOSE_ZOOM) return false;
  return !!wasAll;
}

// The view that shows a house after a tap: `box` = [x, y, w, h] of the house in scene units (walls and roof),
// `marginUnits` the 16 px margin in scene units. Centred on the house, at most `maxZoom` x the whole bounds
// (callers pass ISO_HOUSE_ZOOM_MAX x the rest zoom), never further out than `minZoom` (the rest zoom).
function isoHouseView(bounds, box, marginUnits, minZoom, maxZoom) {
  var needW = Math.max(box[2] + 2 * marginUnits, (box[3] + 2 * marginUnits) * bounds.w / bounds.h);
  var z = Math.max(minZoom, Math.min(maxZoom, bounds.w / needW));
  var w = bounds.w / z, h = bounds.h / z;
  return clampView({ x: box[0] + box[2] / 2 - w / 2, y: box[1] + box[3] / 2 - h / 2, w: w, h: h }, bounds);
}

// The free and all places of a house on a night, and the text of the sign on its ridge.
function houseFree(state, rooms, night) {
  var free = 0, total = 0;
  rooms.forEach(function (room) {
    room.beds.forEach(function (bed) {
      bed.slots.forEach(function (slot) {
        total++;
        if (!slotOccupant(state, slot, night)) free++;
      });
    });
  });
  return { free: free, total: total };
}

function houseSignText(free) {
  return free > 0 ? "voľné: " + free : "plno";
}

// Two wall pieces are the same place when they have the same box and the same bottom (the height may differ).
function isoWallKey(w) {
  return [w.x, w.y, w.w, w.d, w.h0].join(",");
}

// Where a chimney at plan x ends: 6 units above the roof halfway up its slope (the chimney stands on the north
// edge of the house, so a top at the ridge would be a tower; half way it still shows above the ridge from the camera).
function isoChimneyTop(roofs, x) {
  var r = roofs.filter(function (q) { return x >= q.x && x <= q.x + q.w; })[0] || roofs[0];
  return (r.h0 + r.h1) / 2 + ISO_ROOF.chimneyAbove;
}

// The houses of a layout as the 3D world builds them: the `houses` list plus one house for every room that no
// house lists. Each: {id, rooms (room ids), roof, chimney}.
function isoHouseList(layout) {
  var houses = (layout.houses || []).slice(), housed = {};
  houses.forEach(function (h) { h.rooms.forEach(function (id) { housed[id] = true; }); });
  layout.rooms.forEach(function (r) { if (!housed[r.id]) houses.push({ id: r.id, rooms: [r.id], chimney: null }); });
  return houses;
}
