# 05: The first expense in the real Add sheet

Spec: .claude/features/35-onboarding-v3.md

**What to build:** Between sign-in and the reminder ask, a new user lands on an empty Home with the real Add sheet open over it. It's the same sheet and category grid they'll use every day, not a forked onboarding screen.
- **Save** logs the expense, and `expense_logged` carries `source: onboarding`.
- **Not now** closes the sheet without logging anything.

Either way the user moves on to the reminder ask. No celebration (streak, trophy, rank-up, confetti) fires before `onboarded_at` is set.

The step uses today's Add sheet. When spec 36 reworks the sheet, this step keeps working unchanged.

**Blocked by:** 04 (The short path (2c): delete the old onboarding screens)

**Status:** ready-for-agent

- [ ] After sign-in, the Add sheet opens over an empty Home
- [ ] Saving creates the transaction and goes to the reminder ask
- [ ] Not now creates nothing and goes to the reminder ask
- [ ] With consent on, the `expense_logged` row has `source: onboarding`
- [ ] No streak celebration, trophy toast or other celebration shows during onboarding
- [ ] A fresh install reaches the first saved expense in 4 screens and about 6 taps

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
