# 06: Clean up the manifest and dependencies

Spec: .claude/features/32-safe-closed-test-build.md

**What to build:** The built manifest is clean and expo-doctor passes. `CAMERA` is added to the blocked permissions, the `androidNavigationBar` config is changed to the form expo-doctor accepts, and `expo-share-intent` is upgraded to 5.1.1. Share-to-FLO keeps working.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The regenerated Android manifest has no CAMERA permission
- [x] `npx expo-doctor` reports no navigation-bar or share-intent version issues
- [x] `expo-share-intent` is at 5.1.1
- [x] Sharing text from another app into FLO still opens the share flow on the emulator
- [ ] Profile-picture photo picking still works without CAMERA

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-19: Merged debug manifest has no CAMERA (prebuild marks it `tools:node="remove"`) and no NotificationListener; expo-doctor 18/18 passed; expo-share-intent 5.1.1. Sharing "Paid Rs 250 to Swiggy" from outside opened Add Transaction prefilled with ₹250. Not verified: profile-photo picking. The avatar asks for photos/media (not camera), then Google Play services fails to download the photo-picker module on this API 29 emulator ("Something went wrong"); cancelling returns to FLO without a crash. Needs a device or emulator with working Play services.
