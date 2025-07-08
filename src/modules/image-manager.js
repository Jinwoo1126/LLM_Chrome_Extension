// Image management module

export class ImageManager {
  constructor() {
    this.currentImage = null;
    this.imagePreviewElement = null;
    this.maxImageSize = 5 * 1024 * 1024; // 5MB
    this.supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  }

  /**
   * Initialize image manager
   * @param {Object} elements - UI elements object
   */
  initialize(elements) {
    this.elements = elements;
    this.setupEventListeners();
    this.setupDragDropFeedback();
  }

  /**
   * Setup event listeners for image handling
   */
  setupEventListeners() {
    // Listen for paste events on user input
    if (this.elements.userInput) {
      this.elements.userInput.addEventListener('paste', this.handlePaste.bind(this));
    }

    // Listen for paste events on selection area
    if (this.elements.selectionInfo) {
      this.elements.selectionInfo.addEventListener('paste', this.handlePaste.bind(this));
    }

    // Listen for paste events on document for global clipboard handling
    document.addEventListener('paste', this.handlePaste.bind(this));

    // Listen for drag and drop events on user input
    if (this.elements.userInput) {
      this.elements.userInput.addEventListener('dragover', this.handleDragOver.bind(this));
      this.elements.userInput.addEventListener('drop', this.handleDrop.bind(this));
      this.elements.userInput.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    // Listen for drag and drop events on selection area
    if (this.elements.selectionInfo) {
      this.elements.selectionInfo.addEventListener('dragover', this.handleDragOver.bind(this));
      this.elements.selectionInfo.addEventListener('drop', this.handleDrop.bind(this));
      this.elements.selectionInfo.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    // Remove image button listener
    const removeImageBtn = document.getElementById('remove-image');
    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', this.removeImage.bind(this));
    }
  }

  /**
   * Handle paste event for images
   * @param {ClipboardEvent} event - Paste event
   */
  async handlePaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        
        // Show paste indicator
        this.showPasteIndicator('이미지를 처리하고 있습니다...');
        
        const file = item.getAsFile();
        
        if (file) {
          await this.processImage(file);
        }
        
        this.hidePasteIndicator();
        break;
      }
    }
  }

  /**
   * Handle drag over event
   * @param {DragEvent} event - Drag over event
   */
  handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    
    // Add visual feedback
    const targetElement = event.currentTarget;
    if (targetElement) {
      targetElement.classList.add('drag-over');
    }
  }

  /**
   * Handle drag leave event
   * @param {DragEvent} event - Drag leave event
   */
  handleDragLeave(event) {
    const targetElement = event.currentTarget;
    if (targetElement && !targetElement.contains(event.relatedTarget)) {
      targetElement.classList.remove('drag-over');
    }
  }

  /**
   * Handle drop event for images
   * @param {DragEvent} event - Drop event
   */
  async handleDrop(event) {
    event.preventDefault();
    
    // Remove visual feedback
    const targetElement = event.currentTarget;
    if (targetElement) {
      targetElement.classList.remove('drag-over');
    }
    
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith('image/')) {
      this.showPasteIndicator('이미지를 처리하고 있습니다...');
      await this.processImage(file);
      this.hidePasteIndicator();
    } else {
      this.showError('이미지 파일만 업로드할 수 있습니다.');
    }
  }

  /**
   * Process uploaded/pasted image
   * @param {File} file - Image file
   */
  async processImage(file) {
    try {
      // Validate file
      if (!this.validateImage(file)) {
        return;
      }

      // Convert to base64
      const base64Data = await this.fileToBase64(file);
      
      // Store image data
      this.currentImage = {
        file: file,
        base64: base64Data,
        dataUrl: `data:${file.type};base64,${base64Data}`,
        type: file.type,
        size: file.size,
        name: file.name
      };

      // Show image preview
      this.showImagePreview();
      
      // Dispatch event for other components
      document.dispatchEvent(new CustomEvent('image:uploaded', {
        detail: { image: this.currentImage }
      }));

      console.log('Image processed successfully:', this.currentImage.name);
    } catch (error) {
      console.error('Error processing image:', error);
      this.showError('이미지 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * Validate image file
   * @param {File} file - Image file to validate
   * @returns {boolean} - Whether file is valid
   */
  validateImage(file) {
    // Check file type
    if (!this.supportedFormats.includes(file.type)) {
      this.showError(`지원되지 않는 이미지 형식입니다. 지원 형식: ${this.supportedFormats.join(', ')}`);
      return false;
    }

    // Check file size
    if (file.size > this.maxImageSize) {
      this.showError(`이미지 크기가 너무 큽니다. 최대 크기: ${this.maxImageSize / (1024 * 1024)}MB`);
      return false;
    }

    return true;
  }

  /**
   * Convert file to base64
   * @param {File} file - File to convert
   * @returns {Promise<string>} - Base64 string
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const result = reader.result;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Show image preview in selection area
   */
  showImagePreview() {
    if (!this.currentImage || !this.elements.selectionInfo) return;

    // Show selection info area
    this.elements.selectionInfo.classList.remove('hidden');
    
    // Update selection header
    const selectionHeaderLeft = this.elements.selectionInfo.querySelector('.selection-header-left span');
    if (selectionHeaderLeft) {
      selectionHeaderLeft.textContent = 'Uploaded Image';
    }

    // Create or update image preview
    this.createImagePreviewElement();
  }

  /**
   * Create image preview element
   */
  createImagePreviewElement() {
    const selectionContent = this.elements.selectionInfo.querySelector('.selection-content');
    if (!selectionContent) return;

    // Remove existing image preview
    const existingPreview = selectionContent.querySelector('.image-preview-container');
    if (existingPreview) {
      existingPreview.remove();
    }

    // Create image preview container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-preview-container';
    
    // Create image element
    const img = document.createElement('img');
    img.src = this.currentImage.dataUrl;
    img.className = 'image-preview';
    img.alt = this.currentImage.name;
    
    // Create image info
    const imageInfo = document.createElement('div');
    imageInfo.className = 'image-info';
    imageInfo.innerHTML = `
      <span class="image-name">${this.currentImage.name}</span>
      <span class="image-size">${this.formatFileSize(this.currentImage.size)}</span>
    `;

    // Create remove button
    const removeBtn = document.createElement('button');
    removeBtn.id = 'remove-image';
    removeBtn.className = 'remove-image-button';
    removeBtn.innerHTML = '🗑️ Remove';
    removeBtn.title = '이미지 제거';
    removeBtn.addEventListener('click', this.removeImage.bind(this));

    // Assemble container
    imageContainer.appendChild(img);
    imageContainer.appendChild(imageInfo);
    imageContainer.appendChild(removeBtn);

    // Insert before selection buttons or at the beginning
    const selectionButtons = selectionContent.querySelector('.selection-buttons');
    if (selectionButtons) {
      selectionContent.insertBefore(imageContainer, selectionButtons);
    } else {
      selectionContent.appendChild(imageContainer);
    }

    this.imagePreviewElement = imageContainer;
  }

  /**
   * Remove current image
   */
  removeImage() {
    this.currentImage = null;
    
    if (this.imagePreviewElement) {
      this.imagePreviewElement.remove();
      this.imagePreviewElement = null;
    }

    // Hide selection info if no image and no selection
    const hasSelection = this.elements.selectionPreview && 
                        this.elements.selectionPreview.textContent.trim();
    
    if (!hasSelection) {
      this.elements.selectionInfo.classList.add('hidden');
    }

    // Dispatch event
    document.dispatchEvent(new CustomEvent('image:removed'));
    
    console.log('Image removed');
  }

  /**
   * Get current image data for API
   * @returns {Object|null} - Image data or null
   */
  getCurrentImageData() {
    try {
      if (!this.currentImage) return null;

      if (!this.currentImage.dataUrl) {
        console.warn('Image data available but dataUrl is missing');
        return null;
      }

      // Extract base64 data without the data URL prefix for Ollama
      const base64Data = this.currentImage.base64 || this.currentImage.dataUrl.split(',')[1];

      return {
        type: 'image_url',
        image_url: {
          url: this.currentImage.dataUrl
        }
      };
    } catch (error) {
      console.error('Error getting current image data:', error);
      return null;
    }
  }

  /**
   * Check if image is currently loaded
   * @returns {boolean} - Whether image is loaded
   */
  hasImage() {
    return !!this.currentImage;
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted size string
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    // Use existing error display mechanism or create simple alert
    if (window.llmChatApp && window.llmChatApp.uiManager) {
      window.llmChatApp.uiManager.showError(message);
    } else {
      alert(message);
    }
  }

  /**
   * Show paste indicator
   * @param {string} message - Message to show
   */
  showPasteIndicator(message = '이미지를 처리하고 있습니다...') {
    // Remove existing indicator
    this.hidePasteIndicator();
    
    const indicator = document.createElement('div');
    indicator.className = 'paste-indicator';
    indicator.id = 'paste-indicator';
    indicator.textContent = message;
    
    document.body.appendChild(indicator);
    
    // Trigger animation
    setTimeout(() => {
      indicator.classList.add('show');
    }, 10);
  }

  /**
   * Hide paste indicator
   */
  hidePasteIndicator() {
    const indicator = document.getElementById('paste-indicator');
    if (indicator) {
      indicator.classList.remove('show');
      setTimeout(() => {
        indicator.remove();
      }, 200);
    }
  }

  /**
   * Add drag and drop visual feedback
   */
  setupDragDropFeedback() {
    // Add dragenter and dragleave for better feedback
    document.addEventListener('dragenter', (e) => {
      if (this.hasDraggedFiles(e)) {
        this.showDropZone();
      }
    });

    document.addEventListener('dragleave', (e) => {
      // Only hide if we're leaving the document
      if (!e.relatedTarget) {
        this.hideDropZone();
      }
    });

    document.addEventListener('drop', () => {
      this.hideDropZone();
    });
  }

  /**
   * Check if dragged items contain files
   * @param {DragEvent} e - Drag event
   * @returns {boolean} - Whether files are being dragged
   */
  hasDraggedFiles(e) {
    return e.dataTransfer && e.dataTransfer.types.includes('Files');
  }

  /**
   * Show drop zone indicator
   */
  showDropZone() {
    if (!document.getElementById('image-drop-zone-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'image-drop-zone-overlay';
      overlay.className = 'image-drop-zone-overlay';
      overlay.innerHTML = `
        <div class="image-drop-zone">
          <div class="image-drop-zone-text">
            📸 이미지를 여기에 드롭하세요
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  }

  /**
   * Hide drop zone indicator
   */
  hideDropZone() {
    const overlay = document.getElementById('image-drop-zone-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Get image statistics
   * @returns {Object} - Image statistics
   */
  getStats() {
    return {
      hasImage: this.hasImage(),
      imageSize: this.currentImage?.size || 0,
      imageType: this.currentImage?.type || null,
      imageName: this.currentImage?.name || null
    };
  }

  /**
   * Show image usage help
   */
  showImageHelp() {
    const helpMessage = `
📸 이미지 업로드 방법:

1. 클립보드 붙여넣기:
   • 이미지를 복사한 후 Ctrl+V (Windows) 또는 Cmd+V (Mac)
   
2. 드래그 앤 드롭:
   • 이미지 파일을 입력 영역이나 선택된 텍스트 영역으로 드래그
   
3. 지원 형식:
   • JPEG, PNG, WebP, GIF (최대 5MB)
   
4. 이미지와 함께 텍스트를 입력하면 멀티모달 AI에 전송됩니다.
    `;
    
    if (window.llmChatApp && window.llmChatApp.uiManager) {
      window.llmChatApp.uiManager.showNotification(helpMessage, 'info');
    } else {
      alert(helpMessage);
    }
  }

  /**
   * Validate image upload requirements
   * @returns {Object} - Validation result
   */
  validateImageSupport() {
    const result = {
      isSupported: true,
      issues: []
    };

    // Check if File API is supported
    if (!window.File || !window.FileReader) {
      result.isSupported = false;
      result.issues.push('브라우저가 파일 API를 지원하지 않습니다.');
    }

    // Check if clipboard API is available
    if (!navigator.clipboard) {
      result.issues.push('클립보드 API를 사용할 수 없습니다. 수동 파일 업로드만 가능합니다.');
    }

    // Check if drag and drop is supported
    if (!window.FileList || !window.DataTransfer) {
      result.issues.push('드래그 앤 드롭이 지원되지 않습니다.');
    }

    return result;
  }
}
