# Browser Lock Pro

**Browser Lock Pro** is a secure, modern Chrome extension that protects your browsing session and profile with a master password. It locks open tabs automatically when Chrome or your profile starts, shields new tabs and windows while locked, and preserves your active tabs upon unlocking—all while keeping your Chrome account data, cookies, and Google Sync 100% untouched.

---

## ✨ Key Features
- **Zero Chrome Account Interference:** Uses local and session storage exclusively. It never interferes with Google Account sign-ins, token refreshes, browsing data, or cloud sync.
- **True Black / Obsidian Dark Theme:** Features a sleek, high-contrast monochrome dark mode designed for privacy and comfort.
- **Inline Password Management:** Change your master password directly from the `Browser Locked` screen or via the extension settings.
- **Smart Profile Reopening Protection:** Automatically detects when all windows of your Chrome profile are closed and locks the session upon reopening.
- **Non-Destructive Tab Restoration:** Remembers your original tab URLs while locked and restores them instantly when you enter your password.
- **Quick-Lock & Auto-Lock:** Press `Alt + L` or click the extension icon to lock immediately, or configure an idle timer in Settings.

---

## 📦 Installation Guide

### Option A: Install Locally (Recommended for Developers)
1. Download and extract the **`Browser-Lock-Pro-v2.zip`** project folder.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the **`Browser-Lock-Pro-v2`** folder containing `manifest.json`.
6. Click the extensions puzzle icon in Chrome and **pin Browser Lock Pro** for quick access.

---

## 🚀 How to Use

1. **Set Up Your Password:**
   * Click the **Browser Lock Pro** extension icon (or it will open automatically on first install).
   * Create and confirm your master password in the settings page.
2. **Lock Your Browser:**
   * Click **Lock Browser Now** in settings, press the `Alt + L` keyboard shortcut, or click the extension icon.
   * Alternatively, close all windows of your Chrome profile and reopen Chrome—the lock screen will appear automatically.
3. **Unlock & Restore:**
   * When the obsidian-themed lock screen appears, enter your master password and press **Unlock Browser**. All your previously open tabs will be instantly restored.
4. **Change Your Password:**
   * Click the **Change Password** button directly on the `Browser Locked` screen, verify your current password, and set your new password.

---

## 🔒 Privacy & Security
- **Local-Only Storage:** Your password hash and salt are securely generated using the native Web Crypto API (`PBKDF2` with `SHA-256` and 100,000 iterations) and stored locally within your Chrome profile (`chrome.storage.local`).
- **No External Servers:** Browser Lock Pro operates entirely offline. It requires no online account and never transmits passwords or browsing data externally.

---

## 📄 License
This project is licensed under the **MIT License**.
