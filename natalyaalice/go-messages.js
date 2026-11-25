/* go-messages.js — Mitteilungen: einmal mittig in Aktuell, Tippen (auf oder neben die Karte) schließt
 *
 *   GoMessages.init({ rest, me(), createdAt() })
 *   GoMessages.check()      lädt ungelesene Mitteilungen und zeigt sie nacheinander (nur in Aktuell)
 *
 * Quellen:
 *   NEWS (unten)     Änderungen an der App, die Nutzer merken. Bei jeder spürbaren Änderung einen Eintrag ergänzen.
 *                    Neue Konten sehen nur Einträge, die nach ihrer Anmeldung kamen.
 *   go_messages      an alle (Admin, neuer Wochenplan; ab 3 neuen Plänen eine Sammelmeldung) oder an eine Person (Freund hat Plan geändert), go-messages.sql
 * Gelesen: go_message_reads (pro Konto, geräteübergreifend); ohne die Tabelle nur auf diesem Gerät.
 */
(function (global) {
  "use strict";

  var NEWS = [
    {
      key: "news:2026-11-25-endless-status",
      at: "2026-11-25T17:35:00Z",
      text: "Wiederkehrende Events laufen jetzt ohne Ende weiter. Stories zeigen denselben Status wie die Karten in Aktuell: dabei, gleich, bald, heute, verspätet, erledigt."
    },
    {
      key: "news:2026-11-25-who-coach-cal",
      at: "2026-11-25T17:20:00Z",
      text: "Events der Gruppe und des Circles zeigen jetzt, wer zugesagt hat. Unter Mein Coach siehst Du auch die Termine aus dem Kalender Deines Coaches und kannst zusagen."
    },
    {
      key: "news:2026-11-25-orte-fotos",
      at: "2026-11-25T17:10:00Z",
      text: "Plus → Orte: Mit der Kamera links oben an einer Kachel lädst Du Fotos hoch. Nach der Freigabe sehen sie alle. Mehrere Fotos wischst Du seitlich durch."
    },
    {
      key: "news:2026-11-25-workout-video",
      at: "2026-11-25T19:00:00Z",
      text: "Im Workout hat jede Übung ein Video-Icon. Fehlt ein Video, kannst Du dort direkt einen Link von YouTube oder Instagram einfügen."
    },
    {
      key: "news:2026-11-25-plus-orte",
      at: "2026-11-25T17:40:00Z",
      text: "Neu unter Plus: Orte. Alle Trainingsorte mit Foto, Deine Orte mit ☆ merken, neue über „Neu“ anlegen, auf der Karte suchen."
    },
    {
      key: "news:2026-11-25-card-status",
      at: "2026-11-25T15:50:00Z",
      text: "Aktuell: Unten links auf jeder Karte steht jetzt der Status, also erledigt, verspätet, dabei, bald, heute oder morgen."
    },
    {
      key: "news:2026-11-25-review-edit",
      at: "2026-11-25T15:30:00Z",
      text: "Deine Coach-Bewertung kannst Du jetzt anpassen: Community → Mein Coach → „Bewertung anpassen“. Sterne und Text sind änderbar."
    },
    {
      key: "news:2026-11-25-messages-heart",
      at: "2026-11-25T15:00:00Z",
      text: "Kommentare zu Deinen Events und @Nachrichten an Dich stehen jetzt im Herz oben rechts. Beim Öffnen der App siehst Du neue Nachrichten direkt."
    },
    {
      key: "news:2026-11-25-event-time-place",
      at: "2026-11-25T14:59:00Z",
      text: "Aktuell, Kreis unter Deinem heutigen Event: Startzeit und Ort änderst Du dort, solange noch niemand zugesagt hat."
    },
    {
      key: "news:2026-11-25-circle-events",
      at: "2026-11-25T14:00:00Z",
      text: "Zirkeltrainings Deines Circles stehen jetzt in Aktuell, auch bevor Du zusagst. Mit „Bin dabei“ bist Du dabei, auch in der Zirkel-App."
    },
    {
      key: "news:2026-11-25-coach-details",
      at: "2026-11-25T13:00:00Z",
      text: "Unter Community → Mein Coach zeigt „Details & Auswahl“ Über mich, Sterne und Bewertungen. Wisch zur Seite, um andere Coaches mit blauem c anzusehen."
    },
    {
      key: "news:2026-11-25-circle-seite",
      at: "2026-11-25T12:00:00Z",
      text: "Circles unter Community → Kreise sind neu aufgebaut: Beschreibung, Mitglieder, Stempelkarte und die Zirkeltrainings der nächsten 7 Tage. Mit + übernimmst Du einen Termin in Deine Woche."
    },
    {
      key: "news:2026-11-25-coach-msg",
      at: "2026-11-25T11:00:00Z",
      text: "Unter Community → Mein Coach kannst Du Deinem Coach jetzt direkt eine Nachricht senden. Sie steht dann in Aktuell unter „Mein Coach“."
    },
    {
      key: "news:2026-11-25-artmag",
      at: "2026-11-25T10:00:00Z",
      text: "Neue Darstellung „Art Magazin“: Serifen, Schwarz und Weiß, Bilder ohne Farbe drumherum. Zu finden unter Profil → Einstellungen → Darstellung."
    },
    {
      key: "news:2026-11-19-ring",
      at: "2026-11-19T12:00:00Z",
      text: "Neu in gogogo: Der Ring um Dein Profilbild wechselt jetzt immer nur um eine Farbstufe, und die Zahl daran zeigt, wie viele Tage Du am Stück abgehakt hast. Mehr dazu unter „Info“ oben links in Aktuell."
    },
    {
      key: "news:2026-11-19-uhrzeit",
      at: "2026-11-19T12:00:01Z",
      text: "Freunde einladen geht, sobald Dein Training eine Uhrzeit hat. Die setzt Du unter Kalender → Stift → Tage bearbeiten."
    },
    {
      key: "news:2026-11-24-kalender",
      at: "2026-11-24T12:00:00Z",
      text: "Woche heißt jetzt Kalender und zeigt Deine wiederkehrenden Trainings. Was Du an einem einzelnen Tag änderst, siehst Du in Aktuell."
    },
    {
      key: "news:2026-11-24-tamagotchi",
      at: "2026-11-24T12:00:01Z",
      text: "Das Tamagotchi ist jetzt zuerst aus. Einschalten kannst Du es oben links in Aktuell. Dort steht auch, was die Farben und die Zahl bedeuten."
    },
    {
      key: "news:2026-11-24-event-menue",
      at: "2026-11-24T12:00:02Z",
      text: "Unter ••• an einem erledigten Training kannst Du jetzt bis zu 5 Fotos hinzufügen, ein aus Versehen beendetes Training wieder aufnehmen und vergangene Trainings verkleinern."
    },
    {
      key: "news:2026-11-24-online",
      at: "2026-11-24T12:00:03Z",
      text: "Ein grüner Punkt am Profilkreis heißt: Die Person hat gogogo gerade offen. Unter Profil → Einstellungen → Privatsphäre schaltest Du das für Dich aus, ebenso die Suche über Orte und erledigte Events für Freunde."
    },
    {
      key: "news:2026-11-24-story-weiter",
      at: "2026-11-24T16:30:00Z",
      text: "Stories laufen jetzt durch: Tippen zeigt die nächste Story, danach die der nächsten Person. Am Ende bist Du wieder in Aktuell."
    },
    {
      key: "news:2026-11-24-plus-kacheln",
      at: "2026-11-24T16:50:00Z",
      text: "Plus zeigt Deine Plus-Punkte jetzt als Kacheln. Tippen öffnet den Inhalt, „Plus“ unten bringt Dich zurück. Am Griff rechts sortierst Du sie, Aktiviertes rutscht nach oben."
    },
    {
      key: "news:2026-11-24-pt-kalender",
      at: "2026-11-24T20:00:00Z",
      text: "Personal Training buchst Du jetzt direkt im Kalender Deines Coaches: Team → Mein Coach → Personal Training. Coaches finden ihren Kalender unter Plus → Ich als Coach → PT-Kalender."
    },
    {
      key: "news:2026-11-24-sichtbarkeit",
      at: "2026-11-24T22:00:00Z",
      text: "Wer Dein Event sieht, wählst Du jetzt über die drei Punkte am Event aus derselben Liste wie den Filter oben in Aktuell: Nur ich, Freunde, Gruppe, Circle, Bubble oder Alles."
    },
    {
      key: "news:2026-11-24-coach-gruppe",
      at: "2026-11-24T23:30:00Z",
      text: "Neu unter Community → Kreise: Coaches haben „Meine Coachees“ und laden dort zum Gruppentraining ein. Als Coachee setzt Du unter „Coach“ den Haken „Offen für Gruppentraining“ und siehst die Einladungen Deines Coaches."
    },
    {
      key: "news:2026-11-25-mention",
      at: "2026-11-25T00:00:00Z",
      text: "Nachricht an eine Person: Schreib in der Sprechblase in Aktuell @ und den Namen. Nur diese Person sieht die Nachricht, bei ihr steht „an Dich“."
    }
  ];

  var PLANS_TEXT = "Es gibt neue Trainingspläne. Du findest sie unter Kalender → Stift → Wochenplan ändern.";

  var host = null;
  var busy = false;
  var noTables = false;
  var LOCAL = "gogogo_msg_read";

  function me() { return host && host.me ? String(host.me() || "") : ""; }
  function localRead() {
    try { return JSON.parse(localStorage.getItem(LOCAL + "_" + me()) || "[]"); } catch (e) { return []; }
  }
  function markLocal(key) {
    try {
      var l = localRead();
      if (l.indexOf(key) < 0) l.push(key);
      localStorage.setItem(LOCAL + "_" + me(), JSON.stringify(l.slice(-200)));
    } catch (e) {}
  }
  function markRead(key) {
    markLocal(key);
    if (noTables || !host) return;
    host.rest("go_message_reads", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: { account_id: me(), msg_key: key }
    }).catch(function () {});
  }

  function since() {
    var c = host && host.createdAt ? host.createdAt() : "";
    if (c) return Promise.resolve(c);
    return host.rest("go_accounts?id=eq." + encodeURIComponent(me()) + "&select=created_at")
      .then(function (rows) { return (rows && rows[0] && rows[0].created_at) || ""; })
      .catch(function () { return ""; });
  }

  function load() {
    return since().then(function (from) {
      from = from || new Date(Date.now() - 30 * 864e5).toISOString();
      var id = encodeURIComponent(me());
      var msgs = noTables ? Promise.resolve([]) : host.rest(
        "go_messages?or=(to_id.is.null,to_id.eq." + id + ")&created_at=gte." + encodeURIComponent(from) +
        "&order=created_at.asc&limit=60&select=id,kind,body,created_at"
      ).catch(function () { noTables = true; return []; });
      var reads = noTables ? Promise.resolve([]) : host.rest("go_message_reads?account_id=eq." + id + "&select=msg_key&limit=500")
        .catch(function () { return []; });
      return Promise.all([msgs, reads]).then(function (r) {
        var seen = {};
        localRead().forEach(function (k) { seen[k] = true; });
        (r[1] || []).forEach(function (x) { seen[x.msg_key] = true; });
        var list = NEWS.filter(function (n) { return n.at >= from; }).map(function (n) {
          return { key: n.key, at: n.at, text: n.text };
        });
        (r[0] || []).forEach(function (m) { list.push({ key: String(m.id), at: m.created_at, text: m.body, kind: m.kind }); });
        list.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
        list = list.filter(function (m) { return !seen[m.key]; });
        /* mehr als 2 neue Wochenpläne: eine Sammelmeldung statt jeden einzeln */
        var plans = list.filter(function (m) { return m.kind === "new_plan"; });
        if (plans.length > 2) {
          var at = plans[0].at;
          list = list.filter(function (m) { return m.kind !== "new_plan"; });
          list.push({ keys: plans.map(function (m) { return m.key; }), at: at, text: PLANS_TEXT });
          list.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
        }
        return list;
      });
    });
  }

  function blocked() {
    if (document.body.dataset.shell !== "heute") return true;
    if (document.querySelector(".god, .gtm, .cp, .gpl, .gob, #go-boot")) return true;
    if (document.querySelector(".sand-modal:not([hidden])")) return true;
    return false;
  }

  function showQueue(list) {
    if (!list.length) { busy = false; return; }
    if (blocked()) {
      setTimeout(function () { showQueue(list); }, 2500);
      return;
    }
    var m = list.shift();
    (m.keys || [m.key]).forEach(markRead);
    (GoDialog.note || GoDialog.alert)(m.text).then(function () {
      setTimeout(function () { showQueue(list); }, 350);
    });
  }

  function check() {
    if (!host || !me() || busy || !global.GoDialog) return;
    busy = true;
    load().then(showQueue).catch(function () { busy = false; });
  }

  global.GoMessages = {
    init: function (h) { host = h; },
    check: check,
    news: function () { return NEWS.slice(); }
  };
})(window);
