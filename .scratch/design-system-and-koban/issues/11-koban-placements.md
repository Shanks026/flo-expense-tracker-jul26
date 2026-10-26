# 11: Koban in his character moments

Spec: .claude/features/37-design-system-and-koban.md

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

**Blocked by:** 07 (Retire the 3D art), 09 (Koban moods), 10 (Koban poses)

**Status:** ready-for-agent

- [ ] Each listed surface shows the animated Koban, in light and dark
- [ ] No raster mascot image on any visible screen
- [ ] Koban never overlaps a money figure
- [ ] Reduced motion makes every placement still

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
