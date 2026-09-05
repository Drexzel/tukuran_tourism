// ========================================
// ===== SESSION / ROLE AUTH GUARD =====
// ========================================
// Included at the top of every Tourism Personnel and Beach Owner page.
// Confirms a user is actually logged in (via sessionStorage, set by
// Log-in page/log-in.js after a successful api/login.php call) and that
// they hold the role required for the section they're trying to open.
// If not, they're bounced back to the login page instead of being able
// to view a dashboard just by typing its URL.
//
// This does not change any UI/layout - it only redirects before the page
// renders when the session is missing or wrong for the section.
(function () {
  'use strict';

  function checkAuth() {
    var path = window.location.pathname.replace(/\\/g, '/');
    var role = sessionStorage.getItem('currentRole');

    var isAdminSection = path.indexOf('/Tourism Personnel/') !== -1;
    var isOwnerSection = path.indexOf('/Beach owner page/') !== -1;

    var requiredRole = isAdminSection ? 'admin' : (isOwnerSection ? 'owner' : null);

    if (requiredRole && role !== requiredRole) {
      window.location.replace('../Log-in page/login.html');
    }
  }

  // Runs immediately on every normal load/navigation to this page.
  checkAuth();

  // Also re-check when the page is restored from the browser's
  // back/forward cache instead of a fresh load - e.g. logging out, then
  // pressing the Back button. Some browsers restore that snapshot straight
  // from memory without re-running this script, which would otherwise let
  // a logged-out user briefly see the page again. `pageshow` with
  // `event.persisted` tells us exactly when that's happening, so we can
  // send them back to the login page instead.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      checkAuth();
    }
  });
})();
