// Background script for LLM Chrome Extension
console.log('Background script loaded');

// Optimized storage for page information and selection
let currentPageInfo = null;
let currentSelection = '';

// Utility function to get active tab
async function getActiveTab(activeTabId = null) {
  if (activeTabId) {
    return { id: activeTabId };
  }
  
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  return tabs.length > 0 ? tabs[0] : null;
}

// Utility function to send message to tab
async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.log(`Could not send message to tab ${tabId}:`, error.message);
    return null;
  }
}

// Function to notify context actions to extension contexts
function notifyContextAction(action, selection) {
  console.log('Notifying context action:', action, 'with selection:', selection);
  
  chrome.runtime.sendMessage({ 
    action: 'contextActionNotification', 
    contextAction: action,
    contextSelection: selection 
  }).catch(error => {
    console.log('Could not send context action notification:', error.message);
  });
}

// Create context menu items when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Create parent menu item
  chrome.contextMenus.create({
    id: 'llm-extension',
    title: 'LLM Chat Extension',
    contexts: ['all']
  });

  // Create context menu items
  const menuItems = [
    {
      id: 'ask-about-selection',
      title: '선택된 영역에 대해 "새 창"으로 열기',
      contexts: ['selection']
    },
    {
      id: 'open-in-side-panel',
      title: '선택된 영역에 대해 "사이드 패널"에서 열기',
      contexts: ['selection']
    },
    {
      id: 'summarize-in-side-panel',
      title: '선택된 영역에 대해 "요약"',
      contexts: ['selection']
    }
  ];

  menuItems.forEach(item => {
    chrome.contextMenus.create({
      ...item,
      parentId: 'llm-extension'
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  currentSelection = info.selectionText || '';
  
  const contextData = {
    contextSelection: currentSelection,
    activeTabId: tab.id,
    actionProcessed: false
  };

  switch (info.menuItemId) {
    case 'llm-extension':
      chrome.sidePanel.open({ windowId: tab.windowId });
      break;
      
    case 'ask-about-selection':
      chrome.storage.local.set({ 
        contextAction: 'selection',
        ...contextData
      }, () => {
        chrome.windows.create({
          url: chrome.runtime.getURL('popup.html'),
          type: 'popup',
          width: 400,
          height: 600,
          focused: true
        });
      });
      break;
      
    case 'open-in-side-panel':
      chrome.storage.local.set({ 
        contextAction: 'selection',
        ...contextData
      }, () => {
        chrome.sidePanel.open({ windowId: tab.windowId }).then(() => {
          setTimeout(() => notifyContextAction('selection', currentSelection), 100);
        }).catch(() => {
          notifyContextAction('selection', currentSelection);
        });
      });
      break;
      
    case 'summarize-in-side-panel':
      chrome.storage.local.set({ 
        contextAction: 'summarize',
        ...contextData
      }, () => {
        chrome.sidePanel.open({ windowId: tab.windowId }).then(() => {
          setTimeout(() => notifyContextAction('summarize', currentSelection), 100);
        }).catch(() => {
          notifyContextAction('summarize', currentSelection);
        });
      });
      break;
  }
});

// Optimized message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background: Message received:', message.action);
  
  switch (message.action) {
    case 'contentScriptReady':
      console.log('Content script ready on tab:', sender.tab?.id);
      break;
      
    case 'selectionChanged':
      currentSelection = message.selectedText;
      console.log('Selection updated:', currentSelection);
      break;
      
    case 'getCurrentPageInfo':
      handleGetPageInfo(sendResponse);
      return true;
      
    case 'getSelectedText':
      handleGetSelectedText(sendResponse);
      return true;
      
    case 'clearSelection':
      handleClearSelection(sendResponse);
      return true;
      
    case 'checkContextAction':
      handleCheckContextAction(sendResponse);
      return true;
      
    default:
      console.log('Background: Unknown action:', message.action);
  }
});

// Handler for getCurrentPageInfo
async function handleGetPageInfo(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['activeTabId']);
    const activeTab = await getActiveTab(result.activeTabId);
    
    if (!activeTab) {
      sendResponse({ 
        title: 'No active tab',
        url: '',
        description: '',
        selectedText: currentSelection,
        mainContent: '',
        hasSelection: currentSelection.length > 0
      });
      return;
    }
    
    const response = await sendMessageToTab(activeTab.id, { action: 'getPageInfo' });
    
    if (response) {
      // Add tracked selection if needed
      if (!response.selectedText && currentSelection) {
        response.selectedText = currentSelection;
        response.hasSelection = true;
      }
      currentPageInfo = response;
      sendResponse(response);
    } else {
      sendResponse({ 
        title: 'Error getting page info',
        url: '',
        description: '',
        selectedText: currentSelection,
        mainContent: '',
        hasSelection: currentSelection.length > 0
      });
    }
  } catch (error) {
    console.error('Error in handleGetPageInfo:', error);
    sendResponse({ 
      title: 'Error getting page info',
      url: '',
      description: '',
      selectedText: currentSelection,
      mainContent: '',
      hasSelection: currentSelection.length > 0
    });
  }
}

// Handler for getSelectedText
async function handleGetSelectedText(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['activeTabId']);
    const activeTab = await getActiveTab(result.activeTabId);
    
    if (!activeTab) {
      sendResponse({ selectedText: currentSelection });
      return;
    }
    
    const response = await sendMessageToTab(activeTab.id, { action: 'getSelectedText' });
    sendResponse(response || { selectedText: currentSelection });
  } catch (error) {
    console.log('Error in handleGetSelectedText:', error);
    sendResponse({ selectedText: currentSelection });
  }
}

// Handler for clearSelection
async function handleClearSelection(sendResponse) {
  try {
    currentSelection = '';
    
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length > 0) {
      const response = await sendMessageToTab(tabs[0].id, { action: 'clearSelection' });
      if (response?.success) {
        sendResponse({ success: true, message: 'Selection cleared successfully' });
      } else {
        sendResponse({ success: true, message: 'Selection cleared in background, content script not available' });
      }
    } else {
      sendResponse({ success: true, message: 'Selection cleared in background, no active tabs' });
    }
  } catch (error) {
    console.log('Error in handleClearSelection:', error);
    sendResponse({ success: true, message: 'Selection cleared in background, error accessing tabs' });
  }
}

// Handler for checkContextAction
async function handleCheckContextAction(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['contextAction', 'contextSelection', 'actionProcessed']);
    
    if (result.contextAction && !result.actionProcessed) {
      // Send back the context action and mark it as processed
      sendResponse({ 
        hasAction: true,
        action: result.contextAction,
        selection: result.contextSelection || currentSelection 
      });
      
      // Mark the action as processed
      chrome.storage.local.set({ actionProcessed: true });
      
      // Clear the stored context action after delay
      setTimeout(() => {
        chrome.storage.local.remove(['contextAction', 'contextSelection', 'actionProcessed']);
      }, 1000);
    } else {
      sendResponse({ 
        hasAction: false,
        action: null,
        selection: ''
      });
    }
  } catch (error) {
    console.log('Error in handleCheckContextAction:', error);
    sendResponse({ 
      hasAction: false,
      action: null,
      selection: ''
    });
  }
}

console.log('Background script setup complete');