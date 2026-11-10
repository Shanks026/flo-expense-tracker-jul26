# 07: "Want a monthly spending limit?"

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The third set-up question: a large ₹ amount field (the Add sheet's amount input, caret pinned to the end) and the muted note "FLO can suggest one from your spending later".

- Next writes one overall budget on the active account (`calendar_month`, `category_id` null, name "Monthly limit") through ticket 01's budget mutation.
- Re-submitting after Back updates that budget, not a second one. Skip creates none.
- A salary-day month doesn't change the budget's own period.
- The planner's limit rule is pure and checked: ₹0, blank and garbage → none; the paise rule for the amount.
- `onboarding_step_viewed` sends `budget` (no amount).

**Blocked by:** 01, 04

**Status:** resolved

- [x] The check script covers the limit rule: ₹0, blank, garbage, ₹5000, ₹1,234.50
- [x] ₹5000 and Next creates one budget on the active account (DB); Back, change to ₹6000, Next updates it (still one)
- [x] Skip creates no budget
- [x] The budget shows in Budgets after onboarding
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: The rule and planner are in `lib/setupPlan.js` (`cleanLimitAmount`, `planLimit`, `findLimitBudget`, `LIMIT_BUDGET_NAME`), with 28 new `limit` cases in `scripts/ledger-check.mjs` (209 in total). The screen is `app/onboarding/budget.js`, registered after accounts in `lib/onboarding.js`. The limit is ₹1 up to what `numeric(12,2)` holds, rounded to paise.
- Next waits until the budgets have loaded. The draft keeps the row Next saved (`budgetSaved`), so a resubmit updates it and moves it if question 1 changed the active account. The free budget cap shows a toast here, not the upsell sheet.
- Emulator, Pixel_API_36:
  - On the ticket 04 skip account, HDFC then ₹5000 and Next created one "Monthly limit" on HDFC (calendar_month, no category).
  - Back to question 1 and forward again kept 5000 in the field.
  - In dark, a force-stop and relaunch showed 5000 again. Changing it to 6000 and pressing Next updated the same row (same id, one budget).
  - After the first expense and the reminder, Budgets showed "Monthly limit, November 2026, ₹6,000 left".
  - In light, on the ticket 04 account (its `onboarded_at` was reset for this), Skip with ₹750 typed created no budget.
  - After the review fixes, ₹700 and Next created one limit on SBI.
- Not checked:
  - Back from the first expense, because budget replaces into it until 08 exists. A relaunch stood in for Back.
  - Moving the saved limit when question 1 changes the active account, which can't be reached from the UI until a question follows budget. It's covered by the check script only.
  - The free-plan cap toast, because billing is off.
  - The `budget` step event, because consent is off for new accounts.
- Seen, not caused here: the first-expense step opened the Add sheet when Not now was tapped once (ticket 09 rebuilds that step).
