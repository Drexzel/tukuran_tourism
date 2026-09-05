// ========================================
// ===== DYNAMIC BEACH DATA (from MySQL via api/get-beaches.php) =====
// ========================================
// The Landing Page lives one folder below the BEACH project root, same as
// the Browse Beaches page, so the api/ folder is reached the same way.
const LANDING_API_BASE = '../api/';
const LANDING_DEFAULT_IMAGE = 'images/beach1.jpg';

async function fetchLandingBeaches() {
  try {
    const response = await fetch(LANDING_API_BASE + 'get-beaches.php');
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

async function fetchLandingStats() {
  try {
    const response = await fetch(LANDING_API_BASE + 'beach-stats.php');
    const result = await response.json();
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  } catch (error) {
    console.error('Error loading beach stats from database:', error);
    return null;
  }
}

function renderLandingBeachCards(beaches) {
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

  // The Landing Page highlights only the first three participating beaches;
  // the full list stays available via the "View All Beaches" button, which
  // links to browse-beaches.html. The card markup below is unchanged.
  const featuredBeaches = beaches.slice(0, 3);

  grid.innerHTML = featuredBeaches.map(beach => {
    const imageUrl = beach.main_image || LANDING_DEFAULT_IMAGE;
    const barangay = beach.barangay || beach.location || 'Tukuran';
    const adultFee = beach.adult_fee || 0;
    const description = beach.description || 'A beautiful coastal destination in Tukuran.';

    return `
      <div class="beach-card" data-beach-id="${beach.beach_id}">
        <div class="beach-img">
          <img src="${imageUrl}" alt="${beach.beach_name}" loading="lazy" onerror="this.src='${LANDING_DEFAULT_IMAGE}'">
        </div>
        <div class="beach-info">
          <h3>${beach.beach_name}</h3>
          <p class="barangay">${barangay}</p>
          <p class="fee"><i class="fas fa-tag"></i> ₱${adultFee} entrance</p>
          <p class="beach-desc">${description}</p>
          <a href="beach-details.html?id=${beach.beach_id}" class="btn-outline">View Details <i class="fas fa-chevron-right"></i></a>
        </div>
      </div>
    `;
  }).join('');
}

function renderLandingStats(stats) {
  const beachCountEl = document.getElementById('beachCount');
  const mostVisitedEl = document.getElementById('mostVisited');

  if (beachCountEl) {
    beachCountEl.textContent = stats && typeof stats.total_beaches === 'number'
      ? stats.total_beaches
      : '0';
  }

  if (mostVisitedEl) {
    mostVisitedEl.textContent = stats && stats.most_visited
      ? stats.most_visited.beach_name
      : 'No data yet';
  }
}

async function loadAndRenderLandingBeaches() {
  const [beaches, stats] = await Promise.all([
    fetchLandingBeaches(),
    fetchLandingStats()
  ]);
  renderLandingBeachCards(beaches);
  renderLandingStats(stats);
}

// ===== DOM READY =====
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // Load beaches + stats from the database as soon as the page is ready.
  loadAndRenderLandingBeaches();

  // ===== ELEMENTS =====
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  const revealElements = document.querySelectorAll('.reveal');
  const beachCards = document.querySelectorAll('.beach-card');

  // ===== LEARN MORE FULL-SCREEN PAGE =====
  const learnMoreBtn = document.getElementById('learnMoreBtn');
  const learnMorePage = document.getElementById('learnMorePage');
  const closeLearnMore = document.getElementById('closeLearnMore');

  // Open full-screen page
  function openLearnMore(e) {
    e.preventDefault();
    learnMorePage.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Close full-screen page
  function closeLearnMorePage() {
    learnMorePage.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Event listeners
  if (learnMoreBtn) {
    learnMoreBtn.addEventListener('click', openLearnMore);
  }

  if (closeLearnMore) {
    closeLearnMore.addEventListener('click', closeLearnMorePage);
  }

  // The History modal intentionally stays open until the user clicks the X
  // (close) button — it does NOT close on Escape or on a backdrop click.

  // ===== ABOUT MODAL — IMAGE GALLERY CAROUSEL =====
  const galleryTrack = document.getElementById('aboutGalleryTrack');
  const galleryPrev = document.getElementById('aboutGalleryPrev');
  const galleryNext = document.getElementById('aboutGalleryNext');
  const galleryDots = document.getElementById('aboutGalleryDots');

  if (galleryTrack) {
    const slides = galleryTrack.querySelectorAll('.about-gallery-slide');
    const slideCount = slides.length;
    let currentSlide = 0;

    // Build navigation dots (one per image)
    if (galleryDots) {
      for (let i = 0; i < slideCount; i++) {
        const dot = document.createElement('button');
        dot.className = 'about-gallery-dot';
        dot.setAttribute('aria-label', 'Go to image ' + (i + 1));
        dot.addEventListener('click', function() {
          currentSlide = i;
          updateGallery();
        });
        galleryDots.appendChild(dot);
      }
    }

    function updateGallery() {
      galleryTrack.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
      if (galleryDots) {
        galleryDots.querySelectorAll('.about-gallery-dot').forEach((dot, i) => {
          dot.classList.toggle('active', i === currentSlide);
        });
      }
    }

    function goPrev() {
      currentSlide = (currentSlide - 1 + slideCount) % slideCount;
      updateGallery();
    }

    function goNext() {
      currentSlide = (currentSlide + 1) % slideCount;
      updateGallery();
    }

    if (galleryPrev) galleryPrev.addEventListener('click', goPrev);
    if (galleryNext) galleryNext.addEventListener('click', goNext);

    updateGallery();
  }

  // ===== STICKY NAVBAR + BLUR =====
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

  // ===== SMOOTH SCROLLING (all anchor links) =====
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

  // ===== SCROLL TO TOP BUTTON =====
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

  // ===== REVEAL SECTIONS ON SCROLL (Intersection Observer) =====
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

  // ===== ACTIVE NAV HIGHLIGHT ON SCROLL =====
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

  // ===== SCROLL INDICATOR =====
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
});


// ===== ACTIVE NAV HIGHLIGHT ON SCROLL =====
const sections = document.querySelectorAll('section[id]');

function highlightNavOnScroll() {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 100;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });
  
  // Check if we're on the home page
  const isHomePage = !window.location.pathname.includes('browse-beaches.html');
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    
    if (isHomePage) {
      // For home page, check if href matches current section
      if (href === '#' + current) {
        link.classList.add('active');
      }
    }
  });
}
window.addEventListener('scroll', highlightNavOnScroll);