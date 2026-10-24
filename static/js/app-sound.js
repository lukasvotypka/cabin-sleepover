"use strict";

// App part 11b: the scene sounds (organizer request, 24. 10. 2026). The bird chirps once at a random moment of
// each flight, and a tap on the tree rustles its leaves in a gust of wind. Synthesized with Web Audio, so there
// are no sound files. Browsers allow sound only after the first touch, click or key, so the audio starts then;
// before that the bird is silent. With `prefers-reduced-motion` the bird is hidden and never chirps.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var SOUND_VOLUME = .12;

function soundContext() {
  if (app.audio) return app.audio;
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { app.audio = new Ctx(); } catch (err) { return null; }
  app.audioOut = app.audio.createGain();
  app.audioOut.gain.value = SOUND_VOLUME;
  app.audioOut.connect(app.audio.destination);
  return app.audio;
}

// Called from a touch, click or key: creates or wakes the audio (iOS Safari allows that only inside a gesture).
function unlockSound() {
  var ctx = soundContext();
  if (ctx && ctx.state === "suspended") ctx.resume();
}
["pointerdown", "touchend", "keydown"].forEach(function (type) {
  document.addEventListener(type, unlockSound, { capture: true, passive: true });
});

// The audio when it may play now: unlocked, running and the tab in front.
function liveSound() {
  var ctx = app.audio;
  return ctx && ctx.state === "running" && document.visibilityState === "visible" ? ctx : null;
}

function noiseBuffer(ctx) {
  if (app.noise) return app.noise;
  var length = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, length, ctx.sampleRate);
  var data = buf.getChannelData(0), i;
  for (i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  app.noise = buf;
  return buf;
}

// A gain node that swells in over `attack` s, then fades out by `at + dur`.
function envelope(ctx, at, dur, gain, attack) {
  var g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(.001, at + dur);
  g.connect(app.audioOut);
  return g;
}

function playChirp() {
  var ctx = liveSound();
  if (!ctx) return;
  var t0 = ctx.currentTime + .02;
  chirpNotes(Math.random).forEach(function (n) {
    var osc = ctx.createOscillator(), at = t0 + n.at;
    osc.type = "sine";
    osc.frequency.setValueAtTime(n.f0, at);
    osc.frequency.exponentialRampToValueAtTime(n.f1, at + n.dur);
    osc.connect(envelope(ctx, at, n.dur, n.gain * .6, .01));
    osc.start(at);
    osc.stop(at + n.dur + .02);
  });
}

// A burst of noise through a band-pass filter at `freq`.
function playNoise(ctx, at, dur, freq, q, gain, attack) {
  var src = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
  src.buffer = noiseBuffer(ctx);
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  src.connect(filter);
  filter.connect(envelope(ctx, at, dur, gain, attack));
  src.start(at, Math.random());
  src.stop(at + dur + .02);
}

function playRustle() {
  var ctx = liveSound();
  if (!ctx) return;
  var t0 = ctx.currentTime + .02;
  playNoise(ctx, t0, RUSTLE_GUST.dur, RUSTLE_GUST.freq, .6, RUSTLE_GUST.gain, RUSTLE_GUST.dur * .35);
  rustleBursts(Math.random).forEach(function (b) {
    playNoise(ctx, t0 + b.at, b.dur, b.freq, .9, b.gain, .02);
  });
}

// The bird's `birdFly` animation starts a flight on its start and on every repeat: one chirp somewhere in it.
// The flap animations of its frames bubble up here too and are ignored.
function onBirdFlight(e) {
  if (e.animationName !== "birdFly") return;
  clearTimeout(app.chirpTimer);
  app.chirpTimer = setTimeout(playChirp, birdChirpDelay(Math.random) * 1000);
}

// A tap on the tree: the crown sways and the leaves rustle.
function rustleTree(tree) {
  unlockSound();
  playRustle();
  tree.classList.remove("rustle");
  void tree.getBBox();      // restart the sway when tapped again during it
  tree.classList.add("rustle");
  clearTimeout(app.rustleTimer);
  app.rustleTimer = setTimeout(function () { tree.classList.remove("rustle"); }, 700);
}
