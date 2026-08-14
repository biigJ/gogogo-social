(function () {
  var el = document.getElementById("legal-back");
  if (!el) return;
  el.addEventListener("click", function (e) {
    try {
      if (document.referrer && new URL(document.referrer).origin === location.origin) {
        e.preventDefault();
        history.back();
      }
    } catch (err) {}
  });
})();
