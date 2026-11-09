# Feature: Account last 4 digits
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/45-account-last4.md`
**Status**: Planned
**Last Updated**: November 2026

---

## Context

The redesigned Home card (docs/redesign-plan.md, Home) shows the account name
on its art. With two cards or two accounts at the same bank ("HDFC", "HDFC
credit"), the name alone doesn't say which one you're using. The fix is an
**optional last 4 digits** on an account, shown as "•••• 4821".

Decided 2026-11-10: FLO never asks for a full card number, expiry, name on
card or CVV. A full card number is in scope for the PCI card-data rules and the
Play data-safety form, and an expense tracker asking for it costs trust. The
expiry does nothing here, and the cardholder name is always the user. Many FLO
accounts aren't cards anyway (Cash, UPI wallets).

---

## Phase Overview

```
Phase 1 — Last 4 on accounts
  An optional 4-digit field on the account sheet, shown on the Home card,
  the account switcher and the Accounts list.

Phase 2 — Matching (personal build only, not scheduled)
  Auto-detect and share-to-FLO pick the account whose last 4 match
  "XX4821" / "a/c *4821" in a bank SMS or notification.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Last 4 on accounts

### Goal
When adding or editing an account, the user can type its last 4 digits. The
Home card shows "•••• 4821" bottom-left, and the account switcher and Accounts
list show it in each row's second line. Accounts without one look as they do
today.

### Before Starting — Confirm With Codebase
- `lib/AccountContext.js` still selects `*` from `accounts`. If it does, the
  new column reaches every consumer with no hook change.
- `components/AddAccountSheet.js`: the `payload` built in save (currently
  `{ name, description, color, currency }`) and how it pre-fills on edit.
- `components/AccountSwitcherSheet.js` and `app/accounts.js`: what each row's
  second line shows today (description? balance?), so last 4 joins it
  rather than replacing it.
- `components/ledger/AccountCardCarousel.js` already renders
  `•••• {account.last4}` when present (added with the Home preview). Check
  that it still does.
- `components/AccountHeroCarousel.js` (today's live Home): decide whether to
  show it there too, or leave it for the Home rebuild.

### 1.1 Database

One nullable column, checked to be exactly 4 digits. RLS on `accounts`
already covers it (`auth.uid() = user_id`); no view reads it.

```sql
-- 45-account-last4, Phase 1
alter table public.accounts
  add column last4 text
  constraint accounts_last4_format check (last4 is null or last4 ~ '^[0-9]{4}$');

comment on column public.accounts.last4 is
  'Optional last 4 digits of the card or bank account, display only (spec 45). Never a full number.';
```

The check is the real guard: a full card number can't be stored even if a
client bug sends one.

### 1.2 Data Layer
- No new hook. `useAccount()` exposes `accounts` with `last4` once the
  column exists.
- Mutation stays inline in `AddAccountSheet.js`: `payload.last4 =
  last4.trim() || null`, through the existing insert/update, then
  `notifyChanged()` as now.
- A small formatter in `lib/accounts.js` (new, or wherever account helpers
  live): `maskedLast4(account)` → `'•••• 4821'` or `null`. It's used by three
  screens, so it lives in `lib/`.

### 1.3 Components
- **`components/AddAccountSheet.js`:** a new optional field under the name,
  labelled "Last 4 digits (optional)".
  - `keyboardType="number-pad"`, `maxLength={4}`, and non-digits are stripped
    on change.
  - Hint: "Only the last 4, to tell your cards apart. FLO never asks for a
    full card number."
  - Validation: blank, or exactly 4 digits. Otherwise an inline error reads
    "Enter all 4 digits or leave it blank".
  - Pre-filled on edit.
- **`components/ledger/AccountCardCarousel.js`:** already done (bottom-left,
  12/500, letter-spacing 1, the theme's text colour at 0.8).

### 1.4 Navigation / Integration
- **`components/AccountSwitcherSheet.js`:** the row's second line gets
  "•••• 4821", joined to whatever is there with " · ".
- **`app/accounts.js`:** same in each account row.
- No new routes.

### 1.5 Impact on Existing Features

| Area | Change | Watch for |
|---|---|---|
| `accounts` table | new nullable `last4` | existing rows stay null; inserts that omit it are fine |
| Add/Edit account sheet | one new field | the sheet's keyboard behaviour (docked keyboard on the emulator) |
| Switcher, Accounts list | extra sub text | long names plus last 4 truncating on narrow phones |
| CSV export (`lib/export.js`) | none | it doesn't export accounts |
| Ask FLO (spec 44) | none in Phase 1 | the context builder must not start sending last 4 to the model without a decision |

### 1.6 What This Phase Does NOT Include
- Matching SMS or notifications by last 4 (Phase 2, personal build only).
- An account type (card / bank / cash / UPI).
- Asking for last 4 in onboarding (the redesign's "Where does your money
  live?" question may add it later).
- Full card number, expiry, name on card, CVV: never.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [ ] SQL applied in Supabase; the column and check are confirmed with `information_schema` / `pg_constraint`
- [ ] Inserting `'12345'` or `'12a4'` is rejected by the check
- [ ] Add account with last 4 → saved; edit pre-fills it; clearing it saves null
- [ ] Typing letters does nothing; 1–3 digits shows the inline error and doesn't save
- [ ] Home preview card shows "•••• 4821"; an account without one shows nothing
- [ ] Switcher and Accounts rows show it after any existing sub text
- [ ] Emulator check on Pixel_API_36, light and dark

---

## Phase 2 — Matching (not scheduled)

Personal build only (auto-detect is never shippable, see AGENTS.md).
`lib/detect.js` and the share-to-FLO parser (spec 40) extract a 4-digit
account hint ("XX4821", "a/c *4821", "card ending 4821"). When exactly one
account has that `last4`, the draft uses it instead of the active account.
Plan it in detail when it's picked up.
