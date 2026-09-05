// ========================================
// ===== BROWSE BEACHES - FUNCTIONALITY =====
// ========================================

// ========================================
// ===== LOAD BEACHES FROM DATABASE =====
// ========================================

// The Browse Beaches page lives one folder below the BEACH project root,
// same as the Tourism Personnel admin pages, so the api/ folder is reached
// the same way: "../api/".
const BROWSE_API_BASE = '../api/';
const BROWSE_DEFAULT_IMAGE = '../assets/images/beach1.jpg';

async function fetchBeachesFromDatabase() {
  try {
    const response = await fetch(BROWSE_API_BASE + 'get-beaches.php');
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

function renderBrowseBeachCards(beaches) {
  const grid = document.getElementById('beachGrid');
  if (!grid) return;

  if (!beaches || beaches.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color:#5a7a8a;">
        <i class="fas fa-umbrella-beach" style="font-size: 2.5rem; opacity:0.5; margin-bottom: 12px; display: block;"></i>
        <h3 style="font-family:'Playfair Display', serif; color:#0a2e3f; margin-bottom:8px;">No beaches available yet</h3>
        <p>Please check back soon.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = beaches.map(beach => {
    const imageUrl = beach.main_image || BROWSE_DEFAULT_IMAGE;
    const barangay = beach.barangay || beach.location || 'Tukuran';
    const adultFee = beach.adult_fee || 0;
    const rating = parseFloat(beach.rating || 0).toFixed(1);
    const currentCapacity = beach.current_capacity || 0;
    const maxCapacity = beach.max_capacity || 0;
    const amenitiesList = (beach.amenities || [])
      .map(a => a.amenity_name || a)
      .slice(0, 3)
      .join(', ') || 'Contact beach for amenities';

    return `
      <div class="beach-card" data-beach-id="${beach.beach_id}">
        <div class="beach-img">
          <img src="${imageUrl}" alt="${beach.beach_name}" loading="lazy" onerror="this.src='${BROWSE_DEFAULT_IMAGE}'">
        </div>
        <div class="beach-info">
          <h3>${beach.beach_name}</h3>
          <p class="barangay">${barangay}</p>
          <div class="beach-meta">
            <span class="fee"><i class="fas fa-tag"></i> ₱${adultFee}</span>
            <span class="rating"><i class="fas fa-star"></i> ${rating}</span>
            <span class="capacity"><i class="fas fa-users"></i> ${currentCapacity}/${maxCapacity}</span>
          </div>
          <p class="amenities"><i class="fas fa-utensils"></i> ${amenitiesList}</p>
          <div class="beach-actions">
            <a href="beach-details.html?id=${beach.beach_id}" class="btn-outline">View Details</a>
            <a href="reservation-form.html?beach=${beach.beach_id}" class="btn-sm">Book Now</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Build the Location filter <option> list from the beaches actually stored in
// the database. Uses each beach's barangay (falling back to its location
// field) so the dropdown only ever shows locations that really exist, with no
// hardcoded / stale entries. The option value is the same text shown to the
// user, which keeps the filter comparison below exact and reliable.
function populateLocationFilter(beaches) {
  const select = document.getElementById('filterLocation');
  if (!select) return;

  const locations = [];
  (beaches || []).forEach(beach => {
    const loc = (beach.barangay || beach.location || '').trim();
    if (loc && !locations.includes(loc)) {
      locations.push(loc);
    }
  });

  locations.sort((a, b) => a.localeCompare(b));

  // Keep the existing default "All Locations" option (first child) and append
  // the real locations after it.
  select.length = 1;
  locations.forEach(loc => {
    const option = document.createElement('option');
    option.value = loc;
    option.textContent = loc;
    select.appendChild(option);
  });
}

async function loadAndRenderBrowseBeaches() {
  const beaches = await fetchBeachesFromDatabase();
  renderBrowseBeachCards(beaches);
  populateLocationFilter(beaches);
}

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ===== ELEMENTS =====
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');
  const filterLocation = document.getElementById('filterLocation');
  const filterPrice = document.getElementById('filterPrice');
  const searchBeach = document.getElementById('searchBeach');

  // Load beaches from the database, then wire up filtering against the
  // freshly rendered cards.
  loadAndRenderBrowseBeaches();

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
    link.addEventListener('click', function(e) {
      navMenu.classList.remove('open');
      const icon = navToggle.querySelector('i');
      if (icon) icon.className = 'fas fa-bars';
      
      // Active link highlighting
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // ===== CLOSE MOBILE NAV ON OUTSIDE CLICK =====
  document.addEventListener('click', function(e) {
    if (navMenu.classList.contains('open')) {
      if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
        navMenu.classList.remove('open');
        const icon = navToggle.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      }
    }
  });

  // ===== FILTER BEACHES =====
  function filterBeaches() {
    const location = filterLocation ? filterLocation.value.toLowerCase().trim() : '';
    const price = filterPrice ? filterPrice.value : '';
    const search = searchBeach ? searchBeach.value.toLowerCase() : '';

    // Re-query on every call since cards are rendered dynamically from the database
    const beachCards = document.querySelectorAll('.beach-card');

    beachCards.forEach(card => {
      let show = true;

      // Location filter — the dropdown values are the real location strings
      // pulled from the database, so a direct match against each card's
      // barangay label is accurate and needs no hardcoded mapping.
      if (location) {
        const barangay = card.querySelector('.barangay');
        const barangayText = barangay ? barangay.textContent.toLowerCase().trim() : '';
        if (barangayText !== location) show = false;
      }

      // Price filter
      if (show && price) {
        const feeEl = card.querySelector('.fee');
        if (feeEl) {
          const feeText = feeEl.textContent;
          const feeMatch = feeText.match(/₱(\d+)/);
          if (feeMatch) {
            const feeValue = parseInt(feeMatch[1]);
            if (price === 'low' && feeValue > 30) show = false;
            else if (price === 'medium' && (feeValue < 31 || feeValue > 60)) show = false;
            else if (price === 'high' && feeValue <= 60) show = false;
          }
        }
      }

      // Search filter
      if (show && search) {
        const name = card.querySelector('h3');
        const barangay = card.querySelector('.barangay');
        const desc = card.querySelector('.beach-desc');
        let searchMatch = false;
        if (name && name.textContent.toLowerCase().includes(search)) searchMatch = true;
        if (barangay && barangay.textContent.toLowerCase().includes(search)) searchMatch = true;
        if (desc && desc.textContent.toLowerCase().includes(search)) searchMatch = true;
        if (!searchMatch) show = false;
      }

      card.style.display = show ? 'block' : 'none';
    });

    // Show message if no results
    const visibleCards = document.querySelectorAll('.beach-card[style*="display: block"]');
    const grid = document.getElementById('beachGrid');
    let noResultsMsg = document.querySelector('.no-results');
    
    if (visibleCards.length === 0) {
      if (!noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.className = 'no-results';
        noResultsMsg.style.cssText = `
          grid-column: 1 / -1;
          text-align: center;
          padding: 60px 20px;
          color: #5a7a8a;
        `;
        noResultsMsg.innerHTML = `
          <i class="fas fa-search" style="font-size: 3rem; color: #1a6b7a; opacity: 0.4; margin-bottom: 16px; display: block;"></i>
          <h3 style="font-family: 'Playfair Display', serif; font-size: 1.6rem; color: #0a2e3f; margin-bottom: 8px;">No beaches found</h3>
          <p>Try adjusting your filters or search terms.</p>
        `;
        grid.appendChild(noResultsMsg);
      }
      noResultsMsg.style.display = 'block';
    } else {
      if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
      }
    }
  }

  // ===== ATTACH FILTER EVENTS =====
  if (filterLocation) filterLocation.addEventListener('change', filterBeaches);
  if (filterPrice) filterPrice.addEventListener('change', filterBeaches);
  if (searchBeach) searchBeach.addEventListener('input', filterBeaches);

  // ===== SMOOTH SCROLLING =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const offsetTop = targetEl.getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });

  // ===== LOGOUT FUNCTIONALITY (if any logout buttons exist) =====
  const logoutBtns = document.querySelectorAll('#logoutBtn2, .logout-link');
  
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'beach.html';
      }
    });
  });

  console.log('🏖️ Browse Beaches page ready');
});