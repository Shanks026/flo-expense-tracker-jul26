# 10: First Home coach mark and the full-flow check

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The first Home shows only the + coach mark (the existing `CoachMark` on the tab bar, restyled on the kit); no streak-chip mark. Then the whole Phase 3 flow is checked end to end on fresh accounts, fixing whatever the earlier tickets left uneven between steps (spacing, transitions, the counter).

- Order: opener → sign up → accounts → month start → limit → card → first expense → reminders → Home.
- Old onboarding components that nothing uses any more are noted for the Manrope cleanup ticket (not deleted here).

**Blocked by:** 02, 03, 04, 05, 06, 07, 08, 09

**Status:** ready-for-agent

- [ ] Every question answered on a fresh account: Home shows the accounts, the salary-day line, the card; Budgets shows the limit; the DB matches
- [ ] Every question skipped on another fresh account: one Personal account, monthly, no budget, Day card
- [ ] Force-stop mid-flow and reopen: the gate resumes on the first step and saved answers are kept
- [ ] The + coach mark shows once on the first Home; no streak mark
- [ ] `onboarding_step_viewed` rows arrive for each step with consent on
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
