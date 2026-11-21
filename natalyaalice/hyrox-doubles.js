/* hyrox-doubles.js — HYROX-Double-Leaderboard eines Circles (Plus → Friday Fitness Circle)
 *
 *   GoHyroxDoubles.mount(el, { rest, group() })   lädt go_circle_hyrox_doubles(group) und zeichnet die Auswertung
 *   GoHyroxDoubles.refresh()                      neu laden (z. B. nach Circle-Wechsel)
 *   GoHyroxDoubles.score(row)                     Punkte eines Teams (für Tests)
 *
 * Punkte wie in FFC (ffc.js roundPoints): 100 = Tempo der HYROX-Elite, hier für ein Double-Team in 6 Minuten.
 *   Referenz = Stationslänge × (Arbeitszeit / Elite-Zeit)^0,943 (Riegel) × Double-Faktor, gedeckelt bei 150.
 *   Double-Faktor 1,2: Doubles-Weltrekorde sind bei gleicher Laufstrecke rund 4 bis 8 % schneller als Einzel,
 *   auf die Stationen gerechnet etwa 20 % mehr Leistung je Zeit (Annahme, siehe PR).
 *   Kategorie: Männer = Männer-Referenz, Frauen = Frauen-Referenz, Mix = Mittel aus beiden.
 *   Assault Bike ist keine HYROX-Station: Referenz aus dem Fan-Bike-Stundenweltrekord (44,28 km), ohne Double-Faktor.
 * Stelle im Ablauf: Wer eine Station später macht, ist schon müde. Je Minute vorher Arbeit + Pause gibt es
 *   +0,35 % (nach 42 Minuten also +15 %). Nur wenn die Reihenfolge des Teams bekannt ist.
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
    sledpush: { label: "Schlitten (Push)", unit: "m", dist: 50, m: 165, f: 180 },
    sledhybrid: { label: "Schlitten (Push & Pull)", unit: "m", dist: 50, m: 180, f: 207 },
    farmers: { label: "Farmers Carry", unit: "m", dist: 200, m: 97, f: 117 },
    wallballs: { label: "Wall Balls", unit: "Wdh", dist: 100, m: 265, f: 230 },
    lunges: { label: "Lunges", unit: "m", dist: 100, m: 183, f: 215 },
    burpee: { label: "Burpee Broad Jumps", unit: "m", dist: 80, m: 141, f: 191 },
    /* Fan Bike: Weltrekord 1 h 44,28 km (Männer); Frauen 10 % langsamer angenommen */
    bike_m: { label: "Assault Bike", unit: "m", dist: 44280, m: 3600, f: 4000, noDouble: true }
  };
  var ORDER = ["row", "sledpush", "sledhybrid", "bike_m", "skierg", "farmers", "wallballs", "lunges", "burpee"];
  var CATS = ["Männer", "Mix", "Frauen"];

  var host = null, box = null, data = [], open = {}, dayPick = "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
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
  function score(row) {
    var res = row.results || {};
    var work = Number(row.work_sec) || 360, rest = Number(row.rest_sec) || 60;
    var order = row.station_order || null;
    var out = { total: 0, n: 0, stations: [] };
    ORDER.forEach(function (k) {
      if (res[k] == null) return;
      var pos = order ? order.indexOf(k) : null;
      var p = stationPoints(k, res[k], row.category, work, pos != null && pos >= 0 ? pos : null, rest);
      out.stations.push({ key: k, label: REFS[k].label, unit: REFS[k].unit, value: res[k], points: p });
      if (p != null) { out.total += p; out.n += 1; }
    });
    return out;
  }
  function fmt(n) { return Number(n).toLocaleString("de-DE", { maximumFractionDigits: 1 }); }
  function dayLabel(iso) {
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(/,/, "");
  }

  function paint() {
    if (!box) return;
    var sec = box.closest("section");
    if (!data.length) { box.innerHTML = ""; if (sec) sec.hidden = true; return; }
    if (sec) sec.hidden = false;
    var days = [];
    data.forEach(function (r) { if (days.indexOf(r.day) < 0) days.push(r.day); });
    days.sort().reverse();
    if (days.indexOf(dayPick) < 0) dayPick = days[0];
    var rows = data.filter(function (r) { return r.day === dayPick; });
    var html = '<div class="hxd-days">' + days.map(function (d) {
      return '<button type="button" class="go-slide__cta go-zlb-btn hxd-day' + (d === dayPick ? " is-on" : "") + '" data-hxd-day="' + esc(d) + '">' + esc(dayLabel(d)) + "</button>";
    }).join("") + "</div>";
    CATS.concat(["nicht gewertet"]).forEach(function (cat) {
      var list = rows.filter(function (r) { return r.category === cat; }).map(function (r) { return { r: r, s: score(r) }; });
      if (!list.length) return;
      /* Punkte vergleichbar nur, wenn alle Teams gleich viele Stationen haben; sonst Rangfolge von der Tafel */
      var nMax = Math.max.apply(null, list.map(function (x) { return x.s.n; }));
      var full = nMax > 0 && list.every(function (x) { return x.s.n === nMax; });
      list.sort(function (a, b) {
        if (full) return b.s.total - a.s.total;
        return (a.r.board_place || 99) - (b.r.board_place || 99);
      });
      html += '<p class="hxd-cat">' + esc(cat) + (full || cat === "nicht gewertet" ? "" : " · Rangfolge von der Tafel, Werte unvollständig") + "</p>";
      var rank = 0;
      list.forEach(function (x) {
        var key = x.r.id;
        var ranked = cat !== "nicht gewertet" && (full || x.r.board_place);
        if (ranked) rank += 1;
        html += '<div class="go-slide__ffc-row hxd-row" data-hxd-team="' + esc(key) + '"><span>' + (ranked ? rank + ". " : "") + esc(x.r.team) + "</span><span>" +
          (x.s.n ? fmt(x.s.total) + " P" + (x.s.n < nMax || !full ? " · " + x.s.n + (x.s.n === 1 ? " Station" : " Stationen") : "") : "keine Werte") + "</span></div>";
        if (open[key]) {
          html += '<div class="hxd-detail">' + x.s.stations.map(function (st) {
            return "<div><span>" + esc(st.label) + "</span><span>" + fmt(st.value) + " " + esc(st.unit) + (st.points != null ? " · " + st.points + " P" : "") + "</span></div>";
          }).join("") + (x.r.board_place ? '<div class="hxd-board"><span>Tafel-Wertung</span><span>Platz ' + x.r.board_place + " · " + fmt(x.r.board_points) + " Platzpunkte</span></div>" : "") + "</div>";
        }
      });
    });
    html += '<p class="hxd-hint">100 Punkte je Station = HYROX-Elite als Double in 6 Minuten. Tippen auf ein Team zeigt die Stationen.</p>';
    box.innerHTML = html;
  }
  function load() {
    var g = host && host.group ? host.group() : null;
    if (!box || !g) { data = []; paint(); return Promise.resolve(); }
    return host.rest("rpc/go_circle_hyrox_doubles", { method: "POST", body: { p_group: String(g) } })
      .then(function (rows) { data = rows || []; paint(); })
      .catch(function () { data = []; paint(); });
  }
  function mount(el, h) {
    host = h;
    box = el;
    if (!el._hxdBound) {
      el._hxdBound = true;
      el.addEventListener("click", function (e) {
        var d = e.target.closest("[data-hxd-day]");
        if (d) { dayPick = d.getAttribute("data-hxd-day"); paint(); return; }
        var t = e.target.closest("[data-hxd-team]");
        if (t) { var k = t.getAttribute("data-hxd-team"); open[k] = !open[k]; paint(); }
      });
    }
    paint();
    return load();
  }
  global.GoHyroxDoubles = { mount: mount, refresh: load, score: score, REFS: REFS };
})(window);
