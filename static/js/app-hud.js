"use strict";

// App part 5b: the HUD around the map: the quest log (top right) and the crest with „Si: …“ (bottom left).
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- HUD (fixed to the viewport, so it stays put while the map is panned or zoomed) ---

var QUEST_KEY = "cabin.questsOpen";     // "1" while the quest log is unfolded; folded by default

// Height of the bottom HUD zone (the crest) in CSS px, 0 while the HUD is hidden.
// Also published as `--hud-h` for „Celá mapa“ and the toast above it.
function hudHeight() {
  var hud = $("hud"), h = 0;
  if (!hud.hidden) {
    h = Math.max(0, Math.ceil(window.innerHeight - $("crest").getBoundingClientRect().top));
  }
  document.documentElement.style.setProperty("--hud-h", h + "px");
  return h;
}

// Bottom edge of the folded quest log and of the time slider in CSS px (the scene's top inset), 0 while the HUD is
// hidden. Only the header counts: the unfolded list lies over the map, so folding and unfolding does not move the map.
function questBottom() {
  var q = $("quest"), head = q.querySelector(".quest-head"), bar = $("timebar");
  if ($("hud").hidden) return 0;
  var bottom = bar && bar.offsetParent !== null ? Math.ceil(bar.getBoundingClientRect().bottom) + 8 : 0;
  if (q.offsetParent === null || !head) return bottom;
  return Math.max(bottom, Math.ceil(head.getBoundingClientRect().bottom) + 16);      // + frame, rod below it and a gap
}

// A tiny pixel icon: `cells` are [x, y, w, h, fill] rects on a `w` x `h` grid.
function hudIcon(parent, cls, w, h, scale, cells) {
  var svg = svgEl(parent, "svg", { "class": cls, viewBox: "0 0 " + w + " " + h, width: String(w * scale), height: String(h * scale),
    "shape-rendering": "crispEdges", "aria-hidden": "true", focusable: "false" });
  cells.forEach(function (c) { svgEl(svg, "rect", { x: c[0], y: c[1], width: c[2], height: c[3], fill: c[4] }); });
  return svg;
}

// The shield in the party colour with the shirt letter of its name; a plain wooden shield without a party.
function drawShield(parent, party) {
  var face = party ? party.color : "#8A6A4A", edge = "#5C4033";
  var svg = hudIcon(parent, "crest-shield", 14, 16, 4, [
    [0, 0, 14, 10, edge], [1, 10, 12, 2, edge], [3, 12, 8, 2, edge], [5, 14, 4, 2, edge],
    [1, 1, 12, 9, face], [2, 10, 10, 2, face], [4, 12, 6, 2, face], [1, 1, 12, 2, "#FFD54A"]
  ]);
  if (party) svgEl(svg, "path", { d: glyphPath(shirtChar(party.name), 5.5, 4), fill: shirtInk(party.color) });
  return svg;
}

function questOpen() {
  return storage.get(QUEST_KEY) === "1";
}

function toggleQuest() {
  storage.set(QUEST_KEY, questOpen() ? "0" : "1");
  renderHud();
}

// What a tap on a quest row does: the same functions the status sign used to call.
function runQuestAction(row) {
  if (row.action === "who") openWho();
  else if (row.action === "places") openPlacesPanel(row.night);
  else if (row.action === "undo") openPlacesUndoPanel(row.night);
  else if (row.action === "night") selectNight(row.night, { animate: true });
}

function drawQuest(host, rows) {
  var open = questOpen();
  var missing = rows.filter(function (r) { return r.kind === "open"; }).length;
  host.className = "quest" + (open ? "" : " closed");
  var head = htmlEl("button", { "class": "quest-head", type: "button", "data-key": "quest-head", "aria-expanded": String(open),
    "aria-label": "Úlohy" + (missing ? ", otvorené: " + missing : ", všetko hotové") + ". Ťuknutím " + (open ? "zbalíš." : "rozbalíš.") });
  head.appendChild(htmlEl("span", { "class": "quest-title" }, "✦ ÚLOHY"));
  if (missing) head.appendChild(htmlEl("span", { "class": "quest-badge" }, String(missing)));
  head.appendChild(htmlEl("span", { "class": "quest-caret", "aria-hidden": "true" }, open ? "▴" : "▾"));
  head.addEventListener("click", toggleQuest);
  host.appendChild(head);
  if (!open) return;
  var list = htmlEl("div", { "class": "quest-list" });
  var writable = canWrite(app.state, app.role);
  rows.forEach(function (row) {
    // Rows that change places become plain text while signup is closed.
    if (!writable && (row.action === "places" || row.action === "undo")) row = Object.assign({}, row, { action: null });
    var here = row.night && row.night === app.night;
    var cls = "quest-row q-" + row.kind + (here ? " here" : "");
    var node = row.action
      ? htmlEl("button", { "class": cls, type: "button", "data-key": row.key, "aria-label": row.label })
      : htmlEl("div", { "class": cls, role: "img", "aria-label": row.label });
    node.appendChild(htmlEl("span", { "class": "quest-cur", "aria-hidden": "true" }, here ? "▶" : ""));
    node.appendChild(htmlEl("span", { "class": "quest-box", "aria-hidden": "true" }));
    node.appendChild(htmlEl("span", { "class": "quest-text" }, row.text));
    if (row.kind === "open") node.appendChild(htmlEl("span", { "class": "quest-bang", "aria-hidden": "true" }, "!"));
    if (row.action) node.addEventListener("click", function () { runQuestAction(row); });
    list.appendChild(node);
  });
  host.appendChild(list);
}

function drawCrest(host, party) {
  drawShield(host, party);
  var plate = htmlEl("span", { "class": "crest-plate" });
  plate.appendChild(htmlEl("span", { "class": "crest-name" }, party ? ellipsize(party.name, 16) : "Kto si?"));
  app.ageNode = htmlEl("span", { "class": "crest-age" });
  app.ageKey = null;   // a new node: draw it again
  plate.appendChild(app.ageNode);
  host.appendChild(plate);
  app.crestLabel = (party ? "Si: " + party.name + ". " : "Zatiaľ nevieme, kto si. ") + "Ťuknutím vyberieš, kto si.";
  host.setAttribute("aria-label", app.crestLabel);
  renderAge();
}

function renderHud() {
  var state = app.state, party = partyById(state, app.myParty);
  var rows = questRows(viewState().state, party, app.night);
  // „Úloha splnená“ when a night of the same party is finished (not when the party changes).
  if (app.questRows && app.questParty === app.myParty) {
    var done = questsFinished(app.questRows, rows);
    if (done.length) showToast("✦ Úloha splnená: " + done.map(dayShort).join(", ") + " ✦", "info");
  }
  app.questRows = rows;
  app.questParty = app.myParty;
  keepFocus($("hud"), function () {
    var quest = $("quest"), crest = $("crest");
    clearNode(quest);
    drawQuest(quest, rows);
    clearNode(crest);
    drawCrest(crest, party);
  }, function () { return $("quest").querySelector(".quest-head"); });
  var h = hudHeight(), top = questBottom();
  renderUpdateSign();
  renderBriefingOffer();
  var changed = h !== app.hudHeight || top !== app.questBottom;
  app.hudHeight = h;
  app.questBottom = top;
  if (changed && app.refit) app.refit();      // the scene must stay between the quest log and the crest
}

$("crest").addEventListener("click", function () { openWho(); });
