/* go-zirkel-setup.js — gemeinsamer Zirkel-Dialog (Woche + Aktuell)
 *
 * Eine Runde = Laufen + Workout (2 Phasen à work). Pause nach jeder Phase,
 * außer nach der letzten.  Gesamt = R × 2 × work + (2R − 1) × pause
 *
 * Speicherung in events.note:
 *   "zirkel:single|work=240|pause=30|rounds=6|online=1"
 *   "zirkel:double|...|partner=<account-id>|pname=<Name, URI-kodiert>"
 *   Double = zu zweit, man wechselt sich ab (Partner optional Freund oder Name)
 */
(function (global) {
  "use strict";

  var ROUNDS = [4, 5, 6, 7, 8];
  var WORKS = [];
  for (var w = 60; w <= 480; w += 30) WORKS.push(w);
  var PAUSES = [30, 45, 60];
  var DEF = { mode: "single", rounds: 6, workSec: 240, restSec: 30, online: false };
  var lastFriends = [];
  /* Schnellwahl: ein Tipp stellt alle Räder */
  var PRESETS = [
    { key: "einstieg", label: "Einstieg", rounds: 4, workSec: 120, restSec: 60 },
    { key: "kurz", label: "Kurz", rounds: 4, workSec: 180, restSec: 30 },
    { key: "ffc", label: "Freitag", rounds: 6, workSec: 240, restSec: 30 },
    { key: "lang", label: "Lang", rounds: 8, workSec: 240, restSec: 45 }
  ];

  /* Eigenes CSS: der Dialog sitzt in .sand-card (dort sind Buttons schwarze Pillen), deshalb höher gewichtet */
  var CSS =
    ".sand-card .gz,.gz{text-align:left}" +
    ".sand-card .gz button{width:auto;margin:0;min-height:0;box-shadow:none}" +
    ".sand-card .gz .gz-seg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 14px}" +
    ".sand-card .gz .gz-seg button{min-height:44px;border-radius:999px;border:1.5px solid #2A2118;background:transparent;color:#2A2118;font:inherit;font-weight:700;padding:0}" +
    ".sand-card .gz .gz-seg button.is-on{background:#2A2118;color:#F6F1E8}" +
    ".sand-card .gz .gz-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 12px}" +
    ".sand-card .gz .gz-presets::-webkit-scrollbar{display:none}" +
    ".sand-card .gz .gz-pre{min-width:0;min-height:42px;padding:2px 4px;border-radius:999px;border:1px solid rgba(42,33,24,.25);background:#F6F1E8;color:#2A2118;font:inherit;font-size:14px;font-weight:600;line-height:1.1;text-align:center}" +
    ".sand-card .gz .gz-pre small{display:block;font-size:11px;font-weight:500;color:rgba(42,33,24,.6)}" +
    ".sand-card .gz .gz-pre.is-on{border-color:#2A2118;box-shadow:0 0 0 1.5px #2A2118}" +
    ".sand-card .gz .gz-row{margin:2px 0 6px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(42,33,24,.6);text-align:left}" +
    ".sand-card .gz .wr-time-wheel{background:#fff;border:1px solid rgba(42,33,24,.12);border-radius:14px}" +
    ".sand-card .gz .wr-time-opt{display:flex;width:100%;height:44px;border:0;border-radius:0;background:none;padding:0;color:rgba(42,33,24,.35);font:inherit;font-size:18px;font-weight:600;justify-content:center;align-items:center}" +
    ".sand-card .gz .wr-time-opt.is-on{color:#111;font-size:20px;background:none}" +
    ".sand-card .gz .gz-partner__h{text-align:left;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(42,33,24,.6)}" +
    ".sand-card .gz .gz-partner__list{justify-content:flex-start}" +
    ".sand-card .gz .gz-pf{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid #2A2118;background:transparent;color:#2A2118;font:inherit;font-weight:600}" +
    ".sand-card .gz .gz-pf.is-on{background:#2A2118;color:#F6F1E8}" +
    ".sand-card .gz .gz-total{text-align:center;margin:8px 0 0}" +
    ".sand-card .gz{margin-top:30px}" +
    ".sand-card .gz .gz-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 4px}" +
    ".sand-card .gz .gz-cell .gz-row{text-align:center;margin:0 0 4px}" +
    ".sand-card .gz .gz-wheel--one{height:52px;min-height:0;border:1.5px solid #2A2118;border-radius:14px;overflow:hidden;display:block;position:relative;background:#fff}" +
    ".sand-card .gz .gz-wheel--one .wr-time-fade,.sand-card .gz .gz-wheel--one .wr-time-center{display:none}" +
    ".sand-card .gz .gz-wheel--one .wr-time-col{height:52px;padding:4px 0;box-sizing:border-box;overflow-y:auto;scroll-snap-type:y mandatory;scrollbar-width:none;width:100%}" +
    ".sand-card .gz .gz-wheel--one .wr-time-col::-webkit-scrollbar{display:none}" +
    ".sand-card .gz .gz-wheel--one .wr-time-opt{height:44px;scroll-snap-align:center;color:#2A2118;font-size:18px}" +
    ".sand-card .gz .gz-plist{display:block;width:100%;min-height:44px;margin:0 0 6px;border-radius:999px;border:1.5px solid #2A2118;background:transparent;color:#2A2118;font:inherit;font-weight:700}" +
    ".sand-card .gz .gz-partner__hint{margin:0 0 10px;font-size:13px;color:rgba(42,33,24,.7);text-align:center}" +
    ".gz-pl{position:fixed;inset:0;z-index:10060;background:rgba(20,16,12,.45);display:grid;place-items:center;padding:20px}" +
    ".gz-pl__card{width:min(100%,400px);max-height:76vh;display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:22px;background:#F6F1E8;color:#2A2118}" +
    ".gz-pl__h{margin:0;font:600 20px/1.2 'Playfair Display',Georgia,serif;text-align:center}" +
    ".gz-pl__q{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid rgba(42,33,24,.25);background:#fff;font:inherit;font-size:16px}" +
    ".gz-pl__list{flex:1;min-height:0;overflow-y:auto;display:grid;gap:6px;align-content:start}" +
    ".gz-pl__row{min-height:46px;border-radius:12px;border:1px solid rgba(42,33,24,.15);background:#fff;color:#2A2118;font:inherit;font-size:16px;font-weight:600;text-align:left;padding:0 14px}" +
    ".gz-pl__empty{margin:0;font-size:14px;color:rgba(42,33,24,.65)}" +
    ".gz-pl__x{min-height:44px;border:0;background:none;color:#2A2118;font:inherit;font-weight:600}";
  function injectCss() {
    if (document.getElementById("gz-css")) return;
    var st = document.createElement("style");
    st.id = "gz-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

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
      mode: parts[0] === "double" ? "double" : "single",
      workSec: DEF.workSec,
      restSec: DEF.restSec,
      rounds: DEF.rounds,
      online: false,
      partnerId: "",
      partnerName: ""
    };
    parts.slice(1).forEach(function (kv) {
      var i = kv.indexOf("="), k = kv.slice(0, i), raw = kv.slice(i + 1), v = Number(raw);
      if (k === "partner") out.partnerId = raw;
      if (k === "pname") {
        try { out.partnerName = decodeURIComponent(raw); } catch (e) { out.partnerName = raw; }
      }
      if (isNaN(v)) return;
      if (k === "work") out.workSec = v;
      if (k === "pause") out.restSec = v;
      if (k === "rounds") out.rounds = v;
      if (k === "online") out.online = v === 1;
      if (k === "hold") out.hold = v === 1;
      if (k === "go") out.goAt = v * 1000;
    });
    return out;
  }

  /* Flag in der Note setzen/entfernen (val null = entfernen), Rest bleibt unverändert */
  function withFlag(note, key, val) {
    var parts = String(note || "").split("|").filter(function (kv, i) {
      return i === 0 || kv.split("=")[0] !== key;
    });
    if (val != null) parts.push(key + "=" + val);
    return parts.join("|");
  }

  /* Gemeinsamer Start: go (Admin-Freigabe) vor Eventzeit; hold = angehalten */
  function startInfo(ev) {
    var z = parse(ev && ev.note);
    if (!z) return null;
    var t = new Date(ev.starts_at).getTime();
    return { startAt: z.goAt || t, hold: !!z.hold && !z.goAt, phases: 2 * z.rounds, z: z };
  }

  function toNote(z, extra) {
    var dbl = z.mode === "double";
    return (
      "zirkel:" + (dbl ? "double" : "single") +
      "|work=" + z.workSec +
      "|pause=" + z.restSec +
      "|rounds=" + z.rounds +
      (z.online ? "|online=1" : "") +
      (dbl && z.partnerId ? "|partner=" + z.partnerId : "") +
      (dbl && z.partnerName ? "|pname=" + encodeURIComponent(z.partnerName) : "") +
      (extra || "")
    );
  }

  function label(z) {
    if (!z) return "";
    return (
      (z.mode === "double" ? "Double" + (z.partnerName ? " mit " + z.partnerName : "") : "Single") +
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
  /* opts.friends: [{ id, name }] für die Partnerwahl bei Double */
  function html(preset, opts) {
    var z = Object.assign({}, DEF, preset || {});
    var friends = (opts && opts.friends) || [];
    lastFriends = friends;
    z.rounds = nearest(ROUNDS, z.rounds);
    z.workSec = nearest(WORKS, z.workSec);
    z.restSec = nearest(PAUSES, z.restSec);
    return (
      '<div class="gz" data-gz-mode="' + z.mode + '">' +
      '<div class="gz-seg" role="group" aria-label="Modus">' +
      '<button type="button" data-gz-mode-btn="single"' + (z.mode !== "double" ? ' class="is-on"' : "") + ">Single</button>" +
      '<button type="button" data-gz-mode-btn="double"' + (z.mode === "double" ? ' class="is-on"' : "") + ">Double</button>" +
      "</div>" +
      /* Partner nur aus Freunden mit FFC-Zugang (Nickname + Passwort), Auswahl über „Partnerliste“ */
      '<div class="gz-partner"' + (z.mode === "double" ? "" : " hidden") + ">" +
      '<button type="button" class="gz-plist" data-gz-plist="1">' + (z.partnerName ? "Partner: " + esc(z.partnerName) : "Partnerliste") + "</button>" +
      '<input type="hidden" class="gz-partner__id" value="' + esc(z.partnerId || "") + '" />' +
      '<input type="hidden" class="gz-partner__nm" value="' + esc(z.partnerName || "") + '" />' +
      '<p class="gz-partner__hint"' + (z.partnerName ? "" : " hidden") + ">" + (z.partnerName ? "Du wählst " + esc(z.partnerName) + ", bitte sie/ihn bei sich zu bestätigen." : "") + "</p>" +
      "</div>" +
      /* Runden, Workout, Pause nebeneinander, je nur der aktuelle Wert sichtbar */
      '<div class="gz-three">' +
      '<div class="gz-cell"><p class="gz-row">Runden</p>' + wheel(col("rounds", ROUNDS, z.rounds, function (v) { return String(v); }), "gz-wheel--one") + "</div>" +
      '<div class="gz-cell"><p class="gz-row">Workout</p>' + wheel(col("work", WORKS, z.workSec, function (v) { return mmss(v); }), "gz-wheel--one") + "</div>" +
      '<div class="gz-cell"><p class="gz-row">Pause</p>' + wheel(col("pause", PAUSES, z.restSec, function (v) { return pauseText(v); }), "gz-wheel--one") + "</div>" +
      "</div>" +
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
    var pid = box.querySelector(".gz-partner__id");
    var pnm = box.querySelector(".gz-partner__nm");
    return {
      mode: box.getAttribute("data-gz-mode") === "double" ? "double" : "single",
      rounds: val("rounds", DEF.rounds),
      workSec: val("work", DEF.workSec),
      restSec: val("pause", DEF.restSec),
      online: false,
      partnerId: pid ? pid.value : "",
      partnerName: pnm ? pnm.value : ""
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
    injectCss();
    var box = root && root.querySelector(".gz");
    if (!box || box._gzBound) return;
    box._gzBound = true;
    if (!box._gzFriends) box._gzFriends = lastFriends || [];
    function setCol(key, v) {
      var c = box.querySelector('[data-gz-col="' + key + '"]');
      var o = c && c.querySelector('[data-gz-val="' + v + '"]');
      if (!o) return;
      c.scrollTo({ top: o.offsetTop - c.clientHeight / 2 + o.clientHeight / 2, behavior: "smooth" });
    }
    function markPreset() {
      var z = read(box.parentNode || box);
      box.querySelectorAll("[data-gz-pre]").forEach(function (b) {
        var p = PRESETS.filter(function (x) { return x.key === b.getAttribute("data-gz-pre"); })[0];
        b.classList.toggle("is-on", !!p && p.rounds === z.rounds && p.workSec === z.workSec && p.restSec === z.restSec);
      });
    }
    box.addEventListener("click", function (e) {
      var pre = e.target.closest("[data-gz-pre]");
      if (pre) {
        var p = PRESETS.filter(function (x) { return x.key === pre.getAttribute("data-gz-pre"); })[0];
        if (p) { setCol("rounds", p.rounds); setCol("work", p.workSec); setCol("pause", p.restSec); }
        return;
      }
      var b = e.target.closest("[data-gz-mode-btn]");
      if (b) {
        box.setAttribute("data-gz-mode", b.getAttribute("data-gz-mode-btn"));
        box.querySelectorAll("[data-gz-mode-btn]").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
        });
        var pBox = box.querySelector(".gz-partner");
        if (pBox) pBox.hidden = b.getAttribute("data-gz-mode-btn") !== "double";
        return;
      }
      if (e.target.closest("[data-gz-plist]")) {
        openPartnerList(box);
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
        t = setTimeout(function () { syncCol(c); paintTotal(box); markPreset(); }, 40);
      }, { passive: true });
    });
    paintTotal(box);
  }

  /* Partnerliste: Popup zum Scrollen mit Suche oben (nur Freunde mit FFC-Zugang) */
  function openPartnerList(box) {
    var list = box._gzFriends || [];
    var ov = document.createElement("div");
    ov.className = "gz-pl";
    ov.innerHTML =
      '<div class="gz-pl__card" role="dialog" aria-modal="true">' +
      '<p class="gz-pl__h">Partner wählen</p>' +
      '<input type="search" class="gz-pl__q" placeholder="Suchen" />' +
      '<div class="gz-pl__list"></div>' +
      '<button type="button" class="gz-pl__x" data-gz-pl-close="1">Abbrechen</button></div>';
    document.body.appendChild(ov);
    var q = ov.querySelector(".gz-pl__q");
    var box2 = ov.querySelector(".gz-pl__list");
    function paintList() {
      var n = String(q.value || "").trim().toLowerCase();
      var rows = list.filter(function (f) { return !n || String(f.name || "").toLowerCase().indexOf(n) >= 0; });
      box2.innerHTML = rows.length
        ? rows.map(function (f) { return '<button type="button" class="gz-pl__row" data-gz-pick="' + esc(f.id) + '" data-gz-pick-nm="' + esc(f.name) + '">' + esc(f.name) + "</button>"; }).join("")
        : '<p class="gz-pl__empty">' + (list.length ? "Niemand gefunden." : "Noch keine Freunde mit FFC-Zugang. Partner brauchen Nickname und Passwort bei FFC.") + "</p>";
    }
    paintList();
    q.addEventListener("input", paintList);
    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target.closest("[data-gz-pl-close]")) { ov.remove(); return; }
      var r = e.target.closest("[data-gz-pick]");
      if (!r) return;
      var nm = r.getAttribute("data-gz-pick-nm");
      box.querySelector(".gz-partner__id").value = r.getAttribute("data-gz-pick");
      box.querySelector(".gz-partner__nm").value = nm;
      box.querySelector("[data-gz-plist]").textContent = "Partner: " + nm;
      var hint = box.querySelector(".gz-partner__hint");
      hint.hidden = false;
      hint.textContent = "Du wählst " + nm + ", bitte sie/ihn bei sich zu bestätigen.";
      ov.remove();
    });
  }
  /* opts.friends nach dem Einfügen setzen (für die Partnerliste) */
  function setFriends(root, friends) {
    var box = root && root.querySelector(".gz");
    if (box) box._gzFriends = friends || [];
  }

  global.GoZirkelSetup = {
    html: html,
    bind: bind,
    setFriends: setFriends,
    PRESETS: PRESETS,
    read: read,
    parse: parse,
    toNote: toNote,
    label: label,
    totalSec: totalSec,
    withFlag: withFlag,
    startInfo: startInfo
  };
})(window);
