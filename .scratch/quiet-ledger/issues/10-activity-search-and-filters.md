# 10: Activity: search and filters

Spec: .claude/features/archive/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** On the Activity tab you can find any entry with search and filter chips. It shows a one-line total, and each transfer appears as one row.

- New `Chip`: an outlined pill, with an ink fill when selected. Filter chips add a leading icon and a trailing ▾. 48 dp target.
- **Filters:** `{ search, type, categoryId, accountId | all, range }`.
  - The default is this month, the active account and all types.
  - Each chip opens a `Sheet`.
  - Date range offers This month, Last month, Last 30 days and Custom.
- **Data:** an Activity hook fetches by account (or all accounts) and date range. Pure functions then:
  - apply search, type and category;
  - compute the summary: expenses and income, with transfers and settlements excluded;
  - pair the two legs of a transfer by its transfer id. When only one leg is in view, it shows as one ⇄ row naming the other account.
- The list is date-grouped, using ticket 08's labels.
- When nothing matches, an EmptyState with `receipt` shows, plus a way to clear the filters.
- The filters are kept when you open a row and come back.

**Blocked by:** 02, 08, 09

**Status:** resolved

- [x] The check script covers:
  - search by note, category name and amount;
  - the type filter, including transfers;
  - the category filter;
  - the summary leaving out transfers and settlements;
  - both legs becoming one row, and a single leg becoming one ⇄ row.
- [x] Each chip shows its value and changes the list; All accounts works
- [x] The summary line matches the visible rows
- [x] With no match, the empty state shows, and clearing the filters brings the list back
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: rules in `lib/activity.js` (filter, summary, pairing, groups, ranges; 43 cases in `ledger-check.mjs`, 138 pass). `hooks/useActivity.js` fetches by account(s) and range; `components/ActivityFilterSheet.js` is one `Sheet` for the four chips; `components/ledger/TransactionRow.js` is now shared with Home; `Chip` has `caret`. Both are in the Kit gallery.
- Checked on Pixel_API_36, light and dark: search "120" (3 rows, Spent ₹360), "zzz" → empty state → Clear filters; Transfers; All accounts (4 legs in the DB → 2 rows); Savings alone (one-leg ⇄ rows); Transport (₹389.50); Last month; Custom 1–31 Oct; Back closes the sheet.
- Asked for by the person during the work: chips wrap inside the gutter (they scrolled off the edge); the Account sheet shows each account's in-hand balance and the total on All accounts; the selected account is an ink circle with a check (not a trailing check), so the amounts line up.
- Not checked: picking dates in the Custom pickers (the dialog wasn't driven), and coming back from a row (it opens the Add sheet until ticket 11; filters are screen state, so they stay). All accounts sums in the active account's currency (all INR today).
