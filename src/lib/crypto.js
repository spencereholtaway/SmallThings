// Client-side encryption using Web Crypto API (AES-GCM 256-bit)

export async function generateKey() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufToBase64(raw);
}

export async function encrypt(plaintext, keyBase64) {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    ciphertext: bufToBase64(ciphertext),
    iv: bufToBase64(iv),
  };
}

export async function decrypt(ciphertextBase64, ivBase64, keyBase64) {
  const key = await importKey(keyBase64);
  const iv = base64ToBuf(ivBase64);
  const ciphertext = base64ToBuf(ciphertextBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

async function importKey(keyBase64) {
  const raw = base64ToBuf(keyBase64);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBuf(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
