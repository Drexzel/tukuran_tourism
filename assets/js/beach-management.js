// ========================================
// ===== BEACH MANAGEMENT - COMPLETE JS =====
// ========================================

// ========================================
// ===== API CONFIGURATION =====
// ========================================

// Get the correct API path based on current page location
function getApiBase() {
    // window.location.pathname URL-encodes spaces (e.g. "Tourism Personnel"
    // becomes "Tourism%20Personnel"), so decode before matching folder names.
    const path = decodeURIComponent(window.location.pathname);
    
    // The api/ folder lives at the BEACH project root, as a sibling of
    // "Tourism Personnel/", "Landing page/", "Beach owner page/", etc.
    // Any page one folder below BEACH root reaches it via "../api/".
    if (path.includes('/Tourism Personnel/') ||
        path.includes('/Landing page/') ||
        path.includes('/Beach owner page/') ||
        path.includes('/Log-in page/') ||
        path.includes('/pages/') ||
        path.includes('/admin/')) {
        return '../api/';
    } else if (path.includes('/api/')) {
        return './';
    } else {
        // Fallback: page is at the BEACH project root itself
        return 'api/';
    }
}

const API_BASE = getApiBase();
console.log('📡 API Base URL:', API_BASE);

// ========================================
// ===== API HELPER =====
// ========================================

async function fetchAPI(endpoint, options = {}) {
    try {
        const url = API_BASE + endpoint;
        console.log('📡 Fetching:', url);
        console.log('📤 Options:', options);
        
        // When sending FormData (e.g. file uploads), let the browser set the
        // multipart/form-data Content-Type (with boundary) automatically.
        const isFormData = (typeof FormData !== 'undefined') && (options.body instanceof FormData);
        
        const response = await fetch(url, {
            ...options,
            headers: isFormData
                ? { 'Accept': 'application/json', ...(options.headers || {}) }
                : {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(options.headers || {})
                }
        });
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Response error:', text);
            return { 
                success: false, 
                message: `Server error: ${response.status}`,
                raw: text 
            };
        }
        
        const text = await response.text();
        console.log('📥 Raw response:', text);
        
        if (!text || text.trim() === '') {
            return { success: false, message: 'Empty response from server' };
        }
        
        try {
            const data = JSON.parse(text);
            console.log('📡 Response data:', data);
            return data;
        } catch (parseError) {
            console.error('❌ JSON Parse Error:', parseError);
            return { 
                success: false, 
                message: 'Invalid JSON response',
                raw: text 
            };
        }
        
    } catch (error) {
        console.error('❌ API Error:', error);
        return { success: false, message: error.message };
    }
}

// ========================================
// ===== STATE VARIABLES =====
// ========================================

let currentStep = 1;
const totalSteps = 3;
let selectedBeachImageFiles = [];
const MAX_BEACH_IMAGES = 4;
let accommodationCounter = 1;
let isEditMode = false;
let originalData = {};

// ===== EDIT BEACH STATE =====
// When editingBeachId is set, the Add Beach modal is being reused to EDIT an
// existing beach: the form is pre-filled, the submit routes to
// update-beach.php instead of add-beach.php, existingBeachImages are shown
// with remove buttons, and removedImageIds tracks which saved images the
// user deleted (sent to the server as delete_image_ids).
let editingBeachId = null;
let existingBeachImages = [];   // [{ image_id, image_url, is_main }, ...] still kept
let removedImageIds = [];       // image_id values the user removed while editing

// ===== PAYMENT / GCASH QR STATE =====
// existingGcashQr holds the beach's currently-saved QR image path (when
// editing). removeGcashQr becomes true if the user removes it without
// choosing a replacement, telling update-beach.php to clear it.
let existingGcashQr = '';
let removeGcashQr = false;
// The newly chosen GCash QR image file, if the user picked one this session.
let selectedGcashQrFile = null;

// Leaflet map instance/marker used by the Add Beach location picker (Step 3)
let addBeachMap = null;
let addBeachMarker = null;
// Fallback map center (Tukuran municipal hall area) used only until the
// user clicks a location, matching the default used on the public Landing
// Page beach-details map.
const BEACH_MAP_DEFAULT_COORDS = { lat: 7.8500, lng: 123.5794 };

// How many more new images can still be added right now. When editing, the
// kept (not-yet-removed) existing images count toward the 4-image cap too,
// mirroring the same limit enforced server-side in update-beach.php.
function imageSlotsRemaining() {
    const keptExisting = editingBeachId ? existingBeachImages.length : 0;
    return Math.max(0, MAX_BEACH_IMAGES - keptExisting - selectedBeachImageFiles.length);
}

// ========================================
// ===== LOAD BEACHES FROM DATABASE =====
// ========================================

async function loadBeachesFromDatabase() {
    try {
        const result = await fetchAPI('get-beaches.php?all=1');
        if (result.success && result.data) {
            return result.data;
        }
        return [];
    } catch (error) {
        console.error('Error loading beaches:', error);
        return [];
    }
}

// ========================================
// ===== RENDER BEACH CARDS =====
// ========================================

function renderBeachCards(beaches) {
    const grid = document.getElementById('beachManagementGrid');
    if (!grid) return;
    
    if (!beaches || beaches.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #f8fafc; border-radius: 16px; border: 2px dashed #d1d5db;">
                <i class="fas fa-umbrella-beach" style="font-size: 3rem; color: #9ca3af; margin-bottom: 16px; display: block;"></i>
                <h3 style="color: #4b5563; margin-bottom: 8px;">No Beaches Added Yet</h3>
                <p style="color: #6b7280;">Click the "Add Beach" button to get started</p>
            </div>
        `;
        return;
    }
    
    const defaultImage = '../assets/images/beach1.jpg';
    
    grid.innerHTML = beaches.map(beach => {
        const imageUrl = beach.main_image || defaultImage;
        const locationDisplay = beach.barangay || beach.location || 'Tukuran';
        const feeDisplay = `₱${beach.adult_fee || 0} entrance`;
        const statusClass = beach.status ? beach.status.toLowerCase() : 'active';
        const remaining = (beach.max_capacity || 0) - (beach.current_capacity || 0);
        const isAvailable = remaining > 0;
        
        return `
            <div class="beach-management-card beach-card-style" data-beach-id="${beach.beach_id}">
                <div class="beach-card-image">
                    <img src="${imageUrl}" alt="${beach.beach_name}" loading="lazy" 
                         onerror="this.src='${defaultImage}'">
                    <div class="beach-card-badge">${beach.beach_name}</div>
                    <span class="status-badge ${statusClass}">${beach.status || 'Active'}</span>
                </div>
                <div class="beach-card-content">
                    <h3>${beach.beach_name}</h3>
                    <p class="beach-card-location"><i class="fas fa-map-pin"></i> ${locationDisplay}</p>
                    <p class="beach-card-fee"><i class="fas fa-tag"></i> ${feeDisplay}</p>
                    <p class="beach-card-capacity">
                        <i class="fas fa-users"></i> ${beach.current_capacity || 0}/${beach.max_capacity || 0}
                        <span class="capacity-status ${isAvailable ? 'available' : 'full'}">
                            ${isAvailable ? 'Available' : 'Full'}
                        </span>
                    </p>
                    <button class="btn-primary btn-sm" onclick="openBeachDetailsFromDB(${beach.beach_id})">
                        View Details <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// ===== REFRESH BEACH GRID =====
// ========================================

async function refreshBeachGrid() {
    console.log('🔄 Refreshing beach grid...');
    const beaches = await loadBeachesFromDatabase();
    renderBeachCards(beaches);
}

// ========================================
// ===== OPEN BEACH DETAILS FROM DB =====
// ========================================

window.openBeachDetailsFromDB = async function(beachId) {
    try {
        const result = await fetchAPI(`get-beaches.php?id=${beachId}&all=1`);
        
        if (!result.success || !result.data || result.data.length === 0) {
            alert('Beach not found');
            return;
        }
        
        const beach = result.data[0];
        const overlay = document.getElementById('beachDetailsOverlay');
        if (!overlay) return;
        
        overlay.dataset.currentBeach = beachId;
        overlay.dataset.currentBeachStatus = beach.status || 'Active';

        // Populate details
        document.getElementById('detailBeachName').textContent = beach.beach_name;
        document.getElementById('detailLocation').textContent = beach.location || 'Tukuran';
        document.getElementById('detailOwner').textContent = beach.owner_name || 'Unknown Owner';
        document.getElementById('detailFee').textContent = `Adult: ₱${beach.adult_fee || 0} | Child: ₱${beach.child_fee || 0}`;
        document.getElementById('detailMaxCapacity').textContent = beach.max_capacity || 0;
        document.getElementById('detailCurrentCapacity').textContent = beach.current_capacity || 0;
        
        const remaining = (beach.max_capacity || 0) - (beach.current_capacity || 0);
        document.getElementById('detailRemainingCapacity').textContent = remaining;
        
        const rating = beach.rating || 0;
        const reviews = beach.total_reviews || 0;
        document.getElementById('detailRating').innerHTML = 
            `<i class="fas fa-star" style="color: #f59e0b;"></i> ${parseFloat(rating).toFixed(1)} (${reviews} reviews)`;
        
        document.getElementById('detailDescription').textContent = beach.description || 'No description available.';
        
        const coordsEl = document.getElementById('detailCoordinates');
        if (coordsEl) {
            coordsEl.textContent = (beach.latitude && beach.longitude)
                ? `${parseFloat(beach.latitude).toFixed(6)}, ${parseFloat(beach.longitude).toFixed(6)}`
                : 'Not set';
        }
        
        // Status
        const statusEl = document.querySelector('.detail-status');
        if (statusEl) {
            statusEl.textContent = beach.status || 'Active';
            statusEl.className = `detail-status ${(beach.status || 'active').toLowerCase()}`;
        }

        // Deactivate/Activate action button - label, icon and color flip
        // depending on whether this beach is currently Active or not.
        updateBeachStatusActionBtn(beach.status || 'Active');
        
        // Images
        const mainImage = document.getElementById('detailMainImage');
        const defaultImage = '../assets/images/beach1.jpg';
        
        if (beach.images && beach.images.length > 0) {
            const mainImg = beach.images.find(img => img.is_main == 1) || beach.images[0];
            if (mainImage) {
                mainImage.src = mainImg.image_url;
                mainImage.onerror = function() { this.src = defaultImage; };
            }
            
            const thumbsContainer = document.getElementById('detailGalleryThumbs');
            if (thumbsContainer) {
                thumbsContainer.innerHTML = beach.images.map((img, index) => `
                    <img src="${img.image_url}" alt="Thumb ${index + 1}" 
                         onclick="changeDetailImage(this.src)" 
                         ${index === 0 ? 'class="active"' : ''}
                         onerror="this.src='${defaultImage}'">
                `).join('');
            }
        } else {
            if (mainImage) mainImage.src = defaultImage;
        }
        
        // Amenities
        const amenitiesContainer = document.getElementById('detailAmenities');
        if (amenitiesContainer) {
            if (beach.amenities && beach.amenities.length > 0) {
                amenitiesContainer.innerHTML = beach.amenities.map(a => 
                    `<span class="amenity-tag">${a.amenity_name}</span>`
                ).join('');
            } else {
                amenitiesContainer.innerHTML = '<span style="color: #6b7280; font-size: 0.9rem;">No amenities listed</span>';
            }
        }
        
        // Accommodations
        // The slot rows are now built from this beach's own accommodations
        // instead of being written into a fixed set of rows hardcoded in the
        // markup. The row markup/classes are unchanged (.slot-item /
        // .slot-label / .slot-value) so the section looks exactly the same,
        // but it now lists only the accommodation types this beach actually
        // has - any type is supported, not just a fixed Cottage/Room/Picnic
        // Table/Tent list - and it never leaves another beach's numbers on
        // screen when switching between beaches.
        const slotsContainer = document.getElementById('detailSlots');
        if (slotsContainer) {
            if (beach.accommodations && beach.accommodations.length > 0) {
                slotsContainer.innerHTML = beach.accommodations.map(acc => {
                    const price = parseFloat(acc.price_per_unit) || 0;
                    const priceHtml = price > 0
                        ? `<span class="slot-price">₱${price.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} / unit</span>`
                        : '';
                    return `
                    <div class="slot-item">
                        <span class="slot-label">${acc.type_name}</span>
                        <span class="slot-value"><strong>${acc.available_units || 0}</strong> / ${acc.total_units || 0}${priceHtml}</span>
                    </div>
                `;
                }).join('');
            } else {
                slotsContainer.innerHTML = '<span style="color: #6b7280; font-size: 0.9rem;">No accommodations listed</span>';
            }
        }
        
        // Contact
        const contactContainer = document.getElementById('detailContact');
        if (contactContainer) {
            let contactHTML = '';
            if (beach.phone) {
                contactHTML += `
                    <div class="contact-info-item">
                        <i class="fas fa-phone"></i>
                        <div><span class="contact-label">Phone</span><span class="contact-value">${beach.phone}</span></div>
                    </div>
                `;
            }
            if (beach.facebook) {
                contactHTML += `
                    <div class="contact-info-item">
                        <i class="fab fa-facebook"></i>
                        <div><span class="contact-label">Facebook</span><span class="contact-value">${beach.facebook}</span></div>
                    </div>
                `;
            }
            if (beach.website) {
                contactHTML += `
                    <div class="contact-info-item">
                        <i class="fas fa-globe"></i>
                        <div><span class="contact-label">Website</span><span class="contact-value">${beach.website}</span></div>
                    </div>
                `;
            }
            contactContainer.innerHTML = contactHTML || '<p style="color: #6b7280;">No contact information available.</p>';
        }
        
        // Map - uses the same latitude/longitude saved from the Add Beach
        // location picker to show a real interactive Leaflet map, exactly
        // like the public-facing beach details page tourists see.
        const mapContainer = document.getElementById('detailMapContainer') || document.querySelector('.map-placeholder');
        if (mapContainer) {
            if (beach.latitude && beach.longitude) {
                mapContainer.innerHTML = '<div id="detailBeachMapInner" class="leaflet-map-detail"></div>';
                renderDetailBeachMap(beach);
            } else if (beach.google_maps_link) {
                // Legacy fallback for any beach saved before the map picker existed.
                mapContainer.innerHTML = `
                    <iframe 
                        width="100%" 
                        height="200" 
                        frameborder="0" 
                        style="border-radius: 12px; border: none;"
                        src="${beach.google_maps_link}"
                        allowfullscreen>
                    </iframe>
                `;
            } else {
                mapContainer.innerHTML = `
                    <i class="fas fa-map" style="font-size: 2rem; color: #9ca3af; display: block; margin-bottom: 8px;"></i>
                    <p style="color: #6b7280;">No location map available for this beach.</p>
                `;
            }
        }
        
        // Show overlay
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('active'), 10);
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error loading beach details:', error);
        alert('Failed to load beach details. Please try again.');
    }
};

// ========================================
// ===== CHANGE GALLERY IMAGE =====
// ========================================

window.changeDetailImage = function(src) {
    const mainImage = document.getElementById('detailMainImage');
    if (mainImage) {
        mainImage.src = src;
    }
    const thumbs = document.querySelectorAll('#detailGalleryThumbs img');
    thumbs.forEach(img => {
        img.classList.toggle('active', img.src === src);
    });
};

// ========================================
// ===== CLOSE BEACH DETAILS =====
// ========================================

window.closeBeachDetails = function() {
    const overlay = document.getElementById('beachDetailsOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
};

// ========================================
// ===== EDIT / DEACTIVATE BEACH =====
// ========================================
// These reuse the existing Add Beach modal and the existing
// update-beach.php / beach-status.php endpoints. Because every public page
// (Landing Page, Browse All Beaches, Beach Details) loads its data live from
// get-beaches.php, saving an edit or deactivating a beach here is
// automatically reflected across all of those pages on their next load -
// no duplicate data to keep in sync.

// Switch the shared modal's title + submit button between Add and Edit.
function setBeachModalMode(mode) {
    const titleEl = document.querySelector('.add-beach-modal-header h2');
    const submitBtn = document.getElementById('submitBeachBtn');
    // Status (Active/Inactive) is no longer edited from this form - it's
    // only shown as an informational hint, and only while editing an
    // existing beach (a new beach doesn't have a status toggle yet).
    const statusHint = document.getElementById('editStatusHint');
    if (mode === 'edit') {
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Edit Beach';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Beach';
        if (statusHint) statusHint.style.display = '';
    } else {
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Beach';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Beach';
        if (statusHint) statusHint.style.display = 'none';
    }
}

// Render the beach's currently-saved images (edit mode only), each with a
// remove (×) button. Removed images are queued in removedImageIds and sent
// to update-beach.php as delete_image_ids.
function renderExistingImages() {
    const wrap = document.getElementById('existingImagesWrap');
    const grid = document.getElementById('existingImagesGrid');
    if (!wrap || !grid) return;

    if (!editingBeachId || existingBeachImages.length === 0) {
        wrap.style.display = 'none';
        grid.innerHTML = '';
        return;
    }

    const defaultImage = '../assets/images/beach1.jpg';
    wrap.style.display = 'block';
    grid.innerHTML = '';

    existingBeachImages.forEach((img) => {
        const item = document.createElement('div');
        item.className = 'image-thumb-item';
        item.innerHTML = `
            <img src="${img.image_url}" alt="Beach image" onerror="this.src='${defaultImage}'">
            <button type="button" class="image-thumb-remove" title="Remove image">&times;</button>
        `;
        item.querySelector('.image-thumb-remove').addEventListener('click', function() {
            if (img.image_id != null) removedImageIds.push(parseInt(img.image_id, 10));
            existingBeachImages = existingBeachImages.filter(i => i !== img);
            renderExistingImages();
        });
        grid.appendChild(item);
    });
}

// Rebuild the accommodation rows in the modal from a beach's saved
// accommodations so they can be edited (falls back to the single empty row).
function prefillAccommodations(list) {
    const container = document.getElementById('accommodationContainer');
    if (!container) return;

    if (!list || list.length === 0) {
        loadAccommodationTypes();
        return;
    }

    accommodationCounter = 0;
    container.innerHTML = '';
    list.forEach(() => {
        accommodationCounter++;
        const row = document.createElement('div');
        row.className = 'accommodation-row';
        row.innerHTML = `
            <select class="form-control accommodation-type" id="accommodationType${accommodationCounter}">
                <option value="">Select Type</option>
            </select>
            <input type="number" class="form-control accommodation-units" id="accommodationUnits${accommodationCounter}" placeholder="Units" min="0">
            <input type="number" class="form-control accommodation-price" id="accommodationPrice${accommodationCounter}" placeholder="Price" min="0" step="0.01">
            <button type="button" class="btn-remove-accommodation" onclick="removeAccommodation(this)">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(row);
    });

    // Populate every row's <select> options first, then set the saved values.
    Promise.resolve(loadAccommodationTypes()).then(() => {
        const rows = container.querySelectorAll('.accommodation-row');
        rows.forEach((row, idx) => {
            const acc = list[idx];
            if (!acc) return;
            const typeSel = row.querySelector('.accommodation-type');
            const unitsInput = row.querySelector('.accommodation-units');
            const priceInput = row.querySelector('.accommodation-price');
            if (typeSel) typeSel.value = acc.type_name || '';
            if (unitsInput) unitsInput.value = (acc.total_units != null ? acc.total_units : '');
            if (priceInput) priceInput.value = (acc.price_per_unit != null ? acc.price_per_unit : '');
        });
        document.querySelectorAll('.btn-remove-accommodation').forEach((btn, index) => {
            btn.style.display = (index === 0 && document.querySelectorAll('.accommodation-row').length === 1)
                ? 'none' : 'inline-flex';
        });
    });
}

// Open the shared modal pre-filled with an existing beach's data for editing.
window.openEditBeachModal = async function(beachId) {
    if (!beachId) return;
    try {
        const result = await fetchAPI(`get-beaches.php?id=${beachId}&all=1`);
        if (!result.success || !result.data || result.data.length === 0) {
            alert('Beach not found. It may have already been deleted.');
            return;
        }
        const beach = result.data[0];

        // We're switching from the details overlay to the edit form. Hide the
        // overlay synchronously (not via closeBeachDetails(), whose delayed
        // body-overflow reset would otherwise race the modal we're about to
        // open and re-enable page scrolling underneath it).
        const detailsOverlay = document.getElementById('beachDetailsOverlay');
        if (detailsOverlay) {
            detailsOverlay.classList.remove('active');
            detailsOverlay.style.display = 'none';
        }

        // Enter edit mode and seed image state.
        editingBeachId = parseInt(beachId, 10);
        existingBeachImages = Array.isArray(beach.images) ? beach.images.slice() : [];
        removedImageIds = [];
        selectedBeachImageFiles = [];

        const modal = document.getElementById('addBeachModal');
        if (!modal) return;

        const form = document.getElementById('addBeachForm');
        if (form) form.reset();
        resetAddBeachMap();
        setBeachModalMode('edit');

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        currentStep = 1;
        showStep(1);

        // ----- Step 1: basic info -----
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val ?? ''); };
        setVal('beachName', beach.beach_name);
        setVal('beachLocation', beach.location);
        setVal('maxCapacity', beach.max_capacity);
        setVal('adultFee', beach.adult_fee != null ? beach.adult_fee : 0);
        setVal('childFee', beach.child_fee != null ? beach.child_fee : 0);
        setVal('beachDescription', beach.description);
        setVal('contactFacebook', beach.facebook);
        setVal('contactWebsite', beach.website);
        setVal('beachLatitude', beach.latitude != null ? beach.latitude : '');
        setVal('beachLongitude', beach.longitude != null ? beach.longitude : '');

        // ----- Payment details (GCash only; bank fields were removed) -----
        setVal('gcashNumber', beach.gcash_number);
        setVal('gcashName', beach.gcash_name);
        // Track the beach's currently-saved QR so we know whether to keep,
        // replace, or remove it on save.
        existingGcashQr = (beach.gcash_qr || '').trim();
        removeGcashQr = false;
        const gcashQrInput = document.getElementById('gcashQrFile');
        if (gcashQrInput) gcashQrInput.value = '';
        renderGcashQrPreview();

        // ----- Images -----
        renderImagePreviews();   // clears any leftover new-file previews
        renderExistingImages();  // shows the saved images with remove buttons

        // ----- Step 2: amenities (load, then tick the ones this beach has) -----
        await loadAmenities();
        const beachAmenityNames = (beach.amenities || []).map(a => a.amenity_name);
        document.querySelectorAll('#amenitiesCheckboxGrid input[type="checkbox"]').forEach(cb => {
            cb.checked = beachAmenityNames.includes(cb.value);
        });
        resetOthersAmenity();

        // ----- Step 2: accommodations -----
        prefillAccommodations(beach.accommodations || []);

        console.log('✏️ Edit modal opened for beach', editingBeachId);
    } catch (err) {
        console.error('Error opening edit modal:', err);
        alert('Failed to load beach for editing. Please try again.');
    }
};

// Called by the "Edit Beach" button in the details overlay.
window.editCurrentBeach = function() {
    const overlay = document.getElementById('beachDetailsOverlay');
    const beachId = overlay ? overlay.dataset.currentBeach : null;
    if (!beachId) { alert('No beach selected.'); return; }
    window.openEditBeachModal(beachId);
};

// Flip the "Deactivate/Activate Beach" button's label, icon and color to
// match the beach currently open in the details overlay.
function updateBeachStatusActionBtn(status) {
    const btn = document.getElementById('beachStatusActionBtn');
    if (!btn) return;
    const isActive = (status || 'Active') === 'Active';
    btn.classList.toggle('btn-delete-beach', isActive);
    btn.classList.toggle('btn-activate-beach', !isActive);
    btn.innerHTML = isActive
        ? '<i class="fas fa-ban"></i> Deactivate Beach'
        : '<i class="fas fa-check"></i> Activate Beach';
}

// Called by the "Deactivate/Activate Beach" button in the details overlay.
window.handleBeachStatusAction = function() {
    const overlay = document.getElementById('beachDetailsOverlay');
    const beachId = overlay ? overlay.dataset.currentBeach : null;
    const currentStatus = overlay ? overlay.dataset.currentBeachStatus : 'Active';
    const nameEl = document.getElementById('detailBeachName');
    const beachName = nameEl ? nameEl.textContent.trim() : 'this beach';
    if (!beachId) { alert('No beach selected.'); return; }

    if (currentStatus === 'Active') {
        deactivateBeach(beachId, beachName, false);
    } else {
        activateBeach(beachId, beachName);
    }
};

// Reactivating doesn't need the reservation-conflict check - a beach that's
// already accepting reservations again just needs a quick confirmation.
async function activateBeach(beachId, beachName) {
    const confirmed = confirm(`Activate "${beachName}"?\n\nIt will accept new reservations again and reappear on the Landing Page, Browse All Beaches and Beach Details.`);
    if (!confirmed) return;

    const btn = document.getElementById('beachStatusActionBtn');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Activating...';
    }

    try {
        const result = await fetchAPI('beach-status.php', {
            method: 'POST',
            body: JSON.stringify({ beach_id: parseInt(beachId, 10), action: 'activate' })
        });

        if (result.success) {
            const overlay = document.getElementById('beachDetailsOverlay');
            if (overlay) overlay.dataset.currentBeachStatus = 'Active';
            updateBeachStatusActionBtn('Active');
            const statusEl = document.querySelector('.detail-status');
            if (statusEl) { statusEl.textContent = 'Active'; statusEl.className = 'detail-status active'; }
            await refreshBeachGrid();
            alert(`✅ "${beachName}" is now active.`);
        } else {
            alert('❌ ' + (result.message || 'Failed to activate beach. Please try again.'));
        }
    } catch (err) {
        console.error('Error activating beach:', err);
        alert('An error occurred while activating the beach: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; if (originalHtml) btn.innerHTML = originalHtml; }
    }
}

// Deactivating checks for active (Pending/Confirmed) reservations first.
// If any exist and this isn't a confirmed retry, show the warning modal
// with the list instead of deactivating right away.
async function deactivateBeach(beachId, beachName, confirmOverride) {
    const btn = document.getElementById('beachStatusActionBtn');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Checking...';
    }

    try {
        const result = await fetchAPI('beach-status.php', {
            method: 'POST',
            body: JSON.stringify({
                beach_id: parseInt(beachId, 10),
                action: 'deactivate',
                confirm: !!confirmOverride
            })
        });

        if (result.success) {
            const overlay = document.getElementById('beachDetailsOverlay');
            if (overlay) overlay.dataset.currentBeachStatus = 'Inactive';
            updateBeachStatusActionBtn('Inactive');
            const statusEl = document.querySelector('.detail-status');
            if (statusEl) { statusEl.textContent = 'Inactive'; statusEl.className = 'detail-status inactive'; }
            closeDeactivateBeachModal();
            await refreshBeachGrid();
            alert(`✅ "${beachName}" has been deactivated. It no longer accepts new reservations.`);
            if (btn) { btn.disabled = false; }
            return;
        }

        if (result.requires_confirmation) {
            openDeactivateBeachModal(beachId, beachName, result.active_count, result.active_reservations || []);
            if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
            return;
        }

        alert('❌ ' + (result.message || 'Failed to deactivate beach. Please try again.'));
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
    } catch (err) {
        console.error('Error deactivating beach:', err);
        alert('An error occurred while deactivating the beach: ' + err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
    }
}

// ========================================
// ===== DEACTIVATE BEACH WARNING MODAL =====
// ========================================

function openDeactivateBeachModal(beachId, beachName, activeCount, activeReservations) {
    const modal = document.getElementById('deactivateBeachModal');
    if (!modal) {
        // Fallback in case the modal markup is missing for some reason -
        // still let Tourism Personnel proceed via a plain confirm().
        const proceed = confirm(`"${beachName}" has ${activeCount} active reservation(s). Deactivate anyway? Existing reservations will not be changed.`);
        if (proceed) deactivateBeach(beachId, beachName, true);
        return;
    }

    modal.dataset.beachId = beachId;
    modal.dataset.beachName = beachName;

    const warningText = document.getElementById('deactivateBeachWarningText');
    if (warningText) {
        warningText.textContent = `"${beachName}" has ${activeCount} active reservation${activeCount === 1 ? '' : 's'}. Review below before deactivating.`;
    }

    const listEl = document.getElementById('activeReservationsList');
    if (listEl) {
        const shown = activeReservations.slice(0, 10);
        listEl.innerHTML = shown.map(r => {
            const statusClass = (r.status || '').toLowerCase();
            const dateDisplay = r.reservation_date
                ? new Date(r.reservation_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '';
            return `
                <div class="active-reservation-row">
                    <span class="res-name">${r.full_name || 'Guest'}</span>
                    <span class="res-date">${dateDisplay}</span>
                    <span class="res-status-tag ${statusClass}">${r.status || ''}</span>
                </div>
            `;
        }).join('');
        if (activeCount > shown.length) {
            listEl.innerHTML += `<div class="active-reservations-more">+ ${activeCount - shown.length} more</div>`;
        }
    }

    modal.classList.add('active');
}

function closeDeactivateBeachModal() {
    const modal = document.getElementById('deactivateBeachModal');
    if (modal) {
        modal.classList.remove('active');
        delete modal.dataset.beachId;
        delete modal.dataset.beachName;
    }
}

// Wire up the modal's Cancel / "Deactivate Anyway" buttons once on load.
document.addEventListener('DOMContentLoaded', function() {
    const cancelBtn = document.getElementById('cancelDeactivateBeach');
    const confirmBtn = document.getElementById('confirmDeactivateBeach');
    const modal = document.getElementById('deactivateBeachModal');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeDeactivateBeachModal);
    }
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            const beachId = modal ? modal.dataset.beachId : null;
            const beachName = modal ? modal.dataset.beachName : 'this beach';
            if (!beachId) return;
            deactivateBeach(beachId, beachName, true);
        });
    }
    // Click on the dimmed backdrop closes it, same as other modals in the app.
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeDeactivateBeachModal();
        });
    }
});



// ========================================
// ===== ADD BEACH MODAL FUNCTIONS =====
// ========================================

window.openAddBeachModal = function() {
    console.log('🔓 Opening Add Beach modal...');
    const modal = document.getElementById('addBeachModal');
    if (!modal) {
        console.error('❌ Modal not found');
        return;
    }
    
    // Always open in "add" mode - clear any leftover edit state so the
    // shared modal doesn't accidentally submit as an update.
    editingBeachId = null;
    existingBeachImages = [];
    removedImageIds = [];
    renderExistingImages(); // hides the existing-images section
    clearGcashQrState();
    setBeachModalMode('add');

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    currentStep = 1;
    showStep(1);
    loadAmenities();
    loadAccommodationTypes();
    console.log('✅ Modal opened');
};

window.closeAddBeachModal = function() {
    console.log('🔒 Closing Add Beach modal...');
    const modal = document.getElementById('addBeachModal');
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
    const form = document.getElementById('addBeachForm');
    if (form) form.reset();
    
    // Reset accommodation container
    const container = document.getElementById('accommodationContainer');
    if (container) {
        container.innerHTML = `
            <div class="accommodation-row">
                <select class="form-control accommodation-type" id="accommodationType1">
                    <option value="">Select Type</option>
                </select>
                <input type="number" class="form-control accommodation-units" id="accommodationUnits1" placeholder="Units" min="0">
                <input type="number" class="form-control accommodation-price" id="accommodationPrice1" placeholder="Price" min="0" step="0.01">
                <button type="button" class="btn-remove-accommodation" onclick="removeAccommodation(this)" style="display:none;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }
    accommodationCounter = 1;

    // Reset the "Others" amenity checkbox + custom text box.
    resetOthersAmenity();
    
    // Reset selected beach images + preview
    selectedBeachImageFiles = [];
    renderImagePreviews();
    const imagesInput = document.getElementById('beachImages');
    if (imagesInput) imagesInput.value = '';

    // Reset the GCash QR selection/preview state.
    clearGcashQrState();

    // Reset edit-mode state so the next open starts clean as "Add Beach".
    editingBeachId = null;
    existingBeachImages = [];
    removedImageIds = [];
    renderExistingImages(); // hides the existing-images section
    setBeachModalMode('add');

    // Reset the location-picker map/marker so re-opening the modal starts fresh
    resetAddBeachMap();
    
    // Hide any error messages
    document.querySelectorAll('.form-error-message').forEach(err => err.remove());
    document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
    
    // Remove success message if exists
    const successDiv = document.querySelector('.beach-added-success');
    if (successDiv) successDiv.remove();
    const formEl = document.getElementById('addBeachForm');
    if (formEl) formEl.style.display = '';
    
    // Reset submit button
    const submitBtn = document.getElementById('submitBeachBtn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Beach';
        submitBtn.disabled = false;
    }
};

// ========================================
// ===== STEP NAVIGATION =====
// ========================================

function showStep(step) {
    document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
    
    const stepEl = document.getElementById('step' + step);
    if (stepEl) stepEl.classList.add('active');
    
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const submitBtn = document.getElementById('submitBeachBtn');
    
    if (prevBtn) {
        prevBtn.style.display = step === 1 ? 'none' : 'inline-flex';
    }
    
    if (nextBtn && submitBtn) {
        if (step === totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    }

    // The location-picker map lives on Step 3. Leaflet can't size itself
    // correctly inside a container that was just display:none, so we
    // (re)initialize/resize it only once that step is actually visible.
    if (step === 3) {
        setTimeout(initAddBeachMap, 50);
    }
}

// ========================================
// ===== ADD BEACH LOCATION PICKER MAP =====
// ========================================
// Lets Tourism Personnel click (or drag the pin) directly on a Leaflet map
// to set a beach's exact coordinates, instead of typing a Google Maps
// link. Latitude/Longitude fields are auto-filled from the pin and are
// still what actually gets sent to the server in collectFormData().
function initAddBeachMap() {
    const mapEl = document.getElementById('addBeachMap');
    if (!mapEl || typeof L === 'undefined') return;

    // Already initialized for this modal session - just make sure Leaflet
    // recalculates its size now that the container is visible.
    if (addBeachMap) {
        addBeachMap.invalidateSize();
        return;
    }

    const latField = document.getElementById('beachLatitude');
    const lngField = document.getElementById('beachLongitude');

    const existingLat = latField && latField.value ? parseFloat(latField.value) : null;
    const existingLng = lngField && lngField.value ? parseFloat(lngField.value) : null;

    const startCenter = (existingLat && existingLng)
        ? [existingLat, existingLng]
        : [BEACH_MAP_DEFAULT_COORDS.lat, BEACH_MAP_DEFAULT_COORDS.lng];

    addBeachMap = L.map('addBeachMap').setView(startCenter, existingLat ? 16 : 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(addBeachMap);

    const pinIcon = L.divIcon({
        className: 'custom-beach-marker',
        html: `<div style="background: linear-gradient(135deg, #2b8a9e, #1a6b7a); color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 15px; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.35);">
                    <i class="fas fa-umbrella-beach"></i>
                  </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34]
    });

    function setCoordFields(lat, lng) {
        if (latField) latField.value = lat.toFixed(7);
        if (lngField) lngField.value = lng.toFixed(7);
    }

    function placeMarker(latlng) {
        if (addBeachMarker) {
            addBeachMarker.setLatLng(latlng);
        } else {
            addBeachMarker = L.marker(latlng, { icon: pinIcon, draggable: true }).addTo(addBeachMap);
            addBeachMarker.on('dragend', function() {
                const pos = addBeachMarker.getLatLng();
                setCoordFields(pos.lat, pos.lng);
            });
        }
        setCoordFields(latlng.lat, latlng.lng);
    }

    // If this beach already had coordinates (shouldn't normally happen on
    // a fresh Add Beach form, but keeps behavior consistent), show the pin.
    if (existingLat && existingLng) {
        placeMarker({ lat: existingLat, lng: existingLng });
    }

    addBeachMap.on('click', function(e) {
        placeMarker(e.latlng);
    });

    // Leaflet sometimes needs a nudge once the modal's CSS transition/layout
    // has fully settled.
    setTimeout(() => addBeachMap.invalidateSize(), 100);
}

function resetAddBeachMap() {
    if (addBeachMap) {
        addBeachMap.remove();
    }
    addBeachMap = null;
    addBeachMarker = null;
}

// ========================================
// ===== BEACH DETAILS - READ-ONLY MAP =====
// ========================================
// Shows the beach's saved coordinates on a real Leaflet map inside the
// Tourism Personnel "View Details" overlay - same coordinates the public
// Landing Page beach-details.js map uses, just not click-to-edit here.
function renderDetailBeachMap(beach) {
    const mapEl = document.getElementById('detailBeachMapInner');
    if (!mapEl || typeof L === 'undefined') return;

    const lat = parseFloat(beach.latitude);
    const lng = parseFloat(beach.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const map = L.map('detailBeachMapInner', { zoomControl: false }).setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    const pinIcon = L.divIcon({
        className: 'custom-beach-marker',
        html: `<div style="background: linear-gradient(135deg, #2b8a9e, #1a6b7a); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.35);">
                    <i class="fas fa-umbrella-beach"></i>
                  </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    setTimeout(() => map.invalidateSize(), 100);
}

window.nextStep = function() {
    if (validateStep(currentStep)) {
        if (currentStep < totalSteps) {
            currentStep++;
            showStep(currentStep);
        }
    }
};

window.prevStep = function() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
};

// ========================================
// ===== STEP VALIDATION =====
// ========================================

function validateStep(step) {
    let isValid = true;
    
    document.querySelectorAll('.form-error-message').forEach(el => el.remove());
    
    if (step === 1) {
        const beachName = document.getElementById('beachName');
        const location = document.getElementById('beachLocation');
        const maxCapacity = document.getElementById('maxCapacity');
        
        if (!beachName || !beachName.value.trim()) {
            if (beachName) beachName.classList.add('error');
            isValid = false;
            showError('Please enter the beach name.');
        } else if (beachName) {
            beachName.classList.remove('error');
        }
        
        if (!location || !location.value.trim()) {
            if (location) location.classList.add('error');
            isValid = false;
            showError('Please enter the beach location.');
        } else if (location) {
            location.classList.remove('error');
        }
        
        if (!maxCapacity || !maxCapacity.value || parseInt(maxCapacity.value) < 1) {
            if (maxCapacity) maxCapacity.classList.add('error');
            isValid = false;
            showError('Please enter a valid maximum capacity (at least 1).');
        } else if (maxCapacity) {
            maxCapacity.classList.remove('error');
        }
    }
    
    if (step === 2) {
        const rows = document.querySelectorAll('.accommodation-row');
        let hasAccommodation = false;
        rows.forEach(row => {
            const type = row.querySelector('.accommodation-type');
            const units = row.querySelector('.accommodation-units');
            if (type && type.value && units && parseInt(units.value) > 0) {
                hasAccommodation = true;
            }
        });
        
        if (!hasAccommodation) {
            isValid = false;
            showError('Please add at least one accommodation type with units.');
        }
    }
    
    return isValid;
}

function showError(message) {
    const existing = document.querySelector('.form-error-message');
    if (existing) existing.remove();
    
    const error = document.createElement('div');
    error.className = 'form-error-message';
    error.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    const step = document.querySelector('.form-step.active');
    if (step) {
        step.insertBefore(error, step.firstChild);
    }
    
    setTimeout(() => {
        if (error.parentNode) error.remove();
    }, 4000);
}

// ========================================
// ===== LOAD AMENITIES =====
// ========================================

async function loadAmenities() {
    try {
        const data = await fetchAPI('get-amenities.php');
        const container = document.getElementById('amenitiesCheckboxGrid');
        if (!container) return;
        
        if (data.success && data.data && data.data.length > 0) {
            container.innerHTML = data.data.map(amenity => `
                <div class="amenity-checkbox-item">
                    <input type="checkbox" id="amenity_${amenity.amenity_id}" value="${amenity.amenity_name}">
                    <label for="amenity_${amenity.amenity_id}">${amenity.amenity_name}</label>
                </div>
            `).join('');
        } else {
            const fallbackAmenities = [
                'Parking Space', 'Electricity Supply', 'Wi-Fi / Internet Access',
                'Comfort Rooms', 'Picnic Area', 'Snack Bar', 'Life Vest',
                'Restaurant', 'Souvenir Shop', 'Beach Volleyball', 'Kayak Rental',
                'Diving Equipment', 'Shower Area', 'Cottage Rentals'
            ];
            container.innerHTML = fallbackAmenities.map((name, index) => `
                <div class="amenity-checkbox-item">
                    <input type="checkbox" id="amenity_fallback_${index}" value="${name}">
                    <label for="amenity_fallback_${index}">${name}</label>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading amenities:', error);
    }
}

// ===== "Others" amenity =====
// Show/hide the custom-amenity text box when the Others checkbox is toggled.
// A delegated listener on document is used so it keeps working even though
// initializeBeachManagement() clones (and thus replaces) the form node.
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'amenityOthersCheck') {
        const input = document.getElementById('amenityOthersInput');
        if (input) {
            input.style.display = e.target.checked ? '' : 'none';
            if (e.target.checked) input.focus();
        }
    }
});

// Clears the Others checkbox + text box (used when opening/resetting the form).
function resetOthersAmenity() {
    const check = document.getElementById('amenityOthersCheck');
    const input = document.getElementById('amenityOthersInput');
    if (check) check.checked = false;
    if (input) { input.value = ''; input.style.display = 'none'; }
}

// ========================================
// ===== LOAD ACCOMMODATION TYPES =====
// ========================================

async function loadAccommodationTypes() {
    try {
        const data = await fetchAPI('get-accommodation-types.php');
        const selects = document.querySelectorAll('.accommodation-type');
        if (!selects.length) return;
        
        let optionsHtml = '<option value="">Select Type</option>';
        
        if (data.success && data.data && data.data.length > 0) {
            data.data.forEach(type => {
                const typeName = type.type_name || type.name || type;
                optionsHtml += `<option value="${typeName}">${typeName}</option>`;
            });
        } else {
            const fallbackTypes = ['Cottage', 'Room', 'Picnic Table', 'Tent', 'Cabana', 'Camping Site'];
            fallbackTypes.forEach(type => {
                optionsHtml += `<option value="${type}">${type}</option>`;
            });
        }
        
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = optionsHtml;
            if (currentValue) {
                select.value = currentValue;
            }
        });
    } catch (error) {
        console.error('Error loading accommodation types:', error);
    }
}

// ========================================
// ===== ADD ACCOMMODATION ROW =====
// ========================================

window.addAccommodationRow = function() {
    accommodationCounter++;
    const container = document.getElementById('accommodationContainer');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'accommodation-row';
    row.innerHTML = `
        <select class="form-control accommodation-type" id="accommodationType${accommodationCounter}">
            <option value="">Select Type</option>
        </select>
        <input type="number" class="form-control accommodation-units" id="accommodationUnits${accommodationCounter}" placeholder="Units" min="0">
        <input type="number" class="form-control accommodation-price" id="accommodationPrice${accommodationCounter}" placeholder="Price" min="0" step="0.01">
        <button type="button" class="btn-remove-accommodation" onclick="removeAccommodation(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(row);
    loadAccommodationTypes();
    
    document.querySelectorAll('.btn-remove-accommodation').forEach((btn, index) => {
        btn.style.display = index === 0 && document.querySelectorAll('.accommodation-row').length === 1 ? 'none' : 'inline-flex';
    });
};

window.removeAccommodation = function(button) {
    const row = button.closest('.accommodation-row');
    const container = document.getElementById('accommodationContainer');
    if (container && container.children.length > 1) {
        row.remove();
        document.querySelectorAll('.btn-remove-accommodation').forEach((btn, index) => {
            btn.style.display = index === 0 && document.querySelectorAll('.accommodation-row').length === 1 ? 'none' : 'inline-flex';
        });
    }
};

// ========================================
// ===== COLLECT FORM DATA =====
// ========================================

// ========================================
// ===== MULTI-IMAGE PREVIEW =====
// ========================================

function renderImagePreviews() {
    const wrap = document.getElementById('beachImagePreviewWrap');
    const grid = document.getElementById('beachImagePreviewGrid');
    if (!wrap || !grid) return;

    if (selectedBeachImageFiles.length === 0) {
        wrap.style.display = 'none';
        grid.innerHTML = '';
        return;
    }

    wrap.style.display = 'block';
    grid.innerHTML = '';

    selectedBeachImageFiles.forEach((file, index) => {
        const reader = new FileReader();
        const thumb = document.createElement('div');
        thumb.className = 'image-thumb-item';
        thumb.innerHTML = `
            <img src="" alt="Beach image ${index + 1}">
            <button type="button" class="image-thumb-remove" title="Remove">&times;</button>
        `;
        grid.appendChild(thumb);

        reader.onload = function(e) {
            const img = thumb.querySelector('img');
            if (img) img.src = e.target.result;
        };
        reader.onerror = function() {
            console.error('❌ Could not read image for preview:', file.name);
        };
        reader.readAsDataURL(file);

        thumb.querySelector('.image-thumb-remove').addEventListener('click', function() {
            selectedBeachImageFiles.splice(index, 1);
            renderImagePreviews();
        });
    });
}

// ========================================
// ===== GCASH QR PREVIEW =====
// ========================================
// Shows either the newly-selected QR file, or (when editing) the beach's
// already-saved QR image. The × button removes whichever is shown.
function renderGcashQrPreview() {
    const wrap = document.getElementById('gcashQrPreviewWrap');
    const img = document.getElementById('gcashQrPreview');
    if (!wrap || !img) return;

    if (selectedGcashQrFile) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(selectedGcashQrFile);
        wrap.style.display = 'block';
        return;
    }

    if (editingBeachId && existingGcashQr && !removeGcashQr) {
        img.src = existingGcashQr;
        wrap.style.display = 'block';
        return;
    }

    img.src = '';
    wrap.style.display = 'none';
}

function clearGcashQrState() {
    selectedGcashQrFile = null;
    existingGcashQr = '';
    removeGcashQr = false;
    const input = document.getElementById('gcashQrFile');
    if (input) input.value = '';
    renderGcashQrPreview();
}

function collectFormData() {
    const selectedAmenities = [];
    document.querySelectorAll('#amenitiesCheckboxGrid input[type="checkbox"]:checked').forEach(cb => {
        selectedAmenities.push(cb.value);
    });

    // "Others" amenity: save the custom value together with the selected
    // amenities when the Others box is ticked and a value was entered.
    const othersCheck = document.getElementById('amenityOthersCheck');
    const othersInput = document.getElementById('amenityOthersInput');
    if (othersCheck && othersCheck.checked && othersInput && othersInput.value.trim() !== '') {
        selectedAmenities.push(othersInput.value.trim());
    }
    
    const accommodations = [];
    document.querySelectorAll('.accommodation-row').forEach(row => {
        const type = row.querySelector('.accommodation-type');
        const units = row.querySelector('.accommodation-units');
        const price = row.querySelector('.accommodation-price');
        if (type && type.value && units && parseInt(units.value) > 0) {
            accommodations.push({
                type: type.value,
                units: parseInt(units.value),
                price: (price && price.value !== '') ? (parseFloat(price.value) || 0) : 0
            });
        }
    });

    // Small helper so a field that's momentarily missing from the DOM
    // (e.g. right after the modal was reset) degrades to an empty value
    // instead of throwing "Cannot read properties of null".
    const fieldValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    
    // Build a FormData payload (not plain JSON) so the uploaded beach
    // image file can be sent to the server in the same request.
    const formData = new FormData();
    formData.append('beach_name', fieldValue('beachName').trim());
    // Status (Active/Inactive) is no longer sent from this form - it's
    // managed exclusively via the Deactivate/Activate button (see
    // handleBeachStatusAction() below), which calls api/beach-status.php.
    // add-beach.php applies the default ('Active') for new beaches, and
    // update-beach.php now preserves the beach's current status untouched.
    formData.append('location', fieldValue('beachLocation').trim());
    formData.append('adult_fee', parseFloat(fieldValue('adultFee')) || 0);
    formData.append('child_fee', parseFloat(fieldValue('childFee')) || 0);
    formData.append('max_capacity', parseInt(fieldValue('maxCapacity')) || 0);
    formData.append('description', fieldValue('beachDescription').trim());

    const latitude = parseFloat(fieldValue('beachLatitude'));
    const longitude = parseFloat(fieldValue('beachLongitude'));
    formData.append('latitude', isNaN(latitude) ? '' : latitude);
    formData.append('longitude', isNaN(longitude) ? '' : longitude);

    formData.append('facebook', fieldValue('contactFacebook').trim());
    formData.append('website', fieldValue('contactWebsite').trim());

    // ----- Payment details (GCash only; bank fields were removed) -----
    formData.append('gcash_number', fieldValue('gcashNumber').trim());
    formData.append('gcash_name', fieldValue('gcashName').trim());

    // GCash QR image: send the newly chosen file if any; otherwise, when
    // editing, tell the server whether to keep or clear the existing one.
    if (selectedGcashQrFile) {
        formData.append('gcash_qr', selectedGcashQrFile);
    }
    if (editingBeachId) {
        formData.append('remove_gcash_qr', (removeGcashQr && !selectedGcashQrFile) ? '1' : '0');
    }

    formData.append('amenities', JSON.stringify(selectedAmenities));
    formData.append('accommodations', JSON.stringify(accommodations));

    selectedBeachImageFiles.forEach(file => {
        formData.append('beach_images[]', file);
    });

    // When editing, tell update-beach.php which beach and which of its saved
    // images to remove. (add-beach.php simply ignores these extra fields.)
    if (editingBeachId) {
        formData.append('beach_id', editingBeachId);
        formData.append('delete_image_ids', JSON.stringify(removedImageIds));
    }

    return formData;
}

// ========================================
// ===== TOGGLE EDIT MODE =====
// ========================================

window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const editBtn = document.getElementById('editDetailsBtn');
    const saveBtn = document.getElementById('saveDetailsBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    
    if (isEditMode) {
        document.querySelectorAll('.detail-item span:not(.detail-rating)').forEach(el => {
            if (!el.closest('.detail-rating')) {
                el.contentEditable = true;
                el.parentElement.classList.add('editable');
            }
        });
        const desc = document.getElementById('detailDescription');
        if (desc) {
            desc.contentEditable = true;
            desc.style.cssText = 'background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.10);';
        }
        if (editBtn) editBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'inline-flex';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    } else {
        resetEditMode();
    }
};

function resetEditMode() {
    const editBtn = document.getElementById('editDetailsBtn');
    const saveBtn = document.getElementById('saveDetailsBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    
    document.querySelectorAll('.detail-item span').forEach(el => {
        el.contentEditable = false;
        el.parentElement.classList.remove('editable');
    });
    const desc = document.getElementById('detailDescription');
    if (desc) {
        desc.contentEditable = false;
        desc.style.cssText = '';
    }
    if (editBtn) editBtn.style.display = 'inline-flex';
    if (saveBtn) saveBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

window.cancelEdit = function() {
    resetEditMode();
};

window.saveDetails = function() {
    alert('✅ Changes saved successfully!');
    resetEditMode();
};

// ========================================
// ===== INITIALIZE BEACH MANAGEMENT =====
// ========================================

function initializeBeachManagement() {
    console.log('🏖️ Initializing Beach Management...');
    
    // Load beaches from database
    refreshBeachGrid();

    // Support deep-linking straight into a beach's edit form, used by the
    // Tourism Personnel "Update Requests" page ("Edit Beach Info" button)
    // so an approved Beach Owner request can be applied immediately.
    // e.g. beach-management.html?edit_beach=3
    try {
        const editId = new URLSearchParams(window.location.search).get('edit_beach');
        if (editId && window.openEditBeachModal) {
            window.openEditBeachModal(parseInt(editId, 10));
        }
    } catch (e) {
        console.warn('Could not open beach edit from URL:', e);
    }
    
    // Set up Add Beach button
    const addBtn = document.getElementById('addBeachBtn');
    if (addBtn) {
        // Remove existing listeners by cloning
        const newBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newBtn, addBtn);
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('➕ Add Beach button clicked');
            window.openAddBeachModal();
        });
    }
    
    // Set up form submission - IMPORTANT FIX
    const form = document.getElementById('addBeachForm');
    if (form) {
        // Remove existing listeners by cloning
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Wire up the beach images input on the freshly cloned form
        // (cloneNode does not preserve a file input's selected files, so
        // we track them separately in selectedBeachImageFiles).
        const imageInput = document.getElementById('beachImages');
        if (imageInput) {
            imageInput.addEventListener('change', function() {
                const files = Array.from(this.files || []);
                if (files.length === 0) return;

                const maxSize = 5 * 1024 * 1024; // 5MB per image

                for (const file of files) {
                    if (imageSlotsRemaining() <= 0) {
                        showError(`You can only have up to ${MAX_BEACH_IMAGES} images per beach. Remove an existing image to add another.`);
                        break;
                    }
                    if (file.size > maxSize) {
                        showError(`"${file.name}" is too large. Maximum size is 5MB per image.`);
                        continue;
                    }
                    selectedBeachImageFiles.push(file);
                }

                renderImagePreviews();
                this.value = ''; // allow re-selecting the same file again later
            });
        }

        // Wire up the GCash QR image input (tracked separately from the
        // <input>, since cloneNode drops a file input's selected files).
        const gcashQrInput = document.getElementById('gcashQrFile');
        if (gcashQrInput) {
            gcashQrInput.addEventListener('change', function() {
                const file = (this.files && this.files[0]) || null;
                if (!file) return;

                const allowed = ['image/jpeg', 'image/png', 'image/webp'];
                if (!allowed.includes(file.type)) {
                    showError('GCash QR must be a JPG, PNG or WEBP image.');
                    this.value = '';
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    showError('GCash QR image is too large. Maximum size is 5MB.');
                    this.value = '';
                    return;
                }
                selectedGcashQrFile = file;
                removeGcashQr = false;
                renderGcashQrPreview();
                this.value = ''; // allow re-selecting the same file again later
            });
        }

        const removeGcashQrBtn = document.getElementById('removeGcashQrBtn');
        if (removeGcashQrBtn) {
            removeGcashQrBtn.addEventListener('click', function() {
                // If a saved QR exists and we're editing, mark it for removal
                // so update-beach.php clears it; also drop any new selection.
                if (editingBeachId && existingGcashQr) {
                    removeGcashQr = true;
                }
                selectedGcashQrFile = null;
                renderGcashQrPreview();
            });
        }
        
        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('📝 Form submitted');
            
            // Validate Step 1
            if (!validateStep(1)) {
                console.log('❌ Step 1 validation failed');
                return;
            }
            
            // Validate Step 2
            if (!validateStep(2)) {
                console.log('❌ Step 2 validation failed');
                return;
            }
            
            // Guarded with `?.` / a fallback string so that even if this
            // button were ever missing from the DOM, we'd never throw
            // "Cannot read properties of null (reading '...')" here -
            // we'd just skip the button-state update and continue saving.
            const submitBtn = document.getElementById('submitBeachBtn');
            const originalText = submitBtn ? submitBtn.innerHTML : '<i class="fas fa-save"></i> Save Beach';
            if (submitBtn) {
                submitBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
                submitBtn.disabled = true;
            }
            console.log('⏳ Saving beach...');
            
            try {
                const formData = collectFormData();
                // Capture edit state BEFORE closeAddBeachModal() clears it.
                const wasEditing = !!editingBeachId;
                const endpoint = wasEditing ? 'update-beach.php' : 'add-beach.php';
                console.log('📤 Sending data (FormData with image) to', endpoint);
                
                const result = await fetchAPI(endpoint, {
                    method: 'POST',
                    body: formData
                });
                
                console.log('📥 Response:', result);
                
                if (result.success) {
                    console.log('✅ Beach saved successfully!');
                    window.closeAddBeachModal();
                    await refreshBeachGrid();
                    
                    // Show success message
                    if (wasEditing) {
                        alert('✅ Beach updated successfully! Changes are now live across the Landing Page, Browse All Beaches and Beach Details.');
                    } else {
                        alert('✅ Beach "' + result.beach_name + '" added successfully!');
                    }
                } else {
                    console.error('❌ Error saving beach:', result.message);
                    showError(result.message || 'Failed to add beach. Please try again.');
                    if (submitBtn) {
                        submitBtn.innerHTML = originalText;
                        submitBtn.disabled = false;
                    }
                }
            } catch (error) {
                console.error('❌ Error adding beach:', error);
                showError('An error occurred: ' + error.message);
                if (submitBtn) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }
        });
    }
    
    // Set up modal close buttons
    const closeBtn = document.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = function() {
            window.closeAddBeachModal();
        };
    }
    
    // NOTE: The Add/Edit Beach form must NOT close when the user accidentally
    // clicks outside it (on the dark backdrop). Doing so used to wipe out
    // everything already typed in. The form now only closes when the user
    // deliberately clicks the Close (×) button, so the previous
    // "close on backdrop click" handler was intentionally removed. Do not
    // re-add it - all entered data must be preserved until an explicit close
    // or a successful save.

    console.log('✅ Beach Management initialized');
}

// ========================================
// ===== EXPOSE FUNCTIONS GLOBALLY =====
// ========================================

window.refreshBeachGrid = refreshBeachGrid;
window.openBeachDetailsFromDB = openBeachDetailsFromDB;
window.initializeBeachManagement = initializeBeachManagement;
window.loadBeachesFromDatabase = loadBeachesFromDatabase;
window.openAddBeachModal = openAddBeachModal;
window.closeAddBeachModal = closeAddBeachModal;
window.openEditBeachModal = openEditBeachModal;
window.editCurrentBeach = editCurrentBeach;
window.handleBeachStatusAction = handleBeachStatusAction;

// ========================================
// ===== AUTO-INITIALIZE =====
// ========================================

// Make sure everything is loaded
console.log('🏖️ Beach Management JS loaded');

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📄 DOM ready, initializing...');
        initializeBeachManagement();
    });
} else {
    // DOM already loaded
    setTimeout(function() {
        console.log('📄 DOM already ready, initializing...');
        initializeBeachManagement();
    }, 100);
}