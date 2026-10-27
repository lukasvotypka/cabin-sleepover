"use strict";

// App part 5: drawing the scene (ground, the flat fallback of the world, the room signs, rendering).
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

function drawGround(g, bounds) {
  if (isoActive()) return;      // the 3D world has its own, endless grass under the svg
  var pattern = g.querySelector("pattern");
  if (!pattern) {
    var defs = svgEl(g, "defs", {});
    pattern = svgEl(defs, "pattern", { id: "grassTile", width: GRASS_TILE, height: GRASS_TILE, patternUnits: "userSpaceOnUse" });
    rect(pattern, 0, 0, GRASS_TILE, GRASS_TILE, COLORS.grass);
    GRASS_TUFTS.forEach(function (t, k) { rect(pattern, t[0], t[1], 4, 4, k === 1 ? COLORS.leafRust : k === 4 ? COLORS.leafOchre : k === 6 ? COLORS.leafRed : COLORS.tuft); });
    svgEl(g, "rect", { "class": "ground", fill: "url(#grassTile)" });
  }
  var r = g.querySelector(".ground");
  var gr = groundRect(bounds);
  r.setAttribute("x", gr[0]);
  r.setAttribute("y", gr[1]);
  r.setAttribute("width", gr[2]);
  r.setAttribute("height", gr[3]);
}

// A decorative bird that crosses the map every 28 s (see `.bird` in the style sheet). It is drawn in the svg
// in map units, so it stays over the land when the map is panned or zoomed. It flies from just left of the map
// to just right of it along `BIRD.y`, over everything, in its own aria-hidden layer that ignores taps. Two frames
// of 7 x 3 cells flap the wings; `prefers-reduced-motion` hides it. It chirps once per flight (app-sound.js).
var BIRD = { cell: 4, margin: 40 };      // flies across the whole scene width, in the strip of grass at the top of the scene
var BIRD_FRAMES = [
  [[1, 0, 1], [5, 0, 1], [2, 1, 3]],               // wings up: [x, y, width] in cells
  [[2, 1, 3], [1, 2, 1], [5, 2, 1]]                // wings down
];
function birdY(iso) {
  return Math.round(iso.top / 2);
}
function drawBird(g, layout) {
  var c = BIRD.cell, x0 = -BIRD.margin - 7 * c, fly = app.iso.W + 2 * BIRD.margin + 7 * c;
  var y = birdY(app.iso);
  var bird = svgEl(g, "g", { "aria-hidden": "true", "class": "bird", style: "--fly:" + fly + "px" });
  bird.addEventListener("animationstart", onBirdFlight);
  bird.addEventListener("animationiteration", onBirdFlight);
  BIRD_FRAMES.forEach(function (frame, k) {
    var f = svgEl(bird, "g", { "class": k === 0 ? "bird-frame-a" : "bird-frame-b" });
    frame.forEach(function (r) { rect(f, x0 + r[0] * c, y + r[1] * c, r[2] * c, c, COLORS.ink); });
  });
}

// The flat fallback of the 3D world (no WebGL): paths, room floors, doors and bed outlines at their projected
// places (logic-iso.js), on the grass of drawGround. With the 3D world running the svg draws no ground at all.
function drawBase(g, layout) {
  if (isoActive()) return;
  var sc = app.iso;
  function poly(r, h0, h1, fill, attrs) {
    var a = { points: pointsText(isoBoxOutline(sc, r, h0, h1)), fill: fill };
    if (attrs) Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    return svgEl(g, "polygon", a);
  }
  layout.map.paths.forEach(function (p) { poly(p, 0, 0, COLORS.path); });
  layout.rooms.forEach(function (room) {
    var r = room.rect;
    poly(r, 0, 0, COLORS.roomEdge);
    poly([r[0] + 4, r[1] + 4, r[2] - 8, r[3] - 8], 0, 0, room.floor);
    room.beds.forEach(function (bed) {
      poly(bed.rect, 0, isoSlotHeight(bed, bed.kind === "bunk" ? 1 : 0), COLORS.sheet, { stroke: COLORS.woodDark, "stroke-width": 1, opacity: ".7" });
    });
  });
  layout.map.doors.forEach(function (d) { poly(d, 0, 0, doorFloorColor(layout, d) || COLORS.path); });
}

// The room name on a small wooden sign (T-133: upright, drawn at (0, 0) in sprite units and placed by
// drawRoomPlates). The scene font is monospace, so the width follows the number of letters (about 0.6 em each);
// a long name is squeezed to the band.
var ROOM_SIGN_SIZE = 8;
function roomSignSize(room) {
  var band = roomLabelBand(room);
  return [Math.min(band[2], Math.ceil(room.name.length * ROOM_SIGN_SIZE * .6) + 12), band[3]];
}
function drawRoomSign(g, room) {
  var size = roomSignSize(room), w = size[0], h = size[1];
  rect(g, 0, 0, w, h, COLORS.woodDark);
  rect(g, 1, 1, w - 2, h - 2, COLORS.plank);
  rect(g, 1, 1, w - 2, 1, COLORS.woodLight, { opacity: ".55" });
  rect(g, 2, h / 2 - 1, 2, 2, COLORS.woodLight);                           // nails
  rect(g, w - 4, h / 2 - 1, 2, 2, COLORS.woodLight);
  addText(g, w / 2, 8.5, room.name, ROOM_SIGN_SIZE, COLORS.paper, { anchor: "middle", bold: true, maxWidth: w - 12 });
}

// The element below `root` with this data-key, or null.
function byKey(root, key) {
  var found = null;
  Array.prototype.forEach.call(root.querySelectorAll("[data-key]"), function (node) {
    if (node.getAttribute("data-key") === key) found = node;
  });
  return found;
}

// Runs `redraw`, which rebuilds the nodes below `root`, and gives keyboard focus back to the element
// with the same data-key. If that element is gone, focus goes to `fallback(root)` when given.
function keepFocus(root, redraw, fallback) {
  var active = document.activeElement;
  var key = active && root.contains(active) && active.getAttribute ? active.getAttribute("data-key") : null;
  redraw();
  if (!key) return;
  var again = byKey(root, key) || (fallback ? fallback(root) : null);
  if (again && again.focus) again.focus({ preventScroll: true });
}

function render() {
  if (!app.state || app.codeOpen || !app.introDone) return;     // the code screen and the loading view come first
  ensureScene();
  dnSync();
  housesQuiet = true;
  housesSync();      // the move mode opens every house
  housesQuiet = false;
  keepFocus($("scene"), function () {
    drawBoards();
    drawBeds();
  });
  renderStamps();
  renderHud();
  renderSummary();
  renderMoveBar();
  syncTurnBar();
}

// The visually hidden text summary for screen readers: the same data as the map, for the selected night.
// It is built from the state the map draws (with unconfirmed changes), not from the plain server state.
function renderSummary() {
  var host = $("srSummary"), h = hiddenSummary(viewState().state, app.night);
  clearNode(host);
  host.appendChild(htmlEl("h2", null, h.title));
  host.appendChild(htmlEl("p", null, h.dates));
  if (app.state.signup_open === false) host.appendChild(htmlEl("p", null, LOCKED_TEXTS.summary));
  host.appendChild(htmlEl("p", null, "Návod: " + h.instructions.join(" ")));
  host.appendChild(htmlEl("h3", null, h.night));
  h.rooms.forEach(function (room) {
    host.appendChild(htmlEl("h4", null, room.name));
    var list = htmlEl("ul");
    room.beds.forEach(function (bed) { list.appendChild(htmlEl("li", null, bed.name + ": " + bed.text)); });
    host.appendChild(list);
  });
  host.appendChild(htmlEl("h3", null, "Kto kde spí po nociach"));
  var parties = htmlEl("ul");
  var lines = partyTableSummary(app.state, app.myParty);
  if (!lines.length) lines = [partyTableEmptyText(app.state)];
  lines.forEach(function (line) { parties.appendChild(htmlEl("li", null, line)); });
  host.appendChild(parties);
  if (h.dayVisits.length) {
    host.appendChild(htmlEl("h3", null, "Návštevy cez deň"));
    var visits = htmlEl("ul");
    h.dayVisits.forEach(function (line) { visits.appendChild(htmlEl("li", null, line)); });
    host.appendChild(visits);
  }
}

function renderBeds() {
  keepFocus($("scene"), drawBeds);
}
