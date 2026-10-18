# 06: Clean up the manifest and dependencies

Spec: .claude/features/32-safe-closed-test-build.md

**What to build:** The built manifest is clean and expo-doctor passes. `CAMERA` is added to the blocked permissions, the `androidNavigationBar` config is changed to the form expo-doctor accepts, and `expo-share-intent` is upgraded to 5.1.1. Share-to-FLO keeps working.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The regenerated Android manifest has no CAMERA permission
- [ ] `npx expo-doctor` reports no navigation-bar or share-intent version issues
- [ ] `expo-share-intent` is at 5.1.1
- [ ] Sharing text from another app into FLO still opens the share flow on the emulator
- [ ] Profile-picture photo picking still works without CAMERA

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
