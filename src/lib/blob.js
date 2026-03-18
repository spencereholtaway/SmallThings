import { generateKey, encrypt, decrypt } from './crypto.js';

// Get or create the user's encryption key
export async function initUserCrypto(supabase, userId) {
  // Try to fetch existing key
  const { data, error } = await supabase
    .from('user_keys')
    .select('wrapped_key')
    .eq('user_id', userId)
    .single();

  if (data) return data.wrapped_key;

  // First time: generate a new key and store it
  if (error && error.code === 'PGRST116') {
    const key = await generateKey();
    const { error: insertError } = await supabase
      .from('user_keys')
      .insert({ user_id: userId, wrapped_key: key });

    if (insertError) throw new Error('Failed to store encryption key');
    return key;
  }

  throw new Error('Failed to load encryption key');
}

// Load and decrypt the user's receipts blob
export async function loadBlob(supabase, userId, key) {
  const { data, error } = await supabase
    .from('user_blobs')
    .select('encrypted_data, iv')
    .eq('user_id', userId)
    .single();

  // No blob yet — first time user
  if (error && error.code === 'PGRST116') return [];

  if (error) throw new Error('Failed to load encrypted data');

  const plaintext = await decrypt(data.encrypted_data, data.iv, key);
  return JSON.parse(plaintext);
}

// Encrypt and save the user's receipts blob
export async function saveBlob(supabase, userId, key, receipts) {
  const plaintext = JSON.stringify(receipts);
  const { ciphertext, iv } = await encrypt(plaintext, key);

  const { error } = await supabase.from('user_blobs').upsert({
    user_id: userId,
    encrypted_data: ciphertext,
    iv,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error('Failed to save encrypted data');
}
