/* go-messages.js — Mitteilungen: einmal mittig in Aktuell, Tippen (auf oder neben die Karte) schließt
 *
 *   GoMessages.init({ rest, me(), createdAt() })
 *   GoMessages.check()      lädt ungelesene Mitteilungen und zeigt sie nacheinander (nur in Aktuell)
 *
 * Quellen:
 *   NEWS (unten)     Änderungen an der App, die Nutzer merken. Bei jeder spürbaren Änderung einen Eintrag ergänzen.
 *                    Neue Konten sehen nur Einträge, die nach ihrer Anmeldung kamen.
 *   go_messages      an alle (Admin, neuer Wochenplan) oder an eine Person (Freund hat Plan geändert), go-messages.sql
 * Gelesen: go_message_reads (pro Konto, geräteübergreifend); ohne die Tabelle nur auf diesem Gerät.
 */
(function (global) {
  "use strict";

  var NEWS = [
    {
      key: "news:2026-11-19-ring",
      at: "2026-11-19T12:00:00Z",
      text: "Neu in gogogo: Der Ring um Dein Profilbild wechselt jetzt immer nur um eine Farbstufe, und die Zahl daran zeigt, wie viele Tage Du am Stück abgehakt hast. Mehr dazu unter „Info“ oben links in Aktuell."
    },
    {
      key: "news:2026-11-19-uhrzeit",
      at: "2026-11-19T12:00:01Z",
      text: "Freunde einladen geht, sobald Dein Training eine Uhrzeit hat. Die setzt Du unter Woche → Stift → Tage bearbeiten."
    }
  ];

  var host = null;
  var busy = false;
  var noTables = false;
  var LOCAL = "gogogo_msg_read";

  function me() { return host && host.me ? String(host.me() || "") : ""; }
  function localRead() {
    try { return JSON.parse(localStorage.getItem(LOCAL + "_" + me()) || "[]"); } catch (e) { return []; }
  }
  function markLocal(key) {
    try {
      var l = localRead();
      if (l.indexOf(key) < 0) l.push(key);
      localStorage.setItem(LOCAL + "_" + me(), JSON.stringify(l.slice(-200)));
    } catch (e) {}
  }
  function markRead(key) {
    markLocal(key);
    if (noTables || !host) return;
    host.rest("go_message_reads", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: { account_id: me(), msg_key: key }
    }).catch(function () {});
  }

  function since() {
    var c = host && host.createdAt ? host.createdAt() : "";
    if (c) return Promise.resolve(c);
    return host.rest("go_accounts?id=eq." + encodeURIComponent(me()) + "&select=created_at")
      .then(function (rows) { return (rows && rows[0] && rows[0].created_at) || ""; })
      .catch(function () { return ""; });
  }

  function load() {
    return since().then(function (from) {
      from = from || new Date(Date.now() - 30 * 864e5).toISOString();
      var id = encodeURIComponent(me());
      var msgs = noTables ? Promise.resolve([]) : host.rest(
        "go_messages?or=(to_id.is.null,to_id.eq." + id + ")&created_at=gte." + encodeURIComponent(from) +
        "&order=created_at.asc&limit=30&select=id,body,created_at"
      ).catch(function () { noTables = true; return []; });
      var reads = noTables ? Promise.resolve([]) : host.rest("go_message_reads?account_id=eq." + id + "&select=msg_key&limit=500")
        .catch(function () { return []; });
      return Promise.all([msgs, reads]).then(function (r) {
        var seen = {};
        localRead().forEach(function (k) { seen[k] = true; });
        (r[1] || []).forEach(function (x) { seen[x.msg_key] = true; });
        var list = NEWS.filter(function (n) { return n.at >= from; }).map(function (n) {
          return { key: n.key, at: n.at, text: n.text };
        });
        (r[0] || []).forEach(function (m) { list.push({ key: String(m.id), at: m.created_at, text: m.body }); });
        list.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
        return list.filter(function (m) { return !seen[m.key]; });
      });
    });
  }

  function blocked() {
    if (document.body.dataset.shell !== "heute") return true;
    if (document.querySelector(".god, .gtm, .cp, .gpl, .gob, #go-boot")) return true;
    if (document.querySelector(".sand-modal:not([hidden])")) return true;
    return false;
  }

  function showQueue(list) {
    if (!list.length) { busy = false; return; }
    if (blocked()) {
      setTimeout(function () { showQueue(list); }, 2500);
      return;
    }
    var m = list.shift();
    markRead(m.key);
    (GoDialog.note || GoDialog.alert)(m.text).then(function () {
      setTimeout(function () { showQueue(list); }, 350);
    });
  }

  function check() {
    if (!host || !me() || busy || !global.GoDialog) return;
    busy = true;
    load().then(showQueue).catch(function () { busy = false; });
  }

  global.GoMessages = {
    init: function (h) { host = h; },
    check: check,
    news: function () { return NEWS.slice(); }
  };
})(window);
