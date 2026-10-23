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
    { kind: "missing", night: SAT, count: 1, text: "V sobotu ti chýba 1 miesto" });
});

test("status: the first night with missing places wins, with verb forms", () => {
  const p = party({ adults: 3 });
  const s = stateWith([p], { [FRI]: hold(p.id, ["vlavo-manzelska-1"]) });
  assert.equal(L.myPartyStatus(s, p).night, THU);
  assert.equal(L.myPartyStatus(s, p).text, "Vo štvrtok ti chýbajú 3 miesta");
  const big = party({ adults: 6, arrive: THU, leave: FRI });
  assert.equal(L.myPartyStatus(stateWith([big]), big).text, "Vo štvrtok ti chýba 6 miest");
});

test("status: 1 extra place is a soft amber note", () => {
  const p = party({ adults: 2, leave: FRI });   // present on the Thursday night only
  const s = stateWith([p], { [THU]: hold(p.id, [...PAIR, "vlavo-okno-1"]) });
  assert.deepEqual(plain(L.myPartyStatus(s, p)),
    { kind: "extra", night: THU, count: 1, text: "Máš o 1 miesto viac, než potrebuješ" });
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
  assert.equal(status.text, "V piatok ti chýba 1 miesto");
});

test("status: 2 extra places use the plural form", () => {
  const p = party({ adults: 1, leave: FRI });
  const s = stateWith([p], { [THU]: hold(p.id, [...PAIR, "vlavo-okno-1"]) });
  assert.equal(L.myPartyStatus(s, p).text, "Máš o 2 miesta viac, než potrebuješ");
});

test("status: everything in place", () => {
  const p = party({ adults: 2 });
  const s = stateWith([p], { [THU]: hold(p.id, PAIR), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, PAIR) });
  assert.deepEqual(plain(L.myPartyStatus(s, p)), { kind: "ok", night: null, count: 0, text: "Všetko máš" });
});

test("status: kids sleeping with the parents are not counted", () => {
  const p = party({ adults: 2, kids: 1, kids_in_parents_bed: 1 });
  const s = stateWith([p], { [THU]: hold(p.id, PAIR), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, PAIR) });
  assert.equal(L.myPartyStatus(s, p).kind, "ok");
});

// --- night tally (chips on the night signposts) ---

const tallyOf = (s, p, night) => plain(L.nightTally(s, p, night));

test("tally: under, over, ok and absent kinds with placed and needed", () => {
  const p = party({ adults: 3, leave: SAT });   // Thursday and Friday nights
  const s = stateWith([p], {
    [THU]: hold(p.id, PAIR),                                   // 2 of 3
    [FRI]: hold(p.id, [...PAIR, "vlavo-okno-1", "vlavo-lehatko-1-1"]),   // 4 of 3
  });
  assert.deepEqual(tallyOf(s, p, THU), { night: THU, present: true, needed: 3, placed: 2, kind: "under" });
  assert.deepEqual(tallyOf(s, p, FRI), { night: FRI, present: true, needed: 3, placed: 4, kind: "over" });
  assert.deepEqual(tallyOf(s, p, SAT), { night: SAT, present: false, needed: 0, placed: 0, kind: "absent" });
  const full = stateWith([p], { [THU]: hold(p.id, [...PAIR, "vlavo-okno-1"]) });
  assert.deepEqual(tallyOf(full, p, THU), { night: THU, present: true, needed: 3, placed: 3, kind: "ok" });
});

test("tally: kids in the parents' bed lower the needed places", () => {
  const p = party({ adults: 2, kids: 1, kids_in_parents_bed: 1 });
  const s = stateWith([p], { [THU]: hold(p.id, PAIR) });
  const t = L.nightTally(s, p, THU);
  assert.equal(t.needed, 2);
  assert.equal(t.kind, "ok");
  assert.equal(L.tallyChipText(t), "máš 2/2");
});

test("tally: not present but holding a slot is over", () => {
  const p = party({ adults: 2, leave: FRI });
  const s = stateWith([p], { [FRI]: hold(p.id, ["vlavo-okno-1"]) });
  const t = L.nightTally(s, p, FRI);
  assert.equal(t.kind, "over");
  assert.equal(t.present, false);
  assert.equal(L.tallyChipText(t), "máš 1/0");
  assert.equal(L.tallyLabel(t), "V túto noc tu nie si, ale máš 1 miesto");
});

test("tally: all chip texts", () => {
  const t = (kind, placed, needed) => ({ night: THU, present: true, needed, placed, kind });
  assert.equal(L.tallyChipText(t("under", 2, 3)), "máš 2/3 !");
  assert.equal(L.tallyChipText(t("over", 4, 3)), "máš 4/3");
  assert.equal(L.tallyChipText(t("ok", 3, 3)), "máš 3/3");
  assert.equal(L.tallyChipText({ night: THU, present: false, needed: 0, placed: 0, kind: "absent" }), "nie si tu");
});

test("tally: all label sentences with plural forms", () => {
  const t = (kind, placed, needed, present = true) => ({ night: THU, present, needed, placed, kind });
  assert.equal(L.tallyLabel(t("under", 2, 3)), "Máš 2 miesta, potrebuješ 3, chýba 1 miesto");
  assert.equal(L.tallyLabel(t("under", 0, 2)), "Máš 0 miest, potrebuješ 2, chýbajú 2 miesta");
  assert.equal(L.tallyLabel(t("under", 1, 6)), "Máš 1 miesto, potrebuješ 6, chýba 5 miest");
  assert.equal(L.tallyLabel(t("over", 4, 3)), "Máš 4 miesta, potrebuješ 3, o 1 miesto viac");
  assert.equal(L.tallyLabel(t("over", 5, 3)), "Máš 5 miest, potrebuješ 3, o 2 miesta viac");
  assert.equal(L.tallyLabel(t("over", 1, 0, false)), "V túto noc tu nie si, ale máš 1 miesto");
  assert.equal(L.tallyLabel(t("ok", 3, 3)), "Máš 3 miesta, presne toľko, koľko potrebuješ");
  assert.equal(L.tallyLabel(t("absent", 0, 0, false)), "V túto noc tu nie si");
});

test("tally: partyTallies has one entry per event night, in order, and [] for null", () => {
  const p = party({ adults: 2, leave: FRI });
  const s = stateWith([p]);
  assert.deepEqual(plain(L.partyTallies(s, p)).map((t) => t.night), [THU, FRI, SAT]);
  assert.deepEqual(plain(L.partyTallies(s, p)).map((t) => t.kind), ["under", "absent", "absent"]);
  assert.deepEqual(plain(L.partyTallies(s, null)), []);
});

test("tally: under and over agree with missingPlaces and extraPlaces on every night", () => {
  const a = party({ adults: 3, leave: SAT });
  const b = party({ id: "p-bbbbbb", name: "Riso", adults: 2, kids: 1, kids_in_parents_bed: 1, arrive: FRI });
  const c = party({ id: "p-cccccc", name: "Mia", adults: 1, arrive: SAT, leave: "2026-11-01" });
  const s = stateWith([a, b, c], {
    [THU]: { ...hold(a.id, PAIR), ...hold(c.id, ["vlavo-okno-1"]) },   // c holds a slot before arriving
    [FRI]: { ...hold(a.id, [...PAIR, "vlavo-okno-1", "vlavo-lehatko-1-1"]), ...hold(b.id, ["konica-dole-matrace-1"]) },
    [SAT]: hold(b.id, ["konica-dole-matrace-1", "konica-dole-matrace-2"]),
  });
  for (const p of [a, b, c]) {
    for (const night of s.event.nights) {
      const t = L.nightTally(s, p, night);
      assert.equal(t.kind === "under", L.missingPlaces(s, p, night) > 0, `${p.name} ${night} under`);
      assert.equal(t.kind === "over", L.extraPlaces(s, p, night) > 0, `${p.name} ${night} over`);
    }
  }
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
  assert.deepEqual(plain(L.wrapText("V sobotu ti chýba 1 miesto", 14, 3)), ["V sobotu ti", "chýba 1 miesto"]);
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
  assert.equal(text, "Toto miesto už v piatok máš.");
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
  locked: [16, 190, 62, 56], letter: [128, 336, 44, 44], key: [184, 336, 44, 44],
  legend: [24, 264, 44, 44], meadow: [112, 381, 124, 14] };
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
  assert.equal(L.notPresentText(SAT), "V sobotu nie si na chate.");
  assert.equal(L.notPresentText(THU), "Vo štvrtok nie si na chate.");
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
  assert.equal(L.planMove(s, move, target, FRI).error, "Tú noc na pôvodnom mieste nespíš. Prepni noc alebo zvoľ „Všetky noci“.");
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

// --- „Kto je kto“ legend ---

test("peopleText: adults, kids and kids sleeping with the parents", () => {
  const p = (adults, kids = 0, kids_in_parents_bed = 0) => L.peopleText({ adults, kids, kids_in_parents_bed });
  assert.equal(p(1), "1 dospelý");
  assert.equal(p(3), "3 dospelí");
  assert.equal(p(5), "5 dospelých");
  assert.equal(p(0), "0 dospelých");
  assert.equal(p(2, 1), "2 dospelí, 1 dieťa");
  assert.equal(p(2, 2), "2 dospelí, 2 deti");
  assert.equal(p(2, 5), "2 dospelí, 5 detí");
  assert.equal(p(2, 2, 1), "2 dospelí, 2 deti (1 spí s rodičmi)");
  assert.equal(p(2, 3, 2), "2 dospelí, 3 deti (2 spia s rodičmi)");
  assert.equal(p(2, 5, 5), "2 dospelí, 5 detí (5 spí s rodičmi)");
});

test("stayText: short weekday and date, across months, raw fallback", () => {
  assert.equal(L.stayText({ arrive: THU, leave: "2026-11-01" }), "Št 29. 10. – Ne 1. 11.");
  assert.equal(L.stayText({ arrive: FRI, leave: SAT }), "Pi 30. 10. – So 31. 10.");
  assert.equal(L.stayText({ arrive: "nonsense", leave: SAT }), "nonsense – So 31. 10.");
});

test("legendRows: one row per party in state order, party colour, mine only for my party", () => {
  const parties = [
    { id: "p-aaaaaa", name: "Riso a Ben", color: "#2F7D6D", adults: 2, kids: 1, kids_in_parents_bed: 0, arrive: THU, leave: "2026-11-01" },
    { id: "p-bbbbbb", name: "Eva", color: "#D07A2B", adults: 1, kids: 0, kids_in_parents_bed: 0, arrive: FRI, leave: SAT }
  ];
  const rows = plain(L.legendRows({ parties }, "p-bbbbbb"));
  assert.deepEqual(rows, [
    { id: "p-aaaaaa", name: "Riso a Ben", color: "#2F7D6D", people: "2 dospelí, 1 dieťa", stay: "Št 29. 10. – Ne 1. 11.", mine: false, ch: "R", ink: "#F4EBD0" },
    { id: "p-bbbbbb", name: "Eva", color: "#D07A2B", people: "1 dospelý", stay: "Pi 30. 10. – So 31. 10.", mine: true, ch: "E", ink: "#2E1F14" }
  ]);
  assert.ok(plain(L.legendRows({ parties }, null)).every((r) => r.mine === false));
  assert.deepEqual(plain(L.legendRows({ parties: [] }, "p-aaaaaa")), []);
});

test("legendRows: the shirt letter loses the diacritic and the ink follows the colour", () => {
  const parties = [{ id: "p-cccccc", name: "Šimon a Ela", color: "#6D5BA8", adults: 2, kids: 0, kids_in_parents_bed: 0, arrive: THU, leave: SAT }];
  const [row] = plain(L.legendRows({ parties }, null));
  assert.equal(row.ch, "S");
  assert.equal(row.ink, "#F4EBD0");
});

// --- the letter on a figure's shirt (T-018) ---

const PALETTE = ["#2F7D6D", "#D07A2B", "#6D5BA8", "#C08A1E", "#3E6FB0", "#9C4A7A", "#5E8A2E", "#8A6A4A", "#2E8AA0", "#C0603A", "#7A7F2B", "#A04848"];

test("shirtChar: first letter or digit without diacritics, else the dot", () => {
  const cases = [
    ["Novákovci", "N"], ["  ivan a Eva", "I"], ["Šimon", "S"], ["Ľubo", "L"], ["Ďuro", "D"], ["Ôsmi", "O"],
    ["S\u030Cimon", "S"], ["„Bratia“", "B"], ["😀 Novákovci", "N"], ["4 kamaráti", "4"], ["ßeta", "S"],
    ["😀", "·"], ["", "·"], ["   ", "·"], ["Łukasz", "·"], ["Ωmega", "·"], ["Яна", "·"]
  ];
  cases.forEach(([name, ch]) => assert.equal(L.shirtChar(name), ch, JSON.stringify(name)));
  assert.equal(L.shirtChar(null), "·");
  assert.equal(L.shirtChar(undefined), "·");
});

test("PIXEL_FONT: 37 distinct 3 x 5 glyphs", () => {
  const keys = Object.keys(L.PIXEL_FONT).sort();
  const expected = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", "·"].sort();
  assert.deepEqual(keys, expected);
  assert.equal(keys.length, 37);
  const seen = new Set();
  keys.forEach((k) => {
    const rows = plain(L.PIXEL_FONT[k]);
    assert.equal(rows.length, 5, k);
    rows.forEach((r) => assert.match(r, /^[#.]{3}$/, k));
    assert.ok(rows.join("").includes("#"), k);
    seen.add(rows.join("|"));
  });
  assert.equal(seen.size, 37);
});

test("glyphPath: one 1 x 1 square per pixel, integers only", () => {
  assert.equal(L.glyphPath("·", 10, 20), "M11 22h1v1h-1z");
  assert.equal(L.glyphPath("A", 0, 0).split("M").length - 1, 10);
  assert.equal(L.glyphPath("nonsense", 10, 20), L.glyphPath("·", 10, 20));
  assert.equal(L.glyphPath("A", 0, 0).slice(0, 14), "M1 0h1v1h-1zM0");
  Object.keys(L.PIXEL_FONT).forEach((k) => {
    const d = L.glyphPath(k, 7, 9);
    assert.match(d, /^(M\d+ \d+h1v1h-1z)+$/, k);
  });
});

test("relLuminance and contrastRatio: the WCAG end points", () => {
  assert.equal(L.relLuminance("#FFFFFF"), 1);
  assert.equal(L.relLuminance("#000000"), 0);
  assert.ok(Math.abs(L.contrastRatio("#000000", "#FFFFFF") - 21) < 1e-9);
  assert.ok(Math.abs(L.contrastRatio("#FFFFFF", "#000000") - 21) < 1e-9);
  assert.ok(Math.abs(L.contrastRatio("#7E8FA0", "#7E8FA0") - 1) < 1e-9);
});

test("shirtInk: the better of the dark and the light ink on each palette colour", () => {
  const light = ["#2F7D6D", "#6D5BA8", "#3E6FB0", "#9C4A7A", "#8A6A4A", "#A04848"];
  const dark = ["#D07A2B", "#C08A1E", "#5E8A2E", "#2E8AA0", "#C0603A", "#7A7F2B"];
  light.forEach((c) => assert.equal(L.shirtInk(c), "#F4EBD0", c));
  dark.forEach((c) => assert.equal(L.shirtInk(c), "#2E1F14", c));
  PALETTE.forEach((c) => assert.ok(L.contrastRatio(c, L.shirtInk(c)) >= 3.2, c));
  assert.equal(L.shirtInk("red"), "#2E1F14");
  assert.equal(L.shirtInk(""), "#2E1F14");
  assert.equal(L.shirtInk(undefined), "#2E1F14");
  assert.equal(L.SHIRT_DARK, "#2E1F14");
  assert.equal(L.SHIRT_LIGHT, "#F4EBD0");
});

test("shirtOrigin: the 3 x 5 letter sits inside the torso and clear of the head", () => {
  const inside = (box, r) => box[0] >= r[0] && box[1] >= r[1] && box[0] + 3 <= r[0] + r[2] && box[1] + 5 <= r[1] + r[3];
  const apart = (box, r) => box[0] + 3 <= r[0] || r[0] + r[2] <= box[0] || box[1] + 5 <= r[1] || r[1] + r[3] <= box[1];
  [[0, 0], [37, 91]].forEach(([px, py]) => {
    const adult = plain(L.shirtOrigin(px, py, "adult"));
    assert.ok(inside(adult, [px, py + 5, 10, 7]));
    assert.ok(apart(adult, [px + 2, py, 6, 5]));
    const kid = plain(L.shirtOrigin(px, py, "kid"));
    assert.ok(inside(kid, [px + 1, py + 4, 8, 5]));
    assert.ok(apart(kid, [px + 2, py, 6, 4]));
    assert.deepEqual(plain(L.shirtOrigin(px, py, undefined)), adult);
  });
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
  const moved = { ...realLayout, rooms: realLayout.rooms.map((r) => ({ ...r, beds: r.beds.map((b) => (b.id === "vlavo-okno" ? { ...b, rect: [20, 312, 24, 34] } : b)) })) };
  assert.deepEqual(plain(L.bedHit(moved, moved.rooms[2].beds[1], 8)), [12, 308, 40, 41]);   // stops at the legend sign above and at half the gap to a bed below
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

test("zoom: clampView keeps the aspect ratio, 0.6x to 4x, and stays inside the scene", () => {
  const tooFar = plain(L.clampView({ x: -50, y: 900, w: 10, h: 10 }, SB));
  near(tooFar.w, 95);
  near(tooFar.h, 103);
  near(tooFar.x, 0);
  near(tooFar.y, SH - 103);
  const tooWide = plain(L.clampView({ x: 30, y: 30, w: 900, h: 900 }, SB));
  // wider than 1/ZOOM_MIN: the 0.6x view, centered on the bounds
  near(tooWide.w, 380 / 0.6);
  near(tooWide.h, 412 / 0.6);
  near(tooWide.x, (380 - 380 / 0.6) / 2);
  near(tooWide.y, (412 - 412 / 0.6) / 2);
  const right = plain(L.clampView({ x: 400, y: 0, w: 190, h: 206 }, SB));
  near(right.x, 190);
  assert.equal(L.ZOOM_MAX, 4);
  assert.equal(L.ZOOM_MIN, 0.6);
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

test("zoom: zoomView is clamped at 0.6x and at about 4x", () => {
  let v = L.wholeView(SB);
  for (let i = 0; i < 20; i++) v = L.zoomView(v, SB, 1.5, 200, 200);
  near(v.w, 95);
  near(L.viewZoom(v, SB), 4);
  for (let i = 0; i < 20; i++) v = L.zoomView(v, SB, 1 / 1.5, 200, 200);
  near(v.w, 380 / 0.6);
  near(L.viewZoom(v, SB), 0.6);
  // zooming out at 1x stops at 0.6x, centered, also at a corner
  let o = L.wholeView(SB);
  for (let i = 0; i < 20; i++) o = L.zoomView(o, SB, 0.5, 379, 411);
  near(o.w, 380 / 0.6);
  near(o.h, 412 / 0.6);
  near(o.x + o.w / 2, 190);
  near(o.y + o.h / 2, 206);
  assert.equal(L.isZoomed(o, SB), false);
  assert.equal(L.isZoomedOut(o, SB), true);
  assert.equal(L.isZoomedOut(L.wholeView(SB), SB), false);
  // zooming back in from 0.6x passes 1x and reaches 4x
  let passed = false;
  for (let i = 0; i < 30; i++) {
    o = L.zoomView(o, SB, 1.5, 100, 100);
    if (Math.abs(L.viewZoom(o, SB) - 1) < 0.3) passed = true;
  }
  assert.ok(passed);
  near(L.viewZoom(o, SB), 4);
});

test("zoom: clampWidth is the one place the zoom range is computed", () => {
  near(L.clampWidth(1, SB), 95);
  near(L.clampWidth(10000, SB), 380 / 0.6);
  assert.equal(L.clampWidth(380, SB), 380);
  const code = logicSource.replace(/\/\/.*$/gm, "");
  assert.ok(!/Math\.min\(bounds\.w,/.test(code), "no 1x lower-limit expression is left");
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
  // below 1x the view stays centered
  const out = plain(L.clampView({ x: 0, y: 0, w: 380 / 0.6, h: 412 / 0.6 }, SB));
  assert.deepEqual(plain(L.panView(out, SB, 50, -70)), out);
  assert.deepEqual(plain(L.dragView(out, SB, BOX, 300, 300)), out);
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
  // pinching in past 0.6x stops there, centered; a zero distance changes nothing
  const pin = plain(L.pinchView(z, SB, BOX, { x: 200, y: 226, dist: 200 }, { x: 200, y: 226, dist: 10 }));
  near(pin.w, 380 / 0.6);
  near(pin.x + pin.w / 2, 190);
  near(pin.y + pin.h / 2, 206);
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
  // 4x of the extended view is the limit, 0.6x the other
  for (let i = 0; i < 30; i++) v = L.zoomView(v, B, 1.5, 190, 206);
  near(L.viewZoom(v, B), 4);
  for (let i = 0; i < 30; i++) v = L.zoomView(v, B, 1 / 1.5, 190, 206);
  near(L.viewZoom(v, B), 0.6);
  near(v.x + v.w / 2, B.x + B.w / 2);
  near(v.y + v.h / 2, B.y + B.h / 2);
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

test("fit: a resize keeps a zoomed-out view zoomed out and centered; whole stays whole", () => {
  const portrait = L.fitBounds(390, 750, SW, SH), landscape = L.fitBounds(750, 390, SW, SH);
  let out = L.wholeView(portrait);
  for (let i = 0; i < 20; i++) out = L.zoomView(out, portrait, 0.8, portrait.x, portrait.y);
  near(L.viewZoom(out, portrait), 0.6);
  const rotated = plain(L.refitView(out, portrait, landscape));
  near(L.viewZoom(rotated, landscape), 0.6);
  near(rotated.x + rotated.w / 2, landscape.x + landscape.w / 2);
  near(rotated.y + rotated.h / 2, landscape.y + landscape.h / 2);
  near(rotated.w / rotated.h, landscape.w / landscape.h);
  assert.deepEqual(plain(L.refitView(L.wholeView(portrait), portrait, landscape)), plain(L.wholeView(landscape)));
  // a bad view still falls back to the whole new bounds
  assert.deepEqual(plain(L.refitView({ x: NaN, y: 0, w: 900, h: 900 }, portrait, landscape)), plain(L.wholeView(landscape)));
});

test("fit: groundRect covers what the view shows at 0.6x and contains the whole view", () => {
  const fixtures = [[390, 844], [844, 390], [1280, 800], [380, 412]];
  for (const [vw, vh] of fixtures) {
    const B = L.fitBounds(vw, vh, SW, SH);
    const g = plain(L.groundRect(B));
    const out = L.clampView({ x: 0, y: 0, w: 1e9, h: 1e9 }, B);      // the widest view allowed
    assert.ok(g[0] <= out.x - 2 + 1e-6 && g[1] <= out.y - 2 + 1e-6, `${vw}x${vh}`);
    assert.ok(g[0] + g[2] >= out.x + out.w + 2 - 1e-6 && g[1] + g[3] >= out.y + out.h + 2 - 1e-6, `${vw}x${vh}`);
    assert.ok(g[0] < B.x && g[1] < B.y && g[0] + g[2] > B.x + B.w && g[1] + g[3] > B.y + B.h, `${vw}x${vh}`);
    near(g[0] + g[2] / 2, B.x + B.w / 2);
    near(g[1] + g[3] / 2, B.y + B.h / 2);
  }
  assert.deepEqual(plain(L.groundRect(SB)).map((n) => Math.round(n * 1000) / 1000),
    [-126.667 - 2, -137.333 - 2, 633.333 + 4, 686.667 + 4].map((n) => Math.round(n * 1000) / 1000));
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /var gr = groundRect\(bounds\);/);
});

test("zoom: bad input never gives a view wider than the 0.6x limit", () => {
  for (const bad of [NaN, Infinity, -1, 0, undefined]) {
    for (const v of [
      L.clampView({ x: 0, y: 0, w: 1e9, h: 1e9 }, SB),
      L.clampView({ x: 0, y: 0, w: 1e9, h: bad }, SB),
      L.zoomView(L.wholeView(SB), SB, bad, 10, 10),
      L.zoomView(L.wholeView(SB), SB, 1e-9, bad, bad),
      L.pinchView(L.wholeView(SB), SB, BOX, { x: 1, y: 1, dist: 1e-9 }, { x: 1, y: 1, dist: 1e9 }),
      L.pinchView(L.wholeView(SB), SB, BOX, { x: 1, y: 1, dist: 1e9 }, { x: 1, y: 1, dist: 1e-9 })]) {
      assert.ok(v.w <= 380 / 0.6 + 1e-6 && v.w >= 95 - 1e-6, `${bad}: ${v.w}`);
    }
  }
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

// --- loading intro (T-015) ---

test("bootRemaining: the loading view stays for the rest of the minimum, measured from the start", () => {
  assert.equal(L.bootRemaining(0, 500, 2400), 1900);
  assert.equal(L.bootRemaining(0, 2400, 2400), 0);
  assert.equal(L.bootRemaining(0, 5000, 2400), 0);
  // restart after the join: a non-zero start
  assert.equal(L.bootRemaining(10000, 10500, 2400), 1900);
  // a clock that runs backwards never gives more than the minimum
  assert.equal(L.bootRemaining(1000, 500, 2400), 2400);
  // a broken clock never holds the map back
  assert.equal(L.bootRemaining(NaN, 500, 2400), 0);
  assert.equal(L.bootRemaining(0, NaN, 2400), 0);
  assert.equal(L.bootRemaining(0, 500, undefined), 0);
  assert.equal(L.bootRemaining(undefined, undefined, undefined), 0);
  assert.equal(L.bootRemaining(0, Infinity, 2400), 0);
});

test("bootMinMs: a shorter minimum with reduced motion", () => {
  assert.equal(L.bootMinMs(false), 2400);
  assert.equal(L.bootMinMs(true), 800);
  assert.equal(L.BOOT_MIN_MS, 2400);
  assert.equal(L.BOOT_MIN_REDUCED_MS, 800);
  assert.equal(L.BOOT_FADE_MS, 300);
});

test("BOOT_MIN_MS equals the leafFall duration in the CSS, and BOOT_FADE_MS the fade transition", () => {
  const rule = html.match(/#boot \.leaf \{[^}]*animation: leafFall ([\d.]+)s/);
  assert.ok(rule, "the #boot .leaf rule must set a leafFall duration");
  assert.equal(Math.round(parseFloat(rule[1]) * 1000), L.BOOT_MIN_MS);
  const fade = html.match(/#boot\.boot--fade \{[^}]*transition: opacity ([\d.]+)s/);
  assert.ok(fade, "the .boot--fade rule must set an opacity transition");
  assert.equal(Math.round(parseFloat(fade[1]) * 1000), L.BOOT_FADE_MS);
  assert.match(html, /#boot\.boot--fade \{[^}]*pointer-events: none;/);
});

test("page: the intro constants are used by name, with no magic numbers in the app script", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /bootRemaining\(app\.introStart, performance\.now\(\), bootMinMs\(/);
  assert.match(app, /BOOT_FADE_MS/);
  assert.doesNotMatch(app, /\b(2400|800|300)\b/);
});

// --- people waiting on the meadow (T-016) ---

test("waitingFigures: nobody without a party, on an absent night, or with all places held", () => {
  assert.deepEqual(plain(L.waitingFigures(stateWith([]), null, THU)), []);
  const late = party({ arrive: FRI });
  assert.deepEqual(plain(L.waitingFigures(stateWith([late]), late, THU)), []);
  const full = party();
  const st = stateWith([full], { [THU]: hold(full.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]) });
  assert.deepEqual(plain(L.waitingFigures(st, full, THU)), []);
  const over = stateWith([full], { [THU]: hold(full.id, ["vlavo-manzelska-1", "vlavo-manzelska-2", "vlavo-okno-1"]) });
  assert.deepEqual(plain(L.waitingFigures(over, full, THU)), []);
});

test("waitingFigures: adults first, then the kids, after the places already held", () => {
  const p = party({ adults: 2, kids: 1 });
  assert.deepEqual(plain(L.waitingFigures(stateWith([p]), p, THU)), [{ kind: "adult" }, { kind: "adult" }, { kind: "kid" }]);
  const one = stateWith([p], { [THU]: hold(p.id, ["vlavo-okno-1"]) });
  assert.deepEqual(plain(L.waitingFigures(one, p, THU)), [{ kind: "adult" }, { kind: "kid" }]);
  assert.deepEqual(plain(L.waitingFigures(one, p, FRI)), [{ kind: "adult" }, { kind: "adult" }, { kind: "kid" }]);
});

test("waitingFigures: a kid in the parents' bed has no figure", () => {
  const p = party({ adults: 2, kids: 2, kids_in_parents_bed: 1 });
  const figures = L.waitingFigures(stateWith([p]), p, THU);
  assert.deepEqual(plain(figures), [{ kind: "adult" }, { kind: "adult" }, { kind: "kid" }]);
  assert.equal(figures.length, L.missingPlaces(stateWith([p]), p, THU));
});

test("meadowLayout: nothing for 0, and 3 figures centred in the real rect", () => {
  const rect = realLayout.map.scene.meadow;
  assert.deepEqual(plain(L.meadowLayout(rect, 0)), { cells: [], more: 0, morePos: null });
  const three = L.meadowLayout(rect, 3);
  assert.deepEqual(plain(three), { cells: [[155, 382], [169, 382], [183, 382]], more: 0, morePos: null });
  const xs = three.cells.map((c) => c[0]);
  assert.equal(xs[1] - xs[0], 14);
  assert.equal(xs[2] - xs[1], 14);
  three.cells.forEach(([x, y]) => {
    assert.ok(Number.isInteger(x) && Number.isInteger(y));
    assert.ok(x >= rect[0] && x + L.MEADOW_FIG_W <= rect[0] + rect[2]);
    assert.ok(y >= rect[1] && y + L.MEADOW_FIG_H <= rect[1] + rect[3]);
  });
  assert.equal(xs[0] - rect[0], rect[0] + rect[2] - (xs[2] + L.MEADOW_FIG_W));   // equal grass on both sides
});

test("meadowLayout: capacity 9 in the real rect, then the last cell becomes a badge", () => {
  const rect = realLayout.map.scene.meadow;
  const full = L.meadowLayout(rect, 9);
  assert.equal(full.cells.length, 9);
  assert.equal(full.more, 0);
  assert.equal(full.morePos, null);
  const over = L.meadowLayout(rect, 10);
  assert.equal(over.cells.length, 8);
  assert.equal(over.more, 2);
  assert.deepEqual(plain(over.morePos), plain(full.cells[8]));
  assert.deepEqual(plain(over.cells), plain(full.cells.slice(0, 8)));
});

test("meadowLayout: a rect too narrow for one figure still has capacity 1", () => {
  const narrow = L.meadowLayout([0, 0, 6, 14], 3);
  assert.equal(narrow.cells.length, 0);
  assert.equal(narrow.more, 3);
  assert.ok(narrow.morePos);
  const one = L.meadowLayout([0, 0, 6, 14], 1);
  assert.equal(one.cells.length, 1);
  assert.equal(one.more, 0);
});

test("meadowLabel: Slovak forms for 0, 1, 2-4 and 5 or more", () => {
  assert.equal(L.meadowLabel(0), "");
  assert.equal(L.meadowLabel(1), "Na lúke čaká 1 človek z tvojej partie bez postele");
  assert.equal(L.meadowLabel(2), "Na lúke čakajú 2 ľudia z tvojej partie bez postele");
  assert.equal(L.meadowLabel(4), "Na lúke čakajú 4 ľudia z tvojej partie bez postele");
  assert.equal(L.meadowLabel(5), "Na lúke čaká 5 ľudí z tvojej partie bez postele");
  assert.equal(L.meadowLabel(11), "Na lúke čaká 11 ľudí z tvojej partie bez postele");
});

test("page: the meadow is drawn from the config rect, as a non-interactive image group", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /drawMeadow\(g, view\);/);
  assert.match(app, /scene\.meadow/);
  assert.match(app, /role: "img", "aria-label": meadowLabel\(waiting\.length\), "pointer-events": "none"/);
});

// --- the walk from the meadow to the bed (T-017) ---

test("walk constants: a slow walk of three seconds", () => {
  assert.equal(L.WALK_MS, 3000);
});

test("walkProgress: 0 at the start, 1 at the end, 0.5 in the middle, clamped", () => {
  const at = (ms) => L.walkProgress(ms, L.WALK_MS);
  assert.equal(at(0), 0);
  assert.equal(at(L.WALK_MS / 2), 0.5);
  assert.equal(at(L.WALK_MS), 1);
  assert.equal(at(L.WALK_MS * 5), 1);
  assert.equal(at(-100), 0);
  assert.equal(at(NaN), 0);
  assert.equal(L.walkProgress(100, 0), 1);      // a bad duration lands at once
  assert.equal(L.walkProgress(100, NaN), 1);
});

test("walkProgress: ease-in-out, never goes backwards and is slower at both ends than in the middle", () => {
  let last = 0;
  for (let ms = 0; ms <= L.WALK_MS; ms += 10) {
    const t = L.walkProgress(ms, L.WALK_MS);
    assert.ok(t >= last, "monotonic at " + ms);
    assert.ok(t >= 0 && t <= 1);
    last = t;
  }
  const step = (from) => L.walkProgress(from + 100, L.WALK_MS) - L.walkProgress(from, L.WALK_MS);
  assert.ok(step(0) < step(L.WALK_MS / 2 - 50));
  assert.ok(step(L.WALK_MS - 100) < step(L.WALK_MS / 2 - 50));
});

test("walkPosition: exactly from at 0 and exactly to at 1, whole pixels in between", () => {
  const from = [0, 0], to = [70, -14];
  assert.deepEqual(plain(L.walkPosition(from, to, 0)), [0, 0]);
  assert.deepEqual(plain(L.walkPosition(from, to, 1)), [70, -14]);
  assert.deepEqual(plain(L.walkPosition(from, to, 0.5)), [35, -7]);
  assert.deepEqual(plain(L.walkPosition([5, 5], [20, 9], 0.1)), [7, 5]);
  for (let t = 0; t <= 1; t += 0.01) {
    plain(L.walkPosition(from, to, t)).forEach((n) => assert.ok(Number.isInteger(n)));
  }
});

test("walkPosition: clamps progress outside 0 ... 1, and no movement stays put", () => {
  assert.deepEqual(plain(L.walkPosition([5, 5], [20, 9], -1)), [5, 5]);
  assert.deepEqual(plain(L.walkPosition([5, 5], [20, 9], 2)), [20, 9]);
  assert.deepEqual(plain(L.walkPosition([5, 5], [20, 9], NaN)), [5, 5]);
  assert.deepEqual(plain(L.walkPosition([20, 9], [20, 9], 0.4)), [20, 9]);
});

test("walkPosition over the whole walk: the figure moves steadily towards the bed without a jump", () => {
  const from = [155, 382], to = [193, 230];
  let last = plain(L.walkPosition(from, to, L.walkProgress(0, L.WALK_MS)));
  assert.deepEqual(last, from);
  for (let ms = 16; ms <= L.WALK_MS; ms += 16) {
    const p = plain(L.walkPosition(from, to, L.walkProgress(ms, L.WALK_MS)));
    assert.ok(p[0] >= last[0] && p[1] <= last[1], "monotonic at " + ms);
    assert.ok(Math.abs(p[0] - last[0]) <= 2 && Math.abs(p[1] - last[1]) <= 3, "no jump at " + ms);
    last = p;
  }
  assert.deepEqual(last, [193, 230]);
});

const walkFor = (p, before, after, bedId, slots, rect = realLayout.map.scene.meadow) =>
  plain(L.walkers(before, after, p, bedById(bedId), slots, THU, rect));

test("walkers: two adults tapping a double bed walk from the first two meadow cells to its two places", () => {
  const p = party();
  const before = realState([p]);
  const slots = ["vlavo-manzelska-1", "vlavo-manzelska-2"];
  const after = realState([p], { [THU]: hold(p.id, slots) });
  const cells = plain(L.meadowLayout(realLayout.map.scene.meadow, 2).cells);
  const bed = bedById("vlavo-manzelska");
  assert.deepEqual(walkFor(p, before, after, "vlavo-manzelska", slots), [
    { slot: slots[0], from: cells[0], to: plain(L.figurePosition(bed, 0)), kind: "adult", color: p.color },
    { slot: slots[1], from: cells[1], to: plain(L.figurePosition(bed, 1)), kind: "adult", color: p.color },
  ]);
});

test("walkers: the kinds come from the state after the tap", () => {
  const p = party({ adults: 1, kids: 1 });
  const slots = ["vlavo-manzelska-1", "vlavo-manzelska-2"];
  const out = walkFor(p, realState([p]), realState([p], { [THU]: hold(p.id, slots) }), "vlavo-manzelska", slots);
  assert.deepEqual(out.map((w) => w.kind), ["adult", "kid"]);
  // One of two tapped: only the first figure walks, the kid is still waiting.
  const one = walkFor(p, realState([p]), realState([p], { [THU]: hold(p.id, [slots[0]]) }), "vlavo-manzelska", [slots[0]]);
  assert.equal(one.length, 1);
  assert.equal(one[0].kind, "adult");
});

test("walkers: nobody walks without a party, or when nothing is waiting", () => {
  const p = party();
  const slots = ["vlavo-okno-1"];
  const after = realState([p], { [THU]: hold(p.id, slots) });
  assert.deepEqual(walkFor(null, realState([p]), after, "vlavo-okno", slots), []);
  // Both places held already, an extra place taken: nothing was waiting.
  const held = realState([p], { [THU]: hold(p.id, ["vlavo-manzelska-1", "vlavo-manzelska-2"]) });
  const extra = realState([p], { [THU]: hold(p.id, ["vlavo-manzelska-1", "vlavo-manzelska-2", "vlavo-okno-1"]) });
  assert.deepEqual(walkFor(p, held, extra, "vlavo-okno", slots), []);
  // The party is not there on that night.
  const late = party({ arrive: FRI });
  assert.deepEqual(walkFor(late, realState([late]), realState([late], { [THU]: hold(late.id, slots) }), "vlavo-okno", slots), []);
});

test("walkers: a slot that will not hold the party has no walker", () => {
  const p = party();
  const slots = ["vlavo-manzelska-1", "vlavo-manzelska-2"];
  assert.deepEqual(walkFor(p, realState([p]), realState([p]), "vlavo-manzelska", slots), []);
});

test("walkers: on an overflowing meadow the figure after the drawn cells starts at the badge", () => {
  const p = party({ adults: 3 });
  const slots = ["vlavo-manzelska-1", "vlavo-manzelska-2"];
  const narrow = [0, 0, 28, 14];       // two cells: one figure and the badge
  const layout = plain(L.meadowLayout(narrow, 3));
  assert.equal(layout.cells.length, 1);
  const out = walkFor(p, realState([p]), realState([p], { [THU]: hold(p.id, slots) }), "vlavo-manzelska", slots, narrow);
  assert.deepEqual(out.map((w) => w.from), [layout.cells[0], layout.morePos]);
});

test("page: the walk layer is hidden from readers and pointers, sits above the beds, and uses the constants by name", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /walk: svgEl\(svg, "g", \{ "aria-hidden": "true", "pointer-events": "none" \}\),\s+boards:/);
  assert.match(app, /beds: svgEl\(svg, "g"\),\s+walk:/);
  assert.match(app, /walkProgress\(elapsed, WALK_MS\)/);
  assert.match(app, /walkPosition\(item\.from, item\.to, t\)/);
  assert.match(app, /if \(app\.walking\[night \+ "\|" \+ slot\]\) return;/);
  assert.doesNotMatch(app, /\b3000\b/);
  assert.doesNotMatch(app, /innerHTML/);
});

test("page: a night switch, the code screen and a rejected write cancel the walks; reduced motion skips them", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  const body = (name) => app.match(new RegExp("function " + name + "\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}\\n"))[1];
  assert.match(body("selectNight"), /cancelWalks\(\)/);
  assert.match(body("showCodeScreen"), /cancelWalks\(\)/);
  assert.match(body("assignHere"), /if \(!prefersReducedMotion\(\)\)/);
  assert.match(body("assignHere"), /!res\.ok && !isOwnSlotTaken\(res\.error\)/);
  assert.match(body("assignHere"), /cancelWalks\(walk\)/);
  // Releasing or moving away a place that is still being walked to takes its walker away.
  assert.match(body("clearSlot"), /cancelWalkersAt\(night, slot\)/);
  assert.match(body("moveTo"), /cancelWalkersAt\(n, m\.fromSlot\)/);
});

// --- regression guard: singular tykanie only, never the plural "vy" forms (T-020) ---

// The plural 2nd person reads exactly like vykanie, which the brief forbids. This checker lives in the test
// file on purpose: the page itself has no use for it.
const FORMAL_WORDS = new Set([
  "vy", "vás", "vám", "vami", "váš", "vaša", "vaše", "vašej", "vašu", "vašho", "vášho", "vašom", "vašou",
  "vašim", "vašimi", "vašich", "vaši", "vaším", "vaší", "vášmu", "ste", "máte", "nemáte", "potrebujete", "nepotrebujete", "spíte", "nespíte",
  "chcete", "môžete", "viete", "budete",
]);
// Slovak words ending in "-te" that are not plural imperatives or verbs: locative of chata, sobota, cesta and miesto.
const TE_ALLOWED = new Set(["chate", "sobote", "ceste", "mieste"]);

const formalForms = (text) =>
  (String(text).toLowerCase().match(/[\p{L}]+/gu) || []).filter((w) => FORMAL_WORDS.has(w) || (/te$/.test(w) && !TE_ALLOWED.has(w)));

test("formalForms flags plural 2nd person forms", () => {
  assert.deepEqual(formalForms("Zadajte kód"), ["zadajte"]);
  assert.deepEqual(formalForms("nie ste tu"), ["ste"]);
  assert.deepEqual(formalForms("máte 2/3 !"), ["máte"]);
  assert.deepEqual(formalForms("z vašej partie"), ["vašej"]);
  assert.deepEqual(formalForms(" (vy)"), ["vy"]);
  assert.deepEqual(formalForms("Kliknite sem"), ["kliknite"]);
  assert.deepEqual(formalForms("Tú noc nespíte"), ["nespíte"]);
  assert.deepEqual(formalForms("Stránka potrebuje vaši JavaScript"), ["vaši"]);
  assert.deepEqual(formalForms("v rámci vaším"), ["vaším"]);
});

test("formalForms accepts singular tykanie and the allowed 1st person plural", () => {
  for (const ok of ["V sobotu nie si na chate.", "Zapísať nás sem", "Na všetky naše noci", "sme vynechali", "v sobote",
    "Máš 2 miesta, potrebuješ 3", "V sobotu ti chýba 1 miesto", "Všetko máš", "Prepni noc alebo zvoľ „Všetky noci“."]) {
    assert.deepEqual(formalForms(ok), [], ok);
  }
});

test("guard, text producers: no function or table of the logic block yields a plural 2nd person", () => {
  const texts = [];
  const add = (value) => {
    if (typeof value === "string") texts.push(value);
    else if (Array.isArray(value)) value.forEach(add);
    else if (value && typeof value === "object") Object.values(value).forEach(add);
  };

  // tally chips and labels, every kind, with and without presence
  const tally = (kind, placed, needed, present = true) => ({ night: THU, present, needed, placed, kind });
  for (const t of [tally("under", 2, 3), tally("under", 0, 2), tally("under", 1, 6), tally("over", 4, 3), tally("over", 5, 3),
    tally("over", 1, 0, false), tally("ok", 3, 3), tally("absent", 0, 0, false)]) {
    add(L.tallyChipText(t));
    add(L.tallyLabel(t));
  }

  // my party status: none, missing, extra, ok
  const p = party({ adults: 2 });
  const big = party({ adults: 6 });
  add(L.myPartyStatus(stateWith([p]), null));
  add(L.myPartyStatus(stateWith([p], { [SAT]: hold(p.id, ["vlavo-okno-1"]) }), p));
  add(L.myPartyStatus(stateWith([big]), big));
  add(L.myPartyStatus(stateWith([p], { [THU]: hold(p.id, [...PAIR, "vlavo-okno-1"]), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, PAIR) }), p));
  add(L.myPartyStatus(stateWith([p], { [THU]: hold(p.id, PAIR), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, PAIR) }), p));

  [1, 2, 5].forEach((n) => add(L.meadowLabel(n)));
  [THU, FRI, SAT].forEach((n) => add(L.notPresentText(n)));
  add([[FRI], [THU, SAT], [THU, FRI, SAT], []].map((n) => L.skippedText(n)));
  add(L.releaseConfirmText("Riso a Ben"));
  add(L.moveBarText("Ivan a Eva"));
  add([null, party()].map((x) => L.whoText(x)));
  [0, 1, 2, 5].forEach((n) => add(L.assignLabel(n)));

  add(L.NOTICE_LINES);
  add(L.MOVE_TEXTS);
  add(L.FREED_TEXTS);
  add(L.REASON_TEXTS);
  add(L.FIELD_NAMES);
  add(L.FALLBACK_ERROR);

  // every error code, with and without params, and the "own" slot_taken
  const s = stateWith([party()]);
  for (const code of Object.keys(L.ERROR_TEXTS)) {
    add(L.errorText({ code, message: "x" }, s));
    add(L.errorText({ code, message: "x", params: {} }, null));
    add(L.errorText({ code, message: "x", params: { night: SAT, slot: "vlavo-okno-1", party_id: "p-aaaaaa", party_name: "Ivan a Eva",
      name: "Ivan a Eva", field: "arrive", reason: "name_empty", retry_after: 12 } }, s));
  }
  add(L.errorText(err("slot_taken", { night: FRI, party_id: "p-aaaaaa", party_name: "Ivan a Eva", own: true }), s));
  add(L.errorText(err("slot_taken", { own: true }), s));
  add(L.errorText(err("not_present", { night: THU, party_name: "Mrco" }), s));
  add(L.errorText(err("invalid", { reason: "leave_not_after_arrive" }), s));

  add(L.summaryText(summaryState(), "https://chata.example/"));
  add([THU, FRI, SAT].map((n) => L.hiddenSummary(summaryState(), n)));

  assert.ok(texts.length > 150, "the guard must really visit the text producers, got " + texts.length);
  for (const text of texts) assert.deepEqual(formalForms(text), [], text);
});

test("guard, page source: no Slovak literal, text node or attribute of the page uses a plural 2nd person", () => {
  // Drop the stylesheet, then scan the two scripts (string literals only, comments skipped) and the markup.
  const noStyle = html.replace(/<style[\s\S]*?<\/style>/g, "");
  const scripts = [...noStyle.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 2);
  const markup = noStyle.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "<script></script>");

  const found = [];
  const token = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  for (const source of scripts) {
    for (const m of source.matchAll(token)) {
      if (m[0].startsWith("//") || m[0].startsWith("/*")) continue;
      found.push(m[0].slice(1, -1));
    }
  }
  // Markup text and attributes are user-facing by definition, so all of them are scanned.
  const markupTexts = [];
  for (const m of markup.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g)) markupTexts.push(m[1]);
  for (const m of markup.replace(/<!--[\s\S]*?-->/g, "").matchAll(/>([^<>]+)</g)) markupTexts.push(m[1]);

  // Script literals also hold code strings (class names such as "note"), so keep only the ones that look like
  // Slovak text: a Slovak letter, a sentence (capital letter and a space), or a forbidden word.
  const slovak = /[áäčďéíľĺňóôŕšťúýž„“]/i;
  const sentence = /^\p{Lu}.*\s/u;
  const scriptTexts = found.filter((text) => slovak.test(text) || sentence.test(text) || [...FORMAL_WORDS].some((w) => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, "iu").test(text)));
  const scanned = [...scriptTexts, ...markupTexts];
  assert.ok(scanned.length > 100, "the guard must really read the page literals, got " + scanned.length);
  for (const text of scanned) assert.deepEqual(formalForms(text), [], text);
});

// --- furniture must stay clear of the room names, windows and doors ---

const windows = [[186, 196, 24, 4], [300, 196, 24, 4]];

test("furniture and the stove pipe stay out of the room name band", () => {
  for (const room of realLayout.rooms) {
    const band = L.roomLabelBand(room);
    for (const b of room.beds) {
      assert.ok(!overlap(L.furnitureBounds(b), band), `${b.id} overlaps the name of ${room.id}`);
    }
  }
});

test("furniture stays inside its room floor and clear of windows and doors", () => {
  for (const room of realLayout.rooms) {
    const [rx, ry, rw, rh] = room.rect;
    const floor = [rx + 4, ry + 4, rw - 8, rh - 8];
    for (const b of room.beds) {
      const f = L.furnitureBounds(b);
      assert.ok(f[0] >= floor[0] && f[1] >= floor[1] && f[0] + f[2] <= floor[0] + floor[2] && f[1] + f[3] <= floor[1] + floor[3],
        `${b.id} sticks out of the floor of ${room.id}`);
      for (const o of [...windows, ...doors]) assert.ok(!overlap(f, o), `${b.id} overlaps a window or door`);
    }
    for (const o of [...windows, ...doors]) assert.ok(!overlap(L.roomLabelBand(room), o), `the name of ${room.id} overlaps a window or door`);
  }
});

test("the stove pipe sticks out sideways, not up into the room name", () => {
  const stove = bedById("kuchynka-pec");
  const pipe = L.stovePipeRect(stove);
  assert.ok(pipe[1] >= stove.rect[1], "the pipe must not rise above the stove");
  assert.deepEqual(plain(L.furnitureBounds(stove)), [22, 352, 62, 28]);
  assert.deepEqual(plain(L.furnitureBounds(bedById("konica-dole-matrace"))), [24, 132, 124, 26]);
});
