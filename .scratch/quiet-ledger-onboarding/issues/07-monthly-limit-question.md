# 07: "Want a monthly spending limit?"

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The third set-up question: a large ₹ amount field (the Add sheet's amount input, caret pinned to the end) and the muted note "FLO can suggest one from your spending later".

- Next writes one overall budget on the active account (`calendar_month`, `category_id` null, name "Monthly limit") through ticket 01's budget mutation.
- Re-submitting after Back updates that budget, not a second one. Skip creates none.
- A salary-day month doesn't change the budget's own period.
- The planner's limit rule is pure and checked: ₹0, blank and garbage → none; the paise rule for the amount.
- `onboarding_step_viewed` sends `budget` (no amount).

**Blocked by:** 01, 04

**Status:** ready-for-agent

- [ ] The check script covers the limit rule: ₹0, blank, garbage, ₹5000, ₹1,234.50
- [ ] ₹5000 and Next creates one budget on the active account (DB); Back, change to ₹6000, Next updates it (still one)
- [ ] Skip creates no budget
- [ ] The budget shows in Budgets after onboarding
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
