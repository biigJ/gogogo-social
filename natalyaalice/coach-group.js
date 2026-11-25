/* coach-group.js — Coach-Gruppe: Coach und seine Coachees (go-coach-gruppe.sql)
 *
 *   GoCoachGroup.init({ rest, me(), myName(), toast(msg), openProfile(person), onChange() })
 *   GoCoachGroup.render(el, { mode: "coach" | "client", coach: { id, name, photo_url } })
 *
 * Coach:    Coachees (alle, „offen“ markiert) mit Coach-Stempelkarte (Stempel, übrig, „bar bezahlt“ → neue Karte),
 *           Woche Mo bis So; + → Event anlegen und Coachees einladen; heutiges Event → QR zum Stempeln.
 * Coachee:  Haken „offen für Gruppentraining“, andere Coachees mit Haken, Woche mit den Einladungen des Coaches.
 * Stempelkarte des Coaches: go-coach-stempelkarte.sql (go_stamp_links kind 'coach').
 * Einladungen laufen über go_workout_invites (Herz in Aktuell, Annehmen = Zusage im Event).
 */
(function (global) {
  "use strict";

  var host = null;
  var DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  var DAYS_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  var CSS =
    ".gcg{margin:18px 0 0}" +
    ".gcg__h{margin:22px 0 8px;font:700 12px Inter,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:rgba(42,33,24,.6)}" +
    ".gcg__faces{display:flex;gap:10px;overflow-x:auto;padding:2px 0 4px;-webkit-overflow-scrolling:touch}" +
    ".gcg__face{flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;width:58px;padding:0;border:0;background:none;color:#2A2118;font:500 12px Inter,sans-serif;cursor:pointer}" +
    ".gcg__face span.gcg__img{position:relative;width:52px;height:52px;border-radius:50%;background:#E6DED0 center/cover no-repeat;display:grid;place-items:center;font-weight:700;font-size:18px}" +
    ".gcg__face.is-open span.gcg__img::after{content:'';position:absolute;right:0;bottom:2px;width:12px;height:12px;border-radius:50%;background:#2E9E5B;border:2px solid #F3EEE4}" +
    ".gcg__face em{font-style:normal;max-width:58px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".gcg__empty{margin:4px 0;font-size:14px;color:rgba(42,33,24,.65)}" +
    ".gcg__open{display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;border-radius:12px;background:#fff;border:1px solid rgba(42,33,24,.12);font-size:15px;cursor:pointer}" +
    ".gcg__open input{width:22px;height:22px;margin:0;accent-color:#2A2118;flex:none}" +
    ".gcg__wk{display:grid;grid-template-columns:40px 1fr 40px;align-items:center;margin:4px 0 8px}" +
    ".gcg__wk b{text-align:center;font:600 15px Inter,sans-serif}" +
    ".gcg__wk button{width:40px;height:40px;border:0;background:none;font-size:22px;color:#2A2118;cursor:pointer}" +
    ".gcg__wk button[disabled]{opacity:.25;cursor:default}" +
    ".gcg .wr-dayrow.is-past{opacity:.45}" +
    ".gcg .wr-dayrow.is-closed{background:#E4DDD0;border-color:#E4DDD0;border-style:solid}" +
    ".gcg__ce{display:grid;grid-template-columns:52px minmax(0,1fr);gap:12px;align-items:start;padding:12px 0;border-bottom:1px solid rgba(42,33,24,.12)}" +
    ".gcg__ce .gcg__face{width:52px}" +
    ".gcg__ce b{display:block;font-size:15px;margin:2px 0 6px}" +
    ".gcg__stamps{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;max-width:300px}" +
    ".gcg__stamps i{aspect-ratio:1;border-radius:50%;border:1.5px solid #2F5D50;box-sizing:border-box}" +
    ".gcg__stamps i.is-on{background:#2F5D50}" +
    ".gcg__cefoot{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;margin-top:6px;font-size:13px;color:rgba(42,33,24,.7)}" +
    ".gcg__link{border:0;background:none;padding:0;font:inherit;font-size:14px;font-weight:600;color:#2A2118;text-decoration:underline;text-underline-offset:3px;cursor:pointer}" +
    ".gcg__plus{width:32px;height:32px;border-radius:50%;border:1.5px solid rgba(42,33,24,.35);background:transparent;color:#2A2118;font:400 20px/1 Inter,sans-serif;cursor:pointer;align-self:center}";

  function ensureCss() {
    if (document.getElementById("gcg-css")) return;
    var s = document.createElement("style");
    s.id = "gcg-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function me() { return host && host.me ? String(host.me() || "") : ""; }
  function first(n) { return String(n || "").trim().split(" ")[0] || ""; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayIso() { return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dow(iso) { return new Date(iso + "T12:00:00Z").getUTCDay(); }
  function berlinDay(ts) { return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }); }
  function berlinTime(ts) { return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }); }
  function offset(iso) {
    try {
      var name = new Date(iso + "T12:00:00Z").toLocaleString("en-US", { timeZone: "Europe/Berlin", timeZoneName: "shortOffset" });
      var m = name.match(/GMT([+-]\d+)/);
      if (m) return (Number(m[1]) < 0 ? "-" : "+") + pad(Math.abs(Number(m[1]))) + ":00";
    } catch (e) {}
    return "+01:00";
  }
  function shortDay(iso) { var d = new Date(iso + "T12:00:00Z"); return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + "." + (d.getUTCMonth() + 1) + "."; }

  /* ---------- Daten ---------- */
  function weekDays(w) {
    var t = todayIso();
    var mon = addDays(t, -((dow(t) + 6) % 7) + 7 * w);
    var out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(mon, i));
    return out;
  }
  function load(s) {
    var days = weekDays(s.week);
    var from = days[0] + "T00:00:00" + offset(days[0]);
    var to = addDays(days[6], 1) + "T00:00:00" + offset(days[6]);
    var coach = encodeURIComponent(s.coach.id);
    var jobs = [host.rest("rpc/go_coach_group_members", { method: "POST", body: { p_coach: s.coach.id } }).catch(function () { return null; })];
    if (s.mode === "coach") {
      jobs.push(host.rest("rpc/go_coach_cards", { method: "POST", body: { p_coach: s.coach.id } }).catch(function () { return []; }));
      jobs.push(host.rest("events?user_id=eq." + encodeURIComponent(me()) + "&coach_group=eq.true&status=neq.ausgefallen&starts_at=gte." + encodeURIComponent(from) +
        "&starts_at=lt." + encodeURIComponent(to) + "&select=id,title,starts_at,location,status&order=starts_at.asc&limit=60").catch(function () { return []; }));
    } else {
      jobs.push(host.rest("go_workout_invites?to_id=eq." + encodeURIComponent(me()) + "&from_id=eq." + coach + "&event_id=not.is.null&status=in.(pending,accepted,maybe)" +
        "&workout_date=gte." + days[0] + "&workout_date=lte." + days[6] + "&select=id,status,event_id,workout_label,workout_date,events(id,title,starts_at,location,status)&limit=60")
        .catch(function () { return []; }));
      jobs.push(host.rest("go_coach_group_open?account_id=eq." + encodeURIComponent(me()) + "&select=is_open,coach_id").catch(function () { return []; }));
    }
    /* Kalender des Coaches (PT-Kalender): gesperrte Tage, Feiertage, verfügbare Zeiten, belegte Stunden */
    var cal = Promise.all([
      host.rest("go_coach_hours?coach_id=eq." + coach + "&select=mode,hours").catch(function () { return []; }),
      host.rest("go_coach_blocked_days?coach_id=eq." + coach + "&day=gte." + days[0] + "&day=lte." + days[6] + "&select=day").catch(function () { return []; }),
      host.rest("rpc/go_coach_busy", { method: "POST", body: { p_coach: s.coach.id, p_from: from, p_to: to } }).catch(function () { return []; })
    ]).then(function (c) {
      s.hours = (c[0] || [])[0] || null;
      s.blocked = {};
      (c[1] || []).forEach(function (b) { s.blocked[String(b.day).slice(0, 10)] = true; });
      s.busy = {};
      (c[2] || []).forEach(function (b) {
        var d = berlinDay(b.starts_at), h = Number(new Date(b.starts_at).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Berlin" }));
        (s.busy[d] = s.busy[d] || {})[h] = b.kind || true;
      });
    });
    jobs.push(cal);
    return Promise.all(jobs).then(function (r) {
      s.days = days;
      s.membersOk = r[0] !== null;
      s.members = r[0] || [];
      if (s.mode === "coach") {
        s.cards = {};
        (r[1] || []).forEach(function (c) { s.cards[String(c.account_id)] = c; });
        s.events = r[2] || [];
        if (!s.events.length) { s.inv = []; return; }
        return host.rest("go_workout_invites?from_id=eq." + encodeURIComponent(me()) + "&event_id=in.(" + s.events.map(function (e) { return e.id; }).join(",") + ")&select=event_id,to_id,status")
          .catch(function () { return []; }).then(function (inv) { s.inv = inv || []; });
      }
      s.invites = (r[1] || []).filter(function (x) { return x.events && x.events.status !== "ausgefallen"; });
      var o = (r[2] || [])[0];
      s.open = !!(o && o.is_open && String(o.coach_id || "") === String(s.coach.id));
    });
  }

  /* ---------- Darstellung ---------- */
  function faceHtml(p, open) {
    var img = p.photo_url ? ' style="background-image:url(&quot;' + esc(p.photo_url).replace(/"/g, "%22") + '&quot;)"' : "";
    return '<button type="button" class="gcg__face' + (open ? " is-open" : "") + '" data-gcg-person="' + esc(p.id) + '" aria-label="' + esc(p.name || "") + (open ? ", offen für Gruppentraining" : "") + '">' +
      '<span class="gcg__img"' + img + ">" + (p.photo_url ? "" : esc(String(p.name || "?").slice(0, 1))) + "</span><em>" + esc(first(p.nickname ? p.name : p.name) || "?") + "</em></button>";
  }
  var FROM_H = 7, TO_H = 21;
  function holiday(s, iso) {
    if (s.hours && s.hours.hours && s.hours.hours.holidays === false) return "";
    var P = global.GoPtCal && GoPtCal._holidays;
    return P ? P(Number(iso.slice(0, 4)))[iso] || "" : "";
  }
  function range(s, iso) {
    var h = s.hours;
    if (!h) return [FROM_H, TO_H];
    if (h.mode === "weekday") {
      var r = ((h.hours || {}).days || {})[String(dow(iso))];
      return r && r.length === 2 ? r : null;
    }
    var d = (h.hours || {}).daily;
    return d && d.length === 2 ? d : [FROM_H, TO_H];
  }
  /* freie Stunden des Coaches an einem Tag (ohne eigene Gruppen-Events mitzuzählen ist nicht nötig: die belegen die Stunde) */
  function freeHours(s, iso) {
    if (s.blocked && s.blocked[iso]) return [];
    if (holiday(s, iso)) return [];
    var r = range(s, iso);
    if (!r) return [];
    var out = [], b = (s.busy || {})[iso] || {};
    for (var h = Math.max(FROM_H, r[0]); h < Math.min(TO_H, r[1]); h++) if (!b[h]) out.push(h);
    return out;
  }
  function spans(hours) {
    var out = [], st = null, prev = null;
    hours.forEach(function (h) {
      if (st == null) st = h;
      else if (h !== prev + 1) { out.push(st + "–" + (prev + 1)); st = h; }
      prev = h;
    });
    if (st != null) out.push(st + "–" + (prev + 1));
    return out;
  }
  function dayState(s, iso) {
    var hol = holiday(s, iso);
    if (hol) return { closed: true, label: hol };
    if (s.blocked && s.blocked[iso]) return { closed: true, label: "gesperrt" };
    var fh = freeHours(s, iso);
    if (!fh.length) return { closed: true, label: range(s, iso) ? "ausgebucht" : "nicht verfügbar" };
    return { closed: false, free: fh, label: "frei " + spans(fh).join(" · ") + " Uhr" };
  }
  function cardOf(s, id) { return (s.cards || {})[String(id)] || { stamps: 0, card_no: 1, paid_at: null }; }
  function coacheeRow(s, p) {
    var c = cardOf(s, p.id);
    var n = Math.max(0, Math.min(12, Number(c.stamps) || 0));
    var dots = "";
    for (var i = 0; i < 12; i++) dots += '<i class="' + (i < n ? "is-on" : "") + '"></i>';
    var paid = c.paid_at ? new Date(c.paid_at).toLocaleDateString("de-DE", { day: "numeric", month: "numeric", timeZone: "Europe/Berlin" }) : "";
    return '<div class="gcg__ce">' + faceHtml(p, p.is_open).replace("<em>", '<em hidden>') +
      "<div><b>" + esc(p.name || "?") + "</b>" +
      '<div class="gcg__stamps" aria-label="' + n + ' von 12 Stempeln">' + dots + "</div>" +
      '<div class="gcg__cefoot"><button type="button" class="gcg__link" data-gcg-card="' + esc(p.id) + '">Anzeigen</button>' +
      "<span>" + n + " / 12 · " + (12 - n) + " übrig" + (c.card_no > 1 ? " · Karte " + c.card_no : "") + (paid ? " · bezahlt " + paid : "") + "</span>" +
      '<button type="button" class="gcg__link" data-gcg-paid="' + esc(p.id) + '">Bar bezahlt</button></div></div></div>';
  }
  function paint(s) {
    var el = s.el;
    var t = todayIso();
    var html = "";
    if (s.mode === "client") {
      html += '<label class="gcg__open"><input type="checkbox" data-gcg-open' + (s.open ? " checked" : "") + ">Offen für Gruppentraining</label>";
      html += '<p class="gcg__empty" style="margin-top:6px">' + (s.open
        ? "Die anderen Coachees von " + esc(first(s.coach.name) || "Deinem Coach") + " mit Haken sehen Dich, Du siehst sie."
        : "Mit Haken sehen Dich die anderen Coachees mit Haken, und Du siehst sie.") + "</p>";
      if (s.open) {
        html += '<p class="gcg__h">Offen für Gruppentraining</p>';
        html += s.members.length ? '<div class="gcg__faces">' + s.members.map(function (p) { return faceHtml(p, true); }).join("") + "</div>"
          : '<p class="gcg__empty">Noch niemand außer Dir.</p>';
      }
    } else {
      html += !s.membersOk ? '<p class="gcg__empty">Braucht go-coach-gruppe.sql in Supabase.</p>'
        : s.members.length ? s.members.map(function (p) { return coacheeRow(s, p); }).join("") +
          '<p class="gcg__empty">Grüner Punkt: offen für Gruppentraining. Gestempelt wird per QR beim gemeinsamen Training.</p>'
        : '<p class="gcg__empty">Noch keine Coachees. Coachees wählen Dich unter Kreise → Hinzufügen → Coach.</p>';
    }
    var d0 = new Date(s.days[0] + "T12:00:00Z"), d6 = new Date(s.days[6] + "T12:00:00Z");
    html += '<p class="gcg__h">Gruppentraining</p>' +
      '<div class="gcg__wk"><button type="button" data-gcg-wk="-1"' + (s.week <= 0 ? " disabled" : "") + ' aria-label="Vorherige Woche">‹</button><b>' +
      d0.getUTCDate() + "." + (d0.getUTCMonth() + 1) + ". – " + d6.getUTCDate() + "." + (d6.getUTCMonth() + 1) + ".</b>" +
      '<button type="button" data-gcg-wk="1" aria-label="Nächste Woche">›</button></div>';
    var rows = s.days.map(function (iso) {
      var label = DAYS[dow(iso)];
      var past = iso < t;
      var out = "", k = 0;
      if (s.mode === "coach") {
        s.events.filter(function (e) { return berlinDay(e.starts_at) === iso; }).forEach(function (e) {
          var inv = (s.inv || []).filter(function (x) { return String(x.event_id) === String(e.id); });
          var yes = inv.filter(function (x) { return x.status === "accepted"; }).length;
          var tag = [e.location, inv.length ? inv.length + " eingeladen" : "noch niemand eingeladen", yes ? yes + " dabei" : ""].filter(Boolean).join(" · ");
          out += '<div class="wr-dayrow wr-zrec-row wr-ga-row is-zirkel is-group' + (past ? " is-past" : "") + '" data-gcg-ev="' + esc(e.id) + '" role="button"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + (k++ ? "" : label) + "</b> " +
            esc(e.title || "Gruppentraining") + " · " + esc(berlinTime(e.starts_at)) + '</span><span class="wr-dayrow__tag">' + esc(tag) + "</span></div><span></span></div>";
        });
      } else {
        s.invites.filter(function (x) { return berlinDay(x.events.starts_at) === iso; }).forEach(function (x) {
          var on = x.status === "accepted";
          out += '<div class="wr-dayrow wr-zrec-row wr-ga-row is-zirkel is-group' + (past ? " is-past" : "") + '"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + (k++ ? "" : label) + "</b> " +
            esc(x.events.title || "Gruppentraining") + " · " + esc(berlinTime(x.events.starts_at)) + '</span><span class="wr-dayrow__tag">' +
            esc([x.events.location, "von " + (first(s.coach.name) || "Coach"), on ? "Du bist dabei" : ""].filter(Boolean).join(" · ")) + "</span></div>" +
            (past ? "<span></span>" : on && iso === t ? '<button type="button" class="wr-pill-btn wr-pill-btn--dark wr-ga-rsvp" data-gcg-qr="' + esc(x.event_id) + '">QR</button>'
              : '<button type="button" class="wr-pill-btn' + (on ? "" : " wr-pill-btn--dark") + ' wr-ga-rsvp" data-gcg-' + (on ? "no" : "yes") + '="' + esc(x.id) + '">' + (on ? "Absagen" : "Zusagen") + "</button>") + "</div>";
        });
      }
      /* Zustand aus dem PT-Kalender des Coaches: gesperrt, Feiertag, ausgebucht oder freie Stunden */
      var ds = dayState(s, iso);
      var stateTxt = s.mode === "coach" || ds.closed ? ds.label : "";
      var canAdd = s.mode === "coach" && !past && !ds.closed;
      if (!k) {
        out = '<div class="wr-dayrow wr-zrec-row is-empty' + (past ? " is-past" : "") + (ds.closed ? " is-closed" : "") + '"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + label + '</b> <span class="wr-dayrow__free">' + esc(stateTxt || "frei") + "</span></span></div>" +
          (canAdd ? '<button type="button" class="gcg__plus" data-gcg-add="' + iso + '" aria-label="Event am ' + DAYS_LONG[dow(iso)] + ' anlegen">+</button>' : "<span></span>") + "</div>";
      } else if (s.mode === "coach" && !past) {
        out += '<div class="wr-dayrow wr-zrec-row is-empty' + (ds.closed ? " is-closed" : "") + '"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b></b> <span class="wr-dayrow__free">' + esc(ds.closed ? ds.label : "weiteres Event · " + ds.label) + "</span></span></div>" +
          (canAdd ? '<button type="button" class="gcg__plus" data-gcg-add="' + iso + '" aria-label="Weiteres Event anlegen">+</button>' : "<span></span>") + "</div>";
      } else if (ds.closed) {
        out += '<div class="wr-dayrow wr-zrec-row is-empty is-closed"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b></b> <span class="wr-dayrow__free">' + esc(ds.label) + "</span></span></div><span></span></div>";
      }
      return out;
    }).join("");
    html += '<div class="wr-days wr-days--all">' + rows + "</div>";
    if (s.mode === "client" && !s.invites.length) html += '<p class="gcg__empty">Diese Woche keine Einladung von ' + esc(first(s.coach.name) || "Deinem Coach") + ".</p>";
    el.innerHTML = html;
  }
  function refresh(s) {
    return load(s).then(function () { paint(s); }, function () { s.el.innerHTML = '<p class="gcg__empty">Laden ging gerade nicht.</p>'; });
  }

  /* ---------- Aktionen ---------- */
  function pickCoachees(s, title, already) {
    var list = s.members.filter(function (p) { return (already || []).indexOf(String(p.id)) < 0; })
      .sort(function (a, b) { return (b.is_open ? 1 : 0) - (a.is_open ? 1 : 0); })
      .map(function (p) { return { value: String(p.id), label: (p.name || "?") + (p.is_open ? " · offen" : "") }; });
    return GoDialog.pick(title, list, { ok: "Einladen", empty: "Keine weiteren Coachees." });
  }
  function sendInvites(s, ev, ids) {
    if (!ids || !ids.length) return Promise.resolve();
    var iso = berlinDay(ev.starts_at);
    var label = (ev.title || "Gruppentraining") + " · " + shortDay(iso) + " " + berlinTime(ev.starts_at);
    var rows = ids.map(function (id) {
      return { from_id: me(), to_id: id, workout_date: iso, workout_label: label, from_name: host.myName ? host.myName() : "", meet_time: berlinTime(ev.starts_at), place: ev.location || null, status: "pending", event_id: ev.id };
    });
    return host.rest("go_workout_invites", { method: "POST", prefer: "return=minimal", body: rows });
  }
  function addEvent(s, iso) {
    if (!s.members.length) { GoDialog.alert("Noch keine Coachees. Coachees wählen Dich unter Kreise → Hinzufügen → Coach."); return; }
    var ev = { title: "", time: "" };
    GoDialog.prompt("Gruppentraining am " + shortDay(iso), "Gruppentraining", { ok: "Weiter" })
      .then(function (title) {
        title = String(title || "").trim();
        if (!title) return null;
        ev.title = title.slice(0, 60);
        /* nur Stunden, die im Coach-Kalender frei sind (verfügbar, nicht gesperrt, nicht belegt) */
        var fh = freeHours(s, iso);
        if (!fh.length) { GoDialog.alert("An diesem Tag ist in Deinem Kalender nichts frei."); return null; }
        var times = [];
        fh.forEach(function (h) { times.push(h + ":00"); times.push(h + ":30"); });
        var pre = fh.indexOf(18) >= 0 ? "18:00" : times[0];
        return GoDialog.time("Uhrzeit", { ok: "Weiter", cancel: "Abbrechen", times: times, initial: pre, sub: "Freie Stunden aus Deinem Kalender" });
      })
      .then(function (tm) {
        if (!tm) return null;
        ev.time = String(tm);
        return pickCoachees(s, "Wen einladen?");
      })
      .then(function (ids) {
        if (!ids) return;
        var p = ev.time.split(":");
        var starts = iso + "T" + pad(Number(p[0])) + ":" + pad(Number(p[1] || 0)) + ":00" + offset(iso);
        return host.rest("events", { method: "POST", prefer: "return=representation", body: {
          user_id: me(), title: ev.title, starts_at: starts, status: "geplant", visibility: "privat", category: "alternative", is_unplanned: true, coach_group: true
        } }).then(function (rows) {
          var saved = Array.isArray(rows) ? rows[0] : rows;
          if (!saved || !saved.id) throw new Error("event");
          return sendInvites(s, saved, ids).then(function () {
            if (host.toast) host.toast(ids.length ? ids.length + (ids.length === 1 ? " Einladung" : " Einladungen") + " verschickt" : "Event angelegt");
            if (host.onChange) host.onChange();
            return refresh(s);
          });
        });
      })
      .catch(function () { GoDialog.alert("Anlegen ging nicht (go-coach-gruppe.sql ausgeführt?)"); });
  }
  function eventMenu(s, id) {
    var ev = s.events.filter(function (e) { return String(e.id) === String(id); })[0];
    if (!ev) return;
    var inv = (s.inv || []).filter(function (x) { return String(x.event_id) === String(id); });
    var byId = {};
    s.members.forEach(function (p) { byId[String(p.id)] = first(p.name); });
    var info = inv.map(function (x) { return (byId[String(x.to_id)] || "?") + ": " + ({ accepted: "dabei", declined: "abgesagt", pending: "offen", maybe: "vielleicht" }[x.status] || x.status); });
    var items = info.map(function (t) { return { info: t }; });
    if (berlinDay(ev.starts_at) === todayIso() && host.openStampForEvent) items.push({ label: "QR-Code zum Stempeln", value: "qr" });
    if (berlinDay(ev.starts_at) >= todayIso()) items.push({ label: "Weitere einladen", value: "more" });
    items.push({ label: "Event löschen", value: "del" });
    GoDialog.choose((ev.title || "Gruppentraining") + " · " + shortDay(berlinDay(ev.starts_at)) + " " + berlinTime(ev.starts_at), items, { center: true }).then(function (v) {
      if (v === "qr") { host.openStampForEvent(ev.id, null); return; }
      if (v === "more") {
        pickCoachees(s, "Wen noch einladen?", inv.map(function (x) { return String(x.to_id); })).then(function (ids) {
          if (!ids || !ids.length) return;
          sendInvites(s, ev, ids).then(function () { if (host.toast) host.toast("Eingeladen"); return refresh(s); })
            .catch(function () { host.toast("Einladen ging nicht"); });
        });
      } else if (v === "del") {
        GoDialog.confirm("Event löschen?", { body: inv.length ? "Die Einladungen werden zurückgezogen." : "", ok: "Löschen", cancel: "Abbrechen" }).then(function (yes) {
          if (!yes) return;
          host.rest("go_workout_invites?from_id=eq." + encodeURIComponent(me()) + "&event_id=eq." + encodeURIComponent(id), { method: "PATCH", prefer: "return=minimal", body: { status: "cancelled", updated_at: new Date().toISOString() } })
            .catch(function () {})
            .then(function () { return host.rest("events?id=eq." + encodeURIComponent(id), { method: "DELETE", prefer: "return=minimal" }); })
            .then(function () { if (host.onChange) host.onChange(); return refresh(s); })
            .catch(function () { host.toast("Löschen ging nicht"); });
        });
      }
    });
  }
  function showCard(s, id) {
    var p = s.members.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p || !host.openStampPreview) return;
    host.openStampPreview({ kind: "coach", name: "Coach " + (first(s.coach.name) || ""), stamps: cardOf(s, id).stamps }, p);
  }
  function markPaid(s, id) {
    var p = s.members.filter(function (x) { return String(x.id) === String(id); })[0] || {};
    var c = cardOf(s, id);
    GoDialog.confirm(first(p.name) + " hat bar bezahlt?", { body: "Eine neue Karte startet mit 0 Stempeln. Die alte Karte hatte " + (Number(c.stamps) || 0) + " von 12.", ok: "Neue Karte", cancel: "Abbrechen" })
      .then(function (yes) {
        if (!yes) return;
        host.rest("rpc/go_coach_card_paid", { method: "POST", body: { p_coachee: id } })
          .then(function () { if (host.toast) host.toast("Neue Karte für " + first(p.name)); return refresh(s); })
          .catch(function () { GoDialog.alert("Ging nicht (go-coach-stempelkarte.sql ausgeführt?)"); });
      });
  }
  function answer(s, inviteId, yes) {
    var job = host.rest("rpc/" + (yes ? "go_accept_invite" : "go_decline_invite"), { method: "POST", body: { p_invite_id: inviteId } });
    job.then(function (r) {
      if (r === "expired") host.toast("Die Einladung ist abgelaufen");
      else if (host.toast) host.toast(yes ? "Du bist dabei" : "Abgesagt");
      if (host.onChange) host.onChange();
      return refresh(s);
    }).catch(function () { host.toast("Ging gerade nicht"); });
  }
  function setOpen(s, on) {
    host.rest("go_coach_group_open", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
      body: { account_id: me(), coach_id: s.coach.id, is_open: !!on, updated_at: new Date().toISOString() } })
      .then(function () { return refresh(s); })
      .catch(function () { host.toast("Speichern ging nicht (go-coach-gruppe.sql?)"); refresh(s); });
  }

  function onClick(e) {
    var s = this._gcg;
    if (!s) return;
    var t = e.target;
    var wk = t.closest("[data-gcg-wk]");
    if (wk && !wk.disabled) { s.week = Math.max(0, s.week + Number(wk.getAttribute("data-gcg-wk"))); refresh(s); return; }
    var add = t.closest("[data-gcg-add]");
    if (add) { addEvent(s, add.getAttribute("data-gcg-add")); return; }
    var y = t.closest("[data-gcg-yes]");
    if (y) { answer(s, y.getAttribute("data-gcg-yes"), true); return; }
    var n = t.closest("[data-gcg-no]");
    if (n) {
      GoDialog.confirm("Absagen?", { ok: "Absagen", cancel: "Abbrechen" }).then(function (ok) { if (ok) answer(s, n.getAttribute("data-gcg-no"), false); });
      return;
    }
    var cd = t.closest("[data-gcg-card]");
    if (cd) { showCard(s, cd.getAttribute("data-gcg-card")); return; }
    var pd = t.closest("[data-gcg-paid]");
    if (pd) { markPaid(s, pd.getAttribute("data-gcg-paid")); return; }
    var qr = t.closest("[data-gcg-qr]");
    if (qr && host.openStampForEvent) { host.openStampForEvent(qr.getAttribute("data-gcg-qr"), { kind: "coach", ref: String(s.coach.id) }); return; }
    var ev = t.closest("[data-gcg-ev]");
    if (ev) { eventMenu(s, ev.getAttribute("data-gcg-ev")); return; }
    var p = t.closest("[data-gcg-person]");
    if (p && host.openProfile) {
      var person = s.members.filter(function (x) { return String(x.id) === p.getAttribute("data-gcg-person"); })[0];
      if (person) host.openProfile(person);
    }
  }
  function onChange(e) {
    var s = this._gcg;
    if (s && e.target.hasAttribute("data-gcg-open")) setOpen(s, e.target.checked);
  }

  function render(el, opts) {
    if (!host || !el || !opts || !opts.coach || !opts.coach.id) return;
    ensureCss();
    var box = document.createElement("div");
    box.className = "gcg";
    box.innerHTML = '<p class="gcg__empty">Lädt …</p>';
    el.appendChild(box);
    var s = { el: box, mode: opts.mode === "coach" ? "coach" : "client", coach: opts.coach, week: 0, members: [], events: [], invites: [] };
    box._gcg = s;
    box.addEventListener("click", onClick);
    box.addEventListener("change", onChange);
    refresh(s);
    return box;
  }

  global.GoCoachGroup = {
    init: function (h) { host = h; },
    render: render
  };
})(window);
