# Feature: Quiet Ledger redesign, Phase 4 (Money screens)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/48-quiet-ledger-money-screens.md`
**Status**: ready-for-agent (tickets in `.scratch/quiet-ledger-money/issues/`, handoff `.scratch/quiet-ledger-money/handoff.md`)
**Last Updated**: 2026-11-11
**Source of truth for the design**: `docs/redesign-plan.md` §4 (Insights, Budgets, Bills, Splits, Accounts, Categories), §2.6 (bill icons) and §7 Phases. Where this spec and that document disagree on a visual detail, the document wins; where they disagree on scope, sequencing or data, this spec wins.

---

## Context

Spec 46 built Phases 1–2 of the Quiet Ledger redesign: the ledger kit (`components/ledger/`, `theme/ledger.js`), Home, the Add sheet, Activity and Transaction detail. Spec 47 built Phase 3, Onboarding. Both are done (handoffs: `.scratch/quiet-ledger/handoff.md`, `.scratch/quiet-ledger-onboarding/handoff.md`). Every decision in those handoffs still holds here, in particular:
- a kit screen uses `ScreenHeader` + `LargeTitle` + `useHeaderScroll` with `headerShown: false` on its route;
- sheets use the ledger `Sheet` with a `footer` of `PinnedFooter` props; chips are the ledger `Chip`;
- the accent is olive and graphics only, never text and never a button fill; income green is `positive`;
- `ProgressBar` state comes from the shared progress rule (warn past 80 %, danger **at** 100 %), never a screen's own threshold;
- date groups come from the shared date-label module; lists use the ledger `TransactionRow`, which opens Transaction detail;
- the disabled `Button` is a flat sunk pill; Koban is deleted; `FLAGS.accents` is off;
- **charts in Insights show y-axis numbers** (the person asked for the numbers on 2026-11-10, when the chart left Home).

This spec is **Phase 4: the money screens**: Insights, Budgets (list, detail, sheet), Bills (list, the new bill detail, sheets, and icons picked from the bill's name), Splits (list, detail, add-from-history, sheets), Accounts (list, sheet, switcher) and Categories. Plans is flagged off (`FLAGS.plans`) and gets the same restyle here, because its screens are built the same way as Budgets and Splits.

Decided with the person while writing this spec (2026-11-11):
- **Spec 45 (account last 4) folds into the Accounts work.** Its Phase 1 (the `accounts.last4` column, the sheet field, "•••• 4821" on the switcher and Accounts rows) is built here; its Phase 2 (matching SMS hints) stays unscheduled in spec 45.
- **Bill payment history comes from a new `transactions.bill_id` link**, set by Mark paid from now on. No guessing from notes; older payments show as the bill's "Last paid" date only.
- **Test seams stay spec 46's two:** pure rules checked by `scripts/ledger-check.mjs`, plus an emulator check per ticket. No new test runner.

## Phase Overview

One phase, Phase 4. Each screen moves to the kit in its own ticket, so the app keeps working between tickets. One migration (Database) comes first, because bill detail, bill icons and last 4 read it.

```
Phase 4 — Money screens
  Database: accounts.last4, bills.icon, transactions.bill_id
  Insights · Budgets (+ detail) · Bills (+ new detail, icons from names)
  Splits (+ detail, add from history) · Accounts (+ last 4) · Categories
  Plans restyle (flag off)
```

**After the phase: stop and wait for approval before Phase 5.**

## Problem Statement

Home, Activity and the Add sheet now read as a calm ledger, but one tap away the money screens still look like the old app. Insights stacks KPI cards, a bar chart, a donut and an accordion with no first read. Budgets, Bills and Splits are piles of rounded cards with lime bars, filled square icon tiles and coloured pills; every bill row has a heavy dark "Mark Paid" button, and nearly every bill shows the same generic receipt icon, so Netflix, rent and electricity look alike. Tapping a bill drops straight into its edit sheet, and there's nowhere to see when it was paid. Accounts has two text buttons on every row, and Categories a red bin on every row. With two cards at the same bank, nothing tells them apart. Moving between Home and these screens feels like switching apps.

## Solution

Move the six money screens (and flagged-off Plans) onto the ledger kit, so they share Home's chrome, type, flat lists and colour rules:
- **Insights** opens on one sentence ("You spent ₹1,984.50", with a comparison under it), then a line chart with y-axis numbers, "Where it went" as ranked category rows with thin tinted bars, and the remaining facts as flat rows.
- **Budgets** are rows with a thin progress bar and "₹5,910 left"; the detail leads with "₹2,104.50 of ₹2,000", a pace callout and the period's entries.
- **Bills** are grouped by Overdue, This week and Later, each with its own icon picked from its name (a local keyword list first, one Ask FLO call only when the list doesn't know the name) and a small Mark paid button. A tap opens a new **bill detail** with a payment timeline.
- **Splits** show stacked member initials and "You're owed ₹600" / "You owe ₹200"; the detail leads with the balance and pins Settle up.
- **Accounts** are rows with each account's colour, its last 4 when set and its in-hand balance; Edit and Transfer move into a ⋯ menu.
- **Categories** are two flat sections with a + in each header; delete moves into the edit sheet.

Every feature stays. Gates, flags and data behave as before, apart from the three new columns.

## User Stories

### Insights
1. As a FLO user, I want Insights to open with "You spent ₹X" as the largest text, so that I get the answer before the detail.
2. As a FLO user, I want a muted line under it comparing with the previous period ("₹430 less than October", "₹1,200 more than last week"), so that I know whether I'm doing better.
3. As a FLO user, I want the comparison to say "About the same as October" when the difference is under 5 %, so that tiny changes don't read as news.
4. As a FLO user, I want no comparison line when the previous period has no spending, so that FLO doesn't compare against nothing.
5. As a FLO user, I want Week | Month | Custom as a segmented control at the top, so that changing the period is one tap.
6. As a FLO user, I want the period arrows inline ("‹ November 2026 ›"), so that stepping back a period is quick.
7. As a FLO user, I want the forward arrow disabled for a period that hasn't started, so that I can't step into the future.
8. As a FLO user, I want Custom to offer two dates, so that I can look at any range.
9. As a FLO user, I want the account filter as one chip ("All accounts ▾" or the account name) that opens a sheet, so that a long row of account chips doesn't crowd the top.
10. As a FLO user, I want each account in that sheet to show its name and colour, with the selected one marked, so that I pick the right one.
11. As a FLO user, I want Insights to start on my active account, so that it matches Home.
12. As a FLO user with accounts in different currencies, I want an info callout saying totals are in one currency and others are excluded, so that the numbers aren't misleading.
13. As a FLO user, I want a line chart of daily spending with a soft olive fill, so that I see the shape of my spending.
14. As a FLO user, I want y-axis numbers on the chart, so that I can read the amounts, not just the shape.
15. As a FLO user, I want day initials under a Week chart and only the first and last day under a Month or Custom chart, so that the axis isn't cluttered.
16. As a FLO user, I want to tap a day on the chart to see that day's total, so that I can check a spike.
17. As a FLO user, I want each chart day to be a full-height tap column of at least 48 dp, so that tapping a day doesn't need precision.
18. As a FLO user with no spending in the period, I want the chart replaced by an empty state ("Nothing spent in this period"), so that an empty chart doesn't look broken.
19. As a FLO user, I want "Where it went" as category rows ranked by amount, each with its tinted circle, amount, percentage and a thin bar in the category's colour, so that I see the biggest categories first.
20. As a FLO user, I want an Expense | Income segmented control on "Where it went", so that I can see where income came from too.
21. As a FLO user, I want each category row to show its change against the previous period as a muted caption, so that I keep the comparison the old screen had.
22. As a FLO user, I want tapping a category row to open Activity filtered to that category, period and account, so that I can see the entries behind the number.
23. As a FLO user, I want Received, Net saved and Savings rate as three small stats in one row, so that the rest of the picture is there without cards.
24. As a FLO user who spent more than they received, I want a negative Net saved in red, so that I notice it.
25. As a FLO user with budgets, I want a Budgets section listing each budget's progress for the period as a row with a thin bar, so that Insights still shows how budgets went.
26. As a FLO user with a budget that is often over, I want a "Frequently over" red caption on it, so that the pattern stands out.
27. As a FLO user, I want tapping a budget in Insights to open its detail, so that I can dig in.
28. As a FLO user, I want the biggest transaction of the period as one row, opening its Transaction detail, so that I keep that fact.
29. As a FLO user, I want Export CSV as an icon in the header, exporting the period and account I'm looking at, so that export works as before.
30. As a FLO user, I want Home's "Last 7 days" row to keep opening Insights on Week, so that the link from Home still lands.
31. As a FLO user, I want pull-to-refresh on Insights to keep working, so that I can force fresh numbers.
32. As a FLO user, I want skeletons shaped like the headline, chart and rows while loading, and never ₹0, so that loading never looks like wrong data.

### Budgets
33. As a FLO user, I want each budget as a flat row with its category's tinted circle (a wallet in a grey circle for an overall budget), its name and its period, so that the list is quick to scan.
34. As a FLO user, I want a thin progress bar under each budget's title, so that I see how much is used without reading numbers.
35. As a FLO user, I want "₹5,910 left" on the right of each row, or "₹104.50 over" in red when over, so that the number I care about is where amounts always are.
36. As a FLO user, I want "Almost out" (amber) or "Over" (red) as a coloured caption instead of a pill, so that the status is clear but quiet.
37. As a FLO user, I want a budget spent exactly to its limit shown red, so that it reads the same as the progress bar.
38. As a FLO user with a custom budget whose end date has passed, I want it marked "Ended" in a muted caption and its figures shown as final, so that it doesn't look like it stopped updating.
39. As a FLO user, I want New budget pinned at the bottom, so that adding one is always in reach.
40. As a FLO user on the free plan, I want the budget limit gate to behave as before, so that nothing changes in what I can do.
41. As a FLO user with no budgets, I want an empty state with one object, one line and a New budget action, so that I know what budgets are for.
42. As a FLO user, I want tapping a budget to open its detail, as now, so that editing is deliberate.
43. As a FLO user, I want the budget detail to lead with "₹2,104.50 of ₹2,000" as the largest text and a progress bar under it, so that the state is the first read.
44. As a FLO user, I want "Left to spend" or "Over budget by" with the days left in the period, so that I can plan the rest of it.
45. As a FLO user, I want a pace callout ("Spending too fast to last the period", or an on-track note), so that I'm warned early.
46. As a FLO user, I want the budget detail's transactions date-grouped, using the same rows as Home and Activity, so that every list reads the same.
47. As a FLO user, I want a transaction in the budget detail to open its Transaction detail, so that I can't edit by accident.
48. As a FLO user, I want an Add expense action on an empty budget detail, so that I can log against it.
49. As a FLO user, I want the edit icon in the budget detail's header, so that editing is one tap away.
50. As a FLO user who deletes a budget from its edit sheet, I want to land back on the list, so that I'm not left on an empty screen.
51. As a FLO user, I want the budget sheet in the standard sheet, with the period as a segmented control, so that it looks like every other sheet.
52. As a FLO user, I want every budget field (name, amount, category or overall, account, period, custom dates) to behave as now, so that nothing is lost.

### Bills
53. As a FLO user, I want my bills grouped under Overdue, This week and Later, so that what needs me now is at the top.
54. As a FLO user with an overdue bill, I want the Overdue group's caption and the bill's circle and due line in red, so that it stands out.
55. As a FLO user with a paused bill, I want it in a muted Paused group at the bottom with no overdue styling, so that a bill I'm not tracking doesn't nag me.
56. As a FLO user, I want each bill row to show its icon in a circle, its name, "Monthly · Due 12 Nov" and its amount, so that one row says everything.
57. As a FLO user, I want a small quiet Mark paid button on each unpaused row, so that paying doesn't need a heavy dark pill on every bill.
58. As a FLO user, I want Mark paid to open the pay sheet as now (amount, date, account, Skip this cycle), so that paying works as before.
59. As a FLO user, I want New bill pinned at the bottom, so that adding one is always in reach.
60. As a FLO user with no bills, I want an empty state with the calendar object and a New bill action, so that I know where bills go.
61. As a FLO user, I want tapping a bill to open a bill detail instead of the edit sheet, so that I can look without changing anything.
62. As a FLO user, I want the bill detail to show the icon, the amount as the largest text, the cadence and the next due date at the top, so that the key facts come first.
63. As a FLO user, I want a timeline of payments on the bill detail (each with its date, amount and account), so that I can see when I paid it.
64. As a FLO user, I want each payment in the timeline to open its Transaction detail, so that I can check or fix it.
65. As a FLO user, I want the timeline to start with the next due date as the open step, so that I know what's coming.
66. As a FLO user with a bill paid before payment history existed, I want one "Last paid <date>" step from what FLO already knows, so that the history is honest and not empty.
67. As a FLO user with a bill never paid, I want the timeline to show only the next due date and when the bill was added, so that FLO doesn't invent payments.
68. As a FLO user, I want Mark paid pinned in the bill detail's footer and Edit in its header, so that the two actions are where they always are.
69. As a FLO user, I want a paused bill's detail to say it's paused and offer no Mark paid, so that I don't log a payment for a bill I'm not tracking.
70. As a FLO user, I want the bill detail to refresh after I mark it paid, so that the new payment and the next due date show at once.
71. As a FLO user, I want Home's upcoming bill rows to open the bill detail, so that Home and Bills behave the same.
72. As a FLO user, I want each bill to get an icon that fits its name (Netflix → film, electricity → bolt, rent → home, Jio → phone, LIC → shield, SIP → trending up, EMI → bank), so that bills are easy to tell apart.
73. As a FLO user, I want the icon to appear in the sheet as I type the name, so that I see what it will look like before saving.
74. As a FLO user, I want to change the icon in the bill sheet from FLO's icon set, so that I decide, not FLO.
75. As a FLO user, I want an icon I picked myself never to be replaced automatically, so that my choice sticks, even if I rename the bill.
76. As a FLO user with a bill name the local list doesn't know, I want FLO to ask Ask FLO once when I save, so that unusual names still get a fitting icon.
77. As a FLO user, I want saving a bill never to wait on that Ask FLO call, so that saving stays instant.
78. As a FLO user with no network or AI off, I want the bill to fall back to its category's icon, then a receipt, so that it always has an icon.
79. As a FLO user, I want no brand logos, only FLO's own icons, so that the app stays consistent (and clear of trademarks).
80. As a FLO user, I want only the bill's name sent to Ask FLO for the icon, never the amount or my other data, so that the call shares as little as possible.
81. As a FLO user, I want the bill sheet in the standard sheet, with every field (name, icon, amount, category, cadence, next due date, active, delete) as now, so that nothing is lost.

### Splits
82. As a FLO user, I want each split as a flat row with its members' stacked initials, its name and "You're owed ₹600" (green) or "You owe ₹200" (ink) on the right, so that I see where I stand in each.
83. As a FLO user, I want a split where everyone is square to say "Settled up" in muted text, so that it doesn't look like money is owed.
84. As a FLO user, I want closed splits grouped under a muted Closed header at the bottom, so that open ones come first.
85. As a FLO user, I want New split pinned at the bottom, with the free-plan gate as before, so that the gate doesn't change.
86. As a FLO user with no splits, I want an empty state with one object, one line and a New split action, so that I know what splits are for.
87. As a FLO user, I want the split detail to lead with my balance in that split as the largest text, so that the answer comes first.
88. As a FLO user, I want "Who owes whom" as flat rows with a compact Settle up on each pair I'm part of, so that settling a debt is one tap.
89. As a FLO user, I want Settle up pinned as the primary in the split detail's footer while anything is owed, so that the main action is always there.
90. As a FLO user, I want Add entry beside it, and as the only action once everyone is square, so that adding stays in reach.
91. As a FLO user, I want Entries, People and Settled as a segmented control with counts, so that each list is one tap away.
92. As a FLO user, I want entries date-grouped with the payer and amount, each opening its edit sheet as now, so that split entries still edit as before.
93. As a FLO user, I want "Add from my transactions" to keep working, restyled with the kit's chips, rows and pinned footer, so that I can still build a split from my history.
94. As a FLO user, I want the "how this was worked out" breakdown kept as a collapsible section, so that I can check the maths.
95. As a FLO user, I want export, close and reopen in the split detail's header, so that those actions are still there without crowding the page.
96. As a FLO user, I want removing a member to confirm first and recalculate shares, as now, so that nothing changes in how splits work.
97. As a FLO user, I want the split, entry, person and settle-up sheets in the standard sheet, so that they look like every other sheet.
98. As a FLO user, I want a closed split read-only until I reopen it, as now, so that settled history stays settled.

### Accounts and last 4
99. As a FLO user, I want each account as a flat row with a circle in the account's colour, its name and its in-hand balance, so that I see all my money in one list.
100. As a FLO user, I want a skeleton instead of ₹0 while balances load, so that loading never looks like an empty account.
101. As a FLO user, I want a check on my active account, so that I know which one Home shows.
102. As a FLO user, I want tapping an account to make it active, as now, so that switching works the same.
103. As a FLO user, I want Edit and Transfer in a ⋯ menu on each row instead of two text buttons, so that the list is calm.
104. As a FLO user with one account, I want no Transfer in that menu, so that I don't see an action I can't use.
105. As a FLO user, I want New account pinned at the bottom, with the free-plan gate as before, so that the gate doesn't change.
106. As a FLO user, I want to add the last 4 digits of a card or bank account when I add or edit it, so that I can tell two accounts at the same bank apart.
107. As a FLO user, I want the last 4 field to accept digits only, at most four, so that I can't type anything else.
108. As a FLO user who types 1–3 digits, I want "Enter all 4 digits or leave it blank" and no save, so that a half number isn't stored.
109. As a FLO user, I want a hint that FLO only needs the last 4 and never a full card number, so that I trust the field.
110. As a FLO user, I want clearing the field to remove the last 4, so that I can undo it.
111. As a FLO user, I want "•••• 4821" on the Home card, the account switcher and the Accounts list, after any description, so that I see which card it is everywhere I pick an account.
112. As a FLO user with an account without last 4, I want it to look exactly as it does now, so that the field stays optional.
113. As a FLO user, I want FLO never to ask for a full card number, expiry, name on card or CVV, so that it never holds card data.
114. As a FLO user, I want the account sheet in the standard sheet, with every field (name, description, colour, currency when its flag is on, delete) as now, so that nothing is lost.
115. As a FLO user, I want the account switcher sheet restyled with the same rows, so that it matches the Accounts list.

### Categories
116. As a FLO user, I want Categories as two flat sections, Expense and Income, each with a + in its header, so that adding a category is right where it goes.
117. As a FLO user, I want each category as a row with its icon in a circle washed in its colour, so that the list matches how categories look everywhere else.
118. As a FLO user, I want tapping a category to open its edit sheet, so that renaming or recolouring is one tap.
119. As a FLO user, I want Delete as a danger button inside the edit sheet instead of a red bin on every row, so that I can't delete by accident.
120. As a FLO user deleting a category that's in use, I want the same "used by N transactions and M budgets" message and no delete, so that nothing is orphaned.
121. As a FLO user, I want the category sheet in the standard sheet, so that it looks like every other sheet.

### Plans (flagged off)
122. As the developer, I want Plans' list, detail and add-from-history screens restyled on the kit while `FLAGS.plans` stays off, so that turning Plans back on doesn't look out of place.

### Developer
123. As the developer, I want every flag (`billing`, `plans`, `splitInvites`, `currencyPicker`, `themes`, `ai`, `economy`) to behave exactly as now on every moved screen, so that the restyle changes no behaviour.
124. As the developer, I want the old components left in place until the cleanup ticket after Phase 5, so that unmoved screens keep working.
125. As the developer, I want the new pure rules in the node check script, so that grouping, icons, comparisons and history are checked without the app.
126. As the developer, I want each ticket verified on Pixel_API_36 in light and dark mode, so that "done" means seen on the device.

## Implementation Decisions

### Approach
- **Same as specs 46 and 47.** Each screen moves in its own ticket; old components stay until the cleanup ticket after Phase 5. Read hooks keep the `version` / `activeAccountId` / `{ data, loading, refetch }` shape; writes stay in `lib/` with `notifyChanged()` after.
- **Presentational except for:** the migration below, the bill-icon rules and Ask FLO mode, the bill detail's read helper, the `bill_id` written by Mark paid, the last-4 field, and Activity accepting initial filters from a link.
- **Pure rules live in plain `lib/` modules** with no React Native, Expo or Supabase imports (explicit `.js` extensions in their imports), so the check script can load them. Components call them; they never re-implement them.

### New kit pieces
| Piece | Replaces | Shape |
|---|---|---|
| `SpendChart` (ledger) | `IncomeExpenseChart`, `ChartAxis`, `DonutChart` on Insights | the daily spending line with a soft `accentSoft` area fill; **y-axis numbers** (three or four rounded ticks, en-IN compact like "₹2k", muted 12/400, inside the 20 gutter); no gridlines except a faint baseline; day initials (Week) or first and last day (Month, Custom) under it; one full-height ≥48 dp tap column per day; the tapped day's total and date shown above the chart, without navigating; nothing animates in |
| `AvatarStack` (ledger) | `SplitMemberChip` stacks | up to three overlapping initial circles (each in the person's stored colour, washed like category tints) plus "+N" |
| `OverflowMenu` (ledger) | per-row text buttons | a 40 dp ⋯ circle that opens a small `Sheet` of `ListRow` actions |
| `IconPicker` (ledger) | — | a grid of FLO's icon keys in tinted circles; selected = ink circle with an inkOnInk glyph; used by the bill sheet (and available to the category sheet) |
- Each is added to the kit gallery (Settings → Developer → Kit).
- **Retired by this phase** (deleted in the cleanup ticket once nothing imports them): `InsightsPeriodControl`, `IncomeExpenseChart`, `ChartAxis`, `DonutChart`, `CategoryBreakdownAccordion`, `BreakdownTable` (if unused by then), `DailySpendingChart` (if unused), and these screens' uses of `Card`, `IconTile`, `Pill`, the old `ProgressBar`, `BackButton` and `Button`.

### Insights
- **Top:** `ScreenHeader` with title "Insights" and the CSV icon action; then `Segmented` Week | Month | Custom; then the inline period stepper ("‹ November 2026 ›", or "3 – 9 Nov", or two date fields for Custom), with forward disabled past today; then the account `Chip` ("All accounts ▾" / account name) opening a `Sheet` of accounts (same row shape as Activity's account filter: a circle with a check on the selected one).
- **Unchanged data and gates:** the one all-accounts fetch for the period and the prior period, with the account as a view filter over it; Custom, All accounts and CSV stay behind `hasPro` (open while `FLAGS.billing` is off), with the crown on locked options and the upsell sheet on tap when billing is on; the mixed-currency note becomes an `info` `Callout`; `period=week|month` link params keep working.
- **Headline:** a pure function takes the period's spend, the prior period's spend, the mode and the prior period's label, and returns `{ headline, comparison | null }`:
  - "You spent ₹X" (paise rule; "You haven't spent anything" when zero);
  - "₹D less than <prior>" / "₹D more than <prior>", where `<prior>` is the month name ("October"), "last week", or "the 7 days before" for Custom;
  - "About the same as <prior>" under 5 %;
  - null when the prior spend is zero.
- **Chart:** `SpendChart` over daily expense totals for the period (the existing trend computation), scoped to the account filter. Income is in the stats row, not the chart. An empty period shows the ledger `EmptyState` (`receipt`) instead.
- **Where it went:** `SectionHeader` with a compact `Segmented` Expense | Income on the right; then ranked `ListRow`s (tinted circle, category name, a thin 4 dp bar in the category's tint under the title at its share of the top category, amount right, "34 % · ↓12 %" style sub with the existing delta). A tap opens Activity with `{ categoryId, range: {from, to}, accountId }` (see Activity link below). Replaces the donut and the accordion.
- **Stats row:** Received (positive), Net saved (danger when negative), Savings rate, as three captioned figures in one row, no cards.
- **Budgets section** (only with budgets): one `ListRow` per budget with a `ProgressBar` for the selected period's last budget period, "₹X left" / "₹X over" right, and "Frequently over" as a danger caption (existing consistency rule). A tap opens budget detail. The per-period history list is dropped from Insights (it's on budget detail's period, and the consistency caption keeps the signal).
- **Biggest transaction:** a `SectionHeader` plus one `TransactionRow`, opening Transaction detail.
- Order: header → period controls → headline → chart → Where it went → stats → Budgets → Biggest. 24 between blocks.

- **Amended while building (ticket 01, 2026-11-12, the person's asks):** "Where it went" rows show the share beside the amount and the change as the sub line ("↑138 % vs October"), one line each side; the Spent / Received toggle is a text-only `Segmented` (`plain`); an empty period shows only the headline (no chart, no empty state); the comparison period is calendar-aware (a whole month vs the whole month before); budget rows use only budget periods wholly inside the fetched span, with the period before feeding "Frequently over"; the Uncategorized row doesn't link. Kit-wide: single-line inputs and Segmented are full capsules (`ledgerRadius.field`), and the empty-state object is 48 dp.

### Activity link (small change to spec 46's Activity)
- Activity accepts initial filters from route params (`categoryId`, `from`, `to`, `accountId`) and applies them once on arrival, over its defaults. Afterwards the chips work as now. Used by Insights; nothing else changes on Activity.

### Budgets
- **List:** `ScreenHeader` + large title "Budgets"; one `ListRow` per budget with a `ProgressBar` under the title, "₹5,910 left" (or "₹104.50 over", danger) right, and a sub of the period label plus the status caption. `PinnedFooter` New budget with the free-plan gate unchanged. Ledger `EmptyState` (`coins`) when empty.
- **List status** is a pure function of the budget's spent, amount, period type and end date (and today): `{ state: 'ok'|'warn'|'over'|'ended', ratio, caption, rightText, rightTone }`. It uses the shared progress rule for the thresholds (warn past 80 %, over at 100 %), and "ended" wins for a custom budget whose end date has passed (its bar keeps its final state; caption "Ended").
- **Detail:** `ScreenHeader` with the budget name, the period label as its sub, and an edit (pencil) action. A `surfaceSunk` band: the category circle, "₹2,104.50 of ₹2,000" (display), the `ProgressBar`, then "Left to spend ₹X" / "Over budget by ₹X" with "N days left". A pace `Callout` (`warn` when over pace, `info` when on track; the existing pace rule). Then the period's transactions date-grouped with `TransactionRow` (opening Transaction detail; this replaces the old tap-to-edit). Empty: one line and a compact Add expense opening the Add sheet with the budget's category. The dead-id guard (deleted from the edit sheet → back) stays.
- **Sheet:** the budget sheet moves onto `Sheet`; the period chooser becomes `Segmented`; every field, the overall-budget option, the custom dates and the free gate are unchanged.

### Bills
- **List:** `ScreenHeader` + large title "Bills"; groups as `SectionHeader`s: **Overdue** (danger caption), **This week**, **Later**, **Paused** (muted), each omitted when empty. A pure grouping function takes the bills and today:
  - Paused = `is_active` false (never overdue);
  - Overdue = active and next due before today;
  - This week = active and due today through today + 6;
  - Later = everything else;
  - each group sorted by next due date, then name.
- **Row:** `ListRow` with the bill's icon (see Bill icons) in a circle tinted by the bill's category colour (danger tint when overdue), name, sub "Monthly · Due 12 Nov" ("Overdue since 9 Nov" in danger; "Paused" muted), amount right, and a compact `quiet` **Mark paid** in the trailing slot for active bills. Tap opens bill detail.
- `PinnedFooter` New bill. Ledger `EmptyState` (`calendar`) when empty.
- **Pay sheet:** moves onto `Sheet`; amount, date, account and Skip this cycle are unchanged. Mark paid now also writes `bill_id` (Database).
- **Bill sheet:** moves onto `Sheet`; adds the icon row (current icon in its circle, "Change" opens `IconPicker`). Every other field, the currency rule and delete are unchanged.

### Bill detail (new)
- A new stack route keyed by the bill id, opened from the Bills list and from Home's upcoming bill rows (which today open the edit sheet).
- **Read helper:** a bill-detail hook loads the bill (with its category) and its linked payments (`transactions` where `bill_id` = the bill, newest first, with account names), depending on `version`. A deleted or missing bill sends the screen back (same guard as budget detail).
- **Layout:** `ScreenHeader` with Edit (pencil). A `surfaceSunk` band: the bill's icon circle, the amount (display), the name, then "Monthly · Next due 12 Nov" (danger when overdue, "Paused" when inactive). Then a `Timeline`. `PinnedFooter` **Mark paid** (primary, opens the pay sheet), absent for a paused bill.
- **Timeline** from a pure builder taking the bill, its linked payments and today, returning steps newest first:
  1. the open step: "Due 12 Nov" (or "Overdue since 9 Nov", danger; nothing for a paused bill);
  2. one step per linked payment: "Paid ₹649" with "8 Oct · HDFC" as the sub, tapping into Transaction detail; at most 12, then "Earlier payments are in Activity";
  3. a "Last paid 8 Sep" step when `last_paid_date` is set and no linked payment has that date (payments from before `bill_id` existed);
  4. "Added" at `created_at`, last.
- A skipped cycle isn't recorded today, so the timeline doesn't show skips.

### Bill icons (redesign plan §2.6)
- **Icon set:** FLO's existing category icon keys (food, travel, shopping, bills, coffee, groceries, salary, freelance, other, home, car, gift, entertainment, health, education, phone, fitness, savings, subscriptions, insurance, pets, kids, utilities, business, investment), plus four bill keys mapped to lucide glyphs in the same icon component: `wifi` (Wifi), `water` (Droplet), `gas` (Flame), `tv` (Tv). The set's key list lives in a pure module so the check script, the picker and the Edge Function share one truth (the function keeps a copied list, checked to match by the script).
- **Local keyword map (pure):** `iconForBillName(name) → key | null`. Case-insensitive, whole-word or prefix matches on a curated list, Indian names first. At least: Netflix, Prime, Hotstar, Spotify, YouTube → `entertainment` or `subscriptions` (streaming = entertainment); electricity, BESCOM, TNEB, MSEB, power → `utilities`; rent, maintenance, society → `home`; Jio, Airtel, Vi, mobile, recharge → `phone`; broadband, wifi, ACT, fibre → `wifi`; water → `water`; gas, LPG, cylinder, Indane → `gas`; DTH, Tata Play, Dish → `tv`; LIC, insurance, policy, premium → `insurance`; SIP, mutual fund, PPF, NPS → `investment`; EMI, loan → `business` (landmark); school, tuition, fees → `education`; gym → `fitness`; credit card → `bills`. No match → null.
- **Resolution order for display:** the bill's stored `icon` → its category's icon → `bills` (receipt).
- **In the sheet:** while the person types a name, the row previews `iconForBillName(name)` (or the category's icon). Saving stores:
  - the picked icon when the person chose one (and remembers that it was chosen, see Database);
  - otherwise the keyword match;
  - otherwise null, then the AI step below.
- **The Ask FLO step:** only when `FLAGS.ai` is on, the person didn't pick an icon, and the keyword map returned null. **After** the save succeeds (saving never waits), the app calls the `ai-assistant` Edge Function with a new mode, `bill_icon`, sending only `{ mode, name }`. The function asks the quick model to pick one key from its list, checks the reply is in the list, and returns `{ icon }` or `{ icon: null }`; it logs latency like `quick_add` does (kind `bill_icon`). The app writes the icon only if the bill still has no picked icon, then runs `notifyChanged()`. Any failure leaves the fallback. One call per save at most; renaming a bill re-runs the same rules unless the icon was picked.
- Spec 44's rule holds: the model proposes, the person can change it in the sheet. No brand logos.

### Splits
- **List:** `ScreenHeader` + large title "Splits"; open splits first, then a muted **Closed** `SectionHeader`. Each row: `AvatarStack` in the icon slot, the name, the date or member count as the sub, and on the right the person's net in the split: "You're owed ₹600" (positive), "You owe ₹200" (ink), or "Settled up" (muted). The net comes from the existing split math; a pure function turns a net into `{ text, tone }`. `PinnedFooter` New split with the free gate unchanged. Ledger `EmptyState` (`receipt`) when empty.
- **Detail:** `ScreenHeader` with the split name and up to two actions: export, and a ⋯ `OverflowMenu` holding Close/Reopen, Edit split and (with `FLAGS.splitInvites`) invite/revoke. A `surfaceSunk` band with the person's balance (display, same tone rule) and the members' `AvatarStack`. "Who owes whom" as `ListRow`s ("Asha owes you ₹300") with a compact Settle up on pairs involving the person, opening the settle-up sheet pre-filled as now. The "how this was worked out" section is a collapsible `ListRow`. Then `Segmented` Entries · People · Settled (with counts). Entries are date-grouped `ListRow`s (payer as sub) opening the entry sheet as now; People rows have remove (with the existing confirm); Settled lists settlements. "Add from my transactions" is a `ListRow` at the top of Entries.
- **Footer:** `PinnedFooter` with **Settle up** (primary; opens the settle-up sheet for the first outstanding pair involving the person, with the pair changeable there) and **Add entry** (secondary). When everything is square, Add entry alone as the primary. A closed split shows no footer.
- **Add from my transactions** (the split history route): `ScreenHeader`, date fields, filter `Chip`s, a select-all `ListRow`, rows with check trailing, and the `PinnedFooter` naming what will happen ("Add 3 entries"). Behaviour unchanged (it creates entries, never edits transactions).
- **Sheets:** the split, entry, person and settle-up sheets move onto `Sheet`. Their logic is unchanged.

### Accounts and last 4 (spec 45 Phase 1, folded in)
- **List:** `ScreenHeader` + large title "Accounts"; one `ListRow` per account: a circle in the account's colour (washed tint with an ink-darkened glyph of the account's initial), the name, a sub of the description joined with " · " to "•••• 4821" when set, the in-hand balance right (skeleton while loading, never ₹0), and trailing a check on the active account plus an `OverflowMenu` with Edit and (with 2+ accounts) Transfer. Tap makes the account active. `PinnedFooter` New account with the free gate unchanged.
- **Last 4 rule (pure, in the accounts module or a sibling pure module):**
  - `cleanLast4(input) → { value: '4821' | null, error: null | 'Enter all 4 digits or leave it blank' }`: strip non-digits, blank → null, exactly 4 digits → the value, anything else → the error;
  - `maskedLast4(account) → '•••• 4821' | null`;
  - `accountSub(account) → string | null`: description and masked last 4 joined with " · ".
- **Account sheet:** moves onto `Sheet`; a "Last 4 digits (optional)" field under the name: number pad, max length 4, non-digits stripped on change, the hint "Only the last 4, to tell your cards apart. FLO never asks for a full card number.", the inline error from `cleanLast4`, pre-filled on edit. The account writes in `lib/accounts.js` take `last4` in their fields. Onboarding's account question doesn't ask for it.
- **Where it shows:** the Home card (`AccountCardCarousel` already renders it), the account switcher sheet (restyled to the same rows as the list) and the Accounts list. Activity's and Insights' account filter sheets use `accountSub` too.
- **Never:** a full card number, expiry, name on card or CVV. The database check is the real guard.
- The `ai-assistant` context builder must not start sending `last4` to the model without a decision (spec 45 rule).

### Categories
- `ScreenHeader` + large title "Categories"; two `SectionHeader`s, **Expense** and **Income**, each with a `+` `HeaderIconButton` as its right node opening the category sheet for that type. Each category a `ListRow` with its tinted circle and a chevron; tap opens the sheet in edit mode.
- **Delete** moves into the category sheet as a `danger` button (edit mode only). The in-use guard and its message, and the confirm, are unchanged. No row-level bin. Swipe-to-delete is not built.
- The category sheet moves onto `Sheet`; name, type, icon and colour behave as now.

### Plans (flag off)
- Plans' list, detail and add-from-history screens and the plan sheet move onto the kit with the same patterns as Budgets and Splits (rows with `ProgressBar`, a sunk band, `Timeline` not needed). `FLAGS.plans` stays **off**; the ticket's emulator check flips it on locally and never commits it flipped. If the budget for the phase runs short, this ticket is the one to drop: it can move to Phase 5.

### Flags
- `billing`: Pro gates and crowns as now (pass while off); no upsell surfaces while off.
- `plans`: off; no plan badges or plan rows on the moved screens; Plans restyled behind it.
- `splitInvites`: invite/revoke only inside the split ⋯ menu, only when on.
- `currencyPicker`: the currency fields in the account and bill sheets hidden while off; stored currencies still display.
- `ai`: off → no Ask FLO icon step for bills (keyword map and fallbacks only).
- `themes`: the Home card's last 4 renders on any theme.
- `economy`: nothing from the economy on these screens.

### Database
The SQL below ships as **three migrations**, each with the ticket that reads it (decided in `/to-tickets`, 2026-11-11): `accounts.last4` with Accounts, `transactions.bill_id` with bill detail, `bills.icon` with bill icons. Each is applied only with the person's yes (handoff rule) and recorded in `00-index.md`'s migrations table.

```sql
-- 48-quiet-ledger-money-screens
-- Spec 45 Phase 1: optional last 4, display only.
alter table public.accounts
  add column last4 text
    constraint accounts_last4_format check (last4 is null or last4 ~ '^[0-9]{4}$');
comment on column public.accounts.last4 is
  'Optional last 4 digits of the card or bank account, display only (spec 45/48). Never a full number.';

-- Bill icons (redesign plan §2.6). The key list is checked by the client
-- and the Edge Function; the column only guards the shape.
alter table public.bills
  add column icon text
    constraint bills_icon_format check (icon is null or icon ~ '^[a-z_]{1,32}$'),
  add column icon_picked boolean not null default false;

-- Bill payment history: Mark paid links its transaction to the bill.
alter table public.transactions
  add column bill_id uuid references public.bills(id) on delete set null;
create index transactions_bill_id_idx on public.transactions (bill_id) where bill_id is not null;
```

- `icon_picked` is true only when the person chose the icon in the sheet; automatic steps never overwrite a picked icon.
- `bill_id` is set by Mark paid only. It is not one of the fields the `updated_at` trigger watches, so linking never reads as "Edited". Deleting a bill leaves its payments as ordinary transactions. Deleting a payment doesn't roll the bill back (as today).
- **RLS:** all three tables already have row-ownership policies. The 2026-11-08 `WITH CHECK` hardening on `transactions` must also cover `bill_id` (a transaction may only reference the user's own bill), the same way it covers `account_id`. Confirm the policy's current shape via the Supabase MCP before writing that part.
- No view reads these columns, so nothing is recreated. No backfill: old payments stay unlinked, and their bills show "Last paid".
- Check the security advisor after applying, as for spec 46's migration.

### Analytics
- No new events. The existing `feature_opened` events on these screens fire as now. The `bill_icon` mode logs its call in the same AI log table as `quick_add` (latency and model only, no bill name).

## Testing Decisions

- **What a good check is:** it checks behaviour through a module's public function, never its internals. Given these bills and this date, which group is each in? Given this name, which icon? A refactor that keeps the behaviour keeps the check green. Nothing asserts on components, styles or hook state.
- **Seam 1, pure rules, `scripts/ledger-check.mjs`** (prior art: spec 46's amount, date-group, activity and entry-detail groups; spec 47's setup-planner and period groups). New groups:
  - Insights headline: zero spend; less, more and about-the-same (the 5 % edge); prior zero → no comparison; the prior label per mode (month name, "last week", custom); the paise rule in the headline;
  - budget list status: under 80 %, past 80 %, exactly 100 % (over), past 100 %, an ended custom budget, the right text and tone for each;
  - bill grouping: overdue yesterday, due today, due in 6 days, due in 7 days (Later), paused with a past date (Paused, not Overdue), the sort order;
  - bill icons: each keyword family, case and word-boundary cases ("Airtel postpaid", "AIRTEL", "Fairtel" doesn't match), no match → null; the display fallback order; every key in the map is in the icon set; the Edge Function's copied list matches the set;
  - bill timeline: never paid (open step + Added); linked payments newest first; the 12-payment cap; `last_paid_date` with and without a matching linked payment; a paused bill has no open step; overdue open step;
  - split net text: owed, owe, square (including a sub-paisa rounding residue reading as square);
  - last 4: blank, "4821", " 48 21 " (strip), "482", "48211", letters; `maskedLast4` and `accountSub` with and without a description.
- **Seam 2, the emulator** (Pixel_API_36, light and dark), per ticket, with the shared test account (`.env.test.local`; put back Appearance Light, Personal active and the card after each check). For the migration ticket, Verified also needs the columns, checks and index confirmed via the Supabase MCP, run in a rolled-back transaction:
  - `last4` `'12345'` and `'12a4'` rejected, `'4821'` and null accepted;
  - `icon` `'Film!'` rejected;
  - a transaction with another user's `bill_id` rejected by RLS;
  - setting `bill_id` alone doesn't stamp `updated_at`.
  The bill-icon ticket also checks a name the map doesn't know gets an icon from Ask FLO (and that saving didn't wait), and that a picked icon survives a rename.
- **Test data:** the shared account has no splits; the Splits ticket needs one created, which is lasting test data, so ask first. Delete test entries through the app's Delete buttons, not SQL `delete`.
- No new test runner (AGENTS.md: verify by running the app).

## Out of Scope

- Phase 5: the bills-due moment as a bottom sheet (`DueBillsModal` stays as is), Alerts, celebrations, Streak, the Ask FLO chat screen, Personalize/Cards, the You screen, Pro.
- Phase 6 polish: TalkBack, the largest font size, a 48 dp audit, reduced motion everywhere, the vivo I2220 check.
- Spec 45 Phase 2 (matching SMS or notification hints to last 4) and asking for last 4 in onboarding.
- Recording skipped bill cycles, or any payment history before `bill_id` (no backfill).
- Plan icons from names (redesign plan §2.6 mentions plans; Plans are flagged off, so it waits until they return).
- Brand logos for bills.
- Swipe-to-delete on categories.
- Changing any gate, limit, query shape or flag default.
- Removing Manrope, `theme/tokens.js` or retired components (the cleanup ticket after Phase 5).
- The real 3D illustration assets (`Illustration` keeps its glyph placeholders).

## Further Notes

- **Suggested ticket order** (`/to-tickets` decides):
  1. the migration (needs the person's yes);
  2. `SpendChart` + Insights, with the Activity link;
  3. Budgets list, detail and sheet;
  4. Bills list, the pay and bill sheets, Mark paid writing `bill_id`;
  5. bill detail and its timeline (and Home's upcoming rows opening it);
  6. bill icons: the set, the keyword map, the `IconPicker`, the `bill_icon` mode (deploying the Edge Function is part of it);
  7. Splits list, detail, add-from-history and sheets (`AvatarStack`, `OverflowMenu`);
  8. Accounts, the account sheet with last 4, the switcher;
  9. Categories;
  10. Plans restyle (flag off; droppable to Phase 5).
  Tickets 2, 3, 7, 8 and 9 don't depend on each other; 4–6 run in order after 1; 8 needs 1.
- **Before starting, confirm with the codebase:**
  - that the account context still selects `*` from `accounts` (so `last4` reaches every consumer with no hook change);
  - how the splits hook exposes each split's net for the person, so the list doesn't add a query per split;
  - which Home rows open the bill edit sheet today, so all of them move to bill detail;
  - the current `transactions` insert/update policy's `WITH CHECK`, before extending it to `bill_id`;
  - whether the old analytics module imports anything React Native, before the check script loads its trend, delta and consistency functions (move what's needed into a pure module if so).
- Spec 45's status becomes "Phase 1 folded into spec 48"; its doc stays the record of the decision never to store card data.
- Related: spec 04 (bills), 08 and 26 (budget periods and outcomes), 31 (splits), 38 (current Insights and More), 44 (Ask FLO, the model-proposes rule), 45 (last 4), 46 and 47 (the kit and its rules).
