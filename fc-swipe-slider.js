(function (global) {
  "use strict";

  var DEFAULT_THRESHOLD = 52;
  var DEFAULT_TRANSITION = "transform 0.45s ease";

  function bindSwipe(options) {
    if (!options || !options.zone || !options.track) return null;

    var zone = options.zone;
    var track = options.track;
    var getIndex = options.getIndex;
    var getCount = options.getCount;
    var onIndexChange = options.onIndexChange;
    var ignore = options.ignore || function () {
      return false;
    };
    var threshold = options.threshold != null ? options.threshold : DEFAULT_THRESHOLD;
    var loop = options.loop !== false;
    var minIndex = options.minIndex;
    var maxIndex = options.maxIndex;
    var transition = options.transition || DEFAULT_TRANSITION;
    var getOffsetForIndex = options.getOffsetForIndex;
    var axis = options.axis || "x";
    var mode = options.mode || "px";

    var dragging = false;
    var startX = 0;
    var startY = 0;
    var dragX = 0;
    var dragY = 0;
    var startIndex = 0;
    var startOffsetPx = 0;
    var pointerId = null;
    var axisLocked = null;

    function count() {
      return typeof getCount === "function" ? getCount() : 1;
    }

    function clampIndex(i) {
      var c = count();
      if (c <= 0) return 0;
      if (loop) return ((i % c) + c) % c;
      var min = typeof minIndex === "function" ? minIndex() : minIndex != null ? minIndex : 0;
      var max =
        typeof maxIndex === "function" ? maxIndex() : maxIndex != null ? maxIndex : c - 1;
      return Math.max(min, Math.min(max, i));
    }

    function zoneSize() {
      return axis === "y" ? zone.clientHeight || 1 : zone.clientWidth || 1;
    }

    function indexOffsetPx(index) {
      if (typeof getOffsetForIndex === "function") return getOffsetForIndex(index);
      var size = zoneSize();
      return -index * size;
    }

    function applyTransform(offsetPx, animate, dragIndex, dragPx) {
      track.style.transition = animate ? transition : "none";
      if (mode === "percent") {
        var idx = dragIndex != null ? dragIndex : typeof getIndex === "function" ? getIndex() : 0;
        var drag = dragPx || 0;
        track.style.transform =
          "translateX(calc(-" + idx * 100 + "% + " + drag + "px))";
        return;
      }
      if (axis === "y") {
        track.style.transform = "translateY(" + offsetPx + "px)";
      } else {
        track.style.transform = "translateX(" + offsetPx + "px)";
      }
    }

    function goToIndex(index, animate) {
      if (mode === "percent") {
        applyTransform(0, animate, index, 0);
        return;
      }
      applyTransform(indexOffsetPx(index), animate);
    }

    function rubberBand(offset, min, max) {
      if (offset < min) return min + (offset - min) * 0.35;
      if (offset > max) return max + (offset - max) * 0.35;
      return offset;
    }

    var api = {
      sync: function (animate) {
        if (typeof getIndex === "function") goToIndex(getIndex(), animate !== false);
      },
      destroy: function () {
        zone.removeEventListener("pointerdown", onDown);
        zone.removeEventListener("pointermove", onMove);
        zone.removeEventListener("pointerup", onUp);
        zone.removeEventListener("pointercancel", onUp);
        zone.classList.remove("is-swipe-dragging");
      },
    };

    function onDown(e) {
      if (!e.isPrimary || dragging) return;
      if (ignore(e.target)) return;
      if (count() <= 1 && !getOffsetForIndex && mode !== "percent") return;

      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dragX = 0;
      dragY = 0;
      axisLocked = null;
      startIndex = typeof getIndex === "function" ? getIndex() : 0;
      startOffsetPx = indexOffsetPx(startIndex);
      zone.classList.add("is-swipe-dragging");

      track.style.transition = "none";
      if (zone.setPointerCapture) {
        try {
          zone.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    }

    function onMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;

      dragX = e.clientX - startX;
      dragY = e.clientY - startY;

      if (!axisLocked) {
        if (Math.abs(dragX) < 8 && Math.abs(dragY) < 8) return;
        if (axis === "x") axisLocked = "x";
        else if (axis === "y") axisLocked = "y";
        else axisLocked = Math.abs(dragX) >= Math.abs(dragY) ? "x" : "y";
      }

      var delta = axisLocked === "y" ? dragY : dragX;
      if (axisLocked === "x" && Math.abs(dragX) > Math.abs(dragY) && e.cancelable) {
        e.preventDefault();
      }
      if (axisLocked === "y" && Math.abs(dragY) > Math.abs(dragX) && e.cancelable) {
        e.preventDefault();
      }

      if (mode === "percent") {
        var resisted = delta;
        if (!loop) {
          if (startIndex <= clampIndex(0) && delta > 0) resisted *= 0.35;
          if (startIndex >= clampIndex(count() - 1) && delta < 0) resisted *= 0.35;
        }
        applyTransform(0, false, startIndex, resisted);
        return;
      }

      var offset = startOffsetPx + delta;
      if (!loop && !getOffsetForIndex) {
        var minOff = indexOffsetPx(
          typeof maxIndex === "function" ? maxIndex() : clampIndex(count() - 1)
        );
        var maxOff = indexOffsetPx(typeof minIndex === "function" ? minIndex() : 0);
        if (minOff > maxOff) {
          var tmp = minOff;
          minOff = maxOff;
          maxOff = tmp;
        }
        offset = rubberBand(offset, minOff, maxOff);
      }
      applyTransform(offset, false);
    }

    function isLoopWrap(fromIndex, toIndex, total) {
      if (!loop || total <= 1) return false;
      return (
        (fromIndex === 0 && toIndex === total - 1) ||
        (fromIndex === total - 1 && toIndex === 0)
      );
    }

    function onUp(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      zone.classList.remove("is-swipe-dragging");

      if (zone.releasePointerCapture) {
        try {
          zone.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }

      var delta = axisLocked === "y" ? dragY : dragX;
      var crossed = Math.abs(delta) >= threshold;
      var dominant =
        axisLocked === "y"
          ? Math.abs(dragY) > Math.abs(dragX)
          : Math.abs(dragX) > Math.abs(dragY);

      if (!crossed || !dominant || !axisLocked) {
        goToIndex(startIndex, true);
        return;
      }

      var dir = delta < 0 ? 1 : -1;
      var nextIndex = clampIndex(startIndex + dir);
      if (nextIndex === startIndex) {
        goToIndex(startIndex, true);
        return;
      }

      var total = count();
      var wrap = isLoopWrap(startIndex, nextIndex, total);
      var useAnimate = !wrap;

      if (typeof onIndexChange === "function") {
        onIndexChange(nextIndex, { from: startIndex, animate: useAnimate, wrap: wrap });
      }
      goToIndex(nextIndex, useAnimate);
    }

    zone.style.touchAction = axis === "y" ? "pan-x" : "pan-y";
    if (!zone.classList.contains("fc-swipe-zone")) {
      zone.classList.add("fc-swipe-zone");
    }
    zone.addEventListener("pointerdown", onDown);
    zone.addEventListener("pointermove", onMove, { passive: false });
    zone.addEventListener("pointerup", onUp);
    zone.addEventListener("pointercancel", onUp);

    return api;
  }

  global.FcSwipeSlider = { bind: bindSwipe };
})(window);
