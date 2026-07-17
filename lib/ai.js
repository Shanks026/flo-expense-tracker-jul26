import { supabase } from './supabase';

// Client wrapper for the ai-interpret Edge Function (13-ai-features.md Phase 3
// — receipt scanning). Any failure (403 pro_required, 429 cap, a Gemini
// hiccup) resolves to null so the caller can fall back to an unprefilled
// sheet rather than surfacing a raw error for what is always an optional
// convenience, never a blocking step.
export async function scanReceipt({ imageBase64, categories }) {
  if (!imageBase64 || !categories?.length) return null;

  const { data, error } = await supabase.functions.invoke('ai-interpret', {
    body: { mode: 'receipt', imageBase64, categories },
  });

  if (error) {
    if (__DEV__) {
      // FunctionsHttpError.message is generic ("non-2xx status code") — the
      // real { error: '...' } body lives on error.context (the raw Response).
      // See 13-ai-features.md Phase 1 Implementation Notes.
      let detail = error.message;
      try {
        const body = await error.context?.json();
        if (body?.error) detail = body.error;
      } catch {
        // context wasn't JSON — fall back to the generic message
      }
      console.log('[ai] scanReceipt failed:', detail);
    }
    return null;
  }

  return data?.draft ?? null;
}
