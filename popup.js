document.addEventListener('DOMContentLoaded', function() {
  console.log('Extension loaded');
  
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
  
  // New elements for selection display
  const selectionInfo = document.getElementById('selection-info');
  const selectionPreview = document.getElementById('selection-preview');
  const useSelectionButton = document.getElementById('use-selection');
  const resetSelectionButton = document.getElementById('reset-selection');
  
  // Current selection state
  let currentSelection = '';
  // New flag to track if selection is stored for use
  let isSelectionStored = false;

  // Reset selection function
  function resetSelection() {
    currentSelection = '';
    isSelectionStored = false;
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
    chrome.runtime.sendMessage({ action: 'getSelectedText' }, (response) => {
      if (response && response.selectedText) {
        currentSelection = response.selectedText;
        console.log('Selection received:', currentSelection);
        // If text is selected, show it in the UI
        updateSelectionUI(currentSelection);
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

  // Send message to LLM with streaming
  async function sendMessage(message) {
    console.log('Sending message:', message);
    
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemma3',
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          stream: true
        })
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
        } catch (e) {
          console.error('Error parsing streaming response:', e);
        }
      }

      return assistantMessage;
    } catch (error) {
      console.error('Error:', error);
      return `Sorry, there was an error processing your request: ${error.message}`;
    }
  }

  // Add message to chat
  function addMessage(content, isUser) {
    console.log('Adding message:', { content, isUser });
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    if (isUser) {
      messageDiv.textContent = content;
    } else {
      messageDiv.innerHTML = marked.parse(content);
      // Apply syntax highlighting to code blocks
      messageDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Handle send button click
  sendButton.addEventListener('click', async function() {
    console.log('Send button clicked');
    let message = userInput.value.trim();
    let displayMessage = message; // 화면에 표시할 메시지
    
    // If selection is stored, add it to the message internally
    if (isSelectionStored && currentSelection) {
      // UI에 표시되는 메시지용 간략한 형식
      let formattedDisplaySelection;
      const maxLength = 50; // 표시할 최대 길이
      
      if (currentSelection.length > maxLength) {
        // 선택 텍스트가 길 경우 축약 표시 (UI용)
        formattedDisplaySelection = `Selected text: "${currentSelection.substring(0, maxLength)}..." (${currentSelection.length} chars)`;
      } else {
        formattedDisplaySelection = `Selected text: "${currentSelection}"`;
      }
      
      // LLM에 보내는 실제 메시지에는 전체 선택 텍스트를 포함
      const formattedFullSelection = `Selected text: "${currentSelection}"`;
      
      // Add selection to messages
      if (message) {
        displayMessage = message + '\n\n' + formattedDisplaySelection; // UI 표시용
        message = message + '\n\n' + formattedFullSelection; // LLM 전송용
      } else {
        displayMessage = formattedDisplaySelection; // UI 표시용
        message = formattedFullSelection; // LLM 전송용
      }
      
      // Reset selection stored state after using it
      isSelectionStored = false;
      useSelectionButton.textContent = '📋 Use Selection';
      useSelectionButton.classList.remove('selection-stored');
    }
    
    if (message) {
      // UI에는 간략한 버전 표시, 실제 전송은 전체 내용
      addMessage(displayMessage, true);
      userInput.value = '';
      await sendMessage(message); // 전체 내용 전송
    }
  });

  // Handle Enter key
  userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      console.log('Enter key pressed');
      sendButton.click();
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
});