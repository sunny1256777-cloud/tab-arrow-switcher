/**
 * Tab Arrow Switcher - Background Service Worker
 * Manages tab switching logic, shortcuts, and HUD notifications.
 */

const DEFAULT_SETTINGS = {
  mode: 'direct', // 'direct' (ArrowLeft / ArrowRight), 'alt' (Alt + Arrow), 'double' (Double-Tap)
  wrapAround: true,
  showHud: true,
  protectTyping: true,
  protectMedia: true,
  skipPinned: false,
};

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    chrome.storage.sync.set(stored);
  });
  injectContentScriptIntoAllTabs();
});

/**
 * Automatically inject content script & HUD CSS into all already-open tabs
 * so the user doesn't even need to refresh existing pages!
 */
function injectContentScriptIntoAllTabs() {
  if (!chrome.scripting) return;

  chrome.tabs.query({}, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      // Skip restricted internal browser URLs
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

// Try injecting on service worker startup too
injectContentScriptIntoAllTabs();

/**
 * Perform actual active tab index calculation and update
 */
function performSwitch(direction, tabs, settings) {
  let validTabs = tabs;
  if (settings.skipPinned) {
    validTabs = tabs.filter((t) => !t.pinned);
    if (validTabs.length <= 1) return;
  }

  const activeIndex = validTabs.findIndex((t) => t.active);
  if (activeIndex === -1) return;

  let targetIndex;
  if (direction === 'left') {
    targetIndex = activeIndex - 1;
    if (targetIndex < 0) {
      if (settings.wrapAround) {
        targetIndex = validTabs.length - 1;
      } else {
        return;
      }
    }
  } else {
    targetIndex = activeIndex + 1;
    if (targetIndex >= validTabs.length) {
      if (settings.wrapAround) {
        targetIndex = 0;
      } else {
        return;
      }
    }
  }

  const targetTab = validTabs[targetIndex];
  if (!targetTab || !targetTab.id) return;

  chrome.tabs.update(targetTab.id, { active: true }, (updatedTab) => {
    if (chrome.runtime.lastError || !updatedTab) return;

    // Send HUD notification to the newly active tab
    if (settings.showHud) {
      const prevTab = validTabs[(targetIndex - 1 + validTabs.length) % validTabs.length];
      const nextTab = validTabs[(targetIndex + 1) % validTabs.length];

      const hudPayload = {
        action: 'SHOW_HUD',
        currentIndex: targetIndex + 1,
        totalTabs: validTabs.length,
        title: updatedTab.title || 'Untitled Tab',
        favIconUrl: updatedTab.favIconUrl || '',
        prevTitle: prevTab ? prevTab.title || 'Previous Tab' : '',
        nextTitle: nextTab ? nextTab.title || 'Next Tab' : '',
        direction: direction,
      };

      setTimeout(() => {
        chrome.tabs.sendMessage(updatedTab.id, hudPayload).catch(() => {});
      }, 40);
    }
  });
}

/**
 * Query fallback when windowId is not explicitly provided
 */
function queryLastFocused(direction, settings) {
  chrome.tabs.query({ lastFocusedWindow: true }, (tabs) => {
    if (tabs && tabs.length > 1) {
      performSwitch(direction, tabs, settings);
    } else {
      // Ultimate fallback: query all tabs and group by the active tab's window
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

/**
 * Switch to left (previous) or right (next) tab in current window
 */
function switchTab(direction, windowId = null) {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (windowId) {
      chrome.tabs.query({ windowId: windowId }, (tabs) => {
        if (tabs && tabs.length > 1) {
          performSwitch(direction, tabs, settings);
        } else {
          queryLastFocused(direction, settings);
        }
      });
    } else {
      queryLastFocused(direction, settings);
    }
  });
}

// 1. Listen for Chrome Native Keyboard Commands (Alt+Left, Alt+Right)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'switch-tab-left') {
    switchTab('left');
  } else if (command === 'switch-tab-right') {
    switchTab('right');
  }
});

// 2. Listen for messages from Content Scripts and Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SWITCH_TAB') {
    const winId = sender.tab ? sender.tab.windowId : null;
    switchTab(message.direction, winId);
    sendResponse({ success: true });
  } else if (message.action === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      sendResponse({ settings });
    });
    return true; // async response
  }
});
