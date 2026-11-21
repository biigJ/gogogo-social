/* admin-inbox.js — Admin in der App (nur Joscha / Ben)
 *
 *   GoAdmin.open(host, tab)   → Vollbild mit Burger-Menü: Nachrichten, Erinnerungen, Nutzer (Infobox per Profilbild,
 *                               Ziele ergänzen, „Anfrage Coach“ bestätigen/ablehnen, Löschen), Videos, Editor (/workout/kurse/)
 *   GoAdmin.unread(host)      → Promise<Anzahl neuer Nachrichten seit dem letzten Öffnen>
 *
 * host: rest(path, opts), sessionAccount, toast(msg)
 * Daten über RPCs aus go-admin.sql (security definer, prüfen go_is_admin()).
 * Optik: Coach-Portal-Klassen (.cp-*) aus index.html.
 */
(function (global) {
  "use strict";

  var host = null;
  var st = null;

  var TYPE_TITLE = {
    ernaehrung: "Ernährung",
    stempelkarte: "Stempelkarte",
    web_call: "Initialgespräch",
    routine: "12-Wochen-Routine",
    zirkel: "Friday Fitness Circle",
    kraft_tracking: "Kraft-Tracking",
    personal_training: "Personal Training",
    merch: "Merch"
  };

  var CSS =
    ".ga-h3{margin:18px 0 4px;font:700 13px/1.3 Inter,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:rgba(42,33,24,.6)}" +
    ".ga-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(42,33,24,.1)}" +
    ".ga-face{width:42px;height:42px;flex:none;border-radius:50%;object-fit:cover;background:#E6DED0;display:grid;place-items:center;font-weight:700}" +
    ".ga-copy{flex:1;min-width:0}" +
    ".ga-copy b{font-weight:700}" +
    ".ga-copy p{margin:0;font-size:15px;line-height:1.35}" +
    ".ga-when{display:block;font-size:12px;color:rgba(42,33,24,.6)}" +
    ".ga-item.is-new .ga-copy p::before{content:'';display:inline-block;width:8px;height:8px;margin:0 6px 1px 0;border-radius:50%;background:#111}" +
    ".ga-act{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1.5px solid #111;background:transparent;color:#111;font:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
    ".ga-act.is-on{background:#111;color:#fff}" +
    ".ga-nick{font-weight:500;color:rgba(42,33,24,.6)}" +
    ".ga-vc{display:inline-grid;place-items:center;width:14px;height:14px;margin-left:3px;vertical-align:super;border-radius:50%;background:#1D9BF0;color:#fff;font:700 9px/1 Inter,system-ui,sans-serif}" +
    ".ga-del{margin-left:6px;color:#C7413B;border-color:#C7413B}" +
    ".ga-wa{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:0;background:#128C7E;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-grid;place-items:center}" +
    ".ga-item.is-sent{opacity:.5}" +
    ".ga-msg{display:block;font-size:13px;color:rgba(42,33,24,.75);margin-top:2px}" +
    ".ga-bar{display:grid;grid-template-columns:31px 1fr 31px;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 16px 8px;position:relative}" +
    ".ga-bar h2{margin:0;text-align:center;font:600 22px/1.2 'Playfair Display',Georgia,serif}" +
    ".ga-round{width:31px;height:31px;padding:0;border:1px solid #2A2118;border-radius:50%;display:grid;place-items:center;background:transparent;color:#2A2118;cursor:pointer}" +
    ".ga-round.ga-burger{border:0;border-radius:0}" +
    ".ga-burger span{display:block;width:30px;height:2.5px;background:currentColor;border-radius:2px;box-shadow:0 -11px 0 currentColor,0 11px 0 currentColor}" +
    ".ga-menu{position:absolute;left:0;right:0;top:100%;z-index:3;background:#F3EEE4;padding:0 20px 10px;box-shadow:0 14px 24px rgba(42,33,24,.12)}" +
    ".ga-menu[hidden]{display:none}" +
    ".ga-menu button{display:block;width:100%;padding:14px 2px;border:0;border-bottom:1px solid rgba(42,33,24,.2);border-radius:0;background:transparent;color:#2A2118;font:500 16px/1.35 Inter,system-ui,sans-serif;text-align:left;cursor:pointer}" +
    ".ga-menu button.is-on{font-weight:700}" +
    ".ga-new{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#C7413B;color:#fff;font-size:11px;font-weight:700;vertical-align:2px}" +
    ".ga-req{display:inline-block;margin-top:3px;padding:2px 8px;border-radius:999px;border:1px solid #2A2118;font-size:12px;font-weight:600}" +
    ".ga-goal{display:block;margin-top:2px;font-size:13px;color:rgba(42,33,24,.75);text-decoration:underline;background:none;border:0;padding:0;font-family:inherit;cursor:pointer;text-align:left}" +
    ".ga-acts{display:flex;flex-direction:column;gap:6px;align-items:flex-end}" +
    ".ga-acts .ga-del{margin-left:0}" +
    ".ga-facebtn{flex:none;padding:0;border:0;background:none;border-radius:50%;cursor:pointer}" +
    ".ga-info{position:fixed;inset:0;z-index:10040;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,16,12,.42)}" +
    ".ga-info__card{width:min(100%,420px);max-height:88vh;overflow-y:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px;padding:20px 18px 14px;font-family:Inter,system-ui,sans-serif}" +
    ".ga-info__top{display:flex;align-items:center;gap:14px;margin-bottom:12px}" +
    ".ga-info__face{width:72px;height:72px;flex:none;border-radius:50%;object-fit:cover;background:#E6DED0;display:grid;place-items:center;font:700 28px/1 Inter,system-ui,sans-serif}" +
    ".ga-info .ga-info__name{margin:0;font:600 24px/1.15 'Playfair Display',Georgia,serif !important}" +
    ".ga-info .ga-info__nick{display:block;font:500 14px/1.3 Inter,system-ui,sans-serif !important;color:rgba(42,33,24,.65);margin-top:2px}" +
    ".ga-irow{display:grid;grid-template-columns:104px 1fr;gap:10px;padding:8px 0;border-top:1px solid rgba(42,33,24,.12);font-size:14px;line-height:1.4}" +
    ".ga-irow span{color:rgba(42,33,24,.6)}" +
    ".ga-irow b{font-weight:500;white-space:pre-wrap;overflow-wrap:anywhere}" +
    ".ga-irow a{color:inherit}" +
    ".ga-info__btns{display:grid;gap:8px;margin-top:14px}" +
    ".ga-info__btns button{min-height:46px;border-radius:999px;border:1.5px solid #111;background:transparent;color:#111;font:inherit;font-size:15px;font-weight:700;cursor:pointer}" +
    ".ga-info__btns button.is-dark{background:#111;color:#fff}" +
    ".ga-info__btns button.is-quiet{border:0;color:rgba(42,33,24,.7);font-weight:600}" +
    "@media (min-width:900px){.cp .cp-body{max-width:760px;margin:0 auto;width:100%;box-sizing:border-box}}";

  function ensureCss() {
    if (document.getElementById("ga-css")) return;
    var s = document.createElement("style");
    s.id = "ga-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function me() {
    return host && host.sessionAccount ? String(host.sessionAccount.id) : "";
  }

  function seenKey() {
    return "gogogo_admin_seen_" + me();
  }

  function lastSeen() {
    try {
      return localStorage.getItem(seenKey()) || "";
    } catch (e) {
      return "";
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(seenKey(), new Date().toISOString());
    } catch (e) {}
  }

  function load() {
    var fb = host.rest("go_feedback?select=id,account_id,name,text,created_at&order=created_at.desc&limit=50")
      .catch(function () { return []; });
    return Promise.all([host.rest("rpc/go_admin_inbox", { method: "POST", body: { p_limit: 80 } }), fb])
      .then(function (r) {
        var data = r[0] || {};
        data.feedback = r[1] || [];
        return data;
      });
  }

  function items(data) {
    var list = [];
    ((data && data.accounts) || []).forEach(function (a) {
      list.push({ kind: "account", at: a.at, a: a });
    });
    ((data && data.bookings) || []).forEach(function (b) {
      list.push({ kind: b.type === "coach_offer" ? "coach" : "booking", at: b.at, a: b });
    });
    ((data && data.feedback) || []).forEach(function (f) {
      list.push({ kind: "feedback", at: f.created_at, a: { name: f.name, account_id: f.account_id, text: f.text } });
    });
    list.sort(function (x, y) { return String(y.at).localeCompare(String(x.at)); });
    return list;
  }

  function unread(h) {
    host = h || host;
    if (!host) return Promise.resolve(0);
    var since = lastSeen();
    /* offene Meldungen zählen immer mit, bis sie erledigt sind */
    var rep = host.rest("rpc/go_admin_reports", { method: "POST", body: {} }).then(function (r) { return (r || []).length; }).catch(function () { return 0; });
    return Promise.all([load().then(function (data) {
      if (!since) return 0; /* erstes Öffnen: alles gilt als gelesen, sonst 100+ Altlasten */
      return items(data).filter(function (it) { return String(it.at) > since; }).length;
    }).catch(function () { return 0; }), rep]).then(function (n) { return n[0] + n[1]; });
  }

  function when(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }) +
      " · " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  }

  function face(a) {
    if (a.photo_url) return '<img class="ga-face" src="' + esc(a.photo_url) + '" alt="" />';
    return '<span class="ga-face">' + esc(String(a.name || "?").slice(0, 1)) + "</span>";
  }

  function trainerOf(id) {
    var acc = (st.accounts || []).filter(function (a) { return String(a.account_id) === String(id); })[0];
    return !!(acc && acc.is_trainer);
  }

  /* Coach-Rolle vergeben nur nach eigener Anfrage („möchte Coach werden“); bestehende Coaches können entzogen werden */
  function coachRequested(id) {
    return ((st.data && st.data.bookings) || []).some(function (b) {
      return b && b.type === "coach_offer" && String(b.account_id) === String(id);
    });
  }
  /* Coach-Stufen (go-coach-self.sql): selbst angemeldet → Admin gibt blaues c (verifiziert, Coachees möglich) */
  function coachInfo(id) { return (st.coachInfo && st.coachInfo[String(id)]) || {}; }
  function loadCoachInfo() {
    st.coachInfo = {};
    var ids = (st.accounts || []).map(function (a) { return a.account_id; }).filter(Boolean);
    if (!ids.length) return;
    var base = "go_accounts?id=in.(" + ids.join(",") + ")&select=";
    host.rest(base + "id,nickname,coach_self_at,coach_verified_at")
      .catch(function () { return host.rest(base + "id,nickname"); })
      .then(function (rows) {
        if (!st) return;
        (rows || []).forEach(function (r) { st.coachInfo[String(r.id)] = r; });
        if (st.tab === "coaches" || st.tab === "news") paint();
      })
      .catch(function () {});
  }
  function coachBtn(id) {
    var on = trainerOf(id);
    var ci = coachInfo(id);
    if (ci.coach_verified_at) return '<button type="button" class="ga-act is-on" data-ga-vc="' + esc(id) + '" data-on="1">Coach <span class="ga-vc">c</span></button>';
    if (on || ci.coach_self_at) return '<button type="button" class="ga-act' + (on ? " is-on" : "") + '" data-ga-vc="' + esc(id) + '">Coach' + (on ? " ✓" : "") + "</button>";
    if (!coachRequested(id)) return "";
    return '<button type="button" class="ga-act" data-ga-req="' + esc(id) + '">Anfrage Coach</button>';
  }

  /* Gemeldete Bubble-Nachrichten (go-bubble-chat.sql): Nachricht, Person, Sperren */
  function loadReports() {
    st.reports = "loading";
    return host.rest("rpc/go_admin_reports", { method: "POST", body: {} })
      .then(function (rows) { if (st) { st.reports = rows || []; paint(); } })
      .catch(function () { if (st) { st.reports = []; paint(); } });
  }
  function paintReports() {
    if (!st.reports) { loadReports(); return ""; }
    if (st.reports === "loading" || !st.reports.length) return "";
    return '<h3 class="ga-h3">Gemeldet</h3>' + st.reports.map(function (r) {
      var a = { name: r.author_name, photo_url: r.author_photo };
      var media = r.media_url
        ? (/\.(mp4|mov|webm)(\?|$)/i.test(r.media_url)
            ? '<video src="' + esc(r.media_url) + '" controls playsinline preload="metadata" style="display:block;width:100%;max-height:220px;margin-top:6px;border-radius:10px"></video>'
            : '<img src="' + esc(r.media_url) + '" alt="" style="display:block;max-width:100%;max-height:220px;margin-top:6px;border-radius:10px" />')
        : "";
      return '<div class="ga-item" style="align-items:flex-start">' + face(a) +
        '<div class="ga-copy"><p><b>' + esc(r.author_name || "?") + "</b>" + (r.author_blocked_at ? ' <span class="ga-new">gesperrt</span>' : "") + "</p>" +
        (r.body ? '<span class="ga-msg" style="white-space:pre-wrap">„' + esc(r.body) + '“</span>' : "") + media +
        '<span class="ga-when">Gemeldet von ' + esc(r.reporter_name || "?") + " · " + esc(when(r.created_at)) +
        " · dabei seit " + esc(when(r.author_since)) + " · " + esc(String(r.author_messages || 0)) + " Nachrichten · " +
        esc(String(r.author_reports || 0)) + " Meldungen</span></div>" +
        '<div class="ga-acts">' +
        (r.author_blocked_at ? "" : '<button type="button" class="ga-act ga-del" data-ga-block="' + esc(r.author_id) + '" data-ga-name="' + esc(r.author_name || "") + '">Sperren</button>') +
        '<button type="button" class="ga-act" data-ga-rdone="' + esc(r.id) + '">Erledigt</button></div></div>';
    }).join("");
  }
  function blockUser(id, name) {
    if (!global.GoDialog) return;
    GoDialog.confirm((name || "Diese Person") + " sperren? Alle Bubble-Nachrichten werden ausgeblendet, schreiben geht nicht mehr.", { ok: "Sperren", cancel: "Abbrechen" })
      .then(function (yes) {
        if (!yes) return;
        host.rest("rpc/go_admin_block_user", { method: "POST", body: { p_id: id, p_block: true } })
          .then(function () { if (host.toast) host.toast("Gesperrt"); return loadReports(); })
          .catch(function () { if (host.toast) host.toast("Sperren ging nicht"); });
      });
  }
  function paintNews() {
    var since = st.seenBefore;
    var list = items(st.data);
    var compose = paintReports() + '<button type="button" class="cp-btn cp-btn--ghost" data-ga-broadcast="1" style="margin:0 0 10px">Mitteilung an alle Nutzer</button>' +
      '<p class="cp-hint">Erscheint bei allen einmal mittig in Aktuell. Tippen schließt. Neue öffentliche Wochenpläne melden sich von selbst.</p>';
    if (!list.length) return compose + '<p class="cp-hint">Noch keine Nachrichten.</p>';
    return compose + list.map(function (it) {
      var a = it.a;
      var name = "<b>" + esc(a.name || "Jemand") + "</b>";
      var text;
      var act = "";
      if (it.kind === "account") text = name + " ist neu dabei";
      else if (it.kind === "feedback") text = name + " schreibt Feedback:<span class=\"ga-msg\" style=\"white-space:pre-wrap\">" + esc(a.text) + "</span>";
      else if (it.kind === "coach") {
        text = name + " möchte Coach werden";
        act = coachBtn(a.account_id);
      } else text = name + " hat " + esc(a.title || TYPE_TITLE[a.type] || a.type || "etwas") + " gebucht";
      var isNew = since && String(it.at) > since;
      return '<div class="ga-item' + (isNew ? " is-new" : "") + '">' + face(a) +
        '<div class="ga-copy"><p>' + text + '</p><span class="ga-when">' + esc(when(it.at)) + "</span></div>" + act + "</div>";
    }).join("");
  }

  function paintCoaches() {
    if (!st.coachInfo) loadCoachInfo();
    var isC = function (a) { var ci = coachInfo(a.account_id); return !!(a.is_trainer || ci.coach_self_at || ci.coach_verified_at); };
    var accs = (st.accounts || []).slice().sort(function (x, y) {
      if (isC(y) !== isC(x)) return isC(y) ? 1 : -1;
      return String(x.name || "").localeCompare(String(y.name || ""), "de");
    });
    if (!st.goals) loadGoals();
    return '<p class="cp-hint">Profilbild: alles zur Person. Ziel: ergänzen, das Ziel der Person bleibt.</p>' +
      accs.map(function (a) {
        var id = String(a.account_id);
        var goal = goalText(id);
        var del = id === String(me()) || ADMIN_IDS.indexOf(id) !== -1 ? "" :
          '<button type="button" class="ga-act ga-del" data-ga-del="' + esc(id) + '" aria-label="Löschen">Löschen</button>';
        var coach = coachBtn(id);
        return '<div class="ga-item"><button type="button" class="ga-facebtn" data-ga-info="' + esc(id) + '" aria-label="Infos zu ' + esc(a.name || "") + '">' + face(a) + "</button>" +
          '<div class="ga-copy"><p><b>' + esc(a.name || "?") + "</b>" +
          (coachInfo(id).coach_verified_at ? '<span class="ga-vc">c</span>' : "") +
          (coachInfo(id).nickname ? ' <span class="ga-nick">@' + esc(String(coachInfo(id).nickname).replace(/^@/, "")) + "</span>" : "") + "</p>" +
          '<span class="ga-when">seit ' + esc(when(a.at).split(" · ")[0]) + "</span>" +
          '<button type="button" class="ga-goal" data-ga-goal="' + esc(id) + '">' + esc(goal || "Ziel hinzufügen") + "</button></div>" +
          (coach || del ? '<div class="ga-acts">' + coach + del + "</div>" : "") +
          "</div>";
      }).join("");
  }

  var TABS = [
    { id: "news", label: "Nachrichten" },
    { id: "wa", label: "Erinnerungen" },
    { id: "coaches", label: "Nutzer" },
    { id: "ex", label: "Videos" },
    { id: "editor", label: "Editor" }
  ];
  function tabLabel(id) {
    var t = TABS.filter(function (x) { return x.id === id; })[0];
    return t ? t.label : "Admin";
  }
  function paintMenu() {
    if (!st || !st.menu) return;
    st.menu.innerHTML = TABS.map(function (t) {
      return '<button type="button" data-ga-tab="' + t.id + '" class="' + (st.tab === t.id ? "is-on" : "") + '">' + t.label + "</button>";
    }).join("");
  }
  function paint() {
    if (!st) return;
    if (st.title) st.title.textContent = tabLabel(st.tab);
    paintMenu();
    if (st.error) {
      st.body.innerHTML = '<p class="cp-hint">' + esc(st.error) + "</p>";
      return;
    }
    st.body.innerHTML = st.tab === "news" ? paintNews() : st.tab === "wa" ? paintWa() : st.tab === "ex" ? paintEx() : paintCoaches();
  }

  /* ---------- Ziele der Nutzer (go_accounts.training_goal, mehrere mit Komma) ---------- */
  var GOAL_OPTIONS = ["Gesund laufen", "Rücken stärken", "Gesund bleiben", "Abnehmen", "Muskeln erhalten", "Gelenke schonen", "Hybrid Athlet"];
  /* st.goals = Ziel der Person (training_goal), st.coachGoals = ergänzte Ziele (coach_goals, go-admin-nutzer.sql) */
  function splitGoals(v) {
    return String(v || "").split(/\s*,\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function goalText(id) {
    var own = splitGoals(st.goals && st.goals[id]);
    var extra = splitGoals(st.coachGoals && st.coachGoals[id]).filter(function (g) { return own.indexOf(g) < 0; });
    return own.concat(extra).join(" · ");
  }
  function loadGoals() {
    st.goals = {};
    st.coachGoals = {};
    var ids = (st.accounts || []).map(function (a) { return a.account_id; }).filter(Boolean);
    if (!ids.length) return;
    host.rest("go_accounts?id=in.(" + ids.join(",") + ")&select=id,training_goal")
      .then(function (rows) {
        if (!st) return;
        (rows || []).forEach(function (r) { if (r.training_goal) st.goals[String(r.id)] = r.training_goal; });
        if (st.tab === "coaches") paint();
      })
      .catch(function () {});
    host.rest("go_accounts?id=in.(" + ids.join(",") + ")&select=id,coach_goals")
      .then(function (rows) {
        if (!st) return;
        st.noCoachGoals = false;
        (rows || []).forEach(function (r) { if (r.coach_goals) st.coachGoals[String(r.id)] = r.coach_goals; });
        if (st.tab === "coaches") paint();
      })
      .catch(function () { if (st) st.noCoachGoals = true; });
  }
  function editGoal(id, after) {
    if (!global.GoDialog) return;
    if (st.noCoachGoals) { GoDialog.alert("Ziele ergänzen braucht go-admin-nutzer.sql in Supabase."); return; }
    var person = (st.accounts || []).filter(function (a) { return String(a.account_id) === String(id); })[0];
    var theirs = splitGoals(st.goals && st.goals[id]);
    var cur = splitGoals(st.coachGoals && st.coachGoals[id]);
    var opts = GOAL_OPTIONS.concat(cur.filter(function (c) { return GOAL_OPTIONS.indexOf(c) < 0; }))
      .filter(function (o) { return theirs.indexOf(o) < 0; });
    var own = { label: "Eigenes Ziel …", value: "__own" };
    GoDialog.pick("Ziele ergänzen für " + ((person && person.name) || "diese Person") + (theirs.length ? "\nEigenes Ziel: " + theirs.join(", ") : ""),
      opts.map(function (o) { return { label: o, value: o, checked: cur.indexOf(o) >= 0 }; }).concat([own]), { ok: "Speichern" })
      .then(function (vals) {
        if (vals == null) return null;
        var list = vals.filter(function (v) { return v !== "__own"; });
        if (vals.indexOf("__own") < 0) return list;
        return GoDialog.prompt("Eigenes Ziel", "", { ok: "Hinzufügen" }).then(function (t) {
          t = String(t || "").trim();
          if (t) list.push(t.slice(0, 60));
          return list;
        });
      })
      .then(function (list) {
        if (list == null) return;
        var val = list.join(", ") || null;
        return host.rest("go_accounts?id=eq." + encodeURIComponent(id), { method: "PATCH", prefer: "return=minimal", body: { coach_goals: val } })
          .then(function () {
            if (!st) return;
            if (val) st.coachGoals[String(id)] = val; else delete st.coachGoals[String(id)];
            paint();
            if (after) after();
          })
          .catch(function (err) {
            var m = String((err && err.message) || "");
            if (/coach_goals/.test(m)) GoDialog.alert("Ziele ergänzen braucht go-admin-nutzer.sql in Supabase.");
            else if (host.toast) host.toast("Ziel nicht gespeichert");
          });
      });
  }

  /* ---------- Erinnerungen: WhatsApp 19 Uhr als Checkliste ---------- */
  function berlinToday() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  }
  function hhmm(at) {
    var d = new Date(at);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  }
  function waNumber(phone) {
    var d = String(phone || "").replace(/[^0-9+]/g, "");
    if (d.indexOf("+") === 0) return d.slice(1);
    if (d.indexOf("00") === 0) return d.slice(2);
    if (d.indexOf("0") === 0) return "49" + d.slice(1);
    return d;
  }
  function waText(r) {
    var first = String(r.nickname || r.name || "").split(" ")[0];
    var open = (r.today || []).filter(function (e) { return e.status === "geplant"; });
    var done = (r.today || []).some(function (e) { return e.status === "erledigt"; });
    var next = (r.tomorrow || [])[0];
    var parts = ["Hi " + first + "!"];
    if (open.length) parts.push("Heute noch offen: " + open[0].title + ". Schaffst Du das noch?");
    else if (done) parts.push("Stark, heute erledigt.");
    if (next) parts.push("Morgen: " + next.title + (hhmm(next.at) ? " um " + hhmm(next.at) : "") + ".");
    if (!open.length && !next) parts.push("Morgen steht nichts an. Plan Dir was in gogogo.");
    parts.push("gogogo");
    return parts.join(" ");
  }
  function loadWa() {
    st.wa = null;
    return host.rest("rpc/go_admin_wa_list", { method: "POST", body: { p_day: berlinToday() } })
      .then(function (rows) { if (st) { st.wa = rows || []; paint(); } })
      .catch(function () { if (st) { st.wa = "error"; paint(); } });
  }
  function paintWa() {
    if (st.wa === "error") return '<p class="cp-hint">Liste nicht geladen. Ist go-wa-reminder.sql in Supabase ausgeführt?</p>';
    if (!st.wa) { loadWa(); return '<p class="cp-hint">Lade…</p>'; }
    var done = st.wa.filter(function (r) { return r.sent_at; }).length;
    var head = '<p class="cp-hint">Heute 19 Uhr · ' + done + " von " + st.wa.length + " erinnert. Tipp auf WhatsApp öffnet den Text, danach ist die Person abgehakt.</p>";
    if (!st.wa.length) return head + '<p class="cp-hint">Noch niemand hat die Erinnerung in den Einstellungen eingeschaltet.</p>';
    return head + st.wa.map(function (r) {
      var text = waText(r);
      var href = "https://wa.me/" + waNumber(r.phone) + "?text=" + encodeURIComponent(text);
      return '<div class="ga-item' + (r.sent_at ? " is-sent" : "") + '">' + face(r) +
        '<div class="ga-copy"><p><b>' + esc(r.name || "?") + "</b>" + (r.sent_at ? " ✓" : "") + "</p>" +
        '<span class="ga-msg">' + esc(text) + "</span></div>" +
        '<a class="ga-wa" href="' + esc(href) + '" target="_blank" rel="noopener" data-ga-wa="' + esc(r.account_id) + '">WhatsApp</a></div>';
    }).join("");
  }
  function markWa(id) {
    var row = (st.wa || []).filter(function (r) { return String(r.account_id) === String(id); })[0];
    if (row) row.sent_at = new Date().toISOString();
    host.rest("go_wa_reminder_log", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { account_id: id, day: berlinToday(), sent_by: me(), sent_at: new Date().toISOString() }
    }).catch(function () {});
    setTimeout(paint, 300);
  }

  /* ---------- Eingereichte Übungen (go-uebung-einreichen.sql) ---------- */
  function loadEx() {
    st.ex = null;
    return host.rest("go_exercise_submissions?done_at=is.null&select=id,account_id,name,note,created_at&order=created_at.desc&limit=100")
      .then(function (rows) {
        rows = rows || [];
        var ids = rows.map(function (r) { return r.account_id; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
        if (!ids.length) return { rows: rows, names: {} };
        return host.rest("go_accounts?id=in.(" + ids.join(",") + ")&select=id,name")
          .catch(function () { return []; })
          .then(function (acc) {
            var names = {};
            (acc || []).forEach(function (a) { names[a.id] = a.name; });
            return { rows: rows, names: names };
          });
      })
      .then(function (res) { if (st) { st.ex = res; paint(); } })
      .catch(function () { if (st) { st.ex = "error"; paint(); } });
  }
  /* Fotos und Video-Links von Nutzern zu Übungen (go-exercise-media-review.sql): freigeben oder ablehnen */
  function loadMedia() {
    st.media = "loading";
    return host.rest("go_exercise_links_ranked?approved_at=is.null&select=id,name,url,added_by_name,created_at&order=created_at.desc&limit=100")
      .then(function (rows) { if (st) { st.media = rows || []; paint(); } })
      .catch(function () { if (st) { st.media = "error"; paint(); } });
  }
  function paintMedia() {
    if (st.media === "error") return '<p class="cp-hint">Fotos und Videos: go-exercise-media-review.sql fehlt noch.</p>';
    if (!st.media) { loadMedia(); return ""; }
    if (st.media === "loading") return "";
    if (!st.media.length) return '<h3 class="ga-h3">Fotos und Videos von Nutzern</h3><p class="cp-hint">Nichts offen.</p>';
    return '<h3 class="ga-h3">Fotos und Videos von Nutzern</h3>' + st.media.map(function (r) {
      var info = global.GoExMedia ? GoExMedia.parse(r.url) : null;
      var thumb = info && (info.kind === "img" ? info.url : info.thumb);
      return '<div class="ga-item" data-ga-media="' + esc(r.id) + '" style="cursor:pointer">' +
        (thumb ? '<img class="ga-face" style="border-radius:10px" src="' + esc(thumb) + '" alt="" />' : '<span class="ga-face">▶</span>') +
        '<div class="ga-copy"><p><b>' + esc(r.name) + '</b><span class="ga-new">' + (info && info.kind === "img" ? "Foto" : "Video") + "</span></p>" +
        '<span class="ga-msg">' + esc(r.added_by_name || "?") + "</span>" +
        '<span class="ga-when">' + esc(when(r.created_at)) + "</span></div></div>";
    }).join("");
  }
  function decideMedia(id) {
    var row = (Array.isArray(st.media) ? st.media : []).filter(function (r) { return String(r.id) === String(id); })[0];
    if (!row || !global.GoDialog) return;
    GoDialog.choose(row.name, [
      { label: "Ansehen", value: "view" },
      { label: "Freigeben", value: "ok" },
      { label: "Ablehnen", value: "drop" }
    ]).then(function (v) {
      if (v === "view") { if (global.GoExMedia) GoExMedia.open(row.name, row.url); return; }
      if (!v) return;
      var req = v === "ok"
        ? host.rest("go_exercise_links?id=eq." + encodeURIComponent(row.id), { method: "PATCH", prefer: "return=minimal", body: { approved_at: new Date().toISOString(), approved_by: me() } })
        : host.rest("go_exercise_links?id=eq." + encodeURIComponent(row.id), { method: "DELETE", prefer: "return=minimal" });
      req.then(function () {
        st.media = st.media.filter(function (r) { return String(r.id) !== String(row.id); });
        paint();
        if (host.toast) host.toast(v === "ok" ? "Freigegeben" : "Abgelehnt");
        if (global.GoExMedia && GoExMedia.reload) GoExMedia.reload();
      }).catch(function () { if (host.toast) host.toast("Ging gerade nicht"); });
    });
  }
  function paintEx() {
    return paintMedia() + '<h3 class="ga-h3">Neue Übungen</h3>' + paintExSubs();
  }
  function paintExSubs() {
    if (st.ex === "error") return '<p class="cp-hint">Liste nicht geladen. Ist go-uebung-einreichen.sql in Supabase ausgeführt?</p>';
    if (!st.ex) { loadEx(); return '<p class="cp-hint">Lade…</p>'; }
    if (!st.ex.rows.length) return '<p class="cp-hint">Keine offenen Einreichungen. Nutzer reichen unter Plus → Videos Übungen ein.</p>';
    return '<p class="cp-hint">Tipp auf eine Einreichung: in die Liste aufnehmen oder ablehnen.</p>' + st.ex.rows.map(function (r) {
      return '<div class="ga-item" data-ga-sub="' + esc(r.id) + '" style="cursor:pointer"><div class="ga-copy"><p><b>' + esc(r.name) + '</b><span class="ga-new">neu</span></p>' +
        '<span class="ga-msg">' + esc(st.ex.names[r.account_id] || "?") +
        (r.note ? (/^https?:\/\//.test(r.note)
          ? ' · <a href="' + esc(r.note) + '" target="_blank" rel="noopener">Video ansehen</a>'
          : " · " + esc(r.note)) : "") + "</span>" +
        '<span class="ga-when">' + esc(when(r.created_at)) + "</span></div></div>";
    }).join("");
  }
  function nameKey(n) { return String(n || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function decideSub(id) {
    var row = ((st.ex && st.ex.rows) || []).filter(function (r) { return String(r.id) === String(id); })[0];
    if (!row || !global.GoDialog) return;
    GoDialog.choose(row.name, [
      { label: "In Liste aufnehmen", value: "take" },
      { label: "Ablehnen", value: "drop" }
    ]).then(function (v) {
      if (v === "take") acceptSub(row);
      else if (v === "drop") rejectSub(row);
    });
  }
  function dropRow(row) {
    if (!st || !st.ex) return;
    st.ex.rows = st.ex.rows.filter(function (r) { return String(r.id) !== String(row.id); });
    paint();
  }
  function acceptSub(row) {
    var key = nameKey(row.name);
    var url = /^https?:\/\//.test(String(row.note || "")) ? String(row.note).trim() : "";
    host.rest("go_exercise_catalog?on_conflict=name_key", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
      body: { name_key: key, name: String(row.name).trim(), created_by: me() }
    })
      .then(function () {
        if (!url) return null;
        return host.rest("go_exercise_media?on_conflict=name_key", {
          method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
          body: { name_key: key, name: String(row.name).trim(), url: url, updated_by: me(), updated_at: new Date().toISOString() }
        });
      })
      .then(function () {
        return host.rest("go_exercise_submissions?id=eq." + encodeURIComponent(row.id), { method: "PATCH", prefer: "return=minimal", body: { done_at: new Date().toISOString() } });
      })
      .then(function () {
        dropRow(row);
        if (host.toast) host.toast("„" + row.name + "“ ist in der Liste");
      })
      .catch(function (err) {
        if (host.toast) host.toast("Aufnehmen ging nicht: " + String((err && err.message) || "").slice(0, 80));
      });
  }
  /* Ablehnen löscht die Einreichung (go-uebung-ablehnen.sql); ohne die Datei wird sie nur ausgeblendet */
  function rejectSub(row) {
    host.rest("go_exercise_submissions?id=eq." + encodeURIComponent(row.id), { method: "DELETE", prefer: "return=representation" })
      .then(function (gone) {
        if (gone && gone.length) return null;
        return host.rest("go_exercise_submissions?id=eq." + encodeURIComponent(row.id), { method: "PATCH", prefer: "return=minimal", body: { done_at: new Date().toISOString() } });
      })
      .then(function () { dropRow(row); if (host.toast) host.toast("Abgelehnt"); })
      .catch(function () { if (host.toast) host.toast("Ablehnen ging nicht"); });
  }

  /* Nutzer endgültig löschen (go-admin-delete-user.sql), zweimal bestätigen */
  var ADMIN_IDS = ["5f86ab1e-2043-4944-8196-1bec0c6b0130", "2d3ab029-0a5f-4388-8da7-52501a87dc8c"];
  function deleteAccount(btn) {
    var id = btn.getAttribute("data-ga-del");
    var person = (st.accounts || []).filter(function (a) { return String(a.account_id) === String(id); })[0];
    var name = (person && person.name) || "Diese Person";
    if (!global.GoDialog) return;
    GoDialog.confirm(name + " löschen? Termine, Kommentare und Tracking sind danach weg.", { ok: "Löschen" })
      .then(function (ok) {
        if (!ok) return null;
        return GoDialog.prompt("Zum Bestätigen den Namen eingeben: " + name, "", { ok: "Endgültig löschen" });
      })
      .then(function (typed) {
        if (typed == null) return;
        if (String(typed).trim().toLowerCase() !== String(name).trim().toLowerCase()) {
          GoDialog.alert("Name stimmt nicht. Nichts gelöscht.");
          return;
        }
        btn.disabled = true;
        return host.rest("rpc/go_admin_delete_account", { method: "POST", body: { p_account: id } })
          .then(function () {
            st.accounts = (st.accounts || []).filter(function (a) { return String(a.account_id) !== String(id); });
            paint();
            if (host.toast) host.toast(name + " gelöscht");
          })
          .catch(function (err) {
            btn.disabled = false;
            var m = String((err && err.message) || "");
            GoDialog.alert(/go_admin_delete_account|function/.test(m) ? "Löschen braucht go-admin-delete-user.sql in Supabase." : "Löschen ging nicht: " + m.slice(0, 120));
          });
      });
  }

  function setCoach(btn) {
    var id = btn.getAttribute("data-ga-coach");
    var on = btn.getAttribute("data-on") !== "1";
    var person = (st.accounts || []).filter(function (a) { return String(a.account_id) === String(id); })[0];
    var ask = global.GoDialog
      ? GoDialog.confirm(on ? (person ? person.name : "Diese Person") + " als Coach freischalten?" : "Coach-Rolle entziehen?", { ok: on ? "Freischalten" : "Entziehen" })
      : Promise.resolve(true);
    ask.then(function (ok) {
      if (!ok) return;
      btn.disabled = true;
      host.rest("rpc/go_admin_set_trainer", { method: "POST", body: { p_account: id, p_on: on } })
        .then(function () {
          if (person) person.is_trainer = on;
          paint();
          if (host.toast) host.toast(on ? "Als Coach freigeschaltet" : "Coach-Rolle entzogen");
        })
        .catch(function () {
          btn.disabled = false;
          if (host.toast) host.toast("Hat nicht geklappt (go-admin.sql ausgeführt?)");
        });
    });
  }

  /* Anfrage Coach: bestätigen = Coach freischalten, ablehnen = Anfrage entfernen (go-admin-nutzer.sql) */
  function requestCoach(id) {
    var person = (st.accounts || []).filter(function (a) { return String(a.account_id) === String(id); })[0];
    var name = (person && person.name) || "Diese Person";
    GoDialog.choose(name + " als Coach anlegen?", [
      { label: "Bestätigen", value: "yes" },
      { label: "Ablehnen", value: "no" }
    ]).then(function (v) {
      if (v === "yes") {
        host.rest("rpc/go_admin_set_trainer", { method: "POST", body: { p_account: id, p_on: true } })
          .then(function () {
            if (person) person.is_trainer = true;
            paint();
            if (host.toast) host.toast(name + " ist jetzt Coach");
          })
          .catch(function () { if (host.toast) host.toast("Hat nicht geklappt (go-admin.sql ausgeführt?)"); });
        return;
      }
      if (v !== "no") return;
      host.rest("rpc/go_admin_decline_coach", { method: "POST", body: { p_account: id } })
        .then(function () {
          if (st && st.data && st.data.bookings) {
            st.data.bookings = st.data.bookings.filter(function (b) {
              return !(b && b.type === "coach_offer" && String(b.account_id) === String(id));
            });
          }
          paint();
          if (host.toast) host.toast("Anfrage abgelehnt");
        })
        .catch(function (err) {
          var m = String((err && err.message) || "");
          GoDialog.alert(/go_admin_decline_coach|function/.test(m) ? "Ablehnen braucht go-admin-nutzer.sql in Supabase." : "Ablehnen ging nicht: " + m.slice(0, 120));
        });
    });
  }

  /* Infobox: alles, was die App über die Person weiß, ohne Überschriften */
  function dateDe(v) {
    var d = new Date(v);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Berlin" });
  }
  function parseJson(v, fb) {
    if (typeof v === "string") { try { return JSON.parse(v); } catch (e) { return fb; } }
    return v == null ? fb : v;
  }
  function placeList(raw) {
    var arr = parseJson(raw, []);
    return (Array.isArray(arr) ? arr : []).map(function (x) { return x && typeof x === "object" ? x.name : x; }).filter(Boolean);
  }
  function socialHref(kind, v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (kind === "instagram") return "https://www.instagram.com/" + encodeURIComponent(v.replace(/^@/, "").replace(/^(www\.)?instagram\.com\//i, "").replace(/\/+$/, "")) + "/";
    if (/^(www\.)?linkedin\.com\//i.test(v)) return "https://" + v;
    return "https://www.linkedin.com/in/" + encodeURIComponent(v.replace(/^@/, "")) + "/";
  }
  /* Plan-Events ohne Uhrzeit (genau 12:00 UTC) nur mit Datum */
  function whenEv(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) return "";
    if (d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return when(at).split(" · ")[0];
    return when(at);
  }
  function openInfo(id) {
    if (!st) return;
    var person = (st.accounts || []).filter(function (a) { return String(a.account_id) === String(id); })[0] || {};
    var box = document.createElement("div");
    box.className = "ga-info";
    box.innerHTML = '<div class="ga-info__card" role="dialog" aria-modal="true"><p class="cp-hint">Lade…</p></div>';
    document.body.appendChild(box);
    var card = box.querySelector(".ga-info__card");
    function close() { if (box.parentNode) box.parentNode.removeChild(box); }
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest("[data-gi-close]")) { close(); return; }
      if (e.target.closest("[data-gi-goal]")) { editGoal(id, function () { close(); openInfo(id); }); return; }
      if (e.target.closest("[data-gi-req]")) { close(); requestCoach(id); }
    });
    var enc = encodeURIComponent(id);
    var nowIso = new Date().toISOString();
    var since30 = new Date(Date.now() - 30 * 864e5).toISOString();
    function q(path) { return host.rest(path).catch(function () { return null; }); }
    Promise.all([
      q("go_accounts?id=eq." + enc + "&select=*"),
      q("enrollments?user_id=eq." + enc + "&status=eq.aktiv&select=course_id,start_date&order=start_date.desc&limit=1"),
      q("events?user_id=eq." + enc + "&status=eq.erledigt&select=title,starts_at&order=starts_at.desc&limit=1"),
      q("events?user_id=eq." + enc + "&status=eq.geplant&starts_at=gte." + encodeURIComponent(nowIso) + "&select=title,starts_at&order=starts_at.asc&limit=1"),
      q("events?user_id=eq." + enc + "&status=eq.erledigt&starts_at=gte." + encodeURIComponent(since30) + "&select=id&limit=500"),
      q("go_friends?account_id=eq." + enc + "&select=friend_id&limit=500")
    ]).then(function (r) {
      var a = (r[0] && r[0][0]) || {};
      var en = r[1] && r[1][0];
      var courseJob = en && en.course_id ? q("courses?id=eq." + encodeURIComponent(en.course_id) + "&select=title&limit=1") : Promise.resolve(null);
      return courseJob.then(function (course) {
        if (!box.parentNode) return;
        var about = parseJson(a.about_me, {}) || {};
        if (typeof about !== "object") about = { text: String(about) };
        var rows = [];
        function row(label, html) { if (html) rows.push('<div class="ga-irow"><span>' + esc(label) + "</span><b>" + html + "</b></div>"); }
        var accs = st.accounts || [];
        var nameOf = function (aid) {
          var hit = accs.filter(function (x) { return String(x.account_id) === String(aid); })[0];
          return hit ? hit.name : "";
        };
        var coachees = accs.filter(function (x) { return String(x.trainer_id || "") === String(id); }).map(function (x) { return x.name; });
        var own = splitGoals(a.training_goal);
        var extra = splitGoals(a.coach_goals).filter(function (g) { return own.indexOf(g) < 0; });
        row("Ziele", esc(own.concat(extra.map(function (g) { return g + " (ergänzt)"; })).join(" · ") || "–"));
        row("Wochenplan", course && course[0] ? esc(course[0].title) + (en.start_date ? " · seit " + esc(dateDe(en.start_date)) : "") : "kein Plan");
        row("Nächstes", r[3] && r[3][0] ? esc(r[3][0].title || "Training") + " · " + esc(whenEv(r[3][0].starts_at)) : "");
        row("Zuletzt", r[2] && r[2][0] ? esc(r[2][0].title || "Training") + " · " + esc(whenEv(r[2][0].starts_at)) : "noch nichts erledigt");
        row("30 Tage", r[4] ? esc(String(r[4].length)) + " erledigt" : "");
        row("Coach", a.trainer_id ? esc(nameOf(a.trainer_id) || "ja") : "");
        row("Coachees", a.is_trainer ? esc(coachees.join(", ") || "noch keine") : "");
        row("Freunde", r[5] ? esc(String(r[5].length)) : "");
        row("Über mich", esc(about.text || ""));
        var links = [];
        if (about.instagram) links.push('<a href="' + esc(socialHref("instagram", about.instagram)) + '" target="_blank" rel="noopener">Instagram</a>');
        if (about.linkedin) links.push('<a href="' + esc(socialHref("linkedin", about.linkedin)) + '" target="_blank" rel="noopener">LinkedIn</a>');
        row("Links", links.join(" · "));
        row("Orte", esc(placeList(a.workout_places).join(" · ")) + (a.places_findable ? " (auffindbar)" : ""));
        row("Mantra", esc(a.mantra || ""));
        row("Telefon", esc(a.whatsapp_phone || (/\d{5,}/.test(String(a.phone || "")) ? a.phone : "")));
        row("Code", esc([a.serial_number, a.invite_code].filter(Boolean).join(" · ")));
        row("Dabei seit", esc(dateDe(a.created_at || person.at)));
        row("Datenschutz", a.privacy_ack_at ? "zugestimmt " + esc(dateDe(a.privacy_ack_at)) : "noch nicht zugestimmt");
        row("Erinnerung", a.wa_reminder ? "WhatsApp 19 Uhr an" : "");
        row("Tagebuch", a.diary_visibility === "friends" ? "für Freunde sichtbar" : "privat");
        var books = ((st.data && st.data.bookings) || []).filter(function (b) { return String(b.account_id) === String(id); })
          .map(function (b) { return b.type === "coach_offer" ? "möchte Coach werden" : (b.title || TYPE_TITLE[b.type] || b.type); });
        row("Buchungen", esc(books.join(" · ")));
        var photo = a.photo_url || person.photo_url;
        var faceHtml = photo ? '<img class="ga-info__face" src="' + esc(photo) + '" alt="" />' :
          '<span class="ga-info__face">' + esc(String(a.name || person.name || "?").slice(0, 1)) + "</span>";
        var req = !a.is_trainer && coachRequested(id);
        card.innerHTML = '<div class="ga-info__top">' + faceHtml + '<p class="ga-info__name">' + esc(a.name || person.name || "?") +
          (a.nickname ? '<span class="ga-info__nick">@' + esc(a.nickname) + "</span>" : "") + "</p></div>" +
          rows.join("") +
          '<div class="ga-info__btns">' +
          (req ? '<button type="button" class="is-dark" data-gi-req="1">Anfrage Coach</button>' : "") +
          '<button type="button" data-gi-goal="1">Ziel hinzufügen</button>' +
          '<button type="button" class="is-quiet" data-gi-close="1">Schließen</button></div>';
      });
    });
  }

  function onClick(e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-ga-broadcast],[data-ga-close],[data-ga-burger],[data-ga-tab],[data-ga-coach],[data-ga-wa],[data-ga-sub],[data-ga-block],[data-ga-rdone],[data-ga-media],[data-ga-del],[data-ga-goal],[data-ga-info],[data-ga-req],[data-ga-vc]") : null;
    if (st && st.menu && !st.menu.hidden && (!t || !t.hasAttribute("data-ga-burger"))) st.menu.hidden = true;
    if (!t) return;
    if (t.hasAttribute("data-ga-burger")) { st.menu.hidden = !st.menu.hidden; return; }
    if (t.hasAttribute("data-ga-broadcast")) { broadcast(); return; }
    if (t.hasAttribute("data-ga-del")) { deleteAccount(t); return; }
    if (t.hasAttribute("data-ga-goal")) { editGoal(t.getAttribute("data-ga-goal")); return; }
    if (t.hasAttribute("data-ga-info")) { openInfo(t.getAttribute("data-ga-info")); return; }
    if (t.hasAttribute("data-ga-req")) { requestCoach(t.getAttribute("data-ga-req")); return; }
    if (t.hasAttribute("data-ga-sub")) { decideSub(t.getAttribute("data-ga-sub")); return; }
    if (t.hasAttribute("data-ga-block")) { blockUser(t.getAttribute("data-ga-block"), t.getAttribute("data-ga-name")); return; }
    if (t.hasAttribute("data-ga-rdone")) {
      host.rest("rpc/go_admin_report_done", { method: "POST", body: { p_id: t.getAttribute("data-ga-rdone") } })
        .then(loadReports).catch(function () { if (host.toast) host.toast("Ging nicht"); });
      return;
    }
    if (t.hasAttribute("data-ga-media")) { decideMedia(t.getAttribute("data-ga-media")); return; }
    if (t.hasAttribute("data-ga-wa")) { markWa(t.getAttribute("data-ga-wa")); return; }
    if (t.hasAttribute("data-ga-close")) return close();
    if (t.hasAttribute("data-ga-tab")) {
      var tab = t.getAttribute("data-ga-tab");
      if (tab === "editor") { location.href = "/workout/kurse/?from=admin"; return; }
      st.tab = tab;
      paint();
      return;
    }
    if (t.hasAttribute("data-ga-coach")) setCoach(t);
    if (t.hasAttribute("data-ga-vc")) verifyCoach(t);
  }

  /* Blaues c geben (Bestätigen links, Abbrechen rechts) oder wieder entziehen */
  function verifyCoach(btn) {
    var id = btn.getAttribute("data-ga-vc");
    var off = btn.getAttribute("data-on") === "1";
    if (!global.GoDialog) return;
    GoDialog.confirm(off ? "Blaues c und Coach-Rolle entziehen?" : "Willst Du dem Coach einen blauen Haken geben?",
      { ok: off ? "Entziehen" : "Bestätigen", cancel: "Abbrechen", row: true }).then(function (yes) {
      if (!yes) return;
      btn.disabled = true;
      host.rest("rpc/go_admin_verify_coach", { method: "POST", body: { p_account: id, p_on: !off } })
        .then(function () {
          var ci = st.coachInfo[String(id)] || (st.coachInfo[String(id)] = {});
          ci.coach_verified_at = off ? null : new Date().toISOString();
          if (!off) ci.coach_self_at = ci.coach_self_at || ci.coach_verified_at;
          var person = (st.accounts || []).filter(function (a) { return String(a.account_id) === String(id); })[0];
          if (person) person.is_trainer = !off;
          paint();
          if (host.toast) host.toast(off ? "Blaues c entzogen" : "Blaues c vergeben");
        })
        .catch(function () {
          btn.disabled = false;
          if (host.toast) host.toast("Hat nicht geklappt (go-coach-self.sql ausgeführt?)");
        });
    });
  }

  /* Mitteilung an alle (go-messages.sql) */
  function broadcast() {
    if (!global.GoDialog) return;
    GoDialog.prompt("Mitteilung an alle Nutzer", "", { ok: "Prüfen" }).then(function (text) {
      text = String(text || "").trim();
      if (!text) return;
      text = text.slice(0, 600);
      return GoDialog.confirm("So senden?\n\n" + text, { ok: "An alle senden" }).then(function (ok) {
        if (!ok) return;
        return host.rest("go_messages", { method: "POST", prefer: "return=minimal", body: { body: text, kind: "update", from_id: me() } })
          .then(function () { if (host.toast) host.toast("Mitteilung ist raus"); })
          .catch(function (err) {
            var m = String((err && err.message) || "");
            GoDialog.alert(/go_messages|relation|schema/.test(m) ? "Dafür muss go-messages.sql in Supabase laufen." : "Senden ging nicht: " + m.slice(0, 120));
          });
      });
    });
  }

  function close() {
    if (st && st.root) st.root.remove();
    document.body.classList.remove("cp-open");
    st = null;
    if (host && host.onAdminClosed) host.onAdminClosed();
  }

  function open(h, tab) {
    host = h;
    ensureCss();
    if (st) close();
    var root = document.createElement("div");
    root.className = "cp";
    root.innerHTML =
      '<div class="ga-bar">' +
      '<button type="button" class="ga-round" data-ga-close aria-label="Zurück">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 6.5 8.2 12l6 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button><h2>Admin</h2><button type="button" class="ga-round ga-burger" data-ga-burger aria-label="Menü"><span></span></button>' +
      '<div class="ga-menu" hidden></div></div>' +
      '<div class="cp-body"><p class="cp-hint">Lade…</p></div>';
    document.body.appendChild(root);
    document.body.classList.add("cp-open");
    st = { root: root, body: root.querySelector(".cp-body"), title: root.querySelector(".ga-bar h2"), menu: root.querySelector(".ga-menu"),
      tab: tab || "news", seenBefore: lastSeen(), data: null, accounts: [] };
    root.addEventListener("click", onClick);
    load().then(function (data) {
      if (!st) return;
      st.data = data || {};
      st.accounts = (data && data.accounts) || [];
      paint();
      markSeen();
    }).catch(function () {
      if (!st) return;
      st.error = "Nachrichten konnten nicht geladen werden. Ist go-admin.sql in Supabase ausgeführt?";
      paint();
    });
  }

  global.GoAdmin = { open: open, unread: unread, close: close };
})(window);
