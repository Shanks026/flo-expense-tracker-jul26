import { createClient } from 'jsr:@supabase/supabase-js@2';

// Resolves the calling user from the request's Authorization header using the
// anon-key client (so the JWT is actually validated against Supabase Auth, not
// just decoded). SUPABASE_URL / SUPABASE_ANON_KEY are auto-injected by the
// Edge Functions runtime — never set these as secrets yourself.
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
