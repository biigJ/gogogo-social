/*
 * GoChat — Chat als eigene Ebene (Pille „Chat“), ohne Pille und ohne Aktuell-Kopfzeile.
 *   Liste: alle Freunde (direkt) und Kreise (Freunde gesamt, Gruppe, Circles, Bubble, Coachees, Mein Coach),
 *          nach letzter Nachricht sortiert, rechts die Sprechblase.
 *   Verlauf: Nachrichten des Gesprächs, unten das Eingabefeld (#gbub-compose aus bubbles.js, ohne Platzhalter).
 *   Zurück oben links: Verlauf → Liste → Aktuell mit Pille.
 *
 *   GoChat.init(host) host: {
 *     me() → id, friends() → [{id,name,nickname,photo_url}], kreise() → [{key,name,photo,icon}],
 *     msgs(key) → [msg] (sofort), bubbleMsgs() → Promise<[msg]>, reload() → Promise, msgHtml(msg) → html,
 *     onThread(key|null), onClose()
 *   }
 *   Schlüssel: "dm:<id>", "team", "gruppe", "circle:<gid>", "bubble", "coach", "mycoach"
 */
(function (global) {
  "use strict";

  var host = null;
  var root = null;
  var key = null;
  var bubble = [];
  var BACK = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 6.5 8.2 12l6 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var REFRESH = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
  var SAY = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-1.9-.1-2.8-.4L5 19.5l1.2-3.6C4.5 14.7 3.5 12.9 3.5 11c0-3.9 3.8-7 8.5-7z"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function first(n) { return String(n || "").split(" ")[0]; }
  function msgsOf(k) {
    if (k === "bubble") return bubble.slice();
    try { return (host.msgs(k) || []).slice(); } catch (e) { return []; }
  }
  function lastOf(k) {
    var l = msgsOf(k);
    var best = null;
    l.forEach(function (m) { if (!best || String(m.created_at) > String(best.created_at)) best = m; });
    return best;
  }
  function whenShort(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var day = d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    var today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
    return day === today
      ? d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "numeric" });
  }
  function preview(m) {
    if (!m) return "";
    var who = String(m.author_id) === String(host.me()) ? "Du: " : "";
    var t = m.body || (m.media_url ? (m.media_kind === "video" ? "Video" : "Foto") : "");
    return who + String(t).replace(/\s+/g, " ").slice(0, 70);
  }

  function rows() {
    var out = [];
    (host.kreise() || []).forEach(function (k) { out.push({ key: k.key, name: k.name, photo: k.photo || "", icon: k.icon || "" }); });
    (host.friends() || []).forEach(function (p) {
      out.push({ key: "dm:" + p.id, name: first(p.name) || p.nickname || "Freund", photo: p.photo_url || "", letter: String(p.name || "?").slice(0, 1) });
    });
    out.forEach(function (r) { r.last = lastOf(r.key); });
    /* chronologisch: neueste Nachricht oben, ohne Nachricht danach (Kreise vor Freunden, dann Name) */
    out.sort(function (a, b) {
      var ta = a.last ? String(a.last.created_at) : "", tb = b.last ? String(b.last.created_at) : "";
      if (ta !== tb) return ta < tb ? 1 : -1;
      return 0;
    });
    return out;
  }

  /* Liste: ohne Zurück (Pille bleibt sichtbar); Verlauf: Zurück zur Liste */
  function bar(title, backAttr) {
    return '<div class="go-chat__bar">' + (backAttr ? '<button type="button" class="profile-back go-chat__back" ' + backAttr + ' aria-label="Zurück">' + BACK + "</button>" : "<span></span>") +
      "<h2>" + esc(title) + '</h2><button type="button" class="go-chat__refresh" data-chat-refresh aria-label="Aktualisieren">' + REFRESH + "</button></div>";
  }

  function paintList() {
    var list = rows();
    root.innerHTML = bar("Chat", "") +
      '<div class="go-chat__list">' +
      (list.length ? list.map(function (r) {
        var face = r.photo
          ? '<span class="team-avatar"><img src="' + esc(r.photo) + '" alt="" /></span>'
          : '<span class="team-avatar go-chat__ico">' + (r.icon || esc(r.letter || first(r.name).slice(0, 1))) + "</span>";
        return '<button type="button" class="go-chat__row" data-chat-open="' + esc(r.key) + '">' + face +
          '<span class="friend-list__text"><span class="friend-list__name">' + esc(r.name) + "</span>" +
          (r.last ? '<span class="friend-list__meta">' + esc(preview(r.last)) + " · " + esc(whenShort(r.last.created_at)) + "</span>" : "") +
          '</span><span class="go-chat__say">' + SAY + "</span></button>";
      }).join("") : '<p class="coach-empty">Noch keine Freunde oder Kreise.</p>') +
      "</div>";
  }

  function paintThread() {
    var r = rows().filter(function (x) { return x.key === key; })[0];
    var l = msgsOf(key).sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
    root.innerHTML = bar(r ? r.name : "Chat", "data-chat-back") +
      '<div class="go-chat__msgs">' +
      (l.length ? l.map(function (m) { try { return host.msgHtml(m); } catch (e) { return ""; } }).join("") : '<p class="go-chat__empty">Noch keine Nachrichten.</p>') +
      "</div>";
    var box = root.querySelector(".go-chat__msgs");
    if (box) box.scrollTop = box.scrollHeight;
  }

  function paint() {
    if (!root) return;
    if (key) paintThread(); else paintList();
  }

  function reload() {
    var jobs = [Promise.resolve(host.reload ? host.reload() : null).catch(function () {})];
    jobs.push(Promise.resolve(host.bubbleMsgs ? host.bubbleMsgs() : []).then(function (l) { bubble = l || []; }).catch(function () { bubble = []; }));
    return Promise.all(jobs).then(paint);
  }

  function openThread(k) {
    key = k;
    document.body.classList.add("go-chat-thread");
    if (host.onThread) host.onThread(k);
    paint();
  }
  function backToList() {
    key = null;
    document.body.classList.remove("go-chat-thread");
    if (host.onThread) host.onThread(null);
    paint();
  }

  /* iOS: nach dem Schließen der Tastatur bleibt die Seite manchmal hochgeschoben, dann liegt der Chat
     zu hoch und darunter scheint der Feed durch. Seite zurück auf 0, sobald die Tastatur weg ist. */
  var vvBound = false;
  function resetShift() {
    if (!root || !root.isConnected) return;
    var vv = global.visualViewport;
    if (vv && vv.height < global.innerHeight * 0.8) return; /* Tastatur noch offen */
    if (global.scrollY || document.documentElement.scrollTop || document.body.scrollTop) {
      global.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }
  function bindShift() {
    if (vvBound) return;
    vvBound = true;
    document.addEventListener("focusout", function () { setTimeout(resetShift, 60); setTimeout(resetShift, 400); });
    if (global.visualViewport) global.visualViewport.addEventListener("resize", function () { setTimeout(resetShift, 60); });
    global.addEventListener("scroll", function () { if (root && root.isConnected && !document.activeElement.matches("input,textarea,[contenteditable]")) resetShift(); }, { passive: true });
  }

  function open() {
    if (!host) return;
    bindShift();
    if (!root) {
      root = document.createElement("div");
      root.className = "go-chat";
      root.addEventListener("click", function (e) {
        var t = e.target;
        if (t.closest("[data-chat-close]")) { close(); return; }
        if (t.closest("[data-chat-back]")) { backToList(); return; }
        var rf = t.closest("[data-chat-refresh]");
        if (rf) { rf.classList.add("is-spin"); reload().then(function () { var b = root && root.querySelector("[data-chat-refresh]"); if (b) b.classList.remove("is-spin"); }); return; }
        var o = t.closest("[data-chat-open]");
        if (o) openThread(o.getAttribute("data-chat-open"));
      });
    }
    key = null;
    document.body.appendChild(root);
    document.body.classList.add("go-chat-open");
    document.body.classList.remove("go-chat-thread");
    paint();
    reload();
  }
  function close() {
    key = null;
    if (root) root.remove();
    document.body.classList.remove("go-chat-open", "go-chat-thread");
    if (host.onThread) host.onThread(null);
    if (host.onClose) host.onClose();
  }

  global.GoChat = {
    init: function (h) { host = h; },
    open: open,
    close: close,
    isOpen: function () { return !!(root && root.isConnected); },
    key: function () { return root && root.isConnected ? key : null; },
    refresh: function () { return root && root.isConnected ? reload() : Promise.resolve(); },
    repaint: paint,
    /* direkt ein Gespräch öffnen (Herz → neue Nachricht) */
    openKey: function (k) {
      if (!host || !k) return;
      if (!root || !root.isConnected) open();
      openThread(k);
      reload();
    }
  };
})(window);
