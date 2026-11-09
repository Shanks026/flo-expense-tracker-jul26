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

**Status:** ready-for-agent

- [ ] Adding an expense and an income by hand both work, and Undo right after saving removes the entry
- [ ] Quick add and voice still fill the sheet
- [ ] Editing an entry and an existing transfer opens the sheet pre-filled, and both save
- [ ] The Account row shows only with 2+ accounts, and the split row only with open splits
- [ ] Save stays reachable above the docked keyboard
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
