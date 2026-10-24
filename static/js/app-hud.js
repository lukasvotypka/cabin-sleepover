"use strict";

// App part 5b: the bottom HUD: „Si: …“ with the age of the data, and the status sign of my party.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- bottom HUD (fixed to the viewport, so it stays put while the map is panned or zoomed) ---

// Height of the HUD in CSS px (0 while it is hidden). Also published as `--hud-h` for the buttons and toasts above it.
function hudHeight() {
  var hud = $("hud"), h = hud.hidden ? 0 : hud.offsetHeight;
  document.documentElement.style.setProperty("--hud-h", h + "px");
  return h;
}

// A tiny pixel icon: `cells` are [x, y, w, h] rects on a `w` x `h` grid, drawn in `fill`.
function hudIcon(parent, cls, w, h, cells, fill) {
  var svg = svgEl(parent, "svg", { "class": cls, viewBox: "0 0 " + w + " " + h, width: String(w), height: String(h),
    "shape-rendering": "crispEdges", "aria-hidden": "true", focusable: "false" });
  cells.forEach(function (c) {
    svgEl(svg, "rect", { x: c[0], y: c[1], width: c[2], height: c[3], fill: c[4] || fill });
  });
  return svg;
}

var HUD_ALERT_CELLS = [[0, 0, 22, 22, "#FFFFFF"], [10, 4, 2, 9, "#B4472F"], [10, 15, 2, 3, "#B4472F"]];
var HUD_CHECK_CELLS = [[0, 6, 3, 3], [3, 9, 3, 3], [6, 12, 3, 3], [9, 9, 3, 3], [12, 6, 3, 3], [15, 3, 3, 3], [18, 0, 3, 3]];

function drawHudStatus(slot, hud) {
  var tag = hud.action ? "button" : "div";
  var attrs = { "class": "hud-status hud-" + hud.kind, "aria-label": hud.label };
  if (hud.action) { attrs.type = "button"; attrs["data-key"] = "status"; }
  else attrs.role = "img";
  var node = htmlEl(tag, attrs);
  if (hud.kind === "missing") hudIcon(node, "hud-icon hud-bang", 22, 22, HUD_ALERT_CELLS);
  else if (hud.kind === "fewer" || hud.kind === "ok") hudIcon(node, "hud-icon", 21, 15, HUD_CHECK_CELLS, "#FFFFFF");
  var lines = htmlEl("span", { "class": "hud-lines" });
  hud.lines.forEach(function (line, i) {
    lines.appendChild(htmlEl("span", { "class": i === 0 ? "hud-line hud-line-main" : "hud-line" }, line));
  });
  node.appendChild(lines);
  if (hud.action) node.addEventListener("click", function () { runHudAction(hud.action); });
  slot.appendChild(node);
}

// What a tap on the status sign does: the same functions the scene signs used to call.
function runHudAction(action) {
  var party = partyById(app.state, app.myParty);
  var status = myPartyStatus(app.state, party, app.night);
  if (action === "places") openPlacesPanel(status.night);
  else if (action === "night") selectNight(status.night);
  else if (action === "undo") openPlacesUndoPanel(status.night);
  else if (action === "who") openWho();
}

function renderHud() {
  var state = app.state, party = partyById(state, app.myParty);
  var status = myPartyStatus(state, party, app.night);
  var who = $("hudWho");
  $("hudWhoName").textContent = whoText(party);
  who.setAttribute("aria-label", (party ? "Si: " + party.name + ". " : "Zatiaľ nevieme, kto si. ") + "Ťuknutím vyberieš, kto si.");
  app.ageNode = $("hudAge");
  renderAge();
  var slot = $("hudStatus");
  keepFocus($("hud"), function () {
    clearNode(slot);
    drawHudStatus(slot, statusHud(status, app.night));
  }, function () { return $("hudWho"); });      // the sign became a plain label: „Si: …“ takes the focus
  var before = app.hudHeight;
  app.hudHeight = hudHeight();
  if (before !== app.hudHeight && app.refit) app.refit();      // the scene must stay above the HUD
}

$("hudWho").addEventListener("click", function () { openWho(); });
