"use strict";

// App part: the „Kto kedy príde“ notice board and the title gate in the village (T-146), and the board's panel.
// Both are upright signs that face the camera: drawn flat in the svg at the projected points of the plan (isoSignBox in
// logic-iso.js), in their own coordinates scaled to the sign's box. Their text comes from the pure logic-board.js.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var BOARD_W = 252, BOARD_H = 120;      // the board's frame in its own units; the roof reaches 14 above it, the posts 26 below

function drawBoards() {
  var state = app.state, g = app.layers.boards;
  clearNode(g);
  isoAnchorsReset("boards");
  drawGate(g, isoSignBox(app.iso, state.layout, "gate"), state);
  drawNoticeBoard(g, isoSignBox(app.iso, state.layout, "board"), state);
}

function renderBoards() {
  keepFocus($("scene"), drawBoards);
}

// A perforated paper stamp: the sheet and punched holes along the edge.
function stampPaper(g, x, y, w, h, edge) {
  rect(g, x, y, w, h, COLORS.paper);
  var i, j;
  for (i = x + 4; i < x + w - 1; i += 6) {
    rect(g, i - 1, y - 1, 3, 3, edge);
    rect(g, i - 1, y + h - 2, 3, 3, edge);
  }
  for (j = y + 4; j < y + h - 1; j += 6) {
    rect(g, x - 1, j - 1, 3, 3, edge);
    rect(g, x + w - 2, j - 1, 3, 3, edge);
  }
}

function polygon(g, pts, fill) {
  return svgEl(g, "polygon", { points: pts.map(function (p) { return p.join(","); }).join(" "), fill: fill });
}

// The title gate: two posts and a sign with the event name. Taps pass through it to what stands behind.
function drawGate(parent, box, state) {
  var k = Math.min(box[2] / 192, box[3] / 70);
  var g = svgEl(parent, "g", { role: "img", "aria-label": titleLabel(state.event), "pointer-events": "none",
    transform: "translate(" + round3(box[0] + box[2] / 2) + " " + round3(box[1] + box[3]) + ") scale(" + round3(k) + ")" });
  var at = state.layout.map.scene.gate;
  isoAnchor("boards", g, at[0], at[1], 0, false);
  svgEl(g, "ellipse", { cx: 0, cy: 1, rx: 92, ry: 4, fill: "#2E1F14", opacity: ".3" });
  rect(g, -84, -46, 6, 46, COLORS.bedWoodDark);
  rect(g, 78, -46, 6, 46, COLORS.bedWoodDark);
  rect(g, -96, -70, 192, 24, COLORS.plank, { stroke: COLORS.bedWoodDark, "stroke-width": 2 });
  rect(g, -90, -64, 3, 3, COLORS.woodLight);
  rect(g, 87, -64, 3, 3, COLORS.woodLight);
  addText(g, 0, -54, state.event.name, 10, COLORS.paper, { anchor: "middle", bold: true, maxWidth: 170 });
}

// The notice board: a wooden frame with a small roof and two posts, a header plate and two pinned stamps.
function drawNoticeBoard(parent, box, state) {
  var k = Math.min(box[2] / 272, box[3] / (BOARD_H + 40));
  var outer = svgEl(parent, "g", {
    transform: "translate(" + round3(box[0] + box[2] / 2 - BOARD_W / 2 * k) + " " + round3(box[1] + box[3] - (BOARD_H + 26) * k) + ") scale(" + round3(k) + ")"
  });
  var at = state.layout.map.scene.board;
  isoAnchor("boards", outer, at[0], at[1], 0, false);
  var g = svgEl(outer, "g", { "class": "board-sign" });
  var W = BOARD_W, H = BOARD_H;
  svgEl(g, "ellipse", { cx: W / 2, cy: H + 26, rx: W / 2 + 6, ry: 8, fill: "#2E1F14", opacity: ".3" });
  rect(g, 22, H - 4, 8, 30, COLORS.bedWoodDark);
  rect(g, W - 30, H - 4, 8, 30, COLORS.bedWoodDark);
  rect(g, 0, 0, W, H, COLORS.plank, { stroke: COLORS.bedWoodDark, "stroke-width": 3 });
  polygon(g, [[-10, 2], [W + 10, 2], [W - 8, -14], [8, -14]], COLORS.leafRed);
  rect(g, -10, 2, W + 20, 3, COLORS.brickMortar);
  rect(g, W / 2 - 62, 6, 124, 15, COLORS.woodLight, { stroke: COLORS.woodDark });
  addText(g, W / 2, 17, "KTO KEDY PRÍDE", 10, COLORS.ink, { anchor: "middle", bold: true, maxWidth: 116 });

  var sx = 8, sy = 27, sw = 150, sh = 84;
  drawNightStamp(g, sx, sy, sw, sh, boardNightStamp(state, app.myParty, app.night), state);
  var dx = sx + sw + 8, dw = W - sw - 24;
  drawDayStamp(g, dx, sy, dw, sh, boardDayStamp(state, app.myParty));

  // the pinned „ťukni“ tag with a blinking pin
  var tx = dx + dw / 2, ty = sy + sh - 2;
  rect(g, tx - 26, ty, 52, 20, COLORS.highlight, { stroke: COLORS.amberEdge, "stroke-width": 1.5 });
  addText(g, tx, ty + 14, "ťukni", 9, COLORS.ink, { anchor: "middle", bold: true });
  rect(g, tx - 2, ty - 3, 4, 4, COLORS.red, { "class": "pin-blink" });

  var hit = rect(outer, -10, -14, W + 20, H + 40, "transparent", { "class": "hit" });
  makeButton(outer, boardLabel(state), "board", function () {
    wiggleBoard(g);
    openBoardPanel("board");
  });
  return hit;
}

function drawNightStamp(g, sx, sy, sw, sh, stamp, state) {
  stampPaper(g, sx, sy, sw, sh, COLORS.plank);
  addText(g, sx + 5, sy + 10, "NOC", 8, COLORS.red, { bold: true });
  var n = stamp.nights.length, col = function (i) { return sx + sw - 13 - (n - 1 - i) * 14; };
  stamp.nights.forEach(function (c, i) {
    if (c.current) rect(g, col(i) - 7, sy + 1, 14, sh - 2, COLORS.selected, { opacity: ".7" });
  });
  addText(g, col(0) - 25, sy + 10, "kedy", 6.5, COLORS.ink, { anchor: "middle", bold: true });
  stamp.nights.forEach(function (c, i) {
    addText(g, col(i), sy + 10, c.label, 6.5, COLORS.ink, { anchor: "middle", bold: true });
  });
  if (!stamp.rows.length) addText(g, sx + 6, sy + 26, partyTableEmptyText(state), 6.5, COLORS.roomLabel, { maxWidth: sw - 12 });
  stamp.rows.forEach(function (row, r) {
    var ry = sy + 14 + r * 12.2;
    if (row.mine) rect(g, sx + 3, ry, sw - 6, 11, COLORS.selected);
    rect(g, sx + 5, ry + 3, 5, 5, row.color);
    addText(g, sx + 13, ry + 8.2, row.label, 7, COLORS.ink, { bold: row.mine, maxWidth: 46 });
    addText(g, col(0) - 25, ry + 8.2, row.span, 6.5, COLORS.ink, { anchor: "middle" });
    row.cells.forEach(function (cell, i) {
      var cx = col(i);
      if (cell.kind === "absent") { addText(g, cx, ry + 8, cell.text, 6.5, COLORS.roomLabel, { anchor: "middle" }); return; }
      var tone = TALLY_COLORS[cell.kind];
      rect(g, cx - 6.5, ry + 1.5, 13, 8, COLORS[tone[1]], { stroke: COLORS[tone[0]], "stroke-width": cell.kind === "under" ? .8 : 0 });
      addText(g, cx, ry + 7.8, cell.text, 5.5, COLORS[tone[2]], { anchor: "middle", bold: true });
    });
  });
  if (stamp.more) addText(g, sx + 6, sy + sh - 5, moreText(stamp.more), 6, COLORS.roomLabel, { maxWidth: sw - 12 });
}

function drawDayStamp(g, dx, sy, dw, sh, stamp) {
  stampPaper(g, dx, sy, dw, sh, COLORS.plank);
  addText(g, dx + 5, sy + 10, "CEZ DEŇ", 8, COLORS.amberEdge, { bold: true });
  if (!stamp.rows.length) addText(g, dx + 5, sy + 24, "nikto", 6.5, COLORS.roomLabel);
  stamp.rows.forEach(function (row, r) {
    var ry = sy + 14 + r * 11;
    if (row.mine) rect(g, dx + 2, ry, dw - 4, 10, COLORS.selected);
    rect(g, dx + 5, ry + 2.5, 5, 5, row.color);
    addText(g, dx + 13, ry + 7.8, row.label, 6.5, COLORS.ink, { bold: row.mine, maxWidth: dw - 38 });
    addText(g, dx + dw - 5, ry + 7.8, row.days, 6.5, COLORS.ink, { anchor: "end", maxWidth: 24 });
  });
  if (stamp.more) addText(g, dx + 5, sy + 47, moreText(stamp.more), 5.5, COLORS.roomLabel, { maxWidth: dw - 10 });
  rect(g, dx + 4, sy + 49, dw - 8, 1, COLORS.woodLight);
  addText(g, dx + 5, sy + 58, "na jedlo:", 6, COLORS.ink, { bold: true });
  boardFoodLines(stamp.food, 2).forEach(function (line, i) {
    addText(g, dx + 5, sy + 67 + i * 8, line, 6, COLORS.ink, { maxWidth: dw - 10 });
  });
}

// A tap wiggles the board in four steps (the style sheet; none with prefers-reduced-motion).
function wiggleBoard(g) {
  g.classList.remove("wiggle");
  void g.getBoundingClientRect();      // restart the animation
  g.classList.add("wiggle");
}

// --- the panel ---

// „Kto kedy príde“: a bottom sheet on a phone and a centred window on a desktop, with „Noc“ / „Cez deň“ tabs.
function openBoardPanel(returnKey) {
  var tab = "night";
  openPanel("Kto kedy príde", function (body, panel) {
    body.parentNode.classList.add("board-panel");
    body.appendChild(htmlEl("p", null, "Čísla sú miesta: vybraté / treba."));
    var tabs = htmlEl("div", { "class": "board-tabs", role: "tablist" });
    var tabButtons = {};
    [["night", "Noc"], ["day", "Cez deň"]].forEach(function (t) {
      var b = htmlEl("button", { type: "button", role: "tab", "class": "board-tab", "data-key": "board-tab-" + t[0] }, t[1]);
      b.addEventListener("click", function () { tab = t[0]; panel.refresh(); });
      tabs.appendChild(b);
      tabButtons[t[0]] = b;
    });
    var view = htmlEl("div", { role: "tabpanel" });
    body.appendChild(tabs);
    body.appendChild(view);
    var actions = htmlEl("div", { "class": "actions" });
    var close = htmlEl("button", { "class": "btn", type: "button", "data-key": "board-close" }, "Zavrieť");
    close.addEventListener("click", closePanel);
    actions.appendChild(close);
    body.appendChild(actions);
    panel.refresh = function () {
      Object.keys(tabButtons).forEach(function (key) { tabButtons[key].setAttribute("aria-selected", key === tab ? "true" : "false"); });
      clearNode(view);
      if (!app.state) return;
      var model = boardPanelModel(app.state, app.myParty, app.night);
      view.appendChild(tab === "night" ? boardNightTable(model.night) : boardDayTable(model.day));
    };
    panel.refresh();
  }, { returnKey: returnKey, wide: true, initialFocus: function (body) { return body.querySelector(".board-tab"); } });
}

function boardNameCell(row) {
  var td = htmlEl("th", { scope: "row", "class": "board-name" });
  var sw = htmlEl("span", { "class": "swatch", "aria-hidden": "true" });
  sw.style.background = row.color;
  td.appendChild(sw);
  td.appendChild(htmlEl("span", null, row.name));
  if (row.mine) td.appendChild(htmlEl("span", { "class": "legend-me" }, " (ty)"));
  return td;
}

function boardNightTable(model) {
  var table = htmlEl("table", { "class": "board-table" });
  var head = htmlEl("tr");
  ["Partia", "Príde", "Odíde"].forEach(function (t) { head.appendChild(htmlEl("th", { scope: "col" }, t)); });
  model.cols.forEach(function (c) { head.appendChild(htmlEl("th", { scope: "col", "class": "num" + (c.current ? " current" : "") }, c.label)); });
  table.appendChild(head);
  if (!model.rows.length) {
    var empty = htmlEl("tr"), cell = htmlEl("td", { colspan: String(3 + model.cols.length), "class": "board-empty" }, partyTableEmptyText(app.state));
    empty.appendChild(cell);
    table.appendChild(empty);
  }
  model.rows.forEach(function (row) {
    var tr = htmlEl("tr", row.mine ? { "class": "mine" } : null);
    tr.appendChild(boardNameCell(row));
    tr.appendChild(htmlEl("td", null, row.arrive));
    tr.appendChild(htmlEl("td", null, row.leave));
    row.cells.forEach(function (c) {
      var td = htmlEl("td", { "class": "num" + (c.current ? " current" : "") });
      td.appendChild(htmlEl("span", { "class": "tally " + c.kind }, c.text));
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  var foot = htmlEl("tr", { "class": "foot" });
  foot.appendChild(htmlEl("th", { scope: "row", colspan: "3" }, model.footerLabel));
  model.footer.forEach(function (c) { foot.appendChild(htmlEl("td", { "class": "num" + (c.current ? " current" : "") }, c.text)); });
  table.appendChild(foot);
  return table;
}

function boardDayTable(model) {
  var table = htmlEl("table", { "class": "board-table" });
  var head = htmlEl("tr");
  head.appendChild(htmlEl("th", { scope: "col" }, "Partia"));
  model.cols.forEach(function (c) { head.appendChild(htmlEl("th", { scope: "col", "class": "num" }, c.label)); });
  table.appendChild(head);
  if (!model.rows.length) {
    var empty = htmlEl("tr");
    empty.appendChild(htmlEl("td", { colspan: String(1 + model.cols.length), "class": "board-empty" }, "Zatiaľ nikto nepríde len cez deň."));
    table.appendChild(empty);
  }
  model.rows.forEach(function (row) {
    var tr = htmlEl("tr", row.mine ? { "class": "mine" } : null);
    tr.appendChild(boardNameCell(row));
    row.cells.forEach(function (text) { tr.appendChild(htmlEl("td", { "class": "num" }, text)); });
    table.appendChild(tr);
  });
  var foot = htmlEl("tr", { "class": "foot" });
  foot.appendChild(htmlEl("th", { scope: "row" }, model.foodLabel));
  model.food.forEach(function (n) { foot.appendChild(htmlEl("td", { "class": "num" }, String(n))); });
  table.appendChild(foot);
  return table;
}
