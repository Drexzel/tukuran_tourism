// ========================================
// ===== TOURISM PERSONNEL DASHBOARD =====
// ========================================
// Pulls every number and chart on this page from the database (via
// dashboard-stats.php / dashboard-charts.php / get-beaches.php) and
// refreshes them on an interval so the dashboard reflects new beaches,
// reservations, and walk-in registrations without a manual reload.

// ========================================
// ===== API CONFIGURATION =====
// ========================================

function getApiBase() {
    // window.location.pathname URL-encodes spaces (e.g. "Tourism Personnel"
    // becomes "Tourism%20Personnel"), so decode before matching folder names.
    const path = decodeURIComponent(window.location.pathname);

    // The api/ folder lives at the BEACH project root, as a sibling of
    // "Tourism Personnel/", "Landing page/", "Beach owner page/", etc.
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
        console.error('Dashboard API error (' + endpoint + '):', error);
        return { success: false, message: error.message };
    }
}

// ========================================
// ===== SUMMARY CARDS =====
// ========================================

function formatNumber(n) {
    return Number(n || 0).toLocaleString('en-US');
}

async function refreshDashboardStats() {
    const result = await fetchAPI('dashboard-stats.php');
    if (!result.success || !result.data) return;

    const stats = result.data;
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatNumber(value);
    };

    setText('totalBeaches', stats.total_beaches);
    setText('todayVisitors', stats.today_visitors);
    setText('totalReservations', stats.total_reservations);
    setText('monthlyVisitors', stats.monthly_visitors);
    setText('remainingSlots', stats.remaining_slots);
    setText('atCapacity', stats.at_capacity);
}

// ========================================
// ===== CHARTS =====
// ========================================

let rankingChartInstance = null; // Top section: Most Visited Beaches ranking (horizontal bar)
let chart1Instance = null; // Chart 1: visitor-origin / gender / age (Data Category)
let chart3Instance = null; // Chart 3: monthly/yearly visitor trend

const CHART_TITLES = {
    'most-visited': 'Most Visited Beaches',
    'visitor-origin': 'Visitor Origin by Municipality',
    'gender-distribution': 'Gender Distribution',
    'age-distribution': 'Age Distribution'
};

const CHART_PALETTE = [
    '#1a6b7a', '#2b8a9e', '#2ed573', '#ffc107',
    '#e74c5e', '#8e44ad', '#3498db', '#e67e22'
];

function buildChart(canvasId, existingInstance, labels, values, chartType, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return existingInstance;

    if (existingInstance) {
        existingInstance.destroy();
    }

    const isPie = chartType === 'pie' || chartType === 'doughnut';

    return new Chart(canvas.getContext('2d'), {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: isPie
                    ? labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length])
                    : '#1a6b7a',
                borderColor: isPie ? '#ffffff' : '#1a6b7a',
                borderWidth: isPie ? 2 : 0,
                tension: 0.35,
                fill: chartType === 'line' ? false : true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 8 },
            plugins: {
                legend: {
                    display: isPie,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 12,
                        font: { size: 11 }
                    }
                }
            },
            scales: isPie ? {} : {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

// ========================================
// ===== MOST VISITED BEACHES (RANKING) =====
// ========================================
// Horizontal ranking bar chart at the top of the dashboard. Shows every
// participating (Active) beach, ranked highest-to-lowest by visitor count
// based on the selected Trend Period (Monthly / Yearly).
//
// NEW:
// - rankingPeriodSelect controls the ranking period.
// - Monthly / Yearly is sent to dashboard-charts.php.
// - Existing ranking chart functionality remains unchanged.


// Inline Chart.js plugin that writes each bar's value at its end. Scoped to
// the ranking chart only, so no other chart is affected, and it avoids
// pulling in an external datalabels plugin (only chart.js itself is loaded).
const rankingValueLabels = {
    id: 'rankingValueLabels',
    afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = '#0a2e3f';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        meta.data.forEach((bar, i) => {
            const value = chart.data.datasets[0].data[i];
            ctx.fillText(formatNumber(value), bar.x + 8, bar.y);
        });

        ctx.restore();
    }
};

function buildRankingChart(labels, values) {
    const canvas = document.getElementById('rankingChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (rankingChartInstance) {
        rankingChartInstance.destroy();
    }

    // Thinner rows (~30px per beach) keep the chart compact. The wrapper's
    // height grows with the number of beaches, but the card caps the visible
    // height and scrolls internally (see .ranking-card / .ranking-canvas-wrap).
    if (canvas.parentElement) {
        canvas.parentElement.style.height =
            Math.max(180, labels.length * 30 + 30) + 'px';
    }

    rankingChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Visitors',
                data: values,
                backgroundColor: '#1a6b7a',
                borderWidth: 0,
                borderRadius: 6,
                maxBarThickness: 16,
                categoryPercentage: 0.8,
                barPercentage: 0.9
            }]
        },
        options: {
            indexAxis: 'y', // horizontal bars
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 40 } }, // room for the value labels
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) =>
                            ' ' + formatNumber(ctx.parsed.x) + ' visitors'
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                y: {
                    grid: { display: false }
                }
            }
        },
        plugins: [rankingValueLabels]
    });
}


// ========================================
// ===== REFRESH BEACH RANKING =====
// ========================================

async function refreshBeachRanking() {

    // NEW:
    // Get the selected Trend Period specifically for Most Visited Beaches.
    // This is separate from trendPeriodSelect used by Analytics Overview.
    const rankingPeriodSelect =
        document.getElementById('rankingPeriodSelect');

    const rankingPeriod =
        rankingPeriodSelect ? rankingPeriodSelect.value : 'monthly';

    // NEW:
    // Send the selected period to the backend.
    const result = await fetchAPI(
        'dashboard-charts.php?type=beach-ranking&period=' +
        encodeURIComponent(rankingPeriod)
    );

    const totalEl = document.getElementById('totalParticipatingBeaches');
    const emptyEl = document.getElementById('rankingEmpty');
    const canvas = document.getElementById('rankingChart');

    if (!result.success || !result.data) return;

    const labels = result.data.labels || [];
    const values = result.data.values || [];
    const totalBeaches =
        (result.data.total_beaches != null)
            ? result.data.total_beaches
            : labels.length;

    if (totalEl) {
        totalEl.textContent = formatNumber(totalBeaches);
    }

    // Empty state: no participating (Active) beaches at all.
    if (labels.length === 0) {

        if (rankingChartInstance) {
            rankingChartInstance.destroy();
            rankingChartInstance = null;
        }

        if (canvas) {
            canvas.style.display = 'none';

            if (canvas.parentElement) {
                canvas.parentElement.style.height = '';
            }
        }

        if (emptyEl) {
            emptyEl.style.display = 'block';
        }

        return;
    }

    if (canvas) {
        canvas.style.display = 'block';
    }

    if (emptyEl) {
        emptyEl.style.display = 'none';
    }

    buildRankingChart(labels, values);
}


// ========================================
// ===== CHART 1 =====
// ========================================

async function refreshChart1() {
    const select = document.getElementById('dataCategorySelect');
    const type = select ? select.value : 'gender-distribution';

    const titleEl = document.getElementById('chart1Title');

    if (titleEl) {
        titleEl.textContent = CHART_TITLES[type] || 'Analytics';
    }

    const result = await fetchAPI(
        'dashboard-charts.php?type=' + encodeURIComponent(type)
    );

    if (!result.success || !result.data) return;

    const chartJsType =
        (type === 'gender-distribution') ? 'doughnut' : 'bar';

    chart1Instance = buildChart(
        'chart1',
        chart1Instance,
        result.data.labels,
        result.data.values,
        chartJsType,
        CHART_TITLES[type] || 'Visitors'
    );
}


// ========================================
// ===== CHART 3 =====
// ========================================

async function refreshChart3() {
    // Trend Period (Monthly / Yearly) is kept; the Trend Chart Type control
    // was removed, so the trend always renders as a line chart.
    const periodSelect = document.getElementById('trendPeriodSelect');
    const period = periodSelect ? periodSelect.value : 'monthly';

    const titleEl = document.getElementById('chart3Title');

    if (titleEl) {
        titleEl.textContent =
            period === 'yearly'
                ? 'Yearly Visitor Trends'
                : 'Monthly Visitor Trends';
    }

    const result = await fetchAPI(
        'dashboard-charts.php?trend=' + encodeURIComponent(period)
    );

    if (!result.success || !result.data) return;

    chart3Instance = buildChart(
        'chart3',
        chart3Instance,
        result.data.labels,
        result.data.values,
        'line',
        'Visitors'
    );
}


// ========================================
// ===== REFRESH ALL CHARTS =====
// ========================================

async function refreshAllCharts() {
    await Promise.all([
        refreshBeachRanking(),
        refreshChart1(),
        refreshChart3()
    ]);
}


// ========================================
// ===== FULL REFRESH + AUTO-REFRESH =====
// ========================================

async function refreshDashboard() {
    await Promise.all([
        refreshDashboardStats(),
        refreshAllCharts()
    ]);
}

let autoRefreshInterval = null;

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);

    // Poll every 30 seconds so newly added reservations/walk-ins/beaches
    // show up automatically without the user refreshing the page.
    autoRefreshInterval = setInterval(refreshDashboard, 30000);
}


// ========================================
// ===== INIT =====
// ========================================

document.addEventListener('DOMContentLoaded', function() {

    refreshDashboard();
    startAutoRefresh();

    // Data Category (replaces the old Chart Type control) drives the first
    // analytics chart.
    const dataCategorySelect =
        document.getElementById('dataCategorySelect');

    if (dataCategorySelect) {
        dataCategorySelect.addEventListener('change', refreshChart1);
    }


    // Trend Period (Monthly / Yearly) updates the trend chart in real time.
    const trendPeriodSelect =
        document.getElementById('trendPeriodSelect');

    if (trendPeriodSelect) {
        trendPeriodSelect.addEventListener('change', refreshChart3);
    }


    // NEW:
    // Separate Trend Period for Most Visited Beaches.
    // This does NOT affect the Analytics Overview trend chart.
    const rankingPeriodSelect =
        document.getElementById('rankingPeriodSelect');

    if (rankingPeriodSelect) {
        rankingPeriodSelect.addEventListener(
            'change',
            refreshBeachRanking
        );
    }


    // Refresh immediately when the tab regains focus, in addition to polling.
    window.addEventListener('focus', refreshDashboard);
});