# 10: Plans restyle (flag stays off)

Spec: .claude/features/archive/48-quiet-ledger-money-screens.md

**What to build:** Plans' list, detail and add-from-history screens and the plan sheet move onto the kit with the Budgets and Splits patterns, so turning `FLAGS.plans` back on later doesn't look out of place. The flag stays **off**. Spec 48 §Plans.

- Rows with `ProgressBar`, a sunk detail band, `PinnedFooter`, `Sheet`; behaviour unchanged.
- Droppable: if the phase runs short, this ticket moves to Phase 5.

**Blocked by:** 02, 07

**Status:** resolved

- [x] With the flag flipped on locally (never committed flipped), the list, detail, add-from-history and sheet work as before on the kit
- [x] With the flag off, no plan surface appears anywhere
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments
- 2026-11-13 (resolved): Plans list, detail, add-from-history and the plan sheet on the kit (rows with `ProgressBar`, a sunk band, `PinnedFooter`, `Sheet`). The flag stayed off in every commit; checked with it flipped on locally: empty list, create a plan with a target, detail band and Collecting row, add-from-history, delete; then flipped back. The donut is gone from the detail ("Where it went" is rows). Not checked on device: the flag-off redirects (unchanged code).
