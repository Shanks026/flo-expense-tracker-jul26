# 04: Bill detail and payment history

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Tapping a bill (on Bills or Home) opens a read-only bill detail with the amount, cadence, next due date and a timeline of payments; Mark paid is pinned and Edit is in the header. Payments are linked to their bill from now on. Spec 48 §Bill detail, §Database (the `bill_id` part).

- **Migration** (apply only with the person's yes; record it in `00-index.md`): `transactions.bill_id` (uuid, references bills, on delete set null) and its partial index. Extend the `transactions` `WITH CHECK` so `bill_id` must be the user's own bill (read the current policy via the MCP first).
- Mark paid writes `bill_id` on the transaction it creates.
- A bill-detail read hook: the bill with its category, plus its linked payments newest first with account names; depends on `version`; a missing bill sends the screen back.
- The timeline is a pure builder in `lib/`: the open step (due / overdue / none when paused), up to 12 linked payments (each opening Transaction detail) then "Earlier payments are in Activity", a "Last paid" step when `last_paid_date` has no matching linked payment, "Added" last.
- Bills rows and Home's upcoming bill rows open the detail instead of the edit sheet.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The check script covers the timeline: never paid; linked payments newest first; the 12 cap; last_paid_date with and without a matching payment; paused (no open step); overdue open step
- [ ] Migration applied with the person's yes; in a rolled-back transaction, another user's bill_id is rejected and setting bill_id alone doesn't stamp updated_at
- [ ] Mark paid from the detail adds a timeline step and moves the due date at once; the payment opens Transaction detail
- [ ] A bill paid before this ticket shows "Last paid"; a paused bill has no Mark paid
- [ ] Home's upcoming bill rows open the detail
- [ ] Emulator check in light and dark (delete test payments through the app)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
