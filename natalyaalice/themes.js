/* themes.js — Darstellung: Original, GTA, Bauhaus, B/W
 *
 *   GoThemes.current()        → "original" | "gta" | "bauhaus" | "bw" | "postmodern"
 *   GoThemes.apply(id)        → Theme setzen + merken (localStorage, pro Gerät)
 *   GoThemes.list()           → [{ id, label }]
 *   GoThemes.openPicker()     → Auswahl über GoDialog.choose
 *
 * Die App hat viele feste Farben im CSS (Rot, Sand, Dunkelbraun). Statt jede Regel doppelt zu
 * pflegen, schreibt dieses Modul die Farben und Schriften in allen <style>-Tags um
 * (auch in später von Modulen eingefügten). Original = unveränderter Text.
 */
(function (global) {
  "use strict";

  var KEY = "gogogo_theme";

  /* Rollen der Original-Palette → Ersatz je Theme */
  var THEMES = {
    original: { label: "Original" },
    gta: {
      label: "GTA",
      fonts: "family=Oswald:wght@500;600;700&family=Rubik:wght@400;500;600",
      display: "Oswald",
      body: "Rubik",
      serif: "Oswald",
      hex: {
        C7413B: "E0187A", A5332E: "B0105E", F7F5F0: "FFF6FB",
        F6F1E8: "FFF0F5", F3EEE4: "FDE8F1", EDE6DA: "F9DDEB", E4DDD0: "F2CFE2",
        E8E2D6: "F6D7E8", D8D0C4: "E7BCD6", ECECEB: "F6E4EE",
        "2A2118": "2B0B3F", "1A1510": "1A0628", "6B6358": "7A4E8C"
      },
      rgb: {
        "199,65,59": "224,24,122", "165,51,46": "176,16,94", "247,245,240": "255,246,251",
        "246,241,232": "255,240,245", "243,238,228": "253,232,241",
        "42,33,24": "43,11,63", "52,34,32": "43,11,63", "20,16,12": "26,6,40"
      }
    },
    bauhaus: {
      label: "Bauhaus",
      fonts: "family=Jost:wght@400;500;600;700",
      display: "Jost",
      body: "Jost",
      serif: "Jost",
      /* Weiß, Dessau-Rot für graue Flächen, Rot-Akzente → Blau (Stempelkarte bleibt blau), CTAs Orange-Gelb */
      hex: {
        C7413B: "1E4FA3", A5332E: "163C7E", F7F5F0: "FFFFFF",
        F6F1E8: "FFFFFF", F3EEE4: "FFFFFF", EDE6DA: "C8102E", E4DDD0: "C8102E",
        E8E2D6: "C8102E", D8D0C4: "A50D26", ECECEB: "C8102E",
        "2A2118": "111111", "1A1510": "000000", "6B6358": "555555"
      },
      rgb: {
        "199,65,59": "30,79,163", "165,51,46": "22,60,126", "247,245,240": "255,255,255",
        "246,241,232": "255,255,255", "243,238,228": "255,255,255",
        "42,33,24": "17,17,17", "20,16,12": "0,0,0", "52,34,32": "17,17,17"
      },
      cta: { bg: "#F5A400", ink: "#111111" },
      extra: ".app-pill nav{color:#fff}"
    },
    bw: {
      label: "B/W",
      fonts: "family=Bodoni+Moda:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600",
      display: "Bodoni Moda",
      body: "IBM Plex Sans",
      serif: "Bodoni Moda",
      dark: true,
      /* Umgedreht: schwarzer Grund, weiße Schrift */
      hex: {
        C7413B: "FFFFFF", A5332E: "D9D9D9", F7F5F0: "FFFFFF",
        F6F1E8: "0A0A0A", F3EEE4: "000000", EDE6DA: "1A1A1A", E4DDD0: "262626",
        E8E2D6: "1F1F1F", D8D0C4: "333333", ECECEB: "1F1F1F",
        "2A2118": "F2F2F2", "1A1510": "FFFFFF", "6B6358": "A3A3A3"
      },
      rgb: {
        "199,65,59": "255,255,255", "165,51,46": "217,217,217", "247,245,240": "255,255,255",
        "246,241,232": "10,10,10", "243,238,228": "0,0,0",
        "42,33,24": "242,242,242", "52,34,32": "242,242,242", "20,16,12": "0,0,0"
      },
      cta: { bg: "#FFFFFF", ink: "#000000" }
    },
    postmodern: {
      label: "Postmodern",
      fonts: "family=Archivo+Black&family=Archivo:wght@500;600;700;800",
      display: "Archivo Black",
      body: "Archivo",
      serif: "Archivo Black",
      /* Memphis: knallige Neonfarben, fette Schrift, CTAs in Gold */
      hex: {
        C7413B: "FF2E93", A5332E: "D4007A", F7F5F0: "FFFFFF",
        F6F1E8: "FFF9EC", F3EEE4: "FFF4DA", EDE6DA: "7DF9FF", E4DDD0: "B4FF39",
        E8E2D6: "7DF9FF", D8D0C4: "B4FF39", ECECEB: "7DF9FF",
        "2A2118": "1B0B3A", "1A1510": "0D0420", "6B6358": "5B3F8C"
      },
      rgb: {
        "199,65,59": "255,46,147", "165,51,46": "212,0,122", "247,245,240": "255,255,255",
        "246,241,232": "255,249,236", "243,238,228": "255,244,218",
        "42,33,24": "27,11,58", "52,34,32": "27,11,58", "20,16,12": "13,4,32"
      },
      cta: { bg: "#E6B325", ink: "#1B0B3A" },
      extra: "body{font-weight:600}"
    }
  };
  var ORDER = ["original", "gta", "bauhaus", "bw", "postmodern"];

  var current = "original";
  var originals = new WeakMap(); // <style> → Originaltext
  var busy = false;

  function read() {
    try { var v = localStorage.getItem(KEY); return THEMES[v] ? v : "original"; } catch (e) { return "original"; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function transform(text, t) {
    if (!t || !t.hex) return text;
    var out = text.replace(/#([0-9a-fA-F]{6})\b/g, function (m, h) {
      var n = t.hex[h.toUpperCase()];
      return n ? "#" + n : m;
    });
    out = out.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, function (m, r, g, b) {
      var n = t.rgb[r + "," + g + "," + b];
      return n ? m.replace(/\d+\s*,\s*\d+\s*,\s*\d+/, n) : m;
    });
    out = out.replace(/(["']?)Space Grotesk\1/g, '"' + t.display + '"')
      .replace(/(["']?)Playfair Display\1/g, '"' + t.serif + '"')
      .replace(/(["'])Inter\1|\bInter(?=\s*,)/g, '"' + t.body + '"');
    return out;
  }

  function paintStyle(st) {
    if (!st || st.tagName !== "STYLE" || st.hasAttribute("data-theme-skip")) return;
    if (!originals.has(st)) originals.set(st, st.textContent);
    var src = originals.get(st);
    var next = current === "original" ? src : transform(src, THEMES[current]);
    if (st.textContent !== next) st.textContent = next;
  }

  function paintAll() {
    busy = true;
    var list = document.querySelectorAll("style");
    for (var i = 0; i < list.length; i++) paintStyle(list[i]);
    paintLinks();
    paintMeta();
    paintExtra();
    busy = false;
  }

  /* gleiche Herkunft: ffc.css als <style>-Kopie umschreiben, Original-Link abschalten */
  var linkCopies = {};
  function paintLinks() {
    var links = document.querySelectorAll('link[rel="stylesheet"][href^="/natalyaalice/"]');
    Array.prototype.forEach.call(links, function (ln) {
      var href = ln.getAttribute("href");
      if (current === "original") {
        ln.disabled = false;
        if (linkCopies[href]) linkCopies[href].disabled = true;
        return;
      }
      if (linkCopies[href] && linkCopies[href].__src) {
        var cp = linkCopies[href];
        cp.disabled = false;
        cp.textContent = transform(cp.__src, THEMES[current]);
        ln.disabled = true;
        return;
      }
      if (linkCopies[href] === "loading") return;
      linkCopies[href] = "loading";
      fetch(href).then(function (r) { return r.ok ? r.text() : Promise.reject(); }).then(function (txt) {
        var cp = document.createElement("style");
        cp.setAttribute("data-theme-skip", "");
        cp.__src = txt;
        ln.parentNode.insertBefore(cp, ln.nextSibling);
        linkCopies[href] = cp;
        paintLinks();
      }).catch(function () { linkCopies[href] = null; });
    });
  }

  var META_ORIG = {};
  function paintMeta() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) return;
    var c = m.getAttribute("content") || "";
    var base = META_ORIG[c] || c;
    var next = current === "original" ? base : transform(base, THEMES[current]);
    if (next !== c) {
      META_ORIG[next] = base;
      m.setAttribute("content", next);
    }
  }

  /* Zusatz-CSS je Theme: CTAs, dunkle Themes (Text auf Fotos bleibt weiß) */
  var CTA_SEL = [
    ".sand-card button:not(.sand-quiet):not([class*=close]):not(.wr-time-opt):not(.gz-pf):not(.gz-pre):not([data-gz-mode-btn])",
    ".go-slide__cta:not(.is-owned)",
    ".team-slide__cta.is-solid",
    ".wr-pill-btn--dark",
    ".acc-rsvp:not(.is-on)",
    ".go-primary",
    ".god__btn--primary"
  ].join(",");
  var extraEl = null;
  function paintExtra() {
    var t = THEMES[current] || {};
    var css = "";
    if (t.cta) css += CTA_SEL + "{background:" + t.cta.bg + " !important;color:" + t.cta.ink + " !important;border-color:" + t.cta.bg + " !important}";
    if (t.dark) {
      css +=
        "html,body{background:#000}" +
        ".acc-card__media,.acc-card__media *,.wr-slide__body,.wr-slide__body *,.go-slide__art,.go-slide__art *{--ink:#fff}" +
        ".acc-card .acc-media-text,.acc-card__overlay,.acc-card__overlay *{color:#fff !important}" +
        ".woche-reels .wr-bottom .wr-title,.woche-reels .wr-bottom .wr-when,.woche-reels .wr-bottom .wr-place,.woche-reels .wr-progress p{color:#fff !important}" +
        "img{filter:none}";
    }
    if (t.extra) css += t.extra;
    if (!extraEl) {
      extraEl = document.createElement("style");
      extraEl.id = "go-theme-extra";
      extraEl.setAttribute("data-theme-skip", "");
      document.head.appendChild(extraEl);
    }
    extraEl.textContent = css;
  }

  var fontLink = null;
  function loadFonts(t) {
    if (!t || !t.fonts) return;
    var href = "https://fonts.googleapis.com/css2?" + t.fonts + "&display=swap";
    if (!fontLink) {
      fontLink = document.createElement("link");
      fontLink.rel = "stylesheet";
      document.head.appendChild(fontLink);
    }
    if (fontLink.getAttribute("href") !== href) fontLink.setAttribute("href", href);
  }

  function apply(id) {
    if (!THEMES[id]) id = "original";
    current = id;
    write(id);
    loadFonts(THEMES[id]);
    if (document.documentElement) document.documentElement.setAttribute("data-go-theme", id);
    paintAll();
  }

  /* Module fügen später eigene <style> ein → auch umschreiben */
  function watch() {
    if (!global.MutationObserver) return;
    new MutationObserver(function (muts) {
      if (busy) return;
      busy = true;
      muts.forEach(function (mu) {
        if (mu.type === "attributes") { if (mu.target.tagName === "META") paintMeta(); return; }
        Array.prototype.forEach.call(mu.addedNodes, function (n) {
          if (n.tagName === "STYLE") paintStyle(n);
        });
        if (mu.type === "characterData" || (mu.target && mu.target.tagName === "STYLE")) {
          var st = mu.target.tagName === "STYLE" ? mu.target : mu.target.parentNode;
          if (st && st.tagName === "STYLE" && originals.has(st)) {
            /* Modul hat CSS ersetzt: neuer Originaltext */
            var expected = current === "original" ? originals.get(st) : transform(originals.get(st), THEMES[current]);
            if (st.textContent !== expected) { originals.set(st, st.textContent); paintStyle(st); }
          }
        }
      });
      busy = false;
    }).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["content"]
    });
  }

  function openPicker() {
    var opts = ORDER.map(function (id) {
      return { label: (id === current ? "✓ " : "") + THEMES[id].label, value: id };
    });
    if (!global.GoDialog || !global.GoDialog.choose) return Promise.resolve(null);
    return global.GoDialog.choose("Darstellung", opts).then(function (v) {
      if (v) apply(v);
      return v;
    });
  }

  current = read();
  if (current !== "original") {
    loadFonts(THEMES[current]);
    document.documentElement.setAttribute("data-go-theme", current);
    paintAll();
  }
  watch();

  global.GoThemes = {
    current: function () { return current; },
    /* feste Farbe aus JS (z. B. style.background) ins aktive Theme übersetzen */
    color: function (c) { return current === "original" ? c : transform(String(c || ""), THEMES[current]); },
    apply: apply,
    list: function () { return ORDER.map(function (id) { return { id: id, label: THEMES[id].label }; }); },
    openPicker: openPicker
  };
})(window);
