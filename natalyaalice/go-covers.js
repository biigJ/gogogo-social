/* go-covers.js — Coverbilder für Event-Karten statt reiner Farbflächen
 *
 *   GoCovers.init({ rest })      → lädt courses.image_url (nur Kurse mit Bild, go-medien.sql)
 *   GoCovers.ready()             → Promise
 *   GoCovers.url(courseId, cat, enrollmentId)
 *                                → Bild der Einzeleinheit, sonst Bild des Wochenplans
 *                                  (nur wenn das Event aus dieser Wochenplan-Einschreibung stammt),
 *                                  sonst Bild der Kategorie (Zirkel: Foto des eigenen Circles, falls gesetzt)
 *   GoCovers.setZirkel(url)      → Circle-Foto für Zirkel-Events ohne circle_id (leer = globales Zirkel-Bild)
 *   GoCovers.setCirclePhotos(map) → circle_id → Foto. Zirkel-Events mit circle_id zeigen immer das Foto IHRES Circles
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
  var zirkelCover = ""; // Foto des gerade gewählten Circles: nur für Zirkel-Events ohne circle_id
  var circlePhotos = {}; // circle_id → Foto (go_circle_photos)
  var planOfEnroll = {}; // Einschreibung → Wochenplan
  var loading = null;

  function init(h) {
    if (loading) return loading;
    if (!h || !h.rest) return (loading = Promise.resolve());
    var safe = function (p) { return h.rest(p).catch(function () { return []; }); };
    loading = Promise.all([
      safe("courses?image_url=not.is.null&select=id,image_url&limit=500"),
      /* alle Einschreibungen → Plan (go-plan-covers.sql), damit fremde Events das Plan-Bild des Besitzers zeigen; sonst nur eigene */
      h.rest("rpc/go_enrollment_plans", { method: "POST", body: {} }).catch(function () { return safe("enrollments?select=id,course_id&limit=500"); })
    ]).then(function (res) {
      (res[0] || []).forEach(function (r) { if (r && r.id && r.image_url) byCourse[String(r.id)] = r.image_url; });
      (res[1] || []).forEach(function (r) { if (r && r.id && r.course_id) planOfEnroll[String(r.id)] = String(r.course_id); });
    }).catch(function () {});
    return loading;
  }

  function planImage(courseId, enrollmentId) {
    var plan = enrollmentId && planOfEnroll[String(enrollmentId)];
    if (plan && byCourse[plan]) return byCourse[plan];
    return "";
  }

  function url(courseId, cat, enrollmentId, circleId) {
    /* Event eines Circles: immer das Foto genau dieses Circles, sonst das allgemeine Zirkel-Bild.
       Vorher bekam jedes Zirkel-Event das Foto des gerade gewählten Circles (falscher Circle im Kalender). */
    if (circleId) return circlePhotos[String(circleId)] || CAT.zirkel;
    if (String(cat || "") === "zirkel" && zirkelCover) return zirkelCover;
    if (courseId && byCourse[String(courseId)]) return byCourse[String(courseId)];
    return planImage(courseId, enrollmentId) || CAT[String(cat || "")] || CAT.kraft;
  }

  global.GoCovers = {
    init: init,
    ready: function () { return loading || Promise.resolve(); },
    onReady: function (fn) { (loading || Promise.resolve()).then(fn); },
    url: url,
    setZirkel: function (u) { zirkelCover = String(u || ""); },
    setCirclePhotos: function (m) { circlePhotos = {}; Object.keys(m || {}).forEach(function (k) { if (m[k]) circlePhotos[String(k)] = String(m[k]); }); },
    count: function () { return Object.keys(byCourse).length; },
    hasCourseImage: function (courseId) { return !!(courseId && byCourse[String(courseId)]); }
  };
})(window);
