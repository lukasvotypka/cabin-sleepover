// Pure page logic: the closed cabin after the event (T-153). No DOM, no browser globals: tests/js/logic.test.mjs loads
// all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).
// After the event the server sends no parties, sleeping or presence (T-152): only the event, the layout and the
// whole-event `totals`. Nothing here ever shows who slept where.

// All the Slovak texts of the closed page in one place (open decisions Q28 to Q31 may change them).
var ENDED_TEXTS = {
  signTitle: "Chata je zatvorená",
  signSuffix: "zapisovať sa už nedá",
  tool: "Čo teraz",
  toolLabel: "Čo teraz. Ťuknutím otvoríš poďakovanie.",
  panelTitle: "Vďaka, že ste prišli!",
  plank: "Vďaka, že ste prišli!",
  boardTitle: "Bolo nás",
  stamp: "ZATVORENÉ",
  tap: "ťukni",
  houseLabel: "Zamknutý dom",
  toast: "Zamknuté. Vidíme sa nabudúce!",
  panelLines: [
    "Chata je zatvorená a zapisovať sa už nedá. Kto kde spal, tu už neukazujeme.",
    "Ak pôjdeme znova, pošleme nový odkaz do WhatsAppu."
  ],
  ok: "Dobre",
  adminCode: "Mám admin kód"
};

// Closed mode: the server sent the reduced state (`ended` and no `parties` key). An admin gets the full state, which
// is not closed mode.
function isEnded(state) {
  return !!state && state.ended === true && !Object.prototype.hasOwnProperty.call(state, "parties");
}

// The Slovak form that fits a number: 1 (one), 2 to 4 (few), else (many).
function endedPlural(n, one, few, many) {
  if (n === 1) return one;
  return n >= 2 && n <= 4 ? few : many;
}

function endedPeopleWord(n) { return endedPlural(n, "človek", "ľudia", "ľudí"); }
// One sign-up unit is a „meno“ (never „partia“, rule of T-030).
function endedNamesWord(n) { return endedPlural(n, "meno", "mená", "mien"); }
function endedNightsWord(n) { return endedPlural(n, "noc", "noci", "nocí"); }

// "1 človek", "2 ľudia", "5 ľudí"
function endedPeopleText(n) { return n + " " + endedPeopleWord(n); }
function endedNightsText(n) { return n + " " + endedNightsWord(n); }
function endedNamesText(n) { return n + " " + endedNamesWord(n); }

// The three whole-event totals as [{key, value, label}], or [] when the state has none (or bad ones).
function endedTotals(state) {
  var t = state && state.totals;
  if (!t || typeof t !== "object") return [];
  var vals = [["people", t.people, endedPeopleWord], ["parties", t.parties, endedNamesWord], ["nights", t.nights, endedNightsWord]];
  for (var i = 0; i < vals.length; i++) {
    if (typeof vals[i][1] !== "number" || vals[i][1] < 0 || Math.floor(vals[i][1]) !== vals[i][1]) return [];
  }
  return vals.map(function (v) { return { key: v[0], value: v[1], label: v[2](v[1]) }; });
}

// The bottom HUD sign: {title, line, label}. `line` is the dates and „zapisovať sa už nedá“.
function endedHudSign(state) {
  var term = eventTermShort(state.event);
  var line = (term ? term + " · " : "") + ENDED_TEXTS.signSuffix;
  return { title: ENDED_TEXTS.signTitle, line: line, label: ENDED_TEXTS.signTitle + ". " + line + "." };
}

// The „Čo teraz“ panel: {title, sub, stats: [{key, value, label}], lines, ok}.
function endedPanelModel(state) {
  return {
    title: ENDED_TEXTS.panelTitle,
    sub: eventTermShort(state.event),
    stats: endedTotals(state),
    lines: ENDED_TEXTS.panelLines.slice(),
    ok: ENDED_TEXTS.ok,
    adminCode: ENDED_TEXTS.adminCode
  };
}

// The lines of the hidden screen reader summary: the closed cabin and the totals, nothing per night.
function endedSummaryLines(state) {
  var lines = [ENDED_TEXTS.signTitle + ". " + ENDED_TEXTS.signSuffix.charAt(0).toUpperCase() + ENDED_TEXTS.signSuffix.slice(1) + "."];
  var totals = endedTotals(state);
  if (totals.length) {
    lines.push(ENDED_TEXTS.boardTitle + ": " + totals.map(function (t) { return t.value + " " + t.label; }).join(", ") + ".");
  }
  return lines;
}

// The screen reader label of the notice board.
function endedBoardLabel(state) {
  var totals = endedTotals(state);
  return "Nástenka " + ENDED_TEXTS.boardTitle + (totals.length ? ": " + totals.map(function (t) { return t.value + " " + t.label; }).join(", ") : "") +
    ". " + ENDED_TEXTS.signTitle + ". Ťuknutím ju otvoríš.";
}

// The padlocks: one per outer door of a house, as {house, x, y, h} (a plan point at the middle of the door). A door
// belongs to the first house whose outline (grown by 6) it touches; doors outside every house get no padlock.
var ENDED_LOCK_HEIGHT = 8;
function endedDoorLocks(layout) {
  var out = [], taken = {};
  isoHouseList(layout).forEach(function (house) {
    var o = houseOutline(house, layout.rooms);
    if (!o) return;
    var grown = [o[0] - 6, o[1] - 6, o[2] + 12, o[3] + 12];
    ((layout.map && layout.map.doors) || []).forEach(function (d, i) {
      if (taken[i] || !rectsOverlap(d, grown)) return;
      taken[i] = true;
      var x = d[0] + d[2] / 2, y = d[1] + d[3] / 2;
      var dist = { n: Math.abs(y - o[1]), s: Math.abs(y - (o[1] + o[3])), w: Math.abs(x - o[0]), e: Math.abs(x - (o[0] + o[2])) };
      var side = Object.keys(dist).reduce(function (a, b) { return dist[b] < dist[a] ? b : a; }, "n");      // the outline side the door is on
      out.push({ house: house.id, x: x, y: y, h: ENDED_LOCK_HEIGHT, side: side });
    });
  });
  return out;
}
