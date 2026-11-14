# 03: Remove dead ends, placeholders and developer UI

Spec: .claude/features/archive/32-safe-closed-test-build.md

**What to build:** The app stops looking broken or unfinished to testers:
- The "Forgot password?" link on sign-in is removed until the forgot-password spec ships. Testers use Google or email sign-in.
- Onboarding goes from the last setup step (journey) straight to the done screen, so the "Know your space" tour and the welcome-bundle reveal are skipped. The tour code stays; the onboarding spec deletes it later.
- The developer-only Settings rows (the push "Send test" row with its dev-build note, and the detection debug-log rows) only appear in development builds.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The sign-in screen has no "Forgot password?" link; email and Google sign-in still work
- [x] A fresh account completes onboarding from journey to the done screen and then Home, without seeing any tour card or the welcome-bundle screen
- [ ] In a release build, Settings shows no "Send test" push row, dev-build note or detection debug rows
- [x] In a dev build, those rows still appear and work

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-19: Dev build checked: Settings still shows the push "Send test" row (detection rows are absent because this is the lite variant). Not yet checked: the sign-in screen and a fresh account's onboarding (needs logging out of flotest@gmail.com, whose password the agent does not hold), and the release-build Settings rows (ticket 08's release build).

- 2026-10-19 (later): Logged out of flotest. The sign-in screen has no "Forgot password?" link and still shows email + "Continue with Google". A fresh account (the user signed it up by email) went account → currency → categories → balance → recent transaction → budget → reports → reminders → journey → "You're all set" → Home, with no tour card and no welcome-bundle screen (the bundle's 1,000 coins / 2 freezes / 1 badge still arrive). Still open: Google sign-in not exercised; release-build Settings rows (ticket 08).
