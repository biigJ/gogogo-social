/* Checklist engine for a copied training plan. Exercises come from the athlete row. */
(function (root, factory) {
  function create(exercises, athleteName) {
    return factory(exercises, athleteName);
  }
  var api = { create: create };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PlanLog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (EXERCISES, ATHLETE_NAME) {
  EXERCISES = normalizeExercises(EXERCISES);
  ATHLETE_NAME = ATHLETE_NAME || "";
  function normalizeExercises(list) {
    var used = {};
    return (Array.isArray(list) ? list : []).map(function (ex, index) {
      var kind = ex && ex.kind === "check" ? "check" : "reps";
      var name = String((ex && ex.name) || "Übung").trim() || "Übung";
      var id = String((ex && ex.id) || ("ex" + (index + 1))).trim() || ("ex" + (index + 1));
      if (used[id]) id = id + "-" + (index + 1);
      used[id] = true;
      var item = {
        id: id,
        name: name,
        short: String((ex && ex.short) || name).trim().slice(0, 18) || name.slice(0, 18),
        kind: kind,
        cue: String((ex && ex.cue) || ""),
        note: String((ex && ex.note) || ""),
        group: String((ex && ex.group) || "Hauptteil")
      };
      if (kind === "reps") {
        var sets = parseInt(ex && ex.sets, 10);
        item.sets = sets > 0 ? Math.min(sets, 12) : 1;
        if (ex && ex.weight) {
          item.weight = true;
          var step = Number(ex.step);
          item.step = step > 0 ? step : 1;
          if (ex.startKg != null && ex.startKg !== "" && isFinite(Number(ex.startKg))) item.startKg = Number(ex.startKg);
        }
      }
      return item;
    });
  }
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

  function baseId(exerciseId) {
    var id = String(exerciseId || "");
    var hash = id.lastIndexOf("#");
    return hash === -1 ? id : id.slice(0, hash);
  }

  function setIndex(exerciseId) {
    var id = String(exerciseId || "");
    var hash = id.lastIndexOf("#");
    if (hash === -1) return 0;
    var n = parseInt(id.slice(hash + 1), 10);
    return n > 0 ? n - 1 : 0;
  }

  function setCount(ex) {
    if (!ex || ex.kind !== "reps") return 1;
    var n = parseInt(ex.sets, 10);
    return n > 0 ? n : 1;
  }

  function storageId(ex, index) {
    return index === 0 ? ex.id : ex.id + "#" + (index + 1);
  }

  function blankSet() {
    return { reps: "", kg: null, kgTouched: false, done: false };
  }

  function visibleSetCount(ex, sets) {
    var max = setCount(ex);
    var n = 1;
    var list = sets || [];
    for (var i = 0; i < max - 1; i++) {
      if (!list[i] || !list[i].done) break;
      n += 1;
    }
    return n;
  }

  function lastLoggedKg(logs, exerciseId, date) {
    var base = baseId(exerciseId);
    var bestDate = null;
    var bestIndex = -1;
    var bestKg = null;
    (logs || []).forEach(function (row) {
      if (!row || baseId(row.exercise_id) !== base) return;
      if (row.workout_date >= date) return;
      var kg = numberOrNull(row.weight_kg);
      if (kg == null) return;
      var idx = setIndex(row.exercise_id);
      if (bestDate == null || row.workout_date > bestDate || (row.workout_date === bestDate && idx >= bestIndex)) {
        bestDate = row.workout_date;
        bestIndex = idx;
        bestKg = kg;
      }
    });
    return bestKg;
  }

  function suggestionKg(logs, exerciseId, date) {
    var last = lastLoggedKg(logs, exerciseId, date);
    if (last != null) return last;
    var ex = exerciseById(baseId(exerciseId));
    return ex && ex.startKg != null ? Number(ex.startKg) : null;
  }

  function weightSource(logs, exerciseId, date) {
    if (lastLoggedKg(logs, exerciseId, date) != null) return "last";
    var ex = exerciseById(baseId(exerciseId));
    if (ex && ex.startKg != null) return "plan";
    return "";
  }

  function displayKg(ex, sets, index, historyKg) {
    var list = sets || [];
    var set = list[index];
    if (set && set.kgTouched) return set.kg;
    for (var i = index - 1; i >= 0; i--) {
      if (list[i] && list[i].kg != null) return list[i].kg;
    }
    return historyKg == null ? null : historyKg;
  }

  function groupHint(group) {
    return GROUP_HINTS[group] || "";
  }

  function payloadForSet(ex, set, suggestion) {
    if (!ex || !set) return null;
    var reps = parseReps(set.reps);
    var kg = null;
    if (ex.weight) {
      if (set.kgTouched) kg = set.kg == null ? null : roundKg(set.kg);
      else if ((reps != null || set.done) && suggestion != null) kg = roundKg(suggestion);
    }
    if (!set.done && reps == null && kg == null) return null;
    return { reps: reps, weight_kg: kg, done: !!set.done };
  }

  function payloadFromDraft(ex, draft, suggestion) {
    if (!ex || !draft) return null;
    if (ex.kind === "check") {
      return draft.done ? { reps: null, weight_kg: null, done: true } : null;
    }
    return payloadForSet(ex, (draft.sets || [])[0], suggestion);
  }

  function payloadsFor(ex, draft, logs, date) {
    if (!ex || !draft) return [];
    if (ex.kind === "check") {
      return [{ storageId: ex.id, body: payloadFromDraft(ex, draft, null) }];
    }
    var history = suggestionKg(logs, ex.id, date);
    var out = [];
    var max = setCount(ex);
    for (var i = 0; i < max; i++) {
      var set = (draft.sets || [])[i] || blankSet();
      out.push({
        storageId: storageId(ex, i),
        body: payloadForSet(ex, set, displayKg(ex, draft.sets, i, history))
      });
    }
    return out;
  }

  function projectLogs(logs, date, drafts) {
    var next = (logs || []).filter(function (row) {
      return row.workout_date !== date;
    });
    EXERCISES.forEach(function (ex) {
      var draft = drafts && drafts[ex.id];
      if (!draft) return;
      payloadsFor(ex, draft, logs, date).forEach(function (plan) {
        if (!plan.body) return;
        next.push({
          workout_date: date,
          exercise_id: plan.storageId,
          reps: plan.body.reps,
          weight_kg: plan.body.weight_kg,
          done: plan.body.done
        });
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
      if (!row || baseId(row.exercise_id) !== ex.id) return;
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

  function setText(ex, row) {
    if (!row) return "";
    var reps = numberOrNull(row.reps);
    var kg = numberOrNull(row.weight_kg);
    if (ex.weight && kg != null && reps != null) return String(reps) + "×" + formatNumber(kg);
    if (ex.weight && kg != null) return formatKg(kg);
    if (reps != null) return String(reps);
    if (row.done) return "✓";
    return "";
  }

  function rowsFor(logs, date, ex) {
    var found = [];
    (logs || []).forEach(function (row) {
      if (row && row.workout_date === date && baseId(row.exercise_id) === ex.id) found.push(row);
    });
    found.sort(function (a, b) { return setIndex(a.exercise_id) - setIndex(b.exercise_id); });
    return found;
  }

  function cellText(ex, rows) {
    var list = !rows ? [] : (Array.isArray(rows) ? rows : [rows]);
    if (ex.kind === "check") return list[0] && list[0].done ? "✓" : "–";
    var parts = [];
    list.forEach(function (row) {
      var text = setText(ex, row);
      if (text) parts.push(text);
    });
    return parts.length ? parts.join(" · ") : "–";
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
      if (ex.kind === "check") {
        var row = rowOn(logs, date, ex.id);
        draft[ex.id] = { done: !!(row && row.done), sets: [] };
        return;
      }
      var sets = [];
      var max = setCount(ex);
      for (var i = 0; i < max; i++) {
        var setRow = rowOn(logs, date, storageId(ex, i));
        sets.push({
          reps: setRow && setRow.reps != null && setRow.reps !== "" ? String(parseInt(setRow.reps, 10)) : "",
          kg: setRow && numberOrNull(setRow.weight_kg) != null ? numberOrNull(setRow.weight_kg) : null,
          kgTouched: !!(setRow && numberOrNull(setRow.weight_kg) != null),
          done: !!(setRow && setRow.done)
        });
      }
      draft[ex.id] = { done: false, sets: sets };
    });
    return draft;
  }

  function exerciseComplete(logs, date, ex) {
    if (ex.kind === "check") {
      var row = rowOn(logs, date, ex.id);
      return !!(row && row.done);
    }
    var max = setCount(ex);
    for (var i = 0; i < max; i++) {
      var setRow = rowOn(logs, date, storageId(ex, i));
      if (!setRow || !setRow.done) return false;
    }
    return true;
  }

  function summaryText(logs, date) {
    var lines = [ATHLETE_NAME || "Training", formatDate(date), ""];
    EXERCISES.forEach(function (ex) {
      if (ex.group !== "Hauptteil") return;
      var rows = rowsFor(logs, date, ex);
      var parts = [];
      rows.forEach(function (row) {
        var reps = numberOrNull(row.reps);
        var kg = numberOrNull(row.weight_kg);
        if (reps == null && kg == null && !row.done) return;
        var bit = "Satz " + (setIndex(row.exercise_id) + 1);
        if (reps != null) bit += ": " + reps + " Wdh";
        else bit += ": erledigt";
        if (kg != null) bit += ", " + formatNumber(kg) + " kg";
        parts.push(bit);
      });
      if (!parts.length) return;
      lines.push(ex.name);
      parts.forEach(function (part) { lines.push(part); });
      lines.push("");
    });
    return lines.join("\n").replace(/\n+$/, "") + "\n";
  }

  function doneCount(logs, date) {
    var n = 0;
    EXERCISES.forEach(function (ex) {
      if (ex.kind === "check") {
        if (exerciseComplete(logs, date, ex)) n += 1;
        return;
      }
      if (rowsFor(logs, date, ex).length) n += 1;
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
    setCount: setCount,
    storageId: storageId,
    visibleSetCount: visibleSetCount,
    displayKg: displayKg,
    suggestionKg: suggestionKg,
    weightSource: weightSource,
    groupHint: groupHint,
    payloadFromDraft: payloadFromDraft,
    payloadsFor: payloadsFor,
    rowsFor: rowsFor,
    exerciseComplete: exerciseComplete,
    projectLogs: projectLogs,
    historyDates: historyDates,
    rowOn: rowOn,
    statsFor: statsFor,
    cellText: cellText,
    summaryText: summaryText,
    avgText: avgText,
    bestText: bestText,
    statLine: statLine,
    draftFromLogs: draftFromLogs,
    doneCount: doneCount
  };
});
