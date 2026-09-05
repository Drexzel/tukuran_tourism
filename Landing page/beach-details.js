// ========================================
// ===== BEACH DETAILS MODULE =====
// ========================================
// Loads the real beach record (with amenities, accommodations, and images)
// from the MySQL database via api/get-beaches.php?id=<beach_id> and
// populates every dynamic part of this page. The id comes from the
// "View Details" links on the Landing Page / Browse All Beaches
// (beach-details.html?id=<beach_id>).

const DETAILS_API_BASE = '../api/';
const DETAILS_DEFAULT_IMAGE = 'images/beach1.jpg';
// Fallback map center (Tukuran municipal hall area) used only if a beach
// has no latitude/longitude saved yet.
const DETAILS_DEFAULT_COORDS = { lat: 7.8500, lng: 123.5794 };

function getRequestedBeachId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id') || urlParams.get('beach');
}

async function fetchBeachDetails(beachId) {
  try {
    const response = await fetch(DETAILS_API_BASE + 'get-beaches.php?id=' + encodeURIComponent(beachId));
    const result = await response.json();
    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  } catch (error) {
    console.error('Error loading beach details from database:', error);
    return null;
  }
}

function renderNotFound() {
  const main = document.querySelector('.beach-details');
  if (!main) return;
  main.innerHTML = `
    <a href="browse-beaches.html" class="back-link"><i class="fas fa-arrow-left"></i> Back to Beaches</a>
    <div style="text-align:center; padding: 80px 20px; color:#5a7a8a;">
      <i class="fas fa-umbrella-beach" style="font-size: 3rem; opacity:0.5; margin-bottom: 16px; display:block;"></i>
      <h2 style="font-family:'Playfair Display', serif; color:#0a2e3f; margin-bottom:8px;">Beach not found</h2>
      <p>This beach may have been removed, or the link is invalid.</p>
    </div>
  `;
}

function renderStarIcons(rating) {
  const rounded = Math.round(rating * 2) / 2; // nearest half star
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (rounded >= i) {
      html += '<i class="fas fa-star"></i>';
    } else if (rounded >= i - 0.5) {
      html += '<i class="fas fa-star-half-alt"></i>';
    } else {
      html += '<i class="far fa-star"></i>';
    }
  }
  return html;
}

function renderBeachDetails(beach) {
  // ----- Gallery -----
  const images = (beach.images && beach.images.length > 0)
    ? beach.images.map(img => img.image_url)
    : [beach.main_image || DETAILS_DEFAULT_IMAGE];

  // Kept in module scope so the lightbox (open on any image click) can
  // navigate through the exact same set of images shown on the page.
  window.__beachGalleryImages = images;
  window.__beachGalleryName = beach.beach_name;

  const mainImg = document.getElementById('mainGalleryImg');
  if (mainImg) {
    mainImg.src = images[0];
    mainImg.alt = beach.beach_name;
    mainImg.dataset.index = 0;
    mainImg.onerror = function() { this.src = DETAILS_DEFAULT_IMAGE; };
  }

  const thumbsContainer = document.getElementById('galleryThumbs');
  if (thumbsContainer) {
    thumbsContainer.innerHTML = images.map((src, i) => `
      <img src="${src}" alt="${beach.beach_name} ${i + 1}" data-index="${i}" onclick="changeGalleryImage(this.src, ${i})" onerror="this.src='${DETAILS_DEFAULT_IMAGE}'">
    `).join('');
  }

  // ----- Header: name, rating, reviews -----
  document.title = `${beach.beach_name} \u00b7 Tukuran Beach`;
  const nameEl = document.getElementById('beachName');
  if (nameEl) nameEl.textContent = beach.beach_name;

  const rating = parseFloat(beach.rating || 0);
  const totalReviews = parseInt(beach.total_reviews || 0, 10);

  const ratingValueEl = document.getElementById('beachRatingValue');
  if (ratingValueEl) ratingValueEl.textContent = rating.toFixed(1);

  const reviewCountEl = document.getElementById('beachReviewCount');
  if (reviewCountEl) reviewCountEl.textContent = `(${totalReviews} reviews)`;

  const ratingAverageEl = document.getElementById('ratingAverage');
  if (ratingAverageEl) ratingAverageEl.textContent = rating.toFixed(1);

  const ratingCountDisplayEl = document.getElementById('ratingCountDisplay');
  if (ratingCountDisplayEl) ratingCountDisplayEl.textContent = `(${totalReviews} reviews)`;

  const ratingStarsEl = document.getElementById('ratingStars');
  if (ratingStarsEl) ratingStarsEl.innerHTML = renderStarIcons(rating);

  // ----- Meta grid -----
  const locationEl = document.getElementById('beachLocation');
  if (locationEl) {
    const barangay = beach.barangay || beach.location || 'Tukuran';
    locationEl.textContent = `Barangay ${barangay}, Tukuran`;
  }

  const capacityEl = document.getElementById('beachCapacity');
  if (capacityEl) {
    capacityEl.textContent = `${beach.current_capacity || 0} / ${beach.max_capacity || 0}`;
  }

  const childFeeEl = document.getElementById('childFee');
  if (childFeeEl) childFeeEl.textContent = `\u20b1${beach.child_fee || 0}`;

  const adultFeeEl = document.getElementById('adultFee');
  if (adultFeeEl) adultFeeEl.textContent = `\u20b1${beach.adult_fee || 0}`;

  // ----- Description -----
  const descEl = document.getElementById('beachDescription');
  if (descEl) {
    descEl.textContent = beach.description || 'No description has been provided for this beach yet.';
  }

  // ----- Accommodation types + remaining slots -----
  const accommodations = beach.accommodations || [];
  const typeIcons = {
    'Cottage': 'fa-umbrella-beach',
    'Room': 'fa-door-open',
    'Picnic Table': 'fa-chair',
    'Tent': 'fa-campground',
    'Cabana': 'fa-house-user',
    'Camping Site': 'fa-campground'
  };

  // Accommodation Types: only the names are shown up front. Clicking a
  // name reveals its remaining slots, unit count and price in the panel
  // below it, instead of duplicating every field in two separate grids.
  const typesGrid = document.getElementById('accommodationTypesGrid');
  const detailPanel = document.getElementById('accommodationDetailPanel');

  function formatPeso(value) {
    return '\u20b1' + (parseFloat(value) || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function pluralize(name) {
    return name + (name.endsWith('s') ? '' : 's');
  }

  function renderAccommodationDetail(acc) {
    if (!detailPanel) return;
    const price = parseFloat(acc.price_per_unit) || 0;
    const available = parseInt(acc.available_units, 10) || 0;
    const total = parseInt(acc.total_units, 10) || 0;
    const isFull = total > 0 && available <= 0;
    detailPanel.style.display = 'block';
    detailPanel.innerHTML = `
      <div class="accommodation-detail-header">
        <i class="fas ${typeIcons[acc.type_name] || 'fa-umbrella-beach'}"></i>
        <span>${pluralize(acc.type_name)}</span>
      </div>
      <div class="accommodation-detail-stats">
        <div class="accommodation-detail-stat">
          <span class="accommodation-detail-label">Remaining Slots</span>
          <span class="accommodation-detail-value ${isFull ? 'is-full' : ''}">${available} / ${total} Available</span>
        </div>
        ${price > 0 ? `
        <div class="accommodation-detail-stat">
          <span class="accommodation-detail-label">Price</span>
          <span class="accommodation-detail-value">${formatPeso(price)} / unit</span>
        </div>` : ''}
      </div>
      ${isFull ? '<p class="accommodation-detail-note">Fully booked for now &mdash; check back later or ask about other accommodation types.</p>' : ''}
    `;
  }

  if (typesGrid) {
    if (accommodations.length > 0) {
      typesGrid.innerHTML = accommodations.map((acc, i) => `
        <button type="button" class="accommodation-type-item" data-index="${i}">
          <i class="fas ${typeIcons[acc.type_name] || 'fa-umbrella-beach'}"></i>
          <span>${pluralize(acc.type_name)}</span>
        </button>
      `).join('');

      const buttons = typesGrid.querySelectorAll('.accommodation-type-item');
      buttons.forEach(btn => {
        btn.addEventListener('click', function() {
          buttons.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          renderAccommodationDetail(accommodations[parseInt(this.dataset.index, 10)]);
        });
      });

      // Show the first accommodation type's details by default.
      buttons[0].classList.add('active');
      renderAccommodationDetail(accommodations[0]);
    } else {
      typesGrid.innerHTML = '<p style="color:#5a7a8a;">No accommodation types listed for this beach yet.</p>';
      if (detailPanel) detailPanel.style.display = 'none';
    }
  }

  // ----- Amenities -----
  const amenities = beach.amenities || [];
  const amenityIcons = {
    'Parking Space': 'fa-car',
    'Electricity Supply': 'fa-bolt',
    'Wi-Fi / Internet Access': 'fa-wifi',
    'Comfort Rooms': 'fa-restroom',
    'Picnic Area': 'fa-tree',
    'Snack Bar': 'fa-utensils',
    'Life Vest': 'fa-life-ring',
    'Restaurant': 'fa-utensils',
    'Souvenir Shop': 'fa-store',
    'Beach Volleyball': 'fa-volleyball-ball',
    'Kayak Rental': 'fa-water',
    'Diving Equipment': 'fa-water',
    'Shower Area': 'fa-shower',
    'Cottage Rentals': 'fa-umbrella-beach'
  };

  const amenitiesGrid = document.getElementById('amenitiesGrid');
  if (amenitiesGrid) {
    amenitiesGrid.innerHTML = amenities.length > 0
      ? amenities.map(a => `
          <span class="amenity-tag"><i class="fas ${amenityIcons[a.amenity_name] || 'fa-check-circle'}"></i> ${a.amenity_name}</span>
        `).join('')
      : '<p style="color:#5a7a8a;">No amenities listed for this beach yet.</p>';
  }

  // ----- Contact info -----
  const phoneEl = document.getElementById('beachPhone');
  if (phoneEl) phoneEl.textContent = beach.phone || 'Not provided';

  const ownerEl = document.getElementById('beachOwnerName');
  if (ownerEl) ownerEl.textContent = beach.owner_name || 'Not provided';

  const fbEl = document.getElementById('beachFacebook');
  if (fbEl) {
    if (beach.facebook) {
      fbEl.textContent = beach.facebook;
      fbEl.href = beach.facebook.startsWith('http') ? beach.facebook : `https://${beach.facebook}`;
    } else {
      fbEl.textContent = 'Not provided';
      fbEl.removeAttribute('href');
    }
  }

  // ----- Reserve button -----
  const reserveBtn = document.getElementById('reserveNowBtn');
  if (reserveBtn) reserveBtn.href = `reservation-form.html?beach=${beach.beach_id}`;

  // ----- Map -----
  initBeachMap(beach);

  // ----- Ratings & Reviews (loaded live from the reviews table) -----
  loadAndRenderReviews(beach.beach_id);
}

// ========================================
// ===== RATINGS & REVIEWS (live, database-backed) =====
// ========================================
// Replaces the old hardcoded sample reviews: every review shown here, and
// the average rating/count above it, comes from api/get-reviews.php,
// which reads directly from the reviews table. Submitting the form below
// posts to api/submit-review.php, which also updates beaches.rating/
// total_reviews so the rating stays correct on Browse Beaches, Beach
// Management and Beach Ranking too.

function timeAgoOrDate(isoDateString) {
  if (!isoDateString) return '';
  const date = new Date(isoDateString.replace(' ', 'T'));
  if (isNaN(date.getTime())) return isoDateString;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderReviewStars(rating) {
  const value = Math.round(rating);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= value ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
  }
  return html;
}

function updateRatingSummary(averageRating, totalReviews) {
  const rating = parseFloat(averageRating) || 0;
  const total = parseInt(totalReviews, 10) || 0;

  const ratingValueEl = document.getElementById('beachRatingValue');
  if (ratingValueEl) ratingValueEl.textContent = total > 0 ? rating.toFixed(1) : '--';

  const reviewCountEl = document.getElementById('beachReviewCount');
  if (reviewCountEl) reviewCountEl.textContent = `(${total} review${total === 1 ? '' : 's'})`;

  const ratingAverageEl = document.getElementById('ratingAverage');
  if (ratingAverageEl) ratingAverageEl.textContent = total > 0 ? rating.toFixed(1) : '--';

  const ratingCountDisplayEl = document.getElementById('ratingCountDisplay');
  if (ratingCountDisplayEl) ratingCountDisplayEl.textContent = `(${total} review${total === 1 ? '' : 's'})`;

  const ratingStarsEl = document.getElementById('ratingStars');
  if (ratingStarsEl) ratingStarsEl.innerHTML = total > 0 ? renderStarIcons(rating) : renderStarIcons(0);
}

function renderReviewsList(reviews) {
  const container = document.getElementById('reviewsListItems');
  if (!container) return;

  if (!reviews || reviews.length === 0) {
    container.innerHTML = '<p class="reviews-empty">No reviews yet &mdash; be the first to share your experience at this beach.</p>';
    return;
  }

  container.innerHTML = reviews.map(r => `
    <div class="review-item">
      <div class="review-header">
        <div class="reviewer-info">
          <span class="reviewer-name">${r.reviewer_name || 'Anonymous'}</span>
          <span class="review-date">${timeAgoOrDate(r.created_at)}</span>
        </div>
        <div class="review-stars">${renderReviewStars(r.rating)}</div>
      </div>
      <p class="review-text">${r.comment || ''}</p>
    </div>
  `).join('');
}

async function fetchBeachReviews(beachId) {
  try {
    const response = await fetch(DETAILS_API_BASE + 'get-reviews.php?beach_id=' + encodeURIComponent(beachId));
    const result = await response.json();
    if (result.success) return result.data;
    return null;
  } catch (error) {
    console.error('Error loading reviews from database:', error);
    return null;
  }
}

async function loadAndRenderReviews(beachId) {
  const data = await fetchBeachReviews(beachId);
  if (!data) {
    renderReviewsList([]);
    return;
  }
  updateRatingSummary(data.average_rating, data.total_reviews);
  renderReviewsList(data.reviews);
}

// ========================================
// ===== LEAFLET MAP INTEGRATION =====
// ========================================

function initBeachMap(beach) {
  const mapContainer = document.getElementById('beachMap');
  if (!mapContainer || typeof L === 'undefined') return;

  const lat = beach.latitude ? parseFloat(beach.latitude) : DETAILS_DEFAULT_COORDS.lat;
  const lng = beach.longitude ? parseFloat(beach.longitude) : DETAILS_DEFAULT_COORDS.lng;
  const barangay = beach.barangay || beach.location || 'Tukuran';

  const map = L.map('beachMap').setView([lat, lng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  const customIcon = L.divIcon({
    className: 'custom-beach-marker',
    html: `<div style="background: linear-gradient(135deg, #2b8a9e, #1a6b7a); color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.35);">
              <i class="fas fa-umbrella-beach"></i>
            </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });

  const marker = L.marker([lat, lng], { icon: customIcon })
    .addTo(map)
    .bindPopup(`
      <div style="font-family: 'Inter', sans-serif; padding: 6px; min-width: 200px;">
        <strong style="color: #0a2e3f; font-size: 1.2rem; display: block;">${beach.beach_name}</strong>
        <span style="color: #5a7a8a; font-size: 0.85rem; display: block; margin: 4px 0;">
          <i class="fas fa-map-pin" style="color: #1a6b7a;"></i> Barangay ${barangay}, Tukuran
        </span>
        <hr style="margin: 8px 0; border: none; border-top: 1px solid #eef5f8;">
        <a href="#" style="color: #1a6b7a; font-weight: 600; font-size: 0.85rem; text-decoration: none; display: inline-block; background: rgba(27,107,125,0.08); padding: 6px 14px; border-radius: 20px; transition: all 0.3s;" 
           onmouseover="this.style.background='rgba(27,107,125,0.16)'" 
           onmouseout="this.style.background='rgba(27,107,125,0.08)'"
           onclick="document.querySelector('.beach-reserve .btn-primary')?.click(); return false;">
          <i class="fas fa-calendar-check"></i> Reserve Now
        </a>
      </div>
    `, { maxWidth: 280 });

  setTimeout(() => {
    marker.openPopup();
  }, 600);

  L.control.scale({ position: 'bottomright' }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      map.invalidateSize();
    }, 250);
  });

  return map;
}

async function loadAndRenderBeachDetails() {
  const beachId = getRequestedBeachId();
  if (!beachId) {
    renderNotFound();
    return;
  }
  const beach = await fetchBeachDetails(beachId);
  if (!beach) {
    renderNotFound();
    return;
  }
  renderBeachDetails(beach);
}

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========================================
  // ===== GALLERY IMAGE SWITCH =====
  // ========================================

  window.changeGalleryImage = function(src, index) {
    const mainImg = document.getElementById('mainGalleryImg');
    if (mainImg) {
      mainImg.src = src;
      if (typeof index === 'number') mainImg.dataset.index = index;
    }
  };

  // ========================================
  // ===== IMAGE PREVIEW / GALLERY LIGHTBOX =====
  // ========================================
  // Clicking the main photo or any thumbnail opens a larger, full-screen
  // preview with left/right navigation through every photo for this beach.

  const lightbox = document.getElementById('galleryLightbox');
  const lightboxImg = document.getElementById('galleryLightboxImg');
  const lightboxCount = document.getElementById('galleryLightboxCount');
  let lightboxIndex = 0;

  function getGalleryImages() {
    return window.__beachGalleryImages || [];
  }

  function showLightboxImage(index) {
    const images = getGalleryImages();
    if (images.length === 0) return;
    lightboxIndex = (index + images.length) % images.length;
    if (lightboxImg) {
      lightboxImg.src = images[lightboxIndex];
      lightboxImg.alt = `${window.__beachGalleryName || 'Beach'} ${lightboxIndex + 1}`;
      lightboxImg.onerror = function() { this.src = DETAILS_DEFAULT_IMAGE; };
    }
    if (lightboxCount) {
      lightboxCount.textContent = images.length > 1 ? `${lightboxIndex + 1} / ${images.length}` : '';
    }
  }

  function openLightbox(index) {
    if (!lightbox) return;
    showLightboxImage(index || 0);
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  const galleryMainWrap = document.getElementById('galleryMainWrap');
  if (galleryMainWrap) {
    galleryMainWrap.addEventListener('click', function() {
      const mainImg = document.getElementById('mainGalleryImg');
      openLightbox(mainImg ? parseInt(mainImg.dataset.index || 0, 10) : 0);
    });
    galleryMainWrap.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        galleryMainWrap.click();
      }
    });
  }

  // Thumbnails already swap the main preview image (changeGalleryImage,
  // set inline on each <img>); clicking one also opens the same larger
  // lightbox preview at that photo.
  const galleryThumbs = document.getElementById('galleryThumbs');
  if (galleryThumbs) {
    galleryThumbs.addEventListener('click', function(e) {
      const thumb = e.target.closest('img');
      if (!thumb) return;
      openLightbox(parseInt(thumb.dataset.index || 0, 10));
    });
  }

  document.getElementById('galleryLightboxClose')?.addEventListener('click', closeLightbox);
  document.getElementById('galleryLightboxPrev')?.addEventListener('click', () => showLightboxImage(lightboxIndex - 1));
  document.getElementById('galleryLightboxNext')?.addEventListener('click', () => showLightboxImage(lightboxIndex + 1));

  lightbox?.addEventListener('click', function(e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function(e) {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showLightboxImage(lightboxIndex - 1);
    if (e.key === 'ArrowRight') showLightboxImage(lightboxIndex + 1);
  });

  // Fetch and render the real beach record (this also initializes the map
  // once the data - including latitude/longitude - has arrived, and loads
  // the beach's real reviews).
  loadAndRenderBeachDetails();

  // ========================================
  // ===== REVIEW SUBMISSION (persisted to the database) =====
  // ========================================
  // Posts to api/submit-review.php, which inserts the review into the
  // reviews table and recalculates the beach's average rating. On success
  // the reviews list and rating summary are reloaded from the database so
  // what's shown always matches what's stored - no local-only appending.

  const reviewForm = document.getElementById('reviewForm');

  function showReviewFormMessage(text, isError) {
    const existing = reviewForm.querySelector('.review-success-message, .review-error-message');
    if (existing) existing.remove();

    const messageEl = document.createElement('div');
    messageEl.className = isError ? 'review-error-message' : 'review-success-message';
    messageEl.innerHTML = `
      <div class="review-form-message ${isError ? 'is-error' : 'is-success'}">
        <i class="fas ${isError ? 'fa-circle-exclamation' : 'fa-check-circle'}"></i>
        <span>${text}</span>
      </div>
    `;
    reviewForm.appendChild(messageEl);

    setTimeout(() => {
      messageEl.style.opacity = '0';
      messageEl.style.transition = 'opacity 0.5s ease';
      setTimeout(() => messageEl.remove(), 500);
    }, 5000);
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const beachId = getRequestedBeachId();
      const ratingInput = document.querySelector('input[name="rating"]:checked');
      const comment = document.getElementById('reviewComment');
      const reviewerName = document.getElementById('reviewerName');
      const submitBtn = this.querySelector('button[type="submit"]');

      // Validation
      if (!ratingInput) {
        alert('Please select a rating.');
        document.querySelector('.star-rating-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!comment.value.trim()) {
        alert('Please write your review.');
        comment.focus();
        return;
      }
      if (!reviewerName.value.trim()) {
        alert('Please enter your name.');
        reviewerName.focus();
        return;
      }
      if (!beachId) {
        showReviewFormMessage('Unable to submit your review right now. Please reload the page and try again.', true);
        return;
      }

      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      submitBtn.disabled = true;

      try {
        const response = await fetch(DETAILS_API_BASE + 'submit-review.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beach_id: beachId,
            rating: parseInt(ratingInput.value, 10),
            comment: comment.value.trim(),
            reviewer_name: reviewerName.value.trim()
          })
        });
        const result = await response.json();

        if (result.success) {
          reviewForm.reset();
          showReviewFormMessage('Thank you for your review!', false);
          // Reload from the database so the list and rating always match
          // what's actually stored.
          await loadAndRenderReviews(beachId);
          document.getElementById('reviewsListItems')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          showReviewFormMessage(result.message || 'Could not submit your review. Please try again.', true);
        }
      } catch (error) {
        console.error('Error submitting review:', error);
        showReviewFormMessage('Could not submit your review. Please check your connection and try again.', true);
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // ========================================
  // ===== MOBILE NAV TOGGLE =====
  // ========================================

  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

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

  // Close nav on link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function() {
      navMenu.classList.remove('open');
      const icon = navToggle?.querySelector('i');
      if (icon) icon.className = 'fas fa-bars';
    });
  });

  // Close nav on outside click
  document.addEventListener('click', function(e) {
    if (navMenu && navMenu.classList.contains('open')) {
      if (!navMenu.contains(e.target) && !navToggle?.contains(e.target)) {
        navMenu.classList.remove('open');
        const icon = navToggle?.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      }
    }
  });

  console.log('🏖️ Beach Details page loaded dynamically from the database');
});
