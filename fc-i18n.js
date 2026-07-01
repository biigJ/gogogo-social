(function () {
  function resolvePage() {
    var path = location.pathname;
    if (/\/register-accountability(\/|$)/.test(path)) return "register-accountability";
    if (/\/register-training(\/|$)/.test(path)) return "register-training";
    if (/\/biig-interior(\/|$)/.test(path)) return "biig-interior";
    var tail = path.split("/").pop() || "index.html";
    if (!tail || tail === "") return "index.html";
    if (!/\./.test(tail)) return "index.html";
    return tail.replace(/^\//, "");
  }
  var PAGE = resolvePage();

  /** @type {Record<string, Array<{s:string,de:string,en:string,html?:boolean}>>} */
  var MAP = {
    "index.html": [
      { s: "#service-heading .de-t .nowrap:nth-child(1)", de: "Dein Alltag ist", en: "Your everyday life" },
      { s: "#service-heading .de-t .nowrap:nth-child(2)", de: "gestaltbar", en: "is designable" },
      { s: ".hero--service .hero__lede .de-t", de: "Bewegung, Gewohnheiten, Umgebungen. Wer in diesen drei Bereichen für sich klar ist, lebt zufriedener. Friday Circle steht dafür, dass Du Dich dabei nicht allein fühlst.", en: "Movement, habits, environments. Whoever has clarity in these three areas lives more satisfied. Friday Circle is here so you don't feel alone doing it." },
      { s: "#landing-name-heading .nowrap:nth-child(1)", de: "Warum der Name", en: "Why the name" },
      { s: "#landing-name-heading .nowrap:nth-child(2)", de: "FRIDAY CIRCLE?", en: "FRIDAY CIRCLE?" },
    ],
    "ziele.html": [
      { s: "#ziele-heading .nowrap:nth-child(1)", de: "Ziele von", en: "Goals of" },
      { s: "#ziele-heading .nowrap:nth-child(2)", de: "Friday Circle", en: "Friday Circle" },
      { s: ".hero__lede", de: "Menschen zusammenbringen, um gemeinsam, undogmatisch und ganz praktisch das Geheimnis eines zufriedenen Lebens zu lüften.", en: "Bringing people together to uncover, collectively, undogmatically, and very practically, the secret of a satisfied life." },
      { s: ".goals-overlay__copy p:nth-of-type(1)", de: "Wer bewusst lebt, ist zufriedener. Das klingt banal, trifft aber selten den Alltag der meisten Menschen. Zwischen Job, Handy und dem Anspruch, ständig erreichbar und produktiv zu sein, bleibt wenig Raum für Entscheidungen, die wirklich von einem selbst kommen. Die Überzeugung, dass sich der Alltag mit wenigen, einfachen Mitteln wie Luxus anfühlen kann, treibt hier die Ideen an.", en: "Those who live consciously are more satisfied. That sounds banal, but it rarely matches the everyday life of most people. Between work, the phone, and the expectation of being constantly reachable and productive, there is little room for decisions that truly come from yourself. The conviction that everyday life can feel like luxury with a few simple means drives the ideas here." },
    ],
    "loesungen.html": [
      { s: "#loesungen-heading .nowrap:nth-child(1)", de: "Auf der Suche nach", en: "Searching for" },
      { s: "#loesungen-heading .nowrap:nth-child(2)", de: "Lösungen", en: "solutions" },
      { s: ".hero__lede", de: "Tägliche Bewegung, bewusste Handlungen, Entschleunigung, gestaltete Orte machen einen Unterschied. Alles zusammen verändert, dass sich Dein Alltag reicher anfühlt.", en: "Daily movement, conscious actions, slowing down, and designed spaces make a difference. Together they change so your everyday life feels richer." },
      { s: ".fc-loesungen", attr: "aria-label", de: "Lösungen Moodboard", en: "Solutions moodboard" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(5) small", de: "Bewegung", en: "Movement" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(5) p", de: "In Bewegung kommen", en: "Get moving" },
      {
        s: ".fc-loesungen .fc-board > .pin:nth-child(5) .tooltip",
        html: true,
        de: "Körperliche Aktivität verbessert Stimmung, Kognition und Lebenserwartung nachweisbar. Wir schauen gemeinsam, was das konkret für deinen Alltag heißt.<em>Pedersen &amp; Saltin, 2015, Exercise as medicine</em>",
        en: "Physical activity measurably improves mood, cognition, and life expectancy. Together we look at what that means concretely for your everyday life.<em>Pedersen &amp; Saltin, 2015, Exercise as medicine</em>",
      },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(6) small", de: "Gruppe", en: "Group" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(6) p", de: "Freunde an einem Ort für tägliche Bewegung versammeln", en: "Bring friends together in one place for daily movement" },
      {
        s: ".fc-loesungen .fc-board > .pin:nth-child(6) .tooltip",
        html: true,
        de: "Soziale Einbindung ist einer der stärksten Motivatoren für Verhaltensänderung. Wohlwollendes Interesse füreinander passiert in echten Gruppen, nicht in Feeds.<em>Holt-Lunstad et al., 2015, Social relationships and health</em>",
        en: "Social connection is one of the strongest motivators for behaviour change. Benevolent interest in each other happens in real groups, not in feeds.<em>Holt-Lunstad et al., 2015, Social relationships and health</em>",
      },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(7) small", de: "Orientierung", en: "Orientation" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(7) p", de: "Die eigene Position bestimmen", en: "Determine your own position" },
      {
        s: ".fc-loesungen .fc-board > .pin:nth-child(7) .tooltip",
        html: true,
        de: "Wer versteht, wo er steht, im Leben, im Körper, im Raum, kann entspannter planen. Kontextklarheit reduziert Entscheidungsstress nachweislich.<em>Schwartz, 2004, The Paradox of Choice</em>",
        en: "Whoever understands where they stand in life, in their body, in space can plan more calmly. Context clarity measurably reduces decision stress.<em>Schwartz, 2004, The Paradox of Choice</em>",
      },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(8) small", de: "Freiheit", en: "Freedom" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(8) p", de: "Frei sein, nicht App-abhängig. Rituale ja, aber keine gelernten Dogmen", en: "Be free, not app-dependent. Rituals yes, but no learned dogmas" },
      {
        s: ".fc-loesungen .fc-board > .pin:nth-child(8) .tooltip",
        html: true,
        de: "Starre Regeln, die aus Schuldgefühlen oder zwanghaftem Handeln entstehen, können Dich blockieren. Dopamin-Trigger bewusst für gute Dinge zu setzen ist etwas anderes als Selbstoptimierungsdruck.<em>Hayes et al., 2006, Acceptance and Commitment Therapy</em>",
        en: "Rigid rules born from guilt or compulsive behaviour can block you. Consciously setting dopamine triggers for good things is different from self-optimization pressure.<em>Hayes et al., 2006, Acceptance and Commitment Therapy</em>",
      },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(9) small", de: "Aufräumen", en: "Clearing out" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(9) p", de: "In den fünf Säulen aufräumen und das Leben nicht mit 1000 Dingen aufladen", en: "Clear out the five pillars and do not load life with 1000 things" },
      {
        s: ".fc-loesungen .fc-board > .pin:nth-child(9) .tooltip",
        html: true,
        de: "Bewegung, Nahrung, Erholung, Soziales, Mentales. Nicht alles auf einmal optimieren. Erstmal verstehen, was für einen selbst wirklich gilt.<em>Kahneman, 2011, Thinking, Fast and Slow</em>",
        en: "Movement, nutrition, recovery, social life, mental health. Do not optimize everything at once. First understand what truly applies to you.<em>Kahneman, 2011, Thinking, Fast and Slow</em>",
      },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(10) small", de: "Historie", en: "History" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(10) p", de: "Interesse an Geschichte, damit man nicht überrascht wird", en: "Interest in history so you are not caught off guard" },
      {
        s: ".fc-loesungen .fc-board > .pin:nth-child(10) .tooltip",
        html: true,
        de: "Wer historische Muster kennt, persönlich wie gesellschaftlich, kann einordnen statt zu reagieren. Das macht ruhiger.<em>Harari, 2011, Sapiens</em>",
        en: "Whoever knows historical patterns, personal and societal, can contextualize instead of react. That makes you calmer.<em>Harari, 2011, Sapiens</em>",
      },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(11) small", de: "Ziel", en: "Goal" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(11) p", de: "Resilienz & Ambitionen & eine gute Zeit", en: "Resilience, ambition, and a good time" },
      {
        s: ".fc-loesungen .fc-board > .pin:nth-child(11) .tooltip",
        html: true,
        de: "Resilienz heißt nicht Stärke zeigen, sondern mit Unsicherheit handlungsfähig bleiben. Ambitionen die wirklich die eigenen sind, nicht übernommene.<em>Hayes, 2019, A Liberated Mind</em>",
        en: "Resilience does not mean showing strength but staying capable of action with uncertainty. Ambitions that are truly yours, not borrowed ones.<em>Hayes, 2019, A Liberated Mind</em>",
      },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(12) small", de: "Friday Circle", en: "Friday Circle" },
      { s: ".fc-loesungen .fc-board > .pin:nth-child(12) p", de: "Warum der Name FRIDAY CIRCLE?", en: "Why the name FRIDAY CIRCLE?" },
      {
        s: ".fc-loesungen .fc-board > .pin:nth-child(12) .tooltip",
        html: true,
        de: '„It\'s Friday." Wir glauben an den Wochenzyklus und diese bewusst gesetzten Momente, an Routinen die einem gut tun, an Momente des Flows, des Trainings, des Kreativen, des Durchboxen und der Ausgelassenheit. Wir suchen nach mehr Momenten außerhalb von Apps.',
        en: '"It\'s Friday." We believe in the weekly cycle and these consciously set moments, in routines that do you good, in moments of flow, training, creativity, pushing through, and exuberance. We look for more moments outside of apps.',
      },
    ],
    "projekte.html": [
      { s: "#projekte-heading .de-t .nowrap:nth-child(1)", de: "Make everything", en: "Make everything" },
      { s: "#projekte-heading .de-t .nowrap:nth-child(2)", de: "make sense", en: "make sense" },
      { s: ".hero--service .hero__lede .de-t", de: "Ich unterstütze Dich als Coach und Architekt mit viel Erfahrung und Substanz.", en: "I support you as a coach and architect with extensive experience and substance." },
      { s: "#gogogo .product__kicker", de: "Woher Du kommst und was Du willst ist individuell – so auch die echte & menschliche Betreuung.", en: "Where you come from and what you want is individual — and so is genuine human support." },
      { s: "#gogogo .product__tagline", de: "Komm in Bewegung.", en: "Get moving." },
      { s: "#gogogo .product__cta", de: "mehr lesen", en: "read more" },
      { s: "#haima .product__kicker", de: "Platzhalter – Kurzzeile wie beim gogogo-Kicker. Text folgt.", en: "Placeholder — short line like the gogogo kicker. Copy to follow." },
      { s: "#haima .product__tagline", de: "Platzhalter – eine Zeile wie „Komm in Bewegung.“", en: 'Placeholder — one line like "Get moving."' },
      { s: "#haima .product__cta", de: "offline", en: "offline" },
    ],
    "biig-interior": [
      {
        s: 'meta[name="description"]',
        attr: "content",
        de: "Mach Deinen Raum passend zum Lebensentwurf — Interiordesign und Architektur von Joscha.",
        en: "Make your space fit your life design — interior design and architecture by Joscha.",
      },
    ],
    "wolfganggrope.html": [
      { s: "header.nav.wga-nav", attr: "aria-label", de: "Wolfgang Grope Kunstwerke", en: "Wolfgang Grope art works" },
      {
        s: ".wga-nav .nav__logo",
        attr: "aria-label",
        de: "Wolfgang Grope Kunstwerke Startseite",
        en: "Wolfgang Grope art works home",
      },
      { s: ".nav__lang", attr: "aria-label", de: "Sprache", en: "Language" },
      {
        s: "#wga-chapters-btn",
        attr: "aria-label",
        de: "Katalogkapitel auswählen",
        en: "Choose catalog chapter",
      },
      {
        s: "#wga-bio-open",
        attr: "aria-label",
        de: "Lebenslauf öffnen",
        en: "Open CV",
      },
      {
        s: "#wga-inspiration-open",
        attr: "aria-label",
        de: "x INTERIOR öffnen",
        en: "Open x INTERIOR",
      },
    ],
    "joschaalstrainer.html": [
      {
        s: 'meta[name="description"]',
        attr: "content",
        de: "Joscha als Trainer — Sport als Bewegungstherapie bei Friday Circle gogogo.",
        en: "Joscha as a trainer — movement as therapy with Friday Circle gogogo.",
      },
      { s: "header.nav", attr: "aria-label", de: "Hauptnavigation", en: "Main navigation" },
      { s: ".gogogo-landing__logo", attr: "aria-label", de: "gogogo Startseite", en: "gogogo home" },
      { s: ".nav__lang", attr: "aria-label", de: "Sprache", en: "Language" },
      { s: "#ja-intro-kicker", de: "Kleine Kursänderungen", en: "Small course corrections" },
      {
        s: ".tj-hero--intro .tj-prose p:nth-of-type(1)",
        de: "Zwanzig Jahre lang habe ich Räume für andere entworfen und dabei meinen eigenen Alltag lange vernachlässigt. Mit Fitness Apps, Influencer Videos, Personal Training und Mitgliedschaften fühlte ich mich irgendwann überfordert. Dogmatischer Anspruch an mich und andere verhinderte echtes Ankommen, Zufriedenheit und einfach eine gute Zeit.",
        en: "For twenty years I designed spaces for others while neglecting my own everyday life for a long time. Fitness apps, influencer videos, personal training, and memberships eventually overwhelmed me. The pressure I put on myself and others crowded everything else out.",
      },
      {
        s: ".tj-hero--intro .tj-prose p:nth-of-type(2)",
        de: "Als ich anfing als Fitnesstrainer zu arbeiten, habe ich jeden Tag mehr begriffen, wie viel Potenzial an Zufriedenheit in einem gesunden Maß an Bewegung liegt. Das Naheliegende ist uns oft doch fern. Als Trainer darf ich wunderbare Gespräche mit so vielen unterschiedlichen Menschen führen und was ich aktuell erlebe, ist beeindruckend.",
        en: "When I started working as a fitness trainer, I understood more every day how much satisfaction lies in a healthy amount of movement. What seems obvious is often far from us. As a trainer I get to have wonderful conversations with so many different people — and what I am experiencing right now is impressive.",
      },
      {
        s: ".tj-hero--intro .tj-prose p:nth-of-type(3)",
        de: "Dein innerer Antrieb passt sich über Jahre Deinem Alltag an. Paradox. Das ist nicht immer gesund. Du und ich sind nicht im Einzelkampf. Es braucht wohlgesonnene Menschen.",
        en: "Your inner drive adapts to your everyday life over the years. Paradoxically, that is not always healthy. You and I are not fighting alone. It takes people who are genuinely on your side.",
      },
      {
        s: ".tj-hero--intro .tj-prose p:nth-of-type(4)",
        de: "Anstatt auf Social Media das Optimum zu suchen und unter äußerem und innerem Druck zu zerbrechen, benötigen wir einen oder mehrere Menschen, die sich Zeit für uns nehmen. Nachdem ich das für mich verstanden habe, war klar, was ich anderen Menschen geben möchte. Echtes wohlwollendes Interesse und ein ehrlicher Blick auf das, was für Dich wirklich möglich ist.",
        en: "Instead of chasing the perfect life on social media and breaking under external and internal pressure, we need one or more people who take time for us. Once I understood that for myself, it was clear what I want to give others: genuine benevolent interest and an honest view of what is truly possible for you.",
      },
      { s: ".tj-hero--intro .tj-hero__figure img", attr: "alt", de: "Joscha im Gym", en: "Joscha portrait" },
      {
        s: ".tj-section--gym-only",
        attr: "aria-label",
        de: "Joscha und Kollege beim Training im Gym",
        en: "Joscha and a colleague training in the gym",
      },
      { s: ".tj-section--gym-only img", attr: "alt", de: "Joscha und Kollege beim Training im Gym", en: "Joscha and a colleague training in the gym" },
    ],
    "programmierung.html": [
      { s: ".programmierung-sub__intro .landing-bridge__kicker", de: "Pragmatischer Optimismus", en: "Pragmatic Optimism" },
      { s: "#fc-life-headline", html: true, de: "Dein Leben verläuft parallel zum Leben des Internets.", en: "Your life runs parallel to the life of the internet." },
      { s: ".fc-life-squares .subline", de: "90 Quadrate stellen eine aktuell langes Leben dar. Klick auf ein Jahr und erinnere Dich an was war und was vielleicht sein wird. Unten kannst Du Feedback und Ideen senden.", en: "90 squares represent a currently long life. Click a year and remember what was and what may come. Below you can send feedback and ideas." },
      { s: ".fc-life-squares .ctrl-label", de: "Geburtsjahr:", en: "Birth year:" },
      { s: '.fc-life-squares .toggle-btn[data-mode="neg"]', de: "↓ Herausforderungen", en: "↓ Challenges" },
      { s: '.fc-life-squares .toggle-btn[data-mode="pos"]', de: "↑ Chancen & Wandel", en: "↑ Opportunities & change" },
      { s: '.fc-life-squares .toggle-btn[data-mode="global"]', de: "🌍 Welt außerhalb", en: "🌍 World outside" },
      { s: "#geschichte-kontext .hero-eyebrow", de: "Kontext · Gesellschaft · Technologie · Macht", en: "Context · Society · Technology · Power" },
      { s: "#geschichte-kontext .hero-title", html: true, de: "Wie unsere Welt<br>wirklich funktioniert.", en: "How our world<br>really works." },
      { s: "#geschichte-kontext .hero-sub", de: "Faktenbasierter Überblick über die Entwicklung des Internets, sozialer Medien und technologischer Machtstrukturen — und deren Einfluss auf Demokratie, Meinungsbildung und Gesellschaft.", en: "Fact-based overview of the internet, social media, and technological power structures — and their influence on democracy, opinion, and society." },
      { s: "#geschichte-kontext .era:nth-of-type(1) .era-title", de: "Das Internet entsteht", en: "The internet emerges" },
      { s: "#geschichte-kontext .era:nth-of-type(2) .era-title", de: "Die Stanford-Mafia", en: "The Stanford mafia" },
      { s: "#geschichte-kontext .era:nth-of-type(3) .era-title", de: "Social Media als Kontrollinfrastruktur", en: "Social media as control infrastructure" },
      { s: "#geschichte-kontext .era:nth-of-type(4) .era-title", de: "Surveillance Capitalism trifft Demokratie", en: "Surveillance capitalism meets democracy" },
      { s: "#geschichte-kontext .era:nth-of-type(5) .era-title", de: "Technologische Autokratie im Aufbau", en: "Technological autocracy in the making" },
      { s: "#geschichte-kontext .era:nth-of-type(6) .era-title", de: "Künstliche Intelligenz — der nächste Filter auf Realität", en: "Artificial intelligence — the next filter on reality" },
      { s: "#geschichte-kontext .analysis-title", de: "Das System — wie alles zusammenhängt", en: "The system — how it all connects" },
      { s: "#geschichte-kontext .sources-title", de: "Quellenhinweise & weiterführende Lektüre", en: "Sources & further reading" },
      { s: "#geschichte-kontext .footnote", de: "Diese Seite ist eine kuratierte Zusammenfassung öffentlich verfügbarer Fakten und dokumentierter Ereignisse. Zuletzt aktualisiert: Mai 2026.", en: "This page is a curated summary of publicly available facts and documented events. Last updated: May 2026." },
      { s: ".fc-life-squares .legend-item:nth-child(1)", de: "Vor dem Web", en: "Before the web" },
      { s: ".fc-life-squares .legend-item:nth-child(2)", de: "Frühes Internet", en: "Early internet" },
      { s: ".fc-life-squares .legend-item:nth-child(3)", de: "Social Media", en: "Social media" },
      { s: ".fc-life-squares .legend-item:nth-child(4)", de: "Krise", en: "Crisis" },
      { s: ".fc-life-squares .legend-item:nth-child(5)", de: "Heute", en: "Today" },
      { s: ".fc-life-squares .legend-item:nth-child(6)", de: "Zukunft", en: "Future" },
      { s: "#panelPlaceholder .detail-panel-placeholder__text", de: "klick auf ein Jahr", en: "click on a year" },
    ],
  };

  /** Auto-translate card blocks in Geschichte section (title + teaser text) */
  var GESCHICHTE_CARDS = [
    ["ARPANET — das erste Netz", "ARPANET — the first network"],
    ["World Wide Web — Tim Berners-Lee", "World Wide Web — Tim Berners-Lee"],
    ["Palantir — CIA, Thiel & Überwachung", "Palantir — CIA, Thiel & surveillance"],
    ["Google — \"Don't be evil\"", "Google — \"Don't be evil\""],
    ["Facebook — von Chronik zur Empörungsmaschine", "Facebook — from timeline to outrage machine"],
    ["Twitter — politisches Leitmedium", "Twitter — political lead medium"],
    ["Snowden / PRISM / NSA", "Snowden / PRISM / NSA"],
    ["Cambridge Analytica", "Cambridge Analytica"],
    ["TikTok — die Identitätsmaschine", "TikTok — the identity machine"],
    ["Crypto — Parallel-Infrastruktur", "Crypto — parallel infrastructure"],
    ["ChatGPT", "ChatGPT"],
    ["Llama", "Llama"],
    ["Claude / Gemini", "Claude / Gemini"],
  ];

  var originals = new WeakMap();

  function applyEntry(el, entry, lang) {
    if (!originals.has(el)) {
      originals.set(el, {
        html: entry.html,
        de: entry.de,
        en: entry.en,
        attr: entry.attr || null,
      });
    }
    var o = originals.get(el);
    var val = lang === "en" ? o.en : o.de;
    if (o.attr) {
      el.setAttribute(o.attr, val);
      return;
    }
    if (o.html) el.innerHTML = val;
    else el.textContent = val;
  }

  function applyGogogoTiles(lang) {
    if (!window.GOGL_TILE_I18N) return;
    var tiles = document.querySelectorAll("#gogl-tile-grid .gogl-tile");
    window.GOGL_TILE_I18N.forEach(function (row, i) {
      var tile = tiles[i];
      if (!tile) return;
      var titleEl = tile.querySelector(".gogl-tile__title");
      var bodyEl = tile.querySelector(".gogl-tile__body > p");
      if (titleEl) {
        applyEntry(titleEl, { de: row.titleDe, en: row.titleEn }, lang);
      }
      if (bodyEl) {
        applyEntry(bodyEl, { de: row.bodyDe, en: row.bodyEn }, lang);
      }
    });
    document.querySelectorAll(".gogl-tile__bg-btn").forEach(function (btn) {
      applyEntry(btn, { de: "Hintergrund →", en: "Background →" }, lang);
    });
    document.querySelectorAll(".gogl-tile__cta-mail").forEach(function (a) {
      applyEntry(a, { de: "Erstgespräch buchen", en: "Book intro call" }, lang);
    });
    document.querySelectorAll(".gogl-tile__bg > h4").forEach(function (h4) {
      var stored = originals.get(h4);
      var deKey = stored ? stored.de : h4.textContent.trim();
      if (deKey === "Warum Begleitung wirkt") {
        applyEntry(h4, { de: "Warum Begleitung wirkt", en: "Why companionship works" }, lang);
      } else {
        applyEntry(h4, { de: "Wissenschaftlicher Hintergrund", en: "Scientific background" }, lang);
      }
    });
  }

  function applyGogogoCarousel(lang) {
    if (!window.GOGL_CAROUSEL_I18N) return;
    window.GOGL_CAROUSEL_I18N.forEach(function (row) {
      var card = document.getElementById(row.id);
      if (!card) return;
      var pill = card.querySelector('[style*="top:20px"] span');
      if (pill) applyEntry(pill, { de: row.labelDe, en: row.labelEn }, lang);
      var collapsedH3 = card.querySelector(".cc-collapsed h3");
      var expandedH3 = card.querySelector(".cc-expanded h3");
      var expandedP = card.querySelector(".cc-expanded p[style*='Georgia']");
      var expandedA = card.querySelector(".cc-expanded a");
      if (collapsedH3) applyEntry(collapsedH3, { html: true, de: row.titleDe, en: row.titleEn }, lang);
      if (expandedH3) applyEntry(expandedH3, { html: true, de: row.titleDe, en: row.titleEn }, lang);
      if (expandedP) applyEntry(expandedP, { de: row.bodyDe, en: row.bodyEn }, lang);
      if (expandedA) applyEntry(expandedA, { de: row.ctaDe, en: row.ctaEn }, lang);
    });
  }

  function applyGogogoFpTiles(lang) {
    if (!window.GOGL_FP_I18N) return;
    window.GOGL_FP_I18N.forEach(function (row) {
      var tile = document.getElementById(row.id);
      if (!tile) return;
      var labelP = tile.querySelector(".fp-collapsed > p");
      if (labelP) applyEntry(labelP, { de: row.labelDe, en: row.labelEn }, lang);
      var collapsedH4 = tile.querySelector(".fp-collapsed h4");
      if (collapsedH4) applyEntry(collapsedH4, { de: row.titleDe, en: row.titleEn }, lang);
      var expandedP = tile.querySelector(".fp-expanded p[style*='Georgia']");
      if (expandedP) applyEntry(expandedP, { de: row.bodyDe, en: row.bodyEn }, lang);
    });
  }

  function applyGogogoAria(lang) {
    var prev = document.querySelector(".gogl-program-slider-arrow--prev");
    var next = document.querySelector(".gogl-program-slider-arrow--next");
    if (prev) {
      applyEntry(prev, { attr: "aria-label", de: "Vorheriges Programm", en: "Previous program" }, lang);
    }
    if (next) {
      applyEntry(next, { attr: "aria-label", de: "Nächstes Programm", en: "Next program" }, lang);
    }
    var labelsDe = [
      "Sportsfreunde versammeln",
      "Mitglied werden",
      "Den passenden Trainer",
      "ZIRKELTRAINING",
      "Factfulness",
      "Upper Body",
      "Mobilityroutine",
      "Triff Joscha",
    ];
    var labelsEn = [
      "Gather your sports friends",
      "Become a member",
      "Find the right trainer",
      "CIRCUIT TRAINING",
      "Factfulness",
      "Upper body",
      "Mobility routine",
      "Meet Joscha",
    ];
    document.querySelectorAll(".gogl-program-slider__dot").forEach(function (dot, i) {
      applyEntry(
        dot,
        { attr: "aria-label", de: labelsDe[i] || "", en: labelsEn[i] || "" },
        lang
      );
    });
    var popup = document.getElementById("member-popup");
    if (popup) {
      applyEntry(popup, { attr: "aria-label", de: "Mitgliedschaft auswählen", en: "Choose membership" }, lang);
      var close = popup.querySelector(".member-popup__close");
      if (close) {
        applyEntry(close, { attr: "aria-label", de: "Popup schließen", en: "Close popup" }, lang);
      }
    }
    var langGroup = document.querySelector(".nav__lang");
    if (langGroup) {
      applyEntry(langGroup, { attr: "aria-label", de: "Sprache", en: "Language" }, lang);
    }
  }

  function applyRegisterPlaceholder(el, de, en, lang) {
    if (!originals.has(el)) {
      originals.set(el, {
        attr: "placeholder",
        de: el.getAttribute("placeholder") || de,
        en: en,
        html: false,
      });
    }
    applyEntry(el, originals.get(el), lang);
  }

  function applyRegisterCheckboxLabels(pairs, lang) {
    document.querySelectorAll(".gogl-motive .gogl-check").forEach(function (label, i) {
      var pair = pairs[i];
      if (!pair) return;
      if (!originals.has(label)) {
        originals.set(label, { html: false, de: pair[0], en: pair[1], attr: null });
      }
      var o = originals.get(label);
      var text = lang === "en" ? o.en : o.de;
      var input = label.querySelector("input");
      if (input) input.setAttribute("value", text);
      var nodes = [];
      label.childNodes.forEach(function (n) {
        if (n.nodeType === 3) nodes.push(n);
      });
      nodes.forEach(function (n) {
        label.removeChild(n);
      });
      label.appendChild(document.createTextNode(text));
    });
  }

  function applyRegisterPage(lang) {
    var cfg = window.REGISTER_I18N;
    if (!cfg) return;
    var pageKey = PAGE === "register-accountability" ? "accountability" : "training";
    var page = cfg[pageKey];
    var shared = cfg.shared;
    if (!page || !shared) return;

    shared.placeholders.forEach(function (row) {
      document.querySelectorAll(row.s).forEach(function (el) {
        applyRegisterPlaceholder(el, row.de, row.en, lang);
      });
    });

    var legend = document.querySelector(".gogl-motive__legend");
    if (legend) applyEntry(legend, shared.legend, lang);

    document.querySelectorAll("#gogl-dsgvo").forEach(function (input) {
      var span = input.parentElement && input.parentElement.querySelector("span");
      if (span) applyEntry(span, shared.consentPrivacy, lang);
    });
    document.querySelectorAll("#gogl-membership").forEach(function (input) {
      var span = input.parentElement && input.parentElement.querySelector("span");
      if (span) applyEntry(span, shared.consentMembership, lang);
    });

    shared.footer.forEach(function (row) {
      document.querySelectorAll(row.s).forEach(function (el) {
        applyEntry(el, row, lang);
      });
    });

    var logo = document.querySelector(".gogogo-landing__logo");
    if (logo) applyEntry(logo, { attr: "aria-label", de: shared.logoAria.de, en: shared.logoAria.en }, lang);
    var nav = document.querySelector(".nav");
    if (nav) applyEntry(nav, { attr: "aria-label", de: shared.navAria.de, en: shared.navAria.en }, lang);
    var footer = document.querySelector(".footer");
    if (footer) applyEntry(footer, { attr: "aria-label", de: shared.footerAria.de, en: shared.footerAria.en }, lang);
    var footerNav = document.querySelector(".footer__links");
    if (footerNav) {
      applyEntry(footerNav, { attr: "aria-label", de: shared.footerLinksAria.de, en: shared.footerLinksAria.en }, lang);
    }
    var langGroup = document.querySelector(".nav__lang");
    if (langGroup) {
      applyEntry(langGroup, { attr: "aria-label", de: "Sprache", en: "Language" }, lang);
    }

    var h1 = document.getElementById("gogl-form-h");
    if (h1) applyEntry(h1, page.h1, lang);
    var submit = document.querySelector(".gogl-form__submit");
    if (submit) applyEntry(submit, page.submit, lang);
    var msg = document.getElementById("gogl-message");
    if (msg) applyRegisterPlaceholder(msg, page.messagePlaceholder.de, page.messagePlaceholder.en, lang);

    var benefitsAside = document.querySelector(".gogl-form-stage__benefits");
    if (benefitsAside) {
      applyEntry(benefitsAside, { attr: "aria-label", de: page.benefitsAria.de, en: page.benefitsAria.en }, lang);
    }
    var below = document.querySelector(".gogl-form-below");
    if (below) {
      applyEntry(below, { attr: "aria-label", de: page.belowAria.de, en: page.belowAria.en }, lang);
    }

    if (page.intro) {
      document.querySelectorAll(".gogl-form-stage__benefits-intro p").forEach(function (p, i) {
        if (page.intro[i]) applyEntry(p, page.intro[i], lang);
      });
    }
    if (page.outro) {
      document.querySelectorAll(".gogl-form-stage__benefits-outro p").forEach(function (p) {
        applyEntry(p, page.outro, lang);
      });
    }
    document.querySelectorAll(".gogl-form-stage__benefits-list li").forEach(function (li, i) {
      if (page.benefits[i]) applyEntry(li, page.benefits[i], lang);
    });

    applyRegisterCheckboxLabels(page.checkboxes, lang);

    document.querySelectorAll(".gogl-form-below__headline").forEach(function (el, i) {
      if (page.belowHeadlines[i]) {
        applyEntry(el, { de: page.belowHeadlines[i][0], en: page.belowHeadlines[i][1] }, lang);
      }
    });

    document.title = lang === "en" ? page.title.en : page.title.de;
    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      if (!originals.has(meta)) {
        originals.set(meta, {
          attr: "content",
          de: meta.getAttribute("content") || page.meta.de,
          en: page.meta.en,
          html: false,
        });
      }
      applyEntry(meta, originals.get(meta), lang);
    }
  }

  function applyGogogoLanding(lang) {
    var list = window.GOGL_I18N_ENTRIES || [];
    list.forEach(function (entry) {
      document.querySelectorAll(entry.s).forEach(function (el) {
        applyEntry(el, entry, lang);
      });
    });
    applyGogogoTiles(lang);
    applyGogogoCarousel(lang);
    applyGogogoFpTiles(lang);
    applyGogogoAria(lang);
    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      if (!originals.has(meta)) {
        originals.set(meta, {
          attr: "content",
          de: meta.getAttribute("content") || "",
          en: "You know what to do. We build the plan that actually works. No subscription. No course. A person who stays with you. First step free.",
          html: false,
        });
      }
      applyEntry(meta, originals.get(meta), lang);
    }
    document.title =
      lang === "en" ? "gogogo – Get moving | Friday Circle" : "gogogo – Komm in Bewegung | Friday Circle";
  }

  function applyGeschichteCards(lang) {
    if (PAGE !== "programmierung.html") return;
    document.querySelectorAll("#geschichte-kontext .card-title").forEach(function (el) {
      var t = el.textContent.trim();
      GESCHICHTE_CARDS.forEach(function (pair) {
        if (t === pair[0]) {
          if (!originals.has(el)) originals.set(el, { html: false, de: pair[0], en: pair[1] });
          el.textContent = lang === "en" ? pair[1] : pair[0];
        }
      });
    });
  }

  function applyPage(lang) {
    var list = MAP[PAGE];
    if (list) {
      list.forEach(function (entry) {
        document.querySelectorAll(entry.s).forEach(function (el) {
          applyEntry(el, entry, lang);
        });
      });
    }
    applyGeschichteCards(lang);
    if (PAGE === "gogogo-landing.html") {
      applyGogogoLanding(lang);
    }
    if (PAGE === "register-accountability" || PAGE === "register-training") {
      applyRegisterPage(lang);
    }
    if (PAGE === "biig-interior") {
      document.title =
        lang === "en" ? "biig Interior — Friday Circle" : "biig Interior — Friday Circle";
    }
    if (PAGE === "joschaalstrainer.html") {
      document.title =
        lang === "en" ? "Joscha as trainer — Friday Circle" : "Joscha als Trainer — Friday Circle";
    }
    if (PAGE === "loesungen.html") {
      document.title =
        lang === "en" ? "Solutions — FRIDAY CIRCLE" : "Lösungen — FRIDAY CIRCLE";
    }
    if (PAGE === "wolfganggrope.html") {
      document.title =
        lang === "en"
          ? "WOLFGANG GROPE ART WORKS — Friday Circle"
          : "WOLFGANG GROPE KUNSTWERKE — Friday Circle";
    }
    if (PAGE === "programmierung.html") {
      document.querySelectorAll("#geschichte-kontext .expand-btn").forEach(function (btn) {
        if (!originals.has(btn)) {
          originals.set(btn, { html: false, de: "+ Mehr Details", en: "+ More details" });
        }
        var o = originals.get(btn);
        btn.textContent = lang === "en" ? o.en : o.de;
        if (btn.closest(".expandable") && btn.closest(".expandable").classList.contains("open")) {
          btn.textContent = lang === "en" ? "− Less" : "− Weniger";
        }
      });
    }
    document.querySelectorAll("main [data-i18n-de][data-i18n-en]").forEach(function (el) {
      var de = el.getAttribute("data-i18n-de");
      var en = el.getAttribute("data-i18n-en");
      if (el.hasAttribute("data-i18n-html")) {
        el.innerHTML = lang === "en" ? en : de;
      } else {
        el.textContent = lang === "en" ? en : de;
      }
    });
  }

  window.FC_I18N_APPLY = applyPage;

  document.addEventListener("fc-lang-change", function (e) {
    applyPage(e.detail.lang);
  });

  function bootI18n() {
    var lang =
      document.body.classList.contains("en") || document.documentElement.lang === "en" ? "en" : "de";
    applyPage(lang);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootI18n);
  } else {
    bootI18n();
  }
})();
