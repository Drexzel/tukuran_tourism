// ========================================
// ===== INCIDENT ALERT MODULE (BEACH OWNER) =====
// ========================================
// Submits incident reports to api/incidents.php for the Beach Owner's
// assigned beach (see beach-session.js), instead of the previous
// setTimeout-simulated submission with hardcoded beach info.

const INCIDENT_ALERT_API_BASE = '../api/';

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========================================
  // ===== DOM REFERENCES =====
  // ========================================

  const form = document.getElementById('incidentAlertForm');
  const incidentType = document.getElementById('incidentType');
  const incidentDate = document.getElementById('incidentDate');
  const incidentTime = document.getElementById('incidentTime');
  const incidentDescription = document.getElementById('incidentDescription');
  const alertSuccess = document.getElementById('alertSuccess');
  const submitAnotherBtn = document.getElementById('submitAnotherBtn');

  const successBeach = document.getElementById('successBeach');
  const successType = document.getElementById('successType');
  const successDateTime = document.getElementById('successDateTime');

  const owner = window.BeachOwnerSession ? window.BeachOwnerSession.getOwner() : null;
  const assignedBeachId = window.BeachOwnerSession ? window.BeachOwnerSession.getBeachId() : null;
  let assignedBeach = null;

  // ========================================
  // ===== POPULATE CURRENT DATE & TIME =====
  // ========================================

  function populateDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    if (incidentDate && !incidentDate.value) incidentDate.value = dateString;
    if (incidentTime && !incidentTime.value) incidentTime.value = timeString;
  }

  // ========================================
  // ===== LOAD ASSIGNED BEACH INFO =====
  // ========================================

  async function loadBeachInfo() {
    const beachNameEl = document.getElementById('alertBeachName');
    const ownerNameEl = document.getElementById('alertOwnerName');
    const beachLocationEl = document.getElementById('alertBeachLocation');

    if (ownerNameEl && owner) ownerNameEl.textContent = owner.owner_name || owner.username || 'Beach Owner';

    if (!assignedBeachId) {
      if (beachNameEl) beachNameEl.textContent = 'No beach assigned';
      if (beachLocationEl) beachLocationEl.textContent = 'Contact the Tourism Office to get a beach linked to your account.';
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
      }
      return;
    }

    try {
      const response = await fetch(INCIDENT_ALERT_API_BASE + 'get-beaches.php?id=' + encodeURIComponent(assignedBeachId) + '&all=1');
      const result = await response.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        assignedBeach = result.data[0];
        if (beachNameEl) beachNameEl.textContent = assignedBeach.beach_name;
        if (beachLocationEl) {
          const barangay = assignedBeach.barangay || assignedBeach.location || '';
          beachLocationEl.textContent = barangay ? `Barangay ${barangay}, Tukuran` : 'Tukuran';
        }
        window.BeachOwnerSession && window.BeachOwnerSession.applyBeachNameToUI(assignedBeach.beach_name);
      }
    } catch (error) {
      console.error('Error loading assigned beach info:', error);
    }
  }

  // ========================================
  // ===== MY SUBMITTED INCIDENTS (STATUS FROM TOURISM OFFICE) =====
  // ========================================
  // Reads this beach's incidents from api/incidents.php (filtered by the
  // owner's assigned beach_id) and shows their current status. The status
  // is set by the Tourism Personnel; "Investigating" is shown as
  // "Under Review" to match the simplified status labels. Refreshed on load,
  // after each submission, and on an interval so updates appear automatically.

  function ownerStatusClass(status) {
    if (status === 'Pending') return 'pending';
    if (status === 'Investigating') return 'investigating';
    if (status === 'Resolved') return 'resolved';
    return 'closed';
  }
  function ownerStatusLabel(status) {
    if (status === 'Investigating') return 'Under Review';
    return status || 'Pending';
  }
  function ownerFormatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function ownerFormatTime(timeStr) {
    if (!timeStr) return '-';
    const parts = String(timeStr).split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  async function loadOwnerIncidents() {
    const tbody = document.getElementById('ownerIncidentTableBody');
    const empty = document.getElementById('ownerIncidentsEmpty');
    if (!tbody || !assignedBeachId) return;

    try {
      const response = await fetch(INCIDENT_ALERT_API_BASE + 'incidents.php?beach_id=' + encodeURIComponent(assignedBeachId));
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) return;

      if (result.data.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }
      if (empty) empty.style.display = 'none';

      tbody.innerHTML = result.data.map(i => `
        <tr>
          <td>${i.incident_type || '-'}</td>
          <td>${ownerFormatDate(i.incident_date)}</td>
          <td>${ownerFormatTime(i.incident_time)}</td>
          <td><span class="owner-status-badge ${ownerStatusClass(i.status)}">${ownerStatusLabel(i.status)}</span></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading submitted incidents:', error);
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
      if (!validateField(incidentType, 'typeError', incidentType.value && incidentType.value !== '')) isValid = false;
      if (!validateField(incidentDate, 'dateError', incidentDate.value && incidentDate.value !== '')) isValid = false;
      if (!validateField(incidentTime, 'timeError', incidentTime.value && incidentTime.value !== '')) isValid = false;
      if (!validateField(incidentDescription, 'descriptionError', incidentDescription.value && incidentDescription.value.trim().length >= 10)) isValid = false;

      if (!isValid) {
        const firstError = form.querySelector('.form-control.error');
        if (firstError) firstError.focus();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Alert...';
      submitBtn.disabled = true;

      const type = incidentType.value;
      const date = incidentDate.value;
      const time = incidentTime.value;
      const description = incidentDescription.value.trim();

      try {
        const response = await fetch(INCIDENT_ALERT_API_BASE + 'incidents.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beach_id: assignedBeachId,
            reported_by: owner ? (owner.owner_name || owner.username) : 'Beach Owner',
            incident_type: type,
            incident_date: date,
            incident_time: time,
            description: description
          })
        });
        const result = await response.json();

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        if (!result.success) {
          showNotification(result.message || 'Could not send this alert.', 'error');
          return;
        }

        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        const beachName = assignedBeach ? assignedBeach.beach_name : 'Your beach';
        if (successBeach) successBeach.textContent = beachName;
        if (successType) successType.textContent = type;
        if (successDateTime) successDateTime.textContent = `${formattedDate} ${time}`;

        form.style.display = 'none';
        alertSuccess.style.display = 'block';

        const card = document.querySelector('.alert-form-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });

        showNotification('Incident alert sent successfully!', 'success');
        loadOwnerIncidents();
      } catch (error) {
        console.error('Error submitting incident alert:', error);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        showNotification('Could not reach the server. Please make sure the backend/MySQL is running.', 'error');
      }
    });
  }

  // ========================================
  // ===== REAL-TIME VALIDATION =====
  // ========================================

  if (incidentType) {
    incidentType.addEventListener('change', function() {
      if (this.value) { hideError('typeError'); this.classList.remove('error'); }
    });
  }
  if (incidentDate) {
    incidentDate.addEventListener('change', function() {
      if (this.value) { hideError('dateError'); this.classList.remove('error'); }
    });
  }
  if (incidentTime) {
    incidentTime.addEventListener('change', function() {
      if (this.value) { hideError('timeError'); this.classList.remove('error'); }
    });
  }
  if (incidentDescription) {
    incidentDescription.addEventListener('input', function() {
      if (this.value && this.value.trim().length >= 10) { hideError('descriptionError'); this.classList.remove('error'); }
    });
  }

  // ========================================
  // ===== SUBMIT ANOTHER ALERT =====
  // ========================================

  if (submitAnotherBtn) {
    submitAnotherBtn.addEventListener('click', function() {
      form.reset();
      form.style.display = 'block';
      alertSuccess.style.display = 'none';
      populateDateTime();
      document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
      document.querySelectorAll('.error-message.visible').forEach(el => el.classList.remove('visible'));
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (incidentType) incidentType.focus();
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
        populateDateTime();
        document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
        document.querySelectorAll('.error-message.visible').forEach(el => el.classList.remove('visible'));
      }
    });
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
      max-width: 400px; animation: slideInRight 0.4s ease;
      font-family: 'Inter', sans-serif; display: flex; align-items: center; gap: 12px;
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
  // ===== LOGOUT FUNCTIONALITY =====
  // ========================================

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentRole');
      window.location.href = '../Log-in page/login.html';
    });
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
  populateDateTime();
  loadOwnerIncidents();

  // Auto-refresh so status changes made by the Tourism Office (e.g. moving a
  // report to Under Review or Resolved) show up here without a manual reload.
  setInterval(loadOwnerIncidents, 20000);

  console.log('🚨 Incident Alert module ready (scoped to assigned beach)');
});
