# 10: Plans restyle (flag stays off)

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Plans' list, detail and add-from-history screens and the plan sheet move onto the kit with the Budgets and Splits patterns, so turning `FLAGS.plans` back on later doesn't look out of place. The flag stays **off**. Spec 48 §Plans.

- Rows with `ProgressBar`, a sunk detail band, `PinnedFooter`, `Sheet`; behaviour unchanged.
- Droppable: if the phase runs short, this ticket moves to Phase 5.

**Blocked by:** 02, 07

**Status:** ready-for-agent

- [ ] With the flag flipped on locally (never committed flipped), the list, detail, add-from-history and sheet work as before on the kit
- [ ] With the flag off, no plan surface appears anywhere
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
