// Pure page logic, part 6: „Pred cestou“ (info for guests): packing list, water, who went through it, quick text.
// No DOM access. `state.info` is null when the feature is off (no config/info.yaml); `state.briefing` maps
// a party id to the steps it opened.

var BRIEFING_STEPS = ["pack", "water", "food", "program", "sleep"];   // station order: auto, studňa, ohnisko, smerovník, chata
var PACKED_KEY = "info-packed";
var WATER_LIMITS = { peopleMin: 1, peopleMax: 20, daysMin: 1 };
var BRIEFING_HINTS = {
  pack: "Ťukni na auto, vybalíme batoh.",
  water: "Teraz ťukni na studňu.",
  food: "Ťukni na ohnisko. Čo sa bude variť?",
  program: "Ťukni na smerovník. Kam pôjdeme?",
  sleep: "Nakoniec ťukni na chatu. Kde budeš spať?"
};

// The places ("room · bed") where the party sleeps on mats or a cot, in night order, each once.
function matPlaces(state, partyId) {
  var out = [];
  if (!state || !state.layout || !partyById(state, partyId)) return out;
  (state.event.nights || []).forEach(function (night) {
    var held = (state.sleeping && state.sleeping[night]) || {};
    Object.keys(held).forEach(function (slot) {
      if (held[slot] !== partyId) return;
      state.layout.rooms.forEach(function (room) {
        room.beds.forEach(function (bed) {
          if (bed.slots.indexOf(slot) === -1 || (bed.kind !== "mats" && bed.kind !== "cot")) return;
          var name = room.name + " · " + bed.name;
          if (out.indexOf(name) === -1) out.push(name);
        });
      });
    });
  });
  return out;
}

function needsMat(state, partyId) {
  return matPlaces(state, partyId).length > 0;
}

// The packing list: info.pack, bedding sheet, the mat when needed, bottled water. An item whose label an
// added one repeats (ignoring case) is shown once.
function packItems(info, withMat) {
  if (!info) return [];
  var out = [], seen = {};
  function add(icon, label) {
    var key = String(label).toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push({ icon: icon, label: label });
  }
  (info.pack || []).forEach(function (p) { add(p.icon, p.label); });
  add("plachta", "Plachta na matrac");
  if (withMat) add("karimatka", "Karimatka");
  add("flasa", "Balená voda");
  return out;
}

// The labels ticked on this phone (a Set); corrupt or missing data gives an empty set.
function loadPacked(storage) {
  try {
    var list = JSON.parse(storage.getItem(PACKED_KEY) || "[]");
    return new Set(Array.isArray(list) ? list.filter(function (x) { return typeof x === "string"; }) : []);
  } catch (e) {
    return new Set();
  }
}

// Flips one label and saves; returns the new set.
function togglePacked(storage, label) {
  var set = loadPacked(storage);
  if (set.has(label)) set.delete(label); else set.add(label);
  try { storage.setItem(PACKED_KEY, JSON.stringify(Array.from(set))); } catch (e) { /* storage full or blocked */ }
  return set;
}

function packProgressText(done, total) {
  if (total > 0 && done >= total) return "Všetko zbalené!";
  return "Ťukni, čo už máš · " + done + " z " + total;
}

// Starting values of the water calculator: people, and days (nights of the stay, or day visits).
function waterDefaults(state, partyId) {
  var party = partyById(state, partyId);
  if (!state || !state.info || !party) return null;
  var days = isDayOnly(party)
    ? party.day_visits.length
    : (state.event.nights || []).filter(function (n) { return isPresent(party, n); }).length;
  var b = waterBounds(state);
  return {
    people: Math.min(b.peopleMax, Math.max(b.peopleMin, party.adults + party.kids)),
    days: Math.min(b.daysMax, Math.max(b.daysMin, days))
  };
}

function waterBounds(state) {
  return {
    peopleMin: WATER_LIMITS.peopleMin,
    peopleMax: WATER_LIMITS.peopleMax,
    daysMin: WATER_LIMITS.daysMin,
    daysMax: Math.max(1, eventDays(state && state.event).length)
  };
}

function waterResult(people, days, water) {
  if (!water) return null;
  var liters = people * days * water.liters_per_day;
  return { liters: liters, bottles: Math.ceil(liters / water.bottle_liters) };
}

// 1.5 -> "1,5", 3 -> "3" (one decimal at most).
function formatNumber(n) {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function briefingSteps(state, partyId) {
  var list = (state && state.briefing && state.briefing[partyId]) || [];
  return Array.isArray(list) ? list : [];
}

function briefingStationCount(state, partyId) {
  var steps = briefingSteps(state, partyId);
  return BRIEFING_STEPS.filter(function (s) { return steps.indexOf(s) !== -1; }).length;
}

// Done = all five stations, or the quick list opened.
function briefingDone(state, partyId) {
  if (!state || !state.info || !partyById(state, partyId)) return false;
  return briefingStationCount(state, partyId) === BRIEFING_STEPS.length || briefingSteps(state, partyId).indexOf("list") !== -1;
}

function briefingStatusText(state, partyId) {
  if (!state || !state.info || !partyById(state, partyId)) return null;
  if (briefingDone(state, partyId)) return "✓ prejdené";
  var n = briefingStationCount(state, partyId);
  return n > 0 ? n + " z " + BRIEFING_STEPS.length : "ešte nie";
}

function briefingCount(state) {
  if (!state || !state.info) return null;
  var parties = state.parties || [];
  return {
    done: parties.filter(function (p) { return briefingDone(state, p.id); }).length,
    total: parties.length
  };
}

function notBriefedNames(state) {
  if (!state || !state.info) return [];
  return (state.parties || []).filter(function (p) { return !briefingDone(state, p.id); }).map(function (p) { return p.name; });
}

// The first station not visited yet, or null.
function nextStation(visited) {
  var seen = visited || [];
  for (var i = 0; i < BRIEFING_STEPS.length; i++) {
    if (seen.indexOf(BRIEFING_STEPS[i]) === -1) return BRIEFING_STEPS[i];
  }
  return null;
}

function boardHint(nextStep) {
  return BRIEFING_HINTS[nextStep] || null;
}

// The text for WhatsApp from the quick list (no HTML); the water line only when the tap water is not drinkable.
function quickWhatsAppText(info, title) {
  if (!info) return "";
  var lines = ["*" + title + "*"];
  if (info.water && info.water.drinkable === false) {
    lines.push("💧 Voda z kohútika nie je pitná, dones balenú (" + formatNumber(info.water.liters_per_day) + " l na človeka a deň).");
  }
  lines.push("🎒 Zbaľ si: " + (info.pack || []).map(function (p) { return p.label.toLowerCase(); }).join(", ") + ".");
  lines.push("🛏️ " + (info.sleep || []).map(function (s) { return s.label; }).join(", ") + ".");
  lines.push("🍲 " + (info.menu || []).map(function (d) {
    return dayLabel(d.day) + " " + d.meals.map(function (m) { return m.what; }).join(", ");
  }).join("; ") + ".");
  if (info.bring) lines.push("🍞 Dones: " + info.bring + ".");
  lines.push("🍂 " + (info.program || []).map(function (p) { return p.title; }).join(", ") + ".");
  return lines.join("\n");
}
