# Feature: Analytics
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/01-analytics.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

FLO currently has no dedicated place to see trends across transactions, categories, budgets, and plans — only per-screen snapshots (Home's 7-day chart, current-period budget cards, per-plan progress). This adds an **Analytics** section: one shared date filter (month selector or custom range) driving detailed, per-domain graphs and derived insights (period comparisons, savings rate, spending patterns, budget consistency, plan pace). This doc formalizes and supersedes the earlier draft at `docs/superpowers/specs/2026-07-11-analytics-design.md`, carrying its already-approved design forward under this repo's `flo-feature` process.

---

## Phase Overview

```
Phase 1 — Navigation shell + Overview
  New menu sheet (Analytics + Settings), shared filter bar, and the Overview
  sub-tab: hero deltas, savings rate, trend chart, biggest transaction.

Phase 2 — Transactions + Categories
  Dedicated Transactions sub-tab (trend + day-of-week + averages) and
  Categories sub-tab (donut + ranked list with period-over-period deltas).

Phase 3 — Budgets + Plans
  Budgets sub-tab (per-period list + consistency badge) and Plans sub-tab
  (lifetime progress + range-scoped spend + pace projection).
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Navigation shell + Overview

### Goal
The user can tap a new menu icon on Home, open a sheet listing Analytics and Settings, land on a real Analytics screen with a working month/custom filter, and see an Overview: income/expense/net-saved with deltas vs the previous equivalent period, a savings rate, a trend chart, and the biggest transaction in range. Settings' entry point moves here from the avatar tap.

### Before Starting — Confirm With Codebase
- Confirm `app/(tabs)/index.js` header layout at lines 41-61 — the avatar `Pressable` (line 43) and Bell `Pressable` (line 57) both currently call `router.push('/settings')`; this phase changes both.
- Confirm `AddBudgetSheet.js`'s Provider/Context/`forwardRef` shape (lines 12-30, 117-125) as the template for `MenuSheet.js` — note `MenuSheet` is a navigation menu, not a form, so it needs only pressable rows, not the amount/save/delete form fields.
- Confirm `IncomeExpenseChart.js`'s current hardcoded 7-day assumptions (`format(day.date, 'EEE')`, fixed bar sizing for 7 columns) before generalizing it into `TrendChart.js` for variable-length ranges.
- Confirm `app/_layout.js` for where sheet Providers are currently mounted, to add `MenuSheetProvider` alongside them.
- Confirm the existing `@react-native-community/datetimepicker` usage pattern (e.g. in `AddTransactionSheet.js`) to reuse for the custom-range pickers.

### 1.1 Database
No database changes in this phase. All Overview numbers come from `transactions` rows fetched for the filter range and the prior equivalent range, aggregated client-side.

### 1.2 Data Layer

**`hooks/useAnalyticsData({ from, to })`** — new hook. Fetches:
- `transactions` (`select('*, category:categories(*), plan:plans(*)')`) where `occurred_at` is between `from` and `to`
- `transactions` for the prior equivalent-length range (`priorFrom`/`priorTo`, derived from `from`/`to`)
- `budgets` and `plans` (fetched now even though unused until Phase 3, so the hook's return shape doesn't change later)
- Subscribes to `useDataRefresh`'s `version`, same as every other read hook
- Returns `{ current, prior, budgets, plans, loading }`

**`lib/analytics.js`** — new file, pure functions only, no Supabase calls:
- `computeTrend(transactions, from, to)` → array of `{ bucketStart, income, expense }`; daily buckets if the range is ≤ 31 days, weekly buckets otherwise
- `computeDelta(currentValue, priorValue)` → `{ pct, direction }`; handles `priorValue === 0` without dividing by zero
- `computeSavingsRate(income, expense)` → percentage, `null` if `income === 0`
- `computeBiggestTransaction(transactions)` → the single largest-amount row, or `null` if empty

### 1.3 Components

```
components/
  MenuSheet.js               — Provider + Context + forwardRef sheet; rows: Analytics, Settings
  AnalyticsFilterBar.js       — Month (‹ July 2026 ›) / Custom toggle + range pickers
  AnalyticsSegmentTabs.js     — Overview | Transactions | Categories | Budgets | Plans pills
  TrendChart.js               — generalized IncomeExpenseChart for variable range + daily/weekly bucketing
app/
  analytics.js                — screen shell: header, AnalyticsFilterBar, AnalyticsSegmentTabs, active section
```

- `MenuSheet` rows call `modalRef.current?.dismiss()` then `router.push('/analytics')` or `router.push('/settings')`.
- `app/analytics.js` owns `{ from, to }` and the active segment as local state, passed down to whichever section is active. Overview is the default segment.
- Overview content lives inline in `app/analytics.js` for this phase (split into `components/analytics/OverviewSection.js` only if it grows past ~150 lines): hero row (Income/Expense/Net Saved + delta arrows using `colors.income`/`colors.danger`), savings-rate line, `TrendChart`, biggest-transaction row.

### 1.4 Navigation / Integration

- `app/_layout.js`: mount `MenuSheetProvider` alongside the existing sheet providers.
- `app/(tabs)/index.js`: add a new menu icon `Pressable` next to the Bell (around line 57-60); its `onPress` calls `useMenuSheet().openMenu()`. The avatar `Pressable` (line 43) changes from `router.push('/settings')` to the same `openMenu()` call. The Bell `Pressable`'s `onPress` is removed — there's no notifications feature to link it to; it was pointing at Settings only as a placeholder.
- New route `app/analytics.js`, pushed from `MenuSheet`.

### 1.5 Impact on Existing Features

| Existing Feature | Impact | Watch for |
|---|---|---|
| Home header (avatar + bell) | Avatar and the new menu icon both open `MenuSheet` instead of avatar going straight to Settings; Bell's `onPress` is removed | Don't leave the Bell looking broken — confirm with the user whether the unread dot should stay (purely decorative) or come off too, rather than deciding silently |
| Settings | Entry point moves from avatar tap to `MenuSheet` | `app/settings.js` itself is unchanged — only how you reach it |

### 1.6 What This Phase Does NOT Include
- Transactions, Categories, Budgets, Plans sub-tabs (Phases 2–3)
- Day-of-week chart, donut chart (later phases)
- Any new SQL/views

### 1.7 Phase 1 Checklist — Before Marking Complete
- [ ] Tapping the new menu icon (and the avatar) on Home opens `MenuSheet`
- [ ] `MenuSheet` lists Analytics and Settings; both navigate correctly and the sheet dismisses
- [ ] Bell no longer navigates anywhere on tap
- [ ] `/analytics` renders the filter bar defaulting to the current calendar month
- [ ] Switching to Custom mode lets you pick a from/to range with `from > to` prevented
- [ ] Overview shows Income/Expense/Net Saved with correct deltas vs the prior equivalent range
- [ ] Savings rate renders correctly and doesn't crash when income is 0
- [ ] `TrendChart` renders daily buckets for a month-length range and weekly buckets for a longer custom range
- [ ] Biggest transaction in range displays correctly, and the section handles zero transactions gracefully

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Transactions + Categories

### Goal
The Transactions and Categories segments render real data under the same shared filter: a permanent home for the trend chart plus a day-of-week pattern and averages, and a category donut + ranked list with period-over-period deltas.

### Before Starting — Confirm Phase 1 is Approved
- Re-read Phase 1's actual `useAnalyticsData`/`lib/analytics.js` shape as built (not as planned) before extending it
- Confirm `CategoryIcon.js`'s exported color/icon mapping to reuse for donut slice colors

### 1.1 Database
No database changes in this phase.

### 1.2 Data Layer

Extend `lib/analytics.js`:
- `computeDayOfWeek(transactions)` → `{ Mon: total, Tue: total, ... }` for expense transactions
- `computeCategoryBreakdown(transactions, type)` → array of `{ category, amount, pct }`, sorted descending
- `computeCategoryDeltas(currentBreakdown, priorTransactions, type)` → same shape plus `delta` per category, matched by `category_id`; a category present now but absent from the prior period gets `delta: null`, not a divide-by-zero

No changes to `useAnalyticsData` — Phase 1 already fetches everything this phase needs.

### 1.3 Components

```
components/
  DayOfWeekChart.js           — weekday bar chart
  DonutChart.js                — RN Views + react-native-svg category donut
```

- Transactions section: reuses `TrendChart` from Phase 1, adds `DayOfWeekChart`, adds an average-transaction-size + count row.
- Categories section: `DonutChart` + ranked list rows (name, amount, %, delta) + an Expense/Income toggle pill.

### 1.4 Navigation / Integration
`AnalyticsSegmentTabs` (built in Phase 1) now renders real content for the `Transactions` and `Categories` segments instead of a placeholder.

### 1.5 Impact on Existing Features
None — purely additive within `app/analytics.js`.

### 1.6 What This Phase Does NOT Include
- Budgets, Plans sub-tabs (Phase 3)

### 1.7 Phase 2 Checklist — Before Marking Complete
- [ ] Transactions segment shows the trend chart, day-of-week chart, and correct average/count for the filter range
- [ ] Categories segment shows a donut matching each category's existing brand color, and a ranked list with correct % and amounts
- [ ] Category deltas display correctly, including a category with no prior-period activity (no crash, shown as new rather than a bogus %)
- [ ] Expense/Income toggle switches the donut and list correctly
- [ ] An empty range (no transactions) shows a sensible empty state on both segments

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Budgets + Plans

### Goal
The Budgets and Plans segments render real data: budgets shown as a list of their own periods overlapping the filter range with a consistency badge, and plans shown with lifetime progress, range-scoped spend, and a pace projection.

### Before Starting — Confirm Phase 2 is Approved
- Re-read `useBudgets.js`'s `budgetStatus()` helper — reuse it rather than reimplementing healthy/warn/over logic
- Re-read `usePlans.js` / `v_plans_with_totals` for the exact shape of lifetime `total_spent`/`remaining` already available, so this phase doesn't recompute what the existing view already provides

### 1.1 Database
No database changes in this phase.

### 1.2 Data Layer

Extend `lib/analytics.js`:
- `computeBudgetPeriods(budget, transactions, from, to)` → array of `{ periodStart, periodEnd, spent, limit, status }` for every occurrence of the budget's own period (week/month) overlapping `[from, to]`, using `budgetStatus()` from `useBudgets.js` for `status`
- `computeConsistencyFlag(periods)` → `true` if the 2 most recent consecutive periods in the list are both `status === 'over'`
- `computeRangeSpentByPlan(plan, transactions)` → sum of transactions with `plan_id === plan.id` within `[from, to]`
- `computePlanPace(plan)` → `'on_track' | 'behind' | 'ahead' | null` from `(spent-to-date / days elapsed since start_date)` projected to `end_date` vs `target_amount`; `null` if `target_amount` or `end_date` is missing

### 1.3 Components
No new chart components — reuses `ProgressBar` and the existing healthy/amber/over visual states from `app/(tabs)/budgets.js`, and the progress-bar styling from Plan Detail (`app/plan/[id].js`).

### 1.4 Navigation / Integration
`AnalyticsSegmentTabs` now renders real content for `Budgets` and `Plans`.

### 1.5 Impact on Existing Features
None — purely additive, reuses existing visual states rather than changing them.

### 1.6 What This Phase Does NOT Include
- Any change to the live Budgets/Plans tab screens or their current-period-only behavior — Analytics is a read-only retrospective view alongside them, not a replacement

### 1.7 Phase 3 Checklist — Before Marking Complete
- [ ] Budgets segment lists, per budget, every period overlapping the filter range with correct spent/limit/status
- [ ] A budget exceeded in 2+ consecutive periods shows the consistency badge; one exceeded only once does not
- [ ] A budget created partway through the range only shows periods from its `created_at` onward
- [ ] Plans segment shows lifetime progress (matching Plan Detail's numbers) plus range-scoped spend
- [ ] Pace projection badge shows correctly for plans with both `target_amount` and `end_date`, and is cleanly omitted for plans missing either
- [ ] No console errors/crashes switching between all 5 segments repeatedly with both Month and Custom filter modes

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

No new tables, columns, or views. All Analytics data is derived from the existing `transactions`, `categories`, `budgets`, `plans` tables via `hooks/useAnalyticsData.js` + `lib/analytics.js`.

```
app/analytics.js
 ├─ AnalyticsFilterBar          ({from,to} state)
 ├─ AnalyticsSegmentTabs        (active segment state)
 └─ useAnalyticsData({from,to}) ──► lib/analytics.js pure functions ──► section components
```

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Home header | Avatar + new menu icon open `MenuSheet`; Bell becomes non-interactive | Phase 1 |
| Settings | Entry point moves to `MenuSheet` | Phase 1 |
| Budgets/Plans tabs | None — Analytics reads the same tables independently | None |

---

## Out of Scope (All Phases)

- Export/share of analytics (PDF, CSV, image) — not requested
- Any charting library — staying dependency-free (RN Views + `react-native-svg`) to match the app's hand-rolled visual style, per the approved data-approach decision
- Cross-plan or cross-budget aggregate views beyond what's listed per-section
- A 6th tab-bar entry for Analytics — deliberately placed in the menu sheet instead
