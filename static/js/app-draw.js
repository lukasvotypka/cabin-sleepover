"use strict";

// App part 5: drawing the scene (ground, houses, boards, signposts).
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
var BIRD = { cell: 4, margin: 40 };      // flies across the whole scene width, in the grass strip between the board block and the world
var BIRD_FRAMES = [
  [[1, 0, 1], [5, 0, 1], [2, 1, 3]],               // wings up: [x, y, width] in cells
  [[2, 1, 3], [1, 2, 1], [5, 2, 1]]                // wings down
];
function birdY(iso) {
  return Math.round(iso.block.y + iso.block.src[3] * iso.block.k + (ISO.gap - 3 * BIRD.cell) / 2);
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
  renderHud();
  renderSummary();
  renderMoveBar();
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

function renderBoards() {
  keepFocus($("scene"), drawBoards);
}

function renderBeds() {
  keepFocus($("scene"), drawBeds);
}

function drawBoards() {
  var state = app.state, scene = state.layout.map.scene;
  var g = app.layers.boards;
  clearNode(g);
  drawTitle(g, scene.title, state);
  drawNights(g, scene, state);
  var icons = app.iso.icons;      // the icon grid left of the boards (isoScene), not the flat plan
  drawNotice(g, icons.notice);
  drawPartyTable(g, scene.parties, state);
  drawLetter(g, icons.letter);
  drawLegend(g, icons.legend);
  if (isAdmin(app.role)) drawKey(g, icons.key);
  if (state.signup_open === false && scene.locked) drawLocked(g, icons.locked);
  if (state.info && scene.briefing) drawBriefing(g, icons.briefing, state);
}

// A flat pixel shadow under a board or icon (the same shape, +2/+2 block units): the block stands above the grass.
function blockShadow(parent, r) {
  rect(parent, r[0] + 2, r[1] + 2, r[2], r[3], "#2E1F14", { opacity: ".25", "aria-hidden": "true" });
}

// The „Zápis je zatvorený“ sign, shown to everyone while signup is locked. Position: the locked cell of the icon grid (isoScene).
function drawLocked(parent, r) {
  var g = svgEl(parent, "g", { role: "img", "aria-label": LOCKED_TEXTS.sign });
  blockShadow(g, [r[0], r[1], r[2], r[3] - 8]);
  rect(g, r[0] + r[2] / 2 - 2, r[1] + r[3] - 10, 4, 10, COLORS.woodDark);       // the post
  board(g, [r[0], r[1], r[2], r[3] - 8], COLORS.plank);
  addText(g, r[0] + r[2] / 2, r[1] + 20, "Zápis", 11, COLORS.paper, { anchor: "middle", bold: true });
  addText(g, r[0] + r[2] / 2, r[1] + 34, "je zatvo-", 9, COLORS.paper, { anchor: "middle" });
  addText(g, r[0] + r[2] / 2, r[1] + 44, "rený", 9, COLORS.paper, { anchor: "middle" });
}

// The letter icon opens „Prehľad na poslanie“. The hit area is the whole letter cell of the icon grid (isoScene).
function drawLetter(parent, r) {
  var g = svgEl(parent, "g");
  var x = r[0] + (r[2] - 32) / 2, y = r[1] + (r[3] - 24) / 2;
  blockShadow(g, [x, y, 32, 24]);
  rect(g, x, y, 32, 24, COLORS.woodDark);
  rect(g, x + 3, y + 3, 26, 18, COLORS.paper);
  [[0, 0], [4, 3], [8, 6], [12, 9]].forEach(function (p) {      // the flap, from the left corner to the middle
    rect(g, x + 3 + p[0], y + 3 + p[1], 4, 3, COLORS.woodDark);
    rect(g, x + 25 - p[0], y + 3 + p[1], 4, 3, COLORS.woodDark);
  });
  rect(g, x + 13, y + 14, 6, 6, COLORS.red);                  // the seal
  iconCaption(g, r[0] + r[2] / 2, y + 27, "Prehľad");
  hitRect(g, r);
  makeButton(g, "Prehľad na poslanie. Ťuknutím otvoríš text, ktorý môžeš poslať do WhatsAppu.", "letter", openSummary);
}

// The „Kto je kto“ sign: a small board with three colour squares, each next to a paper line. The squares are
// decoration (the first three palette colours), not party data. The hit area is the whole legend cell of the icon grid (isoScene).
function drawLegend(parent, r) {
  var g = svgEl(parent, "g");
  blockShadow(g, r);
  board(g, r, COLORS.plank);
  var x = r[0] + 7, y = r[1] + 8;
  ["#2F7D6D", "#D07A2B", "#6D5BA8"].forEach(function (color, i) {
    var ry = y + i * 10;
    rect(g, x, ry, 6, 6, color);
    rect(g, x + 10, ry + 1, 16 + (i === 1 ? -4 : i === 2 ? -8 : 0), 4, COLORS.paper);
  });
  iconCaption(g, r[0] + r[2] / 2, r[1] + r[3] + 1, "Kto je kto");
  hitRect(g, r);
  makeButton(g, "Kto je kto. Ťuknutím uvidíš všetkých a ich farby.", "legend", function () { openLegend("legend"); });
}

function drawTitle(parent, r, state) {
  var g = svgEl(parent, "g", { role: "img", "aria-label": titleLabel(state.event) });
  blockShadow(g, r);
  board(g, r, COLORS.plank);
  // 12 px bold: the baseline sits about 4 units below the middle of the board
  addText(g, r[0] + r[2] / 2, r[1] + r[3] / 2 + 4, state.event.name, 12, COLORS.paper, { anchor: "middle", bold: true, maxWidth: r[2] - 16 });
  rect(g, r[0] + 6, r[1] + 6, 3, 3, COLORS.woodLight);
  rect(g, r[0] + r[2] - 9, r[1] + 6, 3, 3, COLORS.woodLight);
}

function drawNights(parent, scene, state) {
  var nights = state.event.nights, gap = 4, lay = signpostLayout(scene.nights, nights.length, gap);
  var total = totalSlots(state.layout);
  var hit = nightsHit(state.layout, NIGHTS_HIT_GROW);
  var party = partyById(state, app.myParty);
  nights.forEach(function (night, i) {
    var info = nightInfo(night) || { label: night, dates: "" };
    var used = usedCount(state, night);
    var selected = night === app.night;
    var b = lay.boards[i], x = b[0], w = b[2];
    var g = svgEl(parent, "g");
    blockShadow(g, b);
    rect(g, x + w / 2 - 3, b[1] + b[3] - 2, 6, 8, COLORS.woodDark);   // post
    board(g, b, selected ? COLORS.selected : COLORS.wood, selected ? COLORS.highlight : COLORS.woodDark);
    var cx = x + w / 2, inner = w - 8;
    addText(g, cx, lay.label, info.label, 9, COLORS.ink, { anchor: "middle", bold: true, maxWidth: inner });
    addText(g, cx, lay.date, info.dates, 6.5, COLORS.ink, { anchor: "middle", maxWidth: inner });
    var tally = party ? nightTally(state, party, night) : null;
    if (tally && tally.kind === "absent") {
      addText(g, cx, lay.absent, tallyChipText(tally), 6.5, COLORS.ink, { anchor: "middle", maxWidth: inner });
    } else if (tally) {
      var tone = TALLY_COLORS[tally.kind];
      rect(g, x + 5, lay.chip[0], w - 10, lay.chip[1], COLORS[tone[0]]);
      rect(g, x + 6, lay.chip[0] + 1, w - 12, lay.chip[1] - 2, COLORS[tone[1]]);
      addText(g, cx, lay.chipText, tallyChipText(tally), 7, COLORS[tone[2]], { anchor: "middle", bold: true, maxWidth: w - 14 });
    }
    addText(g, cx, lay.used, "obsadené", 6.5, COLORS.ink, { anchor: "middle", maxWidth: inner });
    addText(g, cx, lay.total, used + " z " + total, 8, COLORS.ink, { anchor: "middle", bold: true, maxWidth: inner });
    hitRect(g, [x - gap / 2, hit[1], w + gap, hit[3]]);
    makeButton(g, "Noc " + info.label + ", " + info.dates + ", obsadené " + used + " z " + total +
      " miest" + (selected ? ", zvolená noc" : "") + (tally ? ". " + tallyLabel(tally) : ""),
      "night-" + night, function () { selectNight(night, { animate: true }); });
    g.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

// A small name plate under an icon on the grass, centred at x, its top at y (8 units high). Decoration: the
// button label of the icon says the same.
function iconCaption(parent, x, y, text) {
  var w = text.length * 3.6 + 6;
  rect(parent, x - w / 2, y, w, 8, COLORS.woodDark, { "aria-hidden": "true" });
  addText(parent, x, y + 6, text, 6, COLORS.paper, { anchor: "middle", bold: true }).setAttribute("aria-hidden", "true");
}

// The „?“ icon that opens „Návod“. The hit area is the whole notice cell of the icon grid (isoScene), 44×44.
function drawNotice(parent, r) {
  var g = svgEl(parent, "g");
  blockShadow(g, [r[0] + 4, r[1] + 4, r[2] - 8, r[3] - 8]);
  board(g, [r[0] + 4, r[1] + 4, r[2] - 8, r[3] - 8], COLORS.plank);
  addText(g, r[0] + r[2] / 2, r[1] + 30, "?", 22, COLORS.paper, { anchor: "middle", bold: true });
  iconCaption(g, r[0] + r[2] / 2, r[1] + r[3] - 3, "Návod");
  hitRect(g, r);
  makeButton(g, "Návod. Ťuknutím ho otvoríš.", "notice", openNotice);
}

// A pixel crescent moon (6x8 units) and a pixel sun (8x8 units) from rects, top left at (x, y).
function drawMoon(g, x, y) {
  rect(g, x + 2, y, 4, 1, COLORS.moonDark);
  rect(g, x + 1, y + 1, 3, 1, COLORS.moon);
  rect(g, x, y + 2, 3, 4, COLORS.moon);
  rect(g, x + 1, y + 6, 3, 1, COLORS.moon);
  rect(g, x + 2, y + 7, 4, 1, COLORS.moonDark);
  rect(g, x + 4, y + 1, 2, 1, COLORS.moonDark);
}

function drawSun(g, x, y) {
  rect(g, x + 3, y, 1, 8, COLORS.amberEdge);
  rect(g, x, y + 3, 8, 1, COLORS.amberEdge);
  rect(g, x + 2, y + 2, 4, 4, COLORS.highlight);
  [[1, 1], [6, 1], [1, 6], [6, 6]].forEach(function (p) { rect(g, x + p[0], y + p[1], 1, 1, COLORS.amberEdge); });
}

// The paper table under the signposts, as tall as its rows. Top part „Noc“: a row per overnight party (colour
// square and name), a column per night with placed/needed places. Bottom part „Cez deň“: a row per day-only
// party and a column per event day with the number of people, then „spolu na jedlo“. The whole table is one button
// that opens „Kto je kto“. The night numbers are the same nightTally as on the signpost chips.
function drawPartyTable(parent, r, state) {
  var rows = partyTableRows(state, app.myParty), dayRows = dayTableRows(state, app.myParty);
  var nights = state.event.nights, days = eventDays(state.event);
  var lay = partyTableLayout(r, rows.length, dayRows.length, nights.length, days.length);
  var g = svgEl(parent, "g");
  dnFitPartyShade(lay.height);
  blockShadow(g, [r[0], r[1], r[2], lay.height]);
  board(g, [r[0], r[1], r[2], lay.height], COLORS.paper, COLORS.woodDark);
  var innerX = r[0] + lay.pad, innerW = r[2] - 2 * lay.pad, size = lay.size, hh = lay.head;
  var night = lay.night, day = lay.day;
  function base(y) { return y + lay.rowH / 2 + size * 0.35; }
  function nameCell(y, row, w) {
    if (row.mine) rect(g, innerX, y, innerW, lay.rowH, COLORS.selected);
    rect(g, lay.nameX + 2, y + (lay.rowH - 5) / 2, 5, 5, row.color);
    addText(g, lay.nameX + 10, base(y), row.label, size, COLORS.ink, { bold: row.mine, maxWidth: w - 10 });
  }
  function moreLine(y, count) {
    addText(g, lay.nameX + 3, base(y), moreText(count), size, COLORS.roomLabel, { maxWidth: innerW - 6 });
  }

  // night part: moon, „Noc“, a header per night (the selected night is yellow)
  rect(g, innerX, night.headY, innerW, hh, COLORS.moonBand);
  drawMoon(g, innerX + 2, night.headY + 1);
  addText(g, innerX + 13, night.headY + 7.5, "Noc", 6.5, COLORS.nightInk, { bold: true });
  nights.forEach(function (n, i) {
    var info = nightInfo(n) || { label: n };
    if (n === app.night) rect(g, night.colX[i], night.headY, lay.colW, hh, COLORS.selected);
    addText(g, night.colX[i] + lay.colW / 2, night.headY + 7.5, dayShort(n), 6, COLORS.ink,
      { anchor: "middle", bold: true, maxWidth: lay.colW - 2 });
  });
  rows.slice(0, night.rows).forEach(function (row, i) {
    var y = night.y0 + i * lay.rowH;
    nameCell(y, row, night.nameW);
    row.cells.forEach(function (cell, j) {
      var cx = night.colX[j] + lay.colW / 2, tone = TALLY_COLORS[cell.kind];
      if (cell.kind === "under" || cell.kind === "over") {
        var cw = lay.colW - 4, ch = lay.rowH - 1;
        rect(g, cx - cw / 2, y + 0.5, cw, ch, COLORS[tone[0]]);
        rect(g, cx - cw / 2 + 1, y + 1.5, cw - 2, ch - 2, COLORS[tone[1]]);
        addText(g, cx, base(y), cell.text, size, COLORS[tone[2]], { anchor: "middle", bold: true, maxWidth: cw - 4 });
      } else {
        addText(g, cx, base(y), cell.text, size, COLORS.ink, { anchor: "middle", maxWidth: lay.colW - 4 });
      }
    });
  });
  if (night.more) moreLine(night.y0 + night.rows * lay.rowH, night.more);

  // divider, then the day part: sun, „Cez deň“, a header per event day
  rect(g, innerX, lay.dividerY, innerW, 1, COLORS.woodDark);
  rect(g, innerX, day.headY, innerW, hh, COLORS.dayBand);
  drawSun(g, innerX + 2, day.headY + 1);
  addText(g, innerX + 13, day.headY + 7.5, "Cez deň", 6.5, COLORS.dayInk, { bold: true });
  days.forEach(function (d, i) {
    addText(g, day.colX[i] + lay.colW / 2, day.headY + 7.5, dayColumnLabel(d), 6, COLORS.ink,
      { anchor: "middle", bold: true, maxWidth: lay.colW - 2 });
  });
  dayRows.slice(0, day.rows).forEach(function (row, i) {
    var y = day.y0 + i * lay.rowH;
    nameCell(y, row, day.nameW);
    row.cells.forEach(function (cell, j) {
      if (!cell.text) return;
      var cx = day.colX[j] + lay.colW / 2;
      rect(g, cx - 6, y + 1, 12, lay.rowH - 2, COLORS.dayBand);
      addText(g, cx, base(y), cell.text, size, COLORS.dayInk, { anchor: "middle", bold: true, maxWidth: 10 });
    });
  });
  if (day.more) moreLine(day.y0 + day.rows * lay.rowH, day.more);

  // food row
  rect(g, innerX, lay.ruleY, innerW, 1, COLORS.woodDark);
  addText(g, lay.nameX + 3, base(lay.foodY), "spolu na jedlo", size, COLORS.ink, { bold: true, maxWidth: day.nameW - 3 });
  foodRow(state).forEach(function (n, i) {
    addText(g, day.colX[i] + lay.colW / 2, base(lay.foodY), String(n), size, COLORS.ink,
      { anchor: "middle", bold: true, maxWidth: lay.colW - 4 });
  });

  hitRect(g, [r[0], r[1], r[2], lay.height]);
  makeButton(g, "Kto kde spí po nociach, kto príde cez deň a koľko vás je na jedlo. Ťuknutím otvoríš „Kto je kto“.",
    "parties", function () { openLegend("parties"); });
}
