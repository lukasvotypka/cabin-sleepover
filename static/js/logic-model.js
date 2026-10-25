// Pure page logic, part 1: dates, layout helpers, parties and nights, tallies and texts.
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).

var DAY_NAMES = ["nedeľa", "pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota"];
var DAY_SHORT = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
var DAY_LOCATIVE = ["v nedeľu", "v pondelok", "v utorok", "v stredu", "vo štvrtok", "v piatok", "v sobotu"];
var FALLBACK_ERROR = "Niečo sa nepodarilo, skús to znova.";
var UNKNOWN_PARTY = "neznámy";
var NOTICE_LINES = ["1. Pridaj sa (koľko vás príde).", "2. Vyber, kto si.", "3. Ťukni na posteľ a zapíš sa.", "4. Skontroluj všetky tri noci."];
// Same limits as the server (PartyInput in app/models.py).
var PARTY_LIMITS = { name: 60, arrival_time: 60, note: 300, countMax: 20 };
var LONG_PRESS_SLOP = 10;   // px a finger may move during a long press
var ZOOM_MAX = 4;           // the map zooms in to this multiple of the fitted view (1 = whole scene)
var ZOOM_MIN = 0.6;         // the map zooms out to this fraction of the fitted view
var ZOOM_KEY_STEP = 1.25;   // factor of one + or - key press
var INTRO_ZOOM_MS = 2800;   // the one-time intro: the map eases from the zoomed start view out to the fitted view
var INTRO_ZOOM_START = 2;   // zoom of the intro's start view (on the top of the scene)
var PAN_MARGIN = 0.25;      // the view may pan this fraction of its own size past the bounds

// --- dates ---

function two(n) {
  return (n < 10 ? "0" : "") + n;
}

// "2026-10-31" -> {y, m, d, dow} (dow: 0 = Sunday), or null for anything that is not a real date.
function parseIso(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3];
  var t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y: y, m: mo, d: d, dow: t.getUTCDay() };
}

function addDays(iso, n) {
  var p = parseIso(iso);
  if (!p) return null;
  var t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return t.getUTCFullYear() + "-" + two(t.getUTCMonth() + 1) + "-" + two(t.getUTCDate());
}

// Every day of the event as ISO dates, from the first arrive day to the last leave day (day visits pick from these).
function eventDays(event) {
  var first = event && event.arrive_days && event.arrive_days[0];
  var last = event && event.leave_days && event.leave_days[event.leave_days.length - 1];
  if (!parseIso(first) || !parseIso(last)) return [];
  var out = [], day = first;
  while (day && day <= last && out.length < 366) {
    out.push(day);
    day = addDays(day, 1);
  }
  return out;
}

// "Pi 30. 10." for an ISO day ("" for a bad date).
function dayLabel(iso) {
  var p = parseIso(iso);
  return p ? DAY_SHORT[p.dow] + " " + p.d + ". " + p.m + "." : "";
}

// "29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)" from the first arrive day and the last leave day.
function eventDateText(event) {
  var first = event && event.arrive_days && parseIso(event.arrive_days[0]);
  var last = event && event.leave_days && parseIso(event.leave_days[event.leave_days.length - 1]);
  if (!first || !last) return "";
  return first.d + ". " + first.m + ". (" + DAY_NAMES[first.dow] + ") – " +
    last.d + ". " + last.m + ". " + last.y + " (" + DAY_NAMES[last.dow] + ")";
}

// Screen-reader label of the title board: "<name>, <eventDateText>", or just "<name>" when the dates
// cannot be built.
function titleLabel(event) {
  var dates = eventDateText(event);
  return event.name + (dates ? ", " + dates : "");
}

// {label: "Št → Pi", dates: "29./30. 10."} for the night that starts on `night`, or null.
function nightInfo(night) {
  var a = parseIso(night), b = parseIso(addDays(night, 1));
  if (!a || !b) return null;
  var dates = a.m === b.m ? a.d + "./" + b.d + ". " + a.m + "." : a.d + ". " + a.m + "./" + b.d + ". " + b.m + ".";
  return { label: DAY_SHORT[a.dow] + " → " + DAY_SHORT[b.dow], dates: dates };
}

// "vo štvrtok", "v piatok", "v sobotu" for the day a night starts on ("" for a bad date).
function dayLocative(iso) {
  var p = parseIso(iso);
  return p ? DAY_LOCATIVE[p.dow] : "";
}

// "Štvrtok", "Sobota" for the day a night starts on ("" for a bad date).
function dayTitle(iso) {
  var p = parseIso(iso);
  return p ? capitalize(DAY_NAMES[p.dow]) : "";
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// --- layout ---

function slotIds(layout) {
  var ids = [];
  layout.rooms.forEach(function (room) {
    room.beds.forEach(function (bed) {
      bed.slots.forEach(function (slot) { ids.push(slot); });
    });
  });
  return ids;
}

function totalSlots(layout) {
  return slotIds(layout).length;
}

function bedOfSlot(layout, slot) {
  for (var i = 0; i < layout.rooms.length; i++) {
    for (var j = 0; j < layout.rooms[i].beds.length; j++) {
      if (layout.rooms[i].beds[j].slots.indexOf(slot) !== -1) return layout.rooms[i].beds[j];
    }
  }
  return null;
}

// The door is drawn in the floor color of the room that contains its top-left corner. When two
// rooms overlap there, the later one in the list wins, as it is painted on top.
function doorFloorColor(layout, door) {
  var color = null;
  layout.rooms.forEach(function (room) {
    var r = room.rect;
    if (door[0] >= r[0] && door[0] < r[0] + r[2] && door[1] >= r[1] && door[1] < r[1] + r[3]) color = room.floor;
  });
  return color;
}

// Hit area of a tappable element: `rect` grown by at most caps.up/down/left/right, never into an
// obstacle and never out of `bounds` ([width, height], optional). An obstacle is {rect, shared}. A
// shared obstacle is another tappable element that grows too, so only half of the gap is taken and
// the two hit areas can never overlap. A fixed obstacle (a board, a room) gives up the whole gap.
// An obstacle that already overlaps the rect stops all growth. Returns [x, y, w, h].
function growRect(rect, obstacles, caps, bounds) {
  var x = rect[0], y = rect[1], w = rect[2], h = rect[3];
  var up = caps.up, down = caps.down, left = caps.left, right = caps.right;
  obstacles.forEach(function (o) {
    var r = o.rect, f = o.shared ? 0.5 : 1;
    var overlapX = r[0] < x + w && r[0] + r[2] > x;
    var overlapY = r[1] < y + h && r[1] + r[3] > y;
    if (overlapX && overlapY) { up = down = left = right = 0; return; }
    if (overlapX && r[1] + r[3] <= y) up = Math.min(up, (y - r[1] - r[3]) * f);
    if (overlapX && r[1] >= y + h) down = Math.min(down, (r[1] - y - h) * f);
    if (overlapY && r[0] + r[2] <= x) left = Math.min(left, (x - r[0] - r[2]) * f);
    if (overlapY && r[0] >= x + w) right = Math.min(right, (r[0] - x - w) * f);
  });
  // A neighbour diagonally across a corner: stop the vertical growth toward it so that the two grown
  // rects cannot meet at the corner. A shared one takes half of the vertical gap.
  obstacles.forEach(function (o) {
    var r = o.rect;
    if ((r[0] < x + w && r[0] + r[2] > x) || (r[1] < y + h && r[1] + r[3] > y)) return;
    var below = r[1] >= y + h;
    var gapX = r[0] >= x + w ? r[0] - x - w : x - r[0] - r[2];
    var gapY = below ? r[1] - y - h : y - r[1] - r[3];
    var growX = r[0] >= x + w ? right : left;
    if (o.shared ? 2 * (r[0] >= x + w ? caps.right : caps.left) <= gapX : growX <= gapX) return;   // too far apart to meet
    var limit = o.shared ? gapY * 0.5 : gapY;
    if (below) down = Math.min(down, limit);
    else up = Math.min(up, limit);
  });
  if (bounds) {
    up = Math.min(up, y);
    left = Math.min(left, x);
    down = Math.min(down, bounds[1] - y - h);
    right = Math.min(right, bounds[0] - x - w);
  }
  up = Math.max(0, up); down = Math.max(0, down); left = Math.max(0, left); right = Math.max(0, right);
  return [x - left, y - up, w + left + right, h + up + down];
}

// The rects of the scene boards from `map.scene` (title, nights, notice, ...), except `skip`.
function sceneRects(layout, skip) {
  var scene = layout.map.scene, out = [];
  Object.keys(scene).forEach(function (key) {
    if (key !== skip) out.push(scene[key]);
  });
  return out;
}

// Boards and row positions of the night signposts inside `rect` ([x, y, w, h]) for `count` nights and
// `gap` units between boards. All y values are absolute scene units derived from rect[1] and rect[3].
// {w, boards: [[x, y, w, h], ...],
//  label, date, absent, used, total,        // text baselines
//  chip: [dy, h], chipText}                 // chip rect top (absolute) and height, chip text baseline
function signpostLayout(rect, count, gap) {
  var w = (rect[2] - gap * (count - 1)) / count, boards = [], i;
  for (i = 0; i < count; i++) boards.push([rect[0] + i * (w + gap), rect[1], w, rect[3]]);
  var top = rect[1], bottom = rect[1] + rect[3];
  return {
    w: w, boards: boards,
    label: top + 12, date: top + 21, absent: top + 31,
    chip: [top + 24, 10], chipText: top + 32,
    used: bottom - 15, total: bottom - 6,
  };
}

// Hit area of a signpost row: grows up and down into the grass gap, by at most `grow` units, and
// never into a scene board, a room or a bed.
function nightsHit(layout, grow) {
  var obstacles = [];
  sceneRects(layout, "nights").forEach(function (r) { obstacles.push({ rect: r, shared: false }); });
  layout.rooms.forEach(function (room) {
    obstacles.push({ rect: room.rect, shared: false });
    room.beds.forEach(function (bed) { obstacles.push({ rect: bed.rect, shared: false }); });
  });
  return growRect(layout.map.scene.nights, obstacles, { up: grow, down: grow, left: 0, right: 0 }, layout.map.viewbox);
}

// Hit area of a bed: its rect grown by at most `grow` units on every side. It keeps half of the gap to
// a neighbouring bed and stops at the scene boards, so no two hit areas overlap.
function bedHit(layout, bed, grow) {
  var obstacles = [];
  layout.rooms.forEach(function (room) {
    room.beds.forEach(function (other) {
      if (other.id !== bed.id) obstacles.push({ rect: other.rect, shared: true });
    });
  });
  sceneRects(layout).forEach(function (r) { obstacles.push({ rect: r, shared: false }); });
  return growRect(bed.rect, obstacles, { up: grow, down: grow, left: grow, right: grow }, layout.map.viewbox);
}

// --- parties and nights ---

function partyById(state, id) {
  var list = (state && state.parties) || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

// The night the map shows when a party is picked: its arrival night, else the first event night.
function defaultNightFor(party, nights) {
  if (party && !isDayOnly(party) && party.arrive && nights.indexOf(party.arrive) !== -1) return party.arrive;
  return nights[0];
}

// A day-only party comes for the day (`day_visits`) and never sleeps: it has no arrive and no leave.
function isDayOnly(party) {
  return !!party && Array.isArray(party.day_visits) && party.day_visits.length > 0 && !party.arrive;
}

// A party is present on night n if arrive <= n < leave (ISO dates compare as text). A day-only party
// (no arrive or leave) is never present; null must not reach the comparison, `null <= "2026-10-29"` is true.
function isPresent(party, night) {
  if (!party.arrive || !party.leave) return false;
  return party.arrive <= night && night < party.leave;
}

function neededSlots(party) {
  return party.adults + party.kids - party.kids_in_parents_bed;
}

// Slots the party holds on a night, in layout order.
function partySlots(state, partyId, night) {
  var held = (state.sleeping && state.sleeping[night]) || {};
  return slotIds(state.layout).filter(function (slot) { return held[slot] === partyId; });
}

function usedCount(state, night) {
  return Object.keys((state.sleeping && state.sleeping[night]) || {}).length;
}

// What the party needs on a night: nothing when it is not at the cabin, the `places` override when set
// (never above the full count), else the full count.
function neededOnNight(party, night) {
  if (!isPresent(party, night)) return 0;
  var full = neededSlots(party), set = party.places && party.places[night];
  return typeof set === "number" && set >= 1 ? Math.min(set, full) : full;
}

function missingPlaces(state, party, night) {
  return Math.max(0, neededOnNight(party, night) - partySlots(state, party.id, night).length);
}

function extraPlaces(state, party, night) {
  return Math.max(0, partySlots(state, party.id, night).length - neededOnNight(party, night));
}

// Placed vs needed places of a party on one night.
// {night, present, needed, placed, kind: "absent" | "under" | "over" | "ok"}
function nightTally(state, party, night) {
  var present = isPresent(party, night);
  var needed = neededOnNight(party, night);
  var placed = partySlots(state, party.id, night).length;
  var kind = "ok";
  if (!present && placed === 0) kind = "absent";
  else if (placed < needed) kind = "under";
  else if (placed > needed) kind = "over";
  return { night: night, present: present, needed: needed, placed: placed, kind: kind };
}

// nightTally for every night of the event, in event order; [] when party is null.
function partyTallies(state, party) {
  if (!party) return [];
  return state.event.nights.map(function (night) { return nightTally(state, party, night); });
}

// --- texts ---

function placesNoun(n) {
  if (n === 1) return "miesto";
  if (n >= 2 && n <= 4) return "miesta";
  return "miest";
}

function pluralPlaces(n) {
  return n + " " + placesNoun(n);
}

// "chýba" for 1 and 5+, "chýbajú" for 2 to 4.
function missingVerb(n) {
  return n >= 2 && n <= 4 ? "chýbajú" : "chýba";
}

// Short text on the signpost chip.
function tallyChipText(t) {
  if (t.kind === "absent") return "nie si tu";
  return "máš " + t.placed + "/" + t.needed + (t.kind === "under" ? " !" : "");
}

// Full sentence for screen readers (aria-label of the signpost).
function tallyLabel(t) {
  var d = Math.abs(t.placed - t.needed);
  if (t.kind === "absent") return "V túto noc tu nie si";
  if (t.kind === "under") {
    return "Máš " + pluralPlaces(t.placed) + ", potrebuješ " + t.needed + ", " + missingVerb(d) + " " + pluralPlaces(d);
  }
  if (t.kind === "over") {
    if (!t.present) return "V túto noc tu nie si, ale máš " + pluralPlaces(t.placed);
    return "Máš " + pluralPlaces(t.placed) + ", potrebuješ " + t.needed + ", o " + pluralPlaces(d) + " viac";
  }
  return "Máš " + pluralPlaces(t.placed) + ", presne toľko, koľko potrebuješ";
}

// Status of my party: the first night with missing places (red), else the first night with extra
// places (soft amber), else the selected night has a lowered need (green, "fewer"), else everything is fine.
// kind: "none" | "missing" | "extra" | "fewer" | "ok".
function myPartyStatus(state, party, night) {
  if (!party) return { kind: "none", night: null, count: 0, text: "" };
  var nights = state.event.nights, i, n;
  for (i = 0; i < nights.length; i++) {
    n = missingPlaces(state, party, nights[i]);
    if (n > 0) {
      return {
        kind: "missing", night: nights[i], count: n,
        text: capitalize(dayLocative(nights[i])) + " ti " + missingVerb(n) + " " + pluralPlaces(n)
      };
    }
  }
  for (i = 0; i < nights.length; i++) {
    n = extraPlaces(state, party, nights[i]);
    if (n > 0) {
      return { kind: "extra", night: nights[i], count: n, text: "Máš o " + pluralPlaces(n) + " viac, než potrebuješ" };
    }
  }
  if (isDayOnly(party)) return { kind: "ok", night: null, count: 0, text: "Prídeš len cez deň" };
  var lowered = placesUndoInfo(state, party, night);
  if (lowered) {
    return { kind: "fewer", night: night, count: lowered.needed, full: lowered.full, text: dayShort(night) + ": len " + lowered.needed + " z " + lowered.full };
  }
  return { kind: "ok", night: null, count: 0, text: "Všetko máš" };
}

// "Št", "So" for the day a night starts on ("" for a bad date).
function dayShort(iso) {
  var p = parseIso(iso);
  return p ? DAY_SHORT[p.dow] : "";
}

// Lines on the status board for the kinds that are buttons: "missing" has two, "fewer" one. [] for the others.
function statusBoardLines(status) {
  if (status.kind === "missing") return [dayShort(status.night) + ": " + missingVerb(status.count) + " " + status.count, "Ťukni sem ›"];
  if (status.kind === "fewer") return [status.text + " ›"];
  return [];
}

// The status sign in the bottom HUD: {kind, lines, label, action}. `action` says what a tap does:
// "places" (open the places panel), "night" (select the night), "undo" (undo „nás viac nebude“),
// "who" (open „Kto si?“) or null (kind "ok" is not a button). `selectedNight` is the night shown on the map.
function statusHud(status, selectedNight) {
  var text = status.text, kind = status.kind;
  if (kind === "missing") {
    var here = status.night === selectedNight;
    return {
      kind: kind, lines: statusBoardLines(status), action: here ? "places" : "night",
      label: text + ". Ťuknutím " + (here ? "otvoríš možnosti." : "zvolíš túto noc.")
    };
  }
  if (kind === "fewer") return { kind: kind, lines: statusBoardLines(status), action: "undo", label: text + ". Ťuknutím môžeš vrátiť plný počet." };
  if (kind === "extra") return { kind: kind, lines: [text], action: "night", label: text + ". Ťuknutím zvolíš túto noc." };
  if (kind === "ok") return { kind: kind, lines: [text], action: null, label: text };
  return { kind: "none", lines: ["Najprv vyber, kto si"], action: "who", label: "Najprv vyber, kto si. Ťuknutím to vyberieš." };
}

// The quest log (top-right HUD): one short row per night of the event for my party, in night order; `label` has
// the whole sentence for screen readers.
// [{key, kind, night, text, label, action}]. `kind` is "who" (no party chosen), "day" (day visits only), "open"
// (places missing), "done", "fewer" (all of a lowered need placed), "extra" (more than needed) or "away" (not there).
// `action` says what a tap does, as in statusHud: "who", "places", "undo", "night" or null (not a button).
// A row of the selected night opens its panel ("places" or "undo"); a row of another night selects that night.
function questRows(state, party, selectedNight) {
  if (!party) {
    return [{ key: "q-who", kind: "who", night: null, text: "Vyber, kto si",
      label: "Najprv vyber, kto si. Ťuknutím to vyberieš.", action: "who" }];
  }
  if (isDayOnly(party)) {
    return [{ key: "q-day", kind: "day", night: null, text: "Len cez deň", label: "Prídeš len cez deň", action: null }];
  }
  return state.event.nights.map(function (night) {
    var short = dayShort(night), when = capitalize(dayLocative(night)), here = night === selectedNight;
    var pick = here ? "" : " Ťuknutím zvolíš túto noc.";
    var row = { key: "q-" + night, night: night, action: "night" };
    if (!isPresent(party, night)) {
      row.kind = "away";
      row.text = short + " –";
      row.label = when + " neprídeš." + pick;
      return row;
    }
    var placed = partySlots(state, party.id, night).length, needed = neededOnNight(party, night), full = neededSlots(party);
    var miss = needed - placed;
    if (miss > 0) {
      row.kind = "open";
      row.text = short + " " + placed + "/" + needed;
      row.label = when + " ti " + missingVerb(miss) + " " + pluralPlaces(miss) + "." + (here ? " Ťuknutím otvoríš možnosti." : pick);
      if (here) row.action = "places";
    } else if (miss < 0) {
      row.kind = "extra";
      row.text = short + " " + placed + "/" + needed;
      row.label = when + " máš o " + pluralPlaces(-miss) + " viac, než potrebuješ." + pick;
    } else if (needed < full) {
      row.kind = "fewer";
      row.text = short + " len " + needed + "/" + full;
      row.label = when + " máš len " + needed + " z " + full + "." + (here ? " Ťuknutím môžeš vrátiť plný počet." : pick);
      if (here) row.action = "undo";
    } else {
      row.kind = "done";
      row.text = short + " " + placed + "/" + needed;
      row.label = when + " máš všetko (" + placed + " z " + needed + ")." + pick;
    }
    return row;
  });
}

// Nights whose quest was open in `before` and is finished (done or fewer) in `after`: for the „Úloha splnená“ message.
function questsFinished(before, after) {
  var was = {};
  (before || []).forEach(function (r) { if (r.night) was[r.night] = r.kind; });
  return after.filter(function (r) {
    return r.night && was[r.night] === "open" && (r.kind === "done" || r.kind === "fewer");
  }).map(function (r) { return r.night; });
}

// Panel for undoing „nás viac nebude“ on a night that has a lowered need, or null when it has none.
// {title, needed, full, line, primary: {label, action: {night, places}}, secondary: {label}}.
function placesUndoInfo(state, party, night) {
  if (!party || !night || !isPresent(party, night)) return null;
  var full = neededSlots(party), needed = neededOnNight(party, night);
  if (!(needed >= 1 && needed < full)) return null;
  var when = dayLocative(night);
  return {
    title: dayTitle(night), needed: needed, full: full,
    line: capitalize(when) + " potrebuješ len " + pluralPlaces(needed) + " z " + full + ".",
    primary: { label: capitalize(when) + " prídeme všetci", action: { night: night, places: full } },
    secondary: { label: "Nechať tak" }
  };
}

// „Vo štvrtok nás viac nebude“: the party has some places on a night but fewer than it needs, so it can
// lower the need to what it has. {night, places, text}, or null when it does not apply.
function fewerPlacesAction(state, party, night) {
  if (!party || !isPresent(party, night)) return null;
  var placed = partySlots(state, party.id, night).length;
  if (placed < 1 || placed >= neededOnNight(party, night)) return null;
  return { night: night, places: placed, text: capitalize(dayLocative(night)) + " nás viac nebude" };
}

// Content of the panel opened from the red status board for a night the party lacks places on.
// {title, lines: [text, text], primary: {kind: "fewer" | "edit", label, action}, secondary: {label}}, or null.
function placesPanelInfo(state, party, night) {
  if (!party || !isPresent(party, night)) return null;
  var placed = partySlots(state, party.id, night).length;
  var missing = missingPlaces(state, party, night);
  if (missing < 1) return null;
  var when = dayLocative(night);
  var verb = missingVerb(missing);
  var secondary = { label: "Ešte hľadám posteľ" };
  if (placed >= 1) {
    var action = fewerPlacesAction(state, party, night);
    return {
      title: dayTitle(night),
      lines: [
        capitalize(when) + " máš " + pluralPlaces(placed) + ", " + verb + " ti ešte " + missing + ".",
        "Ak " + when + " nebudú všetci, ťukni nižšie. Ostatné noci sa nemenia."
      ],
      primary: { kind: "fewer", label: action.text, action: action },
      secondary: secondary
    };
  }
  return {
    title: dayTitle(night),
    lines: [
      capitalize(when) + " ešte nemáš žiadne miesto, " + verb + " ti " + missing + ".",
      "Ak " + when + " nepríde nikto, uprav si príchod."
    ],
    primary: { kind: "edit", label: "Upraviť príchod a odchod", action: null },
    secondary: secondary
  };
}

// "aktualizované pred 20 s"
function updatedAgoText(thenMs, nowMs) {
  var s = Math.max(0, Math.floor((nowMs - thenMs) / 1000));
  if (s < 60) return "aktualizované pred " + s + " s";
  if (s < 3600) return "aktualizované pred " + Math.floor(s / 60) + " min";
  return "aktualizované pred " + Math.floor(s / 3600) + " h";
}

// Relative „last seen“ text of a party in „Kto si?“ (T-050). `serverNowMs` is the server's clock, not the phone's.
function seenText(lastSeenIso, serverNowMs, isOnline) {
  if (isOnline) return "online";
  var then = lastSeenIso ? Date.parse(lastSeenIso) : NaN;
  if (isNaN(then)) return "zatiaľ nevidené";
  var min = Math.max(1, Math.floor((serverNowMs - then) / 60000));
  if (min < 60) return "pred " + min + " min";
  if (min < 24 * 60) return "pred " + Math.floor(min / 60) + " h";
  return "pred " + Math.floor(min / 1440) + " d";
}

// The line under „Si: …“ in the bottom HUD: how many parties are online, mine included.
function onlineLine(presence, myPartyId) {
  // Everyone online, me included: this page is polling, so my party counts even before the server lists it.
  var online = presence && presence.online ? presence.online : [];
  var n = online.filter(function (id) { return id !== myPartyId; }).length + (myPartyId ? 1 : 0);
  if (myPartyId && n === 1) return "online: len ty";
  return n > 0 ? "online: " + n : "online: nikto";
}

// The online line, or the age of the data when the last poll failed or the data are older than 90 s.
var STALE_DATA_MS = 90000;
function hudCrestLine(o) {
  if (o.lastPollFailed || o.nowMs - o.fetchedAtMs > STALE_DATA_MS) return updatedAgoText(o.fetchedAtMs, o.nowMs);
  return onlineLine(o.presence, o.myPartyId);
}

function ellipsize(text, max) {
  text = String(text);
  return text.length <= max ? text : text.slice(0, max - 1).replace(/\s+$/, "") + "…";
}

// The first line of the status board.
function whoText(party) {
  return party ? ellipsize("Si: " + party.name, 17) : "Kto si? Ťukni sem";
}

// Greedy word wrap into at most `maxLines` lines of at most `maxChars` characters.
function wrapText(text, maxChars, maxLines) {
  var lines = [], cur = "";
  maxChars = Math.max(1, maxChars);
  String(text).split(/\s+/).filter(Boolean).forEach(function (word) {
    while (word.length > maxChars) {
      if (cur) { lines.push(cur); cur = ""; }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!cur) cur = word;
    else if ((cur + " " + word).length <= maxChars) cur += " " + word;
    else { lines.push(cur); cur = word; }
  });
  if (cur) lines.push(cur);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    var last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length >= maxChars ? last.slice(0, maxChars - 1) + "…" : last + "…";
  }
  return lines;
}
