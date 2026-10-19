// AES-256-GCM: every encrypted file = 12-byte IV + ciphertext(with tag)
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64uToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64u(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function importKey(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
}

export async function decryptBuf(key, buf) {
  const bytes = new Uint8Array(buf);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
}

export async function decryptJSON(key, buf) {
  return JSON.parse(dec.decode(await decryptBuf(key, buf)));
}

export function normalizePass(p) {
  return p.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Unwrap the content key with the shared passphrase (fallback when the link key is missing)
export async function unwrapWithPassphrase(pass, wrap) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizePass(pass)), 'PBKDF2', false, ['deriveKey']);
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64uToBytes(wrap.salt), iterations: wrap.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64uToBytes(wrap.iv) }, kek, b64uToBytes(wrap.ct));
  return new Uint8Array(raw);
}
