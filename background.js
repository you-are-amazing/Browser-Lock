// background.js - Safe Tab & Window Lock Manager
// Automatically locks when Chrome starts OR when all profile windows are closed and reopened.
// Never touches cookies, browsingData, Google Sync, or internal Chrome Auth flows.

const LOCK_PAGE = chrome.runtime.getURL('lock.html');
const OPTIONS_PAGE = chrome.runtime.getURL('options.html');

function isLockableUrl(url) {
  if (!url) return false;
  if (url.startsWith(LOCK_PAGE) || url.startsWith(OPTIONS_PAGE)) return false;
  if (
    url.startsWith('chrome-extension://') ||
    url.startsWith('devtools://') ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  ) {
    return false;
  }
  return true;
}

// Check and enforce lock state whenever service worker wakes up
async function checkInitialState() {
  const { passwordHash, lockOnStartup } = await chrome.storage.local.get([
    'passwordHash',
    'lockOnStartup'
  ]);
  const { initialized, isLocked } = await chrome.storage.session.get([
    'initialized',
    'isLocked'
  ]);

  if (!initialized) {
    const shouldLock = Boolean(passwordHash && lockOnStartup !== false);
    await chrome.storage.session.set({ initialized: true, isLocked: shouldLock });
    if (shouldLock) {
      await lockBrowser();
    }
  } else if (isLocked) {
    await chrome.action.setBadgeText({ text: 'LOCK' });
    await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  }
}

checkInitialState();

// 1. Lock when browser starts up
chrome.runtime.onStartup.addListener(async () => {
  const { passwordHash, lockOnStartup } = await chrome.storage.local.get([
    'passwordHash',
    'lockOnStartup'
  ]);

  if (passwordHash && lockOnStartup !== false) {
    await chrome.storage.session.set({ initialized: true, isLocked: true });
    await lockBrowser();
  } else {
    await chrome.storage.session.set({ initialized: true, isLocked: false });
  }
});

// 2. When ALL windows of this Chrome account/profile are closed, mark session as locked
// so reopening the Chrome profile immediately shows the Browser Locked screen!
chrome.windows.onRemoved.addListener(async () => {
  const remainingWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  if (remainingWindows.length === 0) {
    const { passwordHash, lockOnStartup } = await chrome.storage.local.get([
      'passwordHash',
      'lockOnStartup'
    ]);
    if (passwordHash && lockOnStartup !== false) {
      await chrome.storage.session.set({ initialized: true, isLocked: true });
      await chrome.action.setBadgeText({ text: 'LOCK' });
      await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    }
  }
});

// 3. When a new window is opened for this Chrome profile, if it's the first window or locked, enforce lock
chrome.windows.onCreated.addListener(async () => {
  const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const { passwordHash, lockOnStartup } = await chrome.storage.local.get([
    'passwordHash',
    'lockOnStartup'
  ]);
  const { isLocked } = await chrome.storage.session.get('isLocked');

  if (isLocked || (allWindows.length === 1 && passwordHash && lockOnStartup !== false)) {
    // Wait briefly for initial tabs of the reopened profile window to populate
    setTimeout(() => {
      lockBrowser();
    }, 120);
  }
});

// First install setup
chrome.runtime.onInstalled.addListener(async () => {
  const { passwordHash, autoLockMinutes } = await chrome.storage.local.get([
    'passwordHash',
    'autoLockMinutes'
  ]);

  if (autoLockMinutes === undefined) {
    await chrome.storage.local.set({ autoLockMinutes: 0, lockOnStartup: true });
  }

  await chrome.storage.session.set({ initialized: true, isLocked: false });

  if (!passwordHash) {
    chrome.tabs.create({ url: OPTIONS_PAGE });
  }
});

// Clicking the extension icon locks the browser
chrome.action.onClicked.addListener(async () => {
  const { passwordHash } = await chrome.storage.local.get('passwordHash');
  if (!passwordHash) {
    chrome.tabs.create({ url: OPTIONS_PAGE });
    return;
  }
  const { isLocked } = await chrome.storage.session.get('isLocked');
  if (!isLocked) {
    await lockBrowser();
  }
});

// Keyboard shortcut (Alt+L)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'lock-browser') {
    const { passwordHash } = await chrome.storage.local.get('passwordHash');
    if (passwordHash) {
      await lockBrowser();
    }
  }
});

// Lock the browser and hold existing tab URLs safely
async function lockBrowser() {
  await chrome.storage.session.set({ initialized: true, isLocked: true });
  await chrome.action.setBadgeText({ text: 'LOCK' });
  await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });

  const tabs = await chrome.tabs.query({});
  let lockedCount = 0;

  for (const tab of tabs) {
    if (!tab.id) continue;
    const currentUrl = tab.pendingUrl || tab.url || '';

    if (currentUrl.startsWith(LOCK_PAGE)) {
      lockedCount++;
      continue;
    }

    if (isLockableUrl(currentUrl)) {
      const returnUrl = encodeURIComponent(currentUrl);
      chrome.tabs.update(tab.id, { url: `${LOCK_PAGE}?returnUrl=${returnUrl}` }).catch(() => {});
      lockedCount++;
    } else if (
      currentUrl.startsWith('chrome://newtab') ||
      currentUrl.startsWith('edge://newtab') ||
      currentUrl === 'about:blank' ||
      currentUrl === ''
    ) {
      chrome.tabs.update(tab.id, { url: LOCK_PAGE }).catch(() => {});
      lockedCount++;
    }
  }

  if (lockedCount === 0 && tabs.length > 0) {
    chrome.tabs.create({ url: LOCK_PAGE, active: true }).catch(() => {});
  }
}

// Unlock the browser and restore all tabs back to their original URLs
async function unlockBrowser() {
  await chrome.storage.session.set({ initialized: true, isLocked: false });
  await chrome.action.setBadgeText({ text: '' });

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url && tab.url.startsWith(LOCK_PAGE)) {
      try {
        const urlObj = new URL(tab.url);
        const returnUrl = urlObj.searchParams.get('returnUrl');
        if (returnUrl) {
          await chrome.tabs.update(tab.id, { url: decodeURIComponent(returnUrl) });
        } else {
          await chrome.tabs.update(tab.id, { url: 'chrome://newtab/' });
        }
      } catch (err) {
        await chrome.tabs.update(tab.id, { url: 'chrome://newtab/' });
      }
    }
  }
}

// Intercept any navigation or new tab while locked
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab.pendingUrl || tab.url;
  if (!targetUrl) return;

  const { isLocked } = await chrome.storage.session.get('isLocked');
  if (!isLocked) return;

  if (targetUrl.startsWith(LOCK_PAGE)) return;

  if (targetUrl.startsWith(OPTIONS_PAGE) || targetUrl.startsWith('chrome://newtab') || targetUrl.startsWith('edge://newtab')) {
    chrome.tabs.update(tabId, { url: LOCK_PAGE }).catch(() => {});
    return;
  }

  if (isLockableUrl(targetUrl)) {
    const returnUrl = encodeURIComponent(targetUrl);
    chrome.tabs.update(tabId, { url: `${LOCK_PAGE}?returnUrl=${returnUrl}` }).catch(() => {});
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  const { isLocked } = await chrome.storage.session.get('isLocked');
  if (isLocked && tab.id) {
    const targetUrl = tab.pendingUrl || tab.url || '';
    if (!targetUrl.startsWith(LOCK_PAGE)) {
      const returnUrl = isLockableUrl(targetUrl) ? `?returnUrl=${encodeURIComponent(targetUrl)}` : '';
      chrome.tabs.update(tab.id, { url: `${LOCK_PAGE}${returnUrl}` }).catch(() => {});
    }
  }
});

// Auto-lock on system idle
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'idle' || newState === 'locked') {
    const { passwordHash, autoLockMinutes } = await chrome.storage.local.get([
      'passwordHash',
      'autoLockMinutes'
    ]);
    if (passwordHash && autoLockMinutes && autoLockMinutes > 0) {
      await lockBrowser();
    }
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.autoLockMinutes) {
    const mins = Number(changes.autoLockMinutes.newValue || 0);
    if (mins > 0) {
      chrome.idle.setDetectionInterval(Math.max(15, mins * 60));
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UNLOCK_BROWSER') {
    unlockBrowser().then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.action === 'LOCK_BROWSER') {
    lockBrowser().then(() => sendResponse({ success: true }));
    return true;
  }
});
