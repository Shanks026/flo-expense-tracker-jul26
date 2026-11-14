# 05: The first expense in the real Add sheet

Spec: .claude/features/archive/35-onboarding-v3.md

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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built.
  - **Step list:** `first_expense` (`/onboarding/first-expense`) now comes before `reminders`, so the gate sends new users there first.
  - **The step:** the screen opens the real Add sheet 350 ms after mounting, with `{ source: 'onboarding', onDone }`.
    - Closing the sheet calls `onDone({ saved })`, and the step goes to the reminder ask. After a save it adds `?logged=1`, which makes the title "Logged. Want a 9 pm nudge?".
    - The screen behind has "Add an expense" (reopens the sheet) and "Not now" as a fallback.
  - **Add sheet:**
    - New optional `source` and `onDone` fields on the open payload. `onDone` runs once, through BottomSheetModal's `onDismiss`.
    - A new expense tracks `expense_logged {source}`, with `manual` as the default.
    - With `source: 'onboarding'`, there's no reward burst and no budget or plan toasts. The daily claim still lands.
  - **Celebrations:** StreakCelebration and TrophyToast now wait for `onboarded_at` (RankUp already did). This reverses the old feature-28 decision.
- Choice made: the sheet opens over a small "Log your first expense" backdrop, not the real Home. Mounting Home inside onboarding would also bring in its side effects (the login-reward burst, the due-bills modal). This is worth confirming with the person.
- Code review, all left:
  - Openers that don't pass a source (notification tap, share intent) are tagged `manual` until spec 36 and spec 40 pass theirs.
  - Re-opening the sheet while it's already open drops the earlier `onDone`. The "Not now" fallback covers it.
- Open emulator checks (paused): every acceptance line, including counting screens and taps from a fresh install to the first saved expense.
