// UI management module
import { APP_CONSTANTS } from '../constants/app-constants.js';
import { DOMUtils } from '../utils/dom-utils.js';
import { Utils } from '../utils/general-utils.js';

export class UIManager {
  constructor() {
    this.elements = {};
    this.isInitialized = false;
    this.messageId = 0;
  }

  /**
   * Initialize UI manager
   */
  initialize() {
    try {
      this.initializeElements();
      this.setupLibraries();
      this.detectMode();
      this.setupEventListeners();
      this.isInitialized = true;
    } catch (error) {
      Utils.logError('UIManager.initialize', error);
      throw error;
    }
  }

  /**
   * Initialize DOM elements
   */
  initializeElements() {
    this.elements = {
      // Main containers
      chatMessages: DOMUtils.getElementById('chat-messages'),
      userInput: DOMUtils.getElementById('user-input'),
      sendButton: DOMUtils.getElementById('send-button'),
      modelSelect: DOMUtils.getElementById('model-select'),

      // Selection elements
      selectionInfo: DOMUtils.getElementById('selection-info'),
      selectionPreview: DOMUtils.getElementById('selection-preview'),
      selectionHeader: document.querySelector('.selection-header'),
      selectionContent: document.querySelector('.selection-content'),
      selectionHeaderIcon: document.querySelector('.selection-header-icon'),

      // Selection buttons
      useSelectionButton: DOMUtils.getElementById('use-selection'),
      resetSelectionButton: DOMUtils.getElementById('reset-selection'),
      summarizeButton: DOMUtils.getElementById('summarize-selection'),
      translateButton: DOMUtils.getElementById('translate-selection')
    };

    // Validate critical elements
    const criticalElements = ['chatMessages', 'userInput', 'sendButton'];
    for (const elementName of criticalElements) {
      if (!this.elements[elementName]) {
        throw new Error(`Critical element '${elementName}' not found`);
      }
    }
  }

  /**
   * Setup external libraries
   */
  setupLibraries() {
    // Verify required libraries
    if (typeof marked === 'undefined') {
      throw new Error(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_LIBRARY_NOT_LOADED + ' (marked)');
    }
    if (typeof hljs === 'undefined') {
      throw new Error(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_LIBRARY_NOT_LOADED + ' (highlight.js)');
    }

    // Configure marked for markdown parsing
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.warn('Highlight.js error:', err);
          }
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true
    });
  }

  /**
   * Detect UI mode (popup or side panel)
   */
  detectMode() {
    const isSidePanel = window.location.search.includes('side_panel=true');
    const mode = isSidePanel ? APP_CONSTANTS.UI_MODES.SIDE_PANEL : APP_CONSTANTS.UI_MODES.POPUP;
    
    document.body.className = '';
    DOMUtils.addClass(document.body, mode);
  }

  /**
   * Setup basic event listeners
   */
  setupEventListeners() {
    // Auto-resize textarea
    DOMUtils.addEventListener(this.elements.userInput, 'input', () => {
      DOMUtils.autoResizeTextarea(this.elements.userInput);
    });

    // Handle Enter key
    DOMUtils.addEventListener(this.elements.userInput, 'keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Send button click
    DOMUtils.addEventListener(this.elements.sendButton, 'click', () => {
      this.handleSendMessage();
    });
  }

  /**
   * Handle send message event
   */
  handleSendMessage() {
    const message = this.elements.userInput.value.trim();
    if (!message) return;

    // Dispatch custom event
    const event = new CustomEvent('ui:sendMessage', {
      detail: { message }
    });
    document.dispatchEvent(event);
  }

  /**
   * Add message to chat UI
   * @param {string} content - Message content
   * @param {boolean} isUser - Whether message is from user
   * @param {string} selection - Selected text context
   * @returns {HTMLElement} - Created message element
   */
  addMessage(content, isUser = false, selection = '') {
    if (!this.elements.chatMessages) return null;

    const messageId = `msg-${++this.messageId}`;
    const messageElement = this.createMessageElement(messageId, content, isUser, selection);
    
    this.elements.chatMessages.appendChild(messageElement);
    DOMUtils.scrollToBottom(this.elements.chatMessages);

    return messageElement;
  }

  /**
   * Create message element
   * @param {string} messageId - Message ID
   * @param {string} content - Message content
   * @param {boolean} isUser - Whether message is from user
   * @param {string} selection - Selected text context
   * @returns {HTMLElement} - Message element
   */
  createMessageElement(messageId, content, isUser, selection) {
    const messageDiv = DOMUtils.createElement('div', {
      id: messageId,
      className: `message ${isUser ? 'user-message' : 'assistant-message'}`
    });

    // Add selection info if present
    if (selection && isUser) {
      const selectionDiv = this.createSelectionDisplay(selection);
      messageDiv.appendChild(selectionDiv);
    }

    // Add message content
    const contentDiv = DOMUtils.createElement('div', {
      className: 'message-content'
    });

    if (isUser) {
      DOMUtils.setContent(contentDiv, content);
    } else {
      // Parse markdown for assistant messages
      DOMUtils.setContent(contentDiv, marked.parse(content), true);
    }

    messageDiv.appendChild(contentDiv);

    // Add timestamp
    const timestampDiv = DOMUtils.createElement('div', {
      className: 'message-timestamp'
    }, Utils.formatTimestamp());

    messageDiv.appendChild(timestampDiv);

    return messageDiv;
  }

  /**
   * Create selection display for messages
   * @param {string} selection - Selected text
   * @returns {HTMLElement} - Selection display element
   */
  createSelectionDisplay(selection) {
    const selectionDiv = DOMUtils.createElement('div', {
      className: 'message-selection'
    });

    const headerDiv = DOMUtils.createElement('div', {
      className: 'message-selection-header'
    });

    const iconSpan = DOMUtils.createElement('span', {
      className: 'message-selection-icon'
    }, '▼');

    const labelSpan = DOMUtils.createElement('span', {}, 'Selected text');

    headerDiv.appendChild(iconSpan);
    headerDiv.appendChild(labelSpan);

    const contentDiv = DOMUtils.createElement('div', {
      className: 'message-selection-content'
    });

    const preElement = DOMUtils.createElement('pre', {}, selection);
    contentDiv.appendChild(preElement);

    selectionDiv.appendChild(headerDiv);
    selectionDiv.appendChild(contentDiv);

    // Add toggle functionality
    DOMUtils.addEventListener(headerDiv, 'click', () => {
      DOMUtils.toggleClass(contentDiv, APP_CONSTANTS.CSS_CLASSES.COLLAPSED);
      DOMUtils.toggleClass(iconSpan, APP_CONSTANTS.CSS_CLASSES.COLLAPSED);
    });

    return selectionDiv;
  }

  /**
   * Update message content (for streaming)
   * @param {HTMLElement} messageElement - Message element to update
   * @param {string} content - New content
   */
  updateMessageContent(messageElement, content) {
    if (!messageElement) return;

    const contentDiv = messageElement.querySelector('.message-content');
    if (contentDiv) {
      DOMUtils.setContent(contentDiv, marked.parse(content), true);
      DOMUtils.scrollToBottom(this.elements.chatMessages);
    }
  }

  /**
   * Show loading indicator
   * @returns {HTMLElement} - Loading element
   */
  showLoading() {
    const loadingElement = DOMUtils.createElement('div', {
      className: 'message assistant-message loading-message',
      id: 'loading-message'
    });

    const contentDiv = DOMUtils.createElement('div', {
      className: 'message-content'
    }, '생각하는 중...');

    loadingElement.appendChild(contentDiv);
    this.elements.chatMessages.appendChild(loadingElement);
    DOMUtils.scrollToBottom(this.elements.chatMessages);

    return loadingElement;
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loadingElement = DOMUtils.getElementById('loading-message');
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  /**
   * Clear input field
   */
  clearInput() {
    if (this.elements.userInput) {
      this.elements.userInput.value = '';
      this.elements.userInput.style.height = 'auto';
    }
  }

  /**
   * Set input focus
   */
  focusInput() {
    if (this.elements.userInput) {
      this.elements.userInput.focus();
    }
  }

  /**
   * Set send button state
   * @param {boolean} enabled - Whether button should be enabled
   */
  setSendButtonState(enabled) {
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !enabled;
      DOMUtils.setContent(this.elements.sendButton, enabled ? 'Send' : 'Sending...');
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorElement = this.addMessage(`❌ Error: ${message}`, false);
    if (errorElement) {
      DOMUtils.addClass(errorElement, 'error-message');
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccess(message) {
    const successElement = this.addMessage(`✅ ${message}`, false);
    if (successElement) {
      DOMUtils.addClass(successElement, 'success-message');
    }
  }

  /**
   * Initialize model selector
   * @param {Array} models - Available models
   * @param {string} currentModel - Currently selected model
   */
  initializeModelSelector(models, currentModel) {
    if (!this.elements.modelSelect) return;

    // Clear existing options
    this.elements.modelSelect.innerHTML = '';

    // Add model options
    models.forEach(model => {
      const option = DOMUtils.createElement('option', {
        value: model.id,
        selected: model.id === currentModel
      }, model.name);
      
      this.elements.modelSelect.appendChild(option);
    });

    // Add change event listener
    DOMUtils.addEventListener(this.elements.modelSelect, 'change', (e) => {
      const event = new CustomEvent('ui:modelChanged', {
        detail: { model: e.target.value }
      });
      document.dispatchEvent(event);
    });
  }

  /**
   * Add clear history button
   */
  addClearHistoryButton() {
    const modelSelector = document.querySelector('.model-selector');
    if (!modelSelector) return;

    const clearButton = DOMUtils.createElement('button', {
      id: 'clear-history',
      className: 'clear-history-button',
      title: '대화 기록 삭제'
    }, '🗑️');

    modelSelector.appendChild(clearButton);

    DOMUtils.addEventListener(clearButton, 'click', () => {
      if (confirm('대화 기록을 모두 삭제하시겠습니까?')) {
        const event = new CustomEvent('ui:clearHistory');
        document.dispatchEvent(event);
      }
    });
  }

  /**
   * Clear all messages
   */
  clearMessages() {
    if (this.elements.chatMessages) {
      this.elements.chatMessages.innerHTML = '';
    }
  }

  /**
   * Get UI elements
   * @returns {Object} - UI elements object
   */
  getElements() {
    return { ...this.elements };
  }

  /**
   * Set UI theme
   * @param {string} theme - Theme name ('light', 'dark', 'auto')
   */
  setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
  }

  /**
   * Get current UI mode
   * @returns {string} - Current UI mode
   */
  getCurrentMode() {
    if (DOMUtils.hasClass(document.body, APP_CONSTANTS.UI_MODES.POPUP)) {
      return 'popup';
    } else if (DOMUtils.hasClass(document.body, APP_CONSTANTS.UI_MODES.SIDE_PANEL)) {
      return 'sidepanel';
    }
    return 'unknown';
  }

  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('info', 'success', 'warning', 'error')
   * @param {number} duration - Duration in milliseconds
   */
  showNotification(message, type = 'info', duration = 3000) {
    const notification = DOMUtils.createElement('div', {
      className: `notification notification-${type}`
    }, message);

    document.body.appendChild(notification);

    // Auto-remove after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);
  }

  /**
   * Update UI state
   * @param {Object} state - UI state object
   */
  updateState(state) {
    if (state.isLoading !== undefined) {
      this.setSendButtonState(!state.isLoading);
    }

    if (state.hasSelection !== undefined) {
      const method = state.hasSelection ? 'showElement' : 'hideElement';
      DOMUtils[method](this.elements.selectionInfo);
    }

    if (state.selectionStored !== undefined) {
      const method = state.selectionStored ? 'addClass' : 'removeClass';
      DOMUtils[method](this.elements.useSelectionButton, APP_CONSTANTS.CSS_CLASSES.SELECTION_STORED);
    }
  }

  /**
   * Get UI statistics
   * @returns {Object} - UI statistics
   */
  getStatistics() {
    const messageElements = this.elements.chatMessages?.querySelectorAll('.message') || [];
    const userMessages = this.elements.chatMessages?.querySelectorAll('.user-message') || [];
    const assistantMessages = this.elements.chatMessages?.querySelectorAll('.assistant-message') || [];

    return {
      totalMessages: messageElements.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      currentMode: this.getCurrentMode(),
      hasSelection: !DOMUtils.hasClass(this.elements.selectionInfo, APP_CONSTANTS.CSS_CLASSES.HIDDEN)
    };
  }
}
