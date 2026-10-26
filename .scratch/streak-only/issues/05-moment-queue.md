# 05: Moment queue, with the bills-due modal as its first moment

Spec: .claude/features/34-streak-only.md

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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
