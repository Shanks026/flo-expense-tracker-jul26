# 02: Budgets list, detail and sheet on the kit

Spec: .claude/features/archive/48-quiet-ledger-money-screens.md

**What to build:** Budgets as flat rows with a thin progress bar and "₹X left", a detail that leads with "₹2,104.50 of ₹2,000", and the budget sheet in the standard `Sheet`. Spec 48 §Budgets.

- List status (ok / warn / over / ended, caption, right text and tone) is a pure rule in `lib/` built on the shared progress rule (warn past 80 %, over at 100 %); "Ended" wins for a past custom budget.
- List: `ScreenHeader` + large title, `ListRow`s (category circle, or a wallet in a grey circle for overall), `PinnedFooter` New budget with the free gate unchanged, ledger `EmptyState` (`coins`).
- Detail: sunk band (display "of", `ProgressBar`, left/over line with days left), pace `Callout`, the period's entries date-grouped with `TransactionRow` opening Transaction detail, compact Add expense when empty, edit in the header, dead-id guard kept.
- Sheet: on `Sheet`, period as `Segmented`; every field and the gate unchanged.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The check script covers list status: under 80 %, past 80 %, exactly 100 % (over), past 100 %, an ended custom budget; right text and tone for each
- [x] List rows, captions and bars match the rule; New budget respects the free gate (with billing off it passes)
- [x] Detail shows the band, pace callout and date-grouped entries; an entry opens Transaction detail
- [x] Create, edit and delete a budget through the sheet; deleting from detail lands back on the list
- [x] Emulator check in light and dark (delete any test budget through the app)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-12: built and checked on Pixel_API_36 with the shared test account (light and dark; Appearance back to Light). Check script 340 cases (new group: budget row).
  - **Built:** `lib/budgetRow.js` (`budgetRowStatus`, on the shared progress rule); the list on `ScreenHeader` + `LargeTitle`, flat `ListRow`s with a `ProgressBar`, the money right and a coloured caption, `PinnedFooter` New budget (gate unchanged); the detail with a sunk band ("₹2,134.50 of ₹2,000", bar, "Over budget by" / "Left to spend", days left), a pace `Callout` (warn over pace, info otherwise), date-grouped `TransactionRow`s opening Transaction detail, and Add expense (budget's category and account) when empty; the sheet on `Sheet` with a centred limit, `Segmented` period (crown on Custom when locked), Start/End rows for Custom, a row of category circles with Overall first, Save pinned, Delete as a danger button. `deleteBudget` moved into `lib/budgets.js`; `useBudgetDetail` selects the category colour.
  - **Decided while building:** over the limit the row shows "₹104.50 over" in red with no caption (the amount says it); exactly at the limit "₹0 left" in red with "Used up"; "Almost out" amber past 80 %; "Ended" muted for a past custom budget. The band's bar track is canvas (sunk on sunk vanished). The limit keypad is decimal (limits can carry paise).
  - **Checked:** list, detail (over budget and a fresh empty one), an entry opening Transaction detail, the edit sheet, Custom showing its date rows, create (Week, Bills, ₹500) and delete twice (the second time through `deleteBudget`), landing back on the list; the DB has the original three budgets.
  - **Not checked / deviations:** the date pickers weren't driven; an "Ended" custom budget and "Almost out" weren't seen live (covered by the check script); the header has no period sub line (`ScreenHeader` has none; the period is in the band); Delete has no confirm (as before). Review: two agents; fixed the over amount staying ink, the colourless category circle vanishing on the band, the 100 % footer tone, and the delete write in the component. Left as judgement calls: tone-to-colour maps in two screens, the category circle row copied from the Add sheet (a shared picker would serve both and ticket 05's IconPicker).
