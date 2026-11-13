# 08: Split sheets and "Add from my transactions" on the kit

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** The split, entry, person and settle-up sheets move into the standard `Sheet`, and "Add from my transactions" moves onto the kit's chips, rows and pinned footer. Their behaviour is unchanged. Spec 48 §Splits (sheets, add from history).

- Each sheet: `Sheet` chrome with `PinnedFooter`, ledger `Chip` / `Segmented` for choices, ledger `AmountText`; logic untouched.
- Add from my transactions: `ScreenHeader`, date fields, filter `Chip`s, a select-all `ListRow`, rows with a check, and `PinnedFooter` naming what will happen ("Add 3 entries"). It still creates entries and never edits transactions.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Create a split, add and edit an entry (each split strategy the sheet offers), add a person, settle up: all as before
- [x] Add from my transactions adds the selected entries and leaves the transactions unchanged
- [x] Emulator check in light and dark. The test account has no splits: ask the person before creating one

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments
- 2026-11-13 (resolved): the split, entry, person and settle-up sheets on `Sheet` (pinned primary, ledger fields, `IconPicker` for split icons, `Segmented` for the strategy, `ListRow` switches), `SplitMemberChip` restyled once for all of them, and "Add from my transactions" on the kit (date fields, category `Chip`s, select-all row, check rows, a pinned footer naming the count and total). Checked: create a split, add a person (stacked over New split), add an entry (Equally; Exact amounts shown and adds up, not saved), settle up, add from transactions (the transaction's row unchanged in the DB). Not checked: editing an existing entry. Found and fixed on device: after a sheet closed with the keyboard up, the next open was swallowed. `Sheet` now drops the keyboard before closing, cancels a pending close on present(), and presents once more if the sheet hasn't opened after 500 ms.
