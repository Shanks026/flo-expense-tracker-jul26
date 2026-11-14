# 11: Koban in his character moments

Spec: .claude/features/archive/37-design-system-and-koban.md

**What to build:** Users meet the same animated Koban wherever FLO has a character moment, and nowhere near their money.
- The raster mascot is replaced by the Koban component in:
  - the onboarding opener;
  - coach marks;
  - the streak celebration (day 1 and milestones);
  - the streak screen's hero;
  - the empty states that show a mascot today.
- Each placement picks a fitting mood and pose (for example, jump-for-joy on a milestone, hello on the opener, hmm on an empty state).
- Koban is never drawn on or over a money figure.
- The raster mascot images stay in the repo but aren't used on any visible screen.

**Art is a placeholder:** the agreed round-5 Koban is used for now; the person will replace it with their own illustrations later. Keep the art behind the component's props so the swap touches no placement.

**Blocked by:** 07 (Retire the 3D art), 09 (Koban moods), 10 (Koban poses)

**Status:** ready-for-agent

- [ ] Each listed surface shows the animated Koban, in light and dark
- [ ] No raster mascot image on any visible screen
- [ ] Koban never overlaps a money figure
- [ ] Reduced motion makes every placement still

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- **Onboarding opener:** `<Koban pose="hello" mood="happy" scarf>` (136 dp) replaces the "hey" PNG.
- **Coach marks:** a 40 dp Koban in the `tip` pose replaces the PNG in the bubble.
- **Streak screen hero:** a 92 dp Koban stands at the card's right edge (only his ground shadow is cropped), replacing the cropped poster PNG and its alpha-bbox geometry. His mood follows the streak: happy once today is logged, curious while the streak waits for today, sleepy at 0. He sits beside the day count, never a money figure.
- **Streak celebration:** `jump` + `joy` + scarf on a milestone and `hello` + `happy` on day 1 replace the 3D badge art (`STREAK_BADGE_ART`). The surface is always dark.
- Each placement passes `surface` (the theme's mode, or dark on the celebration), so his ground shadow suits the background. Reduced motion stills him everywhere (inside the component).
- **Empty states:** none shows a mascot today (`assets/mascot/budget.png` was unused), so there was nothing to swap. Specs 38/39 can place Koban as they design their empty states.
- `components/OnboardingMascot.js` was removed (no users left). The raster images stay in `assets/`. The only remaining raster mascot is in the flagged-off Trophy Room.
- Open (emulator checks paused): each placement on the device in light and dark, no overlap with figures, still with reduced motion.
