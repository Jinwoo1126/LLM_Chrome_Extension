// Chrome API utilities
import { APP_CONSTANTS } from '../constants/app-constants.js';

export class ChromeUtils {
  /**
   * Send message to Chrome runtime
   * @param {Object} message - Message object
   * @returns {Promise} - Promise resolving to response
   */
  static sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get data from Chrome storage
   * @param {string|string[]|Object} keys - Storage keys
   * @returns {Promise} - Promise resolving to stored data
   */
  static getStorage(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set data in Chrome storage
   * @param {Object} data - Data to store
   * @returns {Promise} - Promise resolving when data is stored
   */
  static setStorage(data) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Remove data from Chrome storage
   * @param {string|string[]} keys - Keys to remove
   * @returns {Promise} - Promise resolving when data is removed
   */
  static removeStorage(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get active tab
   * @returns {Promise} - Promise resolving to active tab
   */
  static getActiveTab() {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (tabs.length === 0) {
            reject(new Error('No active tab found'));
          } else {
            resolve(tabs[0]);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send message to content script
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message object
   * @returns {Promise} - Promise resolving to response
   */
  static sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Open side panel
   * @param {number} windowId - Window ID
   * @returns {Promise} - Promise resolving when side panel is opened
   */
  static openSidePanel(windowId) {
    return new Promise((resolve, reject) => {
      try {
        chrome.sidePanel.open({ windowId }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create new window
   * @param {Object} options - Window options
   * @returns {Promise} - Promise resolving to created window
   */
  static createWindow(options) {
    return new Promise((resolve, reject) => {
      try {
        chrome.windows.create(options, (window) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(window);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get current page info from content script
   * @returns {Promise} - Promise resolving to page info
   */
  static async getCurrentPageInfo() {
    try {
      const response = await this.sendMessage({
        action: APP_CONSTANTS.MESSAGE_TYPES.GET_CURRENT_PAGE_INFO
      });
      return response;
    } catch (error) {
      console.error('Error getting current page info:', error);
      throw error;
    }
  }

  /**
   * Get selected text from content script
   * @returns {Promise} - Promise resolving to selected text
   */
  static async getSelectedText() {
    try {
      const response = await this.sendMessage({
        action: APP_CONSTANTS.MESSAGE_TYPES.GET_SELECTED_TEXT
      });
      return response?.selectedText || '';
    } catch (error) {
      console.error('Error getting selected text:', error);
      throw error;
    }
  }

  /**
   * Clear selection in content script
   * @returns {Promise} - Promise resolving when selection is cleared
   */
  static async clearSelection() {
    try {
      const response = await this.sendMessage({
        action: APP_CONSTANTS.MESSAGE_TYPES.CLEAR_SELECTION
      });
      return response;
    } catch (error) {
      console.error('Error clearing selection:', error);
      throw error;
    }
  }

  /**
   * Check for context actions
   * @returns {Promise} - Promise resolving to context action info
   */
  static async checkContextAction() {
    try {
      const response = await this.sendMessage({
        action: APP_CONSTANTS.MESSAGE_TYPES.CHECK_CONTEXT_ACTION
      });
      return response;
    } catch (error) {
      console.error('Error checking context action:', error);
      throw error;
    }
  }
}
