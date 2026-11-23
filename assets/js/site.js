/* Publication filters: show papers by research area. Works without JS (all shown). */
(function () {
  "use strict";
  var bar = document.querySelector("[data-filters]");
  if (!bar) return;
  var buttons = bar.querySelectorAll("button[data-filter]");
  var pubs = document.querySelectorAll(".pub[data-area]");
  var years = document.querySelectorAll(".pub-year");
  var count = document.querySelector("[data-count]");
  bar.hidden = false;

  function apply(area) {
    var shown = 0;
    pubs.forEach(function (p) {
      var match = area === "all" || p.getAttribute("data-area").split(" ").indexOf(area) !== -1;
      p.hidden = !match;
      if (match) shown++;
    });
    years.forEach(function (y) {
      var list = y.nextElementSibling;
      var any = list && list.querySelector(".pub:not([hidden])");
      y.hidden = !any;
      if (list) list.hidden = !any;
    });
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === area));
    });
    if (count) count.textContent = shown === 1 ? "1 article" : shown + " articles";
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () { apply(b.getAttribute("data-filter")); });
  });
})();
