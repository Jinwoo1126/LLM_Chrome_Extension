// Application constants
export const APP_CONSTANTS = {
  // UI Constants
  MAX_HISTORY_TURNS: 5,
  SELECTION_DEBOUNCE_DELAY: 500,
  SELECTION_THROTTLE_LIMIT: 1000,
  MAX_SELECTION_PREVIEW_LENGTH: 500,
  INPUT_AUTO_RESIZE_MAX_HEIGHT: 120,

  // Storage Keys
  STORAGE_KEYS: {
    API_TYPE: 'apiType',
    MODEL: 'model',
    API_KEY: 'apiKey',
    CONVERSATION_HISTORY: 'conversationHistory',
    CONTEXT_ACTION: 'contextAction',
    CONTEXT_SELECTION: 'contextSelection',
    ACTIVE_TAB_ID: 'activeTabId',
    ACTION_PROCESSED: 'actionProcessed'
  },

  // Message Types
  MESSAGE_TYPES: {
    CONTENT_SCRIPT_READY: 'contentScriptReady',
    SELECTION_CHANGED: 'selectionChanged',
    GET_CURRENT_PAGE_INFO: 'getCurrentPageInfo',
    GET_SELECTED_TEXT: 'getSelectedText',
    CLEAR_SELECTION: 'clearSelection',
    CHECK_CONTEXT_ACTION: 'checkContextAction',
    GET_PAGE_INFO: 'getPageInfo'
  },

  // Context Menu IDs
  CONTEXT_MENU_IDS: {
    LLM_EXTENSION: 'llm-extension',
    ASK_ABOUT_SELECTION: 'ask-about-selection',
    OPEN_IN_SIDE_PANEL: 'open-in-side-panel',
    SUMMARIZE_IN_SIDE_PANEL: 'summarize-in-side-panel',
    TRANSLATE_IN_SIDE_PANEL: 'translate-in-side-panel'
  },

  // Action Types
  ACTION_TYPES: {
    SELECTION: 'selection',
    SUMMARIZE: 'summarize',
    TRANSLATE: 'translate'
  },

  // UI Modes
  UI_MODES: {
    POPUP: 'popup-mode',
    SIDE_PANEL: 'side-panel-mode'
  },

  // CSS Classes
  CSS_CLASSES: {
    HIDDEN: 'hidden',
    COLLAPSED: 'collapsed',
    SELECTION_STORED: 'selection-stored',
    FADE_IN: 'fadeIn'
  },

  // Default Messages
  DEFAULT_MESSAGES: {
    SUMMARIZATION_PROMPT: '다음 텍스트를 간결하고 핵심적인 내용으로 요약해주세요:\n\n',
    TRANSLATION_PROMPT: '다음 텍스트를 자연스러운 한국어로 번역해주세요:\n\n',
    ERROR_LIBRARY_NOT_LOADED: 'Error: Required library not loaded. Please refresh the page.',
    ERROR_NO_SELECTION: 'No text selected. Please select some text first.',
    ERROR_SENDING_MESSAGE: 'Error sending message. Please try again.',
    ERROR_LOADING_MODELS: 'Error loading models. Please check your connection.'
  }
};
