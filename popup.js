/**
 * Popup Script untuk SOAL-AI v2 (Refactored)
 * Uses modular services for caching and samar mode
 */

// DOM Elements
const elements = {
  loginScreen: document.getElementById('loginScreen'),
  dashboardScreen: document.getElementById('dashboardScreen'),
  loginForm: document.getElementById('loginForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  togglePassword: document.getElementById('togglePassword'),
  loginBtn: document.getElementById('loginBtn'),
  googleLoginBtn: document.getElementById('googleLoginBtn'),
  registerLink: document.getElementById('registerLink'),
  loginError: document.getElementById('loginError'),
  loginErrorText: document.getElementById('loginErrorText'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  logoutBtn: document.getElementById('logoutBtn'),
  subscriptionCard: document.getElementById('subscriptionCard'),
  subscriptionIcon: document.getElementById('subscriptionIcon'),
  subscriptionTitle: document.getElementById('subscriptionTitle'),
  subscriptionDesc: document.getElementById('subscriptionDesc'),
  subscriptionBadge: document.getElementById('subscriptionBadge'),
  subscriptionDetails: document.getElementById('subscriptionDetails'),
  expiryDate: document.getElementById('expiryDate'),
  daysRemaining: document.getElementById('daysRemaining'),
  daysRemainingRow: document.getElementById('daysRemainingRow'),
  upgradeButtons: document.getElementById('upgradeButtons'),
  upgradeToPremiumBtn: document.getElementById('upgradeToPremiumBtn'),
  guideBtn: document.getElementById('guideBtn'),
  guideLoginBtn: document.getElementById('guideLoginBtn'),
  scanAreaBtn: document.getElementById('scanAreaBtn'),
  samarModeBtn: document.getElementById('samarModeBtn'),
  alertContainer: document.getElementById('alertContainer'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingText: document.getElementById('loadingText')
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================
function calculateIsActive(expiresAt) {
  if (!expiresAt) return false;
  return new Date() < new Date(expiresAt);
}

function calculateDaysRemaining(expiresAt) {
  if (!expiresAt) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiresAt);
  expiryDate.setHours(23, 59, 59, 999);
  if (now > expiryDate) return 0;
  return Math.max(0, Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24)));
}

function formatExpiryDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// =====================================================
// AUTH FUNCTIONS
// =====================================================
async function logout() {
  try {
    await chrome.runtime.sendMessage({ action: 'logout' });
    showLoginScreen();
    console.log('✅ Logout completed');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

async function loadUserProfile(showLoading = true) {
  try {
    const authData = await chrome.storage.local.get(['supabase_access_token']);

    if (!authData.supabase_access_token) {
      console.log('No auth token found, showing login screen');
      showLoginScreen();
      return null;
    }

    if (showLoading) {
      console.log('Loading user profile from Supabase...');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.AUTH_TIMEOUT_MS);
    
    let response;
    try {
      response = await fetch(`${CONFIG.API.FUNCTIONS_URL}/auth-me`, {
        headers: {
          'Authorization': `Bearer ${authData.supabase_access_token}`,
          'Content-Type': 'application/json',
          'apikey': CONFIG.API.SUPABASE_ANON_KEY
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('⏱️ Profile load timeout');
        if (showLoading) showAlert('Koneksi timeout. Coba lagi.', 'error');
        return null;
      }
      throw fetchError;
    }

    if (response.ok) {
      const result = await response.json();

      if (result.success && result.user) {
        await chrome.storage.local.set({
          user_data: result.user,
          login_required: false
        });

        if (result.subscription) {
          await chrome.storage.local.set({
            plan_type: result.subscription.plan_type,
            expires_at: result.subscription.expires_at,
            subscription_status: result.subscription.status,
            license_valid: result.subscription.is_active,
            usage_count: result.subscription.usage_count || 0
          });
        } else {
          await chrome.storage.local.set({
            plan_type: 'FREE',
            expires_at: null,
            subscription_status: 'inactive',
            license_valid: false,
            usage_count: 0
          });
        }

        if (result.quota_info) {
          await chrome.storage.local.set({ rateLimitStats: result.quota_info });
        }

        if (showLoading) {
          updateUserDisplay(result.user);
          updateLicenseDisplay(result.subscription, result.quota_info);
        }

        return {
          ...result.user,
          subscription_data: result.subscription,
          quota_info: result.quota_info
        };
      }
    } else if (response.status === 401) {
      console.log('🔒 Token expired (401)');
      await chrome.runtime.sendMessage({ action: 'logout' });
      showLoginScreen();
      showAlert('Sesi Anda telah berakhir. Silakan login kembali.', 'warning');
    }
    return null;
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
}

// =====================================================
// UI MANAGEMENT
// =====================================================
function showLoginScreen() {
  elements.loginScreen.classList.remove('hidden');
  elements.dashboardScreen.classList.add('hidden');
  hideLoading();
}

function showDashboard(userData) {
  elements.loginScreen.classList.add('hidden');
  elements.dashboardScreen.classList.remove('hidden');
  hideLoading();
}

function showLoading(message = 'Memuat...') {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.classList.remove('hidden');
    if (elements.loadingText) {
      elements.loadingText.textContent = message;
    }
  }
}

function hideLoading() {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.classList.add('hidden');
  }
}

function updateLoadingText(message) {
  if (elements.loadingText) {
    elements.loadingText.textContent = message;
  }
}

// Legacy functions for compatibility
function showLoadingState() {
  showLoading('Memuat...');
}

function hideLoadingState() {
  hideLoading();
}

function updateUserDisplay(userData) {
  if (elements.userName) {
    elements.userName.textContent = userData.email || userData.name || 'User';
    elements.userName.style.display = 'block';
  }
}

function updateLicenseDisplay(data, quotaInfo) {
  if (!data) {
    updateFreeUserDisplay(quotaInfo);
    return;
  }

  const planType = data.plan_type || 'FREE';
  
  if (planType === 'FREE' || planType === 'free') {
    updateFreeUserDisplay(quotaInfo || { 
      current: data.usage_count || 0, 
      limit: 20, 
      remaining: 20 - (data.usage_count || 0), 
      plan_type: 'FREE' 
    });
    return;
  }

  const isActive = calculateIsActive(data.expires_at);
  const isActiveStatus = data.status === 'active';

  if (!isActive || !isActiveStatus) {
    updateFreeUserDisplay(quotaInfo);
    return;
  }

  updatePremiumUserDisplay(data, isActive);

  if (elements.upgradeButtons) {
    elements.upgradeButtons.style.display = 'none';
  }

  applyTheme('PREMIUM');
}

function updatePremiumUserDisplay(data, isActive) {
  if (elements.subscriptionIcon) elements.subscriptionIcon.textContent = '✨';
  if (elements.subscriptionTitle) elements.subscriptionTitle.textContent = 'Premium Plan';
  if (elements.subscriptionDesc) elements.subscriptionDesc.textContent = 'Unlimited soal tanpa batas';
  
  if (elements.subscriptionBadge) {
    const badgeClass = isActive ? 'badge-status badge-active' : 'badge-status badge-expired';
    const badgeText = isActive ? 'AKTIF' : 'EXPIRED';
    elements.subscriptionBadge.innerHTML = `<span class="${badgeClass}">${badgeText}</span>`;
  }

  if (data.expires_at) {
    const daysRemaining = calculateDaysRemaining(data.expires_at);
    if (elements.expiryDate) elements.expiryDate.textContent = formatExpiryDate(data.expires_at);
    if (elements.daysRemainingRow) elements.daysRemainingRow.style.display = 'flex';
    if (elements.daysRemaining) {
      elements.daysRemaining.textContent = (!isActive || daysRemaining <= 0) 
        ? 'Sudah expired' 
        : `${daysRemaining} hari lagi`;
    }
  } else {
    if (elements.expiryDate) elements.expiryDate.textContent = 'Lifetime';
    if (elements.daysRemainingRow) elements.daysRemainingRow.style.display = 'none';
  }
}

function updateFreeUserDisplay(quotaInfo) {
  const current = quotaInfo?.current || 0;
  const limit = quotaInfo?.limit || 20;
  const remaining = quotaInfo?.remaining || (limit - current);

  if (elements.subscriptionIcon) elements.subscriptionIcon.textContent = '🆓';
  if (elements.subscriptionTitle) elements.subscriptionTitle.textContent = 'FREE Plan';
  if (elements.subscriptionDesc) elements.subscriptionDesc.textContent = `${current} soal terjawab`;
  if (elements.subscriptionBadge) {
    elements.subscriptionBadge.innerHTML = `<span class="badge-status badge-expired">FREE</span>`;
  }
  if (elements.expiryDate) elements.expiryDate.textContent = 'Tidak ada batas waktu';
  if (elements.daysRemainingRow) elements.daysRemainingRow.style.display = 'none';
  if (elements.upgradeButtons) elements.upgradeButtons.style.display = 'block';

  applyTheme('FREE');
}

function applyTheme(planType) {
  document.body.classList.remove('theme-free', 'theme-premium');
  document.body.classList.add(planType === 'PREMIUM' ? 'theme-premium' : 'theme-free');
}

function showAlert(message, type = 'info') {
  if (!elements.alertContainer) return;

  const alertId = Date.now();
  const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  const alertHTML = `
    <div id="alert-${alertId}" class="alert alert-${type}" style="margin-bottom: 12px; animation: slideInDown 0.3s ease;">
      <div class="alert-icon">${icon}</div>
      <div class="alert-content"><span class="alert-text">${message}</span></div>
    </div>
  `;

  elements.alertContainer.insertAdjacentHTML('beforeend', alertHTML);

  setTimeout(() => {
    const alertElement = document.getElementById(`alert-${alertId}`);
    if (alertElement) {
      alertElement.style.animation = 'slideOutUp 0.3s ease';
      setTimeout(() => alertElement.remove(), 300);
    }
  }, 5000);
}

// =====================================================
// SAMAR MODE (Using service via messaging)
// =====================================================
async function getSamarModeState() {
  try {
    const result = await chrome.storage.local.get(['samar_mode_enabled']);
    return result.samar_mode_enabled || false;
  } catch (error) {
    console.error('Error getting Samar Mode state:', error);
    return false;
  }
}

async function setSamarModeState(enabled) {
  try {
    await chrome.storage.local.set({ samar_mode_enabled: enabled });
    chrome.runtime.sendMessage({ action: 'samar_mode_changed', enabled });
    console.log(`🔍 Samar Mode ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Error setting Samar Mode state:', error);
  }
}

async function toggleSamarMode() {
  try {
    const currentState = await getSamarModeState();
    const newState = !currentState;
    await setSamarModeState(newState);
    updateSamarModeUI(newState);
    showAlert(`Samar Mode ${newState ? 'diaktifkan' : 'dinonaktifkan'}`, 'info');
    return newState;
  } catch (error) {
    console.error('Error toggling Samar Mode:', error);
    showAlert('Gagal mengubah Samar Mode', 'error');
    return false;
  }
}

function updateSamarModeUI(enabled) {
  if (!elements.samarModeBtn) return;
  const labelElement = elements.samarModeBtn.querySelector('.action-label');
  
  if (enabled) {
    elements.samarModeBtn.classList.add('active');
    elements.samarModeBtn.title = 'Nonaktifkan Samar Mode';
    if (labelElement) labelElement.textContent = 'Aktif';
  } else {
    elements.samarModeBtn.classList.remove('active');
    elements.samarModeBtn.title = 'Aktifkan Samar Mode';
    if (labelElement) labelElement.textContent = 'Samar';
  }
}

async function initializeSamarMode() {
  try {
    const enabled = await getSamarModeState();
    updateSamarModeUI(enabled);
    chrome.runtime.sendMessage({ action: 'samar_mode_changed', enabled });
    console.log('🔍 Samar Mode initialized:', enabled);
  } catch (error) {
    console.error('Error initializing Samar Mode:', error);
  }
}

// =====================================================
// AUTH CHECK
// =====================================================
async function waitForValidation(maxWait = 3000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const { auth_validating } = await chrome.storage.local.get(['auth_validating']);
    if (!auth_validating) return true;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  console.warn('⚠️ Validation wait timeout');
  return false;
}

async function checkAuthStatusFull() {
  try {
    console.log('🔍 Full auth check...');
    
    // Step 1: Check cached data first for instant display
    const cachedData = await chrome.storage.local.get([
      'supabase_access_token', 'user_data', 'plan_type', 'expires_at', 
      'subscription_status', 'rateLimitStats', 'auth_validating', 'login_required'
    ]);

    // If no token at all, show login immediately (no loading)
    if (!cachedData.supabase_access_token) {
      console.log('ℹ️ No token found, showing login');
      showLoginScreen();
      return;
    }

    // If login required flag is set, show login
    if (cachedData.login_required) {
      console.log('🔒 Login required flag is set');
      showLoginScreen();
      showAlert('Sesi Anda telah berakhir. Silakan login kembali.', 'warning');
      return;
    }

    // Step 2: Show cached data instantly if available
    if (cachedData.user_data) {
      console.log('⚡ Showing cached data instantly');
      showDashboard(cachedData.user_data);
      updateUserDisplay(cachedData.user_data);
      updateLicenseDisplay({
        plan_type: cachedData.plan_type,
        expires_at: cachedData.expires_at,
        status: cachedData.subscription_status
      }, cachedData.rateLimitStats);
      applyTheme(cachedData.plan_type || 'FREE');
    } else {
      // No cached data, show loading
      showLoading('Memuat profil...');
    }

    // Step 3: Wait for background validation if in progress (short wait)
    if (cachedData.auth_validating) {
      console.log('⏳ Waiting for background validation...');
      updateLoadingText('Memvalidasi sesi...');
      await waitForValidation(3000);
    }

    // Step 4: Check if login is now required after validation
    const { login_required: loginRequiredNow } = await chrome.storage.local.get(['login_required']);
    if (loginRequiredNow) {
      console.log('🔒 Login required after validation');
      showLoginScreen();
      showAlert('Sesi Anda telah berakhir. Silakan login kembali.', 'warning');
      return;
    }

    // Step 5: Refresh profile data in background (don't block UI)
    refreshProfileInBackground();

  } catch (error) {
    console.error('Full auth check error:', error);
    showLoginScreen();
    hideLoading();
  }
}

async function refreshProfileInBackground() {
  try {
    console.log('🔄 Refreshing profile in background...');
    const userData = await loadUserProfile(false);
    
    if (userData) {
      updateUserDisplay(userData);
      updateLicenseDisplay(userData.subscription_data, userData.quota_info);
      applyTheme(userData.subscription_data?.plan_type || 'FREE');
    }
  } catch (error) {
    console.error('Background profile refresh error:', error);
  }
}

// =====================================================
// EVENT HANDLERS
// =====================================================
async function handleEmailPasswordLogin(event) {
  event.preventDefault();
  
  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value.trim();
  
  if (!email || !isValidEmail(email)) {
    showAlert('Mohon masukkan email yang valid', 'error');
    return;
  }

  if (!password || password.length < 6) {
    showAlert('Password minimal 6 karakter', 'error');
    return;
  }

  setLoginLoading(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'login_email_password',
      email,
      password
    });

    if (response?.success) {
      showAlert('Login berhasil! 🎉', 'success');
      showLoadingState();
      elements.loginEmail.value = '';
      elements.loginPassword.value = '';
      setTimeout(() => checkAuthStatusFull(), 500);
    } else {
      showAlert(response?.error || 'Email atau password salah', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showAlert('Terjadi kesalahan. Silakan coba lagi.', 'error');
  } finally {
    setLoginLoading(false);
  }
}

function handleTogglePassword() {
  const passwordInput = elements.loginPassword;
  const eyeIcon = elements.togglePassword.querySelector('.eye-icon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.textContent = '🙈';
  } else {
    passwordInput.type = 'password';
    eyeIcon.textContent = '👁️';
  }
}

async function handleGoogleLogin() {
  elements.googleLoginBtn.disabled = true;
  elements.googleLoginBtn.innerHTML = '<span>Loading...</span>';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'login_google' });

    if (response?.success) {
      showAlert('Login dengan Google berhasil! 🎉', 'success');
      showLoadingState();
      setTimeout(() => checkAuthStatusFull(), 500);
    } else {
      showAlert(response?.error || 'Gagal login dengan Google', 'error');
    }
  } catch (error) {
    console.error('Google login error:', error);
    showAlert('Terjadi kesalahan. Silakan coba lagi.', 'error');
  } finally {
    elements.googleLoginBtn.disabled = false;
    elements.googleLoginBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" style="margin-right: 8px;">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      <span>Login dengan Google</span>
    `;
  }
}

function setLoginLoading(loading) {
  const btnText = elements.loginBtn.querySelector('.btn-text');
  const btnLoader = elements.loginBtn.querySelector('.btn-loader');

  if (loading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    elements.loginBtn.disabled = true;
    elements.loginEmail.disabled = true;
    elements.loginPassword.disabled = true;
  } else {
    btnText.style.display = 'inline-block';
    btnLoader.style.display = 'none';
    elements.loginBtn.disabled = false;
    elements.loginEmail.disabled = false;
    elements.loginPassword.disabled = false;
  }
}

async function handleScanArea() {
  try {
    chrome.runtime.sendMessage({ action: 'activate_area_selector' }, (response) => {
      if (response?.success) {
        showAlert('Pilih area untuk di-scan dengan mouse', 'info');
        window.close();
      } else {
        showAlert('Gagal mengaktifkan scan area tool', 'error');
      }
    });
  } catch (error) {
    console.error('Scan area button error:', error);
    showAlert('Gagal mengaktifkan scan area: ' + error.message, 'error');
  }
}

async function handleSamarMode() {
  try {
    await toggleSamarMode();
  } catch (error) {
    console.error('Samar mode button error:', error);
    showAlert('Gagal mengubah Samar Mode: ' + error.message, 'error');
  }
}

function openGuide() {
  chrome.tabs.create({ url: CONFIG.WEBSITE.GUIDE_URL });
}

function updateShortcutKeys() {
  const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  const contextMenuKey = 'Ctrl+Shift+S';
  const scanAreaKey = 'Ctrl+Shift+A';

  const shortcutItems = document.querySelectorAll('.shortcut-keys');
  if (shortcutItems.length >= 2) {
    shortcutItems[0].textContent = contextMenuKey;
    shortcutItems[1].textContent = scanAreaKey;
  }
}

// =====================================================
// EVENT LISTENERS SETUP
// =====================================================
function setupEventListeners() {
  if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', handleEmailPasswordLogin);
  }
  
  if (elements.togglePassword) {
    elements.togglePassword.addEventListener('click', handleTogglePassword);
  }
  
  if (elements.googleLoginBtn) {
    elements.googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }

  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', logout);
  }

  if (elements.registerLink) {
    elements.registerLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: CONFIG.WEBSITE.SIGNUP_URL });
    });
  }

  if (elements.upgradeToPremiumBtn) {
    elements.upgradeToPremiumBtn.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `${CONFIG.WEBSITE.WEBSITE_URL}/subscription` });
    });
  }

  if (elements.guideBtn) {
    elements.guideBtn.addEventListener('click', openGuide);
  }

  if (elements.guideLoginBtn) {
    elements.guideLoginBtn.addEventListener('click', openGuide);
  }

  if (elements.scanAreaBtn) {
    elements.scanAreaBtn.addEventListener('click', handleScanArea);
  }

  if (elements.samarModeBtn) {
    elements.samarModeBtn.addEventListener('click', handleSamarMode);
  }
}

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    applyTheme('free');
    setupEventListeners();
    updateShortcutKeys();
    await initializeSamarMode();
    await checkAuthStatusFull();
  } catch (error) {
    console.error('Error initializing popup:', error);
    showLoginScreen();
  }
});

window.addEventListener('load', function() {
  document.body.style.minWidth = '320px';
  document.body.style.minHeight = '480px';
  document.body.style.overflow = 'auto';
});
