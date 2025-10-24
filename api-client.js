/**
 * API Client untuk komunikasi dengan Laravel backend
 * Menggantikan direct LiteLLM API calls
 */

// API Configuration - Supabase Edge Functions
const API_CONFIG = {
  SUPABASE_URL: 'https://ekqkwtxpjqqwjovekdqp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWt3dHhwanFxd2pvdmVrZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDE5NjMsImV4cCI6MjA3NjI3Nzk2M30.Uq0ekLIjQ052wGixZI4qh1nzZoAkde7JuJSINAHXxTQ', // Replace with actual anon key
  FUNCTIONS_URL: 'https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1',
  TIMEOUT: 60000, // 60 seconds
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 1000 // 1 second
};

// Simple logger untuk API client
const APILogger = {
  debug: (message, data = null) => {
    console.log(`🔌 [API-DEBUG] ${message}`, data || '');
  },
  info: (message, data = null) => {
    console.log(`🔌 [API-INFO] ${message}`, data || '');
  },
  warn: (message, data = null) => {
    console.warn(`🔌 [API-WARN] ${message}`, data || '');
  },
  error: (message, error = null) => {
    console.error(`🔌 [API-ERROR] ${message}`, error || '');
  }
};

/**
 * API Client class untuk Supabase communication
 */
class BackendAPIClient {
  constructor() {
    this.functionsURL = API_CONFIG.FUNCTIONS_URL;
    this.supabaseURL = API_CONFIG.SUPABASE_URL;
    this.supabaseKey = API_CONFIG.SUPABASE_ANON_KEY;
    this.timeout = API_CONFIG.TIMEOUT;
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
   */
  async makeRequest(endpoint, options = {}) {
    const authToken = await this.getAuthToken();
    
    if (!authToken) {
      throw new Error('No authentication token found');
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

    APILogger.debug('Making request', {
      url,
      method: defaultOptions.method,
      hasAuth: !!authToken
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...defaultOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        APILogger.error('Server returned HTML instead of JSON', {
          status: response.status,
          contentType,
          htmlPreview: htmlText.substring(0, 200)
        });
        throw new Error(`Server error: Expected JSON but got HTML (Status: ${response.status})`);
      }

      const responseData = await response.json();

      if (!response.ok) {
        APILogger.error('Request failed', {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });

        // Handle rate limiting specifically
        if (response.status === 429) {
          const rateLimitInfo = responseData.rate_limit_info || {};
          throw new Error(`RATE_LIMIT:${JSON.stringify({
            reason: responseData.error || 'Rate limit exceeded',
            action: responseData.action || 'rate_limit',
            type: rateLimitInfo.type || 'unknown',
            wait_seconds: rateLimitInfo.wait_seconds || 60,
            current_count: rateLimitInfo.current_count || 0,
            limit: rateLimitInfo.limit || 0,
            reset_time: rateLimitInfo.reset_time || 0
          })}`);
        }

        throw new Error(`HTTP ${response.status}: ${responseData.error || response.statusText}`);
      }

      APILogger.info('Request successful', {
        endpoint,
        status: response.status
      });

      return responseData;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      APILogger.error('Request error', {
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
      APILogger.info('Processing text question', {
        questionLength: question.length,
        userType
      });

      const response = await this.makeRequest('/process-text-question', {
        method: 'POST',
        body: JSON.stringify({
          question: question,
          user_type: userType
        })
      });

      if (response.success) {
        APILogger.info('Text processing successful', {
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
      APILogger.error('Text processing failed', {
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
      APILogger.info('Processing scan area', {
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

      const response = await this.makeRequest('/process-screenshot-question', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      if (response.success) {
        APILogger.info('Scan area processing successful', {
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
      APILogger.error('Scan area processing failed', {
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

  /**
   * Send magic link to email - Direct Supabase Auth API
   */
  async sendMagicLink(email) {
    try {
      APILogger.info('Sending magic link', { email });

      const response = await fetch(`${this.supabaseURL}/auth/v1/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey
        },
        body: JSON.stringify({ 
          email: email,
          options: {
            emailRedirectTo: `${this.supabaseURL}/auth/v1/verify`
          }
        })
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          message: 'Magic link telah dikirim ke email Anda',
          email: email
        };
      } else {
        throw new Error(result.error_description || result.msg || 'Failed to send magic link');
      }

    } catch (error) {
      APILogger.error('Magic link error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify OTP token - Direct Supabase Auth API
   */
  async verifyOTP(email, token) {
    try {
      APILogger.info('Verifying OTP', { email });

      const response = await fetch(`${this.supabaseURL}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey
        },
        body: JSON.stringify({ 
          type: 'email',
          email: email,
          token: token
        })
      });

      const result = await response.json();

      if (response.ok && result.access_token) {
        return {
          success: true,
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          user: result.user
        };
      } else {
        throw new Error(result.error_description || result.msg || 'Invalid or expired token');
      }

    } catch (error) {
      APILogger.error('OTP verification error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retry request dengan exponential backoff
   */
  async retryRequest(requestFn, maxAttempts = API_CONFIG.RETRY_ATTEMPTS) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          break;
        }

        // Exponential backoff
        const delay = API_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
        APILogger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`, {
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// Export global instance
const backendAPI = new BackendAPIClient();
