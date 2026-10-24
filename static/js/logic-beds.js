// Pure page logic, part 2: beds, figures, people waiting on the meadow, the walk to a bed, move mode.
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).

// --- beds, figures and slot actions ---

// Where the figure of each slot of a bed stands, ported from `pos()` of the approved preview.
// Offsets are from the bed rect; kinds without a special layout (bed1, sofa1, cot) get one figure.
function figurePositions(bed) {
  var x = bed.rect[0], y = bed.rect[1], w = bed.rect[2];
  switch (bed.kind) {
    case "bed2": return [[x + 7, y + 8], [x + w - 17, y + 8]];
    case "mats": return [[x + 10, y + 7], [x + 56, y + 7], [x + 102, y + 7]];
    case "bunk": return [[x + 7, y + 4], [x + 7, y + 24]];
    case "sofa": return [[x + 11, y + 8], [x + 11, y + 32]];
    case "stove": return [[x + 10, y + 8], [x + 36, y + 8]];
    default: return [[x + w / 2 - 5, y + 10]];
  }
}

// The pipe of a stove: a small square on its right side, outside the stove body. It sticks out sideways
// so that it never reaches up into the room name above the stove.
function stovePipeRect(bed) {
  var r = bed.rect;
  return [r[0] + r[2] - 2, r[1] + 4, 8, 8];
}

// The box that the furniture of a bed really covers, in map units: the union, on all four sides, of
// the bed rect, every mat (mats are spaced 46 apart and 32 wide, see `drawFurniture`) and the stove
// pipe. The hit area and the figures use `bed.rect` itself.
function furnitureBounds(bed) {
  var r = bed.rect, parts = [r], i;
  if (bed.kind === "mats") {
    for (i = 0; i < bed.slots.length; i++) parts.push([r[0] + i * 46, r[1], 32, r[3]]);
  }
  if (bed.kind === "stove") parts.push(stovePipeRect(bed));
  var x1 = Math.min.apply(null, parts.map(function (p) { return p[0]; }));
  var y1 = Math.min.apply(null, parts.map(function (p) { return p[1]; }));
  var x2 = Math.max.apply(null, parts.map(function (p) { return p[0] + p[2]; }));
  var y2 = Math.max.apply(null, parts.map(function (p) { return p[1] + p[3]; }));
  return [x1, y1, x2 - x1, y2 - y1];
}

// The outline of a house: the union rect of its rooms, [x, y, w, h]. `house.rooms` are room ids and
// `rooms` is the layout's room list. Returns null for a house without any known room.
function houseOutline(house, rooms) {
  var parts = rooms.filter(function (r) { return house.rooms.indexOf(r.id) >= 0; }).map(function (r) { return r.rect; });
  if (!parts.length) return null;
  var x1 = Math.min.apply(null, parts.map(function (p) { return p[0]; }));
  var y1 = Math.min.apply(null, parts.map(function (p) { return p[1]; }));
  var x2 = Math.max.apply(null, parts.map(function (p) { return p[0] + p[2]; }));
  var y2 = Math.max.apply(null, parts.map(function (p) { return p[1] + p[3]; }));
  return [x1, y1, x2 - x1, y2 - y1];
}

// The roof of a house outline as a stepped trapezoid that sits directly on its top edge (T-029): ROOF_ROWS rows
// of ROOF_ROW_H px, from the bottom row (the house width plus ROOF_OVERHANG px on each side) up to the top row
// (ROOF_TOP_INSET px narrower on each side). Returns the rows bottom first as {x, y, w, i}; the last one is the
// ridge. `chimneyRect` is the 6x10 chimney standing on that roof, near x `chimneyX`, and it reaches 4 px above it.
var ROOF_ROWS = 8, ROOF_ROW_H = 2, ROOF_OVERHANG = 4, ROOF_TOP_INSET = 16;
var CHIMNEY_W = 6, CHIMNEY_H = 10, CHIMNEY_RISE = 4;
function roofRows(outline) {
  var rows = [], x0 = outline[0] - ROOF_OVERHANG, width = outline[2] + 2 * ROOF_OVERHANG, i;
  for (i = 0; i < ROOF_ROWS; i++) {
    var inset = Math.round(i * ROOF_TOP_INSET / (ROOF_ROWS - 1) / ROOF_ROW_H) * ROOF_ROW_H;
    rows.push({ x: x0 + inset, y: outline[1] - ROOF_ROW_H * (i + 1), w: width - 2 * inset, i: i });
  }
  return rows;
}
function roofRect(outline) {
  return [outline[0] - ROOF_OVERHANG, outline[1] - ROOF_ROWS * ROOF_ROW_H, outline[2] + 2 * ROOF_OVERHANG, ROOF_ROWS * ROOF_ROW_H];
}
function chimneyRect(outline, chimneyX) {
  return [chimneyX, outline[1] - ROOF_ROWS * ROOF_ROW_H - CHIMNEY_RISE, CHIMNEY_W, CHIMNEY_H];
}

// The band of a room that its name occupies (text baseline at 16 units below the top of the room,
// 11 px type: about 9 units of ascent and 2 of descent). Furniture must stay out of it.
function roomLabelBand(room) {
  var r = room.rect;
  return [r[0] + 7, r[1] + 7, r[2] - 14, 11];
}

// The figure of slot number `index` of a bed. A bed with more slots than positions reuses the last one.
function figurePosition(bed, index) {
  var list = figurePositions(bed);
  return list[Math.min(index, list.length - 1)];
}

// Adult or kid figure for the party's `index`-th slot on a night (slots in layout order, Q2): the first
// `adults` are adults, then the kids who need their own place, and any extra place is an adult again.
// Kids who sleep with their parents have no slot, so they have no figure.
function figureKind(party, index) {
  var kidsOwnBed = Math.max(0, party.kids - party.kids_in_parents_bed);
  return index >= party.adults && index < party.adults + kidsOwnBed ? "kid" : "adult";
}

// {party, kind} for who sleeps in a slot on a night, or null for a free slot. `party` is null for an
// id that is not in the state.
function slotOccupant(state, slot, night) {
  var id = ((state.sleeping && state.sleeping[night]) || {})[slot];
  if (!id) return null;
  var party = partyById(state, id);
  var kind = party ? figureKind(party, partySlots(state, id, night).indexOf(slot)) : "adult";
  return { party: party, kind: kind };
}

// --- people waiting on the meadow ---

var MEADOW_FIG_W = 10;   // width of the adult sprite (drawFigure)
var MEADOW_FIG_H = 12;   // height of the adult sprite
var MEADOW_GAP = 4;      // grass between two waiting figures

// The waiting figures of my party on a night: [{kind: "adult" | "kid"}], one per missing place, in slot
// order (see figureKind). [] when party is null or not present that night.
function waitingFigures(state, party, night) {
  if (!party || !isPresent(party, night)) return [];
  var placed = partySlots(state, party.id, night).length;
  var count = missingPlaces(state, party, night);
  var out = [];
  for (var k = 0; k < count; k++) out.push({ kind: figureKind(party, placed + k) });
  return out;
}

// Where `count` figures stand in the meadow rect: one row, centred, integer coordinates (crisp pixels).
// count <= capacity: {cells: [[x, y], ...count], more: 0, morePos: null}
// count >  capacity: {cells: the first capacity - 1 cells, more: count - (capacity - 1), morePos: the last cell}
function meadowLayout(rect, count) {
  var capacity = Math.max(1, Math.floor((rect[2] + MEADOW_GAP) / (MEADOW_FIG_W + MEADOW_GAP)));
  if (!(count > 0)) return { cells: [], more: 0, morePos: null };
  var shown = Math.min(count, capacity);
  var width = shown * MEADOW_FIG_W + (shown - 1) * MEADOW_GAP;
  var x0 = rect[0] + Math.floor((rect[2] - width) / 2);
  var y = rect[1] + Math.floor((rect[3] - MEADOW_FIG_H) / 2);
  var cells = [];
  for (var i = 0; i < shown; i++) cells.push([x0 + i * (MEADOW_FIG_W + MEADOW_GAP), y]);
  if (count <= capacity) return { cells: cells, more: 0, morePos: null };
  return { cells: cells.slice(0, capacity - 1), more: count - (capacity - 1), morePos: cells[capacity - 1] };
}

// --- the walk from the meadow to the bed (T-017) ---

var WALK_MS = 3000;    // the whole walk from the meadow to the bed

// How far along the walk is: 0 ... 1 after `elapsed` ms of `ms`, with a gentle ease-in-out (smoothstep).
// Clamped, so before the start it is 0 and after the end (or with a bad duration) it is 1.
function walkProgress(elapsed, ms) {
  if (!(ms > 0)) return 1;
  if (!(elapsed > 0)) return 0;
  if (elapsed >= ms) return 1;
  var t = elapsed / ms;
  return t * t * (3 - 2 * t);
}

// The point at progress `t` (0 ... 1) of the straight walk from `from` to `to` ([x, y]), rounded to whole
// scene pixels so the pixel art stays crisp. t = 0 is exactly `from` and t = 1 exactly `to`.
function walkPosition(from, to, t) {
  if (!(t > 0)) return [from[0], from[1]];
  if (!(t < 1)) return [to[0], to[1]];
  return [Math.round(from[0] + (to[0] - from[0]) * t), Math.round(from[1] + (to[1] - from[1]) * t)];
}

// The walks for one assign on `night`: stateBefore is the view before the tap, stateAfter the view with
// the new pending ops. For the i-th slot of `slots` the figure starts at the i-th meadow cell (or at the
// "+N" badge when the meadow overflows) and ends at its place in the bed. `kind` is what will stand in
// the bed, so nothing swaps at landing. [] when party is null or had no waiting figures.
function walkers(stateBefore, stateAfter, party, bed, slots, night, meadowRect) {
  if (!party) return [];
  var waiting = waitingFigures(stateBefore, party, night).length;
  if (!waiting) return [];
  var spot = meadowLayout(meadowRect, waiting), out = [];
  slots.forEach(function (slot, i) {
    var from = i < spot.cells.length ? spot.cells[i] : i < waiting ? spot.morePos : null;
    var who = slotOccupant(stateAfter, slot, night);
    if (!from || !who) return;
    out.push({ slot: slot, from: from, to: figurePosition(bed, bed.slots.indexOf(slot)), kind: who.kind, color: party.color });
  });
  return out;
}

// Screen-reader label of the meadow group, "" for 0.
function meadowLabel(count) {
  if (!(count > 0)) return "";
  var word = count === 1 ? "čaká 1 človek" : count < 5 ? "čakajú " + count + " ľudia" : "čaká " + count + " ľudí";
  return "Na lúke " + word + " z vás bez postele";
}

function isFreeSlot(state, slot, night) {
  return !((state.sleeping && state.sleeping[night]) || {})[slot];
}

// The slots one tap on a bed takes for my party on a night (Q3): the first free slots of the bed in
// config order. The count is what the party still lacks that night, at least 1, and at most what is free.
function slotsToTake(state, party, bed, night) {
  var free = bed.slots.filter(function (slot) { return isFreeSlot(state, slot, night); });
  var want = Math.max(1, missingPlaces(state, party, night));
  return free.slice(0, Math.min(want, free.length));
}

// The nights in which the party holds a slot (used by move with all nights), in event order.
function holdingNights(state, partyId, slot) {
  return state.event.nights.filter(function (night) {
    return ((state.sleeping && state.sleeping[night]) || {})[slot] === partyId;
  });
}

// The nights an assign for the whole stay will probably write: present, and every slot free.
// The server decides; this only draws the pending figures.
function stayNights(state, party, slots) {
  return state.event.nights.filter(function (night) {
    return isPresent(party, night) && slots.every(function (slot) { return isFreeSlot(state, slot, night); });
  });
}

// The first slot of a bed that is free in every one of the nights (the target of a move), or null.
function moveTarget(state, bed, nights) {
  for (var i = 0; i < bed.slots.length; i++) {
    var slot = bed.slots[i];
    if (nights.every(function (night) { return isFreeSlot(state, slot, night); })) return slot;
  }
  return null;
}

// The state with unconfirmed changes drawn on top: ops are {night, slot, party_id} and party_id null
// frees the slot. Returns {state, pending} where pending holds the "night|slot" keys of the ops.
function withPending(state, ops) {
  var sleeping = {}, pending = {};
  Object.keys(state.sleeping || {}).forEach(function (night) {
    sleeping[night] = Object.assign({}, state.sleeping[night]);
  });
  ops.forEach(function (op) {
    var held = sleeping[op.night] || (sleeping[op.night] = {});
    if (op.party_id) held[op.slot] = op.party_id;
    else delete held[op.slot];
    pending[op.night + "|" + op.slot] = true;
  });
  return { state: Object.assign({}, state, { sleeping: sleeping }), pending: pending };
}

function lowerFirst(text) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

// Who sleeps in a bed on a night: the party names in slot order (each once) and the number of free slots.
// The map, the screen-reader labels, the WhatsApp text and the hidden summary all read this.
function bedOccupants(state, bed, night) {
  var names = [], free = 0;
  bed.slots.forEach(function (slot) {
    var who = slotOccupant(state, slot, night);
    if (!who) { free++; return; }
    var name = who.party ? who.party.name : UNKNOWN_PARTY;
    if (names.indexOf(name) === -1) names.push(name);
  });
  return { names: names, free: free };
}

// The same for a whole room: the names over all its beds (each once) and the free slots.
function roomOccupants(state, room, night) {
  var names = [], free = 0;
  room.beds.forEach(function (bed) {
    var o = bedOccupants(state, bed, night);
    free += o.free;
    o.names.forEach(function (name) {
      if (names.indexOf(name) === -1) names.push(name);
    });
  });
  return { names: names, free: free };
}

// "0 voľných", "1 voľné", "3 voľné", "5 voľných"
function freeText(n) {
  return n + (n >= 1 && n <= 4 ? " voľné" : " voľných");
}

// Screen-reader label of a bed for a night, e.g. "Manželská posteľ, izba vľavo, v sobotu Ivan a Eva, 0 voľných".
function bedLabel(state, room, bed, night) {
  var o = bedOccupants(state, bed, night);
  return bed.name + ", " + lowerFirst(room.name) + ", " + dayLocative(night) + " " +
    (o.names.length ? o.names.join(", ") : "nikto") + ", " + freeText(o.free);
}

// "Zapísať sem „Meno“ (2 miesta)": names the party so it's clear who is signing up.
// Falls back to "Zapísať nás sem" when no party is chosen yet.
function assignLabel(count, partyName) {
  var base = partyName ? "Zapísať sem „" + partyName + "“" : "Zapísať nás sem";
  return count > 0 ? base + " (" + pluralPlaces(count) + ")" : base;
}

// "A", "A a B", "A, B a C"
function joinList(items) {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " a " + items[items.length - 1];
}

// Why the assign actions are off when my party is not at the cabin on the night.
function notPresentText(night) {
  return capitalize(dayLocative(night)) + " nie si na chate.";
}

// Shown in the bed panel when the selected party already has everything it needs that night, so the
// tap about to happen would add an extra place — usually a sign the wrong party is still selected.
function enoughAlreadyText(partyName) {
  return "„" + partyName + "“ už má dosť miest. Ak zapisuješ niekoho iného, ťukni na „Som niekto iný“.";
}

// Nights `assign-stay` left out because a slot was taken.
function skippedText(nights) {
  var when = nights.map(dayLocative);
  if (!when.length) return "";
  return capitalize(joinList(when)) + " je to tu obsadené, " + (when.length === 1 ? "tú noc" : "tie noci") + " sme vynechali.";
}

function releaseConfirmText(partyName) {
  return "Toto miesto má " + partyName + ". Naozaj ho uvoľniť?";
}

function moveBarText(partyName) {
  return "Ťukni na nové miesto pre " + partyName;
}

// --- move mode ---

var MOVE_TEXTS = {
  not_held: "Tú noc na pôvodnom mieste nespíš. Prepni noc alebo zvoľ „Všetky noci“.",
  no_free: "Tu nie je voľné miesto."
};

// What a tap on `bed` does in move mode: {nights, target}, or {error} with the Slovak reason. `move` is
// {partyId, fromSlot, all}; a single-night move uses `night`, an all-nights move the nights the party holds.
function planMove(state, move, bed, night) {
  var held = holdingNights(state, move.partyId, move.fromSlot);
  var nights = move.all ? held : [night];
  if (!nights.length || nights.some(function (n) { return held.indexOf(n) === -1; })) return { error: MOVE_TEXTS.not_held };
  var target = moveTarget(state, bed, nights);
  if (!target) return { error: MOVE_TEXTS.no_free };
  return { nights: nights, target: target };
}

// True when a finger moved farther than `limit` px: a long press then turns into a scroll or drag.
function movedBeyond(x0, y0, x1, y1, limit) {
  var dx = x1 - x0, dy = y1 - y0;
  return dx * dx + dy * dy > limit * limit;
}
