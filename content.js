/**
 * Tab Arrow Switcher - Content Script
 * Directly captures Left/Right arrow keys for instant tab switching.
 */

(() => {
  // Clean up any previously attached listener from an older extension instance
  if (window.__tabArrowSwitcherHandler) {
    window.removeEventListener('keydown', window.__tabArrowSwitcherHandler, true);
    document.removeEventListener('keydown', window.__tabArrowSwitcherHandler, true);
  }

  let settings = {
    wrapAround: true,
    showHud: true,
    protectMedia: false,
  };

  let hudTimeout = null;

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
      if (!chrome.runtime || !chrome.runtime.id) {
        return;
      }
      chrome.runtime.sendMessage({
        action: 'SWITCH_TAB',
        direction: direction,
      });
    } catch (e) {
      console.warn('[Tab Arrow Switcher]', e);
    }
  }

  /**
   * Main Keydown Handler
   */
  function handleKeyDown(e) {
    const isLeft = e.key === 'ArrowLeft' || e.code === 'ArrowLeft' || e.keyCode === 37;
    const isRight = e.key === 'ArrowRight' || e.code === 'ArrowRight' || e.keyCode === 39;

    // Only handle Left and Right arrow keys
    if (!isLeft && !isRight) return;

    // Do NOT intercept if modifier keys (Ctrl, Alt, Meta/Cmd) are pressed
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Only protect multiline textareas (e.g. composing comments/emails)
    const el = document.activeElement;
    if (el && el.tagName && el.tagName.toLowerCase() === 'textarea') {
      return; // Allow cursor movement inside multiline text
    }

    // Video watch page guard (only if user enabled it and video is playing)
    if (settings.protectMedia && window.location.pathname.startsWith('/watch')) {
      const video = document.querySelector('video');
      if (video && !video.paused && (el === video || el?.classList?.contains('html5-main-video'))) {
        return;
      }
    }

    // Trigger instant tab switch!
    const direction = isLeft ? 'left' : 'right';
    e.preventDefault();
    e.stopPropagation();
    triggerTabSwitch(direction);
  }

  // Save reference so future reloads can safely unbind
  window.__tabArrowSwitcherHandler = handleKeyDown;

  // Register in capture phase on both window and document
  window.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keydown', handleKeyDown, true);

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

  // Tab activation listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'TAB_ACTIVATED') {
      try {
        window.focus();
        if (document.body) document.body.focus();
      } catch (e) {}

      displayHud(message);
    }
  });
})();
