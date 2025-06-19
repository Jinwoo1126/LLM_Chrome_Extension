/**
 * @fileoverview Type definitions for LLM Chrome Extension
 * This file provides JSDoc type definitions for better IDE support and documentation.
 */

/**
 * @typedef {Object} AppConfig
 * @property {string} apiType - The API type ('vllm' or 'ollama')
 * @property {string} model - The model name
 * @property {string} apiKey - The API key
 * @property {string} apiBase - The API base URL
 * @property {string} endpoint - The API endpoint
 * @property {Object} params - API parameters
 */

/**
 * @typedef {Object} ConversationMessage
 * @property {string} id - Unique message ID
 * @property {string} content - Message content
 * @property {boolean} isUser - Whether the message is from user
 * @property {string} timestamp - ISO timestamp
 * @property {string} [selection] - Selected text context
 * @property {string} [updatedAt] - Update timestamp
 */

/**
 * @typedef {Object} SelectionInfo
 * @property {string} text - Selected text
 * @property {boolean} isStored - Whether selection is stored
 * @property {boolean} isMode - Whether in selection mode
 * @property {number} wordCount - Word count of selection
 * @property {number} charCount - Character count of selection
 * @property {number} readingTime - Estimated reading time in minutes
 */

/**
 * @typedef {Object} PageInfo
 * @property {string} title - Page title
 * @property {string} url - Page URL
 * @property {string} description - Page description
 * @property {string} selectedText - Currently selected text
 * @property {string} mainContent - Main page content
 * @property {boolean} hasSelection - Whether there is selected text
 */

/**
 * @typedef {Object} UIElements
 * @property {HTMLElement} chatMessages - Chat messages container
 * @property {HTMLTextAreaElement} userInput - User input field
 * @property {HTMLButtonElement} sendButton - Send button
 * @property {HTMLSelectElement} modelSelect - Model selector
 * @property {HTMLElement} selectionInfo - Selection info container
 * @property {HTMLElement} selectionPreview - Selection preview element
 * @property {HTMLElement} selectionHeader - Selection header
 * @property {HTMLElement} selectionContent - Selection content
 * @property {HTMLElement} selectionHeaderIcon - Selection header icon
 * @property {HTMLButtonElement} useSelectionButton - Use selection button
 * @property {HTMLButtonElement} resetSelectionButton - Reset selection button
 * @property {HTMLButtonElement} summarizeButton - Summarize button
 * @property {HTMLButtonElement} translateButton - Translate button
 */

/**
 * @typedef {Object} ErrorInfo
 * @property {string} type - Error type
 * @property {string} message - Error message
 * @property {string} [stack] - Error stack trace
 * @property {string} context - Error context
 * @property {string} timestamp - ISO timestamp
 * @property {string} url - Page URL where error occurred
 * @property {string} [filename] - File where error occurred
 * @property {number} [lineno] - Line number where error occurred
 * @property {number} [colno] - Column number where error occurred
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string} id - Model ID
 * @property {string} name - Model display name
 * @property {Object} [params] - Model-specific parameters
 */

/**
 * @typedef {Object} StreamChunk
 * @property {string} content - Chunk content
 * @property {boolean} done - Whether streaming is complete
 * @property {string} [model] - Model name
 * @property {string} [id] - Request ID
 * @property {string} [created_at] - Creation timestamp
 */

/**
 * @typedef {Object} LLMResponse
 * @property {string} content - Full response content
 * @property {string} model - Model name
 * @property {boolean} success - Whether request was successful
 * @property {number} [tokens] - Token count
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} ConversationStats
 * @property {number} totalMessages - Total number of messages
 * @property {number} userMessages - Number of user messages
 * @property {number} assistantMessages - Number of assistant messages
 * @property {number} totalWords - Total word count
 * @property {number} averageWordsPerMessage - Average words per message
 */

/**
 * @typedef {Object} UIStats
 * @property {number} totalMessages - Total messages in UI
 * @property {number} userMessages - User messages in UI
 * @property {number} assistantMessages - Assistant messages in UI
 * @property {string} currentMode - Current UI mode
 * @property {boolean} hasSelection - Whether selection is visible
 */

/**
 * @typedef {Object} AppStatus
 * @property {boolean} isInitialized - Whether app is initialized
 * @property {boolean} isSendingMessage - Whether currently sending message
 * @property {UIStats} ui - UI statistics
 * @property {ConversationStats} conversation - Conversation statistics
 * @property {SelectionInfo} selection - Selection information
 * @property {Object} llm - LLM manager status
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {boolean} isEmpty - Whether input is empty
 * @property {boolean} isTooLong - Whether input is too long
 * @property {number} wordCount - Word count
 * @property {number} charCount - Character count
 * @property {string[]} warnings - Validation warnings
 */

/**
 * @typedef {Object} ContextActionInfo
 * @property {boolean} hasAction - Whether there is a context action
 * @property {string} [action] - Action type
 * @property {string} [selection] - Selected text
 */

/**
 * @typedef {function(string): void} ChunkCallback
 * @param {string} chunk - Content chunk from streaming response
 */

/**
 * @typedef {function(string): void} CompleteCallback
 * @param {string} fullResponse - Complete response content
 */

/**
 * @typedef {function(Error): void} ErrorCallback
 * @param {Error} error - Error that occurred
 */

/**
 * @typedef {Object} CustomEventDetail
 * @property {string} [message] - Message content
 * @property {string} [model] - Model name
 * @property {string} [action] - Action type
 * @property {string} [prompt] - Prompt text
 * @property {string} [selection] - Selected text
 * @property {boolean} [isStored] - Whether selection is stored
 */

// Export type definitions for module systems that support it
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}
