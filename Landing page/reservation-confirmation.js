// ========================================
// ===== RESERVATION CONFIRMATION FUNCTIONALITY =====
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

  // ===== GENERATE RESERVATION NUMBER =====
  function generateReservationNumber() {
    const prefix = 'TUK';
    const year = new Date().getFullYear();
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `#${prefix}-${year}-${random}`;
  }

  // ===== SET RESERVATION NUMBER =====
  const reservationNumberEl = document.getElementById('reservationNumber');
  if (reservationNumberEl) {
    reservationNumberEl.textContent = generateReservationNumber();
  }

  // ===== GET ETA FROM SESSION STORAGE OR URL =====
  // Try to get from session storage first (if set from previous page)
  let storedEta = sessionStorage.getItem('reservationEta');
  let storedExpiry = sessionStorage.getItem('reservationExpiry');
  
  // If not in session storage, use defaults
  if (!storedEta) {
    // Get current time + 1 hour as default ETA
    const now = new Date();
    now.setHours(now.getHours() + 1);
    storedEta = formatTimeDisplay(now);
    
    const expiry = new Date(now);
    expiry.setMinutes(expiry.getMinutes() + 30);
    storedExpiry = formatTimeDisplay(expiry);
  }

  // ===== DISPLAY ETA AND EXPIRY =====
  const displayEtaEl = document.getElementById('displayEtaConfirmation');
  const displayExpiryEl = document.getElementById('displayExpiryConfirmation');
  
  if (displayEtaEl) {
    displayEtaEl.textContent = storedEta;
  }
  
  if (displayExpiryEl) {
    displayExpiryEl.textContent = storedExpiry;
  }

  // ===== FORMAT TIME DISPLAY =====
  function formatTimeDisplay(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  }

  // ===== CLEAN UP SESSION STORAGE AFTER USE =====
  // Clear the stored reservation data after displaying
  sessionStorage.removeItem('reservationEta');
  sessionStorage.removeItem('reservationExpiry');

  console.log('🏖️ Reservation Confirmation page ready');
});