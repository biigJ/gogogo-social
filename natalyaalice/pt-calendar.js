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
      host.rest("go_coach_blocked_days?coach_id=eq." + coach + "&day=gte." + isoOf(y, m, 1) + "&day=lte." + isoOf(y, m, last) + "&select=day").catch(function () { return []; })
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
  function busyCount(day) {
    var b = st.busy[day] || {};
    var n = 0;
    for (var h = FROM_H; h < TO_H; h++) if (b[h]) n++;
    return n;
  }

  /* ---------- Darstellung ---------- */
  function shell(inner) {
    var wrap = document.querySelector(".gpt");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "gpt";
      wrap.addEventListener("click", onClick);
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
      var full = busyCount(iso) >= TO_H - FROM_H;
      var blocked = !!st.blocked[iso] || full;
      var mineDot = false;
      var det = st.detail[iso] || {};
      Object.keys(det).forEach(function (h) { if (det[h].session) mineDot = true; });
      cells += '<button type="button" class="gpt__day' + (past ? " is-past" : "") + (blocked && !past ? " is-blocked" : "") + (iso === t ? " is-today" : "") +
        '" data-gpt-day="' + iso + '"' + (past ? " disabled" : "") + ">" + d + (mineDot && !past ? "<i></i>" : "") + "</button>";
    }
    shell(
      '<div class="gpt__bar"><button type="button" class="gpt__ic" data-gpt-prev' + (atStart ? " disabled" : "") + ' aria-label="Vorheriger Monat">‹</button>' +
      "<h2>" + MONTHS[m] + " " + y + "</h2>" +
      '<button type="button" class="gpt__ic" data-gpt-next aria-label="Nächster Monat">›</button></div>' +
      '<p class="gpt__sub">' + (st.mode === "coach" ? "Dein Kalender für Personal Training" : "Personal Training bei " + esc(st.coachName || "Deinem Coach")) + "</p>" +
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
    var blocked = !!st.blocked[iso];
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
        label = "gesperrt";
        cls = " is-busy is-plain";
      }
      rows += '<button type="button" class="gpt__row' + cls + (past ? " is-past" : "") + '" data-gpt-h="' + h + '"' + (past ? " disabled" : "") + "><b>" + pad(h) + ":00</b><span>" + esc(label) + "</span></button>";
    }
    shell(
      '<div class="gpt__bar"><button type="button" class="gpt__ic" data-gpt-back aria-label="Zurück">‹</button>' +
      "<h2>" + esc(longDay(iso)) + "</h2><span></span></div>" +
      '<p class="gpt__sub">' + (st.mode === "coach" ? "Frei antippen: eigenes Event eintragen" : "Freie Stunde antippen, um zu buchen") + "</p>" +
      '<div class="gpt__rows">' + rows + "</div>" +
      (st.mode === "coach" ? '<button type="button" class="gpt__block" data-gpt-toggle>' + (blocked ? "Tag freigeben" : "Tag sperren") + "</button>" : "")
    );
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
        host.rest("go_pt_sessions?id=eq." + encodeURIComponent(s.id), { method: "PATCH", prefer: "return=minimal", body: { status: v, updated_at: new Date().toISOString() } })
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
    if (t.closest("[data-gpt-back]")) { st.day = ""; paintMonth(); return; }
    if (t.closest("[data-gpt-toggle]")) { toggleBlock(st.day); return; }
    var dayBtn = t.closest("[data-gpt-day]");
    if (dayBtn && !dayBtn.disabled) {
      var iso = dayBtn.getAttribute("data-gpt-day");
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
      if (det.session || (st.busy[st.day] || {})[h] || st.blocked[st.day]) return;
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
    open: open,
    close: close,
    shortDay: shortDay
  };
})(window);
