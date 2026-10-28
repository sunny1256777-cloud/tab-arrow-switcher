/**
 * Tab Arrow Switcher - Background Service Worker
 * Bulletproof tab navigation engine across all open tabs.
 */

const DEFAULT_SETTINGS = {
  wrapAround: true,
  showHud: true,
  protectMedia: false, // Default false so it NEVER blocks switching on video pages unless user turns it on
  skipPinned: false,
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    chrome.storage.sync.set(stored);
  });
  injectContentScriptIntoAllTabs();
});

/**
 * Automatically inject content script into all open tabs
 */
function injectContentScriptIntoAllTabs() {
  if (!chrome.scripting) return;

  chrome.tabs.query({}, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      if (
        !tab.url.startsWith('http://') &&
        !tab.url.startsWith('https://') &&
        !tab.url.startsWith('file://')
      ) {
        continue;
      }

      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        })
        .catch(() => {});

      chrome.scripting
        .insertCSS({
          target: { tabId: tab.id },
          files: ['hud.css'],
        })
        .catch(() => {});
    }
  });
}

// Ensure script is ready when tabs load or navigate
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    (tab.url.startsWith('http://') || tab.url.startsWith('https://') || tab.url.startsWith('file://'))
  ) {
    if (chrome.scripting) {
      chrome.scripting
        .executeScript({
          target: { tabId: tabId },
          files: ['content.js'],
        })
        .catch(() => {});
      chrome.scripting
        .insertCSS({
          target: { tabId: tabId },
          files: ['hud.css'],
        })
        .catch(() => {});
    }
  }
});

// Run injection when service worker wakes up
injectContentScriptIntoAllTabs();

/**
 * Perform exact tab index calculation and switch
 */
function performSwitch(direction, tabs, currentTabId, settings) {
  let validTabs = [...tabs];

  // Exclude pinned tabs only if explicitly requested
  if (settings.skipPinned) {
    validTabs = validTabs.filter((t) => !t.pinned);
  }

  if (validTabs.length <= 1) return;

  // CRITICAL: Always sort tabs strictly by their visual index (0, 1, 2, 3...)
  validTabs.sort((a, b) => a.index - b.index);

  // Find active index by exact tab ID first, fallback to active property
  let activeIndex = -1;
  if (currentTabId) {
    activeIndex = validTabs.findIndex((t) => t.id === currentTabId);
  }
  if (activeIndex === -1) {
    activeIndex = validTabs.findIndex((t) => t.active);
  }
  if (activeIndex === -1) activeIndex = 0;

  let targetIndex;
  if (direction === 'left') {
    targetIndex = (activeIndex - 1 + validTabs.length) % validTabs.length;
  } else {
    targetIndex = (activeIndex + 1) % validTabs.length;
  }

  const targetTab = validTabs[targetIndex];
  if (!targetTab || !targetTab.id) return;

  chrome.tabs.update(targetTab.id, { active: true }, (updatedTab) => {
    if (chrome.runtime.lastError || !updatedTab) return;

    // Bring keyboard focus to window
    chrome.windows.update(updatedTab.windowId, { focused: true }).catch(() => {});

    // Notify the newly active tab to show HUD and focus window
    const prevTab = validTabs[(targetIndex - 1 + validTabs.length) % validTabs.length];
    const nextTab = validTabs[(targetIndex + 1) % validTabs.length];

    const hudPayload = {
      action: 'TAB_ACTIVATED',
      currentIndex: targetIndex + 1,
      totalTabs: validTabs.length,
      title: updatedTab.title || 'Untitled Tab',
      prevTitle: prevTab ? prevTab.title || 'Previous Tab' : '',
      nextTitle: nextTab ? nextTab.title || 'Next Tab' : '',
      direction: direction,
      showHud: !!settings.showHud,
    };

    setTimeout(() => {
      chrome.tabs.sendMessage(updatedTab.id, hudPayload).catch(() => {});
    }, 20);
  });
}

/**
 * Switch tabs in active window
 */
function switchTab(direction, senderTab = null) {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    const winId = senderTab ? senderTab.windowId : null;
    const tabId = senderTab ? senderTab.id : null;

    if (winId) {
      chrome.tabs.query({ windowId: winId }, (tabs) => {
        if (tabs && tabs.length > 1) {
          performSwitch(direction, tabs, tabId, settings);
        } else {
          queryActiveWindowTabs(direction, tabId, settings);
        }
      });
    } else {
      queryActiveWindowTabs(direction, tabId, settings);
    }
  });
}

function queryActiveWindowTabs(direction, currentTabId, settings) {
  chrome.tabs.query({ lastFocusedWindow: true }, (tabs) => {
    if (tabs && tabs.length > 1) {
      performSwitch(direction, tabs, currentTabId, settings);
    } else {
      chrome.tabs.query({}, (allTabs) => {
        if (!allTabs || allTabs.length <= 1) return;
        const activeTab = allTabs.find((t) => t.active);
        if (activeTab) {
          const winTabs = allTabs.filter((t) => t.windowId === activeTab.windowId);
          if (winTabs.length > 1) {
            performSwitch(direction, winTabs, activeTab.id, settings);
          }
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
  } else if (message.action === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      sendResponse({ settings });
    });
    return true;
  }
});
