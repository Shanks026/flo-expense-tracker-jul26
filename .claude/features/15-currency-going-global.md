# Feature: Currency — going global (per-account currency, no FX)

**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/15-currency-going-global.md`
**Status**: Phase 1 complete. Phase 2 built, pending on-device verification.
**Last Updated**: July 2026

---

## Context

Graduates `IDEAS.md` idea #9 ("Currency / going global", worked through
2026-07-14) into a real build. Today `profiles.currency` exists, defaults to
`'INR'`, and is **never read** — Settings renders a hardcoded `"₹ INR"` row, and
money formatting hardcodes `₹` + `en-IN` (lakh/crore grouping) in ~62 inline
places across the app plus the two helpers (`lib/money.js`, `AmountText`).

**The model that makes this tractable** (from idea #9, non-negotiable):
*currency belongs to the **account**, not the user.* Every transaction in an
account is denominated in that account's currency. `profiles.currency` is merely
the **default for new accounts**. Because every total in FLO is already
**account-scoped** (`v_global_summary` groups by account; budgets, plans,
analytics, and transactions all filter to the active account), **the app never
sums across two currencies — so it needs no exchange rates, no FX API, no rate
cache, and no staleness handling.** Conversion is a display concern the app
simply never performs. That is the single biggest cost avoided.

**An account's currency is immutable once it has transactions.** Changing it
would either invent money (relabel ₹50,000 → $50,000) or destroy history
(converting past rows at today's rate asserts amounts that never happened). A
relocating user opens a *new* account in the new currency — the same guarantee a
real bank gives. Only two currency changes are ever allowed: the profile default
(affects new accounts only), and an account with **zero** transactions (covers
"picked wrong at onboarding").

**Default stays INR.** Existing accounts backfill to `'INR'`; `profiles.currency`
keeps its `'INR'` default. Nothing changes for the current user — this is
purely making the app *able* to hold other currencies.

### Two things this feature explicitly does NOT do

1. **It does not touch subscription pricing.** (Settled 2026-07-17.) Pricing
   localization is a property of the *billing integration*, not this feature.
   When RevenueCat / Play Billing lands (deferred master-sequence step), the
   paywall will read **store-provided localized price strings**
   (`localizedPriceString`) driven by the user's **store-account region** —
   which is a *different axis* from their in-app account currency (a user can
   hold a USD account in FLO but pay ₹ via an Indian Play account). Converting
   the placeholder ₹ prices in `lib/pro.js` per in-app currency would (a) need
   an FX rate — the exact thing this feature's model is proud to avoid — and (b)
   be architecturally wrong (billing region ≠ account currency). So `lib/pro.js`
   placeholder prices stay **exactly as they are**; the store localizes at
   billing time. See §Out of scope.

2. **It does not make auto-detect / SMS-import work outside India.** Those are
   structurally India-specific (regexes match `Rs.`/`INR`/`₹` and Indian bank
   "debited/credited" phrasing; `PromptNotifier.kt` formats `₹` natively in
   Kotlin). Currency *display* going global neither fixes nor breaks them for
   Indian users — a non-Indian user simply won't get auto-detect. Making that
   region-aware is a separate, much larger job. See §Out of scope.

---

## Product decisions (settled — 2026-07-17)

- **Full per-account currency.** `accounts.currency` is the ground truth;
  `profiles.currency` is only the new-account default.
- **Default currency: INR**, matching what every existing account already is.
- **Immutable once used** — an account's currency can only be changed while it
  has zero transactions (same guard shape as the existing "account in use"
  delete guard in `AddAccountSheet.js`).
- **No exchange rates, ever** — the app never converts or sums across
  currencies (see §The all-accounts edge for the one wrinkle and its rule).
- **Pricing decoupled** — placeholder Pro prices untouched; store handles
  localization at billing time.
- **Bills get their own currency** (`bills.currency`, default `'INR'`) — bills
  are global per-user (not account-scoped), so they can't inherit an account's
  currency; they carry their own, picked at create time.

### The currency registry

A small, curated set to start (expandable later) — code, symbol, name, and the
`Intl` locale used for digit grouping. INR keeps its lakh/crore grouping via
`en-IN`; others use their conventional locale.

| Code | Symbol | Name | Locale (grouping) | Decimals |
|---|---|---|---|---|
| INR | ₹ | Indian Rupee | en-IN | 0 |
| USD | $ | US Dollar | en-US | 0 |
| EUR | € | Euro | en-IE | 0 |
| GBP | £ | British Pound | en-GB | 0 |
| AED | د.إ | UAE Dirham | en-AE | 0 |
| CAD | $ | Canadian Dollar | en-CA | 0 |
| AUD | $ | Australian Dollar | en-AU | 0 |
| SGD | $ | Singapore Dollar | en-SG | 0 |

> **Decimals stay 0 app-wide** — FLO has always shown whole units
> (`Math.round`), and that's a deliberate product choice, not an INR artifact.
> Keeping 0 decimals for every currency preserves every existing layout (amount
> font sizes, input widths) and sidesteps minor-unit storage entirely. Amounts
> remain stored as whole numbers in `transactions.amount`. (Revisit only if a
> zero-decimal currency ever feels wrong; not now.)

### The all-accounts edge (the one real wrinkle)

Idea #9 predates the **Pro "all-accounts" report scope** (`14`/`report.js`),
which *does* aggregate across accounts — the one place FLO sums across what could
now be different currencies. Summing ₹ + $ is meaningless. **Rule: cross-account
aggregation only ever spans accounts sharing a single currency.** Concretely,
when a free/Pro user's accounts span multiple currencies, the all-accounts
report scopes its totals to the **active account's currency** (accounts in other
currencies are excluded from the summed figures, not silently added). Single-
currency users (everyone today, and most users) see no change. Detailed in
Phase 2.

---

## Phase Overview

```
Phase 1 — Currency-aware formatting plumbing (invisible refactor)
  Create lib/currency.js (registry + Intl-based formatMoney/symbol/parse).
  Route lib/money.js's formatMoney AND components/AmountText through it,
  defaulting to INR. Sweep the ~62 inline `₹…toLocaleString('en-IN')` call
  sites + the bare-₹ input prefixes to the helper, all still INR. ZERO visible
  change — every screen renders byte-identical output. Ships and verifies on
  its own as a pure refactor with no schema and no product change.

Phase 2 — Per-account currency (schema + the model, lights it up)
  accounts.currency column (backfill 'INR'); handle_new_user seeds it from
  profiles.currency. useCurrency() hook resolves the currency to display per
  surface (active account, or each account's own on the switcher). Currency
  picker in AddAccountSheet (editable only while the account has 0 txns).
  Settings' dead "₹ INR" row becomes the profile-default picker. bills.currency
  + picker in AddBillSheet. The all-accounts report currency rule. This is the
  phase that makes non-INR actually possible.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Currency-aware formatting plumbing ✅ Complete

### Goal

Every money string in the app flows through **one** currency-aware helper that
*takes a currency code*, defaulting to `'INR'`. With no per-account currency yet
(Phase 2), every call passes/defaults to INR, so **output is byte-identical to
today** — this is a pure, invisible refactor that makes the app currency-*ready*.
Nothing is user-visible; the win is that Phase 2 can light currencies up by
changing what code each call site passes, not by re-touching 60+ sites.

### 1.1 Database

**None.**

### 1.2 Data layer

- **`lib/currency.js`** (new) — the single source of truth:
  ```js
  export const CURRENCIES = {
    INR: { code: 'INR', symbol: '₹',   name: 'Indian Rupee',      locale: 'en-IN' },
    USD: { code: 'USD', symbol: '$',   name: 'US Dollar',         locale: 'en-US' },
    EUR: { code: 'EUR', symbol: '€',   name: 'Euro',              locale: 'en-IE' },
    GBP: { code: 'GBP', symbol: '£',   name: 'British Pound',     locale: 'en-GB' },
    AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham',        locale: 'en-AE' },
    CAD: { code: 'CAD', symbol: '$',   name: 'Canadian Dollar',   locale: 'en-CA' },
    AUD: { code: 'AUD', symbol: '$',   name: 'Australian Dollar', locale: 'en-AU' },
    SGD: { code: 'SGD', symbol: '$',   name: 'Singapore Dollar',  locale: 'en-SG' },
  };
  export const DEFAULT_CURRENCY = 'INR';
  export const CURRENCY_LIST = Object.values(CURRENCIES);

  export function currencyMeta(code) {
    return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
  }
  export function currencySymbol(code) {
    return currencyMeta(code).symbol;
  }
  // Whole units only (0 decimals) — matches FLO's existing Math.round display.
  // Groups digits per the currency's locale (INR keeps lakh/crore via en-IN).
  export function formatMoney(amount, code = DEFAULT_CURRENCY) {
    const { symbol, locale } = currencyMeta(code);
    return `${symbol}${Math.round(Math.abs(amount)).toLocaleString(locale)}`;
  }
  // The grouped number only (no symbol) — for AmountText, which renders the
  // symbol as a separately-colourable <Text> span.
  export function formatAmountNumber(amount, code = DEFAULT_CURRENCY) {
    return Math.round(Math.abs(amount)).toLocaleString(currencyMeta(code).locale);
  }
  ```
  > **Why `.toLocaleString(locale)` and not `Intl.NumberFormat('…', {style:
  > 'currency'})`**: the `currency` style forces the currency's own minor-unit
  > decimals (USD → `$12.00`) and its own symbol placement, which would change
  > every existing layout and reintroduce decimals FLO deliberately doesn't
  > show. Formatting the number with the locale's *grouping* and prepending our
  > own symbol keeps today's exact look and the whole-unit rule. `en-IN`
  > grouping reproduces the current lakh/crore output identically.

### 1.3 Components / screens (the sweep)

Route both existing formatters through `lib/currency.js`, then replace the
inline duplicates. **Everything passes/defaults to `'INR'` this phase.**

- **`lib/money.js`** — `formatMoney(n)` becomes a thin re-export /
  delegate to `currency.formatMoney(n, 'INR')`. (Keep the name; its callers —
  `lib/alerts.js`, `hooks/useAlerts.js`, `lib/notifications.js`, `lib/koban.js`
  — are unchanged.)
- **`components/AmountText.js`** — its local `formatNumber` (hardcodes
  `en-IN`) and the hardcoded `₹` span both come from `currency.js`. Add an
  optional `currency` prop defaulting to `'INR'`; render `currencySymbol(currency)`
  in the symbol span and `formatAmountNumber(value, currency)` for the digits.
  All existing callers omit the prop → INR → identical.

**Formatted-number call sites** (route to `formatMoney`/`AmountText`, still INR):
`app/report.js`, `app/plans.js`, `app/(tabs)/budgets.js`,
`components/AccountSwitcherSheet.js`, `app/settings.js`, `app/(tabs)/index.js`,
`components/DonutChart.js`, `app/plan/[id]/index.js`, `app/plan/[id]/history.js`,
`app/onboarding/budget.js`, `app/budget/[id].js`, `app/bills.js`,
`app/analytics.js`, `app/(tabs)/transactions.js`, `components/IncomeExpenseChart.js`,
`components/DueBillsModal.js`, `components/DayOfWeekChart.js`.

**Bare-`₹` input prefixes** (amount fields; swap the literal `₹` for
`currencySymbol(code)`, INR this phase): `components/AddTransactionSheet.js`,
`components/AddBudgetSheet.js`, `components/AddPlanSheet.js`,
`components/AddBillSheet.js`, `components/PayBillSheet.js`,
`app/onboarding/balance.js`, `app/onboarding/expense.js`.

**Deliberately excluded from the sweep:**
- **`lib/export.js`** — CSV amount is a **plain number**, never a formatted
  string (a spreadsheet needs a real numeric value). Do not route it through
  the symbol formatter. (A future currency *column* in the CSV is Phase 2's
  call, not a formatting change.)
- **`PromptNotifier.kt`** (Kotlin, auto-detect) — India-specific, out of scope.

### 1.4 Navigation / integration

None — no new screens, no new routes.

### 1.5 Impact on existing features

| Area | Impact | Watch for |
|---|---|---|
| Every money display | Now formatted via one helper | Output must be **byte-identical** — verify no spacing/grouping drift |
| `AmountText` | Gains optional `currency` prop (defaults INR) | Every existing caller omits it → unchanged |
| `lib/export.js` | **None** — stays a plain number | Don't accidentally symbol-format the CSV |

### 1.6 What this phase does NOT include

- **No schema, no per-account currency** — everything is INR; this is plumbing.
- **No visible change** — if anything renders differently, it's a bug.
- **No pricing change, no auto-detect change.**

### 1.7 Phase 1 checklist

- [x] `lib/currency.js` created (registry, `formatMoney`, `formatAmountNumber`, `currencySymbol`, `currencyMeta`, `CURRENCY_LIST`, `DEFAULT_CURRENCY`).
- [x] `lib/money.js` `formatMoney` delegates to `currency.js`; its 4 callers unchanged.
- [x] `AmountText` renders symbol + number via `currency.js`, `currency` prop defaults `'INR'`.
- [x] All formatted-number call sites + bare-₹ input prefixes routed through the helper.
- [x] `lib/export.js` left as a plain number (not swept); `PromptNotifier.kt` untouched.
- [x] On-device: Home, Transactions, Budgets, Plans, Bills, Analytics, Report, account switcher all render **identically** to before (INR, lakh/crore grouping intact). Confirmed by the user — no deviation in the app.

### Implementation Notes

- **Verified byte-identical at the helper level** (the phase's core requirement)
  by loading the real `lib/currency.js` and diffing `formatMoney` /
  `formatAmountNumber` against the exact old inline pattern
  (`₹${Math.round(n).toLocaleString('en-IN')}`) across 18 values — negatives,
  zero, lakh/crore magnitudes, and decimals — all identical. Every touched file
  also parses (babel/AST). **On-device visual confirmation is still open**
  (no emulator/device in this environment), but the risk is low given the
  helper-level proof.
- **`formatMoney` deliberately does NOT `Math.abs`** — a refinement over the
  doc's original draft. The old inline sites and `lib/money.js` never absed
  (a negative rendered `₹-1,234`), so faithful byte-identical output requires
  matching that. `formatAmountNumber` (for `AmountText`, which prints the sign
  itself) DOES abs, matching `AmountText`'s old `formatNumber`. This split is
  the reason output is provably identical.
- **Whitespace-preserving JSX edits**: several sites split a `… of ₹\n{expr}`
  across two lines, where JSX collapses the newline to *nothing* (not a space),
  and the literal `₹` carried the space (`of ₹`). Replacing with
  `of{' '}\n{formatMoney(expr)}` reproduces the exact single space — verified
  by re-reading each edit.
- **Deliberate exclusions** (confirmed by a final `₹` grep — every remaining
  occurrence is one of these, none a missed money value):
  - `lib/pro.js` — Pro pricing placeholders (out of scope; store localizes later).
  - `lib/smsParser.js` + `PromptNotifier.kt` — India-specific parser regex/native
    formatting (out of scope).
  - `lib/koban.js` — editorial copy ("Even a ₹0 day…", "₹2,000 disappears")
    with example amounts, not formatted values. Its *dynamic* money already
    goes through `formatMoney` (via `lib/money.js`, now routed).
  - `app/onboarding/intro/income.js` — income-bracket survey labels
    ("Under ₹30k"), India-specific onboarding copy.
  - `app/onboarding/intro/stat.js` — the cited UPI national statistic (editorial).
  - `app/settings.js:188` — the auto-detect debug log (tied to the
    India-specific detection feature).
  - `app/settings.js:328` — the dead `"₹ INR"` row; **Phase 2** replaces it
    with the real profile-default picker.
  - `lib/export.js` — CSV amount stays a plain number (a spreadsheet needs a
    numeric value); only a comment mentions `₹`.
- **`plan/[id]/history.js` needed no change** — it already imports `formatMoney`
  from `lib/money.js`, which now delegates to `currency.js`, so it's routed for
  free.
- Net: **25 files touched** (1 new + 24 edited); `lib/currency.js` is the new
  single source of truth. Phase 2 lights up per-account currency by changing
  what code each call site passes — no re-sweep.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Per-account currency ✅ Built, pending on-device verification

### Goal

Non-INR becomes real. Each account carries a currency (default INR); new
accounts inherit the profile default; the currency shown on every screen is the
active account's (each card on the switcher shows its own). The currency is
pickable when creating an account, editable only while the account has zero
transactions, and locked once it has any. Settings' dead "₹ INR" row becomes a
real profile-default picker. Bills carry their own currency. The all-accounts
report never sums across currencies.

### 2.1 Database

**Applied via the Supabase MCP** (`apply_migration`, name
`add_account_and_bill_currency`) once the user authorized the connector —
`execute_sql`. Verified: all 7 existing accounts and all 8 existing bills
backfilled to `INR`. `get_advisors` (security) shows only the two
pre-existing WARNs already documented in `13-ai-features.md`
(`delete_current_user`, leaked-password-protection) — no new findings from
this migration. This block is the migration record:

```sql
-- 1. accounts.currency — ground truth; backfill every existing account to INR
alter table public.accounts
  add column if not exists currency text not null default 'INR';

-- 2. bills.currency — bills are global per-user, not account-scoped, so they
--    carry their own currency (default INR)
alter table public.bills
  add column if not exists currency text not null default 'INR';
```

**`handle_new_user` is deliberately NOT modified** (deviation from the original
plan, decided at build time). The auto-created "Personal" account inherits INR
from the `currency DEFAULT 'INR'` column, and the profile row it reads is itself
created in the same trigger defaulting to `'INR'` — so seeding the account
currency *from* the profile would be a no-op today. The behaviour that actually
needs the profile default (a user who changed their Settings default, then adds
a new account) is handled **client-side** in `AddAccountSheet` (the picker
defaults to the profile currency); the trigger only ever fires at signup, when
the profile is always INR. Skipping it avoids rewriting a `SECURITY DEFINER`
trigger blind for zero functional gain. (If a region-detected profile default is
ever added at signup, revisit this.)

No new CHECK constraint on the currency string (the client only ever writes a
known code from `CURRENCIES`; an unknown code degrades gracefully to the default
via `currencyMeta`). No view changes — `v_*` views never reference currency.

### 2.2 Data layer

- **`hooks/useCurrency.js`** (new) — resolves *the currency to display on the
  current surface*. Reads `useAccount()`; returns the **active account's**
  `currency` (default `'INR'` while accounts load / if absent). This is the
  default source for every account-scoped screen (Home, Transactions, Budgets,
  Plans, Analytics, Report), since they already show the active account only.
  ```js
  const currency = useCurrency();            // active account's code
  formatMoney(amount, currency);
  ```
- **`useAccount()`** already exposes `accounts` (each with its new `currency`)
  and `activeAccount` — no change needed beyond the column flowing through
  `select('*')`.
- **`useProfile()`** already returns `profile.currency` (the row has it) — used
  by the Settings default picker; no hook change.

### 2.3 Components / screens

- **`components/CurrencyPicker.js`** (new) — a small reusable picker (a chip
  grid or a select list of `CURRENCY_LIST`, styled like the existing color /
  category pickers in the dark sheets). Props: `value`, `onChange`, optional
  `disabled` + `disabledReason`. Reused by AddAccount, AddBill, and Settings.
- **`components/AddAccountSheet.js`** — add a currency field using
  `CurrencyPicker`, defaulting to the profile currency on create.
  **Immutable-once-used guard**: when editing an account, before allowing a
  currency change, check the account's transaction count (same
  `count exact head` query the delete guard already runs). If > 0, render the
  currency read-only with a one-line hint ("Currency can't change once an
  account has transactions — create a new account instead"). If 0, it's freely
  editable.
- **`components/AddBillSheet.js`** — add a `CurrencyPicker` (default profile
  currency). Bills format in their own `currency`. (A bill's currency can stay
  freely editable — a bill has no immutable ledger history the way an account
  does; its `amount` is a single current figure, and edits already overwrite
  it.)
- **`app/settings.js`** — replace the dead static `"₹ INR"` row
  ([app/settings.js:322-329](app/settings.js#L322-L329)) with a real row that
  opens the `CurrencyPicker` and writes `profiles.currency` via
  `useProfile().updateProfile({ currency })`. Copy makes clear it's the
  **default for new accounts**, not a global relabel: subtitle e.g. "Default
  for new accounts". Existing accounts are unaffected (their currency is their
  own).
- **Per-surface formatting**: pass `useCurrency()` (or the row's own account
  currency) into `formatMoney`/`AmountText` at the sites swept in Phase 1.
  Almost all are already active-account-scoped, so `useCurrency()` is the
  single value they need. Exceptions:
  - **`components/AccountSwitcherSheet.js`** — each `AccountCard` formats in
    **its own** `account.currency`, not the active one (it lists all accounts).
  - **`app/bills.js` / `components/DueBillsModal.js` / `PayBillSheet.js`** —
    format each bill in **its own** `bill.currency`.

### 2.4 The all-accounts report rule

`app/report.js`'s all-accounts scope (and any cross-account total) must never
sum across currencies. Implement the §The-all-accounts-edge rule:

- Compute the set of currencies among the user's accounts.
- If they're all the same (the common case, and everyone today) → unchanged.
- If they differ → the all-accounts summed figures (spent/received/net, the
  donut, biggest-transaction total) scope to the **active account's currency**;
  accounts in other currencies are excluded from those sums. Surface a small
  one-line note ("Totals shown in <CODE>; accounts in other currencies are
  excluded"). Per-account rows (each already single-currency) still render, each
  in its own currency.

> Rationale: this preserves the "never invent a cross-currency total" guarantee
> without an FX rate, and it only ever activates for the rare multi-currency
> user. Single-currency users never see the note.

### 2.5 Onboarding

**Built** (originally scoped optional/deferred; picked up explicitly at the
user's request after the rest of Phase 2 shipped). A new
**`app/onboarding/currency.js`** step, registered in `lib/onboarding.js`'s
`STEPS` array immediately after `'account'` and before `'categories'`:

- Same shape as the other single-choice onboarding screens (`intro/goal.js`,
  `intro/income.js`): `OnboardingScreen` + the shared `ChoiceList` component,
  options built from `CURRENCY_LIST` (`{ key: code, label: 'symbol  CODE',
  hint: name }`). `scrollable` is required (not the default) — 8 options
  overflow the static centred layout other short choice screens use, and
  without it the list overlapped the progress bar and footer button (caught
  on first on-device look).
- **UPDATEs, not INSERTs** — same pattern as `account.js` (which this screen
  sits directly after): the account already exists (`handle_new_user`
  auto-creates it), so this sets `accounts.currency` on the same row
  `account.js` just named/coloured. Seeds its selection from the account's
  current currency once `useAccount()` resolves, with the same
  don't-clobber-a-touched-selection guard `account.js` uses for name/color.
- **Also writes `profiles.currency`** (via `useProfile().updateProfile`),
  not just the account — run together with the account update via
  `Promise.all`. Onboarding is the one moment establishing "what currency do
  I use"; writing only the account left Settings' Currency row (which reads
  the *profile* default) stuck on INR forever after picking e.g. USD here,
  which read as broken. Both now agree.
- Defaults to `DEFAULT_CURRENCY` (INR) pre-selected, so `Continue` is never
  blocked — a user who doesn't care can just tap through.
- Positioned *before* `balance.js`/`expense.js`/`budget.js` specifically so
  those money-entry screens can reflect the pick that was just made, not a
  stale hardcode.

**`balance.js`, `expense.js`, `budget.js` updated to match** (necessary
follow-through — shipping the picker while leaving the very next three
screens hardcoded to `₹` would make the picker look broken): `balance.js` and
`budget.js` now read `useCurrency()` (the active account's currency);
`expense.js` already destructures `activeAccount`, so it reads
`activeAccount?.currency` directly.

### Decimal support — post-ship addition

**Built** (user-reported: "dollars have cents, I'm unable to create $4.56").
The original Phase 1 draft locked in "0 decimals app-wide" as a deliberate
simplification (see the currency registry note above) — that decision is
superseded for the *amount-entry* path. It turned out every currency in the
registry (INR/USD/EUR/GBP/AED/CAD/AUD/SGD) conventionally uses a 2-digit
subunit anyway, so this isn't a per-currency decimals field, just: allow up
to 2 decimal digits everywhere, and stop silently rounding them away.

- **`lib/currency.js`**: `formatMoney`/`formatAmountNumber` no longer
  `Math.round` — they use `toLocaleString(locale, { maximumFractionDigits:
  2 })` instead. This is backward-compatible with every existing (whole-
  number) row: `(1234).toLocaleString(..., {maximumFractionDigits:2})` still
  renders `1,234`, no forced `.00`. Only a value that genuinely has a
  fractional part now shows it, capped at 2 digits — which also quietly
  fixes stray float noise from division (e.g. Analytics' average-expense
  figure) rather than letting it run past 2 digits unbounded.
- **New `sanitizeAmountInput(text)`** in `lib/currency.js` — the shared
  typed-input filter: keeps digits and at most one decimal point, capped to
  2 fractional digits as you type. Replaces the old `v.replace(/[^0-9]/g,
  '')` (which stripped `.` entirely) at **every** money `TextInput` in the
  app: `AddTransactionSheet`, `AddBudgetSheet`, `AddBillSheet`,
  `AddPlanSheet`, `PayBillSheet`, `onboarding/balance.js`,
  `onboarding/expense.js` — not just the two onboarding screens named in the
  bug report. Leaving the main app's Add-sheets decimal-blind while
  onboarding allowed cents would mean a USD user could enter $4.56 exactly
  once (during onboarding) and never again.
- **Edit-prefill sites stopped rounding, too** — same bug, opposite
  direction: `AddBudgetSheet`/`AddBillSheet`/`AddPlanSheet`/`PayBillSheet`/
  `AddTransactionSheet` all had `setAmount(String(Math.round(existing.amount)))`
  when opening an existing record to edit. Left as-is, editing a genuine
  $4.56 bill would show "5" in the field, and saving would silently truncate
  it back to a whole number — a real data-corruption path for any decimal
  amount, not just a display nit. All six sites now do
  `setAmount(String(existing.amount))`. This included
  `AddTransactionSheet`'s **AI receipt-scan** prefill
  (`captureAndScan` → `setAmount(String(Math.round(draft.amount)))`) — receipt
  totals routinely have cents/paise, so this was quietly destroying real
  parsed data even before any of this currency work.
- Verified behaviorally (not just parsed): `sanitizeAmountInput` against 8
  cases (multi-dot input, truncation to 2 digits, empty string, leading
  dot); `formatMoney`/`formatAmountNumber` against whole numbers (unchanged
  output), genuine decimals (`$4.56` preserved), division noise
  (`233.33333333` → `233.33`, not left ragged), and negative decimals
  (`-$4.56`, not rounded to `-$5`).

### 2.6 Impact on existing features

| Area | Impact | Watch for |
|---|---|---|
| `accounts` / `bills` | +`currency` column, default INR | Backfill covers all existing rows |
| `handle_new_user` | **Not modified** (deviation — see §2.1) | The column default alone already produces the correct INR value at signup |
| Every money surface | Formats in the relevant account's currency | Active-account surfaces use `useCurrency()`; switcher/bills use the row's own |
| `AddAccountSheet` | Currency field; locked once txns exist | Editing an in-use account must show it read-only, not silently drop the change |
| `app/report.js` | All-accounts total is currency-aware | Single-currency users unchanged; multi-currency scopes to active currency |
| `app/settings.js` | Dead row becomes profile-default picker | Copy must say "default for new accounts", not imply a global relabel |
| Grandfathered/existing user | All accounts INR | Zero visible change unless they add a non-INR account |

### 2.7 What this phase does NOT include

- **No FX / conversion / rate anything** — the model forbids it.
- **No changing an in-use account's currency** — immutable once it has txns.
- **No `original_amount`/`original_currency` display columns** (the "₹1,250
  (฿500)" foreign-trip trivia from idea #9) — genuinely optional, deferred.
- **No subscription-pricing change** — see §Out of scope.
- **No auto-detect / SMS-parser localization** — see §Out of scope.
- **No onboarding currency step** — deferred (stays INR).

### 2.8 Phase 2 checklist

- [x] `accounts.currency` + `bills.currency` columns applied (default `'INR'`) via Supabase MCP; all 7 existing accounts + 8 existing bills backfilled to INR (verified). `handle_new_user` deliberately not modified — see §2.1.
- [x] `hooks/useCurrency.js` returns the active account's currency (INR fallback).
- [x] `CurrencyPicker` built; used in AddAccount, AddBill, and Settings.
- [x] New account defaults to profile currency; currency locks read-only once the account has ≥1 transaction; freely editable at 0.
- [x] Settings' dead "₹ INR" row is a working profile-default picker; changing it affects only new accounts.
- [x] Every surface formats in the right currency (active-account surfaces via `useCurrency()`; switcher cards + bills in their own).
- [x] All-accounts report never sums across currencies (single-currency users unchanged; multi-currency scopes to active + shows the note).
- [ ] On-device: create a USD account → its balance/txns/budgets show `$`; the INR account still shows `₹`; the switcher shows each correctly; an in-use account's currency is locked. **Not yet verified on-device.**

### Implementation Notes

- **Migration applied via the Supabase MCP**, not by hand — see §2.1 for the
  verification (backfill counts, advisors). `handle_new_user` was
  deliberately **not** modified (a deviation from the original plan, decided
  once the live schema was confirmed): the new `currency DEFAULT 'INR'`
  column already produces the correct value for a new signup's auto-created
  Personal account, since the profile row it would read is itself created in
  the same trigger, always defaulting to `'INR'`. Seeding from the profile
  would have been a no-op today. The behaviour that actually needs the
  profile default — a user who changed their Settings default, then adds a
  *new* account later — is handled client-side in `AddAccountSheet` (the
  picker defaults to `profile.currency`). Rewriting a `SECURITY DEFINER`
  trigger blind, for zero functional gain, wasn't worth the risk.
- **`CurrencyPicker` gained a `renderTrigger` escape hatch** beyond the
  original spec: `app/settings.js`'s Currency row needed its own icon-tile
  trigger style (matching its other rows — icon + title/hint + value), not
  the component's default summary-row look used by AddAccount/AddBill.
  `renderTrigger(selectedMeta, toggle)` lets Settings supply its own trigger
  while still reusing the shared open/close state and option list — avoids
  duplicating the list-rendering logic a third time.
- **`AddAccountSheet`'s immutable-once-used guard defaults to `locked=true`
  while editing**, flips to the real answer once an async transaction-count
  query resolves (present the sheet immediately either way — no delay).  A
  safe-by-default choice: briefly disabling an actually-empty account's
  currency field for a beat is harmless; briefly *allowing* an in-use
  account's currency to be edited before the count resolves is not.
- **The all-accounts report rule** (§2.4) only ever activates for a genuinely
  multi-currency user (`new Set(accounts.map(a => a.currency)).size > 1`) —
  computed once via `isMultiCurrency`, with a `reportCurrency` (the active
  account's currency) used to filter the *summed* figures (`totalIncome`,
  `totalExpense`, `netSaved`, category breakdown, the donut, and which
  transaction counts as "biggest") into a new `currencyScopedCurrent`/
  `currencyScopedPrior` pair. The Budgets/Plans list sections and the
  Biggest-Transaction amount itself were **not** filtered this way — each of
  those rows already renders in its *own* account's currency (via `acc` /
  `accountFor(...)`), so there's nothing to sum there and no exclusion
  needed. Single-currency users (everyone today) see zero behavioral change:
  `currencyScopedCurrent === scopedCurrent` whenever `isMultiCurrency` is
  false.
- **Known, deliberately deferred gap**: bill-related **notifications and
  alerts** (`hooks/useAlerts.js`, `lib/notifications.js`, `lib/koban.js`)
  still format via `lib/money.js`'s INR-only `formatMoney` — unchanged from
  Phase 1 by design (background/notification copy, not a primary money
  surface). A non-INR bill's push notification or bell-alert text will show
  `₹` instead of its real symbol. Doc's §2.3 never listed these files, and
  the affected population (a user with a non-INR *bill*) is smaller still
  than one with a non-INR *account*. Flagging rather than silently
  expanding scope; revisit if it matters in practice.
- **CSV export** (`lib/export.js`) still has no currency column — amounts
  are plain numbers with no way to tell which currency each row is in once
  an export mixes accounts. Explicitly called out as "Phase 2's call, not a
  formatting change" in the Phase 1 notes; the call made here is to leave it
  for now (genuinely rare case, and adding a column is a real scope item, not
  a one-line fix) — same "optional, deferred" treatment as the
  `original_amount`/`original_currency` idea from §2.7.

**→ Stop here. Show the result and wait for approval.**

---

## Out of scope (all phases)

- **Subscription pricing localization** — a *billing* concern, not a currency-
  display one. `lib/pro.js` placeholder ₹ prices stay untouched; when RevenueCat
  / Play Billing lands, the paywall reads store-provided localized prices driven
  by the user's store-account region (a different axis from in-app account
  currency, and one that needs no FX rate). Coupling the two would require a
  rate this feature's whole model avoids, and would be wrong when a user's
  billing region differs from their account currency.
- **Exchange rates / conversion / multi-currency totals** — the app never sums
  across currencies (everything is account-scoped), so no FX API, rate history,
  or cache. This is the model's core simplification, not a gap.
- **Changing an in-use account's currency** — forbidden by design (would invent
  money or destroy history). Open a new account instead.
- **`original_amount` / `original_currency` display columns** — the optional
  "₹1,250 (฿500)" foreign-transaction trivia; deferred, never aggregated.
- **Auto-detect / SMS-import outside India** — the parser regexes and
  `PromptNotifier.kt` are structurally India-specific; making them region-aware
  is a separate, much larger effort. Currency display going global neither fixes
  nor breaks them.
- **Onboarding currency step** — deferred; onboarding stays INR, changeable
  afterward in Settings / per account.
- **Per-currency decimals / minor units** — FLO shows whole units for every
  currency by deliberate product choice; amounts stay whole numbers.
