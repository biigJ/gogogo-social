/* pt-calendar.js — Personal Training im App-Kalender (go-pt-kalender.sql)
 *
 *   GoPtCal.init({ rest, me(), toast(msg), onChange() })
 *   GoPtCal.open({ coachId, coachName, mode: "client" | "coach", day })
 *
 * Monat: geblockte Tage hell schattiert (vom Coach gesperrt oder alle Stunden belegt).
 * Tag: 7 bis 21 Uhr, eine Zeile je Stunde (wie „Tage bearbeiten“). Belegt = hellgrau, frei = weiß.
 *   Coachee: freie Stunde antippen → Personal Training buchen (go_pt_sessions, proposed), Coach bekommt eine Meldung am Herz.
 *   Coach:   freie Stunde → eigenes Event eintragen; Anfrage → bestätigen oder absagen; Tag sperren / freigeben.
 * Belegte Stunden kommen für Coachees nur als Zeit (rpc go_coach_busy), ohne Titel.
 */
(function (global) {
  "use strict";

  var host = null;
  var FROM_H = 7, TO_H = 21; /* letzte buchbare Stunde beginnt um 20:00 */
  var MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  var WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  var st = null;
  var GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  var WEEK = [1, 2, 3, 4, 5, 6, 0];
  var WD_LONG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  var CSS =
    ".gpt{position:fixed;inset:0;z-index:10040;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,16,12,.42)}" +
    ".gpt__card{width:100%;max-width:440px;max-height:88vh;max-height:88dvh;overflow-y:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px;padding:14px 16px 16px;font-family:Inter,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.25)}" +
    ".gpt__bar{display:grid;grid-template-columns:40px 1fr 40px;align-items:center;margin:0 0 10px}" +
    ".gpt__bar h2{margin:0;text-align:center;font:600 20px/1.2 'Playfair Display',Georgia,serif !important}" +
    ".gpt__ic{width:40px;height:40px;border:0;background:transparent;color:#2A2118;font-size:22px;cursor:pointer;display:grid;place-items:center;padding:0}" +
    ".gpt__ic[disabled]{opacity:.25;cursor:default}" +
    ".gpt__sub{margin:-4px 0 10px;text-align:center;font-size:13px;color:rgba(42,33,24,.65)}" +
    ".gpt__wd,.gpt__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}" +
    ".gpt__wd span{text-align:center;font-size:11px;font-weight:700;letter-spacing:.04em;opacity:.55;padding:2px 0 4px}" +
    ".gpt__day{aspect-ratio:1;border:0;border-radius:10px;background:#fff;color:#2A2118;font:600 14px Inter,sans-serif;cursor:pointer;position:relative}" +
    ".gpt__day.is-empty{background:transparent;cursor:default}" +
    ".gpt__day.is-past{background:transparent;opacity:.3;cursor:default}" +
    ".gpt__day.is-blocked{background:#E4DDD0;color:rgba(42,33,24,.55)}" +
    ".gpt__day.is-today{box-shadow:inset 0 0 0 1.5px #2A2118}" +
    ".gpt__day i{position:absolute;left:50%;bottom:5px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#2A2118}" +
    ".gpt__legend{display:flex;gap:14px;justify-content:center;margin:10px 0 0;font-size:12px;color:rgba(42,33,24,.65)}" +
    ".gpt__legend b{display:inline-block;width:12px;height:12px;border-radius:4px;vertical-align:-2px;margin-right:5px;background:#fff;border:1px solid rgba(42,33,24,.2)}" +
    ".gpt__legend b.is-busy{background:#E4DDD0;border-color:#E4DDD0}" +
    ".gpt__rows{display:flex;flex-direction:column;gap:6px}" +
    ".gpt__row{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:0 14px;box-sizing:border-box;border:1px solid rgba(42,33,24,.12);border-radius:12px;background:#fff;color:#2A2118;font:inherit;text-align:left;cursor:pointer}" +
    ".gpt__row b{flex:none;width:48px;font-weight:700;font-variant-numeric:tabular-nums}" +
    ".gpt__row span{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".gpt__row.is-busy{background:#E4DDD0;border-color:#E4DDD0;color:rgba(42,33,24,.7)}" +
    ".gpt__row.is-busy.is-plain{cursor:default}" +
    ".gpt__row.is-mine{background:#2A2118;border-color:#2A2118;color:#F6F1E8}" +
    ".gpt__row.is-past{opacity:.4;cursor:default}" +
    ".gpt__bar.has-gear{grid-template-columns:40px 40px 1fr 40px 40px}" +
    ".gpt__bar.has-gear h2{font-size:19px !important;white-space:nowrap}" +
    ".gpt__gear svg{width:22px;height:22px;display:block}" +
    ".gpt__modes{display:flex;flex-direction:column;gap:6px;margin:0 0 14px}" +
    ".gpt__opt{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 14px;border-radius:12px;background:#fff;border:1px solid rgba(42,33,24,.12);font-size:15px;cursor:pointer}" +
    ".gpt__opt input,.gpt__hrow input{width:22px;height:22px;margin:0;accent-color:#2A2118;flex:none}" +
    ".gpt__hrow{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 12px;border-radius:12px;background:#fff;border:1px solid rgba(42,33,24,.12);margin:0 0 6px}" +
    ".gpt__hrow b{flex:1;min-width:0;font-weight:600}" +
    ".gpt__hrow select{flex:none;font:inherit;font-variant-numeric:tabular-nums;padding:6px 6px;border-radius:8px;border:1px solid rgba(42,33,24,.2);background:#F3EEE4;color:#2A2118}" +
    ".gpt__hrow i{display:none;font-style:normal;font-size:14px;color:rgba(42,33,24,.5)}" +
    ".gpt__hrow.is-off select,.gpt__hrow.is-off span{display:none}" +
    ".gpt__hrow.is-off i{display:inline}" +
    ".gpt__hrow.is-off b{opacity:.45}" +
    ".gpt__sec{margin:16px 0 6px;font:700 12px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:rgba(42,33,24,.6)}" +
    ".gpt__info{margin:6px 2px 0;font-size:13px;color:rgba(42,33,24,.65)}" +
    ".gpt__link{border:0;background:none;padding:0;font:inherit;color:#2A2118;text-decoration:underline;cursor:pointer}" +
    ".gpt__btn2{display:block;width:100%;min-height:46px;border-radius:999px;border:1.5px solid #2A2118;background:transparent;color:#2A2118;font:600 15px Inter,sans-serif;cursor:pointer}" +
    ".gpt__save{display:block;width:100%;min-height:48px;margin:12px 0 0;border:0;border-radius:999px;background:#2A2118;color:#F6F1E8;font:600 15px Inter,sans-serif;cursor:pointer}" +
    ".gpt__block{display:block;margin:12px auto 0;border:0;background:none;color:#2A2118;font:600 14px Inter,sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}";

  function ensureCss() {
    if (document.getElementById("gpt-css")) return;
    var s = document.createElement("style");
    s.id = "gpt-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function me() { return host && host.me ? String(host.me() || "") : ""; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoOf(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function todayIso() { return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }); }
  function berlinDay(ts) { return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }); }
  function berlinHour(ts) { return Number(new Date(ts).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Berlin" })); }
  /* Berliner Zeit → ISO mit Offset (Sommer/Winter) */
  function berlinIso(iso, h) {
    var probe = new Date(iso + "T12:00:00Z");
    var off = "+01:00";
    try {
      var name = probe.toLocaleString("en-US", { timeZone: "Europe/Berlin", timeZoneName: "shortOffset" });
      var m = name.match(/GMT([+-]\d+)/);
      if (m) off = (Number(m[1]) < 0 ? "-" : "+") + pad(Math.abs(Number(m[1]))) + ":00";
    } catch (e) {}
    return iso + "T" + pad(h) + ":00:00" + off;
  }
  function longDay(iso) {
    var d = new Date(iso + "T12:00:00");
    return WD[d.getDay()] + " " + d.getDate() + ". " + MONTHS[d.getMonth()];
  }
  function shortDay(iso) {
    var d = new Date(iso + "T12:00:00");
    return WD[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1) + ".";
  }

  /* ---------- Daten ---------- */
  function loadMonth() {
    var y = st.y, m = st.m;
    var from = berlinIso(isoOf(y, m, 1), 0);
    var last = new Date(y, m + 1, 0).getDate();
    var to = berlinIso(isoOf(y, m, last), 23);
    var coach = encodeURIComponent(st.coachId);
    var jobs = [
      host.rest("rpc/go_coach_busy", { method: "POST", body: { p_coach: st.coachId, p_from: from, p_to: to } }).catch(function () { return []; }),
      host.rest("go_coach_blocked_days?coach_id=eq." + coach + "&day=gte." + isoOf(y, m, 1) + "&day=lte." + isoOf(y, m, last) + "&select=day").catch(function () { return []; }),
      host.rest("go_coach_hours?coach_id=eq." + coach + "&select=mode,hours").catch(function () { return []; })
    ];
    if (st.mode === "coach") {
      jobs.push(host.rest("events?user_id=eq." + coach + "&starts_at=gte." + encodeURIComponent(from) + "&starts_at=lte." + encodeURIComponent(to) +
        "&status=neq.ausgefallen&select=id,title,starts_at,item_type&limit=500").catch(function () { return []; }));
      jobs.push(host.rest("go_pt_sessions?session_at=gte." + encodeURIComponent(from) + "&session_at=lte." + encodeURIComponent(to) +
        "&status=in.(proposed,confirmed)&select=id,session_at,status,booking_id,go_pt_bookings!inner(client_id,coach_id)&go_pt_bookings.coach_id=eq." + coach + "&limit=500").catch(function () { return []; }));
    } else {
      jobs.push(Promise.resolve([]));
      jobs.push(host.rest("go_pt_sessions?session_at=gte." + encodeURIComponent(from) + "&session_at=lte." + encodeURIComponent(to) +
        "&status=in.(proposed,confirmed)&select=id,session_at,status,booking_id,go_pt_bookings!inner(client_id,coach_id)&go_pt_bookings.client_id=eq." + encodeURIComponent(me()) +
        "&go_pt_bookings.coach_id=eq." + coach + "&limit=200").catch(function () { return []; }));
    }
    return Promise.all(jobs).then(function (r) {
      st.hours = (r.splice(2, 1)[0] || [])[0] || null;
      st.busy = {};
      st.blocked = {};
      st.detail = {};
      function slot(day, h) { return (st.detail[day] = st.detail[day] || {})[h] = (st.detail[day] || {})[h] || {}; }
      (r[0] || []).forEach(function (b) {
        var day = berlinDay(b.starts_at), h = berlinHour(b.starts_at);
        (st.busy[day] = st.busy[day] || {})[h] = true;
      });
      (r[1] || []).forEach(function (b) { st.blocked[String(b.day).slice(0, 10)] = true; });
      (r[2] || []).forEach(function (e) {
        if (e.item_type === "nutrition_log") return;
        var day = berlinDay(e.starts_at), h = berlinHour(e.starts_at);
        var s = slot(day, h);
        s.event = e;
      });
      var people = [];
      (r[3] || []).forEach(function (x) {
        var day = berlinDay(x.session_at), h = berlinHour(x.session_at);
        var s = slot(day, h);
        s.session = x;
        var b = x.go_pt_bookings || {};
        if (b.client_id) people.push(String(b.client_id));
      });
      if (st.mode === "coach" && people.length) {
        return host.rest("go_accounts?id=in.(" + people.join(",") + ")&select=id,name,nickname").catch(function () { return []; }).then(function (rows) {
          st.names = st.names || {};
          (rows || []).forEach(function (p) { st.names[String(p.id)] = String(p.nickname || p.name || "Coachee").split(" ")[0]; });
        });
      }
    });
  }
  /* Verfügbare Zeiten (go-pt-zeiten.sql). Ohne Eintrag: 7 bis 21 Uhr */
  function range(iso) {
    var hrs = st.hours;
    if (!hrs) return [FROM_H, TO_H];
    if (hrs.mode === "weekday") {
      var r = ((hrs.hours || {}).days || {})[String(new Date(iso + "T12:00:00").getDay())];
      return r && r.length === 2 ? r : null;
    }
    var d = (hrs.hours || {}).daily;
    return d && d.length === 2 ? d : [FROM_H, TO_H];
  }
  function avail(iso, h) {
    var r = range(iso);
    return !!r && h >= r[0] && h < r[1];
  }
  function freeCount(day) {
    var b = st.busy[day] || {};
    var n = 0;
    for (var h = FROM_H; h < TO_H; h++) if (!b[h] && avail(day, h)) n++;
    return n;
  }

  /* ---------- Darstellung ---------- */
  function shell(inner) {
    var wrap = document.querySelector(".gpt");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "gpt";
      wrap.addEventListener("click", onClick);
      wrap.addEventListener("change", onChange);
      document.body.appendChild(wrap);
    }
    wrap.innerHTML = '<div class="gpt__card" role="dialog" aria-modal="true">' + inner + "</div>";
  }
  function close() {
    var w = document.querySelector(".gpt");
    if (w) w.remove();
    st = null;
  }
  function paintMonth() {
    var y = st.y, m = st.m;
    var first = new Date(y, m, 1);
    var lead = (first.getDay() + 6) % 7;
    var days = new Date(y, m + 1, 0).getDate();
    var t = todayIso();
    var nowMonth = new Date(t + "T12:00:00");
    var atStart = y === nowMonth.getFullYear() && m === nowMonth.getMonth();
    var cells = "";
    for (var i = 0; i < lead; i++) cells += '<span class="gpt__day is-empty"></span>';
    for (var d = 1; d <= days; d++) {
      var iso = isoOf(y, m, d);
      var past = iso < t;
      var full = freeCount(iso) === 0;
      var blocked = !!st.blocked[iso] || full || !!holidayOf(iso);
      var mineDot = false;
      var det = st.detail[iso] || {};
      Object.keys(det).forEach(function (h) { if (det[h].session) mineDot = true; });
      cells += '<button type="button" class="gpt__day' + (past ? " is-past" : "") + (blocked && !past ? " is-blocked" : "") + (iso === t ? " is-today" : "") +
        '" data-gpt-day="' + iso + '"' + (past ? " disabled" : "") + ">" + d + (mineDot && !past ? "<i></i>" : "") + "</button>";
    }
    shell(
      '<div class="gpt__bar' + (st.mode === "coach" ? " has-gear" : "") + '">' + (st.mode === "coach" ? "<span></span>" : "") +
      '<button type="button" class="gpt__ic" data-gpt-prev' + (atStart ? " disabled" : "") + ' aria-label="Vorheriger Monat">‹</button>' +
      "<h2>" + MONTHS[m] + " " + y + "</h2>" +
      '<button type="button" class="gpt__ic" data-gpt-next aria-label="Nächster Monat">›</button>' +
      (st.mode === "coach" ? '<button type="button" class="gpt__ic gpt__gear" data-gpt-gear aria-label="Verfügbare Zeiten">' + GEAR + "</button>" : "") + "</div>" +
      (st.mode === "coach" ? "" : '<p class="gpt__sub">Personal Training bei ' + esc(st.coachName || "Deinem Coach") + "</p>") +
      '<div class="gpt__wd"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div>' +
      '<div class="gpt__grid">' + cells + "</div>" +
      '<div class="gpt__legend"><span><b></b>frei</span><span><b class="is-busy"></b>geblockt</span></div>' +
      '<button type="button" class="gpt__block" data-gpt-close>Schließen</button>'
    );
  }
  function paintDay() {
    var iso = st.day;
    var t = todayIso();
    var nowH = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Berlin" }));
    var hol = holidayOf(iso);
    var blocked = !!st.blocked[iso] || !!hol;
    var rows = "";
    for (var h = FROM_H; h < TO_H; h++) {
      var busy = !!(st.busy[iso] || {})[h];
      var det = (st.detail[iso] || {})[h] || {};
      var past = iso < t || (iso === t && h <= nowH);
      var label = "frei", cls = "";
      if (det.session) {
        var b = det.session.go_pt_bookings || {};
        if (st.mode === "coach") {
          label = "PT " + (st.names && st.names[String(b.client_id)] || "Coachee") + (det.session.status === "proposed" ? " · Anfrage" : " · bestätigt");
          cls = " is-busy";
        } else {
          label = "Dein Termin" + (det.session.status === "proposed" ? " · angefragt" : " · bestätigt");
          cls = " is-mine";
        }
      } else if (busy) {
        label = st.mode === "coach" && det.event ? String(det.event.title || "Event") : "belegt";
        cls = " is-busy" + (st.mode === "coach" ? "" : " is-plain");
      } else if (blocked) {
        label = hol || "gesperrt";
        cls = " is-busy is-plain";
      } else if (!avail(iso, h)) {
        label = "nicht verfügbar";
        cls = " is-busy" + (st.mode === "coach" ? "" : " is-plain");
      }
      rows += '<button type="button" class="gpt__row' + cls + (past ? " is-past" : "") + '" data-gpt-h="' + h + '"' + (past ? " disabled" : "") + "><b>" + pad(h) + ":00</b><span>" + esc(label) + "</span></button>";
    }
    shell(
      '<div class="gpt__bar"><button type="button" class="gpt__ic" data-gpt-back aria-label="Zurück">‹</button>' +
      "<h2>" + esc(longDay(iso)) + "</h2><span></span></div>" +
      '<p class="gpt__sub">' + (st.mode === "coach" ? "Frei antippen: eigenes Event eintragen" : "Freie Stunde antippen, um zu buchen") + "</p>" +
      '<div class="gpt__rows">' + rows + "</div>" +
      (st.mode === "coach" ? (hol ? '<p class="gpt__info" style="text-align:center;margin-top:12px">' + esc(hol) + ": gesperrt (Zahnrad → Feiertage)</p>" : '<button type="button" class="gpt__block" data-gpt-toggle>' + (blocked ? "Tag freigeben" : "Tag sperren") + "</button>") : "")
    );
  }

  /* ---------- Feiertage Berlin (berechnet, gilt für jedes Jahr) ---------- */
  var HOL_CACHE = {};
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(y, mo - 1, da));
  }
  function holidays(y) {
    if (HOL_CACHE[y]) return HOL_CACHE[y];
    var out = {};
    function fix(m, d, n) { out[y + "-" + pad(m) + "-" + pad(d)] = n; }
    function rel(days, n) { var t = new Date(easter(y).getTime() + days * 864e5); out[t.toISOString().slice(0, 10)] = n; }
    fix(1, 1, "Neujahr");
    if (y >= 2019) fix(3, 8, "Frauentag");
    rel(-2, "Karfreitag");
    rel(1, "Ostermontag");
    fix(5, 1, "Tag der Arbeit");
    rel(39, "Christi Himmelfahrt");
    rel(50, "Pfingstmontag");
    fix(10, 3, "Tag der Deutschen Einheit");
    fix(12, 25, "1. Weihnachtstag");
    fix(12, 26, "2. Weihnachtstag");
    return (HOL_CACHE[y] = out);
  }
  function holidaysOn() { return !(st.hours && st.hours.hours && st.hours.hours.holidays === false); }
  function holidayOf(iso) { return holidaysOn() ? holidays(Number(iso.slice(0, 4)))[iso] || "" : ""; }

  /* ---------- .ics-Import: nur Zeiträume als Block, keine Titel ---------- */
  function tzOffset(ms, tz) {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
  }
  function zoned(c, tz) {
    var guess = Date.UTC(c.y, c.mo - 1, c.d, c.h || 0, c.mi || 0, c.s || 0);
    try {
      var t = guess - tzOffset(guess, tz);
      return guess - tzOffset(t, tz);
    } catch (e) {
      return tz === "Europe/Berlin" ? guess - 36e5 : zoned(c, "Europe/Berlin");
    }
  }
  function icsDate(val, params) {
    var m = String(val || "").match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    var c = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
    var tz = (params.TZID || "Europe/Berlin").replace(/^"|"$/g, "");
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch (e) { tz = "Europe/Berlin"; }
    return { c: c, allDay: !m[4] || params.VALUE === "DATE", utc: !!m[7], tz: m[7] ? "UTC" : tz };
  }
  function toMs(c, d) { return d.allDay ? zoned({ y: c.y, mo: c.mo, d: c.d }, "Europe/Berlin") : d.utc ? Date.UTC(c.y, c.mo - 1, c.d, c.h, c.mi, c.s) : zoned(c, d.tz); }
  function addDays(c, n) {
    var t = new Date(Date.UTC(c.y, c.mo - 1, c.d + n));
    return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: c.h, mi: c.mi, s: c.s };
  }
  function dow(c) { return new Date(Date.UTC(c.y, c.mo - 1, c.d)).getUTCDay(); }
  function parseIcs(text, fromMs, toMs_) {
    text = String(text || "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
    var evs = [];
    text.split("BEGIN:VEVENT").slice(1).forEach(function (chunk) {
      var body = chunk.split("END:VEVENT")[0];
      var ev = { ex: [] };
      body.split("\n").forEach(function (line) {
        var i = line.indexOf(":");
        if (i < 0) return;
        var head = line.slice(0, i).split(";"), val = line.slice(i + 1).trim(), name = head[0].toUpperCase(), params = {};
        head.slice(1).forEach(function (p) { var kv = p.split("="); params[kv[0].toUpperCase()] = kv.slice(1).join("="); });
        if (name === "DTSTART") ev.start = icsDate(val, params);
        else if (name === "DTEND") ev.end = icsDate(val, params);
        else if (name === "DURATION") ev.dur = val;
        else if (name === "RRULE") ev.rrule = val;
        else if (name === "EXDATE") val.split(",").forEach(function (v) { var d = icsDate(v, params); if (d) ev.ex.push(toMs(d.c, d)); });
        else if (name === "RECURRENCE-ID") { var r = icsDate(val, params); if (r) ev.recId = toMs(r.c, r); }
        else if (name === "UID") ev.uid = val;
        else if (name === "STATUS") ev.status = val.toUpperCase();
        else if (name === "TRANSP") ev.transp = val.toUpperCase();
      });
      if (ev.start) evs.push(ev);
    });
    /* geänderte Einzeltermine ersetzen den Termin der Serie */
    evs.forEach(function (e) {
      if (e.recId == null) return;
      evs.forEach(function (m) { if (m !== e && m.uid === e.uid && m.recId == null) m.ex.push(e.recId); });
    });
    var out = [];
    var WDK = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    evs.forEach(function (e) {
      if (e.status === "CANCELLED" || e.transp === "TRANSPARENT") return;
      var s0 = e.start, sMs = toMs(s0.c, s0), len;
      if (e.end) len = toMs(e.end.c, e.end) - sMs;
      else if (e.dur) {
        var dm = e.dur.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/) || [];
        len = ((+dm[1] || 0) * 7 * 864e5) + ((+dm[2] || 0) * 864e5) + ((+dm[3] || 0) * 36e5) + ((+dm[4] || 0) * 6e4);
      } else len = s0.allDay ? 864e5 : 36e5;
      if (!(len > 0)) len = 30 * 6e4;
      var ex = {};
      e.ex.forEach(function (x) { ex[x] = 1; });
      function push(c) {
        var a = toMs(c, s0), b = a + len;
        if (s0.allDay) b = toMs(addDays(c, Math.max(1, Math.round(len / 864e5))), s0);
        if (ex[a] || b <= fromMs || a >= toMs_) return;
        out.push([a, b]);
      }
      if (!e.rrule) { push(s0.c); return; }
      var r = {};
      e.rrule.split(";").forEach(function (p) { var kv = p.split("="); r[kv[0].toUpperCase()] = kv[1] || ""; });
      var freq = r.FREQ, iv = Math.max(1, +r.INTERVAL || 1), count = +r.COUNT || 0, n = 0;
      var until = r.UNTIL ? (function () { var u = icsDate(r.UNTIL, {}); return u ? toMs(u.c, u) + (u.allDay ? 864e5 - 1 : 0) : Infinity; })() : Infinity;
      var byday = (r.BYDAY || "").split(",").filter(Boolean).map(function (x) { var m = x.match(/^([+-]?\d+)?([A-Z]{2})$/); return m ? { n: +(m[1] || 0), wd: WDK[m[2]] } : null; }).filter(Boolean);
      var bymd = (r.BYMONTHDAY || "").split(",").filter(Boolean).map(Number);
      function emit(c) {
        var a = toMs(c, s0);
        if (a < sMs) return true;
        if (a > until || a >= toMs_ || (count && n >= count)) return false;
        n++;
        push(c);
        return true;
      }
      var guard = 0, go = true, cur = s0.c;
      while (go && guard++ < 3000) {
        if (freq === "DAILY") { go = emit(cur); cur = addDays(cur, iv); }
        else if (freq === "WEEKLY") {
          var mon = addDays(cur, -((dow(cur) + 6) % 7));
          var wds = byday.length ? byday.map(function (b) { return b.wd; }) : [dow(s0.c)];
          wds.sort(function (a, b) { return ((a + 6) % 7) - ((b + 6) % 7); });
          for (var k = 0; k < wds.length && go; k++) go = emit(addDays(mon, (wds[k] + 6) % 7));
          cur = addDays(mon, 7 * iv);
        } else if (freq === "MONTHLY" || freq === "YEARLY") {
          var days = [];
          var dim = new Date(Date.UTC(cur.y, cur.mo, 0)).getUTCDate();
          if (freq === "MONTHLY" && byday.length) {
            byday.forEach(function (b) {
              var hits = [];
              for (var dd = 1; dd <= dim; dd++) if (dow({ y: cur.y, mo: cur.mo, d: dd }) === b.wd) hits.push(dd);
              if (!b.n) days = days.concat(hits); else { var hh = b.n > 0 ? hits[b.n - 1] : hits[hits.length + b.n]; if (hh) days.push(hh); }
            });
          } else if (freq === "MONTHLY" && bymd.length) bymd.forEach(function (x) { var dd = x < 0 ? dim + x + 1 : x; if (dd >= 1 && dd <= dim) days.push(dd); });
          else if (s0.c.d <= dim) days.push(s0.c.d);
          days.sort(function (a, b) { return a - b; });
          for (var j = 0; j < days.length && go; j++) go = emit({ y: cur.y, mo: cur.mo, d: days[j], h: s0.c.h, mi: s0.c.mi, s: s0.c.s });
          var step = freq === "MONTHLY" ? iv : 12 * iv, mo = cur.mo - 1 + step;
          cur = { y: cur.y + Math.floor(mo / 12), mo: (mo % 12) + 1, d: 1, h: s0.c.h, mi: s0.c.mi, s: s0.c.s };
        } else { push(s0.c); go = false; }
      }
    });
    /* doppelte und überlappende Blöcke zusammenfassen */
    out.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    out.forEach(function (x) {
      var last = merged[merged.length - 1];
      if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
      else merged.push(x.slice());
    });
    return merged;
  }
  function importIcs() {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".ics,text/calendar";
    inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var now = new Date(todayIso() + "T00:00:00Z").getTime() - 2 * 36e5;
        var blocks = parseIcs(String(rd.result || ""), now, now + 366 * 864e5);
        if (!blocks.length) { GoDialog.alert("In der Datei sind keine kommenden Termine."); return; }
        GoDialog.confirm(blocks.length + " Blöcke importieren?", { body: "Nur die Zeiten werden blockiert, Titel und Details nicht. Ein neuer Import ersetzt den alten. Berücksichtigt werden die nächsten 12 Monate.", ok: "Importieren", cancel: "Abbrechen" }).then(function (yes) {
          if (!yes) return;
          var rows = blocks.map(function (b) { return { coach_id: me(), starts_at: new Date(b[0]).toISOString(), ends_at: new Date(b[1]).toISOString(), source: "ics" }; });
          var job = host.rest("go_coach_blocks?coach_id=eq." + encodeURIComponent(me()) + "&source=eq.ics", { method: "DELETE", prefer: "return=minimal" });
          for (var i = 0; i < rows.length; i += 400) (function (part) {
            job = job.then(function () { return host.rest("go_coach_blocks", { method: "POST", prefer: "return=minimal", body: part }); });
          })(rows.slice(i, i + 400));
          job.then(function () { st.icsCount = rows.length; host.toast(rows.length + " Blöcke importiert"); return loadMonth(); })
            .then(function () { if (st) paintHours(); })
            .catch(function () { GoDialog.alert("Import ging nicht (go-pt-blocks.sql in Supabase ausgeführt?)"); });
        });
      };
      rd.readAsText(f);
    });
    inp.click();
  }
  function clearIcs() {
    GoDialog.confirm("Importierte Blöcke entfernen?", { ok: "Entfernen", cancel: "Abbrechen" }).then(function (yes) {
      if (!yes) return;
      host.rest("go_coach_blocks?coach_id=eq." + encodeURIComponent(me()) + "&source=eq.ics", { method: "DELETE", prefer: "return=minimal" })
        .then(function () { st.icsCount = 0; return loadMonth(); })
        .then(function () { if (st) paintHours(); })
        .catch(function () { host.toast("Ging nicht (go-pt-blocks.sql?)"); });
    });
  }
  function loadIcsCount() {
    host.rest("go_coach_blocks?coach_id=eq." + encodeURIComponent(me()) + "&source=eq.ics&ends_at=gte." + encodeURIComponent(new Date().toISOString()) + "&select=id&limit=5000")
      .then(function (r) { if (!st) return; st.icsCount = (r || []).length; if (st.view === "hours") { var el = document.querySelector("[data-gpt-icsinfo]"); if (el) el.innerHTML = icsInfo(); } })
      .catch(function () { if (st) st.icsCount = -1; });
  }
  function icsInfo() {
    if (st.icsCount == null) return "";
    if (st.icsCount < 0) return "Import braucht go-pt-blocks.sql in Supabase.";
    if (!st.icsCount) return "Noch nichts importiert.";
    return st.icsCount + " Blöcke aus Deinem Kalender · <button type=\"button\" class=\"gpt__link\" data-gpt-icsclear>Entfernen</button>";
  }

  /* Zahnrad: verfügbare Zeiten täglich gleich oder je Wochentag (wie Calendly) */
  function hourSel(name, val) {
    var o = "";
    for (var h = 6; h <= 23; h++) o += '<option value="' + h + '"' + (h === val ? " selected" : "") + ">" + pad(h) + ":00</option>";
    return '<select data-gpt-sel="' + name + '" aria-label="' + (name.slice(-1) === "f" ? "von" : "bis") + '">' + o + "</select>";
  }
  function paintHours() {
    var cur = st.hours || { mode: "daily", hours: {} };
    var hrs = cur.hours || {};
    var daily = hrs.daily || [FROM_H, TO_H];
    var days = hrs.days || null;
    var rows = WEEK.map(function (wd) {
      var r = days ? days[String(wd)] : (wd === 0 || wd === 6 ? null : daily);
      var on = !!(r && r.length === 2);
      var v = on ? r : daily;
      return '<label class="gpt__hrow' + (on ? "" : " is-off") + '" data-gpt-wd="' + wd + '"><input type="checkbox" data-gpt-on' + (on ? " checked" : "") + "><b>" + WD_LONG[wd] + "</b>" +
        hourSel(wd + "f", v[0]) + "<span>–</span>" + hourSel(wd + "t", v[1]) + "<i>nicht verfügbar</i></label>";
    }).join("");
    var wk = cur.mode === "weekday";
    shell(
      '<div class="gpt__bar"><button type="button" class="gpt__ic" data-gpt-back aria-label="Zurück">‹</button><h2>Verfügbare Zeiten</h2><span></span></div>' +
      '<div class="gpt__modes">' +
      '<label class="gpt__opt"><input type="radio" name="gpt-mode" value="daily"' + (wk ? "" : " checked") + ">Täglich gleich</label>" +
      '<label class="gpt__opt"><input type="radio" name="gpt-mode" value="weekday"' + (wk ? " checked" : "") + ">Individuell pro Wochentag</label></div>" +
      '<div data-gpt-pane="daily"' + (wk ? " hidden" : "") + '><div class="gpt__hrow"><b>Mo bis So</b>' + hourSel("df", daily[0]) + "<span>–</span>" + hourSel("dt", daily[1]) + "</div></div>" +
      '<div data-gpt-pane="weekday"' + (wk ? "" : " hidden") + ">" + rows + "</div>" +
      '<label class="gpt__opt" style="margin-top:6px"><input type="checkbox" data-gpt-hol' + (hrs.holidays === false ? "" : " checked") + ">Feiertage in Berlin sperren</label>" +
      '<button type="button" class="gpt__save" data-gpt-save>Speichern</button>' +
      '<p class="gpt__sec">Kalender importieren</p>' +
      '<button type="button" class="gpt__btn2" data-gpt-ics>.ics-Datei wählen</button>' +
      '<p class="gpt__info" data-gpt-icsinfo>' + icsInfo() + "</p>" +
      '<p class="gpt__info">Termine werden nur als belegte Zeit eingetragen, ohne Titel. Export z. B. aus Google Kalender (Einstellungen → Exportieren) oder Apple Kalender (Ablage → Exportieren).</p>'
    );
    st.view = "hours";
    if (st.icsCount == null) loadIcsCount();
  }
  function onChange(e) {
    if (!st || st.view !== "hours") return;
    var t = e.target;
    var card = t.closest(".gpt__card");
    if (t.name === "gpt-mode") {
      card.querySelector('[data-gpt-pane="daily"]').hidden = t.value !== "daily";
      card.querySelector('[data-gpt-pane="weekday"]').hidden = t.value !== "weekday";
      return;
    }
    if (t.hasAttribute("data-gpt-on")) t.closest(".gpt__hrow").classList.toggle("is-off", !t.checked);
  }
  function saveHours() {
    var card = document.querySelector(".gpt__card");
    var mode = card.querySelector('[name="gpt-mode"]:checked').value;
    function val(n) { return Number(card.querySelector('[data-gpt-sel="' + n + '"]').value); }
    var hrs = { daily: [val("df"), val("dt")], days: {}, holidays: !!card.querySelector("[data-gpt-hol]").checked };
    WEEK.forEach(function (wd) {
      if (card.querySelector('[data-gpt-wd="' + wd + '"] [data-gpt-on]').checked) hrs.days[String(wd)] = [val(wd + "f"), val(wd + "t")];
    });
    var bad = hrs.daily[1] <= hrs.daily[0] && mode === "daily";
    Object.keys(hrs.days).forEach(function (k) { if (mode === "weekday" && hrs.days[k][1] <= hrs.days[k][0]) bad = true; });
    if (bad) { GoDialog.alert("„bis“ muss nach „von“ liegen."); return; }
    host.rest("go_coach_hours", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
      body: { coach_id: me(), mode: mode, hours: hrs, updated_at: new Date().toISOString() } })
      .then(function () { st.view = ""; return refresh("month"); })
      .catch(function () { host.toast("Speichern ging nicht (go-pt-zeiten.sql?)"); });
  }

  /* ---------- Aktionen ---------- */
  function refresh(view) {
    return loadMonth().then(function () { if (st) (view === "day" ? paintDay : paintMonth)(); });
  }
  function bookSlot(iso, h) {
    var who = st.coachName || "Deinem Coach";
    GoDialog.confirm("Personal Training buchen?", { body: shortDay(iso) + " um " + pad(h) + ":00 bei " + who + ". " + who + " bekommt eine Nachricht.", ok: "Buchen", cancel: "Abbrechen" }).then(function (yes) {
      if (!yes) return;
      var coach = encodeURIComponent(st.coachId);
      host.rest("go_pt_bookings?client_id=eq." + encodeURIComponent(me()) + "&coach_id=eq." + coach + "&status=neq.cancelled&select=id&order=created_at.desc&limit=1")
        .then(function (rows) {
          if (rows && rows[0]) return rows[0];
          return host.rest("go_pt_bookings", { method: "POST", prefer: "return=representation",
            body: { client_id: me(), coach_id: st.coachId, status: "accepted", package_label: "Einzeltermin" } })
            .then(function (r) { return Array.isArray(r) ? r[0] : r; });
        })
        .then(function (booking) {
          if (!booking || !booking.id) throw new Error("booking");
          return host.rest("go_pt_sessions", { method: "POST", prefer: "return=minimal",
            body: { booking_id: booking.id, session_at: berlinIso(iso, h), status: "proposed" } });
        })
        .then(function () {
          if (host.onChange) host.onChange();
          return refresh("day");
        })
        .then(function () { GoDialog.alert("Gebucht. " + who + " ist informiert und bestätigt den Termin."); })
        .catch(function () { host.toast("Buchen ging nicht (go-pt-kalender.sql?)"); });
    });
  }
  function coachSlot(iso, h, det) {
    if (det.session) {
      var s = det.session;
      var name = st.names && st.names[String((s.go_pt_bookings || {}).client_id)] || "Coachee";
      var opts = s.status === "proposed"
        ? [{ label: "Bestätigen", value: "confirmed" }, { label: "Absagen", value: "declined" }]
        : [{ label: "Absagen", value: "declined" }];
      GoDialog.choose("PT mit " + name + ", " + shortDay(iso) + " " + pad(h) + ":00", opts).then(function (v) {
        if (!v) return;
        /* Bestätigen legt das gemeinsame Event bei Coach und Coachee an, Absagen setzt es auf ausgefallen;
           beides meldet sich beim Coachee (go-pt-events.sql) */
        var job = v === "confirmed"
          ? host.rest("rpc/go_pt_confirm", { method: "POST", body: { p_session: s.id } })
          : host.rest("rpc/go_pt_action", { method: "POST", body: { p_session: s.id, p_action: "cancel" } });
        job.catch(function () {
          return host.rest("go_pt_sessions?id=eq." + encodeURIComponent(s.id), { method: "PATCH", prefer: "return=minimal", body: { status: v, updated_at: new Date().toISOString() } });
        })
          .then(function () { if (host.onChange) host.onChange(); return refresh("day"); })
          .catch(function () { host.toast("Ging gerade nicht"); });
      });
      return;
    }
    if (det.event) {
      GoDialog.alert(String(det.event.title || "Event") + " · " + shortDay(iso) + " " + pad(h) + ":00");
      return;
    }
    GoDialog.prompt("Event am " + shortDay(iso) + " um " + pad(h) + ":00", "").then(function (title) {
      title = String(title || "").trim();
      if (!title) return;
      host.rest("events", { method: "POST", prefer: "return=minimal",
        body: { user_id: me(), title: title.slice(0, 80), starts_at: berlinIso(iso, h), status: "geplant", visibility: "privat", category: "alternative", is_unplanned: true } })
        .then(function () { if (host.onChange) host.onChange(); return refresh("day"); })
        .catch(function () { host.toast("Eintragen ging nicht"); });
    });
  }
  function toggleBlock(iso) {
    var on = !st.blocked[iso];
    var job = on
      ? host.rest("go_coach_blocked_days", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { coach_id: me(), day: iso } })
      : host.rest("go_coach_blocked_days?coach_id=eq." + encodeURIComponent(me()) + "&day=eq." + iso, { method: "DELETE", prefer: "return=minimal" });
    job.then(function () { return refresh("day"); }).catch(function () { host.toast("Ging nicht (go-pt-kalender.sql?)"); });
  }

  function onClick(e) {
    if (!st) return;
    var t = e.target;
    if (t === e.currentTarget || t.closest("[data-gpt-close]")) { close(); return; }
    if (t.closest("[data-gpt-prev]")) { st.m--; if (st.m < 0) { st.m = 11; st.y--; } refresh("month"); return; }
    if (t.closest("[data-gpt-next]")) { st.m++; if (st.m > 11) { st.m = 0; st.y++; } refresh("month"); return; }
    if (t.closest("[data-gpt-back]")) { st.day = ""; st.view = ""; paintMonth(); return; }
    if (t.closest("[data-gpt-gear]")) { paintHours(); return; }
    if (t.closest("[data-gpt-save]")) { saveHours(); return; }
    if (t.closest("[data-gpt-ics]")) { importIcs(); return; }
    if (t.closest("[data-gpt-icsclear]")) { clearIcs(); return; }
    if (t.closest("[data-gpt-toggle]")) { toggleBlock(st.day); return; }
    var dayBtn = t.closest("[data-gpt-day]");
    if (dayBtn && !dayBtn.disabled) {
      var iso = dayBtn.getAttribute("data-gpt-day");
      if (st.mode === "client" && holidayOf(iso)) { GoDialog.alert(holidayOf(iso) + ": an Feiertagen gibt es kein Personal Training."); return; }
      if (st.mode === "client" && st.blocked[iso]) { GoDialog.alert((st.coachName || "Dein Coach") + " hat diesen Tag gesperrt."); return; }
      st.day = iso;
      paintDay();
      return;
    }
    var row = t.closest("[data-gpt-h]");
    if (row && !row.disabled) {
      var h = Number(row.getAttribute("data-gpt-h"));
      var det = (st.detail[st.day] || {})[h] || {};
      if (st.mode === "coach") { coachSlot(st.day, h, det); return; }
      if (det.session || (st.busy[st.day] || {})[h] || st.blocked[st.day] || holidayOf(st.day) || !avail(st.day, h)) return;
      bookSlot(st.day, h);
    }
  }

  function open(opts) {
    if (!host || !global.GoDialog || !opts || !opts.coachId) return;
    ensureCss();
    var start = opts.day || todayIso();
    var d = new Date(start + "T12:00:00");
    st = { coachId: String(opts.coachId), coachName: opts.coachName || "", mode: opts.mode === "coach" ? "coach" : "client",
      y: d.getFullYear(), m: d.getMonth(), day: opts.day || "", busy: {}, blocked: {}, detail: {}, names: {} };
    shell('<p class="gpt__sub" style="margin:20px 0">Lädt …</p>');
    refresh(opts.day ? "day" : "month");
  }

  global.GoPtCal = {
    init: function (h) { host = h; },
    _parseIcs: parseIcs,
    _holidays: holidays,
    open: open,
    close: close,
    shortDay: shortDay
  };
})(window);
