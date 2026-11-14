# 01: Streak mark and the milestone celebration

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** Celebrations only at the 7, 30, 100 and 365 day milestones, as one calm full screen on the app's own background. Spec 49 §Milestone celebrations and §Streak (the shared streak mark).

- A pure rule, `celebrationFor({ current, isMilestone, loggedToday })` → `{ id, days }` or null, decides what the source enqueues. The day-one ("streak start") moment is no longer enqueued. The id format, priority, expiry, payload snapshot and `streak_milestone` event are unchanged.
- A ledger streak mark (logged = filled `streak` dot, no-spend = `streak` ring, frozen = muted snowflake, nothing = empty sunk circle) joins the kit and the gallery. Ticket 06 reuses it on the Streak screen.
- The screen: a full-screen `Modal` (keep `statusBarTranslucent`) on `canvas`; the large `trophy` `Illustration`; the count in brand display type with a "day streak" caption; one line from the existing milestone recap; the last seven days as streak marks, oldest left and today right; `PinnedFooter` Continue.
- Motion: only the object animates in. No confetti. Reduced motion shows everything still. A success haptic on open. Back closes it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The check script covers `celebrationFor`: day one null, 7/30/100/365 celebrate, day 8 null, no log today null, the id format
- [ ] The streak mark is in the kit gallery in all four states
- [ ] A milestone celebration shows on the device in light and dark, with Continue and back both closing it; the queue moves on afterwards
- [ ] Day one of a streak shows no celebration
- [ ] Emulator check. Seeding streak marks to reach a milestone is lasting test data: ask the person first, and remove it afterwards with their yes. Raise the seven-day row order (oldest → today) at the check

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
