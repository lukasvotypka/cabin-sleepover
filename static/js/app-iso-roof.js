"use strict";

// App part: the roofs of the 3D world and the opening of the houses (T-137). A closed house has tall walls all round
// and a gable roof; opening it lifts the roof away smoothly, then the front walls sink low (isoOpenFrame in
// logic-iso-roof.js says what each step looks like). Steps advance on the shared 30 fps update; with reduced motion
// a change is instant. app-houses.js decides which houses should be open and draws the svg side.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// A flat polygon (corners [x, h, z], counter-clockwise seen from outside) with a vertex colour; the normal comes from the first three corners.
IsoBoxes.prototype.poly = function (pts, color) {
  var c = this.colors[color] || (this.colors[color] = new THREE.Color(color));
  var a = pts[0], b = pts[1], d = pts[2];
  var u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  var n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], len = Math.hypot(n[0], n[1], n[2]) || 1;
  var base = this.pos.length / 3, self = this;
  pts.forEach(function (p) {
    self.pos.push(p[0], p[1], p[2]);
    self.nor.push(n[0] / len, n[1] / len, n[2] / len);
    self.col.push(c.r, c.g, c.b);
  });
  for (var i = 1; i + 1 < pts.length; i++) this.idx.push(base, base + i, base + i + 1);
};

// One slope of a roof from the eave line (e0 to e1) up to the ridge line (r0 to r1), in shingle rows: every
// ISO_ROOF.stripe units along the slope the last ISO_ROOF.stripeW units are darker.
function isoSlope(b, e0, e1, r0, r1, color) {
  var dark = isoMix(color, "#000000", 0.18), len = Math.hypot(r0[0] - e0[0], r0[1] - e0[1], r0[2] - e0[2]);
  function at(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]; }
  function band(t0, t1, col) { b.poly([at(e0, r0, t0), at(e1, r1, t0), at(e1, r1, t1), at(e0, r0, t1)], col); }
  for (var s = 0; s < len; s += ISO_ROOF.stripe) {
    var m = Math.min(len, s + ISO_ROOF.stripe - ISO_ROOF.stripeW), t = Math.min(len, s + ISO_ROOF.stripe);
    band(s / len, m / len, color);
    if (t > m) band(m / len, t / len, dark);
  }
}

// The gable roofs of a house with the colours `colors` = {face, dark, ridge} (the sunny slope is the south one, or the west one for a ridge along y).
function isoRoofBoxes(roofs, colors) {
  var b = new IsoBoxes();
  roofs.forEach(function (r) {
    var x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.d, e = r.h0, t = r.h1;
    if (r.along === "x") {
      var ym = (y0 + y1) / 2;
      isoSlope(b, [x1, e, y1], [x0, e, y1], [x1, t, ym], [x0, t, ym], colors.face);      // south, towards the sun
      isoSlope(b, [x0, e, y0], [x1, e, y0], [x0, t, ym], [x1, t, ym], colors.dark);
      b.poly([[x0, e, y1], [x0, e, y0], [x0, t, ym]], ISO_C.log);      // gable ends
      b.poly([[x1, e, y0], [x1, e, y1], [x1, t, ym]], ISO_C.log);
      b.box(x0, ym - ISO_ROOF.cap / 2, r.w, ISO_ROOF.cap, t - 0.5, t + 1.5, colors.ridge);
    } else {
      var xm = (x0 + x1) / 2;
      isoSlope(b, [x0, e, y1], [x0, e, y0], [xm, t, y1], [xm, t, y0], colors.face);      // west, towards the sun
      isoSlope(b, [x1, e, y0], [x1, e, y1], [xm, t, y0], [xm, t, y1], colors.dark);
      b.poly([[x0, e, y0], [x1, e, y0], [xm, t, y0]], ISO_C.log);
      b.poly([[x1, e, y1], [x0, e, y1], [xm, t, y1]], ISO_C.log);
      b.box(xm - ISO_ROOF.cap / 2, y0, ISO_ROOF.cap, r.d, t - 0.5, t + 1.5, colors.ridge);
    }
  });
  return b;
}

// The meshes of one house: the roof, the tall front walls (closed) and the low ones (open). `house.roof` has the colours.
function isoHouseMeshes(scene, house, roofs, openFront, closedFront) {
  var colors = house.roof || { face: "#8E3424", dark: "#5A1F14", ridge: "#B5532A" };
  var roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  var h = {
    id: house.id, roofs: roofs, step: 0, target: 0, shown: null, svgWas: false,
    roof: isoRoofBoxes(roofs, colors).mesh(roofMat), roofMat: roofMat,
    openFront: openFront.mesh(), closedFront: closedFront.mesh()
  };
  scene.add(h.roof);
  scene.add(h.openFront);
  scene.add(h.closedFront);
  if (typeof isoHouseWant === "function" && isoHouseWant(house.id)) h.step = h.target = ISO_OPEN_STEPS;
  return h;
}

// Shows the meshes of step h.step. Returns true when the picture changed.
function isoHouseApply(h, quiet) {
  var f = isoOpenFrame(h.step), key = h.step;
  if (h.shown === key) return false;
  h.shown = key;
  h.roof.visible = f.roof;
  h.roof.position.y = f.lift;
  h.closedFront.visible = f.front !== "open";
  h.closedFront.scale.y = f.frontScale;
  h.openFront.visible = f.front === "open";
  if (iso3 && !quiet) {
    iso3.renderer.shadowMap.needsUpdate = true;      // the roof shadow is redrawn only when a house changes
    isoDirty();
  }
  if (!quiet && f.svgOpen !== h.svgWas && typeof onHouseVisualChange === "function") onHouseVisualChange();
  h.svgWas = f.svgOpen;
  return true;
}

// One update: every house moves towards its target, one step per ISO_STEP_MS (`dt` ms since the last update).
function isoHousesTick(me, dt) {
  (me.houses || []).forEach(function (h) {
    if (h.step === h.target) return;
    h.step = isoStepToward(h.step, h.target, (dt || ISO_STEP_MS) / ISO_STEP_MS);
    isoHouseApply(h);
  });
}

// `want` is {houseId: true when it should be open}. Reduced motion jumps to the end at once.
function isoSetHouses(want) {
  if (!iso3) return;
  var still = prefersReducedMotion();
  iso3.houses.forEach(function (h) {
    h.target = want[h.id] ? ISO_OPEN_STEPS : 0;
    if (still) h.step = h.target;
    isoHouseApply(h);
  });
  isoWake();
}

// The beds, figures and labels of a house show once its roof is gone (and until it is back on).
function isoHouseSvgOpen(id) {
  if (!isoActive()) return true;
  var h = iso3.houses.filter(function (q) { return q.id === id; })[0];
  return !h || isoOpenFrame(h.step).svgOpen;
}

// Desktop hover: the roof of a closed house brightens one step.
function isoHouseHover(id, on) {
  if (!iso3) return;
  iso3.houses.forEach(function (h) {
    if (h.id === id) h.roofMat.emissive.set(on ? "#3A3A3A" : "#000000");
  });
  isoDirty();
}
