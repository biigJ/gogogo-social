/* coach-portal.js — Coach-Portal in der App (Team → Coachee → Stift)
 *
 * Ersetzt das alte Admin-Portal für Coaches:
 *   1. Kopf: Foto, Vorname, @Nickname, Ziel
 *   2. Analyse: Notiz des Coaches (coach_notes)
 *   3. Woche: Coach trägt Events direkt in die Woche des Coachees ein (events.assigned_by)
 *
 * Host: { rest, sessionAccount, toast, openKursEditor, openLegacyAdmin }
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
      var past = iso < todayIso();
      rows.push(
        '<div class="cp-day' + (past ? " is-past" : "") + '">' +
        '<p class="cp-day__label">' + esc(dayLabel(iso, i)) + "</p>" +
        '<div class="cp-day__list">' +
        (evs.length
          ? evs.map(function (e) {
              var byMe = String(e.assigned_by || "") === me();
              return (
                '<span class="cp-ev' + (e.status === "erledigt" ? " is-done" : "") + (byMe ? " is-coach" : "") + '">' +
                esc(timeOf(e.starts_at)) + " " + (EMOJI[e.category] || "") + " " + esc(e.title || e.category) +
                (e.status === "erledigt" ? " ✓" : "") +
                (byMe && e.status === "geplant"
                  ? '<button type="button" class="cp-ev__x" data-cp="del" data-id="' + esc(e.id) + '" aria-label="Entfernen">×</button>'
                  : "") +
                "</span>"
              );
            }).join("")
          : '<span class="cp-ev cp-ev--empty">frei</span>') +
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

  function footHtml() {
    return (
      '<section class="cp-sec cp-foot">' +
      '<button type="button" class="cp-btn cp-btn--ghost" data-cp="kurse">Kurs-Editor</button>' +
      '<button type="button" class="cp-link" data-cp="legacy">Altes Admin-Portal</button>' +
      "</section>"
    );
  }

  function paint() {
    if (!st || !st.root) return;
    var scroll = st.body ? st.body.scrollTop : 0;
    st.body.innerHTML = headHtml() + noteHtml() + weekHtml() + footHtml();
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
      loadWeek().then(paint);
      return;
    }
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
    Promise.all([loadPerson(), loadNote(), loadCourses(), loadWeek()]).then(paint);
  }

  global.GoCoachPortal = { open: open, close: close };
})(window);
