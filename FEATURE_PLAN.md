# FLO — Feature & Implementation Plan

> Personal expense tracker · Expo (React Native, JavaScript) + Supabase
> Brand: **FLO** · Lime `#BBDC12` · Near-black `#101010`

This document is the source of truth for the build. Work proceeds **phase by phase**. After each phase I stop and wait for your go-ahead before starting the next.

---

## 1. Product Summary

FLO is a single-user personal expense tracker. Everything is derived from one core record — a **transaction** (income or expense). Every summary in the app (balance, budgets, plan totals) is *computed* from transactions, never stored as a running total. This keeps data consistent: editing or deleting a transaction automatically corrects every number that depends on it.

Three pillars:

1. **Global money view** — In-hand balance = total income − total expense. Plus monthly income/expense.
2. **Budgets** — A spend limit for a period (week or month), optionally scoped to a category. `remaining = limit − spent-in-period`. Goes **negative (red)** when exceeded.
3. **Plans** ("realms") — A named container like *Goa Trip*. Transactions can be attached to a plan. A plan shows its own ledger and progress vs an optional target, **and** those transactions still count toward global balance and budgets.

---

## 2. Design System (extracted from the Claude Design export)

| Token | Value | Use |
|---|---|---|
| `brand` | `#BBDC12` | Primary buttons, active states, progress, accents |
| `ink` | `#101010` | Text, hero/black cards, active icons |
| `inkCard` | `#1b1b1b` | Nested cards inside black surfaces |
| `bg` | `#F6F7F3` | Screen background |
| `surface` | `#FFFFFF` | Cards |
| `border` | `#ECEDE7` | Card borders, dividers (`#F1F2ED`) |
| `muted` | `#8a8e84` / `#9a9e94` / `#b0b3aa` | Secondary text (3 steps) |
| `income` | `#5f8a15` text · `#EEF4CE` bg | Income amounts, positive states |
| `danger` | `#E5484D` / `#F0605A` · `#FBE2E1` bg | Over-budget, logout, delete |
| `warn` | `#C98A12` / `#E8A317` · `#FBEFD3` bg | Near-exhausted budget |

- **Font:** Manrope (400/500/600/700/800). Money uses 700–800 weight, tight letter-spacing.
- **Radii:** cards 20–26 · pills 99 · icon tiles 12–16 · buttons 14–18.
- **Currency:** ₹ INR, no decimals in most places (e.g. `₹42,350`).
- **Icons:** Lucide-style line icons (we'll use `lucide-react-native`).

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK (managed), React Native, **JavaScript** |
| Navigation | `expo-router` (file-based) |
| Backend | Supabase — Auth + Postgres + Row Level Security |
| Client SDK | `@supabase/supabase-js` + `@react-native-async-storage/async-storage` (session persistence) |
| State | React Context for session; lightweight per-screen fetch hooks. (Zustand only if needed.) |
| Icons | `lucide-react-native` + `react-native-svg` |
| Fonts | `@expo-google-fonts/manrope` |
| Dates | `date-fns` (period math) |
| Bottom sheet | `@gorhom/bottom-sheet` (Add Transaction) |

---

## 4. Data Model (Supabase / Postgres)

All tables carry `user_id uuid` → `auth.users`, protected by RLS so each user sees only their own rows.

### `profiles`
| column | type | notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| full_name | text | |
| currency | text | default `'INR'` |
| created_at | timestamptz | |

Auto-created by a trigger on signup.

### `categories`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| name | text | |
| icon | text | icon key (e.g. `'food'`, `'travel'`) |
| type | text | `'income'` \| `'expense'` |
| is_default | bool | seeded defaults |

Seeded on signup: Food, Travel, Shopping, Bills, Coffee, Groceries (expense); Salary, Freelance (income).

### `transactions` — the heart
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| type | text | `'income'` \| `'expense'` |
| amount | numeric(12,2) | always positive; `type` gives sign |
| category_id | uuid FK | nullable |
| plan_id | uuid FK | nullable → attaches to a plan |
| note | text | |
| occurred_at | date | transaction date (default today) |
| created_at | timestamptz | |

### `budgets`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| name | text | e.g. "Monthly Budget", "Food" |
| amount | numeric(12,2) | the limit |
| period | text | `'week'` \| `'month'` |
| category_id | uuid FK | nullable → null = overall budget |
| created_at | timestamptz | |

Recurring by nature: "month" = current calendar month, "week" = current Mon–Sun. `spent` is computed per current period from transactions.

### `plans`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| name | text | e.g. "Goa Trip" |
| icon | text | |
| target_amount | numeric(12,2) | nullable → "no target" plan |
| start_date | date | nullable |
| end_date | date | nullable |
| status | text | `'active'` \| `'completed'` |
| created_at | timestamptz | |

### Computed reads (Postgres views / RPC functions)
Rather than store totals, we expose helpers:
- `v_global_summary` → total income, total expense, in-hand balance, this-month income/expense.
- `budget_spent(budget_id)` or a `v_budgets_with_spent` view → each budget with its current-period `spent` + `remaining`.
- `v_plans_with_totals` → each plan with `total_spent` and `remaining` vs target.

RLS on every table: `auth.uid() = user_id`.

---

## 5. Core Logic Rules

1. **Add expense** → shows in transactions, lowers in-hand balance, lowers `remaining` of any budget whose period contains `occurred_at` and whose category matches (or overall budget). If `spent > limit`, remaining shows negative in red.
2. **Add income** → raises in-hand balance and this-month income. Does **not** affect budgets.
3. **Attach to plan** → also appears in that plan's ledger and counts against its target; still counts globally + against budgets.
4. **Edit / delete** → every dependent number self-corrects (all computed).
5. **Budget period** → week = Mon–Sun of today; month = current calendar month.

---

## 6. Screens (maps 1:1 to the design export)

| # | Screen | Key content |
|---|---|---|
| 01 | Sign In / Sign Up | FLO wordmark, email + password, "Sign In", Google (see Q3), toggle to Sign Up |
| 02 | Home | Greeting + avatar + notification; black hero (In Hand + month income/expense); 2 budget cards; recent transactions |
| 03 | Transactions | Month selector; All/Expense/Income + category filter chips; Spent/Received summary; list grouped by day with plan tags |
| 04 | Add Transaction | Bottom sheet; Expense/Income segment; big amount; category chips; Date + Add-to-Plan; Note; Save |
| 05 | Budgets | Cards in healthy/amber/over states; New Budget sheet (amount, Week/Month, optional category) |
| 06 | Plans | Active (black card, target progress), no-target, completed (grayed); New Plan |
| 07 | Plan Detail | Black summary card (spent/target/remaining); own expense list; Add Expense |
| 08 | Settings | Black profile card; Currency, Manage Categories, Appearance; Log Out; version |

Navigation: bottom tab bar = **Home · Transactions · ⊕ · Budgets · Plans**. The ⊕ opens Add Transaction. **Settings** opens from the Home header (avatar/notification). Plan Detail pushes from Plans.

---

## 7. Phased Implementation

Each phase lists **Backend (Supabase)** and **Frontend (Expo)** work, plus an **exit check** — what you'll be able to see/do when it's done. I stop after each phase.

### Phase 0 — Foundation & Setup
**Backend**
- Provide full SQL: all 5 tables + indexes.
- RLS policies (`auth.uid() = user_id`) on every table.
- Trigger: on new auth user → create `profiles` row + seed default categories.
- You paste the SQL into the Supabase SQL Editor (I'll give it in one block).

**Frontend**
- `npx create-expo-app` with expo-router, folder structure (`app/`, `components/`, `lib/`, `theme/`, `hooks/`).
- `theme/tokens.js` — the design-system tokens above.
- Manrope fonts, `lib/supabase.js` client, `.env` for URL + anon key.
- Reusable primitives: `Screen`, `Card`, `Button`, `IconTile`, `ProgressBar`, `AmountText`, `Pill`.

**Exit check:** App boots in Expo Go on your phone, shows a themed placeholder screen; Supabase reachable; DB schema live and RLS on.

### Phase 1 — Authentication
**Backend:** verify auth + profile-creation trigger; email/password enabled.
**Frontend:** Sign In / Sign Up screen (01); `AuthContext`; session persisted via AsyncStorage; protected routing (unauthed → auth screen, authed → tabs); Log Out.
**Exit check:** You can sign up, get auto-logged-in, close/reopen app and stay logged in, log out.

### Phase 2 — Transactions + Dashboard (core, app becomes usable)
**Backend:** transactions CRUD via SDK; `v_global_summary` view; categories read.
**Frontend:** Tab navigator + Home (02); Add Transaction sheet (04, expense/income, amount, category, date, note — plan optional here); Transactions list (03, month filter, type chips, day grouping, summary strip); tap row → edit/delete.
**Exit check:** Add/edit/delete transactions; Home balance + month income/expense update live; Transactions list filters by month/type.

### Phase 3 — Budgets
**Backend:** budgets CRUD; `v_budgets_with_spent` (current-period spent + remaining, incl. negative).
**Frontend:** Budgets screen (05) with healthy/amber/over states + progress; New Budget sheet (amount, Week/Month, optional category); Home budget cards wired to real data.
**Exit check:** Create overall + per-category budgets; spending a matching expense reduces remaining; exceeding shows negative in red on both Budgets and Home.

### Phase 4 — Plans
**Backend:** plans CRUD; `v_plans_with_totals`; wire `plan_id` on transactions.
**Frontend:** Plans list (06, active/no-target/completed); Plan Detail (07, summary + own ledger + Add Expense pre-linked); "Add to Plan" selector in Add Transaction; complete/reactivate a plan.
**Exit check:** Create a plan, add expenses into it; plan progress updates; those expenses also show globally and hit budgets; complete a plan (grays out).

### Phase 5 — Settings & Polish
**Backend:** profile update (name, currency); category management (add/edit/delete, guard in-use).
**Frontend:** Settings (08); Manage Categories; currency display; empty states, loading skeletons, error toasts, pull-to-refresh; input validation. Dark mode = optional stretch (see Q4).
**Exit check:** Edit profile/categories; polished empty/loading/error states throughout.

---

## 8. What I need from you

- **Now (Phase 0):** Supabase **anon/public key** (Project Settings → API). Project URL already provided: `https://uergtlcfpwajztqgncim.supabase.co`. Do **not** send the `service_role` key.
- **Phase 1:** In Supabase → Authentication → Providers, confirm **Email** is enabled. For quick testing I'll suggest turning **"Confirm email" OFF** so signups log in instantly (turn back on for production).
- Supabase MCP isn't connected here, so **you'll paste the SQL I provide** into the SQL Editor each time schema changes. I'll always give it as one copy-paste block and tell you exactly when.

---

## 9. Open Questions (please answer before I start Phase 0)

1. **In-hand balance basis** — Compute as *all-time income − all-time expense* (starts at ₹0 for a new account), or do you want an editable **opening balance**? *(Default: all-time, starts at ₹0.)*
2. **Email confirmation** — OK to disable email confirmation during development for instant login? *(Default: yes, re-enable later.)*
3. **Google sign-in** — The design shows "Continue with Google". Google OAuth in Expo needs extra setup (redirect URIs, Google Cloud project). Include it in v1, or ship **email/password only** now and add Google later? *(Default: email/password only for v1; keep the button hidden or disabled.)*
4. **Dark mode** — Design is light-only (Appearance shows "Light"). Build **light-only** for v1 and treat dark mode as a later add-on? *(Default: light-only v1.)*
5. **Category icons** — Fixed curated icon set you pick from when creating a category (simplest), OK? *(Default: yes, curated set.)*

---

_Last updated: 2026-07-10_
