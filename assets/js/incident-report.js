// ========================================
// ===== API HELPER =====
// ========================================

const API_BASE = '/api';

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'API request failed');
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: error.message };
    }
}

// ========================================
// ===== FETCH INCIDENTS =====
// ========================================

let incidentData = [];

async function fetchIncidents() {
    try {
        const search = document.getElementById('searchIncident')?.value || '';
        const type = document.getElementById('filterIncidentType')?.value || 'all';
        const status = document.getElementById('filterIncidentStatus')?.value || 'all';
        
        let url = `/incidents.php?search=${encodeURIComponent(search)}`;
        if (type !== 'all') url += `&type=${encodeURIComponent(type)}`;
        if (status !== 'all') url += `&status=${encodeURIComponent(status)}`;
        
        const data = await fetchAPI(url);
        if (data.success) {
            incidentData = data.data;
            renderTable(incidentData);
            updateStats();
        }
    } catch (error) {
        console.error('Error fetching incidents:', error);
    }
}

// ========================================
// ===== UPDATE INCIDENT STATUS =====
// ========================================

window.updateIncidentStatus = async function(id, newStatus) {
    const incident = incidentData.find(item => item.incident_id === id);
    if (!incident) return;

    if (confirm(`Change status of "${incident.beach_name}" to "${newStatus}"?`)) {
        try {
            const data = await fetchAPI('/incidents.php', {
                method: 'PUT',
                body: JSON.stringify({
                    incident_id: id,
                    status: newStatus
                })
            });
            
            if (data.success) {
                closeIncidentModal();
                await fetchIncidents(); // Refresh the list
                showNotification(`Incident status updated to "${newStatus}"`, 'success');
            } else {
                showNotification(data.message || 'Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Error updating incident:', error);
            showNotification('Error updating incident status', 'error');
        }
    }
};

// Call on page load
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    fetchIncidents();
    // ... rest of initialization ...
});