// send-push — Phase 1 (17-server-push-notifications.md): manual test-send
// only. Proves the push_tokens → Expo push API pipeline actually delivers,
// including with the app fully closed, before Phase 2 builds the real
// cron-driven reminder logic on top of it.
//
// Invoke with a JSON body: { "userId": "<uuid>" }. Uses the service-role
// key (auto-injected as SUPABASE_SERVICE_ROLE_KEY by the Edge Functions
// runtime — never set this as a secret manually, same note as
// ai-interpret's lib/entitlements.ts) so it can read push_tokens across
// users. Phase 2's cron-driven version needs that same cross-user access
// regardless, so this is built with the real auth model from the start
// instead of a narrower one that would need swapping out later.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const userId = body?.userId as string | undefined;
  if (!userId) return json({ error: 'userId_required' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: tokens, error } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
  if (error) {
    console.error('send-push: push_tokens read failed:', error.message);
    return json({ error: 'push_tokens_read_failed' }, 500);
  }
  if (!tokens || tokens.length === 0) {
    return json({ sent: 0, message: 'no push tokens registered for this user' });
  }

  // flo.reminders.nudge — the existing HIGH-importance Android channel
  // lib/notifications.js already creates client-side (05-koban-engagement.md
  // Phase 1). Reused rather than creating a new one: this test push is
  // standing in for what Phase 2's real nudge will send, so it should behave
  // (heads-up, sound, vibrate) exactly the same way.
  const messages = tokens.map(({ token }: { token: string }) => ({
    to: token,
    title: 'FLO test push',
    body: 'If this arrived with the app fully closed, the pipeline works.',
    sound: 'default',
    channelId: 'flo.reminders.nudge',
  }));

  const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!pushRes.ok) {
    const errText = await pushRes.text();
    console.error('send-push: Expo push API error:', pushRes.status, errText);
    return json({ error: 'expo_push_failed', status: pushRes.status }, 502);
  }

  const pushResult = await pushRes.json();
  return json({ sent: messages.length, pushResult });
});
