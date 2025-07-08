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
   * @param {string|Array} message - Message content (string or OpenAI format array for multimodal)
   * @param {boolean} isUser - Whether message is from user
   * @param {string} selection - Selected text context
   * @param {Array} images - Array of image data URLs (optional)
   */
  addMessage(message, isUser = false, selection = '', images = []) {
    // Validate message content
    if (Array.isArray(message)) {
      // For multimodal messages, check if there's any text content
      const hasTextContent = message.some(part => 
        part.type === 'text' && part.text && part.text.trim()
      );
      if (!hasTextContent) return;
    } else if (typeof message === 'string') {
      if (!message.trim()) return;
    } else {
      return; // Invalid message format
    }

    const messageObj = {
      id: Utils.generateId(),
      content: message,
      isUser,
      timestamp: new Date().toISOString(),
      selection: selection || '',
      images: images || [] // Store image data for history
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
      
      // Handle multimodal content (already in OpenAI format)
      if (Array.isArray(content)) {
        // If there's selection context, add it to the text parts
        if (msg.selection && msg.selection.trim()) {
          const textParts = content.filter(part => part.type === 'text');
          if (textParts.length > 0) {
            textParts[0].text = `${textParts[0].text}\n\n[Selected text context]:\n${msg.selection.trim()}`.trim();
          }
        }
        return {
          role: msg.isUser ? 'user' : 'assistant',
          content: content
        };
      } else {
        // Handle text-only content
        if (msg.selection && msg.selection.trim()) {
          content = `${content}\n\n[Selected text context]:\n${msg.selection.trim()}`.trim();
        }
        return {
          role: msg.isUser ? 'user' : 'assistant',
          content: content
        };
      }
    });

    // Ensure alternating user/assistant pattern
    const validatedMessages = [];
    let lastRole = null;

    for (const message of messages) {
      // Skip empty messages
      let hasContent = false;
      if (Array.isArray(message.content)) {
        hasContent = message.content.some(part => 
          (part.type === 'text' && part.text && part.text.trim()) ||
          (part.type === 'image_url' && part.image_url)
        );
      } else {
        hasContent = message.content && message.content.trim();
      }
      
      if (!hasContent) continue;
      
      // If same role as previous, merge content or skip
      if (lastRole === message.role) {
        if (validatedMessages.length > 0) {
          const prevMessage = validatedMessages[validatedMessages.length - 1];
          // For text content, merge
          if (!Array.isArray(prevMessage.content) && !Array.isArray(message.content)) {
            prevMessage.content += '\n\n' + message.content;
          }
          // For mixed content, just keep the previous one (complex merging logic not needed here)
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
      
      // Ensure images array exists for all messages (backward compatibility)
      this.conversationHistory = this.conversationHistory.map(msg => ({
        ...msg,
        images: msg.images || []
      }));
      
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

  /**
   * Clear conversation history
   */
  async clearHistory() {
    try {
      console.log('Clearing conversation history...');
      this.conversationHistory = [];
      await this.saveConversationHistory();
      console.log('Conversation history cleared successfully');
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      Utils.logError('ConversationManager.clearHistory', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    const multimodalMessages = this.conversationHistory.filter(msg => 
      Array.isArray(msg.content) || (msg.images && msg.images.length > 0)
    ).length;
    
    return {
      messageCount: this.conversationHistory.length,
      userMessages: this.conversationHistory.filter(msg => msg.isUser).length,
      assistantMessages: this.conversationHistory.filter(msg => !msg.isUser).length,
      multimodalMessages: multimodalMessages,
      totalCharacters: this.conversationHistory.reduce((sum, msg) => {
        if (Array.isArray(msg.content)) {
          return sum + msg.content.reduce((textSum, part) => {
            return textSum + (part.type === 'text' ? (part.text?.length || 0) : 0);
          }, 0);
        } else {
          return sum + (msg.content?.length || 0);
        }
      }, 0),
      isLoaded: this.isLoaded
    };
  }

  /**
   * Export conversation history
   */
  exportHistory(format = 'json') {
    const history = this.getHistory();
    
    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    } else if (format === 'txt') {
      return history.map(msg => {
        const timestamp = new Date(msg.timestamp).toLocaleString();
        const role = msg.isUser ? 'User' : 'Assistant';
        const selection = msg.selection ? `\n[Selected: ${msg.selection}]\n` : '';
        
        let content = '';
        if (Array.isArray(msg.content)) {
          // Handle multimodal content
          const textParts = msg.content.filter(part => part.type === 'text');
          const imageParts = msg.content.filter(part => part.type === 'image_url');
          content = textParts.map(part => part.text).join('\n');
          if (imageParts.length > 0) {
            content += `\n[${imageParts.length} image(s) attached]`;
          }
        } else {
          content = msg.content;
        }
        
        return `[${timestamp}] ${role}:${selection}\n${content}\n`;
      }).join('\n---\n\n');
    }
    
    return history;
  }

  /**
   * Import conversation history
   */
  async importHistory(data, format = 'json') {
    try {
      let importedHistory = [];
      
      if (format === 'json') {
        if (typeof data === 'string') {
          importedHistory = JSON.parse(data);
        } else {
          importedHistory = data;
        }
      }
      
      // Validate imported data
      if (!Array.isArray(importedHistory)) {
        throw new Error('Invalid history format');
      }
      
      // Validate each message
      const validMessages = importedHistory.filter(msg => 
        msg && 
        typeof msg === 'object' && 
        msg.content && 
        typeof msg.isUser === 'boolean'
      ).map(msg => ({
        ...msg,
        images: msg.images || [] // Ensure images array exists
      }));
      
      this.conversationHistory = validMessages;
      await this.saveConversationHistory();
      
      return true;
    } catch (error) {
      Utils.logError('ConversationManager.importHistory', error);
      return false;
    }
  }
}
