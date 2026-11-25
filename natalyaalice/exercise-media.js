/* exercise-media.js — Übungsvideos als Links (YouTube, Instagram, TikTok), eingebettet abspielen
 *
 *   GoExMedia.init({ rest })           → lädt die Bibliothek go_exercise_media (ein Link pro Übungsname)
 *   GoExMedia.ready()                  → Promise, wenn geladen
 *   GoExMedia.urlFor(name)             → Link oder ""
 *   GoExMedia.parse(url)               → { kind, embed, thumb, label } oder null
 *   GoExMedia.open(name, url)          → Bottom-Sheet mit eingebettetem Video (lädt erst nach dem Antippen)
 *   GoExMedia.key(name)                → Schlüssel für die Bibliothek
 *   GoExMedia.uploadImage(file, dir)   → Foto verkleinern, in den öffentlichen Bucket go-covers laden → URL
 *   Eigene Links/Fotos (go_exercise_links.added_by = ich) gehen beim Abspielen vor.
 *   GoExMedia.playIcon                 → SVG
 *
 * Wird von /workout/ und vom Kurs-Editor genutzt.
 */
(function (global) {
  "use strict";

  var host = null;
  var map = {};
  var userBest = {};
  var userLinks = [];
  var loading = null;

  var PLAY_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/></svg>';

  var CSS =
    ".gxm-btn{flex:0 0 auto;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;background:transparent;color:#2A2118;cursor:pointer;padding:0}" +
    ".gxm-btn svg{width:22px;height:22px}" +
    ".gxm-sheet{position:fixed;inset:0;z-index:10045;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,16,12,.55)}" +
    ".gxm-card{width:min(100%,480px);max-height:92vh;overflow:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px 22px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom));font-family:Inter,system-ui,sans-serif}" +
    ".gxm-card h2{margin:0 0 10px;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;line-height:1.2}" +
    ".gxm-frame{position:relative;width:100%;border-radius:14px;overflow:hidden;background:#111}" +
    ".gxm-frame--yt{aspect-ratio:16/9}.gxm-frame--short{aspect-ratio:9/16;max-height:70vh;margin:0 auto}" +
    ".gxm-frame--ig{aspect-ratio:4/5.6;background:#fff}" +
    ".gxm-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}" +
    ".gxm-img{display:block;width:100%;max-height:70vh;object-fit:contain;border-radius:14px;background:#111}" +
    ".gxm-note{margin:8px 0 0;font-size:12px;color:rgba(42,33,24,.6)}" +
    ".gxm-row{display:flex;gap:8px;margin-top:12px}" +
    ".gxm-row a,.gxm-row button{flex:1;display:flex;align-items:center;justify-content:center;min-height:46px;border-radius:999px;font:inherit;font-weight:700;font-size:15px;text-decoration:none;cursor:pointer}" +
    ".gxm-row a{border:1.5px solid #111;color:#111;background:transparent}" +
    ".gxm-row button{border:0;background:#111;color:#fff}" +
    ".gxm-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:0;scrollbar-width:none;touch-action:pan-x pan-y}" +
    ".gxm-track::-webkit-scrollbar{display:none}" +
    ".gxm-slide{flex:0 0 100%;scroll-snap-align:center;display:flex;align-items:center;justify-content:center}" +
    ".gxm-slide>*{width:100%}" +
    ".gxm-ext{display:flex;align-items:center;justify-content:center;min-height:200px;border-radius:14px;background:#111;color:#fff;font-weight:700;text-decoration:none}" +
    ".gxm-dots{display:flex;justify-content:center;gap:6px;margin-top:10px}" +
    ".gxm-dots i{width:7px;height:7px;border-radius:50%;background:rgba(42,33,24,.25)}" +
    ".gxm-dots i.is-on{background:#2A2118}" +
    ".gxm-btn.is-empty{opacity:.4}" +
    ".gxm-frame--empty{aspect-ratio:16/9;background:rgba(42,33,24,.08);border:1.5px dashed rgba(42,33,24,.3);display:flex;align-items:center;justify-content:center;color:rgba(42,33,24,.35)}" +
    ".gxm-frame--empty svg{width:44px;height:44px}" +
    ".gxm-add-hint{margin:12px 0 8px;font-size:14px;color:#2A2118}" +
    ".gxm-add{display:flex;gap:8px;align-items:center}" +
    ".gxm-add input{flex:1;min-width:0;min-height:46px;box-sizing:border-box;border:1.5px solid rgba(42,33,24,.25);border-radius:12px;padding:0 12px;font:inherit;font-size:16px;background:#fff;color:#2A2118}" +
    ".gxm-add button{flex:none;min-height:46px;padding:0 18px;border:0;border-radius:999px;background:#111;color:#fff;font:inherit;font-weight:700;font-size:15px;cursor:pointer}" +
    ".gxm-add button:disabled{opacity:.45}" +
    ".gxm-row button.gxm-back{background:transparent;color:#111;border:1.5px solid #111}";

  function ensureCss() {
    if (document.getElementById("gxm-css")) return;
    var s = document.createElement("style");
    s.id = "gxm-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function key(name) {
    return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function parse(url) {
    var u = String(url || "").trim();
    if (!/^https?:\/\//i.test(u)) return null;
    var m;
    m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    if (m) {
      var short = /\/shorts\//i.test(u);
      var t = u.match(/[?&](?:t|start)=(\d+)/);
      return {
        kind: short ? "short" : "yt",
        label: "YouTube",
        embed: "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&playsinline=1&rel=0" + (t ? "&start=" + t[1] : ""),
        thumb: "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg",
        url: u
      };
    }
    m = u.match(/instagram\.com\/(?:[^\/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    if (m) {
      var kind = m[1].toLowerCase() === "p" ? "p" : "reel";
      return { kind: "ig", label: "Instagram", embed: "https://www.instagram.com/" + kind + "/" + m[2] + "/embed", thumb: "", url: u };
    }
    if (/\/storage\/v1\/object\/public\//i.test(u) || /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(u)) {
      return { kind: "img", label: "Foto", embed: "", thumb: u, url: u };
    }
    m = u.match(/tiktok\.com\/@[^\/]+\/video\/(\d+)/i);
    if (m) return { kind: "short", label: "TikTok", embed: "https://www.tiktok.com/embed/v2/" + m[1], thumb: "", url: u };
    return { kind: "link", label: "Link", embed: "", thumb: "", url: u };
  }

  function load() {
    if (!host || !host.rest) return Promise.resolve();
    if (loading) return loading;
    loading = Promise.all([
      host.rest("go_exercise_media?select=name_key,name,url&limit=2000").catch(function () { return []; }),
      /* Nutzer-Links mit Sternen (go-exercise-links.sql); fehlt die View, bleibt es bei gogogo-Links */
      /* approved_at erst nach go-exercise-media-review.sql; ohne Spalte gilt alles als freigegeben */
      /* thumb_url: Startbild von Instagram (go-exercise-link-thumb.sql, Edge Function go-ig-thumb) */
      host.rest("go_exercise_links_ranked?select=id,name_key,name,url,added_by,added_by_name,stars,created_at,approved_at,thumb_url&limit=5000")
        .catch(function () { return host.rest("go_exercise_links_ranked?select=id,name_key,name,url,added_by,added_by_name,stars,created_at,approved_at&limit=5000"); })
        .catch(function () {
          return host.rest("go_exercise_links_ranked?select=id,name_key,name,url,added_by,added_by_name,stars,created_at&limit=5000")
            .then(function (rows) { return (rows || []).map(function (r) { r.approved_at = r.created_at || "x"; return r; }); });
        })
        .catch(function () { return []; })
    ]).then(function (res) {
      map = {};
      (res[0] || []).forEach(function (r) { if (r && r.name_key && r.url) map[r.name_key] = r.url; });
      userLinks = res[1] || [];
      rankUser();
    });
    return loading;
  }

  /* nur freigegebene Nutzer-Einträge zählen für alle; Fotos getrennt von Videos */
  var userBestImg = {};
  function rankUser() {
    userBest = {};
    userBestImg = {};
    userLinks.slice().filter(function (l) { return l.approved_at; }).sort(function (a, b) {
      return (b.stars || 0) - (a.stars || 0) || String(a.created_at).localeCompare(String(b.created_at));
    }).forEach(function (l) {
      var info = parse(l.url);
      if (info && info.kind === "img") { if (!userBestImg[l.name_key]) userBestImg[l.name_key] = l.url; }
      else if (!userBest[l.name_key]) userBest[l.name_key] = l.url;
    });
  }

  function meId() {
    try { return host && host.me ? String(host.me() || "") : ""; } catch (e) { return ""; }
  }
  function mineFor(k) {
    var me = meId();
    if (!me) return null;
    return userLinks.filter(function (l) { return l.name_key === k && String(l.added_by) === me; })
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })[0] || null;
  }

  /* eigener Link/Foto zuerst, dann gogogo-Link, sonst der Nutzer-Link mit den meisten Sternen */
  function urlFor(name) {
    var k = key(name);
    var mine = mineFor(k);
    return (mine && mine.url) || map[k] || userBest[k] || userBestImg[k] || "";
  }
  /* Foto und Video einer Übung: eigene vor gogogo vor freigegebenen Nutzer-Einträgen */
  function itemsFor(name) {
    var k = key(name);
    var me = meId();
    var own = function (kind) {
      return userLinks.filter(function (l) {
        if (l.name_key !== k || String(l.added_by) !== me) return false;
        var i = parse(l.url);
        return kind === "img" ? i && i.kind === "img" : i && i.kind !== "img";
      }).sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })[0];
    };
    var oi = own("img"), ov = own("video");
    var img = (oi && oi.url) || userBestImg[k] || "";
    var vid = (ov && ov.url) || (map[k] && parse(map[k]) && parse(map[k]).kind !== "img" ? map[k] : "") || userBest[k] || "";
    if (!img && map[k] && parse(map[k]) && parse(map[k]).kind === "img") img = map[k];
    var out = [];
    if (vid) out.push(vid);
    if (img) out.push(img);
    return out;
  }

  function shrink(file, maxSide) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var src = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, maxSide / Math.max(img.width, img.height));
        var cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k);
        cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(src);
        cv.toBlob(function (b) { if (b) resolve(b); else reject(new Error("Bild nicht lesbar")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(src); reject(new Error("Bild nicht lesbar")); };
      img.src = src;
    });
  }

  /* Foto in den öffentlichen Bucket go-covers (go-covers-bucket.sql) */
  function uploadImage(file, dir) {
    var st = host && host.storage;
    if (!st || !file) return Promise.reject(new Error("Upload nicht verfügbar"));
    var path = (dir || "media") + "/" + (meId() || "x") + "-" + Date.now() + ".jpg";
    return shrink(file, 1400).then(function (blob) {
      return fetch(st.url + "/storage/v1/object/go-covers/" + path, {
        method: "POST",
        headers: { apikey: st.key, Authorization: "Bearer " + st.key, "Content-Type": "image/jpeg", "x-upsert": "true" },
        body: blob
      });
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(/Bucket not found/i.test(t) ? "Speicher fehlt: go-covers-bucket.sql ausführen" : "Upload fehlgeschlagen"); });
      return st.url + "/storage/v1/object/public/go-covers/" + path;
    });
  }

  /* Alle Links einer Übung: gogogo zuerst, dann Nutzer nach Sternen */
  function linksFor(name) {
    var k = key(name);
    var out = [];
    if (map[k]) out.push({ id: "", url: map[k], admin: true, stars: null, by: "gogogo" });
    userLinks.filter(function (l) { return l.name_key === k && l.url !== map[k]; })
      .sort(function (a, b) { return (b.stars || 0) - (a.stars || 0) || String(a.created_at).localeCompare(String(b.created_at)); })
      .forEach(function (l) { out.push({ id: l.id, url: l.url, admin: false, stars: l.stars || 0, by: l.added_by_name || "", added_by: l.added_by, thumb: l.thumb_url || "" }); });
    return out;
  }

  /* Instagram hat kein festes Vorschaubild: die Edge Function holt das Startbild des Beitrags
     und legt es dauerhaft in go-covers ab. Danach steht es am Link (thumb_url). */
  var thumbAsked = {};
  function makeThumb(id) {
    var st = host && host.storage;
    if (!st || !id || thumbAsked[id] || !meId()) return Promise.resolve(null);
    thumbAsked[id] = true;
    return fetch(st.url + "/functions/v1/go-ig-thumb", {
      method: "POST",
      /* nur eingeloggt: die Function prüft das Konto */
      headers: { apikey: st.key, Authorization: "Bearer " + st.key, "Content-Type": "application/json", "x-go-account-id": meId() },
      body: JSON.stringify({ id: id })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var url = j && j.thumb_url;
        if (url) userLinks.forEach(function (l) { if (String(l.id) === String(id)) l.thumb_url = url; });
        return url || null;
      })
      .catch(function () { return null; });
  }
  /* Instagram-Links ohne Bild (ältere oder fehlgeschlagene): ein paar je Laden nachholen */
  function fillThumbs() {
    var todo = userLinks.filter(function (l) {
      var info = parse(l.url);
      return l && l.id && !l.thumb_url && info && info.kind === "ig" && !thumbAsked[l.id];
    }).slice(0, 4);
    return Promise.all(todo.map(function (l) { return makeThumb(l.id); }))
      .then(function (r) { return r.some(Boolean); });
  }

  /* Mehrere Einträge (Video + Foto): links/rechts wischen */
  function openCarousel(name, urls) {
    ensureCss();
    var wrap = document.createElement("div");
    wrap.className = "gxm-sheet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    var slides = urls.map(function (u) {
      var info = parse(u);
      if (!info) return "";
      if (info.kind === "img") return '<div class="gxm-slide"><img class="gxm-img" src="' + esc(info.url) + '" alt="" /></div>';
      if (!info.embed) return '<div class="gxm-slide"><a class="gxm-ext" href="' + esc(info.url) + '" target="_blank" rel="noopener">In ' + esc(info.label) + " öffnen</a></div>";
      var frameCls = info.kind === "ig" ? "gxm-frame--ig" : info.kind === "short" ? "gxm-frame--short" : "gxm-frame--yt";
      return '<div class="gxm-slide"><div class="gxm-frame ' + frameCls + '"><iframe src="' + esc(info.embed) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="' + esc(name || "Video") + '"></iframe></div></div>';
    }).filter(Boolean);
    wrap.innerHTML = '<div class="gxm-card"><h2>' + esc(name || "Übung") + "</h2>" +
      '<div class="gxm-track">' + slides.join("") + "</div>" +
      '<div class="gxm-dots">' + slides.map(function (_, i) { return '<i class="' + (i ? "" : "is-on") + '"></i>'; }).join("") + "</div>" +
      '<div class="gxm-row"><button type="button" data-gxm-close>Schließen</button></div></div>';
    var track = wrap.querySelector(".gxm-track");
    track.addEventListener("scroll", function () {
      var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      Array.prototype.forEach.call(wrap.querySelectorAll(".gxm-dots i"), function (d, k) { d.classList.toggle("is-on", k === i); });
    }, { passive: true });
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest("[data-gxm-close]"))) wrap.remove();
    });
    document.body.appendChild(wrap);
  }

  function open(name, url) {
    if (!url) {
      var many = itemsFor(name);
      if (many.length > 1) { openCarousel(name, many); return; }
    }
    var info = parse(url || urlFor(name));
    if (!info) return;
    if (!info.embed && info.kind !== "img") {
      global.open(info.url, "_blank", "noopener");
      return;
    }
    ensureCss();
    if (info.kind === "img") {
      var wi = document.createElement("div");
      wi.className = "gxm-sheet";
      wi.setAttribute("role", "dialog");
      wi.innerHTML = '<div class="gxm-card"><h2>' + esc(name || "Übung") + "</h2>" +
        '<img class="gxm-img" src="' + esc(info.url) + '" alt="" />' +
        '<div class="gxm-row"><button type="button" data-gxm-close>Schließen</button></div></div>';
      wi.addEventListener("click", function (e) {
        if (e.target === wi || (e.target.closest && e.target.closest("[data-gxm-close]"))) wi.remove();
      });
      document.body.appendChild(wi);
      return;
    }
    var wrap = document.createElement("div");
    wrap.className = "gxm-sheet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    var frameCls = info.kind === "ig" ? "gxm-frame--ig" : info.kind === "short" ? "gxm-frame--short" : "gxm-frame--yt";
    wrap.innerHTML =
      '<div class="gxm-card"><h2>' + esc(name || "Übung") + "</h2>" +
      '<div class="gxm-frame ' + frameCls + '"><iframe src="' + esc(info.embed) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="' + esc(name || "Video") + '"></iframe></div>' +
      '<p class="gxm-note">Video von ' + esc(info.label) + ". Beim Abspielen gelten dessen Datenschutzregeln.</p>" +
      '<div class="gxm-row"><a href="' + esc(info.url) + '" target="_blank" rel="noopener">In ' + esc(info.label) + ' öffnen</a>' +
      '<button type="button" data-gxm-close>Schließen</button></div></div>';
    function close() {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest("[data-gxm-close]"))) close();
    });
    document.body.appendChild(wrap);
  }

  /* Kein Video zur Übung: gleicher Dialog mit leerem Rahmen, darunter Link einfügen und speichern */
  function openAdd(name, onSaved) {
    ensureCss();
    var wrap = document.createElement("div");
    wrap.className = "gxm-sheet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = '<div class="gxm-card"><h2>' + esc(name || "Übung") + "</h2>" +
      '<div class="gxm-frame gxm-frame--empty">' + PLAY_SVG + "</div>" +
      '<p class="gxm-add-hint">Füge ein Link aus YouTube oder Instagram ein.</p>' +
      '<div class="gxm-add"><input type="url" inputmode="url" autocomplete="off" placeholder="https://" data-gxm-url />' +
      '<button type="button" data-gxm-save>Speichern</button></div>' +
      '<div class="gxm-row"><button type="button" class="gxm-back" data-gxm-close>Zurück</button></div></div>';
    var input = wrap.querySelector("[data-gxm-url]");
    var save = wrap.querySelector("[data-gxm-save]");
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    function toast(t) { try { if (host && host.toast) host.toast(t); else if (global.goToast) global.goToast(t); } catch (e) {} }
    save.addEventListener("click", function () {
      var url = String(input.value || "").trim();
      var info = parse(url);
      if (!info || info.kind === "img" || info.kind === "link") { toast("Bitte ein Link von YouTube oder Instagram"); input.focus(); return; }
      if (!host || !host.rest || !meId()) { toast("Zum Speichern bitte anmelden"); return; }
      save.disabled = true;
      var newId = "";
      host.rest("go_exercise_links", { method: "POST", prefer: "return=representation",
        body: { name_key: key(name), name: name, url: url, added_by: meId() } })
        .then(function (rows) { newId = rows && rows[0] && rows[0].id ? String(rows[0].id) : ""; loading = null; return load(); })
        .then(function () {
          close();
          toast("Gesichert");
          if (newId && info.kind === "ig") makeThumb(newId);
          if (onSaved) { try { onSaved(url); } catch (e) {} }
          open(name, url);
        })
        .catch(function (err) {
          save.disabled = false;
          var m = String((err && err.message) || "");
          toast(/duplicate|23505/.test(m) ? "Diesen Link gibt es bei der Übung schon" : "Speichern fehlgeschlagen");
        });
    });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); save.click(); } });
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest("[data-gxm-close]"))) close();
    });
    document.body.appendChild(wrap);
  }

  /* Video-Icon: mit Video abspielen, ohne Video den Dialog zum Einfügen öffnen */
  function button(name) {
    ensureCss();
    var b = document.createElement("button");
    b.type = "button";
    b.className = "gxm-btn";
    var has = !!urlFor(name);
    if (!has) b.classList.add("is-empty");
    b.setAttribute("aria-label", (has ? "Video " : "Video hinzufügen ") + name);
    b.innerHTML = PLAY_SVG;
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (urlFor(name)) { open(name); return; }
      openAdd(name, function () { b.classList.remove("is-empty"); b.setAttribute("aria-label", "Video " + name); });
    });
    return b;
  }

  global.GoExMedia = {
    init: function (h) { host = h; return load(); },
    ready: function () { return loading || Promise.resolve(); },
    reload: function () { loading = null; return load(); },
    set: function (name, url) { if (url) map[key(name)] = url; else delete map[key(name)]; },
    urlFor: urlFor,
    openAdd: openAdd,
    makeThumb: makeThumb,
    fillThumbs: fillThumbs,
    itemsFor: itemsFor,
    mine: function (name) { return mineFor(key(name)); },
    /* eigenes Foto (kind "img") oder eigener Video-Link (kind "video") zu einer Übung, neuester zuerst */
    mineOf: function (name, kind) {
      var me = meId(), k = key(name);
      if (!me) return null;
      return userLinks.filter(function (l) {
        if (l.name_key !== k || String(l.added_by) !== me) return false;
        var info = parse(l.url);
        var isImg = !!(info && info.kind === "img");
        return kind === "img" ? isImg : !isImg;
      }).sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })[0] || null;
    },
    uploadImage: uploadImage,
    linksFor: linksFor,
    parse: parse,
    open: open,
    button: button,
    key: key,
    playIcon: PLAY_SVG
  };
})(window);
