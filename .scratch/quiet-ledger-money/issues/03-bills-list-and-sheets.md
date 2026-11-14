# 03: Bills list and the bill sheets on the kit

Spec: .claude/features/archive/48-quiet-ledger-money-screens.md

**What to build:** Bills grouped under Overdue, This week, Later and Paused, each a flat row with a small quiet Mark paid, and the pay and bill sheets in the standard `Sheet`. Spec 48 §Bills.

- Grouping is a pure rule in `lib/`: paused (never overdue), overdue (before today), this week (today to today + 6), later; sorted by due date then name.
- Row: `ListRow` with the bill's icon in a circle tinted by its category (danger tint when overdue; the icon for now is the category's, then a receipt), name, "Monthly · Due 12 Nov" / "Overdue since 9 Nov" / "Paused", amount, compact quiet Mark paid on active bills.
- Tapping a row still opens the edit sheet until ticket 04 adds bill detail.
- `PinnedFooter` New bill; ledger `EmptyState` (`calendar`).
- Pay sheet and bill sheet on `Sheet`; amount, date, account, Skip this cycle, every bill field, the currency rule and delete unchanged.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The check script covers grouping: overdue yesterday, due today, due in 6 days, due in 7 days (Later), paused with a past date (Paused), sort order
- [x] The list shows the groups, captions and danger styling as specced; empty groups are hidden
- [x] Mark paid from a row records the payment and moves the due date, as before; Skip this cycle still works
- [x] Create, edit, pause and delete a bill through the sheet
- [x] Emulator check in light and dark (the test account's Electricity bill is due 2026-11-12 unpaid; put it back if a check pays it)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-12: built and checked on Pixel_API_36 with the shared test account (light and dark; back to Light). Check script 352 cases (new group: bills).
  - **Built:** `lib/billGroups.js` (`groupBills`, `billLine`); the list on `ScreenHeader` + `LargeTitle` with Overdue (danger title), This week, Later, Paused (muted title) groups, flat rows (category circle, danger wash when overdue; "Monthly · Due 12 Nov" / "Due today" / "Overdue since 7 Nov" in danger / "Monthly · Paused"), the amount, and for active bills a round check on a soft green wash that opens the pay sheet (the person's ask, 2026-11-12, replacing a "Mark paid" text button); `PinnedFooter` New bill; ledger `EmptyState` (`calendar`). The bill sheet on `Sheet`: capsule Name field, centred amount, `Segmented` Repeats, Next due and Active rows, category circles with None (a minus) first, Delete danger, Save pinned. The pay sheet on `Sheet`: centred amount, Paid on and Pay from rows (account chips), footer Mark as paid + Skip this cycle. Kit: `ListRow` `subColor`, `SectionHeader` `titleColor`.
  - **Checked:** grouping and lines on the real bills; Mark as paid (Electricity moved to 12 Dec, budget toast fired); Skip this cycle (Netflix moved a month, nothing logged); create a paused bill (Paused group, no check), validation ("Enter an amount"), delete; Pay from chips; dark list and sheets. Test data put back: the payment deleted through Transaction detail, Electricity and Netflix dates restored by SQL update.
  - **Not checked / notes:** the date pickers weren't driven; the quiet `Button` still has its underline (spec 46 meant to drop it; left for a kit decision since Ask FLO's Dismiss uses it). Rows still open the edit sheet; ticket 04 moves them to bill detail. Review: combined with tickets 04 and 05.
