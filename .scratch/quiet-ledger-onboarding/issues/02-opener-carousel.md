# 02: Opener carousel

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The pre-auth opener becomes three slides on the ledger kit: "Every rupee, in one quiet place", "Log in 3 taps, or just say it", "See where it went". Each has one large `Illustration` object (coins, spark, receipt), with page dots and a swipe between slides. A `PinnedFooter` on every slide carries **Create account** (primary, to sign-up) and **I have an account** (secondary, to sign-in); both set the intro-seen flag, as today.

- No analytics switch (spec 33: the opt-in left the opener). The opener's `onboarding_step_viewed` still sends only with consent on.
- Signed-out routing is unchanged: `RootNavigator` shows the opener, or sign-in once the intro has been seen on this phone.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A fresh install (or cleared app data) opens the opener; swiping and the dots move between three slides
- [ ] Create account opens sign-up; I have an account opens sign-in
- [ ] After signing out, the phone goes straight to sign-in, not the opener
- [ ] No analytics switch on any slide
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
