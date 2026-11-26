/*
 * GoUsage — Nutzungsmessung je Konto (go-usage.sql)
 *   Sitzung: Start beim Öffnen, aktive Sekunden nur solange die App sichtbar ist,
 *   nach mehr als 30 Minuten im Hintergrund beginnt eine neue Sitzung.
 *   Ereignisse: Tipp auf die Pille (Sektion) und auf Knöpfe/Kacheln darin (Funktion), mit Zeitstempel.
 *   Jede 20. Sitzung: Dialog „Wie läuft die Sitzung heute?“ (ja / nein / vielleicht + Feedback).
 *
 *   GoUsage.init(host)   host: { send(rpcName, body, keepalive) → Promise }
 */
(function (global) {
  "use strict";

  var host = null;
  var sid = null;
  var n = 0;
  var seconds = 0;
  var hiddenAt = 0;
  var queue = [];
  var starting = null;
  var flushTimer = null;
  var NEW_AFTER = 30 * 60 * 1000;
  var ASK_EVERY = 20;

  var SECTION = { heute: "Aktuell", woche: "Kalender", team: "Community", kurse: "Plus", profil: "Profil" };

  /* Admin offen: zählt nicht als Nutzung (keine Zeit, Sektion „Admin“ wird in der Analyse ausgelassen) */
  function inAdmin() { return !!document.querySelector(".ga-root"); }
  function section() {
    if (inAdmin()) return "Admin";
    var s = document.body && document.body.dataset ? document.body.dataset.shell : "";
    return SECTION[s] || s || "";
  }
  function activeSeconds() { return seconds; }
  /* aktive Zeit in 5-Sekunden-Schritten: nur sichtbar und nicht im Admin */
  var TICK = 5;
  setInterval(function () {
    if (host && sid && document.visibilityState === "visible" && !inAdmin()) seconds += TICK;
  }, TICK * 1000);
  function device() {
    var standalone = (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches) || global.navigator.standalone;
    var ua = String(global.navigator.userAgent || "");
    var os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "sonst";
    return os + (standalone ? " App" : " Browser") + " " + Math.round(global.innerWidth || 0) + "px";
  }

  function start() {
    if (!host) return Promise.resolve();
    seconds = 0;
    sid = null;
    starting = host.send("go_usage_start", { p_device: device() }).then(function (r) {
      if (!r || !r.id) return;
      sid = r.id;
      n = r.n || 0;
      push(section(), "Start");
      if (n > 0 && n % ASK_EVERY === 0) setTimeout(ask, 2500);
    }).catch(function () {});
    return starting;
  }

  function push(sec, action) {
    if (!action) return;
    queue.push({ at: new Date().toISOString(), section: String(sec || "").slice(0, 40), action: String(action).slice(0, 80) });
    if (queue.length > 150) queue.splice(0, queue.length - 150);
  }

  function flush(keep) {
    if (!host || !sid) return;
    var evs = queue.splice(0, queue.length);
    host.send("go_usage_log", { p_session: sid, p_seconds: activeSeconds(), p_events: evs }, keep).catch(function () {
      /* nicht verloren: beim nächsten Mal mitschicken */
      queue = evs.concat(queue);
    });
  }

  /* Was wurde angetippt? Kurzer Name des Knopfs, keine Eingaben */
  function labelOf(el) {
    var t = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("data-title") || "";
    if (!t) t = String(el.textContent || "");
    t = t.replace(/\s+/g, " ").trim();
    if (!t) {
      var cls = String(el.className || "").split(/\s+/)[0] || el.tagName.toLowerCase();
      t = "[" + cls + "]";
    }
    if (el.closest(".god")) {
      var h = el.closest(".god").querySelector(".god__text");
      if (h) t = String(h.textContent || "").trim().slice(0, 30) + " → " + t;
    }
    return t.slice(0, 80);
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var pill = t.closest(".app-pill [data-shell]");
    if (pill) {
      var s = pill.getAttribute("data-shell");
      push(SECTION[s] || s, "Pille");
      return;
    }
    var el = t.closest("button, a, [role=button], [role=radio], [role=tab], summary, .go-tile, label, [data-open-comments]");
    if (!el) return;
    push(section(), labelOf(el));
  }
  function onChange(e) {
    var el = e.target;
    if (!el || el.tagName !== "SELECT") return;
    var opt = el.options && el.options[el.selectedIndex];
    push(section(), (el.getAttribute("aria-label") || el.id || "Auswahl") + ": " + (opt ? String(opt.textContent || "").trim() : ""));
  }

  function onVisibility() {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      flush(true);
      return;
    }
    if (hiddenAt && Date.now() - hiddenAt > NEW_AFTER) { hiddenAt = 0; start(); return; }
    hiddenAt = 0;
  }

  /* Jede 20. Sitzung: kurz nachfragen */
  function ask() {
    if (!global.GoDialog || !GoDialog.feedback || document.visibilityState !== "visible") return;
    if (document.querySelector(".god")) { setTimeout(ask, 4000); return; }
    var mySid = sid;
    GoDialog.feedback("Wie läuft die Sitzung heute?", {
      sub: "Haben Dich die Community und Dein Wochenplan positiv unterstützt?",
      options: [{ label: "Ja", value: "ja" }, { label: "Nein", value: "nein" }, { label: "Vielleicht", value: "vielleicht" }],
      placeholder: "Feedback",
      ok: "Absenden"
    }).then(function (r) {
      push(section(), r ? "Feedback: " + (r.answer || "ohne Antwort") : "Feedback: geschlossen");
      if (!r || (!r.answer && !r.text)) return;
      host.send("go_session_feedback_send", { p_session: mySid, p_answer: r.answer || null, p_body: r.text || null })
        .then(function () { if (host.toast) host.toast("Danke für Dein Feedback."); })
        .catch(function () { if (host.toast) host.toast("Senden ging gerade nicht."); });
    });
  }

  function init(h) {
    if (host) return;
    host = h;
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("visibilitychange", onVisibility);
    global.addEventListener("pagehide", function () { flush(true); });
    flushTimer = setInterval(function () { if (document.visibilityState === "visible") flush(false); }, 60000);
    start();
  }

  global.GoUsage = { init: init, track: function (action) { push(section(), action); }, ask: ask };
})(window);
