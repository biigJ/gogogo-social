/* admin-inbox.js — Admin in der App (nur Joscha / Ben)
 *
 *   GoAdmin.open(host)        → Vollbild: Nachrichten (neue Nutzer, Buchungen), Coaches freischalten,
 *                               Erinnerungen (WhatsApp 19 Uhr als Checkliste, go-wa-reminder.sql)
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
    ".ga-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(42,33,24,.1)}" +
    ".ga-face{width:42px;height:42px;flex:none;border-radius:50%;object-fit:cover;background:#E6DED0;display:grid;place-items:center;font-weight:700}" +
    ".ga-copy{flex:1;min-width:0}" +
    ".ga-copy b{font-weight:700}" +
    ".ga-copy p{margin:0;font-size:15px;line-height:1.35}" +
    ".ga-when{display:block;font-size:12px;color:rgba(42,33,24,.6)}" +
    ".ga-item.is-new .ga-copy p::before{content:'';display:inline-block;width:8px;height:8px;margin:0 6px 1px 0;border-radius:50%;background:#111}" +
    ".ga-act{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1.5px solid #111;background:transparent;color:#111;font:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
    ".ga-act.is-on{background:#111;color:#fff}" +
    ".ga-del{margin-left:6px;color:#C7413B;border-color:#C7413B}" +
    ".ga-wa{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:0;background:#128C7E;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-grid;place-items:center}" +
    ".ga-item.is-sent{opacity:.5}" +
    ".ga-msg{display:block;font-size:13px;color:rgba(42,33,24,.75);margin-top:2px}";

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
    return host.rest("rpc/go_admin_inbox", { method: "POST", body: { p_limit: 80 } });
  }

  function items(data) {
    var list = [];
    ((data && data.accounts) || []).forEach(function (a) {
      list.push({ kind: "account", at: a.at, a: a });
    });
    ((data && data.bookings) || []).forEach(function (b) {
      list.push({ kind: b.type === "coach_offer" ? "coach" : "booking", at: b.at, a: b });
    });
    list.sort(function (x, y) { return String(y.at).localeCompare(String(x.at)); });
    return list;
  }

  function unread(h) {
    host = h || host;
    if (!host) return Promise.resolve(0);
    var since = lastSeen();
    return load().then(function (data) {
      if (!since) return 0; /* erstes Öffnen: alles gilt als gelesen, sonst 100+ Altlasten */
      return items(data).filter(function (it) { return String(it.at) > since; }).length;
    }).catch(function () { return 0; });
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

  function coachBtn(id) {
    var on = trainerOf(id);
    return '<button type="button" class="ga-act' + (on ? " is-on" : "") + '" data-ga-coach="' + esc(id) + '" data-on="' + (on ? "1" : "0") + '">' +
      (on ? "Coach ✓" : "Freischalten") + "</button>";
  }

  function paintNews() {
    var since = st.seenBefore;
    var list = items(st.data);
    if (!list.length) return '<p class="cp-hint">Noch keine Nachrichten.</p>';
    return list.map(function (it) {
      var a = it.a;
      var name = "<b>" + esc(a.name || "Jemand") + "</b>";
      var text;
      var act = "";
      if (it.kind === "account") text = name + " ist neu dabei";
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
    var accs = (st.accounts || []).slice().sort(function (x, y) {
      if (!!y.is_trainer !== !!x.is_trainer) return y.is_trainer ? 1 : -1;
      return String(x.name || "").localeCompare(String(y.name || ""), "de");
    });
    return '<p class="cp-hint">Coaches sehen „Du bist Coach“, ihr Team und das Coach-Portal. Den Kurs-Editor gibt es nur hier im Admin-Bereich.</p>' +
      accs.map(function (a) {
        return '<div class="ga-item">' + face(a) + '<div class="ga-copy"><p><b>' + esc(a.name || "?") + "</b></p>" +
          '<span class="ga-when">seit ' + esc(when(a.at).split(" · ")[0]) + "</span></div>" + coachBtn(a.account_id) +
          (String(a.account_id) === String(me()) || ADMIN_IDS.indexOf(String(a.account_id)) !== -1 ? "" : '<button type="button" class="ga-act ga-del" data-ga-del="' + esc(a.account_id) + '" aria-label="Löschen">Löschen</button>') +
          "</div>";
      }).join("");
  }

  function paint() {
    if (!st) return;
    if (st.error) {
      st.body.innerHTML = '<p class="cp-hint">' + esc(st.error) + "</p>";
      return;
    }
    st.body.innerHTML =
      '<div class="cp-seg"><button type="button" data-ga-tab="news" class="' + (st.tab === "news" ? "is-on" : "") + '">Nachrichten</button>' +
      '<button type="button" data-ga-tab="coaches" class="' + (st.tab === "coaches" ? "is-on" : "") + '">Nutzer</button>' +
      '<button type="button" data-ga-tab="wa" class="' + (st.tab === "wa" ? "is-on" : "") + '">Erinnerungen</button>' +
      '<button type="button" data-ga-tab="ex" class="' + (st.tab === "ex" ? "is-on" : "") + '">Übungen</button></div>' +
      (st.tab === "news" ? paintNews() : st.tab === "wa" ? paintWa() : st.tab === "ex" ? paintEx() : paintCoaches()) +
      '<button type="button" class="cp-btn cp-btn--ghost" data-ga-editor="1" style="margin-top:18px">Kurs-Editor (alle Wochenpläne)</button>';
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
  function paintEx() {
    if (st.ex === "error") return '<p class="cp-hint">Liste nicht geladen. Ist go-uebung-einreichen.sql in Supabase ausgeführt?</p>';
    if (!st.ex) { loadEx(); return '<p class="cp-hint">Lade…</p>'; }
    if (!st.ex.rows.length) return '<p class="cp-hint">Keine offenen Einreichungen. Nutzer reichen unter Plus → Videos Übungen ein.</p>';
    return st.ex.rows.map(function (r) {
      return '<div class="ga-item"><div class="ga-copy"><p><b>' + esc(r.name) + "</b></p>" +
        '<span class="ga-msg">' + esc((st.ex.names[r.account_id] || "?") + (r.note ? " · " + r.note : "")) + "</span>" +
        '<span class="ga-when">' + esc(when(r.created_at)) + "</span></div>" +
        '<button type="button" class="ga-wa" style="background:#2A2118" data-ga-exdone="' + esc(r.id) + '">Erledigt</button></div>';
    }).join("");
  }
  function exDone(id) {
    host.rest("go_exercise_submissions?id=eq." + encodeURIComponent(id), { method: "PATCH", prefer: "return=minimal", body: { done_at: new Date().toISOString() } })
      .then(function () {
        st.ex.rows = st.ex.rows.filter(function (r) { return String(r.id) !== String(id); });
        paint();
      })
      .catch(function () { if (host.toast) host.toast("Ging nicht"); });
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

  function onClick(e) {
    if (e.target && e.target.closest && e.target.closest("[data-ga-editor]")) {
      location.href = "/workout/kurse/?from=admin";
      return;
    }
    var t = e.target && e.target.closest ? e.target.closest("[data-ga-close],[data-ga-tab],[data-ga-coach],[data-ga-wa],[data-ga-exdone],[data-ga-del]") : null;
    if (!t) return;
    if (t.hasAttribute("data-ga-del")) { deleteAccount(t); return; }
    if (t.hasAttribute("data-ga-exdone")) { exDone(t.getAttribute("data-ga-exdone")); return; }
    if (t.hasAttribute("data-ga-wa")) { markWa(t.getAttribute("data-ga-wa")); return; }
    if (t.hasAttribute("data-ga-close")) return close();
    if (t.hasAttribute("data-ga-tab")) {
      st.tab = t.getAttribute("data-ga-tab");
      paint();
      return;
    }
    if (t.hasAttribute("data-ga-coach")) setCoach(t);
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
      '<div class="cp-bar">' +
      '<button type="button" class="cp-back" data-ga-close aria-label="Zurück">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 6.5 8.2 12l6 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button><h2>Admin</h2></div>" +
      '<div class="cp-body"><p class="cp-hint">Lade…</p></div>';
    document.body.appendChild(root);
    document.body.classList.add("cp-open");
    st = { root: root, body: root.querySelector(".cp-body"), tab: tab || "news", seenBefore: lastSeen(), data: null, accounts: [] };
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
