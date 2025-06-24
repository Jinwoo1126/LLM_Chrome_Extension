// Main application class
import { APP_CONSTANTS } from './constants/app-constants.js';
import { UIManager } from './modules/ui-manager.js';
import { ConversationManager } from './modules/conversation-manager.js';
import { SelectionManager } from './modules/selection-manager.js';
import { LLMManager } from './modules/llm-manager.js';
import { Utils } from './utils/general-utils.js';

export class LLMChatApp {
  constructor() {
    this.uiManager = new UIManager();
    this.conversationManager = new ConversationManager();
    this.selectionManager = new SelectionManager();
    this.llmManager = new LLMManager();
    
    this.isInitialized = false;
    this.isSendingMessage = false;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      console.log('Initializing LLM Chat Extension...');

      // Initialize managers in order
      await this.initializeManagers();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Load initial data
      await this.loadInitialData();
      
      this.isInitialized = true;
      console.log('LLM Chat Extension initialized successfully');
      
    } catch (error) {
      Utils.logError('LLMChatApp.initialize', error);
      this.uiManager.showError('Failed to initialize application. Please refresh the page.');
      throw error;
    }
  }

  /**
   * Initialize all managers
   */
  async initializeManagers() {
    // Initialize UI manager first
    this.uiManager.initialize();
    
    // Initialize other managers
    await this.conversationManager.initialize();
    await this.llmManager.initialize();
    
    // Initialize selection manager with UI elements
    this.selectionManager.initialize(this.uiManager.getElements());
  }

  /**
   * Setup event listeners for inter-module communication
   */
  setupEventListeners() {
    // UI events
    document.addEventListener('ui:sendMessage', this.handleSendMessage.bind(this));
    document.addEventListener('ui:modelChanged', this.handleModelChanged.bind(this));
    document.addEventListener('ui:clearHistory', this.handleClearHistory.bind(this));
    document.addEventListener('ui:languageChanged', this.handleLanguageChanged.bind(this)); // 새로 추가

    // Selection events
    document.addEventListener('selection:selectionStored', this.handleSelectionStored.bind(this));
    document.addEventListener('selection:selectionReset', this.handleSelectionReset.bind(this));
    // NOTE: Disabled selection:actionRequested to prevent duplicate calls - popup.js handles directly
    // document.addEventListener('selection:actionRequested', this.handleSelectionAction.bind(this));

    // Window events
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    window.addEventListener('error', this.handleGlobalError.bind(this));
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      // Load available models and initialize model selector
      const models = await this.llmManager.getAvailableModels();
      const currentConfig = this.llmManager.getCurrentConfig();
      
      this.uiManager.initializeModelSelector(models, currentConfig?.model);
      this.uiManager.addClearHistoryButton();

      // Load and display conversation history
      await this.loadConversationHistory();
      
    } catch (error) {
      Utils.logError('LLMChatApp.loadInitialData', error);
      this.uiManager.showError(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_LOADING_MODELS);
    }
  }

  /**
   * Load and display conversation history
   */
  async loadConversationHistory() {
    const history = this.conversationManager.getHistory();
    
    history.forEach(msg => {
      this.uiManager.addMessage(msg.content, msg.isUser, msg.selection);
    });
  }

  /**
   * Handle send message event
   */
  async handleSendMessage(event) {
    const { message } = event.detail;

    if (this.isSendingMessage || !message.trim()) {
      return;
    }

    try {
      this.isSendingMessage = true;
      this.uiManager.setSendButtonState(false);

      // Get the most current selection (this will automatically refresh if needed)
      console.log('Getting current selection for message...');
      const currentSelection = await this.selectionManager.getSelection();
      console.log('Current selection:', currentSelection);
      
      // Add user message to conversation and UI (without system prompt)
      this.conversationManager.addMessage(message, true, currentSelection);
      this.uiManager.addMessage(message, true, currentSelection);
      this.uiManager.clearInput();

      // Send to LLM (system prompt will be added by LLM manager)
      await this.sendToLLM(message, currentSelection);

    } catch (error) {
      // ...existing error handling...
      Utils.logError && Utils.logError('LLMChatApp.handleSendMessage', error);
      this.uiManager.showError && this.uiManager.showError(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_SENDING_MESSAGE);
    } finally {
      this.isSendingMessage = false;
      this.uiManager.setSendButtonState(true);
      this.uiManager.focusInput && this.uiManager.focusInput();
    }
  }

  /**
   * Send message to LLM (public method for direct use)
   * @param {string} message - Message to send
   * @param {boolean} addToUI - Whether to add user message to UI
   * @returns {Promise<string>} - Assistant response
   */
  async sendMessage(message, addToUI = true) {
    if (this.isSendingMessage || !message.trim()) {
      return '';
    }

    try {
      this.isSendingMessage = true;
      this.uiManager.setSendButtonState(false);

      const currentSelection = await this.selectionManager.getSelection();
      
      // Add user message to conversation and optionally to UI
      this.conversationManager.addMessage(message, true, currentSelection);
      if (addToUI) {
        this.uiManager.addMessage(message, true, currentSelection);
        this.uiManager.clearInput();
      }

      // Send to LLM - this will handle assistant response UI
      await this.sendToLLM(message, currentSelection);

    } catch (error) {
      Utils.logError && Utils.logError('LLMChatApp.sendMessage', error);
      this.uiManager.showError && this.uiManager.showError(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_SENDING_MESSAGE);
      throw error;
    } finally {
      this.isSendingMessage = false;
      this.uiManager.setSendButtonState(true);
      this.uiManager.focusInput && this.uiManager.focusInput();
    }
  }

  /**
   * Send message to LLM without adding user message to UI (for custom messages)
   * UI는 caller에서 이미 처리된 상태이므로 conversation history와 LLM 처리만 수행
   * @param {string} displayMessage - Message to show in conversation history
   * @param {string} actualMessage - Actual message to send to LLM
   * @returns {Promise<void>}
   */
  async sendMessageRaw(displayMessage, actualMessage) {
    if (this.isSendingMessage || !actualMessage.trim()) {
      return;
    }

    try {
      this.isSendingMessage = true;
      this.uiManager.setSendButtonState(false);

      const currentSelection = await this.selectionManager.getSelection();
      
      // Add display message to conversation history (not the full prompt)
      // UI는 caller에서 이미 추가되었으므로 여기서는 conversation history에만 추가
      this.conversationManager.addMessage(displayMessage, true, currentSelection);

      // Send actual message to LLM - actualMessage already contains the full prompt
      // so we don't need to add selection again
      await this.sendToLLM(actualMessage, '');

    } catch (error) {
      Utils.logError && Utils.logError('LLMChatApp.sendMessageRaw', error);
      this.uiManager.showError && this.uiManager.showError(APP_CONSTANTS.DEFAULT_MESSAGES.ERROR_SENDING_MESSAGE);
      throw error;
    } finally {
      this.isSendingMessage = false;
      this.uiManager.setSendButtonState(true);
      this.uiManager.focusInput && this.uiManager.focusInput();
    }
  }

  /**
   * Send message to LLM
   */
  async sendToLLM(message, selection = '') {
    console.log('--- sendToLLM called ---');
    console.log('Original message:', message);
    console.log('Selection:', selection);

    const loadingElement = this.uiManager.showLoading();
    let assistantMessage = '';
    let messageElement = null;

    try {
      const conversationHistory = this.conversationManager.getFormattedHistory();

      // 선택된 텍스트가 있으면 메시지에 포함
      let messageToSend = message;
      if (selection && selection.trim()) {
        messageToSend = `${message}\n\n[Selected text context]:\n${selection}`;
      }
      console.log('Message to send to LLM:', messageToSend);

      await this.llmManager.sendMessage(
        messageToSend,
        conversationHistory.slice(0, -1), // Exclude the current message
        
        // onChunk callback
        (chunk) => {
          assistantMessage += chunk;
          
          if (!messageElement) {
            this.uiManager.hideLoading();
            messageElement = this.uiManager.addMessage(assistantMessage, false);
          } else {
            this.uiManager.updateMessageContent(messageElement, assistantMessage);
          }
        },
        
        // onComplete callback
        (fullResponse) => {
          assistantMessage = fullResponse;
          this.conversationManager.addMessage(assistantMessage, false);
          
          if (messageElement) {
            this.uiManager.updateMessageContent(messageElement, assistantMessage);
          }
          
          // Reset selection mode after successful response
          this.selectionManager.setSelectionMode(false);
        },
        
        // onError callback
        (error) => {
          throw error;
        }
      );

    } catch (error) {
      this.uiManager.hideLoading();
      if (messageElement) {
        messageElement.remove();
      }
      throw error;
    }
  }

  /**
   * Handle model changed event
   */
  async handleModelChanged(event) {
    const { model } = event.detail;
    
    try {
      const currentConfig = this.llmManager.getCurrentConfig();
      const newConfig = { ...currentConfig, model };
      
      await this.llmManager.updateConfig(newConfig);
      this.uiManager.showSuccess(`Model changed to ${model}`);
      
    } catch (error) {
      Utils.logError('LLMChatApp.handleModelChanged', error);
      this.uiManager.showError('Failed to change model');
    }
  }

  /**
   * Handle clear history event
   */
  async handleClearHistory(event) {
    try {
      await this.conversationManager.clearHistory();
      this.uiManager.clearMessages();
      this.uiManager.showSuccess('Conversation history cleared');
      
    } catch (error) {
      Utils.logError('LLMChatApp.handleClearHistory', error);
      this.uiManager.showError('Failed to clear history');
    }
  }

  /**
   * Handle selection stored event
   */
  handleSelectionStored(event) {
    const { selection, isStored } = event.detail;
    
    this.uiManager.updateState({
      selectionStored: isStored,
      hasSelection: !!selection
    });
  }

  /**
   * Handle selection reset event
   */
  handleSelectionReset(event) {
    this.uiManager.updateState({
      selectionStored: false,
      hasSelection: false
    });
  }

  /**
   * Handle selection action event (summarize, translate)
   */
  async handleSelectionAction(event) {
    const { action, prompt, selection } = event.detail;
    
    try {
      // Add the action message to conversation (with full prompt for LLM)
      this.conversationManager.addMessage(prompt, true, selection);
      
      // UI에는 간단한 메시지만 표시
      const actionText = action === 'summarize' ? '📝 요약 요청' : '🌐 번역 요청';
      this.uiManager.addMessage(actionText, true, selection);
      
      // Send to LLM
      await this.sendToLLM(prompt);
      
    } catch (error) {
      Utils.logError('LLMChatApp.handleSelectionAction', error);
      this.uiManager.showError(`Failed to ${action} selection`);
    }
  }

  /**
   * Handle before unload event
   */
  handleBeforeUnload() {
    // Perform any cleanup if needed
    console.log('LLM Chat Extension is being unloaded');
  }

  /**
   * Handle global errors
   */
  handleGlobalError(event) {
    Utils.logError('Global', event.error || new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isSendingMessage: this.isSendingMessage,
      ui: this.uiManager.getStatistics(),
      conversation: this.conversationManager.getStats(),
      selection: this.selectionManager.getSelectionInfo(),
      llm: this.llmManager.getStatus()
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      this.uiManager.showNotification('Testing API connection...', 'info');
      const isConnected = await this.llmManager.testConnection();
      
      if (isConnected) {
        this.uiManager.showNotification('API connection successful!', 'success');
      } else {
        this.uiManager.showNotification('API connection failed', 'error');
      }
      
      return isConnected;
    } catch (error) {
      Utils.logError('LLMChatApp.testConnection', error);
      this.uiManager.showNotification('API connection error', 'error');
      return false;
    }
  }

  /**
   * Export conversation
   */
  exportConversation(format = 'json') {
    return this.conversationManager.exportHistory(format);
  }

  /**
   * Import conversation
   */
  async importConversation(data, format = 'json') {
    try {
      const success = await this.conversationManager.importHistory(data, format);
      
      if (success) {
        this.uiManager.clearMessages();
        await this.loadConversationHistory();
        this.uiManager.showSuccess('Conversation imported successfully');
      } else {
        this.uiManager.showError('Failed to import conversation');
      }
      
      return success;
    } catch (error) {
      Utils.logError('LLMChatApp.importConversation', error);
      this.uiManager.showError('Failed to import conversation');
      return false;
    }
  }

  /**
   * Restart application
   */
  async restart() {
    try {
      this.isInitialized = false;
      await this.initialize();
      this.uiManager.showSuccess('Application restarted successfully');
    } catch (error) {
      Utils.logError('LLMChatApp.restart', error);
      this.uiManager.showError('Failed to restart application');
    }
  }

  /**
   * Handle language changed event
   */
  async handleLanguageChanged(event) {
    const { language } = event.detail;
    
    try {
      await this.llmManager.updateLanguage(language);
      this.uiManager.showSuccess(`Language changed to ${language === 'ko' ? '한국어' : 'English'}`);
    } catch (error) {
      Utils.logError('LLMChatApp.handleLanguageChanged', error);
      this.uiManager.showError('Failed to change language');
    }
  }
}
