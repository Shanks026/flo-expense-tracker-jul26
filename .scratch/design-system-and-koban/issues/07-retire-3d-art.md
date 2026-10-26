# 07: Retire the 3D art

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** The flat UI no longer mixes in glossy 3D art.
- The streak chip on Home, the streak screen and the 7-day streak row use the lucide flame (lit and unlit states) instead of the glossy flame PNG.
- The 3D coin and chest images no longer appear on any surface that's visible with the economy flagged off.
- The image files stay in the repo for the flagged-off economy.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The streak chip, streak screen and 7-day row show the lucide flame, lit and unlit, in light and dark
- [ ] No 3D coin, chest or glossy flame image on any visible screen
- [ ] Logged, no-spend and frozen days are still distinguishable in the streak row and calendar

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
