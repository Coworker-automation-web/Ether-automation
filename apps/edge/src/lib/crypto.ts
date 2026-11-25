const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array): string {
  // A loop, not String.fromCharCode(...bytes): spreading a large array overflows the call stack.
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 hex digest. Used for session tokens and role keys (high-entropy secrets, so no salt/KDF needed). */
export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

/** Cryptographically random URL-safe secret. 32 bytes = 256 bits of entropy by default. */
export function randomSecret(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64(base64Key);
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** AES-GCM encrypt (provider keys at rest). Returns base64 ciphertext and iv. */
export async function encryptSecret(plaintext: string, base64Key: string) {
  const key = await importAesKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return { ciphertext: toBase64(new Uint8Array(ct)), iv: toBase64(iv) };
}

export async function decryptSecret(ciphertext: string, iv: string, base64Key: string): Promise<string> {
  const key = await importAesKey(base64Key);
  const ctBytes = fromBase64(ciphertext);
  const ivBytes = fromBase64(iv);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, ctBytes);
  return new TextDecoder().decode(pt);
}
