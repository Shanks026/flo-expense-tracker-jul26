import { supabase } from './supabase';

// Category writes (spec 48, ticket 09), used by the category sheet. Each
// returns supabase's { error }; the caller runs notifyChanged().

export async function createCategory({ name, type, icon, color }) {
  return supabase.from('categories').insert({ name, type, icon, color, is_default: false });
}

export async function updateCategory(id, { name, type, icon, color }) {
  return supabase.from('categories').update({ name, type, icon, color }).eq('id', id);
}

// How many transactions and budgets use a category: deleting is refused
// while either is above zero (the guard predates spec 48, unchanged).
export async function categoryUsage(id) {
  const [{ count: transactions }, { count: budgets }] = await Promise.all([
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id),
    supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('category_id', id),
  ]);
  return { transactions: transactions ?? 0, budgets: budgets ?? 0 };
}

export async function deleteCategory(id) {
  return supabase.from('categories').delete().eq('id', id);
}
