/* coach-portal.js — Coach-Portal in der App (Team → Coachee → Stift)
 *
 * Ersetzt das alte Admin-Portal für Coaches:
 *   1. Kopf: Foto, Vorname, @Nickname, Ziel
 *   2. Analyse: Notiz des Coaches (coach_notes)
 *   3. Woche: Coach trägt Events direkt in die Woche des Coachees ein (events.assigned_by)
 *
 *   4. Wochenplan zuordnen (Laufzeit je Coachee) und sehen, wo der Coachee mitmacht
 *
 * Host: { rest, sessionAccount, toast, isAdmin, openKursEditor, openLegacyAdmin }
 * Schema: go-coach-portal.sql
 */
(function (global) {
  "use strict";

  var host = null;
  var st = null;
  var DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  var KINDS = [
    { key: "kraft", label: "Kraft" },
    { key: "ausdauer", label: "Ausdauer" },
    { key: "zirkel", label: "Zirkel" },
    { key: "alternative", label: "Sonstiges" }
  ];
  var EMOJI = { kraft: "🏋️", ausdauer: "🏃", zirkel: "🔁", alternative: "✨" };
  var CAT_LABEL = [["kraft", "Kraft"], ["ausdauer", "Ausdauer"], ["alternative", "Sonstiges"], ["zirkel", "Zirkeltraining"]];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function me() {
    return host && host.sessionAccount ? String(host.sessionAccount.id) : "";
  }
  function rest(path, opts) {
    return host.rest(path, opts);
  }
  function toast(msg) {
    if (host && host.toast) host.toast(msg);
  }

  /* ---------- Datum (Europe/Berlin) ---------- */
  function todayIso() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  }
  function addDays(iso, n) {
    var d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function mondayOf(iso) {
    var d = new Date(iso + "T12:00:00Z");
    var wd = (d.getUTCDay() + 6) % 7;
    return addDays(iso, -wd);
  }
  function lastSunday(year, month) {
    var d = new Date(Date.UTC(year, month + 1, 0));
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  }
  function berlinOffset(iso) {
    var y = Number(iso.slice(0, 4));
    return iso >= lastSunday(y, 2) && iso < lastSunday(y, 9) ? "+02:00" : "+01:00";
  }
  function dayKey(ts) {
    return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  }
  function timeOf(ts) {
    return new Date(ts).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  }
  function dayLabel(iso, i) {
    var d = new Date(iso + "T12:00:00Z");
    return DAYS[i] + " " + d.getUTCDate() + "." + (d.getUTCMonth() + 1) + ".";
  }

  /* ---------- Daten ---------- */
  function loadPerson() {
    return rest(
      "go_accounts?id=eq." + encodeURIComponent(st.id) + "&select=id,name,nickname,photo_url,training_goal,trainer_id"
    ).then(function (rows) {
      st.person = (rows && rows[0]) || st.person;
    }).catch(function () {});
  }

  function loadNote() {
    return rest(
      "coach_notes?coach_id=eq." + encodeURIComponent(me()) + "&coachee_id=eq." + encodeURIComponent(st.id) + "&select=note,updated_at"
    ).then(function (rows) {
      st.note = (rows && rows[0] && rows[0].note) || "";
      st.noteReady = true;
    }).catch(function () {
      st.note = "";
      st.noteReady = false;
    });
  }

  function loadCourses() {
    if (st.courses) return Promise.resolve();
    return rest("courses?is_active=eq.true&select=id,title,slug,category_default,owner,private_for,coach_id&order=title.asc&limit=200")
      .then(function (rows) {
        st.courses = (rows || []).filter(function (c) {
          if (!c || !c.category_default) return false;
          if (/preset|12-wochen-routine|eigenes-training/.test(String(c.slug || ""))) return false;
          if (c.private_for) return String(c.private_for) === String(st.id);
          return c.owner === "gogogo" || String(c.coach_id || "") === me();
        }).sort(function (a, b) {
          /* Eigener Plan des Coachees zuerst, dann Coach-Kurse, dann gogogo */
          function rank(c) { return c.private_for ? 0 : c.owner === "coach" ? 1 : 2; }
          return rank(a) - rank(b) || String(a.title).localeCompare(String(b.title), "de");
        });
      })
      .catch(function () {
        st.courses = [];
      });
  }

  function loadWeek() {
    var start = st.week;
    var end = addDays(start, 7);
    var base =
      "events?user_id=eq." + encodeURIComponent(st.id) +
      "&starts_at=gte." + encodeURIComponent(start + "T00:00:00" + berlinOffset(start)) +
      "&starts_at=lt." + encodeURIComponent(end + "T00:00:00" + berlinOffset(end)) +
      "&status=neq.ausgefallen&order=starts_at.asc";
    return rest(base + "&select=id,title,category,starts_at,status,location,assigned_by")
      .catch(function () {
        return rest(base + "&select=id,title,category,starts_at,status,location");
      })
      .then(function (rows) {
        st.events = rows || [];
      })
      .catch(function () {
        st.events = [];
      });
  }

  /* Wochenpläne = aktive Kurse mit mehreren Einheiten (Block 1) */
  function planMix(c) {
    var n = {};
    (c.course_sessions || []).forEach(function (x) {
      if (x.is_travel || x.block_no !== 1) return;
      n[x.category] = (n[x.category] || 0) + 1;
    });
    return n;
  }
  function mixText(n) {
    return CAT_LABEL.filter(function (k) { return n[k[0]]; }).map(function (k) { return n[k[0]] + " " + k[1]; }).join(" + ");
  }
  function trainDays(n) {
    return (n.kraft || 0) + (n.ausdauer || 0) + (n.alternative || 0);
  }
  function loadPlans() {
    if (st.plans) return Promise.resolve();
    return rest("courses?is_active=eq.true&select=id,title,level,private_for,course_sessions!course_sessions_course_id_fkey(category,block_no,is_travel)&order=title.asc,level.asc")
      .then(function (rows) {
        st.plans = (rows || []).filter(function (c) {
          if (c.private_for && String(c.private_for) !== String(st.id)) return false;
          return trainDays(planMix(c)) > 1;
        });
      })
      .catch(function () { st.plans = []; });
  }
  function loadEnrollment() {
    var base = "enrollments?user_id=eq." + encodeURIComponent(st.id) + "&status=eq.aktiv&order=created_at.desc&limit=1";
    return rest(base + "&select=id,start_date,weeks,weekdays,course_id,courses(title,level)")
      .catch(function () { return rest(base + "&select=id,start_date,weekdays,course_id,courses(title,level)"); })
      .then(function (rows) { st.enrollment = (rows && rows[0]) || null; })
      .catch(function () { st.enrollment = null; });
  }
  /* Wo macht der Coachee bei anderen mit (Zusage / angenommene Einladung) */
  function loadJoined() {
    st.joined = [];
    return rest("event_rsvps?user_id=eq." + encodeURIComponent(st.id) + "&status=eq.zugesagt&select=event_id&limit=300")
      .then(function (rs) {
        var ids = (rs || []).map(function (r) { return String(r.event_id); });
        if (!ids.length) return [];
        var end = addDays(st.week, 7);
        return rest(
          "events?id=in.(" + ids.map(encodeURIComponent).join(",") + ")&user_id=neq." + encodeURIComponent(st.id) +
            "&starts_at=gte." + encodeURIComponent(st.week + "T00:00:00" + berlinOffset(st.week)) +
            "&starts_at=lt." + encodeURIComponent(end + "T00:00:00" + berlinOffset(end)) +
            "&select=id,user_id,title,category,starts_at,status"
        );
      })
      .then(function (rows) {
        st.joined = rows || [];
        var owners = [];
        st.joined.forEach(function (e) { if (owners.indexOf(String(e.user_id)) < 0) owners.push(String(e.user_id)); });
        if (!owners.length) return;
        return rest("go_accounts?id=in.(" + owners.map(encodeURIComponent).join(",") + ")&select=id,name").then(function (accs) {
          st.names = st.names || {};
          (accs || []).forEach(function (a) { st.names[String(a.id)] = String(a.name || "").split(" ")[0]; });
        });
      })
      .catch(function () { st.joined = []; });
  }

  /* ---------- Darstellung ---------- */
  function headHtml() {
    var p = st.person || {};
    var first = String(p.name || "Coachee").split(" ")[0];
    var face = p.photo_url
      ? '<img class="cp-face" src="' + esc(p.photo_url) + '" alt="">'
      : '<span class="cp-face cp-face--ph">' + esc(first.slice(0, 1)) + "</span>";
    return (
      '<div class="cp-head">' + face +
      '<div><p class="cp-name">' + esc(first) +
      (p.nickname ? ' <small>@' + esc(String(p.nickname).replace(/^@/, "")) + "</small>" : "") +
      "</p>" +
      (p.training_goal ? '<p class="cp-goal">Ziel: ' + esc(p.training_goal) + "</p>" : "") +
      "</div></div>"
    );
  }

  function noteHtml() {
    return (
      '<section class="cp-sec"><h3>Analyse</h3>' +
      '<textarea class="cp-note" id="cp-note" rows="5" maxlength="4000" placeholder="Ausgangslage, Ziel, Schwerpunkte, was die nächsten Wochen wichtig ist">' +
      esc(st.note || "") +
      "</textarea>" +
      '<button type="button" class="cp-btn" data-cp="save-note">Analyse speichern</button>' +
      (st.noteReady === false ? '<p class="cp-hint">Speichern braucht go-coach-portal.sql in Supabase.</p>' : "") +
      "</section>"
    );
  }

  function weekHtml() {
    var thisMon = mondayOf(todayIso());
    var rows = [];
    for (var i = 0; i < 7; i++) {
      var iso = addDays(st.week, i);
      var evs = st.events.filter(function (e) { return dayKey(e.starts_at) === iso; });
      var joined = (st.joined || []).filter(function (e) { return dayKey(e.starts_at) === iso; });
      var past = iso < todayIso();
      rows.push(
        '<div class="cp-day' + (past ? " is-past" : "") + '">' +
        '<p class="cp-day__label">' + esc(dayLabel(iso, i)) + "</p>" +
        '<div class="cp-day__list">' +
        (evs.length
          ? evs.map(function (e) {
              var byMe = String(e.assigned_by || "") === me();
              var movable = e.status === "geplant" && dayKey(e.starts_at) >= todayIso();
              return (
                '<span class="cp-ev' + (e.status === "erledigt" ? " is-done" : "") + (byMe ? " is-coach" : "") + '"' +
                (movable ? ' data-cp="move" data-id="' + esc(e.id) + '" role="button" tabindex="0"' : "") + ">" +
                esc(timeOf(e.starts_at)) + " " + (EMOJI[e.category] || "") + " " + esc(e.title || e.category) +
                (e.status === "erledigt" ? " ✓" : "") +
                (byMe && e.status === "geplant"
                  ? '<button type="button" class="cp-ev__x" data-cp="del" data-id="' + esc(e.id) + '" aria-label="Entfernen">×</button>'
                  : "") +
                "</span>"
              );
            }).join("")
          : joined.length ? "" : '<span class="cp-ev cp-ev--empty">frei</span>') +
        joined.map(function (e) {
          return (
            '<span class="cp-ev cp-ev--joined">' + esc(timeOf(e.starts_at)) + " " + (EMOJI[e.category] || "") + " " +
            esc(e.title || e.category) + ' <em>dabei bei ' + esc((st.names && st.names[String(e.user_id)]) || "…") + "</em>" +
            (e.status === "erledigt" ? " ✓" : "") + "</span>"
          );
        }).join("") +
        "</div>" +
        (past ? "" : '<button type="button" class="cp-add" data-cp="add" data-iso="' + iso + '" aria-label="Eintragen">+</button>') +
        "</div>"
      );
    }
    return (
      '<section class="cp-sec"><h3>Woche</h3>' +
      '<div class="cp-seg">' +
      '<button type="button" data-cp="week" data-week="' + thisMon + '"' + (st.week === thisMon ? ' class="is-on"' : "") + ">Diese Woche</button>" +
      '<button type="button" data-cp="week" data-week="' + addDays(thisMon, 7) + '"' + (st.week === addDays(thisMon, 7) ? ' class="is-on"' : "") + ">Nächste Woche</button>" +
      "</div>" +
      '<p class="cp-hint">Was Du einträgst, landet direkt in der Woche von ' + esc(String((st.person && st.person.name) || "").split(" ")[0]) + ". Von Dir eingetragene, noch offene Events kannst Du wieder entfernen.</p>" +
      rows.join("") +
      "</section>"
    );
  }

  function planHtml() {
    var en = st.enrollment;
    if (en) {
      var c = en.courses || {};
      var weeks = en.weeks ? en.weeks + " Wochen" : "";
      return (
        '<section class="cp-sec"><h3>Wochenplan</h3>' +
        '<div class="cp-plan"><p class="cp-plan__name">' + esc(c.title || "Wochenplan") + (c.level ? " · Level " + c.level : "") + "</p>" +
        '<p class="cp-hint">ab ' + esc(String(en.start_date || "").split("-").reverse().join(".")) + (weeks ? " · " + weeks : "") + "</p>" +
        '<button type="button" class="cp-btn cp-btn--ghost" data-cp="end-plan">Wochenplan beenden</button></div>' +
        "</section>"
      );
    }
    var plans = st.plans || [];
    var sel = st.planPick || (plans[0] && plans[0].id) || "";
    var pick = plans.filter(function (c) { return String(c.id) === String(sel); })[0];
    var hasZ = pick && planMix(pick).zirkel;
    return (
      '<section class="cp-sec"><h3>Wochenplan</h3>' +
      (plans.length
        ? '<label class="cp-field">Plan<select id="cp-plan">' +
          plans.map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (String(c.id) === String(sel) ? " selected" : "") + ">" +
              esc(c.title + (c.level ? " · L" + c.level : "") + " — " + mixText(planMix(c))) + "</option>";
          }).join("") +
          "</select></label>" +
          '<div class="cp-row"><label class="cp-field">Start (Montag)<input type="date" id="cp-start" value="' + esc(st.planStart || addDays(mondayOf(todayIso()), 7)) + '" /></label>' +
          '<label class="cp-field">Wochen<input type="number" id="cp-weeks" min="1" max="52" value="' + esc(st.planWeeks || 12) + '" /></label></div>' +
          '<p class="cp-hint">Der Plan füllt Mo bis So automatisch. Einzelne Tage kannst Du danach in der Woche verschieben (Event antippen).' +
          (hasZ ? " Zirkeltraining läuft über FFC und erzeugt keinen Termin." : "") + "</p>" +
          '<button type="button" class="cp-btn" data-cp="assign">Zuordnen</button>'
        : '<p class="cp-hint">Noch keine Wochenpläne.</p>') +
      "</section>"
    );
  }

  function footHtml() {
    return (
      '<section class="cp-sec cp-foot">' +
      (host.isAdmin ? '<button type="button" class="cp-btn cp-btn--ghost" data-cp="kurse">Wochenpläne bearbeiten</button>' : "") +
      '<button type="button" class="cp-link" data-cp="legacy">Altes Admin-Portal</button>' +
      "</section>"
    );
  }

  function paint() {
    if (!st || !st.root) return;
    var scroll = st.body ? st.body.scrollTop : 0;
    st.body.innerHTML = headHtml() + noteHtml() + planHtml() + weekHtml() + footHtml();
    st.body.scrollTop = scroll;
  }

  /* ---------- Eintragen ---------- */
  function openAdd(iso) {
    var kind = "kraft";
    var box = document.createElement("div");
    box.className = "cp-modal";
    function courseOptions() {
      return (st.courses || [])
        .filter(function (c) { return c.category_default === kind; })
        .map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.title) + "</option>"; })
        .join("");
    }
    function render() {
      var d = new Date(iso + "T12:00:00Z");
      box.innerHTML =
        '<div class="cp-modal__card" role="dialog" aria-modal="true">' +
        "<h3>" + esc(DAYS[(d.getUTCDay() + 6) % 7] + " " + d.getUTCDate() + "." + (d.getUTCMonth() + 1) + ".") + "</h3>" +
        '<div class="cp-seg cp-seg--4">' +
        KINDS.map(function (k) {
          return '<button type="button" data-kind="' + k.key + '"' + (k.key === kind ? ' class="is-on"' : "") + ">" + k.label + "</button>";
        }).join("") +
        "</div>" +
        (kind === "alternative"
          ? '<label class="cp-field">Was<input type="text" id="cp-title" maxlength="60" placeholder="z. B. Spaziergang, Yoga" /></label>'
          : '<label class="cp-field">Training<select id="cp-course">' + courseOptions() + "</select></label>") +
        '<label class="cp-field">Uhrzeit<input type="time" id="cp-time" value="18:00" step="900" /></label>' +
        '<label class="cp-field">Ort<input type="text" id="cp-place" maxlength="80" placeholder="optional" /></label>' +
        '<button type="button" class="cp-btn" data-save="1">Eintragen</button>' +
        '<button type="button" class="cp-link" data-close="1">Abbrechen</button>' +
        "</div>";
    }
    render();
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest("[data-close]")) {
        box.remove();
        return;
      }
      var k = e.target.closest("[data-kind]");
      if (k) {
        kind = k.getAttribute("data-kind");
        render();
        return;
      }
      if (e.target.closest("[data-save]")) {
        var time = (box.querySelector("#cp-time") || {}).value || "18:00";
        var place = String((box.querySelector("#cp-place") || {}).value || "").trim();
        var courseSel = box.querySelector("#cp-course");
        var course = courseSel ? (st.courses || []).filter(function (c) { return String(c.id) === courseSel.value; })[0] : null;
        var title = kind === "alternative"
          ? String((box.querySelector("#cp-title") || {}).value || "").trim() || "Bewegung"
          : course ? course.title : "";
        if (kind !== "alternative" && !course) {
          toast("Kein Training für diese Art gefunden");
          return;
        }
        var body = {
          user_id: st.id,
          course_id: kind === "alternative" ? null : course.id,
          category: kind,
          starts_at: iso + "T" + time + ":00" + berlinOffset(iso),
          location: place || null,
          visibility: "team",
          is_unplanned: false,
          status: "geplant",
          title: title,
          assigned_by: me()
        };
        e.target.disabled = true;
        rest("events", { method: "POST", prefer: "return=minimal", body: body })
          .catch(function () {
            delete body.assigned_by;
            return rest("events", { method: "POST", prefer: "return=minimal", body: body });
          })
          .then(function () {
            box.remove();
            toast("Eingetragen");
            return loadWeek().then(paint);
          })
          .catch(function () {
            e.target.disabled = false;
            toast("Eintragen fehlgeschlagen (go-coach-portal.sql ausgeführt?)");
          });
      }
    });
    document.body.appendChild(box);
  }

  function onClick(e) {
    var t = e.target.closest("[data-cp]");
    if (!t) return;
    var act = t.getAttribute("data-cp");
    if (act === "close") return close();
    if (act === "week") {
      st.week = t.getAttribute("data-week");
      Promise.all([loadWeek(), loadJoined()]).then(paint);
      return;
    }
    if (act === "day") {
      var dd = Number(t.getAttribute("data-day"));
      var cur = [].map.call(st.root.querySelectorAll(".cp-days .is-on"), function (b) { return Number(b.getAttribute("data-day")); });
      var ix = cur.indexOf(dd);
      if (ix >= 0) cur.splice(ix, 1); else cur.push(dd);
      st.planDays = cur.sort();
      t.classList.toggle("is-on");
      return;
    }
    if (act === "assign") return assignPlan(t);
    if (act === "move") {
      if (e.target.closest(".cp-ev__x")) return;
      return moveEvent(t.getAttribute("data-id"));
    }
    if (act === "end-plan") return endPlan();
    if (act === "add") return openAdd(t.getAttribute("data-iso"));
    if (act === "del") {
      var id = t.getAttribute("data-id");
      rest("events?id=eq." + encodeURIComponent(id) + "&assigned_by=eq." + encodeURIComponent(me()) + "&status=eq.geplant", {
        method: "DELETE",
        prefer: "return=representation"
      })
        .then(function (rows) {
          if (!rows || !rows.length) toast("Entfernen braucht go-coach-portal.sql");
          return loadWeek().then(paint);
        })
        .catch(function () { toast("Entfernen fehlgeschlagen"); });
      return;
    }
    if (act === "save-note") {
      var note = String((document.getElementById("cp-note") || {}).value || "");
      rest("coach_notes", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: { coach_id: me(), coachee_id: st.id, note: note, updated_at: new Date().toISOString() }
      })
        .then(function () {
          st.note = note;
          st.noteReady = true;
          toast("Analyse gespeichert");
        })
        .catch(function () { toast("Speichern braucht go-coach-portal.sql in Supabase"); });
      return;
    }
    if (act === "kurse" && host.openKursEditor) return host.openKursEditor();
    if (act === "legacy" && host.openLegacyAdmin) return host.openLegacyAdmin(st.id);
  }

  /* Coach verschiebt ein Event des Coachees auf einen anderen Tag dieser Woche (Uhrzeit bleibt) */
  function moveEvent(id) {
    var ev = st.events.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!ev || !global.GoDialog) return;
    var cur = dayKey(ev.starts_at);
    var choices = [];
    for (var i = 0; i < 7; i++) {
      var iso = addDays(st.week, i);
      if (iso === cur || iso < todayIso()) continue;
      choices.push({ label: dayLabel(iso, i), value: iso });
    }
    GoDialog.choose("„" + (ev.title || "Event") + "“ verschieben auf", choices).then(function (iso) {
      if (!iso) return;
      var starts = iso + "T" + timeOf(ev.starts_at) + ":00" + berlinOffset(iso);
      rest("events?id=eq." + encodeURIComponent(id), { method: "PATCH", prefer: "return=minimal", body: { starts_at: starts } })
        .then(function () {
          toast("Verschoben");
          return loadWeek().then(paint);
        })
        .catch(function () { toast("Verschieben fehlgeschlagen"); });
    });
  }

  function readPlanForm() {
    var selEl = document.getElementById("cp-plan");
    st.planPick = selEl ? selEl.value : st.planPick;
    st.planStart = (document.getElementById("cp-start") || {}).value || st.planStart;
    st.planWeeks = Number((document.getElementById("cp-weeks") || {}).value) || 12;
  }

  function assignPlan(btn) {
    readPlanForm();
    var pick = (st.plans || []).filter(function (c) { return String(c.id) === String(st.planPick); })[0];
    if (!pick) return;
    var days = [0, 1, 2, 3, 4, 5, 6];
    var need = 7;
    var start = st.planStart;
    if (!start) return toast("Startdatum fehlt");
    start = mondayOf(start);
    var body = {
      user_id: st.id, course_id: pick.id, status: "aktiv", start_date: start, weekdays: days,
      sessions_per_week: need, weeks: st.planWeeks, assigned_by: me(), payment_status: "gratis"
    };
    btn.disabled = true;
    rest("enrollments", { method: "POST", prefer: "return=representation", body: body })
      .catch(function () {
        delete body.weeks;
        return rest("enrollments", { method: "POST", prefer: "return=representation", body: body });
      })
      .then(function (rows) {
        return rest("rpc/go_generate_events", { method: "POST", body: { p_enrollment_id: rows[0].id } });
      })
      .then(function (n) {
        toast((Number(n) || 0) + " Termine eingetragen");
        st.planDays = null;
        return Promise.all([loadEnrollment(), loadWeek()]).then(paint);
      })
      .catch(function () {
        btn.disabled = false;
        toast("Zuordnen fehlgeschlagen (go-coach-enroll.sql ausgeführt?)");
      });
  }

  function endPlan() {
    var en = st.enrollment;
    if (!en) return;
    var go = global.GoDialog
      ? GoDialog.confirm("Wochenplan beenden? Offene Termine ab heute werden entfernt.", { ok: "Beenden" })
      : Promise.resolve(true);
    go.then(function (ok) {
      if (!ok) return;
      var from = todayIso() + "T00:00:00" + berlinOffset(todayIso());
      rest("events?enrollment_id=eq." + encodeURIComponent(en.id) + "&status=eq.geplant&starts_at=gte." + encodeURIComponent(from), {
        method: "DELETE", prefer: "return=minimal"
      })
        .catch(function () {})
        .then(function () {
          return rest("enrollments?id=eq." + encodeURIComponent(en.id), {
            method: "PATCH", prefer: "return=minimal", body: { status: "beendet" }
          });
        })
        .then(function () {
          toast("Wochenplan beendet");
          return Promise.all([loadEnrollment(), loadWeek()]).then(paint);
        })
        .catch(function () { toast("Beenden fehlgeschlagen"); });
    });
  }

  function close() {
    if (st && st.root) st.root.remove();
    document.body.classList.remove("cp-open");
    st = null;
  }

  function open(h, person) {
    host = h;
    if (!person || !person.id) return;
    if (st) close();
    var root = document.createElement("div");
    root.className = "cp";
    root.innerHTML =
      '<div class="cp-bar">' +
      '<button type="button" class="cp-back" data-cp="close" aria-label="Zurück">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 6.5 8.2 12l6 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button><h2>Coaching</h2></div>" +
      '<div class="cp-body"><p class="cp-hint">Lade…</p></div>';
    document.body.appendChild(root);
    document.body.classList.add("cp-open");
    st = {
      id: String(person.id),
      person: person,
      root: root,
      body: root.querySelector(".cp-body"),
      week: mondayOf(todayIso()),
      events: [],
      note: "",
      courses: null
    };
    root.addEventListener("click", onClick);
    root.addEventListener("change", function (e) {
      if (e.target && e.target.id === "cp-plan") {
        readPlanForm();
        st.planDays = null;
        paint();
      }
    });
    Promise.all([loadPerson(), loadNote(), loadCourses(), loadWeek(), loadPlans(), loadEnrollment(), loadJoined()]).then(paint);
  }

  global.GoCoachPortal = { open: open, close: close };
})(window);
