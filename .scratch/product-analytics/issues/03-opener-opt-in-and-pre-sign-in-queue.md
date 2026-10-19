# 03: Opt-in on the opener, with the pre-sign-in queue

Spec: .claude/features/33-product-analytics.md

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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
