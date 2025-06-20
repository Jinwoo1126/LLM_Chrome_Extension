// Selection management module
import { APP_CONSTANTS, getLocalizedMessage } from '../constants/app-constants.js';
import { ChromeUtils } from '../utils/chrome-utils.js';
import { DOMUtils } from '../utils/dom-utils.js';
import { Utils } from '../utils/general-utils.js';

export class SelectionManager {
  constructor() {
    this.currentSelection = '';
    this.isSelectionStored = false;
    this.isSelectionMode = false;
    this.elements = {};
    this.currentLanguage = 'ko';
    
    // Throttled and debounced functions
    this.debouncedCheckSelection = Utils.debounce(
      this.checkForSelection.bind(this), 
      APP_CONSTANTS.SELECTION_DEBOUNCE_DELAY
    );
  }

  /**
   * Initialize selection manager
   */
  async initialize(elements) {
    this.elements = elements;
    this.currentLanguage = await this.getCurrentLanguage();
    this.setupEventListeners();
    this.setupSelectionMonitoring();
  }

  /**
   * Get current language setting
   */
  async getCurrentLanguage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lang'], (result) => {
        resolve(result.lang || 'ko');
      });
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Reset selection button
    if (this.elements.resetSelectionButton) {
      this.elements.resetSelectionButton.addEventListener('click', () => {
        this.resetSelection();
      });
    }

    // Summarize button
    if (this.elements.summarizeButton) {
      this.elements.summarizeButton.addEventListener('click', () => {
        this.handleSummarize();
      });
    }

    // Translate button
    if (this.elements.translateButton) {
      this.elements.translateButton.addEventListener('click', () => {
        this.handleTranslate();
      });
    }

    // Selection header toggle
    if (this.elements.selectionHeader) {
      this.elements.selectionHeader.addEventListener('click', () => {
        this.toggleSelectionContent();
      });
    }

    // Setup periodic selection monitoring
    this.setupSelectionMonitoring();
  }

  /**
   * Setup selection monitoring with throttling
   * Re-enabled for side panel context action detection
   */
  setupSelectionMonitoring() {
    // Check if we're in side panel mode
    const isSidePanel = window.location.search.includes('side_panel=true') || 
                       document.body.classList.contains('side-panel-mode');
    
    if (isSidePanel) {
      // For side panel, check context actions more frequently
      console.log('SelectionManager: Side panel detected - enabling context action monitoring');
      const checkInterval = setInterval(() => {
        this.checkForSelection();
      }, 2000); // Check every 2 seconds for context actions
      
      // Clean up interval when page unloads
      window.addEventListener('beforeunload', () => {
        clearInterval(checkInterval);
      });
    } else {
      // For popup, only check once on initialization
      console.log('SelectionManager: Popup mode - checking context actions once');
    }
    
    // Always check for context actions on initialization
    this.checkForSelection();
  }

  /**
   * Check for selected text from various sources
   * Checks context actions and logs for debugging
   */
  async checkForSelection() {
    try {
      // Check for context actions (from right-click menu)
      const contextAction = await this.checkForContextAction();
      if (contextAction && contextAction.hasAction) {
        console.log('SelectionManager: Context action detected:', contextAction);
        return;
      }

      // For debugging: log when no context action is found
      const isSidePanel = window.location.search.includes('side_panel=true') || 
                         document.body.classList.contains('side-panel-mode');
      if (isSidePanel) {
        console.log('SelectionManager: No context action found in side panel mode');
      }
    } catch (error) {
      Utils.logError('SelectionManager.checkForSelection', error);
    }
  }

  /**
   * Check for context actions from background script
   */
  async checkForContextAction() {
    try {
      const response = await ChromeUtils.checkContextAction();
      
      if (response && response.hasAction) {
        const { action, selection } = response;
        
        // Mark action as processed
        await ChromeUtils.setStorage({ 
          [APP_CONSTANTS.STORAGE_KEYS.ACTION_PROCESSED]: true 
        });

        this.updateSelection(selection);
        
        // Handle specific actions
        switch (action) {
          case APP_CONSTANTS.ACTION_TYPES.SELECTION:
            this.handleUseSelection();
            break;
          case APP_CONSTANTS.ACTION_TYPES.SUMMARIZE:
            await this.handleSummarize();
            break;
          case APP_CONSTANTS.ACTION_TYPES.TRANSLATE:
            await this.handleTranslate();
            break;
        }

        return { hasAction: true, action, selection };
      }
      
      return { hasAction: false };
    } catch (error) {
      Utils.logError('SelectionManager.checkForContextAction', error);
      return { hasAction: false };
    }
  }

  /**
   * Update current selection and UI
   * @param {string} text - Selected text
   */
  updateSelection(text) {
    const trimmedText = text.trim();
    this.currentSelection = trimmedText;

    if (trimmedText) {
      this.updateSelectionUI(trimmedText);
      if (this.elements.selectionInfo) {
        this.elements.selectionInfo.classList.remove('hidden');
      }
    } else {
      if (this.elements.selectionInfo) {
        this.elements.selectionInfo.classList.add('hidden');
      }
      this.isSelectionStored = false;
      this.isSelectionMode = false;
      // Use Selection 관련 클래스/상태 제거
    }
  }

  /**
   * Update selection UI display
   * @param {string} text - Text to display
   */
  updateSelectionUI(text) {
    if (!this.elements.selectionPreview) return;

    const truncatedText = DOMUtils.truncateText(text, APP_CONSTANTS.MAX_SELECTION_PREVIEW_LENGTH);
    DOMUtils.setContent(this.elements.selectionPreview, truncatedText);
    
    // Update tooltip with full text if truncated
    if (text.length > APP_CONSTANTS.MAX_SELECTION_PREVIEW_LENGTH) {
      this.elements.selectionPreview.title = text;
    } else {
      this.elements.selectionPreview.removeAttribute('title');
    }
  }

  /**
   * Handle summarization
   * NOTE: Disabled to prevent duplicate calls. popup.js handles button clicks directly.
   */
  async handleSummarize() {
    // Disabled - popup.js handles this directly to avoid duplicate calls
    console.log('SelectionManager.handleSummarize - disabled to prevent duplicate calls');
    return;
  }

  /**
   * Handle translation
   * NOTE: Disabled to prevent duplicate calls. popup.js handles button clicks directly.
   */
  async handleTranslate() {
    // Disabled - popup.js handles this directly to avoid duplicate calls
    console.log('SelectionManager.handleTranslate - disabled to prevent duplicate calls');
    return;
  }

  /**
   * Reset selection state
   */
  async resetSelection() {
    try {
      this.currentSelection = '';
      this.isSelectionStored = false;
      this.isSelectionMode = false;

      // Clear selection in content script
      await ChromeUtils.clearSelection();

      // Clear storage
      await ChromeUtils.removeStorage([
        APP_CONSTANTS.STORAGE_KEYS.CONTEXT_ACTION,
        APP_CONSTANTS.STORAGE_KEYS.CONTEXT_SELECTION,
        APP_CONSTANTS.STORAGE_KEYS.ACTION_PROCESSED
      ]);

      // Update UI
      DOMUtils.hideElement(this.elements.selectionInfo);
      DOMUtils.removeClass(this.elements.useSelectionButton, APP_CONSTANTS.CSS_CLASSES.SELECTION_STORED);

      // Dispatch event
      this.dispatchSelectionEvent('selectionReset', {
        selection: '',
        isStored: false
      });

    } catch (error) {
      Utils.logError('SelectionManager.resetSelection', error);
    }
  }

  /**
   * Toggle selection content visibility
   */
  toggleSelectionContent() {
    const isVisible = !DOMUtils.hasClass(this.elements.selectionContent, APP_CONSTANTS.CSS_CLASSES.COLLAPSED);
    
    if (isVisible) {
      DOMUtils.addClass(this.elements.selectionContent, APP_CONSTANTS.CSS_CLASSES.COLLAPSED);
      DOMUtils.addClass(this.elements.selectionHeaderIcon, APP_CONSTANTS.CSS_CLASSES.COLLAPSED);
    } else {
      DOMUtils.removeClass(this.elements.selectionContent, APP_CONSTANTS.CSS_CLASSES.COLLAPSED);
      DOMUtils.removeClass(this.elements.selectionHeaderIcon, APP_CONSTANTS.CSS_CLASSES.COLLAPSED);
    }
  }

  /**
   * Dispatch custom selection event
   * @param {string} eventType - Event type
   * @param {Object} detail - Event detail
   */
  dispatchSelectionEvent(eventType, detail) {
    const event = new CustomEvent(`selection:${eventType}`, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Get current selection
   * @returns {string} - Current selection text
   */
  getCurrentSelection() {
    return this.currentSelection;
  }

  /**
   * Check if selection is stored
   * @returns {boolean} - True if selection is stored
   */
  isStored() {
    return this.isSelectionStored;
  }

  /**
   * Check if in selection mode
   * @returns {boolean} - True if in selection mode
   */
  isInSelectionMode() {
    return this.isSelectionMode;
  }

  /**
   * Set selection mode
   * @param {boolean} mode - Selection mode state
   */
  setSelectionMode(mode) {
    this.isSelectionMode = mode;
  }

  /**
   * Get selection info for display
   * @returns {Object} - Selection information
   */
  getSelectionInfo() {
    return {
      text: this.currentSelection,
      isStored: this.isSelectionStored,
      isMode: this.isSelectionMode,
      wordCount: this.currentSelection.trim().split(/\s+/).length,
      charCount: this.currentSelection.length,
      readingTime: Utils.calculateReadingTime(this.currentSelection)
    };
  }

  /**
   * Validate selection text
   * @param {string} text - Text to validate
   * @returns {Object} - Validation result
   */
  validateSelection(text) {
    const trimmed = text.trim();
    const wordCount = trimmed.split(/\s+/).length;
    const charCount = trimmed.length;

    return {
      isValid: charCount > 0,
      isEmpty: charCount === 0,
      isTooLong: charCount > 10000, // Arbitrary limit
      wordCount,
      charCount,
      warnings: []
    };
  }
}
