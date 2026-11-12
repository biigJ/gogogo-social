(function (global) {
  /* Sofort: Creme-Verlaufsüberlagerung .top-edge entfernen (auch bei alter HTML). */
  (function gogogoKillTopEdgeNow() {
    try {
      var css = document.createElement("style");
      css.id = "gogogo-kill-fade-boot";
      css.textContent = 'html.is-standalone body.is-session:not([data-shell="workout"]) .top-edge,html.is-standalone body.is-session .top-edge,.top-edge,.heute-status-fade{display:none!important;opacity:0!important;visibility:hidden!important;height:0!important;max-height:0!important;background:none!important;background-image:none!important;}html.is-standalone body.is-session::before,html.is-standalone body.is-session[data-shell]::before{content:none!important;display:none!important;background:none!important;}';
      (document.documentElement || document.head).appendChild(css);
      var killNodes = function () {
        document.querySelectorAll(".top-edge,.heute-status-fade").forEach(function (el) {
          try {
            el.style.cssText = "display:none!important;height:0!important;background:none!important;";
            if (el.parentNode) el.parentNode.removeChild(el);
          } catch (e0) {}
        });
      };
      killNodes();
      document.addEventListener("DOMContentLoaded", killNodes);
      setInterval(killNodes, 250);
    } catch (eBoot) {}
  })();

  var ACCOUNT_KEY = "gogogo_go_account";
  var COOKIE_NAME = "gogogo_go_account";
  var MAX_AGE = 60 * 60 * 24 * 400;

  function slimAccount(account) {
    if (!account || !account.name) return null;
    var slim = {
      id: account.id || null,
      name: account.name,
      phone: account.phone || null,
      invite_code: account.invite_code || null,
      serial_number: account.serial_number || null,
      created_at: account.created_at || null
    };
    if (account.is_trainer) slim.is_trainer = true;
    if (account.trainer_id) slim.trainer_id = account.trainer_id;
    if (account.training_date) slim.training_date = account.training_date;
    return slim;
  }

  function writeCookie(account) {
    var slim = slimAccount(account);
    if (!slim) return;
    var raw = encodeURIComponent(JSON.stringify(slim));
    if (raw.length > 3500) {
      delete slim.photo_url;
      raw = encodeURIComponent(JSON.stringify(slim));
    }
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      COOKIE_NAME + "=" + raw + "; Path=/; Max-Age=" + MAX_AGE + "; SameSite=Lax" + secure;
  }

  function readCookie() {
    var parts = String(document.cookie || "").split(";");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf(COOKIE_NAME + "=") !== 0) continue;
      try {
        return JSON.parse(decodeURIComponent(p.slice(COOKIE_NAME.length + 1)));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function loadAccount() {
    var local = null;
    try {
      local = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null");
    } catch (e) {
      local = null;
    }
    if (local && local.name) {
      writeCookie(local);
      return local;
    }
    var fromCookie = readCookie();
    if (fromCookie && fromCookie.name) {
      try {
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(fromCookie));
      } catch (e2) {}
      return fromCookie;
    }
    return null;
  }

  function saveAccount(account) {
    if (!account || !account.name) return;
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    } catch (e) {}
    writeCookie(account);
  }

  function clearAccount() {
    try {
      localStorage.removeItem(ACCOUNT_KEY);
    } catch (e) {}
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = COOKIE_NAME + "=; Path=/; Max-Age=0; SameSite=Lax" + secure;
  }

  function requestPersist() {
    try {
      if (navigator.storage && typeof navigator.storage.persist === "function") {
        navigator.storage.persist().catch(function () {});
      }
    } catch (e) {}
  }

  global.GoAccountSession = {
    KEY: ACCOUNT_KEY,
    load: loadAccount,
    save: saveAccount,
    clear: clearAccount,
    persist: requestPersist
  };

  // Verlauf-Killer gegen gecachte Homescreen-PWA (altes .top-edge auf allen Tabs).
  (function gogogoWorkoutBoot() {
    var BUILD = "nav5-kill-11";
    var path = String(location.pathname || "").replace(/\/index\.html$/, "").replace(/\/+$/, "");
    var onWorkout = path === "/workout" || path === "/natalyaalice" || path.indexOf("/natalyaalice/") === 0;
    if (!onWorkout) return;

    function killFade() {
      var css = document.getElementById("gogogo-kill-fade");
      if (!css) {
        css = document.createElement("style");
        css.id = "gogogo-kill-fade";
        css.textContent = [
          'html.is-standalone body.is-session:not([data-shell="workout"]) .top-edge,',
          "html.is-standalone body.is-session .top-edge,",
          "html body.is-session .top-edge,",
          "body .top-edge,.top-edge,.heute-status-fade,#heute-status-fade{",
          "display:none!important;opacity:0!important;visibility:hidden!important;",
          "pointer-events:none!important;height:0!important;max-height:0!important;",
          "background:transparent!important;background-image:none!important;}",
          "html.is-standalone body.is-session::before,",
          "html.is-standalone body.is-session[data-shell]::before,",
          'html.is-standalone body.is-session[data-shell="heute"]::before{',
          "content:none!important;display:none!important;background:none!important;height:0!important;}"
        ].join("");
        (document.head || document.documentElement).appendChild(css);
      }
      document.querySelectorAll(".top-edge, .heute-status-fade, #heute-status-fade").forEach(function (el) {
        try {
          el.style.cssText = "display:none!important;opacity:0!important;height:0!important;background:transparent!important;";
          if (el.parentNode) el.parentNode.removeChild(el);
        } catch (eHide) {}
      });
    }

    killFade();

    try {
      if (window.caches && caches.keys) {
        caches.keys().then(function (keys) {
          keys.forEach(function (k) { caches.delete(k); });
        });
      }
    } catch (eCache) {}

    try {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.register("/natalyaalice/sw-kill.js?v=" + BUILD).catch(function () {});
      }
    } catch (eSw) {}

    try {
      var url = new URL(location.href);
      var need = url.searchParams.get("_cb") !== BUILD;
      if (need) {
        localStorage.setItem("gogogo_workout_build", BUILD);
        url.searchParams.set("_cb", BUILD);
        url.searchParams.set("_t", String(Date.now()));
        /* Neuer Dokument-Request — umgeht iOS-PWA-HTML-Cache */
        location.replace(url.pathname + "?" + url.searchParams.toString() + url.hash);
        return;
      }
      localStorage.setItem("gogogo_workout_build", BUILD);
    } catch (eBuild) {}

    document.addEventListener("DOMContentLoaded", killFade);
    var ticks = 0;
    var timer = setInterval(function () {
      killFade();
      if (++ticks > 100) clearInterval(timer);
    }, 80);
    try {
      new MutationObserver(killFade).observe(document.documentElement, { childList: true, subtree: true });
    } catch (eObs) {}
  })();
})(window);
