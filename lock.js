// lock.js - Handles password verification, brute-force protection, and inline password changes
import { hashPassword, verifyPassword } from './crypto-utils.js';

const lockCard = document.getElementById('lockCard');
const unlockView = document.getElementById('unlockView');
const changePassView = document.getElementById('changePassView');

// Unlock Elements
const unlockForm = document.getElementById('unlockForm');
const passwordInput = document.getElementById('passwordInput');
const toggleBtn = document.getElementById('togglePassword');
const unlockBtn = document.getElementById('unlockBtn');
const statusMsg = document.getElementById('statusMsg');
const showChangePassBtn = document.getElementById('showChangePassBtn');

// Change Password Elements
const changePassForm = document.getElementById('changePassForm');
const oldPassInput = document.getElementById('oldPassInput');
const newPassInput = document.getElementById('newPassInput');
const confirmPassInput = document.getElementById('confirmPassInput');
const savePassBtn = document.getElementById('savePassBtn');
const backToUnlockBtn = document.getElementById('backToUnlockBtn');
const changePassMsg = document.getElementById('changePassMsg');

let failedAttempts = 0;
let cooldownUntil = 0;

// Toggle password visibility on unlock screen
toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  passwordInput.focus();
});

// Switch between Unlock and Change Password views
showChangePassBtn.addEventListener('click', () => {
  statusMsg.textContent = '';
  changePassMsg.textContent = '';
  unlockView.classList.add('hidden');
  changePassView.classList.remove('hidden');
  oldPassInput.focus();
});

backToUnlockBtn.addEventListener('click', () => {
  changePassMsg.textContent = '';
  changePassForm.reset();
  changePassView.classList.add('hidden');
  unlockView.classList.remove('hidden');
  passwordInput.focus();
});

// Trigger shake animation
function triggerShake(targetMsgElement, message) {
  targetMsgElement.style.color = '#ef4444';
  targetMsgElement.textContent = message;
  lockCard.classList.remove('shake');
  void lockCard.offsetWidth; // Force reflow
  lockCard.classList.add('shake');
}

// Handle Unlock Submit
unlockForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const now = Date.now();
  if (now < cooldownUntil) {
    const remaining = Math.ceil((cooldownUntil - now) / 1000);
    triggerShake(statusMsg, `Too many attempts. Try again in ${remaining}s.`);
    return;
  }

  const inputPassword = passwordInput.value;
  if (!inputPassword) return;

  unlockBtn.disabled = true;
  statusMsg.textContent = '';

  try {
    const { passwordHash, passwordSalt } = await chrome.storage.local.get([
      'passwordHash',
      'passwordSalt'
    ]);

    if (!passwordHash || !passwordSalt) {
      await chrome.runtime.sendMessage({ action: 'UNLOCK_BROWSER' });
      return;
    }

    const isValid = await verifyPassword(inputPassword, passwordHash, passwordSalt);

    if (isValid) {
      failedAttempts = 0;
      statusMsg.style.color = '#22c55e';
      statusMsg.textContent = 'Unlocked! Restoring your tabs...';
      await chrome.runtime.sendMessage({ action: 'UNLOCK_BROWSER' });
    } else {
      failedAttempts++;
      passwordInput.value = '';
      passwordInput.focus();

      if (failedAttempts >= 5) {
        cooldownUntil = Date.now() + 15000;
        triggerShake(statusMsg, '5 failed attempts. Locked for 15 seconds.');
      } else {
        triggerShake(statusMsg, `Incorrect password (${5 - failedAttempts} attempts remaining)`);
      }
    }
  } catch (err) {
    triggerShake(statusMsg, 'An error occurred while verifying password.');
  } finally {
    unlockBtn.disabled = false;
  }
});

// Handle Change Password Submit on Lock Screen
changePassForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const now = Date.now();
  if (now < cooldownUntil) {
    const remaining = Math.ceil((cooldownUntil - now) / 1000);
    triggerShake(changePassMsg, `Too many attempts. Try again in ${remaining}s.`);
    return;
  }

  const oldPass = oldPassInput.value;
  const newPass = newPassInput.value;
  const confirmPass = confirmPassInput.value;

  if (newPass.length < 4) {
    triggerShake(changePassMsg, 'New password must be at least 4 characters.');
    return;
  }

  if (newPass !== confirmPass) {
    triggerShake(changePassMsg, 'New passwords do not match.');
    return;
  }

  savePassBtn.disabled = true;
  changePassMsg.textContent = '';

  try {
    const { passwordHash, passwordSalt } = await chrome.storage.local.get([
      'passwordHash',
      'passwordSalt'
    ]);

    if (passwordHash && passwordSalt) {
      const isCurrentValid = await verifyPassword(oldPass, passwordHash, passwordSalt);
      if (!isCurrentValid) {
        failedAttempts++;
        oldPassInput.value = '';
        oldPassInput.focus();
        if (failedAttempts >= 5) {
          cooldownUntil = Date.now() + 15000;
          triggerShake(changePassMsg, '5 failed attempts. Locked for 15 seconds.');
        } else {
          triggerShake(changePassMsg, `Current password incorrect (${5 - failedAttempts} tries left)`);
        }
        return;
      }
    }

    const { hash, salt } = await hashPassword(newPass);
    await chrome.storage.local.set({
      passwordHash: hash,
      passwordSalt: salt
    });

    failedAttempts = 0;
    changePassMsg.style.color = '#22c55e';
    changePassMsg.textContent = 'Password updated! Unlocking browser...';

    setTimeout(async () => {
      await chrome.runtime.sendMessage({ action: 'UNLOCK_BROWSER' });
    }, 700);
  } catch (err) {
    triggerShake(changePassMsg, 'Failed to update password.');
  } finally {
    savePassBtn.disabled = false;
  }
});
