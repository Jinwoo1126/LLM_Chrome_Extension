// Background script for LLM Chrome Extension
console.log('Background script loaded');

// Store page information when received from content script
let currentPageInfo = null;
let currentSelection = '';

// Function to notify context actions to side panel
function notifyContextAction(action, selection) {
  console.log('Notifying context action:', action, 'with selection:', selection);
  
  // Send message to all extension contexts (popup, side panel)
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
  // Create a parent menu item
  chrome.contextMenus.create({
    id: 'llm-extension',
    title: 'LLM Chat Extension',
    contexts: ['all']
  });

  // Create a menu item for asking about selected text
  chrome.contextMenus.create({
    id: 'ask-about-selection',
    parentId: 'llm-extension',
    title: '선택된 영역에 대해 "새 창"으로 열기',
    contexts: ['selection']
  });

  // Create a menu item for opening in side panel
  chrome.contextMenus.create({
    id: 'open-in-side-panel',
    parentId: 'llm-extension',
    title: '선택된 영역에 대해 "사이드 패널"에서 열기',
    contexts: ['selection']
  });

  // Create a menu item for summarizing in side panel
  chrome.contextMenus.create({
    id: 'summarize-in-side-panel',
    parentId: 'llm-extension',
    title: '선택된 영역에 대해 "요약"',
    contexts: ['selection']
  });

  // Create a menu item for translating in side panel
  // chrome.contextMenus.create({
  //   id: 'translate-in-side-panel',
  //   parentId: 'llm-extension',
  //   title: 'Translate to Korean in Side Panel',
  //   contexts: ['selection']
  // });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'llm-extension') {
    // Open side panel when clicking the main menu item
    chrome.sidePanel.open({ windowId: tab.windowId });
  } else if (info.menuItemId === 'ask-about-selection') {
    // 선택된 텍스트와 탭 ID를 저장하고 확장 프로그램 팝업을 직접 열기
    currentSelection = info.selectionText || '';
    chrome.storage.local.set({ 
      'contextAction': 'selection',
      'contextSelection': currentSelection,
      'activeTabId': tab.id
    }, () => {
      // 새 창에서 팝업 HTML을 열기
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 400,
        height: 600,
        focused: true
      });
    });
  } else if (info.menuItemId === 'open-in-side-panel') {
    // 선택된 텍스트와 탭 ID를 저장하고 사이드패널 열기
    currentSelection = info.selectionText || '';
    chrome.storage.local.set({ 
      'contextAction': 'selection',
      'contextSelection': currentSelection,
      'activeTabId': tab.id,
      'actionProcessed': false
    }, () => {
      // 사이드패널 열기
      chrome.sidePanel.open({ windowId: tab.windowId }).then(() => {
        // 사이드패널이 열린 후 컨텍스트 액션 메시지 전송
        setTimeout(() => {
          notifyContextAction('selection', currentSelection);
        }, 100);
      }).catch(() => {
        // 사이드패널이 이미 열려있는 경우에도 컨텍스트 액션 알림
        notifyContextAction('selection', currentSelection);
      });
    });
  } else if (info.menuItemId === 'summarize-in-side-panel') {
    // 선택된 텍스트와 탭 ID를 저장하고 사이드패널에서 요약
    currentSelection = info.selectionText || '';
    chrome.storage.local.set({ 
      'contextAction': 'summarize',
      'contextSelection': currentSelection,
      'activeTabId': tab.id,
      'actionProcessed': false
    }, () => {
      // 사이드패널 열기
      chrome.sidePanel.open({ windowId: tab.windowId }).then(() => {
        // 사이드패널이 열린 후 컨텍스트 액션 메시지 전송
        setTimeout(() => {
          notifyContextAction('summarize', currentSelection);
        }, 100);
      }).catch(() => {
        // 사이드패널이 이미 열려있는 경우에도 컨텍스트 액션 알림
        notifyContextAction('summarize', currentSelection);
      });
    });
  } else if (info.menuItemId === 'translate-in-side-panel') {
    // 선택된 텍스트와 탭 ID를 저장하고 사이드패널에서 번역
    currentSelection = info.selectionText || '';
    chrome.storage.local.set({ 
      'contextAction': 'translate',
      'contextSelection': currentSelection,
      'activeTabId': tab.id,
      'actionProcessed': false
    }, () => {
      // 사이드패널 열기
      chrome.sidePanel.open({ windowId: tab.windowId }).then(() => {
        // 사이드패널이 열린 후 컨텍스트 액션 메시지 전송
        setTimeout(() => {
          notifyContextAction('translate', currentSelection);
        }, 100);
      }).catch(() => {
        // 사이드패널이 이미 열려있는 경우에도 컨텍스트 액션 알림
        notifyContextAction('translate', currentSelection);
      });
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
      // 저장된 activeTabId가 있으면 해당 탭 정보를 사용
      chrome.storage.local.get(['activeTabId'], function(result) {
        let activeTabId = result.activeTabId;
        
        if (tabs.length === 0 && !activeTabId) {
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
        
        const activeTab = activeTabId ? { id: activeTabId } : tabs[0];
        
        chrome.tabs.sendMessage(
          activeTab.id,
          { action: 'getPageInfo' },
          function(response) {
            if (chrome.runtime.lastError) {
              console.error('Error getting page info:', chrome.runtime.lastError);
              sendResponse({ 
                title: 'Error getting page info',
                url: '',
                description: '',
                selectedText: currentSelection,
                mainContent: '',
                hasSelection: currentSelection.length > 0
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
    });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  // When popup requests just the selected text
  if (message.action === 'getSelectedText') {
    chrome.storage.local.get(['activeTabId'], function(result) {
      let activeTabId = result.activeTabId;
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0 && !activeTabId) {
          sendResponse({ selectedText: currentSelection });
          return;
        }
        
        const activeTab = activeTabId ? { id: activeTabId } : tabs[0];
        
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
    });
    
    return true;
  }

  // Handle clear selection request
  if (message.action === 'clearSelection') {
    currentSelection = '';
    // Notify content script to clear selection
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'clearSelection' }, function(response) {
          if (chrome.runtime.lastError) {
            console.log('Could not send clearSelection to content script:', chrome.runtime.lastError.message);
            // Even if content script fails, we still consider it successful since we cleared the background selection
            sendResponse({ success: true, message: 'Selection cleared in background, content script not available' });
          } else {
            sendResponse({ success: true, message: 'Selection cleared successfully' });
          }
        });
      } else {
        // No active tabs, just clear background selection
        sendResponse({ success: true, message: 'Selection cleared in background, no active tabs' });
      }
    });
    return true;
  }

  // New message handler for checking context actions
  if (message.action === 'checkContextAction') {
    chrome.storage.local.get(['contextAction', 'contextSelection', 'actionProcessed'], (result) => {
      if (result.contextAction && !result.actionProcessed) {
        // Send back the context action and mark it as processed
        sendResponse({ 
          action: result.contextAction,
          selection: result.contextSelection || currentSelection 
        });
        
        // Mark the action as processed
        chrome.storage.local.set({ actionProcessed: true });
        
        // Clear the stored context action after it's been used
        setTimeout(() => {
          chrome.storage.local.remove(['contextAction', 'contextSelection', 'actionProcessed']);
        }, 1000); // Give enough time for the action to be processed
      } else {
        sendResponse({ action: null });
      }
    });
    return true;
  }
});