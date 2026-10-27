"use strict";

// App part 5b: the HUD around the map: the quest log (top right, below the night stamps of app-tophud.js), and the bottom bar with „Si: …“ and the tool buttons.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- HUD (fixed to the viewport, so it stays put while the map is panned or zoomed) ---

var QUEST_KEY = "cabin.questsOpen";     // "1" while the quest log is unfolded; folded by default

// Height of the bottom HUD bar (from its top edge to the window bottom) in CSS px, 0 while the HUD is hidden.
// Also published as `--hud-h` for „Celá mapa“, the turn buttons and the toast above it.
function hudHeight() {
  var hud = $("hud"), h = 0;
  if (!hud.hidden) {
    h = Math.max(0, Math.ceil(window.innerHeight - $("bar").getBoundingClientRect().top));
  }
  document.documentElement.style.setProperty("--hud-h", h + "px");
  return h;
}

// Bottom edge of the folded quest log in CSS px (the scene's top inset), 0 while it is hidden. Only the header
// counts: the unfolded list lies over the map, so folding and unfolding does not move the map.
function questBottom() {
  var q = $("quest"), head = q.querySelector(".quest-head");
  if ($("hud").hidden || q.offsetParent === null || !head) return 0;
  return Math.ceil(head.getBoundingClientRect().bottom) + 16;      // + frame, rod below it and a gap
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
  var svg = hudIcon(parent, "crest-shield", 14, 16, 2, [
    [0, 0, 14, 10, edge], [1, 10, 12, 2, edge], [3, 12, 8, 2, edge], [5, 14, 4, 2, edge],
    [1, 1, 12, 9, face], [2, 10, 10, 2, face], [4, 12, 6, 2, face], [1, 1, 12, 2, "#FFD54A"]
  ]);
  if (party) svgEl(svg, "path", { d: glyphPath(shirtChar(party.name), 5.5, 4), fill: shirtInk(party.color) });
  return svg;
}

// Pixel icons of the tool buttons: [x, y, w, h, fill] rects on a 13 x 13 grid.
var HUD_ICONS = {
  notice: [[1, 1, 11, 11, "#6B4426"], [4, 3, 5, 1, "#F4EBD0"], [8, 4, 1, 2, "#F4EBD0"], [6, 6, 2, 1, "#F4EBD0"], [6, 7, 1, 1, "#F4EBD0"], [6, 9, 1, 1, "#F4EBD0"]],
  legend: [[1, 2, 11, 9, "#F4EBD0"], [2, 3, 2, 2, "#2F7D6D"], [5, 3, 6, 1, "#5C4033"], [2, 6, 2, 2, "#D07A2B"], [5, 6, 5, 1, "#5C4033"], [2, 9, 2, 1, "#6D5BA8"]],
  letter: [[1, 3, 11, 8, "#F4EBD0"], [1, 3, 11, 1, "#5C4033"], [2, 4, 2, 1, "#5C4033"], [4, 5, 2, 1, "#5C4033"], [6, 6, 1, 1, "#5C4033"], [7, 5, 2, 1, "#5C4033"], [9, 4, 2, 1, "#5C4033"], [5, 8, 3, 2, "#B4472F"]],
  briefing: [[3, 3, 7, 9, "#C87A2E"], [4, 1, 5, 2, "#8E5420"], [3, 6, 7, 1, "#8E5420"], [5, 8, 3, 2, "#E6A85A"]],
  key: [[2, 2, 5, 5, "#C98A1C"], [3, 3, 3, 3, "#B98B56"], [6, 5, 6, 2, "#C98A1C"], [9, 7, 1, 2, "#C98A1C"], [11, 7, 1, 2, "#C98A1C"]],
  locked: [[4, 2, 5, 1, "#F4EBD0"], [4, 3, 1, 3, "#F4EBD0"], [8, 3, 1, 3, "#F4EBD0"], [3, 6, 7, 6, "#F4EBD0"], [6, 8, 1, 2, "#A3361E"]]
};

// The tool buttons of the bottom bar, in order: [{key, caption, label, run?, count?, bang?}]. Without `run` the item is a sign.
function hudTools(state) {
  var tools = [
    { key: "notice", caption: "Návod", label: "Návod. Ťuknutím ho otvoríš.", run: openNotice },
    { key: "legend", caption: "Info", label: "Kto je kto. Ťuknutím uvidíš všetkých a ich farby.", run: function () { openLegend("legend"); } },
    { key: "letter", caption: "Prehľad", label: "Prehľad na poslanie. Ťuknutím otvoríš text, ktorý môžeš poslať do WhatsAppu.", run: openSummary }
  ];
  if (state.info) {
    var count = briefingCount(state);
    tools.push({ key: "briefing", caption: "Pred cestou", label: briefingLabel(state), run: enterBriefing,
      count: count ? count.done + "/" + count.total : "", bang: !!(partyById(state, app.myParty) && !briefingDone(state, app.myParty)) });
  }
  if (isAdmin(app.role)) tools.push({ key: "key", caption: "Admin", label: "Admin nástroje", run: openAdmin });
  if (state.signup_open === false) tools.push({ key: "locked", caption: "Zatvorené", label: LOCKED_TEXTS.sign });
  return tools;
}

function drawTools(host, state) {
  hudTools(state).forEach(function (t) {
    var long = t.caption.length > 8 ? " long" : "";
    var node = t.run
      ? htmlEl("button", { "class": "tool" + long, type: "button", "data-key": t.key, "aria-label": t.label })
      : htmlEl("div", { "class": "tool sign" + long, role: "img", "aria-label": t.label });
    hudIcon(node, "tool-icon", 13, 13, 2, HUD_ICONS[t.key]);
    node.appendChild(htmlEl("small", { "aria-hidden": "true" }, t.caption));
    if (t.count) node.appendChild(htmlEl("span", { "class": "tool-count", "aria-hidden": "true" }, t.count));
    if (t.bang) node.appendChild(htmlEl("span", { "class": "tool-bang", "aria-hidden": "true" }, "!"));
    if (t.run) node.addEventListener("click", t.run);
    host.appendChild(node);
  });
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
  plate.appendChild(htmlEl("span", { "class": "crest-name" }, party ? "Si: " + party.name : "Kto si?"));
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
    var quest = $("quest"), crest = $("crest"), tools = $("tools");
    clearNode(tools);
    drawTools(tools, state);
    clearNode(quest);
    drawQuest(quest, rows);
    quest.hidden = !party;                       // nothing to do before „Kto si?“: the crest says it
    clearNode(crest);
    drawCrest(crest, party);
    crest.classList.toggle("ask", !party);
  }, function () { return $("quest").querySelector(".quest-head"); });
  var h = hudHeight(), top = Math.max(questBottom(), topHudBottom());
  renderUpdateSign();
  renderBriefingOffer();
  var changed = h !== app.hudHeight || top !== app.questBottom;
  app.hudHeight = h;
  app.questBottom = top;
  if (changed && app.refit) app.refit();      // the scene must stay between the top and the bottom HUD
}

$("crest").addEventListener("click", function () { openWho(); });
