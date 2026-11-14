# 11: Bill proposals

Spec: .claude/features/archive/44-ai-assistant.md (Phase 4)

**What to build:** "Remind me about rent, 15,000, on the 1st every month" gives a bill proposal card. Review opens the Add Bill sheet filled in as a **new** bill, with the name, amount, cadence, next due date and category. Save creates it. Editing an existing bill is unchanged.

**Blocked by:** 09

**Status:** done (phone check pending)

- [x] Review opens a new, fully filled bill; Save creates one row
- [x] The cadence and due date match what the sheet itself would write
- [x] Editing an existing bill works as before
- [ ] Phone check

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

2026-11-09, emulator (Pixel_API_36), function deployed:
- **`propose_bill`** checks the name (1 to 60 characters), the amount (within ₹1 crore), the cadence (`weekly`, `monthly` or `yearly`, the values the sheet writes), the next due date (a real day, today or later, at most 400 days ahead) and an optional expense category of theirs.
- **`AddBillSheet.open()`** takes an object without `id` as a new bill, filled in, with `onDone({ saved })`. The date counts as picked, so changing the cadence doesn't move it, and the date is read with `parseISO` as a local day. New bills stay INR while the currency picker is off. An object with `id` is still an edit.
- **"Remind me about rent, 15000, on the 1st every month"** gave a card reading ₹15,000 · Rent · Every month · next due Tue 1 Dec 2026. Review opened "New Bill" with Rent, ₹15000, Monthly, 1 Dec 2026, Active and the Rent category. Create Bill made it ("Bill created"), and the card turned to "Saved ✓".
- **Same as the sheet's own:** on Bills, the new row reads "Rent · Monthly · Due 1 Dec · ₹15,000", exactly like the Rent bill made by hand in the sheet earlier.
- **Editing:** the new bill opened as "Edit Bill" with the same values (and Delete), and Save Bill updated it.
- **Polish:** the card hides the category when it has the bill's own name, so it no longer reads "Rent · Rent".
- **Test data:** the test account now has two identical Rent bills (₹15,000, due 1 Dec). The second one came from this check, and can be deleted from Bills.
