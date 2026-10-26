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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
