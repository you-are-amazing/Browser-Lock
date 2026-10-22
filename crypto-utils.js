// crypto-utils.js - Secure PBKDF2 Password Hashing

const ITERATIONS = 100000;
const KEY_LENGTH = 256;
const DIGEST = 'SHA-256';

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

export async function hashPassword(password, saltHex = null) {
  const encoder = new TextEncoder();
  const salt = saltHex
    ? new Uint8Array(hexToBuffer(saltHex))
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: DIGEST
    },
    keyMaterial,
    KEY_LENGTH
  );

  return {
    hash: bufferToHex(derivedBits),
    salt: bufferToHex(salt)
  };
}

export async function verifyPassword(inputPassword, storedHash, storedSalt) {
  if (!storedHash || !storedSalt) return false;
  const { hash } = await hashPassword(inputPassword, storedSalt);
  return hash === storedHash;
}
