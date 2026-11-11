# 04: Bill detail and payment history

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Tapping a bill (on Bills or Home) opens a read-only bill detail with the amount, cadence, next due date and a timeline of payments; Mark paid is pinned and Edit is in the header. Payments are linked to their bill from now on. Spec 48 §Bill detail, §Database (the `bill_id` part).

- **Migration** (apply only with the person's yes; record it in `00-index.md`): `transactions.bill_id` (uuid, references bills, on delete set null) and its partial index. Extend the `transactions` `WITH CHECK` so `bill_id` must be the user's own bill (read the current policy via the MCP first).
- Mark paid writes `bill_id` on the transaction it creates.
- A bill-detail read hook: the bill with its category, plus its linked payments newest first with account names; depends on `version`; a missing bill sends the screen back.
- The timeline is a pure builder in `lib/`: the open step (due / overdue / none when paused), up to 12 linked payments (each opening Transaction detail) then "Earlier payments are in Activity", a "Last paid" step when `last_paid_date` has no matching linked payment, "Added" last.
- Bills rows and Home's upcoming bill rows open the detail instead of the edit sheet.

**Blocked by:** 03

**Status:** resolved

- [x] The check script covers the timeline: never paid; linked payments newest first; the 12 cap; last_paid_date with and without a matching payment; paused (no open step); overdue open step
- [x] Migration applied with the person's yes; in a rolled-back transaction, another user's bill_id is rejected and setting bill_id alone doesn't stamp updated_at
- [x] Mark paid from the detail adds a timeline step and moves the due date at once; the payment opens Transaction detail
- [x] A bill paid before this ticket shows "Last paid"; a paused bill has no Mark paid
- [x] Home's upcoming bill rows open the detail
- [x] Emulator check in light and dark (delete test payments through the app)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-12: built and checked on Pixel_API_36 with the shared test account (light). Check script 365 cases (new groups: bill timeline, bill terms). Migration `quiet_ledger_money_bill_payment_link` applied on the person's go-ahead (they asked to run 03–05 without waiting for approval) and recorded in 00-index.md.
  - **Built:** `lib/billTimeline.js` (`billTimeline`), `billTerms` in `lib/billGroups.js`; `useBillDetail` (bill + linked payments with account names, 13 fetched so the cap knows there are more); `app/bill/[id].js` (sunk band: icon, display amount, "Monthly · Next due 7 Nov" in danger when overdue; "Payments" `Timeline`; pencil opens the bill sheet; `PinnedFooter` Mark paid, none when paused; dead-id guard). `markBillPaid` writes `bill_id`. Bills rows, Home's upcoming rows and bill alerts (Alerts sheet) open the detail. Kit: `Timeline` steps take `tone` ('danger') and `onPress` (a chevron).
  - **Decided while building:** the band shows the terms, not the status, so "Overdue since…" isn't said twice; "Last paid" has no sub line (it can mean paid before history or a deleted payment, so no claim either way).
  - **Checked:** Netflix (overdue: red band and first step) and Electricity (due today) details; Mark paid from the detail adds "Paid ₹1,200 · 12 Nov · Personal" and moves the due date at once; the payment opens Transaction detail; deleting it there leaves "Last paid 12 Nov"; Home's Netflix row and the Electricity alert open the detail. Test data restored (payment deleted in the app, Electricity's dates by SQL update).
  - **Not checked:** a paused bill's detail on screen (covered by the check script), the 12-payment cap on screen, dark mode of this screen. The bills-due pop-up still opens the pay sheet directly (Phase 5 restyles it).
