/* coach-browse.js — Mein Coach → „Details & Auswahl“
 *
 *   GoCoachBrowse.init({ rest, me, toast, color, addVc, openAbout, change })
 *   GoCoachBrowse.open({ slide, art, nameRow, before, trainer, buttons })
 *
 * Ersetzt Bild und Namen des Coaches durch eine waagerechte Reihe (scroll-snap wie Aktuell):
 * zuerst der eigene Coach, dann alle Coaches mit blauem c. Je Seite: Foto, Name mit Kreis (Haken = mein Coach),
 * „Über mich“, Sterne mit Schnitt, bis zu drei Bewertungen (+ „mehr“).
 * Auf dem ersten Foto eine Winke-Hand: wackelt beim Öffnen 1,5 s, Tippen erklärt das Wischen, verschwindet beim Wischen.
 */
(function (global) {
  "use strict";

  var host = null;
  var CSS =
    ".gcb-track{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x pan-y;margin:0 -2px}" +
    ".gcb-track::-webkit-scrollbar{display:none}" +
    ".gcb-page{flex:0 0 100%;scroll-snap-align:center;scroll-snap-stop:always;box-sizing:border-box;padding:0 2px;min-width:0}" +
    ".gcb-art{position:relative;width:100%;aspect-ratio:1/1;overflow:hidden;background:rgba(127,127,127,.15)}" +
    ".gcb-art img{display:block;width:100%;height:100%;object-fit:cover}" +
    ".gcb-art__ph{position:absolute;inset:0;display:grid;place-items:center;font:600 96px/1 'Playfair Display',Georgia,serif;opacity:.3}" +
    /* Hand: rechtes Drittel, 3/5 davon (Mitte bei 86,7 %), oben */
    ".gcb-hand{position:absolute;left:86.7%;top:9%;width:46px;height:46px;margin-left:-23px;padding:0;border:0;background:none;cursor:pointer;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35));transition:opacity .25s ease}" +
    ".gcb-hand svg{width:100%;height:100%;display:block}" +
    ".gcb-hand.is-gone{opacity:0;pointer-events:none}" +
    ".gcb-hand.is-wave svg{animation:gcbwave 1.5s ease-in-out;transform-origin:60% 85%}" +
    "@keyframes gcbwave{0%,100%{transform:rotate(0)}10%,50%,90%{transform:rotate(-14deg)}30%,70%{transform:rotate(14deg)}}" +
    ".gcb-name{display:flex;align-items:center;gap:10px;margin:16px 0 0}" +
    ".gcb-name h3{margin:0;flex:1 1 auto;min-width:0}" +
    ".gcb-pick{flex:none;width:34px;height:34px;border-radius:50%;border:1.6px solid currentColor;background:transparent;color:inherit;display:grid;place-items:center;padding:0;cursor:pointer}" +
    ".gcb-pick svg{width:18px;height:18px;display:block}" +
    ".gcb-pick.is-on{background:currentColor}" +
    ".gcb-pick.is-on svg{color:var(--gcb-bg,#F3EEE4)}" +
    ".gcb-det{margin:10px 0 4px}" +
    ".gcb-h{margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.6}" +
    ".gcb-about{margin:0 0 14px;font-size:16px;line-height:1.45;white-space:pre-wrap}" +
    ".gcb-rate{display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0 10px}" +
    ".gcb-stars{display:flex;gap:6px}" +
    ".gcb-stars svg{width:30px;height:30px;display:block}" +
    ".gcb-avg{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}" +
    ".gcb-revs{display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center}" +
    ".gcb-rev{margin:0;font-size:15px;line-height:1.4;max-width:34em}" +
    ".gcb-rev small{display:block;margin-top:2px;font-size:13px;opacity:.6}" +
    ".gcb-more{border:0;background:none;color:inherit;font:inherit;font-size:15px;font-weight:600;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:4px}" +
    ".gcb-none{margin:0;font-size:14px;opacity:.6;text-align:center}" +
    ".gcb-dots{display:flex;justify-content:center;gap:6px;margin:10px 0 0}" +
    ".gcb-dots i{width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.25}" +
    ".gcb-dots i.is-on{opacity:.9}" +
    ".gcb-hidden{display:none !important}" +
    ".kreis-page__body.gcb-on > :not(.team-slide){display:none !important}" +
    ".team-slide.gcb-on > :not(.gcb-track){display:none !important}";

  var HAND_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.4 11.6V5.3a1.35 1.35 0 0 1 2.7 0v5.2h.5V3.6a1.35 1.35 0 0 1 2.7 0v6.9h.5V4.5a1.35 1.35 0 0 1 2.7 0v7.1h.5V7.3a1.35 1.35 0 0 1 2.7 0v7.6c0 4.4-3 7.6-7.2 7.6-2.6 0-4.6-1.2-6-3.3l-3.1-4.7a1.4 1.4 0 0 1 2.2-1.7l1.9 2.2z"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var STAR_PATH = "M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5-4.8-4.5 6.5-.8z";
  var uid = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ensureCss() {
    if (document.getElementById("gcb-css")) return;
    var st = document.createElement("style");
    st.id = "gcb-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function aboutOf(c) {
    var a = c && c.about_me;
    if (typeof a === "string") { try { a = JSON.parse(a); } catch (e) { return String(c.about_me || "").trim(); } }
    return String((a && a.text) || "").trim();
  }
  function starsHtml(avg) {
    var out = "";
    for (var i = 0; i < 5; i++) {
      var f = Math.max(0, Math.min(1, (avg || 0) - i));
      var id = "gcbs" + (++uid);
      out += '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        (f > 0 ? '<defs><linearGradient id="' + id + '"><stop offset="' + f + '" stop-color="currentColor"/><stop offset="' + f + '" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' : "") +
        '<path d="' + STAR_PATH + '" fill="' + (f > 0 ? "url(#" + id + ")" : "none") + '" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    }
    return '<span class="gcb-stars">' + out + "</span>";
  }

  function pageHtml(c, mine, first) {
    var name = String(c.name || c.nickname || "Coach");
    return '<div class="gcb-page" data-gcb-id="' + esc(c.id) + '">' +
      '<div class="gcb-art">' +
      (c.photo_url ? '<img src="' + esc(c.photo_url) + '" alt="" loading="lazy" />' : '<span class="gcb-art__ph">' + esc(name.slice(0, 1)) + "</span>") +
      (first ? '<button type="button" class="gcb-hand" data-gcb-hand aria-label="Wischen für weitere Coaches">' + HAND_SVG + "</button>" : "") +
      "</div>" +
      '<div class="gcb-name"><h3 class="team-slide__coach-name-text" data-gcb-name>' + esc(name) + "</h3>" +
      '<button type="button" class="gcb-pick' + (mine ? " is-on" : "") + '" data-gcb-pick="' + esc(c.id) + '" aria-label="' + (mine ? "Dein Coach" : "Als Coach wählen") + '">' + (mine ? CHECK_SVG : "") + "</button></div>" +
      '<div class="gcb-det">' +
      '<p class="gcb-h">Über mich</p><p class="gcb-about">' + esc(aboutOf(c) || "Noch kein Text.") + "</p>" +
      '<div data-gcb-rev><p class="gcb-none">Bewertungen laden …</p></div>' +
      "</div></div>";
  }

  function paintReviews(el, c) {
    host.rest("go_coach_reviews?coach_id=eq." + encodeURIComponent(c.id) + "&select=stars,body,updated_at&order=updated_at.desc&limit=50")
      .catch(function () { return []; })
      .then(function (rows) {
        rows = rows || [];
        /* Sterne immer zeigen, auch ohne Bewertung (leer) */
        if (!rows.length) { el.innerHTML = '<div class="gcb-rate">' + starsHtml(0) + '</div><p class="gcb-none">Noch keine Bewertungen.</p>'; return; }
        var avg = rows.reduce(function (s, r) { return s + (Number(r.stars) || 0); }, 0) / rows.length;
        var texts = rows.filter(function (r) { return String(r.body || "").trim(); });
        el.innerHTML = '<div class="gcb-rate" role="img" aria-label="' + String(Math.round(avg * 10) / 10).replace(".", ",") + ' von 5 Sternen">' +
          starsHtml(avg) + '<span class="gcb-avg">' + (Math.round(avg * 10) / 10).toFixed(1).replace(".", ",") + "</span></div>" +
          '<div class="gcb-revs">' + texts.slice(0, 3).map(function (r) {
            return '<p class="gcb-rev">„' + esc(String(r.body).trim()) + '“<small>' + "★".repeat(Math.max(1, Math.min(5, r.stars || 0))) + "</small></p>";
          }).join("") +
          (texts.length > 3 ? '<button type="button" class="gcb-more" data-gcb-more="' + esc(c.id) + '">mehr</button>' : "") + "</div>";
      });
  }

  function open(o) {
    if (!host || !o || !o.slide || !o.trainer) return;
    ensureCss();
    var slide = o.slide;
    var existing = slide.querySelector(".gcb-track");
    if (existing) { wave(existing); return; }
    var bg = host.color ? host.color("#F3EEE4") : "#F3EEE4";
    var mineId = String(o.trainer.id);
    host.rest("go_accounts?coach_verified_at=not.is.null&deleted_at=is.null&select=id,name,nickname,photo_url,about_me&limit=60")
      .catch(function () { return host.rest("go_accounts?coach_verified_at=not.is.null&select=id,name,nickname,photo_url,about_me&limit=60"); })
      .catch(function () { return []; })
      .then(function (rows) {
        var me = String(host.me() || "");
        var list = [o.trainer].concat((rows || []).filter(function (r) { return r && String(r.id) !== mineId && String(r.id) !== me; }));
        /* Über-mich-Text des eigenen Coaches fehlt in teamPeople manchmal: aus der Liste nehmen */
        var fresh = (rows || []).filter(function (r) { return String(r.id) === mineId; })[0];
        if (fresh) {
          var merged = Object.assign({}, o.trainer);
          Object.keys(fresh).forEach(function (k) { if (fresh[k] != null && fresh[k] !== "") merged[k] = fresh[k]; });
          list[0] = merged;
        }
        var track = document.createElement("div");
        track.className = "gcb-track";
        track.style.setProperty("--gcb-bg", bg);
        track.innerHTML = list.map(function (c, i) { return pageHtml(c, String(c.id) === mineId, i === 0); }).join("");
        var hand = track.querySelector("[data-gcb-hand]");
        if (hand) hand.style.color = bg;
        /* blaues c hinter den Namen */
        track.querySelectorAll("[data-gcb-name]").forEach(function (h) {
          var pg = h.closest("[data-gcb-id]");
          if (host.addVc && pg) host.addVc(h, pg.getAttribute("data-gcb-id"));
        });
        o.art.classList.add("gcb-hidden");
        if (o.nameRow) o.nameRow.classList.add("gcb-hidden");
        slide.insertBefore(track, o.art);
        /* Detailansicht: nur die Reihe der Coaches. Buttons, Stempelkarte und Gruppentrainings sind hier nicht nutzbar */
        var page = slide.closest(".kreis-page");
        var pageBody = slide.closest(".kreis-page__body");
        slide.classList.add("gcb-on");
        if (pageBody) pageBody.classList.add("gcb-on");
        /* Pfeil oben links: erst zurück zur normalen Ansicht, beim zweiten Tippen zu den Kreisen */
        var back = page && page.querySelector(".kreis-page__back");
        function close(e) {
          if (e) { e.preventDefault(); e.stopImmediatePropagation(); }
          if (back) back.removeEventListener("click", close, true);
          track.remove();
          o.art.classList.remove("gcb-hidden");
          if (o.nameRow) o.nameRow.classList.remove("gcb-hidden");
          (o.hide || []).forEach(function (el) { if (el) el.classList.remove("gcb-hidden"); });
          slide.classList.remove("gcb-on");
          if (pageBody) { pageBody.classList.remove("gcb-on"); pageBody.scrollTop = 0; }
        }
        if (back) back.addEventListener("click", close, true);
        list.forEach(function (c) {
          var pg = track.querySelector('[data-gcb-id="' + String(c.id).replace(/"/g, "") + '"] [data-gcb-rev]');
          if (pg) paintReviews(pg, c);
        });
        var idx = 0;
        track.addEventListener("scroll", function () {
          if (hand && track.scrollLeft > 8) hand.classList.add("is-gone");
          var w = track.clientWidth || 1;
          var i = Math.round(track.scrollLeft / w);
          if (i === idx) return;
          idx = i;
        }, { passive: true });
        track.addEventListener("click", function (e) {
          var t = e.target.closest && e.target.closest("[data-gcb-hand],[data-gcb-pick],[data-gcb-more]");
          if (!t) return;
          if (t.hasAttribute("data-gcb-hand")) {
            if (global.GoDialog) GoDialog.alert("Wischen für weitere Coaches.");
            return;
          }
          var id = t.getAttribute("data-gcb-pick") || t.getAttribute("data-gcb-more");
          var c = list.filter(function (x) { return String(x.id) === String(id); })[0];
          if (!c) return;
          if (t.hasAttribute("data-gcb-more")) { if (host.openAbout) host.openAbout(c); return; }
          if (String(c.id) === mineId) return;
          GoDialog.confirm("Coach ändern?", { body: String(c.name || "Coach").split(" ")[0] + " wird Dein Coach, sobald " + String(c.name || "Coach").split(" ")[0] + " annimmt.", ok: "Ändern", cancel: "Abbrechen" })
            .then(function (yes) {
              if (!yes) return;
              Promise.resolve(host.change ? host.change(c, o.trainer) : null).then(function () {
                GoDialog.alert("Die Coaches sind benachrichtigt. Dein aktueller Wochenplan bleibt, bis Dein neuer Coach oder Du ihn angepasst hast. Buch ein Erstgespräch über „Termin buchen“.");
              });
            });
        });
        wave(track);
      });
  }

  function wave(track) {
    var hand = track && track.querySelector("[data-gcb-hand]");
    if (!hand) return;
    hand.classList.remove("is-gone");
    hand.classList.remove("is-wave");
    void hand.offsetWidth;
    hand.classList.add("is-wave");
    setTimeout(function () { hand.classList.remove("is-wave"); }, 1600);
    if (track.scrollLeft > 8) { try { track.scrollTo({ left: 0, behavior: "smooth" }); } catch (e) { track.scrollLeft = 0; } }
  }

  global.GoCoachBrowse = {
    init: function (h) { host = h; ensureCss(); },
    open: open
  };
})(window);
