(function () {
  var COLS = 4;
  var ROWS = 3;
  var FG = [0xc7, 0x41, 0x3b];
  var BG = [0xf7, 0xf5, 0xf0];
  /* 8×8 Bayer — feineres Raster, mehr Bilddetail sichtbar */
  var BAYER = [
    [0 / 64, 32 / 64, 8 / 64, 40 / 64, 2 / 64, 34 / 64, 10 / 64, 42 / 64],
    [48 / 64, 16 / 64, 56 / 64, 24 / 64, 50 / 64, 18 / 64, 58 / 64, 26 / 64],
    [12 / 64, 44 / 64, 4 / 64, 36 / 64, 14 / 64, 46 / 64, 6 / 64, 38 / 64],
    [60 / 64, 28 / 64, 52 / 64, 20 / 64, 62 / 64, 30 / 64, 54 / 64, 22 / 64],
    [3 / 64, 35 / 64, 11 / 64, 43 / 64, 1 / 64, 33 / 64, 9 / 64, 41 / 64],
    [51 / 64, 19 / 64, 59 / 64, 27 / 64, 49 / 64, 17 / 64, 57 / 64, 25 / 64],
    [15 / 64, 47 / 64, 7 / 64, 39 / 64, 13 / 64, 45 / 64, 5 / 64, 37 / 64],
    [63 / 64, 31 / 64, 55 / 64, 23 / 64, 61 / 64, 29 / 64, 53 / 64, 21 / 64]
  ];

  var TRAINER_MAIL =
    "mailto:mail@bjgrope.de?subject=" + encodeURIComponent("Trainer werden") +
    "&body=" + encodeURIComponent(
      "Hallo Joscha, ich bin xxx und wohne in Berlin. Gerne möchte ich zu Deinem Netzwerk gehören. Ich bin Personal Trainer mit dem Schwerpunkt xxx. Du erreichst mich am besten unter dieser Email oder ruf mich an unter xxx.\n\nGruß,\nxxx"
    );

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var grid = document.getElementById("lp-grid");
  var canvas = document.getElementById("lp-dither");
  var amount = document.getElementById("challenge-amount");
  var backEl = document.getElementById("challenge-back");
  if (!grid || !canvas) return;

  document.querySelectorAll("[data-trainer-mail]").forEach(function (el) {
    el.setAttribute("href", TRAINER_MAIL);
  });

  var tiles = Array.prototype.slice.call(grid.querySelectorAll("video, img"));
  var videos = tiles.filter(function (el) { return el.tagName === "VIDEO"; });
  var ctx = canvas.getContext("2d", { alpha: false });
  var tmp = document.createElement("canvas");
  var tctx = tmp.getContext("2d", { willReadFrequently: true });
  var running = false;
  var raf = 0;

  function drawCover(target, media, dx, dy, dw, dh) {
    var mw = media.videoWidth || media.naturalWidth || 0;
    var mh = media.videoHeight || media.naturalHeight || 0;
    if (!mw || !mh) {
      target.fillStyle = "#F7F5F0";
      target.fillRect(dx, dy, dw, dh);
      return;
    }
    var cover = Math.max(dw / mw, dh / mh);
    var w = mw * cover;
    var h = mh * cover;
    target.drawImage(media, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
  }

  function frame() {
    raf = 0;
    var cw = canvas.clientWidth || window.innerWidth;
    var ch = canvas.clientHeight || window.innerHeight;
    if (cw < 2 || ch < 2) {
      if (running) raf = requestAnimationFrame(frame);
      return;
    }
    var scale = 1;
    var w = Math.min(1920, Math.max(480, cw));
    var h = Math.max(1, Math.round(w * (ch / cw)));
    if (tmp.width !== w || tmp.height !== h) {
      tmp.width = w;
      tmp.height = h;
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    tctx.fillStyle = "#F7F5F0";
    tctx.fillRect(0, 0, w, h);
    var cellW = w / COLS;
    var cellH = h / ROWS;
    tiles.forEach(function (media, i) {
      var col = i % COLS;
      var row = Math.floor(i / COLS);
      try {
        drawCover(tctx, media, col * cellW, row * cellH, cellW, cellH);
      } catch (e) {}
    });

    var data = tctx.getImageData(0, 0, w, h);
    var px = data.data;
    var out = ctx.createImageData(w, h);
    var od = out.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        g = (g - 128) * 1.02 + 128;
        if (g < 0) g = 0;
        else if (g > 255) g = 255;
        var threshold = BAYER[y % 8][x % 8];
        var on = g / 255 < threshold;
        var mix = on ? 0.82 : 0.18;
        var r = Math.round(px[i] * mix + (on ? FG[0] : BG[0]) * (1 - mix));
        var g2 = Math.round(px[i + 1] * mix + (on ? FG[1] : BG[1]) * (1 - mix));
        var b = Math.round(px[i + 2] * mix + (on ? FG[2] : BG[2]) * (1 - mix));
        var oi = i;
        od[oi] = r;
        od[oi + 1] = g2;
        od[oi + 2] = b;
        od[oi + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    if (running) raf = requestAnimationFrame(frame);
  }

  function startVideos() {
    videos.forEach(function (vid) {
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});
    });
  }

  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  if (!reduceMotion) {
    startVideos();
    start();
  } else {
    window.setTimeout(frame, 300);
  }

  window.addEventListener("resize", function () {
    if (!running) frame();
  });

  function updateBack() {
    if (!amount || !backEl) return;
    var n = parseInt(amount.value, 10);
    if (!(n >= 30 && n <= 999)) {
      backEl.textContent = "Zahl 30 bis 999 € ein — bis zu 90% zurück, wenn Du alle 28 trainierst.";
      return;
    }
    var refund = Math.round(n * 0.9);
    backEl.textContent = "Bis zu " + refund + " € zurück, wenn Du alle 28 Tage trainierst.";
  }

  if (amount) {
    amount.addEventListener("input", updateBack);
    amount.addEventListener("blur", function () {
      var n = parseInt(amount.value, 10);
      if (!(n >= 30 && n <= 999)) amount.value = 30;
      else if (n > 999) amount.value = 999;
      updateBack();
    });
    updateBack();
  }
})();
