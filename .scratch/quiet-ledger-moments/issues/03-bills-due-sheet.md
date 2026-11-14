# 03: The bills-due sheet

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The once-a-day bills-due reminder as a bottom sheet instead of a centred modal card. Spec 49 §The bills-due sheet.

- A pure rule, `dueBillsMoment(bills, today)` → `{ title, bills }` or null: active bills due on or before today, overdue first then due today, each by date then name; "1 bill needs you" / "N bills need you". It lives beside the bill grouping rule and uses its overdue test and ticket 02's due wording.
- The trigger is unchanged (moment queue, actionable priority, expiring at the end of the day; `skipped` when nothing is due by the time it shows). Confirm first that the moment host is still inside the bottom-sheet provider.
- The ledger `Sheet` with the rule's title; a `ListRow` per bill (resolved bill icon, danger tint when overdue; the name; the due wording; the amount). Tapping a row finishes the moment and opens bill detail.
- Footer: one bill → Mark paid (primary) + Later (secondary); several → a compact quiet Mark paid on each row and Later alone. Mark paid finishes the moment, then opens the pay sheet. Any dismissal finishes the moment.

**Blocked by:** 02 (the shared due wording)

**Status:** ready-for-agent

- [ ] The check script covers `dueBillsMoment`: nothing due null, one bill, overdue + due today ordering, paused left out, name tie-break
- [ ] The sheet shows for a test bill due today; Mark paid opens the pay sheet; Later and swipe-down dismiss without paying; a row opens bill detail
- [ ] With two bills due, each row has Mark paid and the footer is Later alone
- [ ] Emulator check in light and dark. Create and delete the test bills through the app

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
