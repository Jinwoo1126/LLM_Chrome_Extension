// LLM API management module
import { APP_CONSTANTS } from '../constants/app-constants.js';
import { Utils } from '../utils/general-utils.js';
import { apiConfig } from '../../config.js';
import { getSystemPrompt } from '../constants/app-constants.js';

export class LLMManager {
  constructor() {
    this.currentConfig = null;
    this.isInitialized = false;
    this.currentLanguage = 'ko'; // Default language
    this.cachedSystemPrompt = null; // 캐시된 시스템 프롬프트
  }

  /**
   * Initialize LLM manager
   */
  async initialize() {
    try {
      this.currentConfig = await apiConfig.getConfig();
      this.currentLanguage = await this.getCurrentLanguage();
      this.cachedSystemPrompt = getSystemPrompt(this.currentLanguage); // 초기 시스템 프롬프트 캐시
      this.isInitialized = true;
    } catch (error) {
      Utils.logError('LLMManager.initialize', error);
      throw new Error('Failed to initialize LLM manager');
    }
  }

  /**
   * Get current language setting
   */
  async getCurrentLanguage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lang'], (result) => {
        resolve(result.lang || 'ko');
      });
    });
  }

  /**
   * Send message to LLM with streaming support
   * @param {string} message - Message to send
   * @param {Array} conversationHistory - Previous conversation history
   * @param {Function} onChunk - Callback for streaming chunks
   * @param {Function} onComplete - Callback when complete
   * @param {Function} onError - Callback on error
   */
  async sendMessage(message, conversationHistory = [], onChunk = null, onComplete = null, onError = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Update language setting
    this.currentLanguage = await this.getCurrentLanguage();

    const apiType = this.currentConfig.apiType;
    
    if (apiType === 'ollama') {
      return this.sendOllamaMessage(message, conversationHistory, onChunk, onComplete, onError);
    } else if (apiType === 'vllm') {
      return this.sendVLLMMessage(message, conversationHistory, onChunk, onComplete, onError);
    } else {
      throw new Error(`Unsupported API type: ${apiType}`);
    }
  }

  /**
   * Send message to Ollama API
   */
  async sendOllamaMessage(message, conversationHistory, onChunk, onComplete, onError) {
    const config = this.currentConfig;
    
    // 현재 언어 설정 확인 및 업데이트
    const currentLang = await this.getCurrentLanguage();
    if (currentLang !== this.currentLanguage) {
      await this.updateLanguage(currentLang);
    }
    
    // Get system prompt based on current language
    const systemPrompt = this.getCurrentSystemPrompt();
    
    // 언어별 추가 강화 프롬프트
    const languageReinforcement = currentLang === 'ko' ? 
      '\n\n**다시 한 번 강조: 이 메시지에 대한 답변은 반드시 한국어로 작성해주세요.**' :
      '\n\n**Reminder: Please respond to this message in English.**';
    
    // Filter out any existing system messages from history
    const filteredHistory = conversationHistory.filter(msg => msg.role !== 'system');
    
    // 사용자 메시지에 언어 지침 추가
    const enhancedMessage = message + languageReinforcement;
    
    // Prepare messages array with system prompt
    const messages = [
      { role: 'system', content: systemPrompt },
      ...filteredHistory,
      { role: 'user', content: enhancedMessage }
    ];

    // Validate message pattern
    const validatedMessages = this.validateMessagePattern(messages);

    const requestBody = {
      model: config.model,
      messages: validatedMessages,
      stream: true,
      ...config.params
    };

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await this.handleStreamResponse(response, onChunk, onComplete, onError, 'ollama');
    } catch (error) {
      Utils.logError('LLMManager.sendOllamaMessage', error);
      if (onError) onError(error);
      throw error;
    }
  }

  /**
   * Send message to vLLM API
   */
  async sendVLLMMessage(message, conversationHistory, onChunk, onComplete, onError) {
    const config = this.currentConfig;
    
    // 현재 언어 설정 확인 및 업데이트
    const currentLang = await this.getCurrentLanguage();
    if (currentLang !== this.currentLanguage) {
      await this.updateLanguage(currentLang);
    }
    
    // Get system prompt based on current language
    const systemPrompt = this.getCurrentSystemPrompt();
    
    // 언어별 추가 강화 프롬프트
    const languageReinforcement = currentLang === 'ko' ? 
      '\n\n**다시 한 번 강조: 이 메시지에 대한 답변은 반드시 한국어로만 작성해주세요. 영어나 다른 언어는 절대 사용하지 마세요.**' :
      '\n\n**Reminder: Please respond to this message only in English. Do not use Korean or other languages.**';
    
    // Filter out any existing system messages from history
    const filteredHistory = conversationHistory.filter(msg => msg.role !== 'system');
    
    // 사용자 메시지에 언어 지침 추가
    const enhancedMessage = message + languageReinforcement;
    
    // Prepare messages array for vLLM with system prompt
    const messages = [
      { role: 'system', content: systemPrompt },
      ...filteredHistory,
      { role: 'user', content: enhancedMessage }
    ];

    // Validate message pattern
    const validatedMessages = this.validateMessagePattern(messages);

    const requestBody = {
      model: config.model,
      messages: validatedMessages,
      stream: true,
      ...config.params
    };

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await this.handleStreamResponse(response, onChunk, onComplete, onError, 'vllm');
    } catch (error) {
      Utils.logError('LLMManager.sendVLLMMessage', error);
      if (onError) onError(error);
      throw error;
    }
  }

  /**
   * Handle streaming response
   */
  async handleStreamResponse(response, onChunk, onComplete, onError, apiType) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            let chunk;
            
            if (apiType === 'ollama') {
              chunk = this.parseOllamaChunk(line);
            } else if (apiType === 'vllm') {
              chunk = this.parseVLLMChunk(line);
            }

            if (chunk && chunk.content) {
              fullResponse += chunk.content;
              if (onChunk) onChunk(chunk.content);
            }

            if (chunk && chunk.done) {
              break;
            }
          } catch (parseError) {
            Utils.logError('LLMManager.handleStreamResponse.parse', parseError, { line });
            continue;
          }
        }
      }

      if (onComplete) onComplete(fullResponse);
    } catch (error) {
      Utils.logError('LLMManager.handleStreamResponse', error);
      if (onError) onError(error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse Ollama streaming chunk
   */
  parseOllamaChunk(line) {
    const data = JSON.parse(line);
    
    return {
      content: data.message?.content || '',
      done: data.done || false,
      model: data.model,
      created_at: data.created_at
    };
  }

  /**
   * Parse vLLM streaming chunk
   */
  parseVLLMChunk(line) {
    if (!line.startsWith('data: ')) return null;
    
    const dataStr = line.slice(6);
    if (dataStr === '[DONE]') {
      return { content: '', done: true };
    }

    const data = JSON.parse(dataStr);
    const delta = data.choices?.[0]?.delta;
    
    return {
      content: delta?.content || '',
      done: data.choices?.[0]?.finish_reason !== null,
      model: data.model,
      id: data.id
    };
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return apiConfig.getAvailableModels(this.currentConfig.apiType);
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig) {
    try {
      await apiConfig.saveConfig(newConfig);
      this.currentConfig = await apiConfig.getConfig();
    } catch (error) {
      Utils.logError('LLMManager.updateConfig', error);
      throw error;
    }
  }

  /**
   * Test connection to API
   */
  async testConnection() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const testMessage = 'Hello, this is a connection test.';
      let responseReceived = false;

      await this.sendMessage(
        testMessage,
        [],
        (chunk) => {
          if (chunk.trim()) {
            responseReceived = true;
          }
        },
        (fullResponse) => {
          responseReceived = responseReceived || fullResponse.trim().length > 0;
        },
        (error) => {
          throw error;
        }
      );

      return responseReceived;
    } catch (error) {
      Utils.logError('LLMManager.testConnection', error);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getCurrentConfig() {
    return this.currentConfig ? { ...this.currentConfig } : null;
  }

  /**
   * Validate configuration
   */
  validateConfig(config) {
    const errors = [];

    if (!config.apiType) {
      errors.push('API type is required');
    }

    if (!config.model) {
      errors.push('Model is required');
    }

    if (!config.endpoint || !Utils.isValidUrl(config.endpoint)) {
      errors.push('Valid endpoint URL is required');
    }

    if (config.apiType === 'vllm' && !config.apiKey) {
      errors.push('API key is required for vLLM');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get API status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      currentModel: this.currentConfig?.model,
      currentApiType: this.currentConfig?.apiType,
      endpoint: this.currentConfig?.endpoint
    };
  }

  /**
   * Estimate token count (rough estimation)
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token for English
    // This is very approximate and varies by model and language
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if message is too long
   */
  isMessageTooLong(message, maxTokens = 4000) {
    const estimatedTokens = this.estimateTokens(message);
    return estimatedTokens > maxTokens;
  }

  /**
   * Truncate message if too long
   */
  truncateMessage(message, maxTokens = 4000) {
    if (!this.isMessageTooLong(message, maxTokens)) {
      return message;
    }

    const maxChars = maxTokens * 4; // Rough estimation
    return message.substring(0, maxChars) + '...\n[Message truncated due to length]';
  }

  /**
   * Validate message pattern to ensure proper alternating roles
   * @param {Array} messages - Array of messages to validate
   * @returns {Array} - Validated messages array
   */
  validateMessagePattern(messages) {
    const validatedMessages = [];
    let lastRole = null;

    for (const message of messages) {
      // Skip empty messages
      if (!message.content || !message.content.trim()) continue;
      
      // System messages are always allowed
      if (message.role === 'system') {
        validatedMessages.push(message);
        lastRole = 'system';
        continue;
      }
      
      // For user/assistant messages, ensure alternating pattern
      if (lastRole === message.role && message.role !== 'system') {
        // Merge with previous message of same role
        if (validatedMessages.length > 0 && validatedMessages[validatedMessages.length - 1].role === message.role) {
          validatedMessages[validatedMessages.length - 1].content += '\n\n' + message.content;
        }
        continue;
      }
      
      validatedMessages.push(message);
      lastRole = message.role;
    }

    // Ensure proper pattern: system should be first (if exists), then alternating user/assistant
    // and should end with user message
    const result = validatedMessages.filter(msg => msg.content.trim());
    
    // Log for debugging
    console.log('Validated message pattern:', result.map(m => ({ role: m.role, contentLength: m.content.length })));
    
    return result;
  }

  /**
   * Update language and refresh system prompt
   * @param {string} newLanguage - New language code
   */
  async updateLanguage(newLanguage) {
    if (this.currentLanguage !== newLanguage) {
      this.currentLanguage = newLanguage;
      this.cachedSystemPrompt = getSystemPrompt(newLanguage);
      
      // 언어 설정을 스토리지에 저장
      await new Promise((resolve) => {
        chrome.storage.local.set({ lang: newLanguage }, resolve);
      });
      
      console.log(`Language updated to: ${newLanguage}`);
    }
  }

  /**
   * Get current system prompt (cached or fresh)
   */
  getCurrentSystemPrompt() {
    if (!this.cachedSystemPrompt) {
      this.cachedSystemPrompt = getSystemPrompt(this.currentLanguage);
    }
    return this.cachedSystemPrompt;
  }
}
