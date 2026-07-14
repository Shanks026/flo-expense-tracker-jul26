# Feature: Weekly / Monthly Reports
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/11-reports.md`
**Status**: Phases 1–2 built · Phase 3 CSV export built (all bundle-verified; on-device pending) · PDF export deliberately deferred, user's explicit call (2026-07-14)
**Last Updated**: 2026-07-14

---

## Context

FLO already computes everything a report needs — it just never packages it as a
recurring, glanceable "here's your week." The Analytics screen
(`app/analytics.js` + `lib/analytics.js` + `useAnalyticsData({from,to})`) is a
full exploration tool with a **custom date-range mode already built**
(`AnalyticsFilterBar`). A report is that same data, pinned to the most recent
completed period, delivered on a schedule and told as a short story.

**This feature is ~70% assembly of existing parts.** A report stores nothing
derived (true to FLO's core principle): it is recomputed from `transactions` on
open. The only persisted state is *config* (cadence/day/time) and *"which report
you've already seen"* — both fit the existing device-scoped AsyncStorage
notification-settings pattern (`lib/notifications.js`), so **Phases 1–2 need no
database changes at all**.

**Settled during planning (2026-07-14):**

- **Report = curated single scroll, not a tabbed clone of Analytics.** It reads
  top-to-bottom in ~30 seconds: headline → stats → where it went → budgets →
  plans → notable transactions. Rebuilding tabbed analytics was explicitly
  rejected as duplication. (Originally this also ended in a "See full
  breakdown" link into Analytics; dropped once the report became all-accounts
  — see the scope reversal below — because Analytics stays per-account, so the
  two screens would show disagreeing numbers for the same range.)
- **The headline is a prior-period comparison, not a total.** "You spent 18%
  less than last week" (via the existing `computeDelta`) is the line that makes a
  report feel like insight. Lead with it.
- **The Home "report is ready" card is the reliable delivery channel; the push
  notification and in-app alert are best-effort nudges.** Local scheduled
  notifications are silently dropped by OEM battery killers (standing rule,
  `00-index.md`), so the feature must not depend on the push firing. The Home
  card appears whenever a report is due and unseen — guaranteed to work.
- **One active cadence: Off / Weekly / Monthly** (not both at once). Weekly
  reports on the prior Mon–Sun; monthly on the prior calendar month.
- **Reports are USER-scoped, covering ALL of the user's accounts — reversed
  2026-07-14.** Originally scoped per-active-account (matching Analytics); the
  user corrected this explicitly: "these should be user specific and not
  account specific... the reports should include all the account data in the
  selected time period." A report is a whole-life financial recap, not a
  per-ledger drill-down. **Analytics itself is untouched** — it stays scoped to
  `activeAccountId`, by design, for account-by-account exploration. The
  mechanism is already proven in this codebase: `useAllAccountSummaries`
  queries `v_global_summary` with no `account_id` filter and gets one row per
  account back for free, because RLS already scopes every query to the signed-in
  user — dropping a filter, not adding a join. Same move here.
- **Custom report generation, in addition to the scheduled one — both
  required** (user's explicit call, 2026-07-14: "we also need... custom report
  generation... what we discussed earlier is a scheduled report generation and
  notification. need both"). One report screen serves both: it always renders
  whatever `from`/`to` it's given; the scheduled surfaces (Home card, menu
  default, notification) hand it the current cadence period, and an in-place
  period switcher on the screen itself (presets + a custom date range) lets the
  user regenerate it for any period on demand. No second screen.
- **AI summary: deferred** (user's call — "skip AI for now"). The report is
  fully valuable computed. If revisited, it must be a server-side Supabase Edge
  Function over *aggregated* data, degrade gracefully, and gate the paid tier —
  see Out of Scope.

---

## Phase Overview

```
Phase 1 — The report, viewable in-app (the core value)
  Settings "Reports" card: cadence (Off/Weekly/Monthly) + day + time. A report
  screen (curated scroll) covering ALL of the user's accounts for a period,
  reusing an all-accounts variant of useAnalyticsData + lib/analytics.js + the
  charts, led by the prior-period delta. An in-place period switcher (presets +
  custom range) makes every report a custom report on demand. A Home "Your
  report is ready →" card when a report is due and unseen; mark-seen on open.
  No push, no export.

Phase 2 — Scheduled delivery
  Wire the cadence into lib/notifications.js (local, best-effort) and add a
  bell/in-app alert (useAlerts). The Home card remains the reliable fallback.

Phase 3 — Export
  CSV of a period's transactions — from BOTH the report and the Analytics
  screen — via expo-sharing + expo-file-system. Then PDF of the formatted
  report via expo-print.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — The Report, Viewable In-App ✅ Complete

### Goal

Pick a cadence in Settings (Off / Weekly / Monthly) with a day and time. When a
report is due, a card appears on Home — "Your weekly report is ready →" — that
opens a single-scroll report covering **every account you have**: a
prior-period headline, key stats, the category donut, budget and plan status
(across all accounts), and the biggest transactions. The report's own header
lets you switch the period at any time — quick presets (this/last week, this/
last month) or a custom date range — so the exact same screen doubles as
on-demand custom report generation. Reports can also be opened any time from
the Home menu.

### Before Starting — Confirm With Codebase

1. **`useAnalyticsData({from,to})`** (`hooks/useAnalyticsData.js`) — confirm its
   current return shape (`{ current, prior, budgets, plans }`) and its four
   queries' exact filters (transactions ×2, `v_budgets_with_spent`,
   `v_plans_with_totals`, all `.eq('account_id', activeAccountId)`). The report
   needs an **all-accounts variant**: add an `allAccounts` boolean param that,
   when true, drops all four `.eq('account_id', ...)` filters — RLS already
   scopes every query to the signed-in user, so dropping the filter is safe and
   returns all of the user's accounts' rows, exactly the move
   `hooks/useAllAccountSummaries.js` already makes on `v_global_summary`. Also
   switch the fetch-guard from `activeAccountId` to `userId` when `allAccounts`
   is true (same bug class as `useAllAccountSummaries`'s own comment — a
   guard tied to `activeAccountId` alone can't run when there's no "active"
   account concept in play). **`app/analytics.js`'s existing call must keep
   working unchanged** (`allAccounts` defaults to `false`) — this is an additive
   parameter, not a rewrite.
2. **`lib/analytics.js`** — confirm the exact signatures of `computeDelta`,
   `computeSavingsRate`, `computeCategoryBreakdown`, `computeBiggestTransaction`,
   `computeBudgetPeriods`/`budgetStatus`, `computePlanPace`, and how
   `app/analytics.js` assembles `donutSegments`/`totalIncome`/`totalExpense`
   (via `sumByType`). All of these are pure functions over a transactions/
   budgets/plans array — they don't know or care whether the array spans one
   account or all of them, so they need **no changes**; only the query layer
   (#1) does.
3. **`useAccount()`** (`lib/AccountContext.js`) — confirm it exposes `accounts`
   (the full list, with `name`/`color`). The report's Budgets/Plans sections need
   this to label each row by account ("Groceries · Personal") since an
   all-accounts list can otherwise show two identically-named budgets from
   different accounts with no way to tell them apart.
4. **`app/analytics.js`** — confirm how its `custom` mode reads the range
   (state `mode`/`customFrom`/`customTo`). The report screen's own period
   switcher is a **new, separate** small component (below) — it does not reuse
   `AnalyticsFilterBar` directly (that component is Analytics-specific, with a
   month-stepper mode the report doesn't need), but mirrors its custom-range
   `DateTimePicker` pattern.
5. **`lib/notifications.js`** — confirm the AsyncStorage settings pattern
   (`KEYS`, `getNotificationSettings`, per-setting setters). Report config
   follows the same shape (new `lib/reports.js`, its own key, same idea).
6. **`app/(tabs)/index.js`** — confirm the Home section pattern (the upcoming-
   bills card is the model for the new "report ready" card) and that
   `useDataRefresh` version drives re-reads.
7. **`components/MenuSheet.js`** — confirm the row shape to add a permanent
   "Reports" entry (the Home card is conditional, so reports need a always-there
   entry point too).
8. **`date-fns`** — `startOfWeek`/`endOfWeek` (with `weekStartsOn: 1`, matching
   `computeTrend`/budgets), `startOfMonth`/`endOfMonth`, `subWeeks`/`subMonths`.

### 1.1 Database

**No database changes in this phase.** Report config and the "last seen" marker
live in AsyncStorage (device-scoped, exactly like the daily/bill reminder
settings). A report's contents are recomputed from `transactions` on open —
nothing derived is stored.

### 1.2 Data Layer

**`lib/reports.js`** (new) — report config + period math + seen-state:

```js
// Config (AsyncStorage, key 'flo.reports.settings'), same pattern as notifications:
getReportSettings()  → { cadence: 'off'|'weekly'|'monthly', weekday: 0-6, dayOfMonth: 1-31, hour, minute }
setReportSettings(partial)
DEFAULT_REPORT_SETTINGS = { cadence: 'off', weekday: 1 /* Mon */, dayOfMonth: 1, hour: 9, minute: 0 }

// Period math (pure, injected `now`, testable — mirrors lib/streak.js's style):
currentReportPeriod(settings, now) → { from, to, label } | null
  // The most recent COMPLETED period as of `now`:
  //   weekly  → prior Mon–Sun (startOfWeek/endOfWeek, weekStartsOn:1)
  //   monthly → prior calendar month (startOfMonth/endOfMonth of subMonths(now,1))
  // label e.g. "6–12 Jul" or "June 2026".

reportDueMoment(settings, now) → Date | null
  // The chosen day+time this cadence should surface the report:
  //   weekly  → most recent `weekday` at hour:minute
  //   monthly → `dayOfMonth` (clamped to the month's last day) at hour:minute

// Seen-state (AsyncStorage, key 'flo.reports.lastSeenAt.{userId}' — USER-SCOPED
// per the standing AsyncStorage rule; a shared device has >1 account):
getLastReportSeen(userId) / setReportSeen(userId, iso)
isReportDue(settings, userId, now) → boolean
  // cadence !== 'off' AND now >= reportDueMoment AND lastSeen < reportDueMoment
```

- **`dayOfMonth` clamping**: a "31st" cadence in February surfaces on the 28th/
  29th — clamp to the month's last day. Comment it.
- **Seen-state is user-scoped** (`{userId}` suffix) — the exact bug class fixed
  for the streak celebration key (`00-index.md`): a shared device has multiple
  accounts.

**`useAnalyticsData({ from, to, allAccounts })`** (extended, not replaced) — add
the `allAccounts` param described above. When `true`:
- The four queries (`current`, `prior`, `v_budgets_with_spent`,
  `v_plans_with_totals`) drop their `.eq('account_id', ...)` filter.
- The fetch-guard and the `refetch` dependency switch from `activeAccountId` to
  `userId` (via `useAuth()`), matching `useAllAccountSummaries`'s own reasoning —
  there's no single "active account" gate to wait on when the query spans all of
  them.
- Default `allAccounts = false`, so `app/analytics.js`'s existing call
  (`useAnalyticsData({ from, to })`) is **unchanged** in behaviour.

The report screen calls `useAnalyticsData({ from, to, allAccounts: true })`. No
new analytics hook, no new view — same four queries, one added parameter.

### 1.3 Components

```
app/report.js                     The report screen (pushed route, curated scroll)
components/ReportReadyCard.js      The Home "Your report is ready →" card
components/ReportPeriodPicker.js   Inline period switcher (presets + custom range)
lib/reports.js                     Config + period math + seen-state (above)
```

**`app/report.js`** — accepts optional `from`/`to` route params, held in local
state (`period`) so they can change in place; defaults to `currentReportPeriod`
for the active cadence (falls back to last week if cadence is off, so the
screen is always viewable from the menu or with a custom range). Marks the
*current default* period seen on mount (`setReportSeen`) — switching to a custom
range via the picker does **not** re-trigger "seen" bookkeeping, since that
tracks the scheduled cadence, not ad-hoc browsing. A single `ScrollView`:

- **Header**: "Report" + the period label + a `ReportPeriodPicker` trigger
  (pencil/chevron next to the label) to change the range in place.
- **Headline card**: net spend for the period + the **delta vs the prior period**
  (`computeDelta`) rendered as "18% less than last week" with up/down colour.
- **Stat row**: Spent · Received · Net · Savings rate (reuse `computeSavingsRate`).
- **Where it went**: `DonutChart` + ranked category list (same assembly as
  Analytics / Plan Detail Phase 3), hidden below 2 categories.
- **Budgets**: each active budget's status for the period, **across all
  accounts** (reuse `computeBudgetPeriods`/`budgetStatus` + `ProgressBar`), each
  row labelled with its account name/colour dot (from `useAccount().accounts`) so
  two same-named budgets in different accounts stay distinguishable; a "no
  budgets" line if none.
- **Plans**: active plans' pace (`computePlanPace`) + spent, across all accounts,
  same per-row account label; omitted if none.
- **Notable**: the biggest transaction(s) (`computeBiggestTransaction`), each
  showing which account it belongs to.
- Empty/quiet period: a gentle "A quiet week — ₹0 spent" state, never an error.
- **No "See full breakdown" link to Analytics this round** — Analytics is
  deliberately per-active-account (untouched by this feature), so a link from an
  all-accounts report into a single-account screen would show disagreeing
  numbers for the same range with no explanation. The report's own sections
  already are the full breakdown, across every account. (If a future need wants
  Analytics to gain its own all-accounts mode, that's a separate decision — see
  Out of Scope.)

**`components/ReportPeriodPicker.js`** — the piece that makes every report a
custom report. A small popover/sheet (follow the existing inline-dropdown
pattern used for the plan/account pickers in `AddTransactionSheet`, not a new
bottom sheet) with:
- Preset rows: **This week / Last week / This month / Last month** (computed
  with the same `date-fns` helpers as `lib/reports.js`'s period math — reuse,
  don't reimplement).
- A **Custom** row that reveals two `DateTimePicker` fields (`From`/`To`),
  mirroring `AnalyticsFilterBar`'s custom-range UI exactly (same field styling),
  but as its own small component — `AnalyticsFilterBar` also carries a
  month-stepper mode this picker doesn't need, so it isn't reused directly.
- Calls back with `{ from, to, label }`; the report screen just sets its local
  `period` state — `useAnalyticsData` refetches automatically since it depends
  on `from`/`to`.

**`components/ReportReadyCard.js`** — the Home card, shown only when
`isReportDue(...)`. Tapping opens `/report`. Styled like the existing Home
section cards (the upcoming-bills card is the model).

### 1.4 Navigation / Integration

- **Home** (`app/(tabs)/index.js`): render `<ReportReadyCard />` (conditional).
- **MenuSheet**: a permanent "Reports" row → `/report` (the Home card is
  conditional, so this is the always-available entry point).
- **Settings**: a new "Reports" card (see 1.3-adjacent) — cadence segment
  (Off/Weekly/Monthly), a day picker (weekday chips when weekly; a day-of-month
  stepper/field when monthly), and a time picker (`DateTimePicker`). Reuses the
  custom `Switch`/segment + `DateTimePicker` patterns already in Settings.

### 1.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `useAnalyticsData` | Gains an `allAccounts` param (default `false`) | `app/analytics.js`'s existing call must keep behaving identically — verify by diffing its output before/after this change with the flag omitted |
| `app/analytics.js` | **None** — stays per-`activeAccountId`, deliberately | Don't be tempted to also add an all-accounts mode here; not asked for, and the report's lack of an Analytics link (1.3) depends on the two staying distinct |
| Home | +1 conditional card | Only when `isReportDue`; must not push other sections around when absent |
| MenuSheet | +1 row | Same row pattern as Analytics/Settings |
| Settings | +1 card | Reuse the Switch/segment/DateTimePicker patterns |
| Everything else | None | Feature is additive; zero schema change |

### 1.6 What This Phase Does NOT Include

- No push notification / in-app alert (Phase 2).
- No export (Phase 3).
- No AI summary (deferred — see Out of Scope).
- No all-accounts mode on the Analytics screen itself — only the report gets one.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] Settings "Reports" card sets cadence/day/time; persists in AsyncStorage
      and reloads correctly *(cadence segment Off/Weekly/Monthly, weekday chips,
      day-of-month stepper clamped 1–31, time `DateTimePicker` — same shape as
      the Daily Reminder card)*
- [x] `currentReportPeriod` returns the correct prior week (Mon–Sun) / prior
      month; `dayOfMonth` clamps in short months — **verified numerically** with
      injected `now` values (weekly Mon/Wed cases, monthly 31st-in-Feb clamp,
      31st-just-past-Feb-due-date case) — all correct
- [x] `useAnalyticsData({..., allAccounts: true})` returns rows from **every**
      account the user has, not just the active one — confirmed against the live
      DB: the test user has 3 accounts / 33 transactions in July; dropping the
      `account_id` filter (exactly what `allAccounts` does) returns all of them
- [x] `useAnalyticsData({from,to})` (no `allAccounts`) — i.e. `app/analytics.js`'s
      existing call — is unchanged: `allAccounts` defaults to `false`, and that
      branch's query shape (four `.eq('account_id', activeAccountId)` calls) is
      byte-for-byte what it was before this phase
- [x] The report screen renders the headline delta, stats, donut (≥2 cats),
      budget status, plan pace, and biggest transaction — summed across all
      accounts, each budget/plan/transaction row labelled with its account
      *(code path verified; on-device render pending)*
- [x] The `ReportPeriodPicker` presets (this/last week, this/last month) and a
      custom range all correctly update the report in place, no navigation
- [x] A quiet period shows the gentle empty state (headline area reads "A quiet
      period — nothing logged" when both current and prior windows are empty),
      not an error
- [x] The Home card appears only when `isReportDue`, opens `/report` at the
      cadence's default period, and marks it seen (card disappears until the
      next period); switching to a custom range from the picker does not affect
      seen-state (mark-seen only fires when the viewed range matches the
      settings-derived default period, verified by comparing timestamps)
- [x] Seen-state key is user-scoped (`{userId}`)
- [x] "Reports" is reachable from the Menu sheet at any time, and works even
      when cadence is Off (defaults to last week, picker still works)
- [x] `npx expo export --platform android` bundles clean (7.8 MB, no errors)

### 1.8 Implementation Notes (2026-07-14)

- **`lib/reports.js`** — config (`getReportSettings`/`setReportSettings`,
  AsyncStorage), `formatPeriodLabel` (smart: "MMMM yyyy" for an exact calendar
  month, else a compact day range), `currentReportPeriod`, `reportDueMoment`
  (weekday/day-of-month → most-recent-occurrence-at-or-before-now, with
  short-month clamping), and user-scoped seen-state
  (`flo.reports.lastSeenAt.{userId}`). **All period/due-moment math verified
  numerically** with injected dates before being wired into any UI — weekly
  Monday/Wednesday-today cases, and the monthly 31st-clamp-in-February edge
  case (and the "just past Feb's clamped due date" follow-on case) all
  resolved correctly.
- **`hooks/useAnalyticsData.js`** gained `allAccounts` (default `false`). When
  true, all four queries drop `.eq('account_id', ...)` and the fetch-guard/
  dependency switches from `activeAccountId` to `userId` — the same move
  `useAllAccountSummaries` already makes on `v_global_summary`, since RLS
  already scopes every query to the signed-in user. **Verified against the live
  DB**: the test user's 3 accounts / 33 July transactions all come back when the
  filter is dropped; `app/analytics.js`'s existing call (no `allAccounts`
  passed) is untouched.
- **Real cross-account leak caught and fixed before it could ship**: categories
  are global (not account-scoped), so `computeBudgetPeriods` — which filters
  transactions by `category_id` but never by `account_id` — would let a budget
  in one account silently sum another account's spending in the same category,
  once `current` spans all accounts. `app/report.js` pre-filters
  `current` to each budget's own `account_id` before calling
  `computeBudgetPeriods`. **Verified against the live DB** with a temporary
  cross-account test (a second account's "Food" expense alongside an existing
  Axis "Food" budget): the naive all-accounts sum was inflated by exactly the
  other account's amount; the account-pre-filter excluded it precisely. No
  change was needed to `lib/analytics.js` itself — `computeRangeSpentByPlan` is
  already safe (a transaction's `plan_id` uniquely identifies one plan/account,
  so no analogous leak exists for plans).
- **Headline generalizes "than last week" to "than the previous period"** —
  since the period can now be an arbitrary custom range (not just a scheduled
  week/month), a period-specific phrase would be wrong for a custom report.
- **No live link to Analytics** from the report screen, per the doc's scope
  decision — Analytics stays per-active-account, so linking an all-accounts
  report into it would show disagreeing numbers for the same range.
- **Entry points**: a conditional `ReportReadyCard` on Home (between the trend
  chart and Upcoming Bills), a permanent "Reports" row in `MenuSheet` (between
  Analytics and Bills), and the new "Reports" card in Settings (between
  Notifications and Transaction Detection).
- **On-device still pending** (no Android SDK/device here): actually viewing
  the report screen's render, the period picker's UI, and the Home card's
  live appearance/disappearance across a real due/seen cycle. The data layer
  (queries, period math, the leak fix) is DB-verified; the UI is bundle-verified
  only.

### 1.9 UX Revision (2026-07-14, post first on-device look)

User feedback after seeing Phase 1 render: needed the period picker to show
which option is currently selected, the resolved date range to be visible
separately from the preset name, and — the bigger addition — a way to see a
specific account's report rather than only the "All" combined view. Two
designs were discussed for the account piece (per-account pills that toggle a
account *out* of the combined view, vs. tabs that *switch* the whole report to
one account); the user explicitly preferred tabs ("this is better"), so that's
what was built. Both changes are UX-only — no new query, no schema change:

- **`lib/reports.js`** gained `reportPeriodPresets(now)` (the four presets —
  This/Last week, This/Last month — as one shared source of truth) and
  `matchPeriodPreset(period, presets)`. `ReportPeriodPicker.js` and
  `app/report.js` both import these rather than each computing their own
  preset list, so the picker's highlight and the header's trigger label can
  never disagree about what's currently selected.
- **`ReportPeriodPicker`** now takes a `value` prop and highlights whichever
  option (a preset, or "Custom range") matches it with a checkmark — the
  "indicate which selection is selected" ask. Checkmark colour is
  `colors.income` (not `colors.brand`): brand lime is a dark-background/icon
  accent everywhere else in this app, and reads as low-contrast text on this
  picker's white surface — caught before shipping, not after.
- **The report header now shows the date range as its own line**, separate
  from the preset-name trigger chip: e.g. a chip reading "Last month" beside
  plain text reading "1–30 Jun 2026" — previously both were folded into one
  string.
- **Account tabs**: "All" + one tab per account, rendered only when the user
  has more than one account. Selecting a tab is a **pure client-side filter**
  over the data `useAnalyticsData({allAccounts:true})` already fetched — no
  second query, instant switching. Implemented as `scopedCurrent`/
  `scopedPrior`/`scopedBudgets`/`scopedPlans` (`useMemo`, filtered by
  `account_id` when not "All") feeding every downstream computation. The
  per-row account tag (name + colour dot) is hidden whenever a specific account
  is selected — it only disambiguates in "All" mode, where it's needed.
- **Verified against the live DB**: confirmed the test user's 3 accounts each
  have real July transactions (24/5/4 rows) before calling this done, so
  switching tabs on-device will show visibly different, non-empty content per
  account rather than looking broken on an untested tab.
- `npx expo export --platform android` bundles clean (7.8 MB, no errors).

### 1.10 Layout Fix (2026-07-14, real on-device screenshot)

The user's on-device screenshot showed a large empty gap between the account
tabs and the first card, plus asked for the date-selection UI itself to be
redesigned as its own card (range on the left, a select-style control on the
right).

- **Root cause of the gap**: the account-tabs `<ScrollView horizontal>` had
  been placed as a **sibling before** the main vertical `<ScrollView>`, rather
  than nested inside it — a different structural pattern from every other
  horizontally-scrolling chip row in this codebase (e.g. the category chips in
  `AddTransactionSheet`, which scroll *inside* the sheet's outer
  `BottomSheetScrollView`). Restructured so the date card, the period picker,
  and the account tabs are now all the first children **inside** the one
  scrollable container — matching the proven pattern — instead of fixed
  siblings above it.
- **Date-selection redesigned as its own `Card`**: `dateCard` — the resolved
  range ("6–12 Jul 2026") on the left, a pill-styled selector showing the
  active preset name ("Last week ▾") on the right; tapping the selector opens
  `ReportPeriodPicker` directly below the card. Replaces the old header-embedded
  chip+subtext version from 1.9. The bare header is now just back button +
  "Report" title.
- **Fixed a latent double-padding bug** caught while restructuring: the account
  tabs' `contentContainerStyle` had its own `paddingHorizontal: spacing.xl`,
  which — now that the row lives inside the outer scroll's own
  `paddingHorizontal: spacing.xl` — would have inset the pills twice. Fixed with
  the standard "negative margin on the ScrollView, matching padding on its
  content" trick, so the tabs bleed to the screen edge while the pills
  themselves stay aligned with every other card.
- `npx expo export --platform android` bundles clean.

### 1.11 Picker Interaction Redesign (2026-07-14)

`ReportPeriodPicker` went through two shapes before landing:

1. **Inline-expanding panel** (original) — rejected: opening/closing it pushed
   every card below up and down, reading as broken layout, not a picker.
2. **Bottom sheet** (`@gorhom/bottom-sheet`, matching every other sheet in this
   app) — rejected by the user for a structural reason specific to this
   control: the period *trigger* sits at the **top** of the report screen, but
   a bottom sheet biases its content toward the bottom of the screen — an
   awkward pairing, and there was real risk of options landing outside a short
   snap point on smaller screens.
3. **Centred dialog (RN's `Modal`, transparent + fade)** — what shipped.
   Matches a pattern this codebase already has (`app/settings.js`'s
   delete-account confirmation): a dark 55%-opacity overlay, tap-outside to
   dismiss, a light `colors.surface` card sized to its own content (no fixed
   snap-point height to overflow). `ReportPeriodPicker` reverted to the
   simple `open`/`value`/`onClose`/`onChange` prop shape (no ref, no
   `forwardRef` — that machinery belonged to the rejected sheet version).

- **Each preset row now also shows its resolved date range** (e.g. "Last
  week" / "Jul 06 – Jul 12"), not just the label — a direct user ask, so you
  can tell exactly what a preset means before selecting it, not just its name.
- **Re-confirmed the light/dark contrast rule from 1.9 while rebuilding**: the
  bottom-sheet draft (dark `colors.ink` background) correctly used
  `colors.brand` for its active-checkmark/text, since brand lime is a
  dark-surface accent — but reverting to the light `Modal` card meant reverting
  that colour back to `colors.income` too, or it would have reintroduced the
  exact low-contrast-on-white bug caught in 1.9. Caught before shipping.
- `npx expo export --platform android` bundles clean.
- **Still on-device pending**: confirming the dialog's position/sizing reads
  well relative to the top-anchored trigger, and that the gap fix from 1.10
  holds.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Scheduled Delivery ✅ Complete

### Goal

On the chosen day/time, FLO fires a local heads-up notification ("Your weekly
report is ready") and adds a bell/in-app alert — both nudges to open the report.
The Home card from Phase 1 remains the reliable source of truth if the OS drops
the alarm.

### Before Starting — Confirm Phase 1 is Approved

1. `lib/notifications.js` — `rescheduleAll()`, the channel list, and how the
   daily reminder schedules a repeating local notification. The report reuses
   this exactly (a new schedule entry, likely on the `recap` channel).
2. `lib/alerts.js` / `hooks/useAlerts` — how an in-app alert is produced, to add
   a "report ready" alert.
3. The standing rule on best-effort local notifications (`00-index.md`) — set
   expectations; the push may not fire on aggressive OEM skins. Not a bug.

### 2.1 Database

No database changes.

### 2.2 Data Layer

- Extend `rescheduleAll()` to also schedule the report notification from
  `getReportSettings()` (weekly → a weekly trigger on `weekday` at `hour:minute`;
  monthly → the nearest supported repeating trigger, or a rolling re-schedule
  like bills use if a true monthly trigger isn't available — decide by reading
  what `expo-notifications` supports in this SDK).
- The notification tap opens FLO; the Home card / `/report` does the rest (no
  deep-link path juggling — same approach as `06-...md`'s "Log it").
- Add a "report ready" in-app alert via the existing alerts mechanism.

### 2.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `lib/notifications.js` | +1 scheduled item, re-scheduled on settings change | Must re-run `rescheduleAll` when report settings change (same as daily reminder) |
| Alerts / bell | +1 alert type | Don't collide with existing alert keys |

### 2.6 What This Phase Does NOT Include

- Export (Phase 3), AI (deferred).

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] Changing report settings re-schedules; turning cadence Off cancels it —
      `persistReportSettings` now calls `sync()` (→ `rescheduleAll`) after every
      persist, mirroring `handleToggleDaily`/`handleTimeChange` exactly;
      `doRescheduleAll` cancels everything first, then only re-schedules a
      report notification if `cadence !== 'off'`, so Off correctly leaves
      nothing scheduled
- [x] On the due day/time a heads-up notification fires — implemented via
      genuine repeating `WEEKLY`/`MONTHLY` OS triggers (not a rolling
      reschedule — confirmed both exist in the installed `expo-notifications`
      version's type defs). **On-device confirmation still needed** (no
      Android SDK here); best-effort per the standing OEM battery-killer rule
- [x] A bell/in-app alert appears for a due report — `useAlerts` now includes a
      live `report` entry (via the shared `useReportDue` hook) with a new
      `info` severity tier, sorted after danger/warn
- [x] Tapping the notification opens FLO and the report is reachable/marked
      seen — `data: { route: '/report' }` reuses the existing
      `useNotificationSync` tap-routing (no queue-drain needed, unlike the
      native auto-detect module); `/report` with no params already resolves
      and marks-seen the current default period (Phase 1 behaviour)
- [x] `npx expo export --platform android` bundles clean (7.81 MB); `npx tsc
      --noEmit` passes

### 2.8 Implementation Notes (2026-07-14)

- **Real weekday-numbering bug caught before shipping**: `expo-notifications`'s
  `WeeklyTriggerInput.weekday` uses **1–7 with 1 = Sunday** (confirmed against
  the installed `0.32.17` type defs, not assumed) — completely different from
  `lib/reports.js`'s own `weekday` field, which follows JS `Date#getDay()`
  (0=Sun..6=Sat), already used throughout this feature. A silent mismatch here
  would have scheduled the weekly push on the wrong day with no obvious
  symptom. Added `toExpoWeekday(jsWeekday) = jsWeekday + 1` as one named,
  documented conversion point in `lib/reports.js`, used only where the native
  trigger is built.
- **Both `WEEKLY` and `MONTHLY` are genuine repeating OS triggers** — simpler
  than the doc anticipated ("a rolling re-schedule like bills use if a true
  monthly trigger isn't available"). Verified directly against the installed
  package's type definitions rather than assumed; no rolling reschedule needed.
  **Known, documented limitation**: `MonthlyTriggerInput.day` doesn't clamp for
  short months the way `reportDueMoment()` deliberately does (31→28/29/30) — a
  day-31 cadence simply won't fire the push in Feb/Apr/Jun/Sep/Nov. The Home
  card and bell alert are computed independently via `reportDueMoment` and stay
  correct regardless, so this only ever affects the best-effort push, never the
  reliable channel — consistent with the feature's own stated design.
- **Extracted `hooks/useReportDue.js`** from `ReportReadyCard`'s original inline
  effect once a second consumer (`useAlerts`) needed the identical live
  due-check — avoids the two ever silently drifting on what "due" means.
  `ReportReadyCard` now just calls the hook; no behaviour change.
- **`useAlerts` gained a live `report` entry**, sourced from `useReportDue()` —
  consistent with the hook's own stated philosophy ("nothing is stored... a
  live, computed alert feed"), just backed by AsyncStorage instead of a
  Supabase hook like every other alert source. Required a **new severity tier,
  `info`** (`SEVERITY_ORDER` gained a third slot, sorting after danger/warn):
  the existing severity model was strictly binary (danger/warn), and a report
  being ready is good news, not a problem — forcing it through `warn` would
  have painted an amber "something's wrong" tone on an "here's your summary"
  notice. `AlertsSheet.js` reuses that same file's own established
  neutral-positive combo (brand lime icon on an `inkCard` tile — the same pair
  already used for its "you're all caught up" empty state) for the `info` tone,
  rather than inventing a new one.
- **Report notification is gated by the global "Notifications" master
  toggle**, same as bill reminders and the daily reminder (`doRescheduleAll`'s
  existing `if (!settings.enabled) return` covers the new code too, since it's
  textually after that guard) — a user who's turned off all notifications
  shouldn't still get a report push. The Home card / bell are unaffected by
  this toggle (they're in-app, not OS pushes).
- **Real stale-settings gap caught and fixed**: Phase 1's `persistReportSettings`
  only wrote to AsyncStorage and updated local state — nothing told
  `useNotificationSync` to re-run `rescheduleAll` with the new cadence/day/time
  until the next cold start. This is the exact stale-settings bug class already
  documented for the daily reminder (`lib/notifications.js`'s own comment on
  `rescheduleAll`). Fixed by having `persistReportSettings` call the same
  `sync()` helper `handleToggleDaily`/`handleTimeChange` already call.
- **Tap-routing needed no new code**: `data: { route: '/report' }` on the
  scheduled content is enough — `useNotificationSync`'s existing tap listener
  already does `router.push(route)` for any notification carrying route data
  (bills and the daily reminder work the same way). No queue-drain step like
  `06-transaction-auto-detect.md`'s native module needs, since this is a
  JS-scheduled notification with a live route already attached to its content.
- **Verification boundary**: no Android SDK/device in this environment, so the
  actual native scheduling, the heads-up appearance, and the tap behaviour are
  unverified beyond what's checkable without one. What *was* verified: the
  trigger field names/conventions against the installed package's real type
  definitions (not memory or generic docs), `npx expo export` bundling clean,
  and `npx tsc --noEmit` passing with no errors.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Export 🚧 CSV Complete · PDF Deliberately Deferred

### Goal

Export a period's transactions as CSV — from the report *and* the Analytics
screen — via the OS share sheet. Then a formatted PDF of the report.

### Before Starting — Confirm Phase 2 is Approved

1. Confirm `expo-sharing` + `expo-file-system` (and later `expo-print`) install
   cleanly and whether they need a dev build (they're native → yes; the app
   already ships one). Add via `npx expo install`.
2. Confirm the exact transaction fields to export and the money/date formatting
   helpers (`lib/money.js`, `date-fns`).

### 3.1 Database

No database changes.

### 3.2 Data Layer

**`lib/export.js`** (new):

```js
buildTransactionsCsv(transactions, accounts, categories) → string
  // date, type, amount, category, account, plan, note — one row each,
  // transfers included with their transfer label; header row; CSV-escaped.
shareCsv(filename, csv)   // write to FileSystem cacheDirectory, Sharing.shareAsync
sharePdf(filename, html)  // expo-print printToFileAsync → Sharing.shareAsync (PDF sub-phase)
```

### 3.3 Components

- An **Export** action (button/row) on `app/report.js` and on `app/analytics.js`
  — CSV for the currently-shown period. PDF export on the report (sub-phase 2).
  **Scope follows the screen it's exported from**: the report's CSV covers all
  accounts (matching what's on screen); Analytics' CSV stays scoped to the
  active account (matching what's on screen there). The `account` column in
  `buildTransactionsCsv`'s output is what makes an all-accounts export legible.

### 3.6 What This Phase Does NOT Include

- Scheduled/emailed exports; cloud backup; AI.

### 3.7 Phase 3 Checklist — Before Marking Complete

- [x] CSV export from the report and Analytics produces a correct,
      spreadsheet-openable file via the OS share sheet — **verified the CSV
      builder's actual output** with representative data (comma-containing
      note, embedded double-quotes, a transfer pair, an uncategorized income
      row): 6 lines, RFC-4180 escaping correct on both the comma and the
      embedded-quote case. **On-device share-sheet confirmation still
      needed** (no Android SDK here)
- [x] Transfers export with a sensible label; money/dates formatted
      consistently — confirmed in the same test: `Transfer Out`/`Transfer In`
      type labels, `Transfer to X`/`Transfer from X` in the Category column
      (mirroring how the UI itself already substitutes a transfer's label
      wherever a category name would go); `Amount` is a plain unformatted
      number and `Date` is the raw `yyyy-MM-dd`, deliberately **not**
      `lib/money.js`'s `formatMoney` / a display-formatted date — a
      spreadsheet needs real numeric/sortable values, not display strings
- [ ] **PDF export — deliberately deferred, user's explicit call (2026-07-14).**
      CSV covers the practical need; revisit only if a polished shareable
      report document is actually wanted later — it's a third native
      dependency (`expo-print`) and its own layout/design task, not a small
      addition on top of CSV
- [x] `npx expo export --platform android` bundles clean (7.84 MB); `npx tsc
      --noEmit` passes; `npx expo prebuild --clean` succeeds with no new
      Android permissions introduced by `expo-sharing`/`expo-file-system`

### 3.8 Implementation Notes (2026-07-14)

- **Real API-version bug avoided by checking before writing code, exactly the
  discipline `AGENTS.md` asks for**: `expo-file-system` rewrote its entire API
  in v19 (the installed version here) around `File`/`Directory`/`Paths`
  classes. The old string-path functions (`writeAsStringAsync`,
  `getInfoAsync`, etc.) **still exist as exports** from the main package —
  they're not gone, just replaced with deprecated stubs whose own doc comment
  says they **throw at runtime** unless imported from `expo-file-system/legacy`.
  Had I written the doc's originally-sketched `FileSystem.cacheDirectory` +
  `writeAsStringAsync` code from memory, it would have bundled/compiled fine
  and crashed on first real export. Caught by reading this installed version's
  actual `.d.ts` files before writing `lib/export.js`, not by trusting
  training-data memory of an older Expo SDK. Used the current `File`/`Paths`
  API instead (`new File(Paths.cache, filename).write(csv)` — note `.write()`
  is **synchronous**, not a Promise, in this API).
- **`lib/export.js`** ships `buildTransactionsCsv(transactions, accounts)` —
  simplified from the doc's sketched three-arg signature
  (`transactions, accounts, categories`): every transaction row already
  arrives with `category`/`plan` embedded via `useAnalyticsData`'s join
  (`select('*, category:categories(*), plan:plans(*)')`), so a separate
  `categories` lookup array was never actually needed once the real data
  shape was checked. `shareCsv(filename, csv)` writes to `Paths.cache` and
  hands off to `Sharing.shareAsync` — nothing persisted beyond the OS's own
  cache lifecycle, mirroring the app's "nothing stored that can be recomputed"
  principle for anything export-adjacent too.
- **Verified the CSV builder's actual output**, not just read the code — a
  standalone test with a comma-containing note, a note with embedded
  double-quotes, an uncategorized income row, and a full `transfer_out`/
  `transfer_in` pair confirmed correct RFC-4180 escaping and correct transfer
  labelling on both legs (`Transfer to Test 2` / `Transfer from Personal`).
- **Export button on both screens** — a small circular `Download` icon button
  in the header (matching the existing back-button's circular style), with an
  inline `ActivityIndicator` swap while exporting and a toast on failure/
  unsupported-platform, reusing this app's existing Toast convention rather
  than `Alert.alert` (this isn't a destructive confirmation).
- **Export scope explicitly follows what's on screen, per the doc's own
  decision**: the report's export respects the current account-tab selection
  (`scopedCurrent` — "All" or one account, whichever is active when Export is
  tapped); Analytics' export stays scoped to `activeAccountId` like everything
  else on that screen. Neither needed new state — both reuse data the screen
  already had.
- **No new Android permissions** — confirmed via `npx expo prebuild --clean`
  and diffing the regenerated manifest: `expo-sharing`/`expo-file-system` use
  scoped app-private storage and content-URI sharing on modern Android,
  requiring nothing beyond what's already declared.
- **PDF export (`sharePdf`, via `expo-print`) was not built this round** —
  the doc's own CSV/PDF split ("CSV first, PDF later" was the user's original
  scope decision when Phase 3 was planned) plus the fact that the PDF section
  of the doc was always far less specced than CSV's (a one-line function
  stub vs. a concrete signature). Rather than install a third native
  dependency and build a formatted-HTML-report-to-PDF pipeline from a vague
  spec, stopped here for an explicit go/no-go on PDF specifically.
- **Verification boundary**: no Android SDK/device in this environment, so the
  actual OS share sheet, the shared file's appearance in Excel/Sheets/Mail,
  and real on-device export are unverified beyond what's checkable without
  one. What *was* verified: the CSV builder's real output (above), the
  installed `expo-file-system`/`expo-sharing` APIs against their actual type
  definitions (not memory), `npx expo export`/`tsc --noEmit`/`expo prebuild
  --clean` all clean, and no new native permission surface.

**→ Stop here. CSV is done; PDF needs an explicit go-ahead before starting.**

---

## Data Model Summary (Final State After All Phases)

```
NO SCHEMA CHANGES.

AsyncStorage (device-scoped, same pattern as lib/notifications.js):
  flo.reports.settings              { cadence, weekday, dayOfMonth, hour, minute }
  flo.reports.lastSeenAt.{userId}   ISO string — drives the Home "report ready" card

A report's CONTENT is never stored — it is recomputed from `transactions`,
across ALL of the user's accounts, for whatever period is selected, via
`useAnalyticsData({ allAccounts: true })` + `lib/analytics.js`. Analytics itself
is untouched (`allAccounts` defaults false, per-`activeAccountId` as always).
Scheduling reuses lib/notifications.js; alerts reuse lib/alerts.js; export
writes a transient file to the cache dir and hands it to the OS share sheet
(nothing persisted).
```

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `useAnalyticsData` | Gains `allAccounts` param, default `false` | Phase 1 |
| `app/analytics.js`, `lib/analytics.js` | **Unaffected** — no param passed, no behaviour change | Verify only |
| Home | +conditional "report ready" card | Phase 1 |
| MenuSheet | +"Reports" row | Phase 1 |
| Settings | +"Reports" config card | Phase 1 |
| `lib/notifications.js` | +report schedule | Phase 2 |
| Alerts / bell | +report alert | Phase 2 |
| `app/analytics.js` | +Export button (its own CSV, active-account scoped) | Phase 3 |
| Build | +`expo-sharing`/`expo-file-system`/`expo-print` (native → dev build) | Phase 3 |

---

## Out of Scope (All Phases)

- **AI-written report summary** — deferred (user's call, 2026-07-14). Strong fit
  (narrative insight over raw numbers; aligns with `IDEAS-subscription-and-store.md`'s
  "AI is the cross-platform paid backbone"), but requires a server-side Supabase
  **Edge Function** (an LLM key can't ship client-side), must send only
  *aggregated* data, must degrade gracefully to the computed report, and is the
  natural paid-tier gate. Revisit as its own feature/phase.
- **An all-accounts mode on the Analytics screen** — only the report gets one.
  Analytics stays a deliberate per-account exploration tool; if a future need
  wants "Analytics, but all accounts," that's a separate, explicit decision.
- **A live link between the report and Analytics** — dropped because the two
  screens now have different scopes (all-accounts vs. active-account); linking
  them would show disagreeing numbers for the same range. See 1.3.
- **Both weekly and monthly at once** — one active cadence.
- **Emailed / cloud-backed / scheduled-export delivery** — the OS share sheet is
  the v1 export path.
- **Storing report snapshots / history** — reports are recomputed, never stored.
