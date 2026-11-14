# 07: Simpler streak screen

Spec: .claude/features/archive/34-streak-only.md

**What to build:** The streak screen shows progress at a glance:
- a calendar of covered days, each marked logged, no-spend or frozen;
- the freezes held (0–2);
- the current streak;
- the next milestone (7, 30, 100 or 365).

The badge grid, trophy links and the manual "use a freeze" action are removed.

**Blocked by:** 03 (Freezes are earned and spent automatically)

**Status:** ready-for-agent

- [ ] Seeded logged, no-spend and frozen days each look different on the calendar
- [ ] The freezes-held number matches the marks in Supabase
- [ ] The next milestone is correct (for example, day 12 shows 30)
- [ ] No badge grid, trophy link or freeze button on the screen

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- `app/streak.js` is now a single view: the hero count, the headline, two stat cards (Freezes `n/2` from `useStreak().freezesHeld`; Next milestone with "N days to go", or "—" past 365), and the month calendar with a Logged / No spend / Frozen legend. 814 lines down to 406.
- Removed: the Streak/Milestones tabs, the badge wall, the reward detail sheet (coins/XP/themes/spin), the Longest/Breaks stats and the manual "use a freeze" card. Nothing on the screen writes `reward_events` any more. `useFreezeRecovery`, `useMissedDays` and `components/FreezePrompt.js` are now unused but kept, as the spec says.
- The footnote now explains no-spend days and automatic freezes.
- The Home header still has a trophy button linking to `/trophies`; that goes with the economy flag in ticket 04.
- Open (emulator checks paused): seeded logged, no-spend and frozen days look different on the calendar, the freezes number matches Supabase, and day 12 shows a next milestone of 30.
