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
// midnight of the last night passed. Replaced by nightAt/figureSwap (see below); removed with its caller.
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

// --- time slider: range 12:00 of the first day to 12:00 after the last night; a night belongs to 06:00 .. 06:00 ---

function sliderRange(nights) {
  return { min: 12, max: 12 + 24 * nights.length };
}

function clampHour(h, nights) {
  var r = sliderRange(nights);
  return Math.max(r.min, Math.min(r.max, h));
}

// The night an hour belongs to; the last night also owns the morning after it.
function nightAt(h, nights) {
  var i = Math.floor((h - 6) / 24);
  return nights[Math.max(0, Math.min(nights.length - 1, i))];
}

function hourToX(h, nights, width) {
  var r = sliderRange(nights);
  return (clampHour(h, nights) - r.min) / (r.max - r.min) * width;
}

function xToHour(x, nights, width) {
  var r = sliderRange(nights);
  return r.min + Math.max(0, Math.min(width, x)) / width * (r.max - r.min);
}

// New hour for a key on the slider, or null for a key it does not use.
function sliderKey(key, h, nights) {
  var r = sliderRange(nights), d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 6, PageDown: -6 };
  if (key === "Home") return r.min;
  if (key === "End") return r.max;
  return d[key] === undefined ? null : clampHour(h + d[key], nights);
}

// "piatok 03:00, noc Pi → So"
function sliderValueText(h, nights) {
  var q = Math.floor(h * 4) / 4, day = Math.floor(q / 24), t = q - day * 24;
  var hh = Math.floor(t), mm = Math.round((t - hh) * 60);
  var p = parseIso(addDays(nights[0], day)), info = nightInfo(nightAt(h, nights));
  return (p ? DAY_NAMES[p.dow] : "") + " " + (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm +
    ", noc " + (info ? info.label : "");
}

// Day segments of the slider scale, clipped to the range.
function sliderDays(nights) {
  var r = sliderRange(nights), out = [];
  for (var i = 0; i <= nights.length; i++) {
    out.push({ label: dayShort(addDays(nights[0], i)), from: Math.max(r.min, 24 * i), to: Math.min(r.max, 24 * (i + 1)) });
  }
  return out;
}

// Dark stretches of the scale: sunset to sunrise of each night.
function sliderDark(nights) {
  return nights.map(function (n, i) { return { from: SUNSET + 24 * i, to: SUNRISE + 24 * (i + 1) }; });
}

// Which figures stay, leave or arrive when the shown night changes; arguments are slot -> party_id maps.
function figureSwap(oldSlots, newSlots) {
  var a = oldSlots || {}, b = newSlots || {}, out = { stay: [], leave: [], arrive: [] };
  Object.keys(a).forEach(function (s) { (b[s] === a[s] ? out.stay : out.leave).push(s); });
  Object.keys(b).forEach(function (s) { if (a[s] !== b[s]) out.arrive.push(s); });
  out.stay.sort(); out.leave.sort(); out.arrive.sort();
  return out;
}
