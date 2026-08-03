# Feature: Configurable Summary Reset Period
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/30-summary-reset-period.md`
**Status**: 🚧 Built (2026-07-29), Babel- & DB-verified; on-device pending
**Last Updated**: 29 July 2026

---

## Context

Home's `AccountHeroCarousel` and `AccountSwitcherSheet` both show a per-account
"Income"/"Expenses" pair sourced from `v_global_summary`'s `month_income`/
`month_expense` columns — hardcoded server-side to "since the 1st of the
current calendar month," with no upper bound and no way to change it. The user
wants to choose what "current period" means (monthly/quarterly/yearly/a custom
anchor date) as one global Settings preference, defaulting to monthly (which
matches today's behavior exactly — no visible change for anyone who doesn't
touch the setting). `in_hand_balance` (labeled "In Hand") is genuinely
lifetime and stays that way; only the income/expense pair changes basis.

Reuses: Analytics' existing "fetch raw rows, aggregate with `date-fns`"
pattern (`useAnalyticsData`) instead of a parameterized SQL view (views can't
take runtime params); Settings' existing segmented-pill pattern (Reports'
`CADENCE_OPTIONS`) for the period picker; Settings' existing `DateTimePicker`
usage for the custom anchor date; `useProfile().updateProfile()` for the
write, same as every other profile-level preference.

Analytics' own Overview segment (`AnalyticsFilterBar` + `useAnalyticsData`) is
a separate, already more powerful period browser (any past month, or an
arbitrary custom range) and is **not** touched by this feature — rescoping it
to this preference would remove its ability to browse history. See Out of
Scope.

---

## Phase Overview

```
Phase 1 — Configurable reset period, applied to Home + the account switcher
  A new profiles preference (monthly/quarterly/yearly/custom), a Settings
  control to change it, and both existing "Income"/"Expenses" surfaces
  switched from the hardcoded calendar-month window to this preference.
```

Single phase — the whole feature is small enough that splitting it wouldn't
produce an independently useful intermediate state.

**After this phase: stop and wait for approval.**

---

## Phase 1 — Configurable Reset Period

### Goal
The user opens Settings, picks Monthly / Quarterly / Yearly / Custom (with a
date picker for the anchor when Custom is selected), and Home's hero card +
the account switcher sheet immediately reflect income/expense summed from that
period's start through today, for every account. `in_hand_balance` is
unaffected. Default is Monthly, so a user who never opens this setting sees
the exact same numbers as before.

### Before Starting — Confirm With Codebase
1. Re-read `hooks/useAllAccountSummaries.js` in full — confirm it still
   fetches `v_global_summary` with no filter and returns `{ [account_id]: row }`,
   exactly as read earlier this session.
2. Re-read `components/AccountHeroCarousel.js` lines ~26 (`EMPTY_SUMMARY`) and
   ~260–280 (the two `heroStat` blocks) — confirm the exact field names
   (`month_income`/`month_expense`) and that the labels are plain "Income"/
   "Expenses" with no "this month" copy that would need changing.
3. Re-read `components/AccountSwitcherSheet.js` lines ~78–89 — same field
   names, same plain labels, confirm before editing.
4. Re-read `app/settings.js`'s Reports section (`CADENCE_OPTIONS`,
   `reportSegmentWrap`/`reportSegment`/`reportSegmentActive` styles, and the
   `DateTimePicker` usage for `showReportTimePicker`) — this phase's new UI
   copies that shape exactly; confirm the styles/pattern haven't moved.
5. Confirm `date-fns` (already a dependency) exports `startOfMonth`,
   `startOfQuarter`, `startOfYear` — verified this session via a throwaway
   `node -e` check; re-verify if this doc is picked up much later.
6. Confirm current `profiles` columns via `list_tables` (Supabase MCP) before
   writing the migration — this doc's SQL is written against the schema
   confirmed live this session; re-check if time has passed.

### 1.1 Database

Two new nullable-safe columns on `profiles`. No new table — this is a single
global preference, same tier as `theme_accent`/`report_cadence`.

```sql
ALTER TABLE profiles
  ADD COLUMN reset_period text NOT NULL DEFAULT 'monthly'
    CHECK (reset_period IN ('monthly', 'quarterly', 'yearly', 'custom')),
  ADD COLUMN reset_custom_start date NULL;
```

- `reset_period` — governs which `date-fns` start-of-period function to use.
  Defaults to `'monthly'`, matching today's hardcoded behavior exactly.
- `reset_custom_start` — only meaningful when `reset_period = 'custom'`. Null
  until the user picks a date; the client falls back to `startOfMonth(now)`
  if `custom` is selected but this is still null (defensive, should not
  normally happen since the UI sets both together).
- No RLS change needed — `profiles` already has `auth.uid() = id` RLS
  covering every column.
- **Give this SQL to the user to paste into the Supabase SQL editor first**;
  confirm it applied before writing any component code against it.

### 1.2 Data Layer

**New `lib/periods.js`** (pure, no imports beyond `date-fns`):

```js
import { startOfMonth, startOfQuarter, startOfYear, format } from 'date-fns';

// The start of the "current" reset period, as a 'yyyy-MM-dd' string ready for
// a `.gte('occurred_at', …)` filter. `customStart` is `profiles.reset_custom_start`
// (already a 'yyyy-MM-dd' string from Postgres) — passed through as-is, no
// reparsing needed. Falls back to the start of the current month if `custom`
// is selected but no anchor has been set yet (shouldn't normally happen; the
// Settings UI sets both fields together).
export function resetPeriodStart(resetPeriod, customStart, now = new Date()) {
  switch (resetPeriod) {
    case 'quarterly':
      return format(startOfQuarter(now), 'yyyy-MM-dd');
    case 'yearly':
      return format(startOfYear(now), 'yyyy-MM-dd');
    case 'custom':
      return customStart || format(startOfMonth(now), 'yyyy-MM-dd');
    case 'monthly':
    default:
      return format(startOfMonth(now), 'yyyy-MM-dd');
  }
}

export const RESET_PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];
```

**`hooks/useAllAccountSummaries.js` — rewritten fetch.** Still one hook, still
one round trip per refetch, still returns `{ [account_id]: row }` so neither
consumer's shape changes beyond the two renamed fields (below):

```js
const refetch = useCallback(async () => {
  if (!userId) {
    setSummaries({});
    setLoading(false);
    return;
  }
  const [{ data: globalRows, error: globalError }, { data: profile }] = await Promise.all([
    supabase.from('v_global_summary').select('*'),
    supabase.from('profiles').select('reset_period, reset_custom_start').maybeSingle(),
  ]);
  if (globalError || !globalRows) {
    setLoading(false);
    return;
  }

  const since = resetPeriodStart(profile?.reset_period, profile?.reset_custom_start);
  const { data: periodRows } = await supabase
    .from('transactions')
    .select('account_id, type, amount')
    .gte('occurred_at', since);

  const periodTotals = {}; // account_id -> { income, expense }
  for (const row of periodRows ?? []) {
    if (row.type !== 'income' && row.type !== 'expense') continue; // exclude transfers — same discipline as v_global_summary itself
    const bucket = periodTotals[row.account_id] ?? (periodTotals[row.account_id] = { income: 0, expense: 0 });
    bucket[row.type] += Number(row.amount) || 0;
  }

  const map = {};
  globalRows.forEach((row) => {
    const totals = periodTotals[row.account_id] ?? { income: 0, expense: 0 };
    map[row.account_id] = { ...row, period_income: totals.income, period_expense: totals.expense };
  });
  setSummaries(map);
  setLoading(false);
}, [userId]);
```

- **`period_income`/`period_expense`**, not `month_income`/`month_expense` —
  the values are no longer always "this month," so the old names would lie
  once someone picks Quarterly/Yearly/Custom. Both current consumers'
  on-screen labels are already generic ("Income"/"Expenses"), so this is a
  pure rename with no copy change.
- **Excludes `transfer_in`/`transfer_out`** by explicit type check — same
  exact-type discipline `v_global_summary` itself uses (see
  `10-account-self-transfer.md`'s standing note in `00-index.md`: any new
  aggregation over `transactions` must filter on the exact type string or it
  will silently count transfers as income/expense).
- **No new hook.** `useAllAccountSummaries` is already the single shared
  source both consumers read from — extending it in place, per the "what
  does it reuse" principle, rather than adding a sibling hook that duplicates
  the account-summary fetch.
- **`in_hand_balance`/`total_income`/`total_expense` are untouched** — still
  read straight off `v_global_summary`'s existing columns via the object
  spread (`...row`), still genuinely lifetime.
- This hook is not scoped by `activeAccountId`, so the extra `profiles`
  read + transactions read cost one refetch per `version` bump, same
  cadence it already runs at — no new refetch trigger introduced.

**Mutation**: no new file. The Settings screen calls its existing
`updateProfile({ reset_period, reset_custom_start })` (from `useProfile()`),
same pattern every other profile preference in that screen already uses.
`notifyChanged()` fires inside `updateProfile` itself (non-silent write) —
`useAllAccountSummaries` picks it up on its next `version`-triggered refetch,
same as any other profile change today.

### 1.3 Components

No new components. Two existing files get field-name edits only:

- **`components/AccountHeroCarousel.js`** — `EMPTY_SUMMARY` and both
  `heroStat` text bindings (lines ~26, ~267, ~274 as last read) switch from
  `summary.month_income`/`month_expense` to `summary.period_income`/
  `period_expense`. No layout/label change.
- **`components/AccountSwitcherSheet.js`** — same rename at lines ~81/86.

**`app/settings.js`** — new "Summary Period" section, placed directly below
the existing "Reports" section (same segmented-pill shape, so it reads as a
sibling of that pattern, not a foreign control):

```jsx
<Text style={styles.sectionLabel}>Summary Period</Text>
<Card style={styles.rowsCard}>
  <View style={styles.reportSegmentWrap}>
    {RESET_PERIOD_OPTIONS.map((opt) => (
      <Pressable
        key={opt.value}
        style={[styles.reportSegment, resetPeriod === opt.value && styles.reportSegmentActive]}
        onPress={() => handleResetPeriodChange(opt.value)}
      >
        <Text style={[styles.reportSegmentText, resetPeriod === opt.value && styles.reportSegmentTextActive]}>
          {opt.label}
        </Text>
      </Pressable>
    ))}
  </View>

  {resetPeriod === 'custom' && (
    <Pressable style={[styles.subRow, styles.rowBorder]} onPress={() => setShowResetDatePicker(true)}>
      <Text style={styles.subRowLabel}>Starts from</Text>
      <Text style={styles.subRowValue}>{format(resetCustomStartDate, 'd MMM yyyy')}</Text>
    </Pressable>
  )}
</Card>
```

- Reuses `styles.reportSegmentWrap`/`reportSegment`/`reportSegmentActive`/
  `reportSegmentText`/`reportSegmentTextActive`/`subRow`/`rowBorder`/
  `subRowLabel`/`subRowValue` verbatim — all already defined in
  `app/settings.js` for the Reports section. No new styles needed for the
  segmented control or the date row.
- `showResetDatePicker` state + a `DateTimePicker` block, same shape as the
  existing `showReportTimePicker` block a few lines below in the same file
  (`mode="date"`, `maximumDate={new Date()}` — no future anchor dates, same
  cap Analytics' own custom-range "To" field already uses).
- `handleResetPeriodChange(value)`: if `value !== 'custom'`, calls
  `updateProfile({ reset_period: value })` directly. If `value === 'custom'`
  and `profile.reset_custom_start` is still null, defaults the anchor to
  **today** (`updateProfile({ reset_period: 'custom', reset_custom_start: format(new Date(), 'yyyy-MM-dd') })`)
  so switching into Custom always lands on a concrete, immediately-visible
  "fresh start" rather than an ambiguous null state — matching the user's own
  framing ("start a fresh record").
- Picking a new date while already in Custom mode (`onChange` of the
  `DateTimePicker`) calls `updateProfile({ reset_custom_start: format(selected, 'yyyy-MM-dd') })`
  — this is the reset action for Custom mode; there is no separate "Reset
  now" button.

### 1.4 Navigation / Integration
No new routes. The new Settings section sits inline on the existing Settings
screen — no menu-sheet entry, no new screen.

### 1.5 Impact on Existing Features

| Area | Change | Watch for |
|---|---|---|
| `hooks/useAllAccountSummaries.js` | Now also reads `profiles.reset_period`/`reset_custom_start` and one extra `transactions` query per refetch | `in_hand_balance`/`total_income`/`total_expense` must remain exactly as `v_global_summary` returns them — only the two renamed fields change source |
| `components/AccountHeroCarousel.js` | `month_income`/`month_expense` → `period_income`/`period_expense` | Pure rename; labels/layout unchanged |
| `components/AccountSwitcherSheet.js` | Same rename | Same |
| `app/settings.js` | New section + new state + one new `updateProfile` call shape | Must not touch the existing Reports section's own state/handlers |
| `v_global_summary` (DB view) | **Unchanged** — still queried as-is for `in_hand_balance`/`total_income`/`total_expense`; its own `month_income`/`month_expense` columns become unused by the client (left in place, not dropped — no consumer left to break, and dropping a live column is a separate, unnecessary risk) | Confirm no other consumer of those two specific columns exists beyond the two files this phase edits (grepped and confirmed this session — only those two) |
| Analytics (`app/(tabs)/analytics.js`) | **None** — deliberately untouched | See Out of Scope |

### 1.6 What This Phase Does NOT Include
- Analytics' Overview segment is not rescoped to this preference and its
  own month/custom-range browser is untouched.
- No "Reset now" button for monthly/quarterly/yearly — those reset
  automatically at each calendar boundary by construction (the query's lower
  bound simply moves forward once the period rolls over).
- No per-account override — this is one global preference for the whole
  account switcher / hero carousel, same tier as currency/theme.
- No timezone-awareness beyond what already exists — `startOfMonth`/
  `startOfQuarter`/`startOfYear` run against the device's local clock (same
  basis `occurred_at` filters already use elsewhere in this app), not
  `profiles.timezone`. Out of scope; matches existing behavior everywhere
  else `date-fns` period math is used client-side in this app.
- No dropping of `v_global_summary`'s now-unused `month_income`/`month_expense`
  columns — left in place, harmless, not worth a migration on its own.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `ALTER TABLE profiles ADD COLUMN reset_period …` applied via
      `mcp__supabase__apply_migration`; confirmed live via `information_schema.columns`
      — `reset_period text NOT NULL default 'monthly'`, `reset_custom_start date NULL`.
- [x] `lib/periods.js` exports `resetPeriodStart` and `RESET_PERIOD_OPTIONS`;
      spot-checked against a fixed date (2026-08-15): monthly→2026-08-01,
      quarterly→2026-07-01, yearly→2026-01-01, custom(explicit)→passthrough,
      custom(null)→falls back to monthly's start. All correct.
- [x] `useAllAccountSummaries` returns `period_income`/`period_expense`
      alongside the untouched `in_hand_balance`/`total_income`/`total_expense`,
      for every account, with transfers excluded (exact-type filter).
- [x] `AccountHeroCarousel` and `AccountSwitcherSheet` both read the renamed
      fields; grep-verified zero remaining reference to `month_income`/
      `month_expense` in either file (or anywhere in the codebase outside a comment).
- [x] Settings' new "Summary Period" section renders below Reports, reuses
      the existing segmented-pill styles verbatim (no new styles added), and
      the date field appears only when Custom is selected.
- [x] Switching to Custom for the first time sets `reset_custom_start` to
      today via `handleResetPeriodChange` — code path verified by reading,
      zeroed-total effect not yet seen on a live device.
- [ ] Switching Monthly → Quarterly → Yearly changes the hero card's
      Income/Expenses numbers (verified against a manual sum for at least
      one account with transactions spanning more than one month). **On-device.**
- [x] All five touched/new files (`lib/periods.js`, `hooks/useAllAccountSummaries.js`,
      `components/AccountHeroCarousel.js`, `components/AccountSwitcherSheet.js`,
      `app/settings.js`) pass a Babel transform check (`babel-preset-expo`).
- [ ] **On-device**: numbers match expectations across all four period types
      and after an app restart (persisted via `profiles`, not local state).

**→ Built. On-device verification pending — resume here once tested.**

---

## Data Model Summary (Final State After This Phase)

```
profiles (existing, extended)
  ├─ reset_period        text NOT NULL DEFAULT 'monthly'  (monthly|quarterly|yearly|custom)
  └─ reset_custom_start  date NULL                         (anchor, only used when reset_period='custom')

v_global_summary (existing, UNCHANGED)
  ├─ in_hand_balance   → lifetime, unchanged, still the single source for "In Hand"
  ├─ total_income/expense → lifetime, unchanged
  └─ month_income/expense → still exist in the view, now UNUSED by the client
                             (superseded by client-side period_income/expense)

Computed client-side (hooks/useAllAccountSummaries.js):
  period_income/period_expense → transactions since resetPeriodStart(reset_period, reset_custom_start),
                                  grouped by account_id, income/expense types only (transfers excluded)
```

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Home hero card | Income/Expenses basis becomes user-configurable (default unchanged) | None beyond this phase |
| Account switcher sheet | Same | None beyond this phase |
| Analytics | None | None |
| Budgets/Plans (`lib/budgets.js`'s own `period_type`) | None — entirely separate, siloed concept, not touched or reused here | None |

---

## Out of Scope (All Phases)

- **Rescoping Analytics' Overview to this preference** — considered, rejected
  for this feature. Analytics' own filter already lets the user browse any
  past month or custom range; forcing it to always default to the global
  reset period is a real idea but a separate, smaller follow-up if wanted
  later (seed `AnalyticsFilterBar`'s initial `mode`/`month` from
  `profiles.reset_period` on first mount) — not needed to satisfy the actual
  request.
- **A per-account reset period** — this is one global preference, matching
  currency/theme's own precedent.
- **Dropping `v_global_summary`'s `month_income`/`month_expense` columns** —
  left in place; harmless, no consumer left after this phase, not worth a
  migration on its own.
- **Timezone-aware period boundaries** — out of scope; matches how every
  other client-side `date-fns` period computation in this app already works
  (device-local clock).
