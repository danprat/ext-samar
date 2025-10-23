/**
 * Content Area Selector untuk SOAL-AI v2 Scan Area Tool
 * Handles area selection interface dengan drag & drop
 */

class AreaSelector {
  constructor() {
    this.isActive = false;
    this.isSelecting = false;
    this.startPoint = null;
    this.endPoint = null;
    this.overlay = null;
    this.selectionBox = null;
    this.controls = null;
    
    // Bind methods
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.confirmSelection = this.confirmSelection.bind(this);
    this.cancelSelection = this.cancelSelection.bind(this);
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'ping_content_script') {
        // Respond to ping to confirm content script is loaded
        sendResponse({ success: true, loaded: true });
      } else if (request.action === 'activate_area_selector') {
        this.activate();
        sendResponse({ success: true });
      } else if (request.action === 'deactivate_area_selector') {
        this.deactivate();
        sendResponse({ success: true });
      } else if (request.action === 'process_screenshot_ocr') {
        this.processScreenshotOCR(request, sendResponse);
        return true; // Async response
      }
    });

    // Listen for window.postMessage from injected floating windows
    // Bridge messages from injected code (floating windows) to background script
    window.addEventListener('message', (event) => {
      // Only accept messages from same origin
      if (event.source !== window) return;
      
      // Check for SOAL-AI scan area messages
      if (event.data && event.data.type === 'SOAL_AI_SCAN_AREA') {
        if (event.data.action === 'activate_area_selector') {
          // Forward to background script
          chrome.runtime.sendMessage({ 
            action: 'activate_area_selector' 
          }, (response) => {
            console.log('✅ Scan area activated from floating window:', response);
          });
        }
      }
    });
  }

  activate() {
    if (this.isActive) return;

    this.isActive = true;
    this.createOverlay();
    this.addEventListeners();
    
    // Show instruction
    this.showInstruction();
  }

  deactivate() {
    if (!this.isActive) return;

    this.isActive = false;
    this.isSelecting = false;
    this.removeOverlay();
    this.removeEventListeners();
    this.hideInstruction();
  }

  createOverlay() {
    // Remove existing overlay if any
    this.removeOverlay();
    
    // Create main overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'soal-ai-area-selector-overlay';
    this.overlay.id = 'soal-ai-area-selector-overlay';
    
    // Create selection box
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'soal-ai-selection-box';
    this.selectionBox.style.display = 'none';
    
    // Create controls container
    this.controls = document.createElement('div');
    this.controls.className = 'soal-ai-selection-controls';
    this.controls.style.display = 'none';
    
    // Create confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'soal-ai-btn-confirm';
    confirmBtn.textContent = '✓ Proses';
    confirmBtn.onclick = this.confirmSelection;
    
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'soal-ai-btn-cancel';
    cancelBtn.textContent = '✕ Batal';
    cancelBtn.onclick = this.cancelSelection;
    
    this.controls.appendChild(confirmBtn);
    this.controls.appendChild(cancelBtn);
    
    // Append to overlay
    this.overlay.appendChild(this.selectionBox);
    this.overlay.appendChild(this.controls);
    
    // Append to body
    document.body.appendChild(this.overlay);
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.selectionBox = null;
      this.controls = null;
    }
  }

  addEventListeners() {
    if (this.overlay) {
      this.overlay.addEventListener('mousedown', this.handleMouseDown);
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
      document.addEventListener('keydown', this.handleKeyDown);
    }
  }

  removeEventListeners() {
    if (this.overlay) {
      this.overlay.removeEventListener('mousedown', this.handleMouseDown);
    }
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleMouseDown(e) {
    if (e.target !== this.overlay) return;
    
    e.preventDefault();
    this.isSelecting = true;
    
    this.startPoint = {
      x: e.clientX,
      y: e.clientY
    };
    
    this.selectionBox.style.display = 'block';
    this.selectionBox.style.left = e.clientX + 'px';
    this.selectionBox.style.top = e.clientY + 'px';
    this.selectionBox.style.width = '0px';
    this.selectionBox.style.height = '0px';
    
    this.controls.style.display = 'none';
  }

  handleMouseMove(e) {
    if (!this.isSelecting || !this.startPoint) return;
    
    e.preventDefault();
    
    this.endPoint = {
      x: e.clientX,
      y: e.clientY
    };
    
    this.updateSelectionBox();
  }

  handleMouseUp(e) {
    if (!this.isSelecting) return;
    
    e.preventDefault();
    this.isSelecting = false;
    
    if (!this.endPoint) return;
    
    // Check if selection is large enough
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    if (width < 50 || height < 50) {
      this.showError('Area terlalu kecil. Pilih area yang lebih besar.');
      this.resetSelection();
      return;
    }
    
    // Show controls
    this.showControls();
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.cancelSelection();
    }
  }

  updateSelectionBox() {
    if (!this.startPoint || !this.endPoint) return;
    
    const left = Math.min(this.startPoint.x, this.endPoint.x);
    const top = Math.min(this.startPoint.y, this.endPoint.y);
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    this.selectionBox.style.left = left + 'px';
    this.selectionBox.style.top = top + 'px';
    this.selectionBox.style.width = width + 'px';
    this.selectionBox.style.height = height + 'px';
  }

  showControls() {
    if (!this.controls || !this.selectionBox) return;
    
    const boxRect = this.selectionBox.getBoundingClientRect();
    
    this.controls.style.display = 'flex';
    this.controls.style.left = (boxRect.right - this.controls.offsetWidth) + 'px';
    this.controls.style.top = (boxRect.bottom + 10) + 'px';
  }

  resetSelection() {
    this.startPoint = null;
    this.endPoint = null;
    this.selectionBox.style.display = 'none';
    this.controls.style.display = 'none';
  }

  confirmSelection() {
    if (!this.startPoint || !this.endPoint) return;

    const coordinates = this.getSelectionCoordinates();



    // Get extracted text for loading display
    const extractedText = `Area ${coordinates.width}x${coordinates.height} pixels`;

    // Show loading first via background script
    chrome.runtime.sendMessage({
      action: 'show_scan_loading',
      extractedText: extractedText
    });

    // Send coordinates to background script for processing
    chrome.runtime.sendMessage({
      action: 'scan_area_process',
      coordinates: coordinates
    }, (response) => {
      this.handleProcessResponse(response);
    });

    // Remove selection interface immediately
    this.showLoading();
  }

  cancelSelection() {
    this.deactivate();
  }

  getSelectionCoordinates() {
    const left = Math.min(this.startPoint.x, this.endPoint.x);
    const top = Math.min(this.startPoint.y, this.endPoint.y);
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    return {
      x: left,
      y: top,
      width: width,
      height: height,
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  showInstruction() {
    const instruction = document.createElement('div');
    instruction.className = 'soal-ai-instruction';
    instruction.id = 'soal-ai-instruction';
    instruction.innerHTML = `
      <div class="instruction-content">
        <h3>🎯 Scan Area Mode</h3>
        <p>Drag untuk memilih area yang ingin diproses</p>
        <small>Tekan ESC untuk membatalkan</small>
      </div>
    `;
    
    document.body.appendChild(instruction);
  }

  hideInstruction() {
    const instruction = document.getElementById('soal-ai-instruction');
    if (instruction) {
      instruction.remove();
    }
  }

  showLoading() {
    // Remove selection interface
    this.removeOverlay();
    
    // Show loading overlay (will be handled by background script)
    this.hideInstruction();
  }

  showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'soal-ai-error-notification';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  handleProcessResponse(response) {
    if (response && response.success === false) {
      // Check if this is an authentication error
      if (response.action === 'auth_required') {
        // Don't show error here - background script will handle auth overlay
        console.log('🎯 Authentication required in scan area, background will handle overlay');
      }
      // Check if this is a rate limiting error
      else if (response.action && (response.action.startsWith('rate_limit') || response.action === 'rate_limit')) {
        // Don't show error here - background script will handle subscription overlay
        console.log('🎯 Rate limit detected in scan area, background will handle overlay');
      } else {
        this.showError(response.error || 'Terjadi kesalahan saat memproses area');
      }
    } else if (response && response.success) {
      // Success - floating window will be handled by background script
    } else {
      this.showError('Tidak ada response dari server');
    }

    // Deactivate selector
    this.deactivate();
  }

  /**
   * Show result overlay dengan jawaban AI
   * @param {Object} result - AI response result
   */
  showResult(result) {

    // Create result overlay
    const resultOverlay = document.createElement('div');
    resultOverlay.className = 'soal-ai-result-overlay';
    resultOverlay.innerHTML = `
      <div class="result-content">
        <h3>🤖 Jawaban SOAL-AI</h3>
        <div class="result-answer">
          <h4>Jawaban:</h4>
          <p>${result.answer || 'Tidak ada jawaban'}</p>
        </div>
        ${result.explanation ? `
          <div class="result-explanation">
            <h4>Penjelasan:</h4>
            <p>${result.explanation}</p>
          </div>
        ` : ''}
        ${result.scanAreaData ? `
          <div class="result-meta">
            <small>OCR Confidence: ${result.scanAreaData.ocrConfidence}%</small>
            <small>Extracted Text: "${result.scanAreaData.extractedText.substring(0, 50)}..."</small>
          </div>
        ` : ''}
        <div class="result-buttons">
          <button id="closeResult" class="soal-ai-btn-confirm">✓ Tutup</button>
        </div>
      </div>
    `;

    // Add styles
    resultOverlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.5) !important;
      z-index: 1000000 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;

    const content = resultOverlay.querySelector('.result-content');
    content.style.cssText = `
      background: white !important;
      padding: 24px !important;
      border-radius: 12px !important;
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25) !important;
      max-width: 600px !important;
      width: 90% !important;
      max-height: 80vh !important;
      overflow-y: auto !important;
    `;

    document.body.appendChild(resultOverlay);

    // Handle close button
    resultOverlay.querySelector('#closeResult').onclick = () => {
      resultOverlay.remove();
    };

    // Handle ESC key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        resultOverlay.remove();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }

  /**
   * Process screenshot dengan OCR di content script
   * @param {Object} request - Request dengan screenshot dan coordinates
   * @param {Function} sendResponse - Response callback
   */
  async processScreenshotOCR(request, sendResponse) {
    try {

      // Check if dependencies are available
      if (typeof ScreenshotHandler === 'undefined') {
        throw new Error('ScreenshotHandler not available');
      }
      if (typeof OCRProcessor === 'undefined') {
        throw new Error('OCRProcessor not available');
      }

      // Initialize handlers
      const screenshotHandler = new ScreenshotHandler();
      const ocrProcessor = new OCRProcessor();

      // Crop image
      const croppedImage = await screenshotHandler.cropImage(request.screenshot, request.coordinates);

      // Optimize for OCR
      const optimizedImage = await screenshotHandler.optimizeForOCR(croppedImage);

      // Extract text
      const ocrResult = await ocrProcessor.extractText(optimizedImage);

      // Format text
      const formattedText = ocrProcessor.formatForAI(ocrResult.text);

      sendResponse({
        success: true,
        extractedText: formattedText,
        croppedImage: optimizedImage,
        confidence: ocrResult.confidence,
        rawText: ocrResult.text
      });

      // Cleanup
      screenshotHandler.cleanup();
      await ocrProcessor.cleanup();

    } catch (error) {
      console.error('🎯 OCR processing failed:', error);
      sendResponse({
        success: false,
        error: error.message || 'OCR processing failed'
      });
    }
  }
}

// Initialize area selector when content script loads
function initializeAreaSelector() {
  try {
    const areaSelector = new AreaSelector();

    // Export for debugging
    window.soalAIAreaSelector = areaSelector;

    return true;
  } catch (error) {
    console.error('Failed to initialize area selector:', error);
    return false;
  }
}

// Try to initialize immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAreaSelector);
} else {
  initializeAreaSelector();
}

// Also try after a short delay to ensure all scripts are loaded
setTimeout(() => {
  if (!window.soalAIAreaSelector) {
    initializeAreaSelector();
  }
}, 1000);
