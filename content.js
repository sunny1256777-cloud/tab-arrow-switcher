/**
 * Tab Arrow Switcher - Content Script
 * Directly captures Left/Right arrow keys for instant tab switching.
 */

(() => {
  // If an older instance handler is registered on window, remove it
  if (window.__tabArrowSwitcherHandler) {
    window.removeEventListener('keydown', window.__tabArrowSwitcherHandler, true);
  }

  let settings = {
    wrapAround: true,
    showHud: true,
    protectMedia: false,
  };

  let hudTimeout = null;
  let lastSwitchTime = 0;
  const SWITCH_COOLDOWN = 180; // ms minimum delay between switches to prevent key storms

  // Load settings
  chrome.storage.sync.get(settings, (stored) => {
    if (stored) settings = { ...settings, ...stored };
  });

  // Listen for real-time setting updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      for (const [key, change] of Object.entries(changes)) {
        settings[key] = change.newValue;
      }
    }
  });

  /**
   * Request background script to switch tab
   */
  function triggerTabSwitch(direction) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) return;
      chrome.runtime.sendMessage(
        {
          action: 'SWITCH_TAB',
          direction: direction,
        },
        () => {
          if (chrome.runtime.lastError) {
            // Silently swallow context reload disconnects
          }
        }
      );
    } catch (e) {
      // Swallowed context invalidated errors
    }
  }

  /**
   * Checks if user is actively editing/typing text in an input or textarea
   */
  function isUserTyping(isLeft, isRight) {
    const el = document.activeElement;
    if (!el) return false;

    // Multiline editors or contenteditable -> Protect typing
    if (el.tagName === 'TEXTAREA' || el.isContentEditable) {
      return true;
    }

    // Standard single-line inputs
    if (el.tagName === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      const textTypes = ['text', 'search', 'email', 'url', 'tel', 'password', 'number'];
      if (!textTypes.includes(type)) {
        return false;
      }

      // If search bar or input is completely empty, allow tab switch
      if (!el.value || el.value.length === 0) {
        return false;
      }

      // If user is at the boundary of input text:
      // Left arrow at beginning -> allow tab switch
      // Right arrow at end -> allow tab switch
      try {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (isLeft && start === 0 && end === 0) {
          return false;
        }
        if (isRight && start === el.value.length && end === el.value.length) {
          return false;
        }
      } catch (err) {}

      return true;
    }

    return false;
  }

  /**
   * Main Keydown Handler
   */
  function handleKeyDown(e) {
    const isLeft = e.key === 'ArrowLeft' || e.code === 'ArrowLeft' || e.keyCode === 37;
    const isRight = e.key === 'ArrowRight' || e.code === 'ArrowRight' || e.keyCode === 39;

    // Only handle plain Left and Right arrow keys
    if (!isLeft && !isRight) return;

    // Never intercept if modifier keys (Ctrl, Alt, Shift, Meta/Cmd) are pressed!
    // This ensures Alt+Left (Back) or Ctrl+Tab work completely natively without interference
    if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;

    // Cooldown check to prevent runaway spam or held keys
    const now = Date.now();
    if (now - lastSwitchTime < SWITCH_COOLDOWN) {
      e.preventDefault();
      return;
    }

    // Check if user is typing
    if (isUserTyping(isLeft, isRight)) {
      return;
    }

    // Optional media protection (if user toggled it on in popup)
    if (settings.protectMedia) {
      const activeVideo = document.querySelector('video');
      if (activeVideo && !activeVideo.paused) {
        return;
      }
    }

    // All clear -> Trigger instant switch!
    lastSwitchTime = now;
    e.preventDefault();
    e.stopPropagation();

    const direction = isLeft ? 'left' : 'right';
    triggerTabSwitch(direction);
  }

  // Save reference on window so subsequent runs can cleanly remove it
  window.__tabArrowSwitcherHandler = handleKeyDown;
  window.addEventListener('keydown', handleKeyDown, true);

  /**
   * Render Sleek Floating Glassmorphic HUD
   */
  function displayHud(data) {
    if (!data.showHud) return;

    let container = document.getElementById('tab-arrow-hud-overlay');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tab-arrow-hud-overlay';
      container.className = 'tab-arrow-hud-overlay';
      (document.body || document.documentElement).appendChild(container);
    }

    const directionIcon = data.direction === 'left' ? '◀' : '▶';

    container.innerHTML = `
      <div class="tab-arrow-hud-card">
        <div class="tab-arrow-hud-arrow-indicator ${data.direction}">
          ${directionIcon}
        </div>
        <div class="tab-arrow-hud-center">
          <div class="tab-arrow-hud-meta">
            <span class="tab-arrow-hud-badge">Tab ${data.currentIndex} of ${data.totalTabs}</span>
          </div>
          <div class="tab-arrow-hud-title" title="${escapeHtml(data.title)}">
            ${escapeHtml(data.title)}
          </div>
        </div>
      </div>
    `;

    container.classList.remove('hiding');
    container.classList.add('visible');

    if (hudTimeout) clearTimeout(hudTimeout);

    hudTimeout = setTimeout(() => {
      if (container) {
        container.classList.remove('visible');
        container.classList.add('hiding');
        setTimeout(() => {
          if (container && container.classList.contains('hiding')) {
            container.remove();
          }
        }, 250);
      }
    }, 1100);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Tab activation listener to show HUD on the active tab
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'TAB_ACTIVATED') {
      displayHud(message);
    }
  });
})();
