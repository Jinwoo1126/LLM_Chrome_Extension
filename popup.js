// Import modules
import { LLMChatApp } from './src/llm-chat-app.js';
import { getLocalizedMessage } from './src/constants/app-constants.js';

// Safe Chrome runtime message sender
function safeRuntimeSendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage(message, function(response) {
          if (chrome.runtime.lastError) {
            console.log('Runtime message error:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } else {
        console.log('Chrome runtime context invalidated');
        reject(new Error('Extension context invalidated'));
      }
    } catch (error) {
      console.log('Error sending runtime message:', error.message);
      reject(error);
    }
  });
}

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

  // 메뉴 버튼 및 드롭다운
  const menuButton = document.getElementById('menu-button');
  const menuDropdown = document.getElementById('menu-dropdown');
  const menuSettings = document.getElementById('menu-settings');
  const menuClearHistory = document.getElementById('menu-clear-history');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettings = document.getElementById('close-settings');
  const chatContent = document.getElementById('chat-content');

  if (menuButton && menuDropdown && settingsPanel && chatContent) {
    // 메뉴 버튼 클릭 시 드롭다운 토글
    menuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.classList.toggle('hidden');
    });

    // 문서 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
      if (!menuDropdown.contains(e.target) && !menuButton.contains(e.target)) {
        menuDropdown.classList.add('hidden');
      }
    });

    // 설정 메뉴 클릭 시
    if (menuSettings) {
      menuSettings.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
        chatContent.style.display = 'none';
        settingsPanel.classList.remove('hidden');
        loadSettings(); // 설정 불러오기
      });
    }

    // 대화 기록 삭제 메뉴 클릭 시
    if (menuClearHistory) {
      menuClearHistory.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
        if (confirm('대화 기록을 모두 삭제하시겠습니까?')) {
          const event = new CustomEvent('ui:clearHistory');
          document.dispatchEvent(event);
        }
      });
    }

    // 설정 닫기 버튼 클릭 시
    if (closeSettings) {
      closeSettings.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        chatContent.style.display = 'flex';
      });
    }

    // 설정 저장
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const apiType = document.getElementById('api-type-select').value;
        const lang = document.getElementById('lang-select').value;
        
        // Update current language
        const oldLanguage = currentLanguage;
        currentLanguage = lang;
        
        chrome.storage.local.set({ apiType, lang }, async () => {
          // 언어가 변경된 경우 LLM Manager에 알림
          if (oldLanguage !== lang && window.llmChatApp && window.llmChatApp.llmManager) {
            try {
              await window.llmChatApp.llmManager.updateLanguage(lang);
              console.log(`Language updated from ${oldLanguage} to ${lang}`);
            } catch (error) {
              console.error('Failed to update language in LLM Manager:', error);
            }
          }
          
          const savedMessage = getLocalizedMessage('SETTINGS_SAVED', currentLanguage);
          alert(savedMessage);
          
          // 설정 저장 후 채팅 화면으로 돌아가기
          settingsPanel.classList.add('hidden');
          chatContent.style.display = 'flex';
        });
      });
    }

    // 설정값 불러오기 함수
    function loadSettings() {
      chrome.storage.local.get(['apiType', 'lang'], (result) => {
        if (result.apiType) document.getElementById('api-type-select').value = result.apiType;
        if (result.lang) document.getElementById('lang-select').value = result.lang;
      });
    }

    // 초기 상태 설정 (채팅이 기본)
    chatContent.style.display = 'flex';
    settingsPanel.classList.add('hidden');
  }

  // Selected text functionality
  if (selectionInfo && selectionPreview) {
    // Selection buttons
    const summarizeBtn = document.getElementById('summarize-selection');
    const translateBtn = document.getElementById('translate-selection');
    const closeSelectionBtn = document.getElementById('close-selection');

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

    if (closeSelectionBtn) {
      closeSelectionBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        try {
          console.log('Popup: Close selection button clicked, clearing all selection data...');
          
          // 1. Hide UI immediately
          hideSelectionInfo();
          
          // 2. Reset SelectionManager if available
          if (window.llmChatApp?.selectionManager) {
            console.log('Popup: Calling SelectionManager.resetSelection()');
            await window.llmChatApp.selectionManager.resetSelection();
          }
          
          // 3. Clear selection in background script and content script
          try {
            const response = await safeRuntimeSendMessage({action: 'clearSelection'});
            console.log('Background clearSelection response:', response);
          } catch (error) {
            console.log('Could not send clearSelection message to background:', error.message);
            // Continue with cleanup anyway
          }
          
          // 4. Clear local state
          currentSelection = '';
          
          console.log('Popup: Selection completely cleared');
        } catch (error) {
          console.log('Failed to clear selection:', error.message);
          // Even if some steps fail, ensure UI is hidden and local state is cleared
          hideSelectionInfo();
          currentSelection = '';
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

  // Simplified selection check using the unified SelectionManager
  async function checkForSelection() {
    console.log('Popup: Checking for selection...');
    
    try {
      if (window.llmChatApp?.selectionManager) {
        const selection = await window.llmChatApp.selectionManager.getSelection();
        if (selection && selection.trim()) {
          console.log('Popup: Found selection:', selection);
          showSelectionInfo(selection);
          return selection;
        } else {
          console.log('Popup: No selection found');
        }
      }
    } catch (error) {
      console.log('Popup: Error checking for selection:', error);
    }
    return '';
  }

  // Simplified context action check - now handled by SelectionManager
  // Initial check for context actions
  checkForSelection();
  
  // Simplified event-based selection detection
  // Check when popup regains focus (user might have selected text)
  window.addEventListener('focus', async () => {
    console.log('Popup: Window focused, checking for new selection...');
    await checkForSelection();
  });
  
  // Initial check
  setTimeout(async () => {
    await checkForSelection();
  }, 500);

  // Listen for selection events from SelectionManager
  document.addEventListener('selection:updated', (event) => {
    console.log('Popup: Received selection update event:', event.detail.selection);
    
    // Don't update if we just reset (currentSelection should be empty after reset)
    if (!currentSelection && !event.detail.selection) {
      console.log('Popup: Ignoring selection update after reset');
      return;
    }
    
    showSelectionInfo(event.detail.selection);
  });

  // Listen for selection reset events
  document.addEventListener('selection:reset', (event) => {
    console.log('Popup: Received selection reset event');
    hideSelectionInfo();
    currentSelection = '';
  });

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
    <span>Selected Box (${currentSelection.length} chars)</span>
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
