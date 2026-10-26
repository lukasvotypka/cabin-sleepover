// Pure page logic, phone login: who is protected, the login panel state, the resend countdown.
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// The phone number never comes from the server, only `phone_hint` (the last 3 digits). The server decides what is valid.

var RESEND_SECONDS = 60;
var LOGIN_CODE_LENGTH = 6;

// A party with a phone is protected; the server tells it only by `phone_hint`.
function isProtected(party) {
  return !!party && typeof party.phone_hint === "string" && party.phone_hint !== "";
}

// `verifiedIds` is the list of party ids from GET /api/session.
function isVerifiedParty(party, verifiedIds) {
  return !!party && Array.isArray(verifiedIds) && verifiedIds.indexOf(party.id) >= 0;
}

function needsLogin(party, verifiedIds) {
  return isProtected(party) && !isVerifiedParty(party, verifiedIds);
}

function canEditParty(party, verifiedIds, isAdmin) {
  return !!party && (isAdmin === true || !needsLogin(party, verifiedIds));
}

function phoneHintText(party) {
  return isProtected(party) ? "…" + party.phone_hint : "";
}

// Same inputs as the server (normalize_phone): spaces, dashes, dots and brackets dropped,
// "00" becomes "+", a single leading "0" means +421. Returns E.164 or null.
function normalizePhoneInput(raw) {
  var value = String(typeof raw === "string" ? raw : "").replace(/[\s().\-]/g, "");
  if (value.indexOf("00") === 0) value = "+" + value.slice(2);
  else if (value.charAt(0) === "0") value = "+421" + value.slice(1);
  return /^\+[1-9][0-9]{7,14}$/.test(value) ? value : null;
}

// "+421905123456" -> "+421 905 123 456" for display; anything else is returned as typed.
function formatPhoneDisplay(raw) {
  var e164 = normalizePhoneInput(raw);
  if (!e164) return typeof raw === "string" ? raw.trim() : "";
  if (e164.indexOf("+421") === 0 && e164.length === 13) {
    return "+421 " + e164.slice(4, 7) + " " + e164.slice(7, 10) + " " + e164.slice(10);
  }
  return e164;
}

function isLoginCode(text) {
  return typeof text === "string" && /^[0-9]{6}$/.test(text);
}

// Keeps only digits, at most 6 (for the code input).
function cleanLoginCode(text) {
  return String(typeof text === "string" ? text : "").replace(/[^0-9]/g, "").slice(0, LOGIN_CODE_LENGTH);
}

// --- login panel state: step "phone" -> "code" -> "done" ---

function loginInitial() {
  return { step: "phone", phone: "", code: "", busy: false, error: null, sentAt: null };
}

// Actions: {type: "phone", value}, {type: "code", value}, {type: "send"} (request started),
// {type: "sent", at} (SMS sent), {type: "verify"} (check started), {type: "verified"},
// {type: "failed", error} (server error `{code, params}` kept as is), {type: "back"}.
function loginReduce(state, action) {
  var s = Object.assign({}, state);
  switch (action && action.type) {
    case "phone":
      if (s.step !== "phone") return state;
      s.phone = String(action.value || "");
      s.error = null;
      return s;
    case "code":
      if (s.step !== "code") return state;
      s.code = cleanLoginCode(action.value);
      s.error = null;
      return s;
    case "send":
      if (s.busy || s.step === "done") return state;
      s.busy = true;
      s.error = null;
      return s;
    case "sent":
      s.busy = false;
      s.step = "code";
      s.code = "";
      s.sentAt = action.at;
      s.error = null;
      return s;
    case "verify":
      if (s.busy || s.step !== "code" || !isLoginCode(s.code)) return state;
      s.busy = true;
      s.error = null;
      return s;
    case "verified":
      s.busy = false;
      s.step = "done";
      s.error = null;
      return s;
    case "failed":
      s.busy = false;
      s.error = action.error && typeof action.error.code === "string" ? action.error : { code: "unknown" };
      return s;
    case "back":
      if (s.step !== "code") return state;
      return Object.assign(loginInitial(), { phone: s.phone });
    default:
      return state;
  }
}

function canSendLoginCode(state) {
  return state.step === "phone" && !state.busy && normalizePhoneInput(state.phone) !== null;
}

function canVerifyLoginCode(state) {
  return state.step === "code" && !state.busy && isLoginCode(state.code);
}

// Seconds until „Poslať znova“ is allowed: 60 right after sending, 0 when it may be used. Times in ms.
function resendSecondsLeft(sentAt, now) {
  if (typeof sentAt !== "number" || typeof now !== "number") return 0;
  var left = Math.ceil(RESEND_SECONDS - (now - sentAt) / 1000);
  return Math.min(RESEND_SECONDS, Math.max(0, left));
}

function canResend(state, now) {
  return state.step === "code" && !state.busy && resendSecondsLeft(state.sentAt, now) === 0;
}

// --- the „Telefón“ section of the party form ---

// What the section shows for a party that is being edited. Only with `sms_enabled`; with a number it
// offers „Zmeniť“ and „Odstrániť“, and „Odhlásiť toto zariadenie“ when this device has verified the party.
function phoneSectionInfo(party, smsEnabled, verifiedIds) {
  if (!party || smsEnabled !== true) return { visible: false };
  var has = isProtected(party);
  return {
    visible: true,
    hasPhone: has,
    text: has ? "Telefón končí na " + phoneHintText(party) : "Pridať telefón (na prihlásenie)",
    canLogout: has && isVerifiedParty(party, verifiedIds)
  };
}

var PHONE_TEXTS = {
  addTitle: "Pridať telefón",
  changeTitle: "Zmeniť telefón",
  addIntro: "Zadaj telefónne číslo. Pošleme na neho kód a potom budeš partiu meniť iba ty.",
  changeIntro: "Zadaj nové telefónne číslo. Pošleme na neho kód.",
  offer: "Chceš si pridať telefón? Potom bude partiu meniť iba ty, na iných zariadeniach sa prihlásiš kódom z SMS.",
  removeAsk: "Naozaj odstrániť telefón? Partiu potom môže meniť každý, kto má kód skupiny.",
  removed: "Telefón je odstránený.",
  added: "Telefón je uložený.",
  loggedOut: "Toto zariadenie je odhlásené."
};
