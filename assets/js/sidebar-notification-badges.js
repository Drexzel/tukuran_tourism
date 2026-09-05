// ========================================
// ===== SIDEBAR NOTIFICATION BADGES (TOURISM PERSONNEL) =====
// ========================================
// Shows a small pending-count badge on the "Incident Report" and
// "Update Requests" sidebar links, so Tourism Personnel can see at a
// glance whether there's anything new to review without opening each
// module first.
//
// Additive + read-only: it does NOT touch the existing sidebar markup,
// routing, database, or any other page logic. It only reads the counts
// via the existing GET endpoints (api/incidents.php, api/update-requests.php)
// and injects a small badge span next to the link text. Counting is based
// on live "Pending" rows, so as soon as Tourism Personnel processes an
// incident (Investigating/Resolved/Closed) or a request (Approved/Rejected),
// the badge count reflects that on the next refresh - no separate "seen"
// state to keep in sync.
//
// Include this script (after style.js) on every Tourism Personnel page
// that has the shared sidebar.

(function () {
  'use strict';

  var API_BASE = '../api/';
  var POLL_INTERVAL = 20000; // ms

  var TARGETS = [
    { href: 'incident-report.html', endpoint: 'incidents.php?status=Pending' },
    { href: 'update-requests.html', endpoint: 'update-requests.php?status=Pending' }
  ];

  function getLink(href) {
    return document.querySelector('.sidebar-nav a.sidebar-link[href="' + href + '"]');
  }

  function ensureBadge(link) {
    var badge = link.querySelector('.sidebar-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'sidebar-badge';
      badge.setAttribute('aria-label', 'pending items');
      link.appendChild(badge);
    }
    return badge;
  }

  function setCount(link, count) {
    var badge = ensureBadge(link);
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  }

  function refreshOne(target) {
    var link = getLink(target.href);
    if (!link) return; // this page's sidebar doesn't have that link

    fetch(API_BASE + target.endpoint)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success && Array.isArray(data.data)) {
          setCount(link, data.data.length);
        }
      })
      .catch(function (err) {
        // Backend unreachable - leave the last known state, retry next poll.
        console.warn('Sidebar badge refresh failed for', target.href, err);
      });
  }

  function refreshAll() {
    TARGETS.forEach(refreshOne);
  }

  function init() {
    if (!document.querySelector('.sidebar-nav')) return;
    refreshAll();
    setInterval(refreshAll, POLL_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
