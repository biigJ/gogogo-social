/* Heute Accountability (Schritt 3): Ich ⊂ Team ⊂ Tagebuch ⊂ Alles */
(function (global) {
  var host = null;
  var state = {
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
  var VIEW_LEVEL = { ich: 0, team: 1, gruppe: 1, tagebuch: 2, alles: 3 };

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

  function ownerShares(uid) {
    uid = String(uid || "");
    if (!uid || uid === me()) return true;
    var s = state.share && state.share[uid];
    if (!s) return false;
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
    return rest(
      "events?select=id,user_id,course_id,enrollment_id,category,starts_at,location,visibility,is_unplanned,status,title,item_type,photo_url,note,assigned_by,course_session_id&starts_at=gte." +
        encodeURIComponent(fromIso) +
        "&starts_at=lte." +
        encodeURIComponent(toIso) +
        "&order=starts_at.desc&limit=500"
    )
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

  function loadFfcPosts() {
    state.ffcPosts = [];
    if (!global.FFC || !FFC.user || !FFC.user()) return Promise.resolve();
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

  function loadRsvps(eventIds) {
    state.rsvps = {};
    state.rsvpPartner = {};
    if (!eventIds.length) return Promise.resolve();
    var base =
      "event_rsvps?event_id=in.(" +
      eventIds.map(encodeURIComponent).join(",") +
      ")&status=eq.zugesagt&select=event_id,user_id";
    return rest(base + ",partner_id,partner_name")
      .catch(function () {
        return rest(base);
      })
      .then(function (rows) {
        var partnerIds = [];
        (rows || []).forEach(function (r) {
          var eid = String(r.event_id);
          if (!state.rsvps[eid]) state.rsvps[eid] = [];
          state.rsvps[eid].push(String(r.user_id));
          if (r.partner_id || r.partner_name) {
            if (!state.rsvpPartner[eid]) state.rsvpPartner[eid] = {};
            state.rsvpPartner[eid][String(r.user_id)] = {
              id: r.partner_id ? String(r.partner_id) : "",
              name: r.partner_name || ""
            };
            if (r.partner_id) partnerIds.push(String(r.partner_id));
          }
        });
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
      created_at: c.created_at
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
    return rest(
      "event_comments?event_id=in.(" +
        eventIds.map(encodeURIComponent).join(",") +
        ")&select=id,event_id,account_id,text,created_at&order=created_at.asc&limit=500"
    )
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
    var inv = !mine ? inviteFor(ev.id) : null;
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
      if (t < now - 3600000 || t > week) return false;
      if (mine) return true;
      if (flags.showRsvpdUpcoming && iAmGoing(ev.id)) {
        return inGroupFilter(ev.user_id, flags);
      }
      if (!flags.showOthersUpcoming) return false;
      if (!ownerShares(ev.user_id)) return false;
      if (!inTeamFilter(ev.user_id, flags)) return false;
      if (!(vis === "team" || vis === "gruppe")) return false;
      return inGroupFilter(ev.user_id, flags);
    }
    if (ev.status === "erledigt") {
      if (mine) return !!flags.showOwnHistory;
      if (!flags.showFriendsHistory || !(vis === "team" || vis === "gruppe")) return false;
      if (!ownerShares(ev.user_id) && !iAmGoing(ev.id)) return false;
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

  function faceSlotHtml(person, pending) {
    var label = (person && person.name) || "?";
    var cls = "acc-face-slot" + (pending ? " is-pending" : "");
    return (
      '<span class="' +
      cls +
      '" title="' +
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
    /* Nach Erledigt: keine Invite-/RSVP-Gesichter mehr */
    if (eventId) {
      var doneEv = (state.events || []).filter(function (e) {
        return String(e.id) === String(eventId);
      })[0];
      if (doneEv && doneEv.status === "erledigt") return out;
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
      return out;
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
        pushFace(
          f.id,
          f.name || f.nickname,
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
          String(g.status || "") === "pending"
        );
      })
      .join("");
    var add = "";
    if (canInvite === "plus") {
      add =
        '<button type="button" class="acc-card__plus-label" data-shell-plus="1" aria-label="Plus">Plus</button>';
    } else if (canInvite !== false && canInviteOnDay(inviteIso)) {
      add =
        '<button type="button" class="acc-face acc-face--add" data-invite-post="' +
        esc(postId || "") +
        '" data-invite-iso="' +
        esc(inviteIso || "") +
        '" aria-label="Einladen"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>';
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
    var mine = myCommentText(postId);
    var canInvite = opts.canInvite !== false;
    /* Kommentar nur über Dialog (Sprechblase); teaser nur mit Text */
    var teaserBlock = mine
      ? '<div class="acc-card__teaser">' +
        '<button type="button" class="acc-card__my-line" data-open-comments="' +
        esc(postId) +
        '">' +
        esc(mine) +
        "</button></div>"
      : '<div class="acc-card__teaser is-empty" hidden></div>';
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

  /* Sportler-Icon nur einmal: am ersten eigenen Event ab heute abwärts */
  function placeSpontan(html) {
    var from = html.indexOf('data-acc-zone="today"');
    if (from < 0) from = 0;
    var at = html.indexOf("<!--spontan-->", from);
    if (at < 0) return html;
    return html.slice(0, at) + SPONTAN_BTN + html.slice(at + "<!--spontan-->".length);
  }

  function eventToolRowHtml(opts) {
    opts = opts || {};
    var eventId = opts.eventId || "";
    var postId = opts.postId || eventId;
    var done = !!opts.canDone;
    var isDone = !!opts.isDone;
    var check = opts.noCheck ? "" :
      '<button type="button" class="acc-tool acc-tool--check' +
      (isDone ? " is-done" : "") +
      '"' +
      (done ? ' data-done="' + esc(eventId) + '"' : isDone ? " disabled" : "") +
      ' aria-label="Erledigt">' +
      checkSvg(isDone) +
      "</button>";
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
    var badgeKind = opts.badge || "";
    var badge = badgeKind
      ? '<button type="button" class="acc-tool-badge" data-badge-info="' + esc(badgeKind) + '" aria-label="' +
        esc(BADGE_INFO[badgeKind] || "") + '">' + badgeSvg(badgeKind) + "</button>"
      : "";
    return (
      '<div class="acc-card__tools">' +
      '<div class="acc-card__tools-left">' +
      check +
      (check && !opts.noCheck ? "<!--spontan-->" : "") +
      bubble +
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
      (opts.photo || coverFor(opts) ? " has-photo" : "") +
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
      esc(String(person.name || "?").split(" ")[0]) +
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
    if (upcoming && !mine && invite) {
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
          badge: eventBadgeKind(ev),
          removeId: "",
          removeMode: "delete"
        })
      : /* Fremde Events: nur Kommentieren (Einladung hat eigene Zeile) */
        eventToolRowHtml({
          eventId: ev.id,
          postId: String(ev.id),
          noCheck: true,
          badge: invite ? "" : eventBadgeKind(ev)
        });
    return renderCardShell({
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
      author: authorHtml(p, true),
      when: whenLine(ev.starts_at),
      title: title,
      place: ev.location || "",
      desc:
        descHtml(parseZirkelNote(ev.note) ? zirkelLabel(parseZirkelNote(ev.note)) : ev.note) +
        zirkelPairsHtml(ev) +
        onlineCtaHtml(ev),
      postId: String(ev.id),
      eventId: String(ev.id),
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
    return renderCardShell({
      extraClass: "acc-card--ffc-post",
      attrs:
        ' data-post-id="' +
        esc(postId) +
        '" data-ffc-post="' +
        esc(post.id) +
        '"',
      category: "zirkel",
      photo: post.url || "",
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
  function buildFeedItems(flags) {
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

    (state.ffcPosts || []).forEach(function (post) {
      if (!post || !post.created_at) return;
      if (flags.groupOnly && !post.is_me) return;
      var item = {
        kind: "ffc_post",
        starts_at: post.created_at,
        _mine: !!post.is_me,
        post: post
      };
      if (item._mine && dayKey(post.created_at) === today) myToday.push(item);
      else if (dayKey(post.created_at) === today || new Date(post.created_at).getTime() >= Date.now() - 86400000) {
        upcoming.push(item);
      } else {
        history.push(item);
      }
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

    if (flags.diaryOnly) {
      /* Tagebuch: heute ja, Zukunft nein */
      upcoming = upcoming.filter(function (it) {
        return dayKey(it.starts_at) <= today;
      });
    }
    if (flags.teamOnly) {
      history = history.filter(function (it) {
        return it._mine || inTeamFilter((it.ev && it.ev.user_id) || (it.item && it.item.user_id) || "", flags);
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
    if (item.kind === "ffc_post") return renderFfcPostCard(item.post);
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
      when: whenLine(item.starts_at) + " · privat",
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
    if (host.onTodayActivity) host.onTodayActivity();

    var feed = buildFeedItems(flags);
    root.hidden = false;
    var html = "";
    /* Oben = Zukunft: weiter weg oben, nah an heute unten (umgekehrt zur Zeit) */
    html += '<div class="acc-feed-future" data-acc-zone="future">';
    for (var ui = feed.upcoming.length - 1; ui >= 0; ui--) {
      html += renderFeedItem(feed.upcoming[ui]);
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

    var firstPaint = !state.paintedAktuell;
    var scroller = welcomeScrollEl();
    /* Boot: auf Heute zentrieren — sonst bleibt man auf Zukunft (z. B. 25.11.) */
    var keepScroll =
      !firstPaint && !state.bootNeedsCenter ? scroller.scrollTop || 0 : null;
    /* Feed sichtbar lassen — kein opacity-Flash bei Refresh */
    root.classList.remove("is-centering");
    patchFeed(root, placeSpontan(html));
    state.paintedAktuell = true;
    bindObserver(root);
    bindHeuteScrollFilter();
    requestAnimationFrame(function () {
      if (keepScroll != null) {
        scroller.scrollTop = keepScroll;
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

  function currentEventCard() {
    var today = $("acc-feed-today");
    if (!today) return null;
    var cards = today.querySelectorAll(".acc-card:not(.acc-card--spontan)");
    if (cards && cards.length) return cards[0];
    return today.querySelector(".acc-card") || today;
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
      var headerH = row ? row.getBoundingClientRect().height || 0 : 0;
      var mid = headerH + (window.innerHeight - headerH) / 2;
      var elMid = rect.top + rect.height / 2;
      var delta = elMid - mid;
      if (Math.abs(delta) < 4) return;
      var next = Math.max(0, (scroller.scrollTop || 0) + delta);
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
    scroller.addEventListener(
      "scroll",
      function () {
        if (document.body.dataset.shell !== "heute") return;
        var y = scroller.scrollTop || 0;
        if (Math.abs(y - last) > 8) state.userScrolledAktuell = true;
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
    }).then(compressDonePhoto);
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

  function submitDone() {
    var modal = $("acc-done-modal");
    if (!modal) return;
    var eventId = modal.dataset.eventId;
    if (!eventId) return;
    var vis = normalizeVisibility(modal.dataset.vis || "team");
    if (vis === "gruppe") vis = "team";
    var note = (($("acc-done-note") && $("acc-done-note").value) || "").trim().slice(0, 500);
    readDonePhoto()
      .then(function (photo) {
        var body = {
          status: "erledigt",
          visibility: vis
        };
        if (note) body.note = note;
        if (photo) body.photo_url = photo;
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
  function removeEvent(eventId, mode) {
    if (!eventId) return;
    var cancel = mode === "cancel";
    if (mode === "skip") {
      var skipDay = String(eventId).replace(/^plan:/, "");
      if (!global.confirm("Training an diesem Tag aus dem Wochenplan nehmen?")) return;
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
      return;
    }
    var ok = global.confirm(cancel ? "Teilnahme absagen?" : "Event löschen? Das lässt sich nicht rückgängig machen.");
    if (!ok) return;
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
    }
    document.body.classList.remove("is-comment-open");
    var input = $("acc-comment-text");
    if (input) input.value = "";
  }

  function paintCommentModalList(postId) {
    var listEl = $("acc-comment-list");
    if (!listEl) return;
    var list = state.comments[postId] || [];
    listEl.innerHTML = list.length
      ? list.map(commentLineHtml).join("")
      : '<p class="acc-comment-modal__empty">Noch keine Kommentare.</p>';
  }

  function openComments(postId) {
    if (!postId) return;
    var modal = $("acc-comment-modal");
    if (!modal) return;
    modal.dataset.postId = postId;
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
      /* Kein events-UUID — permanent über Community-Post-Marker */
      save = saveEventCommentFallback(postId, temp.text);
    } else {
      save = rest("event_comments", {
        method: "POST",
        prefer: "return=representation",
        body: {
          event_id: postId,
          account_id: me(),
          text: temp.text
        }
      }).catch(function () {
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
                created_at: saved.created_at || temp.created_at
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

  /* Einzeleinheiten = aktive Kurse mit genau einer Einheit (wie im Kurs-Editor) */
  function loadSingleUnits(kind) {
    return rest(
      "courses?is_active=eq.true&private_for=is.null&category_default=eq." + encodeURIComponent(kind) +
        "&select=id,title,slug,sessions_per_week,course_sessions!course_sessions_course_id_fkey(id)&order=title.asc"
    ).then(function (rows) {
      return (rows || []).filter(function (c) {
        var n = (c.course_sessions || []).length;
        return n === 1 && (c.sessions_per_week || 1) <= 1 &&
          ["eigenes-training", "12-wochen-routine"].indexOf(String(c.slug || "")) === -1;
      });
    }).catch(function () { return []; });
  }

  function createUnplannedEvent(payload) {
    var body = {
      user_id: me(),
      category: payload.category,
      course_id: payload.course_id || null,
      enrollment_id: payload.enrollment_id || null,
      starts_at: new Date().toISOString(),
      location: payload.location || null,
      note: payload.note || null,
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
        /* Sonstiges: gleich abschließen, mit Foto und Notiz */
        createUnplannedEvent({ category: "alternative", title: "Sonstiges", visibility: vis }).then(function (ev) {
          modal.hidden = true;
          if (host.closeGoPick) host.closeGoPick();
          return refresh().then(function () { if (ev && ev.id) openDoneModal(ev.id); });
        });
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
        GoZirkelSetup.html(
          { mode: "single" },
          {
            friends: (host.teamPeople || []).filter(function (p) {
              return p && p.id && String(p.id) !== String(me());
            })
          }
        ) +
        '<label class="gz-online"><input type="checkbox" id="acc-z-online" /> Optional: online mitmachen</label>';
      GoZirkelSetup.bind(pick);
      var go = document.createElement("button");
      go.type = "button";
      go.textContent = "Jetzt starten";
      go.addEventListener("click", function () {
        var z = GoZirkelSetup.read(pick);
        z.online = !!(($("acc-z-online") || {}).checked);
        var vis = readCreateVis(pick);
        loadZirkelCourse().then(function (cid) {
          if (!cid) {
            if (host.toast) host.toast("Kurs Zirkeltraining fehlt (go-trainings-to-courses.sql)");
            return;
          }
          return finishCreate({
            category: "zirkel",
            course_id: cid,
            title: "Zirkeltraining",
            note: GoZirkelSetup.toNote(z),
            visibility: vis
          }).then(function () {
            if (host.openZirkel) host.openZirkel(z);
          });
        });
      });
      pick.appendChild(go);
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
        if (!units.length) {
          pick.insertAdjacentHTML("beforeend", "<p>Noch keine Einzeleinheiten für diese Kategorie.</p>");
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
    /* Kraft-/Ausdauer-Event antippen: vergangen → gespeicherte Übungen, heute/später → Workout tracken.
       Eingeladene/Teilnehmer tracken die Einheit des Erstellers unter ihrem eigenen Profil. */
    var mediaHit = t.closest(".acc-card__media");
    if (mediaHit && !t.closest("button, a, input")) {
      var cardW = mediaHit.closest(".acc-card[data-event-id]");
      var evA = cardW ? (state.events || []).filter(function (x) { return String(x.id) === cardW.getAttribute("data-event-id"); })[0] : null;
      if (evA && (evA.category === "kraft" || evA.category === "ausdauer")) {
        var evIso = new Date(evA.starts_at).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
        var mine = String(evA.user_id) === me();
        var joined = !mine && (iAmGoing(evA.id) || !!inviteFor(evA.id));
        if (evIso < todayIso() && global.GoKraftTracking) {
          var names = {};
          var authorEl = cardW.querySelector(".acc-card__author span");
          if (authorEl) names[String(evA.user_id)] = authorEl.textContent;
          GoKraftTracking.openDay({
            people: mine ? [me()] : [String(evA.user_id)].concat(joined ? [me()] : []),
            names: names,
            iso: evIso,
            title: ((cardW.querySelector(".acc-card__title") || {}).textContent || evA.title || "").trim()
          });
          return;
        }
        if ((mine || joined) && evA.course_id && host.openEventWorkout) {
          host.openEventWorkout(evA);
          return;
        }
      }
      /* Tagesplan-Karte (Wochenplan ohne Event) → gleichnamige Einheit bzw. Historie */
      var planCard = mediaHit.closest(".acc-card[data-plan-iso]");
      if (planCard && host.openEventWorkout) {
        var pIso = planCard.getAttribute("data-plan-iso");
        var pCat = mediaHit.classList.contains("tone-ausdauer") ? "ausdauer"
          : mediaHit.classList.contains("tone-kraft-basics") ? "kraft" : "";
        var pTitle = ((planCard.querySelector(".acc-card__title") || {}).textContent || "").trim();
        if (pCat && pTitle && pIso && pIso < todayIso() && global.GoKraftTracking) {
          GoKraftTracking.openDay({ people: [me()], iso: pIso, title: pTitle });
          return;
        }
        if (pCat && pTitle && pIso) {
          host.openEventWorkout({ title: pTitle, category: pCat, starts_at: pIso + "T12:00:00+01:00" });
          return;
        }
      }
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

  function install(h) {
    host = h || host || {};
    scheduleMidnight();
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
    var commentForm = $("acc-comment-form");
    if (commentForm && commentForm.dataset.bound !== "1") {
      commentForm.dataset.bound = "1";
      commentForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var modal = $("acc-comment-modal");
        var postId = modal && modal.dataset.postId;
        var textEl = $("acc-comment-text");
        if (!postId || !textEl) return;
        addComment(postId, textEl.value);
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

  global.HeuteAccountability = {
    install: install,
    refresh: refresh,
    openDone: openDoneModal,
    scrollCurrentToCenter: scrollCurrentToCenter,
    resetAktuellPaint: resetAktuellPaint,
    setFilter: function (v) {
      saveFilter(v);
      refresh();
    },
    afterKindChosen: afterKindChosen,
    createUnplanned: createUnplannedEvent,
    todayActivity: todayActivity,
    focusEvent: focusEvent
  };
})(window);
