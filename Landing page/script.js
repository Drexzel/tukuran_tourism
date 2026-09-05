// ========================================
// ===== TOURIST DASHBOARD FUNCTIONALITY =====
// ========================================

// Check if we're on a dashboard page
if (document.querySelector('.dashboard-main')) {
  
  // ===== RESERVATION FORM =====
  const reservationForm = document.getElementById('reservationForm');
  if (reservationForm) {
    let countdownInterval;
    let timerSeconds = 1800; // 30 minutes
    let formData = {};
    let expiryTimestamp = null;

    reservationForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      let isValid = true;

      // Validate Full Name
      const fullName = document.getElementById('fullName');
      if (!fullName.value.trim()) {
        showError('fullNameError');
        fullName.classList.add('error');
        isValid = false;
      } else {
        hideError('fullNameError');
        fullName.classList.remove('error');
      }

      // Validate Contact
      const contact = document.getElementById('contactNumber');
      const phonePattern = /^[0-9]{11}$/;
      if (!contact.value || !phonePattern.test(contact.value.replace(/[^0-9]/g, ''))) {
        showError('contactError');
        contact.classList.add('error');
        isValid = false;
      } else {
        hideError('contactError');
        contact.classList.remove('error');
      }

      // Validate Origin
      const origin = document.getElementById('placeOrigin');
      if (!origin.value.trim()) {
        showError('originError');
        origin.classList.add('error');
        isValid = false;
      } else {
        hideError('originError');
        origin.classList.remove('error');
      }

      // Validate Email
      const email = document.getElementById('emailAddress');
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.value || !emailPattern.test(email.value)) {
        showError('emailError');
        email.classList.add('error');
        isValid = false;
      } else {
        hideError('emailError');
        email.classList.remove('error');
      }

      // Validate Visitors
      const visitors = document.getElementById('numVisitors');
      if (!visitors.value || parseInt(visitors.value) < 1) {
        showError('visitorsError');
        visitors.classList.add('error');
        isValid = false;
      } else {
        hideError('visitorsError');
        visitors.classList.remove('error');
      }

      // Validate Date
      const date = document.getElementById('reservationDate');
      if (!date.value) {
        showError('dateError');
        date.classList.add('error');
        isValid = false;
      } else {
        hideError('dateError');
        date.classList.remove('error');
      }

      // Validate ETA Time
      const etaTime = document.getElementById('etaTime');
      if (!etaTime.value) {
        showError('timeError');
        etaTime.classList.add('error');
        isValid = false;
      } else {
        hideError('timeError');
        etaTime.classList.remove('error');
      }

      if (isValid) {
        // Collect form data for review
        formData = {
          fullName: fullName.value,
          contact: contact.value,
          origin: origin.value,
          email: email.value,
          visitors: visitors.value,
          maleCount: document.getElementById('maleCount').value || 0,
          femaleCount: document.getElementById('femaleCount').value || 0,
          date: date.value,
          etaTime: etaTime.value
        };

        // Show review step
        showReviewStep(formData);
      }
    });
  }

  // ===== SHOW REVIEW STEP =====
  function showReviewStep(data) {
    document.getElementById('formStep').style.display = 'none';
    document.getElementById('reviewStep').style.display = 'block';
    
    const reviewDetails = document.getElementById('reviewDetails');
    reviewDetails.innerHTML = `
      <div class="review-item">
        <span class="review-label">Full Name</span>
        <span class="review-value">${data.fullName}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Contact Number</span>
        <span class="review-value">${data.contact}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Place of Origin</span>
        <span class="review-value">${data.origin}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Email Address</span>
        <span class="review-value">${data.email}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Total Visitors</span>
        <span class="review-value">${data.visitors}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Male Visitors</span>
        <span class="review-value">${data.maleCount}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Female Visitors</span>
        <span class="review-value">${data.femaleCount}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Reservation Date</span>
        <span class="review-value">${data.date}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Estimated Time of Arrival (ETA)</span>
        <span class="review-value">${data.etaTime}</span>
      </div>
    `;
  }

  // ===== BACK TO FORM =====
  const backToFormBtn = document.getElementById('backToFormBtn');
  if (backToFormBtn) {
    backToFormBtn.addEventListener('click', function() {
      document.getElementById('reviewStep').style.display = 'none';
      document.getElementById('formStep').style.display = 'block';
    });
  }

  // ===== CONFIRM RESERVATION =====
  const confirmReservationBtn = document.getElementById('confirmReservationBtn');
  if (confirmReservationBtn) {
    confirmReservationBtn.addEventListener('click', function() {
      document.getElementById('reviewStep').style.display = 'none';
      document.getElementById('pendingStep').style.display = 'block';
      
      // Calculate expiry time based on ETA + 30 minutes
      calculateExpiryTime();
      
      // Start the countdown based on ETA
      startCountdownBasedOnETA();
      
      // Simulate redirect to confirmation page after showing pending
      setTimeout(function() {
        window.location.href = 'reservation-confirmation.html';
      }, 2000);
    });
  }

  // ===== CALCULATE EXPIRY TIME BASED ON ETA =====
  function calculateExpiryTime() {
    const etaTime = document.getElementById('etaTime').value;
    const today = new Date();
    const [hours, minutes] = etaTime.split(':').map(Number);
    
    // Create ETA date object
    const etaDate = new Date(today);
    etaDate.setHours(hours, minutes, 0, 0);
    
    // If ETA is in the past for today, assume it's for tomorrow
    if (etaDate < today) {
      etaDate.setDate(etaDate.getDate() + 1);
    }
    
    // Expiry = ETA + 30 minutes
    const expiryDate = new Date(etaDate);
    expiryDate.setMinutes(expiryDate.getMinutes() + 30);
    
    expiryTimestamp = expiryDate.getTime();
    
    // Display ETA and expiry time
    document.getElementById('displayEta').textContent = formatTime(etaDate);
    document.getElementById('displayExpiry').textContent = formatTime(expiryDate);
  }

  // ===== FORMAT TIME =====
  function formatTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  }

  // ===== START COUNTDOWN BASED ON ETA =====
  function startCountdownBasedOnETA() {
    const timerDisplay = document.getElementById('countdownTimer');
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(function() {
      const now = Date.now();
      const timeLeft = expiryTimestamp - now;
      
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        timerDisplay.textContent = 'Expired';
        timerDisplay.style.color = '#e74c5e';
        document.querySelector('.pending-confirmation .confirmation-header i').className = 'fas fa-times-circle';
        document.querySelector('.pending-confirmation .confirmation-header i').style.color = '#e74c5e';
        document.querySelector('.pending-confirmation .confirmation-header h3').textContent = 'Reservation Expired';
        document.querySelector('.pending-confirmation .confirmation-header h3').style.color = '#e74c5e';
        document.querySelector('.pending-confirmation p').textContent = 'You did not arrive within the grace period. Your reservation has expired.';
        document.getElementById('cancelPendingBtn').textContent = 'Make New Reservation';
        document.querySelector('.pending-note').style.display = 'none';
        return;
      }
      
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      // Change color when less than 5 minutes remaining
      if (timeLeft < 300000) {
        timerDisplay.style.color = '#e74c5e';
      } else if (timeLeft < 600000) {
        timerDisplay.style.color = '#ffc107';
      }
    }, 1000);
  }

  // ===== CANCEL PENDING =====
  const cancelPendingBtn = document.getElementById('cancelPendingBtn');
  if (cancelPendingBtn) {
    cancelPendingBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to cancel this reservation?')) {
        clearInterval(countdownInterval);
        document.getElementById('pendingStep').style.display = 'none';
        document.getElementById('formStep').style.display = 'block';
        document.getElementById('reservationForm').reset();
      }
    });
  }

  // ===== CANCEL RESERVATION (Confirmation Page) =====
  const cancelReservationBtn = document.getElementById('cancelReservationBtn');
  if (cancelReservationBtn) {
    cancelReservationBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to cancel this reservation?')) {
        alert('Reservation cancelled successfully.');
        window.location.href = 'tourist-dashboard.html';
      }
    });
  }

  // ===== PROFILE NAVIGATION =====
  const profileNavLinks = document.querySelectorAll('.profile-nav-link');
  const personalSection = document.getElementById('personalSection');
  const bookingsSection = document.getElementById('bookingsSection');

  profileNavLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const section = this.dataset.section;
      
      if (section === 'personal') {
        e.preventDefault();
        profileNavLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        if (personalSection) personalSection.style.display = 'block';
        if (bookingsSection) bookingsSection.style.display = 'none';
      } else if (section === 'bookings') {
        e.preventDefault();
        profileNavLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        if (personalSection) personalSection.style.display = 'none';
        if (bookingsSection) bookingsSection.style.display = 'block';
      }
    });
  });

  // ===== LOGOUT FUNCTIONALITY =====
  const logoutModal = document.getElementById('logoutModal');
  const cancelLogout = document.getElementById('cancelLogout');
  const confirmLogout = document.getElementById('confirmLogout');
  
  const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtn2, #logoutBtn3, #logoutBtn4, #logoutBtn5, #logoutBtn6, #profileLogout');
  
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (logoutModal) {
        logoutModal.classList.add('active');
      }
    });
  });

  if (cancelLogout) {
    cancelLogout.addEventListener('click', function() {
      logoutModal.classList.remove('active');
    });
  }

  if (confirmLogout) {
    confirmLogout.addEventListener('click', function() {
      logoutModal.classList.remove('active');
      alert('You have been logged out successfully.');
      window.location.href = 'login.html';
    });
  }

  // ===== GALLERY IMAGE SWITCH =====
  window.changeGalleryImage = function(src) {
    const mainImg = document.getElementById('mainGalleryImg');
    if (mainImg) {
      mainImg.src = src;
    }
  };

  // ===== EDIT PROFILE =====
  const editProfileBtn = document.getElementById('editProfileBtn');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', function() {
      alert('Profile edit feature coming soon!');
    });
  }

  // ===== CLOSE MODAL ON OUTSIDE CLICK =====
  if (logoutModal) {
    logoutModal.addEventListener('click', function(e) {
      if (e.target === logoutModal) {
        logoutModal.classList.remove('active');
      }
    });
  }

  console.log('🏖️ Tourist Dashboard ready');
}

// ===== UTILITY FUNCTIONS =====
function showError(errorId) {
  const el = document.getElementById(errorId);
  if (el) el.classList.add('visible');
}

function hideError(errorId) {
  const el = document.getElementById(errorId);
  if (el) el.classList.remove('visible');
}

// ========================================
// ===== REVIEW SUBMISSION =====
// ========================================

const reviewForm = document.getElementById('reviewForm');
if (reviewForm) {
  reviewForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const rating = document.querySelector('input[name="rating"]:checked');
    const comment = document.getElementById('reviewComment');
    
    if (!rating) {
      alert('Please select a rating.');
      return;
    }
    
    if (!comment.value.trim()) {
      alert('Please write your review.');
      return;
    }
    
    // Simulate review submission
    const btn = this.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    btn.disabled = true;
    
    setTimeout(function() {
      // Add review to list      const reviewsList = document.querySelector('.reviews-list');
      const newReview = document.createElement('div');
      newReview.className = 'review-item';
      newReview.innerHTML = `
        <div class="review-header">
          <div class="reviewer-info">
            <span class="reviewer-name">You</span>
            <span class="review-date">Just now</span>
          </div>
          <div class="review-stars">
            ${'<i class="fas fa-star"></i>'.repeat(parseInt(rating.value))}
            ${'<i class="far fa-star"></i>'.repeat(5 - parseInt(rating.value))}
          </div>
        </div>
        <p class="review-text">${comment.value}</p>
      `;
      reviewsList.insertBefore(newReview, reviewsList.firstChild.nextSibling);
      
      // Reset form
      reviewForm.reset();
      comment.value = '';
      btn.innerHTML = originalText;
      btn.disabled = false;
      
      alert('Thank you for your review!');
    }, 1500);
  });
}

// ========================================
