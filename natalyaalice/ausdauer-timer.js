/* ausdauer-timer.js — Eieruhr für Ausdauer-Events
 *
 *   GoTimer.init({ onFinish(eventId, title) })   Rückruf, wenn die Zeit um ist und „Speichern“ getippt wird
 *   GoTimer.start({ id, title, minutes })        Dauer wählen (Drehauswahl), dann läuft die Uhr
 *   GoTimer.resume()                             nach App-Start: laufende Uhr wieder anzeigen
 *
 * Die Uhr rechnet mit dem Endzeitpunkt (localStorage), läuft also weiter, wenn die App geschlossen ist.
 */
(function (global) {
  "use strict";

  var KEY = "gogogo_timer";
  var hooks = {};
  var root = null;
  var tick = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function write(t) {
    try {
      if (t) localStorage.setItem(KEY, JSON.stringify(t));
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }
  function left(t) {
    if (!t) return 0;
    if (t.pausedLeft != null) return t.pausedLeft;
    return Math.max(0, t.end - Date.now());
  }
  function fmt(ms) {
    var s = Math.ceil(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(r).padStart(2, "0");
  }

  var CSS =
    ".gtm{position:fixed;inset:0;z-index:10040;background:#F3EEE4;color:#2A2118;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px calc(24px + env(safe-area-inset-bottom));text-align:center}" +
    ".gtm h2{margin:0 0 6px;font:600 26px/1.2 'Playfair Display',Georgia,serif}" +
    ".gtm p{margin:0 0 18px;font-size:15px;color:rgba(42,33,24,.7)}" +
    ".gtm__ring{position:relative;width:min(72vw,280px);aspect-ratio:1;margin:8px 0 26px}" +
    ".gtm__ring svg{width:100%;height:100%;transform:rotate(-90deg)}" +
    ".gtm__ring circle{fill:none;stroke-width:10}" +
    ".gtm__bg{stroke:rgba(42,33,24,.12)}.gtm__fg{stroke:#2A2118;stroke-linecap:round;transition:stroke-dashoffset .9s linear}" +
    ".gtm__time{position:absolute;inset:0;display:grid;place-items:center;font:700 54px/1 Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums}" +
    ".gtm__btn{display:block;width:100%;max-width:340px;min-height:52px;margin:8px 0 0;border:0;border-radius:999px;background:#2A2118;color:#F6F1E8;font:inherit;font-size:16px;font-weight:700;cursor:pointer}" +
    ".gtm__btn--quiet{background:transparent;color:#2A2118;border:1.5px solid #2A2118}" +
    ".gtm__wheel{width:200px;height:52px;overflow-y:auto;scroll-snap-type:y mandatory;border:1.5px solid #2A2118;border-radius:14px;scrollbar-width:none;margin:0 0 22px}" +
    ".gtm__wheel::-webkit-scrollbar{display:none}" +
    ".gtm__opt{height:52px;line-height:52px;scroll-snap-align:start;font-size:20px;font-weight:700}" +
    "body.gtm-open .app-pill{display:none !important}";

  function ensureCss() {
    if (document.getElementById("gtm-css")) return;
    var st = document.createElement("style");
    st.id = "gtm-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function shell(html) {
    ensureCss();
    if (!root) {
      root = document.createElement("div");
      root.className = "gtm";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      document.body.appendChild(root);
      document.body.classList.add("gtm-open");
    }
    root.innerHTML = html;
    return root;
  }
  function closeUi() {
    clearInterval(tick);
    tick = null;
    if (root) root.remove();
    root = null;
    document.body.classList.remove("gtm-open");
  }

  var MINUTES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 105, 120, 150, 180];

  /* Schritt 1: Dauer wählen */
  function start(opts) {
    opts = opts || {};
    var run = read();
    if (run && left(run) > 0) { resume(); return; }
    var want = Number(opts.minutes) || 30;
    var idx = 0;
    MINUTES.forEach(function (m, i) { if (Math.abs(m - want) < Math.abs(MINUTES[idx] - want)) idx = i; });
    var el = shell(
      "<h2>" + esc(opts.title || "Ausdauer") + "</h2><p>Wie lange? Wischen zum Ändern.</p>" +
      '<div class="gtm__wheel" data-gtm-wheel>' + MINUTES.map(function (m) { return '<div class="gtm__opt">' + m + " min</div>"; }).join("") + "</div>" +
      '<button type="button" class="gtm__btn" data-gtm-go>Start</button>' +
      '<button type="button" class="gtm__btn gtm__btn--quiet" data-gtm-cancel>Abbrechen</button>'
    );
    var wheel = el.querySelector("[data-gtm-wheel]");
    requestAnimationFrame(function () { wheel.scrollTop = idx * 52; });
    el.onclick = function (e) {
      if (e.target.closest("[data-gtm-cancel]")) { closeUi(); return; }
      if (e.target.closest("[data-gtm-go]")) {
        var i = Math.max(0, Math.min(MINUTES.length - 1, Math.round(wheel.scrollTop / 52)));
        var ms = MINUTES[i] * 60000;
        write({ id: String(opts.id || ""), title: opts.title || "Ausdauer", total: ms, end: Date.now() + ms, pausedLeft: null });
        resume();
      }
    };
  }

  /* Schritt 2: Uhr läuft */
  function resume() {
    var t = read();
    if (!t) return;
    var C = 2 * Math.PI * 54;
    var el = shell(
      "<h2>" + esc(t.title) + "</h2><p>Die Uhr läuft weiter, auch wenn Du die App schließt.</p>" +
      '<div class="gtm__ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="gtm__bg" cx="60" cy="60" r="54"/>' +
      '<circle class="gtm__fg" cx="60" cy="60" r="54" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="0"/></svg>' +
      '<div class="gtm__time" data-gtm-time></div></div>' +
      '<button type="button" class="gtm__btn" data-gtm-pause></button>' +
      '<button type="button" class="gtm__btn gtm__btn--quiet" data-gtm-finish>Fertig</button>' +
      '<button type="button" class="gtm__btn gtm__btn--quiet" data-gtm-stop>Abbrechen</button>'
    );
    var timeEl = el.querySelector("[data-gtm-time]");
    var fg = el.querySelector(".gtm__fg");
    var pauseBtn = el.querySelector("[data-gtm-pause]");
    function paint() {
      var cur = read();
      if (!cur) return;
      var l = left(cur);
      timeEl.textContent = fmt(l);
      fg.setAttribute("stroke-dashoffset", (C * (1 - l / (cur.total || 1))).toFixed(1));
      pauseBtn.textContent = cur.pausedLeft != null ? "Weiter" : "Pause";
      if (l <= 0) done(cur);
    }
    clearInterval(tick);
    tick = setInterval(paint, 1000);
    paint();
    el.onclick = function (e) {
      var cur = read();
      if (!cur) return;
      if (e.target.closest("[data-gtm-pause]")) {
        if (cur.pausedLeft != null) { cur.end = Date.now() + cur.pausedLeft; cur.pausedLeft = null; }
        else { cur.pausedLeft = left(cur); }
        write(cur);
        paint();
        return;
      }
      if (e.target.closest("[data-gtm-finish]")) { done(cur); return; }
      if (e.target.closest("[data-gtm-stop]")) {
        var ask = global.GoDialog ? GoDialog.confirm("Uhr abbrechen? Nichts wird gespeichert.", { ok: "Abbrechen" }) : Promise.resolve(true);
        ask.then(function (ok) {
          if (!ok) return;
          var cid = cur && cur.id;
          write(null);
          closeUi();
          /* Aktuell: Status „dabei“ zurücknehmen */
          try { document.dispatchEvent(new CustomEvent("go:start-cancel", { detail: { id: cid } })); } catch (eC) {}
        });
      }
    };
  }

  /* Schritt 3: geschafft → Speichern übergibt an Aktuell (Erledigt-Dialog) */
  function done(t) {
    clearInterval(tick);
    tick = null;
    write(null);
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    var el = shell(
      "<h2>Geschafft</h2><p>" + esc(t.title) + " · " + Math.round((t.total || 0) / 60000) + " min</p>" +
      '<button type="button" class="gtm__btn" data-gtm-save>Speichern</button>' +
      '<button type="button" class="gtm__btn gtm__btn--quiet" data-gtm-close>Schließen</button>'
    );
    el.onclick = function (e) {
      if (e.target.closest("[data-gtm-save]")) {
        closeUi();
        if (hooks.onFinish) hooks.onFinish(t.id, t.title);
        return;
      }
      if (e.target.closest("[data-gtm-close]")) closeUi();
    };
  }

  global.GoTimer = {
    init: function (h) { hooks = h || {}; },
    start: start,
    resume: function () { var t = read(); if (t) { if (left(t) > 0 || t.pausedLeft != null) resume(); else done(t); } },
    running: function () { var t = read(); return !!t; }
  };
})(window);
