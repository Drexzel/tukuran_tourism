// ========================================
// ===== MAP PAGE - LEAFLET INTEGRATION =====
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ===== ELEMENTS =====
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  // ===== STICKY NAVBAR =====
  function handleNavScroll() {
    if (window.scrollY > 80) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleNavScroll);
  handleNavScroll();

  // ===== MOBILE NAV TOGGLE =====
  if (navToggle) {
    navToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      navMenu.classList.toggle('open');
      const icon = navToggle.querySelector('i');
      if (navMenu.classList.contains('open')) {
        icon.className = 'fas fa-times';
      } else {
        icon.className = 'fas fa-bars';
      }
    });
  }

  // ===== CLOSE NAV ON LINK CLICK =====
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      navMenu.classList.remove('open');
      const icon = navToggle?.querySelector('i');
      if (icon) icon.className = 'fas fa-bars';
    });
  });

  // ===== CLOSE NAV ON OUTSIDE CLICK =====
  document.addEventListener('click', function(e) {
    if (navMenu && navMenu.classList.contains('open')) {
      if (!navMenu.contains(e.target) && !navToggle?.contains(e.target)) {
        navMenu.classList.remove('open');
        const icon = navToggle?.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      }
    }
  });

  // ========================================
  // ===== BEACH DATA (from MySQL via api/get-beaches.php) =====
  // ========================================
  // The Map page lives one folder below the BEACH project root, same as the
  // Landing and Browse Beaches pages, so the api/ folder is reached the same
  // way. Beaches are loaded dynamically from the database - no hardcoded list -
  // so the map always mirrors exactly the beaches registered by Tourism
  // Personnel, with their real coordinates, barangay, fee and rating.
  const MAP_API_BASE = '../api/';

  // Fallback center on Tukuran, Zamboanga del Sur (used only when no beach on
  // file has coordinates yet).
  const centerLat = 7.8520;
  const centerLng = 123.5820;

  async function fetchMapBeaches() {
    try {
      const response = await fetch(MAP_API_BASE + 'get-beaches.php');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        return result.data;
      }
      return [];
    } catch (error) {
      console.error('Error loading beaches from database:', error);
      return [];
    }
  }

  // Normalise a raw database record into the shape the map rendering uses.
  // Only records with a valid numeric latitude/longitude can be placed on the
  // map, so those are filtered out by the caller.
  function normaliseBeach(beach) {
    const lat = parseFloat(beach.latitude);
    const lng = parseFloat(beach.longitude);
    const adultFee = beach.adult_fee != null ? beach.adult_fee : 0;
    return {
      id: beach.beach_id,
      name: beach.beach_name || 'Beach',
      barangay: beach.barangay || beach.location || 'Tukuran',
      lat: lat,
      lng: lng,
      fee: '\u20B1' + adultFee,
      rating: parseFloat(beach.rating || 0).toFixed(1),
      description: beach.description || 'A coastal destination in Tukuran.',
      hasCoords: !isNaN(lat) && !isNaN(lng)
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ========================================
  // ===== INITIALIZE MAP =====
  // ========================================

  function initTukuranMap(beachData) {
    const mapContainer = document.getElementById('tukuranMap');
    if (!mapContainer) return;

    // Initialize map
    const map = L.map('tukuranMap', {
      center: [centerLat, centerLng],
      zoom: 14,
      zoomControl: false
    });

    // Add zoom control
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Clean, professional basemap (CARTO Voyager). It shows helpful geographic
    // context - roads, water, and place names - with a soft, colored palette,
    // while NOT drawing the cluttered third-party "beach resort" POI labels the
    // standard OpenStreetMap tiles render. The only beach markers on the map are
    // the accurate ones loaded from this system's database below.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '\u00A9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors \u00A9 <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Add scale control
    L.control.scale({ position: 'bottomright' }).addTo(map);

    // ========================================
    // ===== CREATE CUSTOM MARKERS =====
    // ========================================
    // Every participating beach uses the exact same umbrella beach marker for
    // a consistent, professional look - no per-beach marker styling.

    const markers = [];
    let activePopup = null;

    const iconHtml = `
      <div class="marker-pin">
        <i class="fas fa-umbrella-beach"></i>
      </div>
    `;

    const customIcon = L.divIcon({
      className: 'custom-beach-marker',
      html: iconHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });

    beachData.forEach((beach, index) => {
      // Create popup content
      const popupContent = `
        <div class="beach-popup">
          <span class="popup-name">${escapeHtml(beach.name)}</span>
          <span class="popup-barangay"><i class="fas fa-map-pin"></i> ${escapeHtml(beach.barangay)}</span>
          <span class="popup-fee"><i class="fas fa-tag"></i> ${escapeHtml(beach.fee)} entrance</span>
          <span class="popup-rating"><i class="fas fa-star"></i> ${escapeHtml(beach.rating)}</span>
          <hr class="popup-divider">
          <a href="beach-details.html?id=${beach.id}" class="popup-btn">
            <i class="fas fa-info-circle"></i> View Details
          </a>
          <a href="reservation-form.html?beach=${beach.id}" class="popup-btn" style="margin-left: 6px;">
            <i class="fas fa-calendar-check"></i> Reserve
          </a>
        </div>
      `;

      // Create marker with delay for animation effect
      setTimeout(() => {
        const marker = L.marker([beach.lat, beach.lng], {
          icon: customIcon,
          riseOnHover: true
        })
          .addTo(map)
          .bindPopup(popupContent, {
            maxWidth: 280,
            className: 'beach-popup-wrapper'
          });

        // Store marker reference
        markers.push({
          marker: marker,
          data: beach,
          index: index
        });

        // Open first marker popup by default
        if (index === 0) {
          setTimeout(() => {
            marker.openPopup();
            activePopup = marker;
          }, 600);
        }

        // Add event listener for popup open
        marker.on('popupopen', function() {
          activePopup = this;
          highlightListItem(beach.id);
        });

      }, index * 150); // Staggered animation
    });

    // Fit the map to the beaches on file so every marker is visible; fall back
    // to a single-beach view when there is only one.
    if (beachData.length > 1) {
      const bounds = L.latLngBounds(beachData.map(b => [b.lat, b.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (beachData.length === 1) {
      map.setView([beachData[0].lat, beachData[0].lng], 15);
    }

    // ========================================
    // ===== BEACH LIST SIDEBAR =====
    // ========================================

    const beachList = document.getElementById('beachList');
    if (beachList) {
      beachList.innerHTML = '';
      beachData.forEach((beach) => {
        const listItem = document.createElement('div');
        listItem.className = 'beach-list-item';
        listItem.dataset.beachId = beach.id;
        listItem.innerHTML = `
          <div class="beach-dot"></div>
          <div class="beach-info-list">
            <div class="beach-name-list">${escapeHtml(beach.name)}</div>
            <div class="beach-barangay-list">${escapeHtml(beach.barangay)}</div>
          </div>
          <div class="beach-fee-list">${escapeHtml(beach.fee)}</div>
          <div class="beach-action-list">
            <i class="fas fa-chevron-right"></i>
          </div>
        `;

        // Click to zoom to beach
        listItem.addEventListener('click', function() {
          const beachId = this.dataset.beachId;
          const beachDataItem = beachData.find(b => String(b.id) === String(beachId));

          if (beachDataItem) {
            // Find and open the corresponding marker
            const markerObj = markers.find(m => String(m.data.id) === String(beachId));
            if (markerObj) {
              map.setView([beachDataItem.lat, beachDataItem.lng], 16, {
                animate: true,
                duration: 1
              });
              markerObj.marker.openPopup();
              activePopup = markerObj.marker;
              highlightListItem(beachId);
            }
          }
        });

        beachList.appendChild(listItem);
      });
    }

    // ========================================
    // ===== HIGHLIGHT LIST ITEM =====
    // ========================================

    function highlightListItem(beachId) {
      const items = document.querySelectorAll('.beach-list-item');
      items.forEach(item => {
        item.classList.remove('active');
        if (String(item.dataset.beachId) === String(beachId)) {
          item.classList.add('active');
          // Scroll into view if needed
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    }

    // ========================================
    // ===== RESET VIEW CONTROL =====
    // ========================================

    // Add a "Reset View" button to the map controls
    const resetControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        container.style.background = '#fff';
        container.style.width = '34px';
        container.style.height = '34px';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.cursor = 'pointer';
        container.style.borderRadius = '4px';
        container.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
        container.style.marginTop = '8px';
        container.innerHTML = '<i class="fas fa-home" style="color: #1a6b7a; font-size: 16px;"></i>';

        container.onclick = function() {
          if (beachData.length > 1) {
            const bounds = L.latLngBounds(beachData.map(b => [b.lat, b.lng]));
            map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 1.2 });
          } else if (beachData.length === 1) {
            map.flyTo([beachData[0].lat, beachData[0].lng], 15, { animate: true, duration: 1.2 });
          } else {
            map.flyTo([centerLat, centerLng], 14, { animate: true, duration: 1.5 });
          }
          // Close any open popup
          if (activePopup) {
            activePopup.closePopup();
            activePopup = null;
          }
          // Remove active class from list
          document.querySelectorAll('.beach-list-item').forEach(item => {
            item.classList.remove('active');
          });
        };

        return container;
      }
    });

    map.addControl(new resetControl());

    // ========================================
    // ===== HANDLE MAP RESIZE =====
    // ========================================

    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        map.invalidateSize();
      }, 250);
    });

    // ========================================
    // ===== CLOSE POPUP ON MAP CLICK =====
    // ========================================

    map.on('click', function() {
      if (activePopup) {
        activePopup.closePopup();
        activePopup = null;
      }
      document.querySelectorAll('.beach-list-item').forEach(item => {
        item.classList.remove('active');
      });
    });

    // Return map instance
    return map;
  }

  // ========================================
  // ===== EMPTY STATE =====
  // ========================================

  function showNoBeachesState() {
    const mapContainer = document.getElementById('tukuranMap');
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:#5a7a8a; padding:40px 20px;">
          <i class="fas fa-map-marked-alt" style="font-size:2.5rem; opacity:0.5; margin-bottom:12px;"></i>
          <h3 style="font-family:'Playfair Display', serif; color:#0a2e3f; margin-bottom:6px;">No mapped beaches yet</h3>
          <p>Beach locations will appear here once their coordinates are added.</p>
        </div>
      `;
    }
    const beachList = document.getElementById('beachList');
    if (beachList) {
      beachList.innerHTML = `
        <p style="color:#5a7a8a; font-size:0.9rem; padding:8px 4px;">No beaches available yet.</p>
      `;
    }
  }

  // ========================================
  // ===== LOAD + RENDER =====
  // ========================================

  async function loadAndRenderMap() {
    const rawBeaches = await fetchMapBeaches();
    const beaches = rawBeaches
      .map(normaliseBeach)
      .filter(b => b.hasCoords); // only beaches with real coordinates can be plotted

    if (beaches.length === 0) {
      showNoBeachesState();
      return;
    }

    initTukuranMap(beaches);
  }

  // Initialize map when DOM is ready
  setTimeout(loadAndRenderMap, 200);

  console.log('\uD83D\uDDFA\uFE0F Tukuran Map page loaded with Leaflet');
});
