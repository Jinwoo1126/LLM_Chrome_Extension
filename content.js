// Content script for LLM Chrome Extension
console.log('Content script loaded');

// PDF 페이지인지 확인
if (document.contentType === 'application/pdf' || 
    window.location.href.endsWith('.pdf')) {
  // PDF용 특별 처리
  console.log('PDF page detected');
}

// Safe Chrome runtime message sender
function safeRuntimeSendMessage(message, callback) {
  try {
    if (chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage(message, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Runtime message error:', chrome.runtime.lastError.message);
          if (callback) callback(null);
        } else {
          if (callback) callback(response);
        }
      });
    } else {
      console.log('Chrome runtime context invalidated');
      if (callback) callback(null);
    }
  } catch (error) {
    console.log('Error sending runtime message:', error.message);
    if (callback) callback(null);
  }
}

// Optimized function to get selection from all frames
function getAllSelections() {
  let selections = [];
  
  // Get selection from main document
  const mainSelection = window.getSelection().toString().trim();
  if (mainSelection) {
    selections.push(mainSelection);
  }
  
  // Get selections from all iframes (with error handling)
  const iframes = document.getElementsByTagName('iframe');
  for (let iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const iframeSelection = iframeDoc.getSelection().toString().trim();
      if (iframeSelection) {
        selections.push(iframeSelection);
      }
    } catch (e) {
      // Silently ignore iframe access errors (CORS, etc.)
    }
  }
  
  return selections.join('\n\n');
}

// Optimized page content extraction
function extractPageContent() {
  const selection = getAllSelections();
  
  return {
    title: document.title || '',
    url: window.location.href || '',
    description: document.querySelector('meta[name="description"]')?.content || '',
    selectedText: selection,
    mainContent: document.body?.innerText?.substring(0, 5000) || '', // Limit to 5000 chars
    hasSelection: Boolean(selection)
  };
}

// Optimized selection tracking
let currentSelection = '';
let lastNotifiedSelection = '';
let selectionChangeTimeout;

// Listen for text selection changes
document.addEventListener('selectionchange', function() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText && selectedText.length > 0) {
    console.log('Content script: Selection changed, notifying background');
    
    // Send message to background script
    safeRuntimeSendMessage({
      action: 'selectionChanged',
      selectedText: selectedText
    });
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clearSelection') {
    console.log('Content script: Received clear selection message');
    
    // Clear the current selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      selection.removeAllRanges();
    }
    
    sendResponse({ success: true });
  }
});

// Optimized message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script: Message received:', message.action);
  
  switch (message.action) {
    case 'getPageInfo':
      sendResponse(extractPageContent());
      break;
      
    case 'getSelectedText':
      // Force fresh check and respond
      const selection = getAllSelections();
      sendResponse({ selectedText: selection || currentSelection });
      break;
      
    default:
      console.log('Content script: Unknown action:', message.action);
  }
  
  return true; // Required for async response
});

// Notify background script that content script is ready
safeRuntimeSendMessage({ 
  action: 'contentScriptReady',
  url: window.location.href 
}, (response) => {
  if (response) {
    console.log('Content script ready message sent');
  } else {
    console.log('Could not send ready message');
  }
});

console.log('Content script setup complete');