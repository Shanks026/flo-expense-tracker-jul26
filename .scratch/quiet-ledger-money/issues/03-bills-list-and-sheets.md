# 03: Bills list and the bill sheets on the kit

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Bills grouped under Overdue, This week, Later and Paused, each a flat row with a small quiet Mark paid, and the pay and bill sheets in the standard `Sheet`. Spec 48 §Bills.

- Grouping is a pure rule in `lib/`: paused (never overdue), overdue (before today), this week (today to today + 6), later; sorted by due date then name.
- Row: `ListRow` with the bill's icon in a circle tinted by its category (danger tint when overdue; the icon for now is the category's, then a receipt), name, "Monthly · Due 12 Nov" / "Overdue since 9 Nov" / "Paused", amount, compact quiet Mark paid on active bills.
- Tapping a row still opens the edit sheet until ticket 04 adds bill detail.
- `PinnedFooter` New bill; ledger `EmptyState` (`calendar`).
- Pay sheet and bill sheet on `Sheet`; amount, date, account, Skip this cycle, every bill field, the currency rule and delete unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The check script covers grouping: overdue yesterday, due today, due in 6 days, due in 7 days (Later), paused with a past date (Paused), sort order
- [ ] The list shows the groups, captions and danger styling as specced; empty groups are hidden
- [ ] Mark paid from a row records the payment and moves the due date, as before; Skip this cycle still works
- [ ] Create, edit, pause and delete a bill through the sheet
- [ ] Emulator check in light and dark (the test account's Electricity bill is due 2026-11-12 unpaid; put it back if a check pays it)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
