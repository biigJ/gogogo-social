/* Heute Accountability (Schritt 3): Ich ⊂ Team ⊂ Tagebuch ⊂ Alles */
(function (global) {
  var host = null;
  var state = {
    events: [],
    ffcEvents: [],
    rsvps: {},
    comments: {},
    people: {},
    streak: 0,
    enrollments: [],
    eigenCourseId: null,
    filter: "ich",
    observer: null,
    viewed: {},
    pendingVis: "gruppe"
  };

  var FILTER_KEY = "gogogo_heute_filter_v3";
  var VIEW_LEVEL = { ich: 0, team: 1, tagebuch: 2, alles: 3 };

  /* Eine Filterfunktion mit Parametern — Ich ⊂ Team ⊂ Tagebuch ⊂ Alles */
  function viewFlags(view) {
    view = normalizeFilter(view) || "ich";
    var level = VIEW_LEVEL[view] != null ? VIEW_LEVEL[view] : 0;
    return {
      view: view,
      level: level,
      /* Team+: offene Fremd-Einladungen / Anfragen */
      showIncomingInvites: level >= 1,
      /* FFC: (a) eigene immer; zugesagte immer; (b) offene Einladungen ab Team */
      showOwnFfc: true,
      showAcceptedFfc: true,
      showPendingFfcInvites: level >= 1,
      /* Historie */
      showOwnHistory: level >= 2,
      showFriendsHistory: level >= 3,
      /* Accountability-Events anderer (Gruppe/alle) ab Team */
      showOthersUpcoming: level >= 1
    };
  }

  global.HeuteViewFlags = viewFlags;

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

  function todayIso() {
    return host.todayIso ? host.todayIso() : new Date().toISOString().slice(0, 10);
  }

  function emojiFor(cat, title) {
    if (host.activityEmoji) {
      return host.activityEmoji({ kind: cat, label: title || cat }) || "";
    }
    if (cat === "zirkel") return "🔥";
    if (cat === "ausdauer") return "🏃";
    if (cat === "alternative") return "🤸";
    return "🏋️";
  }

  function normalizeFilter(v) {
    if (v === "crew") return "team"; /* Alias: Crew = Team */
    if (v === "all") return "alles";
    if (v === "mine") return "ich";
    if (["ich", "team", "tagebuch", "alles"].indexOf(v) >= 0) return v;
    return "";
  }

  function loadFilter() {
    try {
      var v = normalizeFilter(localStorage.getItem(FILTER_KEY) || "");
      if (v) return v;
      var legacy = normalizeFilter(localStorage.getItem("gogogo_heute_filter") || "");
      if (legacy) return legacy;
    } catch (e) {}
    return "ich";
  }

  function saveFilter(v) {
    v = normalizeFilter(v) || "ich";
    state.filter = v;
    try { localStorage.setItem(FILTER_KEY, v); } catch (e) {}
    document.body.dataset.heute = v;
    var sel = $("heute-filter-select");
    if (sel && document.activeElement !== sel) sel.value = v;
    if (host && host.onFilterChange) host.onFilterChange(v);
  }

  function rest(path, opts) {
    return host.rest(path, opts);
  }

  function logActivity(type, refId) {
    var id = me();
    if (!id) return Promise.resolve();
    return rest("activity_log", {
      method: "POST",
      prefer: "return=minimal",
      body: { user_id: id, type: type, ref_id: refId || null }
    }).catch(function () {});
  }

  function personOf(uid) {
    if (!uid) return { id: "", name: "?", photo: "" };
    if (state.people[uid]) return state.people[uid];
    var fromTeam = (host.teamPeople || []).find(function (p) {
      return p && String(p.id) === String(uid);
    });
    if (fromTeam) {
      state.people[uid] = {
        id: String(fromTeam.id),
        name: fromTeam.name || "?",
        photo: fromTeam.photo_url || fromTeam.photo || ""
      };
      return state.people[uid];
    }
    if (String(uid) === me() && host.sessionAccount) {
      state.people[uid] = {
        id: me(),
        name: host.sessionAccount.name || "Ich",
        photo: host.sessionAccount.photo_url || ""
      };
      return state.people[uid];
    }
    return { id: String(uid), name: "?", photo: "" };
  }

  function ensurePeople(ids) {
    var missing = ids.filter(function (id) {
      return id && !state.people[id] && String(id) !== me();
    });
    if (!missing.length) return Promise.resolve();
    var uniq = [];
    missing.forEach(function (id) {
      if (uniq.indexOf(id) < 0) uniq.push(id);
    });
    return rest(
      "go_accounts?id=in.(" + uniq.map(encodeURIComponent).join(",") + ")&select=id,name,photo_url"
    )
      .then(function (rows) {
        (rows || []).forEach(function (r) {
          if (!r || !r.id) return;
          state.people[String(r.id)] = {
            id: String(r.id),
            name: r.name || "?",
            photo: r.photo_url || ""
          };
        });
      })
      .catch(function () {});
  }

  function loadStreak() {
    var id = me();
    if (!id) {
      state.streak = 0;
      return Promise.resolve();
    }
    return rest("rpc/go_streak_days", {
      method: "POST",
      body: { p_user_id: id }
    })
      .then(function (n) {
        state.streak = Number(n) || 0;
      })
      .catch(function () {
        state.streak = 0;
      });
  }

  function loadEigenCourse() {
    return rest("courses?slug=eq.eigenes-training&select=id&limit=1")
      .then(function (rows) {
        state.eigenCourseId = rows && rows[0] && rows[0].id ? String(rows[0].id) : null;
      })
      .catch(function () {
        state.eigenCourseId = null;
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
        "&status=eq.aktiv&select=id,course_id,status,courses(id,title,category_default,slug,is_system)"
    )
      .then(function (rows) {
        state.enrollments = rows || [];
      })
      .catch(function () {
        state.enrollments = [];
      });
  }

  function loadEvents() {
    var id = me();
    if (!id) {
      state.events = [];
      return Promise.resolve();
    }
    var from = new Date();
    from.setDate(from.getDate() - 30);
    var to = new Date();
    to.setDate(to.getDate() + 8);
    var fromIso = from.toISOString();
    var toIso = to.toISOString();
    return rest(
      "events?select=id,user_id,course_id,enrollment_id,category,starts_at,location,visibility,is_unplanned,status,title,note,photo_url&starts_at=gte." +
        encodeURIComponent(fromIso) +
        "&starts_at=lte." +
        encodeURIComponent(toIso) +
        "&order=starts_at.asc&limit=200"
    )
      .then(function (rows) {
        state.events = rows || [];
        var ids = state.events.map(function (e) {
          return String(e.user_id);
        });
        return ensurePeople(ids);
      })
      .catch(function () {
        state.events = [];
      });
  }

  function loadFfcEvents() {
    state.ffcEvents = [];
    if (!global.FFC || !FFC.user || !FFC.user() || !FFC.events) return Promise.resolve();
    try {
      state.ffcEvents = FFC.events() || [];
    } catch (e) {
      state.ffcEvents = [];
    }
    return Promise.resolve();
  }

  function loadRsvps(eventIds) {
    state.rsvps = {};
    if (!eventIds.length) return Promise.resolve();
    return rest(
      "event_rsvps?event_id=in.(" +
        eventIds.map(encodeURIComponent).join(",") +
        ")&status=eq.zugesagt&select=event_id,user_id"
    )
      .then(function (rows) {
        (rows || []).forEach(function (r) {
          var eid = String(r.event_id);
          if (!state.rsvps[eid]) state.rsvps[eid] = [];
          state.rsvps[eid].push(String(r.user_id));
        });
        var pids = [];
        Object.keys(state.rsvps).forEach(function (k) {
          state.rsvps[k].forEach(function (uid) {
            pids.push(uid);
          });
        });
        return ensurePeople(pids);
      })
      .catch(function () {});
  }

  function loadComments(eventIds) {
    state.comments = {};
    if (!eventIds.length) return Promise.resolve();
    return rest(
      "event_comments?event_id=in.(" +
        eventIds.map(encodeURIComponent).join(",") +
        ")&select=id,event_id,account_id,text,created_at&order=created_at.asc&limit=500"
    )
      .then(function (rows) {
        (rows || []).forEach(function (c) {
          var eid = String(c.event_id);
          if (!state.comments[eid]) state.comments[eid] = [];
          state.comments[eid].push(c);
        });
        var pids = (rows || []).map(function (c) {
          return String(c.account_id);
        });
        return ensurePeople(pids);
      })
      .catch(function () {});
  }

  function paintStreak() {
    var el = $("heute-streak");
    if (!el) return;
    el.textContent = String(state.streak);
    el.hidden = false;
  }

  function dayKey(isoTs) {
    try {
      return new Date(isoTs).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    } catch (e) {
      return String(isoTs).slice(0, 10);
    }
  }

  function timeLabel(isoTs) {
    try {
      return new Date(isoTs).toLocaleTimeString("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return "";
    }
  }

  function myTodayEvents() {
    var day = todayIso();
    var uid = me();
    return state.events
      .filter(function (e) {
        return String(e.user_id) === uid && dayKey(e.starts_at) === day && e.status !== "ausgefallen";
      })
      .sort(function (a, b) {
        return String(a.starts_at).localeCompare(String(b.starts_at));
      });
  }

  function eventVisibleToMe(ev, flags) {
    if (!ev) return false;
    var uid = me();
    var mine = String(ev.user_id) === uid;
    /* privat: immer nur für den Ersteller */
    if (ev.visibility === "privat" && !mine) return false;
    if (ev.status === "ausgefallen") return false;
    var now = Date.now();
    var week = now + 7 * 86400000;
    var t = new Date(ev.starts_at).getTime();
    if (ev.status === "geplant") {
      if (t < now - 3600000 || t > week) return false;
      if (mine) return true;
      return !!flags.showOthersUpcoming;
    }
    if (ev.status === "erledigt") {
      if (mine) return !!flags.showOwnHistory;
      /* Freunde-Historie nur in Alles; privat bleibt draußen (oben) */
      return !!flags.showFriendsHistory;
    }
    return false;
  }

  function filterOwnEvents(flags) {
    var upcoming = [];
    var past = [];
    state.events.forEach(function (e) {
      if (!eventVisibleToMe(e, flags)) return;
      if (e.status === "geplant") upcoming.push(e);
      else past.push(e);
    });
    upcoming.sort(function (a, b) {
      return String(a.starts_at).localeCompare(String(b.starts_at));
    });
    past.sort(function (a, b) {
      return String(b.starts_at).localeCompare(String(a.starts_at));
    });
    return { upcoming: upcoming, past: past, all: upcoming.concat(past) };
  }

  function filterFfcEvents(flags) {
    var now = Date.now();
    var week = now + 7 * 86400000;
    return (state.ffcEvents || []).filter(function (e) {
      if (!e || !e.starts_at) return false;
      var t = new Date(e.starts_at).getTime();
      if (t < now - 3600000 || t > week) return false;
      /* (a) selbst erstellt */
      if (e.is_mine && flags.showOwnFfc) return true;
      /* bereits zugesagt — auch in Ich */
      if (e.my_going === true && flags.showAcceptedFfc) return true;
      /* (b) eingeladen, noch nicht zugesagt — ab Team */
      if (e.my_going === null && flags.showPendingFfcInvites) return true;
      return false;
    });
  }

  function avatarHtml(person, cls) {
    var c = cls || "acc-avatar";
    if (person.photo) {
      return '<img class="' + c + '" src="' + esc(person.photo) + '" alt="">';
    }
    return '<span class="' + c + " " + c + '--ph">' + esc((person.name || "?").slice(0, 1)) + "</span>";
  }

  function rsvpRowHtml(eventId) {
    var list = state.rsvps[eventId] || [];
    if (!list.length) return '<div class="acc-rsvp-faces" data-faces="' + esc(eventId) + '"></div>';
    return (
      '<div class="acc-rsvp-faces" data-faces="' +
      esc(eventId) +
      '">' +
      list
        .map(function (uid) {
          return avatarHtml(personOf(uid), "acc-face");
        })
        .join("") +
      "</div>"
    );
  }

  function commentsHtml(eventId) {
    var list = state.comments[eventId] || [];
    if (!list.length) {
      return (
        '<div class="acc-comments" data-comments="' +
        esc(eventId) +
        '"><button type="button" class="acc-comment-add" data-add-comment="' +
        esc(eventId) +
        '">Kommentar</button></div>'
      );
    }
    var show = list.slice(0, 2);
    var more = list.length - show.length;
    var body = show
      .map(function (c) {
        var p = personOf(c.account_id);
        return (
          '<div class="acc-comment"><strong>' +
          esc(p.name) +
          "</strong> " +
          esc(c.text) +
          "</div>"
        );
      })
      .join("");
    if (more > 0) {
      body +=
        '<button type="button" class="acc-comment-more" data-more-comments="' +
        esc(eventId) +
        '">+' +
        more +
        " weitere</button>";
      body +=
        '<div class="acc-comments-rest" hidden data-rest-comments="' +
        esc(eventId) +
        '">' +
        list
          .slice(2)
          .map(function (c) {
            var p = personOf(c.account_id);
            return (
              '<div class="acc-comment"><strong>' +
              esc(p.name) +
              "</strong> " +
              esc(c.text) +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    }
    body +=
      '<button type="button" class="acc-comment-add" data-add-comment="' +
      esc(eventId) +
      '">Kommentar</button>';
    return '<div class="acc-comments" data-comments="' + esc(eventId) + '">' + body + "</div>";
  }

  function toneClass(cat) {
    if (cat === "zirkel") return "tone-zirkel";
    if (cat === "ausdauer") return "tone-ausdauer";
    if (cat === "alternative") return "tone-alternative";
    return "tone-kraft-basics";
  }

  function renderHero(ev) {
    var title = (emojiFor(ev.category, ev.title) + " " + (ev.title || ev.category)).trim();
    var when = "Heute · " + timeLabel(ev.starts_at) + " Uhr";
    var done = ev.status === "erledigt";
    return (
      '<article class="acc-hero ' +
      toneClass(ev.category) +
      '" data-event-id="' +
      esc(ev.id) +
      '">' +
      '<p class="acc-hero__kicker">' +
      esc(when) +
      "</p>" +
      '<h2 class="acc-hero__title">' +
      esc(title) +
      "</h2>" +
      (ev.location ? '<p class="acc-hero__place">' + esc(ev.location) + "</p>" : "") +
      (done
        ? '<p class="acc-hero__done">Erledigt</p>'
        : '<button type="button" class="acc-btn" data-done="' + esc(ev.id) + '">Erledigt</button>') +
      "</article>"
    );
  }

  function renderStartTile() {
    return (
      '<button type="button" class="acc-start" id="heute-acc-start">' +
      "<span>Jetzt starten</span></button>"
    );
  }

  function iAmGoing(eventId) {
    var list = state.rsvps[eventId] || [];
    return list.indexOf(me()) >= 0;
  }

  function ffcFacesHtml(ev) {
    var names = ev.going_names || [];
    if (ev.creator_nickname && names.indexOf(ev.creator_nickname) < 0) {
      names = [ev.creator_nickname].concat(names);
    }
    if (!names.length) return '<div class="acc-rsvp-faces"></div>';
    return (
      '<div class="acc-rsvp-faces">' +
      names
        .map(function (n) {
          return (
            '<span class="acc-face acc-face--ph" title="' +
            esc(n) +
            '">' +
            esc(String(n || "?").slice(0, 1)) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderFfcPost(ev) {
    var upcoming = new Date(ev.starts_at).getTime() >= Date.now() - 3600000;
    var going = ev.my_going === true;
    var author = ev.creator_nickname || "Crew";
    var mediaStyle = ev.image_url
      ? ' style="background-image:url(\'' + esc(ev.image_url) + '\');background-size:cover;background-position:center"'
      : "";
    return (
      '<article class="acc-post" data-post-id="ffc-' +
      esc(ev.id) +
      '" data-ffc-id="' +
      esc(ev.id) +
      '">' +
      '<div class="acc-post__media tone-zirkel"' +
      mediaStyle +
      "></div>" +
      '<div class="acc-post__meta">' +
      '<span class="acc-post__time">' +
      esc(timeLabel(ev.starts_at)) +
      " Uhr</span>" +
      '<strong class="acc-post__title">🔥 ' +
      esc(ev.title || "Zirkeltraining") +
      "</strong>" +
      (ev.location ? '<span class="acc-post__place">' + esc(ev.location) + "</span>" : "") +
      '<div class="acc-post__author"><span class="acc-face acc-face--ph">' +
      esc(String(author).slice(0, 1)) +
      "</span><span>" +
      esc(author) +
      "</span></div>" +
      (upcoming
        ? '<button type="button" class="acc-rsvp' +
          (going ? " is-on" : "") +
          '" data-ffc-rsvp="' +
          esc(ev.id) +
          '">' +
          (going ? "Zugesagt" : "Bin dabei") +
          "</button>" +
          ffcFacesHtml(ev)
        : "") +
      "</div></article>"
    );
  }

  function renderPost(ev) {
    var p = personOf(ev.user_id);
    var title = (emojiFor(ev.category, ev.title) + " " + (ev.title || ev.category)).trim();
    var upcoming = ev.status === "geplant";
    var going = iAmGoing(ev.id);
    var mediaStyle = ev.photo_url
      ? ' style="background-image:url(\'' + esc(ev.photo_url) + '\');background-size:cover;background-position:center"'
      : "";
    var noteHtml =
      !upcoming && (ev.note || "").trim()
        ? '<p class="acc-post__note">' + esc(ev.note) + "</p>"
        : "";
    return (
      '<article class="acc-post" data-post-id="' +
      esc(ev.id) +
      '" data-event-id="' +
      esc(ev.id) +
      '">' +
      '<div class="acc-post__media ' +
      toneClass(ev.category) +
      '"' +
      mediaStyle +
      "></div>" +
      '<div class="acc-post__meta">' +
      '<span class="acc-post__time">' +
      esc(timeLabel(ev.starts_at)) +
      " Uhr</span>" +
      '<strong class="acc-post__title">' +
      esc(title) +
      "</strong>" +
      (ev.location ? '<span class="acc-post__place">' + esc(ev.location) + "</span>" : "") +
      noteHtml +
      '<div class="acc-post__author">' +
      avatarHtml(p, "acc-face") +
      "<span>" +
      esc(p.name) +
      "</span></div>" +
      (upcoming
        ? '<button type="button" class="acc-rsvp' +
          (going ? " is-on" : "") +
          '" data-rsvp="' +
          esc(ev.id) +
          '">' +
          (going ? "Zugesagt" : "Bin dabei") +
          "</button>" +
          rsvpRowHtml(ev.id)
        : "") +
      commentsHtml(ev.id) +
      "</div></article>"
    );
  }

  function emptyTeamHtml() {
    return (
      '<div class="acc-empty">' +
      "<p>Noch keine Beiträge vom Team. Lade deine Gruppe ein.</p>" +
      '<button type="button" class="acc-btn" data-invite-group="1">Gruppe einladen</button>' +
      "</div>"
    );
  }

  function bindObserver(root) {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (!root || !global.IntersectionObserver) return;
    var timers = {};
    state.observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var id = entry.target.getAttribute("data-post-id");
          if (!id) return;
          if (entry.isIntersecting) {
            if (timers[id] || state.viewed[id]) return;
            timers[id] = setTimeout(function () {
              timers[id] = null;
              if (state.viewed[id]) return;
              state.viewed[id] = true;
              logActivity("post_view", id);
            }, 1000);
          } else if (timers[id]) {
            clearTimeout(timers[id]);
            timers[id] = null;
          }
        });
      },
      { threshold: 0.55 }
    );
    root.querySelectorAll("[data-post-id]").forEach(function (el) {
      state.observer.observe(el);
    });
  }

  function render() {
    var root = $("heute-acc");
    if (!root) return;
    paintStreak();
    var f = state.filter;
    var flags = viewFlags(f);
    document.body.dataset.heute = f;

    var share = $("heute-diary-share-pick");
    if (share) {
      share.hidden = true;
      share.style.display = "none";
    }

    var diary = $("heute-diary-feed");
    if (flags.showOwnHistory || flags.showFriendsHistory) {
      if (diary) diary.hidden = false;
      if (host.paintHeuteDiaryFeed) host.paintHeuteDiaryFeed();
    } else if (diary) {
      diary.hidden = true;
      diary.textContent = "";
    }

    if (host.paintHeuteJoins) host.paintHeuteJoins(flags);

    root.hidden = false;
    var html = renderStartTile();

    var ffcList = filterFfcEvents(flags);
    html += ffcList.map(renderFfcPost).join("");

    var pack = filterOwnEvents(flags);
    /* In Ich/Team nur kommende Accountability-Events; Historie über Tagebuch-Feed */
    var posts = flags.showOwnHistory || flags.showFriendsHistory
      ? pack.upcoming
      : pack.upcoming;

    if (f === "team" && !ffcList.length && !posts.length) {
      html += emptyTeamHtml();
    } else {
      html += posts.map(renderPost).join("");
    }

    root.innerHTML = html;
    bindObserver(root);
    if (host.maybeAskHistoryShare) host.maybeAskHistoryShare();
  }

  function openDoneModal(eventId) {
    var ev = state.events.find(function (e) {
      return String(e.id) === String(eventId);
    });
    if (!ev) return;
    var modal = $("acc-done-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.dataset.eventId = String(eventId);
    var g = modal.querySelector('[name="acc-vis"][value="' + (ev.visibility || "gruppe") + '"]');
    if (!g) g = modal.querySelector('[name="acc-vis"][value="gruppe"]');
    if (g) g.checked = true;
    var note = $("acc-done-note");
    if (note) note.value = ev.note || "";
    var photo = $("acc-done-photo");
    if (photo) photo.value = "";
  }

  function closeDoneModal() {
    var modal = $("acc-done-modal");
    if (modal) modal.hidden = true;
  }

  function readDonePhoto() {
    var input = $("acc-done-photo");
    if (!input || !input.files || !input.files[0]) return Promise.resolve("");
    var file = input.files[0];
    if (file.size > 2.5 * 1024 * 1024) {
      if (host.toast) host.toast("Foto zu groß (max. 2,5 MB).");
      return Promise.resolve("");
    }
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        resolve("");
      };
      reader.readAsDataURL(file);
    });
  }

  function submitDone() {
    var modal = $("acc-done-modal");
    if (!modal) return;
    var eventId = modal.dataset.eventId;
    if (!eventId) return;
    var visEl = modal.querySelector('[name="acc-vis"]:checked');
    var vis = visEl ? visEl.value : "gruppe";
    var note = ($("acc-done-note") && $("acc-done-note").value) || "";
    readDonePhoto()
      .then(function (photo) {
        var body = {
          status: "erledigt",
          visibility: vis,
          note: note.trim().slice(0, 500)
        };
        if (photo) body.photo_url = photo;
        return rest("events?id=eq." + encodeURIComponent(eventId), {
          method: "PATCH",
          prefer: "return=minimal",
          body: body
        });
      })
      .then(function () {
        return logActivity("checkin", eventId);
      })
      .then(function () {
        closeDoneModal();
        return refresh();
      })
      .catch(function (err) {
        if (host.toast) host.toast(String(err && err.message ? err.message : err));
      });
  }

  function optimisticRsvpFaces(eventId, add) {
    var uid = me();
    if (!state.rsvps[eventId]) state.rsvps[eventId] = [];
    var list = state.rsvps[eventId];
    var idx = list.indexOf(uid);
    if (add && idx < 0) list.push(uid);
    if (!add && idx >= 0) list.splice(idx, 1);
    var faces = document.querySelector('[data-faces="' + eventId + '"]');
    if (faces) faces.outerHTML = rsvpRowHtml(eventId);
    var btn = document.querySelector('[data-rsvp="' + eventId + '"]');
    if (btn) {
      var on = iAmGoing(eventId);
      btn.classList.toggle("is-on", on);
      btn.textContent = on ? "Zugesagt" : "Bin dabei";
    }
  }

  function toggleRsvp(eventId) {
    var uid = me();
    if (!uid) return;
    var going = iAmGoing(eventId);
    optimisticRsvpFaces(eventId, !going);
    if (going) {
      rest(
        "event_rsvps?event_id=eq." +
          encodeURIComponent(eventId) +
          "&user_id=eq." +
          encodeURIComponent(uid),
        { method: "DELETE", prefer: "return=minimal" }
      )
        .then(function () {
          return logActivity("rsvp_no", eventId);
        })
        .then(function () {
          return loadRsvps([eventId]);
        })
        .then(function () {
          optimisticRsvpFaces(eventId, false);
        })
        .catch(function () {
          optimisticRsvpFaces(eventId, true);
        });
      return;
    }
    rest("event_rsvps?on_conflict=event_id,user_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { event_id: eventId, user_id: uid, status: "zugesagt" }
    })
      .then(function () {
        return logActivity("rsvp_yes", eventId);
      })
      .then(function () {
        return loadRsvps([eventId]);
      })
      .then(function () {
        optimisticRsvpFaces(eventId, true);
      })
      .catch(function () {
        optimisticRsvpFaces(eventId, false);
      });
  }

  function toggleFfcRsvp(ffcId) {
    if (!global.FFC || !FFC.respondEvent) return;
    var ev = (state.ffcEvents || []).find(function (e) {
      return String(e.id) === String(ffcId);
    });
    var going = ev && ev.my_going === true;
    var btn = document.querySelector('[data-ffc-rsvp="' + ffcId + '"]');
    if (btn) {
      btn.classList.toggle("is-on", !going);
      btn.textContent = !going ? "Zugesagt" : "Bin dabei";
      btn.disabled = true;
    }
    Promise.resolve(FFC.respondEvent(ffcId, !going))
      .then(function (res) {
        if (res && res.error) throw res.error;
        return logActivity(going ? "rsvp_no" : "rsvp_yes", null);
      })
      .then(function () {
        return loadFfcEvents();
      })
      .then(render)
      .catch(function (err) {
        if (host.toast) host.toast(String((err && err.message) || err || "Zusage fehlgeschlagen"));
        return loadFfcEvents().then(render);
      });
  }

  function addComment(eventId) {
    var text = global.prompt("Kommentar");
    if (!text || !String(text).trim()) return;
    rest("event_comments", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        event_id: eventId,
        account_id: me(),
        text: String(text).trim().slice(0, 500)
      }
    })
      .then(refresh)
      .catch(function () {});
  }

  function enrollmentsForCategory(cat) {
    return state.enrollments.filter(function (en) {
      var c = en.courses || en.course || {};
      if (c.is_system) return false;
      var def = String(c.category_default || "").toLowerCase();
      return def === cat;
    });
  }

  function createUnplannedEvent(payload) {
    var body = {
      user_id: me(),
      category: payload.category,
      course_id: payload.course_id || null,
      enrollment_id: payload.enrollment_id || null,
      starts_at: new Date().toISOString(),
      location: payload.location || null,
      visibility: payload.visibility || state.pendingVis || "gruppe",
      is_unplanned: true,
      status: "geplant",
      title: payload.title || payload.category
    };
    var err = host.validateOwnEvent ? host.validateOwnEvent(body) : null;
    if (err) {
      if (host.toast) host.toast(err);
      return Promise.reject(new Error(err));
    }
    return rest("events", {
      method: "POST",
      prefer: "return=representation",
      body: body
    }).then(function (rows) {
      var ev = Array.isArray(rows) ? rows[0] : rows;
      return logActivity("unplanned_start", ev && ev.id).then(function () {
        return ev;
      });
    });
  }

  function visPickerHtml() {
    var cur = state.pendingVis || "gruppe";
    return (
      '<div class="acc-vis" role="group" aria-label="Sichtbarkeit">' +
      ["privat", "gruppe", "alle"]
        .map(function (v) {
          return (
            '<label><input type="radio" name="acc-create-vis" value="' +
            v +
            '"' +
            (v === cur ? " checked" : "") +
            " /> " +
            (v === "gruppe" ? "Gruppe" : v) +
            "</label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function readCreateVis(box) {
    var el = box && box.querySelector('[name="acc-create-vis"]:checked');
    state.pendingVis = el ? el.value : "gruppe";
    return state.pendingVis;
  }

  function afterKindChosen(kind) {
    var modal = $("go-modal");
    var pick = $("go-pick");
    var kinds = $("go-kinds");
    var title = $("go-title");
    if (!modal || !pick) return;

    function finishCreate(payload) {
      return createUnplannedEvent(payload).then(function () {
        modal.hidden = true;
        if (host.closeGoPick) host.closeGoPick();
        else modal.hidden = true;
        return refresh();
      });
    }

    if (kind === "alternative") {
      kinds.hidden = true;
      title.hidden = false;
      title.textContent = "Sichtbarkeit";
      pick.hidden = false;
      pick.innerHTML = visPickerHtml();
      var startBtn = document.createElement("button");
      startBtn.type = "button";
      startBtn.textContent = "Jetzt starten";
      startBtn.addEventListener("click", function () {
        var vis = readCreateVis(pick);
        finishCreate({
          category: "alternative",
          title: "Alternative Bewegung",
          visibility: vis
        });
      });
      pick.appendChild(startBtn);
      return;
    }

    var list = enrollmentsForCategory(kind);
    kinds.hidden = true;
    title.hidden = false;
    title.textContent = "Welcher Kurs?";
    pick.hidden = false;
    pick.textContent = "";
    pick.insertAdjacentHTML("beforeend", visPickerHtml());

    function addBtn(label, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", onClick);
      pick.appendChild(b);
    }

    list.forEach(function (en) {
      var c = en.courses || {};
      addBtn(c.title || "Kurs", function () {
        var vis = readCreateVis(pick);
        finishCreate({
          category: kind,
          course_id: en.course_id || c.id,
          enrollment_id: en.id,
          title: c.title || kind,
          visibility: vis
        });
      });
    });

    addBtn("Eigenes Training", function () {
      var courseId = state.eigenCourseId;
      if (!courseId) {
        if (host.toast) host.toast("Systemkurs fehlt — go-event-comments.sql ausführen.");
        return;
      }
      var vis = readCreateVis(pick);
      finishCreate({
        category: kind,
        course_id: courseId,
        title: "Eigenes Training",
        visibility: vis
      });
    });
  }

  function interceptGoKinds() {
    var kinds = $("go-kinds");
    if (!kinds || kinds.dataset.accBound === "1") return;
    kinds.dataset.accBound = "1";
    kinds.addEventListener(
      "click",
      function (e) {
        var btn = e.target.closest("[data-go-kind]");
        if (!btn) return;
        var kind = btn.getAttribute("data-go-kind");
        if (!kind) return;
        // Accountability path for Heute shell
        if (document.body.dataset.shell !== "heute") return;
        e.preventDefault();
        e.stopPropagation();
        afterKindChosen(kind);
      },
      true
    );
  }

  function onRootClick(e) {
    var t = e.target;
    if (t.closest("#heute-acc-start") || t.id === "heute-acc-start") {
      if (host.openGoPick) host.openGoPick();
      return;
    }
    var invite = t.closest("[data-invite-group]");
    if (invite) {
      if (host.openGruppen) host.openGruppen();
      return;
    }
    var done = t.closest("[data-done]");
    if (done) {
      openDoneModal(done.getAttribute("data-done"));
      return;
    }
    var ffcRsvp = t.closest("[data-ffc-rsvp]");
    if (ffcRsvp) {
      toggleFfcRsvp(ffcRsvp.getAttribute("data-ffc-rsvp"));
      return;
    }
    var rsvp = t.closest("[data-rsvp]");
    if (rsvp) {
      toggleRsvp(rsvp.getAttribute("data-rsvp"));
      return;
    }
    var more = t.closest("[data-more-comments]");
    if (more) {
      var restBox = document.querySelector(
        '[data-rest-comments="' + more.getAttribute("data-more-comments") + '"]'
      );
      if (restBox) restBox.hidden = !restBox.hidden;
      return;
    }
    var add = t.closest("[data-add-comment]");
    if (add) {
      addComment(add.getAttribute("data-add-comment"));
    }
  }

  function refresh() {
    if (!host || !me()) return Promise.resolve();
    var ffcReady = Promise.resolve();
    if (global.FFC && FFC.refreshHeute && FFC.user && FFC.user()) {
      ffcReady = Promise.resolve(FFC.refreshHeute()).catch(function () {});
    }
    return ffcReady
      .then(function () {
        return Promise.all([
          loadStreak(),
          loadEigenCourse(),
          loadEnrollments(),
          loadEvents(),
          loadFfcEvents()
        ]);
      })
      .then(function () {
        var ids = state.events.map(function (e) {
          return String(e.id);
        });
        return Promise.all([loadRsvps(ids), loadComments(ids)]);
      })
      .then(render);
  }

  function install(h) {
    host = h || {};
    saveFilter(loadFilter());
    var sel = $("heute-filter-select");
    if (sel) {
      sel.innerHTML =
        '<option value="ich">Ich</option>' +
        '<option value="team">Team</option>' +
        '<option value="tagebuch">Tagebuch</option>' +
        '<option value="alles">Alles</option>';
      sel.value = state.filter;
      if (sel.dataset.accBound !== "1") {
        sel.dataset.accBound = "1";
        sel.addEventListener("change", function () {
          saveFilter(sel.value);
          refresh();
        });
      }
    }
    var root = $("heute-acc");
    if (root && root.dataset.bound !== "1") {
      root.dataset.bound = "1";
      root.addEventListener("click", onRootClick);
    }
    var doneOk = $("acc-done-ok");
    if (doneOk) doneOk.addEventListener("click", submitDone);
    var doneCancel = $("acc-done-cancel");
    if (doneCancel) doneCancel.addEventListener("click", closeDoneModal);
    interceptGoKinds();
  }

  global.HeuteAccountability = {
    install: install,
    refresh: refresh,
    setFilter: function (v) {
      saveFilter(v);
      refresh();
    },
    afterKindChosen: afterKindChosen
  };
})(window);
