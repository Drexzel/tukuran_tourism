// ========================================
// ===== RESERVATION MANAGEMENT SCRIPT =====
// ========================================

const RES_MGMT_API_BASE = '../api/';

// Populated from the database on load; keyed by reservation id (string).
const reservationData = {};

// Maps the database status word directly to what's shown in the UI - no
// guessing from the reservation date/ETA. 'Confirmed' in the database is
// always displayed as "Approved" here; 'Completed' is only ever reached
// because a Beach Owner manually used "Mark as Completed" after confirming
// the tourist actually visited (see completeReservation() below) - never
// inferred just because the reservation date has passed.
function dbStatusToUiStatus(dbStatus) {
  if (dbStatus === 'Pending') return 'pending';
  if (dbStatus === 'Confirmed') return 'approved';
  if (dbStatus === 'Completed') return 'completed';
  if (dbStatus === 'Cancelled' || dbStatus === 'Expired') return 'cancelled';
  return 'pending';
}

function formatEtaTime(etaTime) {
  if (!etaTime) return null;
  const parts = etaTime.split(':');
  if (parts.length < 2) return etaTime;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

function calculateExpirationTime(etaTime) {
  if (!etaTime) return null;
  const parts = etaTime.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const totalMinutes = (hours * 60 + minutes + 30) % (24 * 60);
  const expHours24 = Math.floor(totalMinutes / 60);
  const expMinutes = totalMinutes % 60;

  const ampm = expHours24 >= 12 ? 'PM' : 'AM';
  let expHours12 = expHours24 % 12;
  if (expHours12 === 0) expHours12 = 12;

  return `${expHours12}:${String(expMinutes).padStart(2, '0')} ${ampm}`;
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return 'Not specified';
  const d = new Date(createdAt.replace(' ', 'T'));
  if (isNaN(d.getTime())) return createdAt;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ===== ONLINE DOWN PAYMENT HELPERS =====
function formatPaymentDateTime(paymentDate) {
  if (!paymentDate) return 'Not specified';
  const d = new Date(String(paymentDate).replace(' ', 'T'));
  if (isNaN(d.getTime())) return paymentDate;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatAmountPaid(amount) {
  if (amount === null || amount === undefined || amount === '') return 'Not specified';
  const n = parseFloat(amount);
  if (isNaN(n)) return escapeHtml(String(amount));
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderPaymentStatusBadge(status) {
  const s = (status || 'Unpaid').toString();
  const key = s.toLowerCase();
  let color = '#8a94a6'; // default / unpaid
  if (key === 'submitted') color = '#1e6b86';
  else if (key === 'verified' || key === 'paid') color = '#2ea043';
  return '<span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.82em; '
    + 'font-weight:600; color:#fff; background:' + color + ';">' + escapeHtml(s) + '</span>';
}

// Renders the uploaded proof of payment: an inline thumbnail for images
// (clicking it opens a larger in-page preview) plus a Download link. PDFs
// get a file link instead, since they can't be shown inline here. The
// stored path is relative to a page one folder below the BEACH root, and
// the Beach Owner pages sit at that same depth.
function renderProofOfPayment(path) {
  const p = (path || '').trim();
  if (!p) return '<span style="color:#a12b3a;">No proof uploaded</span>';

  const safe = escapeHtml(p);
  const isPdf = /\.pdf($|\?)/i.test(p);
  const linkStyle = 'display:inline-flex; align-items:center; gap:6px; color:#1e6b86; font-weight:600; text-decoration:none;';

  const downloadLink = '<a href="' + safe + '" download style="' + linkStyle + '">'
    + '<i class="fas fa-download"></i> Download</a>';

  if (isPdf) {
    const viewLink = '<a href="' + safe + '" target="_blank" rel="noopener" style="' + linkStyle + '">'
      + '<i class="fas fa-up-right-from-square"></i> View</a>';
    return '<div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">'
      + '<span style="display:inline-flex; align-items:center; gap:6px; color:#0a2e3f;">'
      + '<i class="fas fa-file-pdf" style="color:#c0392b;"></i> PDF document</span>'
      + viewLink + downloadLink + '</div>';
  }

  return '<div style="display:flex; flex-direction:column; gap:8px;">'
    + '<img src="' + safe + '" alt="Proof of payment" class="proof-thumbnail" data-full-src="' + safe + '" '
    + 'style="max-width:200px; max-height:200px; border:1px solid #d5e2e8; border-radius:8px; background:#fff; display:block; cursor:zoom-in;" '
    + 'onerror="this.style.display=\'none\';">'
    + '<div style="display:flex; gap:14px; flex-wrap:wrap;">' + downloadLink + '</div>'
    + '</div>';
}

// Clicking a proof-of-payment thumbnail opens it in a larger preview modal.
document.addEventListener('click', function(e) {
  const thumb = e.target.closest('.proof-thumbnail');
  if (thumb) openProofPreview(thumb.dataset.fullSrc);
});

window.openProofPreview = function(src) {
  const modal = document.getElementById('paymentPreviewModal');
  const img = document.getElementById('paymentPreviewImage');
  if (!modal || !img) return;
  img.src = src;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeProofPreview = function() {
  const modal = document.getElementById('paymentPreviewModal');
  const img = document.getElementById('paymentPreviewImage');
  if (!modal) return;
  modal.classList.remove('active');
  if (img) img.src = '';

  // Only restore scrolling if the Reservation Details modal isn't still
  // open behind this one (the preview is opened from within it).
  const detailsModalEl = document.getElementById('detailsModal');
  const detailsStillOpen = detailsModalEl && detailsModalEl.classList.contains('active');
  if (!detailsStillOpen) {
    document.body.style.overflow = '';
  }
};

document.addEventListener('DOMContentLoaded', function() {
  const previewModal = document.getElementById('paymentPreviewModal');
  const previewClose = document.getElementById('closePaymentPreview');

  if (previewClose) {
    previewClose.addEventListener('click', closeProofPreview);
  }
  if (previewModal) {
    previewModal.addEventListener('click', function(e) {
      if (e.target === previewModal) closeProofPreview();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && previewModal && previewModal.classList.contains('active')) {
      closeProofPreview();
    }
  });
});

// ===== LOAD RESERVATIONS FROM THE DATABASE =====
async function loadReservationsFromServer() {
  const tbody = document.getElementById('reservationsBody');
  const beachId = window.BeachOwnerSession ? window.BeachOwnerSession.getBeachId() : null;

  console.log('🔍 loadReservationsFromServer: beachId =', beachId);

  if (!beachId) {
    if (window.BeachOwnerSession) {
      window.BeachOwnerSession.blockIfNoBeachAssigned('.container');
    }
    // Show a message instead of failing silently
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">'
        + '⚠️ No beach assigned to your account. Please contact the administrator.</td></tr>';
    }
    return;
  }

  console.log('🔍 Loading reservations for beach_id:', beachId);

  try {
    const response = await fetch(RES_MGMT_API_BASE + 'reservations.php?beach_id=' + encodeURIComponent(beachId));
    const result = await response.json();

    console.log('📥 Server response:', result);

    // Clear out any previously loaded rows/data before repopulating.
    Object.keys(reservationData).forEach(key => delete reservationData[key]);

    if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">'
          + '📭 No reservations yet. New online reservations will appear here for approval.</td></tr>';
      }
      return;
    }

    console.log(`✅ Found ${result.data.length} reservations`);

    result.data.forEach(r => {
      const id = String(r.reservation_id);
      reservationData[id] = {
        id: id,
        touristName: r.full_name || 'Unknown',
        email: r.email || 'No email',
        phone: r.contact_number || 'No phone',
        beach: r.beach_name || 'Unknown Beach',
        date: r.reservation_date || 'No date',
        time: formatEtaTime(r.eta_time) || 'Not specified',
        eta: formatEtaTime(r.eta_time),
        expirationTime: calculateExpirationTime(r.eta_time),
        visitors: r.num_visitors || 0,
        hometown: r.origin || '',
        status: dbStatusToUiStatus(r.status),
        accommodation: r.accommodation_type ? [r.accommodation_type] : [],
        createdAt: formatCreatedAt(r.created_at),
        rejectionReason: r.rejection_reason || '',
        // ----- Online Down Payment Processing fields -----
        paymentReference: r.payment_reference || '',
        proofOfPayment: r.proof_of_payment || '',
        paymentStatus: r.payment_status || 'Unpaid',
        amountPaid: (r.amount_paid !== null && r.amount_paid !== undefined && r.amount_paid !== '') ? r.amount_paid : null,
        paymentDate: r.payment_date || '',
        // Store raw data for debugging
        raw: r
      };
    });

    renderReservationsTable();
  } catch (error) {
    console.error('❌ Error loading reservations:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color: #e74c5e;">'
        + '❌ Could not load reservations. Please check your database connection and make sure XAMPP is running.</td></tr>';
    }
  }
}

// ===== BUILD THE TABLE FROM reservationData =====
function renderReservationsTable() {
  const tbody = document.getElementById('reservationsBody');
  const ids = Object.keys(reservationData);

  if (ids.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">'
      + '📭 No reservations yet. New online reservations will appear here for approval.</td></tr>';
    return;
  }

  console.log(`🔄 Rendering ${ids.length} reservations`);

  tbody.innerHTML = ids.map(id => {
    const data = reservationData[id];
    const statusClass = data.status === 'approved' ? 'confirmed' : data.status;
    const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);
    const actionsHtml = data.status === 'pending'
      ? `<button class="btn-sm btn-approve" onclick="approveReservation('${id}')"><i class="fas fa-check"></i> Approve</button>
         <button class="btn-sm btn-danger" onclick="rejectReservation('${id}')"><i class="fas fa-times"></i> Reject</button>
         <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>`
      : data.status === 'approved'
      ? `<button class="btn-sm btn-complete" onclick="completeReservation('${id}')"><i class="fas fa-flag-checkered"></i> Mark as Completed</button>
         <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>`
      : `<button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>`;

    return `
      <tr data-status="${data.status}" data-id="${id}">
        <td>${escapeHtml(data.touristName)}</td>
        <td>${escapeHtml(data.createdAt)}</td>
        <td>${data.visitors}</td>
        <td><span class="status ${statusClass}">${statusLabel}</span></td>
        <td>${actionsHtml}</td>
      </tr>
    `;
  }).join('');

  applyFilter();
}

// ===== ESCAPE HTML (Security) =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== PUSH A STATUS CHANGE TO THE DATABASE =====
async function updateReservationStatusInDatabase(id, newDbStatus, reason) {
  const body = { reservation_id: id, status: newDbStatus };
  if (typeof reason === 'string') {
    body.reason = reason;
  }
  const response = await fetch(RES_MGMT_API_BASE + 'reservations.php', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

// ===== CHECK FOR EXPIRED RESERVATIONS =====
function checkExpiredReservations() {
  // Intentionally a no-op until an expiration timestamp is tracked in MySQL.
}

setInterval(checkExpiredReservations, 60000);

// ===== CONFIRMATION MODAL =====
function showConfirmationModal(options) {
  const { title, message, confirmText, cancelText, onConfirm, onCancel, type = 'warning' } = options;
  
  const existing = document.querySelector('.confirmation-modal-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'confirmation-modal-overlay';
  overlay.innerHTML = `
    <div class="confirmation-modal glass-panel">
      <div class="confirmation-modal-icon ${type}">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-exclamation-circle'}"></i>
      </div>
      <h3 class="confirmation-modal-title">${escapeHtml(title)}</h3>
      <p class="confirmation-modal-message">${message}</p>
      <div class="confirmation-modal-actions">
        <button class="btn secondary confirmation-cancel">${escapeHtml(cancelText || 'Cancel')}</button>
        <button class="btn primary confirmation-confirm ${type}">${escapeHtml(confirmText || 'Confirm')}</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
  
  const cancelBtn = overlay.querySelector('.confirmation-cancel');
  const closeModal = () => {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
    }, 300);
  };
  
  cancelBtn.addEventListener('click', () => {
    closeModal();
    if (onCancel) onCancel();
  });
  
  const confirmBtn = overlay.querySelector('.confirmation-confirm');
  confirmBtn.addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
      if (onCancel) onCancel();
    }
  });
  
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ===== VIEW RESERVATION DETAILS =====
window.viewReservation = function(id) {
  const data = reservationData[id];
  if (!data) {
    showToast('Reservation not found', 'error');
    return;
  }

  const modal = document.getElementById('detailsModal');
  const statusEl = document.getElementById('detailsStatus');
  const body = document.getElementById('detailsBody');
  const actions = document.getElementById('detailsActions');

  statusEl.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
  statusEl.className = `status ${data.status === 'approved' ? 'confirmed' : data.status}`;

  const statusDisplay = data.status.charAt(0).toUpperCase() + data.status.slice(1);
  const accommodationHtml = data.accommodation.map(a => 
    `<span class="accommodation-tag">${escapeHtml(a)}</span>`
  ).join('');

  const isExpired = checkIfReservationExpired(data);
  const expirationStatus = isExpired ? 
    '<span style="color: #e74c5e; font-weight: 600;">⚠️ Expired</span>' : 
    '<span style="color: #2ed573; font-weight: 600;">Active</span>';

  body.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Tourist Name</span>
      <span class="detail-value">${escapeHtml(data.touristName)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Email</span>
      <span class="detail-value">${escapeHtml(data.email)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Phone</span>
      <span class="detail-value">${escapeHtml(data.phone)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Place of Origin</span>
      <span class="detail-value">${escapeHtml(data.hometown || 'Not specified')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Reservation Date</span>
      <span class="detail-value">${escapeHtml(data.date)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Estimated Time of Arrival (ETA)</span>
      <span class="detail-value">${escapeHtml(data.eta || 'Not specified')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Reservation Expiration Time</span>
      <span class="detail-value">${escapeHtml(data.expirationTime || 'Not specified')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Expiration Status</span>
      <span class="detail-value">${expirationStatus}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Packs</span>
      <span class="detail-value">${data.visitors}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Accommodation Type</span>
      <span class="detail-value"><div class="accommodation-tags">${accommodationHtml}</div></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Status</span>
      <span class="detail-value"><span class="status ${data.status === 'approved' ? 'confirmed' : data.status}">${statusDisplay}</span></span>
    </div>

    <div class="detail-section-heading"><i class="fas fa-wallet"></i> Payment Information</div>
    <div class="detail-row">
      <span class="detail-label">Payment Status</span>
      <span class="detail-value">${renderPaymentStatusBadge(data.paymentStatus)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Payment Reference Number</span>
      <span class="detail-value">${escapeHtml(data.paymentReference || 'Not provided')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Date &amp; Time of Payment</span>
      <span class="detail-value">${escapeHtml(formatPaymentDateTime(data.paymentDate))}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Proof of Payment</span>
      <span class="detail-value">${renderProofOfPayment(data.proofOfPayment)}</span>
    </div>
    ${data.status === 'cancelled' ? `
    <div class="detail-row">
      <span class="detail-label">Rejection Reason</span>
      <span class="detail-value">${escapeHtml(data.rejectionReason || 'Not specified')}</span>
    </div>` : ''}
  `;

  let actionsHtml = '';
  if (data.status === 'pending') {
    const isExpired = checkIfReservationExpired(data);
    if (isExpired) {
      actionsHtml = `
        <div class="expired-notice">
          <i class="fas fa-clock"></i> This reservation has expired and cannot be approved.
        </div>
        <button class="btn-sm btn-view" onclick="closeDetailsModal()">
          <i class="fas fa-times"></i> Close
        </button>
      `;
    } else {
      actionsHtml = `
        <button class="btn-sm btn-approve" onclick="approveReservation('${data.id}')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="btn-sm btn-danger" onclick="rejectReservation('${data.id}')">
          <i class="fas fa-times"></i> Reject
        </button>
        <button class="btn-sm btn-view" onclick="closeDetailsModal()">
          <i class="fas fa-times"></i> Close
        </button>
      `;
    }
  } else if (data.status === 'approved') {
    actionsHtml = `
      <button class="btn-sm btn-complete" onclick="completeReservation('${data.id}')">
        <i class="fas fa-flag-checkered"></i> Mark as Completed
      </button>
      <button class="btn-sm btn-view" onclick="closeDetailsModal()">
        <i class="fas fa-times"></i> Close
      </button>
    `;
  } else {
    actionsHtml = `
      <button class="btn-sm btn-view" onclick="closeDetailsModal()">
        <i class="fas fa-times"></i> Close
      </button>
    `;
  }
  actions.innerHTML = actionsHtml;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

// ===== CHECK IF RESERVATION IS EXPIRED =====
function checkIfReservationExpired(data) {
  if (data.status !== 'pending') return false;
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  if (data.date !== today) return false;
  if (!data.expirationTime) return false;
  
  const expirationParts = data.expirationTime.match(/(\d+):(\d+)\s*(AM|PM)/);
  if (!expirationParts) return false;
  
  let hours = parseInt(expirationParts[1]);
  const minutes = parseInt(expirationParts[2]);
  const ampm = expirationParts[3];
  
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  const expirationDate = new Date(now);
  expirationDate.setHours(hours, minutes, 0, 0);
  
  return now > expirationDate;
}

// ===== CLOSE DETAILS MODAL =====
window.closeDetailsModal = function() {
  const modal = document.getElementById('detailsModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
};

// ===== APPROVE RESERVATION =====
window.approveReservation = function(id) {
  const data = reservationData[id];
  if (!data) {
    showToast('Reservation not found', 'error');
    return;
  }

  if (data.status !== 'pending') {
    showToast(`This reservation is already ${data.status}`, 'warning');
    return;
  }

  if (checkIfReservationExpired(data)) {
    showToast(`Reservation #${id} has expired and cannot be approved.`, 'error');
    closeDetailsModal();
    return;
  }

  showConfirmationModal({
    title: 'Approve Reservation',
    message: `Are you sure you want to approve the reservation for <strong>${escapeHtml(data.touristName)}</strong>?<br><small>Reservation #${id} · ${data.visitors} packs</small>`,
    confirmText: 'Approve',
    cancelText: 'Cancel',
    type: 'success',
    onConfirm: async () => {
      try {
        const result = await updateReservationStatusInDatabase(id, 'Confirmed');
        if (!result.success) {
          showToast(result.message || 'Could not approve this reservation.', 'error');
          return;
        }
        data.status = 'approved';
        updateTableRow(id, 'approved');
        closeDetailsModal();
        showToast(`Reservation #${id} for ${data.touristName} has been approved! 🎉`, 'success');
        updateDashboardCounts();
        // Re-fetch from the database so this page - and every other module
        // reading the same reservations table - stays a true reflection of
        // the database rather than a locally-patched guess.
        loadReservationsFromServer();
      } catch (err) {
        console.error('Error approving reservation:', err);
        showToast('Could not reach the server. Please try again.', 'error');
      }
    }
  });
};

// ===== REJECT RESERVATION =====
window.rejectReservation = function(id) {
  const data = reservationData[id];
  if (!data) {
    showToast('Reservation not found', 'error');
    return;
  }

  if (data.status !== 'pending') {
    showToast(`This reservation is already ${data.status}`, 'warning');
    return;
  }

  showRejectReasonModal(data, async (reason) => {
    try {
      const result = await updateReservationStatusInDatabase(id, 'Cancelled', reason);
      if (!result.success) {
        showToast(result.message || 'Could not reject this reservation.', 'error');
        return;
      }
      data.status = 'cancelled';
      data.rejectionReason = reason;
      if (data.raw) data.raw.rejection_reason = reason;
      updateTableRow(id, 'cancelled');
      closeDetailsModal();
      showToast(`Reservation #${id} for ${data.touristName} has been rejected.`, 'error');
      updateDashboardCounts();
      // Re-fetch from the database so this page - and every other module
      // reading the same reservations table - stays a true reflection of
      // the database rather than a locally-patched guess.
      loadReservationsFromServer();
    } catch (err) {
      console.error('Error rejecting reservation:', err);
      showToast('Could not reach the server. Please try again.', 'error');
    }
  });
};

// ===== MARK RESERVATION AS COMPLETED =====
// Only available on an Approved (Confirmed) reservation. This is a manual
// confirmation by the Beach Owner that the tourist actually showed up and
// completed their visit - it is never triggered automatically just
// because the ETA/expiration time or reservation date has passed. If the
// tourist never arrived, use the existing expiration/no-show handling
// instead of Mark as Completed.
window.completeReservation = function(id) {
  const data = reservationData[id];
  if (!data) {
    showToast('Reservation not found', 'error');
    return;
  }

  if (data.status !== 'approved') {
    showToast(`This reservation is already ${data.status}`, 'warning');
    return;
  }

  showConfirmationModal({
    title: 'Mark as Completed',
    message: `Confirm that <strong>${escapeHtml(data.touristName)}</strong>'s visit has been completed?<br><small>Reservation #${id} · ${data.visitors} packs</small><br><small>Only do this after the tourist has actually visited.</small>`,
    confirmText: 'Mark as Completed',
    cancelText: 'Cancel',
    type: 'success',
    onConfirm: async () => {
      try {
        // Wait for the database to confirm the change before touching the
        // UI - never optimistically flip the status first.
        const result = await updateReservationStatusInDatabase(id, 'Completed');
        if (!result.success) {
          showToast(result.message || 'Could not mark this reservation as completed.', 'error');
          return;
        }
        data.status = 'completed';
        updateTableRow(id, 'completed');
        closeDetailsModal();
        showToast(`Reservation #${id} for ${data.touristName} has been marked as completed.`, 'success');
        updateDashboardCounts();
        // Re-fetch from the database so this page - and every other module
        // reading the same reservations table - stays a true reflection of
        // the database rather than a locally-patched guess.
        loadReservationsFromServer();
      } catch (err) {
        console.error('Error completing reservation:', err);
        showToast('Could not reach the server. Please try again.', 'error');
      }
    }
  });
};

// ===== REJECTION REASON MODAL =====
// A small variant of showConfirmationModal that adds a textarea so the
// Beach Owner can optionally explain why they're rejecting a reservation.
// That reason gets saved to the database and included in the "Reservation
// Update" email sent to the tourist.
function showRejectReasonModal(data, onConfirm) {
  const existing = document.querySelector('.confirmation-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'confirmation-modal-overlay';
  overlay.innerHTML = `
    <div class="confirmation-modal glass-panel">
      <div class="confirmation-modal-icon error">
        <i class="fas fa-times-circle"></i>
      </div>
      <h3 class="confirmation-modal-title">Reject Reservation</h3>
      <p class="confirmation-modal-message">
        Are you sure you want to reject the reservation for <strong>${escapeHtml(data.touristName)}</strong>?<br>
        <small>Reservation #${data.id} · ${data.visitors} packs</small>
      </p>
      <div style="text-align:left; margin: 12px 0 4px 0;">
        <label for="rejectReasonInput" style="display:block; font-size: 0.9em; font-weight:600; margin-bottom: 6px;">
          Reason (optional) - included in the tourist's email
        </label>
        <textarea id="rejectReasonInput" rows="3" placeholder="e.g. Fully booked for that date"
          style="width:100%; box-sizing:border-box; padding:10px; border-radius:8px; border:1px solid rgba(0,0,0,0.15); font-family:inherit; font-size:0.95em; resize:vertical;"></textarea>
      </div>
      <div class="confirmation-modal-actions">
        <button class="btn secondary confirmation-cancel">Cancel</button>
        <button class="btn primary confirmation-confirm error">Reject</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    overlay.classList.add('active');
    const textarea = overlay.querySelector('#rejectReasonInput');
    if (textarea) textarea.focus();
  });

  const closeModal = () => {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
    }, 300);
  };

  overlay.querySelector('.confirmation-cancel').addEventListener('click', closeModal);

  overlay.querySelector('.confirmation-confirm').addEventListener('click', () => {
    const textarea = overlay.querySelector('#rejectReasonInput');
    const reason = textarea ? textarea.value.trim() : '';
    closeModal();
    if (onConfirm) onConfirm(reason);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ===== UPDATE TABLE ROW =====
function updateTableRow(id, newStatus) {
  const rows = document.querySelectorAll('#reservationsBody tr');
  rows.forEach(row => {
    if (row.dataset.id === id) {
      const statusCell = row.querySelector('.status');
      if (statusCell) {
        const statusDisplay = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        statusCell.textContent = statusDisplay;
        statusCell.className = `status ${newStatus === 'approved' ? 'confirmed' : newStatus}`;
      }
      row.dataset.status = newStatus;
      
      const actions = row.querySelector('td:last-child');
      if (newStatus === 'pending') {
        actions.innerHTML = `
          <button class="btn-sm btn-approve" onclick="approveReservation('${id}')"><i class="fas fa-check"></i> Approve</button>
          <button class="btn-sm btn-danger" onclick="rejectReservation('${id}')"><i class="fas fa-times"></i> Reject</button>
          <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>
        `;
      } else if (newStatus === 'approved') {
        actions.innerHTML = `
          <button class="btn-sm btn-complete" onclick="completeReservation('${id}')"><i class="fas fa-flag-checkered"></i> Mark as Completed</button>
          <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>
        `;
      } else {
        actions.innerHTML = `
          <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>
        `;
      }
      
      applyFilter();
    }
  });
}

// ===== APPLY FILTER =====
function applyFilter() {
  const activeTab = document.querySelector('.filter-tab.active');
  if (!activeTab) return;
  const filter = activeTab.dataset.filter;
  const rows = document.querySelectorAll('#reservationsBody tr');
  let visibleCount = 0;
  
  rows.forEach(row => {
    if (filter === 'all' || row.dataset.status === filter) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });
  
  const emptyState = document.getElementById('emptyState');
  if (emptyState) {
    emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
  }
}

// ===== FILTER TABS =====
document.addEventListener('DOMContentLoaded', function() {
  loadReservationsFromServer();

  setInterval(function() {
    const detailsModalEl = document.getElementById('detailsModal');
    const modalIsOpen = detailsModalEl && detailsModalEl.classList.contains('active');
    if (!modalIsOpen) {
      loadReservationsFromServer();
    }
  }, 20000);

  window.addEventListener('focus', function() {
    const detailsModalEl = document.getElementById('detailsModal');
    const modalIsOpen = detailsModalEl && detailsModalEl.classList.contains('active');
    if (!modalIsOpen) {
      loadReservationsFromServer();
    }
  });

  const beachIdForName = window.BeachOwnerSession ? window.BeachOwnerSession.getBeachId() : null;
  if (beachIdForName) {
    fetch(RES_MGMT_API_BASE + 'get-beaches.php?id=' + encodeURIComponent(beachIdForName) + '&all=1')
      .then(res => res.json())
      .then(result => {
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
          window.BeachOwnerSession.applyBeachNameToUI(result.data[0].beach_name);
        }
      })
      .catch(err => console.error('Error loading beach name:', err));
  }

  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      filterTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      applyFilter();
    });
  });
  
  const searchInput = document.getElementById('searchReservation');
  if (searchInput) {
    searchInput.addEventListener('keyup', function() {
      const searchTerm = this.value.toLowerCase().trim();
      const rows = document.querySelectorAll('#reservationsBody tr');
      let visibleCount = 0;
      
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const dataId = row.dataset.id ? row.dataset.id.toLowerCase() : '';
        const matches = text.includes(searchTerm) || dataId.includes(searchTerm);
        
        const activeTab = document.querySelector('.filter-tab.active');
        const filter = activeTab ? activeTab.dataset.filter : 'all';
        const statusMatch = filter === 'all' || row.dataset.status === filter;
        
        if (matches && statusMatch) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });
      
      const emptyState = document.getElementById('emptyState');
      if (emptyState) {
        emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    });
  }
  
  const closeBtn = document.getElementById('closeDetailsModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDetailsModal);
  }
  
  const detailsModal = document.getElementById('detailsModal');
  if (detailsModal) {
    detailsModal.addEventListener('click', function(e) {
      if (e.target === detailsModal) {
        closeDetailsModal();
      }
    });
  }
  
  const logoutModal = document.getElementById('logoutModal');
  const cancelLogout = document.getElementById('cancelLogout');
  const confirmLogout = document.getElementById('confirmLogout');
  const logoutBtns = document.querySelectorAll('#logoutBtn2');
  
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (logoutModal) {
        logoutModal.classList.add('active');
      }
    });
  });
  
  if (cancelLogout) {
    cancelLogout.addEventListener('click', function() {
      logoutModal.classList.remove('active');
    });
  }
  
  if (confirmLogout) {
    confirmLogout.addEventListener('click', function() {
      logoutModal.classList.remove('active');
      showToast('You have been logged out successfully.', 'success');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 500);
    });
  }
  
  if (logoutModal) {
    logoutModal.addEventListener('click', function(e) {
      if (e.target === logoutModal) {
        logoutModal.classList.remove('active');
      }
    });
  }
  
  setTimeout(checkExpiredReservations, 1000);
});

// ===== TOAST NOTIFICATION =====
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconMap = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas ${iconMap[type] || 'fa-info-circle'}"></i>
    </div>
    <div class="toast-content">
      <span class="toast-message">${escapeHtml(message)}</span>
    </div>
    <button class="toast-close"><i class="fas fa-times"></i></button>
  `;
  
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  const timeout = setTimeout(() => {
    dismissToast(toast);
  }, 4000);
  
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    clearTimeout(timeout);
    dismissToast(toast);
  });
  
  toast.addEventListener('mouseenter', () => {
    clearTimeout(timeout);
  });
  
  toast.addEventListener('mouseleave', () => {
    setTimeout(() => {
      dismissToast(toast);
    }, 2000);
  });
}

function dismissToast(toast) {
  toast.classList.remove('show');
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 300);
}

// ===== UPDATE DASHBOARD COUNTS =====
function updateDashboardCounts() {
  console.log('📊 Dashboard counts updated');
}

// ===== SIDEBAR TOGGLE FOR MOBILE =====
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
  
  toggleBtn.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    const icon = this.querySelector('i');
    if (sidebar.classList.contains('open')) {
      icon.className = 'fas fa-times';
    } else {
      icon.className = 'fas fa-bars';
    }
  });
  
  document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768) {
      if (sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
          sidebar.classList.remove('open');
          const icon = toggleBtn.querySelector('i');
          if (icon) icon.className = 'fas fa-bars';
        }
      }
    }
  });
}

if (document.querySelector('.sidebar')) {
  addSidebarToggle();
}

function handleSidebarToggleVisibility() {
  const toggle = document.querySelector('.sidebar-toggle');
  if (!toggle) return;
  if (window.innerWidth <= 768) {
    toggle.style.display = 'flex';
  } else {
    toggle.style.display = 'none';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }
}

window.addEventListener('resize', handleSidebarToggleVisibility);
document.addEventListener('DOMContentLoaded', handleSidebarToggleVisibility);

console.log('📋 Reservation Management module loaded');