/* ffc-points.js — FFC-Zirkelpunkte nach gogogo spiegeln, für „Gesamt“ und Double
 *
 *   GoFfcPoints.sync(host)              eigene FFC-Trainings → go_ffc_sessions (einmal pro App-Start)
 *   GoFfcPoints.load(host, ids, from)   → Promise [{ account_id, day, points }] (from: "YYYY-MM-DD" oder null = gesamt)
 *   GoFfcPoints.totals(rows)            → { account_id: { points, workouts } }
 *
 * Punkte rechnet FFC (ffc.js, gleiche Formel wie Hendriks punkte.sql). Hier wird nichts neu gewertet.
 * Tabelle und Rechte: go-ffc-punkte.sql. Fehlt sie, liefert load [] und die App zeigt einen Hinweis.
 */
(function (global) {
  "use strict";

  var synced = false;
  var missing = false;

  function berlinDay(ts) {
    try {
      return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    } catch (e) {
      return String(ts || "").slice(0, 10);
    }
  }

  function sync(host) {
    if (synced || missing || !host || !host.rest || !host.accountId) return Promise.resolve(false);
    if (!global.FFC || !FFC.user || !FFC.user() || !FFC.historyRecords) return Promise.resolve(false);
    synced = true;
    return FFC.historyRecords().then(function (recs) {
      var rows = (recs || []).filter(function (r) { return r && r.id && r.date; }).map(function (r) {
        return {
          id: String(r.id),
          account_id: host.accountId,
          day: berlinDay(r.date),
          started_at: new Date(r.date).toISOString(),
          points: Math.round(Number(r.points) || 0),
          rounds: r.rounds || null,
          work_sec: r.workSec || null,
          rest_sec: r.restSec || null,
          synced_at: new Date().toISOString()
        };
      });
      if (!rows.length) return true;
      return host.rest("go_ffc_sessions?on_conflict=id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: rows
      }).then(function () { return true; });
    }).catch(function (err) {
      if (/go_ffc_sessions|relation|42P01/.test(String((err && err.message) || ""))) missing = true;
      synced = false;
      return false;
    });
  }

  function load(host, ids, from) {
    if (missing || !host || !host.rest || !ids || !ids.length) return Promise.resolve([]);
    var q = "go_ffc_sessions?account_id=in.(" + ids.map(encodeURIComponent).join(",") + ")" +
      (from ? "&day=gte." + from : "") + "&select=account_id,day,points&limit=10000";
    return host.rest(q).catch(function (err) {
      if (/go_ffc_sessions|relation|42P01/.test(String((err && err.message) || ""))) missing = true;
      return [];
    });
  }

  function totals(rows) {
    var out = {};
    (rows || []).forEach(function (r) {
      var k = String(r.account_id);
      var t = out[k] || (out[k] = { points: 0, workouts: 0 });
      t.points += Number(r.points) || 0;
      t.workouts += 1;
    });
    return out;
  }

  global.GoFfcPoints = {
    sync: sync,
    load: load,
    totals: totals,
    missing: function () { return missing; },
    reset: function () { synced = false; }
  };
})(window);
