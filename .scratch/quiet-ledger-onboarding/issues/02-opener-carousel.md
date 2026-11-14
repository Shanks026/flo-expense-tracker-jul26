# 02: Opener carousel

Spec: .claude/features/archive/47-quiet-ledger-onboarding.md

**What to build:** The pre-auth opener becomes three slides on the ledger kit: "Every rupee, in one quiet place", "Log in 3 taps, or just say it", "See where it went". Each has one large `Illustration` object (coins, spark, receipt), with page dots and a swipe between slides. A `PinnedFooter` on every slide carries **Create account** (primary, to sign-up) and **I have an account** (secondary, to sign-in); both set the intro-seen flag, as today.

- No analytics switch (spec 33: the opt-in left the opener). The opener's `onboarding_step_viewed` still sends only with consent on.
- Signed-out routing is unchanged: `RootNavigator` shows the opener, or sign-in once the intro has been seen on this phone.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] A fresh install (or cleared app data) opens the opener; swiping and the dots move between three slides
- [x] Create account opens sign-up; I have an account opens sign-in
- [x] After signing out, the phone goes straight to sign-in, not the opener
- [x] No analytics switch on any slide
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: built and checked on Pixel_API_36. A cleared install opens the opener; swiping moves through the three slides and the dots follow (light and dark). Create account opens sign-up, I have an account opens sign-in; a relaunch after either, and a log-out after signing in, go straight to sign-in. The pager is a paged horizontal ScrollView (no new dependency); the dots are a new kit `PageDots` (in the gallery), which Home's card carousel now uses too (checked on Home); each line holds two lines' height so the object doesn't jump between slides. Not checked: the opener's `onboarding_step_viewed` row (consent is off before sign-in). Sign-up and sign-in still have the old look until ticket 03. Review (two agents): no hard violations or spec gaps; fixed the shared dots, a tap guard that could stick if saving the flag failed, and two names. The emulator was left signed in as `FLO_ONB04_*` (app data was cleared for the check, so its local settings, such as voice language, are back to defaults).
