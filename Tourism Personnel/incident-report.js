// ========================================
// ===== TOURISM PERSONNEL: INCIDENT REPORT =====
// ========================================
// Reads real incident reports (submitted by Beach Owners via Incident
// Alert) from api/incidents.php, renders the table/stats/modal, and lets
// Tourism Personnel update an incident's status.

const INCIDENT_API_BASE = '../api/';

let incidentData = [];

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(INCIDENT_API_BASE + endpoint, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'API request failed');
        }
        return data;
    } catch (error) {
        console.error('Incident API error:', error);
        return { success: false, message: error.message };
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return '-';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
}

function statusClass(status) {
    if (status === 'Pending') return 'pending';
    if (status === 'Investigating') return 'investigating';
    if (status === 'Resolved') return 'resolved';
    return 'closed';
}

// Display-only label mapping. The database ENUM is unchanged
// (Pending / Investigating / Resolved / Closed); the Tourism Personnel UI
// simply shows "Under Review" wherever the stored value is "Investigating".
function statusLabel(status) {
    if (status === 'Investigating') return 'Under Review';
    return status;
}

function typeClass(type) {
    const map = {
        'Drowning': 'drowning',
        'Missing Person': 'missing',
        'Medical Emergency': 'medical',
        'Injury': 'injury',
        'Lost Property': 'property',
        'Other': 'other'
    };
    return map[type] || 'other';
}

// ========================================
// ===== FETCH INCIDENTS =====
// ========================================

async function fetchIncidents() {
    const search = document.getElementById('searchIncident')?.value || '';
    const type = document.getElementById('filterIncidentType')?.value || 'all';
    const status = document.getElementById('filterIncidentStatus')?.value || 'all';

    let endpoint = `incidents.php?search=${encodeURIComponent(search)}`;
    if (type !== 'all') endpoint += `&type=${encodeURIComponent(type)}`;
    if (status !== 'all') endpoint += `&status=${encodeURIComponent(status)}`;

    const result = await fetchAPI(endpoint);
    if (result.success) {
        incidentData = result.data || [];
        renderTable(incidentData);
        updateStats(incidentData);
    }
}

// ========================================
// ===== RENDER TABLE =====
// ========================================

function renderTable(incidents) {
    const tbody = document.getElementById('incidentTableBody');
    const noResults = document.getElementById('noResults');
    if (!tbody) return;

    if (!incidents || incidents.length === 0) {
        tbody.innerHTML = '';
        if (noResults) noResults.style.display = 'block';
        return;
    }
    if (noResults) noResults.style.display = 'none';

    tbody.innerHTML = incidents.map(i => `
        <tr>
            <td>${i.beach_name}</td>
            <td>${i.barangay ? 'Barangay ' + i.barangay : (i.location || '-')}</td>
            <td><span class="type-badge ${typeClass(i.incident_type)}">${i.incident_type}</span></td>
            <td>${formatDate(i.incident_date)}</td>
            <td>${formatTime(i.incident_time)}</td>
            <td>${i.reported_by || 'Beach Owner'}</td>
            <td><span class="status-badge ${statusClass(i.status)}">${statusLabel(i.status)}</span></td>
            <td><button class="btn-view-incident" onclick="openIncidentModal(${i.incident_id})"><i class="fas fa-eye"></i> View</button></td>
        </tr>
    `).join('');
}

// ========================================
// ===== STATS =====
// ========================================

function updateStats(incidents) {
    const total = incidents.length;
    const pending = incidents.filter(i => i.status === 'Pending').length;
    const investigating = incidents.filter(i => i.status === 'Investigating').length;
    const resolved = incidents.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('totalReports', total);
    setText('pendingReports', pending);
    setText('investigatingReports', investigating);
    setText('resolvedReports', resolved);
}

// ========================================
// ===== INCIDENT DETAILS MODAL =====
// ========================================

window.openIncidentModal = function (id) {
    const incident = incidentData.find(item => item.incident_id === id);
    if (!incident) return;

    const modal = document.getElementById('incidentModal');
    const title = document.getElementById('incidentModalTitle');
    const body = document.getElementById('incidentModalBody');
    if (!modal || !body) return;

    // Simplified View Details: show only the Incident Description and the
    // Update Status control. Beach, location, type, date, time, reported-by
    // and status are already visible in the incident list, so they are not
    // repeated here (keeps the view clean, simple and easy to read).
    title.textContent = 'Incident Details';

    // Only offer the simple status options (Pending / Under Review /
    // Resolved). "Under Review" maps to the stored ENUM value
    // "Investigating" so no database/API change is needed. If a record is
    // already "Closed" (legacy data), that option is added so the dropdown
    // still reflects the record's real current status.
    const isClosed = incident.status === 'Closed';
    body.innerHTML = `
        <div class="incident-detail-description"><span class="incident-detail-label">Incident Description</span><div class="incident-detail-value">${incident.description || 'No description provided'}</div></div>
        <div class="form-group" style="margin-top:18px;">
            <label for="incidentStatusSelect">Update Status</label>
            <select id="incidentStatusSelect" class="form-control">
                <option value="Pending" ${incident.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Investigating" ${incident.status === 'Investigating' ? 'selected' : ''}>Under Review</option>
                <option value="Resolved" ${incident.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                ${isClosed ? '<option value="Closed" selected>Closed</option>' : ''}
            </select>
        </div>
        <div class="form-actions" style="margin-top:16px; display:flex; gap:10px; justify-content:flex-end;">
            <button type="button" class="btn-primary" id="saveIncidentStatusBtn">Save Status</button>
        </div>
    `;

    document.getElementById('saveIncidentStatusBtn').addEventListener('click', function () {
        const newStatus = document.getElementById('incidentStatusSelect').value;
        updateIncidentStatus(id, newStatus);
    });

    modal.classList.add('active');
};

window.closeIncidentModal = function () {
    const modal = document.getElementById('incidentModal');
    if (modal) modal.classList.remove('active');
};

async function updateIncidentStatus(id, newStatus) {
    const result = await fetchAPI('incidents.php', {
        method: 'PUT',
        body: JSON.stringify({ incident_id: id, status: newStatus })
    });

    if (result.success) {
        closeIncidentModal();
        await fetchIncidents();
        showNotification(`Incident status updated to "${statusLabel(newStatus)}"`, 'success');
    } else {
        showNotification(result.message || 'Failed to update status', 'error');
    }
}

// ========================================
// ===== TOAST NOTIFICATION =====
// ========================================

function showNotification(message, type = 'success') {
    const existing = document.querySelector('.incident-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'incident-notification';
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: ${type === 'success' ? '#2ed573' : '#e74c5e'};
        color: #fff; padding: 14px 24px; border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15); z-index: 99999;
        max-width: 400px; font-family: 'Inter', sans-serif;
        display: flex; align-items: center; gap: 12px;
    `;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3500);
}

// ========================================
// ===== INIT =====
// ========================================

document.addEventListener('DOMContentLoaded', function () {
    fetchIncidents();

    const searchInput = document.getElementById('searchIncident');
    if (searchInput) searchInput.addEventListener('input', fetchIncidents);

    const typeFilter = document.getElementById('filterIncidentType');
    if (typeFilter) typeFilter.addEventListener('change', fetchIncidents);

    const statusFilter = document.getElementById('filterIncidentStatus');
    if (statusFilter) statusFilter.addEventListener('change', fetchIncidents);

    const closeBtn = document.getElementById('incidentModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeIncidentModal);

    const modal = document.getElementById('incidentModal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeIncidentModal();
        });
    }

    // Refresh periodically so newly submitted incidents show up without
    // requiring a manual page reload.
    setInterval(fetchIncidents, 30000);

    console.log('🚨 Incident Report (Tourism Personnel) ready');
});
