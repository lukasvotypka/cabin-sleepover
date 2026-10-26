// Pure page logic, part 5: shirt letter, legend, party table, WhatsApp and screen reader summaries.
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).

// --- the letter on a figure's shirt (T-018) ---

var SHIRT_DARK = "#2E1F14";    // same as COLORS.ink in the app script
var SHIRT_LIGHT = "#F4EBD0";   // same as COLORS.paper in the app script

// A hand-made 3 x 5 pixel font: rows top to bottom, "#" is a pixel. Keys are A-Z, 0-9 and the fallback dot.
var PIXEL_FONT = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"], D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"], J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."], P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"], V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
  0: ["###", "#.#", "#.#", "#.#", "###"], 1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["##.", "..#", ".#.", "#..", "###"], 3: ["##.", "..#", ".#.", "..#", "##."],
  4: ["#.#", "#.#", "###", "..#", "..#"], 5: ["###", "#..", "##.", "..#", "##."],
  6: [".##", "#..", "###", "#.#", "###"], 7: ["###", "..#", ".#.", ".#.", ".#."],
  8: ["###", "#.#", "###", "#.#", "###"], 9: ["###", "#.#", "###", "..#", "##."],
  "·": ["...", "...", ".#.", "...", "..."]
};

// The PIXEL_FONT key for a party name: strip accents (Š -> S), take the first letter or digit (skipping spaces,
// quotes and emoji), uppercase it. "·" when there is none or the font has no such character (Ł, Ω, Я).
function shirtChar(name) {
  var plain = String(name == null ? "" : name).normalize("NFD").replace(/\p{M}/gu, "");
  var found = plain.match(/[\p{L}\p{N}]/u);
  if (!found) return "·";
  var up = Array.from(found[0].toUpperCase())[0];
  return Object.prototype.hasOwnProperty.call(PIXEL_FONT, up) ? up : "·";
}

// SVG path data of a glyph with its top-left pixel at (x, y): one 1 x 1 square per "#". Unknown keys draw "·".
// Numbers only, so no text from people can get into the path.
function glyphPath(ch, x, y) {
  var rows = Object.prototype.hasOwnProperty.call(PIXEL_FONT, ch) ? PIXEL_FONT[ch] : PIXEL_FONT["·"];
  var d = "";
  rows.forEach(function (row, r) {
    for (var c = 0; c < row.length; c++) {
      if (row.charAt(c) === "#") d += "M" + (x + c) + " " + (y + r) + "h1v1h-1z";
    }
  });
  return d;
}

// WCAG relative luminance of "#RRGGBB" (0 ... 1) and the contrast ratio of two such colours (1 ... 21).
function relLuminance(hex) {
  var v = [1, 3, 5].map(function (i) {
    var c = parseInt(String(hex).slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

function contrastRatio(a, b) {
  var la = relLuminance(a), lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// SHIRT_DARK or SHIRT_LIGHT, whichever contrasts more with the party colour (a tie goes to dark).
// Anything that is not "#RRGGBB" gives SHIRT_DARK.
function shirtInk(color) {
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) return SHIRT_DARK;
  return contrastRatio(color, SHIRT_LIGHT) > contrastRatio(color, SHIRT_DARK) ? SHIRT_LIGHT : SHIRT_DARK;
}

// Top-left pixel of the letter on a figure drawn at (px, py) by drawFigure:
// adult rows 6-10 of the 7-row torso, kid rows 4-8 (the shirt below the head).
function shirtOrigin(px, py, kind) {
  return kind === "kid" ? [px + 3, py + 4] : [px + 3, py + 6];
}

// The stay line of a day-only party: its days, then the arrival time when there is one ("Pi 30. 10., Ne 1. 11. · po obede").
function dayOnlyStayText(party) {
  var text = party.day_visits.slice().sort().map(dayLabel).join(", ");
  return party.arrival_time ? text + " · " + party.arrival_time : text;
}

// One row per party (day-only ones too), in `state.parties` order (creation order, which is also the palette order).
function legendRows(state, myPartyId) {
  return ((state && state.parties) || []).map(function (p) {
    var dayOnly = isDayOnly(p);
    return {
      id: p.id, name: p.name, color: p.color, people: peopleText(p), dayOnly: dayOnly,
      stay: dayOnly ? dayOnlyStayText(p) : stayText(p), mine: p.id === myPartyId,
      ch: shirtChar(p.name), ink: shirtInk(p.color)
    };
  });
}

// The parties that sleep over: day-only parties have no places, so the per-night table leaves them out.
function overnightParties(state) {
  return ((state && state.parties) || []).filter(function (p) { return !isDayOnly(p); });
}

// --- party table (the paper table under the night signposts) ---

// Cell text from a nightTally: "–" absent; "2/3" under; "4/3" over; "3/3" ok.
function tableCellText(t) {
  if (t.kind === "absent") return "–";
  return t.placed + "/" + t.needed;
}

// One row per overnight party, in `state.parties` order; [] when there are none.
// [{id, name, label, color, mine, cells: [{night, kind, text}]}], one cell per night of the event.
function partyTableRows(state, myPartyId) {
  return overnightParties(state).map(function (p) {
    return {
      id: p.id, name: p.name, label: ellipsize(p.name, 14), color: p.color, mine: p.id === myPartyId,
      cells: state.event.nights.map(function (night) {
        var t = nightTally(state, p, night);
        return { night: night, kind: t.kind, text: tableCellText(t) };
      })
    };
  });
}

// "Št 29", "Pi 30", "Ne 1": the column header of a day ("" for a bad date).
function dayColumnLabel(iso) {
  var p = parseIso(iso);
  return p ? DAY_SHORT[p.dow] + " " + p.d : "";
}

// One row per day-only party, in `state.parties` order: {id, name, label, color, mine, cells}, with one cell
// per event day; the cell text is the number of people on a day the party visits, else "".
function dayTableRows(state, myPartyId) {
  var days = eventDays(state && state.event);
  return ((state && state.parties) || []).filter(isDayOnly).map(function (p) {
    return {
      id: p.id, name: p.name, label: ellipsize(p.name, 14), color: p.color, mine: p.id === myPartyId,
      cells: days.map(function (day) {
        return { day: day, text: p.day_visits.indexOf(day) !== -1 ? String(p.adults + p.kids) : "" };
      })
    };
  });
}

// The „spolu na jedlo“ numbers: one foodCount per event day, 0 included (as the number 0).
function foodRow(state) {
  return eventDays(state && state.event).map(function (day) { return foodCount(state, day); });
}

// Geometry of the two-part table (moon part, divider, sun part, food row) for `rect` = [x, y, w, h], in
// scene units. The row height is fixed, so the table is only as tall as its rows: `height` <= rect[3].
// A part that does not fit draws `lines - 1` rows plus a "+N" line. The day part keeps at least
// min(dayRows, 2) lines and the night part gets the rest. Both parts share the column grid of the larger count
// (`cols`, right-aligned): night column i is at the same x as day column i, and a night part with fewer
// columns than days leaves the last ones empty (its `colX` is shorter).
// Returns {pad, head, rowH, size, colW, height, nameX, night, day, dividerY, ruleY, foodY, ...}, where
// `night` and `day` are {headY, y0, rows, more, lines, nameW, colX: [..]}.
function partyTableLayout(rect, nightRows, dayRows, nightCount, dayCount) {
  var pad = 3, head = 10, rowH = 8.5, colW = 28, divider = 5, ruleGap = 3;
  var fixed = 2 * pad + 2 * head + divider + ruleGap + rowH;
  var capacity = Math.max(0, Math.floor((rect[3] - fixed) / rowH));
  var nightAlloc = Math.min(nightRows, Math.max(0, capacity - Math.min(dayRows, 2)));
  var dayAlloc = Math.min(dayRows, Math.max(0, capacity - nightAlloc));
  var cols = Math.max(nightCount, dayCount), grid = [];
  for (var i = 0; i < cols; i++) grid.push(rect[0] + rect[2] - pad - (cols - i) * colW);
  function part(count, alloc, used, headY) {
    var fits = count <= alloc, rows = fits ? count : Math.max(0, alloc - 1);
    return {
      headY: headY, y0: headY + head, rows: rows, more: count - rows, lines: rows + (fits ? 0 : 1),
      nameW: rect[2] - 2 * pad - cols * colW, colX: grid.slice(0, used)
    };
  }
  var night = part(nightRows, nightAlloc, nightCount, rect[1] + pad);
  var dividerY = night.y0 + night.lines * rowH + 2;
  var day = part(dayRows, dayAlloc, dayCount, dividerY + divider - 2);
  var ruleY = day.y0 + day.lines * rowH + 1;
  var foodY = day.y0 + day.lines * rowH + ruleGap;
  return {
    pad: pad, head: head, rowH: rowH, size: 6.5, colW: colW, nameX: rect[0] + pad,
    night: night, day: day, dividerY: dividerY, ruleY: ruleY, foodY: foodY,
    height: foodY + rowH + pad - rect[1]
  };
}

// "+1 ďalšia", "+2 ďalšie" (2-4), "+5 ďalších" (5+)
function moreText(n) {
  return "+" + n + (n === 1 ? " ďalšia" : n >= 2 && n <= 4 ? " ďalšie" : " ďalších");
}

// The parts of the „Kto je kto“ third line: ["Št → Pi 2/3", "Pi → So 3/3", "So → Ne –"].
function legendNightParts(row) {
  return row.cells.map(function (c) {
    var info = nightInfo(c.night);
    return (info ? info.label : c.night) + " " + c.text;
  });
}

// The third line as one text: "Št → Pi 2/3 · Pi → So 3/3 · So → Ne –".
function legendNightsText(row) {
  return legendNightParts(row).join(" · ");
}

// Screen-reader lines: "Ivan a Eva (ty): Št → Pi 2 z 3, Pi → So 3 z 3, So → Ne nie je tu".
function partyTableSummary(state, myPartyId) {
  return overnightParties(state).map(function (p) {
    var cells = state.event.nights.map(function (night) {
      var t = nightTally(state, p, night), info = nightInfo(night);
      var label = info ? info.label : night, d = Math.abs(t.placed - t.needed);
      if (t.kind === "absent") return label + " nie je tu";
      if (t.kind === "over" && !t.present) return label + " nie je tu, ale má " + pluralPlaces(t.placed);
      var text = label + " " + t.placed + " z " + t.needed;
      if (t.kind === "under") text += ", " + missingVerb(d) + " " + pluralPlaces(d);
      if (t.kind === "over") text += ", o " + pluralPlaces(d) + " viac";
      return text;
    });
    return p.name + (p.id === myPartyId ? " (ty)" : "") + ": " + cells.join(", ");
  });
}

// The slots the party holds on nights outside a new stay (what the server will free): {night, slot},
// by night and then in layout order, like the server's `freed`.
function freedByStay(state, partyId, arrive, leave) {
  var order = slotIds(state.layout), out = [];
  Object.keys(state.sleeping || {}).sort().forEach(function (night) {
    if (arrive && leave && arrive <= night && night < leave) return;   // null = day-only: keep nothing
    var held = state.sleeping[night];
    order.forEach(function (slot) {
      if (held[slot] === partyId) out.push({ night: night, slot: slot });
    });
  });
  return out;
}

// One line per night for a list of freed slots: "Vo štvrtok: Manželská posteľ (2 miesta), Posteľ pod oknom".
function freedLines(state, freed) {
  var nights = [], byNight = {};
  freed.forEach(function (entry) {
    if (!byNight[entry.night]) { byNight[entry.night] = []; nights.push(entry.night); }
    var bed = bedOfSlot(state.layout, entry.slot);
    var name = bed ? bed.name : "iné miesto";
    var list = byNight[entry.night], found = null;
    list.forEach(function (item) { if (item.name === name) found = item; });
    if (found) found.count++;
    else list.push({ name: name, count: 1 });
  });
  return nights.sort().map(function (night) {
    var parts = byNight[night].map(function (item) {
      return item.count > 1 ? item.name + " (" + pluralPlaces(item.count) + ")" : item.name;
    });
    return capitalize(dayLocative(night)) + ": " + parts.join(", ");
  });
}

var FREED_TEXTS = {
  ask: "Skrátením pobytu sa uvoľnia tieto miesta:",
  done: "Uložené. Uvoľnili sa tieto miesta:"
};

// --- summary for WhatsApp and the hidden summary for screen readers ---

// "1 človek", "2 ľudia" (2-4), "5 ľudí" (0 and 5+).
function peopleCountText(n) {
  return n + (n === 1 ? " človek" : n >= 2 && n <= 4 ? " ľudia" : " ľudí");
}

// How many people eat on a day. The rule (an open decision, change it only here): a day-only party counts
// `adults + kids` on its `day_visits`. An overnight party with `arrive <= day <= leave` counts
// `adults + kids - missing`, where missing(n) = neededSlots - neededOnNight for night n. Day D touches night D - 1
// (morning) and night D (evening) when they lie inside the stay (`arrive <= n < leave`): the arrival day only has
// night D, the leave day only night D - 1. The night with the smaller `missing` (more people) wins. Kids in the
// parents' bed count, because only the reduction is subtracted, never the slots. Never below 0.
function foodCount(state, day) {
  var total = 0;
  ((state && state.parties) || []).forEach(function (p) {
    if (isDayOnly(p)) {
      if (p.day_visits.indexOf(day) !== -1) total += p.adults + p.kids;
      return;
    }
    if (!p.arrive || !p.leave || day < p.arrive || day > p.leave) return;
    var missing = null;
    [addDays(day, -1), day].forEach(function (n) {
      if (!isPresent(p, n)) return;
      var m = neededSlots(p) - neededOnNight(p, n);
      if (missing === null || m < missing) missing = m;
    });
    total += Math.max(0, p.adults + p.kids - (missing || 0));
  });
  return total;
}

// One row per event day that has a day-only party, in day order: {day, label, parties, food}.
function dayVisitRows(state) {
  var rows = [];
  eventDays(state.event).forEach(function (day) {
    var parties = [];
    (state.parties || []).forEach(function (p) {
      if (isDayOnly(p) && p.day_visits.indexOf(day) !== -1) {
        parties.push({ id: p.id, name: p.name, color: p.color, people: p.adults + p.kids });
      }
    });
    if (parties.length) rows.push({ day: day, label: dayLabel(day), parties: parties, food: foodCount(state, day) });
  });
  return rows;
}

// The text of the empty „Kto kde spí po nociach“ list: day-only parties are people, but they sleep nowhere.
function partyTableEmptyText(state) {
  return ((state && state.parties) || []).length ? "Zatiaľ tu nikto nespí." : "Zatiaľ tu nikto nie je.";
}

// "Prehľad na poslanie": the name and dates, for each night the rooms with the party names, then the
// parties that lack places, then the page link. Plain text, no codes.
function summaryText(state, link) {
  var event = state.event, lines = [event.name], total = totalSlots(state.layout);
  var dates = eventDateText(event);
  if (dates) lines.push(dates);
  event.nights.forEach(function (night) {
    var info = nightInfo(night) || { label: night, dates: "" };
    lines.push("");
    lines.push(info.label + " (" + info.dates + "), obsadené " + usedCount(state, night) + " z " + total);
    state.layout.rooms.forEach(function (room) {
      var o = roomOccupants(state, room, night);
      lines.push(room.name + ": " + (o.names.length ? o.names.join(", ") : "nikto") +
        (o.names.length && o.free ? " (" + freeText(o.free) + ")" : ""));
    });
  });
  var visits = dayVisitRows(state);
  if (visits.length) {
    lines.push("");
    lines.push("Cez deň (bez spania):");
    visits.forEach(function (row) {
      lines.push(row.label + ": " + row.parties.map(function (p) { return p.name + " (" + p.people + ")"; }).join(", "));
      lines.push("   → spolu " + peopleCountText(row.food) + " na jedlo");
    });
  }
  var warnings = [];
  (state.parties || []).forEach(function (party) {
    var parts = [];
    event.nights.forEach(function (night) {
      var n = missingPlaces(state, party, night);
      if (n > 0) parts.push(dayLocative(night) + " " + missingVerb(n) + " " + pluralPlaces(n));
    });
    if (parts.length) warnings.push("- " + party.name + ": " + parts.join(", "));
  });
  if (warnings.length) {
    lines.push("");
    lines.push("Chýbajú miesta:");
    warnings.forEach(function (w) { lines.push(w); });
  }
  var food = state && state.info ? foodNotes(state) : [];  // the section is off without info
  if (food.length) {
    lines.push("");
    lines.push("Čo kto donesie: " + food.map(function (f) { return f.name + " – " + f.text; }).join("; "));
  }
  var notBriefed = notBriefedNames(state);
  if (notBriefed.length) {
    lines.push("");
    lines.push("Pred cestou ešte neprešli: " + notBriefed.join(", "));
  }
  lines.push("");
  lines.push("Tu sa zapíšeš: " + link);
  return lines.join("\n");
}

// The text a screen reader gets for the selected night: {title, dates, instructions, night, rooms, dayVisits}, where
// dayVisits is one line per day with day-only parties and rooms is [{name, beds: [{name, names, free, text}]}]. `text` is the party names, "voľné" for a free bed.
function hiddenSummary(state, night) {
  var info = nightInfo(night) || { label: night, dates: "" };
  return {
    title: state.event.name,
    dates: eventDateText(state.event),
    instructions: NOTICE_LINES.slice(),
    dayVisits: dayVisitRows(state).map(function (row) {
      return dayOptionText(row.day) + " cez deň: " + row.parties.map(function (p) {
        return p.name + " (" + peopleCountText(p.people) + ")";
      }).join(", ") + ", spolu " + peopleCountText(row.food) + " na jedlo";
    }),
    night: "Noc " + info.label + " (" + info.dates + "), obsadené " + usedCount(state, night) + " z " + totalSlots(state.layout),
    rooms: state.layout.rooms.map(function (room) {
      return {
        name: room.name,
        beds: room.beds.map(function (bed) {
          var o = bedOccupants(state, bed, night);
          var text = o.names.length ? o.names.join(", ") + (o.free ? ", " + freeText(o.free) : "") : "voľné";
          return { name: bed.name, names: o.names, free: o.free, text: text };
        })
      };
    })
  };
}
