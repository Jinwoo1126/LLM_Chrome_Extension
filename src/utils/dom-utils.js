// DOM manipulation utilities
import { APP_CONSTANTS } from '../constants/app-constants.js';

export class DOMUtils {
  /**
   * Get element by ID with error handling
   * @param {string} id - Element ID
   * @returns {HTMLElement|null} - Element or null if not found
   */
  static getElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with ID '${id}' not found`);
    }
    return element;
  }

  /**
   * Add class to element
   * @param {HTMLElement} element - Target element
   * @param {string} className - Class name to add
   */
  static addClass(element, className) {
    if (element && className) {
      element.classList.add(className);
    }
  }

  /**
   * Remove class from element
   * @param {HTMLElement} element - Target element
   * @param {string} className - Class name to remove
   */
  static removeClass(element, className) {
    if (element && className) {
      element.classList.remove(className);
    }
  }

  /**
   * Toggle class on element
   * @param {HTMLElement} element - Target element
   * @param {string} className - Class name to toggle
   */
  static toggleClass(element, className) {
    if (element && className) {
      element.classList.toggle(className);
    }
  }

  /**
   * Check if element has class
   * @param {HTMLElement} element - Target element
   * @param {string} className - Class name to check
   * @returns {boolean} - True if element has class
   */
  static hasClass(element, className) {
    return element && className ? element.classList.contains(className) : false;
  }

  /**
   * Set element content safely
   * @param {HTMLElement} element - Target element
   * @param {string} content - Content to set
   * @param {boolean} isHTML - Whether content is HTML (default: false)
   */
  static setContent(element, content, isHTML = false) {
    if (element) {
      if (isHTML) {
        element.innerHTML = content;
      } else {
        element.textContent = content;
      }
    }
  }

  /**
   * Show element by removing hidden class
   * @param {HTMLElement} element - Element to show
   */
  static showElement(element) {
    this.removeClass(element, APP_CONSTANTS.CSS_CLASSES.HIDDEN);
  }

  /**
   * Hide element by adding hidden class
   * @param {HTMLElement} element - Element to hide
   */
  static hideElement(element) {
    this.addClass(element, APP_CONSTANTS.CSS_CLASSES.HIDDEN);
  }

  /**
   * Toggle element visibility
   * @param {HTMLElement} element - Element to toggle
   */
  static toggleElement(element) {
    this.toggleClass(element, APP_CONSTANTS.CSS_CLASSES.HIDDEN);
  }

  /**
   * Create element with attributes
   * @param {string} tagName - Tag name
   * @param {Object} attributes - Attributes object
   * @param {string} content - Text content
   * @returns {HTMLElement} - Created element
   */
  static createElement(tagName, attributes = {}, content = '') {
    const element = document.createElement(tagName);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else {
        element.setAttribute(key, value);
      }
    });

    if (content) {
      element.textContent = content;
    }

    return element;
  }

  /**
   * Safely add event listener
   * @param {HTMLElement} element - Target element
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Event options
   */
  static addEventListener(element, event, handler, options = {}) {
    if (element && typeof handler === 'function') {
      element.addEventListener(event, handler, options);
    }
  }

  /**
   * Auto-resize textarea based on content
   * @param {HTMLTextAreaElement} textarea - Textarea element
   * @param {number} maxHeight - Maximum height (default: 120px)
   */
  static autoResizeTextarea(textarea, maxHeight = APP_CONSTANTS.INPUT_AUTO_RESIZE_MAX_HEIGHT) {
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  /**
   * Scroll element to bottom
   * @param {HTMLElement} element - Element to scroll
   */
  static scrollToBottom(element) {
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }

  /**
   * Truncate text with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  static truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
