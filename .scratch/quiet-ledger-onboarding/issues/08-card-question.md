# 08: "Pick your card"

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The fourth set-up question: a live preview of the Home card (with the person's first account name) above a two-column grid of the card catalog, Day first, then any seasonal skins. Tapping a tile updates the preview.

- Next writes `profiles.equipped_card_theme` through Personalize's path (`normalizeEquippedId`, so Ink saves `ink-classic`). Skip leaves the default, which shows Day.
- With `FLAGS.themes` off, the step is left out and the counters read "N of 3".
- The footer note on this last question: "You can change these in Settings".
- `onboarding_step_viewed` sends `card`.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Picking Dusk and Next saves it; the first Home shows the Dusk card
- [ ] Picking Ink saves `ink-classic`
- [ ] Skip shows Day on Home
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
