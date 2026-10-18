# Supabase anonymous auth and Google identity linking

Map: [../map.md](../map.md)
Type: research
Labels: wayfinder:research
Status: resolved
Blocked by: 

## Question

Can FLO go anonymous-first with Supabase, and later link a Google identity without losing data?

Facts needed:
- Supabase anonymous sign-in on supabase-js v2 in React Native.
- Linking a Google identity: `linkIdentity` or manual linking, via a native Google Sign-In ID token or an OAuth redirect.
- What happens when the Google account already has a FLO user.
- RLS implications of the `is_anonymous` claim.
- Abuse and rate-limit settings.
- Cleaning up abandoned anonymous users.
- Moving Google OAuth off the implicit flow to PKCE (audit §3 P1).

Refs: audit §1 P1 sign-up, §5 P1 account wall.

## Answer

**Feasible: anonymous-first, with Google linked later, keeping the same user id. No data moves.** FLO's installed supabase-js 2.110.2 supports every step.
- `signInAnonymously()` creates a real user, so the existing RLS, `handle_new_user` trigger and cascades already apply.
- **Dashboard settings:** turn on Anonymous Sign-Ins and Manual Linking (beta).
- **Linking:** get an ID token from native `@react-native-google-signin/google-signin`, then call `linkIdentity({ provider: 'google', token })`. The browser `linkIdentity` flow is the fallback.
- **PKCE fix:** set `flowType: 'pkce'`, plus a `crypto.subtle.digest` polyfill backed by `expo-crypto`. PKCE was reverted only because `crypto.subtle` was missing.

**Google account already a FLO user:** linking fails with `identity_already_exists`, and Supabase has no merge. A one-time "merge ticket" RPC pair that moves transactions into the existing account would be needed, or v1 just asks the user to sign in instead.

**Abuse and cleanup:**
- Anonymous sign-ins default to 30 an hour per IP, which is risky behind Indian carrier NAT.
- CAPTCHA on React Native needs a WebView.
- There's no automatic cleanup, so a pg_cron delete keyed on last activity is needed.

**Open risks to check on the emulator:**
- whether a nonce can be passed on Android, or "Skip Nonce Check" is needed;
- linking a Google account whose email already belongs to an email/password user is undocumented.

**Ordering:** do the package-id change ([14](14-package-id-firebase.md)) before the auth work, because it changes the Google OAuth client.

Findings: branch `research/anonymous-auth-google-linking`, `research/anonymous-auth-google-linking.md` (commit 8152d6b).
