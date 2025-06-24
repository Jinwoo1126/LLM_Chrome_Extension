// Background script for LLM Chrome Extension - Optimized Version
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

// 안전한 sidepanel 열기 함수 - 사용자 제스처 컨텍스트 유지
function openSidePanelSafely(tabInfo = null) {
  try {
    if (tabInfo && tabInfo.id && tabInfo.id !== -1) {
      // 유효한 tabId가 있는 경우
      chrome.sidePanel.open({ tabId: tabInfo.id });
      console.log('Sidepanel opened for tab:', tabInfo.id);
    } else if (tabInfo && tabInfo.windowId && tabInfo.windowId !== -1) {
      // tabId가 없거나 유효하지 않지만 windowId가 있는 경우
      chrome.sidePanel.open({ windowId: tabInfo.windowId });
      console.log('Sidepanel opened for window:', tabInfo.windowId);
    } else {
      // 둘 다 없는 경우 현재 창에서 열기 (Chrome의 현재 창 ID 사용)
      chrome.windows.getCurrent((window) => {
        if (window && window.id) {
          chrome.sidePanel.open({ windowId: window.id });
          console.log('Sidepanel opened for current window:', window.id);
        } else {
          console.error('Could not get current window information');
        }
      });
    }
  } catch (error) {
    console.error('Error opening sidepanel:', error);
  }
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
    activeTabId: tab?.id || null,
    actionProcessed: false
  };

  switch (info.menuItemId) {
    case 'llm-extension':
      openSidePanelSafely(tab);
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
      });
      // 사용자 제스처 컨텍스트 유지를 위해 즉시 실행
      openSidePanelSafely(tab);
      // 약간의 지연 후 알림 - 하지만 sidepanel 열기는 먼저
      setTimeout(() => notifyContextAction('selection', currentSelection), 100);
      break;
      
    case 'summarize-in-side-panel':
      chrome.storage.local.set({ 
        contextAction: 'summarize',
        ...contextData
      });
      // 사용자 제스처 컨텍스트 유지를 위해 즉시 실행
      openSidePanelSafely(tab);
      // 약간의 지연 후 알림 - 하지만 sidepanel 열기는 먼저
      setTimeout(() => notifyContextAction('summarize', currentSelection), 100);
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
    console.log('Background: Starting complete selection clear...');
    
    // Clear background selection
    currentSelection = '';
    
    // Clear all selection-related storage
    await chrome.storage.local.remove([
      'contextAction',
      'contextSelection', 
      'actionProcessed',
      'activeTabId'
    ]);
    
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length > 0) {
      const response = await sendMessageToTab(tabs[0].id, { action: 'clearSelection' });
      if (response?.success) {
        console.log('Background: Selection cleared successfully in content script');
        sendResponse({ success: true, message: 'Selection cleared successfully' });
      } else {
        console.log('Background: Content script not available, but background cleared');
        sendResponse({ success: true, message: 'Selection cleared in background, content script not available' });
      }
    } else {
      console.log('Background: No active tabs, background selection cleared');
      sendResponse({ success: true, message: 'Selection cleared in background, no active tabs' });
    }
    
    console.log('Background: Complete selection clear finished');
  } catch (error) {
    console.log('Error in handleClearSelection:', error);
    // Ensure currentSelection is cleared even on error
    currentSelection = '';
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