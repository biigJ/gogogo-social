/* share-card.js — Event extern teilen als Bild im Layout der Aktuell-Karte (Foto/Cover, Name oben links,
 * Zeit und Titel mittig) plus Text für die Nachricht.
 *
 *   GoShareCard.share({ title, emoji, startsAt, hasTime, location, photo, cover, who, whoPhoto })
 *     → rendert 1080×1350 (4:5), öffnet das Teilen-Menü des Geräts mit Bild + Text.
 *   GoShareCard.text(info) → Nachrichtentext
 */
(function (global) {
  "use strict";

  var W = 1080, H = 1350;

  function loadImg(url) {
    return new Promise(function (resolve) {
      if (!url) { resolve(null); return; }
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function berlinDay(d) {
    return d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
  }
  function whenLabel(info) {
    var d = new Date(info.startsAt);
    if (isNaN(d.getTime())) return "";
    var today = berlinDay(new Date());
    var tomorrow = berlinDay(new Date(Date.now() + 86400000));
    var day = berlinDay(d);
    var dl = day === today ? "Heute" : day === tomorrow ? "Morgen"
      : d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "numeric" });
    var t = info.hasTime ? d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) : "";
    return dl + (t ? " · " + t : "");
  }

  function text(info) {
    var lines = [];
    lines.push((info.emoji ? info.emoji + " " : "") + (info.title || "Training"));
    var w = whenLabel(info);
    if (w) lines.push(w + (info.hasTime ? " Uhr" : ""));
    if (info.location) lines.push("📍 " + info.location);
    if (info.who) lines.push("mit " + info.who);
    lines.push("Mach mit: https://www.gogogo.social");
    return lines.join("\n");
  }

  function wrap(ctx, str, maxW) {
    var words = String(str || "").split(/\s+/), lines = [], cur = "";
    words.forEach(function (wd) {
      var test = cur ? cur + " " + wd : wd;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = test;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function render(info) {
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return Promise.all([loadImg(info.photo || info.cover), loadImg(info.whoPhoto), fontsReady]).then(function (r) {
      var bg = r[0], face = r[1];
      var cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#2A2118";
      ctx.fillRect(0, 0, W, H);
      if (bg) {
        var k = Math.max(W / bg.width, H / bg.height);
        var bw = bg.width * k, bh = bg.height * k;
        try { ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh); } catch (eD) {}
      }
      /* Abdunkeln wie auf der Karte */
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0.38)");
      g.addColorStop(0.45, "rgba(0,0,0,0.22)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 18;
      /* oben links: Profilbild + Name */
      if (info.who) {
        var R = 56, cx = 64 + R, cy = 64 + R;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (face) { try { ctx.drawImage(face, cx - R, cy - R, R * 2, R * 2); } catch (eF) {} }
        else { ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
        ctx.restore();
        if (!face) {
          ctx.font = "700 54px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(info.who).slice(0, 1).toUpperCase(), cx, cy + 2);
        }
        ctx.font = "500 56px Inter, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(String(info.who).split(" ")[0], cx + R + 30, cy + 2);
      }
      /* Mitte: Zeit, darunter Emoji + Titel (Playfair) */
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      var when = whenLabel(info);
      ctx.font = "600 58px Inter, system-ui, sans-serif";
      var titleFont = "700 104px 'Playfair Display', Georgia, serif";
      ctx.font = titleFont;
      var tLines = wrap(ctx, (info.emoji ? info.emoji + " " : "") + (info.title || "Training"), W - 140).slice(0, 3);
      var lh = 120;
      var blockH = (when ? 90 : 0) + tLines.length * lh;
      var y = H / 2 - blockH / 2 + 60;
      if (when) {
        ctx.font = "600 58px Inter, system-ui, sans-serif";
        ctx.fillText(when, W / 2, y);
        y += 110;
      }
      ctx.font = titleFont;
      tLines.forEach(function (l) { ctx.fillText(l, W / 2, y); y += lh; });
      if (info.location) {
        ctx.font = "500 46px Inter, system-ui, sans-serif";
        ctx.fillText(info.location, W / 2, y + 10);
      }
      /* unten: Marke */
      ctx.font = "700 44px Inter, system-ui, sans-serif";
      ctx.fillText("gogogo.social", W / 2, H - 70);
      return new Promise(function (resolve) {
        try { cv.toBlob(function (b) { resolve(b); }, "image/jpeg", 0.88); } catch (eT) { resolve(null); }
      });
    });
  }

  function share(info) {
    var msg = text(info);
    return render(info).catch(function () { return null; }).then(function (blob) {
      var file = blob ? new File([blob], "gogogo.jpg", { type: "image/jpeg" }) : null;
      var data = file && navigator.canShare && navigator.canShare({ files: [file] }) ? { files: [file], text: msg } : { text: msg };
      function go() {
        if (navigator.share) return navigator.share(data);
        if (file) {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(file);
          a.download = "gogogo.jpg";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        return Promise.resolve();
      }
      return go().catch(function (err) {
        if (err && err.name === "AbortError") return;
        /* iPhone: nach dem Zeichnen ist der Tipp „verbraucht“ → einmal bestätigen */
        if (!global.GoDialog) return;
        return GoDialog.confirm("Bild ist bereit zum Teilen.", { ok: "Teilen", cancel: "Abbrechen" }).then(function (yes) {
          if (yes) return go().catch(function () {});
        });
      });
    });
  }

  global.GoShareCard = { share: share, text: text, render: render };
})(window);
