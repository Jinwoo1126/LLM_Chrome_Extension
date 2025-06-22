// Selection management module
// 
// Optimized Selection Detection Strategy:
// 1. Event-based: Uses content script's 'selectionchange' events for real-time detection
// 2. Single unified method: getSelection() handles all selection sources
// 3. Minimal caching: Reduces redundant calls
// 4. Efficient: Streamlined logic, no polling
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
    
    // Simple cache to avoid redundant calls
    this.selectionCache = new Map();
    this.CACHE_DURATION = 1000; // 1 second
    
    // Setup event system
    this.setupEventSystem();
  }

  /**
   * Initialize selection manager with DOM elements
   * @param {Object} elements - DOM elements object
   */
  async initialize(elements) {
    this.elements = elements;
    this.setupEventListeners();
    
    // Initial selection check
    setTimeout(async () => {
      await this.getSelection();
    }, 500);
  }

  /**
   * Get current language setting
   * @returns {Promise<string>} - Promise resolving to current language
   */
  async getCurrentLanguage() {
    try {
      const result = await ChromeUtils.getStorage(['lang']);
      return result.lang || 'ko';
    } catch (error) {
      return 'ko';
    }
  }

  /**
   * Setup event listeners for UI elements
   */
  setupEventListeners() {
    if (!this.elements.selectionHeader) return;

    // Toggle selection content visibility
    this.elements.selectionHeader.addEventListener('click', () => {
      this.toggleSelectionContent();
    });
  }

  /**
   * Setup event system for selection changes
   */
  setupEventSystem() {
    // Listen for selection changes from content script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'selectionChanged' && message.selectedText) {
        console.log('SelectionManager: Received selection change event:', message.selectedText);
        this.updateSelection(message.selectedText);
        
        // Dispatch custom event for other components
        document.dispatchEvent(new CustomEvent('selection:updated', {
          detail: { selection: message.selectedText }
        }));
      }
    });

    // Check for context actions on window focus (but not if just reset)
    window.addEventListener('focus', async () => {
      console.log('SelectionManager: Window focused, checking for selection...');
      
      // Don't fetch selection if we just reset it
      if (!this.currentSelection && this.selectionCache.get('justReset')) {
        console.log('SelectionManager: Skipping selection check - just reset');
        return;
      }
      
      await this.getSelection(true); // Force refresh on focus
    });
  }

  /**
   * Unified method to get selection from all sources
   * This replaces all the complex separate methods
   * @param {boolean} forceRefresh - Force refresh bypassing cache
   * @returns {Promise<string>} - Promise resolving to selected text
   */
  async getSelection(forceRefresh = false) {
    // Check if we just reset - if so, return empty string
    if (this.selectionCache.get('justReset')) {
      console.log('SelectionManager: Just reset, returning empty selection');
      return '';
    }
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.getCachedSelection();
      if (cached !== null) {
        console.log('SelectionManager: Using cached selection:', cached);
        return cached;
      }
    }

    console.log('SelectionManager: Getting fresh selection...');

    // 1. Check for context actions first (highest priority)
    try {
      const contextAction = await this.checkForContextAction();
      if (contextAction?.hasAction && contextAction.selection) {
        console.log('SelectionManager: Found context action selection:', contextAction.selection);
        this.updateSelection(contextAction.selection);
        this.setCachedSelection(contextAction.selection);
        return contextAction.selection;
      }
    } catch (error) {
      console.log('SelectionManager: Context action check failed:', error);
    }

    // 2. Get direct selection from content script
    try {
      const directSelection = await ChromeUtils.getSelectedText();
      if (directSelection?.trim()) {
        console.log('SelectionManager: Found direct selection:', directSelection);
        
        // Update if different from current
        if (directSelection !== this.currentSelection) {
          this.updateSelection(directSelection);
        }
        
        this.setCachedSelection(directSelection);
        return directSelection;
      }
    } catch (error) {
      console.log('SelectionManager: Direct selection failed:', error);
    }

    // 3. Return stored selection as fallback
    const storedSelection = this.currentSelection || '';
    console.log('SelectionManager: Using stored selection as fallback:', storedSelection);
    this.setCachedSelection(storedSelection);
    return storedSelection;
  }

  /**
   * Get cached selection if available and not expired
   * @returns {string|null} - Cached selection or null if not available/expired
   */
  getCachedSelection() {
    const cached = this.selectionCache.get('current');
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.value;
    }
    return null;
  }

  /**
   * Set cached selection
   * @param {string} selection - Selection to cache
   */
  setCachedSelection(selection) {
    this.selectionCache.set('current', {
      value: selection,
      timestamp: Date.now()
    });
  }

  /**
   * Check for context actions from background script
   * @returns {Promise<Object>} - Promise resolving to context action result
   */
  async checkForContextAction() {
    try {
      const response = await ChromeUtils.sendMessage({ 
        action: APP_CONSTANTS.MESSAGE_TYPES.CHECK_CONTEXT_ACTION 
      });
      
      if (response && response.hasAction) {
        const { action, selection } = response;
        
        // Mark action as processed
        await ChromeUtils.setStorage({ 
          [APP_CONSTANTS.STORAGE_KEYS.ACTION_PROCESSED]: true 
        });

        this.updateSelection(selection);
        
        // Handle specific actions (simplified)
        switch (action) {
          case APP_CONSTANTS.ACTION_TYPES.SELECTION:
            console.log('SelectionManager: Selection action detected');
            break;
          case APP_CONSTANTS.ACTION_TYPES.SUMMARIZE:
            console.log('SelectionManager: Summarize action detected');
            break;
          case APP_CONSTANTS.ACTION_TYPES.TRANSLATE:
            console.log('SelectionManager: Translate action detected');
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
   * Reset selection state
   */
  async resetSelection() {
    try {
      console.log('SelectionManager: Starting complete selection reset...');
      
      // Set reset flag to prevent immediate re-fetching
      this.selectionCache.set('justReset', { value: true, timestamp: Date.now() });
      
      // Clear all internal state
      this.currentSelection = '';
      this.isSelectionStored = false;
      this.isSelectionMode = false;
      this.selectionCache.clear();
      
      // Re-set the reset flag after clearing cache
      this.selectionCache.set('justReset', { value: true, timestamp: Date.now() });

      // Clear selection in content script and background
      await ChromeUtils.clearSelection();

      // Clear all related storage
      await ChromeUtils.removeStorage([
        APP_CONSTANTS.STORAGE_KEYS.CONTEXT_ACTION,
        APP_CONSTANTS.STORAGE_KEYS.CONTEXT_SELECTION,
        APP_CONSTANTS.STORAGE_KEYS.ACTION_PROCESSED,
        'activeTabId' // Also clear activeTabId to prevent stale references
      ]);

      // Update UI completely
      DOMUtils.hideElement(this.elements.selectionInfo);
      DOMUtils.removeClass(this.elements.useSelectionButton, APP_CONSTANTS.CSS_CLASSES.SELECTION_STORED);
      
      // Clear selection preview text
      if (this.elements.selectionPreview) {
        DOMUtils.setContent(this.elements.selectionPreview, '');
        this.elements.selectionPreview.removeAttribute('title');
      }

      // Dispatch reset event
      this.dispatchSelectionEvent('selectionReset', {
        selection: '',
        isStored: false
      });
      
      // Clear the reset flag after a delay to allow normal operation to resume
      setTimeout(() => {
        this.selectionCache.delete('justReset');
        console.log('SelectionManager: Reset flag cleared, normal operation resumed');
      }, 2000);

      console.log('SelectionManager: Complete selection reset finished');

    } catch (error) {
      Utils.logError('SelectionManager.resetSelection', error);
      // Even if there's an error, ensure internal state is cleared
      this.currentSelection = '';
      this.isSelectionStored = false;
      this.isSelectionMode = false;
      this.selectionCache.clear();
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
   * Get current selection (simple getter)
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
   * @returns {boolean} - True if valid
   */
  validateSelection(text) {
    return text && typeof text === 'string' && text.trim().length > 0;
  }
}
