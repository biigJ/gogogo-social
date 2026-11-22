/* admin-inbox.js — Admin in der App (nur Joscha / Ben)
 *
 *   GoAdmin.open(host, tab)   → Vollbild mit Burger-Menü: Nachrichten, Erinnerungen, Nutzer (Infobox per Profilbild,
 *                               Ziele, Rolle, Pausieren, Löschen), Editor (/workout/kurse/), Social Media Links, Circles
 *   GoAdmin.unread(host)      → Promise<Anzahl neuer Nachrichten seit dem letzten Öffnen>
 *
 * host: rest(path, opts), sessionAccount, toast(msg)
 * Daten über RPCs aus go-admin.sql (security definer, prüfen go_is_admin()).
 * Optik: Coach-Portal-Klassen (.cp-*) aus index.html.
 */
(function (global) {
  "use strict";

  var host = null;
  var PEN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
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
    ".ga-vc{display:inline-grid;place-items:center;width:14px;height:14px;margin-left:3px;vertical-align:super;border-radius:50%;background:#1D9BF0;line-height:0;font-size:0}" +
    ".ga-vc svg{display:block;width:100%;height:100%}" +
    /* Nutzer- und Circle-Zeilen */
    ".ga-rows{display:flex;flex-direction:column;gap:2px;font-size:13px;line-height:1.35;color:rgba(42,33,24,.75)}" +
    ".ga-rows .ga-r1{font-size:15px;color:#2A2118}" +
    ".ga-rows span.ga-sep::before{content:' · '}" +
    ".ga-link{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer;text-align:left}" +
    ".ga-pill{flex:none;align-self:center;min-height:34px;padding:0 14px;border-radius:999px;border:1.5px solid #111;background:transparent;color:#111;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}" +
    ".ga-pill.is-fill{background:#111;color:#fff}" +
    ".ga-pill.is-blue{background:#1D9BF0;border-color:#1D9BF0;color:#fff}" +
    ".ga-pill.is-admin{background:#C7413B;border-color:#C7413B;color:#fff}" +
    "@media (max-width:600px){.ga-item:has(.ga-wa){flex-wrap:wrap}.ga-item:has(.ga-wa) .ga-copy{flex:1 1 calc(100% - 54px)}.ga-item .ga-wa{margin-left:54px}}" +
    ".ga-nf{display:block;margin:0 0 12px}" +
    ".ga-nf span{display:block;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(42,33,24,.6);margin-bottom:6px}" +
    ".ga-nf input,.ga-nf select,.ga-nf__pick{display:block;width:100%;box-sizing:border-box;min-height:46px;padding:0 16px;border-radius:999px;border:1.5px solid rgba(42,33,24,.3);background:transparent;font:inherit;font-size:15px;color:#111;text-align:left;cursor:pointer}" +
    ".ga-newacc .ga-info__top{margin-bottom:14px}" +
    ".ga-newacc__btns{grid-template-columns:1fr 1fr}" +
    ".ga-qrcard{width:min(86vw,340px);aspect-ratio:5/8;box-sizing:border-box;background:#C7413B;color:#F6F1E8;border-radius:18px;padding:18px 14px 16px;display:flex;flex-direction:column;align-items:center;box-shadow:0 18px 40px rgba(0,0,0,.28)}" +
    "body .ga-qrcard .ga-qrcard__brand{font-family:'Playfair Display',Georgia,serif !important;font-weight:600 !important;font-size:26px !important;line-height:1.05;letter-spacing:-.02em;margin:2px 0 14px}" +
    ".ga-qrcard__band{width:calc(100% + 28px);margin:0 -14px;padding:18px 0;background:rgba(0,0,0,.22);display:grid;place-items:center}" +
    ".ga-qrcard__code{background:#fff;padding:10px;border-radius:10px;line-height:0}" +
    ".ga-qrcard__foot{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%}" +
    "body .ga-qrcard .ga-qrcard__name{font-family:'Playfair Display',Georgia,serif !important;font-weight:600 !important;font-size:22px !important;line-height:1.2;text-align:center}" +
    ".ga-qrcard__nick{font-size:15px;font-weight:600;opacity:.9;margin-top:4px;text-align:center}" +
    ".ga-qrcard__code-line{margin-top:14px;font-size:15px;font-weight:600;white-space:nowrap;text-align:center}" +
    ".ga-rec__next{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(42,33,24,.12);font-size:15px}" +
    ".ga-rec__next span:last-child{color:rgba(42,33,24,.65);text-align:right}" +
    ".ga-search{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0}" +
    ".ga-search input{min-height:40px;padding:0 14px;border-radius:999px;border:1.5px solid rgba(42,33,24,.3);background:transparent;font:inherit;font-size:15px;color:#111;min-width:0}" +
    ".ga-search input:focus{outline:none;border-color:#111}" +
    /* Knöpfe 1/5 der vollen Breite (mobil breiter), Formular ohne Rahmen und Flächen */
    ".ga-btn5{width:max(20%,168px);min-height:44px;padding:0 14px;border-radius:999px;border:1.5px solid #111;background:transparent;color:#111;font:inherit;font-size:14px;font-weight:700;cursor:pointer}" +
    ".ga-btn5.is-dark{background:#111;color:#fff}" +
    ".ga-tk__top{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}" +
    ".ga-tk__form{margin:4px 0 18px}" +
    ".ga-tk__row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}" +
    "@media (max-width:600px){.ga-tk__row{grid-template-columns:1fr;gap:4px}}" +
    ".ga-tk__l{display:block;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(42,33,24,.6);margin:0 0 14px}" +
    ".ga-tk__l select,.ga-tk__l textarea{display:block;width:100%;box-sizing:border-box;margin-top:8px;min-height:48px;padding:10px 16px;border-radius:14px;border:1.5px solid rgba(42,33,24,.3);background:transparent;font:inherit;font-size:15px;font-weight:400;letter-spacing:0;text-transform:none;color:#111}" +
    ".ga-tk__l select{border-radius:999px}" +
    ".ga-tk__btns{display:flex;gap:8px;justify-content:flex-end}" +
    ".ga-tk{border-top:1px solid rgba(42,33,24,.12);padding:12px 0}" +
    ".ga-tk.is-done{opacity:.55}" +
    ".ga-tk__head{display:flex;gap:10px;align-items:center;font-size:14px}" +
    ".ga-tk__head span{flex:1;color:rgba(42,33,24,.65)}" +
    ".ga-tk__head select{min-height:32px;padding:0 8px;border-radius:999px;border:1.5px solid #111;background:transparent;font:inherit;font-size:13px;font-weight:600}" +
    ".ga-tk__path{margin:4px 0 2px;font-size:13px;font-weight:700}" +
    ".ga-tk__body{margin:0;white-space:pre-wrap;font-size:15px}" +
    ".ga-tk__acts{display:flex;gap:16px;justify-content:flex-end;margin-top:4px}" +
    /* Bild fest 4 Schriftreihen hoch, Rechteck 4:5 */
    ".ga-cimg,.ga-rect{width:61px;height:76px;flex:none;align-self:flex-start;border-radius:10px;object-fit:cover;background:#E6DED0;display:grid;place-items:center;font-weight:700}" +
    ".ga-rectbtn{flex:none;align-self:flex-start;padding:0;border:0;background:none;cursor:pointer;border-radius:10px}" +
    ".ga-photo{position:relative;width:160px;height:200px;margin:0 auto 12px}" +
    ".ga-photo img,.ga-photo span{width:100%;height:100%;border-radius:14px;object-fit:cover;background:#E6DED0;display:grid;place-items:center;font:700 48px/1 Inter,system-ui,sans-serif}" +
    ".ga-pen{position:absolute;right:-8px;bottom:-8px;width:40px;height:40px;border-radius:50%;border:0;background:#111;color:#fff;display:grid;place-items:center;cursor:pointer}" +
    ".ga-item.is-top{align-items:flex-start}" +
    "@media (max-width:600px){.ga-item.ga-circ{flex-wrap:wrap}.ga-circ .ga-copy{flex:1 1 calc(100% - 73px)}.ga-circ .ga-pill{margin-left:73px}}" +
    ".ga-filters{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 4px}" +
    ".ga-filters select{min-height:34px;padding:0 10px;border-radius:999px;border:1.5px solid #111;background:transparent;font:inherit;font-size:13px;font-weight:600;color:#111}" +
    ".ga-paused{opacity:.55}" +
    /* Circle-Aufzeichnungen: Markup und Klassen der App (go-rec-wheel, go-rec-detail, go-rec-round) */
    ".ga-rec .ga-info__card{width:min(100%,520px)}" +
    ".ga-pills{flex:none;align-self:center;display:flex;gap:6px}" +
    "@media (max-width:600px){.ga-item:has(.ga-pills){flex-wrap:wrap}.ga-item:has(.ga-pills) .ga-copy{flex:1 1 calc(100% - 85px)}.ga-item .ga-pills{margin-left:73px}}" +
    ".ga-rec .go-rec-detail__pts{text-align:center;font:600 28px/1.2 'Playfair Display',Georgia,serif;margin-top:4px}" +
    ".ga-rec .go-rec-detail__meta{text-align:center;font-size:13px;margin-bottom:6px}" +
    /* Dreh-Knöpfe: Tippen schaltet zum nächsten Wert */
    ".ga-filters select{max-width:220px}" +
    "@media (max-width:600px){.ga-filters.is-u{display:grid;grid-template-columns:1fr 1fr}.ga-filters.is-u select{max-width:none;width:100%;min-width:0;font-size:12px;padding:0 6px}}" +
    ".ga-filters select.is-on{background:#111;color:#fff}" +
    ".ga-ucount{font-size:13px;color:rgba(42,33,24,.65);margin:4px 0 0}" +
    ".ga-del{margin-left:6px;color:#C7413B;border-color:#C7413B}" +
    ".ga-wa{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:0;background:#128C7E;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-grid;place-items:center}" +
    ".ga-item.is-sent{opacity:.5}" +
    ".ga-msg{display:block;white-space:pre-wrap;font-size:13px;color:rgba(42,33,24,.75);margin-top:2px}" +
    ".ga-bar{display:grid;grid-template-columns:31px 1fr 31px;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 16px 8px;position:relative}" +
    ".ga-bar h2{margin:0;text-align:center;font:600 22px/1.2 'Playfair Display',Georgia,serif}" +
    ".ga-round{width:31px;height:31px;padding:0;border:1px solid #2A2118;border-radius:50%;display:grid;place-items:center;background:transparent;color:#2A2118;cursor:pointer}" +
    ".ga-round.ga-burger{border:0;border-radius:0}" +
    ".ga-burger span{display:block;width:30px;height:2.5px;background:currentColor;border-radius:2px;box-shadow:0 -11px 0 currentColor,0 11px 0 currentColor}" +
    ".ga-menu{position:absolute;left:0;right:0;top:100%;z-index:3;background:#F3EEE4;padding:0 20px 10px;box-shadow:0 14px 24px rgba(42,33,24,.12)}" +
    ".ga-menu[hidden]{display:none}" +
    ".ga-menu button{display:block;width:100%;padding:14px 2px;border:0;border-bottom:1px solid rgba(42,33,24,.2);border-radius:0;background:transparent;color:#2A2118;font:500 16px/1.35 Inter,system-ui,sans-serif;text-align:right;cursor:pointer}" +
    ".ga-menu button.is-on{font-weight:700}" +
    ".ga-new{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#C7413B;color:#fff;font-size:11px;font-weight:700;vertical-align:2px}" +
    ".ga-req{display:inline-block;margin-top:3px;padding:2px 8px;border-radius:999px;border:1px solid #2A2118;font-size:12px;font-weight:600}" +
    ".ga-goal{display:block;margin-top:2px;font-size:13px;color:rgba(42,33,24,.75);text-decoration:underline;background:none;border:0;padding:0;font-family:inherit;cursor:pointer;text-align:left}" +
    ".ga-acts{display:flex;flex-direction:column;gap:6px;align-items:flex-end}" +
    ".ga-acts .ga-del{margin-left:0}" +
    ".ga-facebtn{flex:none;padding:0;border:0;background:none;border-radius:50%;cursor:pointer}" +
    ".ga-info{position:fixed;inset:0;z-index:10040;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,16,12,.42)}" +
    ".ga-info__card{width:min(100%,420px);max-height:88vh;overflow-y:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px;padding:20px 18px 14px;font-family:Inter,system-ui,sans-serif}" +
    ".ga-info__top{display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:12px;text-align:center}" +
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
    "@media (min-width:900px){.cp .cp-body{max-width:760px;margin:0 auto;width:100%;box-sizing:border-box}.cp.ga-root .cp-body{max-width:1280px}}";

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
    var more = ",serial_number,invite_code,phone,whatsapp_phone,about_me,training_goal,trainer_id,workout_places,photo_url";
    host.rest(base + "id,nickname,coach_self_at,coach_verified_at,paused_at,seen_at,ffc_seen_at,is_admin" + more)
      .catch(function () { return host.rest(base + "id,nickname,coach_self_at,coach_verified_at,paused_at" + more); })
      .catch(function () { return host.rest(base + "id,nickname,coach_self_at,coach_verified_at" + more); })
      .catch(function () { return host.rest(base + "id,nickname"); })
      .then(function (rows) {
        if (!st) return;
        (rows || []).forEach(function (r) { st.coachInfo[String(r.id)] = r; });
        if (st.tab === "coaches" || st.tab === "news" || st.tab === "wa") paint();
      })
      .catch(function () {});
  }
  function coachBtn(id) {
    var on = trainerOf(id);
    var ci = coachInfo(id);
    if (ci.coach_verified_at) return '<button type="button" class="ga-act is-on" data-ga-vc="' + esc(id) + '" data-on="1">Coach <span class="ga-vc"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13.1 6.6A4.6 4.6 0 1 0 13.1 13.4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></span></button>';
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
  /* Suche nach Nickname und Vorname (Nachrichten, Nutzer, Erinnerungen); Eingabe zeichnet die Liste neu, Fokus bleibt */
  function qOf(tab) { st.q = st.q || {}; return st.q[tab] || (st.q[tab] = { nick: "", first: "" }); }
  function searchBar(tab) {
    var q = qOf(tab);
    return '<div class="ga-search"><input type="search" data-ga-q="' + tab + '|nick" placeholder="Nickname" value="' + esc(q.nick) + '" autocomplete="off" />' +
      '<input type="search" data-ga-q="' + tab + '|first" placeholder="Vorname" value="' + esc(q.first) + '" autocomplete="off" /></div>';
  }
  function norm(x) { return String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function qMatch(tab, id, name) {
    var q = qOf(tab);
    if (q.first && norm(String(name || "").split(" ")[0]).indexOf(norm(q.first)) !== 0) return false;
    if (q.nick && norm(coachInfo(String(id || "")).nickname).indexOf(norm(q.nick).replace(/^@/, "")) < 0) return false;
    return true;
  }
  /* Dropdown-Filter für Nachrichten und Tickets: groups = [[key, label, [[value, label], …]], …] */
  function nfOf(scope) { st.nf = st.nf || {}; return st.nf[scope] || (st.nf[scope] = {}); }
  function selBar(scope, groups, n, total, noun) {
    var f = nfOf(scope);
    var on = groups.some(function (g) { return f[g[0]]; });
    return '<div class="ga-filters is-u">' + groups.map(function (g) {
      return '<select data-ga-nf="' + scope + "|" + g[0] + '" aria-label="' + esc(g[1]) + '"' + (f[g[0]] ? ' class="is-on"' : "") + '><option value="">' + esc(g[1]) + ": alle</option>" +
        g[2].map(function (o) { return '<option value="' + esc(o[0]) + '"' + (f[g[0]] === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
    }).join("") + "</div>" +
      '<p class="ga-ucount">' + n + " von " + total + " " + noun + (on ? ' · <button type="button" class="ga-link" data-ga-nfreset="' + scope + '">Filter zurücksetzen</button>' : "") + "</p>";
  }
  function uniq(arr) {
    var seen = {};
    return arr.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; });
  }
  var NEWS_KIND = [["account", "Neu dabei"], ["feedback", "Feedback"], ["coach", "Coach-Anfrage"], ["booking", "Buchung"], ["report", "Gemeldet"]];
  function paintNews() {
    var since = st.seenBefore;
    var all = items(st.data);
    var f = nfOf("news");
    var now = Date.now(), DAY = 864e5;
    function age(at) { var t = new Date(at).getTime(); return isNaN(t) ? 1e12 : now - t; }
    if (!st.coachInfo) loadCoachInfo();
    var list = all.filter(function (it) {
      if (!qMatch("news", it.a.account_id, it.a.name)) return false;
      if (f.kind && it.kind !== f.kind) return false;
      if (f.type && !(it.kind === "booking" && String(it.a.type) === f.type)) return false;
      if (f.who && String(it.a.name || "") !== f.who) return false;
      if (f.time === "d1" && age(it.at) > DAY) return false;
      if (f.time === "d7" && age(it.at) > 7 * DAY) return false;
      if (f.time === "d30" && age(it.at) > 30 * DAY) return false;
      if (f.time === "old" && age(it.at) <= 30 * DAY) return false;
      var isNew = since && String(it.at) > since;
      if (f.seen === "new" && !isNew) return false;
      if (f.seen === "old" && isNew) return false;
      return true;
    });
    var types = uniq(all.filter(function (it) { return it.kind === "booking"; }).map(function (it) { return String(it.a.type || ""); }));
    var bar = selBar("news", [
      ["kind", "Art", NEWS_KIND],
      ["type", "Buchung", types.map(function (t) { return [t, TYPE_TITLE[t] || t]; })],
      ["time", "Zeitraum", [["d1", "letzte 24 Stunden"], ["d7", "letzte 7 Tage"], ["d30", "letzte 30 Tage"], ["old", "älter als 30 Tage"]]],
      ["who", "Person", uniq(all.map(function (it) { return String(it.a.name || ""); })).sort(function (x, y) { return x.localeCompare(y, "de"); }).map(function (x) { return [x, x]; })],
      ["seen", "Status", [["new", "neu"], ["old", "gelesen"]]]
    ], f.kind === "report" ? 0 : list.length, all.length, "Nachrichten");
    var showReports = !f.kind || f.kind === "report";
    if (f.kind === "report") list = [];
    var compose = (showReports ? paintReports() : "") + '<button type="button" class="cp-btn cp-btn--ghost" data-ga-broadcast="1" style="margin:0 0 10px">Mitteilung an alle Nutzer</button>' +
      '<p class="cp-hint">Erscheint bei allen einmal mittig in Aktuell. Tippen schließt. Neue öffentliche Wochenpläne melden sich von selbst.</p>';
    compose += searchBar("news") + bar;
    if (!list.length) return compose + (f.kind === "report" ? "" : '<p class="cp-hint">' + (all.length ? "Nichts gefunden." : "Noch keine Nachrichten.") + "</p>");
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

  /* Gruppe und Circle je Nutzer (go-admin-circles.sql) */
  /* Wochenplan, Stempelkarten, Gruppen, Circles, Doubles je Nutzer (go-admin-user-extras.sql) */
  function loadExtras() {
    st.extras = {};
    host.rest("rpc/go_admin_user_extras", { method: "POST", body: {} })
      .then(function (r) { if (st) { st.extras = r || {}; st.extrasOk = true; if (st.tab === "coaches") paint(); } })
      .catch(function () {});
  }
  function extrasOf(id) { return (st.extras && st.extras[String(id)]) || null; }
  /* HYROX Doubles aller Circles (go-hyrox-doubles.sql), für Admin → Nutzer → Aufzeichnungen */
  function loadHxd() {
    st.hxd = [];
    /* Termine mit Stationen (go-hyrox-eintragen.sql); ohne die Tabelle gilt die Voreinstellung im Code */
    host.rest("go_hyrox_events?select=*").then(function (ev) {
      if (global.GoHyroxDoubles && GoHyroxDoubles.setEvents) GoHyroxDoubles.setEvents(ev);
    }).catch(function () {});
    return host.rest("go_hyrox_doubles?select=*&order=day.desc&limit=2000")
      .then(function (rows) { if (st) { st.hxd = rows || []; if (st.tab === "coaches") paint(); } })
      .catch(function () {});
  }
  /* Alle Zirkeltraining-Workouts je Person, vergangen und geplant (go-admin-circle-workouts.sql) */
  function loadCw() {
    st.cw = [];
    st.cwLoaded = false;
    return host.rest("rpc/go_admin_circle_workouts", { method: "POST", body: {} })
      .then(function (rows) {
        if (!st) return;
        st.cw = rows || [];
        st.cwLoaded = true;
        st.cwLabels = {};
        st.cw.forEach(function (r) { st.cwLabels[r.day + "|" + (r.circle_id || "")] = dayDe(r.day) + " · " + (r.circle_name || "Circle"); });
        if (st.tab === "coaches") paint();
      })
      .catch(function () { if (st) st.cwLoaded = "missing"; });
  }
  function todayBerlin() { return berlinDay(new Date().toISOString()); }
  function cwOf(id) {
    var seen = {};
    return (st.cw || []).filter(function (r) {
      if (String(r.account_id) !== String(id)) return false;
      var k = r.day + "|" + (r.circle_id || "");
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });
  }
  function cwFuture(id) {
    var t = todayBerlin();
    return cwOf(id).filter(function (r) { return r.day >= t; }).sort(function (x, y) { return String(x.starts_at).localeCompare(String(y.starts_at)); });
  }
  function noteVal(note, key) {
    var m = String(note || "").match(new RegExp("(?:^|\\|)" + key + "=([^|]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }
  /* Anstehendes Workout eines Termins (Schlüssel Tag|Circle): Stationen aus dem HYROX-Termin, sonst Runden aus dem Event */
  function nextInfo(key) {
    var parts = key.split("|"), day = parts[0], cid = parts[1] || "";
    var ev = (st.cw || []).filter(function (r) { return r.day === day && String(r.circle_id || "") === cid; })
      .sort(function (x, y) { return (x.note ? 0 : 1) - (y.note ? 0 : 1); })[0] || {};
    var H = global.GoHyroxDoubles;
    var CS = global.GoCircleSheet;
    var keys = CS ? CS.noteStations(ev.note) : [];
    var stations = keys.length ? CS.labels(keys) : H ? H.plan({ day: day, circle_id: cid, results: {} }).map(function (x) { return x.label; }) : [];
    var work = Number(noteVal(ev.note, "work")) || 0, pause = Number(noteVal(ev.note, "pause")) || 0;
    var rounds = Number(noteVal(ev.note, "rounds")) || stations.length || 8;
    var when = ev.starts_at ? shortDay(ev.starts_at) + ", " + new Date(ev.starts_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : dayDe(day);
    var mm = function (sec) { return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
    return {
      day: day, circle: cid, stations: stations.length ? stations : null, rounds: rounds, eventId: ev.event_id || null, note: ev.note || "",
      title: "Anstehendes Workout",
      sub: [when, ev.circle_name || "", ev.mode === "double" ? "Double" : ev.mode ? "Single" : "", work ? mm(work) + " Arbeit" + (pause ? " / " + mm(pause) + " Pause" : "") : ""].filter(Boolean).join(" · ")
    };
  }
  /* Letztes Workout vor dem Termin: HYROX Double mit Werten (gleicher Circle zuerst) */
  function lastInfo(id, beforeDay, cid, ffc) {
    var H = global.GoHyroxDoubles;
    var rows = hxdOf(id).filter(function (r) { return r.day < beforeDay; })
      .sort(function (x, y) { return (String(y.circle_id) === cid) - (String(x.circle_id) === cid) || String(y.day).localeCompare(String(x.day)); });
    var r = rows[0];
    /* FFC-Training aus der App (go_ffc_sessions.lines), wenn es jünger ist als das letzte HYROX Double */
    var f = (ffc || []).filter(function (x) { return String(x.account_id) === String(id) && x.day < beforeDay && (x.lines || []).length; })[0];
    if (f && (!r || f.day >= r.day)) {
      var mm = function (sec) { return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
      return {
        sub: [dayDe(f.day), "Zirkeltraining", (f.rounds ? f.rounds + " Runden" : ""), f.work_sec ? mm(f.work_sec) + " Arbeit" : ""].filter(Boolean).join(" · "),
        total: f.points,
        rows: f.lines.map(function (l) {
          var lab = String(l.label || "").replace(/^R\d+\s*·\s*/, "");
          var m = String(l.value || "").match(/^(.*?)\s*·\s*(\d+)\s*P$/);
          return { label: lab, value: m ? m[1] : String(l.value || ""), points: m ? Number(m[2]) : null };
        })
      };
    }
    if (!r || !H) return null;
    var names = String(r.team || "").split(/\s*&\s*/);
    var mi = (r.account_ids || []).map(String).indexOf(String(id));
    var partner = names[mi === 0 ? 1 : 0] || "";
    var cname = ((st.cw || []).filter(function (x) { return String(x.circle_id) === String(r.circle_id); })[0] || {}).circle_name || "";
    return {
      sub: [dayDe(r.day), cname, (r.title || "HYROX Double") + (partner ? " mit " + partner : ""), r.category].filter(Boolean).join(" · "),
      total: H.score(r).total,
      rows: H.plan(r).map(function (x) { return { label: x.label, value: x.value == null ? "–" : H.valueText(x), points: x.points }; })
    };
  }
  /* PDF: je Person eine A4-Seite quer (links letztes, rechts anstehendes Workout); Start einmal wählen oder offen lassen */
  function exportSheets(ids, key) {
    if (!global.GoCircleSheet) { GoDialog.alert("PDF-Modul fehlt (circle-sheet.js)."); return; }
    var nx = nextInfo(key);
    /* Event ohne Stationen (vor dem Stationen-Schritt angelegt): jetzt wählen und am Event speichern */
    var stJob = nx.stations ? Promise.resolve(nx.stations) : GoCircleSheet.pickStations("Stationen für dieses Event").then(function (k) {
      if (!k) return null;
      if (nx.eventId) {
        var note = String(nx.note || "zirkel:single").replace(/\|st=[^|]*/, "") + "|st=" + k.join(",");
        host.rest("events?id=eq." + encodeURIComponent(nx.eventId), { method: "PATCH", prefer: "return=minimal", body: { note: note } }).catch(function () {});
        (st.cw || []).forEach(function (r) { if (r.event_id === nx.eventId) r.note = note; });
      }
      return GoCircleSheet.labels(k);
    });
    var ffcJob = host.rest("go_ffc_sessions?account_id=in.(" + ids.map(encodeURIComponent).join(",") + ")&day=lt." + nx.day + "&select=account_id,day,points,rounds,work_sec,lines&order=day.desc&limit=2000")
      .catch(function () { return host.rest("go_ffc_sessions?account_id=in.(" + ids.map(encodeURIComponent).join(",") + ")&day=lt." + nx.day + "&select=account_id,day,points,rounds,work_sec&order=day.desc&limit=2000"); })
      .catch(function () { return []; });
    var ffcRows = [];
    stJob.then(function (sts) {
      if (!sts) return null;
      nx.stations = sts;
      nx.rounds = sts.length;
      return ffcJob.then(function (rows) {
        ffcRows = rows || [];
        return GoDialog.choose("Wo ist Start?", sts.map(function (x, i) { return { label: x, value: String(i) }; }).concat([{ label: "Offen lassen (zum Eintragen)", value: "open" }]), { cancel: "Abbrechen" });
      });
    }).then(function (v) {
      if (!v) return;
      var start = v === "open" ? null : Number(v);
      var pages = ids.map(function (id) {
        var a = (st.accounts || []).filter(function (q) { return String(q.account_id) === String(id); })[0] || {};
        return { name: a.name || "", partner: "", last: lastInfo(id, nx.day, nx.circle, ffcRows), next: Object.assign({}, nx, { start: start }) };
      });
      var file = "gogogo-" + nx.day + "-" + String(((st.cw || []).filter(function (r) { return String(r.circle_id || "") === nx.circle; })[0] || {}).circle_name || "circle").replace(/[^A-Za-z0-9]+/g, "-") + (ids.length === 1 ? "-" + String(pages[0].name).split(" ")[0] : "") + ".pdf";
      return GoCircleSheet.pdf(pages, { format: "a4", file: file });
    }).catch(function (e) { GoDialog.alert("PDF ging nicht: " + String((e && e.message) || e)); });
  }
  function hxdOf(id) {
    return (st.hxd || []).filter(function (r) { return (r.account_ids || []).map(String).indexOf(String(id)) >= 0; });
  }
  function stampTxt(n) { return (Number(n) || 0) + "/12"; }
  /* Stempelkarte aktiv mit Stempeln, sonst inaktiv; dazu je Gruppe und Circle die verknüpfte Karte (inaktiv, angefragt oder Stempel) */
  function stampLine(x) {
    var out = [x.stamp ? "Stempelkarte " + stampTxt(x.stamp.stamps) : "Stempelkarte inaktiv"];
    var links = x.links || [];
    function linkFor(kind, ref) { return links.filter(function (l) { return l.kind === kind && String(l.ref) === String(ref); })[0]; }
    function one(kind, label, g) {
      var l = linkFor(kind, g.id);
      out.push(label + " " + (g.name || "") + ": " + (!l ? "inaktiv" : l.status === "pending" ? "angefragt" : stampTxt(l.stamps)));
    }
    (x.groups || []).forEach(function (g) { one("group", "Gruppe", g); });
    (x.circles || []).forEach(function (g) { one("circle", "Circle", g); });
    /* verknüpfte Karten von Circles/Gruppen, in denen die Person nicht (mehr) ist */
    links.forEach(function (l) {
      var known = (l.kind === "group" ? x.groups : x.circles || []).some(function (g) { return String(g.id) === String(l.ref); });
      if (!known) out.push((l.kind === "group" ? "Gruppe " : "Circle ") + (l.name || "") + ": " + (l.status === "pending" ? "angefragt" : stampTxt(l.stamps)));
    });
    return out;
  }
  function doubleLine(x, nameOf) {
    var d = (x.doubles || []).map(function (e) {
      var who = e.partner_id ? nameOf(e.partner_id) : "";
      if (!who && e.partner_name) { try { who = decodeURIComponent(e.partner_name); } catch (err) { who = e.partner_name; } }
      return (who || "Partner") + " " + shortDay(e.at);
    });
    return "Double: " + (d.length ? d.join(", ") : "–");
  }
  function loadLinks() {
    st.links = {};
    host.rest("rpc/go_admin_user_links", { method: "POST", body: {} })
      .then(function (r) { if (st) { st.links = r || {}; if (st.tab === "coaches") paint(); } })
      .catch(function () {});
  }
  function isCoachAcc(a) {
    var ci = coachInfo(a.account_id);
    return !!(a.is_trainer || ci.coach_self_at || ci.coach_verified_at);
  }
  function aboutOf(ci) {
    var v = ci.about_me;
    if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = {}; } }
    return v && typeof v === "object" ? v : {};
  }
  /* Pille rechts: Nutzer (leer) · Coach (gefüllt) · Coach mit blauem c (blau) · Anfrage Coach */
  function rolePill(a) {
    var id = String(a.account_id);
    var ci = coachInfo(id);
    if (ci.is_admin) return '<button type="button" class="ga-pill is-admin" data-ga-admin="' + esc(id) + '">Admin</button>';
    if (ci.coach_verified_at) return '<button type="button" class="ga-pill is-blue" data-ga-role="' + esc(id) + '">Coach</button>';
    if (isCoachAcc(a)) return '<button type="button" class="ga-pill is-fill" data-ga-role="' + esc(id) + '">Coach</button>';
    if (coachRequested(id)) return '<button type="button" class="ga-pill" data-ga-req="' + esc(id) + '">Anfrage Coach</button>';
    return '<button type="button" class="ga-pill" data-ga-user="' + esc(id) + '">' + (ci.paused_at ? "Pausiert" : "Nutzer") + "</button>";
  }
  /* Nutzer-Filter: je Merkmal ein Dropdown (alle, Werte, ohne) */
  var UF = [["role", "Rolle"], ["login", "Login"], ["member", "Stempelkarte"], ["goal", "Ziel"], ["coach", "Coach"], ["place", "Ort"], ["plan", "Wochenplan"], ["circle", "Circle"], ["group", "Gruppe"], ["day", "Workout"]];
  /* feste Werte statt aus den Daten gesammelt; „Aktiv“: gogogo = Stempelkarte aktiv, Circle = aktive Circle-Karte */
  var UF_FIXED = {
    role: ["Admin", "Zertifiziert", "Coach", "Nutzer"],
    /* gogogo = selbst mit Vorname und Login-Code angemeldet, Circle = in der App mit FFC (E-Mail und Passwort) eingeloggt (go-login-stand.sql) */
    login: ["gogogo, ohne Circle", "kein gogogo, nur Circle", "beides", "keins"],
    member: ["gogogo, ohne Circle", "kein gogogo, nur Circle", "beides aktiv", "keins aktiv"]
  };
  function roleOf(a) {
    var ci = coachInfo(String(a.account_id));
    if (ci.is_admin) return "Admin";
    if (ci.coach_verified_at) return "Zertifiziert";
    return isCoachAcc(a) ? "Coach" : "Nutzer";
  }
  function loginOf(a) {
    var ci = coachInfo(String(a.account_id));
    var go = !!ci.seen_at, circ = !!ci.ffc_seen_at;
    return go && circ ? "beides" : go ? "gogogo, ohne Circle" : circ ? "kein gogogo, nur Circle" : "keins";
  }
  function memberOf(x) {
    var go = !!(x && x.stamp);
    var circ = ((x && x.links) || []).some(function (l) { return l.kind === "circle" && l.status !== "pending"; });
    return go && circ ? "beides aktiv" : go ? "gogogo, ohne Circle" : circ ? "kein gogogo, nur Circle" : "keins aktiv";
  }
  var NONE = "\u2205";
  function berlinDay(at) {
    try { return new Date(at).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); } catch (e) { return String(at || "").slice(0, 10); }
  }
  function dayDe(iso) {
    var p = String(iso).split("-");
    return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : iso;
  }
  function facets(a) {
    var id = String(a.account_id);
    var ci = coachInfo(id);
    var x = extrasOf(id) || {};
    var ln = (st.links && st.links[id]) || {};
    var hit = ci.trainer_id ? (st.accounts || []).filter(function (q) { return String(q.account_id) === String(ci.trainer_id); })[0] : null;
    var days = {};
    hxdOf(id).forEach(function (r) { days[r.day + "|" + (r.circle_id || "")] = 1; });
    cwOf(id).forEach(function (r) { days[r.day + "|" + (r.circle_id || "")] = 1; });
    (x.doubles || []).forEach(function (d) {
      if (!d.at) return;
      var dd = berlinDay(d.at);
      if (!Object.keys(days).some(function (k) { return k.indexOf(dd + "|") === 0; })) days[dd + "|"] = 1;
    });
    return {
      role: [roleOf(a)],
      login: [loginOf(a)],
      member: [memberOf(x)],
      goal: goalText(id) ? goalText(id).split(" · ") : [],
      coach: ci.trainer_id ? [hit ? String(hit.name || "Coach").split(" ")[0] : "Coach"] : [],
      place: placeList(ci.workout_places),
      plan: x.plan && x.plan.title ? [x.plan.title] : [],
      circle: ln.circles || [],
      group: ln.groups || [],
      day: Object.keys(days)
    };
  }
  function ufValues(key) {
    if (UF_FIXED[key]) return [""].concat(UF_FIXED[key]);
    var seen = {};
    (st.accounts || []).forEach(function (a) { facets(a)[key].forEach(function (v) { seen[v] = 1; }); });
    var vals = Object.keys(seen);
    if (key === "day") vals.sort().reverse(); else vals.sort(function (p, q) { return p.localeCompare(q, "de"); });
    return [""].concat(vals, [NONE]);
  }
  function ufLabel(key, label, v) {
    if (!v) return label + ": alle";
    if (v === NONE) return label + ": ohne";
    if (key === "day") {
      var cidv = v.split("|")[1];
      var cname = cidv ? (((st.cw || []).filter(function (r) { return String(r.circle_id) === cidv; })[0] || {}).circle_name || "Circle") : "Double";
      var lab = (st.cwLabels && st.cwLabels[v]) || dayDe(v.split("|")[0]) + " · " + cname;
      return lab + (v.split("|")[0] >= todayBerlin() ? " · geplant" : "");
    }
    return v;
  }
  function ufMatch(a) {
    var f = st.uf || {};
    var fx = null;
    return UF.every(function (u) {
      var v = f[u[0]];
      if (!v) return true;
      fx = fx || facets(a);
      var have = fx[u[0]];
      return v === NONE ? !have.length : have.indexOf(v) >= 0;
    });
  }
  function ufBar(n, total) {
    var f = st.uf || {};
    var on = UF.some(function (u) { return f[u[0]]; });
    return '<div class="ga-filters is-u">' + UF.map(function (u) {
      return '<select data-ga-uf="' + u[0] + '" aria-label="' + u[1] + '"' + (f[u[0]] ? ' class="is-on"' : "") + ">" + ufValues(u[0]).map(function (v) {
        return '<option value="' + esc(v) + '"' + ((f[u[0]] || "") === v ? " selected" : "") + ">" + esc(ufLabel(u[0], u[1], v)) + "</option>";
      }).join("") + "</select>";
    }).join("") + "</div>" +
      '<p class="ga-ucount">' + n + " von " + total + " Nutzern" + (on ? ' · <button type="button" class="ga-link" data-ga-uf="reset">Filter zurücksetzen</button>' : "") +
      (f.day && f.day !== NONE && f.day.split("|")[0] >= todayBerlin() && n ? ' · <button type="button" class="ga-link" data-ga-pdfall="1">PDF für alle (' + n + ")</button>" : "") + "</p>";
  }
  function paintCoaches() {
    if (!st.coachInfo) loadCoachInfo();
    if (!st.links) loadLinks();
    if (!st.extras) loadExtras();
    if (!st.hxd) loadHxd();
    if (!st.cw) loadCw();
    if (!st.goals) loadGoals();
    var accs = (st.accounts || []).slice().sort(function (x, y) {
      if (isCoachAcc(y) !== isCoachAcc(x)) return isCoachAcc(y) ? 1 : -1;
      return String(x.name || "").localeCompare(String(y.name || ""), "de");
    });
    var nameOf = function (aid) {
      var hit = (st.accounts || []).filter(function (x) { return String(x.account_id) === String(aid); })[0];
      return hit ? String(hit.name || "").split(" ")[0] : "";
    };
    function parts(list) {
      return list.filter(Boolean).map(function (h, i) { return i ? '<span class="ga-sep"></span>' + h : h; }).join("");
    }
    var total = accs.length;
    accs = accs.filter(function (a) { return qMatch("coaches", a.account_id, a.name) && ufMatch(a); });
    return '<div class="ga-tk__top"><button type="button" class="ga-btn5 is-dark" data-ga-new="1">Neu</button></div>' +
      '<p class="cp-hint">Profilbild: alles zur Person. Pille rechts: Rolle ändern, pausieren oder löschen. Circle: Aufzeichnungen. QR: Login-Karte.</p>' + searchBar("coaches") + ufBar(accs.length, total) +
      accs.map(function (a) {
        var id = String(a.account_id);
        var ci = coachInfo(id);
        var ab = aboutOf(ci);
        var ln = (st.links && st.links[id]) || {};
        var nick = ci.nickname ? '<span class="ga-nick">@' + esc(String(ci.nickname).replace(/^@/, "")) + "</span>" : "";
        var first = esc(String(a.name || "?").split(" ")[0]);
        var r1 = parts(["<b>" + first + "</b>" + (ci.coach_verified_at ? '<span class="ga-vc"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13.1 6.6A4.6 4.6 0 1 0 13.1 13.4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></span>' : ""), nick, ci.serial_number ? "ID " + esc(ci.serial_number) : "", ci.paused_at ? "pausiert" : ""]);
        var phone = ci.whatsapp_phone || (/\d{5,}/.test(String(ci.phone || "")) ? ci.phone : "");
        var r2 = parts([ci.invite_code ? "Code " + esc(ci.invite_code) : "", esc(ab.email || ""), esc(phone || "")]);
        var goal = goalText(id);
        var x = extrasOf(id);
        var plan = x ? (x.plan && x.plan.title ? x.plan.title : "wählen") : "";
        var r3 = parts([
          '<button type="button" class="ga-link" data-ga-goal="' + esc(id) + '">' + esc(goal || "Ziel hinzufügen") + "</button>",
          ci.trainer_id ? "Coach: " + esc(nameOf(ci.trainer_id) || "ja") : "",
          x ? 'Wochenplan: <button type="button" class="ga-link" data-ga-plan="' + esc(id) + '">' + esc(plan) + "</button>" : "",
          (ln.groups || []).length ? "Gruppe: " + esc(ln.groups.join(", ")) : "Gruppe: –",
          "Circle: " + ((ln.circles || []).length ? esc(ln.circles.join(", ")) : "–")
        ]);
        var nRec = hxdOf(id).length + cwOf(id).length;
        var lg = coachInfo(id);
        var loginTxt = "Login gogogo " + (lg.seen_at ? dayDe(berlinDay(lg.seen_at)) : "–") + " · Circle " + (lg.ffc_seen_at ? dayDe(berlinDay(lg.ffc_seen_at)) : "–");
        var r5 = x ? parts([esc(loginTxt)].concat(stampLine(x).map(esc)).concat([esc(doubleLine(x, function (aid) {
          var hit = (st.accounts || []).filter(function (q) { return String(q.account_id) === String(aid); })[0];
          return hit ? String(hit.name || "").split(" ")[0] : "";
        }))])) : "";
        var pl = placeList(ci.workout_places);
        var r4 = '<button type="button" class="ga-link" data-ga-places="' + esc(id) + '">' + esc(pl.length ? pl.join(" · ") : "Ort hinzufügen") + "</button>";
        var photo = ci.photo_url || a.photo_url;
        var rect = photo ? '<img class="ga-rect" src="' + esc(photo) + '" alt="" />' : '<span class="ga-rect">' + esc(String(a.name || "?").slice(0, 1)) + "</span>";
        return '<div class="ga-item is-top' + (ci.paused_at ? " ga-paused" : "") + '"><button type="button" class="ga-rectbtn" data-ga-info="' + esc(id) + '" aria-label="Infos zu ' + esc(a.name || "") + '">' + rect + "</button>" +
          '<div class="ga-copy ga-rows"><div class="ga-r1">' + r1 + "</div>" +
          (r2 ? "<div>" + r2 + "</div>" : "") + "<div>" + r3 + "</div><div>" + r4 + "</div>" + (r5 ? "<div>" + r5 + "</div>" : "") + "</div>" +
          '<span class="ga-pills">' + (nRec ? '<button type="button" class="ga-pill" data-ga-rec="' + esc(id) + '" aria-label="Circle-Aufzeichnungen">Circle</button>' : "") + rolePill(a) + '<button type="button" class="ga-pill" data-ga-qr="' + esc(id) + '">QR-Code</button>' + "</span></div>";
      }).join("");
  }
  /* Circle-Aufzeichnungen eines Nutzers im Design der App (Datumsrad, Punkte, Runden); Stift = Werte nachpflegen */
  function openRec(id, pick, editing) {
    var rows = global.GoHyroxDoubles ? hxdOf(id) : [];
    var fut = cwFuture(id);
    if (!rows.length && !fut.length) return;
    var H = global.GoHyroxDoubles;
    var a = (st.accounts || []).filter(function (q) { return String(q.account_id) === String(id); })[0] || {};
    var idx = 0;
    rows.forEach(function (r, i) { if (String(r.id) === String(pick)) idx = i; });
    function labelOf(r) {
      var names = String(r.team || "").split(/\s*&\s*/);
      var me = (r.account_ids || []).map(String).indexOf(String(id));
      var partner = names[me === 0 ? 1 : 0] || "";
      return dayDe(r.day) + " · " + (r.title || "HYROX Double") + (partner ? " mit " + partner : "");
    }
    var box = document.createElement("div");
    box.className = "ga-info ga-rec";
    box.innerHTML = '<div class="ga-info__card go-slide__ffc-plain" role="dialog" aria-modal="true"><p class="ga-info__name" style="text-align:center">' + esc(String(a.name || "").split(" ")[0]) + "</p>" +
      (rows.length ? '<div class="go-rec-wheel"><div class="go-rec-wheel__mark"></div><div class="go-rec-wheel__col">' + rows.map(function (r, i) {
        return '<button type="button" class="go-rec-wheel__item' + (i === idx ? " is-on" : "") + '" data-idx="' + i + '">' + esc(labelOf(r)) + "</button>";
      }).join("") + '</div></div><div class="go-rec-detail"></div>' : '<p class="cp-hint" style="text-align:center">Noch keine Aufzeichnung.</p>') +
      (fut.length ? '<p class="ga-h3">Anstehend</p>' + fut.map(function (r) {
        return '<div class="ga-rec__next"><span>' + esc(shortDay(r.starts_at)) + ", " + esc(new Date(r.starts_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })) + "</span><span>" + esc(r.circle_name || "") + " · " + (r.mode === "double" ? "Double" : "Single") + "</span></div>";
      }).join("") : "") +
      '<div class="ga-info__btns">' + (fut.length ? '<button type="button" class="is-dark" data-rec-pdf="1">PDF exportieren</button>' : "") +
      '<button type="button" class="is-quiet" data-gi-close="1">Schließen</button></div></div>';
    document.body.appendChild(box);
    var col = box.querySelector(".go-rec-wheel__col");
    var detail = box.querySelector(".go-rec-detail");
    var pen = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>';
    function show(i) {
      idx = i;
      var cur = rows[i];
      Array.prototype.forEach.call(col.children, function (el, k) { el.classList.toggle("is-on", k === i); });
      var pl = H.plan(cur);
      var sc = H.score(cur);
      var work = Number(cur.work_sec) || 360;
      detail.innerHTML = '<div class="go-rec-detail__head"><span>' + esc(labelOf(cur)) + '</span><button type="button" class="go-rec-detail__pen' + (editing ? " is-on" : "") + '" data-rec-pen="1" aria-label="' + (editing ? "Bearbeiten beenden" : "Werte bearbeiten") + '">' + pen + "</button></div>" +
        '<div class="go-rec-detail__pts">' + esc(sc.total.toLocaleString("de-DE")) + " Punkte</div>" +
        '<div class="go-rec-detail__meta">' + Math.floor(work / 60) + ":" + String(work % 60).padStart(2, "0") + " Workout ohne Laufen · " + pl.length + " Runden · " + esc(cur.category) + "</div>" +
        pl.map(function (s, k) {
          var txt = esc(H.valueText(s) + (s.points != null ? " · " + s.points + " P" : ""));
          return '<div class="go-rec-round"><div class="go-rec-round__head">Runde ' + (k + 1) + '</div><div class="go-rec-detail__row"><span>' + esc(s.label) + "</span>" +
            (editing ? '<button type="button" class="go-rec-detail__edit' + (s.value == null ? " is-empty" : "") + '" data-rec-edit="' + esc(s.key) + '">' + txt + "</button>" : "<span>" + txt + "</span>") + "</div></div>";
        }).join("") +
        (editing && !H.EVENTS[cur.day] ? '<button type="button" class="go-rec-detail__story" data-rec-add="1">Station nachtragen</button>' : "");
    }
    function center(smooth) {
      var el = col.children[idx];
      if (!el) return;
      var top = Math.max(0, el.offsetTop - (col.clientHeight - el.offsetHeight) / 2);
      if (smooth && col.scrollTo) col.scrollTo({ top: top, behavior: "smooth" }); else col.scrollTop = top;
    }
    if (rows.length) {
      show(idx);
      requestAnimationFrame(function () { center(false); });
    }
    if (col) col.addEventListener("scroll", function () {
      var mid = col.scrollTop + col.clientHeight / 2, best = idx, dist = Infinity;
      Array.prototype.forEach.call(col.children, function (el, k) {
        var d = Math.abs(el.offsetTop + el.offsetHeight / 2 - mid);
        if (d < dist) { dist = d; best = k; }
      });
      if (best !== idx) show(best);
    }, { passive: true });
    function close() { box.remove(); }
    function save(results) {
      var cur = rows[idx];
      return host.rest("go_hyrox_doubles?id=eq." + encodeURIComponent(cur.id), { method: "PATCH", prefer: "return=minimal", body: { results: results } })
        .then(function () { cur.results = results; show(idx); paint(); if (host.toast) host.toast("Gespeichert"); })
        .catch(function () { GoDialog.alert("Speichern ging nicht (go-hyrox-doubles.sql ausgeführt?)"); });
    }
    /* Runden-Stationen (Farmers 25 m, Lunges 4,5 m): Eingabe in Runden, gespeichert wird das Ergebnis in Metern */
    function ask(key) {
      var cur = rows[idx];
      var ref = H.REFS[key];
      var have = (cur.results || {})[key];
      var q = ref.per ? ref.label + ": Runden (je " + String(ref.per).replace(".", ",") + " m)" : ref.label + " in " + ref.unit;
      var start = have == null ? "" : String(ref.per ? Math.round(have / ref.per * 10) / 10 : have).replace(".", ",");
      return GoDialog.prompt(q, start, { ok: "Speichern" }).then(function (v) {
        if (v == null) return;
        var res = Object.assign({}, cur.results || {});
        v = String(v).replace(",", ".").trim();
        if (v === "") delete res[key];
        else if (!(Number(v) >= 0)) { GoDialog.alert("Bitte eine Zahl eingeben."); return; }
        else res[key] = ref.per ? Math.round(Number(v) * ref.per * 10) / 10 : Number(v);
        return save(res);
      });
    }
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest("[data-gi-close]")) { close(); return; }
      if (e.target.closest("[data-rec-pdf]")) {
        var pickEv = fut.length === 1 ? Promise.resolve(fut[0].day + "|" + (fut[0].circle_id || "")) :
          GoDialog.choose("Welches Workout?", fut.map(function (r) { return { label: shortDay(r.starts_at) + " · " + (r.circle_name || ""), value: r.day + "|" + (r.circle_id || "") }; }), { cancel: "Abbrechen" });
        pickEv.then(function (k) { if (k) exportSheets([id], k); });
        return;
      }
      var it = e.target.closest(".go-rec-wheel__item");
      if (it) { show(Number(it.getAttribute("data-idx")) || 0); center(true); return; }
      if (e.target.closest("[data-rec-pen]")) { editing = !editing; show(idx); return; }
      var ed = e.target.closest("[data-rec-edit]");
      if (ed) { ask(ed.getAttribute("data-rec-edit")); return; }
      if (e.target.closest("[data-rec-add]")) {
        var have = rows[idx].results || {};
        var opts = Object.keys(H.REFS).filter(function (k) { return have[k] == null; })
          .map(function (k) { return { label: H.REFS[k].label, value: k }; });
        GoDialog.choose("Station nachtragen", opts, { cancel: "Abbrechen" }).then(function (k) { if (k) ask(k); });
      }
    });
  }
  /* Wochenplan setzen oder entfernen (z. B. wenn der Coach jemanden aus seinen Coachees genommen hat) */
  var WD = [[1, "Mo"], [2, "Di"], [3, "Mi"], [4, "Do"], [5, "Fr"], [6, "Sa"], [0, "So"]];
  function userPlan(id) {
    var x = extrasOf(id) || {};
    var cur = x.plan || null;
    var a = (st.accounts || []).filter(function (q) { return String(q.account_id) === String(id); })[0] || {};
    var first = String(a.name || "Nutzer").split(" ")[0];
    /* nur Wochenpläne (mehrere Tage), keine Einzel-Events */
    host.rest("courses?is_active=eq.true&sessions_per_week=gt.1&deleted_at=is.null&or=(private_for.is.null,private_for.eq." + encodeURIComponent(id) + ")&select=id,title&order=title.asc&limit=200")
      .catch(function () { return host.rest("courses?is_active=eq.true&sessions_per_week=gt.1&select=id,title&order=title.asc&limit=200"); })
      .then(function (rows) {
        var items = (rows || []).filter(function (c) { return c && c.id && !/^zirkeltraining$/i.test(String(c.title || "")); })
          .map(function (c) { return { label: String(c.title || "Plan") + (cur && String(cur.course_id) === String(c.id) ? " ✓" : ""), value: String(c.id) }; });
        if (cur) items.unshift({ label: "Wochenplan entfernen", value: "none" });
        return GoDialog.choose("Wochenplan für " + first, items, { center: true, sub: cur ? "Aktuell: " + cur.title : "Noch kein Wochenplan", cancel: "Abbrechen" });
      })
      .then(function (v) {
        if (!v) return;
        if (v === "none") {
          return GoDialog.confirm("Wochenplan „" + cur.title + "“ bei " + first + " entfernen? Künftige Plan-Termine fallen weg.", { ok: "Entfernen", cancel: "Abbrechen", row: true })
            .then(function (ok) { if (ok) return savePlan(id, null, null); });
        }
        var days = (cur && cur.weekdays) || [];
        return GoDialog.pick("An welchen Tagen?", WD.map(function (d) { return { label: d[1], value: String(d[0]), checked: days.indexOf(d[0]) >= 0 }; }), { ok: "Speichern", cancel: "Abbrechen" })
          .then(function (picked) {
            if (!picked) return;
            if (!picked.length) { GoDialog.alert("Wähle mindestens einen Tag."); return; }
            return savePlan(id, v, picked.map(Number));
          });
      });
  }
  function savePlan(id, course, days) {
    return host.rest("rpc/go_admin_set_plan", { method: "POST", body: { p_account: id, p_course: course, p_weekdays: days } })
      .then(function () { if (host.toast) host.toast(course ? "Wochenplan gesetzt" : "Wochenplan entfernt"); loadExtras(); })
      .catch(function () { GoDialog.alert("Das braucht go-admin-user-extras.sql in Supabase."); });
  }
  /* Nutzer-Pille: Löschen / Pausieren */
  /* Admin-Rechte (oberste Rolle), z. B. für GbR-Mitglieder; sich selbst nicht entziehen */
  function setAdmin(id, on) {
    var a = (st.accounts || []).filter(function (x) { return String(x.account_id) === String(id); })[0] || {};
    var name = a.name || "Diese Person";
    return GoDialog.confirm(on ? name + " zum Admin machen? Admins sehen und ändern alles hier im Admin." : name + " die Admin-Rechte entziehen?", { ok: on ? "Admin machen" : "Entziehen", cancel: "Abbrechen" })
      .then(function (yes) {
        if (!yes) return;
        return host.rest("rpc/go_admin_set_admin", { method: "POST", body: { p_account: id, p_on: on } }).then(function () {
          (st.coachInfo[String(id)] || (st.coachInfo[String(id)] = {})).is_admin = on;
          paint();
          if (host.toast) host.toast(on ? name + " ist jetzt Admin" : name + " ist kein Admin mehr");
        }).catch(function (e) {
          var m = String((e && e.message) || "");
          GoDialog.alert(/last_admin/.test(m) ? "Es muss mindestens ein Admin bleiben." : /self/.test(m) ? "Dir selbst kannst Du die Rechte nicht entziehen." : "Das braucht go-admin-tickets.sql in Supabase.");
        });
      });
  }
  function adminMenu(id) {
    var a = (st.accounts || []).filter(function (x) { return String(x.account_id) === String(id); })[0] || {};
    if (String(id) === String(me())) { GoDialog.alert("Das bist Du. Admin-Rechte entzieht Dir nur ein anderer Admin."); return; }
    GoDialog.choose(a.name || "Admin", [{ label: "Admin-Rechte entziehen", value: "off" }], { center: true, cancel: "Abbrechen" })
      .then(function (v) { if (v === "off") setAdmin(id, false); });
  }
  function userMenu(id) {
    var a = (st.accounts || []).filter(function (x) { return String(x.account_id) === String(id); })[0] || {};
    var ci = coachInfo(id);
    var name = a.name || "Diese Person";
    var items = [];
    if (id !== String(me()) && ADMIN_IDS.indexOf(id) === -1) items.push({ label: "Löschen", value: "del" });
    items.push({ label: ci.paused_at ? "Fortsetzen" : "Pausieren", value: "pause" });
    items.push({ label: "Zum Admin machen", value: "admin" });
    GoDialog.choose(name, items, { center: true, sub: ci.paused_at ? "Pausiert: keine WhatsApp-Erinnerung." : "", cancel: "Abbrechen" }).then(function (v) {
      if (v === "del") {
        var fake = document.createElement("button");
        fake.setAttribute("data-ga-del", id);
        deleteAccount(fake);
        return;
      }
      if (v === "admin") { setAdmin(id, true); return; }
      if (v !== "pause") return;
      var on = !ci.paused_at;
      host.rest("rpc/go_admin_pause_account", { method: "POST", body: { p_account: id, p_on: on } })
        .then(function () {
          (st.coachInfo[String(id)] || (st.coachInfo[String(id)] = {})).paused_at = on ? new Date().toISOString() : null;
          paint();
          if (host.toast) host.toast(on ? name + " pausiert" : name + " ist wieder aktiv");
        })
        .catch(function () { GoDialog.alert("Pausieren braucht go-admin-circles.sql in Supabase."); });
    });
  }
  /* Coach-Pille: Entziehen / Verifiziert (blaues c an oder aus) */
  function roleMenu(id) {
    var a = (st.accounts || []).filter(function (x) { return String(x.account_id) === String(id); })[0] || {};
    var ci = coachInfo(id);
    var name = a.name || "Coach";
    GoDialog.choose(name, [
      { label: "Coach-Rolle entziehen", value: "revoke" },
      { label: ci.coach_verified_at ? "Verifiziert ✓ (blaues c entfernen)" : "Verifizieren (blaues c)", value: ci.coach_verified_at ? "unverify" : "verify" },
      { label: "Zum Admin machen", value: "admin" }
    ], { center: true, cancel: "Abbrechen" }).then(function (mode) {
      if (!mode) return;
      if (mode === "admin") { setAdmin(id, true); return; }
      host.rest("rpc/go_admin_coach_role", { method: "POST", body: { p_account: id, p_mode: mode } })
        .then(function () {
          var c = st.coachInfo[String(id)] || (st.coachInfo[String(id)] = {});
          if (mode === "verify") { c.coach_verified_at = new Date().toISOString(); c.coach_self_at = c.coach_self_at || c.coach_verified_at; a.is_trainer = true; }
          if (mode === "unverify") c.coach_verified_at = null;
          if (mode === "revoke") { c.coach_verified_at = null; c.coach_self_at = null; a.is_trainer = false; }
          paint();
          if (host.toast) host.toast(mode === "verify" ? "Blaues c vergeben" : mode === "unverify" ? "Blaues c entfernt" : "Coach-Rolle entzogen");
        })
        .catch(function () { GoDialog.alert("Das braucht go-admin-circles.sql in Supabase."); });
    });
  }

  /* ---------- Circles und Gruppen: gleiche Liste ----------
     Circles: go-admin-circles.sql · Gruppen: go-admin-groups.sql */
  var ORG = {
    circle: { list: "go_admin_circles", sql: "go-admin-circles.sql", label: "Circle", fallback: "/assets/gogogo/gogogo-Zirkeltraining.jpg" },
    group: { list: "go_admin_groups", sql: "go-admin-groups.sql", label: "Gruppe", fallback: "/assets/gogogo/personaltraining-1600.webp" }
  };
  function orgState(kind) { st.orgs = st.orgs || {}; return st.orgs[kind]; }
  function loadOrgs(kind) {
    st.orgs = st.orgs || {};
    st.orgs[kind] = "loading";
    return host.rest("rpc/" + ORG[kind].list, { method: "POST", body: {} })
      .then(function (rows) {
        if (!st) return;
        /* Altlast ohne Ersteller und ohne Mitglieder (z. B. „Joschas Kreis“, an der alten Tabelle users) ausblenden */
        if (kind === "group") rows = (rows || []).filter(function (g) { return (g.owner && g.owner.id) || (g.members || []).length; });
        st.orgs[kind] = rows || [];
        paint();
      })
      .catch(function () { if (st) { st.orgs[kind] = "error"; paint(); } });
  }
  function orgById(kind, gid) {
    var l = orgState(kind);
    return (Array.isArray(l) ? l : []).filter(function (c) { return String(c.group_id) === String(gid); })[0];
  }
  function shortDay(at) {
    var d = new Date(at);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).replace(/,/, "");
  }
  function sqlHint(kind) { GoDialog.alert("Das braucht " + ORG[kind].sql + " in Supabase."); }
  function paintOrgs(kind) {
    var l = orgState(kind);
    if (l === "error") return '<p class="cp-hint">Liste nicht geladen. Ist ' + ORG[kind].sql + " in Supabase ausgeführt?</p>";
    if (!l) { loadOrgs(kind); return '<p class="cp-hint">Lade…</p>'; }
    if (l === "loading") return '<p class="cp-hint">Lade…</p>';
    st.cfs = st.cfs || {};
    var cf = st.cfs[kind] || (st.cfs[kind] = { loc: "", coach: "" });
    var locs = {}, coaches = {};
    l.forEach(function (c) {
      (c.locations || []).forEach(function (x) { locs[x] = 1; });
      if (c.owner && c.owner.id) coaches[c.owner.id] = c.owner.name || "Coach";
    });
    var list = l.filter(function (c) {
      if (cf.loc && (c.locations || []).indexOf(cf.loc) < 0) return false;
      if (cf.coach && !(c.owner && String(c.owner.id) === cf.coach)) return false;
      return true;
    });
    var filters = '<div class="ga-filters">' +
      '<select data-ga-cf="loc" data-gk="' + kind + '" aria-label="Ort"><option value="">Alle Orte</option>' + Object.keys(locs).sort().map(function (x) {
        return '<option value="' + esc(x) + '"' + (cf.loc === x ? " selected" : "") + ">" + esc(x) + "</option>";
      }).join("") + "</select>" +
      '<select data-ga-cf="coach" data-gk="' + kind + '" aria-label="Coach"><option value="">Alle Coaches</option>' + Object.keys(coaches).map(function (id) {
        return '<option value="' + esc(id) + '"' + (cf.coach === id ? " selected" : "") + ">" + esc(coaches[id]) + "</option>";
      }).join("") + "</select></div>";
    if (!l.length) return '<p class="cp-hint">' + (kind === "circle" ? "Noch keine Circles. Sie erscheinen, sobald Mitglieder die App mit ihrem Circle öffnen." : "Noch keine Gruppen.") + "</p>";
    function btn(act, gid, html) { return '<button type="button" class="ga-link" data-gx="' + act + '" data-gk="' + kind + '" data-gid="' + esc(gid) + '">' + html + "</button>"; }
    return filters + list.map(function (c) {
      var gid = c.group_id;
      var img = c.photo_url || ORG[kind].fallback;
      var coach = c.owner && c.owner.id ? "Coach: " + btn("coach", gid, esc(String(c.owner.name || "Coach").split(" ")[0])) : btn("coach", gid, "Coach hinzufügen");
      var mem = (c.members || []).map(function (m) {
        var mark = m.source === "admin" ? "*" : m.status && m.status !== "accepted" ? " (offen)" : "";
        return '<button type="button" class="ga-link" data-gx="member" data-gk="' + kind + '" data-gid="' + esc(m.id) + '">' + esc(String(m.name || "?").split(" ")[0]) + "</button>" + mark;
      }).join(", ");
      var places = btn("places", gid, esc((c.locations || []).length ? c.locations.join(", ") : "Ort hinzufügen")) + (c.online ? " · online möglich" : "");
      var last = (c.last || []).map(function (x) { return esc(shortDay(x.at)) + " · " + esc(String(x.n)) + " dabei"; }).join(", ");
      return '<div class="ga-item is-top ga-circ"><button type="button" class="ga-rectbtn" data-gx="photo" data-gk="' + kind + '" data-gid="' + esc(gid) + '" aria-label="Bild"><img class="ga-cimg" src="' + esc(img) + '" alt="" /></button>' +
        '<div class="ga-copy ga-rows"><div class="ga-r1"><b>' + esc(c.name || ORG[kind].label) + "</b></div>" +
        "<div>" + coach + "</div>" +
        "<div>Mitglieder: " + (mem || "–") + "</div>" +
        "<div>Orte: " + places + "</div>" +
        "<div>Zuletzt: " + (last || "–") + "</div></div>" +
        '<button type="button" class="ga-pill" data-gx="add" data-gk="' + kind + '" data-gid="' + esc(gid) + '">Teilnehmer hinzufügen</button></div>';
    }).join("") + (kind === "circle" ? '<p class="cp-hint">* vom Admin hinzugefügt. Im FFC-Leaderboard erscheinen sie, sobald sie dem Circle in FFC beigetreten sind (die App versucht das beim nächsten Öffnen).</p>' : '<p class="cp-hint">Höchstens 10 Mitglieder je Gruppe.</p>');
  }
  function orgCoach(kind, gid) {
    var c = orgById(kind, gid);
    if (!c) return;
    var coaches = (st.accounts || []).filter(isCoachAcc).sort(function (x, y) { return String(x.name || "").localeCompare(String(y.name || ""), "de"); });
    var items = coaches.map(function (a) { return { label: String(a.name || "Coach") + (c.owner && String(c.owner.id) === String(a.account_id) ? " ✓" : ""), value: String(a.account_id) }; });
    if (kind === "circle" && c.owner && c.owner.id) items.unshift({ label: "Coach entfernen", value: "none" });
    GoDialog.choose("Coach von " + (c.name || ORG[kind].label), items, { center: true, cancel: "Abbrechen" }).then(function (v) {
      if (!v) return;
      var rpc = kind === "circle" ? "go_admin_set_circle_coach" : "go_admin_set_group_owner";
      host.rest("rpc/" + rpc, { method: "POST", body: { p_group: String(gid), p_account: v === "none" ? null : v } })
        .then(function () { if (host.toast) host.toast(v === "none" ? "Coach entfernt" : "Coach gesetzt"); return loadOrgs(kind); })
        .catch(function () { sqlHint(kind); });
    });
  }
  /* Orte bearbeiten: Liste (Tippen entfernt), Ort hinzufügen über den Ortswähler mit Karte */
  function editPlaces(title, locs, opts, save) {
    var items = locs.map(function (x) { return { label: "✕ " + x, value: "rm:" + x }; });
    if (locs.length < 12) items.push({ label: "Ort hinzufügen", value: "add" });
    if (opts.online != null) items.push({ label: opts.online ? "Online möglich: ja" : "Online möglich: nein", value: "online" });
    GoDialog.choose(title, items, { center: true, sub: locs.length ? "Tippen auf einen Ort entfernt ihn." : "Noch kein Ort.", cancel: "Fertig" }).then(function (v) {
      if (!v) return;
      if (v === "online") return save(locs, !opts.online);
      if (v.indexOf("rm:") === 0) return save(locs.filter(function (x) { return x !== v.slice(3); }), opts.online);
      if (v === "add" && global.goPickPlace) {
        return global.goPickPlace("Ort hinzufügen").then(function (name) {
          if (!name || locs.some(function (x) { return x.toLowerCase() === name.toLowerCase(); })) return save(locs, opts.online);
          return save(locs.concat([name]), opts.online);
        });
      }
    });
  }
  function orgPlaces(kind, gid) {
    var c = orgById(kind, gid);
    if (!c) return;
    editPlaces("Orte von " + (c.name || ORG[kind].label), (c.locations || []).slice(), { online: kind === "circle" ? !!c.online : null }, function (next, online) {
      var req = kind === "circle"
        ? host.rest("rpc/go_admin_save_circle_places", { method: "POST", body: { p_group: String(gid), p_locations: next, p_online: !!online } })
        : host.rest("rpc/go_admin_save_group_places", { method: "POST", body: { p_group: String(gid), p_locations: next } });
      return req.then(function () {
        c.locations = next;
        if (kind === "circle") c.online = !!online;
        paint();
        setTimeout(function () { orgPlaces(kind, gid); }, 0);
      }).catch(function () { sqlHint(kind); });
    });
  }
  function userPlaces(id) {
    var ci = coachInfo(id);
    var a = (st.accounts || []).filter(function (x) { return String(x.account_id) === String(id); })[0] || {};
    editPlaces("Orte von " + String(a.name || "Nutzer").split(" ")[0], placeList(ci.workout_places), { online: null }, function (next) {
      return host.rest("rpc/go_admin_update_account", { method: "POST", body: { p_account: id, p_places: next } })
        .then(function () {
          (st.coachInfo[String(id)] || (st.coachInfo[String(id)] = {})).workout_places = next;
          paint();
          setTimeout(function () { userPlaces(id); }, 0);
        })
        .catch(function () { GoDialog.alert("Das braucht go-admin-groups.sql in Supabase."); });
    });
  }
  /* Foto ändern: Geräte-Auswahl öffnet sich, Bild wird komprimiert gespeichert */
  function pickPhoto(onUrl) {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      if (host.toast) host.toast("Foto wird gespeichert …");
      if (global.goCompressPhoto) global.goCompressPhoto(f, function (url) { if (url) onUrl(url); });
      else {
        var r = new FileReader();
        r.onload = function () { onUrl(String(r.result || "")); };
        r.readAsDataURL(f);
      }
    });
    inp.click();
  }
  /* Bild groß mit Stift (Circles und Gruppen) */
  function orgPhoto(kind, gid) {
    var c = orgById(kind, gid);
    if (!c) return;
    var box = document.createElement("div");
    box.className = "ga-info";
    box.innerHTML = '<div class="ga-info__card" role="dialog" aria-modal="true"><div class="ga-photo"><img src="' + esc(c.photo_url || ORG[kind].fallback) + '" alt="" />' +
      '<button type="button" class="ga-pen" data-gp-pen="1" aria-label="Foto ändern">' + PEN + "</button></div>" +
      '<p class="ga-info__name" style="text-align:center">' + esc(c.name || ORG[kind].label) + "</p>" +
      '<div class="ga-info__btns"><button type="button" class="is-quiet" data-gi-close="1">Schließen</button></div></div>';
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest("[data-gi-close]")) { box.remove(); return; }
      if (!e.target.closest("[data-gp-pen]")) return;
      pickPhoto(function (url) {
        var req = kind === "circle"
          ? host.rest("rpc/go_set_circle_photo", { method: "POST", body: { p_group: String(gid), p_url: url } })
          : host.rest("rpc/go_admin_set_group_photo", { method: "POST", body: { p_group: String(gid), p_url: url } });
        req.then(function () {
          c.photo_url = url;
          var im = box.querySelector(".ga-photo img");
          if (im) im.src = url;
          paint();
          if (host.toast) host.toast("Foto gespeichert");
        }).catch(function () { sqlHint(kind); });
      });
    });
  }
  function orgAdd(kind, gid) {
    var c = orgById(kind, gid);
    if (!c) return;
    var have = {};
    (c.members || []).forEach(function (m) { have[String(m.id)] = 1; });
    if (c.owner && c.owner.id) have[String(c.owner.id)] = 1;
    host.rest("go_accounts?select=id,name&order=name.asc&limit=1000").catch(function () { return st.accounts.map(function (a) { return { id: a.account_id, name: a.name }; }); })
      .then(function (rows) {
        var items = (rows || []).filter(function (r) { return r && r.id && !have[String(r.id)]; })
          .map(function (r) { return { label: r.name || "?", value: String(r.id) }; });
        return GoDialog.pick("Teilnehmer hinzufügen zu " + (c.name || ORG[kind].label), items, { ok: "Hinzufügen", cancel: "Abbrechen", empty: "Alle Nutzer sind schon dabei." });
      })
      .then(function (ids) {
        if (!ids || !ids.length) return;
        var rpc = kind === "circle" ? "go_admin_add_circle_members" : "go_admin_add_group_members";
        return host.rest("rpc/" + rpc, { method: "POST", body: { p_group: String(gid), p_ids: ids } })
          .then(function () { if (host.toast) host.toast(ids.length + " Teilnehmer hinzugefügt"); return loadOrgs(kind); })
          .catch(function (err) {
            if (/group_full/.test(String((err && err.message) || ""))) GoDialog.alert("Die Gruppe ist voll (höchstens 10 Mitglieder).");
            else sqlHint(kind);
          });
      });
  }

  /* ---------- Tickets (go-admin-tickets.sql): Änderungswünsche sammeln und zum Kopieren für Claude ---------- */
  var TK_AREAS = {
    frontend: { label: "Frontend", sections: {
      "Aktuell-Feed": ["Feed-Karten", "Filter", "Herz und Kommentare", "Bubble-Chat", "Mitteilungen", "Posten"],
      "Woche": ["Wochen-Reels", "Wochenplan wählen", "Events und Termine", "Kalender", "Tagebuch", "Trainingslog"],
      "Team": ["Coach", "Gruppe", "Gesichter", "Einladen", "Stempelkarte"],
      "Plus": ["Inhaltsverzeichnis", "Ernährung", "Friday Fitness Circle", "Leaderboard", "Aufzeichnungen", "HYROX Doubles", "Circle verwalten", "Buchungen"],
      "Profil": ["Foto", "Ziele", "Orte", "Login", "WhatsApp-Erinnerung", "Datenschutz", "Coach werden"],
      "Allgemein": ["Navigation und Pille", "Onboarding", "Design", "Geschwindigkeit", "PWA und Installation"]
    } },
    backend: { label: "Backend", sections: {
      "Nachrichten": ["Liste", "Filter", "Gemeldet", "Mitteilung an alle"],
      "Erinnerungen": ["WhatsApp-Texte", "Zeitpunkt", "Liste"],
      "Nutzer": ["Liste", "Filter", "Rollen", "Wochenplan", "Circle-Aufzeichnungen", "Stempelkarte", "Profil-Infos"],
      "Editor": ["Wochenpläne", "Events", "Übungen", "Videos"],
      "Social Media Links": ["Freigabe", "Liste"],
      "Circles": ["Liste", "Coach", "Teilnehmer", "Orte", "Foto"],
      "Gruppen": ["Liste", "Coach", "Teilnehmer", "Orte", "Foto"],
      "Tickets": ["Liste", "Formular"],
      "Datenbank": ["Tabellen", "Rechte", "Import", "Auswertung"]
    } }
  };
  var TK_STATUS = ["offen", "in Arbeit", "erledigt"];
  function loadTickets() {
    st.tickets = "loading";
    return host.rest("go_tickets?select=*&order=id.desc&limit=500")
      .then(function (r) { if (st) { st.tickets = r || []; paint(); } })
      .catch(function () { if (st) { st.tickets = "missing"; paint(); } });
  }
  function tkWhen(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) + ", " +
      d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  }
  function tkPath(t) { return [(TK_AREAS[t.area] || {}).label || t.area, t.section, t.sub].filter(Boolean).join(" › "); }
  function tkText(t) {
    return "Ticket #" + t.id + " · " + tkWhen(t.created_at) + " · " + (t.created_name || "?") + " · Status: " + t.status + "\n" + tkPath(t) + "\n" + t.body;
  }
  function tkSelect(id, label, opts, cur) {
    return '<label class="ga-tk__l">' + esc(label) + '<select id="' + id + '">' + opts.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + "</select></label>";
  }
  function tkForm() {
    var d = st.tkDraft || (st.tkDraft = { area: "frontend", section: "", sub: "", body: "" });
    var secs = Object.keys(TK_AREAS[d.area].sections);
    if (secs.indexOf(d.section) < 0) d.section = secs[0];
    var subs = TK_AREAS[d.area].sections[d.section].concat(["Sonstiges"]);
    if (subs.indexOf(d.sub) < 0) d.sub = subs[0];
    return '<div class="ga-tk__form">' +
      '<div class="ga-tk__row">' + tkSelect("gt-area", "Bereich", Object.keys(TK_AREAS).map(function (k) { return [k, TK_AREAS[k].label]; }), d.area) +
      tkSelect("gt-sec", d.area === "frontend" ? "Abschnitt" : "Admin-Bereich", secs.map(function (x) { return [x, x]; }), d.section) +
      tkSelect("gt-sub", "Unterkategorie", subs.map(function (x) { return [x, x]; }), d.sub) + "</div>" +
      '<label class="ga-tk__l">Wunsch<textarea id="gt-body" rows="4" placeholder="Was soll sich wo ändern?">' + esc(d.body) + "</textarea></label>" +
      '<div class="ga-tk__btns"><button type="button" class="ga-btn5" data-gt="cancel">Abbrechen</button><button type="button" class="ga-btn5 is-dark" data-gt="save">Ticket speichern</button></div></div>';
  }
  function paintTickets() {
    if (!st.tickets) { loadTickets(); return '<p class="cp-hint">Lädt …</p>'; }
    if (st.tickets === "loading") return '<p class="cp-hint">Lädt …</p>';
    if (st.tickets === "missing") return '<p class="cp-hint">Tickets brauchen go-admin-tickets.sql in Supabase.</p>';
    var all = st.tickets;
    var f = nfOf("tickets");
    var list = all.filter(function (t) {
      if (f.status && t.status !== f.status) return false;
      if (f.area && t.area !== f.area) return false;
      if (f.section && t.section !== f.section) return false;
      if (f.who && (t.created_name || "") !== f.who) return false;
      return true;
    });
    var secs = uniq(all.map(function (t) { return t.section; }));
    var open = list.filter(function (t) { return t.status !== "erledigt"; });
    return (st.tkNew ? tkForm() : '<div class="ga-tk__top"><button type="button" class="ga-btn5 is-dark" data-gt="new">Neues Ticket</button>' +
        (open.length ? '<button type="button" class="ga-btn5" data-gt="copyall">' + open.length + " offen kopieren</button>" : "") + "</div>") +
      selBar("tickets", [
        ["status", "Status", TK_STATUS.map(function (x) { return [x, x]; })],
        ["area", "Bereich", Object.keys(TK_AREAS).map(function (k) { return [k, TK_AREAS[k].label]; })],
        ["section", "Abschnitt", secs.map(function (x) { return [x, x]; })],
        ["who", "Von", uniq(all.map(function (t) { return t.created_name || ""; })).map(function (x) { return [x, x]; })]
      ], list.length, all.length, "Tickets") +
      (list.length ? list.map(function (t) {
        return '<div class="ga-tk' + (t.status === "erledigt" ? " is-done" : "") + '">' +
          '<div class="ga-tk__head"><b>#' + t.id + "</b><span>" + esc(tkWhen(t.created_at)) + " · " + esc(t.created_name || "?") + "</span>" +
          '<select data-gt-status="' + t.id + '" aria-label="Status">' + TK_STATUS.map(function (x) { return '<option' + (x === t.status ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div>" +
          '<p class="ga-tk__path">' + esc(tkPath(t)) + "</p>" +
          '<p class="ga-tk__body">' + esc(t.body) + "</p>" +
          '<div class="ga-tk__acts"><button type="button" class="ga-link" data-gt="copy" data-gt-id="' + t.id + '">Kopieren</button>' +
          '<button type="button" class="ga-link" data-gt="del" data-gt-id="' + t.id + '">Löschen</button></div></div>';
      }).join("") : '<p class="cp-hint">' + (all.length ? "Nichts gefunden." : "Noch keine Tickets.") + "</p>");
  }
  function tkCopy(text) {
    function done() { if (host.toast) host.toast("Kopiert"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { GoDialog.prompt("Kopieren", text); });
    } else GoDialog.prompt("Kopieren", text);
  }
  function ticketAction(t) {
    var act = t.getAttribute("data-gt");
    var id = Number(t.getAttribute("data-gt-id"));
    var tk = (Array.isArray(st.tickets) ? st.tickets : []).filter(function (x) { return x.id === id; })[0];
    if (act === "new") { st.tkNew = true; paint(); return; }
    if (act === "cancel") { st.tkNew = false; st.tkDraft = null; paint(); return; }
    if (act === "copy" && tk) { tkCopy(tkText(tk)); return; }
    if (act === "copyall") {
      var f = nfOf("tickets");
      var open = st.tickets.filter(function (x) { return x.status !== "erledigt" && (!f.area || x.area === f.area) && (!f.section || x.section === f.section) && (!f.status || x.status === f.status) && (!f.who || x.created_name === f.who); });
      tkCopy(open.slice().reverse().map(tkText).join("\n\n"));
      return;
    }
    if (act === "del" && tk) {
      GoDialog.confirm("Ticket #" + tk.id + " löschen?", { ok: "Löschen", cancel: "Abbrechen" }).then(function (yes) {
        if (!yes) return;
        host.rest("go_tickets?id=eq." + tk.id, { method: "DELETE", prefer: "return=minimal" }).then(loadTickets)
          .catch(function () { GoDialog.alert("Löschen ging nicht."); });
      });
      return;
    }
    if (act === "save") {
      var d = st.tkDraft;
      d.body = (document.getElementById("gt-body") || {}).value || "";
      if (!d.body.trim()) { GoDialog.alert("Bitte den Wunsch eintragen."); return; }
      var mine = (st.accounts || []).filter(function (a) { return String(a.account_id) === String(me()); })[0] || {};
      var acc = host.sessionAccount || null;
      var name = String((acc && acc.name) || mine.name || "").split(" ")[0];
      host.rest("go_tickets", { method: "POST", prefer: "return=minimal", body: {
        created_by: me(), created_name: name, area: d.area, section: d.section, sub: d.sub, body: d.body.trim()
      } }).then(function () { st.tkNew = false; st.tkDraft = null; if (host.toast) host.toast("Ticket gespeichert"); return loadTickets(); })
        .catch(function () { GoDialog.alert("Speichern ging nicht (go-admin-tickets.sql ausgeführt?)"); });
    }
  }

  var TABS = [
    { id: "news", label: "Nachrichten" },
    { id: "wa", label: "Erinnerungen" },
    { id: "coaches", label: "Nutzer" },
    { id: "editor", label: "Editor" },
    { id: "ex", label: "Social Media Links" },
    { id: "circles", label: "Circles" },
    { id: "groups", label: "Gruppen" },
    { id: "tickets", label: "Tickets" }
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
    var fa = document.activeElement, fq = fa && fa.getAttribute ? fa.getAttribute("data-ga-q") : null, fpos = fq ? fa.selectionStart : 0;
    st.body.innerHTML = st.tab === "news" ? paintNews() : st.tab === "wa" ? paintWa() : st.tab === "ex" ? paintEx() : st.tab === "circles" ? paintOrgs("circle") : st.tab === "groups" ? paintOrgs("group") : st.tab === "tickets" ? paintTickets() : paintCoaches();
    if (fq) {
      var back = st.body.querySelector('[data-ga-q="' + fq + '"]');
      if (back) { back.focus(); try { back.setSelectionRange(fpos, fpos); } catch (e) {} }
    }
  }
  document.addEventListener("input", function (e) {
    var k = e.target && e.target.getAttribute ? e.target.getAttribute("data-ga-q") : null;
    if (!k || !st) return;
    var parts = k.split("|");
    qOf(parts[0])[parts[1]] = e.target.value;
    paint();
  });

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
  /* WhatsApp am Abend: erinnert, dass man noch was macht oder das Gemachte abhakt.
   * Text nach Lage: heute (offen / erledigt / beides / nichts) × morgen (geplant / nichts) × Serie (ab 4 Tagen).
   *                   | morgen geplant                              | morgen nichts
   *  heute offen       | offene Events nennen (machen oder abhaken)  | dito + morgen planen
   *  heute erledigt    | loben (Serie wertschätzen), morgen nennen   | loben + morgen planen
   *  erledigt + offen  | loben, Offenes nennen, morgen nennen        | loben, Offenes nennen, morgen planen
   *  heute nichts      | Gemachtes eintragen, morgen nennen          | Gemachtes eintragen + morgen planen
   * Schritte sind speziell: „Hast Du schon 5.000 Schritte gemacht? Setz den Haken :)“
   */
  function waTitle(e) {
    return String((e && e.title) || "Training").replace(/^\s*[>≥]\s*/, "").trim();
  }
  function isSteps(e) { return /schritte/i.test(String((e && e.title) || "")); }
  function andList(arr) {
    return arr.length < 2 ? arr.join("") : arr.slice(0, -1).join(", ") + " und " + arr[arr.length - 1];
  }
  /* kurz = true, wenn viel zusammenkommt (mehrere offene Punkte, dazu Erledigtes oder Serie): etwas knapper formulieren */
  function openText(open, kurz) {
    var steps = open.filter(isSteps), other = open.filter(function (e) { return !isSteps(e); });
    var out = [];
    if (other.length) {
      out.push(andList(other.map(waTitle)) + (other.length > 1 ? " stehen" : " steht") + " heute noch an. " +
        (kurz ? "Schon gemacht? Dann abhaken!" : "Schon gemacht? Dann hak " + (other.length > 1 ? "sie" : "es") + " ab. Sonst: Du schaffst das noch!"));
    }
    steps.forEach(function (e) { out.push((kurz ? waTitle(e) + " geschafft?" : "Hast Du schon " + waTitle(e) + " gemacht?") + " Setz den Haken :)"); });
    return out.join(" ");
  }
  function waText(r) {
    var first = String(r.name || r.nickname || "").replace(/^@/, "").trim().split(" ")[0];
    var today = r.today || [];
    var open = today.filter(function (e) { return e.status === "geplant"; });
    var done = today.filter(function (e) { return e.status === "erledigt"; });
    var next = (r.tomorrow || [])[0];
    var streak = Number(r.streak) || 0;
    var big = streak >= 4;
    var morgen = next ? waTitle(next) + (hhmm(next.at) ? " um " + hhmm(next.at) : "") : "";
    var doneTxt = andList(done.map(waTitle));
    var parts = [];
    var kurz = open.length + (done.length ? 1 : 0) + (big ? 1 : 0) >= 3;
    if (done.length && !open.length) {
      if (big && next) parts.push(streak + " Tage in Folge, das ist richtig stark! " + doneTxt + " heute erledigt und morgen schon " + morgen + " am Start. Genau so baust Du Dir Deine Routine.");
      else if (big) parts.push(streak + " Tage in Folge, das ist richtig stark! " + doneTxt + " heute erledigt. Damit die Serie hält: Plan Dir gleich was für morgen ein.");
      else if (next) parts.push("Stark, " + doneTxt + " heute erledigt und morgen schon " + morgen + " am Start. Genau so!");
      else parts.push("Stark, " + doneTxt + " heute erledigt! Für morgen ist noch nichts geplant. Trag Dir gleich was ein, dann bleibst Du dran.");
    } else if (done.length && open.length) {
      parts.push((big ? streak + " Tage in Folge, stark! " : "Stark, ") + doneTxt + " hast Du heute schon erledigt.");
      parts.push(openText(open, kurz));
      parts.push(next ? (kurz ? "Morgen: " + morgen + "." : "Morgen geht es mit " + morgen + " weiter.") : (kurz ? "Morgen ist noch frei, plan Dir was ein." : "Für morgen ist noch nichts geplant. Trag Dir gleich was ein."));
    } else if (open.length) {
      parts.push(openText(open, kurz));
      parts.push(next ? (kurz ? "Morgen: " + morgen + "." : "Morgen geht es mit " + morgen + " weiter.") : (kurz ? "Morgen ist noch frei, plan Dir was ein." : "Für morgen ist noch nichts geplant. Trag Dir gleich was ein."));
      if (big) parts.push(kurz ? "Halt Deine Serie von " + streak + " Tagen!" : "Deine Serie steht bei " + streak + " Tagen, die willst Du halten.");
    } else if (next) {
      parts.push("Heute schon was gemacht? Dann trag es in gogogo ein und setz den Haken. Morgen hast Du " + morgen + " geplant, viel Spaß dabei!");
    } else {
      parts.push("Heute schon was gemacht? Dann trag es in gogogo ein und setz den Haken. Für morgen steht noch nichts an, plan Dir gleich was ein, auch kurz zählt.");
    }
    return "Hi " + first + "! " + parts.join(" ") + " Herzliche Grüße, Joscha. gogogo!";
  }
  function loadWa() {
    st.wa = null;
    return host.rest("rpc/go_admin_wa_list", { method: "POST", body: { p_day: berlinToday() } })
      .then(function (rows) {
        if (!st) return;
        st.wa = rows || [];
        paint();
        /* Serie je Person (go_streak_days), danach Texte neu */
        Promise.all(st.wa.map(function (r) {
          return host.rest("rpc/go_streak_days", { method: "POST", body: { p_user_id: r.account_id } })
            .then(function (n) { r.streak = Number(n) || 0; })
            .catch(function () {});
        })).then(function () { if (st && st.tab === "wa") paint(); });
      })
      .catch(function () { if (st) { st.wa = "error"; paint(); } });
  }
  function paintWa() {
    if (st.wa === "error") return '<p class="cp-hint">Liste nicht geladen. Ist go-wa-reminder.sql in Supabase ausgeführt?</p>';
    if (!st.wa) { loadWa(); return '<p class="cp-hint">Lade…</p>'; }
    var done = st.wa.filter(function (r) { return r.sent_at; }).length;
    var head = '<p class="cp-hint">Heute 19 Uhr · ' + done + " von " + st.wa.length + " erinnert. Tipp auf WhatsApp öffnet den Text, danach ist die Person abgehakt.</p>";
    if (!st.wa.length) return head + '<p class="cp-hint">Noch niemand hat die Erinnerung in den Einstellungen eingeschaltet.</p>';
    if (!st.coachInfo) loadCoachInfo();
    var rows = st.wa.filter(function (r) { return qMatch("wa", r.account_id, r.name); });
    return head + searchBar("wa") + (rows.length ? "" : '<p class="cp-hint">Nichts gefunden.</p>') + rows.map(function (r) {
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
  /* ---------- Neuer Nutzer: Feld wie die Profilansicht, Speichern legt das Konto an (Login mit Vorname + Login-Code) ---------- */
  function randDigits(n) { var s = ""; while (s.length < n) s += String(Math.floor(Math.random() * 10)); return s; }
  function freeValue(col, n) {
    var v = randDigits(n);
    if (n === 4 && v[0] === "0") v = "1" + v.slice(1);
    return host.rest("go_accounts?" + col + "=eq." + v + "&select=id&limit=1").then(function (r) { return r && r.length ? freeValue(col, n) : v; });
  }
  function openNew() {
    if (!st) return;
    var d = { photo: "", goals: [] };
    var coaches = (st.accounts || []).filter(isCoachAcc).map(function (a) { return [String(a.account_id), String(a.name || "Coach")]; });
    var box = document.createElement("div");
    box.className = "ga-info ga-newacc";
    document.body.appendChild(box);
    function field(id, label, type, ph, val) {
      return '<label class="ga-nf"><span>' + esc(label) + '</span><input id="' + id + '" type="' + (type || "text") + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ' value="' + esc(val || "") + '" autocomplete="off" /></label>';
    }
    function draw(code) {
      box.innerHTML = '<div class="ga-info__card" role="dialog" aria-modal="true">' +
        '<div class="ga-info__top"><div class="ga-photo">' + (d.photo ? '<img src="' + esc(d.photo) + '" alt="" />' : "<span>+</span>") +
        '<button type="button" class="ga-pen" data-gn="photo" aria-label="Foto">' + PEN + '</button></div><p class="ga-info__name">Neuer Nutzer</p></div>' +
        field("gn-first", "Vorname *", "text", "für den Login") + field("gn-last", "Nachname") +
        field("gn-nick", "Nickname", "text", "ohne @") +
        field("gn-code", "Login-Code *", "text", "4 Ziffern", code) +
        field("gn-phone", "Telefon / WhatsApp", "tel", "+49 …") + field("gn-mail", "E-Mail", "email") +
        '<label class="ga-nf"><span>Ziele</span><button type="button" class="ga-nf__pick" data-gn="goals">' + esc(d.goals.length ? d.goals.join(" · ") : "wählen") + "</button></label>" +
        '<label class="ga-nf"><span>Coach</span><select id="gn-coach"><option value="">ohne</option>' + coaches.map(function (c) { return '<option value="' + esc(c[0]) + '">' + esc(c[1]) + "</option>"; }).join("") + "</select></label>" +
        field("gn-places", "Orte", "text", "mit Komma trennen") +
        '<div class="ga-info__btns ga-newacc__btns"><button type="button" class="is-quiet" data-gn="cancel">Abbrechen</button><button type="button" class="is-dark" data-gn="save">Speichern</button></div></div>';
    }
    function keep() {
      ["gn-first", "gn-last", "gn-nick", "gn-code", "gn-phone", "gn-mail", "gn-places", "gn-coach"].forEach(function (k) { var el = document.getElementById(k); if (el) d[k] = el.value; });
    }
    function restore() {
      Object.keys(d).forEach(function (k) { var el = /^gn-/.test(k) && document.getElementById(k); if (el) el.value = d[k]; });
    }
    freeValue("invite_code", 4).catch(function () { return randDigits(4); }).then(function (code) { draw(code); });
    box.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-gn]") : null;
      if (e.target === box) { box.remove(); return; }
      if (!b) return;
      var act = b.getAttribute("data-gn");
      if (act === "cancel") { box.remove(); return; }
      if (act === "photo") { keep(); pickPhoto(function (url) { d.photo = url || ""; draw(d["gn-code"]); restore(); }); return; }
      if (act === "goals") {
        keep();
        GoDialog.pick("Ziele", GOAL_OPTIONS.map(function (g) { return { label: g, value: g, checked: d.goals.indexOf(g) >= 0 }; }), { ok: "Übernehmen", cancel: "Abbrechen" })
          .then(function (v) { if (v) d.goals = v; draw(d["gn-code"]); restore(); });
        return;
      }
      if (act === "save") {
        keep();
        var first = String(d["gn-first"] || "").trim(), last = String(d["gn-last"] || "").trim();
        var code = String(d["gn-code"] || "").replace(/\D/g, "");
        var nick = String(d["gn-nick"] || "").trim().replace(/^@/, "");
        var mail = String(d["gn-mail"] || "").trim(), phone = String(d["gn-phone"] || "").trim();
        if (!first) { GoDialog.alert("Bitte den Vornamen eintragen."); return; }
        if (code.length !== 4) { GoDialog.alert("Der Login-Code hat 4 Ziffern."); return; }
        var places = String(d["gn-places"] || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
        b.disabled = true;
        /* Vorname + Code muss eindeutig sein, Nickname auch */
        Promise.all([
          host.rest("go_accounts?invite_code=eq." + code + "&select=name&limit=50"),
          nick ? host.rest("go_accounts?nickname=ilike." + encodeURIComponent(nick.replace(/[%_]/g, "\\$&")) + "&select=id&limit=1") : Promise.resolve([]),
          freeValue("serial_number", 8)
        ]).then(function (r) {
          var clash = (r[0] || []).some(function (x) { return String(x.name || "").split(" ")[0].toLowerCase() === first.toLowerCase(); });
          if (clash) { b.disabled = false; GoDialog.alert("Vorname und Login-Code gibt es schon. Bitte einen anderen Code."); return; }
          if ((r[1] || []).length) { b.disabled = false; GoDialog.alert("Den Nickname gibt es schon."); return; }
          var body = {
            name: (first + " " + last).trim(), invite_code: code, serial_number: r[2], phone: phone, whatsapp_phone: phone || null,
            nickname: nick || null, email: mail || null, about_me: mail ? JSON.stringify({ email: mail }) : null,
            training_goal: d.goals.join(", ") || null, trainer_id: d["gn-coach"] || null, workout_places: places, photo_url: d.photo || null
          };
          return host.rest("go_accounts", { method: "POST", prefer: "return=representation", body: body }).then(function (rows) {
            var acc = rows && rows[0];
            box.remove();
            return load().then(function (data) {
              st.data = data || {};
              st.accounts = (data && data.accounts) || [];
              st.coachInfo = null; st.extras = null; st.links = null;
              paint();
              if (acc && acc.id) openQr(String(acc.id), acc);
            });
          });
        }).catch(function (err) {
          b.disabled = false;
          GoDialog.alert("Anlegen ging nicht: " + String((err && err.message) || err).slice(0, 160));
        });
      }
    });
  }

  /* ---------- QR-Code als Login-Karte im Format der Stempelkarte: oben gogogo, mittig QR, unten Name und Nickname ---------- */
  var QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  function loadQrLib() {
    if (global.QRCode) return Promise.resolve();
    return new Promise(function (res, rej) {
      var sc = document.createElement("script");
      sc.src = QR_LIB; sc.onload = res; sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }
  function openQr(id, known) {
    var a = (st.accounts || []).filter(function (x) { return String(x.account_id) === String(id); })[0] || {};
    var job = host.rest("go_accounts?id=eq." + encodeURIComponent(id) + "&select=name,nickname,invite_code").then(function (r) { return (r && r[0]) || known || {}; });
    Promise.all([job, loadQrLib()]).then(function (r) {
      var acc = r[0];
      var first = String(acc.name || a.name || "").split(" ")[0];
      /* Login-Link: Login-Seite füllt Vorname und Code aus (login/index.html, ?n=&c=); QR entsteht im Browser */
      var url = location.origin + "/login/?n=" + encodeURIComponent(first) + "&c=" + encodeURIComponent(acc.invite_code || "");
      var box = document.createElement("div");
      box.className = "ga-info ga-qr";
      box.innerHTML = '<div class="ga-qrcard" role="dialog" aria-modal="true"><div class="ga-qrcard__brand">gogogo</div>' +
        '<div class="ga-qrcard__band"><div class="ga-qrcard__code"></div></div>' +
        '<div class="ga-qrcard__foot"><div class="ga-qrcard__name">' + esc(acc.name || a.name || "") + "</div>" +
        (acc.nickname ? '<div class="ga-qrcard__nick">@' + esc(acc.nickname) + "</div>" : "") +
        '<div class="ga-qrcard__code-line">Login-Code: ' + esc(acc.invite_code || "–") + "</div></div></div>";
      document.body.appendChild(box);
      new global.QRCode(box.querySelector(".ga-qrcard__code"), { text: url, width: 176, height: 176, colorDark: "#2A2118", colorLight: "#ffffff", correctLevel: global.QRCode.CorrectLevel.M });
      box.addEventListener("click", function () { box.remove(); });
    }).catch(function () { GoDialog.alert("QR-Code ging nicht (keine Verbindung?)."); });
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
      if (e.target.closest("[data-gi-req]")) { close(); requestCoach(id); return; }
      if (e.target.closest("[data-gi-pen]")) {
        /* Stift: Löschen / Hochladen / Abbrechen */
        var savePhoto = function (url) {
          return host.rest("rpc/go_admin_update_account", { method: "POST", body: { p_account: id, p_photo: url } })
            .then(function () {
              (st.coachInfo[String(id)] || (st.coachInfo[String(id)] = {})).photo_url = url || null;
              var acc = (st.accounts || []).filter(function (x) { return String(x.account_id) === String(id); })[0];
              if (acc) acc.photo_url = url || null;
              close();
              openInfo(id);
              paint();
              if (host.toast) host.toast(url ? "Foto gespeichert" : "Foto gelöscht");
            })
            .catch(function () { GoDialog.alert("Das braucht go-admin-groups.sql in Supabase."); });
        };
        GoDialog.choose("Foto", [
          { label: "Löschen", value: "del" },
          { label: "Hochladen", value: "up" }
        ], { center: true, cancel: "Abbrechen" }).then(function (v) {
          if (v === "up") pickPhoto(savePhoto);
          else if (v === "del") savePhoto("");
        });
      }
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
        row("E-Mail", esc(about.email || ""));
        var lnk = (st.links && st.links[String(id)]) || {};
        row("Gruppe", esc((lnk.groups || []).join(", ")));
        row("Circle", esc((lnk.circles || []).join(", ")));
        row("Status", a.paused_at ? "pausiert seit " + esc(dateDe(a.paused_at)) : "");
        row("ID", esc(a.serial_number || ""));
        row("Login-Code", esc(a.invite_code || ""));
        row("Dabei seit", esc(dateDe(a.created_at || person.at)));
        row("Datenschutz", a.privacy_ack_at ? "zugestimmt " + esc(dateDe(a.privacy_ack_at)) : "noch nicht zugestimmt");
        row("Erinnerung", a.wa_reminder ? "WhatsApp 19 Uhr an" : "");
        row("Tagebuch", a.diary_visibility === "friends" ? "für Freunde sichtbar" : "privat");
        var books = ((st.data && st.data.bookings) || []).filter(function (b) { return String(b.account_id) === String(id); })
          .map(function (b) { return b.type === "coach_offer" ? "möchte Coach werden" : (b.title || TYPE_TITLE[b.type] || b.type); });
        row("Buchungen", esc(books.join(" · ")));
        var photo = a.photo_url || person.photo_url;
        var faceHtml = '<div class="ga-photo">' + (photo ? '<img src="' + esc(photo) + '" alt="" />' :
          "<span>" + esc(String(a.name || person.name || "?").slice(0, 1)) + "</span>") +
          '<button type="button" class="ga-pen" data-gi-pen="1" aria-label="Foto ändern">' + PEN + "</button></div>";
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
    var t = e.target && e.target.closest ? e.target.closest("[data-ga-broadcast],[data-ga-close],[data-ga-burger],[data-ga-tab],[data-ga-coach],[data-ga-wa],[data-ga-sub],[data-ga-block],[data-ga-rdone],[data-ga-media],[data-ga-del],[data-ga-goal],[data-ga-info],[data-ga-req],[data-ga-vc],[data-ga-role],[data-ga-user],[data-gx],[data-ga-places],[data-ga-plan],[data-ga-rec],[data-ga-uf],[data-ga-nfreset],[data-gt],[data-ga-admin],[data-ga-new],[data-ga-qr],[data-ga-pdfall]") : null;
    if (st && st.menu && !st.menu.hidden && (!t || !t.hasAttribute("data-ga-burger"))) st.menu.hidden = true;
    if (!t) return;
    if (t.hasAttribute("data-ga-burger")) { st.menu.hidden = !st.menu.hidden; return; }
    if (t.hasAttribute("data-ga-broadcast")) { broadcast(); return; }
    if (t.hasAttribute("data-ga-del")) { deleteAccount(t); return; }
    if (t.hasAttribute("data-ga-role")) { roleMenu(t.getAttribute("data-ga-role")); return; }
    if (t.hasAttribute("data-ga-admin")) { adminMenu(t.getAttribute("data-ga-admin")); return; }
    if (t.hasAttribute("data-gt")) { ticketAction(t); return; }
    if (t.hasAttribute("data-ga-new")) { openNew(); return; }
    if (t.hasAttribute("data-ga-pdfall")) {
      var ids = (st.accounts || []).filter(function (a) { return qMatch("coaches", a.account_id, a.name) && ufMatch(a); }).map(function (a) { return String(a.account_id); });
      exportSheets(ids, st.uf.day);
      return;
    }
    if (t.hasAttribute("data-ga-qr")) { openQr(t.getAttribute("data-ga-qr")); return; }
    if (t.hasAttribute("data-ga-user")) { userMenu(t.getAttribute("data-ga-user")); return; }
    if (t.hasAttribute("data-ga-places")) { userPlaces(t.getAttribute("data-ga-places")); return; }
    if (t.hasAttribute("data-ga-plan")) { userPlan(t.getAttribute("data-ga-plan")); return; }
    if (t.hasAttribute("data-ga-rec")) { openRec(t.getAttribute("data-ga-rec")); return; }
    if (t.getAttribute("data-ga-uf") === "reset") { st.uf = {}; paint(); return; }
    if (t.hasAttribute("data-ga-nfreset")) { st.nf[t.getAttribute("data-ga-nfreset")] = {}; paint(); return; }
    if (t.hasAttribute("data-gx")) {
      var gx = t.getAttribute("data-gx"), gk = t.getAttribute("data-gk"), gid = t.getAttribute("data-gid");
      if (gx === "coach") orgCoach(gk, gid);
      else if (gx === "places") orgPlaces(gk, gid);
      else if (gx === "add") orgAdd(gk, gid);
      else if (gx === "photo") orgPhoto(gk, gid);
      else if (gx === "member") {
        /* Mitglied: zu Nutzer wechseln und die Infobox öffnen */
        st.tab = "coaches";
        paint();
        openInfo(gid);
      }
      return;
    }
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

  function onChange(e) {
    var uf = e.target && e.target.closest ? e.target.closest("select[data-ga-uf]") : null;
    if (uf && st) { st.uf = st.uf || {}; st.uf[uf.getAttribute("data-ga-uf")] = uf.value; paint(); return; }
    var tid = e.target && e.target.id;
    if (st && st.tkDraft && (tid === "gt-area" || tid === "gt-sec" || tid === "gt-sub")) {
      st.tkDraft.body = (document.getElementById("gt-body") || {}).value || st.tkDraft.body;
      if (tid === "gt-area") { st.tkDraft.area = e.target.value; st.tkDraft.section = ""; st.tkDraft.sub = ""; }
      if (tid === "gt-sec") { st.tkDraft.section = e.target.value; st.tkDraft.sub = ""; }
      if (tid === "gt-sub") st.tkDraft.sub = e.target.value;
      paint();
      return;
    }
    var tst = e.target && e.target.getAttribute ? e.target.getAttribute("data-gt-status") : null;
    if (tst && st) {
      var nst = e.target.value;
      host.rest("go_tickets?id=eq." + tst, { method: "PATCH", prefer: "return=minimal", body: { status: nst, updated_at: new Date().toISOString() } })
        .then(function () { (st.tickets || []).forEach(function (x) { if (String(x.id) === tst) x.status = nst; }); paint(); })
        .catch(function () { GoDialog.alert("Status ändern ging nicht."); });
      return;
    }
    var nfs = e.target && e.target.closest ? e.target.closest("select[data-ga-nf]") : null;
    if (nfs && st) { var nk = nfs.getAttribute("data-ga-nf").split("|"); nfOf(nk[0])[nk[1]] = nfs.value; paint(); return; }
    var sel = e.target && e.target.closest ? e.target.closest("[data-ga-cf]") : null;
    if (!sel || !st) return;
    st.cfs = st.cfs || {};
    var k = sel.getAttribute("data-gk") || "circle";
    (st.cfs[k] || (st.cfs[k] = {}))[sel.getAttribute("data-ga-cf")] = sel.value;
    paint();
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
    root.className = "cp ga-root";
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
    root.addEventListener("change", onChange);
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
