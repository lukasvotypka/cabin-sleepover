"use strict";

// App part: svg items that follow the pan (T-147). The perspective of the map is centred on the plan point under the screen
// centre (isoSetCentre in logic-iso.js), so every projected point shifts a little each time the view moves. The 3D world follows
// by moving its camera. The svg items drawn at projected points (tap areas, bed groups, room signs, bed tags, ridge signs, the
// notice board and the title gate) hang on an anchor: a plan point whose new place gives the item a `transform` (isoAnchorTransform),
// so nothing is drawn again while panning. A redraw makes new anchors at the current centre.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var isoAnchors = [];      // [{layer, node, base, a}]: `base` is the node's own transform attribute
var isoPolys = [];        // [{layer, nodes, fn}]: tap polygons projected again at each new centre
var isoAnchorsKey = "";      // the centre the nodes were last moved for

// Forgets the anchors of one layer (its nodes are about to be removed), or all of them.
function isoAnchorsReset(layer) {
  isoAnchors = layer ? isoAnchors.filter(function (r) { return r.layer !== layer; }) : [];
  isoPolys = layer ? isoPolys.filter(function (r) { return r.layer !== layer; }) : [];
  isoLabels = layer ? isoLabels.filter(function (r) { return r.layer !== layer; }) : [];
  isoLabelsKey = "";
  isoAnchorsKey = "";
}

// Hangs `node` on the plan point (x, y, h) of the current scene. `scaled` items also grow with the depth.
function isoAnchor(layer, node, x, y, h, scaled) {
  isoAnchors.push({ layer: layer, node: node, base: node.getAttribute("transform") || "", a: isoAnchorMake(app.iso, x, y, h, scaled) });
  return node;
}

// Tap polygons are not anchored by a transform: a house or a bed is deep, so one shift and one scale cannot follow the
// parallax across it. Each group keeps a function that gives its polygons at the current centre; they are set exactly.
// `nodes` are the svg polygons, `fn()` returns their point lists in the same order.
function isoPolyGroup(layer, nodes, fn) {
  isoPolys.push({ layer: layer, nodes: nodes, fn: fn });
}

// Moves every anchored node to the current centre of the perspective. Cheap enough to run on every pan frame.
function isoAnchorsUpdate() {
  var sc = app.iso;
  if (!sc || !sc.basis.D) return;
  var key = sc.basis.tx + "," + sc.basis.ty;
  if (key === isoAnchorsKey) return;
  isoAnchorsKey = key;
  isoPolys.forEach(function (g) {
    var polys = g.fn();
    if (polys.length === g.nodes.length) g.nodes.forEach(function (n, i) { n.setAttribute("points", pointsText(polys[i])); });
  });
  isoAnchors.forEach(function (r) {
    r.node.setAttribute("transform", isoAnchorTransform(sc, r.a) + (r.base ? " " + r.base : ""));
  });
}

// --- labels that fade away from the screen centre (T-150) ---
var isoLabels = [];       // [{layer, node, kind, x, y, h, ids, full, v}]: `ids` are the bed ids whose focus keeps the label full
var isoLabelsKey = "";
var isoRestZoomKey = "", isoRestZoom = 1;

// Registers `node` as a fading label of `kind` ("room" or "bed") at the plan point (x, y, h). `full` keeps it fully shown
// (a pending write), `ids` lists the beds whose keyboard focus or open sheet does the same.
function isoLabel(layer, node, kind, x, y, h, ids, full) {
  node.classList.add("fade-label");
  isoLabels.push({ layer: layer, node: node, kind: kind, x: x, y: y, h: h || 0, ids: ids || [], full: !!full, v: 1 });
  return node;
}

function isoLabelsRestZoom() {
  var key = app.bounds.w + "," + (app.viewportPx || []).join("x");
  if (key !== isoRestZoomKey) { isoRestZoomKey = key; isoRestZoom = viewZoom(appRestView(app.bounds), app.bounds); }
  return isoRestZoom;
}

// Sets each label's opacity from its screen point. Runs on every view change; writes only when the stepped value changed.
function isoLabelsUpdate(force) {
  var sc = app.iso, v = app.view;
  if (!sc || !v || !app.bounds || !isoLabels.length) return;
  var px = app.viewportPx || [0, 0], s = px[0] > 0 && px[1] > 0 ? Math.min(px[0] / v.w, px[1] / v.h) : 0;
  var view = s ? { x: v.x - (px[0] / s - v.w) / 2, y: v.y - (px[1] / s - v.h) / 2, w: px[0] / s, h: px[1] / s } : v;
  var rel = viewZoom(v, app.bounds) / isoLabelsRestZoom();
  var ae = document.activeElement, key = ae && ae.getAttribute ? ae.getAttribute("data-key") : null;
  var stamp = [sc.basis.tx, sc.basis.ty, view.x, view.y, view.w, view.h, rel, key, app.selectedBed].join(",");
  if (!force && stamp === isoLabelsKey) return;
  isoLabelsKey = stamp;
  isoLabels.forEach(function (r) {
    var full = r.full || r.ids.some(function (id) { return key === "bed-" + id || app.selectedBed === id; });
    var o = full ? 1 : labelOpacity(isoPoint(sc, r.x, r.y, r.h), view, rel, r.kind);
    if (o === r.v) return;
    r.v = o;
    r.node.style.opacity = o === 1 ? "" : String(o);
    r.node.style.visibility = o === 0 ? "hidden" : "";
  });
}
document.addEventListener("focusin", function () { isoLabelsUpdate(); });
document.addEventListener("focusout", function () { isoLabelsUpdate(); });

// The depth strength of this device: `?persp=0.3` in the page address tunes it (0 to 0.35, remembered), `?persp=` or an
// out of range value clears it (pure part: perspSetting in logic-iso.js). Runs once when the script loads, before any scene is built.
(function () {
  var m = /[?&]persp=([^&#]*)/.exec(location.search);
  if (m) {
    var n = perspSetting(location.search, null);
    if (m[1] !== "" && n !== ISO.persp) storage.set(KEYS.persp, m[1]);
    else storage.remove(KEYS.persp);
  }
  ISO.persp = perspSetting(location.search, storage.get(KEYS.persp));
})();
