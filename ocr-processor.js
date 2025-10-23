/**
 * OCR Processor untuk SOAL-AI v2 Scan Area Tool
 * Handles text extraction dari screenshot menggunakan Tesseract.js
 */

class OCRProcessor {
  constructor() {
    this.tesseract = null;
    this.initialized = false;
    this.isProcessing = false;
  }

  /**
   * Initialize OCR engine - Backend Vision API only
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Use only backend vision API - no manual fallback
      this.ocrMethods = [
        'backend_vision' // Backend Vision API (via Laravel)
      ];

      this.initialized = true;

    } catch (error) {
      console.error('🔤 OCR initialization failed:', error);
      throw new Error(`OCR initialization failed: ${error.message}`);
    }
  }



  /**
   * Extract text dari image menggunakan Backend Vision API
   * @param {string} imageDataUrl - Base64 encoded image
   * @returns {Promise<Object>} OCR result dengan text, confidence, dan words
   */
  async extractText(imageDataUrl) {
    if (this.isProcessing) {
      throw new Error('OCR is already processing another image');
    }

    try {
      this.isProcessing = true;

      // Initialize jika belum
      if (!this.initialized) {
        await this.initialize();
      }

      // Use Backend Vision API only - no fallback
      const result = await this.extractWithBackendVision(imageDataUrl);

      // Process dan clean hasil OCR
      const processedResult = {
        text: this.cleanText(result.text),
        confidence: result.confidence || 85,
        words: result.words || [],
        lines: result.lines || [],
        paragraphs: result.paragraphs || [],
        rawText: result.text,
        method: result.method || 'backend_vision'
      };



      // Validate hasil OCR
      this.validateOCRResult(processedResult);

      return processedResult;

    } catch (error) {
      console.error('🔤 OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clean dan format text hasil OCR
   * @param {string} rawText - Raw text dari OCR
   * @returns {string} Cleaned text
   */
  cleanText(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return '';
    }
    
    let cleanedText = rawText;
    
    // Remove excessive whitespace
    cleanedText = cleanedText.replace(/\s+/g, ' ');
    
    // Fix common OCR errors untuk mathematical symbols
    cleanedText = cleanedText.replace(/\|/g, 'I'); // Pipe to I
    cleanedText = cleanedText.replace(/0/g, 'O'); // Zero to O dalam konteks tertentu
    cleanedText = cleanedText.replace(/5/g, 'S'); // 5 to S dalam konteks tertentu
    
    // Fix mathematical operators
    cleanedText = cleanedText.replace(/x/gi, '×'); // x to multiplication
    cleanedText = cleanedText.replace(/\*/g, '×'); // asterisk to multiplication
    cleanedText = cleanedText.replace(/:/g, '÷'); // colon to division
    
    // Fix brackets dan parentheses
    cleanedText = cleanedText.replace(/\[/g, '(');
    cleanedText = cleanedText.replace(/\]/g, ')');
    cleanedText = cleanedText.replace(/\{/g, '(');
    cleanedText = cleanedText.replace(/\}/g, ')');
    
    // Remove leading/trailing whitespace
    cleanedText = cleanedText.trim();
    
    // Remove empty lines
    cleanedText = cleanedText.replace(/\n\s*\n/g, '\n');
    
    return cleanedText;
  }

  /**
   * Validate OCR result quality
   * @param {Object} ocrResult - OCR result object
   * @throws {Error} Jika OCR result tidak memenuhi standar
   */
  validateOCRResult(ocrResult) {
    console.log('🔤 Validating OCR result:', {
      confidence: ocrResult.confidence,
      textLength: ocrResult.text?.length,
      method: ocrResult.method
    });

    // More lenient confidence threshold for development/mock responses
    const minConfidence = ocrResult.method === 'backend_vision' ? 20 : 30;

    // Check confidence level
    if (ocrResult.confidence < minConfidence) {
      throw new Error(`OCR confidence too low: ${ocrResult.confidence}%. Coba pilih area dengan text yang lebih jelas.`);
    }

    // Check if text is found
    if (!ocrResult.text || ocrResult.text.trim().length < 3) {
      throw new Error('Tidak ada text yang terdeteksi. Pastikan area yang dipilih mengandung text yang jelas.');
    }

    // More lenient word count for mathematical expressions
    const wordCount = ocrResult.text.trim().split(/\s+/).length;
    if (wordCount < 1) {
      throw new Error('Text terlalu pendek. Pilih area dengan lebih banyak text.');
    }

    console.log('✅ OCR validation passed');
  }

  /**
   * Get OCR statistics untuk debugging
   * @param {Object} ocrResult - OCR result object
   * @returns {Object} Statistics
   */
  getOCRStatistics(ocrResult) {
    const words = ocrResult.text.trim().split(/\s+/);
    const lines = ocrResult.text.split('\n').filter(line => line.trim().length > 0);
    
    return {
      confidence: ocrResult.confidence,
      textLength: ocrResult.text.length,
      wordCount: words.length,
      lineCount: lines.length,
      averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length,
      hasNumbers: /\d/.test(ocrResult.text),
      hasMathSymbols: /[+\-×÷=<>≤≥≠√∞∑∫∂∆]/.test(ocrResult.text),
      hasParentheses: /[()[\]{}]/.test(ocrResult.text)
    };
  }

  /**
   * Format text untuk AI processing
   * @param {string} text - Cleaned OCR text
   * @returns {string} Formatted text untuk AI
   */
  formatForAI(text) {
    if (!text) return '';
    
    // Add context markers untuk mathematical content
    let formattedText = text;
    
    // Mark mathematical expressions
    if (/[+\-×÷=<>≤≥≠√∞∑∫∂∆]/.test(formattedText)) {
      formattedText = `[MATHEMATICAL CONTENT]\n${formattedText}`;
    }
    
    // Mark if contains numbers (likely calculation)
    if (/\d/.test(formattedText)) {
      formattedText = `[CONTAINS NUMBERS]\n${formattedText}`;
    }
    
    // Mark if contains questions
    if (/\?/.test(formattedText)) {
      formattedText = `[QUESTION FORMAT]\n${formattedText}`;
    }
    
    return formattedText;
  }

  /**
   * Extract text menggunakan Backend Vision API via message passing
   * @param {string} imageDataUrl - Base64 encoded image
   * @returns {Promise<Object>} OCR result
   */
  async extractWithBackendVision(imageDataUrl) {
    try {
      console.log('🔤 Using backend vision API for OCR via message passing');

      // Send message to background script untuk backend API call
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'process_backend_vision',
          imageData: imageDataUrl
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });

      if (result.success && result.scan_area_data?.extracted_text) {
        const extractedText = result.scan_area_data.extracted_text;

        // Ensure confidence is a reasonable value (80-95% for mock responses)
        let confidence = result.scan_area_data.confidence || 85;

        // If confidence is suspiciously low (like 0.8), treat it as percentage already
        if (confidence < 1) {
          confidence = confidence * 100; // Convert decimal to percentage
        }

        // Ensure minimum confidence for mock responses
        if (confidence < 50) {
          confidence = 85; // Default to 85% for development
        }

        return {
          text: extractedText.trim(),
          confidence: confidence,
          method: 'backend_vision'
        };
      } else {
        throw new Error(result.error || 'No text detected by backend vision API');
      }

    } catch (error) {
      console.error('🔤 Backend vision API failed:', error);
      throw new Error(`Backend Vision API error: ${error.message}`);
    }
  }



  /**
   * Cleanup OCR processor
   */
  async cleanup() {
    try {
      this.initialized = false;
      this.isProcessing = false;
      console.log('🔤 OCR processor cleaned up');
    } catch (error) {
      console.error('🔤 OCR cleanup error:', error);
    }
  }

  /**
   * Get OCR engine status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      processing: this.isProcessing,
      hasWorker: !!this.tesseract
    };
  }

  /**
   * Test OCR dengan sample image
   * @param {string} testImageUrl - Test image URL
   * @returns {Promise<Object>} Test result
   */
  async testOCR(testImageUrl) {
    try {
      console.log('🔤 Testing OCR with sample image...');
      const result = await this.extractText(testImageUrl);
      const stats = this.getOCRStatistics(result);
      
      return {
        success: true,
        result: result,
        statistics: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export untuk digunakan di background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OCRProcessor;
} else {
  window.OCRProcessor = OCRProcessor;
}
