# FLO — Common Data Patterns

Reference for planning and building FLO features. These are the established
patterns in the codebase — follow them exactly unless the feature has a
specific reason not to (and if so, say so explicitly in the feature doc).

---

## RLS Policy Template

Every table is single-user-owned. Wrap `auth.uid()` in `(select auth.uid())`
in **both** `USING` and `WITH CHECK` — the Supabase performance advisor flags
the unwrapped form (`auth_rls_initplan`) because it re-evaluates per row
instead of once per statement:

```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own [records]"
  ON [table_name] FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

`WITH CHECK` is not optional/redundant with `USING` — `USING` governs which
existing rows are visible/matchable (SELECT/UPDATE/DELETE), `WITH CHECK`
governs what a new/updated row is allowed to contain (INSERT/UPDATE). Without
it, `FOR ALL` falls back to reusing `USING` for the check, which happens to
work here only because both expressions are identical — write it explicitly
anyway so a future edit to one doesn't silently desync from the other.

FLO has no public/unauthenticated read paths anywhere — every table is
private to its owner. Don't add a token-based public policy unless the
feature genuinely requires sharing outside the app (none has so far).

---

## Standard Table Columns

```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
created_at timestamptz DEFAULT now()
```

**`DEFAULT auth.uid()` on `user_id` is not optional.** Every client-side
mutation in this codebase omits `user_id` from its insert payload entirely
(see the Mutation Pattern below) and relies on this default to fill it in. A
table without it will insert `user_id = NULL`, which the RLS `WITH CHECK`
policy correctly rejects — but the resulting error is a *misleading*
`new row violates row-level security policy`, not the more obvious NOT NULL
violation, so it's a confusing thing to debug from the client side. Caught
once already: the `bills` table (`04-notifications-and-recurring-bills.md`)
shipped without it and failed on the very first real create, surfaced by
on-device testing, not by any advisor. **Before applying a new table's SQL,
verify the exact column list — including this default — against
`information_schema.columns` for an existing table** (e.g. `budgets` or
`transactions`), not from memory or this doc alone.

No `updated_at` column exists on any table in this schema (`profiles`,
`categories`, `transactions`, `budgets`, `plans`, `accounts`, `bills`). Don't
add one to a new table unless the feature specifically needs edit-history —
call it out explicitly in the feature doc if you do, since it'd be the first.

---

## Computed Reads — Never Store a Derived Total

This is the core architectural rule from `FEATURE_PLAN.md`: balances,
budget `remaining`, and plan progress are always computed, never stored as
a running total that could drift from the transactions it's derived from.

Two ways to compute, pick based on reuse and data volume:

**Postgres view** — when several screens need the same aggregate, or the
computation genuinely benefits from running in the database:

```sql
CREATE OR REPLACE VIEW v_[name] AS
SELECT ...
FROM transactions t
WHERE t.user_id = auth.uid()
...
```

Existing views: `v_global_summary`, `v_budgets_with_spent`,
`v_plans_with_totals`. RLS on the underlying tables already scopes these
per-user — a view over an RLS'd table doesn't need its own policy.

**Client-side aggregation** — the default for anything scoped to one
screen or one hook. Fetch the raw rows for the relevant range and reduce
them in JS with `date-fns`. See `useDailyTotals.js` for the canonical
example: builds an empty day-by-day map, fetches rows in range, fills the
map, returns `Object.values(...)`.

---

## Hook Pattern (Reads)

```javascript
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

export default function useThing(param) {
  const { version } = useDataRefresh();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('table_or_view')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setData(rows ?? []);
    setLoading(false);
  }, [param]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { data, loading, refetch };
}
```

- Every hook that reads data subscribes to `version` from `useDataRefresh()`
  so it refetches automatically after any mutation anywhere in the app.
- Derived per-row helpers (e.g. `budgetStatus(spent, amount)` in
  `useBudgets.js`) are plain exported functions alongside the hook, not
  methods on a class or a separate utils file, if they're only used
  alongside that hook's data.
- No React Query, no SWR, no caching layer beyond the version-counter
  pattern. Don't introduce one for a single feature.

---

## Mutation Pattern

Mutations are not hooks — they're plain `async function`s inside the
component that triggers them (usually a sheet), calling Supabase directly:

```javascript
async function handleSave() {
  setSaving(true);
  setError(null);

  const { error: saveError } = editingId
    ? await supabase.from('table').update(payload).eq('id', editingId)
    : await supabase.from('table').insert(payload);

  setSaving(false);
  if (saveError) {
    setError(saveError.message);
    return;
  }
  notifyChanged();       // from useDataRefresh() — triggers every hook's refetch
  modalRef.current?.dismiss();
}
```

There is no `lib/api/*.js` layer separating Supabase calls from components
— this is deliberate for an app this size. Don't introduce one for a
single feature; if a feature's mutations get complex enough to want one,
raise that as a cross-cutting refactor, not a side effect of the feature.

---

## Bottom Sheet Pattern (Create/Edit Forms)

Every "Add X" flow — `AddTransactionSheet`, `AddBudgetSheet`,
`AddPlanSheet`, `AddCategorySheet`, `EditProfileSheet` — follows the same
shape: a Provider exposing an imperative open function via Context, and
the sheet itself as a `forwardRef` component using
`useImperativeHandle`.

```javascript
const AddThingSheetContext = createContext(null);

export function AddThingSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddThing = useCallback((thing) => sheetRef.current?.open(thing ?? null), []);

  return (
    <AddThingSheetContext.Provider value={{ openAddThing }}>
      {children}
      <AddThingSheet ref={sheetRef} />
    </AddThingSheetContext.Provider>
  );
}

export function useAddThingSheet() {
  const ctx = useContext(AddThingSheetContext);
  if (!ctx) throw new Error('useAddThingSheet must be used within AddThingSheetProvider');
  return ctx;
}

const AddThingSheet = forwardRef(function AddThingSheet(_props, ref) {
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef); // see note below — required, not optional
  useImperativeHandle(ref, () => ({
    open(existing) { /* seed form state, then */ modalRef.current?.present(); },
  }));
  // <BottomSheetModal ref={modalRef} onChange={handleSheetChange} ...>
  // snapPoints, backdrop, dark (colors.ink) background matching
  // AddBudgetSheet.js exactly for visual consistency
});
```

Providers are mounted once near the app root (see `app/_layout.js`) so
`openAddThing(...)` is callable from anywhere without prop-drilling.

**`useSheetBackHandler(modalRef)` is mandatory on every sheet, not
optional polish.** `@gorhom/bottom-sheet` v5 has no built-in Android
hardware-back handling at all — without this hook wired to the modal's
`onChange`, pressing the Android back button while the sheet is open falls
through to `expo-router`, and since Home is the root screen with nothing to
pop to, that means the OS exits the whole app. Found via real on-device
testing (2026-07-11) and fixed on all 11 existing sheets — see the standing
rule in `00-index.md`. Every new sheet must include it from the start.

**When to reach for a sheet vs a pushed screen**: a sheet is for a quick,
single-purpose create/edit form the user dismisses in a few seconds
(amount + a few fields). A pushed screen (`app/...`) is for something with
its own sub-navigation, a longer list, or content the user browses rather
than fills in (Plan Detail, Settings, Manage Categories).

---

## Confirmations and Errors

No toast library, no custom dialog component. Two patterns:

**Inline form errors** (inside a sheet, non-fatal, user is still editing):

```javascript
const [error, setError] = useState(null);
// ...
{error && <Text style={styles.errorText}>{error}</Text>}
```

**Destructive confirmation / standalone error** (on a screen, not a form):

```javascript
import { Alert } from 'react-native';

Alert.alert('Delete category', `Delete "${category.name}"?`, [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Delete', style: 'destructive', onPress: () => handleDelete(category) },
]);

// Guard messages the same way:
Alert.alert('Category in use', `"${category.name}" is used by 2 transaction(s). Remove those first.`);
```

Use `Alert.alert` for anything destructive (delete) or anything that needs
the user's attention outside a form context. Use inline `error` state for
form validation while a sheet is open.

---

## Formatting

```javascript
// Currency — always whole rupees, no decimals
`₹${Math.round(n).toLocaleString('en-IN')}`

// Dates — date-fns, never manual Date string formatting
import { format } from 'date-fns';
format(date, 'EEEE, d MMM');   // "Tuesday, 11 Jul"
format(date, 'yyyy-MM-dd');    // Supabase date-column format
```

---

## Category Icons

Categories reference a curated icon *key* (e.g. `'food'`, `'travel'`), not
a component directly. `CategoryIcon.js` maps keys to `lucide-react-native`
components and exports `CATEGORY_ICON_KEYS` for icon pickers. A new
feature that displays a category's icon renders `<CategoryIcon icon={cat.icon} .../>`
— never imports a Lucide icon ad hoc for a category.

---

## Cross-Screen Refresh

```javascript
import { useDataRefresh } from '../lib/DataRefreshContext';

const { version, notifyChanged } = useDataRefresh();
```

`version` is a counter that increments on `notifyChanged()`. Every read
hook depends on it in its `useEffect`, so any mutation anywhere
(`notifyChanged()` after a successful insert/update/delete) refreshes
every visible screen's data. This is the entire cache-invalidation
strategy — don't build a more granular one for a single feature.

---

## Navigation Conventions

- Tabs (`app/(tabs)/`): Home, Transactions, Budgets, Plans — 4 fixed
  destinations plus the floating ⊕ (Add Transaction). Don't add a 5th tab
  without explicit user sign-off; it's already a tight bar.
- New global destinations that aren't tab-worthy go in the menu sheet
  opened from Home's header icon (alongside Settings) — pushed as a new
  route from there, e.g. `app/analytics.js`.
- Detail screens reachable from a list item push as a route with a param,
  e.g. `app/plan/[id].js`, not a modal.

---

## Styling

- Colors/radii/spacing/fonts always from `theme/tokens.js` — never inline
  hex or magic pixel values, so light-only theming and brand tweaks stay a
  one-file change.
- `StyleSheet.create` at the bottom of each component file, not inline
  style objects on JSX (except for small conditional overrides like
  `[styles.segment, active && styles.segmentActive]`).
- Icons are `lucide-react-native` exclusively, sized/stroked to match
  surrounding UI (check a sibling component for the going stroke width —
  usually 2 or 2.6 for close buttons).
