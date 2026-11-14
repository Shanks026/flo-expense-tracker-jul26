# 08: Cards (was Personalize)

Spec: .claude/features/archive/49-quiet-ledger-moments-and-the-rest.md

**What to build:** Personalize renamed Cards: a large live preview, Seasonal first, every design in a grid, and Equip pinned. Spec 49 §Cards.

- The same route, draft-then-Equip behaviour and `FLAGS.themes` redirect. "Cards" everywhere the name shows (title, the Settings row, and later the You row); find every place first.
- `ScreenHeader` + `LargeTitle` "Cards"; the drafted theme drawn by Home's card surface at full width (2:1) with the active account's name and masked last 4, a seasonal one playing its once-on-focus animation; sections of two-column swatches (2:1, radius 12, name under), the picked one with a 2 dp ink ring and a check; `PinnedFooter` Equip, disabled while the draft is the equipped card; the success toast.
- A pure rule, `cardSections(themes, { economy, ownedIds })`: Seasonal (seasonal tier only) then All cards, legacy left out, catalog order, Seasonal dropped when empty; everything choosable with economy off, the owned/locked rule only while it's on.
- The phone mock-up and its economy counters go.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The check script covers `cardSections`
- [x] Picking a design changes only the preview; Equip updates Home's card; Equip is disabled for the equipped card
- [x] The Christmas card animates in the preview
- [x] Emulator check in light and dark. Put the person's card back afterwards

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal
