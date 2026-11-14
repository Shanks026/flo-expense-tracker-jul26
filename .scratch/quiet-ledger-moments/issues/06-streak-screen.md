# 06: The Streak screen on the kit

Spec: .claude/features/archive/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The Streak screen without cards: a big count, two quiet stats and the month calendar. Spec 49 §Streak.

- `ScreenHeader` + `LargeTitle` "Streak" (`headerShown: false` on the route).
- Hero: the flame (filled `streak` above 0, muted otherwise) beside the count in `display`, "day streak", then the existing headline line.
- Stats row, no cards: Freezes "1 of 2"; Next milestone "30" with "12 days to go", or "All milestones reached" past 365.
- Calendar: a month `SectionHeader`, weekday initials (Monday first), the grid of ticket 01's streak marks in fixed seven-cell rows (the Android wrapping fix stays), a legend row, the footnote as a caption. A skeleton while loading.
- Pure rules: `streakCalendar(history, today)` → weeks of `{ key, day, inMonth, future, isToday, mark }` (mark `'logged' | 'nospend' | 'frozen' | null`; outside the history window null), and `nextMilestone(current)` → `{ days, toGo }` or null.

**Blocked by:** 01 (the streak mark)

**Status:** resolved

- [x] The check script covers `streakCalendar` (leading days from the previous month, future days, today, each mark, outside the history, seven days a week) and `nextMilestone` at 0, 6, 7, 29 and 365
- [x] Home's flame chip opens the screen; the calendar's marks match the test account's history
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-14 (resolved): `streakCalendar` and `nextMilestone` in a new pure module (14 checks, 506 passing, including a month that starts on a Monday). The screen is on the kit: `ScreenHeader` + `LargeTitle` (native header off), the count in `display` beside the flame, "day streak", the existing headline line; Freezes "0 of 2" and Next milestone "7" with "7 days to go" (or "All milestones reached") as two flat stats; the month grid of ticket 01's streak marks in fixed seven-cell rows, today's date on an ink pill, other months' and future days dimmed; the legend; the footnote; a skeleton while loading. The flame is lit only when today counts (as on Home's chip); a live streak not yet logged today keeps its count in ink. TalkBack reads each day ("Today, 14 November", "9 November: Logged"), and says "Not logged" only for a past day of the month.
- Checked on Pixel_API_36 in light and dark from Home's flame chip; the marks match the test account's history (logged 3, 8, 9 Nov; no-spend 6, 7, 10–12; frozen 4–5). Not seen on device: a count above 0 (the account's streak broke on 13 Nov), "All milestones reached", and the skeleton.
- For ticket 11: `StreakDays.js` (the old flame cells and the 7-day row) and `StreakFlameIcon.js` no longer have importers on the Streak screen or the celebration; check and delete there.

