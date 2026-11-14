# 03: Opt-in on the opener, with the pre-sign-in queue

Spec: .claude/features/archive/33-product-analytics.md

**What to build:** A new user chooses on the first onboarding screen (today's opener) whether to share anonymous usage. The switch is unticked by default.
- **Before sign-in:** the choice is held on the phone. With it on, events such as `onboarding_step_viewed {step: opener}` are queued, not sent.
- **After sign-in:** the queued events are flushed with the user's id, and the choice is copied to `profiles.analytics_consent`. From then on the profile is the source of truth across devices.
- **With the switch off:** nothing is queued, before or after sign-in.

Spec 35 (onboarding v3) rebuilds the opener and carries this switch over.

**Blocked by:** 02 (Offline event queue)

**Status:** ready-for-agent

- [ ] On a fresh install the opener shows the "Share anonymous usage to help improve FLO" switch, unticked
- [ ] Switch left off: after sign-in, zero `events` rows exist for the account, and the profile's consent is false
- [ ] Switch turned on: after sign-in, the queued `onboarding_step_viewed` row arrives with the user's id, and the profile's consent is true with a timestamp
- [ ] A user signing in on a second device follows the profile's consent, not that device's local default
- [ ] The switch follows the active theme, and the opener's existing flow (Dive In and the Sign in escape hatch) is unchanged

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built in `lib/track.js` and `app/onboarding/intro/opener.js`.
  - The opener shows an unticked "Share anonymous usage to help improve FLO" switch, in the screen's pinned default palette. Dive In and the Sign in link are unchanged. `onboarding_step_viewed {step: opener}` is tracked when the screen opens with consent on, or the moment the switch is turned on.
  - Signed out, the switch writes `flo.trackPreSignInConsent.v1` ('1'/'0'). Events are queued with no user id and never sent. Turning it off drops them.
  - First sign-in: if the profile has no `onboarded_at` (a new account), the choice is written to `profiles.analytics_consent` and the queued events take the user's id, then flush. An onboarded account (a second device) keeps its profile setting, and the queued events are dropped. The key is cleared once that's settled; if the profile write fails offline, it waits for the next load.
  - A change of user now starts with consent off until that user's consent is read, so the opener's choice can't send events for an account early.
  - Checked via MCP: the `on_auth_user_created` trigger creates the profile row at sign-up, so the copy has a row to update.
- Code review: fixed re-tracking after an on→off→on toggle, and the switch colours. Left as is: a profile write that fails offline is only retried on the next load; an account that never finished onboarding takes the device's opener choice; the opener shows no toast if the AsyncStorage write fails.
- Open emulator checks (paused): every acceptance line above. Fresh install with the switch off → sign up → zero rows and consent false; switch on → the opener row arrives with the user id and consent true with a timestamp; a second device's sign-in follows the profile; the switch's look.
