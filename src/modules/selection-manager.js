// Selection management module
import { APP_CONSTANTS } from '../constants/app-constants.js';
import { ChromeUtils } from '../utils/chrome-utils.js';
import { DOMUtils } from '../utils/dom-utils.js';
import { Utils } from '../utils/general-utils.js';

export class SelectionManager {
  constructor() {
    this.currentSelection = '';
    this.isSelectionStored = false;
    this.isSelectionMode = false;
    this.elements = {};
    
    // Throttled and debounced functions
    this.debouncedCheckSelection = Utils.debounce(
      this.checkForSelection.bind(this), 
      APP_CONSTANTS.SELECTION_DEBOUNCE_DELAY
    );
  }

  /**
   * Initialize selection manager
   * @param {Object} elements - DOM elements object
   */
  initialize(elements) {
    this.elements = elements;
    this.setupEventListeners();
    this.checkForContextAction();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Use selection button
    DOMUtils.addEventListener(this.elements.useSelectionButton, 'click', () => {
      this.handleUseSelection();
    });

    // Reset selection button
    DOMUtils.addEventListener(this.elements.resetSelectionButton, 'click', () => {
      this.resetSelection();
    });

    // Summarize button
    DOMUtils.addEventListener(this.elements.summarizeButton, 'click', () => {
      this.handleSummarize();
    });

    // Translate button
    DOMUtils.addEventListener(this.elements.translateButton, 'click', () => {
      this.handleTranslate();
    });

    // Selection header toggle
    DOMUtils.addEventListener(this.elements.selectionHeader, 'click', () => {
      this.toggleSelectionContent();
    });

    // Setup periodic selection monitoring
    this.setupSelectionMonitoring();
  }

  /**
   * Setup selection monitoring with throttling
   */
  setupSelectionMonitoring() {
    const checkInterval = setInterval(() => {
      if (!this.isSelectionStored) {
        this.debouncedCheckSelection();
      }
    }, APP_CONSTANTS.SELECTION_THROTTLE_LIMIT);

    // Clean up interval when page unloads
    window.addEventListener('beforeunload', () => {
      clearInterval(checkInterval);
    });
  }

  /**
   * Check for selected text from various sources
   */
  async checkForSelection() {
    try {
      // First check for context actions (from right-click menu)
      const contextAction = await this.checkForContextAction();
      if (contextAction && contextAction.hasAction) {
        return;
      }

      // Then check for current selection
      const response = await ChromeUtils.getSelectedText();
      const selectedText = response || '';

      if (selectedText && selectedText !== this.currentSelection) {
        this.updateSelection(selectedText);
      } else if (!selectedText && this.currentSelection && !this.isSelectionStored) {
        // Clear selection if no text is selected and not stored
        this.updateSelection('');
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
      DOMUtils.showElement(this.elements.selectionInfo);
    } else {
      DOMUtils.hideElement(this.elements.selectionInfo);
      this.isSelectionStored = false;
      this.isSelectionMode = false;
      DOMUtils.removeClass(this.elements.useSelectionButton, APP_CONSTANTS.CSS_CLASSES.SELECTION_STORED);
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
   * Handle use selection button click
   */
  handleUseSelection() {
    if (!this.currentSelection.trim()) {
      alert(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_NO_SELECTION);
      return;
    }

    this.isSelectionStored = true;
    this.isSelectionMode = true;
    DOMUtils.addClass(this.elements.useSelectionButton, APP_CONSTANTS.CSS_CLASSES.SELECTION_STORED);

    // Focus on input
    if (this.elements.userInput) {
      this.elements.userInput.focus();
    }

    // Dispatch custom event
    this.dispatchSelectionEvent('selectionStored', {
      selection: this.currentSelection,
      isStored: true
    });
  }

  /**
   * Handle summarization
   */
  async handleSummarize() {
    if (!this.currentSelection.trim()) {
      alert(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_NO_SELECTION);
      return;
    }

    const prompt = APP_CONSTANTS.DEFAULT_MESSAGES.SUMMARIZATION_PROMPT + this.currentSelection;
    
    this.dispatchSelectionEvent('actionRequested', {
      action: 'summarize',
      prompt: prompt,
      selection: this.currentSelection
    });
  }

  /**
   * Handle translation
   */
  async handleTranslate() {
    if (!this.currentSelection.trim()) {
      alert(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_NO_SELECTION);
      return;
    }

    const prompt = APP_CONSTANTS.DEFAULT_MESSAGES.TRANSLATION_PROMPT + this.currentSelection;
    
    this.dispatchSelectionEvent('actionRequested', {
      action: 'translate',
      prompt: prompt,
      selection: this.currentSelection
    });
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
