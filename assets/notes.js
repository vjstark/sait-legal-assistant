/* ==========================================================================
   Shared behaviour for the course notes pages:
   theme toggle, one-topic-at-a-time navigation, prev/next, mobile drawer,
   and the giscus comments loader. Topic order is read from the DOM, so each
   page only needs its .topic sections + a matching table of contents.
   ========================================================================== */
(function () {
  "use strict";

  // ---- Theme (matches the schedule page) --------------------------------
  function currentTheme() {
    var explicit = document.documentElement.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function renderThemeIcon() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.innerHTML = currentTheme() === "dark" ? '<i class="ti ti-sun"></i>' : '<i class="ti ti-moon"></i>';
  }
  function setGiscusTheme(theme) {
    var f = document.querySelector("iframe.giscus-frame");
    if (f && f.contentWindow) {
      f.contentWindow.postMessage({ giscus: { setConfig: { theme: theme } } }, "https://giscus.app");
    }
  }
  window.toggleTheme = function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    renderThemeIcon();
    setGiscusTheme(next);
  };
  renderThemeIcon();
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      renderThemeIcon();
      setGiscusTheme(currentTheme());
    });
  }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- One-topic-at-a-time navigation (only when topics exist) ----------
  var topicEls = Array.prototype.slice.call(document.querySelectorAll(".content .topic"));
  if (topicEls.length) {
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc-body a"));
    var mbCurrent = document.getElementById("mb-current");

    var ORDER = topicEls.map(function (sec) {
      var link = document.querySelector('.toc-body a[href="#' + sec.id + '"]');
      return { id: sec.id, label: link ? link.textContent.trim() : sec.id };
    });
    var indexById = {};
    ORDER.forEach(function (t, i) { indexById[t.id] = i; });

    // Prev / Next footer inside each topic
    ORDER.forEach(function (t, i) {
      var sec = document.getElementById(t.id);
      if (!sec) return;
      var prev = ORDER[i - 1], next = ORDER[i + 1];
      var nav = document.createElement("nav");
      nav.className = "prevnext";
      nav.innerHTML =
        (prev
          ? '<a class="prev" href="#' + prev.id + '"><span class="pn-dir">← Previous</span><span class="pn-title">' + prev.label + '</span></a>'
          : '<a class="prev hide" aria-hidden="true"></a>') +
        (next
          ? '<a class="next" href="#' + next.id + '"><span class="pn-dir">Next →</span><span class="pn-title">' + next.label + '</span></a>'
          : '<a class="next hide" aria-hidden="true"></a>');
      sec.appendChild(nav);
    });

    var toc = document.getElementById("toc");
    var backdrop = document.getElementById("toc-backdrop");
    function openMenu() { if (toc) toc.classList.add("open"); if (backdrop) backdrop.classList.add("show"); }
    function closeMenu() { if (toc) toc.classList.remove("open"); if (backdrop) backdrop.classList.remove("show"); }

    function showTopic(id, scroll) {
      if (!(id in indexById)) id = ORDER[0].id;
      ORDER.forEach(function (t) {
        var sec = document.getElementById(t.id);
        if (sec) sec.classList.toggle("active", t.id === id);
      });
      tocLinks.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + id);
      });
      if (mbCurrent) mbCurrent.textContent = ORDER[indexById[id]].label;
      closeMenu();
      if (scroll) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }

    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute("href").slice(1);
      if (!(id in indexById)) return;
      e.preventDefault();
      history.replaceState(null, "", "#" + id);
      showTopic(id, true);
    });

    var mbMenu = document.getElementById("mb-menu");
    var tocClose = document.getElementById("toc-close");
    if (mbMenu) mbMenu.addEventListener("click", openMenu);
    if (tocClose) tocClose.addEventListener("click", closeMenu);
    if (backdrop) backdrop.addEventListener("click", closeMenu);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

    showTopic(location.hash.length > 1 ? location.hash.slice(1) : ORDER[0].id, false);
    window.addEventListener("hashchange", function () {
      showTopic(location.hash.length > 1 ? location.hash.slice(1) : ORDER[0].id, false);
    });
  }

  // ---- Comments: load giscus (GitHub Discussions), themed to match ------
  var container = document.getElementById("giscus-container");
  if (container) {
    var s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    s.setAttribute("data-repo", "vjstark/sait-legal-assistant");
    s.setAttribute("data-repo-id", "R_kgDOUKD0eQ");
    s.setAttribute("data-category", "General");
    s.setAttribute("data-category-id", "DIC_kwDOUKD0ec4DFdyo");
    s.setAttribute("data-mapping", "pathname");
    s.setAttribute("data-strict", "0");
    s.setAttribute("data-reactions-enabled", "1");
    s.setAttribute("data-emit-metadata", "0");
    s.setAttribute("data-input-position", "bottom");
    s.setAttribute("data-theme", currentTheme() === "dark" ? "dark" : "light");
    s.setAttribute("data-lang", "en");
    s.crossOrigin = "anonymous";
    s.async = true;
    container.appendChild(s);
  }
})();
