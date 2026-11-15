/* Ortswähler: gemeinsame Ortsliste (go_workout_places, wächst für alle) + Suche + Karte.
   GoPlacePicker.mount(el, { rest, accountId, value, onChange })  → { value(), remember() } */
(function (global) {
  var places = null;
  var loading = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function loadPlaces(rest) {
    if (places) return Promise.resolve(places);
    if (loading) return loading;
    loading = rest("go_workout_places?select=id,name,lat,lng,external_id&order=name.asc&limit=1000")
      .then(function (rows) {
        places = (rows || []).filter(function (p) { return p && p.name; });
        return places;
      })
      .catch(function () {
        places = [];
        return places;
      });
    return loading;
  }

  function ensureLeaflet() {
    if (global.L) return Promise.resolve(global.L);
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
      s.onload = function () { resolve(global.L); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function mount(el, opts) {
    opts = opts || {};
    var rest = opts.rest;
    var current = opts.value ? { name: String(opts.value) } : null;
    var map = null;
    var marker = null;
    var searchTimer = null;

    el.innerHTML =
      '<div class="gpp">' +
      '<input class="gpp__search" type="search" placeholder="Ort suchen oder eingeben" value="' + esc(current ? current.name : "") + '" />' +
      '<div class="gpp__list"></div>' +
      '<div class="gpp__map" aria-label="Karte: tippen setzt den Ort"></div>' +
      "</div>";
    var input = el.querySelector(".gpp__search");
    var list = el.querySelector(".gpp__list");
    var mapEl = el.querySelector(".gpp__map");

    function setCurrent(p, fromTyping) {
      current = p && p.name ? p : null;
      if (!fromTyping && current) input.value = current.name;
      if (current && current.lat != null && map) {
        map.setView([current.lat, current.lng], 15);
        if (marker) map.removeLayer(marker);
        marker = global.L.marker([current.lat, current.lng]).addTo(map);
      }
      [].forEach.call(list.children, function (b) {
        b.classList.toggle("is-on", current && b.getAttribute("data-name") === current.name);
      });
      if (opts.onChange) opts.onChange(current);
    }

    function row(p, tag) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gpp__row";
      b.setAttribute("data-name", p.name);
      b.innerHTML = esc(p.name) + (tag ? ' <span class="gpp__tag">' + esc(tag) + "</span>" : "");
      b.addEventListener("click", function () { setCurrent(p); });
      return b;
    }

    function renderShared(q) {
      list.textContent = "";
      var needle = String(q || "").toLowerCase();
      (places || [])
        .filter(function (p) { return !needle || p.name.toLowerCase().indexOf(needle) >= 0; })
        .slice(0, 8)
        .forEach(function (p) { list.appendChild(row(p, "")); });
    }

    function searchOsm(q) {
      var url = "https://nominatim.openstreetmap.org/search?format=json&limit=5&q=" +
        encodeURIComponent(q + ", Berlin") +
        "&viewbox=13.088,52.338,13.761,52.675&bounded=1";
      return fetch(url, { headers: { "Accept-Language": "de" } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          var have = {};
          [].forEach.call(list.children, function (b) { have[b.getAttribute("data-name")] = 1; });
          (rows || []).forEach(function (r) {
            var name = String(r.display_name || "").split(",")[0].trim();
            if (!name || have[name]) return;
            have[name] = 1;
            list.appendChild(row({
              name: name,
              lat: parseFloat(r.lat),
              lng: parseFloat(r.lon),
              external_id: "osm:" + r.osm_type + ":" + r.osm_id
            }, "neu"));
          });
        })
        .catch(function () {});
    }

    input.addEventListener("input", function () {
      var q = input.value.trim();
      setCurrent(q ? { name: q } : null, true);
      renderShared(q);
      clearTimeout(searchTimer);
      if (q.length >= 3) searchTimer = setTimeout(function () { searchOsm(q); }, 400);
    });

    loadPlaces(rest).then(function () { renderShared(""); });

    ensureLeaflet()
      .then(function (L) {
        map = L.map(mapEl, { zoomControl: false, attributionControl: false }).setView([52.5, 13.4], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
        if (map.tap) map.tap.disable();
        setTimeout(function () { map.invalidateSize(); }, 200);
        var known = current && (places || []).filter(function (p) { return p.name === current.name; })[0];
        if (known && known.lat != null) setCurrent(known);
        map.on("click", function (e) {
          var lat = e.latlng.lat, lng = e.latlng.lng;
          var name = input.value.trim() || "Treffpunkt";
          fetch("https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&lat=" + lat + "&lon=" + lng, {
            headers: { "Accept-Language": "de" }
          })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (r) {
              var a = (r && r.address) || {};
              var nice = a.park || a.leisure || a.amenity || a.road || name;
              setCurrent({ name: input.value.trim() || nice, lat: lat, lng: lng, external_id: "pin:" + lat.toFixed(5) + "," + lng.toFixed(5) });
            })
            .catch(function () {
              setCurrent({ name: name, lat: lat, lng: lng, external_id: "pin:" + lat.toFixed(5) + "," + lng.toFixed(5) });
            });
        });
      })
      .catch(function () { mapEl.hidden = true; });

    return {
      value: function () { return current; },
      /* Neuen Ort in die gemeinsame Liste aufnehmen */
      remember: function () {
        if (!current || !current.name) return Promise.resolve();
        var exists = (places || []).some(function (p) { return p.name.toLowerCase() === current.name.toLowerCase(); });
        if (exists) return Promise.resolve();
        var body = {
          name: current.name,
          lat: current.lat != null ? current.lat : null,
          lng: current.lng != null ? current.lng : null,
          map_source: current.external_id && current.external_id.indexOf("osm:") === 0 ? "osm" : "user",
          external_id: current.external_id || "name:" + current.name.toLowerCase(),
          created_by: opts.accountId || null
        };
        return rest("go_workout_places?on_conflict=external_id", {
          method: "POST",
          prefer: "resolution=ignore-duplicates,return=minimal",
          body: body
        })
          .then(function () { if (places) places.push(body); })
          .catch(function () {});
      }
    };
  }

  global.GoPlacePicker = { mount: mount };
})(window);
