# 06: The Streak screen on the kit

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The Streak screen without cards: a big count, two quiet stats and the month calendar. Spec 49 §Streak.

- `ScreenHeader` + `LargeTitle` "Streak" (`headerShown: false` on the route).
- Hero: the flame (filled `streak` above 0, muted otherwise) beside the count in `display`, "day streak", then the existing headline line.
- Stats row, no cards: Freezes "1 of 2"; Next milestone "30" with "12 days to go", or "All milestones reached" past 365.
- Calendar: a month `SectionHeader`, weekday initials (Monday first), the grid of ticket 01's streak marks in fixed seven-cell rows (the Android wrapping fix stays), a legend row, the footnote as a caption. A skeleton while loading.
- Pure rules: `streakCalendar(history, today)` → weeks of `{ key, day, inMonth, future, isToday, mark }` (mark `'logged' | 'nospend' | 'frozen' | null`; outside the history window null), and `nextMilestone(current)` → `{ days, toGo }` or null.

**Blocked by:** 01 (the streak mark)

**Status:** ready-for-agent

- [ ] The check script covers `streakCalendar` (leading days from the previous month, future days, today, each mark, outside the history, seven days a week) and `nextMilestone` at 0, 6, 7, 29 and 365
- [ ] Home's flame chip opens the screen; the calendar's marks match the test account's history
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
