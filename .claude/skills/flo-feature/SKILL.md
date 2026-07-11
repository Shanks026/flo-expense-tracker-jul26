---
name: flo-feature
description: Use this skill whenever the user wants to plan, design, research, or build a new feature for FLO (the personal expense tracker built with Expo/React Native + Supabase) — or continue building an existing one. Triggers on phrases like "I want to build", "new feature", "let's add", "I'm thinking of adding", "plan this feature", "implement this", "let's do phase 2 of", "continue the X feature", or any description of new product functionality for FLO — transactions, budgets, plans, categories, analytics, settings, auth, or anything else in the app. Also triggers when the user asks to extend or modify an existing FLO feature. This skill analyses fit and scope against FLO's actual data model and conventions, produces or updates a phased implementation markdown file in `.claude/features/`, and guides the build phase by phase with approval gates. Always use this skill before writing any feature code for FLO — the planning doc must exist first.
---

# FLO Feature Planning & Implementation Skill

You are helping build **FLO** — a single-user personal expense tracker built with Expo (React Native, JavaScript), `expo-router`, and Supabase (Postgres + Auth + RLS). Your job is to plan features carefully and then build them one phase at a time, stopping for approval between phases.

FLO's core principle, from `FEATURE_PLAN.md`: everything is derived from the `transactions` table. Balances, budget `remaining`, and plan progress are always **computed** (via Postgres views or client-side aggregation), never stored as a running total. Any new feature that stores a derived number instead of computing it is working against the grain of this app — flag it if a feature seems to need that.

---

## Step 1 — Orient Yourself

Read these before doing anything else:

- `AGENTS.md` (via `CLAUDE.md`) — project-level instructions
- `FEATURE_PLAN.md` — the original product spec and v1 data model (all its phases are already built; treat it as the historical foundation doc, not a live task list)
- `.claude/features/00-index.md` — what's been planned/built since, and the running schema reference (tables, views, storage) since no SQL migration files are committed anywhere in this repo

Then check whether the user is starting something new or continuing existing work:

**If this looks like a continuation** (e.g. "let's do Phase 2 of analytics", "continue the categories feature"):
- Find the relevant file in `.claude/features/`
- Read it fully — note which phases are complete, what was deferred, what the next phase specifies
- Skip to Step 3 (or Step 4 if the doc is already fully written)

**If this is a new feature idea**:
- Scan `.claude/features/` to check if anything already covers this
- Proceed to Step 2

---

## Step 2 — Clarify and Analyse (New Features Only)

Before writing any plans, make sure you understand the feature and can recommend a sensible scope.

### Clarify First

If any of these are unclear, ask before proceeding:

- What does this replace or improve — a screen the user finds lacking, a manual calculation they're doing in their head, a gap in the three pillars (global balance, budgets, plans)?
- Is there a specific trigger for wanting this now?
- Does it need its own navigation entry, or does it extend an existing screen?

One focused question is better than a list. If the feature is obvious (e.g. "add a note character limit"), don't ask — just proceed.

### Analyse and Recommend

Think through the following, then present a clear recommendation. Be direct — don't just list considerations, say what you think.

**Does it fit?** How does this serve FLO's three pillars — global money view, budgets, plans — or is it a genuinely new pillar? New pillars deserve more scrutiny on scope.

**What does it reuse?** Map the feature to existing infrastructure: the `transactions`/`categories`/`budgets`/`plans`/`profiles` tables and their `v_*` computed views, the `useDataRefresh` version-counter pattern, the bottom-sheet provider pattern, `theme/tokens.js`. Features that reuse these ship faster and stay visually consistent.

**Client-side or database aggregation?** FLO is single-user with modest data volume. Prefer computing derived numbers client-side in a hook (fetch rows, aggregate with `date-fns`) unless the computation is reused across many screens or the row count genuinely warrants pushing it into a Postgres view/RPC. Pushing to SQL means the user must hand-paste it into the Supabase SQL editor (see Step 3.1) — don't default to that for a one-screen feature.

**What's the minimum useful version?** Define Phase 1 as the smallest thing that delivers real value on its own. Later phases should each be independently useful too.

**What are the risks?** Scope creep, any assumption about data that doesn't hold (e.g. a plan without a target/end date), anything that might surprise the user mid-build.

End with a concrete proposal:

> "I'd build this as [N] phases. Phase 1 covers [X], which means [user value]. Does this match what you had in mind, or do you want to adjust the scope?"

Wait for approval before writing the feature doc.

---

## Step 3 — Write the Feature Doc

Once scope is agreed, produce a complete feature markdown file using the structure in `referenced/feature-template.md`.

- **File name**: `[NN]-[feature-slug].md` — use the next available number from `.claude/features/00-index.md`
- **File location**: `.claude/features/[NN]-[feature-slug].md`

Write the full document — all phases, all SQL, all component/hook paths, all checklists. A vague plan creates blockers during the build. It should be specific enough that someone else could implement any phase from it without asking questions.

**On SQL specifically**: this repo has no committed migration files — schema lives only in the Supabase dashboard. Every feature doc's Database section is therefore the only durable record of that schema change. Write the full SQL in the doc (not just a description of it), tell the user exactly when to paste it into the Supabase SQL editor, and once it's confirmed applied, that block in the doc *is* the migration record — don't let it drift from what's actually live.

After writing, tell the user:

> "Feature plan saved to `.claude/features/[NN]-[feature-slug].md`. Read it through and let me know if anything needs adjusting before we start Phase 1."

Wait for approval before implementing anything.

---

## Step 4 — Phased Implementation

Implement one phase at a time. Never start a phase until the previous one is explicitly approved.

### Before Starting Each Phase

1. Re-read the phase section from the feature doc — never rely on memory
2. Verify file paths, hook names, route names, and column names by reading the actual source files before touching them — the codebase may have moved on since the doc was written
3. If the phase has SQL, give it to the user to paste into the Supabase SQL editor first, and confirm it applied, before writing any component code against it

### While Building

Build only what the phase specifies. Don't add "nice to haves", don't anticipate a later phase's requirements, don't refactor nearby code unless the feature requires it.

If you hit a blocker — a view that doesn't return what the doc assumed, a component that behaves differently than described, a missing dependency — stop immediately. Describe the blocker, propose two or three options, and ask which path to take. Don't improvise around blockers silently.

### Completing a Phase

When the phase is done:

1. Go through the phase checklist item by item and verify each one is actually true
2. Update the feature doc:
   - Check off completed items (`[x]`)
   - Add an "Implementation Notes" section below the checklist noting deviations, decisions made, or scope deferred to a later phase
   - Update the phase header to `✅ Complete`
3. Tell the user:
   > "Phase [N] complete. Built: [brief summary]. Deviations: [anything that changed from the plan, or 'none']. Ready to move to Phase [N+1] when you are."

Then stop. Wait for explicit go-ahead.

---

## Step 5 — Update the Index

After all phases are complete, update `.claude/features/00-index.md`:

- Add the feature to the Feature Files table with its status
- Add any new tables/views/columns/storage to the Schema Reference section
- Add any new reusable component/hook patterns to Shared Infrastructure Notes

---

## Conventions Reference

Quick reference only. `referenced/flo-data-patterns.md` is the source of truth — read it if anything here seems incomplete, and definitely before writing SQL or a new hook.

### Data Layer

- No separate API layer file. Reads live in `hooks/useXxx.js` (plain `useState`/`useEffect`/`useCallback`, Supabase call inside the hook, subscribed to `useDataRefresh`'s `version`). Mutations are called directly from the sheet/screen component that triggers them, then call `notifyChanged()` from `useDataRefresh` on success.
- Prefer querying a `v_*` computed view over recomputing totals client-side when one already exists (`v_global_summary`, `v_budgets_with_spent`, `v_plans_with_totals`); otherwise fetch raw rows and aggregate with `date-fns`.

### UI

- Screens are file-based routes under `app/` (`expo-router`). Tabs live in `app/(tabs)/`; pushed detail/settings screens are top-level files (e.g. `app/settings.js`, `app/plan/[id].js`).
- Quick create/edit forms are bottom sheets (`@gorhom/bottom-sheet`), each following the Provider + Context + `forwardRef`/`useImperativeHandle` pattern seen in `AddBudgetSheet.js` — a sheet is opened imperatively via its `useAddXSheet().openAddX(existingRecordOrNull)` hook, not via navigation.
- Destructive confirmations and one-off error messages use React Native's `Alert.alert` (see `manage-categories.js`). Inline form-validation errors use local `error` state rendered as `<Text>` inside the sheet (see `AddBudgetSheet.js`) — there is no toast library.
- Loading = a simple `loading` boolean; no skeleton-screen library. Empty states are a plain centered message, matching whatever's already on the Home/Transactions/Budgets/Plans screens.
- Money always formats as `` `₹${Math.round(n).toLocaleString('en-IN')}` `` — no decimals.
- Icons are `lucide-react-native` only. Category icons go through the curated key map in `CategoryIcon.js` — don't reference a Lucide component directly for a category.
- Styling is `theme/tokens.js` (`colors`, `radii`, `spacing`, `fontFamily`, `fontSize`) via `StyleSheet.create` — no inline magic numbers/hex values.

### Database

- Every table: `id uuid PK default gen_random_uuid()`, `user_id uuid references auth.users`, `created_at timestamptz default now()`. No `updated_at` column anywhere in this schema — don't add one unless the feature specifically needs edit-history, and call that out explicitly if so.
- RLS on every table: `auth.uid() = user_id`, applied to all operations.
- Derived numbers (balances, spent, remaining, progress) are never stored — expose them via a `v_*` view or compute them client-side. See the principle at the top of this file.

---

## Reference Files

- `referenced/feature-template.md` — exact structure for feature planning docs
- `referenced/flo-data-patterns.md` — DB patterns, RLS template, hook/sheet patterns, navigation conventions, formatting helpers

---

## Existing Screens & Navigation

| Screen | Route / Trigger | Type |
|---|---|---|
| Home | `app/(tabs)/index.js` | Tab |
| Transactions | `app/(tabs)/transactions.js` | Tab |
| Budgets | `app/(tabs)/budgets.js` | Tab |
| Bills | `app/(tabs)/bills.js` | Tab (swapped in for Plans 2026-07-11 — see `04-notifications-and-recurring-bills.md`'s Out of Scope note; Bills gets used more often) |
| Plans | `app/plans.js` | Pushed from Home's menu sheet (demoted from a tab in the same swap) |
| Plan Detail | `app/plan/[id].js` | Pushed from Plans |
| Analytics | `app/analytics.js` | Pushed from Home's menu sheet |
| Sign In / Sign Up | `app/sign-in.js` | Pushed (unauthenticated gate) |
| Settings | `app/settings.js` | Pushed from Home's menu sheet |
| Manage Categories | `app/manage-categories.js` | Pushed from Settings |
| Add Transaction | `AddTransactionSheet.js` | Sheet, opened from ⊕ tab or Plan Detail |
| Add Budget | `AddBudgetSheet.js` | Sheet, opened from Budgets |
| Add Plan | `AddPlanSheet.js` | Sheet, opened from Plans |
| Add Bill | `AddBillSheet.js` | Sheet, opened from Bills |
| Pay Bill | `PayBillSheet.js` | Sheet, opened from Bills or the due-bills modal |
| Add Category | `AddCategorySheet.js` | Sheet, opened from Manage Categories |
| Edit Profile | `EditProfileSheet.js` | Sheet, opened from Settings |
| Alerts | `AlertsSheet.js` | Sheet, opened from Home's bell |
| Menu | `MenuSheet.js` | Sheet, opened from Home's header — hub for Analytics/Plans/Settings/Log Out |

New global destinations that aren't part of the 5-item tab bar (Home ·
Transactions · ⊕ · Budgets · Bills) go in the menu sheet opened from Home's
header, alongside Settings — don't add a 6th tab unless the user explicitly
asks for one. The tab bar slot is not fixed forever: it was swapped once
already based on real usage (Bills replaced Plans), so a future feature could
reasonably prompt swapping it again — don't treat this table as permanent,
verify against the actual `app/(tabs)/` directory and
`app/(tabs)/_layout.js` if anything here seems stale.
