(function () {
  var el = document.getElementById("legal-back");
  if (!el) return;
  var loggedIn = false;
  try {
    var account = JSON.parse(localStorage.getItem("gogogo_go_account") || "null");
    loggedIn = !!(account && account.name);
  } catch (e) {}
  var fromApp = /[?&]from=app\b/.test(location.search) || /\/workout\//.test(document.referrer || "");
  /* Aus der App: nur Zurück-Icon, zurück zu Profil → Einstellungen */
  if (fromApp) {
    el.setAttribute("href", "/workout/?plan=settings");
    el.setAttribute("aria-label", "Zurück");
    el.classList.add("legal__back--icon");
    el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 6.5 8.2 12l6 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    [].forEach.call(document.querySelectorAll(".legal__nav a"), function (a) {
      if (a.getAttribute("href").indexOf("?") < 0) a.setAttribute("href", a.getAttribute("href") + "?from=app");
    });
    return;
  }
  el.setAttribute("href", loggedIn ? "/account/" : "/");
})();
