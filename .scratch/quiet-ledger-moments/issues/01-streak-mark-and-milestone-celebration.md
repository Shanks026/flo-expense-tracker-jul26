# 01: Streak mark and the milestone celebration

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** Celebrations only at the 7, 30, 100 and 365 day milestones, as one calm full screen on the app's own background. Spec 49 §Milestone celebrations and §Streak (the shared streak mark).

- A pure rule, `celebrationFor({ current, isMilestone, loggedToday })` → `{ id, days }` or null, decides what the source enqueues. The day-one ("streak start") moment is no longer enqueued. The id format, priority, expiry, payload snapshot and `streak_milestone` event are unchanged.
- A ledger streak mark (logged = filled `streak` dot, no-spend = `streak` ring, frozen = muted snowflake, nothing = empty sunk circle) joins the kit and the gallery. Ticket 06 reuses it on the Streak screen.
- The screen: a full-screen `Modal` (keep `statusBarTranslucent`) on `canvas`; the large `trophy` `Illustration`; the count in brand display type with a "day streak" caption; one line from the existing milestone recap; the last seven days as streak marks, oldest left and today right; `PinnedFooter` Continue.
- Motion: only the object animates in. No confetti. Reduced motion shows everything still. A success haptic on open. Back closes it.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The check script covers `celebrationFor`: day one null, 7/30/100/365 celebrate, day 8 null, no log today null, the id format
- [x] The streak mark is in the kit gallery in all four states
- [x] A milestone celebration shows on the device in light and dark, with Continue and back both closing it; the queue moves on afterwards
- [x] Day one of a streak shows no celebration
- [x] Emulator check. Seeding streak marks to reach a milestone is lasting test data: ask the person first, and remove it afterwards with their yes. Raise the seven-day row order (oldest → today) at the check

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-14 (resolved): `celebrationFor({ current, loggedToday }, todayStr)` in a new pure celebrations module (derives the milestone from `MILESTONES` rather than taking `isMilestone`; 8 checks, 466 passing). The source enqueues milestones only; the day-one moment is gone. A moment saved by an older build that isn't a milestone gives the takeover back (`skipped`). `StreakMark` (logged dot, no-spend ring, frozen snowflake, empty sunk circle, `dimmed`) is in the kit and gallery. The screen is on `canvas` with the trophy (a 220 ms fade and scale, the only motion), the count at Inter 700 36, "day streak", the milestone recap's body line (its titles aren't used, so the 🎉 title never shows), seven marks oldest → today, and a pinned Continue; a success haptic on open.
- Checked on Pixel_API_36 in light and dark through a Developer-only preview in the Kit gallery ("Show the 7-day celebration", `preview` payload, logs no event): layout, Continue and back both close it. Not checked on device: the real queue path (the source enqueueing on a real milestone and the queue moving on), and day one showing nothing; both rest on the check script, because reaching a real milestone needs seeded streak marks (lasting test data, not asked for). The test account's streak is unchanged.
- For the person: the seven-day row runs oldest → today (spec 49); the redesign plan said newest first. Say if you want it flipped.
- Left for ticket 11: `recapCta` and the day-one recap copy are now unused.

