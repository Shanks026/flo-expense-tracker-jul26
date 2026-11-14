# 05: Moment queue, with the bills-due modal as its first moment

Spec: .claude/features/archive/34-streak-only.md

**What to build:** One queue decides every interruption, so users never tap through a stack of popups.
- A queue provider sits beside the toast provider. Sources call `enqueue({ kind, priority, payload })` instead of rendering their own modals. It replaces `lib/moments.js`.
- One moment is on screen at a time. Priority: actionable (bills due) > celebration > ambient (toasts).
- Caps: at most 1 full-screen takeover per app session, and 2 per day.
- Moments are held back while onboarding is active or the Add sheet is open, and shown once that's over.
- Unshown takeovers are saved on the device and replay next session. They never stack.
- The bills-due modal becomes the first queue moment. Coach marks keep waiting while any moment is showing.

**Blocked by:** 04 (Economy flagged off). Both rework the moment components mounted in the root layout.

**Status:** ready-for-agent

- [ ] With bills due, the bills modal shows through the queue once per session
- [ ] Nothing shows during onboarding or with the Add sheet open; the bills modal appears after the sheet closes
- [ ] A second takeover in the same session waits and shows next session, and no more than 2 show in a day
- [ ] Coach marks still never overlap a moment

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- New `lib/momentQueue.js`, a module-level store (so non-component code can enqueue): `enqueue({ id, kind, priority, payload, takeover, expiresAt })`, `finishMoment(id, { skipped })`, `setMomentBlocker(name, on)`, `useActiveMoment()`, `useAnyMomentActive()`. It orders by priority (actionable > celebration > ambient, then oldest first), caps takeovers at 1 per session and 2 per day (ambient moments are uncapped), and shows nothing while a blocker is set. Unshown takeovers and the ids already shown are saved per user in AsyncStorage, so a deferred takeover replays next session and a shown id never comes back. `skipped` gives the takeover back.
- New `components/MomentHost.js` renders the active moment through a kind → renderer map. `app/_layout.js` mounts `MomentQueueSync` (loads the signed-in user's queue; sets the `onboarding` blocker while the profile is loading, not yet onboarded, or on an onboarding route), `DueBillsSource` and `MomentHost`. Sessions start at the same points as the analytics session (cold start, a user change, a return after 30 s+ in the background).
- `components/DueBillsModal.js` → `DueBillsSource` enqueues `bills-due:<date>` (actionable, expiring at the end of the day) while bills are due; `DueBillsMoment` reads the bills live and skips if they were paid meanwhile. The old `flo.dueBills.lastShown` key is no longer used.
- The Add sheet sets the `add-sheet` blocker; coach marks read `useAnyMomentActive` from the queue. `lib/moments.js` is now a shim over the queue for `StreakCelebration` until ticket 06 (it reports itself as a blocker, so it isn't counted in the caps yet).
- Checked with a throwaway Node script, 14 scenarios, all passing: blocked by the Add sheet, coach marks see the blocker, bills before the celebration, the second takeover waits, ambient not capped, deferred replays next session, third-in-a-day waits, a shown id isn't re-enqueued, skipped frees the takeover, expired never shows, the onboarding blocker, and a pre-load enqueue survives the first load.
- Open (emulator checks paused): the bills modal through the queue, showing after the Add sheet closes, nothing during onboarding, and coach marks never overlapping.
