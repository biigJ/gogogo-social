/**
 * Shared DE/EN helpers for /account (parent + fitness-friday iframe).
 * Language key: localStorage gogogo_ui_lang ("de" | "en")
 */
(function (global) {
  var LANG_KEY = "gogogo_ui_lang";

  var EXERCISE_EN = {
    "Ganzkörpertraining": "Full body",
    "Oberkörpertraining": "Upper body",
    "Unterkörpertraining": "Lower body",
    "Beintraining": "Legs",
    "Glutes/Legs": "Glutes/Legs",
    "Athletic Day": "Athletic Day",
    "Push Day": "Push Day",
    "Pull Day": "Pull Day",
    "Kniebeuge": "Squat",
    "Kreuzheben": "Deadlift",
    "Bankdrücken": "Bench press",
    "Schulterdrücken": "Overhead press",
    "Klimmzüge": "Pull-ups",
    "Langhantelrudern": "Barbell row",
    "Ausfallschritte": "Lunges",
    "Rumänisches Kreuzheben": "Romanian deadlift",
    "Farmer Carry": "Farmer carry",
    "Unterarmstütz": "Plank",
    "Dips": "Dips",
    "Schrägbankdrücken": "Incline bench",
    "Liegestütze": "Push-ups",
    "Face Pulls": "Face pulls",
    "Seitheben": "Lateral raise",
    "Klimmzüge supiniert": "Chin-ups",
    "Hip Thrust": "Hip thrust",
    "Bulgarian Split Squat": "Bulgarian split squat",
    "Beinpresse": "Leg press",
    "Step-ups": "Step-ups",
    "Wadenheben": "Calf raise",
    "Good Morning": "Good morning",
    "Frontkniebeuge": "Front squat",
    "Beinbeuger": "Leg curl",
    "Beinstrecker": "Leg extension",
    "Walking Lunges": "Walking lunges",
    "Adduktoren": "Adductors",
    "Glute Bridge": "Glute bridge",
    "Kabel Kickback": "Cable kickback",
    "Hüftabduktion": "Hip abduction",
    "Power Clean": "Power clean",
    "Box Jump": "Box jump",
    "Kettlebell Swing": "Kettlebell swing",
    "Push Press": "Push press",
    "Medizinball-Slam": "Medicine ball slam",
    "Weitsprung": "Broad jump",
    "Latzug": "Lat pulldown",
    "Sitzendes Rudern": "Seated row",
    "Reverse Fly": "Reverse fly",
    "Bizepscurl": "Biceps curl",
    "Hammercurl": "Hammer curl",
    "Laufen": "Running",
    "Rennrad": "Road bike",
    "Indoor-Bike": "Indoor bike",
    "Schwimmen": "Swimming",
    "Ruderergometer": "Rowing erg",
    "Crosstrainer": "Elliptical"
  };

  function getLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      if (v === "en" || v === "de") return v;
    } catch (e) {}
    return "de";
  }

  function setLang(lang) {
    if (lang !== "en" && lang !== "de") lang = "de";
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    return lang;
  }

  function t(de, en) {
    return getLang() === "en" ? (en != null ? en : de) : de;
  }

  function localizeName(deName) {
    if (getLang() !== "en") return deName;
    return EXERCISE_EN[deName] || deName;
  }

  function applyDataAttrs(root) {
    root = root || document;
    root.querySelectorAll("[data-de][data-en]").forEach(function (el) {
      var lang = getLang();
      var text = lang === "de" ? el.getAttribute("data-de") : el.getAttribute("data-en");
      if (text == null) return;
      text = String(text).replace(/&#10;/g, "\n");
      if (text.indexOf("&lt;") !== -1 || text.indexOf("&amp;") !== -1) {
        el.innerHTML = text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      } else {
        el.textContent = text;
      }
    });
    root.querySelectorAll("[data-aria-de][data-aria-en]").forEach(function (el) {
      var lang = getLang();
      var text = lang === "de" ? el.getAttribute("data-aria-de") : el.getAttribute("data-aria-en");
      if (text != null) el.setAttribute("aria-label", text);
    });
    root.querySelectorAll("[data-ph-de][data-ph-en]").forEach(function (el) {
      var lang = getLang();
      var text = lang === "de" ? el.getAttribute("data-ph-de") : el.getAttribute("data-ph-en");
      if (text != null) el.setAttribute("placeholder", text);
    });
  }

  function applyBookTiles(root) {
    var tiles = global.GOGL_TILE_I18N;
    if (!tiles || !tiles.length) return;
    root = root || document;
    var lang = getLang();
    root.querySelectorAll("#panel-book article.fact, #panel-book article.about-card").forEach(function (art) {
      var titleEl = art.querySelector(".fact__title, .about-card__title");
      if (!titleEl) return;
      var current = String(titleEl.getAttribute("data-title-de") || titleEl.textContent || "").trim();
      if (!titleEl.getAttribute("data-title-de")) titleEl.setAttribute("data-title-de", current);
      var key = titleEl.getAttribute("data-title-de");
      var match = null;
      for (var i = 0; i < tiles.length; i++) {
        if (tiles[i].titleDe === key) { match = tiles[i]; break; }
      }
      if (!match) return;
      titleEl.textContent = lang === "en" ? match.titleEn : match.titleDe;
      var bodyP = art.querySelector(".fact__body > p, .about-card > p");
      if (bodyP && match.bodyEn) {
        if (!bodyP.getAttribute("data-body-de")) bodyP.setAttribute("data-body-de", bodyP.textContent);
        bodyP.textContent = lang === "en" ? match.bodyEn : (bodyP.getAttribute("data-body-de") || match.bodyDe);
      }
    });
  }

  global.GoUiI18n = {
    LANG_KEY: LANG_KEY,
    EXERCISE_EN: EXERCISE_EN,
    getLang: getLang,
    setLang: setLang,
    t: t,
    localizeName: localizeName,
    applyDataAttrs: applyDataAttrs,
    applyBookTiles: applyBookTiles
  };
})(window);
