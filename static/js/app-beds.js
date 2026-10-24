"use strict";

// App part 6: drawing beds, figures and the meadow.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- beds and figures ---

// The state with the unconfirmed changes on top: {state, pending}.
function viewState() {
  return withPending(app.state, app.pending);
}

// Furniture of a bed by `kind`, ported from `furn()` of the approved preview.
function drawFurniture(g, bed) {
  var x = bed.rect[0], y = bed.rect[1], w = bed.rect[2], h = bed.rect[3], i;
  switch (bed.kind) {
    case "bed2":
    case "bed1":
    case "cot":
      rect(g, x, y, w, h, COLORS.bedFrame);
      rect(g, x + 2, y + 2, w - 4, h - 4, bed.kind === "cot" ? COLORS.cotFrame : COLORS.sheet);
      rect(g, x + 3, y + 3, w - 6, 6, COLORS.sheetHead);
      if (bed.kind !== "cot") rect(g, x + 2, y + h - 10, w - 4, 8, COLORS.sheetFoot);
      break;
    case "mats":
      for (i = 0; i < bed.slots.length; i++) {
        rect(g, x + i * 46, y, 32, h, COLORS.mat);
        rect(g, x + i * 46 + 2, y + 2, 28, h - 4, COLORS.matTop);
      }
      break;
    case "bunk":
      rect(g, x, y, w, h, COLORS.bunkDark);
      rect(g, x + 2, y + 2, w - 4, 16, COLORS.bunkTop);
      rect(g, x + 2, y + 22, w - 4, 18, COLORS.bunkLow);
      rect(g, x, y + 19, w, 2, COLORS.bunkDark);
      break;
    case "sofa":
    case "sofa1":
      rect(g, x, y, w, h, COLORS.sofaDark);
      rect(g, x + 4, y + 4, w - 8, h - 8, COLORS.sofaLight);
      break;
    case "stove":
      rect(g, x, y, w, h, COLORS.stoveDark);
      rect(g, x + 2, y + 2, w - 4, h - 4, COLORS.stoveLight);
      var pipe = stovePipeRect(bed);
      rect(g, pipe[0], pipe[1], pipe[2], pipe[3], COLORS.stovePipe);
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

function drawBeds() {
  var g = app.layers.beds, layout = app.state.layout;
  var view = viewState();
  clearNode(g);
  layout.rooms.forEach(function (room) {
    room.beds.forEach(function (bed) { drawBed(g, layout, view, room, bed); });
  });
  drawMeadow(g, view);
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
    var sg = svgEl(g, "g", view.pending[night + "|" + slot] ? { "class": "pending" } : null);
    if (who) {
      var color = who.party ? who.party.color : COLORS.mat;
      if (who.party && who.party.id === app.myParty) {      // the yellow frame of my party
        rect(sg, pos[0] - 1, pos[1] - 1, 12, 14, "none", { stroke: COLORS.highlight, "stroke-width": 2 });
      }
      svgEl(sg, "title", null, who.party ? who.party.name : UNKNOWN_PARTY);
      drawFigure(sg, pos[0], pos[1], color, who.kind, who.party ? shirtChar(who.party.name) : null);
    } else {
      rect(sg, pos[0] + 1, pos[1] + 2, 8, 8, "none", {
        "class": "free", stroke: bed.tight.indexOf(slot) !== -1 ? COLORS.tight : COLORS.white, "stroke-width": 2
      });
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
  app.ageNode.textContent = updatedAgoText(app.fetchedAt, Date.now());
}
