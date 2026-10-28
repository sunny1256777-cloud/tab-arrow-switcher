/**
 * Tab Arrow Switcher - Content Script
 * Captures Left/Right arrow keys directly for effortless tab movement.
 */

(() => {
  // Prevent duplicate execution
  if (window.__tabArrowSwitcherInjected) return;
  window.__tabArrowSwitcherInjected = true;

  let settings = {
    wrapAround: true,
    showHud: true,
    protectMedia: true,
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
    chrome.runtime.sendMessage({
      action: 'SWITCH_TAB',
      direction: direction,
    });
  }

  /**
   * Main Keydown Handler
   */
  function handleKeyDown(e) {
    // Only capture Left and Right Arrow keys
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    // IMPORTANT: If user is holding Alt, Ctrl, or Cmd/Meta, do NOT intercept!
    // (This ensures Alt+Left / Alt+Right for browser history or Ctrl+Arrow for word jump work normally)
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

    // Only block if user is typing in a multiline textarea (like composing an email or comment)
    const el = document.activeElement;
    if (el && el.tagName && el.tagName.toLowerCase() === 'textarea') {
      return;
    }

    // Video Player Watch Page Guard (Only on active video watch page when playing)
    if (settings.protectMedia && window.location.pathname.startsWith('/watch')) {
      const video = document.querySelector('video');
      if (video && !video.paused && (el === video || el?.classList?.contains('html5-main-video'))) {
        return; // Allow native video seek
      }
    }

    // Direct movement: Switch Tab!
    const direction = e.key === 'ArrowLeft' ? 'left' : 'right';
    e.preventDefault();
    e.stopPropagation();
    triggerTabSwitch(direction);
  }

  // Register in capture phase to take priority
  window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
  document.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });

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

  // When a tab is activated, ensure keyboard focus and show HUD
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
