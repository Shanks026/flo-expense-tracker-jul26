# Analytics Section — Design

> Status: approved by user, pending spec review
> Date: 2026-07-11

## 1. Purpose

FLO currently has no dedicated place to see trends across transactions, categories, budgets, and plans — only per-screen snapshots (Home's 7-day chart, current-period budget cards, per-plan progress). This adds an **Analytics** section: one shared date filter driving detailed, per-domain graphs and derived insights (comparisons, savings rate, spending patterns, budget consistency, plan pace).

## 2. Navigation

- A new menu icon appears next to the notification bell on the Home header.
- Tapping it opens `MenuSheet` — a bottom sheet (built with `@gorhom/bottom-sheet`, matching the existing `AddTransactionSheet`/`AddBudgetSheet` pattern) listing destinations: **Analytics** and **Settings**.
- **Settings** moves here from its current avatar-tap entry point on Home, consolidating both into one hub. The avatar tap on Home no longer opens Settings directly.
- **Analytics** pushes a new route `app/analytics.js`.
- The bottom tab bar (Home · Transactions · ⊕ · Budgets · Plans) is unchanged — Analytics is a "dive deeper" destination, not a high-frequency one, so it doesn't need tab-bar real estate. Home's existing mini chart continues to serve the "quick glance" need.

## 3. Shared filter bar

Pinned at the top of `app/analytics.js`, below the screen header:

- **Month mode (default):** `‹ July 2026 ›` — same interaction as the existing month selector on the Transactions screen.
- **Custom mode:** a "Custom" pill switches to a from/to range picker using `@react-native-community/datetimepicker` (already a dependency), styled like the date pickers in `AddTransactionSheet`. If `from > to` is selected, the picker constrains/swaps rather than allowing an invalid range.
- Default on first open: current calendar month.
- The active `{from, to}` range is local state on `app/analytics.js` and is passed down to every sub-section — no new global context needed.

Below the filter bar: horizontal segmented pills — **Overview | Transactions | Categories | Budgets | Plans** — switching which section renders beneath, all reading the same `{from, to}`.

## 4. Section content

### Overview (default landing sub-tab)
- Hero row: Income / Expense / Net Saved for `{from, to}`, each with a delta vs the previous equivalent-length range (↑/↓ %, using existing `income`/`danger` color tokens).
- Savings rate: net saved ÷ income, as a percentage.
- Income vs Expense trend chart: daily buckets if the range is ≤ ~31 days, weekly buckets if longer. Visually generalizes the existing `IncomeExpenseChart` (currently hardcoded to a 7-day window).
- Biggest single transaction in the range (amount, category, date).

### Transactions
- The same trend chart as Overview — this is its permanent home regardless of range length (Overview only shows it when relevant to the summary).
- Day-of-week bar chart: total spend per weekday (Mon–Sun) aggregated across the range.
- Average transaction size and transaction count for the range.

### Categories
- Hand-built donut chart (RN `View`s + `react-native-svg`) of expense share by category, using each category's existing brand color/icon from `CategoryIcon.js`.
- Ranked list beneath: category name, amount, % of total, delta vs the previous equivalent range (e.g. "Food ₹4,200 · 32% · ↑ from ₹3,100").
- Toggle between Expense categories and Income categories (categories are typed `'income'`/`'expense'` in the schema).

### Budgets
Budgets are recurring by their own period (week or month) — they don't map cleanly onto an arbitrary filter range. Model:
- For each budget, list **its own periods that overlap the filter range** (e.g. filtering "July 2026" against a monthly budget → 1 row; against a weekly budget → ~4-5 rows). Each row shows spent/limit/remaining and the existing healthy/amber/over visual state.
- **Consistency badge:** shown on a budget if ≥2 consecutive periods in its list are over-limit — falls out of scanning the same per-period list, no separate query needed.

### Plans
A plan's lifetime progress and a range-scoped view serve different questions, so both are shown:
- **Lifetime progress bar** (spent vs target) — unaffected by the filter, matches what Plan Detail already shows. Meaningless to slice to an arbitrary sub-range.
- **Spent in this range** — a secondary figure per plan, respecting `{from, to}`, for trend context.
- **Pace projection badge** ("On track" / "Behind" / "Ahead"): compares `(spent-to-date ÷ days elapsed since start_date)` projected out to `end_date`, against `target_amount`. Always computed from full plan history (not the filter range). Omitted for plans missing `target_amount` or `end_date` — there's nothing to project against.

## 5. Data layer

**Approach: client-side aggregation** (not new Postgres views/RPCs). Rationale: this is a single-user tracker with modest per-range data volume (at most a few hundred transactions/month); fetching raw rows and aggregating in JS matches the existing `useDailyTotals.js` pattern exactly, needs no new SQL to hand-paste into the Supabase SQL editor (no SQL is committed to this repo and Supabase MCP isn't connected here), and keeps one consistent data-access style across the app.

- **`hooks/useAnalyticsData({from, to})`** — fetches:
  - `transactions` (joined `category`, `plan`) for `[from, to]`
  - `transactions` for the equivalent-length prior range (for deltas)
  - `budgets`, `plans`
  - Subscribes to `useDataRefresh` like every other data hook, so it stays live after edits elsewhere in the app.
- **`lib/analytics.js`** — pure functions consuming the fetched rows, with no Supabase calls inside them: trend bucketing, day-of-week aggregation, category share/delta computation, budget-period-list construction + consistency check, plan pace projection. Kept pure so each is easy to reason about independent of the network.

## 6. New components

- `MenuSheet.js` — bottom sheet listing Analytics / Settings
- `app/analytics.js` — screen shell: filter bar + segmented tabs + active section
- `AnalyticsFilterBar.js` — month/custom toggle + pickers
- `AnalyticsSegmentTabs.js` — Overview/Transactions/Categories/Budgets/Plans pills
- `DonutChart.js` — hand-built category donut (RN Views + `react-native-svg`)
- `TrendChart.js` — generalization of `IncomeExpenseChart` for variable-length ranges and daily/weekly bucketing
- `DayOfWeekChart.js` — weekday bar chart

Reused as-is: `Card`, `ProgressBar`, `AmountText`, `Pill`, category color/icon mapping from `CategoryIcon.js`.

## 7. Edge cases

- No transactions in range → existing empty-state pattern, per section ("No transactions in this period").
- Range with income but no expense (or vice versa) → charts render the zero side gracefully, same max-value handling already in `IncomeExpenseChart`.
- Custom range with `from > to` → picker constrains/swaps, never submits an invalid range.
- Plan missing `target_amount`/`end_date` → pace badge omitted; lifetime spent and range-scoped spent still shown.
- Budget created partway through the filter range → its period list only includes periods from its `created_at` onward.

## 8. Out of scope (for this iteration)

- Export/share of analytics (PDF, CSV, image) — not requested.
- Charting library adoption — deliberately staying dependency-free (RN Views + existing `react-native-svg`) to match the app's current hand-rolled visual style and avoid a second charting paradigm.
- Cross-plan or cross-budget aggregate views beyond what's listed above.
