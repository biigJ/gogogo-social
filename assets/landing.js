(function () {
  var COLS = 4;
  var ROWS = 3;
  var FG = [0xc7, 0x41, 0x3b];
  var BG = [0xf7, 0xf5, 0xf0];
  var BAYER = [
    [0.03125, 0.53125, 0.15625, 0.65625],
    [0.78125, 0.28125, 0.90625, 0.40625],
    [0.21875, 0.71875, 0.09375, 0.59375],
    [0.96875, 0.46875, 0.84375, 0.34375]
  ];

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var grid = document.getElementById("lp-grid");
  var canvas = document.getElementById("lp-dither");
  var amount = document.getElementById("challenge-amount");
  var backEl = document.getElementById("challenge-back");
  if (!grid || !canvas) return;

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
    var scale = cw < 1100 ? 3 : 2;
    var w = Math.min(640, Math.floor(cw / scale));
    var h = Math.max(1, Math.round(w * (ch / cw)));
    if (tmp.width !== w || tmp.height !== h) {
      tmp.width = w;
      tmp.height = h;
    }
    if (canvas.width !== w * scale || canvas.height !== h * scale) {
      canvas.width = w * scale;
      canvas.height = h * scale;
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
    var out = ctx.createImageData(canvas.width, canvas.height);
    var od = out.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        g = (g - 128) * 1.15 + 128;
        if (g < 0) g = 0;
        else if (g > 255) g = 255;
        var on = g / 255 < BAYER[y % 4][x % 4];
        var r = on ? FG[0] : BG[0];
        var g2 = on ? FG[1] : BG[1];
        var b = on ? FG[2] : BG[2];
        for (var sy = 0; sy < scale; sy++) {
          for (var sx = 0; sx < scale; sx++) {
            var oi = ((y * scale + sy) * canvas.width + (x * scale + sx)) * 4;
            od[oi] = r;
            od[oi + 1] = g2;
            od[oi + 2] = b;
            od[oi + 3] = 255;
          }
        }
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
