"use strict";

// Pure logic of the live stream (T-053): which events to take, when the stream counts as a problem,
// when to fall back to polling. No DOM, no clock: the callers pass the times.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var LIVE_STALE_MS = 45000;        // no event for longer than this is a problem (pings come every 20 s)
var LIVE_NO_STATE_MS = 60000;     // no `state` event this long after opening: fall back to polling
var LIVE_RETRY_MS = 180000;       // in fallback the stream is tried again this often
// A hidden tab keeps its stream this long before closing it (organizer's decision of 25. 10. 2026): a browser
// covered by another one or a quick switch to another app does not drop the party from „online“ at once.
var LIVE_HIDDEN_GRACE_MS = 10000;
var LIVE_RECONNECT_BASE_MS = 3000;
var LIVE_RECONNECT_MAX_MS = 30000;

// What to do with a `state` event: "full" (higher version), "presence" (same version) or "ignore" (older).
function stateEventAction(shownVersion, incomingVersion) {
  if (typeof incomingVersion !== "number") return "ignore";
  if (typeof shownVersion !== "number" || incomingVersion > shownVersion) return "full";
  return incomingVersion === shownVersion ? "presence" : "ignore";
}

// The text that replaces the online row, or null when all is well. Stream mode (o.stream): an error or no event
// (state, presence, ping) for more than 45 s. Otherwise the polling rule of `crestAgeText`.
function liveProblemText(o) {
  if (!o.stream) return crestAgeText(o);
  if (o.errored || o.nowMs - o.lastEventMs > LIVE_STALE_MS) {
    return updatedAgoText(Math.max(o.lastEventMs, o.fetchedAtMs || 0), o.nowMs);
  }
  return null;
}

// True when the stream has been open without a `state` for 60 s (a proxy that buffers, a server that does not stream).
// `noStateSinceMs` is when the current streak without a state began, or null.
function shouldFallBack(noStateSinceMs, nowMs) {
  return noStateSinceMs !== null && nowMs - noStateSinceMs >= LIVE_NO_STATE_MS;
}

// True when an open stream has been silent for more than 45 s (pings come every 20 s): a half-open connection
// that raises no `error`, so the page reopens it.
function shouldReopenStale(lastEventMs, nowMs) {
  return nowMs - lastEventMs > LIVE_STALE_MS;
}

// Delay before reopening a closed stream: 3 s, 6 s, 12 s, 24 s, then 30 s.
function reconnectDelayMs(attempt) {
  return Math.min(LIVE_RECONNECT_MAX_MS, LIVE_RECONNECT_BASE_MS * Math.pow(2, Math.max(0, attempt)));
}

// Relative URL of the stream. EventSource cannot set headers, so the ids go in the query.
function eventsUrl(partyId, clientId) {
  var url = "api/events?";
  if (partyId) url += "party=" + encodeURIComponent(partyId) + "&";
  return url + "client=" + encodeURIComponent(clientId);
}
