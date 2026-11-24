/* Woche Reels: Instagram-Stil, 7 Tage, Swipe Zeitraum */
(function (global) {
  var host = null;
  var state = {
    weekMode: "from_today", /* from_today | next_week */
    dayIndex: 0,
    eventIndex: 0,
    events: [],
    ffcEvents: [],
    rsvps: {},
    comments: {},
    people: {},
    friends: [],
    enrollments: [],
    courses: [],
    travelUntil: null,
    editMode: false,
    armTravel: false,
    armEdit: false,
    touch: null,
    loadError: "",
    sharePick: {},
    shareIso: "",
    shareEventId: "",
    lastDeleted: null,
    undoTimer: null,
    kraftTrainings: [],
    ausdauerTrainings: [],
    zirkelOk: false,
    invites: [],
    recent: [],
    pendingCreate: null
  };

  var TRAVEL_ALT_IMG = "/assets/gogogo/JumpRope.png";

  var ROOT_ID = "woche-reels";
  var REST_DAYS = ["Spaziergang", "Mobility", "Radfahren", "Sauna"];
  var ALTERNATIVE_CHOICES = [
    "> 5.000 Schritte",
    "> 10.000 Schritte",
    "> 20.000 Schritte",
    "Mannschaftssport",
    "Radtour",
    "Yoga / Pilates",
    "Fitnesskurs",
    "Tanzen"
  ];
  var TRAIN_CATS = { kraft: 1, ausdauer: 1, zirkel: 1 };
  var WEEK_MODES = [
    { id: "from_today", label: "Ab heute" },
    { id: "next_week", label: "Nächste Woche" }
  ];
  var CAT_LABELS = { kraft: "Kraft", ausdauer: "Ausdauer", zirkel: "Zirkel" };
  /* Spiegel der Trainingsliste → Kurse (idempotent per slug) */
  var TRAINING_DEFS = [
    { slug: "training-krafttraining", title: "Einfache Basics", category: "kraft" },
    { slug: "training-full", title: "Ganzkörpertraining", category: "kraft" },
    { slug: "training-upper", title: "Oberkörpertraining", category: "kraft" },
    { slug: "training-lower", title: "Unterkörpertraining", category: "kraft" },
    { slug: "training-legs", title: "Beintraining", category: "kraft" },
    { slug: "training-glutes", title: "Glutes/Legs", category: "kraft" },
    { slug: "training-athletic", title: "Athletic Day", category: "kraft" },
    { slug: "training-push", title: "Push Day", category: "kraft" },
    { slug: "training-pull", title: "Pull Day", category: "kraft" },
    { slug: "ausdauer-run", title: "Laufen", category: "ausdauer" },
    { slug: "ausdauer-bike", title: "Radfahren", category: "ausdauer" },
    { slug: "ausdauer-row", title: "Rudern", category: "ausdauer" },
    { slug: "ausdauer-swim", title: "Schwimmen", category: "ausdauer" },
    { slug: "ausdauer-walk", title: "Gehen", category: "ausdauer" },
    { slug: "ausdauer-hike", title: "Wandern", category: "ausdauer" },
    { slug: "training-zirkel", title: "Zirkeltraining", category: "zirkel" }
  ];
  var TRAVEL_MAX_DAYS = 14;

  var ICON_CHECK =
    '<svg class="wr-ico" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>';
  var ICON_CHECK_DONE =
    '<svg class="wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#111"/><path d="M8 12.5l2.5 2.5L16 9.5" fill="none" stroke="#F6F1E8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_COMMENT =
    '<svg class="wr-ico" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3H7.5A2.5 2.5 0 0 1 5 13.5v-7z"/></svg>';
  var ICON_SHARE =
    '<svg class="wr-ico" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.6 13h6.2M4.7 9.9v6.2"/><circle cx="15.4" cy="8" r="3.6"/><path d="M8.4 21.2c.7-4.6 3.6-7.2 7-7.2s6.3 2.6 7 7.2"/></svg>';

  var ICON_PLANE =
    '<svg class="wr-ico" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M18.55 3.75 L5.86 7.66 Q2.80 8.60 5.66 10.03 L10.66 12.53 Q11.20 12.80 11.47 13.34 L13.97 18.34 Q15.40 21.20 16.34 18.14 L20.25 5.45 Q21.00 3.00 18.55 3.75Z"/><path d="M19.80 4.00 11.20 12.80"/></svg>';

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function me() {
    return host && host.sessionAccount && host.sessionAccount.id
      ? String(host.sessionAccount.id)
      : "";
  }

  function rest(path, opts) {
    return host.rest(path, opts || {});
  }

  function berlinToday() {
    return host.todayIso ? host.todayIso() : new Date().toISOString().slice(0, 10);
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function localIso(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function mondayOf(iso) {
    var d = new Date(iso + "T12:00:00");
    var day = (d.getDay() + 6) % 7; /* 0=Mo */
    d.setDate(d.getDate() - day);
    return localIso(d);
  }

  function addDays(iso, n) {
    var d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return localIso(d);
  }

  function weekModeMeta() {
    for (var i = 0; i < WEEK_MODES.length; i++) {
      if (WEEK_MODES[i].id === state.weekMode) return WEEK_MODES[i];
    }
    return WEEK_MODES[0];
  }

  function weekStart() {
    var today = berlinToday();
    if (state.weekMode === "next_week") return addDays(mondayOf(today), 7);
    return today; /* Ab heute: rollend heute + 6 */
  }

  function weekDays() {
    var start = weekStart();
    var out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(start, i));
    return out;
  }

  function setWeekMode(mode) {
    var ok = false;
    for (var i = 0; i < WEEK_MODES.length; i++) {
      if (WEEK_MODES[i].id === mode) ok = true;
    }
    if (!ok) mode = "from_today";
    state.weekMode = mode;
    state.dayIndex = 0;
  }

  function cycleWeekMode(dir) {
    var ix = 0;
    for (var i = 0; i < WEEK_MODES.length; i++) {
      if (WEEK_MODES[i].id === state.weekMode) ix = i;
    }
    ix = (ix + dir + WEEK_MODES.length) % WEEK_MODES.length;
    setWeekMode(WEEK_MODES[ix].id);
  }

  function dayKey(ts) {
    try {
      return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    } catch (e) {
      return String(ts || "").slice(0, 10);
    }
  }

  function formatWeekday(iso) {
    try {
      return new Date(iso + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", timeZone: "Europe/Berlin" });
    } catch (e) {
      return iso;
    }
  }

  function formatDayLong(iso) {
    try {
      return new Date(iso + "T12:00:00").toLocaleDateString("de-DE", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Berlin"
      });
    } catch (e) {
      return iso;
    }
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin"
      });
    } catch (e) {
      return "";
    }
  }

  /* Anzeige: Plan-Events ohne gewählte Uhrzeit (genau 12:00 UTC) zeigen keine Uhrzeit */
  function displayTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    if (d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return "";
    return formatTime(ts);
  }

  function toneClass(cat) {
    if (cat === "zirkel") return "tone-zirkel";
    if (cat === "ausdauer") return "tone-ausdauer";
    if (cat === "alternative") return "tone-alternative";
    return "tone-kraft-basics";
  }

  function emojiFor(cat, title) {
    if (host && host.activityEmoji) {
      return host.activityEmoji({ kind: cat, label: title || cat }) || "";
    }
    if (cat === "zirkel") return "🔥";
    if (cat === "ausdauer") return "🏃";
    if (cat === "alternative") return "🌿";
    return "🏋️";
  }

  /* Countdown ab 07:00 Berlin bis Startzeit */

  /* Zirkel-Einstellungen liegen in events.note: "zirkel:team|work=240|pause=30|rounds=7" */
  function parseZirkelNote(note) {
    return GoZirkelSetup.parse(note);
  }

  function zirkelLabel(z) {
    return GoZirkelSetup.label(z);
  }

  /* Admin = Ersteller: am Eventtag Countdown anhalten bzw. wieder starten (für alle Teilnehmer synchron) */
  function zirkelAdminHtml(ev, z, iso) {
    if (!z || !ev || String(ev.user_id) !== String(me())) return "";
    if (ev.status === "erledigt" || iso !== berlinToday()) return "";
    var held = z.hold && !z.goAt;
    var target = z.goAt || new Date(ev.starts_at).getTime();
    /* Sofortstart: alle Teilnehmer starten zusammen, solange es noch nicht läuft */
    var now = held || target > Date.now() + 15000;
    return (
      '<button type="button" class="go-online-cta go-online-cta--ghost" data-wr-zadmin="' +
      (held ? "go" : "hold") + '" data-id="' + esc(ev.id) + '">' +
      (held ? "Starten" : "Anhalten") +
      "</button>" +
      (now
        ? '<button type="button" class="go-online-cta go-online-cta--ghost" data-wr-zadmin="now" data-id="' + esc(ev.id) + '">Sofortstart</button>'
        : "")
    );
  }

  function zirkelCountdownHtml(startsAt) {
    if (!startsAt) return "";
    var start = new Date(startsAt).getTime();
    if (!isFinite(start)) return "";
    var now = Date.now();
    if (start <= now) {
      return '<p class="wr-zirkel-cd">Jetzt starten</p>';
    }
    var day = dayKey(startsAt);
    var gate = new Date(startsAt);
    try {
      /* 07:00 am Event-Tag (Berlin) als Anzeigefenster-Start */
      var parts = String(day).split("-");
      gate = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
        7,
        0,
        0,
        0
      );
    } catch (eG) {}
    /* vor 7:00 am Eventtag kein Countdown („ab 7:00“ las sich wie die Startzeit) */
    if (now < gate.getTime()) return "";
    var sec = Math.max(0, Math.floor((start - now) / 1000));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    function two(n) {
      return (n < 10 ? "0" : "") + n;
    }
    var label = (h > 0 ? h + ":" : "") + two(m) + ":" + two(s);
    return (
      '<p class="wr-zirkel-cd" data-wr-cd-start="' +
      esc(String(start)) +
      '">' +
      esc(label) +
      "</p>"
    );
  }

  /* Countdown in Woche läuft sekundengenau mit */
  setInterval(function () {
    var els = document.querySelectorAll(".wr-zirkel-cd[data-wr-cd-start]");
    if (!els.length) return;
    var now = Date.now();
    [].forEach.call(els, function (el) {
      var start = Number(el.getAttribute("data-wr-cd-start"));
      if (!isFinite(start)) return;
      var sec = Math.max(0, Math.floor((start - now) / 1000));
      if (sec <= 0) { el.textContent = "läuft"; el.removeAttribute("data-wr-cd-start"); return; }
      var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
      el.textContent = (h > 0 ? h + ":" : "") + (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x;
    });
  }, 1000);

  function loadTravelPref() {
    var fromHost = null;
    try {
      if (host && typeof host.getTravelUntil === "function") {
        fromHost = host.getTravelUntil();
      }
    } catch (eH) {}
    try {
      var raw = localStorage.getItem("gogogo_woche_travel_" + me());
      state.travelUntil = fromHost || raw || null;
      if (fromHost && fromHost !== raw) {
        localStorage.setItem("gogogo_woche_travel_" + me(), fromHost);
      }
      state.travelStart =
        localStorage.getItem("gogogo_woche_travel_start_" + me()) || null;
    } catch (e) {
      state.travelUntil = fromHost || null;
    }
  }

  function saveTravelPref(iso, startIso) {
    state.travelUntil = iso || null;
    state.travelStart = startIso || (iso ? berlinToday() : null);
    try {
      var key = "gogogo_woche_travel_" + me();
      if (iso) localStorage.setItem(key, iso);
      else localStorage.removeItem(key);
      var sk = "gogogo_woche_travel_start_" + me();
      if (startIso) localStorage.setItem(sk, startIso);
      else localStorage.removeItem(sk);
    } catch (e) {}
    try {
      if (host && typeof host.setTravelUntil === "function") {
        host.setTravelUntil(iso || null, startIso || null);
      }
    } catch (eH2) {}
  }

  function travelSnapKey() {
    return "gogogo_travel_snap_" + me();
  }

  function loadTravelSnap() {
    try {
      var raw = localStorage.getItem(travelSnapKey());
      if (!raw) return { events: {}, plan: {} };
      var parsed = JSON.parse(raw);
      return {
        events: (parsed && parsed.events) || {},
        plan: (parsed && parsed.plan) || {}
      };
    } catch (e) {
      return { events: {}, plan: {} };
    }
  }

  function saveTravelSnap(snap) {
    try {
      localStorage.setItem(travelSnapKey(), JSON.stringify(snap || { events: {}, plan: {} }));
    } catch (e) {}
  }

  function clearTravelSnap() {
    try {
      localStorage.removeItem(travelSnapKey());
    } catch (e) {}
  }

  function rememberEventBeforeTravel(ev) {
    if (!ev || !ev.id) return;
    var snap = loadTravelSnap();
    var id = String(ev.id);
    if (snap.events[id]) return;
    snap.events[id] = {
      category: ev.category,
      course_id: ev.course_id,
      enrollment_id: ev.enrollment_id,
      title: ev.title,
      starts_at: ev.starts_at,
      location: ev.location,
      visibility: ev.visibility || "team",
      is_unplanned: !!ev.is_unplanned,
      item_type: ev.item_type || "event",
      travel_auto: false,
      note: ev.note || null,
      status: ev.status || "geplant"
    };
    saveTravelSnap(snap);
  }

  function snapshotPlanForTravel() {
    if (!host || typeof host.getPlanUnits !== "function") return;
    try {
      var units = host.getPlanUnits() || {};
      var snap = loadTravelSnap();
      if (snap.plan && Object.keys(snap.plan).length) return;
      snap.plan = JSON.parse(JSON.stringify(units));
      saveTravelSnap(snap);
    } catch (e) {}
  }

  function travelActive() {
    return !!(state.travelUntil && state.travelUntil >= berlinToday());
  }

  function ensurePeople(ids) {
    var uniq = [];
    var seen = {};
    (ids || []).forEach(function (id) {
      id = String(id || "");
      if (!id || seen[id] || state.people[id]) return;
      seen[id] = true;
      uniq.push(id);
    });
    if (!uniq.length) return Promise.resolve();
    return rest(
      "go_accounts?id=in.(" +
        uniq.map(encodeURIComponent).join(",") +
        ")&select=id,name,photo_url"
    )
      .then(function (rows) {
        (rows || []).forEach(function (r) {
          if (r && r.id) {
            state.people[String(r.id)] = {
              id: String(r.id),
              name: r.name || "?",
              photo: r.photo_url || ""
            };
          }
        });
      })
      .catch(function () {});
  }

  function personOf(id) {
    id = String(id || "");
    if (state.people[id]) return state.people[id];
    if (host && host.sessionAccount && String(host.sessionAccount.id) === id) {
      return {
        id: id,
        name: host.sessionAccount.name || "Ich",
        photo: host.sessionAccount.photo_url || ""
      };
    }
    var tp = (host.teamPeople || []).filter(function (p) {
      return p && String(p.id) === id;
    })[0];
    if (tp) {
      return { id: id, name: tp.name || "?", photo: tp.photo_url || tp.photo || "" };
    }
    return { id: id, name: "?", photo: "" };
  }

  function loadEvents() {
    var id = me();
    if (!id) {
      state.events = [];
      return Promise.resolve();
    }
    var start = weekStart();
    var end = addDays(start, 7);
    /* Basis-Select zuerst (kompatibel ohne SQL-Migration) */
    var baseSelect =
      "id,user_id,course_id,enrollment_id,category,starts_at,location,visibility,is_unplanned,status,title";
    var richSelect =
      baseSelect + ",item_type,travel_auto,group_id,note,photo_url,course_session_id,courses(id,title,category_default)";
    function query(select) {
      return rest(
        "events?user_id=eq." +
          encodeURIComponent(id) +
          "&select=" +
          select +
          "&starts_at=gte." +
          encodeURIComponent(start + "T00:00:00+01:00") +
          "&starts_at=lt." +
          encodeURIComponent(end + "T00:00:00+01:00") +
          "&order=starts_at.asc&limit=200"
      );
    }
    /* bubble_id erst nach go-bubbles.sql vorhanden */
    return query(richSelect + ",bubble_id")
      .catch(function () { return query(richSelect); })
      .catch(function () {
        return query(baseSelect + ",courses(id,title)").catch(function () {
          return query(baseSelect);
        });
      })
      .then(function (rows) {
        state.events = rows || [];
        return loadJoinedEvents(start, end, richSelect).then(function () {
          return loadInvitedEvents(start, end, richSelect);
        });
      })
      .then(function () {
        return mergeEventMediaFromActivity(state.events).then(function () {
          return ensurePeople(
            state.events.map(function (e) {
              return e.user_id;
            })
          );
        });
      })
      .catch(function (err) {
        state.events = [];
        state.loadError = state.loadError || "Events konnten nicht geladen werden.";
        return null;
      });
  }

  /* Events anderer, denen ich zugesagt habe (z. B. Zirkel der Gruppe) — nur ansehen/austreten */
  function loadJoinedEvents(start, end, select) {
    state.joined = [];
    return rest("event_rsvps?user_id=eq." + encodeURIComponent(me()) + "&status=eq.zugesagt&select=event_id&limit=300")
      .then(function (rs) {
        var ids = (rs || []).map(function (r) { return String(r.event_id); });
        if (!ids.length) return [];
        return rest(
          "events?id=in.(" + ids.map(encodeURIComponent).join(",") + ")&user_id=neq." + encodeURIComponent(me()) +
            "&status=neq.ausgefallen&starts_at=gte." + encodeURIComponent(start + "T00:00:00+01:00") +
            "&starts_at=lt." + encodeURIComponent(end + "T00:00:00+01:00") + "&select=" + select
        );
      })
      .then(function (rows) {
        state.joined = rows || [];
      })
      .catch(function () { state.joined = []; });
  }

  /* Offene Einladungen von Freunden zu ihren Events: in Woche zusagen, dann steht die Serie hier jede Woche */
  function loadInvitedEvents(start, end, select) {
    state.invited = [];
    return rest(
      "go_workout_invites?to_id=eq." + encodeURIComponent(me()) + "&status=eq.pending&event_id=not.is.null" +
        "&workout_date=gte." + encodeURIComponent(start) + "&workout_date=lt." + encodeURIComponent(end) +
        "&select=id,event_id,from_id,workout_date,workout_label,meet_time,invite_kind&limit=100"
    )
      .then(function (inv) {
        var have = {};
        (state.joined || []).forEach(function (j) { have[String(j.id)] = true; });
        var byEv = {};
        (inv || []).forEach(function (r) {
          if (r && r.event_id && !have[String(r.event_id)] && !byEv[String(r.event_id)]) byEv[String(r.event_id)] = r;
        });
        var ids = Object.keys(byEv);
        if (!ids.length) return;
        return rest(
          "events?id=in.(" + ids.map(encodeURIComponent).join(",") + ")&user_id=neq." + encodeURIComponent(me()) +
            "&status=neq.ausgefallen&select=" + select
        ).then(function (rows) {
          state.invited = (rows || []).map(function (ev) {
            ev._inv = byEv[String(ev.id)];
            return ev;
          });
          return ensurePeople(state.invited.map(function (ev) { return ev.user_id; }));
        });
      })
      .catch(function () { state.invited = []; });
  }

  /* Zusage/Absage gilt für die ganze Serie: gleicher Absender, Titel und Wochentag ab diesem Termin */
  function answerInvite(inviteId, yes) {
    var ev = (state.invited || []).filter(function (x) { return x._inv && String(x._inv.id) === String(inviteId); })[0];
    if (!ev) return Promise.resolve();
    var inv = ev._inv;
    var wd = new Date(String(inv.workout_date).slice(0, 10) + "T12:00:00").getDay();
    return rest(
      "go_workout_invites?to_id=eq." + encodeURIComponent(me()) + "&from_id=eq." + encodeURIComponent(inv.from_id) +
        "&workout_label=eq." + encodeURIComponent(inv.workout_label || "") +
        "&workout_date=gte." + encodeURIComponent(String(inv.workout_date).slice(0, 10)) +
        "&status=eq.pending&select=id,event_id,workout_date&limit=60"
    )
      .catch(function () { return []; })
      .then(function (rows) {
        var list = (rows || []).filter(function (r) {
          return new Date(String(r.workout_date).slice(0, 10) + "T12:00:00").getDay() === wd;
        });
        if (!list.some(function (r) { return String(r.id) === String(inv.id); })) list.unshift(inv);
        var patch = rest("go_workout_invites?id=in.(" + list.map(function (r) { return encodeURIComponent(r.id); }).join(",") + ")", {
          method: "PATCH", prefer: "return=minimal", body: { status: yes ? "accepted" : "declined" }
        });
        var evIds = list.map(function (r) { return r.event_id; }).filter(Boolean);
        var rsvp = yes && evIds.length
          ? rest("event_rsvps?on_conflict=event_id,user_id", {
              method: "POST",
              prefer: "resolution=merge-duplicates,return=minimal",
              body: evIds.map(function (id) { return { event_id: id, user_id: me(), status: "zugesagt" }; })
            }).catch(function () {})
          : null;
        return Promise.all([patch, rsvp]).then(function () {
          if (host.toast) host.toast(yes ? (list.length > 1 ? "Dabei, jede Woche" : "Dabei") : "Abgesagt");
          if (host.loadInvites) { try { host.loadInvites(); } catch (eL) {} }
          notifyAktuell();
          return refreshKeepDay(dayKey(ev.starts_at));
        });
      })
      .catch(function () {
        if (host.toast) host.toast(yes ? "Zusagen ging gerade nicht" : "Absagen ging gerade nicht");
      });
  }

  function mergeEventMediaFromActivity(events) {
    var list = events || [];
    var need = list.filter(function (e) {
      return e && e.status === "erledigt" && e.id && (!(e.note && String(e.note).trim()) || !e.photo_url);
    });
    if (!need.length) return Promise.resolve();
    return rest(
      "go_community_posts?body=like." +
        encodeURIComponent("*[[e:*") +
        "&select=id,author_id,body,photo_url,created_at&order=created_at.desc&limit=300"
    )
      .then(function (rows) {
        var byRef = {};
        (rows || []).forEach(function (r) {
          var body = String(r.body || "");
          var m = body.match(/\[\[e:([0-9a-f-]{36})\]\]/i);
          if (!m) return;
          var rid = String(m[1]);
          if (byRef[rid]) return;
          var raw = String(r.photo_url || "");
          var packed = null;
          if (raw.charAt(0) === "{") {
            try {
              packed = JSON.parse(raw);
            } catch (e) {
              packed = null;
            }
          }
          byRef[rid] = {
            note: (packed && packed.note) || body.replace(/\[\[e:[0-9a-f-]{36}\]\]/i, "").trim() || "",
            photo_url:
              (packed && (packed.photo_url || packed.photo)) || (!packed ? raw : "") || ""
          };
        });
        list.forEach(function (e) {
          var meta = byRef[String(e.id)];
          if (!meta) return;
          if (!(e.note && String(e.note).trim()) && meta.note) e.note = meta.note;
          if (!e.photo_url && meta.photo_url) e.photo_url = meta.photo_url;
        });
      })
      .catch(function () {});
  }

  function loadFfc() {
    state.ffcEvents = [];
    /* Zirkel-Login eines anderen gogogo-Kontos: dessen Zirkel nicht in dieser Woche zeigen */
    if (!ffcOk() || !FFC.events) return Promise.resolve();
    try {
      var start = weekStart();
      var end = addDays(start, 7);
      state.ffcEvents = (FFC.events() || []).filter(function (ev) {
        var d = dayKey(ev.starts_at);
        return d >= start && d < end;
      });
    } catch (e) {
      state.ffcEvents = [];
    }
    return Promise.resolve();
  }

  function loadRsvps(ids) {
    state.rsvps = {};
    if (!ids.length) return Promise.resolve();
    return rest(
      "event_rsvps?event_id=in.(" +
        ids.map(encodeURIComponent).join(",") +
        ")&status=eq.zugesagt&select=event_id,user_id"
    )
      .then(function (rows) {
        var pids = [];
        (rows || []).forEach(function (r) {
          var eid = String(r.event_id);
          if (!state.rsvps[eid]) state.rsvps[eid] = [];
          state.rsvps[eid].push(String(r.user_id));
          pids.push(String(r.user_id));
        });
        return ensurePeople(pids);
      })
      .catch(function () {});
  }

  function commentMarker(eventId) {
    return "[[c:" + String(eventId) + "]]";
  }

  function saveCommentFallback(eventId, text) {
    return rest("go_community_posts", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        author_id: me(),
        kind: "text",
        body: (commentMarker(eventId) + "\n" + text).slice(0, 144),
        photo_url: JSON.stringify({ text: text })
      }
    });
  }

  function loadCommentFallbacks(ids) {
    var want = {};
    (ids || []).forEach(function (id) {
      want[String(id)] = true;
    });
    return rest(
      "go_community_posts?body=like." +
        encodeURIComponent("*[[c:*") +
        "&select=id,author_id,body,photo_url,created_at&order=created_at.asc&limit=400"
    )
      .then(function (rows) {
        (rows || []).forEach(function (r) {
          var body = String(r.body || "");
          var m = body.match(/\[\[c:([^\]]+)\]\]/i);
          if (!m) return;
          var eid = String(m[1]);
          if (ids && ids.length && !want[eid]) return;
          var text = "";
          var raw = String(r.photo_url || "");
          if (raw.charAt(0) === "{") {
            try {
              var packed = JSON.parse(raw);
              if (packed && packed.text) text = String(packed.text);
            } catch (e) {}
          }
          if (!text) text = body.replace(/\[\[c:[^\]]+\]\]/i, "").trim();
          if (!text) return;
          if (!state.comments[eid]) state.comments[eid] = [];
          var exists = state.comments[eid].some(function (c) {
            return String(c.id) === String(r.id);
          });
          if (exists) return;
          state.comments[eid].push({
            id: r.id,
            event_id: eid,
            account_id: r.author_id,
            text: text,
            created_at: r.created_at
          });
        });
      })
      .catch(function () {});
  }

  function loadComments(ids) {
    state.comments = {};
    if (!ids.length) return Promise.resolve();
    return rest(
      "event_comments?event_id=in.(" +
        ids.map(encodeURIComponent).join(",") +
        ")&select=id,event_id,account_id,text,created_at&order=created_at.asc&limit=500"
    )
      .then(function (rows) {
        (rows || []).forEach(function (c) {
          var eid = String(c.event_id);
          if (!state.comments[eid]) state.comments[eid] = [];
          state.comments[eid].push(c);
        });
        return ensurePeople(
          (rows || []).map(function (c) {
            return c.account_id;
          })
        );
      })
      .catch(function () {})
      .then(function () {
        return loadCommentFallbacks(ids);
      });
  }

  function loadEnrollments() {
    var id = me();
    if (!id) {
      state.enrollments = [];
      return Promise.resolve();
    }
    return rest(
      "enrollments?user_id=eq." +
        encodeURIComponent(id) +
        "&status=eq.aktiv&select=id,course_id,status,start_date,weekdays,payment_status,courses(id,title,slug,duration_weeks,sessions_per_week,price_eur,category_default,level)"
    )
      .then(function (rows) {
        state.enrollments = rows || [];
        state.enrollLoaded = true;
      })
      .catch(function () {
        return rest(
          "enrollments?user_id=eq." +
            encodeURIComponent(id) +
            "&status=eq.aktiv&select=id,course_id,status,start_date,weekdays,courses(id,title,slug,duration_weeks,sessions_per_week,price_eur,category_default,level)"
        )
          .then(function (rows) {
            state.enrollments = rows || [];
            state.enrollLoaded = true;
          })
          .catch(function () {
            state.enrollments = [];
            state.enrollLoaded = true;
          });
      });
  }

  function loadCourses() {
    var id = me();
    var select =
      "id,title,slug,level,duration_weeks,sessions_per_week,category_default,price_eur,description,private_for,is_system";
    function ok(rows) {
      state.courses = (rows || []).filter(function (c) {
        return !c.is_system;
      });
    }
    return rest(
      "courses?is_active=eq.true&or=(private_for.is.null,private_for.eq." +
        encodeURIComponent(id) +
        ")&select=" +
        select +
        "&order=category_default.asc,title.asc&limit=80"
    )
      .then(ok)
      .catch(function () {
        return rest(
          "courses?is_active=eq.true&or=(private_for.is.null,private_for.eq." +
            encodeURIComponent(id) +
            ")&select=id,title,slug,level,duration_weeks,sessions_per_week,category_default,price_eur,description,private_for&order=title.asc&limit=80"
        )
          .then(function (rows) {
            state.courses = rows || [];
          })
          .catch(function () {
            state.courses = [];
          });
      });
  }

  function kraftNameMap() {
    var names = {
      krafttraining: "Einfache Basics",
      full: "Ganzkörpertraining",
      upper: "Oberkörpertraining",
      lower: "Unterkörpertraining",
      legs: "Beintraining",
      glutes: "Glutes/Legs",
      athletic: "Athletic Day",
      push: "Push Day",
      pull: "Pull Day"
    };
    var cat = global.GOGOGO_KRAFT;
    if (cat && cat.SYSTEMS) {
      cat.SYSTEMS.forEach(function (sys) {
        if (sys && sys.id && sys.name) names[sys.id] = sys.name;
      });
    }
    return names;
  }

  function ausdauerTechName(tech) {
    var map = {
      run: "Laufen",
      bike: "Radfahren",
      indoor: "Radfahren",
      row: "Rudern",
      swim: "Schwimmen",
      walk: "Gehen",
      hike: "Wandern",
      xc: "Crosstrainer"
    };
    return map[tech] || tech || "Ausdauer";
  }

  function loadTrainingLists() {
    var id = me();
    if (!id) {
      state.kraftTrainings = [];
      state.ausdauerTrainings = [];
      state.zirkelOk = false;
      return Promise.resolve();
    }
    if (host && typeof host.kraftChoices === "function") {
      try {
        state.kraftTrainings = (host.kraftChoices() || []).map(function (c) {
          return {
            label: c.label,
            systemId: c.systemId || "krafttraining",
            slug: "training-" + (c.systemId || "krafttraining")
          };
        });
      } catch (eK) {}
    }
    if (host && typeof host.ausdauerChoices === "function") {
      try {
        state.ausdauerTrainings = (host.ausdauerChoices() || []).map(function (c) {
          var tech = c.technique || "run";
          return {
            label: c.label,
            technique: tech,
            presetId: c.presetId || "",
            slug: c.presetId
              ? "ausdauer-preset-" + String(c.presetId).slice(0, 8)
              : "ausdauer-" + tech
          };
        });
      } catch (eA) {}
    }
    return Promise.all([
      rest(
        "go_kraft_presets?account_id=eq." +
          encodeURIComponent(id) +
          "&select=system_id,exercise_ids"
      ).catch(function () {
        return [];
      }),
      rest(
        "go_ausdauer_presets?account_id=eq." +
          encodeURIComponent(id) +
          "&select=id,technique,incline,duration_min,speed,distance_km,source"
      ).catch(function () {
        return [];
      })
    ]).then(function (pack) {
      var names = kraftNameMap();
      var kraftRows = pack[0] || [];
      var fromDb = [];
      kraftRows.forEach(function (row) {
        if (!row || !row.system_id) return;
        var ids = row.exercise_ids;
        if (typeof ids === "string") {
          try {
            ids = JSON.parse(ids);
          } catch (e) {
            ids = [];
          }
        }
        if (!Array.isArray(ids) || !ids.length) return;
        var sid = String(row.system_id);
        fromDb.push({
          label: names[sid] || sid,
          systemId: sid,
          slug: "training-" + sid
        });
      });
      if (fromDb.length) state.kraftTrainings = fromDb;
      if (!state.kraftTrainings.length) {
        /* Fallback: Katalog wie kraftChoices() */
        state.kraftTrainings = Object.keys(names).map(function (sid) {
          return {
            label: names[sid],
            systemId: sid,
            slug: "training-" + sid
          };
        });
      }

      var ausRows = pack[1] || [];
      var ausList = [];
      ausRows.forEach(function (row) {
        if (!row) return;
        var tech = String(row.technique || "");
        var name = ausdauerTechName(tech);
        var bits = [];
        if (row.duration_min != null && row.duration_min !== "") {
          bits.push(String(row.duration_min) + " min");
        }
        if (row.distance_km != null && row.distance_km !== "") {
          bits.push(String(row.distance_km) + " km");
        }
        ausList.push({
          label: bits.length ? name + " · " + bits.join(" · ") : name,
          technique: tech,
          presetId: String(row.id || ""),
          slug: row.id
            ? "ausdauer-preset-" + String(row.id).replace(/-/g, "").slice(0, 12)
            : "ausdauer-" + (tech || "run")
        });
      });
      if (ausList.length) state.ausdauerTrainings = ausList;
      if (!state.ausdauerTrainings.length) {
        state.ausdauerTrainings = ["run", "bike", "row", "swim", "walk", "hike"].map(
          function (tech) {
            return {
              label: ausdauerTechName(tech),
              technique: tech,
              presetId: "",
              slug: "ausdauer-" + tech
            };
          }
        );
      }
      syncZirkelAccess();
    });
  }

  function syncZirkelAccess() {
    state.zirkelOk = (state.enrollments || []).some(function (en) {
      var c = en.courses || {};
      var slug = String(c.slug || "");
      return (
        slug === "zirkeltraining" ||
        slug === "training-zirkel" ||
        c.category_default === "zirkel"
      );
    });
    if (host && host.hasZirkelAccess) {
      try {
        if (host.hasZirkelAccess()) state.zirkelOk = true;
      } catch (eZ) {}
    }
  }

  function ensureCourseByDef(def) {
    if (!def || !def.slug) return Promise.resolve(null);
    var found = (state.courses || []).filter(function (c) {
      return c && c.slug === def.slug;
    })[0];
    if (found) return Promise.resolve(found);
    return rest(
      "courses?slug=eq." + encodeURIComponent(def.slug) + "&select=id,title,slug,category_default,is_active&limit=1"
    )
      .then(function (rows) {
        var row = rows && rows[0];
        if (row) {
          if (row.is_active === false) {
            return rest("courses?id=eq." + encodeURIComponent(row.id), {
              method: "PATCH",
              prefer: "return=representation",
              body: { is_active: true }
            }).then(function (updated) {
              var u = Array.isArray(updated) ? updated[0] : updated;
              return u || row;
            });
          }
          return row;
        }
        return rest("courses", {
          method: "POST",
          prefer: "return=representation",
          body: {
            title: def.title || def.label,
            slug: def.slug,
            category_default: def.category || "kraft",
            duration_weeks: 1,
            sessions_per_week: 1,
            price_eur: 0,
            description: "Training → Kurs",
            coach_id: me(),
            source: "own",
            is_active: true
          }
        }).then(function (created) {
          return Array.isArray(created) ? created[0] : created;
        });
      })
      .then(function (course) {
        if (course && course.id) {
          var exists = state.courses.some(function (c) {
            return String(c.id) === String(course.id);
          });
          if (!exists) state.courses.push(course);
        }
        return course;
      })
      .catch(function () {
        return null;
      });
  }

  function loadFriends() {
    var id = me();
    if (!id) {
      state.friends = [];
      return Promise.resolve();
    }
    return Promise.all([
      rest(
        "go_friends?account_id=eq." +
          encodeURIComponent(id) +
          "&select=friend_id"
      ).catch(function () {
        return [];
      }),
      rest(
        "go_friends?friend_id=eq." +
          encodeURIComponent(id) +
          "&select=account_id"
      ).catch(function () {
        return [];
      })
    ]).then(function (parts) {
      var ids = [];
      (parts[0] || []).forEach(function (r) {
        if (r && r.friend_id) ids.push(String(r.friend_id));
      });
      (parts[1] || []).forEach(function (r) {
        if (r && r.account_id) ids.push(String(r.account_id));
      });
      var uniq = [];
      ids.forEach(function (fid) {
        if (fid && fid !== id && uniq.indexOf(fid) < 0) uniq.push(fid);
      });
      state.friends = uniq;
      return ensurePeople(uniq);
    });
  }

  function coursesByCategory() {
    var groups = { kraft: [], ausdauer: [], zirkel: [] };
    (state.courses || []).forEach(function (c) {
      var cat = c.category_default || "kraft";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
    });
    return groups;
  }

  /* ---------- Kalender zeigt nur Wiederkehrendes (Einzeltermine stehen in Aktuell) ----------
     Wiederkehrend: Wochenplan (enrollment / Plan-Vorlage), Reise-Ersatz für den Plan, Gruppen-Events,
     Serien-Einladungen, oder dasselbe Event (Titel, Wochentag, Uhrzeit) in mindestens zwei Wochen. */
  function seriesKey(title, ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    var wd = "";
    try { wd = d.toLocaleDateString("de-DE", { weekday: "short", timeZone: "Europe/Berlin" }); } catch (e) { wd = String(d.getDay()); }
    /* ohne Uhrzeit: ein einzeln verschobener Start („Start verschoben“) bleibt Teil der Serie */
    return String(title || "").trim().toLowerCase() + "|" + wd;
  }
  function loadSeriesKeys() {
    var id = me();
    if (!id) { state.seriesKeys = {}; return Promise.resolve(); }
    var start = addDays(weekStart(), -35);
    var end = addDays(weekStart(), 42);
    return rest(
      "events?user_id=eq." + encodeURIComponent(id) + "&status=neq.ausgefallen" +
        "&starts_at=gte." + encodeURIComponent(start + "T00:00:00+01:00") +
        "&starts_at=lt." + encodeURIComponent(end + "T00:00:00+01:00") +
        "&select=title,starts_at&order=starts_at.asc&limit=1000"
    ).then(function (rows) {
      var weeks = {};
      var times = {};
      (rows || []).forEach(function (r) {
        var k = seriesKey(r.title, r.starts_at);
        if (!k) return;
        (weeks[k] = weeks[k] || {})[dayKey(r.starts_at)] = true;
        var t = displayTime(r.starts_at);
        if (t) { var tk = times[k] = times[k] || {}; tk[t] = (tk[t] || 0) + 1; }
      });
      var out = {};
      var mode = {};
      Object.keys(weeks).forEach(function (k) {
        if (Object.keys(weeks[k]).length < 2) return;
        out[k] = true;
        /* übliche Uhrzeit der Serie (häufigste), damit ein einzeln verschobener Start hier nicht erscheint */
        var best = "", n = 0;
        Object.keys(times[k] || {}).forEach(function (t) { if (times[k][t] > n) { n = times[k][t]; best = t; } });
        if (best) mode[k] = best;
      });
      state.seriesKeys = out;
      state.seriesTime = mode;
    }).catch(function () { state.seriesKeys = null; });
  }
  function isRecurringItem(it) {
    if (!it || !it.ev) return false;
    var ev = it.ev;
    if (it._fromPlan || ev.enrollment_id) return true;
    if (it.kind === "invited") return true;
    if (it.kind === "ffc" || it.kind === "pt") return false;
    if (ev.travel_auto || ev.item_type === "hotel_workout") return true;
    if (isSupportEvent(ev) || ev.is_unplanned) return false;
    /* Serien noch nicht geladen: lieber zeigen als leer */
    if (!state.seriesKeys) return true;
    return !!state.seriesKeys[seriesKey(ev.title, ev.starts_at)];
  }
  /* Einmalig, aber vereinbart: Coaching (mit Coachee oder Coach), Gruppe, Circle, vom Coach eingetragen.
     Diese stehen mit Datum im Kalender. */
  function isAgreedOnce(it) {
    if (!it || !it.ev) return false;
    var ev = it.ev;
    if (it.kind === "pt" || it.kind === "ffc" || it.kind === "joined") return true;
    return !!(ev.group_id || ev.circle_id || ev.assigned_by || ev.item_type === "support_session");
  }
  function kalenderItem(it) {
    if (isRecurringItem(it)) return true;
    if (isAgreedOnce(it)) { it._once = true; return true; }
    return false;
  }

  /* Kalender zeigt immer die globale Woche: individuelle Änderungen an einem Plan-Termin (Foto, Titel,
     verschobener Start, ersetzt oder ausgefallen) stehen nur in Aktuell. Reise-Ersatz bleibt sichtbar. */
  function isTravelAlt(it) {
    return !!(it && it.ev && (it.ev.travel_auto || it.ev.item_type === "hotel_workout"));
  }
  function globalPlanFor(iso) {
    try { return host && host.planItemForDay ? host.planItemForDay(iso) : null; } catch (e) { return null; }
  }
  function globalize(it, plan) {
    if (!it || !it.ev || it._fromPlan || isTravelAlt(it) || !it.ev.enrollment_id) return it;
    var ev = Object.assign({}, it.ev, { photo_url: null });
    if (plan) {
      ev.title = plan.title || ev.title;
      if (plan.location) ev.location = plan.location;
    }
    var usual = (state.seriesTime || {})[seriesKey(it.ev.title, it.ev.starts_at)];
    if (usual && usual !== displayTime(ev.starts_at)) ev.starts_at = timedStarts(dayKey(ev.starts_at), ("0" + usual).slice(-5)) || ev.starts_at;
    return Object.assign({}, it, { ev: ev, starts_at: ev.starts_at });
  }
  function itemsForDay(iso) {
    var list = itemsForDayAll(iso).filter(kalenderItem);
    var plan = globalPlanFor(iso);
    var hasPlan = list.some(function (it) { return it._fromPlan || isTravelAlt(it) || (it.ev && it.ev.enrollment_id); });
    if (!hasPlan && plan && plan.title) {
      list.push({ kind: "event", starts_at: plan.starts_at, ev: plan, _fromPlan: true });
      list.sort(function (a, b) { return String(a.starts_at).localeCompare(String(b.starts_at)); });
    }
    return list.map(function (it) { return globalize(it, plan); });
  }

  function itemsForDayAll(iso) {
    var list = [];
    state.events.forEach(function (ev) {
      if (dayKey(ev.starts_at) === iso && ev.status !== "ausgefallen") {
        list.push({ kind: "event", starts_at: ev.starts_at, ev: ev });
      }
    });
    /* FFC-Circle-Event, das aus meinem eigenen Zirkel entstanden ist (Mit Circle teilen): nicht doppelt zeigen */
    var ownZ = list.filter(function (it) {
      return it.ev && String(it.ev.user_id) === me() && (it.ev.category === "zirkel" || /zirkel/i.test(String(it.ev.title || "")));
    });
    state.ffcEvents.forEach(function (ev) {
      if (dayKey(ev.starts_at) !== iso) return;
      var t = new Date(ev.starts_at).getTime();
      var dup = ownZ.some(function (it) { return Math.abs(new Date(it.ev.starts_at).getTime() - t) <= 30 * 60000; });
      if (!dup) list.push({ kind: "ffc", starts_at: ev.starts_at, ev: ev });
    });
    (state.joined || []).forEach(function (ev) {
      if (dayKey(ev.starts_at) === iso) list.push({ kind: "joined", starts_at: ev.starts_at, ev: ev });
    });
    (state.invited || []).forEach(function (ev) {
      if (dayKey(ev.starts_at) === iso) list.push({ kind: "invited", starts_at: ev.starts_at, ev: ev });
    });
    /* Coaching-Termine (go_pt_sessions): als Coach mit dem Coachee, als Coachee mit dem Coach */
    var pts = [];
    try { pts = host && host.ptSessionsForDay ? host.ptSessionsForDay(iso) || [] : []; } catch (ePt) { pts = []; }
    pts.forEach(function (ps) {
      if (!ps || !ps.session_at) return;
      var other = String(ps.coach_id) === me() ? ps.client_id : ps.coach_id;
      list.push({ kind: "pt", starts_at: ps.session_at, ev: {
        id: "pt:" + ps.id, user_id: other, title: "Coaching mit " + String(personOf(other).name || "").split(" ")[0],
        category: "kraft", starts_at: ps.session_at, status: "geplant", item_type: "pt_session",
        photo_url: "/assets/gogogo/personaltraining-1600.webp", _pt: true
      } });
    });
    /* Wochenplan-Vorlage anzeigen, wenn noch kein echtes Event (z. B. Nächste Woche) */
    var hasOwn = list.some(function (it) {
      return it.kind === "event" && it.ev && String(it.ev.user_id) === me();
    });
    var hasOwnTraining = list.some(function (it) {
      return (
        it.kind === "event" &&
        it.ev &&
        String(it.ev.user_id) === me() &&
        !isSupportEvent(it.ev) &&
        !it.ev.travel_auto &&
        it.ev.item_type !== "hotel_workout" &&
        !it._fromPlan
      );
    });
    var hasTravelAlt = list.some(function (it) {
      return (
        it.kind === "event" &&
        it.ev &&
        String(it.ev.user_id) === me() &&
        (it.ev.travel_auto || it.ev.item_type === "hotel_workout")
      );
    });
    /* Reise: wenn Alternative da ist, Original-Plan nicht parallel zeigen */
    var skipped = state.events.some(function (ev) {
      return ev && ev.status === "ausgefallen" && String(ev.user_id) === me() && dayKey(ev.starts_at) === iso;
    });
    var wantPlan = !hasOwn && !hasTravelAlt && !skipped && host && host.planItemForDay;
    if (wantPlan) {
      var plan = host.planItemForDay(iso);
      if (plan && plan.title) {
        list.push({
          kind: "event",
          starts_at: plan.starts_at,
          ev: plan,
          _fromPlan: true
        });
      }
    }
    list.sort(function (a, b) {
      return String(a.starts_at).localeCompare(String(b.starts_at));
    });
    return list;
  }

  function weekStats() {
    var days = weekDays();
    var planned = 0;
    var trainings = 0;
    days.forEach(function (iso) {
      var items = itemsForDay(iso);
      if (items.length) planned += 1;
      items.forEach(function (it) {
        var cat = it.ev && it.ev.category;
        if (TRAIN_CATS[cat]) trainings += 1;
      });
    });
    return { planned: planned, trainings: trainings };
  }

  function avatarHtml(p) {
    if (p && p.photo) {
      return '<img class="wr-avatar" src="' + esc(p.photo) + '" alt="" />';
    }
    var ch = ((p && p.name) || "?").slice(0, 1).toUpperCase();
    return '<span class="wr-avatar wr-avatar--ph">' + esc(ch) + "</span>";
  }

  /* Zusagen nur auf Heute — Owner zählt hier nicht als Teilnehmer */
  function goingIds(ev) {
    var owner = String((ev && ev.user_id) || "");
    var seen = {};
    /* jede Person nur einmal (Zusage kann aus Einladung und RSVP doppelt geladen sein) */
    return (state.rsvps[String(ev && ev.id)] || []).filter(function (id) {
      id = String(id || "");
      if (!id || id === owner || seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function goingLine(ev) {
    var ids = goingIds(ev);
    if (!ids.length) return "";
    var names = ids.map(function (id) {
      return personOf(id).name;
    });
    var first = names[0] || "Jemand";
    if (names.length === 1) return esc(first) + " ist dabei";
    return esc(first) + " und " + (names.length - 1) + " weitere sind dabei";
  }

  /* Wer (wiederkehrend) zugesagt hat, steht rechts neben dem Profilbild */
  function goingAvatarsHtml(ev) {
    return goingIds(ev).slice(0, 5).map(function (id) { return avatarHtml(personOf(id)); }).join("");
  }

  function facesHtml(ev) {
    var ids = goingIds(ev).slice(0, 5);
    if (!ids.length) return "";
    return (
      '<div class="wr-faces">' +
      ids
        .map(function (id) {
          return avatarHtml(personOf(id));
        })
        .join("") +
      "</div>"
    );
  }

  function courseTitleOf(ev) {
    if (!ev) return "";
    if (ev.courses && ev.courses.title) return ev.courses.title;
    if (ev.course_id) {
      var c = state.courses.filter(function (row) {
        return String(row.id) === String(ev.course_id);
      })[0];
      if (c && c.title) return c.title;
    }
    if (ev.enrollment_id) {
      var en = state.enrollments.filter(function (e) {
        return String(e.id) === String(ev.enrollment_id);
      })[0];
      if (en && en.courses && en.courses.title) return en.courses.title;
    }
    return "";
  }

  function coursePill(ev) {
    var linked = courseTitleOf(ev);
    var title = String((ev && ev.title) || "").trim();
    /* Kursname nicht doppelt neben der Workout-Überschrift */
    if (linked) {
      if (
        !title ||
        (title !== linked &&
          title.indexOf(linked) < 0 &&
          linked.indexOf(title) < 0)
      ) {
        return '<span class="wr-pill">' + esc(linked) + "</span>";
      }
      return "";
    }
    if (ev.enrollment_id || ev.item_type === "course_session") {
      return '<span class="wr-pill">Kurs</span>';
    }
    /* Kein „Spontan“-Pill neben dem Nutzer-Icon */
    return "";
  }

  function truncNote(note, lines) {
    var full = String(note || "").trim();
    if (!full) return { text: "", more: false, full: "" };
    var parts = full.split(/\n+/);
    if (parts.length <= lines && full.length <= 120) {
      return { text: full, more: false, full: full };
    }
    var cut = parts.slice(0, lines).join("\n");
    if (cut.length > 120) cut = cut.slice(0, 117) + "…";
    return { text: cut, more: cut !== full, full: full };
  }

  function actionColHtml(item) {
    /* Einladen, ics und Teilen liegen jetzt im Stift-Dialog; rechts stehen die Wochentage */
    if (true) return "";
    if (!item || !item.ev) return "";
    var ev = item.ev;
    var id = String(ev.id);
    var mine = item.kind !== "ffc" && String(ev.user_id) === me();
    var today = berlinToday() === dayKey(ev.starts_at);
    /* Woche ist Planung: kein Abhaken, kein Kommentieren (beides in Aktuell). Nur Einladen/Teilen. */
    /* oben ics (Kalender), dann Postausgang (Freunde/Gruppe/Circle einladen), darunter Papierflieger (extern teilen) */
    return (
      '<div class="wr-actions">' +
      '<button type="button" class="wr-act wr-act--ics" data-wr-ics="1" aria-label="Woche für den Kalender exportieren"><span class="wr-act__icon">ics</span></button>' +
      '<button type="button" class="wr-act" data-wr-share="' +
      esc(dayKey(ev.starts_at)) +
      '" data-wr-event="' +
      esc(id) +
      '" aria-label="Einladen"><span class="wr-act__icon">' +
      ICON_SHARE +
      '</span><span class="wr-act__n"></span></button>' +
      '<button type="button" class="wr-act" data-wr-plane="' + esc(dayKey(ev.starts_at)) + '" data-wr-event="' + esc(id) + '" aria-label="Extern teilen"><span class="wr-act__icon">' +
      ICON_PLANE + "</span></button>" +
      "</div>"
    );
  }

  function emptyCardHtml(iso) {
    var hasPlan = (state.enrollments || []).some(function (en) { return en && en.status === "aktiv"; });
    if (!hasPlan) {
      /* Ohne Wochenplan keine Einzeleinheiten anbieten, nur den Weg zum Plan */
      return (
        '<div class="wr-slide wr-slide--empty" data-day="' + esc(iso) + '">' +
        '<div class="wr-media tone-neutral"><div class="wr-overlay wr-overlay--empty">' +
        '<p class="wr-empty-title">' + (state.enrollLoaded ? "Noch kein Wochenplan" : "Noch nichts geplant") + "</p>" +
        (state.enrollLoaded
          ? '<div class="wr-empty-btns"><button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-pick-plan="1">Wochenplan wählen</button></div>'
          : "") +
        "</div></div></div>"
      );
    }
    return (
      '<div class="wr-slide wr-slide--empty" data-day="' +
      esc(iso) +
      '">' +
      '<div class="wr-media tone-neutral">' +
      '<div class="wr-overlay wr-overlay--empty">' +
      '<p class="wr-empty-title">Kein festes Training</p>' +
      '<div class="wr-empty-btns">' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-pick-plan="1">Wochenplan ändern</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-zrec="1">Zirkeltraining jede Woche</button>' +
      "</div></div></div></div>"
    );
  }

  /* Übungen der Einheit als Liste auf dem Bild (nur Anzeige). Kommen asynchron vom Host und werden gecacht. */
  var exCache = {};
  function exKey(ev) {
    return String(ev.id || "") + "|" + String(ev.course_session_id || "") + "|" + String(ev.title || "");
  }
  function exListHtml(ev) {
    if (!ev || ev._pt || ev.category === "zirkel" || !host || !host.exercisesForEvent) return "";
    var k = exKey(ev);
    var names = exCache[k];
    if (names === undefined) {
      exCache[k] = null;
      Promise.resolve(host.exercisesForEvent(ev)).then(function (list) {
        exCache[k] = (list || []).filter(Boolean);
        if (exCache[k].length) patchExLists();
      }).catch(function () { exCache[k] = []; });
      return '<ul class="wr-exlist" data-ex-key="' + esc(k) + '" hidden></ul>';
    }
    return '<ul class="wr-exlist" data-ex-key="' + esc(k) + '"' + (names && names.length ? "" : " hidden") + ">" + exItems(names) + "</ul>";
  }
  function exItems(names) {
    if (!names || !names.length) return "";
    var max = 8;
    var html = names.slice(0, max).map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("");
    if (names.length > max) html += '<li class="wr-exlist__more">+ ' + (names.length - max) + " weitere</li>";
    return html;
  }
  function patchExLists() {
    var root = $(ROOT_ID);
    if (!root) return;
    root.querySelectorAll(".wr-exlist[data-ex-key]").forEach(function (ul) {
      var names = exCache[ul.getAttribute("data-ex-key")];
      if (!names || !names.length || !ul.hidden) return;
      ul.innerHTML = exItems(names);
      ul.hidden = false;
    });
    /* gleiches HTML beim nächsten render(): Cache steckt schon drin */
    root.__wrHtml = "";
  }

  /* Kalender-Zeile: Wochentag, bei einmaligen Terminen mit Datum (z. B. „Dienstag 24.11.“) */
  function dayWord(iso, once) {
    var wd = formatWeekday(iso);
    if (!once) return wd;
    var p = String(iso).split("-");
    return wd + " " + Number(p[2]) + "." + Number(p[1]) + ".";
  }

  function eventCardHtml(item, iso) {
    var ev = item.ev;
    var p = personOf(ev.user_id || (ev.is_mine ? me() : ""));
    if (item.kind === "ffc") {
      p = { name: ev.creator_nickname || "FFC", photo: "" };
    }
    var cat = ev.category || "kraft";
    var title = (emojiFor(cat, ev.title) + " " + (ev.title || cat)).trim();
    var when = ev.starts_at ? displayTime(ev.starts_at) : "";
    var zSet = parseZirkelNote(ev.note);
    var notePack = truncNote(zSet ? zirkelLabel(zSet) : ev.note || ev.description || "", 2);
    var place = ev.location || "";
    var travelHint = "";
    var supportType =
      String(ev.item_type || "") === "support_session" ||
      String(ev.item_type || "") === "nutrition_log";
    if (
      travelActive() &&
      item.kind === "event" &&
      !ev.travel_auto &&
      !supportType &&
      (String(place).toLowerCase().indexOf("studio") >= 0 || cat === "zirkel") &&
      !ev.enrollment_id
    ) {
      travelHint =
        '<button type="button" class="wr-travel-swap" data-wr-swap="' +
        esc(ev.id) +
        '">Unterwegs? Tausch gegen Hotel-Workout</button>';
    }
    var fullNote = notePack.full || "";
    /* Ort steht rechts neben der Uhrzeit, Beschreibung darunter nur noch Notiz */
    var placePrefix = "";
    var desc = "";
    if (notePack.text) {
      desc =
        '<p class="wr-place"' +
        (notePack.more ? ' data-full="' + esc(placePrefix + fullNote) + '"' : "") +
        ">" +
        placePrefix +
        (notePack.text ? esc(notePack.text) : "") +
        "" +
        "</p>";
    }
    var going = goingLine(ev);
    /* Coverbild statt Farbfläche (go-covers.js): Kursbild, sonst Bild der Kategorie */
    var nutritionTitle = /ernährung|ernaehrung/i.test(String(ev.title || ""));
    var cover = !ev.photo_url && global.GoCovers ? GoCovers.url(ev.course_id, nutritionTitle ? "ernaehrung" : cat, ev.enrollment_id) : "";
    var isNutrition =
      String(ev.item_type || "") === "nutrition_log" ||
      /ernährung|ernaehrung/i.test(String(ev.title || ""));
    var isZirkel = cat === "zirkel" || /zirkel/i.test(String(ev.title || ""));
    /* erledigter Zirkel: keine Start-/Countdown-Pille mehr */
    var cd = isZirkel && ev.status !== "erledigt"
      ? zSet && zSet.hold && !zSet.goAt
        ? '<p class="wr-zirkel-cd">Angehalten</p>'
        : zirkelCountdownHtml(zSet && zSet.goAt ? new Date(zSet.goAt).toISOString() : ev.starts_at)
      : "";
    return (
      '<div class="wr-slide' +
      (isNutrition ? " is-nutrition" : "") +
      (isZirkel ? " is-zirkel" : "") +
      '" data-day="' +
      esc(iso) +
      '" data-event-id="' +
      esc(ev.id) +
      '"' +
      ">" +
      '<div class="wr-media ' +
      toneClass(cat) +
      (ev.photo_url || cover ? " has-photo" : "") +
      '">' +
      (ev.photo_url
        ? '<img class="wr-photo" src="' + esc(ev.photo_url) + '" alt="" />'
        : cover
          ? '<img class="wr-photo wr-cover" src="' + esc(cover) + '" alt="" loading="lazy" />'
          : "") +
      '<div class="wr-bottom">' +
      '<div class="wr-bottom__main">' +
      '<div class="wr-author">' +
      avatarHtml(p) +
      goingAvatarsHtml(ev) +
      inviteAvatarsHtml(iso) +
      "</div>" +
      '<p class="wr-when">' + (ev.bubble_id && global.GoBubbles ? '<span class="wr-when__bub" title="Bubble">' + GoBubbles.SOAP_SVG + "</span>" : "") +
        esc([dayWord(iso, item._once), when, place].filter(Boolean).join(" · ")) + "</p>" +
      /* Countdown und „Start anhalten“ nebeneinander als gleiche Pillen */
      (cd || zirkelAdminHtml(ev, zSet, iso) ? '<div class="wr-zrow">' + cd + zirkelAdminHtml(ev, zSet, iso) + "</div>" : "") +
      '<h2 class="wr-title">' +
      esc(title) +
      "</h2>" +
      exListHtml(ev) +
      desc +
      (zSet && zSet.online
        ? '<button type="button" class="go-online-cta" data-wr-zirkel-go="1">Online mitmachen</button>'
        : "") +
      (item.kind === "joined"
        ? '<p class="wr-place">Du bist dabei bei ' + esc(personOf(ev.user_id).name) + "</p>" +
          '<button type="button" class="go-online-cta go-online-cta--ghost" data-wr-leave="' + esc(ev.id) + '">Austreten</button>'
        : "") +
      (item.kind === "invited" && ev._inv
        ? '<p class="wr-place">' + esc(personOf(ev.user_id).name || "Dein Freund") + " lädt Dich jede Woche ein</p>" +
          '<div class="wr-zrow">' +
          '<button type="button" class="go-online-cta" data-wr-inv-yes="' + esc(ev._inv.id) + '">Zusagen</button>' +
          '<button type="button" class="go-online-cta go-online-cta--ghost" data-wr-inv-no="' + esc(ev._inv.id) + '">Absagen</button>' +
          "</div>"
        : "") +
      "" +
      travelHint +
      "</div>" +
      actionColHtml(item) +
      "</div></div></div>"
    );
  }

  var WR_HOURGLASS =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11M6.5 20.5h11M8 3.5v2.2c0 2.2 1.6 3.5 4 5.3 2.4-1.8 4-3.1 4-5.3V3.5M8 20.5v-2.2c0-2.2 1.6-3.5 4-5.3 2.4 1.8 4 3.1 4 5.3v2.2"/></svg>';

  function inviteAvatarsHtml(iso) {
    /* Keine Einladungs-Gesichter, wenn eigenes Event an dem Tag schon erledigt */
    var doneOwn = (state.events || []).some(function (ev) {
      return (
        ev &&
        String(ev.user_id) === me() &&
        dayKey(ev.starts_at) === String(iso) &&
        ev.status === "erledigt"
      );
    });
    if (doneOwn) return "";
    /* Zugesagte stehen schon unter „dabei“ (RSVP): hier nicht noch einmal. Jede Person nur einmal. */
    var goingToday = {};
    (state.events || []).forEach(function (ev) {
      if (!ev || String(ev.user_id) !== me() || dayKey(ev.starts_at) !== String(iso)) return;
      goingIds(ev).forEach(function (id) { goingToday[id] = true; });
    });
    var seenInv = {};
    var list = (state.invites || []).filter(function (inv) {
      if (!inv || String(inv.workout_date) !== String(iso)) return false;
      var st = String(inv.status || "pending");
      var to = String(inv.to_id || "");
      if (!(st === "pending" || st === "accepted")) return false;
      if (st === "accepted" && goingToday[to]) return false;
      if (seenInv[to]) return false;
      seenInv[to] = true;
      return true;
    });
    if (!list.length) return "";
    return (
      '<div class="wr-invite-faces" aria-label="Eingeladen">' +
      list
        .map(function (inv) {
          var pending = String(inv.status || "pending") === "pending";
          return (
            '<span class="wr-invite-slot' +
            (pending ? " is-pending" : "") +
            '">' +
            avatarHtml(personOf(inv.to_id)) +
            (pending
              ? '<span class="wr-invite-wait" aria-hidden="true">' +
                WR_HOURGLASS +
                "</span>"
              : "") +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function loadInvites() {
    var id = me();
    if (!id) {
      state.invites = [];
      return Promise.resolve();
    }
    return rest(
      "go_workout_invites?from_id=eq." +
        encodeURIComponent(id) +
        "&select=id,to_id,workout_date,workout_label,status&order=created_at.desc&limit=120"
    )
      .then(function (rows) {
        state.invites = (rows || []).filter(function (r) {
          if (!r) return false;
          var st = String(r.status || "pending");
          return st === "pending" || st === "accepted";
        });
        return ensurePeople(
          state.invites.map(function (r) {
            return r.to_id;
          })
        );
      })
      .catch(function () {
        state.invites = [];
      });
  }

  function currentOwnEvent() {
    var days;
    try {
      days = weekDays();
    } catch (e) {
      return null;
    }
    var iso = days[state.dayIndex];
    if (!iso) return null;
    var items = itemsForDay(iso);
    if (!items.length) return null;
    var ix = Math.max(0, Math.min(items.length - 1, state.eventIndex || 0));
    var it = items[ix];
    if (!it || it.kind !== "event" || !it.ev) return null;
    if (String(it.ev.user_id) !== me()) return null;
    return it.ev;
  }

  /* Kalender: Zukunft oben. Index 0 = erster Tag liegt unten im Track, Position = 6 − Index */
  function dayPos(ix) {
    return 6 - ix;
  }
  function dayElAt(ix) {
    var track = $("wr-vtrack");
    if (!track) return null;
    return track.querySelector('[data-day-ix="' + ix + '"]');
  }
  function scrollTopFor(track, ix) {
    return dayPos(ix) * track.clientHeight;
  }
  function ixFromScroll(track) {
    var pos = Math.round(track.scrollTop / Math.max(1, track.clientHeight));
    return Math.max(0, Math.min(6, 6 - pos));
  }
  var WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  function daySquaresHtml(days) {
    var html = "";
    for (var ix = 6; ix >= 0; ix--) {
      var iso = days[ix];
      var wd = WD_SHORT[new Date(iso + "T12:00:00").getDay()];
      html +=
        '<button type="button" class="wr-dsq' + (ix === state.dayIndex ? " is-on" : "") +
        '" data-wr-dsq="' + ix + '" aria-label="' + esc(formatDayLong(iso)) + '">' + wd + "</button>";
    }
    return '<div class="wr-dsqs" aria-label="Wochentage">' + html + "</div>";
  }
  /* Track war beim Zeichnen evtl. noch ohne Höhe: sonst stünde scrollTop 0 = letzter (zukünftiger) Tag */
  function alignAndSync() {
    var track = $("wr-vtrack");
    if (track && track.clientHeight && ixFromScroll(track) !== state.dayIndex) {
      track.scrollTop = scrollTopFor(track, state.dayIndex);
    }
    patchDaySquares();
    syncSurface();
  }
  function patchDaySquares() {
    var root = $(ROOT_ID);
    if (!root) return;
    root.querySelectorAll(".wr-dsq").forEach(function (b) {
      b.classList.toggle("is-on", Number(b.getAttribute("data-wr-dsq")) === state.dayIndex);
    });
  }
  function currentItem() {
    var iso = currentDayIso();
    var items = itemsForDay(iso);
    if (!items.length) return null;
    return items[Math.max(0, Math.min(items.length - 1, state.eventIndex || 0))] || null;
  }

  function dayReelHtml(iso) {
    var items = itemsForDay(iso);
    if (!items.length) return emptyCardHtml(iso);
    var slides = items
      .map(function (it) {
        return eventCardHtml(it, iso);
      })
      .join("");
    var dots =
      items.length > 1
        ? '<div class="wr-dots">' +
          items
            .map(function (_, i) {
              return '<span class="wr-dot' + (i === 0 ? " is-on" : "") + '"></span>';
            })
            .join("") +
          "</div>"
        : "";
    return (
      '<div class="wr-day" data-day="' +
      esc(iso) +
      '">' +
      '<div class="wr-htrack">' +
      slides +
      "</div>" +
      dots +
      "</div>"
    );
  }

  function currentDayIso() {
    try {
      var days = weekDays();
      return days[state.dayIndex] || berlinToday();
    } catch (e) {
      return berlinToday();
    }
  }

  function headerHtml() {
    var label = weekModeMeta().label;
    var travelOn = travelActive();
    var dayIso = currentDayIso();
    /* Kalender = wiederkehrende Woche: Wochentag reicht, kein Datum */
    var dayLabel = formatWeekday(dayIso);
    var travelHint = "";
    if (travelOn) {
      travelHint =
        '<button type="button" class="wr-travel-banner" data-wr-end-travel="1" aria-label="Reise beenden">' +
        "Reise aktiv bis " +
        esc(formatDayLong(state.travelUntil).replace(/^[^,]*,\s*/, "") || state.travelUntil) +
        " — tippen zum Abbrechen</button>";
    }
    var err = state.loadError
      ? '<p class="wr-error" role="status">' + esc(state.loadError) + "</p>"
      : "";
    return (
      '<header class="wr-top' +
      (state.editMode ? " is-edit" : "") +
      '">' +
      '<div class="wr-top__row">' +
      '<button type="button" class="wr-icon-btn' +
      (travelOn ? " is-on" : "") +
      '" data-wr-travel="1" aria-label="Reisemodus">' +
      '<span class="wr-travel-emoji" aria-hidden="true">🛫</span>' +
      "</button>" +
      /* Zeitraum als natives Dropdown wie in Aktuell */
      '<div class="wr-week-nav"><label class="wr-week-pick">' +
      '<select data-wr-week-select aria-label="Zeitraum"' + (state.editMode ? " disabled" : "") + ">" +
      WEEK_MODES.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === state.weekMode ? " selected" : "") + ">" + esc(m.label) + "</option>";
      }).join("") +
      '</select><svg class="wr-week-label__chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></label>' +
      "</div>" +
      /* rechts: Kalender (Monat mit Reise, Coaching, Zirkel, Gruppe) und Stift */
      '<div class="wr-top__right">' +
      '<button type="button" class="wr-icon-btn wr-cal-btn" data-wr-cal="1" aria-label="Kalender">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>' +
      "</button>" +
      '<button type="button" class="wr-icon-btn' +
      (state.editMode ? " is-on" : "") +
      '" data-wr-edit="1" aria-label="Bearbeiten">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L18 10l-4-4L4 16v4zM13 7l4 4"/></svg>' +
      "</button>" +
      "</div>" +
      "</div>" +
      '<p class="wr-day-label wr-plan-label">Plane Deine Woche</p>' +
      '<p class="wr-day-label" hidden>' +
      esc(dayLabel) +
      "</p>" +
      "</header>" +
      travelHint +
      travelAltHtml(dayIso) +
      err
    );
  }

  function dayHasAlternative(iso) {
    return itemsForDay(iso).some(function (it) {
      return (
        it.ev &&
        (it.ev.category === "alternative" ||
          it.ev.item_type === "hotel_workout" ||
          it.ev.travel_auto)
      );
    });
  }

  function alternativeEventForDay(iso) {
    return itemsForDay(iso).filter(function (it) {
      if (!it.ev || isSupportEvent(it.ev)) return false;
      return (
        it.ev.category === "alternative" ||
        it.ev.item_type === "hotel_workout" ||
        it.ev.travel_auto
      );
    })[0];
  }

  function travelDayActive(iso) {
    if (!travelActive() || !iso) return false;
    var start = state.travelStart || berlinToday();
    return iso >= start && iso <= state.travelUntil;
  }

  function isSupportEvent(ev) {
    if (!ev) return false;
    var t = String(ev.item_type || "");
    if (t === "support_session" || t === "nutrition_log") return true;
    var title = String(ev.title || "");
    if (/web[\s-]?call|trainingsplan|ernährung|ernaehrung/i.test(title)) return true;
    return false;
  }

  function isSupportOnlyDay(iso) {
    var items = itemsForDay(iso).filter(function (it) {
      return it && it.kind === "event" && it.ev && String(it.ev.user_id) === me();
    });
    if (!items.length) return false;
    return items.every(function (it) {
      return isSupportEvent(it.ev);
    });
  }

  function dayNeedsTravelAlt(iso) {
    if (!travelDayActive(iso)) return false;
    if (isSupportOnlyDay(iso)) return false;
    var items = itemsForDay(iso).filter(function (it) {
      return it && it.kind === "event" && it.ev && String(it.ev.user_id) === me();
    });
    var training = items.filter(function (it) {
      return !isSupportEvent(it.ev);
    });
    /* Nur Support/Web-Call/Ernährung → keine Reise-Alternative */
    if (items.length && !training.length) return false;
    /* Aktuell sichtbarer Slide ist Plus/Support → Dialog nicht darüber legen */
    var focused = null;
    try {
      var ix = Math.max(0, Math.min(items.length - 1, state.eventIndex || 0));
      focused = items[ix];
    } catch (eF) {}
    if (focused && focused.ev && isSupportEvent(focused.ev)) return false;
    return true;
  }

  function planTitleForTravelDay(iso) {
    if (host && host.planItemForDay) {
      var plan = host.planItemForDay(iso);
      if (plan && plan.title) return String(plan.title);
    }
    var items = itemsForDay(iso).filter(function (it) {
      return (
        it &&
        it.kind === "event" &&
        it.ev &&
        String(it.ev.user_id) === me() &&
        !isSupportEvent(it.ev) &&
        !it.ev.travel_auto &&
        it.ev.item_type !== "hotel_workout"
      );
    });
    if (items[0] && items[0].ev) return items[0].ev.title || "Wochenplan";
    return "Wochenplan";
  }

  function travelAltHtml(iso) {
    if (!dayNeedsTravelAlt(iso)) return "";
    var alt = alternativeEventForDay(iso);
    if (alt && alt.ev && isSupportEvent(alt.ev)) {
      alt = null;
    }
    var planTitle = planTitleForTravelDay(iso);
    var title = alt && alt.ev ? alt.ev.title || "Alternative" : "Alternative wählen";
    var copy = alt
      ? "Statt " + planTitle + " · tippen zum Ändern"
      : "Wochenplan: " + planTitle + " · Alternative festlegen";
    return (
      '<button type="button" class="wr-travel-card" data-wr-travel-alt="' +
      esc(iso) +
      '" aria-label="Reise-Alternative">' +
      '<div class="wr-travel-card__art"><img src="' +
      esc(TRAVEL_ALT_IMG) +
      '" alt="" /></div>' +
      '<div class="wr-travel-card__body"><h3>' +
      esc(title) +
      "</h3><p>" +
      esc(copy) +
      "</p></div></button>"
    );
  }

  function patchTravelAlt() {
    var root = $(ROOT_ID);
    if (!root) return;
    var iso = currentDayIso();
    var next = travelAltHtml(iso);
    var existing = root.querySelector(".wr-travel-card");
    var banner = root.querySelector(".wr-travel-banner");
    if (!next) {
      if (existing) existing.remove();
      return;
    }
    if (existing) {
      existing.outerHTML = next;
      return;
    }
    if (banner) banner.insertAdjacentHTML("afterend", next);
    else {
      var top = root.querySelector(".wr-top");
      if (top) top.insertAdjacentHTML("afterend", next);
    }
  }

  /* Striche unten: die letzten 7 Tage bis heute (eigene Events, ohne ausgefallene) */
  function loadRecent() {
    var id = me();
    if (!id) return Promise.resolve();
    var today = berlinToday();
    return rest(
      "events?user_id=eq." + encodeURIComponent(id) +
        "&select=starts_at,status&status=neq.ausgefallen" +
        "&starts_at=gte." + encodeURIComponent(addDays(today, -6) + "T00:00:00+01:00") +
        "&starts_at=lt." + encodeURIComponent(addDays(today, 1) + "T00:00:00+01:00") +
        "&limit=100"
    ).then(function (rows) {
      state.recent = rows || [];
    });
  }

  function progressHtml() {
    var today = berlinToday();
    var days = [];
    for (var d = 6; d >= 0; d--) days.push(addDays(today, -d));
    var segs = days
      .map(function (iso) {
        var items = (state.recent || []).filter(function (ev) {
          return dayKey(ev.starts_at) === iso;
        });
        var planned = items.length > 0;
        var done = items.some(function (ev) {
          return ev.status === "erledigt";
        });
        return (
          '<span class="wr-seg' +
          (planned ? " is-on" : "") +
          (done ? " is-done" : "") +
          '" title="' +
          esc(iso) +
          '"></span>'
        );
      })
      .join('<span class="wr-seg-gap" aria-hidden="true"></span>');
    var st = weekStats();
    return (
      '<div class="wr-progress" role="status">' +
      '<div class="wr-progress__days" aria-hidden="true">' +
      segs +
      "</div>" +
      "<p>" +
      st.planned +
      " von 7 Tagen geplant · " +
      st.trainings +
      " Trainings</p></div>"
    );
  }

  /* Erledigte Events sind abgeschlossen: nicht ersetzen, verschieben oder löschen */
  function eventLocked(id) {
    var ev = id ? findOwnEvent(id) : null;
    return !!(ev && ev.status === "erledigt");
  }

  function lockedToast() {
    if (host.toast) host.toast("Erledigt. Das Event bleibt so.");
  }

  function editPanelHtml() {
    if (!state.editMode) return "";
    var iso = currentDayIso();
    var own = currentOwnEvent();
    if (own && own.status === "erledigt") {
      return '<div class="wr-edit-panel"><p class="wr-edit-panel__hint">Erledigt. Dieses Event lässt sich nicht mehr ändern.</p></div>';
    }
    var kinds =
      '<div class="wr-edit-panel__grid">' +
      ["kraft", "ausdauer", "alternative", "zirkel"]
        .map(function (k) {
          var label =
            k === "kraft"
              ? "Kraft"
              : k === "ausdauer"
                ? "Ausdauer"
                : k === "alternative"
                  ? "Sonstiges"
                  : "Zirkeltraining";
          return (
            '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-edit-kind="' +
            esc(k) +
            '" data-iso="' +
            esc(iso) +
            '"' +
            (own ? ' data-replace="' + esc(own.id) + '"' : "") +
            ">" +
            esc(label) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    var canTime = own && eventTimeEditable(own);
    var evRow = own
      ? '<div class="wr-edit-panel__row">' +
        '<button type="button" class="wr-pill-btn" data-wr-edit-place="' +
        esc(own.id) +
        '">Ort</button>' +
        (canTime
          ? '<button type="button" class="wr-pill-btn" data-wr-edit-time="' +
            esc(own.id) +
            '">Uhrzeit</button>' +
            '<button type="button" class="wr-pill-btn" data-wr-edit-day="' +
            esc(own.id) +
            '">Tag</button>'
          : "") +
        '<button type="button" class="wr-pill-btn" data-wr-delete="' +
        esc(own.id) +
        '">Löschen</button></div>'
      : '<p class="wr-edit-panel__hint">Tag neu belegen</p>';
    return (
      '<div class="wr-edit-panel">' +
      kinds +
      evRow +
      "</div>"
    );
  }

  function parseRgb(color) {
    if (!color) return null;
    var m = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function isLightRgb(rgb) {
    if (!rgb) return false;
    /* relative luminance */
    var lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return lum > 0.55;
  }

  function currentDayMediaEl() {
    var track = $("wr-vtrack");
    if (!track || !track.children.length) return null;
    var day = dayElAt(state.dayIndex);
    return day && day.querySelector ? day.querySelector(".wr-media") : null;
  }

  function applyDayContrast() {
    var root = $(ROOT_ID);
    if (!root) return;
    var media = currentDayMediaEl();
    /* Foto/Cover: immer helle Icons auf Abdunklung, egal welche Farbfläche darunter liegt */
    var photo = !!(media && media.classList.contains("has-photo"));
    var rgb = media && !photo ? parseRgb(window.getComputedStyle(media).backgroundColor) : null;
    var light = !photo && isLightRgb(rgb);
    root.classList.toggle("is-photo-day", photo);
    root.classList.toggle("is-light-day", light);
    root.classList.toggle("is-dark-day", !light);
  }

  function patchDayLabel() {
    var el = document.querySelector("#" + ROOT_ID + " .wr-day-label:not(.wr-plan-label)");
    if (!el) return;
    el.textContent = formatWeekday(currentDayIso());
  }

  function syncSurface() {
    applyDayContrast();
    patchDayLabel();
    if (host && typeof host.syncStatusFade === "function") {
      try {
        host.syncStatusFade();
      } catch (e) {}
    }
  }

  function timeWheelHtml(hhmm) {
    var parts = String(hhmm || "18:00").split(":");
    var h0 = Math.max(0, Math.min(23, parseInt(parts[0], 10) || 18));
    var m0 = Math.max(0, Math.min(59, parseInt(parts[1], 10) || 0));
    m0 = Math.round(m0 / 5) * 5;
    if (m0 >= 60) m0 = 55;
    var hours = "";
    for (var h = 0; h < 24; h++) {
      hours +=
        '<button type="button" class="wr-time-opt' +
        (h === h0 ? " is-on" : "") +
        '" data-wr-time-h="' +
        h +
        '">' +
        pad2(h) +
        "</button>";
    }
    var mins = "";
    for (var m = 0; m < 60; m += 5) {
      mins +=
        '<button type="button" class="wr-time-opt' +
        (m === m0 ? " is-on" : "") +
        '" data-wr-time-m="' +
        m +
        '">' +
        pad2(m) +
        "</button>";
    }
    return (
      '<div class="wr-time-wheel" id="wr-time-wheel" data-h="' +
      h0 +
      '" data-m="' +
      m0 +
      '">' +
      '<div class="wr-time-col" id="wr-time-h">' +
      hours +
      "</div>" +
      '<span class="wr-time-sep" aria-hidden="true">:</span>' +
      '<div class="wr-time-col" id="wr-time-m">' +
      mins +
      "</div>" +
      '<div class="wr-time-fade wr-time-fade--top" aria-hidden="true"></div>' +
      '<div class="wr-time-fade wr-time-fade--bot" aria-hidden="true"></div>' +
      '<div class="wr-time-center" aria-hidden="true"></div>' +
      "</div>"
    );
  }

  function scrollTimeColsToSelection() {
    ["wr-time-h", "wr-time-m"].forEach(function (id) {
      var col = $(id);
      if (!col) return;
      var on = col.querySelector(".wr-time-opt.is-on");
      if (on) {
        col.scrollTop = Math.max(0, on.offsetTop - col.clientHeight / 2 + on.clientHeight / 2);
      }
    });
  }

  function openTimeSheet(eventId) {
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    if (!eventTimeEditable(ev)) {
      if (host.toast) host.toast("Vergangene Events können nicht mehr verschoben werden");
      return;
    }
    var hhmm = formatTime(ev.starts_at) || "18:00";
    openSheet(
      '<p class="wr-sheet-hint">Uhrzeit drehen</p>' +
        timeWheelHtml(hhmm) +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-time-save="' +
        esc(eventId) +
        '">Speichern</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        scrollTimeColsToSelection();
        bindTimeWheelScroll();
        syncTimeWheelFromScroll();
      });
    });
  }

  /* Gewählte Uhrzeit nie auf genau 12:00:00 UTC legen (das heißt „ohne Uhrzeit“), 13:00 im Winter bekommt 1 s */
  function timedStarts(iso, hhmm) {
    var starts = iso + "T" + hhmm + ":00" + berlinOffsetSuffix(iso);
    var d = new Date(starts);
    if (!isNaN(d.getTime()) && d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      starts = iso + "T" + hhmm + ":01" + berlinOffsetSuffix(iso);
    }
    return starts;
  }

  function berlinOffsetSuffix(iso) {
    try {
      var probe = new Date(iso + "T12:00:00Z");
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Berlin",
        timeZoneName: "longOffset",
        hour: "2-digit"
      }).formatToParts(probe);
      var name = "";
      parts.forEach(function (p) {
        if (p.type === "timeZoneName") name = p.value;
      });
      var m = String(name || "").match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
      if (m) {
        var hh = Number(m[1]);
        var sign = hh < 0 || String(m[1]).charAt(0) === "-" ? "-" : "+";
        var abs = Math.abs(hh);
        return sign + pad2(abs) + ":" + (m[2] || "00");
      }
    } catch (e) {}
    return "+01:00";
  }

  function syncTimeWheelFromScroll() {
    var wheel = $("wr-time-wheel");
    if (!wheel) return;
    ["wr-time-h", "wr-time-m"].forEach(function (id) {
      var col = $(id);
      if (!col) return;
      var mid = col.scrollTop + col.clientHeight / 2;
      var best = null;
      var bestDist = Infinity;
      col.querySelectorAll(".wr-time-opt").forEach(function (opt) {
        var c = opt.offsetTop + opt.clientHeight / 2;
        var d = Math.abs(c - mid);
        if (d < bestDist) {
          bestDist = d;
          best = opt;
        }
      });
      if (!best) return;
      col.querySelectorAll(".wr-time-opt").forEach(function (opt) {
        opt.classList.toggle("is-on", opt === best);
      });
      if (id === "wr-time-h") {
        wheel.setAttribute("data-h", best.getAttribute("data-wr-time-h"));
      } else {
        wheel.setAttribute("data-m", best.getAttribute("data-wr-time-m"));
      }
    });
  }

  function bindTimeWheelScroll() {
    ["wr-time-h", "wr-time-m"].forEach(function (id) {
      var col = $(id);
      if (!col || col._wrTimeBound) return;
      col._wrTimeBound = true;
      var timer = 0;
      col.addEventListener(
        "scroll",
        function () {
          window.clearTimeout(timer);
          timer = window.setTimeout(syncTimeWheelFromScroll, 40);
        },
        { passive: true }
      );
    });
  }

  /* Uhrzeit änderbar, solange nicht erledigt und Tag nicht vorbei (heute auch nachträglich) */
  function eventTimeEditable(ev) {
    if (!ev || !ev.starts_at || ev.status === "erledigt") return false;
    return dayKey(ev.starts_at) >= berlinToday();
  }

  function eventIsStillUpcoming(ev) {
    if (!ev || !ev.starts_at) return false;
    try {
      return new Date(ev.starts_at).getTime() > Date.now() - 60 * 1000;
    } catch (e) {
      return true;
    }
  }

  function notifyAktuell() {
    if (host && typeof host.onEventsChanged === "function") {
      try {
        return Promise.resolve(host.onEventsChanged());
      } catch (e) {
        return Promise.resolve();
      }
    }
    if (global.HeuteAccountability && HeuteAccountability.refresh) {
      try {
        return Promise.resolve(HeuteAccountability.refresh());
      } catch (e2) {
        return Promise.resolve();
      }
    }
    return Promise.resolve();
  }

  /* Ortswähler (gemeinsame Liste + Karte) in ein Sheet einhängen */
  var placePicker = null;
  function mountPlacePicker(hostId, value) {
    placePicker = null;
    var el = $(hostId);
    if (!el || !global.GoPlacePicker) return;
    placePicker = GoPlacePicker.mount(el, {
      rest: rest,
      accountId: me(),
      value: value || ""
    });
  }
  function pickedPlaceName(fallbackInputId) {
    if (placePicker && placePicker.value()) return placePicker.value().name;
    var el = fallbackInputId ? $(fallbackInputId) : null;
    return el ? String(el.value || "").trim() : "";
  }
  function rememberPickedPlace() {
    return placePicker ? placePicker.remember() : Promise.resolve();
  }

  /* Event per ID, auch Wochenplan-Platzhalter "plan:<Tag>" */
  function findOwnEvent(id) {
    var ev = state.events.filter(function (e) {
      return String(e.id) === String(id);
    })[0];
    if (ev) return ev;
    if (String(id).indexOf("plan:") === 0 && host && host.planItemForDay) {
      return host.planItemForDay(String(id).slice(5)) || null;
    }
    return null;
  }

  function isPlanPlaceholder(id) {
    return String(id || "").indexOf("plan:") === 0;
  }

  /* Wochenplan-Tag in echtes Event umwandeln, damit Ort/Uhrzeit gespeichert werden können */
  function materializeEvent(ev) {
    if (!ev || !isPlanPlaceholder(ev.id)) return Promise.resolve(ev);
    var base = {
      category: ev.category,
      title: ev.title,
      starts_at: ev.starts_at,
      location: ev.location || null,
      is_unplanned: false,
      item_type: ev.category === "alternative" ? "event" : "course_session",
      travel_auto: false
    };
    var made =
      ev.category === "alternative"
        ? createEvent(Object.assign(base, { course_id: null }))
        : ensureCourseByDef(
            TRAINING_DEFS.filter(function (d) {
              return d.title === ev.title;
            })[0] || {
              slug: "plan-" + String(ev.title || "training").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
              title: ev.title,
              category: ev.category || "kraft"
            }
          ).then(function (course) {
            if (!course || !course.id) throw new Error("Kurs fehlt");
            return createEvent(Object.assign(base, { course_id: course.id }));
          });
    return made.then(function (rows) {
      var row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || !row.id) throw new Error("Event nicht angelegt");
      state.events.push(row);
      return row;
    });
  }

  function openPlanPicker() {
    if (!global.GoPlanPicker) return;
    global.GoPlanPicker.open({
      host: { rest: rest, me: me, toast: function (m) { if (host.toast) host.toast(m); } },
      mode: "self",
      userId: me(),
      onDone: function () {
        if (global.GoTama) global.GoTama.invalidate();
        refresh();
        notifyAktuell();
      }
    });
  }

  /* ---------- Tage bearbeiten: 7 Tage, ziehen, Uhrzeit-Rad, privat/zeigen ---------- */
  /* Index 0 = keine Uhrzeit (Plan-Event wie nach der Wahl eines Wochenplans) */
  var NO_TIME = "–:–";
  var MINI_TIMES = (function () {
    var out = [NO_TIME];
    for (var h = 5; h <= 22; h++) for (var q = 0; q < 60; q += 30) out.push(pad2(h) + ":" + pad2(q));
    return out;
  })();
  var DAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  /* 30-Minuten-Raster; eine vorhandene Zeit außerhalb (z. B. 13:15) bleibt wählbar und wird beim Speichern nicht verschoben */
  function timeOptsFor(orig) {
    if (!orig || orig === NO_TIME || MINI_TIMES.indexOf(orig) >= 0) return MINI_TIMES;
    var list = MINI_TIMES.slice(1).concat([orig]).sort();
    return [NO_TIME].concat(list);
  }

  function nearestTimeIdx(hhmm) {
    var p = String(hhmm || "18:00").split(":");
    var mins = Number(p[0]) * 60 + Number(p[1] || 0);
    var best = 1, bestD = 1e9;
    MINI_TIMES.forEach(function (t, i) {
      if (t === NO_TIME) return;
      var q = t.split(":");
      var d = Math.abs(Number(q[0]) * 60 + Number(q[1]) - mins);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /* ---------- Zirkeltraining wiederkehrend: Tag wählen, dann Circle/Freunde/Uhrzeit/Sichtbarkeit ---------- */
  var ZREC_WEEKS = 12;
  var WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
  var WD_NAME = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  function zrecTimes() {
    var out = [];
    for (var h = 5; h <= 22; h++) for (var m = 0; m < 60; m += 30) out.push((h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m);
    return out;
  }
  /* Zirkeltrainings eintragen: die 7 Tage wie „Tage bearbeiten“, das Zirkeltraining am Griff auf einen Tag schieben.
     Es ersetzt dort die Einheit aus dem Wochenplan (Reihenfolge des Plans: Tage bearbeiten). Weiter → Uhrzeit, Circle, Freunde. */
  function openZirkelRecurring() {
    state.daysEdit = null;
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(berlinToday(), i));
    var plan = {};
    var zDay = "";
    days.forEach(function (iso) {
      /* Normalfall des Wochenplans: Alternativen und Reise-Ersatz zählen hier nicht */
      var evs = normalDayEvents(iso);
      var z = evs.filter(function (e) { return e.category === "zirkel" && e.status !== "ausgefallen"; })[0];
      if (z && !zDay) zDay = iso;
      var p = evs.filter(function (e) { return e.category !== "zirkel"; })[0];
      plan[iso] = p ? p.title || "Training" : "";
    });
    if (!state.zrecPick || days.indexOf(state.zrecPick) < 0) {
      state.zrecPick = zDay || days.filter(function (d) { return !plan[d]; })[0] || days[0];
    }
    var rows = days.map(function (iso) {
      var d = new Date(iso + "T12:00:00");
      var label = DAYS_DE[d.getDay()] + " " + d.getDate() + ".";
      var on = iso === state.zrecPick;
      return '<div class="wr-dayrow wr-zrec-row' + (on ? " is-zirkel" : plan[iso] ? "" : " is-empty") + '" data-wr-zrec-pick="' + iso + '">' +
        '<div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + label + "</b> " +
        (on
          ? "🔥 Zirkeltraining" + (plan[iso] ? ' <s class="wr-dayrow__free">' + esc(plan[iso]) + "</s>" : "")
          : plan[iso] ? esc(plan[iso]) : '<span class="wr-dayrow__free">frei</span>') +
        "</span></div>" +
        (on
          ? '<span class="wr-dayrow__grip" data-wr-zrec-grip="1" aria-label="Zirkeltraining schieben"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>'
          : "<span></span>") +
        "</div>";
    }).join("");
    openSheet(
      '<p class="wr-sheet-hint">Schieb das Zirkeltraining auf Deinen Tag. Es ersetzt dort die Einheit aus Deinem Wochenplan.</p>' +
      '<div class="wr-days wr-days--all">' + rows + "</div>" +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Verlassen</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-zrec-next="1">Weiter</button></div>'
    );
    var cardZ = $("wr-sheet-card");
    if (cardZ) cardZ.classList.add("wr-sheet__card--days");
    var card = $("wr-sheet-card");
    if (!card || card._wrZrecBound) return;
    card._wrZrecBound = true;
    card.addEventListener("click", function (e) {
      /* Inhalt wird neu gezeichnet: Klick nicht weiterreichen (sonst gilt er als „außerhalb“ und schließt das Sheet) */
      if (e.target.closest("[data-wr-zrec-next]")) {
        e.stopPropagation();
        var wdN = new Date(state.zrecPick + "T12:00:00").getDay();
        setTimeout(function () { openZrecDay(wdN); }, 0);
        return;
      }
      var pr = e.target.closest("[data-wr-zrec-pick]");
      if (pr && !card._zrecDragged) {
        e.stopPropagation();
        state.zrecPick = pr.getAttribute("data-wr-zrec-pick");
        setTimeout(openZirkelRecurring, 0);
        return;
      }
      card._zrecDragged = false;
      var d = e.target.closest("[data-wr-zrec-day]");
      if (d) {
        e.stopPropagation();
        var wdSel = Number(d.getAttribute("data-wr-zrec-day"));
        setTimeout(function () { openZrecDay(wdSel); }, 0);
        return;
      }
      var act = e.target.closest("[data-wr-zrec]");
      if (!act || !state.zrec) return;
      e.stopPropagation();
      var k = act.getAttribute("data-wr-zrec");
      if (k === "circle") return zrecCircle();
      if (k === "friends") return zrecFriends();
      if (k === "vis") { state.zrec.vis = state.zrec.vis === "privat" ? "team" : "privat"; return paintZrecDay(); }
      if (k === "mode-extra" || k === "mode-alt") { state.zrec.mode = k === "mode-alt" ? "alt" : "extra"; return paintZrecDay(); }
      if (k === "save") return saveZrec(act);
      if (k === "back") return openZirkelRecurring();
    });
    /* Zirkeltraining am Griff auf einen anderen Tag ziehen */
    var zdrag = null;
    card.addEventListener("pointerdown", function (e) {
      var g = e.target.closest && e.target.closest("[data-wr-zrec-grip]");
      if (!g) return;
      e.preventDefault();
      var row = g.closest(".wr-dayrow");
      var r = row.getBoundingClientRect();
      var ghost = row.cloneNode(true);
      ghost.classList.add("wr-dayrow--ghost");
      ghost.style.width = r.width + "px";
      ghost.style.left = r.left + "px";
      ghost.style.top = r.top + "px";
      document.body.appendChild(ghost);
      zdrag = { ghost: ghost, dy: e.clientY - r.top, over: null };
      try { g.setPointerCapture(e.pointerId); } catch (eC) {}
    });
    card.addEventListener("pointermove", function (e) {
      if (!zdrag) return;
      zdrag.ghost.style.top = (e.clientY - zdrag.dy) + "px";
      zdrag.ghost.style.visibility = "hidden";
      var el = document.elementFromPoint(e.clientX, e.clientY);
      zdrag.ghost.style.visibility = "";
      var over = el && el.closest ? el.closest("[data-wr-zrec-pick]") : null;
      if (zdrag.over && zdrag.over !== over) zdrag.over.classList.remove("is-drop");
      if (over) over.classList.add("is-drop");
      zdrag.over = over;
    });
    function endZ() {
      if (!zdrag) return;
      var d = zdrag;
      zdrag = null;
      d.ghost.remove();
      card._zrecDragged = true;
      if (d.over) {
        state.zrecPick = d.over.getAttribute("data-wr-zrec-pick");
        openZirkelRecurring();
      }
    }
    card.addEventListener("pointerup", endZ);
    card.addEventListener("pointercancel", endZ);
  }
  function openZrecDay(wd) {
    state.zrec = { wd: wd, time: "18:00", vis: "team", friends: [], circle: null, mode: "alt" };
    paintZrecDay();
  }
  function paintZrecDay() {
    var z = state.zrec;
    var times = zrecTimes();
    var names = z.friends.map(function (id) { return String(personOf(id).name || "").split(" ")[0]; }).filter(Boolean);
    openSheet(
      '<p class="wr-sheet-title">Jeden ' + WD_NAME[z.wd] + "</p>" +
      '<p class="wr-sheet-hint">Zirkeltraining für die nächsten ' + ZREC_WEEKS + " Wochen.</p>" +
      '<div class="wr-zrec-acts">' +
      '<button type="button" class="wr-pill-btn" data-wr-zrec="circle">' + (z.circle ? "Circle: " + esc(z.circle.name) : "Circle hinzufügen") + "</button>" +
      '<button type="button" class="wr-pill-btn" data-wr-zrec="friends">' + (names.length ? "Freunde: " + esc(names.join(", ")) : "Freunde hinzufügen") + "</button>" +
      '<p class="wr-zrec-lab">Uhrzeit setzen</p><div class="gz-time"><div class="gz-time__col" data-wr-zrec-time>' +
      times.map(function (t) { return '<span class="gz-time__opt">' + t + "</span>"; }).join("") + "</div></div>" +
      '<button type="button" class="wr-dayrow__vis' + (z.vis === "privat" ? "" : " is-on") + '" data-wr-zrec="vis">' + (z.vis === "privat" ? "privat" : "sichtbar") + "</button>" +
      '<p class="wr-sheet-hint">Ersetzt die Einheit aus Deinem Wochenplan an diesem Tag.</p>' +
      "</div>" +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-zrec="back">Zurück</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-zrec="save">Speichern</button></div>'
    );
    var col = document.querySelector("[data-wr-zrec-time]");
    if (col) {
      var idx = Math.max(0, times.indexOf(z.time));
      requestAnimationFrame(function () { col.scrollTop = idx * 44; });
      var tm = null;
      col.addEventListener("scroll", function () {
        clearTimeout(tm);
        tm = setTimeout(function () {
          z.time = times[Math.max(0, Math.min(times.length - 1, Math.round(col.scrollTop / 44)))];
        }, 80);
      }, { passive: true });
    }
  }
  function zrecCircle() {
    if (!global.FFC || !FFC.user || !FFC.user()) {
      if (global.GoDialog) GoDialog.alert("Circles gibt es mit FFC-Zugang. Unter Plus → FFC anmelden.");
      return;
    }
    Promise.resolve(FFC.groups()).then(function (groups) {
      if (!(groups || []).length) { GoDialog.alert("Du bist noch in keinem Circle. Unter Plus → FFC → Deinen Circle verwalten."); return; }
      return GoDialog.choose("Circle hinzufügen", groups.map(function (g) { return { label: g.name, value: String(g.group_id) }; }))
        .then(function (gid) {
          if (!gid) return;
          var g = groups.filter(function (x) { return String(x.group_id) === gid; })[0];
          state.zrec.circle = { id: Number(gid), name: g ? g.name : "Circle" };
          paintZrecDay();
        });
    }).catch(function () {});
  }
  function zrecFriends() {
    loadFriends().then(function () {
      var items = (state.friends || []).map(function (fid) {
        var p = personOf(fid);
        return { label: String(p.name || "Freund").split(" ")[0], value: String(fid), checked: state.zrec.friends.indexOf(String(fid)) >= 0 };
      });
      return GoDialog.pick("Freunde hinzufügen", items, { ok: "Übernehmen", empty: "Noch keine Freunde. Unter Team → Meine Freunde hinzufügen." });
    }).then(function (ids) {
      if (!ids) return;
      state.zrec.friends = ids;
      paintZrecDay();
    });
  }
  function berlinOffsetOf(iso) {
    try {
      var d = new Date(iso + "T12:00:00Z");
      var b = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
      var u = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
      var off = Math.round((b - u) / 60000);
      return (off >= 0 ? "+" : "-") + String(Math.floor(Math.abs(off) / 60)).padStart(2, "0") + ":" + String(Math.abs(off) % 60).padStart(2, "0");
    } catch (e) { return "+01:00"; }
  }
  /* Alternativ: die Plan-Einheit an diesen Tagen fällt aus (wie bei „Alternative“ in Aktuell) */
  function replacePlanUnits(days, keepEvs) {
    var keep = {};
    (keepEvs || []).forEach(function (e) { keep[String(e.id)] = 1; });
    var daySet = {};
    days.forEach(function (d) { daySet[d] = 1; });
    function isPlanUnit(e) {
      return e && String(e.user_id) === me() && e.status === "geplant" && !keep[String(e.id)] &&
        e.item_type !== "support_session" && (e.enrollment_id || isPlanPlaceholder(e.id)) && daySet[dayKey(e.starts_at)];
    }
    var done = {};
    var jobs = [];
    (state.events || []).filter(isPlanUnit).forEach(function (e) {
      done[String(e.id)] = 1;
      jobs.push(materializeEvent(e).then(function (real) {
        return rest("events?id=eq." + encodeURIComponent(real.id) + "&status=eq.geplant", {
          method: "PATCH", prefer: "return=minimal", body: { status: "ausgefallen" }
        });
      }).catch(function () {}));
    });
    var sorted = days.slice().sort();
    var from = sorted[0], to = addDays(sorted[sorted.length - 1], 1);
    jobs.push(rest("events?user_id=eq." + encodeURIComponent(me()) + "&status=eq.geplant&starts_at=gte." + from +
      "&starts_at=lt." + to + "&select=id,user_id,status,item_type,enrollment_id,course_id,starts_at&limit=500")
      .then(function (rows) {
        var ids = (rows || []).filter(function (e) { return isPlanUnit(e) && !done[String(e.id)]; }).map(function (e) { return e.id; });
        if (!ids.length) return;
        return rest("events?id=in.(" + ids.join(",") + ")&status=eq.geplant", {
          method: "PATCH", prefer: "return=minimal", body: { status: "ausgefallen" }
        });
      }).catch(function () {}));
    return Promise.all(jobs);
  }

  function saveZrec(btn) {
    var z = state.zrec;
    btn.disabled = true;
    var first = berlinToday();
    while (new Date(first + "T12:00:00").getDay() !== z.wd) first = addDays(first, 1);
    var dates = [];
    for (var i = 0; i < ZREC_WEEKS; i++) {
      var d = addDays(first, i * 7);
      var at = new Date(d + "T" + z.time + ":00" + berlinOffsetOf(d));
      if (at.getTime() > Date.now()) dates.push({ day: d, at: at.toISOString() });
    }
    var note = global.GoZirkelSetup ? GoZirkelSetup.toNote({ mode: "single", rounds: 6, workSec: 240, restSec: 30 }) : null;
    rest("courses?title=eq.Zirkeltraining&select=id&limit=1").catch(function () { return []; })
      .then(function (rows) {
        var cid = rows && rows[0] ? rows[0].id : null;
        return rest("events", {
          method: "POST",
          prefer: "return=representation",
          body: dates.map(function (x) {
            return { user_id: me(), category: "zirkel", course_id: cid, title: "Zirkeltraining", starts_at: x.at,
              status: "geplant", visibility: z.vis, is_unplanned: false, note: note };
          })
        });
      })
      .then(function (evs) {
        evs = evs || [];
        var jobs = [];
        if (z.friends.length && evs.length) {
          var inv = [];
          evs.forEach(function (ev) {
            z.friends.forEach(function (fid) {
              inv.push({ event_id: ev.id, from_id: me(), to_id: fid, status: "pending", workout_date: dayKey(ev.starts_at) });
            });
          });
          jobs.push(rest("go_workout_invites", { method: "POST", prefer: "return=minimal", body: inv }).catch(function () {}));
        }
        if (z.circle && global.FFC && FFC.createEvent) {
          jobs.push(Promise.resolve(FFC.weeklyPoints ? FFC.weeklyPoints(z.circle.id) : []).then(function (rows) {
            var ids = (rows || []).filter(function (r) { return !r.is_me; }).map(function (r) { return r.user_id; });
            var chain = Promise.resolve();
            dates.forEach(function (x) {
              chain = chain.then(function () {
                return FFC.createEvent({ title: "Zirkeltraining · " + z.circle.name, startsAt: x.at, inviteeIds: ids }).catch(function () {});
              });
            });
            return chain;
          }).catch(function () {}));
        }
        if (z.mode === "alt" && evs.length) jobs.push(replacePlanUnits(dates.map(function (x) { return x.day; }), evs));
        return Promise.all(jobs).then(function () { return evs.length; });
      })
      .then(function (n) {
        state.zrec = null;
        closeSheet();
        if (global.GoDialog) GoDialog.alert("Zirkeltraining jeden " + WD_NAME[z.wd] + " um " + z.time + " Uhr steht (" + n + " Termine).");
        refresh();
      })
      .catch(function () {
        btn.disabled = false;
        if (global.GoDialog) GoDialog.alert("Speichern ging gerade nicht.");
      });
  }

  /* Wochentage mit Zirkel in den nächsten 7 Tagen (eigene, zugesagte, Circle) für das Stift-Menü */
  function zirkelWeekdaysAhead() {
    var from = berlinToday();
    var to = addDays(from, 7);
    var days = {};
    (state.events || []).forEach(function (e) {
      if (!e || e.category !== "zirkel" || e.status === "ausgefallen") return;
      var d = dayKey(e.starts_at);
      if (d >= from && d < to) days[d] = 1;
    });
    (state.ffcEvents || []).forEach(function (e) {
      if (!e || !(e.is_mine || e.my_going === true)) return;
      var d = dayKey(e.starts_at);
      if (d >= from && d < to) days[d] = 1;
    });
    return Object.keys(days).sort().map(function (d) {
      return DAYS_DE[new Date(d + "T12:00:00").getDay()];
    });
  }

  /* ---------- Zirkeltrainings bearbeiten (Stift → 4. Button) ----------
     Woche ab heute: eigene Zirkel (gogogo), Zirkel von Freunden mit meiner Zusage (event_rsvps)
     und Zirkel aus dem Circle (FFC), bei denen ich dabei bin. Eigene: Uhrzeit, privat/zeigen, Stift →
     Löschen oder Format anpassen. Fremde: Stift → Absagen. */
  var PEN_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>';
  function ffcOk() { return !!(global.FFC && FFC.user && FFC.user() && !(global.GoFfcSession && GoFfcSession.foreign && GoFfcSession.foreign())); }
  function openZirkelEditor() {
    state.daysEdit = null;
    var from = berlinToday();
    var to = addDays(from, 7);
    var range = "&starts_at=gte." + encodeURIComponent(from + "T00:00:00Z") + "&starts_at=lt." + encodeURIComponent(to + "T00:00:00Z");
    openSheet('<p class="wr-sheet-title">Zirkeltrainings bearbeiten</p><p class="wr-sheet-hint">Lade…</p>');
    var own = rest("events?user_id=eq." + encodeURIComponent(me()) + "&category=eq.zirkel&status=eq.geplant" + range +
      "&select=id,user_id,title,starts_at,visibility,note&order=starts_at.asc").catch(function () { return []; });
    var joined = rest("event_rsvps?user_id=eq." + encodeURIComponent(me()) + "&status=eq.zugesagt&select=event_id&limit=200")
      .then(function (rs) {
        var ids = (rs || []).map(function (r) { return r.event_id; }).filter(Boolean);
        if (!ids.length) return [];
        return rest("events?id=in.(" + ids.join(",") + ")&category=eq.zirkel&status=eq.geplant" + range +
          "&select=id,user_id,title,starts_at,visibility&order=starts_at.asc");
      }).catch(function () { return []; });
    var ffcEvs = [];
    try { if (ffcOk() && FFC.events) ffcEvs = FFC.events() || []; } catch (eF) {}
    Promise.all([own, joined]).then(function (r) {
      var rows = [];
      var ownTimes = [];
      (r[0] || []).forEach(function (ev) {
        ownTimes.push(new Date(ev.starts_at).getTime());
        rows.push({ key: "go:" + ev.id, kind: "own", ev: ev, at: ev.starts_at, title: ev.title || "Zirkeltraining" });
      });
      (r[1] || []).forEach(function (ev) {
        if (String(ev.user_id) === me()) return;
        var who = personOf(ev.user_id);
        rows.push({ key: "rsvp:" + ev.id, kind: "joined", ev: ev, at: ev.starts_at, title: ev.title || "Zirkeltraining", who: who && who.name });
      });
      ffcEvs.forEach(function (ev) {
        var t = new Date(ev.starts_at).getTime();
        var day = dayKey(ev.starts_at);
        if (!(day >= from && day < to)) return;
        /* Circle-Kopie meines eigenen Zirkels (Mit Circle teilen): nicht doppelt, hängt an der eigenen Zeile */
        if (ev.is_mine) {
          var twin = rows.filter(function (x) { return x.kind === "own" && Math.abs(new Date(x.at).getTime() - t) <= 30 * 60000; })[0];
          if (twin) { twin.circleCopy = ev; return; }
        }
        if (ev.is_mine) {
          /* Circle-Termin (Zirkel-App) immer als eigene Zeile, damit er einzeln gelöscht werden kann */
          rows.push({ key: "ffc:" + ev.id, kind: "ffcOwn", ev: ev, at: ev.starts_at, title: ev.title || "Zirkeltraining" });
        } else if (ev.my_going === true) {
          rows.push({ key: "ffc:" + ev.id, kind: "ffcJoined", ev: ev, at: ev.starts_at, title: ev.title || "Zirkeltraining", who: ev.creator_nickname || "" });
        }
      });
      rows.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
      state.zEdit = { rows: rows, times: {}, vis: {}, orig: {}, invited: {}, ownFfc: ffcEvs.filter(function (e) { return e.is_mine; }) };
      /* eingeladene Freunde je eigenem Zirkel (wiederkehrend eingeladen) */
      var ownIds = rows.filter(function (x) { return x.kind === "own"; }).map(function (x) { return x.ev.id; });
      if (ownIds.length) {
        rest("go_workout_invites?from_id=eq." + encodeURIComponent(me()) + "&event_id=in.(" + ownIds.join(",") + ")&status=in.(pending,accepted)&select=event_id,to_id,status")
          .then(function (inv) {
            (inv || []).forEach(function (r) {
              var k = String(r.event_id);
              (state.zEdit.invited[k] = state.zEdit.invited[k] || []).push({ id: String(r.to_id), status: r.status });
            });
            return ensurePeople((inv || []).map(function (r) { return String(r.to_id); }));
          })
          .then(function () { if (state.zEdit && !state.zEdit.fmt && document.querySelector("[data-wr-zpen]")) paintZirkelEditor(); })
          .catch(function () {});
      }
      rows.forEach(function (x) {
        if (x.kind !== "own") return;
        var tm = displayTime(x.at) ? formatTime(x.at) : NO_TIME;
        state.zEdit.times[x.ev.id] = tm;
        state.zEdit.orig[x.ev.id] = tm;
        state.zEdit.vis[x.ev.id] = x.ev.visibility === "privat" ? "privat" : "team";
      });
      paintZirkelEditor();
    });
  }

  function paintZirkelEditor() {
    var ze = state.zEdit;
    if (!ze) return;
    var groups = host && host.myGroups ? host.myGroups() || [] : [];
    var rows = ze.rows.map(function (x, i) {
      var d = new Date(dayKey(x.at) + "T12:00:00");
      var label = DAYS_DE[d.getDay()] + " " + d.getDate() + ".";
      var title = "<b>" + label + "</b> " + esc(String(x.title).replace(/\s*·.*$/, "")) + (x.who ? ' <span class="wr-dayrow__who">· ' + esc(String(x.who).split(" ")[0]) + "</span>" : "");
      /* Zeile 3: wer ist dabei – Circle, Gruppe (alle Mitglieder eingeladen) oder einzelne Freunde */
      var with_ = [];
      if (x.circleCopy) with_.push('<span class="wr-dayrow__tag">Circle ' + esc(String(x.circleCopy.title || "").split("·").slice(1).join("·").trim() || "") + "</span>");
      var inv = x.kind === "own" ? (ze.invited[String(x.ev.id)] || []) : [];
      if (inv.length) {
        var ids = inv.map(function (v) { return v.id; });
        var g = groups.filter(function (gg) { var m = (gg.members || []).map(String); return m.length && m.every(function (id) { return ids.indexOf(id) >= 0; }); })[0];
        if (g) with_.push('<span class="wr-dayrow__tag">Gruppe ' + esc(g.name) + "</span>");
        inv.forEach(function (v) {
          if (g && (g.members || []).map(String).indexOf(v.id) >= 0) return;
          var p = personOf(v.id);
          with_.push('<span class="wr-zface' + (v.status === "pending" ? " is-pending" : "") + '" title="' + esc(p.name || "") + '">' +
            (p.photo ? '<img src="' + esc(p.photo) + '" alt="" />' : esc(String(p.name || "?").slice(0, 1))) + "</span>");
        });
      }
      var ctl;
      if (x.kind === "own") {
        var opts = timeOptsFor(ze.times[x.ev.id]);
        var ti = Math.max(0, opts.indexOf(ze.times[x.ev.id]));
        var vis = ze.vis[x.ev.id];
        ctl = '<div class="wr-mini-wheel" data-wr-zmini="' + esc(x.ev.id) + '" data-idx="' + ti + '">' +
          opts.map(function (t) { return '<span class="wr-mini-opt">' + t + "</span>"; }).join("") + "</div>" +
          '<button type="button" class="wr-dayrow__vis' + (vis === "privat" ? "" : " is-on") + '" data-wr-zvis="' + esc(x.ev.id) + '">' + (vis === "privat" ? "privat" : "zeigen") + "</button>";
      } else {
        ctl = '<span class="wr-dayrow__time">' + esc(displayTime(x.at) ? formatTime(x.at) : "–:–") + "</span>" +
          '<span class="wr-dayrow__tag">' + (x.kind === "ffcOwn" ? "Circle" : "dabei") + "</span>";
      }
      return '<div class="wr-dayrow wr-dayrow--z">' +
        '<div class="wr-dayrow__mid"><span class="wr-dayrow__title">' + title + "</span>" +
        '<div class="wr-dayrow__ctl">' + ctl + "</div>" +
        (with_.length ? '<div class="wr-dayrow__with">' + with_.join("") + "</div>" : "") + "</div>" +
        '<button type="button" class="wr-dayrow__pen" data-wr-zpen="' + i + '" aria-label="Bearbeiten">' + PEN_SVG + "</button></div>";
    }).join("");
    openSheet(
      '<p class="wr-sheet-title">Zirkeltrainings bearbeiten</p>' +
      (rows ? '<div class="wr-days wr-days--all">' + rows + "</div>" :
        '<p class="wr-sheet-hint">Diese Woche ist kein Zirkeltraining geplant.</p>') +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">' + (rows ? "Verlassen" : "Schließen") + "</button>" +
      (ze.rows.some(function (x) { return x.kind === "own"; }) ? '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-zedit-save="1">Speichern</button>' : "") + "</div>"
    );
    var card = $("wr-sheet-card");
    if (!card) return;
    card.classList.add("wr-sheet__card--days");
    card.querySelectorAll("[data-wr-zmini]").forEach(function (w) {
      w.scrollTop = (Number(w.getAttribute("data-idx")) || 0) * 36;
      var tm = null;
      w.addEventListener("scroll", function () {
        clearTimeout(tm);
        tm = setTimeout(function () {
          if (!state.zEdit) return;
          var id = w.getAttribute("data-wr-zmini");
          var o = timeOptsFor(state.zEdit.orig[id]);
          state.zEdit.times[id] = o[Math.max(0, Math.min(o.length - 1, Math.round(w.scrollTop / 36)))];
        }, 80);
      }, { passive: true });
    });
    if (card._wrZeditBound) return;
    card._wrZeditBound = true;
    card.addEventListener("click", function (e) {
      if (!state.zEdit || !document.querySelector("[data-wr-zpen], [data-wr-zedit-save], .wr-zfmt")) return;
      var vb = e.target.closest && e.target.closest("[data-wr-zvis]");
      if (vb) {
        var id = vb.getAttribute("data-wr-zvis");
        var nv = state.zEdit.vis[id] === "privat" ? "team" : "privat";
        state.zEdit.vis[id] = nv;
        vb.classList.toggle("is-on", nv === "team");
        vb.textContent = nv === "privat" ? "privat" : "zeigen";
        return;
      }
      var pen = e.target.closest && e.target.closest("[data-wr-zpen]");
      if (pen) { zirkelRowMenu(state.zEdit.rows[Number(pen.getAttribute("data-wr-zpen"))]); return; }
      if (e.target.closest && e.target.closest("[data-wr-zedit-save]")) { saveZirkelEditor(); return; }
      if (e.target.closest && e.target.closest("[data-wr-zfmt-save]")) { saveZirkelFormat(); return; }
      if (e.target.closest && e.target.closest("[data-wr-zfmt-back]")) { paintZirkelEditor(); return; }
    });
  }

  function zirkelRowMenu(x) {
    if (!x || !global.GoDialog) return;
    var d = new Date(dayKey(x.at) + "T12:00:00");
    var when = DAYS_DE[d.getDay()] + " " + d.getDate() + "." + (displayTime(x.at) ? ", " + formatTime(x.at) : "");
    var mine = x.kind === "own" || x.kind === "ffcOwn";
    var opts = mine ? [{ label: "Löschen", value: "del" }] : [{ label: "Absagen", value: "del" }];
    if (x.kind === "own") opts.push({ label: "Format anpassen", value: "fmt" });
    GoDialog.choose(x.title + " · " + when, opts).then(function (v) {
      if (v === "fmt") { setTimeout(function () { openZirkelFormat(x); }, 0); return; }
      if (v !== "del") return;
      GoDialog.confirm(mine ? "Zirkeltraining am " + when + " löschen?" : "Beim Zirkeltraining am " + when + " absagen?", {
        ok: mine ? "Löschen" : "Absagen",
        cancel: "Abbrechen"
      }).then(function (ok) {
        if (!ok) return;
        deleteZirkelRow(x).then(function () {
          state.zEdit.rows = state.zEdit.rows.filter(function (r) { return r !== x; });
          paintZirkelEditor();
          if (host.toast) host.toast(mine ? "Gelöscht" : "Abgesagt");
          return refresh().then(notifyAktuell);
        }).catch(function () { if (host.toast) host.toast("Hat nicht geklappt"); });
      });
    });
  }

  function deleteZirkelRow(x) {
    if (x.kind === "own") {
      /* eigenes Event weg; liegt eine Kopie im Circle (gleiche Startzeit), die auch */
      var t = new Date(x.at).getTime();
      var copies = ((state.zEdit && state.zEdit.ownFfc) || []).filter(function (e) {
        return Math.abs(new Date(e.starts_at).getTime() - t) <= 600000;
      });
      return rest("events?id=eq." + encodeURIComponent(x.ev.id) + "&user_id=eq." + encodeURIComponent(me()), {
        method: "DELETE", prefer: "return=minimal"
      }).then(function () {
        if (!copies.length || !ffcOk() || !FFC.deleteEvent) return;
        return Promise.all(copies.map(function (c) { return Promise.resolve(FFC.deleteEvent(c.id)).catch(function () {}); }));
      });
    }
    if (x.kind === "joined") {
      return rest("event_rsvps?event_id=eq." + encodeURIComponent(x.ev.id) + "&user_id=eq." + encodeURIComponent(me()), {
        method: "DELETE", prefer: "return=minimal"
      });
    }
    if (x.kind === "ffcOwn") {
      if (!ffcOk() || !FFC.deleteEvent) return Promise.reject(new Error("ffc"));
      return Promise.resolve(FFC.deleteEvent(x.ev.id)).then(function (res) { if (res && res.error) throw res.error; });
    }
    if (!ffcOk() || !FFC.respondEvent) return Promise.reject(new Error("ffc"));
    return Promise.resolve(FFC.respondEvent(x.ev.id, false)).then(function (res) { if (res && res.error) throw res.error; });
  }

  /* Format anpassen: dieselbe Voreinstellung wie beim Anlegen */
  function openZirkelFormat(x) {
    var z = (global.GoZirkelSetup && GoZirkelSetup.parse(x.ev.note)) || { mode: "single" };
    state.zEdit.fmt = x;
    loadFriends().then(function () {
      var friends = (state.friends || []).map(function (fid) { return personOf(fid); });
      openSheet(
        '<div class="wr-zfmt"><h3>Zirkeltraining</h3>' +
        GoZirkelSetup.html(z, { friends: friends }) +
        '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-zfmt-back="1">Zurück</button>' +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-zfmt-save="1">Speichern</button></div></div>'
      );
      var card = $("wr-sheet-card");
      if (card) card.classList.remove("wr-sheet__card--days");
      requestAnimationFrame(function () { GoZirkelSetup.bind(document.querySelector(".wr-sheet")); });
    });
  }

  function saveZirkelFormat() {
    var x = state.zEdit && state.zEdit.fmt;
    if (!x) return;
    var old = (GoZirkelSetup.parse(x.ev.note) || {});
    var z = GoZirkelSetup.read(document.querySelector(".wr-sheet") || document);
    z.online = !!old.online;
    /* unbekannte Zusätze der alten Notiz (z. B. Start-Absprachen) behalten */
    var known = /^(zirkel:|work=|pause=|rounds=|online=|partner=|pname=)/;
    var extra = String(x.ev.note || "").split("|").filter(function (seg, i) { return i > 0 && seg && !known.test(seg); })
      .map(function (seg) { return "|" + seg; }).join("");
    var note = GoZirkelSetup.toNote(z, extra);
    rest("events?id=eq." + encodeURIComponent(x.ev.id) + "&user_id=eq." + encodeURIComponent(me()), {
      method: "PATCH", prefer: "return=minimal", body: { note: note }
    }).then(function () {
      x.ev.note = note;
      showSavedNote();
      paintZirkelEditor();
      return refresh().then(notifyAktuell);
    }).catch(function () { if (host.toast) host.toast("Hat nicht geklappt"); });
  }

  /* Zirkel-App kennt kein Verschieben: Circle-Kopie löschen und zur neuen Zeit neu anlegen (gleiche Einladungen an den Circle) */
  function moveCircleCopy(copy, newAt) {
    if (!ffcOk() || !FFC.deleteEvent || !FFC.createEvent) return Promise.resolve();
    var cname = String(copy.title || "").split("·").slice(1).join("·").trim();
    return Promise.resolve(FFC.groups ? FFC.groups() : []).then(function (groups) {
      var g = (groups || []).filter(function (x) { return String(x.name || "").trim() === cname; })[0];
      return Promise.resolve(g && FFC.weeklyPoints ? FFC.weeklyPoints(g.group_id) : []).then(function (pts) {
        var ids = (pts || []).filter(function (p) { return !p.is_me; }).map(function (p) { return p.user_id; });
        return Promise.resolve(FFC.deleteEvent(copy.id)).then(function () {
          return FFC.createEvent({ title: copy.title, startsAt: newAt, inviteeIds: ids });
        });
      });
    }).catch(function () {});
  }

  function saveZirkelEditor() {
    var ze = state.zEdit;
    if (!ze) return;
    var jobs = [];
    ze.rows.forEach(function (x) {
      if (x.kind !== "own") return;
      var id = x.ev.id;
      var iso = dayKey(x.at);
      var pick = ze.times[id];
      var untimed = pick === NO_TIME;
      var body = {};
      if (pick !== ze.orig[id]) body.starts_at = untimed ? iso + "T12:00:00Z" : timedStarts(iso, pick);
      var vis = ze.vis[id];
      if (vis !== (x.ev.visibility === "privat" ? "privat" : "team")) body.visibility = vis === "privat" ? "privat" : "team";
      if (!Object.keys(body).length) return;
      jobs.push(rest("events?id=eq." + encodeURIComponent(id) + "&user_id=eq." + encodeURIComponent(me()), {
        method: "PATCH", prefer: "return=minimal", body: body
      }).then(function () {
        if (body.starts_at) { x.at = body.starts_at; x.ev.starts_at = body.starts_at; ze.orig[id] = pick; }
        if (body.visibility) x.ev.visibility = body.visibility;
        if (body.starts_at && x.circleCopy) return moveCircleCopy(x.circleCopy, body.starts_at);
      }));
    });
    Promise.all(jobs).then(function () {
      showSavedNote();
      return refresh().then(notifyAktuell);
    }).catch(function () { if (host.toast) host.toast("Hat nicht geklappt"); });
  }

  /* Normalfall des Wochenplans für einen Tag: ohne Alternativen und Reise-Ersatz.
     Hat eine Alternative die Einheit ersetzt (status ausgefallen), steht trotzdem die Einheit aus dem Plan da. */
  function isAltEvent(e) {
    return !!(e && (e.item_type === "alternative" || e.travel_auto || e.item_type === "hotel_workout"));
  }
  function normalDayEvents(iso) {
    return state.events.filter(function (e) {
      return e && String(e.user_id) === me() && e.item_type !== "support_session" && !isAltEvent(e) &&
        dayKey(e.starts_at) === iso &&
        (e.status !== "ausgefallen" || !!(e.enrollment_id || e.course_id));
    }).sort(function (a, b) {
      var sa = a.status === "ausgefallen" ? 1 : 0, sb = b.status === "ausgefallen" ? 1 : 0;
      var pa = a.enrollment_id || a.course_id ? 0 : 1;
      var pb = b.enrollment_id || b.course_id ? 0 : 1;
      return sa - sb || pa - pb || String(a.starts_at).localeCompare(String(b.starts_at));
    });
  }

  /* ---------- Gruppen-Events (Mitglied): 7 Tage, Gruppen-Events ersetzen dort den Wochenplan ----------
     „−“ nimmt ein Event wieder heraus (mit Bestätigung), Weiter sagt beim Coach zu. Lässt sich jederzeit wiederholen. */
  function groupOfMine() { return host && host.myGroups ? (host.myGroups() || [])[0] || null : null; }
  function myPlanOnDay(iso) {
    return (state.events || []).filter(function (e) {
      return e && String(e.user_id) === me() && e.item_type !== "support_session" && e.item_type !== "alternative" &&
        !e.travel_auto && e.item_type !== "hotel_workout" && dayKey(e.starts_at) === iso && e.status !== "erledigt" &&
        (e.status !== "ausgefallen" || !!(e.enrollment_id || e.course_id)) && !(e.group_id && e.visibility === "gruppe" && String(e.user_id) !== me());
    })[0] || null;
  }
  function openGroupEventsPick() {
    var g = groupOfMine();
    if (!g) return;
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(berlinToday(), i));
    openSheet('<p class="wr-sheet-title">Gruppen-Events</p><p class="wr-sheet-hint">Lädt …</p>');
    var from = days[0] + "T00:00:00" + berlinOffsetSuffix(days[0]);
    var to = addDays(days[6], 1) + "T00:00:00" + berlinOffsetSuffix(days[6]);
    rest("events?group_id=eq." + encodeURIComponent(g.id) + "&user_id=neq." + encodeURIComponent(me()) +
      "&status=eq.geplant&starts_at=gte." + encodeURIComponent(from) + "&starts_at=lt." + encodeURIComponent(to) +
      "&select=id,user_id,title,category,starts_at,course_id,enrollment_id&order=starts_at.asc&limit=50")
      .then(function (evs) {
        evs = evs || [];
        if (!evs.length) return [evs, []];
        return rest("event_rsvps?user_id=eq." + encodeURIComponent(me()) + "&event_id=in.(" + evs.map(function (e) { return e.id; }).join(",") + ")&select=event_id,status")
          .catch(function () { return []; }).then(function (rs) { return [evs, rs || []]; });
      })
      .then(function (r) {
        var going = {};
        r[1].forEach(function (x) { if (x && x.status === "zugesagt") going[String(x.event_id)] = true; });
        /* Auswahl: bisher zugesagte bleiben, neue sind vorgeschlagen */
        state.gev = { group: g, days: days, evs: r[0], going: going, keep: {} };
        r[0].forEach(function (e) { state.gev.keep[String(e.id)] = true; });
        paintGroupEventsPick();
      })
      .catch(function () {
        openSheet('<p class="wr-sheet-title">Gruppen-Events</p><p class="wr-sheet-hint">Laden ging gerade nicht.</p>' +
          '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Schließen</button></div>');
      });
  }
  function paintGroupEventsPick() {
    var st = state.gev;
    if (!st) return;
    var rows = st.days.map(function (iso) {
      var d = new Date(iso + "T12:00:00");
      var label = DAYS_DE[d.getDay()] + " " + d.getDate() + ".";
      var plan = myPlanOnDay(iso);
      var gevs = st.evs.filter(function (e) { return dayKey(e.starts_at) === iso && st.keep[String(e.id)]; });
      if (!gevs.length) {
        return '<div class="wr-dayrow wr-zrec-row' + (plan ? "" : " is-empty") + '"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + label + "</b> " +
          (plan ? esc(plan.title || "Training") : '<span class="wr-dayrow__free">frei</span>') + "</span></div><span></span></div>";
      }
      return gevs.map(function (e, k) {
        var tm = displayTime(e.starts_at) ? " · " + formatTime(e.starts_at) : "";
        return '<div class="wr-dayrow wr-zrec-row is-zirkel is-group"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + (k ? "" : label) + "</b> " +
          "👥 " + esc(e.title || "Training") + esc(tm) + (plan && !k ? ' <s class="wr-dayrow__free">' + esc(plan.title || "") + "</s>" : "") +
          '</span></div><button type="button" class="wr-dayrow__minus" data-wr-gev-rm="' + esc(e.id) + '" aria-label="Entfernen">−</button></div>';
      }).join("");
    }).join("");
    var any = st.evs.length;
    openSheet(
      '<p class="wr-sheet-title">Gruppen-Events</p>' +
      '<p class="wr-sheet-hint">' + (any ? "Die Events Deiner Gruppe " + esc(st.group.name || "") + " ersetzen an diesen Tagen Deinen Wochenplan. Mit − nimmst Du eins heraus." : "Diese Woche gibt es keine Gruppen-Events.") + "</p>" +
      '<div class="wr-days wr-days--all">' + rows + "</div>" +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Verlassen</button>' +
      (any ? '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-gev-save="1">Weiter</button>' : "") + "</div>"
    );
    bindGroupSheet();
  }
  function saveGroupEventsPick(btn) {
    var st = state.gev;
    if (!st) return;
    if (btn) btn.disabled = true;
    var jobs = [];
    st.evs.forEach(function (e) {
      var id = String(e.id);
      var iso = dayKey(e.starts_at);
      var plan = myPlanOnDay(iso);
      if (st.keep[id] && !st.going[id]) {
        jobs.push(rest("event_rsvps?on_conflict=event_id,user_id", {
          method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
          body: { event_id: id, user_id: me(), status: "zugesagt" }
        }).then(function () {
          /* Ersatz für den Wochenplan an diesem Tag */
          if (plan && plan.status === "geplant" && /^[0-9a-f-]{36}$/i.test(String(plan.id))) {
            return rest("events?id=eq." + encodeURIComponent(plan.id) + "&user_id=eq." + encodeURIComponent(me()), {
              method: "PATCH", prefer: "return=minimal", body: { status: "ausgefallen" }
            });
          }
        }));
      } else if (!st.keep[id] && st.going[id]) {
        jobs.push(rest("event_rsvps?event_id=eq." + encodeURIComponent(id) + "&user_id=eq." + encodeURIComponent(me()), {
          method: "DELETE", prefer: "return=minimal"
        }).then(function () {
          /* herausgenommen: Plan-Einheit dieses Tages wieder geplant, wenn kein anderes Gruppen-Event bleibt */
          var other = st.evs.some(function (o) { return String(o.id) !== id && dayKey(o.starts_at) === iso && st.keep[String(o.id)]; });
          if (!other && plan && plan.status === "ausgefallen" && (plan.enrollment_id || plan.course_id)) {
            return rest("events?id=eq." + encodeURIComponent(plan.id) + "&user_id=eq." + encodeURIComponent(me()), {
              method: "PATCH", prefer: "return=minimal", body: { status: "geplant" }
            });
          }
        }));
      }
    });
    Promise.all(jobs).then(function () {
      closeSheet();
      if (host.toast) host.toast(jobs.length ? "Beim Coach zugesagt" : "Nichts geändert");
      return refresh().then(notifyAktuell);
    }).catch(function () {
      if (btn) btn.disabled = false;
      if (host.toast) host.toast("Speichern ging gerade nicht");
    });
  }

  /* ---------- zusätzliche Gruppen-Events (Coach): eigene Trainings der 7 Tage, geteilte markiert,
     an Tagen ohne Gruppen-Event ein freies Feld → Kraft oder Ausdauer wählen. Nichts verschiebbar. ---------- */
  function openGroupExtras() {
    var g = groupOfMine();
    if (!g) return;
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(berlinToday(), i));
    state.gextra = { group: g, days: days };
    var rows = days.map(function (iso) {
      var d = new Date(iso + "T12:00:00");
      var label = DAYS_DE[d.getDay()] + " " + d.getDate() + ".";
      var mine = (state.events || []).filter(function (e) {
        return e && String(e.user_id) === me() && dayKey(e.starts_at) === iso && e.status !== "ausgefallen" &&
          e.item_type !== "support_session";
      }).sort(function (a, b) { return String(a.starts_at).localeCompare(String(b.starts_at)); });
      var shared = mine.filter(function (e) { return e.visibility === "gruppe" && String(e.group_id || "") === String(g.id); });
      var html = mine.map(function (e, k) {
        var isSh = shared.indexOf(e) >= 0;
        var tm = displayTime(e.starts_at) ? " · " + formatTime(e.starts_at) : "";
        return '<div class="wr-dayrow wr-zrec-row' + (isSh ? " is-zirkel is-group" : "") + '"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + (k ? "" : label) + "</b> " +
          (isSh ? "👥 " : "") + esc(e.title || "Training") + esc(tm) + "</span>" +
          (isSh ? '<span class="wr-dayrow__tag">in der Gruppe</span>' : "") + "</div><span></span></div>";
      }).join("");
      if (!shared.length) {
        html += '<button type="button" class="wr-dayrow wr-zrec-row wr-dayrow--add" data-wr-gextra-add="' + iso + '"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' +
          (mine.length ? "" : label) + '</b> <span class="wr-dayrow__free">+ Gruppen-Event</span></span></div><span></span></button>';
      }
      return html;
    }).join("");
    openSheet(
      '<p class="wr-sheet-title">Zusätzliche Gruppen-Events</p>' +
      '<p class="wr-sheet-hint">Markiert: schon mit ' + esc(g.name || "Deiner Gruppe") + " geteilt. Im freien Feld legst Du ein zusätzliches Event an, Deine Gruppe kann es unter Gruppen-Events wählen.</p>" +
      '<div class="wr-days wr-days--all">' + rows + "</div>" +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Fertig</button></div>'
    );
    bindGroupSheet();
  }
  function groupExtraAdd(iso) {
    var g = state.gextra && state.gextra.group;
    if (!g || !global.GoDialog) return;
    GoDialog.choose("Gruppen-Event am " + DAYS_DE[new Date(iso + "T12:00:00").getDay()], [
      { label: "Kraft", value: "kraft" },
      { label: "Ausdauer", value: "ausdauer" }
    ], { center: true }).then(function (kind) {
      if (!kind) return;
      setTimeout(function () {
        openKindSheet(kind, iso);
        /* Auswahl läuft über die normale Liste; beim Speichern wird es ein Gruppen-Event (ohne den Wochenplan zu ändern) */
        state.groupExtraNext = g.id;
      }, 0);
    });
  }
  function bindGroupSheet() {
    var card = $("wr-sheet-card");
    if (card) card.classList.add("wr-sheet__card--days");
    if (!card || card._wrGevBound) return;
    card._wrGevBound = true;
    card.addEventListener("click", function (e) {
      var rm = e.target.closest("[data-wr-gev-rm]");
      if (rm && state.gev) {
        e.stopPropagation();
        var id = rm.getAttribute("data-wr-gev-rm");
        var ev = state.gev.evs.filter(function (x) { return String(x.id) === id; })[0] || {};
        GoDialog.confirm("„" + (ev.title || "Gruppen-Event") + "“ herausnehmen?", { body: "Du sagst für dieses Event nicht zu. Dein Wochenplan gilt an dem Tag wieder.", ok: "Entfernen", cancel: "Abbrechen", row: true })
          .then(function (yes) { if (yes) { state.gev.keep[id] = false; paintGroupEventsPick(); } });
        return;
      }
      var sv = e.target.closest("[data-wr-gev-save]");
      if (sv) { e.stopPropagation(); saveGroupEventsPick(sv); return; }
      var add = e.target.closest("[data-wr-gextra-add]");
      if (add) { e.stopPropagation(); groupExtraAdd(add.getAttribute("data-wr-gextra-add")); return; }
    });
  }

  function openDaysEditor() {
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(berlinToday(), i));
    var slots = days.map(function (iso) {
      /* je Tag die Einheit aus dem Wochenplan (Normalfall); Termine wie Initialgespräch verdrängen sie nicht */
      return normalDayEvents(iso).filter(function (e) { return e.status !== "erledigt"; })[0] || null;
    });
    /* Tag schon trainiert: erledigtes Event anzeigen statt „frei“ (nur Anzeige, nicht verschiebbar) */
    var done = days.map(function (iso, i) {
      if (slots[i]) return null;
      return normalDayEvents(iso).filter(function (e) { return e.status === "erledigt"; })[0] || null;
    });
    state.daysEdit = { days: days, slots: slots, done: done, times: {}, vis: {}, orig: {}, bub: {} };
    slots.forEach(function (ev) {
      if (!ev) return;
      state.daysEdit.times[ev.id] = displayTime(ev.starts_at) ? formatTime(ev.starts_at) : NO_TIME;
      state.daysEdit.vis[ev.id] = VIS_LABEL[ev.visibility] ? ev.visibility : "team";
      state.daysEdit.bub[ev.id] = !!ev.bubble_id;
      state.daysEdit.orig[ev.id] = state.daysEdit.times[ev.id];
    });
    paintDaysEditor();
  }

  function paintDaysEditor() {
    var de = state.daysEdit;
    if (!de) return;
    var rows = de.days.map(function (iso, i) {
      var d = new Date(iso + "T12:00:00");
      var label = DAYS_DE[d.getDay()] + " " + d.getDate() + ".";
      var ev = de.slots[i];
      if (!ev) {
        var doneEv = de.done && de.done[i];
        return '<div class="wr-dayrow is-empty' + (doneEv ? " is-done" : "") + '" data-wr-dayslot="' + i + '"><div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + label + "</b> " +
          (doneEv ? '<span aria-label="erledigt">✓</span> ' + esc(doneEv.title || "Training") : '<span class="wr-dayrow__free">frei</span>') +
          "</span></div><span></span></div>";
      }
      var opts = timeOptsFor(de.times[ev.id]);
      var ti = Math.max(0, opts.indexOf(de.times[ev.id]));
      var vis = de.vis[ev.id];
      /* Zeile 1: Wochentag + Name. Zeile 2: Uhrzeit, zeigen/privat (feste Breite), Bubble, Media. Griff über die volle Höhe */
      return '<div class="wr-dayrow" data-wr-dayslot="' + i + '">' +
        '<div class="wr-dayrow__mid"><span class="wr-dayrow__title"><b>' + label + "</b> " + esc(ev.title || "Training") + "</span>" +
        '<div class="wr-dayrow__ctl"><div class="wr-mini-wheel" data-wr-mini="' + esc(ev.id) + '" data-idx="' + ti + '">' +
        opts.map(function (t) { return '<span class="wr-mini-opt">' + t + "</span>"; }).join("") + "</div>" +
        /* Sichtbarkeit und Bubble in einem Dropdown wie der Filter in Aktuell */
        '<label class="wr-dayrow__pick"><select data-wr-dayvissel="' + esc(ev.id) + '" aria-label="Wer sieht es">' +
          visCycle().map(function (v) {
            return '<option value="' + v + '"' + ((state.daysEdit.bub[ev.id] ? v === "bubble" : v === vis) ? " selected" : "") + ">" + esc(visPickLabel(v)) + "</option>";
          }).join("") + "</select></label>" +
        '<button type="button" class="wr-dayrow__vis" data-wr-daymedia="' + esc(ev.id) + '">Media</button>' +
        "</div></div>" +
        '<span class="wr-dayrow__grip" data-wr-grip="' + i + '" aria-label="Ziehen"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span></div>';
    }).join("");
    openSheet(
      '<p class="wr-sheet-title">Tage bearbeiten</p>' +
      '<p class="wr-sheet-hint">Einheiten verschieben, Uhrzeit anpassen und wählen, wer sie sieht.</p>' +
      '<div class="wr-days wr-days--all">' + rows + "</div>" +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Verlassen</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-days-save="1">Speichern</button></div>'
    );
    var cardAll = $("wr-sheet-card");
    if (cardAll) cardAll.classList.add("wr-sheet__card--days");
    var card = $("wr-sheet-card");
    if (!card) return;
    /* Räder auf den Wert stellen und Scroll lesen */
    card.querySelectorAll("[data-wr-mini]").forEach(function (w) {
      var idx = Number(w.getAttribute("data-idx")) || 0;
      w.scrollTop = idx * 36;
      var tm = null;
      w.addEventListener("scroll", function () {
        clearTimeout(tm);
        tm = setTimeout(function () {
          var id = w.getAttribute("data-wr-mini");
          if (!state.daysEdit) return;
          var o = timeOptsFor(state.daysEdit.orig[id]);
          var n = Math.max(0, Math.min(o.length - 1, Math.round(w.scrollTop / 36)));
          state.daysEdit.times[id] = o[n];
        }, 80);
      }, { passive: true });
    });
    if (card._wrDaysBound) return;
    card._wrDaysBound = true;
    card.addEventListener("change", function (e) {
      var sel = e.target && e.target.closest ? e.target.closest("select[data-wr-dayvissel]") : null;
      if (!sel || !state.daysEdit) return;
      var id = sel.getAttribute("data-wr-dayvissel");
      state.daysEdit.vis[id] = sel.value;
      /* Bubble gewählt = Event in der Bubble; alles andere nimmt es aus der Bubble */
      state.daysEdit.bub[id] = sel.value === "bubble";
    });
    card.addEventListener("click", function (e) {
      if (!state.daysEdit) return;
      var vb = e.target.closest && e.target.closest("[data-wr-dayvis]");
      if (vb) {
        var id = vb.getAttribute("data-wr-dayvis");
        /* privat → Gruppe → Circle → Bubble → Team (nur was es gibt) */
        var cyc = visCycle();
        var nv = cyc[(cyc.indexOf(state.daysEdit.vis[id]) + 1) % cyc.length];
        state.daysEdit.vis[id] = nv;
        /* Bubble schaltet die Bubble-Markierung mit ein (und beim Weiterschalten wieder aus, wenn sie nur dafür an war) */
        var bb2 = document.querySelector('[data-wr-daybub="' + id + '"]');
        state.daysEdit.bubAuto = state.daysEdit.bubAuto || {};
        if (nv === "bubble" && !state.daysEdit.bub[id]) { state.daysEdit.bub[id] = true; state.daysEdit.bubAuto[id] = true; }
        else if (nv !== "bubble" && state.daysEdit.bubAuto[id]) { state.daysEdit.bub[id] = false; state.daysEdit.bubAuto[id] = false; }
        if (bb2) { bb2.classList.toggle("is-on", !!state.daysEdit.bub[id]); bb2.setAttribute("aria-pressed", state.daysEdit.bub[id] ? "true" : "false"); }
        vb.classList.toggle("is-on", nv !== "privat");
        vb.textContent = VIS_LABEL[nv];
        return;
      }
      if (e.target.closest && e.target.closest("[data-wr-days-save]")) saveDaysEditor();
      var bb = e.target.closest && e.target.closest("[data-wr-daybub]");
      if (bb) {
        var bid = bb.getAttribute("data-wr-daybub");
        state.daysEdit.bub[bid] = !state.daysEdit.bub[bid];
        bb.classList.toggle("is-on", state.daysEdit.bub[bid]);
        bb.setAttribute("aria-pressed", state.daysEdit.bub[bid] ? "true" : "false");
        return;
      }
      var mb = e.target.closest && e.target.closest("[data-wr-daymedia]");
      if (mb) { var mid = mb.getAttribute("data-wr-daymedia"); setTimeout(function () { openMediaSheet(mid); }, 0); }
    });
    /* Ziehen am Griff */
    var drag = null;
    card.addEventListener("pointerdown", function (e) {
      var g = e.target.closest && e.target.closest("[data-wr-grip]");
      if (!g || !state.daysEdit) return;
      e.preventDefault();
      var row = g.closest(".wr-dayrow");
      var r = row.getBoundingClientRect();
      var ghost = row.cloneNode(true);
      ghost.classList.add("wr-dayrow--ghost");
      ghost.style.width = r.width + "px";
      ghost.style.left = r.left + "px";
      ghost.style.top = r.top + "px";
      document.body.appendChild(ghost);
      row.classList.add("is-drag");
      drag = { from: Number(g.getAttribute("data-wr-grip")), row: row, ghost: ghost, dy: e.clientY - r.top };
      try { g.setPointerCapture(e.pointerId); } catch (eC) {}
    });
    card.addEventListener("pointermove", function (e) {
      if (!drag) return;
      drag.ghost.style.top = (e.clientY - drag.dy) + "px";
    });
    function endDrag(e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      d.ghost.remove();
      d.row.classList.remove("is-drag");
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var target = el && el.closest ? el.closest("[data-wr-dayslot]") : null;
      if (!target) return;
      var to = Number(target.getAttribute("data-wr-dayslot"));
      if (to === d.from) return;
      var sl = state.daysEdit.slots;
      var tmp = sl[to];
      sl[to] = sl[d.from];
      sl[d.from] = tmp;
      paintDaysEditor();
    }
    card.addEventListener("pointerup", endDrag);
    card.addEventListener("pointercancel", function () {
      if (drag) { drag.ghost.remove(); drag.row.classList.remove("is-drag"); drag = null; }
    });
  }

  /* „Gespeichert“ für 2 Sekunden über dem Dialog, ohne ihn zu schließen */
  function showSavedNote() {
    var old = document.querySelector(".wr-saved");
    if (old) old.remove();
    var n = document.createElement("div");
    n.className = "wr-saved";
    n.setAttribute("role", "status");
    n.textContent = "Gespeichert";
    document.body.appendChild(n);
    requestAnimationFrame(function () { n.classList.add("is-on"); });
    setTimeout(function () { n.classList.remove("is-on"); }, 2000);
    setTimeout(function () { if (n.parentNode) n.remove(); }, 2400);
  }

  /* ---------- Tage bearbeiten → Media: Eventbild und Übungsvideos/-fotos ----------
     Eventbild: events.photo_url (Foto hochladen oder Link; YouTube → Vorschaubild).
     Übungen: go_exercise_links (Link von YouTube/Instagram/TikTok oder eigenes Foto), eigene gehen vor. */
  function mediaEvent() {
    var id = state.media && state.media.id;
    return id ? findOwnEvent(id) : null;
  }
  function openMediaSheet(eventId) {
    state.media = { id: eventId, names: null };
    paintMediaSheet();
    var ev = mediaEvent();
    var job = ev && host.exercisesForEvent ? host.exercisesForEvent(ev) : Promise.resolve([]);
    var lib = global.GoExMedia && GoExMedia.ready ? GoExMedia.ready() : null;
    Promise.all([job, lib]).then(function (r) {
      if (!state.media || state.media.id !== eventId) return;
      state.media.names = r[0] || [];
      paintMediaSheet();
    }).catch(function () {
      if (state.media) { state.media.names = []; paintMediaSheet(); }
    });
  }
  function paintMediaSheet() {
    var ev = mediaEvent();
    if (!ev) return;
    if (state.media.edit) { paintMediaEditor(); return; }
    var M = global.GoExMedia;
    var photo = ev.photo_url || "";
    var names = state.media.names;
    var exHtml;
    if (names === null) exHtml = '<p class="wr-sheet-hint">Übungen werden geladen …</p>';
    else if (!names.length) {
      exHtml = '<p class="wr-sheet-hint">' + (ev.category === "zirkel"
        ? "Beim Zirkel wählst Du die Stationen im Workout."
        : "Für diese Einheit sind keine Übungen hinterlegt.") + "</p>";
    } else {
      /* Je Übung: Name, rechts Foto-Vorschau und Video-Vorschau, dann Stift (Bearbeiten) */
      exHtml = names.map(function (n) {
        var myImg = M && M.mineOf ? M.mineOf(n, "img") : null;
        var myVid = M && M.mineOf ? M.mineOf(n, "video") : null;
        var vidUrl = myVid ? myVid.url : (M ? M.urlFor(n) : "");
        var vid = vidUrl && M ? M.parse(vidUrl) : null;
        if (vid && vid.kind === "img") vid = null;
        var tile = function (kind, url, thumb, label) {
          return url
            ? '<button type="button" class="wr-mex__thumb" data-wr-media-open="' + esc(url) + '" aria-label="' + label + ' ansehen">' +
              (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy" />' : "") +
              (kind === "video" ? '<span class="wr-mex__play">' + (M ? M.playIcon : "") + "</span>" : "") + "</button>"
            : '<button type="button" class="wr-mex__thumb is-empty" data-wr-media-edit="1">' + label + "</button>";
        };
        return '<div class="wr-mex" data-wr-mex="' + esc(n) + '">' +
          '<span class="wr-mex__name">' + esc(n) + "</span>" +
          tile("img", myImg ? myImg.url : "", myImg ? myImg.url : "", "Foto") +
          tile("video", vid ? vid.url : "", vid ? vid.thumb : "", "Link") +
          '<button type="button" class="wr-mex__pen" data-wr-media-edit="1" aria-label="Bearbeiten">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg></button>' +
          "</div>";
      }).join("");
    }
    /* Name als Überschrift; Eventbild gilt nur für mich (alle gleichen Events), Übungen global (mit Freigabe) */
    var cover = !photo && global.GoCovers ? GoCovers.url(ev.course_id, ev.category || "kraft", ev.enrollment_id) : "";
    openSheet(
      '<p class="wr-sheet-title">' + esc(ev.title || "Training") + "</p>" +
      '<div class="wr-share-block">' +
      '<div class="wr-media-prev">' + (photo || cover ? '<img src="' + esc(photo || cover) + '" alt="" />' : "<span>Standard-Foto</span>") + "</div>" +
      '<div class="wr-media-acts">' +
      '<label class="wr-dayrow__vis' + (photo ? " is-on" : "") + '">Eigenes Foto<input type="file" accept="image/*" data-wr-media-file="event" hidden /></label>' +
      '<button type="button" class="wr-dayrow__vis' + (photo ? "" : " is-on") + '" data-wr-media-del="event">Standard-Foto</button>' +
      "</div></div>" +
      '<div class="wr-share-block"><h4>Übungen</h4>' +
      exHtml + "</div>" +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-media-back="1">Zurück</button></div>'
    );
  }
  /* Übung bearbeiten: links Foto (antippen = wählen), rechts Video-Link; Speichern ersetzt die eigenen Einträge */
  function paintMediaEditor() {
    var ed = state.media.edit;
    var M = global.GoExMedia;
    var vid = ed.link && M ? M.parse(ed.link) : null;
    openSheet(
      '<p class="wr-sheet-title">' + esc(ed.name) + "</p>" +
      '<div class="wr-mex-ed">' +
      '<label class="wr-mex-ed__tile">' +
      (ed.photo ? '<img src="' + esc(ed.photo) + '" alt="" />' : "<span>Foto</span>") +
      '<input type="file" accept="image/*" data-wr-media-file="exedit" hidden /></label>' +
      '<div class="wr-mex-ed__tile wr-mex-ed__tile--link">' +
      (vid && vid.thumb ? '<img src="' + esc(vid.thumb) + '" alt="" />' : "") +
      '<input type="url" inputmode="url" placeholder="Video-Link" value="' + esc(ed.link || "") + '" data-wr-media-linkin="1" /></div>' +
      "</div>" +
      (ed.photo || ed.origLink ? '<button type="button" class="wr-mex-ed__clear" data-wr-media-clear="1">Eigene Einträge entfernen</button>' : "") +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-media-edcancel="1">Abbrechen</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-media-edsave="1">Speichern</button></div>'
    );
  }
  function openMediaEditor(name) {
    var M = global.GoExMedia;
    var img = M && M.mineOf ? M.mineOf(name, "img") : null;
    var vid = M && M.mineOf ? M.mineOf(name, "video") : null;
    state.media.edit = {
      name: name, photo: img ? img.url : "", file: null, origImg: img, origVid: vid,
      link: vid ? vid.url : "", origLink: vid ? vid.url : ""
    };
    paintMediaSheet();
  }
  function saveMediaEditor() {
    var ed = state.media && state.media.edit;
    var M = global.GoExMedia;
    if (!ed || !M) return;
    var inp = document.querySelector("[data-wr-media-linkin]");
    var link = String(inp ? inp.value : ed.link || "").trim();
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
    var linkChanged = link !== (ed.origLink || "");
    if (link && linkChanged) {
      var info = M.parse(link);
      if (!info || info.kind === "img") { if (host.toast) host.toast("Bitte einen Video-Link (YouTube, Instagram, TikTok)"); return; }
    }
    var jobs = [];
    var done = [];
    function del(row) {
      return row ? rest("go_exercise_links?id=eq." + encodeURIComponent(row.id) + "&added_by=eq." + encodeURIComponent(me()), {
        method: "DELETE", prefer: "return=minimal"
      }).catch(function () {}) : Promise.resolve();
    }
    function add(url) {
      return rest("go_exercise_links", { method: "POST", prefer: "return=minimal",
        body: { name_key: M.key(ed.name), name: ed.name, url: url, added_by: me() } });
    }
    if (ed.file) {
      jobs.push(M.uploadImage(ed.file, "exercises").then(function (url) {
        return del(ed.origImg).then(function () { return add(url); });
      }).then(function () { done.push("Foto"); }));
    } else if (!ed.photo && ed.origImg) {
      jobs.push(del(ed.origImg));
    }
    if (linkChanged) {
      jobs.push(del(ed.origVid).then(function () { return link ? add(link).then(function () { done.push("Video-Link"); }) : null; }));
    }
    var btn = document.querySelector("[data-wr-media-edsave]");
    if (btn) btn.disabled = true;
    Promise.all(jobs).then(function () { return M.reload(); }).then(function () {
      state.media.edit = null;
      paintMediaSheet();
      var msg = done.length === 2 ? "Foto und Video-Link gespeichert" : done.length ? done[0] + " gespeichert" : "Gespeichert";
      /* go-exercise-media-review.sql: für mich sofort, für alle nach Freigabe im Admin */
      if (global.GoDialog) GoDialog.alert(msg, done.length ? { body: "Du siehst es ab jetzt bei der Übung. Für alle anderen erscheint es nach der Freigabe." } : {});
      else if (host.toast) host.toast(msg);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      var m = String((err && err.message) || "");
      if (host.toast) host.toast(/duplicate|23505/.test(m) ? "Diesen Link gibt es bei der Übung schon" : m || "Speichern ging gerade nicht");
    });
  }

  /* Eigenes Foto gilt für alle gleichen eigenen Events (gleicher Titel), die noch geplant sind; erledigte behalten ihr Foto */
  function saveEventPhoto(url) {
    var ev = mediaEvent();
    if (!ev) return Promise.resolve();
    if (!url && !ev.photo_url) { paintMediaSheet(); return Promise.resolve(); }
    var body = { photo_url: url || null };
    var series = rest("events?user_id=eq." + encodeURIComponent(me()) + "&title=eq." + encodeURIComponent(ev.title || "") +
      "&status=eq.geplant&starts_at=gte." + encodeURIComponent(berlinToday() + "T00:00:00+01:00"), {
      method: "PATCH", prefer: "return=minimal", body: body
    });
    var one = rest("events?id=eq." + encodeURIComponent(ev.id) + "&user_id=eq." + encodeURIComponent(me()), {
      method: "PATCH", prefer: "return=minimal", body: body
    });
    return Promise.all([series, one]).then(function () {
      (state.events || []).forEach(function (e) {
        if (String(e.user_id) === me() && e.title === ev.title && (e.status === "geplant" || e.id === ev.id)) e.photo_url = url || null;
      });
      ev.photo_url = url || null;
      state.mediaDirty = true;
      paintMediaSheet();
      if (host.toast) host.toast(url ? "Eigenes Foto für alle „" + (ev.title || "Training") + "“" : "Standard-Foto für alle „" + (ev.title || "Training") + "“");
      notifyAktuell();
    }).catch(function () { if (host.toast) host.toast("Speichern ging gerade nicht"); });
  }
  function saveExerciseMedia(name, url) {
    var M = global.GoExMedia;
    if (!M || !name || !url) return Promise.resolve();
    return rest("go_exercise_links", {
      method: "POST", prefer: "return=minimal",
      body: { name_key: M.key(name), name: name, url: url, added_by: me() }
    }).then(function () { return M.reload(); }).then(function () {
      paintMediaSheet();
      if (host.toast) host.toast("Gespeichert bei " + name);
    }).catch(function (err) {
      var m = String((err && err.message) || "");
      if (host.toast) host.toast(/duplicate|23505/.test(m) ? "Diesen Link gibt es bei der Übung schon" : /go_exercise_links|relation/.test(m) ? "Tabelle fehlt: go-exercise-links.sql ausführen" : "Speichern ging gerade nicht");
    });
  }
  /* Link für das Eventbild: Bild-URL direkt, YouTube → Vorschaubild. Instagram/TikTok liefern kein Bild ohne Login. */
  function eventImageFromLink(url) {
    var M = global.GoExMedia;
    var info = M ? M.parse(url) : null;
    if (!info) return "";
    if (info.kind === "img") return info.url;
    if (info.thumb) return info.thumb;
    return "";
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-wr-media-back],[data-wr-media-link],[data-wr-media-del],[data-wr-media-play],[data-wr-media-exdel],[data-wr-media-edit],[data-wr-media-open],[data-wr-media-edsave],[data-wr-media-edcancel],[data-wr-media-clear]") : null;
    if (!t || !state.media) return;
    if (t.hasAttribute("data-wr-media-edit")) {
      var rowE = t.closest("[data-wr-mex]");
      if (rowE) { var nm = rowE.getAttribute("data-wr-mex"); setTimeout(function () { openMediaEditor(nm); }, 0); }
      return;
    }
    if (t.hasAttribute("data-wr-media-open")) {
      var rowO = t.closest("[data-wr-mex]");
      if (global.GoExMedia) GoExMedia.open(rowO ? rowO.getAttribute("data-wr-mex") : "", t.getAttribute("data-wr-media-open"));
      return;
    }
    if (t.hasAttribute("data-wr-media-edsave")) { saveMediaEditor(); return; }
    if (t.hasAttribute("data-wr-media-edcancel")) {
      setTimeout(function () { if (state.media) { state.media.edit = null; paintMediaSheet(); } }, 0);
      return;
    }
    if (t.hasAttribute("data-wr-media-clear")) {
      var edc = state.media.edit;
      if (edc) {
        var li = document.querySelector("[data-wr-media-linkin]");
        if (li) li.value = "";
        edc.link = ""; edc.photo = ""; edc.file = null;
        setTimeout(paintMediaSheet, 0);
      }
      return;
    }
    if (t.hasAttribute("data-wr-media-back")) {
      var dirty = state.mediaDirty;
      state.media = null;
      state.mediaDirty = false;
      /* erst nach dem Klick neu zeichnen: andere Klick-Handler sehen sonst ein gelöstes Ziel und schließen das Sheet */
      /* Neuladen baut die Woche samt Sheet neu: danach Tage bearbeiten wieder zeigen */
      setTimeout(function () {
        var reopen = function () { if (state.daysEdit) paintDaysEditor(); else closeSheet(); };
        if (dirty) refreshKeepDay(currentDayIso()).then(reopen, reopen);
        else reopen();
      }, 0);
      return;
    }
    if (t.hasAttribute("data-wr-media-play")) {
      if (global.GoExMedia) GoExMedia.open(t.getAttribute("data-wr-media-play"));
      return;
    }
    if (t.hasAttribute("data-wr-media-del")) {
      saveEventPhoto(null);
      return;
    }
    if (t.hasAttribute("data-wr-media-exdel")) {
      rest("go_exercise_links?id=eq." + encodeURIComponent(t.getAttribute("data-wr-media-exdel")) + "&added_by=eq." + encodeURIComponent(me()), {
        method: "DELETE", prefer: "return=minimal"
      }).then(function () { return global.GoExMedia ? GoExMedia.reload() : null; })
        .then(function () { paintMediaSheet(); })
        .catch(function () { if (host.toast) host.toast("Entfernen ging gerade nicht"); });
      return;
    }
    var kind = t.getAttribute("data-wr-media-link");
    var row = t.closest("[data-wr-mex]");
    var exName = row ? row.getAttribute("data-wr-mex") : "";
    if (!global.GoDialog) return;
    GoDialog.prompt(kind === "event" ? "Link zum Bild oder YouTube-Video" : "Link zum Video für " + exName, "", { ok: "Speichern" }).then(function (v) {
      var url = String(v || "").trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) { if (host.toast) host.toast("Bitte einen Link mit https:// einfügen"); return; }
      if (kind === "event") {
        var img = eventImageFromLink(url);
        if (!img) { if (host.toast) host.toast("Instagram und TikTok geben kein Bild frei. Bitte Foto hochladen"); return; }
        saveEventPhoto(img);
      } else saveExerciseMedia(exName, url);
    });
  });
  document.addEventListener("change", function (e) {
    var inp = e.target;
    if (!inp || !inp.getAttribute || !inp.hasAttribute("data-wr-media-file") || !state.media) return;
    var file = inp.files && inp.files[0];
    if (!file || !global.GoExMedia || !GoExMedia.uploadImage) return;
    var kind = inp.getAttribute("data-wr-media-file");
    if (kind === "exedit") {
      var edf = state.media.edit;
      if (!edf) return;
      var li2 = document.querySelector("[data-wr-media-linkin]");
      if (li2) edf.link = li2.value;
      edf.file = file;
      edf.photo = URL.createObjectURL(file);
      paintMediaSheet();
      return;
    }
    var row = inp.closest("[data-wr-mex]");
    var exName = row ? row.getAttribute("data-wr-mex") : "";
    if (host.toast) host.toast("Lade Foto hoch …");
    GoExMedia.uploadImage(file, kind === "event" ? "events" : "exercises").then(function (url) {
      return kind === "event" ? saveEventPhoto(url) : saveExerciseMedia(exName, url);
    }).catch(function (err) {
      if (host.toast) host.toast((err && err.message) || "Upload ging gerade nicht");
    });
  });

  /* Sichtbarkeit je Event: privat (nur ich), Gruppe (meine Gruppe), Circle (nur im Circle der Zirkel-App),
     Bubble (nur meine Bubble), Team (alle Freunde). go-visibility-fein.sql */
  var VIS_LABEL = { privat: "privat", coach: "Coach", gruppe: "Gruppe", circle: "Circle", bubble: "Bubble", team: "Team" };
  /* Wörter wie im Aktuell-Filter */
  function visPickLabel(v) {
    if (v === "privat") return "Nur Ich";
    if (v === "coach") return "Nur Coach";
    if (v === "team") return "Community";
    if (v === "bubble") return "Meine Bubble";
    if (v === "gruppe") {
      var g = host.myGroups ? (host.myGroups() || [])[0] : null;
      return g && g.name ? "Gruppe " + g.name : "Gruppe";
    }
    if (v === "circle") return "Circle";
    return VIS_LABEL[v] || v;
  }
  function visCycle() {
    var out = ["privat"];
    /* mit Coach: Event nur für mich und meinen Coach (go-visibility-coach.sql) */
    if (host.sessionAccount && host.sessionAccount.trainer_id) out.push("coach");
    if (host.myGroups && (host.myGroups() || []).length) out.push("gruppe");
    if (ffcOk() && FFC.groups) out.push("circle");
    if (host.bubbleId && host.bubbleId()) out.push("bubble");
    out.push("team");
    return out;
  }

  /* Die Woche gilt global: Tag, Uhrzeit, Sichtbarkeit und Bubble einer Plan-Einheit gelten für alle
     kommenden Wochen desselben Plans (gleiche Einheit am gleichen Wochentag), bis man es wieder ändert. */
  function loadFutureSeries(de) {
    var enr = {};
    de.slots.forEach(function (ev) { if (ev && ev.enrollment_id) enr[ev.enrollment_id] = 1; });
    var ids = Object.keys(enr);
    if (!ids.length || !me()) return Promise.resolve([]);
    var after = addDays(de.days[de.days.length - 1], 1);
    return rest("events?user_id=eq." + encodeURIComponent(me()) + "&enrollment_id=in.(" + ids.join(",") + ")" +
      "&status=eq.geplant&starts_at=gte." + after + "T00:00:00Z&select=id,title,starts_at,enrollment_id,visibility,bubble_id,group_id&limit=1000")
      .catch(function () { return []; });
  }
  function weekdayOf(iso) { return new Date(iso + "T12:00:00").getDay(); }
  function seriesJobs(future, ev, iso, untimed, hhmm, body) {
    if (!ev.enrollment_id || !future.length) return [];
    var fromWd = weekdayOf(dayKey(ev.starts_at));
    /* Montag ist Wochenanfang: Sonntag → Montag heißt 6 Tage zurück */
    var shift = ((weekdayOf(iso) + 6) % 7) - ((fromWd + 6) % 7);
    var out = [];
    future.forEach(function (f) {
      if (String(f.enrollment_id) !== String(ev.enrollment_id) || String(f.title || "") !== String(ev.title || "")) return;
      if (weekdayOf(dayKey(f.starts_at)) !== fromWd || String(f.id) === String(ev.id)) return;
      var d = addDays(dayKey(f.starts_at), shift);
      var want = untimed ? d + "T12:00:00Z" : timedStarts(d, hhmm);
      var b = {};
      if (new Date(want).getTime() !== new Date(f.starts_at).getTime()) b.starts_at = want;
      Object.keys(body).forEach(function (k) {
        if (String(f[k] == null ? "" : f[k]) !== String(body[k] == null ? "" : body[k])) b[k] = body[k];
      });
      if (!Object.keys(b).length) return;
      out.push(rest("events?id=eq." + encodeURIComponent(f.id), { method: "PATCH", prefer: "return=minimal", body: b }));
    });
    return out;
  }

  function saveDaysEditor() {
    var de = state.daysEdit;
    if (!de) return;
    var saveBtn0 = document.querySelector("[data-wr-days-save]");
    if (saveBtn0) saveBtn0.disabled = true;
    loadFutureSeries(de).then(function (future) { saveDaysEditorWith(de, future || []); });
  }
  function saveDaysEditorWith(de, future) {
    var jobs = [];
    de.slots.forEach(function (ev, i) {
      if (!ev) return;
      var iso = de.days[i];
      var pick = de.times[ev.id];
      var untimed = pick === NO_TIME;
      var hhmm = untimed ? "" : (pick || formatTime(ev.starts_at) || "18:00");
      var starts = untimed ? iso + "T12:00:00Z" : timedStarts(iso, hhmm);
      var vis = de.vis[ev.id] || "team";
      var sameDay = dayKey(ev.starts_at) === iso &&
        (untimed ? !displayTime(ev.starts_at) : (displayTime(ev.starts_at) && formatTime(ev.starts_at) === hhmm));
      var wantBub = !!(de.bub && de.bub[ev.id]) || vis === "bubble";
      var bubId = host.bubbleId ? host.bubbleId() : "";
      var bubChanged = wantBub !== !!ev.bubble_id && (!!bubId || !wantBub);
      var grp = vis === "gruppe" && host.myGroups ? (host.myGroups() || [])[0] : null;
      /* auch wenn diese Woche schon passt: kommende Wochen angleichen (Tag, Uhrzeit, Sichtbarkeit, Bubble).
         Circle teilt einzelne Termine in der Zirkel-App, deshalb nicht für die Serie. */
      if (vis !== "circle") {
        var serBody = { visibility: vis, bubble_id: wantBub && bubId ? bubId : wantBub ? ev.bubble_id || null : null };
        if (grp) serBody.group_id = grp.id;
        jobs = jobs.concat(seriesJobs(future, ev, iso, untimed, hhmm, serBody));
      }
      if (sameDay && (ev.visibility || "team") === vis && !bubChanged && !(grp && String(ev.group_id || "") !== String(grp.id))) return;
      var body = { starts_at: starts, visibility: vis };
      /* neue Uhrzeit → Herz-Meldung für Freunde (go-events-time-set.sql) */
      if (!untimed && !(displayTime(ev.starts_at) && formatTime(ev.starts_at) === hhmm)) body.time_set_at = new Date().toISOString();
      /* Durch eine Alternative ersetzte Einheit auf einen anderen Tag gelegt: dort wieder geplant */
      if (ev.status === "ausgefallen" && dayKey(ev.starts_at) !== iso) body.status = "geplant";
      if (bubChanged) body.bubble_id = wantBub ? bubId : null;
      if (grp) body.group_id = grp.id;
      var toCircle = vis === "circle" && ev.visibility !== "circle";
      jobs.push(materializeEvent(ev).then(function (real) {
        return rest("events?id=eq." + encodeURIComponent(real.id), {
          method: "PATCH", prefer: "return=minimal", body: body
        }).catch(function (err) {
          /* ohne go-visibility-fein.sql kennt die Datenbank Circle/Bubble noch nicht */
          if (vis === "coach") throw new Error("go-visibility-coach.sql fehlt");
          if (vis === "circle" || vis === "bubble") throw new Error("go-visibility-fein.sql fehlt");
          throw err;
        }).then(function () {
          /* Circle: Termin im Circle der Zirkel-App teilen (Auswahl, wenn mehrere) */
          if (toCircle) { ev.visibility = "circle"; ev.id = real.id; return shareToCircle(real.id); }
        });
      }));
    });
    var saveBtn = document.querySelector("[data-wr-days-save]");
    if (saveBtn) saveBtn.disabled = true;
    Promise.all(jobs).then(function () {
      if (global.GoTama) global.GoTama.invalidate();
      showSavedNote();
      return refresh().then(function () {
        notifyAktuell();
        /* Dialog bleibt offen und zeigt den gespeicherten Stand */
        if (state.daysEdit && document.querySelector(".wr-sheet__card--days")) openDaysEditor();
      });
    }).catch(function (err) {
      if (saveBtn) saveBtn.disabled = false;
      var m = String((err && err.message) || "");
      if (host.toast) host.toast(/sql/.test(m) ? "Speichern ging nicht: " + m : "Speichern ging nicht");
    });
  }

  /* Ein Dialog für alles, was Freunde für eine Einladung wissen müssen */
  function openEventSettings(eventId) {
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    if (ev.status === "erledigt") return lockedToast();
    var hhmm = formatTime(ev.starts_at) || "18:00";
    var vis = ev.visibility === "privat" ? "privat" : "team";
    openSheet(
      '<p class="wr-sheet-title">' + esc(ev.title || "Training") + "</p>" +
        '<p class="wr-sheet-hint">Leg den Ort, die Uhrzeit und die Privatsphäre fest.</p>' +
        '<div class="wr-set-vis" role="radiogroup" aria-label="Privatsphäre">' +
        '<button type="button" class="wr-set-vis__btn' + (vis === "team" ? " is-on" : "") + '" data-wr-set-vis="team" role="radio" aria-checked="' + (vis === "team") + '">Zeigen</button>' +
        '<button type="button" class="wr-set-vis__btn' + (vis === "privat" ? " is-on" : "") + '" data-wr-set-vis="privat" role="radio" aria-checked="' + (vis === "privat") + '">Privat</button>' +
        "</div>" +
        timeWheelHtml(hhmm) +
        '<div id="wr-set-place-picker"><label class="wr-field">Ort<input type="text" id="wr-set-place" maxlength="80" value="' +
        esc(ev.location || "") + '" /></label></div>' +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-set-save="' + esc(eventId) + '">Speichern</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
    mountPlacePicker("wr-set-place-picker", ev.location || "");
    var card = $("wr-sheet-card");
    if (card) card.setAttribute("data-vis", vis);
    if (card && !card._wrSetBound) {
      card._wrSetBound = true;
      card.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-wr-set-vis]");
        if (b) {
          card.setAttribute("data-vis", b.getAttribute("data-wr-set-vis"));
          card.querySelectorAll("[data-wr-set-vis]").forEach(function (x) {
            var on = x === b;
            x.classList.toggle("is-on", on);
            x.setAttribute("aria-checked", on ? "true" : "false");
          });
          return;
        }
        var sv = e.target.closest && e.target.closest("[data-wr-set-save]");
        if (sv) saveEventSettings(sv.getAttribute("data-wr-set-save"));
      });
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        scrollTimeColsToSelection();
        bindTimeWheelScroll();
        syncTimeWheelFromScroll();
      });
    });
  }

  function saveEventSettings(eventId) {
    syncTimeWheelFromScroll();
    var wheel = $("wr-time-wheel");
    var h = wheel ? Number(wheel.getAttribute("data-h") || 18) : 18;
    var m = wheel ? Number(wheel.getAttribute("data-m") || 0) : 0;
    var place = pickedPlaceName("wr-set-place");
    rememberPickedPlace();
    var card = $("wr-sheet-card");
    var vis = (card && card.getAttribute("data-vis")) || "team";
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    var iso = dayKey(ev.starts_at);
    var starts = iso + "T" + pad2(h) + ":" + pad2(m) + ":00" + berlinOffsetSuffix(iso);
    if (isNaN(new Date(starts).getTime())) return;
    return materializeEvent(ev)
      .then(function (real) {
        eventId = real.id;
        return rest("events?id=eq." + encodeURIComponent(eventId), {
          method: "PATCH",
          prefer: "return=minimal",
          body: { starts_at: starts, location: place || null, visibility: vis }
        });
      })
      .then(function () {
        closeSheet();
        return refreshKeepDay(iso);
      })
      .then(function () { return notifyAktuell(); })
      .catch(function () {
        if (host.toast) host.toast("Speichern ging nicht");
      });
  }

  function openPlaceSheet(eventId) {
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    if (ev.status === "erledigt") return lockedToast();
    openSheet(
      '<p class="wr-sheet-hint">Ort</p>' +
        '<div id="wr-edit-place-picker"><label class="wr-field">Ort<input type="text" id="wr-edit-place" maxlength="80" value="' +
        esc(ev.location || "") +
        '" /></label></div>' +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-place-save="' +
        esc(eventId) +
        '">Speichern</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );    mountPlacePicker("wr-edit-place-picker", ev.location || "");
  }

  function saveEventPlace(eventId) {
    var val = pickedPlaceName("wr-edit-place");
    rememberPickedPlace();
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    return materializeEvent(ev)
      .then(function (real) {
        ev = real;
        eventId = real.id;
        return rest("events?id=eq." + encodeURIComponent(eventId), {
          method: "PATCH",
          prefer: "return=minimal",
          body: { location: val || null }
        });
      })
      .then(function () {
        ev.location = val || null;
        closeSheet();
        return refreshKeepDay(dayKey(ev.starts_at));
      })
      .catch(function () {
        if (host.toast) host.toast("Ort konnte nicht gespeichert werden");
      });
  }

  /* Event auf einen anderen Tag derselben Woche schieben (Uhrzeit bleibt).
     Liegt dort schon etwas, stehen beide Events am Tag (wischen). */
  function openDaySheet(eventId) {
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    if (ev.status === "erledigt") return lockedToast();
    var iso = dayKey(ev.starts_at);
    var d = new Date(iso + "T12:00:00Z");
    var mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    var names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    var today = berlinToday();
    var btns = names.map(function (n, i) {
      var x = new Date(mon);
      x.setUTCDate(mon.getUTCDate() + i);
      var di = x.toISOString().slice(0, 10);
      var past = di < today;
      return (
        '<button type="button" class="wr-pill-btn' + (di === iso ? " wr-pill-btn--dark" : "") + '"' +
        (past || di === iso ? " disabled" : "") +
        ' data-wr-day-move="' + esc(ev.id) + '" data-day="' + di + '">' +
        n + " " + x.getUTCDate() + "." + "</button>"
      );
    }).join("");
    openSheet(
      "<h3>Verschieben</h3>" +
        '<p class="wr-sheet-hint">Auf welchen Tag? Die Uhrzeit bleibt.</p>' +
        '<div class="wr-day-grid">' + btns + "</div>" +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
  }

  function moveEventToDay(eventId, iso) {
    var ev = findOwnEvent(eventId);
    if (!ev || !iso) return;
    var hhmm = formatTime(ev.starts_at);
    var starts = iso + "T" + hhmm + ":00" + berlinOffsetSuffix(iso);
    return materializeEvent(ev)
      .then(function (real) {
        return rest("events?id=eq." + encodeURIComponent(real.id), {
          method: "PATCH",
          prefer: "return=minimal",
          body: { starts_at: starts }
        });
      })
      .then(function (r) {
        if (global.GoTama) global.GoTama.invalidate();
        return r;
      })
      .then(function () {
        closeSheet();
        if (host.toast) host.toast("Verschoben");
        return refreshKeepDay(iso);
      })
      .then(function () {
        return notifyAktuell();
      })
      .catch(function () {
        if (host.toast) host.toast("Verschieben hat nicht geklappt");
      });
  }

  function saveEventTime(eventId) {
    syncTimeWheelFromScroll();
    var wheel = $("wr-time-wheel");
    var h = wheel ? Number(wheel.getAttribute("data-h") || 18) : 18;
    var m = wheel ? Number(wheel.getAttribute("data-m") || 0) : 0;
    var val = pad2(h) + ":" + pad2(m);
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    /* Nur solange nicht erledigt und Tag nicht vorbei */
    if (!eventTimeEditable(ev)) {
      if (host.toast) host.toast("Vergangene Events können nicht mehr verschoben werden");
      closeSheet();
      return;
    }
    var iso = dayKey(ev.starts_at);
    var starts = timedStarts(iso, val);
    if (isNaN(new Date(starts).getTime())) return;
    return materializeEvent(ev)
      .then(function (real) {
        ev = real;
        eventId = real.id;
        return rest("events?id=eq." + encodeURIComponent(eventId), {
          method: "PATCH",
          prefer: "return=representation",
          body: { starts_at: starts }
        });
      })
      .then(function (rows) {
        var updated = Array.isArray(rows) ? rows[0] : rows;
        if (updated && updated.starts_at) {
          state.events = state.events.map(function (e) {
            return String(e.id) === String(eventId) ? Object.assign({}, e, updated) : e;
          });
        } else {
          ev.starts_at = starts;
        }
        closeSheet();
        return refreshKeepDay(iso);
      })
      .then(function () {
        return notifyAktuell();
      })
      .catch(function () {
        if (host.toast) host.toast("Zeit konnte nicht gespeichert werden");
      });
  }

  function render() {
    var root = $(ROOT_ID);
    if (!root) return;
    var days;
    try {
      days = weekDays();
    } catch (eDays) {
      days = [];
      state.loadError = state.loadError || "Wochenkalender fehlerhaft.";
    }
    while (days.length < 7) {
      days.push(addDays(berlinToday(), days.length));
    }
    if (state.dayIndex < 0) state.dayIndex = 0;
    if (state.dayIndex > 6) state.dayIndex = 6;
    root.hidden = false;
    root.classList.toggle("is-edit", !!state.editMode);
    var nextHtml =
      headerHtml() +
      editPanelHtml() +
      '<div class="wr-vtrack" id="wr-vtrack">' +
      days
        .map(function (iso, ix) {
          var inner;
          try {
            inner = dayReelHtml(iso);
          } catch (eDay) {
            inner = emptyCardHtml(iso);
          }
          return '<div class="wr-dwrap" data-day-ix="' + ix + '">' + inner + "</div>";
        })
        .reverse()
        .join("") +
      "</div>" +
      daySquaresHtml(days) +
      progressHtml() +
      sheetHtml();
    /* Gleicher Inhalt wie zuletzt: DOM stehen lassen (sonst blitzt die Woche beim Öffnen,
       weil show() sofort zeichnet und refresh() danach mit denselben Daten noch einmal) */
    if (root.__wrHtml === nextHtml && root.firstChild && !($("wr-sheet") && !$("wr-sheet").hidden)) {
      var trackSame = $("wr-vtrack");
      if (trackSame && trackSame.clientHeight && ixFromScroll(trackSame) !== state.dayIndex) {
        trackSame.scrollTop = scrollTopFor(trackSame, state.dayIndex);
      }
      patchDaySquares();
      requestAnimationFrame(alignAndSync);
      return;
    }
    /* Offenes Sheet (Tage bearbeiten, Media …) über den Neuaufbau retten, sonst ist es weg
       und body.wr-sheet-open blendet die Pill weiter aus */
    var oldSheet = $("wr-sheet");
    var keepSheet = oldSheet && !oldSheet.hidden ? oldSheet : null;
    if (keepSheet) keepSheet.remove();
    root.innerHTML = nextHtml;
    root.__wrHtml = nextHtml;
    if (keepSheet) {
      var freshSheet = $("wr-sheet");
      if (freshSheet) freshSheet.replaceWith(keepSheet);
    } else {
      document.body.classList.remove("wr-sheet-open");
    }
    if (state.lastDeleted) showUndoBar();
    var track = $("wr-vtrack");
    if (track && track.clientHeight) {
      track.scrollTop = scrollTopFor(track, state.dayIndex);
    }
    requestAnimationFrame(alignAndSync);
  }

  function sheetHtml() {
    return (
      '<div class="wr-sheet" id="wr-sheet" hidden>' +
      '<div class="wr-sheet__card" id="wr-sheet-card"></div></div>'
    );
  }

  function openSheet(html) {
    var sheet = $("wr-sheet");
    var card = $("wr-sheet-card");
    if (!sheet || !card) return;
    card.innerHTML = html;
    sheet.hidden = false;
    card.scrollTop = 0;
    document.body.classList.add("wr-sheet-open");
  }

  function closeSheet() {
    var sheet = $("wr-sheet");
    /* abgebrochenes „+ Gruppen-Event“: nächstes normales Anlegen ist wieder privat/Team */
    state.groupExtraNext = null;
    if (sheet) sheet.hidden = true;
    document.body.classList.remove("wr-sheet-open");
  }

  function travelWheelHtml(selected) {
    selected = Math.max(1, Math.min(TRAVEL_MAX_DAYS, Number(selected) || 3));
    var opts = "";
    for (var d = 1; d <= TRAVEL_MAX_DAYS; d++) {
      opts +=
        '<button type="button" class="wr-time-opt' +
        (d === selected ? " is-on" : "") +
        '" data-wr-travel-pick="' +
        d +
        '">' +
        (d === 1 ? "1 Tag" : d + " Tage") +
        "</button>";
    }
    return (
      '<div class="wr-time-wheel wr-travel-wheel" id="wr-travel-wheel" data-days="' +
      selected +
      '">' +
      '<div class="wr-time-col" id="wr-travel-col">' +
      opts +
      "</div>" +
      '<div class="wr-time-fade wr-time-fade--top" aria-hidden="true"></div>' +
      '<div class="wr-time-fade wr-time-fade--bot" aria-hidden="true"></div>' +
      '<div class="wr-time-center" aria-hidden="true"></div>' +
      "</div>"
    );
  }

  function scrollTravelCol() {
    var col = $("wr-travel-col");
    if (!col) return;
    var on = col.querySelector(".wr-time-opt.is-on");
    if (on) {
      col.scrollTop = Math.max(0, on.offsetTop - col.clientHeight / 2 + on.clientHeight / 2);
    }
  }

  function openTravelSheet() {
    /* gogogo-Kalender Start/Ende — kein System-Dialog, kein Drehrad */
    closeSheet();
    if (host && typeof host.openTravelPlanModal === "function") {
      host.openTravelPlanModal();
      return;
    }
    openSheet(
      "<h3>Reise planen</h3>" +
        '<p class="wr-sheet-hint">Start und Ende wählen</p>' +
        '<label class="wr-field">Von<input type="date" id="wr-travel-start" /></label>' +
        '<label class="wr-field">Bis<input type="date" id="wr-travel-end" /></label>' +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-travel-range="1">Speichern</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
    var today = berlinToday();
    var s = $("wr-travel-start");
    var e = $("wr-travel-end");
    if (s) {
      s.value = today;
      s.min = today;
    }
    if (e) {
      e.value = addDays(today, 3);
      e.min = today;
    }
  }

  function applyTravelRange(startIso, endIso) {
    var start = String(startIso || berlinToday()).slice(0, 10);
    var end = String(endIso || "").slice(0, 10);
    if (!end || end < start) end = start;
    state.travelStart = start;
    snapshotPlanForTravel();
    /* setTravelUntil(end, start) — Host speichert beide Tage */
    saveTravelPref(end, start);
    closeSheet();
    if (host.toast) {
      host.toast("Reise geplant — bitte pro Trainingstag eine Alternative wählen");
    }
    return refreshKeepDay(berlinToday());
  }

  function openCreateTimeSheet() {
    var p = state.pendingCreate;
    if (!p) return;
    var isZ = p.kind === "zirkel";
    var placeHtml =
      '<div id="wr-create-place-picker"><label class="wr-field">Ort<input type="text" id="wr-create-place" maxlength="80" value="' +
      esc(p.place || "") +
      '" /></label></div>';
    openSheet(
      "<h3>" +
        esc(p.title || "Uhrzeit") +
        "</h3>" +
        '<p class="wr-sheet-hint">' + (isZ ? "Uhrzeit und Ort" : "Ort und Uhrzeit") + "</p>" +
        (isZ ? timeWheelHtml("18:00") + placeHtml : placeHtml + timeWheelHtml("18:00")) +
        (isZ
          ? '<label class="gz-online"><input type="checkbox" id="wr-z-online" /> Optional: online mitmachen</label>'
          : "") +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-create-confirm="1">Speichern</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
    mountPlacePicker("wr-create-place-picker", p.place || "");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        scrollTimeColsToSelection();
        bindTimeWheelScroll();
        syncTimeWheelFromScroll();
      });
    });
  }

  function confirmPendingCreate() {
    var p = state.pendingCreate;
    if (!p || !p.iso) return Promise.resolve();
    syncTimeWheelFromScroll();
    p.place = pickedPlaceName("wr-create-place") || p.place || "";
    var onlineEl = $("wr-z-online");
    if (onlineEl) p.zOnline = !!onlineEl.checked;
    rememberPickedPlace();
    var wheel = $("wr-time-wheel");
    var h = wheel ? Number(wheel.getAttribute("data-h") || 18) : 18;
    var m = wheel ? Number(wheel.getAttribute("data-m") || 0) : 0;
    var starts =
      p.iso +
      "T" +
      pad2(h) +
      ":" +
      pad2(m) +
      ":00" +
      berlinOffsetSuffix(p.iso);
    var keepIso = p.iso;
    var replaceId = p.replaceId || null;

    function finish() {
      state.pendingCreate = null;
      state.editMode = false;
      closeSheet();
      return refreshKeepDay(keepIso).then(function () {
        return notifyAktuell();
      });
    }

    function syncPlanAfterSave(body) {
      /* Reise-Alternativen und zusätzliche Gruppen-Events dürfen den Wochenplan nicht überschreiben */
      if (body && body.travel_auto) return Promise.resolve();
      if (p.groupExtra) return Promise.resolve();
      if (!host || !host.syncPlanDay || !p.iso) return Promise.resolve();
      return Promise.resolve(
        host.syncPlanDay(p.iso, {
          kind: body.category === "alternative" ? "alternative" : body.category || p.kind || "kraft",
          label: body.title || p.title || "",
          category: body.category || p.category || "kraft"
        })
      ).catch(function () {});
    }

    function saveOrReplace(body) {
      /* Coach: zusätzliches Gruppen-Event (für die Gruppe sichtbar, Mitglieder wählen es unter Gruppen-Events) */
      if (p.groupExtra && body) { body.visibility = "gruppe"; body.group_id = p.groupExtra; replaceId = null; }
      function after() {
        return syncPlanAfterSave(body).then(finish);
      }
      if (replaceId && isPlanPlaceholder(replaceId)) replaceId = null;
      if (replaceId) {
        var prev = state.events.filter(function (e) {
          return String(e.id) === String(replaceId);
        })[0];
        if (prev && body && body.travel_auto) rememberEventBeforeTravel(prev);
        return rest("events?id=eq." + encodeURIComponent(replaceId), {
          method: "PATCH",
          prefer: "return=minimal",
          body: body
        })
          .catch(function () {
            var bare = Object.assign({}, body);
            delete bare.item_type;
            delete bare.travel_auto;
            return rest("events?id=eq." + encodeURIComponent(replaceId), {
              method: "PATCH",
              prefer: "return=minimal",
              body: bare
            });
          })
          .then(after)
          .catch(function (err) {
            if (host.toast) host.toast("Speichern fehlgeschlagen");
            throw err;
          });
      }
      return createEvent(body).then(after);
    }

    var placeVal = p.place || null;

    if (p.kind === "alternative") {
      return saveOrReplace({
        category: "alternative",
        title: p.title || "Bewegung",
        starts_at: starts,
        location: placeVal,
        course_id: null,
        enrollment_id: null,
        is_unplanned: false,
        item_type: travelDayActive(p.iso) ? "hotel_workout" : "event",
        travel_auto: !!travelDayActive(p.iso),
        status: "geplant"
      });
    }

    if (p.kind === "zirkel") {
      var zNote = GoZirkelSetup.toNote(
        {
          workSec: p.zWork || 240,
          restSec: p.zPause != null ? p.zPause : 30,
          rounds: p.zRounds || 6,
          online: !!p.zOnline,
          mode: p.zMode,
          partnerId: p.zPartnerId || "",
          partnerName: p.zPartnerName || ""
        }
      );
      var zBody = {
        category: "zirkel",
        course_id: p.courseId || null,
        enrollment_id: p.enrollmentId || null,
        title: p.title || "Zirkeltraining",
        starts_at: starts,
        location: placeVal,
        note: zNote,
        is_unplanned: false,
        item_type: "course_session",
        travel_auto: false,
        status: "geplant"
      };
      function invitePartner() {
        if (!p.zPartnerId) return;
        var mine = (state.events || []).filter(function (e) {
          return e.category === "zirkel" && e.note === zNote && dayKey(e.starts_at) === keepIso;
        })[0];
        return rest("go_workout_invites", {
          method: "POST",
          prefer: "return=minimal",
          body: {
            from_id: me(),
            to_id: p.zPartnerId,
            workout_date: keepIso,
            workout_label: "Zirkeltraining Double",
            from_name: (host.sessionAccount && host.sessionAccount.name) || "gogogo",
            place: placeVal || "",
            meet_time: pad2(h) + ":" + pad2(m),
            status: "pending",
            event_id: replaceId ? String(replaceId) : mine ? String(mine.id) : null
          }
        }).catch(function () {});
      }
      if (p.courseId) return saveOrReplace(zBody).then(invitePartner);
      return ensureCourseByDef({
        slug: "training-zirkel",
        title: "Zirkeltraining",
        category: "zirkel",
        label: "Zirkeltraining"
      }).then(function (course) {
        if (!course || !course.id) {
          if (host.toast) host.toast("Zirkel-Kurs fehlt");
          return;
        }
        zBody.course_id = course.id;
        return saveOrReplace(zBody).then(invitePartner);
      });
    }

    return ensureCourseByDef({
      slug: p.slug,
      title: p.title,
      label: p.title,
      category: p.category || "kraft"
    }).then(function (course) {
      if (!course || !course.id) {
        if (host.toast) host.toast("Kurs konnte nicht verknüpft werden");
        return;
      }
      return saveOrReplace({
        category: p.category || "kraft",
        course_id: course.id,
        enrollment_id: null,
        title: p.title,
        starts_at: starts,
        location: placeVal,
        is_unplanned: false,
        item_type: "course_session",
        travel_auto: false,
        status: "geplant"
      });
    });
  }

  /* Zirkel: erst vorhandene Gruppen-Trainings an dem Tag zeigen (beitreten), dann eigenes erstellen */
  function zirkelGroupIds() {
    var ids = host && host.groupMemberIds ? host.groupMemberIds() || [] : [];
    return ids.map(String);
  }

  function openZirkelJoinSheet(iso) {
    openSheet("<h3>Zirkeltraining</h3><p>Lade…</p>");
    var gids = zirkelGroupIds().filter(function (id) { return id && id !== me(); });
    var q = gids.length
      ? rest(
          "events?category=eq.zirkel&status=eq.geplant&user_id=in.(" +
            gids.map(encodeURIComponent).join(",") +
            ")&starts_at=gte." + encodeURIComponent(iso + "T00:00:00+01:00") +
            "&starts_at=lt." + encodeURIComponent(addDays(iso, 1) + "T00:00:00+01:00") +
            "&select=id,user_id,title,starts_at,location,note,visibility&order=starts_at.asc"
        ).catch(function () { return []; })
      : Promise.resolve([]);
    q.then(function (rows) {
      rows = (rows || []).filter(function (r) { return r && r.visibility !== "privat"; });
      return ensurePeople(rows.map(function (r) { return r.user_id; })).then(function () { return rows; });
    }).then(function (rows) {
      state.zJoinRows = rows;
      var list = rows.length
        ? rows.map(function (r) {
            var z = parseZirkelNote(r.note);
            var bits = [formatTime(r.starts_at), r.location || "", z ? zirkelLabel(z) : "", z && z.online ? "online möglich" : ""].filter(Boolean);
            return (
              '<div class="wr-zjoin">' +
              '<p class="wr-zjoin__who">Erstellt von ' + esc(personOf(r.user_id).name) + "</p>" +
              '<p class="wr-zjoin__title">' + esc(r.title || "Zirkeltraining") + "</p>" +
              '<p class="wr-zjoin__meta">' + esc(bits.join(" · ")) + "</p>" +
              '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-zjoin="' + esc(r.id) + '">Mitmachen</button>' +
              '<label class="wr-zjoin__weekly"><input type="checkbox" data-wr-zjoin-weekly="' + esc(r.id) + '" checked /> jede Woche</label>' +
              "</div>"
            );
          }).join("")
        : '<p class="wr-zjoin__none">Keins</p>';
      openSheet(
        "<h3>Zirkeltraining</h3>" +
          '<p class="wr-sheet-hint">An diesem Tag in der Gruppe</p>' +
          list +
          '<button type="button" class="wr-pill-btn wr-zjoin__own" data-wr-zown="1">Eigenes Training erstellen</button>' +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
    });
  }

  function openZirkelOwnSheet() {
    loadFriends().then(function () {
      var friends = (state.friends || []).map(function (fid) {
        return personOf(fid);
      });
      openSheet(
        "<h3>Zirkeltraining</h3>" +
          GoZirkelSetup.html({ mode: "single" }, { friends: friends }) +
          '<button type="button" class="wr-pill-btn wr-pill-btn--dark gz-next" data-wr-zirkel-next="1">Weiter</button>' +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
      requestAnimationFrame(function () {
        GoZirkelSetup.bind(document.querySelector(".wr-sheet"));
      });
    });
  }

  /* Beitreten: Zusage zum Event; "jede Woche" sagt auch den folgenden Terminen derselben Person
     am selben Wochentag zur selben Uhrzeit zu. Eigenes geplantes Event an dem Tag wird ersetzt. */
  function joinZirkel(eventId, weekly) {
    var row = (state.zJoinRows || []).filter(function (r) { return String(r.id) === String(eventId); })[0];
    if (!row) return;
    var p = state.pendingCreate || {};
    var replaceId = p.replaceId && !isPlanPlaceholder(p.replaceId) && !eventLocked(p.replaceId) ? p.replaceId : null;
    var startMs = new Date(row.starts_at).getTime();
    var hhmm = formatTime(row.starts_at);
    var series = weekly
      ? rest(
          "events?user_id=eq." + encodeURIComponent(row.user_id) +
            "&category=eq.zirkel&status=eq.geplant&starts_at=gte." + encodeURIComponent(row.starts_at) +
            "&select=id,starts_at&order=starts_at.asc&limit=60"
        ).catch(function () { return []; })
      : Promise.resolve([]);
    series.then(function (rows) {
      var ids = [String(row.id)];
      (rows || []).forEach(function (r) {
        var t = new Date(r.starts_at).getTime();
        var sameWeekday = Math.round((t - startMs) / 86400000) % 7 === 0;
        if (sameWeekday && formatTime(r.starts_at) === hhmm && ids.indexOf(String(r.id)) < 0) ids.push(String(r.id));
      });
      return rest("event_rsvps", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: ids.map(function (id) { return { event_id: id, user_id: me(), status: "zugesagt" }; })
      }).then(function () {
        if (!replaceId) return;
        return rest("events?id=eq." + encodeURIComponent(replaceId) + "&user_id=eq." + encodeURIComponent(me()), {
          method: "DELETE",
          prefer: "return=minimal"
        }).catch(function () {});
      }).then(function () {
        state.pendingCreate = null;
        closeSheet();
        if (host.toast) host.toast(ids.length > 1 ? "Dabei, jede Woche" : "Dabei");
        notifyAktuell();
        return refreshKeepDay(dayKey(row.starts_at));
      });
    }).catch(function () {
      if (host.toast) host.toast("Beitreten hat nicht geklappt");
    });
  }

  function leaveZirkel(eventId) {
    return rest(
      "event_rsvps?event_id=eq." + encodeURIComponent(eventId) + "&user_id=eq." + encodeURIComponent(me()),
      { method: "DELETE", prefer: "return=minimal" }
    ).then(function () {
      if (host.toast) host.toast("Ausgetreten");
      notifyAktuell();
      return refreshKeepDay(currentDayIso());
    }).catch(function () {});
  }

  function openKindSheet(kind, iso, replaceId) {
    replaceId = replaceId || null;
    state.pendingCreate = { replaceId: replaceId };
    if (kind === "alternative") {
      openSheet(
        "<h3>Sonstiges</h3>" +
          '<div class="wr-chips">' +
          ALTERNATIVE_CHOICES.concat(REST_DAYS)
            .map(function (t) {
              return (
                '<button type="button" class="wr-chip" data-wr-rest-pick="' +
                esc(t) +
                '" data-iso="' +
                esc(iso) +
                '">' +
                esc(t) +
                "</button>"
              );
            })
            .join("") +
          "</div>" +
          '<label class="wr-field">Freier Titel<input type="text" id="wr-rest-title" maxlength="80" placeholder="z. B. Spaziergang" /></label>' +
          '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-rest-save="' +
          esc(iso) +
          '"' +
          (replaceId ? ' data-replace="' + esc(replaceId) + '"' : "") +
          ">Weiter</button>" +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
      return;
    }
    if (kind === "zirkel") {
      if (!state.zirkelOk && !(host && host.hasZirkelAccess && host.hasZirkelAccess())) {
        openSheet(
          "<h3>Zirkeltraining</h3>" +
            "<p>Zirkeltraining läuft über den Friday Fitness Circle. Melde Dich dort einmal an, danach kannst Du es Tagen zuordnen.</p>" +
            '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-zirkel-login="' +
            esc(iso) +
            '"' +
            (replaceId ? ' data-replace="' + esc(replaceId) + '"' : "") +
            ">Beim Zirkel anmelden</button>" +
            '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Schließen</button>'
        );
        return;
      }
      var en = (state.enrollments || []).filter(function (e) {
        var c = e.courses || {};
        return (
          c.slug === "zirkeltraining" ||
          c.slug === "training-zirkel" ||
          c.category_default === "zirkel"
        );
      })[0];
      var courseId = en && (en.course_id || (en.courses && en.courses.id));
      state.pendingCreate = {
        kind: "zirkel",
        iso: iso,
        title: "Zirkeltraining",
        courseId: courseId || null,
        enrollmentId: en && en.id,
        replaceId: replaceId,
        zMode: "single",
        zWork: 240,
        zPause: 30,
        zRounds: 6
      };
      openZirkelJoinSheet(iso);
      return;
    }

    openSheet("<h3>" + esc(kind === "kraft" ? "Kraft" : "Ausdauer") + "</h3><p>Lade…</p>");

    loadTrainingLists().then(function () {
      var list =
        kind === "kraft" ? state.kraftTrainings : state.ausdauerTrainings;
      if (!list.length) {
        openSheet(
          "<h3>" +
            esc(kind === "kraft" ? "Kraft" : "Ausdauer") +
            "</h3><p>Keine Trainings hinterlegt.</p>" +
            '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Schließen</button>'
        );
        return;
      }
      openSheet(
        "<h3>" +
          esc(kind === "kraft" ? "Kraft" : "Ausdauer") +
          "</h3>" +
          '<div class="wr-course-list">' +
          list
            .map(function (t) {
              return (
                '<button type="button" class="wr-course-card" data-wr-pick-training="1" data-kind="' +
                esc(kind) +
                '" data-slug="' +
                esc(t.slug) +
                '" data-title="' +
                esc(t.label) +
                '" data-system="' +
                esc(t.systemId || "") +
                '" data-tech="' +
                esc(t.technique || "") +
                '" data-iso="' +
                esc(iso) +
                '"' +
                (replaceId ? ' data-replace="' + esc(replaceId) + '"' : "") +
                "><strong>" +
                esc(t.label) +
                "</strong></button>"
              );
            })
            .join("") +
          "</div>" +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
    });
  }

  function pickTraining(btn) {
    var kind = btn.getAttribute("data-kind");
    var iso = btn.getAttribute("data-iso");
    var slug = btn.getAttribute("data-slug");
    var title = btn.getAttribute("data-title") || kind;
    var cat = kind === "ausdauer" ? "ausdauer" : "kraft";
    var replaceId =
      (state.pendingCreate && state.pendingCreate.replaceId) ||
      btn.getAttribute("data-replace") ||
      null;
    state.pendingCreate = {
      kind: kind,
      category: cat,
      iso: iso,
      slug: slug,
      title: title,
      replaceId: replaceId,
      groupExtra: state.groupExtraNext || null
    };
    state.groupExtraNext = null;
    openCreateTimeSheet();
  }

  function openWeekMenu() {
    openSheet(
      "<h3>Zeitraum</h3>" +
        '<div class="wr-course-list">' +
        WEEK_MODES.map(function (m) {
          var on = m.id === state.weekMode;
          return (
            '<button type="button" class="wr-course-card' +
            (on ? " is-on" : "") +
            '" data-wr-set-mode="' +
            esc(m.id) +
            '"><strong>' +
            esc(m.label) +
            "</strong><span>" +
            (m.id === "from_today"
              ? "Heute + 6 Tage"
              : "Mo–So nächste Kalenderwoche") +
            "</span></button>"
          );
        }).join("") +
        "</div>" +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
  }

  function openShareSheet(iso, eventId) {
    state.shareIso = iso;
    state.shareEventId = eventId;
    state.sharePick = {};
    state.shareInvited = {};
    state.shareStatus = {};
    state.shareReq = {};
    function paint() {
      /* Anfragende stehen auch drin, wenn sie (noch) nicht in Meine Freunde sind */
      var friends = (state.friends || []).slice();
      Object.keys(state.shareReq).forEach(function (fid) { if (friends.indexOf(fid) < 0) friends.push(fid); });
      var list = friends
        .map(function (fid) {
          var p = personOf(fid);
          /* Status: eingeladen (grau, Haken) · macht mit (schwarz, Haken) · angefragt (ohne Haken, antippen) · nimmt teil (Anfrage angenommen) */
          var stt = state.shareStatus[fid] || "";
          var req = state.shareReq[fid];
          if (req && req.status === "pending") {
            return '<div class="wr-friend-row is-request" role="button" data-wr-friend-req="' + esc(fid) + '">' +
              '<input type="checkbox" tabindex="-1" />' + avatarHtml(p) +
              "<span>" + esc(p.name || "?") + ' <small class="wr-invited-tag">angefragt</small></span></div>';
          }
          if (stt === "accepted") {
            var lab = req && req.status === "accepted" ? "nimmt teil" : "macht mit";
            return '<div class="wr-friend-row is-going"><input type="checkbox" checked tabindex="-1" />' + avatarHtml(p) +
              "<span>" + esc(p.name || "?") + ' <small class="wr-invited-tag">' + lab + "</small></span></div>";
          }
          if (stt === "pending") {
            return '<div class="wr-friend-row is-invited"><input type="checkbox" checked tabindex="-1" />' + avatarHtml(p) +
              "<span>" + esc(p.name || "?") + ' <small class="wr-invited-tag">eingeladen</small></span></div>';
          }
          return (
            '<label class="wr-friend-row" data-wr-friend-pick="' + esc(fid) + '">' +
            '<input type="checkbox"' + (state.sharePick[fid] ? " checked" : "") + " />" +
            avatarHtml(p) +
            "<span>" + esc(p.name || "?") + "</span></label>"
          );
        })
        .join("");
      var evS = findOwnEvent(eventId) || (state.events || []).filter(function (e) { return String(e.id) === String(eventId); })[0];
      var isZ = !!(evS && evS.category === "zirkel");
      /* oben: beim Zirkel der Circle, sonst/danach die eigene Gruppe; dann die Freunde */
      var checkBox = function (on) { return '<input type="checkbox"' + (on ? " checked" : "") + ' tabindex="-1" />'; };
      var circleRows = isZ ? (state.shareCircles || []).map(function (g) {
        var gid = String(g.group_id);
        return '<div class="wr-friend-row wr-friend-row--group" role="button" data-wr-circle-pick="' + esc(gid) + '">' +
          checkBox(!!state.shareCirclePick[gid]) + '<span class="wr-friend-row__ph">' + esc(String(g.name || "C").slice(0, 1)) + "</span><span>Circle " + esc(g.name || "") + "</span></div>";
      }).join("") : "";
      var groups = host && host.myGroups ? host.myGroups() || [] : [];
      var groupRows = groups.map(function (g) {
        /* Haken = Event mit der Gruppe teilen (group_id), unabhängig davon, ob Mitglieder Freunde sind */
        var on = !!state.shareGroupPick[String(g.id)] || (!!evS && String(evS.group_id || "") === String(g.id) && evS.visibility === "gruppe");
        return '<div class="wr-friend-row wr-friend-row--group" role="button" data-wr-group-pick="' + esc(g.id) + '">' +
          checkBox(on) + '<span class="wr-friend-row__ph">' + esc(String(g.name || "G").slice(0, 1)) + "</span><span>Gruppe " + esc(g.name || "") + "</span></div>";
      }).join("");
      openSheet(
        '<p class="wr-sheet-title wr-sheet-title--center">' + esc((evS && evS.title) || "Training") + "</p>" +
          (list || circleRows || groupRows
            ? '<div class="wr-friend-list">' + circleRows + groupRows + list + "</div>"
            : '<p class="wr-sheet-hint">Noch keine Freunde.</p>') +
          '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>' +
          '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-invite-friends="1"' +
          (friends.length || circleRows ? "" : " disabled") +
          ">Einladen</button></div>"
      );
    }
    state.sharePaint = paint;
    state.shareGroupPick = {};
    state.shareCirclePick = {};
    state.shareCircles = [];
    var evZ = findOwnEvent(eventId);
    if (evZ && evZ.category === "zirkel" && ffcOk() && FFC.groups) {
      Promise.resolve(FFC.groups()).then(function (gs) { state.shareCircles = gs || []; if (state.shareEventId === eventId) paint(); }).catch(function () {});
    }
    /* Schon eingeladene Freunde: Haken gesetzt, keine zweite Einladung */
    var realReq = /^[0-9a-f-]{36}$/i.test(String(eventId || "")) ? String(eventId) : "";
    loadFriends().then(function () {
      return Promise.all([
        sentInvitesFor(eventId, iso).then(function (rows) {
          (rows || []).forEach(function (r) {
            var k = String(r.to_id);
            state.shareInvited[k] = true;
            if (state.shareStatus[k] !== "accepted") state.shareStatus[k] = r.status || "pending";
          });
        }),
        /* Anfragen „Ich möchte mitmachen“ zu diesem Event (go-event-requests.sql) */
        realReq ? rest("go_event_requests?to_id=eq." + encodeURIComponent(me()) + "&event_id=eq." + encodeURIComponent(realReq) +
          "&status=in.(pending,accepted)&select=id,from_id,status&limit=100").then(function (rows) {
            (rows || []).forEach(function (r) { state.shareReq[String(r.from_id)] = r; });
            var need = (rows || []).map(function (r) { return String(r.from_id); }).filter(function (id) { return !personOf(id).name; });
            if (need.length) return ensurePeople(need);
          }).catch(function () {}) : null
      ]);
    }).then(paint, paint);
  }

  /* Anfrage eines Freundes in der Liste: Annehmen? Ja → Einladung angenommen, Status „nimmt teil“ */
  function answerShareRequest(fid) {
    var r = state.shareReq[fid];
    if (!r || !global.GoDialog) return;
    var p = personOf(fid);
    var ev = findOwnEvent(state.shareEventId) || {};
    GoDialog.confirm(String(p.name || "Freund").split(" ")[0] + " möchte mitmachen. Annehmen?", { ok: "Ja", cancel: "Nein", row: true }).then(function (yes) {
      var now = new Date().toISOString();
      var jobs = [rest("go_event_requests?id=eq." + encodeURIComponent(r.id), {
        method: "PATCH", prefer: "return=minimal", body: { status: yes ? "accepted" : "declined", decided_at: now }
      })];
      if (yes) {
        jobs.push(rest("go_workout_invites", {
          method: "POST", prefer: "return=minimal",
          body: {
            from_id: me(), to_id: fid, workout_date: ev.starts_at ? dayKey(ev.starts_at) : state.shareIso,
            workout_label: ev.title || "Training", from_name: (host.sessionAccount && host.sessionAccount.name) || "gogogo",
            place: ev.location || null, meet_time: ev.starts_at && displayTime(ev.starts_at) ? formatTime(ev.starts_at) : null,
            status: "accepted", event_id: ev.id || state.shareEventId
          }
        }));
      }
      Promise.all(jobs).then(function () {
        r.status = yes ? "accepted" : "declined";
        if (yes) state.shareStatus[fid] = "accepted";
        else delete state.shareReq[fid];
        if (state.sharePaint) state.sharePaint();
        if (yes) refreshKeepDay(state.shareIso);
      }).catch(function () { if (host.toast) host.toast("Hat gerade nicht geklappt"); });
    });
  }

  /* Eigene offene oder angenommene Einladungen zu diesem Termin (Event-ID, sonst Tag) */
  function sentInvitesFor(eventId, iso) {
    var realId = /^[0-9a-f-]{36}$/i.test(String(eventId || "")) ? String(eventId) : "";
    return rest(
      "go_workout_invites?from_id=eq." + encodeURIComponent(me()) + "&status=in.(pending,accepted)" +
        (realId ? "&event_id=eq." + encodeURIComponent(realId) : "&workout_date=eq." + encodeURIComponent(iso || "")) +
        "&select=to_id,event_id,workout_date,status&limit=200"
    ).catch(function () { return []; });
  }

  /* Serie eines eigenen Events: gleicher Titel, Wochentag und Uhrzeit ab diesem Termin, höchstens 12 Wochen */
  function ownSeries(ev) {
    if (!ev || !ev.starts_at || !/^[0-9a-f-]{36}$/i.test(String(ev.id || ""))) return Promise.resolve(ev ? [ev] : []);
    return rest(
      "events?user_id=eq." + encodeURIComponent(me()) + "&title=eq." + encodeURIComponent(ev.title || "") +
        "&starts_at=gte." + encodeURIComponent(ev.starts_at) + "&status=eq.geplant&select=id,starts_at,title&order=starts_at.asc&limit=40"
    ).then(function (rows) {
      var wd = new Date(ev.starts_at).getDay();
      var hhmm = formatTime(ev.starts_at);
      var list = (rows || []).filter(function (r) {
        return new Date(r.starts_at).getDay() === wd && formatTime(r.starts_at) === hhmm;
      }).slice(0, 12);
      if (!list.some(function (r) { return String(r.id) === String(ev.id); })) list.unshift(ev);
      return list;
    }).catch(function () { return [ev]; });
  }

  /* Zirkel mit dem Circle teilen: je Termin der Serie ein Circle-Event mit Einladung an alle im Circle (FFC) */
  function shareToCircle(eventId, presetGid) {
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    if (!ffcOk() || !FFC.groups || !FFC.createEvent) {
      if (global.GoDialog) GoDialog.alert("Circles gibt es mit FFC-Zugang. Unter Plus → Friday Fitness Circle anmelden.");
      return;
    }
    if (!displayTime(ev.starts_at)) {
      if (global.GoDialog) GoDialog.alert("Setz erst eine Uhrzeit, dann kann Dein Circle zusagen.");
      return;
    }
    Promise.resolve(FFC.groups()).then(function (groups) {
      if (!(groups || []).length) { GoDialog.alert("Du bist noch in keinem Circle."); return; }
      return (presetGid ? Promise.resolve(String(presetGid)) : GoDialog.choose("Mit Circle teilen", groups.map(function (g) { return { label: g.name, value: String(g.group_id) }; })))
        .then(function (gid) {
          if (!gid) return;
          var g = groups.filter(function (x) { return String(x.group_id) === gid; })[0] || { name: "Circle" };
          var existing = (FFC.events ? FFC.events() || [] : []).filter(function (e) { return e.is_mine; })
            .map(function (e) { return new Date(e.starts_at).getTime(); });
          return Promise.all([ownSeries(ev), Promise.resolve(FFC.weeklyPoints ? FFC.weeklyPoints(Number(gid)) : [])]).then(function (r) {
            var ids = (r[1] || []).filter(function (x) { return !x.is_me; }).map(function (x) { return x.user_id; });
            var dates = (r[0] || []).filter(function (x) {
              var t = new Date(x.starts_at).getTime();
              return !existing.some(function (e) { return Math.abs(e - t) <= 600000; });
            });
            var chain = Promise.resolve();
            dates.forEach(function (x) {
              chain = chain.then(function () {
                return FFC.createEvent({ title: (ev.title || "Zirkeltraining") + " · " + g.name, startsAt: x.starts_at, inviteeIds: ids }).catch(function () {});
              });
            });
            return chain.then(function () {
              closeSheet();
              if (host.toast) host.toast(dates.length ? "Mit " + g.name + " geteilt (" + dates.length + " Termine)" : "Schon mit dem Circle geteilt");
            });
          });
        });
    }).catch(function () { if (host.toast) host.toast("Hat nicht geklappt"); });
  }

  /* Woche als CSV (Semikolon, mit BOM für Excel) */
  function exportWeekCsv() {
    var rows = [["Datum", "Wochentag", "Uhrzeit", "Titel", "Art", "Ort", "Sichtbarkeit", "Status", "Wer"]];
    var CAT = { kraft: "Kraft", ausdauer: "Ausdauer", zirkel: "Zirkeltraining", alternative: "Alternative", spontan: "Spontan", ernaehrung: "Ernährung" };
    weekDays().forEach(function (iso) {
      var d = new Date(iso + "T12:00:00");
      itemsForDay(iso).forEach(function (it) {
        var ev = it.ev || it.item || {};
        var mine = it.kind !== "ffc" && it.kind !== "joined" && (!ev.user_id || String(ev.user_id) === me());
        var who = mine ? "ich" : (it.kind === "ffc" ? (ev.creator_nickname || "Circle") : (personOf(ev.user_id).name || ""));
        rows.push([
          d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }),
          DAYS_DE[d.getDay()],
          displayTime(ev.starts_at) ? formatTime(ev.starts_at) : "",
          ev.title || "",
          CAT[ev.category] || ev.category || "",
          ev.location || "",
          ev.visibility === "privat" ? "privat" : "zeigen",
          it._fromPlan ? "Plan" : (ev.status || "geplant"),
          who
        ]);
      });
    });
    var csv = "\ufeff" + rows.map(function (r) {
      return r.map(function (c) { c = String(c == null ? "" : c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";");
    }).join("\r\n");
    var name = "gogogo-Woche-" + weekStart() + ".csv";
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    try {
      var file = new File([blob], name, { type: "text/csv" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file], title: name }).catch(function () {});
        return;
      }
    } catch (eF) {}
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  /* Woche als .ics: Kalender-Apps (iPhone, Google, Outlook) importieren das, CSV nicht */
  function exportWeekIcs() {
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function utc(d) {
      return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z";
    }
    function txt(v) { return String(v || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1"); }
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//gogogo.social//Woche//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    var stamp = utc(new Date());
    weekDays().forEach(function (iso) {
      itemsForDay(iso).forEach(function (it) {
        var ev = it.ev || it.item || {};
        if (!ev.starts_at || ev.status === "ausgefallen") return;
        var uid = String(ev.id || (iso + "-" + (ev.title || "x"))).replace(/[^A-Za-z0-9-]/g, "") + "@gogogo.social";
        lines.push("BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp);
        if (displayTime(ev.starts_at)) {
          var st = new Date(ev.starts_at);
          var z = ev.category === "zirkel" && global.GoZirkelSetup ? GoZirkelSetup.parse(ev.note) : null;
          var mins = z && GoZirkelSetup.totalSec ? Math.ceil(GoZirkelSetup.totalSec(z) / 60) || 60 : 60;
          lines.push("DTSTART:" + utc(st), "DTEND:" + utc(new Date(st.getTime() + mins * 60000)));
        } else {
          var nx = addDays(iso, 1);
          lines.push("DTSTART;VALUE=DATE:" + iso.replace(/-/g, ""), "DTEND;VALUE=DATE:" + nx.replace(/-/g, ""));
        }
        lines.push("SUMMARY:" + txt(ev.title || "Training"));
        if (ev.location) lines.push("LOCATION:" + txt(ev.location));
        lines.push("URL:https://www.gogogo.social/workout/", "END:VEVENT");
      });
    });
    lines.push("END:VCALENDAR");
    var ics = lines.join("\r\n");
    var name = "gogogo-woche.ics";
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    try {
      var file = new File([blob], name, { type: "text/calendar" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file], title: name }).catch(function () {});
        return;
      }
    } catch (eF) {}
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function shareTextFor(iso, eventId) {
    var ev = findOwnEvent(eventId);
    var title = (ev && ev.title) || "Training";
    var when = formatDayLong(iso) + (ev && displayTime(ev.starts_at) ? " · " + displayTime(ev.starts_at) : "");
    return "Komm mit zu gogogo: " + title + " · " + when;
  }

  function shareExternal(iso, eventId) {
    /* Bild im Layout der Aktuell-Karte + Text (share-card.js) */
    var evC = findOwnEvent(eventId) || (state.events || []).filter(function (e) { return String(e.id) === String(eventId); })[0];
    if (evC && global.GoShareCard) {
      var owner = personOf(String(evC.user_id || me()));
      GoShareCard.share({
        title: String(evC.title || "Training").replace(/^[^A-Za-zÄÖÜäöü0-9]+\s*/, ""),
        emoji: emojiFor(evC.category, evC.title),
        startsAt: evC.starts_at,
        hasTime: !!displayTime(evC.starts_at),
        location: evC.location || "",
        photo: evC.photo_url || "",
        cover: global.GoCovers ? GoCovers.url(evC.course_id, evC.category || "kraft", evC.enrollment_id) : "",
        who: String(owner.name || "").split(" ")[0],
        whoPhoto: owner.photo || ""
      });
      return;
    }
    var text = shareTextFor(iso, eventId);
    var url = "https://gogogo-social.vercel.app/workout/";
    if (navigator.share) {
      navigator
        .share({ title: "gogogo", text: text, url: url })
        .catch(function () {});
      return;
    }
    var wa =
      "https://wa.me/?text=" + encodeURIComponent(text + " " + url);
    try {
      window.open(wa, "_blank");
    } catch (e) {
      location.href = wa;
    }
  }

  /* Event mit der eigenen Gruppe teilen: Sichtbarkeit Gruppe + group_id (erscheint unter Team → Meine Gruppe) */
  function shareToGroup(eventId, iso, gid) {
    var ev = findOwnEvent(eventId);
    if (!ev) return Promise.resolve();
    var g = ((host && host.myGroups ? host.myGroups() : []) || []).filter(function (x) { return String(x.id) === String(gid); })[0] || { name: "" };
    return materializeEvent(ev).then(function (real) {
      return rest("events?id=eq." + encodeURIComponent(real.id), {
        method: "PATCH", prefer: "return=minimal", body: { visibility: "gruppe", group_id: gid }
      }).then(function () {
        ev.visibility = "gruppe";
        ev.group_id = gid;
        if (host.toast) host.toast("Mit Gruppe " + (g.name || "") + " geteilt");
        return refreshKeepDay(iso || dayKey(real.starts_at || ev.starts_at));
      });
    }).catch(function () {
      if (host.toast) host.toast("Teilen mit der Gruppe ging gerade nicht");
    });
  }

  function inviteFriendsSelected() {
    var iso = state.shareIso;
    var eventId = state.shareEventId;
    var ids = Object.keys(state.sharePick).filter(function (k) {
      return state.sharePick[k];
    });
    if (!ids.length) {
      if (host.toast) host.toast("Bitte Freunde auswählen");
      return Promise.resolve();
    }
    var ev = findOwnEvent(eventId);
    var label = (ev && ev.title) || "Training";
    var place = (ev && ev.location) || "";
    var time = ev ? formatTime(ev.starts_at) : "";
    var fromName =
      (host.sessionAccount && host.sessionAccount.name) || "gogogo";
    /* Aus der Woche eingeladen = wiederkehrend: alle eigenen Termine dieser Serie
       (gleicher Titel, Wochentag, Uhrzeit) ab diesem Tag, höchstens 12 Wochen. */
    var realId = /^[0-9a-f-]{36}$/i.test(String(eventId || "")) ? String(eventId) : null;
    var series = realId && ev && ev.starts_at
      ? rest(
          "events?user_id=eq." + encodeURIComponent(me()) +
            "&title=eq." + encodeURIComponent(ev.title || "") +
            "&starts_at=gte." + encodeURIComponent(ev.starts_at) +
            "&status=eq.geplant&select=id,starts_at,location&order=starts_at.asc&limit=40"
        ).then(function (rows) {
          var wd = new Date(ev.starts_at).getDay();
          var hhmm = formatTime(ev.starts_at);
          var list = (rows || []).filter(function (r) {
            return new Date(r.starts_at).getDay() === wd && formatTime(r.starts_at) === hhmm;
          }).slice(0, 12);
          if (!list.some(function (r) { return String(r.id) === realId; })) list.unshift({ id: realId, starts_at: ev.starts_at, location: place });
          return list;
        }).catch(function () { return [{ id: realId, starts_at: ev.starts_at, location: place }]; })
      : Promise.resolve([{ id: realId, starts_at: null, location: place }]);
    var jobs = series.then(function (list) {
      /* Regel: keine doppelten Einladungen (gleicher Freund, gleicher Termin) */
      var evIds = list.map(function (x) { return x.id; }).filter(Boolean);
      var dates = list.map(function (x) { return x.starts_at ? dayKey(x.starts_at) : iso; });
      var have = rest(
        "go_workout_invites?from_id=eq." + encodeURIComponent(me()) + "&status=in.(pending,accepted)" +
          "&to_id=in.(" + ids.map(encodeURIComponent).join(",") + ")" +
          (evIds.length ? "&event_id=in.(" + evIds.map(encodeURIComponent).join(",") + ")" : "&workout_date=in.(" + dates.map(encodeURIComponent).join(",") + ")") +
          "&select=to_id,event_id,workout_date&limit=500"
      ).catch(function () { return []; });
      return have.then(function (rows) {
      var taken = {};
      (rows || []).forEach(function (r) {
        taken[String(r.to_id) + "|" + (r.event_id ? String(r.event_id) : String(r.workout_date).slice(0, 10))] = true;
      });
      var posts = [];
      ids.forEach(function (fid) {
        list.forEach(function (sev) {
          var tk = String(fid) + "|" + (sev.id ? String(sev.id) : (sev.starts_at ? dayKey(sev.starts_at) : iso));
          if (taken[tk]) return;
          taken[tk] = true;
          posts.push(rest("go_workout_invites", {
            method: "POST",
            prefer: "return=representation",
            body: {
              from_id: me(),
              to_id: fid,
              workout_date: sev.starts_at ? dayKey(sev.starts_at) : iso,
              workout_label: label,
              from_name: fromName,
              place: sev.location || place,
              meet_time: time,
              status: "pending",
              event_id: sev.id || null,
              invite_kind: list.length > 1 ? "woche" : "invite"
            }
          }).catch(function () {
            return null;
          }));
        });
      });
      return Promise.all(posts).then(function () { return posts.length ? list.length : 0; });
      });
    });
    return jobs.then(function (weeks) {
      closeSheet();
      if (host.toast) host.toast(!weeks ? "Schon eingeladen" : weeks > 1 ? "Einladung für " + weeks + " Wochen gesendet" : "Einladung gesendet");
      if (host.loadInvites) {
        try {
          host.loadInvites();
        } catch (e) {}
      }
      return refreshKeepDay(iso);
    });
  }

  function addCourseOnDay(courseId, iso) {
    var course = state.courses.filter(function (c) {
      return String(c.id) === String(courseId);
    })[0];
    if (!course) {
      if (host.toast) host.toast("Kurs nicht gefunden");
      return Promise.resolve();
    }
    var cat = course.category_default || "kraft";
    if (!TRAIN_CATS[cat]) cat = "kraft";
    return createEvent({
      category: cat,
      course_id: course.id,
      title: course.title,
      starts_at: iso + "T18:00:00+01:00",
      is_unplanned: false,
      item_type: "course_session"
    })
      .then(function (rows) {
        var row = Array.isArray(rows) ? rows[0] : rows;
        if (row && !row.course_id) {
          throw new Error("course_id missing");
        }
        closeSheet();
        return refresh();
      })
      .catch(function () {
        /* Fallback: erneut mit course_id, falls item_type unbekannt */
        return createEvent({
          category: cat,
          course_id: course.id,
          title: course.title,
          starts_at: iso + "T18:00:00+01:00",
          is_unplanned: false
        })
          .then(function () {
            closeSheet();
            return refresh();
          })
          .catch(function () {
            if (host.toast) host.toast("Kurs konnte nicht verknüpft werden");
          });
      });
  }

  function openBookSheet(step, draft) {
    draft = draft || { course: null, start: null, weekdays: [] };
    state.bookDraft = draft;
    if (step === 1 || !step) {
      var groups = coursesByCategory();
      var order = ["kraft", "ausdauer", "zirkel"];
      var cards = order
        .map(function (cat) {
          var list = groups[cat] || [];
          if (!list.length) return "";
          return (
            '<div class="wr-cat-block"><h4>' +
            esc(CAT_LABELS[cat] || cat) +
            "</h4>" +
            list
              .map(function (c) {
                return (
                  '<button type="button" class="wr-course-card" data-wr-pick-course="' +
                  esc(c.id) +
                  '"><strong>' +
                  esc(c.title) +
                  "</strong><span>" +
                  (c.duration_weeks || "?") +
                  " Wo · " +
                  (c.sessions_per_week || "?") +
                  "×/Wo</span></button>"
                );
              })
              .join("") +
            "</div>"
          );
        })
        .join("");
      openSheet(
        "<h3>Kurs wählen</h3>" +
          '<div class="wr-course-list">' +
          (cards || "<p>Keine Kurse verfügbar.</p>") +
          "</div>" +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
      return;
    }
    if (step === 2) {
      var nextMo =
        state.weekMode === "next_week"
          ? addDays(mondayOf(berlinToday()), 7)
          : mondayOf(berlinToday()) >= berlinToday()
            ? mondayOf(berlinToday())
            : addDays(mondayOf(berlinToday()), 7);
      draft.start = draft.start || nextMo;
      var spw = (draft.course && draft.course.sessions_per_week) || 3;
      if (!draft.weekdays.length) {
        draft.weekdays = [0, 2, 4].slice(0, spw);
      }
      var days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
        .map(function (label, i) {
          var on = draft.weekdays.indexOf(i) >= 0;
          return (
            '<button type="button" class="wr-chip' +
            (on ? " is-on" : "") +
            '" data-wr-wd="' +
            i +
            '">' +
            label +
            "</button>"
          );
        })
        .join("");
      openSheet(
        "<h3>Start & Tage</h3>" +
          '<label class="wr-field">Startdatum (Montag)<input type="date" id="wr-start-date" value="' +
          esc(draft.start) +
          '" /></label>' +
          '<div class="wr-chips">' +
          days +
          "</div>" +
          '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-book-step="3">Weiter</button>' +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
      return;
    }
    if (step === 3) {
      var preview = weekDaysPreview(draft);
      openSheet(
        "<h3>Vorschau</h3>" +
          "<p>" +
          esc((draft.course && draft.course.title) || "Kurs") +
          " ab " +
          esc(draft.start) +
          "</p>" +
          '<ul class="wr-preview">' +
          preview
            .map(function (line) {
              return "<li>" + esc(line) + "</li>";
            })
            .join("") +
          "</ul>" +
          '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-book-confirm="1">Kurs buchen</button>' +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
    }
  }

  function weekDaysPreview(draft) {
    var labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    return (draft.weekdays || [])
      .slice()
      .sort()
      .map(function (wd) {
        return labels[wd] + " · " + addDays(draft.start, wd);
      });
  }

  function createEvent(payload) {
    var body = {
      user_id: me(),
      category: payload.category,
      course_id: payload.course_id || null,
      enrollment_id: payload.enrollment_id || null,
      starts_at: payload.starts_at,
      location: payload.location || null,
      visibility: payload.visibility || "team",
      is_unplanned: !!payload.is_unplanned,
      status: "geplant",
      title: payload.title || payload.category,
      item_type: payload.item_type || (payload.is_unplanned ? "spontaneous" : "event"),
      travel_auto: !!payload.travel_auto
    };
    if (payload.note) body.note = payload.note;
    if (payload.group_id) body.group_id = payload.group_id;
    return rest("events", {
      method: "POST",
      prefer: "return=representation",
      body: body
    }).catch(function () {
      delete body.item_type;
      delete body.travel_auto;
      return rest("events", {
        method: "POST",
        prefer: "return=representation",
        body: body
      });
    });
  }

  function applyTravel(days) {
    var start = berlinToday();
    var until = addDays(start, days);
    return applyTravelRange(start, until);
  }

  function endTravel() {
    var snap = loadTravelSnap();
    var restoredIds = {};
    var jobs = [];
    Object.keys(snap.events || {}).forEach(function (id) {
      var original = snap.events[id];
      if (!original) return;
      restoredIds[id] = true;
      var body = {
        category: original.category,
        course_id: original.course_id || null,
        enrollment_id: original.enrollment_id || null,
        title: original.title,
        starts_at: original.starts_at,
        location: original.location || null,
        visibility: original.visibility || "team",
        is_unplanned: !!original.is_unplanned,
        item_type: original.item_type || "event",
        travel_auto: false,
        status: original.status || "geplant"
      };
      if (original.note != null) body.note = original.note;
      jobs.push(
        rest("events?id=eq." + encodeURIComponent(id), {
          method: "PATCH",
          prefer: "return=minimal",
          body: body
        }).catch(function () {
          var bare = Object.assign({}, body);
          delete bare.item_type;
          delete bare.travel_auto;
          return rest("events?id=eq." + encodeURIComponent(id), {
            method: "PATCH",
            prefer: "return=minimal",
            body: bare
          }).catch(function () {});
        })
      );
    });
    /* Neue Reise-Events (ohne Snapshot) entfernen */
    state.events.forEach(function (ev) {
      if (!ev || !ev.id || restoredIds[String(ev.id)]) return;
      var isTravel =
        ev.travel_auto ||
        ev.item_type === "hotel_workout" ||
        String(ev.title || "").indexOf("Hotel-Workout") === 0;
      if (!isTravel || ev.status !== "geplant") return;
      jobs.push(
        rest("events?id=eq." + encodeURIComponent(ev.id), {
          method: "DELETE",
          prefer: "return=minimal"
        }).catch(function () {})
      );
    });
    if (snap.plan && Object.keys(snap.plan).length && host && host.restorePlanUnits) {
      jobs.push(Promise.resolve(host.restorePlanUnits(snap.plan)).catch(function () {}));
    }
    saveTravelPref(null);
    clearTravelSnap();
    if (host.toast) host.toast("Reise beendet — Wochenplan wiederhergestellt");
    return Promise.all(jobs).then(function () {
      return refreshKeepDay(berlinToday());
    });
  }

  function openTravelMenu() {
    var on = travelActive();
    openSheet(
      "<h3>Reisemodus</h3>" +
        (on
          ? "<p>Aktiv bis " +
            esc(formatDayLong(state.travelUntil).replace(/^[^,]*,\s*/, "") || state.travelUntil) +
            ". Gespeichert in Deinem Profil (Supabase) — auf allen Geräten.</p>" +
            '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-end-travel="1">Reise jetzt abbrechen</button>'
          : "<p>Abwesenheit wählen — Trainingstage brauchen eine Alternative. Web-Call und Ernährung nicht.</p>" +
            '<div class="wr-chips">' +
            [3, 5, 7, 10, 14]
              .map(function (d) {
                return (
                  '<button type="button" class="wr-chip" data-wr-travel-go="' +
                  d +
                  '">' +
                  d +
                  " Tage</button>"
                );
              })
              .join("") +
            "</div>") +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Schließen</button>'
    );
  }

  function swapToHotel(eventId) {
    var ev = findOwnEvent(eventId);
    if (!ev) return;
    rememberEventBeforeTravel(ev);
    return rest("events?id=eq." + encodeURIComponent(eventId), {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        title: "Hotel-Workout · 20 min",
        category: "alternative",
        course_id: null,
        location: null,
        is_unplanned: true,
        item_type: "hotel_workout",
        travel_auto: true
      }
    })
      .catch(function () {
        return rest("events?id=eq." + encodeURIComponent(eventId), {
          method: "PATCH",
          prefer: "return=minimal",
          body: {
            title: "Hotel-Workout · 20 min",
            category: "alternative",
            course_id: null,
            location: null,
            is_unplanned: true
          }
        });
      })
      .then(refresh);
  }

  function retargetEnrollment() {
    var draft = state.bookDraft;
    if (!draft || !draft.enrollId) return;
    var startEl = $("wr-start-date");
    if (startEl && startEl.value) draft.start = startEl.value;
    return rest("enrollments?id=eq." + encodeURIComponent(draft.enrollId), {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        start_date: draft.start,
        weekdays: draft.weekdays.slice().sort(),
        status: "aktiv"
      }
    })
      .then(function () {
        /* Nur künftige Events neu erzeugen: Generator skippt bestehende starts_at */
        return rest("rpc/go_generate_events", {
          method: "POST",
          body: { p_enrollment_id: draft.enrollId }
        }).catch(function () {
          return rest("rpc/go_generate_events", {
            method: "POST",
            body: { enrollment_id: draft.enrollId }
          });
        });
      })
      .then(function () {
        closeSheet();
        return refresh();
      })
      .catch(function () {
        if (host.toast) host.toast("Tage konnten nicht geändert werden");
      });
  }

  function bookCourse() {
    var draft = state.bookDraft;
    if (!draft || !draft.course || !me()) return;
    /* Testphase: alles gratis */
    var payment = "gratis";
    var body = {
      user_id: me(),
      course_id: draft.course.id,
      status: "aktiv",
      start_date: draft.start,
      weekdays: draft.weekdays.slice().sort(),
      payment_status: payment
    };
    return rest("enrollments", {
      method: "POST",
      prefer: "return=representation",
      body: body
    })
      .catch(function () {
        delete body.payment_status;
        return rest("enrollments", {
          method: "POST",
          prefer: "return=representation",
          body: body
        });
      })
      .then(function (rows) {
        var en = Array.isArray(rows) ? rows[0] : rows;
        if (!en || !en.id) throw new Error("enrollment");
        rest("activity_log", {
          method: "POST",
          prefer: "return=minimal",
          body: {
            user_id: me(),
            type: "enrollment_request",
            ref_id: en.id
          }
        }).catch(function () {});
        return rest("rpc/go_generate_events", {
          method: "POST",
          body: { p_enrollment_id: en.id }
        })
          .catch(function () {
            return rest("rpc/go_generate_events", {
              method: "POST",
              body: { enrollment_id: en.id }
            });
          })
          .then(function () {
            return en;
          });
      })
      .then(function (en) {
        closeSheet();
        showPayHint(draft.course, draft.start);
        return refresh();
      })
      .catch(function () {
        if (host.toast) host.toast("Buchung fehlgeschlagen");
      });
  }

  function showPayHint(course, start) {
    var trainerId = host.sessionAccount && host.sessionAccount.trainer_id;
    var waBtn = trainerId
      ? '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-coach-wa="1" data-course="' +
        esc(course.title) +
        '" data-start="' +
        esc(start) +
        '">Coach schreiben</button>'
      : "";
    openSheet(
      "<h3>Gebucht</h3>" +
        "<p>Der Kurs steht in Deiner Woche.</p>" +
        waBtn +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Schließen</button>'
    );
  }

  function confirmDeleteEvent(id) {
    openSheet(
      "<h3>Löschen?</h3>" +
        "<p>Dieser Eintrag wird entfernt.</p>" +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-delete-confirm="' +
        esc(id) +
        '">Löschen</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
  }

  function showUndoBar() {
    var root = $(ROOT_ID);
    if (!root) return;
    var bar = root.querySelector(".wr-undo");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "wr-undo";
      root.appendChild(bar);
    }
    bar.hidden = false;
    bar.innerHTML =
      '<span>Gelöscht</span><button type="button" data-wr-undo-go="1">Rückgängig</button>';
    if (state.undoTimer) clearTimeout(state.undoTimer);
    state.undoTimer = setTimeout(function () {
      state.lastDeleted = null;
      if (bar) bar.hidden = true;
    }, 6000);
  }

  function undoDelete() {
    var snap = state.lastDeleted;
    if (!snap) return Promise.resolve();
    state.lastDeleted = null;
    if (state.undoTimer) clearTimeout(state.undoTimer);
    var bar = document.querySelector("#" + ROOT_ID + " .wr-undo");
    if (bar) bar.hidden = true;
    return createEvent({
      category: snap.category,
      course_id: snap.course_id,
      enrollment_id: snap.enrollment_id,
      title: snap.title,
      starts_at: snap.starts_at,
      location: snap.location,
      visibility: snap.visibility || "team",
      is_unplanned: !!snap.is_unplanned,
      item_type: snap.item_type || "event",
      travel_auto: !!snap.travel_auto
    }).then(function () {
      return refresh();
    });
  }

  function deleteEvent(id) {
    if (isPlanPlaceholder(id)) {
      var skipIso = String(id).slice(5);
      closeSheet();
      return rest("events", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          user_id: me(),
          category: "alternative",
          course_id: null,
          starts_at: skipIso + "T12:00:00" + berlinOffsetSuffix(skipIso),
          status: "ausgefallen",
          title: "Ausgefallen",
          visibility: "privat",
          is_unplanned: false
        }
      })
        .then(function () {
          return refreshKeepDay(skipIso);
        })
        .then(function () {
          return notifyAktuell();
        })
        .catch(function () {
          if (host.toast) host.toast("Löschen fehlgeschlagen");
        });
    }
    var ev = state.events.filter(function (e) {
      return String(e.id) === String(id);
    })[0];
    if (!ev) return Promise.resolve();
    var iso = dayKey(ev.starts_at);
    state.lastDeleted = {
      category: ev.category,
      course_id: ev.course_id,
      enrollment_id: ev.enrollment_id,
      title: ev.title,
      starts_at: ev.starts_at,
      location: ev.location,
      visibility: ev.visibility,
      is_unplanned: ev.is_unplanned,
      item_type: ev.item_type,
      travel_auto: ev.travel_auto
    };
    closeSheet();
    return rest("events?id=eq." + encodeURIComponent(id), {
      method: "DELETE",
      prefer: "return=minimal"
    })
      .then(function () {
        return refresh();
      })
      .then(function () {
        showUndoBar();
        if (!iso) return;
        if (!itemsForDay(iso).length && state.editMode) {
          /* leer — Edit bleibt, kein Extra-Sheet (Undo ist da) */
        }
      })
      .then(function () {
        return notifyAktuell();
      });
  }

  function exitEditMode() {
    if (!state.editMode) return;
    state.editMode = false;
    render();
  }

  function onRootClick(e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-wr-inv-yes],[data-wr-inv-no],[data-wr-zjoin],[data-wr-zown],[data-wr-leave],[data-wr-zadmin],[data-wr-zirkel-next],[data-wr-zirkel-go],[data-wr-travel],[data-wr-week],[data-wr-week-menu],[data-wr-set-mode],[data-wr-edit],[data-wr-cal],[data-wr-pick-plan],[data-wr-end-travel],[data-wr-add-kind],[data-wr-edit-kind],[data-wr-pick-training],[data-wr-rest-pick],[data-wr-rest-save],[data-wr-create-confirm],[data-wr-travel-alt],[data-wr-day-course],[data-wr-travel-pick],[data-wr-travel-go],[data-wr-sheet-close],[data-wr-book],[data-wr-pick-course],[data-wr-wd],[data-wr-book-step],[data-wr-book-confirm],[data-wr-delete],[data-wr-delete-confirm],[data-wr-edit-time],[data-wr-edit-day],[data-wr-day-move],[data-wr-time-save],[data-wr-edit-place],[data-wr-place-save],[data-wr-zirkel-login],[data-wr-time-h],[data-wr-time-m],[data-wr-undo-go],[data-wr-swap],[data-wr-share],[data-wr-group-pick],[data-wr-circle-pick],[data-wr-plane],[data-wr-ics],[data-wr-dsq],[data-wr-zrec],[data-wr-invite-friends],[data-wr-share-ext],[data-wr-share-circle],[data-wr-csv],[data-wr-friend-pick],[data-wr-friend-req],[data-wr-rsvp],[data-wr-done],[data-wr-ffc-rsvp],[data-wr-comments],[data-wr-coach-wa],[data-wr-enroll-menu],[data-wr-enroll-end],[data-wr-enroll-pause],[data-wr-enroll-days],[data-wr-more]") : null;
    if (!t) {
      if (e.target && e.target.id === "wr-sheet") {
        closeSheet();
        return;
      }
      /* Kraft-/Ausdauer-Event aus einem Kurs antippen → Workout-Ansicht */
      if (!state.editMode && e.target && e.target.closest && e.target.closest(".wr-media") && !e.target.closest("button, a, input")) {
        var slideW = e.target.closest(".wr-slide[data-event-id]");
        var evW = slideW ? findOwnEvent(slideW.getAttribute("data-event-id")) : null;
        if (!evW) {
          var jid = slideW && slideW.getAttribute("data-event-id");
          evW = (state.joined || []).filter(function (x) { return String(x.id) === String(jid); })[0] || null;
        }
        var wIso = evW && evW.starts_at ? new Date(evW.starts_at).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }) : "";
        /* Vergangen → gespeicherte Übungen (kraft-tracking.js) */
        if (evW && (evW.category === "kraft" || evW.category === "ausdauer") && wIso && wIso < berlinToday() && global.GoKraftTracking) {
          var meW = me();
          GoKraftTracking.openDay({
            people: String(evW.user_id || meW) === meW ? [meW] : [String(evW.user_id), meW],
            iso: wIso,
            title: evW.title || ""
          });
          return;
        }
        /* Woche: Antippen startet nichts, sondern legt Ort, Uhrzeit und Privatsphäre fest */
        if (evW && findOwnEvent(evW.id) && evW.status !== "erledigt" && (!wIso || wIso >= berlinToday())) {
          openEventSettings(evW.id);
          return;
        }
      }
      if (
        state.editMode &&
        e.target &&
        !e.target.closest(".wr-edit-panel, .wr-top, .wr-sheet, .wr-undo, .wr-travel-banner")
      ) {
        exitEditMode();
      }
      return;
    }
    if (t.getAttribute("data-wr-sheet-close")) {
      closeSheet();
      return;
    }
    if (t.getAttribute("data-wr-zmode")) {
      var mode = t.getAttribute("data-wr-zmode");
      if (state.pendingCreate) state.pendingCreate.zMode = mode;
      var sheet = t.closest(".wr-sheet");
      if (sheet) {
        sheet.querySelectorAll("[data-wr-zmode]").forEach(function (b) {
          b.classList.toggle("is-on", b === t);
        });
      }
      return;
    }
    if (t.getAttribute("data-wr-zjoin")) {
      var zj = t.getAttribute("data-wr-zjoin");
      var wk = document.querySelector('[data-wr-zjoin-weekly="' + zj + '"]');
      t.disabled = true;
      joinZirkel(zj, !wk || wk.checked);
      return;
    }
    if (t.getAttribute("data-wr-zown")) {
      openZirkelOwnSheet();
      return;
    }
    if (t.getAttribute("data-wr-leave")) {
      leaveZirkel(t.getAttribute("data-wr-leave"));
      return;
    }
    if (t.getAttribute("data-wr-inv-yes") || t.getAttribute("data-wr-inv-no")) {
      var invYes = !!t.getAttribute("data-wr-inv-yes");
      t.disabled = true;
      answerInvite(t.getAttribute("data-wr-inv-yes") || t.getAttribute("data-wr-inv-no"), invYes)
        .then(function () { t.disabled = false; });
      return;
    }
    if (t.getAttribute("data-wr-zadmin")) {
      if (!global.GoZirkelSync) return;
      var zAct = t.getAttribute("data-wr-zadmin");
      var zAsk = zAct === "now" && global.GoDialog
        ? GoDialog.confirm("Jetzt für alle starten?", { ok: "Sofortstart" })
        : Promise.resolve(true);
      zAsk.then(function (yes) {
      if (!yes) return;
      t.disabled = true;
      GoZirkelSync.admin(t.getAttribute("data-id"), zAct)
        .then(function () {
          if (host.toast) host.toast(zAct === "now" ? "Start für alle in 10 s" : zAct === "go" ? "Countdown läuft" : "Countdown angehalten");
          return refreshKeepDay(berlinToday());
        })
        .catch(function () {
          t.disabled = false;
          if (host.toast) host.toast("Hat nicht geklappt");
        });
      });
      return;
    }
    if (t.getAttribute("data-wr-zirkel-next")) {
      if (!state.pendingCreate) return;
      var zRead = GoZirkelSetup.read(t.closest(".wr-sheet") || document);
      state.pendingCreate.zMode = zRead.mode;
      state.pendingCreate.zWork = zRead.workSec;
      state.pendingCreate.zPause = zRead.restSec;
      state.pendingCreate.zRounds = zRead.rounds;
      state.pendingCreate.zPartnerId = zRead.partnerId;
      state.pendingCreate.zPartnerName = zRead.partnerName;
      openCreateTimeSheet();
      return;
    }
    if (t.getAttribute("data-wr-travel")) {
      /* Drehrad statt Multiple-Choice; bei aktiver Reise: Abbruch-Menü */
      if (travelActive()) openTravelMenu();
      else openTravelSheet();
      return;
    }
    if (t.closest && t.closest("[data-wr-nutrition-open], [data-wr-nutrition]")) {
      var slideN = t.closest(".wr-slide");
      var dayN = slideN ? slideN.getAttribute("data-day") : currentDayIso();
      var evN = slideN ? slideN.getAttribute("data-event-id") : "";
      if (host && typeof host.openNutritionLogModal === "function") {
        host.openNutritionLogModal({ day: dayN, eventId: evN });
      } else if (typeof window.openNutritionLogModal === "function") {
        window.openNutritionLogModal({ day: dayN, eventId: evN });
      }
      return;
    }
    /* Woche ist Planung: gestartet wird in Aktuell. Nur „Online mitmachen“ öffnet das Workout. */
    if (t.getAttribute("data-wr-zirkel-go")) {
      var slideZ = t.closest(".wr-slide");
      var evZ = slideZ ? slideZ.getAttribute("data-event-id") : "";
      var evObjZ = (state.events || []).filter(function (e) {
        return String(e.id) === String(evZ);
      })[0];
      var presetZ = evObjZ ? parseZirkelNote(evObjZ.note) : null;
      if (presetZ) presetZ.eventId = String(evZ);
      if (host && typeof host.openZirkelWorkout === "function") {
        host.openZirkelWorkout(evZ, presetZ);
      } else if (host && typeof host.requireFfc === "function") {
        host.requireFfc(function () {
          if (window.FFC && FFC.openSetup) FFC.openSetup();
        });
      }
      return;
    }
    if (t.getAttribute("data-wr-end-travel")) {
      endTravel();
      return;
    }
    if (t.hasAttribute("data-wr-week")) {
      if (state.editMode || t.disabled) return;
      cycleWeekMode(Number(t.getAttribute("data-wr-week")));
      refresh();
      return;
    }
    if (t.getAttribute("data-wr-week-menu")) {
      if (state.editMode || t.disabled) return;
      openWeekMenu();
      return;
    }
    if (t.getAttribute("data-wr-set-mode")) {
      setWeekMode(t.getAttribute("data-wr-set-mode"));
      closeSheet();
      refresh();
      return;
    }
    if (t.getAttribute("data-wr-pick-plan")) {
      setTimeout(openPlanPicker, 0);
      return;
    }
    if (t.hasAttribute("data-wr-zrec")) {
      if (global.GoCircle && GoCircle.askBeforeOwn) GoCircle.askBeforeOwn(openZirkelRecurring); else openZirkelRecurring();
      return;
    }
    if (t.hasAttribute("data-wr-dsq")) {
      var dq = Number(t.getAttribute("data-wr-dsq"));
      var vt = $("wr-vtrack");
      if (dq >= 0 && dq <= 6 && dq !== state.dayIndex) {
        state.dayIndex = dq;
        state.eventIndex = 0;
        patchDaySquares();
        if (vt) vt.scrollTo({ top: scrollTopFor(vt, dq), behavior: "smooth" });
        patchDayLabel();
        patchTravelAlt();
        if (state.editMode) patchEditPanelEvRow();
        syncSurface();
      }
      return;
    }
    if (t.getAttribute("data-wr-cal")) {
      if (host && host.openCalendar) host.openCalendar();
      return;
    }
    if (t.getAttribute("data-wr-edit")) {
      /* Stift: mit Wochenplan → Wochenplan ändern oder Tage bearbeiten; ohne → Wochenplan wählen */
      if (state.editMode) {
        state.editMode = false;
        render();
        return;
      }
      var activeEn = (state.enrollments || []).filter(function (en) { return en && en.status === "aktiv"; });
      var hasPlan = activeEn.length > 0;
      if (global.GoDialog) {
        var planNames = activeEn.map(function (en) { return en.courses && en.courses.title; })
          .filter(function (tt) { return tt && !/^zirkeltraining$/i.test(tt); });
        var zDays = zirkelWeekdaysAhead();
        var items = hasPlan
          ? [{ label: "Wochenplan ändern", value: "plan" }, { label: "Tage bearbeiten", value: "days" }]
          : [{ label: "Wochenplan wählen", value: "plan" }];
        items.push({ info: "Zirkeltraining am: " + (zDays.length ? zDays.join(", ") : "–") });
        items.push({ label: "Zirkeltrainings eintragen", value: "zrec" });
        items.push({ label: "Zirkeltrainings bearbeiten", value: "zedit" });
        /* Gruppe: Mitglieder übernehmen Gruppen-Events, der Ersteller (Coach) trägt zusätzliche ein */
        var myGrp = host && host.myGroups ? (host.myGroups() || [])[0] : null;
        if (myGrp && String(myGrp.owner || "") !== me()) items.push({ label: "Gruppen-Events", value: "gev" });
        if (myGrp && String(myGrp.owner || "") === me()) items.push({ label: "zusätzliche Gruppen-Events", value: "gextra" });
        /* früher rechts am Bild: Einladen, Extern teilen, ics */
        var curIt = currentItem();
        var curEv = curIt && curIt.ev && !curIt.ev._pt && curIt.kind !== "ffc" ? curIt.ev : null;
        if (curEv) {
          items.push({ label: "Einladen", value: "share" });
          items.push({ label: "Extern teilen", value: "plane" });
        }
        items.push({ label: "Kalender exportieren (ics)", value: "ics" });
        GoDialog.choose("Deine Woche", items, {
          center: true,
          sub: planNames.length ? planNames.join(" · ") : "Kein Wochenplan"
        }).then(function (v) {
          /* erst nach dem Dialog-Klick öffnen, sonst schließt derselbe Klick das neue Sheet wieder */
          setTimeout(function () {
            if (v === "plan") openPlanPicker();
            if (v === "days") openDaysEditor();
            /* Mitglieder: vorher fragen, ob sie lieber das nächste Zirkeltraining ihres Circles übernehmen */
            if (v === "zrec") { if (global.GoCircle && GoCircle.askBeforeOwn) GoCircle.askBeforeOwn(openZirkelRecurring); else openZirkelRecurring(); }
            if (v === "zedit") openZirkelEditor();
            if (v === "gev") openGroupEventsPick();
            if (v === "gextra") openGroupExtras();
            if (v === "share" && curEv) openShareSheet(dayKey(curEv.starts_at), String(curEv.id));
            if (v === "plane" && curEv) shareExternal(dayKey(curEv.starts_at), String(curEv.id));
            if (v === "ics") exportWeekIcs();
          }, 0);
        });
        return;
      }
      openPlanPicker();
      return;
    }
    if (t.getAttribute("data-wr-add-kind")) {
      openKindSheet(t.getAttribute("data-wr-add-kind"), t.getAttribute("data-iso"));
      return;
    }
    if (t.getAttribute("data-wr-edit-kind")) {
      if (eventLocked(t.getAttribute("data-replace"))) return lockedToast();
      openKindSheet(
        t.getAttribute("data-wr-edit-kind"),
        t.getAttribute("data-iso"),
        t.getAttribute("data-replace")
      );
      return;
    }
    if (t.getAttribute("data-wr-pick-training")) {
      pickTraining(t);
      return;
    }
    if (t.getAttribute("data-wr-rest-pick")) {
      var input = $("wr-rest-title");
      if (input) input.value = t.getAttribute("data-wr-rest-pick");
      t.parentNode.querySelectorAll(".wr-chip").forEach(function (c) {
        c.classList.toggle("is-on", c === t);
      });
      return;
    }
    if (t.getAttribute("data-wr-rest-save")) {
      var isoR = t.getAttribute("data-wr-rest-save");
      var titleR = (($("wr-rest-title") && $("wr-rest-title").value) || "Bewegung").trim();
      state.pendingCreate = {
        kind: "alternative",
        iso: isoR,
        title: titleR,
        replaceId:
          t.getAttribute("data-replace") ||
          (state.pendingCreate && state.pendingCreate.replaceId) ||
          null
      };
      openCreateTimeSheet();
      return;
    }
    if (t.getAttribute("data-wr-create-confirm")) {
      confirmPendingCreate();
      return;
    }
    if (t.getAttribute("data-wr-travel-alt")) {
      openKindSheet("alternative", t.getAttribute("data-wr-travel-alt"));
      return;
    }
    if (t.getAttribute("data-wr-day-course")) {
      addCourseOnDay(
        t.getAttribute("data-wr-day-course"),
        t.getAttribute("data-iso")
      );
      return;
    }
    if (t.hasAttribute("data-wr-travel-pick")) {
      var daysPick = t.getAttribute("data-wr-travel-pick");
      var wheelT = $("wr-travel-wheel");
      if (wheelT) wheelT.setAttribute("data-days", daysPick);
      t.parentNode.querySelectorAll(".wr-time-opt").forEach(function (b) {
        b.classList.toggle("is-on", b === t);
      });
      t.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (t.hasAttribute("data-wr-travel-range")) {
      var rs = $("wr-travel-start");
      var re = $("wr-travel-end");
      var rStart = rs ? String(rs.value || "").slice(0, 10) : berlinToday();
      var rEnd = re ? String(re.value || "").slice(0, 10) : rStart;
      applyTravelRange(rStart, rEnd);
      return;
    }
    if (t.hasAttribute("data-wr-travel-go")) {
      var wheelGo = $("wr-travel-wheel");
      var attrDays = Number(t.getAttribute("data-wr-travel-go") || 0);
      var nDays = wheelGo
        ? Number(wheelGo.getAttribute("data-days") || 3)
        : attrDays || 3;
      applyTravel(Math.max(1, Math.min(TRAVEL_MAX_DAYS, nDays || 3)));
      return;
    }
    if (t.getAttribute("data-wr-book")) {
      loadCourses().then(function () {
        openBookSheet(1, { course: null, start: null, weekdays: [] });
      });
      return;
    }
    if (t.getAttribute("data-wr-pick-course")) {
      var cid = t.getAttribute("data-wr-pick-course");
      var course = state.courses.filter(function (c) {
        return String(c.id) === String(cid);
      })[0];
      openBookSheet(2, { course: course, start: null, weekdays: [] });
      return;
    }
    if (t.hasAttribute("data-wr-wd")) {
      var wd = Number(t.getAttribute("data-wr-wd"));
      var draft = state.bookDraft || { weekdays: [] };
      var ix = draft.weekdays.indexOf(wd);
      if (ix >= 0) draft.weekdays.splice(ix, 1);
      else draft.weekdays.push(wd);
      t.classList.toggle("is-on");
      return;
    }
    if (t.getAttribute("data-wr-book-step") === "3") {
      var d2 = state.bookDraft || {};
      var startEl = $("wr-start-date");
      if (startEl && startEl.value) d2.start = startEl.value;
      if (!d2.weekdays || !d2.weekdays.length) {
        if (host.toast) host.toast("Bitte Wochentage wählen");
        return;
      }
      openBookSheet(3, d2);
      return;
    }
    if (t.getAttribute("data-wr-book-confirm")) {
      if (state.bookDraft && state.bookDraft.retarget && state.bookDraft.enrollId) {
        retargetEnrollment();
        return;
      }
      bookCourse();
      return;
    }
    if (t.getAttribute("data-wr-delete")) {
      if (eventLocked(t.getAttribute("data-wr-delete"))) return lockedToast();
      confirmDeleteEvent(t.getAttribute("data-wr-delete"));
      return;
    }
    if (t.getAttribute("data-wr-delete-confirm")) {
      deleteEvent(t.getAttribute("data-wr-delete-confirm"));
      return;
    }
    if (t.getAttribute("data-wr-undo-go")) {
      undoDelete();
      return;
    }
    if (t.getAttribute("data-wr-zirkel-login")) {
      var zIso = t.getAttribute("data-wr-zirkel-login");
      var zRep = t.getAttribute("data-replace") || null;
      closeSheet();
      if (host && typeof host.requireFfc === "function") {
        host.requireFfc(function () {
          state.zirkelOk = true;
          openKindSheet("zirkel", zIso, zRep);
        });
      }
      return;
    }
    if (t.getAttribute("data-wr-edit-place")) {
      openPlaceSheet(t.getAttribute("data-wr-edit-place"));
      return;
    }
    if (t.getAttribute("data-wr-place-save")) {
      saveEventPlace(t.getAttribute("data-wr-place-save"));
      return;
    }
    if (t.getAttribute("data-wr-edit-day")) {
      openDaySheet(t.getAttribute("data-wr-edit-day"));
      return;
    }
    if (t.getAttribute("data-wr-day-move")) {
      moveEventToDay(t.getAttribute("data-wr-day-move"), t.getAttribute("data-day"));
      return;
    }
    if (t.getAttribute("data-wr-edit-time")) {
      openTimeSheet(t.getAttribute("data-wr-edit-time"));
      return;
    }
    if (t.hasAttribute("data-wr-time-h") || t.hasAttribute("data-wr-time-m")) {
      var wheel = $("wr-time-wheel");
      if (!wheel) return;
      if (t.hasAttribute("data-wr-time-h")) {
        wheel.setAttribute("data-h", t.getAttribute("data-wr-time-h"));
        t.parentNode.querySelectorAll(".wr-time-opt").forEach(function (b) {
          b.classList.toggle("is-on", b === t);
        });
      } else {
        wheel.setAttribute("data-m", t.getAttribute("data-wr-time-m"));
        t.parentNode.querySelectorAll(".wr-time-opt").forEach(function (b) {
          b.classList.toggle("is-on", b === t);
        });
      }
      t.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (t.getAttribute("data-wr-time-save")) {
      saveEventTime(t.getAttribute("data-wr-time-save"));
      return;
    }
    if (t.getAttribute("data-wr-swap")) {
      if (eventLocked(t.getAttribute("data-wr-swap"))) return lockedToast();
      swapToHotel(t.getAttribute("data-wr-swap"));
      return;
    }
    if (t.getAttribute("data-wr-share")) {
      openShareSheet(
        t.getAttribute("data-wr-share"),
        t.getAttribute("data-wr-event")
      );
      return;
    }
    if (t.hasAttribute("data-wr-friend-req")) {
      answerShareRequest(t.getAttribute("data-wr-friend-req"));
      return;
    }
    if (t.hasAttribute("data-wr-friend-pick")) {
      var fidPick = t.getAttribute("data-wr-friend-pick");
      var boxPick = t.querySelector ? t.querySelector("input[type=checkbox]") : null;
      /* native toggle already happened on label click */
      state.sharePick[fidPick] = boxPick ? !!boxPick.checked : !state.sharePick[fidPick];
      return;
    }
    if (t.hasAttribute("data-wr-group-pick")) {
      var gp = ((host && host.myGroups ? host.myGroups() : []) || []).filter(function (g) { return String(g.id) === t.getAttribute("data-wr-group-pick"); })[0];
      if (gp) {
        var gKey = String(gp.id);
        var gOn = !state.shareGroupPick[gKey];
        state.shareGroupPick[gKey] = gOn;
        /* Mitglieder, die Freunde sind, gleich mit an- bzw. abhaken */
        (gp.members || []).map(String).forEach(function (m) {
          if ((state.friends || []).indexOf(m) >= 0 && !state.shareInvited[m]) state.sharePick[m] = gOn;
        });
        if (state.sharePaint) state.sharePaint();
      }
      return;
    }
    if (t.hasAttribute("data-wr-circle-pick")) {
      var cg = t.getAttribute("data-wr-circle-pick");
      state.shareCirclePick[cg] = !state.shareCirclePick[cg];
      if (state.sharePaint) state.sharePaint();
      return;
    }
    if (t.getAttribute("data-wr-invite-friends")) {
      var circlesPicked = Object.keys(state.shareCirclePick || {}).filter(function (k) { return state.shareCirclePick[k]; });
      circlesPicked.forEach(function (gid) { shareToCircle(state.shareEventId, gid); });
      var groupsPicked = Object.keys(state.shareGroupPick || {}).filter(function (k) { return state.shareGroupPick[k]; });
      if (groupsPicked.length) shareToGroup(state.shareEventId, state.shareIso, groupsPicked[0]);
      if (Object.keys(state.sharePick || {}).some(function (k) { return state.sharePick[k]; })) inviteFriendsSelected();
      else if (circlesPicked.length || groupsPicked.length) closeSheet();
      return;
    }
    if (t.hasAttribute("data-wr-plane")) {
      var pIso = t.getAttribute("data-wr-plane"), pEv = t.getAttribute("data-wr-event");
      var askP = global.GoDialog ? GoDialog.confirm("Extern Event teilen", { ok: "Teilen", cancel: "Abbrechen" }) : Promise.resolve(true);
      askP.then(function (yes) { if (yes) shareExternal(pIso, pEv); });
      return;
    }
    if (t.hasAttribute("data-wr-ics")) {
      var askI = global.GoDialog ? GoDialog.confirm("Deine gogogo-woche.ics für den Kalender exportieren", { ok: "Export", cancel: "Abbrechen" }) : Promise.resolve(true);
      askI.then(function (yes) { if (yes) exportWeekIcs(); });
      return;
    }
    if (t.getAttribute("data-wr-share-ext")) {
      shareExternal(state.shareIso, state.shareEventId);
      return;
    }
    if (t.getAttribute("data-wr-share-circle")) {
      shareToCircle(state.shareEventId);
      return;
    }
    if (t.getAttribute("data-wr-csv")) {
      exportWeekCsv();
      return;
    }
    if (t.getAttribute("data-wr-done")) {
      var doneId = t.getAttribute("data-wr-done");
      /* Plan-Ghost materialisieren, dann Erledigt-Dialog */
      function openDone(id) {
        if (host && typeof host.openDoneModal === "function") {
          host.openDoneModal(id);
        } else if (host && typeof host.showHeute === "function") {
          host.showHeute();
        }
      }
      if (String(doneId).indexOf("plan:") === 0) {
        var planIso = String(doneId).slice(5);
        var ghost = itemsForDay(planIso).filter(function (it) {
          return it && it._fromPlan && it.ev;
        })[0];
        var pev = ghost && ghost.ev;
        if (!pev) return;
        createEvent({
          category: pev.category || "alternative",
          title: pev.title || "Bewegung",
          starts_at: pev.starts_at,
          course_id: pev.course_id || null,
          is_unplanned: false,
          item_type: pev.item_type || "event",
          travel_auto: false
        })
          .then(function (rows) {
            var created = Array.isArray(rows) ? rows[0] : rows;
            return refreshKeepDay(planIso).then(function () {
              if (created && created.id) openDone(created.id);
            });
          })
          .catch(function () {
            if (host.toast) host.toast("Event konnte nicht angelegt werden");
          });
        return;
      }
      openDone(doneId);
      return;
    }
    if (t.getAttribute("data-wr-rsvp")) {
      toggleRsvp(t.getAttribute("data-wr-rsvp"));
      return;
    }
    if (t.getAttribute("data-wr-ffc-rsvp")) {
      if (global.FFC && FFC.toggleGoing) {
        Promise.resolve(FFC.toggleGoing(t.getAttribute("data-wr-ffc-rsvp"))).then(refresh);
      }
      return;
    }
    if (t.getAttribute("data-wr-comments")) {
      openComments(t.getAttribute("data-wr-comments"));
      return;
    }
    if (t.getAttribute("data-wr-coach-wa")) {
      if (host.openCoachWhatsApp) {
        host.openCoachWhatsApp(
          "Kurs: " + t.getAttribute("data-course") + " · Start: " + t.getAttribute("data-start")
        );
      }
      return;
    }
    if (t.getAttribute("data-wr-enroll-menu")) {
      openEnrollMenu(t.getAttribute("data-wr-enroll-menu"));
      return;
    }
    if (t.getAttribute("data-wr-enroll-end")) {
      rest("enrollments?id=eq." + encodeURIComponent(t.getAttribute("data-wr-enroll-end")), {
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: "beendet" }
      }).then(function () {
        closeSheet();
        return refresh();
      });
      return;
    }
    if (t.getAttribute("data-wr-enroll-pause")) {
      /* Pause = status angefragt (kein Generator), künftige Events bleiben bis Coach reaktiviert */
      rest("enrollments?id=eq." + encodeURIComponent(t.getAttribute("data-wr-enroll-pause")), {
        method: "PATCH",
        prefer: "return=minimal",
        body: { status: "angefragt" }
      }).then(function () {
        closeSheet();
        return refresh();
      });
      return;
    }
    if (t.getAttribute("data-wr-enroll-days")) {
      var enId = t.getAttribute("data-wr-enroll-days");
      var en = state.enrollments.filter(function (e) {
        return String(e.id) === String(enId);
      })[0];
      if (!en) return;
      state.bookDraft = {
        course: en.courses || { id: en.course_id, title: "Kurs", sessions_per_week: 3 },
        start: en.start_date || mondayOf(berlinToday()),
        weekdays: (en.weekdays || []).slice(),
        enrollId: enId,
        retarget: true
      };
      openBookSheet(2, state.bookDraft);
      return;
    }
    if (t.getAttribute("data-wr-more")) {
      var pMore = t.closest(".wr-place");
      if (pMore) {
        var full = pMore.getAttribute("data-full") || "";
        if (full) pMore.textContent = full;
        else t.remove();
      }
      return;
    }
  }

  function openEnrollMenu(enrollId) {
    openSheet(
      "<h3>Kurs</h3>" +
        '<button type="button" class="wr-pill-btn" data-wr-enroll-days="' +
        esc(enrollId) +
        '">Tage ändern</button>' +
        '<button type="button" class="wr-pill-btn" data-wr-enroll-pause="' +
        esc(enrollId) +
        '">Pausieren</button>' +
        '<button type="button" class="wr-pill-btn" data-wr-enroll-end="' +
        esc(enrollId) +
        '">Beenden</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
  }

  function openComments(eventId) {
    var list = state.comments[eventId] || [];
    var body = list
      .map(function (c) {
        var p = personOf(c.account_id);
        return (
          '<div class="wr-comment"><strong>' +
          esc(p.name) +
          "</strong> " +
          esc(c.text || "") +
          "</div>"
        );
      })
      .join("");
    openSheet(
      "<h3>Kommentare</h3>" +
        '<div class="wr-comment-list">' +
        (body || "<p>Noch keine Kommentare.</p>") +
        "</div>" +
        '<form class="wr-comment-form" data-wr-comment-form="' +
        esc(eventId) +
        '"><input type="text" maxlength="500" placeholder="Kommentieren" /><button type="submit">Senden</button></form>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Schließen</button>'
    );
  }

  function toggleRsvp(eventId) {
    var uid = me();
    var list = state.rsvps[eventId] || [];
    var going = list.indexOf(uid) >= 0;
    if (going) {
      return rest(
        "event_rsvps?event_id=eq." +
          encodeURIComponent(eventId) +
          "&user_id=eq." +
          encodeURIComponent(uid),
        { method: "DELETE", prefer: "return=minimal" }
      ).then(refresh);
    }
    return rest("event_rsvps", {
      method: "POST",
      prefer: "return=minimal",
      body: { event_id: eventId, user_id: uid, status: "zugesagt" }
    }).then(refresh);
  }

  function onSubmit(e) {
    var form = e.target && e.target.closest ? e.target.closest("[data-wr-comment-form]") : null;
    if (!form) return;
    e.preventDefault();
    var eventId = form.getAttribute("data-wr-comment-form");
    var input = form.querySelector("input");
    var text = input ? String(input.value || "").trim() : "";
    if (!text) return;
    rest("event_comments", {
      method: "POST",
      prefer: "return=minimal",
      body: { event_id: eventId, account_id: me(), text: text.slice(0, 500) }
    })
      .catch(function () {
        return saveCommentFallback(eventId, text.slice(0, 500));
      })
      .then(function () {
        if (input) input.value = "";
        return loadComments([eventId]).then(function () {
          openComments(eventId);
        });
      });
  }

  function bindSwipe(root) {
    var track = null;
    root.addEventListener(
      "touchstart",
      function (e) {
        if (!e.touches || !e.touches[0]) return;
        if (e.target.closest && e.target.closest(".wr-sheet, .wr-time-col, .wr-edit-panel")) return;
        track = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          day: state.dayIndex
        };
      },
      { passive: true }
    );
    root.addEventListener(
      "touchend",
      function (e) {
        if (!track || !e.changedTouches || !e.changedTouches[0]) return;
        var dx = e.changedTouches[0].clientX - track.x;
        var dy = e.changedTouches[0].clientY - track.y;
        var vtrack = $("wr-vtrack");
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 48) {
          if (state.editMode) {
            track = null;
            return;
          }
          /* Zukunft oben: Finger nach unten holt den nächsten Tag */
          if (dy > 0 && state.dayIndex < 6) state.dayIndex += 1;
          if (dy < 0 && state.dayIndex > 0) state.dayIndex -= 1;
          patchDaySquares();
          if (vtrack) {
            vtrack.scrollTo({
              top: scrollTopFor(vtrack, state.dayIndex),
              behavior: "smooth"
            });
          }
          syncSurface();
        } else if (Math.abs(dx) > 48) {
          var dayEl = dayElAt(state.dayIndex);
          if (dayEl) {
            var h = dayEl.querySelector(".wr-htrack");
            if (h) {
              var w = h.clientWidth;
              var cur = Math.round(h.scrollLeft / Math.max(w, 1));
              var next = dx < 0 ? cur + 1 : cur - 1;
              var max = h.querySelectorAll(".wr-slide").length - 1;
              next = Math.max(0, Math.min(max, next));
              h.scrollTo({ left: next * w, behavior: "smooth" });
              state.eventIndex = next;
              var dots = dayEl.querySelectorAll(".wr-dot");
              dots.forEach(function (d, i) {
                d.classList.toggle("is-on", i === next);
              });
              patchTravelAlt();
              if (state.editMode) patchEditPanelEvRow();
            }
          }
        }
        track = null;
      },
      { passive: true }
    );
  }

  function patchEditPanelEvRow() {
    var panel = document.querySelector("#" + ROOT_ID + " .wr-edit-panel");
    if (!panel || !state.editMode) return;
    var html = editPanelHtml();
    if (html) panel.outerHTML = html;
    else panel.remove();
  }

  function syncDayFromScroll() {
    var vtrack = $("wr-vtrack");
    if (!vtrack || !vtrack.clientHeight) return;
    var next = ixFromScroll(vtrack);
    if (next !== state.dayIndex) {
      state.dayIndex = next;
      state.eventIndex = 0;
      patchDaySquares();
      patchDayLabel();
      patchTravelAlt();
      if (state.editMode) patchEditPanelEvRow();
      syncSurface();
    } else {
      patchDayLabel();
      patchTravelAlt();
    }
  }

  function refresh() {
    if (!host || !me()) {
      state.loadError = "Nicht angemeldet.";
      render();
      return Promise.resolve();
    }
    loadTravelPref();
    state.loadError = "";
    return Promise.all([
      loadEvents().catch(function () {
        state.loadError = "Events konnten nicht geladen werden.";
      }),
      loadFfc().catch(function () {}),
      loadEnrollments().catch(function () {}),
      loadCourses().catch(function () {}),
      loadTrainingLists().catch(function () {}),
      loadInvites().catch(function () {}),
      loadRecent().catch(function () {}),
      loadSeriesKeys().catch(function () {}),
      Promise.resolve(host && host.ptPeopleIds ? host.ptPeopleIds() : []).then(ensurePeople).catch(function () {})
    ])
      .then(function () {
        syncZirkelAccess();
        var ids = (state.events || []).map(function (e) {
          return String(e.id);
        });
        return Promise.all([
          loadRsvps(ids).catch(function () {}),
          loadComments(ids).catch(function () {})
        ]);
      })
      .catch(function () {
        state.loadError = state.loadError || "Woche teilweise nicht geladen.";
      })
      .then(function () {
        render();
      });
  }

  function refreshKeepDay(iso) {
    var keep = iso || currentDayIso();
    return refresh().then(function () {
      try {
        var days = weekDays();
        var ix = days.indexOf(keep);
        if (ix >= 0) state.dayIndex = ix;
      } catch (e) {}
      var track = $("wr-vtrack");
      if (track && track.clientHeight) {
        track.scrollTop = scrollTopFor(track, state.dayIndex);
      }
      patchDaySquares();
      patchDayLabel();
      patchTravelAlt();
      syncSurface();
    });
  }

  function show() {
    var root = $(ROOT_ID);
    if (root) root.hidden = false;
    document.body.classList.add("is-woche-reels");
    /* Sofort 7 Tageskarten — nie leerer Screen während Load */
    try {
      if (state.weekMode === "from_today") state.dayIndex = 0;
      if (state.armEdit) {
        state.editMode = true;
        state.armEdit = false;
      }
      render();
    } catch (eShow) {
      state.loadError = "Woche konnte nicht gezeichnet werden.";
      try {
        render();
      } catch (e2) {}
    }
    var armedTravel = !!state.armTravel;
    state.armTravel = false;
    return Promise.all([
      loadCourses().catch(function () {}),
      loadTrainingLists().catch(function () {}),
      refresh()
    ]).then(function () {
      if (armedTravel) {
        try {
          if (travelActive()) openTravelMenu();
          else openTravelSheet();
        } catch (eT) {}
      }
    });
  }

  function armTravel() {
    state.armTravel = true;
  }

  function armEdit() {
    state.armEdit = true;
  }

  function hide() {
    var root = $(ROOT_ID);
    if (root) root.hidden = true;
    document.body.classList.remove("is-woche-reels");
    closeSheet();
  }

  function install(h) {
    host = h || host || {};
    var root = $(ROOT_ID);
    if (!root) return;
    if (!root._wrBound) {
      root._wrBound = true;
      root.addEventListener("click", onRootClick);
      root.addEventListener("change", function (e) {
        var sel = e.target && e.target.closest ? e.target.closest("select[data-wr-week-select]") : null;
        if (!sel || state.editMode) return;
        setWeekMode(sel.value);
        refresh();
      });
      root.addEventListener("submit", onSubmit);
      bindSwipe(root);
      root.addEventListener(
        "scroll",
        function (e) {
          if (e.target && e.target.id === "wr-vtrack") syncDayFromScroll();
        },
        true
      );
    }
  }

  global.WocheReels = {
    refreshKeepDay: refreshKeepDay,
    shareToCircle: function (id, gid) { return shareToCircle(id, gid); },
    openZirkelRecurring: function () { openZirkelRecurring(); },
    openPlanPicker: function () { openPlanPicker(); },
    install: install,
    show: show,
    hide: hide,
    refresh: refresh,
    loadInvites: loadInvites,
    armTravel: armTravel,
    armEdit: armEdit,
    dayNeedsTravelAlt: dayNeedsTravelAlt,
    endTravel: endTravel,
    applyTravelRange: applyTravelRange,
    dayIndex: function () {
      return state.dayIndex;
    }
  };
})(window);
