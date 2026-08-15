(function () {
  function ensureOverlay() {
    if (document.getElementById("orient-lock")) return;
    var el = document.createElement("div");
    el.id = "orient-lock";
    el.className = "orient-lock";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-label", "Bitte Hochformat");
    el.innerHTML = "Bitte drehe Dein Handy<br />ins Hochformat.";
    if (document.body) document.body.insertBefore(el, document.body.firstChild);
  }

  function tryLockPortrait() {
    try {
      var orient = screen.orientation || screen.mozOrientation || screen.msOrientation;
      if (orient && typeof orient.lock === "function") {
        orient.lock("portrait").catch(function () {});
      } else if (typeof screen.lockOrientation === "function") {
        screen.lockOrientation("portrait");
      } else if (typeof screen.mozLockOrientation === "function") {
        screen.mozLockOrientation("portrait");
      }
    } catch (e) {}
  }

  function boot() {
    ensureOverlay();
    tryLockPortrait();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  window.addEventListener("orientationchange", tryLockPortrait);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) tryLockPortrait();
  });
})();
