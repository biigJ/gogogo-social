(function () {
  var edit = window.WgaCatalogEdit;
  var catalog = null;
  var uploads = [];
  var gate = document.getElementById("gate");
  var app = document.getElementById("app");
  var listEl = document.getElementById("list");
  var statusEl = document.getElementById("status");
  var editor = document.getElementById("editor-form");
  var searchEl = document.getElementById("search");
  var serverMode = false;

  function assetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || path.indexOf("data:") === 0) return path;
    var origin = window.WGA_ASSET_ORIGIN;
    if (origin == null && !/biig\.works$/i.test(location.hostname)) origin = "https://www.biig.works";
    var clean = String(path).replace(/^\//, "");
    if (!origin) return "/" + clean;
    return String(origin).replace(/\/$/, "") + "/" + clean;
  }

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", !!isError);
  }

  function chapterLabel(section) {
    return section.chapter || section.title || section.id;
  }

  function workNumber(work) {
    var parsed = edit.parseCatalogId(work.catalogId || work.id);
    return parsed ? parsed.num : "";
  }

  function cloneCatalog(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function loadCatalog() {
    var local = await fetch("/data/wga-catalog.json", { cache: "no-store" });
    if (!local.ok) throw new Error("Katalog fehlt.");
    var embedded = await local.json();
    var remote = null;
    try {
      var live = await fetch("/api/kunst-catalog", { cache: "no-store" });
      if (live.ok) remote = await live.json();
    } catch (err) {}
    var embeddedStamp = Date.parse((embedded.meta && embedded.meta.updatedAt) || "") || 0;
    var remoteStamp = Date.parse((remote && remote.meta && remote.meta.updatedAt) || "") || 0;
    catalog = cloneCatalog(remote && remote.sections && remoteStamp > embeddedStamp ? remote : embedded);
  }

  function sectionOptions(selected) {
    return (catalog.sections || [])
      .map(function (section) {
        var sel = section.id === selected ? " selected" : "";
        return '<option value="' + escapeAttr(section.id) + '"' + sel + ">" + escapeHtml(chapterLabel(section)) + "</option>";
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function renderList() {
    var query = (searchEl.value || "").trim().toLowerCase();
    var html = "";
    (catalog.sections || []).forEach(function (section) {
      (section.works || []).forEach(function (work) {
        if (work.empty) return;
        var hay = [chapterLabel(section), work.medium, work.title, work.catalogId, work.year, work.price, work.dimensions]
          .join(" ")
          .toLowerCase();
        if (query && hay.indexOf(query) === -1) return;
        var red = work.berlinStatus === "unavailable";
        var img = (work.images && work.images[0]) || "";
        html +=
          '<article class="work">' +
          '<img alt="" src="' + escapeAttr(assetUrl(img)) + '" />' +
          "<div><h3>" + escapeHtml(work.medium || work.title || "Werk") + " Nr. " + escapeHtml(workNumber(work)) + "</h3>" +
          "<p>" + escapeHtml(chapterLabel(section)) +
          (work.dimensions && work.dimensions !== "—" ? " · " + escapeHtml(work.dimensions) : "") +
          (work.price ? " · " + escapeHtml(work.price) : "") +
          "</p></div>" +
          '<div class="row">' +
          '<button type="button" class="dot' + (red ? " is-red" : "") + '" data-dot="' + escapeAttr(work.id) + '" aria-label="Roter Punkt"></button>' +
          '<button type="button" class="ghost" data-edit="' + escapeAttr(work.id) + '">Bearbeiten</button>' +
          "</div></article>";
      });
    });
    listEl.innerHTML = html || "<p class=\"lede\">Keine Werke.</p>";
  }

  function fillEditor(work, section) {
    editor.classList.add("is-open");
    document.getElementById("edit-id").value = work ? work.id : "";
    document.getElementById("edit-section").innerHTML = sectionOptions(section ? section.id : (catalog.sections[0] && catalog.sections[0].id));
    document.getElementById("edit-number").value = work ? workNumber(work) : "";
    document.getElementById("edit-medium").value = work ? work.medium || "" : "";
    document.getElementById("edit-year").value = work && work.year && work.year !== "—" ? work.year : "";
    document.getElementById("edit-dimensions").value = work && work.dimensions && work.dimensions !== "—" ? work.dimensions : "";
    document.getElementById("edit-price").value = work ? work.price || "" : "";
    document.getElementById("edit-red").checked = !!(work && work.berlinStatus === "unavailable");
    document.getElementById("edit-file").value = "";
    document.getElementById("edit-title").textContent = work ? "Werk bearbeiten" : "Neues Werk";
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var url = URL.createObjectURL(file);
      image.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(image.width, image.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error("Bild konnte nicht verarbeitet werden."));
            var reader = new FileReader();
            reader.onload = function () {
              var base64 = String(reader.result).split(",")[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          "image/webp",
          0.82
        );
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Bild konnte nicht gelesen werden."));
      };
      image.src = url;
    });
  }

  async function github(token, method, path, body) {
    var res = await fetch("https://api.github.com" + path, {
      method: method,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    var text = await res.text();
    var data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error((data && data.message) || "GitHub " + res.status);
    return data;
  }

  async function commitWithToken(token, repo, branch, files, message) {
    var ref = await github(token, "GET", "/repos/" + repo + "/git/ref/heads/" + branch);
    var parentSha = ref.object.sha;
    var parent = await github(token, "GET", "/repos/" + repo + "/git/commits/" + parentSha);
    var tree = [];
    for (var i = 0; i < files.length; i++) {
      var blob = await github(token, "POST", "/repos/" + repo + "/git/blobs", {
        content: files[i].content,
        encoding: files[i].encoding || "utf-8",
      });
      tree.push({ path: files[i].path, mode: "100644", type: "blob", sha: blob.sha });
    }
    var nextTree = await github(token, "POST", "/repos/" + repo + "/git/trees", {
      base_tree: parent.tree.sha,
      tree: tree,
    });
    var commit = await github(token, "POST", "/repos/" + repo + "/git/commits", {
      message: message,
      tree: nextTree.sha,
      parents: [parentSha],
    });
    await github(token, "PATCH", "/repos/" + repo + "/git/refs/heads/" + branch, { sha: commit.sha });
    return commit.sha;
  }

  async function textFile(url) {
    var res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(url + " fehlt (" + res.status + ")");
    return res.text();
  }

  function patchBuildScript(source) {
    if (source.indexOf("biig-interior/kunst/admin") !== -1) return source;
    var needle = 'cp "$ROOT/biig-interior/$BIIG_PAGE/index.html" "$BIIG_OUT/$BIIG_PAGE/index.html"\ndone\n';
    var insert =
      needle +
      'mkdir -p "$BIIG_OUT/kunst/admin"\n' +
      'if [[ -d "$ROOT/biig-interior/kunst/admin" ]]; then\n' +
      '  cp -a "$ROOT/biig-interior/kunst/admin/." "$BIIG_OUT/kunst/admin/"\n' +
      "fi\n" +
      'if [[ -f "$ROOT/biig-interior/kunst/catalog-edit.js" ]]; then\n' +
      '  cp "$ROOT/biig-interior/kunst/catalog-edit.js" "$BIIG_OUT/kunst/catalog-edit.js"\n' +
      "fi\n";
    if (source.indexOf(needle) === -1) return source;
    return source.replace(needle, insert);
  }

  async function codeFiles(repo, branch, token) {
    var pairs = [
      ["/wolfganggrope.js", "wolfganggrope.js"],
      ["/wolfganggrope.css", "wolfganggrope.css"],
      ["/biig-interior/kunst/index.html", "biig-interior/kunst/index.html"],
      ["/biig-interior/kunst/catalog-edit.js", "biig-interior/kunst/catalog-edit.js"],
      ["/biig-interior/kontakt/index.html", "biig-interior/kontakt/index.html"],
      ["/kunst/admin/index.html", "biig-interior/kunst/admin/index.html"],
      ["/kunst/admin/admin.js", "biig-interior/kunst/admin/admin.js"],
      ["/kunst/admin/admin.css", "biig-interior/kunst/admin/admin.css"],
      ["/kunst/server/kunst-catalog.js", "api/kunst-catalog.js"],
    ];
    var files = [];
    for (var i = 0; i < pairs.length; i++) {
      files.push({ path: pairs[i][1], content: await textFile(pairs[i][0]), encoding: "utf-8" });
    }
    try {
      var pageRes = await fetch(
        "https://raw.githubusercontent.com/" + repo + "/" + branch + "/wolfganggrope.html",
        { cache: "no-store" }
      );
      if (pageRes.ok) {
        var pageHtml = await pageRes.text();
        pageHtml = pageHtml.replace("Joscha, Berlin Juni 2026", "Joscha, Berlin 2026");
        pageHtml = pageHtml.replace("Joscha, Berlin June 2026", "Joscha, Berlin 2026");
        var oldFooter = '<p id="wga-popup-index" class="wga-popup__index"></p>';
        var newFooter =
          '<div class="wga-popup__indexline">\n              <p id="wga-popup-index" class="wga-popup__index"></p>\n              <p id="wga-popup-meta" class="wga-popup__meta" hidden></p>\n            </div>';
        if (pageHtml.indexOf("wga-popup-meta") === -1 && pageHtml.indexOf(oldFooter) !== -1) {
          pageHtml = pageHtml.replace(oldFooter, newFooter);
        }
        files.push({ path: "wolfganggrope.html", content: pageHtml, encoding: "utf-8" });
      }
    } catch (err) {}
    try {
      var scriptHeaders = { Accept: "application/vnd.github.raw" };
      if (token) scriptHeaders.Authorization = "Bearer " + token;
      var scriptRes = await fetch(
        "https://api.github.com/repos/" + repo + "/contents/scripts/build-biig-works.sh?ref=" + encodeURIComponent(branch),
        { headers: scriptHeaders }
      );
      if (scriptRes.ok) {
        files.push({
          path: "scripts/build-biig-works.sh",
          content: patchBuildScript(await scriptRes.text()),
          encoding: "utf-8",
        });
      }
    } catch (err) {}
    return files;
  }

  function catalogFiles() {
    var json = JSON.stringify(catalog, null, 2) + "\n";
    return [
      { path: "data/wga-catalog.json", content: json, encoding: "utf-8" },
      { path: "data/wga-catalog.js", content: "window.__WGA_CATALOG__=" + json.trim() + ";\n", encoding: "utf-8" },
    ];
  }

  async function publish() {
    var includeCode = document.getElementById("include-code").checked;
    var files = catalogFiles().concat(uploads);
    var repo = (document.getElementById("repo") && document.getElementById("repo").value.trim()) || "biigJ/friday-circle";
    var branch = (document.getElementById("branch") && document.getElementById("branch").value.trim()) || "main";
    setStatus("Veröffentlichen …");
    if (includeCode) {
      var tokenForScript = serverMode ? "" : sessionStorage.getItem("wga-gh-token") || "";
      files = files.concat(await codeFiles(repo, branch, tokenForScript));
    }
    if (serverMode) {
      var res = await fetch("/api/kunst-catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Kunstkatalog aktualisiert", files: files }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen.");
    } else {
      var token = sessionStorage.getItem("wga-gh-token") || "";
      if (!token) throw new Error("GitHub-Token fehlt.");
      await commitWithToken(token, repo, branch, files, "Kunstkatalog aktualisiert");
    }
    uploads = [];
    setStatus("Veröffentlicht. biig.works baut den Katalog jetzt neu. Das dauert meist eine Minute.");
  }

  async function onSave(event) {
    event.preventDefault();
    var id = document.getElementById("edit-id").value;
    var file = document.getElementById("edit-file").files[0];
    var patch = {
      sectionId: document.getElementById("edit-section").value,
      number: document.getElementById("edit-number").value,
      medium: document.getElementById("edit-medium").value,
      year: document.getElementById("edit-year").value,
      dimensions: document.getElementById("edit-dimensions").value,
      price: document.getElementById("edit-price").value,
      berlinStatus: document.getElementById("edit-red").checked ? "unavailable" : "available",
    };
    var base64 = "";
    var imagePath = "";
    if (file) {
      base64 = await readFile(file);
      var section = (catalog.sections || []).filter(function (item) {
        return item.id === patch.sectionId;
      })[0];
      var futureId = id || "wg-" + edit.chapterNoFromSection(section) + "-" + edit.pad3(patch.number);
      imagePath = "assets/wolfgang-grope/uploads/" + futureId + "-" + Date.now() + ".webp";
      patch.images = [imagePath];
    }
    var error = id ? edit.updateWork(catalog, id, patch) : edit.addWork(catalog, patch);
    if (error) {
      setStatus(error, true);
      return;
    }
    if (base64) uploads.push({ path: imagePath, content: base64, encoding: "base64" });
    editor.classList.remove("is-open");
    renderList();
    setStatus("Änderung vorgemerkt. Mit „Veröffentlichen“ auf die Website schreiben.");
  }

  document.getElementById("editor-form").addEventListener("submit", function (event) {
    onSave(event).catch(function (err) {
      setStatus(err.message, true);
    });
  });
  document.getElementById("editor-cancel").addEventListener("click", function () {
    editor.classList.remove("is-open");
  });
  document.getElementById("add").addEventListener("click", function () {
    fillEditor(null, null);
  });
  document.getElementById("publish").addEventListener("click", function () {
    publish().catch(function (err) {
      setStatus(err.message, true);
    });
  });
  searchEl.addEventListener("input", renderList);
  listEl.addEventListener("click", function (event) {
    var dot = event.target.closest("[data-dot]");
    if (dot) {
      var current = edit.findWork(catalog, dot.getAttribute("data-dot"));
      if (!current) return;
      edit.setUnavailable(catalog, current.work.id, current.work.berlinStatus !== "unavailable");
      renderList();
      setStatus("Roter Punkt vorgemerkt.");
      return;
    }
    var button = event.target.closest("[data-edit]");
    if (!button) return;
    var found = edit.findWork(catalog, button.getAttribute("data-edit"));
    if (!found) return;
    fillEditor(found.work, found.section);
  });
  document.getElementById("delete").addEventListener("click", function () {
    var id = document.getElementById("edit-id").value;
    if (!id) {
      editor.classList.remove("is-open");
      return;
    }
    if (!window.confirm("Dieses Werk aus dem Katalog entfernen?")) return;
    var error = edit.removeWork(catalog, id);
    if (error) {
      setStatus(error, true);
      return;
    }
    editor.classList.remove("is-open");
    renderList();
    setStatus("Löschen vorgemerkt.");
  });

  async function boot() {
    var config = { password: false, github: false, repo: "biigJ/friday-circle", branch: "main" };
    try {
      var res = await fetch("/api/kunst-catalog?config=1", { cache: "no-store" });
      if (res.ok) config = await res.json();
    } catch (err) {}
    document.getElementById("repo").value = config.repo || "biigJ/friday-circle";
    document.getElementById("branch").value = config.branch || "main";
    serverMode = !!(config.password && config.github);
    document.getElementById("password-fields").hidden = !serverMode;
    document.getElementById("token-fields").hidden = serverMode;
    if (!serverMode && sessionStorage.getItem("wga-gh-token")) {
      await enterApp();
      return;
    }
  }

  async function enterApp() {
    gate.hidden = true;
    app.hidden = false;
    await loadCatalog();
    renderList();
    setStatus("Bereit.");
  }

  document.getElementById("login").addEventListener("submit", function (event) {
    event.preventDefault();
    var run = serverMode
      ? fetch("/api/kunst-catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: document.getElementById("password").value }),
        }).then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || "Anmeldung fehlgeschlagen.");
          });
        })
      : Promise.resolve().then(function () {
          var token = document.getElementById("token").value.trim();
          if (!token) throw new Error("Token fehlt.");
          sessionStorage.setItem("wga-gh-token", token);
        });
    run.then(enterApp).catch(function (err) {
      setStatus(err.message, true);
    });
  });

  boot().catch(function (err) {
    setStatus(err.message, true);
  });
})();
