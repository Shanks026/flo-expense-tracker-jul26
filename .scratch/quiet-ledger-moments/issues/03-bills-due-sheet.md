# 03: The bills-due sheet

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The once-a-day bills-due reminder as a bottom sheet instead of a centred modal card. Spec 49 §The bills-due sheet.

- A pure rule, `dueBillsMoment(bills, today)` → `{ title, bills }` or null: active bills due on or before today, overdue first then due today, each by date then name; "1 bill needs you" / "N bills need you". It lives beside the bill grouping rule and uses its overdue test and ticket 02's due wording.
- The trigger is unchanged (moment queue, actionable priority, expiring at the end of the day; `skipped` when nothing is due by the time it shows). Confirm first that the moment host is still inside the bottom-sheet provider.
- The ledger `Sheet` with the rule's title; a `ListRow` per bill (resolved bill icon, danger tint when overdue; the name; the due wording; the amount). Tapping a row finishes the moment and opens bill detail.
- Footer: one bill → Mark paid (primary) + Later (secondary); several → a compact quiet Mark paid on each row and Later alone. Mark paid finishes the moment, then opens the pay sheet. Any dismissal finishes the moment.

**Blocked by:** 02 (the shared due wording)

**Status:** resolved

- [x] The check script covers `dueBillsMoment`: nothing due null, one bill, overdue + due today ordering, paused left out, name tie-break
- [x] The sheet shows for a test bill due today; Mark paid opens the pay sheet; Later and swipe-down dismiss without paying; a row opens bill detail
- [x] With two bills due, each row has Mark paid and the footer is Later alone
- [x] Emulator check in light and dark. Create and delete the test bills through the app

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-14 (resolved): `dueBillsMoment(bills, today)` in the bill grouping module (6 checks, 476 passing); the source enqueues on it too, so the trigger and the sheet share one rule. The moment is now a ledger `Sheet`: "N bills need you", a `ListRow` per bill with its resolved icon (danger tint when overdue), `dueWording`'s line and the amount. One bill: Mark paid + Later. Several: each row's Mark paid is the round green check the Bills list uses (the person's call, 2026-11-12), pulled out into a shared `BillPaidButton`, and the footer is Later alone. A chosen action (pay, open the bill) runs after the sheet has closed; any close finishes the moment; if the last bill disappears while it's up, it closes itself.
- Checked on Pixel_API_36 through a Developer-only Kit preview that renders the real moment over the account's live bills (today's moment had already shown, so the queue wouldn't bring it back): two-bill layout in light and dark; a row's check opens the pay sheet (closed without paying); a row opens bill detail; Later, back and swipe-down close it. One-bill layout: Electricity paused through its edit sheet, checked (Mark paid opens the pay sheet), then turned back on. Saving it had also stored a "utilities" icon from the name; that was set back to null by SQL so it shows the receipt as before. During that, a mis-tap typed into the name field; it was corrected before saving (name unchanged in the DB). Not seen on device: the real queue presenting it via the moment host (confirmed in code that the host is inside the bottom-sheet provider).

