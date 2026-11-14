# 10: First Home coach mark and the full-flow check

Spec: .claude/features/archive/47-quiet-ledger-onboarding.md

**What to build:** The first Home shows only the + coach mark (the existing `CoachMark` on the tab bar, restyled on the kit); no streak-chip mark. Then the whole Phase 3 flow is checked end to end on fresh accounts, fixing whatever the earlier tickets left uneven between steps (spacing, transitions, the counter).

- Order: opener → sign up → accounts → month start → limit → card → first expense → reminders → Home.
- Old onboarding components that nothing uses any more are noted for the Manrope cleanup ticket (not deleted here).

**Blocked by:** 02, 03, 04, 05, 06, 07, 08, 09

**Status:** resolved

- [x] Every question answered on a fresh account: Home shows the accounts, the salary-day line, the card; Budgets shows the limit; the DB matches
- [x] Every question skipped on another fresh account: one Personal account, monthly, no budget, Day card
- [x] Force-stop mid-flow and reopen: the gate resumes on the first step and saved answers are kept
- [x] The + coach mark shows once on the first Home; no streak mark
- [x] `onboarding_step_viewed` rows arrive for each step with consent on
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: built and checked on Pixel_API_36. `CoachMark` is on the kit (scrim, a round accent ring, a surface bubble with row-title text); the + mark was already the only one wired, so there's no streak-chip mark to remove.
  - Account A (`FLO_ONB10A_*`, light, consent on): opener, then Create account, then SBI + Cash, salary day 25, a ₹20,000 limit, the Blueprint card, a ₹120 first expense, then Allow notifications (9 pm). Home shows SBI on Blueprint, two page dots, and "₹120 out since 25 Oct"; Budgets shows Monthly limit ₹20,000. The DB matches: SBI and Cash (no Personal left), `salary_day`/25, `blueprint`, one calendar-month budget, the expense, and reminders on at 21:00.
  - Force-stopped twice mid-flow (after sign-up, and on the limit question): reopening lands on question 1 with Cash and SBI still picked, and the month question shows the saved 25th.
  - `onboarding_step_viewed` arrived for accounts, month_start, budget, card, first_expense and reminder_ask. The first three have two rows each because of the resume. Opener and auth aren't counted, since consent can only be on after sign-in.
  - Account B (`FLO_ONB10B_*`, dark): every question skipped, the sheet closed, then Maybe later. Home shows Personal on Day with "this month". The DB has one Personal account, `monthly`, no budget, no transactions, reminders off, and the card column still on its `ink` default (shown as Day).
  - The + mark showed once on each first Home, after the streak celebration, and not again after a relaunch.
- Not changed, noted for later:
  - The streak celebration (Manrope, its own dark look) still shows before the mark on a first Home where an expense was saved; it's outside spec 47.
  - In dark mode the scrim greys the light + button under the ring.
  - The emulator's network dropped once mid-run ("Network request failed" on sign-up); a retry worked.
- For the Manrope cleanup (no ticket yet): `components/OnboardingScreen.js` is imported by nothing. `OnboardingArrowMotif` and `OnboardingReveal` are still used (ArrowMark, the onboarding layout, RewardBurst, CountUp).
