// ========================================
// ===== BEACH RANKING MODULE =====
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ========================================
  // ===== RANKING DATA =====
  // ========================================

  const rankingData = {
    'most-visited': {
      title: 'Most Visited Beaches',
      icon: 'fa-users',
      description: 'Beaches with the highest number of visitors',
      rankings: [
        { rank: 1, name: 'Baguio Beach', location: 'Barangay Santo Niño', value: '1,247 visitors', rating: 4.9, status: 'gold' },
        { rank: 2, name: 'Sirena Beach', location: 'Barangay Poblacion', value: '892 visitors', rating: 4.5, status: 'silver' },
        { rank: 3, name: 'Donel\'s Beach', location: 'Barangay Upper Tukuran', value: '634 visitors', rating: 4.7, status: 'bronze' },
        { rank: 4, name: 'Crystal Cove', location: 'Barangay Santo Niño', value: '456 visitors', rating: 4.8, status: '' },
        { rank: 5, name: 'White Sand Beach', location: 'Barangay Poblacion', value: '345 visitors', rating: 4.6, status: '' },
        { rank: 6, name: 'Paradise Beach', location: 'Barangay Upper Tukuran', value: '234 visitors', rating: 4.8, status: '' }
      ]
    },
    'cleanest': {
      title: 'Cleanest Beaches',
      icon: 'fa-spa',
      description: 'Beaches with highest cleanliness ratings',
      rankings: [
        { rank: 1, name: 'Crystal Cove', location: 'Barangay Santo Niño', value: '98% Cleanliness', rating: 4.9, status: 'gold' },
        { rank: 2, name: 'Baguio Beach', location: 'Barangay Santo Niño', value: '95% Cleanliness', rating: 4.9, status: 'silver' },
        { rank: 3, name: 'Paradise Beach', location: 'Barangay Upper Tukuran', value: '92% Cleanliness', rating: 4.8, status: 'bronze' },
        { rank: 4, name: 'Sirena Beach', location: 'Barangay Poblacion', value: '88% Cleanliness', rating: 4.5, status: '' },
        { rank: 5, name: 'White Sand Beach', location: 'Barangay Poblacion', value: '85% Cleanliness', rating: 4.6, status: '' }
      ]
    },
    'most-reserved': {
      title: 'Most Reserved Beaches',
      icon: 'fa-calendar-check',
      description: 'Beaches with the highest reservation counts',
      rankings: [
        { rank: 1, name: 'Baguio Beach', location: 'Barangay Santo Niño', value: '156 reservations', rating: 4.9, status: 'gold' },
        { rank: 2, name: 'Donel\'s Beach', location: 'Barangay Upper Tukuran', value: '98 reservations', rating: 4.7, status: 'silver' },
        { rank: 3, name: 'Sirena Beach', location: 'Barangay Poblacion', value: '87 reservations', rating: 4.5, status: 'bronze' },
        { rank: 4, name: 'Crystal Cove', location: 'Barangay Santo Niño', value: '72 reservations', rating: 4.8, status: '' },
        { rank: 5, name: 'White Sand Beach', location: 'Barangay Poblacion', value: '54 reservations', rating: 4.6, status: '' }
      ]
    },
    'beautiful': {
      title: 'Most Beautiful Beaches',
      icon: 'fa-sun',
      description: 'Beaches with highest scenic beauty ratings',
      rankings: [
        { rank: 1, name: 'Paradise Beach', location: 'Barangay Upper Tukuran', value: '4.9 Stars', rating: 4.9, status: 'gold' },
        { rank: 2, name: 'Crystal Cove', location: 'Barangay Santo Niño', value: '4.8 Stars', rating: 4.8, status: 'silver' },
        { rank: 3, name: 'Baguio Beach', location: 'Barangay Santo Niño', value: '4.8 Stars', rating: 4.8, status: 'bronze' },
        { rank: 4, name: 'Donel\'s Beach', location: 'Barangay Upper Tukuran', value: '4.7 Stars', rating: 4.7, status: '' },
        { rank: 5, name: 'Sirena Beach', location: 'Barangay Poblacion', value: '4.5 Stars', rating: 4.5, status: '' }
      ]
    },
    'family-friendly': {
      title: 'Most Family-Friendly Beaches',
      icon: 'fa-people-group',
      description: 'Best beaches for family outings and activities',
      rankings: [
        { rank: 1, name: 'Baguio Beach', location: 'Barangay Santo Niño', value: 'Family Choice Award', rating: 4.9, status: 'gold' },
        { rank: 2, name: 'Sirena Beach', location: 'Barangay Poblacion', value: 'Family Choice Award', rating: 4.5, status: 'silver' },
        { rank: 3, name: 'White Sand Beach', location: 'Barangay Poblacion', value: 'Family Choice Award', rating: 4.6, status: 'bronze' },
        { rank: 4, name: 'Donel\'s Beach', location: 'Barangay Upper Tukuran', value: 'Family Choice Award', rating: 4.7, status: '' },
        { rank: 5, name: 'Paradise Beach', location: 'Barangay Upper Tukuran', value: 'Family Choice Award', rating: 4.8, status: '' }
      ]
    },
    'active': {
      title: 'Most Active Beaches',
      icon: 'fa-person-running',
      description: 'Beaches with most water sports and activities',
      rankings: [
        { rank: 1, name: 'Baguio Beach', location: 'Barangay Santo Niño', value: '15 Activities', rating: 4.9, status: 'gold' },
        { rank: 2, name: 'Sirena Beach', location: 'Barangay Poblacion', value: '12 Activities', rating: 4.5, status: 'silver' },
        { rank: 3, name: 'Donel\'s Beach', location: 'Barangay Upper Tukuran', value: '10 Activities', rating: 4.7, status: 'bronze' },
        { rank: 4, name: 'White Sand Beach', location: 'Barangay Poblacion', value: '8 Activities', rating: 4.6, status: '' },
        { rank: 5, name: 'Crystal Cove', location: 'Barangay Santo Niño', value: '7 Activities', rating: 4.8, status: '' }
      ]
    },
    'affordable': {
      title: 'Most Affordable Beaches',
      icon: 'fa-coins',
      description: 'Budget-friendly beaches with great value',
      rankings: [
        { rank: 1, name: 'White Sand Beach', location: 'Barangay Poblacion', value: '₱35 entrance', rating: 4.6, status: 'gold' },
        { rank: 2, name: 'Sirena Beach', location: 'Barangay Poblacion', value: '₱40 entrance', rating: 4.5, status: 'silver' },
        { rank: 3, name: 'Donel\'s Beach', location: 'Barangay Upper Tukuran', value: '₱45 entrance', rating: 4.7, status: 'bronze' },
        { rank: 4, name: 'Baguio Beach', location: 'Barangay Santo Niño', value: '₱50 entrance', rating: 4.9, status: '' },
        { rank: 5, name: 'Paradise Beach', location: 'Barangay Upper Tukuran', value: '₱55 entrance', rating: 4.8, status: '' }
      ]
    },
    'instagrammable': {
      title: 'Most Instagrammable Beaches',
      icon: 'fa-camera',
      description: 'Most photogenic and scenic beaches',
      rankings: [
        { rank: 1, name: 'Paradise Beach', location: 'Barangay Upper Tukuran', value: '5,234 Posts', rating: 4.9, status: 'gold' },
        { rank: 2, name: 'Crystal Cove', location: 'Barangay Santo Niño', value: '4,876 Posts', rating: 4.8, status: 'silver' },
        { rank: 3, name: 'Baguio Beach', location: 'Barangay Santo Niño', value: '4,234 Posts', rating: 4.9, status: 'bronze' },
        { rank: 4, name: 'White Sand Beach', location: 'Barangay Poblacion', value: '3,456 Posts', rating: 4.6, status: '' },
        { rank: 5, name: 'Sirena Beach', location: 'Barangay Poblacion', value: '2,987 Posts', rating: 4.5, status: '' }
      ]
    }
  };

  // ========================================
  // ===== CURRENT STATE =====
  // ========================================

  let currentCategory = 'most-visited';

  // ========================================
  // ===== DOM REFERENCES =====
  // ========================================

  const categoryDropdown = document.getElementById('rankingCategorySelect');
  const rankingTitle = document.getElementById('rankingTitle');
  const rankingDescription = document.getElementById('rankingDescription');
  const rankingList = document.getElementById('rankingList');

  // ========================================
  // ===== FUNCTIONS =====
  // ========================================

  function updateRanking(categoryKey) {
    const data = rankingData[categoryKey];
    if (!data) return;

    // Update title and description
    if (rankingTitle) {
      rankingTitle.innerHTML = `<i class="fas ${data.icon}"></i> ${data.title}`;
    }
    if (rankingDescription) {
      rankingDescription.textContent = data.description;
    }

    // Update ranking list
    if (rankingList) {
      rankingList.innerHTML = data.rankings.map(item => {
        const statusClass = item.status ? ` ${item.status}` : '';
        const stars = generateStars(item.rating);
        
        return `
          <div class="ranking-item${statusClass}">
            <span class="rank-number">${item.rank}</span>
            <div class="rank-info">
              <h4>${item.name}</h4>
              <p>${item.location}</p>
              <span class="rank-rating">${stars}</span>
            </div>
            <div class="rank-stat">
              <span class="rank-count">${item.value}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Update dropdown selection
    if (categoryDropdown) {
      categoryDropdown.value = categoryKey;
    }

    currentCategory = categoryKey;
  }

  function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
      stars += '⭐';
    }
    
    if (hasHalf) {
      stars += '⭐';
    }
    
    return stars;
  }

  // ========================================
  // ===== EVENT LISTENERS =====
  // ========================================

  // Dropdown change event
  if (categoryDropdown) {
    categoryDropdown.addEventListener('change', function() {
      const category = this.value;
      if (category && rankingData[category]) {
        updateRanking(category);
        
        // Scroll to ranking list on mobile
        if (window.innerWidth <= 768 && rankingList) {
          setTimeout(() => {
            rankingList.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 200);
        }
      }
    });
  }

  // ========================================
  // ===== SEARCH FILTER FOR RANKINGS =====
  // ========================================

  const searchRanking = document.getElementById('searchRanking');
  if (searchRanking) {
    searchRanking.addEventListener('keyup', function() {
      const term = this.value.toLowerCase();
      const items = document.querySelectorAll('.ranking-item');
      
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  // ========================================
  // ===== INITIALIZE =====
  // ========================================

  // Load default ranking
  updateRanking('most-visited');

  // ========================================
  // ===== DIRECT LOGOUT - NO MODAL =====
  // ========================================

  const logoutBtn = document.getElementById('logoutBtn6');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      // Direct redirect to login page
      window.location.href = '../Log-in page/login.html';
    });
  }

  console.log('🏖️ Beach Ranking module loaded successfully');
});