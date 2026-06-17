(function initGoglProgramSlider() {
  var root = document.getElementById("gogl-joscha-grow");
  if (!root || !root.classList.contains("gogl-program-slider")) return;

  var SLIDE_LABELS_DE = [
    "Was fehlt Dir neben App und Fitness Studio?",
    "Re-Start mit Buddys",
    "Expertise für Deine Aktivitäten",
    "ZIRKELTRAINING",
    "Factfulness",
    "Upper Body",
    "Mobility",
    "Das Naheliegende wirkt oft so fern.",
  ];
  var SLIDE_LABELS_EN = [
    "What are you missing besides the app and the gym?",
    "Restart with buddies",
    "Expertise for your activities",
    "CIRCUIT TRAINING",
    "Factfulness",
    "Upper body",
    "Mobility",
    "What seems obvious often feels so far away.",
  ];
  var SLIDE_DEFAULT_DE = "Was fehlt Dir neben App und Fitness Studio?";
  var SLIDE_DEFAULT_EN = "What are you missing besides the app and the gym?";

  var DISPLAY_ORDER = [0, 1, 2, 4, 3, 6, 7, 5];

  var viewport = root.querySelector(".gogl-program-slider__viewport");
  var track = viewport && viewport.querySelector(".gogl-program-slider__track");
  if (viewport && !track) {
    track = document.createElement("div");
    track.className = "gogl-program-slider__track";
    DISPLAY_ORDER.forEach(function (n) {
      var slide = root.querySelector('.gogl-program-slider__slide[data-slide="' + n + '"]');
      if (slide) track.appendChild(slide);
    });
    viewport.appendChild(track);
  }

  var slides = track ? track.querySelectorAll(".gogl-program-slider__slide") : root.querySelectorAll(".gogl-program-slider__slide");
  if (!slides.length) return;

  function currentLang() {
    return document.body.classList.contains("en") ? "en" : "de";
  }

  function slideLabels() {
    return currentLang() === "en" ? SLIDE_LABELS_EN : SLIDE_LABELS_DE;
  }

  var titleEl = document.getElementById("gogl-program-slider-title");
  var dots = root.querySelectorAll(".gogl-program-slider__dot[data-slide-to]");
  var prevBtn = document.querySelector(".gogl-program-slider-arrow--prev");
  var nextBtn = document.querySelector(".gogl-program-slider-arrow--next");
  var sliderWrap = root.closest(".gogl-joscha-grow-wrap") || root;
  var mobileNext = sliderWrap.querySelector(".gogl-program-slider__mobile-next");
  var mobileNextLabelEl = mobileNext ? mobileNext.querySelector(".gogl-hero-slide-next__label") : null;
  var mobileNextButtonEl = mobileNext ? mobileNext.querySelector("button") : null;

  var index = 0;
  var timer;
  var autoEnabled = false;
  var pausedByHover = false;
  var hoverRoot = root.closest(".gogl-joscha-grow-wrap") || root;

  function applyTrackPosition(animate) {
    if (!track) return;
    track.style.transition = animate !== false ? "transform 0.45s ease" : "none";
    track.style.transform = "translateX(-" + index * 100 + "%)";
  }

  function show(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach(function (slide, n) {
      slide.classList.toggle("is-active", n === index);
    });
    applyTrackPosition(true);
    if (titleEl) {
      var labels = slideLabels();
      titleEl.textContent = labels[index] || (currentLang() === "en" ? SLIDE_DEFAULT_EN : SLIDE_DEFAULT_DE);
    }
    dots.forEach(function (dot) {
      var n = parseInt(dot.getAttribute("data-slide-to"), 10);
      var on = n === index;
      dot.classList.toggle("is-active", on);
      dot.setAttribute("aria-selected", on ? "true" : "false");
    });

    if (mobileNextLabelEl) {
      var activeSlide = slides[index];
      var labelEl =
        activeSlide &&
        (activeSlide.querySelector(".gogl-slide-footer-chrome .gogl-hero-slide-next__label") ||
          activeSlide.querySelector(".gogl-hero-slide-next__label"));

      var labelText = labelEl && labelEl.textContent ? labelEl.textContent.trim() : "";
      mobileNextLabelEl.textContent = labelText;
      if (mobileNextButtonEl) {
        var prefix = currentLang() === "en" ? "Next program: " : "Nächstes Programm: ";
        mobileNextButtonEl.setAttribute("aria-label", labelText ? prefix + labelText : prefix.trim());
      }
    }
  }

  function next() {
    show(index + 1);
  }

  function prev() {
    show(index - 1);
  }

  function clearTimer() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function restartTimer() {
    clearTimer();
    if (autoEnabled && !pausedByHover) {
      timer = window.setInterval(next, 5000);
    }
  }

  function start() {
    autoEnabled = false;
    clearTimer();
  }

  function stop() {
    autoEnabled = false;
    clearTimer();
  }

  hoverRoot.addEventListener("pointerenter", function () {
    pausedByHover = true;
    clearTimer();
  });
  hoverRoot.addEventListener("pointerleave", function (e) {
    if (e.relatedTarget && hoverRoot.contains(e.relatedTarget)) return;
    pausedByHover = false;
    restartTimer();
  });

  window.goglProgramSlider = {
    pause: stop,
    resume: start,
    isOnJoschaSlide: function () {
      return index === 3;
    },
  };

  dots.forEach(function (dot) {
    dot.addEventListener("click", function () {
      var n = parseInt(dot.getAttribute("data-slide-to"), 10);
      if (!isNaN(n)) {
        show(n);
        start();
      }
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      prev();
      start();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      next();
      start();
    });
  }

  sliderWrap.querySelectorAll(".gogl-hero-slide-next").forEach(function (heroSlideNext) {
    heroSlideNext.addEventListener("click", function () {
      next();
      start();
    });
  });

  var io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting && entry.intersectionRatio > 0.12) {
                start();
              } else {
                stop();
              }
            });
          },
          { threshold: [0, 0.12, 0.35] }
        )
      : null;

  if (io) {
    io.observe(root);
  } else {
    start();
  }

  document.addEventListener("fc-lang-change", function () {
    show(index);
  });

  if (window.FcSwipeSlider && viewport && track) {
    window.FcSwipeSlider.bind({
      zone: viewport,
      track: track,
      mode: "percent",
      getIndex: function () {
        return index;
      },
      getCount: function () {
        return slides.length;
      },
      onIndexChange: function (newIndex) {
        show(newIndex);
        start();
      },
      ignore: function (target) {
        return !!target.closest(
          ".gogl-tile, button, a, input, textarea, select, .gogl-program-slide-card__play"
        );
      },
      loop: true,
    });
  }

  function youtubeCommand(iframe, func, args) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: func, args: args || "" }),
        "*"
      );
    } catch (err) {}
  }

  function createYoutubeChrome(media, iframe) {
    var chrome = document.createElement("div");
    chrome.className = "gogl-program-slide-card__youtube-chrome";
    chrome.setAttribute("role", "toolbar");
    chrome.setAttribute("aria-label", "Video-Steuerung");

    var pauseBtn = document.createElement("button");
    pauseBtn.type = "button";
    pauseBtn.className = "gogl-youtube-chrome__btn gogl-youtube-chrome__btn--pause";
    pauseBtn.setAttribute("aria-label", "Pause");

    var muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "gogl-youtube-chrome__btn gogl-youtube-chrome__btn--mute";
    muteBtn.setAttribute("aria-label", "Ton stummschalten");

    var fsBtn = document.createElement("button");
    fsBtn.type = "button";
    fsBtn.className = "gogl-youtube-chrome__btn gogl-youtube-chrome__btn--fs";
    fsBtn.setAttribute("aria-label", "Vollbild");

    chrome.appendChild(pauseBtn);
    chrome.appendChild(muteBtn);
    chrome.appendChild(fsBtn);

    var paused = false;
    var muted = false;

    pauseBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      youtubeCommand(iframe, paused ? "playVideo" : "pauseVideo");
      paused = !paused;
      pauseBtn.setAttribute("aria-label", paused ? "Abspielen" : "Pause");
      pauseBtn.classList.toggle("is-paused", paused);
    });

    muteBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (muted) {
        youtubeCommand(iframe, "unMute");
        youtubeCommand(iframe, "setVolume", [100]);
      } else {
        youtubeCommand(iframe, "mute");
      }
      muted = !muted;
      muteBtn.setAttribute("aria-label", muted ? "Ton einschalten" : "Ton stummschalten");
      muteBtn.classList.toggle("is-muted", muted);
    });

    fsBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (document.fullscreenElement) {
        document.exitFullscreen();
        return;
      }
      var req =
        media.requestFullscreen ||
        media.webkitRequestFullscreen ||
        media.msRequestFullscreen;
      if (req) req.call(media);
    });

    chrome.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    media.appendChild(chrome);
    return chrome;
  }

  function playYoutubeMedia(media) {
    if (!media || media.classList.contains("is-playing")) return;
    var youtubeId = media.getAttribute("data-youtube-id");
    if (!youtubeId) return;
    var wrap = document.createElement("div");
    wrap.className = "gogl-program-slide-card__youtube-wrap";
    var scaler = document.createElement("div");
    scaler.className = "gogl-program-slide-card__youtube-scaler";
    var iframe = document.createElement("iframe");
    iframe.className = "gogl-program-slide-card__youtube";
    var embedParams =
      "autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1&fs=0&enablejsapi=1&origin=" +
      encodeURIComponent(window.location.origin);
    iframe.src =
      "https://www.youtube-nocookie.com/embed/" +
      encodeURIComponent(youtubeId) +
      "?" +
      embedParams;
    iframe.title = "Upper Body Basics Video";
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    );
    iframe.setAttribute("allowfullscreen", "");
    iframe.addEventListener("load", function () {
      youtubeCommand(iframe, "unMute");
      youtubeCommand(iframe, "setVolume", [100]);
    });
    wrap.appendChild(scaler);
    scaler.appendChild(iframe);
    media.appendChild(wrap);
    createYoutubeChrome(media, iframe);
    media.classList.add("is-playing");
  }

  root.addEventListener(
    "click",
    function (e) {
      var playBtn = e.target.closest(".gogl-program-slide-card__play");
      if (!playBtn || !root.contains(playBtn)) return;
      var media = playBtn.closest(".gogl-program-slide-card__media[data-youtube-id]");
      if (!media) return;
      e.preventDefault();
      e.stopPropagation();
      playYoutubeMedia(media);
    },
    true
  );

  show(0);
})();
