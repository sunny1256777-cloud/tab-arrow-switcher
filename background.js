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
});

/**
 * Switch to left (previous) or right (next) tab in current window
 */
function switchTab(direction) {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length <= 1) return;

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

        // Broadcast HUD display message to the newly active tab
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

          // Give browser a micro-moment to focus before showing HUD
          setTimeout(() => {
            chrome.tabs.sendMessage(updatedTab.id, hudPayload).catch(() => {
              // Silently catch in case content script is not yet injected or restricted page
            });
          }, 30);
        }
      });
    });
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

// 2. Listen for messages from Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SWITCH_TAB') {
    switchTab(message.direction);
    sendResponse({ success: true });
  } else if (message.action === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      sendResponse({ settings });
    });
    return true; // async response
  }
});
