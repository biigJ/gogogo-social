/* exercise-media.js — Übungsvideos als Links (YouTube, Instagram, TikTok), eingebettet abspielen
 *
 *   GoExMedia.init({ rest })           → lädt die Bibliothek go_exercise_media (ein Link pro Übungsname)
 *   GoExMedia.ready()                  → Promise, wenn geladen
 *   GoExMedia.urlFor(name)             → Link oder ""
 *   GoExMedia.parse(url)               → { kind, embed, thumb, label } oder null
 *   GoExMedia.open(name, url)          → Bottom-Sheet mit eingebettetem Video (lädt erst nach dem Antippen)
 *   GoExMedia.key(name)                → Schlüssel für die Bibliothek
 *   GoExMedia.playIcon                 → SVG
 *
 * Wird von /workout/ und vom Kurs-Editor genutzt.
 */
(function (global) {
  "use strict";

  var host = null;
  var map = {};
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
    ".gxm-note{margin:8px 0 0;font-size:12px;color:rgba(42,33,24,.6)}" +
    ".gxm-row{display:flex;gap:8px;margin-top:12px}" +
    ".gxm-row a,.gxm-row button{flex:1;display:flex;align-items:center;justify-content:center;min-height:46px;border-radius:999px;font:inherit;font-weight:700;font-size:15px;text-decoration:none;cursor:pointer}" +
    ".gxm-row a{border:1.5px solid #111;color:#111;background:transparent}" +
    ".gxm-row button{border:0;background:#111;color:#fff}";

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
    m = u.match(/tiktok\.com\/@[^\/]+\/video\/(\d+)/i);
    if (m) return { kind: "short", label: "TikTok", embed: "https://www.tiktok.com/embed/v2/" + m[1], thumb: "", url: u };
    return { kind: "link", label: "Link", embed: "", thumb: "", url: u };
  }

  function load() {
    if (!host || !host.rest) return Promise.resolve();
    if (loading) return loading;
    loading = host.rest("go_exercise_media?select=name_key,name,url&limit=2000")
      .then(function (rows) {
        map = {};
        (rows || []).forEach(function (r) { if (r && r.name_key && r.url) map[r.name_key] = r.url; });
      })
      .catch(function () { map = {}; });
    return loading;
  }

  function urlFor(name) {
    return map[key(name)] || "";
  }

  function open(name, url) {
    var info = parse(url || urlFor(name));
    if (!info) return;
    if (!info.embed) {
      global.open(info.url, "_blank", "noopener");
      return;
    }
    ensureCss();
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

  function button(name) {
    ensureCss();
    var b = document.createElement("button");
    b.type = "button";
    b.className = "gxm-btn";
    b.setAttribute("aria-label", "Video " + name);
    b.innerHTML = PLAY_SVG;
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      open(name);
    });
    return b;
  }

  global.GoExMedia = {
    init: function (h) { host = h; return load(); },
    ready: function () { return loading || Promise.resolve(); },
    reload: function () { loading = null; return load(); },
    set: function (name, url) { if (url) map[key(name)] = url; else delete map[key(name)]; },
    urlFor: urlFor,
    parse: parse,
    open: open,
    button: button,
    key: key,
    playIcon: PLAY_SVG
  };
})(window);
