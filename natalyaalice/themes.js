/* themes.js — Darstellung: Original, GTA, Bauhaus, B/W, Postmodern, Terrakotta, Postpunk
 *
 *   GoThemes.current()        → "original" | "gta" | "bauhaus" | "bw" | "postmodern" | "terra" | "postpunk"
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
        "2E9E5B": "FFC400", C7413B: "E0187A", A5332E: "B0105E", F7F5F0: "FFF6FB",
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
      /* Palette: Outer Reef #236192 (Akzent, Stempelkarte), Rusted Ember #E1523E (Signal statt Grün),
         Golden Coin #FBD872 (Buttons), Montezuma Hills #A7B2A3 (graue Flächen), Zeus #373A36 (Schrift).
         Kontraste: Zeus auf Weiß 11:1, Weiß auf Outer Reef 6,4:1, Zeus auf Golden Coin 8,7:1 */
      hex: {
        "2E9E5B": "E1523E", C7413B: "236192", A5332E: "1B4A70", F7F5F0: "FFFFFF",
        F6F1E8: "FFFFFF", F3EEE4: "F4F6F3", EDE6DA: "D3D9D1", E4DDD0: "A7B2A3",
        E8E2D6: "D3D9D1", D8D0C4: "A7B2A3", ECECEB: "D3D9D1",
        "2A2118": "373A36", "1A1510": "23251F", "6B6358": "5E665C"
      },
      rgb: {
        "199,65,59": "35,97,146", "165,51,46": "27,74,112", "247,245,240": "255,255,255",
        "246,241,232": "255,255,255", "243,238,228": "244,246,243",
        "42,33,24": "55,58,54", "20,16,12": "35,37,31", "52,34,32": "55,58,54"
      },
      cta: { bg: "#FBD872", ink: "#373A36" },
      /* Leiste unten: Outer Reef mit weißer Schrift */
      extra: ".app-pill nav{background:#236192 !important;color:#fff}.app-pill .pill-dot{background:#E1523E !important}"
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
        "2E9E5B": "FFFFFF",
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
      cta: { bg: "#FFFFFF", ink: "#000000" },
      /* Harte Kontraste: Weiß auf Schwarz, Schwarz auf Weiß (feste #fff/#111-Flächen der Module) */
      extra:
        "input:not([type=checkbox]):not([type=radio]):not([type=range]),select:not(#heute-filter-select),textarea,.gpl__select,.god__input{background-color:#000 !important;color:#fff !important;border-color:rgba(255,255,255,.7) !important}" +
        "#heute-filter-select{color:#fff !important}" +
        /* Wochenauswahl liegt auf dem Foto: kein schwarzer Kasten */
        /* Fortschrittsleiste Kalender: weiß */
        ".woche-reels .wr-seg:not(#_){background:rgba(255,255,255,.3) !important}.woche-reels .wr-seg.is-on:not(#_),.woche-reels .wr-seg.is-done:not(#_){background:#fff !important}" +
        "select[data-wr-week-select]:not(#_){background-color:transparent !important;border-color:transparent !important;color:#fff !important}" +
        "input::placeholder,textarea::placeholder{color:rgba(255,255,255,.55) !important}" +
        ".cp-seg button{color:#fff !important;border-color:#fff !important;background:transparent !important}" +
        ".cp-seg button.is-on{background:#fff !important;color:#000 !important}" +
        ".cp-btn--ghost,.cp-pill,.gpl__btn--quiet,.gtm__btn--quiet{color:#fff !important;border-color:#fff !important;background:transparent !important}" +
        ".cp-btn:not(.cp-btn--ghost){background:#fff !important;color:#000 !important}" +
        ".friend-list__feed{border-color:#fff !important}.friend-list__feed.is-on{background:#fff !important;color:#000 !important;border-color:#fff !important}" +
        ".wr-mini-wheel,.cp-wheel,.gtm__wheel{background:#000 !important;border-color:#fff !important}" +
        ".wr-mini-opt,.cp-wheel__opt,.gtm__opt{color:#fff !important}" +
        "#plan-settings>button,#plan-settings>a,.plan-backbar h2{color:#fff !important}" +
        ".profile-back,.profile-pencil{color:#fff !important;border-color:#fff !important}" +
        ".gpl__row,.gpl__vday,.gpl__day,.gpp__row,.gpp__fav{background:#000 !important;color:#fff !important;border-color:rgba(255,255,255,.5) !important}" +
        ".gpp__row.is-on,.gpp__fav.is-on{background:#fff !important;color:#000 !important}" +
        ".ga-item,.ga-copy p,.ga-msg,.cp-hint,.cp-body,.cp-field{color:#fff !important}" +
        ".god__card,.sand-card{background:#0A0A0A !important;color:#fff !important;border:1px solid rgba(255,255,255,.25)}" +
        ".god__btn:not(.god__btn--quiet):not(.god__btn--choice){background:#fff !important;color:#000 !important}" +
        ".god__btn--quiet,.god__btn--choice{color:#fff !important;border-color:#fff !important}" +
        ".profile-goal,.gcr-pill:not(.is-solid),.acc-heart-me{background-color:#000 !important;color:#fff !important;border:1px solid #fff !important}" +
        ".gcr-pill.is-solid{background:#fff !important;color:#000 !important}" +
        /* Bubble (Dunkelblau #1D1630 kennt die Farbtabelle nicht): Kreiszeile, Liste, Nachrichten, Eingabe */
        ".gbub-strip__item,.gbub-row{color:#fff !important}" +
        ".gbub-strip__ring.is-empty{box-shadow:inset 0 0 0 2px #fff !important}" +
        ".gbub-strip__ring.has{box-shadow:0 0 0 3px #fff !important}" +
        ".gbub-card__me:not(.is-leave){box-shadow:0 0 0 1px rgba(255,255,255,.45)}" +
        ".acc-msg:not(.is-mine){background:#000 !important;color:#fff !important;border:1px solid rgba(255,255,255,.35)}" +
        ".acc-msg:not(.is-mine) .acc-msg__who,.acc-msg:not(.is-mine) .acc-msg__txt{color:#fff !important}" +
        "#gbub-compose{background:#000 !important;box-shadow:0 0 0 1px rgba(255,255,255,.5) !important}" +
        "#gbub-compose .gbub-compose__inp:not(#_){background:transparent !important;border:0 !important;color:#fff !important}" +
        "#gbub-compose button[type=submit]{background:#fff !important;color:#000 !important}" +
        "#gbub-compose .gbub-compose__att{color:#fff !important}" +
        "#gbub-compose .gbub-compose__reply{background:#1A1A1A !important;color:#fff !important;border-left-color:#fff !important}"
    },
    /* Terrakotta: Olivgrau, Rost, Terrakotta, Blush, Taubenblau, Schiefer. Kontraste geprüft:
       Text #34362B auf Hell ≥ 10:1, Nebentext #5D646D ≥ 5:1, Weiß auf Rost 5,4:1 (Terrakotta nie als Texthintergrund) */
    terra: {
      label: "Terrakotta",
      display: "Space Grotesk",
      body: "Inter",
      serif: "Playfair Display",
      hex: {
        "2E9E5B": "C46852",
        C7413B: "B04A2F", A5332E: "8E3A24", F7F5F0: "F7F2EF",
        F6F1E8: "F5EDE8", F3EEE4: "F3ECE7", EDE6DA: "DEC4B8", E4DDD0: "B6B8C1",
        E8E2D6: "E6DAD3", D8D0C4: "B6B8C1", ECECEB: "E4E5E9",
        "2A2118": "34362B", "1A1510": "23241C", "6B6358": "5D646D"
      },
      rgb: {
        "199,65,59": "176,74,47", "165,51,46": "142,58,36", "247,245,240": "247,242,239",
        "246,241,232": "245,237,232", "243,238,228": "243,236,231",
        "42,33,24": "52,54,43", "52,34,32": "52,54,43", "20,16,12": "35,36,28"
      },
      cta: { bg: "#B04A2F", ink: "#FFFFFF" }
    },
    postmodern: {
      label: "Postmodern",
      /* Schrift wie Raptor Text (kommerziell, nicht als Webfont frei): Inter Tight, Headlines Black eng gesetzt */
      fonts: "family=Inter+Tight:wght@400;500;600;700;900",
      display: "Inter Tight",
      body: "Inter Tight",
      serif: "Inter Tight",
      /* Pop Clash: Pink #FF1493 (Akzent), Koralle #FF6F61 (Leiste), Gelb #FFD700 (Buttons),
         Türkis #40E0D0 / #00CED1 (Signal, Flächen), Schrift #2A2A2A.
         Kontraste: #2A2A2A auf Weiß 14:1, Weiß auf #D10F79 5,2:1, #2A2A2A auf Gelb 11:1, #2A2A2A auf Koralle 5,8:1 */
      hex: {
        "2E9E5B": "00CED1", C7413B: "FF1493", A5332E: "D10F79", F7F5F0: "FFFFFF",
        F6F1E8: "FFF8F6", F3EEE4: "FFF1EE", EDE6DA: "D5F7F3", E4DDD0: "9EEDE5",
        E8E2D6: "D5F7F3", D8D0C4: "40E0D0", ECECEB: "D5F7F3",
        "2A2118": "2A2A2A", "1A1510": "1A1A1A", "6B6358": "5C5C5C"
      },
      rgb: {
        "199,65,59": "255,20,147", "165,51,46": "209,15,121", "247,245,240": "255,255,255",
        "246,241,232": "255,248,246", "243,238,228": "255,241,238",
        "42,33,24": "42,42,42", "52,34,32": "42,42,42", "20,16,12": "26,26,26"
      },
      cta: { bg: "#FFD700", ink: "#2A2A2A" },
      extra: ".app-pill nav{background:#FF6F61 !important;color:#2A2A2A}.app-pill .pill-dot{background:#2A2A2A !important}" +
        "html[data-go-theme=postmodern] body .rail-nav__title:not(#_):not(#__),html[data-go-theme=postmodern] body .profile-name:not(#_):not(#__)," +
        "html[data-go-theme=postmodern] body .kreis-page__bar h2:not(#_):not(#__),html[data-go-theme=postmodern] body #heute-filter-select:not(#_)" +
        "{font-family:'Inter Tight',system-ui,sans-serif !important;font-weight:900 !important;letter-spacing:-.04em}"
    }
  };
  /* Postpunk: dunkel wie B/W, Pink #FF4F9A / #FF78B4, Grün #00D68F / #00B894, Grund #121214.
     Titel in Monoton (Streifenschrift im Stil der 70er-Glam-Plakate), Text in Syne.
     Kontraste: Weiß auf #121214 18:1, Pink #FF4F9A auf #121214 6,3:1, #121214 auf Grün #00D68F 10:1 */
  THEMES.postpunk = {
    label: "Postpunk",
    fonts: "family=Monoton&family=Syne:wght@400;500;600;700;800",
    display: "Syne",
    body: "Syne",
    serif: "Syne",
    dark: true,
    hex: {
      "2E9E5B": "00D68F",
      C7413B: "FF4F9A", A5332E: "FF78B4", F7F5F0: "FFFFFF",
      F6F1E8: "121214", F3EEE4: "0D0D0F", EDE6DA: "1C1C20", E4DDD0: "26262B",
      E8E2D6: "1F1F23", D8D0C4: "33333A", ECECEB: "1F1F23",
      "2A2118": "F4F4F5", "1A1510": "FFFFFF", "6B6358": "A1A1AA"
    },
    rgb: {
      "199,65,59": "255,79,154", "165,51,46": "255,120,180", "247,245,240": "255,255,255",
      "246,241,232": "18,18,20", "243,238,228": "13,13,15",
      "42,33,24": "244,244,245", "52,34,32": "244,244,245", "20,16,12": "0,0,0"
    },
    cta: { bg: "#00D68F", ink: "#121214" },
    /* Dunkle Flächen und Kontraste wie B/W, gefüllte Knöpfe in Pink statt Weiß */
    extra: THEMES.bw.extra
      .replace(/background:#fff !important;color:#000 !important/g, "background:#FF4F9A !important;color:#121214 !important")
      .replace(/background-color:#000/g, "background-color:#121214")
      .replace(/background:#000/g, "background:#121214")
      .replace(/#0A0A0A/g, "#1C1C20") +
      "html,body{background:#121214 !important}" +
      ".app-pill .pill-dot{background:#FF4F9A !important}" +
      /* Monoton (Streifenschrift) nur für kurze große Titel; alles andere Syne, gut lesbar */
      "html[data-go-theme=postpunk] body .rail-nav__title:not(#_):not(#__),html[data-go-theme=postpunk] body .profile-name:not(#_):not(#__),html[data-go-theme=postpunk] body .gob h2:not(#_):not(#__),html[data-go-theme=postpunk] body .kreis-page__bar h2:not(#_):not(#__),html[data-go-theme=postpunk] body h1:not(#_):not(#__),html[data-go-theme=postpunk] body #heute-filter-select:not(#_){font-family:Monoton,Syne,sans-serif !important;font-weight:400 !important;letter-spacing:.04em}" +
      ".acc-card__title,.wr-title,.go-tile__name,.go-slide__title{font-family:Syne,sans-serif !important;font-weight:800 !important}"
  };
  var ORDER = ["original", "gta", "bauhaus", "bw", "postmodern", "terra", "postpunk"];

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
    /* Farben in SVG-Daten-URLs (z. B. Dropdown-Pfeil: stroke='%232A2118') */
    out = out.replace(/%23([0-9a-fA-F]{6})/g, function (m, h) {
      var n = t.hex[h.toUpperCase()];
      return n ? "%23" + n : m;
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
    ".god__btn--primary",
    ".go-tile.is-on .go-tile__pill"
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
