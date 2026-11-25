/* orte.js — Plus → Orte: Trainingsorte als quadratische Kacheln (Design wie Videos).
 *
 *   GoOrte.init({ rest, me, toast, myPlaces() → [Name], weekEvents() → [Event], pickPlace(title) → Promise<Name>, addMyPlace(name), removeMyPlace(name) })
 *   GoOrte.mount(el)
 *
 * Daten: go_workout_places (Name, Koordinaten, Foto), go_place_photos (Nutzerfotos, go-place-photos.sql), rpc go_place_usage (Kategorien je Ort),
 *        go_place_renames (Namensänderung → Admin gibt frei). go-orte-plus.sql
 * Oben: „Mein Wochenplan“ | „Meine Orte“, darunter Alle / Kraft / Ausdauer / Zirkeltraining,
 * Name (Suche, Kachel tippen füllt ihn, x leert), „Neu“ und „Auf Karte suchen“.
 */
(function (global) {
  "use strict";

  var host = null;
  var places = null;       /* [{ id, name, lat, lng, photo_url }] */
  var usage = {};          /* name_key → { cats: [], n } */
  var pending = {};        /* place_id → neuer Name (eigene offene Änderung) */
  var photosBy = {};       /* place_id → [{ id, url, status, added_by }] (go-place-photos.sql; RLS: freigegebene + eigene) */
  var label = "";
  var query = "";
  var selected = null;     /* gewählter Ort (Kachel getippt) */
  var mounted = null;

  var MAIN = ["Mein Wochenplan", "Meine Orte"];
  var CATS = [["Alle", ""], ["Kraft", "kraft"], ["Ausdauer", "ausdauer"], ["Zirkeltraining", "zirkel"]];

  /* Optik wie Videos (gleiche Klassen gxl__*, damit die Schemata greifen), Kacheln quadratisch */
  var CSS =
    ".gor{margin:6px 0 8px;text-align:left;color:#2A2118}" +
    ".gor .gxl__chips{display:flex;flex-wrap:nowrap;gap:6px;margin:0 -2px 8px;overflow-x:auto;scrollbar-width:none;padding:0 2px}" +
    ".gor .gxl__chips::-webkit-scrollbar{display:none}" +
    ".gor .gxl__chip{flex:none;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(42,33,24,.3);background:transparent;color:#2A2118;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}" +
    ".gor .gxl__chip.is-on{background:#2A2118;color:#F6F1E8;border-color:#2A2118}" +
    ".gor__main{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 8px}" +
    ".gor__main .gxl__chip{min-height:44px;font-size:15px;border-radius:999px}" +
    ".gor .gxl__qwrap{position:relative}" +
    ".gor .gxl__search{display:block;width:100%;box-sizing:border-box;min-height:40px;padding:0 44px 0 12px;border:1px solid rgba(42,33,24,.25);border-radius:10px;background:#fff;font:inherit;font-size:15px;color:#2A2118;margin:0 0 8px}" +
    ".gor .gxl__search::-webkit-search-cancel-button{-webkit-appearance:none;display:none}" +
    ".gor .gxl__qclear{position:absolute;right:6px;top:0;height:40px;width:36px;display:grid;place-items:center;padding:0;border:0;background:none;color:#2A2118;opacity:.6;cursor:pointer}" +
    ".gor .gxl__qclear[hidden],.gor__rename[hidden]{display:none}" +
    ".gor__rename{position:absolute;right:44px;top:4px;min-height:32px;padding:0 12px;border-radius:999px;border:0;background:#2A2118;color:#F6F1E8;font:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
    ".gor__hint{margin:-2px 0 8px;font-size:13px;color:rgba(42,33,24,.7);min-height:0}" +
    ".gor__hint:empty{display:none}" +
    ".gor__acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}" +
    ".gor__btn{min-height:40px;padding:0 12px;border-radius:999px;border:1.5px solid #2A2118;background:transparent;color:#2A2118;font:inherit;font-size:14px;font-weight:700;cursor:pointer}" +
    ".gor__btn.is-fill{background:#2A2118;color:#F6F1E8}" +
    ".gor .gxl__grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    ".gor .gxl__pin{position:relative;display:block;width:100%;margin:0;border-radius:12px;overflow:hidden;background:rgba(42,33,24,.08);cursor:pointer;aspect-ratio:1/1}" +
    ".gor .gxl__pin img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
    ".gor .gxl__pin.has-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(0,0,0,.65));pointer-events:none}" +
    ".gor .gxl__pinname{position:absolute;z-index:1;left:8px;right:8px;bottom:7px;color:#2A2118;font:600 12.5px/1.25 Inter,system-ui,sans-serif;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}" +
    ".gor .gxl__pin.has-photo .gxl__pinname{color:#fff}" +
    ".gor .gxl__pin.is-sel{box-shadow:0 0 0 3px #2A2118 inset}" +
    ".gor__star,.gor__up{position:absolute;z-index:2;top:4px;right:4px;width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.85);color:#2A2118;cursor:pointer}" +
    ".gor__up{right:auto;left:4px}" +
    ".gor__star svg,.gor__up svg{display:block;width:18px;height:18px}" +
    ".gor__star.is-on{background:#2A2118;color:#F6F1E8}" +
    /* mehrere Fotos: innerhalb der Kachel seitlich wischen (die Plus-Leiste selbst wischt nicht) */
    ".gor__track{position:absolute;inset:0;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;touch-action:pan-x pan-y;overscroll-behavior-x:contain}" +
    ".gor__track::-webkit-scrollbar{display:none}" +
    ".gor__slide{position:relative;flex:0 0 100%;height:100%;scroll-snap-align:center}" +
    ".gor .gor__slide img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
    ".gor__wait{position:absolute;z-index:1;left:50%;top:48px;transform:translateX(-50%);white-space:nowrap;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.9);color:#2A2118;font:700 10.5px/1.4 Inter,sans-serif}" +
    ".gor__dots{position:absolute;z-index:2;left:0;right:0;bottom:42px;display:flex;justify-content:center;gap:4px;pointer-events:none}" +
    ".gor__dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.5)}.gor__dots i.is-on{background:#fff}" +
    ".gor__tag{position:absolute;z-index:1;top:44px;left:8px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.9);color:#2A2118;font:700 11px/1.4 Inter,sans-serif}" +
    ".gor .gxl__empty{margin:8px 0;font-size:14px;color:rgba(42,33,24,.65)}" +
    /* Karte */
    ".gor-map{position:fixed;inset:0;z-index:10060;display:flex;flex-direction:column;background:#F3EEE4}" +
    ".gor-map__bar{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 10px}" +
    ".gor-map__bar b{flex:1;font:700 17px Inter,system-ui,sans-serif;color:#2A2118}" +
    ".gor-map__x{width:40px;height:40px;border-radius:50%;border:1.5px solid #2A2118;background:transparent;color:#2A2118;font-size:20px;cursor:pointer}" +
    ".gor-map__el{flex:1}" +
    ".gor-map__pop b{display:block;margin:0 0 6px}.gor-map__pop button{min-height:32px;padding:0 12px;border-radius:999px;border:0;background:#2A2118;color:#F6F1E8;font:600 13px Inter,sans-serif;cursor:pointer}";

  function ensureCss() {
    if (document.getElementById("gor-css")) return;
    var s = document.createElement("style");
    s.id = "gor-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function key(s) { return String(s || "").trim().toLowerCase(); }
  function toast(m) { if (host && host.toast) host.toast(m); }

  function myPlaces() {
    try { return (host.myPlaces && host.myPlaces()) || []; } catch (e) { return []; }
  }
  function weekPlaces() {
    var out = {};
    try {
      ((host.weekEvents && host.weekEvents()) || []).forEach(function (e) { if (e && e.location) out[key(e.location)] = 1; });
    } catch (e) {}
    return out;
  }
  function isMine(name) {
    var k = key(name);
    return myPlaces().some(function (x) { return key(x) === k; });
  }

  /* ---------- Laden ---------- */
  function load() {
    var me = host.me();
    return Promise.all([
      host.rest("go_workout_places?select=id,name,lat,lng,photo_url&order=name.asc&limit=1000")
        .catch(function () { return host.rest("go_workout_places?select=id,name,lat,lng&order=name.asc&limit=1000"); })
        .catch(function () { return []; }),
      host.rest("rpc/go_place_usage", { method: "POST", body: {} }).catch(function () { return []; }),
      me ? host.rest("go_place_renames?requested_by=eq." + encodeURIComponent(me) + "&status=eq.pending&select=place_id,new_name").catch(function () { return []; }) : [],
      host.rest("go_place_photos?status=neq.rejected&select=id,place_id,url,status,added_by,created_at&order=created_at.asc&limit=3000").catch(function () { return []; })
    ]).then(function (r) {
      photosBy = {};
      (r[3] || []).forEach(function (f) {
        if (!f || !f.url) return;
        (photosBy[String(f.place_id)] = photosBy[String(f.place_id)] || []).push(f);
      });
      places = (r[0] || []).filter(function (p) { return p && p.name; });
      usage = {};
      (r[1] || []).forEach(function (u) { if (u && u.name_key) usage[u.name_key] = { cats: u.categories || [], n: u.n || 0 }; });
      pending = {};
      (r[2] || []).forEach(function (x) { pending[String(x.place_id)] = x.new_name; });
    });
  }

  /* Fotos eines Orts: Titelbild, dann freigegebene, dann eigene noch nicht freigegebene */
  function photosOf(p) {
    var out = [];
    var seen = {};
    if (p.photo_url) { out.push({ url: p.photo_url, wait: false }); seen[p.photo_url] = 1; }
    (photosBy[String(p.id)] || []).forEach(function (f) {
      if (f.status === "approved" && !seen[f.url]) { out.push({ url: f.url, wait: false }); seen[f.url] = 1; }
    });
    (photosBy[String(p.id)] || []).forEach(function (f) {
      if (f.status === "pending" && !seen[f.url]) { out.push({ url: f.url, wait: true }); seen[f.url] = 1; }
    });
    return out;
  }

  var STAR_PATH = "M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6-4.5-4.2 6.1-.7z";
  var STAR_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '" fill="currentColor"/></svg>';
  var STAR_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  var CAM_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13.3" r="3.3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';

  /* ---------- Filter ---------- */
  function filtered() {
    var q = key(query);
    var week = weekPlaces();
    var cat = (CATS.filter(function (c) { return c[0] === label; })[0] || [])[1];
    var list = (places || []).filter(function (p) {
      var k = key(p.name);
      if (q) return k.indexOf(q) >= 0;
      if (label === "Mein Wochenplan") return !!week[k];
      if (label === "Meine Orte") return isMine(p.name);
      if (cat) return ((usage[k] || {}).cats || []).indexOf(cat) >= 0;
      return true;
    });
    /* mit Foto zuerst, dann häufig genutzt, dann alphabetisch */
    return list.sort(function (a, b) {
      var fa = photosOf(a).length ? 0 : 1, fb = photosOf(b).length ? 0 : 1;
      var na = (usage[key(a.name)] || {}).n || 0, nb = (usage[key(b.name)] || {}).n || 0;
      return fa - fb || nb - na || a.name.localeCompare(b.name, "de");
    });
  }

  function pinHtml(p) {
    var mine = isMine(p.name);
    var sel = selected && String(selected.id) === String(p.id);
    var ph = photosOf(p);
    var slides = ph.map(function (f) {
      return '<div class="gor__slide"><img src="' + esc(f.url) + '" alt="" loading="lazy" />' +
        (f.wait ? '<span class="gor__wait">Nur Du, bis zur Freigabe</span>' : "") + "</div>";
    }).join("");
    return '<div class="gxl__pin' + (ph.length ? " has-photo" : "") + (sel ? " is-sel" : "") + '" data-gor-place="' + esc(p.id) + '">' +
      (ph.length ? '<div class="gor__track" data-gor-track>' + slides + "</div>" : "") +
      (ph.length > 1 ? '<div class="gor__dots">' + ph.map(function (_, i) { return '<i class="' + (i ? "" : "is-on") + '"></i>'; }).join("") + "</div>" : "") +
      (pending[String(p.id)] ? '<span class="gor__tag">Änderung angefragt</span>' : "") +
      '<button type="button" class="gor__up" data-gor-up="' + esc(p.id) + '" aria-label="Foto hochladen">' + CAM_SVG + "</button>" +
      '<button type="button" class="gor__star' + (mine ? " is-on" : "") + '" data-gor-star="' + esc(p.id) + '" aria-label="' + (mine ? "Aus meinen Orten entfernen" : "Zu meinen Orten") + '">' + (mine ? STAR_ON : STAR_OFF) + "</button>" +
      '<span class="gxl__pinname">' + esc(p.name) + "</span></div>";
  }

  function paint(el) {
    if (!el) return;
    var list = filtered();
    var box = el.querySelector("[data-gor-list]");
    var empty = label === "Mein Wochenplan" ? "In Deinem Wochenplan steht diese Woche noch kein Ort."
      : label === "Meine Orte" ? "Noch keine eigenen Orte. Tippe auf ☆ an einem Ort oder auf „Neu“."
      : query ? "Kein Ort mit diesem Namen. Mit „Neu“ legst Du ihn an." : "Hier ist noch kein Ort.";
    box.innerHTML = list.length ? '<div class="gxl__grid">' + list.map(pinHtml).join("") + "</div>" : '<p class="gxl__empty">' + esc(empty) + "</p>";
    el.querySelectorAll("[data-gor-label]").forEach(function (c) { c.classList.toggle("is-on", c.getAttribute("data-gor-label") === label && !query); });
    var q = el.querySelector("[data-gor-q]");
    var val = String((q && q.value) || "").trim();
    el.querySelector("[data-gor-qclear]").hidden = !val;
    /* gewählter Ort, Name geändert: „Ändern“ schickt die Änderung zur Freigabe */
    var changed = !!(selected && val && val !== selected.name);
    el.querySelector("[data-gor-rename]").hidden = !changed;
    el.querySelector("[data-gor-hint]").textContent = selected
      ? (pending[String(selected.id)] ? "Änderung auf „" + pending[String(selected.id)] + "“ wartet auf Freigabe." : changed ? "Neuer Name wird nach Freigabe übernommen." : "Name ändern: oben überschreiben, dann „Ändern“.")
      : "";
  }

  /* ---------- Aktionen ---------- */
  function choose(el, id) {
    var p = (places || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) return;
    selected = p;
    var q = el.querySelector("[data-gor-q]");
    q.value = p.name;
    query = p.name;
    paint(el);
    try { el.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) {}
    var sc = el.closest(".go-slide__body");
    if (sc) { try { sc.scrollTo({ top: 0, behavior: "smooth" }); } catch (eT) { sc.scrollTop = 0; } }
  }
  function clearQuery(el) {
    var q = el.querySelector("[data-gor-q]");
    if (q) q.value = "";
    query = "";
    selected = null;
    paint(el);
  }
  function rename(el, btn) {
    var q = el.querySelector("[data-gor-q]");
    var nm = String((q && q.value) || "").trim().slice(0, 80);
    if (!selected || nm.length < 2 || nm === selected.name) return;
    var me = host.me();
    if (!me) return;
    btn.disabled = true;
    host.rest("go_place_renames", { method: "POST", prefer: "return=minimal",
      body: { place_id: selected.id, old_name: selected.name, new_name: nm, requested_by: me } })
      .then(function () {
        pending[String(selected.id)] = nm;
        btn.disabled = false;
        q.value = selected.name;
        query = selected.name;
        paint(el);
        toast("Zur Freigabe gesendet");
      })
      .catch(function (err) {
        btn.disabled = false;
        toast(/go_place_renames|relation/.test(String((err && err.message) || "")) ? "Braucht go-orte-plus.sql in Supabase" : "Ging gerade nicht");
      });
  }
  function toggleMine(el, id) {
    var p = (places || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) return;
    var on = isMine(p.name);
    /* Entfernen erst nach Bestätigung */
    var ask = on && global.GoDialog && GoDialog.confirm
      ? GoDialog.confirm("„" + p.name + "“ aus Deinen Orten entfernen?", { ok: "Entfernen", cancel: "Zurück" })
      : Promise.resolve(true);
    Promise.resolve(ask).then(function (yes) {
      if (!yes) return;
      var job = on ? (host.removeMyPlace ? host.removeMyPlace(p.name) : null) : (host.addMyPlace ? host.addMyPlace(p.name) : null);
      return Promise.resolve(job).then(function () {
        paint(el);
        toast(on ? "Aus meinen Orten entfernt" : "Zu meinen Orten hinzugefügt");
      });
    });
  }
  /* Foto hochladen: sieht nur der Nutzer selbst, nach Freigabe im Admin alle */
  function uploadPhoto(el, id) {
    var me = host.me();
    if (!me) { toast("Zum Hochladen bitte anmelden"); return; }
    if (!global.GoExMedia || !GoExMedia.uploadImage) { toast("Upload gerade nicht verfügbar"); return; }
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      toast("Foto wird hochgeladen …");
      GoExMedia.uploadImage(f, "places").then(function (url) {
        return host.rest("go_place_photos", { method: "POST", prefer: "return=representation",
          body: { place_id: id, url: url, added_by: me } });
      }).then(function (rows) {
        var row = (rows && rows[0]) || null;
        if (row) (photosBy[String(id)] = photosBy[String(id)] || []).push(row);
        paint(el);
        /* zum neuen Foto wischen */
        var tr = el.querySelector('[data-gor-place="' + String(id).replace(/"/g, "") + '"] [data-gor-track]');
        if (tr) tr.scrollLeft = tr.scrollWidth;
        toast("Foto gespeichert. Alle sehen es nach der Freigabe.");
      }).catch(function (err) {
        toast(/go_place_photos|relation/.test(String((err && err.message) || "")) ? "Braucht go-place-photos.sql in Supabase" : "Hochladen ging nicht");
      });
    });
    inp.click();
  }
  function addNew(el) {
    if (!host.pickPlace) return;
    Promise.resolve(host.pickPlace("Neuer Ort")).then(function (name) {
      if (!name) return;
      return load().then(function () {
        var p = (places || []).filter(function (x) { return key(x.name) === key(name); })[0];
        if (host.addMyPlace) host.addMyPlace(name);
        if (p) choose(el, p.id); else paint(el);
      });
    });
  }

  /* ---------- Karte: alle Orte des Filters als Punkte, Tipp wählt den Ort ---------- */
  function leaflet() {
    if (global.L && global.L.map) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      if (!document.querySelector("link[data-leaflet-css]")) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-leaflet-css", "1");
        document.head.appendChild(link);
      }
      var s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = function () { resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function openMap(el) {
    var list = (query ? (places || []) : filtered()).filter(function (p) { return p.lat != null && p.lng != null; });
    if (!list.length) list = (places || []).filter(function (p) { return p.lat != null && p.lng != null; });
    var wrap = document.createElement("div");
    wrap.className = "gor-map";
    wrap.innerHTML = '<div class="gor-map__bar"><b>Orte auf der Karte</b><button type="button" class="gor-map__x" aria-label="Schließen">×</button></div><div class="gor-map__el"></div>';
    document.body.appendChild(wrap);
    wrap.querySelector(".gor-map__x").addEventListener("click", function () { wrap.remove(); });
    leaflet().then(function () {
      var map = L.map(wrap.querySelector(".gor-map__el"), { zoomControl: false, attributionControl: true }).setView([52.51, 13.41], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
      var pts = [];
      list.forEach(function (p) {
        var ll = [Number(p.lat), Number(p.lng)];
        pts.push(ll);
        var m = L.circleMarker(ll, { radius: 9, color: "#2A2118", weight: 2, fillColor: isMine(p.name) ? "#2A2118" : "#F6F1E8", fillOpacity: 1 }).addTo(map);
        var pop = document.createElement("div");
        pop.className = "gor-map__pop";
        pop.innerHTML = "<b>" + esc(p.name) + '</b><button type="button">Auswählen</button>';
        pop.querySelector("button").addEventListener("click", function () { wrap.remove(); choose(el, p.id); });
        m.bindPopup(pop);
      });
      if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
      else if (pts.length) map.setView(pts[0], 15);
      setTimeout(function () { map.invalidateSize(); }, 120);
    }).catch(function () { wrap.remove(); toast("Karte konnte nicht geladen werden"); });
  }

  /* ---------- Aufbau ---------- */
  function mount(el) {
    if (!el || !host) return;
    ensureCss();
    mounted = el;
    if (!el.dataset.gorReady) {
      el.dataset.gorReady = "1";
      el.className = "gor";
      label = "Mein Wochenplan";
      el.innerHTML =
        '<div class="gor__main">' + MAIN.map(function (l) { return '<button type="button" class="gxl__chip" data-gor-label="' + esc(l) + '">' + esc(l) + "</button>"; }).join("") + "</div>" +
        '<div class="gxl__chips">' + CATS.map(function (c) { return '<button type="button" class="gxl__chip" data-gor-label="' + esc(c[0]) + '">' + esc(c[0]) + "</button>"; }).join("") + "</div>" +
        '<div class="gxl__qwrap"><input type="search" class="gxl__search" placeholder="Name, z. B. FF Schönhauser Allee" data-gor-q autocomplete="off" />' +
        '<button type="button" class="gor__rename" data-gor-rename hidden>Ändern</button>' +
        '<button type="button" class="gxl__qclear" data-gor-qclear hidden aria-label="Name leeren">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div>' +
        '<p class="gor__hint" data-gor-hint></p>' +
        '<div class="gor__acts"><button type="button" class="gor__btn is-fill" data-gor-new>Neu</button><button type="button" class="gor__btn" data-gor-map>Auf Karte suchen</button></div>' +
        '<div data-gor-list><p class="gxl__empty">Lädt …</p></div>';
      el.querySelector("[data-gor-q]").addEventListener("input", function () {
        /* Tippen ohne gewählten Ort: Suche; mit gewähltem Ort: neuer Name (Suche bleibt beim Ort) */
        if (!selected) query = this.value;
        paint(el);
      });
      /* Punkte unter den Fotos mitführen (scroll bubbelt nicht, daher capture) */
      el.addEventListener("scroll", function (e) {
        var tr = e.target;
        if (!tr || !tr.hasAttribute || !tr.hasAttribute("data-gor-track")) return;
        var i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
        var dots = tr.parentNode.querySelectorAll(".gor__dots i");
        Array.prototype.forEach.call(dots, function (d, k) { d.classList.toggle("is-on", k === i); });
      }, true);
      el.addEventListener("click", function (e) {
        var t = e.target;
        var star = t.closest("[data-gor-star]");
        if (star) { e.stopPropagation(); toggleMine(el, star.getAttribute("data-gor-star")); return; }
        var up = t.closest("[data-gor-up]");
        if (up) { e.stopPropagation(); uploadPhoto(el, up.getAttribute("data-gor-up")); return; }
        if (t.closest("[data-gor-qclear]")) { clearQuery(el); return; }
        var rn = t.closest("[data-gor-rename]");
        if (rn) { rename(el, rn); return; }
        if (t.closest("[data-gor-new]")) { addNew(el); return; }
        if (t.closest("[data-gor-map]")) { openMap(el); return; }
        var chip = t.closest("[data-gor-label]");
        if (chip) { label = chip.getAttribute("data-gor-label"); clearQuery(el); return; }
        var pin = t.closest("[data-gor-place]");
        if (pin) choose(el, pin.getAttribute("data-gor-place"));
      });
    }
    load().then(function () {
      /* ohne Orte im Wochenplan: meine Orte, sonst alle */
      if (label === "Mein Wochenplan" && !query && !filtered().length) label = myPlaces().length ? "Meine Orte" : "Alle";
      paint(el);
    }).catch(function () {
      el.querySelector("[data-gor-list]").innerHTML = '<p class="gxl__empty">Orte konnten nicht geladen werden.</p>';
    });
  }

  global.GoOrte = {
    init: function (h) { host = h; },
    mount: mount,
    refresh: function () { if (mounted) load().then(function () { paint(mounted); }); }
  };
})(window);
