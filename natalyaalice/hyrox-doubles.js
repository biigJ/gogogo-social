/* hyrox-doubles.js — Punkte und Stationen der HYROX Doubles eines Circles (Leaderboard Double, Aufzeichnungen, Admin)
 *
 *   GoHyroxDoubles.plan(row)    Stationen des Termins in Ablauf-Reihenfolge, mit Wert (oder null) und Punkten
 *   GoHyroxDoubles.score(row)   Summe der Punkte über die Stationen mit Wert
 *   GoHyroxDoubles.valueText(s) „23 Runden = 575 m“, „1.630 m“, „155 Wdh“
 *   GoHyroxDoubles.setEvents(list) Termine aus go_hyrox_events (Stationen je Circle und Tag), vor plan()
 *   GoHyroxDoubles.entry(host)  Eintragen in der App: { rest, me, gid, meta, onChange } (go-hyrox-eintragen.sql)
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
  /* Termine aus der Datenbank gehen vor die Voreinstellung im Code */
  var DBEV = {};
  function setEvents(list) {
    (list || []).forEach(function (e) { if (e && e.day) DBEV[String(e.circle_id) + "|" + e.day] = e; });
  }
  function eventOf(row) { return DBEV[String(row.circle_id) + "|" + row.day] || null; }
  function keysOf(row) {
    var res = row.results || {};
    var ev = eventOf(row);
    var preset = ev && (ev.stations || []).length ? ev.stations : EVENTS[row.day];
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

  /* ---------- Eintragen in der App ---------- */
  var CSS_DONE = false;
  function css() {
    if (CSS_DONE) return;
    CSS_DONE = true;
    var st = document.createElement("style");
    st.textContent =
      ".hxe{position:fixed;inset:0;z-index:10040;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,16,12,.42)}" +
      ".hxe__card{width:min(100%,520px);max-height:90vh;overflow-y:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px 22px 0 0;padding:20px 18px calc(16px + env(safe-area-inset-bottom,0px));font-family:Inter,system-ui,sans-serif}" +
      "@media (min-width:600px){.hxe{align-items:center}.hxe__card{border-radius:22px}}" +
      ".hxe__title{margin:0 0 12px;text-align:center;font:600 22px/1.2 'Playfair Display',Georgia,serif}" +
      ".hxe__chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}" +
      ".hxe__chips button{min-height:34px;padding:0 12px;border-radius:999px;border:1.5px solid #111;background:transparent;color:#111;font:inherit;font-size:13px;font-weight:600;cursor:pointer}" +
      ".hxe__chips button.is-on{background:#111;color:#fff}" +
      ".hxe__meta{text-align:center;font-size:13px;color:rgba(42,33,24,.65);margin:0 0 8px}" +
      ".hxe__team{display:flex;justify-content:space-between;gap:10px;width:100%;padding:12px 0;border:0;border-top:1px solid rgba(42,33,24,.12);background:none;font:inherit;font-size:15px;color:inherit;text-align:left;cursor:pointer}" +
      ".hxe__team span:last-child{white-space:nowrap;color:rgba(42,33,24,.72)}" +
      ".hxe__btns{display:grid;gap:8px;margin-top:14px}" +
      ".hxe__btns button{min-height:46px;border-radius:999px;border:1.5px solid #111;background:transparent;color:#111;font:inherit;font-size:15px;font-weight:700;cursor:pointer}" +
      ".hxe__btns button.is-dark{background:#111;color:#fff}" +
      ".hxe__btns button.is-quiet{border:0;color:rgba(42,33,24,.7);font-weight:600}" +
      ".hxe__link{display:block;margin:0 auto 6px;background:none;border:0;padding:4px;font:inherit;font-size:13px;color:inherit;text-decoration:underline;cursor:pointer}" +
      ".hxe .go-rec-round{padding:8px 0;border-top:1px solid rgba(42,33,24,.12);display:grid;gap:4px}" +
      ".hxe .go-rec-round__head{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.6}" +
      ".hxe .go-rec-detail__row{display:flex;justify-content:space-between;gap:8px;font-size:15px}" +
      ".hxe .go-rec-detail__edit{flex:none;white-space:nowrap;border:0;background:transparent;color:rgba(42,33,24,.85);font:inherit;padding:4px 0;text-align:right;text-decoration:underline;text-underline-offset:3px;cursor:pointer}" +
      ".hxe .go-rec-detail__edit.is-empty{font-weight:700}" +
      ".hxe .go-rec-detail__pts{text-align:center;font:600 28px/1.2 'Playfair Display',Georgia,serif;margin:4px 0}";
    document.head.appendChild(st);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function dayDe(iso) { var p = String(iso).split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : iso; }
  function todayIso() { try { return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function first(n) { return String(n || "").trim().split(/\s+/)[0]; }
  function errText(e) {
    var m = String((e && e.message) || e || "");
    if (/team_exists/.test(m)) return "Dieses Team gibt es an dem Tag schon.";
    if (/not_allowed/.test(m)) return "Das darf nur der Coach oder jemand aus dem Team.";
    if (/no_event/.test(m)) return "Den Termin gibt es nicht mehr.";
    if (/go_hyrox|function|PGRST/.test(m)) return "Das braucht go-hyrox-eintragen.sql in Supabase.";
    return "Speichern ging nicht.";
  }
  function entry(h) {
    var D = global.GoDialog;
    if (!h || !h.gid || !D) return;
    css();
    var meta = h.meta || { role: null, events: [], people: [] };
    var rows = [];
    var dayPick = "", teamId = null;
    var coach = meta.role === "coach";
    var me = String(h.me || "");
    var box = document.createElement("div");
    box.className = "hxe";
    box.innerHTML = '<div class="hxe__card go-slide__ffc-plain" role="dialog" aria-modal="true"></div>';
    var card = box.firstChild;
    document.body.appendChild(box);
    var changed = false;
    function close() { box.remove(); if (changed && h.onChange) h.onChange(); }
    function load() {
      return Promise.all([
        h.rest("rpc/go_circle_hyrox_meta", { method: "POST", body: { p_group: String(h.gid) } }),
        h.rest("rpc/go_circle_hyrox_doubles", { method: "POST", body: { p_group: String(h.gid) } })
      ]).then(function (r) {
        meta = r[0] || meta;
        coach = meta.role === "coach";
        setEvents(meta.events);
        rows = r[1] || [];
        var days = (meta.events || []).map(function (e) { return e.day; });
        if (days.indexOf(dayPick) < 0) dayPick = days.indexOf(todayIso()) >= 0 ? todayIso() : days[0] || "";
      });
    }
    function evNow() { return (meta.events || []).filter(function (e) { return e.day === dayPick; })[0] || null; }
    function mine(r) { return (r.account_ids || []).map(String).indexOf(me) >= 0; }
    function teamLabel(r) {
      var names = String(r.team || "").split(/\s*&\s*/);
      return names.map(function (n, k) { return String((r.account_ids || [])[k] || "") === me ? "Du" : n; }).join(" + ");
    }
    function paint() {
      if (teamId) return paintTeam();
      var ev = evNow();
      var html = '<p class="hxe__title">HYROX Double</p><div class="hxe__chips">' + (meta.events || []).map(function (e) {
        return '<button type="button" data-hx-day="' + esc(e.day) + '"' + (e.day === dayPick ? ' class="is-on"' : "") + ">" + esc(dayDe(e.day)) + "</button>";
      }).join("") + (coach ? '<button type="button" data-hx-new="1">+ Termin</button>' : "") + "</div>";
      if (!ev) {
        html += '<p class="hxe__meta">' + (coach ? "Leg zuerst einen Termin mit den Stationen an." : "Noch kein Termin. Den legt der Coach an.") + "</p>";
      } else {
        var work = Number(ev.work_sec) || 360;
        html += '<p class="hxe__meta">' + Math.floor(work / 60) + ":" + String(work % 60).padStart(2, "0") + " je Station · " + (ev.stations || []).map(function (k) { return REFS[k] ? REFS[k].label : k; }).join(", ") + "</p>" +
          (coach ? '<button type="button" class="hxe__link" data-hx-stations="1">Stationen ändern</button>' : "");
        var list = rows.filter(function (r) { return r.day === ev.day && (coach || mine(r)); });
        html += list.map(function (r) {
          var sc = score(r);
          return '<button type="button" class="hxe__team" data-hx-team="' + esc(r.id) + '"><span>' + esc(teamLabel(r)) + " · " + esc(r.category) + "</span><span>" + (sc.n ? sc.total.toLocaleString("de-DE") + " P" : "eintragen") + "</span></button>";
        }).join("");
        if (coach || !rows.some(function (r) { return r.day === ev.day && mine(r); })) {
          html += '<div class="hxe__btns"><button type="button" class="is-dark" data-hx-add="1">Team eintragen</button></div>';
        }
      }
      html += '<div class="hxe__btns"><button type="button" class="is-quiet" data-hx-close="1">Schließen</button></div>';
      card.innerHTML = html;
    }
    function paintTeam() {
      var r = rows.filter(function (x) { return String(x.id) === String(teamId); })[0];
      if (!r) { teamId = null; return paint(); }
      var pl = plan(r), sc = score(r);
      card.innerHTML = '<p class="hxe__title">' + esc(teamLabel(r)) + "</p>" +
        '<p class="hxe__meta">' + esc(dayDe(r.day) + " · " + r.category) + "</p>" +
        '<div class="go-rec-detail__pts">' + sc.total.toLocaleString("de-DE") + " Punkte</div>" +
        pl.map(function (s, k) {
          return '<div class="go-rec-round"><div class="go-rec-round__head">Runde ' + (k + 1) + '</div><div class="go-rec-detail__row"><span>' + esc(s.label) + "</span>" +
            '<button type="button" class="go-rec-detail__edit' + (s.value == null ? " is-empty" : "") + '" data-hx-val="' + esc(s.key) + '">' + esc(s.value == null ? "eintragen" : valueText(s) + (s.points != null ? " · " + s.points + " P" : "")) + "</button></div></div>";
        }).join("") +
        '<div class="hxe__btns"><button type="button" class="is-dark" data-hx-back="1">Fertig</button>' +
        '<button type="button" data-hx-edit="1">Team ändern</button><button type="button" class="is-quiet" data-hx-del="1">Team löschen</button></div>';
    }
    function saveTeam(r, patch) {
      return h.rest("rpc/go_hyrox_team_save", { method: "POST", body: {
        p_id: r ? r.id : null, p_group: String(h.gid), p_day: r ? r.day : dayPick,
        p_category: patch.category != null ? patch.category : r.category,
        p_team: patch.team != null ? patch.team : r.team,
        p_ids: patch.ids != null ? patch.ids : r.account_ids,
        p_results: patch.results != null ? patch.results : (r ? r.results : {})
      } }).then(function (out) {
        changed = true;
        out = Array.isArray(out) ? out[0] : out;
        return load().then(function () { if (out && out.id) teamId = out.id; paint(); });
      }).catch(function (e) { D.alert(errText(e)); });
    }
    function askValue(key) {
      var r = rows.filter(function (x) { return String(x.id) === String(teamId); })[0];
      if (!r) return;
      var ref = REFS[key], have = (r.results || {})[key];
      var q = ref.per ? ref.label + ": Runden (je " + String(ref.per).replace(".", ",") + " m)" : ref.label + " in " + ref.unit;
      var start = have == null ? "" : String(ref.per ? Math.round(have / ref.per * 10) / 10 : have).replace(".", ",");
      D.prompt(q, start, { ok: "Speichern", type: "number" }).then(function (v) {
        if (v == null) return;
        var res = Object.assign({}, r.results || {});
        v = String(v).replace(",", ".").trim();
        if (v === "") delete res[key];
        else if (!(Number(v) >= 0)) { D.alert("Bitte eine Zahl eingeben."); return; }
        else res[key] = ref.per ? Math.round(Number(v) * ref.per * 10) / 10 : Number(v);
        saveTeam(r, { results: res });
      });
    }
    /* Partner: Personen des Circles oder ein Name ohne Konto */
    function pickPerson(title, skip) {
      var opts = (meta.people || []).filter(function (p) { return skip.indexOf(String(p.id)) < 0; })
        .map(function (p) { return { label: String(p.name || "?"), value: String(p.id) }; });
      opts.push({ label: "Name eingeben (ohne Konto)", value: "__name" });
      return D.choose(title, opts, { cancel: "Abbrechen" }).then(function (v) {
        if (!v) return null;
        if (v !== "__name") {
          var p = (meta.people || []).filter(function (x) { return String(x.id) === v; })[0];
          return { id: v, name: first(p && p.name) };
        }
        return D.prompt("Vorname", "", { ok: "Weiter" }).then(function (n) { n = String(n || "").trim(); return n ? { id: null, name: n } : null; });
      });
    }
    function teamFlow(r) {
      var a = null, b = null;
      var start = coach ? pickPerson("Wer ist im Team?", []) : Promise.resolve({ id: me, name: first(((meta.people || []).filter(function (p) { return String(p.id) === me; })[0] || {}).name) || "Ich" });
      return start.then(function (x) {
        if (!x) return;
        a = x;
        return pickPerson(coach ? "Und mit wem?" : "Mit wem?", [String(a.id)]).then(function (y) {
          if (!y) return;
          b = y;
          return D.choose("Kategorie", ["Männer", "Mix", "Frauen"].map(function (c) { return { label: c, value: c }; }), { cancel: "Abbrechen" });
        }).then(function (cat) {
          if (!cat) return;
          var ids = [a.id, b.id].filter(Boolean);
          return saveTeam(r || null, { category: cat, team: a.name + " & " + b.name, ids: ids, results: r ? r.results : {} });
        });
      });
    }
    function stationFlow(ev) {
      var have = ev ? ev.stations || [] : [];
      return (ev ? Promise.resolve(ev.day) : D.prompt("Datum (TT.MM.JJJJ)", dayDe(todayIso()), { ok: "Weiter" }).then(function (v) {
        if (v == null) return null;
        var m = String(v).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!m) { D.alert("Bitte als TT.MM.JJJJ eingeben."); return null; }
        return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
      })).then(function (day) {
        if (!day) return;
        return D.pick("Stationen", ORDER.map(function (k) { return { label: REFS[k].label, value: k, checked: have.indexOf(k) >= 0 }; }), { ok: "Speichern", cancel: "Abbrechen" }).then(function (picked) {
          if (!picked) return;
          if (!picked.length) { D.alert("Wähle mindestens eine Station."); return; }
          var keep = have.filter(function (k) { return picked.indexOf(k) >= 0; });
          var stations = keep.concat(ORDER.filter(function (k) { return picked.indexOf(k) >= 0 && keep.indexOf(k) < 0; }));
          return h.rest("rpc/go_hyrox_event_save", { method: "POST", body: { p_group: String(h.gid), p_day: day, p_title: ev ? ev.title : "HYROX Double", p_stations: stations, p_work_sec: ev ? ev.work_sec : 360 } })
            .then(function () { changed = true; dayPick = day; return load(); }).then(paint)
            .catch(function (e) { D.alert(errText(e)); });
        });
      });
    }
    box.addEventListener("click", function (e) {
      var t = e.target;
      if (t === box || t.closest("[data-hx-close]")) { close(); return; }
      var d = t.closest("[data-hx-day]");
      if (d) { dayPick = d.getAttribute("data-hx-day"); paint(); return; }
      if (t.closest("[data-hx-new]")) { stationFlow(null); return; }
      if (t.closest("[data-hx-stations]")) { stationFlow(evNow()); return; }
      if (t.closest("[data-hx-add]")) { teamFlow(null); return; }
      var tm = t.closest("[data-hx-team]");
      if (tm) { teamId = tm.getAttribute("data-hx-team"); paint(); return; }
      if (t.closest("[data-hx-back]")) { teamId = null; paint(); return; }
      var v = t.closest("[data-hx-val]");
      if (v) { askValue(v.getAttribute("data-hx-val")); return; }
      var cur = rows.filter(function (x) { return String(x.id) === String(teamId); })[0];
      if (t.closest("[data-hx-edit]") && cur) { teamFlow(cur); return; }
      if (t.closest("[data-hx-del]") && cur) {
        D.confirm("Team „" + teamLabel(cur) + "“ mit allen Werten löschen?", { ok: "Löschen", cancel: "Abbrechen", row: true }).then(function (ok) {
          if (!ok) return;
          h.rest("rpc/go_hyrox_team_delete", { method: "POST", body: { p_id: cur.id } })
            .then(function () { changed = true; teamId = null; return load(); }).then(paint)
            .catch(function (er) { D.alert(errText(er)); });
        });
      }
    });
    card.innerHTML = '<p class="hxe__meta">Lädt …</p>';
    load().then(paint).catch(function (e) { card.innerHTML = '<p class="hxe__meta">' + esc(errText(e)) + '</p><div class="hxe__btns"><button type="button" class="is-quiet" data-hx-close="1">Schließen</button></div>'; });
  }
  global.GoHyroxDoubles = { plan: plan, score: score, valueText: valueText, setEvents: setEvents, entry: entry, REFS: REFS, EVENTS: EVENTS };
})(window);
