// ========================================
// ===== AUTOMATED REPORTS MODULE =====
// ========================================
// Pulls every figure on this page live from the database via
// api/reports.php (Total Visitors, Total Reservations, Local/Foreign
// Visitors, Gender & Age Distribution, and Reservation Statistics) -
// nothing here is static/sample data, and the report always reflects
// what's currently in the system. Selecting a specific Beach also adds
// a Visitor Residency breakdown, scoped to that beach.

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========================================
  // ===== API CONFIGURATION =====
  // ========================================
  // Same helper pattern used by assets/js/admin-dashboard.js so this page
  // finds api/reports.php correctly regardless of which folder it's
  // served from.

  function getApiBase() {
    const path = decodeURIComponent(window.location.pathname);
    if (path.includes('/Tourism Personnel/') ||
        path.includes('/Landing page/') ||
        path.includes('/Beach owner page/') ||
        path.includes('/Log-in page/')) {
      return '../api/';
    } else if (path.includes('/api/')) {
      return './';
    } else {
      return 'api/';
    }
  }

  const API_BASE = getApiBase();

  async function fetchAPI(endpoint) {
    try {
      const response = await fetch(API_BASE + endpoint);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'API request failed');
      }
      return data;
    } catch (error) {
      console.error('Automated Reports API error (' + endpoint + '):', error);
      return { success: false, message: error.message };
    }
  }

  // ========================================
  // ===== CURRENT REPORT STATE =====
  // ========================================

  let currentPeriod = 'daily';
  let currentBeachId = '';
  let currentData = null;

  // ========================================
  // ===== LOAD REPORT FROM THE DATABASE =====
  // ========================================
  // Every call is a fresh request straight to the database - there is no
  // "Generate" step. Changing the period or the selected beach re-fetches
  // and re-renders the report automatically.

  async function loadReport(period, beachId) {
    let endpoint = 'reports.php?period=' + encodeURIComponent(period);
    if (beachId) {
      endpoint += '&beach_id=' + encodeURIComponent(beachId);
    }
    const result = await fetchAPI(endpoint);
    if (!result.success || !result.data) {
      showNotification(result.message || 'Could not load report data from the database.', 'error');
      return null;
    }
    return result.data;
  }

  // ========================================
  // ===== PERIOD BUTTONS (auto-loads the report) =====
  // ========================================

  const periodBtns = document.querySelectorAll('.period-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', async function() {
      periodBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentPeriod = this.dataset.period;

      const data = await loadReport(currentPeriod, currentBeachId);
      if (data) {
        currentData = data;
        updateReportPreview(currentData);
      }
    });
  });

  // ========================================
  // ===== BEACH FILTER (Report by Beach) =====
  // ========================================
  // Populates the Beach dropdown with every participating beach from the
  // database. Selecting a beach automatically refreshes the report - no
  // button required - and scopes every figure (summary, demographics,
  // and the printed record) to that beach only.

  const beachFilter = document.getElementById('beachFilter');

  async function loadBeachOptions() {
    if (!beachFilter) return;

    const result = await fetchAPI('get-beaches.php?all=1');
    if (!result.success || !Array.isArray(result.data)) return;

    const beaches = result.data
      .slice()
      .sort((a, b) => (a.beach_name || '').localeCompare(b.beach_name || ''));

    beaches.forEach(beach => {
      const option = document.createElement('option');
      option.value = beach.beach_id;
      option.textContent = beach.beach_name;
      beachFilter.appendChild(option);
    });
  }

  if (beachFilter) {
    beachFilter.addEventListener('change', async function() {
      currentBeachId = this.value;

      const data = await loadReport(currentPeriod, currentBeachId);
      if (data) {
        currentData = data;
        updateReportPreview(currentData);
      }
    });
  }

  // ========================================
  // ===== UPDATE REPORT PREVIEW =====
  // ========================================

  function updateReportPreview(data) {
    // Update report header
    const reportHeader = document.querySelector('.report-header');
    if (reportHeader) {
      const periodTitle = reportHeader.querySelector('h3');
      const dateEl = reportHeader.querySelector('.report-date');
      if (periodTitle) periodTitle.textContent = data.period;
      if (dateEl) dateEl.textContent = data.date;

      // Beach Name line - only shown once a specific beach is selected,
      // matching the printed report's "Beach Name" line.
      let beachNameEl = reportHeader.querySelector('.report-beach-name');
      if (!beachNameEl) {
        beachNameEl = document.createElement('p');
        beachNameEl.className = 'report-beach-name';
        reportHeader.appendChild(beachNameEl);
      }
      if (currentBeachId) {
        beachNameEl.textContent = `Beach: ${data.beachName}`;
        beachNameEl.style.display = '';
      } else {
        beachNameEl.style.display = 'none';
      }
    }

    const isBeachReport = !!currentBeachId;

    // Update summary stats
    const summaryStats = document.querySelectorAll('.report-stat');
    if (summaryStats.length >= 4) {
      const totals = summaryStats;
      totals[0].querySelector('strong').textContent = data.totalVisitors.toLocaleString();
      totals[1].querySelector('strong').textContent = data.totalReservations.toLocaleString();
      totals[2].querySelector('strong').textContent = data.localVisitors.toLocaleString();
      totals[3].querySelector('strong').textContent = data.foreignVisitors.toLocaleString();
    }

    // Update Visitor Demographics with actual numbers straight from the
    // database - Gender Distribution, Age Distribution (percentages
    // calculated from actual visitor records), and, only when a specific
    // Beach is selected, the residency breakdown required for a Beach
    // Report.
    const genderEl = document.getElementById('genderDistItem');
    if (genderEl) {
      const p = genderEl.querySelector('p');
      if (p) {
        p.textContent = `Male: ${data.gender.male.toLocaleString()} | Female: ${data.gender.female.toLocaleString()}`;
      }
    }

    const ageEl = document.getElementById('ageDistItem');
    if (ageEl) {
      const p = ageEl.querySelector('p');
      if (p) {
        if (data.ageDistribution.every(age => age.count === 0)) {
          p.textContent = 'No age data recorded for this period';
        } else {
          const ageParts = data.ageDistribution.map(age =>
            `${age.range}: ${age.count.toLocaleString()} (${age.percentage}%)`
          );
          p.textContent = ageParts.join(' | ');
        }
      }
    }

    // Visitor Residency (Residents of Tukuran / Other Municipalities or
    // Cities / Foreign Visitors) - only meaningful once a specific beach
    // is selected, so it's added right after Age Distribution in Beach
    // Report mode and removed otherwise.
    const demographicGrid = document.querySelector('.demographic-grid');
    let residencyEl = document.getElementById('residencyItem');
    if (isBeachReport) {
      if (!residencyEl && demographicGrid && ageEl) {
        residencyEl = document.createElement('div');
        residencyEl.className = 'demographic-item';
        residencyEl.id = 'residencyItem';
        residencyEl.innerHTML = '<span>Visitor Residency</span><p></p>';
        ageEl.after(residencyEl);
      }
      if (residencyEl && data.lguRecord && data.lguRecord.totals) {
        const p = residencyEl.querySelector('p');
        const t = data.lguRecord.totals;
        if (p) {
          p.innerHTML =
            `Residents of Tukuran: ${t.this.total.toLocaleString()}<br>` +
            `Other Municipalities/Cities: ${t.other.total.toLocaleString()}<br>` +
            `Foreign Visitors: ${t.foreign.total.toLocaleString()}`;
        }
      }
    } else if (residencyEl) {
      residencyEl.remove();
    }

    // Reservation Statistics - live counts of every status currently on
    // record (a reservation "rejected" by a Beach Owner is stored as
    // Cancelled in the database, so it's included there rather than as a
    // separate, unverifiable category).
    const reservationStatsEl = document.getElementById('reservationStatsItem');
    if (reservationStatsEl) {
      const p = reservationStatsEl.querySelector('p');
      if (p) {
        const rs = data.reservationStats;
        p.textContent = `Confirmed: ${rs.confirmed} | Completed: ${rs.completed} | Pending: ${rs.pending} | Cancelled: ${rs.cancelled} | Expired: ${rs.expired}`;
      }
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // ========================================
  // ===== NOTIFICATION SYSTEM =====
  // ========================================

  function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existing = document.querySelector('.report-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `report-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    // Style the notification
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#2ed573' : '#3498db'};
      color: #fff;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      z-index: 99999;
      max-width: 420px;
      animation: slideInRight 0.4s ease;
      font-family: 'Inter', sans-serif;
    `;

    const content = notification.querySelector('.notification-content');
    content.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #fff;
      font-size: 1.3rem;
      cursor: pointer;
      margin-left: auto;
      padding: 0 4px;
    `;

    closeBtn.addEventListener('click', function() {
      notification.remove();
    });

    document.body.appendChild(notification);

    // Auto remove after 4 seconds
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
  // ===== PRINT REPORT WITH LOGOS =====
  // ========================================

  // Override window.print so the printed output follows the Municipality of
  // Tukuran's official "Tourism Attraction Visitors Record" form layout.
  const originalPrint = window.print;
  window.print = function() {
    if (!currentData) {
      showNotification('Please wait for the report to finish loading.', 'error');
      return;
    }

    const lgu = currentData.lguRecord;
    if (!lgu || !lgu.rows) {
      showNotification('The official visitors record is still loading. Please try again.', 'error');
      return;
    }

    const beachName = escapeHtml(currentData.beachName || 'All Registered Beaches');
    const monthYear = escapeHtml(lgu.monthYear || '');

    // Build one <tr> per day of the month.
    const bodyRows = lgu.rows.map(r => `
      <tr>
        <td class="c-day">${r.day}</td>
        <td class="c-weekday">${escapeHtml(r.weekday)}</td>
        <td>${r.this.male}</td>
        <td>${r.this.female}</td>
        <td class="c-sub">${r.this.total}</td>
        <td>${r.other.male}</td>
        <td>${r.other.female}</td>
        <td class="c-sub">${r.other.total}</td>
        <td>${r.foreign.male}</td>
        <td>${r.foreign.female}</td>
        <td class="c-sub">${r.foreign.total}</td>
        <td>${r.grand.male}</td>
        <td>${r.grand.female}</td>
        <td class="c-grand">${r.grand.total}</td>
      </tr>
    `).join('');

    const t = lgu.totals;

    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Tourism Attraction Visitors Record - ${monthYear}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                padding: 24px 20px;
                background: #ffffff;
                color: #111;
              }

              /* ===== Official header ===== */
              .lgu-head { text-align: center; margin-bottom: 14px; }
              .lgu-logos {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 26px;
                margin-bottom: 8px;
              }
              .lgu-logos .logo-circle {
                width: 58px; height: 58px;
                border-radius: 50%;
                overflow: hidden;
                display: flex; align-items: center; justify-content: center;
                border: 1.5px solid #0a2e3f;
              }
              .lgu-logos .logo-circle img {
                width: 100%; height: 100%; object-fit: contain; padding: 5px;
              }
              .lgu-head .rep   { font-size: 0.8rem; color: #333; }
              .lgu-head .muni  { font-size: 1.15rem; font-weight: 700; color: #0a2e3f; letter-spacing: 0.5px; }
              .lgu-head .office{ font-size: 0.9rem; font-weight: 600; color: #1a6b7a; margin-bottom: 6px; }
              .lgu-head .title {
                font-size: 1.25rem; font-weight: 800; letter-spacing: 1px;
                color: #0a2e3f; margin-top: 6px;
              }
              .lgu-head .subtitle { font-size: 0.72rem; font-style: italic; color: #555; margin-top: 2px; }

              /* ===== Meta block ===== */
              .lgu-meta {
                margin: 14px auto 10px;
                width: fit-content;
                font-size: 0.82rem;
                line-height: 1.6;
              }
              .lgu-meta .row { display: flex; }
              .lgu-meta .lbl { font-weight: 700; text-align: right; min-width: 235px; padding-right: 10px; }
              .lgu-meta .val { font-weight: 600; text-decoration: underline; text-transform: uppercase; }

              /* ===== Records table ===== */
              table.lgu-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.62rem;
                table-layout: fixed;
              }
              table.lgu-table th,
              table.lgu-table td {
                border: 1px solid #333;
                text-align: center;
                padding: 2px 1px;
                vertical-align: middle;
              }
              table.lgu-table thead th {
                background: #ffe100;
                color: #111;
                font-weight: 700;
                text-transform: uppercase;
                font-size: 0.6rem;
                line-height: 1.15;
              }
              table.lgu-table tbody td { height: 17px; }
              table.lgu-table tbody .c-day { font-weight: 700; }
              table.lgu-table tbody .c-weekday { font-style: italic; }
              table.lgu-table tbody .c-sub { background: #fbfbf2; }
              table.lgu-table tbody .c-grand { font-weight: 700; background: #f4f9fb; }

              tr.lgu-total td {
                background: #64c6e8;
                font-weight: 800;
                color: #06303f;
                border: 1px solid #333;
                height: 22px;
              }
              tr.lgu-total .total-label {
                text-transform: uppercase;
                letter-spacing: 0.5px;
                text-align: center;
              }

              .lgu-foot {
                margin-top: 22px;
                display: flex;
                justify-content: space-between;
                font-size: 0.72rem;
                color: #444;
              }
              .lgu-foot .sign { text-align: center; }
              .lgu-foot .sign .line { border-top: 1px solid #333; width: 190px; margin-bottom: 3px; }

              .print-note { text-align: center; font-size: 0.68rem; color: #888; margin-top: 12px; }

              /* ===== Print button (screen only) ===== */
              .no-print { text-align: center; margin-top: 24px; padding: 12px 0; }
              .no-print button {
                padding: 12px 36px;
                background: linear-gradient(135deg, #2b8a9e, #1a6b7a);
                color: #fff; border: none; border-radius: 10px;
                font-size: 0.95rem; font-weight: 600; cursor: pointer;
                font-family: 'Inter', sans-serif;
              }

              @page { size: A4 portrait; margin: 10mm; }
              @media print {
                .no-print { display: none !important; }
                body { padding: 0; }
                table.lgu-table thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                tr.lgu-total td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                tr { break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <!-- ===== OFFICIAL LGU HEADER ===== -->
            <div class="lgu-head">
              <div class="lgu-logos">
                <div class="logo-circle"><img src="images/municipality-logo.png" alt="Municipality" onerror="this.style.display='none'"></div>
                <div class="logo-circle"><img src="images/tourism-logo.png" alt="Tourism" onerror="this.style.display='none'"></div>
                <div class="logo-circle"><img src="images/system-logo.png" alt="System" onerror="this.style.display='none'"></div>
              </div>
              <div class="rep">Republic of the Philippines</div>
              <div class="muni">Municipality of Tukuran</div>
              <div class="office">Tourism Office</div>
              <div class="title">Tourism Attraction Visitors Record</div>
              <div class="subtitle">(This record form can be used instead of just counting the visitors)</div>
            </div>

            <!-- ===== META ===== -->
            <div class="lgu-meta">
              <div class="row"><span class="lbl">MONTH/YEAR:</span><span class="val">${monthYear}</span></div>
              <div class="row"><span class="lbl">Name of City/Municipality:</span><span class="val">LGU-Tukuran</span></div>
              <div class="row"><span class="lbl">Name of Attraction/Spot/Beaches:</span><span class="val">${beachName}</span></div>
            </div>

            <!-- ===== VISITORS RECORD TABLE ===== -->
            <table class="lgu-table">
              <thead>
                <tr>
                  <th rowspan="4">DAY</th>
                  <th rowspan="4">Weekday<br>(Mon&ndash;Sun)</th>
                  <th colspan="9">Place of Residence</th>
                  <th colspan="3" rowspan="3">Grand Total<br>Number of Visitors</th>
                </tr>
                <tr>
                  <th colspan="6">Philippines</th>
                  <th colspan="3" rowspan="2">Foreign Country<br>Residence</th>
                </tr>
                <tr>
                  <th colspan="3">This City/Municipality</th>
                  <th colspan="3">Other City/Municipality</th>
                </tr>
                <tr>
                  <th>Male</th><th>Female</th><th>Total</th>
                  <th>Male</th><th>Female</th><th>Total</th>
                  <th>Male</th><th>Female</th><th>Total</th>
                  <th>Male</th><th>Female</th><th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${bodyRows}
              </tbody>
              <tfoot>
                <tr class="lgu-total">
                  <td class="total-label" colspan="2">Total of this Month</td>
                  <td>${t.this.male}</td><td>${t.this.female}</td><td>${t.this.total}</td>
                  <td>${t.other.male}</td><td>${t.other.female}</td><td>${t.other.total}</td>
                  <td>${t.foreign.male}</td><td>${t.foreign.female}</td><td>${t.foreign.total}</td>
                  <td>${t.grand.male}</td><td>${t.grand.female}</td><td>${t.grand.total}</td>
                </tr>
              </tfoot>
            </table>

            <!-- ===== SIGNATURE / FOOTER ===== -->
            <div class="lgu-foot">
              <div class="sign">
                <div class="line"></div>
                <div>Prepared by (Tourism Personnel)</div>
              </div>
              <div class="sign">
                <div class="line"></div>
                <div>Noted by (Tourism Officer)</div>
              </div>
            </div>
            <div class="print-note">
              Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              &middot; Municipality of Tukuran &middot; Tourism Office
            </div>

            <!-- PRINT BUTTON (screen only) -->
            <div class="no-print">
              <button onclick="window.print()"><i class="fas fa-print"></i> Print Report</button>
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() { window.print(); }, 700);
              };
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // ========================================
  // ===== EXPORT EXCEL =====
  // ========================================

  window.exportExcel = function() {
    if (!currentData) {
      showNotification('Please wait for the report to finish loading.', 'error');
      return;
    }

    const btn = document.querySelector('.report-actions-bottom .btn-secondary:last-child');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
      btn.disabled = true;
    }

    setTimeout(function() {
      // Create CSV data, matching exactly what's shown on screen: Report
      // Summary, Visitor Demographics (Gender, Age, and Residency when a
      // specific beach is selected), and Reservation Statistics.
      const headers = ['Section', 'Item', 'Value'];

      const rows = [
        ['SUMMARY', 'Total Visitors', currentData.totalVisitors],
        ['SUMMARY', 'Total Reservations', currentData.totalReservations],
        ['SUMMARY', 'Local Visitors', currentData.localVisitors],
        ['SUMMARY', 'Foreign Visitors', currentData.foreignVisitors],
        ['', '', ''],
        ['GENDER DISTRIBUTION', 'Male', currentData.gender.male],
        ['GENDER DISTRIBUTION', 'Female', currentData.gender.female],
        ['', '', ''],
        ['AGE DISTRIBUTION', 'Range', 'Count (Percentage)'],
        ...currentData.ageDistribution.map(age => [
          'AGE DISTRIBUTION',
          age.range,
          `${age.count} (${age.percentage}%)`
        ])
      ];

      if (currentBeachId && currentData.lguRecord && currentData.lguRecord.totals) {
        const t = currentData.lguRecord.totals;
        rows.push(
          ['', '', ''],
          ['VISITOR RESIDENCY', 'Residents of Tukuran', t.this.total],
          ['VISITOR RESIDENCY', 'Other Municipalities/Cities', t.other.total],
          ['VISITOR RESIDENCY', 'Foreign Visitors', t.foreign.total]
        );
      }

      rows.push(
        ['', '', ''],
        ['RESERVATION STATISTICS', 'Confirmed', currentData.reservationStats.confirmed],
        ['RESERVATION STATISTICS', 'Completed', currentData.reservationStats.completed],
        ['RESERVATION STATISTICS', 'Pending', currentData.reservationStats.pending],
        ['RESERVATION STATISTICS', 'Cancelled', currentData.reservationStats.cancelled],
        ['RESERVATION STATISTICS', 'Expired', currentData.reservationStats.expired],
        ['RESERVATION STATISTICS', 'Total', currentData.reservationStats.total]
      );

      const allRows = [headers, ...rows];
      const csvContent = allRows.map(row => row.join(',')).join('\n');
      
      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Tourism_Report_${currentPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Reset button
      const btnEl = document.querySelector('.report-actions-bottom .btn-secondary:last-child');
      if (btnEl) {
        btnEl.innerHTML = '<i class="fas fa-file-excel"></i> Export Excel';
        btnEl.disabled = false;
      }

      showNotification('Excel exported successfully!', 'success');
    }, 400);
  };

  // ========================================
  // ===== INITIALIZE REPORT =====
  // ========================================

  (async function initReport() {
    await loadBeachOptions();
    const data = await loadReport(currentPeriod, currentBeachId);
    if (data) {
      currentData = data;
      updateReportPreview(currentData);
    }
  })();

  // Add animation styles for notifications
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `;
  document.head.appendChild(style);

  console.log('📊 Automated Reports module loaded successfully — live database mode');
});
