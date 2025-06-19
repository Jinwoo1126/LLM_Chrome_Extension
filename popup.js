// Import modules
import { LLMChatApp } from './src/llm-chat-app.js';

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
  console.log('LLM Chat Extension loading...');
  
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
  const chatMessages = document.getElementById('chat-messages');
  const settingsPanel = document.getElementById('settings-panel');

  if (tabChat && tabSettings && chatMessages && settingsPanel) {
    tabChat.addEventListener('click', () => {
      tabChat.classList.add('active');
      tabSettings.classList.remove('active');
      chatMessages.style.display = '';
      settingsPanel.classList.add('hidden');
    });
    tabSettings.addEventListener('click', () => {
      tabSettings.classList.add('active');
      tabChat.classList.remove('active');
      chatMessages.style.display = 'none';
      settingsPanel.classList.remove('hidden');
    });
    // 설정 저장
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const apiType = document.getElementById('api-type-select').value;
        const lang = document.getElementById('lang-select').value;
        chrome.storage.local.set({ apiType, lang }, () => {
          alert('설정이 저장되었습니다.');
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
  }
});

// Add message to chat
function addMessage(message, isUser = false) {
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

// Reset input height when message is sent
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
      useSelectionButton.textContent = '\ud83d\udccb Use Selection';
      useSelectionButton.classList.remove('selection-stored');
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
