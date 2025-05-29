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

  // Conversation history for multi-turn chat
  let conversationHistory = [];
  
  // Maximum number of turns to keep in history (to prevent context from getting too long)
  const MAX_HISTORY_TURNS = 20;

  // Initialize model selector
  function initializeModelSelector() {
    // Add vLLM option
    const vllmOption = document.createElement('option');
    vllmOption.value = 'vllm';
    vllmOption.textContent = 'vLLM';
    modelSelect.appendChild(vllmOption);

    // Add Ollama options
    Object.entries(MODEL_CONFIG.ollama.models).forEach(([key, model]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = model.name;
      modelSelect.appendChild(option);
    });

    // Load saved model preference
    chrome.storage.local.get(['selectedModel'], function(result) {
      if (result.selectedModel) {
        modelSelect.value = result.selectedModel;
      }
    });
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
        // Restore the UI
        conversationHistory.forEach(msg => {
          if (msg.role === 'user') {
            addMessageToUI(msg.content, true);
          } else if (msg.role === 'assistant') {
            addMessageToUI(msg.content, false);
          }
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
  initializeModelSelector();
  addClearHistoryButton();
  loadConversationHistory();

  // Save model preference when changed
  modelSelect.addEventListener('change', function() {
    chrome.storage.local.set({ selectedModel: modelSelect.value });
  });

  // Reset selection function
  function resetSelection() {
    currentSelection = '';
    isSelectionStored = false;
    hasHandledInitialAction = false;
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
        // 새로운 selection이나 action이 있으면 처리
        const newSelection = response.selection || '';
        const shouldUpdate = isSidePanel || !hasHandledInitialAction || newSelection !== currentSelection;
        
        if (shouldUpdate) {
          if (!isSidePanel) hasHandledInitialAction = true;
          
          // selection이나 action이 바뀌었으면 갱신
          currentSelection = newSelection;
          console.log('Selection from context:', currentSelection);
          updateSelectionUI(currentSelection);
          isSelectionStored = true;
          useSelectionButton.textContent = '✅ Selection Ready';
          useSelectionButton.classList.add('selection-stored');
          
          // action 실행
          if (response.action === 'summarize') {
            handleSummarize();
          } else if (response.action === 'translate') {
            handleTranslate();
          }
        }
        return;
      }
      
      // context action이 없을 때는 현재 selection 확인
      if (!hasHandledInitialAction || isSidePanel) {
        chrome.runtime.sendMessage({ action: 'getSelectedText' }, (response) => {
          if (response && response.selectedText && response.selectedText !== currentSelection) {
            currentSelection = response.selectedText;
            console.log('Selection received:', currentSelection);
            updateSelectionUI(currentSelection);
            
            if (isSidePanel) {
              isSelectionStored = true;
              useSelectionButton.textContent = '✅ Selection Ready';
              useSelectionButton.classList.add('selection-stored');
            }
          }
        });
      }
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
  async function sendMessage(message) {
    console.log('Sending message:', message);
    
    // Add user message to conversation history
    conversationHistory.push({ role: 'user', content: message });
    
    // Trim conversation history if it's too long
    if (conversationHistory.length > MAX_HISTORY_TURNS * 2) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
    }
    
    try {
      const selectedModel = modelSelect.value;
      const isVllm = selectedModel === 'vllm';
      
      const endpoint = isVllm 
        ? MODEL_CONFIG.vllm.endpoint
        : MODEL_CONFIG.ollama.endpoint;

      const requestBody = isVllm
        ? {
            model: MODEL_CONFIG.vllm.model,
            messages: conversationHistory, // Send full conversation history
            ...MODEL_CONFIG.vllm.params
          }
        : {
            model: selectedModel,
            messages: conversationHistory, // Send full conversation history
            ...MODEL_CONFIG.ollama.models[selectedModel].params
          };

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
    if (isSendingMessage) return; // Prevent multiple submissions
    
    const message = userInput.value.trim();
    let displayMessage = message;
    let messageToSend = message;
    
    if (messageToSend) {
      isSendingMessage = true; // Set flag before sending
      userInput.disabled = true; // Disable input while sending
      
      // If selection is stored, add it to the message internally
      if (isSelectionStored && currentSelection) {
        // UI에 표시되는 메시지용 간략한 형식
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
        
        // LLM에 보내는 실제 메시지에는 전체 선택 텍스트를 포함
        const formattedFullSelection = `[Selected text]: \n"${currentSelection}"`;
        
        // Add selection to messages
        if (message) {
          displayMessage = message + formattedDisplaySelection; // UI 표시용
          messageToSend = '<start_of_turn>system [Selected text]부분을 참고하여 주어진 [지시사항]에 한국어로 답변해주세요.<end_of_turn>' + formattedFullSelection + '\n\n[지시사항]' + message + '\n\n답변:'; // LLM 전송용
        } else {
          displayMessage = formattedDisplaySelection; // UI 표시용
          messageToSend = formattedFullSelection; // LLM 전송용
        }
        
        // Remove the line that resets selection stored state
        // isSelectionStored = false;
        // useSelectionButton.textContent = '📋 Use Selection';
        // useSelectionButton.classList.remove('selection-stored');
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
    // Clear any existing messages
    chatMessages.innerHTML = '';
    
    const message = `다음 텍스트를 이해하기 쉽게 한국어로 요약해주세요:\n\n[텍스트] ${currentSelection} \n\n요약 :`;
    try {
      await sendMessage(message);
    } finally {
      isSendingMessage = false;
    }
  }

  // Function to handle translation
  async function handleTranslate() {
    if (!currentSelection || isSendingMessage) return;
    
    isSendingMessage = true;
    // Clear any existing messages
    chatMessages.innerHTML = '';
    
    const message = `아래 텍스트를 한국어로 번역해주세요:\n\n[텍스트] ${currentSelection} \n\n번역 :`;
    try {
      await sendMessage(message);
    } finally {
      isSendingMessage = false;
    }
  }
});