(function (global) {
  var LANDING = "https://www.gogogo.social/go";
  var DARK = "#F7F5F0";
  var PAGE = "#C7413B";

  function renderGoQr(mount, url, colors) {
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
      colorDark: (colors && colors.dark) || DARK,
      colorLight: (colors && colors.light) || PAGE,
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  global.GOGOGO_LANDING = LANDING;
  global.renderGoQr = renderGoQr;
})(window);
