// Error handling and logging utilities
import { APP_CONSTANTS } from '../constants/app-constants.js';

export class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
    this.isEnabled = true;
  }

  /**
   * Initialize error handler
   */
  initialize() {
    // Set up global error handling
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Set up Chrome extension error handling
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(this.handleRuntimeMessage.bind(this));
    }
  }

  /**
   * Handle global JavaScript errors
   */
  handleGlobalError(event) {
    const error = {
      type: 'javascript',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    this.logError(error);
  }

  /**
   * Handle unhandled promise rejections
   */
  handleUnhandledRejection(event) {
    const error = {
      type: 'promise',
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    this.logError(error);
  }

  /**
   * Handle Chrome runtime messages
   */
  handleRuntimeMessage(message, sender, sendResponse) {
    if (message.type === 'error') {
      this.logError({
        type: 'runtime',
        ...message.data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Log error to internal storage
   */
  logError(error) {
    if (!this.isEnabled) return;

    this.errorLog.push(error);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console
    console.error('[ErrorHandler]', error);
    
    // Send to background script if available
    this.sendErrorToBackground(error);
  }

  /**
   * Send error to background script
   */
  sendErrorToBackground(error) {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'error',
          data: error
        });
      }
    } catch (e) {
      console.warn('Failed to send error to background script:', e);
    }
  }

  /**
   * Create error object from exception
   */
  createErrorObject(error, context = '', additionalInfo = {}) {
    return {
      type: 'application',
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...additionalInfo
    };
  }

  /**
   * Handle and log application errors
   */
  handleError(error, context = '', additionalInfo = {}) {
    const errorObj = this.createErrorObject(error, context, additionalInfo);
    this.logError(errorObj);
    return errorObj;
  }

  /**
   * Handle and log API errors
   */
  handleApiError(error, endpoint, requestData = {}) {
    const errorObj = this.createErrorObject(error, 'API Error', {
      endpoint,
      requestData: JSON.stringify(requestData),
      status: error.status,
      statusText: error.statusText
    });
    this.logError(errorObj);
    return errorObj;
  }

  /**
   * Handle and log Chrome API errors
   */
  handleChromeApiError(error, apiMethod, params = {}) {
    const errorObj = this.createErrorObject(error, 'Chrome API Error', {
      apiMethod,
      params: JSON.stringify(params),
      lastError: chrome.runtime.lastError?.message
    });
    this.logError(errorObj);
    return errorObj;
  }

  /**
   * Get error log
   */
  getErrorLog() {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      byContext: {},
      recent: this.errorLog.slice(-10)
    };

    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.byContext[error.context] = (stats.byContext[error.context] || 0) + 1;
    });

    return stats;
  }

  /**
   * Export error log
   */
  exportErrorLog(format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.errorLog, null, 2);
      
      case 'csv':
        const headers = ['timestamp', 'type', 'context', 'message', 'filename', 'lineno'];
        const csvRows = [headers.join(',')];
        
        this.errorLog.forEach(error => {
          const row = headers.map(header => {
            const value = error[header] || '';
            return `"${value.toString().replace(/"/g, '""')}"`;
          });
          csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
      
      case 'text':
        return this.errorLog.map(error => {
          return `[${error.timestamp}] ${error.type.toUpperCase()}: ${error.message}\n` +
                 `Context: ${error.context || 'N/A'}\n` +
                 `File: ${error.filename || 'N/A'}:${error.lineno || 'N/A'}\n` +
                 `Stack: ${error.stack || 'N/A'}\n`;
        }).join('\n---\n\n');
      
      default:
        return this.exportErrorLog('json');
    }
  }

  /**
   * Enable/disable error logging
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Check if error logging is enabled
   */
  isLoggingEnabled() {
    return this.isEnabled;
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();
