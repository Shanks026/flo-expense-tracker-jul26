# 04: Budget warnings go to the bell

Spec: .claude/features/archive/38-home-insights-more.md

**What to build:** When a save pushes a budget past its warning or limit, the warning appears in the bell's alerts sheet instead of a toast. Saving stays quiet.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Saving an expense that crosses a budget threshold shows no toast
- [ ] The bell shows an unread alert for that budget, and it opens the budget
- [ ] Other alerts in the sheet are unchanged

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built in `1fbd606`. Most of this was already true:
- spec 36's quiet save stopped the budget toast;
- `useAlerts` already lists warn and over budgets in the bell.

The one change: a budget alert now opens that budget (`/budget/<id>`) instead of the Budgets list.

Open (emulator checks paused): a threshold-crossing save shows no toast, and the bell's alert opens the budget.
