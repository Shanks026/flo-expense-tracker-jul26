// The app's side of the ai-assistant Edge Function (44-ai-assistant.md).
// The function holds the OpenRouter key and calls the model; the app only
// ever calls the function. Nothing here writes: a reply becomes the Add
// sheet's prefill, and the person's Save tap does the insert as usual.
import { format } from 'date-fns';
import { supabase } from './supabase';

// A little over the function's own 8 s model timeout, so the function
// normally answers first and records the call.
const CLIENT_TIMEOUT_MS = 10000;

// aiQuickAdd(text, { categories, accounts })
// → { prefill: { type, amount, categoryId, accountId, date, note } }
// | { prefill: null, reason: 'unread' | 'transfer' | 'cap' | 'error' }
//
// Never throws. A categoryId or accountId that isn't one of the person's own
// is dropped (the function checks too; this is the second lock).
export async function aiQuickAdd(text, { categories = [], accounts = [] } = {}) {
  const now = new Date();
  const body = {
    mode: 'quick_add',
    text,
    today: format(now, 'yyyy-MM-dd'),
    time: format(now, 'HH:mm'),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ data: null, error: new Error('timeout') }), CLIENT_TIMEOUT_MS);
  });
  let result;
  try {
    result = await Promise.race([supabase.functions.invoke('ai-assistant', { body }), timeout]);
  } catch (e) {
    result = { data: null, error: e };
  } finally {
    clearTimeout(timer);
  }

  const { data, error } = result ?? {};
  if (error || !data) {
    if (error) console.warn('aiQuickAdd failed:', error.message);
    return { prefill: null, reason: 'error' };
  }
  if (!data.ok || !data.prefill) return { prefill: null, reason: data.reason ?? 'unread' };

  const p = data.prefill;
  const category = categories.find((c) => c.id === p.categoryId && c.type === p.type);
  const ownAccount = accounts.some((a) => a.id === p.accountId);
  if (!(Number(p.amount) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date ?? '')) {
    return { prefill: null, reason: 'unread' };
  }
  return {
    prefill: {
      type: p.type === 'income' ? 'income' : 'expense',
      amount: Number(p.amount),
      categoryId: category ? category.id : null,
      accountId: ownAccount ? p.accountId : null,
      date: p.date,
      note: typeof p.note === 'string' && p.note.trim() ? p.note.trim() : null,
    },
  };
}
