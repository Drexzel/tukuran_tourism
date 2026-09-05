// ========================================
// ===== BEACH OWNER SESSION HELPER =====
// ========================================
// Included (after auth-guard.js) on every page under "Beach owner page/".
// auth-guard.js already confirms *someone* with role "owner" is logged in;
// this file reads *which* beach that owner is assigned to (beach_id, set
// by the Tourism Personnel in Manage Beach Owners) so every module -
// Dashboard, Reservations, Walk-in Guests, Capacity Monitoring, Incident
// Alert - only ever shows/affects that one beach.

window.BeachOwnerSession = (function () {
  'use strict';

  function getOwner() {
    try {
      var raw = sessionStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getBeachId() {
  var owner = getOwner();
  // Check for beach_id in multiple possible locations
  if (owner) {
    if (owner.beach_id) return owner.beach_id;
    // Some setups might store it in data.beach_id
    if (owner.data && owner.data.beach_id) return owner.data.beach_id;
    // Or directly in the owner object under a different name
    if (owner.beachId) return owner.beachId;
  }
  return null;
}
  // Fills in the sidebar's beach name placeholder (and the dashboard
  // banner's <span id="beachName">, if present) with the owner's actual
  // linked beach - same markup/styling, just real data instead of the
  // "Baguio Beach" placeholder that shipped in every page.
  function applyBeachNameToUI(beachName) {
    if (!beachName) return;
    var sidebarName = document.querySelector('.sidebar-beach-name h2');
    if (sidebarName) sidebarName.textContent = beachName;
    var bannerName = document.getElementById('beachName');
    if (bannerName) bannerName.textContent = beachName;
  }

  // Shows a friendly inline notice (reusing the existing empty-state /
  // alert-success visual language already in the CSS) when this owner
  // account has not been linked to a beach yet, and returns true so the
  // calling page can skip its normal data-loading/submit logic.
  function blockIfNoBeachAssigned(containerSelector) {
    var beachId = getBeachId();
    if (beachId) return false;

    var container = document.querySelector(containerSelector);
    if (container) {
      container.innerHTML =
        '<div class="glass" style="padding:30px; border-radius:16px; text-align:center; color:#5a7a8a;">' +
        '<i class="fas fa-info-circle" style="font-size:1.8rem; color:#f59e0b; display:block; margin-bottom:10px;"></i>' +
        'Your account is not linked to a beach yet. Please contact the Tourism Office so they can assign one to your account in Manage Beach Owners.' +
        '</div>';
    }
    return true;
  }

  return {
    getOwner: getOwner,
    getBeachId: getBeachId,
    applyBeachNameToUI: applyBeachNameToUI,
    blockIfNoBeachAssigned: blockIfNoBeachAssigned
  };
})();
