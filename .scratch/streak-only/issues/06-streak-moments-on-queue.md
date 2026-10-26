# 06: Streak celebrations go through the queue

Spec: .claude/features/34-streak-only.md

**What to build:** Streak moments are rare, calm and never in the way.
- The day-1 "streak started" moment and the 7/30/100/365 milestones become celebration moments on the queue, each shown once. No spin wheel follows.
- The "We saved your streak" toast goes through the queue as an ambient moment.
- Each milestone shown tracks `streak_milestone {days}`.
- With bills due on a milestone day, the bills show first and the celebration waits for the next session.

**Blocked by:** 01 (`streak_marks` table and a streak reader that reads both stores), 03 (Freezes are earned and spent automatically), 05 (Moment queue, with the bills-due modal as its first moment)

**Status:** ready-for-agent

- [ ] Logging on day 1 shows the day-1 moment once; logging again that day doesn't repeat it
- [ ] A seeded day-7 streak shows the milestone once; the days in between show nothing
- [ ] With bills due on a milestone day, the bills show this session and the celebration next session
- [ ] No spin wheel after any celebration
- [ ] A `streak_milestone` event with `days` is recorded (when analytics consent is on)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
