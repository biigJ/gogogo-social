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
    stempelkarte: "/assets/gogogo/gogogo-Stempelkarte.jpg",
    merch: "/assets/gogogo/gogogo-12wochen-routine.jpg",
    routine: "/assets/gogogo/gogogo-12wochen-routine.jpg",
    zirkel: "/assets/gogogo/gogogo-Zirkeltraining.jpg",
    kraft_tracking: "/assets/gogogo/Jelena-Pullups-1600.webp",
    uebungen: "/assets/gogogo/gogogo-upperbody-Video-Poster-1600.webp"
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

  function addDaysIso(iso, days) {
    var parts = String(iso || "").slice(0, 10).split("-");
    var dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    dt.setUTCDate(dt.getUTCDate() + (Number(days) || 0));
    return dt.toISOString().slice(0, 10);
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
    /* Testphase: alles gratis */
    return "gratis";
  }

  function paymentFor(product) {
    return "gratis";
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
    if (existing && existing.status === "angefragt" && existing.id) {
      return rest("support_orders?id=eq." + encodeURIComponent(existing.id), {
        method: "PATCH",
        prefer: "return=representation",
        body: {
          status: "freigeschaltet",
          payment_status: paymentFor(product),
          /* bisherige Angaben (z. B. Stempel) behalten, Deaktiviert-Merker entfernen */
          meta: (function () { var m = Object.assign({}, existing.meta || {}, meta || {}); delete m.deaktiviert; return m; })()
        }
      })
        .catch(function () {
          return rest("support_orders?id=eq." + encodeURIComponent(existing.id), {
            method: "PATCH",
            prefer: "return=representation",
            body: { status: "freigeschaltet" }
          });
        })
        .then(function (rows) {
          var order = Array.isArray(rows) ? rows[0] : rows || existing;
          return afterBook(product, order, meta);
        });
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
            user_id: me(),
            type: "support_request",
            ref_id: order && order.id ? order.id : product.id
          }
        }).catch(function () {});
        return afterBook(product, order, meta);
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

  function afterBook(product, order, opts) {
    var type = product.type;
    var jobs = [];
    opts = opts || {};
    if (type === "web_call") {
      /* Buchung entsteht erst nach gewähltem Calendly-Termin (index.html), Event zur echten Uhrzeit */
      if (opts.startsAt) {
        jobs.push(
          createSupportEvent({
            title: "Initialgespräch",
            category: "alternative",
            starts_at: opts.startsAt,
            location: "Online",
            visibility: "privat",
            item_type: "support_session"
          })
        );
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
      /* 4 Wochen unter Aktuell: Meta merken; Karten kommen aus heuteSupportItems */
      var startDay = todayIso();
      if (order) {
        order.meta = Object.assign({}, order.meta || {}, { start: startDay, days: 28 });
      }
      if (order && order.id && String(order.id).indexOf("local-") !== 0) {
        jobs.push(
          rest("support_orders?id=eq." + encodeURIComponent(order.id), {
            method: "PATCH",
            prefer: "return=minimal",
            body: { meta: order.meta }
          }).catch(function () {})
        );
      }
      jobs.push(
        createSupportEvent({
          title: "Ernährung",
          category: "alternative",
          starts_at: startDay + "T19:00:00+01:00",
          visibility: "privat",
          item_type: "nutrition_log"
        }).catch(function () {})
      );
    } else if (type === "stempelkarte") {
      if (order && order.id && String(order.id).indexOf("local-") !== 0) {
        jobs.push(
          rest("support_orders?id=eq." + encodeURIComponent(order.id), {
            method: "PATCH",
            prefer: "return=minimal",
            body: { status: "aktiv", meta: Object.assign({}, order.meta || {}, { stamps: 0, start: todayIso() }) }
          }).catch(function () {})
        );
      }
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

  var TYPE_ORDER = [
    "zirkel",
    "stempelkarte",
    "web_call",
    "routine",
    "ernaehrung",
    "coach_offer"
  ];
  var TYPE_LABELS = {
    routine: "12-Wochen-Routine",
    zirkel: "Friday Fitness Circle",
    ernaehrung: "Ernährung",
    kraft_tracking: "Kraft-Tracking",
    uebungen: "Videos",
    web_call: "Initialgespräch",
    coach_offer: "Ich als Coach",
    stempelkarte: "Stempelkarte",
    personal_training: "Personal Training",
    merch: "Merch"
  };
  /* Einheitlicher Katalog — Headlines bleiben auch ohne DB-Produkte sichtbar */
  var STATIC_OFFERS = [
    {
      key: "zirkel",
      type: "zirkel",
      title: "Friday Fitness Circle",
      price: "gratis",
      description:
        "Buch Dich ein in das Friday Fitness Zirkeltraining. Warum der Name? Weil am Freitagmittag die erste Gruppe vor Ort in Berlin trainiert. Du kannst aber immer und überall Dein Zirkeltraining als Event anlegen und machen. Hier legst Du Deinen Circle-Account an und kannst direkt von gogogo aus starten. Das Tracking startet direkt im Event unter Aktuell, die Aufzeichnungen findest Du hier unterm Text."
    },
    {
      key: "stempelkarte",
      type: "stempelkarte",
      title: "Stempelkarte",
      price: "gratis",
      description:
        "Trainierst Du mit einem Freund bei seinem oder Deinem Workout-Event zusammen, scannt Ihr die Karten und bekommt so einen digitalen Stempel. Was es für eine volle Karte gibt, macht Ihr in der Challenge Eurer Gruppe aus. Zum Punktesammeln tippe auf das Event unter Aktuell. Die Stempelkarte öffnet sich und Dein Freund hält seine/ihre Kamera auf den QR-Code. Dann tippt er/sie, ob Du pünktlich warst. Du musst dann auch bestätigen, ob er/sie pünktlich war. Wer pünktlich war, erhält zwei Stempel."
    },
    {
      key: "web_call",
      type: "web_call",
      title: "Initialgespräch",
      price: "",
      description:
        "Triff Joscha für 30 Minuten zu einem Erstgespräch. Sprich mit ihm über Deine Trainingsziele, Deine Ressourcen, Deinen Alltag und Herausforderungen. Als Ergebnis fasst er Dir einen Trainingsplan zusammen, der für Deinen Alltag passt. Webmeeting über Calendly."
    },
    {
      key: "routine",
      type: "routine",
      title: "12-Wochen-Routine",
      price: "gratis",
      description:
        "Bestätige jeden Tag ein Event, ob Sport, Bewegung oder wenn Du einen Ausfall hast mit Kommentar, warum. Das hilft Dir, Deine tägliche Bewegung zu etablieren, Dein Verhalten im Alltag zu festigen und Deine Gesundheit zu verbessern. Wenn Du 12 Wochen lang Deine Wochen voll hast, bekommst Du ein Goodie: das gogogo-Shirt!"
    },
    {
      key: "ernaehrung",
      type: "ernaehrung",
      title: "Ernährung",
      price: "gratis",
      description:
        "Mach mit uns vier Wochen lang täglich einen Ernährungs Checkin. Protokolliere Mahlzeiten per Spracherkennung. Jeden Tag mit Erinnerung und zwei- bis dreimal pro Woche Feedback, direkt und menschlich."
    },
    {
      key: "uebungen",
      type: "uebungen",
      title: "Videos",
      price: "gratis",
      description:
        "Kopier Links aus Instagram oder YouTube und verbinde sie mit den Übungen aus Deinem Wochenplan. So hast Du jederzeit Beispiele von Deinen Lieblingssportlern in der Tasche und musst keine Tracking App oder gespeicherte Links von YouTube nebenher aufhaben."
    },
    {
      key: "kraft_tracking",
      type: "kraft_tracking",
      title: "Kraft-Tracking",
      price: "gratis",
      description:
        "Alle Deine Krafttrainings als Liste, gratis. Klapp jedes Workout auf, filtere nach Datum und sieh über das Kurven-Symbol Deinen Fortschritt pro Übung, auch direkt beim Tracken."
    },
    {
      key: "coach_offer",
      type: "coach_offer",
      title: "Ich als Coach",
      price: "Zugang",
      description:
        "Melde Dich als Coach an, um die Leitung einer Gruppe zu haben. Wenn Du Freunde als Coachees betreuen und Trainingspläne erstellen willst, benötigst Du ein gogogo-Zertifikat. Mit der Trainer-A-Lizenz und/oder einer PT-Lizenz und mit Erfahrung in der Fitnesswelt kannst Du hier einen Zugang zum Admin-Bereich erhalten. Freunde finden Dich dann in der Coach-Liste mit einem blauen c. Für das Zertifikat sendest Du an uns Dein CV."
    }
  ];
  var PAYPAL_DONATE_URL =
    "https://www.paypal.com/donate/?business=bjgrope%40googlemail.com&currency_code=EUR&amount=25&item_name=gogogo";
  var JOSCHA_WA = "491747015500";
  var PAY_HINT =
    "Zahlung: PayPal-Link an Dich, danach manuelle Freischaltung (einfachster Start). Stripe später für automatische Freigabe.";

  function descHtml(text) {
    var full = String(text || "").trim();
    if (!full) return "";
    /* 5 Zeilen per CSS; (mehr) zum Aufklappen */
    var approxLong = full.length > 160 || full.split(/\n+/).length > 5;
    if (!approxLong) {
      return '<p class="support-desc support-desc--short">' + esc(full) + "</p>";
    }
    return (
      '<p class="support-desc is-clamped">' +
      esc(full) +
      ' <button type="button" class="support-more" data-support-more="1">mehr</button></p>' +
      '<p class="support-desc-full" hidden>' +
      esc(full) +
      "</p>"
    );
  }

  function mineHtml() {
    var active = state.orders.filter(function (o) {
      return o.status === "aktiv" || o.status === "freigeschaltet";
    });
    if (!active.length) {
      return '<p class="support-empty">Noch nichts gebucht. Wähle unten ein Angebot.</p>';
    }
    var byType = {};
    active.forEach(function (o) {
      var p = o.support_products || {};
      var t = String(p.type || "merch");
      if (!byType[t]) byType[t] = [];
      byType[t].push(o);
    });
    var blocks = TYPE_ORDER.filter(function (t) {
      return byType[t] && byType[t].length;
    }).map(function (t) {
      return (
        '<h3 class="support-subh">' +
        esc(TYPE_LABELS[t] || t) +
        "</h3><ul class=\"support-mine\">" +
        byType[t]
          .map(function (o) {
            var p = o.support_products || {};
            var pay = o.payment_status || paymentFor(p);
            return (
              "<li><strong>" +
              esc(p.title || TYPE_LABELS[t] || "Support") +
              "</strong><span>" +
              esc(pay) +
              " · " +
              esc(o.status) +
              "</span></li>"
            );
          })
          .join("") +
        "</ul>"
      );
    });
    Object.keys(byType).forEach(function (t) {
      if (TYPE_ORDER.indexOf(t) >= 0) return;
      blocks.push(
        '<h3 class="support-subh">' +
          esc(TYPE_LABELS[t] || t) +
          '</h3><ul class="support-mine">' +
          byType[t]
            .map(function (o) {
              var p = o.support_products || {};
              return (
                "<li><strong>" +
                esc(p.title || "Support") +
                "</strong><span>" +
                esc(o.status) +
                "</span></li>"
              );
            })
            .join("") +
          "</ul>"
      );
    });
    return blocks.join("");
  }

  function productCard(p) {
    var owned = state.orders.some(function (o) {
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
      descHtml(p.description || "") +
      '<div class="support-card__row">' +
      '<span class="support-price">' +
      esc(priceLabel(p)) +
      "</span>" +
      (owned
        ? '<span class="support-owned">Gebucht</span>'
        : '<button type="button" class="support-buy" data-buy="' +
          esc(p.id) +
          '">Buchen</button>') +
      "</div></div></article>"
    );
  }

  function dbProductForType(type) {
    return (state.products || []).filter(function (p) {
      return p && String(p.type) === String(type);
    })[0];
  }

  /* v2 (24.11. abends): Aktivierungen von Videos zurückgesetzt */
  function videosKey() { return "gogogo_uebungen_on2_" + (me() || ""); }
  function trackingKey() {
    /* v2 (24.11.): alle wieder auf „Aktivieren“, es gibt noch keine Auswertung. Gespeichert werden Sätze trotzdem. */
    return "gogogo_kraft_tracking_v3_" + (me() || "");
  }

  function offerOwned(type) {
    if (type === "zirkel" && global.FFC && FFC.user && FFC.user()) return true;
    /* Videos: gratis, aber erst nach „Aktivieren“ (je Konto auf diesem Gerät) */
    if (type === "uebungen") {
      try { return !!me() && localStorage.getItem(videosKey()) === "1"; } catch (eU) { return false; }
    }
    if (type === "kraft_tracking") {
      try {
        if (me() && localStorage.getItem(trackingKey()) === "1") return true;
      } catch (eLs) {}
    }
    return !!(activeOrderFor(type) || (type === "routine" && host && host.routineActive && host.routineActive()));
  }

  function staticOfferCard(offer) {
    var img = IMG[offer.type] || IMG.routine;
    var owned = offerOwned(offer.type);
    var db = dbProductForType(offer.type);
    var price = db ? priceLabel(db) : offer.price;
    var buyAttr = db
      ? 'data-buy="' + esc(db.id) + '"'
      : 'data-buy-static="' + esc(offer.key) + '"';
    return (
      '<article class="support-card" data-offer="' +
      esc(offer.key) +
      '">' +
      '<div class="support-card__art"><img src="' +
      esc(img) +
      '" alt="" /></div>' +
      '<div class="support-card__body">' +
      "<h3>" +
      esc(offer.title) +
      "</h3>" +
      descHtml(offer.description) +
      '<div class="support-card__row">' +
      '<span class="support-price">' +
      esc(price) +
      "</span>" +
      (owned
        ? '<span class="support-owned">Gebucht</span>'
        : '<button type="button" class="support-buy" ' + buyAttr + ">Buchen</button>") +
      "</div></div></article>"
    );
  }

  function catalogByType() {
    var html = "";
    STATIC_OFFERS.forEach(function (offer) {
      html +=
        '<section class="support-section support-section--cat" data-cat="' +
        esc(offer.type) +
        '">' +
        '<h2 class="support-h">' +
        esc(TYPE_LABELS[offer.type] || offer.title) +
        '</h2><div class="support-grid">' +
        staticOfferCard(offer) +
        "</div></section>";
    });
    return html;
  }

  function render() {
    var root = document.getElementById("support-root");
    if (!root) return;
    /* Katalog lebt in den Plus-Slides — Root nur noch für „Gebucht“-Hinweis optional */
    if (host && host.slidesOnly) {
      root.innerHTML = "";
      root.hidden = true;
      if (host.onOffersReady) host.onOffersReady(STATIC_OFFERS.slice());
      return;
    }
    root.hidden = false;
    root.innerHTML =
      '<section class="support-section">' +
      '<h2 class="support-h">Gebucht</h2>' +
      mineHtml() +
      "</section>" +
      catalogByType();
  }

  function getOffers() {
    return STATIC_OFFERS.slice();
  }

  function bookOffer(key, opts) {
    key = String(key || "");
    if (key === "uebungen") {
      try { localStorage.setItem(videosKey(), "1"); } catch (eU) {}
      return Promise.resolve(null);
    }
    if (key === "routine") {
      return bookStaticOffer("routine").then(function () {
        return bookRoutine();
      });
    }
    if (key === "zirkel") {
      /* Nur buchen — Workout startet über Event/spontan, nicht unter Plus */
      return bookStaticOffer("zirkel").then(function (order) {
        if (host.paintProfil) host.paintProfil();
        if (host.onOffersReady) host.onOffersReady(STATIC_OFFERS.slice());
        return order;
      });
    }
    if (
      key === "ernaehrung" ||
      key === "web_call" ||
      key === "stempelkarte" ||
      key === "coach_offer" ||
      key === "kraft_tracking" ||
      key === "nutrition"
    ) {
      var type = key === "nutrition" ? "ernaehrung" : key;
      return bookStaticOffer(type, opts).then(function (order) {
        /* coach_offer: WhatsApp öffnet der Consent-Dialog in index.html — hier nicht nochmal */
        if (host.paintProfil) host.paintProfil();
        if (host.onOffersReady) host.onOffersReady(STATIC_OFFERS.slice());
        if (host.toast) {
          host.toast(
            type === "coach_offer"
              ? "Bewerbung gespeichert — CV per WhatsApp senden."
              : type === "stempelkarte" || type === "ernaehrung" || type === "web_call"
                ? "Aktiv."
                : "Gebucht."
          );
        }
        return order;
      });
    }
    return Promise.resolve();
  }

  function onClick(e) {
    var more = e.target && e.target.closest ? e.target.closest("[data-support-more]") : null;
    if (more) {
      var short = more.closest(".support-desc");
      var full = short && short.parentNode ? short.parentNode.querySelector(".support-desc-full") : null;
      if (short) {
        short.classList.remove("is-clamped");
        short.hidden = true;
      }
      if (full) full.hidden = false;
      return;
    }
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
              "Freigeschaltet."
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
        bookStaticOffer("routine").then(function () {
          return bookRoutine();
        });
        return;
      }
      if (kind === "zirkel") {
        bookStaticOffer("zirkel").then(function () {
          if (host.openZirkel) host.openZirkel();
          else if (host.requireFfc) host.requireFfc(function () {});
        });
        return;
      }
      if (kind === "ernaehrung" || kind === "web_call" || kind === "stempelkarte" || kind === "coach_offer" || kind === "kraft_tracking") {
        bookStaticOffer(kind).then(function () {
          render();
          if (host.paintProfil) host.paintProfil();
          if (host.toast) {
            host.toast(
              kind === "coach_offer"
                ? "Angefragt — Freischaltung nach Freigabe."
                : "Gebucht."
            );
          }
        });
      }
    }
  }

  function bookStaticOffer(type, opts) {
    if (type === "kraft_tracking") {
      /* Merker lokal, falls go-kraft-tracking.sql (Produkt) noch nicht läuft */
      try {
        localStorage.setItem(trackingKey(), "1");
      } catch (eLs) {}
    }
    var db = dbProductForType(type);
    if (db) return bookProduct(db, { source: "plus_static", startsAt: opts && opts.startsAt });
    /* Ohne Katalog-Produkt: lokale Order-Merker über Community/activity nicht nötig —
       speichere angefragte Buchung als support_orders nur wenn Produkt existiert.
       Fallback: meta in activity_log */
    var instant = type === "stempelkarte" || type === "ernaehrung" || type === "web_call" || type === "kraft_tracking";
    var status = instant ? "aktiv" : "angefragt";
    var meta = {
      type: type,
      payment: "gratis",
      stamps: type === "stempelkarte" ? 0 : undefined,
      start: todayIso()
    };
    return rest("activity_log", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        user_id: me(),
        type: "support_request",
        ref_id: null,
        meta: meta
      }
    })
      .catch(function () {})
      .then(function () {
        var order = {
          id: "local-" + type + "-" + Date.now(),
          user_id: me(),
          status: status,
          payment_status: "gratis",
          meta: meta,
          created_at: new Date().toISOString(),
          support_products: { type: type, title: TYPE_LABELS[type] || type }
        };
        state.orders = state.orders.concat([order]);
        return afterBook({ type: type, title: TYPE_LABELS[type] || type }, order, opts).then(function () {
          return order;
        });
      });
  }

  function openStampCard() {
    var order = activeOrderFor("stempelkarte");
    if (host.openStampCardModal) {
      host.openStampCardModal(order);
      return;
    }
    var stamps = 0;
    try {
      stamps = Number((order && order.meta && order.meta.stamps) || 0) || 0;
    } catch (e) {}
    if (host.toast) {
      host.toast("Stempelkarte: " + stamps + "/12. Nach gemeinsamem Event scannt Ihr Euch, beide bekommen einen Stempel.");
    }
  }

  function cancelAllOrdersForUser() {
    var id = me();
    if (!id) return Promise.resolve();
    return rest(
      "support_orders?user_id=eq." + encodeURIComponent(id) + "&select=id,status"
    ).then(function (rows) {
      return Promise.all(
        (rows || []).map(function (o) {
          if (!o || !o.id) return null;
          var cancel =
            o.status === "angefragt"
              ? Promise.resolve()
              : rest("support_orders?id=eq." + encodeURIComponent(o.id), {
                  method: "PATCH",
                  prefer: "return=minimal",
                  body: { status: "angefragt" }
                }).catch(function () {});
          return Promise.resolve(cancel).then(function () {
            /* Hard-Delete wenn RLS-Policy existiert (go-support-orders-delete.sql) */
            return rest("support_orders?id=eq." + encodeURIComponent(o.id), {
              method: "DELETE",
              prefer: "return=minimal"
            }).catch(function () {});
          });
        })
      );
    });
  }

  function heuteSupportItems() {
    var out = [];
    var today = todayIso();

    /* Ernährung: nur heute als Karte — Klick öffnet Dialog; 4-Wochen-Fenster steuert Anspruch */
    var nutritionOrder = activeOrderFor("ernaehrung");
    if (nutritionOrder) {
      var start = "";
      try {
        start = String((nutritionOrder.meta && nutritionOrder.meta.start) || (nutritionOrder.created_at || "")).slice(0, 10);
      } catch (eStart) {}
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) start = today;
      var span = Number((nutritionOrder.meta && nutritionOrder.meta.days) || 28) || 28;
      var end = addDaysIso(start, Math.max(0, span - 1));
      if (today >= start && today <= end) {
        out.push({
          id: "nutrition-" + today,
          user_id: me(),
          starts_at: today + "T19:00:00+01:00",
          title: "Ernährung",
          note: state.nutritionPlan || "Tippe zum Protokollieren.",
          category: "alternative",
          location: "privat",
          item_type: "nutrition_log",
          visibility: "privat",
          nutrition: true,
          photo_url: ""
        });
      }
    }
    /* Web-Call / PT / Routine erscheinen als events (item_type support_session / course_session) */
    return out;
  }

  function saveNutritionLog(text) {
    /* Nur Log speichern — kein neues Event/Frame unter Aktuell */
    text = String(text || "").trim().slice(0, 500);
    if (!text || !me()) return Promise.resolve();
    var logBody = {
      user_id: me(),
      type: "nutrition_log",
      ref_id: null,
      meta: { text: text, visibility: "privat", day: todayIso() }
    };
    return rest("activity_log", {
      method: "POST",
      prefer: "return=minimal",
      body: logBody
    }).catch(function () {
      delete logBody.meta;
      return rest("activity_log", {
        method: "POST",
        prefer: "return=minimal",
        body: logBody
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
    bookOffer: bookOffer,
    getOffers: getOffers,
    heuteSupportItems: heuteSupportItems,
    saveNutritionLog: saveNutritionLog,
    activeOrderFor: activeOrderFor,
    openStampCard: openStampCard,
    cancelAllOrdersForUser: cancelAllOrdersForUser,
    /* Plus-Punkt deaktivieren: Buchung zurück auf „angefragt“ (Stempel bleiben in meta), Aktivieren holt sie wieder */
    cancelOffer: function (type) {
      if (type === "uebungen") {
        try { localStorage.removeItem(videosKey()); } catch (eU) {}
        return Promise.resolve();
      }
      if (type === "kraft_tracking") {
        try { localStorage.removeItem(trackingKey()); } catch (eK) {}
      }
      var list = state.orders.filter(function (o) {
        var p = o.support_products || o.product || {};
        return (o.status === "aktiv" || o.status === "freigeschaltet") && String(p.type) === String(type);
      });
      return Promise.all(list.map(function (o) {
        var meta = Object.assign({}, o.meta || {}, { deaktiviert: new Date().toISOString() });
        o.status = "angefragt";
        o.meta = meta;
        if (!o.id || /^local-/.test(String(o.id))) return null;
        return rest("support_orders?id=eq." + encodeURIComponent(o.id), {
          method: "PATCH", prefer: "return=minimal", body: { status: "angefragt", meta: meta }
        });
      })).then(function () {
        if (host.paintProfil) host.paintProfil();
      });
    },
    offerOwned: offerOwned,
    paypalDonateUrl: function () { return PAYPAL_DONATE_URL; },
    joschaWa: function () { return JOSCHA_WA; }
  };
})(window);
