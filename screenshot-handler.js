/**
 * Screenshot Handler untuk SOAL-AI v2 Scan Area Tool
 * Handles screenshot capture dan image processing
 */

class ScreenshotHandler {
  constructor() {
    this.canvas = null;
    this.context = null;
    this.initialized = false;
  }

  /**
   * Initialize canvas untuk image processing
   */
  initialize() {
    if (this.initialized) return;
    
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.initialized = true;
    
    console.log('📸 Screenshot handler initialized');
  }

  /**
   * Capture area yang dipilih user
   * @param {Object} coordinates - {x, y, width, height, devicePixelRatio}
   * @returns {Promise<string>} Base64 encoded image
   */
  async captureArea(coordinates) {
    try {
      console.log('📸 Starting area capture...', coordinates);
      
      // 1. Capture full visible tab
      const fullScreenshot = await this.captureFullTab();
      
      // 2. Crop ke area yang dipilih
      const croppedImage = await this.cropImage(fullScreenshot, coordinates);
      
      // 3. Optimize untuk OCR
      const optimizedImage = await this.optimizeForOCR(croppedImage);
      
      console.log('📸 Area capture completed successfully');
      return optimizedImage;
      
    } catch (error) {
      console.error('📸 Screenshot capture failed:', error);
      throw new Error(`Screenshot capture failed: ${error.message}`);
    }
  }

  /**
   * Capture full visible tab menggunakan Chrome API
   * @returns {Promise<string>} Base64 encoded full screenshot
   */
  async captureFullTab() {
    return new Promise((resolve, reject) => {
      try {
        // Request screenshot dari background script
        chrome.runtime.sendMessage({
          action: 'capture_screenshot'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            resolve(response.dataUrl);
          } else {
            reject(new Error(response?.error || 'Screenshot capture failed'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Crop image ke area yang dipilih
   * @param {string} imageDataUrl - Base64 encoded full screenshot
   * @param {Object} coordinates - Selection coordinates
   * @returns {Promise<string>} Base64 encoded cropped image
   */
  async cropImage(imageDataUrl, coordinates) {
    return new Promise((resolve, reject) => {
      try {
        this.initialize();
        
        const img = new Image();
        img.onload = () => {
          try {
            // Calculate actual coordinates dengan device pixel ratio
            const dpr = coordinates.devicePixelRatio || 1;
            const actualX = coordinates.x * dpr;
            const actualY = coordinates.y * dpr;
            const actualWidth = coordinates.width * dpr;
            const actualHeight = coordinates.height * dpr;
            
            // Set canvas size ke cropped area
            this.canvas.width = actualWidth;
            this.canvas.height = actualHeight;
            
            // Draw cropped portion
            this.context.drawImage(
              img,
              actualX, actualY, actualWidth, actualHeight, // Source rectangle
              0, 0, actualWidth, actualHeight // Destination rectangle
            );
            
            // Convert to base64
            const croppedDataUrl = this.canvas.toDataURL('image/png', 1.0);
            resolve(croppedDataUrl);
            
          } catch (error) {
            reject(new Error(`Image cropping failed: ${error.message}`));
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load screenshot image'));
        };
        
        img.src = imageDataUrl;
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Optimize image untuk OCR processing
   * @param {string} imageDataUrl - Base64 encoded cropped image
   * @returns {Promise<string>} Base64 encoded optimized image
   */
  async optimizeForOCR(imageDataUrl) {
    return new Promise((resolve, reject) => {
      try {
        this.initialize();
        
        const img = new Image();
        img.onload = () => {
          try {
            // Set canvas size
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            
            // Draw original image
            this.context.drawImage(img, 0, 0);
            
            // Get image data untuk processing
            const imageData = this.context.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;
            
            // Apply OCR optimizations
            this.enhanceContrast(data);
            this.reduceNoise(data);
            this.sharpenText(data);
            
            // Put processed data back
            this.context.putImageData(imageData, 0, 0);
            
            // Convert to base64 dengan high quality
            const optimizedDataUrl = this.canvas.toDataURL('image/png', 1.0);
            resolve(optimizedDataUrl);
            
          } catch (error) {
            reject(new Error(`Image optimization failed: ${error.message}`));
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load cropped image'));
        };
        
        img.src = imageDataUrl;
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Enhance contrast untuk better OCR
   * @param {Uint8ClampedArray} data - Image pixel data
   */
  enhanceContrast(data) {
    const factor = 1.2; // Contrast enhancement factor
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast enhancement to RGB channels
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));     // Red
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128)); // Green
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128)); // Blue
      // Alpha channel (data[i + 3]) remains unchanged
    }
  }

  /**
   * Reduce noise untuk cleaner OCR
   * @param {Uint8ClampedArray} data - Image pixel data
   */
  reduceNoise(data) {
    // Simple noise reduction - convert near-white pixels to pure white
    const threshold = 240;
    
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      
      if (avg > threshold) {
        data[i] = 255;     // Red
        data[i + 1] = 255; // Green
        data[i + 2] = 255; // Blue
      }
    }
  }

  /**
   * Sharpen text untuk better OCR recognition
   * @param {Uint8ClampedArray} data - Image pixel data
   */
  sharpenText(data) {
    // Simple sharpening - increase contrast between adjacent pixels
    // This is a simplified version - full implementation would require convolution
    
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      
      // If pixel is dark (likely text), make it darker
      if (brightness < 128) {
        const factor = 0.9;
        data[i] = Math.max(0, data[i] * factor);
        data[i + 1] = Math.max(0, data[i + 1] * factor);
        data[i + 2] = Math.max(0, data[i + 2] * factor);
      }
      // If pixel is light (likely background), make it lighter
      else {
        const factor = 1.1;
        data[i] = Math.min(255, data[i] * factor);
        data[i + 1] = Math.min(255, data[i + 1] * factor);
        data[i + 2] = Math.min(255, data[i + 2] * factor);
      }
    }
  }

  /**
   * Convert data URL to blob untuk upload
   * @param {string} dataUrl - Base64 encoded image
   * @returns {Blob} Image blob
   */
  dataUrlToBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Get image dimensions dari data URL
   * @param {string} dataUrl - Base64 encoded image
   * @returns {Promise<{width: number, height: number}>}
   */
  async getImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
      };
      img.onerror = () => {
        reject(new Error('Failed to load image for dimension calculation'));
      };
      img.src = dataUrl;
    });
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.canvas = null;
      this.context = null;
      this.initialized = false;
    }
  }
}

// Export untuk digunakan di background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScreenshotHandler;
} else {
  window.ScreenshotHandler = ScreenshotHandler;
}
