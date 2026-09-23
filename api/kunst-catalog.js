const crypto = require("crypto");

const REPO = process.env.KUNST_GITHUB_REPO || "biigJ/friday-circle";
const BRANCH = process.env.KUNST_GITHUB_BRANCH || "main";
const TOKEN = process.env.KUNST_GITHUB_TOKEN || "";
const PASSWORD = process.env.KUNST_ADMIN_PASSWORD || "";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string" && req.body) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (err) {
      return Promise.reject(err);
    }
  }
  return new Promise(function (resolve, reject) {
    var raw = "";
    req.on("data", function (chunk) {
      raw += chunk;
      if (raw.length > 12 * 1024 * 1024) {
        reject(new Error("Anfrage ist zu groß."));
        req.destroy();
      }
    });
    req.on("end", function () {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sign(value) {
  return crypto.createHmac("sha256", PASSWORD).update(String(value)).digest("hex");
}

function readCookie(req, name) {
  var header = req.headers.cookie || "";
  var parts = header.split(/;\s*/);
  for (var i = 0; i < parts.length; i++) {
    var pair = parts[i].split("=");
    if (pair[0] === name) return decodeURIComponent(pair.slice(1).join("="));
  }
  return "";
}

function isAuthed(req) {
  if (!PASSWORD) return false;
  var cookie = readCookie(req, "wga_admin");
  var bits = cookie.split(".");
  if (bits.length !== 2) return false;
  var exp = Number(bits[0]);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  var expected = sign(bits[0]);
  var given = Buffer.from(bits[1]);
  var want = Buffer.from(expected);
  if (given.length !== want.length) return false;
  return crypto.timingSafeEqual(given, want);
}

async function github(path, options) {
  var headers = Object.assign(
    {
      Accept: "application/vnd.github+json",
      "User-Agent": "wga-kunst-admin",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    (options && options.headers) || {}
  );
  if (TOKEN) headers.Authorization = "Bearer " + TOKEN;
  var res = await fetch("https://api.github.com" + path, {
    method: (options && options.method) || "GET",
    headers: headers,
    body: options && options.body ? JSON.stringify(options.body) : undefined,
  });
  var text = await res.text();
  var data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    var message = (data && data.message) || "GitHub " + res.status;
    var error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

async function readCatalog() {
  var data = await github(
    "/repos/" + REPO + "/contents/data/wga-catalog.json?ref=" + encodeURIComponent(BRANCH),
    { headers: { Accept: "application/vnd.github.raw" } }
  );
  if (typeof data === "string") return JSON.parse(data);
  if (data && data.content) {
    return JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  }
  return data;
}

async function commitFiles(files, message) {
  if (!TOKEN) {
    var error = new Error("KUNST_GITHUB_TOKEN fehlt auf dem Server.");
    error.status = 503;
    throw error;
  }
  var ref = await github("/repos/" + REPO + "/git/ref/heads/" + BRANCH);
  var parentSha = ref.object.sha;
  var parent = await github("/repos/" + REPO + "/git/commits/" + parentSha);
  var treeItems = [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var blob = await github("/repos/" + REPO + "/git/blobs", {
      method: "POST",
      body: { content: file.content, encoding: file.encoding || "utf-8" },
    });
    treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  var tree = await github("/repos/" + REPO + "/git/trees", {
    method: "POST",
    body: { base_tree: parent.tree.sha, tree: treeItems },
  });
  var commit = await github("/repos/" + REPO + "/git/commits", {
    method: "POST",
    body: { message: message, tree: tree.sha, parents: [parentSha] },
  });
  await github("/repos/" + REPO + "/git/refs/heads/" + BRANCH, {
    method: "PATCH",
    body: { sha: commit.sha },
  });
  return commit.sha;
}

module.exports = async function handler(req, res) {
  try {
    var url = new URL(req.url || "/", "http://localhost");
    if (req.method === "GET" && url.searchParams.get("config") === "1") {
      sendJson(res, 200, {
        password: !!PASSWORD,
        github: !!TOKEN,
        repo: REPO,
        branch: BRANCH,
      });
      return;
    }

    if (req.method === "GET") {
      sendJson(res, 200, await readCatalog());
      return;
    }

    if (req.method === "POST") {
      var login = await readBody(req);
      if (!PASSWORD) {
        sendJson(res, 503, { error: "KUNST_ADMIN_PASSWORD ist nicht gesetzt." });
        return;
      }
      var givenPassword = Buffer.from(String((login && login.password) || ""));
      var wantPassword = Buffer.from(PASSWORD);
      var passwordOk =
        givenPassword.length === wantPassword.length && crypto.timingSafeEqual(givenPassword, wantPassword);
      if (!passwordOk) {
        sendJson(res, 401, { error: "Falsches Passwort." });
        return;
      }
      var exp = Date.now() + 12 * 60 * 60 * 1000;
      var cookie = "wga_admin=" + exp + "." + sign(exp) + "; HttpOnly; Path=/; Max-Age=43200; SameSite=Lax";
      if (process.env.VERCEL) cookie += "; Secure";
      res.setHeader("Set-Cookie", cookie);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "PUT") {
      if (!isAuthed(req)) {
        sendJson(res, 401, { error: "Bitte zuerst anmelden." });
        return;
      }
      var body = await readBody(req);
      var files = Array.isArray(body.files) ? body.files : [];
      if (!files.length) {
        sendJson(res, 400, { error: "Keine Dateien." });
        return;
      }
      if (files.length > 40) {
        sendJson(res, 400, { error: "Zu viele Dateien." });
        return;
      }
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (!file || !file.path || !file.content) {
          sendJson(res, 400, { error: "Ungültige Datei." });
          return;
        }
        if (file.path.indexOf("..") !== -1 || file.path.charAt(0) === "/") {
          sendJson(res, 400, { error: "Ungültiger Pfad." });
          return;
        }
      }
      var sha = await commitFiles(files, body.message || "Kunstkatalog aktualisiert");
      sendJson(res, 200, { ok: true, sha: sha });
      return;
    }

    res.setHeader("Allow", "GET, POST, PUT");
    sendJson(res, 405, { error: "Methode nicht erlaubt." });
  } catch (err) {
    sendJson(res, err.status || 500, { error: err.message || "Fehler." });
  }
};
