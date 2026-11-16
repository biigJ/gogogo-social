/* go-covers.js — Coverbilder für Event-Karten statt reiner Farbflächen
 *
 *   GoCovers.init({ rest })      → lädt courses.image_url (nur Kurse mit Bild, go-medien.sql)
 *   GoCovers.ready()             → Promise
 *   GoCovers.url(courseId, cat)  → Kursbild, sonst Bild der Kategorie
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
  var loading = null;

  function init(h) {
    if (loading) return loading;
    loading = (h && h.rest
      ? h.rest("courses?image_url=not.is.null&select=id,image_url&limit=500")
      : Promise.resolve([]))
      .then(function (rows) {
        (rows || []).forEach(function (r) { if (r && r.id && r.image_url) byCourse[String(r.id)] = r.image_url; });
      })
      .catch(function () {});
    return loading;
  }

  function url(courseId, cat) {
    if (courseId && byCourse[String(courseId)]) return byCourse[String(courseId)];
    return CAT[String(cat || "")] || CAT.kraft;
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
