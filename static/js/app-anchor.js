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
