# 03: Remove dead ends, placeholders and developer UI

Spec: .claude/features/32-safe-closed-test-build.md

**What to build:** The app stops looking broken or unfinished to testers:
- The "Forgot password?" link on sign-in is removed until the forgot-password spec ships. Testers use Google or email sign-in.
- Onboarding goes from the last setup step (journey) straight to the done screen, so the "Know your space" tour and the welcome-bundle reveal are skipped. The tour code stays; the onboarding spec deletes it later.
- The developer-only Settings rows (the push "Send test" row with its dev-build note, and the detection debug-log rows) only appear in development builds.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The sign-in screen has no "Forgot password?" link; email and Google sign-in still work
- [ ] A fresh account completes onboarding from journey to the done screen and then Home, without seeing any tour card or the welcome-bundle screen
- [ ] In a release build, Settings shows no "Send test" push row, dev-build note or detection debug rows
- [ ] In a dev build, those rows still appear and work

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
