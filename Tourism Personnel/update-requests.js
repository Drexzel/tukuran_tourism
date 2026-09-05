// ========================================
// ===== TOURISM PERSONNEL: UPDATE REQUESTS =====
// ========================================
// Lists the update requests submitted by Beach Owners (e.g. update GCash
// number, add an accommodation/amenity, update the entrance fee, general
// beach-info update) and lets Tourism Personnel review, edit the beach
// info, and approve or reject each request.

const UPDATE_REQ_API_BASE = '../api/';

let allRequests = [];
let currentRequest = null;

// ===== LOAD REQUESTS =====
async function fetchRequests() {
    const tbody = document.getElementById('requestsBody');
    // The status filter dropdown was removed for a simpler, cleaner layout.
    // The page keeps its original default view - the pending requests queue
    // that Tourism Personnel need to review, approve, or reject.
    const status = 'Pending';

    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Loading requests...</td></tr>';
    }

    try {
        let url = UPDATE_REQ_API_BASE + 'update-requests.php';
        if (status) url += '?status=' + encodeURIComponent(status);

        const res = await fetch(url);
        const result = await res.json();

        if (!result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Could not load requests');
        }

        allRequests = result.data;
        renderRequests(allRequests);
    } catch (err) {
        console.error('Error loading update requests:', err);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Could not load requests.</td></tr>';
        }
    }
}

function renderRequests(requests) {
    const tbody = document.getElementById('requestsBody');
    if (!tbody) return;

    if (!requests.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">No requests found.</td></tr>';
        return;
    }

    // Simplified table: only Beach, Requested By, Date Submitted, and View.
    // Request #, Type, Details, and Status remain available inside the View
    // modal, where the full request can be reviewed, approved, or rejected.
    tbody.innerHTML = requests.map(function (r) {
        const beach = r.beach_name_live || r.beach_name || '—';
        return '<tr>'
            + '<td>' + escapeHtmlUR(beach) + '</td>'
            + '<td>' + escapeHtmlUR(r.owner_name || '—') + '</td>'
            + '<td>' + escapeHtmlUR(formatDateUR(r.created_at)) + '</td>'
            + '<td><button class="btn-secondary btn-sm" onclick="openRequestModal(' + parseInt(r.request_id, 10) + ')">View</button></td>'
            + '</tr>';
    }).join('');
}

// ===== REQUEST DETAILS MODAL =====
window.openRequestModal = function (requestId) {
    const request = allRequests.find(function (r) {
        return parseInt(r.request_id, 10) === parseInt(requestId, 10);
    });
    if (!request) return;

    currentRequest = request;

    const modal = document.getElementById('requestModal');
    const title = document.getElementById('requestModalTitle');
    const body = document.getElementById('requestModalBody');
    const noteEl = document.getElementById('adminNote');
    if (!modal || !body) return;

    const beach = request.beach_name_live || request.beach_name || '—';
    if (title) title.textContent = request.request_type + ' · ' + beach;

    body.innerHTML =
        '<div class="detail-row"><span class="detail-label">Request #</span>'
      + '<span class="detail-value">' + escapeHtmlUR(String(request.request_id)) + '</span></div>'
      + '<div class="detail-row"><span class="detail-label">Beach</span>'
      + '<span class="detail-value">' + escapeHtmlUR(beach) + '</span></div>'
      + '<div class="detail-row"><span class="detail-label">Requested By</span>'
      + '<span class="detail-value">' + escapeHtmlUR(request.owner_name || '—') + '</span></div>'
      + '<div class="detail-row"><span class="detail-label">Request Type</span>'
      + '<span class="detail-value">' + escapeHtmlUR(request.request_type || '') + '</span></div>'
      + '<div class="detail-row"><span class="detail-label">Details</span>'
      + '<span class="detail-value">' + escapeHtmlUR(request.details || '') + '</span></div>'
      + '<div class="detail-row"><span class="detail-label">Status</span>'
      + '<span class="detail-value">' + statusBadgeUR(request.status) + '</span></div>'
      + '<div class="detail-row"><span class="detail-label">Date Submitted</span>'
      + '<span class="detail-value">' + escapeHtmlUR(formatDateUR(request.created_at)) + '</span></div>';

    if (noteEl) noteEl.value = request.admin_note || '';

    // The Edit Beach Info button deep-links into Beach Management's edit
    // form for this beach, where the approved change is actually applied.
    const editBtn = document.getElementById('editBeachBtn');
    if (editBtn) {
        if (request.beach_id) {
            editBtn.style.display = '';
            editBtn.onclick = function () {
                window.location.href = 'beach-management.html?edit_beach=' + encodeURIComponent(request.beach_id);
            };
        } else {
            editBtn.style.display = 'none';
        }
    }

    // Already-decided requests only need to be readable.
    const approveBtn = document.getElementById('approveRequestBtn');
    const rejectBtn = document.getElementById('rejectRequestBtn');
    const isPending = (request.status || 'Pending') === 'Pending';
    if (approveBtn) approveBtn.style.display = isPending ? '' : 'none';
    if (rejectBtn) rejectBtn.style.display = isPending ? '' : 'none';

    modal.classList.add('active');
};

window.closeRequestModal = function () {
    const modal = document.getElementById('requestModal');
    if (modal) modal.classList.remove('active');
    currentRequest = null;
};

// ===== APPROVE / REJECT =====
async function setRequestStatus(newStatus) {
    if (!currentRequest) return;

    const noteEl = document.getElementById('adminNote');
    const note = noteEl ? noteEl.value.trim() : '';

    try {
        const res = await fetch(UPDATE_REQ_API_BASE + 'update-requests.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                request_id: currentRequest.request_id,
                status: newStatus,
                admin_note: note
            })
        });
        const result = await res.json();

        if (result.success) {
            showNotificationUR('Request ' + newStatus.toLowerCase() + '.', 'success');
            closeRequestModal();
            fetchRequests();
        } else {
            showNotificationUR(result.message || 'Could not update the request.', 'error');
        }
    } catch (err) {
        console.error('Error updating request:', err);
        showNotificationUR('Could not update the request. Please try again.', 'error');
    }
}

// ===== HELPERS =====
function truncate(text, max) {
    const s = String(text);
    return s.length > max ? s.slice(0, max) + '…' : s;
}

function statusBadgeUR(status) {
    const s = status || 'Pending';
    let color = '#f59e0b';
    if (s === 'Approved') color = '#2ed573';
    else if (s === 'Rejected') color = '#e74c5e';
    return '<span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.82em; '
        + 'font-weight:600; color:#fff; background:' + color + ';">' + escapeHtmlUR(s) + '</span>';
}

function formatDateUR(value) {
    if (!value) return '—';
    const d = new Date(String(value).replace(' ', 'T'));
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function escapeHtmlUR(text) {
    const div = document.createElement('div');
    div.textContent = text === null || text === undefined ? '' : String(text);
    return div.innerHTML;
}

function showNotificationUR(message, type) {
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
    notification.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-info-circle') + '"></i>'
        + '<span>' + escapeHtmlUR(message) + '</span>';
    document.body.appendChild(notification);

    setTimeout(function () {
        if (notification.parentNode) notification.remove();
    }, 4000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    fetchRequests();

    const closeBtn = document.getElementById('requestModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeRequestModal);

    const modal = document.getElementById('requestModal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeRequestModal();
        });
    }

    const approveBtn = document.getElementById('approveRequestBtn');
    if (approveBtn) approveBtn.addEventListener('click', function () { setRequestStatus('Approved'); });

    const rejectBtn = document.getElementById('rejectRequestBtn');
    if (rejectBtn) rejectBtn.addEventListener('click', function () { setRequestStatus('Rejected'); });
});
