"use strict";

// Logic: the timing and shape of the scene sounds (a bird's chirp, the tree's rustle). Pure functions
// that take a random source `rand` (a function returning [0, 1)), so they can be tested in Node; the playing
// is in app-sound.js.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// The bird's cycle in the style sheet (`birdFly`): 28 s, of which the first 22 % is the flight across the map.
var BIRD_CYCLE_S = 28;
var BIRD_FLIGHT_S = BIRD_CYCLE_S * .22;
var BIRD_CHIRP_EDGE_S = .8;      // never right at the edges, where the bird is still off the map

// When, in seconds after the flight starts, the bird chirps: a random moment while it is over the map.
function birdChirpDelay(rand) {
  return BIRD_CHIRP_EDGE_S + rand() * (BIRD_FLIGHT_S - 2 * BIRD_CHIRP_EDGE_S);
}

// One chirp: two to four short tweets, each a quick pitch slide. `at` and `dur` in seconds, `f0` and `f1` in Hz.
function chirpNotes(rand) {
  var count = 2 + Math.floor(rand() * 3), notes = [], at = 0, i;
  var base = 2600 + rand() * 1400;
  for (i = 0; i < count; i++) {
    var dur = .06 + rand() * .07, up = rand() < .35;
    var f0 = base * (up ? .8 : 1.15) + rand() * 300, f1 = base * (up ? 1.2 : .7);
    notes.push({ at: at, dur: dur, f0: f0, f1: f1, gain: .5 + rand() * .5 });
    at += dur + .03 + rand() * .08;
  }
  return notes;
}

// The rustle of the tree when it is tapped: dry leaves scrunching against each other. Five to eight scrunches,
// each a cluster of sharp tiny crackles, over a barely audible hiss. `at` and `dur` in seconds, `freq` is the
// centre of the band-pass filter in Hz, `gain` 0 to 1.
var RUSTLE_HISS = { dur: 1.3, freq: 6000, gain: .06 };
var RUSTLE_SPAN_S = 1.1;
function rustleBursts(rand) {
  var scrunches = 5 + Math.floor(rand() * 4), bursts = [], s, k;
  for (s = 0; s < scrunches; s++) {
    var start = .02 + (s / scrunches) * RUSTLE_SPAN_S * .85 + rand() * .06;
    var loud = 1 - s / (scrunches + 2);                             // the first scrunches are the loudest
    var grains = 4 + Math.floor(rand() * 6), at = start;
    for (k = 0; k < grains; k++) {
      bursts.push({ at: at, dur: .004 + rand() * .016, freq: 1800 + rand() * 6000, gain: (.55 + rand() * .45) * loud });
      at += .006 + rand() * .03;
    }
  }
  return bursts.sort(function (a, b) { return a.at - b.at; });
}
