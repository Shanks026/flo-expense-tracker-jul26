# 06: Kit gallery and ProgressBar

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** A Developer → Kit gallery screen that shows every ledger component in its states. This ticket also builds `ProgressBar`, which has no real screen using it until Budgets in Phase 4.

- `ProgressBar`: 4 dp, in accent on a sunk track. It turns warn past 80 % and danger from 100 % (amended 2026-11-10).
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

**Status:** resolved

- [x] The gallery opens from Settings → Developer in a dev build and isn't there in other builds
- [x] ProgressBar shows accent, warn and danger at the right thresholds
- [x] Everything reads correctly in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-10: built as `components/ledger/ProgressBar.js` (the spec table says `components/ProgressBar.js`; the old one stays for Budgets/Plans until Phase 4) with the rule in `lib/progressState.js` (9 cases + warn/danger-on-sunk contrast in `ledger-check.mjs`, 94 pass). Gallery is `app/dev/kit.js`, row in Settings → Developer. Checked on Pixel_API_36 in Light and Dark (Appearance put back to Light); TalkBack values read 40/85/120 %.
- Not checked: a release build (hidden there by `__DEV__` on the row and a Redirect on the route, same as the AI test set, but not run). 
- 2026-11-10: the person chose danger at exactly 100 % (a budget spent to its limit is red). Rule, checks, spec 46 and the redesign plan amended; the gallery shows a 100 % bar too.
