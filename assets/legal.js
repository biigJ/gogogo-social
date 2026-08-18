(function () {
  var el = document.getElementById("legal-back");
  if (!el) return;
  var loggedIn = false;
  try {
    var account = JSON.parse(localStorage.getItem("gogogo_go_account") || "null");
    loggedIn = !!(account && account.name);
  } catch (e) {}
  el.setAttribute("href", loggedIn ? "/account/" : "/");
})();
