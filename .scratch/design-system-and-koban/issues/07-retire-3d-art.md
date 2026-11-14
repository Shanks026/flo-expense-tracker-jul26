# 07: Retire the 3D art

Spec: .claude/features/archive/37-design-system-and-koban.md

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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- The Home streak chip and the streak screen hero use the lucide `Flame`, filled streak orange when lit and an outlined muted grey when not. The glossy `streak.png` / `streak-locked.png` and their fill-ratio maths are gone from both.
- `StreakFlame` (the 7-day row and the streak calendar): an empty day is an outlined grey `Flame` (a translucent white on the always-dark celebration), and a frozen day is a lucide `Snowflake` on the ice wash instead of the freeze-medallion PNG. Logged (white check on orange) and no-spend (green flame) are unchanged, so all four states stay distinct.
- The coin, freeze and chest images now appear only on economy surfaces (the hidden Home chip, Shop, rewards sheets, spin wheel), and the files stay in the repo. `StreakFlameIcon.js` was already unused.
- Not in scope here: the streak *badge* art on the celebration screen; ticket 11 replaces that with Koban.
- Open (emulator checks paused): the chip, hero, row and calendar lit/unlit/frozen in light and dark.
