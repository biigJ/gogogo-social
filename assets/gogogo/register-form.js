/**
 * gogogo register forms — PDF download + Web3Forms contact
 * (same pattern as biig Interior Kostenrechner)
 */
(function () {
  var WEB3FORMS_ACCESS_KEY = "3ffad713-3ad6-491b-bf99-185a87b0d706";
  var WEB3FORMS_ATTACH_PDF = false;

  function lang() {
    return document.documentElement.lang === "en" ? "en" : "de";
  }

  function t(de, en) {
    return lang() === "en" ? en : de;
  }

  function getJsPDF() {
    if (window.jspdf && typeof window.jspdf.jsPDF === "function") return window.jspdf.jsPDF;
    if (typeof window.jsPDF === "function") return window.jsPDF;
    return null;
  }

  function pdfSafeText(str) {
    return String(str == null ? "" : str)
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, "...")
      .replace(/\u00A0/g, " ");
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(function () {
      a.remove();
      URL.revokeObjectURL(url);
    }, 120000);
  }

  function collectForm(form) {
    var service = (form.querySelector('input[name="service"]') || {}).value || "";
    var source = (form.querySelector('input[name="source"]') || {}).value || "";
    var anliegen = Array.prototype.slice
      .call(form.querySelectorAll('input[name="anliegen[]"]:checked'))
      .map(function (el) {
        return el.value;
      });
    return {
      fname: (document.getElementById("gogl-firstname") || {}).value.trim() || "",
      lname: (document.getElementById("gogl-lastname") || {}).value.trim() || "",
      email: (document.getElementById("gogl-email") || {}).value.trim() || "",
      phone: (document.getElementById("gogl-phone") || {}).value.trim() || "",
      message: (document.getElementById("gogl-message") || {}).value.trim() || "",
      dsgvo: !!(document.getElementById("gogl-dsgvo") || {}).checked,
      membership: !!(document.getElementById("gogl-membership") || {}).checked,
      service: service,
      source: source,
      anliegen: anliegen,
    };
  }

  function buildPlainText(data) {
    var name = [data.fname, data.lname].filter(Boolean).join(" ");
    var lines = [
      t("gogogo — neue Anmeldung", "gogogo — new signup"),
      "",
      t("Service", "Service") + ": " + (data.service || "—"),
      t("Quelle", "Source") + ": " + (data.source || "—"),
      "",
      t("Name", "Name") + ": " + (name || "—"),
      t("E-Mail", "Email") + ": " + (data.email || "—"),
      t("Telefon", "Phone") + ": " + (data.phone || "—"),
      "",
      t("Anliegen", "Topics") + ":",
    ];
    if (data.anliegen.length) {
      data.anliegen.forEach(function (item) {
        lines.push("- " + item);
      });
    } else {
      lines.push("- " + t("keine Auswahl", "none selected"));
    }
    lines.push("");
    lines.push(t("Nachricht", "Message") + ":");
    lines.push(data.message || "—");
    lines.push("");
    lines.push(
      t("DSGVO-Einverständnis", "Privacy consent") +
        ": " +
        (data.dsgvo ? t("ja", "yes") : t("nein", "no"))
    );
    lines.push(
      t("FRIDAY CIRCLE Mitgliedschaft", "FRIDAY CIRCLE membership") +
        ": " +
        (data.membership ? t("ja", "yes") : t("nein", "no"))
    );
    return lines.join("\n");
  }

  function createPdfBlob(data) {
    var JsPDF = getJsPDF();
    if (!JsPDF) throw new Error("jspdf missing");

    var doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    var margin = 14;
    var maxW = 182;
    var pageBottom = 283;
    var y = margin;
    var title =
      data.service === "go-training"
        ? t("gogogo — Buddy Experte / Training", "gogogo — Buddy Expert / Training")
        : t("gogogo — Gym Buddy / Accountability", "gogogo — Gym Buddy / Accountability");
    var filename =
      data.service === "go-training" ? "gogogo-training-anfrage.pdf" : "gogogo-accountability-anfrage.pdf";

    function ensureSpace(h) {
      if (y + h > pageBottom) {
        doc.addPage();
        y = margin;
      }
    }

    function addLines(text, opts) {
      opts = opts || {};
      var size = opts.size || 10;
      var lh = size * 0.48;
      doc.setFontSize(size);
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.splitTextToSize(pdfSafeText(text), maxW).forEach(function (line) {
        ensureSpace(lh);
        doc.text(line, margin, y);
        y += lh;
      });
      if (opts.gapAfter) y += opts.gapAfter;
    }

    addLines(title, { size: 16, bold: true, gapAfter: 4 });
    addLines(t("Kontaktdaten", "Contact details"), { size: 11, bold: true, gapAfter: 2 });
    addLines(t("Name", "Name") + ": " + ([data.fname, data.lname].filter(Boolean).join(" ") || "—"));
    addLines(t("E-Mail", "Email") + ": " + (data.email || "—"));
    addLines(t("Telefon", "Phone") + ": " + (data.phone || "—"), { gapAfter: 4 });
    addLines(t("Anliegen", "Topics"), { size: 11, bold: true, gapAfter: 2 });
    if (data.anliegen.length) {
      data.anliegen.forEach(function (item) {
        addLines("- " + item);
      });
    } else {
      addLines("- " + t("keine Auswahl", "none selected"));
    }
    y += 4;
    addLines(t("Nachricht", "Message"), { size: 11, bold: true, gapAfter: 2 });
    addLines(data.message || "—", { gapAfter: 4 });
    addLines(
      t("DSGVO", "Privacy") + ": " + (data.dsgvo ? t("zugestimmt", "agreed") : t("nein", "no"))
    );
    addLines(
      t("Mitgliedschaft", "Membership") +
        ": " +
        (data.membership ? t("zugestimmt", "agreed") : t("nein", "no"))
    );

    return { blob: doc.output("blob"), filename: filename };
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = window.setTimeout(function () {
        reject(new Error("timeout"));
      }, ms);
      promise.then(
        function (v) {
          window.clearTimeout(timer);
          resolve(v);
        },
        function (err) {
          window.clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function sendAnfrage(data, pdfBlob, pdfName) {
    var name = [data.fname, data.lname].filter(Boolean).join(" ");
    var formData = new FormData();
    formData.append("access_key", WEB3FORMS_ACCESS_KEY);
    formData.append("botcheck", "");
    formData.append(
      "subject",
      data.service === "go-training"
        ? t("gogogo — Training / Buddy Experte", "gogogo — Training / Buddy Expert")
        : t("gogogo — Accountability / Gym Buddy", "gogogo — Accountability / Gym Buddy")
    );
    formData.append("from_name", name || data.fname);
    formData.append("name", name || data.fname);
    formData.append("email", data.email);
    formData.append("replyto", data.email);
    if (data.phone) formData.append("phone", data.phone);
    var message = buildPlainText(data);
    if (pdfBlob) {
      message +=
        "\n\n" +
        t(
          "PDF wurde beim Absenden lokal heruntergeladen (kein Anhang).",
          "PDF was downloaded locally on submit (no attachment)."
        );
    }
    formData.append("message", message);
    if (WEB3FORMS_ATTACH_PDF && pdfBlob) {
      formData.append("attachment", new File([pdfBlob], pdfName, { type: "application/pdf" }));
    }
    return withTimeout(
      fetch("https://api.web3forms.com/submit", { method: "POST", body: formData }),
      45000
    ).then(function (res) {
      return res.json().then(function (resData) {
        if (!res.ok || !resData || !resData.success) {
          throw new Error((resData && resData.message) || "HTTP " + res.status);
        }
        return resData;
      });
    });
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    if (busy) {
      if (!btn.dataset.goglLabel) btn.dataset.goglLabel = btn.textContent;
      btn.classList.add("is-submitting");
      btn.disabled = true;
      btn.textContent = t("Wird gesendet…", "Sending…");
      return;
    }
    btn.classList.remove("is-submitting");
    btn.disabled = false;
    if (btn.dataset.goglLabel) {
      btn.textContent = btn.dataset.goglLabel;
      delete btn.dataset.goglLabel;
    }
  }

  function showDone(form, hasPdf) {
    var wrap = form.closest(".gogl-form-wrap");
    if (!wrap) return;
    form.hidden = true;
    var done = wrap.querySelector(".gogl-form-done");
    if (!done) {
      done = document.createElement("div");
      done.className = "gogl-form-done";
      done.innerHTML =
        "<h2 class=\"gogl-form-done__title\"></h2>" +
        "<p class=\"gogl-form-done__body\"></p>" +
        "<button type=\"button\" class=\"gogl-form__submit gogl-form-done__pdf\"></button>";
      wrap.appendChild(done);
    }
    done.hidden = false;
    done.querySelector(".gogl-form-done__title").textContent = t("Danke — Anfrage gesendet", "Thanks — request sent");
    done.querySelector(".gogl-form-done__body").textContent = hasPdf
      ? t(
          "Dein PDF wurde heruntergeladen. Wir melden uns persönlich bei Dir.",
          "Your PDF was downloaded. We will get back to you personally."
        )
      : t(
          "Wir haben Deine Anfrage erhalten und melden uns persönlich bei Dir.",
          "We received your request and will get back to you personally."
        );
    var pdfBtn = done.querySelector(".gogl-form-done__pdf");
    pdfBtn.hidden = !hasPdf;
    pdfBtn.textContent = t("PDF erneut herunterladen", "Download PDF again");
    pdfBtn.onclick = function () {
      if (!window.__goglLastPdf) return;
      downloadBlob(window.__goglLastPdf.blob, window.__goglLastPdf.filename);
    };
  }

  function bindForm(form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = collectForm(form);
      var btn = form.querySelector(".gogl-form__submit");

      if (!data.fname || !data.lname || !data.email || !data.phone) {
        alert(t("Bitte Vorname, Nachname, E-Mail und Telefon ausfüllen.", "Please fill in first name, last name, email and phone."));
        return;
      }
      if (!data.dsgvo || !data.membership) {
        alert(t("Bitte beide Einverständnis-Checkboxen setzen.", "Please check both consent boxes."));
        return;
      }
      if (!WEB3FORMS_ACCESS_KEY) {
        alert(t("Formular ist noch nicht konfiguriert.", "Form is not configured yet."));
        return;
      }

      window.__goglLastPdf = null;
      setBusy(btn, true);

      var pdfResult = null;
      try {
        pdfResult = createPdfBlob(data);
        window.__goglLastPdf = pdfResult;
        downloadBlob(pdfResult.blob, pdfResult.filename);
      } catch (pdfErr) {
        console.warn("PDF failed", pdfErr);
        alert(
          t(
            "PDF konnte nicht erzeugt werden — Anfrage wird trotzdem gesendet.",
            "PDF could not be created — request will still be sent."
          )
        );
      }

      sendAnfrage(data, pdfResult && pdfResult.blob, pdfResult && pdfResult.filename)
        .then(function () {
          showDone(form, !!(pdfResult && pdfResult.blob));
        })
        .catch(function (err) {
          console.error(err);
          alert(
            t(
              "Senden fehlgeschlagen. Bitte später erneut versuchen oder mail@bjgrope.de schreiben.",
              "Sending failed. Please try again later or email mail@bjgrope.de."
            )
          );
          setBusy(btn, false);
        });
    });
  }

  function init() {
    document.querySelectorAll("form.gogl-form").forEach(bindForm);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
