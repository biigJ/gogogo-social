/* go-zirkel-setup.js — gemeinsamer Zirkel-Dialog (Woche + Aktuell)
 *
 * Eine Runde = Laufen + Workout (2 Phasen à work). Pause nach jeder Phase,
 * außer nach der letzten.  Gesamt = R × 2 × work + (2R − 1) × pause
 *
 * Speicherung in events.note:
 *   "zirkel:standard|work=240|pause=30|rounds=6|online=1"
 *   mode standard = Single, team = Double (FFC-Modi)
 */
(function (global) {
  "use strict";

  var ROUNDS = [4, 5, 6, 7, 8];
  var WORKS = [180, 210, 240, 270, 300];
  var PAUSES = [30, 45, 60];
  var DEF = { mode: "standard", rounds: 6, workSec: 240, restSec: 30, online: false };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function pauseText(sec) {
    return sec >= 60 && sec % 60 === 0 ? sec / 60 + " min" : sec + " s";
  }

  function totalSec(z) {
    var phases = 2 * z.rounds;
    return phases * z.workSec + Math.max(0, phases - 1) * z.restSec;
  }

  function parse(note) {
    var s = String(note || "");
    if (s.indexOf("zirkel:") !== 0) return null;
    var parts = s.slice(7).split("|");
    var out = {
      mode: parts[0] === "team" ? "team" : "standard",
      workSec: DEF.workSec,
      restSec: DEF.restSec,
      rounds: DEF.rounds,
      online: false
    };
    parts.slice(1).forEach(function (kv) {
      var i = kv.indexOf("="), k = kv.slice(0, i), v = Number(kv.slice(i + 1));
      if (isNaN(v)) return;
      if (k === "work") out.workSec = v;
      if (k === "pause") out.restSec = v;
      if (k === "rounds") out.rounds = v;
      if (k === "online") out.online = v === 1;
      if (k === "group") out.group = v;
    });
    return out;
  }

  function toNote(z, extra) {
    return (
      "zirkel:" + (z.mode === "team" ? "team" : "standard") +
      "|work=" + z.workSec +
      "|pause=" + z.restSec +
      "|rounds=" + z.rounds +
      (z.online ? "|online=1" : "") +
      (extra || "")
    );
  }

  function label(z) {
    if (!z) return "";
    return (
      (z.mode === "team" ? "Double" : "Single") +
      " · " + z.rounds + " × " + mmss(z.workSec) + " min · " +
      pauseText(z.restSec) + " Pause · " + mmss(totalSec(z)) + " min"
    );
  }

  function nearest(list, v) {
    var best = list[0];
    list.forEach(function (x) {
      if (Math.abs(x - v) < Math.abs(best - v)) best = x;
    });
    return best;
  }

  function col(key, list, sel, fmt) {
    return (
      '<div class="wr-time-col gz-col" data-gz-col="' + key + '" data-val="' + sel + '">' +
      list.map(function (v) {
        return (
          '<button type="button" class="wr-time-opt' + (v === sel ? " is-on" : "") +
          '" data-gz-val="' + v + '">' + esc(fmt(v)) + "</button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function wheel(cols, extraClass) {
    return (
      '<div class="wr-time-wheel gz-wheel ' + (extraClass || "") + '">' +
      cols +
      '<div class="wr-time-fade wr-time-fade--top" aria-hidden="true"></div>' +
      '<div class="wr-time-fade wr-time-fade--bot" aria-hidden="true"></div>' +
      '<div class="wr-time-center" aria-hidden="true"></div>' +
      "</div>"
    );
  }

  /* HTML für Schritt 1. preset optional (z. B. aus bestehendem Event). */
  function html(preset) {
    var z = Object.assign({}, DEF, preset || {});
    z.rounds = nearest(ROUNDS, z.rounds);
    z.workSec = nearest(WORKS, z.workSec);
    z.restSec = nearest(PAUSES, z.restSec);
    return (
      '<div class="gz" data-gz-mode="' + z.mode + '">' +
      '<div class="gz-seg" role="group" aria-label="Modus">' +
      '<button type="button" data-gz-mode-btn="standard"' + (z.mode !== "team" ? ' class="is-on"' : "") + ">Single</button>" +
      '<button type="button" data-gz-mode-btn="team"' + (z.mode === "team" ? ' class="is-on"' : "") + ">Double</button>" +
      "</div>" +
      '<p class="gz-row">Laufen + Workout</p>' +
      wheel(
        col("rounds", ROUNDS, z.rounds, function (v) { return v + " Runden"; }) +
        '<span class="wr-time-sep" aria-hidden="true">×</span>' +
        col("work", WORKS, z.workSec, function (v) { return mmss(v) + " min"; }),
        "gz-wheel--two"
      ) +
      wheel(
        col("pause", PAUSES, z.restSec, function (v) { return pauseText(v) + " Pause"; }),
        "gz-wheel--one"
      ) +
      '<p class="gz-total" data-gz-total="1"></p>' +
      "</div>"
    );
  }

  function read(root) {
    var box = root && root.querySelector(".gz");
    if (!box) return Object.assign({}, DEF);
    function val(k, d) {
      var c = box.querySelector('[data-gz-col="' + k + '"]');
      var v = c ? Number(c.getAttribute("data-val")) : NaN;
      return isNaN(v) ? d : v;
    }
    return {
      mode: box.getAttribute("data-gz-mode") === "team" ? "team" : "standard",
      rounds: val("rounds", DEF.rounds),
      workSec: val("work", DEF.workSec),
      restSec: val("pause", DEF.restSec),
      online: false
    };
  }

  function paintTotal(box) {
    var z = read(box.parentNode || box);
    var el = box.querySelector("[data-gz-total]");
    if (!el) return;
    var phases = 2 * z.rounds;
    el.innerHTML =
      "Gesamt <strong>" + mmss(totalSec(z)) + " min</strong>" +
      '<span class="gz-calc">' + z.rounds + " × 2 × " + mmss(z.workSec) + " + " +
      (phases - 1) + " × " + pauseText(z.restSec) + " Pause</span>";
  }

  function syncCol(c) {
    var mid = c.scrollTop + c.clientHeight / 2, best = null, bd = Infinity;
    c.querySelectorAll(".wr-time-opt").forEach(function (o) {
      var d = Math.abs(o.offsetTop + o.clientHeight / 2 - mid);
      if (d < bd) { bd = d; best = o; }
    });
    if (!best) return;
    c.querySelectorAll(".wr-time-opt").forEach(function (o) {
      o.classList.toggle("is-on", o === best);
    });
    c.setAttribute("data-val", best.getAttribute("data-gz-val"));
  }

  /* Nach dem Einfügen ins DOM aufrufen. */
  function bind(root) {
    var box = root && root.querySelector(".gz");
    if (!box || box._gzBound) return;
    box._gzBound = true;
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gz-mode-btn]");
      if (b) {
        box.setAttribute("data-gz-mode", b.getAttribute("data-gz-mode-btn"));
        box.querySelectorAll("[data-gz-mode-btn]").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
        });
        return;
      }
      var o = e.target.closest("[data-gz-val]");
      if (o) {
        var c = o.closest("[data-gz-col]");
        c.scrollTo({ top: o.offsetTop - c.clientHeight / 2 + o.clientHeight / 2, behavior: "smooth" });
      }
    });
    box.querySelectorAll("[data-gz-col]").forEach(function (c) {
      var on = c.querySelector(".is-on");
      if (on) c.scrollTop = Math.max(0, on.offsetTop - c.clientHeight / 2 + on.clientHeight / 2);
      var t = 0;
      c.addEventListener("scroll", function () {
        clearTimeout(t);
        t = setTimeout(function () { syncCol(c); paintTotal(box); }, 40);
      }, { passive: true });
    });
    paintTotal(box);
  }

  global.GoZirkelSetup = {
    html: html,
    bind: bind,
    read: read,
    parse: parse,
    toNote: toNote,
    label: label,
    totalSec: totalSec
  };
})(window);
