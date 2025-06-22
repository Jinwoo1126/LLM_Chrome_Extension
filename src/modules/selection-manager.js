// Selection management module
// 
// Smart Selection Detection Strategy:
// 1. Event-based: Uses content script's 'selectionchange' events for real-time detection
// 2. On-demand: Checks selection when user interacts (focus, click, send message)
// 3. Fallback: Minimal polling (30 seconds) only for side panel as backup
// 4. Efficient: Avoids constant polling, reduces resource usage
// 
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
   * Setup smart selection monitoring
   * Uses event-based detection instead of constant polling
   */
  setupSelectionMonitoring() {
    console.log('SelectionManager: Setting up smart selection monitoring...');
    
    // Check if we're in side panel mode
    const isSidePanel = window.location.search.includes('side_panel=true') || 
                       document.body.classList.contains('side-panel-mode');
    
    if (isSidePanel) {
      console.log('SelectionManager: Side panel detected - enabling event-based monitoring');
      
      // Only check for context actions once initially and when window gets focus
      this.checkForSelection();
      
      // Check when window regains focus (user might have selected text in another tab)
      window.addEventListener('focus', async () => {
        console.log('SelectionManager: Window focused, checking for selection...');
        await this.checkForSelection();
        await this.checkForFreshSelection();
      });
      
      // Optional: Very infrequent fallback check (every 30 seconds)
      const fallbackInterval = setInterval(async () => {
        await this.checkForFreshSelection();
      }, 30000); // Only every 30 seconds as fallback
      
      window.addEventListener('beforeunload', () => {
        clearInterval(fallbackInterval);
      });
      
    } else {
      console.log('SelectionManager: Popup mode - using on-demand selection detection');
      
      // For popup, only check on initialization and focus
      this.checkForSelection();
      
      // Check when popup gets focus
      window.addEventListener('focus', async () => {
        console.log('SelectionManager: Popup focused, checking for selection...');
        await this.checkForSelection();
        await this.checkForFreshSelection();
      });
    }
    
    // Initial check with delay for proper initialization
    setTimeout(async () => {
      try {
        await this.checkForFreshSelection();
      } catch (error) {
        console.log('SelectionManager: Initial selection check failed:', error);
      }
    }, 500);
  }

  /**
   * Check for fresh selection without constant polling
   */
  async checkForFreshSelection() {
    try {
      const directSelection = await this.getDirectSelection();
      if (directSelection && directSelection.trim() && directSelection !== this.currentSelection) {
        console.log('SelectionManager: Fresh selection detected:', directSelection);
        this.updateSelection(directSelection);
        return true;
      }
      return false;
    } catch (error) {
      console.log('SelectionManager: Could not check fresh selection:', error);
      return false;
    }
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
   * @param {boolean} force - Force update even if text is the same
   */
  updateSelection(text, force = false) {
    const trimmedText = text.trim();
    
    // Check if selection has actually changed
    if (!force && this.currentSelection === trimmedText) {
      console.log('SelectionManager: Selection unchanged, skipping update');
      return;
    }
    
    console.log('SelectionManager: Updating selection from:', this.currentSelection, 'to:', trimmedText);
    this.currentSelection = trimmedText;

    if (trimmedText) {
      this.updateSelectionUI(trimmedText);
      if (this.elements.selectionInfo) {
        this.elements.selectionInfo.classList.remove('hidden');
      }
      this.isSelectionStored = true;
      this.isSelectionMode = true;
      
      // Dispatch selection stored event
      this.dispatchSelectionEvent('selectionStored', {
        selection: trimmedText,
        isStored: true
      });
    } else {
      if (this.elements.selectionInfo) {
        this.elements.selectionInfo.classList.add('hidden');
      }
      this.isSelectionStored = false;
      this.isSelectionMode = false;
      
      // Dispatch selection reset event
      this.dispatchSelectionEvent('selectionReset', {
        selection: '',
        isStored: false
      });
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
   * Handle use selection
   * NOTE: Disabled to prevent duplicate calls. popup.js handles button clicks directly.
   */
  async handleUseSelection() {
    // Disabled - popup.js handles this directly to avoid duplicate calls
    console.log('SelectionManager.handleUseSelection - disabled to prevent duplicate calls');
    return;
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
   * Get selected text directly from background or content script
   * @returns {Promise<string>} - Promise resolving to selected text
   */
  async getDirectSelection() {
    try {
      const response = await ChromeUtils.getSelectedText();
      return response || '';
    } catch (error) {
      Utils.logError('SelectionManager.getDirectSelection', error);
      return '';
    }
  }

  /**
   * Get current selection (enhanced to check multiple sources)
   * @returns {string} - Current selection text
   */
  getCurrentSelection() {
    return this.currentSelection;
  }

  /**
   * Get current selection with fallback to direct selection
   * Always checks for fresh selection to avoid stale data
   * @returns {Promise<string>} - Promise resolving to current selection text
   */
  async getCurrentSelectionWithFallback() {
    console.log('SelectionManager: Getting selection with fallback...');
    
    // First try to get fresh direct selection
    try {
      const directSelection = await this.getDirectSelection();
      if (directSelection && directSelection.trim()) {
        console.log('SelectionManager: Found fresh direct selection:', directSelection);
        
        // Compare with stored selection
        if (directSelection !== this.currentSelection) {
          console.log('SelectionManager: Selection changed, updating...');
          this.updateSelection(directSelection);
        }
        
        return directSelection;
      }
    } catch (error) {
      console.log('SelectionManager: Could not get direct selection:', error);
    }
    
    // Fallback to stored selection
    if (this.currentSelection && this.currentSelection.trim()) {
      console.log('SelectionManager: Using stored selection as fallback:', this.currentSelection);
      return this.currentSelection;
    }
    
    console.log('SelectionManager: No selection found');
    return '';
  }

  /**
   * Force refresh selection from active tab
   * @returns {Promise<string>} - Promise resolving to refreshed selection
   */
  async refreshSelection() {
    try {
      console.log('SelectionManager: Forcing selection refresh...');
      const directSelection = await this.getDirectSelection();
      if (directSelection) {
        this.updateSelection(directSelection);
        console.log('SelectionManager: Selection refreshed:', directSelection);
      }
      return directSelection || '';
    } catch (error) {
      Utils.logError('SelectionManager.refreshSelection', error);
      return '';
    }
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
