# 07: Onboarding funnel events

Spec: .claude/features/35-onboarding-v3.md

**What to build:** The onboarding funnel becomes measurable for users who opted in.
- `onboarding_step_viewed` is tracked for `auth`, `first_expense` and `reminder_ask`. The opener's is already in.
- `signup_completed {method: google | email}` is tracked once, when a new account is created.

Events from before sign-in follow spec 33's rule: they're queued, then sent with the user's id after sign-in, or dropped if consent is off.

**Blocked by:** 05 (The first expense in the real Add sheet)

**Status:** ready-for-agent

- [ ] With consent on, a fresh Google sign-up leaves one row each for opener, auth, first_expense and reminder_ask, plus `signup_completed {method: google}`
- [ ] An email sign-up records `signup_completed {method: email}`
- [ ] Signing in to an existing account records no `signup_completed`
- [ ] With consent off, the flow leaves zero `events` rows

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built.
  - **Step events:** `trackStepViewed(step)` in `lib/track.js` records `onboarding_step_viewed` once per app run.
    - It's called for `auth` (the opener's Continue with Google tap, and sign-in in sign-up mode), `first_expense` (the step's mount) and `reminder_ask` (its mount).
    - While a just-signed-in account's consent is still loading, steps wait and go through at the end of `loadTrackingConsent`, under that account's own choice.
  - **Sign-up event:** `signup_completed {method}` is reported from AuthContext:
    - email: `signUp` returned a session (nothing is recorded while email confirmation is pending);
    - google: the user's `last_sign_in_at` is within 2 minutes of `created_at`.

    It's recorded once the new account's consent is known, through the same path.
  - **Before sign-in:** the opener's `auth` step goes into the queue held on the phone, and the first sign-in claims or drops it (spec 33's rule).
  - **Names:** they match the `analytics.onboarding_funnel` view: opener → auth → first_expense → reminder_ask.
- Code review, both left:
  - Steps are deduplicated per run, not per account, so a second sign-up in the same run has no step rows.
  - A Google re-sign-in within 2 minutes of creating the account could record a second `signup_completed`. The `signups` view takes the first, so counts aren't affected.
- Open emulator checks (paused): the acceptance lines, read back through the Supabase MCP after a Google and an email sign-up, with consent on and off.
