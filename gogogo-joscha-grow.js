(function initGoglJoschaGrow() {
  var root = document.getElementById("gogl-joscha-grow");
  if (!root) return;

  var mqFlush = window.matchMedia("(max-width: 760px)");
  var navEl = document.querySelector("header.nav");

  function navHeight() {
    return navEl ? navEl.getBoundingClientRect().height : 72;
  }

  function boxedWidth() {
    var el = document.documentElement;
    var pad = 48;
    var probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;padding:0 var(--nav-pad-x);";
    document.body.appendChild(probe);
    pad = parseFloat(getComputedStyle(probe).paddingLeft) || pad;
    document.body.removeChild(probe);
    var max = parseFloat(getComputedStyle(el).getPropertyValue("--content-max")) || 1280;
    return Math.max(0, Math.min(window.innerWidth, max) - pad * 2);
  }

  function applyMobileFlush() {
    root.style.width = "";
    root.classList.add("is-flush");
  }

  function applyDesktopWidth(progress) {
    var boxed = boxedWidth();
    var full = window.innerWidth;
    var w = boxed + (full - boxed) * progress;
    var flush = progress >= 0.995;

    root.style.width = Math.round(w) + "px";
    root.classList.toggle("is-flush", flush);
    if (flush) {
      root.style.borderRadius = "0";
    } else {
      root.style.removeProperty("border-radius");
    }
  }

  function scrollProgress() {
    var nh = navHeight();
    var rect = root.getBoundingClientRect();
    var growStart = window.innerHeight * 0.72;
    var range = Math.max(growStart - nh, 1);

    if (rect.top >= growStart) return 0;
    if (rect.top <= nh) return 1;
    return 1 - (rect.top - nh) / range;
  }

  function updateHeroWidth() {
    navEl = document.querySelector("header.nav");
    document.documentElement.style.setProperty("--fc-nav-h", navHeight() + "px");

    if (mqFlush.matches) {
      applyMobileFlush();
      return;
    }

    root.classList.remove("is-flush");
    document.documentElement.style.setProperty("--fc-nav-h", navHeight() + "px");
    applyDesktopWidth(scrollProgress());
  }

  var tileGrid = document.getElementById("gogl-tile-grid");

  updateHeroWidth();
  window.addEventListener("scroll", updateHeroWidth, { passive: true });
  window.addEventListener("resize", updateHeroWidth, { passive: true });
  if (mqFlush.addEventListener) {
    mqFlush.addEventListener("change", updateHeroWidth);
  } else if (mqFlush.addListener) {
    mqFlush.addListener(updateHeroWidth);
  }

  if (!tileGrid) return;

  tileGrid.querySelectorAll(".gogl-tile").forEach(function (tile) {
    if (tile.querySelector(".gogl-tile__scaler")) return;
    var head = tile.querySelector(".gogl-tile__head");
    var body = tile.querySelector(".gogl-tile__body");
    if (!head || !body) return;
    var scaler = document.createElement("div");
    scaler.className = "gogl-tile__scaler";
    tile.insertBefore(scaler, head);
    scaler.appendChild(head);
    scaler.appendChild(body);
  });

  var BG_TOP_PAD = 8;
  var BG_BOTTOM_PAD = 12;

  function isExpanded(tile) {
    var state = tile.getAttribute("data-state") || "closed";
    return state === "open" || state === "background";
  }

  function updateOverlayClass() {
    var any = tileGrid.querySelector(
      '.gogl-tile[data-state="open"], .gogl-tile[data-state="background"]'
    );
    tileGrid.classList.toggle("is-tile-overlay-active", !!any);
  }

  function clearTilePosition(tile) {
    tile.style.removeProperty("--gogl-tile-shift-y");
  }

  function getFrameTop() {
    var dots = root.querySelector(".gogl-program-slider__dots");
    var frameRect = root.getBoundingClientRect();
    return dots ? dots.getBoundingClientRect().bottom + BG_TOP_PAD : frameRect.top + 14;
  }

  function getContainerBottom() {
    return root.getBoundingClientRect().bottom - BG_BOTTOM_PAD;
  }

  function getPopupScale() {
    var scale = parseFloat(getComputedStyle(tileGrid).getPropertyValue("--gogl-popup-scale"));
    return scale > 0 ? scale : 2;
  }

  function clearScalerMaxHeight(scaler) {
    if (!scaler) return;
    scaler.style.removeProperty("height");
    scaler.style.removeProperty("min-height");
    scaler.style.removeProperty("max-height");
    scaler.style.removeProperty("overflow-y");
  }

  function fitBackgroundScaler(tile, scaler, targetTop) {
    var available = getContainerBottom() - targetTop - BG_BOTTOM_PAD;
    var h = Math.floor(available / getPopupScale());
    if (h < 48) {
      tile.style.removeProperty("--gogl-bg-scaler-h");
      clearScalerMaxHeight(scaler);
      return;
    }
    var hPx = h + "px";
    tile.style.setProperty("--gogl-bg-scaler-h", hPx);
    scaler.style.height = hPx;
    scaler.style.minHeight = hPx;
    scaler.style.maxHeight = hPx;
    scaler.style.overflowY = "auto";
  }

  function alignExpandedTile(tile) {
    if (!isExpanded(tile)) {
      clearTilePosition(tile);
      tile.style.removeProperty("--gogl-bg-scaler-h");
      return;
    }

    var scaler = tile.querySelector(".gogl-tile__scaler");
    if (!scaler) return;

    if (tile.getAttribute("data-state") !== "background") {
      clearScalerMaxHeight(scaler);
      clearTilePosition(tile);
      tile.style.removeProperty("--gogl-bg-scaler-h");
      return;
    }

    if (mqFlush.matches) {
      clearTilePosition(tile);
      var mobileAvailable = root.getBoundingClientRect().height - 72;
      var mobileH = Math.max(120, Math.floor(mobileAvailable));
      var mobileHPx = mobileH + "px";
      tile.style.setProperty("--gogl-bg-scaler-h", mobileHPx);
      scaler.style.height = "";
      scaler.style.minHeight = "";
      scaler.style.maxHeight = mobileHPx;
      scaler.style.overflowY = "auto";
      return;
    }

    requestAnimationFrame(function () {
      var targetTop = getFrameTop();
      var scalerTop = scaler.getBoundingClientRect().top;
      tile.style.setProperty("--gogl-tile-shift-y", Math.round(targetTop - scalerTop) + "px");
      requestAnimationFrame(function () {
        fitBackgroundScaler(tile, scaler, targetTop);
      });
    });
  }

  function afterExpand(tile) {
    alignExpandedTile(tile);
  }

  function pauseSlider() {
    if (window.goglProgramSlider && typeof window.goglProgramSlider.pause === "function") {
      window.goglProgramSlider.pause();
    }
  }

  function closeTile(tile) {
    tile.setAttribute("data-state", "closed");
    tile.querySelectorAll("[data-bg-toggle]").forEach(function (b) {
      b.setAttribute("aria-pressed", "false");
    });
    clearScalerMaxHeight(tile.querySelector(".gogl-tile__scaler"));
    clearTilePosition(tile);
    tile.style.removeProperty("--gogl-bg-scaler-h");
    updateOverlayClass();
  }

  function closeAllTiles(except) {
    tileGrid.querySelectorAll(".gogl-tile").forEach(function (t) {
      if (except && t === except) return;
      var state = t.getAttribute("data-state") || "closed";
      if (state !== "closed") closeTile(t);
    });
  }

  tileGrid.addEventListener("click", function (e) {
    var tile = e.target.closest(".gogl-tile");
    if (!tile || !tileGrid.contains(tile)) return;

    pauseSlider();

    var isBgBtn = e.target.closest("[data-bg-toggle]");
    var isMailCta = e.target.closest(".gogl-tile__cta-mail");
    if (isMailCta) return;

    var state = tile.getAttribute("data-state") || "closed";

    if (isBgBtn) {
      tileGrid.querySelectorAll(".gogl-tile").forEach(function (t) {
        if (t !== tile && isExpanded(t)) closeTile(t);
      });

      var next = state === "background" ? "open" : "background";
      tile.setAttribute("data-state", next);
      updateOverlayClass();
      isBgBtn.setAttribute("aria-pressed", next === "background" ? "true" : "false");
      afterExpand(tile);
      return;
    }

    var isAction = e.target.closest(".gogl-tile__actions");
    if (isAction && state !== "closed") return;

    if (state === "closed") {
      tile.setAttribute("data-state", "open");
      updateOverlayClass();
      closeAllTiles(tile);
      afterExpand(tile);
      return;
    }

    closeTile(tile);
  });

  var joschaSlide = root.querySelector('.gogl-program-slider__slide[data-slide="3"]');
  if (joschaSlide) {
    joschaSlide.addEventListener("click", function (e) {
      if (e.target.closest(".gogl-tile")) return;
      if (e.target.closest("a, button")) return;

      var anyOpen = false;
      tileGrid.querySelectorAll(".gogl-tile").forEach(function (t) {
        if (isExpanded(t)) anyOpen = true;
      });
      if (!anyOpen) return;

      closeAllTiles();
      pauseSlider();
    });
  }

  var resizeAlignTimer;
  window.addEventListener(
    "resize",
    function () {
      window.clearTimeout(resizeAlignTimer);
      resizeAlignTimer = window.setTimeout(function () {
        tileGrid.querySelectorAll(".gogl-tile").forEach(function (t) {
          if (t.getAttribute("data-state") === "background") alignExpandedTile(t);
        });
      }, 120);
    },
    { passive: true }
  );
})();
