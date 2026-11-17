/* coach-reviews.js — Coach-Bewertungen (Sterne + Text), Coach-Liste mit Schnitt, „Über“-Seite, Teilen-Bild
 *
 *   GoCoachReviews.init({ rest, me, toast })
 *   GoCoachReviews.openWrite(coach)                 → Dialog: Sterne 1–5, Text, danach Teilen (Instagram / WhatsApp)
 *   GoCoachReviews.openCoachList({ currentId, onPick(coach), onSearch() })
 *   GoCoachReviews.openAbout(coach)                 → eigener Text des Coaches + Texte der Coachees
 *
 * Tabelle go_coach_reviews (go-coach-reviews.sql): eine Bewertung pro Coachee und Coach, änderbar.
 */
(function (global) {
  "use strict";

  var host = null;

  var CSS =
    ".gcr-sheet{position:fixed;inset:0;z-index:10040;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,16,12,.45)}" +
    ".gcr-card{width:min(100%,480px);max-height:90vh;overflow:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px 22px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom));font-family:Inter,system-ui,sans-serif}" +
    ".gcr-card h2{margin:0 0 4px;font-family:'Playfair Display',Georgia,serif;font-size:23px;font-weight:600;line-height:1.2;text-align:center}" +
    ".gcr-sub{margin:0 0 14px;font-size:13px;color:rgba(42,33,24,.65);text-align:center}" +
    ".gcr-stars{display:flex;justify-content:center;gap:6px;margin:6px 0 14px}" +
    ".gcr-star{width:46px;height:46px;border:0;background:transparent;padding:0;cursor:pointer;color:rgba(42,33,24,.25)}" +
    ".gcr-star.is-on{color:#2A2118}" +
    ".gcr-star svg{width:100%;height:100%}" +
    ".gcr-card textarea{display:block;width:100%;min-height:110px;box-sizing:border-box;padding:12px;border:1px solid rgba(42,33,24,.22);border-radius:14px;background:#fff;font:inherit;font-size:16px;color:#2A2118;resize:vertical}" +
    ".gcr-btn{display:block;width:100%;min-height:50px;margin:10px 0 0;border:0;border-radius:999px;background:#111;color:#fff;font:inherit;font-weight:700;font-size:16px;cursor:pointer}" +
    ".gcr-btn--ghost{background:transparent;color:#111;border:1.5px solid #111}" +
    ".gcr-row{display:flex;gap:8px}.gcr-row .gcr-btn{flex:1}" +
    ".gcr-coach{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(42,33,24,.12)}" +
    ".gcr-face{width:52px;height:52px;flex:none;border-radius:50%;object-fit:cover;background:#E6DED0;display:grid;place-items:center;font-weight:700;font-size:20px}" +
    ".gcr-coach__copy{flex:1;min-width:0}" +
    ".gcr-coach__name{font-weight:700;font-size:16px}" +
    ".gcr-mini{font-size:13px;color:rgba(42,33,24,.7)}" +
    ".gcr-mini b{color:#2A2118}" +
    ".gcr-pill{flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1.5px solid #111;background:transparent;color:#111;font:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
    ".gcr-pill.is-solid{background:#111;color:#fff}" +
    ".gcr-about-head{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:10px}" +
    ".gcr-about-head .gcr-face{width:96px;height:96px;font-size:34px}" +
    ".gcr-own{margin:6px 0 16px;font-size:15px;line-height:1.45;white-space:pre-wrap}" +
    ".gcr-h{margin:16px 0 6px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(42,33,24,.6)}" +
    ".gcr-review{padding:10px 0;border-top:1px solid rgba(42,33,24,.12)}" +
    ".gcr-review p{margin:4px 0 0;font-size:15px;line-height:1.4;white-space:pre-wrap}" +
    ".gcr-link{display:block;margin:12px auto 0;border:0;background:none;color:#2A2118;font:inherit;font-size:14px;text-decoration:underline;cursor:pointer}";

  var STAR =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.15 6.38 20.1l1.07-6.27L2.9 9.4l6.3-.9z"/></svg>';

  function ensureCss() {
    if (document.getElementById("gcr-css")) return;
    var s = document.createElement("style");
    s.id = "gcr-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function aboutText(p) {
    var a = p && p.about_me;
    if (typeof a === "string") {
      try { a = JSON.parse(a); } catch (e) { return a; }
    }
    return String((a && a.text) || "").trim();
  }

  function starsText(avg) {
    var n = Math.round(avg || 0);
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  }

  function face(p) {
    return p && p.photo_url
      ? '<img class="gcr-face" src="' + esc(p.photo_url) + '" alt="" />'
      : '<span class="gcr-face">' + esc(String((p && p.name) || "?").slice(0, 1)) + "</span>";
  }

  function sheet(html) {
    ensureCss();
    var wrap = document.createElement("div");
    wrap.className = "gcr-sheet";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = '<div class="gcr-card">' + html + "</div>";
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || (e.target.closest && e.target.closest("[data-gcr-close]"))) close();
    });
    function close() {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
    document.body.appendChild(wrap);
    return { el: wrap.firstChild, close: close };
  }

  function summaries(ids) {
    if (!ids.length) return Promise.resolve({});
    return host.rest("go_coach_reviews?coach_id=in.(" + ids.map(encodeURIComponent).join(",") + ")&select=coach_id,stars")
      .then(function (rows) {
        var out = {};
        (rows || []).forEach(function (r) {
          var o = out[r.coach_id] || (out[r.coach_id] = { sum: 0, n: 0 });
          o.sum += r.stars;
          o.n += 1;
        });
        Object.keys(out).forEach(function (k) { out[k].avg = out[k].sum / out[k].n; });
        return out;
      })
      .catch(function () { return {}; });
  }

  function summaryLine(s) {
    return s && s.n
      ? "<b>" + starsText(s.avg) + "</b> " + String(Math.round(s.avg * 10) / 10).replace(".", ",") + " · " + s.n + (s.n === 1 ? " Bewertung" : " Bewertungen")
      : "Noch keine Bewertung";
  }

  /* ---------- Bewertung schreiben ---------- */
  function openWrite(coach) {
    if (!host || !coach || !coach.id) return;
    var me = host.me();
    var sh = sheet(
      "<h2>Bewertung für " + esc(coach.name || "Deinen Coach") + "</h2>" +
        '<p class="gcr-sub">Wie ist das Training mit ' + esc(coach.name || "ihm") + "?</p>" +
        '<div class="gcr-stars">' + [1, 2, 3, 4, 5].map(function (n) {
          return '<button type="button" class="gcr-star" data-gcr-star="' + n + '" aria-label="' + n + ' Sterne">' + STAR + "</button>";
        }).join("") + "</div>" +
        '<textarea data-gcr-text placeholder="Was macht ' + esc(coach.name || "Deinen Coach") + ' besonders?" maxlength="600"></textarea>' +
        '<button type="button" class="gcr-btn" data-gcr-save>Speichern</button>' +
        '<button type="button" class="gcr-btn gcr-btn--ghost" data-gcr-close>Abbrechen</button>'
    );
    var stars = 0;
    function paint() {
      sh.el.querySelectorAll("[data-gcr-star]").forEach(function (b) {
        b.classList.toggle("is-on", +b.getAttribute("data-gcr-star") <= stars);
      });
    }
    host.rest("go_coach_reviews?coach_id=eq." + encodeURIComponent(coach.id) + "&author_id=eq." + encodeURIComponent(me) + "&select=stars,body&limit=1")
      .then(function (rows) {
        if (rows && rows[0]) {
          stars = rows[0].stars;
          sh.el.querySelector("[data-gcr-text]").value = rows[0].body || "";
          paint();
        }
      })
      .catch(function () {});
    sh.el.addEventListener("click", function (e) {
      var st = e.target.closest("[data-gcr-star]");
      if (st) {
        stars = +st.getAttribute("data-gcr-star");
        paint();
        return;
      }
      if (e.target.closest("[data-gcr-save]")) {
        var text = sh.el.querySelector("[data-gcr-text]").value.trim();
        if (!stars) {
          if (host.toast) host.toast("Bitte Sterne wählen");
          return;
        }
        host.rest("go_coach_reviews?on_conflict=coach_id,author_id", {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body: { coach_id: coach.id, author_id: me, stars: stars, body: text || null, updated_at: new Date().toISOString() }
        }).then(function () {
          showShare(sh, coach, stars, text);
        }).catch(function (err) {
          if (host.toast) host.toast(/go_coach_reviews|relation/.test(String(err && err.message)) ? "Tabelle fehlt: go-coach-reviews.sql ausführen" : "Speichern fehlgeschlagen");
        });
      }
    });
  }

  function showShare(sh, coach, stars, text) {
    sh.el.innerHTML =
      "<h2>Danke!</h2>" +
      '<p class="gcr-sub">Teil Deine Bewertung, damit andere ' + esc(coach.name || "Deinen Coach") + " finden.</p>" +
      '<div class="gcr-row"><button type="button" class="gcr-btn" data-gcr-share="instagram">Instagram</button>' +
      '<button type="button" class="gcr-btn" data-gcr-share="whatsapp">WhatsApp</button></div>' +
      '<button type="button" class="gcr-btn gcr-btn--ghost" data-gcr-close>Fertig</button>';
    sh.el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gcr-share]");
      if (!b) return;
      share(b.getAttribute("data-gcr-share"), coach, stars, text);
    });
  }

  /* ---------- Teilen-Bild: Foto des Coaches, Sterne und Text ---------- */
  function wrapLines(ctx, text, maxW, maxLines) {
    var words = String(text || "").split(/\s+/), lines = [], line = "";
    words.forEach(function (w) {
      var t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = t;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + " …";
    }
    return lines;
  }

  function loadImg(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null);
      var img = new Image();
      if (!/^data:/.test(src)) img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function shareImage(coach, stars, text) {
    var W = 1080, H = 1350;
    return loadImg(coach.photo_url).then(function (img) {
      var cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#2A2118";
      ctx.fillRect(0, 0, W, H);
      if (img) {
        var k = Math.max(W / img.width, H / img.height);
        var w = img.width * k, h = img.height * k;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      }
      var g = ctx.createLinearGradient(0, H * 0.35, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,.82)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      var y = H - 120;
      ctx.font = "500 46px Inter, system-ui, sans-serif";
      var lines = text ? wrapLines(ctx, "„" + text + "“", W - 160, 6) : [];
      y -= lines.length * 60;
      ctx.font = "88px system-ui, sans-serif";
      var full = "★★★★★".slice(0, stars), empty = "★★★★★".slice(0, 5 - stars);
      ctx.fillStyle = "#F6C54B";
      ctx.fillText(full, 80, y - 150);
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillText(empty, 80 + ctx.measureText(full).width, y - 150);
      ctx.fillStyle = "#fff";
      ctx.font = "600 64px 'Playfair Display', Georgia, serif";
      ctx.fillText(coach.name || "Mein Coach", 80, y - 50);
      ctx.font = "500 46px Inter, system-ui, sans-serif";
      lines.forEach(function (l, i) { ctx.fillText(l, 80, y + 30 + i * 60); });
      ctx.font = "700 34px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.fillText("gogogo.social", 80, H - 70);
      return new Promise(function (resolve) {
        try { cv.toBlob(function (b) { resolve(b); }, "image/jpeg", 0.9); } catch (e) { resolve(null); }
      });
    });
  }

  function share(target, coach, stars, text) {
    var caption = starsText(stars) + " " + (coach.name || "Mein Coach") + (text ? ": „" + text + "“" : "") + " · gogogo.social";
    shareImage(coach, stars, text).then(function (blob) {
      var file = blob ? new File([blob], "gogogo-bewertung.jpg", { type: "image/jpeg" }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: caption }).catch(function () {});
      }
      /* ohne Datei-Teilen: Bild speichern, WhatsApp mit Text öffnen */
      if (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "gogogo-bewertung.jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      if (target === "whatsapp") global.open("https://wa.me/?text=" + encodeURIComponent(caption), "_blank");
      else if (host.toast) host.toast("Bild gespeichert. In Instagram als Story oder Post hochladen.");
    });
  }

  /* ---------- Coach-Liste mit Sterne-Schnitt ---------- */
  function openCoachList(opts) {
    opts = opts || {};
    if (!host) return;
    var sh = sheet('<h2>Coach wählen</h2><p class="gcr-sub">Tipp auf „Über“ für Text und Bewertungen.</p><div data-gcr-list><p class="gcr-sub">Lädt …</p></div>' +
      (opts.onSearch ? '<button type="button" class="gcr-link" data-gcr-search>Per ID oder Nickname suchen</button>' : "") +
      '<button type="button" class="gcr-btn gcr-btn--ghost" data-gcr-close>Schließen</button>');
    var coaches = [];
    host.rest("go_accounts?is_trainer=eq.true&select=id,name,nickname,photo_url,about_me&order=name.asc")
      .then(function (rows) {
        coaches = (rows || []).filter(function (c) { return String(c.id) !== String(host.me()); });
        return summaries(coaches.map(function (c) { return c.id; }));
      })
      .then(function (sum) {
        coaches.sort(function (a, b) { return ((sum[b.id] || {}).avg || 0) - ((sum[a.id] || {}).avg || 0); });
        sh.el.querySelector("[data-gcr-list]").innerHTML = coaches.length
          ? coaches.map(function (c) {
              var cur = String(c.id) === String(opts.currentId || "");
              return '<div class="gcr-coach">' + face(c) + '<div class="gcr-coach__copy"><div class="gcr-coach__name">' + esc(c.name || c.nickname || "Coach") +
                '</div><div class="gcr-mini">' + summaryLine(sum[c.id]) + "</div></div>" +
                '<button type="button" class="gcr-pill" data-gcr-about="' + esc(c.id) + '">Über</button>' +
                '<button type="button" class="gcr-pill is-solid" data-gcr-pick="' + esc(c.id) + '"' + (cur ? " disabled" : "") + ">" + (cur ? "Dein Coach" : "Wählen") + "</button></div>";
            }).join("")
          : '<p class="gcr-sub">Noch keine Coaches.</p>';
      })
      .catch(function () {
        sh.el.querySelector("[data-gcr-list]").innerHTML = '<p class="gcr-sub">Coaches konnten nicht geladen werden.</p>';
      });
    sh.el.addEventListener("click", function (e) {
      var a = e.target.closest("[data-gcr-about]");
      if (a) {
        var ca = coaches.filter(function (c) { return String(c.id) === a.getAttribute("data-gcr-about"); })[0];
        if (ca) openAbout(ca);
        return;
      }
      var p = e.target.closest("[data-gcr-pick]");
      if (p) {
        var cp = coaches.filter(function (c) { return String(c.id) === p.getAttribute("data-gcr-pick"); })[0];
        if (cp && opts.onPick) {
          sh.close();
          opts.onPick(cp);
        }
        return;
      }
      if (e.target.closest("[data-gcr-search]")) {
        sh.close();
        opts.onSearch();
      }
    });
  }

  /* ---------- Über: eigener Text + Texte der Coachees ---------- */
  function openAbout(coach) {
    var sh = sheet('<div class="gcr-about-head">' + face(coach) + "<h2>" + esc(coach.name || "Coach") + '</h2><div class="gcr-mini" data-gcr-sum></div></div>' +
      '<p class="gcr-own">' + esc(aboutText(coach) || "Noch kein eigener Text.") + "</p>" +
      '<p class="gcr-h">Coachees über ' + esc(coach.name || "den Coach") + '</p><div data-gcr-reviews><p class="gcr-sub">Lädt …</p></div>' +
      '<button type="button" class="gcr-btn gcr-btn--ghost" data-gcr-close>Zurück</button>');
    host.rest("go_coach_reviews?coach_id=eq." + encodeURIComponent(coach.id) + "&select=stars,body,updated_at,author:go_accounts!go_coach_reviews_author_id_fkey(name)&order=updated_at.desc&limit=50")
      .catch(function () {
        return host.rest("go_coach_reviews?coach_id=eq." + encodeURIComponent(coach.id) + "&select=stars,body,updated_at&order=updated_at.desc&limit=50");
      })
      .then(function (rows) {
        rows = rows || [];
        var sum = { n: rows.length, avg: rows.length ? rows.reduce(function (s, r) { return s + r.stars; }, 0) / rows.length : 0 };
        sh.el.querySelector("[data-gcr-sum]").innerHTML = summaryLine(sum);
        sh.el.querySelector("[data-gcr-reviews]").innerHTML = rows.length
          ? rows.map(function (r) {
              return '<div class="gcr-review"><div class="gcr-mini"><b>' + starsText(r.stars) + "</b> " + esc((r.author && r.author.name) || "") + "</div>" +
                (r.body ? "<p>" + esc(r.body) + "</p>" : "") + "</div>";
            }).join("")
          : '<p class="gcr-sub">Noch keine Bewertungen.</p>';
      })
      .catch(function () {
        sh.el.querySelector("[data-gcr-reviews]").innerHTML = '<p class="gcr-sub">Bewertungen konnten nicht geladen werden.</p>';
      });
  }

  global.GoCoachReviews = {
    init: function (h) { host = h; ensureCss(); },
    openWrite: openWrite,
    openCoachList: openCoachList,
    openAbout: openAbout,
    summaries: summaries
  };
})(window);
