# 09: The Add sheet on the new kit

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** The Add sheet is reordered and restyled on a shared `Sheet` shell. Every entry point and feature stays the same.

- New `PinnedFooter`: a full-width primary plus an optional secondary, with the safe-area inset, and it rises with the keyboard.
- New `Sheet`: the visual shell inside the existing provider/opener pattern. It has one handle, a title row with a circle X, a scrollable body and a PinnedFooter, with a soft shadow in light mode and a hairline top edge in dark mode.
- **Field order:**
  1. the quick-add line with its mic;
  2. Segmented Expense | Income;
  3. a centred display amount with a caret and a muted ₹;
  4. circle category chips (the selected one is an ink circle with a white icon);
  5. Today / Yesterday / Pick a date;
  6. Note;
  7. Account (only with 2+ accounts);
  8. the split row (only with open splits);
  9. Save, pinned at the bottom.
- The save toast fades in place (no slide), so a fast Undo tap lands.
- **Unchanged:**
  - save, undo and edit;
  - transfer edit and the split link;
  - Pro gates;
  - every pre-fill (Ask FLO, share, auto-detect, first expense).

**Blocked by:** 01, 05

**Status:** resolved

- [x] Adding an expense and an income by hand both work, and Undo right after saving removes the entry
- [x] Quick add and voice still fill the sheet (typed quick add checked; long-press listening checked in ticket 08; a spoken entry not run)
- [x] Editing an entry and an existing transfer opens the sheet pre-filled, and both save
- [x] The Account row shows only with 2+ accounts, and the split row only with open splits (Account row seen with 4 accounts; the test account has no open splits, so the split row is code-only)
- [x] Save stays reachable above the docked keyboard
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-10: New kit pieces: `Sheet` (handle, title row with circle X, scroll body, PinnedFooter; light shadow, dark hairline), `PinnedFooter`, `Chip`, and `hooks/useKeyboardVisible`. The Sheet passes `keyboardUp` to the footer because the library remounts the footer render on each change. The field order already matched; the rest is a restyle on the kit. Logic above the render (save, undo, edit, transfer, split, Pro gates, every pre-fill) is unchanged. `source` on insert stays with ticket 07.
- The toast fades in place with no slide; Undo removed a fresh entry (checked in the database). On this connection a save takes about 2 s, so the toast appears then.
- Checked on Pixel_API_36: manual expense and income, Undo, quick add ("40 lunch yesterday"), editing an entry (category change) and an existing transfer (saved), Delete from the sheet, Save above the numeric and text keyboards, light and dark. Test entries were deleted through the sheet. Not run: a spoken entry, share-to-FLO, auto-detect, the onboarding first expense, the split row (no open splits), the Pro upsell, TalkBack.
- Open for the person: Home's Add tile opens the sheet without the quick-add line (only the tab bar + asks for it, per ticket 08). Story 62 may want it there too.
- Two-agent review done; the footer remount, a missing gap above the split row, and the Note label were fixed.
