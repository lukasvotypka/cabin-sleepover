"use strict";

// App part 6: drawing beds, figures and the meadow.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- beds and figures ---

// The state with the unconfirmed changes on top: {state, pending}.
function viewState() {
  return withPending(app.state, app.pending);
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
  isoAnchorsReset("beds");      // the items below hang on plan points (app-anchor.js) and follow the pan
  app.isoHits = isoBedHits(app.iso, layout);      // at the centre of the perspective just now, like everything drawn here
  drawRoomPlates(g, layout);
  drawFeatureTreeHit(g);
  var rooms = {}, drawn = [];
  isoPeopleBegin();      // the 3D dolls of the open rooms (app-iso-people.js)
  isoBedsBackToFront(app.iso, layout).forEach(function (e) {
    rooms[e.bed.id] = e;
    if (!roomClosed(layout, e.room.id)) drawn.push(e.room.id);
    drawBed(g, layout, view, e.room, e.bed);
  });
  drawBedHits(g, layout, rooms);
  drawHouseHits(g, view);
  drawBedTags(g, layout);
  drawMeadow(g, view);
  isoPeopleEnd(app.night + "|" + app.layoutKey + "|" + drawn.sort().join(","));
}

// The tap areas of all beds, drawn over every bed: padding first, then furniture, then figures (isoHitRegions), so a
// bed's own footprint always wins over a neighbour's padding. The bed groups themselves ignore the pointer and keep
// focus, label and Tab order; a tap here does what a tap on the bed did.
function drawBedHits(parent, layout, rooms) {
  var g = svgEl(parent, "g", { "class": "bed-hits", "aria-hidden": "true" });
  var open = function () { return isoHitRegions(app.iso, layout).filter(function (r) { return !roomClosed(layout, rooms[r.bed].room.id); }); };      // a closed house is tapped as a whole (drawHouseHits)
  var nodes = [];
  open().forEach(function (r) {
    var e = rooms[r.bed];
    var p = svgEl(g, "polygon", { points: pointsText(r.poly), fill: "transparent", "data-bed": r.bed, "data-part": r.part });
    nodes.push(p);
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
  isoPolyGroup("beds", nodes, function () { return open().map(function (r) { return r.poly; }); });
}

// The tap target of the big tree in the 3D world (its crown sways, app-iso.js). Decor, so it stays out of the Tab order.
function drawFeatureTreeHit(parent) {
  var t = isoActive() && iso3.tree;
  if (!t) return;
  var s = t.size, poly = isoBoxOutline(app.iso, [t.x - 11 * s, t.y - 11 * s, 22 * s, 22 * s], 0, 30 * s);
  var hit = svgEl(parent, "polygon", { points: pointsText(poly), fill: "transparent", "class": "tree-hit", "aria-hidden": "true" });
  isoPolyGroup("beds", [hit], function () { return [isoBoxOutline(app.iso, [t.x - 11 * s, t.y - 11 * s, 22 * s, 22 * s], 0, 30 * s)]; });
  hit.addEventListener("click", function () { rustleTree(); isoRustle(); });
}

// The room names on small wooden signs hanging upright on the far wall of each room (the north one, or the south one when the camera is in the north) (never over a bed). Signs
// that would overlap move up. Decor in the same layer, ignoring taps.
function drawRoomPlates(parent, layout) {
  var sc = app.iso, k = sc.figScale;
  var plates = layout.rooms.filter(function (room) { return !roomClosed(layout, room.id); }).map(function (room) {
    var size = roomSignSize(room), r = room.rect, at = isoPoint(sc, r[0] + r[2] / 2, isoBackSides(sc.azimuth).n ? r[1] : r[1] + r[3], roomWallTop(layout, room));
    return { room: room, plan: [r[0] + r[2] / 2, isoBackSides(sc.azimuth).n ? r[1] : r[1] + r[3], roomWallTop(layout, room)],
      rect: [Math.round(at[0] - size[0] * k / 2), Math.round(at[1] - size[1] * k), size[0] * k, size[1] * k] };
  });
  var dy = isoPlateShifts(plates.map(function (p) { return p.rect; }));
  var g = svgEl(parent, "g", { "aria-hidden": "true", "pointer-events": "none" });
  plates.forEach(function (p, i) {
    var sg = svgEl(g, "g", { transform: isoFigureTransform({ x: p.rect[0], y: p.rect[1] + dy[i], k: k }) });
    isoAnchor("beds", sg, p.plan[0], p.plan[1], p.plan[2], false);
    drawRoomSign(sg, p.room);
  });
}

// The height of the far wall (north or south, see drawRoomPlates) of a room at its middle, as the 3D world builds it (tall on
// the outline of a house unless cut low, app-iso.js): the plate hangs on its top.
function roomWallTop(layout, room) {
  var house = (layout.houses || []).filter(function (h) { return h.rooms.indexOf(room.id) >= 0; })[0] || { id: room.id, rooms: [room.id], chimney: null };
  var rooms = layout.rooms.filter(function (r) { return house.rooms.indexOf(r.id) >= 0; });
  var azimuth = app.iso.azimuth, side = isoBackSides(azimuth).n ? "n" : "s";
  var walls = isoCutWalls(isoWalls(rooms, houseOutline(house, layout.rooms), layout.map.doors || [], Object.assign({}, ISO, { azimuth: azimuth })), house, layout);
  var mid = room.rect[0] + room.rect[2] / 2, top = ISO.lowWall;
  walls.forEach(function (w) {
    if (w.h0 === 0 && w.side === side && w.x <= mid && mid <= w.x + w.w && w.y >= room.rect[1] && w.y < room.rect[1] + room.rect[3]) top = Math.max(top, w.h);
  });
  return top;
}

// The short bed names under the beds. Hidden by CSS until the map is zoomed in (the `zoomed` class, app-zoom.js).
function drawBedTags(parent, layout) {
  var g = svgEl(parent, "g", { "class": "bed-tags", "aria-hidden": "true", "pointer-events": "none" });
  layout.rooms.forEach(function (room) {
    if (roomClosed(layout, room.id)) return;
    room.beds.forEach(function (bed) {
      isoBedTags(app.iso, bed).forEach(function (t) {
        var w = t.text.length * 2.5 + 4, tg = svgEl(g, "g"), q = isoUnpoint(app.iso, t.x, t.y);
        isoAnchor("beds", tg, q[0], q[1], 0, false);
        rect(tg, t.x - w / 2, t.y, w, 6, COLORS.woodDark, { opacity: ".85" });
        addText(tg, t.x, t.y + 4.6, t.text, 4.5, COLORS.paper, { anchor: "middle", bold: true });
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
  var meadowHit = isoMeadowHit(sc, view.state.layout, meadow, waiting.length);
  var meadowNode = svgEl(g, "polygon", { points: pointsText(meadowHit), "class": "hit" });
  isoPolyGroup("beds", [meadowNode], function () { return [isoMeadowHit(app.iso, view.state.layout, meadow, waiting.length)]; });
  spot.cells.map(function (cell, i) { return { cell: cell, kind: waiting[i].kind, i: i, v: isoPoint(sc, cell[0] + 5, cell[1] + 7, 0)[1] }; })
    .sort(function (a, b) { return a.v - b.v; })
    .forEach(function (e) {
      if (isoPeopleSpecs) {      // a 3D doll standing on the meadow
        isoPeopleAdd({ key: "w|" + e.i, kind: e.kind, color: party.color, ch: ch, x: e.cell[0] + 5, z: e.cell[1] + 7, h: 0, pose: "stand", scale: 1,
          pending: false, mine: false, fade: null, hop: { index: e.i, count: spot.cells.length } });
        return;
      }
      var fg = svgEl(g, "g", { transform: isoFigureTransform(isoFigure(sc, e.cell, 0)) });
      drawFootShadow(fg);
      drawFigure(fg, 0, 0, party.color, e.kind, ch);
    });
  if (spot.morePos) {
    var cg = svgEl(g, "g", { transform: isoFigureTransform(isoFigure(sc, spot.morePos, 0)) });
    isoAnchor("beds", cg, spot.morePos[0] + 5, spot.morePos[1] + 7, 0, false);
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
  isoAnchor("beds", g, bed.rect[0] + bed.rect[2] / 2, bed.rect[1] + bed.rect[3] / 2, 0, true);
  if (roomClosed(layout, room.id)) {      // the house is closed: only the keyboard and screen readers reach the bed, and focus opens the house
    makeButton(g, bedLabel(st, room, bed, night) + ". Ťuknutím otvoríš.", "bed-" + bed.id, function () { onBedTap(room, bed); });
    return;
  }
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
    var three = !!isoPeopleSpecs, pend = !!view.pending[night + "|" + slot];
    if (ghost && three) {      // the figure of the old night getting up, faded out in 3D
      isoPeopleAdd(isoBedSpec(bed, i, ghost, { key: "g|" + night + "|" + slot, fade: { dir: -1, start: dn.swap.start } }));
    } else if (ghost) {      // the figure of the old night getting up
      var gg = svgEl(og, "g", { "class": "dn-out", style: fx.style });
      drawFootShadow(gg);
      drawFigure(gg, 0, 0, ghost.party ? ghost.party.color : COLORS.mat, ghost.kind, ghost.party ? shirtChar(ghost.party.name) : null);
      drawQuilt(gg, ghost.kind, quilt);
    }
    var cls = (view.pending[night + "|" + slot] ? "pending " : "") + (fx && fx.inn ? "dn-in" : "");
    var sg = svgEl(og, "g", cls ? { "class": cls.trim(), style: fx && fx.inn ? fx.style : "" } : null);
    if (!three) drawFootShadow(sg);
    if (who) {
      var color = who.party ? who.party.color : COLORS.mat, mine = !!(who.party && who.party.id === app.myParty);
      if (three) {
        isoPeopleAdd(isoBedSpec(bed, i, who, { key: night + "|" + slot + "|" + (who.party ? who.party.id : "?") + "|" + who.kind, pending: pend, mine: mine,
          fade: fx && fx.inn ? { dir: 1, start: dn.swap.start } : null }));
      } else {
        if (mine) rect(sg, -1, -1, 12, 14, "none", { stroke: COLORS.highlight, "stroke-width": 2 });      // the yellow frame of my party
        drawFigure(sg, 0, 0, color, who.kind, who.party ? shirtChar(who.party.name) : null);
        drawQuilt(sg, who.kind, quilt);
      }
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
