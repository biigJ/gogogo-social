/* tamagotchi.js — Profilkreis zeigt, wie gut jemand dranbleibt
 *
 *   GoTama.init(host)            host: { rest, todayIso, onChange }
 *   GoTama.decorate(el, id)      setzt Ringfarbe + Wochen-Badge an .crew-story (lädt bei Bedarf nach)
 *   GoTama.invalidate()          nach Erledigt / Verschieben / Ausfallen
 *
 * Regeln (Tag für Tag, letzte 12 Wochen, nur eigene Events der Person):
 *   Jeder Wechsel geht genau EINE Stufe. Ausnahme: von Rot zurück springt es über Gelb-Orange direkt auf Gelb.
 *   Tag mit erledigtem Event              → eine Stufe zurück (bis 0; 3 → 1)
 *   Tag mit geplantem, nicht erledigtem   → eine Stufe hoch (bis Rot)
 *   Event ausdrücklich ausfallen lassen   → eine Stufe hoch, außer am Tag steht ein Ersatz (Alternative)
 *   Event verschoben: das erste Mal je Event bleibt die Farbe, ab dem zweiten Mal eine Stufe hoch
 *                                           (höchstens Gelb-Orange, 2), gezählt am Tag des Verschiebens
 *   Tag ohne Event                        → bleibt
 *   Stufen: 0 normal · 1 Gelb · 2 Gelb-Orange · 3 Rot
 *   Ziffer (nur am eigenen Kreis): Tage am Stück, an denen abgehakt wurde. Tage ohne Event zählen nicht und
 *   brechen nicht ab; ein Tag mit offenem oder ausgefallenem Event bricht ab. Heute zählt erst, wenn abgehakt.
 *   Verschieben merkt sich die Datenbank in events.moved_days (go-tamagotchi.sql).
 */
(function (global) {
  "use strict";

  var host = null;
  var cache = {}; // id → { level, weeks }
  var pending = {}; // id → true (im nächsten Batch laden)
  var timer = null;
  var noMovedCol = false;
  var LABEL = ["", "1× verschoben", "2× verschoben", "Training ausgefallen"];
  var COLORS = ["#2E9E5B", "#F2C94C", "#F29A2E", "#E5251B"];

  function berlinDay(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    } catch (e) {
      return String(ts).slice(0, 10);
    }
  }
  function addDays(iso, n) {
    var d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function mondayOf(iso) {
    var d = new Date(iso + "T12:00:00Z");
    return addDays(iso, -((d.getUTCDay() + 6) % 7));
  }
  function today() {
    return host && host.todayIso ? host.todayIso() : berlinDay(new Date().toISOString());
  }

  function compute(rows, todayIso) {
    var done = {}, missed = {}, cancelled = {}, moved = {}, other = {};
    (rows || []).forEach(function (r) {
      /* erstes Verschieben je Event ist frei; ab dem zweiten zählt es (Tag liegt evtl. in der Zukunft → heute) */
      (r.moved_days || []).forEach(function (m, i) {
        if (i < 1) return;
        m = String(m).slice(0, 10);
        if (m > todayIso) m = todayIso;
        moved[m] = (moved[m] || 0) + 1;
      });
      var d = berlinDay(r.starts_at);
      if (!d || d > todayIso) return;
      /* (zukünftige Events zählen nur über moved_days oben) */
      if (r.status === "erledigt") done[d] = true;
      else if (r.status === "ausgefallen") cancelled[d] = true;
      else if (r.status === "geplant" && d < todayIso) missed[d] = true;
      if (r.status !== "ausgefallen") other[d] = true;
    });
    var start = addDays(mondayOf(todayIso), -7 * 12);
    var level = 0;
    for (var d = start; d <= todayIso; d = addDays(d, 1)) {
      if (done[d]) level = level >= 3 ? 1 : Math.max(0, level - 1);
      else if (d < todayIso && cancelled[d] && !other[d]) level = Math.min(3, level + 1);
      else if (d < todayIso && missed[d]) level = Math.min(3, level + 1);
      else if (moved[d]) level = level >= 2 ? level : Math.min(2, level + moved[d]);
    }
    /* Tage am Stück abgehakt (rückwärts ab heute) */
    var days = 0;
    for (var k = todayIso; k >= start; k = addDays(k, -1)) {
      if (done[k]) { days += 1; continue; }
      if (k === todayIso) continue;
      if (missed[k] || (cancelled[k] && !other[k])) break;
    }
    return { level: level, weeks: days };
  }

  function isAccountId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(id || ""));
  }

  function flush() {
    timer = null;
    var ids = Object.keys(pending);
    pending = {};
    if (!ids.length || !host || !host.rest) return;
    var t = today();
    var from = addDays(mondayOf(t), -7 * 12);
    var base = "events?user_id=in.(" + ids.map(encodeURIComponent).join(",") + ")" +
      "&starts_at=gte." + from + "T00:00:00Z&starts_at=lte." + addDays(t, 1) + "T00:00:00Z&order=starts_at.asc&limit=5000&select=user_id,starts_at,status";
    /* verschobene Events liegen oft schon in der Zukunft: die mit moved_days zusätzlich laden */
    var withMoved = base.replace("&starts_at=lte." + addDays(t, 1) + "T00:00:00Z", "&or=(starts_at.lte." + addDays(t, 1) + "T00:00:00Z,moved_days.neq.{})") + ",moved_days";
    var q = noMovedCol ? host.rest(base) : host.rest(withMoved).catch(function () {
      noMovedCol = true;
      return host.rest(base);
    });
    q.then(function (rows) {
      var by = {};
      ids.forEach(function (id) { by[id] = []; });
      (rows || []).forEach(function (r) { if (by[r.user_id]) by[r.user_id].push(r); });
      ids.forEach(function (id) { cache[id] = compute(by[id], t); });
      if (host.onChange) host.onChange();
    }).catch(function () {
      ids.forEach(function (id) { cache[id] = { level: 0, weeks: 0 }; });
    });
  }

  function decorate(el, id) {
    if (!el || !isAccountId(id)) return;
    id = String(id);
    var s = cache[id];
    if (!s) {
      if (!pending[id]) {
        pending[id] = true;
        if (!timer) timer = setTimeout(flush, 30);
      }
      return;
    }
    el.classList.remove("tama-0", "tama-1", "tama-2", "tama-3");
    el.classList.add("tama-" + s.level);
    /* Farbe für Puls und dicken Rand: Grün, Gelb, Gelb-Orange, Rot */
    el.style.setProperty("--tama", COLORS[s.level] || COLORS[0]);
    var ring = el.querySelector(".crew-story__ring") || el;
    var old = ring.querySelector(".tama-badge");
    if (old) old.remove();
    var isMe = host && host.meId && String(host.meId()) === id;
    if (isMe) {
      var b = document.createElement("span");
      b.className = "tama-badge";
      b.textContent = String(s.weeks);
      b.setAttribute("aria-label", s.weeks + (s.weeks === 1 ? " Tag" : " Tage") + " am Stück abgehakt");
      ring.appendChild(b);
    }
    if (s.level) el.title = (el.title ? el.title + " · " : "") + LABEL[s.level];
  }

  function injectCss() {
    if (document.getElementById("tama-css")) return;
    var st = document.createElement("style");
    st.id = "tama-css";
    st.textContent =
      ".crew-story__ring{position:relative}" +
      ".crew-story.tama-0:not(.is-training) .crew-story__ring{outline:2px solid #2E9E5B;outline-offset:6px}" +
      ".crew-story.tama-1 .crew-story__ring{outline:3px solid #F2C94C;outline-offset:6px}" +
      ".crew-story.tama-2 .crew-story__ring{outline:3px solid #F29A2E;outline-offset:6px}" +
      ".crew-story.tama-3 .crew-story__ring{outline:3px solid #E5251B;outline-offset:6px}" +
      ".tama-badge{position:absolute;top:-6px;right:-6px;min-width:24px;height:24px;padding:0 5px;box-sizing:border-box;" +
      "border-radius:12px;background:#2A2118;color:#F6F1E8;border:2px solid #F3EEE4;font:800 14px/20px var(--display, system-ui);" +
      "text-align:center;z-index:2;pointer-events:none}";
    document.head.appendChild(st);
  }

  global.GoTama = {
    init: function (h) { host = h; injectCss(); },
    decorate: decorate,
    invalidate: function () { cache = {}; if (host && host.onChange) host.onChange(); },
    _compute: compute
  };
})(window);
