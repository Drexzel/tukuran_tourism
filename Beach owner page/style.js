// ========================================
// ===== BEACH OWNER MODULE FUNCTIONALITY =====
// ========================================

// Check if we're on a beach owner page
if (document.querySelector('.dashboard-main')) {
  
  // ===== RESERVATION MANAGEMENT =====
  // Filter tabs
  const filterTabs = document.querySelectorAll('.filter-tab');
  const tableRows = document.querySelectorAll('.bookings-table tbody tr');
  
  filterTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Update active tab
      filterTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      const filter = this.dataset.filter;
      
      // Filter rows
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
      // Find the row and update status
      const rows = document.querySelectorAll('.bookings-table tbody tr');
      rows.forEach(row => {
        if (row.textContent.includes(id)) {
          const statusCell = row.querySelector('.status');
          statusCell.className = 'status confirmed';
          statusCell.textContent = 'Approved';
          row.dataset.status = 'approved';
          
          // Update buttons
          const actions = row.querySelector('td:last-child');
          actions.innerHTML = `
            <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>
          `;
          
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
          statusCell.className = 'status cancelled';
          statusCell.textContent = 'Cancelled';
          row.dataset.status = 'cancelled';
          
          const actions = row.querySelector('td:last-child');
          actions.innerHTML = `
            <button class="btn-sm btn-view" onclick="viewReservation('${id}')"><i class="fas fa-eye"></i> View</button>
          `;
          
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
      
      // Validate Age
      const age = document.getElementById('walkinAge');
      if (!age.value || parseInt(age.value) < 0) {
        showError('ageError');
        age.classList.add('error');
        isValid = false;
      } else {
        hideError('ageError');
        age.classList.remove('error');
      }
      
      // Validate Visitors
      const visitors = document.getElementById('walkinVisitors');
      if (!visitors.value || parseInt(visitors.value) < 1) {
        showError('walkinVisitorsError');
        visitors.classList.add('error');
        isValid = false;
      } else {
        hideError('walkinVisitorsError');
        visitors.classList.remove('error');
      }
      
      // Validate Hometown
      const hometown = document.getElementById('walkinHometown');
      if (!hometown.value.trim()) {
        showError('hometownError');
        hometown.classList.add('error');
        isValid = false;
      } else {
        hideError('hometownError');
        hometown.classList.remove('error');
      }
      
      // Validate Type
      const type = document.getElementById('walkinType');
      if (!type.value) {
        showError('typeError');
        type.classList.add('error');
        isValid = false;
      } else {
        hideError('typeError');
        type.classList.remove('error');
      }
      
      if (isValid) {
        // Show success message
        const btn = walkinForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
        
        setTimeout(function() {
          walkinForm.style.display = 'none';
          document.getElementById('walkinSuccess').style.display = 'block';
          btn.innerHTML = originalText;
          btn.disabled = false;
        }, 1500);
      }
    });
  }
  
  // ===== CAPACITY MONITORING =====
  // Update capacity status based on percentage
  function updateCapacityStatus(current, max) {
    const percentage = (current / max) * 100;
    const statusElement = document.getElementById('currentStatus');
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    
    if (statusElement) {
      if (percentage < 70) {
        statusElement.textContent = 'Available';
        statusElement.className = 'capacity-status';
        progressFill.className = 'progress-fill';
      } else if (percentage < 90) {
        statusElement.textContent = 'Nearly Full';
        statusElement.className = 'capacity-status nearly-full';
        progressFill.className = 'progress-fill nearly-full';
      } else {
        statusElement.textContent = 'Full';
        statusElement.className = 'capacity-status full';
        progressFill.className = 'progress-fill full';
      }
    }
    
    if (progressFill) {
      progressFill.style.width = `${Math.min(percentage, 100)}%`;
    }
    
    if (progressPercentage) {
      progressPercentage.textContent = `${Math.round(Math.min(percentage, 100))}%`;
    }
  }
  
  // ===== LOGOUT FUNCTIONALITY =====
  const logoutModal = document.getElementById('logoutModal');
  const cancelLogout = document.getElementById('cancelLogout');
  const confirmLogout = document.getElementById('confirmLogout');
  
  const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtn2, #logoutBtn3, #logoutBtn4');
  
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
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentRole');
      alert('You have been logged out successfully.');
      window.location.href = '../Log-in page/login.html';
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
  
  // ===== MOBILE NAV TOGGLE =====
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
  
  console.log('🏖️ Beach Owner Module ready');
}

// ===== SIDEBAR TOGGLE FOR MOBILE =====
// Add sidebar toggle button to mobile view
function addSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  // Check if toggle button already exists
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
  
  // Close sidebar when clicking outside on mobile
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

// Call this on beach owner pages
if (document.querySelector('.sidebar')) {
  addSidebarToggle();
}