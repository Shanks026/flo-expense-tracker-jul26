import { supabase } from './supabase';

// Storage side of receipt scanning (13-ai-features.md Phase 3) — mirrors the
// avatars pattern exactly: private bucket, object path stored on the row
// (never a URL), a short-lived signed URL generated for display.
const RECEIPT_URL_TTL_SECONDS = 60 * 60 * 24; // 24h, same convention as useProfile's avatar TTL

// RFC-4122 v4 uuid from the CSPRNG that react-native-get-random-values already
// polyfills at app entry (for lib/supabase.js) — same generator as
// lib/transfers.js's transfer_id, reused here rather than duplicated.
function uuidv4() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

// Path is {user_id}/{uuid}.jpg — keyed by its own uuid, not the transaction
// id, since the transaction may not exist yet at scan time (a fresh, unsaved
// draft) and a receipt can be scanned before the sheet is ever saved.
export async function uploadReceipt(localUri) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { path: null, error: new Error('Not signed in') };

  const arraybuffer = await fetch(localUri).then((res) => res.arrayBuffer());
  const path = `${user.id}/${uuidv4()}.jpg`;
  const { error } = await supabase.storage.from('receipts').upload(path, arraybuffer, { contentType: 'image/jpeg' });

  if (error) return { path: null, error };
  return { path, error: null };
}

export async function receiptSignedUrl(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, RECEIPT_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
