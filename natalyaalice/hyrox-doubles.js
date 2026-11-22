/* hyrox-doubles.js — Punkte und Stationen der HYROX Doubles eines Circles (Leaderboard Double, Aufzeichnungen, Admin)
 *
 *   GoHyroxDoubles.plan(row)    Stationen des Termins in Ablauf-Reihenfolge, mit Wert (oder null) und Punkten
 *   GoHyroxDoubles.score(row)   Summe der Punkte über die Stationen mit Wert
 *   GoHyroxDoubles.valueText(s) „23 Runden = 575 m“, „1.630 m“, „155 Wdh“
 *
 * Gespeichert wird immer das Ergebnis (Meter, Wiederholungen). Wo am Termin Runden gezählt wurden
 * (Farmers Carry 25 m, Lunges 4,5 m je Runde), rechnet die Voreinstellung Runden in Meter um.
 *
 * Punkte wie in FFC (ffc.js roundPoints): 100 = Tempo der HYROX-Elite, hier für ein Double-Team in 6 Minuten.
 *   Referenz = Stationslänge × (Arbeitszeit / Elite-Zeit)^0,943 (Riegel) × Double-Faktor, gedeckelt bei 150.
 *   Double-Faktor 1,2: Doubles-Weltrekorde sind bei gleicher Laufstrecke rund 4 bis 8 % schneller als Einzel,
 *   auf die Stationen gerechnet etwa 20 % mehr Leistung je Zeit (Annahme, siehe PR).
 *   Kategorie: Männer = Männer-Referenz, Frauen = Frauen-Referenz, Mix = Mittel aus beiden.
 *   Assault Bike ist keine HYROX-Station: Referenz aus dem Fan-Bike-Stundenweltrekord (44,28 km), ohne Double-Faktor.
 *   Burpee Box Jumps ist keine HYROX-Station: Annahme Elite 15 Wdh/min (Männer), 12,5 Wdh/min (Frauen).
 * Stelle im Ablauf: Wer eine Station später macht, ist schon müde. Je Minute vorher Arbeit + Pause gibt es
 *   +0,35 % (nach 42 Minuten also +15 %). Nur wenn die Reihenfolge des Teams bekannt ist (station_order).
 */
(function (global) {
  "use strict";

  var EXP = 0.943;
  var MAX = 150;
  var DOUBLE = 1.2;
  var FATIGUE_PER_MIN = 0.0035;
  /* dist = Stationslänge, m/f = Elite-Zeit in Sekunden (wie ffc.js POINT_REFS) */
  var REFS = {
    row: { label: "Rudern", unit: "m", dist: 1000, m: 238, f: 269 },
    skierg: { label: "Ski", unit: "m", dist: 1000, m: 227, f: 252 },
    sledpush: { label: "Schlitten Push", unit: "m", dist: 50, m: 165, f: 180 },
    sledhybrid: { label: "Schlitten Hybrid", unit: "m", dist: 50, m: 180, f: 207 },
    farmers: { label: "Farmers Carry", unit: "m", dist: 200, m: 97, f: 117, per: 25 },
    wallballs: { label: "Wall Balls", unit: "Wdh", dist: 100, m: 265, f: 230 },
    lunges: { label: "Sandbag Lunges", unit: "m", dist: 100, m: 183, f: 215, per: 4.5 },
    burpee: { label: "Burpee Broad Jumps", unit: "m", dist: 80, m: 141, f: 191 },
    burpeebox: { label: "Burpee Box Jumps", unit: "Wdh", dist: 100, m: 400, f: 480 },
    /* Fan Bike: Weltrekord 1 h 44,28 km (Männer); Frauen 10 % langsamer angenommen */
    bike_m: { label: "Assault Bike", unit: "m", dist: 44280, m: 3600, f: 4000, noDouble: true }
  };
  var ORDER = ["row", "sledpush", "sledhybrid", "bike_m", "skierg", "farmers", "wallballs", "lunges", "burpee", "burpeebox"];
  /* Voreinstellung je Termin: Stationen in der Reihenfolge an der Tafel */
  var EVENTS = {
    "2026-11-08": ["row", "sledhybrid", "skierg", "farmers", "wallballs", "lunges", "burpeebox"],
    "2026-11-17": ["row", "sledpush", "bike_m", "skierg", "farmers", "wallballs", "lunges"]
  };

  function eliteSec(ref, cat) {
    if (cat === "Frauen") return ref.f;
    if (cat === "Männer") return ref.m;
    return (ref.m + ref.f) / 2;
  }
  function stationPoints(key, value, cat, workSec, pos, restSec) {
    var ref = REFS[key];
    var v = Number(value);
    if (!ref || !(v > 0)) return null;
    var amount = ref.dist * Math.pow(workSec / eliteSec(ref, cat), EXP) * (ref.noDouble ? 1 : DOUBLE);
    var p = Math.min(MAX, 100 * v / amount);
    if (pos != null && pos > 0) p *= 1 + FATIGUE_PER_MIN * pos * (workSec + restSec) / 60;
    return Math.round(p);
  }
  function keysOf(row) {
    var res = row.results || {};
    var preset = EVENTS[row.day];
    if (preset) return preset.concat(ORDER.filter(function (k) { return res[k] != null && preset.indexOf(k) < 0; }));
    return ORDER.filter(function (k) { return res[k] != null; });
  }
  function plan(row) {
    var res = row.results || {};
    var work = Number(row.work_sec) || 360, rest = Number(row.rest_sec) || 60;
    var order = row.station_order || null;
    return keysOf(row).map(function (k) {
      var ref = REFS[k];
      var v = res[k] != null ? Number(res[k]) : null;
      var pos = order ? order.indexOf(k) : -1;
      return {
        key: k, label: ref.label, unit: ref.unit, per: ref.per || null, value: v,
        rounds: v != null && ref.per ? Math.round(v / ref.per * 10) / 10 : null,
        points: v != null ? stationPoints(k, v, row.category, work, pos >= 0 ? pos : null, rest) : null
      };
    });
  }
  function score(row) {
    var out = { total: 0, n: 0, stations: [] };
    plan(row).forEach(function (s) {
      if (s.value == null) return;
      out.stations.push(s);
      if (s.points != null) { out.total += s.points; out.n += 1; }
    });
    return out;
  }
  function num(n) { return Number(n).toLocaleString("de-DE", { maximumFractionDigits: 1 }); }
  function valueText(s) {
    if (s.value == null) return "–";
    if (s.per) return num(s.rounds) + (s.rounds === 1 ? " Runde" : " Runden") + " = " + num(s.value) + " " + s.unit;
    return num(s.value) + " " + s.unit;
  }
  global.GoHyroxDoubles = { plan: plan, score: score, valueText: valueText, REFS: REFS, EVENTS: EVENTS };
})(window);
