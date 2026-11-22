/* go-dialog.js — gogogo-Dialoge statt System-alert/confirm/prompt
 *
 *   GoDialog.alert(text)                       → Promise<void>
 *   GoDialog.confirm(text, { ok, cancel, photo, initial }) → Promise<boolean>  (photo: rundes Bild über dem Text)
 *   GoDialog.prompt(text, value, { ok, type }) → Promise<string|null>
 *   GoDialog.choose(text, [{ label, value }])  → Promise<value|null>
 *   GoDialog.pick(text, [{ label, value }], { ok }) → Promise<value[]|null>  (Mehrfachauswahl)
 *   GoDialog.note(text)                        → Promise<void>  (nur Text, Tippen schließt)
 *   GoDialog.time(text, { sub, times, ok, alt, cancel }) → Promise<"HH:MM"|"alt"|null>  (Drehrad, 30-Min-Schritte)
 *
 * Stil wie .sand-modal / .sand-card (Sandfläche, Playfair-Titel, schwarze Pill-Buttons).
 */
(function (global) {
  "use strict";

  var CSS =
    ".god{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(20,16,12,.42)}" +
    ".god__card{width:min(100%,380px);max-height:86vh;overflow-y:auto;box-sizing:border-box;background:#F3EEE4;color:#2A2118;border-radius:22px;padding:22px 18px 16px;box-shadow:0 18px 50px rgba(0,0,0,.25);font-family:Inter,system-ui,sans-serif}" +
    ".god__card .god__text{margin:0 0 16px !important;font-family:'Playfair Display',Georgia,serif;font-size:21px;font-weight:600;line-height:1.25;white-space:pre-wrap}" +
    ".god__input{width:100%;box-sizing:border-box;min-height:46px;margin:0 0 14px;padding:0 12px;border:1px solid rgba(42,33,24,.25);border-radius:12px;background:#fff;font:inherit;font-size:16px;color:#2A2118}" +
    ".god__btn{display:block;width:100%;min-height:48px;margin:0 0 8px;border:0;border-radius:999px;background:#111;color:#fff;font:inherit;font-weight:700;font-size:16px;cursor:pointer}" +
    ".god__btn--quiet{background:transparent;color:rgba(42,33,24,.7);font-weight:600}" +
    ".god__btn--choice{background:transparent;color:#2A2118;border:1.5px solid #2A2118}" +
    ".god__list{max-height:46vh;overflow-y:auto;margin:0 0 14px;display:grid;gap:6px}" +
    ".god__pick{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 12px;border-radius:12px;background:#fff;font-size:16px;cursor:pointer}" +
    ".god__pick input{width:20px;height:20px;accent-color:#2A2118;margin:0}" +
    ".god__empty{margin:0 0 14px;color:rgba(42,33,24,.65);font-size:14px}" +
    ".god__card--note{padding:22px 20px;cursor:pointer}" +
    /* Mitteilungen der App: gogogo-Schrift (Inter 500, M), dunkle Tinte, unabhängig von Seiten-Regeln */
    ".god .god__note{margin:0;font-family:Inter,system-ui,sans-serif !important;font-size:16px !important;font-weight:500 !important;font-style:normal !important;line-height:1.5;color:#2A2118 !important;-webkit-text-fill-color:#2A2118;white-space:pre-wrap;text-align:left}" +
    ".god__face{width:96px;height:96px;margin:2px auto 14px;border-radius:50%;background:#E6DED0 center/cover no-repeat;display:grid;place-items:center;font:700 34px/1 Inter,system-ui,sans-serif;color:#2A2118}" +
    ".god__face + .god__text{text-align:center}" +
    ".god__card .god__text.is-center{text-align:center;margin-bottom:4px !important}" +
    ".god__sub{margin:0 0 16px;white-space:pre-line;font-size:15px;font-weight:600;text-align:center;color:rgba(42,33,24,.75)}" +
    ".god__info{margin:-2px 0 12px;font-size:14px;text-align:center;color:rgba(42,33,24,.7)}" +
    ".god__body{margin:8px 0 18px;font-size:16px;line-height:1.5;text-align:left}" +
    ".god__body.is-center{text-align:center;white-space:pre-line}" +
    ".god__body.is-plain{margin:4px 0 20px;font-size:17px;text-align:center;white-space:pre-wrap}" +
    ".god__wheel{position:relative;height:176px;margin:0 0 16px;overflow-y:auto;scroll-snap-type:y mandatory;background:#fff;border-radius:14px;padding:66px 0;box-sizing:border-box;scrollbar-width:none}" +
    ".god__wheel::-webkit-scrollbar{display:none}" +
    ".god__wheel button{display:block;width:100%;height:44px;margin:0;border:0;background:transparent;scroll-snap-align:center;font:600 18px/44px Inter,system-ui,sans-serif;color:rgba(17,17,17,.4);cursor:pointer}" +
    ".god__wheel button.is-on{font-size:24px;color:#111}" +
    ".god__center{display:flex;justify-content:center;margin:0 0 14px}" +
    ".god__vis{min-width:96px;min-height:34px;padding:0 16px;border-radius:999px;border:1px solid rgba(42,33,24,.3);background:transparent;color:#2A2118;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}" +
    ".god__vis.is-on{background:#2A2118;border-color:#2A2118;color:#F6F1E8}" +
    ".god__planrow{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center;margin:0 0 12px}" +
    ".god__planrow .god__wheel{margin:0}" +
    ".god__wheel--sm{height:132px;padding:44px 0}" +
    ".god__planrow .god__btn--now{margin:0;height:132px;border-radius:14px}" +
    ".god__area{min-height:88px;padding:10px 12px;resize:none;font-family:inherit}" +
    ".god__file{display:flex;align-items:center;justify-content:center;cursor:pointer}" +
    ".god__row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".god__check{margin:12px 0 16px;line-height:1.3;padding:10px 12px}" +
    ".god__row2 .god__btn{margin:0}";

  function ensureCss() {
    if (document.getElementById("go-dialog-css")) return;
    var st = document.createElement("style");
    st.id = "go-dialog-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function open(build) {
    ensureCss();
    return new Promise(function (resolve) {
      var box = document.createElement("div");
      box.className = "god";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      var card = document.createElement("div");
      card.className = "god__card";
      box.appendChild(card);
      var done = false;
      function close(value) {
        if (done) return;
        done = true;
        if (box.parentNode) box.parentNode.removeChild(box);
        resolve(value);
      }
      var cancelValue = build(card, close);
      box.addEventListener("click", function (e) {
        if (e.target === box) close(cancelValue);
      });
      document.body.appendChild(box);
      var focus = card.querySelector("input") || card.querySelector("button");
      if (focus) {
        try { focus.focus(); } catch (e) {}
      }
    });
  }

  function text(card, msg) {
    var p = document.createElement("h2");
    p.className = "god__text";
    p.textContent = String(msg == null ? "" : msg);
    card.appendChild(p);
  }

  function button(card, label, cls, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "god__btn" + (cls ? " " + cls : "");
    b.textContent = label;
    b.addEventListener("click", onClick);
    card.appendChild(b);
    return b;
  }

  /* opts.body: Erklärtext unter der Überschrift (Überschrift dann mittig) */
  function alertDlg(msg, opts) {
    opts = opts || {};
    return open(function (card, close) {
      /* plain: alles in Fließtext-Größe (ohne Überschrift) */
      if (opts.plain) {
        var pb = document.createElement("p");
        pb.className = "god__body is-plain";
        pb.textContent = String(msg || "") + (opts.body ? "\n" + opts.body : "");
        card.appendChild(pb);
        button(card, opts.ok || "OK", "", function () { close(); });
        return undefined;
      }
      text(card, msg);
      if (opts.body) {
        var tEl = card.querySelector(".god__text");
        if (tEl) tEl.classList.add("is-center");
        var b = document.createElement("p");
        b.className = "god__body" + (opts.center ? " is-center" : "");
        b.textContent = opts.body;
        card.appendChild(b);
      }
      button(card, opts.ok || "OK", "", function () { close(); });
      return undefined;
    });
  }

  function confirmDlg(msg, opts) {
    opts = opts || {};
    return open(function (card, close) {
      if (opts.photo || opts.initial) {
        var face = document.createElement("div");
        face.className = "god__face";
        if (opts.photo) face.style.backgroundImage = "url(\"" + String(opts.photo).replace(/"/g, "%22") + "\")";
        else face.textContent = String(opts.initial).slice(0, 1).toUpperCase();
        card.appendChild(face);
      }
      text(card, msg);
      /* opts.body: Erklärtext unter der Überschrift (Überschrift dann mittig) */
      if (opts.body) {
        var tB = card.querySelector(".god__text");
        if (tB) tB.classList.add("is-center");
        var bd = document.createElement("p");
        bd.className = "god__body";
        bd.textContent = opts.body;
        card.appendChild(bd);
      }
      var okB = button(card, opts.ok || "Ja", "", function () { close(true); });
      var noB = button(card, opts.cancel || "Abbrechen", "god__btn--quiet", function () { close(false); });
      /* opts.row: beide Buttons nebeneinander (OK links, Abbrechen rechts) */
      if (opts.row) {
        var row = document.createElement("div");
        row.className = "god__row2";
        row.appendChild(okB);
        row.appendChild(noB);
        card.appendChild(row);
      }
      return false;
    });
  }

  function promptDlg(msg, value, opts) {
    opts = opts || {};
    return open(function (card, close) {
      text(card, msg);
      var input = document.createElement("input");
      input.className = "god__input";
      input.type = opts.type === "number" ? "text" : opts.type || "text";
      if (opts.type === "number") input.inputMode = "decimal";
      input.value = value == null ? "" : String(value);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") close(input.value);
      });
      card.appendChild(input);
      button(card, opts.ok || "Speichern", "", function () { close(input.value); });
      button(card, opts.cancel || "Abbrechen", "god__btn--quiet", function () { close(null); });
      return null;
    });
  }

  /* opts.center: Überschrift mittig; opts.sub: Zeile darunter; Eintrag { info: "…" }: Textzeile statt Button */
  function chooseDlg(msg, choices, opts) {
    opts = opts || {};
    return open(function (card, close) {
      text(card, msg);
      if (opts.center || opts.sub) {
        var tEl = card.querySelector(".god__text");
        if (tEl) tEl.classList.add("is-center");
      }
      if (opts.sub) {
        var sub = document.createElement("p");
        sub.className = "god__sub";
        sub.textContent = opts.sub;
        card.appendChild(sub);
      }
      (choices || []).forEach(function (c) {
        if (c.info != null) {
          var inf = document.createElement("p");
          inf.className = "god__info";
          inf.textContent = c.info;
          card.appendChild(inf);
          return;
        }
        button(card, c.label, "god__btn--choice", function () { close(c.value); });
      });
      button(card, opts.cancel || "Abbrechen", "god__btn--quiet", function () { close(null); });
      return null;
    });
  }

  function pickDlg(msg, items, opts) {
    opts = opts || {};
    return open(function (card, close) {
      text(card, msg);
      var list = document.createElement("div");
      list.className = "god__list";
      (items || []).forEach(function (it) {
        var row = document.createElement("label");
        row.className = "god__pick";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = String(it.value);
        if (it.checked) cb.checked = true;
        row.appendChild(cb);
        row.appendChild(document.createTextNode(it.label));
        list.appendChild(row);
      });
      if (!(items || []).length && opts.empty) {
        var e = document.createElement("p");
        e.className = "god__empty";
        e.textContent = opts.empty;
        card.appendChild(e);
      } else {
        card.appendChild(list);
      }
      button(card, opts.ok || "Weiter", "", function () {
        close(Array.prototype.map.call(list.querySelectorAll("input:checked"), function (i) { return i.value; }));
      });
      button(card, opts.cancel || "Abbrechen", "god__btn--quiet", function () { close(null); });
      return null;
    });
  }

  /* Nur Text, kein Titel, kein Button: Tippen auf die Karte oder daneben schließt. */
  function noteDlg(msg) {
    return open(function (card, close) {
      card.classList.add("god__card--note");
      var p = document.createElement("p");
      p.className = "god__note";
      p.textContent = String(msg == null ? "" : msg);
      card.appendChild(p);
      card.addEventListener("click", function () { close(); });
      return undefined;
    });
  }

  /* Uhrzeit wählen: Drehrad wie überall (30-Minuten-Schritte). opts.times: ["7:00", "7:30", …] */
  function timeDlg(msg, opts) {
    opts = opts || {};
    return open(function (card, close) {
      text(card, msg);
      if (opts.sub) {
        var tEl = card.querySelector(".god__text");
        if (tEl) tEl.classList.add("is-center");
        var sub = document.createElement("p");
        sub.className = "god__sub";
        sub.textContent = opts.sub;
        card.appendChild(sub);
      }
      var times = opts.times || [];
      if (!times.length) for (var h = 6; h <= 22; h++) { times.push(h + ":00"); times.push(h + ":30"); }
      var wheel = document.createElement("div");
      wheel.className = "god__wheel";
      times.forEach(function (t, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = t;
        if (i === 0) b.className = "is-on";
        b.addEventListener("click", function () { b.scrollIntoView({ block: "center", behavior: "smooth" }); });
        wheel.appendChild(b);
      });
      var tm = 0;
      wheel.addEventListener("scroll", function () {
        clearTimeout(tm);
        tm = setTimeout(function () {
          var mid = wheel.scrollTop + wheel.clientHeight / 2, best = null, bd = 1e9;
          Array.prototype.forEach.call(wheel.children, function (b) {
            var d = Math.abs(b.offsetTop + b.offsetHeight / 2 - mid);
            if (d < bd) { bd = d; best = b; }
          });
          Array.prototype.forEach.call(wheel.children, function (b) { b.classList.toggle("is-on", b === best); });
        }, 40);
      }, { passive: true });
      card.appendChild(wheel);
      button(card, opts.ok || "Senden", "", function () {
        var on = wheel.querySelector(".is-on");
        close(on ? on.textContent : null);
      });
      if (opts.alt) button(card, opts.alt, "god__btn--choice", function () { close("alt"); });
      button(card, opts.cancel || "Später", "god__btn--quiet", function () { close(null); });
      return null;
    });
  }

  /* Drehrad (30 Min) als Element, liefert { el, value() } */
  function wheelEl(times, small) {
    var wheel = document.createElement("div");
    wheel.className = "god__wheel" + (small ? " god__wheel--sm" : "");
    times.forEach(function (t, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = t;
      if (i === 0) b.className = "is-on";
      b.addEventListener("click", function () { b.scrollIntoView({ block: "center", behavior: "smooth" }); });
      wheel.appendChild(b);
    });
    var tm = 0;
    wheel.addEventListener("scroll", function () {
      clearTimeout(tm);
      tm = setTimeout(function () {
        var mid = wheel.scrollTop + wheel.clientHeight / 2, best = null, bd = 1e9;
        Array.prototype.forEach.call(wheel.children, function (b) {
          var d = Math.abs(b.offsetTop + b.offsetHeight / 2 - mid);
          if (d < bd) { bd = d; best = b; }
        });
        Array.prototype.forEach.call(wheel.children, function (b) { b.classList.toggle("is-on", b === best); });
      }, 40);
    }, { passive: true });
    return { el: wheel, value: function () { var on = wheel.querySelector(".is-on"); return on ? on.textContent : null; } };
  }

  /* Alternative planen: Überschrift, mittig Sichtbarkeit (Pille, schaltet durch), darunter links Uhrzeit-Rad, rechts „Sofort starten“.
     opts: { vis, visList: [{ value, label }], times } → Promise<{ action: "start"|"save", time, vis } | null> */
  function planDlg(msg, opts) {
    opts = opts || {};
    return open(function (card, close) {
      text(card, msg);
      var tEl = card.querySelector(".god__text");
      if (tEl) tEl.classList.add("is-center");
      var list = opts.visList || [{ value: "team", label: "Team" }];
      var vi = Math.max(0, list.map(function (x) { return x.value; }).indexOf(opts.vis || "team"));
      var pill = document.createElement("button");
      pill.type = "button";
      pill.className = "god__vis";
      function paintPill() { pill.textContent = list[vi].label; pill.classList.toggle("is-on", list[vi].value !== "privat"); }
      paintPill();
      pill.addEventListener("click", function () { vi = (vi + 1) % list.length; paintPill(); });
      var pw = document.createElement("div");
      pw.className = "god__center";
      pw.appendChild(pill);
      card.appendChild(pw);
      var row = document.createElement("div");
      row.className = "god__planrow";
      var wh = wheelEl(opts.times && opts.times.length ? opts.times : ["jetzt"], true);
      row.appendChild(wh.el);
      var go = document.createElement("button");
      go.type = "button";
      go.className = "god__btn god__btn--now";
      go.textContent = "Sofort starten";
      go.addEventListener("click", function () { close({ action: "start", time: null, vis: list[vi].value }); });
      row.appendChild(go);
      card.appendChild(row);
      if (opts.times && opts.times.length) {
        button(card, opts.ok || "Eintragen", "", function () { close({ action: "save", time: wh.value(), vis: list[vi].value }); });
      }
      button(card, opts.cancel || "Abbrechen", "god__btn--quiet", function () { close(null); });
      return null;
    });
  }

  /* Sichtbarkeit wählen: Überschrift, Pille (Tippen schaltet durch), Speichern | Abbrechen → value | null */
  function visDlg(msg, opts) {
    opts = opts || {};
    return open(function (card, close) {
      text(card, msg);
      var tEl = card.querySelector(".god__text");
      if (tEl) tEl.classList.add("is-center");
      var list = opts.visList || [{ value: "team", label: "Team" }];
      var vi = Math.max(0, list.map(function (x) { return x.value; }).indexOf(opts.vis || "team"));
      var pill = document.createElement("button");
      pill.type = "button";
      pill.className = "god__vis";
      function paintPill() { pill.textContent = list[vi].label; pill.classList.toggle("is-on", list[vi].value !== "privat"); }
      paintPill();
      pill.addEventListener("click", function () { vi = (vi + 1) % list.length; paintPill(); });
      var pw = document.createElement("div");
      pw.className = "god__center";
      pw.style.marginBottom = "16px";
      pw.appendChild(pill);
      card.appendChild(pw);
      var row = document.createElement("div");
      row.className = "god__row2";
      var ok = document.createElement("button");
      ok.type = "button";
      ok.className = "god__btn";
      ok.textContent = opts.ok || "Speichern";
      ok.addEventListener("click", function () { close(list[vi].value); });
      var no = document.createElement("button");
      no.type = "button";
      no.className = "god__btn god__btn--quiet";
      no.textContent = opts.cancel || "Abbrechen";
      no.addEventListener("click", function () { close(null); });
      row.appendChild(ok);
      row.appendChild(no);
      card.appendChild(row);
      return null;
    });
  }

  /* Kleines Formular: Überschrift, Textfeld, optional ein Haken, Buttons nebeneinander → { text, checked } | null
     opts: { placeholder, value, check: "Text am Haken", checked, ok, cancel } */
  function formDlg(msg, opts) {
    opts = opts || {};
    return open(function (card, close) {
      text(card, msg);
      var tEl = card.querySelector(".god__text");
      if (tEl) tEl.classList.add("is-center");
      var input = document.createElement("input");
      input.className = "god__input";
      input.type = "text";
      input.maxLength = opts.maxLength || 60;
      input.placeholder = opts.placeholder || "";
      input.value = opts.value || "";
      card.appendChild(input);
      /* opts.area: zweites, mehrzeiliges Feld (z. B. Ziel der Challenge) */
      var area = null;
      if (opts.area) {
        area = document.createElement("textarea");
        area.className = "god__input god__area";
        area.rows = 3;
        area.maxLength = opts.area.maxLength || 200;
        area.placeholder = opts.area.placeholder || "";
        area.value = opts.area.value || "";
        card.appendChild(area);
      }
      var cb = null;
      if (opts.check) {
        var lab = document.createElement("label");
        lab.className = "god__pick god__check";
        cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!opts.checked;
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(opts.check));
        card.appendChild(lab);
      }
      var row = document.createElement("div");
      row.className = "god__row2";
      var ok = document.createElement("button");
      ok.type = "button";
      ok.className = "god__btn";
      ok.textContent = opts.ok || "Speichern";
      ok.addEventListener("click", function () { close({ text: String(input.value || "").trim(), text2: area ? String(area.value || "").trim() : "", checked: !!(cb && cb.checked) }); });
      var no = document.createElement("button");
      no.type = "button";
      no.className = "god__btn god__btn--quiet";
      no.textContent = opts.cancel || "Abbrechen";
      no.addEventListener("click", function () { close(null); });
      row.appendChild(ok);
      row.appendChild(no);
      card.appendChild(row);
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
      return null;
    });
  }

  /* Sonstiges erledigt: Überschrift, „Wie war es? (optional)“, Foto auswählen, Speichern | Abbrechen → { text, file } | null */
  function doneDlg(msg, opts) {
    opts = opts || {};
    return open(function (card, close) {
      text(card, msg);
      var tEl = card.querySelector(".god__text");
      if (tEl) tEl.classList.add("is-center");
      var ta = document.createElement("textarea");
      ta.className = "god__input god__area";
      ta.rows = 3;
      ta.placeholder = opts.placeholder || "Wie war es? (optional)";
      card.appendChild(ta);
      var file = null;
      var lab = document.createElement("label");
      lab.className = "god__btn god__btn--choice god__file";
      lab.textContent = "Foto auswählen";
      var inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.hidden = true;
      inp.addEventListener("change", function () {
        file = inp.files && inp.files[0] || null;
        lab.firstChild.textContent = file ? "Foto gewählt ✓" : "Foto auswählen";
      });
      lab.appendChild(inp);
      card.appendChild(lab);
      var row = document.createElement("div");
      row.className = "god__row2";
      var save = document.createElement("button");
      save.type = "button";
      save.className = "god__btn";
      save.textContent = opts.ok || "Speichern";
      save.addEventListener("click", function () { close({ text: String(ta.value || "").trim(), file: file }); });
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "god__btn god__btn--choice";
      cancel.textContent = opts.cancel || "Abbrechen";
      cancel.addEventListener("click", function () { close(null); });
      row.appendChild(save);
      row.appendChild(cancel);
      card.appendChild(row);
      return null;
    });
  }

  global.GoDialog = { alert: alertDlg, confirm: confirmDlg, prompt: promptDlg, choose: chooseDlg, pick: pickDlg, note: noteDlg, time: timeDlg, plan: planDlg, done: doneDlg, vis: visDlg, form: formDlg };
})(window);
