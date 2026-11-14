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
    pendingVis: "team"
  };

  var FILTER_KEY = "gogogo_heute_filter_v3";
  /* Ich ⊂ Team ⊂ Gruppe ⊂ Tagebuch ⊂ Alles — Gruppe nur wenn vorhanden */
  var VIEW_LEVEL = { ich: 0, team: 1, gruppe: 1, tagebuch: 2, alles: 3 };

  function viewFlags(view) {
    view = normalizeFilter(view) || "ich";
    var level = VIEW_LEVEL[view] != null ? VIEW_LEVEL[view] : 0;
    return {
      view: view,
      level: level,
      groupOnly: view === "gruppe",
      showIncomingInvites: level >= 1,
      showOwnFfc: true,
      showAcceptedFfc: true,
      showPendingFfcInvites: level >= 1,
      /* Eigene Historie immer (Ich inkl.); Freunde erst ab Alles */
      showOwnHistory: true,
      showFriendsHistory: level >= 3,
      showOthersUpcoming: level >= 1,
      showRsvpdUpcoming: true,
      showPlanDays: true
    };
  }

  function normalizeVisibility(v) {
    /* Legacy-UI/DB: alle|gruppe (Freundeskreis) → team. Neu: gruppe = groups.group_id. */
    if (v === "alle" || v === "all" || v === "friends") return "team";
    if (v === "privat" || v === "team" || v === "gruppe") return v;
    return "team";
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
    if (v === "crew") return "team";
    if (v === "all") return "alles";
    if (v === "mine") return "ich";
    if (String(v || "").indexOf("group:") === 0) return "gruppe";
    if (["ich", "team", "gruppe", "tagebuch", "alles"].indexOf(v) >= 0) return v;
    return "";
  }

  function groupMemberIdSet() {
    var ids = host && host.groupMemberIds ? host.groupMemberIds() || [] : [];
    var set = {};
    ids.forEach(function (id) {
      if (id) set[String(id)] = true;
    });
    return set;
  }

  function inGroupFilter(userId, flags) {
    if (!flags || !flags.groupOnly) return true;
    var uid = String(userId || "");
    if (!uid || uid === me()) return true;
    return !!groupMemberIdSet()[uid];
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

  function eventFingerprint(ev) {
    if (!ev) return "";
    return [
      String(ev.user_id || ""),
      dayKey(ev.starts_at),
      String(ev.category || ""),
      String(ev.title || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
    ].join("|");
  }

  function dedupeEvents(rows) {
    var byId = {};
    var byFp = {};
    (rows || []).forEach(function (e) {
      if (!e || !e.id) return;
      var id = String(e.id);
      byId[id] = e;
    });
    Object.keys(byId).forEach(function (id) {
      var e = byId[id];
      if (e.status === "ausgefallen") return;
      var fp = eventFingerprint(e);
      var prev = byFp[fp];
      if (!prev) {
        byFp[fp] = e;
        return;
      }
      /* Neueren Eintrag behalten (DB-Abgleich nach Löschen/Neu) */
      var a = String(prev.starts_at || "");
      var b = String(e.starts_at || "");
      if (String(e.id) > String(prev.id) || b >= a) byFp[fp] = e;
    });
    return Object.keys(byFp).map(function (k) {
      return byFp[k];
    });
  }

  function loadEvents() {
    var id = me();
    if (!id) {
      state.events = [];
      return Promise.resolve();
    }
    var from = new Date();
    from.setDate(from.getDate() - 180);
    var to = new Date();
    to.setDate(to.getDate() + 14);
    var fromIso = from.toISOString();
    var toIso = to.toISOString();
    return rest(
      "events?select=id,user_id,course_id,enrollment_id,category,starts_at,location,visibility,is_unplanned,status,title,item_type,photo_url,note&starts_at=gte." +
        encodeURIComponent(fromIso) +
        "&starts_at=lte." +
        encodeURIComponent(toIso) +
        "&order=starts_at.desc&limit=500"
    )
      .catch(function () {
        return rest(
          "events?select=id,user_id,course_id,enrollment_id,category,starts_at,location,visibility,is_unplanned,status,title&starts_at=gte." +
            encodeURIComponent(fromIso) +
            "&starts_at=lte." +
            encodeURIComponent(toIso) +
            "&order=starts_at.desc&limit=500"
        );
      })
      .then(function (rows) {
        state.events = dedupeEvents(rows || []);
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

  function whenLine(isoTs) {
    var day = dayKey(isoTs);
    var today = todayIso();
    var tom = (function () {
      try {
        var d = new Date(today + "T12:00:00");
        d.setDate(d.getDate() + 1);
        return d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
      } catch (e) {
        return "";
      }
    })();
    var t = timeLabel(isoTs);
    if (day === today) return "Heute · " + t;
    if (day === tom) return "Morgen · " + t;
    try {
      var label = new Date(isoTs).toLocaleDateString("de-DE", {
        timeZone: "Europe/Berlin",
        weekday: "short",
        day: "numeric",
        month: "short"
      });
      return label.replace(/\.$/, "") + " · " + t;
    } catch (e) {
      return day + " · " + t;
    }
  }

  function truncNote(text, maxLines) {
    var raw = String(text || "").trim();
    if (!raw) return { text: "", more: false };
    var lines = raw.split(/\n+/);
    maxLines = maxLines || 2;
    if (lines.length <= maxLines && raw.length <= 140) return { text: raw, more: false };
    var cut = lines.slice(0, maxLines).join("\n");
    if (cut.length > 140) cut = cut.slice(0, 137).trim() + "…";
    else if (lines.length > maxLines) cut = cut + "…";
    return { text: cut, more: true, full: raw };
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
    var vis = normalizeVisibility(ev.visibility);
    /* privat: immer nur für den Ersteller */
    if (vis === "privat" && !mine) return false;
    if (ev.status === "ausgefallen") return false;
    var now = Date.now();
    var week = now + 7 * 86400000;
    var t = new Date(ev.starts_at).getTime();
    if (ev.status === "geplant") {
      if (t < now - 3600000 || t > week) return false;
      if (mine) return true;
      if (flags.showRsvpdUpcoming && iAmGoing(ev.id)) {
        return inGroupFilter(ev.user_id, flags);
      }
      if (!flags.showOthersUpcoming) return false;
      if (!(vis === "team" || vis === "gruppe")) return false;
      return inGroupFilter(ev.user_id, flags);
    }
    if (ev.status === "erledigt") {
      if (mine) return !!flags.showOwnHistory;
      if (!flags.showFriendsHistory || !(vis === "team" || vis === "gruppe")) return false;
      return inGroupFilter(ev.user_id, flags);
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

  function commentLineHtml(c) {
    var p = personOf(c.account_id);
    return (
      '<div class="acc-comment"><strong>' +
      esc(p.name) +
      "</strong> " +
      esc(c.text) +
      "</div>"
    );
  }

  function myCommentText(postId) {
    var list = state.comments[postId] || [];
    var uid = me();
    for (var i = list.length - 1; i >= 0; i--) {
      if (String(list[i].account_id) === uid && list[i].text) return String(list[i].text);
    }
    return "";
  }

  function bubbleSvg() {
    /* Identisch zu Woche wr-ico Kommentar (30×30) */
    return (
      '<svg class="acc-bubble-icon wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3H7.5A2.5 2.5 0 0 1 5 13.5v-7z"/>' +
      "</svg>"
    );
  }

  function checkSvg() {
    return (
      '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>'
    );
  }

  function badgeSvg(kind) {
    if (kind === "plan") {
      /* Gleich wie Pill-Woche: breites Kalenderblatt + eine Linie */
      return (
        '<svg class="acc-badge-ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M5 9h14"/></svg>'
      );
    }
    if (kind === "zirkel") {
      return (
        '<svg class="acc-badge-ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 5v5h-5"/></svg>'
      );
    }
    if (kind === "booked") {
      return (
        '<svg class="acc-badge-ico acc-badge-ico--booked" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9" fill="#111"/><path d="M12 8v8M8 12h8" fill="none" stroke="#F6F1E8" stroke-width="1.8" stroke-linecap="round"/></svg>'
      );
    }
    return "";
  }

  function inviteFaceRowHtml(postId, inviteIso) {
    var mePerson = personOf(me());
    return (
      '<div class="acc-card__faces">' +
      avatarHtml(mePerson, "acc-face") +
      '<button type="button" class="acc-face acc-face--add" data-invite-post="' +
      esc(postId || "") +
      '" data-invite-iso="' +
      esc(inviteIso || "") +
      '" aria-label="Einladen">+</button>' +
      "</div>"
    );
  }

  function commentsPanelHtml(postId, open) {
    if (!postId) return "";
    var list = state.comments[postId] || [];
    var body = list.map(commentLineHtml).join("");
    body +=
      '<form class="acc-comment-form" data-comment-form="' +
      esc(postId) +
      '">' +
      '<input type="text" class="acc-comment-input" maxlength="500" placeholder="Kommentieren" aria-label="Kommentieren" />' +
      "</form>";
    return (
      '<div class="acc-comments' +
      (open ? " is-open" : "") +
      '" data-comments="' +
      esc(postId) +
      '"' +
      (open ? "" : " hidden") +
      ">" +
      body +
      "</div>"
    );
  }

  function goingCount(eventId) {
    var uid = me();
    var others = (state.rsvps[eventId] || []).filter(function (id) {
      return String(id) !== uid;
    }).length;
    return 1 + others;
  }

  function postBarHtml(opts) {
    opts = opts || {};
    var postId = opts.postId || "";
    if (!postId) return opts.actions || "";
    var mine = myCommentText(postId);
    /* Kommentar-Feld erst nach Tippen auf Sprechblase; teaser nur mit Text */
    var teaserBlock = mine
      ? '<div class="acc-card__teaser">' +
        '<button type="button" class="acc-card__my-line" data-open-comments="' +
        esc(postId) +
        '">' +
        esc(mine) +
        "</button></div>"
      : '<div class="acc-card__teaser is-empty" hidden></div>';
    return (
      '<div class="acc-card__bar">' +
      (opts.actions || "") +
      inviteFaceRowHtml(postId, opts.inviteIso || "") +
      teaserBlock +
      '<div class="acc-comments" data-comments="' +
      esc(postId) +
      '" hidden>' +
      '<form class="acc-comment-form" data-comment-form="' +
      esc(postId) +
      '">' +
      '<input type="text" class="acc-comment-input" maxlength="500" placeholder="Kommentar" aria-label="Kommentar" />' +
      "</form></div>" +
      "</div>"
    );
  }

  function eventToolRowHtml(opts) {
    opts = opts || {};
    var eventId = opts.eventId || "";
    var postId = opts.postId || eventId;
    var done = !!opts.canDone;
    var isDone = !!opts.isDone;
    var count = goingCount(eventId);
    var check =
      '<button type="button" class="acc-tool acc-tool--check' +
      (isDone ? " is-done" : "") +
      '"' +
      (done ? ' data-done="' + esc(eventId) + '"' : isDone ? " disabled" : "") +
      ' aria-label="Erledigt">' +
      checkSvg() +
      '<span class="acc-tool__n">' +
      count +
      "</span></button>";
    var bubble =
      '<button type="button" class="acc-tool acc-tool--bubble" data-open-comments="' +
      esc(postId) +
      '" aria-label="Kommentieren">' +
      bubbleSvg() +
      "</button>";
    var badgeKind = opts.badge || "";
    var badge = badgeKind
      ? '<span class="acc-tool-badge" title="">' + badgeSvg(badgeKind) + "</span>"
      : "";
    return (
      '<div class="acc-card__tools">' +
      '<div class="acc-card__tools-left">' +
      check +
      bubble +
      "</div>" +
      (badge ? '<div class="acc-card__tools-right">' + badge + "</div>" : "") +
      "</div>"
    );
  }

  function toneClass(cat) {
    if (cat === "zirkel") return "tone-zirkel";
    if (cat === "ausdauer") return "tone-ausdauer";
    if (cat === "alternative") return "tone-alternative";
    if (cat === "spontan") return "tone-spontan";
    return "tone-kraft-basics";
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
    if (!names.length) {
      return '<div class="acc-rsvp-faces" data-faces="ffc-' + esc(ev.id) + '"></div>';
    }
    return (
      '<div class="acc-rsvp-faces" data-faces="ffc-' +
      esc(ev.id) +
      '">' +
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

  function mediaInnerHtml(opts) {
    if (opts.photo) {
      return '<img class="acc-card__photo" src="' + esc(opts.photo) + '" alt="" />';
    }
    if (opts.plus) return '<span class="acc-card__plus">+</span>';
    /* Kein zentrales Platzhalter-Emoji auf dem Frame */
    return "";
  }

  function overlayHtml(opts) {
    return (
      '<div class="acc-card__overlay">' +
      (opts.author || "") +
      (opts.when
        ? '<p class="acc-card__when">' + esc(opts.when) + "</p>"
        : "") +
      (opts.title
        ? '<h2 class="acc-card__title">' + esc(opts.title) + "</h2>"
        : "") +
      (opts.place
        ? '<p class="acc-card__place">' + esc(opts.place) + "</p>"
        : "") +
      (opts.desc || "") +
      "</div>"
    );
  }

  function mediaHtml(opts) {
    var tone = toneClass(opts.category);
    return (
      '<div class="acc-card__media ' +
      tone +
      (opts.photo ? " has-photo" : "") +
      '">' +
      mediaInnerHtml(opts) +
      overlayHtml(opts) +
      "</div>"
    );
  }

  function descHtml(note) {
    var pack = truncNote(note, 2);
    if (!pack.text) return "";
    if (!pack.more) return '<p class="acc-card__desc">' + esc(pack.text) + "</p>";
    return (
      '<p class="acc-card__desc">' +
      esc(pack.text) +
      ' <button type="button" class="acc-card__more" data-more-desc="1">mehr</button></p>' +
      '<p class="acc-card__desc-full" hidden>' +
      esc(pack.full) +
      "</p>"
    );
  }

  function authorHtml(person, show) {
    if (!show || !person) return "";
    return (
      '<div class="acc-card__author">' +
      avatarHtml(person, "acc-face") +
      "<span>" +
      esc(person.name || "?") +
      "</span></div>"
    );
  }

  function actionRowHtml(opts) {
    var btn = "";
    if (opts.doneBtn) {
      btn =
        '<button type="button" class="acc-rsvp" data-done="' +
        esc(opts.doneBtn) +
        '">Erledigt</button>';
    } else if (opts.rsvpId) {
      btn =
        '<button type="button" class="acc-rsvp' +
        (opts.going ? " is-on" : "") +
        '" data-rsvp="' +
        esc(opts.rsvpId) +
        '">' +
        (opts.going ? "Zugesagt" : "Bin dabei") +
        "</button>";
    } else if (opts.ffcRsvpId) {
      btn =
        '<button type="button" class="acc-rsvp' +
        (opts.going ? " is-on" : "") +
        '" data-ffc-rsvp="' +
        esc(opts.ffcRsvpId) +
        '">' +
        (opts.going ? "Zugesagt" : "Bin dabei") +
        "</button>";
    }
    var faces = opts.facesHtml || "";
    if (!btn && !faces) return "";
    return '<div class="acc-card__actions">' + btn + faces + "</div>";
  }

  function renderCardShell(opts) {
    var bar = "";
    if (opts.postId) {
      bar = postBarHtml({
        postId: opts.postId,
        inviteIso: opts.inviteIso || "",
        actions: opts.actions || ""
      });
    } else {
      bar = opts.actions || "";
    }
    return (
      '<article class="acc-card' +
      (opts.extraClass ? " " + opts.extraClass : "") +
      '"' +
      (opts.attrs || "") +
      ">" +
      mediaHtml(opts) +
      bar +
      "</article>"
    );
  }

  function renderSpontanCard() {
    return renderCardShell({
      extraClass: "acc-card--spontan",
      attrs: ' data-spontan="1" role="button" tabindex="0"',
      category: "spontan",
      plus: true,
      when: "Jetzt · Spontanes Event loggen",
      title: "",
      place: "",
      desc: "",
      actions: "",
      comments: ""
    });
  }

  function eventBadgeKind(ev) {
    if (!ev) return "";
    if (ev.category === "zirkel") return "zirkel";
    if (ev.enrollment_id || ev.course_id) return "booked";
    return "";
  }

  function renderEventCard(ev) {
    var uid = me();
    var mine = String(ev.user_id) === uid;
    var upcoming = ev.status === "geplant";
    var p = personOf(ev.user_id);
    var emoji = emojiFor(ev.category, ev.title);
    var title = (emoji + " " + (ev.title || ev.category)).trim();
    var actions = "";
    if (upcoming && !mine) {
      actions = actionRowHtml({ rsvpId: ev.id, going: iAmGoing(ev.id) });
    }
    var tools = mine
      ? eventToolRowHtml({
          eventId: ev.id,
          postId: String(ev.id),
          canDone: upcoming && dayKey(ev.starts_at) === todayIso(),
          isDone: ev.status === "erledigt",
          badge: eventBadgeKind(ev)
        })
      : "";
    return renderCardShell({
      attrs:
        ' data-post-id="' +
        esc(ev.id) +
        '" data-event-id="' +
        esc(ev.id) +
        '"',
      category: ev.category,
      photo: ev.photo_url || "",
      emoji: emoji,
      actions: (tools || "") + (actions || ""),
      author: authorHtml(p, !mine),
      when: whenLine(ev.starts_at),
      title: title,
      place: ev.location || "",
      desc: descHtml(ev.note),
      postId: String(ev.id),
      inviteIso: dayKey(ev.starts_at)
    });
  }

  function renderFfcCard(ev) {
    var upcoming = new Date(ev.starts_at).getTime() >= Date.now() - 3600000;
    var going = ev.my_going === true;
    var mine = !!ev.is_mine;
    var authorName = ev.creator_nickname || "Team";
    var authorPerson = { name: authorName, photo: "" };
    var actions = "";
    if (upcoming && !mine) {
      actions = actionRowHtml({ ffcRsvpId: ev.id, going: going });
    }
    var postId = "ffc-" + String(ev.id);
    return renderCardShell({
      attrs:
        ' data-post-id="' +
        esc(postId) +
        '" data-ffc-id="' +
        esc(ev.id) +
        '"',
      category: "zirkel",
      photo: ev.image_url || "",
      emoji: "🔥",
      actions: actions,
      author: authorHtml(authorPerson, !mine),
      when: whenLine(ev.starts_at),
      title: "🔥 " + (ev.title || "Zirkeltraining"),
      place: ev.location || "",
      desc: "",
      postId: postId,
      inviteIso: dayKey(ev.starts_at)
    });
  }

  function renderDiaryCard(item) {
    var p = personOf(item.user_id);
    var mine = String(item.user_id) === me();
    var emoji = emojiFor(item.category || "kraft", item.title);
    var title = (emoji + " " + (item.title || "Training")).trim();
    var commentKey =
      item.commentKey ||
      "diary:" + String(item.user_id) + ":" + dayKey(item.starts_at);
    return renderCardShell({
      attrs:
        ' data-post-id="' +
        esc(commentKey) +
        '" data-diary-id="' +
        esc(item.id) +
        '"',
      category: item.category || "kraft",
      photo: item.photo_url || "",
      emoji: emoji,
      actions: "",
      author: authorHtml(p, !mine),
      when: whenLine(item.starts_at),
      title: title,
      place: item.location || "",
      desc: descHtml(item.note),
      postId: commentKey,
      inviteIso: dayKey(item.starts_at)
    });
  }

  function sortOwnFirst(a, b) {
    var aMine = a._mine ? 1 : 0;
    var bMine = b._mine ? 1 : 0;
    if (aMine !== bMine) return bMine - aMine;
    return String(a.starts_at || "").localeCompare(String(b.starts_at || ""));
  }

  function renderPlanCard(item) {
    var emoji = emojiFor(item.category || "kraft", item.title);
    var title = item.title || "Training";
    if (emoji && title.indexOf(emoji) !== 0) title = (emoji + " " + title).trim();
    var postId = "plan:" + String(item.iso || item.id);
    var tools = eventToolRowHtml({
      eventId: postId,
      postId: postId,
      canDone: false,
      isDone: false,
      badge: item.category === "zirkel" ? "zirkel" : "plan"
    });
    return renderCardShell({
      attrs:
        ' data-post-id="' +
        esc(postId) +
        '" data-plan-iso="' +
        esc(item.iso || "") +
        '"',
      category: item.category || "kraft",
      photo: item.photo_url || "",
      emoji: emoji,
      actions: tools,
      author: "",
      when: item.when || whenLine(item.starts_at),
      title: title,
      place: item.location || "",
      desc: descHtml(item.note || ""),
      postId: postId,
      inviteIso: item.iso || dayKey(item.starts_at)
    });
  }

  /* Reihenfolge-Regel:
     1) Meine Events von heute (Plan + eigene Events/FFC)
     2) Spontan-Karte
     3) Kommende (morgen zuerst, dann später; eigene vor fremden bei Gleichstand)
     4) Historie (Tagebuch+), neueste zuerst */
  function buildFeedItems(flags) {
    var today = todayIso();
    var pack = filterOwnEvents(flags);
    var ffc = filterFfcEvents(flags);
    var myToday = [];
    var upcoming = [];
    var history = [];
    var coveredDays = {};
    var coveredFp = {};

    pack.upcoming.forEach(function (ev) {
      var item = {
        kind: "event",
        starts_at: ev.starts_at,
        _mine: String(ev.user_id) === me(),
        ev: ev
      };
      if (item._mine) {
        coveredDays[dayKey(ev.starts_at)] = true;
        coveredFp[eventFingerprint(ev)] = true;
      }
      if (item._mine && dayKey(ev.starts_at) === today) myToday.push(item);
      else upcoming.push(item);
    });

    /* Plan nur wenn kein echtes Event denselben Tag/Titel abdeckt */
    if (flags.showPlanDays && host && host.heutePlanItems) {
      (host.heutePlanItems() || []).forEach(function (p) {
        if (!p || !p.starts_at) return;
        var day = dayKey(p.starts_at);
        var fp = [
          me(),
          day,
          String(p.category || ""),
          String(p.title || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ")
        ].join("|");
        if (coveredDays[day] || coveredFp[fp]) return;
        var item = {
          kind: "plan",
          starts_at: p.starts_at,
          _mine: true,
          item: p
        };
        if (day === today) myToday.push(item);
        else upcoming.push(item);
      });
    }

    /* Support / Ernährung / PT / Web-Call (GoSupport) */
    if (host && host.heuteSupportItems) {
      (host.heuteSupportItems() || []).forEach(function (s) {
        if (!s || !s.starts_at) return;
        var item = {
          kind: s.nutrition ? "nutrition" : "support",
          starts_at: s.starts_at,
          _mine: true,
          item: s
        };
        if (dayKey(s.starts_at) === today) myToday.push(item);
        else upcoming.push(item);
      });
    }

    ffc.forEach(function (ev) {
      if (flags.groupOnly && !ev.is_mine && ev.my_going !== true) return;
      var item = {
        kind: "ffc",
        starts_at: ev.starts_at,
        _mine: !!ev.is_mine,
        ev: ev
      };
      if (item._mine && dayKey(ev.starts_at) === today) myToday.push(item);
      else upcoming.push(item);
    });

    pack.past.forEach(function (ev) {
      history.push({
        kind: "event",
        starts_at: ev.starts_at,
        _mine: String(ev.user_id) === me(),
        ev: ev
      });
    });

    if (flags.showOwnHistory || flags.showFriendsHistory) {
      var diaryItems =
        host && host.heuteHistoryItems
          ? host.heuteHistoryItems({
              showOwn: !!flags.showOwnHistory,
              showFriends: !!flags.showFriendsHistory,
              groupOnly: !!flags.groupOnly
            }) || []
          : [];
      diaryItems.forEach(function (d) {
        if (!d || !d.starts_at) return;
        if (flags.groupOnly && !inGroupFilter(d.user_id, flags)) return;
        history.push({
          kind: "diary",
          starts_at: d.starts_at,
          _mine: String(d.user_id) === me(),
          item: d
        });
      });
    }

    myToday.sort(sortOwnFirst);
    upcoming.sort(function (a, b) {
      var c = String(a.starts_at).localeCompare(String(b.starts_at));
      if (c) return c;
      return sortOwnFirst(a, b);
    });
    history.sort(function (a, b) {
      var c = String(b.starts_at).localeCompare(String(a.starts_at));
      if (c) return c;
      return sortOwnFirst(a, b);
    });

    return { myToday: myToday, upcoming: upcoming, history: history };
  }

  function renderFeedItem(item) {
    if (item.kind === "ffc") return renderFfcCard(item.ev);
    if (item.kind === "diary") return renderDiaryCard(item.item);
    if (item.kind === "plan") return renderPlanCard(item.item);
    if (item.kind === "nutrition") return renderNutritionCard(item.item);
    if (item.kind === "support") return renderSupportCard(item.item);
    return renderEventCard(item.ev);
  }

  function renderSupportCard(item) {
    var emoji = emojiFor(item.category, item.title);
    return renderCardShell({
      extraClass: "acc-card--support",
      attrs:
        ' data-post-id="' +
        esc(item.id) +
        '" data-support="' +
        esc(item.supportType || item.item_type || "") +
        '"',
      category: item.category || "alternative",
      photo: item.photo_url || "",
      emoji: emoji,
      author: authorHtml(personOf(me()), false),
      when: whenLine(item.starts_at),
      title: item.title || "Support",
      place: item.location || "",
      desc: descHtml(item.note),
      postId: String(item.id),
      actions: ""
    });
  }

  function renderNutritionCard(item) {
    var form =
      '<form class="acc-nutrition-form" data-nutrition-form="1">' +
      '<textarea maxlength="500" placeholder="Abendessen diktieren oder tippen (privat)…" enterkeyhint="done" autocomplete="off"></textarea>' +
      '<button type="submit">Speichern</button></form>';
    return renderCardShell({
      extraClass: "acc-card--nutrition",
      attrs: ' data-post-id="' + esc(item.id) + '" data-nutrition="1"',
      category: "alternative",
      emoji: "🥗",
      when: "Heute · ab 19:00 · privat",
      title: "Ernährung",
      place: "Coach-Plan",
      desc:
        (item.note
          ? '<p class="acc-card__desc">' + esc(item.note) + "</p>"
          : "") + form,
      actions: ""
    });
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

    /* Historie läuft im einheitlichen Feed — alter Diary-Block bleibt leer */
    var diary = $("heute-diary-feed");
    if (diary) {
      diary.hidden = true;
      diary.textContent = "";
    }

    if (host.paintHeuteJoins) host.paintHeuteJoins(flags);

    var feed = buildFeedItems(flags);
    root.hidden = false;
    var html = "";
    /* Oben = Zukunft (Scroll nach oben), Mitte = Heute, Unten = Vergangenheit */
    html += '<div class="acc-feed-future" data-acc-zone="future">';
    feed.upcoming.forEach(function (item) {
      html += renderFeedItem(item);
    });
    html += "</div>";
    html += '<div class="acc-feed-today" data-acc-zone="today" id="acc-feed-today">';
    feed.myToday.forEach(function (item) {
      html += renderFeedItem(item);
    });
    html += renderSpontanCard();
    html += "</div>";
    html += '<div class="acc-feed-past" data-acc-zone="past">';
    feed.history.forEach(function (item) {
      html += renderFeedItem(item);
    });
    html += "</div>";

    root.innerHTML = html;
    bindObserver(root);
    requestAnimationFrame(function () {
      var todayEl = $("acc-feed-today");
      var scroller = welcomeScrollEl();
      if (todayEl && scroller) {
        var top = todayEl.offsetTop - 12;
        if (top > 0) scroller.scrollTop = top;
      }
      bindHeuteScrollFilter();
    });
    if (host.maybeAskHistoryShare) host.maybeAskHistoryShare();
  }

  function welcomeScrollEl() {
    return (
      document.querySelector(".welcome") ||
      document.scrollingElement ||
      document.documentElement
    );
  }

  function bindHeuteScrollFilter() {
    var row = document.querySelector(".heute-filter-row");
    var scroller = welcomeScrollEl();
    if (!row || !scroller || scroller._heuteFilterBound) return;
    scroller._heuteFilterBound = true;
    var last = scroller.scrollTop || 0;
    scroller.addEventListener(
      "scroll",
      function () {
        if (document.body.dataset.shell !== "heute") return;
        var y = scroller.scrollTop || 0;
        var todayEl = $("acc-feed-today");
        var goingUp = y < last - 2;
        var aboveToday = todayEl ? y + 40 < todayEl.offsetTop : false;
        /* Nach oben in die Zukunft: Dropdown ausblenden, nicht sticky mitscrollen */
        if (goingUp && aboveToday) {
          row.classList.add("is-scroll-hide");
        } else if (!aboveToday) {
          row.classList.remove("is-scroll-hide");
        }
        last = y;
      },
      { passive: true }
    );
  }

  function setDoneVis(want) {
    var modal = $("acc-done-modal");
    if (!modal) return;
    want = normalizeVisibility(want || "team");
    if (want === "gruppe") want = "team";
    if (want !== "privat") want = "team";
    modal.dataset.vis = want;
    modal.querySelectorAll("[data-acc-vis]").forEach(function (row) {
      var on = row.getAttribute("data-acc-vis") === want;
      row.classList.toggle("is-on", on);
      var check = row.querySelector(".invite-check");
      if (check) {
        check.classList.toggle("is-on", on);
        check.setAttribute("aria-pressed", on ? "true" : "false");
      }
    });
  }

  function openDoneModal(eventId) {
    var ev = state.events.find(function (e) {
      return String(e.id) === String(eventId);
    });
    var modal = $("acc-done-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.dataset.eventId = String(eventId);
    var want = normalizeVisibility((ev && ev.visibility) || "team");
    if (want === "gruppe") want = "team";
    setDoneVis(want);
    var note = $("acc-done-note");
    if (note) note.value = (ev && ev.note) || "";
    var photo = $("acc-done-photo");
    if (photo) photo.value = "";
    var fileLabel = $("acc-done-file-label");
    if (fileLabel) {
      fileLabel.textContent = "Datei auswählen";
      fileLabel.classList.remove("is-picked");
    }
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
    var vis = normalizeVisibility(modal.dataset.vis || "team");
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
        /* Von Woche: Dialog wie Heute, danach auf dem Tag bleiben */
        if (host && typeof host.afterDone === "function") {
          return host.afterDone(eventId);
        }
        if (
          document.body.classList.contains("is-woche-reels") &&
          global.WocheReels &&
          WocheReels.refresh
        ) {
          return WocheReels.refresh();
        }
        if (host && typeof host.showHeute === "function") {
          host.showHeute();
          return;
        }
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

  function paintPostBar(postId) {
    var card = document.querySelector('[data-post-id="' + postId + '"]');
    if (!card) return;
    var bar = card.querySelector(".acc-card__bar");
    var tools = card.querySelector(".acc-card__tools");
    var toolsHtml = tools ? tools.outerHTML : "";
    var actions = toolsHtml;
    var rsvp = card.querySelector("[data-rsvp]");
    var ffc = card.querySelector("[data-ffc-rsvp]");
    if (rsvp) {
      actions += actionRowHtml({
        rsvpId: rsvp.getAttribute("data-rsvp"),
        going: rsvp.classList.contains("is-on")
      });
    } else if (ffc) {
      actions += actionRowHtml({
        ffcRsvpId: ffc.getAttribute("data-ffc-rsvp"),
        going: ffc.classList.contains("is-on")
      });
    }
    var inviteIso = "";
    var addBtn = card.querySelector("[data-invite-iso]");
    if (addBtn) inviteIso = addBtn.getAttribute("data-invite-iso") || "";
    var html = postBarHtml({ postId: postId, inviteIso: inviteIso, actions: actions });
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    var next = tmp.firstChild;
    if (!next) return;
    if (bar) bar.replaceWith(next);
    else card.appendChild(next);
  }

  function openComments(postId) {
    var card = document.querySelector('[data-post-id="' + postId + '"]');
    var panel = card
      ? card.querySelector('[data-comments="' + postId + '"]')
      : document.querySelector('[data-comments="' + postId + '"]');
    if (!panel) {
      paintPostBar(postId);
      card = document.querySelector('[data-post-id="' + postId + '"]');
      panel = card && card.querySelector('[data-comments="' + postId + '"]');
    }
    if (!panel) return;
    var teaser = card && card.querySelector(".acc-card__teaser");
    if (teaser) {
      teaser.hidden = true;
      teaser.classList.add("is-composing");
    }
    panel.hidden = false;
    panel.classList.add("is-open");
    var input = panel.querySelector(".acc-comment-input");
    if (input) {
      input.value = "";
      input.focus();
    }
  }

  function addComment(postId, text) {
    text = String(text || "").trim();
    if (!text || !postId || !me()) return;
    var temp = {
      id: "local-" + Date.now(),
      account_id: me(),
      text: text.slice(0, 500),
      created_at: new Date().toISOString()
    };
    if (!state.comments[postId]) state.comments[postId] = [];
    state.comments[postId].push(temp);
    personOf(me());
    paintPostBar(postId);

    var save;
    if (String(postId).indexOf("diary:") === 0) {
      var parts = String(postId).split(":");
      var ownerId = parts[1] || me();
      var day = parts[2] || todayIso();
      var tagged =
        "⟦ix:" + day + "⟧" + temp.text.slice(0, Math.max(0, 144 - (12 + String(day).length)));
      save = rest("go_community_posts", {
        method: "POST",
        prefer: "return=representation",
        body: {
          author_id: me(),
          kind: "text",
          body: tagged,
          reply_to_id: ownerId
        }
      });
    } else if (String(postId).indexOf("ffc-") === 0 || String(postId).indexOf("plan:") === 0) {
      /* lokal / ohne Event-Tabelle — nur Anzeige */
      save = Promise.resolve([temp]);
    } else {
      save = rest("event_comments", {
        method: "POST",
        prefer: "return=representation",
        body: {
          event_id: postId,
          account_id: me(),
          text: temp.text
        }
      });
    }

    save
      .then(function (rows) {
        var saved = Array.isArray(rows) ? rows[0] : rows;
        if (saved && saved.id) {
          var list = state.comments[postId] || [];
          for (var i = 0; i < list.length; i++) {
            if (list[i].id === temp.id) {
              list[i] = {
                id: saved.id,
                account_id: saved.account_id || saved.author_id || me(),
                text: saved.text || saved.body || temp.text,
                created_at: saved.created_at || temp.created_at
              };
              break;
            }
          }
          paintPostBar(postId);
        }
      })
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
      visibility: normalizeVisibility(payload.visibility || state.pendingVis || "team"),
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
    var cur = normalizeVisibility(state.pendingVis || "team");
    if (cur === "gruppe") cur = "team";
    return (
      '<div class="acc-vis" role="group" aria-label="Sichtbarkeit">' +
      ["privat", "team"]
        .map(function (v) {
          return (
            '<label><input type="radio" name="acc-create-vis" value="' +
            v +
            '"' +
            (v === cur ? " checked" : "") +
            " /> " +
            (v === "team" ? "Team" : "privat") +
            "</label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function readCreateVis(box) {
    var el = box && box.querySelector('[name="acc-create-vis"]:checked');
    state.pendingVis = normalizeVisibility(el ? el.value : "team");
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
    var moreDesc = t.closest("[data-more-desc]");
    if (moreDesc) {
      var card = moreDesc.closest(".acc-card");
      var short = card && card.querySelector(".acc-card__desc");
      var full = card && card.querySelector(".acc-card__desc-full");
      if (short) short.hidden = true;
      if (full) full.hidden = false;
      return;
    }
    var openC = t.closest("[data-open-comments]");
    if (openC) {
      openComments(openC.getAttribute("data-open-comments"));
      return;
    }
    var invitePost = t.closest("[data-invite-post]");
    if (invitePost) {
      var invIso = invitePost.getAttribute("data-invite-iso") || "";
      if (host.openInviteForPost) host.openInviteForPost(invIso);
      else if (host.openPlanDay && invIso) host.openPlanDay(invIso);
      return;
    }
    var planCard = t.closest("[data-plan-iso]");
    if (
      planCard &&
      !t.closest(".acc-card__bar") &&
      !t.closest(".acc-comments")
    ) {
      var iso = planCard.getAttribute("data-plan-iso");
      if (iso && host.openPlanDay) host.openPlanDay(iso);
      return;
    }
    var spontan = t.closest("[data-spontan]");
    if (spontan) {
      if (host.openGoPick) host.openGoPick();
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
  }

  function mergeDiaryComments(map) {
    if (!map || typeof map !== "object") return;
    Object.keys(map).forEach(function (key) {
      if (!state.comments[key]) state.comments[key] = [];
      (map[key] || []).forEach(function (c) {
        if (!c) return;
        state.comments[key].push({
          id: c.id,
          account_id: c.account_id || c.author_id,
          text: c.text || c.body || "",
          created_at: c.created_at
        });
      });
      var pids = state.comments[key].map(function (c) {
        return String(c.account_id);
      });
      ensurePeople(pids);
    });
  }

  function onRootSubmit(e) {
    var nutri = e.target && e.target.closest ? e.target.closest("[data-nutrition-form]") : null;
    if (nutri) {
      e.preventDefault();
      var ta = nutri.querySelector("textarea");
      var text = ta ? ta.value : "";
      if (!String(text || "").trim()) return;
      var save =
        host && host.saveNutritionLog
          ? Promise.resolve(host.saveNutritionLog(text))
          : Promise.resolve();
      save.then(function () {
        if (ta) ta.value = "";
        if (host && host.toast) host.toast("Ernährung gespeichert (privat)");
        refresh();
      });
      return;
    }
    var form = e.target && e.target.closest ? e.target.closest("[data-comment-form]") : null;
    if (!form) return;
    e.preventDefault();
    var eventId = form.getAttribute("data-comment-form");
    var input = form.querySelector(".acc-comment-input");
    var text = input ? input.value : "";
    if (input) input.value = "";
    addComment(eventId, text);
  }

  function refresh() {
    if (!host || !me()) return Promise.resolve();
    var ffcReady = Promise.resolve();
    if (global.FFC && FFC.refreshHeute && FFC.user && FFC.user()) {
      ffcReady = Promise.resolve(FFC.refreshHeute()).catch(function () {});
    }
    var histReady =
      host.prepareHeuteHistory
        ? Promise.resolve(host.prepareHeuteHistory()).catch(function () {})
        : Promise.resolve();
    return ffcReady
      .then(function () {
        return Promise.all([
          loadStreak(),
          loadEigenCourse(),
          loadEnrollments(),
          loadEvents(),
          loadFfcEvents(),
          histReady
        ]);
      })
      .then(function () {
        var ids = state.events.map(function (e) {
          return String(e.id);
        });
        return Promise.all([loadRsvps(ids), loadComments(ids)]);
      })
      .then(function () {
        if (host.heuteDiaryComments) {
          mergeDiaryComments(host.heuteDiaryComments() || {});
        }
      })
      .then(render);
  }

  function install(h) {
    host = h || host || {};
    saveFilter(loadFilter());
    var sel = $("heute-filter-select");
    if (sel) {
      if (host && host.syncHeuteFilterOptions) host.syncHeuteFilterOptions();
      else {
        sel.innerHTML =
          '<option value="ich">Ich</option>' +
          '<option value="team">Team</option>' +
          '<option value="tagebuch">Tagebuch</option>' +
          '<option value="alles">Alles</option>';
      }
      if (!normalizeFilter(sel.value)) sel.value = state.filter || "ich";
      else state.filter = normalizeFilter(sel.value) || "ich";
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
      root.addEventListener("submit", onRootSubmit);
    }
    var doneOk = $("acc-done-ok");
    if (doneOk) doneOk.addEventListener("click", submitDone);
    var doneCancel = $("acc-done-cancel");
    if (doneCancel) doneCancel.addEventListener("click", closeDoneModal);
    var doneModal = $("acc-done-modal");
    if (doneModal && doneModal.dataset.visBound !== "1") {
      doneModal.dataset.visBound = "1";
      doneModal.addEventListener("click", function (e) {
        var row = e.target && e.target.closest ? e.target.closest("[data-acc-vis]") : null;
        if (row) {
          setDoneVis(row.getAttribute("data-acc-vis"));
          return;
        }
        if (e.target === doneModal) closeDoneModal();
      });
      var photo = $("acc-done-photo");
      if (photo) {
        photo.addEventListener("change", function () {
          var label = $("acc-done-file-label");
          if (!label) return;
          var file = photo.files && photo.files[0];
          if (file) {
            label.textContent = file.name || "Datei gewählt";
            label.classList.add("is-picked");
          } else {
            label.textContent = "Datei auswählen";
            label.classList.remove("is-picked");
          }
        });
      }
    }
    interceptGoKinds();
  }

  global.HeuteAccountability = {
    install: install,
    refresh: refresh,
    openDone: openDoneModal,
    setFilter: function (v) {
      saveFilter(v);
      refresh();
    },
    afterKindChosen: afterKindChosen
  };
})(window);
