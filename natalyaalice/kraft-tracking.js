/* kraft-tracking.js — gespeicherte Übungen ansehen + Verlauf als Kurve
 *
 *   GoKraftTracking.init(host)
 *   GoKraftTracking.mount(el, force)                → Liste unter Plus (Datumsfilter, aufklappbar)
 *   GoKraftTracking.openDay({ people, names, iso, title })→ Übungen eines vergangenen Events
 *   GoKraftTracking.openChart(name, accountId)      → Verlauf einer Übung
 *
 * host: rest(path, opts), me(), logPathFor(accountId) → Promise<"tabelle?filter&">,
 *       nameFor(exerciseId) → string|null
 * Logs: go_workout_logs (bzw. go_natalya_logs). Übungsname aus exercise_name (go-kraft-tracking.sql),
 * sonst aus dem Basis-Plan in log.js.
 */
(function (global) {
  "use strict";

  var host = null;
  var STATIC = {};
  var cache = {};
  var noNameCol = {};
  var ORDER = {};

  var CSS =
    ".kt{margin:18px 0 8px;text-align:left;color:#2A2118}" +
    ".kt__filter{display:flex;gap:8px;margin:0 0 12px}" +
    ".kt__filter label{flex:1;display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:rgba(42,33,24,.65)}" +
    ".kt__filter input{min-height:40px;box-sizing:border-box;width:100%;padding:0 8px;border:1px solid rgba(42,33,24,.25);border-radius:10px;background:#fff;font:inherit;font-size:15px;color:#2A2118}" +
    ".kt__empty{margin:8px 0;font-size:14px;color:rgba(42,33,24,.65)}" +
    ".kt__day{border-top:1px solid rgba(42,33,24,.14)}" +
    ".kt__day:last-child{border-bottom:1px solid rgba(42,33,24,.14)}" +
    ".kt__day summary{list-style:none;display:flex;align-items:baseline;gap:10px;padding:12px 2px;cursor:pointer}" +
    ".kt__day summary::-webkit-details-marker{display:none}" +
    ".kt__day summary::after{content:'+';margin-left:auto;font-weight:700}" +
    ".kt__day[open] summary::after{content:'–'}" +
    ".kt__date{font-weight:700;white-space:nowrap}" +
    ".kt__title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(42,33,24,.75)}" +
    ".kt__ex{list-style:none;margin:0 0 10px;padding:0}" +
    ".kt__row{display:flex;align-items:center;gap:8px;padding:6px 0}" +
    ".kt__row-copy{flex:1;min-width:0}" +
    ".kt__name{display:block;font-weight:600;font-size:15px}" +
    ".kt__sets{display:block;font-size:13px;color:rgba(42,33,24,.7)}" +
    ".kt-chart-btn{flex:0 0 auto;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;background:transparent;color:#2A2118;cursor:pointer;padding:0}" +
    ".kt-chart-btn svg{width:20px;height:20px}" +
    ".kt-sheet{position:fixed;inset:0;z-index:10040;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,16,12,.42)}" +
    ".kt-sheet__card{width:min(100%,480px);max-height:86vh;overflow:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px 22px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom));font-family:Inter,system-ui,sans-serif}" +
    ".kt-sheet__card h2{margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;line-height:1.2}" +
    ".kt-sheet__sub{margin:0 0 14px;font-size:13px;color:rgba(42,33,24,.65)}" +
    ".kt-sheet__who{margin:14px 0 4px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(42,33,24,.6)}" +
    ".kt-sheet__close{display:block;width:100%;min-height:48px;margin:14px 0 0;border:0;border-radius:999px;background:#111;color:#fff;font:inherit;font-weight:700;font-size:16px;cursor:pointer}" +
    ".kt-chart{display:block;width:100%;height:auto;margin:6px 0 4px}" +
    ".kt-chart__pick{min-height:20px;margin:0;font-size:14px;font-weight:700}" +
    ".kt-table{width:100%;border-collapse:collapse;margin:8px 0 0;font-size:14px}" +
    ".kt-table td{padding:5px 2px !important;border:0 !important;border-top:1px solid rgba(42,33,24,.1) !important;background:transparent !important;color:#2A2118 !important;text-align:left;font-weight:400}" +
    ".kt-table td:last-child{text-align:right !important;font-variant-numeric:tabular-nums}";

  var CHART_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/></svg>';

  function ensureCss() {
    if (document.getElementById("kt-css")) return;
    var st = document.createElement("style");
    st.id = "kt-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function baseId(id) {
    var s = String(id || "");
    var h = s.lastIndexOf("#");
    return h === -1 ? s : s.slice(0, h);
  }

  function setNo(id) {
    var s = String(id || "");
    var h = s.lastIndexOf("#");
    return h === -1 ? 1 : parseInt(s.slice(h + 1), 10) || 1;
  }

  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function fmtNum(n) {
    return String(Math.round(n * 100) / 100).replace(".", ",");
  }

  var WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  function fmtDate(iso, withDay) {
    var p = String(iso || "").split("-");
    if (p.length < 3) return iso || "";
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    return (withDay ? WD[d.getUTCDay()] + " " : "") + p[2] + "." + p[1] + ".";
  }

  function naturalCmp(a, b) {
    return String(a).localeCompare(String(b), "de", { numeric: true });
  }

  function nameOf(row) {
    if (row.exercise_name) return String(row.exercise_name);
    var b = baseId(row.exercise_id);
    if (STATIC[b]) return STATIC[b];
    var n = host && host.nameFor ? host.nameFor(b) : null;
    return n || null;
  }

  /* Alle Logs einer Person (neueste zuerst), 60 s gecacht */
  function loadLogs(accountId, fresh) {
    var key = String(accountId || "");
    var hit = cache[key];
    if (!fresh && hit && Date.now() - hit.at < 60000) return Promise.resolve(hit.rows);
    return host.logPathFor(accountId).then(function (path) {
      function read(withName) {
        return host.rest(
          path + "select=workout_date,exercise_id," + (withName ? "exercise_name," : "") +
            "reps,weight_kg,done&order=workout_date.desc&limit=3000"
        );
      }
      var table = path.split("?")[0];
      return (noNameCol[table] ? Promise.reject(new Error("no-col")) : read(true))
        .catch(function () {
          noNameCol[table] = true;
          return read(false);
        });
    }).then(function (rows) {
      rows = rows || [];
      cache[key] = { at: Date.now(), rows: rows };
      return rows;
    });
  }

  /* Tag → [{ name, check, sets:[{reps,kg,done}] }] */
  function exercisesOn(rows, iso) {
    var map = {};
    var order = [];
    rows.forEach(function (r) {
      if (r.workout_date !== iso) return;
      var b = baseId(r.exercise_id);
      if (!map[b]) {
        map[b] = { id: b, name: nameOf(r) || "Übung", sets: [] };
        order.push(b);
      }
      map[b].sets.push({ no: setNo(r.exercise_id), reps: num(r.reps), kg: num(r.weight_kg), done: !!r.done });
    });
    /* Reihenfolge wie im Plan (log.js), sonst nach Block/Position der Einheit */
    order.sort(function (a, c) {
      var ia = ORDER[a], ic = ORDER[c];
      if (ia != null && ic != null) return ia - ic;
      if (ia != null) return -1;
      if (ic != null) return 1;
      return naturalCmp(a, c);
    });
    return order.map(function (b) {
      var ex = map[b];
      ex.sets.sort(function (a, c) { return a.no - c.no; });
      ex.check = ex.sets.every(function (s) { return s.reps == null && s.kg == null; });
      return ex;
    });
  }

  function setsText(ex) {
    if (ex.check) return ex.sets.some(function (s) { return s.done; }) ? "erledigt" : "";
    var used = ex.sets.filter(function (s) { return s.reps != null || s.kg != null; });
    var same = used.length > 1 && used.every(function (s) { return s.reps === used[0].reps && s.kg === used[0].kg; });
    if (same) {
      return used.length + (used[0].reps != null ? " × " + used[0].reps : " Sätze") +
        (used[0].kg != null ? " · " + fmtNum(used[0].kg) + " kg" : " Wdh.");
    }
    return used
      .map(function (s) {
        var t = s.reps != null ? String(s.reps) : "";
        if (s.kg != null) t += (t ? " × " : "") + fmtNum(s.kg) + " kg";
        return t;
      })
      .join(" · ") + (ex.sets.some(function (s) { return s.kg != null; }) ? "" : " Wdh.");
  }

  function exListHtml(list, accountId) {
    if (!list.length) return '<p class="kt__empty">Keine Übungen gespeichert.</p>';
    return (
      '<ul class="kt__ex">' +
      list.map(function (ex) {
        return (
          '<li class="kt__row"><span class="kt__row-copy"><span class="kt__name">' + esc(ex.name) +
          '</span><span class="kt__sets">' + esc(setsText(ex)) + "</span></span>" +
          (ex.check
            ? ""
            : '<button type="button" class="kt-chart-btn" data-kt-chart="' + esc(ex.name) +
              '" data-kt-who="' + esc(accountId) + '" aria-label="Verlauf ' + esc(ex.name) + '">' + CHART_SVG + "</button>") +
          "</li>"
        );
      }).join("") +
      "</ul>"
    );
  }

  function onChartClick(e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-kt-chart]") : null;
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    openChart(b.getAttribute("data-kt-chart"), b.getAttribute("data-kt-who") || host.me());
  }

  /* ---------- Plus: Liste mit Datumsfilter ---------- */
  function mount(el, force) {
    if (!el || !host) return;
    ensureCss();
    if (!el.dataset.ktReady) {
      el.dataset.ktReady = "1";
      el.className = "kt";
      el.innerHTML =
        '<div class="kt__filter"><label>Von<input type="date" data-kt-from></label>' +
        '<label>Bis<input type="date" data-kt-to></label></div><div data-kt-list></div>';
      el.addEventListener("change", function () { paintList(el, false); });
      el.addEventListener("click", onChartClick);
    }
    paintList(el, !!force);
  }

  function paintList(el, fresh) {
    var me = host.me();
    var box = el.querySelector("[data-kt-list]");
    if (!me) {
      box.innerHTML = '<p class="kt__empty">Bitte zuerst anmelden.</p>';
      return;
    }
    if (!box.innerHTML) box.innerHTML = '<p class="kt__empty">Lädt …</p>';
    var from = el.querySelector("[data-kt-from]").value;
    var to = el.querySelector("[data-kt-to]").value;
    Promise.all([
      loadLogs(me, fresh),
      host.rest(
        "events?user_id=eq." + encodeURIComponent(me) +
          "&category=in.(kraft,ausdauer)&select=starts_at,title&order=starts_at.desc&limit=500"
      ).catch(function () { return []; })
    ]).then(function (res) {
      var rows = res[0];
      var titles = {};
      (res[1] || []).forEach(function (ev) {
        var iso = new Date(ev.starts_at).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
        if (!titles[iso] && ev.title) titles[iso] = ev.title;
      });
      var dates = [];
      rows.forEach(function (r) {
        if (dates.indexOf(r.workout_date) === -1) dates.push(r.workout_date);
      });
      dates = dates.filter(function (d) { return (!from || d >= from) && (!to || d <= to); }).sort().reverse();
      if (!dates.length) {
        box.innerHTML = '<p class="kt__empty">' +
          (rows.length ? "Keine Workouts in diesem Zeitraum." : "Noch kein Workout gespeichert. Tippe heute auf Dein Kraft-Event und tracke Sätze und Gewichte.") +
          "</p>";
        return;
      }
      var open = {};
      box.querySelectorAll("details[open]").forEach(function (d) { open[d.getAttribute("data-kt-day")] = true; });
      box.innerHTML = dates.map(function (iso) {
        var list = exercisesOn(rows, iso);
        return (
          '<details class="kt__day" data-kt-day="' + esc(iso) + '"' + (open[iso] ? " open" : "") + ">" +
          '<summary><span class="kt__date">' + esc(fmtDate(iso, true)) + '</span><span class="kt__title">' +
          esc(titles[iso] || "Workout") + " · " + list.length + " Übungen</span></summary>" +
          exListHtml(list, me) +
          "</details>"
        );
      }).join("");
    }).catch(function () {
      box.innerHTML = '<p class="kt__empty">Workouts konnten nicht geladen werden.</p>';
    });
  }

  /* ---------- Bottom-Sheet ---------- */
  function sheet(html) {
    ensureCss();
    var wrap = document.createElement("div");
    wrap.className = "kt-sheet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = '<div class="kt-sheet__card">' + html +
      '<button type="button" class="kt-sheet__close" data-kt-close>Schließen</button></div>';
    function close() {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest("[data-kt-close]"))) close();
      else onChartClick(e);
    });
    document.body.appendChild(wrap);
    return wrap.firstChild;
  }

  /* Vergangenes Event: Übungen von Ersteller und (falls dabei) mir */
  function openDay(opts) {
    if (!host || !opts || !opts.iso) return;
    var people = (opts.people || []).filter(function (id, i, a) { return id && a.indexOf(id) === i; });
    var card = sheet(
      "<h2>" + esc(opts.title || "Workout") + '</h2><p class="kt-sheet__sub">' + esc(fmtDate(opts.iso, true)) +
        '</p><div data-kt-body><p class="kt__empty">Lädt …</p></div>'
    );
    var body = card.querySelector("[data-kt-body]");
    Promise.all(people.map(function (id) {
      return loadLogs(id, false).then(function (rows) {
        return { id: id, list: exercisesOn(rows, opts.iso) };
      }).catch(function () { return { id: id, list: [] }; });
    })).then(function (res) {
      var withData = res.filter(function (r) { return r.list.length; });
      if (!withData.length) {
        body.innerHTML = '<p class="kt__empty">Für diesen Tag sind keine Übungen gespeichert.</p>';
        return;
      }
      body.innerHTML = withData.map(function (r) {
        var who = withData.length > 1 || r.id !== host.me()
          ? '<p class="kt-sheet__who">' + esc(r.id === host.me() ? "Du" : (opts.names && opts.names[r.id]) || "Teilnehmer") + "</p>"
          : "";
        return who + exListHtml(r.list, r.id);
      }).join("");
    });
  }

  /* Verlauf: pro Training das beste Gewicht (oder beste Wiederholungen ohne Gewicht) */
  function series(rows, name) {
    var key = String(name || "").trim().toLowerCase();
    var byDate = {};
    var anyKg = false;
    rows.forEach(function (r) {
      var n = nameOf(r);
      if (!n || n.trim().toLowerCase() !== key) return;
      var kg = num(r.weight_kg);
      var reps = num(r.reps);
      if (kg != null) anyKg = true;
      var d = byDate[r.workout_date] || (byDate[r.workout_date] = { kg: null, reps: null });
      if (kg != null && (d.kg == null || kg > d.kg)) d.kg = kg;
      if (reps != null && (d.reps == null || reps > d.reps)) d.reps = reps;
    });
    var unit = anyKg ? "kg" : "Wdh.";
    var pts = Object.keys(byDate).sort().map(function (iso) {
      return { iso: iso, v: anyKg ? byDate[iso].kg : byDate[iso].reps };
    }).filter(function (p) { return p.v != null; });
    return { unit: unit, pts: pts };
  }

  function chartSvg(s) {
    var W = 320, H = 170, L = 34, R = 12, T = 14, B = 26;
    var vals = s.pts.map(function (p) { return p.v; });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    /* runde Achsenwerte: Schritt so, dass 2 bis 4 Abschnitte entstehen */
    var steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200];
    var st = steps[steps.length - 1], lo, hi;
    for (var k = 0; k < steps.length; k++) {
      var l = Math.floor(mn / steps[k]) * steps[k], h = Math.ceil(mx / steps[k]) * steps[k];
      if (h === l) { l = Math.max(0, l - steps[k]); h = h + steps[k]; }
      if ((h - l) / steps[k] <= 4) { st = steps[k]; lo = l; hi = h; break; }
    }
    if (lo == null) { lo = 0; hi = Math.ceil(mx / st) * st || st; }
    var ticks = [];
    for (var tv = lo; tv <= hi + 1e-9; tv += st) ticks.push(tv);
    var n = s.pts.length;
    function x(i) { return n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1); }
    function y(v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); }
    var g = "";
    ticks.forEach(function (v) {
      var yy = y(v).toFixed(1);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="rgba(42,33,24,.12)" stroke-width="1"/>' +
        '<text x="' + (L - 6) + '" y="' + yy + '" dy="4" text-anchor="end" font-size="10" fill="rgba(42,33,24,.6)">' + esc(fmtNum(v)) + "</text>";
    });
    g += '<text x="' + x(0) + '" y="' + (H - 6) + '" text-anchor="' + (n === 1 ? "middle" : "start") + '" font-size="10" fill="rgba(42,33,24,.6)">' + esc(fmtDate(s.pts[0].iso)) + "</text>";
    if (n > 1) g += '<text x="' + x(n - 1) + '" y="' + (H - 6) + '" text-anchor="end" font-size="10" fill="rgba(42,33,24,.6)">' + esc(fmtDate(s.pts[n - 1].iso)) + "</text>";
    var d = s.pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1); }).join(" ");
    if (n > 1) g += '<path d="' + d + '" fill="none" stroke="#2A2118" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    s.pts.forEach(function (p, i) {
      g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="4" fill="#2A2118" stroke="#F3EEE4" stroke-width="2" data-kt-pt="' + i + '"/>' +
        '<rect x="' + (x(i) - 14).toFixed(1) + '" y="' + T + '" width="28" height="' + (H - T - B) + '" fill="transparent" data-kt-pt="' + i + '"/>';
    });
    return '<svg class="kt-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Verlauf">' + g + "</svg>";
  }

  function openChart(name, accountId) {
    if (!host || !name) return;
    var card = sheet(
      "<h2>" + esc(name) + '</h2><p class="kt-sheet__sub">Verlauf</p><div data-kt-body><p class="kt__empty">Lädt …</p></div>'
    );
    var body = card.querySelector("[data-kt-body]");
    loadLogs(accountId || host.me(), true).then(function (rows) {
      var s = series(rows, name);
      if (!s.pts.length) {
        body.innerHTML = '<p class="kt__empty">Noch keine Werte für diese Übung gespeichert.</p>';
        return;
      }
      var last = s.pts[s.pts.length - 1];
      var label = s.unit === "kg" ? "Bestes Gewicht pro Training" : "Beste Wiederholungen pro Training";
      body.innerHTML =
        '<p class="kt-chart__pick" data-kt-pick>' + esc(fmtDate(last.iso, true) + " · " + fmtNum(last.v) + " " + s.unit) + "</p>" +
        chartSvg(s) +
        '<p class="kt-sheet__sub">' + esc(label) + "</p>" +
        '<table class="kt-table"><tbody>' +
        s.pts.slice().reverse().slice(0, 12).map(function (p) {
          return "<tr><td>" + esc(fmtDate(p.iso, true)) + "</td><td>" + esc(fmtNum(p.v) + " " + s.unit) + "</td></tr>";
        }).join("") +
        "</tbody></table>";
      var pick = body.querySelector("[data-kt-pick]");
      body.querySelector(".kt-chart").addEventListener("click", function (e) {
        var t = e.target.closest ? e.target.closest("[data-kt-pt]") : null;
        if (!t) return;
        var p = s.pts[+t.getAttribute("data-kt-pt")];
        pick.textContent = fmtDate(p.iso, true) + " · " + fmtNum(p.v) + " " + s.unit;
      });
    }).catch(function () {
      body.innerHTML = '<p class="kt__empty">Verlauf konnte nicht geladen werden.</p>';
    });
  }

  function init(h) {
    host = h;
    try {
      ((global.NatalyaLog || global.Log || {}).EXERCISES || []).forEach(function (ex) {
        if (ex && ex.id && !STATIC[ex.id]) STATIC[ex.id] = ex.name;
      });
    } catch (e) {}
  }

  /* Basis-Plan direkt beim Laden merken (Log.useExercises ersetzt die Liste später) */
  try {
    ((global.NatalyaLog || global.Log || {}).EXERCISES || []).forEach(function (ex, i) {
      if (ex && ex.id) {
        STATIC[ex.id] = ex.name;
        ORDER[ex.id] = i;
      }
    });
  } catch (e0) {}

  global.GoKraftTracking = {
    init: init,
    mount: mount,
    openDay: openDay,
    openChart: openChart,
    chartIcon: CHART_SVG,
    invalidate: function () { cache = {}; }
  };
})(window);
