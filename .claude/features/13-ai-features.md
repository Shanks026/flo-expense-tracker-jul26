# Feature: AI Features (Edge Function proxy → categorisation → receipt scan)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/13-ai-features.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

This graduates `IDEAS-ai-features.md` into a build. AI is FLO's cross-platform,
gate-able Pro backbone (auto-detect can't ship to a store — `00-index.md`
standing note). The architectural insight from the idea doc drives the whole
design: **every AI feature is the same "unstructured input → transaction draft
→ confirm → write" shape**, so we build **one Edge Function endpoint**
(`ai-interpret`) with a **provider-agnostic seam**, not separate backends.

We start on **Google Gemini** (a key exists), behind that seam, so Anthropic can
be swapped later **server-side only** — the React Native client never changes.
This is step 1–3 of the master build sequence in
`IDEAS-subscription-and-store.md` Part 3 (Edge Function + entitlements → AI
categorisation → receipt scan), sequenced **before** pricing and the paywall so
Pro has real substance and AI unit cost is measurable.

**Non-negotiables carried in from `IDEAS.md` §3 / `06`:** the API key never lives
in the client; AI never auto-writes the ledger (it opens the prefilled
`AddTransactionSheet`); category output is constrained to the user's real
categories; AI is metered server-side because it costs real money per call.

---

## Phase Overview

```
Phase 1 — Foundation: Edge Function proxy + entitlements + metering
  The ai-interpret Edge Function (holds the Gemini key), the entitlements &
  ai_usage tables, and the provider seam with a Gemini adapter. Proven with a
  trivial text categorise call — no client UI yet beyond a dev test button.

Phase 2 — Category-onboarding revamp (descoped from AI, see note below)
  Originally planned as AI categorisation + merchant→category memory (blur-
  suggest on the note field). Descoped 2026-07-17 — see the note at the top of
  the Phase 2 section. Replaced with a non-AI curated category picker: the
  auto-seeded default set shrinks to a small absolute core, and a new
  onboarding screen lets the user pick more from a curated bank (expense +
  income) before they ever log a transaction.

Phase 3 — Receipt scanning + receipt attach
  Camera/gallery → image to the proxy → prefilled Add Transaction (amount, date,
  category, merchant) → on confirm, the image is attached to the transaction via
  a receipt_path column + private receipts bucket (the avatars pattern).
```

**After each phase: stop and wait for approval before proceeding.**

**Out of this doc (future, additive Pro — per the idea doc's post-launch list):**
the advisor/insights layer, the AI report summary, bill detection, budget
suggestions, and NL search. Each becomes its own feature doc after launch.

---

## Phase 1 — Foundation: Edge Function proxy + entitlements + metering
✅ **Complete** (built + on-device verified 2026-07-17, via Supabase MCP).

### Goal

A deployed `ai-interpret` Edge Function that: verifies the signed-in user,
checks their entitlement + monthly usage cap, calls the model **through a
provider seam** (Gemini adapter), logs the call to `ai_usage`, and returns a
validated result. At the end of this phase you can invoke it from the client and
get back a category suggestion for a piece of text — with the Gemini key living
only on the server, and every call metered. No user-facing UI yet (a temporary
dev button proves the pipe).

This is the piece everything else plugs into. Keep it small.

### Before Starting — Confirm With Codebase

- `lib/supabase.js` — confirm the client is `createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, …)`; the client calls Edge Functions via `supabase.functions.invoke('ai-interpret', { body })`, which auto-attaches the user's access token as the `Authorization` header.
- Confirm there is **no** `supabase/` folder yet (there isn't as of writing) — this phase creates it. `android/`/`ios/` are gitignored generated dirs; `supabase/` (functions + config) **should** be committed.
- Supabase project ref is `uergtlcfpwajztqgncim` (`00-index.md`).
- Verify against `information_schema.columns` for an existing table (e.g. `budgets`) that new tables match the standard column shape before applying SQL (standing rule).
- Confirm the Supabase CLI is installed (`supabase --version`); if not, see the setup block below.

### 1.0 Supabase Edge Function setup (one-time, how to create it with the key)

Run these from the project root (`FLO/`). The CLI is separate from the JS client.

```bash
# 1. Install the CLI (Windows options — pick one)
#    scoop:  scoop install supabase
#    npm:    npm i -g supabase        (or call via `npx supabase ...`)
supabase --version

# 2. Authenticate and link this repo to the FLO project
supabase login
supabase link --project-ref uergtlcfpwajztqgncim

# 3. Scaffold the function (creates supabase/functions/ai-interpret/index.ts + supabase/config.toml)
supabase functions new ai-interpret

# 4. Store the Gemini key as a server-side secret (NEVER an EXPO_PUBLIC_* var — those ship in the APK)
supabase secrets set GEMINI_API_KEY=your-gemini-key-here

# 5. Deploy (redeploy after every edit to the function)
supabase functions deploy ai-interpret
```

**Key facts about the runtime:**
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** into
  deployed functions — do not set them yourself. The function uses the
  service-role client for writing `ai_usage` and reading `entitlements` (so the
  client can never forge metering), and the caller's JWT to identify the user.
- `verify_jwt` defaults to **true** — only signed-in users can invoke it. Keep it on.
- The secret (`GEMINI_API_KEY`) is read in-function via `Deno.env.get('GEMINI_API_KEY')`.
- Edge Functions run **Deno/TypeScript**, not the RN bundle — this is the only
  TypeScript in the repo. Commit `supabase/` to git.

### 1.1 Database

Two new tables. Apply in the Supabase SQL editor (this repo has no migration
files — this block is the durable record).

```sql
-- ENTITLEMENTS: one row per user; is_pro is the server-side truth.
-- Written by the RevenueCat webhook later (master sequence step 3-4); for now
-- the author inserts their own row is_pro = true for personal-use testing.
create table public.entitlements (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  is_pro     boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()   -- FIRST updated_at in the schema; intentional:
                                          -- the RevenueCat webhook mutates this row on
                                          -- subscription changes. Flagged per the
                                          -- "no updated_at anywhere" standing rule.
);
alter table public.entitlements enable row level security;
create policy "Users read own entitlement"
  on public.entitlements for select
  using ((select auth.uid()) = user_id);
-- No client INSERT/UPDATE/DELETE policy: only the service role (Edge Function /
-- future webhook) writes is_pro, and service-role bypasses RLS.

-- AI_USAGE: append-only metering log. Raw events, not a stored total — the
-- monthly cap aggregates this (consistent with FLO's never-store-derived rule).
create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('categorise','receipt')),
  model         text,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz default now()
);
alter table public.ai_usage enable row level security;
create policy "Users read own usage"
  on public.ai_usage for select
  using ((select auth.uid()) = user_id);
-- No client write policy: the Edge Function inserts rows with the service role
-- and sets user_id explicitly. NOTE: user_id here deliberately has NO
-- `default auth.uid()` — the service role has no auth.uid(), so the function
-- must pass user_id. This is the one sanctioned exception to the
-- DEFAULT auth.uid() standing rule, because writes are server-side, not client.
```

After applying, run the security advisor and confirm no new `security_definer`
or `auth_rls_initplan` findings. Then insert your own entitlement for testing:

```sql
insert into public.entitlements (user_id, is_pro)
values ('<your-auth-user-id>', true)
on conflict (user_id) do update set is_pro = true, updated_at = now();
```

### 1.2 The Edge Function (the seam)

File structure under `supabase/functions/ai-interpret/`:

```
index.ts            # HTTP handler
lib/
  auth.ts           # resolve the user from the request JWT
  entitlements.ts   # is_pro check + monthly cap check (service-role queries)
  meter.ts          # insert an ai_usage row
providers/
  types.ts          # THE SEAM — the provider-agnostic contract
  gemini.ts         # Gemini adapter (active)
  # anthropic.ts    # later swap — implements the same contract
  index.ts          # export the active provider (single import site to swap)
```

**The seam (`providers/types.ts`)** — this is the whole portability story:

```ts
export type InterpretMode = 'categorise' | 'receipt';

export interface InterpretInput {
  mode: InterpretMode;
  // Provided category list constrains the output — the model MUST pick from these.
  categories: { id: string; name: string; type: 'income' | 'expense' }[];
  text?: string;         // categorise: the note/merchant text
  imageBase64?: string;  // receipt: the captured image
}

export interface InterpretDraft {
  category_id: string | null;   // one of the provided ids, or null if unsure
  // receipt-only fields (null for categorise):
  amount: number | null;
  occurred_at: string | null;   // 'yyyy-MM-dd'
  merchant: string | null;
  type: 'income' | 'expense' | null;
  confidence: number;           // 0..1
}

export interface InterpretResult {
  draft: InterpretDraft;
  usage: { model: string; inputTokens: number; outputTokens: number };
}

export interface Provider {
  interpret(input: InterpretInput): Promise<InterpretResult>;
}
```

**`providers/gemini.ts`** implements `Provider` using Gemini's REST API
(`generativelanguage.googleapis.com`, key from `Deno.env.get('GEMINI_API_KEY')`),
with **structured output** (Gemini's `responseMimeType: 'application/json'` +
`responseSchema`) to force the `InterpretDraft` shape, and the `category_id`
constrained to an **enum of the passed-in category ids** (this is how "never
invent a category" is enforced). Vision uses Gemini `inlineData` (base64). The
exact current Flash model id (`gemini-*-flash`) is picked at build time from AI
Studio and held in one `GEMINI_MODEL` constant — do not hard-code a stale id in
this doc. Anthropic's later adapter implements the same `interpret()` with
strict tool use / structured outputs; nothing outside `providers/` changes.

**`index.ts` flow (provider-agnostic):**
1. Resolve user from JWT (`lib/auth.ts`). 401 if absent.
2. `lib/entitlements.ts`: read `entitlements.is_pro`. If not pro → `403 { error: 'pro_required' }`. (Dev bypass: honour an `AI_ALLOW_ALL` secret so the author can test before the paywall exists — documented, off by default.)
3. Monthly cap: count this user's `ai_usage` rows for the current month; if over a `MONTHLY_AI_CAP` constant → `429 { error: 'ai_cap_reached' }`. Hard cost stop.
4. `provider.interpret(input)` (the active adapter).
5. `lib/meter.ts`: insert an `ai_usage` row (service role, explicit `user_id`, `kind`, `model`, token counts).
6. Return `{ draft }` (200). Never write to `transactions` — the client confirms.

### 1.3 Client

No feature UI this phase. Add a **temporary** dev-only test — a button in
`app/settings.js` (behind a comment marked for removal) that calls
`supabase.functions.invoke('ai-interpret', { body: { mode: 'categorise', text: 'Uber to airport', categories: [...] } })` and toasts the returned `category_id`.
This proves auth + entitlement + Gemini + metering end to end. Removed in Phase 2
once real integration lands.

### 1.4 Navigation / Integration

None — foundation only.

### 1.5 Impact on Existing Features

| Area | Impact |
|---|---|
| `lib/supabase.js` | None — `functions.invoke` uses the existing client. |
| Repo structure | New committed `supabase/` folder (functions + `config.toml`). First TypeScript in the repo; first committed Supabase artifact (schema was previously dashboard-only). |
| Schema | Two new tables (`entitlements`, `ai_usage`); no change to existing tables. |

### 1.6 What This Phase Does NOT Include

- No categorisation UI, no receipt scan, no merchant memory.
- No RevenueCat / paywall — `entitlements` is written by hand for now.
- No Anthropic adapter — Gemini only (seam present so it's a later drop-in).

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `supabase/` committed; `ai-interpret` deployed cleanly (via Supabase MCP `deploy_edge_function`, not the CLI — same result: `status: ACTIVE`, `version: 1`, `verify_jwt: true`).
- [x] `GEMINI_API_KEY` set as a secret by the user directly in the Supabase dashboard; **not** present as any `EXPO_PUBLIC_*` var or anywhere in the RN bundle (confirmed by inspection — the key is read only via `Deno.env.get('GEMINI_API_KEY')` in `providers/index.ts`, server-side).
- [x] `entitlements` + `ai_usage` tables applied (migration `ai_entitlements_and_usage`); RLS select-own policies present; security advisor shows only the 2 pre-existing WARNs (`delete_current_user`, leaked-password-protection) — no new findings.
- [x] Both existing users' `entitlements` rows inserted with `is_pro = true` (two auth users exist: `chrisaustin2001@gmail.com`, `abishek230102@gmail.com` — both granted for testing, since neither RevenueCat nor a paywall exists yet).
- [x] `providers/types.ts` defines the seam; `index.ts` imports the provider only through `providers/index.ts` (single swap site) — verified by reading the deployed file set.
- [x] Calling with **no** Authorization header returns 401 — verified live (`POST /functions/v1/ai-interpret` → `401 UNAUTHORIZED_NO_AUTH_HEADER`, rejected by the platform gateway before the function's own code runs, since `verify_jwt: true`).
- [x] **On-device verified** (2026-07-17): a real signed-in session → "Uber to airport" → Gemini correctly returned the `Travel` category at 99% confidence, constrained to that user's real category list; two `ai_usage` rows logged (`gemini-3.5-flash`, 343 input / 51 output tokens each) against the correct `user_id`.
- [x] A non-entitled user genuinely gets 403 `pro_required` — caught for real, not simulated: a third account (`chrisaustin11109@gmail.com`) signed up mid-build with no `entitlements` row and correctly got rejected (see Implementation Notes). Not yet separately verified: the 429 over-cap path (would need 200 real calls against `MONTHLY_AI_CAP`) and an adversarial off-list-category prompt — both low-risk given the schema-level enum constraint plus the code's own re-validation, but not exercised live.
- [x] Dev test button (`handleTestAi` in `app/settings.js`, labelled "Test AI Categorise (dev)") added, clearly marked `TEMPORARY — Phase 1 dev test … Remove in Phase 2`.

**Implementation Notes:**
- Built via the **Supabase MCP** (`apply_migration` + `deploy_edge_function`), not the CLI — the user set up the project this way instead of running `supabase functions new`/`deploy` locally. Functionally identical end state; `supabase/functions/ai-interpret/` is still committed to the repo as the durable source (six files: `index.ts`, `lib/auth.ts`, `lib/entitlements.ts`, `lib/meter.ts`, `providers/types.ts`, `providers/gemini.ts`, `providers/index.ts`).
- Gemini model id confirmed live (WebFetch + WebSearch, 2026-07-17) as `gemini-3.5-flash`, GA and current for `generateContent`. Held in one constant in `providers/gemini.ts`.
- Used the stable `generateContent` REST shape (`contents[].parts[]`, `generationConfig.responseMimeType`/`responseSchema`) rather than a newer "Interactions API" surface also documented by Google — chosen for higher confidence/cross-validation, not because the other surface is wrong.
- `MONTHLY_AI_CAP = 200` (`lib/entitlements.ts`) is a placeholder hard-cost-stop, not a measured value — revisit once real Gemini cost is observed via `ai_usage`.
- An `AI_ALLOW_ALL` secret is honoured as a dev-only entitlement bypass (off by default) — for testing before the paywall exists; must be removed/never set in production.
- `entitlements.updated_at` is genuinely the **first `updated_at` column in this schema** — flagged per the standing rule; justified because the future RevenueCat webhook mutates this row.
- **Real bug caught and fixed during on-device testing**: the first test attempt failed with the opaque Supabase client message "Edge Function returned a non-2xx status code". Root cause was a legitimate 403 (a brand-new third test account had no `entitlements` row yet — granted one, `is_pro = true`), but the dev button couldn't say so, because `supabase-js`'s `FunctionsHttpError.message` is generic; the actual `{ error: '...' }` body lives on `error.context` (the raw `Response`). Fixed `handleTestAi` to `await error.context.json()` and surface the real status + error code. Worth carrying forward: any future client code calling `ai-interpret` should read errors the same way, not trust `error.message`.
- Three auth users now exist in the project (`chrisaustin2001@gmail.com`, `abishek230102@gmail.com`, `chrisaustin11109@gmail.com`); all three have `entitlements.is_pro = true` for testing.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Category-onboarding revamp
✅ **Complete** (built + on-device verified 2026-07-17, via Supabase MCP + code).

> **Descope note.** This phase was originally planned as AI categorisation +
> merchant→category memory (suggest a category on the note field's blur,
> caching hits in a `merchant_categories` table). Built, then found broken
> on-device: `AddTransactionSheet`'s note field lives inside a
> `BottomSheetScrollView` with `keyboardShouldPersistTaps="handled"`, which
> doesn't reliably fire `onBlur` when tapping elsewhere — the suggestion logic
> silently never ran. Rather than fight that interaction, the approach was
> dropped: blur-suggest is fiddly UX for a one-tap saving, and it's the one
> AI feature that would've needed to work **for free, unentitled users**
> (onboarding happens before any subscription decision), which conflicts with
> "AI is the cross-platform paid backbone." All blur-suggest code was reverted
> from `AddTransactionSheet.js`, `merchant_categories` was dropped, and
> `lib/merchants.js`/`lib/ai.js` were deleted (no remaining callers). Phase 1
> (the `ai-interpret` proxy, `entitlements`, `ai_usage`) is untouched — Phase 3
> (receipt scan) still uses it.

### Goal

Every new signup gets a small **absolute** category set (auto-seeded, unchanged
from before this phase in spirit, just smaller), then — right after naming
their account, before logging anything — picks more from a curated **bank**
of common categories (both Expense and Income) on one onboarding screen. No
model call, no entitlement gate, no network failure mode: instant, free,
reliable. Existing users and anything already on a transaction/budget are
completely untouched.

### Before Starting — Confirm With Codebase (done this pass)

- `handle_new_user` (live function body, read via MCP) seeded 10 categories:
  7 expense (Food/Travel/Shopping/Bills/Coffee/Groceries/Other), 3 income
  (Salary/Freelance/Other).
- `app/onboarding/budget.js`'s `LEAK_TO_CATEGORY_NAME` hardcodes `food→'Food'`,
  `shopping→'Shopping'`, `subscriptions→'Bills'` — these three names **must**
  keep existing for every new user, or the leak-answer budget silently stops
  firing (it degrades gracefully to the "unknown" variant if missing, but
  that's not a reason to break it).
- `app/manage-categories.js`'s delete guard already blocks deleting a category
  with any transactions/budgets attached — this is the existing, sufficient
  "don't disturb categories in use" protection; nothing new was needed for it.
- `lib/onboarding.js` `STEPS` (live): `account → balance → expense → budget →
  reports → reminders → journey → commitment`. `balance.js`'s own comment says
  it "sits between account.js and expense.js on purpose" (so the first demo
  expense doesn't read as a negative balance) — the new step must not disturb
  that adjacency, so it's inserted **before** `balance`, right after `account`.
- `components/CategoryIcon.js` already had 9 unused-by-default icon keys
  (home/car/gift/entertainment/health/education/phone/fitness/savings) ready
  to reuse in the bank before adding any new ones.

### 2.1 Database

Two migrations applied via Supabase MCP.

```sql
-- Migration: reduce_default_category_seed
-- Trims the auto-seeded set from 10 to 6. Dropped ones (Travel/Coffee/
-- Groceries/Freelance) move to the onboarding bank (lib/categoryBank.js)
-- instead of being forced on every signup. Kept: Food/Shopping/Bills (the
-- budget.js leak-mapping dependency) + Other (both types) + Salary.
-- ONLY affects signups from this point forward — fires on INSERT INTO
-- auth.users, so existing users' categories are untouched.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.accounts (user_id, name)
  values (new.id, 'Personal');

  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');

  insert into public.categories (user_id, name, icon, type, is_default, color) values
    (new.id, 'Food',       'food',      'expense', true, '#E8785A'),
    (new.id, 'Shopping',   'shopping',  'expense', true, '#8A5FBF'),
    (new.id, 'Bills',      'bills',     'expense', true, '#5B6B8C'),
    (new.id, 'Other',      'other',     'expense', true, '#3A3A3A'),
    (new.id, 'Salary',     'salary',    'income',  true, '#BBDC12'),
    (new.id, 'Other',      'other',     'income',  true, '#D9738F');

  return new;
end;
$function$
```

```sql
-- Migration: drop_merchant_categories (cleanup — the descoped AI approach's
-- cache table; 0 rows, no remaining callers after this phase's revert)
drop table if exists public.merchant_categories;
```

Both applied; security advisor shows only the 2 pre-existing WARNs after each
(`delete_current_user` DEFINER, leaked-password-protection) — no new findings.

**No new table for the picker itself** — it writes plain rows into the
existing `categories` table (`is_default: true`, same as the absolute set;
both are FLO's own curated categories, as opposed to a freeform one typed
later via `AddCategorySheet`, which stays `is_default: false`).

### 2.2 Data Layer

- **`lib/categoryBank.js`** (new) — `CATEGORY_BANK = { expense: [...], income: [...] }`, each entry `{ name, icon, color }`. 15 expense options (Travel, Coffee, Groceries, Rent, Transport, Entertainment, Health, Education, Fitness, Subscriptions, Insurance, Pets, Kids, Utilities, Gifts), 5 income options (Freelance, Business, Investments, Rental Income, Gifts). Not auto-seeded — purely the onboarding picker's menu.
- **`components/CategoryIcon.js`** — 7 new icon keys added: `subscriptions` (Repeat), `insurance` (Shield), `pets` (PawPrint), `kids` (Baby), `utilities` (Zap), `business` (Landmark), `investment` (TrendingUp). The other 8 bank items reuse icons already in `ICONS` (travel/coffee/groceries/home/car/entertainment/health/education/fitness/gift/freelance).

### 2.3 Components

```
app/onboarding/
  categories.js   NEW — the picker screen, inserted between account.js and balance.js
```

- **`categories.js`** — `OnboardingScreen` (`scrollable`), title "Which categories fit you?". Two sections (EXPENSE, INCOME), each a wrapping chip grid built from `[...alreadySeededForThatType, ...bankItemsNotAlreadyPresent]`. Already-present categories (the absolute set, or anything picked on a prior visit) render **locked** — a filled chip with a small check, non-interactive, communicating "already yours" without letting the screen remove something that might already be in use. Bank items are toggleable (tap to select/deselect). "Continue" bulk-inserts only the newly-selected bank rows (`is_default: true`) via one `supabase.from('categories').insert([...])`, then `notifyChanged()`; "Just the basics for now" skips the insert entirely. Empty selection is a no-op continue, not an error.
- **Re-visit safety without a draft flag**: unlike `budget.js`'s `budgetCreatedFor` guard, this screen doesn't need one — "already exists in `categories`" *is* the dedup check (an item present after a prior insert renders locked next time, never re-offered), which is simpler and can't drift from the real DB state.

### 2.4 Navigation / Integration

`lib/onboarding.js`: `STEPS` gained `{ key: 'categories', route: '/onboarding/categories' }`, inserted right after `account` and before `balance`. New order: `account → categories → balance → expense → budget → reports → reminders → journey → commitment`. New route **file** (not directory) under an already-registered `app/onboarding/` — the project's standing "new route directory needs `expo start -c`" caveat is about new directories specifically; a new file in an existing one is picked up by a normal reload, but a full restart is safe if anything looks stale.

### 2.5 Impact on Existing Features

| Area | Impact | Watch for |
|---|---|---|
| `handle_new_user` | Seeds 6 categories instead of 10, for new signups only | Existing users' rows completely unaffected (trigger only fires on new `auth.users` insert) |
| `app/onboarding/budget.js` | None — Food/Shopping/Bills still always exist | Leak-mapping keeps working unchanged |
| `app/onboarding/balance.js` | None — still immediately follows `account` → `categories` → `balance`, adjacency preserved | — |
| `AddTransactionSheet.js` | **Reverted** to its pre-Phase-2 state — no blur-suggest, no AI import, no merchant lookups | Confirm the chip tap / note field behave exactly as before this feature started |
| `manage-categories.js` | None — already handles any category list generically | Bank-added categories delete/protect exactly like any other |

### 2.6 What This Phase Does NOT Include

- **No AI, no model call, no entitlement gating** — this whole phase is a plain data/UI revamp.
- No per-item color/icon customization in the picker — bank items use a fixed curated color; a user wanting something different still has `AddCategorySheet`/Manage Categories afterward.
- No editing of an already-created category's icon/color (no such UI exists anywhere in the app yet — out of scope here, not a regression).
- No change to the absolute category names Food/Shopping/Bills/Other/Salary — only the *set size* moved.

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] `reduce_default_category_seed` applied; `handle_new_user` seeds exactly 6 rows (4 expense, 2 income) for new signups; advisor clean.
- [x] `merchant_categories` dropped; `lib/merchants.js` + `lib/ai.js` deleted; grepped the repo first to confirm no remaining references outside this doc.
- [x] `AddTransactionSheet.js` fully reverted — no AI imports, no `categoryManuallyChosen`/`suggestionActive`/`lastSuggestedNote` state, no `handleNoteBlur`, no "Suggested" hint UI/styles, plain chip `onPress={() => setCategoryId(cat.id)}` restored, `onBlur` removed from the note field.
- [x] `lib/categoryBank.js` written; 7 new icons added to `CategoryIcon.js`.
- [x] `categories` step registered between `account` and `balance` in `lib/onboarding.js`.
- [x] `app/onboarding/categories.js` written: locked chips for already-seeded categories, toggleable chips for the rest of the bank, bulk insert on Continue, skip option, no insert on empty selection.
- [x] **On-device verified** (2026-07-17): fresh signup → account screen → categories screen appeared with the absolute set locked + bank chips togglable for both Expense and Income → confirmed working.

**Implementation Notes:**
- The user's original ask ("3–4 predefined absolute categories") was interpreted as **per type**, not a single combined number: 4 expense (Food/Shopping/Bills/Other) + 2 income (Salary/Other) = 6 absolute total. This is an explicit, adjustable interpretation — the whole list is one SQL `INSERT` plus one JS bank array, trivial to rebalance later.
- `is_default` was reused as-is (already existed on `categories`) rather than adding a new "locked/absolute" column — it already meant "one of FLO's own curated categories" (vs. a freeform typed one), and both the absolute set and the bank picks fit that meaning identically. No schema addition needed beyond the seed-list trim.
- Considered adding a `categoriesConfirmed`-style draft flag (mirroring `budget.js`'s `budgetCreatedFor` guard) to prevent double-insert on a re-visit, but the existing-name dedup already provides that guarantee for free — simpler, and can't desync from the real DB the way a separate flag could.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Receipt scanning + receipt attach
🚧 **Built 2026-07-17** (via Supabase MCP + code) — DB-verified; on-device
verification pending (needs a rebuilt dev client — see Implementation Notes).

### Goal

Point the camera at a receipt (or import from the gallery); FLO extracts amount,
date, category, and merchant, opens the prefilled Add Transaction sheet for
confirmation, and — on save — attaches the image to the transaction. The job is
the **cash blind spot** nothing else captures.

### Before Starting — Confirm Phase 1 & 2 Approved

- Re-read `EditProfileSheet.js` + `hooks/useProfile.js` — the avatars private-bucket + signed-URL pattern this reuses (`upload(arraybuffer, { upsert })`, store path, read via `createSignedUrl`).
- Re-read `AddTransactionSheet.js` `open()` else-branch — it must be **extended** to honour `payload.category_id`, `payload.occurred_at`, and a new `payload.receiptImageUri` (it currently ignores category_id and date on prefill).
- Confirm `expo-image-picker` is installed (it is — used in `EditProfileSheet`). Camera capture uses `launchCameraAsync` + `requestCameraPermissionsAsync`.

### 3.1 Database + Storage

```sql
-- Attach a receipt image to a transaction (attribute of the transaction, NOT a
-- separate ledger — receipts are never a first-class entity in FLO).
alter table public.transactions add column receipt_path text;   -- storage object path, nullable

-- OPTIONAL cheap hedge (IDEAS-ai-features.md #3): stash the full model JSON at
-- scan time. No reader yet; enables future itemised search without re-scanning.
alter table public.transactions add column receipt_data jsonb;  -- nullable, no reader in this doc
```

Storage bucket (create in the dashboard, or SQL) — **private**, mirroring `avatars`:

```sql
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Owner-scoped policies: path is prefixed by the user's id (folder = auth.uid()).
create policy "Users read own receipts"   on storage.objects for select
  using (bucket_id = 'receipts' and (select auth.uid())::text = (storage.foldername(name))[1]);
create policy "Users insert own receipts" on storage.objects for insert
  with check (bucket_id = 'receipts' and (select auth.uid())::text = (storage.foldername(name))[1]);
create policy "Users delete own receipts" on storage.objects for delete
  using (bucket_id = 'receipts' and (select auth.uid())::text = (storage.foldername(name))[1]);
```

Object path convention: `{user_id}/{receiptId}.jpg` where `receiptId` is a
client-generated uuid (the transaction id isn't known until after insert, and a
receipt can exist on a not-yet-saved draft — so key by its own uuid, store that
path in `transactions.receipt_path`).

### 3.2 Data Layer

- **Create `lib/ai.js`** (deleted in Phase 2's revert — not extend) with `scanReceipt({ imageBase64, categories })` → `invoke('ai-interpret', { body: { mode: 'receipt', imageBase64, categories } })` → returns the full `draft` (amount, occurred_at, category_id, merchant, type, confidence, plus raw for `receipt_data`).
- `lib/receipts.js` — `uploadReceipt(localUri)` (fetch → arraybuffer → `storage.from('receipts').upload('{uid}/{uuid}.jpg', …)`, returns the path), and `receiptSignedUrl(path)` (`createSignedUrl`, 24h, same TTL constant style as `useProfile`).

### 3.3 Components

- **Capture entry point — built differently than originally planned.** Instead of a
  trigger *outside* the sheet that scans first and then calls `openAdd(payload)`,
  the camera icon lives **inside the already-mounted sheet's own header**
  (next to the close button, hidden in Transfer mode). Tapping it shows an
  `Alert` choice (Take Photo / Choose from Gallery / Cancel), launches the
  matching `expo-image-picker` call (`base64: true`, `quality: 0.6`), then
  calls `scanReceipt` and applies the result **directly onto the sheet's own
  state** (`setAmount`/`setDate`/`setCategoryId`/`setNote`), rather than
  round-tripping through a special payload shape. Simpler: no new payload
  contract, and it works identically whether scanning into a **new** entry or
  onto an **already-open edit** (rescanning a transaction you're correcting
  updates it in place). `openAdd(payload)` itself was **not** extended to
  accept `receipt_path`/`receiptImageUri` — unnecessary once the scan lives
  inside the sheet. `open()`'s existing prefill already covers `category_id`/
  `occurred_at` for the edit path (`payload?.id` branch) — it was never
  missing those the way the original "Before Starting" note assumed; only the
  new receipt-specific state needed adding.
- **`AddTransactionSheet.js` changes**: new state — `receiptImageUri` (a fresh
  scan's local uri, pending upload), `pendingReceiptDraft` (the raw model
  output, for `receipt_data`), `existingReceiptPath`/`existingReceiptUrl` (an
  already-saved receipt's path + its signed-URL projection, when editing). A
  thumbnail renders whenever either the fresh or existing image is present.
  Receipts are scanned **against the expense category list unconditionally**
  (matches the model prompt's "almost always expense" framing) and the sheet
  switches to the Expense segment on a successful scan; the returned
  `category_id` is re-validated against `expenseCategories` client-side before
  being applied (defense in depth on top of the server's own enum
  constraint). A single overall `confidence` score (not per-field — that's
  what the schema actually returns) drives one toast: ≥0.6 "Receipt scanned",
  below that "Scanned — please double-check the details".
  `handleSave()`: the insert path gained `.select('id').single()` so a fresh
  scan has a row to attach to; after the core save succeeds and dismisses,
  if `receiptImageUri` is set, `uploadReceipt` + a follow-up `update` sets
  `receipt_path`/`receipt_data`. Upload/attach failure is a `warn` toast —
  the transaction itself is already saved by that point regardless.
- **`app.json` gained the `expo-image-picker` config plugin** (not previously
  listed — `EditProfileSheet` only ever used gallery picking, which needs no
  native permission declaration; the camera does). `microphonePermission:
  false` (matches the project's existing `android.blockedPermissions` stance
  on `RECORD_AUDIO`), plus app-specific `cameraPermission`/`photosPermission`
  strings for the iOS prompt.
- **No duplicate-transaction nudge built** — deferred per the plan's own
  "include only if it stays small" caveat; this pass was already a full
  phase's worth of change.

### 3.4 Navigation / Integration

Scan entry point is the camera icon in the Add Transaction sheet's own header —
no new route, no new tab, no `⊕` long-press. "Receipt history" is **not** a new
screen — it's the transaction list; a "has receipt" filter/thumbnail can come later.

### 3.5 Impact on Existing Features

| Area | Impact | Watch for |
|---|---|---|
| `transactions` | +`receipt_path`, +`receipt_data` (both nullable) | Existing rows unaffected; every read that `select('*')`s transactions now also gets these — harmless. |
| `AddTransactionSheet` | Header gains a camera icon + thumbnail row + save-side upload | The edit path (`payload.id`) keeps working unchanged; rescanning an open edit updates its fields in place rather than creating a new entry. |
| Storage | New private `receipts` bucket | Mirror the avatars delete-on-account-deletion behaviour later if receipts accumulate (note, don't build now). |
| `app.json` / native build | New `expo-image-picker` plugin config (camera permission) | **Requires a native rebuild** — `npx expo prebuild -c` (or a fresh `npx expo run:android`) to regenerate the manifest before the camera path can work on-device; a plain JS reload is not enough, per the project's standing rule on native-config changes. |

### 3.6 What This Phase Does NOT Include

- **No line-item table or UI** (`IDEAS.md` §3b — cut until a screen reads it; the optional `receipt_data` jsonb is the only concession and has no reader).
- No receipts gallery/tab, no storage-quota gate (that's a sub-screen / paywall concern for later).
- No bulk import of multiple receipts.
- No duplicate-transaction nudge (deferred — see Implementation Notes).
- No per-field confidence flagging — only one overall `confidence` score exists in the schema; see the single-toast approach above.

### 3.7 Phase 3 Checklist — Before Marking Complete

- [x] `receipt_path` + `receipt_data` added (migration `receipt_attach`); `receipts` bucket private (migration `receipts_storage_bucket`); storage RLS scoped to `{uid}/…`; advisor clean (only the 2 pre-existing WARNs, both migrations).
- [x] `lib/ai.js` recreated with `scanReceipt`; `lib/receipts.js` written (`uploadReceipt`, `receiptSignedUrl`), reusing `lib/transfers.js`'s existing `uuidv4()` CSPRNG helper rather than a new one.
- [x] `app.json` gained the `expo-image-picker` plugin (camera + photos permission strings, microphone explicitly off).
- [x] `AddTransactionSheet.js`: camera icon in header (hidden for Transfer), Camera/Gallery `Alert` choice, scan applies amount/date/category/note directly onto sheet state, thumbnail renders for both a fresh scan and an existing `receipt_path`, `handleSave` uploads + attaches after the core save succeeds, non-fatal on failure.
- [ ] **On-device verification pending** — needs a native rebuild first (`npx expo prebuild -c` / `npx expo run:android`) for the new camera permission to exist in the manifest, then: scanning opens/fills a real receipt's amount/date/category/merchant-as-note; category is constrained to the user's expense list; confirming saves the transaction **and** attaches the image; the thumbnail renders via a signed URL; an upload failure still leaves the transaction saved with a toast; `ai_usage` logs a `receipt` row per scan; editing an existing transaction with a receipt shows its thumbnail; rescanning inside an open edit updates it in place.

**Implementation Notes:**
- The capture entry point deviates from the original "outside the sheet, call `openAdd(payload)`" plan — see 3.3. Kept because it's strictly simpler (no new payload contract) and it unlocked a feature the original plan didn't have: rescanning a transaction already being edited, which just works for free since the scan writes onto whatever state is currently mounted.
- `expo-image-picker` was already a dependency (used for gallery-only picking in `EditProfileSheet`), but had **never been added to `app.json`'s `plugins` array** — gallery picking alone needs no native permission declaration on modern Android/iOS, but the camera does. This was caught by reading the installed plugin's source (`node_modules/expo-image-picker/plugin/src/withImagePicker.ts`) rather than assumed from memory.
- The Edge Function itself needed **zero changes** — `providers/gemini.ts`'s `receipt` mode (vision via `inline_data`, the full draft schema) was already built and deployed in Phase 1; Phase 3 was entirely client-side.
- **Real bug caught during first on-device test, via `get_logs`**: the first real scan showed "Couldn't read that receipt" to the user, but `mcp__supabase__get_logs(service: "edge-function")` showed the request actually **succeeded** (`200`) — just **84.5 seconds** later, versus 2–4s for every other call. The client had already given up and shown the failure toast long before the server responded; the server was never wrong, it was just too slow to matter. Root cause: an uncompressed full-resolution phone photo (often 3000–4000px on the long edge) produces a base64 payload big enough to make Gemini's own image processing take over a minute. **Fixed by adding `expo-image-manipulator`** (not previously a dependency) and downscaling to a **1600px long edge** + JPEG recompress (`compress: 0.6`) before the image ever reaches `scanReceipt` — using the module's current chainable API (`ImageManipulator.manipulate(uri).resize(...).renderAsync()` → `.saveAsync(...)`), confirmed against the installed v14 type definitions rather than assumed, since the package's older `manipulateAsync()` free function is now deprecated in favour of this contextual one. This also directly reduces per-scan Gemini image-token cost, not just latency — a second, unplanned benefit of the same fix. `receiptImageUri` now points at the downscaled file (not the original capture), so the later upload to the `receipts` bucket is smaller and faster too.
- **Second real bug, same on-device test session**: after the resize fix, a scan failed again — this time in ~3s, a genuinely different failure. `get_logs(service: "edge-function-runtime")` showed the true cause: Gemini itself returned `503 UNAVAILABLE` ("This model is currently experiencing high demand"), a transient overload on Google's side, nothing wrong in FLO's code. **Fixed in `providers/gemini.ts`** (applies to both `categorise` and `receipt` modes, not just receipts): the fetch call now retries up to 2 times with a 1s/2s backoff, but **only** on `503`/`429` — every other status (400s, auth, a malformed request) fails on the first attempt, since retrying those wastes the caller's wait with zero chance of success. Redeployed as version 2.
- **Not verified on device** (no Android SDK/device in this environment, and this phase specifically needs a fresh native build before it can be exercised at all — see the checklist's native-rebuild requirement). Both real bugs above (the 84.5s timeout and the 503) were diagnosed directly via Supabase's Edge Function logs (`get_logs`), not by asking the user to relay console output — the client-side error message alone ("couldn't read that receipt") was identical for both and gave no hint which of the two was actually happening.

---

## Data Model Summary (Final State After All Phases)

```
auth.users
   │
   ├── entitlements (user_id PK)          is_pro — server-side truth (webhook later)
   ├── ai_usage (user_id)                 append-only metering log; monthly cap aggregates it
   ├── categories (user_id)               absolute seed trimmed to 6; onboarding bank picks
   │                                       add more (is_default: true), same table, no new schema
   └── transactions (existing)
          + receipt_path  (storage object path in the private `receipts` bucket)
          + receipt_data  (optional jsonb, no reader yet)

Edge Function `ai-interpret` (Deno/TS, holds GEMINI_API_KEY):
   JWT → entitlement + monthly cap → provider.interpret() → meter → draft
   provider seam: providers/{types,gemini}.ts  (anthropic.ts = later swap, server-side only)
   (used by Phase 1 + Phase 3 only — Phase 2 is non-AI, see its descope note)
```

### `entitlements` — Schema
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | PK, `default auth.uid()`, FK → `auth.users` ON DELETE CASCADE |
| `is_pro` | boolean | NOT NULL default false; server-written only |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() — **first `updated_at` in the schema**, intentional (webhook mutates) |

### `ai_usage` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users`; **no** `default auth.uid()` (service-role write) |
| `kind` | text | CHECK `('categorise','receipt')` |
| `model` | text | model id used |
| `input_tokens` / `output_tokens` | int | for cost analysis / pricing research |
| `created_at` | timestamptz | default now() |

### `categories` — unchanged schema, changed seed
No new columns. `handle_new_user`'s seed list shrank from 10 rows to 6
(Food/Shopping/Bills/Other expense, Salary/Other income) for new signups only.
The onboarding categories picker (Phase 2) and `AddCategorySheet` both insert
into this same table with `is_default: true`/`false` respectively — no new
table exists for "bank" or "picked" categories.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Add Transaction sheet | P2's blur-suggest was reverted (no lasting change); P3 added a header camera icon + thumbnail + save-side upload | On-device verify P3 after a native rebuild (new camera permission) |
| `handle_new_user` / signup seed | Trimmed 10→6 categories, new signups only (P2) | Existing users unaffected; onboarding's new categories screen offers the rest |
| `transactions` reads (all hooks) | Rows gain 2 nullable columns (P3) | None — additive, `select('*')` picks them up automatically |
| Repo | First committed `supabase/`, first TS, first `updated_at`; `app.json` gained an `expo-image-picker` plugin entry (P3) | Commit `supabase/`; native rebuild needed for the new plugin config |
| Monetisation sequence | Provides the proxy + `entitlements` + metering the paywall builds on | Feeds pricing research (real AI cost from `ai_usage`) |

---

## Out of Scope (All Phases)

- **AI-driven categorisation of any kind (blur-suggest, or otherwise) at note-entry time** — descoped (see Phase 2's note): unreliable trigger (`keyboardShouldPersistTaps`), and structurally can't be Pro-gated since it would need to work for onboarding's unentitled, pre-subscription users. The category-onboarding revamp (non-AI) is the replacement.
- **Anthropic adapter** — the seam exists; the swap is a later server-side-only change (`providers/anthropic.ts`), no client/app change, no store resubmission.
- **RevenueCat / paywall / limit gates** — master sequence steps 3–5; `entitlements` is hand-written until then. The 403 `pro_required` is logged now, wired to an upsell later.
- **Advisor/insights, AI report summary, bill detection, budget suggestions, NL search** — post-launch additive Pro; each its own feature doc.
- **Line items, receipts gallery/tab, storage-quota gate, voice input** — deferred (`IDEAS-ai-features.md` records why for each).
- **Auto-categorising the whole back-catalogue** — only the entry being actively added is touched.
- **Per-item icon/color customization in the onboarding categories picker** — fixed curated presets only; further customization still goes through `AddCategorySheet`/Manage Categories as today.
- **Editing an existing category's icon/color** — no such UI exists anywhere in FLO yet; not introduced here.
