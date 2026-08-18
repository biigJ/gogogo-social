(function () {
  /* ── Dither-Parameter aus dem gogogo Dither Tool ──
     Stil: Atkinson (Hermes Look), Raster: 3px, Kontrast: -10, Helligkeit: 1
     Farbe FG: Rot #C7413B, BG: Off-White #F7F5F0 — rein zweitonig, keine Originalfarben */
  var FG = [0xc7, 0x41, 0x3b];
  var BG = [0xf7, 0xf5, 0xf0];
  var PIXEL = 1;        /* 1px = maximale Feinheit, 2× feiner als zuvor */
  var BRIGHTNESS = -55; /* Abdunkeln vor dem Dithering → mehr FG-Pixel → dunkler */
  var CONTRAST = 18;    /* Kontrast anheben für klare Kanten */

  /* Atkinson-Dithering (Apple/Hermes-Look) */
  function ditherAtkinson(src, w, h, out) {
    var err = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = y * w + x;
        var g = src[idx] + err[idx];
        var val = g < 128 ? 0 : 255;
        var e = (g - val) / 8;
        out[idx] = val;
        if (x + 1 < w) err[idx + 1] += e;
        if (x + 2 < w) err[idx + 2] += e;
        if (y + 1 < h) {
          if (x - 1 >= 0) err[(y + 1) * w + x - 1] += e;
          err[(y + 1) * w + x] += e;
          if (x + 1 < w) err[(y + 1) * w + x + 1] += e;
        }
        if (y + 2 < h) err[(y + 2) * w + x] += e;
      }
    }
  }

  var TRAINER_MAIL =
    "mailto:mail@bjgrope.de?subject=" + encodeURIComponent("Trainer werden") +
    "&body=" + encodeURIComponent(
      "Hallo Joscha, ich bin xxx und wohne in Berlin. Gerne möchte ich zu Deinem Netzwerk gehören. Ich bin Personal Trainer mit dem Schwerpunkt xxx. Du erreichst mich am besten unter dieser Email oder ruf mich an unter xxx.\n\nGruß,\nxxx"
    );

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.getElementById("lp-dither");
  var amount = document.getElementById("challenge-amount");
  var backEl = document.getElementById("challenge-back");

  document.querySelectorAll("[data-trainer-mail]").forEach(function (el) {
    el.setAttribute("href", TRAINER_MAIL);
  });

  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: false });
  var tmp = document.createElement("canvas");
  var tctx = tmp.getContext("2d", { willReadFrequently: true });

  /* ── Slideshow-Medien ──
     hero.mp4: ersten 5 Sek überspringen
     Reihenfolge: hero.mp4, factfulness, gogogo.mp4, upperbody-poster, SledHoodie */
  var SLIDES = [
    { type: "video", src: "/assets/gogogo/hero.mp4",   skipSec: 5 },
    { type: "img",   src: "/assets/gogogo/factfulness-1600.webp" },
    { type: "video", src: "/assets/gogogo/gogogo.mp4",  skipSec: 0 },
    { type: "img",   src: "/assets/gogogo/gogogo-upperbody-Video-Poster-1600.webp" },
    { type: "img",   src: "/assets/gogogo/SledHoodie-1600.webp" }
  ];
  var IMG_HOLD  = 3000;   /* ms Bilder halten */
  var BLEND_DUR = 1500;   /* ms Überblendung */
  var VIDEO_HOLD = 8000;  /* ms Videos halten (bevor weiter) */

  /* Erzeuge Medien-Elemente vorab */
  var mediaEls = SLIDES.map(function (s) {
    if (s.type === "video") {
      var v = document.createElement("video");
      v.src = s.src;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = "auto";
      v.crossOrigin = "anonymous";
      if (s.skipSec) {
        v.addEventListener("loadedmetadata", function () {
          if (v.currentTime < s.skipSec) v.currentTime = s.skipSec;
        }, { once: true });
      }
      return v;
    } else {
      var img = new Image();
      img.src = s.src;
      img.crossOrigin = "anonymous";
      return img;
    }
  });

  /* Slideshow-Zustand */
  var curIdx = 0;
  var nextIdx = 0;
  var blendStart = null;   /* null = kein Blend aktiv */
  var slideStart = null;
  var raf = 0;
  var running = false;

  /* Alphas für cur/next (0–1) */
  var curAlpha = 1;
  var nextAlpha = 0;

  function mediaReady(el) {
    if (el.tagName === "VIDEO") return el.readyState >= 2;
    return el.complete && el.naturalWidth > 0;
  }

  function drawCoverTo(target, media, w, h) {
    var mw = media.videoWidth || media.naturalWidth || 0;
    var mh = media.videoHeight || media.naturalHeight || 0;
    if (!mw || !mh) {
      target.fillStyle = "#F7F5F0";
      target.fillRect(0, 0, w, h);
      return;
    }
    var scale = Math.max(w / mw, h / mh);
    var sw = mw * scale;
    var sh = mh * scale;
    target.drawImage(media, (w - sw) / 2, (h - sh) / 2, sw, sh);
  }

  /* Dithert einen RGBA-Puffer (von tctx) in den Canvas */
  function applyDither(w, h) {
    /* Arbeite auf halber Auflösung (PIXEL-Raster = 3) dann hochskalieren */
    var sw = Math.ceil(w / PIXEL);
    var sh = Math.ceil(h / PIXEL);

    /* Gausewert (Graustufe) aus dem downsampled Source extrahieren */
    var raw = tctx.getImageData(0, 0, w, h);
    var px = raw.data;

    /* Grauwerte in niedrigerer Auflösung sammeln */
    var gray = new Float32Array(sw * sh);
    for (var ty = 0; ty < sh; ty++) {
      for (var tx = 0; tx < sw; tx++) {
        /* Mittelpixel des Blocks */
        var sx = Math.min(tx * PIXEL + Math.floor(PIXEL / 2), w - 1);
        var sy = Math.min(ty * PIXEL + Math.floor(PIXEL / 2), h - 1);
        var si = (sy * w + sx) * 4;
        var g = 0.299 * px[si] + 0.587 * px[si + 1] + 0.114 * px[si + 2];
        /* Helligkeit + Kontrast anwenden */
        g = (g - 128) * (1 + CONTRAST / 100) + 128 + BRIGHTNESS;
        if (g < 0) g = 0; else if (g > 255) g = 255;
        gray[ty * sw + tx] = g;
      }
    }

    var dithered = new Uint8Array(sw * sh);
    ditherAtkinson(gray, sw, sh, dithered);

    /* Hochskaliert in Canvas zeichnen */
    var out = ctx.createImageData(w, h);
    var od = out.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var bx = Math.floor(x / PIXEL);
        var by = Math.floor(y / PIXEL);
        var bit = dithered[by * sw + bx];
        var c = bit === 0 ? FG : BG;
        var oi = (y * w + x) * 4;
        od[oi]     = c[0];
        od[oi + 1] = c[1];
        od[oi + 2] = c[2];
        od[oi + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  function frame(ts) {
    raf = 0;
    var cw = canvas.clientWidth || window.innerWidth;
    var ch = canvas.clientHeight || window.innerHeight;
    if (cw < 2 || ch < 2) {
      if (running) raf = requestAnimationFrame(frame);
      return;
    }
    var w = Math.min(1920, Math.max(480, cw));
    var h = Math.max(1, Math.round(w * (ch / cw)));
    if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h; }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

    if (!ts) ts = performance.now();

    /* Slide-Timing */
    var curEl = mediaEls[curIdx];
    var isVideo = SLIDES[curIdx].type === "video";

    if (slideStart === null) slideStart = ts;
    var elapsed = ts - slideStart;
    var holdDur = isVideo ? VIDEO_HOLD : IMG_HOLD;

    /* Blend starten wenn nächste Slide fällig */
    if (blendStart === null && elapsed >= holdDur) {
      nextIdx = (curIdx + 1) % SLIDES.length;
      blendStart = ts;
      /* Nächstes Video starten */
      if (SLIDES[nextIdx].type === "video") {
        var nv = mediaEls[nextIdx];
        nv.muted = true;
        var skipS = SLIDES[nextIdx].skipSec || 0;
        if (skipS && nv.currentTime < skipS) nv.currentTime = skipS;
        var p = nv.play();
        if (p && p.catch) p.catch(function () {});
      }
    }

    /* Blend-Progress */
    if (blendStart !== null) {
      var t = Math.min(1, (ts - blendStart) / BLEND_DUR);
      curAlpha = 1 - t;
      nextAlpha = t;
      if (t >= 1) {
        /* Blend fertig: cur wechseln */
        curIdx = nextIdx;
        slideStart = ts;
        blendStart = null;
        curAlpha = 1;
        nextAlpha = 0;
        /* Altes Video pausieren */
        mediaEls.forEach(function (el, i) {
          if (i !== curIdx && el.tagName === "VIDEO") { try { el.pause(); } catch(e){} }
        });
      }
    }

    /* Compositing: cur + ggf. next blenden auf tmp */
    tctx.fillStyle = "#F7F5F0";
    tctx.fillRect(0, 0, w, h);

    if (blendStart !== null && nextAlpha > 0) {
      var nextEl = mediaEls[nextIdx];
      tctx.globalAlpha = 1;
      drawCoverTo(tctx, nextEl, w, h);
      tctx.globalAlpha = curAlpha;
      drawCoverTo(tctx, curEl, w, h);
      tctx.globalAlpha = 1;
    } else {
      drawCoverTo(tctx, curEl, w, h);
    }

    applyDither(w, h);

    if (running) raf = requestAnimationFrame(frame);
  }

  function startSlideshow() {
    if (running) return;
    running = true;
    /* Erstes Video starten */
    var firstEl = mediaEls[0];
    if (SLIDES[0].type === "video") {
      firstEl.muted = true;
      var skip = SLIDES[0].skipSec || 0;
      firstEl.addEventListener("loadedmetadata", function () {
        if (skip) firstEl.currentTime = skip;
        firstEl.play().catch(function () {});
      }, { once: true });
      var pp = firstEl.play();
      if (pp && pp.catch) pp.catch(function () {});
    }
    raf = requestAnimationFrame(frame);
  }

  if (!reduceMotion) {
    startSlideshow();
  } else {
    /* Bei reduceMotion einfach erstes Bild rendern */
    var img0 = mediaEls.find(function (el) { return el.tagName !== "VIDEO"; });
    if (img0) {
      img0.onload = function () { frame(performance.now()); };
      if (img0.complete) frame(performance.now());
    }
  }

  window.addEventListener("resize", function () {
    if (!running) frame(performance.now());
  });

  /* ── Challenge-Rechner ── */
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

  /* ── de/en Sprachumschalter ── */
  var langBtn = document.getElementById("lp-lang-btn");
  if (langBtn) {
    var savedLang = localStorage.getItem("gg-lang") || "de";
    langBtn.textContent = savedLang === "de" ? "en" : "de";
    langBtn.setAttribute("aria-label", savedLang === "de" ? "Switch to English" : "Zu Deutsch wechseln");
    langBtn.addEventListener("click", function () {
      var cur = localStorage.getItem("gg-lang") || "de";
      var next = cur === "de" ? "en" : "de";
      localStorage.setItem("gg-lang", next);
      langBtn.textContent = next === "de" ? "en" : "de";
      langBtn.setAttribute("aria-label", next === "de" ? "Switch to English" : "Zu Deutsch wechseln");
      /* Einfaches Toggle: alle [data-de] / [data-en] Elemente umschalten */
      document.querySelectorAll("[data-de][data-en]").forEach(function (el) {
        el.textContent = next === "de" ? el.getAttribute("data-de") : el.getAttribute("data-en");
      });
    });
  }
})();
