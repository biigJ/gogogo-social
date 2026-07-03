(function () {
  "use strict";

  var ADMIN_PIN = "friday";
  var SESSION_KEY = "fcCycleTableUser";

  var STATION_CATALOG = [
    { key: "run", nameDe: "Laufen", nameEn: "Run", defaultUnit: "m", defaultValue: "400" },
    { key: "ski-erg", nameDe: "SkiErg", nameEn: "SkiErg", defaultUnit: "m", defaultValue: "500" },
    { key: "sled-push", nameDe: "Sled Push", nameEn: "Sled Push", defaultUnit: "m", defaultValue: "50" },
    { key: "sled-pull", nameDe: "Sled Pull", nameEn: "Sled Pull", defaultUnit: "m", defaultValue: "50" },
    { key: "burpee", nameDe: "Burpee Broad Jump", nameEn: "Burpee Broad Jump", defaultUnit: "m", defaultValue: "80" },
    { key: "row", nameDe: "Rudern", nameEn: "Rowing", defaultUnit: "m", defaultValue: "500" },
    { key: "farmers", nameDe: "Farmers Carry", nameEn: "Farmers Carry", defaultUnit: "m", defaultValue: "200" },
    { key: "lunges", nameDe: "Sandbag Lunges", nameEn: "Sandbag Lunges", defaultUnit: "m", defaultValue: "100" },
    { key: "wallballs", nameDe: "Wall Balls", nameEn: "Wall Balls", defaultUnit: "rep", defaultValue: "100" },
  ];

  var DEFAULT_SEQUENCE_KEYS = ["run", "ski-erg", "run", "sled-push", "run", "row", "run", "burpee"];

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function getLang() {
    return document.documentElement.lang === "en" ? "en" : "de";
  }

  function t(de, en) {
    return getLang() === "en" ? en : de;
  }

  function slugName(name) {
    return String(name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9äöüß\-]/gi, "");
  }

  function toLocalIso(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function getNextFridayIso() {
    var now = new Date();
    var fri = new Date(now);
    var diff = (5 - fri.getDay() + 7) % 7;
    if (diff === 0 && now.getHours() > 20) diff = 7;
    fri.setDate(fri.getDate() + diff);
    return toLocalIso(fri);
  }

  function catalogItem(key) {
    return STATION_CATALOG.find(function (item) {
      return item.key === key;
    });
  }

  function stationLabel(item) {
    if (!item) return "—";
    return getLang() === "en" ? item.nameEn : item.nameDe;
  }

  function createStation(key) {
    var cat = catalogItem(key);
    if (!cat) return null;
    return {
      id: uid(),
      stationKey: cat.key,
      name: stationLabel(cat),
      positionPreset: "",
      positionFactor: "1",
      valuePreset: cat.defaultValue,
      unitPreset: cat.defaultUnit,
      userData: {},
    };
  }

  function loadUser() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function saveUser(user) {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }

  var state = {
    admin: false,
    user: loadUser(),
    date: getNextFridayIso(),
    workoutName: "Friday HYROX Cycle",
    roundCount: 6,
    stations: DEFAULT_SEQUENCE_KEYS.map(createStation).filter(Boolean),
    saving: false,
    drag: null,
  };

  var els = {};

  function qs(sel) {
    return document.querySelector(sel);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initEls() {
    els.gate = qs("#cycl-mobile-gate");
    els.builder = qs("#cycl-mobile-builder");
    els.stations = qs("#cycl-mobile-stations");
    els.pool = qs("#cycl-mobile-pool");
    els.date = qs("#cycl-mobile-date");
    els.workout = qs("#cycl-mobile-workout");
    els.rounds = qs("#cycl-mobile-rounds");
    els.saveBtn = qs("#cycl-mobile-save");
    els.previewBtn = qs("#cycl-mobile-preview");
    els.status = qs("#cycl-mobile-status");
    els.loginBar = qs("#cycl-mobile-login-bar");
    els.loginModal = qs("#cycl-login-modal");
  }

  function setStatus(msg, kind) {
    if (!els.status) return;
    els.status.textContent = msg || "";
    els.status.classList.remove("is-ok", "is-err");
    if (kind) els.status.classList.add(kind === "ok" ? "is-ok" : "is-err");
  }

  function renderLoginBar() {
    if (!els.loginBar) return;
    if (state.user && state.admin) {
      els.loginBar.innerHTML =
        '<span class="cycl-login-bar__user">' +
        t("Admin", "Admin") +
        ": <strong>" +
        escapeHtml(state.user.name) +
        '</strong></span><button type="button" class="cycl-login-bar__btn" id="cycl-mobile-logout">' +
        t("Abmelden", "Sign out") +
        "</button>";
      var btn = qs("#cycl-mobile-logout");
      if (btn) btn.addEventListener("click", logout);
    } else {
      els.loginBar.innerHTML =
        '<button type="button" class="cycl-login-bar__btn cycl-login-bar__btn--primary" id="cycl-mobile-open-login">' +
        t("Admin-Login", "Admin sign-in") +
        "</button>";
      var openBtn = qs("#cycl-mobile-open-login");
      if (openBtn) openBtn.addEventListener("click", openModal);
    }
  }

  function openModal() {
    if (els.loginModal) els.loginModal.hidden = false;
  }

  function closeModal() {
    if (els.loginModal) els.loginModal.hidden = true;
  }

  function logout() {
    state.user = null;
    state.admin = false;
    saveUser(null);
    renderGate();
  }

  function handleLogin(e) {
    e.preventDefault();
    var nameInput = qs("#cycl-login-name");
    var pinInput = qs("#cycl-login-pin");
    var err = qs("#cycl-login-error");
    var name = nameInput && nameInput.value.trim();
    var pin = pinInput && pinInput.value.trim();
    if (!name || !pin) {
      if (err) {
        err.textContent = t("Name und PIN eingeben.", "Enter name and PIN.");
        err.hidden = false;
      }
      return;
    }
    if (pin !== ADMIN_PIN) {
      if (err) {
        err.textContent = t("Nur Admin-PIN „friday“.", 'Admin PIN is "friday" only.');
        err.hidden = false;
      }
      return;
    }
    state.admin = true;
    state.user = { name: name, slug: slugName(name) };
    saveUser(state.user);
    closeModal();
    renderGate();
  }

  function renderGate() {
    var allowed = state.admin;
    if (els.gate) els.gate.hidden = allowed;
    if (els.builder) els.builder.hidden = !allowed;
    if (els.saveBtn) els.saveBtn.disabled = !allowed || state.saving;
    renderLoginBar();
    if (allowed) {
      renderMeta();
      renderStations();
      renderPool();
    }
  }

  function renderMeta() {
    if (els.date) els.date.value = state.date;
    if (els.workout) els.workout.value = state.workoutName;
    if (els.rounds) {
      els.rounds.innerHTML = [6, 7, 8]
        .map(function (n) {
          return (
            '<button type="button" class="cycl-mobile-rounds__btn' +
            (state.roundCount === n ? " is-active" : "") +
            '" data-rounds="' +
            n +
            '">' +
            n +
            " " +
            t("Rdn.", "rds.") +
            "</button>"
          );
        })
        .join("");
      els.rounds.querySelectorAll("[data-rounds]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.roundCount = parseInt(btn.getAttribute("data-rounds"), 10);
          renderMeta();
        });
      });
    }
  }

  function stationCardHtml(station, index) {
    return (
      '<article class="cycl-mobile-station" data-station-id="' +
      escapeHtml(station.id) +
      '" draggable="false">' +
      '<button type="button" class="cycl-mobile-station__handle" aria-label="' +
      t("Reihenfolge ändern", "Reorder") +
      '" data-drag-handle>☰</button>' +
      '<div class="cycl-mobile-station__body">' +
      '<p class="cycl-mobile-station__name">' +
      (index + 1) +
      ". " +
      escapeHtml(station.name) +
      "</p>" +
      '<div class="cycl-mobile-station__fields">' +
      fieldHtml("positionPreset", t("Position", "Position"), station.positionPreset) +
      fieldHtml("positionFactor", t("Pos.-Faktor", "Pos. factor"), station.positionFactor) +
      fieldHtml("valuePreset", t("Wert-Vorgabe", "Value preset"), station.valuePreset) +
      unitSelectHtml(station.unitPreset) +
      "</div></div>" +
      '<button type="button" class="cycl-mobile-station__remove" aria-label="' +
      t("Entfernen", "Remove") +
      '" data-remove>&times;</button></article>'
    );
  }

  function fieldHtml(field, label, value) {
    return (
      '<label class="cycl-mobile-station__field"><span class="cycl-mobile-station__lab">' +
      escapeHtml(label) +
      '</span><input type="text" data-field="' +
      field +
      '" value="' +
      escapeHtml(value || "") +
      '" inputmode="decimal" /></label>'
    );
  }

  function unitSelectHtml(value) {
    var units = ["m", "rep", "sec", "kg", "cal"];
    return (
      '<label class="cycl-mobile-station__field"><span class="cycl-mobile-station__lab">' +
      t("Einheit", "Unit") +
      '</span><select data-field="unitPreset">' +
      units
        .map(function (u) {
          return (
            '<option value="' +
            u +
            '"' +
            (value === u ? " selected" : "") +
            ">" +
            u +
            "</option>"
          );
        })
        .join("") +
      "</select></label>"
    );
  }

  function renderStations() {
    if (!els.stations) return;
    if (!state.stations.length) {
      els.stations.innerHTML =
        '<p class="cycl-mobile-empty">' +
        t("Stationen aus dem Pool unten hinzufügen.", "Add stations from the pool below.") +
        "</p>";
      return;
    }
    els.stations.innerHTML = state.stations.map(stationCardHtml).join("");
    bindStationEvents();
  }

  function bindStationEvents() {
    if (!els.stations) return;

    els.stations.querySelectorAll(".cycl-mobile-station").forEach(function (card) {
      var id = card.getAttribute("data-station-id");
      card.querySelectorAll("[data-field]").forEach(function (input) {
        input.addEventListener("change", function () {
          var station = state.stations.find(function (s) {
            return s.id === id;
          });
          if (!station) return;
          station[input.getAttribute("data-field")] = input.value.trim();
        });
      });
      var removeBtn = card.querySelector("[data-remove]");
      if (removeBtn) {
        removeBtn.addEventListener("click", function () {
          state.stations = state.stations.filter(function (s) {
            return s.id !== id;
          });
          renderStations();
        });
      }
      var handle = card.querySelector("[data-drag-handle]");
      if (handle) bindDrag(handle, card);
    });
  }

  function bindDrag(handle, card) {
    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      var id = card.getAttribute("data-station-id");
      var fromIndex = state.stations.findIndex(function (s) {
        return s.id === id;
      });
      if (fromIndex < 0) return;

      state.drag = { id: id, fromIndex: fromIndex, pointerId: e.pointerId };
      card.classList.add("is-dragging");
      handle.setPointerCapture(e.pointerId);

      function onMove(ev) {
        if (!state.drag || ev.pointerId !== state.drag.pointerId) return;
        var target = document.elementFromPoint(ev.clientX, ev.clientY);
        var targetCard = target && target.closest(".cycl-mobile-station");
        els.stations.querySelectorAll(".cycl-mobile-station").forEach(function (el) {
          el.classList.toggle("is-drop-target", el === targetCard && el.getAttribute("data-station-id") !== id);
        });
        if (!targetCard || targetCard.getAttribute("data-station-id") === id) return;
        var toIndex = state.stations.findIndex(function (s) {
          return s.id === targetCard.getAttribute("data-station-id");
        });
        if (toIndex < 0 || toIndex === fromIndex) return;
        var moved = state.stations.splice(fromIndex, 1)[0];
        state.stations.splice(toIndex, 0, moved);
        fromIndex = toIndex;
        state.drag.fromIndex = toIndex;
        renderStations();
        var newCard = els.stations.querySelector('[data-station-id="' + id + '"]');
        if (newCard) newCard.classList.add("is-dragging");
      }

      function onUp(ev) {
        if (!state.drag || ev.pointerId !== state.drag.pointerId) return;
        state.drag = null;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        els.stations.querySelectorAll(".cycl-mobile-station").forEach(function (el) {
          el.classList.remove("is-dragging", "is-drop-target");
        });
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch (err) {}
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  function renderPool() {
    if (!els.pool) return;
    els.pool.innerHTML = STATION_CATALOG.map(function (item) {
      var cls = item.key === "run" ? " cycl-mobile-pool__chip--run" : "";
      return (
        '<button type="button" class="cycl-mobile-pool__chip' +
        cls +
        '" data-add="' +
        item.key +
        '">+ ' +
        escapeHtml(stationLabel(item)) +
        "</button>"
      );
    }).join("");
    els.pool.querySelectorAll("[data-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var station = createStation(btn.getAttribute("data-add"));
        if (station) {
          state.stations.push(station);
          renderStations();
        }
      });
    });
  }

  function applyPositionsFromOrder() {
    state.stations.forEach(function (station, i) {
      if (!station.positionPreset) station.positionPreset = String(i + 1);
    });
  }

  function buildSessionPayload() {
    applyPositionsFromOrder();
    return {
      id: uid(),
      date: state.date,
      workoutName: state.workoutName.trim() || "Friday HYROX Cycle",
      roundCount: state.roundCount,
      exercises: state.stations.map(function (s) {
        return {
          id: s.id,
          stationKey: s.stationKey,
          name: s.name,
          positionPreset: s.positionPreset,
          positionFactor: s.positionFactor,
          valuePreset: s.valuePreset,
          unitPreset: s.unitPreset,
          userData: s.userData || {},
        };
      }),
      participants: {},
    };
  }

  function saveSession() {
    if (!state.admin || state.saving) return;
    if (!state.date) {
      setStatus(t("Datum fehlt.", "Date missing."), "err");
      return;
    }
    if (!state.stations.length) {
      setStatus(t("Mindestens eine Station.", "At least one station."), "err");
      return;
    }

    state.saving = true;
    if (els.saveBtn) els.saveBtn.disabled = true;
    setStatus(t("Speichern …", "Saving …"));

    var payload = buildSessionPayload();
    var remote = window.fcCycleSupabase && window.fcCycleSupabase.isConfigured();

    function finish(ok, msg) {
      state.saving = false;
      if (els.saveBtn) els.saveBtn.disabled = !state.admin;
      setStatus(msg, ok ? "ok" : "err");
    }

    function persistLocal(data) {
      try {
        var raw = localStorage.getItem("fcCycleTableData");
        var store = raw ? JSON.parse(raw) : { sessions: [], users: [] };
        var idx = store.sessions.findIndex(function (s) {
          return s.date === payload.date;
        });
        if (idx >= 0) {
          payload.id = store.sessions[idx].id;
          payload.participants = store.sessions[idx].participants || {};
          payload.exercises = payload.exercises.map(function (ex) {
            var old = (store.sessions[idx].exercises || []).find(function (o) {
              return o.stationKey === ex.stationKey && o.name === ex.name;
            });
            if (old && old.userData) ex.userData = old.userData;
            return ex;
          });
          store.sessions[idx] = payload;
        } else {
          store.sessions.push(payload);
        }
        localStorage.setItem("fcCycleTableData", JSON.stringify(store));
      } catch (e) {}
    }

    persistLocal();

    if (!remote) {
      finish(true, t("Lokal gespeichert. Supabase noch nicht konfiguriert.", "Saved locally. Supabase not configured yet."));
      return;
    }

    window.fcCycleSupabase
      .upsertSession(payload)
      .then(function () {
        finish(
          true,
          t(
            "Training gespeichert — Tabelle ist gefüllt.",
            "Session saved — table is ready."
          )
        );
      })
      .catch(function (err) {
        console.error(err);
        finish(
          false,
          t("Cloud-Fehler, lokal gespeichert.", "Cloud error; saved locally.")
        );
      });
  }

  function bindStatic() {
    var loginForm = qs("#cycl-login-form");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    var closeBtn = qs("#cycl-login-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    var backdrop = qs(".cycl-login-modal__backdrop");
    if (backdrop) backdrop.addEventListener("click", closeModal);

    if (els.date) {
      els.date.addEventListener("change", function () {
        state.date = els.date.value;
      });
    }
    if (els.workout) {
      els.workout.addEventListener("input", function () {
        state.workoutName = els.workout.value;
      });
    }
    if (els.saveBtn) els.saveBtn.addEventListener("click", saveSession);
    if (els.previewBtn) {
      els.previewBtn.addEventListener("click", function () {
        window.location.href = "cycle-table.html";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initEls();
    if (els.date && !els.date.value) els.date.value = state.date;
    bindStatic();
    renderGate();
  });
})();
