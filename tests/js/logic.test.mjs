// Tests of the pure page logic. They load the logic-*.js files that static/index.html lists (in that order)
// into one node:vm context, with no DOM and no browser globals.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pageFile = fs.readFileSync(path.join(root, "static", "index.html"), "utf8");
const scriptTags = [...pageFile.matchAll(/<script src="(static\/js\/[\w-]+\.js)(?:\?v=__ASSET_VERSION__)"><\/script>/g)].map((m) => m[1]);
const readScripts = (prefix) => scriptTags.filter((f) => path.basename(f).startsWith(prefix)).map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
assert.ok(scriptTags.some((f) => path.basename(f).startsWith("logic-")), "the page must load at least one static/js/logic-*.js file");
const logicSource = readScripts("logic-");
const appSource = readScripts("app-");

// The page with its script files put back inline (<script id="logic">, <script id="app">), so that the source
// checks below can read markup, CSS and code in one string, wherever the code lives on disk. The app files are
// indented by two spaces, the way the code was when it lived in one function, because the checks match on it.
const indent = (text) => text.replace(/^(?=.)/gm, "  ");
const html = pageFile
  .replace(/<script src="static\/js\/logic-[^>]*><\/script>\n?/g, "")
  .replace(/<script src="static\/js\/app-[^>]*><\/script>\n?/g, "")
  .replace("</body>", () => `<script id="logic">\n${logicSource}\n</script>\n<script id="app">\n${indent(appSource)}\n</script>\n</body>`);

// An empty context: any touch of document or window would throw a ReferenceError.
const L = vm.createContext({});
vm.runInContext(logicSource, L);

// Values from the vm realm have other prototypes, so compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

// --- fixtures (the real event and a layout shaped like config/cabin.yaml, 20 slots) ---

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
  { id: "konica-upper", name: "Konica, podkrovie", rect: [10, 26, 152, 70], floor: "#D9B98A",
    beds: [bed("konica-upper-double", "Manželská posteľ", 2), bed("konica-upper-single", "Jednomiestna posteľ", 1)] },
  { id: "konica-lower", name: "Konica, dole", rect: [10, 96, 152, 80], floor: "#C9A67A",
    beds: [bed("konica-lower-mats", "Matrace na zemi", 3)] },
  { id: "left", name: "Izba vľavo", rect: [118, 196, 102, 124], floor: "#E8D2A6",
    beds: [bed("left-double", "Manželská posteľ", 2), bed("left-window", "Posteľ pod oknom", 1),
      bed("left-cot-1", "Lehátko 1", 1), bed("left-cot-2", "Lehátko 2", 1)] },
  { id: "hallway", name: "Chodbička", rect: [216, 196, 54, 124], floor: "#DCC59B",
    beds: [bed("hallway-sofa", "Rozkladací gauč", 2)] },
  { id: "right", name: "Izba vpravo", rect: [266, 196, 106, 124], floor: "#E8D2A6",
    beds: [bed("right-bunk-1", "Poschodová 1", 2), bed("right-bunk-2", "Poschodová 2", 2),
      bed("right-sofa", "Gauč", 1)] },
  { id: "kitchen", name: "Letná kuchynka", rect: [10, 334, 100, 62], floor: "#CFD8DC",
    beds: [bed("kitchen-stove", "Na peci", 2)] },
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
  // "window" in quotes is the COLORS key of the sky (T-022), not the browser global
  assert.doesNotMatch(logicSource.replace(/"window"/g, '""'), /\b(document|window|localStorage|fetch|navigator)\b/);
});

// --- dates ---

test("event date text for the real event dates", () => {
  assert.equal(L.eventDateText(event), "29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)");
});

test("event date text survives missing or broken data", () => {
  assert.equal(L.eventDateText(null), "");
  assert.equal(L.eventDateText({ arrive_days: ["nonsense"], leave_days: ["2026-11-01"] }), "");
});

test("title board label is the name and the full term, or just the name", () => {
  assert.equal(L.titleLabel(event), "Chata 29. 10. – 1. 11., 29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)");
  assert.equal(L.titleLabel({ name: "Chata", arrive_days: ["nonsense"], leave_days: ["2026-11-01"] }), "Chata");
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

test("default night is the arrival night, or the first night as a fallback", () => {
  const nights = event.nights;
  assert.equal(L.defaultNightFor(party({ arrive: THU }), nights), THU);
  assert.equal(L.defaultNightFor(party({ arrive: FRI }), nights), FRI);
  assert.equal(L.defaultNightFor(party({ arrive: "2026-11-01" }), nights), THU);
  assert.equal(L.defaultNightFor({ id: "p-x" }, nights), THU);
  assert.equal(L.defaultNightFor(null, nights), THU);
  assert.equal(L.defaultNightFor(undefined, nights), THU);
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
  const s = stateWith([party()], { [FRI]: hold("p-aaaaaa", ["left-double-1", "left-double-2"]) });
  assert.equal(L.usedCount(s, THU), 0);
  assert.equal(L.usedCount(s, FRI), 2);
});

test("slots of a party per night, in layout order", () => {
  const s = stateWith([party()], {
    [THU]: { "left-double-2": "p-aaaaaa", "konica-upper-single-1": "p-aaaaaa", "hallway-sofa-1": "p-other" },
  });
  assert.deepEqual(plain(L.partySlots(s, "p-aaaaaa", THU)), ["konica-upper-single-1", "left-double-2"]);
  assert.deepEqual(plain(L.partySlots(s, "p-aaaaaa", FRI)), []);
});

test("bed of a slot", () => {
  assert.equal(L.bedOfSlot(layout, "left-window-1").name, "Posteľ pod oknom");
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
    [THU]: hold(p.id, ["left-double-1", "left-double-2"]),
    [FRI]: hold(p.id, ["left-double-1"]),
    [SAT]: hold(p.id, ["left-double-1", "left-double-2", "left-window-1"]),
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

test("seenText covers each branch and boundaries", () => {
  const now = Date.parse("2026-10-25T12:00:00+00:00");
  const ago = (ms) => new Date(now - ms).toISOString();
  assert.equal(L.seenText(ago(0), now, true), "online");
  assert.equal(L.seenText(undefined, now, false), "zatiaľ nevidené");
  assert.equal(L.seenText(null, now, false), "zatiaľ nevidené");
  assert.equal(L.seenText(ago(10000), now, false), "pred 1 min");
  assert.equal(L.seenText(ago(5 * 60000), now, false), "pred 5 min");
  assert.equal(L.seenText(ago(59 * 60000), now, false), "pred 59 min");
  assert.equal(L.seenText(ago(60 * 60000), now, false), "pred 1 h");
  assert.equal(L.seenText(ago(23 * 3600000), now, false), "pred 23 h");
  assert.equal(L.seenText(ago(24 * 3600000), now, false), "pred 1 d");
  assert.equal(L.seenText(ago(3 * 86400000), now, false), "pred 3 d");
});

test("onlineChips lists online parties with their shirt letter, mine included", () => {
  const state = {
    parties: [
      { id: "a", name: "Ivan a Eva", color: "#2F7D6D" },
      { id: "b", name: "Šimon", color: "#F3E3C0" },
      { id: "c", name: "Cyril", color: "#6D5BA8" }
    ],
    presence: { online: ["c", "a", "gone"] }
  };
  const r = L.onlineChips(state, "b", 8);
  assert.deepEqual(r.chips.map((c) => c.id), ["a", "b", "c"]);   // state order, unknown ids dropped
  assert.equal(r.chips[1].ch, "S");
  assert.equal(r.chips[1].mine, true);
  assert.equal(r.chips[0].ink, L.shirtInk("#2F7D6D"));
  assert.equal(r.more, 0);
  assert.equal(r.label, "online: Ivan a Eva, Šimon, Cyril");
  const few = L.onlineChips(state, "b", 2);
  assert.deepEqual([few.chips.length, few.more], [2, 1]);
  assert.equal(L.onlineChips({ parties: state.parties, presence: { online: [] } }, null, 8).label, "online: nikto");
  // alone (also before the server lists me): no chip that repeats the crest, words instead
  const alone = L.onlineChips({ parties: state.parties }, "a", 8);
  assert.deepEqual([alone.chips.length, alone.label], [0, "online: len ty"]);
  assert.equal(L.onlineChips({ parties: state.parties, presence: { online: ["a"] } }, "a", 8).label, "online: len ty");
  assert.equal(L.onlineChips({ parties: state.parties, presence: { online: ["a"] } }, null, 8).chips.length, 1);   // no party chosen
});

test("crestAgeText shows the age only on a problem", () => {
  const base = { fetchedAtMs: 1000000, nowMs: 1030000, lastPollFailed: false };
  assert.equal(L.crestAgeText(base), null);
  assert.equal(L.crestAgeText({ ...base, nowMs: 1090000 }), null);
  assert.equal(L.crestAgeText({ ...base, nowMs: 1091000 }), "aktualizované pred 1 min");
  assert.equal(L.crestAgeText({ ...base, lastPollFailed: true }), "aktualizované pred 30 s");
  assert.equal(L.crestAgeText({ ...base, fetchedAtMs: 1091000, nowMs: 1092000 }), null);   // a 304 resets fetchedAt
});

// --- live stream (T-053) ---

test("state event version guard", () => {
  assert.equal(L.stateEventAction(5, 6), "full");
  assert.equal(L.stateEventAction(5, 5), "presence");
  assert.equal(L.stateEventAction(5, 4), "ignore");
  assert.equal(L.stateEventAction(null, 1), "full");
  assert.equal(L.stateEventAction(5, undefined), "ignore");
});

test("liveProblemText: stream mode shows the age after 45 s or on an error", () => {
  const o = { stream: true, errored: false, lastEventMs: 1000000, fetchedAtMs: 1000000, nowMs: 1044000, lastPollFailed: false };
  assert.equal(L.liveProblemText(o), null);
  assert.equal(L.liveProblemText({ ...o, nowMs: 1045000 }), null);
  assert.equal(L.liveProblemText({ ...o, nowMs: 1046000 }), "aktualizované pred 46 s");
  assert.equal(L.liveProblemText({ ...o, errored: true, nowMs: 1010000 }), "aktualizované pred 10 s");
  // data fetched by the poll after an error are newer than the last stream event
  assert.equal(L.liveProblemText({ ...o, errored: true, fetchedAtMs: 1008000, nowMs: 1010000 }), "aktualizované pred 2 s");
});

test("liveProblemText: fallback mode keeps the polling rule", () => {
  const o = { stream: false, errored: true, lastEventMs: 0, fetchedAtMs: 1000000, nowMs: 1030000, lastPollFailed: false };
  assert.equal(L.liveProblemText(o), null);   // the stream error flag does not matter without a stream
  assert.equal(L.liveProblemText({ ...o, nowMs: 1091000 }), "aktualizované pred 1 min");
  assert.equal(L.liveProblemText({ ...o, lastPollFailed: true }), "aktualizované pred 30 s");
});

test("shouldFallBack after 60 s without a state", () => {
  assert.equal(L.shouldFallBack(null, 999999), false);
  assert.equal(L.shouldFallBack(1000, 60999), false);
  assert.equal(L.shouldFallBack(1000, 61000), true);
});

test("reconnect delay grows and is capped", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 20].map(L.reconnectDelayMs), [3000, 6000, 12000, 24000, 30000, 30000, 30000]);
});

test("eventsUrl is relative, encoded, and omits a missing party", () => {
  assert.equal(L.eventsUrl("p-abc123", "c 1&x"), "api/events?party=p-abc123&client=c%201%26x");
  assert.equal(L.eventsUrl(null, "cid"), "api/events?client=cid");
});

test("relative refresh time", () => {
  assert.equal(L.updatedAgoText(0, 20000), "aktualizované pred 20 s");
  assert.equal(L.updatedAgoText(0, 0), "aktualizované pred 0 s");
  assert.equal(L.updatedAgoText(0, 125000), "aktualizované pred 2 min");
  assert.equal(L.updatedAgoText(0, 7300000), "aktualizované pred 2 h");
  assert.equal(L.updatedAgoText(5000, 1000), "aktualizované pred 0 s");   // a clock set back
});

// --- my-party status ---

const PAIR = ["left-double-1", "left-double-2"];

test("status: no party chosen", () => {
  assert.equal(L.myPartyStatus(stateWith([]), null).kind, "none");
});

test("status: missing 1 place on Saturday is red and names the night", () => {
  const p = party({ adults: 2 });
  const s = stateWith([p], {
    [THU]: hold(p.id, PAIR), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, ["left-double-1"]),
  });
  assert.deepEqual(plain(L.myPartyStatus(s, p)),
    { kind: "missing", night: SAT, count: 1, text: "V sobotu ti chýba 1 miesto" });
});

test("status: the first night with missing places wins, with verb forms", () => {
  const p = party({ adults: 3 });
  const s = stateWith([p], { [FRI]: hold(p.id, ["left-double-1"]) });
  assert.equal(L.myPartyStatus(s, p).night, THU);
  assert.equal(L.myPartyStatus(s, p).text, "Vo štvrtok ti chýbajú 3 miesta");
  const big = party({ adults: 6, arrive: THU, leave: FRI });
  assert.equal(L.myPartyStatus(stateWith([big]), big).text, "Vo štvrtok ti chýba 6 miest");
});

test("status: 1 extra place is a soft amber note", () => {
  const p = party({ adults: 2, leave: FRI });   // present on the Thursday night only
  const s = stateWith([p], { [THU]: hold(p.id, [...PAIR, "left-window-1"]) });
  assert.deepEqual(plain(L.myPartyStatus(s, p)),
    { kind: "extra", night: THU, count: 1, text: "Máš o 1 miesto viac, než potrebuješ" });
});

test("status: missing wins over extra, even when the extra night is earlier", () => {
  const p = party({ adults: 2, leave: SAT });   // Thursday and Friday nights
  const s = stateWith([p], {
    [THU]: hold(p.id, [...PAIR, "left-window-1"]),   // 1 extra on Thursday
    [FRI]: hold(p.id, ["left-double-1"]),      // 1 missing on Friday
  });
  const status = L.myPartyStatus(s, p);
  assert.equal(status.kind, "missing");
  assert.equal(status.night, FRI);
  assert.equal(status.text, "V piatok ti chýba 1 miesto");
});

test("status: 2 extra places use the plural form", () => {
  const p = party({ adults: 1, leave: FRI });
  const s = stateWith([p], { [THU]: hold(p.id, [...PAIR, "left-window-1"]) });
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

test("statusHud: missing opens the places panel on the selected night, else selects that night", () => {
  const p = party({ adults: 2 });
  const s = stateWith([p], { [SAT]: hold(p.id, ["left-window-1"]) });
  const st = L.myPartyStatus(s, p);
  const here = plain(L.statusHud(st, st.night));
  assert.equal(here.kind, "missing");
  assert.equal(here.action, "places");
  assert.deepEqual(here.lines, plain(L.statusBoardLines(st)));
  assert.equal(here.label, st.text + ". Ťuknutím otvoríš možnosti.");
  const other = plain(L.statusHud(st, st.night === THU ? FRI : THU));
  assert.equal(other.action, "night");
  assert.equal(other.label, st.text + ". Ťuknutím zvolíš túto noc.");
});

test("statusHud: fewer, extra, ok and none", () => {
  const fewer = { kind: "fewer", night: THU, count: 1, full: 3, text: "Št: len 1 z 3" };
  assert.deepEqual(plain(L.statusHud(fewer, THU)),
    { kind: "fewer", lines: ["Št: len 1 z 3 ›"], action: "undo", label: "Št: len 1 z 3. Ťuknutím môžeš vrátiť plný počet." });
  const extra = { kind: "extra", night: FRI, count: 1, text: "Máš o 1 miesto viac, než potrebuješ" };
  assert.deepEqual(plain(L.statusHud(extra, THU)),
    { kind: "extra", lines: [extra.text], action: "night", label: extra.text + ". Ťuknutím zvolíš túto noc." });
  const ok = { kind: "ok", night: null, count: 0, text: "Všetko máš" };
  assert.deepEqual(plain(L.statusHud(ok, THU)), { kind: "ok", lines: ["Všetko máš"], action: null, label: "Všetko máš" });
  const dayOnly = L.myPartyStatus(stateWith([party({ arrive: null, leave: null, day_visits: [THU] })]), party({ arrive: null, leave: null, day_visits: [THU] }), THU);
  assert.deepEqual(plain(L.statusHud(dayOnly, THU)), { kind: "ok", lines: ["Prídeš len cez deň"], action: null, label: "Prídeš len cez deň" });
  assert.deepEqual(plain(L.statusHud(L.myPartyStatus(stateWith([]), null), THU)),
    { kind: "none", lines: ["Najprv vyber, kto si"], action: "who", label: "Najprv vyber, kto si. Ťuknutím to vyberieš." });
});

// --- quest log in the HUD (try-out of HUD concept 3) ---

const qrow = (rows, night) => rows.find((r) => r.night === night);

test("questRows: no party, day visits only", () => {
  assert.deepEqual(plain(L.questRows(stateWith([]), null, THU)),
    [{ key: "q-who", kind: "who", night: null, text: "Vyber, kto si", label: "Najprv vyber, kto si. Ťuknutím to vyberieš.", action: "who" }]);
  const day = party({ arrive: null, leave: null, day_visits: [THU] });
  assert.deepEqual(plain(L.questRows(stateWith([day]), day, THU)),
    [{ key: "q-day", kind: "day", night: null, text: "Len cez deň", label: "Prídeš len cez deň", action: null }]);
});

test("questRows: one row per night, open on the selected night opens the places panel, elsewhere selects the night", () => {
  const p = party({ adults: 2 });
  const s = stateWith([p], { [THU]: hold(p.id, ["left-window-1"]), [FRI]: hold(p.id, PAIR) });
  const here = plain(L.questRows(s, p, THU));
  assert.deepEqual(here.map((r) => r.night), [THU, FRI, SAT]);
  assert.deepEqual(qrow(here, THU), { key: "q-" + THU, night: THU, action: "places", kind: "open",
    text: "Št 1/2", label: "Vo štvrtok ti chýba 1 miesto. Ťuknutím otvoríš možnosti." });
  assert.deepEqual(qrow(here, FRI), { key: "q-" + FRI, night: FRI, action: "night", kind: "done",
    text: "Pi 2/2", label: "V piatok máš všetko (2 z 2). Ťuknutím zvolíš túto noc." });
  assert.equal(qrow(here, SAT).text, "So 0/2");
  assert.equal(qrow(here, SAT).action, "night");
  assert.equal(qrow(here, SAT).label, "V sobotu ti chýbajú 2 miesta. Ťuknutím zvolíš túto noc.");
});

test("questRows: fewer, extra and away", () => {
  const p = party({ adults: 3, places: { [THU]: 1 }, arrive: THU, leave: SAT });
  const s = stateWith([p], { [THU]: hold(p.id, ["left-window-1"]), [FRI]: hold(p.id, [...PAIR, "left-window-1", "right-sofa-1"]) });
  const rows = plain(L.questRows(s, p, THU));
  assert.deepEqual(qrow(rows, THU), { key: "q-" + THU, night: THU, action: "undo", kind: "fewer",
    text: "Št len 1/3", label: "Vo štvrtok máš len 1 z 3. Ťuknutím môžeš vrátiť plný počet." });
  assert.equal(qrow(rows, FRI).kind, "extra");
  assert.equal(qrow(rows, FRI).text, "Pi 4/3");
  assert.equal(qrow(rows, SAT).kind, "away");
  assert.equal(qrow(rows, SAT).text, "So –");
  assert.equal(qrow(rows, SAT).action, "night");
  assert.equal(qrow(plain(L.questRows(s, p, FRI)), THU).action, "night");
});

test("questsFinished: only nights that went from open to done or fewer", () => {
  const before = [{ night: THU, kind: "open" }, { night: FRI, kind: "open" }, { night: SAT, kind: "done" }];
  const after = [{ night: THU, kind: "done" }, { night: FRI, kind: "open" }, { night: SAT, kind: "done" }];
  assert.deepEqual(plain(L.questsFinished(before, after)), [THU]);
  assert.deepEqual(plain(L.questsFinished(null, after)), []);
  assert.deepEqual(plain(L.questsFinished([{ night: THU, kind: "open" }], [{ night: THU, kind: "fewer" }])), [THU]);
});

test("the HUD: markup, no status board in the scene, listed before app-start.js", () => {
  assert.ok(!new RegExp("draw" + "Status|scene\\.sta" + "tus").test(appSource + logicSource), "the status board left the scene");
  assert.match(pageFile, /<div id="hud"[^>]*\bhidden\b/);
  assert.match(pageFile, /<div id="quest" class="quest">/);
  assert.match(pageFile, /<button id="crest"[^>]*type="button" data-key="who"/);
  assert.ok(!pageFile.includes("compass"), "no compass: the ? icon in the scene opens „Návod“");
  assert.match(pageFile, /#moveBar:not\(\[hidden\]\) ~ \.hud \.quest \{ display: none; \}/);
  assert.match(pageFile, /\.quest-row \{[^}]*min-height: 30px/);
  assert.match(readScripts("app-hud"), /return storage\.get\(QUEST_KEY\) === "1";/, "folded by default");
  assert.ok(scriptTags.indexOf("static/js/app-hud.js") > -1 && scriptTags.indexOf("static/js/app-hud.js") < scriptTags.indexOf("static/js/app-start.js"));
  assert.match(pageFile, /\.hud \{[^}]*z-index: 12/);
  assert.match(pageFile, /\.zoom-reset \{[^}]*bottom: calc\(18px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(pageFile, /#toast \{[^}]*var\(--hud-h/);
  assert.ok(!/innerHTML/.test(readScripts("app-hud")), "human text goes in via textContent");
});

// --- night tally (chips on the night signposts) ---

const tallyOf = (s, p, night) => plain(L.nightTally(s, p, night));

test("tally: under, over, ok and absent kinds with placed and needed", () => {
  const p = party({ adults: 3, leave: SAT });   // Thursday and Friday nights
  const s = stateWith([p], {
    [THU]: hold(p.id, PAIR),                                   // 2 of 3
    [FRI]: hold(p.id, [...PAIR, "left-window-1", "left-cot-1-1"]),   // 4 of 3
  });
  assert.deepEqual(tallyOf(s, p, THU), { night: THU, present: true, needed: 3, placed: 2, kind: "under" });
  assert.deepEqual(tallyOf(s, p, FRI), { night: FRI, present: true, needed: 3, placed: 4, kind: "over" });
  assert.deepEqual(tallyOf(s, p, SAT), { night: SAT, present: false, needed: 0, placed: 0, kind: "absent" });
  const full = stateWith([p], { [THU]: hold(p.id, [...PAIR, "left-window-1"]) });
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
  const s = stateWith([p], { [FRI]: hold(p.id, ["left-window-1"]) });
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
    [THU]: { ...hold(a.id, PAIR), ...hold(c.id, ["left-window-1"]) },   // c holds a slot before arriving
    [FRI]: { ...hold(a.id, [...PAIR, "left-window-1", "left-cot-1-1"]), ...hold(b.id, ["konica-lower-mats-1"]) },
    [SAT]: hold(b.id, ["konica-lower-mats-1", "konica-lower-mats-2"]),
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
  const text = L.errorText(err("slot_taken", { night: SAT, slot: "left-double-1", party_id: "p-7f3k2a", party_name: "Riso a Ben" }));
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
    "„Mrco“ vo štvrtok nie je na chate. Uprav príchod alebo odchod.");
  assert.equal(L.errorText(err("duplicate_name", { name: "Ivan a Eva" })),
    "Meno „Ivan a Eva“ už niekto má. Skús iné.");
  assert.equal(L.errorText(err("invalid", { field: "kids_in_parents_bed" })),
    "Skontroluj pole „deti spiace s rodičmi“.");
  assert.equal(L.errorText(err("rate_limited", { retry_after: 12 })),
    "Príliš veľa pokusov za krátky čas, skús to o 12 s.");
  assert.equal(L.errorText(err("rate_limited", { retry_after: 90 })),
    "Príliš veľa pokusov za krátky čas, skús to o 2 min.");
  assert.equal(L.errorText(err("unknown_slot", { slot: "left-window-1" }), stateWith([])),
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
  assert.equal(L.errorText(err("not_present")), "Nikto z vás nie je v túto noc na chate. Uprav príchod alebo odchod.");
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

// --- beds on the map: a layout with the real geometry of config/cabin.yaml ---

const realBeds = {
  "konica-upper-double": ["bed2", [28, 46, 44, 30], 2], "konica-upper-single": ["bed1", [118, 44, 24, 34], 1],
  "konica-lower-mats": ["mats", [24, 132, 124, 26], 3], "left-double": ["bed2", [128, 220, 44, 30], 2],
  "left-window": ["bed1", [186, 220, 24, 34], 1], "left-cot-1": ["cot", [130, 272, 20, 36], 1],
  "left-cot-2": ["cot", [158, 272, 20, 36], 1], "hallway-sofa": ["sofa", [226, 226, 32, 58], 2],
  "right-bunk-1": ["bunk", [276, 220, 24, 42], 2], "right-bunk-2": ["bunk", [308, 220, 24, 42], 2],
  "right-sofa": ["sofa1", [336, 272, 28, 36], 1], "kitchen-stove": ["stove", [22, 352, 56, 28], 2],
};
const scene = { title: [176, 10, 196, 30], nights: [176, 46, 196, 58], notice: [328, 112, 44, 44],
  locked: [16, 190, 62, 56], letter: [128, 336, 44, 44], key: [184, 336, 44, 44],
  legend: [24, 264, 44, 44], parties: [176, 112, 148, 82], meadow: [112, 381, 124, 14] };
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
  assert.deepEqual(pos("left-double"), [[135, 228], [155, 228]]);                       // bed2: x+7 and x+w-17, y+8
  assert.deepEqual(pos("konica-upper-double"), [[35, 54], [55, 54]]);
  assert.deepEqual(pos("right-bunk-1"), [[283, 224], [283, 244]]);                   // bunk: top and bottom
  assert.deepEqual(pos("konica-lower-mats"), [[34, 139], [80, 139], [126, 139]]);         // mats: three in a row
  assert.deepEqual(pos("hallway-sofa"), [[237, 234], [237, 258]]);                           // sofa: one above the other
  assert.deepEqual(pos("kitchen-stove"), [[32, 360], [58, 360]]);                            // stove
});

test("one-slot kinds get a single centred figure", () => {
  const pos = (id) => plain(L.figurePositions(bedById(id)));
  assert.deepEqual(pos("konica-upper-single"), [[125, 54]]);   // bed1: x+w/2-5, y+10
  assert.deepEqual(pos("left-cot-1"), [[135, 282]]);    // cot
  assert.deepEqual(pos("right-sofa"), [[345, 282]]);        // sofa1
});

test("a bed with more slots than positions reuses the last position", () => {
  assert.deepEqual(plain(L.figurePosition(bedById("left-window"), 0)), [193, 230]);
  assert.deepEqual(plain(L.figurePosition(bedById("left-window"), 3)), [193, 230]);
  assert.deepEqual(plain(L.figurePosition(bedById("left-double"), 1)), [155, 228]);
});

test("figures move with the bed rect from the config", () => {
  const moved = { ...bedById("left-double"), rect: [200, 100, 44, 30] };
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
  const s = realState([family], { [SAT]: { "left-double-1": family.id, "left-double-2": family.id } });
  assert.equal(L.slotOccupant(s, "left-double-1", SAT).kind, "adult");
  assert.equal(L.slotOccupant(s, "left-double-2", SAT).kind, "kid");
  assert.equal(L.slotOccupant(s, "left-double-2", SAT).party.name, "Ivan a Eva");
  assert.equal(L.slotOccupant(s, "left-double-1", FRI), null);
});

// --- slots to take (Q3) ---

test("a couple missing 2 on an empty double bed takes both slots", () => {
  const p = party({ adults: 2 });
  assert.deepEqual(plain(L.slotsToTake(realState([p]), p, bedById("left-double"), SAT)),
    ["left-double-1", "left-double-2"]);
});

test("a couple missing 2 on a double bed with 1 free takes the 1 free slot", () => {
  const p = party({ adults: 2 }), other = party({ id: "p-bbbbbb", name: "Riso a Ben" });
  const s = realState([p, other], { [SAT]: { "left-double-1": other.id } });
  assert.deepEqual(plain(L.slotsToTake(s, p, bedById("left-double"), SAT)), ["left-double-2"]);
});

test("a party that lacks nothing still takes 1 extra place", () => {
  const p = party({ adults: 2 });
  const s = realState([p], { [SAT]: hold(p.id, ["konica-upper-double-1", "konica-upper-double-2"]) });
  assert.equal(L.missingPlaces(s, p, SAT), 0);
  assert.deepEqual(plain(L.slotsToTake(s, p, bedById("left-double"), SAT)), ["left-double-1"]);
});

test("a full bed gives no slots", () => {
  const p = party({ adults: 2 }), other = party({ id: "p-bbbbbb", name: "Riso a Ben" });
  const s = realState([p, other], { [SAT]: hold(other.id, ["left-double-1", "left-double-2"]) });
  assert.deepEqual(plain(L.slotsToTake(s, p, bedById("left-double"), SAT)), []);
});

test("a party of 3 on three free mats takes all 3", () => {
  const p = party({ adults: 2, kids: 1 });
  assert.deepEqual(plain(L.slotsToTake(realState([p]), p, bedById("konica-lower-mats"), SAT)),
    ["konica-lower-mats-1", "konica-lower-mats-2", "konica-lower-mats-3"]);
});

test("a party already holding one of two needed places takes one more", () => {
  const p = party({ adults: 2 });
  const s = realState([p], { [SAT]: hold(p.id, ["konica-upper-single-1"]) });
  assert.deepEqual(plain(L.slotsToTake(s, p, bedById("left-double"), SAT)), ["left-double-1"]);
});

test("nights in which a party holds a slot", () => {
  const p = party();
  const s = realState([p], { [THU]: hold(p.id, ["left-window-1"]), [FRI]: hold("p-other", ["left-window-1"]), [SAT]: hold(p.id, ["left-window-1"]) });
  assert.deepEqual(plain(L.holdingNights(s, p.id, "left-window-1")), [THU, SAT]);
  assert.deepEqual(plain(L.holdingNights(s, p.id, "hallway-sofa-1")), []);
});

test("nights an assign for the whole stay will write", () => {
  const p = party({ arrive: THU, leave: "2026-11-01" });
  const s = realState([p], { [FRI]: hold("p-other", ["left-window-1"]) });
  assert.deepEqual(plain(L.stayNights(s, p, ["left-window-1"])), [THU, SAT]);   // Friday is taken
  const late = party({ arrive: FRI, leave: "2026-11-01" });
  assert.deepEqual(plain(L.stayNights(realState([late]), late, ["left-window-1"])), [FRI, SAT]);   // not there on Thursday
});

test("move target is the first slot free in every night of the move", () => {
  const bed = bedById("left-double");
  const s = realState([], { [THU]: hold("p-x", ["left-double-1"]), [FRI]: hold("p-y", ["left-double-2"]) });
  assert.equal(L.moveTarget(s, bed, [THU]), "left-double-2");
  assert.equal(L.moveTarget(s, bed, [FRI]), "left-double-1");
  assert.equal(L.moveTarget(s, bed, [THU, FRI]), null);
  assert.equal(L.moveTarget(s, bed, [SAT]), "left-double-1");
});

test("pending changes are drawn on top of the state without changing it", () => {
  const s = realState([party()], { [SAT]: { "left-window-1": "p-aaaaaa", "hallway-sofa-1": "p-other" } });
  const view = L.withPending(s, [
    { night: SAT, slot: "left-window-1", party_id: null },
    { night: FRI, slot: "left-double-1", party_id: "p-aaaaaa" },
  ]);
  assert.deepEqual(plain(view.state.sleeping), { [SAT]: { "hallway-sofa-1": "p-other" }, [FRI]: { "left-double-1": "p-aaaaaa" } });
  assert.deepEqual(plain(view.pending), { [`${SAT}|left-window-1`]: true, [`${FRI}|left-double-1`]: true });
  assert.deepEqual(plain(s.sleeping), { [SAT]: { "left-window-1": "p-aaaaaa", "hallway-sofa-1": "p-other" } });
  assert.deepEqual(plain(L.withPending(s, []).pending), {});
});

// --- bed texts ---

test("bed screen-reader label", () => {
  const room = rooms[2], bed = bedById("left-double");
  const p = party();
  const full = realState([p], { [SAT]: hold(p.id, ["left-double-1", "left-double-2"]) });
  assert.equal(L.bedLabel(full, room, bed, SAT), "Manželská posteľ, izba vľavo, v sobotu Ivan a Eva, 0 voľných");
  assert.equal(L.bedLabel(realState([p]), room, bed, FRI), "Manželská posteľ, izba vľavo, v piatok nikto, 2 voľné");
  const half = realState([p], { [THU]: hold(p.id, ["left-double-1"]) });
  assert.equal(L.bedLabel(half, room, bed, THU), "Manželská posteľ, izba vľavo, vo štvrtok Ivan a Eva, 1 voľné");
  assert.equal(L.bedLabel(realState([p]), rooms[1], bedById("konica-lower-mats"), THU), "Matrace na zemi, konica, dole, vo štvrtok nikto, 3 voľné");
});

test("free places in Slovak", () => {
  assert.deepEqual(plain([0, 1, 2, 4, 5].map(L.freeText)), ["0 voľných", "1 voľné", "2 voľné", "4 voľné", "5 voľných"]);
});

test("assign button label says how many places it takes", () => {
  assert.equal(L.assignLabel(2), "Zapísať nás sem (2 miesta)");
  assert.equal(L.assignLabel(1), "Zapísať nás sem (1 miesto)");
  assert.equal(L.assignLabel(0), "Zapísať nás sem");
});

test("assign button label names the party when one is chosen", () => {
  assert.equal(L.assignLabel(2, "Ivan a Eva"), "Zapísať sem „Ivan a Eva“ (2 miesta)");
  assert.equal(L.assignLabel(1, "Ivan a Eva"), "Zapísať sem „Ivan a Eva“ (1 miesto)");
  assert.equal(L.assignLabel(0, "Ivan a Eva"), "Zapísať sem „Ivan a Eva“");
  assert.equal(L.assignLabel(2, null), "Zapísať nás sem (2 miesta)");
});

test("bed panel warns when the party already has enough places", () => {
  assert.equal(L.enoughAlreadyText("Ivan a Eva"),
    "„Ivan a Eva“ už má dosť miest. Ak zapisuješ niekoho iného, ťukni na „Som niekto iný“.");
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
  const s = realState([p], { [THU]: hold(p.id, ["left-window-1"]), [SAT]: hold(p.id, ["left-window-1"]) });
  const move = { partyId: p.id, fromSlot: "left-window-1", all: false };
  const target = bedById("left-double");
  assert.deepEqual(plain(L.planMove(s, move, target, THU)), { nights: [THU], target: "left-double-1" });
  assert.deepEqual(plain(L.planMove(s, { ...move, all: true }, target, FRI)), { nights: [THU, SAT], target: "left-double-1" });
  // not sleeping in the old place on the selected night
  assert.equal(L.planMove(s, move, target, FRI).error, "Tú noc na pôvodnom mieste nespíš. Prepni noc alebo zvoľ „Všetky noci“.");
  // the old place is not held on any night
  assert.equal(L.planMove(s, { ...move, fromSlot: "hallway-sofa-1", all: true }, target, THU).error, L.MOVE_TEXTS.not_held);
  // no free slot in every night
  const busy = realState([p], { [THU]: { ...hold(p.id, ["left-window-1"]), ...hold("p-x", ["left-double-1", "left-double-2"]) } });
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
    { name: "", adults: 2, kids: 0, kids_in_parents_bed: 0, arrive: THU, leave: "2026-11-01", arrival_time: "", note: "", color: "", day_only: false, day_visits: [] });
  const p = party({ kids: 1, arrival_time: "po 18:00", note: "pes", color: "#2F7D6D" });
  assert.deepEqual(plain(L.partyToForm(p)),
    { name: "Ivan a Eva", adults: 2, kids: 1, kids_in_parents_bed: 0, arrive: THU, leave: "2026-11-01", arrival_time: "po 18:00", note: "pes", color: "#2F7D6D", day_only: false, day_visits: [] });
});

test("party payload trims text and reads counts", () => {
  const raw = { name: "  Ivan a Eva ", adults: "2", kids: "", kids_in_parents_bed: " 1 ", arrive: THU, leave: "2026-11-01", arrival_time: " 18:00 ", note: " pes\n" };
  assert.deepEqual(plain(L.partyPayload(raw)),
    { name: "Ivan a Eva", adults: 2, kids: 0, kids_in_parents_bed: 1, arrive: THU, leave: "2026-11-01", arrival_time: "18:00", note: "pes" });
  assert.ok(Number.isNaN(L.partyPayload({ ...raw, adults: "1.5" }).adults));
  assert.ok(Number.isNaN(L.partyPayload({ ...raw, kids: "-1" }).kids));
  assert.ok(Number.isNaN(L.partyPayload({ ...raw, kids: "?" }).kids));
});

const FORM_PALETTE = ["#2F7D6D", "#D07A2B", "#6D5BA8", "#C08A1E", "#3E6FB0", "#9C4A7A", "#5E8A2E", "#8A6A4A", "#2E8AA0", "#C0603A", "#7A7F2B", "#A04848"];

test("colorProblem: the palette passes, too light, too dark and bad formats fail", () => {
  assert.deepEqual(plain(L.PARTY_PALETTE), FORM_PALETTE);
  assert.equal(L.COLOR_MIN_LUMINANCE, 0.06);
  assert.equal(L.COLOR_MAX_LUMINANCE, 0.36);
  for (const c of FORM_PALETTE) assert.equal(L.colorProblem(c), null, c);
  assert.equal(L.colorProblem("#2f7d6d"), null);
  for (const c of ["#FFFFFF", "#E8D2A6"]) assert.equal(L.colorProblem(c), "color_too_light", c);
  for (const c of ["#000000", "#222222"]) assert.equal(L.colorProblem(c), "color_too_dark", c);
  for (const c of ["#abc", "red", "#GGGGGG", "", 123, null, undefined]) assert.equal(L.colorProblem(c), "color_format", String(c));
});

test("party payload carries the color only when one is chosen", () => {
  const raw = { ...L.defaultPartyForm(event), name: "Ivan a Eva" };
  assert.equal("color" in L.partyPayload(raw), false);                       // „Vyberie sa sama“
  assert.equal("color" in L.partyPayload({ ...raw, color: undefined }), false);
  assert.equal(L.partyPayload({ ...raw, color: " #3E6FB0 " }).color, "#3E6FB0");
});

test("form pre-check of the color names the field and the reason", () => {
  const ok = L.partyPayload({ ...L.defaultPartyForm(event), name: "Ivan a Eva", color: "#3E6FB0" });
  assert.equal(L.checkPartyPayload(ok, event), null);
  assert.equal(L.checkPartyPayload({ ...ok, color: undefined }, event), null);
  const e = (color, current) => L.checkPartyPayload({ ...ok, color }, event, current);
  assert.deepEqual(plain(e("#FFFFFF")), { code: "invalid", params: { field: "color", reason: "color_too_light" } });
  assert.deepEqual(plain(e("#000000")), { code: "invalid", params: { field: "color", reason: "color_too_dark" } });
  assert.deepEqual(plain(e("#abc")), { code: "invalid", params: { field: "color" } });
  assert.equal(e("#ffffff", "#FFFFFF"), null);                               // unchanged: not checked again
  assert.equal(L.errorField(e("#FFFFFF")), "color");
});

test("color errors have Slovak texts", () => {
  assert.equal(L.errorText(err("invalid", { field: "color", reason: "color_too_light", color: "#FFFFFF" })),
    "Táto farba je príliš svetlá, postavičku by na posteli nebolo vidno. Vyber tmavšiu.");
  assert.equal(L.errorText(err("invalid", { field: "color", reason: "color_too_dark", color: "#000000" })),
    "Táto farba je príliš tmavá, postavičku by na posteli nebolo vidno. Vyber svetlejšiu.");
  assert.equal(L.errorText(err("invalid", { field: "color" })), "Skontroluj pole „farba“.");
  assert.equal(L.errorField(err("invalid", { field: "color" })), "color");
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
  assert.equal(L.errorText(empty), "Napíš meno.");
  // a whitespace-only name is trimmed to empty by partyPayload
  const blank = L.partyPayload({ ...L.defaultPartyForm(event), name: "   " });
  assert.equal(L.errorText(L.checkPartyPayload(blank, event)), "Napíš meno.");
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
  assert.equal(L.errorText({ code: "duplicate_name", params: { field: "name", name: "Riso a Ben" } }, null), "Meno „Riso a Ben“ už niekto má. Skús iné.");
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
    { id: "p-aaaaaa", name: "Riso a Ben", color: "#2F7D6D", people: "2 dospelí, 1 dieťa", dayOnly: false, stay: "Št 29. 10. – Ne 1. 11.", mine: false, ch: "R", ink: "#F4EBD0" },
    { id: "p-bbbbbb", name: "Eva", color: "#D07A2B", people: "1 dospelý", dayOnly: false, stay: "Pi 30. 10. – So 31. 10.", mine: true, ch: "E", ink: "#2E1F14" }
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

// --- noticeboard: the 4-step flow (T-026) ---

const FOUR_LINES = ["1. Pridaj sa (koľko vás príde).", "2. Vyber, kto si.", "3. Ťukni na posteľ a zapíš sa.", "4. Skontroluj všetky tri noci."];

test("NOTICE_LINES is exactly the four numbered steps", () => {
  assert.deepEqual(plain(L.NOTICE_LINES), FOUR_LINES);
  for (const line of FOUR_LINES) assert.ok(line.length <= 34 && !line.includes('"'), line);
});

test("the notice is only the ? icon: 44x44, clear of rooms, doors, windows, the other boards and the signposts", () => {
  const n = scene.notice, windowsHere = [[186, 196, 24, 4], [300, 196, 24, 4]];
  assert.deepEqual(n, [328, 112, 44, 44]);
  for (const o of [...windowsHere, ...doors, ...realLayout.rooms.map((r) => r.rect)]) assert.ok(!overlap(n, o), `notice overlaps ${o}`);
  for (const [key, r] of Object.entries(scene)) {
    if (key === "notice") continue;
    assert.ok(!overlap(n, r), `notice overlaps scene.${key}`);
  }
  assert.ok(!overlap(n, [scene.nights[0], scene.nights[1], scene.nights[2], scene.nights[3] + 6]), "notice vs signposts with posts");
});

test("drawNotice draws only the ? icon, opens the Návod window, no innerHTML", () => {
  const body = html.slice(html.indexOf("function drawNotice("), html.indexOf("// The table of all parties"));
  assert.ok(body.length > 100);
  assert.match(body, /"Návod\. Ťuknutím ho otvoríš\."/);
  assert.match(body, /"notice", openNotice\)/);
  assert.match(body, /hitRect\(g, r\)/);
  assert.doesNotMatch(body, /NOTICE_LINES/);
  assert.doesNotMatch(body, /innerHTML/);
});

test("openNotice opens a centred panel with one textContent paragraph per step and returns focus to the ? icon", () => {
  const body = html.slice(html.indexOf("function openNotice("), html.indexOf("// --- scene ---"));
  assert.match(body, /openPanel\("Návod"/);
  assert.match(body, /NOTICE_LINES\.forEach/);
  assert.match(body, /returnKey: "notice"/);
  assert.match(body, /center: true/);
  assert.doesNotMatch(body, /innerHTML/);
});

test("the party table is drawn on every drawBoards, and no collapse state is left", () => {
  const body = html.slice(html.indexOf("function drawBoards("), html.indexOf("// The letter icon"));
  assert.match(body, /\n\s+drawPartyTable\(g, scene\.parties, state\);/);
  const gone = ["notice" + "Collapsed", "collapse" + "Notice", "expand" + "Notice", "notice" + "IconRect", "notice" + "Layout", "KEYS.notice"];
  for (const name of gone) assert.ok(!html.includes(name), `${name} is gone`);
});

// --- party table under the night signposts (T-023) ---

test("the party table clears the ? icon, the signposts, rooms, doors, windows and the other boards", () => {
  assert.ok(!overlap(scene.notice, scene.parties));
  assert.ok(!overlap(scene.parties, scene.nights));
  const windows = [[186, 196, 24, 4], [300, 196, 24, 4]];
  for (const o of [...windows, ...doors, ...realLayout.rooms.map((r) => r.rect)]) assert.ok(!overlap(scene.parties, o), `parties overlaps ${o}`);
  for (const [key, r] of Object.entries(scene)) {
    if (key === "parties") continue;
    assert.ok(!overlap(scene.parties, r), `parties overlaps scene.${key}`);
  }
});

test("tableCellText: all four kinds, also 1/0 for a night outside the stay", () => {
  const t = (kind, placed, needed) => ({ night: THU, present: true, needed, placed, kind });
  assert.equal(L.tableCellText(t("ok", 3, 3)), "3/3");
  assert.equal(L.tableCellText(t("under", 2, 3)), "2/3!");
  assert.equal(L.tableCellText(t("over", 4, 3)), "4/3");
  assert.equal(L.tableCellText(t("absent", 0, 0)), "–");
  const p = party({ adults: 2, leave: FRI });
  const s = stateWith([p], { [FRI]: hold(p.id, ["left-window-1"]) });
  assert.equal(L.tableCellText(L.nightTally(s, p, FRI)), "1/0");
});

const tp = (id, name, over = {}) => party({ id, name, ...over });
const tableState = () => {
  const a = tp("p-aaaaaa", "Ivan a Eva", { color: "#2F7D6D", adults: 3, leave: SAT });   // Thu and Fri nights
  const b = tp("p-bbbbbb", "Novákovci s veľmi dlhým menom", { color: "#6D5BA8", adults: 2, kids: 1, kids_in_parents_bed: 1 });
  const c = tp("p-cccccc", "<b>Eva</b>", { color: "#C0603A", adults: 1, arrive: FRI, leave: SAT });
  return stateWith([a, b, c], {
    [THU]: { ...hold(a.id, PAIR), ...hold(b.id, ["left-window-1", "left-cot-1-1"]) },
    [FRI]: hold(a.id, [...PAIR, "left-window-1", "left-cot-1-1"]),
    [SAT]: hold(c.id, ["left-cot-2-1"]),
  });
};

test("partyTableRows: state order, exact colour, mine, 14-character label, one cell per night", () => {
  const s = tableState();
  const rows = plain(L.partyTableRows(s, "p-bbbbbb"));
  assert.deepEqual(rows.map((r) => r.id), ["p-aaaaaa", "p-bbbbbb", "p-cccccc"]);
  assert.deepEqual(rows.map((r) => r.color), ["#2F7D6D", "#6D5BA8", "#C0603A"]);
  assert.deepEqual(rows.map((r) => r.mine), [false, true, false]);
  assert.equal(rows[1].name, "Novákovci s veľmi dlhým menom");
  assert.equal(rows[1].label, "Novákovci s v…");
  assert.equal(rows[1].label.length, 14);
  assert.ok(rows[1].label.endsWith("…"));
  assert.equal(rows[0].label, "Ivan a Eva");
  assert.equal(rows[2].label, "<b>Eva</b>");   // markup stays literal text, only a label
  assert.deepEqual(rows[0].cells, [
    { night: THU, kind: "under", text: "2/3!" }, { night: FRI, kind: "over", text: "4/3" }, { night: SAT, kind: "absent", text: "–" },
  ]);
  assert.ok(rows.every((r) => r.cells.map((c) => c.night).join() === [THU, FRI, SAT].join()));
  assert.deepEqual(plain(L.partyTableRows(stateWith([]), null)), []);
  assert.ok(plain(L.partyTableRows(s, null)).every((r) => r.mine === false));
});

test("partyTableRows: every cell equals the nightTally of that party and night", () => {
  const s = tableState();
  for (const row of L.partyTableRows(s, null)) {
    const p = s.parties.find((x) => x.id === row.id);
    row.cells.forEach((cell) => {
      const t = L.nightTally(s, p, cell.night);
      assert.equal(cell.kind, t.kind);
      assert.equal(cell.text, L.tableCellText(t));
      if (t.kind !== "absent") assert.ok(cell.text.startsWith(`${t.placed}/${t.needed}`));
    });
  }
});

// The real `map.scene.parties` of config/cabin.yaml (the `scene` fixture above is older).
const REAL_PARTIES_RECT = [176, 112, 196, 136];
const tableLay = (n, d, r = REAL_PARTIES_RECT) => plain(L.partyTableLayout(r, n, d, 3, 4));

function assertTableInside(l, r, label) {
  assert.ok(l.height <= r[3] + 1e-9, `${label}: height ${l.height} within the rect`);
  assert.ok(l.foodY + l.rowH + l.pad - r[1] <= r[3] + 1e-9, `${label}: food row inside`);
  assert.equal(l.day.colX[l.day.colX.length - 1] + l.colW, r[0] + r[2] - l.pad, `${label}: last column at the right edge`);
  for (const part of [l.night, l.day]) {
    assert.ok(part.nameW > 0);
    part.colX.forEach((x, i) => {
      assert.ok(x >= l.nameX + part.nameW - 1e-9, `${label}: columns start after the names`);
      if (i) assert.ok(x >= part.colX[i - 1] + l.colW - 1e-9, `${label}: columns do not overlap`);
    });
  }
  assert.ok(l.night.y0 + l.night.lines * l.rowH <= l.dividerY + 1e-9);
  assert.ok(l.dividerY < l.day.headY && l.day.y0 + l.day.lines * l.rowH <= l.ruleY + 1e-9 && l.ruleY < l.foodY);
}

test("partyTableLayout: 8 overnight and 2 day-only parties fit with no +N", () => {
  const l = tableLay(8, 2);
  assert.deepEqual([l.night.rows, l.night.more, l.day.rows, l.day.more], [8, 0, 2, 0]);
  assert.equal(l.rowH, 8.5);
  assertTableInside(l, REAL_PARTIES_RECT, "8+2");
});

test("partyTableLayout: nobody gives header, divider, day header and the food row only", () => {
  const l = tableLay(0, 0);
  assert.deepEqual([l.night.rows, l.night.more, l.night.lines, l.day.rows, l.day.more, l.day.lines], [0, 0, 0, 0, 0, 0]);
  assert.equal(l.night.y0, l.dividerY - 2);
  assert.equal(l.foodY, l.day.y0 + 3);
  assert.ok(l.height < 50);
  assertTableInside(l, REAL_PARTIES_RECT, "0+0");
  const noDay = tableLay(8, 0);
  assert.deepEqual([noDay.night.rows, noDay.night.more, noDay.day.lines], [8, 0, 0]);
});

test("partyTableLayout: the height grows with the rows and never passes the rect", () => {
  const h = (n, d) => tableLay(n, d).height;
  assert.equal(h(1, 0) - h(0, 0), 8.5);
  assert.equal(h(0, 1) - h(0, 0), 8.5);
  assert.equal(h(5, 2) - h(4, 2), 8.5);
  assert.ok(h(8, 2) > h(2, 2) && h(8, 2) > h(8, 0));
  for (const [n, d] of [[0, 0], [3, 0], [8, 2], [11, 0], [0, 11], [15, 4], [30, 30], [9, 3]]) {
    assertTableInside(tableLay(n, d), REAL_PARTIES_RECT, `${n}+${d}`);
  }
});

test("partyTableLayout: 15 overnight and 4 day-only show +N in both parts and stay inside the rect", () => {
  const l = tableLay(15, 4);
  assert.deepEqual([l.night.rows, l.night.more, l.night.lines], [8, 7, 9]);
  assert.deepEqual([l.day.rows, l.day.more, l.day.lines], [1, 3, 2]);
  assertTableInside(l, REAL_PARTIES_RECT, "15+4");
  assert.ok(Math.abs(l.height - REAL_PARTIES_RECT[3]) < 1e-9, "a full table is as tall as the rect");
});

test("partyTableLayout: the day part keeps min(dayRows, 2) lines, the night part gets the rest", () => {
  const one = tableLay(15, 1);
  assert.deepEqual([one.day.rows, one.day.more, one.night.rows, one.night.more], [1, 0, 9, 6]);
  const many = tableLay(3, 12);
  assert.deepEqual([many.night.rows, many.night.more, many.day.rows, many.day.more], [3, 0, 7, 5]);
  const none = tableLay(15, 0);
  assert.deepEqual([none.night.rows, none.night.more, none.day.lines], [10, 5, 0]);
  const exact = tableLay(9, 2);
  assert.deepEqual([exact.night.more, exact.day.more], [0, 0]);
  const over = tableLay(10, 2);
  assert.deepEqual([over.night.rows, over.night.more, over.day.more], [8, 2, 0]);
});

test("partyTableLayout: night column i is at the same x as day column i, the fourth night column is empty", () => {
  const l = tableLay(2, 1);
  assert.equal(l.night.nameW, 78);
  assert.equal(l.day.nameW, 78);
  assert.equal(l.day.colX.length, 4);
  assert.equal(l.night.colX.length, 3, "no night column (no cell, no header) under the last day");
  assert.deepEqual(l.night.colX, l.day.colX.slice(0, 3));
  assert.equal(l.day.colX[3] + l.colW, REAL_PARTIES_RECT[0] + REAL_PARTIES_RECT[2] - l.pad);
  assert.equal(l.nameX, 179);
});

test("partyTableLayout: the grid follows the larger count (more nights than days, and equal counts)", () => {
  const r = REAL_PARTIES_RECT;
  const more = plain(L.partyTableLayout(r, 1, 1, 5, 3));
  assert.equal(more.night.colX.length, 5);
  assert.equal(more.day.colX.length, 3);
  assert.deepEqual(more.day.colX, more.night.colX.slice(0, 3));
  assert.equal(more.night.colX[4] + more.colW, r[0] + r[2] - more.pad);
  const same = plain(L.partyTableLayout(r, 1, 1, 3, 3));
  assert.deepEqual(same.night.colX, same.day.colX);
  assert.equal(same.night.nameW, same.day.nameW);
});

test("dayColumnLabel: weekday and day of the month, empty for a bad date", () => {
  assert.equal(L.dayColumnLabel(THU), "Št 29");
  assert.equal(L.dayColumnLabel(FRI), "Pi 30");
  assert.equal(L.dayColumnLabel(SAT), "So 31");
  assert.equal(L.dayColumnLabel(FOURTH), "Ne 1");
  assert.equal(L.dayColumnLabel("x"), "");
  assert.equal(L.dayColumnLabel("2026-02-30"), "");
  assert.equal(L.dayColumnLabel(undefined), "");
});

test("moreText: 1, 2-4 and 5+ forms", () => {
  assert.equal(L.moreText(1), "+1 ďalšia");
  assert.equal(L.moreText(2), "+2 ďalšie");
  assert.equal(L.moreText(4), "+4 ďalšie");
  assert.equal(L.moreText(5), "+5 ďalších");
});

test("legendNightsText: the same cell texts as the table, one part per night", () => {
  const [row] = L.partyTableRows(tableState(), null);
  assert.equal(L.legendNightsText(row), "Št → Pi 2/3! · Pi → So 4/3 · So → Ne –");
  assert.deepEqual(plain(L.legendNightParts(row)), ["Št → Pi 2/3!", "Pi → So 4/3", "So → Ne –"]);
});

test("partyTableSummary: every cell kind with the plural forms, (ty) only for my party", () => {
  const a = tp("p-aaaaaa", "Ivan a Eva", { adults: 3, leave: SAT });
  const b = tp("p-bbbbbb", "Eva", { adults: 2, leave: FRI });
  const c = tp("p-cccccc", "Mrco", { adults: 4 });
  const s = stateWith([a, b, c], {
    [THU]: { ...hold(a.id, ["left-window-1", "left-cot-1-1", "left-cot-2-1"]), ...hold(b.id, PAIR) },
    [FRI]: { ...hold(a.id, [...PAIR, "left-window-1", "left-cot-1-1"]), ...hold(b.id, ["left-cot-2-1"]) },
    [SAT]: hold(c.id, ["left-window-1", "left-cot-1-1", "left-cot-2-1"]),
  });
  assert.deepEqual(plain(L.partyTableSummary(s, "p-aaaaaa")), [
    "Ivan a Eva (ty): Št → Pi 3 z 3, Pi → So 4 z 3, o 1 miesto viac, So → Ne nie je tu",
    "Eva: Št → Pi 2 z 2, Pi → So nie je tu, ale má 1 miesto, So → Ne nie je tu",
    "Mrco: Št → Pi 0 z 4, chýbajú 4 miesta, Pi → So 0 z 4, chýbajú 4 miesta, So → Ne 3 z 4, chýba 1 miesto",
  ]);
  const under1 = stateWith([a], { [THU]: hold(a.id, PAIR) });
  assert.ok(L.partyTableSummary(under1, null)[0].includes("Št → Pi 2 z 3, chýba 1 miesto"));
  assert.ok(L.partyTableSummary(stateWith([tp("p-aaaaaa", "Ivan a Eva")]), null)[0].startsWith("Ivan a Eva: "));
  assert.ok(!L.partyTableSummary(s, null).join().includes("(ty)"));
  const long = tp("p-dddddd", "Novákovci s veľmi dlhým menom");
  assert.ok(L.partyTableSummary(stateWith([long]), null)[0].startsWith("Novákovci s veľmi dlhým menom: "));
  assert.deepEqual(plain(L.partyTableSummary(stateWith([]), null)), []);
});

test("party table texts pass the tykanie guard", () => {
  const s = tableState();
  const texts = [...L.partyTableSummary(s, "p-aaaaaa"), ...L.partyTableRows(s, null).map((r) => L.legendNightsText(r)),
    ...[1, 2, 5].map((n) => L.moreText(n)), "Kto", "Zatiaľ tu nikto nie je.", "Kto kde spí po nociach",
    "Kto kde spí po nociach. Ťuknutím otvoríš „Kto je kto“."];
  for (const text of texts) assert.deepEqual(formalForms(text), [], text);
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
    [THU]: { ...hold(p.id, ["left-double-1", "left-double-2"]), "left-window-1": other.id },
    [FRI]: hold(p.id, ["left-double-1", "left-double-2"]),
    [SAT]: { ...hold(p.id, ["left-window-1", "hallway-sofa-1"]), "left-double-1": other.id },
  });
};

test("leave moved from Sunday to Saturday frees Saturday", () => {
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-aaaaaa", THU, SAT)),
    [{ night: SAT, slot: "left-window-1" }, { night: SAT, slot: "hallway-sofa-1" }]);
});

test("arrive moved from Thursday to Friday frees Thursday", () => {
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-aaaaaa", FRI, "2026-11-01")),
    [{ night: THU, slot: "left-double-1" }, { night: THU, slot: "left-double-2" }]);
});

test("a longer or unchanged stay frees nothing, and other parties' slots stay", () => {
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-aaaaaa", THU, "2026-11-01")), []);
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-bbbbbb", THU, FRI)), [{ night: SAT, slot: "left-double-1" }]);
  assert.deepEqual(plain(L.freedByStay(stayState(), "p-bbbbbb", FRI, SAT)), [{ night: THU, slot: "left-window-1" }, { night: SAT, slot: "left-double-1" }]);
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
    [THU]: { ...hold(ivan.id, ["left-double-1", "left-double-2"]), "konica-lower-mats-1": riso.id },
    [FRI]: { "left-double-1": ivan.id, "hallway-sofa-1": late.id },
    [SAT]: { ...hold(ivan.id, ["left-double-1", "left-double-2"]), "left-window-1": riso.id, "left-cot-1-1": riso.id, "konica-upper-single-1": late.id },
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
    "Tu sa zapíšeš: https://cabin.example/",
  ].join("\n");
  assert.equal(L.summaryText(summaryState(), "https://cabin.example/"), expected);
});

test("summary text has no warnings when everybody has a place, and never a code", () => {
  const p = party({ adults: 1, arrive: THU, leave: FRI });
  const text = L.summaryText(realState([p], { [THU]: { "left-window-1": p.id } }), "https://cabin.example/");
  assert.doesNotMatch(text, /Chýbajú/);
  assert.match(text, /Tu sa zapíšeš: https:\/\/cabin\.example\/$/);
  assert.doesNotMatch(text, /kód|code/i);
});

test("hidden summary for the selected night", () => {
  const h = L.hiddenSummary(summaryState(), SAT);
  assert.equal(h.title, "Chata 29. 10. – 1. 11.");
  assert.equal(h.dates, "29. 10. (štvrtok) – 1. 11. 2026 (nedeľa)");
  assert.deepEqual(plain(h.instructions), FOUR_LINES);
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
  const lines = L.summaryText(s, "https://cabin.example/").split("\n");
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
  // 6 up to the title board (bottom y 40), 8 down to the notice and the party table (y 112)
  assert.deepEqual(plain(L.nightsHit(realLayout, 8)), [176, 40, 196, 72]);
});

test("signpostLayout: boards and row baselines of the real rect", () => {
  const lay = plain(L.signpostLayout([176, 46, 196, 58], 3, 4));
  const w = 188 / 3;
  assert.equal(lay.w, w);
  assert.deepEqual(lay.boards, [0, 1, 2].map((i) => [176 + i * (w + 4), 46, w, 58]));
  assert.deepEqual([lay.label, lay.date, lay.absent, lay.used, lay.total], [58, 67, 77, 89, 98]);
  assert.deepEqual(lay.chip, [70, 10]);
  assert.equal(lay.chipText, 78);
});

test("signpostLayout: rows keep their order and do not overlap on the scene's nights rect", () => {
  const r = scene.nights, lay = plain(L.signpostLayout(r, 3, 4));
  const [chipTop, chipH] = lay.chip;
  assert.ok(r[3] >= 44, "a signpost is at least 44 units tall");
  assert.ok(lay.label < lay.date && lay.date < chipTop, "label, date, chip in order");
  assert.ok(chipTop + chipH < lay.used - 5, "the chip ends above the cap height of obsadené (6.5)");
  assert.ok(lay.chip[0] + chipH > lay.chipText && lay.chipText > chipTop, "chip text sits inside the chip");
  assert.ok(lay.date < lay.absent - 5 && lay.absent < lay.used - 5, "nie si tu between date and obsadené");
  assert.ok(lay.used < lay.total && lay.total < r[1] + r[3], "obsadené, count, board bottom");
  assert.ok(lay.label > r[1]);
});

test("scene: title board, signposts with posts, and the other boards and rooms do not overlap", () => {
  const posts = [scene.nights[0], scene.nights[1], scene.nights[2], scene.nights[3] + 6];   // posts end 6 units below the boards
  assert.ok(!overlap(scene.title, posts), "title vs signposts");
  assert.ok(scene.title[1] + scene.title[3] <= scene.nights[1], "title above signposts");
  for (const key of ["notice", "parties"]) assert.ok(!overlap(posts, scene[key]), `signposts overlap scene.${key}`);
  for (const room of realLayout.rooms) assert.ok(!overlap(posts, room.rect), `signposts overlap ${room.id}`);
  for (const room of realLayout.rooms) assert.ok(!overlap(scene.title, room.rect), `title overlaps ${room.id}`);
  for (const key of ["notice", "parties"]) assert.ok(!overlap(scene.title, scene[key]), `title overlaps scene.${key}`);
});

test("drawTitle and drawNights read their positions from the layout, not from numbers", () => {
  const draw = html.slice(html.indexOf("function drawTitle("), html.indexOf("function drawNotice("));
  assert.match(draw, /signpostLayout\(scene\.nights/);
  assert.match(draw, /titleLabel\(state\.event\)/);
  assert.doesNotMatch(draw, /eventDateText/);
  assert.doesNotMatch(draw, /r\[1\] \+ ([1-9]\d|[7-9])\b/, "no row offsets from the rect top (the 6-unit nails are fine)");
  assert.doesNotMatch(draw, /innerHTML/);
});

test("a far neighbour does not stretch the signpost hit area, and a room is never covered", () => {
  const moved = { ...realLayout, map: { ...realLayout.map, scene: { ...scene, notice: [176, 330, 196, 66], title: [176, 10, 196, 10] } } };
  assert.deepEqual(plain(L.nightsHit(moved, 8)), [176, 38, 196, 74]);   // 8 up and 8 down, not down to y=330
  const close = { ...moved, rooms: [{ ...rooms[3], rect: [176, 107, 100, 50], beds: [] }] };
  assert.deepEqual(plain(L.nightsHit(close, 8)), [176, 38, 196, 69]);   // stops 3 units above the room
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
  assert.deepEqual(plain(L.bedHit(realLayout, bedById("left-window"), 8)), [179, 212, 39, 50]);   // half the gap to its neighbours
  const moved = { ...realLayout, rooms: realLayout.rooms.map((r) => ({ ...r, beds: r.beds.map((b) => (b.id === "left-window" ? { ...b, rect: [20, 312, 24, 34] } : b)) })) };
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
  assert.doesNotMatch(html, /<header|<nav|Zoznam(?! na zbalenie)/);
});

test("page: no bed, room or slot geometry or names are hardcoded in the page code", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(app + logicSource, /konica|hallway|kitchen|["'`](left|right)["'`]|(left|right)-(double|window|cot|bunk|sofa)/i);
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

test("zoom: clampView keeps the aspect ratio, 0.6x to 4x, and stays inside the pan range", () => {
  const tooFar = plain(L.clampView({ x: -50, y: 900, w: 10, h: 10 }, SB));
  near(tooFar.w, 95);
  near(tooFar.h, 103);
  near(tooFar.x, -23.75);          // T-025: PAN_MARGIN of the view past the bounds (was 0)
  near(tooFar.y, SH - 103 + 25.75);    // was SH - 103
  const tooWide = plain(L.clampView({ x: 30, y: 30, w: 900, h: 900 }, SB));
  // wider than 1/ZOOM_MIN: the 0.6x view; a position inside the pan range is kept (was: centered)
  near(tooWide.w, 380 / 0.6);
  near(tooWide.h, 412 / 0.6);
  near(tooWide.x, 30);
  near(tooWide.y, 30);
  const right = plain(L.clampView({ x: 400, y: 0, w: 190, h: 206 }, SB));
  near(right.x, 237.5);            // was 190
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
  // zooming out at 1x stops at 0.6x, also at a corner; the position lies in the pan range (was: centered)
  let o = L.wholeView(SB);
  for (let i = 0; i < 20; i++) o = L.zoomView(o, SB, 0.5, 379, 411);
  near(o.w, 380 / 0.6);
  near(o.h, 412 / 0.6);
  const oRange = L.panRange(o.w, SB);
  assert.ok(o.x >= oRange[0] - 1e-6 && o.x <= oRange[1] + 1e-6 && o.y >= oRange[2] - 1e-6 && o.y <= oRange[3] + 1e-6);
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

test("zoom: panView and dragView move the window and never leave the pan range", () => {
  const z = L.zoomView(L.wholeView(SB), SB, 2, 190, 206);
  assert.deepEqual(plain(z), { x: 95, y: 103, w: 190, h: 206 });
  assert.deepEqual(plain(L.panView(z, SB, 20, -30)), { x: 115, y: 73, w: 190, h: 206 });
  // T-025: the margin lets the view go a quarter of its size past the bounds (was { x: 190, y: 206 } and { x: 0, y: 0 })
  assert.deepEqual(plain(L.panView(z, SB, 999, 999)), { x: 237.5, y: 257.5, w: 190, h: 206 });
  assert.deepEqual(plain(L.panView(z, SB, -999, -999)), { x: -47.5, y: -51.5, w: 190, h: 206 });
  // dragging the map right by 38 screen px (the svg is 380 px wide) moves the window left by 19 units
  const d = plain(L.dragView(z, SB, BOX, 38, 0));
  near(d.x, 95 - 19);
  near(d.y, 103);
  // at 1x the map can be dragged a quarter of its size past the bounds (was: nowhere to go)
  assert.deepEqual(plain(L.dragView(L.wholeView(SB), SB, BOX, 80, 80)), { x: -80, y: -80, w: 380, h: 412 });
  assert.deepEqual(plain(L.dragView(L.wholeView(SB), SB, BOX, 5000, 5000)), { x: -95, y: -103, w: 380, h: 412 });
  // below 1x the view can be panned by the same margin, and the width stays (was: always centered)
  const out = plain(L.clampView({ x: 0, y: 0, w: 380 / 0.6, h: 412 / 0.6 }, SB));
  const hi = plain(L.panView(out, SB, 999, 999)), lo = plain(L.panView(out, SB, -999, -999));
  near(hi.x, 31.666667, "x"); near(hi.y, 34.333333, "y");
  near(lo.x, -285); near(lo.y, -309);
  near(hi.w, 380 / 0.6); near(lo.w, 380 / 0.6);
});

test("zoom: PAN_MARGIN and panRange are the one place the pan range is computed", () => {
  assert.equal(L.PAN_MARGIN, 0.25);
  const rounded = (w) => plain(L.panRange(w, SB)).map((n) => Math.round(n * 1000) / 1000);
  assert.deepEqual(rounded(95), [-23.75, 308.75, -25.75, 334.75]);
  assert.deepEqual(rounded(190), [-47.5, 237.5, -51.5, 257.5]);
  assert.deepEqual(rounded(380), [-95, 95, -103, 103]);
  assert.deepEqual(rounded(380 / 0.6), [-285, 31.667, -309, 34.333]);
  // continuous at 1x
  const at1 = plain(L.panRange(380, SB));
  for (const w of [380 - 1e-6, 380 + 1e-6]) {
    plain(L.panRange(w, SB)).forEach((n, i) => assert.ok(Math.abs(n - at1[i]) < 1e-3, `w ${w} [${i}]`));
  }
  // clampView takes its limits from panRange only
  const code = logicSource.replace(/\/\/.*$/gm, "");
  assert.ok(!/bounds\.x \+ bounds\.w - w/.test(code), "no second pan limit expression is left");
  assert.ok(!/bounds\.y \+ bounds\.h - h/.test(code), "no second pan limit expression is left");
});

test("zoom: the map is never lost, the overlap with the bounds stays large", () => {
  const boundsList = [SB, L.fitBounds(390, 844, SW, SH), L.fitBounds(844, 390, SW, SH), L.fitBounds(1280, 800, SW, SH)];
  for (const B of boundsList) {
    for (const z of [0.6, 0.8, 1, 1.5, 2, 4]) {
      const w = B.w / z, h = B.h / z;
      const r = plain(L.panRange(w, B));
      for (const x of [r[0], r[1]]) for (const y of [r[2], r[3]]) {
        const v = plain(L.clampView({ x, y, w, h }, B));
        near(v.x, x); near(v.y, y); near(v.w, w);
        const ox = Math.min(v.x + v.w, B.x + B.w) - Math.max(v.x, B.x);
        const oy = Math.min(v.y + v.h, B.y + B.h) - Math.max(v.y, B.y);
        assert.ok(ox >= (1 - L.PAN_MARGIN) * Math.min(v.w, B.w) - 1e-6, `x overlap ${z}x`);
        assert.ok(oy >= (1 - L.PAN_MARGIN) * Math.min(v.h, B.h) - 1e-6, `y overlap ${z}x`);
      }
    }
  }
});

test("zoom: isOffCenter and resetShown", () => {
  const whole = L.wholeView(SB);
  const out = L.clampView({ x: 0, y: 0, w: 1e9, h: 1e9 }, SB);
  assert.equal(L.isOffCenter(whole, SB), false);
  assert.equal(L.resetShown(whole, SB), false);
  const centeredOut = { x: (380 - 380 / 0.6) / 2, y: (412 - 412 / 0.6) / 2, w: 380 / 0.6, h: 412 / 0.6 };
  assert.equal(L.isOffCenter(centeredOut, SB), false);
  assert.equal(L.resetShown(centeredOut, SB), false);
  assert.equal(L.isOffCenter(L.panView(whole, SB, 1, 0), SB), true);
  assert.equal(L.resetShown(L.panView(whole, SB, 0, 1), SB), true);
  assert.equal(L.isOffCenter(L.panView(whole, SB, 0.4, 0.4), SB), false);
  assert.equal(L.resetShown(L.panView(whole, SB, 0.4, 0.4), SB), false);
  const two = { x: 95, y: 103, w: 190, h: 206 };
  assert.equal(L.isOffCenter(two, SB), false);
  assert.equal(L.resetShown(two, SB), true);
  assert.equal(L.resetShown(L.panView(out, SB, 50, 0), SB), true);
});

test("zoom: the page drags at every zoom and shows the reset button when off home", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /setView\(dragView\(app\.view, app\.bounds, box\(\), e\.clientX - drag\.lx, e\.clientY - drag\.ly\)\)/);
  assert.doesNotMatch(app, /if \(isZoomed\(app\.view, app\.bounds\)\) setView\(dragView/);
  assert.match(app, /app\.zoomReset\.hidden = introActive\(\) \|\| !resetShown\(app\.view, app\.bounds\)/);
  assert.match(app, /!resetShown\(app\.view, app\.bounds\) \|\| !node\.getBBox \|\| Date\.now\(\)/);
  assert.match(app, /node === svg \|\| !resetShown\(app\.view, app\.bounds\)\) return;/);
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
  // may go up to the pan margin past the scene (T-025; was: never leaves the scene, x 285 and y 309)
  const edge = plain(L.revealRect(z, SB, [370, 400, 10, 10], 6));
  near(edge.x, 370 + 10 + 6 - 95);
  near(edge.y, 400 + 10 + 6 - 103);
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

test("zoom: bad input never gives a view wider than the zoom range or outside panRange", () => {
  const bads = [NaN, undefined, Infinity, -Infinity, "x", null, -1, 0, 1e9, -1e9];
  const check = (v, label) => {
    assert.ok(Object.values(v).every(Number.isFinite), `${label}: ${JSON.stringify(v)}`);
    assert.ok(v.w <= SB.w / L.ZOOM_MIN + 1e-9, `${label}: too wide ${v.w}`);
    const [xMin, xMax, yMin, yMax] = L.panRange(v.w, SB);
    assert.ok(v.x >= xMin - 1e-9 && v.x <= xMax + 1e-9, `${label}: x ${v.x} outside [${xMin}, ${xMax}]`);
    assert.ok(v.y >= yMin - 1e-9 && v.y <= yMax + 1e-9, `${label}: y ${v.y} outside [${yMin}, ${yMax}]`);
  };
  const z = { x: 95, y: 103, w: 190, h: 206 };
  for (const bad of bads) {
    check(plain(L.clampView({ x: bad, y: 0, w: 190, h: 206 }, SB)), `clampView x=${bad}`);
    check(plain(L.clampView({ x: 0, y: bad, w: 190, h: 206 }, SB)), `clampView y=${bad}`);
    check(plain(L.clampView({ x: 0, y: 0, w: bad, h: 206 }, SB)), `clampView w=${bad}`);
    check(plain(L.zoomView(z, SB, bad, 100, 100)), `zoomView factor=${bad}`);
    check(plain(L.zoomView(z, SB, 1.5, bad, bad)), `zoomView point=${bad}`);
    check(plain(L.panView(z, SB, bad, bad)), `panView=${bad}`);
    check(plain(L.dragView(z, SB, BOX, bad, bad)), `dragView=${bad}`);
    check(plain(L.pinchView(z, SB, BOX, { x: bad, y: 1, dist: 10 }, { x: 1, y: 1, dist: 20 })), `pinchView=${bad}`);
    check(plain(L.revealRect(z, SB, [bad, 0, 10, 10], 6)), `revealRect=${bad}`);
  }
  check(plain(L.clampView({ x: 0, y: 0, w: 1e9, h: 1e9 }, SB)), "huge w");
  check(plain(L.clampView({ x: 1e9, y: -1e9, w: 190, h: 206 }, SB)), "huge x/y");
});

test("page: every inline script parses (a syntax error would kill the whole page)", () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/.test(m[1]))
    .map((m) => ({ attrs: m[1].trim(), source: m[2] }));
  assert.ok(scripts.some((s) => /id="logic"/.test(s.attrs)), "the logic script is present");
  assert.ok(scripts.some((s) => /id="app"/.test(s.attrs)), "the app script is present");
  for (const s of scripts) {
    assert.doesNotThrow(() => new vm.Script(s.source, { filename: `index.html <script ${s.attrs}>` }), s.attrs);
  }
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
  // panning stops a PAN_MARGIN of the view past the bounds (T-025; was: at the bounds)
  const far = plain(L.panView(v, B, -999, -999));
  near(far.x, B.x - 0.25 * v.w); near(far.y, B.y - 0.25 * v.h);
  const farEnd = plain(L.panView(v, B, 999, 999));
  near(farEnd.x + farEnd.w, B.x + B.w + 0.25 * v.w);
  near(farEnd.y + farEnd.h, B.y + B.h + 0.25 * v.h);
  assert.ok(far.y < 0 && farEnd.y + farEnd.h > SH, "the grass beyond the scene can be reached");
  // 4x of the extended view is the limit, 0.6x the other
  for (let i = 0; i < 30; i++) v = L.zoomView(v, B, 1.5, 190, 206);
  near(L.viewZoom(v, B), 4);
  for (let i = 0; i < 30; i++) v = L.zoomView(v, B, 1 / 1.5, 190, 206);
  near(L.viewZoom(v, B), 0.6);
  const vr = plain(L.panRange(v.w, B));      // was: centered on the bounds
  assert.ok(v.x >= vr[0] - 1e-6 && v.x <= vr[1] + 1e-6 && v.y >= vr[2] - 1e-6 && v.y <= vr[3] + 1e-6);
  assert.equal(L.isZoomed(v, B), false);
  // a pinch and a drag stay inside the bounds too
  const box = { left: 0, top: 0, width: 390, height: 750 };
  const p = plain(L.pinchView(whole, B, box, { x: 195, y: 375, dist: 100 }, { x: 195, y: 375, dist: 400 }));
  near(L.viewZoom(p, B), 4);
  const d = plain(L.dragView(p, B, box, 5000, 5000));
  near(d.x, B.x - 0.25 * p.w); near(d.y, B.y - 0.25 * p.h);
  const still = plain(L.dragView(whole, B, box, 80, 80));    // at 1x the map moves by the drag (was: nowhere to go)
  near(still.x, B.x - 80 * B.w / 390); near(still.y, B.y - 80 * B.w / 390); near(still.w, whole.w); near(still.h, whole.h);
  // revealRect keeps a bed inside the pan range (was: inside the bounds)
  const r = plain(L.revealRect(L.zoomView(whole, B, 4, 0, 0), B, [300, 400, 20, 10], 6));
  assert.ok(r.x + r.w <= B.x + B.w + 0.25 * r.w + 1e-9 && r.y + r.h <= B.y + B.h + 0.25 * r.h + 1e-9);
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
  const rr = plain(L.panRange(rotated.w, landscape));      // T-025: inside the pan range (was: inside the bounds)
  assert.ok(rotated.x >= rr[0] - 1e-9 && rotated.x <= rr[1] + 1e-9 && rotated.y >= rr[2] - 1e-9 && rotated.y <= rr[3] + 1e-9);
  // a center near an edge that the new bounds do not have is pulled back inside the pan range
  const corner = L.zoomView(L.wholeView(portrait), portrait, 4, portrait.x, portrait.y);
  const back = plain(L.refitView(corner, portrait, landscape));
  const br = plain(L.panRange(back.w, landscape));
  assert.ok(back.x >= br[0] - 1e-9 && back.x <= br[1] + 1e-9 && back.y >= br[2] - 1e-9 && back.y <= br[3] + 1e-9);
  // garbage in, whole view out
  assert.deepEqual(plain(L.refitView(undefined, portrait, landscape)), plain(L.wholeView(landscape)));
  assert.deepEqual(plain(L.refitView({ x: NaN, y: 0, w: 50, h: 50 }, portrait, landscape)), plain(L.wholeView(landscape)));
});

test("fit: a view panned at exactly 1x becomes the whole new bounds (T-025)", () => {
  const portrait = L.fitBounds(390, 750, SW, SH), landscape = L.fitBounds(750, 390, SW, SH);
  const panned = L.dragView(L.wholeView(portrait), portrait, { left: 0, top: 0, width: 390, height: 750 }, 60, -40);
  assert.equal(L.isOffCenter(panned, portrait), true);
  assert.deepEqual(plain(L.refitView(panned, portrait, landscape)), plain(L.wholeView(landscape)));
});

test("zoom: a pinch at 1x and below pans with the fingers (T-025)", () => {
  const whole = L.wholeView(SB);
  const moved = plain(L.pinchView(whole, SB, BOX, { x: 200, y: 226, dist: 100 }, { x: 240, y: 246, dist: 100 }));
  near(moved.x, -40); near(moved.y, -20); near(moved.w, 380);
  const out = L.clampView({ x: 0, y: 0, w: 1e9, h: 1e9 }, SB);
  const p = plain(L.pinchView(out, SB, BOX, { x: 200, y: 226, dist: 100 }, { x: 180, y: 226, dist: 100 }));
  near(p.w, out.w);
  assert.ok(p.x > out.x);
});

test("fit: a resize keeps a zoomed-out view zoomed out and inside the pan range; whole stays whole", () => {
  const portrait = L.fitBounds(390, 750, SW, SH), landscape = L.fitBounds(750, 390, SW, SH);
  let out = L.wholeView(portrait);
  for (let i = 0; i < 20; i++) out = L.zoomView(out, portrait, 0.8, portrait.x, portrait.y);
  near(L.viewZoom(out, portrait), 0.6);
  const rotated = plain(L.refitView(out, portrait, landscape));
  near(L.viewZoom(rotated, landscape), 0.6);
  const rr = plain(L.panRange(rotated.w, landscape));      // T-025: was centered on the new bounds
  assert.ok(rotated.x >= rr[0] - 1e-9 && rotated.x <= rr[1] + 1e-9 && rotated.y >= rr[2] - 1e-9 && rotated.y <= rr[3] + 1e-9);
  near(rotated.w / rotated.h, landscape.w / landscape.h);
  assert.deepEqual(plain(L.refitView(L.wholeView(portrait), portrait, landscape)), plain(L.wholeView(landscape)));
  // a bad view still falls back to the whole new bounds
  assert.deepEqual(plain(L.refitView({ x: NaN, y: 0, w: 900, h: 900 }, portrait, landscape)), plain(L.wholeView(landscape)));
});

test("fit: groundRect covers what the view shows at 0.6x at every corner of its pan range", () => {
  const fixtures = [[390, 844], [844, 390], [1280, 800], [380, 412]];
  for (const [vw, vh] of fixtures) {
    const B = L.fitBounds(vw, vh, SW, SH);
    const g = plain(L.groundRect(B));
    const w = B.w / 0.6, h = B.h / 0.6, r = plain(L.panRange(w, B));      // the widest view allowed
    for (const x of [r[0], r[1]]) for (const y of [r[2], r[3]]) {
      const out = plain(L.clampView({ x, y, w, h }, B));
      assert.ok(g[0] <= out.x - 2 + 1e-6 && g[1] <= out.y - 2 + 1e-6, `${vw}x${vh}`);
      assert.ok(g[0] + g[2] >= out.x + out.w + 2 - 1e-6 && g[1] + g[3] >= out.y + out.h + 2 - 1e-6, `${vw}x${vh}`);
    }
    assert.ok(g[0] < B.x && g[1] < B.y && g[0] + g[2] > B.x + B.w && g[1] + g[3] > B.y + B.h, `${vw}x${vh}`);
    near(g[0] + g[2] / 2, B.x + B.w / 2);
    near(g[1] + g[3] / 2, B.y + B.h / 2);
  }
  assert.deepEqual(plain(L.groundRect(SB)).map((n) => Math.round(n * 1000) / 1000),
    [-287, -311, 954, 1034]);      // T-025 (was [-128.667, -139.333, 637.333, 690.667])
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

test("page: autumn palette and the loading splash (T-012, T-022)", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.ok(!html.includes("79B35A"));
  assert.match(html, /--bg: #EFE5D3;/);
  assert.match(html, /--bg: #1A1410;/);
  assert.match(html, /<p id="bootText">Načítavam…<\/p>/);
  assert.match(html, /<div id="boot" class="boot" role="status">\s*<canvas id="bootCanvas" aria-hidden="true"><\/canvas>/);
  assert.ok(!/\$\("boot"\)\.textContent/.test(app));
  assert.match(app, /\$\("bootText"\)\.textContent = "Nepodarilo sa načítať/);
  assert.ok(!/innerHTML/.test(app.replace(/\/\/.*$/gm, "")));
});

test("page: the leaf of T-012 is gone (T-022)", () => {
  assert.doesNotMatch(html, /leafFall/);
  assert.doesNotMatch(html, /\.leaf\b/);
  assert.doesNotMatch(html, /boot--fade/);
  const boot = html.match(/<div id="boot"[\s\S]*?<p id="bootText">/)[0];
  assert.doesNotMatch(boot, /<svg/);
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
  assert.match(app, /if \(!bar\.hidden\) top = Math\.max\(top, bar\.offsetHeight\);/);
  assert.match(app, /else top = Math\.max\(top, questBottom\(\)\);/);
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

// --- loading intro and splash (T-015, T-022) ---

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

test("bootMinMs and bootFallMs: the still time and the fall time, shorter or none with reduced motion", () => {
  assert.equal(L.bootMinMs(false), 1500);
  assert.equal(L.bootMinMs(true), 800);
  assert.equal(L.BOOT_MIN_MS, 1500);
  assert.equal(L.BOOT_MIN_REDUCED_MS, 800);
  assert.equal(L.BOOT_FALL_MS, 1100);
  assert.equal(L.bootFallMs(true), 0);
  assert.equal(L.bootFallMs(false), L.BOOT_FALL_MS);
});

const GRIDS = [[26, 57], [28, 50], [51, 29]];

test("splashGrid: a capped block count, blocks of 10 to 40 px", () => {
  assert.deepEqual(plain(L.splashGrid(380, 844)), { size: 15, cols: 26, rows: 57 });
  assert.deepEqual(plain(L.splashGrid(360, 640)), { size: 13, cols: 28, rows: 50 });
  assert.deepEqual(plain(L.splashGrid(1920, 1080)), { size: 38, cols: 51, rows: 29 });
  for (const [vw, vh] of [[360, 640], [380, 844], [390, 844], [768, 1024], [1440, 900], [1920, 1080]]) {
    const g = plain(L.splashGrid(vw, vh));
    assert.ok(g.cols * g.size >= vw && g.rows * g.size >= vh, `${vw}x${vh} covers the viewport`);
    assert.ok(g.size >= 10 && g.size <= 40, `${vw}x${vh} size ${g.size}`);
    assert.ok(g.cols * g.rows >= 300 && g.cols * g.rows <= 1600, `${vw}x${vh} count ${g.cols * g.rows}`);
  }
  assert.equal(L.splashGrid(100, 100).size, 10);
  assert.equal(L.splashGrid(3840, 2160).size, 40);
  for (const bad of [[NaN, 800], [800, NaN], [0, 800], [800, 0], [-5, 800], [800, -5], [Infinity, 800], [undefined, undefined]]) {
    const g = plain(L.splashGrid(...bad));
    assert.equal(g.cols, 0, String(bad));
    assert.equal(g.rows, 0, String(bad));
    assert.equal(g.size, 10, String(bad));
  }
});

// The keys of the COLORS literal in the app script.
function appColorKeys() {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  const literal = app.match(/var COLORS = \{([\s\S]*?)\n  \};/)[1];
  return [...literal.matchAll(/(\w+):\s*"#/g)].map((m) => m[1]);
}

test("splashPicture: rows x cols of COLORS keys, deterministic, with the cabin in the middle", () => {
  const colorKeys = appColorKeys();
  assert.ok(colorKeys.length > 30);
  for (const key of L.SPLASH_COLOR_KEYS) assert.ok(colorKeys.includes(key), `${key} is a key of COLORS`);
  const allowed = new Set(L.SPLASH_COLOR_KEYS);
  for (const [cols, rows] of [...GRIDS, [1, 1]]) {
    const pic = plain(L.splashPicture(cols, rows));
    assert.equal(pic.length, rows);
    for (const line of pic) {
      assert.equal(line.length, cols);
      for (const key of line) assert.ok(allowed.has(key), `${key} at ${cols}x${rows}`);
    }
    assert.deepEqual(plain(L.splashPicture(cols, rows)), pic);
  }
  assert.deepEqual(plain(L.splashPicture(0, 0)), []);
  assert.deepEqual(plain(L.splashPicture(0, 10)), []);
  assert.deepEqual(plain(L.splashPicture(10, 0)), []);
  // a grid narrower than the sprite is clipped, not an error
  assert.equal(L.splashPicture(5, 8).length, 8);

  for (const [cols, rows] of [[26, 57], [51, 29]]) {
    const pic = plain(L.splashPicture(cols, rows));
    const mid = Math.floor(cols / 2);
    const near = (key) => pic.some((line) => line.slice(mid - 5, mid + 5).includes(key));
    assert.ok(near("plank"), `door at ${cols}x${rows}`);
    assert.ok(near("selected"), `lit windows at ${cols}x${rows}`);
    assert.ok(near("path"), `path at ${cols}x${rows}`);
    assert.ok(pic[0].includes("window"), `sky at ${cols}x${rows}`);
    assert.ok(pic[rows - 1].includes("grass") || pic[rows - 1].includes("tuft"), `grass at ${cols}x${rows}`);
  }
});

test("splashPicture: trees on both sides only when they fit, leaves on the grass", () => {
  const crown = ["leafRust", "leafOchre", "leafRed"];
  const wide = plain(L.splashPicture(51, 29));
  const sky = wide.slice(6, 14);                // crowns reach into the sky rows; grass leaves are lower
  for (const [from, to] of [[0, 17], [34, 51]]) {
    for (const key of crown) {
      assert.ok(sky.some((line) => line.slice(from, to).includes(key)), `${key} in columns ${from} to ${to}`);
    }
  }
  const narrow = plain(L.splashPicture(26, 57));
  assert.ok(!narrow.slice(0, 19).some((line) => line.some((key) => crown.includes(key))), "no trees in the sky of a phone grid (the roof is lower)");
  assert.ok(narrow.slice(40).some((line) => line.includes("leafRust") || line.includes("leafOchre") || line.includes("leafRed")));
});

test("splashIrisCenter: the middle of the cabin door in the picture", () => {
  for (const [cols, rows] of GRIDS) {
    const pic = plain(L.splashPicture(cols, rows));
    const { col, row } = plain(L.splashIrisCenter(cols, rows));
    assert.ok(Number.isInteger(col) && Number.isInteger(row));
    // the door planks are left and right of the center column, above and below the center row
    for (const [c, r] of [[col - 1, row - 1], [col, row - 1], [col - 1, row], [col, row]]) {
      assert.ok(["plank", "woodLight"].includes(pic[r][c]), `${cols}x${rows}: ${pic[r][c]} at ${c},${r}`);
    }
  }
});

test("splashIrisRadius: none before the start, held within a step, growing faster, clears every block by the end", () => {
  for (const [cols, rows] of GRIDS) {
    const center = L.splashIrisCenter(cols, rows);
    assert.equal(L.splashIrisRadius(-1, cols, rows), 0);
    assert.ok(L.splashIrisRadius(0, cols, rows) > 0, "the first step already opens a hole");
    assert.equal(L.splashIrisRadius(L.SPLASH_STEP_MS, cols, rows), L.splashIrisRadius(L.SPLASH_STEP_MS * 2 - 1, cols, rows));
    let last = 0, moves = 0;
    for (let t = 0; t <= L.BOOT_FALL_MS + 400; t += 7) {
      const r = L.splashIrisRadius(t, cols, rows);
      assert.ok(r >= last, `never shrinks at ${t}`);
      if (r !== last) moves++;
      last = r;
    }
    assert.equal(moves, Math.ceil(L.BOOT_FALL_MS / L.SPLASH_STEP_MS), "it moves in visible steps");
    // it accelerates: half the time opens much less than half the radius
    const end = L.splashIrisRadius(L.BOOT_FALL_MS - 1, cols, rows);
    assert.ok(L.splashIrisRadius(L.BOOT_FALL_MS / 2, cols, rows) < end / 2);
    // the last step, still before the end timer, has cleared every block
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) assert.ok(L.splashIrisGone(c, r, center, end), `${cols}x${rows}: ${c},${r} left`);
    }
  }
  for (const bad of [[NaN, 26, 57], [undefined, 26, 57], [100, 0, 57], [100, 26, NaN]]) {
    assert.equal(L.splashIrisRadius(...bad), 0);
  }
});

test("splashIrisGone and splashIrisReaches: inside the radius, measured from the block center or the box's nearest point", () => {
  const center = { col: 10, row: 20 };
  assert.equal(L.splashIrisGone(9, 19, center, 0), false);
  assert.equal(L.splashIrisGone(9, 19, center, 1), true);       // block center at (9.5, 19.5)
  assert.equal(L.splashIrisGone(12, 20, center, 2.5), false);   // (12.5, 20.5) is 2.55 away
  assert.equal(L.splashIrisGone(12, 20, center, 2.6), true);
  const box = { x0: 6, y0: 30, x1: 14, y1: 32 };
  assert.equal(L.splashIrisReaches(box, center, 10), false);     // the nearest point (10, 30) is 10 away
  assert.equal(L.splashIrisReaches(box, center, 10.01), true);
  assert.equal(L.splashIrisReaches({ x0: 0, y0: 0, x1: 30, y1: 40 }, center, 0.01), true);   // the center is inside
});

test("page: the exit lets taps through and hides the sign when the iris reaches it", () => {
  assert.match(html, /#boot\.boot--falling \{[^}]*pointer-events: none;/);
  assert.match(html, /#boot\.boot--falling \{[^}]*background: transparent;/);
  assert.match(html, /#boot\.boot--sign-gone #bootText \{ visibility: hidden; \}/);
  assert.doesNotMatch(html, /bootSignDrop|SPLASH_BLOCK_FALL_MS|splashFall|splashDelay/);
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /splashIrisReaches\(splash\.signBox, splash\.center, radius\)/);
  for (const fn of ["hideBoot", "showBoot"]) {
    const body = app.match(new RegExp("function " + fn + "\\(\\) \\{[\\s\\S]*?\\n  \\}\\n"))[0];
    assert.match(body, /"boot--sign-gone"/, fn);
  }
});

test("page: the splash looks the same in dark mode (fixed colors, no CSS variables)", () => {
  for (const sel of ["#boot", "#bootText", "#bootCanvas", "#boot.boot--falling"]) {
    const escaped = sel.replace(/[.#]/g, "\\$&");
    const m = html.match(new RegExp("^" + escaped + " \\{([^}]*)\\}", "m"));
    assert.ok(m, sel);
    assert.doesNotMatch(m[1], /var\(--/, sel);
  }
});

// The intro code in the app script: revealWhenReady, the splash functions and hideBoot.
function introSource() {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  const a = app.indexOf("  function revealWhenReady()");
  const b = app.indexOf("  // A move belongs to the party that started it");
  assert.ok(a > 0 && b > a);
  return app.slice(a, b);
}

test("page: the intro constants are used by name, with no magic numbers in the intro code", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  const intro = introSource().replace(/\/\/.*$/gm, "");
  assert.match(intro, /bootRemaining\(app\.introStart, performance\.now\(\), bootMinMs\(/);
  assert.match(intro, /bootFallMs\(prefersReducedMotion\(\)\)/);
  assert.match(intro, /setTimeout\(function \(\) \{[^]*?\}, BOOT_FALL_MS\)/);
  assert.match(intro, /SPLASH_STEP_MS/);
  assert.match(intro, /splashGrid\(box\.width, box\.height\)/);
  assert.match(intro, /splashIrisRadius\(elapsedMs, splash\.cols, splash\.rows\)/);
  assert.match(intro, /performance\.now\(\) - splash\.start/);
  assert.doesNotMatch(intro, /\b(1500|800|600|80|2400|300)\b/);
  assert.doesNotMatch(app, /BOOT_FADE_MS/);
  // the loop reads no layout
  const loop = intro.match(/function fallFrame\(\) \{[\s\S]*?\n  \}\n/)[0];
  assert.doesNotMatch(loop, /getBoundingClientRect|clientWidth|clientHeight|offsetWidth|offsetHeight/);
  const paint = intro.match(/function paintSplash\([\s\S]*?\n  \}\n/)[0];
  assert.doesNotMatch(paint, /getBoundingClientRect|clientWidth|clientHeight|offsetWidth|offsetHeight|createElement/);
  // the first request leaves before the splash is drawn
  assert.match(app, /\n  poll\(\);[^\n]*\n  drawSplash\(\);\n/);
  // block edges are rounded in whole device pixels
  assert.match(intro, /Math\.round\(i \* grid\.size \* dpr\)/);
});

test("page: the code screen stops the fall and the join replays the splash once", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  const code = app.match(/function showCodeScreen\(\) \{[\s\S]*?\n  \}\n/)[0];
  assert.match(code, /clearTimeout\(app\.introTimer\)/);
  assert.match(code, /hideBoot\(\);/);
  const hide = app.match(/function hideBoot\(\) \{[\s\S]*?\n  \}\n/)[0];
  assert.match(hide, /cancelAnimationFrame\(splash\.raf\)/);
  assert.match(hide, /clearTimeout\(splash\.endTimer\)/);
  assert.match(hide, /boot\.hidden = true/);
  assert.match(hide, /canvas\.width = canvas\.height = 0/);
  assert.match(app, /if \(!app\.introDone\) \{\s*app\.introStart = performance\.now\(\);\s*showBoot\(\);/);
  // „Kto si?“ waits for the end of the fall
  assert.match(app, /if \(!app\.askWho \|\| splash\.falling\) return;/);
});

// --- people waiting on the meadow (T-016) ---

test("waitingFigures: nobody without a party, on an absent night, or with all places held", () => {
  assert.deepEqual(plain(L.waitingFigures(stateWith([]), null, THU)), []);
  const late = party({ arrive: FRI });
  assert.deepEqual(plain(L.waitingFigures(stateWith([late]), late, THU)), []);
  const full = party();
  const st = stateWith([full], { [THU]: hold(full.id, ["left-double-1", "left-double-2"]) });
  assert.deepEqual(plain(L.waitingFigures(st, full, THU)), []);
  const over = stateWith([full], { [THU]: hold(full.id, ["left-double-1", "left-double-2", "left-window-1"]) });
  assert.deepEqual(plain(L.waitingFigures(over, full, THU)), []);
});

test("waitingFigures: adults first, then the kids, after the places already held", () => {
  const p = party({ adults: 2, kids: 1 });
  assert.deepEqual(plain(L.waitingFigures(stateWith([p]), p, THU)), [{ kind: "adult" }, { kind: "adult" }, { kind: "kid" }]);
  const one = stateWith([p], { [THU]: hold(p.id, ["left-window-1"]) });
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
  assert.equal(L.meadowLabel(1), "Na lúke čaká 1 človek z vás bez postele");
  assert.equal(L.meadowLabel(2), "Na lúke čakajú 2 ľudia z vás bez postele");
  assert.equal(L.meadowLabel(4), "Na lúke čakajú 4 ľudia z vás bez postele");
  assert.equal(L.meadowLabel(5), "Na lúke čaká 5 ľudí z vás bez postele");
  assert.equal(L.meadowLabel(11), "Na lúke čaká 11 ľudí z vás bez postele");
});

test("page: the meadow is drawn from the config rect, as one button", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  assert.match(app, /drawMeadow\(g, view\);/);
  assert.match(app, /scene\.meadow/);
  assert.match(app, /makeButton\(g, meadowButtonLabel\(waiting\.length\), "meadow"/);
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
  const slots = ["left-double-1", "left-double-2"];
  const after = realState([p], { [THU]: hold(p.id, slots) });
  const cells = plain(L.meadowLayout(realLayout.map.scene.meadow, 2).cells);
  const bed = bedById("left-double");
  assert.deepEqual(walkFor(p, before, after, "left-double", slots), [
    { slot: slots[0], from: cells[0], to: plain(L.figurePosition(bed, 0)), kind: "adult", color: p.color },
    { slot: slots[1], from: cells[1], to: plain(L.figurePosition(bed, 1)), kind: "adult", color: p.color },
  ]);
});

test("walkers: the kinds come from the state after the tap", () => {
  const p = party({ adults: 1, kids: 1 });
  const slots = ["left-double-1", "left-double-2"];
  const out = walkFor(p, realState([p]), realState([p], { [THU]: hold(p.id, slots) }), "left-double", slots);
  assert.deepEqual(out.map((w) => w.kind), ["adult", "kid"]);
  // One of two tapped: only the first figure walks, the kid is still waiting.
  const one = walkFor(p, realState([p]), realState([p], { [THU]: hold(p.id, [slots[0]]) }), "left-double", [slots[0]]);
  assert.equal(one.length, 1);
  assert.equal(one[0].kind, "adult");
});

test("walkers: nobody walks without a party, or when nothing is waiting", () => {
  const p = party();
  const slots = ["left-window-1"];
  const after = realState([p], { [THU]: hold(p.id, slots) });
  assert.deepEqual(walkFor(null, realState([p]), after, "left-window", slots), []);
  // Both places held already, an extra place taken: nothing was waiting.
  const held = realState([p], { [THU]: hold(p.id, ["left-double-1", "left-double-2"]) });
  const extra = realState([p], { [THU]: hold(p.id, ["left-double-1", "left-double-2", "left-window-1"]) });
  assert.deepEqual(walkFor(p, held, extra, "left-window", slots), []);
  // The party is not there on that night.
  const late = party({ arrive: FRI });
  assert.deepEqual(walkFor(late, realState([late]), realState([late], { [THU]: hold(late.id, slots) }), "left-window", slots), []);
});

test("walkers: a slot that will not hold the party has no walker", () => {
  const p = party();
  const slots = ["left-double-1", "left-double-2"];
  assert.deepEqual(walkFor(p, realState([p]), realState([p]), "left-double", slots), []);
});

test("walkers: on an overflowing meadow the figure after the drawn cells starts at the badge", () => {
  const p = party({ adults: 3 });
  const slots = ["left-double-1", "left-double-2"];
  const narrow = [0, 0, 28, 14];       // two cells: one figure and the badge
  const layout = plain(L.meadowLayout(narrow, 3));
  assert.equal(layout.cells.length, 1);
  const out = walkFor(p, realState([p]), realState([p], { [THU]: hold(p.id, slots) }), "left-double", slots, narrow);
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

test("page: the bed panel warns before a tap would overfill an already-complete party", () => {
  const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  const body = app.match(/function addActions\(st\) \{([\s\S]*?)\n\s*\}\n/)[1];
  assert.match(body, /missingPlaces\(st, party, night\) === 0/);
  assert.match(body, /enoughAlreadyText\(party\.name\)/);
  assert.match(body, /openWho\(\{ returnKey: "bed-" \+ bed\.id \}\)/);
});

// --- regression guard: singular tykanie only, never the plural "vy" forms (T-020) ---

// The plural 2nd person reads exactly like vykanie, which the brief forbids. This checker lives in the test
// file on purpose: the page itself has no use for it.
const FORMAL_WORDS = new Set([
  "vám", "vami", "váš", "vaša", "vaše", "vašej", "vašu", "vašho", "vášho", "vašom", "vašou",
  "vašim", "vašimi", "vašich", "vaši", "vaším", "vaší", "vášmu", "ste", "máte", "nemáte", "potrebujete", "nepotrebujete", "spíte", "nespíte",
  "chcete", "môžete", "viete", "budete",
]);
// Slovak words ending in "-te" that are not plural imperatives or verbs: locative of chata, sobota, cesta and miesto.
const TE_ALLOWED = new Set(["chate", "sobote", "ceste", "mieste", "ešte"]);

const formalForms = (text) =>
  (String(text).toLowerCase().match(/[\p{L}]+/gu) || []).filter((w) => FORMAL_WORDS.has(w) || (/te$/.test(w) && !TE_ALLOWED.has(w)));

test("formalForms flags plural 2nd person forms", () => {
  assert.deepEqual(formalForms("Zadajte kód"), ["zadajte"]);
  assert.deepEqual(formalForms("nie ste tu"), ["ste"]);
  assert.deepEqual(formalForms("máte 2/3 !"), ["máte"]);
  assert.deepEqual(formalForms("z vašej strany"), ["vašej"]);
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
  add(L.myPartyStatus(stateWith([p], { [SAT]: hold(p.id, ["left-window-1"]) }), p));
  add(L.myPartyStatus(stateWith([big]), big));
  add(L.myPartyStatus(stateWith([p], { [THU]: hold(p.id, [...PAIR, "left-window-1"]), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, PAIR) }), p));
  add(L.myPartyStatus(stateWith([p], { [THU]: hold(p.id, PAIR), [FRI]: hold(p.id, PAIR), [SAT]: hold(p.id, PAIR) }), p));

  [1, 2, 5].forEach((n) => add(L.meadowLabel(n)));
  [THU, FRI, SAT].forEach((n) => add(L.notPresentText(n)));
  add([[FRI], [THU, SAT], [THU, FRI, SAT], []].map((n) => L.skippedText(n)));
  add(L.releaseConfirmText("Riso a Ben"));
  add(L.moveBarText("Ivan a Eva"));
  add([null, party()].map((x) => L.whoText(x)));
  [0, 1, 2, 5].forEach((n) => add(L.assignLabel(n)));
  [0, 1, 2, 5].forEach((n) => add(L.assignLabel(n, "Ivan a Eva")));
  add(L.enoughAlreadyText("Ivan a Eva"));

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
    add(L.errorText({ code, message: "x", params: { night: SAT, slot: "left-window-1", party_id: "p-aaaaaa", party_name: "Ivan a Eva",
      name: "Ivan a Eva", field: "arrive", reason: "name_empty", retry_after: 12 } }, s));
  }
  add(L.errorText(err("slot_taken", { night: FRI, party_id: "p-aaaaaa", party_name: "Ivan a Eva", own: true }), s));
  add(L.errorText(err("slot_taken", { own: true }), s));
  add(L.errorText(err("not_present", { night: THU, party_name: "Mrco" }), s));
  add(L.errorText(err("invalid", { reason: "leave_not_after_arrive" }), s));

  add(L.partyTableSummary(summaryState(), "p-aaaaaa"));
  add(L.partyTableRows(summaryState(), null).map((r) => L.legendNightsText(r)));
  add([1, 2, 5].map((n) => L.moreText(n)));
  add(L.summaryText(summaryState(), "https://cabin.example/"));
  add(L.titleLabel(event));
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
  const stove = bedById("kitchen-stove");
  const pipe = L.stovePipeRect(stove);
  assert.ok(pipe[1] >= stove.rect[1], "the pipe must not rise above the stove");
  assert.deepEqual(plain(L.furnitureBounds(stove)), [22, 352, 62, 28]);
  assert.deepEqual(plain(L.furnitureBounds(bedById("konica-lower-mats"))), [24, 132, 124, 26]);
});

// --- roofs (T-029) ---

const houseOf = (ids) => ({ id: "h", rooms: ids });

test("houseOutline is the union rect of the rooms of a house", () => {
  assert.deepEqual(plain(L.houseOutline(houseOf(["konica-upper", "konica-lower"]), rooms)), [10, 26, 152, 150]);
  assert.deepEqual(plain(L.houseOutline(houseOf(["left", "hallway", "right"]), rooms)), [118, 196, 254, 124]);
  assert.deepEqual(plain(L.houseOutline(houseOf(["kitchen"]), rooms)), [10, 334, 100, 62]);
});

test("houseOutline ignores unknown rooms and gives null for a house without rooms", () => {
  assert.deepEqual(plain(L.houseOutline(houseOf(["kitchen", "attic"]), rooms)), [10, 334, 100, 62]);
  assert.equal(L.houseOutline(houseOf(["attic"]), rooms), null);
  assert.equal(L.houseOutline(houseOf([]), rooms), null);
});

test("roofRows is a stepped trapezoid with a 4 px overhang that sits on the top edge", () => {
  const rows = plain(L.roofRows([10, 26, 152, 150]));
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], { x: 6, y: 24, w: 160, i: 0 });          // the bottom row: house width + 4 px on each side
  assert.equal(rows[0].y + 2, 26);                                    // directly on the top edge
  assert.deepEqual(rows[7], { x: 22, y: 10, w: 128, i: 7 });         // the top row (ridge): 16 px narrower per side
  rows.forEach((row, k) => {
    assert.equal(row.y, 26 - 2 * (k + 1));
    assert.equal(row.x % 2, 0, "rows step in whole 2 px");
    assert.equal(row.x + row.w, 166 - (row.x - 6), "each row is symmetric");
    if (k) assert.ok(row.x >= rows[k - 1].x && row.w <= rows[k - 1].w, "each row is not wider than the one below");
  });
});

test("roofRect and chimneyRect follow the outline", () => {
  assert.deepEqual(plain(L.roofRect([118, 212, 254, 124])), [114, 196, 262, 16]);
  assert.deepEqual(plain(L.chimneyRect([118, 212, 254, 124], 164)), [164, 192, 6, 10]);
});

test("page: every script file parses on its own and the page keeps no inline script", () => {
  assert.doesNotMatch(pageFile, /<script(?![^>]*\bsrc=)[^>]*>/);
  scriptTags.forEach((file) => {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotThrow(() => new vm.Script(source, { filename: file }), file);
  });
  const names = scriptTags.map((f) => path.basename(f));
  assert.equal(names.length, new Set(names).size, "a script is listed twice");
  assert.deepEqual(names, [...names.filter((n) => n.startsWith("logic-")), ...names.filter((n) => n.startsWith("app-"))], "logic files load before app files");
  assert.equal(names.at(-1), "app-start.js", "app-start.js runs the first poll, so it loads last");
  const onDisk = fs.readdirSync(path.join(root, "static", "js")).sort();
  assert.deepEqual([...names].sort(), onDisk, "every file in static/js is loaded by the page, and the other way round");
  scriptTags.forEach((file) => {
    if (path.basename(file).startsWith("app-")) {
      assert.match(fs.readFileSync(path.join(root, file), "utf8"), /^"use strict";/, file + " must start with use strict");
    }
  });
});

// --- per-night places override (T-033) ---

test("neededOnNight: full count, override, override above full, absent night", () => {
  const p = party({ adults: 3, arrive: THU, leave: SAT });
  assert.equal(L.neededOnNight(p, THU), 3);
  assert.equal(L.neededOnNight(party({ adults: 3, places: { [THU]: 1 } }), THU), 1);
  assert.equal(L.neededOnNight(party({ adults: 3, places: { [THU]: 1 } }), FRI), 3);
  assert.equal(L.neededOnNight(party({ adults: 3, places: { [THU]: 9 } }), THU), 3);
  assert.equal(L.neededOnNight(p, SAT), 0);
  assert.equal(L.neededOnNight(party({ adults: 3, arrive: FRI, places: { [THU]: 1 } }), THU), 0);
});

test("an override flows into the tally, missing places, status and legend", () => {
  const p = party({ adults: 3, places: { [THU]: 1 } });
  const st = stateWith([p], { [THU]: hold(p.id, ["left-double-1"]) });
  const t = L.nightTally(st, p, THU);
  assert.equal(t.needed, 1);
  assert.equal(t.kind, "ok");
  assert.equal(L.tallyChipText(t), "máš 1/1");
  assert.equal(L.missingPlaces(st, p, THU), 0);
  assert.equal(L.myPartyStatus(st, p).night, FRI);
  const [row] = L.partyTableRows(st, p.id);
  assert.equal(L.legendNightParts(row)[0], "Št → Pi 1/1");
});

test("waitingFigures with an override shows only the missing places, in order", () => {
  const p = party({ adults: 2, kids: 2, places: { [THU]: 3 } });
  const none = stateWith([p]);
  assert.deepEqual(plain(L.waitingFigures(none, p, THU)), [{ kind: "adult" }, { kind: "adult" }, { kind: "kid" }]);
  const one = stateWith([p], { [THU]: hold(p.id, ["left-window-1"]) });
  assert.deepEqual(plain(L.waitingFigures(one, p, THU)), [{ kind: "adult" }, { kind: "kid" }]);
});

test("summaryText counts the override in the warnings", () => {
  const p = party({ adults: 3, arrive: THU, leave: FRI, places: { [THU]: 2 } });
  const text = L.summaryText(realState([p], { [THU]: { "left-window-1": p.id } }), "https://cabin.example/");
  assert.match(text, /vo štvrtok chýba 1 miesto/);
  const done = L.summaryText(realState([p], { [THU]: { "left-window-1": p.id, "left-double-1": p.id } }), "https://cabin.example/");
  assert.doesNotMatch(done, /Chýbajú/);
});

test("fewerPlacesAction: label for every day locative", () => {
  const days = [
    ["2026-11-02", "V pondelok nás viac nebude"], ["2026-11-03", "V utorok nás viac nebude"],
    ["2026-11-04", "V stredu nás viac nebude"], [THU, "Vo štvrtok nás viac nebude"],
    [FRI, "V piatok nás viac nebude"], [SAT, "V sobotu nás viac nebude"], ["2026-11-01", "V nedeľu nás viac nebude"],
  ];
  for (const [night, text] of days) {
    const p = party({ adults: 3, arrive: night, leave: "2026-11-09" });
    const st = stateWith([p], { [night]: hold(p.id, ["left-double-1"]) });
    assert.deepEqual(plain(L.fewerPlacesAction(st, p, night)), { night, places: 1, text });
  }
});

test("fewerPlacesAction: null when nothing placed, all placed, absent, or no party", () => {
  const p = party({ adults: 2 });
  assert.equal(L.fewerPlacesAction(stateWith([p]), p, THU), null);
  const full = stateWith([p], { [THU]: hold(p.id, ["left-double-1", "left-double-2"]) });
  assert.equal(L.fewerPlacesAction(full, p, THU), null);
  assert.equal(L.fewerPlacesAction(full, p, "2026-11-01"), null);
  assert.equal(L.fewerPlacesAction(full, null, THU), null);
});

test("placesPanelInfo: texts with some places, with none, and the null cases", () => {
  const p = party({ adults: 3 });
  const one = stateWith([p], { [THU]: hold(p.id, ["left-double-1"]) });
  const a = plain(L.placesPanelInfo(one, p, THU));
  assert.equal(a.title, "Štvrtok");
  assert.deepEqual(a.lines, [
    "Vo štvrtok máš 1 miesto, chýbajú ti ešte 2.",
    "Ak vo štvrtok nebudú všetci, ťukni nižšie. Ostatné noci sa nemenia.",
  ]);
  assert.equal(a.primary.kind, "fewer");
  assert.equal(a.primary.label, "Vo štvrtok nás viac nebude");
  assert.deepEqual(a.primary.action, { night: THU, places: 1, text: "Vo štvrtok nás viac nebude" });
  assert.equal(a.secondary.label, "Ešte hľadám posteľ");
  const b = plain(L.placesPanelInfo(stateWith([p]), p, THU));
  assert.deepEqual(b.lines, [
    "Vo štvrtok ešte nemáš žiadne miesto, chýbajú ti 3.",
    "Ak vo štvrtok nepríde nikto, uprav si príchod.",
  ]);
  assert.equal(b.primary.kind, "edit");
  assert.equal(b.primary.label, "Upraviť príchod a odchod");
  const c = plain(L.placesPanelInfo(stateWith([party({ adults: 1 })]), party({ adults: 1 }), THU));
  assert.equal(c.lines[0], "Vo štvrtok ešte nemáš žiadne miesto, chýba ti 1.");
  assert.equal(L.placesPanelInfo(stateWith([p]), p, "2026-11-01"), null);
  const four = party({ adults: 5 });
  const d = plain(L.placesPanelInfo(stateWith([four], { [THU]: hold(four.id, ["left-double-1", "left-double-2", "left-window-1"]) }), four, THU));
  assert.equal(d.lines[0], "Vo štvrtok máš 3 miesta, chýbajú ti ešte 2.");
});

test("statusBoardLines: missing (1, 2, 5) and fewer", () => {
  const mk = (adults, arrive, leave) => party({ adults, arrive, leave });
  const lines = (p, s) => plain(L.statusBoardLines(L.myPartyStatus(s, p, THU)));
  const one = mk(1, THU, FRI), two = mk(2, THU, FRI), five = mk(5, THU, FRI);
  assert.deepEqual(lines(one, stateWith([one])), ["Št: chýba 1", "Ťukni sem ›"]);
  assert.deepEqual(lines(two, stateWith([two])), ["Št: chýbajú 2", "Ťukni sem ›"]);
  assert.deepEqual(lines(five, stateWith([five])), ["Št: chýba 5", "Ťukni sem ›"]);
  const p = party({ adults: 3, places: { [THU]: 1 } });
  const s = stateWith([p], { [THU]: hold(p.id, ["left-double-1"]), [FRI]: hold(p.id, PAIR.concat(["left-window-1"])), [SAT]: hold(p.id, PAIR.concat(["left-window-1"])) });
  assert.deepEqual(plain(L.statusBoardLines(L.myPartyStatus(s, p, THU))), ["Št: len 1 z 3 ›"]);
  assert.deepEqual(plain(L.statusBoardLines({ kind: "ok" })), []);
});

test("myPartyStatus: fewer applies only to the selected night, after missing and extra", () => {
  const p = party({ adults: 3, places: { [THU]: 1 } });
  const rest = { [FRI]: hold(p.id, ["left-double-1", "left-double-2", "left-window-1"]), [SAT]: hold(p.id, ["left-double-1", "left-double-2", "left-window-1"]) };
  const s = stateWith([p], Object.assign({ [THU]: hold(p.id, ["left-double-1"]) }, rest));
  const st = plain(L.myPartyStatus(s, p, THU));
  assert.equal(st.kind, "fewer");
  assert.equal(st.text, "Št: len 1 z 3");
  assert.equal(L.myPartyStatus(s, p, FRI).kind, "ok");
  assert.equal(L.myPartyStatus(s, p, undefined).kind, "ok");
  // missing wins over fewer
  const m = stateWith([p], { [THU]: hold(p.id, ["left-double-1"]), [FRI]: hold(p.id, ["left-double-1"]) });
  assert.equal(L.myPartyStatus(m, p, THU).kind, "missing");
  // extra wins over fewer
  const e = stateWith([p], Object.assign({}, rest, { [THU]: hold(p.id, ["left-double-1", "left-double-2"]) }));
  assert.equal(L.myPartyStatus(e, p, THU).kind, "extra");
});

test("placesUndoInfo: texts per weekday and plural, null without override", () => {
  const info = (night, n, full) => {
    const p = party({ adults: full, arrive: night, leave: L.addDays(night, 1), places: { [night]: n } });
    return plain(L.placesUndoInfo(stateWith([p]), p, night));
  };
  const a = info(THU, 1, 3);
  assert.equal(a.title, "Štvrtok");
  assert.equal(a.line, "Vo štvrtok potrebuješ len 1 miesto z 3.");
  assert.equal(a.primary.label, "Vo štvrtok prídeme všetci");
  assert.deepEqual(a.primary.action, { night: THU, places: 3 });
  assert.equal(a.secondary.label, "Nechať tak");
  assert.equal(info(FRI, 2, 6).line, "V piatok potrebuješ len 2 miesta z 6.");
  assert.equal(info(FRI, 2, 6).primary.label, "V piatok prídeme všetci");
  assert.equal(info(SAT, 5, 7).line, "V sobotu potrebuješ len 5 miest z 7.");
  assert.equal(info(SAT, 5, 7).title, "Sobota");
  const p = party({ adults: 3 });
  assert.equal(L.placesUndoInfo(stateWith([p]), p, THU), null);
  assert.equal(L.placesUndoInfo(stateWith([p]), null, THU), null);
});

test("meadowHitRect: 44 units tall from the meadow top, as wide as the meadow", () => {
  const m = realLayout.map.scene.meadow;
  assert.deepEqual(plain(L.meadowHitRect(m)), [m[0], m[1] - 1, m[2], 44]);
  assert.deepEqual(plain(L.meadowHitRect([112, 397, 124, 14])), [112, 396, 124, 44]);   // real config: starts below the icons (end at 396)
});

test("meadowButtonLabel: singular address and plurals", () => {
  assert.equal(L.meadowButtonLabel(1), "1 z vás ešte nemá posteľ. Ťuknutím otvoríš možnosti.");
  assert.equal(L.meadowButtonLabel(2), "2 z vás ešte nemajú posteľ. Ťuknutím otvoríš možnosti.");
  assert.equal(L.meadowButtonLabel(5), "5 z vás ešte nemá posteľ. Ťuknutím otvoríš možnosti.");
  assert.equal(L.meadowButtonLabel(0), "");
});

// --- day visits (T-037) ---

const FOURTH = "2026-11-01";
const dayOnly = (over = {}) => party({ id: "p-dddddd", name: "Jakub", arrive: null, leave: null, day_visits: [FRI], ...over });

test("isDayOnly: day visits and no arrive", () => {
  assert.equal(L.isDayOnly(dayOnly()), true);
  assert.equal(L.isDayOnly(party()), false);
  assert.equal(L.isDayOnly(party({ day_visits: [] })), false);
  assert.equal(L.isDayOnly(dayOnly({ arrive: undefined, leave: undefined })), true);
  assert.equal(L.isDayOnly(dayOnly({ day_visits: [] })), false);
  assert.equal(L.isDayOnly(null), false);
});

test("a day-only party is never present and needs nothing", () => {
  const p = dayOnly({ adults: 2, kids: 1 });
  const s = stateWith([p]);
  [THU, FRI, SAT].forEach((n) => {
    assert.equal(L.isPresent(p, n), false);
    assert.equal(L.neededOnNight(p, n), 0);
    assert.equal(L.missingPlaces(s, p, n), 0);
    assert.equal(L.extraPlaces(s, p, n), 0);
    assert.equal(L.nightTally(s, p, n).kind, "absent");
    assert.equal(L.tallyChipText(L.nightTally(s, p, n)), "nie si tu");
    assert.deepEqual(plain(L.waitingFigures(s, p, n)), []);
    assert.equal(L.placesPanelInfo(s, p, n), null);
    assert.equal(L.fewerPlacesAction(s, p, n), null);
  });
  assert.equal(L.isPresent(dayOnly({ arrive: undefined, leave: undefined }), THU), false);
});

test("defaultNightFor a day-only party is the first night", () => {
  assert.equal(L.defaultNightFor(dayOnly(), [THU, FRI, SAT]), THU);
  assert.equal(L.defaultNightFor(dayOnly({ arrive: undefined }), [THU, FRI, SAT]), THU);
});

test("myPartyStatus of a day-only party without beds is ok", () => {
  const p = dayOnly();
  assert.deepEqual(plain(L.myPartyStatus(stateWith([p]), p, THU)), { kind: "ok", night: null, count: 0, text: "Prídeš len cez deň" });
});

test("eventDays and dayLabel", () => {
  assert.deepEqual(plain(L.eventDays(event)), [THU, FRI, SAT, FOURTH]);
  assert.deepEqual(plain(L.eventDays({ arrive_days: ["x"], leave_days: [FOURTH] })), []);
  assert.deepEqual(plain(L.eventDays(null)), []);
  assert.equal(L.dayLabel(FRI), "Pi 30. 10.");
  assert.equal(L.dayLabel(FOURTH), "Ne 1. 11.");
  assert.equal(L.dayLabel(THU), "Št 29. 10.");
  assert.equal(L.dayLabel("x"), "");
});

test("freedByStay with no stay frees every slot of the party", () => {
  const p = dayOnly();
  const s = stateWith([p], { [THU]: hold(p.id, ["left-double-1"]), [SAT]: Object.assign(hold(p.id, ["left-window-1"]), { "left-double-1": "p-other" }) });
  assert.deepEqual(plain(L.freedByStay(s, p.id, null, null)), [
    { night: THU, slot: "left-double-1" }, { night: SAT, slot: "left-window-1" }
  ]);
});

test("notPresentNote: day-only gets its own text", () => {
  assert.equal(L.notPresentNote(dayOnly(), THU), "Prídeš len cez deň, posteľ nepotrebuješ.");
  assert.equal(L.notPresentNote(party({ arrive: FRI }), THU), "Vo štvrtok nie si na chate.");
});

test("day visit reason texts and field name", () => {
  const text = (reason) => L.errorText({ code: "invalid", message: "x", params: { reason } }, stateWith([]));
  assert.equal(text("stay_mode_mixed"), "Vyber buď príchod a odchod, alebo dni návštevy, nie oboje.");
  assert.equal(text("day_visits_empty"), "Vyber aspoň jeden deň, keď prídeš.");
  assert.equal(text("stay_incomplete"), "Vyber príchod aj odchod.");
  assert.equal(text("duplicate_day"), "Každý deň vyber len raz.");
  assert.equal(text("day_outside_event"), "Tento deň nie je v termíne chaty.");
  assert.equal(text("day_only_kids_in_bed"), "Keď prídeš len cez deň, deti v rodičovskej posteli nechaj na 0.");
  assert.equal(L.errorText({ code: "invalid", params: { field: "day_visits" } }), "Skontroluj pole „dni návštevy“.");
});

test("not_present for a day-only party says it needs no bed", () => {
  const p = dayOnly(), o = party();
  const s = stateWith([p, o]);
  assert.equal(L.errorText({ code: "not_present", params: { night: THU, party_id: p.id } }, s),
    "„Jakub“ prichádza len cez deň a posteľ nepotrebuje.");
  assert.equal(L.errorText({ code: "not_present", params: { night: THU, party_id: o.id } }, s),
    "„Ivan a Eva“ vo štvrtok nie je na chate. Uprav príchod alebo odchod.");
});

// --- party form: day-only mode ---

test("partyToForm of a day-only party: toggle on, its days, default stay days", () => {
  const f = plain(L.partyToForm(dayOnly({ day_visits: [FRI, "2026-11-01"], arrival_time: "obed" }), event));
  assert.equal(f.day_only, true);
  assert.deepEqual(f.day_visits, [FRI, "2026-11-01"]);
  assert.equal(f.arrive, THU);
  assert.equal(f.leave, "2026-11-01");
  assert.equal(f.arrival_time, "obed");
  assert.equal(plain(L.partyToForm(party(), event)).day_only, false);
});

test("partyPayload in day mode: sorted unique days, no arrive and leave, no kids in bed", () => {
  const raw = { ...L.defaultPartyForm(event), name: " Jakub ", kids: "1", kids_in_parents_bed: "1", day_only: true, day_visits: ["2026-11-01", FRI, "2026-11-01"] };
  const p = plain(L.partyPayload(raw));
  assert.deepEqual(p, { name: "Jakub", adults: 2, kids: 1, kids_in_parents_bed: 0, arrival_time: "", note: "", day_visits: [FRI, "2026-11-01"] });
  assert.equal("arrive" in p, false);
  assert.equal("leave" in p, false);
  assert.equal(L.checkPartyPayload(L.partyPayload(raw), event), null);
});

test("partyPayload in stay mode has no day_visits key", () => {
  const p = L.partyPayload({ ...L.defaultPartyForm(event), name: "Ivan", day_visits: [FRI] });
  assert.equal("day_visits" in p, false);
  assert.equal(p.arrive, THU);
  assert.equal(p.leave, "2026-11-01");
});

test("checkPartyPayload in day mode: empty, outside the event, ignores arrive and leave", () => {
  const base = { ...L.defaultPartyForm(event), name: "Jakub", day_only: true };
  const check = (days) => plain(L.checkPartyPayload(L.partyPayload({ ...base, day_visits: days }), event));
  assert.deepEqual(check([]), { code: "invalid", params: { field: "day_visits", reason: "day_visits_empty" } });
  assert.deepEqual(check([FRI, "2026-11-02"]), { code: "invalid", params: { field: "day_visits", reason: "day_outside_event" } });
  assert.equal(check([FRI, "2026-11-01"]), null);                       // Fri + Sun, not consecutive
  assert.equal(check(["2026-11-01"]), null);                            // the Sunday has no night, still an event day
  assert.equal(L.errorText(check([])), "Vyber aspoň jeden deň, keď prídeš.");
  assert.equal(L.errorField(err("invalid", { field: "day_visits" })), "day_visits");
});

// --- day visits in the summaries (T-039) ---

const SUN = "2026-11-01";
const visitState = () => {
  const ivan = party(), riso = party({ id: "p-bbbbbb", name: "Riso a Ben", adults: 1, kids: 1, color: "#2F7D6D" });
  const jakub = dayOnly({ adults: 1, day_visits: [FRI, SUN] });
  const katka = dayOnly({ id: "p-eeeeee", name: "Katka a Peťo", adults: 2, color: "#C04388", day_visits: [SAT] });
  const eva = dayOnly({ id: "p-ffffff", name: "Zuzka", adults: 3, kids: 1, day_visits: [SAT] });
  return realState([ivan, riso, jakub, katka, eva], {
    [THU]: { ...hold(ivan.id, ["left-double-1", "left-double-2"]), "konica-lower-mats-1": riso.id },
  });
};

test("peopleCountText plurals", () => {
  assert.equal(L.peopleCountText(1), "1 človek");
  assert.equal(L.peopleCountText(2), "2 ľudia");
  assert.equal(L.peopleCountText(4), "4 ľudia");
  assert.equal(L.peopleCountText(5), "5 ľudí");
  assert.equal(L.peopleCountText(0), "0 ľudí");
  assert.equal(L.peopleCountText(12), "12 ľudí");
});

test("foodCount: arrival and leave days count, the day before arrival does not", () => {
  const s = realState([party({ adults: 2, kids: 1, arrive: FRI, leave: SAT })], {});
  assert.equal(L.foodCount(s, THU), 0);
  assert.equal(L.foodCount(s, FRI), 3);
  assert.equal(L.foodCount(s, SAT), 3);
  assert.equal(L.foodCount(s, SUN), 0);
});

test("foodCount: a day visitor counts only on their days", () => {
  const s = realState([dayOnly({ adults: 2, kids: 0, day_visits: [FRI, SUN] })], {});
  assert.equal(L.foodCount(s, THU), 0);
  assert.equal(L.foodCount(s, FRI), 2);
  assert.equal(L.foodCount(s, SAT), 0);
  assert.equal(L.foodCount(s, SUN), 2);
});

test("foodCount: kids in the parents' bed still count with no places", () => {
  const p = party({ adults: 2, kids: 2, kids_in_parents_bed: 1, arrive: THU, leave: SUN });
  assert.equal(L.foodCount(realState([p], {}), FRI), 4);
});

test("foodCount: a reduced night lowers the count (1 of 3 plus a party of 2 is 3)", () => {
  const a = party({ adults: 2, kids: 1, arrive: THU, leave: FRI, places: { [THU]: 1 } });
  const b = party({ id: "p-bbbbbb", name: "Dvaja", adults: 2, arrive: THU, leave: FRI });
  assert.equal(L.foodCount(realState([a, b], {}), THU), 3);
});

test("foodCount: arrival day uses only the first night, leave day only the last night", () => {
  const p = party({ adults: 3, arrive: THU, leave: SAT, places: { [THU]: 1, [FRI]: 2 } });
  const s = realState([p], {});
  assert.equal(L.foodCount(s, THU), 1);
  assert.equal(L.foodCount(s, SAT), 2);
});

test("foodCount: a day between a reduced night and a full night counts the full party", () => {
  const p = party({ adults: 3, arrive: THU, leave: SUN, places: { [THU]: 1 } });
  const s = realState([p], {});
  assert.equal(L.foodCount(s, THU), 1);
  assert.equal(L.foodCount(s, FRI), 3);
});

test("foodCount: two reduced nights in a row use the larger count", () => {
  const p = party({ adults: 4, arrive: THU, leave: SUN, places: { [THU]: 1, [FRI]: 2, [SAT]: 3 } });
  const s = realState([p], {});
  assert.equal(L.foodCount(s, FRI), 2);
  assert.equal(L.foodCount(s, SAT), 3);
  assert.equal(L.foodCount(s, SUN), 3);
});

test("foodCount: kid in the parents' bed, reduced from 2 to 1 slots, counts 2 people", () => {
  const p = party({ adults: 2, kids: 1, kids_in_parents_bed: 1, arrive: THU, leave: FRI, places: { [THU]: 1 } });
  assert.equal(L.foodCount(realState([p], {}), THU), 2);
});

test("dayVisitRows: non-consecutive days, two visitors on one day, none without visitors", () => {
  const rows = plain(L.dayVisitRows(visitState()));
  assert.deepEqual(rows.map((r) => [r.day, r.label, r.food]), [[FRI, "Pi 30. 10.", 5], [SAT, "So 31. 10.", 10], [SUN, "Ne 1. 11.", 5]]);
  assert.deepEqual(rows[1].parties.map((p) => [p.id, p.name, p.color, p.people]),
    [["p-eeeeee", "Katka a Peťo", "#C04388", 2], ["p-ffffff", "Zuzka", "#D07A2B", 4]]);
  assert.deepEqual(plain(L.dayVisitRows(summaryState())), []);
});

test("partyTableEmptyText: neutral when only day-only parties exist", () => {
  assert.equal(L.partyTableEmptyText(realState([], {})), "Zatiaľ tu nikto nie je.");
  const s = realState([dayOnly({ day_visits: [FRI] })], {});
  assert.deepEqual(plain(L.partyTableSummary(s, null)), []);
  assert.equal(L.partyTableEmptyText(s), "Zatiaľ tu nikto nespí.");
});

test("summaryText lists the day visits after the nights and before the missing places", () => {
  const s = visitState();
  s.parties[1].arrive = THU; s.parties[1].leave = FRI;   // Riso a Ben stay one night and miss a place on it
  const lines = L.summaryText(s, "https://cabin.example/").split("\n");
  const from = lines.indexOf("Cez deň (bez spania):");
  assert.deepEqual(lines.slice(from - 1, from + 8), [
    "",
    "Cez deň (bez spania):",
    "Pi 30. 10.: Jakub (1)",
    "   → spolu 5 ľudí na jedlo",
    "So 31. 10.: Katka a Peťo (2), Zuzka (4)",
    "   → spolu 8 ľudí na jedlo",
    "Ne 1. 11.: Jakub (1)",
    "   → spolu 3 ľudia na jedlo",
    "",
  ]);
  assert.ok(from > lines.findIndex((l) => l.startsWith("So → Ne")));
  assert.ok(from < lines.indexOf("Chýbajú miesta:"));
  assert.doesNotMatch(lines.slice(0, from).concat(lines.slice(lines.indexOf("Chýbajú miesta:"))).join("\n"), /Jakub|Katka|Zuzka/);
  assert.equal(lines[lines.length - 1], "Tu sa zapíšeš: https://cabin.example/");
});

test("summaryText is unchanged without day-only parties", () => {
  const plainText = L.summaryText(summaryState(), "https://cabin.example/");
  assert.doesNotMatch(plainText, /Cez deň|na jedlo/);
  const withLeftover = summaryState();
  withLeftover.parties.push(party({ id: "p-zzzzzz", name: "Nikto", day_visits: [], arrive: null, leave: null }));
  assert.equal(L.summaryText(withLeftover, "https://cabin.example/").includes("Cez deň"), false);
});

test("hiddenSummary has the day visits, one line per day", () => {
  assert.deepEqual(plain(L.hiddenSummary(visitState(), THU).dayVisits), [
    "Piatok 30. 10. cez deň: Jakub (1 človek), spolu 5 ľudí na jedlo",
    "Sobota 31. 10. cez deň: Katka a Peťo (2 ľudia), Zuzka (4 ľudia), spolu 10 ľudí na jedlo",
    "Nedeľa 1. 11. cez deň: Jakub (1 človek), spolu 5 ľudí na jedlo",
  ]);
  assert.deepEqual(plain(L.hiddenSummary(summaryState(), THU).dayVisits), []);
});

test("day-only parties never appear in room lines or the hidden rooms", () => {
  const hidden = L.hiddenSummary(visitState(), FRI);
  assert.doesNotMatch(JSON.stringify(plain(hidden.rooms)), /Jakub|Katka|Zuzka/);
  assert.equal(hidden.night, "Noc Pi → So (30./31. 10.), obsadené 0 z 20");
});

// --- day visits in „Kto je kto“ and the party table (T-040) ---

test("legendRows: a day-only row has its days as the stay, with the arrival time when there is one", () => {
  const rows = plain(L.legendRows(visitState(), null));
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.dayOnly), [false, false, true, true, true]);
  const jakub = rows[2];
  assert.equal(jakub.stay, "Pi 30. 10., Ne 1. 11.");
  assert.equal(jakub.people, "1 dospelý");
  assert.equal(jakub.name, "Jakub");
  const withTime = plain(L.legendRows(stateWith([dayOnly({ day_visits: [FOURTH, FRI], arrival_time: "po obede" })]), null))[0];
  assert.equal(withTime.stay, "Pi 30. 10., Ne 1. 11. · po obede");
  assert.equal(plain(L.legendRows(stateWith([dayOnly({ arrival_time: "" })]), null))[0].stay, "Pi 30. 10.");
});

test("legendRows: overnight rows are unchanged", () => {
  const row = plain(L.legendRows(stateWith([party()]), "p-aaaaaa"))[0];
  assert.equal(row.dayOnly, false);
  assert.equal(row.stay, L.stayText(party()));
  assert.equal(row.mine, true);
});

test("partyTableRows and partyTableSummary leave out day-only parties", () => {
  const s = visitState();
  assert.deepEqual(L.partyTableRows(s, null).map((r) => r.name), ["Ivan a Eva", "Riso a Ben"]);
  const lines = L.partyTableSummary(s, null);
  assert.equal(lines.length, 2);
  assert.doesNotMatch(lines.join("\n"), /Jakub|Katka|Zuzka|nie je tu, ale/);
  assert.deepEqual(plain(L.partyTableRows(stateWith([dayOnly()]), null)), []);
  assert.deepEqual(plain(L.partyTableSummary(stateWith([dayOnly()]), null)), []);
});

test("the table's „+N ďalšie“ count does not count day-only parties", () => {
  const overnight = Array.from({ length: 11 }, (_, i) => party({ id: "p-o" + String(i).padStart(5, "0"), name: "Party " + i }));
  const visitors = [1, 2, 3].map((i) => dayOnly({ id: "p-v" + String(i).padStart(5, "0"), name: "Visit " + i }));
  const rect = [0, 0, 196, 136];
  const count = (parties) => L.partyTableRows(stateWith(parties), null).length;
  assert.equal(count([...overnight, ...visitors]), 11);
  const lay = (parties) => L.partyTableLayout(rect, count(parties), 0, 3, 4).night;
  assert.deepEqual([lay([...overnight, ...visitors]).rows, lay([...overnight, ...visitors]).more],
    [lay(overnight).rows, lay(overnight).more]);
});

test("the screen-reader summary lists day-only parties once, with their days, not as „nie je tu“", () => {
  const s = visitState();
  const hidden = L.hiddenSummary(s, THU);
  assert.ok(hidden.dayVisits.some((line) => line.includes("Jakub")));
  assert.doesNotMatch(L.partyTableSummary(s, null).join("\n"), /Jakub/);
});

test("dayTableRows: no day-only party gives no rows", () => {
  assert.deepEqual(plain(L.dayTableRows(stateWith([party()]), null)), []);
  assert.deepEqual(plain(L.dayTableRows(realState([], {}), null)), []);
});

test("dayTableRows: one row per day-only party in state order, a cell per event day, mine flag", () => {
  const s = visitState();
  const rows = plain(L.dayTableRows(s, "p-eeeeee"));
  assert.deepEqual(rows.map((r) => r.id), ["p-dddddd", "p-eeeeee", "p-ffffff"]);
  assert.deepEqual(rows.map((r) => r.mine), [false, true, false]);
  assert.deepEqual(rows[0].cells.map((c) => c.day), [THU, FRI, SAT, SUN]);
  assert.deepEqual(rows[0].cells.map((c) => c.text), ["", "1", "", "1"]);
  assert.deepEqual(rows[1].cells.map((c) => c.text), ["", "", "2", ""]);
  assert.deepEqual(rows[2].cells.map((c) => c.text), ["", "", "4", ""]);
  assert.equal(rows[1].color, "#C04388");
  assert.equal(rows[1].label, "Katka a Peťo");
  assert.ok(plain(L.dayTableRows(s, null)).every((r) => r.mine === false));
});

test("foodRow: foodCount of every event day, zero included", () => {
  const s = visitState();
  const row = L.foodRow(s);
  assert.deepEqual(plain(row), [THU, FRI, SAT, SUN].map((d) => L.foodCount(s, d)));
  assert.equal(row.length, 4);
  assert.deepEqual(plain(L.foodRow(realState([], {}))), [0, 0, 0, 0]);
  assert.deepEqual(plain(L.foodRow({ event: null, parties: [] })), []);
});

test("drawPartyTable: one button over the drawn board, moon and sun from rects, no emoji", () => {
  const body = html.slice(html.indexOf("function drawMoon("), html.indexOf("// App part 5b"));
  assert.match(body, /partyTableLayout\(r, rows\.length, dayRows\.length, nights\.length, days\.length\)/);
  assert.match(body, /hitRect\(g, \[r\[0\], r\[1\], r\[2\], lay\.height\]\)/);
  assert.match(body, /Kto kde spí po nociach, kto príde cez deň a koľko vás je na jedlo\. Ťuknutím otvoríš „Kto je kto“\./);
  assert.match(body, /openLegend\("parties"\)/);
  assert.match(body, /"Noc"/);
  assert.match(body, /"Cez deň"/);
  assert.match(body, /"spolu na jedlo"/);
  assert.doesNotMatch(body, /innerHTML|☀|🌙|☾/);
});

test("intro zoom: constants", () => {
  assert.equal(L.INTRO_ZOOM_MS, 2800);
  assert.equal(L.INTRO_ZOOM_START, 2);
});

test("intro zoom: the start view is 2x, centered on the scene, at the scene top and valid", () => {
  for (const [vw, vh] of [[375, 667], [1280, 800]]) {
    const B = L.fitBounds(vw, vh, SW, SH, { bottom: 56 });
    const v = plain(L.introStartView(B, SW, SH));
    assert.ok(Math.abs(L.viewZoom(v, B) - 2) < 1e-9, "zoom 2");
    assert.ok(Math.abs(v.x + v.w / 2 - SW / 2) < 1e-9, "centered on the scene");
    assert.equal(v.y, 0);
    assert.ok(Math.abs(v.h - v.w * B.h / B.w) < 1e-9, "aspect ratio of the bounds");
    assert.deepEqual(plain(L.clampView(v, B)), v);
  }
});

test("intro zoom: introViewAt eases between the views and clamps t", () => {
  const from = { x: 90, y: 0, w: 100, h: 200 }, to = { x: 0, y: -20, w: 380, h: 760 };
  assert.deepEqual(plain(L.introViewAt(from, to, 0)), from);
  assert.deepEqual(plain(L.introViewAt(from, to, 1)), to);
  assert.deepEqual(plain(L.introViewAt(from, to, -3)), from);
  assert.deepEqual(plain(L.introViewAt(from, to, 7)), to);
  assert.deepEqual(plain(L.introViewAt(from, to, NaN)), from);
  const mid = plain(L.introViewAt(from, to, 0.5));
  assert.ok(mid.w > from.w && mid.w < to.w);
  assert.ok(Math.abs(mid.w - 240) < 1e-9, "ease in-out is symmetric around the middle");
  const early = plain(L.introViewAt(from, to, 0.1)), late = plain(L.introViewAt(from, to, 0.9));
  assert.ok(early.w - from.w < (to.w - from.w) * 0.1, "starts slowly");
  assert.ok(to.w - late.w < (to.w - from.w) * 0.1, "ends slowly");
});

test("intro zoom: the app wires it to the splash, stops on input and skips reduced motion", () => {
  assert.match(appSource, /function finishSplash\(\)[\s\S]*?hideBoot\(\);[\s\S]*?startIntroZoom\(\);/);
  assert.match(appSource, /function holdIntroZoom\(\)[\s\S]*?prefersReducedMotion\(\)/);
  assert.match(appSource, /\["pointerdown", "touchstart", "wheel", "keydown"\]/);
  const openPanelSource = appSource.match(/function openPanel\(title, build, opts\) \{[\s\S]*?\n\}\n/)[0];
  assert.doesNotMatch(openPanelSource, /IntroZoom/, "a panel must not stop the intro");
  assert.match(appSource, /function startMove\(slot\) \{\n  stopIntroZoom\(\);/);
});

test("intro zoom: the code screen (a 401) ends the intro, so the map is never stuck at 2x", () => {
  // The fall's end timer is cancelled by hideBoot(), so finishSplash() never runs after a 401 during the fall.
  const showCodeSource = appSource.match(/function showCodeScreen\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(showCodeSource, /hideBoot\(\);\n  stopIntroZoom\(\);/);
});

test("sound: the bird chirps while it is over the map, and the chirp and the wind are short", () => {
  const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };
  for (const r of [0, 0.5, 0.999]) {
    const d = L.birdChirpDelay(() => r);
    assert.ok(d >= 0.8 && d <= L.BIRD_FLIGHT_S - 0.8, `delay ${d} inside the flight`);
  }
  for (const r of [0, 0.3, 0.999]) {
    const notes = plain(L.chirpNotes(() => r));
    assert.ok(notes.length >= 2 && notes.length <= 4);
    const end = notes[notes.length - 1].at + notes[notes.length - 1].dur;
    assert.ok(end < 1, "a chirp lasts under a second");
    notes.forEach((n) => assert.ok(n.f0 > 1000 && n.f1 > 1000 && n.dur > 0 && n.gain > 0 && n.gain <= 1));
  }
  const layers = plain(L.TREE_WIND);
  assert.ok(layers.length >= 1);
  layers.forEach((layer) => {
    assert.equal(layer.gain[0][1], 0, "the wind swells in");
    assert.equal(layer.gain[layer.gain.length - 1][1], 0, "and dies away");
    assert.ok(L.windLayerEnd(layer) <= 3, "within three seconds");
    layer.gain.forEach((p) => assert.ok(p[1] >= 0 && p[1] <= 1));
  });
  const steps = plain(L.flutterSteps({ rate: 9, depth: 0.7 }, 2.8, seq([0.2, 0.7, 0.4, 0.9])));
  assert.ok(steps.length > 10 && steps.length < 60);
  steps.forEach((p, i) => assert.ok(p[1] >= 0.3 && p[1] <= 1 && (i === 0 || p[0] > steps[i - 1][0])));
});

test("sound: the bird chirps per flight and a tap on the tree blows wind through it", () => {
  assert.match(appSource, /bird\.addEventListener\("animationiteration", onBirdFlight\)/);
  assert.match(appSource, /e\.animationName !== "birdFly"/);
  assert.match(appSource, /"tree-hit"[\s\S]*?rustleTree\(t\)/);
  assert.match(html, /#scene svg \.tree-hit \{ pointer-events: all;/);
});

test("sound: „Kto si?“ has a mute button next to the close button, remembered on this device", () => {
  assert.match(appSource, /openPanel\("Kto si\?"[\s\S]*?headTools: \[soundToggle\(\)\]/);
  assert.match(appSource, /\(opts\.headTools \|\| \[\]\)\.forEach[\s\S]*?tools\.appendChild\(close\);/);
  assert.match(appSource, /return !app\.muted && ctx/);
  assert.match(appSource, /storage\.set\(KEYS\.sound, "off"\)/);
  assert.match(appSource, /"aria-pressed", app\.muted/);
});

test("shouldReopenStale after 45 s of silence", () => {
  assert.equal(L.shouldReopenStale(1000, 45000), false);   // 44 s
  assert.equal(L.shouldReopenStale(1000, 47000), true);    // 46 s
});

// --- "new version" sign (T-055) ---

test("updateSign: null unless the server runs other code", () => {
  assert.equal(L.updateSign("abc", "abc", 0), null);
  assert.equal(L.updateSign("", "abc", 0), null);
  assert.equal(L.updateSign("abc", "", 0), null);
  assert.equal(L.updateSign(undefined, "abc", 0), null);
  assert.equal(L.updateSign("abc", undefined, 0), null);
  assert.equal(L.updateSign("__ASSET_VERSION__", "abc", 0), null);
});

test("updateSign: any difference is newer, a pending save asks to wait", () => {
  assert.deepEqual({ ...L.updateSign("abc", "abd", 0) }, { text: "Nová verzia – ťukni pre obnovenie", canReload: true });
  assert.deepEqual({ ...L.updateSign("abc", "aaa", 0) }, { text: "Nová verzia – ťukni pre obnovenie", canReload: true });
  assert.deepEqual({ ...L.updateSign("abc", "abd", 2) }, { text: "Ukladám, chvíľu počkaj", canReload: false });
  assert.equal(L.updateSign("abc", "abc", 2), null);
});

// --- version line in „Kto si?“ (T-056) ---

test("versionLine: both values, one missing, placeholders", () => {
  assert.equal(L.versionLine("1.11.0", "3f9a2c1b7d0e"), "verzia 1.11.0 · 3f9a2c1b7d0e");
  assert.equal(L.versionLine("1.11.0", ""), "verzia 1.11.0");
  assert.equal(L.versionLine("", "3f9a2c1b7d0e"), "3f9a2c1b7d0e");
  assert.equal(L.versionLine("__APP_VERSION__", "__ASSET_VERSION__"), "");
  assert.equal(L.versionLine("1.11.0", "__ASSET_VERSION__"), "verzia 1.11.0");
  assert.equal(L.versionLine(undefined, null), "");
});

// --- „Pred cestou“ (logic-info.js) ---

const infoCfg = {
  water: { drinkable: false, liters_per_day: 2, bottle_liters: 1.5 },
  pack: [{ icon: "spacak", label: "Spacák" }, { icon: "vankus", label: "Vankúš" }],
  sleep: [{ icon: "plachta", label: "Plachta na matrac", note: "bez obliečok" }],
  menu: [{ day: THU, meals: [{ when: "večer", what: "guláš" }] }],
  bring: "raňajky",
  program: [{ icon: "lampion", title: "Lampiónový sprievod", when: "So", note: "" }],
};
const kindLayout = {
  ...layout,
  rooms: rooms.map((r) => ({
    ...r,
    beds: r.beds.map((b) => ({ ...b, kind: b.id.includes("mats") ? "mats" : b.id.includes("cot") ? "cot" : "bed1" })),
  })),
};
const infoState = (parties, sleeping = {}, briefing = {}) =>
  ({ event, layout: kindLayout, parties, sleeping, info: infoCfg, briefing });
const memoryStorage = (initial) => {
  const data = new Map(initial === undefined ? [] : [["info-packed", initial]]);
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) };
};

test("BRIEFING_STEPS keep the station order", () => {
  assert.deepEqual(plain(L.BRIEFING_STEPS), ["pack", "water", "food", "program", "sleep"]);
});

test("needsMat and matPlaces: mats and cot beds only, each place once", () => {
  const p = party();
  const s = infoState([p], {
    [THU]: { "konica-lower-mats-1": p.id },
    [FRI]: { "konica-lower-mats-2": p.id, "left-cot-1-1": p.id },
    [SAT]: { "left-double-1": p.id },
  });
  assert.equal(L.needsMat(s, p.id), true);
  assert.deepEqual(plain(L.matPlaces(s, p.id)), ["Konica, dole · Matrace na zemi", "Izba vľavo · Lehátko 1"]);
  const cot = infoState([p], { [THU]: { "left-cot-2-1": p.id } });
  assert.deepEqual(plain(L.matPlaces(cot, p.id)), ["Izba vľavo · Lehátko 2"]);
  const bedOnly = infoState([p], { [THU]: { "left-double-1": p.id } });
  assert.equal(L.needsMat(bedOnly, p.id), false);
  assert.equal(L.needsMat(bedOnly, "p-nobody"), false);
  assert.deepEqual(plain(L.matPlaces(null, p.id)), []);
});

test("packItems: pack, sheet, mat only when needed, water; duplicates once", () => {
  const labels = (items) => plain(items.map((i) => i.label));
  assert.deepEqual(labels(L.packItems(infoCfg, false)), ["Spacák", "Vankúš", "Plachta na matrac", "Balená voda"]);
  assert.deepEqual(labels(L.packItems(infoCfg, true)), ["Spacák", "Vankúš", "Plachta na matrac", "Karimatka", "Balená voda"]);
  assert.deepEqual(plain(L.packItems(infoCfg, true)[3]), { icon: "karimatka", label: "Karimatka" });
  const dup = { ...infoCfg, pack: [{ icon: "plachta", label: "plachta na matrac" }] };
  const withNote = L.packItems({ pack: [{ icon: "spacak", label: "Spacák", note: "Požičiame." }, { icon: "x", label: "Y", note: null }] }, false);
  assert.equal(withNote[0].note, "Požičiame.");
  assert.equal("note" in withNote[1], false);
  assert.deepEqual(labels(L.packItems(dup, false)), ["plachta na matrac", "Balená voda"]);
  assert.deepEqual(plain(L.packItems(null, true)), []);
});

test("loadPacked and togglePacked use the injected storage; corrupt JSON gives an empty set", () => {
  const st = memoryStorage();
  assert.equal(L.loadPacked(st).size, 0);
  assert.equal(L.togglePacked(st, "Spacák").has("Spacák"), true);
  L.togglePacked(st, "Vankúš");
  assert.deepEqual([...L.loadPacked(st)], ["Spacák", "Vankúš"]);
  assert.equal(L.togglePacked(st, "Spacák").has("Spacák"), false);
  assert.deepEqual([...L.loadPacked(st)], ["Vankúš"]);
  assert.equal(L.loadPacked(memoryStorage("{not json")).size, 0);
  assert.equal(L.loadPacked(memoryStorage('{"a":1}')).size, 0);
});

test("packProgressText", () => {
  assert.equal(L.packProgressText(3, 15), "Ťukni, čo už máš · 3 z 15");
  assert.equal(L.packProgressText(0, 5), "Ťukni, čo už máš · 0 z 5");
  assert.equal(L.packProgressText(5, 5), "Všetko zbalené!");
});

test("waterDefaults: nights of the stay, day visits for a day-only party, null for unknowns", () => {
  const stay = party({ adults: 2, kids: 1, kids_in_parents_bed: 1, arrive: FRI, leave: "2026-11-01" });
  const day = party({ id: "p-bbbbbb", adults: 1, kids: 0, arrive: null, leave: null, day_visits: [THU, FRI, SAT] });
  const s = infoState([stay, day]);
  assert.deepEqual(plain(L.waterDefaults(s, stay.id)), { people: 3, days: 2 });
  assert.deepEqual(plain(L.waterDefaults(s, day.id)), { people: 1, days: 3 });
  assert.equal(L.waterDefaults(s, "p-nobody"), null);
  assert.equal(L.waterDefaults({ ...s, info: null }, stay.id), null);
  assert.deepEqual(plain(L.waterBounds(s)), { peopleMin: 1, peopleMax: 20, daysMin: 1, daysMax: 4 });
});

test("waterResult and formatNumber", () => {
  assert.deepEqual(plain(L.waterResult(3, 2, infoCfg.water)), { liters: 12, bottles: 8 });
  assert.deepEqual(plain(L.waterResult(1, 1, infoCfg.water)), { liters: 2, bottles: 2 });
  assert.equal(L.waterResult(2, 2, null), null);
  assert.equal(L.formatNumber(1.5), "1,5");
  assert.equal(L.formatNumber(12), "12");
});

test("briefing status: all five, list alone, partial, none", () => {
  const a = party({ id: "p-aaaaaa", name: "A" }), b = party({ id: "p-bbbbbb", name: "B" });
  const c = party({ id: "p-cccccc", name: "C" }), d = party({ id: "p-dddddd", name: "D" });
  const s = infoState([a, b, c, d], {}, {
    [a.id]: ["pack", "water", "food", "program", "sleep"],
    [b.id]: ["list"],
    [c.id]: ["pack", "sleep", "list-not-a-step"],
  });
  assert.equal(L.briefingDone(s, a.id), true);
  assert.equal(L.briefingDone(s, b.id), true);
  assert.equal(L.briefingDone(s, c.id), false);
  assert.equal(L.briefingDone(s, d.id), false);
  assert.equal(L.briefingStatusText(s, a.id), "✓ prejdené");
  assert.equal(L.briefingStatusText(s, b.id), "✓ prejdené");
  assert.equal(L.briefingStatusText(s, c.id), "2 z 5");
  assert.equal(L.briefingStatusText(s, d.id), "ešte nie");
  assert.deepEqual(plain(L.briefingCount(s)), { done: 2, total: 4 });
  assert.deepEqual(plain(L.notBriefedNames(s)), ["C", "D"]);
  const off = { ...s, info: null };
  assert.equal(L.briefingStatusText(off, a.id), null);
  assert.equal(L.briefingCount(off), null);
  assert.deepEqual(plain(L.notBriefedNames(off)), []);
  assert.equal(L.briefingStatusText(s, "p-nobody"), null);
  assert.equal(L.briefingDone({ ...s, briefing: undefined }, a.id), false);
});

test("nextStation and boardHint", () => {
  assert.equal(L.nextStation([]), "pack");
  assert.equal(L.nextStation(["pack", "sleep"]), "water");
  assert.equal(L.nextStation(["pack", "water", "food", "program", "sleep"]), null);
  assert.equal(L.nextStation(undefined), "pack");
  assert.equal(L.boardHint("water"), "Teraz ťukni na studňu.");
  assert.equal(L.boardHint("sleep"), "Nakoniec ťukni na chatu. Kde budeš spať?");
  assert.equal(L.boardHint(null), null);
});

test("quickWhatsAppText: water line only for non-drinkable water, no HTML", () => {
  const text = L.quickWhatsAppText(infoCfg, "Chata");
  assert.equal(text, [
    "*Chata*",
    "💧 Voda z kohútika nie je pitná, dones balenú (2 l na človeka a deň).",
    "🎒 Zbaľ si: spacák, vankúš.",
    "🛏️ Plachta na matrac.",
    "🍲 Št 29. 10. guláš.",
    "🍞 Dones: raňajky.",
    "🍂 Lampiónový sprievod.",
  ].join("\n"));
  assert.ok(!/<[a-z]/i.test(text));
  const drinkable = L.quickWhatsAppText({ ...infoCfg, water: { ...infoCfg.water, drinkable: true } }, "Chata");
  assert.ok(!drinkable.includes("💧"));
  assert.equal(L.quickWhatsAppText(null, "Chata"), "");
});

// --- „Pred cestou“ art (logic-info-art.js, app-adventure.js) ---

test("every INFO_ICONS name of app/models.py has a well-formed sprite", () => {
  const models = fs.readFileSync(path.join(root, "app", "models.py"), "utf8");
  const block = models.match(/INFO_ICONS = frozenset\(\s*((?:"[^"]*"\s*)+)\.split\(\)/);
  assert.ok(block, "INFO_ICONS not found in app/models.py");
  const names = [...block[1].matchAll(/"([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  assert.ok(names.length >= 22);
  for (const name of [...names, "batoh"]) {
    const rows = L.INFO_SPRITES[name];
    assert.ok(Array.isArray(rows) && rows.length > 0, `no sprite for ${name}`);
    for (const row of rows) {
      assert.equal(row.length, rows[0].length, `ragged sprite ${name}`);
      for (const ch of row) assert.ok(ch === "." || L.PAL[ch], `unknown color ${ch} in ${name}`);
    }
    assert.ok(L.spriteRects(name, 1).length > 0);
  }
  assert.equal(L.spriteRects("bunda", 1).find((r) => r.fill === "#3E6FB0") !== undefined, true);
});

test("the adventure files avoid innerHTML and are listed in index.html", () => {
  for (const f of ["logic-info-art.js", "app-adventure.js", "app-slides.js", "app-briefing.js"]) {
    assert.ok(!/innerHTML/.test(fs.readFileSync(path.join(root, "static", "js", f), "utf8")), f);
    assert.ok(scriptTags.includes(`static/js/${f}`), f);
  }
});

test("summaryText: Pred cestou line for parties that are not done", () => {
  const a = party({ id: "p-aaaaaa", name: "A" }), b = party({ id: "p-bbbbbb", name: "B" });
  const c = party({ id: "p-cccccc", name: "C" }), d = party({ id: "p-dddddd", name: "D" });
  const link = "https://cabin.example/";
  const s = infoState([a, b, c, d], {}, { [a.id]: ["list"], [b.id]: ["pack"] });
  const lines = L.summaryText(s, link).split("\n");
  assert.equal(lines[lines.length - 3], "Pred cestou ešte neprešli: B, C, D");
  assert.equal(lines[lines.length - 1], "Tu sa zapíšeš: " + link);
  const done = infoState([a], {}, { [a.id]: ["list"] });
  assert.ok(!L.summaryText(done, link).includes("Pred cestou"));
  assert.ok(!L.summaryText({ ...s, info: null }, link).includes("Pred cestou"));
  assert.ok(!L.summaryText(infoState([], {}, {}), link).includes("Pred cestou"));
});

test("bottlesText uses the Slovak plural of „fľaša“", () => {
  assert.equal(L.bottlesText(1, 1.5), "≈ 1 fľaša po 1,5 l");
  assert.equal(L.bottlesText(3, 1.5), "≈ 3 fľaše po 1,5 l");
  assert.equal(L.bottlesText(8, 2), "≈ 8 fliaš po 2 l");
});

test("bringText: one closing mark, no double period", () => {
  assert.equal(L.bringText("raňajky a koláč"), "raňajky a koláč.");
  assert.equal(L.bringText("raňajky a koláč."), "raňajky a koláč.");
  assert.equal(L.bringText("  koláč!  "), "koláč!");
  assert.equal(L.bringText(""), ".");
  const text = L.quickWhatsAppText({ ...infoCfg, bring: "koláč." }, "Chata");
  assert.ok(text.includes("Dones: koláč.") && !text.includes("koláč.."));
});

test("slideSignature: changes only when the food or sleep slide data changes", () => {
  const p = party({ id: "p-aaaaaa", name: "A" }), q = party({ id: "p-bbbbbb", name: "B" });
  const a = infoState([p, q], { [THU]: { "left-cot-1-1": p.id } });
  const same = { ...a, version: a.version + 1 };
  for (const step of ["food", "sleep"]) assert.equal(L.slideSignature(step, a, p.id), L.slideSignature(step, same, p.id));
  assert.equal(L.slideSignature("pack", a, p.id), "");
  assert.equal(L.slideSignature("sleep", { ...a, info: null }, p.id), "");
  // another party's place changes the food counts but not my sleep note
  const moved = infoState([p, q], { [THU]: { "left-cot-1-1": p.id, "left-cot-2-1": q.id } });
  assert.equal(L.slideSignature("sleep", a, p.id), L.slideSignature("sleep", moved, p.id));
  assert.notEqual(L.slideSignature("sleep", a, p.id), L.slideSignature("sleep", infoState([p, q], {}), p.id));
});

test("the adventure shows the next station button on desktop and a non-modal slide", () => {
  const src = fs.readFileSync(path.join(root, "static", "js", "app-adventure.js"), "utf8");
  assert.ok(src.includes('adv.slide && !wide ? "‹ Späť na dvor"'));
  assert.ok(src.includes('setAttribute("aria-modal", wide ? "false" : "true")'));
});

test("no fixed cabin sentences left in static/", () => {
  const dir = path.join(root, "static");
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : files.push(path.join(d, f.name)); })(dir);
  const bad = ["Koniec októbra na chate", "Postele a matrace sú pripravené", "Nákup na spoločné jedlá", "Nič nie je povinné"];
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8");
    for (const b of bad) assert.ok(!t.includes(b), b + " in " + f);
  }
});

test("facilityLists, menuDays, infoList tolerate missing fields", () => {
  assert.equal(JSON.stringify(L.facilityLists({})), JSON.stringify({ have: [], missing: [] }));
  assert.equal(JSON.stringify(L.facilityLists(null)), JSON.stringify({ have: [], missing: [] }));
  assert.equal(JSON.stringify(L.facilityLists({ facilities: { have: ["gril", ""], missing: ["WC"] } })), JSON.stringify({ have: ["gril"], missing: ["WC"] }));
  assert.equal(JSON.stringify(L.facilityLists({ facilities: { have: ["gril"] } })), JSON.stringify({ have: ["gril"], missing: [] }));
  assert.equal(JSON.stringify(L.menuDays({})), JSON.stringify([]));
  assert.equal(L.menuDays(infoCfg).length, 1);
  assert.equal(JSON.stringify(L.infoList(undefined)), JSON.stringify([]));
});

test("quickWhatsAppText: new optional fields appear only when set, no menu line without menu", () => {
  const { menu, bring, ...bare } = infoCfg;
  const base = L.quickWhatsAppText(bare, "Chata");
  assert.ok(!base.includes("🍲") && !base.includes("🍞") && !base.includes("🚫") && !base.includes("🕓") && !base.includes("🛒"));
  const full = L.quickWhatsAppText({
    ...bare, host_arrival: "Prídem o 16:00.", food_plan: ["grilovanie", "mäso"], food_note: "Obchod je blízko.",
    facilities: { have: ["gril"], missing: ["sprcha", "WC"] },
  }, "Chata");
  const lines = full.split("\n");
  assert.equal(lines[1], "🕓 Prídem o 16:00.");
  assert.ok(full.includes("🚫 Na chate nie je: sprcha, WC."));
  assert.ok(full.includes("🍲 Varí sa: grilovanie, mäso."));
  assert.ok(full.includes("🛒 Obchod je blízko."));
  assert.ok(!full.includes("gril."));
  assert.ok(L.quickWhatsAppText({ ...bare, facilities: { have: ["gril"] } }, "Chata").indexOf("🚫") === -1);
});

test("slideSignature covers the new food and sleep fields", () => {
  const p = party({ id: "p-aaaaaa", name: "A" });
  const a = infoState([p], {});
  const withInfo = (extra) => ({ ...a, info: { ...a.info, ...extra } });
  for (const [step, extra] of [["food", { food_plan: ["x"] }], ["food", { food_note: "y" }], ["food", { food_intro: "z" }],
    ["sleep", { facilities: { have: ["a"], missing: [] } }], ["sleep", { sleep_intro: "q" }]]) {
    assert.notEqual(L.slideSignature(step, a, p.id), L.slideSignature(step, withInfo(extra), p.id));
  }
});
