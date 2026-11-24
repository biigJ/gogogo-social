/* go-onboarding.js — Erste Schritte für neue Nutzer
 *
 *   GoOnboarding.maybeStart(host)   zeigt den Ablauf, wenn das Konto neu ist (≤ 14 Tage, noch nicht durchlaufen)
 *   GoOnboarding.start(host)        immer zeigen (Test: /workout/?onboarding=1)
 *
 * host: rest, account() → sessionAccount, openPlan()
 * Schritte: 1 Zustimmen (danach Hinweis Home-Bildschirm) · 2 Training (Kraft pro Woche, fester Tag, Ort, Verein)
 *           · 3 Alltag (Rad, Spazieren, Schritte, Morgenroutine) · 4 Wochenplan wählen oder „Erst mal umsehen“.
 * Antworten: go_accounts.training_prefs (go-training-prefs.sql), Regeln in plan-rules.js (Verteilung der Tage, Schrittziel).
 * Darstellung, Foto und Circle kommen später über Einstellungen und Plus, damit man die App erst ansehen kann.
 * Durchlaufen merkt sich das Gerät (localStorage) und das Konto (go_accounts.onboarded_at, go-onboarding.sql).
 */
(function (global) {
  "use strict";

  var host = null;
  var root = null;
  var step = 0;
  var consent = { privacy: false, wa: false };
  /* Antworten (go_accounts.training_prefs) */
  var prefs = { kraft: "", fixed_day: null, place: "", club: { on: false, days: [], sport: "" }, bike: "", walk: "", steps: "", morning: null };
  var DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

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
    ".gob__foot{padding:10px 22px calc(18px + env(safe-area-inset-bottom));max-width:440px;width:100%;margin:0 auto;box-sizing:border-box}" +
    ".gob__btn{display:block;width:100%;min-height:52px;border:0;border-radius:999px;background:#111;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}" +
    ".gob__btn:disabled{opacity:.4}" +
    ".gob__later{display:block;width:100%;min-height:44px;margin-top:6px;border:0;background:none;color:rgba(42,33,24,.65);font:inherit;font-size:15px;font-weight:600;cursor:pointer}" +
    ".gob a{color:inherit}" +
    ".gob__q{margin:18px 0 8px;font-size:15px;font-weight:700}" +
    ".gob__q small{display:block;font-weight:400;color:rgba(42,33,24,.65);margin-top:2px}" +
    ".gob__chips{display:flex;flex-wrap:wrap;gap:8px}" +
    ".gob__chip{min-height:40px;padding:0 14px;border-radius:999px;border:1.5px solid rgba(42,33,24,.3);background:transparent;color:#2A2118;font:inherit;font-size:14px;font-weight:600;cursor:pointer}" +
    ".gob__chip.is-on{background:#2A2118;border-color:#2A2118;color:#F6F1E8}" +
    ".gob__chips--days{flex-wrap:nowrap;gap:5px}.gob__chips--days .gob__chip{flex:1;min-width:0;padding:0}" +
    ".gob__input{display:block;width:100%;box-sizing:border-box;margin-top:8px;min-height:44px;padding:0 14px;border-radius:12px;border:1.5px solid rgba(42,33,24,.3);background:#fff;font:inherit;font-size:15px}" +
    ".gob__sum{margin:14px 0 0;padding:14px;border-radius:14px;background:#fff;font-size:14px;line-height:1.5}" +
    ".gob__body.is-form{justify-content:flex-start}" +
    "body.gob-open .app-pill{display:none !important}";

  function ensureCss() {
    if (document.getElementById("gob-css")) return;
    var st = document.createElement("style");
    st.id = "gob-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var STEPS = 4;

  function shell(title, lead, inner, main, opts) {
    opts = opts || {};
    var dots = "";
    for (var i = 0; i < STEPS; i++) dots += '<span class="gob__dot' + (i === step ? " is-on" : "") + '"></span>';
    root.innerHTML =
      '<div class="gob__top">' + dots + "</div>" +
      '<div class="gob__body' + (opts.form ? " is-form" : "") + '"><h2>' + esc(title) + "</h2>" + (lead ? '<p class="gob__lead">' + lead + "</p>" : "") + inner + "</div>" +
      '<div class="gob__foot"><button type="button" class="gob__btn" data-gob-next' + (opts.disabled ? " disabled" : "") + ">" + esc(main) + "</button>" +
      (opts.noLater ? "" : '<button type="button" class="gob__later" data-gob-later>' + esc(opts.later || "Später einrichten") + "</button>") + "</div>";
  }

  function paint() {
    if (!root) return;
    if (step === 0) {
      shell("Willkommen bei gogogo", "Kurz zustimmen, dann kannst Du Dich umsehen.",
        '<label class="gob__check"><input type="checkbox" data-gob-c="privacy"' + (consent.privacy ? " checked" : "") + " />" +
        '<span>Ich habe die <a href="/datenschutz/?from=app" target="_blank" rel="noopener">Datenschutzerklärung</a> gelesen. Meine Angaben und Trainings werden für die App gespeichert, Freunde und mein Coach sehen meine geplanten und erledigten Trainings.</span></label>' +
        '<label class="gob__check"><input type="checkbox" data-gob-c="wa"' + (consent.wa ? " checked" : "") + " />" +
        "<span>Jeden Abend um 19 Uhr eine kurze WhatsApp-Erinnerung (freiwillig, jederzeit abschaltbar).</span></label>",
        "Zustimmen und weiter", { disabled: !consent.privacy, noLater: true });
      return;
    }
    if (step === 1) {
      shell("Dein Training", "Damit Dein Wochenplan zu Deinem Alltag passt.",
        q("Wie oft schaffst Du Krafttraining pro Woche?", "", chips("kraft", [["1", "1×"], ["1-2", "1 bis 2×"], ["2-3", "2 bis 3×"], ["3+", "3× und mehr"]])) +
        q("Welcher Tag ist Dein fester Termin?", "Der Tag, der nicht verhandelbar ist.", dayChips("fixed_day", false)) +
        q("Wo trainierst Du?", "", chips("place", [["zuhause", "Zuhause ohne Geräte"], ["hanteln", "Zuhause mit Hanteln"], ["gym", "Fitnessstudio"]])) +
        q("Machst Du Sport im Verein?", "", chips("club", [["nein", "Nein"], ["ja", "Ja"]])) +
        (prefs.club.on ? q("An welchen Tagen?", "", dayChips("club_days", true)) +
          '<input class="gob__input" data-gob-sport maxlength="40" placeholder="Welcher Sport? (z. B. Fußball)" value="' + esc(prefs.club.sport) + '" />' : ""),
        "Weiter", { form: true, later: "Überspringen" });
      return;
    }
    if (step === 2) {
      var sp = global.GoPlanRules ? GoPlanRules.steps(prefs) : null;
      shell("Dein Alltag", "Bewegung im Alltag zählt mit.",
        q("Fährst Du Fahrrad?", "Zum Beispiel zur Arbeit oder zum Einkaufen.", chips("bike", [["nie", "Selten oder nie"], ["manchmal", "Ab und zu"], ["taeglich", "Fast täglich"]])) +
        q("Gehst Du viel spazieren?", "", chips("walk", [["selten", "Selten"], ["manchmal", "Ab und zu"], ["viel", "Viel"]])) +
        q("Wie viele Schritte schaffst Du an einem normalen Tag?", "", chips("steps", [["<4000", "unter 4.000"], ["4000-6000", "4.000 bis 6.000"], ["6000-8000", "6.000 bis 8.000"], ["8000+", "über 8.000"], ["?", "weiß nicht"]])) +
        q("Möchtest Du eine Morgenroutine?", "5 bis 10 Minuten Beweglichkeit nach dem Aufstehen.", chips("morning", [["ja", "Ja, gern"], ["nein", "Nein"]])) +
        (sp && (prefs.steps || prefs.walk) ? '<p class="gob__sum">Dein Schrittziel zum Start: <b>' + fmt(sp.start) + "</b> am Tag, langsam steigern bis " + fmt(sp.target) + "." +
          (sp.bike ? " Radfahren zählt mit: 1 Minute zügig ≈ " + sp.perMinute + " Schritte, bei Dir etwa " + fmt(sp.bike) + "." : "") + "</p>" : ""),
        "Weiter", { form: true, later: "Überspringen" });
      return;
    }
    shell("Dein erster Wochenplan", "Wähl einen Plan, der zu Deinem Ziel passt. Deine Woche füllt sich dann von selbst." +
      (prefs.fixed_day != null ? " Die Kraft-Einheiten verteilen wir um Deinen festen Termin am " + (global.GoPlanRules ? GoPlanRules.DAYS_LONG[prefs.fixed_day] : DAYS[prefs.fixed_day]) + "." : ""),
      "", "Wochenplan wählen", { later: "Erst mal umsehen" });
  }

  function fmt(n) { return Number(n || 0).toLocaleString("de-DE"); }
  function q(title, sub, inner) {
    return '<p class="gob__q">' + esc(title) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</p>" + inner;
  }
  function chipOn(key, val) {
    if (key === "club") return (val === "ja") === !!prefs.club.on && (prefs.club.on || prefs.club.answered);
    if (key === "morning") return prefs.morning != null && (val === "ja") === prefs.morning;
    return prefs[key] === val;
  }
  function chips(key, opts) {
    return '<div class="gob__chips">' + opts.map(function (o) {
      return '<button type="button" class="gob__chip' + (chipOn(key, o[0]) ? " is-on" : "") + '" data-gob-pick="' + key + '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + "</button>";
    }).join("") + "</div>";
  }
  function dayChips(key, multi) {
    return '<div class="gob__chips gob__chips--days">' + DAYS.map(function (d, i) {
      var on = multi ? prefs.club.days.indexOf(i) >= 0 : prefs.fixed_day === i;
      return '<button type="button" class="gob__chip' + (on ? " is-on" : "") + '" data-gob-pick="' + key + '" data-v="' + i + '">' + d + "</button>";
    }).join("") + "</div>";
  }
  function pick(key, v) {
    if (key === "fixed_day") prefs.fixed_day = prefs.fixed_day === Number(v) ? null : Number(v);
    else if (key === "club_days") {
      var i = Number(v), at = prefs.club.days.indexOf(i);
      if (at >= 0) prefs.club.days.splice(at, 1); else prefs.club.days.push(i);
      prefs.club.days.sort();
    } else if (key === "club") { prefs.club.on = v === "ja"; prefs.club.answered = true; if (!prefs.club.on) prefs.club.days = []; }
    else if (key === "morning") prefs.morning = v === "ja";
    else prefs[key] = prefs[key] === v ? "" : v;
    var keepTop = root.querySelector(".gob__body") ? root.querySelector(".gob__body").scrollTop : 0;
    paint();
    var b = root.querySelector(".gob__body");
    if (b) b.scrollTop = keepTop;
  }
  function savePrefs() {
    var a = host.account();
    if (!a || !a.id) return;
    var sportEl = root && root.querySelector("[data-gob-sport]");
    if (sportEl) prefs.club.sport = String(sportEl.value || "").trim().slice(0, 40);
    var body = { kraft: prefs.kraft || null, fixed_day: prefs.fixed_day, place: prefs.place || null,
      club: { on: !!prefs.club.on, days: prefs.club.days.slice(), sport: prefs.club.sport || "" },
      bike: prefs.bike || null, walk: prefs.walk || null, steps: prefs.steps || null, morning: prefs.morning, at: new Date().toISOString() };
    if (global.GoPlanRules) body.step_goal = GoPlanRules.steps(body);
    host.rest("go_accounts?id=eq." + encodeURIComponent(a.id), { method: "PATCH", prefer: "return=minimal", body: { training_prefs: body } }).catch(function () {});
    try { a.training_prefs = body; } catch (e) {}
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
    var pk = e.target.closest("[data-gob-pick]");
    if (pk) { var se = root.querySelector("[data-gob-sport]"); if (se) prefs.club.sport = se.value; pick(pk.getAttribute("data-gob-pick"), pk.getAttribute("data-v")); return; }
    var t = e.target.closest("[data-gob-next],[data-gob-later]");
    if (!t) return;
    /* Fragen überspringen: weiter zum nächsten Schritt, nicht ganz raus */
    if (t.hasAttribute("data-gob-later") && step === 1) { var sIn2 = root.querySelector("[data-gob-sport]"); if (sIn2) prefs.club.sport = String(sIn2.value || "").trim().slice(0, 40); }
    if (t.hasAttribute("data-gob-later") && (step === 1 || step === 2)) { if (step === 2) savePrefs(); next(); return; }
    if (t.hasAttribute("data-gob-later")) { finish(); return; }
    if (step === 0) { saveConsent(); next(); homeHint(); return; }
    if (step === 1) { var sIn = root.querySelector("[data-gob-sport]"); if (sIn) prefs.club.sport = String(sIn.value || "").trim().slice(0, 40); next(); return; }
    if (step === 2) { savePrefs(); next(); return; }
    if (step === 3) {
      finish();
      setTimeout(function () { if (host.openPlan) host.openPlan(); }, 0);
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
