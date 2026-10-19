/* Shared strength checklist. Admin edits land in go_kraft_exercises;
   the secret page and every logged-in workout read the same rows. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GoChecklist = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var LEGACY = {
    "kt-child": "child",
    "kt-catcow": "catcow",
    "kt-downdog": "downdog",
    "kt-wgs": "wgs",
    "kt-hang": "hang",
    "kt-split": "split",
    "kt-sldl": "sldl",
    "kt-slhip": "slhip",
    "kt-lateral": "lateral",
    "kt-press": "press",
    "kt-pushup": "pushup",
    "kt-crunch": "crunch"
  };

  var BASE = [
    { id: "kt-child", name: "Kindhaltung mit Strecken", short: "Kind", kind: "check", cue: "Po zu Fersen, Arme weit vor.", note: "1 Durchgang", group: "Aufwärmen", sort: 1 },
    { id: "kt-catcow", name: "Katze-Kuh", short: "Katze", kind: "check", cue: "Rücken abwechselnd rund und hohl. Mit Ein- und Ausatmen.", note: "1 Durchgang", group: "Aufwärmen", sort: 2 },
    { id: "kt-downdog", name: "Herabschauender Hund", short: "Hund", kind: "check", cue: "Po hoch, Fersen Richtung Boden. Arme durchstrecken und Oberkörper öffnen.", note: "1 Durchgang", group: "Aufwärmen", sort: 3 },
    { id: "kt-wgs", name: "Große Ganzkörperdehnung", short: "Dehnung", kind: "check", cue: "Ausfallschritt, Arm zur Decke drehen.", note: "1 Durchgang je Seite", group: "Aufwärmen", sort: 4 },
    { id: "kt-hang", name: "Hängen mit Schulterblatt-Heben", short: "Hängen", kind: "reps", cue: "Gestreckt hängen, Schultern runterziehen.", note: "3 × 5 · letzter Satz so lange wie möglich hängen", sets: 3, group: "Hauptteil", sort: 5 },
    { id: "kt-split", name: "Bulgarische Kniebeuge", short: "Bulgarisch", kind: "reps", weight: true, step: 1, startKg: 6, cue: "Hinterer Fuß erhöht, tief beugen.", note: "3 × ca. 10 je Bein", sets: 3, group: "Hauptteil", sort: 6 },
    { id: "kt-sldl", name: "Einbeiniges Kreuzheben", short: "Kreuzheben", kind: "reps", weight: true, step: 1, startKg: 6, cue: "Hüfte nach hinten, Rücken gerade.", note: "3 × ca. 10 je Bein", sets: 3, group: "Hauptteil", sort: 7 },
    { id: "kt-slhip", name: "Einbeiniges Hüftheben", short: "Hüftheben", kind: "reps", cue: "Schultern auf Box, Po hoch. Freies Bein gestreckt.", note: "3 × ca. 10 je Bein", sets: 3, group: "Hauptteil", sort: 8 },
    { id: "kt-lateral", name: "Vorgebeugtes Seitheben", short: "Seitheben", kind: "reps", weight: true, step: 1, startKg: 3, cue: "Stirn auf Stuhllehne, Arme seitlich.", note: "3 × ca. 10", sets: 3, group: "Hauptteil", sort: 9 },
    { id: "kt-press", name: "Schulterdrücken im Sitz", short: "Schulter", kind: "reps", weight: true, step: 1, startKg: 3, cue: "Vorne auf Stuhlkante, Bauch fest.", note: "3 × ca. 15", sets: 3, group: "Hauptteil", sort: 10 },
    { id: "kt-pushup", name: "Liegestütze auf Knien", short: "Liegestütz", kind: "reps", cue: "Körper gerade von Knie bis Kopf.", note: "5 × ca. 5", sets: 5, group: "Hauptteil", sort: 11 },
    { id: "kt-crunch", name: "Umgekehrte Crunches", short: "Crunches", kind: "reps", cue: "Rückenlage, Hände hinten abstützen. Bein strecken, dann Knie Richtung Brust ziehen.", note: "2 × ca. 15", sets: 2, group: "Hauptteil", sort: 12 }
  ];

  var TECH = {
    run: "Laufen",
    bike: "Radfahren",
    row: "Rudern",
    swim: "Schwimmen",
    walk: "Gehen",
    hike: "Wandern"
  };

  /* Icon aus Art oder Name. Gespeicherte Alt-Einträge bleiben so lesbar. */
  function activityEmoji(input) {
    var label = "";
    var kind = "";
    var tech = "";
    if (input && typeof input === "object") {
      label = String(input.label || input.name || "");
      kind = String(input.kind || "");
      tech = String(input.technique || "");
    } else {
      label = String(input || "");
    }
    var blob = (tech + " " + kind + " " + label).toLowerCase();
    if (kind === "zirkel" || /zirkel/.test(blob)) return "🔥";
    if (kind === "kraft") return "🏋️‍♀️";
    if (/schwimm|\bswim\b/.test(blob)) return "🏊";
    if (/ruder|rowing|\brow\b/.test(blob)) return "🚣";
    if (/wandern|\bhike\b/.test(blob)) return "🥾";
    if (/radfahr|fahrrad|rennrad|cycling|\bbike\b|indoor/.test(blob)) return "🚴";
    if (kind === "walk" || /spazier|\bgehen\b|\bwalk\b/.test(blob)) return "🚶";
    if (kind === "jog" || /joggen|jogging|\blaufen\b|\brun\b/.test(blob)) return "🏃";
    if (kind === "ausdauer" || tech) return "🏃";
    if (!kind && !label && !tech) return "🤸";
    return "🏋️‍♀️";
  }

  function metaOf(raw) {
    if (!raw) return {};
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { return {}; }
    }
    return raw && typeof raw === "object" ? raw : {};
  }

  function baseById(id) {
    for (var i = 0; i < BASE.length; i++) {
      if (BASE[i].id === id) return BASE[i];
    }
    return null;
  }

  function shape(id, name, row) {
    var src = baseById(id) || {};
    var meta = row ? metaOf(row.plan_meta) : {};
    var trainer = row && row.trainer_note != null ? String(row.trainer_note) : "";
    var kind = meta.kind || src.kind || "reps";
    if (kind !== "check") kind = "reps";
    var sets = parseInt(meta.sets != null ? meta.sets : src.sets, 10);
    if (!sets || sets < 1) sets = kind === "check" ? 1 : 3;
    if (sets > 12) sets = 12;
    var group = meta.group || src.group || "Hauptteil";
    if (group !== "Aufwärmen" && group !== "Ausdauer") group = "Hauptteil";
    var ex = {
      id: String(id),
      name: String((row && row.name) || name || src.name || id),
      short: String(meta.short || src.short || name || id).slice(0, 18),
      kind: kind,
      cue: String(meta.cue != null ? meta.cue : (src.cue || "")),
      note: trainer || String(meta.note != null ? meta.note : (src.note || "")),
      group: group
    };
    if (kind === "reps") {
      ex.sets = sets;
      var weighted = meta.weight != null ? !!meta.weight : !!src.weight;
      if (weighted) {
        ex.weight = true;
        ex.step = Number(meta.step || src.step) > 0 ? Number(meta.step || src.step) : 1;
        var start = meta.startKg != null ? meta.startKg : src.startKg;
        if (start != null && start !== "") ex.startKg = Number(start);
      }
    }
    return ex;
  }

  function hiddenSet(hidden) {
    var set = {};
    (hidden || []).forEach(function (row) {
      if (!row || row.system_id !== "krafttraining" || !row.exercise_id) return;
      set[String(row.exercise_id)] = true;
    });
    return set;
  }

  function rowMap(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      if (row && row.id) map[String(row.id)] = row;
    });
    return map;
  }

  function sortRows(rows) {
    return (rows || []).slice().sort(function (a, b) {
      var as = Number(metaOf(a.plan_meta).sort);
      var bs = Number(metaOf(b.plan_meta).sort);
      if (isFinite(as) && isFinite(bs) && as !== bs) return as - bs;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });
  }

  /* Secret page keeps the original exercise ids so older logs still match. */
  function forSecret(rows, hidden) {
    var hide = hiddenSet(hidden);
    var map = rowMap(rows);
    var list = [];
    var seen = {};
    BASE.forEach(function (src) {
      if (hide[src.id]) return;
      var row = map[src.id];
      var ex = shape(src.id, src.name, row);
      ex.id = LEGACY[src.id] || src.id;
      seen[src.id] = true;
      list.push(ex);
    });
    sortRows(rows).forEach(function (row) {
      if (!row || row.system_id !== "krafttraining" || seen[row.id] || hide[row.id]) return;
      list.push(shape(row.id, row.name, row));
    });
    return list;
  }

  function forAccount(opts) {
    opts = opts || {};
    var hide = hiddenSet(opts.hidden);
    var map = rowMap(opts.rows);
    var list = [];
    var seen = {};
    var presets = opts.presets || {};
    var systems = ["krafttraining"];
    Object.keys(presets).forEach(function (id) {
      if (systems.indexOf(id) < 0) systems.push(id);
    });
    systems.forEach(function (systemId) {
      var ids = presets[systemId] || [];
      ids.forEach(function (id) {
        id = String(id || "");
        if (!id || seen[id] || hide[id]) return;
        seen[id] = true;
        var row = map[id];
        var src = baseById(id);
        list.push(shape(id, (row && row.name) || (src && src.name) || id, row));
      });
    });
    (opts.ausdauer || []).forEach(function (preset) {
      if (!preset) return;
      var tech = String(preset.technique || "");
      var name = TECH[tech] || tech || "Ausdauer";
      var icon = activityEmoji({ kind: "ausdauer", technique: tech, label: name });
      if (icon && name.indexOf(icon) !== 0) name = icon + " " + name;
      var bits = [];
      if (preset.duration_min != null && preset.duration_min !== "") bits.push(String(preset.duration_min) + " min");
      if (preset.distance_km != null && preset.distance_km !== "") bits.push(String(preset.distance_km) + " km");
      if (preset.speed != null && preset.speed !== "") bits.push(String(preset.speed));
      if (preset.incline != null && preset.incline !== "") bits.push(String(preset.incline) + " %");
      list.push({
        id: "aus-" + String(preset.id || name),
        name: name,
        short: name.slice(0, 18),
        kind: "check",
        cue: bits.join(" · "),
        note: "",
        group: "Ausdauer"
      });
    });
    return list;
  }

  function planMeta(id) {
    var src = baseById(String(id || ""));
    if (!src) return {};
    var meta = {
      cue: src.cue || "",
      note: src.note || "",
      kind: src.kind,
      group: src.group,
      short: src.short,
      sort: src.sort
    };
    if (src.kind === "reps") meta.sets = src.sets || 3;
    if (src.weight) {
      meta.weight = true;
      meta.step = src.step || 1;
      if (src.startKg != null) meta.startKg = src.startKg;
    }
    return meta;
  }

  function catalogSystem() {
    return {
      system: { id: "krafttraining", name: "Einfache Basics" },
      exercises: BASE.map(function (ex) {
        return { id: ex.id, name: ex.name };
      }),
      defaultIds: []
    };
  }

  return {
    BASE: BASE,
    LEGACY: LEGACY,
    forSecret: forSecret,
    forAccount: forAccount,
    planMeta: planMeta,
    catalogSystem: catalogSystem,
    activityEmoji: activityEmoji
  };
});
