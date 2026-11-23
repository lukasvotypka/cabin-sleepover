"use strict";

// App part: the closed cabin after the event (T-153). The server sends no parties, sleeping or presence (T-152), so the
// same village is drawn closed: roofs on, padlocks on the doors, a thank-you plank on the gate, „Bolo nás“ on the board,
// one sign and one button in the bottom HUD. Texts and totals come from the pure logic-ended.js, human text only via textContent.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// True while the page shows the reduced state of an ended event. Every other file asks this one question.
function endedMode() {
  return !!app.state && isEnded(app.state);
}

// What render() does in closed mode: the world, the signs, the padlocks and the HUD, nothing about sleeping.
function renderEnded() {
  housesQuiet = true;
  housesSync();
  housesQuiet = false;
  keepFocus($("scene"), function () {
    drawBoards();
    drawBeds();      // in closed mode this draws the houses (drawEndedHouses)
  });
  renderEndedHud();
  renderEndedSummary();
  syncTurnBar();
}

// --- houses: tap areas and padlocks ---

var ENDED_LOCK_W = 14, ENDED_LOCK_H = 18;

// A small brass padlock at (0, 0), its top left corner; the shackle is dark grey, the keyhole dark brown.
function drawPadlock(g) {
  rect(g, 3, 0, 8, 2, "#3A3A3A");
  rect(g, 3, 0, 2, 7, "#3A3A3A");
  rect(g, 9, 0, 2, 7, "#3A3A3A");
  rect(g, 0, 6, ENDED_LOCK_W, 11, "#C9A227", { stroke: COLORS.woodDark, "stroke-width": 1 });
  rect(g, 6, 9, 2, 5, COLORS.ink);
}

function rattleHouse(id) {
  if (prefersReducedMotion()) return;
  Array.prototype.forEach.call($("scene").querySelectorAll('[data-lock="' + id + '"]'), function (node) {
    node.classList.remove("rattle");
    void node.getBoundingClientRect();      // restart the animation
    node.classList.add("rattle");
  });
}

// A tap on a house: the padlock rattles and a toast says the cabin is closed. Never a request.
function onEndedHouseTap(id) {
  rattleHouse(id);
  showToast(ENDED_TEXTS.toast, "info", 2200);
}

function drawEndedHouses() {
  var g = app.layers.beds, layout = app.state.layout, sc = app.iso;
  clearNode(g);
  isoAnchorsReset("beds");
  drawFeatureTreeHit(g);
  var list = isoHouseList(layout).map(function (h) {
    var rooms = layout.rooms.filter(function (r) { return h.rooms.indexOf(r.id) >= 0; });
    return { house: h, id: h.id, rooms: rooms, outline: houseOutline(h, layout.rooms) };
  }).filter(function (e) { return e.outline; });
  isoHouseOrder(sc, list).forEach(function (e) {
    var hg = svgEl(g, "g", { "class": "house house-closed" });
    makeButton(hg, ENDED_TEXTS.houseLabel, "house-" + e.id, function () {
      if (app.suppressClick) { app.suppressClick = false; return; }
      onEndedHouseTap(e.id);
    });
    var hits = isoHouseSilhouette(sc, e.rooms, e.outline).map(function (poly) {
      return svgEl(hg, "polygon", { points: pointsText(poly), fill: "transparent", "class": "house-hit" });
    });
    isoPolyGroup("beds", hits, function () { return isoHouseSilhouette(app.iso, e.rooms, e.outline); });
    hits.forEach(function (hit) {
      hit.addEventListener("pointerenter", function (ev) { if (ev.pointerType === "mouse") isoHouseHover(e.id, true); });
      hit.addEventListener("pointerleave", function () { isoHouseHover(e.id, false); });
    });
  });
  var plates = svgEl(g, "g", { "aria-hidden": "true", "pointer-events": "none" });
  var back = isoBackSides(sc.azimuth);
  endedDoorLocks(layout).forEach(function (d) {
    if (back[d.side]) return;      // the door is in a wall facing away from the camera: the tall wall hides it
    var at = isoPoint(sc, d.x, d.y, d.h), k = round3(sc.figScale * isoDepthScale(sc.basis, d.x, d.y, d.h));
    var sg = svgEl(plates, "g", { transform: isoFigureTransform({ x: at[0] - ENDED_LOCK_W * k / 2, y: at[1] - ENDED_LOCK_H * k / 2, k: k }) });
    isoAnchor("beds", sg, d.x, d.y, d.h, true);
    drawPadlock(svgEl(sg, "g", { "class": "lock", "data-lock": d.house }));
  });
}

// --- the gate and the notice board ---

// The plank under the gate sign: two strings and the thank-you text (it swings in once; not with reduced motion).
function drawGatePlank(g) {
  var hang = svgEl(g, "g", { "class": "gate-plank" });
  rect(hang, -34, -46, 2, 7, COLORS.ink);
  rect(hang, 32, -46, 2, 7, COLORS.ink);
  rect(hang, -56, -40, 112, 20, COLORS.paper, { stroke: COLORS.woodDark, "stroke-width": 2 });
  addText(hang, 0, -27, ENDED_TEXTS.plank, 9, COLORS.ink, { anchor: "middle", bold: true, maxWidth: 100 });
}

// The board of the closed cabin: „Bolo nás“ over three whole-event numbers, a „ZATVORENÉ“ stamp. A tap opens „Čo teraz“.
function drawEndedBoard(parent, box, state) {
  var k = Math.min(box[2] / 272, box[3] / (BOARD_H + 40));
  var outer = svgEl(parent, "g", {
    transform: "translate(" + round3(box[0] + box[2] / 2 - BOARD_W / 2 * k) + " " + round3(box[1] + box[3] - (BOARD_H + 26) * k) + ") scale(" + round3(k) + ")"
  });
  var at = state.layout.map.scene.board;
  isoAnchor("boards", outer, at[0], at[1], 0, true);
  var g = svgEl(outer, "g", { "class": "board-sign" });
  var W = BOARD_W, H = BOARD_H;
  svgEl(g, "ellipse", { cx: W / 2, cy: H + 26, rx: W / 2 + 6, ry: 8, fill: "#2E1F14", opacity: ".3" });
  rect(g, 22, H - 4, 8, 30, COLORS.bedWoodDark);
  rect(g, W - 30, H - 4, 8, 30, COLORS.bedWoodDark);
  rect(g, 0, 0, W, H, COLORS.plank, { stroke: COLORS.bedWoodDark, "stroke-width": 3 });
  polygon(g, [[-10, 2], [W + 10, 2], [W - 8, -14], [8, -14]], COLORS.leafRed);
  rect(g, -10, 2, W + 20, 3, COLORS.brickMortar);
  rect(g, W / 2 - 62, 6, 124, 15, COLORS.woodLight, { stroke: COLORS.woodDark });
  addText(g, W / 2, 17, ENDED_TEXTS.boardTitle, 10, COLORS.ink, { anchor: "middle", bold: true, maxWidth: 116 });

  var px = 8, py = 27, pw = W - 16, ph = 84;
  stampPaper(g, px, py, pw, ph, COLORS.plank);
  var totals = endedTotals(state);
  if (totals.length) {
    totals.forEach(function (t, i) {
      var cx = px + pw / 6 * (1 + 2 * i);
      addText(g, cx, py + 40, String(t.value), 26, "#96540F", { anchor: "middle", bold: true });
      addText(g, cx, py + 54, t.label, 10, COLORS.ink, { anchor: "middle" });
    });
  } else {
    addText(g, px + pw / 2, py + 42, ENDED_TEXTS.signTitle, 12, COLORS.ink, { anchor: "middle", bold: true, maxWidth: pw - 20 });
  }
  addText(g, px + 12, py + ph - 6, ENDED_TEXTS.tap, 8, COLORS.roomLabel);
  var stamp = svgEl(g, "g", { "class": "ended-stamp" });
  var sx = px + pw - 46, sy = py + ph - 17;
  var rot = svgEl(stamp, "g", { transform: "rotate(-12 " + sx + " " + sy + ")" });
  rect(rot, sx - 34, sy - 9, 68, 18, "none", { stroke: COLORS.red, "stroke-width": 1.8 });
  addText(rot, sx, sy + 4, ENDED_TEXTS.stamp, 10, COLORS.red, { anchor: "middle", bold: true, maxWidth: 60 });

  rect(outer, -10, -14, W + 20, H + 40, "transparent", { "class": "hit" });
  makeButton(outer, endedBoardLabel(state), "board", function () {
    wiggleBoard(g);
    openEndedPanel("board");
  });
}

// --- the bottom HUD ---

var ENDED_ICON = [[4, 1, 3, 2, "#2E1F14"], [4, 4, 3, 6, "#2E1F14"], [3, 9, 5, 1, "#2E1F14"]];

function renderEndedHud() {
  var sign = endedHudSign(app.state), host = $("endedSign"), tools = $("tools");
  $("hud").classList.add("ended");
  $("quest").hidden = true;
  $("crest").hidden = true;
  host.hidden = false;
  host.setAttribute("aria-label", sign.label);
  clearNode(host);
  host.appendChild(htmlEl("b", null, sign.title));
  host.appendChild(htmlEl("span", null, sign.line));
  keepFocus($("hud"), function () {
    clearNode(tools);
    var btn = htmlEl("button", { "class": "tool big", type: "button", "data-key": "ended-info", "aria-label": ENDED_TEXTS.toolLabel });
    hudIcon(btn, "tool-icon", 11, 11, 2, ENDED_ICON);
    btn.appendChild(htmlEl("small", { "aria-hidden": "true" }, ENDED_TEXTS.tool));
    btn.addEventListener("click", function () { openEndedPanel("ended-info"); });
    tools.appendChild(btn);
  });
  var h = hudHeight(), top = topHudBottom();
  var changed = h !== app.hudHeight || top !== app.questBottom;
  app.hudHeight = h;
  app.questBottom = top;
  renderUpdateSign();
  if (changed && app.refit) app.refit();
}

// The normal HUD comes back (an admin got the full state): called by renderHud.
function endedHudOff() {
  var hud = $("hud");
  if (!hud.classList.contains("ended")) return;
  hud.classList.remove("ended");
  $("endedSign").hidden = true;
  $("crest").hidden = false;
}

// --- the „Čo teraz“ panel ---

var endedCount = { timers: [] };

function endedCountStop() {
  endedCount.timers.forEach(clearTimeout);
  endedCount.timers = [];
}

// The number counts up in 6 steps (at once with reduced motion).
function endedCountUp(node, to) {
  if (prefersReducedMotion() || to <= 0) { node.textContent = String(to); return; }
  var step = 0;
  node.textContent = "0";
  (function tick() {
    var t = setTimeout(function () {
      endedCount.timers = endedCount.timers.filter(function (x) { return x !== t; });
      step++;
      node.textContent = String(Math.round(to * step / 6));
      if (step < 6) tick();
    }, 90);
    endedCount.timers.push(t);
  })();
}

function openEndedPanel(returnKey) {
  var model = endedPanelModel(app.state);
  endedCountStop();
  openPanel(model.title, function (body) {
    body.parentNode.classList.add("ended-panel");
    if (model.sub) body.appendChild(htmlEl("p", { "class": "sub" }, model.sub));
    if (model.stats.length) {
      var row = htmlEl("div", { "class": "ended-stats" });
      model.stats.forEach(function (s) {
        var tile = htmlEl("div", { "class": "ended-stat" });
        var num = htmlEl("b", null, String(s.value));
        tile.appendChild(num);
        tile.appendChild(htmlEl("span", null, s.label));
        row.appendChild(tile);
        endedCountUp(num, s.value);
      });
      body.appendChild(row);
    }
    model.lines.forEach(function (line) { body.appendChild(htmlEl("p", null, line)); });
    var actions = htmlEl("div", { "class": "actions" });
    var ok = htmlEl("button", { "class": "btn", type: "button", "data-key": "ended-ok" }, model.ok);
    ok.addEventListener("click", closePanel);
    actions.appendChild(ok);
    body.appendChild(actions);
    // The organizer's way in: the existing code screen, „Späť“ comes back to the closed page.
    var adminLine = htmlEl("p", { "class": "admin-line" });
    var link = htmlEl("button", { "class": "link-btn", type: "button", "data-key": "admin-code" }, model.adminCode);
    link.addEventListener("click", function () {
      closePanel();
      showCodeScreen(true);
    });
    adminLine.appendChild(link);
    body.appendChild(adminLine);
  }, { returnKey: returnKey, onClose: endedCountStop, initialFocus: function (body) { return body.querySelector("[data-key='ended-ok']"); } });
}

// --- screen reader summary ---

function renderEndedSummary() {
  var host = $("srSummary"), lines = endedSummaryLines(app.state);
  clearNode(host);
  host.appendChild(htmlEl("h2", null, app.state.event.name));
  var dates = eventDateText(app.state.event);
  if (dates) host.appendChild(htmlEl("p", null, dates));
  lines.forEach(function (line) { host.appendChild(htmlEl("p", null, line)); });
}
