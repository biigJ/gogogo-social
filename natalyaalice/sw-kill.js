/* Abgelöst: meldet sich auf Geräten ab, die ihn noch registriert haben. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) {
  event.waitUntil(self.registration.unregister());
});
