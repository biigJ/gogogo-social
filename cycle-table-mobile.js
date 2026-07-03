(function () {
  "use strict";

  var ADMIN_PIN = "friday";
  var SESSION_KEY = "fcCycleTableUser";

  var STATION_CATALOG = [
    { key: "run", icon: "🏃", nameDe: "Laufen", nameEn: "Run", defaultUnit: "m", defaultValue: "400" },
    { key: "ski-erg", icon: "⛷", nameDe: "SkiErg", nameEn: "SkiErg", defaultUnit: "m", defaultValue: "500" },
    { key: "sled-push", icon: "🛷", nameDe: "Sled Push", nameEn: "Sled Push", defaultUnit: "m", defaultValue: "50" },
    { key: "sled-pull", icon: "🔗", nameDe: "Sled Pull", nameEn: "Sled Pull", defaultUnit: "m", defaultValue: "50" },
    { key: "burpee", icon: "⬆", nameDe: "Burpee Broad Jump", nameEn: "Burpee Broad Jump", defaultUnit: "m", defaultValue: "80" },
    { key: "row", icon: "🚣", nameDe: "Rudern", nameEn: "Rowing", defaultUnit: "m", defaultValue: "500" },
    { key: "farmers", icon: "🏋", nameDe: "Farmers Carry", nameEn: "Farmers Carry", defaultUnit: "m", defaultValue: "200" },
    { key: "lunges", icon: "🦵", nameDe: "Sandbag Lunges", nameEn: "Sandbag Lunges", defaultUnit: "m", defaultValue: "100" },
    { key: "wallballs", icon: "⚽", nameDe: "Wall Balls", nameEn: "Wall Balls", defaultUnit: "rep", defaultValue: "100" },
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
      icon: cat.icon,
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

  function pickerValues(unit, current) {
    var cur = parseInt(current, 10) || 0;
    var vals = [];
    if (unit === "rep") {
      for (var r = 10; r <= 150; r += 5) vals.push(r);
    } else if (unit === "sec") {
      for (var s = 30; s <= 600; s += 15) vals.push(s);
    } else if (unit === "kg") {
      for (var k = 5; k <= 200; k += 5) vals.push(k);
    } else {
      for (var m = 50; m <= 1000; m += 50) vals.push(m);
    }
    if (cur && vals.indexOf(cur) === -1) {
      vals.push(cur);
      vals.sort(function (a, b) {
        return a - b;
      });
    }
    return vals;
  }

  var state = {
    admin: false,
    user: loadUser(),
    date: getNextFridayIso(),
    workoutName: "Friday HYROX Cycle",
    roundCount: 6,
    stations: DEFAULT_SEQUENCE_KEYS.map(createStation).filter(Boolean),
    stepIndex: 0,
    saving: false,
    drag: null,
  };

  var els = {};

  function qs(sel) {
    return document.querySelector(sel);
  }

  function initEls() {
    els.gate = qs("#cm-gate");
    els.work = qs("#cm-work");
    els.top = qs("#cm-top");
    els.drawer = qs("#cm-drawer");
    els.count = qs("#cm-count");
    els.track = qs("#cm-track");
    els.stationName = qs("#cm-station-name");
    els.stationIcon = qs("#cm-station-icon");
    els.statTarget = qs("#cm-stat-target");
    els.statPos = qs("#cm-stat-pos");
    els.statRounds = qs("#cm-stat-rounds");
    els.valueDisplay = qs("#cm-value-display");
    els.prompt = qs("#cm-prompt");
    els.picker = qs("#cm-picker");
    els.cta = qs("#cm-cta");
    els.status = qs("#cm-status");
    els.date = qs("#cm-date");
    els.workout = qs("#cm-workout");
    els.rounds = qs("#cm-rounds");
    els.pool = qs("#cm-pool");
    els.settingsSheet = qs("#cm-settings-sheet");
    els.loginModal = qs("#cycl-login-modal");
  }

  function currentStation() {
    return state.stations[state.stepIndex] || null;
  }

  function setStatus(msg, kind) {
    if (!els.status) return;
    els.status.textContent = msg || "";
    els.status.className = "cm-status" + (kind === "ok" ? " cm-status--ok" : kind === "err" ? " cm-status--err" : "");
  }

  function openModal() {
    if (els.loginModal) els.loginModal.hidden = false;
  }

  function closeModal() {
    if (els.loginModal) els.loginModal.hidden = true;
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
    renderApp();
  }

  function renderApp() {
    var on = state.admin && state.stations.length > 0;
    if (els.gate) els.gate.hidden = state.admin;
    if (els.work) els.work.hidden = !on;
    if (els.top) els.top.hidden = !state.admin;
    if (els.drawer) els.drawer.hidden = !state.admin;

    if (!state.admin) return;

    if (state.stepIndex >= state.stations.length) {
      state.stepIndex = Math.max(0, state.stations.length - 1);
    }

    renderTrack();
    renderStation();
    renderPicker();
    renderMetaFields();
  }

  function renderTrack() {
    if (!els.track) return;
    var html = state.stations
      .map(function (st, i) {
        var cat = catalogItem(st.stationKey);
        var icon = (cat && cat.icon) || st.icon || "•";
        var cls = "cm-track__item";
        if (i === state.stepIndex) cls += " is-active";
        if (i < state.stepIndex) cls += " is-done";
        return (
          '<button type="button" class="' +
          cls +
          '" data-track-idx="' +
          i +
          '" aria-label="' +
          st.name +
          '">' +
          icon +
          "</button>"
        );
      })
      .join("");
    html +=
      '<button type="button" class="cm-track__item cm-track__add" id="cm-track-add" aria-label="' +
      t("Station", "Station") +
      '">+</button>';
    els.track.innerHTML = html;

    els.track.querySelectorAll("[data-track-idx]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.stepIndex = parseInt(btn.getAttribute("data-track-idx"), 10);
        renderApp();
      });
      bindTrackDrag(btn);
    });

    var addBtn = qs("#cm-track-add");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        openSettings();
      });
    }

    var active = els.track.querySelector(".is-active");
    if (active) active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  function bindTrackDrag(btn) {
    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      var idx = parseInt(btn.getAttribute("data-track-idx"), 10);
      var startX = e.clientX;
      var moved = false;
      var pointerId = e.pointerId;

      function onMove(ev) {
        if (ev.pointerId !== pointerId) return;
        if (Math.abs(ev.clientX - startX) < 14) return;
        moved = true;
        btn.classList.add("is-dragging");
        var target = document.elementFromPoint(ev.clientX, ev.clientY);
        var targetBtn = target && target.closest("[data-track-idx]");
        if (!targetBtn || targetBtn === btn) return;
        var toIdx = parseInt(targetBtn.getAttribute("data-track-idx"), 10);
        if (toIdx === idx) return;
        var item = state.stations.splice(idx, 1)[0];
        state.stations.splice(toIdx, 0, item);
        if (state.stepIndex === idx) state.stepIndex = toIdx;
        else if (idx < state.stepIndex && toIdx >= state.stepIndex) state.stepIndex--;
        else if (idx > state.stepIndex && toIdx <= state.stepIndex) state.stepIndex++;
        idx = toIdx;
        renderTrack();
      }

      function onUp(ev) {
        if (ev.pointerId !== pointerId) return;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        btn.classList.remove("is-dragging");
        if (!moved) {
          state.stepIndex = idx;
          renderApp();
        }
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  function renderStation() {
    var st = currentStation();
    if (!st) return;

    st.positionPreset = String(state.stepIndex + 1);

    if (els.count) {
      els.count.textContent = state.stepIndex + 1 + "/" + state.stations.length;
    }
    if (els.stationName) els.stationName.textContent = st.name;
    if (els.stationIcon) {
      var cat = catalogItem(st.stationKey);
      els.stationIcon.textContent = (cat && cat.icon) || st.icon || "•";
    }
    if (els.statTarget) els.statTarget.textContent = (st.valuePreset || "—") + (st.unitPreset || "");
    if (els.statPos) els.statPos.textContent = st.positionPreset;
    if (els.statRounds) els.statRounds.textContent = state.roundCount + "×";

    var isLast = state.stepIndex >= state.stations.length - 1;
    if (els.cta) {
      els.cta.classList.toggle("cm-drawer__cta--save", isLast);
      els.cta.innerHTML = isLast
        ? '<span class="de-t">Speichern</span><span class="en-t">Save</span>'
        : '<span class="de-t">Weiter</span><span class="en-t">Next</span>';
    }
  }

  function renderPicker() {
    var st = currentStation();
    if (!st || !els.picker) return;

    var unit = st.unitPreset || "m";
    var vals = pickerValues(unit, st.valuePreset);
    var selected = parseInt(st.valuePreset, 10) || vals[Math.floor(vals.length / 2)];

    if (els.valueDisplay) els.valueDisplay.textContent = String(selected);
    if (els.prompt) {
      els.prompt.innerHTML =
        unit === "rep"
          ? '<span class="de-t">Wiederholungen für ' +
            st.name +
            "?</span><span class=\"en-t\">Reps for " +
            st.name +
            "?</span>"
          : unit === "sec"
            ? '<span class="de-t">Sekunden für ' +
              st.name +
              "?</span><span class=\"en-t\">Seconds for " +
              st.name +
              "?</span>"
            : '<span class="de-t">Distanz in ' +
              unit +
              " für " +
              st.name +
              "?</span><span class=\"en-t\">Distance in " +
              unit +
              " for " +
              st.name +
              "?</span>";
    }

    els.picker.innerHTML = vals
      .map(function (v) {
        return (
          '<button type="button" class="cm-picker__opt' +
          (v === selected ? " is-selected" : "") +
          '" data-val="' +
          v +
          '">' +
          v +
          "</button>"
        );
      })
      .join("");

    els.picker.querySelectorAll(".cm-picker__opt").forEach(function (opt) {
      opt.addEventListener("click", function () {
        selectPickerValue(parseInt(opt.getAttribute("data-val"), 10));
      });
    });

    var selBtn = els.picker.querySelector(".is-selected");
    if (selBtn) {
      requestAnimationFrame(function () {
        selBtn.scrollIntoView({ inline: "center", block: "nearest" });
      });
    }

    bindPickerScroll();
  }

  function selectPickerValue(val) {
    var st = currentStation();
    if (!st) return;
    st.valuePreset = String(val);
    if (els.valueDisplay) els.valueDisplay.textContent = String(val);
    if (els.statTarget) els.statTarget.textContent = val + (st.unitPreset || "");
    els.picker.querySelectorAll(".cm-picker__opt").forEach(function (opt) {
      opt.classList.toggle("is-selected", parseInt(opt.getAttribute("data-val"), 10) === val);
    });
    var sel = els.picker.querySelector(".is-selected");
    if (sel) sel.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  function bindPickerScroll() {
    if (!els.picker || els.picker.dataset.scrollBound) return;
    els.picker.dataset.scrollBound = "1";
    var raf = 0;
    els.picker.addEventListener(
      "scroll",
      function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var mid = els.picker.scrollLeft + els.picker.clientWidth / 2;
          var best = null;
          var bestDist = Infinity;
          els.picker.querySelectorAll(".cm-picker__opt").forEach(function (opt) {
            var center = opt.offsetLeft + opt.offsetWidth / 2;
            var dist = Math.abs(center - mid);
            if (dist < bestDist) {
              bestDist = dist;
              best = opt;
            }
          });
          if (best) selectPickerValue(parseInt(best.getAttribute("data-val"), 10));
        });
      },
      { passive: true }
    );
  }

  function nextOrSave() {
    if (state.stepIndex < state.stations.length - 1) {
      state.stepIndex++;
      renderApp();
      return;
    }
    saveSession();
  }

  function renderMetaFields() {
    if (els.date) els.date.value = state.date;
    if (els.workout) els.workout.value = state.workoutName;
    if (els.rounds) {
      els.rounds.innerHTML = [6, 7, 8]
        .map(function (n) {
          return (
            '<button type="button" class="cm-rounds__btn' +
            (state.roundCount === n ? " is-active" : "") +
            '" data-rounds="' +
            n +
            '">' +
            n +
            "</button>"
          );
        })
        .join("");
      els.rounds.querySelectorAll("[data-rounds]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.roundCount = parseInt(btn.getAttribute("data-rounds"), 10);
          renderMetaFields();
          renderStation();
        });
      });
    }
    renderPool();
  }

  function renderPool() {
    if (!els.pool) return;
    els.pool.innerHTML = STATION_CATALOG.map(function (item) {
      var cls = item.key === "run" ? " cm-pool__chip--run" : "";
      return (
        '<button type="button" class="cm-pool__chip' +
        cls +
        '" data-add="' +
        item.key +
        '">+ ' +
        stationLabel(item) +
        "</button>"
      );
    }).join("");
    els.pool.querySelectorAll("[data-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var station = createStation(btn.getAttribute("data-add"));
        if (station) {
          state.stations.push(station);
          state.stepIndex = state.stations.length - 1;
          renderApp();
        }
      });
    });
  }

  function openSettings() {
    if (els.settingsSheet) els.settingsSheet.hidden = false;
    renderMetaFields();
  }

  function closeSettings() {
    if (els.settingsSheet) els.settingsSheet.hidden = true;
  }

  function buildSessionPayload() {
    state.stations.forEach(function (st, i) {
      st.positionPreset = String(i + 1);
    });
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
    state.saving = true;
    if (els.cta) els.cta.disabled = true;
    setStatus(t("Speichern …", "Saving …"));

    var payload = buildSessionPayload();
    var remote = window.fcCycleSupabase && window.fcCycleSupabase.isConfigured();

    function finish(ok, msg) {
      state.saving = false;
      if (els.cta) els.cta.disabled = false;
      setStatus(msg, ok ? "ok" : "err");
    }

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

    if (!remote) {
      finish(true, t("Gespeichert.", "Saved."));
      return;
    }

    window.fcCycleSupabase
      .upsertSession(payload)
      .then(function () {
        finish(true, t("Tabelle ist gefüllt.", "Table is ready."));
      })
      .catch(function (err) {
        console.error(err);
        finish(false, t("Cloud-Fehler, lokal OK.", "Cloud error, saved locally."));
      });
  }

  function bindStatic() {
    var gateLogin = qs("#cm-gate-login");
    if (gateLogin) gateLogin.addEventListener("click", openModal);

    var loginForm = qs("#cycl-login-form");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    var closeBtn = qs("#cycl-login-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    var backdrop = qs(".cm-modal__backdrop");
    if (backdrop) backdrop.addEventListener("click", closeModal);

    if (els.cta) els.cta.addEventListener("click", nextOrSave);
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

    var settingsBtn = qs("#cm-settings");
    if (settingsBtn) settingsBtn.addEventListener("click", openSettings);
    var settingsClose = qs("#cm-settings-close");
    if (settingsClose) settingsClose.addEventListener("click", closeSettings);
    var settingsDone = qs("#cm-settings-done");
    if (settingsDone) settingsDone.addEventListener("click", closeSettings);

    var reorderHint = qs("#cm-reorder-hint");
    if (reorderHint) {
      reorderHint.addEventListener("click", function () {
        if (els.track) els.track.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }

    document.addEventListener("fc-lang-change", function () {
      state.stations.forEach(function (st) {
        var cat = catalogItem(st.stationKey);
        if (cat) st.name = stationLabel(cat);
      });
      renderApp();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initEls();
    bindStatic();
    renderApp();
  });
})();
