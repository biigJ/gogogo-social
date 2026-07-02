(function (global) {
  "use strict";

  var RASTER_RE = /\.(jpe?g|png)$/i;
  var VARIANT_RE = /-(800|1000|1200|1400|1600)\.webp$/i;

  function splitQuery(src) {
    if (!src) return { path: "", query: "" };
    var i = String(src).indexOf("?");
    if (i < 0) return { path: src, query: "" };
    return { path: src.slice(0, i), query: src.slice(i) };
  }

  function normalizeAssetPath(src) {
    return splitQuery(src).path.replace(/^(\.\.\/)+/, "").replace(/^\//, "");
  }

  function shouldOptimizeSrc(src) {
    if (!src) return false;
    var parts = splitQuery(src);
    if (!RASTER_RE.test(parts.path) || VARIANT_RE.test(parts.path)) return false;
    return true;
  }

  function widthForSrc(src) {
    var p = normalizeAssetPath(src);
    if (p.indexOf("assets/berlin-arch-tour/") === 0) return 1200;
    if (p.indexOf("assets/wolfgang-grope/") === 0) return 1000;
    if (p.indexOf("assets/interior/") === 0 || p.indexOf("assets/hochbau/") === 0) return 1400;
    if (p.indexOf("assets/biigJ/") === 0) return 1200;
    if (p.indexOf("assets/gogogo/") === 0) return 1600;
    if (p.indexOf("assets-mockups/") === 0) return 1200;
    return 1400;
  }

  function widthForImg(img, src) {
    if (!img) return widthForSrc(src);
    var explicit = Number(img.getAttribute("data-fc-width"));
    if (explicit > 0) return explicit;
    var w = Number(img.getAttribute("width"));
    if (w > 0) {
      if (w <= 820) return 800;
      if (w <= 1100) return 1000;
      if (w <= 1300) return 1200;
      if (w <= 1500) return 1400;
      return 1600;
    }
    if (img.closest(".bi-tile, .kaufen-tile__slide, .kaufen-product__slide, .bat-stop__img-wrap, .bat-dining__photo")) {
      var pathW = widthForSrc(src);
      if (pathW === 1400) return 800;
    }
    return widthForSrc(src);
  }

  function optimizedUrl(src, width) {
    if (!src || !width || !shouldOptimizeSrc(src)) return src;
    var parts = splitQuery(src);
    var base = parts.path.replace(RASTER_RE, "");
    return base + "-" + width + ".webp" + parts.query;
  }

  function setImage(img, src, width, opts) {
    if (!img || !src) return src;
    opts = opts || {};
    var fallback = src;
    var webp = optimizedUrl(src, width || widthForImg(img, src));
    if (!webp || webp === src) {
      img.src = fallback;
      if (opts.srcset) img.removeAttribute("srcset");
      return fallback;
    }

    function useFallback() {
      img.removeEventListener("error", onError);
      if (img.getAttribute("src") !== fallback) img.src = fallback;
      if (opts.srcset) img.removeAttribute("srcset");
    }

    function onError() {
      useFallback();
    }

    img.onerror = null;
    img.addEventListener("error", onError);
    img.src = webp;
    if (opts.srcset) {
      img.srcset = webp + " " + width + "w";
      if (opts.sizes) img.sizes = opts.sizes;
    }
    return webp;
  }

  function upgradeInlineBackground(el) {
    if (!el || el.hasAttribute("data-fc-bg-done")) return;
    var style = el.getAttribute("style") || "";
    var match = style.match(/background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    if (!match) return;
    var src = match[1];
    if (!shouldOptimizeSrc(src)) return;
    var webp = optimizedUrl(src, widthForSrc(src));
    if (!webp || webp === src) return;
    el.setAttribute("data-fc-bg-done", "");
    el.setAttribute("data-fc-bg-fallback", src);
    el.style.backgroundImage = "url('" + webp + "')";
  }

  function upgradeImages(root, selector, defaultWidth) {
    root = root || document;
    selector = selector || "img[data-fc-optimize]";
    root.querySelectorAll(selector).forEach(function (img) {
      if (img.hasAttribute("data-fc-skip")) return;
      var src = img.getAttribute("data-fc-src") || img.getAttribute("src");
      if (!src || !shouldOptimizeSrc(src)) return;
      var width = Number(img.getAttribute("data-fc-width")) || defaultWidth || widthForImg(img, src);
      setImage(img, src, width, { srcset: img.hasAttribute("data-fc-srcset") });
    });
  }

  function upgradePageImages(root) {
    root = root || document;
    root.querySelectorAll("img[src]").forEach(function (img) {
      if (img.hasAttribute("data-fc-skip") || img.hasAttribute("data-fc-optimized")) return;
      var src = img.getAttribute("src");
      if (!shouldOptimizeSrc(src)) return;
      img.setAttribute("data-fc-optimized", "");
      setImage(img, src, widthForImg(img, src));
    });
    root.querySelectorAll("video[poster]").forEach(function (video) {
      var poster = video.getAttribute("poster");
      if (!shouldOptimizeSrc(poster)) return;
      var webp = optimizedUrl(poster, widthForSrc(poster));
      if (webp && webp !== poster) video.setAttribute("poster", webp);
    });
    root.querySelectorAll("[style*='background-image']").forEach(upgradeInlineBackground);
  }

  function isExcludedPage() {
    if (document.documentElement.getAttribute("data-fc-no-image-optimize") === "true") return true;
    return false;
  }

  function wireFallbackImages(root) {
    (root || document).querySelectorAll("img[data-fc-fallback]").forEach(function (img) {
      if (img.hasAttribute("data-fc-fallback-wired")) return;
      img.setAttribute("data-fc-fallback-wired", "");
      img.addEventListener(
        "error",
        function onFallback() {
          img.removeEventListener("error", onFallback);
          var fb = img.getAttribute("data-fc-fallback");
          if (fb) img.src = fb;
        },
        { once: true }
      );
    });
  }

  function autoInit() {
    wireFallbackImages(document);
    if (isExcludedPage()) return;
    upgradePageImages(document);
  }

  global.fcOptimizedUrl = optimizedUrl;
  global.fcWidthForSrc = widthForSrc;
  global.fcSetImage = setImage;
  global.fcUpgradeImages = upgradeImages;
  global.fcUpgradePageImages = upgradePageImages;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoInit);
    } else {
      autoInit();
    }
    document.addEventListener("fc-chrome-ready", autoInit);
  }
})(typeof window !== "undefined" ? window : globalThis);
