document.addEventListener('DOMContentLoaded', function() {
  console.log('Extension loaded');
  
  // Detect if we're in popup or side panel mode
  const isSidePanel = window.location.search.includes('side_panel=true');
  document.body.classList.add(isSidePanel ? 'side-panel-mode' : 'popup-mode');
  
  // Verify that required libraries are loaded
  if (typeof marked === 'undefined') {
    console.error('marked library not loaded');
    alert('Error: Markdown library not loaded. Please refresh the page.');
    return;
  }
  if (typeof hljs === 'undefined') {
    console.error('highlight.js library not loaded');
    alert('Error: Syntax highlighting library not loaded. Please refresh the page.');
    return;
  }

  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const modelSelect = document.getElementById('model-select');
  
  // New elements for selection display
  const selectionInfo = document.getElementById('selection-info');
  const selectionPreview = document.getElementById('selection-preview');
  const useSelectionButton = document.getElementById('use-selection');
  const resetSelectionButton = document.getElementById('reset-selection');
  const selectionHeader = document.querySelector('.selection-header');
  const selectionContent = document.querySelector('.selection-content');
  const selectionHeaderIcon = document.querySelector('.selection-header-icon');
  
  // Current selection state
  let currentSelection = '';
  // New flag to track if selection is stored for use
  let isSelectionStored = false;
  // Track selection content visibility
  let isSelectionContentVisible = true;
  // Add flag to track if message is being sent
  let isSendingMessage = false;
  // Add flag to track if an action is being processed
  let isProcessingAction = false;
  // Add flag to track if we've already handled the initial context action
  let hasHandledInitialAction = false;
  // Add flag to track chat mode (selection or normal)
  let isSelectionMode = false;

  // Conversation history for multi-turn chat
  let conversationHistory = [];
  
  // Maximum number of turns to keep in history (to prevent context from getting too long)
  const MAX_HISTORY_TURNS = 3;

  // Initialize model selector
  async function initializeModelSelector() {
    // Get current configuration
    const config = await apiConfig.getConfig();
    console.log('Initializing with config:', config);
    
    // Clear existing options
    modelSelect.innerHTML = '';
    
    if (config.apiType === 'vllm') {
      // Add vLLM option
      const vllmOption = document.createElement('option');
      vllmOption.value = config.model;
      vllmOption.textContent = 'vLLM (Gemma 3)';
      modelSelect.appendChild(vllmOption);
      modelSelect.value = config.model;
    } else if (config.apiType === 'ollama') {
      // Add Ollama options
      const availableModels = apiConfig.getAvailableModels('ollama');
      availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelect.appendChild(option);
      });
      
      // Set current model
      modelSelect.value = config.model;
    }

    // Hide model selector but keep the container visible for clear button
    modelSelect.style.display = 'none';
  }

  // Save conversation history to Chrome storage
  function saveConversationHistory() {
    chrome.storage.local.set({ conversationHistory: conversationHistory });
  }

  // Load conversation history from Chrome storage
  function loadConversationHistory() {
    chrome.storage.local.get(['conversationHistory'], function(result) {
      if (result.conversationHistory && Array.isArray(result.conversationHistory)) {
        conversationHistory = result.conversationHistory;
        
        // UI 복원 시 저장된 형식 그대로 표시
        chatMessages.innerHTML = ''; // 기존 메시지 초기화
        conversationHistory.forEach(msg => {
          addMessageToUI(msg.content, msg.role === 'user');
        });
      }
    });
  }

  // Clear conversation history
  function clearConversationHistory() {
    if (confirm('Are you sure you want to clear the conversation history?')) {
      conversationHistory = [];
      chatMessages.innerHTML = '';
      saveConversationHistory();
    }
  }

  // Add clear history button to the model selector area
  function addClearHistoryButton() {
    const modelSelectorDiv = document.querySelector('.model-selector');
    const clearButton = document.createElement('button');
    clearButton.id = 'clear-history';
    clearButton.textContent = '🗑️ Clear';
    clearButton.title = 'Clear conversation history';
    clearButton.style.marginLeft = '8px';
    clearButton.style.fontSize = '13px';
    clearButton.style.padding = '6px 12px';
    clearButton.style.backgroundColor = '#6c757d';
    clearButton.style.color = 'white';
    clearButton.style.border = 'none';
    clearButton.style.borderRadius = '6px';
    clearButton.style.cursor = 'pointer';
    clearButton.style.transition = 'all 0.2s ease-in-out';
    
    clearButton.addEventListener('mouseover', () => {
      clearButton.style.backgroundColor = '#5a6268';
      clearButton.style.transform = 'translateY(-1px)';
    });
    
    clearButton.addEventListener('mouseout', () => {
      clearButton.style.backgroundColor = '#6c757d';
      clearButton.style.transform = 'translateY(0)';
    });
    
    clearButton.addEventListener('click', clearConversationHistory);
    modelSelectorDiv.appendChild(clearButton);
  }

  // Initialize model selector
  (async () => {
    await initializeModelSelector();
    addClearHistoryButton();
    loadConversationHistory();
  })();

  // Save model preference when changed
  modelSelect.addEventListener('change', async function() {
    const config = await apiConfig.getConfig();
    await apiConfig.saveConfig({ 
      apiType: config.apiType,
      model: modelSelect.value 
    });
    console.log('Model changed to:', modelSelect.value);
  });

  // Reset selection function
  function resetSelection() {
    // Reset selection state
    currentSelection = '';
    isSelectionStored = false;
    isSelectionMode = false;  // Reset chat mode
    hasHandledInitialAction = false;
    
    // Reset UI
    selectionPreview.textContent = '';
    selectionInfo.classList.add('hidden');
    useSelectionButton.textContent = '📋 Use Selection';
    useSelectionButton.classList.remove('selection-stored');
    
    // Notify background script to clear selection
    chrome.runtime.sendMessage({ action: 'clearSelection' });
  }

  // Handle reset button click
  resetSelectionButton.addEventListener('click', resetSelection);

  // Configure marked
  marked.setOptions({
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true
  });

  // Check for selected text when popup opens
  function checkForSelection() {
    chrome.runtime.sendMessage({ action: 'checkContextAction' }, (response) => {
      const isSidePanel = window.location.search.includes('side_panel=true');
      
      // 사이드패널 모드에서는 항상 context action을 처리
      if (response && response.action && response.selection) {
        const newSelection = response.selection || '';
        currentSelection = newSelection;
        console.log('Selection from context:', currentSelection);
        updateSelectionUI(currentSelection);
        isSelectionStored = true;
        useSelectionButton.textContent = '✅ Selection Ready';
        useSelectionButton.classList.add('selection-stored');
        
        if (response.action === 'summarize') {
          handleSummarize();
        } else if (response.action === 'translate') {
          handleTranslate();
        }
        return;
      }
      
      // context action이 없을 때는 현재 selection 확인
      chrome.runtime.sendMessage({ action: 'getSelectedText' }, (response) => {
        if (response && response.selectedText) {
          // 새로운 선택 텍스트가 있으면 항상 업데이트
          currentSelection = response.selectedText;
          console.log('New selection received:', currentSelection);
          updateSelectionUI(currentSelection);
          
          // 사이드패널 모드에서는 자동으로 선택 텍스트 저장
          if (isSidePanel) {
            isSelectionStored = true;
            useSelectionButton.textContent = '✅ Selection Ready';
            useSelectionButton.classList.add('selection-stored');
          }
        } else if (!response || !response.selectedText) {
          // 선택된 텍스트가 없는 경우 초기화
          resetSelection();
        }
      });
    });
  }
  
  // Update the UI to show selected text
  function updateSelectionUI(text) {
    console.log('Updating selection UI with:', text);
    if (text && text.trim().length > 0) {
      // Truncate if too long
      const maxPreviewLength = 150;
      const previewText = text.length > maxPreviewLength 
        ? text.substring(0, maxPreviewLength) + '...' 
        : text;
      
      // Update and show the selection UI
      selectionPreview.textContent = previewText;
      selectionInfo.classList.remove('hidden');
    } else {
      // Hide the selection UI if no selection
      selectionInfo.classList.add('hidden');
      console.log('No selection to show, hiding UI');
      
      // 선택 영역이 없어진 경우에만 저장 상태 초기화
      isSelectionStored = false;
      useSelectionButton.textContent = '📋 Use Selection';
      useSelectionButton.classList.remove('selection-stored');
    }
  }
  
  // Handle the use selection button
  useSelectionButton.addEventListener('click', function() {
    if (currentSelection) {
      // Instead of adding to input, just toggle the internal flag
      isSelectionStored = !isSelectionStored;
      
      // Provide visual feedback
      if (isSelectionStored) {
        useSelectionButton.textContent = '✅ Selection Ready';
        useSelectionButton.classList.add('selection-stored');
      } else {
        useSelectionButton.textContent = '📋 Use Selection';
        useSelectionButton.classList.remove('selection-stored');
      }
    }
  });

  // Toggle selection content visibility
  selectionHeader.addEventListener('click', () => {
    isSelectionContentVisible = !isSelectionContentVisible;
    selectionContent.classList.toggle('collapsed', !isSelectionContentVisible);
    selectionHeaderIcon.classList.toggle('collapsed', !isSelectionContentVisible);
  });

    // Send message to LLM with streaming
    async function sendMessage(message, currentSelection) {
      console.log('Sending message:', message);

      let messageToSend = [];
      const hasSelection = currentSelection && currentSelection.trim().length > 0 && isSelectionStored;

      // Update mode without clearing history
      isSelectionMode = hasSelection;
      
      if (hasSelection) {
        // Set up context for selection-based chat
        const systemPrompt = '[Selected text]부분이 있다면 참고하여 주어진 [지시사항]에 답변해주세요. 필요하면 이전대화도 참고해주세요. 불필요하다고 생각되면 이전대화는 무시해도 됩니다.';
        const userMsg = {
          role: 'user',
          content: `[Selected text]:\n"${currentSelection}"\n\n[지시사항]\n${message}\n\n답변:`
        };
        
        // Include system prompt only if it's not already in history
        if (!conversationHistory.some(msg => msg.role === 'system')) {
          messageToSend.push({ role: 'system', content: systemPrompt });
        }
        
        messageToSend = [
          ...messageToSend,
          ...conversationHistory,
          userMsg
        ];
      } else {
        // Normal chat mode - just add the message to existing conversation
        messageToSend = [
          ...conversationHistory,
          { role: 'user', content: message }
        ];
      }

      // Add message to conversation history
      conversationHistory.push({ role: 'user', content: message });

      // Trim conversation history if it's too long
      if (conversationHistory.length > MAX_HISTORY_TURNS * 2) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
      }
      
      // Save conversation history
      saveConversationHistory();

      // 로그: 실제 발송 메시지와 대화 기록 저장 메시지
      console.log('Message sent to LLM:', messageToSend);
      console.log('Current conversation history:', conversationHistory);
      
    try {
      // Get current configuration from config.js
      const config = await apiConfig.getConfig();
      console.log('Using config:', config);
      
      const isVllm = config.apiType === 'vllm';
      const endpoint = config.endpoint;

      const requestBody = isVllm
        ? {
            model: config.model,
            messages: messageToSend,
            ...config.params
          }
        : {
            model: config.model,
            messages: messageToSend,
            ...config.params
          };

      console.log('Request body:', requestBody);
      console.log('Endpoint:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Create a message element for streaming
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message assistant-message';
      chatMessages.appendChild(messageDiv);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        console.log('Received chunk:', chunk);
        
        try {
          // Handle OpenAI-compatible streaming format (vLLM)
          if (isVllm) {
            // Split by newlines as each line is a separate JSON object
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.trim()) { // Skip empty lines
                if (line.startsWith('data: ')) {
                  const jsonStr = line.slice(6).trim(); // Remove 'data: ' prefix
                  if (jsonStr === '[DONE]') continue;
                  
                  try {
                    const parsed = JSON.parse(jsonStr);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                      assistantMessage += content;
                      messageDiv.innerHTML = marked.parse(assistantMessage);
                      messageDiv.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                      });
                      chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                  } catch (e) {
                    console.error('Error parsing vLLM chunk:', e, jsonStr);
                  }
                }
              }
            }
          } else {
            // Handle Ollama format - single JSON object per chunk
            const parsed = JSON.parse(chunk);
            const content = parsed.message?.content || '';
            if (content) {
              assistantMessage += content;
              messageDiv.innerHTML = marked.parse(assistantMessage);
              messageDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
              });
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          }
        } catch (e) {
          console.error('Error parsing streaming response:', e, chunk);
        }
      }

      // Add assistant message to conversation history
      conversationHistory.push({ role: 'assistant', content: assistantMessage });
      saveConversationHistory();
      
      return assistantMessage;
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = `Sorry, there was an error processing your request: ${error.message}`;
      
      // Still add error message to history for context
      conversationHistory.push({ role: 'assistant', content: errorMessage });
      saveConversationHistory();
      
      return errorMessage;
    }
  }

  // Add message to chat UI only
  function addMessageToUI(message, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    messageDiv.innerHTML = marked.parse(message);
    chatMessages.appendChild(messageDiv);
    
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

  // Add message to chat
  function addMessage(message, isUser = false) {
    addMessageToUI(message, isUser);
  }

  // Add auto-resize functionality to input
  userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });

  // Reset input height when message is sent
  sendButton.addEventListener('click', async function() {
    if (isSendingMessage) return;
    
    const message = userInput.value.trim();
    if (message) {
      isSendingMessage = true;
      userInput.disabled = true;
      
      let displayMessage = message;
      let messageToSend = message;
      
      if (isSelectionStored && currentSelection) {
        const maxLength = 100;
        const truncatedText = currentSelection.length > maxLength 
          ? currentSelection.substring(0, maxLength) + '...' 
          : currentSelection;

        // UI 표시용 포맷팅
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

        displayMessage = message + formattedDisplaySelection;
      }
      
      // UI에 표시
      addMessage(displayMessage, true);
      userInput.value = '';
      userInput.style.height = 'auto';
      
      try {
        await sendMessage(message, currentSelection);
      } finally {
        isSendingMessage = false;
        userInput.disabled = false;
        userInput.focus();
      }
    }
  });

  // Handle Enter key
  userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter: Allow new line
        return;
      } else {
        // Enter only: Send message
        e.preventDefault(); // Prevent default new line
        if (!isSendingMessage) { // Only send if not already sending
          console.log('Enter key pressed');
          sendButton.click();
        }
      }
    }
  });

  // Check for selection when popup opens
  checkForSelection();
  
  // Check for selection changes more frequently
  // This adds real-time monitoring for selections while popup is open
  function setupSelectionMonitoring() {
    // Check for selection immediately when popup opens
    checkForSelection();
    
    // Poll for selection changes every second while popup is open
    const selectionInterval = setInterval(() => {
      checkForSelection();
    }, 1000);
    
    // Listen for tab changes
    chrome.tabs.onActivated.addListener(() => {
      resetSelection();
      // 탭 전환 후 새로운 선택을 확인하기 위한 시간을 충분히 줌
      setTimeout(() => {
        hasHandledInitialAction = false;  // 새 탭에서의 선택을 감지하기 위해 플래그 초기화
        checkForSelection();
      }, 300); // 시간을 300ms로 증가
    });

    // Clean up interval when popup closes
    window.addEventListener('unload', () => {
      clearInterval(selectionInterval);
    });
  }
  
  // Initialize selection monitoring
  setupSelectionMonitoring();

  // Handle summarize button click
  document.getElementById('summarize-selection').addEventListener('click', handleSummarize);

  // Handle translate button click
  document.getElementById('translate-selection').addEventListener('click', handleTranslate);

  // Function to handle summarization
  async function handleSummarize() {
    if (!currentSelection || isSendingMessage) return;
    
    isSendingMessage = true;
    chatMessages.innerHTML = '';
    
    const displayMessage = '선택한 텍스트 요약';
    const messageToSend = `다음 텍스트를 이해하기 쉽게 한국어로 요약해주세요:\n\n[텍스트] ${currentSelection} \n\n요약:`;
    
    addMessage(displayMessage, true);
    
    try {
      await sendMessage(messageToSend);
    } finally {
      isSendingMessage = false;
    }
  }

  // Function to handle translation
  async function handleTranslate() {
    if (!currentSelection || isSendingMessage) return;
    
    isSendingMessage = true;
    chatMessages.innerHTML = '';
    
    const displayMessage = '선택한 텍스트 번역';
    const messageToSend = `아래 텍스트를 한국어로 번역해주세요:\n\n[텍스트] ${currentSelection} \n\n번역:`;
    
    addMessage(displayMessage, true);
    
    try {
      await sendMessage(messageToSend);
    } finally {
      isSendingMessage = false;
    }
  }
});