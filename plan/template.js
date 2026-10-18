/* Natalya's plan, copied as the starting template for every athlete. */
(function (root) {
  var TEMPLATE = {
    slug: "natalya",
    title: "Natalya",
    headline: "Krafttraining",
    trainer_wa: "491747015500",
    exercises: [
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
      sets: 3,
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
      sets: 3,
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
      sets: 3,
      group: "Hauptteil"
    },
    {
      id: "slhip",
      name: "Einbeiniges Hüftheben",
      short: "Hüftheben",
      kind: "reps",
      cue: "Schultern auf Box, Po hoch. Freies Bein gestreckt.",
      note: "3 × ca. 10 je Bein",
      sets: 3,
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
      sets: 3,
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
      sets: 3,
      group: "Hauptteil"
    },
    {
      id: "pushup",
      name: "Liegestütze auf Knien",
      short: "Liegestütz",
      kind: "reps",
      cue: "Körper gerade von Knie bis Kopf.",
      note: "5 × ca. 5",
      sets: 5,
      group: "Hauptteil"
    },
    {
      id: "crunch",
      name: "Umgekehrte Crunches",
      short: "Crunches",
      kind: "reps",
      cue: "Rückenlage, Hände hinten abstützen. Bein strecken, dann Knie Richtung Brust ziehen.",
      note: "2 × ca. 15",
      sets: 2,
      group: "Hauptteil"
    }
  ]
  };
  if (typeof module === "object" && module.exports) module.exports = TEMPLATE;
  root.PLAN_TEMPLATE = TEMPLATE;
})(typeof globalThis !== "undefined" ? globalThis : this);
