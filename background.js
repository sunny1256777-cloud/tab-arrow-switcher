/**
 * Tab Arrow Switcher - Background Service Worker
 * Bulletproof tab navigation engine across all open tabs.
 */

const DEFAULT_SETTINGS = {
  wrapAround: true,
  showHud: true,
  protectMedia: true,
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

// Ensure script is ready when tabs load/navigate
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
function performSwitch(direction, tabs, settings) {
  let validTabs = [...tabs];

  // Exclude pinned tabs if requested
  if (settings.skipPinned) {
    validTabs = validTabs.filter((t) => !t.pinned);
    if (validTabs.length <= 1) return;
  }

  // CRITICAL: Always sort tabs by their visual index (0, 1, 2, 3...)
  validTabs.sort((a, b) => a.index - b.index);

  const activeIndex = validTabs.findIndex((t) => t.active);
  if (activeIndex === -1) return;

  let targetIndex;
  if (direction === 'left') {
    if (activeIndex === 0) {
      if (settings.wrapAround) {
        targetIndex = validTabs.length - 1;
      } else {
        return;
      }
    } else {
      targetIndex = activeIndex - 1;
    }
  } else {
    // direction === 'right'
    if (activeIndex >= validTabs.length - 1) {
      if (settings.wrapAround) {
        targetIndex = 0;
      } else {
        return;
      }
    } else {
      targetIndex = activeIndex + 1;
    }
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
    }, 30);
  });
}

/**
 * Switch tabs in active window
 */
function switchTab(direction, windowId = null) {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (windowId) {
      chrome.tabs.query({ windowId: windowId }, (tabs) => {
        if (tabs && tabs.length > 1) {
          performSwitch(direction, tabs, settings);
        } else {
          queryActiveWindowTabs(direction, settings);
        }
      });
    } else {
      queryActiveWindowTabs(direction, settings);
    }
  });
}

function queryActiveWindowTabs(direction, settings) {
  chrome.tabs.query({ lastFocusedWindow: true }, (tabs) => {
    if (tabs && tabs.length > 1) {
      performSwitch(direction, tabs, settings);
    } else {
      // Fallback: find active tab across all windows
      chrome.tabs.query({}, (allTabs) => {
        if (!allTabs || allTabs.length <= 1) return;
        const activeTab = allTabs.find((t) => t.active);
        if (activeTab) {
          const winTabs = allTabs.filter((t) => t.windowId === activeTab.windowId);
          if (winTabs.length > 1) {
            performSwitch(direction, winTabs, settings);
          }
        }
      });
    }
  });
}

// Listen for messages from Content Script and Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SWITCH_TAB') {
    const winId = sender.tab ? sender.tab.windowId : null;
    switchTab(message.direction, winId);
    sendResponse({ success: true });
  } else if (message.action === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      sendResponse({ settings });
    });
    return true;
  }
});
