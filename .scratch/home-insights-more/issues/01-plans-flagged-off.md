# 01: Plans flagged off

Spec: .claude/features/38-home-insights-more.md

**What to build:** Plans disappear from the app behind a new build-time flag `plans: false`:
- the Plans routes;
- the Menu entry;
- the Add sheet's plan control;
- the collecting-mode default.

Transactions linked to a plan render like any other, with no plan badge. No plan data is written or deleted.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No Plans entry, route, Add sheet control or plan badge anywhere in the app
- [ ] Saving from the Add sheet never attaches a plan (no collecting mode)
- [ ] Existing plans and their linked transactions are unchanged in Supabase (MCP)
- [ ] Flipping the flag back on restores Plans as they were

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
