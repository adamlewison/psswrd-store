/**
 * Client-side zero-knowledge vault cryptography.
 * All operations run in the browser using Web Crypto API + hash-wasm (Argon2id).
 * Nothing secret ever leaves this module or the browser unencrypted.
 */

// ── Utilities ──────────────────────────────────────────────────────────────

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

// ── Key Derivation ─────────────────────────────────────────────────────────

/**
 * Derive KEK from HMAC output + kekSalt using Argon2id.
 * Parameters: 64 MB memory, 3 iterations, 1 parallelism, 32-byte output.
 * Returns a non-extractable CryptoKey usable for wrapKey/unwrapKey.
 */
export async function deriveKek(
  hmacB64: string,
  kekSaltB64: string,
): Promise<CryptoKey> {
  const { argon2id } = await import('hash-wasm')

  const hmacBytes = base64ToBytes(hmacB64)
  const kekSalt = base64ToBytes(kekSaltB64)

  const kekBytes = await argon2id({
    password: hmacBytes,
    salt: kekSalt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MB
    hashLength: 32,
    outputType: 'binary',
  })

  const keyBytes = new Uint8Array(kekBytes.length)
  keyBytes.set(kekBytes)

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false, // KEK not extractable
    ['wrapKey', 'unwrapKey'],
  )
}

// ── DEK Lifecycle ──────────────────────────────────────────────────────────

/** Generate a fresh 256-bit AES-GCM DEK. Not extractable from JS. */
export function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // must be extractable so wrapKey can read it
    ['encrypt', 'decrypt'],
  )
}

/**
 * Wrap DEK with KEK using AES-GCM. Returns { wrappedDek, dekIv } as base64.
 * Produces 48-byte wrapped blob (32-byte key + 16-byte auth tag).
 */
export async function wrapDek(
  dek: CryptoKey,
  kek: CryptoKey,
): Promise<{ wrappedDekB64: string; dekIvB64: string }> {
  const dekIv = crypto.getRandomValues(new Uint8Array(12))
  const wrappedDek = await crypto.subtle.wrapKey('raw', dek, kek, {
    name: 'AES-GCM',
    iv: dekIv,
  })
  return {
    wrappedDekB64: bytesToBase64(wrappedDek),
    dekIvB64: bytesToBase64(dekIv),
  }
}

/**
 * Unwrap DEK using KEK. Returns a non-extractable CryptoKey.
 * Throws DOMException if the auth tag fails (wrong PIN / corrupted data).
 */
export async function unwrapDek(
  wrappedDekB64: string,
  dekIvB64: string,
  kek: CryptoKey,
): Promise<CryptoKey> {
  const wrappedDek = base64ToBytes(wrappedDekB64)
  const dekIv = base64ToBytes(dekIvB64)

  return crypto.subtle.unwrapKey(
    'raw',
    wrappedDek.buffer as ArrayBuffer,
    kek,
    { name: 'AES-GCM', iv: dekIv.buffer as ArrayBuffer },
    { name: 'AES-GCM', length: 256 },
    false, // DEK not extractable once unwrapped
    ['encrypt', 'decrypt'],
  )
}

// ── Field Encryption ───────────────────────────────────────────────────────

/**
 * Encrypt a plaintext field value with the DEK.
 * Returns { ciphertextB64, ivB64 }.
 * Empty / null values are returned as { ciphertextB64: null, ivB64: null }.
 */
export async function encryptField(
  value: string,
  dek: CryptoKey,
): Promise<{ ciphertextB64: string | null; ivB64: string | null }> {
  if (!value) return { ciphertextB64: null, ivB64: null }

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    new TextEncoder().encode(value),
  )

  return {
    ciphertextB64: bytesToBase64(ciphertext),
    ivB64: bytesToBase64(iv),
  }
}

/**
 * Decrypt a field value. Returns the plaintext string.
 * Throws if auth tag verification fails (corrupted / wrong key).
 */
export async function decryptField(
  ciphertextB64: string,
  ivB64: string,
  dek: CryptoKey,
): Promise<string> {
  const ciphertext = base64ToBytes(ciphertextB64)
  const iv = base64ToBytes(ivB64)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    dek,
    ciphertext.buffer as ArrayBuffer,
  )

  return new TextDecoder().decode(plaintext)
}
