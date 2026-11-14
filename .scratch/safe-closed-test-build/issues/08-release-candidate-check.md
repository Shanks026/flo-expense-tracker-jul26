# 08: Release-candidate check: lite AAB plus full emulator walk

Spec: .claude/features/archive/32-safe-closed-test-build.md

**What to build:** Show that the first closed-test AAB is safe to upload, by checking both the built artifact and the installed app. This is the release check to repeat before every upload, written down so it can be rerun.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07

**Status:** ready-for-agent

- [ ] **Artifact:** the lite AAB's merged manifest (via `aapt dump` or bundletool) has no `NotificationListenerService` and no CAMERA permission
- [ ] **Artifact:** the package id is `app.floexpense.tracker` and the version code is above 2
- [ ] **Emulator** (Pixel_API_36, fresh install of the lite release build): a new account signs up and goes through onboarding to Home, with no tour
- [ ] Menu, Settings, Shop and every former Pro trigger show no price, Buy button, upsell or dev row, and sign-in has no "Forgot password?" link
- [ ] 2+ accounts, 3+ budgets and 2+ splits can be created with no wall
- [ ] A manually invoked push arrives
- [ ] The release-check steps are written down where the next upload will find them (e.g. the release notes in `00-index.md`)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
