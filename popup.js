/**
 * Tab Arrow Switcher - Popup Controller
 */

const DEFAULT_SETTINGS = {
  mode: 'direct',
  wrapAround: true,
  showHud: true,
  protectTyping: true,
  protectMedia: true,
  skipPinned: false,
};

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    // Mode radio cards
    const modeInput = document.querySelector(`input[name="mode"][value="${settings.mode}"]`);
    if (modeInput) modeInput.checked = true;

    // Toggles
    const toggles = ['wrapAround', 'showHud', 'protectTyping', 'protectMedia', 'skipPinned'];
    toggles.forEach((key) => {
      const el = document.getElementById(key);
      if (el) el.checked = !!settings[key];
    });
  });

  // Listen to mode changes
  const modeInputs = document.querySelectorAll('input[name="mode"]');
  modeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      chrome.storage.sync.set({ mode: input.value });
    });
  });

  // Listen to toggle changes
  const toggles = ['wrapAround', 'showHud', 'protectTyping', 'protectMedia', 'skipPinned'];
  toggles.forEach((key) => {
    const el = document.getElementById(key);
    if (el) {
      el.addEventListener('change', () => {
        chrome.storage.sync.set({ [key]: el.checked });
      });
    }
  });

  // Test Buttons
  const btnPrev = document.getElementById('btnPrev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'SWITCH_TAB', direction: 'left' });
    });
  }

  const btnNext = document.getElementById('btnNext');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'SWITCH_TAB', direction: 'right' });
    });
  }

  // Open Chrome Shortcuts settings
  const openShortcuts = document.getElementById('openShortcuts');
  if (openShortcuts) {
    openShortcuts.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }
});
