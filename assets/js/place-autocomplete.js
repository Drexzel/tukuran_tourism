/**
 * place-autocomplete.js
 * ---------------------------------------------------------------
 * Lightweight, dependency-free "Place of Origin" autocomplete.
 *
 * Attaches a live location-suggestion dropdown to any existing text
 * <input>. It is purely a UI enhancement:
 *   - It does NOT change the input's id, name, or value format.
 *   - It does NOT touch form validation/submit logic already wired
 *     to that input elsewhere (script.js, reservation-form.js, etc.)
 *     - it just fires normal 'input'/'change' events on selection so
 *     existing listeners keep working unmodified.
 *   - If a real place is picked from the list, the input is filled
 *     with a clean "City, Province, Country" style label built from
 *     real geocoding data (no hardcoded location list).
 *   - Users can still type a place freely and ignore the dropdown;
 *     existing required/validation rules are unaffected.
 *
 * Data source: OpenStreetMap Nominatim (https://nominatim.org),
 * a free public geocoding API - no API key, no dummy/sample data.
 * Usage is kept light (debounced, 3+ characters, 6 results max) to
 * stay within Nominatim's fair-use limits. For high-traffic
 * production use, proxy these requests through the existing PHP
 * backend with a proper identifying User-Agent instead of calling
 * Nominatim directly from the browser.
 */
(function () {
  'use strict';

  var NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  var DEBOUNCE_MS = 350;
  var MIN_CHARS = 3;
  var MAX_RESULTS = 6;

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  // Build a concise, human-friendly label from a Nominatim result's
  // address parts (falls back to its full display_name if needed).
  function formatSuggestion(place) {
    var a = place.address || {};
    var parts = [];
    var locality = a.city || a.town || a.municipality || a.village || a.county || a.suburb;
    if (locality) parts.push(locality);
    var region = a.state || a.province || a.region;
    if (region && region !== locality) parts.push(region);
    if (a.country) parts.push(a.country);
    return parts.length ? parts.join(', ') : place.display_name;
  }

  function attachPlaceAutocomplete(input) {
    if (!input || input.dataset.placeAutocompleteBound === '1') return;
    input.dataset.placeAutocompleteBound = '1';
    input.setAttribute('autocomplete', 'off');

    var container = input.closest('.input-group') || input.parentElement;
    if (container && window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    var list = document.createElement('ul');
    list.className = 'place-suggest-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    container.appendChild(list);

    var items = [];
    var activeIndex = -1;
    var controller = null;

    function closeList() {
      list.hidden = true;
      list.innerHTML = '';
      items = [];
      activeIndex = -1;
    }

    function highlight(idx) {
      var children = list.children;
      for (var i = 0; i < children.length; i++) {
        children[i].classList.toggle('is-active', i === idx);
      }
      if (children[idx]) children[idx].scrollIntoView({ block: 'nearest' });
    }

    function selectItem(idx) {
      var place = items[idx];
      if (!place) return;
      input.value = formatSuggestion(place);
      closeList();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function renderList(places) {
      list.innerHTML = '';
      items = places;
      if (!places.length) { closeList(); return; }
      places.forEach(function (place, idx) {
        var li = document.createElement('li');
        li.className = 'place-suggest-item';
        li.setAttribute('role', 'option');
        li.textContent = formatSuggestion(place);
        li.addEventListener('mousedown', function (e) {
          e.preventDefault(); // fire before input's blur closes the list
          selectItem(idx);
        });
        list.appendChild(li);
      });
      list.hidden = false;
      activeIndex = -1;
    }

    var doSearch = debounce(function (query) {
      if (controller) controller.abort();
      controller = new AbortController();
      var url = NOMINATIM_URL + '?format=json&addressdetails=1&limit=' + MAX_RESULTS +
        '&q=' + encodeURIComponent(query);
      fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } })
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (data) {
          if (input.value.trim() !== query) return; // stale response, ignore
          renderList(Array.isArray(data) ? data : []);
        })
        .catch(function () { /* offline/network hiccup - user can still type freely */ });
    }, DEBOUNCE_MS);

    input.addEventListener('input', function () {
      var query = input.value.trim();
      if (query.length < MIN_CHARS) { closeList(); return; }
      doSearch(query);
    });

    input.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      var count = items.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % count;
        highlight(activeIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + count) % count;
        highlight(activeIndex);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          selectItem(activeIndex);
        } else {
          closeList();
        }
      } else if (e.key === 'Escape') {
        closeList();
      }
    });

    input.addEventListener('blur', function () {
      setTimeout(closeList, 100); // let a mousedown selection register first
    });

    document.addEventListener('click', function (e) {
      if (!container.contains(e.target)) closeList();
    });
  }

  window.attachPlaceAutocomplete = attachPlaceAutocomplete;
})();
