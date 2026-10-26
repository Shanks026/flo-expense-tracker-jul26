# 02: "No spend today" writes a streak mark

Spec: .claude/features/34-streak-only.md

**What to build:** A user who spent nothing taps "No spend today" and their streak continues, without anything going into the economy ledger.
- The existing button (in `TodayCard` until spec 38 moves it to the Home Today strip) writes a `no_spend` mark for today's local date, then runs `notifyChanged()`.
- Tapping it twice on one day writes one mark.
- It tracks `no_spend_marked`.
- No XP or reward feedback is shown, and no `reward_events` row is written.

Evening push suppression that reads the mark is spec 39, not this ticket.

**Blocked by:** 01 (`streak_marks` table and a streak reader that reads both stores)

**Status:** ready-for-agent

- [ ] Tapping "No spend today" writes one `streak_marks` row (`kind = no_spend`, today's local date)
- [ ] The streak count includes today straight after the tap, and the calendar shows it as a no-spend day
- [ ] No new `reward_events` row is written
- [ ] A `no_spend_marked` event is recorded (when analytics consent is on)

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- New `lib/streakMarks.js` → `markNoSpend(localDate)`: an idempotent upsert into `streak_marks` (`ignoreDuplicates` on `user_id,kind,day`), returning `isNew`.
- `TodayCard`'s "No-spend day" confirm now calls it instead of `claimNoSpend`, runs `notifyChanged()`, and tracks `no_spend_marked` only on a new mark. The XP reward burst is gone. `claimNoSpend` stays in `lib/rewardsMutations.js` for the flagged-off economy but has no caller.
- Checked via the MCP as the test user in a rolled-back transaction: the first insert writes 1 row, the second writes 0.
- Open (emulator checks paused): the tap → the streak includes today → the calendar shows no-spend; no `reward_events` row; the event lands when consent is on.
