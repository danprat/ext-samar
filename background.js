/**
 * Background Service Worker untuk SOAL-AI v2
 * REFACTORED: Uses modular architecture with services
 * 
 * Handles: License validation, daily sync, quota management, scan area processing
 */

console.log('🚀 [DEBUG] Service Worker starting...');

// =====================================================
// MODULE IMPORTS - Load dependencies in order
// =====================================================
console.log('📦 [DEBUG] Loading modules...');

try {
  importScripts('config.js');
  importScripts('logger.js');
  importScripts('constants.js');
  importScripts('error-handler.js');
  importScripts('api-client.js');
  importScripts('services/cache-service.js');
  importScripts('services/samar-mode-service.js');
  importScripts('services/notification-service.js');
  importScripts('services/auth-service.js');
  importScripts('services/ai-service.js');
  importScripts('services/ui-service.js');
  console.log('🎉 [DEBUG] All modules loaded successfully!');
} catch (error) {
  console.error('❌ [DEBUG] importScripts failed:', error);
}

// =====================================================
// LOGGER SETUP
// =====================================================
const logger = typeof backgroundLogger !== 'undefined' ? backgroundLogger : {
  info: (message, data = null) => console.log(`[INFO] ${message}`, data || ''),
  warn: (message, data = null) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message, error = null) => console.error(`[ERROR] ${message}`, error || ''),
  debug: (message, data = null) => console.log(`[DEBUG] ${message}`, data || '')
};

// =====================================================
// CHROME ALARMS FOR PERIODIC TOKEN REFRESH
// =====================================================
function setupTokenRefreshAlarm() {
  chrome.alarms.create('token-refresh', {
    delayInMinutes: 30,
    periodInMinutes: 360 // Every 6 hours
  });
  logger.info('⏰ Token refresh alarm created (every 6 hours)');
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'token-refresh') {
    logger.info('⏰ Periodic token refresh triggered');
    
    try {
      const storage = await chrome.storage.local.get(['supabase_refresh_token', 'supabase_access_token']);
      
      if (storage.supabase_refresh_token && storage.supabase_access_token) {
        const result = await authService.refreshAuthToken();
        if (!result.success) {
          logger.warn('⏰ Periodic token refresh failed, notifying user');
          await notificationService.notifyLoginRequired();
        } else {
          logger.info('⏰ Periodic token refresh successful');
          await notificationService.clearLoginNotification();
        }
      } else {
        logger.info('⏰ No tokens to refresh');
      }
    } catch (error) {
      logger.error('⏰ Periodic token refresh error:', error.message);
    }
  }
});

// =====================================================
// NOTIFICATION BUTTON CLICK HANDLER
// =====================================================
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'soal-ai-login-required' && buttonIndex === 0) {
    chrome.action.openPopup().catch(() => {
      logger.warn('Cannot open popup, user should click extension icon');
    });
  }
});

// =====================================================
// EXTENSION LIFECYCLE EVENTS
// =====================================================
chrome.runtime.onInstalled.addListener((details) => {
  console.log('SOAL-AI v2 installed/reloaded');

  createContextMenus().catch(error => {
    console.error('Failed to create context menus:', error);
  });

  samarModeService.initialize().catch(error => {
    console.error('Failed to initialize Samar Mode state:', error);
  });

  setupTokenRefreshAlarm();

  if (details.reason === 'install') {
    initializeSystem().catch(error => {
      console.error('Failed to initialize system:', error);
    });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('SOAL-AI v2 startup - initializing...');
  
  try {
    await chrome.storage.local.set({ auth_validating: true });
    
    await createContextMenus();
    console.log('✅ Context menus created');
    
    await samarModeService.initialize();
    console.log('✅ Samar Mode state initialized');
    
    setupTokenRefreshAlarm();

    // Validate auth token
    const storage = await chrome.storage.local.get(['supabase_access_token', 'supabase_refresh_token']);
    
    if (storage.supabase_access_token) {
      const validateWithTimeout = async () => {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Validation timeout')), 8000) // Reduced from 15s to 8s
        );
        return Promise.race([authService.validateAuthToken(), timeoutPromise]);
      };
      
      let isValid = false;
      try {
        isValid = await validateWithTimeout();
      } catch (timeoutError) {
        console.warn('⚠️ Token validation timeout, will retry with refresh');
      }
      
      if (!isValid && storage.supabase_refresh_token) {
        console.log('🔄 Token invalid, attempting refresh...');
        const refreshResult = await authService.refreshAuthToken();
        
        if (refreshResult.success) {
          console.log('✅ Token refreshed successfully');
          await authService.validateAuthToken();
          await notificationService.clearLoginNotification();
        } else {
          console.log('❌ Token refresh failed, clearing tokens and requiring login');
          await authService.clearAuthTokens();
          await notificationService.notifyLoginRequired();
        }
      } else if (!isValid) {
        console.log('❌ No valid auth, clearing tokens');
        await authService.clearAuthTokens();
        await notificationService.notifyLoginRequired();
      } else {
        console.log('✅ Auth token valid');
        await notificationService.clearLoginNotification();
      }
    } else {
      console.log('ℹ️ No auth token found - user not logged in');
    }
  } catch (error) {
    console.error('Failed to validate/refresh auth token on startup:', error);
  } finally {
    await chrome.storage.local.set({ auth_validating: false });
  }

  console.log('SOAL-AI v2 startup complete');
});

// =====================================================
// KEYBOARD SHORTCUTS
// =====================================================
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      await notificationService.show('SOAL-AI Error', 'Tidak ada tab aktif', 'error');
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
        await notificationService.show('SOAL-AI Error', `Command tidak dikenal: ${command}`, 'error');
    }
  } catch (error) {
    console.error('❌ Keyboard shortcut error:', error);
    await notificationService.show('SOAL-AI Error', 'Shortcut gagal dijalankan: ' + error.message, 'error');
  }
});

// =====================================================
// CONTEXT MENUS
// =====================================================
async function createContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
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

// =====================================================
// SYSTEM INITIALIZATION
// =====================================================
async function initializeSystem() {
  try {
    await cleanupLegacyStorage();
  } catch (error) {
    console.error('Error initializing system:', error);
  }
}

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

// =====================================================
// SHORTCUT HANDLERS
// =====================================================
async function handleContextMenuShortcut(tab) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString()?.trim() || ''
    });
    
    const selectedText = result?.result;
    
    if (selectedText && selectedText.length > 0) {
      await processTextQuestion(tab.id, selectedText);
    } else {
      await notificationService.show('SOAL-AI', 'Pilih teks terlebih dahulu, lalu tekan shortcut', 'info');
    }
  } catch (error) {
    logger.error('Context menu shortcut error:', error);
    await notificationService.show('SOAL-AI Error', error.message, 'error');
  }
}

async function handleScanAreaShortcut(tab) {
  try {
    await activateAreaSelector(tab.id);
  } catch (error) {
    logger.error('Scan area shortcut error:', error);
    await notificationService.show('SOAL-AI Error', error.message, 'error');
  }
}

// =====================================================
// AREA SELECTOR
// =====================================================
async function activateAreaSelector(tabId) {
  try {
    // Inject CSS first
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['scan-area-styles.css']
    });

    // Check if content script is loaded
    let contentScriptReady = false;
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => !!window.soalAIAreaSelector
      });
      contentScriptReady = result?.result === true;
    } catch (e) {
      contentScriptReady = false;
    }

    // Inject content script if not loaded
    if (!contentScriptReady) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-area-selector.js']
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Send activation message
    const response = await chrome.tabs.sendMessage(tabId, { action: 'activate_area_selector' });
    
    if (response?.success) {
      logger.info('Area selector activated successfully');
      return { success: true };
    } else {
      throw new Error('Failed to activate area selector');
    }
  } catch (error) {
    logger.error('Failed to activate area selector:', error);
    throw error;
  }
}

// =====================================================
// TEXT QUESTION PROCESSING
// =====================================================
async function processTextQuestion(tabId, question) {
  try {
    const samarEnabled = await samarModeService.getState();
    
    // Show loading overlay
    await uiService.injectLoadingOverlay(tabId, question, samarEnabled);

    // Validate credits
    const creditCheck = await aiService.checkCreditValidation();
    if (!creditCheck.allowed) {
      await uiService.injectErrorOverlay(tabId, creditCheck.reason, creditCheck.action, samarEnabled);
      return { success: false, error: creditCheck.reason, action: creditCheck.action };
    }

    // Process with AI
    const result = await aiService.processText(question, 'TEXT');

    if (result.success) {
      await uiService.injectFloatingOverlay(tabId, question, result, samarEnabled);
      return { success: true, answer: result.answer };
    } else {
      await uiService.injectErrorOverlay(tabId, result.error, result.action, samarEnabled);
      return { success: false, error: result.error, action: result.action };
    }
  } catch (error) {
    logger.error('Text question processing error:', error);
    const samarEnabled = await samarModeService.getState();
    await uiService.injectErrorOverlay(tabId, error.message, null, samarEnabled);
    return { success: false, error: error.message };
  }
}

// =====================================================
// SCAN AREA PROCESSING
// =====================================================
async function processScanArea(tabId, coordinates) {
  try {
    const samarEnabled = await samarModeService.getState();

    // Validate credits
    const creditCheck = await aiService.checkCreditValidation();
    if (!creditCheck.allowed) {
      await uiService.injectErrorOverlay(tabId, creditCheck.reason, creditCheck.action, samarEnabled);
      return { success: false, error: creditCheck.reason, action: creditCheck.action };
    }

    // Capture screenshot
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });

    // Crop image
    const croppedImage = await cropScreenshot(screenshotDataUrl, coordinates);

    // Process with AI
    const result = await aiService.processScanArea(croppedImage, null, null);

    if (result.success) {
      await uiService.injectFloatingOverlay(tabId, 'Scan Area', result, samarEnabled);
      return { success: true, answer: result.answer };
    } else {
      await uiService.injectErrorOverlay(tabId, result.error, result.action, samarEnabled);
      return { success: false, error: result.error, action: result.action };
    }
  } catch (error) {
    logger.error('Scan area processing error:', error);
    const samarEnabled = await samarModeService.getState();
    await uiService.injectErrorOverlay(tabId, error.message, null, samarEnabled);
    return { success: false, error: error.message };
  }
}

// =====================================================
// IMAGE CROPPING - Service Worker compatible (no Image constructor)
// =====================================================
async function cropScreenshot(dataUrl, coordinates) {
  try {
    // Convert data URL to blob using fetch (works in Service Worker)
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    // Create ImageBitmap (Service Worker compatible)
    const imageBitmap = await createImageBitmap(blob);
    
    // Calculate dimensions
    const dpr = coordinates.devicePixelRatio || 1;
    const cropWidth = Math.round(coordinates.width * dpr);
    const cropHeight = Math.round(coordinates.height * dpr);
    const cropX = Math.round(coordinates.x * dpr);
    const cropY = Math.round(coordinates.y * dpr);
    
    // Create OffscreenCanvas and draw cropped area
    const canvas = new OffscreenCanvas(cropWidth, cropHeight);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(
      imageBitmap,
      cropX, cropY, cropWidth, cropHeight,  // Source rect
      0, 0, cropWidth, cropHeight            // Dest rect
    );
    
    // Convert to blob then base64
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    
    // Use arrayBuffer instead of FileReader (more reliable in Service Worker)
    const arrayBuffer = await croppedBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binaryString);
    
    imageBitmap.close(); // Clean up
    
    return base64;
  } catch (error) {
    logger.error('cropScreenshot error:', error);
    throw error;
  }
}

// =====================================================
// MESSAGE HANDLER
// =====================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        // Auth actions - delegate to authService
        case 'login_email_password':
          const loginResult = await authService.loginWithEmailPassword(request.email, request.password);
          sendResponse(loginResult);
          break;

        case 'login_google':
          const googleResult = await authService.loginWithGoogle();
          sendResponse(googleResult);
          break;

        case 'send_magic_link':
          const magicResult = await authService.sendMagicLink(request.email);
          sendResponse(magicResult);
          break;

        case 'verify_otp':
          const otpResult = await authService.verifyOTP(request.email, request.token);
          sendResponse(otpResult);
          break;

        case 'validate_license':
          const isValid = await authService.validateAuthToken();
          sendResponse({ success: isValid });
          break;

        case 'refresh_token':
          const refreshResult = await authService.refreshAuthToken();
          sendResponse(refreshResult);
          break;

        case 'logout':
          await authService.clearAuthTokens();
          await cacheService.clear();
          sendResponse({ success: true });
          break;

        // AI processing actions
        case 'process_text':
          const tabId = sender.tab?.id;
          if (tabId) {
            const textResult = await processTextQuestion(tabId, request.question);
            sendResponse(textResult);
          } else {
            sendResponse({ success: false, error: 'No tab ID' });
          }
          break;

        case 'scan_area_process':
          const scanTabId = sender.tab?.id;
          if (scanTabId) {
            const scanResult = await processScanArea(scanTabId, request.coordinates);
            sendResponse(scanResult);
          } else {
            sendResponse({ success: false, error: 'No tab ID' });
          }
          break;

        case 'show_scan_loading':
          const loadingTabId = sender.tab?.id;
          if (loadingTabId) {
            const samarEnabled = await samarModeService.getState();
            await uiService.injectLoadingOverlay(loadingTabId, request.extractedText || '', samarEnabled);
            sendResponse({ success: true });
          }
          break;

        // Area selector
        case 'activate_area_selector':
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
              await activateAreaSelector(tab.id);
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'No active tab' });
            }
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        // Samar mode
        case 'samar_mode_changed':
          await samarModeService.setState(request.enabled);
          sendResponse({ success: true });
          break;

        case 'get_samar_mode':
          const samarState = await samarModeService.getState();
          sendResponse({ enabled: samarState });
          break;

        // Credit validation
        case 'check_credit':
          const creditResult = await aiService.checkCreditValidation();
          sendResponse(creditResult);
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      logger.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep channel open for async response
});

// =====================================================
// CONTEXT MENU CLICK HANDLER
// =====================================================
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'soal-ai-main' && info.selectionText) {
    await processTextQuestion(tab.id, info.selectionText.trim());
  }
});

console.log('🎉 Background service worker initialized');
