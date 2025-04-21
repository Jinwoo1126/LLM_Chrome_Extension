// Background script for LLM Chrome Extension
console.log('Background script loaded');

// Store page information when received from content script
let currentPageInfo = null;
let currentSelection = '';

// Create context menu items when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Create a parent menu item
  chrome.contextMenus.create({
    id: 'llm-extension',
    title: 'LLM Chat Extension',
    contexts: ['all']
  });

  // Create a menu item for asking about the current page
  chrome.contextMenus.create({
    id: 'ask-about-page',
    parentId: 'llm-extension',
    title: 'Ask LLM about this page',
    contexts: ['page']
  });

  // Create a menu item for asking about selected text
  chrome.contextMenus.create({
    id: 'ask-about-selection',
    parentId: 'llm-extension',
    title: 'Ask LLM about selection',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ask-about-page') {
    // Open popup with page info
    chrome.storage.local.set({ 'contextAction': 'page' }, () => {
      chrome.action.openPopup();
    });
  } 
  else if (info.menuItemId === 'ask-about-selection') {
    // Save the selection and open popup
    currentSelection = info.selectionText || '';
    chrome.storage.local.set({ 
      'contextAction': 'selection',
      'contextSelection': currentSelection 
    }, () => {
      chrome.action.openPopup();
    });
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background:', message);
  
  if (message.action === 'contentScriptReady') {
    console.log('Content script is ready on tab:', sender.tab?.id);
  }
  
  // Track selection changes from content script
  if (message.action === 'selectionChanged') {
    currentSelection = message.selectedText;
    console.log('Selection updated:', currentSelection);
  }
  
  // When popup requests current page info
  if (message.action === 'getCurrentPageInfo') {
    // Query for the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        sendResponse({ error: 'No active tab found' });
        return;
      }
      
      const activeTab = tabs[0];
      
      // Send message to content script in the active tab
      chrome.tabs.sendMessage(
        activeTab.id, 
        { action: 'getPageInfo' }, 
        function(response) {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            sendResponse({ 
              error: 'Could not connect to the page',
              fallbackInfo: {
                title: activeTab.title,
                url: activeTab.url,
                selectedText: currentSelection
              }
            });
          } else {
            // Add any tracked selection if needed
            if (!response.selectedText && currentSelection) {
              response.selectedText = currentSelection;
              response.hasSelection = true;
            }
            
            // Save page info and send it back to popup
            currentPageInfo = response;
            sendResponse(response);
          }
        }
      );
    });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  // When popup requests just the selected text
  if (message.action === 'getSelectedText') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        sendResponse({ selectedText: currentSelection });
        return;
      }
      
      const activeTab = tabs[0];
      
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: 'getSelectedText' },
        function(response) {
          if (chrome.runtime.lastError) {
            sendResponse({ selectedText: currentSelection });
          } else {
            sendResponse(response);
          }
        }
      );
    });
    
    return true;
  }

  // New message handler for checking context actions
  if (message.action === 'checkContextAction') {
    chrome.storage.local.get(['contextAction', 'contextSelection'], (result) => {
      if (result.contextAction) {
        // Send back the context action and clear it
        sendResponse({ 
          action: result.contextAction,
          selection: result.contextSelection || currentSelection 
        });
        
        // Clear the stored context action after it's been used
        chrome.storage.local.remove(['contextAction', 'contextSelection']);
      } else {
        sendResponse({ action: null });
      }
    });
    return true;
  }
});