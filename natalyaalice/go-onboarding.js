/* go-onboarding.js — Erste Schritte für neue Nutzer
 *
 *   GoOnboarding.maybeStart(host)   zeigt den Ablauf, wenn das Konto neu ist (≤ 14 Tage, noch nicht durchlaufen)
 *   GoOnboarding.start(host)        immer zeigen (Test: /workout/?onboarding=1)
 *
 * host: rest, account() → sessionAccount, savePhoto(file, cb), openPlan(), openCircle(), toast(msg)
 * Schritte: 1 Zustimmen (danach Hinweis Home-Bildschirm) · 2 Darstellung · 3 Foto · 4 Erster Wochenplan · 5 Circle. „Später einrichten“ beendet.
 * Durchlaufen merkt sich das Gerät (localStorage) und das Konto (go_accounts.onboarded_at, go-onboarding.sql).
 */
(function (global) {
  "use strict";

  var host = null;
  var root = null;
  var step = 0;
  var consent = { privacy: false, wa: false };

  function key() {
    var a = host && host.account ? host.account() : null;
    return "gogogo_onboarded_" + (a && a.id ? a.id : "");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var CSS =
    ".gob{position:fixed;inset:0;z-index:9700;background:#F3EEE4;color:#2A2118;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif}" +
    ".gob__top{display:flex;justify-content:center;gap:6px;padding:max(16px,env(safe-area-inset-top)) 20px 6px}" +
    ".gob__dot{width:8px;height:8px;border-radius:50%;background:rgba(42,33,24,.2)}.gob__dot.is-on{background:#2A2118}" +
    ".gob__body{flex:1;min-height:0;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;justify-content:center;max-width:440px;width:100%;margin:0 auto;box-sizing:border-box}" +
    ".gob h2{margin:0 0 10px;font:600 28px/1.15 'Playfair Display',Georgia,serif;text-align:center}" +
    ".gob__lead{margin:0 0 20px;font-size:15px;line-height:1.45;text-align:center;color:rgba(42,33,24,.75)}" +
    ".gob__check{display:grid;grid-template-columns:22px 1fr;gap:12px;align-items:start;margin:0 0 14px;font-size:15px;line-height:1.4;cursor:pointer}" +
    ".gob__check input{margin-top:1px}" +
    ".gob__opt{display:block;width:100%;min-height:50px;margin:0 0 8px;border-radius:14px;border:1.5px solid rgba(42,33,24,.25);background:#F6F1E8;color:#2A2118;font:inherit;font-size:16px;font-weight:600;cursor:pointer}" +
    ".gob__opt.is-on{border-color:#2A2118;background:#2A2118;color:#F6F1E8}" +
    ".gob__face{width:140px;height:140px;margin:0 auto 18px;border-radius:50%;background:#E6DED0 center/cover no-repeat;display:grid;place-items:center;font-size:40px;font-weight:700;cursor:pointer;border:1.5px dashed rgba(42,33,24,.35)}" +
    ".gob__face input{display:none}" +
    ".gob__foot{padding:10px 22px calc(18px + env(safe-area-inset-bottom));max-width:440px;width:100%;margin:0 auto;box-sizing:border-box}" +
    ".gob__btn{display:block;width:100%;min-height:52px;border:0;border-radius:999px;background:#111;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}" +
    ".gob__btn:disabled{opacity:.4}" +
    ".gob__later{display:block;width:100%;min-height:44px;margin-top:6px;border:0;background:none;color:rgba(42,33,24,.65);font:inherit;font-size:15px;font-weight:600;cursor:pointer}" +
    ".gob a{color:inherit}" +
    "body.gob-open .app-pill{display:none !important}";

  function ensureCss() {
    if (document.getElementById("gob-css")) return;
    var st = document.createElement("style");
    st.id = "gob-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var STEPS = 5;

  function shell(title, lead, inner, main, opts) {
    opts = opts || {};
    var dots = "";
    for (var i = 0; i < STEPS; i++) dots += '<span class="gob__dot' + (i === step ? " is-on" : "") + '"></span>';
    root.innerHTML =
      '<div class="gob__top">' + dots + "</div>" +
      '<div class="gob__body"><h2>' + esc(title) + "</h2>" + (lead ? '<p class="gob__lead">' + lead + "</p>" : "") + inner + "</div>" +
      '<div class="gob__foot"><button type="button" class="gob__btn" data-gob-next' + (opts.disabled ? " disabled" : "") + ">" + esc(main) + "</button>" +
      (opts.noLater ? "" : '<button type="button" class="gob__later" data-gob-later>Später einrichten</button>') + "</div>";
  }

  function paint() {
    if (!root) return;
    var acc = host.account() || {};
    if (step === 0) {
      shell("Willkommen bei gogogo", "Kurz zustimmen, dann richten wir Deine App ein.",
        '<label class="gob__check"><input type="checkbox" data-gob-c="privacy"' + (consent.privacy ? " checked" : "") + " />" +
        '<span>Ich habe die <a href="/datenschutz/?from=app" target="_blank" rel="noopener">Datenschutzerklärung</a> gelesen. Meine Angaben und Trainings werden für die App gespeichert, Freunde und mein Coach sehen meine geplanten und erledigten Trainings.</span></label>' +
        '<label class="gob__check"><input type="checkbox" data-gob-c="wa"' + (consent.wa ? " checked" : "") + " />" +
        "<span>Jeden Abend um 19 Uhr eine kurze WhatsApp-Erinnerung (freiwillig, jederzeit abschaltbar).</span></label>",
        "Zustimmen und weiter", { disabled: !consent.privacy, noLater: true });
      return;
    }
    if (step === 1) {
      var cur = global.GoThemes ? GoThemes.current() : "original";
      var list = global.GoThemes ? GoThemes.list() : [{ id: "original", label: "Original" }];
      shell("Darstellung", "Wie soll gogogo für Dich aussehen? Ändern geht später unter Einstellungen.",
        list.map(function (t) {
          return '<button type="button" class="gob__opt' + (t.id === cur ? " is-on" : "") + '" data-gob-theme="' + esc(t.id) + '">' + esc(t.label) + "</button>";
        }).join(""), "Weiter");
      return;
    }
    if (step === 2) {
      var photo = acc.photo_url || "";
      shell("Dein Foto", "Damit Deine Freunde Dich erkennen.",
        '<label class="gob__face" style="' + (photo ? "background-image:url('" + esc(photo) + "');border-style:solid" : "") + '">' +
        (photo ? "" : "+") + '<input type="file" accept="image/*" data-gob-photo /></label>',
        photo ? "Weiter" : "Foto wählen");
      return;
    }
    if (step === 3) {
      shell("Dein erster Wochenplan", "Wähl einen Plan, der zu Deinem Ziel passt. Deine Woche füllt sich dann von selbst.",
        "", "Wochenplan wählen");
      return;
    }
    shell("Zirkeltraining im Circle", "Gründe einen Circle mit Freunden oder tritt einem bei. Dann trainiert Ihr Zirkel zusammen und seht Euch im Leaderboard.",
      "", "Circle gründen oder beitreten");
  }

  function saveConsent() {
    var a = host.account();
    if (!a || !a.id) return;
    var body = { privacy_ack_at: new Date().toISOString() };
    host.rest("go_accounts?id=eq." + encodeURIComponent(a.id), { method: "PATCH", prefer: "return=minimal", body: body }).catch(function () {});
    if (consent.wa) {
      host.rest("go_accounts?id=eq." + encodeURIComponent(a.id), {
        method: "PATCH", prefer: "return=minimal", body: { wa_reminder: true, wa_reminder_at: new Date().toISOString() }
      }).catch(function () {});
    }
  }

  /* nach den Zustimmungen: Web-App zum Home-Bildschirm (nicht, wenn sie schon von dort läuft) */
  function homeHint() {
    var installed = global.navigator.standalone === true ||
      (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches);
    if (installed || !global.GoDialog) return;
    global.GoDialog.alert("Hinweis", {
      center: true,
      body: "Füge für bessere Handhabung die Web-App zum Home-Bildschirm auf Deinem Smartphone hinzu.\n\niPhone: in Safari auf das Burgermenü im Browser > Teilen > Mehr anzeigen > + Zum Home-Bildschirm.\n\nAndroid: in Chrome auf ⋮ > Zum Startbildschirm hinzufügen."
    });
  }

  function finish() {
    try { localStorage.setItem(key(), "1"); } catch (e) {}
    var a = host.account();
    if (a && a.id) {
      host.rest("go_accounts?id=eq." + encodeURIComponent(a.id), {
        method: "PATCH", prefer: "return=minimal", body: { onboarded_at: new Date().toISOString() }
      }).catch(function () {});
    }
    if (root) root.remove();
    root = null;
    document.body.classList.remove("gob-open");
  }

  function next() {
    step += 1;
    if (step >= STEPS) { finish(); return; }
    paint();
  }

  function onClick(e) {
    var t = e.target.closest("[data-gob-next],[data-gob-later],[data-gob-theme]");
    if (!t) return;
    if (t.hasAttribute("data-gob-later")) { finish(); return; }
    if (t.hasAttribute("data-gob-theme")) {
      if (global.GoThemes) GoThemes.apply(t.getAttribute("data-gob-theme"));
      paint();
      return;
    }
    if (step === 0) { saveConsent(); next(); homeHint(); return; }
    if (step === 2) {
      var acc = host.account() || {};
      if (acc.photo_url) { next(); return; }
      var inp = root.querySelector("[data-gob-photo]");
      if (inp) inp.click();
      return;
    }
    if (step === 3) {
      /* Plan-Auswahl liegt über dem Onboarding; danach geht es hier weiter */
      step = 4;
      paint();
      setTimeout(function () { if (host.openPlan) host.openPlan(); }, 0);
      return;
    }
    if (step === 4) {
      finish();
      setTimeout(function () { if (host.openCircle) host.openCircle(); }, 0);
      return;
    }
    next();
  }

  function onChange(e) {
    var c = e.target.getAttribute && e.target.getAttribute("data-gob-c");
    if (c) {
      consent[c] = !!e.target.checked;
      var btn = root.querySelector("[data-gob-next]");
      if (btn) btn.disabled = !consent.privacy;
      return;
    }
    if (e.target.hasAttribute && e.target.hasAttribute("data-gob-photo")) {
      var file = e.target.files && e.target.files[0];
      if (!file || !host.savePhoto) return;
      host.savePhoto(file, function () { paint(); });
    }
  }

  function start(h) {
    host = h || host;
    if (!host || root) return;
    ensureCss();
    step = 0;
    root = document.createElement("div");
    root.className = "gob";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    document.body.appendChild(root);
    document.body.classList.add("gob-open");
    paint();
  }

  function maybeStart(h) {
    host = h || host;
    var a = host && host.account ? host.account() : null;
    if (!a || !a.id) return;
    try { if (localStorage.getItem(key())) return; } catch (e) {}
    host.rest("go_accounts?id=eq." + encodeURIComponent(a.id) + "&select=created_at,onboarded_at")
      .catch(function () {
        return host.rest("go_accounts?id=eq." + encodeURIComponent(a.id) + "&select=created_at");
      })
      .then(function (rows) {
        var r = (rows && rows[0]) || {};
        if (r.onboarded_at) { try { localStorage.setItem(key(), "1"); } catch (e) {} return; }
        var age = Date.now() - new Date(r.created_at || 0).getTime();
        if (!(age >= 0 && age < 14 * 864e5)) { try { localStorage.setItem(key(), "1"); } catch (e) {} return; }
        start(host);
      })
      .catch(function () {});
  }

  global.GoOnboarding = { start: start, maybeStart: maybeStart };
})(window);
