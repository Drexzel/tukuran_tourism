// ========================================
// ===== BEACH OWNER SHARED MODULE =====
// ========================================
// Loaded on Dashboard (which now includes the integrated Capacity
// Monitoring section), Reservations (alongside reservation-script.js),
// and Walk-in Guests. Each section below only runs if its page's
// specific elements are present, same pattern the app already uses in
// style.js.

const OWNER_API_BASE = '../api/';

function getAssignedBeachId() {
  return window.BeachOwnerSession ? window.BeachOwnerSession.getBeachId() : null;
}

function getOwnerSession() {
  return window.BeachOwnerSession ? window.BeachOwnerSession.getOwner() : null;
}

async function ownerApiGet(endpoint) {
  const res = await fetch(OWNER_API_BASE + endpoint);
  return res.json();
}

async function ownerApiPost(endpoint, body) {
  const res = await fetch(OWNER_API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const beachId = getAssignedBeachId();

  // ========================================
  // ===== BEACH OWNER DASHBOARD =====
  // ========================================
  // Also covers the standalone Capacity Monitoring page (same live stats,
  // identified by its own #currentVisitors card since it has no
  // #todayVisitors element).
  const todayVisitorsEl = document.getElementById('todayVisitors');
  const capacityPageEl = document.getElementById('currentVisitors');
  if (todayVisitorsEl || capacityPageEl) {
    initOwnerDashboard(beachId);
  }

  // ========================================
  // ===== WALK-IN REGISTRATION =====
  // ========================================
  const walkinForm = document.getElementById('walkinForm');
  if (walkinForm) {
    initWalkinForm(beachId);
  }

  // ========================================
  // ===== LOGOUT (shared across pages) =====
  // ========================================
  // Skip this on Reservation Management - reservation-script.js already
  // wires up its own logout modal/handlers for that page, and both files
  // load together there.
  const isReservationManagementPage = !!document.getElementById('reservationsBody');

  if (!isReservationManagementPage) {
    document.querySelectorAll('.logout-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const modal = document.getElementById('logoutModal');
        if (modal) {
          modal.classList.add('active');
        } else if (confirm('Are you sure you want to logout?')) {
          sessionStorage.removeItem('currentUser');
          sessionStorage.removeItem('currentRole');
          window.location.href = '../Log-in page/login.html';
        }
      });
    });

    const cancelLogoutBtn = document.getElementById('cancelLogout');
    const confirmLogoutBtn = document.getElementById('confirmLogout');
    const logoutModal = document.getElementById('logoutModal');
    if (cancelLogoutBtn && logoutModal) {
      cancelLogoutBtn.addEventListener('click', function () {
        logoutModal.classList.remove('active');
      });
    }
    if (confirmLogoutBtn && logoutModal) {
      confirmLogoutBtn.addEventListener('click', function () {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentRole');
        window.location.href = '../Log-in page/login.html';
      });
    }
    if (logoutModal) {
      logoutModal.addEventListener('click', function (e) {
        if (e.target === logoutModal) logoutModal.classList.remove('active');
      });
    }
  }

  // ========================================
  // ===== MOBILE SIDEBAR TOGGLE =====
  // ========================================
  addSidebarToggle();

  console.log('🏖️ Beach Owner shared module ready');
});

function addSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (document.querySelector('.sidebar-toggle')) return;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'sidebar-toggle';
  toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
  toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
  toggleBtn.style.display = 'none';
  document.body.prepend(toggleBtn);

  toggleBtn.addEventListener('click', function () {
    sidebar.classList.toggle('open');
    const icon = toggleBtn.querySelector('i');
    icon.className = sidebar.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
  });

  document.addEventListener('click', function (e) {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('open');
        const icon = toggleBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      }
    }
  });

  function handleVisibility() {
    if (window.innerWidth <= 768) {
      toggleBtn.style.display = 'flex';
    } else {
      toggleBtn.style.display = 'none';
      sidebar.classList.remove('open');
    }
  }
  window.addEventListener('resize', handleVisibility);
  handleVisibility();
}

// ========================================
// ===== DASHBOARD LOGIC =====
// ========================================

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

async function refreshOwnerDashboard(beachId) {
  const result = await ownerApiGet('owner-dashboard-stats.php?beach_id=' + encodeURIComponent(beachId));
  if (!result.success || !result.data) return;

  const stats = result.data;
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('todayVisitors', formatNumber(stats.today_visitors));
  // Capacity Monitoring's own "Current Visitors" card (present only on
  // capacity-monitoring.html) shows the same live today's-visitors figure
  // as the Dashboard's "Today's Visitors" card, so the two never disagree.
  setText('currentVisitors', formatNumber(stats.today_visitors));
  setText('totalReservations', formatNumber(stats.total_reservations));
  setText('walkinGuests', formatNumber(stats.walkin_guests));
  setText('currentCapacity', stats.current_capacity_percent + '%');
  setText('pendingBookings', formatNumber(stats.pending_bookings));
  setText('remainingSlots', formatNumber(stats.remaining_slots));

  // Capacity Monitoring section (integrated into the Dashboard - see
  // renderCapacityMonitoring below). Uses the same live stats already
  // fetched above, so it always matches the cards and never drifts out
  // of sync with the database.
  renderCapacityMonitoring(stats);

  window.BeachOwnerSession && window.BeachOwnerSession.applyBeachNameToUI(stats.beach_name);

  const activityBody = document.querySelector('.dashboard-bookings .bookings-table tbody');
  if (activityBody) {
    if (!stats.recent_activity || stats.recent_activity.length === 0) {
      activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No activity recorded yet today.</td></tr>';
    } else {
      activityBody.innerHTML = stats.recent_activity.map(a => `
        <tr>
          <td>${timeAgo(a.created_at)}</td>
          <td>${a.type}</td>
          <td>${a.guest_name || 'Guest'}</td>
          <td><span class="status ${
            a.status === 'Confirmed' || a.status === 'Checked In' ? 'confirmed'
              : a.status === 'Completed' ? 'completed'
              : a.status === 'Cancelled' || a.status === 'Expired' ? 'cancelled'
              : 'pending'
          }">${a.status === 'Confirmed' ? 'Approved' : a.status}</span></td>
        </tr>
      `).join('');
    }
  }
}

function initOwnerDashboard(beachId) {
  if (!beachId) {
    window.BeachOwnerSession && window.BeachOwnerSession.blockIfNoBeachAssigned('.container');
    return;
  }
  refreshOwnerDashboard(beachId);
  setInterval(function () { refreshOwnerDashboard(beachId); }, 30000);
}

// ========================================
// ===== CAPACITY MONITORING LOGIC =====
// ========================================
// Previously its own standalone page (with its own fetch, on its own
// 30s interval). Now folded into the Dashboard: same status/progress-bar
// as before, just driven by the stats payload refreshOwnerDashboard
// already fetches, instead of a second API call.

function renderCapacityMonitoring(stats) {
  // Guard: only run this on pages that actually have the Capacity
  // Monitoring markup (currently just the Dashboard).
  if (!document.getElementById('maxCapacity')) return;

  const maxCapacity = parseInt(stats.max_capacity) || 0;
  const percent = parseInt(stats.current_capacity_percent) || 0;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('maxCapacity', formatNumber(maxCapacity));
  setText('progressPercentage', percent + '%');

  const statusEl = document.getElementById('currentStatus');
  if (statusEl) {
    let label = 'Available';
    if (percent >= 100) label = 'Full';
    else if (percent >= 85) label = 'Near Capacity';
    statusEl.textContent = label;
  }

  const fillEl = document.getElementById('progressFill');
  if (fillEl) {
    fillEl.style.width = percent + '%';
    fillEl.style.background = percent >= 85
      ? 'linear-gradient(90deg, #e74c5e, #c0392b)'
      : (percent >= 60 ? 'linear-gradient(90deg, #f59e0b, #ffc107)' : 'linear-gradient(90deg, #2b8a9e, #1a6b7a)');
  }

  renderAccommodationCards(stats.accommodations || []);
}

// Builds one card per accommodation type this beach actually has
// configured in Beach Management - not a fixed Cottage/Room/Picnic
// Table/Tent list, so a newly added type (e.g. "Gazebo") appears here
// automatically. available_units/reserved_units/occupied_units come
// straight from the database (today's Confirmed reservations + today's
// walk-ins), computed by getBeachAccommodationAvailability() on the
// server - never a stored or hardcoded number.
function renderAccommodationCards(accommodations) {
  const grid = document.getElementById('accommodationGrid');
  if (!grid) return;

  if (!accommodations.length) {
    grid.innerHTML = '<div class="accommodation-card glass"><div class="accommodation-info">' +
      '<p style="color:#5a7a8a;">No accommodations configured for this beach yet.</p></div></div>';
    return;
  }

  grid.innerHTML = accommodations.map(function (acc) {
    const total = formatNumber(acc.total_units);
    const available = formatNumber(acc.available_units);
    const reserved = parseInt(acc.reserved_units, 10) || 0;
    const occupied = parseInt(acc.occupied_units, 10) || 0;
    const breakdown = (reserved > 0 || occupied > 0)
      ? '<p class="accommodation-breakdown">' + reserved + ' reserved · ' + occupied + ' occupied today</p>'
      : '';
    return '<div class="accommodation-card glass"><div class="accommodation-info">' +
      '<h4>' + escapeHtmlText(acc.type_name) + ' Available</h4>' +
      '<p><span>' + available + '</span> / <span>' + total + '</span></p>' +
      breakdown +
      '</div></div>';
  }).join('');
}

function escapeHtmlText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ========================================
// ===== WALK-IN REGISTRATION LOGIC =====
// ========================================

async function loadAssignedBeachForWalkin(beachId) {
  const input = document.getElementById('walkinBeach');
  if (!beachId) {
    if (input) input.value = 'No beach assigned';
    populateWalkinAccommodationOptions([]);
    return null;
  }
  try {
    const result = await ownerApiGet('get-beaches.php?id=' + encodeURIComponent(beachId) + '&all=1');
    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
      const beach = result.data[0];
      if (input) input.value = beach.beach_name;
      window.BeachOwnerSession && window.BeachOwnerSession.applyBeachNameToUI(beach.beach_name);
      // Accommodation Type options - and, once a type is picked, its actual
      // available unit numbers - are driven entirely by this beach's own
      // accommodations, as configured by Tourism Personnel in Beach
      // Management (Amenities & Accommodations step) and kept live by
      // getBeachAccommodationAvailability() on the server (same figures the
      // Reservation Form and Beach Operator Dashboard show). No hardcoded
      // list - whatever is added, renamed, or removed there shows up here
      // the next time this form loads the beach's data.
      populateWalkinAccommodationOptions(beach.accommodations || []);
      return beach;
    }
  } catch (error) {
    console.error('Error loading assigned beach for walk-in form:', error);
  }
  if (input) input.value = 'Could not load beach';
  populateWalkinAccommodationOptions([]);
  return null;
}

// ===== WALK-IN ACCOMMODATION SELECTION STATE =====
// Mirrors the Reservation Form's accommodationState (Landing
// page/reservation-form.js): the chosen type's name/price, how many units
// are currently bookable vs. total, the unit numbers the operator tapped
// (multi-select) and the auto-derived quantity/total. Selecting units is
// the only way to set quantity - there is no separate manual input.
const walkinAccommodationState = {
  hasDetail: false,
  name: '',
  price: 0,
  availableUnits: 0,
  totalUnits: 0,
  units: [],
  takenUnits: [], // exact unit numbers already reserved/occupied for this type/date - see taken_units from get-beaches.php
  qty: 0,
  total: 0
};

// Accommodations for the assigned beach, keyed by the <select> option
// value ("acc_0", "acc_1", ...), filled by populateWalkinAccommodationOptions.
let walkinAccommodationsByValue = {};

function formatPesoWalkin(amount) {
  const n = parseFloat(amount) || 0;
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function resetWalkinAccommodationState() {
  walkinAccommodationState.hasDetail = false;
  walkinAccommodationState.name = '';
  walkinAccommodationState.price = 0;
  walkinAccommodationState.availableUnits = 0;
  walkinAccommodationState.totalUnits = 0;
  walkinAccommodationState.units = [];
  walkinAccommodationState.takenUnits = [];
  walkinAccommodationState.qty = 0;
  walkinAccommodationState.total = 0;
}

// Builds the same concise descriptor the Reservation Form writes into
// accommodation_type, e.g. "Cottage – Units 1, 3 ×2 – ₱3,000", so both
// modules' availability math (getBeachAccommodationAvailability on the
// server) reads walk-ins and reservations the same way. Falls back to the
// plain selected label when the beach has no priced accommodations.
function getWalkinAccommodationDescriptor() {
  const select = document.getElementById('walkinAccommodation');
  if (!select || !select.value) return '';

  if (walkinAccommodationState.hasDetail) {
    let text = walkinAccommodationState.name;
    if (walkinAccommodationState.units && walkinAccommodationState.units.length > 0) {
      const label = walkinAccommodationState.units.length === 1 ? 'Unit' : 'Units';
      text += ' – ' + label + ' ' + walkinAccommodationState.units.slice().sort(function (a, b) { return a - b; }).join(', ');
    }
    text += ' ×' + walkinAccommodationState.qty;
    if (walkinAccommodationState.price > 0) text += ' – ' + formatPesoWalkin(walkinAccommodationState.total);
    return text.slice(0, 100);
  }

  const opt = select.options[select.selectedIndex];
  return (opt ? opt.textContent.trim() : select.value).slice(0, 100);
}

// Quantity is always derived from how many unit numbers are selected -
// tapping Cottage 1 and Cottage 3 automatically sets Quantity = 2.
function updateWalkinAccommodationTotal() {
  const accQtyInput = document.getElementById('walkinAccQty');
  const accTotalValue = document.getElementById('walkinAccTotalValue');
  const accSelectedUnits = document.getElementById('walkinAccSelectedUnits');

  walkinAccommodationState.qty = walkinAccommodationState.units.length;
  walkinAccommodationState.total = (parseFloat(walkinAccommodationState.price) || 0) * walkinAccommodationState.qty;
  if (accTotalValue) accTotalValue.textContent = formatPesoWalkin(walkinAccommodationState.total);
  if (accQtyInput) accQtyInput.value = walkinAccommodationState.qty;

  if (accSelectedUnits) {
    if (walkinAccommodationState.units.length > 0) {
      const sorted = walkinAccommodationState.units.slice().sort(function (a, b) { return a - b; });
      accSelectedUnits.textContent = 'Selected: ' + sorted.map(function (u) { return 'Unit ' + u; }).join(', ');
    } else {
      accSelectedUnits.textContent = 'No unit selected yet';
    }
  }

  if (walkinAccommodationState.units.length > 0) {
    document.getElementById('walkinUnitError')?.classList.remove('visible');
  }
}

// Toggles a unit chip on/off: tapping an unselected, available unit
// selects it (highlighted); tapping an already-selected unit deselects it.
// Unavailable (already reserved/occupied) units can't be clicked at all.
function toggleWalkinUnit(unitNumber, chip) {
  const idx = walkinAccommodationState.units.indexOf(unitNumber);
  if (idx === -1) {
    walkinAccommodationState.units.push(unitNumber);
    if (chip) chip.classList.add('is-selected');
  } else {
    walkinAccommodationState.units.splice(idx, 1);
    if (chip) chip.classList.remove('is-selected');
  }
  updateWalkinAccommodationTotal();
}

// Renders one chip per physical unit (available + already reserved/
// occupied) so the operator can see which numbers exist and which are
// taken, exactly like the Reservation Form's unit grid.
function renderWalkinUnitChips() {
  const accUnitBlock = document.getElementById('walkinAccUnitBlock');
  const accUnitGrid = document.getElementById('walkinAccUnitGrid');
  if (!accUnitGrid) return;
  accUnitGrid.innerHTML = '';

  const available = walkinAccommodationState.availableUnits;
  const takenUnits = walkinAccommodationState.takenUnits || [];
  const gridSize = walkinAccommodationState.totalUnits > 0 ? walkinAccommodationState.totalUnits : available;
  if (!gridSize || gridSize < 1) {
    if (accUnitBlock) accUnitBlock.style.display = 'none';
    walkinAccommodationState.units = [];
    return;
  }
  if (accUnitBlock) accUnitBlock.style.display = 'block';

  for (let i = 1; i <= gridSize; i++) {
    // A unit is unavailable when it's one of the EXACT numbers already
    // reserved/occupied (e.g. Unit 2 specifically) - not just "beyond the
    // Nth position" - so the correct real unit always shows taken.
    const isAvailable = takenUnits.indexOf(i) === -1;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'accommodation-unit-chip';
    chip.textContent = i;
    chip.dataset.unit = i;

    if (!isAvailable) {
      chip.classList.add('is-unavailable');
      chip.disabled = true;
      chip.title = 'This unit is already reserved / occupied';
      accUnitGrid.appendChild(chip);
      continue;
    }

    if (walkinAccommodationState.units.indexOf(i) !== -1) chip.classList.add('is-selected');
    chip.addEventListener('click', function () {
      toggleWalkinUnit(parseInt(this.dataset.unit, 10), chip);
    });
    accUnitGrid.appendChild(chip);
  }
}

function onWalkinAccommodationChange() {
  const select = document.getElementById('walkinAccommodation');
  const accDetail = document.getElementById('walkinAccommodationDetail');
  const value = select ? select.value : '';

  document.getElementById('walkinUnitError')?.classList.remove('visible');

  const info = walkinAccommodationsByValue[value];
  if (!value || !info) {
    resetWalkinAccommodationState();
    if (accDetail) accDetail.style.display = 'none';
    return;
  }

  resetWalkinAccommodationState();
  walkinAccommodationState.hasDetail = true;
  walkinAccommodationState.name = info.name;
  walkinAccommodationState.price = info.price;
  walkinAccommodationState.availableUnits = info.availableUnits;
  walkinAccommodationState.totalUnits = info.totalUnits;
  walkinAccommodationState.takenUnits = info.takenUnits || [];
  walkinAccommodationState.units = [];

  const accDetailName = document.getElementById('walkinAccDetailName');
  const accDetailPrice = document.getElementById('walkinAccDetailPrice');
  const accDetailUnits = document.getElementById('walkinAccDetailUnits');
  if (accDetailName) accDetailName.textContent = info.name;
  if (accDetailPrice) {
    accDetailPrice.textContent = info.price > 0 ? (formatPesoWalkin(info.price) + ' / unit') : 'Rate not set';
  }
  if (accDetailUnits) accDetailUnits.textContent = info.availableUnits;

  renderWalkinUnitChips();
  updateWalkinAccommodationTotal();
  if (accDetail) accDetail.style.display = 'block';
}

// Rebuilds the Accommodation Type <select> options from the beach's own
// `accommodations` list (each row: { type_name, total_units,
// available_units, price_per_unit }), as returned by get-beaches.php - the
// same live data and the same option-value scheme ("acc_0", "acc_1", ...)
// the Reservation Form uses, so choosing a type reveals its real unit
// numbers instead of just a name.
function populateWalkinAccommodationOptions(accommodations) {
  const select = document.getElementById('walkinAccommodation');
  if (!select) return;

  const list = (Array.isArray(accommodations) ? accommodations : []).filter(function (acc) {
    return acc && (acc.type_name || acc.name);
  });

  const previousName = walkinAccommodationState.hasDetail ? walkinAccommodationState.name : null;

  walkinAccommodationsByValue = {};
  let optionsHtml = '<option value="">Select accommodation</option>';
  let previousValue = '';

  list.forEach(function (acc, idx) {
    const typeName = acc.type_name || acc.name || '';
    const value = 'acc_' + idx;
    const price = parseFloat(acc.price_per_unit) || 0;
    const total = parseInt(acc.total_units, 10) || 0;
    const available = (acc.available_units != null && acc.available_units !== '')
      ? parseInt(acc.available_units, 10)
      : total;

    walkinAccommodationsByValue[value] = {
      name: typeName,
      price: price,
      availableUnits: isNaN(available) ? 0 : available,
      totalUnits: isNaN(total) ? 0 : total,
      // Exact unit numbers already reserved/occupied for this type (see
      // taken_units from getBeachAccommodationAvailability()) - used by
      // renderWalkinUnitChips() to grey out the real numbers taken.
      takenUnits: Array.isArray(acc.taken_units) ? acc.taken_units.slice() : []
    };

    if (previousName && typeName === previousName) previousValue = value;

    // Each option shows how many units are actually free right now (the
    // same live figure - Total minus today's Confirmed reservations and
    // walk-ins - shown on the Reservation Form and the Dashboard's
    // Accommodation Availability cards). A type with none left is still
    // listed, but disabled, so the operator can see it's fully booked
    // instead of it silently disappearing.
    const available2 = walkinAccommodationsByValue[value].availableUnits;
    const label = escapeHtmlAttr(typeName) + ' (' + available2 + ' available)';
    const disabled = available2 === 0 ? ' disabled' : '';
    optionsHtml += '<option value="' + value + '"' + disabled + '>' + label + '</option>';
  });
  select.innerHTML = optionsHtml;

  // Keep whatever type the operator had picked, if it's still offered -
  // this also re-syncs available unit counts after a save.
  if (previousValue) {
    select.value = previousValue;
    onWalkinAccommodationChange();
  } else {
    resetWalkinAccommodationState();
    const accDetail = document.getElementById('walkinAccommodationDetail');
    if (accDetail) accDetail.style.display = 'none';
  }

  const errorEl = document.getElementById('walkinAccommodationError');
  if (errorEl) errorEl.classList.toggle('visible', list.length === 0);

  if (!select.dataset.changeBound) {
    select.addEventListener('change', onWalkinAccommodationChange);
    select.dataset.changeBound = '1';
  }
}

function escapeHtmlAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ===== AGE BRACKET / GUEST BREAKDOWN (Walk-in) =====
// Same four age groups as the Reservation Form's Guest Breakdown by Age
// (Landing page/reservation-form.js) - Kids, Teen, Adult, Senior - so both
// forms collect identical demographic data.
const WALKIN_AGE_BRACKET_FIELDS = [
  { id: 'walkinKids',    key: 'age_kids' },
  { id: 'walkinTeens',   key: 'age_teens' },
  { id: 'walkinAdults',  key: 'age_adult' },
  { id: 'walkinSeniors', key: 'age_seniors' }
];

// Reads the four group inputs and returns BOTH the four visible groups and
// the six snake_case columns the database/walk-ins.php already expect, so
// nothing downstream changes. The single "Adult" group maps onto the same
// representative adult column the Reservation Form uses
// (age_adults_26_40); the other two adult columns stay 0. `total` is
// always the true sum of the four visible groups.
function readWalkinAgeBracketValues() {
  const groups = {};
  let total = 0;
  WALKIN_AGE_BRACKET_FIELDS.forEach(function (f) {
    const el = document.getElementById(f.id);
    let n = el ? parseInt(el.value, 10) : 0;
    if (isNaN(n) || n < 0) n = 0;
    groups[f.key] = n;
    total += n;
  });

  return {
    // four visible groups
    age_kids:    groups.age_kids,
    age_teens:   groups.age_teens,
    age_adult:   groups.age_adult,
    age_seniors: groups.age_seniors,
    // six database columns (Adult -> age_adults_26_40; other adult cols 0)
    age_adults_18_25: 0,
    age_adults_26_40: groups.age_adult,
    age_adults_41_59: 0,
    total: total
  };
}

// ===== GUEST TYPE (LOCAL / FOREIGN) =====
// Simple two-option classification, standardized with the Reservation Form.
// Reads the Guest Type select plus (when "Foreign" is chosen) the "Number
// of Foreign Guests" input, and derives both counts from the SAME Total
// Guests figure already produced by the age breakdown above - never a
// separate/duplicate count. Local is always (total - foreign), so
// local_visitors + foreign_visitors === total_visitors.
function readWalkinGuestTypeValues(total) {
  const typeEl = document.getElementById('walkinGuestType');
  const type = typeEl ? typeEl.value : 'local';
  const safeTotal = parseInt(total, 10) || 0;

  if (type === 'foreign') {
    const foreignEl = document.getElementById('walkinForeignCount');
    let foreign = foreignEl ? parseInt(foreignEl.value, 10) : 0;
    if (isNaN(foreign) || foreign < 0) foreign = 0;
    if (foreign > safeTotal) foreign = safeTotal;
    return { guestType: 'foreign', local: safeTotal - foreign, foreign: foreign };
  }

  return { guestType: 'local', local: safeTotal, foreign: 0 };
}

function initWalkinForm(beachId) {
  const walkinForm = document.getElementById('walkinForm');
  const successMessage = document.getElementById('walkinSuccess');

  loadAssignedBeachForWalkin(beachId);

  // ===== AGE BRACKET AUTO-TOTAL =====
  // Keeps the "Total Guests" total under the Guest Breakdown equal to the sum
  // of the four age brackets at all times (Kids/Teen/Adult/Senior, same as
  // the Reservation Form). This total is the single source of truth for
  // the guest count (the old separate "Total Number of Visitors" field
  // was redundant and has been removed).
  const walkinBracketTotalEl = document.getElementById('walkinBracketTotal');
  function recalcWalkinAgeBracketTotal() {
    const total = readWalkinAgeBracketValues().total;
    if (walkinBracketTotalEl) walkinBracketTotalEl.textContent = total;
    if (total > 0) {
      document.getElementById('walkinBracketError')?.classList.remove('visible');
    }
  }
  WALKIN_AGE_BRACKET_FIELDS.forEach(function (f) {
    const el = document.getElementById(f.id);
    if (el) {
      el.addEventListener('input', recalcWalkinAgeBracketTotal);
      el.addEventListener('blur', recalcWalkinAgeBracketTotal);
    }
  });
  recalcWalkinAgeBracketTotal();

  // ===== GUEST TYPE TOGGLE (Local / Foreign) =====
  // Shows the "Number of Foreign Guests" input only when Foreign is
  // selected; switching back to Local hides and clears it so no stale
  // foreign count lingers.
  const walkinGuestTypeSelect = document.getElementById('walkinGuestType');
  const walkinForeignCountBlock = document.getElementById('walkinForeignCountBlock');
  const walkinForeignCountInput = document.getElementById('walkinForeignCount');
  function onWalkinGuestTypeChange() {
    document.getElementById('walkinGuestTypeError')?.classList.remove('visible');
    if (walkinGuestTypeSelect && walkinGuestTypeSelect.value === 'foreign') {
      if (walkinForeignCountBlock) walkinForeignCountBlock.style.display = 'block';
    } else {
      if (walkinForeignCountBlock) walkinForeignCountBlock.style.display = 'none';
      if (walkinForeignCountInput) walkinForeignCountInput.value = '';
      document.getElementById('walkinForeignCountError')?.classList.remove('visible');
      if (walkinForeignCountInput) walkinForeignCountInput.classList.remove('error');
    }
  }
  if (walkinGuestTypeSelect) {
    walkinGuestTypeSelect.addEventListener('change', onWalkinGuestTypeChange);
  }
  onWalkinGuestTypeChange();

  if (!beachId) {
    document.getElementById('walkinBeachError')?.classList.add('visible');
    const submitBtn = walkinForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  walkinForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    let isValid = true;

    const age = document.getElementById('walkinAge');
    if (!age.value) {
      document.getElementById('ageError')?.classList.add('visible');
      isValid = false;
    } else {
      document.getElementById('ageError')?.classList.remove('visible');
    }

    // Guest count now comes straight from the age-bracket total (the single
    // source of truth). Require at least one guest across the brackets.
    const walkinTotalGuests = readWalkinAgeBracketValues().total;
    if (walkinTotalGuests < 1) {
      document.getElementById('walkinBracketError')?.classList.add('visible');
      isValid = false;
    } else {
      document.getElementById('walkinBracketError')?.classList.remove('visible');
    }

    const hometown = document.getElementById('walkinHometown');
    if (!hometown.value.trim()) {
      document.getElementById('hometownError')?.classList.add('visible');
      isValid = false;
    } else {
      document.getElementById('hometownError')?.classList.remove('visible');
    }

    // When this beach has priced accommodations with a live unit picker,
    // at least one unit number must be selected so Quantity
    // (units.length) is never 0 - mirrors the Reservation Form's rule.
    if (walkinAccommodationState.hasDetail && walkinAccommodationState.units.length === 0) {
      document.getElementById('walkinUnitError')?.classList.add('visible');
      isValid = false;
    } else {
      document.getElementById('walkinUnitError')?.classList.remove('visible');
    }

    // Guest Type (Local / Foreign) - "Foreign" requires a valid Number of
    // Foreign Guests, no greater than the Total Guests already entered in
    // the age breakdown above. Mirrors the Reservation Form's rule.
    if (walkinGuestTypeSelect && walkinGuestTypeSelect.value === 'foreign') {
      const foreignVal = walkinForeignCountInput ? walkinForeignCountInput.value : '';
      const foreignNum = parseInt(foreignVal, 10);
      if (foreignVal === '' || isNaN(foreignNum) || foreignNum < 0 || foreignNum > walkinTotalGuests) {
        document.getElementById('walkinForeignCountError')?.classList.add('visible');
        if (walkinForeignCountInput) walkinForeignCountInput.classList.add('error');
        isValid = false;
      } else {
        document.getElementById('walkinForeignCountError')?.classList.remove('visible');
        if (walkinForeignCountInput) walkinForeignCountInput.classList.remove('error');
      }
    }

    if (!isValid) return;

    const walkinBrackets = readWalkinAgeBracketValues();
    const walkinGuestTypeValues = readWalkinGuestTypeValues(walkinBrackets.total);
    const payload = {
      beach_id: beachId,
      guest_name: document.getElementById('walkinName').value.trim(),
      age: age.value,
      total_visitors: walkinBrackets.total,
      male_count: document.getElementById('walkinMale').value || 0,
      female_count: document.getElementById('walkinFemale').value || 0,
      // Age Bracket / Guest Breakdown counts (stored with the walk-in visit).
      age_kids: walkinBrackets.age_kids,
      age_teens: walkinBrackets.age_teens,
      age_adults_18_25: walkinBrackets.age_adults_18_25,
      age_adults_26_40: walkinBrackets.age_adults_26_40,
      age_adults_41_59: walkinBrackets.age_adults_41_59,
      age_seniors: walkinBrackets.age_seniors,
      origin: hometown.value.trim(),
      // Guest Type (Local / Foreign) - local_visitors + foreign_visitors
      // always equals total_visitors (Total Guests), so no duplicate count.
      local_visitors: walkinGuestTypeValues.local,
      foreign_visitors: walkinGuestTypeValues.foreign,
      // A concise descriptor (type + selected unit numbers + quantity),
      // built the same way the Reservation Form builds it, e.g.
      // "Cottage - Units 1, 3 x2 - ₱3,000". This is what the shared
      // availability calculation (getBeachAccommodationAvailability) reads
      // back out, so the selected unit(s) become Unavailable/Occupied
      // immediately for this form, the Reservation Form and the Beach
      // Operator Dashboard alike.
      accommodation_type: getWalkinAccommodationDescriptor(),
      visit_date: new Date().toISOString().slice(0, 10)
    };

    const submitBtn = walkinForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    try {
      const result = await ownerApiPost('walk-ins.php', payload);

      if (result.success) {
        walkinForm.reset();
        // Also clear the accommodation-unit selection state itself; a plain
        // form.reset() only clears the <select>, not the selected unit
        // numbers held in JS. loadAssignedBeachForWalkin() right after this
        // re-fetches the beach's accommodations, so the unit(s) just saved
        // immediately show as Unavailable/Occupied the next time an
        // accommodation type is picked.
        resetWalkinAccommodationState();
        const walkinAccDetailEl = document.getElementById('walkinAccommodationDetail');
        if (walkinAccDetailEl) walkinAccDetailEl.style.display = 'none';
        // A plain form.reset() already puts walkinGuestType back to its
        // first <option> (Local) and clears walkinForeignCount, but the
        // Foreign block's visibility is separate JS state - re-sync it.
        onWalkinGuestTypeChange();
        loadAssignedBeachForWalkin(beachId);
        walkinForm.style.display = 'none';
        if (successMessage) successMessage.style.display = 'block';
        setTimeout(() => {
          walkinForm.style.display = 'block';
          if (successMessage) successMessage.style.display = 'none';
        }, 3000);
      } else {
        alert('Could not save this registration: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving walk-in registration:', error);
      alert('Could not reach the server. Please check your connection and try again.');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });

  console.log('🏖️ Walk-in Registration page ready (scoped to assigned beach)');
}
