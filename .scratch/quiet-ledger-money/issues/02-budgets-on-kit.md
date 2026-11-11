# 02: Budgets list, detail and sheet on the kit

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Budgets as flat rows with a thin progress bar and "₹X left", a detail that leads with "₹2,104.50 of ₹2,000", and the budget sheet in the standard `Sheet`. Spec 48 §Budgets.

- List status (ok / warn / over / ended, caption, right text and tone) is a pure rule in `lib/` built on the shared progress rule (warn past 80 %, over at 100 %); "Ended" wins for a past custom budget.
- List: `ScreenHeader` + large title, `ListRow`s (category circle, or a wallet in a grey circle for overall), `PinnedFooter` New budget with the free gate unchanged, ledger `EmptyState` (`coins`).
- Detail: sunk band (display "of", `ProgressBar`, left/over line with days left), pace `Callout`, the period's entries date-grouped with `TransactionRow` opening Transaction detail, compact Add expense when empty, edit in the header, dead-id guard kept.
- Sheet: on `Sheet`, period as `Segmented`; every field and the gate unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The check script covers list status: under 80 %, past 80 %, exactly 100 % (over), past 100 %, an ended custom budget; right text and tone for each
- [ ] List rows, captions and bars match the rule; New budget respects the free gate (with billing off it passes)
- [ ] Detail shows the band, pace callout and date-grouped entries; an entry opens Transaction detail
- [ ] Create, edit and delete a budget through the sheet; deleting from detail lands back on the list
- [ ] Emulator check in light and dark (delete any test budget through the app)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
