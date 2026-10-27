"use strict";

// App part: which houses are open (T-137). At the rest view every house is closed (roof on; its beds, figures and
// labels are hidden and a sign on the ridge says how many places are free). A tap on a closed house opens it and
// zooms to it; zooming to 1.6x the rest zoom opens all, back to 1.15x (or „Celá mapa“) closes all; the move mode
// and keyboard focus on a bed open the house concerned. The 3D side (roofs, walls, steps) is app-iso-roof.js.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var housesOpen = {};          // house id -> true: opened by a tap or the keyboard
var housesAll = false;        // zoomed in far enough: all open
var housesLastW = 0;          // the view width the zoom rule last looked at (a pan does not count)
var housesTween = 0;          // rAF id of the zoom to a house
var housesZooming = false;    // that zoom is on its way: the zoom rule waits
var housesQuiet = false;      // set while render() syncs, so that it does not draw twice

// The 3D world asks while it builds: should this house start open?
function isoHouseWant(id) {
  return !!(app.move || housesAll || housesOpen[id]);
}

function houseOfRoom(layout, roomId) {
  return isoHouseList(layout).filter(function (h) { return h.rooms.indexOf(roomId) >= 0; })[0] || null;
}

// The beds, figures and labels of this room are hidden: its house stands closed (always shown without the 3D world).
function roomClosed(layout, roomId) {
  var h = houseOfRoom(layout, roomId);
  return !!h && !isoHouseSvgOpen(h.id);
}

// Sends the wanted state to the 3D world (instant with reduced motion).
function housesSync() {
  if (!isoActive() || !app.state) return;
  var want = {};
  isoHouseList(app.state.layout).forEach(function (h) { want[h.id] = isoHouseWant(h.id); });
  isoSetHouses(want);
}

// The 3D world crossed the point where the svg side of a house changes.
function onHouseVisualChange() {
  if (!housesQuiet && app.state) renderBeds();
}

function houseBox(layout, house) {
  var rooms = layout.rooms.filter(function (r) { return house.rooms.indexOf(r.id) >= 0; });
  var outline = houseOutline(house, layout.rooms);
  var top = isoRoofTop(isoRoofs(rooms, outline));
  return { outline: outline, rooms: rooms, top: top, poly: isoBoxOutline(app.iso, outline, 0, top) };
}

// A tap on a closed house: open it and zoom to it.
function openHouse(id, zoom) {
  if (housesOpen[id] && !zoom) return;
  var layout = app.state.layout, house = isoHouseList(layout).filter(function (h) { return h.id === id; })[0];
  if (!house) return;
  housesOpen[id] = true;
  housesSync();
  if (!zoom || !app.bounds || !app.view) return;
  var rest = appRestView(app.bounds), restZoom = viewZoom(rest, app.bounds), px = app.viewportPx || [380, 600];
  var margin = ISO_HOUSE_MARGIN_PX * rest.w / px[0] / 2;
  var to = isoHouseView(app.bounds, polyBox(houseBox(layout, house).poly), margin, restZoom, restZoom * ISO_HOUSE_ZOOM_MAX);
  zoomViewTo(to);
}

// Opens (without zoom) the closed houses that hold a slot of the pending changes.
function openHousesOfSlots(ops) {
  var layout = app.state && app.state.layout;
  if (!layout) return;
  layout.rooms.forEach(function (room) {
    var hit = room.beds.some(function (b) { return b.slots.some(function (s) { return ops.some(function (op) { return op.slot === s; }); }); });
    var house = hit && roomClosed(layout, room.id) ? houseOfRoom(layout, room.id) : null;
    if (house) openHouse(house.id, false);
  });
}

function zoomViewTo(to) {
  stopHouseTween();
  if (prefersReducedMotion()) {
    housesLastW = to.w;
    setView(to);
    return;
  }
  var from = app.view, start = performance.now();
  housesZooming = true;      // the zoom rule ignores the way there
  (function frame(now) {
    var t = Math.min(1, (now - start) / 450);
    setView(introViewAt(from, to, t));
    housesLastW = app.view.w;
    if (t < 1) housesTween = requestAnimationFrame(frame);
    else housesTween = 0, housesZooming = false;
  })(start);
}

function stopHouseTween() {
  if (!housesTween) return;
  cancelAnimationFrame(housesTween);
  housesTween = 0;
  housesZooming = false;
}
["pointerdown", "touchstart", "wheel", "keydown"].forEach(function (type) {
  $("scene").addEventListener(type, stopHouseTween, { capture: true, passive: true });
});

// Called by applyView after every change of the view: a new zoom opens or closes all the houses.
function housesZoomRule() {
  if (!app.bounds || !app.view || !app.state || !isoActive()) return;
  if (Math.abs(app.view.w - housesLastW) < 0.01) return;      // a pan
  housesLastW = app.view.w;
  if (housesZooming || introActive()) return;
  var rel = viewZoom(app.view, app.bounds) / viewZoom(appRestView(app.bounds), app.bounds);
  var all = isoZoomOpensAll(rel, housesAll), single = Object.keys(housesOpen).length > 0;
  if (all === housesAll && !(single && rel <= ISO_CLOSE_ZOOM)) return;      // back at the rest zoom, houses opened by a tap close too
  housesAll = all;
  if (!all) housesOpen = {};
  housesSync();
}

// Keyboard focus on a bed of a closed house opens it (no zoom).
$("scene").addEventListener("focusin", function (e) {
  var key = e.target && e.target.getAttribute ? e.target.getAttribute("data-key") : null;
  if (!key || key.indexOf("bed-") !== 0 || !app.state || !isoActive() || Date.now() - app.navKeyAt > 500) return;      // only a key (Tab) press, not focus handed back after a redraw or a panel
  var id = key.slice(4), layout = app.state.layout;
  layout.rooms.forEach(function (room) {
    if (room.beds.some(function (b) { return b.id === id; }) && roomClosed(layout, room.id)) openHouse(houseOfRoom(layout, room.id).id, false);
  });
});

// The tap areas and ridge signs of the closed houses, nearest house last so that it wins where hulls overlap.
function drawHouseHits(parent, view) {
  var layout = view.state.layout, sc = app.iso;
  var closed = isoHouseList(layout).filter(function (h) { return !isoHouseSvgOpen(h.id); }).map(function (h) {
    var box = houseBox(layout, h);
    return { house: h, box: box, id: h.id, outline: box.outline };
  });
  var list = isoHouseOrder(sc, closed);
  list.forEach(function (e) {
    var g = svgEl(parent, "g", { "class": "house", "aria-hidden": "true" });
    var hits = isoHouseSilhouette(sc, e.box.rooms, e.box.outline).map(function (poly) {
      return svgEl(g, "polygon", { points: pointsText(poly), fill: "transparent", "class": "house-hit", "data-house": e.house.id });
    });
    hits.forEach(function (hit) {
      hit.addEventListener("click", function () {
        if (app.suppressClick) { app.suppressClick = false; return; }
        openHouse(e.house.id, true);
      });
      hit.addEventListener("pointerenter", function (ev) { if (ev.pointerType === "mouse") isoHouseHover(e.house.id, true); });
      hit.addEventListener("pointerleave", function () { isoHouseHover(e.house.id, false); });
    });
    var roof = isoRoofs(e.box.rooms, e.box.outline).sort(function (a, b) { return b.h1 - a.h1; })[0];
    var text = houseSignText(houseFree(view.state, e.box.rooms, app.night).free), k = sc.figScale;
    var w = text.length * 4.6 + 10, h = 13, at = isoPoint(sc, roof.x + roof.w / 2, roof.y + roof.d / 2, roof.h1 + 2);
    var sg = svgEl(g, "g", { transform: "translate(" + round3(at[0] - w * k / 2) + " " + round3(at[1] - h * k) + ") scale(" + k + ")", "pointer-events": "none", "class": "house-sign" });
    board(sg, [0, 0, w, h], COLORS.paper, COLORS.woodDark);
    addText(sg, w / 2, 9.2, text, 7, COLORS.ink, { anchor: "middle", bold: true });
  });
}
