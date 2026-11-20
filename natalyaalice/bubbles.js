/*
 * GoBubbles — Themen-Communities (HYROX, Sprinten, …). Schema: go-bubbles.sql
 * Jeder Nutzer ist höchstens in einer Bubble (go_bubble_members.account_id = Primärschlüssel).
 *
 *   GoBubbles.init(host)          host: { rest, me(), isCoach(), toast(msg), openFeed(bubble), onChange() }
 *   GoBubbles.load()              Bubbles + Mitglieder laden → Promise
 *   GoBubbles.mine()              { id, name, color } meiner Bubble oder null (auch aus dem Cache, sofort)
 *   GoBubbles.renderInto(el)      Karten-Liste in Team → Bubbles malen (sofort aus Cache, dann frisch)
 *   GoBubbles.SOAP_SVG            Seifenblasen-Icon (Markierung von Events)
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

  function placesText(b) {
    var p = b && b.places;
    if (typeof p === "string") { try { p = JSON.parse(p); } catch (e) { p = [p]; } }
    return (Array.isArray(p) ? p : []).filter(Boolean).join(", ");
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
      '<input name="places" maxlength="200" placeholder="Orte, z. B. Tempelhofer Feld, FF Schönhauser Allee" />' +
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
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest("[data-gbub-cancel]"))) close();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = String(form.name.value || "").trim();
      var desc = String(form.desc.value || "").trim();
      var places = String(form.places.value || "").split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
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

  var cssDone = false;
  function ensureCss() {
    if (cssDone) return;
    cssDone = true;
    var st = document.createElement("style");
    st.textContent =
      ".gbub-card{position:relative;display:flex;gap:14px;align-items:center;width:100%;margin:0 0 12px;padding:14px;border-radius:20px;background:var(--gbub);color:#1D1630;text-align:left;cursor:pointer;box-sizing:border-box}" +
      ".gbub-card.is-mine{box-shadow:inset 0 0 0 3px #1D1630}" +
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
      ".gbub-sheet__btns .is-dark{background:#1D1630;color:#fff}";
    document.head.appendChild(st);
  }

  global.GoBubbles = {
    init: function (h) { host = h; return load(); },
    load: load,
    mine: mine,
    renderInto: renderInto,
    openCreate: openCreate,
    SOAP_SVG: SOAP_SVG
  };
})(window);
