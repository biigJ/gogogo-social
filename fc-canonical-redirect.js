/** On fridaycircle.club: send brand traffic to canonical domains (sources stay in-repo for export). */
(function () {
  if (!/fridaycircle\.club$/i.test(location.hostname)) return;

  var path = location.pathname.replace(/\/+$/, "") || "/";
  var tail = location.search + location.hash;
  var gogogo = "https://gogogo.social";
  var kunst = "https://biig.works/kunst/";
  var biig = "https://biig.works";

  if (/\/gogogo-landing\.html$/i.test(path) || path.endsWith("/gogogo-landing")) {
    location.replace(gogogo + "/" + tail);
    return;
  }

  if (/\/register-accountability(\/index\.html)?$/i.test(path) || path.endsWith("/register-accountability")) {
    location.replace(gogogo + "/register-accountability/" + tail);
    return;
  }

  if (/\/register-training(\/index\.html)?$/i.test(path) || path.endsWith("/register-training")) {
    location.replace(gogogo + "/register-training/" + tail);
    return;
  }

  if (/\/start(\/index\.html)?$/i.test(path) || path.endsWith("/start")) {
    location.replace(gogogo + "/start/" + tail);
    return;
  }

  var gogogoPages = [
    "cycle-training.html",
    "cycle-table.html",
    "cycle-table-mobile.html",
    "gogogo-quiz.html",
    "joschaalstrainer.html",
    "joschaalscoach.html",
    "register.html",
    "gogogo.html",
  ];
  for (var i = 0; i < gogogoPages.length; i++) {
    var name = gogogoPages[i];
    if (path.endsWith("/" + name) || path === "/" + name) {
      location.replace(gogogo + "/" + name + tail);
      return;
    }
  }

  if (/\/wolfganggrope\.html$/i.test(path) || path.endsWith("/wolfganggrope")) {
    location.replace(kunst + tail.replace(/^\//, ""));
    return;
  }

  var biigMatch = path.match(/\/biig-interior(\/.*)?$/i);
  if (biigMatch) {
    var sub = biigMatch[1] || "";
    if (sub === "/index.html") sub = "";
    if (sub.endsWith("/index.html")) sub = sub.slice(0, -"/index.html".length);
    if (/^\/kunst(\/|$)/i.test(sub)) {
      location.replace(kunst + tail.replace(/^\//, ""));
      return;
    }
    location.replace(biig + (sub || "/") + tail);
  }
})();
