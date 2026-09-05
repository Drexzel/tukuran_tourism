// ============================================================
// ABOUT TUKURAN — NAVIGATION DROPDOWN
// ------------------------------------------------------------
// Self-contained behaviour for the "About Tukuran" nav dropdown. It only
// touches elements inside .nav-dropdown, so it never interferes with the
// existing navbar / mobile-toggle / smooth-scroll handlers already on each
// page. Desktop opens on hover (CSS); click works on every device (needed for
// touch), which is what this script wires up.
// ============================================================
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var dropdowns = document.querySelectorAll('.nav-dropdown');
    if (!dropdowns.length) return;

    function closeAll(except) {
      dropdowns.forEach(function (d) {
        if (d === except) return;
        d.classList.remove('open');
        var t = d.querySelector('.nav-dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }

    dropdowns.forEach(function (dropdown) {
      var toggle = dropdown.querySelector('.nav-dropdown-toggle');
      if (!toggle) return;

      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = dropdown.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        closeAll(dropdown);
      });
    });

    // Close when clicking anywhere outside an open dropdown
    document.addEventListener('click', function (e) {
      dropdowns.forEach(function (dropdown) {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('open');
          var t = dropdown.querySelector('.nav-dropdown-toggle');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll(null);
    });
  });
})();
