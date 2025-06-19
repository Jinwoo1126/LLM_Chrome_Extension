// Conversation management module
import { APP_CONSTANTS } from '../constants/app-constants.js';
import { ChromeUtils } from '../utils/chrome-utils.js';
import { Utils } from '../utils/general-utils.js';

export class ConversationManager {
  constructor() {
    this.conversationHistory = [];
    this.isLoaded = false;
  }

  /**
   * Initialize conversation manager
   */
  async initialize() {
    try {
      await this.loadConversationHistory();
      this.isLoaded = true;
    } catch (error) {
      Utils.logError('ConversationManager.initialize', error);
      this.conversationHistory = [];
      this.isLoaded = true;
    }
  }

  /**
   * Add message to conversation history
   * @param {string} message - Message content
   * @param {boolean} isUser - Whether message is from user
   * @param {string} selection - Selected text context
   */
  addMessage(message, isUser = false, selection = '') {
    if (!message.trim()) return;

    const messageObj = {
      id: Utils.generateId(),
      content: message,
      isUser,
      timestamp: new Date().toISOString(),
      selection: selection || ''
    };

    this.conversationHistory.push(messageObj);
    
    // Keep only recent messages to prevent context from getting too long
    if (this.conversationHistory.length > APP_CONSTANTS.MAX_HISTORY_TURNS * 2) {
      this.conversationHistory = this.conversationHistory.slice(-APP_CONSTANTS.MAX_HISTORY_TURNS * 2);
    }

    this.saveConversationHistory();
    return messageObj;
  }

  /**
   * Get conversation history
   * @returns {Array} - Array of conversation messages
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Get formatted history for API
   * @returns {Array} - Formatted messages for API
   */
  getFormattedHistory() {
    return this.conversationHistory.map(msg => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.content
    }));
  }

  /**
   * Clear conversation history
   */
  async clearHistory() {
    this.conversationHistory = [];
    try {
      await ChromeUtils.removeStorage([APP_CONSTANTS.STORAGE_KEYS.CONVERSATION_HISTORY]);
    } catch (error) {
      Utils.logError('ConversationManager.clearHistory', error);
    }
  }

  /**
   * Save conversation history to storage
   */
  async saveConversationHistory() {
    try {
      await ChromeUtils.setStorage({
        [APP_CONSTANTS.STORAGE_KEYS.CONVERSATION_HISTORY]: this.conversationHistory
      });
    } catch (error) {
      Utils.logError('ConversationManager.saveConversationHistory', error);
    }
  }

  /**
   * Load conversation history from storage
   */
  async loadConversationHistory() {
    try {
      const result = await ChromeUtils.getStorage([APP_CONSTANTS.STORAGE_KEYS.CONVERSATION_HISTORY]);
      this.conversationHistory = result[APP_CONSTANTS.STORAGE_KEYS.CONVERSATION_HISTORY] || [];
    } catch (error) {
      Utils.logError('ConversationManager.loadConversationHistory', error);
      this.conversationHistory = [];
    }
  }

  /**
   * Get last user message
   * @returns {Object|null} - Last user message or null
   */
  getLastUserMessage() {
    const userMessages = this.conversationHistory.filter(msg => msg.isUser);
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  }

  /**
   * Get last assistant message
   * @returns {Object|null} - Last assistant message or null
   */
  getLastAssistantMessage() {
    const assistantMessages = this.conversationHistory.filter(msg => !msg.isUser);
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null;
  }

  /**
   * Remove message by ID
   * @param {string} messageId - Message ID to remove
   */
  async removeMessage(messageId) {
    this.conversationHistory = this.conversationHistory.filter(msg => msg.id !== messageId);
    await this.saveConversationHistory();
  }

  /**
   * Update message content
   * @param {string} messageId - Message ID to update
   * @param {string} newContent - New message content
   */
  async updateMessage(messageId, newContent) {
    const messageIndex = this.conversationHistory.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1) {
      this.conversationHistory[messageIndex].content = newContent;
      this.conversationHistory[messageIndex].updatedAt = new Date().toISOString();
      await this.saveConversationHistory();
    }
  }

  /**
   * Get conversation statistics
   * @returns {Object} - Conversation statistics
   */
  getStats() {
    const userMessages = this.conversationHistory.filter(msg => msg.isUser);
    const assistantMessages = this.conversationHistory.filter(msg => !msg.isUser);
    
    const totalWords = this.conversationHistory.reduce((count, msg) => {
      return count + msg.content.trim().split(/\s+/).length;
    }, 0);

    return {
      totalMessages: this.conversationHistory.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      totalWords,
      averageWordsPerMessage: totalWords / Math.max(this.conversationHistory.length, 1)
    };
  }

  /**
   * Export conversation history
   * @param {string} format - Export format ('json', 'text', 'markdown')
   * @returns {string} - Exported conversation
   */
  exportHistory(format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.conversationHistory, null, 2);
      
      case 'text':
        return this.conversationHistory.map(msg => {
          const timestamp = new Date(msg.timestamp).toLocaleString();
          const role = msg.isUser ? 'User' : 'Assistant';
          return `[${timestamp}] ${role}: ${msg.content}`;
        }).join('\n\n');
      
      case 'markdown':
        return this.conversationHistory.map(msg => {
          const timestamp = new Date(msg.timestamp).toLocaleString();
          const role = msg.isUser ? '**User**' : '**Assistant**';
          return `### ${role} (${timestamp})\n\n${msg.content}\n`;
        }).join('\n---\n\n');
      
      default:
        return this.exportHistory('json');
    }
  }

  /**
   * Import conversation history
   * @param {string} data - Conversation data to import
   * @param {string} format - Import format ('json')
   */
  async importHistory(data, format = 'json') {
    try {
      if (format === 'json') {
        const imported = JSON.parse(data);
        if (Array.isArray(imported)) {
          this.conversationHistory = imported;
          await this.saveConversationHistory();
          return true;
        }
      }
    } catch (error) {
      Utils.logError('ConversationManager.importHistory', error);
    }
    return false;
  }

  /**
   * Check if conversation is empty
   * @returns {boolean} - True if no messages
   */
  isEmpty() {
    return this.conversationHistory.length === 0;
  }

  /**
   * Search messages by content
   * @param {string} query - Search query
   * @returns {Array} - Matching messages
   */
  searchMessages(query) {
    if (!query.trim()) return [];
    
    const searchTerm = query.toLowerCase();
    return this.conversationHistory.filter(msg => 
      msg.content.toLowerCase().includes(searchTerm)
    );
  }
}
