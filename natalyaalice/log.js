/* Natalya's checklist. Shared by the page and by node tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NatalyaLog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var EXERCISES = [
    {
      id: "child",
      name: "Kindhaltung mit Strecken",
      short: "Kind",
      kind: "check",
      cue: "Po zu Fersen, Arme weit vor.",
      note: "1 Durchgang",
      group: "Aufwärmen"
    },
    {
      id: "catcow",
      name: "Katze-Kuh",
      short: "Katze",
      kind: "check",
      cue: "Rücken abwechselnd rund und hohl. Mit Ein- und Ausatmen.",
      note: "1 Durchgang",
      group: "Aufwärmen"
    },
    {
      id: "downdog",
      name: "Herabschauender Hund",
      short: "Hund",
      kind: "check",
      cue: "Po hoch, Fersen Richtung Boden. Arme durchstrecken und Oberkörper öffnen.",
      note: "1 Durchgang",
      group: "Aufwärmen"
    },
    {
      id: "wgs",
      name: "Große Ganzkörperdehnung",
      short: "Dehnung",
      kind: "check",
      cue: "Ausfallschritt, Arm zur Decke drehen.",
      note: "1 Durchgang je Seite",
      group: "Aufwärmen"
    },
    {
      id: "hang",
      name: "Hängen mit Schulterblatt-Heben",
      short: "Hängen",
      kind: "reps",
      cue: "Gestreckt hängen, Schultern runterziehen.",
      note: "3 × 5 · letzter Satz so lange wie möglich hängen",
      group: "Hauptteil"
    },
    {
      id: "split",
      name: "Bulgarische Kniebeuge",
      short: "Bulgarisch",
      kind: "reps",
      weight: true,
      step: 1,
      startKg: 6,
      cue: "Hinterer Fuß erhöht, tief beugen.",
      note: "3 × ca. 10 je Bein",
      group: "Hauptteil"
    },
    {
      id: "sldl",
      name: "Einbeiniges Kreuzheben",
      short: "Kreuzheben",
      kind: "reps",
      weight: true,
      step: 1,
      startKg: 6,
      cue: "Hüfte nach hinten, Rücken gerade.",
      note: "3 × ca. 10 je Bein",
      group: "Hauptteil"
    },
    {
      id: "slhip",
      name: "Einbeiniges Hüftheben",
      short: "Hüftheben",
      kind: "reps",
      cue: "Schultern auf Box, Po hoch. Freies Bein gestreckt.",
      note: "3 × ca. 10 je Bein",
      group: "Hauptteil"
    },
    {
      id: "lateral",
      name: "Vorgebeugtes Seitheben",
      short: "Seitheben",
      kind: "reps",
      weight: true,
      step: 1,
      startKg: 3,
      cue: "Stirn auf Stuhllehne, Arme seitlich.",
      note: "3 × ca. 10",
      group: "Hauptteil"
    },
    {
      id: "press",
      name: "Schulterdrücken im Sitz",
      short: "Schulter",
      kind: "reps",
      weight: true,
      step: 1,
      startKg: 3,
      cue: "Vorne auf Stuhlkante, Bauch fest.",
      note: "3 × ca. 15",
      group: "Hauptteil"
    },
    {
      id: "pushup",
      name: "Liegestütze auf Knien",
      short: "Liegestütz",
      kind: "reps",
      cue: "Körper gerade von Knie bis Kopf.",
      note: "5 × ca. 5",
      group: "Hauptteil"
    },
    {
      id: "crunch",
      name: "Umgekehrte Crunches",
      short: "Crunches",
      kind: "reps",
      cue: "Rückenlage, Hände hinten abstützen. Bein strecken, dann Knie Richtung Brust ziehen.",
      note: "2 × ca. 15",
      group: "Hauptteil"
    }
  ];

  var GROUP_HINTS = {
    "Aufwärmen": "Jede Übung ca. 10–20 Sekunden, ruhig atmen."
  };

  function exerciseById(id) {
    for (var i = 0; i < EXERCISES.length; i++) {
      if (EXERCISES[i].id === id) return EXERCISES[i];
    }
    return null;
  }

  function roundKg(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function parseReps(value) {
    var s = String(value == null ? "" : value).trim();
    if (!/^\d+$/.test(s)) return null;
    var n = parseInt(s, 10);
    if (!isFinite(n) || n < 0 || n > 999) return null;
    return n;
  }

  function parseKg(value) {
    var s = String(value == null ? "" : value).trim().replace(",", ".");
    if (!s) return null;
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = roundKg(s);
    if (!isFinite(n) || n < 0 || n > 999) return null;
    return n;
  }

  function addKg(current, delta) {
    var base = current == null || current === "" ? 0 : Number(current);
    if (!isFinite(base)) base = 0;
    var next = roundKg(base + Number(delta));
    if (next < 0) next = 0;
    if (next > 999) next = 999;
    return next;
  }

  function formatNumber(n) {
    if (n == null || n === "") return "";
    var v = roundKg(n);
    if (!isFinite(v)) return "";
    var s = String(v);
    return s.indexOf(".") === -1 ? s : s.replace(".", ",");
  }

  function formatKg(n) {
    var s = formatNumber(n);
    return s ? s + " kg" : "";
  }

  function formatDate(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return String(iso || "");
    return p[2] + "." + p[1] + "." + p[0].slice(2);
  }

  function berlinToday() {
    try {
      return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function numberOrNull(value) {
    if (value == null || value === "") return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function lastLoggedKg(logs, exerciseId, date) {
    var best = null;
    (logs || []).forEach(function (row) {
      if (!row || row.exercise_id !== exerciseId) return;
      if (row.workout_date >= date) return;
      var kg = numberOrNull(row.weight_kg);
      if (kg == null) return;
      if (!best || row.workout_date > best.workout_date) best = row;
    });
    return best ? numberOrNull(best.weight_kg) : null;
  }

  function suggestionKg(logs, exerciseId, date) {
    var last = lastLoggedKg(logs, exerciseId, date);
    if (last != null) return last;
    var ex = exerciseById(exerciseId);
    return ex && ex.startKg != null ? Number(ex.startKg) : null;
  }

  function weightSource(logs, exerciseId, date) {
    if (lastLoggedKg(logs, exerciseId, date) != null) return "last";
    var ex = exerciseById(exerciseId);
    if (ex && ex.startKg != null) return "plan";
    return "";
  }

  function groupHint(group) {
    return GROUP_HINTS[group] || "";
  }

  function payloadFromDraft(ex, draft, suggestion) {
    if (!ex || !draft) return null;
    if (ex.kind === "check") {
      return draft.done ? { reps: null, weight_kg: null, done: true } : null;
    }
    var reps = parseReps(draft.reps);
    var kg = null;
    if (ex.weight) {
      if (draft.kgTouched) kg = draft.kg == null ? null : roundKg(draft.kg);
      else if (reps != null && suggestion != null) kg = roundKg(suggestion);
    }
    if (reps == null && kg == null) return null;
    return { reps: reps, weight_kg: kg, done: true };
  }

  function projectLogs(logs, date, drafts) {
    var next = (logs || []).filter(function (row) {
      return row.workout_date !== date;
    });
    EXERCISES.forEach(function (ex) {
      var draft = drafts && drafts[ex.id];
      if (!draft) return;
      var body = payloadFromDraft(ex, draft, suggestionKg(logs, ex.id, date));
      if (!body) return;
      next.push({
        workout_date: date,
        exercise_id: ex.id,
        reps: body.reps,
        weight_kg: body.weight_kg,
        done: body.done
      });
    });
    return next;
  }

  function historyDates(logs) {
    var seen = {};
    (logs || []).forEach(function (row) {
      if (row && row.workout_date) seen[row.workout_date] = true;
    });
    return Object.keys(seen).sort().reverse();
  }

  function rowOn(logs, date, exerciseId) {
    var found = null;
    (logs || []).forEach(function (row) {
      if (row.workout_date === date && row.exercise_id === exerciseId) found = row;
    });
    return found;
  }

  function statsFor(logs, ex) {
    var reps = [];
    var weights = [];
    var bestKg = null;
    var bestKgReps = null;
    var checks = 0;
    (logs || []).forEach(function (row) {
      if (!row || row.exercise_id !== ex.id) return;
      var r = numberOrNull(row.reps);
      var kg = numberOrNull(row.weight_kg);
      if (r != null) reps.push(r);
      if (kg != null) {
        weights.push(kg);
        var repsScore = r == null ? -1 : r;
        var bestScore = bestKgReps == null ? -1 : bestKgReps;
        if (bestKg == null || kg > bestKg + 0.001 || (Math.abs(kg - bestKg) < 0.001 && repsScore > bestScore)) {
          bestKg = kg;
          bestKgReps = r;
        }
      }
      if (row.done) checks += 1;
    });
    function avg(list) {
      if (!list.length) return null;
      var sum = 0;
      list.forEach(function (n) { sum += n; });
      return roundKg(sum / list.length);
    }
    var bestReps = reps.length ? Math.max.apply(null, reps) : null;
    return {
      sessions: Math.max(reps.length, weights.length, ex.kind === "check" ? checks : 0),
      avgReps: avg(reps),
      bestReps: bestReps,
      avgKg: avg(weights),
      bestKg: bestKg,
      bestKgReps: bestKg == null ? null : bestKgReps,
      checks: checks
    };
  }

  function cellText(ex, row) {
    if (!row) return "–";
    if (ex.kind === "check") return row.done ? "✓" : "–";
    var reps = numberOrNull(row.reps);
    var kg = numberOrNull(row.weight_kg);
    if (ex.weight && kg != null && reps != null) return String(reps) + " × " + formatNumber(kg);
    if (ex.weight && kg != null) return formatKg(kg);
    if (reps != null) return String(reps);
    return "–";
  }

  function avgText(ex, stats, logs) {
    if (!stats || !stats.sessions) return "–";
    if (ex.kind === "check") {
      var dates = historyDates(logs);
      if (!dates.length) return "–";
      return Math.round((stats.checks / dates.length) * 100) + " %";
    }
    if (ex.weight && stats.avgKg != null) return formatKg(stats.avgKg);
    if (stats.avgReps != null) return formatNumber(stats.avgReps);
    return "–";
  }

  function bestText(ex, stats) {
    if (!stats || !stats.sessions || ex.kind === "check") return "–";
    if (ex.weight && stats.bestKg != null) {
      return stats.bestKgReps != null
        ? String(stats.bestKgReps) + " × " + formatNumber(stats.bestKg)
        : formatKg(stats.bestKg);
    }
    if (stats.bestReps != null) return String(stats.bestReps);
    return "–";
  }

  function statLine(ex, stats) {
    if (!stats || !stats.sessions) return "";
    if (ex.kind === "check") return stats.checks + "× erledigt";
    var parts = [];
    if (ex.weight && stats.bestKg != null) {
      var best = "Best " + formatKg(stats.bestKg);
      if (stats.bestKgReps != null) best += " × " + stats.bestKgReps;
      parts.push(best);
    } else if (stats.bestReps != null) {
      parts.push("Best " + stats.bestReps);
    }
    if (ex.weight && stats.avgKg != null) parts.push("Ø " + formatKg(stats.avgKg));
    if (stats.avgReps != null) parts.push("Ø " + formatNumber(stats.avgReps) + " Wdh");
    return parts.join(" · ");
  }

  function draftFromLogs(logs, date) {
    var draft = {};
    EXERCISES.forEach(function (ex) {
      var row = rowOn(logs, date, ex.id);
      draft[ex.id] = {
        reps: row && row.reps != null && row.reps !== "" ? String(parseInt(row.reps, 10)) : "",
        kg: row && numberOrNull(row.weight_kg) != null ? numberOrNull(row.weight_kg) : null,
        kgTouched: !!(row && numberOrNull(row.weight_kg) != null),
        done: !!(row && row.done)
      };
    });
    return draft;
  }

  function doneCount(logs, date) {
    var n = 0;
    EXERCISES.forEach(function (ex) {
      if (rowOn(logs, date, ex.id)) n += 1;
    });
    return n;
  }

  return {
    EXERCISES: EXERCISES,
    exerciseById: exerciseById,
    parseReps: parseReps,
    parseKg: parseKg,
    addKg: addKg,
    formatNumber: formatNumber,
    formatKg: formatKg,
    formatDate: formatDate,
    berlinToday: berlinToday,
    suggestionKg: suggestionKg,
    weightSource: weightSource,
    groupHint: groupHint,
    payloadFromDraft: payloadFromDraft,
    projectLogs: projectLogs,
    historyDates: historyDates,
    rowOn: rowOn,
    statsFor: statsFor,
    cellText: cellText,
    avgText: avgText,
    bestText: bestText,
    statLine: statLine,
    draftFromLogs: draftFromLogs,
    doneCount: doneCount
  };
});
