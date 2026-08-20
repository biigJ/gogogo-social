(function (root) {
  var SYSTEMS = [
    { id: "full", name: "Ganzkörpertraining" },
    { id: "upper", name: "Oberkörpertraining" },
    { id: "lower", name: "Unterkörpertraining" },
    { id: "legs", name: "Beintraining" },
    { id: "glutes", name: "Glutes/Legs" },
    { id: "athletic", name: "Athletic Day" },
    { id: "push", name: "Push Day" },
    { id: "pull", name: "Pull Day" }
  ];

  var EXERCISES = {
    full: [
      { id: "squat", name: "Kniebeuge" },
      { id: "deadlift", name: "Kreuzheben" },
      { id: "bench", name: "Bankdrücken" },
      { id: "ohp", name: "Schulterdrücken" },
      { id: "pullup", name: "Klimmzüge" },
      { id: "row", name: "Langhantelrudern" },
      { id: "lunge", name: "Ausfallschritte" },
      { id: "rdl", name: "Rumänisches Kreuzheben" },
      { id: "farmer", name: "Farmer Carry" },
      { id: "plank", name: "Unterarmstütz" }
    ],
    upper: [
      { id: "bench", name: "Bankdrücken" },
      { id: "ohp", name: "Schulterdrücken" },
      { id: "pullup", name: "Klimmzüge" },
      { id: "row", name: "Langhantelrudern" },
      { id: "dip", name: "Dips" },
      { id: "incline", name: "Schrägbankdrücken" },
      { id: "pushup", name: "Liegestütze" },
      { id: "facepull", name: "Face Pulls" },
      { id: "lateral", name: "Seitheben" },
      { id: "chinup", name: "Klimmzüge supiniert" }
    ],
    lower: [
      { id: "squat", name: "Kniebeuge" },
      { id: "deadlift", name: "Kreuzheben" },
      { id: "rdl", name: "Rumänisches Kreuzheben" },
      { id: "lunge", name: "Ausfallschritte" },
      { id: "hipthrust", name: "Hip Thrust" },
      { id: "split", name: "Bulgarian Split Squat" },
      { id: "legpress", name: "Beinpresse" },
      { id: "stepup", name: "Step-ups" },
      { id: "calf", name: "Wadenheben" },
      { id: "goodmorning", name: "Good Morning" }
    ],
    legs: [
      { id: "squat", name: "Kniebeuge" },
      { id: "frontsquat", name: "Frontkniebeuge" },
      { id: "legpress", name: "Beinpresse" },
      { id: "legcurl", name: "Beinbeuger" },
      { id: "legext", name: "Beinstrecker" },
      { id: "lunge", name: "Walking Lunges" },
      { id: "split", name: "Bulgarian Split Squat" },
      { id: "hipthrust", name: "Hip Thrust" },
      { id: "calf", name: "Wadenheben" },
      { id: "adductor", name: "Adduktoren" }
    ],
    glutes: [
      { id: "hipthrust", name: "Hip Thrust" },
      { id: "rdl", name: "Rumänisches Kreuzheben" },
      { id: "split", name: "Bulgarian Split Squat" },
      { id: "glutebridge", name: "Glute Bridge" },
      { id: "lunge", name: "Walking Lunges" },
      { id: "squat", name: "Kniebeuge" },
      { id: "stepup", name: "Step-ups" },
      { id: "kickback", name: "Kabel Kickback" },
      { id: "abduction", name: "Hüftabduktion" },
      { id: "deadlift", name: "Kreuzheben" }
    ],
    athletic: [
      { id: "powerclean", name: "Power Clean" },
      { id: "boxjump", name: "Box Jump" },
      { id: "kbswing", name: "Kettlebell Swing" },
      { id: "pushpress", name: "Push Press" },
      { id: "medball", name: "Medizinball-Slam" },
      { id: "broadjump", name: "Weitsprung" },
      { id: "farmer", name: "Farmer Carry" },
      { id: "sled", name: "Sled Push" },
      { id: "pullup", name: "Klimmzüge" },
      { id: "plank", name: "Unterarmstütz" }
    ],
    push: [
      { id: "bench", name: "Bankdrücken" },
      { id: "ohp", name: "Schulterdrücken" },
      { id: "incline", name: "Schrägbankdrücken" },
      { id: "dip", name: "Dips" },
      { id: "pushup", name: "Liegestütze" },
      { id: "lateral", name: "Seitheben" },
      { id: "frontraise", name: "Frontheben" },
      { id: "cgbench", name: "Enges Bankdrücken" },
      { id: "tripush", name: "Trizepsdrücken" },
      { id: "ohtri", name: "Überkopf-Trizeps" }
    ],
    pull: [
      { id: "deadlift", name: "Kreuzheben" },
      { id: "pullup", name: "Klimmzüge" },
      { id: "row", name: "Langhantelrudern" },
      { id: "latpulldown", name: "Latzug" },
      { id: "seatedrow", name: "Sitzendes Rudern" },
      { id: "facepull", name: "Face Pulls" },
      { id: "chinup", name: "Klimmzüge supiniert" },
      { id: "reardelt", name: "Reverse Fly" },
      { id: "curl", name: "Bizepscurl" },
      { id: "hammer", name: "Hammercurl" }
    ]
  };

  var DEFAULT_PRESETS = {
    full: ["squat", "deadlift", "bench", "ohp", "pullup", "row"],
    upper: ["bench", "ohp", "pullup", "row", "dip"],
    lower: ["squat", "deadlift", "rdl", "lunge", "hipthrust"],
    legs: ["squat", "frontsquat", "legpress", "lunge", "hipthrust"],
    glutes: ["hipthrust", "rdl", "split", "lunge", "squat"],
    athletic: ["powerclean", "boxjump", "kbswing", "pushpress", "farmer"],
    push: ["bench", "ohp", "incline", "dip", "lateral"],
    pull: ["deadlift", "pullup", "row", "latpulldown", "facepull"]
  };

  function localized(item) {
    if (!item) return item;
    var n = item.name;
    if (typeof window !== "undefined" && window.GoUiI18n) {
      n = window.GoUiI18n.localizeName(item.name);
    }
    if (n === item.name) return item;
    var out = {};
    for (var k in item) {
      if (Object.prototype.hasOwnProperty.call(item, k)) out[k] = item[k];
    }
    out.name = n;
    return out;
  }

  function systemById(id) {
    for (var i = 0; i < SYSTEMS.length; i++) {
      if (SYSTEMS[i].id === id) return localized(SYSTEMS[i]);
    }
    return localized(SYSTEMS[0]);
  }

  function exercisesFor(systemId) {
    return (EXERCISES[systemId] || EXERCISES.full).map(localized);
  }

  function defaultPresetsFor(systemId) {
    return (DEFAULT_PRESETS[systemId] || []).slice();
  }

  root.GOGOGO_KRAFT = {
    get SYSTEMS() { return SYSTEMS.map(localized); },
    EXERCISES: EXERCISES,
    DEFAULT_PRESETS: DEFAULT_PRESETS,
    systemById: systemById,
    exercisesFor: exercisesFor,
    defaultPresetsFor: defaultPresetsFor
  };
})(typeof window !== "undefined" ? window : this);
