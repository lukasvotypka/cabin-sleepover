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
  assert.equal(L.bedLabel(realState([p]), rooms[0], bedById("konica-dole-matrace"), THU), "Matrace na zemi, konica, podkrovie, vo štvrtok nikto, 3 voľné");
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
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
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
