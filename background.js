/**
 * Tab Arrow Switcher - Background Service Worker
 * Bulletproof, lightweight tab navigation engine.
 */

const DEFAULT_SETTINGS = {
  wrapAround: true,
  showHud: true,
  protectMedia: false,
  skipPinned: false,
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    chrome.storage.sync.set(stored);
  });
});

let isSwitching = false;

/**
 * Perform exact tab index calculation and switch
 */
function performSwitch(direction, tabs, currentTabId, settings) {
  let validTabs = [...tabs];

  // Exclude pinned tabs only if explicitly requested
  if (settings.skipPinned) {
    validTabs = validTabs.filter((t) => !t.pinned);
  }

  if (validTabs.length <= 1) {
    isSwitching = false;
    return;
  }

  // Always sort tabs strictly by their visual horizontal index (0, 1, 2, 3...)
  validTabs.sort((a, b) => a.index - b.index);

  // Find active index
  let activeIndex = -1;
  if (currentTabId) {
    activeIndex = validTabs.findIndex((t) => t.id === currentTabId);
  }
  if (activeIndex === -1) {
    activeIndex = validTabs.findIndex((t) => t.active);
  }
  if (activeIndex === -1) {
    activeIndex = 0;
  }

  let targetIndex;
  if (direction === 'left') {
    targetIndex = (activeIndex - 1 + validTabs.length) % validTabs.length;
  } else {
    targetIndex = (activeIndex + 1) % validTabs.length;
  }

  const targetTab = validTabs[targetIndex];
  if (!targetTab || !targetTab.id || targetTab.id === currentTabId) {
    isSwitching = false;
    return;
  }

  // Switch to target tab
  chrome.tabs.update(targetTab.id, { active: true }, (updatedTab) => {
    isSwitching = false;

    if (chrome.runtime.lastError || !updatedTab) return;

    // Send HUD display notification to target tab
    if (settings.showHud) {
      const hudPayload = {
        action: 'TAB_ACTIVATED',
        currentIndex: targetIndex + 1,
        totalTabs: validTabs.length,
        title: updatedTab.title || 'Tab',
        direction: direction,
        showHud: true,
      };

      chrome.tabs.sendMessage(targetTab.id, hudPayload).catch(() => {});
    }
  });
}

/**
 * Switch tabs in the active window safely
 */
function switchTab(direction, senderTab) {
  if (isSwitching) return;
  isSwitching = true;

  // Safety fallback to release lock
  setTimeout(() => {
    isSwitching = false;
  }, 250);

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    const winId = senderTab && senderTab.windowId ? senderTab.windowId : null;
    const tabId = senderTab && senderTab.id ? senderTab.id : null;

    if (winId) {
      chrome.tabs.query({ windowId: winId }, (tabs) => {
        if (tabs && tabs.length > 1) {
          performSwitch(direction, tabs, tabId, settings);
        } else {
          isSwitching = false;
        }
      });
    } else {
      // Fallback (e.g. from popup): query last focused window
      chrome.tabs.query({ lastFocusedWindow: true }, (tabs) => {
        if (tabs && tabs.length > 1) {
          performSwitch(direction, tabs, tabId, settings);
        } else {
          isSwitching = false;
        }
      });
    }
  });
}

// Listen for messages from Content Script and Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SWITCH_TAB') {
    switchTab(message.direction, sender.tab || null);
    sendResponse({ success: true });
    return false;
  } else if (message.action === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      sendResponse({ settings });
    });
    return true;
  }
});
