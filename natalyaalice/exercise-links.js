/* exercise-links.js — Plus → Videos: Link einfügen, Übung aus der Liste wählen, Sterne vergeben
 *
 * Übungen kommen aus go_exercise_catalog (eine Liste, Labels, go-uebungen-katalog.sql).
 * Nutzer schreiben keinen Übungsnamen selbst, sie wählen ihn aus.
 *
 *   GoExLinks.init({ rest, me, toast, planNames() → Promise<string[]> })
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

  /* Pinterest-Raster: zwei Spalten, Videos hochkant (9:16), Übungen ohne Video kürzer; wenig Text */
  var CSS =
    ".gxl{margin:6px 0 8px;text-align:left;color:#2A2118}" +
    ".gxl__newwrap{position:relative}" +
    ".gxl__save{position:absolute;right:6px;top:6px;min-height:32px;padding:0 14px;border-radius:999px;border:0;background:#2A2118;color:#F6F1E8;font:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
    ".gxl__save[hidden]{display:none}" +
    ".gxl__new{display:block;width:100%;box-sizing:border-box;min-height:44px;padding:0 90px 0 12px;border:1.5px solid #2A2118;border-radius:10px;background:#fff;font:inherit;font-size:15px;color:#2A2118;margin:0 0 4px}" +
    ".gxl__newhint{margin:0 0 8px;font-size:13px;font-weight:600;color:#2A2118;min-height:16px}" +
    ".gxl__chips{display:flex;flex-wrap:nowrap;gap:6px;margin:0 -2px 8px;overflow-x:auto;scrollbar-width:none;padding:0 2px}" +
    ".gxl__chips::-webkit-scrollbar{display:none}" +
    ".gxl__chip{flex:none;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(42,33,24,.3);background:transparent;color:#2A2118;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}" +
    ".gxl__chip.is-on{background:#2A2118;color:#F6F1E8;border-color:#2A2118}" +
    ".gxl__search{display:block;width:100%;box-sizing:border-box;min-height:40px;padding:0 12px;border:1px solid rgba(42,33,24,.25);border-radius:10px;background:#fff;font:inherit;font-size:15px;color:#2A2118;margin:0 0 10px}" +
    ".gxl__grid{column-count:2;column-gap:8px}" +
    ".gxl__pin{position:relative;display:block;width:100%;break-inside:avoid;margin:0 0 8px;border-radius:12px;overflow:hidden;background:#1c1814;cursor:pointer;aspect-ratio:9/16}" +
    ".gxl__pin.is-empty{aspect-ratio:1/1;background:rgba(42,33,24,.08)}" +
    ".gxl__pin img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
    ".gxl__pin::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.65));pointer-events:none}" +
    ".gxl__pin.is-empty::after{display:none}" +
    ".gxl__pinname{position:absolute;z-index:1;left:8px;right:8px;bottom:7px;color:#fff;font:600 12.5px/1.25 Inter,system-ui,sans-serif;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}" +
    ".gxl__pin.is-empty .gxl__pinname{color:#2A2118}" +
    ".gxl__pin.is-empty img{opacity:.55}" +
    ".gxl__pinplay{position:absolute;z-index:1;top:50%;left:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;display:grid;place-items:center;pointer-events:none}" +
    ".gxl__pinplay svg{width:20px;height:20px}" +
    ".gxl__pinn{position:absolute;z-index:1;top:7px;right:7px;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:rgba(0,0,0,.45);color:#fff;font:700 11px/20px Inter,sans-serif;text-align:center}" +
    ".gxl__pick{position:absolute;z-index:2;top:7px;left:7px;min-height:28px;padding:0 10px;border-radius:999px;border:0;background:#fff;color:#2A2118;font:inherit;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)}" +
    ".gxl__empty{margin:8px 0;font-size:14px;color:rgba(42,33,24,.65)}" +
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

  var PLAN = "Mein Wochenplan";
  var savedFirst = "";
  var planNames = null;
  var autoAlle = false;
  var mountedEl = null;
  /* Leere Liste nicht merken: beim Start sind die Events aus Aktuell oft noch nicht geladen */
  function loadPlan() {
    if (planNames && planNames.length) return Promise.resolve(planNames);
    if (!host.planNames) { planNames = []; return Promise.resolve(planNames); }
    return Promise.resolve(host.planNames()).catch(function () { return []; }).then(function (list) {
      var seen = {};
      planNames = (list || []).filter(function (n) { var k = GoExMedia.key(n); if (!n || seen[k]) return false; seen[k] = 1; return true; });
      /* ohne Wochenplan-Übungen: alle zeigen; kommen sie später, wieder auf Mein Wochenplan */
      if (!planNames.length && label === PLAN) { label = "Alle"; autoAlle = true; }
      else if (planNames.length && autoAlle) { label = PLAN; autoAlle = false; }
      return planNames;
    });
  }
  /* Aktuell hat die Events geladen (oder sie haben sich geändert): Wochenplan-Übungen neu holen */
  function refreshPlan() {
    if (!host || !mountedEl) return Promise.resolve();
    planNames = null;
    return loadPlan().then(function () { if (mountedEl && names) paint(mountedEl); }).catch(function () {});
  }

  /* Kachel: Vorschaubild (YouTube) oder Übungsfoto, Name unten; ohne Video kurz und hell */
  function pinHtml(name, picking) {
    var links = GoExMedia.linksFor(name);
    var thumb = "";
    for (var i = 0; i < links.length && !thumb; i++) {
      var info = GoExMedia.parse(links[i].url);
      if (info && info.thumb) thumb = info.thumb;
      else if (links[i].thumb) thumb = links[i].thumb;
    }
    if (!thumb) thumb = photoOf[GoExMedia.key(name)] || "";
    var empty = !links.length;
    /* Play-Symbol nur, wenn ein echtes Video dabei ist (Nutzerfotos sind Standbilder) */
    var hasVideo = links.some(function (l) { var x = GoExMedia.parse(l.url); return x && x.kind !== "img"; });
    return '<div class="gxl__pin' + (empty ? " is-empty" : "") + '" data-gxl-ex="' + esc(name) + '"' + (empty ? "" : ' data-gxl-open="1"') + ">" +
      (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy" />' : "") +
      (hasVideo ? '<span class="gxl__pinplay">' + GoExMedia.playIcon + "</span>" : "") +
      (links.length > 1 ? '<span class="gxl__pinn">' + links.length + "</span>" : "") +
      (picking ? '<button type="button" class="gxl__pick" data-gxl-pick>Hierhin</button>' : "") +
      '<span class="gxl__pinname">' + esc(name) + "</span></div>";
  }

  function pendingUrl(el) {
    var inp = el.querySelector("[data-gxl-new]");
    var url = inp ? inp.value.trim() : "";
    var info = url ? GoExMedia.parse(url) : null;
    return info && info.embed ? url : "";
  }

  function paint(el) {
    var box = el.querySelector("[data-gxl-list]");
    var picking = !!pendingUrl(el);
    var q = String(query || "").trim();
    var planKeys = {};
    (planNames || []).forEach(function (n) { planKeys[GoExMedia.key(n)] = 1; });
    var list = (names || []).filter(function (n) {
      if (q && n.toLowerCase().indexOf(q.toLowerCase()) === -1) return false;
      if (!q && label === PLAN && !planKeys[GoExMedia.key(n)]) return false;
      if (label && label !== "Alle" && label !== PLAN && (labelsOf[GoExMedia.key(n)] || []).indexOf(label) === -1) return false;
      return true;
    });
    /* Mein Wochenplan: alphabetisch; sonst Videos zuerst. Gerade gesicherte Übung steht ganz oben */
    list.sort(function (a, b) {
      if (savedFirst) {
        var fa = GoExMedia.key(a) === savedFirst ? 0 : 1, fb = GoExMedia.key(b) === savedFirst ? 0 : 1;
        if (fa !== fb) return fa - fb;
      }
      if (label === PLAN && !q) return a.localeCompare(b, "de");
      var va = GoExMedia.linksFor(a).length ? 0 : 1, vb = GoExMedia.linksFor(b).length ? 0 : 1;
      return va - vb || a.localeCompare(b, "de");
    });
    var exact = q && (names || []).some(function (n) { return n.toLowerCase() === q.toLowerCase(); });
    box.innerHTML = (list.length
      ? '<div class="gxl__grid">' + list.map(function (n) { return pinHtml(n, picking); }).join("") + "</div>"
      : '<p class="gxl__empty">' + (label === PLAN && !q && !(planNames && planNames.length) ? "Dein Wochenplan hat diese Woche keine Übungen." : "Keine Übung gefunden.") + "</p>") +
      (q.length >= 2 && !exact
        ? '<div class="gxl__submit"><p>„' + esc(q) + '“ fehlt? ' + (picking ? "Sende das Video mit diesem Namen ein." : "Link oben einfügen, dann einreichen.") + "</p>" +
          '<button type="button" data-gxl-submit' + (picking ? "" : " disabled") + ">Mit Video einreichen</button></div>"
        : "");
    el.querySelectorAll("[data-gxl-label]").forEach(function (c) {
      c.classList.toggle("is-on", c.getAttribute("data-gxl-label") === label);
    });
    /* Übung gewählt (Name in „Übungsname“) und gültiger Link: Pille „Sichern“ im Linkfeld */
    var chosen = chosenName(el);
    var saveBtn = el.querySelector("[data-gxl-save]");
    if (saveBtn) saveBtn.hidden = !(picking && chosen);
    var hint = el.querySelector("[data-gxl-newhint]");
    if (hint) {
      var raw = (el.querySelector("[data-gxl-new]") || {}).value || "";
      hint.textContent = picking && chosen ? "" : picking ? "Jetzt die passende Übung wählen: „Hierhin“ tippen." : raw.trim() ? "Bitte einen Instagram- oder YouTube-Link einfügen." : "";
    }
  }

  function refreshOne(el) { paint(el); }
  /* genau eine Übung im Feld „Übungsname“ */
  function chosenName(el) {
    var q = String(((el.querySelector("[data-gxl-q]") || {}).value) || "").trim().toLowerCase();
    if (!q) return "";
    return (names || []).filter(function (n) { return n.toLowerCase() === q; })[0] || "";
  }
  function saveLink(el, exName, btn) {
    var url = pendingUrl(el);
    if (!url || !exName) return;
    if (btn) btn.disabled = true;
    var newId = "";
    host.rest("go_exercise_links", { method: "POST", prefer: "return=representation",
      body: { name_key: GoExMedia.key(exName), name: exName, url: url, added_by: host.me() } })
      .then(function (rows) { newId = rows && rows[0] && rows[0].id ? String(rows[0].id) : ""; return GoExMedia.reload(); })
      .then(function () {
        el.querySelector("[data-gxl-new]").value = "";
        el.querySelector("[data-gxl-q]").value = "";
        query = "";
        savedFirst = GoExMedia.key(exName);
        if (btn) btn.disabled = false;
        paint(el);
        if (host.toast) host.toast("Gesichert");
        /* Instagram: Startbild als Vorschau holen und Kachel neu zeichnen */
        var info = GoExMedia.parse(url);
        if (newId && info && info.kind === "ig" && GoExMedia.makeThumb) {
          GoExMedia.makeThumb(newId).then(function (t) { if (t) paint(el); });
        }
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        var m = String((err && err.message) || "");
        if (host.toast) host.toast(/duplicate|23505/.test(m) ? "Diesen Link gibt es bei der Übung schon" : /go_exercise_links|relation/.test(m) ? "Tabelle fehlt: go-exercise-links.sql ausführen" : "Speichern fehlgeschlagen");
      });
  }

  function mount(el) {
    if (!el || !host || !global.GoExMedia) return;
    ensureCss();
    if (!el.dataset.gxlReady) {
      el.dataset.gxlReady = "1";
      el.className = "gxl";
      label = PLAN;
      el.innerHTML =
        '<div class="gxl__newwrap"><input type="url" inputmode="url" class="gxl__new" placeholder="Link aus Instagram oder YouTube" data-gxl-new />' +
        '<button type="button" class="gxl__save" data-gxl-save hidden>Sichern</button></div>' +
        '<p class="gxl__newhint" data-gxl-newhint></p>' +
        '<div class="gxl__chips">' + [PLAN, "Alle"].concat(LABELS).map(function (l) {
          return '<button type="button" class="gxl__chip" data-gxl-label="' + esc(l) + '">' + esc(l) + "</button>";
        }).join("") + "</div>" +
        '<input type="search" class="gxl__search" placeholder="Übungsname" data-gxl-q />' +
        '<div data-gxl-list></div>';
      el.querySelector("[data-gxl-q]").addEventListener("input", function () {
        query = this.value;
        paint(el);
      });
      el.querySelector("[data-gxl-new]").addEventListener("input", function () { paint(el); });
      el.addEventListener("click", function (e) { onClick(el, e); });
    }
    mountedEl = el;
    /* Videos sichtbar und Mein Wochenplan noch leer: neu holen (Events aus Aktuell sind dann meist da) */
    if (!el._gxlIo && global.IntersectionObserver) {
      el._gxlIo = new IntersectionObserver(function (ents) {
        if (!ents.some(function (x) { return x.isIntersecting; })) return;
        if (!(planNames && planNames.length) || autoAlle) refreshPlan();
      }, { threshold: 0 });
      el._gxlIo.observe(el);
    }
    Promise.all([GoExMedia.ready(), loadNames(), loadMyStars(), loadPlan()]).then(function () {
      paint(el);
      /* fehlende Instagram-Vorschaubilder nachholen */
      if (GoExMedia.fillThumbs) GoExMedia.fillThumbs().then(function (any) { if (any) paint(el); });
    })
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
    var sv = e.target.closest("[data-gxl-save]");
    if (sv) { saveLink(el, chosenName(el), sv); return; }
    var pin = e.target.closest("[data-gxl-open]");
    if (pin && !e.target.closest("[data-gxl-pick]")) {
      GoExMedia.open(pin.getAttribute("data-gxl-ex"));
      return;
    }
    /* Kachel ohne Video: nach oben, Name ins Feld „Übungsname“, dann Link einfügen und sichern */
    var emptyPin = e.target.closest(".gxl__pin.is-empty");
    if (emptyPin && !e.target.closest("[data-gxl-pick]")) {
      var nmSel = emptyPin.getAttribute("data-gxl-ex");
      var qIn = el.querySelector("[data-gxl-q]");
      qIn.value = nmSel;
      query = nmSel;
      paint(el);
      try { el.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (eS) { el.scrollIntoView(); }
      var sc = el.closest(".go-slide__body");
      if (sc) { try { sc.scrollTo({ top: 0, behavior: "smooth" }); } catch (eT) { sc.scrollTop = 0; } }
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
      }).then(function () { refreshOne(el); })
        .catch(function () { star.disabled = false; if (host.toast) host.toast("Stern konnte nicht gespeichert werden"); });
      return;
    }
    var chip = e.target.closest("[data-gxl-label]");
    if (chip) {
      var l = chip.getAttribute("data-gxl-label");
      label = l;
      autoAlle = false;
      if (l === PLAN && !(planNames && planNames.length)) { loadPlan().then(function () { label = PLAN; paint(el); }); return; }
      paint(el);
      return;
    }
    var pick = e.target.closest("[data-gxl-pick]");
    if (pick) {
      e.preventDefault();
      saveLink(el, pick.closest("[data-gxl-ex]").getAttribute("data-gxl-ex"), pick);
    }
  }

  global.GoExLinks = {
    init: function (h) { host = h; },
    mount: mount,
    refreshPlan: refreshPlan
  };
})(window);
