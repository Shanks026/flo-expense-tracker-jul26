# 06: "When does your month start?"

Spec: .claude/features/archive/47-quiet-ledger-onboarding.md

**What to build:** The second set-up question: a `Segmented` "1st of the month" | "My salary day". Salary day reveals a day-of-month picker (1–31). Next writes `reset_period = 'monthly'`, or `salary_day` with the day, through the profile update Settings uses. Next is disabled until a salary day is picked. Skip leaves monthly. `onboarding_step_viewed` sends `month_start`.

The planner's month-start rule (answer → profile patch, no day → invalid) is pure and checked.

**Blocked by:** 04, 05

**Status:** resolved

- [x] The check script covers the month-start patch: 1st, salary day 25, no day
- [x] Choosing salary day 25 and Next saves it (DB), and Home's line shows the salary-day month after onboarding
- [x] Back from question 3 shows the saved choice
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: built and checked on Pixel_API_36 by running onboarding again on `FLO_ONB04_*` (`onboarded_at` set to null): "2 of 4" with Back; My salary day reveals the 1–31 grid (`components/ledger/DayOfMonthPicker`); Next stays disabled until a day is picked; 25 + Next saved `salary_day`/25 (DB); Back from question 3 showed it; dark mode checked; after finishing, Home read "since 25 Oct"; no duplicate budget or account. The rule is `planMonthStart`/`monthStartFromProfile` in `lib/setupPlan.js` (12 cases, 262 in all). Not checked: the `onboarding_step_viewed` row (consent is off on this account), and Skip on this question (SetupQuestion's Skip writes nothing, so it leaves whatever was saved). The account was put back to Monthly with `reset_month_day` null. Review (two agents): no hard violations or spec gaps; tidied an import, the screen's styles and the default answer. Left as found, matching the other questions: Skip after an earlier Next keeps the saved salary day (Skip writes nothing), and Back shows the draft's last pick even if it was skipped rather than saved.
