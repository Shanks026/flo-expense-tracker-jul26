# 06: "When does your month start?"

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The second set-up question: a `Segmented` "1st of the month" | "My salary day". Salary day reveals a day-of-month picker (1–31). Next writes `reset_period = 'monthly'`, or `salary_day` with the day, through the profile update Settings uses. Next is disabled until a salary day is picked. Skip leaves monthly. `onboarding_step_viewed` sends `month_start`.

The planner's month-start rule (answer → profile patch, no day → invalid) is pure and checked.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] The check script covers the month-start patch: 1st, salary day 25, no day
- [ ] Choosing salary day 25 and Next saves it (DB), and Home's line shows the salary-day month after onboarding
- [ ] Back from question 3 shows the saved choice
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
