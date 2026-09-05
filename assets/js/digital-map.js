// ========================================
// ===== DIGITAL MAP MODULE =====
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========================================
  // ===== API CONFIGURATION =====
  // ========================================

  // This file only ever loads from the Tourism Personnel folder, so the API
  // folder is always one level up.
  const DIGITAL_MAP_API_BASE = '../api/';

  // ========================================
  // ===== MAP CONFIGURATION (Tukuran only) =====
  // ========================================

  // Municipal center used consistently across the system (Add Beach location
  // picker, public Landing Page Beach Details map) so every map in the app
  // opens on the same spot.
  const TUKURAN_CENTER = [7.8500, 123.5794];
  const TUKURAN_DEFAULT_ZOOM = 14;
  const TUKURAN_MIN_ZOOM = 12;
  const TUKURAN_MAX_ZOOM = 18;

  // Keeps the map locked to the Municipality of Tukuran so opening or
  // panning the map never drifts into neighboring municipalities.
  const TUKURAN_BOUNDS = L.latLngBounds(
    [7.68, 123.36],
    [7.92, 123.66]
  );

  // ========================================
  // ===== MAP STATE =====
  // ========================================

  let map = null;
  let markers = {};
  let beachLocations = {}; // Keyed by beach_id, populated from the database

  // ========================================
  // ===== INITIALIZE MAP =====
  // ========================================

  function initMap() {
    const mapContainer = document.getElementById('beachMap');
    if (!mapContainer) return;

    map = L.map('beachMap', {
      zoomControl: false, // We'll add custom zoom control
      minZoom: TUKURAN_MIN_ZOOM,
      maxZoom: TUKURAN_MAX_ZOOM,
      maxBounds: TUKURAN_BOUNDS,
      maxBoundsViscosity: 1.0
    }).setView(TUKURAN_CENTER, TUKURAN_DEFAULT_ZOOM);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Add zoom control to top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add scale control
    L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(map);

    // Load participating beaches from the database and plot them
    loadBeaches();

    console.log('🗺️ Digital Map initialized successfully');
  }

  // ========================================
  // ===== LOAD BEACHES FROM DATABASE =====
  // ========================================

  async function fetchBeaches() {
    try {
      // No ?all=1 flag - the Digital Map only ever shows participating
      // (Active) beaches, so a beach disappears the moment it's
      // deactivated and reappears automatically once reactivated.
      const response = await fetch(DIGITAL_MAP_API_BASE + 'get-beaches.php');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        return result.data;
      }
      return [];
    } catch (error) {
      console.error('❌ Error loading beaches for Digital Map:', error);
      return [];
    }
  }

  async function loadBeaches() {
    const rows = await fetchBeaches();

    beachLocations = {};
    rows.forEach(row => {
      // Skip beaches that haven't had a map location set yet - nothing to
      // plot for them.
      if (row.latitude === null || row.longitude === null) return;

      beachLocations[row.beach_id] = {
        id: row.beach_id,
        name: row.beach_name,
        location: row.location,
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude),
        currentCapacity: parseInt(row.current_capacity, 10) || 0,
        maxCapacity: parseInt(row.max_capacity, 10) || 0
      };
    });

    renderMarkers();
    populateBeachList();
  }

  // ========================================
  // ===== MARKERS =====
  // ========================================

  function renderMarkers() {
    // Clear existing markers before redrawing with fresh data
    Object.keys(markers).forEach(key => {
      map.removeLayer(markers[key]);
    });
    markers = {};

    Object.keys(beachLocations).forEach(key => {
      const beach = beachLocations[key];
      const marker = createMarker(beach);
      markers[key] = marker;
      marker.addTo(map);
    });
  }

  function getAvailability(beach) {
    const maxCapacity = beach.maxCapacity || 0;
    const occupancyPercent = maxCapacity > 0
      ? Math.round((beach.currentCapacity / maxCapacity) * 100)
      : 0;

    let statusClass, statusText;
    if (maxCapacity > 0 && occupancyPercent >= 100) {
      statusClass = 'full';
      statusText = 'Full';
    } else if (maxCapacity > 0 && occupancyPercent >= 70) {
      statusClass = 'nearly-full';
      statusText = 'Nearly Full';
    } else {
      statusClass = 'available';
      statusText = 'Available';
    }

    return { occupancyPercent, statusClass, statusText };
  }

  function createMarker(beach) {
    // A single, clean, consistent pin for every participating beach -
    // no percentage figures or color-coded meanings that would need a
    // separate legend to explain.
    const icon = L.divIcon({
      className: 'beach-map-marker',
      html: `
        <div class="beach-pin-marker">
          <i class="fas fa-umbrella-beach"></i>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
    });

    const marker = L.marker([beach.lat, beach.lng], { icon })
      .bindPopup(createPopupContent(beach))
      .on('click', function() {
        highlightBeach(beach);
      });

    // Subtle hover effect
    marker.on('mouseover', function() {
      const pin = this._icon.querySelector('.beach-pin-marker');
      if (pin) {
        pin.style.transform = 'rotate(-45deg) scale(1.15)';
        pin.style.boxShadow = '0 6px 20px rgba(10, 46, 63, 0.40)';
      }
    });

    marker.on('mouseout', function() {
      const pin = this._icon.querySelector('.beach-pin-marker');
      if (pin) {
        pin.style.transform = 'rotate(-45deg) scale(1)';
        pin.style.boxShadow = '0 4px 14px rgba(10, 46, 63, 0.35)';
      }
    });

    return marker;
  }

  function createPopupContent(beach) {
    const { statusClass, statusText } = getAvailability(beach);

    return `
      <div>
        <div class="popup-beach-name">${beach.name}</div>
        <div class="popup-location"><i class="fas fa-map-pin" style="color:#1a6b7a;"></i> ${beach.location}</div>
        <div class="popup-details">
          <span><i class="fas fa-users"></i> ${beach.currentCapacity} current visitors</span>
          <span><i class="fas fa-user-friends"></i> ${beach.maxCapacity} max capacity</span>
        </div>
        <span class="popup-status ${statusClass}">${statusText}</span>
        <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(0,0,0,0.04);">
          <a href="beach-management.html?edit_beach=${beach.id}" class="popup-btn">
            <i class="fas fa-arrow-right"></i> View Details
          </a>
        </div>
      </div>
    `;
  }

  // ========================================
  // ===== HIGHLIGHT BEACH =====
  // ========================================

  function highlightBeach(beach) {
    const marker = markers[beach.id];
    if (!marker) return;

    marker.openPopup();
    map.setView([beach.lat, beach.lng], 16);
    highlightBeachList(beach.id);
  }

  function highlightBeachList(key) {
    const items = document.querySelectorAll('.map-beach-list .beach-item');
    items.forEach(item => {
      item.classList.remove('active');
      if (String(item.dataset.beach) === String(key)) {
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // ========================================
  // ===== POPULATE BEACH LIST =====
  // ========================================

  function populateBeachList() {
    const container = document.getElementById('mapBeachList');
    if (!container) return;

    const keys = Object.keys(beachLocations);

    if (keys.length === 0) {
      container.innerHTML = '<p style="color:#5a7a8a; font-size:0.9rem;">No participating beaches to display yet.</p>';
      return;
    }

    container.innerHTML = keys.map(key => {
      const beach = beachLocations[key];
      const { statusClass, statusText } = getAvailability(beach);
      const dotColor = statusClass === 'full' ? '#e74c5e' : statusClass === 'nearly-full' ? '#ffc107' : '#2ed573';

      return `
        <div class="beach-item" data-beach="${key}" onclick="window.selectBeach('${key}')">
          <span class="beach-marker-color" style="background: ${dotColor};"></span>
          <span class="beach-name">${beach.name}</span>
          <span class="beach-occupancy">${statusText}</span>
        </div>
      `;
    }).join('');
  }

  // ========================================
  // ===== SELECT BEACH (Global) =====
  // ========================================

  window.selectBeach = function(key) {
    const beach = beachLocations[key];
    if (beach) {
      highlightBeach(beach);
    }
  };

  // ========================================
  // ===== SEARCH BEACHES =====
  // ========================================

  function searchBeaches(query) {
    const searchTerm = (query || '').toLowerCase().trim();

    Object.keys(beachLocations).forEach(key => {
      const beach = beachLocations[key];
      const marker = markers[key];
      if (!marker) return;

      const match = searchTerm === '' ||
        beach.name.toLowerCase().includes(searchTerm) ||
        beach.location.toLowerCase().includes(searchTerm);

      if (match) {
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }
      } else if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });

    // Filter the side list to match
    document.querySelectorAll('.map-beach-list .beach-item').forEach(item => {
      const key = item.dataset.beach;
      const beach = beachLocations[key];
      const match = !beach || searchTerm === '' ||
        beach.name.toLowerCase().includes(searchTerm) ||
        beach.location.toLowerCase().includes(searchTerm);
      item.style.display = match ? '' : 'none';
    });

    // If exactly one beach matches a non-empty search, zoom to it
    if (searchTerm !== '') {
      const matches = Object.keys(beachLocations).filter(key => {
        const beach = beachLocations[key];
        return beach.name.toLowerCase().includes(searchTerm) ||
          beach.location.toLowerCase().includes(searchTerm);
      });
      if (matches.length === 1) {
        const beach = beachLocations[matches[0]];
        map.setView([beach.lat, beach.lng], 16);
        const marker = markers[matches[0]];
        if (marker) {
          setTimeout(() => marker.openPopup(), 300);
        }
      }
    }
  }

  // ========================================
  // ===== REFRESH BEACH DATA (Auto-Sync) =====
  // ========================================

  // Keeps the Digital Map in sync with Beach Management: whenever a beach
  // is added, edited, deactivated, or reactivated there, this picks up the
  // change here automatically without the page needing to be reloaded.
  async function refreshBeaches() {
    await loadBeaches();
  }

  // ========================================
  // ===== EVENT LISTENERS =====
  // ========================================

  function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchBeachMap');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('keyup', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          searchBeaches(this.value);
        }, 300);
      });
    }

    // ========================================
    // ===== DIRECT LOGOUT - NO MODAL =====
    // ========================================

    const logoutBtn = document.getElementById('logoutBtn4');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        // Direct redirect to login page
        window.location.href = '../Log-in page/login.html';
      });
    }
  }

  // ========================================
  // ===== INITIALIZE =====
  // ========================================

  // Wait for Leaflet to load
  if (typeof L !== 'undefined') {
    // Small delay to ensure map container is ready
    setTimeout(() => {
      initMap();
      setupEventListeners();

      // Auto-refresh beach data every 30 seconds, matching the polling
      // interval already used elsewhere in Tourism Personnel (Tourist
      // Monitoring, Incident Report, Admin Dashboard).
      setInterval(refreshBeaches, 30000);
    }, 100);
  } else {
    console.error('Leaflet library not loaded');
  }

  console.log('🗺️ Digital Map module loaded successfully');
});
