# Research: anonymous-first auth + later Google linking

Ticket: `.scratch/v1-reset/issues/11-anonymous-auth-google-linking.md` (wayfinder research).
Audit context: `docs/flo-pre-launch-audit-2026-10.md` §1 "Sign-up: Google first and alone; anonymous-first next", §3 "Google OAuth uses the implicit flow", §5 "Defer the account wall".
Date: 2026-10-18. Installed client: `@supabase/supabase-js` / `@supabase/auth-js` **2.110.2** (checked in `node_modules`).

## Question

Can FLO start every new install as a Supabase **anonymous** user, let them log expenses straight away, and later attach a Google identity to that same user without losing data? What does that need for session persistence, Google linking (OAuth redirect vs native ID token), the case where the Google account already belongs to another FLO user, RLS, abuse controls, cleanup of abandoned anonymous users, and moving Google OAuth from the implicit flow to PKCE?

## Answer

**Feasible, and FLO's current client already supports all of it.** `signInAnonymously()` creates a real `auth.users` row with the `authenticated` role. FLO's existing `LargeSecureStore` session storage and owner-only RLS work for that user unchanged. Linking keeps the same `user.id`, so no data moves on the happy path. Recommended path:

1. Enable Anonymous Sign-Ins **and** Manual Linking in the dashboard. Turn on CAPTCHA (Turnstile) only if abuse shows up, because it needs a WebView token on React Native.
2. Switch the client to `flowType: 'pkce'` with an `expo-crypto`-backed `crypto.subtle.digest` polyfill, so the browser paths use S256 rather than `plain`.
3. Link with **native Google Sign-In** (`@react-native-google-signin/google-signin`) and pass the ID token to `supabase.auth.linkIdentity({ provider: 'google', token })`. ID-token linking is supported in auth-js 2.110.2 (it posts `link_identity: true` to `/token?grant_type=id_token`). It also removes the custom-scheme redirect for the main Google path. Keep `linkIdentity({ provider: 'google' })` over the browser (PKCE) as the fallback.
4. Handle `identity_already_exists`, which means the Google account is already a FLO user. Typical cause: a reinstall or a second device. Supabase does **not** merge. FLO must sign in to the existing user and move the anonymous user's rows with a `SECURITY DEFINER` RPC through a one-time "merge ticket", or discard them when the anonymous user is empty.
5. Add a pg_cron job that deletes anonymous users older than N days. FLO's `ON DELETE CASCADE` FKs and the `on_auth_user_deleted` trigger already handle the data.

## Key facts (with sources)

### Anonymous sign-in and persistence
- `supabase.auth.signInAnonymously()` creates a user. Anonymous users use the `authenticated` Postgres role, and their JWT carries `is_anonymous: true`. This is not the same as the `anon` API key. The account is lost on sign-out, cleared app data or a device change. Source: https://supabase.com/docs/guides/auth/auth-anonymous
- In auth-js 2.110.2, `signInAnonymously` POSTs `/signup` with `gotrue_meta_security.captcha_token`. It then calls `_saveSession` (the configured `storage`, which is FLO's `LargeSecureStore`) and emits `SIGNED_IN`. Persistence and refresh are therefore the same as for a password user. Source: `node_modules/@supabase/auth-js/src/GoTrueClient.ts` `signInAnonymously` (~l.797); upstream https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts
- Converting to permanent: manual linking must be enabled. For OAuth, call `linkIdentity`. For email, call `updateUser({ email })`, verify it, then call `updateUser({ password })`. Source: https://supabase.com/docs/guides/auth/auth-anonymous

### Linking Google
- Manual linking (beta) is a project setting (`GOTRUE_SECURITY_MANUAL_LINKING_ENABLED` when self-hosting). `linkIdentity({ provider })` sends the user to the provider and back with the identity attached to the **current** user. Source: https://supabase.com/docs/guides/auth/auth-identity-linking
- The same page says JS `linkIdentity` accepts `token` / `access_token` for native flows. Supported providers are Google, Apple, Facebook, Kakao and Keycloak, matching `signInWithIdToken`. Source: https://supabase.com/docs/guides/auth/auth-identity-linking
- Verified in the installed source: `linkIdentity(credentials)` routes to `linkIdentityIdToken` when `'token' in credentials`. That POSTs `/token?grant_type=id_token` with `{ provider, id_token, access_token, nonce, link_identity: true }` and the current session JWT, saves the returned session and emits `USER_UPDATED`. Otherwise `linkIdentityOAuth` GETs `/user/identities/authorize` and returns a provider URL. The docblock says: "If the candidate identity is already linked to the existing user or another user, `linkIdentity()` will fail." The OAuth variant "supports the PKCE flow". Source: `GoTrueClient.ts` ~l.4478–4590.
- History: ID-token linking was missing from supabase-js until late 2025. Issue "Support linkIdentityWithIdToken" was closed as completed on 2025-11-03, so 2.110.2 is well past it. Source: https://github.com/supabase/supabase-js/issues/1591
- Native Google for Expo: Supabase recommends `@react-native-google-signin/google-signin` and then `signInWithIdToken({ provider: 'google', token })`. Configure the **Web** client ID in `GoogleSignin.configure`, create an Android OAuth client with the SHA-1 (debug **and** Play App Signing), and register all client IDs on the Supabase Google provider page. Supabase checks the nonce by default, and a "Skip Nonce Check" toggle exists. Source: https://supabase.com/docs/guides/auth/social-login/auth-google (React Native tab)

### Conflict: the Google account already belongs to a FLO user
- Error code `identity_already_exists`: "The identity you're targeting is already tied to a user account." Related codes are `manual_linking_disabled`, `anonymous_provider_disabled`, `email_exists`, `over_request_rate_limit` and `captcha_failed`. Source: https://supabase.com/docs/guides/auth/debugging/error-codes
- Supabase's guidance for anonymous users who hit an existing account is to check that the current user is anonymous, attempt the conversion and catch the error, sign in to the existing account, **reassign the anonymous user's rows to the existing user id**, and pick a strategy (keep existing, keep anonymous, or merge). There is no built-in merge. Source: https://supabase.com/docs/guides/auth/auth-anonymous (section on resolving identity conflicts)
- Automatic linking only links identities that share a **verified** email, at sign-in time. It does not merge two existing users. Source: https://supabase.com/docs/guides/auth/auth-identity-linking

### RLS
- To restrict anonymous users, use a **restrictive** policy on `(auth.jwt()->>'is_anonymous')::boolean`. Permissive policies OR together, so a permissive check alone won't block them. Source: https://supabase.com/docs/guides/auth/auth-anonymous
- After linking, the user id is unchanged, and the new session's JWT has `is_anonymous: false`. The ID-token path saves a fresh session directly. The OAuth path returns one through the redirect.

### Abuse controls
- Anonymous sign-ins are limited per IP to **30 requests/hour** by default, adjustable in the dashboard. Supabase recommends invisible CAPTCHA or Cloudflare Turnstile, because the endpoint can be used to bloat the database. Source: https://supabase.com/docs/guides/auth/auth-anonymous ; rate limit settings: https://supabase.com/docs/guides/auth/rate-limits
- `signInAnonymously({ options: { captchaToken } })` and `linkIdentity` (ID-token path) both forward `captcha_token`. Source: `GoTrueClient.ts`.

### Cleanup
- Supabase has no automatic cleanup yet. The documented approach is SQL that deletes `auth.users` where `is_anonymous is true and created_at < now() - interval '30 days'`, which can run on a pg_cron schedule. Source: https://supabase.com/docs/guides/auth/auth-anonymous

### PKCE on React Native
- auth-js `generatePKCEChallenge` falls back to `plain` when `crypto.subtle` is missing and logs "WebCrypto API is not supported…". The method is `plain` when verifier == challenge, otherwise `s256`. Source: `node_modules/@supabase/auth-js/src/lib/helpers.ts` ~l.278–317. This is exactly the warning that caused the 2026-07-22 revert recorded in `lib/supabase.js`.
- PKCE stores the verifier in client storage when the flow starts. The returned `code` is single-use, valid for 5 minutes, and exchanged with `exchangeCodeForSession(code)`. Source: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- `expo-crypto` (SDK 54) exposes `digest(algorithm, data: BufferSource): Promise<ArrayBuffer>`, which has the same shape as `crypto.subtle.digest`. A polyfill such as `globalThis.crypto.subtle = { digest: (alg, data) => Crypto.digest(alg, data) }` (map `'SHA-256'` to `CryptoDigestAlgorithm.SHA256`), together with an existing `TextEncoder` (Hermes ships one), makes auth-js take the S256 branch. Source: https://docs.expo.dev/versions/v54.0.0/sdk/crypto/
- Supabase's own Expo deep-linking example still uses `makeRedirectUri` + `openAuthSessionAsync` + `QueryParams.getQueryParams` + `setSession`, which is the implicit flow. It recommends universal links over custom schemes. Source: https://supabase.com/docs/guides/auth/native-mobile-deep-linking?platform=react-native

## How it maps to FLO's current code

- **`lib/supabase.js`**: `LargeSecureStore` (AES blob in AsyncStorage, key in SecureStore), `persistSession: true`, `detectSessionInUrl: false`, and `flowType` deliberately left implicit (comment documents the `crypto.subtle` revert). Anonymous sessions need no storage change. The PKCE switch is a one-line `flowType: 'pkce'` plus an `expo-crypto` subtle polyfill imported before `createClient`. `expo-crypto` is not in `package.json` yet.
- **`lib/AuthContext.js` `signInWithGoogle`**: calls `signInWithOAuth({ provider: 'google', options: { redirectTo: makeRedirectUri(), skipBrowserRedirect: true } })` and `WebBrowser.openAuthSessionAsync`, then parses with `QueryParams.getQueryParams`. It already handles **both** hash tokens (`setSession`) and `?code=` (`exchangeCodeForSession`), so moving to PKCE does not need a parser change. The redirect is the `flo://` scheme (`app.json` `scheme: "flo"`), which is the interception risk from audit §3.
- **New functions needed** (in `AuthContext`, writes stay out of hooks): `startAnonymous()` (on first open when there's no session), `linkGoogle()` (native token → `linkIdentity`, with a PKCE browser fallback), and a conflict branch on `error.code === 'identity_already_exists'`.
- **`signOut()` / `deleteAccount()`**: for an anonymous user, sign-out **destroys** the account irreversibly. Both must check `session.user.is_anonymous` and warn first (or not offer sign-out at all), and should offer "Back up with Google" before export or reinstall-risky actions (audit §5).
- **`app/sign-in.js`**: currently the only entry point (`signIn`, `signUp`, `signInWithGoogle`). Under anonymous-first, `RootNavigator`'s `!session` branch would call `signInAnonymously` rather than route to sign-in. The sign-in screen remains for "I already have an account". `OnboardingGate` keeps owning `session` routing, so the split in `app/_layout.js` survives.
- **DB triggers**: `handle_new_user` fires on any `auth.users` insert, anonymous included. It creates the `profiles` row (no `full_name`, so onboarding must ask for a name or tolerate null) and the default "Personal" account, so `useAccount()` works for anonymous users. `onboarded_at` is NULL, so onboarding runs as today.
- **Cascades**: every `user_id` FK is `ON DELETE CASCADE`, and `on_auth_user_deleted` removes the avatar (00-index migrations `cascade_delete_user_data`, `private_avatars_and_self_delete`). A cron `delete from auth.users where is_anonymous and created_at < …` therefore cleans everything with no extra code. Use `last_sign_in_at`/`updated_at` instead of `created_at` so active-but-unlinked users aren't deleted.
- **RLS**: owner-only policies on `auth.uid()` work as-is. Add restrictive `is_anonymous = false` policies only where an anonymous user must be blocked. Candidates are split invites/joins (cross-user surfaces using `member_user_id`), `entitlements`/Pro purchase, and push-token registration if spam is a concern.
- **Merge on conflict** (needs a migration, not built): a `SECURITY DEFINER` pair, `create_merge_ticket()` called **while still anonymous** (stores a random one-time ticket → anonymous `auth.uid()`), then `redeem_merge_ticket(ticket)` called **after** signing in to the existing Google user. It reassigns `transactions` (into the target's active or "Personal" account), `budgets`/`plans` as limits allow, maps `categories` through the `(user_id, name, type)` unique key, then deletes the anonymous user. RLS blocks the client from doing this itself once it has switched users. If the anonymous user has zero transactions, skip the merge and just sign in.
- **Pro limits**: a naive "move the anonymous Personal account across" would give the existing user a 2nd account, which `FREE_LIMITS.accounts = 1` gates at create time. Merge transactions **into** an existing account rather than moving the account row.
- **send-push / TimezoneSync / PushTokenSync**: these run for any session, anonymous included. They are harmless, but push tokens of abandoned anonymous users disappear only with the cleanup cascade.

## Open risks

1. **Shared-IP rate limit in India.** 30 anonymous sign-ins/hour/IP is low behind mobile carrier CGNAT, where many users share one IP. Expect `over_request_rate_limit` at launch spikes. Raise the limit in the dashboard and retry quietly on first open. Not measured.
2. **CAPTCHA on React Native** needs a WebView-hosted Turnstile/hCaptcha token, which adds friction to first open and works against the reason for anonymous-first. Prefer the rate limit plus cleanup, and add CAPTCHA only if the auth logs show abuse.
3. **Native Google Sign-In nonce.** Supabase checks nonces by default. The free `@react-native-google-signin/google-signin` API may not let FLO set a nonce on Android, which could force "Skip Nonce Check". Verify on the emulator before choosing. The browser PKCE fallback has no such issue.
4. **Native module and SHA-1.** Native Google Sign-In needs a dev or EAS build (fine for FLO) and the **Play App Signing** SHA-1 registered in Google Cloud. The package rename away from `com.anonymous.flo` (audit P0) changes the OAuth client, so do the rename first.
5. **Email collision without a Google identity.** If the Google email already belongs to an existing **email/password** FLO user (no Google identity), the docs do not say whether `linkIdentity` succeeds (two users, one email) or fails with `email_exists`. Test on the emulator before shipping the copy.
6. **Merge correctness.** The ticket RPC is new security-sensitive code. Tickets need a short TTL, a single use, and binding to the anonymous uid, plus checks that the caller is non-anonymous. Splits that the anonymous user organised or joined need explicit handling, or the anonymous user must be blocked from splits entirely through RLS.
7. **Silent data loss** if an anonymous user clears app data, uninstalls or signs out before linking. That is inherent to the design. Mitigation is UX: a "Back up with Google" prompt after the first log or on day 2, and a blocking prompt before export or sign-out.
8. **PKCE polyfill fidelity.** auth-js also requires `TextEncoder` and `btoa`. Hermes on RN 0.81 provides both, but confirm the warning disappears and the authorize URL has `code_challenge_method=s256`. Even with PKCE, the `flo://` redirect still exists for the fallback path. Add an Android App Link (https + `autoVerify`) and restrict the Supabase redirect allow-list (audit §3).
9. **Manual linking is labelled beta** by Supabase. Behaviour or error codes could change.
10. **Anonymous users count as MAU** and add database rows. Keep the cleanup window short (for example 30 days of inactivity) to limit cost.
