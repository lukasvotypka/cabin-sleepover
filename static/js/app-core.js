"use strict";

// App part 1: constants, browser storage, page state, DOM helpers, requests, applying state.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var SVG_NS = "http://www.w3.org/2000/svg";
var POLL_MS = 30000;
var AGE_TICK_MS = 1000;
var CREST_CHIPS_MAX = 6;   // online chips under „Si: …“ (what fits at 380 px after „online:“); the rest is „+N“
// A request that hangs (a phone that slept or lost the network mid-request) is given up after this,
// so the next poll can run. Without it a hung poll blocked all later ones and the page stayed stale.
var POLL_TIMEOUT_MS = 10000;
var WRITE_TIMEOUT_MS = 20000;
var KEYS = { client: "cabin.clientId", party: "cabin.myParty", role: "cabin.role", sound: "cabin.sound" };
var NIGHTS_HIT_GROW = 8;  // most units a signpost hit area grows into the grass above and below
var LONG_PRESS_MS = 500;
var TOAST_MS = 6000;
// The grass around the scene: a tile with a few tufts, the same look as the code screen.
var GRASS_TILE = 96;
var GRASS_TUFTS = [[8, 12], [52, 4], [76, 40], [28, 56], [64, 80], [12, 84], [40, 32]];
var COLORS = {
  grass: "#8E9B48", tuft: "#76823A", path: "#D6BC8E",
  leafRust: "#B5532A", leafOchre: "#D69A2E", leafRed: "#8E3424", roomEdge: "#5C4033", roomLabel: "#4A3426", window: "#9FD3F0",
  woodDark: "#5C4033", wood: "#B98B56", woodLight: "#D4A870", plank: "#6B4426", paper: "#F4EBD0", ink: "#2E1F14",
  selected: "#F2D58A", highlight: "#FFD54A", red: "#B4472F", redEdge: "#6E2414", amber: "#F3E3C0", amberEdge: "#C98A1C",
  green: "#3D7A55", greenEdge: "#1F4A31", white: "#FFFFFF",
  sheet: "#F4F1E8", mat: "#7E8FA0", sofaDark: "#7A3E48", sofaLight: "#B4606C",
  stoveDark: "#9E9E9E", stovePipe: "#6E6E6E", skin: "#F2C9A0", eye: "#3A2A1E",
  furnShadow: "rgba(46,31,20,.35)", bedWood: "#7A4B2A", bedWoodDark: "#4E3020", bedWoodLight: "#A06A3C",
  pillow: "#FFFFFF", pillowShade: "#D9D2C2", quiltBlue: "#6F8FBA", quiltBlueFold: "#C9D8EA", quiltBlueCheck: "#9DB5D4",
  quiltRed: "#B9684E", quiltRedFold: "#F0C2A8", quiltRedCheck: "#D99577", cotSteel: "#8C9AA4", cotSteelDark: "#56636C",
  cotCanvas: "#7F9A5A", cotCanvasLight: "#A7BE80", matFoam: "#4F7FA0", matFoamLight: "#7FA9C6", bag: "#C87A2E",
  bagLight: "#E6A85A", bagDark: "#8E5420", sofaSeam: "#8E4652", stoveTile: "#D8CFC0", stoveTileLine: "#A89C88",
  stoveTileDark: "#7D7264", stoveBlanket: "#C9D8EA", stoveBlanketEdge: "#9DB5D4", stovePipeLight: "#8A8A8A",
  tight: "#E0A33A", picked: "#3AA7E0",
  moon: "#7A8FB8", moonDark: "#3E4F7A", moonBand: "#D9DFEE", nightInk: "#2F3B5C", dayBand: "#F7E7B4", dayInk: "#7A4A0C",
  brick: "#7A3226", brickLight: "#A8523C", brickMortar: "#5A241C"
};
// Signpost tally chip per kind: [edge, face, text] keys of COLORS (under = amber: still to do; over = red: too many).
var TALLY_COLORS = { under: ["amberEdge", "amber", "ink"], over: ["redEdge", "red", "white"], ok: ["greenEdge", "green", "white"] };

// --- browser storage that survives a blocked localStorage ---

var memory = {};
var storage = {
  get: function (key) {
    try { return window.localStorage.getItem(key); } catch (e) { return key in memory ? memory[key] : null; }
  },
  set: function (key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { memory[key] = value; }
  },
  remove: function (key) {
    try { window.localStorage.removeItem(key); } catch (e) { delete memory[key]; }
  }
};

function makeClientId() {
  var bytes = new Uint8Array(12), out = "c-", i;
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  return out;
}

var clientId = storage.get(KEYS.client);
if (!clientId) {
  clientId = makeClientId();
  storage.set(KEYS.client, clientId);
}

// --- page state ---

var splash = { ctx: null, falling: false, raf: 0, endTimer: null, resizeFrame: 0, lastStep: -1, start: 0, signBox: null, signGone: false };

var app = {
  state: null,
  etag: null,
  fetchedAt: 0,
  pollFailed: false,   // the last poll rejected or got an unexpected status
  serverMs: 0,         // `presence.server_time` of the last 200 ...
  serverLocalMs: 0,    // ... and the local time when that response arrived
  night: null,
  nightSynced: false,  // set by the first applyState: only that one may take the night from the remembered party
  myParty: storage.get(KEYS.party),
  session: null,       // {verified: [party_id], sms_enabled} from GET /api/session, null until loaded
  loginPending: null,  // id of a remembered protected party whose login panel opens with „Kto si?“
  askWho: false,       // open „Kto si?“ once the next state has arrived
  introStart: 0,       // performance.now() when the intro clock started (page start, or the join)
  introTimer: null,    // the one pending timer that reveals the map
  introDone: false,    // true when the fall starts: from then on the loading view never comes back
  codeOpen: false,
  codeVoluntary: false, // the code screen was opened by the „Mám admin kód“ link, so „Späť“ shows
  polling: false,
  pollAbort: null,     // AbortController of the poll in flight
  pollAgain: false,    // poll once more as soon as the current poll has finished
  writeEpoch: 0,       // bumped when a write response is applied, so an older poll cannot overwrite it
  pending: [],         // unconfirmed changes {night, slot, party_id} drawn on top of the state
  walking: {},         // "night|slot" keys of beds whose figure is still on its way (drawBed leaves them empty)
  walks: [],           // the walks in progress, one per tap: {start, items: [{key, node, from, to}]}
  walkFrame: 0,        // id of the requested animation frame, 0 when none
  selectedBed: null,   // id of the bed whose sheet is open
  move: null,          // move mode: {partyId, fromSlot, all}
  suppressClick: false, // set by a long press so that its click does not open the sheet
  tipTimer: null,
  toastTimer: null,
  panel: null,
  layoutKey: null,
  layers: null,
  view: null,          // the visible window of the map (zoom and pan), see the zoom functions in the logic script
  bounds: null,        // the whole viewport in scene units: the scene plus the grass around it (fitBounds)
  insetProbe: null,
  refit: null,         // recomputes the bounds after the viewport or the move bar changed
  svg: null,
  zoomReset: null,
  zoomCleanup: null,
  gestureId: 0,        // bumped when a pinch or a drag starts, so pending long-press timers give up
  gestureAt: 0,        // when a pinch or Safari gesture last did something
  navKeyAt: 0,         // when a key that moves focus (not Enter, Space or Escape) was last pressed
  sceneSize: null,
  pinching: false,     // two or more fingers are down on the map
  blockClick: false,   // a drag just ended: its click must not count as a tap
  introZoom: "idle",    // the one-time intro zoom: idle, held (start view under the splash), running or done
  introRaf: 0,         // id of the intro's animation frame
  introZoomAt: 0,      // performance.now() when the intro zoom began easing
  hudHeight: 0,        // height of the bottom HUD in CSS px, to refit the scene when it changes
  questBottom: 0,      // bottom edge of the quest log in CSS px, to refit the scene when it changes
  questRows: null,     // the last quest rows, to notice a finished night
  questParty: null,    // the party those rows were for
  ageNode: null,       // the line under „Si: …“ in the bottom HUD: online chips, or the data age on a problem
  ageKey: null         // what `ageNode` shows now, so the 1 s tick rebuilds it only on a change
};
// The role from /api/join: "group" or "admin" (decide with isAdmin()).
app.role = storage.get(KEYS.role);

// Called when the admin cookie turned out to be gone (a 403 forbidden): renderAdminUi (app-admin.js) hides the key.
function onAdminLost() {
  if (typeof renderAdminUi === "function") renderAdminUi();
}

function setRole(role) {
  var was = isAdmin(app.role);
  app.role = role;
  storage.set(KEYS.role, role);
  if (was && !isAdmin(role)) onAdminLost();
  else if (!was && isAdmin(role) && typeof renderAdminUi === "function") renderAdminUi();
}

function $(id) { return document.getElementById(id); }

// The scene, its hidden text summary and the bottom HUD are shown and hidden together.
function showScene(on) {
  $("scene").hidden = !on;
  $("srSummary").hidden = !on;
  $("hud").hidden = !on;
}

function htmlEl(tag, attrs, text) {
  var node = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl(parent, tag, attrs, text) {
  var node = document.createElementNS(SVG_NS, tag);
  if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

// The server's clock now: its time in the last 200 plus the local time elapsed since then.
function serverNow() {
  return app.serverMs + (Date.now() - app.serverLocalMs);
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// --- requests ---

function request(method, path, body, etag, timeoutMs) {
  var headers = { "Accept": "application/json", "X-Client-Id": clientId };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (etag) headers["If-None-Match"] = etag;
  if (app.myParty) headers["X-Party-Id"] = app.myParty;
  var abort = typeof AbortController === "function" ? new AbortController() : null;
  var timer = abort ? setTimeout(function () { abort.abort(); }, timeoutMs || WRITE_TIMEOUT_MS) : null;
  if (method === "GET") app.pollAbort = abort;
  return fetch(path, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",      // the browser then hands the 304 to this code
    credentials: "same-origin",
    signal: abort ? abort.signal : undefined
  }).then(function (res) {
    clearTimeout(timer);
    var etagOut = res.headers.get("ETag");
    if (res.status === 304) return { status: 304, json: null, etag: etagOut };
    return res.json().then(
      function (json) {
        var role = roleAfterResponse(app.role, res.status, json ? json.error : null);
        if (role !== app.role) setRole(role);
        return { status: res.status, json: json, etag: etagOut };
      },
      function () { return { status: res.status, json: null, etag: null }; }
    );
  }, function (err) {
    clearTimeout(timer);
    throw err;
  });
}

// A write for the bed actions (T-006) and the party form (T-007). It applies the `state` that
// comes with a success and with an error (so the page rolls back to the server's truth) and
// resolves to {ok, status, error, json}. `error` is undefined for a network failure (status 0).
// `ops` are the pending changes of this write: they are dropped just before the answer is applied.
function write(method, path, body, ops) {
  writesInFlight++;
  function settle() {
    writesInFlight--;
    if (ops) app.pending = app.pending.filter(function (op) { return ops.indexOf(op) === -1; });
  }
  return request(method, path, body).then(function (r) {
    settle();
    if (r.json && r.json.state) noteAssetVersion(r.json.state);
    if (r.status === 401) showCodeScreen();
    var ok = r.status === 200 && r.json && r.json.ok;
    if (r.json && r.json.state) {
      app.writeEpoch++;
      // A newer state from the stream may already be shown: never put an older one back.
      if (!app.state || r.json.state.version >= app.state.version) {
        // A write response has no ETag header, so forget the old one and let the poll below fetch the
        // new one. The poll after that gets a 304.
        app.etag = r.etag || null;
        applyState(r.json.state);
      } else {
        render();
      }
      if (ok && !liveStreaming()) poll();   // an open stream brings the next state itself
    } else {
      render();
    }
    if (ok) return { ok: true, status: r.status, error: undefined, json: r.json };
    return { ok: false, status: r.status, error: r.json ? r.json.error : undefined, json: r.json };
  }, function () {
    settle();
    renderUpdateSign();
    render();
    return { ok: false, status: 0, error: undefined, json: null };
  });
}

function poll() {
  if (app.codeOpen || app.polling) return Promise.resolve();
  app.polling = true;
  var epoch = app.writeEpoch;
  return request("GET", "api/state", undefined, app.etag, POLL_TIMEOUT_MS).then(function (r) {
    if (r.status === 401) { liveStop(); showCodeScreen(); return; }
    app.pollFailed = r.status !== 200 && r.status !== 304;
    if (epoch !== app.writeEpoch) return;   // a write finished meanwhile and its state is newer
    if (r.status === 304) {
      app.fetchedAt = Date.now();
      renderAge();
      // The seen ages in an open „Kto si?“ keep growing although the state did not change.
      if (app.panel && app.panel.refresh && app.panel.ageTicks) app.panel.refresh();
    } else if (r.status === 200 && r.json && r.json.ok && r.json.state) {
      noteAssetVersion(r.json.state);
      if (!app.state || r.json.state.version >= app.state.version) {
        app.etag = r.etag;
        applyState(r.json.state);
      }
    }
  }).catch(function () {
    // Offline or a bad reply: keep what is shown and try again on the next tick.
    app.pollFailed = true;
    renderAge();
  }).then(function () {
    app.polling = false;
    if (app.pollAgain) { app.pollAgain = false; poll(); return; }
    liveEnsure();
    if (!app.state && !app.codeOpen) {
      $("bootText").textContent = "Nepodarilo sa načítať, skúšam znova…";
      $("boot").classList.add("boot--error");
      setTimeout(poll, 4000);
    }
  });
}

// --- applying state ---

function applyState(state) {
  app.state = state;
  app.fetchedAt = Date.now();
  app.pollFailed = false;   // any reply with a state (a poll or a write) shows the server is reachable
  var serverMs = state.presence ? Date.parse(state.presence.server_time) : NaN;
  if (!isNaN(serverMs)) { app.serverMs = serverMs; app.serverLocalMs = app.fetchedAt; }
  if (!app.nightSynced) {
    app.nightSynced = true;
    var remembered = app.myParty ? partyById(state, app.myParty) : null;
    if (remembered) app.night = defaultNightFor(remembered, state.event.nights);
  }
  if (app.night === null || state.event.nights.indexOf(app.night) === -1) app.night = state.event.nights[0];
  document.title = state.event.name;
  if (!app.sessionAsked) { app.sessionAsked = true; loadSession(); }
  if (app.myParty && !partyById(state, app.myParty)) {
    forgetMyParty();
    app.askWho = true;
  }
  if (app.move && !partyById(state, app.move.partyId)) app.move = null;
  if (!app.introDone) {
    revealWhenReady();
    return;
  }
  render();
  openWhoIfAsked();
  if (app.panel && app.panel.refresh) app.panel.refresh();
  if (typeof advOnState === "function") advOnState();
}

function openWhoIfAsked() {
  if (!app.askWho || splash.falling) return;      // during the fall „Kto si?“ waits; the end of the fall asks again
  app.askWho = false;
  var pending = app.loginPending && app.state ? partyById(app.state, app.loginPending) : null;
  app.loginPending = null;
  if (pending) openLogin(pending); else openWho();
}
