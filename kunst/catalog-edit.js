/* Pure catalog edits for the Wolfgang Grope admin. Browser and Node. */
(function (root) {
  function pad3(value) {
    var n = parseInt(String(value).replace(/\D/g, ""), 10);
    if (!Number.isFinite(n) || n < 1 || n > 999) return "";
    return String(n).padStart(3, "0");
  }

  function chapterNoFromSection(section) {
    var chapter = String((section && section.chapter) || "");
    var match = chapter.match(/^(\d{2})\b/);
    return match ? match[1] : "";
  }

  function parseCatalogId(value) {
    var match = String(value || "").match(/^(?:wg|WG)-(\d+)-(\d{3})(-[a-z])?$/i);
    if (!match) return null;
    return {
      chapter: match[1].padStart(2, "0"),
      num: match[2],
      suffix: match[3] || "",
    };
  }

  function findWork(catalog, id) {
    var sections = (catalog && catalog.sections) || [];
    for (var i = 0; i < sections.length; i++) {
      var works = sections[i].works || [];
      for (var j = 0; j < works.length; j++) {
        if (works[j] && works[j].id === id) {
          return { section: sections[i], index: j, work: works[j] };
        }
      }
    }
    return null;
  }

  function findSection(catalog, sectionId) {
    var sections = (catalog && catalog.sections) || [];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].id === sectionId) return sections[i];
    }
    return null;
  }

  function idTaken(catalog, id, exceptId) {
    var found = findWork(catalog, id);
    return !!(found && found.work.id !== exceptId);
  }

  function sortSection(section) {
    (section.works || []).sort(function (a, b) {
      var ap = parseCatalogId(a.catalogId || a.id) || { num: "999", suffix: "" };
      var bp = parseCatalogId(b.catalogId || b.id) || { num: "999", suffix: "" };
      if (ap.num !== bp.num) return ap.num < bp.num ? -1 : 1;
      return ap.suffix < bp.suffix ? -1 : ap.suffix > bp.suffix ? 1 : 0;
    });
  }

  function touch(catalog) {
    catalog.meta = catalog.meta || {};
    catalog.meta.updatedAt = new Date().toISOString();
  }

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function applyIdentity(work, section, number, exceptId) {
    var chapter = chapterNoFromSection(section);
    var num = pad3(number);
    if (!chapter) return "Kapitel ohne Nummer.";
    if (!num) return "Nummer zwischen 1 und 999.";
    var parsed = parseCatalogId(work.catalogId || work.id);
    var suffix = parsed && parsed.suffix ? parsed.suffix : "";
    var nextId = "wg-" + chapter + "-" + num + suffix;
    if (idTaken(work.__catalog || {}, nextId, exceptId)) return "Diese Nummer ist schon vergeben.";
    work.catalogId = "WG-" + chapter + "-" + num + suffix;
    work.id = nextId;
    return "";
  }

  function setUnavailable(catalog, id, unavailable) {
    var found = findWork(catalog, id);
    if (!found) return "Werk nicht gefunden.";
    found.work.berlinStatus = unavailable ? "unavailable" : "available";
    touch(catalog);
    return "";
  }

  function removeWork(catalog, id) {
    var found = findWork(catalog, id);
    if (!found) return "Werk nicht gefunden.";
    found.section.works.splice(found.index, 1);
    touch(catalog);
    return "";
  }

  function updateWork(catalog, id, patch) {
    var found = findWork(catalog, id);
    if (!found) return "Werk nicht gefunden.";
    var work = found.work;
    var section = found.section;
    var nextSection = section;
    if (patch.sectionId && patch.sectionId !== section.id) {
      nextSection = findSection(catalog, patch.sectionId);
      if (!nextSection) return "Kapitel nicht gefunden.";
    }
    var number = patch.number != null ? patch.number : (parseCatalogId(work.catalogId || work.id) || {}).num;
    var draft = {
      catalogId: work.catalogId,
      id: work.id,
      __catalog: catalog,
    };
    var identityError = applyIdentity(draft, nextSection, number, id);
    if (identityError) return identityError;

    var nextMedium = patch.medium != null ? cleanText(patch.medium) : work.medium;
    var titleWasMedium = cleanText(work.title) === cleanText(work.medium);
    if (patch.medium != null && (patch.title == null || !cleanText(patch.title)) && titleWasMedium) {
      work.title = nextMedium || work.title;
    } else if (patch.title != null && cleanText(patch.title)) {
      work.title = cleanText(patch.title);
    }
    if (patch.medium != null) work.medium = nextMedium;
    if (patch.year != null) work.year = cleanText(patch.year) || "—";
    if (patch.dimensions != null) work.dimensions = cleanText(patch.dimensions) || "—";
    if (patch.price != null) work.price = cleanText(patch.price);
    if (patch.berlinStatus) work.berlinStatus = patch.berlinStatus === "unavailable" ? "unavailable" : "available";
    if (Array.isArray(patch.images)) work.images = patch.images.filter(Boolean);
    work.catalogId = draft.catalogId;
    work.id = draft.id;

    if (nextSection !== section) {
      section.works.splice(found.index, 1);
      nextSection.works = nextSection.works || [];
      nextSection.works.push(work);
      sortSection(section);
      sortSection(nextSection);
    } else {
      sortSection(section);
    }
    touch(catalog);
    return "";
  }

  function addWork(catalog, patch) {
    var section = findSection(catalog, patch.sectionId);
    if (!section) return "Kapitel wählen.";
    var medium = cleanText(patch.medium) || "Werk";
    var work = {
      id: "wg-tmp",
      catalogId: "WG-tmp",
      title: cleanText(patch.title) || medium,
      year: cleanText(patch.year) || "—",
      medium: medium,
      dimensions: cleanText(patch.dimensions) || "—",
      price: cleanText(patch.price),
      body: "",
      berlinStatus: patch.berlinStatus === "unavailable" ? "unavailable" : "available",
      images: Array.isArray(patch.images) ? patch.images.filter(Boolean) : [],
    };
    var draft = { catalogId: "", id: "", __catalog: catalog };
    var identityError = applyIdentity(draft, section, patch.number, "");
    if (identityError) return identityError;
    work.id = draft.id;
    work.catalogId = draft.catalogId;
    if (!work.images.length) {
      var placeholder = catalog.meta && catalog.meta.placeholder;
      if (placeholder) work.images = [placeholder];
    }
    section.works = section.works || [];
    section.works.push(work);
    sortSection(section);
    touch(catalog);
    return "";
  }

  root.WgaCatalogEdit = {
    pad3: pad3,
    chapterNoFromSection: chapterNoFromSection,
    parseCatalogId: parseCatalogId,
    findWork: findWork,
    setUnavailable: setUnavailable,
    removeWork: removeWork,
    updateWork: updateWork,
    addWork: addWork,
    sortSection: sortSection,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
