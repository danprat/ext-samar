/**
 * Background Service Worker untuk SOAL-AI v2
 * Handles: License validation, daily sync, quota management, scan area processing
 */

// Import API client untuk backend communication
importScripts('api-client.js');

// Configuration langsung di background.js (tidak bisa import window object di service worker)
const CONFIG = {
  ENVIRONMENT: 'production',
  SUPABASE_URL: 'https://ekqkwtxpjqqwjovekdqp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWt3dHhwanFxd2pvdmVrZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDE5NjMsImV4cCI6MjA3NjI3Nzk2M30.Uq0ekLIjQ052wGixZI4qh1nzZoAkde7JuJSINAHXxTQ',
  FUNCTIONS_URL: 'https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1'
};

// Simplified logger
const Logger = {
  info: (message, data = null) => console.log(`[INFO] ${message}`, data || ''),
  warn: (message, data = null) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message, error = null) => console.error(`[ERROR] ${message}`, error || '')
};

// Samar Mode state management
let samarModeEnabled = false;

async function getSamarModeState() {
  try {
    const result = await chrome.storage.local.get(['samar_mode_enabled']);
    return result.samar_mode_enabled || false;
  } catch (error) {
    Logger.error('Error getting Samar Mode state', error);
    return false;
  }
}

async function initializeSamarModeState() {
  try {
    samarModeEnabled = await getSamarModeState();
    Logger.info(`🔍 Samar Mode initialized: ${samarModeEnabled}`);
    console.log('🔍 Background: Samar Mode state loaded:', samarModeEnabled);
  } catch (error) {
    Logger.error('Error initializing Samar Mode state', error);
  }
}

// Inisialisasi saat extension pertama kali diinstall atau reload
chrome.runtime.onInstalled.addListener((details) => {
  console.log('SOAL-AI v2 installed/reloaded');

  // Create context menus
  createContextMenus().catch(error => {
    console.error('Failed to create context menus:', error);
  });

  // Initialize Samar Mode state
  initializeSamarModeState().catch(error => {
    console.error('Failed to initialize Samar Mode state:', error);
  });

  if (details.reason === 'install') {
    initializeSystem().catch(error => {
      console.error('Failed to initialize system:', error);
    });
  }
});

// Also create context menus on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('SOAL-AI v2 startup');

  createContextMenus().catch(error => {
    console.error('Failed to create context menus on startup:', error);
  });

  validateAuthToken().catch(error => {
    console.error('Failed to validate auth token on startup:', error);
  });

  // Initialize Samar Mode state
  initializeSamarModeState().catch(error => {
    console.error('Failed to initialize Samar Mode state:', error);
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we have a valid tab
    if (!tab) {
      await showNotification('SOAL-AI Error', 'Tidak ada tab aktif', 'error');
      return;
    }

    switch (command) {
      case 'open-context-menu':
        await handleContextMenuShortcut(tab);
        break;

      case 'activate-scan-area':
        await handleScanAreaShortcut(tab);
        break;

      default:
        await showNotification('SOAL-AI Error', `Command tidak dikenal: ${command}`, 'error');
    }
  } catch (error) {
    console.error('❌ Keyboard shortcut error:', error);
    await showNotification('SOAL-AI Error', 'Shortcut gagal dijalankan: ' + error.message, 'error');
  }
});

// Create context menus - Simplified version dengan scan area
async function createContextMenus() {
  try {
    // Remove existing menus first
    chrome.contextMenus.removeAll(() => {
      // Create single main context menu for text selection
      chrome.contextMenus.create({
        id: 'soal-ai-main',
        title: '🤖 Soal-AI',
        contexts: ['selection']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Error creating main menu:', chrome.runtime.lastError);
        }
      });
    });

  } catch (error) {
    console.error('❌ Failed to create context menus:', error);
  }
}

// Initialize system - simplified
async function initializeSystem() {
  try {
    // Clean up legacy storage keys
    await cleanupLegacyStorage();
  } catch (error) {
    console.error('Error initializing system:', error);
  }
}

// Clean up legacy storage keys
async function cleanupLegacyStorage() {
  try {
    const legacyKeys = [
      'used_today', 'total_used', 'last_minute_usage',
      'daily_reset_time', 'minute_reset_time', 'device_id'
    ];
    await chrome.storage.local.remove(legacyKeys);
  } catch (error) {
    console.error('Error cleaning up legacy storage:', error);
  }
}

// Fungsi ini dihapus - tidak ada lagi offline license

// Check if user is authenticated (has supabase_access_token)
async function isUserAuthenticated() {
  try {
    const storage = await chrome.storage.local.get(['supabase_access_token']);
    return !!storage.supabase_access_token;
  } catch (error) {
    Logger.error('Failed to check authentication status', error);
    return false;
  }
}



// Validasi auth token dan subscription dengan Supabase
async function validateAuthToken() {
  try {
    const storage = await chrome.storage.local.get([
      'supabase_access_token', 'user_data', 'last_checked'
    ]);

    const today = new Date().toISOString().split('T')[0];

    if (!storage.supabase_access_token) {
      Logger.warn('No auth token found - login required');
      return false;
    }

    // Cek apakah hari ini sudah divalidasi
    // NOTE: license_valid bisa false untuk FREE users, tapi mereka tetap authenticated
    // Hanya cek apakah sudah validate hari ini dan tidak suspended
    if (storage.last_checked === today && !storage.suspension_reason) {
      Logger.info('✅ Already validated today, using cached auth status');
      return true;
    }

    try {
      const response = await fetch(`${CONFIG.FUNCTIONS_URL}/auth-me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${storage.supabase_access_token}`,
          'apikey': CONFIG.SUPABASE_ANON_KEY
        }
      });

      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        Logger.error('Server returned HTML instead of JSON', {
          status: response.status,
          contentType,
          htmlPreview: htmlText.substring(0, 200)
        });
        throw new Error(`Server error: Expected JSON but got HTML (Status: ${response.status})`);
      }

      const result = await response.json();

      if (response.ok && result.success) {
        const subscription = result.subscription;
        const user = result.user;
        const isActive = subscription?.is_active || false;

        // PERBAIKAN BUG: Cek apakah user di-suspend
        // User di-suspend jika expired_at < now (set by admin)
        const userExpiredAt = user?.expired_at ? new Date(user.expired_at) : null;
        const now = new Date();
        const isSuspended = userExpiredAt && userExpiredAt < now;

        Logger.info('Backend validation response', {
          hasSubscription: !!subscription,
          planType: subscription?.plan_type,
          status: subscription?.status,
          isActive: isActive,
          expiresAt: subscription?.expires_at,
          userExpiredAt: user?.expired_at,
          isSuspended: isSuspended,
          currentTime: now.toISOString(),
          suspensionCheck: userExpiredAt ? `${userExpiredAt.toISOString()} < ${now.toISOString()} = ${isSuspended}` : 'No expiry date'
        });

        // Jika user di-suspend, tidak boleh menggunakan extension
        if (isSuspended) {
          Logger.warn('User is suspended by admin', {
            userExpiredAt: userExpiredAt.toISOString(),
            currentTime: now.toISOString()
          });
          await chrome.storage.local.set({
            license_valid: false,
            last_checked: today,
            suspension_reason: 'Akun Anda telah disuspend oleh admin. Silakan hubungi support untuk informasi lebih lanjut.'
          });
          return false;
        }

        // Update storage dengan data terbaru dari backend
        await chrome.storage.local.set({
          user_data: result.user,
          expires_at: subscription?.expires_at,
          plan_type: subscription?.plan_type,
          subscription_status: subscription?.status || 'inactive',
          last_checked: today,
          license_valid: isActive,
          suspension_reason: null // Clear suspension reason
        });

        Logger.info('Auth token validated successfully', {
          isActive,
          planType: subscription?.plan_type,
          status: subscription?.status,
          isSuspended: false
        });
        
        // Return true jika tidak suspended
        // FREE users juga dianggap valid (authenticated) meskipun license_valid = false
        return true;
      } else {
        // Token tidak valid atau expired
        Logger.error('Auth validation failed - API response', {
          status: response.status,
          success: result?.success,
          error: result?.error
        });

        await chrome.storage.local.set({
          license_valid: false,
          last_checked: today
        });

        return false;
      }
    } catch (networkError) {
      Logger.error('Backend validation failed - network error:', networkError.message);
      // Tidak ada fallback offline mode - user harus online untuk validasi
      await chrome.storage.local.set({
        license_valid: false,
        last_checked: today
      });
      return false;
    }
  } catch (error) {
    Logger.error('Error validating auth token:', error);
    return false;
  }
}

// Email & Password Login - Direct Supabase Auth API
async function loginWithEmailPassword(email, password) {
  try {
    Logger.info('Logging in with email/password', { email });

    // Use Supabase Auth API directly
    const response = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ 
        email: email,
        password: password
      })
    });

    const result = await response.json();

    if (response.ok && result.access_token) {
      // Check/Create profile menggunakan service role
      await ensureUserProfile(result.user.id, result.user.email);

      // Store Supabase session tokens
      await chrome.storage.local.set({
        supabase_access_token: result.access_token,
        supabase_refresh_token: result.refresh_token,
        user_data: result.user,
        license_valid: true,
        last_checked: new Date().toISOString().split('T')[0]
      });

      Logger.info('Email/password login successful', {
        userId: result.user.id,
        userEmail: result.user.email
      });

      return {
        success: true,
        user: result.user,
        token: result.access_token
      };
    } else {
      Logger.error('Email/password login failed', {
        status: response.status,
        error: result.error_description || result.error || result.msg
      });

      return {
        success: false,
        error: result.error_description || result.error || result.msg || 'Invalid email or password'
      };
    }
  } catch (error) {
    Logger.error('Email/password login error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Send Magic Link untuk login - Direct Supabase Auth API
async function sendMagicLink(email) {
  try {
    Logger.info('Sending magic link', { email });

    // Use Supabase Auth API directly
    const response = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ 
        email: email,
        options: {
          emailRedirectTo: `${CONFIG.SUPABASE_URL}/auth/v1/verify`
        }
      })
    });

    const result = await response.json();

    if (response.ok) {
      Logger.info('Magic link sent successfully', { email });
      return {
        success: true,
        message: 'Magic link telah dikirim ke email Anda',
        email: email
      };
    } else {
      Logger.error('Failed to send magic link', {
        status: response.status,
        error: result.error_description || result.msg
      });

      return {
        success: false,
        error: result.error_description || result.msg || 'Failed to send magic link'
      };
    }
  } catch (error) {
    Logger.error('Magic link error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Verify OTP token dari email - Direct Supabase Auth API
async function verifyOTP(email, token) {
  try {
    Logger.info('Verifying OTP', { email });

    // Use Supabase Auth API directly
    const response = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ 
        type: 'email',
        email: email,
        token: token
      })
    });

    const result = await response.json();

    if (response.ok && result.access_token) {
      // Check/Create profile menggunakan service role
      await ensureUserProfile(result.user.id, result.user.email);

      // Store Supabase session tokens
      await chrome.storage.local.set({
        supabase_access_token: result.access_token,
        supabase_refresh_token: result.refresh_token,
        user_data: result.user,
        license_valid: true,
        last_checked: new Date().toISOString().split('T')[0]
      });

      Logger.info('OTP verification successful', {
        userId: result.user.id,
        userEmail: result.user.email
      });

      return {
        success: true,
        user: result.user,
        token: result.access_token
      };
    } else {
      Logger.error('OTP verification failed', {
        status: response.status,
        error: result.error_description || result.msg
      });

      return {
        success: false,
        error: result.error_description || result.msg || 'Invalid or expired token'
      };
    }
  } catch (error) {
    Logger.error('OTP verification error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ensure user has profile (create if not exists)
async function ensureUserProfile(userId, email) {
  try {
    // Call edge function to ensure profile exists
    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/auth-me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await chrome.storage.local.get(['supabase_access_token']).then(s => s.supabase_access_token)}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY
      }
    });

    if (!response.ok) {
      Logger.warn('Profile check failed, but continuing...');
    }
  } catch (error) {
    Logger.warn('Profile ensure error (non-critical):', error.message);
  }
}

// Login with Google SSO - Direct Supabase Auth
async function loginWithGoogle() {
  try {
    Logger.info('Initiating Google SSO login');

    // Build OAuth URL manually
    const redirectUrl = chrome.identity.getRedirectURL('supabase');
    const authUrl = `${CONFIG.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;

    Logger.info('OAuth URL', { authUrl, redirectUrl });

    // Open OAuth popup
    const authResult = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    Logger.info('OAuth callback received', { authResult });

    // Parse token from callback URL
    const url = new URL(authResult);
    const accessToken = url.hash.match(/access_token=([^&]*)/)?.[1];
    const refreshToken = url.hash.match(/refresh_token=([^&]*)/)?.[1];

    if (!accessToken) {
      throw new Error('No access token received from OAuth callback');
    }

    // Get user data
    const userResponse = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user data');
    }

    const user = await userResponse.json();

    // Ensure profile exists
    await ensureUserProfile(user.id, user.email);

    // Store session
    await chrome.storage.local.set({
      supabase_access_token: accessToken,
      supabase_refresh_token: refreshToken,
      user_data: user,
      license_valid: true,
      last_checked: new Date().toISOString().split('T')[0]
    });

    Logger.info('Google SSO login successful', {
      userId: user.id,
      userEmail: user.email
    });

    return {
      success: true,
      user: user,
      token: accessToken
    };

  } catch (error) {
    Logger.error('Google SSO error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Validasi kredit sebelum menggunakan AI - SISTEM BERBAYAR PENUH
async function checkCreditValidation() {
  const storage = await chrome.storage.local.get([
    'supabase_access_token', 'license_valid', 'subscription_status', 'plan_type', 'expires_at', 'user_data', 'last_checked', 'suspension_reason'
  ]);

  const today = new Date().toISOString().split('T')[0];

  Logger.info('Credit validation check', {
    hasToken: !!storage.supabase_access_token,
    licenseValid: storage.license_valid,
    subscriptionStatus: storage.subscription_status,
    planType: storage.plan_type,
    expiresAt: storage.expires_at,
    lastChecked: storage.last_checked,
    today: today
  });

  // 1. WAJIB LOGIN - tidak ada bypass
  if (!storage.supabase_access_token) {
    Logger.warn('No auth token - login required');
    return {
      allowed: false,
      reason: 'Perlu subscription aktif untuk menggunakan fitur AI.',
      action: 'login_required'
    };
  }

  // 2. Refresh dari backend hanya jika belum dicek hari ini atau license tidak valid
  if (storage.last_checked !== today || !storage.license_valid) {
    Logger.info('Refreshing auth token from backend...');
    const isValid = await validateAuthToken();

    // Get updated storage after validation
    const updatedStorage = await chrome.storage.local.get([
      'license_valid', 'subscription_status', 'plan_type', 'expires_at', 'suspension_reason'
    ]);

    Logger.info('Backend validation result', {
      isValid,
      updatedLicenseValid: updatedStorage.license_valid,
      updatedStatus: updatedStorage.subscription_status,
      hasSuspensionReason: !!updatedStorage.suspension_reason
    });

    // Use updated values
    storage.license_valid = updatedStorage.license_valid;
    storage.subscription_status = updatedStorage.subscription_status;
    storage.plan_type = updatedStorage.plan_type;
    storage.expires_at = updatedStorage.expires_at;
    storage.suspension_reason = updatedStorage.suspension_reason;
  }

  // 2.5. CEK APAKAH USER DI-SUSPEND
  if (storage.suspension_reason) {
    Logger.warn('User is suspended');
    return {
      allowed: false,
      reason: storage.suspension_reason,
      action: 'user_suspended'
    };
  }

  // Rate limiting is now handled server-side
  // Client-side rate limiting check removed

  // 3. WAJIB SUBSCRIPTION AKTIF - gunakan hasil validasi backend
  if (!storage.license_valid) {
    Logger.warn('License not valid');
    return {
      allowed: false,
      reason: 'Perlu subscription aktif untuk menggunakan fitur AI.',
      action: 'subscription_required'
    };
  }

  // 4. CEK SUBSCRIPTION STATUS - Allow FREE, TRIAL, and PREMIUM users
  if (storage.subscription_status !== 'active') {
    Logger.warn('Subscription not active', { status: storage.subscription_status });
    return {
      allowed: false,
      reason: 'Perlu subscription aktif untuk menggunakan fitur AI.',
      action: 'subscription_required'
    };
  }

  // 5. CEK EXPIRED DATE - Allow FREE plan (far future date)
  if (!storage.expires_at) {
    Logger.warn('No expiry date found');
    return {
      allowed: false,
      reason: 'Perlu subscription aktif untuk menggunakan fitur AI.',
      action: 'subscription_required'
    };
  }

  const expiryDate = new Date(storage.expires_at);
  const now = new Date();

  // Allow FREE plan with far future expiry date
  if (expiryDate <= now && storage.plan_type !== 'FREE') {
    Logger.warn('Subscription expired', { expiryDate, now, planType: storage.plan_type });
    return {
      allowed: false,
      reason: 'Subscription expired. Perlu perpanjang subscription.',
      action: 'subscription_expired'
    };
  }

  // 6. SEMUA VALIDASI PASSED - user memiliki kredit aktif
  Logger.info('Credit validation passed', {
    planType: storage.plan_type,
    expiresAt: storage.expires_at,
    subscriptionStatus: storage.subscription_status
  });

  return { allowed: true };
}

// Rate limiting is now handled server-side
// Client-side rate limiting removed in favor of backend plan-based limits

// All client-side rate limiting functions removed
// Rate limiting is now handled server-side with plan-based limits

// OCR + AI Processing handled by edge function (process-screenshot-question)
// - Screenshot uploaded to Supabase Storage (bucket: question-images)
// - Single AI call using LiteLLM with gemini/gemini-flash-lite-latest
// - Image URL stored in history for persistent access
// Extension only sends base64 image data, backend handles everything user input, not wrapped in prompt

// Parse Gemini response untuk extract JSON - Simplified version
function parseGeminiResponse(rawResponse) {
  try {
    // Clean response dari markdown atau text tambahan
    let cleanResponse = rawResponse.trim();

    // Remove markdown code blocks jika ada
    cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Find JSON object dalam response
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        success: true,
        answer: parsed.answer || 'Jawaban tidak ditemukan',
        raw_response: rawResponse
      };
    } else {
      // Fallback jika tidak ada JSON, gunakan raw response
      return {
        success: true,
        answer: cleanResponse,
        raw_response: rawResponse
      };
    }
  } catch (error) {
    Logger.warn('Failed to parse JSON response, using raw', error);

    // Fallback ke raw response
    return {
      success: true,
      answer: rawResponse,
      raw_response: rawResponse
    };
  }
}

// Process AI request via backend
async function processAIRequest(prompt, userType = 'TEXT') {
  try {
    const result = await backendAPI.processText(prompt, userType);

    if (result.success) {
      return {
        success: true,
        answer: result.answer,
        formatted_answer: result.formatted_answer,
        confidence: result.confidence,
        processing_time: result.processing_time,
        model_used: result.model_used,
        user_type: result.user_type,
        quota_info: result.quota_info
      };
    } else {
      // Handle quota exceeded (new format)
      if (result.action === 'quota_exceeded') {
        return {
          success: false,
          error: result.error,
          action: 'quota_exceeded',
          quota_info: result.quota_info,
          rate_limit_info: result.rate_limit_info // backward compatibility
        };
      }

      // Handle legacy rate limiting
      if (result.action && (result.action.startsWith('rate_limit') || result.action === 'rate_limit')) {
        return {
          success: false,
          error: result.error,
          action: result.action,
          rate_limit_info: result.rate_limit_info
        };
      }

      return {
        success: false,
        error: result.error
      };
    }

  } catch (error) {
    return {
      success: false,
      error: `Backend AI request failed: ${error.message}`
    };
  }
}

// Show notification to user
async function showNotification(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: title,
      message: message
    });
  } catch (error) {
    console.log(`${title}: ${message}`);
  }
}

// Inject floating overlay to active page - UPDATED: Seamless loading to answer transition
async function injectFloatingOverlay(tabId, question, response, windowType = 'answer') {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (question, response, windowType, samarModeEnabled) => {
        // Helper function to get button styles based on Samar Mode
        function getButtonStyles(samarModeEnabled) {
          if (samarModeEnabled) {
            return {
              copyBtn: `
                padding: 6px 12px !important;
                border: none !important;
                border-radius: 8px !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                background: rgba(255, 255, 255, 0.9) !important;
                color: #333 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 4px !important;
                transition: all 0.3s ease !important;
                min-width: 60px !important;
                height: 32px !important;
                border: 1px solid rgba(255, 255, 255, 0.3) !important;
              `,
              scanBtn: `
                padding: 6px 12px !important;
                border: none !important;
                border-radius: 8px !important;
                background: rgba(255, 255, 255, 0.9) !important;
                color: #333 !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                transition: all 0.3s ease !important;
                gap: 4px !important;
                min-width: 60px !important;
                height: 32px !important;
                border: 1px solid rgba(255, 255, 255, 0.3) !important;
              `
            };
          } else {
            return {
              copyBtn: `
                padding: 6px 12px !important;
                border: none !important;
                border-radius: 8px !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                background: #28a745 !important;
                color: white !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 4px !important;
                transition: all 0.2s !important;
                min-width: 60px !important;
                height: 32px !important;
              `,
              scanBtn: `
                padding: 6px 12px !important;
                border: none !important;
                border-radius: 8px !important;
                background: rgb(13, 21, 239) !important;
                color: white !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                transition: all 0.2s !important;
                gap: 4px !important;
                min-width: 60px !important;
                height: 32px !important;
              `
            };
          }
        }

        // Always look for the main floating window (should exist from loading state)
        let existingWindow = document.querySelector('#soal-ai-floating-main') || document.querySelector('[id^="soal-ai-floating-"]');

        if (existingWindow) {
          // Add or remove samar-mode class based on current state
          if (samarModeEnabled) {
            existingWindow.classList.add('samar-mode');
          } else {
            existingWindow.classList.remove('samar-mode');
          }

          // Seamless transition from loading to answer (preserve position)
          const header = existingWindow.querySelector('div:first-child');
          const content = existingWindow.querySelector('div:nth-child(2)');

          // Remove ALL existing footers to prevent duplicates
          const allFooters = existingWindow.querySelectorAll('div:nth-child(n+3)');
          allFooters.forEach(f => f.remove());

          // Create new footer for answer state
          const footer = document.createElement('div');

          if (header && content && footer) {
            // Store current position to ensure no movement
            const currentLeft = existingWindow.style.left;
            const currentTop = existingWindow.style.top;

            // Update header with fixed height and new content
            header.style.cssText = `
              background: rgba(255, 255, 255, 0.9) !important;
              padding: 6px 12px !important;
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              height: 28px !important;
              min-height: 28px !important;
              max-height: 28px !important;
              flex-shrink: 0 !important;
              border-bottom: 1px solid rgba(255, 255, 255, 0.3) !important;
            `;

            // Update header content to show "Jawaban" with red close button
            header.innerHTML = `
              <h3 style="margin: 0; font-size: 12px; font-weight: 600; color: #2c5aa0;">Jawaban</h3>
              <button class="close-btn" style="background: #dc3545; border: none; color: white; font-size: 12px; cursor: pointer; padding: 2px 6px; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; opacity: 0.9;" title="Close">×</button>
            `;

            // Update content with new layout structure
            content.style.cssText = `
              flex: 1 !important;
              padding: 8px !important;
              display: flex !important;
              flex-direction: column !important;
              overflow: hidden !important;
              min-height: 0 !important;
              max-height: calc(200px - 90px) !important;
            `;

            // Clear existing content
            content.innerHTML = '';

            // Create scrollable answer container (no label needed, title moved to header)
            const answerContainer = document.createElement('div');
            answerContainer.style.cssText = `
              background: rgba(255, 255, 255, 1) !important;
              padding: 8px !important;
              border-radius: 8px !important;
              color: #333 !important;
              font-size: 14px !important;
              line-height: 1.3 !important;
              font-weight: 500 !important;
              text-align: left !important;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
              flex: 1 !important;
              overflow-y: auto !important;
              overflow-x: hidden !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              hyphens: auto !important;
              max-height: 100px !important;
              min-height: 80px !important;
            `;
            answerContainer.textContent = response.answer;

            // Assemble content (no label)
            content.appendChild(answerContainer);

            // Show footer with fixed height styling
            footer.style.cssText = `
              background: rgba(255, 255, 255, 0.8) !important;
              padding: 8px 12px !important;
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              height: 32px !important;
              min-height: 32px !important;
              max-height: 32px !important;
              flex-shrink: 0 !important;
              border-top: 1px solid rgba(255, 255, 255, 0.3) !important;
            `;

            // Footer debug logging removed for production

            // Add buttons to footer with Samar Mode styling
            const buttonStyles = getButtonStyles(samarModeEnabled);
            footer.innerHTML = `
              <button class="copy-btn" style="${buttonStyles.copyBtn}">
                📋 Copy
              </button>
              <button class="scan-btn" style="${buttonStyles.scanBtn}" title="Scan Area">
                📷 Scan Area
              </button>
            `;

            // Add footer to window
            existingWindow.appendChild(footer);

            // Footer added successfully

            // Re-attach event listeners
            header.querySelector('.close-btn').addEventListener('click', () => {
              existingWindow.style.animation = 'soal-ai-slideOut 0.2s ease';
              setTimeout(() => existingWindow.remove(), 200);
            });

            // Add event listeners with error handling
            const copyBtn = footer.querySelector('.copy-btn');
            const scanBtn = footer.querySelector('.scan-btn');

            if (copyBtn) {
              copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(response.answer).then(() => {
                  const originalHTML = copyBtn.innerHTML;
                  copyBtn.innerHTML = '✅ OK';
                  copyBtn.style.background = '#28a745';
                  setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.style.background = '#28a745';
                  }, 2000);
                });
              });
            }

            if (scanBtn) {
              scanBtn.addEventListener('click', () => {
                // Use postMessage since this is injected code (no direct chrome API access)
                window.postMessage({ type: 'SOAL_AI_SCAN_AREA', action: 'activate_area_selector' }, '*');
              });
            }

            // Ensure position is preserved exactly
            existingWindow.style.left = currentLeft;
            existingWindow.style.top = currentTop;

            // Force window flexbox layout with correct dimensions
            existingWindow.style.setProperty('display', 'flex', 'important');
            existingWindow.style.setProperty('flex-direction', 'column', 'important');
            existingWindow.style.setProperty('width', '300px', 'important');
            existingWindow.style.setProperty('height', '200px', 'important');

            // Mark window as in answer state
            existingWindow.setAttribute('data-state', 'answer');

            return; // Exit early, seamless transition completed
          }
        }

        // Create new window if no existing window found (fallback - should rarely happen)

        // Remove any orphaned windows first
        const orphanedWindows = document.querySelectorAll('[id^="soal-ai-floating-"]');
        orphanedWindows.forEach(window => window.remove());

        // Use consistent ID for single window system
        const windowId = 'soal-ai-floating-main';

        // Create floating window matching reference design
        const floatingWindow = document.createElement('div');
        floatingWindow.id = windowId;
        floatingWindow.className = 'soal-ai-floating-window';

        // Add samar-mode class if enabled
        if (samarModeEnabled) {
          floatingWindow.classList.add('samar-mode');
        }

        // Mark as answer state
        floatingWindow.setAttribute('data-state', 'answer');

        // Header will show "Jawaban" instead of rate limit info

        // Center position for 300x200 window
        const centerX = (window.innerWidth - 300) / 2;
        const centerY = (window.innerHeight - 200) / 2;

        // Apply Samar Mode opacity if enabled
        const windowOpacity = samarModeEnabled ? 0.2 : 1;
        const backgroundOpacity = samarModeEnabled ? 0.03 : 0.15;

        floatingWindow.style.cssText = `
          position: fixed !important;
          left: ${Math.max(20, centerX)}px !important;
          top: ${Math.max(20, centerY)}px !important;
          width: 300px !important;
          height: 200px !important;
          max-width: calc(100vw - 40px) !important;
          background: rgba(255, 255, 255, ${backgroundOpacity}) !important;
          backdrop-filter: blur(8px) !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
          z-index: 2147483647 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          border: 1px solid rgba(255, 255, 255, 0.4) !important;
          overflow: hidden !important;
          animation: soal-ai-slideIn 0.3s ease !important;
          cursor: move !important;
          display: flex !important;
          flex-direction: column !important;
          opacity: ${windowOpacity} !important;
          transition: opacity 0.3s ease !important;
        `;

        // Create header with fixed height
        const header = document.createElement('div');
        header.style.cssText = `
          background: rgba(255, 255, 255, 0.9) !important;
          padding: 6px 12px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          height: 28px !important;
          min-height: 28px !important;
          max-height: 28px !important;
          flex-shrink: 0 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.3) !important;
        `;

        header.innerHTML = `
          <h3 style="margin: 0; font-size: 12px; font-weight: 600; color: #2c5aa0;">Jawaban</h3>
          <button class="close-btn" style="background: #dc3545; border: none; color: white; font-size: 12px; cursor: pointer; padding: 2px 6px; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; opacity: 0.9;" title="Close">×</button>
        `;

        // Create main content area with strict height control
        const content = document.createElement('div');
        content.style.cssText = `
          flex: 1 !important;
          padding: 8px !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          min-height: 0 !important;
          max-height: calc(200px - 90px) !important;
        `;

        // Create scrollable answer container (no label needed, title moved to header)
        const answerContainer = document.createElement('div');
        answerContainer.style.cssText = `
          background: rgba(255, 255, 255, 1) !important;
          padding: 8px !important;
          border-radius: 8px !important;
          color: #333 !important;
          font-size: 14px !important;
          line-height: 1.3 !important;
          font-weight: 500 !important;
          text-align: left !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
          flex: 1 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          hyphens: auto !important;
          max-height: 100px !important;
          min-height: 80px !important;
        `;
        answerContainer.textContent = response.answer;

        // Assemble content (no label)
        content.appendChild(answerContainer);

        // Create footer with copy (left) and scan (right) buttons - FIXED POSITION
        const footer = document.createElement('div');
        footer.style.cssText = `
          background: rgba(255, 255, 255, 0.8) !important;
          padding: 8px 12px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          height: 32px !important;
          min-height: 32px !important;
          max-height: 32px !important;
          flex-shrink: 0 !important;
          border-top: 1px solid rgba(255, 255, 255, 0.3) !important;
        `;

        // Create footer buttons with Samar Mode styling
        const buttonStyles = getButtonStyles(samarModeEnabled);
        footer.innerHTML = `
          <button class="copy-btn" style="${buttonStyles.copyBtn}">
            📋 Copy
          </button>
          <button class="scan-btn" style="${buttonStyles.scanBtn}" title="Scan Area">
            📷 Scan
          </button>
        `;

        // Assemble window
        floatingWindow.appendChild(header);
        floatingWindow.appendChild(content);
        floatingWindow.appendChild(footer);

        // Add drag functionality
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        header.addEventListener('mousedown', (e) => {
          if (e.target.classList.contains('close-btn')) return;

          isDragging = true;
          dragOffset.x = e.clientX - floatingWindow.offsetLeft;
          dragOffset.y = e.clientY - floatingWindow.offsetTop;

          e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;

          const newX = Math.max(0, Math.min(window.innerWidth - floatingWindow.offsetWidth, e.clientX - dragOffset.x));
          const newY = Math.max(0, Math.min(window.innerHeight - floatingWindow.offsetHeight, e.clientY - dragOffset.y));

          floatingWindow.style.left = newX + 'px';
          floatingWindow.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
          isDragging = false;
        });

        // Button functionality
        header.querySelector('.close-btn').addEventListener('click', () => {
          floatingWindow.style.animation = 'soal-ai-slideOut 0.2s ease';
          setTimeout(() => floatingWindow.remove(), 200);
        });

        footer.querySelector('.copy-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(response.answer).then(() => {
            const btn = footer.querySelector('.copy-btn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '✅ OK';
            btn.style.background = '#28a745';
            setTimeout(() => {
              btn.innerHTML = originalHTML;
              btn.style.background = '#28a745';
            }, 2000);
          });
        });

        footer.querySelector('.scan-btn').addEventListener('click', () => {
          // Activate scan area mode
          // Use postMessage since this is injected code (no direct chrome API access)
          window.postMessage({ type: 'SOAL_AI_SCAN_AREA', action: 'activate_area_selector' }, '*');
        });

        // Add to page
        document.body.appendChild(floatingWindow);

        // Add CSS animations if not exists
        if (!document.getElementById('soal-ai-floating-styles')) {
          const style = document.createElement('style');
          style.id = 'soal-ai-floating-styles';
          style.textContent = `
            @keyframes soal-ai-slideIn {
              from { transform: translateY(-30px) scale(0.9); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes soal-ai-slideOut {
              from { transform: translateY(0) scale(1); opacity: 1; }
              to { transform: translateY(-30px) scale(0.9); opacity: 0; }
            }
          `;
          document.head.appendChild(style);
        }
      },
      args: [question, response, windowType, samarModeEnabled]
    });

    Logger.info('Floating overlay injected successfully');
  } catch (error) {
    Logger.error('Failed to inject floating overlay', error);
    throw error;
  }
}

// Show loading in floating window - UPDATED: True seamless single window system
async function injectLoadingOverlay(tabId, question, windowType = 'text') {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (question, windowType, samarModeEnabled) => {
        // Helper function to get button styles based on Samar Mode
        function getButtonStyles(samarModeEnabled) {
          if (samarModeEnabled) {
            return {
              copyBtn: `
                padding: 6px 12px !important;
                border: none !important;
                border-radius: 8px !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                background: rgba(255, 255, 255, 0.9) !important;
                color: #333 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 4px !important;
                transition: all 0.3s ease !important;
                min-width: 60px !important;
                height: 32px !important;
                border: 1px solid rgba(255, 255, 255, 0.3) !important;
              `,
              scanBtn: `
                padding: 6px 12px !important;
                border: none !important;
                border-radius: 8px !important;
                background: rgba(255, 255, 255, 0.9) !important;
                color: #333 !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                transition: all 0.3s ease !important;
                gap: 4px !important;
                min-width: 60px !important;
                height: 32px !important;
                border: 1px solid rgba(255, 255, 255, 0.3) !important;
              `
            };
          } else {
            return {
              copyBtn: `
                padding: 6px 12px !important;
                border: none !important;
                border-radius: 8px !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                background: #28a745 !important;
                color: white !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 4px !important;
                transition: all 0.2s !important;
                min-width: 60px !important;
                height: 32px !important;
              `,
              scanBtn: `
                padding: 6px 12px !important;
                border: none !important;
                border-radius: 8px !important;
                background: rgb(13, 21, 239) !important;
                color: white !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                transition: all 0.2s !important;
                gap: 4px !important;
                min-width: 60px !important;
                height: 32px !important;
              `
            };
          }
        }

        // Check if there's an existing floating window to reuse
        let existingWindow = document.querySelector('#soal-ai-floating-main') || document.querySelector('[id^="soal-ai-floating-"]');

        if (existingWindow) {
          // Add or remove samar-mode class based on current state
          if (samarModeEnabled) {
            existingWindow.classList.add('samar-mode');
          } else {
            existingWindow.classList.remove('samar-mode');
          }

          // Update existing window with loading state (preserve position and size)
          const header = existingWindow.querySelector('div:first-child');
          const content = existingWindow.querySelector('div:nth-child(2)');

          // Remove ALL existing footers to prevent duplicates
          const allFooters = existingWindow.querySelectorAll('div:nth-child(n+3)');
          allFooters.forEach(f => f.remove());

          // Create new footer for loading state
          const footer = document.createElement('div');

          if (header && content && footer) {
            // Store current position for seamless transition
            const currentLeft = existingWindow.style.left;
            const currentTop = existingWindow.style.top;

            // Update content with loading (keep header and footer structure)
            content.innerHTML = `
              <div style="font-size: 10px; color: #666; margin-bottom: 4px; text-align: center;">Processing...</div>
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1;">
                <div style="width: 30px; height: 30px; margin-bottom: 8px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid #2c5aa0; border-radius: 50%; animation: soal-ai-spin 1s linear infinite;"></div>
                <div style="background: rgba(255, 255, 255, 1); padding: 6px; border-radius: 4px; color: #333; font-size: 10px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">Tunggu sebentar...</div>
              </div>
            `;

            // Style footer for loading state (hidden)
            footer.style.cssText = `
              background: rgba(255, 255, 255, 0.8) !important;
              padding: 8px 12px !important;
              display: none !important;
              justify-content: space-between !important;
              align-items: center !important;
              min-height: 32px !important;
              border-top: 1px solid rgba(255, 255, 255, 0.3) !important;
            `;

            // Add footer to window
            existingWindow.appendChild(footer);

            // Ensure position is preserved
            existingWindow.style.left = currentLeft;
            existingWindow.style.top = currentTop;

            // Mark window as in loading state
            existingWindow.setAttribute('data-state', 'loading');

            return; // Exit early, existing window updated seamlessly
          }
        }

        // Create new floating window if no existing window (first time only)
        const windowId = 'soal-ai-floating-main'; // Use consistent ID for single window

        // Remove any orphaned windows first
        const orphanedWindows = document.querySelectorAll('[id^="soal-ai-floating-"]');
        orphanedWindows.forEach(window => window.remove());

        const loadingWindow = document.createElement('div');
        loadingWindow.id = windowId;
        loadingWindow.className = 'soal-ai-floating-window';

        // Add samar-mode class if enabled
        if (samarModeEnabled) {
          loadingWindow.classList.add('samar-mode');
        }

        // Center position for new window
        const centerX = (window.innerWidth - 300) / 2;
        const centerY = (window.innerHeight - 200) / 2;

        // Apply Samar Mode opacity if enabled
        const windowOpacity = samarModeEnabled ? 0.2 : 1;
        const backgroundOpacity = samarModeEnabled ? 0.03 : 0.15;

        loadingWindow.style.cssText = `
          position: fixed !important;
          left: ${Math.max(20, centerX)}px !important;
          top: ${Math.max(20, centerY)}px !important;
          width: 300px !important;
          height: 200px !important;
          background: rgba(255, 255, 255, ${backgroundOpacity}) !important;
          backdrop-filter: blur(8px) !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
          z-index: 2147483647 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          border: 1px solid rgba(255, 255, 255, 0.4) !important;
          overflow: hidden !important;
          animation: soal-ai-slideIn 0.3s ease !important;
          cursor: move !important;
          display: flex !important;
          flex-direction: column !important;
          opacity: ${windowOpacity} !important;
          transition: opacity 0.3s ease !important;
        `;

        // Mark as loading state
        loadingWindow.setAttribute('data-state', 'loading');

        // Create header with fixed height
        const header = document.createElement('div');
        header.style.cssText = `
          background: rgba(255, 255, 255, 0.9) !important;
          padding: 6px 12px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          height: 28px !important;
          min-height: 28px !important;
          max-height: 28px !important;
          flex-shrink: 0 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.3) !important;
        `;

        header.innerHTML = `
          <h3 style="margin: 0; font-size: 12px; font-weight: 600; color: #2c5aa0;">Memproses...</h3>
          <button class="close-btn" style="background: #dc3545; border: none; color: white; font-size: 12px; cursor: pointer; padding: 2px 6px; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; opacity: 0.9;" title="Close">×</button>
        `;

        // Create loading content
        const content = document.createElement('div');
        content.style.cssText = `
          flex: 1 !important;
          padding: 8px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
        `;

        content.innerHTML = `
          <div style="font-size: 10px; color: #666; margin-bottom: 4px; text-align: center;">Processing...</div>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1;">
            <div style="width: 30px; height: 30px; margin-bottom: 8px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid #2c5aa0; border-radius: 50%; animation: soal-ai-spin 1s linear infinite;"></div>
            <div style="background: rgba(255, 255, 255, 1); padding: 6px; border-radius: 4px; color: #333; font-size: 10px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">Tunggu sebentar...</div>
          </div>
        `;

        // Create hidden footer (will be shown when answer comes)
        const footer = document.createElement('div');
        footer.style.cssText = `
          background: rgba(255, 255, 255, 0.8) !important;
          padding: 8px 12px !important;
          display: none !important;
          justify-content: space-between !important;
          align-items: center !important;
          min-height: 32px !important;
          border-top: 1px solid rgba(255, 255, 255, 0.3) !important;
        `;

        // Pre-populate footer with buttons (hidden initially) with Samar Mode styling
        const buttonStyles = getButtonStyles(samarModeEnabled);
        footer.innerHTML = `
          <button class="copy-btn" style="${buttonStyles.copyBtn}">
            📋 Copy
          </button>
          <button class="scan-btn" style="${buttonStyles.scanBtn}" title="Scan Area">
            📷 Scan
          </button>
        `;

        // Assemble window
        loadingWindow.appendChild(header);
        loadingWindow.appendChild(content);
        loadingWindow.appendChild(footer);

        // Add drag functionality
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        header.addEventListener('mousedown', (e) => {
          if (e.target.classList.contains('close-btn')) return;

          isDragging = true;
          dragOffset.x = e.clientX - loadingWindow.offsetLeft;
          dragOffset.y = e.clientY - loadingWindow.offsetTop;

          e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;

          const newX = Math.max(0, Math.min(window.innerWidth - loadingWindow.offsetWidth, e.clientX - dragOffset.x));
          const newY = Math.max(0, Math.min(window.innerHeight - loadingWindow.offsetHeight, e.clientY - dragOffset.y));

          loadingWindow.style.left = newX + 'px';
          loadingWindow.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
          isDragging = false;
        });

        // Close button functionality
        header.querySelector('.close-btn').addEventListener('click', () => {
          loadingWindow.style.animation = 'soal-ai-slideOut 0.2s ease';
          setTimeout(() => loadingWindow.remove(), 200);
        });

        // Add to page
        document.body.appendChild(loadingWindow);

        // Add CSS animations if not exists
        if (!document.getElementById('soal-ai-floating-styles')) {
          const style = document.createElement('style');
          style.id = 'soal-ai-floating-styles';
          style.textContent = `
            @keyframes soal-ai-slideIn {
              from { transform: translateY(-20px) scale(0.95); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes soal-ai-slideOut {
              from { transform: translateY(0) scale(1); opacity: 1; }
              to { transform: translateY(-20px) scale(0.95); opacity: 0; }
            }
            @keyframes soal-ai-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `;
          document.head.appendChild(style);
        }
      },
      args: [question, windowType, samarModeEnabled]
    });

    console.log('✅ Loading overlay injected');
  } catch (error) {
    console.error('❌ Failed to inject loading overlay:', error);
  }
}

/**
 * Inject rate limit overlay with countdown timer and specific messaging
 *
 * Displays different overlays based on limit type:
 * - MINUTE: Countdown timer + auto-close after wait time
 * - DAILY: Countdown until tomorrow 00:00 WIB + upgrade button
 * - MONTHLY: Countdown until 1st next month + upgrade button
 *
 * @param {number} tabId - Chrome tab ID
 * @param {string} message - Basic error message from backend
 * @param {number} waitSeconds - Seconds until limit reset
 * @param {string} limitType - 'minute', 'daily', or 'monthly'
 * @param {object} rateLimitInfo - Detailed rate limit info from backend
 */
async function injectRateLimitOverlay(tabId, message, waitSeconds, limitType, rateLimitInfo = {}) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (message, waitSeconds, limitType, rateLimitInfo) => {
        // Remove existing overlays
        const existingOverlay = document.getElementById('soal-ai-rate-limit-overlay');
        if (existingOverlay) {
          existingOverlay.remove();
        }

        // Create rate limit overlay
        const overlay = document.createElement('div');
        overlay.id = 'soal-ai-rate-limit-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 999999;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
          background: white;
          padding: 24px;
          border-radius: 16px;
          text-align: center;
          max-width: 360px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        `;

        // Debug logging for quota info
        console.log('🔍 Quota Debug:', {
          limitType,
          rateLimitInfo,
          message,
          waitSeconds
        });

        // Simple quota exceeded display (20 limit per account, no reset)
        const current = rateLimitInfo?.current || 0;
        const limit = rateLimitInfo?.limit || 20;
        const remaining = rateLimitInfo?.remaining || 0;

        content.innerHTML = `
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; margin-bottom: 16px;">
            <span style="font-size: 32px;">🚫</span>
          </div>
          <h3 style="margin: 0 0 8px 0; color: #dc2626; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">Kuota Habis!</h3>
          <p style="margin: 0 0 16px 0; color: #6b7280; line-height: 1.5; font-size: 13px;">
            Anda telah menggunakan <strong style="color: #111827;">${current}/${limit}</strong> soal gratis.<br>
            Upgrade ke Premium untuk unlimited access.
          </p>
          
          <div style="background: #fafafa; padding: 14px; border-radius: 12px; margin-bottom: 16px; border: 1.5px solid #f3f4f6;">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px; font-weight: 500;">Total Penggunaan Akun</div>
            <div style="font-size: 28px; font-weight: 700; color: #dc2626; line-height: 1; margin-bottom: 10px;">${current}<span style="font-size: 16px; color: #9ca3af; font-weight: 500;"> / ${limit}</span></div>
            <div style="width: 100%; background: #e5e7eb; border-radius: 6px; height: 6px; overflow: hidden;">
              <div style="width: 100%; background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%); height: 100%;"></div>
            </div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 8px; font-weight: 500;">⚠️ Tidak ada reset otomatis</div>
          </div>

          <button onclick="window.open('https://app.soal-ai.web.id/subscription', '_blank'); this.parentElement.parentElement.remove();" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 11px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            width: 100%;
            margin-bottom: 8px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
          " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.35)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102, 126, 234, 0.25)'">
            🚀 Upgrade ke Premium
          </button>
          
          <button onclick="this.parentElement.parentElement.remove()" style="
            background: transparent;
            color: #9ca3af;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
          " onmouseover="this.style.color='#6b7280'" onmouseout="this.style.color='#9ca3af'">Tutup</button>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // No countdown timer - simple quota exceeded message
        // User needs to upgrade to continue (no automatic reset)
      },
      args: [message, waitSeconds, limitType, rateLimitInfo]
    });
  } catch (error) {
    Logger.error('Failed to inject rate limit overlay', error);
  }
}

// Inject authentication overlay for unauthenticated users
async function injectAuthenticationOverlay(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Remove any existing overlays
        const existingOverlay = document.getElementById('soal-ai-auth-overlay');
        if (existingOverlay) {
          existingOverlay.remove();
        }

        // Create authentication overlay
        const overlay = document.createElement('div');
        overlay.id = 'soal-ai-auth-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 999999;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 380px;
          width: 90%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          animation: soal-ai-modalSlideIn 0.3s ease;
        `;

        modal.innerHTML = `
          <div style="margin-bottom: 20px; text-align: center;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin-bottom: 12px;">
              <span style="font-size: 24px;">🔐</span>
            </div>
            <h2 style="color: #111827; margin: 0 0 4px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">
              Login SOAL-AI
            </h2>
            <p style="color: #6b7280; margin: 0; font-size: 13px; line-height: 1.4;">
              Masuk untuk menggunakan fitur AI
            </p>
          </div>

          <!-- Email & Password Login Form -->
          <form id="soal-ai-login-form" style="width: 100%;">
            <!-- Email Input -->
            <div style="margin-bottom: 12px; position: relative;">
              <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 16px; color: #9ca3af; pointer-events: none;">
                📧
              </div>
              <input type="email" id="soal-ai-email" placeholder="Email" required autocomplete="email" style="
                width: 100%;
                padding: 11px 14px 11px 40px;
                border: 1.5px solid #e5e7eb;
                border-radius: 8px;
                font-size: 14px;
                box-sizing: border-box;
                transition: all 0.2s ease;
                background: #fafafa;
                color: #111827;
                outline: none;
              ">
            </div>

            <!-- Password Input -->
            <div style="margin-bottom: 14px; position: relative;">
              <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 16px; color: #9ca3af; pointer-events: none;">
                🔐
              </div>
              <input type="password" id="soal-ai-password" placeholder="Password" required autocomplete="current-password" style="
                width: 100%;
                padding: 11px 42px 11px 40px;
                border: 1.5px solid #e5e7eb;
                border-radius: 8px;
                font-size: 14px;
                box-sizing: border-box;
                transition: all 0.2s ease;
                background: #fafafa;
                color: #111827;
                outline: none;
              ">
              <button type="button" id="soal-ai-toggle-password" style="
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                cursor: pointer;
                font-size: 16px;
                padding: 6px;
                color: #9ca3af;
                line-height: 1;
              ">👁️</button>
            </div>

            <!-- Error message -->
            <div id="soal-ai-login-error" style="
              display: none;
              background: #fef2f2;
              color: #dc2626;
              padding: 10px 12px;
              border-radius: 6px;
              margin-bottom: 12px;
              font-size: 12px;
              text-align: left;
              border-left: 2px solid #ef4444;
            "></div>

            <!-- Login button -->
            <button type="submit" id="soal-ai-login-btn" style="
              width: 100%;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              padding: 11px 20px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              margin-bottom: 14px;
              box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
            ">
              <span id="soal-ai-login-text">Masuk</span>
              <span id="soal-ai-login-loader" style="display: none;">⏳ Masuk...</span>
            </button>

            <!-- Divider -->
            <div style="display: flex; align-items: center; margin: 12px 0; gap: 8px;">
              <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
              <span style="color: #9ca3af; font-size: 11px; font-weight: 500;">atau</span>
              <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
            </div>

            <!-- Google Login Button -->
            <button type="button" id="soal-ai-google-btn" style="
              width: 100%;
              background: white;
              color: #374151;
              border: 1.5px solid #e5e7eb;
              padding: 10px 16px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              margin-bottom: 12px;
            ">
              <svg width="16" height="16" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              <span>Login dengan Google</span>
            </button>

            <!-- Sign up link -->
            <p style="text-align: center; margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4;">
              Belum punya akun? 
              <a href="https://app.soal-ai.web.id/auth/signup" target="_blank" style="
                color: #667eea;
                font-weight: 600;
                text-decoration: none;
                transition: color 0.2s ease;
              ">Daftar</a>
            </p>
          </form>

          <!-- Close button -->
          <div style="text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
            <button id="soal-ai-close-btn" style="
              background: transparent;
              color: #9ca3af;
              border: none;
              padding: 6px 16px;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
            ">
              ✕ Tutup
            </button>
          </div>
        `;

        // Add CSS animations
        if (!document.getElementById('soal-ai-auth-styles')) {
          const style = document.createElement('style');
          style.id = 'soal-ai-auth-styles';
          style.textContent = `
            @keyframes soal-ai-modalSlideIn {
              from {
                opacity: 0;
                transform: translateY(-50px) scale(0.9);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            @keyframes soal-ai-modalSlideOut {
              from {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
              to {
                opacity: 0;
                transform: translateY(-50px) scale(0.9);
              }
            }

            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }

            @keyframes slideOutRight {
              from { transform: translateX(0); opacity: 1; }
              to { transform: translateX(100%); opacity: 0; }
            }
          `;
          document.head.appendChild(style);
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Add event listeners
        const loginForm = modal.querySelector('#soal-ai-login-form');
        const googleBtn = modal.querySelector('#soal-ai-google-btn');
        
        const emailInput = modal.querySelector('#soal-ai-email');
        const passwordInput = modal.querySelector('#soal-ai-password');
        const togglePasswordBtn = modal.querySelector('#soal-ai-toggle-password');
        const loginBtn = modal.querySelector('#soal-ai-login-btn');
        const loginText = modal.querySelector('#soal-ai-login-text');
        const loginLoader = modal.querySelector('#soal-ai-login-loader');
        const errorDiv = modal.querySelector('#soal-ai-login-error');

        // Toggle password visibility
        togglePasswordBtn.addEventListener('click', () => {
          const type = passwordInput.type === 'password' ? 'text' : 'password';
          passwordInput.type = type;
          togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
        });

        // Input focus effects
        emailInput.addEventListener('focus', () => {
          emailInput.style.borderColor = '#667eea';
          emailInput.style.background = 'white';
        });
        emailInput.addEventListener('blur', () => {
          emailInput.style.borderColor = '#e5e7eb';
          emailInput.style.background = '#f9fafb';
        });
        passwordInput.addEventListener('focus', () => {
          passwordInput.style.borderColor = '#667eea';
          passwordInput.style.background = 'white';
        });
        passwordInput.addEventListener('blur', () => {
          passwordInput.style.borderColor = '#e5e7eb';
          passwordInput.style.background = '#f9fafb';
        });

        // Handle login form submission
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const email = emailInput.value.trim();
          const password = passwordInput.value.trim();
          
          if (!email) {
            showError('Mohon isi email');
            return;
          }

          if (!password || password.length < 6) {
            showError('Password minimal 6 karakter');
            return;
          }

          // Show loading state
          setLoginLoading(true);
          hideError();

          try {
            // Login with email/password
            const response = await chrome.runtime.sendMessage({
              action: 'login_email_password',
              email: email,
              password: password
            });

            if (response.success) {
              // Login successful - close overlay and show success
              showSuccessAndClose();
            } else {
              showError(response.error || 'Login gagal. Silakan periksa email dan password Anda.');
            }
          } catch (error) {
            showError('Terjadi kesalahan. Silakan coba lagi.');
            console.error('Login error:', error);
          } finally {
            setLoginLoading(false);
          }
        });

        // Handle Google login
        googleBtn.addEventListener('click', async () => {
          try {
            const response = await chrome.runtime.sendMessage({
              action: 'login_google'
            });

            if (response.success) {
              showSuccessAndClose();
            } else {
              showError(response.error || 'Google login gagal. Silakan coba lagi.');
            }
          } catch (error) {
            showError('Terjadi kesalahan. Silakan coba lagi.');
            console.error('Google login error:', error);
          }
        });

        // Helper functions
        function setLoginLoading(loading) {
          if (loading) {
            loginText.style.display = 'none';
            loginLoader.style.display = 'inline';
            loginBtn.disabled = true;
            emailInput.disabled = true;
            passwordInput.disabled = true;
            togglePasswordBtn.disabled = true;
            googleBtn.disabled = true;
          } else {
            loginText.style.display = 'inline';
            loginLoader.style.display = 'none';
            loginBtn.disabled = false;
            emailInput.disabled = false;
            passwordInput.disabled = false;
            togglePasswordBtn.disabled = false;
            googleBtn.disabled = false;
          }
        }

        function showError(message) {
          errorDiv.textContent = message;
          errorDiv.style.display = 'block';
        }

        function hideError() {
          errorDiv.style.display = 'none';
        }

        function showSuccessAndClose() {
          overlay.style.animation = 'soal-ai-modalSlideOut 0.3s ease';
          setTimeout(() => {
            overlay.remove();

            // Show success notification
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
              color: white;
              padding: 16px 24px;
              border-radius: 8px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              font-weight: 600;
              z-index: 999999;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              animation: slideInRight 0.3s ease;
            `;

            notification.innerHTML = '✅ Login berhasil! Extension siap digunakan.';
            document.body.appendChild(notification);

            // Auto remove after 3 seconds
            setTimeout(() => {
              notification.style.animation = 'slideOutRight 0.3s ease';
              setTimeout(() => notification.remove(), 300);
            }, 3000);
          }, 300);
        }

        // Close button handler
        const closeBtn = modal.querySelector('#soal-ai-close-btn');
        closeBtn.addEventListener('click', () => {
          overlay.style.animation = 'soal-ai-modalSlideOut 0.3s ease';
          setTimeout(() => overlay.remove(), 300);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            overlay.style.animation = 'soal-ai-modalSlideOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
          }
        });

        // Close on ESC key
        const handleEscape = (e) => {
          if (e.key === 'Escape') {
            overlay.style.animation = 'soal-ai-modalSlideOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
            document.removeEventListener('keydown', handleEscape);
          }
        };
        document.addEventListener('keydown', handleEscape);
      }
    });

    Logger.info('Authentication overlay injected successfully');
  } catch (error) {
    Logger.error('Failed to inject authentication overlay', error);
    // Fallback to notification
    await showNotification(
      '🔐 Login Required',
      'Silakan buka extension popup untuk login ke akun SOAL-AI.',
      'error'
    );
  }
}

// Message handler dari popup/content script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'login_email_password':
          try {
            const loginResult = await loginWithEmailPassword(request.email, request.password);
            sendResponse(loginResult);
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'send_magic_link':
          try {
            const magicLinkResult = await sendMagicLink(request.email);
            sendResponse(magicLinkResult);
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'verify_otp':
          try {
            const otpResult = await verifyOTP(request.email, request.token);
            sendResponse(otpResult);
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'login_google':
          try {
            const googleResult = await loginWithGoogle();
            sendResponse(googleResult);
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'login':
          // Legacy support - redirect to email/password
          try {
            const loginResult = await loginWithEmailPassword(request.email, request.password || '');
            sendResponse(loginResult);
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'validate_license':
          const isValid = await validateAuthToken();
          sendResponse({ success: isValid });
          break;

        case 'get_storage':
          const storage = await chrome.storage.local.get(null);
          sendResponse(storage);
          break;

        case 'ping':
          sendResponse({ success: true, message: 'Extension is alive' });
          break;

        case 'check_quota':
          const creditCheck = await checkCreditValidation();
          sendResponse(creditCheck);
          break;

        case 'process_question':
          // Rate limiting and credit validation now handled server-side
          // Remove client-side validation to prevent duplicate overlay

          // Send raw question to backend - prompt will be added by edge function
          const litellmResult = await processAIRequest(request.question, 'TEXT');

          if (litellmResult.success) {
            // Rate limiting now handled server-side - no client-side tracking needed
            // Parse JSON response
            const parsedResult = parseGeminiResponse(litellmResult.answer);
            sendResponse(parsedResult);
          } else {
            // Handle quota exceeded error
            if (litellmResult.action === 'quota_exceeded') {
              // Get current tab to show overlay
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tab) {
                const quotaInfo = litellmResult.quota_info;
                Logger.info('Quota exceeded - showing upgrade overlay:', quotaInfo);

                await injectRateLimitOverlay(tab.id,
                  litellmResult.error,
                  0,
                  'quota',
                  quotaInfo
                );
              }

              sendResponse({
                success: false,
                error: litellmResult.error,
                action: litellmResult.action,
                quota_info: litellmResult.quota_info
              });
            } else {
              sendResponse(litellmResult);
            }
          }
          break;

        case 'capture_screenshot':
          try {
            // Capture visible tab untuk scan area
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
              format: 'png',
              quality: 100
            });
            sendResponse({ success: true, dataUrl: dataUrl });
          } catch (error) {
            Logger.error('Screenshot capture failed:', error);
            sendResponse({
              success: false,
              error: `Screenshot capture failed: ${error.message}`
            });
          }
          break;

        case 'activate_area_selector':
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.id) {
              sendResponse({ success: false, error: 'No active tab found' });
              break;
            }

            // Check if tab is on restricted page
            if (tab.url && (
              tab.url.startsWith('chrome://') || 
              tab.url.startsWith('chrome-extension://') || 
              tab.url.startsWith('edge://') ||
              tab.url.startsWith('about:')
            )) {
              sendResponse({ 
                success: false, 
                error: 'Scan area tidak dapat digunakan pada halaman sistem browser' 
              });
              break;
            }

            // Try to check if content script is already loaded
            let isContentScriptLoaded = false;
            try {
              await chrome.tabs.sendMessage(tab.id, { action: 'ping_content_script' });
              isContentScriptLoaded = true;
            } catch (pingError) {
              Logger.info('Content script not loaded, will inject now');
            }

            // If content script not loaded, inject it
            if (!isContentScriptLoaded) {
              try {
                // Inject CSS first
                await chrome.scripting.insertCSS({
                  target: { tabId: tab.id },
                  files: ['scan-area-styles.css', 'floating-windows.css']
                });

                // Then inject JS files
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content-area-selector.js']
                });

                Logger.info('Content scripts injected successfully');
                
                // Wait a bit for initialization
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (injectError) {
                Logger.error('Failed to inject content scripts:', injectError);
                sendResponse({ 
                  success: false, 
                  error: 'Gagal memuat scan area tool. Coba refresh halaman.' 
                });
                break;
              }
            }

            // Now send the activate message
            const response = await chrome.tabs.sendMessage(tab.id, { 
              action: 'activate_area_selector' 
            });
            sendResponse(response);
          } catch (error) {
            Logger.error('Activate area selector failed:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Gagal mengaktifkan scan area' 
            });
          }
          break;

        case 'show_scan_loading':
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await injectLoadingOverlay(tab.id, request.extractedText, 'scan');
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'scan_area_process':
          await processScanArea(request, sendResponse);
          break;
          
        case 'get_license_info':
          // Force refresh auth info from backend
          await validateAuthToken();
          const info = await chrome.storage.local.get([
            'supabase_access_token', 'user_data', 'plan_type', 'expires_at',
            'subscription_status', 'license_valid'
          ]);
          sendResponse(info);
          break;

        case 'test_context_menu':
          try {
            // Test context menu creation
            await createContextMenus();
            sendResponse({ success: true, message: 'Context menus recreated' });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'open_upgrade_popup':
          try {
            // Open extension popup for upgrade
            chrome.action.openPopup();
            sendResponse({ success: true });
          } catch (error) {
            // Fallback: open extension options page or show notification
            console.log('Cannot open popup, user needs to click extension icon');
            await showNotification('💳 Upgrade Premium', 'Klik icon extension untuk upgrade ke Premium!', 'info');
            sendResponse({ success: false, error: 'Please click extension icon to upgrade' });
          }
          break;

        // Offline mode dihapus - sistem sepenuhnya berbayar

        case 'samar_mode_changed':
          try {
            samarModeEnabled = request.enabled;
            Logger.info(`🔍 Samar Mode state updated: ${samarModeEnabled}`);
            console.log('🔍 Background: Samar Mode changed to:', samarModeEnabled);
            sendResponse({ success: true });
          } catch (error) {
            Logger.error('Error updating Samar Mode state', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Async response
});

/**
 * Crop image to specific coordinates using OffscreenCanvas
 * @param {string} dataUrl - Full screenshot as base64 data URL
 * @param {object} coordinates - {x, y, width, height, devicePixelRatio}
 * @returns {Promise<string>} Cropped image as base64 data URL
 */
async function cropImageToCoordinates(dataUrl, coordinates) {
  try {
    Logger.info('🔪 Cropping image', coordinates);
    
    const { x, y, width, height, devicePixelRatio = 1 } = coordinates;
    
    // Adjust coordinates for device pixel ratio (retina displays)
    const scaledX = x * devicePixelRatio;
    const scaledY = y * devicePixelRatio;
    const scaledWidth = width * devicePixelRatio;
    const scaledHeight = height * devicePixelRatio;
    
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    // Create ImageBitmap from blob
    const imageBitmap = await createImageBitmap(blob);
    
    // Create OffscreenCanvas for cropping
    const canvas = new OffscreenCanvas(scaledWidth, scaledHeight);
    const ctx = canvas.getContext('2d');
    
    // Draw cropped portion
    ctx.drawImage(
      imageBitmap,
      scaledX, scaledY, scaledWidth, scaledHeight,  // Source rectangle
      0, 0, scaledWidth, scaledHeight                // Destination rectangle
    );
    
    // Convert to blob and then to data URL
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png', quality: 1.0 });
    
    // Convert blob to base64 data URL
    const reader = new FileReader();
    const croppedDataUrl = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(croppedBlob);
    });
    
    Logger.info('✂️ Image cropped successfully', {
      originalSize: `${imageBitmap.width}x${imageBitmap.height}`,
      croppedSize: `${scaledWidth}x${scaledHeight}`,
      reduction: `${Math.round((1 - (scaledWidth * scaledHeight) / (imageBitmap.width * imageBitmap.height)) * 100)}%`
    });
    
    return croppedDataUrl;
  } catch (error) {
    Logger.error('Failed to crop image:', error);
    throw new Error(`Image cropping failed: ${error.message}`);
  }
}

// Process scan area request - Send image directly to backend
async function processScanArea(request, sendResponse) {
  try {
    Logger.info('🎯 Processing scan area request', request.coordinates);

    // 1. CHECK AUTHENTICATION FIRST
    const isAuthenticated = await isUserAuthenticated();
    if (!isAuthenticated) {
      Logger.warn('User not authenticated for scan area');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await injectAuthenticationOverlay(tab.id);
      }
      sendResponse({ success: false, error: 'Authentication required', action: 'auth_required' });
      return;
    }

    // Rate limiting and credit validation now handled server-side

    // 2. Capture full screenshot
    const fullScreenshot = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });

    Logger.info('📸 Full screenshot captured, cropping to selection...');

    // 3. Crop image to selected coordinates (client-side to save bandwidth & storage)
    const croppedDataUrl = await cropImageToCoordinates(fullScreenshot, request.coordinates);

    Logger.info('✂️ Image cropped, sending to backend...');

    // 4. Get current tab for loading overlay
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 5. Show loading overlay
    await injectLoadingOverlay(tab.id, 'Processing screenshot...', 'scan');

    Logger.info('🎯 Sending cropped image to backend edge function');

    // 6. Send CROPPED image to backend (no coordinates needed - already cropped!)
    const backendResult = await backendAPI.processScanArea(
      croppedDataUrl,
      null, // No coordinates needed - image is already cropped
      null  // No pre-extracted text needed
    );

    Logger.info('🎯 Backend result:', backendResult);

    if (backendResult.success) {
      Logger.info('🎯 Backend processing successful');

      // Parse response for display
      const responseData = {
        success: true,
        answer: backendResult.answer,
        formatted_answer: backendResult.formatted_answer,
        scanAreaData: {
          originalImage: backendResult.scan_area_data?.image_url || croppedDataUrl, // Use cropped image
          extractedText: backendResult.scan_area_data?.extracted_text || 'Screenshot question',
          coordinates: request.coordinates
        },
        confidence: backendResult.confidence,
        processing_time: backendResult.processing_time,
        model_used: backendResult.model_used,
        user_type: backendResult.user_type,
        rate_limit_info: backendResult.rate_limit_info
      };

      // Show floating window with result
      await injectFloatingOverlay(
        tab.id,
        backendResult.scan_area_data?.extracted_text || 'Screenshot question',
        responseData,
        'scan'
      );

      Logger.info('🎯 Sending final response:', responseData);
      sendResponse(responseData);

    } else {
      // Handle quota exceeded or errors
      if (backendResult.action === 'quota_exceeded') {
        Logger.warn('🎯 Quota exceeded:', backendResult.quota_info);

        // Remove loading overlay first
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const loadingWindow = document.querySelector('#soal-ai-floating-main');
            if (loadingWindow) {
              loadingWindow.remove();
            }
          }
        });

        const quotaInfo = backendResult.quota_info;
        Logger.info('Showing quota exceeded overlay:', quotaInfo);

        await injectRateLimitOverlay(
          tab.id,
          backendResult.error,
          0,
          'quota',
          quotaInfo
        );

        sendResponse({
          success: false,
          error: backendResult.error,
          action: backendResult.action,
          quota_info: backendResult.quota_info
        });
      } else {
        Logger.error('🎯 Backend processing failed:', backendResult);

        // Remove loading overlay and show error
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const loadingWindow = document.querySelector('#soal-ai-floating-main');
            if (loadingWindow) {
              loadingWindow.remove();
            }
          }
        });

        await showNotification('SOAL-AI Error', backendResult.error || 'Processing failed');
        sendResponse(backendResult);
      }
    }

  } catch (error) {
    Logger.error('🎯 Scan area processing failed:', error);
    sendResponse({
      success: false,
      error: error.message || 'Scan area processing failed'
    });
  }
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    Logger.info('Context menu clicked', { menuItemId: info.menuItemId });

    // Handle main context menu (text selection only)
    if (info.menuItemId !== 'soal-ai-main') {
      Logger.warn('Unknown menu item clicked:', info.menuItemId);
      return;
    }

    const selectedText = info.selectionText?.trim();

    if (!selectedText) {
      Logger.warn('No text selected for context menu');
      return;
    }

    Logger.info('Text selection processed', { textLength: selectedText.length });

    // 1. CHECK AUTHENTICATION FIRST
    const isAuthenticated = await isUserAuthenticated();
    if (!isAuthenticated) {
      Logger.warn('User not authenticated - showing auth overlay');
      await injectAuthenticationOverlay(tab.id);
      return;
    }

    // Rate limiting and credit validation now handled server-side
    // Remove client-side validation to prevent duplicate overlay

    // Send raw question to backend - prompt will be added by edge function
    // This ensures DB stores the original question, not the prompted version

    // Show loading overlay first
    await injectLoadingOverlay(tab.id, selectedText);

    // Process with backend AI API (TEXT type for context menu)
    // Send selectedText directly, edge function will add prompt
    const litellmResult = await processAIRequest(selectedText, 'TEXT');

    if (litellmResult.success) {
      // Rate limiting now handled server-side - no client-side tracking needed

      // Parse response
      const parsedResult = parseGeminiResponse(litellmResult.answer);

      // Replace loading with result overlay
      await injectFloatingOverlay(tab.id, selectedText, parsedResult, 'text');

      await showNotification('SOAL-AI Success', 'Jawaban berhasil diproses!', 'success');
    } else {
      // Handle quota exceeded
      if (litellmResult.action === 'quota_exceeded') {
        Logger.warn('Quota exceeded', litellmResult.quota_info);

        // Remove loading overlay first
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const loadingWindow = document.querySelector('#soal-ai-floating-main');
            if (loadingWindow) {
              loadingWindow.remove();
            }
          }
        });

        const quotaInfo = litellmResult.quota_info;
        Logger.info('Showing quota exceeded overlay:', quotaInfo);

        await injectRateLimitOverlay(tab.id,
          litellmResult.error,
          0,
          'quota',
          quotaInfo
        );
      } else {
        // Show error (loading window will remain and show error state)
        await showNotification('SOAL-AI Error', litellmResult.error, 'error');
      }
    }

  } catch (error) {
    Logger.error('Context menu processing error', error);
    await showNotification('SOAL-AI Error', 'Terjadi kesalahan: ' + error.message, 'error');
  }
});

// Handle context menu keyboard shortcut
async function handleContextMenuShortcut(tab) {
  try {
    console.log('🎯 Context menu shortcut activated');

    // Check if tab is valid
    if (!tab || !tab.id) {
      await showNotification('SOAL-AI Error', 'Tidak ada tab aktif yang valid', 'error');
      return;
    }

    // Check if tab URL is supported
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://'))) {
      await showNotification('SOAL-AI Error', 'Shortcut tidak dapat digunakan di halaman browser internal', 'error');
      return;
    }

    // 1. CHECK AUTHENTICATION FIRST
    const isAuthenticated = await isUserAuthenticated();
    if (!isAuthenticated) {
      Logger.warn('User not authenticated - showing auth overlay');
      await injectAuthenticationOverlay(tab.id);
      return;
    }

    // Get selected text from the page with timeout
    try {
      const results = await Promise.race([
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const selection = window.getSelection();
            return selection.toString().trim();
          }
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);

      const selectedText = results[0]?.result;

      if (!selectedText) {
        await showNotification('SOAL-AI Info', 'Pilih teks terlebih dahulu, lalu tekan Ctrl+Shift+S', 'info');
        return;
      }

      // Process the selected text (same as context menu click)
      await processSelectedText(selectedText, tab);

    } catch (scriptError) {
      console.error('❌ Failed to execute script:', scriptError);

      if (scriptError.message === 'Timeout') {
        await showNotification('SOAL-AI Error', 'Halaman tidak merespons. Coba refresh halaman.', 'error');
      } else if (scriptError.message.includes('Cannot access')) {
        await showNotification('SOAL-AI Error', 'Tidak dapat mengakses halaman ini', 'error');
      } else {
        await showNotification('SOAL-AI Error', 'Gagal mengambil teks: ' + scriptError.message, 'error');
      }
    }

  } catch (error) {
    console.error('❌ Context menu shortcut error:', error);
    await showNotification('SOAL-AI Error', 'Gagal memproses shortcut: ' + error.message, 'error');
  }
}

// Handle scan area keyboard shortcut
async function handleScanAreaShortcut(tab) {
  try {
    console.log('🎯 Scan area shortcut activated');

    // Check if tab is valid
    if (!tab || !tab.id) {
      await showNotification('SOAL-AI Error', 'Tidak ada tab aktif yang valid', 'error');
      return;
    }

    // Check if tab URL is supported
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://'))) {
      await showNotification('SOAL-AI Error', 'Scan area tidak dapat digunakan di halaman browser internal', 'error');
      return;
    }

    // 1. CHECK AUTHENTICATION FIRST
    const isAuthenticated = await isUserAuthenticated();
    if (!isAuthenticated) {
      Logger.warn('User not authenticated - showing auth overlay');
      await injectAuthenticationOverlay(tab.id);
      return;
    }

    // Rate limiting and credit validation now handled server-side
    // Remove client-side validation to prevent duplicate overlay

    // Activate area selector with timeout
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, {
          action: 'activate_area_selector'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);

      if (response && response.success) {
        await showNotification('SOAL-AI Info', 'Pilih area untuk di-scan dengan mouse', 'info');
      } else {
        await showNotification('SOAL-AI Error', 'Gagal mengaktifkan scan area tool', 'error');
      }
    } catch (messageError) {
      console.error('❌ Failed to send message to content script:', messageError);

      if (messageError.message === 'Timeout') {
        await showNotification('SOAL-AI Error', 'Content script tidak merespons. Coba refresh halaman.', 'error');
      } else if (messageError.message.includes('Could not establish connection')) {
        await showNotification('SOAL-AI Error', 'Content script belum siap. Coba refresh halaman.', 'error');
      } else {
        await showNotification('SOAL-AI Error', 'Gagal berkomunikasi dengan halaman: ' + messageError.message, 'error');
      }
    }

  } catch (error) {
    console.error('❌ Scan area shortcut error:', error);
    await showNotification('SOAL-AI Error', 'Gagal mengaktifkan scan area: ' + error.message, 'error');
  }
}

// Process selected text (extracted from context menu handler for reuse)
async function processSelectedText(selectedText, tab) {
  try {
    Logger.info('Processing selected text via shortcut', { textLength: selectedText.length });

    // 1. CHECK AUTHENTICATION FIRST
    const isAuthenticated = await isUserAuthenticated();
    if (!isAuthenticated) {
      Logger.warn('User not authenticated - showing auth overlay');
      await injectAuthenticationOverlay(tab.id);
      return;
    }

    // Rate limiting and credit validation now handled server-side
    // Remove client-side validation to prevent duplicate overlay

    // Send raw question to backend - prompt will be added by edge function

    // Show loading overlay first
    await injectLoadingOverlay(tab.id, selectedText);

    // Process with backend AI API (TEXT type for keyboard shortcut)
    // Send selectedText directly, edge function will add prompt
    const litellmResult = await processAIRequest(selectedText, 'TEXT');

    if (litellmResult.success) {
      // Rate limiting now handled server-side - no client-side tracking needed

      // Parse response
      const parsedResult = parseGeminiResponse(litellmResult.answer);

      // Replace loading with result overlay
      await injectFloatingOverlay(tab.id, selectedText, parsedResult, 'text');

      await showNotification('SOAL-AI Success', 'Jawaban berhasil diproses!', 'success');
    } else {
      // Handle quota exceeded
      if (litellmResult.action === 'quota_exceeded') {
        Logger.warn('Quota exceeded', litellmResult.quota_info);

        // Remove loading overlay first
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const loadingWindow = document.querySelector('#soal-ai-floating-main');
            if (loadingWindow) {
              loadingWindow.remove();
            }
          }
        });

        const quotaInfo = litellmResult.quota_info;
        Logger.info('Showing quota exceeded overlay:', quotaInfo);

        await injectRateLimitOverlay(tab.id,
          litellmResult.error,
          0,
          'quota',
          quotaInfo
        );
      } else {
        await showNotification('SOAL-AI Error', litellmResult.error, 'error');
      }
    }

  } catch (error) {
    Logger.error('Process selected text error', error);
    await showNotification('SOAL-AI Error', 'Terjadi kesalahan: ' + error.message, 'error');
  }
}


