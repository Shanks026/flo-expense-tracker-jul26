# 04: Budget warnings go to the bell

Spec: .claude/features/38-home-insights-more.md

**What to build:** When a save pushes a budget past its warning or limit, the warning appears in the bell's alerts sheet instead of a toast. Saving stays quiet.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Saving an expense that crosses a budget threshold shows no toast
- [ ] The bell shows an unread alert for that budget, and it opens the budget
- [ ] Other alerts in the sheet are unchanged

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
