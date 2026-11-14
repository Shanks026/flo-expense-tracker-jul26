# 04: Root error boundary with a recovery screen

Spec: .claude/features/archive/32-safe-closed-test-build.md

**What to build:** When something throws while rendering, the tester sees a calm, branded recovery screen instead of the app closing. The screen offers "Try again", which remounts the tree, and "Go to Home". The boundary is in-house, wraps the app just below the providers it needs for theming, and uses theme tokens. Dev builds also show the error message. No third-party SDK; native crashes and ANRs are covered by Play Console's Android vitals.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A render error forced in a dev build shows the recovery screen with the error message
- [x] "Try again" remounts the app and, once the error is gone, the app works normally
- [x] "Go to Home" lands on Home with a working app
- [ ] A release build shows the screen without the error message
- [x] The screen follows the active theme (no hardcoded colours) and no third-party SDK is added

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-19: A forced render error in the Trophies screen (dev build) showed the themed recovery screen with the error message. "Go to Home" landed on a working Home (Menu, Budgets opened); "Try again" remounted the app to a working Home once the error was gone. Temporary throw removed. Not yet checked: release build without the error message (ticket 08). Seen in passing: the status-bar icons are white on the light recovery screen.
