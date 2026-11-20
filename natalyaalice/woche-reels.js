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
    '<svg class="wr-ico" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="M8 7l4-4 4 4"/><path d="M5 14v4.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V14"/></svg>';

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
    if (now < gate.getTime()) {
      return '<p class="wr-zirkel-cd">ab 7:00</p>';
    }
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

  function itemsForDay(iso) {
    var list = [];
    state.events.forEach(function (ev) {
      if (dayKey(ev.starts_at) === iso && ev.status !== "ausgefallen") {
        list.push({ kind: "event", starts_at: ev.starts_at, ev: ev });
      }
    });
    state.ffcEvents.forEach(function (ev) {
      if (dayKey(ev.starts_at) === iso) {
        list.push({ kind: "ffc", starts_at: ev.starts_at, ev: ev });
      }
    });
    (state.joined || []).forEach(function (ev) {
      if (dayKey(ev.starts_at) === iso) list.push({ kind: "joined", starts_at: ev.starts_at, ev: ev });
    });
    (state.invited || []).forEach(function (ev) {
      if (dayKey(ev.starts_at) === iso) list.push({ kind: "invited", starts_at: ev.starts_at, ev: ev });
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
    return (state.rsvps[String(ev && ev.id)] || []).filter(function (id) {
      return id && id !== owner;
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
    if (!item || !item.ev) return "";
    var ev = item.ev;
    var id = String(ev.id);
    var mine = item.kind !== "ffc" && String(ev.user_id) === me();
    var today = berlinToday() === dayKey(ev.starts_at);
    /* Woche ist Planung: kein Abhaken, kein Kommentieren (beides in Aktuell). Nur Einladen/Teilen. */
    return (
      '<div class="wr-actions">' +
      '<button type="button" class="wr-act" data-wr-share="' +
      esc(dayKey(ev.starts_at)) +
      '" data-wr-event="' +
      esc(id) +
      '" aria-label="Teilen"><span class="wr-act__icon">' +
      ICON_SHARE +
      '</span><span class="wr-act__n"></span></button>' +
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
      '<p class="wr-empty-title">Noch nichts geplant</p>' +
      '<div class="wr-empty-btns wr-empty-btns--grid">' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-add-kind="kraft" data-iso="' +
      esc(iso) +
      '">Kraft</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-add-kind="ausdauer" data-iso="' +
      esc(iso) +
      '">Ausdauer</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-add-kind="alternative" data-iso="' +
      esc(iso) +
      '">Sonstiges</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-add-kind="zirkel" data-iso="' +
      esc(iso) +
      '">Zirkeltraining</button>' +
      "</div></div></div></div>"
    );
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
        (notePack.more
          ? ' <button type="button" class="wr-more" data-wr-more="1">mehr</button>'
          : "") +
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
      (isNutrition ? ' data-wr-nutrition="1"' : "") +
      (isZirkel ? ' data-wr-zirkel-open="1"' : "") +
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
      '<div class="wr-bottom__main"' +
      (isNutrition ? ' data-wr-nutrition-open="1"' : "") +
      (isZirkel ? ' data-wr-zirkel-open="1"' : "") +
      ">" +
      '<div class="wr-author">' +
      avatarHtml(p) +
      inviteAvatarsHtml(iso) +
      "</div>" +
      (when || place
        ? '<p class="wr-when">' + (ev.bubble_id && global.GoBubbles ? '<span class="wr-when__bub" title="Bubble">' + GoBubbles.SOAP_SVG + "</span>" : "") +
          esc([when, place].filter(Boolean).join(" · ")) + "</p>"
        : "") +
      /* Countdown und „Start anhalten“ nebeneinander als gleiche Pillen */
      (cd || zirkelAdminHtml(ev, zSet, iso) ? '<div class="wr-zrow">' + cd + zirkelAdminHtml(ev, zSet, iso) + "</div>" : "") +
      '<h2 class="wr-title">' +
      esc(title) +
      "</h2>" +
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
      (going
        ? '<div class="wr-going">' + facesHtml(ev) + "</div>"
        : "") +
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
    var list = (state.invites || []).filter(function (inv) {
      if (!inv || String(inv.workout_date) !== String(iso)) return false;
      var st = String(inv.status || "pending");
      return st === "pending" || st === "accepted";
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
    var dayLabel = formatDayLong(dayIso);
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
      '<div class="wr-week-nav">' +
      '<button type="button" class="wr-week-label" data-wr-week-menu="1"' +
      (state.editMode ? " disabled" : "") +
      '><span class="wr-week-label__text">' +
      esc(label) +
      '</span><svg class="wr-week-label__chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
      "</div>" +
      '<button type="button" class="wr-icon-btn' +
      (state.editMode ? " is-on" : "") +
      '" data-wr-edit="1" aria-label="Bearbeiten">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L18 10l-4-4L4 16v4zM13 7l4 4"/></svg>' +
      "</button>" +
      "</div>" +
      '<p class="wr-day-label">' +
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
    var ix = Math.max(0, Math.min(track.children.length - 1, state.dayIndex));
    var day = track.children[ix];
    return day.querySelector ? day.querySelector(".wr-media") : null;
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
    var el = document.querySelector("#" + ROOT_ID + " .wr-day-label");
    if (!el) return;
    el.textContent = formatDayLong(currentDayIso());
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
  function openZirkelRecurring() {
    /* aktuelle Verteilung aus den nächsten 7 Tagen (eigene Plan-Einheiten) */
    var byWd = {};
    for (var i = 0; i < 7; i++) {
      var iso = addDays(berlinToday(), i);
      var wd = new Date(iso + "T12:00:00").getDay();
      var ev = state.events.filter(function (e) {
        return e && String(e.user_id) === me() && e.status !== "ausgefallen" && e.item_type !== "support_session" && dayKey(e.starts_at) === iso;
      })[0];
      byWd[wd] = ev ? ev.title || "" : "";
    }
    openSheet(
      '<p class="wr-sheet-title">Zirkeltraining wiederkehrend</p>' +
      '<p class="wr-sheet-hint">Wähle einen Tag für Dein Zirkeltraining</p>' +
      '<div class="wr-days">' + WD_ORDER.map(function (wd) {
        return '<button type="button" class="wr-dayrow wr-zrec-day" data-wr-zrec-day="' + wd + '"><b>' + WD_NAME[wd].slice(0, 2) + '</b>' +
          '<span class="wr-dayrow__title">' + esc(byWd[wd] || "frei") + "</span><span></span></button>";
      }).join("") + "</div>" +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button></div>'
    );
    var card = $("wr-sheet-card");
    if (!card || card._wrZrecBound) return;
    card._wrZrecBound = true;
    card.addEventListener("click", function (e) {
      /* Inhalt wird neu gezeichnet: Klick nicht weiterreichen (sonst gilt er als „außerhalb“ und schließt das Sheet) */
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
  }
  function openZrecDay(wd) {
    state.zrec = { wd: wd, time: "18:00", vis: "team", friends: [], circle: null, mode: "extra" };
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
      '<div class="wr-set-vis wr-zrec-mode" role="radiogroup" aria-label="Zusätzlich oder Alternativ">' +
      '<button type="button" class="wr-set-vis__btn' + (z.mode === "alt" ? "" : " is-on") + '" data-wr-zrec="mode-extra" role="radio" aria-checked="' + (z.mode !== "alt") + '">Zusätzlich</button>' +
      '<button type="button" class="wr-set-vis__btn' + (z.mode === "alt" ? " is-on" : "") + '" data-wr-zrec="mode-alt" role="radio" aria-checked="' + (z.mode === "alt") + '">Alternativ</button></div>' +
      '<p class="wr-sheet-hint">' + (z.mode === "alt" ? "Ersetzt die Einheit aus Deinem Wochenplan an diesem Tag." : "Kommt zur Einheit aus Deinem Wochenplan dazu.") + "</p>" +
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
      if (!(groups || []).length) { GoDialog.alert("Du bist noch in keinem Circle. Unter Plus → FFC → Deine Circle verwalten."); return; }
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
        if (ev.is_mine) {
          /* Circle-Termin (Zirkel-App) immer als eigene Zeile, damit er einzeln gelöscht werden kann */
          rows.push({ key: "ffc:" + ev.id, kind: "ffcOwn", ev: ev, at: ev.starts_at, title: ev.title || "Zirkeltraining" });
        } else if (ev.my_going === true) {
          rows.push({ key: "ffc:" + ev.id, kind: "ffcJoined", ev: ev, at: ev.starts_at, title: ev.title || "Zirkeltraining", who: ev.creator_nickname || "" });
        }
      });
      rows.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
      state.zEdit = { rows: rows, times: {}, vis: {}, orig: {}, ownFfc: ffcEvs.filter(function (e) { return e.is_mine; }) };
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
    var rows = ze.rows.map(function (x, i) {
      var d = new Date(dayKey(x.at) + "T12:00:00");
      var label = DAYS_DE[d.getDay()] + " " + d.getDate() + ".";
      var title = esc(x.title) + (x.who ? ' <span class="wr-dayrow__who">· ' + esc(String(x.who).split(" ")[0]) + "</span>" : "");
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
      return '<div class="wr-dayrow"><b>' + label + "</b>" +
        '<div class="wr-dayrow__mid"><span class="wr-dayrow__title">' + title + "</span>" +
        '<div class="wr-dayrow__ctl">' + ctl + "</div></div>" +
        '<button type="button" class="wr-dayrow__pen" data-wr-zpen="' + i + '" aria-label="Bearbeiten">' + PEN_SVG + "</button></div>";
    }).join("");
    openSheet(
      '<p class="wr-sheet-title">Zirkeltrainings bearbeiten</p>' +
      (rows ? '<div class="wr-days wr-days--all">' + rows + "</div>" :
        '<p class="wr-sheet-hint">Diese Woche ist kein Zirkeltraining geplant.</p>') +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">' + (rows ? "Abbrechen" : "Schließen") + "</button>" +
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
      }));
    });
    Promise.all(jobs).then(function () {
      showSavedNote();
      return refresh().then(notifyAktuell);
    }).catch(function () { if (host.toast) host.toast("Hat nicht geklappt"); });
  }

  function openDaysEditor() {
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(berlinToday(), i));
    var slots = days.map(function (iso) {
      /* je Tag die Einheit aus dem Wochenplan; Termine wie Initialgespräch (support_session) verdrängen sie nicht */
      return state.events.filter(function (e) {
        return e && String(e.user_id) === me() && e.status !== "erledigt" && e.status !== "ausgefallen" &&
          e.item_type !== "support_session" && dayKey(e.starts_at) === iso;
      }).sort(function (a, b) {
        var pa = a.enrollment_id || a.course_id ? 0 : 1;
        var pb = b.enrollment_id || b.course_id ? 0 : 1;
        return pa - pb || String(a.starts_at).localeCompare(String(b.starts_at));
      })[0] || null;
    });
    state.daysEdit = { days: days, slots: slots, times: {}, vis: {}, orig: {}, bub: {} };
    slots.forEach(function (ev) {
      if (!ev) return;
      state.daysEdit.times[ev.id] = displayTime(ev.starts_at) ? formatTime(ev.starts_at) : NO_TIME;
      state.daysEdit.vis[ev.id] = ev.visibility === "privat" ? "privat" : "team";
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
        return '<div class="wr-dayrow is-empty" data-wr-dayslot="' + i + '"><b>' + label + '</b><span class="wr-dayrow__free">frei</span><span></span></div>';
      }
      var opts = timeOptsFor(de.times[ev.id]);
      var ti = Math.max(0, opts.indexOf(de.times[ev.id]));
      var vis = de.vis[ev.id];
      return '<div class="wr-dayrow" data-wr-dayslot="' + i + '"><b>' + label + "</b>" +
        '<div class="wr-dayrow__mid"><span class="wr-dayrow__title">' + esc(ev.title || "Training") + "</span>" +
        '<div class="wr-dayrow__ctl"><div class="wr-mini-wheel" data-wr-mini="' + esc(ev.id) + '" data-idx="' + ti + '">' +
        opts.map(function (t) { return '<span class="wr-mini-opt">' + t + "</span>"; }).join("") + "</div>" +
        '<button type="button" class="wr-dayrow__vis' + (vis === "privat" ? "" : " is-on") + '" data-wr-dayvis="' + esc(ev.id) + '">' + (vis === "privat" ? "privat" : "zeigen") + "</button>" +
        '<button type="button" class="wr-dayrow__vis" data-wr-daymedia="' + esc(ev.id) + '">Media</button>' +
        (host.bubbleId && host.bubbleId()
          ? '<button type="button" class="wr-dayrow__vis wr-dayrow__bub' + (state.daysEdit.bub[ev.id] ? " is-on" : "") + '" data-wr-daybub="' + esc(ev.id) + '" aria-pressed="' + (state.daysEdit.bub[ev.id] ? "true" : "false") + '">' +
            (global.GoBubbles ? GoBubbles.SOAP_SVG : "") + "Bubble</button>"
          : "") +
        "</div></div>" +
        '<span class="wr-dayrow__grip" data-wr-grip="' + i + '" aria-label="Ziehen"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span></div>';
    }).join("");
    openSheet(
      '<p class="wr-sheet-title">Tage bearbeiten</p>' +
      '<p class="wr-sheet-hint">Du kannst Einheiten in den Tagen verschieben, Uhrzeit anpassen, privat/zeigen wählen, um zu entscheiden, ob Freunde es sehen dürfen.</p>' +
      '<div class="wr-days wr-days--all">' + rows + "</div>" +
      '<div class="wr-btnrow"><button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>' +
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
    card.addEventListener("click", function (e) {
      if (!state.daysEdit) return;
      var vb = e.target.closest && e.target.closest("[data-wr-dayvis]");
      if (vb) {
        var id = vb.getAttribute("data-wr-dayvis");
        var nv = state.daysEdit.vis[id] === "privat" ? "team" : "privat";
        state.daysEdit.vis[id] = nv;
        vb.classList.toggle("is-on", nv === "team");
        vb.textContent = nv === "privat" ? "privat" : "zeigen";
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
    var d = new Date(ev.starts_at);
    openSheet(
      '<p class="wr-sheet-title">Media</p>' +
      '<p class="wr-sheet-hint">' + esc((ev.title || "Training") + " · " + DAYS_DE[d.getDay()] + " " + d.getDate() + ".") + "</p>" +
      '<div class="wr-share-block"><h4>Eventbild</h4>' +
      '<div class="wr-media-prev">' + (photo ? '<img src="' + esc(photo) + '" alt="" />' : "<span>Kein eigenes Bild</span>") + "</div>" +
      '<div class="wr-media-acts">' +
      '<label class="wr-dayrow__vis">' + (photo ? "Foto ändern" : "Foto wählen") + '<input type="file" accept="image/*" data-wr-media-file="event" hidden /></label>' +
      (photo ? '<button type="button" class="wr-dayrow__vis" data-wr-media-del="event">Entfernen</button>' : "") +
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
      if (global.GoDialog) GoDialog.alert(msg); else if (host.toast) host.toast(msg);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      var m = String((err && err.message) || "");
      if (host.toast) host.toast(/duplicate|23505/.test(m) ? "Diesen Link gibt es bei der Übung schon" : m || "Speichern ging gerade nicht");
    });
  }

  function saveEventPhoto(url) {
    var ev = mediaEvent();
    if (!ev) return Promise.resolve();
    return rest("events?id=eq." + encodeURIComponent(ev.id) + "&user_id=eq." + encodeURIComponent(me()), {
      method: "PATCH", prefer: "return=minimal", body: { photo_url: url || null }
    }).then(function () {
      ev.photo_url = url || null;
      state.mediaDirty = true;
      paintMediaSheet();
      if (host.toast) host.toast(url ? "Eventbild gespeichert" : "Eventbild entfernt");
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

  function saveDaysEditor() {
    var de = state.daysEdit;
    if (!de) return;
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
      var wantBub = !!(de.bub && de.bub[ev.id]);
      var bubId = host.bubbleId ? host.bubbleId() : "";
      var bubChanged = wantBub !== !!ev.bubble_id && (!!bubId || !wantBub);
      if (sameDay && (ev.visibility || "team") === vis && !bubChanged) return;
      var body = { starts_at: starts, visibility: vis };
      if (bubChanged) body.bubble_id = wantBub ? bubId : null;
      jobs.push(materializeEvent(ev).then(function (real) {
        return rest("events?id=eq." + encodeURIComponent(real.id), {
          method: "PATCH", prefer: "return=minimal", body: body
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
    }).catch(function () {
      if (saveBtn) saveBtn.disabled = false;
      if (host.toast) host.toast("Speichern ging nicht");
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
        .map(function (iso) {
          try {
            return dayReelHtml(iso);
          } catch (eDay) {
            return emptyCardHtml(iso);
          }
        })
        .join("") +
      "</div>" +
      progressHtml() +
      sheetHtml();
    /* Gleicher Inhalt wie zuletzt: DOM stehen lassen (sonst blitzt die Woche beim Öffnen,
       weil show() sofort zeichnet und refresh() danach mit denselben Daten noch einmal) */
    if (root.__wrHtml === nextHtml && root.firstChild && !($("wr-sheet") && !$("wr-sheet").hidden)) {
      var trackSame = $("wr-vtrack");
      if (trackSame && trackSame.clientHeight && Math.round(trackSame.scrollTop / trackSame.clientHeight) !== state.dayIndex) {
        trackSame.scrollTop = state.dayIndex * trackSame.clientHeight;
      }
      requestAnimationFrame(syncSurface);
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
      track.scrollTop = state.dayIndex * track.clientHeight;
    }
    requestAnimationFrame(syncSurface);
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
      /* Reise-Alternativen dürfen den Wochenplan nicht überschreiben */
      if (body && body.travel_auto) return Promise.resolve();
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
      replaceId: replaceId
    };
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
    function paint() {
      var friends = state.friends || [];
      var list = friends
        .map(function (fid) {
          var p = personOf(fid);
          var done = !!state.shareInvited[fid];
          var on = done || !!state.sharePick[fid];
          return (
            '<label class="wr-friend-row' + (done ? " is-invited" : "") + '"' +
            (done ? "" : ' data-wr-friend-pick="' + esc(fid) + '"') +
            ">" +
            '<input type="checkbox"' +
            (on ? " checked" : "") +
            (done ? " disabled" : "") +
            " />" +
            avatarHtml(p) +
            "<span>" +
            esc(p.name || "?") +
            (done ? ' <small class="wr-invited-tag">eingeladen</small>' : "") +
            "</span></label>"
          );
        })
        .join("");
      var evS = findOwnEvent(eventId);
      var isZ = !!(evS && evS.category === "zirkel");
      openSheet(
        "<h3>Teilen</h3>" +
          '<div class="wr-share-block">' +
          "<h4>Freunde einladen</h4>" +
          '<p class="wr-sheet-hint">Sie können dann Dein wiederkehrendes Event auch in ihrer Woche haben.</p>' +
          (list
            ? '<div class="wr-friend-list">' + list + "</div>"
            : "<p>Noch keine Freunde.</p>") +
          '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-invite-friends="1"' +
          (friends.length ? "" : " disabled") +
          ">Einladen</button>" +
          "</div>" +
          (isZ ? '<div class="wr-share-block"><h4>Mit Circle teilen</h4>' +
            '<button type="button" class="wr-pill-btn" data-wr-share-circle="1">Circle wählen</button></div>' : "") +
          '<div class="wr-share-block">' +
          "<h4>Extern teilen</h4>" +
          '<button type="button" class="wr-pill-btn" data-wr-share-ext="1">Teilen…</button>' +
          "</div>" +
          '<div class="wr-share-block">' +
          "<h4>Woche exportieren</h4>" +
          '<button type="button" class="wr-pill-btn" data-wr-csv="1">Woche als CSV</button>' +
          "</div>" +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
    }
    /* Schon eingeladene Freunde: Haken gesetzt, keine zweite Einladung */
    loadFriends().then(function () {
      return sentInvitesFor(eventId, iso).then(function (rows) {
        (rows || []).forEach(function (r) { state.shareInvited[String(r.to_id)] = true; });
      });
    }).then(paint, paint);
  }

  /* Eigene offene oder angenommene Einladungen zu diesem Termin (Event-ID, sonst Tag) */
  function sentInvitesFor(eventId, iso) {
    var realId = /^[0-9a-f-]{36}$/i.test(String(eventId || "")) ? String(eventId) : "";
    return rest(
      "go_workout_invites?from_id=eq." + encodeURIComponent(me()) + "&status=in.(pending,accepted)" +
        (realId ? "&event_id=eq." + encodeURIComponent(realId) : "&workout_date=eq." + encodeURIComponent(iso || "")) +
        "&select=to_id,event_id,workout_date&limit=200"
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
  function shareToCircle(eventId) {
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
      return GoDialog.choose("Mit Circle teilen", groups.map(function (g) { return { label: g.name, value: String(g.group_id) }; }))
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

  function shareTextFor(iso, eventId) {
    var ev = findOwnEvent(eventId);
    var title = (ev && ev.title) || "Training";
    var when = formatDayLong(iso) + (ev && displayTime(ev.starts_at) ? " · " + displayTime(ev.starts_at) : "");
    return "Komm mit zu gogogo: " + title + " · " + when;
  }

  function shareExternal(iso, eventId) {
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
    var t = e.target && e.target.closest ? e.target.closest("[data-wr-inv-yes],[data-wr-inv-no],[data-wr-zjoin],[data-wr-zown],[data-wr-leave],[data-wr-zadmin],[data-wr-zirkel-next],[data-wr-zirkel-go],[data-wr-travel],[data-wr-week],[data-wr-week-menu],[data-wr-set-mode],[data-wr-edit],[data-wr-pick-plan],[data-wr-end-travel],[data-wr-add-kind],[data-wr-edit-kind],[data-wr-pick-training],[data-wr-rest-pick],[data-wr-rest-save],[data-wr-create-confirm],[data-wr-travel-alt],[data-wr-day-course],[data-wr-travel-pick],[data-wr-travel-go],[data-wr-sheet-close],[data-wr-book],[data-wr-pick-course],[data-wr-wd],[data-wr-book-step],[data-wr-book-confirm],[data-wr-delete],[data-wr-delete-confirm],[data-wr-edit-time],[data-wr-edit-day],[data-wr-day-move],[data-wr-time-save],[data-wr-edit-place],[data-wr-place-save],[data-wr-zirkel-login],[data-wr-time-h],[data-wr-time-m],[data-wr-undo-go],[data-wr-swap],[data-wr-share],[data-wr-invite-friends],[data-wr-share-ext],[data-wr-share-circle],[data-wr-csv],[data-wr-friend-pick],[data-wr-rsvp],[data-wr-done],[data-wr-ffc-rsvp],[data-wr-comments],[data-wr-coach-wa],[data-wr-enroll-menu],[data-wr-enroll-end],[data-wr-enroll-pause],[data-wr-enroll-days],[data-wr-more]") : null;
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
        items.push({ label: "Zirkeltraining wiederkehrend", value: "zrec" });
        items.push({ label: "Zirkeltrainings bearbeiten", value: "zedit" });
        GoDialog.choose("Deine Woche", items, {
          center: true,
          sub: planNames.length ? planNames.join(" · ") : "Kein Wochenplan"
        }).then(function (v) {
          /* erst nach dem Dialog-Klick öffnen, sonst schließt derselbe Klick das neue Sheet wieder */
          setTimeout(function () {
            if (v === "plan") openPlanPicker();
            if (v === "days") openDaysEditor();
            if (v === "zrec") openZirkelRecurring();
            if (v === "zedit") openZirkelEditor();
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
    if (t.hasAttribute("data-wr-friend-pick")) {
      var fidPick = t.getAttribute("data-wr-friend-pick");
      var boxPick = t.querySelector ? t.querySelector("input[type=checkbox]") : null;
      /* native toggle already happened on label click */
      state.sharePick[fidPick] = boxPick ? !!boxPick.checked : !state.sharePick[fidPick];
      return;
    }
    if (t.getAttribute("data-wr-invite-friends")) {
      inviteFriendsSelected();
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
          if (dy < 0 && state.dayIndex < 6) state.dayIndex += 1;
          if (dy > 0 && state.dayIndex > 0) state.dayIndex -= 1;
          if (vtrack) {
            vtrack.scrollTo({
              top: state.dayIndex * vtrack.clientHeight,
              behavior: "smooth"
            });
          }
          syncSurface();
        } else if (Math.abs(dx) > 48) {
          var dayEl = root.querySelectorAll(".wr-day")[state.dayIndex];
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
    var next = Math.round(vtrack.scrollTop / vtrack.clientHeight);
    if (next !== state.dayIndex) {
      state.dayIndex = next;
      state.eventIndex = 0;
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
      loadRecent().catch(function () {})
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
        track.scrollTop = state.dayIndex * track.clientHeight;
      }
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
