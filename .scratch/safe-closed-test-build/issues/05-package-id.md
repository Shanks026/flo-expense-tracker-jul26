# 05: Package id `app.floexpense.tracker`, with `.personal` for auto-detect builds

Spec: .claude/features/32-safe-closed-test-build.md

**What to build:** FLO gets its permanent store identity. The app config derives the Android package from the variant: `app.floexpense.tracker.personal` whenever auto-detect is built in, otherwise `app.floexpense.tracker`. The placeholder `com.anonymous.flo` goes away. `google-services.json` is replaced with one file covering both Firebase Android apps, so push keeps working under both ids. The store build and the personal build install side by side on one phone. The native auto-detect module's Kotlin namespace is not renamed, since it only exists in the personal build.

**Blocked by:** None in code. It needs the human console steps from the v1-reset map first: both Firebase Android apps registered (yielding the combined `google-services.json`), and the FCM V1 key uploaded to EAS for both package ids.

**Status:** ready-for-agent

- [ ] A lite build's package id is `app.floexpense.tracker`; a build with auto-detect is `app.floexpense.tracker.personal`
- [ ] Both builds install side by side on the emulator
- [ ] Email and Google sign-in work on the lite build under the new id
- [ ] A manually invoked `send-push` (feature 17 checklist) arrives on the lite build under the new id
- [ ] The personal build still detects transactions (after "Allow restricted settings")
- [ ] Existing account data appears after reinstalling (it lives on the server)
- [ ] No build is uploaded to Play before this lands

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
