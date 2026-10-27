// Pure page logic: the „Kto kedy príde“ notice board in the village and its panel (T-146).
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).
// The rows come from the same functions as the screen reader summary (partyTableRows, dayTableRows, foodRow).

var BOARD_NIGHT_ROWS = 4;      // parties on the „Noc“ stamp
var BOARD_DAY_ROWS = 3;        // day-only parties on the „Cez deň“ stamp
var BOARD_NAME_MAX = 10;       // letters of a name on a stamp

// The rows to show when only `max` fit: the first ones, but my party is always among them (it takes the last place).
function boardPick(rows, max) {
  if (rows.length <= max) return rows.slice();
  var out = rows.slice(0, max), mine = -1;
  rows.forEach(function (r, i) { if (r.mine) mine = i; });
  if (mine >= max) out[max - 1] = rows[mine];
  return out;
}

// "Št–Ne": the days a party arrives and leaves.
function boardSpan(party) {
  return dayShort(party.arrive) + "–" + dayShort(party.leave);
}

// The „Noc“ stamp: {nights: [{night, label, current}], rows: [{id, label, color, mine, span, cells: [{kind, text, current}]}], more}.
// A cell is "4/4" (kind ok, under or over) or "·" (absent). `current` marks the chosen night.
function boardNightStamp(state, myPartyId, night) {
  var all = partyTableRows(state, myPartyId), picked = boardPick(all, BOARD_NIGHT_ROWS);
  var byId = {};
  ((state && state.parties) || []).forEach(function (p) { byId[p.id] = p; });
  return {
    nights: state.event.nights.map(function (n) { return { night: n, label: dayShort(n), current: n === night }; }),
    rows: picked.map(function (r) {
      return {
        id: r.id, label: ellipsize(r.name, BOARD_NAME_MAX), color: r.color, mine: r.mine, span: boardSpan(byId[r.id]),
        cells: r.cells.map(function (c) {
          return { kind: c.kind, text: c.kind === "absent" ? "·" : c.text, current: c.night === night };
        })
      };
    }),
    more: all.length - picked.length
  };
}

// The „Cez deň“ stamp: {rows: [{id, label, color, mine, days}], more, food: [{day, label, count}]}. `days` is "Pi" or "Pi, So".
// `food` is „na jedlo“ per event day.
function boardDayStamp(state, myPartyId) {
  var all = dayTableRows(state, myPartyId), picked = boardPick(all, BOARD_DAY_ROWS);
  var days = eventDays(state.event), counts = foodRow(state);
  return {
    rows: picked.map(function (r) {
      var on = [];
      r.cells.forEach(function (c, i) { if (c.text) on.push(dayShort(days[i])); });
      return { id: r.id, label: ellipsize(r.name, BOARD_NAME_MAX), color: r.color, mine: r.mine, days: on.join(", ") };
    }),
    more: all.length - picked.length,
    food: days.map(function (d, i) { return { day: d, label: dayShort(d), count: counts[i] }; })
  };
}

// The „na jedlo“ numbers in lines of `perLine`: ["Št 7  Pi 10", "So 10  Ne 10"].
function boardFoodLines(food, perLine) {
  var lines = [];
  for (var i = 0; i < food.length; i += perLine) {
    lines.push(food.slice(i, i + perLine).map(function (f) { return f.label + " " + f.count; }).join("  "));
  }
  return lines;
}

// The panel: {title, sub, night: {cols, rows, footer}, day: {cols, rows, foodLabel, food}}.
// Night rows: {id, name, color, mine, arrive, leave, cells: [{kind, text, current}]}, the footer is the occupancy per night
// („Obsadené“, "11/20"). Day rows: {id, name, color, mine, cells: [text]} per event day.
function boardPanelModel(state, myPartyId, night) {
  var total = totalSlots(state.layout), nights = state.event.nights, days = eventDays(state.event);
  var byId = {};
  ((state && state.parties) || []).forEach(function (p) { byId[p.id] = p; });
  return {
    title: "Kto kedy príde",
    sub: "Čísla sú miesta: vybraté / treba.",
    night: {
      cols: nights.map(function (n) { return { night: n, label: dayShort(n), current: n === night }; }),
      rows: partyTableRows(state, myPartyId).map(function (r) {
        var p = byId[r.id];
        return {
          id: r.id, name: r.name, color: r.color, mine: r.mine,
          arrive: dayColumnLabel(p.arrive), leave: dayColumnLabel(p.leave),
          cells: r.cells.map(function (c) { return { kind: c.kind, text: c.kind === "absent" ? "·" : c.text, current: c.night === night }; })
        };
      }),
      footerLabel: "Obsadené",
      footer: nights.map(function (n) { return { night: n, text: usedCount(state, n) + "/" + total, current: n === night }; })
    },
    day: {
      cols: days.map(function (d) { return { day: d, label: dayColumnLabel(d) }; }),
      rows: dayTableRows(state, myPartyId).map(function (r) {
        return { id: r.id, name: r.name, color: r.color, mine: r.mine, cells: r.cells.map(function (c) { return c.text || "·"; }) };
      }),
      foodLabel: "Spolu na jedlo",
      food: foodRow(state)
    }
  };
}

// The screen reader label of the board button.
function boardLabel(state) {
  var nightParties = overnightParties(state).length, dayParties = ((state && state.parties) || []).filter(isDayOnly).length;
  return "Nástenka Kto kedy príde: " + nightParties + " partií na noc, " + dayParties + " cez deň. Ťuknutím ju otvoríš.";
}
