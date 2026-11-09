// The app's side of the ai-assistant Edge Function (44-ai-assistant.md).
// The function holds the OpenRouter key and calls the model; the app only
// ever calls the function. Nothing here writes money data: a reply becomes
// the Add sheet's prefill, and the person's Save tap does the insert as
// usual. The only writes are to the chat tables: deleting a past chat, and a
// proposal card's saved or dismissed mark.
import { format } from 'date-fns';
import { supabase } from './supabase';

// A little over the function's own 8 s model timeout, so the function
// normally answers first and records the call.
const CLIENT_TIMEOUT_MS = 10000;

// The function call with a client-side timeout. Never throws:
// → { data, error }.
async function invokeAssistant(body) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ data: null, error: new Error('timeout') }), CLIENT_TIMEOUT_MS);
  });
  try {
    return (await Promise.race([supabase.functions.invoke('ai-assistant', { body }), timeout])) ?? {};
  } catch (e) {
    return { data: null, error: e };
  } finally {
    clearTimeout(timer);
  }
}

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

  const { data, error } = await invokeAssistant(body);
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

// For the phase 1 test screen (app/dev/ai-eval.js) only. Sends the test set's
// own accounts, categories and fixed date, and asks one model ('default' or
// 'challenger') with no fallback.
// → { prefill | null, reason, model, ms }. `ms` is the round trip seen here.
export async function aiQuickAddEval(text, { categories, accounts, today, time, tz, model }) {
  const startedAt = Date.now();
  const { data, error } = await invokeAssistant({
    mode: 'quick_add',
    text,
    today,
    time,
    tz,
    model,
    eval: {
      accounts: accounts.map(({ id, name }) => ({ id, name })),
      categories: categories.map(({ id, name, type }) => ({ id, name, type })),
    },
  });
  const ms = Date.now() - startedAt;
  if (error || !data) return { prefill: null, reason: 'error', model: null, ms };
  return { prefill: data.ok ? data.prefill : null, reason: data.ok ? null : data.reason, model: data.model ?? null, ms };
}

// Deletes a past chat (ticket 08). Its messages go with it (on delete
// cascade). The one write the app makes to the chat tables itself; the
// caller runs notifyChanged(), so an open chat of the same id notices.
// Throws on failure.
export async function deleteConversation(id) {
  const { error } = await supabase.from('ai_conversations').delete().eq('id', id);
  if (error) throw error;
}

// A proposal card's outcome (44 phase 4): 'saved' after the sheet's Save,
// 'dismissed' after Dismiss. Kept on the answer's own `proposal`, so a
// reopened chat shows "Saved ✓" instead of offering Review again. Only the
// chat row changes; the money row was written by the sheet itself.
// → the updated proposal. Throws on failure.
export async function setProposalStatus(messageId, proposal, status) {
  const next = { ...proposal, status };
  const { error } = await supabase.from('ai_messages').update({ proposal: next }).eq('id', messageId);
  if (error) throw error;
  return next;
}

// Chat (44 phase 3). The function has a 45 s turn budget; this waits a little
// longer so the function normally answers first.
const CHAT_TIMEOUT_MS = 50000;

// aiChat({ conversationId, message, accountId })
// → { ok: true, conversationId, question, reply } (both { id, role, content, created_at })
// | { ok: false, reason: 'cap' | 'error' }
//
// Never throws. The function writes both the question and the answer, and
// only when the turn succeeds; the caller then refetches the conversation
// (useAssistantConversation's refetch). No notifyChanged(): chat rows feed no
// other screen.
// accountId is the active account, so "this month" means what Insights shows.
export async function aiChat({ conversationId = null, message, accountId = null }) {
  const now = new Date();
  const body = {
    mode: 'chat',
    conversation_id: conversationId,
    message,
    account_id: accountId,
    today: format(now, 'yyyy-MM-dd'),
    time: format(now, 'HH:mm'),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ data: null, error: new Error('timeout') }), CHAT_TIMEOUT_MS);
  });
  try {
    const { data, error } =
      (await Promise.race([supabase.functions.invoke('ai-assistant', { body }), timeout])) ?? {};
    if (error || !data) {
      if (error) console.warn('aiChat failed:', error.message);
      return { ok: false, reason: 'error' };
    }
    if (!data.ok) return { ok: false, reason: data.reason ?? 'error' };
    return { ok: true, conversationId: data.conversation_id, question: data.question ?? null, reply: data.reply };
  } catch (e) {
    console.warn('aiChat failed:', e?.message);
    return { ok: false, reason: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
