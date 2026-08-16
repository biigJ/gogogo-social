/* Shared Bayer dither + square crop helpers for gogogo /go account */
(function (global) {
  var FG = [0xc7, 0x41, 0x3b];
  var BG = [0xf7, 0xf5, 0xf0];
  /* 8×8 Bayer — feineres Halftone als 4×4 */
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

  function ditherSquare(sourceCanvas, scale) {
    /* scale 1 = feinstes Raster (1 Quellpixel → 1 Ausgabepixel) */
    scale = scale == null ? 1 : Math.max(1, Math.floor(scale));
    var sw = sourceCanvas.width;
    var sh = sourceCanvas.height;
    var size = Math.min(sw, sh);
    var sx = Math.floor((sw - size) / 2);
    var sy = Math.floor((sh - size) / 2);

    var w = Math.max(1, Math.floor(size / scale));
    var h = w;
    var tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    var tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(sourceCanvas, sx, sy, size, size, 0, 0, w, h);
    var data = tctx.getImageData(0, 0, w, h);
    var px = data.data;

    var out = document.createElement("canvas");
    out.width = w * scale;
    out.height = h * scale;
    var octx = out.getContext("2d");
    var img = octx.createImageData(out.width, out.height);
    var od = img.data;

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        g = (g - 128) * 1.15 + 128;
        if (g < 0) g = 0;
        else if (g > 255) g = 255;
        var on = g / 255 < BAYER[y % 8][x % 8];
        var r = on ? FG[0] : BG[0];
        var g2 = on ? FG[1] : BG[1];
        var b = on ? FG[2] : BG[2];
        for (var sy2 = 0; sy2 < scale; sy2++) {
          for (var sx2 = 0; sx2 < scale; sx2++) {
            var oi = ((y * scale + sy2) * out.width + (x * scale + sx2)) * 4;
            od[oi] = r;
            od[oi + 1] = g2;
            od[oi + 2] = b;
            od[oi + 3] = 255;
          }
        }
      }
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  function blobFromCanvas(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve(blob);
      }, "image/png");
    });
  }

  global.GogogoDither = {
    ditherSquare: ditherSquare,
    blobFromCanvas: blobFromCanvas
  };
})(window);
