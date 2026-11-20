/*
 * GoBubbles — Themen-Communities (HYROX, Sprinten, …). Schema: go-bubbles.sql
 * Jeder Nutzer ist höchstens in einer Bubble (go_bubble_members.account_id = Primärschlüssel).
 *
 *   GoBubbles.init(host)          host: { rest, me(), isCoach(), toast(msg), openFeed(bubble), onChange() }
 *   GoBubbles.load()              Bubbles + Mitglieder laden → Promise
 *   GoBubbles.mine()              { id, name, color } meiner Bubble oder null (auch aus dem Cache, sofort)
 *   GoBubbles.renderInto(el)      Karten-Liste in Team → Bubbles malen (sofort aus Cache, dann frisch)
 *   GoBubbles.SOAP_SVG            Seifenblasen-Icon (Markierung von Events)
 *   GoBubbles.messages()          freie Texte meiner Bubble (neueste 200) → Promise<rows>
 *   GoBubbles.post(text)          Text in den Chat → Promise
 *   GoBubbles.paintStrip(el, events, personOf)  Aktuell oben: „Alle“ + Orte der Bubble, Tipp = Story (4 s je Event)
 *   GoBubbles.openWiki()          Wiki der Bubble, jedes Mitglied schreibt
 *   GoBubbles.mountComposer()     Eingabe unten im Bubble-Chat
 */
(function (global) {
  "use strict";

  var host = null;
  var bubbles = [];
  var members = [];
  var loaded = false;
  var loading = null;
  var missing = false;
  var CACHE = "gogogo_bubble_mine";
  var PALETTE = ["#FFD84D", "#FF7A59", "#5EC8F2", "#9BD49B", "#C9A7F5", "#F6A6C8", "#7FD6C2", "#FFB35C"];
  var SOAP_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
    '<circle cx="10" cy="13" r="7"/><circle cx="18" cy="6" r="3"/><path d="M6.6 10.2a4 4 0 0 1 3-2.4"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function me() { try { return host && host.me ? String(host.me() || "") : ""; } catch (e) { return ""; } }
  function toast(m) { if (host && host.toast) host.toast(m); }
  function dlg() { return global.GoDialog || null; }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) { return null; }
  }
  function writeCache(b) {
    try {
      if (b) localStorage.setItem(CACHE, JSON.stringify({ id: b.id, name: b.name, color: b.color || "" }));
      else localStorage.removeItem(CACHE);
    } catch (e) {}
  }

  function myRow() {
    var id = me();
    return members.filter(function (m) { return String(m.account_id) === id; })[0] || null;
  }
  function mine() {
    if (!loaded) return readCache();
    var r = myRow();
    if (!r) return null;
    return bubbles.filter(function (b) { return String(b.id) === String(r.bubble_id); })[0] || null;
  }

  function load() {
    if (!host || !host.rest) return Promise.resolve();
    if (loading) return loading;
    loading = Promise.all([
      host.rest("go_bubbles?select=id,name,description,photo_url,color,places,created_by,sort&order=sort.asc,created_at.asc"),
      host.rest("go_bubble_members?select=account_id,bubble_id,role")
    ]).then(function (r) {
      bubbles = r[0] || [];
      members = r[1] || [];
      loaded = true;
      missing = false;
      writeCache(mine());
    }).catch(function (err) {
      missing = /go_bubbles|go_bubble_members|relation|schema cache/i.test(String((err && err.message) || ""));
      loaded = false;
    }).then(function () { loading = null; });
    return loading;
  }

  function countsFor(id) {
    var m = 0, c = 0;
    members.forEach(function (row) {
      if (String(row.bubble_id) !== String(id)) return;
      if (row.role === "coach") c++; else m++;
    });
    return { members: m, coaches: c };
  }

  function placesOf(b) {
    var p = b && b.places;
    if (typeof p === "string") { try { p = JSON.parse(p); } catch (e) { p = [p]; } }
    return (Array.isArray(p) ? p : []).filter(Boolean).map(function (x) {
      return typeof x === "object" ? x : { name: String(x) };
    }).filter(function (x) { return x.name; });
  }
  function placesText(b) {
    return placesOf(b).map(function (x) { return x.name; }).join(", ");
  }
  function normName(s) {
    return global.GoPlacePicker && GoPlacePicker.norm ? GoPlacePicker.norm(s) : String(s || "").toLowerCase().trim();
  }

  /* ---------- Chat: freie Texte ---------- */
  function messages() {
    var b = mine();
    if (!b || !host) return Promise.resolve([]);
    return host.rest("go_bubble_messages?bubble_id=eq." + encodeURIComponent(b.id) +
      "&select=id,author_id,body,created_at&order=created_at.desc&limit=200").catch(function () { return []; });
  }
  function post(text) {
    var b = mine();
    var body = String(text || "").trim();
    if (!b || !body) return Promise.resolve(false);
    return host.rest("go_bubble_messages", {
      method: "POST", prefer: "return=minimal",
      body: { bubble_id: b.id, author_id: me(), body: body.slice(0, 2000) }
    }).then(function () { return true; });
  }
  function mountComposer() {
    ensureCss();
    if (document.getElementById("gbub-compose")) return;
    var f = document.createElement("form");
    f.id = "gbub-compose";
    f.className = "gbub-compose";
    f.innerHTML = '<input type="text" maxlength="2000" placeholder="Nachricht an die Bubble" enterkeyhint="send" />' +
      '<button type="submit" aria-label="Senden"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5L4 12z"/></svg></button>';
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = f.querySelector("input");
      var t = String(inp.value || "").trim();
      if (!t) return;
      var btn = f.querySelector("button");
      btn.disabled = true;
      post(t).then(function () {
        inp.value = "";
        if (host.onMessage) host.onMessage();
      }).catch(function () {
        toast(missing ? "Bubbles fehlen noch: go-bubbles.sql ausführen" : "Senden ging gerade nicht");
      }).then(function () { btn.disabled = false; });
    });
    document.body.appendChild(f);
  }

  /* ---------- Wiki ---------- */
  function openWiki() {
    var b = mine();
    if (!b) return;
    ensureCss();
    var wrap = document.createElement("div");
    wrap.className = "gbub-sheet";
    wrap.innerHTML = '<form class="gbub-sheet__card gbub-wiki"><h2>Wiki · ' + esc(b.name) + "</h2>" +
      '<textarea rows="12" placeholder="Was alle in der Bubble wissen sollten: Treffpunkte, Zeiten, Tipps, Ausrüstung …"></textarea>' +
      '<p class="gbub-wiki__meta"></p>' +
      '<div class="gbub-sheet__btns"><button type="button" data-gbub-cancel>Schließen</button><button type="submit" class="is-dark">Speichern</button></div></form>';
    document.body.appendChild(wrap);
    var ta = wrap.querySelector("textarea");
    var meta = wrap.querySelector(".gbub-wiki__meta");
    ta.disabled = true;
    host.rest("go_bubble_wiki?bubble_id=eq." + encodeURIComponent(b.id) + "&select=body,updated_at,updated_by")
      .then(function (rows) {
        var r = rows && rows[0];
        ta.value = r ? r.body || "" : "";
        if (r && r.updated_at) meta.textContent = "Zuletzt geändert " + new Date(r.updated_at).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
      }).catch(function () {}).then(function () { ta.disabled = false; });
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest("[data-gbub-cancel]"))) wrap.remove();
    });
    wrap.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      host.rest("go_bubble_wiki?on_conflict=bubble_id", {
        method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
        body: { bubble_id: b.id, body: ta.value, updated_by: me(), updated_at: new Date().toISOString() }
      }).then(function () {
        wrap.remove();
        if (dlg()) dlg().alert("Wiki gespeichert"); else toast("Wiki gespeichert");
      }).catch(function () { toast("Speichern ging gerade nicht"); });
    });
  }

  /* ---------- Aktuell oben: Orte + Story ---------- */
  var PIN_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
  function paintStrip(el, events, personOf) {
    var b = mine();
    if (!el || !b) return;
    ensureCss();
    /* Story nur aus Events mit Bubble-Markierung UND Ort; deren Orte tragen sich selbst in die Leiste ein */
    var list = (events || []).filter(function (ev) { return ev && String(ev.location || "").trim(); })
      .sort(function (x, y) { return String(x.starts_at).localeCompare(String(y.starts_at)); });
    var places = placesOf(b).slice();
    list.forEach(function (ev) {
      var nm = String(ev.location).trim();
      if (!places.some(function (p) { return normName(p.name) === normName(nm); })) places.push({ name: nm });
    });
    el.innerHTML = '<button type="button" class="gbub-strip__item" data-gbub-story="*" style="--gbub:' + esc(b.color || "#E9E1D2") + '">' +
      '<span class="gbub-strip__ring' + (list.length ? " has" : "") + '">' + SOAP_SVG + "</span><span>Alle</span></button>" +
      places.map(function (p, i) {
        var n = list.filter(function (ev) { return normName(ev.location) === normName(p.name); }).length;
        return '<button type="button" class="gbub-strip__item" data-gbub-story="' + i + '" style="--gbub:' + esc(b.color || "#E9E1D2") + '">' +
          '<span class="gbub-strip__ring' + (n ? " has" : "") + '">' + PIN_SVG + "</span><span>" + esc(p.name) + "</span></button>";
      }).join("");
    el._gbubData = { list: list, places: places, personOf: personOf, color: b.color };
    if (!el._gbubBound) {
      el._gbubBound = true;
      el.addEventListener("click", function (e) {
        var it = e.target.closest && e.target.closest("[data-gbub-story]");
        if (!it) return;
        var d = el._gbubData || {};
        var k = it.getAttribute("data-gbub-story");
        var evs = d.list || [];
        var title = "Alle Events";
        if (k !== "*") {
          var p = d.places[Number(k)];
          if (!p) return;
          title = p.name;
          evs = evs.filter(function (ev) { return normName(ev.location) === normName(p.name); });
          if (!evs.length) {
            if (p.lat != null && p.lng != null) {
              global.open("https://www.openstreetmap.org/?mlat=" + p.lat + "&mlon=" + p.lng + "#map=17/" + p.lat + "/" + p.lng, "_blank", "noopener");
            } else toast("Noch keine Events an " + p.name);
            return;
          }
        }
        if (!evs.length) { toast("Noch keine Bubble-Events mit Ort"); return; }
        openStory(evs, title, d.personOf, d.color);
      });
    }
  }

  /* Story: Events nacheinander, 4 s je Event; Tipp rechts = weiter, links = zurück */
  function openStory(evs, title, personOf, color) {
    ensureCss();
    var i = 0, timer = null;
    var wrap = document.createElement("div");
    wrap.className = "gbub-story";
    document.body.appendChild(wrap);
    function close() { clearTimeout(timer); wrap.remove(); }
    function show() {
      clearTimeout(timer);
      if (i >= evs.length) { close(); return; }
      if (i < 0) i = 0;
      var ev = evs[i];
      var p = personOf ? personOf(ev.user_id) : { name: "" };
      var d = new Date(ev.starts_at);
      var when = d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "numeric" }) +
        (/T12:00:00/.test(String(ev.starts_at)) ? "" : " · " + d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }));
      wrap.style.setProperty("--gbub", color || "#2A2118");
      wrap.innerHTML =
        (ev.photo_url ? '<img class="gbub-story__bg" src="' + esc(ev.photo_url) + '" alt="" />' : "") +
        '<div class="gbub-story__bars">' + evs.map(function (_, k) {
          return '<span class="' + (k < i ? "is-done" : k === i ? "is-now" : "") + '"><i></i></span>';
        }).join("") + "</div>" +
        '<div class="gbub-story__top"><span>' + esc(title) + '</span><button type="button" data-gbub-close aria-label="Schließen">×</button></div>' +
        '<div class="gbub-story__txt"><p class="gbub-story__who">' + esc(p && p.name || "") + "</p>" +
        "<h3>" + esc(String(ev.title || "Training").replace(/^[^A-Za-zÄÖÜäöü0-9]+\s*/, "")) + "</h3>" +
        "<p>" + esc(when) + (ev.location ? " · " + esc(ev.location) : "") + "</p>" +
        (ev.status === "erledigt" ? '<p class="gbub-story__done">Erledigt ✓</p>' : "") + "</div>";
      timer = setTimeout(function () { i++; show(); }, 4000);
    }
    wrap.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-gbub-close]")) { close(); return; }
      i += e.clientX < window.innerWidth / 3 ? -1 : 1;
      show();
    });
    show();
  }

  /* ---------- Beitreten / Verlassen ---------- */
  function join(b) {
    var cur = mine();
    var role = host.isCoach && host.isCoach() ? "coach" : "member";
    var ask = cur && String(cur.id) !== String(b.id) && dlg()
      ? dlg().confirm(b.name + " beitreten?\nDu verlässt dafür " + cur.name + ". Man ist immer nur in einer Bubble.", { ok: "Beitreten" })
      : dlg() ? dlg().confirm(b.name + " beitreten?", { ok: "Beitreten" }) : Promise.resolve(true);
    return ask.then(function (yes) {
      if (!yes) return false;
      return host.rest("go_bubble_members?on_conflict=account_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: { account_id: me(), bubble_id: b.id, role: role, joined_at: new Date().toISOString() }
      }).then(function () {
        members = members.filter(function (m) { return String(m.account_id) !== me(); });
        members.push({ account_id: me(), bubble_id: b.id, role: role });
        writeCache(b);
        if (host.onChange) host.onChange();
        return true;
      });
    }).catch(function () {
      toast(missing ? "Bubbles fehlen noch: go-bubbles.sql ausführen" : "Beitreten ging gerade nicht");
      return false;
    });
  }

  function leave(b) {
    var ask = dlg() ? dlg().confirm(b.name + " verlassen?", { ok: "Verlassen" }) : Promise.resolve(true);
    return ask.then(function (yes) {
      if (!yes) return false;
      return host.rest("go_bubble_members?account_id=eq." + encodeURIComponent(me()), {
        method: "DELETE", prefer: "return=minimal"
      }).then(function () {
        members = members.filter(function (m) { return String(m.account_id) !== me(); });
        writeCache(null);
        if (host.onChange) host.onChange();
        return true;
      });
    }).catch(function () { toast("Verlassen ging gerade nicht"); return false; });
  }

  /* ---------- Bubble anlegen: Name, Foto, Beschreibung, Orte ---------- */
  function openCreate(onDone) {
    ensureCss();
    var file = null;
    var wrap = document.createElement("div");
    wrap.className = "gbub-sheet";
    wrap.setAttribute("role", "dialog");
    wrap.innerHTML =
      '<form class="gbub-sheet__card">' +
      '<h2>Neue Bubble</h2>' +
      '<label class="gbub-photo"><span>Foto</span><input type="file" accept="image/*" hidden /></label>' +
      '<input name="name" maxlength="40" placeholder="Name" required />' +
      '<textarea name="desc" rows="3" maxlength="400" placeholder="Beschreibung"></textarea>' +
      '<div class="gbub-places"><div class="gbub-places__chips"></div>' +
      '<button type="button" class="gbub-places__add" data-gbub-addplace>+ Ort hinzufügen</button>' +
      '<div class="gbub-places__picker" hidden><div class="gbub-places__pp"></div>' +
      '<button type="button" class="gbub-places__ok" data-gbub-placeok>Ort übernehmen</button></div></div>' +
      '<div class="gbub-sheet__btns"><button type="button" data-gbub-cancel>Abbrechen</button>' +
      '<button type="submit" class="is-dark">Anlegen</button></div></form>';
    document.body.appendChild(wrap);
    var form = wrap.querySelector("form");
    var photo = wrap.querySelector(".gbub-photo");
    photo.querySelector("input").addEventListener("change", function (e) {
      file = e.target.files && e.target.files[0];
      if (!file) return;
      photo.style.backgroundImage = "url(" + URL.createObjectURL(file) + ")";
      photo.classList.add("has-img");
    });
    function close() { wrap.remove(); }
    /* Orte aus der gemeinsamen Ortsliste (go_workout_places) mit Punkt auf der Karte */
    var chosen = [];
    var picker = null;
    var pkBox = wrap.querySelector(".gbub-places__picker");
    function paintChips() {
      wrap.querySelector(".gbub-places__chips").innerHTML = chosen.map(function (p, k) {
        return '<span class="gbub-chip">' + esc(p.name) + '<button type="button" data-gbub-rmplace="' + k + '" aria-label="Entfernen">×</button></span>';
      }).join("");
    }
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest("[data-gbub-cancel]"))) { close(); return; }
      if (e.target.closest && e.target.closest("[data-gbub-addplace]")) {
        pkBox.hidden = false;
        if (!picker && global.GoPlacePicker) picker = GoPlacePicker.mount(wrap.querySelector(".gbub-places__pp"), { rest: host.rest, accountId: me(), noFav: true });
        return;
      }
      if (e.target.closest && e.target.closest("[data-gbub-placeok]")) {
        var v = picker && picker.value();
        if (!v || !v.name) { toast("Bitte einen Ort aus der Liste oder auf der Karte wählen"); return; }
        if (v.lat == null || v.lng == null) { toast("Für diesen Ort fehlt der Punkt auf der Karte. Bitte auf der Karte tippen."); return; }
        if (!chosen.some(function (c) { return normName(c.name) === normName(v.name); })) {
          chosen.push({ id: v.id || null, name: v.name, lat: v.lat, lng: v.lng });
          if (picker.remember) picker.remember();
        }
        paintChips();
        pkBox.hidden = true;
        picker = null;
        wrap.querySelector(".gbub-places__pp").innerHTML = "";
        return;
      }
      var rm = e.target.closest && e.target.closest("[data-gbub-rmplace]");
      if (rm) { chosen.splice(Number(rm.getAttribute("data-gbub-rmplace")), 1); paintChips(); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = String(form.name.value || "").trim();
      var desc = String(form.desc.value || "").trim();
      var places = chosen.slice();
      if (!name) return;
      if (!file) { toast("Bitte ein Foto wählen"); return; }
      if (!desc) { toast("Bitte eine Beschreibung"); return; }
      if (!places.length) { toast("Bitte mindestens einen Ort"); return; }
      var btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      var up = global.GoExMedia && GoExMedia.uploadImage ? GoExMedia.uploadImage(file, "bubbles") : Promise.reject(new Error("Upload nicht verfügbar"));
      up.then(function (url) {
        return host.rest("go_bubbles", {
          method: "POST",
          prefer: "return=representation",
          body: {
            name: name, description: desc, photo_url: url, places: places,
            color: PALETTE[bubbles.length % PALETTE.length], created_by: me(), sort: 100
          }
        });
      }).then(function (rows) {
        var b = rows && rows[0];
        close();
        return load().then(function () {
          if (onDone) onDone();
          if (b && dlg()) {
            return dlg().confirm(name + " ist angelegt. Gleich beitreten?", { ok: "Beitreten", cancel: "Später" }).then(function (yes) {
              if (!yes) return;
              return host.rest("go_bubble_members?on_conflict=account_id", {
                method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
                body: { account_id: me(), bubble_id: b.id, role: host.isCoach && host.isCoach() ? "coach" : "member" }
              }).then(function () { return load(); }).then(function () {
                if (host.onChange) host.onChange();
                if (onDone) onDone();
              });
            });
          }
        });
      }).catch(function (err) {
        btn.disabled = false;
        var m = String((err && err.message) || "");
        toast(/duplicate|23505/.test(m) ? "Diese Bubble gibt es schon" : /go_bubbles|relation/.test(m) ? "Bubbles fehlen noch: go-bubbles.sql ausführen" : m || "Anlegen ging gerade nicht");
      });
    });
    setTimeout(function () { try { form.name.focus(); } catch (e) {} }, 60);
  }

  /* ---------- Team → Bubbles ---------- */
  function cardHtml(b, isMine) {
    var c = countsFor(b.id);
    var meta = c.members + (c.members === 1 ? " Mitglied" : " Mitglieder") + (c.coaches ? " · " + c.coaches + (c.coaches === 1 ? " Coach" : " Coaches") : "");
    return '<div class="gbub-card' + (isMine ? " is-mine" : "") + '" style="--gbub:' + esc(b.color || "#E9E1D2") + '" data-gbub="' + esc(b.id) + '" role="button" tabindex="0">' +
      '<span class="gbub-card__img">' + (b.photo_url ? '<img src="' + esc(b.photo_url) + '" alt="" loading="lazy" />' : SOAP_SVG) + "</span>" +
      '<span class="gbub-card__txt"><span class="gbub-card__name">' + esc(b.name) + "</span>" +
      '<span class="gbub-card__meta">' + esc(meta) + (placesText(b) ? " · " + esc(placesText(b)) : "") + "</span>" +
      (b.description ? '<span class="gbub-card__desc">' + esc(b.description) + "</span>" : "") + "</span>" +
      (isMine ? '<span class="gbub-card__me">Deine Bubble</span><button type="button" class="gbub-card__leave" data-gbub-leave="' + esc(b.id) + '">Verlassen</button>' : "") +
      "</div>";
  }

  function paint(el) {
    var cur = mine();
    var html =
      '<button type="button" class="friend-list__row friend-list__add" data-gbub-add>' +
      '<span class="friend-list__plus" aria-hidden="true">+</span>' +
      '<span class="friend-list__text"><span class="friend-list__name">Bubble hinzufügen</span>' +
      '<span class="friend-list__meta">Name, Foto, Beschreibung, Orte</span></span></button>';
    if (missing) html += '<p class="coach-empty">Bubbles fehlen noch: go-bubbles.sql in Supabase ausführen.</p>';
    else if (!loaded && !bubbles.length) html += '<p class="coach-empty">Lädt …</p>';
    var list = bubbles.slice();
    if (cur) list.sort(function (a, b) { return (String(b.id) === String(cur.id)) - (String(a.id) === String(cur.id)); });
    html += list.map(function (b) { return cardHtml(b, cur && String(cur.id) === String(b.id)); }).join("");
    el.innerHTML = html;
  }

  function renderInto(el) {
    if (!el) return;
    ensureCss();
    paint(el);
    if (!el._gbubBound) {
      el._gbubBound = true;
      el.addEventListener("click", function (e) {
        var t = e.target;
        if (t.closest("[data-gbub-add]")) { openCreate(function () { paint(el); }); return; }
        var lv = t.closest("[data-gbub-leave]");
        if (lv) {
          e.stopPropagation();
          var bl = bubbles.filter(function (x) { return String(x.id) === lv.getAttribute("data-gbub-leave"); })[0];
          if (bl) leave(bl).then(function () { paint(el); });
          return;
        }
        var card = t.closest("[data-gbub]");
        if (!card) return;
        var b = bubbles.filter(function (x) { return String(x.id) === card.getAttribute("data-gbub"); })[0];
        if (!b) return;
        var cur = mine();
        if (cur && String(cur.id) === String(b.id)) { if (host.openFeed) host.openFeed(b); return; }
        join(b).then(function (ok) {
          paint(el);
          if (ok && host.openFeed) host.openFeed(b);
        });
      });
    }
    load().then(function () { paint(el); });
  }

  /* Wallet-Ansicht (Team → Bubbles, Quadrat): paint(items, fill(card, b), open(b)) aus index.html */
  function wallet(paint) {
    function run() {
      var cur = mine();
      var items = bubbles.slice();
      if (cur) items.sort(function (a, b) { return (String(b.id) === String(cur.id)) - (String(a.id) === String(cur.id)); });
      paint(items, function fill(card, b) {
        var body = card.querySelector(".fw-card__body");
        if (!body) return;
        var c = countsFor(b.id);
        var isMine = cur && String(cur.id) === String(b.id);
        body.innerHTML =
          (isMine ? '<span class="gbub-card__me" style="position:static;display:inline-block;margin-bottom:8px">Deine Bubble</span>' : "") +
          '<h3 class="fw-card__name">' + esc(b.name) + "</h3>" +
          '<p class="fw-card__goal">' + esc(c.members + (c.members === 1 ? " Mitglied" : " Mitglieder") + (c.coaches ? " · " + c.coaches + (c.coaches === 1 ? " Coach" : " Coaches") : "")) + "</p>" +
          (b.description ? '<p class="fw-card__about">' + esc(b.description) + "</p>" : "") +
          (placesText(b) ? '<p class="fw-card__goal">' + esc(placesText(b)) + "</p>" : "");
        if (!b.photo_url && !card.querySelector(".gbub-wsoap")) {
          var s2 = document.createElement("span");
          s2.className = "gbub-wsoap";
          s2.innerHTML = SOAP_SVG;
          card.insertBefore(s2, card.firstChild);
        }
      }, function open(b) {
        var cur2 = mine();
        if (cur2 && String(cur2.id) === String(b.id)) { if (host.openFeed) host.openFeed(b); return; }
        join(b).then(function (ok) {
          run();
          if (ok && host.openFeed) host.openFeed(b);
        });
      });
    }
    ensureCss();
    if (loaded) run();
    load().then(run);
  }

  var cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    cssDone = true;
    var st = document.createElement("style");
    st.textContent =
      ".gbub-card{position:relative;display:flex;gap:14px;align-items:center;width:100%;margin:0 0 12px;padding:14px;border-radius:20px;background:var(--gbub);color:#1D1630;text-align:left;cursor:pointer;box-sizing:border-box}" +
      ".gbub-card.is-mine{box-shadow:inset 0 0 0 3px #1D1630}" +
      ".fw-card--bubble .fw-card__body{color:#1D1630}" +
      ".fw-card--bubble[style*=background-image] .fw-card__body{color:#fff}" +
      ".gbub-wsoap{position:absolute;right:22px;bottom:22px;color:#1D1630;opacity:.85}" +
      ".gbub-wsoap svg{width:96px;height:96px}" +
      ".gbub-card__img{flex:none;width:72px;height:72px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.45);display:flex;align-items:center;justify-content:center}" +
      ".gbub-card__img img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".gbub-card__img svg{width:36px;height:36px}" +
      ".gbub-card__txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}" +
      ".gbub-card .gbub-card__name{font:800 21px/1.1 'Archivo Black','Space Grotesk',Inter,sans-serif !important}" +
      ".gbub-card .gbub-card__meta{font:600 13px/1.3 Inter,sans-serif !important;opacity:.75}" +
      ".gbub-card .gbub-card__desc{font:500 14px/1.35 Inter,sans-serif !important;opacity:.85;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".gbub-card__me{position:absolute;top:10px;right:12px;font:700 11px/1 Inter,sans-serif;background:#1D1630;color:#fff;border-radius:999px;padding:5px 9px}" +
      ".gbub-card__leave{position:absolute;bottom:10px;right:12px;border:0;background:transparent;color:inherit;font:600 12px Inter,sans-serif;text-decoration:underline;opacity:.7;cursor:pointer}" +
      ".gbub-sheet{position:fixed;inset:0;z-index:10050;background:rgba(20,16,30,.45);display:flex;align-items:flex-end;justify-content:center}" +
      ".gbub-sheet__card{width:100%;max-width:520px;background:#FBF3E2;color:#1D1630;border-radius:24px 24px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:10px;box-sizing:border-box}" +
      ".gbub-sheet__card h2{margin:0 0 4px;text-align:center;font:700 18px Inter,sans-serif}" +
      ".gbub-sheet__card input,.gbub-sheet__card textarea{width:100%;box-sizing:border-box;border:1px solid rgba(29,22,48,.25);border-radius:12px;padding:12px;font:500 16px Inter,sans-serif;background:#fff;color:#1D1630}" +
      ".gbub-photo{align-self:center;width:110px;height:110px;border-radius:20px;border:1.5px dashed rgba(29,22,48,.4);display:flex;align-items:center;justify-content:center;font:600 14px Inter,sans-serif;background-size:cover;background-position:center;cursor:pointer}" +
      ".gbub-photo.has-img span{display:none}" +
      ".gbub-sheet__btns{display:flex;gap:10px;margin-top:6px}" +
      ".gbub-sheet__btns button{flex:1;min-height:50px;border-radius:999px;border:1.5px solid #1D1630;background:transparent;color:#1D1630;font:700 16px Inter,sans-serif}" +
      ".gbub-sheet__btns .is-dark{background:#1D1630;color:#fff}" +
      ".gbub-sheet__card{max-height:92dvh;overflow:auto}" +
      ".gbub-places__chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}" +
      ".gbub-chip{display:inline-flex;align-items:center;gap:4px;padding:6px 6px 6px 12px;border-radius:999px;background:#1D1630;color:#fff;font:600 13px Inter,sans-serif}" +
      ".gbub-chip button{border:0;background:transparent;color:inherit;font-size:16px;width:22px;cursor:pointer}" +
      ".gbub-places__add,.gbub-places__ok{border:1.5px dashed rgba(29,22,48,.45);background:transparent;color:#1D1630;border-radius:12px;min-height:44px;width:100%;font:600 15px Inter,sans-serif;cursor:pointer}" +
      ".gbub-places__ok{border-style:solid;margin-top:8px}" +
      ".gbub-places__pp .gpp__map{height:180px}" +
      ".gbub-compose{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:60;display:none;gap:8px;align-items:center;padding:6px 6px 6px 16px;border-radius:999px;background:#fff;box-shadow:0 6px 24px rgba(29,22,48,.14)}" +
      "body[data-shell=heute][data-heute=bubble] .gbub-compose{display:flex}" +
      "body.wr-sheet-open .gbub-compose,body.ffc-open .gbub-compose{display:none !important}" +
      ".gbub-compose input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:500 16px Inter,sans-serif;color:#1D1630}" +
      ".gbub-compose button{flex:none;width:42px;height:42px;border-radius:50%;border:0;background:#1D1630;color:#fff;display:flex;align-items:center;justify-content:center}" +
      ".gbub-strip{display:none;gap:14px;overflow-x:auto;padding:4px 20px 10px;scrollbar-width:none}" +
      "body[data-heute=bubble] .gbub-strip{display:flex}" +
      ".gbub-strip__item{flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;width:78px;border:0;background:transparent;color:#1D1630;font:600 12px/1.2 Inter,sans-serif;text-align:center;cursor:pointer}" +
      ".gbub-strip__item>span:last-child{max-width:78px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".gbub-strip__ring{width:66px;height:66px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--gbub);box-shadow:inset 0 0 0 3px rgba(255,255,255,.6)}" +
      ".gbub-strip__ring.has{box-shadow:0 0 0 3px #1D1630}" +
      ".gbub-strip__ring svg{width:28px;height:28px}" +
      ".gbub-wiki textarea{min-height:40dvh;resize:vertical;line-height:1.5}" +
      ".gbub-wiki__meta{margin:0;font:500 12px Inter,sans-serif;opacity:.6;text-align:right}" +
      ".gbub-story{position:fixed;inset:0;z-index:10080;background:var(--gbub);color:#fff;overflow:hidden;cursor:pointer}" +
      ".gbub-story__bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
      ".gbub-story::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 50%,rgba(0,0,0,.7))}" +
      ".gbub-story__bars{position:absolute;z-index:2;top:calc(env(safe-area-inset-top,0px) + 10px);left:12px;right:12px;display:flex;gap:4px}" +
      ".gbub-story__bars span{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.35);overflow:hidden}" +
      ".gbub-story__bars i{display:block;height:100%;width:0;background:#fff}" +
      ".gbub-story__bars .is-done i{width:100%}" +
      ".gbub-story__bars .is-now i{animation:gbubbar 4s linear forwards}" +
      "@keyframes gbubbar{to{width:100%}}" +
      ".gbub-story__top{position:absolute;z-index:2;top:calc(env(safe-area-inset-top,0px) + 22px);left:16px;right:8px;display:flex;justify-content:space-between;align-items:center;font:700 15px Inter,sans-serif}" +
      ".gbub-story__top button{border:0;background:transparent;color:#fff;font-size:32px;width:44px;height:44px;cursor:pointer}" +
      ".gbub-story__txt{position:absolute;z-index:2;left:22px;right:22px;bottom:calc(env(safe-area-inset-bottom,0px) + 48px)}" +
      ".gbub-story__txt h3{margin:4px 0 8px;font:800 34px/1.05 'Archivo Black','Space Grotesk',Inter,sans-serif}" +
      ".gbub-story__txt p{margin:0;font:600 16px/1.4 Inter,sans-serif}" +
      ".gbub-story__who{opacity:.85}" +
      ".gbub-story__done{margin-top:8px !important}";
    document.head.appendChild(st);
  }

  global.GoBubbles = {
    init: function (h) { host = h; return load(); },
    load: load,
    mine: mine,
    renderInto: renderInto,
    openCreate: openCreate,
    messages: messages,
    post: post,
    paintStrip: paintStrip,
    openStory: openStory,
    openWiki: openWiki,
    mountComposer: mountComposer,
    wallet: wallet,
    SOAP_SVG: SOAP_SVG
  };
})(window);
