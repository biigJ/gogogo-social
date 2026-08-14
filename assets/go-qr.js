(function (global) {
  var LANDING = "https://www.gogogo.social/go";
  var DARK = "#0A0A0A";
  var PAGE = "#C7413B";

  function renderGoQr(mount, url) {
    if (!mount) return;
    mount.innerHTML = "";
    url = url || LANDING;
    if (typeof QRCode !== "function") {
      mount.textContent = url;
      return;
    }
    new QRCode(mount, {
      text: url,
      width: 220,
      height: 220,
      colorDark: DARK,
      colorLight: PAGE,
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  global.GOGOGO_LANDING = LANDING;
  global.renderGoQr = renderGoQr;
})(window);
