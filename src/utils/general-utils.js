// General utility functions
import { APP_CONSTANTS } from '../constants/app-constants.js';

export class Utils {
  /**
   * Throttle function execution
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} - Throttled function
   */
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Debounce function execution
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} - Debounced function
   */
  static debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Generate unique ID
   * @returns {string} - Unique ID
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Format timestamp
   * @param {Date} date - Date object
   * @returns {string} - Formatted timestamp
   */
  static formatTimestamp(date = new Date()) {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Escape HTML entities
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Check if value is empty
   * @param {*} value - Value to check
   * @returns {boolean} - True if empty
   */
  static isEmpty(value) {
    return value === null || 
           value === undefined || 
           value === '' || 
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
  }

  /**
   * Deep clone object
   * @param {Object} obj - Object to clone
   * @returns {Object} - Cloned object
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid email
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} - True if valid URL
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Calculate reading time
   * @param {string} text - Text to analyze
   * @param {number} wordsPerMinute - Reading speed (default: 200 WPM)
   * @returns {number} - Reading time in minutes
   */
  static calculateReadingTime(text, wordsPerMinute = 200) {
    const wordCount = text.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Wait for specified time
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} - Promise that resolves after waiting
   */
  static wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   * @param {Function} func - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise} - Promise resolving to function result
   */
  static async retry(func, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await func();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, i);
        await this.wait(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Capitalize first letter of each word
   * @param {string} text - Text to capitalize
   * @returns {string} - Capitalized text
   */
  static capitalizeWords(text) {
    return text.replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Convert camelCase to kebab-case
   * @param {string} text - Text to convert
   * @returns {string} - Converted text
   */
  static camelToKebab(text) {
    return text.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Convert kebab-case to camelCase
   * @param {string} text - Text to convert
   * @returns {string} - Converted text
   */
  static kebabToCamel(text) {
    return text.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  /**
   * Check if running in popup mode
   * @returns {boolean} - True if in popup mode
   */
  static isPopupMode() {
    return document.body.classList.contains(APP_CONSTANTS.UI_MODES.POPUP);
  }

  /**
   * Check if running in side panel mode
   * @returns {boolean} - True if in side panel mode
   */
  static isSidePanelMode() {
    return document.body.classList.contains(APP_CONSTANTS.UI_MODES.SIDE_PANEL);
  }

  /**
   * Log error with context
   * @param {string} context - Error context
   * @param {Error} error - Error object
   * @param {Object} additionalInfo - Additional info to log
   */
  static logError(context, error, additionalInfo = {}) {
    console.error(`[${context}]`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...additionalInfo
    });
  }

  /**
   * Log debug information
   * @param {string} context - Debug context
   * @param {*} data - Data to log
   */
  static logDebug(context, data) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${context}]`, data);
    }
  }
}
