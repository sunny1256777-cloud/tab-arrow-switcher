/**
 * Tab Arrow Switcher - Popup Controller
 */

const DEFAULT_SETTINGS = {
  wrapAround: true,
  showHud: true,
  protectMedia: false,
  skipPinned: false,
};

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    const toggles = ['wrapAround', 'showHud', 'protectMedia', 'skipPinned'];
    toggles.forEach((key) => {
      const el = document.getElementById(key);
      if (el) el.checked = !!settings[key];
    });
  });

  // Listen to toggle changes
  const toggles = ['wrapAround', 'showHud', 'protectMedia', 'skipPinned'];
  toggles.forEach((key) => {
    const el = document.getElementById(key);
    if (el) {
      el.addEventListener('change', () => {
        chrome.storage.sync.set({ [key]: el.checked });
      });
    }
  });

  // Helper to trigger tab switch
  function doSwitch(direction) {
    chrome.runtime.sendMessage({ action: 'SWITCH_TAB', direction });
  }

  // Test Buttons
  const btnPrev = document.getElementById('btnPrev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => doSwitch('left'));
  }

  const btnNext = document.getElementById('btnNext');
  if (btnNext) {
    btnNext.addEventListener('click', () => doSwitch('right'));
  }

  // KEYBOARD ARROW LISTENER FOR POPUP
  window.addEventListener('keydown', (e) => {
    const isLeft = e.key === 'ArrowLeft' || e.code === 'ArrowLeft' || e.keyCode === 37;
    const isRight = e.key === 'ArrowRight' || e.code === 'ArrowRight' || e.keyCode === 39;

    if (isLeft) {
      e.preventDefault();
      if (btnPrev) {
        btnPrev.style.transform = 'scale(0.95)';
        setTimeout(() => { btnPrev.style.transform = ''; }, 100);
      }
      doSwitch('left');
    } else if (isRight) {
      e.preventDefault();
      if (btnNext) {
        btnNext.style.transform = 'scale(0.95)';
        setTimeout(() => { btnNext.style.transform = ''; }, 100);
      }
      doSwitch('right');
    }
  });
});
