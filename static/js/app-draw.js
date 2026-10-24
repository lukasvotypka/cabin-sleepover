"use strict";

// App part 5: drawing the scene (ground, houses, boards, signposts).
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

// A decorative autumn tree on the left edge. Its crown (x -20 to 14, y 184 to 222) sits below the upper house
// rooms (which end at y 176) and left of the „Zápis je zatvorený“ sign (x 16), a strip that no room, board or path
// in config/cabin.yaml reaches: pure decor, not derived from the layout, so it stays clear of every bed, board and
// tap target however cabin.yaml is edited. On a phone (map x 0 to 380) the left half of the crown is off the map;
// on a wider screen or a panned map it shows whole. Six leaves drift down from the crown in turn, and a few lie
// under it; `prefers-reduced-motion` stops the fall (the global rule near the end of the style sheet).
var TREE_CROWN = { cx: -3, cy: 203, rx: 17, ry: 19, cell: 2 };
var TREE_FALLEN = 12;
var TREE_FALLING = 6;
// A deterministic pseudo-random number in [0, 1), so the tree looks the same on every draw and every device.
function treeNoise(i, seed) {
  var v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}
function drawTree(g) {
  var t = svgEl(g, "g", { "aria-hidden": "true", "class": "tree" });
  var c = TREE_CROWN, leafColors = [COLORS.leafOchre, COLORS.leafRust, COLORS.leafRed], x, y, i;
  rect(t, -6, 218, 6, 34, COLORS.woodDark);         // trunk and two branches
  rect(t, -8, 248, 10, 4, COLORS.woodDark);
  rect(t, -10, 212, 4, 6, COLORS.woodDark);
  rect(t, 0, 210, 4, 8, COLORS.woodDark);
  // crown: a bumpy ellipse of 2 x 2 cells, ochre on top, rust in the middle, red below, with speckles
  for (y = c.cy - c.ry; y < c.cy + c.ry; y += c.cell) {
    for (x = c.cx - c.rx; x < c.cx + c.rx; x += c.cell) {
      var dx = (x + 1 - c.cx) / c.rx, dy = (y + 1 - c.cy) / c.ry;
      if (dx * dx + dy * dy > 1 + (treeNoise(x, y) - .5) * .22) continue;
      var f = (y - (c.cy - c.ry)) / (2 * c.ry), n = treeNoise(x * 3, y * 7);
      var color = f < .34 ? COLORS.leafOchre : f < .68 ? COLORS.leafRust : COLORS.leafRed;
      if (n < .16) color = f < .34 ? COLORS.leafRust : f < .68 ? (n < .08 ? COLORS.leafOchre : COLORS.leafRed) : COLORS.leafRust;
      else if (n > .93) color = COLORS.leafOchre;
      rect(t, x, y, c.cell, c.cell, color);
    }
  }
  for (x = c.cx - 12; x < c.cx + 12; x += c.cell) {  // darker underside
    if (treeNoise(x, 5) < .6) rect(t, x, c.cy + c.ry - 2, c.cell, 2, COLORS.redEdge);
  }
  for (i = 0; i < TREE_FALLEN; i++) {                // leaves on the grass under the tree
    rect(t, -24 + i * 2.8 + treeNoise(i, 2) * 3, 250 + treeNoise(i, 3) * 14, 3, 3, leafColors[i % 3]);
  }
  for (i = 0; i < TREE_FALLING; i++) {               // falling leaves: start in the crown, sway down 26 to 56 px
    var size = i % 4 === 0 ? 4 : 3;
    var vars = "--dx:" + ((treeNoise(i, 13) - .5) * 16).toFixed(1) + "px;--fall:" + (26 + treeNoise(i, 14) * 30).toFixed(0) +
      "px;--rot:" + ((treeNoise(i, 17) - .5) * 160).toFixed(0) + "deg;--dur:" + (11 + treeNoise(i, 15) * 8).toFixed(1) +
      "s;--delay:" + (-treeNoise(i, 16) * 19).toFixed(1) + "s";
    rect(t, c.cx - 14 + treeNoise(i, 11) * 28, c.cy - 6 + treeNoise(i, 12) * 20, size, size, leafColors[i % 3],
      { "class": "shedleaf", style: vars });
  }
}

// A decorative bird that crosses the map every 28 s (see `.bird` in the style sheet). It is drawn in the svg
// in map units, so it stays over the land when the map is panned or zoomed. It flies from just left of the map
// to just right of it along `BIRD.y`, over everything, in its own aria-hidden layer that ignores taps. Two frames
// of 7 x 3 cells flap the wings; `prefers-reduced-motion` hides it.
var BIRD = { y: 60, cell: 4, margin: 40 };
var BIRD_FRAMES = [
  [[1, 0, 1], [5, 0, 1], [2, 1, 3]],               // wings up: [x, y, width] in cells
  [[2, 1, 3], [1, 2, 1], [5, 2, 1]]                // wings down
];
function drawBird(g, layout) {
  var c = BIRD.cell, x0 = -BIRD.margin - 7 * c, fly = layout.map.viewbox[0] + 2 * BIRD.margin + 7 * c;
  var bird = svgEl(g, "g", { "aria-hidden": "true", "class": "bird", style: "--fly:" + fly + "px" });
  BIRD_FRAMES.forEach(function (frame, k) {
    var f = svgEl(bird, "g", { "class": k === 0 ? "bird-frame-a" : "bird-frame-b" });
    frame.forEach(function (r) { rect(f, x0 + r[0] * c, BIRD.y + r[1] * c, r[2] * c, c, COLORS.ink); });
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
  drawNotice(g, scene.notice);
  drawPartyTable(g, scene.parties, state);
  drawLetter(g, scene.letter);
  drawLegend(g, scene.legend);
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

// The „?“ icon that opens „Návod“. The hit area is the whole `map.scene.notice` rect (44×44).
function drawNotice(parent, r) {
  var g = svgEl(parent, "g");
  board(g, [r[0] + 4, r[1] + 4, r[2] - 8, r[3] - 8], COLORS.plank);
  addText(g, r[0] + r[2] / 2, r[1] + 30, "?", 22, COLORS.paper, { anchor: "middle", bold: true });
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
    addText(g, night.colX[i] + lay.colW / 2, night.headY + 7.5, info.label, 6, COLORS.ink,
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
