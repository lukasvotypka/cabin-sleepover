"use strict";

// App part 13: the live stream (EventSource on api/events) with the fallback to polling (T-053).
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var live = {
  supported: typeof EventSource === "function",
  es: null,
  active: false,         // between liveOpen and liveStop
  fallback: false,       // polling every POLL_MS runs
  errored: false,
  lastEventAt: 0,
  noStateSince: null,    // when the streak without a `state` event began
  attempt: 0,            // closed-stream reopen attempts since the last state
  reopenTimer: null,
  retryTimer: null
};

function liveStreaming() {
  return !!live.es && live.es.readyState === 1 && !live.fallback;
}

function liveStreamMode() {
  return live.active && !live.fallback;
}

function liveCloseSource() {
  if (live.es) { live.es.close(); live.es = null; }
  clearTimeout(live.reopenTimer);
  live.reopenTimer = null;
}

function liveStop() {
  liveCloseSource();
  live.active = false;
  live.errored = false;
  live.noStateSince = null;
  live.attempt = 0;
}

function liveOpen() {
  if (!live.supported) return;
  liveCloseSource();
  var now = Date.now();
  live.active = true;
  live.lastEventAt = now;
  if (live.noStateSince === null) live.noStateSince = now;
  var es = new EventSource(eventsUrl(app.myParty, clientId));
  live.es = es;
  es.onopen = function () { if (live.es === es) { live.errored = false; renderAge(); } };
  es.addEventListener("state", function (e) { if (live.es === es) liveOnState(e); });
  es.addEventListener("presence", function (e) { if (live.es === es) liveOnPresence(e); });
  es.addEventListener("ping", function (e) { if (live.es === es) liveOnPing(e); });
  es.onerror = function () { if (live.es === es) liveOnError(es); };
}

// Starts the stream when the page can use one (after the first state, tab visible, not in the code screen).
function liveEnsure() {
  if (!app.state || app.codeOpen || document.visibilityState !== "visible") return;
  if (live.es || live.fallback) return;
  if (!live.supported) { liveFallBack(true); return; }
  liveOpen();
}

// My party changed: the server learns who is online from the stream, so open it again with the new id.
function liveReopen() {
  if (live.es || live.reopenTimer) liveOpen();
}

function liveParse(e) {
  try { return JSON.parse(e.data); } catch (err) { return null; }
}

function liveGotEvent() {
  live.lastEventAt = Date.now();
  live.errored = false;
}

function liveOnState(e) {
  var state = liveParse(e);
  if (!state || app.codeOpen) return;
  noteAssetVersion(state);
  liveGotEvent();
  live.noStateSince = null;
  live.attempt = 0;
  if (live.fallback) liveRecovered();
  var action = stateEventAction(app.state ? app.state.version : null, state.version);
  if (action === "full") applyState(state);
  else if (action === "presence") liveApplyPresence(state.presence);
  renderAge();
}

function liveOnPresence(e) {
  var presence = liveParse(e);
  if (!presence || app.codeOpen) return;
  liveGotEvent();
  liveApplyPresence(presence);
  renderAge();
}

function liveApplyPresence(presence) {
  if (!presence || !app.state) return;
  app.state.presence = presence;
  var serverMs = Date.parse(presence.server_time);
  if (!isNaN(serverMs)) { app.serverMs = serverMs; app.serverLocalMs = Date.now(); }
  renderAge();
  if (app.panel && app.panel.refresh) app.panel.refresh();
}

function liveOnPing(e) {
  var data = liveParse(e);
  liveGotEvent();
  var serverMs = data ? Date.parse(data.server_time) : NaN;
  if (!isNaN(serverMs)) { app.serverMs = serverMs; app.serverLocalMs = Date.now(); }
  renderAge();
}

function liveOnError(es) {
  var first = !live.errored;
  live.errored = true;
  renderAge();
  if (first) poll();    // one look at the server: a 401 closes the stream and shows the code screen
  // A closed stream (the browser does not retry after a non-200 such as 429) is reopened by us, later each time.
  if (es.readyState === 2 && !live.reopenTimer) {
    live.reopenTimer = setTimeout(function () {
      live.reopenTimer = null;
      if (live.active && document.visibilityState === "visible") liveOpen();
    }, reconnectDelayMs(live.attempt++));
  }
}

function liveFallBack(skipPoll) {
  live.fallback = true;
  liveStop();
  if (live.supported && !live.retryTimer) {
    live.retryTimer = setInterval(function () {
      if (document.visibilityState === "visible" && !live.es && !app.codeOpen) liveOpen();
    }, LIVE_RETRY_MS);
  }
  if (!skipPoll) poll();
}

function liveRecovered() {
  live.fallback = false;
  clearInterval(live.retryTimer);
  live.retryTimer = null;
}

// Once a second: the 60 s without a state check.
function liveTick() {
  // A silent stream that never raised an error (half-open connection): reopen it. liveOpen resets
  // lastEventAt, so this happens at most every 45 s.
  if (live.active && !live.fallback && live.es && !live.reopenTimer &&
      document.visibilityState === "visible" && shouldReopenStale(live.lastEventAt, Date.now())) {
    liveOpen();
    return;
  }
  if (live.active && !live.fallback && shouldFallBack(live.noStateSince, Date.now())) liveFallBack();
  // A retry stream that gives no state is dropped again; polling went on all the time.
  else if (live.active && live.fallback && shouldFallBack(live.noStateSince, Date.now())) liveStop();
}

// --- the "new version" sign (T-055) ---

var assetMeta = document.querySelector('meta[name="asset-version"]');
var shownAssetVersion = assetMeta ? assetMeta.getAttribute("content") : "";
var updateSeen = false;     // once the server ran other code, the sign stays until reload
var writesInFlight = 0;     // saves that wait for the server (the sign asks to wait during them)

// Every received state payload goes through here, whether or not its data is applied.
function noteAssetVersion(state) {
  if (!state || updateSeen) { renderUpdateSign(); return; }
  if (updateSign(shownAssetVersion, state.asset_version, 0)) updateSeen = true;
  renderUpdateSign();
}

function renderUpdateSign() {
  var node = $("updateSign");
  var sign = updateSeen ? updateSign(shownAssetVersion, "changed", writesInFlight) : null;
  if (!sign || $("hud").hidden) { node.hidden = true; return; }
  node.hidden = false;
  node.textContent = sign.text;
  node.setAttribute("aria-disabled", sign.canReload ? "false" : "true");
  node.classList.toggle("wait", !sign.canReload);
}

function updateSignAction() {
  if (updateSeen && writesInFlight === 0) location.reload();
}

$("updateSign").addEventListener("click", updateSignAction);
$("updateSign").addEventListener("keydown", function (e) {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); updateSignAction(); }
});
