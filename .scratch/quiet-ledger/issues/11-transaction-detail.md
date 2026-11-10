# 11: Transaction detail

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** Tapping an entry on Home or Activity opens a read-first detail screen that shows where the entry came from and what has happened to it, with Edit and Delete.

- New `Timeline`: vertical steps, each with a dot, a title and a muted sub, joined by a hairline.
- A new stack route keyed by the transaction id.
- A detail hook loads the transaction plus its category, account, transfer counterpart and any linked split entry (with the split's name). Like every read hook, it depends on `version`.
- **Layout:**
  1. a sunk top band: category circle, display amount, title, date and account;
  2. Segmented Details | History;
  3. a PinnedFooter with Edit (primary) and Delete (danger).
- **Details:** category, account, date, note, the split link (opens the split) and the source label (no line when the source is null). Transfers read "From Personal → To Savings".
- **Pure functions:**
  - a source-label map;
  - a History builder: "Created", with the source as the sub; "Edited", when `updated_at` is set; "Added to <split>", at the split entry's `created_at`. Steps run oldest first.
- **Delete:**
  - asks you to confirm first;
  - a transfer deletes both legs through the transfers mutation;
  - a split-linked entry leaves the split entry in place;
  - afterwards it runs `notifyChanged()` and goes back.
- Lists not moved yet (budget detail, splits) keep tap-to-edit.

**Blocked by:** 05, 07, 08, 10

**Status:** resolved

- [x] The check script covers every source value plus null, and the History builder: never edited → 1 step, edited → 2 steps, split-linked → 3 steps, oldest first
- [x] The screen opens from Home's recent rows and from Activity, and going back keeps Activity's filters
- [x] Edit opens the existing sheet. Afterwards the detail shows the saved change and an Edited step
- [x] Delete works for:
  - a normal entry;
  - a transfer (both legs are gone);
  - a split-linked entry (the split entry is kept).
- [x] An old entry with no source shows no source line
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: route `app/transaction/[id].js`; read `hooks/useTransactionDetail.js`; rules `lib/entryDetail.js` (source labels, History; 13 cases, 151 checks pass); `lib/transactions.js` `deleteTransaction` (the Edit sheet uses it too); `components/ledger/Timeline` (in the Kit gallery). Home and Activity rows open the detail.
- Checked on Pixel_API_36, light and dark: an old entry (no source line, one Created step); a new entry (Source "Added by you"); Edit ₹77 → ₹78 shows at once with an Edited step; Delete (confirm, back, row gone in the DB); a transfer reads "From Personal → To Savings", deletes both legs; Back keeps Activity's Type filter.
- `updateTransfer` now updates both legs in place (one upsert) instead of replacing the pair, so an edited transfer keeps its ids: checked ₹1 → ₹2, both legs updated, Edited step shown. Deleting from the Edit sheet while the detail is open now goes back on its own.
- "Edited" shows only when `updated_at` is later than `created_at` (the spec says "when it's set"); an equal stamp isn't an edit.
- Not checked live: deleting a split-linked entry (the test account has no splits). The delete path is the normal one, verified; `split_entries.transaction_id` is ON DELETE SET NULL (checked in the live schema), so the split entry stays. The split link row and its History step weren't seen on screen.
- Fixed at the person's ask during this ticket: the Add sheet's amount caret stays at the end (a tap mid-number put digits in front and Backspace did nothing), and a disabled `Button` is a flat sunk pill with muted text (the 40 % fade left a dark ring on Android).
