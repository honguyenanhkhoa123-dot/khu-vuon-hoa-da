import type { EncryptedVault } from '../types/zine';

const DEFAULT_PBKDF2_ITERATIONS = 150_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(
  passcode: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passcode.trim()),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPasscode(plain: string, expectedHash: string): Promise<boolean> {
  const trimmed = plain.trim();
  if (!trimmed || !expectedHash) return false;
  const actual = await sha256Hex(trimmed);
  const target = expectedHash.trim().toLowerCase();
  if (actual.length !== target.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ target.charCodeAt(i);
  }
  return diff === 0;
}

export async function encryptSecretWithPasscode(
  secret: string,
  passcode: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passcode, salt, iterations, ['encrypt']);
  const plainBytes = new TextEncoder().encode(secret.trim());
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plainBytes
  );
  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iterations
  };
}

export async function decryptSecretWithPasscode(
  vault: EncryptedVault | undefined,
  passcode: string
): Promise<string | null> {
  if (!vault || !passcode.trim()) return null;
  try {
    const salt = base64ToBytes(vault.salt);
    const iv = base64ToBytes(vault.iv);
    const cipherBytes = base64ToBytes(vault.ciphertext);
    const key = await deriveAesKey(
      passcode,
      salt,
      vault.iterations || DEFAULT_PBKDF2_ITERATIONS,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}
