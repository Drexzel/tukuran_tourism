// ========================================
// ===== REAL-TIME INCIDENT ALERT (TOURISM PERSONNEL DASHBOARD) =====
// ========================================
// Requirement A: whenever a Beach Owner submits a new Incident Report,
// show a real-time notification on the Tourism Personnel Dashboard. The
// alert stays visible until the personnel views or acknowledges it, and
// clicking it opens the Incident Reports module.
//
// This is a self-contained, additive widget: it injects its own styles and
// a floating bell into the page. It does NOT modify the dashboard layout,
// the database, or the incidents API. It reads incidents via the existing
// GET api/incidents.php and remembers which reports have been acknowledged
// (localStorage) so it only alerts on genuinely new submissions.

(function () {
  'use strict';

  var API_BASE = '../api/';
  var POLL_INTERVAL = 15000; // ms
  var ACK_KEY = 'tp_incident_ack_id'; // highest incident_id already seen/acknowledged
  var INCIDENT_MODULE = 'incident-report.html';

  var latestMaxId = 0;      // highest incident_id currently in the DB
  var lastBannerMax = 0;    // highest id we've already surfaced in the banner
  var bellEl, badgeEl, bannerEl;

  function getAck() {
    var v = parseInt(localStorage.getItem(ACK_KEY), 10);
    return isNaN(v) ? null : v;
  }
  function setAck(id) {
    localStorage.setItem(ACK_KEY, String(id));
  }

  // ---------- UI injection ----------

  function injectStyles() {
    if (document.getElementById('tpIncidentAlertStyles')) return;
    var css = '' +
      '.tp-alert-bell{position:fixed;top:22px;right:26px;width:52px;height:52px;border-radius:50%;' +
      'background:#fff;border:1px solid rgba(0,0,0,0.06);box-shadow:0 6px 24px rgba(10,46,63,0.14);' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:99998;color:#1a6b7a;' +
      'font-size:1.15rem;transition:transform .25s ease,box-shadow .25s ease;}' +
      '.tp-alert-bell:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(10,46,63,0.2);}' +
      '.tp-alert-bell.has-new{color:#D32F2F;animation:tpBellPulse 1.6s ease-in-out infinite;}' +
      '@keyframes tpBellPulse{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}' +
      '.tp-alert-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;' +
      'border-radius:12px;background:#D32F2F;color:#fff;font-size:0.72rem;font-weight:700;' +
      "font-family:'Inter',sans-serif;display:none;align-items:center;justify-content:center;line-height:1;}" +
      '.tp-alert-badge.show{display:flex;}' +
      '.tp-alert-banner{position:fixed;top:86px;right:26px;width:330px;max-width:calc(100vw - 52px);' +
      'background:#fff;border-radius:14px;border-left:4px solid #D32F2F;box-shadow:0 12px 40px rgba(10,46,63,0.22);' +
      'padding:16px 18px;z-index:99999;cursor:pointer;display:none;' +
      "font-family:'Inter',sans-serif;animation:tpBannerIn .35s ease;}" +
      '.tp-alert-banner.show{display:block;}' +
      '@keyframes tpBannerIn{from{opacity:0;transform:translateX(40px);}to{opacity:1;transform:translateX(0);}}' +
      '.tp-alert-banner-head{display:flex;align-items:center;gap:10px;margin-bottom:6px;}' +
      '.tp-alert-banner-head i{color:#D32F2F;font-size:1.05rem;}' +
      '.tp-alert-banner-title{font-weight:700;color:#0a2e3f;font-size:0.95rem;}' +
      '.tp-alert-banner-body{color:#3a5a6a;font-size:0.85rem;line-height:1.5;}' +
      '.tp-alert-banner-close{position:absolute;top:10px;right:12px;background:none;border:none;' +
      'color:#95a5a6;font-size:1rem;cursor:pointer;padding:2px 4px;line-height:1;}' +
      '.tp-alert-banner-close:hover{color:#3a5a6a;}' +
      '@media(max-width:768px){.tp-alert-bell{top:14px;right:14px;}.tp-alert-banner{top:74px;right:14px;}}';
    var style = document.createElement('style');
    style.id = 'tpIncidentAlertStyles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildWidget() {
    injectStyles();

    bellEl = document.createElement('button');
    bellEl.className = 'tp-alert-bell';
    bellEl.setAttribute('aria-label', 'Incident report alerts');
    bellEl.title = 'Incident report alerts';
    bellEl.innerHTML = '<i class="fas fa-bell"></i><span class="tp-alert-badge">0</span>';
    badgeEl = bellEl.querySelector('.tp-alert-badge');
    bellEl.addEventListener('click', openModule);
    document.body.appendChild(bellEl);

    bannerEl = document.createElement('div');
    bannerEl.className = 'tp-alert-banner';
    bannerEl.innerHTML =
      '<button class="tp-alert-banner-close" aria-label="Dismiss">&times;</button>' +
      '<div class="tp-alert-banner-head"><i class="fas fa-exclamation-triangle"></i>' +
      '<span class="tp-alert-banner-title">New Incident Report Submitted</span></div>' +
      '<div class="tp-alert-banner-body">A new incident has been reported by a Beach Owner. Click to view the details.</div>';
    bannerEl.addEventListener('click', function (e) {
      if (e.target.classList.contains('tp-alert-banner-close')) {
        acknowledge();
        return;
      }
      openModule();
    });
    document.body.appendChild(bannerEl);
  }

  // ---------- alert state ----------

  function newCount() {
    var ack = getAck();
    if (ack === null) return 0;
    // Count is derived from the max id vs the acknowledged id; the exact
    // per-record count is shown from the last fetch.
    return latestUnackCount;
  }

  var latestUnackCount = 0;

  function renderState() {
    if (!bellEl) return;
    var ack = getAck();
    var hasNew = ack !== null && latestMaxId > ack && latestUnackCount > 0;

    if (hasNew) {
      bellEl.classList.add('has-new');
      badgeEl.textContent = latestUnackCount > 99 ? '99+' : String(latestUnackCount);
      badgeEl.classList.add('show');
      // Show the banner once per new batch (don't re-pop on every poll).
      if (latestMaxId > lastBannerMax) {
        bannerEl.classList.add('show');
        lastBannerMax = latestMaxId;
      }
    } else {
      bellEl.classList.remove('has-new');
      badgeEl.classList.remove('show');
      bannerEl.classList.remove('show');
    }
  }

  function acknowledge() {
    setAck(latestMaxId);
    latestUnackCount = 0;
    renderState();
  }

  function openModule() {
    // Viewing the module counts as acknowledging the current alerts.
    setAck(latestMaxId);
    window.location.href = INCIDENT_MODULE;
  }

  // ---------- polling ----------

  async function poll() {
    try {
      var res = await fetch(API_BASE + 'incidents.php');
      var data = await res.json();
      if (!data || !data.success || !Array.isArray(data.data)) return;

      var ids = data.data.map(function (i) { return parseInt(i.incident_id, 10) || 0; });
      latestMaxId = ids.length ? Math.max.apply(null, ids) : 0;

      var ack = getAck();
      if (ack === null) {
        // First ever run on this browser: treat everything already in the
        // system as seen, so we only alert on submissions from now on.
        setAck(latestMaxId);
        latestUnackCount = 0;
      } else {
        latestUnackCount = ids.filter(function (id) { return id > ack; }).length;
      }

      renderState();
    } catch (err) {
      // Backend/MySQL not reachable - stay quiet, retry on next interval.
      console.warn('Incident alert poll failed:', err);
    }
  }

  function init() {
    buildWidget();
    poll();
    setInterval(poll, POLL_INTERVAL);
    console.log('🔔 Real-time incident alert ready (Tourism Personnel Dashboard)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
