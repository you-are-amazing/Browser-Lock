// options.js - Manages extension settings and password updates
import { hashPassword, verifyPassword } from './crypto-utils.js';

const currentPasswordWrapper = document.getElementById('currentPasswordWrapper');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const passwordForm = document.getElementById('passwordForm');
const passwordStatus = document.getElementById('passwordStatus');
const passwordSectionTitle = document.getElementById('passwordSectionTitle');

const lockOnStartupCheckbox = document.getElementById('lockOnStartup');
const autoLockSelect = document.getElementById('autoLockMinutes');
const prefStatus = document.getElementById('prefStatus');
const lockNowBtn = document.getElementById('lockNowBtn');

async function loadSettings() {
  const { isLocked } = await chrome.storage.session.get('isLocked');
  if (isLocked) {
    window.location.href = chrome.runtime.getURL('lock.html');
    return;
  }

  const { passwordHash, lockOnStartup, autoLockMinutes } = await chrome.storage.local.get([
    'passwordHash',
    'lockOnStartup',
    'autoLockMinutes'
  ]);

  if (passwordHash) {
    currentPasswordWrapper.style.display = 'block';
    passwordSectionTitle.textContent = 'Change Master Password';
  } else {
    currentPasswordWrapper.style.display = 'none';
    passwordSectionTitle.textContent = 'Create Master Password';
  }

  lockOnStartupCheckbox.checked = lockOnStartup !== false;
  autoLockSelect.value = String(autoLockMinutes || 0);
}

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passwordStatus.style.color = '#ef4444';

  const { passwordHash, passwordSalt } = await chrome.storage.local.get([
    'passwordHash',
    'passwordSalt'
  ]);

  if (passwordHash) {
    const currentValid = await verifyPassword(
      currentPasswordInput.value,
      passwordHash,
      passwordSalt
    );
    if (!currentValid) {
      passwordStatus.textContent = 'Current password is incorrect.';
      return;
    }
  }

  const newPass = newPasswordInput.value;
  const confirmPass = confirmPasswordInput.value;

  if (newPass.length < 4) {
    passwordStatus.textContent = 'Password must be at least 4 characters long.';
    return;
  }

  if (newPass !== confirmPass) {
    passwordStatus.textContent = 'New passwords do not match.';
    return;
  }

  const { hash, salt } = await hashPassword(newPass);
  await chrome.storage.local.set({
    passwordHash: hash,
    passwordSalt: salt
  });

  currentPasswordInput.value = '';
  newPasswordInput.value = '';
  confirmPasswordInput.value = '';
  passwordStatus.style.color = '#22c55e';
  passwordStatus.textContent = 'Master password saved successfully!';
  await loadSettings();
});

lockOnStartupCheckbox.addEventListener('change', async () => {
  await chrome.storage.local.set({ lockOnStartup: lockOnStartupCheckbox.checked });
  showPrefSaved();
});

autoLockSelect.addEventListener('change', async () => {
  await chrome.storage.local.set({ autoLockMinutes: Number(autoLockSelect.value) });
  showPrefSaved();
});

function showPrefSaved() {
  prefStatus.style.color = '#22c55e';
  prefStatus.textContent = 'Preferences saved.';
  setTimeout(() => {
    prefStatus.textContent = '';
  }, 2000);
}

lockNowBtn.addEventListener('click', async () => {
  const { passwordHash } = await chrome.storage.local.get('passwordHash');
  if (!passwordHash) {
    passwordStatus.style.color = '#ef4444';
    passwordStatus.textContent = 'Please set a master password first before locking.';
    return;
  }
  await chrome.runtime.sendMessage({ action: 'LOCK_BROWSER' });
});

loadSettings();
