// Content script to collect page information
console.log('Content script loaded');

// Function to extract page content
function extractPageContent() {
  // Get page title
  const title = document.title;
  
  // Get meta description
  let description = '';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    description = metaDesc.getAttribute('content');
  }
  
  // Get URL
  const url = window.location.href;
  
  // Get selected text if any
  const selectedText = window.getSelection().toString();
  
  // Extract main content (basic implementation)
  // Gets text from article, main, or body elements
  let mainContent = '';
  const contentElements = document.querySelector('article') || 
                          document.querySelector('main') || 
                          document.body;
  
  if (contentElements) {
    // Get text content but limit it to avoid excessive data
    mainContent = contentElements.textContent.trim().substring(0, 5000);
    // Remove excessive whitespace
    mainContent = mainContent.replace(/\s+/g, ' ');
  }
  
  return {
    title,
    url,
    description,
    selectedText,
    mainContent,
    hasSelection: selectedText.length > 0 // Added flag to indicate if there's selected text
  };
}

// Keep track of the current selection
let currentSelection = '';

// Monitor text selection changes
document.addEventListener('selectionchange', function() {
  currentSelection = window.getSelection().toString().trim();
  
  // Notify the extension about the selection change
  if (currentSelection) {
    chrome.runtime.sendMessage({ 
      action: 'selectionChanged', 
      selectedText: currentSelection 
    });
  }
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in content script:', message);
  
  if (message.action === 'getPageInfo') {
    const pageInfo = extractPageContent();
    sendResponse(pageInfo);
    return true; // Required for async response
  }
  
  if (message.action === 'getSelectedText') {
    // Force a fresh check of the selection
    const selection = window.getSelection().toString().trim();
    sendResponse({ selectedText: selection || currentSelection });
    return true;
  }
});

// Notify that the content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' });