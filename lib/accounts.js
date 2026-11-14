import { supabase } from './supabase';

// Account writes, shared by the Add Account sheet and onboarding's
// "Where does your money live?" (spec 47). Each returns supabase's
// { data, error } with the saved row; the caller runs notifyChanged().
// `fields` is { name, description, color, currency }; user_id comes from the
// column default (auth.uid()), as it always has.

export async function createAccount(fields) {
  return supabase.from('accounts').insert(fields).select().single();
}

// Also the rename path: pass only { name } to rename.
export async function updateAccount(id, fields) {
  return supabase.from('accounts').update(fields).eq('id', id).select().single();
}
