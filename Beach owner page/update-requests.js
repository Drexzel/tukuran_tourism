// ========================================
// ===== UPDATE REQUESTS MODULE (BEACH OWNER) =====
// ========================================
// Lets the Beach Owner send a "Request Update" to Tourism Personnel
// (api/beach-requests.php) - e.g. update GCash number, add a new
// accommodation/amenity, update the entrance fee, or a general beach
// info update - and shows the status of requests they've already sent.

const UPDATE_REQUEST_API_BASE = '../api/';

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========================================
  // ===== DOM REFERENCES =====
  // ========================================

  const form = document.getElementById('updateRequestForm');
  const requestType = document.getElementById('requestType');
  const requestValue = document.getElementById('requestValue');
  const requestDetails = document.getElementById('requestDetails');
  const requestSuccess = document.getElementById('requestSuccess');
  const submitAnotherBtn = document.getElementById('submitAnotherRequestBtn');

  const owner = window.BeachOwnerSession ? window.BeachOwnerSession.getOwner() : null;
  const assignedBeachId = window.BeachOwnerSession ? window.BeachOwnerSession.getBeachId() : null;
  let assignedBeach = null;

  const requestTypeLabels = {
    gcash_number: 'Update GCash Number',
    gcash_name: 'Update GCash Account Name',
    accommodation: 'Add New Accommodation',
    amenity: 'Add New Amenity',
    entrance_fee: 'Update Entrance Fee',
    beach_info: 'Request Beach Information Update',
    other: 'Other'
  };

  // ========================================
  // ===== LOAD ASSIGNED BEACH INFO =====
  // ========================================

  async function loadBeachInfo() {
    const beachNameEl = document.getElementById('requestBeachName');
    const ownerNameEl = document.getElementById('requestOwnerName');

    if (ownerNameEl && owner) ownerNameEl.textContent = owner.owner_name || owner.username || 'Beach Owner';

    if (!assignedBeachId) {
      if (beachNameEl) beachNameEl.textContent = 'No beach assigned';
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
      }
      return;
    }

    try {
      const response = await fetch(UPDATE_REQUEST_API_BASE + 'get-beaches.php?id=' + encodeURIComponent(assignedBeachId) + '&all=1');
      const result = await response.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        assignedBeach = result.data[0];
        if (beachNameEl) beachNameEl.textContent = assignedBeach.beach_name;
        window.BeachOwnerSession && window.BeachOwnerSession.applyBeachNameToUI(assignedBeach.beach_name);
      }
    } catch (error) {
      console.error('Error loading assigned beach info:', error);
    }
  }

  // ========================================
  // ===== VALIDATION HELPERS =====
  // ========================================

  function showError(errorId) {
    const el = document.getElementById(errorId);
    if (el) el.classList.add('visible');
  }
  function hideError(errorId) {
    const el = document.getElementById(errorId);
    if (el) el.classList.remove('visible');
  }
  function validateField(input, errorId, condition) {
    if (condition) {
      hideError(errorId);
      input.classList.remove('error');
      return true;
    }
    showError(errorId);
    input.classList.add('error');
    return false;
  }

  // ========================================
  // ===== FORM SUBMISSION =====
  // ========================================

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      if (!assignedBeachId) {
        alert('Your account is not linked to a beach yet. Please contact the Tourism Office.');
        return;
      }

      let isValid = true;
      if (!validateField(requestType, 'requestTypeError', requestType.value && requestType.value !== '')) isValid = false;
      if (!validateField(requestDetails, 'requestDetailsError', requestDetails.value && requestDetails.value.trim().length >= 5)) isValid = false;

      if (!isValid) {
        const firstError = form.querySelector('.form-control.error');
        if (firstError) firstError.focus();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Request...';
      submitBtn.disabled = true;

      const type = requestType.value;
      const value = requestValue.value.trim();
      const details = requestDetails.value.trim();
      const title = requestTypeLabels[type] || 'Beach Update Request';

      try {
        const response = await fetch(UPDATE_REQUEST_API_BASE + 'beach-requests.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beach_id: assignedBeachId,
            owner_id: owner ? owner.owner_id : null,
            request_type: type,
            title: title,
            details: details,
            requested_value: value
          })
        });
        const result = await response.json();

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        if (!result.success) {
          showNotification(result.message || 'Could not send this request.', 'error');
          return;
        }

        form.style.display = 'none';
        requestSuccess.style.display = 'block';

        const card = document.querySelector('.alert-form-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });

        showNotification('Request sent successfully!', 'success');
        loadMyRequests();
      } catch (error) {
        console.error('Error submitting update request:', error);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        showNotification('Could not reach the server. Please make sure the backend/MySQL is running.', 'error');
      }
    });
  }

  // ========================================
  // ===== REAL-TIME VALIDATION =====
  // ========================================

  if (requestType) {
    requestType.addEventListener('change', function() {
      if (this.value) { hideError('requestTypeError'); this.classList.remove('error'); }
    });
  }
  if (requestDetails) {
    requestDetails.addEventListener('input', function() {
      if (this.value && this.value.trim().length >= 5) { hideError('requestDetailsError'); this.classList.remove('error'); }
    });
  }

  // ========================================
  // ===== SEND ANOTHER REQUEST =====
  // ========================================

  if (submitAnotherBtn) {
    submitAnotherBtn.addEventListener('click', function() {
      form.reset();
      form.style.display = 'block';
      requestSuccess.style.display = 'none';
      document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
      document.querySelectorAll('.error-message.visible').forEach(el => el.classList.remove('visible'));
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (requestType) requestType.focus();
    });
  }

  // ========================================
  // ===== CLEAR FORM BUTTON =====
  // ========================================

  const clearBtn = form ? form.querySelector('button[type="reset"]') : null;
  if (clearBtn) {
    clearBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm('Are you sure you want to clear the form? All entered data will be lost.')) {
        form.reset();
        document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
        document.querySelectorAll('.error-message.visible').forEach(el => el.classList.remove('visible'));
      }
    });
  }

  // ========================================
  // ===== MY REQUESTS (STATUS TABLE) =====
  // ========================================

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(String(dateStr).replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function statusClass(status) {
    if (status === 'Approved') return 'confirmed';
    if (status === 'Rejected') return 'cancelled';
    return 'pending';
  }

  async function loadMyRequests() {
    const tbody = document.getElementById('myRequestsBody');
    const emptyState = document.getElementById('myRequestsEmpty');
    if (!tbody) return;

    if (!assignedBeachId) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    try {
      const response = await fetch(UPDATE_REQUEST_API_BASE + 'beach-requests.php?beach_id=' + encodeURIComponent(assignedBeachId));
      const result = await response.json();

      if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }
      if (emptyState) emptyState.style.display = 'none';

      tbody.innerHTML = result.data.map(r => `
        <tr>
          <td>${formatDate(r.created_at)}</td>
          <td>${escapeHtml(r.title || requestTypeLabels[r.request_type] || 'Request')}</td>
          <td><div class="request-details-cell">${escapeHtml(r.details || '-')}${r.requested_value ? '<br><strong>New value:</strong> ' + escapeHtml(r.requested_value) : ''}</div></td>
          <td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td>
          <td><div class="admin-notes-cell">${escapeHtml(r.admin_notes || '-')}</div></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading my requests:', error);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#e74c5e;">Could not load your requests.</td></tr>';
    }
  }

  // ========================================
  // ===== NOTIFICATION SYSTEM =====
  // ========================================

  function showNotification(message, type = 'success') {
    const existing = document.querySelector('.alert-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'alert-notification';
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: ${type === 'success' ? '#2ed573' : '#e74c5e'};
      color: #fff; padding: 14px 24px; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15); z-index: 99999;
      max-width: 400px; font-family: 'Inter', sans-serif;
      display: flex; align-items: center; gap: 12px;
    `;
    notification.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
      <span>${message}</span>
      <button style="background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;margin-left:auto;padding:0 4px;">&times;</button>
    `;
    const closeBtn = notification.querySelector('button');
    closeBtn.addEventListener('click', () => notification.remove());
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }
    }, 4000);
  }

  // ========================================
  // ===== SIDEBAR TOGGLE =====
  // ========================================

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
      icon.className = sidebar.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
    });

    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
          sidebar.classList.remove('open');
          const icon = toggleBtn.querySelector('i');
          if (icon) icon.className = 'fas fa-bars';
        }
      }
    });
  }

  if (document.querySelector('.sidebar')) addSidebarToggle();

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
  handleSidebarToggleVisibility();

  // ========================================
  // ===== INITIALIZE =====
  // ========================================

  loadBeachInfo();
  loadMyRequests();
  setInterval(loadMyRequests, 30000);

  console.log('📨 Update Requests module ready (scoped to assigned beach)');
});
