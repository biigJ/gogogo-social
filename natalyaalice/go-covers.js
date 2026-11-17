/* go-covers.js — Coverbilder für Event-Karten statt reiner Farbflächen
 *
 *   GoCovers.init({ rest })      → lädt courses.image_url (nur Kurse mit Bild, go-medien.sql)
 *   GoCovers.ready()             → Promise
 *   GoCovers.url(courseId, cat, enrollmentId)
 *                                → Bild der Einzeleinheit, sonst Bild des Wochenplans
 *                                  (über die Einschreibung bzw. den Plan, der die Einheit nutzt),
 *                                  sonst Bild der Kategorie
 *
 * Ein eigenes Foto am Event (events.photo_url) hat immer Vorrang; das entscheidet der Aufrufer.
 */
(function (global) {
  "use strict";

  var CAT = {
    kraft: "/assets/gogogo/personaltraining-1600.webp",
    ausdauer: "/assets/gogogo/JumpRope-1600.webp",
    alternative: "/assets/gogogo/hero-poster-1600.webp",
    zirkel: "/assets/gogogo/gogogo-Zirkeltraining.jpg",
    spontan: "/assets/gogogo/SledHoodie-1600.webp",
    ernaehrung: "/assets/gogogo/gogogo-Ernaehrung.jpg"
  };

  var byCourse = {};
  var plansOfUnit = {}; // Einzeleinheit → Wochenpläne, die sie nutzen
  var planOfEnroll = {}; // Einschreibung → Wochenplan
  var loading = null;

  function init(h) {
    if (loading) return loading;
    if (!h || !h.rest) return (loading = Promise.resolve());
    var safe = function (p) { return h.rest(p).catch(function () { return []; }); };
    loading = Promise.all([
      safe("courses?image_url=not.is.null&select=id,image_url&limit=500"),
      safe("course_sessions?unit_course_id=not.is.null&select=course_id,unit_course_id&limit=2000"),
      safe("enrollments?select=id,course_id&limit=500")
    ]).then(function (res) {
      (res[0] || []).forEach(function (r) { if (r && r.id && r.image_url) byCourse[String(r.id)] = r.image_url; });
      (res[1] || []).forEach(function (r) {
        var u = String(r.unit_course_id);
        (plansOfUnit[u] = plansOfUnit[u] || []).push(String(r.course_id));
      });
      (res[2] || []).forEach(function (r) { if (r && r.id && r.course_id) planOfEnroll[String(r.id)] = String(r.course_id); });
    }).catch(function () {});
    return loading;
  }

  function planImage(courseId, enrollmentId) {
    var plan = enrollmentId && planOfEnroll[String(enrollmentId)];
    if (plan && byCourse[plan]) return byCourse[plan];
    var list = courseId ? plansOfUnit[String(courseId)] || [] : [];
    for (var i = 0; i < list.length; i++) if (byCourse[list[i]]) return byCourse[list[i]];
    return "";
  }

  function url(courseId, cat, enrollmentId) {
    if (courseId && byCourse[String(courseId)]) return byCourse[String(courseId)];
    return planImage(courseId, enrollmentId) || CAT[String(cat || "")] || CAT.kraft;
  }

  global.GoCovers = {
    init: init,
    ready: function () { return loading || Promise.resolve(); },
    onReady: function (fn) { (loading || Promise.resolve()).then(fn); },
    url: url,
    count: function () { return Object.keys(byCourse).length; },
    hasCourseImage: function (courseId) { return !!(courseId && byCourse[String(courseId)]); }
  };
})(window);
