import { createClient } from 'jsr:@supabase/supabase-js@2';

// Hard cost stop, independent of is_pro — tune once real per-call cost is
// measured (subscription doc's "pricing research from real AI costs" step).
const MONTHLY_AI_CAP = 200;

function serviceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey);
}

// Reads entitlements.is_pro with the service role — client-side isPro flags
// are defeated by a decompiler, so this check must happen server-side, here.
export async function isEntitled(userId: string): Promise<boolean> {
  // Dev-only bypass before RevenueCat/the paywall exist. Off by default;
  // remove once Phase 4 of the subscription build (sub screens) lands.
  if (Deno.env.get('AI_ALLOW_ALL') === 'true') return true;

  const client = serviceClient();
  const { data, error } = await client
    .from('entitlements')
    .select('is_pro')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.is_pro === true;
}

export async function isUnderMonthlyCap(userId: string): Promise<boolean> {
  const client = serviceClient();
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { count, error } = await client
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());
  if (error) throw error;
  return (count ?? 0) < MONTHLY_AI_CAP;
}
