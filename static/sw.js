"use strict";

// Minimal service worker (T-055): it exists only so browsers offer to install the page as an app.
// It has no fetch handler and uses no cache, so it never touches the page, /api/* or the event stream.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });
