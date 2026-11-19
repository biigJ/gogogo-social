/* plan-picker.js — Wochenplan wählen: Ziel → Karten → Tage schieben → anwenden
 *
 *   GoPlanPicker.open({
 *     host: { rest, me, toast },
 *     mode: "self" | "coach",      self: nur öffentliche Pläne, vorher Ziel-Frage; coach: alle Pläne
 *     userId, userName,            für wen (coach: Coachee)
 *     onDone(result),              nach dem Anwenden
 *   „Individuell“ (nur self): Coach wählen, Nachricht (200 Zeichen), Einverständnis → rpc/go_request_coach
 *     arrange: { courseId, weekdays, weeks }   direkt „Tage schieben“ für den laufenden Plan
 *   })
 *   GoPlanPicker.view({ host, courseId, exercisesOf(session) })   Plan nur ansehen, mit Übungen je Einheit
 *
 * Anwenden: rpc/go_apply_plan (go-wochenplan-wahl.sql) beendet alte Pläne, entfernt offene Termine ab heute
 * und erzeugt die neuen ab heute. Zurück oben links schließt die Ansicht, man landet wieder dort,
 * wo man hereingekommen ist (Woche oder Selbst Coaching).
 */
(function (global) {
  "use strict";

  var GOALS = [
    { key: "laufen", label: "Gesund laufen", sub: "ohne Knie- und Rückenschmerzen" },
    { key: "ruecken", label: "Rücken stärken", sub: "weniger Rückenschmerzen" },
    { key: "gesund", label: "Gesund bleiben", sub: "fit für den Alltag" },
    { key: "abnehmen", label: "Abnehmen", sub: "durch mehr Bewegung" },
    { key: "muskeln", label: "Muskeln erhalten", sub: "stark bleiben mit den Jahren" },
    { key: "gelenke", label: "Gelenke schonen", sub: "Knie, Hüfte, Schulter" }
  ];
  var DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  var CAT = { kraft: "Kraft", ausdauer: "Ausdauer", zirkel: "Zirkel", alternative: "Bewegung", spontan: "Spontan" };

  var st = null;

  var CSS =
    ".gpl{position:fixed;inset:0;z-index:9800;background:#F3EEE4;color:#2A2118;display:flex;flex-direction:column;overflow:hidden}" +
    ".gpl__bar{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;padding:max(10px,env(safe-area-inset-top)) 8px 6px}" +
    ".gpl__bar h2{margin:0;text-align:center;font:600 24px/1.15 'Playfair Display',Georgia,serif}" +
    ".gpl__back{width:44px;height:44px;border:0;background:transparent;color:inherit;display:grid;place-items:center;padding:0;cursor:pointer}" +
    ".gpl__body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:6px 16px calc(28px + env(safe-area-inset-bottom))}" +
    ".gpl__lead{margin:4px 0 14px;font-size:15px;line-height:1.4}" +
    ".gpl__goal{display:flex;align-items:center;gap:12px;width:100%;text-align:left;margin:0 0 8px;padding:12px 14px;border-radius:14px;border:1.5px solid rgba(42,33,24,.2);background:#F6F1E8;color:inherit;font:inherit;cursor:pointer}" +
    ".gpl__goal b{display:block;font-size:16px}.gpl__goal small{display:block;font-size:13px;color:rgba(42,33,24,.65)}" +
    ".gpl__goal.is-on{border-color:#2A2118;background:#2A2118;color:#F6F1E8}.gpl__goal.is-on small{color:rgba(246,241,232,.75)}" +
    ".gpl__tick{flex:none;width:22px;height:22px;border-radius:50%;border:1.5px solid currentColor;display:grid;place-items:center;font-size:13px}" +
    ".gpl__btn{display:block;width:100%;min-height:50px;margin:12px 0 0;border:0;border-radius:999px;background:#2A2118;color:#F6F1E8;font:inherit;font-size:16px;font-weight:700;cursor:pointer}" +
    ".gpl__btn--quiet{background:transparent;color:#2A2118;border:1.5px solid #2A2118}" +
    ".gpl__btn:disabled{opacity:.4}" +
    ".gpl__rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:4px 16px 12px;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}" +
    ".gpl__card{flex:0 0 82%;scroll-snap-align:center;background:#F6F1E8;border-radius:18px;overflow:hidden;border:1px solid rgba(42,33,24,.12);display:flex;flex-direction:column}" +
    ".gpl__art{position:relative;aspect-ratio:5/3;background:#E4DDD0;overflow:hidden}" +
    ".gpl__art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
    ".gpl__play{position:absolute;right:10px;bottom:10px;min-height:34px;padding:0 12px;border-radius:999px;border:0;background:rgba(0,0,0,.65);color:#fff;font:inherit;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;cursor:pointer}" +
    ".gpl__cbody{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1}" +
    ".gpl__cbody h3{margin:0;font:600 21px/1.2 'Playfair Display',Georgia,serif;overflow-wrap:anywhere}" +
    ".gpl__meta{font-size:13px;color:rgba(42,33,24,.7)}" +
    ".gpl__days{margin:4px 0 0;padding:0;list-style:none;font-size:13px;line-height:1.5}" +
    ".gpl__days b{display:inline-block;width:32px}" +
    "body.gpl-open .app-pill{display:none !important}" +
    ".gpl__cbody .gpl__btn{margin-top:auto}" +
    ".gpl__empty{padding:24px 4px;font-size:15px;color:rgba(42,33,24,.7)}" +
    ".gpl .gpl__row{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:center;margin:0 0 8px;padding:0;border:0;border-radius:0;background:none;box-shadow:none}" +
    ".gpl__row>b{font-size:15px}" +
    ".gpl__slot{min-height:52px;border-radius:12px;border:1.5px dashed rgba(42,33,24,.25);display:flex}" +
    ".gpl__chip{flex:1;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:11px;background:#F6F1E8;border:1.5px solid rgba(42,33,24,.18);cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}" +
    ".gpl__chip small{display:block;font-size:12px;color:rgba(42,33,24,.6)}" +
    ".gpl__chip.is-picked{border-color:#2A2118;box-shadow:0 0 0 2px #2A2118}" +
    ".gpl__chip.is-drag{opacity:.35}" +
    ".gpl__ghost{position:fixed;z-index:9810;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:.95}" +
    ".gpl__grip{flex:none;width:18px;color:rgba(42,33,24,.45)}" +
    ".gpl__indiv-h{margin:4px 0 10px;text-align:center;font:600 30px/1.15 'Playfair Display',Georgia,serif}" +
    ".gpl__with{display:flex;align-items:center;justify-content:center;gap:10px;font-size:17px}" +
    ".gpl__select{min-height:44px;padding:0 16px;border-radius:12px;border:1.5px solid #2A2118;background:#fff;color:#2A2118;font:inherit;font-weight:700;cursor:pointer}" +
    ".gpl__stars{display:flex;justify-content:center;gap:6px;margin:14px 0 8px}" +
    ".gpl__star{width:38px;height:38px;color:rgba(42,33,24,.25)}.gpl__star.is-on{color:#2A2118}.gpl__star svg{width:100%;height:100%}" +
    ".gpl__about{margin:0 auto 14px;max-width:34ch;text-align:center;font-size:15px;line-height:1.45;color:rgba(42,33,24,.8)}" +
    ".gpl__field{display:grid;gap:4px;margin:0 0 10px}.gpl__field textarea{width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1.5px solid rgba(42,33,24,.25);background:#fff;font:inherit;font-size:16px;resize:none}" +
    ".gpl__field small{justify-self:end;color:rgba(42,33,24,.55);font-size:12px}" +
    ".gpl__vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}" +
    ".gpl__check{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;margin:0 0 8px;font-size:14px}.gpl__check input{width:20px;height:20px;margin:1px 0 0;accent-color:#2A2118}" +
    ".gpl__vday{margin:0 0 8px;border-radius:14px;background:#F6F1E8;border:1px solid rgba(42,33,24,.14);overflow:hidden}" +
    ".gpl__vday summary{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:center;padding:12px 14px;list-style:none;cursor:pointer}" +
    ".gpl__vday summary::-webkit-details-marker{display:none}" +
    ".gpl__vday summary span{font-size:15px;font-weight:600}.gpl__vday summary small{display:block;font-size:12px;font-weight:500;color:rgba(42,33,24,.6)}" +
    ".gpl__vlist{margin:0;padding:0 14px 12px 58px;font-size:14px;line-height:1.6}.gpl__vlist small{color:rgba(42,33,24,.6)}" +
    ".gpl__own{display:block;width:100%;box-sizing:border-box;min-height:50px;margin:0 0 4px;padding:0 14px;border-radius:14px;border:1.5px solid rgba(42,33,24,.2);background:#F6F1E8;color:#2A2118;font:inherit;font-size:16px}" +
    ".gpl__link{display:block;margin:14px auto 0;border:0;background:transparent;color:#2A2118;text-decoration:underline;font:inherit;font-size:14px;cursor:pointer}" +
    "@media (min-width:900px){.gpl__body{max-width:980px;margin:0 auto;width:100%}.gpl__card{flex-basis:320px}}";

  function ensureCss() {
    if (document.getElementById("gpl-css")) return;
    var s = document.createElement("style");
    s.id = "gpl-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function days(c) {
    return (c.course_sessions || [])
      .filter(function (s) { return s.block_no === 1 && !s.is_travel; })
      .sort(function (a, b) { return a.session_no - b.session_no; });
  }

  function mixText(c) {
    var n = {};
    days(c).forEach(function (s) { var k = s.category || "kraft"; n[k] = (n[k] || 0) + 1; });
    return ["kraft", "ausdauer", "zirkel", "alternative"].filter(function (k) { return n[k]; })
      .map(function (k) { return n[k] + "× " + CAT[k]; }).join(" · ");
  }

  function coverOf(c) {
    if (c.image_url) return c.image_url;
    var first = days(c).filter(function (s) { return s.category !== "alternative"; })[0];
    return global.GoCovers ? GoCovers.url(null, first ? first.category : "kraft") : "";
  }

  function thumbOf(url) {
    var m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    return m ? "https://img.youtube.com/vi/" + m[1] + "/hqdefault.jpg" : "";
  }

  var PLAN_SEL = "id,title,level,description,image_url,is_active,private_for,course_sessions!course_sessions_course_id_fkey(session_no,block_no,is_travel,category,title,unit_course_id)";
  function load() {
    var sel = PLAN_SEL;
    var extra = ",is_public,goals,preview_url";
    var q = "courses?is_active=eq.true&private_for=is.null&order=title.asc,level.asc&limit=300&select=";
    return st.host.rest(q + sel + extra)
      .then(function (rows) { st.newCols = true; return rows; })
      .catch(function () { st.newCols = false; return st.host.rest(q + sel); })
      .then(function (rows) {
        st.plans = (rows || []).filter(function (c) {
          if (days(c).length < 2) return false;
          if (st.mode === "self" && st.newCols && !c.is_public) return false;
          if (st.mode === "self" && !st.newCols) return false;
          return true;
        });
      });
  }

  /* Vorabfrage = Profilziel: erstes gewähltes Ziel landet in go_accounts.training_goal (nur eigener Account) */
  function saveGoalToProfile() {
    var own = String(st.ownGoal || "").trim();
    if (st.mode !== "self" || (!st.goals.length && !own) || !st.host.me) return;
    /* eigenes Ziel (Freitext) geht vor */
    var g = own ? { label: own } : GOALS.filter(function (x) { return x.key === st.goals[0]; })[0];
    var me = st.host.me();
    if (!g || !me) return;
    st.host.rest("go_accounts?id=eq." + encodeURIComponent(me), { method: "PATCH", prefer: "return=minimal", body: { training_goal: g.label } })
      .then(function () {
        try {
          if (global.GoAccountSession) {
            var acc = GoAccountSession.load();
            if (acc) { acc.training_goal = g.label; GoAccountSession.save(acc); }
          }
        } catch (e) {}
      })
      .catch(function () {});
  }

  /* ---------- Schritte ---------- */
  function paintGoals() {
    st.step = "goals";
    st.title.textContent = "Dein Ziel";
    st.body.innerHTML =
      '<p class="gpl__lead">Was ist wichtig? Mehrauswahl möglich.</p>' +
      GOALS.map(function (g) {
        var on = st.goals.indexOf(g.key) !== -1;
        return '<button type="button" class="gpl__goal' + (on ? " is-on" : "") + '" data-gpp-goal="' + g.key + '">' +
          '<span class="gpl__tick">' + (on ? "✓" : "") + "</span><span><b>" + esc(g.label) + "</b><small>" + esc(g.sub) + "</small></span></button>";
      }).join("") +
      '<input type="text" class="gpl__own" id="gpl-own-goal" maxlength="60" placeholder="Oder eigenes Ziel eingeben" value="' + esc(st.ownGoal || "") + '" />' +
      '<button type="button" class="gpl__btn" data-gpp-next>' + (st.goals.length ? "Passende Pläne zeigen" : "Alle Pläne zeigen") + "</button>" +
      (st.mode === "self" ? '<button type="button" class="gpl__btn gpl__btn--quiet" data-gpp-indiv>Individuell</button>' : "");
  }

  /* ---------- Individuell: Coach anfragen ---------- */
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.15 6.38 20.1l1.07-6.27L2.9 9.4l6.3-.9z"/></svg>';
  var JOSCHA = "2d3ab029-0a5f-4388-8da7-52501a87dc8c";
  var COACH_TEXT = {};
  COACH_TEXT[JOSCHA] = "Mann mit einer ganzheitlichen Herangehensweise und Entwickler dieser App mit Hingabe und Interesse an Deiner Herausforderung und konkreten Zielen.";

  function loadCoaches() {
    if (st.coaches) return Promise.resolve(st.coaches);
    return st.host.rest("go_accounts?is_trainer=eq.true&select=id,name,nickname,about_me&order=name.asc&limit=50")
      .catch(function () { return []; })
      .then(function (rows) {
        /* auch der eigene Account bleibt drin (Joscha testet als Coach); Joscha immer dabei */
        st.coaches = (rows || []).slice();
        if (!st.coaches.some(function (c) { return String(c.id) === JOSCHA; })) {
          st.coaches.unshift({ id: JOSCHA, name: "Joscha" });
        }
        var ids = st.coaches.map(function (c) { return c.id; });
        return st.host.rest("go_coach_reviews?coach_id=in.(" + ids.map(encodeURIComponent).join(",") + ")&select=coach_id,stars")
          .catch(function () { return []; })
          .then(function (rv) {
            var sum = {}, n = {};
            (rv || []).forEach(function (r) { sum[r.coach_id] = (sum[r.coach_id] || 0) + r.stars; n[r.coach_id] = (n[r.coach_id] || 0) + 1; });
            st.coaches.forEach(function (c) { c.avg = n[c.id] ? sum[c.id] / n[c.id] : 0; c.count = n[c.id] || 0; });
            return st.coaches;
          });
      });
  }

  function paintIndividual() {
    st.step = "indiv";
    st.title.textContent = "";
    st.body.innerHTML = '<p class="gpl__empty">Lade …</p>';
    loadCoaches().then(function (list) {
      if (st.step !== "indiv") return;
      if (!st.coach) st.coach = list.filter(function (c) { return String(c.id) === JOSCHA; })[0] || list[0] || null;
      var c = st.coach;
      var first = c ? String(c.name || c.nickname || "").split(" ")[0] : "";
      var avg = c ? Math.round(c.avg || 0) : 0;
      var text = c ? (COACH_TEXT[String(c.id)] || c.about_me || "") : "";
      st.body.innerHTML =
        '<h2 class="gpl__indiv-h">Direkt rein</h2>' +
        '<div class="gpl__with"><span>mit</span><button type="button" class="gpl__select" data-gpp-coach>' + esc(first || "Coach wählen") + ' <span aria-hidden="true">▾</span></button></div>' +
        '<div class="gpl__stars" aria-label="' + (c && c.count ? (c.avg.toFixed(1) + " von 5 Sternen") : "Noch keine Bewertung") + '">' +
        [1, 2, 3, 4, 5].map(function (n) { return '<span class="gpl__star' + (n <= avg ? " is-on" : "") + '">' + STAR + "</span>"; }).join("") + "</div>" +
        (text ? '<p class="gpl__about">' + esc(text) + "</p>" : "") +
        '<label class="gpl__field"><span class="gpl__vh">Nachricht</span><textarea id="gpl-msg" maxlength="200" rows="4" placeholder="Schreib Deine Nachricht"></textarea><small id="gpl-count">0 / 200</small></label>' +
        '<label class="gpl__check"><input type="checkbox" id="gpl-wa" checked /> <span>' + esc(first || "Der Coach") + ' darf sich per WhatsApp bei mir melden.</span></label>' +
        '<label class="gpl__check"><input type="checkbox" id="gpl-plan" checked /> <span>' + esc(first || "Der Coach") + ' erstellt mir einen Plan und schreibt mir unter Aktuell.</span></label>' +
        '<button type="button" class="gpl__btn" data-gpp-send' + (c ? "" : " disabled") + ">Senden</button>";
      var ta = document.getElementById("gpl-msg");
      ta.addEventListener("input", function () { document.getElementById("gpl-count").textContent = ta.value.length + " / 200"; });
    });
  }

  function chooseCoach() {
    var list = st.coaches || [];
    if (!global.GoDialog) return;
    GoDialog.choose("Coach wählen", list.map(function (c) {
      return { label: String(c.name || c.nickname || "Coach").split(" ")[0] + (c.count ? " · " + c.avg.toFixed(1) + " ★" : ""), value: String(c.id) };
    })).then(function (id) {
      if (!id) return;
      st.coach = list.filter(function (c) { return String(c.id) === id; })[0] || st.coach;
      paintIndividual();
    });
  }

  function sendIndividual(btn) {
    var c = st.coach;
    if (!c) return;
    var msg = (document.getElementById("gpl-msg") || {}).value || "";
    var wa = !!(document.getElementById("gpl-wa") || {}).checked;
    var plan = !!(document.getElementById("gpl-plan") || {}).checked;
    if (!wa && !plan) {
      var note = btn.parentNode.querySelector(".gpl__err") || document.createElement("p");
      note.className = "gpl__empty gpl__err";
      note.textContent = "Wähl mindestens eins: WhatsApp oder Plan.";
      btn.insertAdjacentElement("afterend", note);
      return;
    }
    btn.disabled = true;
    st.host.rest("rpc/go_request_coach", {
      method: "POST",
      body: { p_coach: c.id, p_message: msg.slice(0, 200), p_whatsapp: wa, p_plan: plan }
    }).then(function () {
      /* Mail an den Coach (web3forms geht an die gogogo-Adresse) */
      st.host.rest("go_accounts?id=eq." + encodeURIComponent(st.userId) + "&select=name,phone").catch(function () { return []; }).then(function (rows) {
      var meRow = (rows && rows[0]) || {};
      try {
        var fd = new FormData();
        fd.append("access_key", "3ffad713-3ad6-491b-bf99-185a87b0d706");
        fd.append("subject", "gogogo: Neuer Coachee für " + (c.name || "Coach"));
        fd.append("from_name", "gogogo App");
        fd.append("message", "Coach: " + (c.name || "") + "\nNeuer Coachee: " + (meRow.name || "") + (wa && meRow.phone ? " (" + meRow.phone + ")" : "") +
          "\nWhatsApp ok: " + (wa ? "ja" : "nein") + "\nPlan + Nachricht unter Aktuell: " + (plan ? "ja" : "nein") +
          "\n\nNachricht:\n" + msg + "\n\nIn der App: Team → Meine Coachees.");
        fetch("https://api.web3forms.com/submit", { method: "POST", body: fd }).catch(function () {});
      } catch (eM) {}
      });
      var first = String(c.name || c.nickname || "Dein Coach").split(" ")[0];
      var done = st.onDone;
      close();
      if (global.GoDialog) GoDialog.alert(first + " meldet sich bei Dir.");
      if (done) done({ coach: c.id });
    }).catch(function (err) {
      btn.disabled = false;
      var m = String((err && err.message) || "");
      var note = btn.parentNode.querySelector(".gpl__err") || document.createElement("p");
      note.className = "gpl__empty gpl__err";
      note.textContent = /go_request_coach|function/.test(m) ? "go-coach-request.sql fehlt noch in Supabase." : "Senden hat nicht geklappt.";
      btn.insertAdjacentElement("afterend", note);
    });
  }

  function paintList() {
    st.step = "list";
    st.title.textContent = "Wochenpläne";
    var list = (st.plans || []).slice();
    if (st.goals.length) {
      list = list.filter(function (c) {
        return (c.goals || []).some(function (g) { return st.goals.indexOf(g) !== -1; });
      });
    }
    list.sort(function (a, b) { return (a.level || 9) - (b.level || 9) || String(a.title).localeCompare(String(b.title), "de"); });
    var lead = st.mode === "coach"
      ? "Für " + esc(st.userName || "Coachee") + ": Plan wählen, dann die Tage schieben."
      : st.goals.length ? "Passend zu Deinem Ziel. Wischen, dann „Anwenden“." : "Wischen, dann „Anwenden“.";
    if (!list.length) {
      st.body.innerHTML = '<p class="gpl__empty">' +
        (st.newCols === false ? "Noch keine Pläne freigegeben (go-wochenplan-wahl.sql ausführen)." :
          st.goals.length ? "Zu diesem Ziel gibt es noch keinen Plan." : "Noch keine Pläne freigegeben.") + "</p>" +
        (st.mode === "self" ? '<button type="button" class="gpl__btn gpl__btn--quiet" data-gpp-goals>Ziel ändern</button>' : "");
      return;
    }
    st.body.innerHTML = '<p class="gpl__lead">' + lead + "</p>" +
      '<div class="gpl__rail">' + list.map(function (c) {
        var thumb = thumbOf(c.preview_url);
        var img = thumb || coverOf(c);
        return '<article class="gpl__card">' +
          '<div class="gpl__art">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" />' : "") +
          (c.preview_url ? '<button type="button" class="gpl__play" data-gpp-play="' + esc(c.id) + '">▶ Video</button>' : "") +
          "</div>" +
          '<div class="gpl__cbody"><h3>' + esc(c.title) + "</h3>" +
          '<span class="gpl__meta">' + (c.level ? "Level " + c.level + " · " : "") + esc(mixText(c)) + "</span>" +
          '<ul class="gpl__days">' + days(c).map(function (s) {
            return "<li><b>" + DAYS[s.session_no - 1] + "</b>" + esc(s.title) + "</li>";
          }).join("") + "</ul>" +
          '<button type="button" class="gpl__btn" data-gpp-apply="' + esc(c.id) + '">' + (st.onPick ? "Auswählen" : "Anwenden") + "</button></div></article>";
      }).join("") + "</div>" +
      (st.mode === "coach" ? '<button type="button" class="gpl__btn gpl__btn--quiet" data-gpp-close>Abbrechen</button>' : "") +
      (st.mode === "self" ? '<button type="button" class="gpl__link" data-gpp-goals>Ziel ändern</button>' : "");
  }

  function startArrange(id, weekdays) {
    var c = (st.plans || []).filter(function (p) { return String(p.id) === String(id); })[0];
    if (!c) return;
    var ds = days(c);
    if (weekdays && weekdays.length === ds.length) {
      /* laufender Plan: aktuelle Wochentage übernehmen */
      var cur = [null, null, null, null, null, null, null];
      weekdays.forEach(function (wd, i) { if (wd >= 0 && wd < 7 && cur[wd] == null) cur[wd] = i; });
      if (cur.filter(function (x) { return x != null; }).length === ds.length) {
        st.arr = { plan: c, ds: ds, order: cur, picked: null };
        paintArrange();
        return;
      }
    }
    /* order[weekday] = Index in ds. Start: Reihenfolge des Plans, Zirkel auf Freitag */
    var order = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return i < ds.length ? i : null; });
    var zi = ds.findIndex(function (s) { return s.category === "zirkel"; });
    if (zi !== -1 && zi !== 4) {
      var pos = order.indexOf(zi);
      var tmp = order[4];
      order[4] = zi;
      order[pos] = tmp;
    }
    st.arr = { plan: c, ds: ds, order: order, picked: null };
    paintArrange();
  }

  function paintArrange() {
    st.step = "arrange";
    st.title.textContent = "Tage schieben";
    var a = st.arr;
    st.body.innerHTML =
      '<p class="gpl__lead"><b>' + esc(a.plan.title) + "</b>" + (a.plan.level ? " · Level " + a.plan.level : "") +
      "<br>Zieh die Einheiten auf den passenden Tag. Oder tipp zwei an, dann tauschen sie.</p>" +
      DAYS.map(function (d, wd) {
        var i = a.order[wd];
        var s = i == null ? null : a.ds[i];
        return '<div class="gpl__row"><b>' + d + '</b><div class="gpl__slot" data-gpp-slot="' + wd + '">' +
          (s ? '<div class="gpl__chip' + (a.picked === wd ? " is-picked" : "") + '" data-gpp-chip="' + wd + '">' +
            '<svg class="gpl__grip" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>' +
            "<span>" + esc(s.title) + "<small>" + esc(CAT[s.category] || s.category || "") + "</small></span></div>" : "") +
          "</div></div>";
      }).join("") +
      '<button type="button" class="gpl__btn" data-gpp-confirm>' + (st.arrangeOnly ? "Speichern" : st.mode === "coach" ? "Zuordnen" : "Übernehmen") + "</button>" +
      (st.arrangeOnly ? "" : '<button type="button" class="gpl__link" data-gpp-back-list>Anderen Plan wählen</button>');
  }

  function swap(a, b) {
    if (a === b || a == null || b == null) return;
    var o = st.arr.order;
    var t = o[a];
    o[a] = o[b];
    o[b] = t;
  }

  function confirmApply(btn) {
    var a = st.arr;
    var weekdays = a.ds.map(function (s, i) { return a.order.indexOf(i); });
    if (weekdays.length !== 7 || weekdays.some(function (w) { return w < 0; })) {
      if (st.host.toast) st.host.toast("Der Plan braucht 7 Tage.");
      return;
    }
    btn.disabled = true;
    st.host.rest("rpc/go_apply_plan", {
      method: "POST",
      body: st.weeks ? { p_user: st.userId, p_course: a.plan.id, p_weekdays: weekdays, p_weeks: st.weeks } : { p_user: st.userId, p_course: a.plan.id, p_weekdays: weekdays }
    }).then(function (res) {
      var r = res || {};
      if (st.host.toast) st.host.toast((r.events || 0) + " Termine ab heute eingetragen");
      var done = st.onDone;
      close();
      if (done) done(r);
    }).catch(function (err) {
      btn.disabled = false;
      var m = String((err && err.message) || "");
      var msg = /go_apply_plan|function/.test(m) ? "go-wochenplan-wahl.sql fehlt noch in Supabase." : /not public/.test(m) ? "Dieser Plan ist nicht freigegeben." : "Anwenden hat nicht geklappt.";
      var note = btn.parentNode.querySelector(".gpl__err") || document.createElement("p");
      note.className = "gpl__empty gpl__err";
      note.textContent = msg;
      btn.insertAdjacentElement("afterend", note);
    });
  }

  /* ---------- Ziehen (Pointer) ---------- */
  function bindDrag(root) {
    var drag = null;
    root.addEventListener("pointerdown", function (e) {
      var chip = e.target.closest("[data-gpp-chip]");
      if (!chip || st.step !== "arrange") return;
      var r = chip.getBoundingClientRect();
      drag = { from: Number(chip.getAttribute("data-gpp-chip")), chip: chip, x0: e.clientX, y0: e.clientY, dy: e.clientY - r.top, moved: false, ghost: null, w: r.width, left: r.left };
      try { chip.setPointerCapture(e.pointerId); } catch (eC) {}
    });
    root.addEventListener("pointermove", function (e) {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientY - drag.y0) + Math.abs(e.clientX - drag.x0) < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.ghost = drag.chip.cloneNode(true);
        drag.ghost.classList.add("gpl__ghost");
        drag.ghost.style.width = drag.w + "px";
        drag.ghost.style.left = drag.left + "px";
        document.body.appendChild(drag.ghost);
        drag.chip.classList.add("is-drag");
      }
      drag.ghost.style.top = (e.clientY - drag.dy) + "px";
    });
    function end(e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (d.ghost) d.ghost.remove();
      if (!d.moved) return; /* Tipp: über click */
      d.chip.classList.remove("is-drag");
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var slot = el && el.closest ? el.closest("[data-gpp-slot]") : null;
      if (slot) swap(d.from, Number(slot.getAttribute("data-gpp-slot")));
      st.arr.picked = null;
      st.suppressClick = true;
      setTimeout(function () { if (st) st.suppressClick = false; }, 0);
      paintArrange();
    }
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", function () {
      if (drag && drag.ghost) drag.ghost.remove();
      if (drag) drag.chip.classList.remove("is-drag");
      drag = null;
    });
  }

  function onClick(e) {
    if (st.suppressClick) { st.suppressClick = false; return; }
    var t = e.target;
    if (t.closest("[data-gpp-close]")) return back();
    var g = t.closest("[data-gpp-goal]");
    if (g) {
      var ownIn = st.root.querySelector("#gpl-own-goal");
      if (ownIn) st.ownGoal = ownIn.value;
      var k = g.getAttribute("data-gpp-goal");
      var i = st.goals.indexOf(k);
      if (i === -1) st.goals.push(k); else st.goals.splice(i, 1);
      return paintGoals();
    }
    if (t.closest("[data-gpp-next]")) {
      var ownEl = st.root.querySelector("#gpl-own-goal");
      if (ownEl) st.ownGoal = ownEl.value;
      saveGoalToProfile();
      return paintList();
    }
    if (t.closest("[data-gpp-goals]")) return paintGoals();
    if (t.closest("[data-gpp-indiv]")) return paintIndividual();
    if (t.closest("[data-gpp-coach]")) return chooseCoach();
    var send = t.closest("[data-gpp-send]");
    if (send) return sendIndividual(send);
    var play = t.closest("[data-gpp-play]");
    if (play) {
      var c = (st.plans || []).filter(function (p) { return String(p.id) === play.getAttribute("data-gpp-play"); })[0];
      if (c && global.GoExMedia && GoExMedia.open) GoExMedia.open(c.title, c.preview_url);
      else if (c) global.open(c.preview_url, "_blank", "noopener");
      return;
    }
    var ap = t.closest("[data-gpp-apply]");
    if (ap) {
      /* Nur auswählen (Coach-Portal: Feld „Wochenplan“): Plan zurückgeben, nichts anlegen */
      if (st.onPick) { var cb = st.onPick, pid = ap.getAttribute("data-gpp-apply"); close(); cb(pid); return; }
      return startArrange(ap.getAttribute("data-gpp-apply"));
    }
    if (t.closest("[data-gpp-back-list]")) return paintList();
    var conf = t.closest("[data-gpp-confirm]");
    if (conf) return confirmApply(conf);
    var chip = t.closest("[data-gpp-chip]");
    if (chip) {
      var wd = Number(chip.getAttribute("data-gpp-chip"));
      if (st.arr.picked == null) st.arr.picked = wd;
      else { swap(st.arr.picked, wd); st.arr.picked = null; }
      return paintArrange();
    }
    var slot = t.closest("[data-gpp-slot]");
    if (slot && st.arr && st.arr.picked != null) {
      swap(st.arr.picked, Number(slot.getAttribute("data-gpp-slot")));
      st.arr.picked = null;
      paintArrange();
    }
  }

  /* Zurück: Schritt zurück, auf der ersten Seite schließen (dann ist man wieder in Woche bzw. Selbst Coaching) */
  function back() {
    if (st.step === "arrange" && !st.arrangeOnly) return paintList();
    if (st.step === "indiv") return paintGoals();
    if (st.step === "list" && st.mode === "self") return paintGoals();
    close();
  }

  function close() {
    if (!st) return;
    if (st.root) st.root.remove();
    document.body.classList.remove("gpl-open");
    st = null;
  }

  function open(opts) {
    opts = opts || {};
    if (!opts.host || !opts.host.rest) return;
    ensureCss();
    if (st) close();
    var root = document.createElement("div");
    root.className = "gpl";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML =
      '<div class="gpl__bar"><button type="button" class="gpl__back" data-gpp-close aria-label="Zurück">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 6.5 8.2 12l6 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button><h2></h2><span></span></div>" +
      '<div class="gpl__body"><p class="gpl__empty">Lade …</p></div>';
    document.body.appendChild(root);
    document.body.classList.add("gpl-open");
    st = {
      root: root, body: root.querySelector(".gpl__body"), title: root.querySelector("h2"),
      host: opts.host, mode: opts.mode === "coach" ? "coach" : "self",
      userId: opts.userId || (opts.host.me && opts.host.me()), userName: opts.userName || "",
      onDone: opts.onDone, onEditWeek: opts.onEditWeek, onPick: opts.onPick, goals: [], plans: null, step: "load",
      arrangeOnly: !!(opts.arrange && opts.arrange.courseId), weeks: (opts.arrange && opts.arrange.weeks) || 0
    };
    st.title.textContent = "Wochenpläne";
    root.addEventListener("click", onClick);
    bindDrag(root);
    var s0 = st;
    var arr = opts.arrange;
    var ready = load();
    if (arr && arr.courseId) {
      /* privater Coachee-Plan fehlt in der Liste: einzeln nachladen */
      ready = ready.then(function () {
        if ((st.plans || []).some(function (p) { return String(p.id) === String(arr.courseId); })) return;
        return st.host.rest("courses?id=eq." + encodeURIComponent(arr.courseId) + "&select=" + PLAN_SEL)
          .then(function (rows) { if (rows && rows[0]) st.plans.push(rows[0]); });
      });
    }
    ready.then(function () {
      if (st !== s0) return;
      if (arr && arr.courseId) {
        startArrange(arr.courseId, arr.weekdays);
        if (st.step !== "arrange") st.body.innerHTML = '<p class="gpl__empty">Plan nicht gefunden.</p>';
        return;
      }
      if (st.mode === "self") paintGoals(); else paintList();
    }).catch(function () {
      if (st !== s0) return;
      st.body.innerHTML = '<p class="gpl__empty">Pläne konnten nicht geladen werden.</p>';
    });
  }

  /* ---------- Nur ansehen: Tage mit Übungen, nichts änderbar ---------- */
  function view(opts) {
    opts = opts || {};
    if (!opts.host || !opts.host.rest || !opts.courseId) return;
    ensureCss();
    if (st) close();
    var root = document.createElement("div");
    root.className = "gpl";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML =
      '<div class="gpl__bar"><button type="button" class="gpl__back" data-gpp-close aria-label="Zurück">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 6.5 8.2 12l6 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button><h2>Plan ansehen</h2><span></span></div>" +
      '<div class="gpl__body"><p class="gpl__empty">Lade …</p></div>';
    document.body.appendChild(root);
    document.body.classList.add("gpl-open");
    st = { root: root, body: root.querySelector(".gpl__body"), title: root.querySelector("h2"), host: opts.host, step: "view", mode: "view" };
    root.addEventListener("click", function (e) { if (e.target.closest("[data-gpp-close]")) close(); });
    var s0 = st;
    var plan = null;
    opts.host.rest("courses?id=eq." + encodeURIComponent(opts.courseId) + "&select=" + PLAN_SEL)
      .then(function (rows) {
        plan = rows && rows[0];
        if (!plan) throw new Error("none");
        var units = days(plan).map(function (d) { return d.unit_course_id; }).filter(Boolean);
        if (!units.length) return [];
        return opts.host.rest("course_sessions?course_id=in.(" + units.map(encodeURIComponent).join(",") +
          ")&block_no=eq.1&is_travel=eq.false&select=course_id,title,category,blocks,session_no&order=session_no.asc")
          .catch(function () { return []; });
      })
      .then(function (unitRows) {
        if (st !== s0) return;
        var byUnit = {};
        (unitRows || []).forEach(function (r) { if (!byUnit[r.course_id]) byUnit[r.course_id] = r; });
        st.title.textContent = shortTitle(plan.title);
        st.body.innerHTML = '<p class="gpl__lead">' + (plan.level ? "Level " + plan.level + " · " : "") + esc(mixText(plan)) + "</p>" +
          days(plan).map(function (d) {
            var ses = d.unit_course_id ? byUnit[d.unit_course_id] : null;
            var ex = ses && opts.exercisesOf ? (opts.exercisesOf(ses) || []) : [];
            return '<details class="gpl__vday"' + (ex.length ? "" : " disabled") + "><summary><b>" + DAYS[d.session_no - 1] + "</b><span>" + esc(d.title) +
              "<small>" + esc(CAT[d.category] || d.category || "") + (ex.length ? " · " + ex.length + (ex.length === 1 ? " Übung" : " Übungen") : "") + "</small></span></summary>" +
              (ex.length ? '<ol class="gpl__vlist">' + ex.map(function (x) {
                return "<li>" + esc(x.name || x.label || "") + (x.note ? " <small>" + esc(x.note) + "</small>" : "") + "</li>";
              }).join("") + "</ol>" : "") + "</details>";
          }).join("");
      })
      .catch(function () {
        if (st !== s0) return;
        st.body.innerHTML = '<p class="gpl__empty">Plan konnte nicht geladen werden.</p>';
      });
  }

  /* „Bulletproof Knees – Läuferkraft …“ → „Bulletproof Knees“ */
  function shortTitle(t) {
    return String(t || "").split(/\s[–—-]\s|\s·\s|:|\(/)[0].trim() || String(t || "");
  }

  global.GoPlanPicker = { open: open, close: close, view: view, shortTitle: shortTitle, GOALS: GOALS };
})(window);
