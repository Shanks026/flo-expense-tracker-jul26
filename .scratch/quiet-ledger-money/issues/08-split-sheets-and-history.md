# 08: Split sheets and "Add from my transactions" on the kit

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** The split, entry, person and settle-up sheets move into the standard `Sheet`, and "Add from my transactions" moves onto the kit's chips, rows and pinned footer. Their behaviour is unchanged. Spec 48 §Splits (sheets, add from history).

- Each sheet: `Sheet` chrome with `PinnedFooter`, ledger `Chip` / `Segmented` for choices, ledger `AmountText`; logic untouched.
- Add from my transactions: `ScreenHeader`, date fields, filter `Chip`s, a select-all `ListRow`, rows with a check, and `PinnedFooter` naming what will happen ("Add 3 entries"). It still creates entries and never edits transactions.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Create a split, add and edit an entry (each split strategy the sheet offers), add a person, settle up: all as before
- [ ] Add from my transactions adds the selected entries and leaves the transactions unchanged
- [ ] Emulator check in light and dark. The test account has no splits: ask the person before creating one

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
