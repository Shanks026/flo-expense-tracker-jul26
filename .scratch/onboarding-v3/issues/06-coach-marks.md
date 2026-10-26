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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
