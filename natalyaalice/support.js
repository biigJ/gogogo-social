/* Support-Tab: Katalog, Buchen, Meins + Heute-Karten */
(function (global) {
  var host = null;
  var state = {
    products: [],
    orders: [],
    nutritionPlan: "",
    ready: false
  };

  var IMG = {
    personal_training: "/assets/gogogo/gogogo-Web-Call.jpg",
    web_call: "/assets/gogogo/gogogo-Web-Call.jpg",
    ernaehrung: "/assets/gogogo/gogogo-Ernaehrung.jpg",
    stempelkarte: "/assets/gogogo/gogogo-12wochen-routine.jpg",
    merch: "/assets/gogogo/gogogo-12wochen-routine.jpg",
    routine: "/assets/gogogo/gogogo-12wochen-routine.jpg",
    zirkel: "/assets/gogogo/gogogo-Zirkeltraining.jpg"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function me() {
    return host && host.sessionAccount && host.sessionAccount.id
      ? String(host.sessionAccount.id)
      : "";
  }

  function rest(path, opts) {
    return host.rest(path, opts || {});
  }

  function todayIso() {
    return host.todayIso ? host.todayIso() : new Date().toISOString().slice(0, 10);
  }

  function berlinHour() {
    try {
      return Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Berlin",
          hour: "numeric",
          hour12: false
        }).format(new Date())
      );
    } catch (e) {
      return new Date().getHours();
    }
  }

  function priceLabel(p) {
    if (p == null || p.price_eur == null) return "";
    var n = Number(p.price_eur);
    if (!n) return "gratis";
    return n.toFixed(0) + " €";
  }

  function paymentFor(product) {
    return Number(product && product.price_eur) === 0 ? "gratis" : "offen";
  }

  function activeOrderFor(type) {
    return state.orders.filter(function (o) {
      var p = o.support_products || o.product || {};
      return (
        (o.status === "aktiv" || o.status === "freigeschaltet") &&
        String(p.type) === String(type)
      );
    })[0];
  }

  function loadProducts() {
    return rest(
      "support_products?is_active=eq.true&select=id,title,type,price_eur,description&order=title.asc"
    )
      .then(function (rows) {
        state.products = rows || [];
      })
      .catch(function () {
        state.products = [];
      });
  }

  function loadOrders() {
    var id = me();
    if (!id) {
      state.orders = [];
      return Promise.resolve();
    }
    return rest(
      "support_orders?user_id=eq." +
        encodeURIComponent(id) +
        "&select=id,user_id,product_id,status,payment_status,meta,created_at,support_products(id,title,type,price_eur,description)&order=created_at.desc&limit=50"
    )
      .then(function (rows) {
        state.orders = rows || [];
      })
      .catch(function () {
        return rest(
          "support_orders?user_id=eq." +
            encodeURIComponent(id) +
            "&select=id,user_id,product_id,status,created_at,support_products(id,title,type,price_eur,description)&order=created_at.desc&limit=50"
        )
          .then(function (rows) {
            state.orders = rows || [];
          })
          .catch(function () {
            state.orders = [];
          });
      });
  }

  function loadNutritionPlan() {
    state.nutritionPlan = "";
    var id = me();
    if (!id) return Promise.resolve();
    return rest(
      "go_coach_plans?account_id=eq." +
        encodeURIComponent(id) +
        "&select=day_training_units,zirkel_weekday"
    )
      .then(function (rows) {
        var row = rows && rows[0];
        if (!row) return;
        var units = row.day_training_units;
        if (units && typeof units === "object") {
          var tip = units.nutrition || units.ernaehrung || units.food;
          if (typeof tip === "string" && tip.trim()) {
            state.nutritionPlan = tip.trim();
            return;
          }
        }
        state.nutritionPlan =
          "Proteinreiches Frühstück, eine warme Hauptmahlzeit, 4–5 Stunden Abstand — abends gern Quark mit Protein.";
      })
      .catch(function () {
        state.nutritionPlan =
          "Proteinreiches Frühstück, eine warme Hauptmahlzeit, 4–5 Stunden Abstand — abends gern Quark mit Protein.";
      });
  }

  function bookProduct(product, meta) {
    if (!product || !me()) return Promise.reject(new Error("missing"));
    var existing = state.orders.filter(function (o) {
      return (
        String(o.product_id) === String(product.id) &&
        (o.status === "aktiv" || o.status === "freigeschaltet" || o.status === "angefragt")
      );
    })[0];
    if (existing && (existing.status === "aktiv" || existing.status === "freigeschaltet")) {
      return Promise.resolve(existing);
    }
    var body = {
      user_id: me(),
      product_id: product.id,
      status: "aktiv",
      payment_status: paymentFor(product),
      meta: meta || {}
    };
    return rest("support_orders", {
      method: "POST",
      prefer: "return=representation",
      body: body
    })
      .catch(function () {
        delete body.payment_status;
        delete body.meta;
        body.status = "freigeschaltet";
        return rest("support_orders", {
          method: "POST",
          prefer: "return=representation",
          body: body
        });
      })
      .then(function (rows) {
        var order = Array.isArray(rows) ? rows[0] : rows;
        rest("activity_log", {
          method: "POST",
          prefer: "return=minimal",
          body: {
            account_id: me(),
            kind: "support_order",
            ref_id: order && order.id ? String(order.id) : String(product.id),
            meta: {
              product_id: product.id,
              type: product.type,
              title: product.title,
              payment_status: paymentFor(product)
            }
          }
        }).catch(function () {});
        return afterBook(product, order);
      });
  }

  function createSupportEvent(payload) {
    var body = {
      user_id: me(),
      category: payload.category || "alternative",
      course_id: null,
      starts_at: payload.starts_at,
      location: payload.location || null,
      visibility: payload.visibility || "privat",
      is_unplanned: true,
      status: "geplant",
      title: payload.title,
      item_type: payload.item_type || "support_session"
    };
    return rest("events", {
      method: "POST",
      prefer: "return=representation",
      body: body
    }).catch(function () {
      delete body.item_type;
      return rest("events", {
        method: "POST",
        prefer: "return=representation",
        body: body
      });
    });
  }

  function afterBook(product, order) {
    var type = product.type;
    var jobs = [];
    if (type === "web_call") {
      var when = new Date();
      when.setDate(when.getDate() + 2);
      when.setHours(11, 0, 0, 0);
      jobs.push(
        createSupportEvent({
          title: "Web-Call Trainingsplan",
          category: "alternative",
          starts_at: when.toISOString(),
          location: "Online",
          visibility: "privat",
          item_type: "support_session"
        })
      );
      if (host.openCalendlyPt) {
        try {
          host.openCalendlyPt();
        } catch (e) {}
      }
    } else if (type === "personal_training") {
      if (host.openCalendlyPt) {
        try {
          host.openCalendlyPt();
        } catch (e) {}
      }
      var pt = new Date();
      pt.setDate(pt.getDate() + 3);
      pt.setHours(10, 0, 0, 0);
      jobs.push(
        createSupportEvent({
          title: "Personal Training",
          category: "kraft",
          starts_at: pt.toISOString(),
          location: "Studio",
          visibility: "privat",
          item_type: "support_session"
        })
      );
    } else if (type === "ernaehrung") {
      /* Heute-Karte ab 19:00 — Event für heute Abend anlegen */
      var dinner = todayIso() + "T19:00:00+01:00";
      jobs.push(
        createSupportEvent({
          title: "Ernährung",
          category: "alternative",
          starts_at: dinner,
          visibility: "privat",
          item_type: "nutrition_log"
        })
      );
    }
    return Promise.all(jobs)
      .then(function () {
        return loadOrders();
      })
      .then(function () {
        if (host.onSupportChanged) host.onSupportChanged();
        return order;
      });
  }

  function bookRoutine() {
    /* 12-Wochen-Routine = Kurs-Enrollment, kein support_product-Typ */
    if (host.startRoutine) return Promise.resolve(host.startRoutine());
    return Promise.resolve();
  }

  function mineHtml() {
    var active = state.orders.filter(function (o) {
      return o.status === "aktiv" || o.status === "freigeschaltet";
    });
    if (!active.length) {
      return '<p class="support-empty">Noch nichts gebucht. Wähle unten ein Angebot.</p>';
    }
    return (
      '<ul class="support-mine">' +
      active
        .map(function (o) {
          var p = o.support_products || {};
          var pay = o.payment_status || paymentFor(p);
          return (
            '<li><strong>' +
            esc(p.title || "Support") +
            '</strong><span>' +
            esc(pay) +
            " · " +
            esc(o.status) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function productCard(p) {
    var owned = !!activeOrderFor(p.type) && activeOrderFor(p.type).product_id === p.id
      ? true
      : state.orders.some(function (o) {
          return (
            String(o.product_id) === String(p.id) &&
            (o.status === "aktiv" || o.status === "freigeschaltet")
          );
        });
    var img = IMG[p.type] || IMG.routine;
    return (
      '<article class="support-card" data-product="' +
      esc(p.id) +
      '">' +
      '<div class="support-card__art"><img src="' +
      esc(img) +
      '" alt="" /></div>' +
      '<div class="support-card__body">' +
      "<h3>" +
      esc(p.title) +
      "</h3>" +
      "<p>" +
      esc(p.description || "") +
      "</p>" +
      '<div class="support-card__row">' +
      '<span class="support-price">' +
      esc(priceLabel(p)) +
      "</span>" +
      (owned
        ? '<span class="support-owned">Meins</span>'
        : '<button type="button" class="support-buy" data-buy="' +
          esc(p.id) +
          '">Buchen</button>') +
      "</div></div></article>"
    );
  }

  function staticCards() {
    return (
      '<article class="support-card" data-static="routine">' +
      '<div class="support-card__art"><img src="' +
      esc(IMG.routine) +
      '" alt="" /></div>' +
      '<div class="support-card__body">' +
      "<h3>12-Wochen-Routine</h3>" +
      "<p>Täglich ein Event posten — Gewohnheit statt Hyper-Tracking. Wer durchhält, erhält ein Personal Training.</p>" +
      '<div class="support-card__row"><span class="support-price">gratis</span>' +
      '<button type="button" class="support-buy" data-buy-static="routine">Starten</button>' +
      "</div></div></article>" +
      '<article class="support-card" data-static="zirkel">' +
      '<div class="support-card__art"><img src="' +
      esc(IMG.zirkel) +
      '" alt="" /></div>' +
      '<div class="support-card__body">' +
      "<h3>Zirkeltraining</h3>" +
      "<p>Gemeinsamer Rhythmus mit Freunden, Leaderboard und Stories.</p>" +
      '<div class="support-card__row"><span class="support-price">gratis</span>' +
      '<button type="button" class="support-buy" data-buy-static="zirkel">Öffnen</button>' +
      "</div></div></article>"
    );
  }

  function render() {
    var root = document.getElementById("support-root");
    if (!root) return;
    var catalog = state.products.map(productCard).join("") + staticCards();
    root.innerHTML =
      '<section class="support-section">' +
      '<h2 class="support-h">Meins</h2>' +
      mineHtml() +
      "</section>" +
      '<section class="support-section">' +
      '<h2 class="support-h">Support</h2>' +
      '<div class="support-grid">' +
      catalog +
      "</div></section>";
  }

  function onClick(e) {
    var buy = e.target && e.target.closest ? e.target.closest("[data-buy]") : null;
    if (buy) {
      var id = buy.getAttribute("data-buy");
      var product = state.products.filter(function (p) {
        return String(p.id) === String(id);
      })[0];
      if (!product) return;
      buy.disabled = true;
      bookProduct(product)
        .then(function () {
          render();
          if (host.toast) {
            host.toast(
              paymentFor(product) === "offen"
                ? "Gebucht — dein Coach meldet sich wegen der Zahlung."
                : "Freigeschaltet."
            );
          }
        })
        .catch(function () {
          buy.disabled = false;
          if (host.toast) host.toast("Buchung fehlgeschlagen");
        });
      return;
    }
    var st = e.target && e.target.closest ? e.target.closest("[data-buy-static]") : null;
    if (st) {
      var kind = st.getAttribute("data-buy-static");
      if (kind === "routine") {
        bookRoutine();
        return;
      }
      if (kind === "zirkel" && host.openZirkel) host.openZirkel();
    }
  }

  function heuteSupportItems() {
    var out = [];
    var today = todayIso();
    var hour = berlinHour();

    /* Ernährung: ab 19:00, wenn aktiv gebucht — private Log-Karte mit Diktat */
    if (activeOrderFor("ernaehrung") && hour >= 19) {
      out.push({
        id: "nutrition-" + today,
        user_id: me(),
        starts_at: today + "T19:00:00+01:00",
        title: "🥗 Ernährung",
        note: state.nutritionPlan || "",
        category: "alternative",
        location: "privat",
        item_type: "nutrition_log",
        visibility: "privat",
        nutrition: true,
        photo_url: ""
      });
    }
    /* Web-Call / PT / Routine erscheinen als events (item_type support_session / course_session) */
    return out;
  }

  function saveNutritionLog(text) {
    text = String(text || "").trim().slice(0, 500);
    if (!text || !me()) return Promise.resolve();
    var starts = todayIso() + "T19:00:00+01:00";
    return createSupportEvent({
      title: "Ernährung",
      category: "alternative",
      starts_at: starts,
      visibility: "privat",
      item_type: "nutrition_log"
    }).then(function (rows) {
      var ev = Array.isArray(rows) ? rows[0] : rows;
      if (!ev || !ev.id) return;
      return rest("events?id=eq." + encodeURIComponent(ev.id), {
        method: "PATCH",
        prefer: "return=minimal",
        body: { title: "Ernährung", status: "erledigt" }
      }).catch(function () {});
    }).then(function () {
      /* Body/Notiz: go_community oder events.note falls Spalte fehlt → activity_log */
      return rest("activity_log", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          account_id: me(),
          kind: "nutrition_log",
          ref_id: todayIso(),
          meta: { text: text, visibility: "privat" }
        }
      }).catch(function () {});
    });
  }

  function refresh() {
    if (!host || !me()) {
      state.ready = false;
      render();
      return Promise.resolve();
    }
    return Promise.all([loadProducts(), loadOrders(), loadNutritionPlan()]).then(function () {
      state.ready = true;
      render();
    });
  }

  function install(h) {
    host = h || host || {};
    var root = document.getElementById("support-root");
    if (root && !root._supportBound) {
      root._supportBound = true;
      root.addEventListener("click", onClick);
    }
    return refresh();
  }

  global.GoSupport = {
    install: install,
    refresh: refresh,
    render: render,
    bookProduct: bookProduct,
    heuteSupportItems: heuteSupportItems,
    saveNutritionLog: saveNutritionLog,
    activeOrderFor: activeOrderFor
  };
})(window);
