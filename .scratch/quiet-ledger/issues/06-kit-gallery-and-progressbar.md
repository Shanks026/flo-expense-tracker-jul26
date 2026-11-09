# 06: Kit gallery and ProgressBar

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** A Developer → Kit gallery screen that shows every ledger component in its states. This ticket also builds `ProgressBar`, which has no real screen using it until Budgets in Phase 4.

- `ProgressBar`: 4 dp, in accent on a sunk track. It turns warn past 80 % and danger past 100 %.
- The gallery shows:
  - Button variants and ListRow variants;
  - SectionHeader;
  - AmountText sizes and signs;
  - Segmented and the Callout tones;
  - ProgressBar at 40 %, 85 % and 120 %;
  - the Illustration objects and EmptyState.
- Later tickets add their components to the gallery.
- Dev builds only.

**Blocked by:** 02, 05

**Status:** ready-for-agent

- [ ] The gallery opens from Settings → Developer in a dev build and isn't there in other builds
- [ ] ProgressBar shows accent, warn and danger at the right thresholds
- [ ] Everything reads correctly in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
