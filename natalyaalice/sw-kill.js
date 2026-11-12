/* gogogo PWA cache nuke — forces fresh /workout HTML */
var BUILD = "nav5-no-cover-14";

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var isDoc = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0;
  var isWorkout = url.pathname === "/workout" || url.pathname === "/workout/" ||
    url.pathname.indexOf("/natalyaalice/") === 0;
  if (!isDoc || !isWorkout) return;
  event.respondWith(
    fetch(new Request(req.url, { cache: "reload", credentials: req.credentials, headers: req.headers }))
      .catch(function () { return fetch(req); })
  );
});

self.addEventListener("message", function (event) {
  if (!event.data || event.data.type !== "GOGOGO_NUKE") return;
  caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return caches.delete(k); }));
  }).then(function () {
    if (event.source && event.source.postMessage) {
      event.source.postMessage({ type: "GOGOGO_NUKED", build: BUILD });
    }
  });
});
