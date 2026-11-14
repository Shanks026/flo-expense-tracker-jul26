# 01: Plans flagged off

Spec: .claude/features/archive/38-home-insights-more.md

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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built in `1fbd606`.
- `FLAGS.plans = false` in `lib/flags.js`.
- `/plans`, `/plan/[id]` and `/plan/[id]/history` redirect to Home, using the same wrapper pattern as the Shop.
- Hidden: the Menu entry, plan alerts in the bell, plan pills on Home and Transactions rows, the Analytics Plans segment, the Report Plans section, and the split sheet's plan link.
- The Add sheet already had no plan control or collecting default (spec 36). Nothing writes or deletes plan data.
- Open (emulator checks paused): no Plans anywhere on device, and flipping the flag back on restores Plans. The plan-data check is moot after the 2026-10-26 fresh-start wipe.
