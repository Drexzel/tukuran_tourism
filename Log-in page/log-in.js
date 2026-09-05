// ===== DOM READY =====
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========================================
  // ===== LOGIN PAGE FUNCTIONALITY =====
  // ========================================
  
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const rememberMe = document.getElementById('rememberMe');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const forgotModal = document.getElementById('forgotModal');
    const modalClose = document.getElementById('modalClose');

    // ===== Login Status Modal (replaces browser alert() for login feedback) =====
    const statusModal = document.getElementById('loginStatusModal');
    const statusIcon = document.getElementById('statusIcon');
    const statusIconSymbol = document.getElementById('statusIconSymbol');
    const statusTitle = document.getElementById('statusTitle');
    const statusMessage = document.getElementById('statusMessage');
    const statusOkBtn = document.getElementById('statusOkBtn');
    const statusProgress = document.getElementById('statusProgress');

    let statusAutoTimer = null;

    function closeStatusModal() {
      if (!statusModal) return;
      statusModal.classList.remove('active');
      statusModal.classList.remove('status-error-state');
      if (statusAutoTimer) {
        clearTimeout(statusAutoTimer);
        statusAutoTimer = null;
      }
    }

    // type: 'success' | 'error'
    function showStatusModal(type, title, message, onAutoClose) {
      if (!statusModal) return;

      const isError = type === 'error';

      statusTitle.textContent = title;
      statusMessage.textContent = message;
      statusIconSymbol.className = isError ? 'fas fa-times' : 'fas fa-check';
      statusIcon.classList.toggle('status-error', isError);
      statusModal.classList.toggle('status-error-state', isError);

      // Restart the auto-close progress bar animation
      if (statusProgress) {
        const bar = statusProgress.querySelector('span');
        if (bar) {
          bar.style.animation = 'none';
          // Force reflow so the animation restarts cleanly
          void bar.offsetWidth;
          bar.style.animation = '';
        }
      }

      statusModal.classList.add('active');

      if (statusAutoTimer) clearTimeout(statusAutoTimer);
      statusAutoTimer = setTimeout(function() {
        closeStatusModal();
        if (typeof onAutoClose === 'function') onAutoClose();
      }, 3000);
    }

    if (statusOkBtn) {
      statusOkBtn.addEventListener('click', function() {
        // If this is the success modal, clicking OK redirects immediately
        if (statusModal && statusModal.dataset.redirectUrl) {
          const url = statusModal.dataset.redirectUrl;
          statusModal.dataset.redirectUrl = '';
          closeStatusModal();
          window.location.href = url;
        } else {
          closeStatusModal();
        }
      });
    }

    if (statusModal) {
      statusModal.addEventListener('click', function(e) {
        if (e.target === statusModal) {
          closeStatusModal();
        }
      });
    }

    // Password visibility toggle
    const loginToggle = document.getElementById('loginPasswordToggle');
    if (loginToggle) {
      loginToggle.addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (loginPassword.type === 'password') {
          loginPassword.type = 'text';
          icon.className = 'fas fa-eye-slash';
        } else {
          loginPassword.type = 'password';
          icon.className = 'fas fa-eye';
        }
      });
    }

    // Forgot Password Modal
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        if (forgotModal) {
          forgotModal.classList.add('active');
        }
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', function() {
        forgotModal.classList.remove('active');
      });
    }

    if (forgotModal) {
      forgotModal.addEventListener('click', function(e) {
        if (e.target === forgotModal) {
          forgotModal.classList.remove('active');
        }
      });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && forgotModal && forgotModal.classList.contains('active')) {
        forgotModal.classList.remove('active');
      }
      if (e.key === 'Escape' && statusModal && statusModal.classList.contains('active')) {
        closeStatusModal();
      }
    });

    // Form Validation and Submission
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      let isValid = true;

      // Validate Email or Username (the role is resolved automatically by
      // the server from the account record - no role field to validate).
      if (!loginEmail.value || !loginEmail.value.trim()) {
        showError('emailError');
        loginEmail.classList.add('error');
        isValid = false;
      } else {
        hideError('emailError');
        loginEmail.classList.remove('error');
      }

      // Validate Password
      if (!loginPassword.value || loginPassword.value.length < 6) {
        showError('passwordError');
        loginPassword.classList.add('error');
        isValid = false;
      } else {
        hideError('passwordError');
        loginPassword.classList.remove('error');
      }

      if (isValid) {
        const btn = loginForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        btn.disabled = true;

        // Only the identifier (email or username) and password are sent.
        // The server looks up the account and returns its role + the
        // correct dashboard to redirect to.
        fetch('../api/login.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: loginEmail.value.trim(),
            password: loginPassword.value
          })
        })
          .then(function(response) { return response.json(); })
          .then(function(result) {
            if (result.success) {
              sessionStorage.setItem('currentUser', JSON.stringify(result.data));
              sessionStorage.setItem('currentRole', result.role);

              if (statusModal) {
                statusModal.dataset.redirectUrl = result.redirect;
              }
              showStatusModal('success', 'Login Successful', 'Redirecting...', function() {
                window.location.href = result.redirect;
              });
            } else {
              var failMsg = (result && result.message) ? result.message : 'Invalid Credentials. Please try again.';
              showStatusModal('error', 'Login Failed', failMsg);
              btn.innerHTML = originalText;
              btn.disabled = false;
            }
          })
          .catch(function(err) {
            console.error('Login error:', err);
            showStatusModal('error', 'Connection Error', 'Could not reach the server. Please make sure the backend/MySQL is running.');
            btn.innerHTML = originalText;
            btn.disabled = false;
          });
      }
    });

    // Real-time validation on blur
    loginEmail.addEventListener('blur', function() {
      if (this.value && this.value.trim()) {
        hideError('emailError');
        this.classList.remove('error');
      }
    });

    loginPassword.addEventListener('blur', function() {
      if (this.value && this.value.length >= 6) {
        hideError('passwordError');
        this.classList.remove('error');
      }
    });

    // Remember Me functionality
    if (rememberMe) {
      // Check if remember me was previously checked
      if (localStorage.getItem('rememberMe') === 'true') {
        rememberMe.checked = true;
        const savedEmail = localStorage.getItem('savedEmail');
        if (savedEmail) {
          loginEmail.value = savedEmail;
        }
      }

      rememberMe.addEventListener('change', function() {
        if (this.checked) {
          localStorage.setItem('rememberMe', 'true');
          localStorage.setItem('savedEmail', loginEmail.value);
        } else {
          localStorage.removeItem('rememberMe');
          localStorage.removeItem('savedEmail');
        }
      });
    }
  }

  // ========================================
  // ===== REGISTRATION PAGE FUNCTIONALITY =====
  // ========================================

  const registerForm = document.getElementById('registerForm');
  
  if (registerForm) {
    const resortName = document.getElementById('resortName');
    const ownerName = document.getElementById('ownerName');
    const registerEmail = document.getElementById('registerEmail');
    const phoneNumber = document.getElementById('phoneNumber');
    const username = document.getElementById('username');
    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const successMessage = document.getElementById('registrationSuccess');

    // Password visibility toggles
    const registerToggle = document.getElementById('registerPasswordToggle');
    const confirmToggle = document.getElementById('confirmPasswordToggle');

    if (registerToggle) {
      registerToggle.addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (registerPassword.type === 'password') {
          registerPassword.type = 'text';
          icon.className = 'fas fa-eye-slash';
        } else {
          registerPassword.type = 'password';
          icon.className = 'fas fa-eye';
        }
      });
    }

    if (confirmToggle) {
      confirmToggle.addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (confirmPassword.type === 'password') {
          confirmPassword.type = 'text';
          icon.className = 'fas fa-eye-slash';
        } else {
          confirmPassword.type = 'password';
          icon.className = 'fas fa-eye';
        }
      });
    }

    // Helper functions for validation
    function validateField(input, errorId, condition, errorMessage) {
      if (condition) {
        hideError(errorId);
        input.classList.remove('error');
        return true;
      } else {
        showError(errorId);
        input.classList.add('error');
        return false;
      }
    }

    // Real-time validation on blur
    resortName.addEventListener('blur', function() {
      validateField(this, 'resortNameError', this.value.trim().length > 0, '');
    });

    ownerName.addEventListener('blur', function() {
      validateField(this, 'ownerNameError', this.value.trim().length > 0, '');
    });

    registerEmail.addEventListener('blur', function() {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      validateField(this, 'registerEmailError', this.value && emailPattern.test(this.value), '');
    });

    phoneNumber.addEventListener('blur', function() {
      const phonePattern = /^[0-9]{11}$/;
      validateField(this, 'phoneError', this.value && phonePattern.test(this.value.replace(/[^0-9]/g, '')), '');
    });

    username.addEventListener('blur', function() {
      validateField(this, 'usernameError', this.value.trim().length >= 3, '');
    });

    registerPassword.addEventListener('blur', function() {
      validateField(this, 'registerPasswordError', this.value.length >= 6, '');
      // Also check confirm password if it has a value
      if (confirmPassword.value) {
        validateField(confirmPassword, 'confirmPasswordError', 
          confirmPassword.value === registerPassword.value, '');
      }
    });

    confirmPassword.addEventListener('blur', function() {
      validateField(this, 'confirmPasswordError', 
        this.value === registerPassword.value && this.value.length > 0, '');
    });

    // Form Submission
    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      let isValid = true;

      // Validate all fields
      if (!validateField(resortName, 'resortNameError', resortName.value.trim().length > 0, '')) isValid = false;
      if (!validateField(ownerName, 'ownerNameError', ownerName.value.trim().length > 0, '')) isValid = false;
      
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!validateField(registerEmail, 'registerEmailError', registerEmail.value && emailPattern.test(registerEmail.value), '')) isValid = false;
      
      const phonePattern = /^[0-9]{11}$/;
      if (!validateField(phoneNumber, 'phoneError', phoneNumber.value && phonePattern.test(phoneNumber.value.replace(/[^0-9]/g, '')), '')) isValid = false;
      
      if (!validateField(username, 'usernameError', username.value.trim().length >= 3, '')) isValid = false;
      
      if (!validateField(registerPassword, 'registerPasswordError', registerPassword.value.length >= 6, '')) isValid = false;
      
      if (!validateField(confirmPassword, 'confirmPasswordError', 
        confirmPassword.value === registerPassword.value && confirmPassword.value.length > 0, '')) isValid = false;

      if (isValid) {
        const btn = registerForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        btn.disabled = true;

        fetch('../api/register.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resortName: resortName.value.trim(),
            ownerName: ownerName.value.trim(),
            email: registerEmail.value.trim(),
            phoneNumber: phoneNumber.value.trim(),
            username: username.value.trim(),
            password: registerPassword.value
          })
        })
          .then(function(response) { return response.json(); })
          .then(function(result) {
            btn.innerHTML = originalText;
            btn.disabled = false;

            if (result.success) {
              // Hide form, show success
              registerForm.style.display = 'none';
              if (successMessage) {
                successMessage.style.display = 'block';
              }
              const card = document.querySelector('.auth-card');
              if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            } else {
              alert(result.message || 'Registration failed. Please try again.');
            }
          })
          .catch(function(err) {
            console.error('Registration error:', err);
            btn.innerHTML = originalText;
            btn.disabled = false;
            alert('Could not reach the server. Please make sure the backend/MySQL is running.');
          });
      }
    });
  }

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
  // ===== LANDING PAGE NAVIGATION =====
  // ========================================

  // This handles the landing page navigation if we're on index.html
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

  // Handle page transitions
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

  console.log('🏝️ Tukuran Auth Module ready');
});