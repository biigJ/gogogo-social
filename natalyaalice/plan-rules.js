/* plan-rules.js — Regeln aus dem Onboarding (go_accounts.training_prefs, go-training-prefs.sql)
 *
 *   GoPlanRules.arrange(ds, prefs)   Einheiten auf Wochentage verteilen → order[wochentag 0=Mo] = Index in ds (oder null)
 *   GoPlanRules.note(ds, order, prefs)   kurzer Text zur Verteilung (fester Termin, Abstand, Verein)
 *   GoPlanRules.krafWant(prefs)     gewünschte Anzahl Kraft-Einheiten (für die Sortierung der Pläne)
 *   GoPlanRules.steps(prefs)        { now, start, target, bike } Schrittziel und Rad-Anrechnung
 *
 * Kraft: ein Tag ist der feste Termin (nicht verhandelbar). Die zweite Einheit liegt 1 bis 3 Ruhetage
 * entfernt (bevorzugt 2 Ruhetage, dann ist der Abstand in beiden Richtungen der Woche ähnlich).
 * Vereinssport: an diesen Tagen keine Kraft, dort liegt die Ausdauer-Einheit (der Vereinssport ersetzt sie).
 * Zirkel: Freitag, wenn frei. Schritte: Ziel 8.000 am Tag (Studien: Nutzen bis etwa 7.000 bis 8.000),
 * Einstieg 1.500 über dem jetzigen Stand. Rad: 1 Minute zügig ≈ 100 Schritte, höchstens die Hälfte des Ziels.
 */
(function (global) {
  "use strict";

  var DAYS_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  var KRAFT_WANT = { "1": 1, "1-2": 2, "2-3": 2.5, "3+": 3.5 };
  var STEPS_NOW = { "<4000": 3500, "4000-6000": 5000, "6000-8000": 7000, "8000+": 9000 };
  var WALK_NOW = { selten: 3500, manchmal: 5500, viel: 8000 };
  var BIKE_MIN = { nie: 0, manchmal: 10, taeglich: 25 };
  var STEP_TARGET = 8000;
  var STEPS_PER_BIKE_MIN = 100;

  function kraftWant(p) { return p && KRAFT_WANT[p.kraft] != null ? KRAFT_WANT[p.kraft] : null; }
  function round500(n) { return Math.round(n / 500) * 500; }

  function steps(p) {
    p = p || {};
    var now = STEPS_NOW[p.steps] || WALK_NOW[p.walk] || 5000;
    var start = now >= STEP_TARGET ? now : Math.min(STEP_TARGET, round500(now + 1500));
    var bike = Math.min(Math.round(STEP_TARGET / 2), (BIKE_MIN[p.bike] || 0) * STEPS_PER_BIKE_MIN);
    return { now: now, start: start, target: Math.max(STEP_TARGET, now >= STEP_TARGET ? now : STEP_TARGET), bike: bike, perMinute: STEPS_PER_BIKE_MIN };
  }

  function circ(a, b) { var d = Math.abs(a - b) % 7; return Math.min(d, 7 - d); }

  function arrange(ds, p) {
    if (!p || !ds || !ds.length || ds.length > 7) return null;
    var order = [null, null, null, null, null, null, null];
    var used = {};
    var club = {};
    ((p.club && p.club.on && p.club.days) || []).forEach(function (d) { if (d >= 0 && d < 7) club[d] = true; });
    var idx = function (cat) { return ds.map(function (s, i) { return (s.category || "kraft") === cat ? i : -1; }).filter(function (i) { return i >= 0; }); };
    var K = idx("kraft"), Z = idx("zirkel"), A = idx("ausdauer");
    function free(d) { return order[d] == null; }
    function put(d, i) { order[d] = i; used[i] = true; }
    var krafts = [];
    var anchor = p.fixed_day >= 0 && p.fixed_day < 7 ? Number(p.fixed_day) : null;
    if (anchor == null) { for (var a0 = 0; a0 < 7; a0++) if (!club[a0]) { anchor = a0; break; } }
    if (anchor == null) anchor = 0;
    if (K.length) { put(anchor, K[0]); krafts.push(anchor); }
    /* zweite Kraft: 2 Ruhetage dazwischen bevorzugt, dann 3, dann 1 (auch rückwärts) */
    if (K.length > 1) {
      var offs = [3, 4, 2, -3, -4, -2, 5, -5];
      /* Freitag bleibt für den Zirkel, solange es eine andere passende Lücke gibt */
      for (var pass = 0; pass < 2 && krafts.length < 2; pass++) {
        for (var o = 0; o < offs.length; o++) {
          var d2 = ((anchor + offs[o]) % 7 + 7) % 7;
          if (pass === 0 && Z.length && d2 === 4) continue;
          if (free(d2) && !club[d2]) { put(d2, K[1]); krafts.push(d2); break; }
        }
      }
    }
    /* weitere Kraft: möglichst weit weg von den anderen */
    K.slice(2).forEach(function (ki) {
      if (used[ki]) return;
      var best = -1, bestD = -1;
      for (var d = 0; d < 7; d++) {
        if (!free(d) || club[d]) continue;
        var m = Math.min.apply(null, krafts.map(function (k) { return circ(k, d); }));
        if (m > bestD) { bestD = m; best = d; }
      }
      if (best >= 0) { put(best, ki); krafts.push(best); }
    });
    function nearKraft(d) { return krafts.some(function (k) { return circ(k, d) <= 1; }); }
    /* Zirkel: Freitag, sonst ein freier Tag ohne Kraft daneben */
    Z.forEach(function (zi) {
      if (used[zi]) return;
      if (free(4) && !club[4]) { put(4, zi); return; }
      for (var d = 0; d < 7; d++) if (free(d) && !club[d] && !nearKraft(d)) { put(d, zi); return; }
      for (var d1 = 0; d1 < 7; d1++) if (free(d1) && !club[d1]) { put(d1, zi); return; }
    });
    /* Ausdauer: zuerst auf Vereinstage (der Vereinssport ersetzt sie), dann Tage ohne Kraft daneben */
    A.forEach(function (ai) {
      if (used[ai]) return;
      for (var c = 0; c < 7; c++) if (club[c] && free(c)) { put(c, ai); return; }
      for (var d = 0; d < 7; d++) if (free(d) && !nearKraft(d)) { put(d, ai); return; }
      for (var d1 = 0; d1 < 7; d1++) if (free(d1)) { put(d1, ai); return; }
    });
    /* Rest (Bewegung, übrige Einheiten) der Reihe nach */
    ds.forEach(function (s, i) {
      if (used[i]) return;
      for (var d = 0; d < 7; d++) if (free(d)) { put(d, i); return; }
    });
    return order;
  }

  function note(ds, order, p) {
    if (!p || !order) return "";
    var parts = [];
    var kd = [];
    order.forEach(function (i, d) { if (i != null && (ds[i].category || "kraft") === "kraft") kd.push(d); });
    var anchor = p.fixed_day >= 0 && p.fixed_day < 7 ? Number(p.fixed_day) : kd[0];
    if (kd.length && anchor != null) {
      parts.push("Fester Termin: " + DAYS_LONG[anchor] + ", nicht verhandelbar.");
      var others = kd.filter(function (d) { return d !== anchor; });
      if (others.length === 1) parts.push("Zweite Kraft-Einheit: " + DAYS_LONG[others[0]] + ". Einmal ist gut, zweimal besser.");
      else if (others.length) parts.push("Weitere Kraft-Einheiten: " + others.map(function (d) { return DAYS_LONG[d]; }).join(", ") + ".");
    }
    var club = (p.club && p.club.on && p.club.days) || [];
    if (club.length) {
      var hit = club.filter(function (d) { var i = order[d]; return i != null && ds[i].category === "ausdauer"; });
      parts.push((p.club.sport ? p.club.sport : "Vereinssport") + " am " + club.map(function (d) { return DAYS_LONG[d]; }).join(", ") +
        (hit.length ? ": zählt als Ausdauer-Einheit." : ": dort keine Kraft."));
    }
    return parts.join(" ");
  }

  global.GoPlanRules = { arrange: arrange, note: note, kraftWant: kraftWant, steps: steps, DAYS_LONG: DAYS_LONG };
})(window);
