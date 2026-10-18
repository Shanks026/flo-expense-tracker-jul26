# 04: Root error boundary with a recovery screen

Spec: .claude/features/32-safe-closed-test-build.md

**What to build:** When something throws while rendering, the tester sees a calm, branded recovery screen instead of the app closing. The screen offers "Try again", which remounts the tree, and "Go to Home". The boundary is in-house, wraps the app just below the providers it needs for theming, and uses theme tokens. Dev builds also show the error message. No third-party SDK; native crashes and ANRs are covered by Play Console's Android vitals.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A render error forced in a dev build shows the recovery screen with the error message
- [ ] "Try again" remounts the app and, once the error is gone, the app works normally
- [ ] "Go to Home" lands on Home with a working app
- [ ] A release build shows the screen without the error message
- [ ] The screen follows the active theme (no hardcoded colours) and no third-party SDK is added

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
