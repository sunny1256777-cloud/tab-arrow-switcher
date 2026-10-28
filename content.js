/**
 * Tab Arrow Switcher - Content Script
 * Captures Left/Right arrow keys with smart context guards and renders visual HUD.
 */

(() => {
  // Prevent duplicate execution if script is injected both statically & dynamically
  if (window.__tabArrowSwitcherInjected) return;
  window.__tabArrowSwitcherInjected = true;

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

  // Listen for real-time setting updates from popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      for (const [key, change] of Object.entries(changes)) {
        settings[key] = change.newValue;
      }
    }
  });

  /**
   * Smart Typing Guard:
   * Checks if user is ACTIVELY typing inside an input, textarea, or editor.
   * If an input is auto-focused but completely empty, tab switching is allowed!
   */
  function isTypingContext() {
    if (!settings.protectTyping) return false;

    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return false;

    const tag = el.tagName ? el.tagName.toLowerCase() : '';

    // Standard input or textarea
    if (tag === 'input' || tag === 'textarea') {
      // If the field is empty (e.g. auto-focused search bar), allow tab switching
      if (!el.value || el.value.length === 0) {
        return false;
      }
      return true;
    }

    if (tag === 'select') return true;

    // Rich text editors (Notion, Google Docs, Medium)
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      if (!el.textContent || el.textContent.trim().length === 0) return false;
      return true;
    }

    if (el.closest && el.closest('[contenteditable="true"]')) {
      const parent = el.closest('[contenteditable="true"]');
      if (parent && parent.textContent && parent.textContent.trim().length > 0) return true;
      return false;
    }

    // ARIA roles
    const role = el.getAttribute('role');
    if (role === 'textbox' || role === 'searchbox' || role === 'combobox') {
      if (el.value && el.value.length > 0) return true;
      if (el.textContent && el.textContent.trim().length > 0) return true;
      return false;
    }

    // Code editors
    if (
      el.closest &&
      el.closest(
        '.monaco-editor, .CodeMirror, .ql-editor, .DraftEditor-root, .ace_editor, .cm-editor'
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Media Protection: checks if a video or audio element is directly focused
   */
  function isMediaFocused() {
    if (!settings.protectMedia) return false;

    const el = document.activeElement;
    if (!el || el === document.body) return false;

    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'video' || tag === 'audio') return true;

    if (
      el.classList &&
      (el.classList.contains('html5-main-video') || el.classList.contains('video-stream'))
    ) {
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
   * Handle Keydown Events
   */
  function handleKeyDown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    const direction = e.key === 'ArrowLeft' ? 'left' : 'right';

    // 1. Always allow Alt + Arrow key combo
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      triggerTabSwitch(direction);
      return;
    }

    // 2. Typing Guard Check
    if (isTypingContext()) return;

    // 3. Media Player Guard Check
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
  }

  // Attach event listener to both window and document with capture phase
  window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
  document.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });

  /**
   * Render Sleek Floating Glassmorphic HUD
   */
  function displayHud(data) {
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
