/* exercise-links.js — Plus → Videos: Link einfügen, Übung aus der Liste wählen, Sterne vergeben
 *
 * Übungen kommen aus go_exercise_catalog (eine Liste, Labels, go-uebungen-katalog.sql).
 * Nutzer schreiben keinen Übungsnamen selbst, sie wählen ihn aus.
 *
 *   GoExLinks.init({ rest, me })
 *   GoExLinks.mount(el)
 *
 * Reihenfolge je Übung: gogogo-Link zuerst, dann Nutzer-Links nach Sternen (exercise-media.js / linksFor).
 * Tabellen: go_exercise_links, go_exercise_link_stars (go-exercise-links.sql).
 */
(function (global) {
  "use strict";

  var host = null;
  var names = null;
  var myStars = {};
  var query = "";
  var label = "";
  var labelsOf = {};
  var photoOf = {};
  var LABELS = ["Push", "Pull", "Beine", "Glutes", "Oberkörper", "Arme", "Rumpf", "Mehrgelenkig", "Sprung", "Mobility", "Ausdauer"];

  var CSS =
    ".gxl{margin:18px 0 8px;text-align:left;color:#2A2118}" +
    ".gxl__search{display:block;width:100%;box-sizing:border-box;min-height:42px;padding:0 12px;border:1px solid rgba(42,33,24,.25);border-radius:10px;background:#fff;font:inherit;font-size:15px;color:#2A2118;margin:0 0 10px}" +
    ".gxl__hint{margin:0 0 10px;font-size:13px;color:rgba(42,33,24,.65)}" +
    ".gxl__ex{border-top:1px solid rgba(42,33,24,.14)}" +
    ".gxl__ex:last-child{border-bottom:1px solid rgba(42,33,24,.14)}" +
    ".gxl__ex summary{list-style:none;display:flex;align-items:center;gap:8px;padding:11px 2px;cursor:pointer}" +
    ".gxl__ex summary::-webkit-details-marker{display:none}" +
    ".gxl__name{flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere;hyphens:auto}" +
    ".gxl__count{font-size:12px;color:rgba(42,33,24,.6);white-space:nowrap}" +
    ".gxl__link{display:flex;align-items:center;gap:8px;padding:6px 0}" +
    ".gxl__src{flex:1;min-width:0;font-size:13px;color:rgba(42,33,24,.75);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".gxl__src b{color:#2A2118}" +
    ".gxl__star{flex:none;display:inline-flex;align-items:center;gap:3px;min-height:34px;padding:0 10px;border-radius:999px;border:1px solid rgba(42,33,24,.3);background:transparent;color:#2A2118;font:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
    ".gxl__star.is-on{background:#2A2118;color:#F6F1E8;border-color:#2A2118}" +
    ".gxl__add{display:flex;gap:6px;margin:6px 0 12px}" +
    ".gxl__add input{flex:1;min-width:0;min-height:40px;box-sizing:border-box;padding:0 10px;border:1px solid rgba(42,33,24,.25);border-radius:10px;background:#fff;font:inherit;font-size:14px}" +
    ".gxl__add button{flex:none;min-height:40px;padding:0 14px;border:0;border-radius:999px;background:#2A2118;color:#F6F1E8;font:inherit;font-weight:700;cursor:pointer}" +
    ".gxl__empty{margin:8px 0;font-size:14px;color:rgba(42,33,24,.65)}" +
    ".gxl__new{display:block;width:100%;box-sizing:border-box;min-height:46px;padding:0 12px;border:1.5px solid #2A2118;border-radius:10px;background:#fff;font:inherit;font-size:15px;color:#2A2118;margin:0 0 6px}" +
    ".gxl__newhint{margin:0 0 12px;font-size:13px;font-weight:600;color:#2A2118;min-height:18px}" +
    ".gxl__chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}" +
    ".gxl__chip{min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(42,33,24,.3);background:transparent;color:#2A2118;font:inherit;font-size:13px;font-weight:600;cursor:pointer}" +
    ".gxl__chip.is-on{background:#2A2118;color:#F6F1E8;border-color:#2A2118}" +
    ".gxl__pick{flex:none;min-height:30px;padding:0 12px;border-radius:999px;border:0;background:#2A2118;color:#F6F1E8;font:inherit;font-size:12px;font-weight:700;cursor:pointer}" +
    ".gxl__tags{display:block;font-size:11px;color:rgba(42,33,24,.55);font-weight:500}" +
    ".gxl__media{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 8px}" +
    ".gxl__frame{position:relative;aspect-ratio:9/16;border-radius:12px;overflow:hidden;background:rgba(42,33,24,.08);display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;color:rgba(42,33,24,.55)}" +
    ".gxl__frame img,.gxl__frame iframe{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border:0}" +
    ".gxl__frame--video{background:#111;color:rgba(246,241,232,.7)}" +
    ".gxl__submit{margin:14px 0 8px;display:grid;gap:8px}" +
    ".gxl__submit p{margin:0;font-size:14px;line-height:1.4}" +
    ".gxl__submit button:disabled{opacity:.4}" +
    ".gxl__submit button{justify-self:start;min-height:42px;padding:0 18px;border:0;border-radius:999px;background:#2A2118;color:#F6F1E8;font:inherit;font-weight:700;cursor:pointer}";

  function ensureCss() {
    if (document.getElementById("gxl-css")) return;
    var s = document.createElement("style");
    s.id = "gxl-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function loadNamesFromBlocks() {
    return host.rest("courses?is_active=eq.true&select=course_sessions!course_sessions_course_id_fkey(blocks)&limit=500").then(function (rows) {
      var seen = {};
      (rows || []).forEach(function (c) {
        (c.course_sessions || []).forEach(function (s) {
          (s.blocks || []).forEach(function (bl) {
            (bl.items || []).forEach(function (it) {
              if (it && it.name && !seen[GoExMedia.key(it.name)]) seen[GoExMedia.key(it.name)] = String(it.name).trim();
            });
          });
        });
      });
      return Object.keys(seen).map(function (k) { return seen[k]; });
    });
  }

  function loadNames() {
    if (names) return Promise.resolve(names);
    return host.rest("go_exercise_catalog?select=name,labels,photo_url&order=name.asc&limit=1000")
      .catch(function () { return host.rest("go_exercise_catalog?select=name,labels&order=name.asc&limit=1000"); })
      .then(function (rows) {
        if (!rows || !rows.length || !("labels" in rows[0])) return loadNamesFromBlocks();
        labelsOf = {};
        return rows.map(function (r) {
          labelsOf[GoExMedia.key(r.name)] = r.labels || [];
          if (r.photo_url) photoOf[GoExMedia.key(r.name)] = r.photo_url;
          return r.name;
        });
      })
      .catch(loadNamesFromBlocks)
      .then(function (list) {
        names = list.sort(function (a, b) { return a.localeCompare(b, "de"); });
        return names;
      });
  }

  function loadMyStars() {
    var me = host.me();
    if (!me) return Promise.resolve();
    return host.rest("go_exercise_link_stars?account_id=eq." + encodeURIComponent(me) + "&select=link_id&limit=5000")
      .then(function (rows) {
        myStars = {};
        (rows || []).forEach(function (r) { myStars[r.link_id] = true; });
      })
      .catch(function () { myStars = {}; });
  }

  function linkRow(l, name) {
    var info = GoExMedia.parse(l.url) || { label: "Link" };
    return '<div class="gxl__link">' +
      '<button type="button" class="gxm-btn" data-gxl-play="' + esc(l.url) + '" data-gxl-name="' + esc(name) + '" aria-label="Abspielen">' + GoExMedia.playIcon + "</button>" +
      '<span class="gxl__src"><b>' + esc(info.label) + "</b> · " + esc(l.admin ? "gogogo" : (l.by || "Nutzer")) + "</span>" +
      (l.admin ? "" : '<button type="button" class="gxl__star' + (myStars[l.id] ? " is-on" : "") + '" data-gxl-star="' + esc(l.id) + '" aria-label="Stern">★ ' + (l.stars || 0) + "</button>") +
      "</div>";
  }

  /* Aufgeklappt: Foto links, Hochformat-Video rechts (erstes Video, lädt erst beim Aufklappen) */
  function mediaHtml(name, links) {
    var photo = photoOf[GoExMedia.key(name)];
    var first = null;
    for (var i = 0; i < links.length; i++) {
      var info = GoExMedia.parse(links[i].url);
      if (info && info.embed) { first = info; break; }
    }
    return '<div class="gxl__media">' +
      '<div class="gxl__frame">' + (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy" />' : "Foto folgt") + "</div>" +
      '<div class="gxl__frame gxl__frame--video"' + (first ? ' data-gxl-embed="' + esc(first.embed.replace("autoplay=1", "autoplay=0")) + '"' : "") + ">" +
      (first ? "" : "Noch kein Video") + "</div></div>";
  }
  function loadEmbed(details) {
    var f = details && details.querySelector("[data-gxl-embed]");
    if (!f || f.querySelector("iframe")) return;
    f.innerHTML = '<iframe src="' + esc(f.getAttribute("data-gxl-embed")) + '" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy" title="Video"></iframe>';
  }

  function exHtml(name, open, picking) {
    var links = GoExMedia.linksFor(name);
    var tags = labelsOf[GoExMedia.key(name)] || [];
    return '<details class="gxl__ex" data-gxl-ex="' + esc(name) + '"' + (open ? " open" : "") + ">" +
      '<summary><span class="gxl__name">' + esc(name) +
      (tags.length ? '<span class="gxl__tags">' + esc(tags.join(" · ")) + "</span>" : "") +
      '</span><span class="gxl__count">' +
      (links.length ? links.length + (links.length === 1 ? " Video" : " Videos") : "kein Video") + "</span>" +
      (picking ? '<button type="button" class="gxl__pick" data-gxl-pick>Hierhin</button>' : "") +
      "</summary>" +
      mediaHtml(name, links) +
      links.map(function (l) { return linkRow(l, name); }).join("") +
      "</details>";
  }

  function pendingUrl(el) {
    var inp = el.querySelector("[data-gxl-new]");
    var url = inp ? inp.value.trim() : "";
    var info = url ? GoExMedia.parse(url) : null;
    return info && info.embed ? url : "";
  }

  function paint(el) {
    var box = el.querySelector("[data-gxl-list]");
    var open = {};
    box.querySelectorAll("details[open]").forEach(function (d) { open[d.getAttribute("data-gxl-ex")] = true; });
    var picking = !!pendingUrl(el);
    var q = String(query || "").trim();
    /* Liste erst nach Label („Alle“ inklusive) oder Übungsname */
    if (!label && !q) {
      box.innerHTML = "";
    } else {
      var list = (names || []).filter(function (n) {
        if (q && n.toLowerCase().indexOf(q.toLowerCase()) === -1) return false;
        if (label && label !== "Alle" && (labelsOf[GoExMedia.key(n)] || []).indexOf(label) === -1) return false;
        return true;
      });
      var exact = q && (names || []).some(function (n) { return n.toLowerCase() === q.toLowerCase(); });
      box.innerHTML = (list.length
        ? list.map(function (n) { return exHtml(n, open[n], picking); }).join("")
        : '<p class="gxl__empty">Keine Übung gefunden.</p>') +
        (q.length >= 2 && !exact
          ? '<div class="gxl__submit"><p>„' + esc(q) + '“ fehlt? ' + (picking ? "Sende das Video mit diesem Namen ein." : "Link oben einfügen, dann einreichen.") + "</p>" +
            '<button type="button" data-gxl-submit' + (picking ? "" : " disabled") + ">Mit Video einreichen</button></div>"
          : "");
    }
    box.querySelectorAll("details[open]").forEach(loadEmbed);
    el.querySelectorAll("[data-gxl-label]").forEach(function (c) {
      c.classList.toggle("is-on", c.getAttribute("data-gxl-label") === label);
    });
    var hint = el.querySelector("[data-gxl-newhint]");
    if (hint) {
      var raw = (el.querySelector("[data-gxl-new]") || {}).value || "";
      hint.textContent = picking ? "Jetzt die passende Übung wählen: „Hierhin“ tippen." : raw.trim() ? "Bitte einen Instagram- oder YouTube-Link einfügen." : "";
    }
  }

  function refreshOne(el, name) {
    var d = el.querySelector('details[data-gxl-ex="' + (global.CSS && CSS.escape ? CSS.escape(name) : name) + '"]');
    if (d) {
      d.outerHTML = exHtml(name, true, !!pendingUrl(el));
      loadEmbed(el.querySelector('details[data-gxl-ex="' + (global.CSS && CSS.escape ? CSS.escape(name) : name) + '"]'));
    }
  }

  function mount(el) {
    if (!el || !host || !global.GoExMedia) return;
    ensureCss();
    if (!el.dataset.gxlReady) {
      el.dataset.gxlReady = "1";
      el.className = "gxl";
      el.innerHTML =
        '<input type="url" inputmode="url" class="gxl__new" placeholder="Link aus Instagram oder YouTube" data-gxl-new />' +
        '<p class="gxl__newhint" data-gxl-newhint></p>' +
        '<div class="gxl__chips">' + ["Alle"].concat(LABELS).map(function (l) {
          return '<button type="button" class="gxl__chip" data-gxl-label="' + esc(l) + '">' + esc(l) + "</button>";
        }).join("") + "</div>" +
        '<input type="search" class="gxl__search" placeholder="Übungsname" data-gxl-q />' +
        '<div data-gxl-list></div>';
      el.querySelector("[data-gxl-list]").addEventListener("toggle", function (e) {
        if (e.target && e.target.open) loadEmbed(e.target);
      }, true);
      el.querySelector("[data-gxl-q]").addEventListener("input", function () {
        query = this.value;
        paint(el);
      });
      el.querySelector("[data-gxl-new]").addEventListener("input", function () { paint(el); });
      el.addEventListener("click", function (e) { onClick(el, e); });
    }
    Promise.all([GoExMedia.ready(), loadNames(), loadMyStars()]).then(function () { paint(el); })
      .catch(function () { el.querySelector("[data-gxl-list]").innerHTML = '<p class="gxl__empty">Übungen konnten nicht geladen werden.</p>'; });
  }

  function onClick(el, e) {
    if (e.target.closest("[data-gxl-submit]")) {
      var nm = String(query || "").trim();
      var vid = pendingUrl(el);
      if (nm.length < 2) { if (host.toast) host.toast("Wie heißt die Übung?"); return; }
      if (!vid) { if (host.toast) host.toast("Bitte erst einen Instagram- oder YouTube-Link einfügen."); return; }
      var btn = e.target.closest("[data-gxl-submit]");
      btn.disabled = true;
      host.rest("go_exercise_submissions", { method: "POST", prefer: "return=minimal",
        body: { account_id: host.me(), name: nm, note: vid } })
        .then(function () {
          el.querySelector("[data-gxl-new]").value = "";
          el.querySelector("[data-gxl-q]").value = "";
          query = "";
          paint(el);
          if (global.GoDialog) GoDialog.alert("Danke! Wir schauen uns „" + nm + "“ an und geben die Übung frei.");
        })
        .catch(function (err) {
          btn.disabled = false;
          var m = String((err && err.message) || "");
          if (host.toast) host.toast(/go_exercise_submissions|relation/.test(m) ? "Tabelle fehlt: go-uebung-einreichen.sql ausführen" : "Einreichen ging nicht");
        });
      return;
    }
    var play = e.target.closest("[data-gxl-play]");
    if (play) {
      GoExMedia.open(play.getAttribute("data-gxl-name"), play.getAttribute("data-gxl-play"));
      return;
    }
    var star = e.target.closest("[data-gxl-star]");
    if (star) {
      var id = star.getAttribute("data-gxl-star");
      var name = star.closest("[data-gxl-ex]").getAttribute("data-gxl-ex");
      var on = !myStars[id];
      var job = on
        ? host.rest("go_exercise_link_stars", { method: "POST", prefer: "return=minimal", body: { link_id: id, account_id: host.me() } })
        : host.rest("go_exercise_link_stars?link_id=eq." + encodeURIComponent(id) + "&account_id=eq." + encodeURIComponent(host.me()), { method: "DELETE" });
      star.disabled = true;
      job.then(function () {
        if (on) myStars[id] = true; else delete myStars[id];
        return GoExMedia.reload();
      }).then(function () { refreshOne(el, name); })
        .catch(function () { star.disabled = false; if (host.toast) host.toast("Stern konnte nicht gespeichert werden"); });
      return;
    }
    var chip = e.target.closest("[data-gxl-label]");
    if (chip) {
      var l = chip.getAttribute("data-gxl-label");
      label = label === l ? "" : l;
      paint(el);
      return;
    }
    var pick = e.target.closest("[data-gxl-pick]");
    if (pick) {
      e.preventDefault();
      var exName = pick.closest("[data-gxl-ex]").getAttribute("data-gxl-ex");
      var url = pendingUrl(el);
      if (!url) return;
      pick.disabled = true;
      host.rest("go_exercise_links", { method: "POST", prefer: "return=minimal",
        body: { name_key: GoExMedia.key(exName), name: exName, url: url, added_by: host.me() } })
        .then(function () { return GoExMedia.reload(); })
        .then(function () {
          el.querySelector("[data-gxl-new]").value = "";
          paint(el);
          refreshOne(el, exName);
          if (host.toast) host.toast("Gespeichert bei " + exName);
        })
        .catch(function (err) {
          pick.disabled = false;
          var m = String((err && err.message) || "");
          if (host.toast) host.toast(/duplicate|23505/.test(m) ? "Diesen Link gibt es bei der Übung schon" : /go_exercise_links|relation/.test(m) ? "Tabelle fehlt: go-exercise-links.sql ausführen" : "Speichern fehlgeschlagen");
        });
    }
  }

  global.GoExLinks = {
    init: function (h) { host = h; },
    mount: mount
  };
})(window);
