/**
 * Tab Arrow Switcher - Content Script
 * Captures Left/Right arrow keys with smart context guards and renders visual HUD.
 */

(() => {
  let settings = {
    mode: 'direct', // 'direct', 'alt', 'double'
    wrapAround: true,
    showHud: true,
    protectTyping: true,
    protectMedia: true,
  };

  let lastKey = null;
  let lastKeyTime = 0;
  const DOUBLE_TAP_INTERVAL = 300; // ms
  let hudTimeout = null;

  // Load settings from storage
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
   * Smart Typing Guard: checks if the user is typing in an input,
   * textarea, contenteditable, search box, or code editor.
   */
  function isTypingContext() {
    if (!settings.protectTyping) return false;

    const el = document.activeElement;
    if (!el) return false;

    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return true;
    if (el.closest && el.closest('[contenteditable="true"]')) return true;

    // ARIA textboxes, comboboxes, search inputs
    const role = el.getAttribute('role');
    if (role === 'textbox' || role === 'searchbox' || role === 'combobox') return true;

    // Code editors & rich text components
    if (el.closest && el.closest('.monaco-editor, .CodeMirror, .ql-editor, .DraftEditor-root, .ace_editor, .cm-editor')) {
      return true;
    }

    return false;
  }

  /**
   * Media Protection: checks if a video player is focused or playing
   */
  function isMediaFocused() {
    if (!settings.protectMedia) return false;

    const el = document.activeElement;
    if (!el) return false;

    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'video' || tag === 'audio') return true;

    // YouTube, Vimeo, Netflix, or generic video player container focus
    if (el.closest && el.closest('.html5-video-player, ytd-player, .video-stream, .player-container')) {
      return true;
    }

    return false;
  }

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
   * Keyboard Event Listener (Captured during capture phase for zero lag)
   */
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const direction = e.key === 'ArrowLeft' ? 'left' : 'right';

      // Always allow Alt + Arrow regardless of mode
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        triggerTabSwitch(direction);
        return;
      }

      // Check user typing guard
      if (isTypingContext()) return;

      // Check active video player guard
      if (isMediaFocused()) return;

      // MODE 1: Direct Arrow Keys (Left / Right Arrow)
      if (settings.mode === 'direct') {
        if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          triggerTabSwitch(direction);
        }
      }

      // MODE 2: Double-Tap Arrow Keys (Press Arrow twice quickly)
      else if (settings.mode === 'double') {
        if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          const now = Date.now();
          if (lastKey === e.key && now - lastKeyTime < DOUBLE_TAP_INTERVAL) {
            e.preventDefault();
            e.stopPropagation();
            lastKey = null;
            lastKeyTime = 0;
            triggerTabSwitch(direction);
          } else {
            lastKey = e.key;
            lastKeyTime = now;
          }
        }
      }
    },
    true // Capture phase
  );

  /**
   * Render Sleek Floating Glassmorphic HUD
   */
  function displayHud(data) {
    let container = document.getElementById('tab-arrow-hud-overlay');

    if (!container) {
      container = document.createElement('div');
      container.id = 'tab-arrow-hud-overlay';
      container.className = 'tab-arrow-hud-overlay';
      document.documentElement.appendChild(container);
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

    // Trigger visible animation
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
        }, 300);
      }
    }, 1200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Listen for incoming HUD trigger from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'SHOW_HUD') {
      displayHud(message);
    }
  });
})();
