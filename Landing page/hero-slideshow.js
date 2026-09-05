/* ============================================================
   HERO SLIDESHOW
   ------------------------------------------------------------
   Cross-fades the full-screen hero photos of Tukuran and builds
   the matching indicator dots. Entirely self-contained and
   additive — it only touches the .hero-slideshow markup and
   never interferes with the existing beach.js behaviour.
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var show = document.querySelector('.hero-slideshow');
    if (!show) return;

    var slides = Array.prototype.slice.call(show.querySelectorAll('.hero-slide'));
    if (slides.length <= 1) return;

    var dotsWrap = document.querySelector('.hero-dots');
    var current = 0;
    var timer = null;
    var INTERVAL = 5000; // 5s per slide (within the 4–6s range)

    // Build one indicator dot per slide.
    var dots = [];
    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var dot = document.createElement('button');
        dot.className = 'hero-dot' + (i === 0 ? ' is-active' : '');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Show hero photo ' + (i + 1));
        dot.addEventListener('click', function () {
          goTo(i);
          restart();
        });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
    }

    function goTo(index) {
      slides[current].classList.remove('is-active');
      if (dots[current]) dots[current].classList.remove('is-active');
      current = (index + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      if (dots[current]) dots[current].classList.add('is-active');
    }

    function next() {
      goTo(current + 1);
    }

    function start() {
      timer = window.setInterval(next, INTERVAL);
    }

    function restart() {
      if (timer) window.clearInterval(timer);
      start();
    }

    // Pause rotation while the tab is hidden, resume on return.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (timer) window.clearInterval(timer);
      } else {
        restart();
      }
    });

    start();
  });
})();
