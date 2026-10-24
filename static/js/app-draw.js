"use strict";

// App part 5: drawing the scene (ground, houses, boards, signposts, status).
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

function drawGround(g, bounds) {
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

// A small decorative tree, fixed at x 0-8 (any y), a strip that no room, board or path in config/cabin.yaml
// ever reaches (the leftmost rooms start at x 10, the leftmost scene board at x 16): pure decor, not derived
// from the layout, so it stays clear of every bed, board and tap target however cabin.yaml is edited. It sheds
// one leaf every few seconds; `prefers-reduced-motion` stops the fall (the global rule near `.free` above).
var TREE_LEAVES = [
  { x: 2, y: 150, delay: "0s" },
  { x: 6, y: 146, delay: "5s" },
  { x: 1, y: 156, delay: "10s" },
  { x: 7, y: 152, delay: "16s" },
  { x: 3, y: 144, delay: "21s" }
];
function drawTree(g) {
  var t = svgEl(g, "g", { "aria-hidden": "true", "class": "tree" });
  rect(t, 2, 164, 4, 20, COLORS.woodDark);          // trunk
  rect(t, 1, 142, 6, 6, COLORS.leafOchre);          // canopy, three overlapping tiers
  rect(t, 0, 148, 8, 8, COLORS.leafRust);
  rect(t, 1, 156, 6, 6, COLORS.leafRed);
  TREE_LEAVES.forEach(function (l, i) {
    var color = i % 3 === 0 ? COLORS.leafOchre : i % 3 === 1 ? COLORS.leafRust : COLORS.leafRed;
    rect(t, l.x, l.y, 3, 3, color, { "class": "shedleaf", style: "animation-delay:" + l.delay + ";" });
  });
}

// Roofs and chimneys (T-029, organizer request 24. 10. 2026): purely cosmetic and derived from `layout.houses`
// and the room rects, so they follow the layout. `houseOutline` and `roofRows` are in the logic script. The roof
// is drawn over the top wall of its house (the rooms start right below it); everything is aria-hidden and ignores taps.
function drawRoof(g, outline, roof) {
  var rows = roofRows(outline), top = rows[rows.length - 1];
  rows.forEach(function (row) {
    var face = row.i % 2 === 0 ? roof.face : roof.dark, joint = row.i % 2 === 0 ? roof.dark : roof.face, jx;
    rect(g, row.x, row.y, row.w, ROOF_ROW_H, face);
    for (jx = row.x + 4 + (row.i % 2) * 4; jx < row.x + row.w - 2; jx += 8) rect(g, jx, row.y, 1, ROOF_ROW_H, joint);
    rect(g, row.x, row.y, 2, ROOF_ROW_H, roof.dark);                          // darker side edges
    rect(g, row.x + row.w - 2, row.y, 2, ROOF_ROW_H, roof.dark);
  });
  rect(g, top.x, top.y, top.w, ROOF_ROW_H, roof.ridge);                       // ridge cap
}

// Brick chimney with a lighter cap, and three grey puffs that rise, drift and fade (see `.smokepuff`). `n` is
// the number of the chimney: it shifts the delays so that the chimneys do not puff in sync.
var SMOKE_PUFFS = [
  { dx: 3, size: 3, light: true, delay: 0 },
  { dx: 5, size: 2, light: false, delay: 2.9 },
  { dx: 2, size: 3, light: false, delay: 5.8 }
];
function drawChimney(g, outline, chimneyX, n) {
  var c = chimneyRect(outline, chimneyX);
  rect(g, c[0], c[1] + 2, c[2], c[3] - 2, COLORS.brick);
  rect(g, c[0], c[1] + 6, c[2], 1, COLORS.brickMortar);
  rect(g, c[0] - 1, c[1], c[2] + 2, 2, COLORS.brickLight);
  SMOKE_PUFFS.forEach(function (p) {
    var delay = (p.delay + n * 2.3).toFixed(1);
    rect(g, c[0] + 2, c[1] - p.size - 1, p.size, p.size, p.light ? COLORS.smokeLight : COLORS.smokeDark,
      { "class": "smokepuff", style: "--dx:" + p.dx + "px;animation-delay:" + delay + "s;" });
  });
}

function drawHouses(g, layout) {
  var group = svgEl(g, "g", { "aria-hidden": "true", "class": "roofs" });
  (layout.houses || []).forEach(function (house, n) {
    var outline = houseOutline(house, layout.rooms);
    if (!outline) return;
    drawRoof(group, outline, house.roof);
    drawChimney(group, outline, house.chimney, n);
  });
}

function drawBase(g, layout) {
  var W = layout.map.viewbox[0], H = layout.map.viewbox[1], i;
  rect(g, 0, 0, W, H, COLORS.grass);
  for (i = 0; i < 70; i++) rect(g, (i * 53) % (W - 8), (i * 97) % (H - 8), 4, 4, i % 4 === 1 ? COLORS.leafRust : i % 4 === 3 ? COLORS.leafOchre : COLORS.tuft);
  layout.map.paths.forEach(function (p) { rect(g, p[0], p[1], p[2], p[3], COLORS.path); });
  layout.rooms.forEach(function (room) {
    var r = room.rect;
    rect(g, r[0], r[1], r[2], r[3], COLORS.roomEdge);
    rect(g, r[0] + 4, r[1] + 4, r[2] - 8, r[3] - 8, room.floor);
    addText(g, r[0] + 7, r[1] + 16, room.name, 11, COLORS.roomLabel, { maxWidth: r[2] - 14 });
  });
  layout.map.doors.forEach(function (d) {
    rect(g, d[0], d[1], d[2], d[3], doorFloorColor(layout, d) || COLORS.path);
  });
  layout.map.windows.forEach(function (w) { rect(g, w[0], w[1], w[2], w[3], COLORS.window); });
  drawHouses(g, layout);
  drawTree(g);
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
  keepFocus($("scene"), function () {
    drawBoards();
    drawBeds();
  });
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
  if (!lines.length) lines = ["Zatiaľ tu nikto nie je."];
  lines.forEach(function (line) { parties.appendChild(htmlEl("li", null, line)); });
  host.appendChild(parties);
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
  app.ageNode = null;
  drawTitle(g, scene.title, state);
  drawNights(g, scene, state);
  drawNotice(g, scene.notice);
  if (app.noticeCollapsed) drawPartyTable(g, scene.parties, state);
  drawStatus(g, scene.status, state);
  drawLetter(g, scene.letter);
  drawLegend(g, scene.legend);
  renderAge();
}

// The letter icon opens „Prehľad na poslanie“. The hit area is the whole `map.scene.letter` rect.
function drawLetter(parent, r) {
  var g = svgEl(parent, "g");
  var x = r[0] + (r[2] - 32) / 2, y = r[1] + (r[3] - 24) / 2;
  rect(g, x, y, 32, 24, COLORS.woodDark);
  rect(g, x + 3, y + 3, 26, 18, COLORS.paper);
  [[0, 0], [4, 3], [8, 6], [12, 9]].forEach(function (p) {      // the flap, from the left corner to the middle
    rect(g, x + 3 + p[0], y + 3 + p[1], 4, 3, COLORS.woodDark);
    rect(g, x + 25 - p[0], y + 3 + p[1], 4, 3, COLORS.woodDark);
  });
  rect(g, x + 13, y + 14, 6, 6, COLORS.red);                  // the seal
  hitRect(g, r);
  makeButton(g, "Prehľad na poslanie. Ťuknutím otvoríš text, ktorý môžeš poslať do WhatsAppu.", "letter", openSummary);
}

// The „Kto je kto“ sign: a small board with three colour squares, each next to a paper line. The squares are
// decoration (the first three palette colours), not party data. The hit area is the whole `map.scene.legend` rect.
function drawLegend(parent, r) {
  var g = svgEl(parent, "g");
  board(g, r, COLORS.plank);
  var x = r[0] + 7, y = r[1] + 8;
  ["#2F7D6D", "#D07A2B", "#6D5BA8"].forEach(function (color, i) {
    var ry = y + i * 10;
    rect(g, x, ry, 6, 6, color);
    rect(g, x + 10, ry + 1, 16 + (i === 1 ? -4 : i === 2 ? -8 : 0), 4, COLORS.paper);
  });
  hitRect(g, r);
  makeButton(g, "Kto je kto. Ťuknutím uvidíš všetkých a ich farby.", "legend", function () { openLegend("legend"); });
}

function drawTitle(parent, r, state) {
  var g = svgEl(parent, "g", { role: "img", "aria-label": titleLabel(state.event) });
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
      "night-" + night, function () { selectNight(night); });
    g.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function drawNotice(parent, r) {
  var g = svgEl(parent, "g");
  if (app.noticeCollapsed) {
    var box = noticeIconRect(r);
    board(g, [box[0] + 4, box[1] + 4, 36, 36], COLORS.plank);
    addText(g, box[0] + 22, box[1] + 30, "?", 22, COLORS.paper, { anchor: "middle", bold: true });
    hitRect(g, box);
    makeButton(g, "Návod. Ťuknutím ho rozbalíš.", "notice", expandNotice);
    return;
  }
  board(g, r, COLORS.paper, COLORS.woodDark);
  rect(g, r[0] + 6, r[1] + 6, 3, 3, COLORS.red);
  rect(g, r[0] + r[2] - 9, r[1] + 6, 3, 3, COLORS.red);
  var lay = noticeLayout(r, NOTICE_LINES.length);
  addText(g, lay.x, lay.heading, "Návod", 9, COLORS.ink, { bold: true });
  NOTICE_LINES.forEach(function (line, i) {
    addText(g, lay.x, lay.lines[i], line, 7.5, COLORS.ink, { maxWidth: lay.maxWidth });
  });
  hitRect(g, r);
  makeButton(g, "Návod: " + NOTICE_LINES.join(" ") + " Ťuknutím ho zbalíš.", "notice", collapseNotice);
}

// The table of all parties under the signposts, drawn while the noticeboard is collapsed: a row per party
// (colour square and name), a column per night with placed/needed places. The whole table is one button
// that opens „Kto je kto“. The numbers are the same nightTally as on the signpost chips.
function drawPartyTable(parent, r, state) {
  var rows = partyTableRows(state, app.myParty), nights = state.event.nights;
  var lay = partyTableLayout(r, rows.length, nights.length);
  var g = svgEl(parent, "g");
  board(g, r, COLORS.paper, COLORS.woodDark);
  var top = r[1] + lay.pad, innerX = r[0] + lay.pad, innerW = r[2] - 2 * lay.pad;

  // header row: "Kto" and the night labels; the selected night gets the yellow header
  nights.forEach(function (night, i) {
    var info = nightInfo(night) || { label: night };
    if (night === app.night) rect(g, lay.colX[i], top, lay.colW, lay.head, COLORS.selected);
    addText(g, lay.colX[i] + lay.colW / 2, top + 7, info.label, 6, COLORS.ink,
      { anchor: "middle", bold: true, maxWidth: lay.colW - 2 });
  });
  addText(g, lay.nameX + 1, top + 7, "Kto", 6, COLORS.ink, { bold: true, maxWidth: lay.nameW - 2 });
  rect(g, innerX, top + lay.head - 1, innerW, 1, COLORS.woodDark);

  var y0 = top + lay.head;
  if (!rows.length) {
    addText(g, lay.nameX + 1, y0 + lay.rowH / 2 + lay.size * 0.35, "Zatiaľ tu nikto nie je.", lay.size, COLORS.ink,
      { maxWidth: innerW - 2 });
  }
  rows.slice(0, lay.rows).forEach(function (row, i) {
    var y = y0 + i * lay.rowH, base = y + lay.rowH / 2 + lay.size * 0.35;
    if (row.mine) rect(g, innerX, y, innerW, lay.rowH, COLORS.selected);
    rect(g, lay.nameX + 1, y + (lay.rowH - 5) / 2, 5, 5, row.color);
    addText(g, lay.nameX + 8, base, row.label, lay.size, COLORS.ink, { bold: row.mine, maxWidth: lay.nameW - 8 });
    row.cells.forEach(function (cell, j) {
      var cx = lay.colX[j] + lay.colW / 2, tone = TALLY_COLORS[cell.kind];
      if (cell.kind === "under" || cell.kind === "over") {
        var cw = lay.colW - 4, ch = lay.rowH - 1;
        rect(g, cx - cw / 2, y + 0.5, cw, ch, COLORS[tone[0]]);
        rect(g, cx - cw / 2 + 1, y + 1.5, cw - 2, ch - 2, COLORS[tone[1]]);
        addText(g, cx, base, cell.text, lay.size, COLORS[tone[2]], { anchor: "middle", bold: true, maxWidth: cw - 4 });
      } else {
        addText(g, cx, base, cell.text, lay.size, COLORS.ink, { anchor: "middle", maxWidth: lay.colW - 4 });
      }
    });
  });
  if (lay.more) {
    var my = y0 + lay.rows * lay.rowH;
    addText(g, lay.nameX + 1, my + lay.rowH / 2 + lay.size * 0.35, moreText(lay.more), lay.size, COLORS.roomLabel,
      { maxWidth: lay.nameW });
  }
  hitRect(g, r);
  makeButton(g, "Kto kde spí po nociach. Ťuknutím otvoríš „Kto je kto“.", "parties", function () { openLegend("parties"); });
}

function drawStatus(parent, r, state) {
  var half = r[3] / 2;
  var party = partyById(state, app.myParty);
  var status = myPartyStatus(state, party);

  // top row: who am I and how fresh is the data
  var top = [r[0], r[1], r[2], half];
  var g = svgEl(parent, "g");
  board(g, [top[0], top[1] + 2, top[2], top[3] - 4], COLORS.plank);
  addText(g, top[0] + 8, top[1] + 18, whoText(party), 8, COLORS.paper, { bold: true, maxWidth: r[2] - 16 });
  app.ageNode = addText(g, top[0] + 8, top[1] + 32, "", 6, COLORS.paper, { maxWidth: r[2] - 16 });
  app.ageMax = r[2] - 16;
  hitRect(g, top);
  makeButton(g, (party ? "Si: " + party.name + ". " : "Zatiaľ nevieme, kto si. ") + "Ťuknutím vyberieš, kto si.", "who", openWho);

  // bottom row: the status of my party
  var bot = [r[0], r[1] + half, r[2], half];
  var b = svgEl(parent, "g");
  var inner = [bot[0], bot[1] + 2, bot[2], bot[3] - 4];
  if (status.kind === "missing") {
    board(b, inner, COLORS.red, COLORS.redEdge);
    rect(b, inner[0] + 8, inner[1] + 8, 20, 20, COLORS.white);       // exclamation mark sign
    rect(b, inner[0] + 17, inner[1] + 11, 2, 9, COLORS.red);
    rect(b, inner[0] + 17, inner[1] + 22, 2, 3, COLORS.red);
    drawLines(b, wrapText(status.text, 14, 3), inner[0] + 34, inner[1] + 14, 6.5, COLORS.white, inner[2] - 40);
    hitRect(b, bot);
    makeButton(b, status.text + ". Ťuknutím zvolíš túto noc.", "status", function () { selectNight(status.night); });
  } else if (status.kind === "extra") {
    board(b, inner, COLORS.amber, COLORS.amberEdge);
    drawLines(b, wrapText(status.text, 19, 3), inner[0] + 8, inner[1] + 14, 6.5, COLORS.ink, inner[2] - 16);
    hitRect(b, bot);
    makeButton(b, status.text + ". Ťuknutím zvolíš túto noc.", "status", function () { selectNight(status.night); });
  } else if (status.kind === "ok") {
    board(b, inner, COLORS.green, COLORS.greenEdge);
    [[0, 6], [3, 9], [6, 12], [9, 9], [12, 6], [15, 3], [18, 0]].forEach(function (p) {   // pixel check mark
      rect(b, inner[0] + 10 + p[0], inner[1] + 12 + p[1], 3, 3, COLORS.white);
    });
    addText(b, inner[0] + 38, inner[1] + 23, status.text, 7, COLORS.white, { bold: true, maxWidth: inner[2] - 44 });
    b.setAttribute("role", "img");
    b.setAttribute("aria-label", status.text);
  } else {
    board(b, inner, COLORS.plank);
    drawLines(b, wrapText("Najprv vyber, kto si", 19, 2), inner[0] + 8, inner[1] + 17, 7, COLORS.paper, inner[2] - 16);
    hitRect(b, bot);
    makeButton(b, "Najprv vyber, kto si. Ťuknutím to vyberieš.", "status", openWho);
  }
}

function drawLines(parent, lines, x, y, size, fill, maxWidth) {
  lines.forEach(function (line, i) {
    addText(parent, x, y + i * (size + 2.5), line, size, fill, { maxWidth: maxWidth });
  });
}
