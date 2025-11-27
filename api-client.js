// Requires: config.js must be loaded first (provides CONFIG global)
// Requires: logger.js must be loaded first (provides apiLogger)

// Use centralized logger (with fallback if not yet loaded)
// Named apiClientLogger to avoid conflict with background.js logger
const apiClientLogger = typeof apiLogger !== 'undefined' ? apiLogger : {
  debug: (msg, data) => console.log(`[API-DEBUG] ${msg}`, data || ''),
  info: (msg, data) => console.log(`[API-INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[API-WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[API-ERROR] ${msg}`, data || '')
};

/**
 * API Client class untuk Supabase communication
 */
class BackendAPIClient {
  constructor() {
    // Use centralized config (with validation)
    if (typeof CONFIG === 'undefined' || !CONFIG.API) {
      console.error('CONFIG not loaded! Make sure config.js is loaded before api-client.js');
      // Fallback to hardcoded values to prevent crash
      this.functionsURL = 'https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1';
      this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWt3dHhwanFxd2pvdmVrZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDE5NjMsImV4cCI6MjA3NjI3Nzk2M30.Uq0ekLIjQ052wGixZI4qh1nzZoAkde7JuJSINAHXxTQ';
      this.timeout = 120000;
      this.timeoutWarning = 30000;
    } else {
      this.functionsURL = CONFIG.API.FUNCTIONS_URL;
      this.supabaseKey = CONFIG.API.SUPABASE_ANON_KEY;
      this.timeout = CONFIG.API.TIMEOUT;
      this.timeoutWarning = CONFIG.API.TIMEOUT_WARNING;
    }
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second base delay for exponential backoff
    
    // Callback for long-running requests (can be set by consumer)
    this.onLongRequest = null;
    this.onRequestProgress = null;
  }

  /**
   * Get Supabase session token dari storage
   */
  async getAuthToken() {
    const storage = await chrome.storage.local.get(['supabase_access_token']);
    return storage.supabase_access_token;
  }

  /**
   * Make authenticated request ke Supabase Functions
   * Enhanced with better timeout handling and progress callbacks
   */
  async makeRequest(endpoint, options = {}) {
    const authToken = await this.getAuthToken();
    
    if (!authToken) {
      throw new Error('AUTH_REQUIRED:No authentication token found. Please login.');
    }

    const url = `${this.functionsURL}${endpoint}`;
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': this.supabaseKey
      },
      ...options
    };

    apiClientLogger.debug('Making request', {
      url,
      method: defaultOptions.method,
      hasAuth: !!authToken,
      timeout: this.timeout
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    // Warning timer for long requests
    let warningTimerId = null;
    if (this.onLongRequest && this.timeoutWarning) {
      warningTimerId = setTimeout(() => {
        apiClientLogger.warn('Request taking longer than expected', { endpoint });
        this.onLongRequest(endpoint);
      }, this.timeoutWarning);
    }

    try {
      const response = await fetch(url, {
        ...defaultOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (warningTimerId) clearTimeout(warningTimerId);

      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        apiClientLogger.error('Server returned HTML instead of JSON', {
          status: response.status,
          contentType,
          htmlPreview: htmlText.substring(0, 200)
        });
        throw new Error(`SERVER_ERROR:Server error - Expected JSON but got HTML (Status: ${response.status})`);
      }

      const responseData = await response.json();

      if (!response.ok) {
        apiClientLogger.error('Request failed', {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });

        // Handle rate limiting specifically
        if (response.status === 429) {
          const rateLimitInfo = responseData.rate_limit_info || responseData.quota_info || {};
          throw new Error(`RATE_LIMIT:${JSON.stringify({
            reason: responseData.error || 'Rate limit exceeded',
            action: responseData.action || 'rate_limit',
            type: rateLimitInfo.type || 'quota',
            wait_seconds: rateLimitInfo.wait_seconds || 0,
            current_count: rateLimitInfo.current || rateLimitInfo.current_count || 0,
            limit: rateLimitInfo.limit || 0,
            reset_time: rateLimitInfo.reset_time || 0
          })}`);
        }

        // Handle authentication errors
        if (response.status === 401) {
          throw new Error('AUTH_EXPIRED:Session expired. Please login again.');
        }

        // Handle server errors
        if (response.status >= 500) {
          throw new Error(`SERVER_ERROR:Server error (${response.status}). Please try again later.`);
        }

        throw new Error(`HTTP_ERROR:HTTP ${response.status}: ${responseData.error || response.statusText}`);
      }

      apiClientLogger.info('Request successful', {
        endpoint,
        status: response.status
      });

      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);
      if (warningTimerId) clearTimeout(warningTimerId);

      if (error.name === 'AbortError') {
        apiClientLogger.error('Request timeout', { endpoint, timeout: this.timeout });
        throw new Error('TIMEOUT:Request timeout - server tidak merespons. Coba lagi atau periksa koneksi internet Anda.');
      }
      
      // Handle network errors
      if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        throw new Error('NETWORK_ERROR:Koneksi gagal. Periksa koneksi internet Anda.');
      }
      
      apiClientLogger.error('Request error', {
        endpoint,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const errorMsg = error.message || '';
    
    // Non-retryable errors (don't waste time retrying these)
    const nonRetryablePatterns = [
      'RATE_LIMIT:',
      'AUTH_REQUIRED:',
      'AUTH_EXPIRED:',
      '401',
      '403',
      '429'
    ];
    
    if (nonRetryablePatterns.some(pattern => errorMsg.includes(pattern))) {
      return false;
    }
    
    // Retryable errors
    const retryablePatterns = [
      'TIMEOUT:',
      'NETWORK_ERROR:',
      'SERVER_ERROR:',
      'Failed to fetch',
      'Network request failed',
      'net::ERR_',
      'HTTP 500',
      'HTTP 502',
      'HTTP 503',
      'HTTP 504',
      'Internal server error'
    ];
    
    return retryablePatterns.some(pattern => 
      errorMsg.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Extract error type from error message
   */
  getErrorType(error) {
    const errorMsg = error.message || '';
    
    if (errorMsg.startsWith('TIMEOUT:')) return 'timeout';
    if (errorMsg.startsWith('NETWORK_ERROR:')) return 'network';
    if (errorMsg.startsWith('AUTH_REQUIRED:') || errorMsg.startsWith('AUTH_EXPIRED:')) return 'auth';
    if (errorMsg.startsWith('SERVER_ERROR:')) return 'server';
    if (errorMsg.startsWith('RATE_LIMIT:')) return 'rate_limit';
    if (errorMsg.startsWith('HTTP_ERROR:')) return 'http';
    
    return 'unknown';
  }

  /**
   * Extract user-friendly message from error
   */
  getUserFriendlyMessage(error) {
    const errorMsg = error.message || 'Unknown error';
    
    // Extract message after the type prefix
    const colonIndex = errorMsg.indexOf(':');
    if (colonIndex > 0 && colonIndex < 20) {
      return errorMsg.substring(colonIndex + 1);
    }
    
    return errorMsg;
  }

  /**
   * Make request with retry and exponential backoff
   * @param {string} endpoint - API endpoint
   * @param {object} options - Fetch options
   * @param {number} retryCount - Current retry attempt (internal use)
   */
  async makeRequestWithRetry(endpoint, options = {}, retryCount = 0) {
    try {
      return await this.makeRequest(endpoint, options);
    } catch (error) {
      // Don't retry rate limit or auth errors
      if (error.message.startsWith('RATE_LIMIT:') || 
          error.message.includes('401') ||
          error.message.includes('No authentication token')) {
        throw error;
      }

      // Check if error is retryable and we haven't exceeded max retries
      if (this.isRetryableError(error) && retryCount < this.maxRetries) {
        const delay = this.baseRetryDelay * Math.pow(2, retryCount); // Exponential backoff
        apiClientLogger.warn(`Request failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})...`, {
          endpoint,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequestWithRetry(endpoint, options, retryCount + 1);
      }
      
      // Max retries exceeded or non-retryable error
      apiClientLogger.error(`Request failed after ${retryCount} retries`, {
        endpoint,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process text question dengan Supabase Edge Function
   */
  async processText(question, userType = 'TEXT') {
    try {
      apiClientLogger.info('Processing text question', {
        questionLength: question.length,
        userType
      });

      const response = await this.makeRequestWithRetry('/process-text-question', {
        method: 'POST',
        body: JSON.stringify({
          question: question,
          user_type: userType
        })
      });

      if (response.success) {
        apiClientLogger.info('Text processing successful', {
          answerLength: response.answer?.length || 0,
          modelUsed: response.model_used,
          rateLimitInfo: response.rate_limit_info
        });

        return {
          success: true,
          answer: response.answer,
          formatted_answer: response.formatted_answer,
          confidence: response.confidence,
          processing_time: response.processing_time,
          model_used: response.model_used,
          user_type: response.user_type,
          rate_limit_info: response.rate_limit_info
        };
      } else {
        throw new Error(response.error || 'Unknown error');
      }

    } catch (error) {
      apiClientLogger.error('Text processing failed', {
        error: error.message,
        userType
      });

      // Handle rate limiting errors (429 status)
      if (error.message.startsWith('RATE_LIMIT:')) {
        const rateLimitData = JSON.parse(error.message.substring(11));
        return {
          success: false,
          error: rateLimitData.reason,
          action: 'quota_exceeded', // Consistent action name
          quota_info: {
            current: rateLimitData.current_count || 20,
            limit: rateLimitData.limit || 20,
            remaining: 0,
            plan_type: 'FREE'
          },
          // Keep rate_limit_info for backward compatibility
          rate_limit_info: rateLimitData
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process scan area dengan Supabase Edge Function
   * @param {string} imageData - Base64 image data (can be full or pre-cropped)
   * @param {object|null} coordinates - Optional: {x, y, width, height} if backend needs to crop
   * @param {string|null} extractedText - Optional: Pre-extracted text from OCR
   * 
   * Note: Client now sends pre-cropped images to save bandwidth and storage
   */
  async processScanArea(imageData, coordinates = null, extractedText = null) {
    try {
      apiClientLogger.info('Processing scan area', {
        hasImage: !!imageData,
        hasCoordinates: !!coordinates,
        hasExtractedText: !!extractedText,
        imageSize: imageData ? `${Math.round(imageData.length / 1024)}KB` : 'N/A'
      });

      const requestBody = {
        image_data: imageData
      };

      if (coordinates) {
        requestBody.coordinates = coordinates;
      }

      if (extractedText) {
        requestBody.extracted_text = extractedText;
      }

      const response = await this.makeRequestWithRetry('/process-screenshot-question', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      if (response.success) {
        apiClientLogger.info('Scan area processing successful', {
          answerLength: response.answer?.length || 0,
          hasExtractedText: !!response.scan_area_data?.extracted_text,
          modelUsed: response.model_used,
          rateLimitInfo: response.rate_limit_info
        });

        return {
          success: true,
          answer: response.answer,
          formatted_answer: response.formatted_answer,
          scan_area_data: response.scan_area_data,
          confidence: response.confidence,
          processing_time: response.processing_time,
          model_used: response.model_used,
          user_type: response.user_type,
          rate_limit_info: response.rate_limit_info
        };
      } else {
        throw new Error(response.error || 'Unknown error');
      }

    } catch (error) {
      apiClientLogger.error('Scan area processing failed', {
        error: error.message
      });

      // Handle rate limiting errors (429 status)
      if (error.message.startsWith('RATE_LIMIT:')) {
        const rateLimitData = JSON.parse(error.message.substring(11));
        return {
          success: false,
          error: rateLimitData.reason,
          action: 'quota_exceeded', // Consistent action name
          quota_info: {
            current: rateLimitData.current_count || 20,
            limit: rateLimitData.limit || 20,
            remaining: 0,
            plan_type: 'FREE'
          },
          // Keep rate_limit_info for backward compatibility
          rate_limit_info: rateLimitData
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export global instance
const backendAPI = new BackendAPIClient();
