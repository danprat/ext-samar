/**
 * Popup Script untuk SOAL-AI v2 (Context Menu Focused)
 * Tidak ada form input - semua processing via context menu
 */

// Configuration - Production Environment
const CONFIG = {
  API_BASE_URL: 'https://soal-ai.web.id/api',
  API_BASE_URL_FALLBACK: 'https://soal-ai.web.id/api',
  WEBSITE_URL: 'https://soal-ai.web.id'
};

// DOM Elements
const elements = {
  // Screens
  loginScreen: document.getElementById('loginScreen'),
  dashboardScreen: document.getElementById('dashboardScreen'),

  // Auth Forms
  magicLinkForm: document.getElementById('magicLinkForm'),
  otpForm: document.getElementById('otpForm'),
  loginEmail: document.getElementById('loginEmail'),
  otpEmail: document.getElementById('otpEmail'),
  otpToken: document.getElementById('otpToken'),
  
  // Auth Buttons
  sendMagicLinkBtn: document.getElementById('sendMagicLinkBtn'),
  verifyOtpBtn: document.getElementById('verifyOtpBtn'),
  googleLoginBtn: document.getElementById('googleLoginBtn'),
  backToEmailBtn: document.getElementById('backToEmailBtn'),
  
  // Legacy
  loginForm: document.getElementById('magicLinkForm'), // Alias for compatibility
  loginBtn: document.getElementById('sendMagicLinkBtn'), // Alias for compatibility
  loginError: document.getElementById('loginError'),
  loginErrorText: document.getElementById('loginErrorText'),
  registerLink: document.getElementById('registerLink'),

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

// Legacy authentication functions - REMOVED (not needed with optimized caching system)

async function login(email, password, rememberMe) {
  // Try HTTPS first, then HTTP fallback
  const urls = [CONFIG.API_BASE_URL, CONFIG.API_BASE_URL_FALLBACK];

  for (let i = 0; i < urls.length; i++) {
    const apiUrl = urls[i];
    try {
      console.log(`🔐 Attempting login to (attempt ${i + 1}):`, `${apiUrl}/login`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin || 'chrome-extension://soal-ai'
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('✅ Login response status:', response.status);
      console.log('📋 Login response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Login failed with status:', response.status, 'Response:', errorText.substring(0, 500));

        // If this is not the last URL, try the next one
        if (i < urls.length - 1) {
          console.log('🔄 Trying fallback URL...');
          continue;
        }

        // Try to parse as JSON, fallback to text
        let errorMessage = 'Login failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || 'Login failed';
        } catch (e) {
          if (response.status === 401) {
            errorMessage = 'Email atau password salah';
          } else if (response.status === 422) {
            errorMessage = 'Data tidak valid. Periksa email dan password Anda.';
          } else if (response.status === 500) {
            errorMessage = 'Server error. Silakan coba lagi nanti.';
          } else if (errorText.includes('Server Error')) {
            errorMessage = 'Server error. Silakan coba lagi nanti.';
          } else {
            errorMessage = `Server error (${response.status}). Silakan coba lagi.`;
          }
        }

        return { success: false, error: errorMessage };
      }

      const result = await response.json();
      console.log('✅ Login result:', result);

      if (result.success && result.token) {
        // Store auth data
        const authData = {
          auth_token: result.token,
          user_data: result.user,
          remember_me: rememberMe,
          login_timestamp: Date.now()
        };

        await chrome.storage.local.set(authData);
        console.log('💾 Auth data stored successfully');

        showDashboard(result.user);
        await loadUserProfile();

        return { success: true };
      } else {
        const errorMsg = result.error || result.message || 'Login failed - no token received';
        console.error('❌ Login failed:', errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error(`❌ Login error with ${apiUrl}:`, error);

      // Handle specific error types
      if (error.name === 'AbortError') {
        console.error('⏰ Login timeout');
        if (i < urls.length - 1) {
          console.log('🔄 Trying fallback URL after timeout...');
          continue;
        }
        return { success: false, error: 'Login timeout. Silakan coba lagi.' };
      }

      // If this is not the last URL, try the next one
      if (i < urls.length - 1) {
        console.log('🔄 Network error, trying fallback URL...');
        continue;
      }

      return { success: false, error: 'Network error. Periksa koneksi internet Anda dan coba lagi.' };
    }
  }
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

async function loadRateLimitStats() {
  try {
    const authData = await chrome.storage.local.get(['supabase_access_token', 'last_rate_limit_info']);

    if (!authData.supabase_access_token) {
      console.log('No auth token found for rate limit stats');
      return;
    }

    // Use cached rate limit info (updated after each API call)
    if (authData.last_rate_limit_info) {
      console.log('Using cached rate limit stats:', authData.last_rate_limit_info);
      await setCachedData(CACHE_KEYS.RATE_LIMIT_STATS, authData.last_rate_limit_info);
      updateRateLimitDisplay(authData.last_rate_limit_info);
      return;
    }

    // Fallback: Rate limit stats are included in each API response now
    console.log('No cached rate limit stats available yet');
    return;

    if (response.ok) {
      const result = await response.json();
      console.log('Rate limit stats loaded:', result);

      if (result.success && result.rate_limit_stats) {
        // Cache the rate limit stats
        await setCachedData(CACHE_KEYS.RATE_LIMIT_STATS, result.rate_limit_stats);
        updateRateLimitDisplay(result.rate_limit_stats);
      }
    } else {
      console.warn('Failed to load rate limit stats:', response.status);
    }
  } catch (error) {
    console.error('Error loading rate limit stats:', error);
  }
}

// Background rate limit stats loading (non-blocking)
async function loadRateLimitStatsBackground() {
  try {
    const authData = await chrome.storage.local.get(['auth_token']);

    if (!authData.auth_token) {
      return;
    }

    const response = await fetch(`${CONFIG.API_BASE_URL}/ai/rate-limit-stats`, {
      headers: {
        'Authorization': `Bearer ${authData.auth_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();

      if (result.success && result.rate_limit_stats) {
        // Cache the rate limit stats
        await setCachedData(CACHE_KEYS.RATE_LIMIT_STATS, result.rate_limit_stats);
        updateRateLimitDisplay(result.rate_limit_stats);
      }
    }
  } catch (error) {
    console.error('Background rate limit stats error:', error);
  }
}

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
  if (elements.userName) elements.userName.textContent = userData.name || 'User';
  if (elements.userEmail) elements.userEmail.textContent = userData.email || '';
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

  if (enabled) {
    elements.samarModeBtn.classList.add('active');
    elements.samarModeBtn.title = 'Nonaktifkan Samar Mode';
  } else {
    elements.samarModeBtn.classList.remove('active');
    elements.samarModeBtn.title = 'Aktifkan Samar Mode';
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

        // Load rate limit stats in background
        await loadRateLimitStatsBackground();
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

// Message listener for background script communications
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refresh_rate_limit_stats') {
    console.log('🔄 Received rate limit refresh request from:', message.source);
    // Refresh rate limit stats immediately (non-blocking)
    loadRateLimitStatsBackground().catch(error => {
      console.error('Failed to refresh rate limit stats:', error);
    });
    sendResponse({ success: true });
  }
});

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
    const badgeClass = remaining > 0 ? 'badge-expired' : 'badge-expired';
    const badgeText = 'HABIS';
    elements.subscriptionBadge.innerHTML = `<span class="badge ${badgeClass}">${badgeText}</span>`;
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
    const badgeClass = isActive ? 'badge-active' : 'badge-expired';
    const badgeText = isActive ? 'Aktif' : 'Expired';
    elements.subscriptionBadge.innerHTML = `<span class="badge ${badgeClass}">${badgeText}</span>`;
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







// Get package information - HANYA PREMIUM
function getPackageInfo(packageType) {
  console.log('🔍 getPackageInfo called with:', packageType);

  const packageMap = {
    // FREE plan support
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

    // PREMIUM plan support (new format)
    'PREMIUM': {
      icon: '✨',
      title: 'Premium Plan',
      subtitle: 'Unlimited soal tanpa batas'
    },

    // TRIAL plan support
    'TRIAL': {
      icon: '🔄',
      title: 'TRIAL Plan',
      subtitle: 'Plan trial'
    },
    'Trial': {
      icon: '🔄',
      title: 'TRIAL Plan',
      subtitle: 'Plan trial'
    },
    'trial': {
      icon: '🔄',
      title: 'TRIAL Plan',
      subtitle: 'Plan trial'
    },

    // Legacy formats (for backward compatibility)
    'monthly': {
      icon: '✨',
      title: 'Premium Plan',
      subtitle: 'Unlimited soal tanpa batas'
    },
    'lifetime': {
      icon: '💎',
      title: 'Premium Lifetime',
      subtitle: 'Unlimited selamanya'
    },
    'premium_7': {
      icon: '⭐',
      title: 'Premium 7 Hari',
      subtitle: 'Unlimited soal'
    },
    'premium_30': {
      icon: '🚀',
      title: 'Premium 30 Hari',
      subtitle: 'Unlimited + fitur advanced'
    },
    'premium_90': {
      icon: '💎',
      title: 'Premium 90 Hari',
      subtitle: 'Unlimited + priority support'
    },

    // New format from API (exact match)
    'Premium 7 Hari': {
      icon: '⭐',
      title: 'Premium 7 Hari',
      subtitle: 'Unlimited soal'
    },
    'Premium 30 Hari': {
      icon: '🚀',
      title: 'Premium 30 Hari',
      subtitle: 'Unlimited + fitur advanced'
    },
    'Premium 90 Hari': {
      icon: '💎',
      title: 'Premium 90 Hari',
      subtitle: 'Unlimited + priority support'
    }
  };

  const result = packageMap[packageType];

  if (result) {
    console.log('✅ Package info found:', result);
    return result;
  } else {
    console.warn('❌ Package type not found, using default:', packageType);
    return {
      icon: '💳',
      title: 'Perlu Premium',
      subtitle: 'Upgrade untuk menggunakan AI'
    };
  }
}



// Format expiry date
function formatExpiryDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID');
}

// Setup event listeners
function setupEventListeners() {
  // New Auth Forms
  if (elements.magicLinkForm) {
    elements.magicLinkForm.addEventListener('submit', handleSendMagicLink);
  }
  
  if (elements.otpForm) {
    elements.otpForm.addEventListener('submit', handleVerifyOTP);
  }
  
  if (elements.googleLoginBtn) {
    elements.googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }
  
  if (elements.backToEmailBtn) {
    elements.backToEmailBtn.addEventListener('click', handleBackToEmail);
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
async function handleLogin(event) {
  event.preventDefault();

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;
  const rememberMe = elements.rememberMe.checked;

  if (!email || !password) {
    showLoginError('Please fill in all fields');
    return;
  }

  if (!isValidEmail(email)) {
    showLoginError('Please enter a valid email address');
    return;
  }



  setLoginLoading(true);
  hideLoginError();

  const result = await login(email, password, rememberMe);

  setLoginLoading(false);

  if (!result.success) {
    showLoginError(result.error);
  }
}

async function handleLogout() {
  await logout();
}

function handleRegisterLink(event) {
  event.preventDefault();
  chrome.tabs.create({ url: `${CONFIG.WEBSITE_URL}/register` });
}

function handleUpgradeToPremium(event) {
  event.preventDefault();
  chrome.tabs.create({ url: `${CONFIG.WEBSITE_URL}/subscriptions/status` });
}



// New Auth Handler Functions
async function handleSendMagicLink(event) {
  event.preventDefault();
  
  const email = elements.loginEmail.value.trim();
  
  if (!email || !isValidEmail(email)) {
    showAlert('error', 'Mohon masukkan email yang valid');
    return;
  }

  // Show loading
  elements.sendMagicLinkBtn.disabled = true;
  elements.sendMagicLinkBtn.querySelector('.btn-text').textContent = 'Mengirim...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'send_magic_link',
      email: email
    });

    if (response.success) {
      // Show OTP form
      elements.magicLinkForm.style.display = 'none';
      elements.otpForm.style.display = 'block';
      elements.otpEmail.textContent = email;
      elements.otpToken.focus();
      
      showAlert('success', 'Magic link telah dikirim! Cek email Anda.');
    } else {
      showAlert('error', response.error || 'Gagal mengirim magic link');
    }
  } catch (error) {
    console.error('Magic link error:', error);
    showAlert('error', 'Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    elements.sendMagicLinkBtn.disabled = false;
    elements.sendMagicLinkBtn.querySelector('.btn-text').textContent = 'Kirim Magic Link';
  }
}

async function handleVerifyOTP(event) {
  event.preventDefault();
  
  const email = elements.otpEmail.textContent;
  const token = elements.otpToken.value.trim();
  
  if (!token || token.length !== 6) {
    showAlert('error', 'Masukkan 6 digit kode yang valid');
    return;
  }

  // Show loading
  elements.verifyOtpBtn.disabled = true;
  elements.verifyOtpBtn.querySelector('.btn-text').textContent = 'Memverifikasi...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'verify_otp',
      email: email,
      token: token
    });

    if (response.success) {
      showAlert('success', 'Login berhasil! 🎉');
      
      // Hide OTP form and show loading
      elements.otpForm.style.display = 'none';
      showLoadingState();
      
      // Directly check auth status and show dashboard
      setTimeout(async () => {
        try {
          await checkAuthStatusFull();
        } catch (error) {
          console.error('Failed to load dashboard:', error);
          window.location.reload();
        }
      }, 500);
    } else {
      showAlert('error', response.error || 'Kode tidak valid atau expired');
    }
  } catch (error) {
    console.error('OTP verification error:', error);
    showAlert('error', 'Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    elements.verifyOtpBtn.disabled = false;
    elements.verifyOtpBtn.querySelector('.btn-text').textContent = 'Verify & Login';
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
      showAlert('success', 'Login dengan Google berhasil! 🎉');
      
      // Hide login form and show loading
      elements.magicLinkForm.style.display = 'none';
      showLoadingState();
      
      // Directly check auth status and show dashboard
      setTimeout(async () => {
        try {
          await checkAuthStatusFull();
        } catch (error) {
          console.error('Failed to load dashboard:', error);
          window.location.reload();
        }
      }, 500);
    } else {
      showAlert('error', response.error || 'Gagal login dengan Google');
    }
  } catch (error) {
    console.error('Google login error:', error);
    showAlert('error', 'Terjadi kesalahan. Silakan coba lagi.');
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

function handleBackToEmail() {
  elements.otpForm.style.display = 'none';
  elements.magicLinkForm.style.display = 'block';
  elements.otpToken.value = '';
}

// UI Helper functions
function setLoginLoading(loading) {
  const btnText = elements.sendMagicLinkBtn.querySelector('.btn-text');
  const btnLoader = elements.sendMagicLinkBtn.querySelector('.btn-loader');

  if (loading) {
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    elements.sendMagicLinkBtn.disabled = true;
  } else {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    elements.sendMagicLinkBtn.disabled = false;
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
  const guideUrl = 'https://soal-ai.web.id/petunjuk';
  chrome.tabs.create({ url: guideUrl });
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
  // FREE users: 'FREE', 'free', 'Trial', null
  // PREMIUM users: 'PREMIUM', 'monthly', 'lifetime', etc.
  if (planType === 'PREMIUM' || (planType && planType !== 'Trial' && planType !== 'free' && planType !== 'FREE')) {
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
