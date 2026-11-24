/* coach-group.js — Coach-Gruppe: Coach und seine Kunden (go-coach-gruppe.sql)
 *
 *   GoCoachGroup.init({ rest, me(), myName(), toast(msg), openProfile(person), onChange() })
 *   GoCoachGroup.render(el, { mode: "coach" | "client", coach: { id, name, photo_url } })
 *
 * Coach:  Kunden (alle, „offen“ markiert), Woche Mo bis So; Tag antippen (+) → Event anlegen und Kunden einladen.
 * Kunde:  Haken „offen für Gruppentraining“, andere Kunden mit Haken, Woche mit den Einladungen des Coaches (Zusagen/Absagen).
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
      jobs.push(host.rest("events?user_id=eq." + encodeURIComponent(me()) + "&coach_group=eq.true&status=neq.ausgefallen&starts_at=gte." + encodeURIComponent(from) +
        "&starts_at=lt." + encodeURIComponent(to) + "&select=id,title,starts_at,location,status&order=starts_at.asc&limit=60").catch(function () { return []; }));
    } else {
      jobs.push(host.rest("go_workout_invites?to_id=eq." + encodeURIComponent(me()) + "&from_id=eq." + coach + "&event_id=not.is.null&status=in.(pending,accepted,maybe)" +
        "&workout_date=gte." + days[0] + "&workout_date=lte." + days[6] + "&select=id,status,event_id,workout_label,workout_date,events(id,title,starts_at,location,status)&limit=60")
        .catch(function () { return []; }));
      jobs.push(host.rest("go_coach_group_open?account_id=eq." + encodeURIComponent(me()) + "&select=is_open,coach_id").catch(function () { return []; }));
    }
    return Promise.all(jobs).then(function (r) {
      s.days = days;
      s.membersOk = r[0] !== null;
      s.members = r[0] || [];
      if (s.mode === "coach") {
        s.events = r[1] || [];
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
  function paint(s) {
    var el = s.el;
    var t = todayIso();
    var html = "";
    if (s.mode === "client") {
      html += '<label class="gcg__open"><input type="checkbox" data-gcg-open' + (s.open ? " checked" : "") + ">Offen für Gruppentraining</label>";
      html += '<p class="gcg__empty" style="margin-top:6px">' + (s.open
        ? "Die anderen Kunden von " + esc(first(s.coach.name) || "Deinem Coach") + " mit Haken sehen Dich, Du siehst sie."
        : "Mit Haken sehen Dich die anderen Kunden mit Haken, und Du siehst sie.") + "</p>";
      if (s.open) {
        html += '<p class="gcg__h">Offen für Gruppentraining</p>';
        html += s.members.length ? '<div class="gcg__faces">' + s.members.map(function (p) { return faceHtml(p, true); }).join("") + "</div>"
          : '<p class="gcg__empty">Noch niemand außer Dir.</p>';
      }
    } else {
      html += '<p class="gcg__h">Kunden</p>';
      html += !s.membersOk ? '<p class="gcg__empty">Braucht go-coach-gruppe.sql in Supabase.</p>'
        : s.members.length ? '<div class="gcg__faces">' + s.members.map(function (p) { return faceHtml(p, p.is_open); }).join("") + "</div>" +
          '<p class="gcg__empty">Grüner Punkt: offen für Gruppentraining.</p>'
        : '<p class="gcg__empty">Noch keine Kunden. Kunden wählen Dich unter Kreise → Hinzufügen → Coach.</p>';
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
            (past ? "<span></span>" : '<button type="button" class="wr-pill-btn' + (on ? "" : " wr-pill-btn--dark") + ' wr-ga-rsvp" data-gcg-' + (on ? "no" : "yes") + '="' + esc(x.id) + '">' + (on ? "Absagen" : "Zusagen") + "</button>") + "</div>";
        });
      }
      if (!k) {
        out = '<div class="wr-dayrow wr-zrec-row is-empty' + (past ? " is-past" : "") + '"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + label + '</b> <span class="wr-dayrow__free">frei</span></span></div>' +
          (s.mode === "coach" && !past ? '<button type="button" class="gcg__plus" data-gcg-add="' + iso + '" aria-label="Event am ' + DAYS_LONG[dow(iso)] + ' anlegen">+</button>' : "<span></span>") + "</div>";
      } else if (s.mode === "coach" && !past) {
        out += '<div class="wr-dayrow wr-zrec-row is-empty"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b></b> <span class="wr-dayrow__free">weiteres Event</span></span></div><button type="button" class="gcg__plus" data-gcg-add="' + iso + '" aria-label="Weiteres Event anlegen">+</button></div>';
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
    return GoDialog.pick(title, list, { ok: "Einladen", empty: "Keine weiteren Kunden." });
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
    if (!s.members.length) { GoDialog.alert("Noch keine Kunden. Kunden wählen Dich unter Kreise → Hinzufügen → Coach."); return; }
    var ev = { title: "", time: "" };
    GoDialog.prompt("Gruppentraining am " + shortDay(iso), "Gruppentraining", { ok: "Weiter" })
      .then(function (title) {
        title = String(title || "").trim();
        if (!title) return null;
        ev.title = title.slice(0, 60);
        return GoDialog.time("Uhrzeit", { ok: "Weiter", cancel: "Abbrechen", initial: "18:00" });
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
    if (berlinDay(ev.starts_at) >= todayIso()) items.push({ label: "Weitere einladen", value: "more" });
    items.push({ label: "Event löschen", value: "del" });
    GoDialog.choose((ev.title || "Gruppentraining") + " · " + shortDay(berlinDay(ev.starts_at)) + " " + berlinTime(ev.starts_at), items, { center: true }).then(function (v) {
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
