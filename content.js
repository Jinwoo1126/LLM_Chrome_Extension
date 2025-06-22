// Content script for LLM Chrome Extension
console.log('Content script loaded');

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

// Optimized selection change handler with smart debouncing
document.addEventListener('selectionchange', function() {
  // Clear previous timeout
  if (selectionChangeTimeout) {
    clearTimeout(selectionChangeTimeout);
  }
  
  // Debounce selection changes (300ms delay)
  selectionChangeTimeout = setTimeout(() => {
    const newSelection = getAllSelections();
    
    // Only notify if selection actually changed and is not empty
    if (newSelection !== lastNotifiedSelection && newSelection.trim()) {
      currentSelection = newSelection;
      lastNotifiedSelection = newSelection;
      
      console.log('Content script: Selection changed, notifying background');
      
      // Send message to background script
      chrome.runtime.sendMessage({ 
        action: 'selectionChanged', 
        selectedText: newSelection 
      }).catch(error => {
        console.log('Could not send selection change message:', error.message);
      });
    }
  }, 300);
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
      
    case 'clearSelection':
      // Clear selections in all frames
      try {
        window.getSelection().removeAllRanges();
        
        // Clear iframe selections
        const iframes = document.getElementsByTagName('iframe');
        for (let iframe of iframes) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.getSelection().removeAllRanges();
          } catch (e) {
            // Silently ignore iframe access errors
          }
        }
        
        // Reset internal state
        currentSelection = '';
        lastNotifiedSelection = '';
        
        sendResponse({ success: true });
      } catch (error) {
        console.log('Error clearing selection:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    default:
      console.log('Content script: Unknown action:', message.action);
  }
  
  return true; // Required for async response
});

// Notify background script that content script is ready
chrome.runtime.sendMessage({ 
  action: 'contentScriptReady',
  url: window.location.href 
}).catch(error => {
  console.log('Could not send ready message:', error.message);
});

console.log('Content script setup complete');