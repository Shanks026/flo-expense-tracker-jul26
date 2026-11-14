# 06: Streak celebrations go through the queue

Spec: .claude/features/archive/34-streak-only.md

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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- `components/StreakCelebration.js` is split like the bills modal. `StreakCelebrationSource` (mounted in `app/_layout.js`) enqueues a `streak` celebration once today's log makes it day 1 or a 7/30/100/365 milestone, with the id `streak-start:<date>` or `streak-milestone:<n>:<date>` and a snapshot payload (count, flags, the last 7 history days). It expires at the end of tomorrow. `StreakCelebrationMoment` renders it from the snapshot. 419 → ~190 lines.
- Removed: the milestone payout and reward block, the spin-wheel chain, the RewardBurst wait, the old per-user `flo.streak.lastCelebrated` key, the `FORCE_SHOW_FOR_TESTING` override, and its own onboarding/other-moment checks (the queue's blockers and caps do that now).
- A milestone tracks `streak_milestone { days }` when it shows; day 1 doesn't.
- "We saved your streak" is an ambient `toast` moment (`StreakFreezeSync` enqueues it with the id `freeze-saved:<day>`). `MomentHost` gained the `streak` and `toast` renderers.
- `lib/moments.js` is deleted. The flagged-off `RankUpCelebration` and the unmounted `FreezePrompt` now import the blocker API from `lib/momentQueue.js`.
- With bills due on a milestone day, bills (actionable) show first and use the session's takeover; the celebration waits for the next session (covered by the ticket 05 queue scenarios).
- Open (emulator checks paused): the day-1 moment once, a seeded day-7 milestone once, bills-then-celebration across sessions, no spin wheel, and the event landing.
