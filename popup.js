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
  const apiUrlInput = document.getElementById('api-url');
  const saveSettingsButton = document.getElementById('save-settings');

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

  // Default API configuration
  const defaultApiConfig = {
    apiBase: '...',
    model: '...',
    apiKey: 'EMPTY'
  };

  // Load saved settings or use default
  chrome.storage.local.get(['model', 'apiKey'], function(result) {
    console.log('Loaded settings:', result);
    apiUrlInput.value = result.model || defaultApiConfig.model;
  });

  // Save settings
  saveSettingsButton.addEventListener('click', function() {
    const model = apiUrlInput.value;
    console.log('Saving settings:', { model });
    chrome.storage.local.set({ 
      model: model,
      apiKey: defaultApiConfig.apiKey
    }, function() {
      alert('Settings saved!');
    });
  });

  // Send message to LLM with streaming
  async function sendMessage(message) {
    console.log('Sending message:', message);
    const model = apiUrlInput.value || defaultApiConfig.model;
    const apiUrl = `${defaultApiConfig.apiBase}/chat/completions`;
    console.log('API URL:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${defaultApiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: model,
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
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0].delta.content;
              if (content) {
                assistantMessage += content;
                // Render markdown and update the message
                messageDiv.innerHTML = marked.parse(assistantMessage);
                // Apply syntax highlighting to code blocks
                messageDiv.querySelectorAll('pre code').forEach((block) => {
                  hljs.highlightElement(block);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } catch (e) {
              console.error('Error parsing streaming response:', e);
            }
          }
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
    const message = userInput.value.trim();
    if (message) {
      addMessage(message, true);
      userInput.value = '';
      await sendMessage(message);
    }
  });

  // Handle Enter key
  userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      console.log('Enter key pressed');
      sendButton.click();
    }
  });
}); 