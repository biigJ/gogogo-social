/* circle-sheet.js — Circle-Workout als PDF zum Ausdrucken und Eintragen
 *
 *   GoCircleSheet.pdf(pages, { format, file })
 *     format "a4": DIN A4 quer, links das letzte Workout, rechts das anstehende (Schnittlinie mittig → zwei A5)
 *     format "a5": DIN A5 hoch, nur das anstehende Workout (Coach im Frontend)
 *   page = {
 *     name, partner,                                   vorbelegt oder leer zum Eintragen
 *     last: { title, sub, total, rows: [{ label, value, points }] } | null,
 *     next: { title, sub, stations: [label] | null, rounds, start }   start = Index der Startstation oder null (zum Eintragen)
 *   }
 *   GoCircleSheet.plan(stations, start)  → [{ nr, label }] in Laufreihenfolge ab Start
 *
 * jsPDF 2.5.1 (cdnjs) wird erst beim ersten Export geladen. Schrift Helvetica (WinAnsi: Umlaute, ß, „·“ gehen).
 */
(function (global) {
  "use strict";

  var LIB = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  var INK = [42, 33, 24], MUTED = [120, 110, 100], LINE = [190, 182, 170], RED = [199, 65, 59];

  function loadLib() {
    if (global.jspdf && global.jspdf.jsPDF) return Promise.resolve(global.jspdf.jsPDF);
    return new Promise(function (res, rej) {
      var sc = document.createElement("script");
      sc.src = LIB;
      sc.onload = function () { global.jspdf && global.jspdf.jsPDF ? res(global.jspdf.jsPDF) : rej(new Error("jsPDF fehlt")); };
      sc.onerror = function () { rej(new Error("jsPDF nicht geladen")); };
      document.head.appendChild(sc);
    });
  }
  function clean(s) {
    /* nur Zeichen, die Helvetica (WinAnsi) kennt */
    return String(s == null ? "" : s).replace(/›/g, ">").replace(/[‘’]/g, "'").replace(/[„“”]/g, '"').replace(/[^\x00-\xFF–—…€]/g, "");
  }
  function plan(stations, start) {
    var n = stations.length;
    var s = start != null && start >= 0 && start < n ? start : 0;
    var out = [];
    for (var i = 0; i < n; i++) out.push({ nr: start != null ? i + 1 : null, label: stations[(s + i) % n] });
    return out;
  }

  /* eine Hälfte (A5 hoch): x0 = linker Rand, w = Breite */
  function brand(doc, x0, w, y) {
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.setTextColor.apply(doc, RED);
    doc.text("gogogo", x0 + w / 2, y, { align: "center" });
  }
  function heading(doc, x0, title, sub, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor.apply(doc, INK);
    doc.text(clean(title), x0, y);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor.apply(doc, MUTED);
      doc.text(clean(sub), x0, y + 6);
    }
  }
  function drawLast(doc, x0, w, last) {
    var m = 12, x = x0 + m, cw = w - 2 * m;
    brand(doc, x0, w, 16);
    heading(doc, x, "Letztes Workout", last ? last.sub : "", 30);
    var y = 46;
    if (!last || !(last.rows || []).length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor.apply(doc, MUTED);
      doc.text("Noch keine Werte aufgezeichnet.", x, y);
      return;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.text("RUNDE", x, y); doc.text("STATION", x + 16, y); doc.text("ERGEBNIS", x + cw - 60, y); doc.text("P", x + cw, y, { align: "right" });
    y += 3;
    doc.setDrawColor.apply(doc, LINE);
    last.rows.forEach(function (r, i) {
      doc.line(x, y, x + cw, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor.apply(doc, INK);
      doc.text(String(i + 1), x + 2, y);
      doc.text(clean(r.label), x + 16, y, { maxWidth: cw - 78 });
      doc.text(clean(r.value), x + cw - 60, y, { maxWidth: 50 });
      doc.text(r.points != null ? String(r.points) : "", x + cw, y, { align: "right" });
      y += 3;
    });
    doc.line(x, y, x + cw, y);
    if (last.total != null) {
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Summe " + last.total + " Punkte", x + cw, y, { align: "right" });
    }
  }
  function drawNext(doc, x0, w, h, p) {
    var m = 12, x = x0 + m, cw = w - 2 * m, nx = p.next || {};
    brand(doc, x0, w, 16);
    heading(doc, x, nx.title || "Anstehendes Workout", nx.sub || "", 30);
    var y = 46;
    /* Name und Partner in einer Zeile */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    var half = (cw - 6) / 2;
    doc.text("NAME", x, y); doc.text("PARTNER", x + half + 6, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor.apply(doc, INK);
    if (p.name) doc.text(clean(p.name), x, y + 7);
    if (p.partner) doc.text(clean(p.partner), x + half + 6, y + 7);
    doc.setDrawColor.apply(doc, INK);
    doc.line(x, y + 9, x + half, y + 9);
    doc.line(x + half + 6, y + 9, x + cw, y + 9);
    y += 18;
    var stations = nx.stations && nx.stations.length ? nx.stations : null;
    var startTxt = stations && nx.start != null ? "Start: " + stations[nx.start] : "Start bei Station:";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(clean(startTxt), x, y);
    if (!(stations && nx.start != null)) { doc.setDrawColor.apply(doc, INK); doc.line(x + 33, y + 1, x + cw, y + 1); }
    y += 9;
    var rows = stations ? plan(stations, nx.start) : [];
    if (!stations) for (var i = 0; i < (nx.rounds || 8); i++) rows.push({ nr: null, label: "" });
    var rowH = Math.min(13, Math.max(8.5, (h - y - 18) / Math.max(1, rows.length)));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.text("NR.", x, y); doc.text("STATION", x + 14, y); doc.text("ERGEBNIS", x + cw - 40, y);
    y += 2;
    doc.setDrawColor.apply(doc, LINE);
    rows.forEach(function (r) {
      doc.line(x, y, x + cw, y);
      var ty = y + rowH / 2 + 1.8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor.apply(doc, INK);
      if (r.nr != null) doc.text(String(r.nr), x + 2, ty);
      else { doc.setDrawColor.apply(doc, LINE); doc.rect(x, y + rowH / 2 - 3.5, 8, 7); }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      if (r.label) doc.text(clean(r.label), x + 14, ty, { maxWidth: cw - 58 });
      doc.setDrawColor.apply(doc, LINE);
      doc.rect(x + cw - 40, y + 1.5, 40, rowH - 3);
      y += rowH;
    });
    doc.line(x, y, x + cw, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.text(!stations ? "Station und Nummer eintragen: 1 = Start, dann der Reihe nach." : nx.start == null ? "Nummer neben die Station schreiben: 1 = Start, dann der Reihe nach." : "Werte eintragen, Meter und Wiederholungen ausrechnen.", x, Math.min(h - 8, y + 7));
  }

  function pdf(pages, opts) {
    opts = opts || {};
    var a5 = opts.format === "a5";
    return loadLib().then(function (JsPDF) {
      var doc = new JsPDF({ orientation: a5 ? "portrait" : "landscape", unit: "mm", format: a5 ? "a5" : "a4" });
      (pages || []).forEach(function (p, i) {
        if (i) doc.addPage(a5 ? "a5" : "a4", a5 ? "portrait" : "landscape");
        if (a5) { drawNext(doc, 0, 148, 210, p); return; }
        drawLast(doc, 0, 148.5, p.last);
        /* Schnittlinie für zwei A5 */
        doc.setDrawColor.apply(doc, LINE);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(148.5, 6, 148.5, 204);
        doc.setLineDashPattern([], 0);
        drawNext(doc, 148.5, 148.5, 210, p);
      });
      doc.save(opts.file || "gogogo-circle-workout.pdf");
    });
  }

  /* Stationen (Schlüssel wie hyrox-doubles.js REFS) */
  function stationList() {
    var R = (global.GoHyroxDoubles && global.GoHyroxDoubles.REFS) || {};
    var order = ["row", "skierg", "bike_m", "sledpush", "sledhybrid", "farmers", "wallballs", "lunges", "burpee", "burpeebox"];
    return order.filter(function (k) { return R[k]; }).map(function (k) { return [k, R[k].label]; }).concat([["frei", "Frei"]]);
  }
  function labels(keys) {
    var map = {};
    stationList().forEach(function (x) { map[x[0]] = x[1]; });
    return (keys || []).map(function (k) { return map[k] || k; });
  }
  /* Coach wählt die Stationen in der Reihenfolge an der Tafel; Antwort = Schlüssel oder null */
  function pickStations(title, have) {
    if (!global.GoDialog) return Promise.resolve(null);
    have = have || [];
    return global.GoDialog.pick(title || "Stationen", stationList().map(function (x) { return { label: x[1], value: x[0], checked: have.indexOf(x[0]) >= 0 }; }), { ok: "Übernehmen", cancel: "Abbrechen" })
      .then(function (v) { return v && v.length ? v : null; });
  }
  function noteStations(note) {
    var m = String(note || "").match(/(?:^|\|)st=([^|]*)/);
    return m && m[1] ? m[1].split(",").filter(Boolean) : [];
  }

  global.GoCircleSheet = { pdf: pdf, plan: plan, pickStations: pickStations, labels: labels, noteStations: noteStations, stationList: stationList };
})(window);
