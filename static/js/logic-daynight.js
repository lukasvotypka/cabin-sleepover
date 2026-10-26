// Day and night time-lapse when switching nights: pure functions only (light by hour, clock label, duration, easing).
// Hours are counted from 00:00 of the first night's start day.

// Sun at the cabin around 30. 10. 2026: sunrise ~6:40, sunset ~16:40.
var SUNRISE = 6 + 40 / 60, SUNSET = 16 + 40 / 60, TWILIGHT = 1.2;

// Noon of the day a night starts on, in hours since the first night's 00:00 (null for an unknown night).
function noonOf(night, nights) {
  var i = (nights || []).indexOf(night);
  return i < 0 ? null : i * 24 + 12;
}

function smooth(x) {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
}

// 0 = full day, 1 = deep night.
function darkness(h) {
  var t = ((h % 24) + 24) % 24;
  if (t < 12) return 1 - smooth((t - (SUNRISE - TWILIGHT / 2)) / TWILIGHT);
  return smooth((t - (SUNSET - TWILIGHT / 2)) / TWILIGHT);
}

// Orange glow around sunrise and sunset: 1 at both, 0 an hour or so away.
function dusk(h) {
  var t = ((h % 24) + 24) % 24;
  return Math.max(0, 1 - Math.min(Math.abs(t - SUNRISE), Math.abs(t - SUNSET)) / 1.1);
}

// "Št 12:00", rounded down to 15 minutes; the day comes from the dates of the nights.
function clockLabel(h, nights) {
  var q = Math.floor(h * 4) / 4, day = Math.floor(q / 24), t = q - day * 24;
  var hh = Math.floor(t), mm = Math.round((t - hh) * 60);
  var first = nights && nights[0];
  return (first ? dayShort(addDays(first, day)) : "") + " " + (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
}

function durationMs(fromH, toH) {
  return 900 + 1250 * Math.abs(toH - fromH) / 24;
}

// Ease-in-out cubic.
function ease(x) {
  return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// The hour at which the figures swap to the new night's places: at once for a short trip, otherwise at the
// midnight of the last night passed.
function swapHour(fromH, toH) {
  if (Math.abs(toH - fromH) < 12) return fromH;
  return toH > fromH ? toH - 12 : toH + 12;
}

// Opacities the app sets per frame.
function lightAt(h) {
  var d = darkness(h), k = dusk(h);
  return {
    dark: d * .78,
    dusk: k * .55 * (1 - d * .5),
    lamp: smooth((d - .25) / .5),
    fireflies: smooth((d - .6) / .4),
    bird: 1 - smooth(d / .6)
  };
}
