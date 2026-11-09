# Feature: AI assistant (quick add + chat, via OpenRouter)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/44-ai-assistant.md`
**Status**: Planned — spec, not built
**Last Updated**: November 2026 (written 2026-11-08)

---

## Context

On 2026-11-08 the person lifted the "no AI" rule. FLO is now a **personal-use
app first**, and the goal is quick, accurate results and a much better UX for
the author; a store launch comes later. See the standing rule "AI is back" in
`00-index.md`. The two earlier attempts (`13-ai-features.md` → `ai-interpret`,
and `ai-report-summary`) were removed mainly because API credits couldn't be
bought; OpenRouter now takes UPI top-ups. The person's verdict on the old
attempts, *"it doesnt work. plus it very slow"*, sets this spec's design rules:

1. **Speed.**
   - A local parser handles simple entries with no network call.
   - Speech-to-text runs on the device.
   - The default model is fast and cheap.
   - Phase 1 is gated on measured latency.
2. **Accuracy.**
   - **The model never writes to the database.** It returns a draft, which
     fills in the Add sheet, or a proposal, which opens the right sheet
     pre-filled. The person taps Save, and the sheet's existing save code
     runs. Validation, Pro gates, RLS and `notifyChanged()` all apply unchanged.
   - **The model never does arithmetic.** Totals, balances and breakdowns are
     computed by server code from the database. The model only picks which
     tool to call and phrases the result.
3. **Proof before scale.** Phase 1 must pass a phrasing test set before the
   chat (phases 3–4) is built.
4. **Key handling.** The OpenRouter key lives only in an Edge Function secret.
   The function calls OpenRouter over plain HTTPS, with no SDK. The app never
   sees the key or calls a model directly.

What it reuses:
- the Add sheet's existing prefill payload (`openAdd({ type, amount, categoryId, date, note })`);
- the Add Budget and Add Bill sheets;
- `v_global_summary`, `v_budgets_with_spent` and the `bills` table;
- the exact-type discipline on `transactions.type`;
- `useDataRefresh` and `useAccount`;
- `lib/smsParser.js`'s style of a pure, dependency-free parser that returns
  `null` rather than a wrong guess.

---

## Model choice (OpenRouter, checked 2026-11-08)

Prices come from `https://openrouter.ai/api/v1/models` (the data behind
openrouter.ai/models), in USD per **million** tokens. Re-check before
building; they move.

| Model id | Input | Output | Tools | Structured output | Notes |
|---|---|---|---|---|---|
| **`anthropic/claude-haiku-5.5`** | $0.10 | $0.50 | ✓ | ✓ | **Default for both modes.** Released 2026-10-07, 1M context, strong at tool use and JSON. |
| `google/gemini-3.1-flash-lite` | $0.25 | $1.50 | ✓ | ✓ | **Challenger in the phase 1 test.** Takes audio input, which keeps a server-side voice path open. |
| `google/gemini-2.5-flash-lite` | $0.10 | $0.40 | ✓ | ✓ | Older (2025-07); a cheap fallback. |
| `anthropic/claude-sonnet-5.5` | $2.00 | $10.00 | ✓ | ✓ | Escalation for the chat only, if Haiku fumbles multi-step questions. Not the default. |
| `deepseek/deepseek-v4.1-flash` | $0.05 | $0.57 | ✓ | ✓ | Cheapest, but **not used**: it's routed to providers whose data policies are weaker, and this is financial data. |

**Rough cost:**
- A quick add sends about 1,500 tokens and gets about 150 back. On Haiku 5.5
  that's about **$0.0002 (about 2 paise)**.
- A chat question with two tool rounds sends about 15k tokens and gets about
  1k back: about **$0.002 (about 20 paise)**.
- 30 quick adds and 10 chat questions a day comes to under **$1 a month**.
- `ai_usage` records the real cost per call. OpenRouter returns it in `usage`.

The model ids are **Edge Function secrets** (`AI_MODEL_QUICK`, `AI_MODEL_CHAT`,
`AI_MODEL_FALLBACK`), so switching models needs no app release. Each request
sends `models: [primary, fallback]` so OpenRouter fails over by itself.

---

## Phase Overview

```
Phase 1 — Typed quick add + the ai-assistant function
  Type "40 lunch today" at the top of the Add sheet; the local parser or the
  model fills in amount, type, category, date, account and note; you tap Save.
  Gated by a 40-phrase test set.

Phase 2 — Voice quick add
  A mic button in the same field; on-device speech-to-text (en-IN and hi-IN)
  feeds the same pipeline. Needs a new dev build.

Phase 3 — Assistant chat, read only
  A chat screen that answers questions about spending, accounts, budgets and
  bills, using server-side tools that compute every number.

Phase 4 — Assistant chat, proposals
  The chat proposes a transaction, budget or bill; a card opens the right
  sheet pre-filled; nothing is saved without your tap.

Phase 5 — Launch hardening (documented only; built when the store launch is planned)
  Consent, privacy policy, Play data-safety form, Pro gating and per-user caps
  for other users.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Shared: the `ai-assistant` Edge Function

`supabase/functions/ai-assistant/index.ts` (Deno). It's FLO's second Edge
Function after `send-push`.

- **Auth.** Keep `verify_jwt = true`. Build the Supabase client with the
  caller's `Authorization` header, so **every query runs as the user under
  RLS**. Never use the service role for reads or writes here.
- **One endpoint, two modes:** `POST { mode: 'quick_add', text, today, tz }`
  and `POST { mode: 'chat', conversation_id?, message, today, tz }`. The client
  sends `today` and `tz` (as `TimezoneSync` does); the function never guesses
  the date.
- **Context it loads itself:**
  - the user's accounts (`id`, `name`);
  - their categories (`id`, `name`, `type`);
  - `profiles.currency`.

  These go into the system prompt as compact JSON. Raw transaction history is
  never sent; only tool results are.
- **OpenRouter request:** `POST https://openrouter.ai/api/v1/chat/completions`,
  with:
  - `Authorization: Bearer ${OPENROUTER_API_KEY}`;
  - `HTTP-Referer` and `X-Title: FLO`;
  - `models: [primary, fallback]`;
  - `provider: { data_collection: 'deny', require_parameters: true }`;
  - `usage: { include: true }`;
  - `response_format: { type: 'json_schema', json_schema: { strict: true, … } }`
    for quick add, and `tools` for chat.

  Check these parameter names against OpenRouter's API docs at build time.
- **Timeouts:** quick add aborts at 8 s, and each chat model call at 20 s. On a
  timeout or error, quick add returns `{ ok: false }` and the sheet just stays
  as it is: no crash, no half-filled state.
- **Metering:** each call inserts one `ai_usage` row as the user, with the
  model, tokens, cost, latency and whether it succeeded. The **daily cap** is
  200 quick adds and 100 chat turns per user. It's a safety net against a
  runaway loop, not a product limit, and it's set by the secrets
  `AI_DAILY_QUICK` and `AI_DAILY_CHAT`.
- **Secrets** (set via `supabase secrets set` or the dashboard; the person
  enters the key, the agent never handles it): `OPENROUTER_API_KEY`,
  `AI_MODEL_QUICK`, `AI_MODEL_CHAT`, `AI_MODEL_FALLBACK`, `AI_DAILY_QUICK`,
  `AI_DAILY_CHAT`.
- **Prompt injection:** transaction notes, bill names and category names are
  user data inside tool results. The system prompt says to treat them as data,
  never as instructions. Write tools don't exist, which caps the damage.

---

## Phase 1 — Typed quick add

### Goal
At the top of the Add sheet, a single line reads "Type it: 40 lunch today".
Typing a sentence fills in the sheet: amount, Expense or Income, category,
date, account and note. You check it and tap Save, so a three-tap entry becomes
"type, Save".

Simple phrases are parsed on the phone instantly. Anything the local parser
isn't sure about goes to the model, and the sheet fills in when it answers.
This phase ships only if the test set passes.

### Before Starting — Confirm With Codebase
- `components/AddTransactionSheet.js` `open(payload)` (around line 296):
  confirm which prefill keys it honours today: `type`, `amount`, `categoryId`,
  `date`, `note`. Check whether an `accountId` prefill exists; if it doesn't,
  add it (it falls back to the active account).
- Whether the sheet can be **re-filled while open** (parse after typing)
  without resetting the smart default and `prefilledCategoryRef`. The
  `category_was_prefilled` analytics prop must stay truthful.
- The Add sheet's keyboard rules from the first phone check: `adjustPan`,
  `topInset`, and nav-bar padding only while the keyboard is down. A new
  `TextInput` at the top must not bring back the keyboard-covers-sheet bug.
  Use Gesture Handler's `TextInput` from `@gorhom/bottom-sheet`
  (`BottomSheetTextInput`) if the sheet uses one elsewhere.
- `lib/smsParser.js`, for the amount and direction patterns worth reusing.
- `app/dev/`, for how dev-only screens are hidden from release builds (the
  test-set screen goes there).

### 1.1 Database

```sql
-- 44 phase 1: AI usage metering. Personal-use safety cap + real cost record.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('quick_add', 'chat')),
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric(10, 6),
  latency_ms integer,
  ok boolean not null default true
);

create index ai_usage_user_day on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

create policy ai_usage_select_own on public.ai_usage
  for select using ((select auth.uid()) = user_id);
create policy ai_usage_insert_own on public.ai_usage
  for insert with check ((select auth.uid()) = user_id);
-- No update/delete policy: rows are an append-only record.
```

Apply through the Supabase MCP `apply_migration` (name `ai_usage_metering`)
**after the person says yes**, then run the security advisor. Note that
`execute_sql` was refused by the MCP on 2026-11-08 ("You do not have
permission"); sort that out first (see the roadmap chores), or the
verification below can't run.

### 1.2 Data Layer
- **`lib/quickParse.js`** (new, pure, no imports beyond `date-fns`):
  `quickParse(text, { categories, accounts, today }) → { amount, type, categoryId, accountId, date, note, confidence } | null`.
  (Rules settled in the 2026-11-09 grilling; see "Quick-add decisions" below.)
  - **Amount:** the only number, allowing `₹`, `rs`, `rupees` and `k` (2k = 2000).
    Two numbers ("2 chai 40") → `null`.
  - **Type:** income on got, received, credited, refund, mila, salary,
    trade/trading/profit, amma/mom; otherwise expense. The type picks which
    "Other" is used.
  - **Date:** today/inniki/indru, yesterday/nethu, day before
    yesterday/munnaal, a weekday name (the most recent *past* one, never
    today), and a day number ("5th", "5/11", always day first) meaning this
    month, or last month if that day is still ahead.
  - **Category:** a category's own name always matches. Words also carry an
    **ordered fallback list**, and the first category the user has wins (lunch
    → Lunch, else Food; chai → Snacks, else Coffee, else Food; auto → Transport,
    else Travel; petrol → Fuel, else Transport; recharge → Bills, else
    Utilities; transfer/sent → Transfer). The lists are generic, because the
    person's new account starts from the onboarding bank (`lib/categoryBank.js`),
    not from today's categories. No match → `null`.
  - **Account:** an account's name, plus shortcuts (bob/baroda → Bank of
    Baroda). If none is named, the active account.
  - **Note:** the leftover words, after the amount, category, date, account and
    filler words (spent, paid, for, on, rs) are removed. "120 lunch with ravi"
    → "with ravi"; "120 lunch" → no note.
  - **Confidence:** high only when the amount and category are both found and
    nothing is ambiguous. Below that → `null`, and the model is called. The
    model gets the local time, so a bare "food" or "swiggy" can be read as the
    right meal.
- **`lib/ai.js`** (new): `aiQuickAdd(text)` calls
  `supabase.functions.invoke('ai-assistant', { body: { mode: 'quick_add', text, today, tz } })`
  and maps the reply's ids back onto the sheet's prefill keys. It drops any
  `categoryId` or `accountId` that isn't one of the user's own.
- **The function's quick-add schema** (strict JSON): `{ type: 'expense'|'income', amount: number, category_id: string|null, account_id: string|null, date: 'YYYY-MM-DD', note: string|null }`.
  The function then checks the reply: amount above 0 and at most ₹1 crore;
  ids in the lists it sent; date within ±1 year of `today`. If any check
  fails, it returns `{ ok: false }` instead.
- **Account-to-account transfers are out of scope** for quick add ("500 SBI to
  Axis", naming two of your accounts, fails the check). Use the sheet's
  Transfer tab. "Transfer 500" or "500 sent to ravi" is an ordinary expense in
  a Transfer category, if the person has one.

#### Quick-add decisions (grilling, 2026-11-09)
- **The test set** (`lib/aiEvalCases.js`, 40 phrases) is weighted to what the
  person logs: about a third meals and snacks, then transport, groceries and
  bills, about 6 income, about 6 edge cases ("asdf", two accounts, two numbers,
  no amount) and about 4 Tanglish phrases in English letters. There's no
  Hinglish. Expected categories are given by name. The agent drafts the
  phrases and the person reviews them before the parser is written.
- **Two category sets:** each case runs against the onboarding starting set
  (Food, Groceries, Transport, Shopping, Bills, Rent, Other; Salary, Other),
  which the gate counts, and against the person's current set, which is
  reported only.
- **"Fully correct"** means amount, type, category, date and account are all
  right. The note isn't scored. The gate stays at ≥ 90% and model p50 ≤ 1.5 s.

### 1.3 Components
- **`components/QuickAddField.js`**: a one-line input with a sparkle icon and
  the placeholder "Type it: 40 lunch today"; a small spinner while the model is
  thinking. It submits on the keyboard's done key and calls
  `onParsed(prefill)`. It's a plain component that `AddTransactionSheet`
  renders above the amount.
- **`app/dev/ai-eval.js`**: a dev-only screen that runs the 40-phrase test set
  (`lib/aiEvalCases.js`) through `quickParse`, then the function. It shows
  pass/fail per field, which path answered (local or model), and latency
  (p50 / p90), and it can switch between the default and challenger models by
  passing `model` (honoured only in dev builds).

### 1.4 Navigation / Integration
- `AddTransactionSheet` shows `QuickAddField` only for a **blank new entry**:
  not when editing, and not for a share, notification or auto-detect prefill.
- **The keyboard opens on `QuickAddField`** for a blank entry, in place of the
  amount field (the existing autofocus rule at around line 256). Tapping the
  amount still works as before.
- `FLAGS.ai` (new, in `lib/flags.js`, default `true` for the personal build):
  when off, nothing AI renders anywhere.

### 1.5 Impact on Existing Features
| Existing | Impact | Watch for |
|---|---|---|
| Add sheet | A new top line, and autofocus moves to it | The keyboard covering the sheet; height jumps (the sheet sizes to its content) |
| `category_was_prefilled` / `expense_logged` analytics | A prefill from text | Add a `source: 'quick_local' \| 'quick_ai' \| 'manual'` prop |
| Smart default category | The parsed category wins over the default | Don't override a category you tapped yourself after parsing |

### 1.6 What This Phase Does NOT Include
- Voice (phase 2).
- Chat (phase 3).
- Transfers, splits or plans by text.
- Auto-saving without a tap.
- Any change to `send-push`.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [ ] `ai_usage` exists with RLS. As user A, another user's rows read as 0 and an insert for another user is refused (checked via MCP).
- [ ] The secrets are set by the person; the key appears nowhere in the repo or the app bundle (grep the `expo export` output for `sk-or-`).
- [ ] `ai-assistant` deploys and answers a quick add in a dev build. An expired session gets 401.
- [ ] The test set (`app/dev/ai-eval.js`, 40 phrases: English, about 4 Tanglish, amounts with k and ₹, relative dates, account names, income, edge cases; gate counted on the starting category set) gives **≥ 90% fully correct** and **model-path p50 ≤ 1.5 s** on the default model. Results and the model compared are written into Implementation Notes.
- [ ] At least 50% of the test phrases are answered by `quickParse` alone, instantly.
- [ ] A model timeout, or a nonsense input ("asdf"), leaves the sheet usable and unchanged, with a quiet "Couldn't read that" line.
- [ ] Saving after a parse writes the same row as a manual entry, and Undo still works.
- [ ] Emulator check on Pixel_API_36: the keyboard doesn't cover the field or Save; light and dark mode.

**→ Stop here. Show the results and wait for approval. If the test fails, stop and decide (another model, a better prompt, more local rules) before phase 2.**

---

## Phase 2 — Voice quick add

### Goal
A mic button at the end of `QuickAddField`. Hold it, say "forty rupees lunch
today", let go, and the words appear in the field and go through the phase 1
pipeline. Long-pressing the ⊕ tab opens the Add sheet already listening.
**The filled-in Add sheet is the preview** (decided 2026-11-09): the
transcript stays editable in the quick-add line, so a wrong word can be fixed
and parsed again, every field can be edited, and Save writes the entry. There's
no separate preview card.

### Before Starting — Confirm Phase 1 is Approved
- Choose the speech library. The recommended one is **`expo-speech-recognition`**
  (it wraps Android's `SpeechRecognizer`, works with a config plugin and
  supports `en-IN` and `ta-IN`). Check that it supports SDK 54 and the new
  architecture. It's an on-device library, not a third-party service, but it
  is a new native dependency: name it to the person before adding it.
- Check whether `RECORD_AUDIO` is acceptable in the personal build's manifest.
  Spec 32 removed CAMERA for the store build; a later store build will need
  the mic permission justified.

### 2.1 Database
No database changes in this phase.

### 2.2–2.4 Data, components, integration
- `lib/voice.js`: `startListening({ lang })` → partial and final transcripts,
  plus `stop()`. Prefer on-device recognition (`requiresOnDeviceRecognition`
  when the language pack is present); otherwise use Google's recognizer, which
  is the OS's, not ours.
- `QuickAddField` gets a mic button, hold-to-talk with a live transcript. On
  release, the final text is submitted as if typed.
- Settings → AI section: a voice language toggle between English (India) and
  Tamil (`ta-IN`), stored on the device. There's no Hindi (decided 2026-11-09).
- The runtime mic permission is asked the first time you use it, never at
  launch.
- A native rebuild is needed (`npx expo prebuild`, then `expo run:android`).
  Check the regenerated `AndroidManifest.xml`.

### 2.5 Checklist
- [ ] The permission is asked on the first tap only; if you deny it, the mic button hides and typing still works.
- [ ] 10 spoken phrases from the test set, in a normal room on the phone, fill the sheet correctly 9 out of 10 times.
- [ ] Speech-to-text latency (release to text) is under 1 s on the phone.
- [ ] Long-pressing ⊕ opens the sheet listening; a short tap still opens it as before.

**→ Stop here and wait for approval.**

---

## Phase 3 — Assistant chat, read only

### Goal
A chat screen where you can ask:
- "how much did I spend on food this month?"
- "breakdown of my HDFC account"
- "am I over any budget?"
- "what bills are due this week?"
- "compare this month to last month"

Every number in the answers comes from a tool the function ran against your
data.

### Before Starting — Confirm Phase 2 is Approved
- Check whether `expo/fetch` supports streaming on SDK 54. If it does, stream
  the reply text; if not, show a typing indicator and send the whole reply.
  Either is acceptable for phase 3.

### 3.1 Database

```sql
-- 44 phase 3: assistant conversations.
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text,
  tool_calls jsonb,      -- the assistant's tool calls (name + args), kept for replaying the conversation
  proposal jsonb         -- phase 4: a proposed transaction/budget/bill, rendered as a card
);

create index ai_messages_conversation on public.ai_messages (conversation_id, created_at);
create index ai_conversations_user on public.ai_conversations (user_id, created_at desc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy ai_conversations_own on public.ai_conversations
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ai_messages_own on public.ai_messages
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.ai_conversations c
                where c.id = conversation_id and c.user_id = (select auth.uid()))
  );
```

The `with check` on `ai_messages` stops a message from being attached to
someone else's conversation, which is the lesson of the split RLS holes. Apply
as `ai_conversations_and_messages` after a yes.

### 3.2 Tools (run inside the function, as the user, under RLS)

Every tool returns compact JSON. **Spent and earned totals filter on the exact
type strings `'expense'` and `'income'`** (the standing exact-type discipline),
so transfers and settlements never count. Balances come from
`v_global_summary.in_hand_balance`.

| Tool | Args | Returns | Source |
|---|---|---|---|
| `accounts_overview` | — | each account: name, in-hand balance, this month's income and expense | `accounts` + `v_global_summary` |
| `spend_summary` | `start`, `end`, `type` (expense\|income), `account_id?`, `group_by` (category\|day\|week\|month\|none) | total, count, groups sorted by amount | `transactions`, aggregated in the function |
| `compare_periods` | `a_start`, `a_end`, `b_start`, `b_end`, `type`, `account_id?` | both totals, difference, % change, top category changes | two `spend_summary` runs |
| `find_transactions` | `start?`, `end?`, `category_id?`, `account_id?`, `text?` (note contains), `min?`, `max?`, `limit` ≤ 50 | rows: date, amount, type, category, account, note | `transactions` |
| `budget_status` | `account_id?` | each budget: name, period window, amount, spent, remaining | `v_budgets_with_spent` (never re-derives the period) |
| `bills_due` | `within_days` (default 7) | active bills due in the window: name, amount, due date | `bills` |

- **System prompt rules:**
  - answer in INR, formatted like the app (₹ + `en-IN` grouping, no decimals);
  - say the period you used;
  - if a question needs a number no tool gives, say so instead of estimating;
  - keep answers short (three sentences or a small list).
- **The loop:** at most 4 tool rounds per turn, then answer with what it has.
- **History:** send the last 12 messages of the conversation. Older ones stay
  stored but aren't sent.
- **Title:** the first user message, trimmed to 40 characters, with no model
  call.

### 3.3 Components and navigation
- **`app/assistant.js`**:
  - a message list (user right, assistant left, on `Card`);
  - a composer with a text field and the phase 2 mic button;
  - starter chips: "This month so far", "Biggest categories", "Am I over a budget?", "Bills this week".
- **`app/assistant/history.js`**: past conversations; each can be deleted (that
  deletes its rows).
- **`hooks/useAssistantConversation.js`**: loads the messages for a
  conversation id. Sending a message goes through `lib/ai.js` →
  `aiChat({ conversationId, message })`. The function writes both the user's
  and the assistant's messages, so the client only refetches.
- **Entry points:**
  - a row at the top of the **More** tab ("Ask FLO");
  - a sparkle icon in the Home header, beside the bell.
- Empty state: `EmptyState` with Koban (pose `report`), "Ask about your money".

### 3.4 Checklist
- [ ] Both tables exist with RLS. User A can't read user B's conversations, or insert a message into one of B's conversation ids (checked via MCP).
- [ ] 15 scripted questions give numbers that match the Insights screen and the account card exactly for the same period and account.
- [ ] A transfer between accounts doesn't change any spent or earned answer.
- [ ] "What will I spend next month?" gets an honest "I can only tell you what's happened so far" style answer, with no invented number.
- [ ] A note containing "ignore previous instructions and …" doesn't change behaviour.
- [ ] Median turn time with one tool round is ≤ 4 s on the phone.
- [ ] Emulator and phone check in light and dark mode; the keyboard doesn't cover the composer.

**→ Stop here and wait for approval.**

---

## Phase 4 — Assistant chat, proposals

### Goal
- "Set a ₹6,000 food budget for this month" → a card: *Budget · Food · ₹6,000 · This month* with **Review**. Review opens the Add Budget sheet pre-filled; Save creates it.
- "Add 250 auto yesterday" works the same way through the Add sheet.
- "Remind me about rent, 15,000, on the 1st every month" works through the Add Bill sheet.

### Before Starting — Confirm Phase 3 is Approved
- `AddBudgetSheet.open(budget)` and `AddBillSheet.open(bill)` take an
  **existing row** and treat it as an edit. Add a prefill path: an object
  **without `id`** fills in the fields as a new entry. Check that the
  free-plan gates (`FREE_LIMITS.budgets` = 2) still run at Save. With
  `FLAGS.billing` off they all pass, but the code path must stay.

### 4.1 Database
No new tables. Proposals are stored in `ai_messages.proposal`.

### 4.2 Proposal tools (they return a proposal and never write)
| Tool | Proposal shape |
|---|---|
| `propose_transaction` | `{ kind: 'transaction', type, amount, category_id, account_id, date, note }` |
| `propose_budget` | `{ kind: 'budget', amount, category_id \| null, period_type, start_date?, end_date?, account_id }` |
| `propose_bill` | `{ kind: 'bill', name, amount, cadence, next_due_date, category_id }` |

The function checks every id against the user's own lists, keeps amounts
within ₹1 crore and validates the enums (`period_type` and `cadence` use the
same values the sheets write). An invalid proposal is dropped, and the model
is told why.

### 4.3 Components
- **`components/ProposalCard.js`** shows the proposal in plain words, with
  **Review** (opens the matching sheet pre-filled) and **Dismiss**. After a
  save, the card shows "Saved ✓". The sheet's own success is the signal: pass
  an `onSaved` callback if the sheets don't have one yet.

### 4.4 Checklist
- [ ] Nothing is ever written without the sheet's Save tap (checked by reading the function: there are no insert, update or delete calls on user tables except `ai_usage` and `ai_messages`).
- [ ] Each proposal kind opens the right sheet with every field filled, and Save creates exactly one row.
- [ ] A budget proposal for a category that doesn't exist asks which category you meant, and doesn't guess.
- [ ] Phone check of all three kinds.

**→ Stop here and wait for approval.**

---

## Phase 5 — Launch hardening (documented, not scheduled)

Build this only when the store launch is planned:
- **Consent:** a one-time consent before first use ("Your question and the
  numbers needed to answer it are sent to OpenRouter and the model provider").
  Use the `profiles.analytics_consent` pattern for an `ai_consent_at` column.
- **Policy and Play:** a privacy-policy section; Play data-safety
  "financial info shared with a service provider".
- **Pro:** decide whether AI is a Pro benefit (`lib/pro.js`) and set the free
  daily caps from real `ai_usage` costs.
- **Microphone:** a permission justification for the store listing.
- **Retention:** keep or prune `ai_messages` (for example 13 months, like
  `events`).

---

## Data Model Summary (Final State After All Phases)

```
auth.users ─┬─ ai_usage            (append-only cost/latency log, phase 1)
            └─ ai_conversations ── ai_messages  (phase 3; proposal jsonb in phase 4)

ai-assistant (Edge Function, as the user under RLS)
  reads:  accounts, categories, profiles.currency, transactions,
          v_global_summary, v_budgets_with_spent, bills
  writes: ai_usage, ai_conversations, ai_messages        (never user money tables)
```

### `ai_usage` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | `default auth.uid()`, FK → `auth.users` ON DELETE CASCADE, RLS |
| `created_at` | timestamptz | `default now()` |
| `kind` | text | `quick_add` \| `chat` |
| `model` | text | the model OpenRouter actually used |
| `prompt_tokens`, `completion_tokens` | integer | from `usage` |
| `cost_usd` | numeric(10,6) | from `usage.cost` |
| `latency_ms` | integer | measured in the function |
| `ok` | boolean | false on a timeout, error or failed check |

### `ai_conversations` / `ai_messages` — Schema
See the SQL in §3.1.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Add Transaction sheet | Gets `QuickAddField`; a new prefill source | Phase 1 checks: keyboard, sheet height, analytics `source` |
| Add Budget / Add Bill sheets | Gain a prefill-without-id path | Phase 4; the free-plan gates must still run |
| More tab, Home header | New "Ask FLO" entry points | Phase 3 |
| `lib/flags.js` | New `FLAGS.ai` | Phase 1 |
| Edge Functions | The second function, `ai-assistant` | Deploying it needs a yes; `AGENTS.md` already describes it |
| Old AI functions | `ai-interpret` and `ai-report-summary` are **still deployed** on Supabase (2026-08-10 note) | Delete them before phase 1 (roadmap chore) |
| `send-push` / spec 39 | None | — |

---

## Out of Scope (All Phases)

- **Auto-saving anything the model produced.** There's always a Save tap.
- **Editing or deleting existing rows through chat.** That's a future build;
  the risk is high and the value low.
- **Receipt or photo scanning.** It was tried in spec 13; revisit after phase 4
  if wanted.
- **Sending raw history to the model, or embeddings/RAG.** Tools cover the
  questions, and a personal ledger is small.
- **Server-side audio transcription.** On-device speech-to-text first; Gemini
  audio input is the fallback if on-device accuracy fails phase 2's check.
- **Auto-detect (notification listener) feeding the AI.** It stays the
  personal-build bonus as it is.
- **Multi-currency.** INR only, as the app.

---

## Implementation Notes

### Phase 1 gate: test set results (2026-11-09, ticket 03)

Run on Pixel_API_36 from `app/dev/ai-eval.js` (Settings → Developer → AI
test set). Each of the 40 phrases goes through the phone's parser first. The
ones it isn't sure about go to `ai-assistant` with the test set's own accounts
and categories and the fixed moment (Thu 12 Nov 2026, 13:30 IST). Only the
chosen model is asked, with no fallback. "Fully correct" means amount, type,
category, date and account all match.

| Category set | Model | Fully correct | Phone answered | Model right | App p50 / p90 |
|---|---|---|---|---|---|
| **Starting (gate)** | **Default: `google/gemini-3.1-flash-lite`** | **40/40 (100%)** | 29 (72%) | 11/11 | 1.65 s / 2.59 s |
| Starting | Challenger: `anthropic/claude-haiku-5.5` | 37/40 (92.5%) | 29 | 8/11 | 1.89 s / 3.35 s |
| Current | Default: Gemini 3.1 Flash Lite | 37/40 | 31 | 6/9 | 2.13 s / 2.45 s |
| Current | Challenger: Haiku 5.5 | 39/40 | 31 | 8/9 | 1.83 s / 4.35 s |

- **Timing.** "App p50" is the round trip the app sees. The function's own
  time, from the `ai_usage.latency_ms` of the same 40 calls, is shorter:
  Gemini p50 1.28 s, p90 2.05 s; Haiku p50 1.73 s, p90 3.58 s. The gap of
  about 0.4 s is the trip from the phone to the Supabase function. The first
  call of a run can be a cold start: Gemini's first was 5.1 s.
- **Cost.** About $0.00032 a call on Gemini and $0.00020 on Haiku.
- **Haiku's misses on the starting set:**
  - "shirt 1200 sunday": no read;
  - "sent 2000 to amma" and "amma ku 1000 anupinen": no category, where Other
    was expected.
- **Gemini's misses on the current set:**
  - the same two "amma" lines went to Lend instead of Transfer, which is
    arguable since both categories exist;
  - "refund 349 amazon" got no category, where Other was expected.
- **The phone is never wrong.** All 29 and 31 phone answers were right.
- **Gate:**
  - ≥ 90% fully correct on the starting set with the default model: passed (100%);
  - phone answers ≥ 50%: passed (72%);
  - **model p50 ≤ 1.5 s: passed at the function (1.28 s), failed in the app (1.65 s).**
- **Model order.** Gemini became the primary on 2026-11-09, at the person's
  choice of the quickest. Haiku is the fallback.
- **Haiku had never been answering until 2026-11-09.** Haiku 5.5's endpoints
  don't accept `temperature`. With `require_parameters` that left no
  endpoint at all, and OpenRouter answered every call from the fallback
  without saying so. The function no longer sends `temperature`. The
  `ai_usage.model` column is where a silent fallback shows up.
