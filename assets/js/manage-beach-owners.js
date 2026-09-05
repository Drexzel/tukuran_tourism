// ========================================
// ===== MANAGE BEACH OWNERS =====
// ========================================
// This page lives under "Tourism Personnel/", so the api/ folder is
// reached via "../api/", same convention as the rest of the admin pages.
const OWNERS_API_BASE = '../api/';

async function apiGet(endpoint) {
  const res = await fetch(OWNERS_API_BASE + endpoint);
  return res.json();
}

async function apiPost(endpoint, body) {
  const res = await fetch(OWNERS_API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// Cached in memory so View/Edit can populate instantly without a re-fetch.
let cachedOwners = [];
let cachedBeaches = [];

function statusPillClass(status) {
  if (status === 'Active') return 'active';
  if (status === 'Pending') return 'pending';
  return 'suspended';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadOwners() {
  const tbody = document.getElementById('ownersTableBody');
  try {
    const result = await apiGet('get-beach-owners.php');
    if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
      cachedOwners = [];
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><i class="fas fa-user-tie" style="font-size:1.8rem; opacity:0.4; display:block; margin-bottom:8px;"></i>No Beach Owner accounts yet. Click "Add Beach Owner" to create one.</td></tr>';
      return;
    }

    cachedOwners = result.data;

    tbody.innerHTML = cachedOwners.map(o => `
      <tr>
        <td>${o.resort_name}</td>
        <td>${o.owner_name}</td>
        <td>
          <div class="owner-actions">
            <button type="button" class="owner-action-btn view" title="View" onclick="viewOwner(${o.owner_id})"><i class="fas fa-eye"></i></button>
            <button type="button" class="owner-action-btn edit" title="Edit" onclick="editOwner(${o.owner_id})"><i class="fas fa-edit"></i></button>
            <button type="button" class="owner-action-btn delete" title="Delete" onclick="deleteOwner(${o.owner_id})"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading beach owners:', err);
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Could not load beach owner accounts. Please check your database connection.</td></tr>';
  }
}

async function loadBeachOptions() {
  const addSelect = document.getElementById('ownerBeachSelect');
  const editSelect = document.getElementById('editBeachSelect');
  try {
    const result = await apiGet('get-beaches.php?all=1');
    if (result.success && Array.isArray(result.data)) {
      cachedBeaches = result.data;
      cachedBeaches.forEach(beach => {
        const opt1 = document.createElement('option');
        opt1.value = beach.beach_id;
        opt1.textContent = beach.beach_name;
        addSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = beach.beach_id;
        opt2.textContent = beach.beach_name;
        editSelect.appendChild(opt2);
      });
    }
  } catch (err) {
    console.error('Error loading beaches for owner form:', err);
  }
}

// ========================================
// ===== VIEW OWNER =====
// ========================================

window.viewOwner = function(ownerId) {
  const owner = cachedOwners.find(o => Number(o.owner_id) === Number(ownerId));
  if (!owner) return;

  const grid = document.getElementById('ownerDetailsGrid');
  grid.innerHTML = `
    <div class="detail-item">
      <span class="detail-label">Owner Name</span>
      <span class="detail-value">${owner.owner_name}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Resort / Business Name</span>
      <span class="detail-value">${owner.resort_name}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Email Address</span>
      <span class="detail-value">${owner.email}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Contact Number</span>
      <span class="detail-value">${owner.phone_number || '-'}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Username</span>
      <span class="detail-value">${owner.username}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Password</span>
      <span class="detail-value muted"><i class="fas fa-lock"></i> Encrypted &mdash; not viewable. Use Edit to reset it if needed.</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Assigned Beach</span>
      <span class="detail-value">${owner.beach_name || 'Not linked yet'}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">Account Status</span>
      <span class="detail-value"><span class="status-pill ${statusPillClass(owner.status)}">${owner.status}</span></span>
    </div>
    <div class="detail-item full-width">
      <span class="detail-label">Account Created</span>
      <span class="detail-value">${formatDate(owner.created_at)}</span>
    </div>
  `;

  document.getElementById('viewOwnerModal').classList.add('active');
};

// ========================================
// ===== EDIT OWNER =====
// ========================================

window.editOwner = function(ownerId) {
  const owner = cachedOwners.find(o => Number(o.owner_id) === Number(ownerId));
  if (!owner) return;

  document.getElementById('editOwnerId').value = owner.owner_id;
  document.getElementById('editResortName').value = owner.resort_name;
  document.getElementById('editOwnerName').value = owner.owner_name;
  document.getElementById('editEmail').value = owner.email;
  document.getElementById('editPhone').value = owner.phone_number || '';
  document.getElementById('editBeachSelect').value = owner.beach_id || '';
  document.getElementById('editStatus').value = owner.status;

  ['editResortNameError', 'editOwnerNameError', 'editEmailError', 'editPhoneError'].forEach(id => {
    document.getElementById(id)?.classList.remove('visible');
  });
  ['editResortName', 'editOwnerName', 'editEmail', 'editPhone'].forEach(id => {
    document.getElementById(id)?.classList.remove('error');
  });

  document.getElementById('editOwnerModal').classList.add('active');
};

// ========================================
// ===== DELETE OWNER =====
// ========================================

window.deleteOwner = async function(ownerId) {
  const owner = cachedOwners.find(o => Number(o.owner_id) === Number(ownerId));
  if (!owner) return;

  const confirmed = confirm(`Are you sure you want to permanently delete the account for "${owner.owner_name}" (${owner.email})? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const result = await apiPost('delete-beach-owner.php', { ownerId: owner.owner_id });
    if (result.success) {
      loadOwners();
    } else {
      alert(result.message || 'Could not delete this account.');
    }
  } catch (err) {
    console.error('Error deleting beach owner:', err);
    alert('Could not reach the server. Please make sure the backend/MySQL is running.');
  }
};

document.addEventListener('DOMContentLoaded', function() {
  loadOwners();
  loadBeachOptions();

  const modal = document.getElementById('addOwnerModal');
  const openBtn = document.getElementById('openAddOwnerBtn');
  const cancelBtn = document.getElementById('cancelAddOwnerBtn');
  const closeBtn = document.getElementById('closeAddOwnerBtn');
  const form = document.getElementById('addOwnerForm');
  const resultBox = document.getElementById('ownerResultBox');

  function resetModal() {
    form.reset();
    form.style.display = 'block';
    resultBox.style.display = 'none';
    resultBox.innerHTML = '';

    // Clear any leftover validation state from a previous attempt
    ['ownerResortNameError', 'ownerOwnerNameError', 'ownerEmailError', 'ownerPhoneError'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
    ['ownerResortName', 'ownerOwnerName', 'ownerEmail', 'ownerPhone'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('error');
    });
  }

  openBtn.addEventListener('click', function() {
    resetModal();
    modal.classList.add('active');
  });

  cancelBtn.addEventListener('click', function() {
    modal.classList.remove('active');
  });

  closeBtn.addEventListener('click', function() {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('active');
  });

  function showFieldError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('visible');
  }

  function hideFieldError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  }

  function validateAddOwnerForm(payload) {
    let isValid = true;

    const resortInput = document.getElementById('ownerResortName');
    if (!payload.resortName) {
      showFieldError('ownerResortNameError');
      resortInput.classList.add('error');
      isValid = false;
    } else {
      hideFieldError('ownerResortNameError');
      resortInput.classList.remove('error');
    }

    const ownerNameInput = document.getElementById('ownerOwnerName');
    if (!payload.ownerName) {
      showFieldError('ownerOwnerNameError');
      ownerNameInput.classList.add('error');
      isValid = false;
    } else {
      hideFieldError('ownerOwnerNameError');
      ownerNameInput.classList.remove('error');
    }

    const emailInput = document.getElementById('ownerEmail');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!payload.email || !emailPattern.test(payload.email)) {
      showFieldError('ownerEmailError');
      emailInput.classList.add('error');
      isValid = false;
    } else {
      hideFieldError('ownerEmailError');
      emailInput.classList.remove('error');
    }

    // Phone is optional, but if the admin typed something, it should look
    // like a phone number (digits, spaces, +, -, at least 7 characters).
    const phoneInput = document.getElementById('ownerPhone');
    const phonePattern = /^[0-9+\-\s]{7,20}$/;
    if (payload.phoneNumber && !phonePattern.test(payload.phoneNumber)) {
      showFieldError('ownerPhoneError');
      phoneInput.classList.add('error');
      isValid = false;
    } else {
      hideFieldError('ownerPhoneError');
      phoneInput.classList.remove('error');
    }

    return isValid;
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const payload = {
      resortName: document.getElementById('ownerResortName').value.trim(),
      ownerName: document.getElementById('ownerOwnerName').value.trim(),
      email: document.getElementById('ownerEmail').value.trim(),
      phoneNumber: document.getElementById('ownerPhone').value.trim(),
      beachId: document.getElementById('ownerBeachSelect').value
    };

    if (!validateAddOwnerForm(payload)) {
      return;
    }

    const submitBtn = document.getElementById('submitAddOwnerBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    submitBtn.disabled = true;

    try {
      const result = await apiPost('add-beach-owner.php', payload);

      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      if (result.success) {
        form.style.display = 'none';
        resultBox.style.display = 'block';

        if (result.email_sent) {
          // Clean confirmation only - no email/username/password shown,
          // since the owner already has them in their inbox.
          resultBox.innerHTML = `
            <div style="background: rgba(46,213,115,0.1); border-radius: 12px; padding: 16px; color:#1f8a4d;">
              <i class="fas fa-check-circle"></i> Beach Owner account has been created successfully. The login credentials have been sent to the registered email address.
            </div>
            <div class="form-actions" style="margin-top:16px;">
              <button type="button" class="btn-primary" id="closeResultBtn">Done</button>
            </div>
          `;
        } else {
          // Email failed to send - show the real SMTP/PHPMailer error for
          // debugging, and still surface the credentials here so the
          // account (already saved) isn't left with no way to log in.
          resultBox.innerHTML = `
            <div style="background: rgba(245,158,11,0.12); border-radius: 12px; padding: 16px; color:#a15c00;">
              <i class="fas fa-exclamation-triangle"></i> Beach Owner account has been created and saved successfully, but the credentials email could not be sent.
              <div style="margin-top:8px; font-family: monospace; font-size: 0.82rem; color:#8a5200; word-break: break-word;">${result.email_error || 'Unknown email error.'}</div>
            </div>
            <div class="credentials-box">
              <div><strong>Email:</strong> ${payload.email}</div>
              <div><strong>Username:</strong> ${result.username}</div>
              <div><strong>Password:</strong> ${result.temporary_password}</div>
            </div>
            <div class="form-actions" style="margin-top:16px;">
              <button type="button" class="btn-primary" id="closeResultBtn">Done</button>
            </div>
          `;
        }

        document.getElementById('closeResultBtn').addEventListener('click', function() {
          modal.classList.remove('active');
          loadOwners();
        });
      } else {
        alert(result.message || 'Could not create the account.');
      }
    } catch (err) {
      console.error('Error creating beach owner:', err);
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      alert('Could not reach the server. Please make sure the backend/MySQL is running.');
    }
  });

  // ===== VIEW OWNER MODAL: CLOSE HANDLERS =====
  const viewModal = document.getElementById('viewOwnerModal');
  const closeViewBtn = document.getElementById('closeViewOwnerBtn');
  const closeViewBtn2 = document.getElementById('closeViewOwnerBtn2');

  [closeViewBtn, closeViewBtn2].forEach(btn => {
    btn?.addEventListener('click', function() {
      viewModal.classList.remove('active');
    });
  });
  viewModal.addEventListener('click', function(e) {
    if (e.target === viewModal) viewModal.classList.remove('active');
  });

  // ===== EDIT OWNER MODAL =====
  const editModal = document.getElementById('editOwnerModal');
  const closeEditBtn = document.getElementById('closeEditOwnerBtn');
  const cancelEditBtn = document.getElementById('cancelEditOwnerBtn');
  const editForm = document.getElementById('editOwnerForm');

  [closeEditBtn, cancelEditBtn].forEach(btn => {
    btn?.addEventListener('click', function() {
      editModal.classList.remove('active');
    });
  });
  editModal.addEventListener('click', function(e) {
    if (e.target === editModal) editModal.classList.remove('active');
  });

  function showEditFieldError(id) {
    document.getElementById(id)?.classList.add('visible');
  }
  function hideEditFieldError(id) {
    document.getElementById(id)?.classList.remove('visible');
  }

  function validateEditOwnerForm(payload) {
    let isValid = true;

    const resortInput = document.getElementById('editResortName');
    if (!payload.resortName) {
      showEditFieldError('editResortNameError');
      resortInput.classList.add('error');
      isValid = false;
    } else {
      hideEditFieldError('editResortNameError');
      resortInput.classList.remove('error');
    }

    const ownerNameInput = document.getElementById('editOwnerName');
    if (!payload.ownerName) {
      showEditFieldError('editOwnerNameError');
      ownerNameInput.classList.add('error');
      isValid = false;
    } else {
      hideEditFieldError('editOwnerNameError');
      ownerNameInput.classList.remove('error');
    }

    const emailInput = document.getElementById('editEmail');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!payload.email || !emailPattern.test(payload.email)) {
      showEditFieldError('editEmailError');
      emailInput.classList.add('error');
      isValid = false;
    } else {
      hideEditFieldError('editEmailError');
      emailInput.classList.remove('error');
    }

    const phoneInput = document.getElementById('editPhone');
    const phonePattern = /^[0-9+\-\s]{7,20}$/;
    if (payload.phoneNumber && !phonePattern.test(payload.phoneNumber)) {
      showEditFieldError('editPhoneError');
      phoneInput.classList.add('error');
      isValid = false;
    } else {
      hideEditFieldError('editPhoneError');
      phoneInput.classList.remove('error');
    }

    return isValid;
  }

  editForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const payload = {
      ownerId: document.getElementById('editOwnerId').value,
      resortName: document.getElementById('editResortName').value.trim(),
      ownerName: document.getElementById('editOwnerName').value.trim(),
      email: document.getElementById('editEmail').value.trim(),
      phoneNumber: document.getElementById('editPhone').value.trim(),
      beachId: document.getElementById('editBeachSelect').value,
      status: document.getElementById('editStatus').value
    };

    if (!validateEditOwnerForm(payload)) return;

    const submitBtn = document.getElementById('submitEditOwnerBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    try {
      const result = await apiPost('update-beach-owner.php', payload);
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      if (result.success) {
        editModal.classList.remove('active');
        loadOwners();
      } else {
        alert(result.message || 'Could not update this account.');
      }
    } catch (err) {
      console.error('Error updating beach owner:', err);
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      alert('Could not reach the server. Please make sure the backend/MySQL is running.');
    }
  });

  // ===== LOGOUT =====
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentRole');
      window.location.href = this.getAttribute('href');
    });
  }

  console.log('🏖️ Manage Beach Owners page ready');
});
