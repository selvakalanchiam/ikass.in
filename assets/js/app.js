(function () {
  "use strict";

  var DEFAULT_SLUG = "index";
  var VALID_SLUGS = ["index", "techrevamp", "codings", "education", "paperproduct", "ppm", "hm"];

  function slugFromHash() {
    var h = window.location.hash.replace(/^#\/?/, "").trim();
    return VALID_SLUGS.indexOf(h) !== -1 ? h : DEFAULT_SLUG;
  }

  function showPage(slug) {
    for (var i = 0; i < VALID_SLUGS.length; i++) {
      var el = document.getElementById("page-" + VALID_SLUGS[i]);
      if (!el) continue;
      el.classList.toggle("active", VALID_SLUGS[i] === slug);
    }
    var active = document.getElementById("page-" + slug);
    if (active && active.dataset.title) {
      document.title = active.dataset.title;
    }
    window.scrollTo(0, 0);
  }

  function route() {
    showPage(slugFromHash());
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", route);
})();
