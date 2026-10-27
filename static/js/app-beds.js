"use strict";

// App part 6: drawing beds, figures and the meadow.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- beds and figures ---

// The state with the unconfirmed changes on top: {state, pending}.
function viewState() {
  return withPending(app.state, app.pending);
}

// Furniture of a bed by `kind`. The layout follows `furn()` of the approved preview, but every place gets a
// pillow, a patchwork quilt with a folded edge and a shadow on the floor, so it reads as a bed even at 1x.
// Everything stays inside `bed.rect` (plus the stove pipe), see `furnitureBounds`; only the shadow spills 2 units.
var QUILT_BLUE = ["quiltBlue", "quiltBlueFold", "quiltBlueCheck"], QUILT_RED = ["quiltRed", "quiltRedFold", "quiltRedCheck"];

function pillow(g, x, y, w) {
  rect(g, x, y, w, 6, COLORS.pillowShade);
  rect(g, x, y, w, 5, COLORS.pillow);
}

// One sleeping place: a sheet, a pillow at the head and a quilt over the lower part. `quilt` is [base, fold, check].
function berth(g, x, y, w, h, quilt) {
  rect(g, x, y, w, h, COLORS.sheet);
  pillow(g, x + 2, y + 1, w - 4);
  var qy = y + Math.max(11, Math.round(h * 0.42)), cx, cy, row;
  rect(g, x, qy, w, y + h - qy, COLORS[quilt[0]]);
  for (cy = qy + 2, row = 0; cy < y + h; cy += 3, row++) {
    for (cx = x + (row % 2) * 3; cx < x + w; cx += 6) {
      rect(g, cx, cy, Math.min(3, x + w - cx), Math.min(3, y + h - cy), COLORS[quilt[2]]);
    }
  }
  rect(g, x, qy, w, 2, COLORS[quilt[1]]);
}

function shadow(g, x, y, w, h) {
  rect(g, x + 2, y + 2, w, h, COLORS.furnShadow);
}

function drawFurniture(g, bed) {
  var x = bed.rect[0], y = bed.rect[1], w = bed.rect[2], h = bed.rect[3], i, n;
  switch (bed.kind) {
    case "bed2":
    case "bed1":
      shadow(g, x, y, w, h);
      rect(g, x, y, w, h, COLORS.bedWood);
      rect(g, x, y, w, 4, COLORS.bedWoodDark);              // headboard
      rect(g, x, y + h - 2, w, 2, COLORS.bedWoodDark);      // footboard
      berth(g, x + 2, y + 4, w - 4, h - 6, bed.kind === "bed2" ? QUILT_RED : QUILT_BLUE);
      if (bed.kind === "bed2") {                            // two pillows side by side
        rect(g, x + 2, y + 5, w - 4, 6, COLORS.sheet);
        pillow(g, x + 3, y + 5, (w - 8) / 2);
        pillow(g, x + w / 2 + 1, y + 5, (w - 8) / 2);
      }
      break;
    case "cot":
      shadow(g, x, y, w, h);
      rect(g, x, y, w, h, COLORS.cotSteelDark);
      rect(g, x + 1, y + 1, w - 2, h - 2, COLORS.cotCanvas);
      rect(g, x + 1, y + 1, 1, h - 2, COLORS.cotCanvasLight);
      for (i = y + 8; i < y + h - 2; i += 6) rect(g, x + 1, i, w - 2, 1, COLORS.cotSteelDark);      // crossbars
      rect(g, x + 3, y + 2, w - 6, 5, COLORS.pillowShade);
      rect(g, x + 3, y + 2, w - 6, 4, COLORS.pillow);
      [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]].forEach(function (p) {      // legs
        rect(g, p[0], p[1], 2, 2, COLORS.cotSteel);
      });
      break;
    case "mats":
      for (i = 0; i < bed.slots.length; i++) {
        var mx = x + i * 46;
        shadow(g, mx, y, 32, h);
        rect(g, mx, y, 32, h, COLORS.matFoam);
        rect(g, mx + 1, y + 1, 30, h - 2, COLORS.matFoamLight);
        rect(g, mx + 3, y + 2, 26, 5, COLORS.pillowShade);
        rect(g, mx + 3, y + 2, 26, 4, COLORS.pillow);
        rect(g, mx + 2, y + 13, 28, h - 15, COLORS.bag);    // sleeping bag with a zip
        rect(g, mx + 2, y + 13, 28, 2, COLORS.bagLight);
        rect(g, mx + 15, y + 15, 1, h - 17, COLORS.bagDark);
      }
      break;
    case "bunk":
      shadow(g, x, y, w, h);
      rect(g, x, y, w, h, COLORS.bedWoodDark);
      berth(g, x + 2, y + 2, w - 6, 17, QUILT_BLUE);
      berth(g, x + 2, y + 23, w - 6, h - 25, QUILT_BLUE);
      rect(g, x, y + 19, w, 4, COLORS.bedWood);             // rail between the bunks
      rect(g, x, y, 2, 2, COLORS.bedWoodLight);
      rect(g, x, y + h - 2, 2, 2, COLORS.bedWoodLight);
      rect(g, x + w - 4, y + 2, 3, h - 4, COLORS.bedWoodLight);      // ladder on the right side
      for (i = y + 5; i < y + h - 2; i += 4) rect(g, x + w - 4, i, 3, 1, COLORS.bedWoodDark);
      break;
    case "sofa":
    case "sofa1":
      shadow(g, x, y, w, h);
      rect(g, x, y, w, h, COLORS.sofaDark);
      rect(g, x + 6, y + 4, w - 9, h - 8, COLORS.sofaLight);         // seat, the backrest is on the left
      n = bed.slots.length;
      for (i = 1; i < n; i++) rect(g, x + 6, y + 4 + i * (h - 8) / n, w - 9, 1, COLORS.sofaSeam);
      for (i = 0; i < n; i++) {                             // a pillow per place
        var py = y + 5 + i * (h - 8) / n;
        rect(g, x + 9, py, w - 15, 5, COLORS.pillowShade);
        rect(g, x + 9, py, w - 15, 4, COLORS.pillow);
      }
      break;
    case "stove":
      shadow(g, x, y, w, h);
      rect(g, x, y, w, h, COLORS.stoveTileDark);
      rect(g, x + 1, y + 1, w - 2, h - 2, COLORS.stoveTile);
      for (i = x + 8; i < x + w; i += 8) rect(g, i, y + 1, 1, h - 2, COLORS.stoveTileLine);
      for (i = y + 7; i < y + h; i += 7) rect(g, x + 1, i, w - 2, 1, COLORS.stoveTileLine);
      rect(g, x + 4, y + 5, w - 8, h - 9, COLORS.stoveBlanket);       // a blanket on top
      rect(g, x + 4, y + 5, w - 8, 2, COLORS.pillow);
      rect(g, x + 4, y + h - 5, w - 8, 1, COLORS.stoveBlanketEdge);
      var pipe = stovePipeRect(bed);
      rect(g, pipe[0], pipe[1], pipe[2], pipe[3], COLORS.stovePipe);
      rect(g, pipe[0] + 1, pipe[1] + 1, pipe[2] - 2, pipe[3] - 2, COLORS.stovePipeLight);
      break;
  }
}

// A pixel figure in the party color, ported from `sprite()` of the preview. Kids are smaller.
function drawFigure(g, px, py, color, kind, ch) {
  if (kind === "kid") {
    rect(g, px + 1, py + 3, 8, 6, color);
    rect(g, px + 2, py, 6, 4, COLORS.skin);
  } else {
    rect(g, px, py + 5, 10, 7, color);
    rect(g, px + 2, py, 6, 5, COLORS.skin);
    rect(g, px + 3, py + 2, 1, 1, COLORS.eye);
    rect(g, px + 6, py + 2, 1, 1, COLORS.eye);
  }
  if (ch) {      // the first letter of the party name, like a print on the shirt (drawn last)
    var at = shirtOrigin(px, py, kind);
    svgEl(g, "path", { d: glyphPath(ch, at[0], at[1]), fill: shirtInk(color), "aria-hidden": "true" });
  }
}

// A free place: a still „+“ (no blinking: many free places blinking at once were distracting) (amber on a tight place) with a dark edge, so it reads on a white pillow too.
// It covers the same 8 x 8 box as the old square, at (px + 1, py + 2).
function drawFreeMark(parent, px, py, tight) {
  var g = svgEl(parent, "g", { "class": "free" });
  rect(g, px + 3, py + 2, 4, 8, COLORS.ink);
  rect(g, px + 1, py + 4, 8, 4, COLORS.ink);
  rect(g, px + 4, py + 3, 2, 6, tight ? COLORS.tight : COLORS.white);
  rect(g, px + 2, py + 5, 6, 2, tight ? COLORS.tight : COLORS.white);
}

// „z-z-z“ rising from the head of a figure in bed. Hidden by CSS unless the svg has the `night` class (dnPaint).
function drawZzz(parent, px, py, slot) {
  var g = svgEl(parent, "g", { "class": "zzz", "aria-hidden": "true", "pointer-events": "none", style: "animation-delay:-" + zzzDelay(slot) + "s" });
  var d = glyphPath("Z", px + 9, py - 3) + glyphPath("Z", px + 13, py - 8);
  svgEl(g, "path", { d: d, fill: COLORS.ink, transform: "translate(.6 .6)" });      // a dark edge, readable on a white pillow
  svgEl(g, "path", { d: d, fill: COLORS.white });
}

function drawBeds() {
  var g = app.layers.beds, layout = app.state.layout;
  var view = viewState();
  clearNode(g);
  if (app.isoHitsKey !== app.layoutKey) {      // the tap polygons only change with the layout
    app.isoHitsKey = app.layoutKey;
    app.isoHits = isoBedHits(app.iso, layout);
  }
  drawRoomPlates(g, layout);
  drawFeatureTreeHit(g);
  var rooms = {};
  isoBedsBackToFront(app.iso, layout).forEach(function (e) { rooms[e.bed.id] = e; drawBed(g, layout, view, e.room, e.bed); });
  drawBedHits(g, layout, rooms);
  drawBedTags(g, layout);
  drawMeadow(g, view);
}

// The tap areas of all beds, drawn over every bed: padding first, then furniture, then figures (isoHitRegions), so a
// bed's own footprint always wins over a neighbour's padding. The bed groups themselves ignore the pointer and keep
// focus, label and Tab order; a tap here does what a tap on the bed did.
function drawBedHits(parent, layout, rooms) {
  var g = svgEl(parent, "g", { "class": "bed-hits" });
  isoHitRegions(app.iso, layout).forEach(function (r) {
    var e = rooms[r.bed];
    var p = svgEl(g, "polygon", { points: pointsText(r.poly), fill: "transparent", "data-bed": r.bed, "data-part": r.part });
    p.addEventListener("click", function () {
      if (app.suppressClick) { app.suppressClick = false; return; }
      onBedTap(e.room, e.bed);
    });
    watchLongPress(p, e.bed);
    if (r.part === "figure") {      // the hover title of a person
      var who = slotOccupant(viewState().state, r.slot, app.night);
      if (who) svgEl(p, "title", null, who.party ? who.party.name : UNKNOWN_PARTY);
    }
  });
}

// The tap target of the big tree in the 3D world (its crown sways, app-iso.js). Decor, so it stays out of the Tab order.
function drawFeatureTreeHit(parent) {
  var t = isoActive() && iso3.tree;
  if (!t) return;
  var s = t.size, poly = isoBoxOutline(app.iso, [t.x - 11 * s, t.y - 11 * s, 22 * s, 22 * s], 0, 30 * s);
  svgEl(parent, "polygon", { points: pointsText(poly), fill: "transparent", "class": "tree-hit", "aria-hidden": "true" })
    .addEventListener("click", function (e) { rustleTree(e.currentTarget); isoRustle(); });
}

// The room names on small wooden signs hanging upright on the north wall of each room (never over a bed). Signs
// that would overlap move up. Decor in the same layer, ignoring taps.
function drawRoomPlates(parent, layout) {
  var sc = app.iso, k = sc.figScale;
  var plates = layout.rooms.map(function (room) {
    var size = roomSignSize(room), r = room.rect, at = isoPoint(sc, r[0] + r[2] / 2, r[1], roomWallTop(layout, room));
    return { room: room, rect: [Math.round(at[0] - size[0] * k / 2), Math.round(at[1] - size[1] * k), size[0] * k, size[1] * k] };
  });
  var dy = isoPlateShifts(plates.map(function (p) { return p.rect; }));
  var g = svgEl(parent, "g", { "aria-hidden": "true", "pointer-events": "none" });
  plates.forEach(function (p, i) {
    var sg = svgEl(g, "g", { transform: isoFigureTransform({ x: p.rect[0], y: p.rect[1] + dy[i], k: k }) });
    drawRoomSign(sg, p.room);
  });
}

// The height of the north wall of a room at its middle, as the 3D world builds it (tall on the outline of a
// house unless cut low, app-iso.js): the plate hangs on its top.
function roomWallTop(layout, room) {
  var house = (layout.houses || []).filter(function (h) { return h.rooms.indexOf(room.id) >= 0; })[0] || { id: room.id, rooms: [room.id], chimney: null };
  var rooms = layout.rooms.filter(function (r) { return house.rooms.indexOf(r.id) >= 0; });
  var walls = isoCutWalls(isoWalls(rooms, houseOutline(house, layout.rooms), layout.map.doors || []), house, layout);
  var mid = room.rect[0] + room.rect[2] / 2, top = ISO.lowWall;
  walls.forEach(function (w) {
    if (w.h0 === 0 && w.w >= w.d && w.y === room.rect[1] && w.x <= mid && mid <= w.x + w.w) top = Math.max(top, w.h);
  });
  return top;
}

// The short bed names under the beds. Hidden by CSS until the map is zoomed in (the `zoomed` class, app-zoom.js).
function drawBedTags(parent, layout) {
  var g = svgEl(parent, "g", { "class": "bed-tags", "aria-hidden": "true", "pointer-events": "none" });
  layout.rooms.forEach(function (room) {
    room.beds.forEach(function (bed) {
      isoBedTags(app.iso, bed).forEach(function (t) {
        var w = t.text.length * 2.5 + 4;
        rect(g, t.x - w / 2, t.y, w, 6, COLORS.woodDark, { opacity: ".85" });
        addText(g, t.x, t.y + 4.6, t.text, 4.5, COLORS.paper, { anchor: "middle", bold: true });
      });
    });
  });
}

// The flat shadow under a standing figure, in sprite units (the sprite group is scaled by figScale).
function drawFootShadow(g) {
  var k = app.iso.figScale, w = ISO_SHADOW[0] / k;
  rect(g, 5 - w / 2, 11, w, ISO_SHADOW[1] / k, COLORS.furnShadow);
}

// The quilt over the lower body of a sleeper, shown only at night (CSS `svg.night .quilt`).
function drawQuilt(g, kind, color) {
  var q = svgEl(g, "g", { "class": "quilt", "aria-hidden": "true" });
  var x = kind === "kid" ? 1 : 0, w = kind === "kid" ? 8 : 10, y = kind === "kid" ? 6 : 8;
  rect(q, x, y, w, 12 - y, color);
  rect(q, x, y, w, 1, COLORS.ink, { opacity: ".3" });
}

// My party's people without a bed on the selected night, standing on the meadow. One button that opens the
// places panel (T-034).
function drawMeadow(parent, view) {
  var party = app.myParty ? partyById(view.state, app.myParty) : null;
  var waiting = waitingFigures(view.state, party, app.night);
  if (!waiting.length) return;
  var sc = app.iso, meadow = view.state.layout.map.scene.meadow;
  var spot = meadowLayout(meadow, waiting.length);
  var g = svgEl(parent, "g");
  var ch = shirtChar(party.name);
  svgEl(g, "polygon", { points: pointsText(isoMeadowHit(sc, view.state.layout, meadow, waiting.length)), "class": "hit" });
  spot.cells.map(function (cell, i) { return { cell: cell, kind: waiting[i].kind, v: isoPoint(sc, cell[0] + 5, cell[1] + 7, 0)[1] }; })
    .sort(function (a, b) { return a.v - b.v; })
    .forEach(function (e) {
      var fg = svgEl(g, "g", { transform: isoFigureTransform(isoFigure(sc, e.cell, 0)) });
      drawFootShadow(fg);
      drawFigure(fg, 0, 0, party.color, e.kind, ch);
    });
  if (spot.morePos) {
    var cg = svgEl(g, "g", { transform: isoFigureTransform(isoFigure(sc, spot.morePos, 0)) });
    var chip = [-1, 0, 12, 12];
    board(cg, chip, COLORS.plank);
    addText(cg, chip[0] + 6, chip[1] + 8.5, "+" + spot.more, 7, COLORS.paper, { anchor: "middle", bold: true });
  }
  makeButton(g, meadowButtonLabel(waiting.length), "meadow", function () { openPlacesPanel(app.night); });
}

function drawBed(parent, layout, view, room, bed) {
  var night = app.night, st = view.state, sc = app.iso;
  var hit = app.isoHits[bed.id], quilt = COLORS[isoQuiltKey(bed.kind)];
  var g = svgEl(parent, "g", { "class": "bed", "pointer-events": "none" });      // taps go to drawBedHits
  svgEl(g, "polygon", { points: pointsText(hit), "class": "hit" });      // only the look of the keyboard focus
  isoSlotOrder(sc, bed).forEach(function (i) {
    if (bed.kind === "bunk" && i === 0) {      // the rail of the top berth lies over the sleeper below
      isoBunkRail(sc, bed).forEach(function (poly) {
        svgEl(g, "polygon", { points: pointsText(poly), fill: COLORS.bedWood, stroke: COLORS.bedWoodDark, "stroke-width": .5, "aria-hidden": "true" });
      });
    }
    var slot = bed.slots[i];
    if (app.walking[night + "|" + slot]) return;      // its figure is still walking over from the meadow
    var who = slotOccupant(st, slot, night);
    var fx = dnSlotFx(night, slot), ghost = fx && fx.old ? slotOccupant(st, slot, fx.old) : null;
    var og = svgEl(g, "g", { transform: isoFigureTransform(isoFigure(sc, figurePosition(bed, i), isoSlotHeight(bed, i))) });
    if (ghost) {      // the figure of the old night getting up
      var gg = svgEl(og, "g", { "class": "dn-out", style: fx.style });
      drawFootShadow(gg);
      drawFigure(gg, 0, 0, ghost.party ? ghost.party.color : COLORS.mat, ghost.kind, ghost.party ? shirtChar(ghost.party.name) : null);
      drawQuilt(gg, ghost.kind, quilt);
    }
    var cls = (view.pending[night + "|" + slot] ? "pending " : "") + (fx && fx.inn ? "dn-in" : "");
    var sg = svgEl(og, "g", cls ? { "class": cls.trim(), style: fx && fx.inn ? fx.style : "" } : null);
    drawFootShadow(sg);
    if (who) {
      var color = who.party ? who.party.color : COLORS.mat;
      if (who.party && who.party.id === app.myParty) {      // the yellow frame of my party
        rect(sg, -1, -1, 12, 14, "none", { stroke: COLORS.highlight, "stroke-width": 2 });
      }
      drawFigure(sg, 0, 0, color, who.kind, who.party ? shirtChar(who.party.name) : null);
      drawQuilt(sg, who.kind, quilt);
      drawZzz(sg, 0, 0, slot);
    } else {
      drawFreeMark(sg, 0, 0, bed.tight.indexOf(slot) !== -1);
    }
  });
  var ring = { points: pointsText(hit), fill: "none", stroke: COLORS.picked, "stroke-width": 2 };
  if (app.selectedBed === bed.id) svgEl(g, "polygon", ring);
  ring["class"] = "ring";
  svgEl(g, "polygon", ring);
  makeButton(g, bedLabel(st, room, bed, night) + ". Ťuknutím otvoríš.", "bed-" + bed.id, function () { onBedTap(room, bed); });
}

// A long press on touch shows who sleeps in the bed (a hover title does not exist there).
function watchLongPress(g, bed) {
  var timer = null;
  var startX = 0, startY = 0;
  function cancel() {
    if (timer) { clearTimeout(timer); timer = null; }
  }
  g.addEventListener("pointerdown", function (e) {
    app.suppressClick = false;
    cancel();
    if (e.pointerType === "mouse") return;
    if (app.pinching || Date.now() - app.gestureAt < LONG_PRESS_MS) return;      // just after a pinch: not a press
    startX = e.clientX;
    startY = e.clientY;
    var gesture = app.gestureId;
    timer = setTimeout(function () {
      timer = null;
      if (app.pinching || gesture !== app.gestureId) return;      // a pinch or a drag started: not a long press
      app.suppressClick = true;
      showTip(bed);
    }, LONG_PRESS_MS);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (name) { g.addEventListener(name, cancel); });
  // A finger always wobbles a little: only a real drag cancels the press.
  g.addEventListener("pointermove", function (e) {
    if (timer && movedBeyond(startX, startY, e.clientX, e.clientY, LONG_PRESS_SLOP)) cancel();
  });
  g.addEventListener("contextmenu", function (e) { e.preventDefault(); });
}

function showTip(bed) {
  var st = viewState().state, names = [];
  bed.slots.forEach(function (slot) {
    var who = slotOccupant(st, slot, app.night);
    var name = who ? (who.party ? who.party.name : UNKNOWN_PARTY) : null;
    if (name && names.indexOf(name) === -1) names.push(name);
  });
  var g = app.layers.tip;
  clearNode(g);
  if (!names.length) return;
  var text = ellipsize(names.join(", "), 28), W = app.iso.W, h = 18, box = polyBox(isoBedShape(app.iso, bed));
  var w = Math.min(W - 4, text.length * 5.4 + 14);
  var x = Math.max(2, Math.min(W - w - 2, box[0] + box[2] / 2 - w / 2));
  var y = box[1] - h - 4 < 2 ? box[1] + box[3] + 4 : box[1] - h - 4;
  board(g, [x, y, w, h], COLORS.paper, COLORS.woodDark);
  addText(g, x + w / 2, y + 12, text, 8, COLORS.ink, { anchor: "middle", bold: true, maxWidth: w - 10 });
  clearTimeout(app.tipTimer);
  app.tipTimer = setTimeout(function () { clearNode(g); }, 2500);
}

function renderAge() {
  if (!app.ageNode || !app.fetchedAt) return;
  var age = liveProblemText({ stream: liveStreamMode(), errored: live.errored, lastEventMs: live.lastEventAt,
    fetchedAtMs: app.fetchedAt, nowMs: Date.now(), lastPollFailed: app.pollFailed });
  var online = onlineChips(app.state, app.myParty, CREST_CHIPS_MAX);
  var line = age || online.label;
  // Rebuilt only when something changed: this runs every second.
  var key = age || JSON.stringify([online.chips, online.more]);
  if (app.ageKey !== key) {
    app.ageKey = key;
    clearNode(app.ageNode);
    if (age) {
      app.ageNode.textContent = age;
    } else if (!online.chips.length) {
      app.ageNode.textContent = online.label;
    } else {
      app.ageNode.appendChild(htmlEl("span", { "class": "online-label", "aria-hidden": "true" }, "online:"));
      online.chips.forEach(function (c) {
        var chip = htmlEl("span", { "class": "online-chip" + (c.mine ? " mine" : ""), "aria-hidden": "true" });
        chip.style.background = c.color;
        chip.appendChild(glyphIcon(c.ch, c.ink));
        app.ageNode.appendChild(chip);
      });
      if (online.more) app.ageNode.appendChild(htmlEl("span", { "class": "online-more", "aria-hidden": "true" }, "+" + online.more));
    }
  }
  var crest = $("crest");
  if (crest && app.crestLabel) crest.setAttribute("aria-label", app.crestLabel + " " + line + ".");
}
