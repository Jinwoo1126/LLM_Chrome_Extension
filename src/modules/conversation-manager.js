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
    const messages = this.conversationHistory.map(msg => {
      let content = msg.content || '';
      if (msg.selection && msg.selection.trim()) {
        // selection이 있으면 프롬프트에 합쳐서 전달
        content = `${content}\n\n[Selected text context]:\n${msg.selection.trim()}`.trim();
      }
      return {
        role: msg.isUser ? 'user' : 'assistant',
        content
      };
    });

    // Ensure alternating user/assistant pattern
    const validatedMessages = [];
    let lastRole = null;

    for (const message of messages) {
      // Skip empty messages
      if (!message.content.trim()) continue;
      
      // If same role as previous, merge content or skip
      if (lastRole === message.role) {
        if (validatedMessages.length > 0) {
          // Merge into previous message of same role
          validatedMessages[validatedMessages.length - 1].content += '\n\n' + message.content;
        }
        continue;
      }
      
      validatedMessages.push(message);
      lastRole = message.role;
    }

    // Ensure we start with user message
    if (validatedMessages.length > 0 && validatedMessages[0].role !== 'user') {
      validatedMessages.shift();
    }

    return validatedMessages;
  }

  /**
   * Load conversation history from storage
   */
  async loadConversationHistory() {
    try {
      console.log('Loading conversation history from storage...');
      const history = await ChromeUtils.getLocalStorageItem(APP_CONSTANTS.STORAGE_KEYS.CONVERSATION_HISTORY);
      console.log('Raw history from storage:', history);
      
      if (Array.isArray(history)) {
        this.conversationHistory = history;
        console.log('Loaded array history:', this.conversationHistory.length, 'messages');
      } else if (typeof history === 'string' && history.trim()) {
        try {
          this.conversationHistory = JSON.parse(history);
          console.log('Parsed string history:', this.conversationHistory.length, 'messages');
        } catch (parseError) {
          console.error('Failed to parse history string:', parseError);
          this.conversationHistory = [];
        }
      } else if (history && typeof history === 'object') {
        // In case it's stored as an object somehow
        this.conversationHistory = Object.values(history);
        console.log('Converted object history:', this.conversationHistory.length, 'messages');
      } else {
        this.conversationHistory = [];
        console.log('No history found, initialized empty array');
      }
      
      // Validate that all items are proper message objects
      this.conversationHistory = this.conversationHistory.filter(msg => 
        msg && typeof msg === 'object' && msg.content && typeof msg.isUser === 'boolean'
      );
      
      console.log('Final loaded conversation history:', this.conversationHistory.length, 'messages');
    } catch (error) {
      console.error('Error loading conversation history:', error);
      Utils.logError('ConversationManager.loadConversationHistory', error);
      this.conversationHistory = [];
    }
  }

  /**
   * Save conversation history to storage
   */
  async saveConversationHistory() {
    try {
      console.log('Saving conversation history:', this.conversationHistory.length, 'messages');
      await ChromeUtils.setLocalStorageItem(APP_CONSTANTS.STORAGE_KEYS.CONVERSATION_HISTORY, this.conversationHistory);
      console.log('Successfully saved conversation history');
    } catch (error) {
      console.error('Error saving conversation history:', error);
      Utils.logError('ConversationManager.saveConversationHistory', error);
    }
  }
}
