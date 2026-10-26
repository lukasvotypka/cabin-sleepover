// Pure page logic, part 6: the only place that turns a server error code into Slovak.
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).

// --- error texts: the only place that turns a server `code` into Slovak ---

// Slovak texts for an `invalid` error with a known `params.reason`; they win over the generic field text.
var REASON_TEXTS = {
  leave_not_after_arrive: "Odchod musí byť po príchode.",
  name_empty: "Napíš meno.",
  color_too_light: "Táto farba je príliš svetlá, postavičku by na posteli nebolo vidno. Vyber tmavšiu.",
  stay_mode_mixed: "Vyber buď príchod a odchod, alebo dni návštevy, nie oboje.",
  day_visits_empty: "Vyber aspoň jeden deň, keď prídeš.",
  stay_incomplete: "Vyber príchod aj odchod.",
  duplicate_day: "Každý deň vyber len raz.",
  day_outside_event: "Tento deň nie je v termíne chaty.",
  day_only_kids_in_bed: "Keď prídeš len cez deň, deti v rodičovskej posteli nechaj na 0.",
  places_out_of_range: "Počet miest nesedí. Obnov stránku a skús to znova.",
  too_long: "Text je príliš dlhý, skráť ho (najviac 120 znakov).",
  control_chars: "Text obsahuje nepovolené znaky. Napíš ho znova.",
  color_too_dark: "Táto farba je príliš tmavá, postavičku by na posteli nebolo vidno. Vyber svetlejšiu."
};

var FIELD_NAMES = {
  name: "meno", adults: "počet dospelých", kids: "počet detí", kids_in_parents_bed: "deti spiace s rodičmi",
  arrive: "príchod", day_visits: "dni návštevy", leave: "odchod", arrival_time: "čas príchodu", note: "poznámka", color: "farba",
  night: "noc", nights: "noci", slot: "miesto", slots: "miesta", from_slot: "miesto", to_slot: "miesto",
  party_id: "výber, kto si", code: "kód", phone: "telefónne číslo"
};

function paramText(params, key) {
  var v = params[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function partyNameFrom(params, state) {
  var name = paramText(params, "party_name");
  if (name) return name;
  var party = partyById(state, paramText(params, "party_id"));
  return party ? party.name : "";
}

function waitText(seconds) {
  if (typeof seconds !== "number" || !isFinite(seconds) || seconds < 1) return "";
  var s = Math.ceil(seconds);
  return s < 60 ? s + " s" : Math.ceil(s / 60) + " min";
}

var ERROR_TEXTS = {
  bad_code: function () {
    return "Kód nesedí, skús ho zadať znova.";
  },
  forbidden: function () {
    return "Toto môže robiť len organizátor.";
  },
  signup_closed: function () {
    return "Zápis je zatvorený, miesta sa dajú len prezerať.";
  },
  slot_taken: function (p, state) {
    var when = dayLocative(paramText(p, "night"));
    var who = partyNameFrom(p, state);
    if (p.own === true) return "Toto miesto už " + (when ? when + " " : "") + "máš.";
    if (who) return "Toto miesto má" + (when ? " " + when : "") + " už " + who + ".";
    return "Toto miesto" + (when ? " " + when : "") + " je už obsadené.";
  },
  not_present: function (p, state) {
    var when = dayLocative(paramText(p, "night"));
    var who = partyNameFrom(p, state);
    if (who && isDayOnly(partyById(state, paramText(p, "party_id")))) return "„" + who + "“ prichádza len cez deň a posteľ nepotrebuje.";
    return (who ? "„" + who + "“ " + (when ? when : "v túto noc") + " nie je" : "Nikto z vás nie je " + (when ? when : "v túto noc")) +
      " na chate. Uprav príchod alebo odchod.";
  },
  duplicate_name: function (p) {
    var name = paramText(p, "name");
    return (name ? "Meno „" + name + "“" : "Také meno") + " už niekto má. Skús iné.";
  },
  unknown_slot: function (p, state) {
    var bed = state && state.layout ? bedOfSlot(state.layout, paramText(p, "slot")) : null;
    return (bed ? "Miesto pri posteli „" + bed.name + "“ sa nedá použiť." : "Také miesto na chate nie je.") +
      " Obnov stránku.";
  },
  unknown_party: function () {
    return "Toto meno sme nenašli. Vyber znova, kto si.";
  },
  login_required: function (p, state) {
    var who = partyNameFrom(p, state);
    if (!who) return "Tento zápis je chránený telefónom. Zmeniť ho môže iba ten, kto overil číslo.";
    return who + " si chránia zápis telefónom. Zmeniť ho môžu iba oni.";
  },
  phone_mismatch: function () {
    return "Toto číslo nesedí s uloženým číslom. Skús to znova.";
  },
  bad_sms_code: function () {
    return "Kód nesedí alebo mu vypršala platnosť. Skontroluj ho, alebo si pošli nový.";
  },
  sms_unavailable: function () {
    return "SMS sa teraz nedá poslať. Skús to o chvíľu, alebo napíš organizátorovi.";
  },
  invalid: function (p) {
    if (paramText(p, "field") === "phone") return "Telefónne číslo nesedí. Napíš ho napríklad ako „0905 123 456“ alebo „+421 905 123 456“.";
    if (REASON_TEXTS.hasOwnProperty(paramText(p, "reason"))) return REASON_TEXTS[paramText(p, "reason")];
    var field = FIELD_NAMES.hasOwnProperty(paramText(p, "field")) ? FIELD_NAMES[paramText(p, "field")] : "";
    return field ? "Skontroluj pole „" + field + "“." : "Niečo v zadaní nesedí, skontroluj ho.";
  },
  rate_limited: function (p) {
    var wait = waitText(p.retry_after);
    return wait ? "Príliš veľa pokusov za krátky čas, skús to o " + wait + "." : "Príliš veľa pokusov za krátky čas, chvíľu počkaj.";
  }
};

// Slovak text for a server error `{code, message, params}`. The English `message` is never used.
// A missing error (network failure) and an unknown code both give the generic text.
function errorText(error, state) {
  if (!error || typeof error !== "object" || typeof error.code !== "string") return FALLBACK_ERROR;
  if (!ERROR_TEXTS.hasOwnProperty(error.code)) return FALLBACK_ERROR;
  var params = error.params && typeof error.params === "object" ? error.params : {};
  return ERROR_TEXTS[error.code](params, state || null) || FALLBACK_ERROR;
}
