/* go-story.js — Story-Ansicht für Kreise in Aktuell (Bubble-Orte, Freunde-Posts, eigener Post, heutiges Event)
 *   GoStory.open(items, opts)
 *     items: [{ bg, who, title, sub, note, done, id }]
 *     opts:  { title, color, onItem(item) }   onItem: Tipp auf den Titel öffnet das Event
 *   Je Eintrag 5 s, Zeitstrahl unten. Finger halten = anhalten. Tipp links = zurück, rechts = weiter.
 */
(function (global) {
  "use strict";
  var DUR = 5000;
  var HOLD_MS = 180;
  var cssDone = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ensureCss() {
    if (cssDone) return;
    cssDone = true;
    var st = document.createElement("style");
    st.textContent =
      ".gstory{position:fixed;inset:0;z-index:10080;background:var(--gstory,#2A2118);color:#fff;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}" +
      ".gstory__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}" +
      ".gstory::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,0) 28%,rgba(0,0,0,0) 45%,rgba(0,0,0,.75))}" +
      ".gstory__top{position:absolute;z-index:2;top:calc(env(safe-area-inset-top,0px) + 12px);left:16px;right:8px;display:flex;justify-content:space-between;align-items:center;font:700 15px Inter,sans-serif}" +
      ".gstory__top button{border:0;background:transparent;color:#fff;font-size:32px;width:44px;height:44px;cursor:pointer}" +
      ".gstory__txt{position:absolute;z-index:2;left:22px;right:22px;bottom:calc(env(safe-area-inset-bottom,0px) + 40px)}" +
      ".gstory .gstory__txt h3{margin:4px 0 8px !important;font-family:'Playfair Display',Georgia,serif !important;font-size:32px !important;font-weight:600 !important;line-height:1.1 !important;color:#fff !important;cursor:pointer}" +
      ".gstory__txt p{margin:0;font:600 16px/1.4 Inter,sans-serif}" +
      ".gstory__who{opacity:.85}" +
      ".gstory__note{margin-top:8px !important;font-weight:500 !important}" +
      ".gstory__done{margin-top:8px !important}" +
      ".gstory__bars{position:absolute;z-index:3;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);display:flex;gap:4px}" +
      ".gstory__bars span{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.35);overflow:hidden}" +
      ".gstory__bars i{display:block;height:100%;width:0;background:#fff}" +
      ".gstory__bars .is-done i{width:100%}" +
      ".gstory__bars .is-now i{animation:gstorybar " + DUR + "ms linear forwards}" +
      ".gstory.is-held .gstory__bars .is-now i{animation-play-state:paused}" +
      "@keyframes gstorybar{from{width:0}to{width:100%}}";
    document.head.appendChild(st);
  }

  function open(items, opts) {
    items = (items || []).filter(Boolean);
    opts = opts || {};
    if (!items.length) return false;
    ensureCss();
    var i = 0, timer = null, startAt = 0, left = DUR, held = false, holdT = null, downX = 0, downAt = 0;
    var wrap = document.createElement("div");
    wrap.className = "gstory";
    wrap.setAttribute("role", "dialog");
    wrap.style.setProperty("--gstory", opts.color || "#2A2118");
    document.body.appendChild(wrap);

    function close() {
      clearTimeout(timer);
      clearTimeout(holdT);
      wrap.remove();
      swallowClick();
    }
    /* Story schließt bei pointerup; der folgende click landete sonst auf dem Event darunter (Stempelkarte) */
    function swallowClick() {
      function eat(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
      document.addEventListener("click", eat, true);
      setTimeout(function () { document.removeEventListener("click", eat, true); }, 450);
    }
    function run(ms) {
      clearTimeout(timer);
      left = ms;
      startAt = Date.now();
      timer = setTimeout(function () { i++; show(); }, ms);
    }
    function show() {
      clearTimeout(timer);
      if (i >= items.length) { close(); return; }
      if (i < 0) i = 0;
      var it = items[i];
      wrap.innerHTML =
        (it.bg ? '<img class="gstory__bg" src="' + esc(it.bg) + '" alt="" />' : "") +
        '<div class="gstory__top"><span>' + esc(opts.title || "") + '</span><button type="button" data-gstory-close aria-label="Schließen">×</button></div>' +
        '<div class="gstory__txt">' +
        (it.who ? '<p class="gstory__who">' + esc(it.who) + "</p>" : "") +
        '<h3 data-gstory-open="1">' + esc(it.title || "Training") + "</h3>" +
        (it.sub ? "<p>" + esc(it.sub) + "</p>" : "") +
        (it.note ? '<p class="gstory__note">' + esc(it.note) + "</p>" : "") +
        (it.done ? '<p class="gstory__done">Erledigt ✓</p>' : "") +
        "</div>" +
        '<div class="gstory__bars">' + items.map(function (_, k) {
          return '<span class="' + (k < i ? "is-done" : k === i ? "is-now" : "") + '"><i></i></span>';
        }).join("") + "</div>";
      held = false;
      wrap.classList.remove("is-held");
      run(DUR);
    }
    function pause() {
      if (held) return;
      held = true;
      clearTimeout(timer);
      left = Math.max(0, left - (Date.now() - startAt));
      wrap.classList.add("is-held");
    }
    function resume() {
      if (!held) return;
      held = false;
      wrap.classList.remove("is-held");
      run(left);
    }

    wrap.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest("[data-gstory-close]")) return;
      downX = e.clientX;
      downAt = Date.now();
      clearTimeout(holdT);
      holdT = setTimeout(pause, HOLD_MS);
    });
    function up(e) {
      clearTimeout(holdT);
      if (!downAt) return;
      var wasHeld = held || Date.now() - downAt >= HOLD_MS;
      downAt = 0;
      if (e.target.closest && e.target.closest("[data-gstory-close]")) { close(); return; }
      if (wasHeld) { resume(); return; }
      if (e.target.closest && e.target.closest("[data-gstory-open]") && opts.onItem) {
        var it = items[i];
        close();
        opts.onItem(it);
        return;
      }
      i += downX < window.innerWidth / 3 ? -1 : 1;
      show();
    }
    wrap.addEventListener("pointerup", up);
    /* iOS: kein synthetischer click nach dem Tippen (Story ist dann schon weg, click träfe das Event darunter) */
    wrap.addEventListener("touchend", function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
    wrap.addEventListener("pointercancel", function () { clearTimeout(holdT); downAt = 0; resume(); });
    wrap.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    wrap.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-gstory-close]")) close();
    });
    show();
    return true;
  }

  global.GoStory = { open: open, DURATION: DUR };
})(window);
