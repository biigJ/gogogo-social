var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function queryValue(req, key) {
  if (req && req.query && req.query[key] != null) return String(req.query[key]);
  var raw = String((req && req.url) || "");
  var q = raw.indexOf("?") >= 0 ? raw.slice(raw.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get(key) || "";
}

function cleanName(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function sendJson(res, status, body) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.status(status).json(body);
    return;
  }
  res.writeHead(status, {
    "Content-Type": status === 200 ? "application/manifest+json; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "private, no-store"
  });
  res.end(JSON.stringify(body));
}

module.exports = function handler(req, res) {
  var id = queryValue(req, "id").trim();
  var name = cleanName(queryValue(req, "name"));
  if (!UUID_RE.test(id) || !name) {
    sendJson(res, 400, { error: "missing identity" });
    return;
  }
  var start = "/workout/?home=" + encodeURIComponent(id);
  sendJson(res, 200, {
    name: name,
    short_name: name,
    id: start,
    start_url: start,
    scope: "/workout/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#C7413B",
    theme_color: "#C7413B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" }
    ]
  });
};
