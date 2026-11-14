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
    touch: null,
    loadError: "",
    sharePick: {},
    shareIso: "",
    shareEventId: "",
    lastDeleted: null,
    undoTimer: null
  };

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

  function loadTravelPref() {
    try {
      var raw = localStorage.getItem("gogogo_woche_travel_" + me());
      state.travelUntil = raw || null;
    } catch (e) {
      state.travelUntil = null;
    }
  }

  function saveTravelPref(iso) {
    state.travelUntil = iso || null;
    try {
      var key = "gogogo_woche_travel_" + me();
      if (iso) localStorage.setItem(key, iso);
      else localStorage.removeItem(key);
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
      baseSelect + ",item_type,travel_auto,group_id,note,photo_url,courses(id,title,category_default)";
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
    return query(richSelect)
      .catch(function () {
        return query(baseSelect + ",courses(id,title)").catch(function () {
          return query(baseSelect);
        });
      })
      .then(function (rows) {
        state.events = rows || [];
        return ensurePeople(
          state.events.map(function (e) {
            return e.user_id;
          })
        );
      })
      .catch(function (err) {
        state.events = [];
        state.loadError = state.loadError || "Events konnten nicht geladen werden.";
        return null;
      });
  }

  function loadFfc() {
    state.ffcEvents = [];
    if (!global.FFC || !FFC.user || !FFC.user() || !FFC.events) return Promise.resolve();
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
      .catch(function () {});
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
        "&status=eq.aktiv&select=id,course_id,status,start_date,weekdays,payment_status,courses(id,title,duration_weeks,sessions_per_week,price_eur,category_default,level)"
    )
      .then(function (rows) {
        state.enrollments = rows || [];
      })
      .catch(function () {
        return rest(
          "enrollments?user_id=eq." +
            encodeURIComponent(id) +
            "&status=eq.aktiv&select=id,course_id,status,start_date,weekdays,courses(id,title,duration_weeks,sessions_per_week,price_eur,category_default,level)"
        )
          .then(function (rows) {
            state.enrollments = rows || [];
          })
          .catch(function () {
            state.enrollments = [];
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

  function ensureTrainingCourses() {
    var coachId = me();
    if (!coachId) return loadCourses();
    var slugList = TRAINING_DEFS.map(function (d) {
      return d.slug;
    }).join(",");
    return rest(
      "courses?slug=in.(" +
        slugList +
        ")&select=id,slug,is_active,title,category_default"
    )
      .catch(function () {
        return [];
      })
      .then(function (existing) {
        var have = {};
        (existing || []).forEach(function (c) {
          if (c && c.slug) have[c.slug] = c;
        });
        var jobs = TRAINING_DEFS.map(function (d) {
          var row = have[d.slug];
          if (row && row.is_active === false) {
            return rest("courses?id=eq." + encodeURIComponent(row.id), {
              method: "PATCH",
              prefer: "return=minimal",
              body: { is_active: true, title: d.title, category_default: d.category }
            }).catch(function () {
              return null;
            });
          }
          if (row) return Promise.resolve(null);
          return rest("courses", {
            method: "POST",
            prefer: "return=representation",
            body: {
              title: d.title,
              slug: d.slug,
              category_default: d.category,
              duration_weeks: 1,
              sessions_per_week: 1,
              price_eur: 0,
              description: "Training → Kurs",
              coach_id: coachId,
              source: "own",
              is_active: true
            }
          }).catch(function () {
            return null;
          });
        });
        return Promise.all(jobs);
      })
      .then(function () {
        return loadCourses();
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
      if (dayKey(ev.starts_at) === iso) {
        list.push({ kind: "event", starts_at: ev.starts_at, ev: ev });
      }
    });
    state.ffcEvents.forEach(function (ev) {
      if (dayKey(ev.starts_at) === iso) {
        list.push({ kind: "ffc", starts_at: ev.starts_at, ev: ev });
      }
    });
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

  function goingLine(ev) {
    var ids = state.rsvps[String(ev.id)] || [];
    if (!ids.length) return "";
    var names = ids.map(function (id) {
      return personOf(id).name;
    });
    var first = names[0] || "Jemand";
    if (names.length === 1) return esc(first) + " ist dabei";
    return esc(first) + " und " + (names.length - 1) + " weitere sind dabei";
  }

  function facesHtml(ev) {
    var ids = (state.rsvps[String(ev.id)] || []).slice(0, 5);
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
    if (linked) return '<span class="wr-pill">' + esc(linked) + "</span>";
    if (ev.enrollment_id || ev.item_type === "course_session") {
      return '<span class="wr-pill">Kurs</span>';
    }
    if (ev.is_unplanned) return '<span class="wr-pill">Spontan</span>';
    try {
      var wd = new Date(ev.starts_at).toLocaleDateString("de-DE", {
        weekday: "short",
        timeZone: "Europe/Berlin"
      });
      return '<span class="wr-pill">Jeden ' + esc(wd) + "</span>";
    } catch (e) {
      return "";
    }
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
    var count = (state.comments[id] || []).length;
    var going = (state.rsvps[id] || []).indexOf(me()) >= 0;
    var checkLabel = mine && today && ev.status === "geplant" ? "Erledigt" : going ? "Zugesagt" : "Zusagen";
    var checkAttr =
      mine && today && ev.status === "geplant"
        ? ' data-wr-done="' + esc(id) + '"'
        : item.kind === "ffc"
          ? ' data-wr-ffc-rsvp="' + esc(id) + '"'
          : ' data-wr-rsvp="' + esc(id) + '"';
    return (
      '<div class="wr-actions">' +
      '<button type="button" class="wr-act"' +
      checkAttr +
      ' aria-label="' +
      esc(checkLabel) +
      '"><span class="wr-act__icon">' +
      ICON_CHECK +
      '</span><span class="wr-act__n">' +
      (going || (mine && ev.status === "erledigt") ? "1" : "") +
      "</span></button>" +
      '<button type="button" class="wr-act" data-wr-comments="' +
      esc(id) +
      '" aria-label="Kommentare"><span class="wr-act__icon">' +
      ICON_COMMENT +
      '</span><span class="wr-act__n">' +
      (count || "") +
      "</span></button>" +
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
    return (
      '<div class="wr-slide wr-slide--empty" data-day="' +
      esc(iso) +
      '">' +
      '<div class="wr-media tone-neutral">' +
      '<div class="wr-overlay wr-overlay--empty">' +
      '<p class="wr-empty-title">Noch nichts geplant</p>' +
      '<div class="wr-empty-btns">' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-add-train="' +
      esc(iso) +
      '">Training</button>' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-add-rest="' +
      esc(iso) +
      '">Bewegung</button>' +
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
    var when =
      formatDayLong(iso) + (ev.starts_at ? " · " + formatTime(ev.starts_at) : "");
    var notePack = truncNote(ev.note || ev.description || "", 2);
    var place = ev.location || "";
    var travelHint = "";
    if (
      travelActive() &&
      item.kind === "event" &&
      !ev.travel_auto &&
      (String(place).toLowerCase().indexOf("studio") >= 0 || cat === "zirkel") &&
      !ev.enrollment_id
    ) {
      travelHint =
        '<button type="button" class="wr-travel-swap" data-wr-swap="' +
        esc(ev.id) +
        '">Unterwegs? Tausch gegen Hotel-Workout</button>';
    }
    var fullNote = notePack.full || "";
    var placePrefix = place ? esc(place) + (notePack.text ? " · " : "") : "";
    var desc = "";
    if (place || notePack.text) {
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
    return (
      '<div class="wr-slide" data-day="' +
      esc(iso) +
      '" data-event-id="' +
      esc(ev.id) +
      '">' +
      '<div class="wr-media ' +
      toneClass(cat) +
      (ev.photo_url ? " has-photo" : "") +
      '">' +
      (ev.photo_url
        ? '<img class="wr-photo" src="' + esc(ev.photo_url) + '" alt="" />'
        : "") +
      '<div class="wr-overlay">' +
      '<div class="wr-author">' +
      avatarHtml(p) +
      "<span>" +
      esc(p.name || "?") +
      "</span>" +
      coursePill(ev) +
      "</div>" +
      '<p class="wr-when">' +
      esc(when) +
      "</p>" +
      '<h2 class="wr-title">' +
      esc(title) +
      "</h2>" +
      desc +
      (going
        ? '<div class="wr-going">' + facesHtml(ev) + "<span>" + going + "</span></div>"
        : "") +
      travelHint +
      "</div>" +
      actionColHtml(item) +
      "</div></div>"
    );
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
        '<button type="button" class="wr-travel-banner" data-wr-end-travel="1">Unterwegs bis ' +
        esc(formatDayLong(state.travelUntil).replace(/^[^,]*,\s*/, "") || state.travelUntil) +
        " · beenden</button>";
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
      '<button type="button" class="wr-icon-btn" data-wr-week="-1" aria-label="Vorheriger Zeitraum"' +
      (state.editMode ? " disabled" : "") +
      ">‹</button>" +
      '<button type="button" class="wr-week-label" data-wr-week-menu="1"' +
      (state.editMode ? " disabled" : "") +
      ">" +
      esc(label) +
      " ⌄</button>" +
      '<button type="button" class="wr-icon-btn" data-wr-week="1" aria-label="Nächster Zeitraum"' +
      (state.editMode ? " disabled" : "") +
      ">›</button>" +
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
      err
    );
  }

  function progressHtml() {
    var st = weekStats();
    var pct = Math.round((st.planned / 7) * 100);
    return (
      '<div class="wr-progress" role="status">' +
      '<div class="wr-progress__bar"><span style="width:' +
      pct +
      '%"></span></div>' +
      "<p>" +
      st.planned +
      " von 7 Tagen geplant · " +
      st.trainings +
      " Trainings</p></div>"
    );
  }

  function editPanelHtml() {
    if (!state.editMode) return "";
    var list = state.enrollments
      .map(function (en) {
        var c = en.courses || {};
        var weeks = c.duration_weeks || 12;
        var start = en.start_date || "";
        var weekNo = 1;
        if (start) {
          var diff = Math.floor(
            (new Date(berlinToday() + "T12:00:00") - new Date(start + "T12:00:00")) /
              (7 * 86400000)
          );
          weekNo = Math.min(weeks, Math.max(1, diff + 1));
        }
        return (
          '<div class="wr-enroll" data-enroll="' +
          esc(en.id) +
          '"><div><strong>' +
          esc(c.title || "Kurs") +
          "</strong><span>Woche " +
          weekNo +
          " von " +
          weeks +
          '</span></div><button type="button" data-wr-enroll-menu="' +
          esc(en.id) +
          '">⋯</button></div>'
        );
      })
      .join("");
    var own = currentOwnEvent();
    var evRow = own
      ? '<div class="wr-edit-panel__row">' +
        '<button type="button" class="wr-pill-btn" data-wr-edit-time="' +
        esc(own.id) +
        '">Zeit</button>' +
        '<button type="button" class="wr-pill-btn" data-wr-delete="' +
        esc(own.id) +
        '">Löschen</button></div>'
      : "";
    return (
      '<div class="wr-edit-panel">' +
      '<button type="button" class="wr-pill-btn wr-pill-btn--dark wr-pill-btn--center" data-wr-book="1">Kurs hinzufügen</button>' +
      evRow +
      (list ? '<div class="wr-enroll-list">' + list + "</div>" : "") +
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
    var rgb = media ? parseRgb(window.getComputedStyle(media).backgroundColor) : null;
    var light = isLightRgb(rgb);
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
    var ev = state.events.filter(function (e) {
      return String(e.id) === String(eventId);
    })[0];
    if (!ev) return;
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
      requestAnimationFrame(scrollTimeColsToSelection);
    });
  }

  function saveEventTime(eventId) {
    var wheel = $("wr-time-wheel");
    var h = wheel ? Number(wheel.getAttribute("data-h") || 18) : 18;
    var m = wheel ? Number(wheel.getAttribute("data-m") || 0) : 0;
    var val = pad2(h) + ":" + pad2(m);
    var ev = state.events.filter(function (e) {
      return String(e.id) === String(eventId);
    })[0];
    if (!ev) return;
    var iso = dayKey(ev.starts_at);
    var starts = iso + "T" + val + ":00+01:00";
    return rest("events?id=eq." + encodeURIComponent(eventId), {
      method: "PATCH",
      prefer: "return=minimal",
      body: { starts_at: starts }
    })
      .then(function () {
        closeSheet();
        return refresh();
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
    root.innerHTML =
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
  }

  function closeSheet() {
    var sheet = $("wr-sheet");
    if (sheet) sheet.hidden = true;
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
    openSheet(
      "<h3>Unterwegs bis</h3>" +
        '<p class="wr-sheet-hint">Tage drehen</p>' +
        travelWheelHtml(3) +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-travel-go="1">Los</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
    requestAnimationFrame(function () {
      requestAnimationFrame(scrollTravelCol);
    });
  }

  function openRestSheet(iso) {
    var altBlock =
      '<div class="wr-cat-block"><h4>Alternative</h4><div class="wr-chips">' +
      ALTERNATIVE_CHOICES.map(function (t) {
        return (
          '<button type="button" class="wr-chip" data-wr-rest-pick="' +
          esc(t) +
          '" data-iso="' +
          esc(iso) +
          '">' +
          esc(t) +
          "</button>"
        );
      }).join("") +
      "</div></div>";
    var restBlock =
      '<div class="wr-cat-block"><h4>Erholung</h4><div class="wr-chips">' +
      REST_DAYS.map(function (t) {
        return (
          '<button type="button" class="wr-chip" data-wr-rest-pick="' +
          esc(t) +
          '" data-iso="' +
          esc(iso) +
          '">' +
          esc(t) +
          "</button>"
        );
      }).join("") +
      "</div></div>";
    openSheet(
      "<h3>Bewegung</h3>" +
        altBlock +
        restBlock +
        '<label class="wr-field">Freier Titel<input type="text" id="wr-rest-title" maxlength="80" placeholder="z. B. Spaziergang" /></label>' +
        '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-rest-save="' +
        esc(iso) +
        '">Speichern</button>' +
        '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
    );
  }

  function openTrainSheet(iso) {
    function paint() {
      var groups = coursesByCategory();
      var order = ["kraft", "ausdauer", "zirkel"];
      var body = order
        .map(function (cat) {
          var list = groups[cat] || [];
          if (!list.length) return "";
          return (
            '<div class="wr-cat-block">' +
            "<h4>" +
            esc(CAT_LABELS[cat] || cat) +
            "</h4>" +
            '<div class="wr-course-list">' +
            list
              .map(function (c) {
                return (
                  '<button type="button" class="wr-course-card" data-wr-day-course="' +
                  esc(c.id) +
                  '" data-iso="' +
                  esc(iso) +
                  '"><strong>' +
                  esc(c.title) +
                  "</strong><span>" +
                  esc(CAT_LABELS[c.category_default] || c.category_default || "") +
                  "</span></button>"
                );
              })
              .join("") +
            "</div></div>"
          );
        })
        .join("");
      openSheet(
        "<h3>Kurs wählen</h3>" +
          (body || "<p>Trainingskurse werden vorbereitet… Bitte erneut tippen.</p>") +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
    }
    openSheet("<h3>Kurs wählen</h3><p>Lade…</p>");
    ensureTrainingCourses().then(paint).catch(paint);
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
    function paint() {
      var friends = state.friends || [];
      var list = friends
        .map(function (fid) {
          var p = personOf(fid);
          var on = !!state.sharePick[fid];
          return (
            '<label class="wr-friend-row" data-wr-friend-pick="' +
            esc(fid) +
            '">' +
            '<input type="checkbox"' +
            (on ? " checked" : "") +
            " />" +
            avatarHtml(p) +
            "<span>" +
            esc(p.name || "?") +
            "</span></label>"
          );
        })
        .join("");
      openSheet(
        "<h3>Teilen</h3>" +
          '<div class="wr-share-block">' +
          "<h4>Freunde einladen</h4>" +
          (list
            ? '<div class="wr-friend-list">' + list + "</div>"
            : "<p>Noch keine Freunde.</p>") +
          '<button type="button" class="wr-pill-btn wr-pill-btn--dark" data-wr-invite-friends="1"' +
          (friends.length ? "" : " disabled") +
          ">Einladen</button>" +
          "</div>" +
          '<div class="wr-share-block">' +
          "<h4>Extern teilen</h4>" +
          '<button type="button" class="wr-pill-btn" data-wr-share-ext="1">Teilen…</button>' +
          "</div>" +
          '<button type="button" class="wr-sheet-cancel" data-wr-sheet-close="1">Abbrechen</button>'
      );
    }
    loadFriends().then(paint);
  }

  function shareTextFor(iso, eventId) {
    var ev = state.events.filter(function (e) {
      return String(e.id) === String(eventId);
    })[0];
    var title = (ev && ev.title) || "Training";
    var when = formatDayLong(iso) + (ev ? " · " + formatTime(ev.starts_at) : "");
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
    var ev = state.events.filter(function (e) {
      return String(e.id) === String(eventId);
    })[0];
    var label = (ev && ev.title) || "Training";
    var place = (ev && ev.location) || "";
    var time = ev ? formatTime(ev.starts_at) : "";
    var fromName =
      (host.sessionAccount && host.sessionAccount.name) || "gogogo";
    var jobs = ids.map(function (fid) {
      return rest("go_workout_invites", {
        method: "POST",
        prefer: "return=representation",
        body: {
          from_id: me(),
          to_id: fid,
          workout_date: iso,
          workout_label: label,
          from_name: fromName,
          place: place,
          meet_time: time,
          status: "pending"
        }
      }).catch(function () {
        return null;
      });
    });
    return Promise.all(jobs).then(function () {
      closeSheet();
      if (host.toast) host.toast("Einladung gesendet");
      if (host.loadInvites) {
        try {
          host.loadInvites();
        } catch (e) {}
      }
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
      var nextMo = addDays(mondayOf(berlinToday()), 7);
      if (mondayOf(berlinToday()) >= berlinToday()) nextMo = mondayOf(berlinToday());
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
    var until = addDays(berlinToday(), days);
    saveTravelPref(until);
    var jobs = [];
    weekDays().forEach(function (iso) {
      if (iso > until || iso < berlinToday()) return;
      var items = itemsForDay(iso);
      if (!items.length) {
        jobs.push(
          createEvent({
            category: "alternative",
            title: "Hotel-Workout · 20 min",
            starts_at: iso + "T08:00:00+01:00",
            is_unplanned: true,
            item_type: "hotel_workout",
            travel_auto: true
          })
        );
      }
    });
    return Promise.all(jobs).then(function () {
      closeSheet();
      return refresh();
    });
  }

  function endTravel() {
    var id = me();
    var autos = state.events.filter(function (ev) {
      return (
        ev.travel_auto &&
        ev.status === "geplant" &&
        (ev.item_type === "hotel_workout" ||
          String(ev.title || "").indexOf("Hotel-Workout") === 0)
      );
    });
    var jobs = autos.map(function (ev) {
      return rest("events?id=eq." + encodeURIComponent(ev.id), {
        method: "DELETE",
        prefer: "return=minimal"
      }).catch(function () {});
    });
    saveTravelPref(null);
    return Promise.all(jobs).then(refresh);
  }

  function swapToHotel(eventId) {
    var ev = state.events.filter(function (e) {
      return String(e.id) === String(eventId);
    })[0];
    if (!ev) return;
    var iso = dayKey(ev.starts_at);
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
    var price = Number(draft.course.price_eur || 0);
    var payment = price === 0 ? "gratis" : "offen";
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
        "<p>Dein Coach meldet sich wegen der Zahlung.</p>" +
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
      });
  }

  function exitEditMode() {
    if (!state.editMode) return;
    state.editMode = false;
    render();
  }

  function onRootClick(e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-wr-travel],[data-wr-week],[data-wr-week-menu],[data-wr-set-mode],[data-wr-edit],[data-wr-end-travel],[data-wr-add-train],[data-wr-add-rest],[data-wr-rest-pick],[data-wr-rest-save],[data-wr-day-course],[data-wr-travel-pick],[data-wr-travel-go],[data-wr-sheet-close],[data-wr-book],[data-wr-pick-course],[data-wr-wd],[data-wr-book-step],[data-wr-book-confirm],[data-wr-delete],[data-wr-delete-confirm],[data-wr-edit-time],[data-wr-time-save],[data-wr-time-h],[data-wr-time-m],[data-wr-undo-go],[data-wr-swap],[data-wr-share],[data-wr-invite-friends],[data-wr-share-ext],[data-wr-friend-pick],[data-wr-rsvp],[data-wr-done],[data-wr-ffc-rsvp],[data-wr-comments],[data-wr-coach-wa],[data-wr-enroll-menu],[data-wr-enroll-end],[data-wr-enroll-pause],[data-wr-enroll-days],[data-wr-more]") : null;
    if (!t) {
      if (e.target && e.target.id === "wr-sheet") {
        closeSheet();
        return;
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
    if (t.getAttribute("data-wr-travel")) {
      openTravelSheet();
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
    if (t.getAttribute("data-wr-edit")) {
      state.editMode = !state.editMode;
      render();
      return;
    }
    if (t.getAttribute("data-wr-add-train")) {
      openTrainSheet(t.getAttribute("data-wr-add-train"));
      return;
    }
    if (t.getAttribute("data-wr-add-rest")) {
      openRestSheet(t.getAttribute("data-wr-add-rest"));
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
      createEvent({
        category: "alternative",
        title: titleR,
        starts_at: isoR + "T10:00:00+01:00",
        is_unplanned: true,
        item_type: "event"
      }).then(function () {
        closeSheet();
        return refresh();
      });
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
    if (t.hasAttribute("data-wr-travel-go")) {
      var wheelGo = $("wr-travel-wheel");
      var nDays = wheelGo
        ? Number(wheelGo.getAttribute("data-days") || 3)
        : 3;
      applyTravel(Math.max(1, Math.min(TRAVEL_MAX_DAYS, nDays || 3)));
      return;
    }
    if (t.getAttribute("data-wr-book")) {
      ensureTrainingCourses().then(function () {
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
    if (t.getAttribute("data-wr-done")) {
      if (host && host.openDoneModal) host.openDoneModal(t.getAttribute("data-wr-done"));
      else {
        rest("events?id=eq." + encodeURIComponent(t.getAttribute("data-wr-done")), {
          method: "PATCH",
          prefer: "return=minimal",
          body: { status: "erledigt" }
        }).then(refresh);
      }
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
    }).then(function () {
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
    if (!panel) return;
    var existing = panel.querySelector(".wr-edit-panel__row");
    var own = currentOwnEvent();
    var html = own
      ? '<div class="wr-edit-panel__row">' +
        '<button type="button" class="wr-pill-btn" data-wr-edit-time="' +
        esc(own.id) +
        '">Zeit</button>' +
        '<button type="button" class="wr-pill-btn" data-wr-delete="' +
        esc(own.id) +
        '">Löschen</button></div>'
      : "";
    if (existing) existing.outerHTML = html || "";
    else if (html) {
      var book = panel.querySelector("[data-wr-book]");
      if (book) book.insertAdjacentHTML("afterend", html);
      else panel.insertAdjacentHTML("beforeend", html);
    }
  }

  function syncDayFromScroll() {
    var vtrack = $("wr-vtrack");
    if (!vtrack || !vtrack.clientHeight) return;
    var next = Math.round(vtrack.scrollTop / vtrack.clientHeight);
    if (next !== state.dayIndex) {
      state.dayIndex = next;
      state.eventIndex = 0;
      patchDayLabel();
      if (state.editMode) patchEditPanelEvRow();
      syncSurface();
    } else {
      patchDayLabel();
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
      ensureTrainingCourses().catch(function () {
        return loadCourses().catch(function () {});
      })
    ])
      .then(function () {
        var ids = (state.events || []).map(function (e) {
          return String(e.id);
        });
        return Promise.all([
          loadRsvps(ids).catch(function () {}),
          loadComments(ids).catch(function () {})
        ]);
      })
      .then(function () {
        if (state.weekMode === "from_today") state.dayIndex = 0;
      })
      .catch(function () {
        state.loadError = state.loadError || "Woche teilweise nicht geladen.";
      })
      .then(function () {
        render();
      });
  }

  function show() {
    var root = $(ROOT_ID);
    if (root) root.hidden = false;
    document.body.classList.add("is-woche-reels");
    /* Sofort 7 Tageskarten — nie leerer Screen während Load */
    try {
      if (state.weekMode === "from_today") state.dayIndex = 0;
      render();
    } catch (eShow) {
      state.loadError = "Woche konnte nicht gezeichnet werden.";
      try {
        render();
      } catch (e2) {}
    }
    return Promise.all([
      ensureTrainingCourses().catch(function () {
        return loadCourses().catch(function () {});
      }),
      refresh()
    ]);
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
    install: install,
    show: show,
    hide: hide,
    refresh: refresh,
    dayIndex: function () {
      return state.dayIndex;
    }
  };
})(window);
