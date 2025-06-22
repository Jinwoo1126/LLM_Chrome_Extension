// Import modules
import { LLMChatApp } from './src/llm-chat-app.js';
import { getLocalizedMessage } from './src/constants/app-constants.js';

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
  // Global variables
  let chatMessages, userInput, sendButton, isSendingMessage = false;
  let isSelectionStored = false, currentSelection = '';
  let selectionInfo, selectionPreview;
  let currentLanguage = 'ko';

  console.log('LLM Chat Extension loading...');
  
  // Initialize global variables
  chatMessages = document.getElementById('chat-messages');
  userInput = document.getElementById('user-input');
  sendButton = document.getElementById('send-button');
  selectionInfo = document.getElementById('selection-info');
  selectionPreview = document.getElementById('selection-preview');
  
  // Load current language setting
  await loadCurrentLanguage();

  async function loadCurrentLanguage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lang'], (result) => {
        currentLanguage = result.lang || 'ko';
        resolve(currentLanguage);
      });
    });
  }
  
  try {
    // Create and initialize the main application
    const app = new LLMChatApp();
    await app.initialize();
    
    // Make app globally accessible for debugging
    window.llmChatApp = app;
    
    console.log('LLM Chat Extension loaded successfully');
  } catch (error) {
    console.error('Failed to initialize LLM Chat Extension:', error);
    alert('Failed to load the extension. Please refresh the page.');
  }

  // 탭 버튼 및 패널
  const tabChat = document.getElementById('tab-chat');
  const tabSettings = document.getElementById('tab-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const chatContent = document.getElementById('chat-content');

  if (tabChat && tabSettings && chatMessages && settingsPanel && chatContent) {
    // Chat 탭 클릭 시
    tabChat.addEventListener('click', () => {
      tabChat.classList.add('active');
      tabSettings.classList.remove('active');
      chatContent.style.display = 'flex';
      settingsPanel.classList.add('hidden');
    });

    // Settings 탭 클릭 시
    tabSettings.addEventListener('click', () => {
      tabSettings.classList.add('active');
      tabChat.classList.remove('active');
      chatContent.style.display = 'none';
      settingsPanel.classList.remove('hidden');
    });

    // 설정 저장
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const apiType = document.getElementById('api-type-select').value;
        const lang = document.getElementById('lang-select').value;
        
        // Update current language
        currentLanguage = lang;
        
        chrome.storage.local.set({ apiType, lang }, () => {
          const savedMessage = getLocalizedMessage('SETTINGS_SAVED', currentLanguage);
          alert(savedMessage);
        });
      });
    }

    // 설정값 불러오기
    function loadSettings() {
      chrome.storage.local.get(['apiType', 'lang'], (result) => {
        if (result.apiType) document.getElementById('api-type-select').value = result.apiType;
        if (result.lang) document.getElementById('lang-select').value = result.lang;
      });
    }

    // 설정 탭 진입 시 불러오기
    tabSettings.addEventListener('click', loadSettings);

    // 초기 상태 설정 (챗 탭이 기본)
    tabChat.classList.add('active');
    tabSettings.classList.remove('active');
    chatContent.style.display = 'flex';
    settingsPanel.classList.add('hidden');
  }

  // Selected text functionality
  if (selectionInfo && selectionPreview) {
    // Selection buttons
    const summarizeBtn = document.getElementById('summarize-selection');
    const translateBtn = document.getElementById('translate-selection');
    const resetBtn = document.getElementById('reset-selection');

    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (currentSelection) {
          const prompt = getLocalizedMessage('SUMMARIZATION_PROMPT', currentLanguage) + currentSelection;
          // UI에는 간단한 메시지만 표시하고, 실제 LLM에는 전체 프롬프트 전송
          sendCustomMessage('📝 요약 요청', prompt);
          // hideSelectionInfo(); // 선택 박스를 유지하기 위해 제거
        }
      });
    }

    if (translateBtn) {
      translateBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (currentSelection) {
          const prompt = getLocalizedMessage('TRANSLATION_PROMPT', currentLanguage) + currentSelection;
          // UI에는 간단한 메시지만 표시하고, 실제 LLM에는 전체 프롬프트 전송
          sendCustomMessage('🌐 번역 요청', prompt);
          // hideSelectionInfo(); // 선택 박스를 유지하기 위해 제거
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        try {
          hideSelectionInfo();
          // Clear selection using background script as a safer approach
          await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({action: 'clearSelection'}, function(response) {
              if (chrome.runtime.lastError) {
                console.log('Could not send clearSelection message to background:', chrome.runtime.lastError.message);
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
          console.log('Selection cleared successfully');
        } catch (error) {
          console.log('Failed to clear selection:', error.message);
          // Selection clearing failed, but at least hide the UI selection info
        }
      });
    }
  }

  // Listen for messages from content script and background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'selectionChanged' && message.selectedText) {
      console.log('Popup: Received selection change event:', message.selectedText);
      showSelectionInfo(message.selectedText);
    }
    
    // Handle context action notifications from background script
    if (message.action === 'contextActionNotification') {
      console.log('Received context action notification:', message.contextAction, 'with selection:', message.contextSelection);
      
      if (message.contextSelection) {
        showSelectionInfo(message.contextSelection);
        
        // Handle specific actions directly
        if (message.contextAction === 'summarize') {
          setTimeout(() => {
            if (currentSelection) {
              const prompt = getLocalizedMessage('SUMMARIZATION_PROMPT', currentLanguage) + currentSelection;
              sendCustomMessage('📝 요약 요청', prompt);
            }
          }, 500);
        } else if (message.contextAction === 'translate') {
          setTimeout(() => {
            if (currentSelection) {
              const prompt = getLocalizedMessage('TRANSLATION_PROMPT', currentLanguage) + currentSelection;
              sendCustomMessage('🌐 번역 요청', prompt);
            }
          }, 500);
        }
      }
    }
  });

  // Check for context actions and direct selection
  async function checkForSelectionFromMultipleSources() {
    console.log('Popup: Checking for selection from multiple sources...');
    
    // Method 1: Check for context actions
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkContextAction' }, resolve);
      });
      
      if (response && response.hasAction && response.selection) {
        console.log('Popup: Found context action selection:', response.selection);
        showSelectionInfo(response.selection);
        return response.selection;
      }
    } catch (error) {
      console.log('Popup: Context action check failed:', error);
    }
    
    // Method 2: Check for direct selection
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getSelectedText' }, resolve);
      });
      
      if (response && response.selectedText && response.selectedText.trim()) {
        console.log('Popup: Found direct selection:', response.selectedText);
        showSelectionInfo(response.selectedText);
        return response.selectedText;
      }
    } catch (error) {
      console.log('Popup: Direct selection check failed:', error);
    }
    
    console.log('Popup: No selection found from any source');
    return '';
  }

  // Check for context actions (right-click menu actions)  
  function checkContextAction() {
    chrome.runtime.sendMessage({ action: 'checkContextAction' }, (response) => {
      if (response && response.hasAction) {
        console.log('Context action detected:', response.action);
        
        if (response.selection) {
          showSelectionInfo(response.selection);
          
          // Handle specific actions directly without clicking buttons to avoid duplicate calls
          if (response.action === 'summarize') {
            setTimeout(() => {
              if (currentSelection) {
                const prompt = getLocalizedMessage('SUMMARIZATION_PROMPT', currentLanguage) + currentSelection;
                sendCustomMessage('📝 요약 요청', prompt);
              }
            }, 500);
          } else if (response.action === 'translate') {
            setTimeout(() => {
              if (currentSelection) {
                const prompt = getLocalizedMessage('TRANSLATION_PROMPT', currentLanguage) + currentSelection;
                sendCustomMessage('🌐 번역 요청', prompt);
              }
            }, 500);
          }
        }
      }
    });
  }

  // Initial check for context actions
  // Enhanced initialization - check for selections from multiple sources
  checkContextAction();
  
  // Smart selection detection - only when needed
  // Check when popup regains focus (user might have selected text)
  window.addEventListener('focus', async () => {
    console.log('Popup: Window focused, checking for new selection...');
    const newSelection = await checkForSelectionFromMultipleSources();
    if (newSelection && newSelection !== currentSelection) {
      console.log('Popup: Selection changed from', currentSelection, 'to', newSelection);
      currentSelection = newSelection;
    }
  });
  
  // Check when user clicks anywhere in the popup (might indicate intent to use selection)
  document.addEventListener('click', async (e) => {
    // Only check if clicking near input area or send button
    if (e.target.closest('#user-input') || e.target.closest('#send-button')) {
      const newSelection = await checkForSelectionFromMultipleSources();
      if (newSelection && newSelection !== currentSelection) {
        console.log('Popup: New selection detected on interaction:', newSelection);
        currentSelection = newSelection;
      }
    }
  });
  
  // Initial comprehensive check
  setTimeout(async () => {
    await checkForSelectionFromMultipleSources();
  }, 500);

  // Send button event listener
  if (sendButton) {
    sendButton.addEventListener('click', async function() {
      if (isSendingMessage) return; // Prevent multiple submissions
      
      const message = userInput.value.trim();
      let displayMessage = message;
      let messageToSend = message;
      
      if (messageToSend) {
        isSendingMessage = true; // Set flag before sending
        userInput.disabled = true; // Disable input while sending
        
        // If selection is stored, add it to the message internally
        if (isSelectionStored && currentSelection) {
          // UI에 표시되는 메시지용 간단한 형식
          const maxLength = 100;
          const truncatedText = currentSelection.length > maxLength 
            ? currentSelection.substring(0, maxLength) + '...'
            : currentSelection;
          const formattedDisplaySelection = `
<div class="message-selection">
  <div class="message-selection-header">
    <svg class="message-selection-icon collapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
    <span>Selected text (${currentSelection.length} chars)</span>
  </div>
  <div class="message-selection-content collapsed">
    <pre>${truncatedText}</pre>
  </div>
</div>`;
          // UI에만 표시, LLM 전송에는 selection context를 포함하지 않음
          if (message) {
            displayMessage = message + formattedDisplaySelection;
            messageToSend = message; // selection context 제거
          } else {
            displayMessage = formattedDisplaySelection;
            messageToSend = '';
          }
          // Reset selection stored state after using it
          isSelectionStored = false;
          const useSelectionButton = document.getElementById('use-selection');
          if (useSelectionButton) {
            useSelectionButton.textContent = '\ud83d\udccb Use Selection';
            useSelectionButton.classList.remove('selection-stored');
          }
        }
        addMessage(displayMessage, true);
        userInput.value = '';
        userInput.style.height = 'auto'; // Reset height
        try {
          await sendMessage(messageToSend);
        } finally {
          isSendingMessage = false; // Reset flag after sending
          userInput.disabled = false; // Re-enable input
          userInput.focus(); // Focus back on input
        }
      }
    });
  }

  // Show selection info
  function showSelectionInfo(text) {
    if (selectionInfo && selectionPreview) {
      const trimmedText = text.trim();
      
      // Only update if selection has actually changed
      if (trimmedText !== currentSelection) {
        console.log('Popup: Updating selection display from', currentSelection, 'to', trimmedText);
        currentSelection = trimmedText;
        selectionPreview.textContent = trimmedText;
        
        if (trimmedText) {
          selectionInfo.classList.remove('hidden');
        } else {
          selectionInfo.classList.add('hidden');
        }
      }
    }
  }

  // Hide selection info
  function hideSelectionInfo() {
    if (selectionInfo) {
      selectionInfo.classList.add('hidden');
      currentSelection = '';
    }
  }

  // Add message to chat
  function addMessage(message, isUser = false) {
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    messageDiv.innerHTML = marked.parse(message);
    chatMessages.appendChild(messageDiv);

    // Add timestamp (아래에 추가)
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageDiv.appendChild(timestampDiv);

    // Apply syntax highlighting to code blocks
    messageDiv.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });

    // Add click handlers for message selection headers
    messageDiv.querySelectorAll('.message-selection-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.message-selection-icon');
        content.classList.toggle('collapsed');
        icon.classList.toggle('collapsed');
      });
    });

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Send message function (placeholder - should be implemented in LLMChatApp)
  async function sendMessage(message) {
    if (window.llmChatApp) {
      try {
        // Let LLMChatApp handle all UI updates
        await window.llmChatApp.sendMessage(message, true); // true = add to UI
      } catch (error) {
        console.error('Failed to send message:', error);
        const errorMessage = getLocalizedMessage('ERROR_SENDING_MESSAGE', currentLanguage);
        addMessage(errorMessage, false);
      }
    }
  }

  // Send custom message with different display and actual content
  async function sendCustomMessage(displayMessage, actualMessage) {
    if (window.llmChatApp) {
      try {
        // Add display message to UI first
        addMessage(displayMessage, true);
        
        // Send to LLM with separate display and actual messages
        // UI는 이미 추가되었으므로 conversation history와 LLM 처리만 필요
        await window.llmChatApp.sendMessageRaw(displayMessage, actualMessage);
      } catch (error) {
        console.error('Failed to send message:', error);
        const errorMessage = getLocalizedMessage('ERROR_SENDING_MESSAGE', currentLanguage);
        addMessage(errorMessage, false);
      }
    }
  }
});
