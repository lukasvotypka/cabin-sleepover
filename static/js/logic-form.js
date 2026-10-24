// Pure page logic, part 4: the party form.
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).

// --- party form ---

// `color` is "" for „Vyberie sa sama“ (the server picks), else "#RRGGBB".
function defaultPartyForm(event) {
  return {
    name: "", adults: 2, kids: 0, kids_in_parents_bed: 0,
    arrive: event.arrive_days[0], leave: event.leave_days[event.leave_days.length - 1], arrival_time: "", note: "",
    color: "", day_only: false, day_visits: []
  };
}

// `event` is needed for a day-only party: its arrive and leave become the default first and last event days,
// so turning „Prídem len na návštevu“ off in the form has values to show.
function partyToForm(party, event) {
  var dayOnly = isDayOnly(party);
  var arrive = party.arrive, leave = party.leave;
  if (dayOnly) {
    var d = event ? defaultPartyForm(event) : { arrive: "", leave: "" };
    arrive = d.arrive;
    leave = d.leave;
  }
  return {
    name: party.name, adults: party.adults, kids: party.kids, kids_in_parents_bed: party.kids_in_parents_bed,
    arrive: arrive, leave: leave, arrival_time: party.arrival_time || "", note: party.note || "",
    color: party.color, day_only: dayOnly, day_visits: dayOnly ? party.day_visits.slice() : []
  };
}

// The request body from the raw form values (strings). A count that is not a whole number becomes NaN,
// which checkPartyPayload rejects. An empty count is 0.
function partyPayload(raw) {
  function count(v) {
    var s = v === undefined || v === null ? "" : String(v).trim();
    if (s === "") return 0;
    return /^\d+$/.test(s) ? +s : NaN;
  }
  function text(v) {
    return v === undefined || v === null ? "" : String(v).trim();
  }
  var payload = {
    name: text(raw.name), adults: count(raw.adults), kids: count(raw.kids), kids_in_parents_bed: count(raw.kids_in_parents_bed),
    arrive: text(raw.arrive), leave: text(raw.leave), arrival_time: text(raw.arrival_time), note: text(raw.note)
  };
  if (raw.day_only) {
    // A day-only party has day_visits instead of arrive and leave, and no child sleeps in a bed.
    var picked = Array.isArray(raw.day_visits) ? raw.day_visits.map(text).filter(function (d) { return d !== ""; }) : [];
    payload.day_visits = picked.filter(function (d, i) { return picked.indexOf(d) === i; }).sort();
    payload.kids_in_parents_bed = 0;
    delete payload.arrive;
    delete payload.leave;
  }
  // No color key at all means „Vyberie sa sama“ (create) or „keep the color“ (edit).
  if (text(raw.color) !== "") payload.color = text(raw.color);
  return payload;
}

// The 12 party colors offered as swatches; the same list as PARTY_PALETTE in app/models.py.
var PARTY_PALETTE = [
  "#2F7D6D", "#D07A2B", "#6D5BA8", "#C08A1E", "#3E6FB0", "#9C4A7A",
  "#5E8A2E", "#8A6A4A", "#2E8AA0", "#C0603A", "#7A7F2B", "#A04848"
];

// Allowed relative luminance of a party color. These mirror COLOR_MIN_LUMINANCE / COLOR_MAX_LUMINANCE
// in app/validate.py; keep both equal.
var COLOR_MIN_LUMINANCE = 0.06;
var COLOR_MAX_LUMINANCE = 0.36;

// null when the color is fine, else "color_format", "color_too_light" or "color_too_dark".
function colorProblem(hex) {
  if (typeof hex !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return "color_format";
  var lum = relLuminance(hex);
  if (lum > COLOR_MAX_LUMINANCE) return "color_too_light";
  if (lum < COLOR_MIN_LUMINANCE) return "color_too_dark";
  return null;
}

function isCount(n) {
  return typeof n === "number" && n >= 0 && n <= PARTY_LIMITS.countMax && Math.floor(n) === n;
}

// A quick pre-check of the form, only for speed: the server checks again. Returns null, or an error in
// the shape of a server error ({code: "invalid", params: {field}}) so that errorText words it.
// `currentColor` is the stored color of the party being edited: the server skips the brightness check for it.
function checkPartyPayload(p, event, currentColor) {
  function bad(field, reason) {
    return { code: "invalid", params: reason ? { field: field, reason: reason } : { field: field } };
  }
  if (!p.name) return bad("name", "name_empty");
  if (p.name.length > PARTY_LIMITS.name) return bad("name");
  if (!isCount(p.adults)) return bad("adults");
  if (!isCount(p.kids)) return bad("kids");
  if (!isCount(p.kids_in_parents_bed) || p.kids_in_parents_bed > p.kids) return bad("kids_in_parents_bed");
  if (p.day_visits !== undefined) {
    if (!p.day_visits.length) return bad("day_visits", "day_visits_empty");
    var eventDayList = eventDays(event);
    if (p.day_visits.some(function (d) { return eventDayList.indexOf(d) === -1; })) return bad("day_visits", "day_outside_event");
  } else {
    if (event.arrive_days.indexOf(p.arrive) === -1) return bad("arrive");
    if (event.leave_days.indexOf(p.leave) === -1) return bad("leave");
    if (!(p.arrive < p.leave)) return bad("leave", "leave_not_after_arrive");
  }
  if (p.arrival_time.length > PARTY_LIMITS.arrival_time) return bad("arrival_time");
  if (p.note.length > PARTY_LIMITS.note) return bad("note");
  if (p.color !== undefined && !(currentColor && String(currentColor).toUpperCase() === p.color.toUpperCase())) {
    var problem = colorProblem(p.color);
    if (problem === "color_format") return bad("color");
    if (problem) return bad("color", problem);
  }
  return null;
}

var FORM_FIELDS = ["name", "adults", "kids", "kids_in_parents_bed", "arrive", "leave", "day_visits", "arrival_time", "note", "color"];

// The form field a server error is about (`params.field`), or "" when it is not one of the form fields.
function errorField(error) {
  var f = error && error.params && typeof error.params === "object" ? error.params.field : "";
  return typeof f === "string" && FORM_FIELDS.indexOf(f) !== -1 ? f : "";
}

// "Štvrtok 29. 10." for the arrive and leave selects.
function dayOptionText(iso) {
  var p = parseIso(iso);
  return p ? capitalize(DAY_NAMES[p.dow]) + " " + p.d + ". " + p.m + "." : String(iso);
}

// "2 dospelí, 1 dieťa" / "2 dospelí, 2 deti (1 spí s rodičmi)" / "1 dospelý" for the „Kto je kto“ list.
function peopleText(party) {
  var a = party.adults, k = party.kids, b = party.kids_in_parents_bed;
  var text = a === 1 ? "1 dospelý" : a >= 2 && a <= 4 ? a + " dospelí" : a + " dospelých";
  if (k > 0) text += ", " + (k === 1 ? "1 dieťa" : k >= 2 && k <= 4 ? k + " deti" : k + " detí");
  if (b > 0) text += " (" + b + (b >= 2 && b <= 4 ? " spia" : " spí") + " s rodičmi)";
  return text;
}

// "Št 29. 10. – Ne 1. 11." from the arrive and leave days (the raw string for a date that does not parse).
function stayText(party) {
  function one(iso) {
    var p = parseIso(iso);
    return p ? DAY_SHORT[p.dow] + " " + p.d + ". " + p.m + "." : String(iso);
  }
  return one(party.arrive) + " – " + one(party.leave);
}
