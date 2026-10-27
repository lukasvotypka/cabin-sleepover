"use strict";

// App part: the top HUD (T-145): three night stamps (night, dates, places used, my party's tally); the time rail under
// them is in app-daynight.js. Fixed to the viewport, so it stays put while the map is panned or zoomed.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var TOP_GAP = 8;      // between the top HUD and the fitted scene, CSS px

// Bottom edge of the top HUD in CSS px (plus a small gap), 0 while it is hidden (before the scene, or under the move bar).
// Also published as `--top-h` for the quest log.
function topHudBottom() {
  var box = $("tophud"), inner = box.firstElementChild, b = 0;
  if (!$("hud").hidden && inner && inner.offsetParent !== null) b = Math.ceil(inner.getBoundingClientRect().bottom);
  document.documentElement.style.setProperty("--top-h", b + "px");
  return b ? b + TOP_GAP : 0;
}

// One stamp per night. A tap selects the night and runs the time-lapse, as the signposts did.
function drawStamps(host, state) {
  var nights = state.event.nights, total = totalSlots(state.layout), party = partyById(state, app.myParty);
  host.style.gridTemplateColumns = "repeat(" + nights.length + ", 1fr)";
  nights.forEach(function (night) {
    var info = nightInfo(night) || { label: night, dates: "" };
    var used = usedCount(state, night), selected = night === app.night;
    var tally = party ? nightTally(state, party, night) : null;
    var stamp = htmlEl("button", { "class": "stamp", type: "button", "data-key": "night-" + night, "aria-pressed": selected ? "true" : "false",
      "aria-label": "Noc " + info.label + ", " + info.dates + ", obsadené " + used + " z " + total +
        " miest" + (selected ? ", zvolená noc" : "") + (tally ? ". " + tallyLabel(tally) : "") });
    var face = htmlEl("span", { "class": "face", "aria-hidden": "true" });
    face.appendChild(htmlEl("span", { "class": "d" }, info.label));
    face.appendChild(htmlEl("span", { "class": "dt" }, info.dates));
    var row = htmlEl("span", { "class": "row" });
    var occ = htmlEl("span", { "class": "occ" });
    occ.appendChild(htmlEl("b", null, String(used)));
    occ.appendChild(document.createTextNode("/" + total));
    row.appendChild(occ);
    if (tally) row.appendChild(htmlEl("span", { "class": "chip " + (tally.kind === "absent" ? "absent" : tally.kind) },
      tally.kind === "absent" ? "nie si" : tally.placed + "/" + tally.needed));
    face.appendChild(row);
    stamp.appendChild(face);
    stamp.addEventListener("click", function () { selectNight(night, { animate: true }); });
    host.appendChild(stamp);
  });
}

function renderStamps() {
  keepFocus($("stamps"), function () {
    var host = $("stamps");
    clearNode(host);
    drawStamps(host, app.state);
  });
}
