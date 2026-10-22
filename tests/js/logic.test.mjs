// Tests of the pure page logic. They extract <script id="logic"> from static/index.html and run it
// in node:vm, with no DOM and no browser globals.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = fs.readFileSync(path.join(root, "static", "index.html"), "utf8");
const logicMatch = html.match(/<script id="logic">([\s\S]*?)<\/script>/);
assert.ok(logicMatch, "the page must have a <script id=\"logic\"> block");
const logicSource = logicMatch[1];

// An empty context: any touch of document or window would throw a ReferenceError.
const L = vm.createContext({});
vm.runInContext(logicSource, L);

// Values from the vm realm have other prototypes, so compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

// --- fixtures (the real event and a layout shaped like config/chata.yaml, 20 slots) ---

const THU = "2026-10-29", FRI = "2026-10-30", SAT = "2026-10-31";

const event = {
  name: "Chata 29. 10. – 1. 11.",
  arrive_days: [THU, FRI, SAT],
  leave_days: [FRI, SAT, "2026-11-01"],
  nights: [THU, FRI, SAT],
};

const bed = (id, name, count) => ({
  id, name, kind: "bed1", rect: [0, 0, 10, 10],
  slots: Array.from({ length: count }, (_, i) => `${id}-${i + 1}`),
});
const rooms = [
  { id: "konica-hore", name: "Konica, podkrovie", rect: [10, 26, 152, 70], floor: "#D9B98A",
    beds: [bed("konica-hore-manzelska", "Manželská posteľ", 2), bed("konica-hore-jedno", "Jednomiestna posteľ", 1)] },
  { id: "konica-dole", name: "Konica, dole", rect: [10, 96, 152, 80], floor: "#C9A67A",
    beds: [bed("konica-dole-matrace", "Matrace na zemi", 3)] },
  { id: "vlavo", name: "Izba vľavo", rect: [118, 196, 102, 124], floor: "#E8D2A6",
    beds: [bed("vlavo-manzelska", "Manželská posteľ", 2), bed("vlavo-okno", "Posteľ pod oknom", 1),
      bed("vlavo-lehatko-1", "Lehátko 1", 1), bed("vlavo-lehatko-2", "Lehátko 2", 1)] },
  { id: "chodba", name: "Chodbička", rect: [216, 196, 54, 124], floor: "#DCC59B",
    beds: [bed("chodba-gauc", "Rozkladací gauč", 2)] },
  { id: "vpravo", name: "Izba vpravo", rect: [266, 196, 106, 124], floor: "#E8D2A6",
    beds: [bed("vpravo-poschodova-1", "Poschodová 1", 2), bed("vpravo-poschodova-2", "Poschodová 2", 2),
      bed("vpravo-gauc", "Gauč", 1)] },
  { id: "kuchynka", name: "Letná kuchynka", rect: [10, 334, 100, 62], floor: "#CFD8DC",
    beds: [bed("kuchynka-pec", "Na peci", 2)] },
];
const doors = [[218, 240, 4, 20], [264, 240, 4, 20], [238, 316, 20, 4], [80, 172, 20, 6], [80, 334, 20, 4]];
const layout = { event, map: { viewbox: [380, 412], doors }, rooms };

const party = (over = {}) => ({
  id: "p-aaaaaa", name: "Ivan a Eva", adults: 2, kids: 0, kids_in_parents_bed: 0,
  arrive: THU, leave: "2026-11-01", color: "#D07A2B", ...over,
});
const stateWith = (parties, sleeping = {}) => ({ event, layout, parties, sleeping });
const hold = (id, slots) => Object.fromEntries(slots.map((s) => [s, id]));

// --- the block itself ---

test("the logic block does not touch the DOM or the browser", () => {
  assert.doesNotMatch(logicSource, /\b(document|window|localStorage|fetch|navigator)\b/);
});

// --- dates ---

test("event date text for the real event dates", () => {
  assert.equal(L.eventDateText(event), "29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)");
});

test("event date text survives missing or broken data", () => {
  assert.equal(L.eventDateText(null), "");
  assert.equal(L.eventDateText({ arrive_days: ["nonsense"], leave_days: ["2026-11-01"] }), "");
});

test("night signpost labels and dates for the three nights", () => {
  assert.deepEqual(plain(L.nightInfo(THU)), { label: "Št → Pi", dates: "29./30. 10." });
  assert.deepEqual(plain(L.nightInfo(FRI)), { label: "Pi → So", dates: "30./31. 10." });
  assert.deepEqual(plain(L.nightInfo(SAT)), { label: "So → Ne", dates: "31. 10./1. 11." });
  assert.equal(L.nightInfo("x"), null);
});

test("day locative from the date", () => {
  assert.equal(L.dayLocative(THU), "vo štvrtok");
  assert.equal(L.dayLocative(FRI), "v piatok");
  assert.equal(L.dayLocative(SAT), "v sobotu");
  assert.equal(L.dayLocative("2026-11-01"), "v nedeľu");
  assert.equal(L.dayLocative("2026-11-02"), "v pondelok");
  assert.equal(L.dayLocative("2026-11-03"), "v utorok");
  assert.equal(L.dayLocative("2026-11-04"), "v stredu");
  assert.equal(L.dayLocative("nope"), "");
});

// --- presence and needed places ---

test("a party arriving on Friday is not present on the Thursday night", () => {
  const p = party({ arrive: FRI, leave: "2026-11-01" });
  assert.equal(L.isPresent(p, THU), false);
  assert.equal(L.isPresent(p, FRI), true);
  assert.equal(L.isPresent(p, SAT), true);
});

test("the leave day is not a night of the stay", () => {
  const p = party({ arrive: THU, leave: SAT });
  assert.equal(L.isPresent(p, FRI), true);
  assert.equal(L.isPresent(p, SAT), false);
});

test("needed slots are adults + kids - kids_in_parents_bed", () => {
  assert.equal(L.neededSlots(party({ adults: 2, kids: 0 })), 2);
  assert.equal(L.neededSlots(party({ adults: 2, kids: 3, kids_in_parents_bed: 0 })), 5);
  assert.equal(L.neededSlots(party({ adults: 2, kids: 3, kids_in_parents_bed: 1 })), 4);
});

// --- layout counts ---

test("total slots come from the layout", () => {
  assert.equal(L.totalSlots(layout), 20);
  assert.equal(L.totalSlots({ rooms: [rooms[0]] }), 3);
});

test("used count per night", () => {
  const s = stateWith([party()], { [FRI]: hold("p-aaaaaa", ["vlavo-manzelska-1", "vlavo-manzelska-2"]) });
  assert.equal(L.usedCount(s, THU), 0);
  assert.equal(L.usedCount(s, FRI), 2);
});

test("slots of a party per night, in layout order", () => {
  const s = stateWith([party()], {
    [THU]: { "vlavo-manzelska-2": "p-aaaaaa", "konica-hore-jedno-1": "p-aaaaaa", "chodba-gauc-1": "p-other" },
  });
  assert.deepEqual(plain(L.partySlots(s, "p-aaaaaa", THU)), ["konica-hore-jedno-1", "vlavo-manzelska-2"]);
  assert.deepEqual(plain(L.partySlots(s, "p-aaaaaa", FRI)), []);
});

test("bed of a slot", () => {
  assert.equal(L.bedOfSlot(layout, "vlavo-okno-1").name, "Posteľ pod oknom");
  assert.equal(L.bedOfSlot(layout, "nope"), null);
});

test("doors take the floor color of the room that contains their top-left corner", () => {
  assert.deepEqual(plain(doors.map((d) => L.doorFloorColor(layout, d))),
    ["#DCC59B", "#DCC59B", "#DCC59B", "#C9A67A", "#CFD8DC"]);
  assert.equal(L.doorFloorColor(layout, [0, 0, 4, 4]), null);
});

// --- missing and extra places ---

test("missing and extra places per party and night", () => {
  const p = party({ adults: 2 });
  const s = stateWith([p], {
    [THU]: hold(p.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]),
    [FRI]: hold(p.id, ["vlavo-manzelska-1"]),
    [SAT]: hold(p.id, ["vlavo-manzelska-1", "vlavo-manzelska-2", "vlavo-okno-1"]),
  });
  assert.equal(L.missingPlaces(s, p, THU), 0);
  assert.equal(L.extraPlaces(s, p, THU), 0);
  assert.equal(L.missingPlaces(s, p, FRI), 1);
  assert.equal(L.extraPlaces(s, p, FRI), 0);
  assert.equal(L.missingPlaces(s, p, SAT), 0);
  assert.equal(L.extraPlaces(s, p, SAT), 1);
});

test("a night outside the stay needs nothing, so nothing is missing there", () => {
  const p = party({ arrive: FRI });
  assert.equal(L.missingPlaces(stateWith([p]), p, THU), 0);
});

// --- plurals and times ---

test("plural of places", () => {
  assert.equal(L.pluralPlaces(0), "0 miest");
  assert.equal(L.pluralPlaces(1), "1 miesto");
  assert.equal(L.pluralPlaces(2), "2 miesta");
  assert.equal(L.pluralPlaces(4), "4 miesta");
  assert.equal(L.pluralPlaces(5), "5 miest");
});

test("relative refresh time", () => {
  assert.equal(L.updatedAgoText(0, 20000), "aktualizované pred 20 s");
  assert.equal(L.updatedAgoText(0, 0), "aktualizované pred 0 s");
  assert.equal(L.updatedAgoText(0, 125000), "aktualizované pred 2 min");
  assert.equal(L.updatedAgoText(0, 7300000), "aktualizované pred 2 h");
  assert.equal(L.updatedAgoText(5000, 1000), "aktualizované pred 0 s");   // a clock set back
});

// --- my-party status ---

const PAIR = ["vlavo-manzelska-1", "vlavo-manzelska-2"];

test("status: no party chosen", () => {
  assert.equal(L.myPartyStatus(stateWith([]), null).kind, "none");
});

test("status: missing 1 place on Saturday is red and names the night", () => {
  const p = party({ adults: 2 });
  const s = stateWith([p], {
    [THU]: hold(p.id, PAIR), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, ["vlavo-manzelska-1"]),
  });
  assert.deepEqual(plain(L.myPartyStatus(s, p)),
    { kind: "missing", night: SAT, count: 1, text: "V sobotu vám chýba 1 miesto" });
});

test("status: the first night with missing places wins, with verb forms", () => {
  const p = party({ adults: 3 });
  const s = stateWith([p], { [FRI]: hold(p.id, ["vlavo-manzelska-1"]) });
  assert.equal(L.myPartyStatus(s, p).night, THU);
  assert.equal(L.myPartyStatus(s, p).text, "Vo štvrtok vám chýbajú 3 miesta");
  const big = party({ adults: 6, arrive: THU, leave: FRI });
  assert.equal(L.myPartyStatus(stateWith([big]), big).text, "Vo štvrtok vám chýba 6 miest");
});

test("status: 1 extra place is a soft amber note", () => {
  const p = party({ adults: 2, leave: FRI });   // present on the Thursday night only
  const s = stateWith([p], { [THU]: hold(p.id, [...PAIR, "vlavo-okno-1"]) });
  assert.deepEqual(plain(L.myPartyStatus(s, p)),
    { kind: "extra", night: THU, count: 1, text: "Máte o 1 miesto viac, než potrebujete" });
});

test("status: missing wins over extra, even when the extra night is earlier", () => {
  const p = party({ adults: 2, leave: SAT });   // Thursday and Friday nights
  const s = stateWith([p], {
    [THU]: hold(p.id, [...PAIR, "vlavo-okno-1"]),   // 1 extra on Thursday
    [FRI]: hold(p.id, ["vlavo-manzelska-1"]),      // 1 missing on Friday
  });
  const status = L.myPartyStatus(s, p);
  assert.equal(status.kind, "missing");
  assert.equal(status.night, FRI);
  assert.equal(status.text, "V piatok vám chýba 1 miesto");
});

test("status: 2 extra places use the plural form", () => {
  const p = party({ adults: 1, leave: FRI });
  const s = stateWith([p], { [THU]: hold(p.id, [...PAIR, "vlavo-okno-1"]) });
  assert.equal(L.myPartyStatus(s, p).text, "Máte o 2 miesta viac, než potrebujete");
});

test("status: everything in place", () => {
  const p = party({ adults: 2 });
  const s = stateWith([p], { [THU]: hold(p.id, PAIR), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, PAIR) });
  assert.deepEqual(plain(L.myPartyStatus(s, p)), { kind: "ok", night: null, count: 0, text: "Všetko máte" });
});

test("status: kids sleeping with the parents are not counted", () => {
  const p = party({ adults: 2, kids: 1, kids_in_parents_bed: 1 });
  const s = stateWith([p], { [THU]: hold(p.id, PAIR), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, PAIR) });
  assert.equal(L.myPartyStatus(s, p).kind, "ok");
});

// --- small text helpers ---

test("ellipsize and the first status line", () => {
  assert.equal(L.ellipsize("short", 10), "short");
  assert.equal(L.ellipsize("a very long party name", 10), "a very lo…");
  assert.equal(L.whoText(party()), "Si: Ivan a Eva");
  assert.equal(L.whoText(party({ name: "Vikto s rodinou a priateľmi" })).length, 17);
  assert.equal(L.whoText(null), "Kto si? Ťukni sem");
});

test("wrapText wraps words, breaks long words and caps the lines", () => {
  assert.deepEqual(plain(L.wrapText("V sobotu vám chýba 1 miesto", 14, 3)), ["V sobotu vám", "chýba 1 miesto"]);
  assert.deepEqual(plain(L.wrapText("abcdefghij", 4, 5)), ["abcd", "efgh", "ij"]);
  assert.deepEqual(plain(L.wrapText("one two three four", 5, 2)), ["one", "two…"]);
  assert.deepEqual(plain(L.wrapText("", 5, 2)), []);
});

// --- error texts ---

const CODES = ["bad_code", "forbidden", "signup_closed", "slot_taken", "not_present", "duplicate_name",
  "unknown_slot", "unknown_party", "invalid", "rate_limited"];

const err = (code, params = {}) => ({ code, message: "English developer note, never shown", params });

test("every server code gives a Slovak text that is not the fallback", () => {
  for (const code of CODES) {
    const text = L.errorText(err(code), stateWith([]));
    assert.ok(text.length > 0, code);
    assert.notEqual(text, L.FALLBACK_ERROR, code);
  }
});

test("slot_taken names the night and the holder", () => {
  const text = L.errorText(err("slot_taken", { night: SAT, slot: "vlavo-manzelska-1", party_id: "p-7f3k2a", party_name: "Riso a Ben" }));
  assert.equal(text, "Toto miesto má v sobotu už Riso a Ben.");
});

test("slot_taken takes the holder name from the state when the param is missing", () => {
  const s = stateWith([party({ id: "p-7f3k2a", name: "Riso a Ben" })]);
  assert.equal(L.errorText(err("slot_taken", { night: SAT, party_id: "p-7f3k2a" }), s), "Toto miesto má v sobotu už Riso a Ben.");
});

test("slot_taken for the own party says so", () => {
  const text = L.errorText(err("slot_taken", { night: FRI, party_id: "p-aaaaaa", party_name: "Ivan a Eva", own: true }));
  assert.equal(text, "Toto miesto už v piatok máte.");
});

test("params fill the other texts", () => {
  assert.equal(L.errorText(err("not_present", { night: THU, party_name: "Mrco" })),
    "Partia „Mrco“ vo štvrtok nie je na chate. Uprav príchod alebo odchod.");
  assert.equal(L.errorText(err("duplicate_name", { name: "Ivan a Eva" })),
    "Partia „Ivan a Eva“ už existuje. Vymysli iné meno.");
  assert.equal(L.errorText(err("invalid", { field: "kids_in_parents_bed" })),
    "Skontroluj pole „deti spiace s rodičmi“.");
  assert.equal(L.errorText(err("rate_limited", { retry_after: 12 })),
    "Príliš veľa pokusov za krátky čas, skús to o 12 s.");
  assert.equal(L.errorText(err("rate_limited", { retry_after: 90 })),
    "Príliš veľa pokusov za krátky čas, skús to o 2 min.");
  assert.equal(L.errorText(err("unknown_slot", { slot: "vlavo-okno-1" }), stateWith([])),
    "Miesto pri posteli „Posteľ pod oknom“ sa nedá použiť. Obnov stránku.");
});

test("a code with missing params still gives a clean sentence", () => {
  for (const code of CODES) {
    for (const params of [{}, undefined, null, { night: null, party_name: null, field: null, name: null }]) {
      const text = L.errorText({ code, message: "x", params }, null);
      assert.ok(text.length > 0, code);
      assert.doesNotMatch(text, /undefined|null|\{|\}|NaN/, `${code}: ${text}`);
    }
  }
  assert.equal(L.errorText(err("slot_taken")), "Toto miesto je už obsadené.");
  assert.equal(L.errorText(err("not_present")), "Tvoja partia v túto noc nie je na chate. Uprav príchod alebo odchod.");
  assert.equal(L.errorText(err("invalid")), "Niečo v zadaní nesedí, skontroluj ho.");
  assert.equal(L.errorText(err("invalid", { field: "constructor" })), "Niečo v zadaní nesedí, skontroluj ho.");
});

test("an unknown code or a missing error gives the fallback", () => {
  assert.equal(L.FALLBACK_ERROR, "Niečo sa nepodarilo, skús to znova.");
  assert.equal(L.errorText(err("brand_new_code"), null), L.FALLBACK_ERROR);
  assert.equal(L.errorText(err("constructor"), null), L.FALLBACK_ERROR);
  assert.equal(L.errorText(undefined, null), L.FALLBACK_ERROR);
  assert.equal(L.errorText(null, null), L.FALLBACK_ERROR);
  assert.equal(L.errorText({ message: "no code" }, null), L.FALLBACK_ERROR);
});

test("the English message never appears in the result", () => {
  const message = "Secret developer note about slot";
  for (const code of [...CODES, "unknown_thing"]) {
    assert.ok(!L.errorText({ code, message, params: { night: SAT } }, null).includes(message), code);
  }
  assert.ok(!L.errorText({ message }, null).includes(message));
});

// --- beds on the map: a layout with the real geometry of config/chata.yaml ---

const realBeds = {
  "konica-hore-manzelska": ["bed2", [28, 46, 44, 30], 2], "konica-hore-jedno": ["bed1", [118, 44, 24, 34], 1],
  "konica-dole-matrace": ["mats", [24, 132, 124, 26], 3], "vlavo-manzelska": ["bed2", [128, 220, 44, 30], 2],
  "vlavo-okno": ["bed1", [186, 220, 24, 34], 1], "vlavo-lehatko-1": ["cot", [130, 272, 20, 36], 1],
  "vlavo-lehatko-2": ["cot", [158, 272, 20, 36], 1], "chodba-gauc": ["sofa", [226, 226, 32, 58], 2],
  "vpravo-poschodova-1": ["bunk", [276, 220, 24, 42], 2], "vpravo-poschodova-2": ["bunk", [308, 220, 24, 42], 2],
  "vpravo-gauc": ["sofa1", [336, 272, 28, 36], 1], "kuchynka-pec": ["stove", [22, 352, 56, 28], 2],
};
const scene = { title: [176, 10, 196, 44], nights: [176, 60, 196, 44], notice: [176, 112, 196, 66], status: [278, 322, 94, 88],
  locked: [16, 190, 62, 56], letter: [128, 336, 44, 44], key: [184, 336, 44, 44] };
const realLayout = {
  event,
  map: { viewbox: [380, 412], doors, scene },
  rooms: rooms.map((room) => ({
    ...room,
    beds: room.beds.map((b) => {
      const [kind, rect, n] = realBeds[b.id];
      return { ...b, kind, rect, slots: b.slots.slice(0, n) };
    }),
  })),
};
const bedById = (id) => realLayout.rooms.flatMap((r) => r.beds).find((b) => b.id === id);
const realState = (parties, sleeping = {}) => ({ event, layout: realLayout, parties, sleeping });
const overlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

test("figure positions per bed kind match pos() of the approved preview", () => {
  const pos = (id) => plain(L.figurePositions(bedById(id)));
  assert.deepEqual(pos("vlavo-manzelska"), [[135, 228], [155, 228]]);                       // bed2: x+7 and x+w-17, y+8
  assert.deepEqual(pos("konica-hore-manzelska"), [[35, 54], [55, 54]]);
  assert.deepEqual(pos("vpravo-poschodova-1"), [[283, 224], [283, 244]]);                   // bunk: top and bottom
  assert.deepEqual(pos("konica-dole-matrace"), [[34, 139], [80, 139], [126, 139]]);         // mats: three in a row
  assert.deepEqual(pos("chodba-gauc"), [[237, 234], [237, 258]]);                           // sofa: one above the other
  assert.deepEqual(pos("kuchynka-pec"), [[32, 360], [58, 360]]);                            // stove
});

test("one-slot kinds get a single centred figure", () => {
  const pos = (id) => plain(L.figurePositions(bedById(id)));
  assert.deepEqual(pos("konica-hore-jedno"), [[125, 54]]);   // bed1: x+w/2-5, y+10
  assert.deepEqual(pos("vlavo-lehatko-1"), [[135, 282]]);    // cot
  assert.deepEqual(pos("vpravo-gauc"), [[345, 282]]);        // sofa1
});

test("a bed with more slots than positions reuses the last position", () => {
  assert.deepEqual(plain(L.figurePosition(bedById("vlavo-okno"), 0)), [193, 230]);
  assert.deepEqual(plain(L.figurePosition(bedById("vlavo-okno"), 3)), [193, 230]);
  assert.deepEqual(plain(L.figurePosition(bedById("vlavo-manzelska"), 1)), [155, 228]);
});

test("figures move with the bed rect from the config", () => {
  const moved = { ...bedById("vlavo-manzelska"), rect: [200, 100, 44, 30] };
  assert.deepEqual(plain(L.figurePositions(moved)), [[207, 108], [227, 108]]);
});

test("adult or kid figure per held slot (Q2)", () => {
  const family = party({ adults: 2, kids: 2, kids_in_parents_bed: 0 });
  assert.deepEqual(plain([0, 1, 2, 3].map((i) => L.figureKind(family, i))), ["adult", "adult", "kid", "kid"]);
  const mixed = party({ adults: 2, kids: 2, kids_in_parents_bed: 1 });   // one kid has no place of its own
  assert.deepEqual(plain([0, 1, 2, 3].map((i) => L.figureKind(mixed, i))), ["adult", "adult", "kid", "adult"]);
});

test("slot occupant: party and figure kind, null for a free slot", () => {
  const family = party({ adults: 1, kids: 1 });
  const s = realState([family], { [SAT]: { "vlavo-manzelska-1": family.id, "vlavo-manzelska-2": family.id } });
  assert.equal(L.slotOccupant(s, "vlavo-manzelska-1", SAT).kind, "adult");
  assert.equal(L.slotOccupant(s, "vlavo-manzelska-2", SAT).kind, "kid");
  assert.equal(L.slotOccupant(s, "vlavo-manzelska-2", SAT).party.name, "Ivan a Eva");
  assert.equal(L.slotOccupant(s, "vlavo-manzelska-1", FRI), null);
});

// --- slots to take (Q3) ---

test("a couple missing 2 on an empty double bed takes both slots", () => {
  const p = party({ adults: 2 });
  assert.deepEqual(plain(L.slotsToTake(realState([p]), p, bedById("vlavo-manzelska"), SAT)),
    ["vlavo-manzelska-1", "vlavo-manzelska-2"]);
});

test("a couple missing 2 on a double bed with 1 free takes the 1 free slot", () => {
  const p = party({ adults: 2 }), other = party({ id: "p-bbbbbb", name: "Riso a Ben" });
  const s = realState([p, other], { [SAT]: { "vlavo-manzelska-1": other.id } });
  assert.deepEqual(plain(L.slotsToTake(s, p, bedById("vlavo-manzelska"), SAT)), ["vlavo-manzelska-2"]);
});

test("a party that lacks nothing still takes 1 extra place", () => {
  const p = party({ adults: 2 });
  const s = realState([p], { [SAT]: hold(p.id, ["konica-hore-manzelska-1", "konica-hore-manzelska-2"]) });
  assert.equal(L.missingPlaces(s, p, SAT), 0);
  assert.deepEqual(plain(L.slotsToTake(s, p, bedById("vlavo-manzelska"), SAT)), ["vlavo-manzelska-1"]);
});

test("a full bed gives no slots", () => {
  const p = party({ adults: 2 }), other = party({ id: "p-bbbbbb", name: "Riso a Ben" });
  const s = realState([p, other], { [SAT]: hold(other.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]) });
  assert.deepEqual(plain(L.slotsToTake(s, p, bedById("vlavo-manzelska"), SAT)), []);
});

test("a party of 3 on three free mats takes all 3", () => {
  const p = party({ adults: 2, kids: 1 });
  assert.deepEqual(plain(L.slotsToTake(realState([p]), p, bedById("konica-dole-matrace"), SAT)),
    ["konica-dole-matrace-1", "konica-dole-matrace-2", "konica-dole-matrace-3"]);
});

test("a party already holding one of two needed places takes one more", () => {
  const p = party({ adults: 2 });
  const s = realState([p], { [SAT]: hold(p.id, ["konica-hore-jedno-1"]) });
  assert.deepEqual(plain(L.slotsToTake(s, p, bedById("vlavo-manzelska"), SAT)), ["vlavo-manzelska-1"]);
});

test("nights in which a party holds a slot", () => {
  const p = party();
  const s = realState([p], { [THU]: hold(p.id, ["vlavo-okno-1"]), [FRI]: hold("p-other", ["vlavo-okno-1"]), [SAT]: hold(p.id, ["vlavo-okno-1"]) });
  assert.deepEqual(plain(L.holdingNights(s, p.id, "vlavo-okno-1")), [THU, SAT]);
  assert.deepEqual(plain(L.holdingNights(s, p.id, "chodba-gauc-1")), []);
});

test("nights an assign for the whole stay will write", () => {
  const p = party({ arrive: THU, leave: "2026-11-01" });
  const s = realState([p], { [FRI]: hold("p-other", ["vlavo-okno-1"]) });
  assert.deepEqual(plain(L.stayNights(s, p, ["vlavo-okno-1"])), [THU, SAT]);   // Friday is taken
  const late = party({ arrive: FRI, leave: "2026-11-01" });
  assert.deepEqual(plain(L.stayNights(realState([late]), late, ["vlavo-okno-1"])), [FRI, SAT]);   // not there on Thursday
});

test("move target is the first slot free in every night of the move", () => {
  const bed = bedById("vlavo-manzelska");
  const s = realState([], { [THU]: hold("p-x", ["vlavo-manzelska-1"]), [FRI]: hold("p-y", ["vlavo-manzelska-2"]) });
  assert.equal(L.moveTarget(s, bed, [THU]), "vlavo-manzelska-2");
  assert.equal(L.moveTarget(s, bed, [FRI]), "vlavo-manzelska-1");
  assert.equal(L.moveTarget(s, bed, [THU, FRI]), null);
  assert.equal(L.moveTarget(s, bed, [SAT]), "vlavo-manzelska-1");
});

test("pending changes are drawn on top of the state without changing it", () => {
  const s = realState([party()], { [SAT]: { "vlavo-okno-1": "p-aaaaaa", "chodba-gauc-1": "p-other" } });
  const view = L.withPending(s, [
    { night: SAT, slot: "vlavo-okno-1", party_id: null },
    { night: FRI, slot: "vlavo-manzelska-1", party_id: "p-aaaaaa" },
  ]);
  assert.deepEqual(plain(view.state.sleeping), { [SAT]: { "chodba-gauc-1": "p-other" }, [FRI]: { "vlavo-manzelska-1": "p-aaaaaa" } });
  assert.deepEqual(plain(view.pending), { [`${SAT}|vlavo-okno-1`]: true, [`${FRI}|vlavo-manzelska-1`]: true });
  assert.deepEqual(plain(s.sleeping), { [SAT]: { "vlavo-okno-1": "p-aaaaaa", "chodba-gauc-1": "p-other" } });
  assert.deepEqual(plain(L.withPending(s, []).pending), {});
});

// --- bed texts ---

test("bed screen-reader label", () => {
  const room = rooms[2], bed = bedById("vlavo-manzelska");
  const p = party();
  const full = realState([p], { [SAT]: hold(p.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]) });
  assert.equal(L.bedLabel(full, room, bed, SAT), "Manželská posteľ, izba vľavo, v sobotu Ivan a Eva, 0 voľných");
  assert.equal(L.bedLabel(realState([p]), room, bed, FRI), "Manželská posteľ, izba vľavo, v piatok nikto, 2 voľné");
  const half = realState([p], { [THU]: hold(p.id, ["vlavo-manzelska-1"]) });
  assert.equal(L.bedLabel(half, room, bed, THU), "Manželská posteľ, izba vľavo, vo štvrtok Ivan a Eva, 1 voľné");
  assert.equal(L.bedLabel(realState([p]), rooms[1], bedById("konica-dole-matrace"), THU), "Matrace na zemi, konica, dole, vo štvrtok nikto, 3 voľné");
});

test("free places in Slovak", () => {
  assert.deepEqual(plain([0, 1, 2, 4, 5].map(L.freeText)), ["0 voľných", "1 voľné", "2 voľné", "4 voľné", "5 voľných"]);
});

test("assign button label says how many places it takes", () => {
  assert.equal(L.assignLabel(2), "Zapísať nás sem (2 miesta)");
  assert.equal(L.assignLabel(1), "Zapísať nás sem (1 miesto)");
  assert.equal(L.assignLabel(0), "Zapísať nás sem");
});

test("reasons and confirmations in Slovak", () => {
  assert.equal(L.notPresentText(SAT), "V sobotu nie ste na chate.");
  assert.equal(L.notPresentText(THU), "Vo štvrtok nie ste na chate.");
  assert.equal(L.releaseConfirmText("Riso a Ben"), "Toto miesto má Riso a Ben. Naozaj ho uvoľniť?");
  assert.equal(L.moveBarText("Ivan a Eva"), "Ťukni na nové miesto pre Ivan a Eva");
});

test("skipped nights of assign-stay are reported in Slovak", () => {
  assert.equal(L.skippedText([FRI]), "V piatok je to tu obsadené, tú noc sme vynechali.");
  assert.equal(L.skippedText([THU, SAT]), "Vo štvrtok a v sobotu je to tu obsadené, tie noci sme vynechali.");
  assert.equal(L.skippedText([THU, FRI, SAT]), "Vo štvrtok, v piatok a v sobotu je to tu obsadené, tie noci sme vynechali.");
  assert.equal(L.skippedText([]), "");
});

// --- move mode ---

test("move plan: one night, all nights and the two reasons it fails", () => {
  const p = party();
  const s = realState([p], { [THU]: hold(p.id, ["vlavo-okno-1"]), [SAT]: hold(p.id, ["vlavo-okno-1"]) });
  const move = { partyId: p.id, fromSlot: "vlavo-okno-1", all: false };
  const target = bedById("vlavo-manzelska");
  assert.deepEqual(plain(L.planMove(s, move, target, THU)), { nights: [THU], target: "vlavo-manzelska-1" });
  assert.deepEqual(plain(L.planMove(s, { ...move, all: true }, target, FRI)), { nights: [THU, SAT], target: "vlavo-manzelska-1" });
  // not sleeping in the old place on the selected night
  assert.equal(L.planMove(s, move, target, FRI).error, "Tú noc nespíte na pôvodnom mieste. Prepni noc alebo zvoľ „Všetky noci“.");
  // the old place is not held on any night
  assert.equal(L.planMove(s, { ...move, fromSlot: "chodba-gauc-1", all: true }, target, THU).error, L.MOVE_TEXTS.not_held);
  // no free slot in every night
  const busy = realState([p], { [THU]: { ...hold(p.id, ["vlavo-okno-1"]), ...hold("p-x", ["vlavo-manzelska-1", "vlavo-manzelska-2"]) } });
  assert.equal(L.planMove(busy, move, target, THU).error, "Tu nie je voľné miesto.");
});

test("a finger may move up to the slop during a long press", () => {
  assert.equal(L.LONG_PRESS_SLOP, 10);
  assert.equal(L.movedBeyond(100, 100, 106, 108, 10), false);   // exactly 10 px away
  assert.equal(L.movedBeyond(100, 100, 100, 100, 10), false);
  assert.equal(L.movedBeyond(100, 100, 107, 108, 10), true);
  assert.equal(L.movedBeyond(100, 100, 100, 89, 10), true);
});

// --- party form ---

test("form defaults and values of an existing party", () => {
  assert.deepEqual(plain(L.defaultPartyForm(event)),
    { name: "", adults: 2, kids: 0, kids_in_parents_bed: 0, arrive: THU, leave: "2026-11-01", arrival_time: "", note: "" });
  const p = party({ kids: 1, arrival_time: "po 18:00", note: "pes" });
  assert.deepEqual(plain(L.partyToForm(p)),
    { name: "Ivan a Eva", adults: 2, kids: 1, kids_in_parents_bed: 0, arrive: THU, leave: "2026-11-01", arrival_time: "po 18:00", note: "pes" });
});

test("party payload trims text and reads counts", () => {
  const raw = { name: "  Ivan a Eva ", adults: "2", kids: "", kids_in_parents_bed: " 1 ", arrive: THU, leave: "2026-11-01", arrival_time: " 18:00 ", note: " pes\n" };
  assert.deepEqual(plain(L.partyPayload(raw)),
    { name: "Ivan a Eva", adults: 2, kids: 0, kids_in_parents_bed: 1, arrive: THU, leave: "2026-11-01", arrival_time: "18:00", note: "pes" });
  assert.ok(Number.isNaN(L.partyPayload({ ...raw, adults: "1.5" }).adults));
  assert.ok(Number.isNaN(L.partyPayload({ ...raw, kids: "-1" }).kids));
  assert.ok(Number.isNaN(L.partyPayload({ ...raw, kids: "?" }).kids));
});

test("form pre-check names the field like the server does", () => {
  const ok = L.partyPayload({ ...L.defaultPartyForm(event), name: "Ivan a Eva" });
  assert.equal(L.checkPartyPayload(ok, event), null);
  const field = (over) => { const e = L.checkPartyPayload({ ...ok, ...over }, event); return e && e.code === "invalid" ? e.params.field : e; };
  assert.equal(field({ name: "" }), "name");
  assert.equal(field({ name: "x".repeat(61) }), "name");
  assert.equal(L.checkPartyPayload({ ...ok, name: "x".repeat(60) }, event), null);
  assert.equal(field({ adults: 21 }), "adults");
  assert.equal(field({ adults: NaN }), "adults");
  assert.equal(field({ kids: -1 }), "kids");
  assert.equal(field({ kids: 2, kids_in_parents_bed: 3 }), "kids_in_parents_bed");
  assert.equal(field({ arrive: "2026-10-28" }), "arrive");
  assert.equal(field({ leave: "2026-10-29" }), "leave");
  assert.equal(field({ arrive: SAT, leave: FRI }), "leave");
  assert.equal(field({ arrival_time: "x".repeat(61) }), "arrival_time");
  assert.equal(field({ note: "x".repeat(301) }), "note");
  assert.equal(L.checkPartyPayload({ ...ok, note: "x".repeat(300) }, event), null);
});

test("an empty party name gets its own Slovak text, other name problems the generic one", () => {
  const ok = L.partyPayload({ ...L.defaultPartyForm(event), name: "Ivan a Eva" });
  const empty = L.checkPartyPayload({ ...ok, name: "" }, event);
  assert.equal(empty.params.field, "name");
  assert.equal(L.errorText(empty), "Napíš meno partie.");
  // a whitespace-only name is trimmed to empty by partyPayload
  const blank = L.partyPayload({ ...L.defaultPartyForm(event), name: "   " });
  assert.equal(L.errorText(L.checkPartyPayload(blank, event)), "Napíš meno partie.");
  // too long: still the generic field text
  assert.equal(L.errorText(L.checkPartyPayload({ ...ok, name: "x".repeat(61) }, event)), "Skontroluj pole „meno“.");
  // a server `invalid` for the name without a reason keeps the generic text
  assert.equal(L.errorText(err("invalid", { field: "name" })), "Skontroluj pole „meno“.");
  assert.equal(L.errorText(err("invalid", { field: "leave", reason: "leave_not_after_arrive" })), "Odchod musí byť po príchode.");
});

test("form inputs and the summary textarea are at least 16 px (no iOS zoom on focus)", () => {
  const css = html.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
  const block = (start) => {
    const found = css.split("}").find((r) => r.trim().startsWith(start));
    assert.ok(found, "no CSS rule starting with " + start);
    return found;
  };
  const px = (rule) => Number(rule.match(/font-size:\s*(\d+)px/)[1]);
  assert.ok(px(block(".board input")) >= 16);
  assert.ok(px(block(".pform input, .pform select, .pform textarea")) >= 16);
  assert.ok(px(block(".summary-text { min-height")) >= 16);
});

test("form limits are the server limits", () => {
  assert.deepEqual(plain(L.PARTY_LIMITS), { name: 60, arrival_time: 60, note: 300, countMax: 20 });
  // the form takes its maxlength and min / max from these constants
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /maxlength: String\(max\)/);
  assert.match(app, /maxlength: String\(PARTY_LIMITS\.note\)/);
  assert.match(app, /min: "0", max: String\(PARTY_LIMITS\.countMax\)/);
});

test("a server error is shown next to the field it names", () => {
  assert.equal(L.errorField({ code: "invalid", params: { field: "kids_in_parents_bed" } }), "kids_in_parents_bed");
  assert.equal(L.errorField({ code: "duplicate_name", params: { field: "name", name: "Riso" } }), "name");
  assert.equal(L.errorField({ code: "invalid", params: { field: "slots" } }), "");   // not a form field
  assert.equal(L.errorField({ code: "invalid", params: {} }), "");
  assert.equal(L.errorField({ code: "invalid" }), "");
  assert.equal(L.errorField(undefined), "");
  assert.equal(L.errorText({ code: "invalid", params: { field: "kids_in_parents_bed" } }, null), "Skontroluj pole „deti spiace s rodičmi“.");
  assert.equal(L.errorText({ code: "invalid", params: { field: "leave", reason: "leave_not_after_arrive" } }, null), "Odchod musí byť po príchode.");
  assert.equal(L.errorText({ code: "duplicate_name", params: { field: "name", name: "Riso a Ben" } }, null), "Partia „Riso a Ben“ už existuje. Vymysli iné meno.");
});

test("arrive and leave options", () => {
  assert.deepEqual(plain(event.arrive_days.map(L.dayOptionText)), ["Štvrtok 29. 10.", "Piatok 30. 10.", "Sobota 31. 10."]);
  assert.equal(L.dayOptionText("2026-11-01"), "Nedeľa 1. 11.");
});

// --- slots freed by a changed stay ---

const stayState = () => {
  const p = party({ arrive: THU, leave: "2026-11-01" });
  const other = party({ id: "p-bbbbbb", name: "Riso a Ben" });
  return realState([p, other], {
    [THU]: { ...hold(p.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]), "vlavo-okno-1": other.id },
    [FRI]: hold(p.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]),
    [SAT]: { ...hold(p.id, ["vlavo-okno-1", "chodba-gauc-1"]), "vlavo-manzelska-1": other.id },
  });
};

test("leave moved from Sunday to Saturday frees Saturday", () => {
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-aaaaaa", THU, SAT)),
    [{ night: SAT, slot: "vlavo-okno-1" }, { night: SAT, slot: "chodba-gauc-1" }]);
});

test("arrive moved from Thursday to Friday frees Thursday", () => {
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-aaaaaa", FRI, "2026-11-01")),
    [{ night: THU, slot: "vlavo-manzelska-1" }, { night: THU, slot: "vlavo-manzelska-2" }]);
});

test("a longer or unchanged stay frees nothing, and other parties' slots stay", () => {
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-aaaaaa", THU, "2026-11-01")), []);
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-bbbbbb", THU, FRI)), [{ night: SAT, slot: "vlavo-manzelska-1" }]);
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-bbbbbb", FRI, SAT)), [{ night: THU, slot: "vlavo-okno-1" }, { night: SAT, slot: "vlavo-manzelska-1" }]);
});

test("freed places are listed per night with the bed name", () => {
  const s = stayState();
  assert.deepEqual(plain(L.freedLines(s, L.freedByStay(s, "p-aaaaaa", FRI, SAT))), ["Vo štvrtok: Manželská posteľ (2 miesta)", "V sobotu: Posteľ pod oknom, Rozkladací gauč"]);
  assert.deepEqual(plain(L.freedLines(s, [])), []);
  assert.equal(L.FREED_TEXTS.ask, "Skrátením pobytu sa uvoľnia tieto miesta:");
});

// --- the WhatsApp summary and the hidden summary ---

const summaryState = () => {
  const ivan = party(), riso = party({ id: "p-bbbbbb", name: "Riso a Ben", adults: 1, kids: 1, color: "#2F7D6D" });
  const late = party({ id: "p-cccccc", name: "Jana", adults: 1, arrive: FRI, leave: "2026-11-01", color: "#6D5BA8" });
  return realState([ivan, riso, late], {
    [THU]: { ...hold(ivan.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]), "konica-dole-matrace-1": riso.id },
    [FRI]: { "vlavo-manzelska-1": ivan.id, "chodba-gauc-1": late.id },
    [SAT]: { ...hold(ivan.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]), "vlavo-okno-1": riso.id, "vlavo-lehatko-1-1": riso.id, "konica-hore-jedno-1": late.id },
  });
};

test("summary text for a sample state", () => {
  const expected = [
    "Chata 29. 10. – 1. 11.",
    "29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)",
    "",
    "Št → Pi (29./30. 10.), obsadené 3 z 20",
    "Konica, podkrovie: nikto",
    "Konica, dole: Riso a Ben (2 voľné)",
    "Izba vľavo: Ivan a Eva (3 voľné)",
    "Chodbička: nikto",
    "Izba vpravo: nikto",
    "Letná kuchynka: nikto",
    "",
    "Pi → So (30./31. 10.), obsadené 2 z 20",
    "Konica, podkrovie: nikto",
    "Konica, dole: nikto",
    "Izba vľavo: Ivan a Eva (4 voľné)",
    "Chodbička: Jana (1 voľné)",
    "Izba vpravo: nikto",
    "Letná kuchynka: nikto",
    "",
    "So → Ne (31. 10./1. 11.), obsadené 5 z 20",
    "Konica, podkrovie: Jana (2 voľné)",
    "Konica, dole: nikto",
    "Izba vľavo: Ivan a Eva, Riso a Ben (1 voľné)",
    "Chodbička: nikto",
    "Izba vpravo: nikto",
    "Letná kuchynka: nikto",
    "",
    "Chýbajú miesta:",
    "- Ivan a Eva: v piatok chýba 1 miesto",
    "- Riso a Ben: vo štvrtok chýba 1 miesto, v piatok chýbajú 2 miesta",
    "",
    "Tu sa zapíšeš: https://chata.example/",
  ].join("\n");
  assert.equal(L.summaryText(summaryState(), "https://chata.example/"), expected);
});

test("summary text has no warnings when everybody has a place, and never a code", () => {
  const p = party({ adults: 1, arrive: THU, leave: FRI });
  const text = L.summaryText(realState([p], { [THU]: { "vlavo-okno-1": p.id } }), "https://chata.example/");
  assert.doesNotMatch(text, /Chýbajú/);
  assert.match(text, /Tu sa zapíšeš: https:\/\/chata\.example\/$/);
  assert.doesNotMatch(text, /kód|code/i);
});

test("hidden summary for the selected night", () => {
  const h = L.hiddenSummary(summaryState(), SAT);
  assert.equal(h.title, "Chata 29. 10. – 1. 11.");
  assert.equal(h.dates, "29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)");
  assert.deepEqual(plain(h.instructions), ["Ťukni na posteľ a zapíš sa.", "Voľné miesto bliká.", "Presunúť sa dá cez posteľ."]);
  assert.equal(h.night, "Noc So → Ne (31. 10./1. 11.), obsadené 5 z 20");
  assert.deepEqual(plain(h.rooms.map((r) => r.name)), rooms.map((r) => r.name));
  const left = h.rooms.find((r) => r.name === "Izba vľavo");
  assert.deepEqual(plain(left.beds.map((b) => [b.name, b.text])), [
    ["Manželská posteľ", "Ivan a Eva"], ["Posteľ pod oknom", "Riso a Ben"], ["Lehátko 1", "Riso a Ben"], ["Lehátko 2", "voľné"],
  ]);
  const top = h.rooms[0];
  assert.deepEqual(plain(top.beds.map((b) => b.text)), ["voľné", "Jana"]);
});

test("the WhatsApp text and the hidden summary give the same parties per bed and night as the slot data", () => {
  const s = summaryState();
  const lines = L.summaryText(s, "https://chata.example/").split("\n");
  s.event.nights.forEach((night) => {
    const hidden = L.hiddenSummary(s, night);
    const start = lines.findIndex((line) => line.startsWith(L.nightInfo(night).label));
    s.layout.rooms.forEach((room, ri) => {
      const roomNames = [];
      room.beds.forEach((bed, bi) => {
        // the expectation comes straight from the slot data the map draws from
        const expected = [];
        bed.slots.forEach((slot) => {
          const id = (s.sleeping[night] || {})[slot];
          if (id && !expected.includes(s.parties.find((p) => p.id === id).name)) expected.push(s.parties.find((p) => p.id === id).name);
        });
        assert.deepEqual(plain(hidden.rooms[ri].beds[bi].names), expected, `${night} ${bed.id} (hidden)`);
        assert.equal(hidden.rooms[ri].beds[bi].free, bed.slots.filter((slot) => !(s.sleeping[night] || {})[slot]).length);
        expected.forEach((name) => { if (!roomNames.includes(name)) roomNames.push(name); });
      });
      const line = lines[start + 1 + ri];
      assert.ok(line.startsWith(`${room.name}: ${roomNames.length ? roomNames.join(", ") : "nikto"}`), `${night} ${room.id} (text): ${line}`);
    });
  });
});

// --- hit areas ---

test("growRect grows into free space up to the caps", () => {
  const caps = { up: 8, down: 8, left: 8, right: 8 };
  assert.deepEqual(plain(L.growRect([50, 50, 20, 20], [], caps, null)), [42, 42, 36, 36]);
  assert.deepEqual(plain(L.growRect([50, 50, 20, 20], [], { up: 8, down: 8, left: 0, right: 0 }, null)), [50, 42, 20, 36]);
});

test("growRect takes the whole gap to a board and half of the gap to a neighbouring bed", () => {
  const caps = { up: 20, down: 20, left: 20, right: 20 };
  const board = { rect: [0, 0, 200, 40], shared: false };      // 10 above the rect
  const bedNext = { rect: [90, 50, 20, 20], shared: true };    // 20 to the right
  assert.deepEqual(plain(L.growRect([50, 50, 20, 20], [board], caps, null)), [30, 40, 60, 50]);
  assert.deepEqual(plain(L.growRect([50, 50, 20, 20], [bedNext], caps, null)), [30, 30, 50, 60]);
});

test("growRect stops for a rect that touches or overlaps, and stays inside the bounds", () => {
  const caps = { up: 8, down: 8, left: 8, right: 8 };
  assert.deepEqual(plain(L.growRect([50, 50, 20, 20], [{ rect: [60, 60, 30, 30], shared: false }], caps, null)), [50, 50, 20, 20]);
  assert.deepEqual(plain(L.growRect([50, 50, 20, 20], [{ rect: [70, 50, 10, 20], shared: false }], caps, null)), [42, 42, 28, 36]);
  assert.deepEqual(plain(L.growRect([3, 2, 10, 10], [], caps, [100, 100])), [0, 0, 21, 20]);
});

test("signpost hit area reaches into the grass gaps of the real layout", () => {
  assert.deepEqual(plain(L.nightsHit(realLayout, 8)), [176, 54, 196, 58]);
});

test("a far neighbour does not stretch the signpost hit area, and a room is never covered", () => {
  const moved = { ...realLayout, map: { ...realLayout.map, scene: { ...scene, notice: [176, 330, 196, 66], title: [176, 10, 196, 10] } } };
  assert.deepEqual(plain(L.nightsHit(moved, 8)), [176, 52, 196, 60]);   // 8 up and 8 down, not down to y=330
  const close = { ...moved, rooms: [{ ...rooms[3], rect: [176, 107, 100, 50], beds: [] }] };
  assert.deepEqual(plain(L.nightsHit(close, 8)), [176, 52, 196, 55]);   // stops 3 units above the room
});

test("bed hit areas contain the bed, never overlap each other or a scene board", () => {
  const all = realLayout.rooms.flatMap((r) => r.beds);
  const hits = all.map((b) => [b, L.bedHit(realLayout, b, 8)]);
  hits.forEach(([b, hit]) => {
    assert.ok(hit[0] <= b.rect[0] && hit[1] <= b.rect[1] && hit[0] + hit[2] >= b.rect[0] + b.rect[2] && hit[1] + hit[3] >= b.rect[1] + b.rect[3], b.id);
    assert.ok(hit[2] <= b.rect[2] + 16 && hit[3] <= b.rect[3] + 16, `${b.id} grew by more than the cap`);
    Object.values(scene).forEach((r) => assert.ok(!overlap(hit, r), `${b.id} overlaps a scene board`));
  });
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) assert.ok(!overlap(hits[i][1], hits[j][1]), `${hits[i][0].id} overlaps ${hits[j][0].id}`);
  }
});

test("a bed hit area follows the bed rect from the config", () => {
  assert.deepEqual(plain(L.bedHit(realLayout, bedById("vlavo-okno"), 8)), [179, 212, 39, 50]);   // half the gap to its neighbours
  const moved = { ...realLayout, rooms: realLayout.rooms.map((r) => ({ ...r, beds: r.beds.map((b) => (b.id === "vlavo-okno" ? { ...b, rect: [20, 250, 24, 34] } : b)) })) };
  assert.deepEqual(plain(L.bedHit(moved, moved.rooms[2].beds[1], 8)), [12, 246, 40, 46]);   // stops at the locked sign above
});

test("diagonal neighbours do not get overlapping hit areas", () => {
  const caps = { up: 8, down: 8, left: 8, right: 8 };
  const a = [0, 0, 20, 20], b = [24, 30, 20, 20];      // 4 apart across, 10 apart down
  const ga = L.growRect(a, [{ rect: b, shared: true }], caps, null), gb = L.growRect(b, [{ rect: a, shared: true }], caps, null);
  assert.ok(!overlap(ga, gb));
  const fixed = L.growRect(a, [{ rect: b, shared: false }], caps, null);
  assert.ok(!overlap(fixed, b));
});

// --- the page file itself ---

test("page: language, viewport and zoom", () => {
  assert.match(html, /<html lang="sk">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.doesNotMatch(html, /user-scalable/);
  assert.doesNotMatch(html, /maximum-scale/);
});

test("page: no unsafe HTML sinks, and the server message is never read", () => {
  assert.doesNotMatch(html, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(html, /\.message\b/);
});

test("page: API paths are relative", () => {
  assert.doesNotMatch(html, /["'`]\/api\//);
  assert.match(html, /"api\/join"/);
  assert.match(html, /"api\/state"/);
});

test("page: no header, list view or overview switch", () => {
  assert.doesNotMatch(html, /<header|<nav|Zoznam/);
});

test("page: no bed, room or slot geometry or names are hardcoded in the page code", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(app + logicSource, /konica|vlavo|vpravo|chodba|kuchynka|manzelska|matrace/i);
});

test("page: blinking has a reduced-motion rule and the free square is white or orange", () => {
  assert.match(html, /@keyframes blink/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  assert.match(html, /tight: "#E0A33A"/);
});

// --- map zoom ---

const SW = 380, SH = 412;
const SB = { x: 0, y: 0, w: SW, h: SH };    // the bounds of a viewport that is exactly the scene
const BOX = { left: 10, top: 20, width: 380, height: 412 };    // the svg on screen at 1x, one px per unit
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg || ""} ${a} != ${b}`);

test("zoom: the whole view is 1x and not zoomed; its viewBox text is the scene", () => {
  const v = plain(L.wholeView(SB));
  assert.deepEqual(v, { x: 0, y: 0, w: 380, h: 412 });
  assert.equal(L.viewZoom(v, SB), 1);
  assert.equal(L.isZoomed(v, SB), false);
  assert.equal(L.viewBoxText(v), "0 0 380 412");
});

test("zoom: clampView keeps the aspect ratio, 1x to 4x, and stays inside the scene", () => {
  const tooFar = plain(L.clampView({ x: -50, y: 900, w: 10, h: 10 }, SB));
  near(tooFar.w, 95);
  near(tooFar.h, 103);
  near(tooFar.x, 0);
  near(tooFar.y, SH - 103);
  const tooWide = plain(L.clampView({ x: 30, y: 30, w: 900, h: 900 }, SB));
  assert.deepEqual(tooWide, { x: 0, y: 0, w: 380, h: 412 });
  const right = plain(L.clampView({ x: 400, y: 0, w: 190, h: 206 }, SB));
  near(right.x, 190);
  assert.equal(L.ZOOM_MAX, 4);
});

test("zoom: zoomView keeps the point under the cursor in place", () => {
  const whole = L.wholeView(SB);
  const v = plain(L.zoomView(whole, SB, 2, 100, 150));
  near(v.w, 190);
  near(v.h, 206);
  // the point (100, 150) sits at the same fraction of the window as before
  near((100 - v.x) / v.w, 100 / 380);
  near((150 - v.y) / v.h, 150 / 412);
  assert.equal(L.isZoomed(v, SB), true);
  // zooming in again around another point
  const v2 = plain(L.zoomView(v, SB, 2, 120, 160));
  near((120 - v2.x) / v2.w, (120 - v.x) / v.w);
  near((160 - v2.y) / v2.h, (160 - v.y) / v.h);
});

test("zoom: zoomView is clamped at 1x and at about 4x", () => {
  let v = L.wholeView(SB);
  for (let i = 0; i < 20; i++) v = L.zoomView(v, SB, 1.5, 200, 200);
  near(v.w, 95);
  near(L.viewZoom(v, SB), 4);
  for (let i = 0; i < 20; i++) v = L.zoomView(v, SB, 1 / 1.5, 200, 200);
  assert.deepEqual(plain(v), { x: 0, y: 0, w: 380, h: 412 });
  // zooming out at 1x changes nothing, also at a corner
  assert.deepEqual(plain(L.zoomView(L.wholeView(SB), SB, 0.5, 379, 411)), { x: 0, y: 0, w: 380, h: 412 });
});

test("zoom: panView and dragView move the window and never leave the scene", () => {
  const z = L.zoomView(L.wholeView(SB), SB, 2, 190, 206);
  assert.deepEqual(plain(z), { x: 95, y: 103, w: 190, h: 206 });
  assert.deepEqual(plain(L.panView(z, SB, 20, -30)), { x: 115, y: 73, w: 190, h: 206 });
  assert.deepEqual(plain(L.panView(z, SB, 999, 999)), { x: 190, y: 206, w: 190, h: 206 });
  assert.deepEqual(plain(L.panView(z, SB, -999, -999)), { x: 0, y: 0, w: 190, h: 206 });
  // dragging the map right by 38 screen px (the svg is 380 px wide) moves the window left by 19 units
  const d = plain(L.dragView(z, SB, BOX, 38, 0));
  near(d.x, 95 - 19);
  near(d.y, 103);
  // at 1x there is nowhere to go
  assert.deepEqual(plain(L.dragView(L.wholeView(SB), SB, BOX, 80, 80)), { x: 0, y: 0, w: 380, h: 412 });
});

test("zoom: scenePoint maps a screen point into the window", () => {
  const whole = L.wholeView(SB);
  assert.deepEqual(plain(L.scenePoint(whole, BOX, 10, 20)), { x: 0, y: 0 });
  assert.deepEqual(plain(L.scenePoint(whole, BOX, 200, 226)), { x: 190, y: 206 });
  const z = { x: 95, y: 103, w: 190, h: 206 };
  assert.deepEqual(plain(L.scenePoint(z, BOX, 200, 226)), { x: 95 + 95, y: 103 + 103 });
});

test("zoom: a pinch zooms around the fingers' midpoint and pans with them", () => {
  const whole = L.wholeView(SB);
  // fingers 100 px apart spread to 200 px, midpoint stays at screen (200, 226) = scene (190, 206)
  const spread = plain(L.pinchView(whole, SB, BOX,
    { x: 200, y: 226, dist: 100 }, { x: 200, y: 226, dist: 200 }));
  assert.deepEqual(spread, { x: 95, y: 103, w: 190, h: 206 });
  // the same spread with the midpoint off center keeps the scene point under it
  const off = plain(L.pinchView(whole, SB, BOX,
    { x: 110, y: 120, dist: 100 }, { x: 110, y: 120, dist: 200 }));
  const p0 = L.scenePoint(whole, BOX, 110, 120), p1 = L.scenePoint(off, BOX, 110, 120);
  near(p1.x, p0.x);
  near(p1.y, p0.y);
  // moving both fingers without a distance change only pans
  const z = { x: 95, y: 103, w: 190, h: 206 };
  const moved = plain(L.pinchView(z, SB, BOX, { x: 200, y: 226, dist: 100 }, { x: 240, y: 226, dist: 100 }));
  near(moved.w, 190);
  near(moved.x, 95 - 20);     // 40 px right = 20 units left at 2x
  near(moved.y, 103);
  // pinching in past 1x stops at the whole scene; a zero distance changes nothing
  assert.deepEqual(plain(L.pinchView(z, SB, BOX, { x: 200, y: 226, dist: 200 }, { x: 200, y: 226, dist: 10 })),
    { x: 0, y: 0, w: 380, h: 412 });
  assert.deepEqual(plain(L.pinchView(z, SB, BOX, { x: 1, y: 1, dist: 0 }, { x: 1, y: 1, dist: 50 })), z);
});

test("zoom: wheelFactor zooms in for a negative delta, out for a positive one, and pinch is stronger", () => {
  assert.ok(L.wheelFactor(-100, 0, false) > 1);
  assert.ok(L.wheelFactor(100, 0, false) < 1);
  near(L.wheelFactor(-30, 0, false) * L.wheelFactor(30, 0, false), 1);
  assert.equal(L.wheelFactor(0, 0, false), 1);
  assert.ok(L.wheelFactor(-5, 0, true) > L.wheelFactor(-5, 0, false));
  // line mode counts like pixels, and one huge event cannot jump the whole range
  assert.ok(L.wheelFactor(-3, 1, false) > 1.05);
  assert.ok(L.wheelFactor(-100000, 0, false) <= Math.exp(0.2) + 1e-9);
});

test("zoom: revealRect pans the least that shows the rectangle", () => {
  const z = { x: 100, y: 100, w: 95, h: 103 };
  // already visible: unchanged
  assert.deepEqual(plain(L.revealRect(z, SB, [120, 120, 20, 20], 6)), z);
  // to the right and below: the window moves so that the rect plus margin touches the edge
  const r = plain(L.revealRect(z, SB, [250, 250, 20, 20], 6));
  near(r.x, 250 + 20 + 6 - 95);
  near(r.y, 250 + 20 + 6 - 103);
  // to the left and above
  const l = plain(L.revealRect(z, SB, [40, 30, 20, 20], 6));
  near(l.x, 34);
  near(l.y, 24);
  // never leaves the scene
  const edge = plain(L.revealRect(z, SB, [370, 400, 10, 10], 6));
  near(edge.x, 380 - 95);
  near(edge.y, 412 - 103);
  // a rectangle bigger than the window is shown from its corner
  const big = plain(L.revealRect({ x: 0, y: 0, w: 95, h: 103 }, SB, [150, 150, 200, 200], 6));
  near(big.x, 150);
  near(big.y, 150);
});

test("zoom: viewBoxText rounds to three decimals and joins with spaces", () => {
  assert.equal(L.viewBoxText({ x: 1 / 3, y: 2.5, w: 95, h: 103.00049 }), "0.333 2.5 95 103");
});

test("zoom: non-finite input never corrupts the view (iOS gesture events have no coordinates)", () => {
  const whole = { x: 0, y: 0, w: 380, h: 412 };
  const z = { x: 95, y: 103, w: 190, h: 206 };
  for (const bad of [NaN, undefined, Infinity, "x"]) {
    assert.deepEqual(plain(L.clampView({ x: bad, y: 0, w: 190, h: 206 }, SB)), whole);
    assert.deepEqual(plain(L.clampView({ x: 0, y: 0, w: bad, h: 206 }, SB)), whole);
    // a bad point zooms around the center of the visible area
    const v = plain(L.zoomView(z, SB, 1.5, bad, bad));
    assert.ok(Object.values(v).every(Number.isFinite), JSON.stringify(v));
    near(v.x + v.w / 2, 190);
    near(v.y + v.h / 2, 206);
    assert.deepEqual(plain(L.zoomView(z, SB, bad, 100, 100)), z);
    assert.deepEqual(plain(L.panView(z, SB, bad, 5)), z);
    assert.deepEqual(plain(L.pinchView(z, SB, BOX, { x: bad, y: 1, dist: 10 }, { x: 1, y: 1, dist: 20 })), z);
    assert.deepEqual(plain(L.pinchView(z, SB, BOX, { x: 1, y: 1, dist: bad }, { x: 1, y: 1, dist: 20 })), z);
    assert.deepEqual(plain(L.revealRect(z, SB, [bad, 0, 10, 10], 6)), z);
  }
  assert.equal(L.viewBoxText(L.zoomView(L.wholeView(SB), SB, 1.2, NaN, NaN)), "31.667 34.333 316.667 343.333");
  // a garbage view (even from a bug) can never reach the viewBox text as NaN
  assert.equal(L.viewBoxText(L.clampView({ x: NaN, y: NaN, w: NaN, h: NaN }, SB)), "0 0 380 412");
  assert.equal(L.viewBoxText(L.clampView(undefined, SB)), "0 0 380 412");
});

test("page: the map is zoomed through the viewBox, with no CSS transform and a way back", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(html, /transform\s*:\s*scale|\.style\.transform/);
  assert.match(app, /setAttribute\("viewBox", viewBoxText\(/);
  assert.match(html, /shape-rendering": "crispEdges"/);
  assert.match(app, /addEventListener\("wheel", [\s\S]*passive: false/);
  assert.match(html, /#scene svg \{[^}]*touch-action: none;/);
  // two fingers must not become a page scroll: non-passive touch listeners cancel them
  assert.match(app, /addEventListener\("touchstart", holdTwoFingers, \{ passive: false \}\)/);
  assert.match(app, /addEventListener\("touchmove", holdTwoFingers, \{ passive: false \}\)/);
  assert.match(app, /e\.touches\.length >= 2 && e\.cancelable\) e\.preventDefault\(\)/);
  // the button's accessible name contains its visible text
  assert.match(app, /"aria-label": "Celá mapa – zobraziť celú mapu"[^;]*"Celá mapa"/);
  assert.match(html, /#scene svg:focus-visible \{ outline:/);
});

// --- full-screen map: the bounds follow the viewport ---

// The scene's on-screen rectangle for bounds b in a viewport of vw x vh px (the svg fills the viewport).
const sceneOnScreen = (b, vw, vh) => {
  const s = vw / b.w;
  return { left: -b.x * s, top: -b.y * s, right: (SW - b.x) * s, bottom: (SH - b.y) * s, scale: s };
};

test("fit: a viewport of the scene's own shape needs no grass", () => {
  assert.deepEqual(plain(L.fitBounds(380, 412, SW, SH)), SB);
  const b = plain(L.fitBounds(760, 824, SW, SH));
  near(b.x, 0); near(b.y, 0); near(b.w, 380); near(b.h, 412);
});

test("fit: a tall phone gets grass above and below, the scene centered at full width", () => {
  const b = plain(L.fitBounds(390, 750, SW, SH));
  const s = 390 / 380;
  near(b.w, 380);
  near(b.h, 750 / s);
  near(b.x, 0);
  near(b.y, -((750 - 412 * s) / 2) / s);
  near(b.y + b.h, SH - b.y);       // the same amount of grass below as above
  assert.ok(b.y < 0 && b.y + b.h > SH);
  // the viewport and the bounds have the same aspect ratio
  near(b.w / b.h, 390 / 750);
});

test("fit: a landscape phone and a wide desktop get grass left and right, the scene whole and centered", () => {
  for (const [vw, vh] of [[750, 390], [1280, 800], [3000, 300]]) {
    const b = plain(L.fitBounds(vw, vh, SW, SH));
    near(b.h, SH);
    near(b.y, 0);
    near(b.w / b.h, vw / vh);
    assert.ok(b.x < 0 && b.x + b.w > SW, `${vw}x${vh}`);
    near(b.x + b.w - SW, -b.x);   // centered
  }
  const d = plain(L.fitBounds(1280, 800, SW, SH));
  near(d.w, 1280 / 800 * 412);
});

test("fit: the scene stays inside the safe area and is centered in it", () => {
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const b = plain(L.fitBounds(390, 844, SW, SH, insets));
  const r = sceneOnScreen(b, 390, 844);
  near(r.left, 0);
  near(r.right, 390);
  assert.ok(r.top >= 47 - 1e-6 && r.bottom <= 844 - 34 + 1e-6);
  near(r.top - 47, 844 - 34 - r.bottom);
  // the bounds still cover the whole viewport (grass behind the status bar and the toolbar)
  near(b.w / b.h, 390 / 844);
  // landscape with a notch on the left and the home bar: the scene clears the side insets
  const land = sceneOnScreen(plain(L.fitBounds(844, 390, SW, SH, { top: 0, right: 47, bottom: 21, left: 47 })), 844, 390);
  assert.ok(land.left >= 47 - 1e-6 && land.right <= 844 - 47 + 1e-6 && land.bottom <= 390 - 21 + 1e-6);
  // insets that leave no room, or are garbage, are ignored
  assert.deepEqual(plain(L.fitBounds(380, 412, SW, SH, { top: 300, bottom: 300, left: NaN, right: -5 })), SB);
});

test("fit: a bad viewport falls back to the scene", () => {
  for (const bad of [0, -1, NaN, undefined, Infinity]) {
    assert.deepEqual(plain(L.fitBounds(bad, 700, SW, SH)), SB);
    assert.deepEqual(plain(L.fitBounds(390, bad, SW, SH)), SB);
  }
});

test("fit: zoom 1x is the whole extended bounds, and zoom and pan are clamped to them", () => {
  const B = L.fitBounds(390, 750, SW, SH);          // grass above and below
  const whole = L.wholeView(B);
  assert.deepEqual(plain(whole), plain(B));
  assert.equal(L.isZoomed(whole, B), false);
  near(L.viewZoom(whole, B), 1);
  // zoom in around a point on the grass and out again
  let v = L.zoomView(whole, B, 2, 190, B.y + 5);
  near(L.viewZoom(v, B), 2);
  near(v.w / v.h, B.w / B.h);
  assert.ok(v.y >= B.y - 1e-9 && v.x >= B.x - 1e-9);
  // panning stops at the bounds, not at the scene
  const far = plain(L.panView(v, B, -999, -999));
  near(far.x, B.x); near(far.y, B.y);
  const farEnd = plain(L.panView(v, B, 999, 999));
  near(farEnd.x + farEnd.w, B.x + B.w);
  near(farEnd.y + farEnd.h, B.y + B.h);
  assert.ok(far.y < 0 && farEnd.y + farEnd.h > SH, "the grass beyond the scene can be reached");
  // 4x of the extended view is the limit, 1x the other
  for (let i = 0; i < 30; i++) v = L.zoomView(v, B, 1.5, 190, 206);
  near(L.viewZoom(v, B), 4);
  for (let i = 0; i < 30; i++) v = L.zoomView(v, B, 1 / 1.5, 190, 206);
  for (const k of ["x", "y", "w", "h"]) near(v[k], whole[k], k);
  assert.equal(L.isZoomed(v, B), false);
  // a pinch and a drag stay inside the bounds too
  const box = { left: 0, top: 0, width: 390, height: 750 };
  const p = plain(L.pinchView(whole, B, box, { x: 195, y: 375, dist: 100 }, { x: 195, y: 375, dist: 400 }));
  near(L.viewZoom(p, B), 4);
  const d = plain(L.dragView(p, B, box, 5000, 5000));
  near(d.x, B.x); near(d.y, B.y);
  const still = plain(L.dragView(whole, B, box, 80, 80));    // nowhere to go at 1x
  for (const k of ["x", "y", "w", "h"]) near(still[k], whole[k], k);
  // revealRect keeps a bed inside the bounds
  const r = plain(L.revealRect(L.zoomView(whole, B, 4, 0, 0), B, [300, 400, 20, 10], 6));
  assert.ok(r.x + r.w <= B.x + B.w + 1e-9 && r.y + r.h <= B.y + B.h + 1e-9);
  assert.ok(r.x <= 300 && r.x + r.w >= 320);
});

test("fit: a resize keeps the view valid: whole stays whole, a zoomed view keeps zoom and center", () => {
  const portrait = L.fitBounds(390, 750, SW, SH), landscape = L.fitBounds(750, 390, SW, SH);
  assert.deepEqual(plain(L.refitView(L.wholeView(portrait), portrait, landscape)), plain(L.wholeView(landscape)));
  const z = L.zoomView(L.wholeView(portrait), portrait, 2.5, 100, 120);
  const rotated = plain(L.refitView(z, portrait, landscape));
  near(L.viewZoom(rotated, landscape), 2.5);
  near(rotated.w / rotated.h, landscape.w / landscape.h);
  near(rotated.x + rotated.w / 2, z.x + z.w / 2);
  near(rotated.y + rotated.h / 2, z.y + z.h / 2);
  assert.ok(rotated.x >= landscape.x - 1e-9 && rotated.y >= landscape.y - 1e-9);
  assert.ok(rotated.x + rotated.w <= landscape.x + landscape.w + 1e-9 && rotated.y + rotated.h <= landscape.y + landscape.h + 1e-9);
  // a center near an edge that the new bounds do not have is pulled back inside
  const corner = L.zoomView(L.wholeView(portrait), portrait, 4, portrait.x, portrait.y);
  const back = plain(L.refitView(corner, portrait, landscape));
  assert.ok(back.x >= landscape.x - 1e-9 && back.y >= landscape.y - 1e-9);
  // garbage in, whole view out
  assert.deepEqual(plain(L.refitView(undefined, portrait, landscape)), plain(L.wholeView(landscape)));
  assert.deepEqual(plain(L.refitView({ x: NaN, y: 0, w: 50, h: 50 }, portrait, landscape)), plain(L.wholeView(landscape)));
});

test("page: the map fills the viewport (fixed full-height scene, safe areas, grass beyond the scene)", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(html, /#scene \{ position: fixed; left: 0; top: 0; width: 100%; height: 100vh; height: 100dvh; \}/);
  assert.match(html, /body \{[^}]*overflow: hidden;/);
  assert.match(html, /<meta name="theme-color" content="#8E9B48">/);
  assert.match(html, /\.zoom-reset \{[^}]*safe-area-inset-bottom/);
  assert.match(html, /#toast \{[^}]*safe-area-inset-bottom/);
  assert.match(html, /\.movebar \{[^}]*position: fixed;[^}]*safe-area-inset-top/);
  assert.match(app, /fitBounds\(r\.width, r\.height, W, H, readInsets\(\)\)/);
  assert.match(app, /new ResizeObserver\(/);
  assert.match(app, /addEventListener\("resize", onResize\)/);
  assert.match(app, /drawGround\(app\.layers\.ground, nb\)/);
});

test("page: autumn palette and the loading leaf (T-012)", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.ok(!html.includes("79B35A"));
  assert.match(html, /--bg: #EFE5D3;/);
  assert.match(html, /--bg: #1A1410;/);
  assert.match(html, /<p id="bootText">Načítavam…<\/p>/);
  assert.match(html, /<div id="boot"[\s\S]*?<svg[^>]*aria-hidden="true"[^>]*shape-rendering="crispEdges"/);
  assert.ok(!/\$\("boot"\)\.textContent/.test(app));
  assert.match(app, /\$\("bootText"\)\.textContent = "Nepodarilo sa načítať/);
  assert.ok(!/innerHTML/.test(app.replace(/\/\/.*$/gm, "")));
});

test("page: every leafFall keyframe sets its own scaleX and the animation uses step-end (T-012)", () => {
  assert.match(html, /animation: leafFall [\d.]+s step-end infinite/);
  const body = html.match(/@keyframes leafFall \{([\s\S]*?)\n\}/)[1];
  const frames = [...body.matchAll(/([\d.]+)% \{([^}]*)\}/g)];
  assert.ok(frames.length >= 9);
  for (const [, pct, decl] of frames) {
    assert.match(decl, /transform: translate\([^)]*\) scaleX\((-1|1)\)/, `frame ${pct}%`);
  }
  assert.deepEqual(frames.slice(0, 8).map((f) => Number(f[1])), [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5]);
});

test("fit: an extra top inset the size of the move bar keeps the whole scene below it, in every orientation", () => {
  const BAR = 97;
  for (const [vw, vh] of [[750, 390], [667, 375], [1280, 800], [390, 750]]) {
    const b = plain(L.fitBounds(vw, vh, SW, SH, { top: BAR }));
    const r = sceneOnScreen(b, vw, vh);
    assert.ok(r.top >= BAR - 1e-6, `${vw}x${vh}: scene top ${r.top}`);
    assert.ok(r.bottom <= vh + 1e-6 && r.left >= -1e-6 && r.right <= vw + 1e-6, `${vw}x${vh}`);
    near(b.w / b.h, vw / vh);      // the bounds still cover the whole viewport
  }
  // landscape: without the bar the scene starts at the top, with it the scene shrinks to fit under it
  const without = sceneOnScreen(plain(L.fitBounds(750, 390, SW, SH)), 750, 390);
  const withBar = sceneOnScreen(plain(L.fitBounds(750, 390, SW, SH, { top: BAR })), 750, 390);
  near(without.top, 0);
  assert.ok(withBar.scale < without.scale);
  // taking the bar away again returns the same bounds, and a zoomed view survives both changes
  const on = L.fitBounds(750, 390, SW, SH, { top: BAR }), off = L.fitBounds(750, 390, SW, SH);
  const z = L.zoomView(L.wholeView(off), off, 2, 190, 206);
  const zz = plain(L.refitView(L.refitView(z, off, on), on, off));
  near(L.viewZoom(zz, off), 2);
  near(zz.x + zz.w / 2, z.x + z.w / 2);
  near(zz.y + zz.h / 2, z.y + z.h / 2);
});

test("page: the move bar's height is a top inset while it shows, and the scene refits when it shows or hides", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /if \(!bar\.hidden && bar\.offsetHeight > top\) top = bar\.offsetHeight;/);
  assert.match(app, /observer\.observe\(moveBar\)/);
  assert.match(app, /if \(app\.refit\) app\.refit\(\);/);
  // panels: no overscroll chaining, a long sheet stays below the status bar, a tall code board scrolls from its top
  assert.match(html, /html \{[^}]*overscroll-behavior: none;/);
  assert.doesNotMatch(html, /body \{[^}]*overscroll-behavior/);
  assert.match(html, /\.sheet \{[^}]*max-height: calc\(88dvh - env\(safe-area-inset-top, 0px\)\);[^}]*overscroll-behavior: contain;/);
  assert.match(html, /\.code-screen \{[^}]*overscroll-behavior: contain;/);
  assert.match(html, /\.board \{[^}]*margin: auto;/);
  assert.doesNotMatch(html, /\.code-screen \{[^}]*align-items: center/);
});
