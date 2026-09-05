// ========================================
// ===== DOM READY =====
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========================================
  // ===== UTILITY FUNCTIONS =====
  // ========================================

  function showError(errorId) {
    const el = document.getElementById(errorId);
    if (el) el.classList.add('visible');
  }

  function hideError(errorId) {
    const el = document.getElementById(errorId);
    if (el) el.classList.remove('visible');
  }

  // ========================================
  // ===== SIDEBAR TOGGLE FOR MOBILE =====
  // ========================================

  function addSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    if (document.querySelector('.sidebar-toggle')) return;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
    toggleBtn.style.display = 'none';
    document.body.prepend(toggleBtn);
    
    toggleBtn.addEventListener('click', function() {
      sidebar.classList.toggle('open');
      const icon = this.querySelector('i');
      if (sidebar.classList.contains('open')) {
        icon.className = 'fas fa-times';
      } else {
        icon.className = 'fas fa-bars';
      }
    });
    
    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) {
        if (sidebar.classList.contains('open')) {
          if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
            sidebar.classList.remove('open');
            const icon = toggleBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-bars';
          }
        }
      }
    });
  }

  // ========================================
  // ===== LANDING PAGE NAVIGATION =====
  // ========================================

  const navbar = document.getElementById('navbar');
  if (navbar) {
    // Sticky navbar
    function handleNavScroll() {
      if (window.scrollY > 80) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
    window.addEventListener('scroll', handleNavScroll);
    handleNavScroll();

    // Mobile nav toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (navToggle) {
      navToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        navMenu.classList.toggle('open');
        const icon = this.querySelector('i');
        if (navMenu.classList.contains('open')) {
          icon.className = 'fas fa-times';
        } else {
          icon.className = 'fas fa-bars';
        }
      });
    }

    // Close mobile nav on link click
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        navMenu.classList.remove('open');
        const icon = navToggle.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      });
    });

    // Active nav highlighting
    const sections = document.querySelectorAll('section[id]');
    function highlightNavOnScroll() {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (window.scrollY >= sectionTop) {
          current = section.getAttribute('id');
        }
      });
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
          link.classList.add('active');
        }
      });
    }
    window.addEventListener('scroll', highlightNavOnScroll);

    // Smooth scrolling
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

    // Scroll to top button
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    if (scrollTopBtn) {
      window.addEventListener('scroll', function() {
        if (window.scrollY > 600) {
          scrollTopBtn.classList.add('visible');
        } else {
          scrollTopBtn.classList.remove('visible');
        }
      });

      scrollTopBtn.addEventListener('click', function() {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }

    // Reveal animations
    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });
    revealElements.forEach(el => revealObserver.observe(el));

    // Learn More button
    const learnMoreBtn = document.getElementById('learnMoreBtn');
    const learnMorePage = document.getElementById('learnMorePage');
    const closeLearnMore = document.getElementById('closeLearnMore');

    if (learnMoreBtn && learnMorePage) {
      learnMoreBtn.addEventListener('click', function(e) {
        e.preventDefault();
        learnMorePage.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    if (closeLearnMore && learnMorePage) {
      closeLearnMore.addEventListener('click', function() {
        learnMorePage.classList.remove('active');
        document.body.style.overflow = '';
      });

      learnMorePage.addEventListener('click', function(e) {
        if (e.target === learnMorePage) {
          learnMorePage.classList.remove('active');
          document.body.style.overflow = '';
        }
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && learnMorePage.classList.contains('active')) {
          learnMorePage.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }

    // Dynamic values
    const beachCountEl = document.getElementById('beachCount');
    const mostVisitedEl = document.getElementById('mostVisited');
    if (beachCountEl) beachCountEl.textContent = '6';
    if (mostVisitedEl) mostVisitedEl.textContent = 'White Sand Cove';

    // Scroll indicator
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
      scrollIndicator.addEventListener('click', function(e) {
        e.preventDefault();
        const beachesSection = document.getElementById('beaches');
        if (beachesSection) {
          const offset = beachesSection.getBoundingClientRect().top + window.pageYOffset - 70;
          window.scrollTo({ top: offset, behavior: 'smooth' });
        }
      });
    }

    console.log('🌴 Tukuran Beach Landing Page ready');
  }

  // ========================================
  // ===== TOURIST DASHBOARD FUNCTIONALITY =====
  // ========================================

  if (document.querySelector('.dashboard-main') && !document.querySelector('.sidebar')) {
    
    // ===== RESERVATION FORM =====
    const reservationForm = document.getElementById('reservationForm');
    if (reservationForm) {
      let countdownInterval;
      let timerSeconds = 1800;
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

        // Validate Accommodation Type
        const accommodationType = document.getElementById('accommodationType');
        if (!accommodationType || !accommodationType.value) {
          showError('accommodationError');
          if (accommodationType) accommodationType.classList.add('error');
          isValid = false;
        } else {
          hideError('accommodationError');
          accommodationType.classList.remove('error');
        }

        if (isValid) {
          formData = {
            fullName: fullName.value,
            contact: contact.value,
            origin: origin.value,
            email: email.value,
            visitors: visitors.value,
            maleCount: document.getElementById('maleCount').value || 0,
            femaleCount: document.getElementById('femaleCount').value || 0,
            date: date.value,
            etaTime: etaTime.value,
            accommodationType: accommodationType.value
          };

          showReviewStep(formData);
        }
      });
    }

    // ===== SHOW REVIEW STEP =====
    function showReviewStep(data) {
      const formStep = document.getElementById('formStep');
      const reviewStep = document.getElementById('reviewStep');
      if (formStep) formStep.style.display = 'none';
      if (reviewStep) reviewStep.style.display = 'block';
      
      const reviewDetails = document.getElementById('reviewDetails');
      if (reviewDetails) {
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
          <div class="review-item">
            <span class="review-label">Accommodation Type</span>
            <span class="review-value">${data.accommodationType.charAt(0).toUpperCase() + data.accommodationType.slice(1)}</span>
          </div>
        `;
      }
    }

    // ===== BACK TO FORM =====
    const backToFormBtn = document.getElementById('backToFormBtn');
    if (backToFormBtn) {
      backToFormBtn.addEventListener('click', function() {
        const reviewStep = document.getElementById('reviewStep');
        const formStep = document.getElementById('formStep');
        if (reviewStep) reviewStep.style.display = 'none';
        if (formStep) formStep.style.display = 'block';
      });
    }

    // ===== CONFIRM RESERVATION =====
    const confirmReservationBtn = document.getElementById('confirmReservationBtn');
    if (confirmReservationBtn) {
      confirmReservationBtn.addEventListener('click', function() {
        const reviewStep = document.getElementById('reviewStep');
        const pendingStep = document.getElementById('pendingStep');
        if (reviewStep) reviewStep.style.display = 'none';
        if (pendingStep) pendingStep.style.display = 'block';
        
        calculateExpiryTime();
        startCountdownBasedOnETA();
        
        setTimeout(function() {
          window.location.href = 'reservation-confirmation.html';
        }, 2000);
      });
    }

    // ===== CALCULATE EXPIRY TIME =====
    function calculateExpiryTime() {
      const etaTime = document.getElementById('etaTime').value;
      const today = new Date();
      const [hours, minutes] = etaTime.split(':').map(Number);
      
      const etaDate = new Date(today);
      etaDate.setHours(hours, minutes, 0, 0);
      
      if (etaDate < today) {
        etaDate.setDate(etaDate.getDate() + 1);
      }
      
      const expiryDate = new Date(etaDate);
      expiryDate.setMinutes(expiryDate.getMinutes() + 30);
      
      expiryTimestamp = expiryDate.getTime();
      
      const displayEta = document.getElementById('displayEta');
      const displayExpiry = document.getElementById('displayExpiry');
      if (displayEta) displayEta.textContent = formatTime(etaDate);
      if (displayExpiry) displayExpiry.textContent = formatTime(expiryDate);
    }

    function formatTime(date) {
      let hours = date.getHours();
      let minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      minutes = minutes < 10 ? '0' + minutes : minutes;
      return `${hours}:${minutes} ${ampm}`;
    }

    function startCountdownBasedOnETA() {
      const timerDisplay = document.getElementById('countdownTimer');
      if (!timerDisplay) return;
      
      if (countdownInterval) clearInterval(countdownInterval);
      
      countdownInterval = setInterval(function() {
        const now = Date.now();
        const timeLeft = expiryTimestamp - now;
        
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          timerDisplay.textContent = 'Expired';
          timerDisplay.style.color = '#e74c5e';
          const pendingConfirmation = document.querySelector('.pending-confirmation');
          if (pendingConfirmation) {
            const header = pendingConfirmation.querySelector('.confirmation-header');
            if (header) {
              const icon = header.querySelector('i');
              const h3 = header.querySelector('h3');
              if (icon) { icon.className = 'fas fa-times-circle'; icon.style.color = '#e74c5e'; }
              if (h3) { h3.textContent = 'Reservation Expired'; h3.style.color = '#e74c5e'; }
            }
            const p = pendingConfirmation.querySelector('p');
            if (p) p.textContent = 'You did not arrive within the grace period. Your reservation has expired.';
            const cancelBtn = document.getElementById('cancelPendingBtn');
            if (cancelBtn) cancelBtn.textContent = 'Make New Reservation';
            const note = document.querySelector('.pending-note');
            if (note) note.style.display = 'none';
          }
          return;
        }
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
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
          if (countdownInterval) clearInterval(countdownInterval);
          const pendingStep = document.getElementById('pendingStep');
          const formStep = document.getElementById('formStep');
          if (pendingStep) pendingStep.style.display = 'none';
          if (formStep) formStep.style.display = 'block';
          const form = document.getElementById('reservationForm');
          if (form) form.reset();
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

    // ===== LOGOUT FUNCTIONALITY (Tourist) =====
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

    if (logoutModal) {
      logoutModal.addEventListener('click', function(e) {
        if (e.target === logoutModal) {
          logoutModal.classList.remove('active');
        }
      });
    }

    console.log('🏖️ Tourist Dashboard ready');
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
      
      const btn = this.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      btn.disabled = true;
      
      setTimeout(function() {
        const reviewsList = document.querySelector('.reviews-list');
        if (reviewsList) {
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
        }
        
        reviewForm.reset();
        comment.value = '';
        btn.innerHTML = originalText;
        btn.disabled = false;
        
        alert('Thank you for your review!');
      }, 1500);
    });
  }

  // ========================================
  // ===== BEACH OWNER MODULE FUNCTIONALITY =====
  // ========================================

  if (document.querySelector('.sidebar') && document.querySelector('.beach-owner-dashboard')) {
    
    // ===== RESERVATION MANAGEMENT =====
    const filterTabs = document.querySelectorAll('.filter-tab');
    const tableRows = document.querySelectorAll('.bookings-table tbody tr');
    
    filterTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        filterTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        const filter = this.dataset.filter;
        
        tableRows.forEach(row => {
          if (filter === 'all' || row.dataset.status === filter) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });
    
    // Search functionality
    const searchInput = document.getElementById('searchReservation');
    if (searchInput) {
      searchInput.addEventListener('keyup', function() {
        const searchTerm = this.value.toLowerCase();
        tableRows.forEach(row => {
          const text = row.textContent.toLowerCase();
          if (text.includes(searchTerm)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }
    
    // ===== APPROVE RESERVATION =====
    window.approveReservation = function(id) {
      if (confirm(`Approve reservation ${id}?`)) {
        const rows = document.querySelectorAll('.bookings-table tbody tr');
        rows.forEach(row => {
          if (row.textContent.includes(id)) {
            const statusCell = row.querySelector('.status');
            if (statusCell) {
              statusCell.className = 'status confirmed';
              statusCell.textContent = 'Approved';
            }
            row.dataset.status = 'approved';
            
            const actions = row.querySelector('td:last-child');
            if (actions) {
              actions.innerHTML = `
                <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>
              `;
            }
            
            alert(`Reservation ${id} has been approved.`);
          }
        });
      }
    };
    
    // ===== REJECT RESERVATION =====
    window.rejectReservation = function(id) {
      if (confirm(`Reject reservation ${id}?`)) {
        const rows = document.querySelectorAll('.bookings-table tbody tr');
        rows.forEach(row => {
          if (row.textContent.includes(id)) {
            const statusCell = row.querySelector('.status');
            if (statusCell) {
              statusCell.className = 'status cancelled';
              statusCell.textContent = 'Cancelled';
            }
            row.dataset.status = 'cancelled';
            
            const actions = row.querySelector('td:last-child');
            if (actions) {
              actions.innerHTML = `
                <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>
              `;
            }
            
            alert(`Reservation ${id} has been rejected.`);
          }
        });
      }
    };
    
    // ===== VIEW RESERVATION =====
    window.viewReservation = function(id) {
      alert(`Viewing details for reservation ${id}`);
    };
    
    // ===== WALK-IN REGISTRATION =====
    const walkinForm = document.getElementById('walkinForm');
    if (walkinForm) {
      walkinForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let isValid = true;
        
        const age = document.getElementById('walkinAge');
        if (!age.value || parseInt(age.value) < 0) {
          showError('ageError');
          age.classList.add('error');
          isValid = false;
        } else {
          hideError('ageError');
          age.classList.remove('error');
        }
        
        const visitors = document.getElementById('walkinVisitors');
        if (!visitors.value || parseInt(visitors.value) < 1) {
          showError('walkinVisitorsError');
          visitors.classList.add('error');
          isValid = false;
        } else {
          hideError('walkinVisitorsError');
          visitors.classList.remove('error');
        }
        
        const hometown = document.getElementById('walkinHometown');
        if (!hometown.value.trim()) {
          showError('hometownError');
          hometown.classList.add('error');
          isValid = false;
        } else {
          hideError('hometownError');
          hometown.classList.remove('error');
        }
        
        if (isValid) {
          const btn = walkinForm.querySelector('button[type="submit"]');
          const originalText = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
          btn.disabled = true;
          
          setTimeout(function() {
            walkinForm.style.display = 'none';
            const success = document.getElementById('walkinSuccess');
            if (success) success.style.display = 'block';
            btn.innerHTML = originalText;
            btn.disabled = false;
          }, 1500);
        }
      });
    }
    
    // ===== CAPACITY MONITORING =====
    function updateCapacityStatus(current, max) {
      const percentage = (current / max) * 100;
      const statusElement = document.getElementById('currentStatus');
      const progressFill = document.getElementById('progressFill');
      const progressPercentage = document.getElementById('progressPercentage');
      
      if (statusElement) {
        if (percentage < 70) {
          statusElement.textContent = 'Available';
          statusElement.className = 'capacity-status';
        } else if (percentage < 90) {
          statusElement.textContent = 'Nearly Full';
          statusElement.className = 'capacity-status nearly-full';
        } else {
          statusElement.textContent = 'Full';
          statusElement.className = 'capacity-status full';
        }
      }
      
      if (progressFill) {
        progressFill.style.width = `${Math.min(percentage, 100)}%`;
        if (percentage < 70) {
          progressFill.className = 'progress-fill';
        } else if (percentage < 90) {
          progressFill.className = 'progress-fill nearly-full';
        } else {
          progressFill.className = 'progress-fill full';
        }
      }
      
      if (progressPercentage) {
        progressPercentage.textContent = `${Math.round(Math.min(percentage, 100))}%`;
      }
    }

    // ===== LOGOUT (Beach Owner) =====
    const logoutModalOwner = document.getElementById('logoutModal');
    const cancelLogoutOwner = document.getElementById('cancelLogout');
    const confirmLogoutOwner = document.getElementById('confirmLogout');
    
    const ownerLogoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtn2, #logoutBtn3, #logoutBtn4');
    
    ownerLogoutBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        if (logoutModalOwner) {
          logoutModalOwner.classList.add('active');
        }
      });
    });
    
    if (cancelLogoutOwner) {
      cancelLogoutOwner.addEventListener('click', function() {
        logoutModalOwner.classList.remove('active');
      });
    }
    
    if (confirmLogoutOwner) {
      confirmLogoutOwner.addEventListener('click', function() {
        logoutModalOwner.classList.remove('active');
        alert('You have been logged out successfully.');
        window.location.href = 'login.html';
      });
    }
    
    if (logoutModalOwner) {
      logoutModalOwner.addEventListener('click', function(e) {
        if (e.target === logoutModalOwner) {
          logoutModalOwner.classList.remove('active');
        }
      });
    }

    console.log('🏖️ Beach Owner Module ready');
  }

  // ========================================
  // ===== SIDEBAR TOGGLE FOR ALL PAGES =====
  // ========================================

  // Check if sidebar exists and add toggle
  if (document.querySelector('.sidebar')) {
    addSidebarToggle();
  }

  // ========================================
  // ===== MOBILE NAV TOGGLE (Global) =====
  // ========================================

  // Handle mobile nav toggle for all pages
  document.querySelectorAll('.nav-toggle').forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      const menu = this.closest('.nav-container').querySelector('.nav-menu');
      if (menu) {
        menu.classList.toggle('open');
        const icon = this.querySelector('i');
        if (menu.classList.contains('open')) {
          icon.className = 'fas fa-times';
        } else {
          icon.className = 'fas fa-bars';
        }
      }
    });
  });

  // Close mobile nav on outside click
  document.addEventListener('click', function(e) {
    document.querySelectorAll('.nav-menu.open').forEach(menu => {
      const container = menu.closest('.nav-container');
      if (container && !container.contains(e.target)) {
        menu.classList.remove('open');
        const toggle = container.querySelector('.nav-toggle');
        if (toggle) {
          const icon = toggle.querySelector('i');
          if (icon) icon.className = 'fas fa-bars';
        }
      }
    });
  });

  // ========================================
  // ===== PAGE TRANSITIONS =====
  // ========================================

  // Handle page transitions for login/register links
  document.querySelectorAll('a[href="login.html"], a[href="register.html"]').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.3s ease';
      setTimeout(function() {
        window.location.href = href;
      }, 300);
    });
  });

  // Fade in page on load
  document.body.style.opacity = '0';
  setTimeout(function() {
    document.body.style.transition = 'opacity 0.5s ease';
    document.body.style.opacity = '1';
  }, 100);

  // ========================================
  // ===== GLOBAL LOGOUT FUNCTIONALITY =====
  // ========================================

  // Handle logout for all pages
  document.querySelectorAll('.logout-link:not(.sidebar-link)').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const modal = document.getElementById('logoutModal');
      if (modal) {
        modal.classList.add('active');
      } else {
        if (confirm('Are you sure you want to log out?')) {
          window.location.href = 'login.html';
        }
      }
    });
  });

  console.log('🏝️ Tukuran Beach System fully loaded');
});

// ========================================
// ===== BEACH LIST FUNCTIONALITY (REMOVED hardcoded data) =====
// ========================================

// Note: Beach list functionality is now handled by beach-management.js
// using data from the database. The hardcoded beachData has been removed
// to avoid conflicts with the database-driven approach.

// ========================================
// ===== GLOBAL LOGOUT FUNCTIONALITY =====
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // Get all logout buttons
  const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtn2, #logoutBtn3, #logoutBtn4, #logoutBtn5, #logoutBtn6, #logoutBtn7');
  
  // Get modal elements
  const logoutModal = document.getElementById('logoutModal');
  const cancelLogout = document.getElementById('cancelLogout');
  const confirmLogout = document.getElementById('confirmLogout');

  // For each logout button, add click event
  logoutBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Check if modal exists
        if (logoutModal) {
          // Show the modal
          logoutModal.classList.add('active');
        } else {
          // If no modal, redirect directly
          window.location.href = '../Log-in page/login.html';
        }
      });
    }
  });

  // Cancel logout - close modal
  if (cancelLogout) {
    cancelLogout.addEventListener('click', function() {
      if (logoutModal) {
        logoutModal.classList.remove('active');
      }
    });
  }

  // Confirm logout - redirect to login page
  if (confirmLogout) {
    confirmLogout.addEventListener('click', function() {
      // Redirect to login page
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentRole');
      window.location.href = '../Log-in page/login.html';
    });
  }

  // Close modal when clicking outside
  if (logoutModal) {
    logoutModal.addEventListener('click', function(e) {
      if (e.target === logoutModal) {
        logoutModal.classList.remove('active');
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && logoutModal && logoutModal.classList.contains('active')) {
      logoutModal.classList.remove('active');
    }
  });

  console.log('🔒 Logout functionality loaded successfully');
});

// ========================================
// ===== FIX: Close modals properly =====
// ========================================

// Ensure modal close buttons work properly
document.addEventListener('DOMContentLoaded', function() {
  // Fix for Add Beach modal close button
  const modalCloseBtns = document.querySelectorAll('.modal-close-btn');
  modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = this.closest('.add-beach-modal');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
  
  // Fix for beach details close button
  const detailsCloseBtn = document.querySelector('.close-details-btn');
  if (detailsCloseBtn) {
    detailsCloseBtn.addEventListener('click', function() {
      if (typeof closeBeachDetails === 'function') {
        closeBeachDetails();
      } else {
        const overlay = document.getElementById('beachDetailsOverlay');
        if (overlay) {
          overlay.classList.remove('active');
          setTimeout(() => {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
          }, 300);
        }
      }
    });
  }
});

console.log('✅ style.js updated - removed hardcoded beach data conflicts');