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

function drawBeds() {
  var g = app.layers.beds, layout = app.state.layout;
  var view = viewState();
  clearNode(g);
  layout.rooms.forEach(function (room) {
    room.beds.forEach(function (bed) { drawBed(g, layout, view, room, bed); });
  });
  drawBedTags(g, layout);
  drawMeadow(g, view);
}

// The short bed names under the beds. Hidden by CSS until the map is zoomed in (the `zoomed` class, app-zoom.js).
function drawBedTags(parent, layout) {
  var g = svgEl(parent, "g", { "class": "bed-tags", "aria-hidden": "true", "pointer-events": "none" });
  layout.rooms.forEach(function (room) {
    room.beds.forEach(function (bed) {
      bedTags(bed).forEach(function (t) {
        var w = t.text.length * 2.5 + 4;
        rect(g, t.x - w / 2, t.y, w, 6, COLORS.woodDark, { opacity: ".85" });
        addText(g, t.x, t.y + 4.6, t.text, 4.5, COLORS.paper, { anchor: "middle", bold: true });
      });
    });
  });
}

// My party's people without a bed on the selected night, standing on the meadow. One button that opens the
// places panel (T-034).
function drawMeadow(parent, view) {
  var party = app.myParty ? partyById(view.state, app.myParty) : null;
  var waiting = waitingFigures(view.state, party, app.night);
  if (!waiting.length) return;
  var spot = meadowLayout(view.state.layout.map.scene.meadow, waiting.length);
  var g = svgEl(parent, "g");
  var ch = shirtChar(party.name);
  spot.cells.forEach(function (cell, i) {
    drawFigure(g, cell[0], cell[1], party.color, waiting[i].kind, ch);
  });
  if (spot.morePos) {
    var chip = [spot.morePos[0] - 1, spot.morePos[1], 12, 12];
    board(g, chip, COLORS.plank);
    addText(g, chip[0] + 6, chip[1] + 8.5, "+" + spot.more, 7, COLORS.paper, { anchor: "middle", bold: true });
  }
  hitRect(g, meadowHitRect(view.state.layout.map.scene.meadow));
  makeButton(g, meadowButtonLabel(waiting.length), "meadow", function () { openPlacesPanel(app.night); });
}

function drawBed(parent, layout, view, room, bed) {
  var night = app.night, st = view.state;
  var x = bed.rect[0], y = bed.rect[1], w = bed.rect[2], h = bed.rect[3];
  var g = svgEl(parent, "g", { "class": "bed" });
  hitRect(g, bedHit(layout, bed, BED_HIT_GROW));      // first, so figures keep their hover titles
  drawFurniture(g, bed);
  bed.slots.forEach(function (slot, i) {
    if (app.walking[night + "|" + slot]) return;      // its figure is still walking over from the meadow
    var pos = figurePosition(bed, i), who = slotOccupant(st, slot, night);
    var fx = dnSlotFx(night, slot), ghost = fx && fx.old ? slotOccupant(st, slot, fx.old) : null;
    if (ghost) {      // the figure of the old night getting up
      var gg = svgEl(g, "g", { "class": "dn-out", style: fx.style });
      drawFigure(gg, pos[0], pos[1], ghost.party ? ghost.party.color : COLORS.mat, ghost.kind, ghost.party ? shirtChar(ghost.party.name) : null);
    }
    var cls = (view.pending[night + "|" + slot] ? "pending " : "") + (fx && fx.inn ? "dn-in" : "");
    var sg = svgEl(g, "g", cls ? { "class": cls.trim(), style: fx && fx.inn ? fx.style : "" } : null);
    if (who) {
      var color = who.party ? who.party.color : COLORS.mat;
      if (who.party && who.party.id === app.myParty) {      // the yellow frame of my party
        rect(sg, pos[0] - 1, pos[1] - 1, 12, 14, "none", { stroke: COLORS.highlight, "stroke-width": 2 });
      }
      svgEl(sg, "title", null, who.party ? who.party.name : UNKNOWN_PARTY);
      drawFigure(sg, pos[0], pos[1], color, who.kind, who.party ? shirtChar(who.party.name) : null);
    } else {
      drawFreeMark(sg, pos[0], pos[1], bed.tight.indexOf(slot) !== -1);
    }
  });
  if (app.selectedBed === bed.id) rect(g, x - 3, y - 3, w + 6, h + 6, "none", { stroke: COLORS.picked, "stroke-width": 2 });
  rect(g, x - 3, y - 3, w + 6, h + 6, "none", { "class": "ring", stroke: COLORS.picked, "stroke-width": 2 });
  makeButton(g, bedLabel(st, room, bed, night) + ". Ťuknutím otvoríš.", "bed-" + bed.id, function () {
    if (app.suppressClick) { app.suppressClick = false; return; }
    onBedTap(room, bed);
  });
  watchLongPress(g, bed);
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
  var text = ellipsize(names.join(", "), 28), vb = st.layout.map.viewbox, h = 18;
  var w = Math.min(vb[0] - 4, text.length * 5.4 + 14);
  var x = Math.max(2, Math.min(vb[0] - w - 2, bed.rect[0] + bed.rect[2] / 2 - w / 2));
  var y = bed.rect[1] - h - 4 < 2 ? bed.rect[1] + bed.rect[3] + 4 : bed.rect[1] - h - 4;
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
