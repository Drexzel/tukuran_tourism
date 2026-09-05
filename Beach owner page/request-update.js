// ========================================
// ===== BEACH OWNER: REQUEST UPDATE =====
// ========================================
// Lets the Beach Owner send an update request to the Tourism Office
// (e.g. update GCash number, add an accommodation/amenity, update the
// entrance fee, or a general beach-info update) and track its status.
// The request appears in the Tourism Personnel "Update Requests" page.

const REQ_UPDATE_API_BASE = '../api/';

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const session = window.BeachOwnerSession;
  const owner = session ? session.getOwner() : null;
  const beachId = session ? session.getBeachId() : null;

  const form = document.getElementById('requestForm');
  const typeEl = document.getElementById('requestType');
  const detailsEl = document.getElementById('requestDetails');
  const submitBtn = document.getElementById('submitRequestBtn');
  const tbody = document.getElementById('requestsBody');

  let beachName = '';

  // ===== LOAD THE OWNER'S ASSIGNED BEACH (for the sidebar + request record) =====
  async function loadAssignedBeach() {
    if (!beachId) {
      // Keep the page usable but make the situation clear, matching how the
      // other owner modules behave when no beach is linked yet.
      if (submitBtn) submitBtn.disabled = true;
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">'
          + 'Your account is not linked to a beach yet. Please contact the Tourism Office.</td></tr>';
      }
      return;
    }
    try {
      const res = await fetch(REQ_UPDATE_API_BASE + 'get-beaches.php?id=' + encodeURIComponent(beachId) + '&all=1');
      const result = await res.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        beachName = result.data[0].beach_name || '';
        if (session) session.applyBeachNameToUI(beachName);
      }
    } catch (err) {
      console.error('Error loading assigned beach:', err);
    }
  }

  // ===== LOAD THIS BEACH'S REQUESTS =====
  async function loadRequests() {
    if (!beachId || !tbody) return;
    try {
      const res = await fetch(REQ_UPDATE_API_BASE + 'update-requests.php?beach_id=' + encodeURIComponent(beachId));
      const result = await res.json();

      if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">No requests submitted yet.</td></tr>';
        return;
      }

      tbody.innerHTML = result.data.map(function (r) {
        return '<tr>'
          + '<td>#' + escapeHtmlReq(String(r.request_id)) + '</td>'
          + '<td>' + escapeHtmlReq(r.request_type || '') + '</td>'
          + '<td>' + escapeHtmlReq(r.details || '') + '</td>'
          + '<td>' + statusBadge(r.status) + '</td>'
          + '<td>' + escapeHtmlReq(r.admin_note || '—') + '</td>'
          + '<td>' + escapeHtmlReq(formatDate(r.created_at)) + '</td>'
          + '</tr>';
      }).join('');
    } catch (err) {
      console.error('Error loading requests:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">Could not load your requests.</td></tr>';
    }
  }

  // ===== SUBMIT A NEW REQUEST =====
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      let valid = true;
      if (!typeEl.value) {
        showErrorReq('requestTypeError'); typeEl.classList.add('error'); valid = false;
      } else {
        hideErrorReq('requestTypeError'); typeEl.classList.remove('error');
      }
      if (!detailsEl.value.trim()) {
        showErrorReq('requestDetailsError'); detailsEl.classList.add('error'); valid = false;
      } else {
        hideErrorReq('requestDetailsError'); detailsEl.classList.remove('error');
      }
      if (!valid) return;

      if (!beachId) {
        showNotificationReq('Your account is not linked to a beach yet. Please contact the Tourism Office.', 'error');
        return;
      }

      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending... <i class="fas fa-spinner fa-spin"></i>';

      try {
        const res = await fetch(REQ_UPDATE_API_BASE + 'update-requests.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beach_id: beachId,
            owner_id: owner ? (owner.owner_id || null) : null,
            owner_name: owner ? (owner.owner_name || owner.username || '') : '',
            beach_name: beachName,
            request_type: typeEl.value,
            details: detailsEl.value.trim()
          })
        });
        const result = await res.json();

        if (result.success) {
          showNotificationReq(result.message || 'Your request has been sent to the Tourism Office.', 'success');
          form.reset();
          loadRequests();
        } else {
          showNotificationReq(result.message || 'Could not send your request.', 'error');
        }
      } catch (err) {
        console.error('Error sending request:', err);
        showNotificationReq('Could not send your request. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // ===== HELPERS =====
  function statusBadge(status) {
    const s = status || 'Pending';
    let color = '#f59e0b'; // pending
    if (s === 'Approved') color = '#2ed573';
    else if (s === 'Rejected') color = '#e74c5e';
    return '<span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.82em; '
      + 'font-weight:600; color:#fff; background:' + color + ';">' + escapeHtmlReq(s) + '</span>';
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(String(value).replace(' ', 'T'));
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function showErrorReq(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('visible');
  }
  function hideErrorReq(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  }

  function escapeHtmlReq(text) {
    const div = document.createElement('div');
    div.textContent = text === null || text === undefined ? '' : String(text);
    return div.innerHTML;
  }

  function showNotificationReq(message, type) {
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
      <span>${escapeHtmlReq(message)}</span>
      <button style="background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;margin-left:auto;padding:0 4px;">&times;</button>
    `;
    notification.querySelector('button').addEventListener('click', () => notification.remove());
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

  // ===== INIT =====
  loadAssignedBeach().then(loadRequests);
});
