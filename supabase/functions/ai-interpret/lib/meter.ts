import { createClient } from 'jsr:@supabase/supabase-js@2';

// ai_usage has no DEFAULT auth.uid() (the service role has no auth.uid()), so
// user_id must be passed explicitly — the one sanctioned exception to FLO's
// DEFAULT auth.uid() standing rule, since this write is server-side only.
export async function recordUsage(params: {
  userId: string;
  kind: 'categorise' | 'receipt';
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const client = createClient(supabaseUrl, serviceKey);

  const { error } = await client.from('ai_usage').insert({
    user_id: params.userId,
    kind: params.kind,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
  });

  // Non-fatal — a metering hiccup shouldn't block returning the draft the
  // user is waiting on. Logged so it's visible in `get_logs`.
  if (error) console.error('Failed to record ai_usage:', error.message);
}
