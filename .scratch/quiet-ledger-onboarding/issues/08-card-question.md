# 08: "Pick your card"

Spec: .claude/features/archive/47-quiet-ledger-onboarding.md

**What to build:** The fourth set-up question: a live preview of the Home card (with the person's first account name) above a two-column grid of the card catalog, Day first, then any seasonal skins. Tapping a tile updates the preview.

- Next writes `profiles.equipped_card_theme` through Personalize's path (`normalizeEquippedId`, so Ink saves `ink-classic`). Skip leaves the default, which shows Day.
- With `FLAGS.themes` off, the step is left out and the counters read "N of 3".
- The footer note on this last question: "You can change these in Settings".
- `onboarding_step_viewed` sends `card`.

**Blocked by:** 04

**Status:** resolved

- [x] Picking Dusk and Next saves it; the first Home shows the Dusk card
- [x] Picking Ink saves `ink-classic`
- [x] Skip shows Day on Home
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: The grid order is `cardChoices` in `lib/setupPlan.js` (Day, then seasonal, then catalog order, never the legacy `ink`), with 7 new `card` cases in `scripts/ledger-check.mjs` (216 in total). The screen is `app/onboarding/card.js`. Its preview is Home's `AccountCardCarousel` with the active account (the first pick), and it saves through `equipTheme`, as Personalize does.
- `SetupQuestion` gained `pinned`, so the preview stays above the scrolling grid. It now also shows "You can change these in Settings" on whichever question is last, so with themes off the limit question carries it. The card step is in `STEPS` only with `FLAGS.themes` on.
- Emulator, Pixel_API_36:
  - In light, on the ticket 04 account, the question showed SBI on Day, with the grid as Day, Christmas, Ink, Lime Flood…
  - Back to the limit and Next again kept ₹700 and wrote no second budget. This also closes ticket 07's Back check.
  - Picking Dusk turned the preview purple, and Next saved `dusk`. The first Home showed SBI on Dusk.
  - In dark, on the skip account, Ink saved `ink-classic`.
  - In light, with the card reset to the default `ink`, Skip left `ink`, and Home showed HDFC on Day.
  - The Settings note shows on the card question and not on the limit.
- Not checked:
  - `FLAGS.themes` off on the emulator (the "N of 3" count is in the check script).
  - The `card` step event, because consent is off.
- Seen, not changed:
  - In dark, the Ink preview is near-black on the near-black canvas. Home draws the chosen Ink the same way.
  - Skip after an earlier Next keeps the saved card rather than resetting it.
