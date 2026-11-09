# 10: Activity: search and filters

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

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

**Status:** ready-for-agent

- [ ] The check script covers:
  - search by note, category name and amount;
  - the type filter, including transfers;
  - the category filter;
  - the summary leaving out transfers and settlements;
  - both legs becoming one row, and a single leg becoming one ⇄ row.
- [ ] Each chip shows its value and changes the list; All accounts works
- [ ] The summary line matches the visible rows
- [ ] With no match, the empty state shows, and clearing the filters brings the list back
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
