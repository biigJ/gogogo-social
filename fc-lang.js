(function initFcLang() {
  if (window.__fcLangInit) return;
  window.__fcLangInit = true;
  var KEY = "fcLang";

  function apply(lang) {
    var next = lang === "en" ? "en" : "de";
    document.documentElement.lang = next;
    document.body.classList.remove("en", "de");
    document.body.classList.add(next);
    document.querySelectorAll("[data-fc-lang]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-fc-lang") === next);
    });
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    if (typeof window.FC_I18N_APPLY === "function") {
      window.FC_I18N_APPLY(next);
    }
    document.dispatchEvent(new CustomEvent("fc-lang-change", { detail: { lang: next } }));
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-fc-lang]");
    if (!btn) return;
    e.preventDefault();
    apply(btn.getAttribute("data-fc-lang"));
  });

  function syncNavLangWidth() {
    var langEl = document.querySelector(".nav__lang");
    if (langEl) {
      document.documentElement.style.setProperty("--nav-lang-width", langEl.offsetWidth + "px");
    }
  }

  document.addEventListener("fc-chrome-ready", syncNavLangWidth);
  document.addEventListener("DOMContentLoaded", syncNavLangWidth);

  window.FC_LANG_APPLY = apply;

  var stored = "de";
  try {
    stored = localStorage.getItem(KEY) || "de";
  } catch (e) {}
  if (location.search.includes("lang=en")) stored = "en";
  if (!document.body.classList.contains("de") && !document.body.classList.contains("en")) {
    document.body.classList.add("de");
  }

  function boot() {
    apply(stored);
  }

  if (typeof window.FC_I18N_APPLY === "function") {
    boot();
  } else {
    var s = document.createElement("script");
    var ref = document.querySelector("script[src*='fc-lang'], script[src*='nav.js']");
    try {
      s.src = ref ? new URL("fc-i18n.js", ref.src).href : "fc-i18n.js";
    } catch (e) {
      s.src = "fc-i18n.js";
    }
    s.onload = boot;
    document.head.appendChild(s);
  }
})();
