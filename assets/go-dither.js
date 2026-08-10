/* Shared Bayer dither + square crop helpers for gogogo /go account */
(function (global) {
  var FG = [0xc7, 0x41, 0x3b];
  var BG = [0xf7, 0xf5, 0xf0];
  var BAYER = [
    [0.03125, 0.53125, 0.15625, 0.65625],
    [0.78125, 0.28125, 0.90625, 0.40625],
    [0.21875, 0.71875, 0.09375, 0.59375],
    [0.96875, 0.46875, 0.84375, 0.34375]
  ];

  function ditherSquare(sourceCanvas, scale) {
    scale = scale || 3;
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
        var on = g / 255 < BAYER[y % 4][x % 4];
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
