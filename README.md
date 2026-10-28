# Tab Arrow Switcher ⚡ (Chrome Extension)

> Switch between open browser tabs effortlessly using your keyboard's **Left & Right Arrow Keys**, with smart typing protection, wrap-around looping, and a visual floating HUD.

---

## 🌟 Why Tab Arrow Switcher?

Managing tens or hundreds of open tabs in Google Chrome usually forces you into endless mouse hunting or awkward multi-key finger gym (`Ctrl+Tab`, `Ctrl+PageDown`).

**Tab Arrow Switcher** restores natural, frictionless navigation:
- ◀ **Press Left Arrow** to instantly move to the previous tab.
- ▶ **Press Right Arrow** to move to the next tab.
- 🛡️ **Smart Input Protection**: Automatically pauses tab switching whenever you are typing in comment sections, search bars, inputs, textareas, Notion, Google Docs, or code editors.
- 📺 **Media Player Guard**: Keeps native video seeking (e.g., ±5s on YouTube/Netflix) intact.
- 💎 **Visual Floating HUD**: An Apple/macOS-style glassmorphic badge appears for 1.2s at the top of your screen showing `Tab X of Y` and tab titles.
- 🔁 **Continuous Looping**: Smoothly wraps around from the last tab back to the first.

---

## 🎮 Navigation Modes

You can switch between 3 operation modes anytime from the extension popup:

1. **Direct Arrow Keys (Default)**:
   - Tap `◀ Left Arrow` or `Right Arrow ▶` directly on any webpage when you are not typing.
2. **Alt + Arrow Keys**:
   - Hold `Alt` + `◀` or `Alt` + `▶`. Configured via native `chrome.commands` to work reliably everywhere.
3. **Double-Tap Arrow Keys**:
   - Double-tap `◀` or `▶` quickly within 300ms. Perfect for users who still want single arrow taps for vertical page scrolling.

---

## 🚀 Installation Guide

### Option 1: Clone with Git (Recommended)

```bash
git clone https://github.com/sunny1256777-cloud/tab-arrow-switcher.git
```

### Option 2: Download ZIP

1. Download the repository as a ZIP file from GitHub (`Code` → `Download ZIP`).
2. Extract the ZIP file to a folder on your computer.

### Loading into Google Chrome:

1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `tab-arrow-switcher` directory.
5. Open multiple tabs, press your `◀ Left` or `Right ▶` arrow key, and enjoy instant keyboard multitasking!

---

## ⚙️ Customizing Shortcuts

To customize or rebind the global `Alt+Left` / `Alt+Right` shortcut:
1. Navigate to:
   ```text
   chrome://extensions/shortcuts
   ```
2. Locate **Tab Arrow Switcher** and assign your preferred key combinations.

---

## 🛡️ Privacy & Permissions

This extension runs **100% locally on your machine**:
- **Zero Analytics**: No user tracking, telemetries, or external network requests.
- **Minimal Permissions**:
  - `tabs`: To query active tab index and switch tabs.
  - `storage`: To remember your toggle preferences locally.

---

## 📄 License

MIT License © 2026 Sunny
