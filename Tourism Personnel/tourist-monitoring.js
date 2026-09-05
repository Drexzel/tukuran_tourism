// ========================================
// ===== TOURIST MONITORING (VISITOR RECORDS) =====
// ========================================
// Loads real visitor records from the database (api/tourist-monitoring.php),
// which combines every APPROVED reservation with every walk-in
// registration, across all beaches - instead of the hardcoded sample rows
// this page used to show. Filters re-query the database, and the table
// polls periodically (and refreshes on tab focus) so a reservation the
// Beach Owner just approved, or a new walk-in just registered, appears
// here automatically.

const TOURIST_MONITORING_API_BASE = '../api/';
const TOURIST_MONITORING_POLL_INTERVAL_MS = 30000; // 30 seconds

function formatVisitDate(dateStr) {
  if (!dateStr) return 'Not specified';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildTouristMonitoringQuery() {
  // Only the Visitor Type filter remains; the search, gender and origin
  // filters were removed from this view.
  const type = document.getElementById('filterType')?.value || '';

  const params = new URLSearchParams();
  if (type) params.set('type', type);
  return params.toString();
}

async function loadTouristRecords() {
  const tbody = document.getElementById('touristRecordsBody');
  const emptyState = document.getElementById('touristRecordsEmptyState');
  if (!tbody) return;

  try {
    const query = buildTouristMonitoringQuery();
    const response = await fetch(TOURIST_MONITORING_API_BASE + 'tourist-monitoring.php' + (query ? '?' + query : ''));
    const result = await response.json();

    if (!result.success) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">Could not load visitor records. Please check your database connection.</td></tr>';
      if (emptyState) emptyState.style.display = 'none';
      return;
    }

    const records = Array.isArray(result.data) ? result.data : [];

    if (records.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = records.map(r => `
      <tr>
        <td>${r.full_name || 'Guest'}</td>
        <td>${r.gender_label}</td>
        <td>${r.age_label}</td>
        <td>${r.origin || 'Not specified'}</td>
        <td>${r.type_label}</td>
        <td>${r.num_visitors}</td>
        <td>${r.beach_name}</td>
        <td>${formatVisitDate(r.visit_date)}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading visitor records:', error);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">Could not reach the server. Please try again.</td></tr>';
    if (emptyState) emptyState.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  loadTouristRecords();

  // ===== FILTER: RE-QUERY THE DATABASE ON CHANGE =====
  // Only the Visitor Type filter remains; the search, gender and origin
  // inputs were removed from this view.
  const typeSelect = document.getElementById('filterType');
  if (typeSelect) typeSelect.addEventListener('change', loadTouristRecords);

  // ===== AUTO-REFRESH: KEEP VISITOR RECORDS IN SYNC WITH THE DATABASE =====
  // A reservation approved (or a walk-in registered) anywhere else in the
  // system should show up here automatically, without a manual reload.
  setInterval(loadTouristRecords, TOURIST_MONITORING_POLL_INTERVAL_MS);
  window.addEventListener('focus', loadTouristRecords);

  console.log('🏖️ Tourist Monitoring page ready (live data)');
});
