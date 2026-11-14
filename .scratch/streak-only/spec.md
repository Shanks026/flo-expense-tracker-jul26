# Streak only: economy flagged off, automatic freezes, moment queue

Spec: .claude/features/archive/34-streak-only.md

Decisions made while ticketing (2026-10-26):
- The economy flag goes in the existing `lib/flags.js` (spec 32), not a new `lib/features.js` as the v1-reset map said.
- Spec 38's Home Today strip isn't built, so the existing "No spend today" button in `TodayCard` is pointed at `streak_marks` now. Spec 38 moves the button later.
- The moment queue replaces `lib/moments.js`; coach marks and the Add sheet keep waiting on it.
- The queue (05) and the streak moments on it (06) are separate tickets, so the queue can be checked with the bills-due modal alone first.
- 05 waits for 04 because both rework the moment components mounted in `app/_layout.js`.
