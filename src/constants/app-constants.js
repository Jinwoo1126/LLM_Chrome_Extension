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
    LANGUAGE: 'lang',
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

  // Language-specific messages
  MESSAGES: {
    ko: {
      SUMMARIZATION_PROMPT: '다음 텍스트를 간결하고 핵심적인 내용으로 요약해주세요:\n\n',
      TRANSLATION_PROMPT: '다음 텍스트를 자연스러운 한국어로 번역해주세요:\n\n',
      ERROR_LIBRARY_NOT_LOADED: '오류: 필요한 라이브러리가 로드되지 않았습니다. 페이지를 새로고침해주세요.',
      ERROR_NO_SELECTION: '선택된 텍스트가 없습니다. 먼저 텍스트를 선택해주세요.',
      ERROR_SENDING_MESSAGE: '메시지 전송 중 오류가 발생했습니다. 다시 시도해주세요.',
      ERROR_LOADING_MODELS: '모델 로딩 중 오류가 발생했습니다. 연결을 확인해주세요.',
      SETTINGS_SAVED: '설정이 저장되었습니다.',
      SYSTEM_PROMPT: `당신은 도움이 되는 AI 어시스턴트입니다. 

**중요한 언어 지침 - 반드시 준수:**
- 사용자의 입력이 어떤 언어든 상관없이 반드시 한국어로만 답변하세요
- 영어 텍스트나 다른 언어가 포함되어 있어도 무조건 한국어로 응답하세요
- 코드나 기술 용어는 영어 그대로 사용하되, 설명은 반드시 한국어로 하세요
- 번역 요청이 아닌 이상, 모든 답변과 설명은 한국어로 작성하세요

**답변 가이드라인:**
- 명확하고 이해하기 쉽게 한국어로 설명해주세요
- 필요한 경우 예시를 포함해주세요
- 사용자가 선택한 텍스트가 있다면 그 내용을 참고하여 한국어로 답변해주세요
- 전문 용어는 원어로 설명해 주세요.

**금지사항:**
- 영어나 다른 언어로 답변하지 마세요
- 답변의 시작을 영어로 하지 마세요

예시: 영어 질문 "What is JavaScript?" → "JavaScript는 웹 개발에서 사용되는 프로그래밍 언어입니다..."로 한국어로 답변`
    },
    en: {
      SUMMARIZATION_PROMPT: 'Please provide a concise and essential summary of the following text:\n\n',
      TRANSLATION_PROMPT: 'Please translate the following text into natural English:\n\n',
      ERROR_LIBRARY_NOT_LOADED: 'Error: Required library not loaded. Please refresh the page.',
      ERROR_NO_SELECTION: 'No text selected. Please select some text first.',
      ERROR_SENDING_MESSAGE: 'Error sending message. Please try again.',
      ERROR_LOADING_MODELS: 'Error loading models. Please check your connection.',
      SETTINGS_SAVED: 'Settings saved successfully.',
      SYSTEM_PROMPT: `You are a helpful AI assistant.

**Important Language Guidelines - Must Follow:**
- Always respond in English regardless of the input language
- Even if Korean text or other languages are included, respond only in English
- Use technical terms as they are, but provide explanations in English
- Unless specifically asked for translation, all responses and explanations should be in English

**Response Guidelines:**
- Explain clearly and in an easy-to-understand manner in English
- Include examples when necessary (explain examples in English too)
- If the user has selected text, refer to that content in your English response
- Explain technical terms in English, and include original terms in parentheses if needed

**Strictly Prohibited:**
- Do not respond in Korean or other languages
- Do not start responses in Korean

Example: Korean question "JavaScript가 뭐야?" → "JavaScript is a programming language used in web development..." (respond in English)`
    }
  },

  // Default Messages (fallback)
  DEFAULT_MESSAGES: {
    SUMMARIZATION_PROMPT: '다음 텍스트를 간결하고 핵심적인 내용으로 요약해주세요:\n\n',
    TRANSLATION_PROMPT: '다음 텍스트를 자연스러운 한국어로 번역해주세요:\n\n',
    ERROR_LIBRARY_NOT_LOADED: 'Error: Required library not loaded. Please refresh the page.',
    ERROR_NO_SELECTION: 'No text selected. Please select some text first.',
    ERROR_SENDING_MESSAGE: 'Error sending message. Please try again.',
    ERROR_LOADING_MODELS: 'Error loading models. Please check your connection.',
    SYSTEM_PROMPT: '당신은 도움이 되는 AI 어시스턴트입니다. 사용자의 질문에 친절하고 정확하게 답변해주세요.'
  }
};

/**
 * Get message based on current language setting
 * @param {string} messageKey - The message key to retrieve
 * @param {string} [language='ko'] - The language code
 * @returns {string} The localized message
 */
export function getLocalizedMessage(messageKey, language = 'ko') {
  const messages = APP_CONSTANTS.MESSAGES[language] || APP_CONSTANTS.MESSAGES.ko;
  return messages[messageKey] || APP_CONSTANTS.DEFAULT_MESSAGES[messageKey] || messageKey;
}

/**
 * Get system prompt based on current language setting
 * @param {string} [language='ko'] - The language code
 * @returns {string} The localized system prompt
 */
export function getSystemPrompt(language = 'ko') {
  return getLocalizedMessage('SYSTEM_PROMPT', language);
}
