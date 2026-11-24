/* Heute Accountability (Schritt 3): Ich ⊂ Team ⊂ Tagebuch ⊂ Alles */
(function (global) {
  var host = null;
  var state = {
    waved: {},
    altReplace: null,
    zirkelFor: null,
    events: [],
    invites: {},
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
    pendingVis: "team",
    userScrolledAktuell: false,
    paintedAktuell: false,
    bootNeedsCenter: true,
    refreshSeq: 0
  };

  var FILTER_KEY = "gogogo_heute_filter_v3";
  /* Ich ⊂ Team ⊂ Gruppe ⊂ Tagebuch ⊂ Alles — Gruppe nur wenn vorhanden */
  var VIEW_LEVEL = { ich: 0, team: 1, gruppe: 1, coach: 1, tagebuch: 2, alles: 3, bubble: 3, circle: 3 };

  function viewFlags(view) {
    view = normalizeFilter(view) || "ich";
    var level = VIEW_LEVEL[view] != null ? VIEW_LEVEL[view] : 0;
    return {
      view: view,
      level: level,
      groupOnly: view === "gruppe",
      /* Team = Freunde + Coach/Coachees; Tagebuch = Erledigtes + heute, keine Zukunft */
      teamOnly: view === "team",
      diaryOnly: view === "tagebuch",
      bubbleOnly: view === "bubble",
      /* Coach = nur ich und meine Coachees (auch ihre privaten Events) */
      coachOnly: view === "coach",
      /* Circle = Zirkeltrainings: FFC-Events und -Posts, Zirkel-Events und mit dem Circle geteilte Events */
      circleOnly: view === "circle",
      showIncomingInvites: level >= 1,
      showOwnFfc: true,
      showAcceptedFfc: true,
      showPendingFfcInvites: level >= 1,
      /* Eigene Historie immer; Team-Posts von Freunden ab Team-Filter */
      showOwnHistory: true,
      showFriendsHistory: level >= 1,
      showOthersUpcoming: level >= 1,
      showRsvpdUpcoming: true,
      showPlanDays: true
    };
  }

  function normalizeVisibility(v) {
    /* Legacy-UI/DB: alle|gruppe (Freundeskreis) → team. Neu: gruppe = groups.group_id. */
    if (v === "alle" || v === "all" || v === "friends") return "team";
    if (v === "privat" || v === "team" || v === "gruppe" || v === "bubble" || v === "circle" || v === "coach") return v;
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
    /* Kreise einzeln: Gruppe und Circle sind wieder eigene Ansichten */
    if (String(v || "").indexOf("group:") === 0) return "gruppe";
    /* Tagebuch gibt es im Dropdown nicht mehr → Alles */
    if (v === "tagebuch") return "alles";
    if (["ich", "team", "gruppe", "circle", "alles", "bubble", "coach"].indexOf(v) >= 0) return v;
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

  function inTeamFilter(userId, flags) {
    if (!flags || !flags.teamOnly) return true;
    var uid = String(userId || "");
    if (!uid || uid === me()) return true;
    return (host.teamPeople || []).some(function (p) {
      return p && String(p.id) === uid;
    });
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
    /* Standard „Ich“: neue Nutzer sehen zuerst ihre eigene Woche */
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
    if (v === "bubble") markBubbleSeen();
  }

  /* Neues in der Bubble (Nachricht oder Event eines anderen) → roter Punkt am Herz, egal welcher Filter.
     Gesehen, sobald man auf Bubble schaltet oder die Meldung am Herz öffnet. */
  function bubbleSeenKey() { return "gogogo_bubble_seen_" + me(); }
  function bubbleSeen() { try { return localStorage.getItem(bubbleSeenKey()) || ""; } catch (e) { return ""; } }
  function markBubbleSeen() {
    try { localStorage.setItem(bubbleSeenKey(), new Date().toISOString()); } catch (e) {}
    if (state.heartList) {
      state.heartList = state.heartList.filter(function (x) { return x.kind !== "bubble"; });
      state.lastReply = state.heartList[0] || null;
      try { paintReplyHeart(); } catch (eP) {}
    }
  }
  /* Weitere Meldungen fürs Herz (letzte 7 Tage): Bubble, „Ich möchte mitmachen“, Coaching, Mitteilungen der App */
  function moreHeartItems() {
    var uid = encodeURIComponent(me());
    if (!me()) return Promise.resolve([]);
    var since = new Date(Date.now() - 7 * 86400000).toISOString();
    var sinceQ = encodeURIComponent(since);
    var bid = host && host.bubbleId ? String(host.bubbleId() || "") : "";
    var bSeen = bubbleSeen();
    function openBubble() {
      saveFilter("bubble");
      var sel = $("heute-filter-select");
      if (sel) sel.value = "bubble";
      refresh();
    }
    var jobs = [
      bid ? rest("go_bubble_messages?bubble_id=eq." + encodeURIComponent(bid) + "&author_id=neq." + uid + "&created_at=gte." + sinceQ +
        "&select=id,author_id,body,created_at&order=created_at.desc&limit=20").catch(function () { return []; }) : [],
      bid ? rest("events?bubble_id=eq." + encodeURIComponent(bid) + "&user_id=neq." + uid + "&created_at=gte." + sinceQ +
        "&select=id,user_id,title,created_at&order=created_at.desc&limit=20").catch(function () { return []; }) : [],
      rest("go_event_requests?to_id=eq." + uid + "&or=(status.eq.pending,created_at.gte." + since + ")" +
        "&select=id,event_id,from_id,status,created_at,decided_at,events(title)&order=created_at.desc&limit=20").catch(function () { return []; }),
      rest("go_event_requests?from_id=eq." + uid + "&status=neq.pending&decided_at=gte." + sinceQ +
        "&select=id,event_id,to_id,status,decided_at,events(title)&order=decided_at.desc&limit=20").catch(function () { return []; }),
      rest("go_coachee_requests?and=(or(coach_id.eq." + me() + ",user_id.eq." + me() + "),or(status.eq.pending,created_at.gte." + since + ",decided_at.gte." + since + "))" +
        "&select=id,user_id,coach_id,status,created_at,decided_at&order=created_at.desc&limit=20").catch(function () { return []; }),
      rest("go_messages?or=(to_id.is.null,to_id.eq." + me() + ")&created_at=gte." + sinceQ + "&select=id,body,created_at&order=created_at.desc&limit=20").catch(function () { return []; }),
      /* Freunde haben eine Uhrzeit eingetragen (go-events-time-set.sql); privat filtert die RLS */
      rest("events?user_id=neq." + uid + "&status=eq.geplant&time_set_at=gte." + sinceQ +
        "&starts_at=gte." + encodeURIComponent(new Date(Date.now() - 3 * 3600000).toISOString()) +
        "&select=id,user_id,title,starts_at,time_set_at,visibility&order=time_set_at.desc&limit=30").catch(function () { return []; })
    ];
    var ST = { accepted: "angenommen", declined: "abgelehnt", withdrawn: "zurückgezogen" };
    return Promise.all(jobs).then(function (r) {
      var out = [];
      var first = function (id) { return String(personOf(id).name || "Jemand").split(" ")[0]; };
      (r[0] || []).forEach(function (m) {
        out.push({ kind: "bubblemsg", created_at: m.created_at, author_id: m.author_id, past: String(m.created_at) <= bSeen, body: m.body,
          labelFn: function () { return first(m.author_id) + " in der Bubble" + (m.body ? ": " + String(m.body).slice(0, 80) : ""); }, open: openBubble });
      });
      (r[1] || []).forEach(function (e) {
        out.push({ kind: "bubbleev", created_at: e.created_at, user_id: e.user_id, past: String(e.created_at) <= bSeen,
          labelFn: function () { return first(e.user_id) + " plant in der Bubble: " + (e.title || "Training"); }, open: openBubble });
      });
      (r[2] || []).forEach(function (q) {
        var pend = q.status === "pending";
        out.push({ kind: "joinreq", created_at: pend ? q.created_at : (q.decided_at || q.created_at), from_id: q.from_id, past: !pend,
          labelFn: function () { return first(q.from_id) + " möchte mitmachen: " + ((q.events && q.events.title) || "Training") + (pend ? "" : " · " + (ST[q.status] || q.status)); },
          open: pend && host.promptJoinRequests ? function () { host.promptJoinRequests(); } : (q.event_id ? function () { openReplyEvent(q.event_id); } : null) });
      });
      (r[3] || []).forEach(function (q) {
        /* Antwort auf meine Mitmach-Anfrage: neu (roter Punkt), bis ich das Herz öffne */
        out.push({ kind: "joinans", created_at: q.decided_at, to_id: q.to_id, past: false,
          labelFn: function () { return "Deine Anfrage für " + ((q.events && q.events.title) || "das Training") + " wurde von " + first(q.to_id) + " " + (ST[q.status] || q.status); },
          open: q.event_id ? function () { openReplyEvent(q.event_id); } : null });
      });
      (r[4] || []).forEach(function (c) {
        var toMe = String(c.coach_id) === me();
        /* offene Anfragen an mich als Coach liefert der Host (mit Annehmen/Ablehnen) */
        if (toMe && c.status === "pending") return;
        var at = c.status === "pending" ? c.created_at : (c.decided_at || c.created_at);
        out.push({ kind: "coach", created_at: at, user_id: c.user_id, coach_id: c.coach_id, past: true,
          labelFn: function () {
            if (toMe) return first(c.user_id) + " möchte Dich als Coach · " + (ST[c.status] || c.status);
            return c.status === "pending" ? "Deine Coach-Anfrage an " + first(c.coach_id) + " · offen"
              : first(c.coach_id) + " hat Deine Coach-Anfrage " + (ST[c.status] || c.status);
          } });
      });
      /* Mehr als 2 neue Wochenpläne auf einmal: eine Meldung (wie beim Öffnen der App) */
      var plans = (r[5] || []).filter(function (m) { return /^Neuer Wochenplan/.test(String(m.body || "")); });
      var restMsgs = (r[5] || []).filter(function (m) { return !/^Neuer Wochenplan/.test(String(m.body || "")); });
      if (plans.length > 2) {
        var names = plans.map(function (m) { var mm = String(m.body).match(/„([^“]+)“/); return mm ? mm[1] : ""; }).filter(Boolean);
        out.push({ kind: "msg", created_at: plans[0].created_at, past: true, label: "Es gibt neue Trainingspläne.",
          open: function () { if (global.GoDialog) GoDialog.alert("Es gibt neue Trainingspläne.", { body: names.join(", ") + "\n\nDu findest sie unter Kalender → Stift → Wochenplan ändern." }); } });
      } else restMsgs = restMsgs.concat(plans);
      var friendIds = {};
      (host.teamPeople || []).forEach(function (p) { if (p && p.id) friendIds[String(p.id)] = true; });
      (r[6] || []).forEach(function (e) {
        if (!e || !friendIds[String(e.user_id)] || e.visibility === "privat" || !hasTime(e)) return;
        out.push({ kind: "traintime", created_at: e.time_set_at, user_id: e.user_id, past: false,
          labelFn: function () { return first(e.user_id) + " trainiert " + trainDayLabel(e.starts_at) + " um " + timeLabel(e.starts_at) + ": " + (e.title || "Training"); },
          open: function () { openReplyEvent(e.id); } });
      });
      restMsgs.forEach(function (m) {
        out.push({ kind: "msg", created_at: m.created_at, past: true, label: String(m.body || "Mitteilung").slice(0, 120),
          open: function () { if (global.GoDialog) GoDialog.alert(String(m.body || "")); } });
      });
      return out;
    });
  }
  /* heute / morgen / Wochentag */
  function trainDayLabel(ts) {
    var d = dayKey(ts), t = todayIso();
    if (d === t) return "heute";
    var tm = new Date(t + "T12:00:00Z"); tm.setUTCDate(tm.getUTCDate() + 1);
    if (d === tm.toISOString().slice(0, 10)) return "morgen";
    try { return "am " + new Date(ts).toLocaleDateString("de-DE", { weekday: "long", timeZone: "Europe/Berlin" }); } catch (e) { return "am " + d; }
  }
  function latestBubbleNews() {
    var bid = host && host.bubbleId ? String(host.bubbleId() || "") : "";
    if (!bid || !me() || state.filter === "bubble") return Promise.resolve(null);
    var msg = rest("go_bubble_messages?bubble_id=eq." + encodeURIComponent(bid) + "&author_id=neq." + encodeURIComponent(me()) +
      "&select=created_at&order=created_at.desc&limit=1").catch(function () { return []; });
    var ev = rest("events?bubble_id=eq." + encodeURIComponent(bid) + "&user_id=neq." + encodeURIComponent(me()) +
      "&select=created_at&order=created_at.desc&limit=1").catch(function () { return []; });
    return Promise.all([msg, ev]).then(function (r) {
      var at = [(r[0] && r[0][0] && r[0][0].created_at) || "", (r[1] && r[1][0] && r[1][0].created_at) || ""].sort().pop();
      if (!at || at <= bubbleSeen()) return null;
      return {
        kind: "bubble", created_at: at,
        open: function () {
          saveFilter("bubble");
          var sel = $("heute-filter-select");
          if (sel) sel.value = "bubble";
          refresh();
        }
      };
    });
  }

  function rest(path, opts) {
    return host.rest(path, opts);
  }

  /* Plan-Events ohne gewählte Uhrzeit stehen auf genau 12:00:00 UTC. */
  function hasTime(ev) {
    if (!ev || !ev.starts_at) return false;
    var d = new Date(ev.starts_at);
    if (isNaN(d.getTime())) return false;
    return !(d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0);
  }

  function logActivity(type, refId, meta) {
    var id = me();
    if (!id) return Promise.resolve();
    var body = { user_id: id, type: type, ref_id: refId || null };
    if (meta && typeof meta === "object") body.meta = meta;
    return rest("activity_log", {
      method: "POST",
      prefer: "return=minimal",
      body: body
    }).catch(function () {});
  }

  function personOf(uid) {
    if (!uid) return { id: "", name: "?", photo: "" };
    /* ich: Bild immer aus dem eigenen Konto (Team-Liste hat für mich kein Foto → Gruppen-Event zeigte nur „M“) */
    if (String(uid) === me() && host.sessionAccount && host.sessionAccount.photo_url &&
        !(state.people[uid] && state.people[uid].photo)) {
      state.people[uid] = { id: me(), name: host.sessionAccount.name || "Ich", photo: host.sessionAccount.photo_url };
    }
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

  /* Einverständnis: Events/Historie anderer nur, wenn sie geteilt haben (Profil "Historie teilen").
     friends = Freunde, Gruppe und Coach; trainer = nur der eigene Coach; private = niemand */
  function loadShareConsent(ids) {
    var uniq = [];
    ids.forEach(function (id) {
      id = String(id || "");
      if (id && id !== me() && uniq.indexOf(id) < 0) uniq.push(id);
    });
    if (!state.share) state.share = {};
    if (!uniq.length) return Promise.resolve();
    return rest(
      "go_accounts?id=in.(" + uniq.map(encodeURIComponent).join(",") + ")&select=id,diary_visibility,trainer_id"
    )
      .then(function (rows) {
        (rows || []).forEach(function (r) {
          if (!r || !r.id) return;
          state.share[String(r.id)] = {
            vis: r.diary_visibility || "private",
            coach: r.trainer_id ? String(r.trainer_id) : ""
          };
        });
      })
      .catch(function () {});
  }

  /* Ich bin Coach dieser Person (go_accounts.trainer_id) */
  function isMyCoachee(uid) {
    uid = String(uid || "");
    if (!uid || uid === me()) return false;
    var s = state.share && state.share[uid];
    if (s && s.coach) return s.coach === me();
    return (host.teamPeople || []).some(function (p) { return p && String(p.id) === uid && String(p.trainer_id || "") === me(); });
  }
  function ownerShares(uid) {
    uid = String(uid || "");
    if (!uid || uid === me()) return true;
    var s = state.share && state.share[uid];
    if (!s) return false;
    /* Coach sieht seine Coachees immer */
    if (s.coach && s.coach === me()) return true;
    if (s.vis === "friends") return true;
    if (s.vis === "trainer") return s.coach === me();
    return false;
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

  /* Zirkel-Einstellungen liegen in events.note: "zirkel:team|work=240|pause=30|rounds=7" */
  function parseZirkelNote(note) {
    return global.GoZirkelSetup ? GoZirkelSetup.parse(note) : null;
  }

  function zirkelLabel(z) {
    return global.GoZirkelSetup ? GoZirkelSetup.label(z) : "";
  }

  /* CTA unter Zirkel-Events mit Option "online mitmachen" */
  function onlineCtaHtml(ev) {
    var z = parseZirkelNote(ev && ev.note);
    if (!z || !z.online || ev.status === "erledigt") return "";
    return (
      '<button type="button" class="go-online-cta" data-online-join="' +
      esc(ev.id) +
      '">Online mitmachen</button>'
    );
  }

  function joinOnline(eventId) {
    var ev = (state.events || []).filter(function (e) {
      return String(e.id) === String(eventId);
    })[0];
    if (!ev) return;
    var z = parseZirkelNote(ev.note);
    var start = new Date(ev.starts_at).getTime();
    var live = isFinite(start) && Date.now() >= start - 10 * 60000;
    var mine = String(ev.user_id) === String(me());
    if (!mine && !iAmGoing(eventId)) toggleRsvp(eventId);
    if (live) {
      if (host.openZirkel) host.openZirkel(Object.assign({ eventId: String(ev.id) }, z));
      return;
    }
    if (host.toast) host.toast("Du bist online dabei. Zum Start hier wieder tippen.");
  }

  /* Zirkel Double: Paare unter dem Event; Ersteller-Partner steht in der Note */
  function zirkelPairs(ev) {
    var z = parseZirkelNote(ev && ev.note);
    if (!z || z.mode !== "double") return null;
    var eid = String(ev.id);
    var owner = String(ev.user_id || "");
    var going = (state.rsvps[eid] || []).slice();
    var partners = (state.rsvpPartner && state.rsvpPartner[eid]) || {};
    var used = {};
    var pairs = [];
    used[owner] = true;
    if (z.partnerId) used[String(z.partnerId)] = true;
    pairs.push([personOf(owner).name, z.partnerName || (z.partnerId ? personOf(z.partnerId).name : "")]);
    going.forEach(function (uid) {
      if (used[uid]) return;
      used[uid] = true;
      var p = partners[uid];
      if (p && p.id && going.indexOf(p.id) >= 0 && !used[p.id]) {
        used[p.id] = true;
        pairs.push([personOf(uid).name, personOf(p.id).name]);
        return;
      }
      if (p && p.id && going.indexOf(p.id) >= 0) return;
      pairs.push([personOf(uid).name, p ? p.name || (p.id ? personOf(p.id).name : "") : ""]);
    });
    return { pairs: pairs, mine: partners[me()], going: going, owner: owner, ownerPartner: z.partnerId || "" };
  }

  function zirkelPairsHtml(ev) {
    var info = zirkelPairs(ev);
    if (!info) return "";
    var line = info.pairs
      .map(function (pr) {
        return pr[1] ? esc(pr[0]) + " &amp; " + esc(pr[1]) : esc(pr[0]) + " sucht Partner";
      })
      .join(" · ");
    var meId = me();
    var iGo = info.going.indexOf(meId) >= 0 && meId !== info.owner && meId !== String(info.ownerPartner);
    return (
      '<p class="acc-card__desc gz-pairs">Paare: ' + line + "</p>" +
      (iGo
        ? '<button type="button" class="go-online-cta go-online-cta--ghost" data-zpartner="' + esc(ev.id) + '">' +
          (info.mine ? "Partner ändern" : "Partner wählen") + "</button>"
        : "")
    );
  }

  function openPartnerSheet(eventId) {
    var ev = (state.events || []).filter(function (e) {
      return String(e.id) === String(eventId);
    })[0];
    var info = ev && zirkelPairs(ev);
    if (!info) return;
    var partners = (state.rsvpPartner && state.rsvpPartner[String(eventId)]) || {};
    var taken = {};
    taken[me()] = true;
    taken[info.owner] = true;
    if (info.ownerPartner) taken[String(info.ownerPartner)] = true;
    Object.keys(partners).forEach(function (uid) {
      if (uid === me()) return;
      var p = partners[uid];
      if (p && (p.id || p.name)) {
        taken[uid] = true;
        if (p.id && p.id !== me()) taken[p.id] = true;
      }
    });
    var cands = [];
    var seen = {};
    info.going.forEach(function (uid) {
      if (!taken[uid] && !seen[uid]) { seen[uid] = 1; cands.push({ id: uid, name: personOf(uid).name, tag: "dabei" }); }
    });
    (host.teamPeople || []).forEach(function (p) {
      var uid = p && String(p.id);
      if (uid && !taken[uid] && !seen[uid]) { seen[uid] = 1; cands.push({ id: uid, name: p.name || p.nickname || "Freund" }); }
    });
    var box = document.createElement("div");
    box.className = "gz-psheet";
    box.innerHTML =
      '<div class="gz-psheet__card" role="dialog" aria-modal="true">' +
      "<h3>Dein Partner</h3>" +
      '<p class="gz-psheet__hint">Ihr wechselt euch ab. Wähle jemanden oder trag einen Namen ein.</p>' +
      '<div class="gz-partner__list">' +
      cands.slice(0, 24).map(function (c) {
        return '<button type="button" class="gz-pf" data-pid="' + esc(c.id) + '">' + esc(c.name) +
          (c.tag ? " · " + c.tag : "") + "</button>";
      }).join("") +
      "</div>" +
      '<input type="text" class="gz-partner__name" maxlength="40" placeholder="Name eintragen" />' +
      '<button type="button" class="gz-psheet__save">Speichern</button>' +
      '<button type="button" class="gz-psheet__skip">Ohne Partner</button>' +
      "</div>";
    document.body.appendChild(box);
    var picked = "";
    function close() {
      if (box.parentNode) box.parentNode.removeChild(box);
    }
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest(".gz-psheet__skip")) { close(); return; }
      var b = e.target.closest("[data-pid]");
      if (b) {
        picked = b.classList.contains("is-on") ? "" : b.getAttribute("data-pid");
        box.querySelectorAll("[data-pid]").forEach(function (x) {
          x.classList.toggle("is-on", x === b && !!picked);
        });
        if (picked) box.querySelector(".gz-partner__name").value = "";
        return;
      }
      if (e.target.closest(".gz-psheet__save")) {
        var name = String(box.querySelector(".gz-partner__name").value || "").trim();
        if (!picked && !name) { close(); return; }
        rest("rpc/go_set_zirkel_partner", {
          method: "POST",
          body: { p_event_id: String(eventId), p_user_id: me(), p_partner_id: picked || null, p_partner_name: picked ? null : name }
        })
          .then(function () {
            close();
            if (host.toast) host.toast("Partner gespeichert");
            return refresh();
          })
          .catch(function () {
            if (host.toast) host.toast("Partner speichern fehlt noch (go-zirkel-partner.sql)");
          });
      }
    });
  }

  function loadZirkelCourse() {
    if (state.zirkelCourseId) return Promise.resolve(state.zirkelCourseId);
    return rest("courses?slug=eq.training-zirkel&select=id&limit=1")
      .then(function (rows) {
        state.zirkelCourseId = rows && rows[0] && rows[0].id ? String(rows[0].id) : null;
        return state.zirkelCourseId;
      })
      .catch(function () {
        return null;
      });
  }

  function loadEigenCourse() {
    function takeId(created) {
      var row = Array.isArray(created) ? created[0] : created;
      state.eigenCourseId = row && row.id ? String(row.id) : null;
      return state.eigenCourseId;
    }
    function createCourse(body) {
      return rest("courses", {
        method: "POST",
        prefer: "return=representation,resolution=merge-duplicates",
        body: body
      }).then(takeId);
    }
    return rest("courses?slug=eq.eigenes-training&select=id&limit=1")
      .then(function (rows) {
        if (rows && rows[0] && rows[0].id) {
          state.eigenCourseId = String(rows[0].id);
          return state.eigenCourseId;
        }
        /* Systemkurs fehlte — anlegen (statt SQL-Toast) */
        return createCourse({
          title: "Eigenes Training",
          slug: "eigenes-training",
          price_eur: 0,
          description: "Systemkurs für außerplanmäßige Starts",
          source: "own",
          is_active: true,
          is_system: true
        }).catch(function () {
          return createCourse({
            title: "Eigenes Training",
            slug: "eigenes-training",
            price_eur: 0,
            description: "Eigenes Training",
            source: "own",
            is_active: true
          });
        });
      })
      .catch(function () {
        state.eigenCourseId = null;
        return null;
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

  /* Eingehende Einladungen (an ein Event gebunden, nicht verfallen) */
  function loadMyInvites() {
    var id = me();
    state.invites = {};
    if (!id) return Promise.resolve();
    return rest(
      "go_workout_invites?to_id=eq." +
        encodeURIComponent(id) +
        "&event_id=not.is.null&status=in.(pending,accepted)&workout_date=gte." +
        encodeURIComponent(todayIso()) +
        "&select=id,event_id,status,from_id"
    )
      .then(function (rows) {
        (rows || []).forEach(function (r) {
          if (!r || !r.event_id) return;
          var key = String(r.event_id);
          var prev = state.invites[key];
          if (!prev || r.status === "accepted") state.invites[key] = r;
        });
        var have = {};
        (state.events || []).forEach(function (e) {
          have[String(e.id)] = true;
        });
        var missing = Object.keys(state.invites).filter(function (k) {
          return !have[k];
        });
        if (!missing.length) return null;
        return rest(
          "events?id=in.(" +
            missing.map(encodeURIComponent).join(",") +
            ")&select=id,user_id,course_id,enrollment_id,category,starts_at,location,visibility,is_unplanned,status,title,item_type,photo_url,note"
        ).then(function (rows2) {
          state.events = (state.events || []).concat(rows2 || []);
        });
      })
      .catch(function () {
        state.invites = {};
      })
      .then(function () {
        /* Angenommene Einladungen ohne Event (z. B. Zirkel von Freunden): als eigenes Event im Feed */
        /* nicht vorab leeren: parallele Renders würden die Karten sonst kurz verlieren */
        var freeJob = rest("go_workout_invites?to_id=eq." + encodeURIComponent(id) +
          "&event_id=is.null&status=eq.accepted&workout_date=gte." + encodeURIComponent(todayIso()) +
          "&select=id,from_id,workout_date,workout_label,meet_time,place,status&order=workout_date.asc")
          .then(function (rows) { state.freeInvites = rows || []; })
          .catch(function () {});
        /* angenommene Einladungen zu meinen Events: Freund → meine Event-IDs (gegen Dopplung) */
        state.sentAccepted = {};
        var sentJob = rest("go_workout_invites?from_id=eq." + encodeURIComponent(id) + "&status=eq.accepted&event_id=not.is.null&workout_date=gte." +
          encodeURIComponent(todayIso()) + "&select=event_id,to_id")
          .then(function (rows) {
            (rows || []).forEach(function (r) {
              var k = String(r.to_id);
              (state.sentAccepted[k] = state.sentAccepted[k] || {})[String(r.event_id)] = true;
            });
          })
          .catch(function () {});
        /* eigene offene Anfragen (Winken) bleiben nach Neuladen ausgegraut */
        return Promise.all([freeJob, sentJob, rest("go_event_requests?from_id=eq." + encodeURIComponent(id) + "&status=eq.pending&select=event_id")
          .then(function (rows) {
            (rows || []).forEach(function (r) { if (r && r.event_id) state.waved[String(r.event_id)] = true; });
          })
          .catch(function () {})]);
      });
  }

  function inviteFor(eventId) {
    return (state.invites || {})[String(eventId)] || null;
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
    var fullSel = "id,user_id,course_id,enrollment_id,category,starts_at,location,visibility,is_unplanned,status,title,item_type,photo_url,note,assigned_by,course_session_id";
    var range = "&starts_at=gte." + encodeURIComponent(fromIso) + "&starts_at=lte." + encodeURIComponent(toIso) + "&order=starts_at.desc&limit=500";
    /* bubble_id erst nach go-bubbles.sql vorhanden; group_id für Gruppen-Events (Gruppenname statt Vorname) */
    /* feed_hidden: „Speichern ohne Posting“ (go-events-feed-hidden.sql) */
    return rest("events?select=" + fullSel + ",bubble_id,group_id,feed_hidden" + range)
      .catch(function () { return rest("events?select=" + fullSel + ",bubble_id,group_id" + range); })
      .catch(function () { return rest("events?select=" + fullSel + ",bubble_id" + range); })
      .catch(function () {
        return rest("events?select=" + fullSel + range);
      })
      .catch(function () {
        return rest(
          "events?select=id,user_id,course_id,enrollment_id,category,starts_at,location,visibility,is_unplanned,status,title,item_type,photo_url,note&starts_at=gte." +
            encodeURIComponent(fromIso) +
            "&starts_at=lte." +
            encodeURIComponent(toIso) +
            "&order=starts_at.desc&limit=500"
        );
      })
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
        /* Abgesagte Plan-Tage merken, damit der Wochenplan dort nicht wieder auftaucht */
        state.skippedDays = {};
        (rows || []).forEach(function (r) {
          if (r && r.status === "ausgefallen" && String(r.user_id) === String(id)) {
            state.skippedDays[dayKey(r.starts_at)] = true;
          }
        });
        state.events = dedupeEvents(rows || []);
        return mergeEventMediaFromActivity(state.events).then(function () {
          var ids = state.events.map(function (e) {
            return String(e.user_id);
          });
          return Promise.all([ensurePeople(ids), loadShareConsent(ids)]);
        });
      })
      .catch(function () {
        state.events = [];
      });
  }

  function eventMediaMarker(eventId) {
    return "[[e:" + String(eventId) + "]]";
  }

  function unpackEventMediaPayload(raw) {
    if (!raw) return null;
    var s = String(raw);
    if (s.charAt(0) === "{") {
      try {
        var o = JSON.parse(s);
        if (o && (o.note != null || o.photo || o.photo_url)) {
          return {
            note: o.note != null ? String(o.note) : "",
            photo_url: o.photo_url || o.photo || ""
          };
        }
      } catch (e) {}
    }
    if (s.indexOf("data:image") === 0 || /^https?:\/\//i.test(s)) {
      return { note: "", photo_url: s };
    }
    return null;
  }

  function mergeEventMediaFromPosts(events) {
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
          var packed = unpackEventMediaPayload(r.photo_url);
          var noteFromBody = body.replace(/\[\[e:[0-9a-f-]{36}\]\]/i, "").trim();
          byRef[rid] = {
            note: (packed && packed.note) || noteFromBody || "",
            photo_url: (packed && packed.photo_url) || (!packed && r.photo_url) || ""
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

  function saveEventMediaFallback(eventId, note, photo) {
    var id = me();
    if (!id || !eventId) return Promise.resolve();
    if (!note && !photo) return Promise.resolve();
    var marker = eventMediaMarker(eventId);
    var payload = JSON.stringify({
      note: note || "",
      photo: photo || ""
    });
    return rest("go_community_posts", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        author_id: id,
        kind: photo ? "photo" : "text",
        body: marker.slice(0, 144),
        photo_url: payload
      }
    }).catch(function () {});
  }

  function mergeEventMediaFromActivity(events) {
    return mergeEventMediaFromPosts(events);
  }

  /* Zirkel-Login gehört zu einem anderen gogogo-Konto (index.html GoFfcSession): nichts davon zeigen */
  function ffcUsable() {
    if (!global.FFC || !FFC.user || !FFC.user()) return false;
    return !(global.GoFfcSession && GoFfcSession.foreign && GoFfcSession.foreign());
  }

  function loadFfcEvents() {
    state.ffcEvents = [];
    if (!ffcUsable() || !FFC.events) return Promise.resolve();
    try {
      state.ffcEvents = FFC.events() || [];
    } catch (e) {
      state.ffcEvents = [];
    }
    return Promise.resolve();
  }

  function loadFfcPosts() {
    state.ffcPosts = [];
    if (!ffcUsable()) return Promise.resolve();
    var load =
      FFC.refreshFeed
        ? Promise.resolve(FFC.refreshFeed())
        : Promise.resolve(FFC.feedPosts ? FFC.feedPosts() : []);
    return load
      .then(function (posts) {
        state.ffcPosts = posts || [];
      })
      .catch(function () {
        state.ffcPosts = [];
      });
  }

  /* Zusagen laden. Zwei gleichzeitige Aufrufe (Refresh kurz hintereinander) haben früher beide in dieselbe,
     vorher geleerte Liste geschrieben → jede Person doppelt unter dem Event. Jetzt: eigene Liste je Aufruf,
     nur der letzte Aufruf schreibt, jede Person nur einmal. */
  var rsvpSeq = 0;
  function loadRsvps(eventIds) {
    var seq = ++rsvpSeq;
    if (!eventIds.length) { state.rsvps = {}; state.rsvpPartner = {}; return Promise.resolve(); }
    var nextRsvps = {};
    var nextPartner = {};
    var base =
      "event_rsvps?event_id=in.(" +
      eventIds.map(encodeURIComponent).join(",") +
      ")&status=eq.zugesagt&select=event_id,user_id";
    return rest(base + ",partner_id,partner_name")
      .catch(function () {
        return rest(base);
      })
      .then(function (rows) {
        if (seq !== rsvpSeq) return;
        var partnerIds = [];
        (rows || []).forEach(function (r) {
          var eid = String(r.event_id);
          if (!nextRsvps[eid]) nextRsvps[eid] = [];
          if (nextRsvps[eid].indexOf(String(r.user_id)) < 0) nextRsvps[eid].push(String(r.user_id));
          if (r.partner_id || r.partner_name) {
            if (!nextPartner[eid]) nextPartner[eid] = {};
            nextPartner[eid][String(r.user_id)] = {
              id: r.partner_id ? String(r.partner_id) : "",
              name: r.partner_name || ""
            };
            if (r.partner_id) partnerIds.push(String(r.partner_id));
          }
        });
        state.rsvps = nextRsvps;
        state.rsvpPartner = nextPartner;
        if (partnerIds.length) ensurePeople(partnerIds);
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

  function commentMarker(eventId) {
    return "[[c:" + String(eventId) + "]]";
  }

  function parseCommentMarker(body) {
    var m = String(body || "").match(/\[\[c:([^\]]+)\]\]/i);
    return m ? String(m[1]) : "";
  }

  function pushComment(eid, c) {
    eid = String(eid || "");
    if (!eid || !c) return;
    if (!state.comments[eid]) state.comments[eid] = [];
    var id = String(c.id || "");
    var exists = state.comments[eid].some(function (x) {
      return String(x.id) === id;
    });
    if (exists) return;
    state.comments[eid].push({
      id: c.id,
      account_id: c.account_id || c.author_id,
      text: c.text || "",
      created_at: c.created_at,
      reply_to_account: c.reply_to_account || null
    });
  }

  function loadCommentFallbacks(eventIds) {
    var want = {};
    (eventIds || []).forEach(function (id) {
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
          var eid = parseCommentMarker(body);
          if (!eid) return;
          if (eventIds && eventIds.length && !want[eid]) return;
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
          pushComment(eid, {
            id: r.id,
            account_id: r.author_id,
            text: text,
            created_at: r.created_at
          });
        });
      })
      .catch(function () {});
  }

  function loadSyntheticCommentKeys(keys) {
    var list = (keys || []).map(String).filter(Boolean);
    if (!list.length) return Promise.resolve();
    return loadCommentFallbacks(list);
  }

  function loadComments(eventIds) {
    var preserved = {};
    Object.keys(state.comments || {}).forEach(function (k) {
      preserved[k] = (state.comments[k] || []).filter(function (c) {
        return c && String(c.id).indexOf("local-") === 0;
      });
    });
    state.comments = {};
    if (!eventIds.length) {
      Object.keys(preserved).forEach(function (k) {
        preserved[k].forEach(function (c) {
          pushComment(k, c);
        });
      });
      return Promise.resolve();
    }
    function cq(extra) {
      return rest(
        "event_comments?event_id=in.(" +
          eventIds.map(encodeURIComponent).join(",") +
          ")&select=id,event_id,account_id,text,created_at" + extra + "&order=created_at.asc&limit=500"
      );
    }
    /* reply_to_account erst nach go-comment-replies.sql */
    return cq(",reply_to_account")
      .catch(function () { return cq(""); })
      .then(function (rows) {
        (rows || []).forEach(function (c) {
          pushComment(c.event_id, c);
        });
      })
      .catch(function () {})
      .then(function () {
        return loadCommentFallbacks(eventIds);
      })
      .then(function () {
        Object.keys(preserved).forEach(function (k) {
          preserved[k].forEach(function (c) {
            pushComment(k, c);
          });
        });
        var pids = [];
        Object.keys(state.comments).forEach(function (k) {
          state.comments[k].forEach(function (c) {
            if (c.account_id) pids.push(String(c.account_id));
          });
        });
        return ensurePeople(pids);
      });
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
    /* Plan-Events ohne gewählte Uhrzeit (12:00 UTC): keine Uhrzeit anzeigen */
    if (!hasTime({ starts_at: isoTs })) return "";
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

  /* Countdown in den Karten läuft mit (jede halbe Minute), auch ohne neues Laden */
  var whenTicker = null;
  function tickWhenLines() {
    var els = document.querySelectorAll(".acc-card__when[data-when-ts]");
    [].forEach.call(els, function (el) {
      var ts = el.getAttribute("data-when-ts");
      var oldBase = el.getAttribute("data-when-base") || "";
      var txt = el.textContent || "";
      if (!ts || txt.indexOf(oldBase) !== 0) return;
      var nb = whenLine(ts);
      if (nb === oldBase) return;
      el.textContent = nb + txt.slice(oldBase.length);
      el.setAttribute("data-when-base", nb);
    });
  }
  function startWhenTicker() {
    if (whenTicker) return;
    whenTicker = setInterval(tickWhenLines, 30000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) tickWhenLines(); });
  }

  /* Zirkel heute mit Uhrzeit: Countdown-Pille (läuft sekündlich über den Woche-Ticker) und für den
     Ersteller „Countdown anhalten/starten“ – dieselben Pillen wie in Woche */
  function zirkelPillsHtml(ev) {
    if (!ev || ev.category !== "zirkel" || ev.status === "erledigt" || !hasTime(ev)) return "";
    if (dayKey(ev.starts_at) !== todayIso()) return "";
    var z = global.GoZirkelSetup ? GoZirkelSetup.parse(ev.note) : null;
    var start = new Date(ev.starts_at).getTime();
    var target = z && z.goAt ? z.goAt : start;
    var held = !!(z && z.hold && !z.goAt);
    var total = z ? GoZirkelSetup.totalSec(z) * 1000 : 0;
    if (!held && total && Date.now() > target + total) return "";
    var cd;
    if (held) cd = '<span class="wr-zirkel-cd">Angehalten</span>';
    else if (target > Date.now()) {
      var sec = Math.floor((target - Date.now()) / 1000);
      var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
      cd = '<span class="wr-zirkel-cd" data-wr-cd-start="' + target + '">' + (h ? h + ":" : "") +
        (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x + "</span>";
    } else cd = '<span class="wr-zirkel-cd">läuft</span>';
    var admin = z && String(ev.user_id) === me()
      ? '<button type="button" class="go-online-cta go-online-cta--ghost" data-acc-zadmin="' + (held ? "go" : "hold") + '" data-id="' + esc(ev.id) + '">' +
        (held ? "Starten" : "Anhalten") + "</button>" +
        (held || target > Date.now() + 15000
          ? '<button type="button" class="go-online-cta go-online-cta--ghost" data-acc-zadmin="now" data-id="' + esc(ev.id) + '">Sofortstart</button>'
          : "")
      : "";
    return '<div class="wr-zrow acc-zrow">' + cd + admin + "</div>";
  }

  /* Zirkel vom Ersteller angehalten bzw. neu gestartet (events.note hold/go): für alle Teilnehmer sichtbar */
  function zirkelWhen(ev) {
    if (!ev || !ev.note || !global.GoZirkelSetup) return "";
    var z = GoZirkelSetup.parse(ev.note);
    if (!z || dayKey(ev.starts_at) !== todayIso() || ev.status === "erledigt") return "";
    var base = "Heute" + (timeLabel(ev.starts_at) ? " · " + timeLabel(ev.starts_at) : "");
    if (z.hold && !z.goAt) return base + " · Countdown angehalten";
    if (z.goAt) {
      var ms = z.goAt - Date.now();
      if (ms > 0) return base + " · Start in " + Math.max(1, Math.ceil(ms / 60000)) + " Min.";
      return base + " · läuft";
    }
    return "";
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
    var sep = t ? " · " + t : "";
    if (day === today && t) {
      /* Countdown bis zum Start */
      var ms = new Date(isoTs).getTime() - Date.now();
      if (ms > 60000) {
        var h = Math.floor(ms / 3600000), mi = Math.ceil((ms % 3600000) / 60000);
        if (mi === 60) { h += 1; mi = 0; }
        sep += " · in " + (h ? h + " Std. " : "") + (mi || !h ? mi + " Min." : "").trim();
        sep = sep.replace(/\s+$/, "");
      } else if (ms > -60000) {
        sep += " · jetzt";
      }
    }
    if (day === today) return "Heute" + sep;
    if (day === tom) return "Morgen" + sep;
    try {
      var label = new Date(isoTs).toLocaleDateString("de-DE", {
        timeZone: "Europe/Berlin",
        weekday: "short",
        day: "numeric",
        month: "short"
      });
      return label.replace(/\.$/, "") + sep;
    } catch (e) {
      return day + sep;
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

  /* Für die Begrüßung beim nächsten App-Start: heute schon erledigt? nächstes Event heute? */
  function saveTodayHint() {
    try {
      var list = myTodayEvents();
      var now = Date.now();
      var next = list.filter(function (e) {
        return e.status !== "erledigt" && (!hasTime(e) || new Date(e.starts_at).getTime() > now - 30 * 60000);
      })[0];
      localStorage.setItem("go_today_hint", JSON.stringify({
        d: todayIso(),
        done: list.some(function (e) { return e.status === "erledigt"; }),
        next: next ? { title: String(next.title || "Training").replace(/^[^A-Za-zÄÖÜäöü0-9]+\s*/, ""), time: timeLabel(next.starts_at) } : null
      }));
    } catch (e) {}
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

  function duplicateOfMine(ev) {
    var mineIds = (state.sentAccepted || {})[String(ev.user_id)];
    if (!mineIds) return false;
    var d = dayKey(ev.starts_at);
    return (state.events || []).some(function (m) {
      if (!mineIds[String(m.id)] || String(m.user_id) !== me()) return false;
      return dayKey(m.starts_at) === d &&
        (String(m.starts_at) === String(ev.starts_at) || String(m.title || "") === String(ev.title || ""));
    });
  }
  function eventVisibleToMe(ev, flags) {
    if (!ev) return false;
    var uid = me();
    var mine = String(ev.user_id) === uid;
    var vis = normalizeVisibility(ev.visibility);
    /* Coach sieht die Events seiner Coachees immer, auch privat und „Nur Coach“ (RLS: go_is_coach_of) */
    var coachSees = !mine && isMyCoachee(ev.user_id);
    if (flags.coachOnly && !mine && !coachSees) return false;
    /* privat und coach (go-visibility-coach.sql): nur Ersteller, Coach und Eingeladene/Zugesagte (go-events-invited.sql) */
    if ((vis === "privat" || vis === "coach") && !mine && !coachSees && !inviteFor(ev.id) && !iAmGoing(ev.id)) return false;
    /* Bubble-Events von Nicht-Freunden nur im Bubble-Filter */
    if (!mine && ev.bubble_id && !(host.teamPeople || []).some(function (p) { return p && String(p.id) === String(ev.user_id); })) return false;
    if (ev.status === "ausgefallen") return false;
    var now = Date.now();
    var week = now + 7 * 86400000;
    var t = new Date(ev.starts_at).getTime();
    var inv = !mine ? inviteFor(ev.id) : null;
    /* Nicht abgehakt und Tag vorbei: in keiner Ansicht (auch nicht über Einladung) */
    if (ev.status === "geplant" && dayKey(ev.starts_at) < dayKey(new Date(now).toISOString())) return false;
    /* Freund hat meine Einladung angenommen: sein eigenes gleiches Event nicht doppelt zeigen */
    if (!mine && ev.status === "geplant" && duplicateOfMine(ev)) return false;
    if (inv && ev.status === "geplant") {
      /* angenommen: überall wie eigene Zusage; offen: ab Team */
      if (inv.status === "accepted") return true;
      return !!flags.showOthersUpcoming;
    }
    /* Freund verbunden, aber nicht im Feed (Team → Meine Freunde): seine Events nur, wenn ich dabei bin */
    if (!mine && !inv && host.feedMuted && host.feedMuted[String(ev.user_id)] && !iAmGoing(ev.id)) return false;
    if (ev.status === "geplant") {
      /* Eigene Events von heute bleiben bis Mitternacht sichtbar, damit man sie nachträglich abschließen kann */
      if (mine && t <= week && dayKey(ev.starts_at) === dayKey(new Date(now).toISOString())) return true;
      /* Kreise oben (todayAll): heutige Trainings der Freunde bis Mitternacht, auch wenn die Uhrzeit vorbei ist
         (Plan-Events ohne Uhrzeit stehen auf 12:00 UTC und fielen sonst ab 14 Uhr raus) */
      var todayKeep = flags.todayAll && dayKey(ev.starts_at) === dayKey(new Date(now).toISOString());
      if ((t < now - 3600000 && !todayKeep) || t > week) return false;
      if (mine) return true;
      if (flags.showRsvpdUpcoming && iAmGoing(ev.id)) {
        return inGroupFilter(ev.user_id, flags);
      }
      if (!flags.showOthersUpcoming) return false;
      /* Kommende Events: „zeigen“ am Event reicht (Historie teilen gilt nur für Vergangenes) */
      if (coachSees) return true;
      if (!inTeamFilter(ev.user_id, flags)) return false;
      if (!(vis === "team" || vis === "gruppe")) return false;
      return inGroupFilter(ev.user_id, flags);
    }
    if (ev.status === "erledigt") {
      /* ohne Posting gespeichert: auch im eigenen Verlauf nicht zeigen */
      if (ev.feed_hidden) return false;
      if (mine) return !!flags.showOwnHistory;
      if (coachSees && flags.showFriendsHistory) return true;
      if (!flags.showFriendsHistory || !(vis === "team" || vis === "gruppe")) return false;
      /* Profilreihe (todayAll): heute erledigtes Event ist die Story des Tages, gilt ohne „Historie teilen“ */
      var todayStory = flags.todayAll && dayKey(ev.starts_at) >= (flags.storyFrom || dayKey(new Date(now).toISOString()));
      if (!todayStory && !ownerShares(ev.user_id) && !iAmGoing(ev.id)) return false;
      if (!inTeamFilter(ev.user_id, flags)) return false;
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

  /* Kommentare: grundsätzlich zwei Zeilen, Rest mit „mehr“ (ab ca. 80 Zeichen) */
  var CMT_CLAMP = 80;
  function commentLineHtml(c) {
    var p = personOf(c.account_id);
    var long = String(c.text || "").length + String(p.name || "").length > CMT_CLAMP;
    return (
      '<div class="acc-comment acc-clamp"><span class="acc-clamp__text"><strong>' +
      esc(p.name) +
      "</strong>&nbsp;&nbsp;" +
      esc(c.text) +
      "</span>" +
      (long ? '<button type="button" class="acc-clamp__more" data-cmt-more>mehr</button>' : "") +
      "</div>"
    );
  }
  /* Unter dem Event: neuester Kommentar in zwei Zeilen, „mehr“ am Ende der letzten Zeile.
     „mehr“ klappt den ganzen neuesten Kommentar und die älteren auf. */
  function commentsTeaserHtml(postId) {
    var list = (state.comments[postId] || []).filter(function (c) { return c && c.text; });
    if (!list.length) return "";
    function line(c) {
      var nm = String(personOf(c.account_id).name || "").split(" ")[0];
      var to = c.reply_to_account ? String(personOf(c.reply_to_account).name || "").split(" ")[0] : "";
      return "<strong>" + esc(nm) + "</strong>&nbsp;&nbsp;" + (to ? '<span class="acc-cmt-to">@' + esc(to) + "</span> " : "") + esc(c.text);
    }
    /* Tipp auf einen fremden Kommentar: darauf antworten */
    function replyAttr(c) {
      return c.account_id && String(c.account_id) !== me() && String(c.id || "").indexOf("local-") !== 0
        ? ' data-reply-cmt="' + esc(c.id) + '" data-reply-acc="' + esc(c.account_id) + '" data-reply-post="' + esc(postId) + '"'
        : "";
    }
    var last = list[list.length - 1];
    var older = list.slice(0, -1);
    var nmLast = String(personOf(last.account_id).name || "").split(" ")[0];
    var long = older.length > 0 || nmLast.length + String(last.text).length + 1 > 44;
    var isOpen = long && state.cmtOpen && state.cmtOpen[String(postId)];
    return '<div class="acc-card__teaser acc-clamp' + (long ? " has-more" : "") + (isOpen ? " is-open" : "") + '">' +
      (older.length ? '<div class="acc-clamp__older">' + older.map(function (c) { return "<p" + replyAttr(c) + ">" + line(c) + "</p>"; }).join("") + "</div>" : "") +
      /* div statt button: Safari kürzt Text in Buttons nicht */
      '<div class="acc-card__my-line acc-clamp__text acc-clamp__one" role="button" tabindex="0" data-open-comments="' + esc(postId) + '"' + replyAttr(last) + ">" + line(last) + "</div>" +
      (long ? '<button type="button" class="acc-clamp__more" data-cmt-more>' + (isOpen ? "weniger" : "mehr") + "</button>" : "") +
      "</div>";
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

  function checkSvg(done) {
    if (done) {
      return (
        '<svg class="acc-act-ico wr-ico acc-act-ico--done" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9" fill="#111"/>' +
        '<path d="M8 12.5l2.5 2.5L16 9.5" fill="none" stroke="#F6F1E8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        "</svg>"
      );
    }
    return (
      '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>'
    );
  }

  function badgeSvg(kind) {
    if (kind === "coach") {
      /* Vom Coach eingetragen / Wochenplan des Coaches: Klemmbrett */
      return (
        '<svg class="acc-badge-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3.5h6v1"/><rect x="9" y="3" width="6" height="3" rx="1"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/></svg>'
      );
    }
    if (kind === "plan") {
      /* Gleich wie Pill-Woche: breites Kalenderblatt + eine Linie */
      return (
        '<svg class="acc-badge-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3.5" y="4.5" width="17" height="15.5" rx="2.5"/><path d="M3.5 15.5h17"/></svg>'
      );
    }
    if (kind === "zirkel") {
      return (
        '<svg class="acc-badge-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 5v5h-5"/></svg>'
      );
    }
    if (kind === "invite") {
      return (
        '<svg class="acc-badge-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/></svg>'
      );
    }
    if (kind === "alternative") {
      /* Blatt: Bewegung statt Training */
      return (
        '<svg class="acc-badge-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l8-8"/></svg>'
      );
    }
    if (kind === "spontan") {
      return (
        '<svg class="acc-badge-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z"/></svg>'
      );
    }
    /* Kein Plus-auf-Schwarz-Badge mehr */
    return "";
  }

  function canInviteOnDay(iso) {
    var day = String(iso || "").slice(0, 10);
    if (!day) return false;
    return day >= todayIso();
  }

  var FACE_HOURGLASS =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11M6.5 20.5h11M8 3.5v2.2c0 2.2 1.6 3.5 4 5.3 2.4-1.8 4-3.1 4-5.3V3.5M8 20.5v-2.2c0-2.2 1.6-3.5 4-5.3 2.4 1.8 4 3.1 4 5.3v2.2"/></svg>';

  function faceSlotHtml(person, pending, withdraw) {
    var label = (person && person.name) || "?";
    var cls = "acc-face-slot" + (pending ? " is-pending" : "");
    return (
      '<span class="' +
      cls +
      '"' +
      (pending && withdraw ? ' role="button" data-withdraw-to="' + esc(withdraw.to) + '" data-withdraw-ev="' + esc(withdraw.ev || "") + '" data-withdraw-iso="' + esc(withdraw.iso || "") + '"' : "") +
      ' title="' +
      esc(pending ? label + " · wartet" : label) +
      '">' +
      avatarHtml(person, "acc-face") +
      (pending
        ? '<span class="acc-face-wait" aria-hidden="true">' + FACE_HOURGLASS + "</span>"
        : "") +
      "</span>"
    );
  }

  /* Eingeladene Freunde (pending=Sanduhr) + zugesagte RSVPs (voll) */
  function guestFacesFor(iso, eventId) {
    var seen = {};
    var out = [];
    var uid = me();
    /* Nach Erledigt oder vergangen: nur wer zugesagt hat bleibt sichtbar */
    var onlyAccepted = !!iso && String(iso) < todayIso();
    if (eventId) {
      var doneEv = (state.events || []).filter(function (e) {
        return String(e.id) === String(eventId);
      })[0];
      if (doneEv && doneEv.status === "erledigt") onlyAccepted = true;
    }
    if (
      iso &&
      (state.events || []).some(function (e) {
        return (
          e &&
          String(e.user_id) === uid &&
          dayKey(e.starts_at) === String(iso) &&
          e.status === "erledigt"
        );
      })
    ) {
      onlyAccepted = true;
    }
    function pushFace(id, name, photo, status) {
      id = String(id || "");
      if (!id || id === uid || seen[id]) return;
      seen[id] = true;
      out.push({
        id: id,
        name: name || "?",
        photo: photo || "",
        status: status || "pending"
      });
    }
    if (host && typeof host.inviteFacesForIso === "function") {
      (host.inviteFacesForIso(iso) || []).forEach(function (f) {
        if (!f) return;
        /* Einladung gehört zu einem bestimmten Event: nur dort zeigen */
        if (f.eventId && eventId && String(f.eventId) !== String(eventId)) return;
        var known = personOf(f.id);
        pushFace(
          f.id,
          (known && known.name && known.name !== "?" ? known.name : "") || f.name || f.nickname,
          f.photo || f.photo_url || "",
          f.status || "pending"
        );
      });
    }
    if (eventId && state.rsvps[String(eventId)]) {
      state.rsvps[String(eventId)].forEach(function (rid) {
        var p = personOf(rid);
        pushFace(rid, p.name, p.photo, "accepted");
      });
    }
    if (onlyAccepted) {
      return out.filter(function (f) { return String(f.status) === "accepted"; });
    }
    return out;
  }

  function isBookedSupportEvent(ev) {
    if (!ev) return false;
    var t = String(ev.item_type || "");
    if (t === "nutrition_log" || t === "support_session") return true;
    var title = String(ev.title || "").toLowerCase();
    return /ernährung|ernaehrung|web-call|web call|initialgespräch|initialgesprach/.test(title);
  }

  function inviteFaceRowHtml(postId, inviteIso, canInvite, eventId, ownerId) {
    /* Fremdes Event: Ersteller vorne, dahinter Zusagen; kein Einladen */
    if (ownerId && String(ownerId) !== String(me())) {
      var going = (state.rsvps[String(eventId || postId)] || []).filter(function (id) {
        return String(id) !== String(ownerId);
      });
      return (
        '<div class="acc-card__faces">' +
        going
          .map(function (id) {
            return faceSlotHtml(personOf(id), false);
          })
          .join("") +
        "</div>"
      );
    }
    var mePerson = personOf(me());
    var guests = guestFacesFor(inviteIso, eventId || postId)
      .map(function (g) {
        return faceSlotHtml(
          { name: g.name, photo: g.photo },
          String(g.status || "") === "pending",
          { to: g.id, ev: /^[0-9a-f-]{36}$/i.test(String(eventId || "")) ? eventId : "", iso: inviteIso }
        );
      })
      .join("");
    var add = "";
    if (canInvite === "plus") {
      add =
        '<button type="button" class="acc-card__plus-label" data-shell-plus="1" aria-label="Plus">Plus</button>';
    } else if (canInvite !== false && canInviteOnDay(inviteIso)) {
      add =
        '<button type="button" class="acc-face acc-face--add acc-face--outbox" data-invite-post="' +
        esc(postId || "") +
        '" data-invite-iso="' +
        esc(inviteIso || "") +
        '" aria-label="Einladen">' + OUTBOX_SVG + "</button>";
    }
    void mePerson;
    return (
      '<div class="acc-card__faces">' +
      add +
      guests +
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
    var canInvite = opts.canInvite !== false;
    /* Alle Kommentare unter dem Event (auch bei vergangenen), zwei Zeilen + „mehr“; Schreiben über die Sprechblase */
    var teaserBlock = commentsTeaserHtml(postId) || '<div class="acc-card__teaser is-empty" hidden></div>';
    var faces = inviteFaceRowHtml(
      postId,
      opts.inviteIso || "",
      canInvite,
      opts.eventId || postId,
      opts.ownerId || ""
    );
    var actions = opts.actions || "";
    /* Layout: Haken · Sprechblase · + · Eingeladene/Zusagen in einer Zeile */
    if (actions.indexOf("<!--faces-->") >= 0) {
      actions = actions.replace("<!--faces-->", faces.replace('class="acc-card__faces"', 'class="acc-card__faces acc-card__faces--inline"'));
      faces = "";
    }
    return (
      '<div class="acc-card__bar">' +
      actions +
      teaserBlock +
      faces +
      "</div>"
    );
  }

  /* Tipp auf das Icon rechts unter dem Event: kurzer Satz, was das ist */
  var BADGE_INFO = {
    plan: "Wochenplan: Termin aus Deinem gewählten Plan.",
    coach: "Klemmbrett: Dein Coach hat das eingetragen.",
    zirkel: "FRIDAY CIRCLE: Zirkeltraining der Gruppe.",
    spontan: "Spontanes Event: einfach so trainiert.",
    alternative: "Alternative: Bewegung statt Training, z. B. Schritte oder Mobility.",
    invite: "Einladung: Jemand will mit Dir trainieren."
  };

  var SPONTAN_BTN =
    '<button type="button" class="acc-tool acc-tool--spontan" data-spontan="1" aria-label="Spontan trainieren">' +
    '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M9 21l3-6 3 2.5V21"/><path d="M6.5 12.5l3-4 4 1 2.5 3 3 .5"/><path d="M9.5 8.5L12 15"/></svg>' +
    "</button>";

  var CIRCLE_SVG =
    '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/></svg>';
  var WAVE_SVG =
    '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M8.5 12.5V6.8a1.3 1.3 0 0 1 2.6 0v4.7"/><path d="M11.1 11.5V5.3a1.3 1.3 0 0 1 2.6 0v6.2"/><path d="M13.7 11.5V6.3a1.3 1.3 0 0 1 2.6 0v7.4"/>' +
    '<path d="M16.3 10.2a1.3 1.3 0 0 1 2.6 0v4.3a6.2 6.2 0 0 1-6.2 6.2h-.6a6 6 0 0 1-4.5-2.1L4.6 15a1.4 1.4 0 0 1 2-1.9l1.9 1.6"/>' +
    '<path d="M4 7.2c.4-1.3 1.2-2.4 2.3-3.1M19.6 4.3c1 .7 1.7 1.7 2 2.9"/></svg>';
  var HEART_SVG =
    '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' +
    '<path d="M12 20.3s-7.3-4.4-8.6-9A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.6 4.2c-1.3 4.6-8.6 9-8.6 9z"/></svg>';
  /* Postausgang statt Plus: Einladen */
  /* gleiches Symbol wie in Woche */
  var OUTBOX_SVG =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1.6 13h6.2M4.7 9.9v6.2"/><circle cx="15.4" cy="8" r="3.6"/><path d="M8.4 21.2c.7-4.6 3.6-7.2 7-7.2s6.3 2.6 7 7.2"/></svg>';
  /* Papierflieger wie bei Instagram: Teilen */
  var PLANE_SVG =
    '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M18.55 3.75 L5.86 7.66 Q2.80 8.60 5.66 10.03 L10.66 12.53 Q11.20 12.80 11.47 13.34 L13.97 18.34 Q15.40 21.20 16.34 18.14 L20.25 5.45 Q21.00 3.00 18.55 3.75Z"/><path d="M19.80 4.00 11.20 12.80"/></svg>';
  function placeSpontan(html) {
    return html;
  }

  /* Teilen-Symbol: Training des Tages suchen → Foto wählen (Mediathek oder Kamera) → Story mit Posten und Teilen.
     Die Dateiauswahl braucht einen direkten Tipp: ist das Training schon geladen, sofort, sonst nach einer Rückfrage. */
  function openStoryShare(day) {
    var F = global.FFC;
    if (!F || !F.sessionForDay || !F.storyFromHistory) return;
    var sid = F.sessionForDay(day);
    if (sid) { F.storyFromHistory(sid); return; }
    Promise.resolve(F.loadHistory && F.loadHistory()).then(function () {
      var sid2 = F.sessionForDay(day);
      if (!sid2) {
        if (global.GoDialog) GoDialog.alert("Kein Zirkeltraining gefunden", { body: "Für diesen Tag gibt es keine Aufzeichnung im Friday Fitness Circle." });
        return;
      }
      if (!global.GoDialog) return;
      GoDialog.choose("Story zum Zirkeltraining", [{ label: "Foto wählen", value: "go" }], { sub: "Danach kannst Du posten oder auf WhatsApp und Instagram teilen." })
        .then(function (v) { if (v === "go") F.storyFromHistory(sid2); });
    }).catch(function () {});
  }

  /* Teilen am eigenen Event:
     - mit eigenem Foto (photo_url, auch Story-Bild): nur noch Teilen (iPhone-Menü: WhatsApp, Instagram …)
     - erledigter Zirkel ohne Foto: Story (Foto wählen, Punkte drauf, posten/teilen)
     - sonst: Foto hinzufügen oder ohne Foto teilen */
  function shareText(ev) {
    var d = new Date(ev.starts_at);
    var when = d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "numeric" });
    var t = timeLabel(ev.starts_at);
    return (ev.title || "Training") + " · " + when + (t ? " · " + t : "") + " · gogogo";
  }
  function shareBlob(blob, text) {
    var file = blob ? new File([blob], "gogogo.jpg", { type: blob.type || "image/jpeg" }) : null;
    var data = file && navigator.canShare && navigator.canShare({ files: [file] }) ? { files: [file], text: text } : { text: text, url: "https://www.gogogo.social" };
    function go() {
      if (navigator.share) return navigator.share(data);
      if (file) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = "gogogo.jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      return Promise.resolve();
    }
    return go().catch(function (err) {
      if (err && err.name === "AbortError") return;
      /* iPhone: nach dem Laden des Bildes ist der Tipp „verbraucht“ → einmal bestätigen */
      if (!global.GoDialog) return;
      return GoDialog.confirm("Bild ist bereit zum Teilen.", { ok: "Teilen" }).then(function (yes) {
        if (yes) return go().catch(function () {});
      });
    });
  }
  function pickEventPhoto(ev) {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.display = "none";
    document.body.appendChild(inp);
    inp.addEventListener("change", function () {
      var file = inp.files && inp.files[0];
      inp.remove();
      if (!file || !global.GoExMedia || !GoExMedia.uploadImage) return;
      if (host.toast) host.toast("Lade Foto hoch …");
      GoExMedia.uploadImage(file, "events").then(function (url) {
        return rest("events?id=eq." + encodeURIComponent(ev.id) + "&user_id=eq." + encodeURIComponent(me()), {
          method: "PATCH", prefer: "return=minimal", body: { photo_url: url }
        }).then(function () {
          ev.photo_url = url;
          return refresh();
        }).then(function () {
          if (!global.GoDialog) return;
          return GoDialog.confirm("Foto gespeichert.", { ok: "Jetzt teilen", cancel: "Später" }).then(function (yes) {
            if (yes) return openEventShare(ev.id, dayKey(ev.starts_at));
          });
        });
      }).catch(function (err) {
        if (host.toast) host.toast((err && err.message) || "Upload ging gerade nicht");
      });
    });
    inp.click();
  }
  function openEventShare(eventId, day) {
    var ev = (state.events || []).find(function (e) { return String(e.id) === String(eventId); });
    if (!ev) {
      /* Karte aus einer anderen Liste (z. B. Plan/Serie): Event kurz nachladen, dann mit Rückfrage weiter */
      rest("events?id=eq." + encodeURIComponent(eventId) + "&select=id,user_id,title,starts_at,category,status,photo_url")
        .then(function (rows) {
          var e = rows && rows[0];
          if (!e) return;
          state.events.push(e);
          openEventShare(eventId, day);
        }).catch(function () {});
      return;
    }
    /* Bild wie die Aktuell-Karte (eigenes Foto oder Cover, Name, Zeit, Titel) + Text für die Nachricht */
    function shareCard() {
      if (!global.GoShareCard) { shareBlob(null, shareText(ev)); return; }
      var owner = personOf(String(ev.user_id));
      GoShareCard.share({
        title: String(ev.title || "Training").replace(/^[^A-Za-zÄÖÜäöü0-9]+\s*/, ""),
        emoji: emojiFor(ev.category, ev.title),
        startsAt: ev.starts_at,
        hasTime: hasTime(ev),
        location: ev.location || "",
        photo: ev.photo_url || "",
        cover: global.GoCovers ? GoCovers.url(ev.course_id, /ernährung|ernaehrung/i.test(String(ev.title || "")) ? "ernaehrung" : ev.category, ev.enrollment_id) : "",
        who: String(owner.name || "").split(" ")[0],
        whoPhoto: owner.photo || ""
      });
    }
    if (ev.photo_url) { shareCard(); return; }
    var F = global.FFC;
    if (ev.category === "zirkel" && ev.status === "erledigt" && ffcUsable() && F && F.sessionForDay) {
      openStoryShare(day);
      return;
    }
    if (!global.GoDialog) { pickEventPhoto(ev); return; }
    GoDialog.choose("Teilen", [
      { label: "Foto hinzufügen", value: "photo" },
      { label: "Mit Standard-Foto teilen", value: "text" }
    ], { sub: "Mit eigenem Foto teilst Du danach direkt auf WhatsApp, Instagram …" }).then(function (v) {
      if (v === "photo") pickEventPhoto(ev);
      else if (v === "text") shareCard();
    });
  }

  function eventToolRowHtml(opts) {
    opts = opts || {};
    var eventId = opts.eventId || "";
    var postId = opts.postId || eventId;
    var done = !!opts.canDone;
    var isDone = !!opts.isDone;
    /* Kreis: offen = Menü (Start, Alternative, Schieben), erledigt = Haken */
    var check = opts.noCheck ? "" :
      '<button type="button" class="acc-tool acc-tool--check' +
      (isDone ? " is-done" : "") +
      '"' +
      (isDone ? " disabled" : opts.menu ? ' data-ev-menu="' + esc(eventId) + '"' : done ? ' data-done="' + esc(eventId) + '"' : " disabled") +
      ' aria-label="' + (isDone ? "Erledigt" : "Start, Alternative oder Schieben") + '">' +
      (isDone ? checkSvg(true) : CIRCLE_SVG) +
      "</button>";
    /* Fremde Events: Winken = Anfrage zum Mitmachen */
    var wave = opts.wave
      ? '<button type="button" class="acc-tool acc-tool--wave' + (opts.waved ? " is-on" : "") + '" data-wave-ev="' + esc(eventId) +
        '" aria-label="' + (opts.waved ? "Anfrage gesendet" : "Fragen, ob ich mitmachen kann") + '">' + WAVE_SVG + "</button>"
      : "";
    if (opts.heart) {
      var meP = personOf(me());
      wave = '<button type="button" class="acc-tool acc-tool--heart is-on" data-heart-ev="' + esc(eventId) + '" aria-label="Dabei. Tippen zum Absagen">' + HEART_SVG + "</button>" +
        '<span class="acc-heart-me">' + (meP.photo ? '<img src="' + esc(meP.photo) + '" alt="" />' : esc(String(meP.name || "Ich").slice(0, 1))) + "</span>";
    }
    var bubble =
      '<button type="button" class="acc-tool acc-tool--bubble" data-open-comments="' +
      esc(postId) +
      '" aria-label="Kommentieren">' +
      bubbleSvg() +
      "</button>";
    var remove = opts.removeId
      ? '<button type="button" class="acc-tool acc-tool--remove" data-remove-event="' +
        esc(opts.removeId) +
        '" data-remove-mode="' +
        esc(opts.removeMode || "delete") +
        '" aria-label="' +
        (opts.removeMode === "cancel" ? "Absagen" : "Löschen") +
        '">' +
        '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>' +
        "</button>"
      : "";
    /* Eigener erledigter Zirkel: Story posten / teilen (FFC-Story mit Foto) */
    var share = opts.shareId
      ? '<button type="button" class="acc-tool acc-tool--share" data-acc-share="' + esc(opts.shareId) + '" data-acc-share-day="' + esc(opts.shareDay || "") +
        '" aria-label="Teilen">' +
        PLANE_SVG + "</button>"
      : "";
    var badgeKind = opts.badge || "";
    var badge = badgeKind
      ? '<button type="button" class="acc-tool-badge" data-badge-info="' + esc(badgeKind) + '" aria-label="' +
        esc(BADGE_INFO[badgeKind] || "") + '">' + badgeSvg(badgeKind) + "</button>"
      : "";
    return (
      '<div class="acc-card__tools">' +
      '<div class="acc-card__tools-left">' +
      check +
      bubble +
      share +
      wave +
      remove +
      "<!--faces-->" +
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

  /* Coverbild statt Farbfläche: Kursbild, sonst Bild der Kategorie (go-covers.js) */
  function coverFor(opts) {
    if (opts.photo || opts.plus || !global.GoCovers) return "";
    var cat = /ernährung|ernaehrung/i.test(String(opts.title || "")) ? "ernaehrung" : opts.category;
    return GoCovers.url(opts.courseId, cat, opts.enrollmentId);
  }

  function mediaInnerHtml(opts) {
    if (opts.photo) {
      return '<img class="acc-card__photo" src="' + esc(opts.photo) + '" alt="" />';
    }
    var cover = coverFor(opts);
    if (cover) {
      return '<img class="acc-card__photo acc-card__cover" src="' + esc(cover) + '" alt="" loading="lazy" />';
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
        ? '<p class="acc-card__when"' + (opts.whenTs ? ' data-when-ts="' + esc(opts.whenTs) + '" data-when-base="' + esc(whenLine(opts.whenTs)) + '"' : "") + ">" + esc(opts.when) + "</p>"
        : "") +
      (opts.zpills || "") +
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
      (opts.photo || coverFor(opts) ? " has-photo" : "") +
      '">' +
      mediaInnerHtml(opts) +
      overlayHtml(opts) +
      /* eigene Events: drei weiße Punkte unten rechts → Sichtbarkeit (nur an aufgeklappten Karten sichtbar) */
      (opts.visDots ? '<button type="button" class="acc-card__visdots" data-vis-ev="' + esc(opts.visDots) + '" aria-label="Sichtbarkeit ändern"><i></i><i></i><i></i></button>' : "") +
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

  /* Gruppen-Event einer Gruppe, in der ich bin: Gruppenname (und Gruppenbild) statt Vorname */
  /* Gruppen-Event: Name der Gruppe, Bild bleibt das des Erstellers */
  function groupAuthor(ev, creator) {
    if (!ev || !ev.group_id || !host || !host.myGroups) return null;
    var g = (host.myGroups() || []).filter(function (x) { return x && String(x.id) === String(ev.group_id); })[0];
    if (!g || !g.name) return null;
    var a = {};
    Object.keys(creator || {}).forEach(function (k) { a[k] = creator[k]; });
    a.name = g.name;
    a.isGroup = true;
    return a;
  }

  function authorHtml(person, show) {
    if (!show || !person) return "";
    return (
      '<div class="acc-card__author">' +
      avatarHtml(person, "acc-face") +
      "<span>" +
      esc(person.isGroup ? String(person.name) : String(person.name || "?").split(" ")[0]) +
      "</span></div>"
    );
  }

  function actionRowHtml(opts) {
    var btn = "";
    if (opts.inviteId) {
      btn = opts.accepted
        ? '<button type="button" class="acc-rsvp is-on" disabled>Zugesagt</button>' +
          '<button type="button" class="acc-tool acc-tool--remove" data-remove-event="' +
          esc(opts.inviteEventId) +
          '" data-remove-mode="cancel" aria-label="Absagen">' +
          '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>' +
          "</button>"
        : '<button type="button" class="acc-rsvp" data-accept-invite="' + esc(opts.inviteId) + '">Teilnehmen</button>';
      return (
        '<div class="acc-card__actions">' +
        btn +
        '<span class="acc-tool-badge acc-tool-badge--right">' +
        badgeSvg("invite") +
        "</span></div>"
      );
    }
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
    if (opts.rsvpId && opts.going) {
      btn +=
        '<button type="button" class="acc-tool acc-tool--remove" data-remove-event="' +
        esc(opts.rsvpId) +
        '" data-remove-mode="cancel" aria-label="Absagen">' +
        '<svg class="acc-act-ico wr-ico" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>' +
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
        eventId: opts.eventId || opts.postId,
        inviteIso: opts.inviteIso || "",
        canInvite: opts.canInvite !== false,
        ownerId: opts.ownerId || "",
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
    if (ev.is_unplanned) return "spontan";
    if (ev.category === "alternative" && !ev.enrollment_id && !ev.assigned_by) return "alternative";
    if (ev.assigned_by) return "coach";
    /* Wochenplanung / Kurs-Session → Kalender-Icon wie Pill-Woche */
    if (ev.enrollment_id || ev.course_id || ev.item_type === "course_session") {
      return "plan";
    }
    return "";
  }

  function renderEventCard(ev) {
    var uid = me();
    var mine = String(ev.user_id) === uid;
    var upcoming = ev.status === "geplant";
    var day = dayKey(ev.starts_at);
    var p = personOf(ev.user_id);
    var emoji = emojiFor(ev.category, ev.title);
    var title = (emoji + " " + (ev.title || ev.category)).trim();
    var actions = "";
    var invite = !mine ? inviteFor(ev.id) : null;
    var acceptedInv = upcoming && !mine && invite && invite.status === "accepted";
    if (upcoming && !mine && invite && !acceptedInv) {
      actions = actionRowHtml({
        inviteId: invite.id,
        inviteEventId: ev.id,
        accepted: invite.status === "accepted"
      });
    }
    var tools = mine
      ? eventToolRowHtml({
          eventId: ev.id,
          postId: String(ev.id),
          canDone: upcoming && day === todayIso(),
          isDone: ev.status === "erledigt",
          /* vergangene Tage: kein Kreis, die Einheit lässt sich nicht mehr nachholen */
          noCheck: ev.status !== "erledigt" && day < todayIso(),
          /* nur das heutige Event ist im Kreis antippbar; kommende Tage: Kreis ohne Aktion */
          menu: ev.status !== "erledigt" && day === todayIso(),
          badge: eventBadgeKind(ev),
          /* Papierflieger nur für heute und kommende Events, nicht für vergangene */
          shareId: day >= todayIso() ? String(ev.id) : "",
          shareDay: day,
          removeId: "",
          removeMode: "delete"
        })
      : /* Fremde Events: nur Kommentieren (Einladung hat eigene Zeile) */
        eventToolRowHtml({
          eventId: ev.id,
          postId: String(ev.id),
          noCheck: true,
          /* Freunde-Events: links Sprechblase, daneben Winken (Anfrage). Angenommen: Herz + mein Bild, Herz tippen = absagen. */
          /* ohne Uhrzeit: winken bis Tagesende, der Ersteller wird nach der Uhrzeit gefragt */
          wave: !invite && !iAmGoing(ev.id) && ev.status === "geplant" &&
            (hasTime(ev) ? new Date(ev.starts_at).getTime() > Date.now() : dayKey(ev.starts_at) >= todayIso()),
          waved: !!state.waved[String(ev.id)],
          heart: acceptedInv || (upcoming && !invite && iAmGoing(ev.id))
        });
    return renderCardShell({
      /* zugesagt (Einladung angenommen oder Herz) → dicker Rahmen */
      extraClass: !mine && (acceptedInv || iAmGoing(ev.id)) ? "is-going"
        : mine && upcoming && day >= todayIso() ? "is-mine-next" : "",
      attrs:
        ' data-post-id="' +
        esc(ev.id) +
        '" data-event-id="' +
        esc(ev.id) +
        '"',
      category: ev.category,
      photo: ev.photo_url || "",
      courseId: ev.course_id || "",
      enrollmentId: ev.enrollment_id || "",
      emoji: emoji,
      actions: (tools || "") + (actions || ""),
      author: authorHtml(groupAuthor(ev, p) || p, true),
      when: zirkelPillsHtml(ev) ? "Heute · " + timeLabel(ev.starts_at) : whenLine(ev.starts_at),
      whenTs: zirkelPillsHtml(ev) ? "" : ev.starts_at,
      zpills: zirkelPillsHtml(ev),
      title: title,
      place: ev.location || "",
      desc:
        descHtml(parseZirkelNote(ev.note) ? zirkelLabel(parseZirkelNote(ev.note)) : ev.note) +
        zirkelPairsHtml(ev) +
        onlineCtaHtml(ev),
      postId: String(ev.id),
      eventId: String(ev.id),
      visDots: mine && /^[0-9a-f-]{36}$/i.test(String(ev.id)) ? String(ev.id) : "",
      inviteIso: day,
      ownerId: String(ev.user_id || ""),
      canInvite: !mine
        ? false
        : isBookedSupportEvent(ev)
        ? "plus"
        : ev.status === "erledigt"
          ? false
          : canInviteOnDay(day)
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
      whenTs: ev.starts_at,
      title: "🔥 " + (ev.title || "Zirkeltraining"),
      place: ev.location || "",
      desc: "",
      postId: postId,
      inviteIso: dayKey(ev.starts_at),
      canInvite: mine ? canInviteOnDay(dayKey(ev.starts_at)) : false
    });
  }

  /* FFC-Training-Posts unter Aktuell: wie Event, ohne Einladung und ohne Kommentar */
  function renderFfcPostCard(post) {
    var authorPerson = {
      name: post.nickname || "FFC",
      photo: post.avatar_url || ""
    };
    var postId = "ffc-post-" + String(post.id);
    var when = post.created_at ? whenLine(post.created_at) : "";
    /* FFC liefert bei jedem Laden eine neu signierte Foto-URL → Bild lud neu und blitzte.
       Erste URL 45 min behalten, dann bleibt der <img>-Knoten derselbe. */
    var cache = state.ffcUrl || (state.ffcUrl = {});
    var hit = cache[post.id];
    var url = post.url || "";
    if (url && hit && Date.now() - hit.t < 45 * 60000) url = hit.url;
    else if (url) cache[post.id] = { url: url, t: Date.now() };
    return renderCardShell({
      extraClass: "acc-card--ffc-post",
      attrs:
        ' data-post-id="' +
        esc(postId) +
        '" data-ffc-post="' +
        esc(post.id) +
        '"',
      category: "zirkel",
      photo: url,
      emoji: "🔥",
      actions: "",
      author: authorHtml(authorPerson, !post.is_me),
      when: when,
      title: "🔥 " + (post.caption || "Zirkeltraining"),
      place: "",
      desc: "",
      postId: "",
      inviteIso: "",
      canInvite: false
    });
  }

  function renderDiaryCard(item) {
    var p = personOf(item.user_id);
    var mine = String(item.user_id) === me();
    var emoji = emojiFor(item.category || "kraft", item.title);
    var title = (emoji + " " + (item.title || "Training")).trim();
    var day = dayKey(item.starts_at);
    var commentKey =
      item.commentKey ||
      "diary:" + String(item.user_id) + ":" + day;
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
      whenTs: item.starts_at,
      title: title,
      place: item.location || "",
      desc: descHtml(item.note),
      postId: commentKey,
      inviteIso: day,
      ownerId: String(item.user_id || ""),
      canInvite: false
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
      badge: item.category === "zirkel" ? "zirkel" : "plan",
      removeId: "",
      removeMode: "skip"
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
      whenTs: item.when ? "" : item.starts_at,
      title: title,
      place: item.location || "",
      desc: descHtml(item.note || ""),
      postId: postId,
      inviteIso: item.iso || dayKey(item.starts_at),
      canInvite: canInviteOnDay(item.iso || dayKey(item.starts_at))
    });
  }

  /* Reihenfolge-Regel:
     1) Spontan-Karte über heutigen Events
     2) Meine Events von heute (Plan + eigene Events/FFC)
     3) Kommende (morgen zuerst, dann später; eigene vor fremden bei Gleichstand)
     4) Historie (Tagebuch+), neueste zuerst */
  /* Nachrichten aus der Sprechblase (go-aktuell-posts.sql): stehen in der Ansicht ihres Kreises und unter Alles */
  function loadKreisMsgs() {
    if (!me()) { state.kreisMsgs = []; return Promise.resolve(); }
    return rest("go_aktuell_posts?select=id,author_id,audience,body,media_url,media_kind,reply_to,created_at&order=created_at.desc&limit=150")
      .then(function (rows) {
        state.kreisMsgs = (rows || []).map(function (m) { m._kreis = true; return m; });
        return ensurePeople(state.kreisMsgs.map(function (m) { return String(m.author_id); }));
      })
      .catch(function () { state.kreisMsgs = []; });
  }
  function kreisMsgsFor(view) {
    return (state.kreisMsgs || []).filter(function (m) {
      if (view === "alles") return true;
      if (m.audience === view) return true;
      /* Nachricht meines Coachs an seine Coachees steht bei mir unter Freunde */
      return view === "team" && m.audience === "coach" && String(m.author_id) !== me();
    });
  }
  function allMsgs() {
    return (state.bubbleMsgs || []).concat(state.kreisMsgs || []);
  }

  function loadBubbleMsgs() {
    if (state.filter !== "bubble" || !global.GoBubbles || !GoBubbles.messages) { state.bubbleMsgs = []; return Promise.resolve(); }
    return GoBubbles.messages().then(function (rows) {
      state.bubbleMsgs = rows || [];
      return ensurePeople(state.bubbleMsgs.map(function (m) { return String(m.author_id); }));
    }).catch(function () { state.bubbleMsgs = []; });
  }

  /* Antwort: zitierte Nachricht über dem Text */
  function bubbleReplyQuote(m) {
    if (!m.reply_to) return "";
    var o = allMsgs().filter(function (x) { return String(x.id) === String(m.reply_to); })[0];
    if (!o) return '<span class="acc-msg__quote">Nachricht nicht mehr da</span>';
    var who = String(o.author_id) === me() ? "Du" : String(personOf(String(o.author_id)).name || "?").split(" ")[0];
    var txt = o.body || (o.media_url ? (o.media_kind === "video" ? "Video" : "Foto") : "");
    return '<span class="acc-msg__quote"><b>' + esc(who) + "</b> " + esc(String(txt).slice(0, 90)) + "</span>";
  }

  /* Lange drücken auf eine Bubble-Nachricht: Antworten / Melden */
  (function bindBubbleLongPress() {
    var tm = 0, sx = 0, sy = 0, fired = false;
    function msgOf(el) {
      var id = el && el.getAttribute("data-msg-id");
      return allMsgs().filter(function (x) { return String(x.id) === String(id); })[0] || null;
    }
    function open(m) {
      if (!m || !global.GoDialog) return;
      var mine = String(m.author_id) === me();
      var opts = [{ label: "Antworten", value: "reply" }];
      if (!mine) opts.push({ label: "Melden", value: "report" });
      GoDialog.choose("Nachricht", opts, { center: true }).then(function (v) {
        if (v === "reply" && global.GoBubbles && GoBubbles.setReply) {
          var who = mine ? "Du" : String(personOf(String(m.author_id)).name || "").split(" ")[0];
          GoBubbles.setReply({ id: m.id, who: who, body: m.body, media_url: m.media_url, media_kind: m.media_kind });
        } else if (v === "report") {
          GoDialog.confirm("Nachricht entspricht nicht den Richtlinien?", { ok: "Melden", cancel: "Abbrechen" }).then(function (yes) {
            if (!yes || !GoBubbles.report) return;
            GoBubbles.report(m).then(function () { if (host.toast) host.toast("Gemeldet. Danke."); })
              .catch(function () { if (host.toast) host.toast("Melden ging nicht (go-bubble-chat.sql?)"); });
          });
        }
      });
    }
    document.addEventListener("pointerdown", function (e) {
      var el = e.target && e.target.closest ? e.target.closest(".acc-msg[data-msg-id]") : null;
      if (!el || e.target.closest("button, video")) return;
      fired = false;
      sx = e.clientX; sy = e.clientY;
      clearTimeout(tm);
      tm = setTimeout(function () { fired = true; open(msgOf(el)); }, 500);
    }, { passive: true });
    document.addEventListener("pointermove", function (e) {
      if (tm && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) { clearTimeout(tm); tm = 0; }
    }, { passive: true });
    ["pointerup", "pointercancel"].forEach(function (t) { document.addEventListener(t, function () { clearTimeout(tm); tm = 0; }, { passive: true }); });
    document.addEventListener("contextmenu", function (e) {
      if (e.target && e.target.closest && e.target.closest(".acc-msg[data-msg-id]")) e.preventDefault();
    });
    document.addEventListener("click", function (e) {
      if (fired && e.target && e.target.closest && e.target.closest(".acc-msg[data-msg-id]")) { e.preventDefault(); e.stopPropagation(); fired = false; }
    }, true);
  })();

  function renderBubbleMsg(m) {
    var mine = String(m.author_id) === me();
    var p = personOf(String(m.author_id));
    var t = new Date(m.created_at);
    var when = dayKey(m.created_at) === todayIso()
      ? t.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })
      : t.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "numeric" }) + " " +
        t.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    return '<article class="acc-msg' + (mine ? " is-mine" : "") + '" data-msg-id="' + esc(m.id) + '">' +
      (mine ? '<button type="button" class="acc-msg__more" data-msg-more="' + esc(m.id) + '" aria-label="Optionen"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>' : "") +
      '<span class="acc-msg__who">' + esc(mine ? "Du" : String(p.name || "?").split(" ")[0]) + " · " + esc(when) + "</span>" +
      bubbleReplyQuote(m) +
      (m.media_url
        ? (m.media_kind === "video"
            ? '<video class="acc-msg__media" src="' + esc(m.media_url) + '" controls playsinline preload="metadata"></video>'
            : '<img class="acc-msg__media" src="' + esc(m.media_url) + '" alt="" loading="lazy" />')
        : "") +
      (m.body ? '<p class="acc-msg__txt">' + esc(m.body) + "</p>" : "") + "</article>";
  }

  /* Bubble-Filter: nur Events, die in meiner Bubble markiert sind (eigene und die der anderen Mitglieder) */
  function bubbleFeedItems() {
    var today = todayIso();
    var bid = host && host.bubbleId ? String(host.bubbleId() || "") : "";
    var out = { myToday: [], upcoming: [], history: [] };
    if (!bid) return out;
    var now = Date.now();
    /* Suche (Lupe in der Leiste): Events, Nachrichten und Namen */
    var q = String(state.bubbleQuery || "").trim().toLowerCase();
    function hit() {
      if (!q) return true;
      return Array.prototype.some.call(arguments, function (v) { return String(v || "").toLowerCase().indexOf(q) >= 0; });
    }
    (state.events || []).forEach(function (ev) {
      if (!ev || String(ev.bubble_id || "") !== bid || ev.status === "ausgefallen") return;
      if (!hit(ev.title, ev.note, ev.location, personOf(String(ev.user_id)).name)) return;
      var mine = String(ev.user_id) === me();
      if (!mine && normalizeVisibility(ev.visibility) === "privat") return;
      var d = dayKey(ev.starts_at);
      if (ev.status === "geplant" && d < today) return;
      if (d > upcomingLimitIso(today)) return;
      var item = { kind: "event", starts_at: ev.starts_at, _mine: mine, ev: ev };
      if (d === today) out.myToday.push(item);
      else if (d > today) out.upcoming.push(item);
      else out.history.push(item);
    });
    (state.bubbleMsgs || []).forEach(function (m) {
      if (!hit(m.body, personOf(String(m.author_id)).name)) return;
      var it = { kind: "bubble_msg", starts_at: m.created_at, _mine: String(m.author_id) === me(), msg: m };
      if (dayKey(m.created_at) === today) out.myToday.push(it);
      else out.history.push(it);
    });
    out.myToday.sort(function (a, b) { return String(b.starts_at).localeCompare(String(a.starts_at)); });
    out.upcoming.sort(function (a, b) { return String(a.starts_at).localeCompare(String(b.starts_at)); });
    out.history.sort(function (a, b) { return String(b.starts_at).localeCompare(String(a.starts_at)); });
    return out;
  }

  /* letzter Tag, der in Aktuell noch als „kommend“ erscheint */
  var UPCOMING_DAYS = 3;
  function upcomingLimitIso(today) {
    var p = String(today).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + UPCOMING_DAYS));
    return d.toISOString().slice(0, 10);
  }

  function buildFeedItems(flags) {
    if (flags && flags.bubbleOnly) return bubbleFeedItems();
    var today = todayIso();
    var pack = filterOwnEvents(flags);
    var ffc = filterFfcEvents(flags);
    var myToday = [];
    var upcoming = [];
    var history = [];
    var coveredDays = {};
    var coveredFp = {};

    var nutritionDays = {};
    pack.upcoming.forEach(function (ev) {
      var supportLike = isBookedSupportEvent(ev);
      var item;
      if (
        ev.item_type === "nutrition_log" ||
        (supportLike && /ernährung|ernaehrung/i.test(String(ev.title || "")))
      ) {
        nutritionDays[dayKey(ev.starts_at)] = true;
        item = {
          kind: "nutrition",
          starts_at: ev.starts_at,
          _mine: String(ev.user_id) === me(),
          item: {
            id: ev.id,
            user_id: ev.user_id,
            starts_at: ev.starts_at,
            title: ev.title || "Ernährung",
            note: ev.note || "",
            category: "alternative",
            location: ev.location || "privat",
            item_type: "nutrition_log",
            nutrition: true,
            photo_url: ev.photo_url || ""
          }
        };
      } else if (supportLike) {
        item = {
          kind: "support",
          starts_at: ev.starts_at,
          _mine: String(ev.user_id) === me(),
          item: {
            id: ev.id,
            user_id: ev.user_id,
            starts_at: ev.starts_at,
            title: ev.title || "Support",
            note: ev.note || "",
            category: ev.category || "alternative",
            location: ev.location || "",
            item_type: ev.item_type || "support_session",
            supportType: ev.item_type || "support_session",
            photo_url: ev.photo_url || ""
          }
        };
      } else {
        item = {
          kind: "event",
          starts_at: ev.starts_at,
          _mine: String(ev.user_id) === me(),
          ev: ev
        };
        /* Support/Ernährung decken den Trainingstag nicht ab — zusätzlich chronologisch */
        if (item._mine) {
          coveredDays[dayKey(ev.starts_at)] = true;
          coveredFp[eventFingerprint(ev)] = true;
        }
      }
      if (item._mine && dayKey(ev.starts_at) === today) myToday.push(item);
      else upcoming.push(item);
    });

    /* Erledigt/Historie deckt den Tag ebenfalls ab — sonst kehrt der Plan-Ghost zurück */
    pack.past.forEach(function (ev) {
      if (String(ev.user_id) !== me()) return;
      if (isBookedSupportEvent(ev)) return;
      coveredDays[dayKey(ev.starts_at)] = true;
      coveredFp[eventFingerprint(ev)] = true;
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
        if ((state.skippedDays || {})[day]) return;
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

    /* Support / Ernährung / PT / Web-Call (GoSupport) — ohne Duplikate zu echten Events */
    if (host && host.heuteSupportItems) {
      (host.heuteSupportItems() || []).forEach(function (s) {
        if (!s || !s.starts_at) return;
        var day = dayKey(s.starts_at);
        if (s.nutrition && nutritionDays[day]) return;
        var item = {
          kind: s.nutrition ? "nutrition" : "support",
          starts_at: s.starts_at,
          _mine: true,
          item: s
        };
        if (day === today) myToday.push(item);
        else upcoming.push(item);
      });
    }

    (state.freeInvites || []).forEach(function (inv) {
      var at = inviteStartsAt(inv);
      var item = { kind: "inv", starts_at: at, _mine: true, inv: inv };
      if (dayKey(at) === today) myToday.push(item);
      else upcoming.push(item);
    });

    /* Eigener Zirkel steht schon als gogogo-Event im Feed (gleiche Startzeit ±10 Min.): FFC-Kopie weglassen */
    var ownZirkelTimes = (state.events || []).filter(function (e) {
      return e && String(e.user_id) === me() && e.category === "zirkel";
    }).map(function (e) { return new Date(e.starts_at).getTime(); });
    ffc.forEach(function (ev) {
      if (flags.groupOnly && !ev.is_mine && ev.my_going !== true) return;
      if (ev.is_mine) {
        var t = new Date(ev.starts_at).getTime();
        if (ownZirkelTimes.some(function (x) { return Math.abs(x - t) <= 600000; })) return;
      }
      var item = {
        kind: "ffc",
        starts_at: ev.starts_at,
        _mine: !!ev.is_mine,
        ev: ev
      };
      if (item._mine && dayKey(ev.starts_at) === today) myToday.push(item);
      else if (dayKey(ev.starts_at) < today) history.push(item);
      else upcoming.push(item);
    });

    /* Eigene FFC-Story hängt schon als Bild am erledigten Zirkel (onPosted) → keine zweite Karte */
    var storyOnEvent = {};
    (state.events || []).forEach(function (e) {
      if (e && String(e.user_id) === me() && e.category === "zirkel" && e.status === "erledigt" && e.photo_url) {
        storyOnEvent[dayKey(e.starts_at)] = true;
      }
    });
    (state.ffcPosts || []).forEach(function (post) {
      if (!post || !post.created_at) return;
      if (flags.groupOnly && !post.is_me) return;
      if (post.is_me && storyOnEvent[dayKey(post.created_at)]) return;
      var item = {
        kind: "ffc_post",
        starts_at: post.created_at,
        _mine: !!post.is_me,
        post: post
      };
      /* gestern beendet = Historie (stand vorher über dem heutigen Event) */
      if (item._mine && dayKey(post.created_at) === today) myToday.push(item);
      else if (dayKey(post.created_at) === today) upcoming.push(item);
      else history.push(item);
    });

    pack.past.forEach(function (ev) {
      /* Ernährung-Logs sind kein eigener Frame — nur activity_log + eine Karte */
      if (
        ev.item_type === "nutrition_log" ||
        (isBookedSupportEvent(ev) && /ernährung|ernaehrung/i.test(String(ev.title || "")))
      ) {
        return;
      }
      var item = {
        kind: "event",
        starts_at: ev.starts_at,
        _mine: String(ev.user_id) === me(),
        ev: ev
      };
      /* Heute erledigt (mit Foto/Text) bleibt im Heute-Feed sichtbar */
      if (dayKey(ev.starts_at) === today) myToday.push(item);
      else history.push(item);
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
      /* Tagebuch-Eintrag ohne Text/Foto an einem Tag mit erledigtem Event derselben Person:
         das Event steht schon im Feed (z. B. Zirkel nach FFC-Workout → „Heute · 12:00“ doppelt) */
      var doneDay = {};
      (state.events || []).forEach(function (e) {
        if (e && e.status === "erledigt" && e.starts_at) doneDay[String(e.user_id) + "|" + dayKey(e.starts_at)] = true;
      });
      diaryItems.forEach(function (d) {
        if (!d || !d.starts_at) return;
        if (flags.groupOnly && !inGroupFilter(d.user_id, flags)) return;
        if (!String(d.note || "").trim() && !d.photo_url && doneDay[String(d.user_id) + "|" + dayKey(d.starts_at)]) return;
        history.push({
          kind: "diary",
          starts_at: d.starts_at,
          _mine: String(d.user_id) === me(),
          item: d
        });
      });
    }

    /* Zukunft höchstens 3 Tage im Voraus (heute + 3) */
    var lastDay = upcomingLimitIso(today);
    upcoming = upcoming.filter(function (it) { return dayKey(it.starts_at) <= lastDay; });
    if (flags.diaryOnly) {
      /* Tagebuch: heute ja, Zukunft nein */
      upcoming = upcoming.filter(function (it) {
        return dayKey(it.starts_at) <= today;
      });
    }
    if (flags.circleOnly) {
      var isCircle = function (it) {
        if (it.kind === "ffc" || it.kind === "ffc_post") return true;
        var ev = it.ev || it.item;
        return !!(ev && (ev.category === "zirkel" || ev.visibility === "circle"));
      };
      myToday = myToday.filter(isCircle);
      upcoming = upcoming.filter(isCircle);
      history = history.filter(isCircle);
    }
    if (flags.teamOnly) {
      history = history.filter(function (it) {
        return it._mine || inTeamFilter((it.ev && it.ev.user_id) || (it.item && it.item.user_id) || "", flags);
      });
    }
    kreisMsgsFor(flags.view).forEach(function (m) {
      var it = { kind: "bubble_msg", starts_at: m.created_at, _mine: String(m.author_id) === me(), msg: m };
      if (dayKey(m.created_at) === today) myToday.push(it);
      else history.push(it);
    });
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
    if (item.kind === "bubble_msg") return renderBubbleMsg(item.msg);
    if (item.kind === "ffc") return renderFfcCard(item.ev);
    if (item.kind === "ffc_post") return renderFfcPostCard(item.post);
    if (item.kind === "diary") return renderDiaryCard(item.item);
    if (item.kind === "plan") return renderPlanCard(item.item);
    if (item.kind === "inv") return renderInviteEventCard(item.inv, item.starts_at);
    if (item.kind === "nutrition") return renderNutritionCard(item.item);
    if (item.kind === "support") return renderSupportCard(item.item);
    return renderEventCard(item.ev);
  }

  /* Zeitpunkt einer Einladung: Tag + Treffzeit (Berlin); ohne Zeit 12:00 UTC wie Plan-Events */
  function inviteStartsAt(inv) {
    var iso = String(inv.workout_date || "").slice(0, 10);
    var m = /^(\d{1,2}):(\d{2})/.exec(String(inv.meet_time || ""));
    if (!m) return iso + "T12:00:00+00:00";
    var d = new Date(iso + "T" + (m[1].length < 2 ? "0" : "") + m[1] + ":" + m[2] + ":00");
    try {
      var berlin = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
      var diff = berlin.getTime() - d.getTime();
      return new Date(d.getTime() - diff).toISOString();
    } catch (e) { return d.toISOString(); }
  }
  function inviteCategory(label) {
    var l = String(label || "").toLowerCase();
    if (/zirkel/.test(l)) return "zirkel";
    return "alternative";
  }
  /* Angenommene Einladung = mein Event: Kreis startet/loggt, Absagen möglich */
  function renderInviteEventCard(inv, at) {
    var owner = personOf(inv.from_id);
    var cat = inviteCategory(inv.workout_label);
    var label = inv.workout_label || "Training";
    var id = String(inv.id);
    var today = dayKey(at) === todayIso();
    return renderCardShell({
      extraClass: "acc-card--inv",
      attrs: ' data-post-id="inv-' + esc(id) + '" data-inv-card="' + esc(id) + '"',
      category: cat,
      emoji: emojiFor(cat, label),
      author: authorHtml(personOf(me()), true),
      when: whenLine(at),
      title: (emojiFor(cat, label) + " " + label).trim(),
      place: (inv.place ? inv.place + " · " : "") + "mit " + String(owner.name || "Freund").split(" ")[0],
      actions:
        '<div class="acc-card__tools"><div class="acc-card__tools-left">' +
        (today
          ? '<button type="button" class="acc-tool acc-tool--check" data-inv-start="' + esc(id) + '" aria-label="Starten und loggen">' + CIRCLE_SVG + "</button>"
          : "") +
        '<button type="button" class="acc-rsvp" data-inv-cancel="' + esc(id) + '">Absagen</button>' +
        "</div></div>"
    });
  }
  function inviteById(id) {
    return (state.freeInvites || []).filter(function (r) { return String(r.id) === String(id); })[0] || null;
  }
  /* Starten: eigenes Event anlegen (an die Einladung gebunden), dann wie ein eigenes Event starten */
  function startInvite(id) {
    var inv = inviteById(id);
    if (!inv) return;
    var cat = inviteCategory(inv.workout_label);
    var courseP = cat === "zirkel" ? loadZirkelCourse() : Promise.resolve(null);
    courseP.then(function (cid) {
      return createUnplannedEvent({
        category: cat, course_id: cat === "zirkel" ? cid : null,
        title: inv.workout_label || "Training", starts_at: inviteStartsAt(inv),
        location: inv.place || null, visibility: "team"
      });
    }).then(function (ev) {
      return rest("go_workout_invites?id=eq." + encodeURIComponent(inv.id), {
        method: "PATCH", prefer: "return=minimal", body: { event_id: ev.id }
      }).catch(function () {}).then(function () { return refresh(); }).then(function () {
        var real = evById(ev.id) || ev;
        startEvent(real);
      });
    }).catch(function () { if (host.toast) host.toast("Starten ging gerade nicht"); });
  }
  function cancelInvite(id) {
    var inv = inviteById(id);
    if (!inv) return;
    var who = String(personOf(inv.from_id).name || "Deinem Freund").split(" ")[0];
    ask("Bei " + who + " absagen?\n\n" + (inv.workout_label || "Training"), "Absagen").then(function (yes) {
      if (!yes) return;
      rest("go_workout_invites?id=eq." + encodeURIComponent(inv.id), {
        method: "PATCH", prefer: "return=minimal", body: { status: "declined" }
      }).then(function () {
        state.freeInvites = (state.freeInvites || []).filter(function (r) { return String(r.id) !== String(id); });
        render();
        if (host.onInvitesChanged) host.onInvitesChanged();
      }).catch(function () { if (host.toast) host.toast("Absagen ging gerade nicht"); });
    });
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
      when: whenLine(item.starts_at) + " · privat",
      whenTs: item.starts_at,
      title: item.title || "Support",
      place: item.location || "",
      desc: descHtml(item.note),
      postId: String(item.id),
      inviteIso: dayKey(item.starts_at),
      canInvite: false,
      actions:
        '<div class="acc-card__plus-row"><button type="button" class="acc-card__plus-label" data-shell-plus="1">Plus</button></div>'
    });
  }

  function renderNutritionCard(item) {
    var day = dayKey(item.starts_at);
    return renderCardShell({
      extraClass: "acc-card--nutrition",
      attrs:
        ' data-post-id="' +
        esc(item.id) +
        '" data-nutrition="1" data-nutrition-day="' +
        esc(day) +
        '" role="button" tabindex="0"',
      category: "alternative",
      emoji: "🥗",
      when: whenLine(item.starts_at) + " · privat",
      whenTs: item.starts_at,
      title: "Ernährung",
      place: "Coach-Plan",
      desc: item.note
        ? '<p class="acc-card__desc">' + esc(item.note) + "</p>"
        : '<p class="acc-card__desc">Tippe zum Protokollieren.</p>',
      postId: String(item.id),
      inviteIso: day,
      canInvite: false,
      actions:
        '<div class="acc-card__plus-row"><button type="button" class="acc-card__plus-label" data-shell-plus="1">Plus</button></div>'
    });
  }

  /* Zwei Finger auf einem Eventbild: nur das Bild zoomt (wie Instagram), die Seite bleibt stehen.
     Kopie liegt fixiert über allem, beim Loslassen federt sie zurück. */
  function bindPhotoPinch(root) {
    if (!root || root._pinchBound) return;
    root._pinchBound = true;
    var z = null;
    function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    function mid(t) { return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 }; }
    function photoOf(t) {
      /* Titel/Overlay liegt über dem Bild: Karte suchen, dann prüfen, ob der Finger im Bild liegt */
      for (var i = 0; i < t.length; i++) {
        var card = t[i].target && t[i].target.closest ? t[i].target.closest(".acc-card") : null;
        var el = card && root.contains(card) ? card.querySelector(".acc-card__photo") : null;
        if (!el) continue;
        var r = el.getBoundingClientRect();
        if (t[i].clientX >= r.left && t[i].clientX <= r.right && t[i].clientY >= r.top && t[i].clientY <= r.bottom) return el;
      }
      return null;
    }
    function end() {
      if (!z) return;
      var cur = z;
      z = null;
      state.pinchClickUntil = Date.now() + 500;
      cur.clone.style.transition = "transform .22s ease";
      cur.shade.style.transition = "opacity .22s ease";
      cur.clone.style.transform = "none";
      cur.shade.style.opacity = "0";
      setTimeout(function () {
        cur.clone.remove();
        cur.shade.remove();
        cur.img.style.visibility = "";
      }, 230);
    }
    root.addEventListener("touchstart", function (e) {
      if (z || e.touches.length !== 2) return;
      var img = photoOf(e.touches);
      if (!img) return;
      e.preventDefault();
      var r = img.getBoundingClientRect();
      var cs = getComputedStyle(img);
      var shade = document.createElement("div");
      shade.style.cssText = "position:fixed;inset:0;background:#000;opacity:0;z-index:9998;pointer-events:none";
      var clone = img.cloneNode(false);
      clone.removeAttribute("loading");
      clone.style.cssText =
        "position:fixed;margin:0;z-index:9999;pointer-events:none;will-change:transform;" +
        "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;" +
        "object-fit:" + cs.objectFit + ";object-position:" + cs.objectPosition + ";border-radius:" + cs.borderRadius;
      var m = mid(e.touches);
      clone.style.transformOrigin = (m.x - r.left) + "px " + (m.y - r.top) + "px";
      document.body.appendChild(shade);
      document.body.appendChild(clone);
      img.style.visibility = "hidden";
      z = { img: img, clone: clone, shade: shade, d0: dist(e.touches) || 1, m0: m };
    }, { passive: false });
    document.addEventListener("touchmove", function (e) {
      if (!z) return;
      if (e.cancelable) e.preventDefault();
      if (e.touches.length < 2) return;
      var s = Math.max(1, Math.min(4, dist(e.touches) / z.d0));
      var m = mid(e.touches);
      z.clone.style.transform = "translate(" + (m.x - z.m0.x) + "px," + (m.y - z.m0.y) + "px) scale(" + s + ")";
      z.shade.style.opacity = String(Math.min(0.6, (s - 1) * 0.6));
    }, { passive: false });
    document.addEventListener("touchend", function (e) { if (z && e.touches.length < 2) end(); }, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
    /* iOS: Seiten-Zoom auf dem Bild verhindern */
    root.addEventListener("gesturestart", function (e) {
      var c = e.target && e.target.closest ? e.target.closest(".acc-card") : null;
      if (z || (c && c.querySelector(".acc-card__photo"))) e.preventDefault();
    }, { passive: false });
    /* Nach dem Zoomen kein versehentlicher Tipp (Stempelkarte, Story) */
    root.addEventListener("click", function (e) {
      if (Date.now() < (state.pinchClickUntil || 0)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
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
    startWhenTicker();
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
    if (host.onTodayActivity) host.onTodayActivity();

    var feed = buildFeedItems(flags);
    root.hidden = false;
    var html = "";
    /* Oben = Zukunft: weiter weg oben, nah an heute unten (umgekehrt zur Zeit) */
    html += '<div class="acc-feed-future" data-acc-zone="future">';
    /* Ab morgen wie im Wallet: Karten zusammengeschoben, Tipp schiebt eine frei. Heute bleibt offen. */
    var todayK = todayIso();
    for (var ui = feed.upcoming.length - 1; ui >= 0; ui--) {
      var itU = feed.upcoming[ui];
      var hU = renderFeedItem(itU);
      if (dayKey(itU.starts_at) > todayK) hU = hU.replace('<article class="acc-card', '<article class="acc-card is-wallet');
      html += hU;
    }
    html += "</div>";
    html += '<div class="acc-feed-today" data-acc-zone="today" id="acc-feed-today">';
    /* Spontan: Sportler-Icon in der Werkzeugzeile des aktuellen Events (eventToolRowHtml spontan) */
    feed.myToday.forEach(function (item) {
      html += renderFeedItem(item);
    });
    html += "</div>";
    html += '<div class="acc-feed-past" data-acc-zone="past">';
    feed.history.forEach(function (item) {
      html += renderFeedItem(item);
    });
    html += "</div>";
    if (flags.bubbleOnly && global.GoBubbles && GoBubbles.paintStrip) {
      var bid = host.bubbleId ? String(host.bubbleId() || "") : "";
      GoBubbles.paintStrip($("bubble-strip"), (state.events || []).filter(function (ev) {
        return ev && bid && String(ev.bubble_id || "") === bid && ev.status !== "ausgefallen" &&
          (String(ev.user_id) === me() || normalizeVisibility(ev.visibility) !== "privat");
      }), personOf, {
        query: state.bubbleQuery || "",
        onSearch: function (q) { state.bubbleQuery = String(q || "").trim(); render(); },
        onAdd: function () {
          var ask = global.GoDialog && GoDialog.confirm
            ? GoDialog.confirm("Zu Deiner Woche wechseln, um Events der Bubble hinzuzufügen?", { ok: "Ja", cancel: "Nein" })
            : Promise.resolve(global.confirm("Zu Deiner Woche wechseln, um Events der Bubble hinzuzufügen?"));
          ask.then(function (yes) {
            if (!yes) return;
            var pb = document.querySelector('.app-pill [data-shell="woche"]');
            if (pb) pb.click();
          });
        }
      });
    }
    if (flags.bubbleOnly && state.bubbleQuery && !feed.myToday.length && !feed.upcoming.length && !feed.history.length) {
      html += '<p class="acc-bubble-empty">Nichts gefunden für „' + esc(state.bubbleQuery) + '“.</p>';
    } else if (flags.bubbleOnly && !feed.myToday.length && !feed.upcoming.length && !feed.history.length) {
      html += '<p class="acc-bubble-empty">Noch ist es still hier.<br>Schreib unten etwas oder markiere ein Event in Kalender → Stift → Tage bearbeiten → Bubble.</p>';
    }

    var firstPaint = !state.paintedAktuell;
    var scroller = welcomeScrollEl();
    /* Boot: auf Heute zentrieren — sonst bleibt man auf Zukunft (z. B. 25.11.) */
    /* In den ersten 15 s nach dem Öffnen (solange nicht selbst gescrollt) bei jedem Nachladen neu
       auf das aktuelle Event zentrieren: spätere Zukunfts-Karten schoben es sonst nach unten */
    if (!state.bootAt) state.bootAt = Date.now();
    var bootPhase = !state.userScrolledAktuell && Date.now() - state.bootAt < 15000;
    var keepScroll =
      !firstPaint && !state.bootNeedsCenter && !bootPhase ? scroller.scrollTop || 0 : null;
    /* Feed sichtbar lassen — kein opacity-Flash bei Refresh */
    root.classList.remove("is-centering");
    patchFeed(root, placeSpontan(html));
    state.paintedAktuell = true;
    if (state.walletOpen) {
      var wOpen = root.querySelector('.acc-card.is-wallet[data-post-id="' + state.walletOpen + '"]');
      if (wOpen) wOpen.classList.add("is-open"); else state.walletOpen = "";
    }
    bindObserver(root);
    bindPhotoPinch(root);
    markSnapCard();
    bindHeuteScrollFilter();
    requestAnimationFrame(function () {
      if (keepScroll != null) {
        /* Nur zurücksetzen, wenn das Neuzeichnen wirklich verschoben hat: jedes scrollTop-Setzen
           stoppt auf iOS den Schwung, das fühlte sich wie magnetisches Einrasten an */
        if (Math.abs((scroller.scrollTop || 0) - keepScroll) > 1) scroller.scrollTop = keepScroll;
        return;
      }
      scrollCurrentToCenter({ soft: false, force: true });
      /* Nochmals nach Layout — Heute-Karte erst nach Event-Load da */
      requestAnimationFrame(function () {
        scrollCurrentToCenter({ soft: false, force: true });
        if (state.bootNeedsCenter && currentEventCard()) {
          state.bootNeedsCenter = false;
        }
      });
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

  /* Magnet aufs aktuelle Event wie eine Roulettekugel, ohne CSS-Snap (der bremste auf iOS jeden Schwung):
     - Finger weg, Feed rollt aus: kommt die Karte langsam genug (CATCH_V) in die Nähe der Mitte, wird der
       Schwung abgefangen und sie gleitet mit Ausrollen in die Mitte.
     - Schneller Schwung rauscht drüber. Bleibt der Feed von selbst nah daneben stehen, zieht es nach. */
  var CATCH_V = 2.4;   /* px pro ms, darunter fängt der Magnet ein (vorher 1,6) */
  var CATCH_R = 0.55;  /* Fangradius als Anteil der Kartenhöhe */
  function markSnapCard() {
    var el = currentEventCard();
    [].forEach.call(document.querySelectorAll(".acc-card.acc-snap"), function (c) {
      if (c !== el) c.classList.remove("acc-snap");
    });
    if (el && el.classList && el.classList.contains("acc-card")) el.classList.add("acc-snap");
    bindMagnet();
  }

  function bindMagnet() {
    var scroller = welcomeScrollEl();
    if (!scroller || scroller._magnetBound) return;
    scroller._magnetBound = true;
    var touching = false, gliding = false, idle = null, anim = 0, lastY = 0, lastT = 0, v = 0;
    function target() {
      var el = document.querySelector(".acc-card.acc-snap");
      if (!el) return null;
      var r = el.getBoundingClientRect();
      if (!r.height) return null;
      /* Karte mittig auf dem Screen, um die Icon-Zeile oben nach unten versetzt (parkMid) */
      return { delta: r.top + r.height / 2 - parkMid(), radius: Math.max(120, r.height * CATCH_R) };
    }
    function glide(delta) {
      var from = scroller.scrollTop || 0;
      var to = Math.max(0, from + delta);
      var t0 = 0, dur = Math.min(1040, 520 + 2 * Math.abs(delta)); /* halb so schnell wie zuvor */
      anim++;
      var my = anim;
      gliding = true;
      /* Beim Einparken kommt der Kopf (Icons + Profilkreise) wieder rein */
      var head = document.querySelector(".heute-filter-row");
      if (head) head.classList.remove("is-scroll-hide");
      /* Schwung stoppen: iOS hält beim kurzen overflow hidden an. Nur einen Frame lang, sonst
         ist ein neuer Wisch während des Einparkens tot (iOS entscheidet beim touchstart). */
      scroller.style.overflowY = "hidden";
      state.progScrollUntil = Date.now() + dur + 200;
      function step(ts) {
        if (my !== anim) return;
        if (!t0) { t0 = ts; scroller.style.overflowY = ""; }
        var k = Math.min(1, (ts - t0) / dur);
        var e = 1 - Math.pow(1 - k, 3);
        scroller.scrollTop = from + (to - from) * e;
        if (k < 1) requestAnimationFrame(step);
        else { gliding = false; anim++; }
      }
      requestAnimationFrame(step);
    }
    /* Finger wieder drauf: Einparken sofort lösen, der Wisch gehört dem Nutzer */
    function stopGlide() {
      if (!gliding) return;
      anim++;
      gliding = false;
      scroller.style.overflowY = "";
      state.progScrollUntil = 0;
    }
    function settle() {
      idle = null;
      if (touching || gliding || document.body.dataset.shell !== "heute") return;
      var t = target();
      if (t && Math.abs(t.delta) > 3 && Math.abs(t.delta) < t.radius) glide(t.delta);
    }
    scroller.addEventListener("touchstart", function () {
      touching = true;
      stopGlide();
      if (idle) clearTimeout(idle);
    }, { passive: true });
    function lift() { touching = false; if (idle) clearTimeout(idle); idle = setTimeout(settle, 160); }
    scroller.addEventListener("touchend", lift, { passive: true });
    scroller.addEventListener("touchcancel", lift, { passive: true });
    scroller.addEventListener("wheel", function () { stopGlide(); if (idle) clearTimeout(idle); idle = setTimeout(settle, 200); }, { passive: true });
    scroller.addEventListener("scroll", function () {
      var now = performance.now(), y = scroller.scrollTop || 0;
      if (lastT && now - lastT < 100) v = Math.abs(y - lastY) / Math.max(1, now - lastT); else v = 99;
      lastY = y; lastT = now;
      if (touching || gliding || document.body.dataset.shell !== "heute") return;
      if (Date.now() < (state.progScrollUntil || 0)) return;
      if (idle) clearTimeout(idle);
      idle = setTimeout(settle, 160);
      /* im Ausrollen: langsam genug über der Karte → einfangen */
      if (v < CATCH_V) {
        var t = target();
        if (t && Math.abs(t.delta) < t.radius && Math.abs(t.delta) > 3) glide(t.delta);
      }
    }, { passive: true });
  }

  /* Parkplatz: Screenmitte plus Höhe der Icon-Zeile (Info, Filter, Herz, Aktualisieren) */
  function parkMid() {
    var row = document.querySelector(".heute-filter-row");
    var btn = document.getElementById("heute-refresh") || document.getElementById("heute-info");
    var off = 0;
    if (row && btn) off = Math.max(0, btn.getBoundingClientRect().bottom - row.getBoundingClientRect().top);
    return window.innerHeight / 2 + off;
  }

  function currentEventCard() {
    var today = $("acc-feed-today");
    if (!today) return null;
    var cards = today.querySelectorAll(".acc-card:not(.acc-card--spontan)");
    if (cards && cards.length) return cards[0];
    var any = today.querySelector(".acc-card");
    if (any) return any;
    /* kein eigenes Event heute: nächstes kommendes (unterste Karte der Zukunft) */
    var fut = document.querySelectorAll('[data-acc-zone="future"] .acc-card');
    if (fut.length) return fut[fut.length - 1];
    return today;
  }

  /* Aktuelles Event in Screen-Mitte unter dem Filter-Header; soft nur auf Wunsch */
  function scrollCurrentToCenter(opts) {
    opts = opts || {};
    var soft = opts.soft === true;
    var force = opts.force === true;
    if (!force && state.userScrolledAktuell) return;
    var scroller = welcomeScrollEl();
    var el = currentEventCard();
    if (!scroller || !el) return;

    function run() {
      if (document.body.dataset.shell !== "heute") return;
      if (!force && state.userScrolledAktuell) return;
      var row = document.querySelector(".heute-filter-row");
      if (row) row.classList.remove("is-scroll-hide");
      /* Frisch gelayoutetes Element holen (nach HTML-Replace) */
      el = currentEventCard() || el;
      if (!el) return;
      var rect = el.getBoundingClientRect();
      if (!rect.height && !rect.width) return;
      /* gleiche Parkposition wie der Magnet (bindMagnet) */
      var mid = parkMid();
      var elMid = rect.top + rect.height / 2;
      var delta = elMid - mid;
      if (Math.abs(delta) < 4) return;
      var next = Math.max(0, (scroller.scrollTop || 0) + delta);
      state.progScrollUntil = Date.now() + 400;
      if (soft && typeof scroller.scrollTo === "function") {
        scroller.scrollTo({ top: next, behavior: "smooth" });
      } else {
        scroller.scrollTop = next;
      }
    }

    run();
    requestAnimationFrame(function () {
      requestAnimationFrame(run);
    });
  }

  function bindHeuteScrollFilter() {
    var row = document.querySelector(".heute-filter-row");
    var scroller = welcomeScrollEl();
    if (!row || !scroller || scroller._heuteFilterBound) return;
    scroller._heuteFilterBound = true;
    var last = scroller.scrollTop || 0;
    /* Eigenes Scrollen am Finger erkennen: kleine Schritte (< 8 px je Event) zählten sonst nicht,
       und Nachladen in den ersten 15 s zog den Feed zurück aufs aktuelle Event */
    ["touchmove", "wheel"].forEach(function (t) {
      scroller.addEventListener(t, function () {
        if (document.body.dataset.shell === "heute") state.userScrolledAktuell = true;
      }, { passive: true });
    });
    scroller.addEventListener(
      "scroll",
      function () {
        if (document.body.dataset.shell !== "heute") return;
        var y = scroller.scrollTop || 0;
        /* Einparken/Zentrieren per Code: Kopf nicht wegblenden */
        if (Date.now() < (state.progScrollUntil || 0)) { last = y; return; }
        if (Math.abs(y - last) > 8 && Date.now() > (state.progScrollUntil || 0)) state.userScrolledAktuell = true;
        var todayEl = $("acc-feed-today");
        var goingDown = y > last + 2;
        var goingUp = y < last - 2;
        var aboveToday = todayEl ? y + 40 < todayEl.offsetTop : false;
        /* Ganz oben zeigen; nach oben (Zukunft) soft weg; nach unten weg; zurück aus Historie wieder da */
        if (y <= 6) {
          row.classList.remove("is-scroll-hide");
        } else if (goingUp && aboveToday) {
          row.classList.add("is-scroll-hide");
        } else if (goingDown) {
          row.classList.add("is-scroll-hide");
        } else if (goingUp && !aboveToday) {
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

  function openDoneModal(eventId, opts) {
    opts = opts || {};
    var ev = state.events.find(function (e) {
      return String(e.id) === String(eventId);
    });
    var modal = $("acc-done-modal");
    if (!modal) return;
    var ttl = $("acc-done-title");
    if (ttl) ttl.textContent = opts.title || "Erledigt";
    var noteEl = $("acc-done-note");
    if (noteEl) noteEl.placeholder = opts.placeholder || "Kurznotiz (optional)";
    modal.hidden = false;
    modal.dataset.eventId = String(eventId);
    var want = normalizeVisibility((ev && ev.visibility) || "team");
    /* feine Sichtbarkeit (Gruppe, Circle, Bubble aus Tage bearbeiten) beim Abhaken behalten, solange nicht umgeschaltet */
    modal.dataset.origVis = want;
    if (want === "gruppe") want = "team";
    setDoneVis(want);
    modal.dataset.initVis = modal.dataset.vis || "";
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
    state.doneDraft = null;
    state.altReplace = null;
  }

  /* Original nur behalten, wenn es ohnehin klein ist (sonst lieber ohne Foto als Upload-Fehler) */
  function keepIfSmall(dataUrl) {
    if (dataUrl && dataUrl.length <= 1400000) return dataUrl;
    if (host.toast) host.toast("Foto konnte nicht verkleinert werden.");
    return "";
  }

  function compressDonePhoto(dataUrl) {
    return new Promise(function (resolve) {
      if (!dataUrl || dataUrl.indexOf("data:image") !== 0) {
        resolve(dataUrl || "");
        return;
      }
      var img = new Image();
      img.onload = function () {
        try {
          var max = 1280;
          var w = img.naturalWidth || img.width || 1;
          var h = img.naturalHeight || img.height || 1;
          var scale = Math.min(1, max / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(keepIfSmall(dataUrl));
            return;
          }
          ctx.drawImage(img, 0, 0, cw, ch);
          var out = canvas.toDataURL("image/jpeg", 0.82);
          if (out && out.length > 900000) out = canvas.toDataURL("image/jpeg", 0.65);
          if (out && out.length > 900000) out = canvas.toDataURL("image/jpeg", 0.5);
          resolve(out || keepIfSmall(dataUrl));
        } catch (e) {
          resolve(keepIfSmall(dataUrl));
        }
      };
      img.onerror = function () {
        resolve(keepIfSmall(dataUrl));
      };
      img.src = dataUrl;
    });
  }

  function readDonePhoto() {
    var input = $("acc-done-photo");
    if (!input || !input.files || !input.files[0]) return Promise.resolve("");
    var file = input.files[0];
    /* iPhone-Fotos (oft > 2,5 MB) werden unten auf max. 1280 px verkleinert; nur echte Ausreißer ablehnen */
    if (file.size > 25 * 1024 * 1024) {
      if (host.toast) host.toast("Foto zu groß (max. 25 MB).");
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
    }).then(compressDonePhoto).then(function (dataUrl) {
      /* Foto in den Bildspeicher statt als data-URL ins Event (spart Datenvolumen) */
      if (!dataUrl || !global.GoExMedia || !GoExMedia.uploadImage) return dataUrl;
      return fetch(dataUrl).then(function (r) { return r.blob(); })
        .then(function (b) { return GoExMedia.uploadImage(b, "events"); })
        .catch(function () { return dataUrl; });
    });
  }

  function patchEventDone(eventId, body) {
    var wantedNote = body.note;
    var wantedPhoto = body.photo_url;
    function attempt(payload) {
      return rest("events?id=eq." + encodeURIComponent(eventId), {
        method: "PATCH",
        prefer: "return=representation",
        body: payload
      });
    }
    function errMsg(err) {
      try {
        if (typeof err === "string") return err;
        if (err && err.message) return String(err.message);
        return JSON.stringify(err || {});
      } catch (e) {
        return String(err || "");
      }
    }
    return attempt(body)
      .catch(function (err) {
        var msg = errMsg(err);
        var next = Object.assign({}, body);
        var stripped = false;
        if (/note/i.test(msg) && Object.prototype.hasOwnProperty.call(next, "note")) {
          delete next.note;
          stripped = true;
        }
        if (/photo_url/i.test(msg) && Object.prototype.hasOwnProperty.call(next, "photo_url")) {
          delete next.photo_url;
          stripped = true;
        }
        /* Spalte fehlt noch (go-events-feed-hidden.sql): ohne speichern, bleibt dann privat */
        if (/feed_hidden/i.test(msg) && Object.prototype.hasOwnProperty.call(next, "feed_hidden")) {
          delete next.feed_hidden;
          stripped = true;
        }
        if (!stripped) throw err;
        return attempt(next).catch(function (err2) {
          var msg2 = errMsg(err2);
          var bare = { status: body.status, visibility: body.visibility };
          if (/note|photo_url/i.test(msg2)) return attempt(bare);
          throw err2;
        });
      })
      .then(function (rows) {
        var row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) row = { id: eventId, status: body.status, visibility: body.visibility };
        var storedOnEvent = {
          note: row.note != null && String(row.note).length ? String(row.note) : "",
          photo_url: row.photo_url || ""
        };
        var needMeta = {};
        if (wantedNote && !storedOnEvent.note) needMeta.note = wantedNote;
        if (wantedPhoto && !storedOnEvent.photo_url) needMeta.photo_url = wantedPhoto;
        row.note = storedOnEvent.note || wantedNote || "";
        row.photo_url = storedOnEvent.photo_url || wantedPhoto || "";
        row._mediaMeta = needMeta;
        return row;
      });
  }

  function clearInvitesForDoneEvent(eventId) {
    var uid = me();
    var ev = (state.events || []).filter(function (e) {
      return String(e.id) === String(eventId);
    })[0];
    var day = ev && ev.starts_at ? dayKey(ev.starts_at) : "";
    var tasks = [];
    /* RSVPs zum Event entfernen */
    if (eventId) {
      tasks.push(
        rest("event_rsvps?event_id=eq." + encodeURIComponent(eventId), {
          method: "DELETE",
          prefer: "return=minimal"
        }).catch(function () {})
      );
      delete state.rsvps[String(eventId)];
    }
    /* Buddy-Invites für denselben Tag (ausgehend + eingehend) canceln */
    if (day && uid) {
      tasks.push(
        rest(
          "go_workout_invites?from_id=eq." +
            encodeURIComponent(uid) +
            "&workout_date=eq." +
            encodeURIComponent(day) +
            "&status=in.(pending,accepted)",
          {
            method: "PATCH",
            prefer: "return=minimal",
            body: { status: "cancelled" }
          }
        ).catch(function () {})
      );
      tasks.push(
        rest(
          "go_workout_invites?to_id=eq." +
            encodeURIComponent(uid) +
            "&workout_date=eq." +
            encodeURIComponent(day) +
            "&status=in.(pending,accepted)",
          {
            method: "PATCH",
            prefer: "return=minimal",
            body: { status: "cancelled" }
          }
        ).catch(function () {})
      );
    }
    if (host && typeof host.clearInvitesForDay === "function") {
      tasks.push(Promise.resolve(host.clearInvitesForDay(day, eventId)));
    }
    return Promise.all(tasks);
  }

  function submitDone(noPost) {
    var modal = $("acc-done-modal");
    if (!modal) return;
    var eventId = modal.dataset.eventId;
    if (!eventId) return;
    noPost = noPost === true;
    var vis = normalizeVisibility(modal.dataset.vis || "team");
    if (vis === "gruppe") vis = "team";
    if (modal.dataset.origVis && modal.dataset.vis === modal.dataset.initVis && modal.dataset.origVis !== "privat") vis = modal.dataset.origVis;
    /* „Speichern ohne Posting“: erledigt, aber nur für mich, ohne Foto */
    if (noPost) vis = "privat";
    var note = (($("acc-done-note") && $("acc-done-note").value) || "").trim().slice(0, 500);
    var draft = eventId === "draft" ? state.doneDraft : null;
    if (eventId === "draft" && !draft) return;
    var ready = draft
      ? createUnplannedEvent(Object.assign({}, draft.payload, { visibility: vis })).then(function (nev) {
          state.doneDraft = null;
          eventId = String(nev.id);
          modal.dataset.eventId = eventId;
          state.events.push(nev);
          return markReplaced(draft.replace);
        })
      : Promise.resolve();
    ready
      .then(function () { return noPost ? "" : readDonePhoto(); })
      .then(function (photo) {
        var body = {
          status: "erledigt",
          visibility: vis
        };
        if (note) body.note = note;
        if (photo) body.photo_url = photo;
        if (noPost) body.feed_hidden = true;
        /* Heute beendet: Uhrzeit des Beendens wird Zeitstempel des Posts (Reihenfolge in Aktuell) */
        var evNow = state.events.find(function (e) { return String(e.id) === String(eventId); });
        if (evNow && dayKey(evNow.starts_at) === todayIso()) body.starts_at = new Date().toISOString();
        return patchEventDone(eventId, body).then(function (r) {
          if (global.GoTama) global.GoTama.invalidate();
          return r;
        });
      })
      .then(function (updated) {
        var photo = (updated && updated.photo_url) || "";
        var savedNote = (updated && updated.note) || note || "";
        state.events = state.events.map(function (e) {
          if (String(e.id) !== String(eventId)) return e;
          return Object.assign({}, e, updated || {}, {
            status: "erledigt",
            visibility: vis,
            note: savedNote,
            photo_url: photo || e.photo_url || ""
          });
        });
        var meta = (updated && updated._mediaMeta) || {};
        var tasks = [logActivity("checkin", eventId), clearInvitesForDoneEvent(eventId)];
        if (Object.keys(meta).length) {
          tasks.push(
            saveEventMediaFallback(eventId, meta.note || note || "", meta.photo_url || photo || "")
          );
        }
        return Promise.all(tasks);
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
        var msg = "Speichern fehlgeschlagen";
        try {
          if (err && err.message) msg = String(err.message);
          else if (typeof err === "string") msg = err;
        } catch (e) {}
        if (host.toast) host.toast(msg);
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

  /* Eigenes Event löschen bzw. fremdes absagen, immer mit Bestätigung */
  function ask(text, ok) {
    return global.GoDialog ? GoDialog.confirm(text, { ok: ok || "Ja" }) : Promise.resolve(global.confirm(text));
  }
  function removeEvent(eventId, mode) {
    if (!eventId) return;
    var cancel = mode === "cancel";
    if (mode === "skip") {
      var skipDay = String(eventId).replace(/^plan:/, "");
      ask("Training an diesem Tag aus dem Wochenplan nehmen?", "Rausnehmen").then(function (yes) {
      if (!yes) return;
      rest("events", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          user_id: me(),
          category: "alternative",
          course_id: null,
          starts_at: skipDay + "T12:00:00+01:00",
          status: "ausgefallen",
          title: "Ausgefallen",
          visibility: "privat",
          is_unplanned: false
        }
      })
        .then(function () {
          state.skippedDays = state.skippedDays || {};
          state.skippedDays[skipDay] = true;
          return refresh();
        })
        .catch(function () {
          if (host.toast) host.toast("Entfernen fehlgeschlagen");
        });
      });
      return;
    }
    ask(cancel ? "Teilnahme absagen?" : "Event löschen? Das lässt sich nicht rückgängig machen.", cancel ? "Absagen" : "Löschen").then(function (ok) {
      if (ok) removeEventNow(eventId, cancel);
    });
  }
  function removeEventNow(eventId, cancel) {
    if (cancel) {
      var invC = inviteFor(eventId);
      if (invC) {
        rest("rpc/go_decline_invite", { method: "POST", body: { p_invite_id: invC.id } })
          .then(function () {
            delete state.invites[String(eventId)];
            return refresh();
          })
          .catch(function () {
            if (host.toast) host.toast("Absagen fehlgeschlagen");
          });
        return;
      }
      if (iAmGoing(eventId)) toggleRsvp(eventId);
      return;
    }
    rest("events?id=eq." + encodeURIComponent(eventId), { method: "DELETE", prefer: "return=minimal" })
      .then(function () {
        state.events = (state.events || []).filter(function (e) {
          return String(e.id) !== String(eventId);
        });
        if (host.toast) host.toast("Event gelöscht");
        return refresh();
      })
      .catch(function () {
        if (host.toast) host.toast("Löschen fehlgeschlagen");
      });
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
        var evD = (state.events || []).filter(function (e) {
          return String(e.id) === String(eventId);
        })[0];
        var zD = evD && parseZirkelNote(evD.note);
        if (zD && zD.mode === "double") openPartnerSheet(eventId);
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
    if (!inviteIso && card.getAttribute("data-plan-iso")) {
      inviteIso = card.getAttribute("data-plan-iso") || "";
    }
    var eventId =
      (card.getAttribute("data-event-id") || "").trim() ||
      (/^[0-9a-f-]{36}$/i.test(String(postId)) ? postId : "");
    var html = postBarHtml({
      postId: postId,
      eventId: eventId,
      inviteIso: inviteIso,
      canInvite: canInviteOnDay(inviteIso),
      actions: actions
    });
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    var next = tmp.firstChild;
    if (!next) return;
    if (bar) bar.replaceWith(next);
    else card.appendChild(next);
  }

  function closeCommentModal() {
    var modal = $("acc-comment-modal");
    if (modal) {
      modal.hidden = true;
      modal.dataset.postId = "";
      modal.dataset.replyTo = "";
      modal.dataset.replyAcc = "";
    }
    document.body.classList.remove("is-comment-open");
    var input = $("acc-comment-text");
    if (input) input.value = "";
  }

  function paintCommentModalList(postId) {
    var listEl = $("acc-comment-list");
    if (!listEl) return;
    var list = state.comments[postId] || [];
    /* Dialog ist nur zum Schreiben: Kommentare stehen unter dem Event */
    listEl.hidden = true;
    listEl.innerHTML = "";
    void list;
  }

  function openComments(postId, reply) {
    if (!postId) return;
    var modal = $("acc-comment-modal");
    if (!modal) return;
    modal.dataset.postId = postId;
    modal.dataset.replyTo = (reply && reply.id) || "";
    modal.dataset.replyAcc = (reply && reply.account) || "";
    var ta0 = $("acc-comment-text");
    if (ta0) ta0.placeholder = reply && reply.account ? "Antwort an " + String(personOf(reply.account).name || "").split(" ")[0] + " …" : "Schreiben…";
    modal.hidden = false;
    document.body.classList.add("is-comment-open");
    paintCommentModalList(postId);
    var input = $("acc-comment-text");
    if (input) {
      input.value = "";
      requestAnimationFrame(function () {
        input.focus();
      });
    }
  }

  function saveEventCommentFallback(eventId, text) {
    var marker = commentMarker(eventId);
    var short = (marker + "\n" + text).slice(0, 144);
    return rest("go_community_posts", {
      method: "POST",
      prefer: "return=representation",
      body: {
        author_id: me(),
        kind: "text",
        body: short,
        photo_url: JSON.stringify({ text: text })
      }
    });
  }

  function addComment(postId, text, reply) {
    text = String(text || "").trim();
    if (!text || !postId || !me()) return;
    var temp = {
      id: "local-" + Date.now(),
      account_id: me(),
      text: text.slice(0, 500),
      created_at: new Date().toISOString(),
      reply_to_account: (reply && reply.account) || null
    };
    /* Antwort ohne events-UUID (Tagebuch, FFC, Plan): Bezug als @Name im Text */
    var replyName = reply && reply.account ? String(personOf(reply.account).name || "").split(" ")[0] : "";
    if (!state.comments[postId]) state.comments[postId] = [];
    state.comments[postId].push(temp);
    personOf(me());
    paintPostBar(postId);
    paintCommentModalList(postId);
    var modalInput = $("acc-comment-text");
    if (modalInput) modalInput.value = "";
    closeCommentModal();

    var save;
    if (String(postId).indexOf("diary:") === 0) {
      var parts = String(postId).split(":");
      var ownerId = parts[1] || me();
      var day = parts[2] || todayIso();
      var tagged =
        "⟦ix:" + day + "⟧" + (replyName ? "@" + replyName + " " : "") + temp.text.slice(0, Math.max(0, 144 - (12 + String(day).length)));
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
      /* Kein events-UUID — permanent über Community-Post-Marker */
      save = saveEventCommentFallback(postId, replyName ? "@" + replyName + " " + temp.text : temp.text);
    } else {
      var cBody = { event_id: postId, account_id: me(), text: temp.text };
      var postC = function (b) { return rest("event_comments", { method: "POST", prefer: "return=representation", body: b }); };
      save = (reply && reply.id
        ? postC(Object.assign({ reply_to: reply.id, reply_to_account: reply.account }, cBody)).catch(function () {
            /* ohne go-comment-replies.sql: normal speichern */
            return postC(cBody);
          })
        : postC(cBody)
      ).catch(function () {
        /* Tabelle fehlt oft — Fallback Community-Post, damit Kommentar bleibt */
        return saveEventCommentFallback(postId, temp.text);
      });
    }

    save
      .then(function (rows) {
        var saved = Array.isArray(rows) ? rows[0] : rows;
        if (saved && saved.id) {
          var list = state.comments[postId] || [];
          var resolvedText = temp.text;
          if (saved.text) resolvedText = saved.text;
          else if (saved.photo_url && String(saved.photo_url).charAt(0) === "{") {
            try {
              var packed = JSON.parse(saved.photo_url);
              if (packed && packed.text) resolvedText = String(packed.text);
            } catch (e) {}
          } else if (saved.body && String(saved.body).indexOf("[[c:") < 0 && String(saved.body).indexOf("⟦ix:") < 0) {
            resolvedText = saved.body;
          }
          for (var i = 0; i < list.length; i++) {
            if (list[i].id === temp.id) {
              list[i] = {
                id: saved.id,
                account_id: saved.account_id || saved.author_id || me(),
                text: resolvedText,
                created_at: saved.created_at || temp.created_at,
                reply_to_account: saved.reply_to_account || null
              };
              break;
            }
          }
          paintPostBar(postId);
        }
      })
      .catch(function () {
        /* Optimistic Comment bleibt in state.comments + Teaser */
        paintPostBar(postId);
      });
  }

  function enrollmentsForCategory(cat) {
    return state.enrollments.filter(function (en) {
      var c = en.courses || en.course || {};
      if (c.is_system) return false;
      var def = String(c.category_default || "").toLowerCase();
      return def === cat;
    });
  }

  /* Einheiten nur aus den eigenen aktiven Wochenplänen: Nutzer wählen Pläne, keine einzelnen Workouts.
     Ohne Plan: leere Liste mit units.noPlan = true. */
  function loadSingleUnits(kind) {
    var plans = (state.enrollments || []).filter(function (en) {
      var c = en.courses || en.course || {};
      return en.course_id && !c.is_system;
    }).map(function (en) { return String(en.course_id); });
    if (!plans.length) { var none = []; none.noPlan = true; return Promise.resolve(none); }
    return rest(
      "course_sessions?course_id=in.(" + plans.map(encodeURIComponent).join(",") + ")&category=eq." + encodeURIComponent(kind) +
        "&unit_course_id=not.is.null&select=unit_course_id,title&order=session_no.asc"
    ).then(function (rows) {
      var seen = {}, out = [];
      (rows || []).forEach(function (r) {
        var id = String(r.unit_course_id);
        if (seen[id]) return;
        seen[id] = 1;
        out.push({ id: r.unit_course_id, title: r.title });
      });
      return out;
    }).catch(function () { return []; });
  }
  function askForPlan() {
    if (!global.GoDialog) return;
    GoDialog.choose("Erst einen Wochenplan wählen", [{ label: "Wochenplan wählen", value: "plan" }], {
      center: true, sub: "Bei gogogo trainierst Du nach Wochenplan. Die Einheiten daraus kannst Du dann auch spontan machen.", cancel: "Später"
    }).then(function (v) {
      if (v === "plan") setTimeout(function () { if (global.WocheReels && WocheReels.openPlanPicker) WocheReels.openPlanPicker(); }, 0);
    });
  }

  function createUnplannedEvent(payload) {
    var body = {
      user_id: me(),
      category: payload.category,
      course_id: payload.course_id || null,
      enrollment_id: payload.enrollment_id || null,
      starts_at: payload.starts_at || new Date().toISOString(),
      location: payload.location || null,
      note: payload.note || null,
      visibility: normalizeVisibility(payload.visibility || state.pendingVis || "team"),
      is_unplanned: true,
      status: payload.status || "geplant",
      title: payload.title || payload.category
    };
    if (payload.photo_url) body.photo_url = payload.photo_url;
    if (payload.group_id) body.group_id = payload.group_id;
    if (payload.bubble_id) body.bubble_id = payload.bubble_id;
    var err = host.validateOwnEvent ? host.validateOwnEvent(body) : null;
    if (err) {
      if (host.toast) host.toast(err);
      return Promise.reject(new Error(err));
    }
    /* item_type 'alternative' (go-alternative.sql): Kreis zeigt dann nur Start; ohne SQL ohne Kennzeichen */
    var post = function (b) { return rest("events", { method: "POST", prefer: "return=representation", body: b }); };
    var bodyT = payload.item_type ? Object.assign({ item_type: payload.item_type }, body) : body;
    return post(bodyT).catch(function (e1) {
      if (!payload.item_type && !/circle|bubble/.test(body.visibility)) throw e1;
      var b2 = Object.assign({}, body);
      if (/circle|bubble/.test(b2.visibility)) b2.visibility = b2.visibility === "circle" ? "privat" : "team";
      return post(b2);
    }).then(function (rows) {
      var ev = Array.isArray(rows) ? rows[0] : rows;
      /* „Statt dem Plan“: geplantes Event erst jetzt als ausgefallen markieren (die Alternative zählt als erledigt) */
      if (state.altReplace && ev && ev.id) {
        var repl = state.altReplace;
        state.altReplace = null;
        rest("events?id=eq." + encodeURIComponent(repl) + "&status=eq.geplant", {
          method: "PATCH", prefer: "return=minimal", body: { status: "ausgefallen" }
        }).catch(function () {});
      }
      var inviteIds = payload.inviteIds || [];
      var inviteP =
        ev && ev.id && inviteIds.length && host.inviteToEvent
          ? Promise.resolve(host.inviteToEvent(ev.id, inviteIds)).catch(function () {})
          : Promise.resolve();
      return inviteP.then(function () {
        return logActivity("unplanned_start", ev && ev.id).then(function () {
          return ev;
        });
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
            (v === "team" ? "zeigen" : "privat") +
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
        /* Sonstiges: gleich loggen, mit Foto und Notiz; angelegt wird erst beim Speichern */
        modal.hidden = true;
        if (host.closeGoPick) host.closeGoPick();
        var repl = state.altReplace;
        state.altReplace = null;
        openDraftDone({ category: "alternative", title: "Sonstiges", visibility: vis }, repl, "Sonstiges");
      });
      pick.appendChild(startBtn);
      return;
    }

    if (kind === "zirkel") {
      openZirkelSetup();
      return;
    }

    function openZirkelSetup() {
      var ffcOk = !!(global.FFC && FFC.user && FFC.user());
      if (!ffcOk) {
        modal.hidden = true;
        if (host.toast) host.toast("Zirkeltraining läuft über Plus: bitte bei FFC anmelden.");
        if (host.openZirkel) host.openZirkel();
        return;
      }
      kinds.hidden = true;
      title.hidden = false;
      title.textContent = "Zirkeltraining";
      pick.hidden = false;
      pick.innerHTML =
        visPickerHtml() +
        GoZirkelSetup.html({ mode: "single" }, { friends: ffcPartners() }) +
        '<label class="gz-online"><input type="checkbox" id="acc-z-online" /> Optional: online mitmachen</label>';
      GoZirkelSetup.bind(pick);
      var later = document.createElement("button");
      later.type = "button";
      later.className = "sand-quiet";
      later.textContent = "Startzeit festlegen";
      later.addEventListener("click", function () {
        var zl = GoZirkelSetup.read(pick);
        zl.online = !!(($("acc-z-online") || {}).checked);
        openZirkelLater(zl, readCreateVis(pick));
      });
      var go = document.createElement("button");
      go.type = "button";
      go.textContent = "Start";
      go.addEventListener("click", function () {
        var z = GoZirkelSetup.read(pick);
        z.online = !!(($("acc-z-online") || {}).checked);
        var vis = readCreateVis(pick);
        loadZirkelCourse().then(function (cid) {
          if (!cid) {
            if (host.toast) host.toast("Kurs Zirkeltraining fehlt (go-trainings-to-courses.sql)");
            return;
          }
          /* Kein Event vorab: FFC-Training läuft, beim Speichern entsteht das erledigte Event */
          modal.hidden = true;
          if (host.closeGoPick) host.closeGoPick();
          var forEv = state.zirkelFor || null;
          state.zirkelFor = null;
          if (host.openZirkel) host.openZirkel(Object.assign({}, z, {
            autostart: true,
            onSaved: function () {
              if (forEv && forEv.id) {
                return rest("events?id=eq." + encodeURIComponent(forEv.id), {
                  method: "PATCH", prefer: "return=minimal", body: { status: "erledigt", starts_at: new Date().toISOString() }
                }).then(refresh).catch(function () {});
              }
              return createUnplannedEvent({
                category: "zirkel", course_id: cid, title: "Zirkeltraining",
                note: GoZirkelSetup.toNote(z), visibility: vis, status: "erledigt"
              }).then(refresh).catch(function () {});
            }
          }));
          return null;
        });
      });
      pick.appendChild(go);
      pick.appendChild(later);
    }

    /* Partner für Double: nur Freunde, die bei FFC (Nickname + Passwort) sind */
    function ffcPartners() {
      var nick = {};
      try {
        ((global.FFC && FFC.friends && FFC.friends()) || []).forEach(function (f) {
          if (f && f.status === "accepted" && f.nickname) nick[String(f.nickname).toLowerCase()] = f.friend_id;
        });
      } catch (e) {}
      return (host.teamPeople || []).filter(function (p) {
        return p && p.id && String(p.id) !== String(me()) && p.nickname && nick[String(p.nickname).toLowerCase()];
      }).map(function (p) {
        return { id: p.id, name: String(p.name || p.nickname).split(" ")[0], ffcId: nick[String(p.nickname).toLowerCase()] };
      });
    }

    /* „Startzeit festlegen“: Tag + Uhrzeit wählen → Event in Aktuell/Woche, FFC-Event, Partner bestätigt bei sich */
    function openZirkelLater(z, vis) {
      title.textContent = "Wann startest Du?";
      var days = [];
      for (var i = 0; i < 7; i++) {
        var d = new Date(Date.now() + i * 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
        days.push(d);
      }
      var times = [];
      for (var h = 5; h <= 22; h++) for (var m = 0; m < 60; m += 15) times.push((h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m);
      var dayPick = days[0];
      pick.innerHTML =
        '<div class="gz-days">' + days.map(function (d, i) {
          var lab = i === 0 ? "Heute" : i === 1 ? "Morgen" : new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric" });
          return '<button type="button" class="gz-day' + (i === 0 ? " is-on" : "") + '" data-gz-day="' + d + '">' + lab + "</button>";
        }).join("") + "</div>" +
        '<div class="gz-time"><div class="gz-time__col" data-gz-time>' + times.map(function (t) { return '<span class="gz-time__opt">' + t + "</span>"; }).join("") + "</div></div>";
      var col = pick.querySelector("[data-gz-time]");
      var nowMin = new Date().getHours() * 60 + new Date().getMinutes() + 30;
      var idx = Math.max(0, times.findIndex(function (t) { var p = t.split(":"); return Number(p[0]) * 60 + Number(p[1]) >= nowMin; }));
      requestAnimationFrame(function () { col.scrollTop = idx * 44; });
      pick.querySelectorAll("[data-gz-day]").forEach(function (b) {
        b.addEventListener("click", function () {
          dayPick = b.getAttribute("data-gz-day");
          pick.querySelectorAll("[data-gz-day]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
        });
      });
      var save = document.createElement("button");
      save.type = "button";
      save.textContent = "Event anlegen";
      save.addEventListener("click", function () {
        var t = times[Math.max(0, Math.min(times.length - 1, Math.round(col.scrollTop / 44)))];
        var startsAt = new Date(dayPick + "T" + t + ":00" + berlinOffset(dayPick)).toISOString();
        save.disabled = true;
        loadZirkelCourse().then(function (cid) {
          return createUnplannedEvent({
            category: "zirkel", course_id: cid || null, title: "Zirkeltraining",
            note: GoZirkelSetup.toNote(z), visibility: vis, status: "geplant", starts_at: startsAt
          });
        }).then(function (ev) {
          var jobs = [];
          /* Double: Partner bekommt eine Einladung und bestätigt bei sich (Popup nach Aktualisieren) */
          if (ev && ev.id && z.mode === "double" && z.partnerId) {
            jobs.push(rest("go_workout_invites", {
              method: "POST", prefer: "return=minimal",
              body: { event_id: ev.id, from_id: me(), to_id: z.partnerId, status: "pending", workout_date: dayPick }
            }).catch(function () {}));
          }
          /* FFC: Event in Hendriks App, Partner eingeladen */
          if (global.FFC && FFC.createEvent) {
            var partner = ffcPartners().filter(function (p) { return String(p.id) === String(z.partnerId); })[0];
            jobs.push(Promise.resolve(FFC.createEvent({ title: "Zirkeltraining", startsAt: startsAt, inviteeIds: partner ? [partner.ffcId] : [] })).catch(function () {}));
          }
          return Promise.all(jobs);
        }).then(function () {
          modal.hidden = true;
          if (host.closeGoPick) host.closeGoPick();
          if (global.GoDialog) GoDialog.alert("Zirkeltraining steht" + (z.mode === "double" && z.partnerName ? ". " + z.partnerName + " bestätigt bei sich." : "."));
          return refresh();
        }).catch(function () {
          save.disabled = false;
          if (host.toast) host.toast("Event anlegen ging nicht.");
        });
      });
      pick.appendChild(save);
    }
    function berlinOffset(iso) {
      try {
        var d = new Date(iso + "T12:00:00Z");
        var berlin = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
        var utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
        var off = Math.round((berlin - utc) / 60000);
        var sign = off >= 0 ? "+" : "-";
        off = Math.abs(off);
        return sign + String(Math.floor(off / 60)).padStart(2, "0") + ":" + String(off % 60).padStart(2, "0");
      } catch (e) { return "+01:00"; }
    }

    /* Kraft / Ausdauer: Einzeleinheit wählen → direkt tracken. Das Event entsteht erst beim Abschluss. */
    if ((kind === "kraft" || kind === "ausdauer") && host.openEventWorkout) {
      kinds.hidden = true;
      title.hidden = false;
      title.textContent = "Welche Einheit?";
      pick.hidden = false;
      pick.innerHTML = visPickerHtml() + '<p class="acc-spontan-loading">Lädt …</p>';
      loadSingleUnits(kind).then(function (units) {
        var loading = pick.querySelector(".acc-spontan-loading");
        if (loading) loading.remove();
        if (units.noPlan) {
          modal.hidden = true;
          if (host.closeGoPick) host.closeGoPick();
          askForPlan();
          return;
        }
        if (!units.length) {
          pick.insertAdjacentHTML("beforeend", "<p>Dein Wochenplan hat keine Einheit in dieser Kategorie.</p>");
          return;
        }
        units.forEach(function (u) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = u.title;
          b.addEventListener("click", function () {
            var vis = readCreateVis(pick);
            modal.hidden = true;
            if (host.closeGoPick) host.closeGoPick();
            host.openEventWorkout({
              course_id: u.id,
              title: u.title,
              category: kind,
              starts_at: new Date().toISOString(),
              spontan: { category: kind, course_id: u.id, visibility: vis }
            });
          });
          pick.appendChild(b);
        });
      });
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
      function run(courseId) {
        if (!courseId) {
          if (host.toast) host.toast("Eigenes Training konnte nicht angelegt werden.");
          return;
        }
        var vis = readCreateVis(pick);
        finishCreate({
          category: kind,
          course_id: courseId,
          title: "Eigenes Training",
          visibility: vis
        });
      }
      if (state.eigenCourseId) {
        run(state.eigenCourseId);
        return;
      }
      loadEigenCourse().then(function () {
        run(state.eigenCourseId);
      });
    });

    var friends = (host.teamPeople || []).filter(function (p) {
      return p && p.id && String(p.id) !== String(me());
    });
    if (friends.length) {
      var inviteBox = document.createElement("div");
      inviteBox.className = "acc-spontan-invite";
      inviteBox.innerHTML = "<p class=\"acc-spontan-invite__h\">Freunde einladen</p>";
      friends.slice(0, 12).forEach(function (p) {
        var lab = document.createElement("label");
        lab.className = "acc-spontan-invite__row";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = String(p.id);
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(" " + (p.name || p.nickname || "Freund")));
        inviteBox.appendChild(lab);
      });
      var invBtn = document.createElement("button");
      invBtn.type = "button";
      invBtn.className = "acc-spontan-invite__go";
      invBtn.textContent = "Event erstellen & einladen";
      invBtn.addEventListener("click", function () {
        var ids = Array.prototype.map
          .call(inviteBox.querySelectorAll("input:checked"), function (el) {
            return el.value;
          })
          .filter(Boolean);
        var vis = readCreateVis(pick);
        var courseId = state.eigenCourseId;
        Promise.resolve(courseId ? courseId : loadEigenCourse().then(function () { return state.eigenCourseId; }))
          .then(function (cid) {
            if (!cid) {
              if (host.toast) host.toast("Eigenes Training konnte nicht angelegt werden.");
              return null;
            }
            return finishCreate({
              category: kind,
              course_id: cid,
              title: kind === "zirkel" ? "Zirkeltraining" : "Eigenes Training",
              visibility: vis,
              inviteIds: ids
            });
          });
      });
      inviteBox.appendChild(invBtn);
      pick.appendChild(inviteBox);
    }
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

  function evById(id) {
    return (state.events || []).filter(function (x) { return String(x.id) === String(id); })[0] || null;
  }
  function evDayIso(ev) {
    return new Date(ev.starts_at).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  }

  /* Kreis unter dem eigenen Event: Start · Alternative · Schieben */
  function openEventMenu(id) {
    var ev = evById(id);
    if (!ev || !global.GoDialog) return;
    var today = evDayIso(ev) === todayIso();
    if (!today) return;
    var choices = [];
    if (today) choices.push({ label: ev.category === "zirkel" ? "Start: Zirkeltraining" : "Start", value: "start" });
    /* eingetragene Alternative: nur noch starten, kein zweites Ausweichen */
    if (ev.item_type !== "alternative") {
      choices.push({ label: "Alternative", value: "alt" });
      choices.push({ label: "Schieben auf morgen", value: "move" });
    }
    if (!choices.length) return;
    GoDialog.choose(String(ev.title || "Training"), choices).then(function (v) {
      if (v === "start") return startEvent(ev);
      if (v === "alt") return alternativeFor(ev);
      if (v === "move") return moveToTomorrow(ev);
    });
  }

  function startEvent(ev) {
    if (ev.category === "zirkel") {
      var z = global.GoZirkelSetup && GoZirkelSetup.parse ? GoZirkelSetup.parse(ev.note) : {};
      if (host.openZirkel) host.openZirkel(Object.assign({}, z || {}, {
        eventId: ev.id,
        onSaved: function () {
          return rest("events?id=eq." + encodeURIComponent(ev.id), {
            method: "PATCH", prefer: "return=minimal", body: { status: "erledigt", starts_at: new Date().toISOString() }
          }).then(function () {
            if (global.GoTama) GoTama.invalidate();
            return refresh();
          }).catch(function () {});
        }
      }));
      return;
    }
    /* Kraft: immer Workout. Ausdauer: Eieruhr. Diverses: „Schreib, wie es war“. */
    if (ev.category === "kraft" && host.openEventWorkout) {
      host.openEventWorkout(ev);
      return;
    }
    if (ev.category === "ausdauer" && global.GoTimer) {
      Promise.resolve(host.eventMinutes ? host.eventMinutes(ev) : 30)
        .catch(function () { return 30; })
        .then(function (min) {
          GoTimer.start({ id: ev.id, title: ev.title || "Ausdauer", minutes: min || 30 });
        });
      return;
    }
    openDoneModal(ev.id, { title: "Schreib, wie es war", placeholder: "Wie war es?" });
  }

  /* „Du hast für diesen Tag eine Reise vom 24.11. bis 28.11. eingestellt.“ oder "" */
  function travelNoteFor(iso) {
    var r = null;
    try { r = host.travelRange ? host.travelRange() : null; } catch (e) {}
    if (!r || !r.start || !r.end || iso < r.start || iso > r.end) return "";
    function de(d) { var p = String(d).split("-"); return Number(p[2]) + "." + Number(p[1]) + "."; }
    return "Du hast für diesen Tag eine Reise vom " + de(r.start) + " bis " + de(r.end) + " eingestellt.";
  }

  function alternativeFor(ev) {
    var today = evDayIso(ev) === todayIso();
    var trip = travelNoteFor(evDayIso(ev));
    var ask = today
      ? GoDialog.choose(trip || "Alternativ oder zusätzlich zum heutigen Plan?", [
          { label: "Statt " + (ev.title || "Plan"), value: "instead" },
          { label: "Zusätzlich", value: "extra" }
        ], trip ? { sub: "Alternativ oder zusätzlich zum heutigen Plan?" } : {})
      : Promise.resolve("extra");
    ask.then(function (v) {
      if (!v) return;
      var replace = v === "instead" ? String(ev.id) : null;
      setTimeout(function () { pickAltUnit(replace); }, 0);
    });
  }

  /* Alternative aus der Liste der Einzeleinheiten: erst Art, dann Einheit, dann loggen.
     Ein Event entsteht erst beim Loggen (Abbrechen legt nichts an). */
  var ALT_KINDS = [
    { label: "🤸 Bewegung (z. B. Schritte)", value: "alternative" },
    { label: "🏋️ Kraft", value: "kraft" },
    { label: "🏃 Ausdauer", value: "ausdauer" },
    { label: "🔥 Zirkeltraining", value: "zirkel" }
  ];
  function pickAltUnit(replace) {
    GoDialog.choose("Was machst Du stattdessen?", ALT_KINDS).then(function (kind) {
      if (!kind) return;
      if (kind === "zirkel") {
        return loadZirkelCourse().then(function (cid) {
          if (host.openZirkel) host.openZirkel({
            onSaved: function () {
              return createUnplannedEvent({ category: "zirkel", course_id: cid, title: "Zirkeltraining", status: "erledigt" })
                .then(function () { return markReplaced(replace); })
                .then(function () { if (global.GoTama) GoTama.invalidate(); return refresh(); })
                .catch(function () {});
            }
          });
        });
      }
      return loadSingleUnits(kind).then(function (units) {
        if (units.noPlan) { askForPlan(); return; }
        if (!units.length) { GoDialog.alert("Dein Wochenplan hat keine Einheit in dieser Kategorie."); return; }
        return GoDialog.choose("Welche Einheit?", units.map(function (u) {
          return { label: (emojiFor(kind, u.title) + " " + u.title).trim(), value: String(u.id) };
        })).then(function (uid) {
          if (!uid) return;
          var unit = units.filter(function (u) { return String(u.id) === uid; })[0] || {};
          /* Bewegung (alternative) hat in der DB keinen Kurs, nur den Titel */
          /* Schritte sind standardmäßig privat; zeigen muss man bewusst wählen */
          var payload = { category: kind, course_id: kind === "alternative" ? null : unit.id, title: unit.title,
            visibility: /schritte/i.test(unit.title || "") ? "privat" : "team" };
          return planAlternative(kind, unit, payload, replace);
        });
      });
    });
  }
  /* Sichtbarkeit wie in Woche → Tage bearbeiten */
  function altVisList() {
    var out = [{ value: "privat", label: "privat" }];
    var g = host.myGroups ? (host.myGroups() || [])[0] : null;
    if (g) out.push({ value: "gruppe", label: "Gruppe", group_id: g.id });
    if (ffcUsable()) out.push({ value: "circle", label: "Circle" });
    var bid = host.bubbleId ? host.bubbleId() : "";
    if (bid) out.push({ value: "bubble", label: "Bubble", bubble_id: bid });
    out.push({ value: "team", label: "Team" });
    return out;
  }
  /* Sichtbarkeit eines eigenen Events über die drei Punkte am Bild */
  function changeEventVisibility(id) {
    var ev = (state.events || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!ev || !global.GoDialog || !GoDialog.vis) return;
    /* wie das Dropdown in Aktuell: Ich · Community · Meine Bubble · Alles
       Alles = Community + Bubble (visibility team mit bubble_id) */
    var bid = host.bubbleId ? String(host.bubbleId() || "") : "";
    var list = [{ value: "privat", label: "nur ich" }, { value: "team", label: "Community" }];
    if (bid) list.push({ value: "bubble", label: "Bubble" }, { value: "alles", label: "alle" });
    var vis = normalizeVisibility(ev.visibility || "team");
    var cur = vis === "privat" ? "privat" : vis === "bubble" ? "bubble" : (bid && String(ev.bubble_id || "") === bid ? "alles" : "team");
    GoDialog.vis("Sichtbarkeit", { vis: cur, visList: list, extra: "Löschen" }).then(function (v) {
      if (v === "__extra") { removeEvent(id, "delete"); return; }
      if (!v || v === cur) return;
      var pick = list.filter(function (x) { return x.value === v; })[0] || {};
      var body = v === "alles" ? { visibility: "team", bubble_id: bid }
        : v === "bubble" ? { visibility: "bubble", bubble_id: bid }
        : { visibility: v, bubble_id: null };
      function save(b) { return rest("events?id=eq." + encodeURIComponent(id), { method: "PATCH", prefer: "return=minimal", body: b }); }
      save(body)
        .catch(function (err) {
          /* ohne go-bubbles.sql gibt es bubble_id nicht: nur Sichtbarkeit setzen */
          if (v === "privat" || v === "team") { var b2 = { visibility: v }; body = b2; return save(b2); }
          throw err;
        })
        .then(function () {
          Object.keys(body).forEach(function (k) { ev[k] = body[k]; });
          if (host.toast) host.toast("Sichtbar: " + (pick.label || v));
          if (global.WocheReels && WocheReels.refresh) { try { WocheReels.refresh(); } catch (eW) {} }
          render();
        })
        .catch(function () {
          if (host.toast) host.toast(v === "bubble" || v === "alles" ? "Ging nicht (go-bubbles.sql?)" : "Ändern ging gerade nicht");
        });
    });
  }

  function altTimes() {
    var now = new Date();
    var p = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Berlin" }).split(":");
    var nowMin = Number(p[0]) * 60 + Number(p[1]);
    var out = [];
    for (var m = 6 * 60; m <= 23 * 60 + 30; m += 30) if (m > nowMin) out.push(Math.floor(m / 60) + ":" + (m % 60 ? "30" : "00"));
    return out;
  }
  /* Alternative: Sichtbarkeit, Uhrzeit (eintragen) oder sofort starten.
     Kraft → Workout, Ausdauer → Uhr, Bewegung/Sonstiges → „Wie war es?“ + Foto. */
  function planAlternative(kind, unit, payload, replace) {
    var list = altVisList();
    return GoDialog.plan((emojiFor(kind, unit.title) + " " + (unit.title || "Training")).trim(), {
      vis: normalizeVisibility(payload.visibility || "team"), visList: list, times: altTimes(),
      /* Schritte: immer 22:00 voreingestellt */
      time: /schritte/i.test(unit.title || "") ? "22:00" : ""
    }).then(function (r) {
      if (!r) return;
      var vo = list.filter(function (x) { return x.value === r.vis; })[0] || {};
      var p = Object.assign({}, payload, { visibility: r.vis, item_type: "alternative" });
      if (vo.group_id) p.group_id = vo.group_id;
      if (vo.bubble_id) p.bubble_id = vo.bubble_id;
      if (r.action === "save") {
        var day = todayIso();
        var hh = (r.time.length === 4 ? "0" : "") + r.time;
        var off = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" }).format(new Date(day + "T12:00:00Z")).match(/GMT([+-]\d{2}):?(\d{2})?/);
        p.starts_at = day + "T" + hh + ":00" + (off ? off[1] + ":" + (off[2] || "00") : "+01:00");
        return createUnplannedEvent(p)
          .then(function () { return markReplaced(replace); })
          .then(function () { if (global.GoTama) GoTama.invalidate(); return refresh(); })
          .then(function () { if (host.toast) host.toast(unit.title + " um " + r.time + " eingetragen"); })
          .catch(function () { if (host.toast) host.toast("Eintragen ging nicht"); });
      }
      if (kind === "kraft" || kind === "ausdauer") {
        return createUnplannedEvent(p).then(function (nev) {
          return markReplaced(replace).then(function () { return refresh(); }).then(function () {
            if (kind === "kraft" && host.openEventWorkout) { host.openEventWorkout(nev); return; }
            if (kind === "ausdauer" && global.GoTimer) { GoTimer.start({ id: nev.id, title: nev.title || "Ausdauer", minutes: 30 }); return; }
            openDoneModal(nev.id, { title: "Schreib, wie es war", placeholder: "Wie war es?" });
          });
        });
      }
      /* Bewegung / Sonstiges: gleich erledigt eintragen */
      return GoDialog.done(unit.title || "Erledigt").then(function (d) {
        if (!d) return;
        var up = d.file && global.GoExMedia && GoExMedia.uploadImage ? GoExMedia.uploadImage(d.file, "events").catch(function () { return ""; }) : Promise.resolve("");
        return up.then(function (url) {
          p.status = "erledigt";
          p.starts_at = new Date().toISOString();
          if (d.text) p.note = d.text.slice(0, 500);
          if (url) p.photo_url = url;
          return createUnplannedEvent(p);
        }).then(function () { return markReplaced(replace); })
          .then(function () { if (global.GoTama) GoTama.invalidate(); return refresh(); })
          .catch(function () { if (host.toast) host.toast("Speichern ging nicht"); });
      });
    });
  }

  function markReplaced(replace) {
    if (!replace) return Promise.resolve();
    return rest("events?id=eq." + encodeURIComponent(replace) + "&status=eq.geplant", {
      method: "PATCH", prefer: "return=minimal", body: { status: "ausgefallen" }
    }).catch(function () {});
  }
  /* Erledigt-Dialog ohne Event: angelegt wird erst bei „Speichern“ */
  function openDraftDone(payload, replace, title) {
    state.doneDraft = { payload: payload, replace: replace || null };
    var modal = $("acc-done-modal");
    if (!modal) return;
    openDoneModal("draft", { title: title || "Erledigt", placeholder: "Wie war es? (optional)" });
    setDoneVis(normalizeVisibility(payload.visibility || "team"));
  }

  function moveToTomorrow(ev) {
    var d = new Date(ev.starts_at);
    d.setDate(d.getDate() + 1);
    return rest("events?id=eq." + encodeURIComponent(ev.id), {
      method: "PATCH", prefer: "return=minimal", body: { starts_at: d.toISOString() }
    }).then(function () {
      try { if (global.GoTama) GoTama.invalidate(); } catch (e1) {}
      try { if (global.WocheReels && WocheReels.refresh) WocheReels.refresh(); } catch (e2) {}
      Promise.resolve().then(refresh).catch(function () {});
      return GoDialog.alert("Verschoben auf morgen.");
    }, function () {
      if (host.toast) host.toast("Verschieben ging nicht.");
    });
  }

  /* Winken: Anfrage an den Ersteller, ob ich mitmachen kann (go-event-requests.sql) */
  function sendJoinRequest(id, btn) {
    var ev = evById(id);
    if (!ev || state.waved[String(id)]) return;
    /* vorher bestätigen: Einheit, Uhrzeit, Ort, mit wem */
    var owner = String(personOf(ev.user_id).name || "").split(" ")[0];
    var when = hasTime(ev)
      ? new Date(ev.starts_at).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) + " Uhr"
      : (dayKey(ev.starts_at) === todayIso() ? "Heute" : new Date(ev.starts_at).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" })) + ", Uhrzeit offen";
    var text = "Ich möchte mitmachen.\n\n" + (ev.title || "Training") + "\n" + when + (ev.location ? " · " + ev.location : "") + "\nmit " + owner +
      (hasTime(ev) ? "" : "\n\n" + owner + " wird gefragt, wann es losgeht.");
    ask(text, "Senden").then(function (yes) {
      if (yes) sendJoinRequestNow(ev, id, btn);
    });
  }
  function sendJoinRequestNow(ev, id, btn) {
    rest("go_event_requests", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: { event_id: ev.id, from_id: me(), to_id: ev.user_id, status: "pending" }
    }).then(function () {
      state.waved[String(id)] = true;
      if (btn) { btn.classList.add("is-on"); btn.setAttribute("aria-label", "Anfrage gesendet"); }
      if (host.toast) host.toast("Anfrage gesendet. Du bekommst Bescheid.");
    }).catch(function (err) {
      if (host.toast) host.toast(/go_event_requests|relation/.test(String((err && err.message) || "")) ? "go-event-requests.sql fehlt noch in Supabase" : "Anfrage ging nicht.");
    });
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
    if (t.closest("[data-cmt-more]")) return;
    var shareB = t.closest("[data-acc-share]");
    if (shareB) {
      openEventShare(shareB.getAttribute("data-acc-share"), shareB.getAttribute("data-acc-share-day"));
      return;
    }
    /* eigene Bubble-Nachricht: drei Punkte → löschen */
    var msgMore = t.closest("[data-msg-more]");
    if (msgMore) {
      var mid = msgMore.getAttribute("data-msg-more");
      var ask = global.GoDialog && GoDialog.confirm
        ? GoDialog.confirm("Nachricht löschen?", { ok: "Löschen", cancel: "Abbrechen" })
        : Promise.resolve(global.confirm("Nachricht löschen?"));
      ask.then(function (yes) {
        if (!yes) return;
        var isKreis = (state.kreisMsgs || []).some(function (m) { return String(m.id) === String(mid); });
        rest((isKreis ? "go_aktuell_posts" : "go_bubble_messages") + "?id=eq." + encodeURIComponent(mid), { method: "DELETE", prefer: "return=minimal" })
          .then(function () {
            state.bubbleMsgs = (state.bubbleMsgs || []).filter(function (m) { return String(m.id) !== String(mid); });
            state.kreisMsgs = (state.kreisMsgs || []).filter(function (m) { return String(m.id) !== String(mid); });
            var art = document.querySelector('.acc-msg[data-msg-id="' + String(mid).replace(/"/g, "") + '"]');
            if (art) art.remove();
          })
          .catch(function () { if (host && host.toast) host.toast("Löschen hat nicht geklappt"); });
      });
      return;
    }
    var replyC = t.closest("[data-reply-cmt]");
    if (replyC) {
      openComments(replyC.getAttribute("data-reply-post"), {
        id: replyC.getAttribute("data-reply-cmt"),
        account: replyC.getAttribute("data-reply-acc")
      });
      return;
    }
    var openC = t.closest("[data-open-comments]");
    if (openC) {
      openComments(openC.getAttribute("data-open-comments"));
      return;
    }
    var zAdmin = t.closest("[data-acc-zadmin]");
    if (zAdmin) {
      if (!global.GoZirkelSync) return;
      var zAct = zAdmin.getAttribute("data-acc-zadmin");
      var zAsk = zAct === "now" && global.GoDialog
        ? GoDialog.confirm("Jetzt für alle starten?", { ok: "Sofortstart" })
        : Promise.resolve(true);
      zAsk.then(function (yes) {
        if (!yes) return;
        zAdmin.disabled = true;
        GoZirkelSync.admin(zAdmin.getAttribute("data-id"), zAct)
          .then(function () {
            if (host.toast) host.toast(zAct === "now" ? "Start für alle in 10 s" : zAct === "go" ? "Countdown läuft" : "Countdown angehalten");
            return refresh();
          })
          .catch(function () {
            zAdmin.disabled = false;
            if (host.toast) host.toast("Hat nicht geklappt");
          });
      });
      return;
    }
    var invitePost = t.closest("[data-invite-post]");
    if (invitePost) {
      var invIso = invitePost.getAttribute("data-invite-iso") || "";
      var invId = invitePost.getAttribute("data-invite-post") || "";
      var invEv = (state.events || []).find(function (x) { return String(x.id) === String(invId); });
      var dayMine = (state.events || []).filter(function (x) {
        return String(x.user_id) === me() && dayKey(x.starts_at) === invIso && x.status !== "ausgefallen";
      });
      var timed = invEv ? hasTime(invEv) : dayMine.some(hasTime);
      if (!timed && (invEv || dayMine.length)) {
        if (global.GoDialog) GoDialog.note("Setz die Uhrzeit im Kalender fest, um Freunde einzuladen.");
        return;
      }
      if (host.openInviteForPost) host.openInviteForPost(invIso, invitePost.getAttribute("data-invite-post") || "");
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
    var badgeInfo = t.closest("[data-badge-info]");
    if (badgeInfo) {
      var info = BADGE_INFO[badgeInfo.getAttribute("data-badge-info")] || "";
      if (info && host.toast) host.toast(info);
      return;
    }
    var spontan = t.closest("[data-spontan]");
    if (spontan) {
      if (host.openGoPick) host.openGoPick();
      return;
    }
    var plusLabel = t.closest("[data-shell-plus]");
    if (plusLabel) {
      if (host.openPlusTab) host.openPlusTab();
      else if (host.showShell) host.showShell("kurse");
      return;
    }
    var nutritionCard = t.closest("[data-nutrition]");
    if (
      nutritionCard &&
      !t.closest(".acc-card__bar") &&
      !t.closest(".acc-comments") &&
      !t.closest("[data-shell-plus]")
    ) {
      var nday = nutritionCard.getAttribute("data-nutrition-day") || todayIso();
      if (host.openNutritionLogModal) host.openNutritionLogModal({ day: nday });
      else if (typeof global.openNutritionLogModal === "function") {
        global.openNutritionLogModal({ day: nday });
      }
      return;
    }
    var acc = t.closest("[data-accept-invite]");
    if (acc) {
      acc.disabled = true;
      rest("rpc/go_accept_invite", { method: "POST", body: { p_invite_id: acc.getAttribute("data-accept-invite") } })
        .then(function (res) {
          if (res === "expired" && host.toast) host.toast("Einladung ist abgelaufen");
          return refresh();
        })
        .catch(function () {
          acc.disabled = false;
          if (host.toast) host.toast("Teilnehmen fehlgeschlagen (go-event-invites.sql ausgeführt?)");
        });
      return;
    }
    var rm = t.closest("[data-remove-event]");
    if (rm) {
      removeEvent(rm.getAttribute("data-remove-event"), rm.getAttribute("data-remove-mode"));
      return;
    }
    var invStart = t.closest("[data-inv-start]");
    if (invStart) { startInvite(invStart.getAttribute("data-inv-start")); return; }
    var invCancel = t.closest("[data-inv-cancel]");
    if (invCancel) { cancelInvite(invCancel.getAttribute("data-inv-cancel")); return; }
    var evMenu = t.closest("[data-ev-menu]");
    if (evMenu) {
      openEventMenu(evMenu.getAttribute("data-ev-menu"));
      return;
    }
    var heart = t.closest("[data-heart-ev]");
    if (heart) {
      removeEvent(heart.getAttribute("data-heart-ev"), "cancel");
      return;
    }
    /* Zurückziehen: graue Hand (eigene Anfrage) bzw. Freund mit Sanduhr (eigene Einladung) */
    var wd = t.closest("[data-withdraw-to]");
    if (wd) {
      var wTo = wd.getAttribute("data-withdraw-to"), wEv = wd.getAttribute("data-withdraw-ev"), wIso = wd.getAttribute("data-withdraw-iso");
      var wName = String(personOf(wTo).name || "").split(" ")[0];
      askWithdraw("Einladung zurückziehen" + (wName ? " an " + wName : "") + "?").then(function (yes) {
        if (!yes) return;
        var q = "go_workout_invites?from_id=eq." + encodeURIComponent(me()) + "&to_id=eq." + encodeURIComponent(wTo) + "&status=eq.pending" +
          (wEv ? "&event_id=eq." + encodeURIComponent(wEv) : "&workout_date=eq." + encodeURIComponent(wIso));
        rest(q, { method: "PATCH", prefer: "return=minimal", body: { status: "cancelled" } })
          .then(function () {
            if (host.reloadInvites) return host.reloadInvites();
          })
          .then(function () { render(); if (host.toast) host.toast("Einladung zurückgezogen"); })
          .catch(function () { if (host.toast) host.toast("Zurückziehen ging gerade nicht"); });
      });
      return;
    }
    var waveOn = t.closest(".acc-tool--wave.is-on[data-wave-ev]");
    if (waveOn) {
      var rEv = waveOn.getAttribute("data-wave-ev");
      askWithdraw("Anfrage zurückziehen?").then(function (yes) {
        if (!yes) return;
        rest("go_event_requests?event_id=eq." + encodeURIComponent(rEv) + "&from_id=eq." + encodeURIComponent(me()) + "&status=eq.pending", {
          method: "DELETE", prefer: "return=representation"
        }).then(function (gone) {
          if (!gone || !gone.length) throw new Error("rls");
          delete state.waved[String(rEv)];
          render();
          if (host.toast) host.toast("Anfrage zurückgezogen");
        }).catch(function () {
          if (host.toast) host.toast("Zurückziehen ging nicht (go-event-requests-withdraw.sql?)");
        });
      });
      return;
    }
    var wave = t.closest("[data-wave-ev]");
    if (wave) {
      sendJoinRequest(wave.getAttribute("data-wave-ev"), wave);
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
    var zp = t.closest("[data-zpartner]");
    if (zp) {
      openPartnerSheet(zp.getAttribute("data-zpartner"));
      return;
    }
    /* Event-Bild antippen: nur Stempelkarte (heute, aktive Karte). */
    var visDots = t.closest("[data-vis-ev]");
    if (visDots) {
      e.preventDefault();
      changeEventVisibility(visDots.getAttribute("data-vis-ev"));
      return;
    }
    var mediaHit = t.closest(".acc-card__media");
    if (mediaHit && !t.closest("button, a, input")) {
      var cardW = mediaHit.closest(".acc-card[data-event-id]");
      var evA = cardW ? (state.events || []).filter(function (x) { return String(x.id) === cardW.getAttribute("data-event-id"); })[0] : null;
      /* Heutiges Event, bei dem ich dabei bin → meine Stempelkarte (Freund scannt, Pünktlichkeit gegenseitig) */
      if (evA && host.openStampCard &&
          new Date(evA.starts_at).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }) === todayIso() &&
          (String(evA.user_id) === me() || iAmGoing(evA.id) || !!inviteFor(evA.id)) &&
          host.openStampCard(evA)) {
        return;
      }
      /* Sonst ist das Bild nicht aktiv: Start nur über den Kreis unten links oder „Start“ */
      return;
    }
    var onl = t.closest("[data-online-join]");
    if (onl) {
      joinOnline(onl.getAttribute("data-online-join"));
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

  function softTimeout(promise, ms) {
    return Promise.race([
      Promise.resolve(promise).catch(function () {}),
      new Promise(function (resolve) {
        setTimeout(resolve, ms || 2500);
      })
    ]);
  }

  /* Feed neu zeichnen, ohne dass Bilder blitzen: unveränderte Karten bleiben dieselben
     DOM-Knoten, in geänderten Karten werden vorhandene <img> mit gleicher Quelle übernommen. */
  function patchFeed(root, html) {
    if (!root.firstElementChild) {
      root.innerHTML = html;
      return;
    }
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    var oldZones = {};
    Array.prototype.forEach.call(root.children, function (z) {
      if (z.getAttribute("data-acc-zone")) oldZones[z.getAttribute("data-acc-zone")] = z;
    });
    var imgPool = {};
    var reused = [];
    Array.prototype.forEach.call(root.querySelectorAll("img"), function (img) {
      var src = img.getAttribute("src") || "";
      (imgPool[src] = imgPool[src] || []).push(img);
    });
    Array.prototype.forEach.call(tmp.children, function (nz) {
      var oz = oldZones[nz.getAttribute("data-acc-zone") || ""];
      if (!oz) return;
      var pool = {};
      Array.prototype.forEach.call(oz.children, function (c) {
        (pool[c.outerHTML] = pool[c.outerHTML] || []).push(c);
      });
      Array.prototype.slice.call(nz.children).forEach(function (nc) {
        var same = pool[nc.outerHTML];
        if (same && same.length) {
          var keep = same.shift();
          Array.prototype.forEach.call(keep.querySelectorAll("img"), function (img) {
            var list = imgPool[img.getAttribute("src") || ""];
            if (list && list.indexOf(img) !== -1) list.splice(list.indexOf(img), 1);
            reused.push(img);
          });
          nz.replaceChild(keep, nc);
        }
      });
    });
    /* geänderte Karten: Bilder mit gleicher Quelle übernehmen (kein neues Dekodieren) */
    Array.prototype.forEach.call(tmp.querySelectorAll("img"), function (img) {
      if (reused.indexOf(img) !== -1) return;
      var list = imgPool[img.getAttribute("src") || ""];
      var old = list && list.shift();
      if (!old) return;
      old.className = img.className;
      img.parentNode.replaceChild(old, img);
    });
    while (root.firstChild) root.removeChild(root.firstChild);
    while (tmp.firstChild) root.appendChild(tmp.firstChild);
  }

  function refresh() {
    if (!host || !me()) return Promise.resolve();
    var seq = ++state.refreshSeq;
    function stillCurrent() {
      return seq === state.refreshSeq;
    }
    var histReady =
      host.prepareHeuteHistory
        ? Promise.resolve(host.prepareHeuteHistory()).catch(function () {})
        : Promise.resolve();
    /* Kern-Feed zuerst — nicht auf FFC warten (sonst bleibt Aktuell leer) */
    return Promise.all([
      loadStreak(),
      loadEigenCourse(),
      loadEnrollments(),
      loadEvents().then(loadMyInvites),
      loadFfcEvents(),
      loadFfcPosts(),
      loadBubbleMsgs(),
      loadKreisMsgs(),
      histReady
    ])
      .then(function () {
        if (!stillCurrent()) return null;
        var ids = state.events.map(function (e) {
          return String(e.id);
        });
        var synthetic = [];
        (state.ffcEvents || []).forEach(function (ev) {
          if (ev && ev.id) synthetic.push("ffc-" + String(ev.id));
        });
        if (host && host.heutePlanItems) {
          (host.heutePlanItems() || []).forEach(function (p) {
            if (p && (p.iso || p.starts_at)) {
              synthetic.push("plan:" + String(p.iso || dayKey(p.starts_at)));
            }
          });
        }
        return Promise.all([
          loadRsvps(ids),
          loadComments(ids),
          loadSyntheticCommentKeys(synthetic)
        ]);
      })
      .then(function (ok) {
        if (ok == null || !stillCurrent()) return;
        if (host.heuteDiaryComments) {
          mergeDiaryComments(host.heuteDiaryComments() || {});
        }
        render();
        saveTodayHint();
        checkReplies();
        if (!state.readySent) {
          state.readySent = true;
          try { document.dispatchEvent(new CustomEvent("go:aktuell-ready")); } catch (eR) {}
        }
      })
      .then(function () {
        if (!stillCurrent()) return;
        if (!(global.FFC && FFC.refreshHeute && FFC.user && FFC.user())) return;
        /* FFC nachziehen — stiller Update, ohne zweiten Full-Render (Scroll-Hitch) */
        return softTimeout(FFC.refreshHeute(), 2800).then(function () {
          if (!stillCurrent()) return;
          return Promise.all([loadFfcEvents(), loadFfcPosts()]).then(function () {
            if (!stillCurrent()) return;
            /* Boot: nach FFC noch einmal zentrieren; sonst nur wenn User nicht scrollt */
            if (state.userScrolledAktuell && !state.bootNeedsCenter) return;
            render();
          });
        });
      });
  }

  /* Herz oben rechts: Antworten auf meine Kommentare (go-comment-replies.sql). Roter Punkt = neue Antwort seit dem letzten Tipp. */
  function replySeenKey() { return "gogogo_reply_seen_" + me(); }
  function replySeen() {
    try { return localStorage.getItem(replySeenKey()) || ""; } catch (e) { return ""; }
  }
  function paintReplyHeart() {
    var btn = $("heute-replies");
    if (!btn) return;
    var r = state.lastReply;
    var fresh = !!(r && r.created_at && String(r.created_at) > replySeen());
    btn.classList.toggle("has-new", fresh);
    btn.setAttribute("aria-label", fresh ? "Neue Antwort auf Deinen Kommentar" : "Antworten auf Deine Kommentare");
  }
  function checkReplies() {
    if (!me() || state.repliesMissing) return Promise.resolve();
    var now = Date.now();
    if (state.repliesAt && now - state.repliesAt < 15000) { paintReplyHeart(); return Promise.resolve(); }
    state.repliesAt = now;
    /* Herz meldet: Antworten auf meine Kommentare und offene Einladungen an mich (z. B. über eine Gruppe) */
    var replies = rest(
      "event_comments?reply_to_account=eq." + encodeURIComponent(me()) +
        "&account_id=neq." + encodeURIComponent(me()) +
        "&select=id,event_id,account_id,created_at&order=created_at.desc&limit=20"
    ).catch(function () { return null; });
    var invites = rest(
      /* Einladungen der letzten 7 Tage (auch beantwortete) für die Liste; offene zählen für den roten Punkt */
      "go_workout_invites?to_id=eq." + encodeURIComponent(me()) +
        "&event_id=not.is.null&created_at=gte." + encodeURIComponent(new Date(Date.now() - 7 * 86400000).toISOString()) +
        "&select=id,event_id,from_id,workout_label,workout_date,status,created_at&order=created_at.desc&limit=40"
    ).catch(function () { return null; });
    var extra = host && host.heartNotices ? Promise.resolve(host.heartNotices()).catch(function () { return []; }) : Promise.resolve([]);
    var bub = moreHeartItems().catch(function () { return []; });
    return Promise.all([replies, invites, extra, bub]).then(function (r) {
      var list = [];
      (r[0] || []).forEach(function (x) { list.push(Object.assign({ kind: "reply" }, x)); });
      (r[1] || []).forEach(function (x) {
        var open = x.status === "pending" && String(x.workout_date || "") >= todayIso();
        list.push(Object.assign({ kind: "invite", past: !open }, x));
      });
      (r[2] || []).forEach(function (x) { if (x && x.created_at) list.push(x); });
      (r[3] || []).forEach(function (x) { if (x && x.created_at) list.push(x); });
      list.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
      /* Liste: alles der letzten 7 Tage, offene Anfragen auch älter */
      var since = new Date(Date.now() - 7 * 86400000).toISOString();
      list = list.filter(function (x) { return !x.past || String(x.created_at) >= since; });
      list = list.filter(function (x) { return x.kind !== "reply" || String(x.created_at) >= since; });
      state.lastReply = list.filter(function (x) { return !x.past; })[0] || null;
      state.heartList = list;
      paintReplyHeart();
      var pids = [];
      list.forEach(function (x) {
        ["account_id", "from_id", "author_id", "user_id", "coach_id", "to_id"].forEach(function (k) { if (x[k]) pids.push(String(x[k])); });
      });
      if (pids.length) return ensurePeople(pids).catch(function () {});
    });
  }
  function heartLabel(x) {
    if (x.label) return x.label;
    if (typeof x.labelFn === "function") return x.labelFn();
    var first = function (id) { return String(personOf(id).name || "Jemand").split(" ")[0]; };
    if (x.kind === "reply") return first(x.account_id) + " hat auf Deinen Kommentar geantwortet";
    if (x.kind === "invite") {
      var st2 = { accepted: "angenommen", declined: "abgesagt", maybe: "vielleicht", cancelled: "zurückgezogen", expired: "abgelaufen" }[x.status];
      return (st2 ? "Einladung von " + first(x.from_id) : first(x.from_id) + " lädt Dich ein") + (x.workout_label ? ": " + x.workout_label : "") + (st2 ? " · " + st2 : "");
    }
    if (x.kind === "bubble") return "Neues in Deiner Bubble";
    return "Neue Meldung";
  }
  function heartWhen(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) return "";
    var day = dayKey(at), t = todayIso();
    var y = new Date(t + "T12:00:00"); y.setDate(y.getDate() - 1);
    var lab = day === t ? "Heute" : day === y.toLocaleDateString("en-CA") ? "Gestern" : d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric", timeZone: "Europe/Berlin" });
    return lab + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  }
  /* Herz: alle Meldungen als Liste, neueste oben, ohne Überschrift; neue mit Punkt */
  function openHeartList(list) {
    var seen = replySeen();
    if (!list.length) list = [];
    var old = document.querySelector(".hl-wrap");
    if (old) old.remove();
    if (!document.getElementById("hl-css")) {
      var st = document.createElement("style");
      st.id = "hl-css";
      st.textContent =
        /* mittig, so breit wie die Events (20 px Rand), 4/5 der Bildschirmhöhe */
        ".hl-wrap{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:0 20px;background:rgba(20,16,12,.42)}" +
        ".hl-card{width:100%;max-width:560px;height:80vh;height:80dvh;display:flex;flex-direction:column;overflow-y:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px;padding:10px 16px 14px;font-family:Inter,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.25)}" +
        ".hl-row{flex:none;display:flex;align-items:flex-start;gap:10px;width:100%;padding:12px 0;border:0;border-bottom:1px solid rgba(42,33,24,.12);background:none;text-align:left;color:inherit;font:inherit;cursor:pointer}" +
        ".hl-row:last-of-type{border-bottom:0}" +
        ".hl-dot{flex:none;width:8px;height:8px;margin-top:7px;border-radius:50%;background:transparent}.hl-row.is-new .hl-dot{background:#E5383B}" +
        ".hl-txt{font-size:15px;font-weight:500;line-height:1.35}.hl-row.is-new .hl-txt{font-weight:700}" +
        ".hl-when{display:block;margin-top:2px;font-size:12px;color:rgba(42,33,24,.6)}" +
        ".hl-empty{margin:auto 0;text-align:center;font-size:15px;color:rgba(42,33,24,.6)}" +
        ".hl-close{display:block;width:100%;min-height:44px;margin-top:auto;flex:none;border:1.5px solid #2A2118;border-radius:999px;background:transparent;color:#2A2118;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}";
      document.head.appendChild(st);
    }
    var wrap = document.createElement("div");
    wrap.className = "hl-wrap";
    wrap.innerHTML = '<div class="hl-card" role="dialog" aria-label="Meldungen">' + list.map(function (x, i) {
      var isNew = !x.past && String(x.created_at || "") > seen;
      return '<button type="button" class="hl-row' + (isNew ? " is-new" : "") + '" data-hl="' + i + '"><span class="hl-dot"></span><span><span class="hl-txt">' +
        esc(heartLabel(x)) + '</span><span class="hl-when">' + esc(heartWhen(x.created_at)) + "</span></span></button>";
    }).join("") + (list.length ? "" : '<p class="hl-empty">Keine Meldungen in den letzten 7 Tagen.</p>') +
      '<button type="button" class="hl-close">Schließen</button></div>';
    document.body.appendChild(wrap);
    /* geöffnet = gelesen (roter Punkt am Herz aus) */
    if (list[0]) { try { localStorage.setItem(replySeenKey(), String(list[0].created_at)); } catch (e) {} }
    paintReplyHeart();
    wrap.addEventListener("click", function (e) {
      var row = e.target.closest(".hl-row");
      if (row) {
        var x = list[Number(row.getAttribute("data-hl"))];
        wrap.remove();
        if (x && typeof x.open === "function") { x.open(); return; }
        if (x && x.event_id) openReplyEvent(x.event_id);
        return;
      }
      if (e.target.closest(".hl-close") || e.target === wrap) wrap.remove();
    });
  }
  function replyThreadText(eventId) {
    return (state.comments[eventId] || []).map(function (c) {
      var nm = String(personOf(c.account_id).name || "").split(" ")[0];
      var to = c.reply_to_account ? "@" + String(personOf(c.reply_to_account).name || "").split(" ")[0] + " " : "";
      return nm + ": " + to + c.text;
    }).join("\n\n");
  }
  function openReplyEvent(eventId) {
    eventId = String(eventId);
    state.cmtOpen = state.cmtOpen || {};
    state.cmtOpen[eventId] = true;
    state.walletOpen = eventId;
    function focus() {
      var card = document.querySelector('.acc-card[data-event-id="' + eventId.replace(/"/g, "") + '"]');
      if (!card) return false;
      if (card.classList.contains("is-wallet")) card.classList.add("is-open");
      var cl = card.querySelector(".acc-card__teaser.has-more");
      if (cl && !cl.classList.contains("is-open")) {
        cl.classList.add("is-open");
        var mb = cl.querySelector("[data-cmt-more]");
        if (mb) mb.textContent = "weniger";
      }
      setTimeout(function () {
        try { card.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { card.scrollIntoView(); }
      }, 60);
      return true;
    }
    if (focus()) return;
    /* Event im aktuellen Filter nicht sichtbar: auf Alles stellen */
    var step = state.filter !== "alles" ? (saveFilter("alles"), refresh()) : Promise.resolve();
    step.then(function () {
      if (focus()) return;
      /* außerhalb des Feeds: Verlauf als Dialog */
      return rest("event_comments?event_id=eq." + encodeURIComponent(eventId) +
        "&select=id,event_id,account_id,text,created_at,reply_to_account&order=created_at.asc&limit=100")
        .then(function (rows) {
          (rows || []).forEach(function (c) { pushComment(eventId, c); });
          var pids = [];
          (rows || []).forEach(function (c) { pids.push(String(c.account_id)); if (c.reply_to_account) pids.push(String(c.reply_to_account)); });
          return ensurePeople(pids);
        })
        .then(function () {
          var txt = replyThreadText(eventId);
          if (global.GoDialog && txt) GoDialog.alert("Kommentare", { body: txt, ok: "OK" });
        })
        .catch(function () {});
    });
  }
  function onReplyHeart() {
    function go(r) {
      if (!r) {
        if (host && host.toast) host.toast("Noch nichts Neues");
        return;
      }
      try { localStorage.setItem(replySeenKey(), String(r.created_at)); } catch (e) {}
      paintReplyHeart();
      /* eigene Meldungen des Hosts (z. B. Gruppenanfrage) öffnen ihren Dialog selbst */
      if (typeof r.open === "function") { r.open(); return; }
      openReplyEvent(r.event_id);
    }
    function show() {
      var list = (state.heartList || []).slice().sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
      openHeartList(list);
    }
    if (state.heartList && state.heartList.length) { show(); return; }
    state.repliesAt = 0;
    checkReplies().then(show);
  }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("#heute-replies")) { e.preventDefault(); onReplyHeart(); }
  });

  function askWithdraw(q) {
    return global.GoDialog && GoDialog.confirm
      ? GoDialog.confirm(q, { ok: "Zurückziehen", cancel: "Abbrechen" })
      : Promise.resolve(global.confirm(q));
  }

  function resetAktuellPaint() {
    state.paintedAktuell = false;
    state.userScrolledAktuell = false;
    state.bootNeedsCenter = true;
  }

  /* Um 0:00 neu laden: neuer Tag, Ringe und „heute“ springen um */
  function scheduleMidnight() {
    if (state.midnightTimer) clearTimeout(state.midnightTimer);
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    state.midnightTimer = setTimeout(function () {
      refresh();
      scheduleMidnight();
    }, Math.max(60000, next - now));
  }

  /* Trainingszeit-Frage: morgens (5 bis 12 Uhr) für heute, abends (ab 18 Uhr) für morgen.
     Fragt beim nächsten eigenen geplanten Event ohne Uhrzeit, je Event und Tageszeit nur einmal.
     Mit Uhrzeit sehen Freunde sie im Feed und am Profilkreis. */
  function berlinHour() {
    try { return Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false })) % 24; }
    catch (e) { return new Date().getHours(); }
  }
  function isoPlus(iso, n) {
    var d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function berlinOffsetOf(iso) {
    try {
      var d = new Date(iso + "T12:00:00Z");
      var berlin = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
      var utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
      var off = Math.round((berlin - utc) / 60000);
      return (off >= 0 ? "+" : "-") + String(Math.floor(Math.abs(off) / 60)).padStart(2, "0") + ":" + String(Math.abs(off) % 60).padStart(2, "0");
    } catch (e) { return "+01:00"; }
  }
  function askTrainTime() {
    if (state.ttBusy || !me() || !global.GoDialog || !GoDialog.time) return;
    if (document.hidden || document.querySelector(".god")) return;
    var h = berlinHour();
    var slot = h >= 5 && h < 12 ? "morgen" : h >= 18 ? "abend" : "";
    if (!slot) return;
    var iso = slot === "morgen" ? todayIso() : isoPlus(todayIso(), 1);
    var off = berlinOffsetOf(iso);
    var from = iso + "T00:00:00" + off;
    var to = isoPlus(iso, 1) + "T00:00:00" + berlinOffsetOf(isoPlus(iso, 1));
    state.ttBusy = true;
    rest("events?user_id=eq." + encodeURIComponent(me()) + "&status=eq.geplant&starts_at=gte." + encodeURIComponent(from) +
      "&starts_at=lt." + encodeURIComponent(to) + "&select=id,title,category,item_type,travel_auto,starts_at,visibility&order=starts_at.asc&limit=10")
      .then(function (rows) {
        var ev = (rows || []).filter(function (e) {
          /* auch bei „Nur Ich“ fragen: die Uhrzeit hilft beim eigenen Planen */
          return e && !hasTime(e) && !e.travel_auto && e.category !== "zirkel" &&
            e.item_type !== "support_session" && e.item_type !== "hotel_workout";
        })[0];
        if (!ev) return;
        var key = "go_tt_" + ev.id + "_" + slot;
        try { if (localStorage.getItem(key)) return; } catch (eLs0) { if (state[key]) return; }
        /* Liegt schon ein anderer Dialog offen (Einladung, Anfrage): warten, bis er zu ist */
        return new Promise(function (res) {
          /* zweimal hintereinander frei (1,5 s Abstand), sonst landet sie mit einem
             gleichzeitig aufgehenden Dialog (Einladung) übereinander */
          var tries = 0, free = 0;
          (function wait() {
            free = !document.querySelector(".god") && !document.hidden ? free + 1 : 0;
            if (free >= 2) return res(true);
            if (++tries > 80) return res(false);
            setTimeout(wait, 1500);
          })();
        }).then(function (free) {
          if (!free) return;
          try { localStorage.setItem(key, "1"); } catch (eLs) { state[key] = 1; }
          return GoDialog.time(slot === "morgen" ? "Wann trainierst Du heute?" : "Wann trainierst Du morgen?", {
          /* Nur Ich / Nur Coach: Hinweis, dass andere die Uhrzeit erst mit Community sehen */
          sub: (ev.title || "Training") + (ev.visibility === "privat" || ev.visibility === "coach"
            ? " · Steht auf „" + (ev.visibility === "coach" ? "Nur Coach" : "Nur Ich") + "“. Stell es im Kalender → Stift → Tage bearbeiten auf Community, damit andere sehen, wann Du trainierst, und sich bei Dir melden können."
            : ""),
          ok: "Eintragen",
          cancel: "Später",
          initial: "18:00"
        }).then(function (t) {
          if (!t || t === "alt") return;
          var p = String(t).split(":");
          var hhmm = String(Number(p[0])).padStart(2, "0") + ":" + String(Number(p[1] || 0)).padStart(2, "0");
          var starts = iso + "T" + hhmm + ":00" + off;
          var d = new Date(starts);
          /* 12:00 UTC heißt „ohne Uhrzeit“: eine Sekunde dazu */
          if (!isNaN(d.getTime()) && d.getUTCHours() === 12 && d.getUTCMinutes() === 0) starts = iso + "T" + hhmm + ":01" + off;
          return rest("events?id=eq." + encodeURIComponent(ev.id), {
            method: "PATCH", prefer: "return=minimal", body: { starts_at: starts, time_set_at: new Date().toISOString() }
          }).then(function () {
            if (host.toast) host.toast((slot === "morgen" ? "Heute " : "Morgen ") + hhmm + " eingetragen");
            return refresh();
          }).catch(function () {
            if (host.toast) host.toast("Uhrzeit speichern ging nicht.");
          });
        });
        });
      })
      .catch(function () {})
      .then(function () { state.ttBusy = false; });
  }
  function bindTrainTimeAsk() {
    if (state.ttBound) return;
    state.ttBound = true;
    setTimeout(askTrainTime, 3500);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) setTimeout(askTrainTime, 1500);
    });
  }

  function install(h) {
    host = h || host || {};
    bindTrainTimeAsk();
    scheduleMidnight();
    if (global.GoTimer) {
      /* Eieruhr fertig → Erledigt-Dialog des Events; laufende Uhr nach App-Start wieder zeigen */
      GoTimer.init({
        onFinish: function (eventId) {
          if (!eventId) return;
          var go = function () { openDoneModal(eventId, { title: "Geschafft", placeholder: "Wie war es?" }); };
          if ((state.events || []).some(function (e) { return String(e.id) === String(eventId); })) go();
          else refresh().then(go, go);
        }
      });
      if (!state.timerResumed) { state.timerResumed = true; setTimeout(function () { GoTimer.resume(); }, 1200); }
    }
    saveFilter(loadFilter());
    var sel = $("heute-filter-select");
    if (sel) {
      if (host && host.syncHeuteFilterOptions) host.syncHeuteFilterOptions();
      else {
        sel.innerHTML =
          '<option value="ich">Nur ich</option>' +
          '<option value="team">Freunde</option>' +
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
    var commentForm = $("acc-comment-form");
    if (commentForm && commentForm.dataset.bound !== "1") {
      commentForm.dataset.bound = "1";
      commentForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var modal = $("acc-comment-modal");
        var postId = modal && modal.dataset.postId;
        var textEl = $("acc-comment-text");
        if (!postId || !textEl) return;
        addComment(postId, textEl.value, modal.dataset.replyTo ? { id: modal.dataset.replyTo, account: modal.dataset.replyAcc } : null);
      });
    }
    var commentCancel = $("acc-comment-cancel");
    if (commentCancel && commentCancel.dataset.bound !== "1") {
      commentCancel.dataset.bound = "1";
      commentCancel.addEventListener("click", closeCommentModal);
    }
    var commentModal = $("acc-comment-modal");
    if (commentModal && commentModal.dataset.bound !== "1") {
      commentModal.dataset.bound = "1";
      commentModal.addEventListener("click", function (e) {
        if (e.target === commentModal) closeCommentModal();
      });
    }
    var doneOk = $("acc-done-ok");
    if (doneOk) doneOk.addEventListener("click", function () { submitDone(false); });
    var doneNoPost = $("acc-done-nopost");
    if (doneNoPost) doneNoPost.addEventListener("click", function () { submitDone(true); });
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
    /* Sofort Plan-Karten zeigen — nicht auf langsames Netzwerk warten */
    if (me()) {
      try {
        render();
      } catch (ePaint) {}
    }
  }

  /* Für die Profilreihe: wer trainiert heute (Event heute, sichtbar für mich), wer hat heute ein Foto */
  function todayActivity() {
    var today = todayIso();
    var flags = viewFlags("alles");
    flags.todayAll = true;
    var out = {};
    (state.events || []).forEach(function (ev) {
      if (!ev || dayKey(ev.starts_at) !== today || ev.status === "ausgefallen") return;
      if (!eventVisibleToMe(ev, flags)) return;
      var uid = String(ev.user_id);
      var p = personOf(uid);
      var a = out[uid] || (out[uid] = { id: uid, name: p.name, photo: p.photo, training: true, done: false, photoEventId: "" });
      if (ev.status === "erledigt") a.done = true;
      if (ev.photo_url && !a.photoEventId) a.photoEventId = String(ev.id);
    });
    return out;
  }

  function focusEvent(id) {
    var card = document.querySelector('.acc-card[data-event-id="' + String(id).replace(/"/g, "") + '"]');
    if (!card) return false;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  /* Heutiges Event einer Person als Karte (für das Popup beim Tipp auf den pulsierenden Kreis) */
  function todayCardFor(personId, opts) {
    opts = opts || {};
    var t = todayIso();
    /* Flags mitgeben: ohne sie scheiterte die Prüfung bei Freunden (ging nur beim eigenen Kreis) */
    var flags = viewFlags("alles");
    flags.todayAll = true;
    var list = (state.events || []).filter(function (e) {
      return String(e.user_id) === String(personId) && e.status !== "ausgefallen" &&
        evDayIso(e) === t && eventVisibleToMe(e, flags);
    }).sort(function (a, b) { return String(a.starts_at).localeCompare(String(b.starts_at)); });
    var pick = list.filter(function (e) { return opts.done ? e.status === "erledigt" : e.status !== "erledigt"; });
    var ev = pick[0] || list[0];
    if (!ev) return null;
    try { return { id: ev.id, html: renderEventCard(ev) }; } catch (e) { return null; }
  }

  /* Heutige Events einer Person (sichtbar für mich), für die Story beim Tipp auf den Kreis */
  function todayEventsFor(personId) {
    var t = todayIso();
    var flags = viewFlags("alles");
    flags.todayAll = true;
    return (state.events || []).filter(function (e) {
      return e && String(e.user_id) === String(personId) && e.status !== "ausgefallen" &&
        evDayIso(e) === t && eventVisibleToMe(e, flags);
    }).sort(function (a, b) { return String(a.starts_at).localeCompare(String(b.starts_at)); });
  }

  /* Story einer Person: erst Erledigtes der letzten 24 Stunden, dann heute Anstehendes, chronologisch.
     Sichtbarkeit wie im Feed (privat, Community, Gruppe, Bubble); gelöschte oder ohne Posting gespeicherte fehlen. */
  function storyEventsFor(personId) {
    var t = todayIso();
    var y = new Date(t + "T12:00:00");
    y.setDate(y.getDate() - 1);
    var from = y.toLocaleDateString("en-CA");
    var flags = viewFlags("alles");
    flags.todayAll = true;
    flags.storyFrom = from;
    var list = (state.events || []).filter(function (e) {
      if (!e || String(e.user_id) !== String(personId) || e.status === "ausgefallen") return false;
      var d = evDayIso(e);
      /* Erledigtes bleibt 24 Stunden Story (wie Instagram) */
      if (e.status === "erledigt") return d >= from && d <= t && new Date(e.starts_at).getTime() >= Date.now() - 86400000 && eventVisibleToMe(e, flags);
      return d === t && eventVisibleToMe(e, flags);
    });
    function by(a, b) { return String(a.starts_at).localeCompare(String(b.starts_at)); }
    return list.filter(function (e) { return e.status === "erledigt"; }).sort(by)
      .concat(list.filter(function (e) { return e.status !== "erledigt"; }).sort(by));
  }

  global.HeuteAccountability = {
    install: install,
    refresh: refresh,
    openDone: openDoneModal,
    scrollCurrentToCenter: scrollCurrentToCenter,
    resetAktuellPaint: resetAktuellPaint,
    setFilter: function (v) {
      saveFilter(v);
      return refresh();
    },
    afterKindChosen: afterKindChosen,
    createUnplanned: createUnplannedEvent,
    todayActivity: todayActivity,
    focusEvent: focusEvent,
    todayCardFor: todayCardFor,
    todayEventsFor: todayEventsFor,
    storyEventsFor: storyEventsFor,
    /* Herz neu prüfen (z. B. nach Bestätigen einer Anfrage) */
    refreshHeart: function () { state.repliesAt = 0; return checkReplies(); }
  };
  /* Wallet: Tipp auf eine zusammengeschobene Karte schiebt sie frei (andere bleiben zu);
     Tipp aufs Bild einer offenen Karte schiebt sie zurück. Werkzeuge unter der offenen Karte bleiben bedienbar. */
  document.addEventListener("click", function (e) {
    var card = e.target && e.target.closest ? e.target.closest(".acc-card.is-wallet") : null;
    if (!card) return;
    var open = card.classList.contains("is-open");
    if (open && !e.target.closest(".acc-card__media")) return;
    if (open && e.target.closest("button, a, input, label")) return;
    e.preventDefault();
    e.stopPropagation();
    [].forEach.call(document.querySelectorAll(".acc-card.is-wallet.is-open"), function (c) { c.classList.remove("is-open"); });
    if (open) { state.walletOpen = ""; return; }
    card.classList.add("is-open");
    state.walletOpen = card.getAttribute("data-post-id") || "";
    setTimeout(function () {
      try { card.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e2) { card.scrollIntoView(); }
    }, 60);
  }, true);

  /* „mehr“ / „weniger“ an Kommentaren (Feed und Kommentar-Dialog) */
  document.addEventListener("click", function (e) {
    var m = e.target && e.target.closest ? e.target.closest("[data-cmt-more]") : null;
    if (!m) return;
    e.preventDefault();
    e.stopPropagation();
    var box = m.closest(".acc-clamp");
    if (!box) return;
    var open = box.classList.toggle("is-open");
    m.textContent = open ? "weniger" : "mehr";
    /* Zustand merken: Aktuell malt beim Nachladen neu */
    var pid = box.querySelector("[data-open-comments]");
    if (pid) {
      state.cmtOpen = state.cmtOpen || {};
      if (open) state.cmtOpen[pid.getAttribute("data-open-comments")] = true;
      else delete state.cmtOpen[pid.getAttribute("data-open-comments")];
    }
  }, true);

})(window);
