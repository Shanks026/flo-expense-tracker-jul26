// ai-interpret — the shared AI proxy. Every AI capability in FLO (categorise,
// receipt scan, and any future mode) is an input adapter onto this one
// endpoint: unstructured input in, a validated transaction draft out. Never
// writes to the ledger itself — the client always opens AddTransactionSheet
// prefilled and the user confirms. See .claude/features/13-ai-features.md.
import { getUser } from './lib/auth.ts';
import { isEntitled, isUnderMonthlyCap } from './lib/entitlements.ts';
import { recordUsage } from './lib/meter.ts';
import { provider } from './providers/index.ts';
import type { InterpretInput, InterpretMode } from './providers/types.ts';

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

  const user = await getUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const mode = body?.mode as InterpretMode;
  if (mode !== 'categorise' && mode !== 'receipt') {
    return json({ error: 'invalid_mode' }, 400);
  }
  if (!Array.isArray(body?.categories)) {
    return json({ error: 'categories_required' }, 400);
  }

  try {
    const entitled = await isEntitled(user.id);
    if (!entitled) return json({ error: 'pro_required' }, 403);

    const underCap = await isUnderMonthlyCap(user.id);
    if (!underCap) return json({ error: 'ai_cap_reached' }, 429);
  } catch (err) {
    console.error('ai-interpret entitlement check failed:', err);
    return json({ error: 'entitlement_check_failed' }, 500);
  }

  const input: InterpretInput = {
    mode,
    categories: (body.categories as InterpretInput['categories']) ?? [],
    text: body.text as string | undefined,
    imageBase64: body.imageBase64 as string | undefined,
    imageMimeType: body.imageMimeType as string | undefined,
  };

  try {
    const result = await provider.interpret(input);
    await recordUsage({
      userId: user.id,
      kind: mode,
      model: result.usage.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });
    return json({ draft: result.draft });
  } catch (err) {
    console.error('ai-interpret provider error:', err);
    return json({ error: 'provider_error' }, 502);
  }
});
