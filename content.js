// Content script to collect page information
console.log('Content script loaded');

// Function to get selection from all frames
function getAllSelections() {
  let selections = [];
  
  // Get selection from main document
  const mainSelection = window.getSelection().toString().trim();
  if (mainSelection) {
    selections.push(mainSelection);
  }
  
  // Get selections from all iframes
  const iframes = document.getElementsByTagName('iframe');
  for (let iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const iframeSelection = iframeDoc.getSelection().toString().trim();
      if (iframeSelection) {
        selections.push(iframeSelection);
      }
    } catch (e) {
      console.log('Cannot access iframe content:', e);
    }
  }
  
  return selections.join('\n\n');
}

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
  
  // Get selected text from all frames
  const selectedText = getAllSelections();
  
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
    hasSelection: selectedText.length > 0
  };
}

// Keep track of the current selection
let currentSelection = '';
let lastNotifiedSelection = '';

// Debounced selection change handler to avoid excessive messages
let selectionChangeTimeout;

// Monitor text selection changes with smart debouncing
document.addEventListener('selectionchange', function() {
  // Clear previous timeout
  if (selectionChangeTimeout) {
    clearTimeout(selectionChangeTimeout);
  }
  
  // Debounce selection changes to avoid excessive calls
  selectionChangeTimeout = setTimeout(() => {
    const newSelection = getAllSelections();
    
    // Only notify if selection actually changed
    if (newSelection !== lastNotifiedSelection) {
      currentSelection = newSelection;
      lastNotifiedSelection = newSelection;
      
      // Only send message if there's actual selection
      if (newSelection && newSelection.trim()) {
        console.log('Content script: Selection changed, notifying extension');
        chrome.runtime.sendMessage({ 
          action: 'selectionChanged', 
          selectedText: newSelection 
        });
      }
    }
  }, 300); // Wait 300ms before processing selection change
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
    const selection = getAllSelections();
    sendResponse({ selectedText: selection || currentSelection });
    return true;
  }

  if (message.action === 'clearSelection') {
    // Clear the current selection
    window.getSelection().removeAllRanges();
    // Try to clear selections in iframes
    const iframes = document.getElementsByTagName('iframe');
    for (let iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.getSelection().removeAllRanges();
      } catch (e) {
        console.log('Cannot access iframe content:', e);
      }
    }
    sendResponse({ success: true });
    return true;
  }
});

// Notify that the content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' });