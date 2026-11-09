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

**Status:** ready-for-agent

- [ ] The check script covers every source value plus null, and the History builder: never edited → 1 step, edited → 2 steps, split-linked → 3 steps, oldest first
- [ ] The screen opens from Home's recent rows and from Activity, and going back keeps Activity's filters
- [ ] Edit opens the existing sheet. Afterwards the detail shows the saved change and an Edited step
- [ ] Delete works for:
  - a normal entry;
  - a transfer (both legs are gone);
  - a split-linked entry (the split entry is kept).
- [ ] An old entry with no source shows no source line
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
