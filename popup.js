/**
 * Popup Script untuk SOAL-AI v2 (Context Menu Focused)
 * Tidak ada form input - semua processing via context menu
 */

// Configuration - Production Environment
const CONFIG = {
  WEBSITE_URL: 'https://app.soal-ai.web.id',
  SIGNUP_URL: 'https://app.soal-ai.web.id/auth/signup',
  GUIDE_URL: 'https://app.soal-ai.web.id/extension-guide'
};

// DOM Elements
const elements = {
  // Screens
  loginScreen: document.getElementById('loginScreen'),
  dashboardScreen: document.getElementById('dashboardScreen'),

  // Auth Forms
  loginForm: document.getElementById('loginForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  togglePassword: document.getElementById('togglePassword'),
  
  // Auth Buttons
  loginBtn: document.getElementById('loginBtn'),
  googleLoginBtn: document.getElementById('googleLoginBtn'),
  registerLink: document.getElementById('registerLink'),
  
  // Alerts
  loginError: document.getElementById('loginError'),
  loginErrorText: document.getElementById('loginErrorText'),

  // User Info
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  logoutBtn: document.getElementById('logoutBtn'),

  // Subscription Card
  subscriptionCard: document.getElementById('subscriptionCard'),
  subscriptionIcon: document.getElementById('subscriptionIcon'),
  subscriptionTitle: document.getElementById('subscriptionTitle'),
  subscriptionDesc: document.getElementById('subscriptionDesc'),
  subscriptionBadge: document.getElementById('subscriptionBadge'),
  subscriptionDetails: document.getElementById('subscriptionDetails'),
  expiryDate: document.getElementById('expiryDate'),
  daysRemaining: document.getElementById('daysRemaining'),
  daysRemainingRow: document.getElementById('daysRemainingRow'),



  // Upgrade Section
  upgradeButtons: document.getElementById('upgradeButtons'),
  upgradeToPremiumBtn: document.getElementById('upgradeToPremiumBtn'),



  // Guide button
  guideBtn: document.getElementById('guideBtn'),
  guideLoginBtn: document.getElementById('guideLoginBtn'),

  // Scan Area button
  scanAreaBtn: document.getElementById('scanAreaBtn'),

  // Samar Mode button
  samarModeBtn: document.getElementById('samarModeBtn'),

  // Alert Container
  alertContainer: document.getElementById('alertContainer')
};

// Helper function to calculate if license is active
function calculateIsActive(expiresAt) {
  if (!expiresAt) return false;

  const now = new Date();
  const expiryDate = new Date(expiresAt);

  return now < expiryDate;
}

// Helper function to calculate days remaining
function calculateDaysRemaining(expiresAt) {
  if (!expiresAt) return 0;

  // Set waktu ke awal hari untuk perhitungan yang akurat
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expiryDate = new Date(expiresAt);
  expiryDate.setHours(23, 59, 59, 999); // Set ke akhir hari

  if (now > expiryDate) return 0;

  const diffTime = expiryDate - now;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

async function logout() {
  try {
    const authData = await chrome.storage.local.get(['supabase_access_token']);

    if (authData.supabase_access_token) {
      // Sign out from Supabase Auth
      try {
        await fetch(`https://ekqkwtxpjqqwjovekdqp.supabase.co/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authData.supabase_access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWt3dHhwanFxd2pvdmVrZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDE5NjMsImV4cCI6MjA3NjI3Nzk2M30.Uq0ekLIjQ052wGixZI4qh1nzZoAkde7JuJSINAHXxTQ'
          }
        });
      } catch (error) {
        console.warn('Supabase logout failed:', error);
      }
    }

    await clearAuthData();
    await clearCache(); // Clear cache on logout
    showLoginScreen();
    console.log('✅ Logout completed - all data cleared');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

async function clearAuthData() {
  // Clear all auth-related data including cache
  await chrome.storage.local.remove([
    'auth_token', // old token
    'supabase_access_token',
    'supabase_refresh_token',
    'user_data',
    'remember_me',
    'plan_type',
    'expires_at',
    'subscription_status',
    'license_valid',
    'last_checked',
    'suspension_reason'
  ]);
  console.log('🗑️ Auth data cleared');
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

    // Use Supabase Edge Function auth-me
    const SUPABASE_URL = 'https://ekqkwtxpjqqwjovekdqp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWt3dHhwanFxd2pvdmVrZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDE5NjMsImV4cCI6MjA3NjI3Nzk2M30.Uq0ekLIjQ052wGixZI4qh1nzZoAkde7JuJSINAHXxTQ';
    
    console.log('🔐 Calling auth-me with token:', authData.supabase_access_token.substring(0, 20) + '...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-me`, {
      headers: {
        'Authorization': `Bearer ${authData.supabase_access_token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      }
    });

    console.log('📡 auth-me response status:', response.status);
    
    if (showLoading) {
      console.log('API response status:', response.status);
    }

    if (response.ok) {
      const result = await response.json();

      if (showLoading) {
        console.log('API response data:', result);
      }

      if (result.success && result.user) {
        // Update user data in storage
        await chrome.storage.local.set({
          user_data: result.user
        });

        // Update subscription data in storage
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

        // Store quota info if available (from auth-me v2)
        if (result.quota_info) {
          await chrome.storage.local.set({
            rateLimitStats: result.quota_info
          });
        }

        // Only update UI if this is a foreground load
        if (showLoading) {
          updateUserDisplay(result.user);
          updateLicenseDisplay(result.subscription, result.quota_info);
          // Update rate limit display with quota info
          if (result.quota_info) {
            updateRateLimitDisplay(result.quota_info);
          }
          console.log('User profile loaded successfully');
        }

        // Return combined user data for caching
        return {
          ...result.user,
          subscription_data: result.subscription,
          quota_info: result.quota_info
        };
      } else {
        console.error('API returned success=false or no user data:', result);
        return null;
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to load user profile - HTTP', response.status, errorText);

      if (response.status === 401) {
        console.log('🔒 Token expired (401), clearing auth data and showing login');
        await clearAuthData();
        await clearCache();
        showLoginScreen();
      } else {
        console.log('⚠️ Non-401 error, keeping auth data but returning null');
      }
      return null;
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
    // Continue with cached data, don't force logout on network error
    if (showLoading) {
      console.log('Using cached data due to network error');
    }
    return null;
  }
}

// Update rate limit display - DISABLED (quota info now shown in subscription card)
function updateRateLimitDisplay(stats) {
  // DISABLED: Quota info now shown in subscription card only
  // This prevents duplicate "📊 Kuota Gratis" section
  console.log('Rate limit stats (now shown in subscription card):', stats);
  
  // Remove any existing rate limit element to clean up
  const existingElement = document.getElementById('rateLimitStats');
  if (existingElement) {
    existingElement.remove();
  }
  
  return;
}

// UI Management functions
function showLoginScreen() {
  elements.loginScreen.classList.remove('hidden');
  elements.dashboardScreen.classList.add('hidden');
}

function showDashboard(userData) {
  elements.loginScreen.classList.add('hidden');
  elements.dashboardScreen.classList.remove('hidden');
  // Don't update user display here - let loadUserProfile() handle it
  // This prevents race condition between cached data and fresh API data
}

function updateUserDisplay(userData) {
  // Update profile card - only show email in userName
  if (elements.userName) {
    elements.userName.textContent = userData.email || userData.name || 'User';
    elements.userName.style.display = 'block';
  }
  // userEmail element removed from HTML, no need to update
}

// Alias for updateLicenseDisplay to support caching system
function updateSubscriptionDisplay(data) {
  return updateLicenseDisplay(data);
}

// Cache management
const CACHE_KEYS = {
  AUTH_STATUS: 'cached_auth_status',
  USER_DATA: 'cached_user_data',
  RATE_LIMIT_STATS: 'cached_rate_limit_stats',
  LAST_CHECK: 'last_auth_check',
  SAMAR_MODE: 'samar_mode_enabled',
  CACHE_DURATION: 10 * 60 * 1000 // 10 minutes - longer since auto-update after AI requests
};

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Cache utilities
async function getCachedData(key) {
  try {
    const result = await chrome.storage.local.get([key, CACHE_KEYS.LAST_CHECK]);
    const lastCheck = result[CACHE_KEYS.LAST_CHECK] || 0;
    const now = Date.now();

    // Check if cache is still valid
    if (now - lastCheck < CACHE_KEYS.CACHE_DURATION && result[key]) {
      console.log(`📦 Using cached data for ${key}`);
      return result[key];
    }

    return null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

async function setCachedData(key, data) {
  try {
    await chrome.storage.local.set({
      [key]: data,
      [CACHE_KEYS.LAST_CHECK]: Date.now()
    });
    console.log(`💾 Cached data for ${key}`);
  } catch (error) {
    console.error('Error setting cached data:', error);
  }
}

async function clearCache() {
  try {
    await chrome.storage.local.remove([
      CACHE_KEYS.AUTH_STATUS,
      CACHE_KEYS.USER_DATA,
      CACHE_KEYS.RATE_LIMIT_STATS,
      CACHE_KEYS.LAST_CHECK
    ]);
    console.log('🗑️ Cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

// Samar Mode Management
async function getSamarModeState() {
  try {
    const result = await chrome.storage.local.get([CACHE_KEYS.SAMAR_MODE]);
    return result[CACHE_KEYS.SAMAR_MODE] || false;
  } catch (error) {
    console.error('Error getting Samar Mode state:', error);
    return false;
  }
}

async function setSamarModeState(enabled) {
  try {
    await chrome.storage.local.set({ [CACHE_KEYS.SAMAR_MODE]: enabled });
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

    // Notify background script about state change
    chrome.runtime.sendMessage({
      action: 'samar_mode_changed',
      enabled: newState
    });

    showAlert(
      `Samar Mode ${newState ? 'diaktifkan' : 'dinonaktifkan'}`,
      'info'
    );

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
    console.log('🔍 Initializing Samar Mode...');
    console.log('🔍 Samar Mode Button Element:', elements.samarModeBtn);

    const enabled = await getSamarModeState();
    console.log('🔍 Current Samar Mode state:', enabled);

    updateSamarModeUI(enabled);

    // Notify background script about current state
    chrome.runtime.sendMessage({
      action: 'samar_mode_changed',
      enabled: enabled
    });

    console.log('🔍 Samar Mode initialized successfully');
  } catch (error) {
    console.error('Error initializing Samar Mode:', error);
  }
}

// Optimized auth check with caching
async function checkAuthStatusOptimized() {
  try {
    // Try to get cached auth status first
    const cachedAuthStatus = await getCachedData(CACHE_KEYS.AUTH_STATUS);
    const cachedUserData = await getCachedData(CACHE_KEYS.USER_DATA);
    const cachedRateLimit = await getCachedData(CACHE_KEYS.RATE_LIMIT_STATS);

    if (cachedAuthStatus && cachedUserData) {
      // Use cached data immediately for fast UI update
      if (cachedAuthStatus.isAuthenticated) {
        showDashboard(cachedUserData);
        updateUserDisplay(cachedUserData);
        updateSubscriptionDisplay(cachedAuthStatus.subscriptionData);
        applyTheme(cachedAuthStatus.subscriptionData?.plan_type || 'free');

        // Load cached rate limit stats if available
        if (cachedRateLimit) {
          updateRateLimitDisplay(cachedRateLimit);
        }
      } else {
        showLoginScreen();
      }

      // Still check in background for updates, but don't block UI
      setTimeout(() => checkAuthStatusBackground(), 100);
      return;
    }

    // No cache available, do full check
    await checkAuthStatusFull();
  } catch (error) {
    console.error('Error in optimized auth check:', error);
    showLoginScreen();
  }
}

// Background auth check (non-blocking)
const checkAuthStatusBackground = debounce(async () => {
  try {
    console.log('🔄 Background auth check...');
    const result = await chrome.runtime.sendMessage({ action: 'validate_license' });

    if (result?.success) {
      const userData = await loadUserProfile(false); // Don't show loading
      if (userData) {
        // Update cache with fresh data
        const authStatus = {
          isAuthenticated: true,
          subscriptionData: userData.subscription_data
        };

        await setCachedData(CACHE_KEYS.AUTH_STATUS, authStatus);
        await setCachedData(CACHE_KEYS.USER_DATA, userData);

        // Update UI if data changed
        updateUserDisplay(userData);
        updateSubscriptionDisplay(userData.subscription_data);
      }
    }
  } catch (error) {
    console.error('Background auth check error:', error);
  }
}, 1000);

// Full auth check (blocking)
async function checkAuthStatusFull() {
  try {
    console.log('🔍 Full auth check...');
    showLoadingState();

    // First check if we have Supabase auth token in storage
    const storage = await chrome.storage.local.get(['supabase_access_token', 'user_data', 'license_valid']);

    // If we have token, try to load user profile (regardless of license_valid status)
    // license_valid bisa false untuk FREE users, tapi mereka tetap authenticated
    if (storage.supabase_access_token) {
      console.log('✅ Found Supabase token, loading profile...');
      const userData = await loadUserProfile(true);
      if (userData) {
        console.log('✅ Profile loaded successfully:', userData);
        const authStatus = {
          isAuthenticated: true,
          subscriptionData: userData.subscription_data
        };

        // Cache the results
        await setCachedData(CACHE_KEYS.AUTH_STATUS, authStatus);
        await setCachedData(CACHE_KEYS.USER_DATA, userData);

        showDashboard(userData);
        updateUserDisplay(userData);
        updateSubscriptionDisplay(userData.subscription_data);
        applyTheme(userData.subscription_data?.plan_type || 'free');
        return;
      } else {
        console.log('❌ Profile loading failed, token might be expired');
      }
    } else {
      console.log('❌ No Supabase token found in storage');
    }

    // No valid token or profile loading failed, try background validation
    const result = await chrome.runtime.sendMessage({ action: 'validate_license' });

    if (result?.success) {
      const userData = await loadUserProfile(true);
      if (userData) {
        const authStatus = {
          isAuthenticated: true,
          subscriptionData: userData.subscription_data
        };

        // Cache the results
        await setCachedData(CACHE_KEYS.AUTH_STATUS, authStatus);
        await setCachedData(CACHE_KEYS.USER_DATA, userData);

        showDashboard(userData);
        updateUserDisplay(userData);
        updateSubscriptionDisplay(userData.subscription_data);
        applyTheme(userData.subscription_data?.plan_type || 'free');
      } else {
        showLoginScreen();
      }
    } else {
      await clearCache();
      showLoginScreen();
    }
  } catch (error) {
    console.error('Full auth check error:', error);
    await clearCache();
    showLoginScreen();
  } finally {
    hideLoadingState();
  }
}

// Loading state management
function showLoadingState() {
  if (elements.loginScreen) {
    elements.loginScreen.style.opacity = '0.7';
  }
  if (elements.dashboardScreen) {
    elements.dashboardScreen.style.opacity = '0.7';
  }
}

function hideLoadingState() {
  if (elements.loginScreen) {
    elements.loginScreen.style.opacity = '1';
  }
  if (elements.dashboardScreen) {
    elements.dashboardScreen.style.opacity = '1';
  }
}

// Initialize popup with optimizations
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Apply default theme
    applyTheme('free');

    setupEventListeners();
    updateShortcutKeys();

    // Initialize Samar Mode
    await initializeSamarMode();

    // FORCE FRESH AUTH CHECK on popup open
    // This ensures we always show latest quota/usage data
    // Cache is still used for subsequent operations within same session
    await checkAuthStatusFull();
  } catch (error) {
    console.error('Error initializing popup:', error);
    showLoginScreen();
  }
});

// Ensure popup size on load (moved from inline script)
window.addEventListener('load', function () {
  document.body.style.minWidth = '320px';
  document.body.style.minHeight = '480px';
  document.body.style.overflow = 'auto';
});

// Legacy loadLicenseInfo function - REMOVED (not needed)

// Update license display - Support FREE & PREMIUM users
function updateLicenseDisplay(data, quotaInfo) {
  console.log('Updating subscription display with data:', data, 'quotaInfo:', quotaInfo);

  // Handle null/undefined subscription data
  if (!data) {
    console.warn('No subscription data provided - showing FREE display');
    updateFreeUserDisplay(quotaInfo);
    return;
  }

  const planType = data.plan_type || 'FREE';
  
  // FREE user - show quota info instead of "need subscription"
  if (planType === 'FREE' || planType === 'free') {
    console.log('Showing FREE user display with quota');
    updateFreeUserDisplay(quotaInfo || { current: data.usage_count || 0, limit: 20, remaining: 20 - (data.usage_count || 0), plan_type: 'FREE' });
    return;
  }

  // PREMIUM user - check if subscription is active
  const isActive = calculateIsActive(data.expires_at);
  const isActiveStatus = data.status === 'active';

  console.log('PREMIUM subscription validation', {
    isActive,
    isActiveStatus,
    planType: planType,
    expiresAt: data.expires_at,
    status: data.status
  });

  // If premium but expired, show as FREE
  if (!isActive || !isActiveStatus) {
    console.warn('PREMIUM subscription expired, showing as FREE');
    updateFreeUserDisplay(quotaInfo);
    return;
  }

  console.log('Showing active PREMIUM subscription');

  // Update subscription card for PREMIUM user
  updatePremiumSubscriptionCard(data, isActive);

  // Hide upgrade buttons for active premium users
  if (elements.upgradeButtons) {
    elements.upgradeButtons.style.display = 'none';
  }

  // Apply premium theme
  applyTheme('PREMIUM');
}

function updateFreeUserDisplay(quotaInfo) {
  // Display for FREE users with quota info
  const current = quotaInfo?.current || 0;
  const limit = quotaInfo?.limit || 20;
  const remaining = quotaInfo?.remaining || (limit - current);

  if (elements.subscriptionIcon) elements.subscriptionIcon.textContent = '🆓';
  if (elements.subscriptionTitle) elements.subscriptionTitle.textContent = 'FREE Plan';
  if (elements.subscriptionDesc) {
    // Get user email from storage or userName element
    const userEmail = elements.userEmail?.textContent || elements.userName?.textContent || '';
    elements.subscriptionDesc.textContent = `${remaining} soal tersisa dari ${limit} soal gratis`;
  }
  if (elements.subscriptionBadge) {
    const badgeClass = remaining > 0 ? 'badge-status badge-expired' : 'badge-status badge-expired';
    const badgeText = 'FREE';
    elements.subscriptionBadge.innerHTML = `<span class="${badgeClass}">${badgeText}</span>`;
  }
  if (elements.expiryDate) elements.expiryDate.textContent = 'Tidak ada batas waktu';
  if (elements.daysRemainingRow) elements.daysRemainingRow.style.display = 'none';

  // Show upgrade buttons for FREE users
  if (elements.upgradeButtons) elements.upgradeButtons.style.display = 'block';

  // Apply free theme
  applyTheme('FREE');
}

function updatePremiumSubscriptionCard(data, isActive) {
  // Display for PREMIUM users
  if (elements.subscriptionIcon) elements.subscriptionIcon.textContent = '✨';
  if (elements.subscriptionTitle) elements.subscriptionTitle.textContent = 'Premium Plan';
  if (elements.subscriptionDesc) elements.subscriptionDesc.textContent = 'Unlimited soal tanpa batas';
  
  // Status badge
  if (elements.subscriptionBadge) {
    const badgeClass = isActive ? 'badge-status badge-active' : 'badge-status badge-expired';
    const badgeText = isActive ? 'Aktif' : 'Expired';
    elements.subscriptionBadge.innerHTML = `<span class="${badgeClass}">${badgeText}</span>`;
  }

  // Update expiry information
  updateExpiryInfo(data, isActive);
}

function updateNoSubscriptionDisplay() {
  // Fallback display - redirect to FREE display
  updateFreeUserDisplay({ current: 0, limit: 20, remaining: 20, plan_type: 'FREE' });
}

// Legacy updateHelpStatusCard function - REMOVED (helpStatusCard elements don't exist in HTML)

// Update subscription card
function updateSubscriptionCard(data, isActive, hasValidPlan) {
  // Package icon and title
  const packageInfo = getPackageInfo(data.plan_type || 'free');
  if (elements.subscriptionIcon) elements.subscriptionIcon.textContent = packageInfo.icon;
  if (elements.subscriptionTitle) elements.subscriptionTitle.textContent = packageInfo.title;
  if (elements.subscriptionDesc) elements.subscriptionDesc.textContent = packageInfo.subtitle;

  // Status badge
  if (elements.subscriptionBadge) {
    let badgeClass = 'badge ';
    let badgeText = '';

    if (isActive) {
      badgeClass += 'badge-active';
      badgeText = 'Aktif';
    } else {
      badgeClass += 'badge-expired';
      badgeText = 'Expired';
    }

    elements.subscriptionBadge.innerHTML = `<span class="${badgeClass}">${badgeText}</span>`;
  }

  // Update expiry information
  updateExpiryInfo(data, isActive);
}

// Update expiry information
function updateExpiryInfo(data, isActive) {
  if (data.expires_at && data.plan_type && data.plan_type !== 'free') {
    const daysRemaining = calculateDaysRemaining(data.expires_at);

    if (elements.expiryDate) {
      elements.expiryDate.textContent = formatExpiryDate(data.expires_at);
    }

    if (elements.daysRemainingRow) {
      elements.daysRemainingRow.style.display = 'flex';
    }

    if (elements.daysRemaining) {
      if (!isActive || daysRemaining <= 0) {
        elements.daysRemaining.textContent = 'Sudah expired';
      } else {
        elements.daysRemaining.textContent = `${daysRemaining} hari lagi`;
      }
    }
  } else {
    if (elements.expiryDate) elements.expiryDate.textContent = 'Tidak ada';
    if (elements.daysRemainingRow) elements.daysRemainingRow.style.display = 'none';
  }
}

function isPremium(planType) {
  return planType && planType !== 'free' && planType !== 'FREE' && planType !== '';
}







// Get package information - Support FREE & PREMIUM only
function getPackageInfo(packageType) {
  const packageMap = {
    'FREE': {
      icon: '🆓',
      title: 'FREE Plan',
      subtitle: '20 soal gratis'
    },
    'free': {
      icon: '🆓',
      title: 'FREE Plan',
      subtitle: '20 soal gratis'
    },
    'PREMIUM': {
      icon: '✨',
      title: 'Premium Plan',
      subtitle: 'Unlimited soal tanpa batas'
    }
  };

  return packageMap[packageType] || {
    icon: '💳',
    title: 'Perlu Premium',
    subtitle: 'Upgrade untuk menggunakan AI'
  };
}



// Format expiry date
function formatExpiryDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID');
}

// Setup event listeners
function setupEventListeners() {
  // Email & Password Login Form
  if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', handleEmailPasswordLogin);
  }
  
  // Toggle password visibility
  if (elements.togglePassword) {
    elements.togglePassword.addEventListener('click', handleTogglePassword);
  }
  
  // Google Login
  if (elements.googleLoginBtn) {
    elements.googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }

  // Logout button
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', handleLogout);
  }

  // Register link
  if (elements.registerLink) {
    elements.registerLink.addEventListener('click', handleRegisterLink);
  }



  // Upgrade to Premium button
  if (elements.upgradeToPremiumBtn) {
    elements.upgradeToPremiumBtn.addEventListener('click', handleUpgradeToPremium);
  }



  // Guide button
  if (elements.guideBtn) {
    elements.guideBtn.addEventListener('click', openGuide);
  }

  // Guide button in login screen
  if (elements.guideLoginBtn) {
    elements.guideLoginBtn.addEventListener('click', openGuide);
  }

  // Scan Area button
  if (elements.scanAreaBtn) {
    elements.scanAreaBtn.addEventListener('click', handleScanArea);
  }

  // Samar Mode button
  console.log('🔍 Setting up Samar Mode button:', elements.samarModeBtn);
  if (elements.samarModeBtn) {
    elements.samarModeBtn.addEventListener('click', handleSamarMode);
    console.log('🔍 Samar Mode button event listener added');
  } else {
    console.warn('🔍 Samar Mode button not found in DOM');
  }
}

// Event handlers
async function handleLogout() {
  await logout();
}

function handleRegisterLink(event) {
  event.preventDefault();
  chrome.tabs.create({ url: CONFIG.SIGNUP_URL });
}

function handleUpgradeToPremium(event) {
  event.preventDefault();
  chrome.tabs.create({ url: `${CONFIG.WEBSITE_URL}/subscription` });
}



// New Auth Handler Functions
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

  // Show loading
  setLoginLoading(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'login_email_password',
      email: email,
      password: password
    });

    if (response.success) {
      showAlert('Login berhasil! 🎉', 'success');
      
      // Hide login form and show loading
      showLoadingState();
      
      // Clear form
      elements.loginEmail.value = '';
      elements.loginPassword.value = '';
      
      // Check auth status and show dashboard
      setTimeout(async () => {
        try {
          await checkAuthStatusFull();
        } catch (error) {
          console.error('Failed to load dashboard:', error);
          window.location.reload();
        }
      }, 500);
    } else {
      showAlert(response.error || 'Email atau password salah', 'error');
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
  // Show loading
  elements.googleLoginBtn.disabled = true;
  elements.googleLoginBtn.innerHTML = '<span>Loading...</span>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'login_google'
    });

    if (response.success) {
      showAlert('Login dengan Google berhasil! 🎉', 'success');
      
      // Hide login form and show loading
      showLoadingState();
      
      // Check auth status and show dashboard
      setTimeout(async () => {
        try {
          await checkAuthStatusFull();
        } catch (error) {
          console.error('Failed to load dashboard:', error);
          window.location.reload();
        }
      }, 500);
    } else {
      showAlert(response.error || 'Gagal login dengan Google', 'error');
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

// UI Helper functions
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

function showLoginError(message) {
  showAlert('error', message);
}

function hideLoginError() {
  // Alert will auto-hide
}

// Legacy upgrade request functions - REMOVED (not used in current system)

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Legacy message functions - REMOVED (statusMessage element doesn't exist, use showAlert instead)

// Open guide page
function openGuide() {
  chrome.tabs.create({ url: CONFIG.GUIDE_URL });
}

// Update shortcut keys based on platform
function updateShortcutKeys() {
  const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  // Mac menggunakan MacCtrl+Shift (sesuai manifest.json) yang ditampilkan sebagai Ctrl+Shift
  const contextMenuKey = isMac ? 'Ctrl+Shift+S' : 'Ctrl+Shift+S';
  const scanAreaKey = isMac ? 'Ctrl+Shift+A' : 'Ctrl+Shift+A';

  // Update shortcut keys in the popup
  const shortcutItems = document.querySelectorAll('.shortcut-keys');
  if (shortcutItems.length >= 2) {
    shortcutItems[0].textContent = contextMenuKey;
    shortcutItems[1].textContent = scanAreaKey;
  }


}

// Handle scan area button click
async function handleScanArea() {
  try {

    // Send message to background script to activate scan area
    chrome.runtime.sendMessage({
      action: 'activate_area_selector'
    }, (response) => {
      if (response && response.success) {
        showAlert('Pilih area untuk di-scan dengan mouse', 'info');
        // Close popup after activating scan area
        window.close();
      } else {
        showAlert('Gagal mengaktifkan scan area tool', 'error');
      }
    });

  } catch (error) {
    console.error('❌ Scan area button error:', error);
    showAlert('Gagal mengaktifkan scan area: ' + error.message, 'error');
  }
}

// Handle samar mode button click
async function handleSamarMode() {
  try {
    await toggleSamarMode();
  } catch (error) {
    console.error('❌ Samar mode button error:', error);
    showAlert('Gagal mengubah Samar Mode: ' + error.message, 'error');
  }
}

// Apply theme based on subscription status
function applyTheme(planType) {
  const body = document.body;

  // Remove existing theme classes
  body.classList.remove('theme-free', 'theme-premium');

  // Apply appropriate theme
  // FREE users: 'FREE', 'free', null
  // PREMIUM users: 'PREMIUM'
  if (planType === 'PREMIUM') {
    body.classList.add('theme-premium');
  } else {
    body.classList.add('theme-free');
  }
}





// Alert function
function showAlert(message, type = 'info') {
  if (!elements.alertContainer) return;

  const alertId = Date.now();
  const alertHTML = `
    <div id="alert-${alertId}" class="alert alert-${type}" style="
      margin-bottom: 12px;
      animation: slideInDown 0.3s ease;
    ">
      <div class="alert-icon">${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</div>
      <div class="alert-content">
        <span class="alert-text">${message}</span>
      </div>
    </div>
  `;

  elements.alertContainer.insertAdjacentHTML('beforeend', alertHTML);

  // Auto remove after 5 seconds
  setTimeout(() => {
    const alertElement = document.getElementById(`alert-${alertId}`);
    if (alertElement) {
      alertElement.style.animation = 'slideOutUp 0.3s ease';
      setTimeout(() => alertElement.remove(), 300);
    }
  }, 5000);
}
