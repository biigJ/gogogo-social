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
      /* X groß, Trefferfläche ringsum 18px größer (Pseudo-Element zählt zum Button) */
      ".gstory__top button{position:relative;border:0;background:transparent;color:#fff;display:grid;place-items:center;width:60px;height:60px;margin:-6px -4px 0 0;padding:0;cursor:pointer;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))}" +
      ".gstory__top button::before{content:'';position:absolute;inset:-18px -8px -18px -18px}" +
      ".gstory__txt{position:absolute;z-index:2;left:22px;right:22px;bottom:calc(env(safe-area-inset-bottom,0px) + 40px)}" +
      ".gstory .gstory__txt h3{margin:4px 0 8px !important;font-family:'Playfair Display',Georgia,serif !important;font-size:32px !important;font-weight:600 !important;line-height:1.1 !important;color:#fff !important;cursor:pointer}" +
      ".gstory__txt p{margin:0;font:600 16px/1.4 Inter,sans-serif}" +
      ".gstory__who{opacity:.85}" +
      ".gstory .gstory__list{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:3px;font:600 16px/1.3 Inter,sans-serif;text-align:left;color:#fff}" +
      ".gstory .gstory__list[hidden]{display:none}" +
      ".gstory .gstory__list li{display:flex;gap:12px;min-width:0}" +
      ".gstory .gstory__list li span:first-child{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".gstory .gstory__list li span:first-child::before{content:'· '}" +
      ".gstory .gstory__list li span+span{flex:none;opacity:.85;font-variant-numeric:tabular-nums}" +
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
    var i = 0, timer = null, startAt = 0, left = DUR, held = false, holdT = null, downX = 0, downY = 0, downAt = 0;
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
      /* Ende: nächste Person (opts.onEnd), sonst zurück */
      if (i >= items.length) { close(); if (opts.onEnd) opts.onEnd(); return; }
      if (i < 0) i = 0;
      var it = items[i];
      wrap.innerHTML =
        (it.bg ? '<img class="gstory__bg" src="' + esc(it.bg) + '" alt="" />' : "") +
        '<div class="gstory__top"><span>' + esc(opts.title || "") + '</span><button type="button" data-gstory-close aria-label="Schließen"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5 5 19"/></svg></button></div>' +
        '<div class="gstory__txt">' +
        (it.who ? '<p class="gstory__who">' + esc(it.who) + "</p>" : "") +
        '<h3 data-gstory-open="1">' + esc(it.title || "Training") + "</h3>" +
        (it.sub ? "<p>" + esc(it.sub) + "</p>" : "") +
        (it.loadList ? '<ul class="gstory__list" hidden></ul>' : "") +
        (it.note ? '<p class="gstory__note">' + esc(it.note) + "</p>" : "") +
        (it.done ? '<p class="gstory__done">Erledigt ✓</p>' : "") +
        "</div>" +
        '<div class="gstory__bars">' + items.map(function (_, k) {
          return '<span class="' + (k < i ? "is-done" : k === i ? "is-now" : "") + '"><i></i></span>';
        }).join("") + "</div>";
      held = false;
      wrap.classList.remove("is-held");
      /* Übungsliste kommt asynchron; nur einsetzen, wenn die Story noch dieselbe ist */
      if (it.loadList) {
        var at = i;
        Promise.resolve(it.loadList()).then(function (html) {
          var ul = wrap.querySelector(".gstory__list");
          if (at !== i || !ul || !html) return;
          ul.innerHTML = html;
          ul.hidden = false;
        }).catch(function () {});
      }
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
      downY = e.clientY;
      downAt = Date.now();
      clearTimeout(holdT);
      holdT = setTimeout(pause, HOLD_MS);
    });
    function up(e) {
      clearTimeout(holdT);
      /* X zuerst: auf iOS kommt nach touchend kein click (preventDefault unten), pointerdown auf dem X setzt downAt nicht */
      if (e.target.closest && e.target.closest("[data-gstory-close]")) { close(); return; }
      if (!downAt) return;
      var wasHeld = held || Date.now() - downAt >= HOLD_MS;
      downAt = 0;
      /* nach unten wischen schließt (wie Instagram) */
      var dy = e.clientY - downY, dx = e.clientX - downX;
      if (dy > 70 && Math.abs(dy) > Math.abs(dx) * 1.3) { close(); return; }
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
