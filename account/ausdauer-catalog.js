(function (root) {
  var TECHNIQUES = [
    { id: "run", name: "Laufen", speedUnit: "min/km", hasIncline: true },
    { id: "bike", name: "Rennrad", speedUnit: "km/h", hasIncline: true },
    { id: "indoor", name: "Indoor-Bike", speedUnit: "km/h", hasIncline: false },
    { id: "swim", name: "Schwimmen", speedUnit: "min/100m", hasIncline: false },
    { id: "row", name: "Ruderergometer", speedUnit: "min/500m", hasIncline: false },
    { id: "xc", name: "Crosstrainer", speedUnit: "km/h", hasIncline: true }
  ];

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

  function techniqueById(id) {
    for (var i = 0; i < TECHNIQUES.length; i++) {
      if (TECHNIQUES[i].id === id) return localized(TECHNIQUES[i]);
    }
    return localized(TECHNIQUES[0]);
  }

  function formatSpeed(techId, value) {
    if (value == null || value === "") return "—";
    var tech = techniqueById(techId);
    return String(value) + " " + tech.speedUnit;
  }

  function summarize(row) {
    var tech = techniqueById(row.technique);
    var parts = [tech.name];
    if (tech.hasIncline && row.incline != null && row.incline !== "") parts.push(row.incline + "%");
    if (row.duration_min != null && row.duration_min !== "") parts.push(row.duration_min + " min");
    if (row.distance_km != null && row.distance_km !== "") parts.push(row.distance_km + " km");
    if (row.speed != null && row.speed !== "") parts.push(formatSpeed(row.technique, row.speed));
    if (row.hr_avg != null && row.hr_avg !== "") parts.push(row.hr_avg + " bpm");
    return parts.join(" · ");
  }

  root.GOGOGO_AUSDAUER = {
    get TECHNIQUES() { return TECHNIQUES.map(localized); },
    techniqueById: techniqueById,
    formatSpeed: formatSpeed,
    summarize: summarize
  };
})(typeof window !== "undefined" ? window : this);
