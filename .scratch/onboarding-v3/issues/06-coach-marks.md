# 06: Coach marks on first Home

Spec: .claude/features/35-onboarding-v3.md

**What to build:** A small reusable coach-mark overlay: a Koban character moment that points at one element with a short line and closes on tap. It's used twice, once each:
- on the first Home after onboarding, it points at the **+** button;
- after the user's first log, it points at the **streak chip**.

Whether each one has been seen is stored on the phone, per user. A coach mark waits while a celebration or any other queued moment is showing. Users who onboarded before this change don't see them.

**Blocked by:** 04 (The short path (2c): delete the old onboarding screens)

**Status:** ready-for-agent

- [ ] The first Home after onboarding shows the + coach mark; once dismissed it never comes back
- [ ] After the first logged expense, the streak-chip coach mark shows once
- [ ] Neither shows while a celebration is on screen
- [ ] A user who onboarded before this change sees neither
- [ ] The overlay uses theme tokens and works in light and dark

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built.
  - **`components/CoachMark.js`:** a transparent Modal that dims the screen, draws a ring around the measured target, and shows a bubble with Koban's hello image and one line. A tap anywhere dismisses it. Seen-state is stored per user in AsyncStorage (`flo.coachMark.<id>.<userId>`) and shared through a small cache, so one mark can wait for another (`after`).
  - **Who sees them:** only users whose `onboarded_at` is on or after `COACH_MARKS_SINCE` (2026-10-26), so anyone who onboarded earlier sees neither.
  - **`lib/moments.js`:** a tiny registry of which full-screen moments are showing. StreakCelebration (and its spin wheel), RankUpCelebration, FreezePrompt and DueBillsModal report themselves. Coach marks wait while any of them, or a RewardBurst, is up. Spec 34's single moment queue replaces this.
  - **"add":** in TabBar, pointing at +, and only while Home is the open tab.
  - **"streak":** on Home, pointing at the streak chip, once the streak is lit (a log exists) and after "add" has been seen.
- Code review:
  - Fixed: the eligibility check compares dates, not strings.
  - Left: a celebration that decides to open *after* a coach mark is already up will cover it until dismissed. There's no ordering until spec 34.
- Open emulator checks (paused): every acceptance line, including that the ring lines up with + and the streak chip in light and dark.
