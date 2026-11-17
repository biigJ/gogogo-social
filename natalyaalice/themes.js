/* themes.js — Darstellung: Original, GTA, Bauhaus, B/W
 *
 *   GoThemes.current()        → "original" | "gta" | "bauhaus" | "bw"
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
        "42,33,24": "43,11,63", "20,16,12": "26,6,40"
      }
    },
    bauhaus: {
      label: "Bauhaus",
      fonts: "family=Jost:wght@400;500;600;700",
      display: "Jost",
      body: "Jost",
      serif: "Jost",
      hex: {
        C7413B: "1E4FA3", A5332E: "163C7E", F7F5F0: "FFFFFF",
        F6F1E8: "F4EFE1", F3EEE4: "EFE8D6", EDE6DA: "E6DEC8", E4DDD0: "DCD2B8",
        E8E2D6: "E3DAC3", D8D0C4: "CFC4A6", ECECEB: "E6E6E3",
        "2A2118": "141414", "1A1510": "000000", "6B6358": "5A5A5A"
      },
      rgb: {
        "199,65,59": "30,79,163", "165,51,46": "22,60,126", "247,245,240": "255,255,255",
        "246,241,232": "244,239,225", "243,238,228": "239,232,214",
        "42,33,24": "20,20,20", "20,16,12": "10,10,10"
      }
    },
    bw: {
      label: "B/W",
      fonts: "family=Bodoni+Moda:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600",
      display: "Bodoni Moda",
      body: "IBM Plex Sans",
      serif: "Bodoni Moda",
      hex: {
        C7413B: "111111", A5332E: "000000", F7F5F0: "FFFFFF",
        F6F1E8: "FFFFFF", F3EEE4: "F5F5F5", EDE6DA: "EBEBEB", E4DDD0: "E0E0E0",
        E8E2D6: "E6E6E6", D8D0C4: "D0D0D0", ECECEB: "E8E8E8",
        "2A2118": "111111", "1A1510": "000000", "6B6358": "666666"
      },
      rgb: {
        "199,65,59": "17,17,17", "165,51,46": "0,0,0", "247,245,240": "255,255,255",
        "246,241,232": "255,255,255", "243,238,228": "245,245,245",
        "42,33,24": "17,17,17", "20,16,12": "0,0,0"
      }
    }
  };
  var ORDER = ["original", "gta", "bauhaus", "bw"];

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
