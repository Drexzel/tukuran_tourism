// ========================================
// ===== RESERVATION FORM FUNCTIONALITY =====
// ========================================

// The Reservation Form page lives one folder below the BEACH project root,
// same as Browse Beaches / Beach Details, so the api/ folder is reached
// the same way: "../api/".
const RESERVATION_API_BASE = '../api/';

function getReservationBeachId() {
  const urlParams = new URLSearchParams(window.location.search);
  // Try multiple parameter names to be safe
  const beachId = urlParams.get('beach') || urlParams.get('id') || urlParams.get('beach_id');
  
  // Log for debugging
  console.log('🔍 Extracted beach_id from URL:', beachId);
  
  // Validate that it's a number
  if (beachId && !isNaN(beachId) && parseInt(beachId) > 0) {
    return parseInt(beachId);
  }
  
  return null;
}

// ===== AGE BRACKET / GUEST BREAKDOWN =====
// The lead guest enters how many guests fall in four simple age groups -
// Kids, Teen, Adult and Senior - instead of each guest's exact age. These
// are the only inputs shown on the form; their auto-total is submitted as
// num_visitors.
const AGE_BRACKET_FIELDS = [
  { id: 'ageKids',    key: 'age_kids' },
  { id: 'ageTeens',   key: 'age_teens' },
  { id: 'ageAdults',  key: 'age_adult' },
  { id: 'ageSeniors', key: 'age_seniors' }
];

// Reads the four group inputs and returns BOTH the four visible groups and
// the six snake_case columns the database/reservations.php already expect,
// so nothing downstream changes. The single "Adult" group maps onto the
// representative adult column (age_adults_26_40); the other two adult
// columns stay 0, and the total (num_visitors) is always the true sum.
function readAgeBracketValues() {
  const groups = {};
  let total = 0;
  AGE_BRACKET_FIELDS.forEach(function (f) {
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
// Simple two-option classification, standardized across the Reservation
// Form and the Walk-in Guest Form. Reads the Guest Type select plus (when
// "Foreign" is chosen) the "Number of Foreign Guests" input, and derives
// both counts from the SAME Total Guests figure already produced by the
// age breakdown - never a separate/duplicate count. Local is always
// (total - foreign), so local_visitors + foreign_visitors === num_visitors.
function readGuestTypeValues(total) {
  const typeEl = document.getElementById('guestType');
  const type = typeEl ? typeEl.value : 'local';
  const safeTotal = parseInt(total, 10) || 0;

  if (type === 'foreign') {
    const foreignEl = document.getElementById('foreignCount');
    let foreign = foreignEl ? parseInt(foreignEl.value, 10) : 0;
    if (isNaN(foreign) || foreign < 0) foreign = 0;
    if (foreign > safeTotal) foreign = safeTotal;
    return { guestType: 'foreign', local: safeTotal - foreign, foreign: foreign };
  }

  return { guestType: 'local', local: safeTotal, foreign: 0 };
}

// ===== ACCOMMODATION SELECTION STATE =====
// Holds the accommodation the guest picked on the form: the type name, its
// price per unit, the set of unit numbers the guest selected (multi-select),
// the auto-derived quantity (= number of selected units) and the running
// total (quantity x price). `hasDetail` is true only when the beach
// published priced accommodations (so the unit/price panel is shown);
// otherwise the plain type dropdown is used and only the type name is kept.
const accommodationState = {
  hasDetail: false,
  name: '',
  price: 0,
  availableUnits: 0, // how many units are currently bookable (selectable)
  totalUnits: 0,      // total units the beach has for this type (may exceed availableUnits)
  units: [],          // selected unit numbers, e.g. [1, 3, 5]
  takenUnits: [],     // exact unit numbers already reserved/occupied for this type/date - see taken_units from get-beaches.php
  qty: 0,              // always units.length - kept for backward compatibility
  total: 0
};

// Formats a peso amount the same way the rest of the form does.
function formatPeso(amount) {
  const n = parseFloat(amount) || 0;
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Builds the concise, human-readable accommodation descriptor stored in the
// existing accommodation_type field, e.g. "Cottage – Units 1, 3, 5 ×3 –
// ₱3,000". Kept short so it fits accommodation_type's VARCHAR(100). Falls
// back to the selected dropdown label when the beach has no priced
// accommodations. This single string is what flows unchanged into the
// Tourist, Beach Operator, Tourism Personnel, payment, reservation and
// reporting modules, so the selected unit numbers are visible everywhere
// the accommodation type already appears.
function getAccommodationDescriptor() {
  const select = document.getElementById('accommodationType');
  if (!select || !select.value) return 'none';

  if (accommodationState.hasDetail) {
    let text = accommodationState.name;
    if (accommodationState.units && accommodationState.units.length > 0) {
      const label = accommodationState.units.length === 1 ? 'Unit' : 'Units';
      text += ' – ' + label + ' ' + accommodationState.units.slice().sort(function (a, b) { return a - b; }).join(', ');
    }
    text += ' ×' + accommodationState.qty;
    if (accommodationState.price > 0) text += ' – ' + formatPeso(accommodationState.total);
    return text.slice(0, 100);
  }

  // Fallback: no priced accommodations for this beach - store the label.
  const opt = select.options[select.selectedIndex];
  return (opt ? opt.textContent.trim() : select.value).slice(0, 100);
}

async function submitReservationToDatabase(data) {
  const beachId = getReservationBeachId();
  
  // CRITICAL FIX: Validate beach_id before submitting
  if (!beachId) {
    console.error('❌ No valid beach id found in the URL (expected ?beach=<id>); reservation was not saved.');
    window.lastReservationError = 'We could not tell which beach this reservation is for (missing beach link). '
      + 'Please go back to the beach\'s page and click "Reserve Now" again instead of using this link directly.';
    return null;
  }

  // Log what we're sending
  console.log('📤 Submitting reservation with beach_id:', beachId);

  try {
    // Sent as multipart/form-data (not JSON) so the Proof of Payment file
    // can be uploaded in the same request. The browser sets the correct
    // Content-Type/boundary automatically, so we do NOT set it manually.
    const payload = new FormData();
    payload.append('beach_id', beachId); // ✅ valid integer
    payload.append('full_name', data.fullName);
    payload.append('contact_number', data.contact);
    payload.append('email', data.email);
    payload.append('origin', data.origin);
    // Guest Type (Local / Foreign) - local_visitors + foreign_visitors
    // always equals num_visitors (Total Guests), so no duplicate counting.
    payload.append('local_visitors', data.localVisitors != null ? data.localVisitors : data.visitors);
    payload.append('foreign_visitors', data.foreignVisitors != null ? data.foreignVisitors : 0);
    payload.append('num_visitors', data.visitors);
    payload.append('male_count', data.maleCount || 0);
    payload.append('female_count', data.femaleCount || 0);
    // Age Bracket / Guest Breakdown counts (stored with the reservation).
    payload.append('age_kids', data.ageKids || 0);
    payload.append('age_teens', data.ageTeens || 0);
    payload.append('age_adults_18_25', data.ageAdults1825 || 0);
    payload.append('age_adults_26_40', data.ageAdults2640 || 0);
    payload.append('age_adults_41_59', data.ageAdults4159 || 0);
    payload.append('age_seniors', data.ageSeniors || 0);
    payload.append('reservation_date', data.date);
    payload.append('eta_time', data.etaTime);
    payload.append('accommodation_type', data.accommodation || 'none');
    payload.append('payment_reference', data.paymentReference || '');
    if (data.paymentProofFile) {
      payload.append('proof_of_payment', data.paymentProofFile);
    }

    const response = await fetch(RESERVATION_API_BASE + 'reservations.php', {
      method: 'POST',
      body: payload
    });
    
    const result = await response.json();
    
    // Log response for debugging
    console.log('📥 Server response:', result);
    
    if (result.success) {
      window.lastReservationError = null;
      console.log('✅ Reservation saved successfully with ID:', result.reservation_id);
      return result.reservation_id;
    }
    
    console.error('❌ Reservation save failed:', result.message);
    window.lastReservationError = result.message || 'Server error occurred while saving your reservation.';
    return null;
    
  } catch (error) {
    console.error('❌ Error saving reservation to database:', error);
    window.lastReservationError = 'Could not reach the reservation server. Please check your internet connection and make sure XAMPP is running.';
    return null;
  }
}

// ========================================
// ===== TOURIST-INITIATED CANCELLATION =====
// ========================================
// Used by the "Cancel Reservation" button on the pending step (and by the
// 2-minute grace-period auto-timeout below). Always re-checks the
// reservation's actual status in the database first - never trusts
// whatever this page happened to be showing - so a stale tab, a second
// open tab, or a Beach Operator approval that landed a moment earlier
// can't cause an incorrect result. The database is the single source of
// truth; this function's job is just to ask it, then act on what it says.
//
// Returns one of:
//   { outcome: 'cancelled' }                       - cancellation went through
//   { outcome: 'not_eligible', message: string }    - already settled / past its date
//   { outcome: 'error', message: string }           - could not complete (network/server)
async function requestTouristCancellation(reservationId) {
  if (!reservationId) {
    return { outcome: 'error', message: 'No reservation to cancel.' };
  }
  try {
    const putResponse = await fetch(RESERVATION_API_BASE + 'reservations.php', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservation_id: reservationId,
        status: 'Cancelled',
        initiated_by: 'tourist'
      })
    });
    const result = await putResponse.json();

    if (result.success) {
      return { outcome: 'cancelled' };
    }
    if (result.not_eligible) {
      return { outcome: 'not_eligible', message: result.message || 'This reservation can no longer be cancelled.' };
    }
    return { outcome: 'error', message: result.message || 'Could not cancel this reservation. Please try again.' };
  } catch (error) {
    console.error('Error cancelling reservation in database:', error);
    return { outcome: 'error', message: 'Could not reach the reservation server. Please check your internet connection and try again.' };
  }
}

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  let savedReservationId = null;
  // Declared here (not inside the `if (reservationForm)` block below) because
  // it also needs to be readable/writable from the separate
  // `if (confirmReservationBtn)` and `if (cancelPendingBtn)` handlers further
  // down - a `let` declared inside one `if` block is not visible from a
  // sibling `if` block, which is what caused
  // "ReferenceError: formData is not defined" when submitting.
  let formData = {};

  // ===== CANCEL RESERVATION CONFIRMATION MODAL =====
  // Shared by the "Cancel Reservation" button and the grace-period
  // auto-timeout, so both go through the same Yes/No confirmation and the
  // same database-verified cancellation above.
  const cancelConfirmModal = document.getElementById('cancelConfirmModal');
  const cancelModalTitle = document.getElementById('cancelModalTitle');
  const cancelModalMessage = document.getElementById('cancelModalMessage');
  const cancelModalActions = document.getElementById('cancelModalActions');
  const cancelModalYesBtn = document.getElementById('cancelModalYesBtn');
  const cancelModalNoBtn = document.getElementById('cancelModalNoBtn');
  const cancelNotEligibleNote = document.getElementById('cancelNotEligibleNote');

  function openCancelConfirmModal() {
    if (!cancelConfirmModal) return;
    cancelModalTitle.textContent = 'Cancel Reservation?';
    cancelModalMessage.textContent = 'Are you sure you want to cancel this reservation?';
    cancelModalActions.style.display = 'flex';
    cancelConfirmModal.classList.add('active');
  }

  function closeCancelConfirmModal() {
    if (!cancelConfirmModal) return;
    cancelConfirmModal.classList.remove('active');
  }

  // Swaps the same modal into the required simple success message instead
  // of adding a whole new page section - kept minimal, and consistent with
  // the modal already on screen.
  function showCancelledModal() {
    if (!cancelConfirmModal) return;
    cancelModalTitle.textContent = 'Reservation Cancelled';
    cancelModalMessage.textContent = 'Your reservation has been successfully cancelled.';
    cancelModalActions.style.display = 'none';
    cancelConfirmModal.classList.add('active');
    setTimeout(closeCancelConfirmModal, 2500);
  }

  if (cancelModalNoBtn) {
    cancelModalNoBtn.addEventListener('click', function() {
      // No -> close the modal, reservation stays exactly as it was.
      closeCancelConfirmModal();
    });
  }

  // ===== ELEMENTS =====
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');
  const reservationForm = document.getElementById('reservationForm');
  
  // ===== STICKY NAVBAR =====
  function handleNavScroll() {
    if (window.scrollY > 80) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleNavScroll);
  handleNavScroll();

  // ===== MOBILE NAV TOGGLE =====
  if (navToggle) {
    navToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      navMenu.classList.toggle('open');
      const icon = navToggle.querySelector('i');
      if (navMenu.classList.contains('open')) {
        icon.className = 'fas fa-times';
      } else {
        icon.className = 'fas fa-bars';
      }
    });
  }

  // ===== CLOSE NAV ON LINK CLICK =====
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      navMenu.classList.remove('open');
      const icon = navToggle?.querySelector('i');
      if (icon) icon.className = 'fas fa-bars';
    });
  });

  // ===== CLOSE NAV ON OUTSIDE CLICK =====
  document.addEventListener('click', function(e) {
    if (navMenu && navMenu.classList.contains('open')) {
      if (!navMenu.contains(e.target) && !navToggle?.contains(e.target)) {
        navMenu.classList.remove('open');
        const icon = navToggle?.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      }
    }
  });

  // ===== RESERVATION FORM =====
  if (reservationForm) {
    let countdownInterval;
    let expiryTimestamp = null;

    // Real-time validation on input
    const formInputs = reservationForm.querySelectorAll('input, select');
    formInputs.forEach(input => {
      input.addEventListener('blur', function() {
        validateField(this);
      });
      input.addEventListener('input', function() {
        // Remove error styling while typing
        const errorId = this.id + 'Error';
        const errorEl = document.getElementById(errorId);
        if (errorEl) {
          errorEl.classList.remove('visible');
        }
        this.classList.remove('error');
      });
    });

    // ===== AGE BRACKET AUTO-TOTAL =====
    // Keeps the read-only Number of Visitors field (and the "Total Guests"
    // label) equal to the sum of the six age brackets at all times.
    const numVisitorsField = document.getElementById('numVisitors');
    const ageBracketTotalEl = document.getElementById('ageBracketTotal');
    function recalcAgeBracketTotal() {
      const total = readAgeBracketValues().total;
      if (ageBracketTotalEl) ageBracketTotalEl.textContent = total;
      if (numVisitorsField) {
        numVisitorsField.value = total > 0 ? total : '';
        if (total > 0) {
          hideError('visitorsError');
          numVisitorsField.classList.remove('error');
        }
      }
    }
    AGE_BRACKET_FIELDS.forEach(function (f) {
      const el = document.getElementById(f.id);
      if (el) {
        el.addEventListener('input', recalcAgeBracketTotal);
        el.addEventListener('blur', recalcAgeBracketTotal);
      }
    });
    recalcAgeBracketTotal();

    // ===== GUEST TYPE TOGGLE (Local / Foreign) =====
    // Shows the "Number of Foreign Guests" input only when Foreign is
    // selected; switching back to Local hides and clears it so no stale
    // foreign count lingers.
    const guestTypeSelect = document.getElementById('guestType');
    const foreignCountBlock = document.getElementById('foreignCountBlock');
    const foreignCountInput = document.getElementById('foreignCount');
    function onGuestTypeChange() {
      hideError('guestTypeError');
      if (guestTypeSelect && guestTypeSelect.value === 'foreign') {
        if (foreignCountBlock) foreignCountBlock.style.display = 'block';
      } else {
        if (foreignCountBlock) foreignCountBlock.style.display = 'none';
        if (foreignCountInput) foreignCountInput.value = '';
        hideError('foreignCountError');
        if (foreignCountInput) foreignCountInput.classList.remove('error');
      }
    }
    if (guestTypeSelect) {
      guestTypeSelect.addEventListener('change', onGuestTypeChange);
    }
    onGuestTypeChange();

    // ===== TWO-STEP NAVIGATION (Details -> Payment) =====
    // The Payment section is only revealed after the guest completes the
    // details and clicks "Next", so the first screen stays short. The final
    // "Review Reservation" submit still validates every field, so this is
    // purely a presentation step and the submission flow is unchanged.
    const detailsSubstep = document.getElementById('detailsSubstep');
    const paymentSubstep = document.getElementById('paymentSubstep');
    const toPaymentBtn = document.getElementById('toPaymentBtn');
    const backToDetailsBtn = document.getElementById('backToDetailsBtn');
    const stepDot1 = document.getElementById('stepDot1');
    const stepDot2 = document.getElementById('stepDot2');

    // Fields that belong to Step 1 (everything except the payment inputs).
    const STEP1_FIELDS = ['fullName', 'contactNumber', 'placeOrigin', 'guestType', 'emailAddress',
                          'numVisitors', 'reservationDate', 'etaTime', 'accommodationType'];

    function showDetailsSubstep() {
      if (paymentSubstep) paymentSubstep.style.display = 'none';
      if (detailsSubstep) detailsSubstep.style.display = 'block';
      if (stepDot1) stepDot1.classList.add('is-active');
      if (stepDot2) stepDot2.classList.remove('is-active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showPaymentSubstep() {
      if (detailsSubstep) detailsSubstep.style.display = 'none';
      if (paymentSubstep) paymentSubstep.style.display = 'block';
      if (stepDot1) stepDot1.classList.add('is-active');
      if (stepDot2) stepDot2.classList.add('is-active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (toPaymentBtn) {
      toPaymentBtn.addEventListener('click', function () {
        let ok = true;
        let firstInvalid = null;
        STEP1_FIELDS.forEach(function (fieldId) {
          const field = document.getElementById(fieldId);
          if (field && !validateField(field)) {
            ok = false;
            if (!firstInvalid) firstInvalid = field;
          }
        });
        if (ok) {
          showPaymentSubstep();
        } else if (firstInvalid) {
          // Bring the first problem into view (the hidden guest-total field
          // scrolls to the age section instead).
          const target = firstInvalid.id === 'numVisitors'
            ? document.querySelector('.age-bracket-group') : firstInvalid;
          if (target && target.scrollIntoView) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }

    if (backToDetailsBtn) {
      backToDetailsBtn.addEventListener('click', showDetailsSubstep);
    }

    // ===== ACCOMMODATION: DETAIL PANEL, UNIT PICKER, QUANTITY, TOTAL =====
    // Populated from the beach's own accommodations (loaded further below in
    // loadBeachPaymentDetails). Selecting a type reveals its available units,
    // price and unit numbers; picking a unit + quantity updates the total.
    const accSelect = document.getElementById('accommodationType');
    const accDetail = document.getElementById('accommodationDetail');
    const accDetailName = document.getElementById('accDetailName');
    const accDetailPrice = document.getElementById('accDetailPrice');
    const accDetailUnits = document.getElementById('accDetailUnits');
    const accUnitBlock = document.getElementById('accUnitBlock');
    const accUnitGrid = document.getElementById('accUnitGrid');
    const accSelectedUnits = document.getElementById('accSelectedUnits');
    const accQtyInput = document.getElementById('accQty');
    const accTotalValue = document.getElementById('accTotalValue');

    // Accommodations for the selected beach, keyed by option value. Filled by
    // populateAccommodationOptions(); empty means "no priced accommodations",
    // so the plain fallback dropdown is used and the detail panel stays hidden.
    let accommodationsByValue = {};

    function resetAccommodationState() {
      accommodationState.hasDetail = false;
      accommodationState.name = '';
      accommodationState.price = 0;
      accommodationState.availableUnits = 0;
      accommodationState.totalUnits = 0;
      accommodationState.units = [];
      accommodationState.takenUnits = [];
      accommodationState.qty = 0;
      accommodationState.total = 0;
    }

    // Quantity is always derived from how many unit numbers are selected -
    // selecting Cottage 1, Cottage 3 and Cottage 5 automatically sets
    // Quantity = 3. There is no separate manual quantity control.
    function updateAccommodationTotal() {
      accommodationState.qty = accommodationState.units.length;
      accommodationState.total = (parseFloat(accommodationState.price) || 0) * accommodationState.qty;
      if (accTotalValue) accTotalValue.textContent = formatPeso(accommodationState.total);
      if (accQtyInput) accQtyInput.value = accommodationState.qty;

      if (accSelectedUnits) {
        if (accommodationState.units.length > 0) {
          const sorted = accommodationState.units.slice().sort(function (a, b) { return a - b; });
          accSelectedUnits.textContent = 'Selected: ' + sorted.map(function (u) { return 'Unit ' + u; }).join(', ');
        } else {
          accSelectedUnits.textContent = 'No unit selected yet';
        }
      }
    }

    // Toggles a unit on/off: clicking an unselected, available unit selects
    // it (highlighted); clicking an already-selected unit deselects it.
    // Unavailable/already-reserved units (beyond availableUnits) can't be
    // clicked at all.
    function toggleUnit(unitNumber, chip) {
      const idx = accommodationState.units.indexOf(unitNumber);
      if (idx === -1) {
        accommodationState.units.push(unitNumber);
        if (chip) chip.classList.add('is-selected');
      } else {
        accommodationState.units.splice(idx, 1);
        if (chip) chip.classList.remove('is-selected');
      }
      updateAccommodationTotal();
    }

    function renderUnitChips() {
      if (!accUnitGrid) return;
      accUnitGrid.innerHTML = '';
      const available = accommodationState.availableUnits;
      const takenUnits = accommodationState.takenUnits || [];
      // Show every physical unit (available + already-reserved) so the
      // tourist can see which numbers exist and which are taken; fall back
      // to just the available count if the total isn't known.
      const gridSize = accommodationState.totalUnits > 0 ? accommodationState.totalUnits : available;
      if (!gridSize || gridSize < 1) {
        if (accUnitBlock) accUnitBlock.style.display = 'none';
        accommodationState.units = [];
        return;
      }
      if (accUnitBlock) accUnitBlock.style.display = 'block';
      for (let i = 1; i <= gridSize; i++) {
        // A unit is unavailable when it's one of the EXACT numbers already
        // reserved/occupied (e.g. Unit 2 specifically, if that's the one a
        // previous tourist picked) - not just "beyond the Nth position" -
        // so the correct real unit always shows taken, never a different
        // one picked purely by count.
        const isAvailable = takenUnits.indexOf(i) === -1;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'accommodation-unit-chip';
        chip.textContent = i;
        chip.dataset.unit = i;

        if (!isAvailable) {
          chip.classList.add('is-unavailable');
          chip.disabled = true;
          chip.title = 'This unit is already reserved / unavailable';
          accUnitGrid.appendChild(chip);
          continue;
        }

        if (accommodationState.units.indexOf(i) !== -1) chip.classList.add('is-selected');
        chip.addEventListener('click', function () {
          toggleUnit(parseInt(this.dataset.unit, 10), chip);
        });
        accUnitGrid.appendChild(chip);
      }
    }

    function onAccommodationChange() {
      const value = accSelect ? accSelect.value : '';
      hideError('accommodationError');
      if (accSelect) accSelect.classList.remove('error');

      // No selection, or a beach without priced accommodations: hide panel.
      const info = accommodationsByValue[value];
      if (!value || !info) {
        resetAccommodationState();
        if (accDetail) accDetail.style.display = 'none';
        return;
      }

      resetAccommodationState();
      accommodationState.hasDetail = true;
      accommodationState.name = info.name;
      accommodationState.price = info.price;
      accommodationState.availableUnits = info.availableUnits;
      accommodationState.totalUnits = info.totalUnits;
      accommodationState.takenUnits = info.takenUnits || [];
      accommodationState.units = [];

      if (accDetailName) accDetailName.textContent = info.name;
      if (accDetailPrice) {
        accDetailPrice.textContent = info.price > 0 ? (formatPeso(info.price) + ' / unit') : 'Rate not set';
      }
      if (accDetailUnits) accDetailUnits.textContent = info.availableUnits;

      renderUnitChips();
      updateAccommodationTotal();
      if (accDetail) accDetail.style.display = 'block';
    }

    if (accSelect) {
      accSelect.addEventListener('change', onAccommodationChange);
    }

    // Exposed so loadBeachPaymentDetails (further below) can fill the dropdown
    // once the beach's accommodations have been fetched.
    window.__populateAccommodationOptions = function (accommodations) {
      const rows = (accommodations || []).filter(function (a) { return a && a.type_name; });
      if (!accSelect || rows.length === 0) return; // keep the fallback options

      accommodationsByValue = {};
      accSelect.innerHTML = '<option value="">Select accommodation type</option>';
      rows.forEach(function (acc, idx) {
        const value = 'acc_' + idx;
        const price = parseFloat(acc.price_per_unit) || 0;
        // available_units is the live figure; fall back to total_units.
        const total = parseInt(acc.total_units, 10) || 0;
        const available = (acc.available_units != null && acc.available_units !== '')
          ? parseInt(acc.available_units, 10)
          : total;
        accommodationsByValue[value] = {
          name: acc.type_name,
          price: price,
          availableUnits: isNaN(available) ? 0 : available,
          totalUnits: isNaN(total) ? 0 : total,
          // Exact unit numbers already reserved/occupied for this type
          // (see taken_units from getBeachAccommodationAvailability()) -
          // used by renderUnitChips() to grey out the real numbers taken.
          takenUnits: Array.isArray(acc.taken_units) ? acc.taken_units.slice() : []
        };
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = acc.type_name + (price > 0 ? ' — ' + formatPeso(price) + ' / unit' : '');
        accSelect.appendChild(opt);
      });
    };

    // Re-fetches this beach's accommodation availability for whichever date
    // is currently entered in the Reservation Date field, and updates the
    // figures already loaded into accommodationsByValue in place (matched
    // by accommodation name) rather than rebuilding the dropdown, so the
    // tourist's already-chosen accommodation type stays selected. Units
    // taken on another date never block this date, and units already taken
    // on this exact date are correctly shown unavailable/removed from the
    // current selection - this is what keeps the unit picker synced with
    // the real reservation_date being booked instead of always showing
    // today's occupancy.
    async function refreshAccommodationAvailabilityForDate() {
      if (!beachId) return;
      const dateEl = document.getElementById('reservationDate');
      const dateVal = dateEl ? dateEl.value : '';
      if (!dateVal) return;

      try {
        const res = await fetch(RESERVATION_API_BASE + 'get-beaches.php?id=' + encodeURIComponent(beachId) +
          '&date=' + encodeURIComponent(dateVal));
        const result = await res.json();
        const beach = (result.success && Array.isArray(result.data) && result.data.length > 0)
          ? result.data[0] : null;
        if (!beach) return;

        const rows = (beach.accommodations || []).filter(function (a) { return a && a.type_name; });
        if (rows.length === 0) return;

        Object.keys(accommodationsByValue).forEach(function (value) {
          const name = accommodationsByValue[value].name;
          const match = rows.find(function (r) { return r.type_name === name; });
          if (!match) return;
          const total = parseInt(match.total_units, 10) || 0;
          const available = (match.available_units != null && match.available_units !== '')
            ? parseInt(match.available_units, 10)
            : total;
          accommodationsByValue[value].totalUnits = isNaN(total) ? 0 : total;
          accommodationsByValue[value].availableUnits = isNaN(available) ? 0 : available;
          accommodationsByValue[value].takenUnits = Array.isArray(match.taken_units) ? match.taken_units.slice() : [];
        });

        // If a type is already selected, refresh its detail panel against
        // the corrected date-specific figures and drop any previously
        // selected unit(s) that are actually taken on this date.
        const currentValue = accSelect ? accSelect.value : '';
        const info = currentValue ? accommodationsByValue[currentValue] : null;
        if (info) {
          accommodationState.availableUnits = info.availableUnits;
          accommodationState.totalUnits = info.totalUnits;
          accommodationState.takenUnits = info.takenUnits || [];
          accommodationState.units = accommodationState.units.filter(function (u) {
            return accommodationState.takenUnits.indexOf(u) === -1;
          });
          if (accDetailUnits) accDetailUnits.textContent = info.availableUnits;
          renderUnitChips();
          updateAccommodationTotal();
        }
      } catch (err) {
        console.error('Error refreshing accommodation availability for date:', err);
      }
    }

    const reservationDateInput = document.getElementById('reservationDate');
    if (reservationDateInput) {
      reservationDateInput.addEventListener('change', refreshAccommodationAvailabilityForDate);
    }

    // ========================================
    // ===== SMART RESORT RECOMMENDATION =====
    // ========================================
    // Rule-based, database-driven only - see api/beach-recommendations.php.
    // Does NOT touch the existing reservation/payment/approval flow: it
    // only shows an informational notice when this beach's actual current
    // capacity can't fit the entered number of guests (for the selected
    // date, once one is picked), with an optional button to load real
    // alternative Active beaches that do have enough room. Selecting one
    // simply reuses the normal Reservation Form flow for that beach.
    const capacityNotice = document.getElementById('capacityNotice');
    const capacityNoticeText = document.getElementById('capacityNoticeText');
    const findSimilarBeachesBtn = document.getElementById('findSimilarBeachesBtn');
    const similarBeachesPanel = document.getElementById('similarBeachesPanel');
    const similarBeachesLoading = document.getElementById('similarBeachesLoading');
    const similarBeachesEmpty = document.getElementById('similarBeachesEmpty');
    const similarBeachesList = document.getElementById('similarBeachesList');

    let capacityCheckTimer = null;

    function hideSimilarBeachesPanel() {
      if (similarBeachesPanel) similarBeachesPanel.style.display = 'none';
      if (similarBeachesList) similarBeachesList.innerHTML = '';
      if (similarBeachesEmpty) similarBeachesEmpty.style.display = 'none';
    }

    function hideCapacityNotice() {
      if (capacityNotice) capacityNotice.style.display = 'none';
      hideSimilarBeachesPanel();
    }

    function showCapacityNotice(remainingCapacity, totalGuests, dateVal) {
      if (!capacityNotice) return;
      if (capacityNoticeText) {
        const dateNote = dateVal ? (' on ' + dateVal) : ' right now';
        const roomNote = remainingCapacity > 0
          ? ('only has room for ' + remainingCapacity + ' more guest(s)')
          : 'currently has no remaining room';
        capacityNoticeText.textContent = 'This beach ' + roomNote + dateNote +
          ', which is not enough for your group of ' + totalGuests + '.';
      }
      capacityNotice.style.display = 'flex';
      hideSimilarBeachesPanel();
    }

    // Cheap check against this ONE beach's real, live capacity - reused
    // from the same figures the Tourism Personnel Dashboard already shows.
    async function runCapacityCheck() {
      if (!beachId) return;
      const totalGuests = parseInt((numVisitorsField && numVisitorsField.value) || '0', 10);
      if (!totalGuests || totalGuests < 1) { hideCapacityNotice(); return; }

      const dateVal = reservationDateInput ? reservationDateInput.value : '';

      try {
        let url = RESERVATION_API_BASE + 'beach-recommendations.php?action=check&beach_id=' +
          encodeURIComponent(beachId) + '&num_visitors=' + encodeURIComponent(totalGuests);
        if (dateVal) url += '&date=' + encodeURIComponent(dateVal);

        const res = await fetch(url);
        const result = await res.json();
        if (!result.success) { hideCapacityNotice(); return; }

        if (result.can_accommodate) {
          hideCapacityNotice();
        } else {
          showCapacityNotice(result.remaining_capacity, totalGuests, dateVal);
        }
      } catch (err) {
        console.error('Error checking beach capacity:', err);
      }
    }

    function scheduleCapacityCheck() {
      if (capacityCheckTimer) clearTimeout(capacityCheckTimer);
      capacityCheckTimer = setTimeout(runCapacityCheck, 500);
    }

    // Re-check whenever the guest total changes (the age-bracket inputs
    // already recompute numVisitors on these same events).
    AGE_BRACKET_FIELDS.forEach(function (f) {
      const el = document.getElementById(f.id);
      if (el) {
        el.addEventListener('input', scheduleCapacityCheck);
        el.addEventListener('blur', scheduleCapacityCheck);
      }
    });
    // And whenever the reservation date changes - date-specific availability,
    // same as refreshAccommodationAvailabilityForDate above.
    if (reservationDateInput) {
      reservationDateInput.addEventListener('change', scheduleCapacityCheck);
    }

    function renderSimilarBeachCard(beach) {
      const card = document.createElement('div');
      card.className = 'similar-beach-card';

      const img = document.createElement('img');
      img.className = 'similar-beach-card-image';
      img.src = beach.main_image || '../assets/images/beach1.jpg';
      img.alt = beach.beach_name || 'Beach';
      img.onerror = function () { this.onerror = null; this.src = '../assets/images/beach1.jpg'; };
      card.appendChild(img);

      const body = document.createElement('div');
      body.className = 'similar-beach-card-body';

      const name = document.createElement('div');
      name.className = 'similar-beach-card-name';
      name.textContent = beach.beach_name || 'Beach';
      body.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'similar-beach-card-meta';
      const locationText = beach.barangay || beach.location || '';
      if (locationText) {
        const loc = document.createElement('span');
        loc.textContent = locationText;
        meta.appendChild(loc);
      }
      const fee = document.createElement('span');
      fee.textContent = formatPeso(beach.adult_fee) + ' / adult';
      meta.appendChild(fee);
      const capacitySpan = document.createElement('span');
      capacitySpan.textContent = beach.remaining_capacity + ' spot(s) available';
      meta.appendChild(capacitySpan);
      body.appendChild(meta);

      if (beach.matched_accommodation_type) {
        const badge = document.createElement('span');
        badge.className = 'similar-beach-card-badge is-match';
        badge.textContent = 'Same accommodation type available';
        body.appendChild(badge);
      }
      const capBadge = document.createElement('span');
      capBadge.className = 'similar-beach-card-badge is-capacity';
      capBadge.textContent = 'Fits your group size';
      body.appendChild(capBadge);

      card.appendChild(body);

      const actionWrap = document.createElement('div');
      actionWrap.className = 'similar-beach-card-action';
      const selectBtn = document.createElement('a');
      selectBtn.className = 'btn-outline-sm';
      selectBtn.textContent = 'Select This Beach';
      // Reuses the exact same Reservation Form flow already used for every
      // other beach - nothing about the reservation flow itself changes.
      selectBtn.href = 'reservation-form.html?beach=' + encodeURIComponent(beach.beach_id);
      actionWrap.appendChild(selectBtn);
      card.appendChild(actionWrap);

      return card;
    }

    if (findSimilarBeachesBtn) {
      findSimilarBeachesBtn.addEventListener('click', async function () {
        if (!beachId) return;
        const totalGuests = parseInt((numVisitorsField && numVisitorsField.value) || '0', 10);
        if (!totalGuests) return;

        if (similarBeachesPanel) similarBeachesPanel.style.display = 'block';
        if (similarBeachesLoading) similarBeachesLoading.style.display = 'block';
        if (similarBeachesEmpty) similarBeachesEmpty.style.display = 'none';
        if (similarBeachesList) similarBeachesList.innerHTML = '';

        const dateVal = reservationDateInput ? reservationDateInput.value : '';
        const accType = accommodationState.hasDetail ? accommodationState.name : '';

        try {
          let url = RESERVATION_API_BASE + 'beach-recommendations.php?action=recommend&beach_id=' +
            encodeURIComponent(beachId) + '&num_visitors=' + encodeURIComponent(totalGuests);
          if (dateVal) url += '&date=' + encodeURIComponent(dateVal);
          if (accType) url += '&accommodation_type=' + encodeURIComponent(accType);

          const res = await fetch(url);
          const result = await res.json();

          if (similarBeachesLoading) similarBeachesLoading.style.display = 'none';

          if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
            if (similarBeachesEmpty) {
              similarBeachesEmpty.textContent = 'No similar active beaches with enough capacity were found for this date.';
              similarBeachesEmpty.style.display = 'block';
            }
            return;
          }

          result.data.forEach(function (beach) {
            if (similarBeachesList) similarBeachesList.appendChild(renderSimilarBeachCard(beach));
          });
        } catch (err) {
          console.error('Error loading similar beaches:', err);
          if (similarBeachesLoading) similarBeachesLoading.style.display = 'none';
          if (similarBeachesEmpty) {
            similarBeachesEmpty.textContent = 'Could not load similar beaches right now. Please try again.';
            similarBeachesEmpty.style.display = 'block';
          }
        }
      });
    }

    function validateField(field) {
      const id = field.id;
      const errorId = id + 'Error';
      
      switch(id) {
        case 'fullName':
          if (!field.value.trim()) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;
          
        case 'contactNumber':
          const phonePattern = /^[0-9]{11}$/;
          if (!field.value || !phonePattern.test(field.value.replace(/[^0-9]/g, ''))) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;
          
        case 'placeOrigin':
          if (!field.value.trim()) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;
          
        case 'emailAddress':
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!field.value || !emailPattern.test(field.value)) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;
          
        case 'numVisitors':
          // The guest total is hidden and computed from the age groups, so
          // surface the message on the visible age-breakdown error line.
          if (!field.value || parseInt(field.value) < 1) {
            showError('visitorsError');
            return false;
          }
          hideError('visitorsError');
          return true;
          
        case 'reservationDate':
          if (!field.value) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          // Check if date is in the future
          const selectedDate = new Date(field.value + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate < today) {
            showError(errorId);
            field.classList.add('error');
            const errorEl = document.getElementById(errorId);
            if (errorEl) errorEl.textContent = 'Please select a future date.';
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;
          
        case 'etaTime':
          if (!field.value) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;
          
        case 'guestType': {
          if (!field.value) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');

          // "Foreign" requires a valid Number of Foreign Guests, no greater
          // than the Total Guests already entered in the age breakdown.
          if (field.value === 'foreign') {
            const total = parseInt(document.getElementById('numVisitors').value, 10) || 0;
            const foreignEl = document.getElementById('foreignCount');
            const foreignVal = foreignEl ? foreignEl.value : '';
            const foreignNum = parseInt(foreignVal, 10);
            if (foreignVal === '' || isNaN(foreignNum) || foreignNum < 0 || foreignNum > total) {
              const errorEl = document.getElementById('foreignCountError');
              if (errorEl) errorEl.textContent = total > 0
                ? ('Please enter a number between 0 and ' + total + ' (Total Guests).')
                : 'Please enter the number of foreign guests.';
              showError('foreignCountError');
              if (foreignEl) foreignEl.classList.add('error');
              return false;
            }
            hideError('foreignCountError');
            if (foreignEl) foreignEl.classList.remove('error');
          }
          return true;
        }

        case 'accommodationType': {
          if (!field.value) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          // When this beach has priced accommodations, at least one unit
          // number must be selected so Quantity (units.length) is never 0.
          if (accommodationState.hasDetail && accommodationState.units.length === 0) {
            const errorEl = document.getElementById(errorId);
            if (errorEl) errorEl.textContent = 'Please select at least one available unit.';
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;
        }

        case 'paymentReference':
          if (!field.value.trim()) {
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;

        case 'paymentProof': {
          const file = field.files && field.files[0];
          const errorEl = document.getElementById(errorId);
          if (!file) {
            if (errorEl) errorEl.textContent = 'Please upload your proof of payment (JPG, JPEG, PNG or PDF)';
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          // Validate type by extension + MIME (JPG/JPEG/PNG/PDF only).
          const name = (file.name || '').toLowerCase();
          const okExt = /\.(jpg|jpeg|png|pdf)$/.test(name);
          const okType = ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type);
          if (!okExt && !okType) {
            if (errorEl) errorEl.textContent = 'Only JPG, JPEG, PNG or PDF files are accepted.';
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          // Max 5MB (matches the server-side limit).
          if (file.size > 5 * 1024 * 1024) {
            if (errorEl) errorEl.textContent = 'File is too large. Maximum size is 5MB.';
            showError(errorId);
            field.classList.add('error');
            return false;
          }
          hideError(errorId);
          field.classList.remove('error');
          return true;
        }

        default:
          return true;
      }
    }

    reservationForm.addEventListener('submit', function(e) {
      e.preventDefault();

      // If the guest is still on the details step (e.g. they pressed Enter in
      // a text field), don't validate the not-yet-visible payment fields -
      // just move them forward through the same "Next" path.
      if (paymentSubstep && paymentSubstep.style.display === 'none') {
        if (toPaymentBtn) toPaymentBtn.click();
        return;
      }

      let isValid = true;

      // Validate all fields (including the required payment fields)
      const fields = ['fullName', 'contactNumber', 'placeOrigin', 'guestType', 'emailAddress', 
                     'numVisitors', 'reservationDate', 'etaTime', 'accommodationType',
                     'paymentReference', 'paymentProof'];
      
      fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
          if (!validateField(field)) {
            isValid = false;
          }
        }
      });

      if (isValid) {
        // Collect form data for review
        const ageBrackets = readAgeBracketValues();
        const guestTypeValues = readGuestTypeValues(ageBrackets.total);
        formData = {
          fullName: document.getElementById('fullName').value,
          contact: document.getElementById('contactNumber').value,
          origin: document.getElementById('placeOrigin').value,
          guestType: guestTypeValues.guestType,
          localVisitors: guestTypeValues.local,
          foreignVisitors: guestTypeValues.foreign,
          email: document.getElementById('emailAddress').value,
          visitors: document.getElementById('numVisitors').value,
          maleCount: document.getElementById('maleCount').value || 0,
          femaleCount: document.getElementById('femaleCount').value || 0,
          // Guest Breakdown by Age. Four visible groups are kept for the
          // review summary; the six database columns keep their exact keys
          // so the payload sent to reservations.php is unchanged.
          ageKids: ageBrackets.age_kids,
          ageTeens: ageBrackets.age_teens,
          ageAdult: ageBrackets.age_adult,
          ageAdults1825: ageBrackets.age_adults_18_25,
          ageAdults2640: ageBrackets.age_adults_26_40,
          ageAdults4159: ageBrackets.age_adults_41_59,
          ageSeniors: ageBrackets.age_seniors,
          date: document.getElementById('reservationDate').value,
          etaTime: document.getElementById('etaTime').value,
          // A concise, human-readable accommodation descriptor (type, unit
          // and quantity) is stored in the existing accommodation_type field
          // so it flows to every connected module unchanged; the computed
          // total is kept alongside it for the review + confirmation.
          accommodation: getAccommodationDescriptor(),
          accommodationTotal: accommodationState.total,
          accommodationUnits: accommodationState.hasDetail
            ? accommodationState.units.slice().sort(function (a, b) { return a - b; })
            : [],
          paymentReference: document.getElementById('paymentReference').value.trim(),
          paymentProofFile: (document.getElementById('paymentProof').files && document.getElementById('paymentProof').files[0]) || null
        };

        // Log the beach ID being used
        const beachId = getReservationBeachId();
        console.log('🏖️ Submitting reservation for beach ID:', beachId);

        // Show review step
        showReviewStep(formData);
      }
    });
  }

  // ===== SHOW REVIEW STEP =====
  function showReviewStep(data) {
    document.getElementById('formStep').style.display = 'none';
    document.getElementById('reviewStep').style.display = 'block';
    
    const reviewDetails = document.getElementById('reviewDetails');

    // Guest Breakdown by Age - list only the groups that have guests.
    const ageBracketLabels = [
      { value: data.ageKids,    label: 'Kids (0–12)' },
      { value: data.ageTeens,   label: 'Teen (13–17)' },
      { value: data.ageAdult,   label: 'Adult (18–59)' },
      { value: data.ageSeniors, label: 'Senior (60+)' }
    ];
    const ageBreakdownSummary = ageBracketLabels
      .filter(function (b) { return parseInt(b.value, 10) > 0; })
      .map(function (b) { return b.label + ': ' + parseInt(b.value, 10); })
      .join(', ') || 'None specified';

    // Total amount row is only meaningful when a priced accommodation with a
    // rate was selected.
    const totalAmountRow = (data.accommodationTotal && parseFloat(data.accommodationTotal) > 0)
      ? `
      <div class="review-item">
        <span class="review-label">Total Amount</span>
        <span class="review-value">${escapeHtml(formatPeso(data.accommodationTotal))}</span>
      </div>` : '';
    
    reviewDetails.innerHTML = `
      <div class="review-item">
        <span class="review-label">Full Name</span>
        <span class="review-value">${escapeHtml(data.fullName)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Contact Number</span>
        <span class="review-value">${escapeHtml(data.contact)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Place of Origin</span>
        <span class="review-value">${escapeHtml(data.origin)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Email Address</span>
        <span class="review-value">${escapeHtml(data.email)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Total Visitors</span>
        <span class="review-value">${escapeHtml(data.visitors)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Guest Type</span>
        <span class="review-value">${data.guestType === 'foreign' ? ('Foreign (' + escapeHtml(String(data.foreignVisitors)) + ') / Local (' + escapeHtml(String(data.localVisitors)) + ')') : 'Local'}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Guest Breakdown (by age)</span>
        <span class="review-value">${escapeHtml(ageBreakdownSummary)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Male Visitors</span>
        <span class="review-value">${escapeHtml(data.maleCount)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Female Visitors</span>
        <span class="review-value">${escapeHtml(data.femaleCount)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Reservation Date</span>
        <span class="review-value">${escapeHtml(data.date)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Estimated Time of Arrival (ETA)</span>
        <span class="review-value">${escapeHtml(data.etaTime)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Accommodation</span>
        <span class="review-value">${data.accommodation && data.accommodation !== 'none' ? escapeHtml(data.accommodation) : 'None'}</span>
      </div>${data.accommodationUnits && data.accommodationUnits.length > 0 ? `
      <div class="review-item">
        <span class="review-label">Selected Unit(s)</span>
        <span class="review-value">${escapeHtml(data.accommodationUnits.map(function (u) { return 'Unit ' + u; }).join(', '))}</span>
      </div>` : ''}${totalAmountRow}
      <div class="review-item">
        <span class="review-label">Payment Reference Number</span>
        <span class="review-value">${escapeHtml(data.paymentReference)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Proof of Payment</span>
        <span class="review-value">${data.paymentProofFile ? escapeHtml(data.paymentProofFile.name) : 'Not attached'}</span>
      </div>
    `;
  }

  // ===== ESCAPE HTML (Security) =====
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== BACK TO FORM =====
  const backToFormBtn = document.getElementById('backToFormBtn');
  if (backToFormBtn) {
    backToFormBtn.addEventListener('click', function() {
      document.getElementById('reviewStep').style.display = 'none';
      document.getElementById('formStep').style.display = 'block';
      hideSubmitError();
    });
  }

  // ===== CONFIRM RESERVATION (FIXED - NO MORE LYING UI) =====
  const confirmReservationBtn = document.getElementById('confirmReservationBtn');
  if (confirmReservationBtn) {
    confirmReservationBtn.addEventListener('click', async function() {
      // Hide any previous error
      hideSubmitError();
      
      // Save original button state
      const originalBtnHtml = confirmReservationBtn.innerHTML;
      confirmReservationBtn.disabled = true;
      confirmReservationBtn.innerHTML = 'Submitting... <i class="fas fa-spinner fa-spin"></i>';

      try {
        // ACTUALLY submit to database and WAIT for the result
        savedReservationId = await submitReservationToDatabase(formData);
      } catch (error) {
        // Surface the REAL error instead of hiding it behind a generic
        // message - this is what actually throws when something outside
        // the normal "server responded with an error" path fails (e.g. a
        // JS error, a blocked request, a bad response format).
        console.error('Unexpected error during submission:', error);
        window.lastReservationError = 'An unexpected error occurred: ' + (error && error.message ? error.message : String(error));
        savedReservationId = null;
      }

      // Restore button
      confirmReservationBtn.disabled = false;
      confirmReservationBtn.innerHTML = originalBtnHtml;

      // NOW decide what to show based on ACTUAL result
      if (savedReservationId) {
        // ✅ Successfully saved in database - show confirmation
        document.getElementById('reviewStep').style.display = 'none';
        document.getElementById('pendingStep').style.display = 'block';
        
        // Store reservation ID for cancellation
        window.currentReservationId = savedReservationId;
        
        // Start 2-minute countdown for pending confirmation
        startPendingCountdown();
        
      } else {
        // ❌ Failed to save - show the REAL error
        const errorMessage = window.lastReservationError 
          || 'We could not submit your reservation. Please check your internet connection and try again. If this keeps happening, please contact the Tukuran Tourism Office directly.';
        
        showSubmitError(errorMessage);
        
        // Scroll to error
        const errorBanner = document.getElementById('submitErrorBanner');
        if (errorBanner) {
          errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  // ===== PENDING COUNTDOWN TIMER =====
  function startPendingCountdown() {
    let secondsRemaining = 120; // 2 minutes
    const timerElement = document.getElementById('pendingTimer');
    
    if (timerElement) {
      // Clear any existing interval
      if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
      }
      
      window.countdownInterval = setInterval(() => {
        secondsRemaining--;
        
        if (secondsRemaining <= 0) {
          clearInterval(window.countdownInterval);
          timerElement.textContent = '0:00';
          // Auto-cancel if not confirmed. Goes through the same
          // database-verified cancellation as the manual Cancel
          // Reservation button (see requestTouristCancellation above),
          // so if a Beach Operator approval landed in the last moment
          // it's still handled correctly rather than assumed.
          if (savedReservationId) {
            const idToCancel = savedReservationId;
            savedReservationId = null;
            requestTouristCancellation(idToCancel);
            document.getElementById('pendingStep').style.display = 'none';
            document.getElementById('formStep').style.display = 'block';
            alert('Reservation timed out. Please submit again.');
          }
          return;
        }
        
        const minutes = Math.floor(secondsRemaining / 60);
        const seconds = secondsRemaining % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }, 1000);
    }
  }

  // ===== SUBMISSION ERROR BANNER =====
  function showSubmitError(message) {
    let banner = document.getElementById('submitErrorBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'submitErrorBanner';
      banner.style.cssText = 'margin-top:16px; padding:14px 16px; border-radius:10px; '
        + 'background:#fdecea; border:1px solid #e74c5e; color:#a12b3a; '
        + 'font-weight:500; display:flex; align-items:center; gap:10px;';
      const reviewContainer = document.querySelector('#reviewStep .review-container');
      if (reviewContainer) reviewContainer.appendChild(banner);
    }
    banner.innerHTML = '<i class="fas fa-triangle-exclamation" style="font-size:20px;"></i><span>' + escapeHtml(message) + '</span>';
    banner.style.display = 'flex';
  }

  function hideSubmitError() {
    const banner = document.getElementById('submitErrorBanner');
    if (banner) banner.style.display = 'none';
  }

  // ===== CONFIRM PENDING (Tourist confirms arrival) =====
  const confirmPendingBtn = document.getElementById('confirmPendingBtn');
  if (confirmPendingBtn) {
    confirmPendingBtn.addEventListener('click', function() {
      if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
      }
      
      // NOTE: this button does NOT set the reservation to "Confirmed" in
      // the database. Approval is the Beach Owner's decision alone (made
      // in Reservation Management); a tourist confirming their own intent
      // to show up here must never bypass that approval step or overwrite
      // whatever status the Beach Owner has already set. The reservation
      // stays exactly as it is in the database (still Pending until a
      // Beach Owner approves it) - this step only stops the local
      // countdown/auto-cancel and moves the tourist on to the summary
      // screen below.

      // Show final confirmation
      document.getElementById('pendingStep').style.display = 'none';
      document.getElementById('confirmedStep').style.display = 'block';
      
      // Store for reference
      window.confirmedReservationId = savedReservationId;
      savedReservationId = null;
    });
  }

  // ===== CANCEL PENDING =====
  const cancelPendingBtn = document.getElementById('cancelPendingBtn');
  let pendingCancelTargetId = null;

  function resetPendingStepToFormStep() {
    document.getElementById('pendingStep').style.display = 'none';
    document.getElementById('formStep').style.display = 'block';
    document.getElementById('reservationForm').reset();

    // Return to the first step and clear the derived UI (guest total,
    // accommodation panel and total amount) so a fresh reservation starts
    // from a clean state. Done inline here because this handler sits
    // outside the reservationForm scope where those helpers live.
    const totalEl = document.getElementById('ageBracketTotal');
    if (totalEl) totalEl.textContent = '0';
    const numVis = document.getElementById('numVisitors');
    if (numVis) numVis.value = '';
    accommodationState.hasDetail = false;
    accommodationState.name = '';
    accommodationState.price = 0;
    accommodationState.availableUnits = 0;
    accommodationState.totalUnits = 0;
    accommodationState.units = [];
    accommodationState.qty = 0;
    accommodationState.total = 0;
    const accDetailEl = document.getElementById('accommodationDetail');
    if (accDetailEl) accDetailEl.style.display = 'none';
    // Back to the details step.
    const dSub = document.getElementById('detailsSubstep');
    const pSub = document.getElementById('paymentSubstep');
    const d1 = document.getElementById('stepDot1');
    const d2 = document.getElementById('stepDot2');
    if (pSub) pSub.style.display = 'none';
    if (dSub) dSub.style.display = 'block';
    if (d1) d1.classList.add('is-active');
    if (d2) d2.classList.remove('is-active');

    if (cancelNotEligibleNote) cancelNotEligibleNote.style.display = 'none';

    // Reset form data
    formData = {};
  }

  if (cancelPendingBtn) {
    cancelPendingBtn.addEventListener('click', function() {
      if (!savedReservationId) return;
      pendingCancelTargetId = savedReservationId;
      openCancelConfirmModal();
    });
  }

  if (cancelModalYesBtn) {
    cancelModalYesBtn.addEventListener('click', async function() {
      if (!pendingCancelTargetId) {
        closeCancelConfirmModal();
        return;
      }

      const originalHtml = cancelModalYesBtn.innerHTML;
      cancelModalYesBtn.disabled = true;
      cancelModalNoBtn.disabled = true;
      cancelModalYesBtn.innerHTML = 'Cancelling... <i class="fas fa-spinner fa-spin"></i>';

      // Always asks the database for the reservation's real, current
      // status right before acting on it - never assumes this page's own
      // (possibly stale) view of "Pending"/"Approved" is still accurate.
      const result = await requestTouristCancellation(pendingCancelTargetId);

      cancelModalYesBtn.disabled = false;
      cancelModalNoBtn.disabled = false;
      cancelModalYesBtn.innerHTML = originalHtml;

      if (result.outcome === 'cancelled') {
        if (window.countdownInterval) clearInterval(window.countdownInterval);
        savedReservationId = null;
        pendingCancelTargetId = null;
        showCancelledModal();
        setTimeout(resetPendingStepToFormStep, 2500);
      } else if (result.outcome === 'not_eligible') {
        // Already cancelled/expired/past its date - don't process it
        // again. Close the confirmation modal and show a simple message
        // instead, without pretending anything changed.
        closeCancelConfirmModal();
        pendingCancelTargetId = null;
        if (window.countdownInterval) clearInterval(window.countdownInterval);
        if (cancelNotEligibleNote) {
          cancelNotEligibleNote.textContent = result.message;
          cancelNotEligibleNote.style.display = 'block';
        }
        setTimeout(resetPendingStepToFormStep, 3000);
      } else {
        // Network/server error - close the modal and let the tourist try
        // the Cancel Reservation button again; nothing has changed.
        closeCancelConfirmModal();
        if (cancelNotEligibleNote) {
          cancelNotEligibleNote.textContent = result.message;
          cancelNotEligibleNote.style.display = 'block';
        }
      }
    });
  }

  // ===== UTILITY FUNCTIONS =====
  function showError(errorId) {
    const el = document.getElementById(errorId);
    if (el) el.classList.add('visible');
  }

  function hideError(errorId) {
    const el = document.getElementById(errorId);
    if (el) el.classList.remove('visible');
  }

  // ===== LOAD THE SELECTED RESORT'S PAYMENT DETAILS =====
  // Automatically displays the GCash number / account name / QR code and
  // any bank account information saved for the selected beach, so the
  // details always match whichever participating beach was chosen.
  async function loadBeachPaymentDetails(beachIdParam) {
    const loadingEl = document.getElementById('paymentDetailsLoading');
    const bodyEl = document.getElementById('paymentDetailsBody');
    const emptyEl = document.getElementById('paymentDetailsEmpty');
    if (!loadingEl || !bodyEl || !emptyEl) return;

    const showEmpty = () => {
      loadingEl.style.display = 'none';
      bodyEl.style.display = 'none';
      emptyEl.style.display = 'block';
    };

    if (!beachIdParam) { showEmpty(); return; }

    try {
      const res = await fetch(RESERVATION_API_BASE + 'get-beaches.php?id=' + encodeURIComponent(beachIdParam));
      const result = await res.json();
      const beach = (result.success && Array.isArray(result.data) && result.data.length > 0)
        ? result.data[0] : null;

      if (!beach) { showEmpty(); return; }

      // Fill the Accommodation Type dropdown with the accommodations this
      // beach actually offers (type, units and price entered by Tourism
      // Personnel in Beach Management), so selecting one reveals its units,
      // price and unit numbers. Independent of payment info.
      if (typeof window.__populateAccommodationOptions === 'function') {
        window.__populateAccommodationOptions(beach.accommodations || []);
      }

      const gcashNumber = (beach.gcash_number || '').trim();
      const gcashName = (beach.gcash_name || '').trim();
      const gcashQr = (beach.gcash_qr || '').trim();
      const bankName = (beach.bank_name || '').trim();
      const bankAccName = (beach.bank_account_name || '').trim();
      const bankAccNumber = (beach.bank_account_number || '').trim();

      const hasAnyPayment = gcashNumber || gcashName || gcashQr || bankName || bankAccName || bankAccNumber;
      if (!hasAnyPayment) { showEmpty(); return; }

      // Beach name heading
      const nameEl = document.getElementById('paymentBeachName');
      if (nameEl && beach.beach_name) {
        nameEl.textContent = beach.beach_name + ' — Payment Details';
      }

      // GCash number / name
      setPaymentRow('gcashNumberRow', 'gcashNumberValue', gcashNumber);
      setPaymentRow('gcashNameRow', 'gcashNameValue', gcashName);

      // Bank info (only shown when provided)
      setPaymentRow('bankNameRow', 'bankNameValue', bankName);
      setPaymentRow('bankAccountNameRow', 'bankAccountNameValue', bankAccName);
      setPaymentRow('bankAccountNumberRow', 'bankAccountNumberValue', bankAccNumber);

      // GCash QR image
      const qrWrap = document.getElementById('paymentQrWrap');
      const qrImg = document.getElementById('paymentQrImage');
      if (qrWrap && qrImg) {
        if (gcashQr) {
          qrImg.src = gcashQr;
          qrImg.onerror = function () { qrWrap.style.display = 'none'; };
          qrWrap.style.display = 'block';
        } else {
          qrWrap.style.display = 'none';
        }
      }

      loadingEl.style.display = 'none';
      emptyEl.style.display = 'none';
      bodyEl.style.display = 'block';
    } catch (err) {
      console.error('Error loading beach payment details:', err);
      showEmpty();
    }
  }

  // Shows a payment detail row only when it has a value; hides it otherwise.
  function setPaymentRow(rowId, valueId, value) {
    const rowEl = document.getElementById(rowId);
    const valEl = document.getElementById(valueId);
    if (!rowEl || !valEl) return;
    if (value && String(value).trim() !== '') {
      valEl.textContent = value;
      rowEl.style.display = '';
    } else {
      rowEl.style.display = 'none';
    }
  }

  // ===== PROOF OF PAYMENT: INSTANT PREVIEW =====
  // Shows the selected image (or a file chip for PDFs) as soon as the
  // tourist picks it, so they can verify it before submitting. The preview
  // stays visible until the file is changed or cleared.
  const proofInput = document.getElementById('paymentProof');
  if (proofInput) {
    proofInput.addEventListener('change', function () {
      const wrap = document.getElementById('proofPreviewWrap');
      const img = document.getElementById('proofPreviewImage');
      const fileChip = document.getElementById('proofPreviewFile');
      const fileName = document.getElementById('proofPreviewFileName');
      if (!wrap || !img || !fileChip) return;

      const file = this.files && this.files[0];

      // Release any previous object URL before replacing it.
      if (img.dataset.objectUrl) {
        URL.revokeObjectURL(img.dataset.objectUrl);
        delete img.dataset.objectUrl;
      }

      if (!file) {
        wrap.style.display = 'none';
        img.style.display = 'none';
        img.removeAttribute('src');
        fileChip.style.display = 'none';
        return;
      }

      const isImage = /^image\/(jpeg|png)$/.test(file.type) || /\.(jpg|jpeg|png)$/i.test(file.name || '');

      if (isImage) {
        const url = URL.createObjectURL(file);
        img.src = url;
        img.dataset.objectUrl = url;
        img.style.display = 'block';
        fileChip.style.display = 'none';
      } else {
        // PDFs can't be previewed inline here; show the file name instead so
        // the tourist can still confirm they picked the right document.
        img.style.display = 'none';
        img.removeAttribute('src');
        if (fileName) fileName.textContent = file.name || 'document.pdf';
        fileChip.style.display = 'flex';
      }
      wrap.style.display = 'block';
    });
  }

  // ===== CHECK FOR BEACH ID ON LOAD =====
  const beachId = getReservationBeachId();
  // Populate the resort's payment details for the selected beach.
  loadBeachPaymentDetails(beachId);
  if (!beachId) {
    console.warn('⚠️ No beach ID found in URL. Reservation form may not work properly.');
    // Show a warning banner
    const warningBanner = document.createElement('div');
    warningBanner.style.cssText = 'background:#fff3cd; border:1px solid #ffc107; color:#856404; padding:12px 16px; border-radius:8px; margin:16px 0;';
    warningBanner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <strong>Warning:</strong> No beach selected. Please go back to the beach page and click "Reserve Now".';
    const container = document.querySelector('.container');
    if (container && container.firstChild) {
      container.insertBefore(warningBanner, container.firstChild);
    }
  } else {
    console.log('✅ Beach ID found:', beachId);
  }

  console.log('🏖️ Reservation Form page ready ✅');
});