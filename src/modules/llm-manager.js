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
    
    // Both Ollama and vLLM now use OpenAI-compatible API
    return this.sendOpenAICompatibleMessage(message, conversationHistory, onChunk, onComplete, onError);
  }

  /**
   * Send message to OpenAI-compatible API (Ollama or vLLM)
   */
  async sendOpenAICompatibleMessage(message, conversationHistory, onChunk, onComplete, onError) {
    const config = this.currentConfig;
    
    console.log(`Sending to ${config.apiType.toUpperCase()} with model:`, config.model);
    
    // 현재 언어 설정 확인 및 업데이트
    const currentLang = await this.getCurrentLanguage();
    if (currentLang !== this.currentLanguage) {
      await this.updateLanguage(currentLang);
    }
    
    // Get system prompt based on current language
    const systemPrompt = this.getCurrentSystemPrompt();
    
    // 언어별 추가 강화 프롬프트
    const languageReinforcement = currentLang === 'ko' ? 
      '\n\n**이 메시지에 대한 답변은 한국어로 작성해주세요.**' :
      '\n\n**Please respond to this message in English.**';
    
    // Filter out any existing system messages from history
    const filteredHistory = conversationHistory.filter(msg => msg.role !== 'system');
    
    // Handle multimodal content (image + text) or plain text
    let userContent;
    if (Array.isArray(message)) {
      // Check if model supports multimodal
      const isMultimodalModel = this.isMultimodalModel(config.model);
      
      console.log(`Model: ${config.model}, Multimodal support: ${isMultimodalModel}`);
      
      if (isMultimodalModel) {
        console.log('Processing multimodal content for OpenAI-compatible API');
        // Use OpenAI-compatible multimodal format
        userContent = message.map(item => {
          if (item.type === 'text') {
            return { type: 'text', text: item.text + languageReinforcement };
          }
          if (item.type === 'image_url') {
            // Keep OpenAI format for compatibility
            return item;
          }
          return item; // Keep other data as is
        });
      } else {
        // Model doesn't support multimodal, extract text only
        console.warn('Model does not support multimodal input, extracting text only');
        const textParts = message.filter(item => item.type === 'text').map(item => item.text);
        userContent = textParts.join('\n') + languageReinforcement;
        
        // Add a note about the image being ignored
        if (message.some(item => item.type === 'image_url')) {
          userContent += '\n\n[참고: 이미지가 포함되었지만 현재 모델은 이미지를 지원하지 않습니다.]';
        }
      }
    } else {
      // Plain text message
      userContent = message + languageReinforcement;
    }
    
    // Prepare messages array with system prompt
    const messages = [
      { role: 'system', content: systemPrompt },
      ...filteredHistory,
      { role: 'user', content: userContent }
    ];

    console.log('Messages before validation:', messages.map(m => ({
      role: m.role,
      contentType: Array.isArray(m.content) ? 'array' : typeof m.content,
      contentPreview: Array.isArray(m.content) ? 
        `[${m.content.length} items]` : 
        String(m.content).substring(0, 50) + '...'
    })));

    // Validate message pattern
    const validatedMessages = this.validateMessagePattern(messages);
    
    console.log('Messages after validation:', validatedMessages.length);

    const requestBody = {
      model: config.model,
      messages: validatedMessages,
      stream: true,
      ...config.params
    };

    // Debug: Log the actual request being sent
    console.log(`${config.apiType.toUpperCase()} Request Body:`, JSON.stringify(requestBody, null, 2));
    console.log(`${config.apiType.toUpperCase()} Endpoint:`, config.endpoint);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // Log response details for debugging
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        
        console.error(`${config.apiType.toUpperCase()} API Error Response:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          url: config.endpoint,
          model: config.model
        });
        
        throw new Error(`${config.apiType.toUpperCase()} API Error: ${response.status} ${response.statusText}. ${errorText}`);
      }

      await this.handleStreamResponse(response, onChunk, onComplete, onError, config.apiType);
    } catch (error) {
      Utils.logError(`LLMManager.sendOpenAICompatibleMessage`, error);
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
            
            // Both Ollama and vLLM now use OpenAI-compatible format
            // when using /v1/chat/completions endpoint
            chunk = this.parseOpenAICompatibleChunk(line);

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
   * Parse OpenAI-compatible streaming chunk (used by both Ollama and vLLM)
   */
  parseOpenAICompatibleChunk(line) {
    // Handle OpenAI-style Server-Sent Events format
    if (line.startsWith('data: ')) {
      const dataStr = line.slice(6).trim();
      
      // Handle completion signal
      if (dataStr === '[DONE]') {
        return { content: '', done: true };
      }
      
      try {
        const data = JSON.parse(dataStr);
        const delta = data.choices?.[0]?.delta;
        
        return {
          content: delta?.content || '',
          done: data.choices?.[0]?.finish_reason !== null,
          model: data.model,
          id: data.id
        };
      } catch (error) {
        console.warn('Failed to parse OpenAI-compatible chunk:', dataStr);
        return null;
      }
    }
    
    // Handle direct JSON format (fallback for legacy Ollama)
    try {
      const data = JSON.parse(line);
      
      // Ollama native format
      if (data.message) {
        return {
          content: data.message?.content || '',
          done: data.done || false,
          model: data.model,
          created_at: data.created_at
        };
      }
      
      // OpenAI format
      if (data.choices) {
        const delta = data.choices[0]?.delta;
        return {
          content: delta?.content || '',
          done: data.choices[0]?.finish_reason !== null,
          model: data.model,
          id: data.id
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to parse JSON chunk:', line);
      return null;
    }
  }

  /**
   * Parse Ollama streaming chunk (legacy - kept for backward compatibility)
   */
  parseOllamaChunk(line) {
    // Now delegates to OpenAI-compatible parser
    return this.parseOpenAICompatibleChunk(line);
  }

  /**
   * Parse vLLM streaming chunk (legacy - kept for backward compatibility)
   */
  parseVLLMChunk(line) {
    // Now delegates to OpenAI-compatible parser
    return this.parseOpenAICompatibleChunk(line);
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

    try {
      for (const message of messages) {
        // Ensure message has required properties
        if (!message || !message.role || message.content === undefined) {
          console.warn('Skipping invalid message:', message);
          continue;
        }

        // Skip empty messages - handle both string and array content
        if (this.isEmptyMessage(message)) {
          console.log('Skipping empty message:', message.role);
          continue;
        }
        
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
            console.log('Merging consecutive messages of role:', message.role);
            this.mergeMessages(validatedMessages[validatedMessages.length - 1], message);
          }
          continue;
        }
        
        validatedMessages.push(message);
        lastRole = message.role;
      }

      // Filter out any messages that might have become empty after processing
      const result = validatedMessages.filter(msg => !this.isEmptyMessage(msg));
      
      // Log for debugging
      console.log('Validated message pattern:', result.map(m => ({ 
        role: m.role, 
        contentType: Array.isArray(m.content) ? 'multimodal' : 'text',
        contentLength: Array.isArray(m.content) ? m.content.length : m.content.length 
      })));
      
      return result;
    } catch (error) {
      console.error('Error in validateMessagePattern:', error);
      // Return filtered original messages as fallback
      return messages.filter(msg => msg && msg.role && msg.content !== undefined);
    }
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

  /**
   * Check if message content is empty
   * @param {Object} message - Message object
   * @returns {boolean} - Whether message is empty
   */
  isEmptyMessage(message) {
    if (!message.content) return true;
    
    // Handle string content
    if (typeof message.content === 'string') {
      return !message.content.trim();
    }
    
    // Handle array content (multimodal)
    if (Array.isArray(message.content)) {
      // Check if there's any text content that's not empty
      const hasNonEmptyText = message.content.some(item => {
        if (item.type === 'text') {
          return item.text && item.text.trim();
        }
        // Image content is never considered empty
        if (item.type === 'image') {
          return true;
        }
        return false;
      });
      return !hasNonEmptyText;
    }
    
    return true;
  }

  /**
   * Merge two messages of the same role
   * @param {Object} targetMessage - Target message to merge into
   * @param {Object} sourceMessage - Source message to merge from
   */
  mergeMessages(targetMessage, sourceMessage) {
    try {
      // Handle string content merging
      if (typeof targetMessage.content === 'string' && typeof sourceMessage.content === 'string') {
        targetMessage.content += '\n\n' + sourceMessage.content;
        return;
      }
      
      // Handle array content merging (multimodal)
      if (Array.isArray(targetMessage.content) && Array.isArray(sourceMessage.content)) {
        targetMessage.content = targetMessage.content.concat(sourceMessage.content);
        return;
      }
      
      // Handle mixed content types - convert to string
      const targetText = this.extractTextFromContent(targetMessage.content);
      const sourceText = this.extractTextFromContent(sourceMessage.content);
      targetMessage.content = targetText + '\n\n' + sourceText;
    } catch (error) {
      console.error('Error merging messages:', error);
      // Fallback: convert both to strings
      targetMessage.content = String(targetMessage.content) + '\n\n' + String(sourceMessage.content);
    }
  }

  /**
   * Extract text content from message content (string or array)
   * @param {string|Array} content - Message content
   * @returns {string} - Extracted text
   */
  extractTextFromContent(content) {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
    }
    
    return String(content);
  }

  /**
   * Check if model supports multimodal input
   * @param {string} modelName - Name of the model
   * @returns {boolean} - Whether model supports multimodal
   */
  isMultimodalModel(modelName) {
    if (!modelName) return false;
    
    const lowerModelName = modelName.toLowerCase();
    
    // Specific multimodal model names and patterns
    const multimodalKeywords = [
      'vision', 'visual', 'image', 'multimodal', 'mm',
      'llava', 'claude-3', 'gpt-4', 'gemini', 'pixtral', 'qwen2-vl',
      'minicpm-v', 'internvl', 'cogvlm', 'yi-vl', 'bakllava', 'moondream'
    ];
    
    // Special case for gemma3 (multimodal) vs gemma-2 (text-only)
    if (lowerModelName.includes('gemma')) {
      const isGemma3 = lowerModelName.includes('gemma3') || 
                       lowerModelName.includes('gemma-3') ||
                       lowerModelName.match(/gemma[_-]?3/);
      console.log(`Checking Gemma variant: ${modelName} -> Gemma3: ${isGemma3}`);
      return isGemma3;
    }
    
    // Check for multimodal keywords
    const hasMultimodalKeyword = multimodalKeywords.some(keyword => 
      lowerModelName.includes(keyword)
    );
    
    console.log(`Checking multimodal support for model: ${modelName} -> ${hasMultimodalKeyword}`);
    return hasMultimodalKeyword;
  }

  /**
   * Validate Ollama API request
   * @param {Object} requestBody - Request body to validate
   * @returns {Object} - Validation result
   */
  validateOllamaRequest(requestBody) {
    try {
      // Check required fields
      if (!requestBody.model) {
        return { isValid: false, error: 'Model is required' };
      }
      
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        return { isValid: false, error: 'Messages array is required' };
      }
      
      if (requestBody.messages.length === 0) {
        return { isValid: false, error: 'At least one message is required' };
      }
      
      // Validate each message
      for (let i = 0; i < requestBody.messages.length; i++) {
        const msg = requestBody.messages[i];
        
        if (!msg.role) {
          return { isValid: false, error: `Message ${i} missing role` };
        }
        
        if (!['system', 'user', 'assistant'].includes(msg.role)) {
          return { isValid: false, error: `Message ${i} has invalid role: ${msg.role}` };
        }
        
        if (msg.content === undefined || msg.content === null) {
          return { isValid: false, error: `Message ${i} missing content` };
        }
        
        // Validate multimodal content
        if (Array.isArray(msg.content)) {
          for (let j = 0; j < msg.content.length; j++) {
            const item = msg.content[j];
            if (!item.type) {
              return { isValid: false, error: `Message ${i}, content item ${j} missing type` };
            }
            
            if (item.type === 'text' && !item.text) {
              return { isValid: false, error: `Message ${i}, content item ${j} missing text` };
            }
            
            if (item.type === 'image' && !item.image) {
              return { isValid: false, error: `Message ${i}, content item ${j} missing image data` };
            }
          }
        }
      }
      
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Validation error: ${error.message}` };
    }
  }
}
