# Feature: Split — Shared Expenses Between People
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/31-split-expenses.md`
**Status**: Phases 1–2 built. §2.4 (settle types) built. **Phase 3 foundation + sharing built** — invites, membership RLS, join flow, roles. Phase 3 remainder (activity feed UI, settlement confirmation, push, duplicate detection) **not built** — see 3.5. All DB-verified with two real accounts; on-device pending.
**Last Updated**: August 2026

---

## Context

A real trip triggered this (2026-08-26). Five people — Abishek, Maaz, Stephin,
Srijish, Chris — went to Mysore for a day. **Abishek paid for roughly 90% of
it** (train tickets both ways, breakfast, autos, church entry + luggage, car
museum, snacks, shell museum, zoo, lunch, after-lunch snacks). Stephin paid for
some snacks, Chris paid for one auto. Maaz and Srijish paid for nothing.

The user tried to record this under **Plans**, and Plans could not do it — a
plan collects *your own* transactions (`transactions.plan_id`), so it has no
concept of another person paying, no concept of a share, and no way to answer
"who owes whom." A plan is the right tool for *my spending on a trip*; it is
the wrong tool for *five people's spending on a trip*.

**Split is that missing tool.** You create a split, add the people in it, add
entries (what was bought, how much, who paid, who it was split between), and
the split tells you who owes whom. Nothing touches your ledger until money
actually moves — at which point settling produces a real FLO transaction
(expense if you pay, income if you're paid).

This is FLO's **first concept not derived from `transactions`**, which is why
the research section below is long. It earns the exception because of the
bridge: Splitwise can tell you that you owe ₹1,274; only FLO can tell you that
₹1,274 leaving your account blows your Food budget. Neither app alone does
both.

### Relationship to the existing design record

`.claude/features/IDEAS.md` already contains both halves of this feature,
parked:

- **"Lending / IOU tracking"** — described the single-player version (record
  who owes you, entirely inside your own ledger, no other user accounts, no
  invites) as *"the buildable version of this idea"*. **That is Phase 1 of this
  doc**, essentially unchanged.
- **"Multi-user bill splitting"** (raised 2026-07-18) — the Splitwise-shaped
  version, *"deliberately parked, not rejected"*, on two blockers:
  (1) architecture — membership-based RLS and distributed state are a different
  model from `auth.uid() = user_id`; (2) network effect — *"FLO has ~1 real user
  today, so there's no network to unlock."* **Revisit trigger: real DAU.**

**That parking is superseded by this doc, deliberately and with reasons**
(decided with the user, 2026-08-26). Two things changed the calculus:

1. **Ghost members remove the network dependency.** A split holds two kinds of
   member — real FLO users and *names* (people with no app). A split with zero
   real members is exactly the single-player version. So the feature is fully
   usable at ~1 user and gets *better* as more people join, instead of being
   worthless until a threshold is crossed.
2. **Invite links make it a growth mechanic, not a beneficiary of growth.** One
   split invite sent into the trip's existing WhatsApp group is four potential
   installs. The old parking assumed splitting had to *wait* for DAU; the
   honest read is that splitting is a plausible *path to* DAU.

The architecture blocker is real and was **not** waved away — it is confined to
Phase 3, and Phase 3's schema is Phase 1's schema plus two nullable columns, so
Phases 1–2 are not a throwaway prototype. The counter-argument stands and is
recorded: a shared feature that is confusing on first contact burns those four
installs rather than keeping them, which is why Phase 3 is last and gated on
Phases 1–2 being in real use.

**`IDEAS.md` must be updated when Phase 1 lands** — see Index Updates at the
bottom.

---

## Research & Observations

### The trip, modelled precisely

Amounts below are illustrative (the real ones weren't recorded), but the
*structure* is exactly the real trip: 5 participants, every entry split
equally, **three different payers, one payer per entry**.

| Entry | Amount | Paid by |
|---|---|---|
| Train tickets (both ways) | ₹1,750 | Abishek |
| Breakfast | ₹600 | Abishek |
| Auto — station to town | ₹300 | Abishek |
| Church entry + luggage | ₹250 | Abishek |
| Car museum entry | ₹500 | Abishek |
| Snacks | ₹220 | Abishek |
| Shell museum entry | ₹400 | Abishek |
| Zoo entry | ₹750 | Abishek |
| Lunch | ₹1,600 | Abishek |
| After-lunch snacks | ₹280 | Abishek |
| Other snacks | ₹180 | Stephin |
| Auto — lunch place to station (1) | ₹140 | Chris |
| Auto — lunch place to station (2) | ₹100 | Abishek |

**Total ₹7,070** · equal 5 ways → **₹1,414 each**

**Paid:** Abishek ₹6,750 · Stephin ₹180 · Chris ₹140 · Maaz ₹0 · Srijish ₹0

| Person | Paid | Owes | Net |
|---|---|---|---|
| Abishek | 6,750 | 1,414 | **is owed ₹5,336** |
| Chris | 140 | 1,414 | owes ₹1,274 |
| Stephin | 180 | 1,414 | owes ₹1,234 |
| Maaz | 0 | 1,414 | owes ₹1,414 |
| Srijish | 0 | 1,414 | owes ₹1,414 |

1,274 + 1,234 + 1,414 + 1,414 = 5,336 ✓ — **it nets to zero, which is the
entire point.** Any bug that breaks this invariant breaks the feature.

Three structural requirements fall straight out of this table:

1. **Every entry has its own payer.** Not one payer per split. This trip has three.
2. **Every entry has its own participant set.** A zoo ticket that covers only 4
   of the 5 must be expressible. Uneven participation per entry is the single
   most-skipped requirement in split tooling, and without it the feature is
   wrong for real trips.
3. **Only ₹140 of that entire table is a FLO transaction on Chris's phone.**
   Abishek's ₹1,600 lunch is not Chris's money and must never enter his ledger.
   This is a hard invariant, restated in Phase 1.

Also note: **two separate autos, two entries** — not one entry with two payers.
Multiple payers on a single entry was considered and **cut** (see Decisions).

### The hard problem: Splitwise doesn't track your balance, FLO does

Splitwise gets to be simple because it tracks *obligations only* — it has no
idea what's in your bank account. FLO's whole architecture is `in_hand_balance`
derived from real money movement. All of the difficulty in this feature lives
in the bridge between those two, and none of it is in the split UI.

Take the **payer's** position (Abishek). He fronts ₹6,750 and gets ₹5,336 back
over the following week. His real cost was ₹1,414.

- Log the ₹6,750 as it happens → balance correct, but his **Food category shows
  ₹1,600** when ₹320 was his, his month's expenses spike ₹6,750, and a ₹5,000
  Food budget is destroyed by a lunch he paid 1/5 of. Then ₹5,336 arriving
  inflates his **income** and lies about his savings rate.
- Log only his ₹1,414 share → analytics and budgets perfect, but for a week his
  **in-hand balance is ₹5,336 too high**. FLO thinks he has money that is out
  on loan.

Both are wrong, differently. Options considered:

| Approach | Balance | Budgets / analytics | Cost |
|---|---|---|---|
| **A. My share only, no float** | wrong during float | correct | zero schema |
| **B. Full amount + `settle_in`/`settle_out` type pair** | correct | correct | new types; **every** aggregation must be reviewed |
| **C. Full amount + `transactions.my_share`** | correct | correct only if every reader uses `my_share ?? amount` | one column; all three views + `lib/analytics.js` touched |
| **D. Reimbursement as plain income** | correct | income inflated, savings rate lies | zero schema |

**FLO already solved this exact shape once.** `transfer_in`/`transfer_out`
(`10-account-self-transfer.md`) are types that move `in_hand_balance` but are
**excluded from every spent/earned total, budget, plan, analytics function and
the streak**, because those all filter on the exact strings `'income'` /
`'expense'`. That is precisely the semantics a settlement needs: real money
moved, but it is neither income nor expense. **Option B is FLO-native, not a
hack** — it is simply not a Phase 1 change.

**Resolution (the rule this whole feature rests on):**

> **The ledger records only rupees that actually moved in or out of your
> account. The split's fairness math is entirely separate and never writes
> anything by itself.**

Under that rule there is no double-counting to reason about, because the two
systems answer different questions and never need to reconcile:

| Whose phone | Logged in FLO | Net | True cost |
|---|---|---|---|
| Maaz (paid nothing) | −1,414 (settle) | −1,414 | ₹1,414 ✓ |
| Chris (paid ₹140) | −140 (trip day) · −1,274 (settle) | −1,414 | ₹1,414 ✓ |
| Abishek (paid ₹6,750) | −6,750 (trip days) · +5,336 (settle) | −1,414 | ₹1,414 ✓ |

**Phase 1 is balance-correct in all three positions with zero new transaction
types.** The only residual issue is *categorisation* in the big-payer case
(Abishek's ₹5,336 landing as "income") — which affects analytics, never
balance. That is the B-vs-C-vs-D decision, and it is deferred to Phase 2 as an
explicit decision point with real usage behind it.

The user's original instinct — *"there is no transaction involved anywhere
until a final price is decided, then mark it as paid and that becomes a
transaction, income or expense"* — is **exactly right when you paid nothing**,
and degrades in proportion to how much you fronted. Hence the optional
per-entry "I paid this from my pocket" action in Phase 1: default off (matching
the instinct), available (making the Abishek position survivable).

### Splitwise study — what to borrow, what to leave

**Borrowed:**

- **Group → "Split"** (name, icon, date). FLO's naming is better for the app.
- **The core primitive: an entry is two vectors** — who paid, and who owes —
  each summing to the total. Every split strategy (equal, exact, shares,
  percent, itemised) is just a UI for producing the second vector. Getting this
  right in Phase 1 means later strategies are UI-only work, no schema change.
- **Equal + exact amounts only** in Phase 1. Equal covers the large majority of
  real cases; exact covers the awkward remainder. Shares/percent are flatmate
  features (see Out of Scope).
- **Per-entry participants** — the uneven-entry requirement above.
- **Payer need not be a participant** — someone can pay for a group they aren't
  part of (a parent paying for the kids' trip).
- **You can be absent from an entry** — you skipped lunch, your share is ₹0.
- **Settle up as a distinct record**, never an expense. A payment between
  people is not consumption; conflating them double-counts.
- **Debt netting** to reduce the payment list (see the note below).
- **"You owe / you are owed"** as the headline number, mirrored per viewer.
- **Permissionless-plus-visibility**, not permissions-only. Splitwise lets
  anyone in a group edit anyone's expense, and it works because every change
  lands in an activity feed with a name on it. The audit trail *is* the
  permission system. Phase 3 adopts this with one adjustment (see Decisions).

**Left out:**

- User directory search and an accept→pay→settle state machine as the *entry*
  mechanism (invite links instead — see Decisions).
- Comments, per-entry activity feed, receipt photos.
- **Cross-split netting.** Splitwise nets globally across all groups; FLO keeps
  netting strictly *within* a split. Global netting needs a friend-ledger
  concept and confuses more than it helps at this scale.
- Multi-currency splits — `IDEAS.md` idea 9 establishes that the app never sums
  across currencies. Nothing here breaks that.
- **Multiple payers on one entry** — cut, see Decisions.
- Recurring shared expenses (the flatmate case).

**A note on "simplify debts":** Splitwise's famous feature, and it matters far
less here than it first appears. Paying a *small* amount doesn't make you a
creditor — in the trip above, Stephin and Chris both paid money and are still
debtors. **There is exactly one creditor**, so every sensible algorithm returns
the same answer: everyone pays Abishek. Real trips almost always have exactly
one creditor. So Phase 1 ships **one** greedy netting algorithm and **no
toggle** — a control that changes nothing in ~90% of real splits is worse than
no control. The per-entry pairwise tracing view (which produces up to n×n
payments but where every payment maps to a real transaction between those two
people) is noted in Out of Scope. Splitwise is also legitimately criticised for
simplification inventing payments between people who never transacted; with one
creditor that criticism cannot arise.

### Scenario catalogue — what the model was tested against

| # | Scenario | Verdict |
|---|---|---|
| 1 | **Mysore day trip** (the real one): 5 people, 3 payers, one big payer, equal split throughout | ✅ Phase 1 |
| 2 | **Uneven entry**: a ticket covering 4 of 5 | ✅ Phase 1 (per-entry participants) |
| 3 | **Dinner for 4, I paid, one skipped drinks, settled by UPI that evening** | ✅ math works; but wants a <30s path — creating a named split with members and entries is too heavy. Quick-split deferred (Out of Scope), revisit if missed |
| 4 | **"I just owe Rahul ₹1,075"** — no entries, no math, one line | ⚠️ expressible as a 2-member split with one entry, but clunky. Accepted friction in Phase 1 |
| 5 | **Group gift**: 6 × ₹500, I buy the ₹3,000 gift | ✅ Phase 1 — I'm owed ₹2,500, reimbursement-shaped. Same float question as Abishek, inverted |
| 6 | **Trip where I'm the big payer and want it in my Plan** | ✅ Phase 1 via `splits.plan_id` + per-entry "paid from my pocket". Budget distortion is the Phase 2 decision point |
| 7 | **Flatmates: rent + utilities monthly**, I front ₹45,000, three repay | ❌ not Phase 1. ₹45k phantom balance every month is the float problem at its worst, and equal shares don't apply when rooms differ. This is what eventually forces option B/C plus shares strategy plus recurring splits |
| 8 | **Friend never pays** | ✅ handled by "close split" — freeze it and move on. No app has a better answer |
| 9 | **Two people log the same lunch** (both thought they were paying) | Phase 3 problem (duplicate entries from two reporters). Phase 1 has one reporter, so it cannot occur |
| 10 | **Edit after someone already settled** | ✅ Phase 1 — warn loudly, never lock. See Decisions |

### Decisions taken during planning

Every one of these was raised, argued, and settled with the user on 2026-08-26.
**Do not re-litigate without new information.**

1. **Single payer per entry.** Multiple payers was proposed after
   *"auto from lunch place to railway station — chris, abishek"* looked like a
   joint payment; the user corrected it — **two separate autos, because five
   people don't fit in one.** `payer_member_id` is a column, not a table. Two
   payments for one thing = two entries. If a genuine joint payment ever
   appears, it is also two entries.

2. **Ghost members are first-class.** A member is either a real FLO user or
   just a name. The trip that motivated the feature has at most one FLO user in
   it. A feature that only works when everyone has the app would have shipped
   unusable for the exact scenario that prompted it.

3. **Invites are links, not a user directory.** Create split → share invite
   link → it lands in the WhatsApp group where the trip is already being
   coordinated → tap → in. This needs **no user search, no address-book upload,
   no phone number at signup, and nothing to declare in Play Data Safety.** For
   a 5-person trip it beats directory lookup on every axis.

4. **No phone number at signup.** Asked directly; answered no, for five
   reasons: (a) the only thing your *own* number enables is cross-user
   discovery, which invite links replace; (b) onboarding is already the longest
   flow in the app (`12-personal-onboarding.md`, and `28` trimmed a screen out
   of it) and there is standing intent to trim it further — every signup field
   costs completions; (c) an unverified phone string is near-useless as
   identity (typos, shared numbers, changed numbers), and verifying means OTP
   cost plus another screen plus a different Supabase auth path than the
   current email + Google; (d) PII with real compliance weight (Play Data
   Safety, DPDP) collected "just in case"; (e) the correct discovery design is
   a hashed `sha256(normalized_e164)` compared client-side, which never needs
   the raw number at signup anyway. **Phone lives on `split_people` instead**
   (optional, per-contact), where it unlocks WhatsApp nudges and UPI deep links
   — worth more today than invites. If discovery ever ships, phone *is* the
   right India identifier, better than email; `profiles.phone` can be added
   then, optional and editable in `EditProfileSheet`.

5. **Cross-user entries are projections, never shared `transactions` reads**
   (Phase 3). When you link your ₹1,600 lunch, the app writes a `split_entries`
   row into the shared table. That row is the shared object; `transactions` RLS
   never changes. Two reasons: `transactions` is the most sensitive table in the
   app and a second read policy on it is an unacceptable blast radius; and a
   transaction row carries an account, a plan, a private note and a category —
   your friends should see *"Abishek paid ₹1,600 · Lunch"* and nothing more. A
   projection gives an explicit field whitelist; a read policy gives whatever
   the query selects.

6. **Roles: organizer as *finisher*, not boss** (Phase 3 enforcement, Phase 1
   schema). Entry owner edits their own; **organizer** (creator) can edit/delete
   anything, manage members, close/reopen; members read, add their own entries,
   settle their own balance. The organizer's power exists because *someone has
   to be able to finish the split when everyone else goes quiet* — the trip
   ends, one person typed the wrong number and stopped opening the app, and
   without an override the split is permanently wrong with no remedy but
   deletion. Paired with an append-only activity log (Phase 3) so nothing
   changes silently, and edits to someone else's entry notify them. Called
   **organizer**, not admin (this is five friends, not a workspace), and
   **transferable**, because "the organizer stopped using the app" is ordinary.

7. **Never lock on settlement; lock on close.** Asked directly. "Settled" is
   **per person and continuous** — Maaz pays in the car home, Srijish pays two
   weeks later — so it has no well-defined moment to fire a lock on. Three
   reasons not to: (a) the most common reason to edit after settling *is that
   the settlement was wrong* — somebody pays, looks at the number, and says
   "wait, I wasn't at the zoo"; locking blocks exactly the correction most
   needed; (b) locked-and-wrong has no escape hatch but deleting the whole
   split; (c) you cannot lock what you do not control — the money moved over
   UPI or in cash, and "settled" in FLO is a claim someone typed. Instead:
   a loud confirm naming the consequence, a visible **"changed after settling"**
   state on the affected member, **soft deletes**, and a deliberate
   organizer-only **Close split** that freezes the numbers and is reversibly
   reopenable. Net: *settlement is per-person and never locks; closing is
   per-split, manual, and locks reversibly.*

8. **Edit history is the sanctioned schema exception.** FLO's convention is no
   `updated_at` anywhere and no soft deletes. `flo-feature`'s own rule allows
   the exception when a feature "specifically needs edit-history" and it is
   called out explicitly. **This is that feature** — money between friends is
   the one place where "what changed, and who changed it" must survive.
   `split_entries` gets `updated_at` and `deleted_at`; Phase 3 adds
   `split_activity`.

9. **A settled transaction is never retroactively edited.** If you settled
   ₹1,274 and a later edit pushes your share to ₹1,464, FLO does **not** touch
   that ₹1,274 transaction — that amount genuinely moved. The extra ₹190 is a
   **new** settlement producing a **new** transaction. Same cash-flow-truth
   rule as the resolution above, and it keeps your ledger immune to other
   people's edits.

10. **Splits are account-scoped** (`account_id NOT NULL`), settled with the
    user. Consistent with `transactions`/`budgets`/`plans`; `bills` are the only
    global money table. The deciding argument: the settlement transaction has to
    land in *an* account, so the split should already know which one.

11. **Sharing the result is Phase 1, not Phase 2.** The user is the group's
    record-keeper — *"one person takes down the expenses — me"* — so the output
    is for four people who are not in the app. A plain-text summary via React
    Native's `Share` is core to the feature working at all, and needs no native
    module and no permission.

12. **Rounding uses largest-remainder, deterministically ordered.** ₹7,070/5
    divides cleanly; ₹100/3 does not (33.33 × 3 = 99.99). `amount` is
    `numeric(12,2)` (verified live via `information_schema`, 2026-08-26).
    Shares must sum *exactly* to the entry total or balances silently stop
    netting to zero and the feature loses trust. This is the classic bug in
    every split app, so it is enforced **in the database**, not just the client.

---

## Phase Overview

```
Phase 1 — The split, local
  Create a split in an account, add people (names, optional phone), add
  entries (description, amount, payer, participants, equal-or-exact shares),
  see who owes whom, share the summary as text, and settle — which is the
  ONLY thing that writes a transaction. Single-user RLS, zero new patterns.
  Runs the Mysore trip today, with four friends who don't have the app.

Phase 2 — Link my own transactions
  A transaction I log in FLO can BE a split entry (and vice versa): an
  "Add to split" picker in AddTransactionSheet, plus an add-from-history
  screen mirroring app/plan/[id]/history.js. Log it once, not twice. Also
  the decision point on the float/analytics question (option B vs C vs D).

Phase 3 — The shared split
  Invite links, real members, membership-based RLS, entries as projections,
  the activity log, role enforcement, settlement confirmation, push. The
  hard one — and by now Phases 1–2 have shown which parts get used.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — The Split, Local ✅ Complete

### Goal

From the menu, open Splits, create "Mysore Trip" in an account, add Abishek /
Maaz / Stephin / Srijish as people (you are always a member), then add the
thirteen entries with a payer and a participant set each. The split shows the
total, the per-head figure, and a plain-English payment list — *"You owe
Abishek ₹1,274"*, *"Maaz owes Abishek ₹1,414"*. Share that as text into the
trip's WhatsApp group. When you actually pay Abishek, tap Settle and FLO writes
one expense of ₹1,274 into the account, optionally tagged to a category and a
plan.

At the end of this phase the trip that motivated the feature is fully
recordable, with **no cross-user anything** and **no change to any existing
table**.

### Before Starting — Confirm With Codebase

1. **`transactions` insert shape** — read `components/AddTransactionSheet.js`
   around the `supabase.from('transactions').insert(...)` call (~line 362) and
   copy the exact payload keys it builds, including `account_id`. There is **no
   `lib/transactions.js`** in this repo; transaction writes live inline in that
   sheet. `lib/splits.js` will be the first place outside it that inserts a
   transaction — match the shape exactly, and check whether the daily
   coin/XP/streak side effects that sheet fires (`lib/rewardsMutations.js`)
   should also fire for a settlement. **Recommendation: they should not** — a
   settlement isn't "showing up to log today" — but confirm the decision rather
   than inheriting it by accident.
2. **`MenuSheet.js`'s `ITEMS` array** (~line 43) — confirm the current row list
   and the `isPro`-conditional `snapPoints` below it, since adding a sixth row
   changes the sheet height.
3. **`useEntitlement()`** (`hooks/useEntitlement.js`) and `FREE_LIMITS` in
   `lib/pro.js` — confirm the create-time-gate pattern used for accounts /
   budgets / plans before adding `splits`.
4. **`hooks/usePlans.js`** — the plan picker in `AddSplitSheet` needs the
   active account's plans; confirm its return shape and account scoping rather
   than writing a new query.
5. **`CategoryIcon.js`'s `CATEGORY_COLORS`** — the person colour swatch grid
   should reuse this exact array (14 swatches as of `02-accounts.md`), not
   define its own.
6. **`components/Card.js`** — confirm the `dark` prop maps to
   `colors.emphasisBg` (per `AGENTS.md`), for the split-detail hero.

### 1.1 Database

Six new tables, one RPC. Nothing existing is altered. Paste this into the
Supabase SQL editor **before writing any component code**, and confirm it
applied.

Migration name: **`split_expenses_phase1`**

```sql
-- ============================================================
-- 31-split-expenses.md — Phase 1
-- Migration: split_expenses_phase1
-- ============================================================

-- 1. People — reusable local contacts. NOT app users.
--    No unique constraint on name: two friends really can both be "Rahul".
create table public.split_people (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  phone      text null check (phone is null or length(trim(phone)) between 4 and 20),
  color      text not null default '#BBDC12',
  created_at timestamptz not null default now()
);
create index idx_split_people_user_id on public.split_people (user_id);

-- 2. Splits — account-scoped (Decision 10).
create table public.splits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  account_id  uuid not null references public.accounts (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  icon        text null,
  occurred_on date not null default current_date,
  plan_id     uuid null references public.plans (id) on delete set null,
  status      text not null default 'open' check (status in ('open','closed')),
  closed_at   timestamptz null,
  created_at  timestamptz not null default now(),
  constraint splits_closed_at_matches_status check (
    (status = 'closed' and closed_at is not null) or
    (status = 'open'   and closed_at is null)
  )
);
create index idx_splits_user_account on public.splits (user_id, account_id);
create index idx_splits_plan_id      on public.splits (plan_id);

-- 3. Members — a split's participants. person_id NULL means "me".
--    member_user_id and role are UNUSED in Phase 1: they exist now so
--    Phase 3 is an RLS change rather than a table migration (Decisions 2, 6).
create table public.split_members (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  split_id       uuid not null references public.splits (id) on delete cascade,
  person_id      uuid null references public.split_people (id) on delete restrict,
  is_self        boolean not null default false,
  member_user_id uuid null references auth.users (id) on delete set null,
  role           text not null default 'member' check (role in ('organizer','member')),
  created_at     timestamptz not null default now(),
  constraint split_members_self_xor_person check (
    (is_self and person_id is null) or (not is_self and person_id is not null)
  )
);
create unique index split_members_one_self_per_split
  on public.split_members (split_id) where is_self;
create unique index split_members_unique_person
  on public.split_members (split_id, person_id) where person_id is not null;
create index idx_split_members_split_id       on public.split_members (split_id);
create index idx_split_members_person_id      on public.split_members (person_id);
create index idx_split_members_member_user_id on public.split_members (member_user_id);

-- 4. Entries — what was bought, how much, who paid. NOT transactions.
--    updated_at / deleted_at are the sanctioned edit-history exception
--    to FLO's no-updated_at, no-soft-delete convention (Decision 8).
create table public.split_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  split_id        uuid not null references public.splits (id) on delete cascade,
  description     text not null check (length(trim(description)) between 1 and 80),
  amount          numeric(12,2) not null check (amount > 0),
  occurred_on     date not null,
  payer_member_id uuid not null references public.split_members (id) on delete restrict,
  strategy        text not null default 'equal' check (strategy in ('equal','exact')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz null,
  deleted_at      timestamptz null
);
create index idx_split_entries_split_id on public.split_entries (split_id)
  where deleted_at is null;
create index idx_split_entries_payer    on public.split_entries (payer_member_id);

-- 5. Shares — who owes what for one entry. Rows must sum to entry.amount;
--    that is enforced by save_split_entry() below, not by a CHECK (a CHECK
--    cannot see sibling rows).
create table public.split_entry_shares (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  entry_id   uuid not null references public.split_entries (id) on delete cascade,
  member_id  uuid not null references public.split_members (id) on delete restrict,
  amount     numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  constraint split_entry_shares_unique unique (entry_id, member_id)
);
create index idx_split_entry_shares_entry_id  on public.split_entry_shares (entry_id);
create index idx_split_entry_shares_member_id on public.split_entry_shares (member_id);

-- 6. Settlements — money that actually moved between two people.
--    transaction_id links the FLO transaction created when I'm one of the
--    two parties. NULL when the settlement is between two other people.
create table public.split_settlements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  split_id       uuid not null references public.splits (id) on delete cascade,
  from_member_id uuid not null references public.split_members (id) on delete restrict,
  to_member_id   uuid not null references public.split_members (id) on delete restrict,
  amount         numeric(12,2) not null check (amount > 0),
  occurred_on    date not null,
  transaction_id uuid null references public.transactions (id) on delete set null,
  note           text null,
  created_at     timestamptz not null default now(),
  constraint split_settlements_distinct_parties check (from_member_id <> to_member_id)
);
create index idx_split_settlements_split_id       on public.split_settlements (split_id);
create index idx_split_settlements_from           on public.split_settlements (from_member_id);
create index idx_split_settlements_to             on public.split_settlements (to_member_id);
create index idx_split_settlements_transaction_id on public.split_settlements (transaction_id);

-- ============================================================
-- RLS — standard FLO single-user policies, (select auth.uid())
-- wrapped per the fix_rls_initplan_and_missing_index rule.
-- Phase 3 REPLACES these on splits/split_members/split_entries/
-- split_entry_shares/split_settlements with membership-based policies.
-- ============================================================
alter table public.split_people        enable row level security;
alter table public.splits              enable row level security;
alter table public.split_members       enable row level security;
alter table public.split_entries       enable row level security;
alter table public.split_entry_shares  enable row level security;
alter table public.split_settlements   enable row level security;

create policy split_people_owner on public.split_people
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy splits_owner on public.splits
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy split_members_owner on public.split_members
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy split_entries_owner on public.split_entries
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy split_entry_shares_owner on public.split_entry_shares
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy split_settlements_owner on public.split_settlements
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================
-- save_split_entry — the ONLY way an entry and its shares are written.
--
-- Why an RPC: supabase-js has no multi-statement transaction, so an
-- entry insert and its shares insert are two separate transactions from
-- the client. A DEFERRABLE constraint trigger would therefore reject the
-- entry before its shares existed. This function does both atomically and
-- enforces the sum-to-total invariant (Decision 12) server-side, so no
-- client bug can leave balances that don't net to zero.
--
-- SECURITY INVOKER (the default, stated explicitly): RLS still applies,
-- so a user can only ever write their own rows. This is deliberately NOT
-- a SECURITY DEFINER function — see the advisor notes in 00-index.md.
-- ============================================================
create or replace function public.save_split_entry(
  p_entry_id        uuid,      -- null = insert, otherwise update
  p_split_id        uuid,
  p_description     text,
  p_amount          numeric,
  p_occurred_on     date,
  p_payer_member_id uuid,
  p_strategy        text,
  p_shares          jsonb      -- [{"member_id":"uuid","amount":1414.00}, ...]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_sum      numeric(12,2);
  v_uid      uuid := (select auth.uid());
begin
  if p_shares is null or jsonb_array_length(p_shares) = 0 then
    raise exception 'an entry needs at least one share';
  end if;

  select coalesce(sum((s->>'amount')::numeric), 0)
    into v_sum
    from jsonb_array_elements(p_shares) s;

  if round(v_sum, 2) <> round(p_amount, 2) then
    raise exception
      'shares must sum to the entry amount (got %, expected %)', v_sum, p_amount;
  end if;

  if p_entry_id is null then
    insert into split_entries
      (user_id, split_id, description, amount, occurred_on, payer_member_id, strategy)
    values
      (v_uid, p_split_id, p_description, p_amount, p_occurred_on, p_payer_member_id, p_strategy)
    returning id into v_entry_id;
  else
    update split_entries
       set description     = p_description,
           amount          = p_amount,
           occurred_on     = p_occurred_on,
           payer_member_id = p_payer_member_id,
           strategy        = p_strategy,
           updated_at      = now()
     where id = p_entry_id
       and deleted_at is null
    returning id into v_entry_id;

    if v_entry_id is null then
      raise exception 'entry not found, deleted, or not writable';
    end if;

    delete from split_entry_shares where entry_id = v_entry_id;
  end if;

  insert into split_entry_shares (user_id, entry_id, member_id, amount)
  select v_uid, v_entry_id, (s->>'member_id')::uuid, (s->>'amount')::numeric
    from jsonb_array_elements(p_shares) s;

  return v_entry_id;
end;
$$;

-- Same exposed-RPC-surface hygiene as revoke_execute_on_user_delete_trigger.
revoke execute on function public.save_split_entry(uuid,uuid,text,numeric,date,uuid,text,jsonb)
  from public, anon;
grant  execute on function public.save_split_entry(uuid,uuid,text,numeric,date,uuid,text,jsonb)
  to authenticated;
```

**Second migration, found during the build — `split_expenses_user_id_defaults`.**
Every other table in this schema defaults `user_id` to `auth.uid()`
(`accounts`, `bills`, `budgets`, `categories`, `plans`, `transactions` — checked
live via `information_schema`), and **no client insert anywhere in the app
passes `user_id` explicitly**. The tables above declared `user_id NOT NULL` with
no default, so every insert from the client would have failed the NOT NULL
constraint. Caught before any component code was written; applied as its own
migration rather than editing the block above, so this doc matches the two
migrations that actually exist:

```sql
alter table public.split_people       alter column user_id set default auth.uid();
alter table public.splits             alter column user_id set default auth.uid();
alter table public.split_members      alter column user_id set default auth.uid();
alter table public.split_entries      alter column user_id set default auth.uid();
alter table public.split_entry_shares alter column user_id set default auth.uid();
alter table public.split_settlements  alter column user_id set default auth.uid();
```

**No view.** Every derived number (paid, owed, net, the payment list) is
computed client-side in `lib/splitMath.js` — a trip is ~15 entries × ~5 shares,
so volume never warrants SQL, and keeping the math in JS makes it directly
testable. This follows the skill's "prefer client-side unless reused across
many screens" guidance.

**After applying**: run the Supabase security advisor and confirm no *new*
findings beyond the pre-existing WARNs recorded in `00-index.md`.

### 1.2 Data Layer

**`lib/splitMath.js` — pure functions, no Supabase import.** This file is the
correctness core of the feature; everything else is plumbing.

```js
// Largest-remainder split so shares ALWAYS sum exactly to `amount`.
// Ordering is by member id (lexicographic uuid sort) so recomputing the
// same entry twice gives byte-identical shares — never insertion order,
// which would make the extra paisa wander between renders.
resolveEqualShares(amount, memberIds) -> { [memberId]: number }
//   paise     = Math.round(amount * 100)
//   base      = Math.floor(paise / n)
//   remainder = paise - base * n            // 0 <= remainder < n
//   sorted[i] gets (base + (i < remainder ? 1 : 0)) / 100

// net > 0 => is owed money. net < 0 => owes money.
// A settlement from X to Y reduces X's debt, so it RAISES X's net.
//   net = paid - owed + settledOut - settledIn
computeBalances({ members, entries, shares, settlements })
  -> [{ memberId, paid, owed, settledIn, settledOut, net }]

// Greedy netting: creditors desc, debtors by |net| desc, match largest to
// largest. Produces at most n-1 payments. With one creditor (the normal
// case) this reduces to "everyone pays that person". No toggle — see the
// simplify-debts note in Research.
suggestPayments(balances) -> [{ fromMemberId, toMemberId, amount }]

// Which members' balances moved after they last settled — drives the
// "changed after settling" badge (Decision 7).
membersChangedAfterSettling({ balances, settlements }) -> memberId[]

// Plain-text summary for React Native's Share (Decision 11).
buildSummaryText({ split, members, entries, balances, payments, formatMoney })
```

Two invariants to assert in dev (and to verify by hand on the Mysore data):
`Σ shares === entry.amount` for every entry, and `Σ net === 0` across all
members.

**`lib/splits.js` — mutations.** Plain async functions calling `supabase`; the
caller runs `notifyChanged()` on success, per the `useDataRefresh` contract.

| Function | Notes |
|---|---|
| `createSplit({ accountId, name, icon, occurredOn, planId, personIds })` | Inserts the split, then members: one `is_self: true` row with `role: 'organizer'`, plus one row per `personId`. Returns the split id. |
| `updateSplit(id, patch)` / `deleteSplit(id)` | Delete cascades entries/shares/settlements. Confirm via `Alert.alert`, naming the entry count. |
| `closeSplit(id)` / `reopenSplit(id)` | Sets `status`/`closed_at` together (the CHECK requires it). |
| `addPerson({ name, phone, color })`, `updatePerson`, `deletePerson` | `deletePerson` will hit `on delete restrict` if the person is a member anywhere — catch it and say which splits, don't surface the Postgres error. |
| `addMembers(splitId, personIds)`, `removeMember(memberId)` | `removeMember` hits `restrict` if the member is a payer, has shares, or appears in a settlement — same friendly-message treatment. |
| `saveEntry({ entryId, splitId, description, amount, occurredOn, payerMemberId, strategy, shares })` | Calls `supabase.rpc('save_split_entry', ...)`. Shares come from `resolveEqualShares` (equal) or the form (exact). |
| `deleteEntry(entryId, { hasSettlements })` | **Soft** (`deleted_at = now()`) when the split has any settlement; hard delete otherwise (Decision 7). |
| `recordSettlement({ splitId, fromMemberId, toMemberId, amount, occurredOn, note, ledger })` | Inserts the settlement. When `ledger` is present (i.e. I am one of the two parties and the user confirmed), also inserts the transaction and writes its id back to `transaction_id`. |
| `logEntryFromPocket({ entryId, categoryId })` | The optional per-entry "I paid this from my pocket" action. Inserts an `expense` for the entry's full amount and stores its id — **needs `split_entries.transaction_id`, which lands in Phase 2**, so in Phase 1 this writes the transaction *without* a back-link and the UI relies on the entry's own state. See 1.6. |

Transaction payload for a settlement, mirroring `AddTransactionSheet`:

```
type:        'expense'  when I'm the payer (from_member is me)
             'income'   when I'm the payee  (to_member is me)
amount:      the settlement amount (always positive)
account_id:  split.account_id
category_id: user-chosen in SettleUpSheet (nullable)
plan_id:     split.plan_id ?? null
occurred_at: settlement occurredOn
note:        `${split.name} — settled with ${otherPersonName}`
```

**Hooks.** All three follow the standard shape: subscribe to `version` from
`useDataRefresh`, scope by `activeAccountId` from `useAccount`, return `[]`
when it's null, expose `{ …, loading, refetch }`.

| Hook | Returns |
|---|---|
| `hooks/useSplits.js` | `{ splits, loading, refetch }`. One query per split-set using Supabase embedded resources (`splits` → `split_members(*, split_people(*))`, `split_entries(*, split_entry_shares(*))`, `split_settlements(*)`), filtered `deleted_at is null` on entries, then `computeBalances` per split to attach `{ memberCount, totalAmount, myNet, perHead }`. Volume assumption stated in a comment: a handful of splits × ~15 entries × ~5 shares. |
| `hooks/useSplit.js` | `(splitId)` → `{ split, members, entries, balances, payments, settlements, changedAfterSettling, loading, refetch }`. Same embedded fetch narrowed to one id. |
| `hooks/useSplitPeople.js` | `{ people, loading, refetch }` — **not** account-scoped (people are global to the user, like `categories`). |

### 1.3 Components

```
app/splits.js                          list + "New Split" button
app/split/[id].js                      detail (becomes [id]/index.js in Phase 2)

components/AddSplitSheet.js            create/edit a split
components/AddSplitEntrySheet.js       create/edit an entry
components/AddSplitPersonSheet.js      create/edit a person
components/SettleUpSheet.js            record a settlement
components/SplitMemberChip.js          avatar-initial + name + colour dot
components/SplitBalanceRow.js          "Maaz owes Abishek ₹1,414"

lib/splitMath.js                       pure math (1.2)
lib/splits.js                          mutations (1.2)
```

Every sheet follows the established Provider + Context + `forwardRef` /
`useImperativeHandle` pattern from `AddBudgetSheet.js`, with its provider
mounted as a `<Stack>` sibling in `app/_layout.js` and an imperative opener
hook (`useAddSplitSheet().openAddSplit(existingOrNull)`).

**`app/splits.js`** — list of `<Card>`s: icon + name, date, member count,
total, and the user's own position (`You owe ₹1,274` in `colors.danger` /
`You're owed ₹5,336` in `colors.income` / `Settled up` in `colors.mutedMid`).
Closed splits in a separate collapsed "Closed" section. Bottom "New Split"
`<Button variant="primary">` with `useSafeAreaInsets().bottom` added to the
scroll content padding (the `02-accounts.md` gesture-bar lesson). Empty state
is a plain centred message.

**`app/split/[id].js`** — four stacked sections:

1. **Hero** (`<Card dark>` → `colors.emphasisBg`, never `colors.ink`): total,
   per-head, and your own position as the largest figure.
2. **Who owes whom** — `SplitBalanceRow` per `suggestPayments()` entry, your
   own lines first and phrased in second person (*"You owe Abishek ₹1,274"*),
   everyone else third person (*"Maaz owes Abishek ₹1,414"*). A `Settle` action
   on any row involving you. A `changed after settling` badge where applicable.
   `Share summary` button here — `Share.share({ message: buildSummaryText(…) })`.
3. **Entries** — grouped by date, each row: description, amount, `paid by X`,
   `split N ways`, and your own share. Tap to edit, swipe/long-press to delete.
4. **People** — member chips + "Add person".

Header actions: edit split, close/reopen, delete.

**`AddSplitEntrySheet.js`** is the one screen worth designing carefully, since
it's used a dozen times per trip:

- Description, amount, date.
- **Paid by** — single-select chip row of members, defaulting to the previous
  entry's payer (in the Mysore trip that's Abishek ten times running — a real
  keystroke saving).
- **Split between** — multi-select chips, all members selected by default,
  showing the resulting per-head figure live.
- **Strategy** — `Equally` / `Exact amounts` segmented control. `Exact` reveals
  a per-member amount input with a running *"₹120 left to assign"* line, and
  Save is blocked until it reaches exactly zero (the client mirror of the RPC's
  server-side check).
- If the payer is me: an **"I paid this from my pocket"** switch, **default
  off**, which additionally logs the entry's full amount as an expense with a
  category picker (Decision: the Abishek-position escape hatch).

**`SettleUpSheet.js`** — from/to (pre-filled from the tapped row), amount
(pre-filled with the suggested figure but **editable**, so partial payments
work), date, optional note. When I'm one of the two parties, a **"Also record
in FLO"** switch, **default on**, with a category picker and a line stating
exactly what will be written: *"Adds a ₹1,274 expense to Personal."* When I'm
not a party, the switch is absent and a note explains why.

### 1.4 Navigation / Integration

- **`components/MenuSheet.js`** — add `{ key: 'splits', label: 'Splits',
  route: '/splits', icon: Users }` to `ITEMS`, placed directly after `plans`
  (they're conceptually adjacent: both are event-shaped collections). Bump the
  `isPro`-conditional `snapPoints` to account for a sixth row.
- **No new tab.** Per the skill's navigation rule, new global destinations go
  in the menu sheet, not a 6th tab slot.
- **`app/_layout.js`** — mount `<AddSplitSheetProvider>`,
  `<AddSplitEntrySheetProvider>`, `<AddSplitPersonSheetProvider>` and
  `<SettleUpSheetProvider>` inside the existing provider stack. They are plain
  providers, **not** headless Stack siblings — they need no `useProfile`-style
  hook access, so they don't belong in that group.
- **`lib/pro.js`** — `FREE_LIMITS` gains `splits: 1`, meaning **one *open*
  split at a time on Free** (closed splits don't count). Chosen over a flat
  lifetime cap so a Free user can run trip after trip by closing each one —
  the gate limits concurrency, not usage, which is fairer on first contact and
  still a real Pro reason. Enforced **create-time only** in `createSplit`'s
  caller, per the standing rule (never access-time, never data-model). Add a
  matching line to `PRO_BENEFITS`.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `transactions` table | **No schema change.** Settlements insert ordinary `income`/`expense` rows. | These rows flow into every existing total, budget, plan and analytic — which is correct and intended. A settlement *is* real money moving. |
| `v_global_summary` | None (reads `transactions`, sees settlement rows as ordinary income/expense) | Balance stays correct in all three payer positions — the table in Research. |
| `v_budgets_with_spent` | None structurally | A settlement expense **does** count against budgets. Correct for the you-owe case; the source of the big-payer distortion, which is the Phase 2 decision point. |
| Analytics / reports | None structurally | Same caveat: a big-payer settlement shows as income. Documented, deferred to Phase 2. |
| `plans` | None. `splits.plan_id` is a new FK *into* plans. | `ON DELETE SET NULL` — deleting a plan orphans the link, never the split. |
| `MenuSheet.js` | One row added, `snapPoints` bumped | Sheet height on both `isPro` branches. |
| `lib/pro.js` | `FREE_LIMITS.splits` + a `PRO_BENEFITS` entry | Every surface reads from here, so no drift — verify `app/pro.js` and `ProUpsellSheet` render the new benefit. |
| Streak / coins / XP | **Intentionally none** | Confirm settlements don't fire `lib/rewardsMutations.js`. Settling isn't a daily log. Verify in step 1 of Before Starting. |
| Auto-detect (`lib/detect.js`) | None | A detected bank notification has no split concept; `split_id` is not something it can guess, exactly as `plan_id` isn't. |

### 1.6 What This Phase Does NOT Include

- **Any cross-user anything** — no invites, no links, no shared reads, no
  `member_user_id` population, no `role` enforcement. Those two columns exist
  but are inert.
- **`split_entries.transaction_id`** — Phase 2. Consequence: the Phase 1
  "I paid this from my pocket" action writes an expense with no back-link, so
  the entry can't show "already logged" reliably across devices and can't undo
  the transaction if the entry is later deleted. Accepted for Phase 1; if this
  proves annoying in real use, pull the nullable column forward rather than
  working around it.
- **Linking existing transactions** into a split, and the "Add to split" picker
  in `AddTransactionSheet` — Phase 2.
- **Shares / percent / itemised** strategies — equal and exact only.
- **The float/analytics decision** (option B vs C vs D) — Phase 2.
- **WhatsApp nudge and UPI deep links** — the `phone` column ships in Phase 1
  and is capturable, but nothing consumes it yet.
- **Quick single-entry split** from `AddTransactionSheet` — Out of Scope.
- **`split_activity` log** — Phase 3, where a second actor makes it meaningful.

### 1.7 Phase 1 Checklist — Before Marking Complete

**Verified at the database and math layers.** Everything below marked `[x]` was
proven by running something, not by reading code: the DB items against live
Postgres via the Supabase MCP, the math items by executing `lib/splitMath.js`
itself (copied to `.mjs` and driven by a 25-assertion script over the real
Mysore data). Items needing a running app are left unchecked — see
Implementation Notes.

- [x] `split_expenses_phase1` applied; all six tables exist with RLS enabled and one owner policy each, verified by reading `pg_class.relrowsecurity` + `pg_policies`.
- [x] `split_expenses_user_id_defaults` applied — `user_id` defaults to `auth.uid()` on all six tables, matching every other table in the schema.
- [x] `save_split_entry` exists, is `SECURITY INVOKER`, carries `search_path=public`, and `EXECUTE` is granted to `authenticated` with `public`/`anon` absent — verified via `pg_proc.prosecdef`/`proconfig` and `information_schema.role_routine_grants`.
- [x] Supabase security advisor shows **no new findings** — the same 4 pre-existing WARNs (`pg_net` in public, `claim_push_token`, `delete_current_user`, leaked-password protection) and nothing else.
- [x] `save_split_entry` rejects a shares array that doesn't sum to the amount — verified by a deliberate bad call (`100` vs a single `50` share → `shares must sum to the entry amount (got 50.00, expected 100)`), with nothing written.
- [x] `resolveEqualShares(100, [a,b,c])` returns `33.34 / 33.33 / 33.33`, summing to exactly `100.00`, and returns the identical assignment regardless of input order. Also checked at 7 paise across 3 (`0.03 / 0.02 / 0.02`).
- [x] The Mysore trip computes Abishek owed **₹5,336**, and ₹1,274 / ₹1,234 / ₹1,414 / ₹1,414 owed by the other four — proven twice over: once inside Postgres against the real tables (a `DO` block that rolled itself back, so no rows persisted) and once through `lib/splitMath.js` directly.
- [x] `Σ net === 0` across all members, for the trip and for every other case tested.
- [x] `suggestPayments` returns at most n−1 payments (4 here), all directed at the single creditor, summing to exactly ₹5,336.
- [x] An entry with a subset of participants (4 of 5) computes correctly, and a member excluded from an entry has **no share row** rather than a ₹0 one — while a member deliberately given ₹0 is still treated as a participant on edit.
- [x] An entry whose payer is not a participant computes correctly (payer owed the full amount, participants each owing their share, still netting to zero).
- [x] A partial settlement (₹1,000 of ₹1,414) leaves ₹414 outstanding and the balances still net to zero.
- [x] `membersChangedAfterSettling` flags a member when an entry lands after they settled, and flags nobody when nothing moved.
- [x] `Share summary` produces readable plain text with the user's own lines first — output inspected in full.
- [x] Wording is second-person for the user's own lines (`You owe Abishek ₹1,274`) and third-person otherwise (`Maaz owes Abishek ₹1,414`), from one shared `describePayment` so the screen and the shared text cannot disagree.
- [x] No hardcoded colours or `₹` in any new file: every literal `₹` is in a comment, all money goes through `lib/currency.js`, all colour through `useTheme()`/`theme/tokens.js`. One deliberate exception, commented at the site — `#FFFFFF` for the initial glyph in `SplitMemberChip`, which sits on an arbitrary person colour from `CATEGORY_COLORS` (several are dark) and is the only value readable across all fourteen.
- [x] `npx expo export --platform android` bundles cleanly.

Needs a running app — **not** verified from this environment:

- [ ] Settling ₹1,274 to Abishek writes exactly one `expense` row in `split.account_id` with `transaction_id` back-linked on the settlement.
- [ ] A settlement where the user is the *payee* writes exactly one `income` row.
- [ ] A settlement between two other people writes **no** transaction and leaves `transaction_id` NULL.
- [ ] Editing an entry that affects an already-settled member shows the consequence-naming confirm, and that member then carries the "changed after settling" badge.
- [ ] Deleting an entry in a split that has settlements soft-deletes it (row present, `deleted_at` set) and it disappears from every read.
- [ ] Closing a split blocks entry/member/settlement edits; reopening restores them; `status` and `closed_at` stay consistent (the CHECK never fires).
- [ ] Deleting a person who is a member surfaces a friendly message, not a raw Postgres `restrict` error. Same for removing a member who is a payer or has shares.
- [ ] A Free user with one open split is blocked from creating a second and sees `ProUpsellSheet`; closing the first unblocks creation; a Pro user is never blocked.
- [ ] Splits are account-scoped: switching `activeAccountId` changes the list, and a split created in one account never appears in another.
- [ ] Settling does **not** award coins/XP and does not affect the streak.
- [ ] On-device tap-through confirmed by the user (bundling is not behaviour — the standing caveat on every phase in this repo).

### Phase 1 — Implementation Notes

**Two migrations, not one.** `split_expenses_phase1`, then
`split_expenses_user_id_defaults` — see 1.1. The second was a genuine gap in
this doc's original SQL: without it every client insert would have failed
NOT NULL, because no insert anywhere in this app passes `user_id`. Worth
remembering as a rule for any future table here.

**Deviations from the plan, all deliberate:**

- **`lib/splitShape.js` is new** and wasn't in the file list. Both hooks run the
  same embedded select, so snake_case→camelCase normalisation had to live in one
  place — duplicating it would risk a drift, and a drift here is a wrong
  balance, not a cosmetic bug. It also owns `SPLIT_SELECT`, so the two hooks
  cannot fetch different shapes.
- **`components/SplitBalanceRow.js` was not built.** The balance row is ~15
  lines and rendered in exactly one place, so it lives inline in
  `app/split/[id].js`. A component would have been indirection for nothing.
  `SplitMemberChip` *was* built, because it genuinely serves three roles
  (badge, payer single-select, participant multi-select).
- **`describePayment` added to `splitMath.js`**, not in the plan. It exists so
  the on-screen rows and the shared text physically cannot word the same fact
  differently.
- **Members are edited on the detail screen, not in `AddSplitSheet`'s edit
  mode.** Adding or removing someone changes what everyone else owes, so it
  belongs next to the balances it affects — and that's where a blocked removal
  ("they already paid for something") can be explained in context. Create mode
  still picks the initial members. Removal is a long-press, confirmed by
  `Alert`.
- **An icon picker was built** (a curated 8-key subset of `CategoryIcon`'s map:
  travel/food/home/car/gift/entertainment/shopping/other). Worth noting
  `AddPlanSheet` has no icon picker at all despite `plans.icon` existing — so
  this is the first one in the app, not a copied pattern.
- **`ProBenefits.js` gained a `users` icon mapping.** The plan said to add a
  `PRO_BENEFITS` entry but not that its `icon` key needs a Lucide component
  registered in that file's own `ICONS` map, or it renders nothing.
- **`MenuSheet` snapPoints bumped `66%/78%` → `70%/82%`** for the sixth row.
  Picked without an on-device measure (that file's own comment warns the values
  are hand-tuned) — adjust if the sheet sits too tall or short.
- **`logEntryFromPocket` is only offered on a NEW entry the user paid for.** An
  edit can't tell whether it already logged one, because
  `split_entries.transaction_id` doesn't exist until Phase 2 (1.6). Offering it
  on an edit would invite silent double-logging.

**Decisions confirmed against the real codebase during the build:**

- `transactions` has no `lib/transactions.js` — writes live inline in
  `AddTransactionSheet`. `lib/splits.js` is the first place outside it that
  inserts a transaction; the payload shape (`type`, `amount`, `account_id`,
  `category_id`, `plan_id`, `occurred_at`, `note`) was copied from there
  verbatim.
- **Settlements deliberately do NOT fire `lib/rewardsMutations.js`.** Settling
  up isn't "showing up to log today", so it earns no coins, no XP, and doesn't
  touch the streak. This was flagged as a question in Before Starting and is
  now a decision.
- Sheets use `BottomSheetScrollView`, not React Native's `ScrollView` — a plain
  one inside a sheet fights the sheet's own pan gesture.

**Fixed on first device run (Expo Go), 2026-08-26:**

- **`null value in column is_self violates not null constraint` when creating a
  split.** `createSplit` built its member rows with different key sets — the
  self row carried `is_self`/`role`, the person rows relied on the column
  defaults. **On a bulk insert, PostgREST takes the union of keys across the
  array and sends NULL for any object missing one; it does not fall back to the
  column default.** So `is_self` arrived as NULL. Fixed by spelling out every
  column on every row, nulls included. `addMembers` got the same treatment even
  though its rows were already uniform — relying on that is how this comes back.
  **Standing rule for this codebase: any `.insert([...])` of more than one row
  must have identical keys on every object.** Single-object inserts are
  unaffected (omitted columns do get their defaults), which is why nothing else
  in the app had ever hit this.
- **Adding a person threw away the half-filled New Split form.** gorhom's
  `stackBehavior` defaults to `switch`, which minimizes the sheet underneath and
  relies on restoring it — on device the restore didn't happen, so the split
  sheet vanished and the person only appeared after reopening it.
  `AddSplitPersonSheet` now sets `stackBehavior="push"`, mounting on top and
  leaving the split sheet presented underneath with its state intact. It's the
  only sheet in the app opened from on top of another, so it's the only one that
  needs the prop.
- **The participant check-mark used `colors.brandText`.** That's the contrast
  colour computed for text on a *solid* `brand` fill, but the check sits on
  `brandBg` (a pale tint). Now `colors.brand`, matching the chip's own
  brand-coloured selected border.
- **A brand-new split announced "Settled up" in the big position type.** With
  zero entries `myNet` is legitimately `0`, and both the list card and the
  detail hero read that as "all square" — a confident claim about a split that
  has nothing in it, in the loudest type on the card. Zero-entry is now its own
  state on both surfaces: the card shows a quiet, normal-weight "Nothing added
  yet" and drops the ₹0 total from its meta line; the hero shows "Nothing added
  yet" plus a prompt instead of a figure, and its meta line shows the member
  count rather than `₹0 · ₹0 each`. **General lesson for this feature: `net === 0`
  means two completely different things depending on whether any entries exist,
  and only one of them is "settled".**

- **The detail screen's lower half became tabbed, and People became a table**
  (both on direct feedback). The original stacked-sections layout buried People
  and Settled under a dozen-plus entries on a real trip, and People itself was a
  wrapped row of chips with a tiny "paid ₹x" caption under each — hard to scan
  and unlike anything else in the app. Now: the hero and the balances stay
  pinned above (they're the answer you opened the screen for), and
  **Entries / People / Settled** sit behind a `Pill`-based segmented row with
  counts, following `AnalyticsSegmentTabs`' existing `dark`/`neutral` language.
  People is a table whose row geometry is copied from the Transactions list —
  40×40 tile, title + sub, amount right-aligned — with **what each person paid**
  in the right column and **what they owe** as the sub-line. Contributions here,
  obligations in the balances block; two different questions, deliberately not
  mixed. A ₹0 payer is muted rather than hidden, so the column scans for who
  actually put money in. The footer button follows the tab (Add Entry / Add
  Person), since "Add Entry" reads as a mismatch while looking at People.

**Fixed on second device run, 2026-08-26 — two real bugs found by trying to
delete a split:**

- **A split could not be deleted at all.** `delete from splits` failed with
  `23503` on `split_entry_shares_member_id_fkey`. Cause: the member-referencing
  FKs were `ON DELETE RESTRICT`, and **RESTRICT is checked immediately and cannot
  be deferred**. Deleting a split cascades to `split_members` AND (via a longer
  chain) to `split_entries → split_entry_shares`, and the check on the shorter
  chain fired while the shares still existed. Two migrations to fix, because the
  first attempt was wrong and that's worth recording: `split_member_fks_no_action`
  moved them to `NO ACTION`, which **still failed identically** — Postgres runs
  each cascade step as its own internal statement, so "end of statement" was too
  early. `split_member_fks_deferrable` then made them
  `NO ACTION DEFERRABLE INITIALLY DEFERRED`, moving the check to COMMIT, by
  which point every cascade in the transaction has finished.
  **Both behaviours verified live:** deleting a split now leaves
  members/entries/shares/settlements/invites/activity all at **0**, while
  removing a *single* member who has entries is **still rejected with 23503** —
  so `removeMember`'s friendly message is unchanged. `split_people` is untouched
  by a split delete, which is correct: contacts are reusable.
  **Lesson: RESTRICT means "never, even inside a cascade". Where the intent is
  "not while anything still points at it", the tool is deferred NO ACTION.**
- **A saved person could never be renamed or deleted.** `AddSplitPersonSheet`
  had a complete edit mode, but all three `openAddSplitPerson(...)` call sites
  passed `null` — so `updatePerson` and `deletePerson` were unreachable dead
  code and a typo'd name was permanent. `AddSplitSheet`'s person chips now
  long-press into edit, and the help text says so.

**Sharing grew from one format to three (2026-08-26, on request).** Decision 11
shipped a plain-text summary of balances only. It now includes the **itemised
entry list** — "total ₹7,070" is a claim, the entry list is the evidence, and it
names who paid and how many ways each item split so an uneven entry is
queryable. Plus already-settled amounts, so nobody is asked twice.

Three formats, split by intent rather than crammed into one menu (React
Native's `Alert` only renders three buttons reliably on Android):

| Action | Format | For |
|---|---|---|
| Share → As text | plain text | the group chat, read by people with no app |
| Share → As a PDF | one-page statement | a proper itemised document, opens anywhere |
| Export as a spreadsheet | CSV | checking the arithmetic |

- **`expo-print` was added** (`~15.0.8`) for the PDF. Confirmed against the
  v54 docs before installing: it is **bundled in Expo Go**, needs **no
  development build, no config plugin and no permission** — `app.json`'s
  `plugins` is unchanged. It also unblocks `11-reports.md`'s deferred
  "CSV first, PDF later" note, should that get picked up.
- **Both file formats lay the entries out as a MATRIX** — one row per entry, one
  column per person holding their share — because that's the shape you actually
  check arithmetic in. A member who wasn't in an entry gets a **blank, not a
  zero**: a ₹0 share and no share are different facts, and the blank is what
  makes an uneven entry visible when scanning a column.
- CSV amounts are raw numbers (spreadsheets must parse them); PDF amounts are
  formatted with the currency symbol (it's a document for humans). Same
  reasoning `buildTransactionsCsv` already applies.
- **The PDF HTML escapes every user-authored string.** Split names, entry
  descriptions and settlement notes are typed by people, and one `<` would
  otherwise break the document. Verified with deliberately hostile input.
- Self-contained inline CSS, **no webfonts and no images** — it has to render
  identically in whatever PDF viewer the recipient happens to have, and a font
  that failed to load would reflow the table.
- `shareCsv` gained a `dialogTitle` parameter (defaulted, so the existing
  reports call site is untouched).

**The pairwise view was built after all, and my reason for deferring it was
wrong (2026-08-26).** Out of Scope below said a per-entry tracing view would
"only differ when there are 2+ creditors, which is rare". The user's real Mysore
trip disproved that. Its actual numbers:

| Person | Paid | Their share | Net |
|---|---|---|---|
| Abishek | ₹6,838.00 | ₹1,367.60 | **+₹5,470.40** |
| Stephin | ₹86.00 | ₹1,396.26 | −₹1,310.26 |
| You | ₹51.00 | ₹1,384.60 | −₹1,333.60 |
| Maaz / Srijish | ₹0 | ₹1,413.27 | −₹1,413.27 each |

Three people paid, but **only Abishek is a net creditor** — so greedy netting
correctly printed "everyone pays Abishek", and in doing so **silently absorbed
the money the other two payers were owed.** The user fronted a ₹51 auto for
three people, so Maaz and Srijish each owe *them* ₹17; that ₹34 was netted into
their own Abishek debt (₹1,367.60 − ₹34 = ₹1,333.60) and never shown. The
arithmetic was never wrong; the presentation hid a real debt. **The lesson: "one
creditor" is not the same as "one payer", and it's the payer who wants to see
their money.**

Built, per direct instruction that a finance feature shouldn't hide its working:

- **`computeDirectDebts`** in `lib/splitMath.js` — every debt traced to the
  entry's payer, with mutual pairs netted against each other and settlements
  cancelling debt in the direction paid. Overpaying flips the direction, which
  is correct: overpay and you're owed.
- **`explainBalances`** — the arithmetic in words, because nobody should
  reverse-engineer why their figure is ₹1,333.60 rather than the ₹1,367.60 their
  share came to. *"You owe ₹1,367.60 (Abishek ₹1,367.60) and are owed ₹34 (Maaz
  ₹17, Srijish ₹17) — net ₹1,333.60 out of pocket."*
- **Always visible, no "show details" toggle.** The detail is the primary
  answer; the fewest-payments list stays underneath as *"Simplest way to
  settle"*, which is what you'd actually pay and where the Settle buttons live.
- **All three export formats carry both**, plus the explanations — it's a
  document people check against each other's memory.
- **Verified against the live rows**, including that the traced debts reconcile
  exactly to the summary nets for every member, in integer paise.

**Also fixed, found by that verification: `formatMoney` printed ₹1,367.6.**
`maximumFractionDigits: 2` alone drops a trailing zero, and split shares are the
first amounts in this app to routinely land on paise. Now a value *with* a
fraction shows both decimals while whole rupees still show none — preserving
`lib/currency.js`'s original stated intent (no forced "₹4.00") without ever
printing a half-finished decimal. **App-wide change**, so any amount anywhere
with a single decimal place gains its trailing zero.

**One more note on that verification:** summing the per-member nets as rupee
*floats* gives −9.09e-13, not 0. The invariant holds exactly in integer paise —
which is precisely why `lib/splitMath.js` computes there and converts once at
the edge. A test asserting `sum === 0` on floats will fail for correct code.

**Scope of a "person", since it's a reasonable thing to wonder:**
`split_people` is a **reusable, user-global contact list** — deliberately not
per-split, and not account-scoped either (same as `categories`). You travel with
the same friends repeatedly, so retyping them every trip would be the feature's
main friction. `split_members` is the per-split join; deleting a split removes
its membership rows and leaves the people themselves for next time. It's also
what makes a future per-person view ("Rahul owes you ₹2,300 across everything")
possible without a data migration.

**Known Phase 1 rough edges, accepted:**

- The one-line IOU ("I just owe Rahul ₹1,075") still needs a two-member split
  with one entry — scenario 4's accepted friction.
- `split_people.phone` is captured and stored but nothing reads it yet.
- `split_members.member_user_id` and `role` are written correctly but inert
  until Phase 3.

**→ Phase 1 is code-complete and verified as far as this environment allows.
Run it on your phone and confirm the unchecked items above before Phase 2.**

---

## Phase 2 — Link My Own Transactions ✅ Complete (2.1–2.3; 2.4 deferred by decision)

### Before Starting — Confirm Phase 1 is Approved

### Goal

Stop typing things twice. When you pay for lunch on the trip, you log it once
in FLO and tick "Mysore Trip" — and it becomes a split entry. Going the other
way, an entry you already recorded in the split can be matched to a transaction
you already logged. This is the answer to the user's own observation: *"I did
not think about recording a transaction in the app while paying and adding it
in the expense — this is where it is tricky."*

This phase is still **entirely single-user**. No RLS changes, no cross-user
reads. It is the highest value-per-unit-risk phase in the feature.

### 2.1 Database

Migration name: **`split_entry_transaction_link`**

```sql
alter table public.split_entries
  add column transaction_id uuid null
    references public.transactions (id) on delete set null;

create index idx_split_entries_transaction_id
  on public.split_entries (transaction_id);
```

`ON DELETE SET NULL`, deliberately: deleting the transaction must **not** delete
the split entry. The entry is a fact about the trip that four other people are
relying on; the transaction is a fact about your bank account. They are
independent, and this FK is only a convenience link.

### 2.2 Data Layer

- `lib/splits.js` gains `linkEntryToTransaction(entryId, transactionId)` and
  `unlinkEntry(entryId)`.
- `saveEntry` accepts an optional `transactionId`.
- **`hooks/useSplitCandidates.js`** — mirrors the existing
  `hooks/usePlanCandidates.js` (from `09-plans-that-collect.md` Phase 1) to
  list the account's transactions in a date range for bulk selection. Read that
  hook first and extend the same shape rather than inventing a second one.
- `logEntryFromPocket` from Phase 1 now writes `transaction_id`, closing the
  gap noted in 1.6.

### 2.3 Components / Integration

- **`components/AddTransactionSheet.js`** — an **"Add to split"** picker,
  built to mirror the existing "Add to Plan" picker in the same sheet (read it
  and copy the pattern). Selecting a split creates the matching entry, with the
  logging user as payer and all members as participants split equally — the
  overwhelmingly common case — editable afterwards from the split.
- **Route restructure**, exactly the move `09-plans-that-collect.md` Phase 1
  made for plans:

  ```
  app/split/[id].js   →  app/split/[id]/index.js     (content unchanged)
                      +  app/split/[id]/history.js   (new)
  ```

  A dynamic route file and a directory of the same name can't coexist.
  `/split/<id>` must keep working identically — verify by navigating, not by
  assuming. **Requires `npx expo start -c`** (new route directory), per the
  note in `28-onboarding-welcome-bundle.md`.
- **`app/split/[id]/history.js`** — "Add from my transactions": filter the
  account's transactions by date range, multi-select, turn each into an entry.
  Directly modelled on `app/plan/[id]/history.js`.
- Entry rows in the detail screen show a small link glyph when
  `transaction_id` is set, tapping through to that transaction.

### 2.4 Decision Point — The Float / Analytics Question

**This phase must settle option B vs C vs D from the Research section.** By now
there is real usage to judge from, and the specific question is: *when a
big-payer settlement brings ₹5,336 back, what should it count as?*

**Recommendation: option B** — a `settle_in` / `settle_out` type pair, mirroring
`transfer_in`/`transfer_out` exactly. Reasons: the semantics already exist and
are proven in this codebase (`10-account-self-transfer.md`); balance stays
correct; nothing pollutes income, budgets, plans, analytics or the streak
because they all filter on the exact strings `'income'`/`'expense'`.

The cost is not the migration — it's the **sweep**. Widening
`transactions_type_check` is one line; auditing every aggregation is not.
Anything that must be reviewed before this ships:

- `v_global_summary` (must count settle types in `in_hand_balance`)
- `v_budgets_with_spent`, `v_plans_with_totals`
- every function in `lib/analytics.js`
- `lib/streak.js`, `lib/reports.js`, `lib/export.js`
- `AmountText` and every type-based icon/colour switch in the UI
- `hooks/useTransactions.js`'s `type` filter and all five of its call sites

Do not start this without re-reading `10-account-self-transfer.md`'s
implementation notes — it is the same sweep, already done once, and its lessons
are written down.

**If B is judged too large**, the fallback is A (log only my share, accept the
float) rather than D (income) — a wrong balance for a week is more honest than
a permanently wrong income figure.

### 2.4 — DECIDED AND BUILT: option B (2026-08-26)

Migration **`split_settlement_types`**. Superseded the "deferred" note below,
which is kept for the reasoning.

```sql
alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type = any (array['income','expense','transfer_in','transfer_out','settle_in','settle_out']));

-- balance is the ONLY total that counts the settle types
create or replace view public.v_global_summary as
select account_id,
  coalesce(sum(amount) filter (where type = 'income'), 0) as total_income,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as total_expense,
  (   coalesce(sum(amount) filter (where type = 'income'), 0)
    + coalesce(sum(amount) filter (where type = 'transfer_in'), 0)
    + coalesce(sum(amount) filter (where type = 'settle_in'), 0)
    - coalesce(sum(amount) filter (where type = 'expense'), 0)
    - coalesce(sum(amount) filter (where type = 'transfer_out'), 0)
    - coalesce(sum(amount) filter (where type = 'settle_out'), 0)
  ) as in_hand_balance,
  coalesce(sum(amount) filter (where type = 'income'
    and occurred_at >= (date_trunc('month', current_date))::date), 0) as month_income,
  coalesce(sum(amount) filter (where type = 'expense'
    and occurred_at >= (date_trunc('month', current_date))::date), 0) as month_expense
from transactions group by account_id;

alter view public.v_global_summary set (security_invoker = true);
```

**The sweep was far smaller than this doc feared, for a reason worth recording.**
`v_budgets_with_spent` and `v_plans_with_totals` both filter `type = 'expense'`;
`hooks/useStreak.js` already queries `.in('type', ['income','expense'])`;
`lib/analytics.js` filters exact types in all four places (including
`biggestTransaction`, which has its own comment about exactly this);
`hooks/useAllAccountSummaries.js` already guards
`type !== 'income' && type !== 'expense' → continue`. **Not one of them needed
changing.** Only `v_global_summary` (which is the only thing that *should* count
them) plus display and CSV.

**This is the argument that decided B over C**, and it's the durable lesson: with
a new *type*, anything not updated simply stops matching and therefore excludes
it — **it fails safe**. With a `my_share` column, anything not updated keeps
summing the full amount — **it fails dangerous, and silently.** In a money app
that asymmetry outweighs C's tidier single row.

**What actually got wired, and the asymmetry that matters:**

| Event | Type written | Why |
|---|---|---|
| I pay a settlement | `expense` *(unchanged)* | It IS my consumption. Paying my share of the lunch is spending on lunch and belongs in my categories and budgets. |
| Someone pays me | **`settle_in`** *(was `income`)* | It is NOT income. Money I fronted for other people coming back was never earnings. |
| Settlement between two other people | nothing | Not my money. |

That asymmetry — you pay your share (spending), you get back your over-payment
(not earnings) — is the whole correction. `settle_in` also carries **no category
and no plan**: it's excluded from every category total by design, so offering a
picker would imply it landed somewhere it doesn't, and tagging it to a plan would
put a credit in the middle of a spend list.

**CORRECTION to the options table above:** it claimed option B made
"budgets/analytics correct". That was overstated, and the build surfaced it. B
fixes the **income** side completely. It does **not** fix the big payer's
*expense* over-count if they opt into the pocket-log at the full amount —
Abishek's ₹6,750 is still ₹6,750 of expense against a true cost of ₹1,414, and
`settle_in` doesn't offset a figure in a different column. Mitigations, in order:
the pocket-log is **default off**, so the ordinary path (settle-only) is already
exact; and leaving it off makes the recorded expense equal your true share.

**`settle_out` is declared but nothing writes it yet.** Its purpose is the
refinement that closes the remaining gap: a pocket-log would write **two** rows
— `expense` for your own share, `settle_out` for the part you fronted for others
— so the expense column shows ₹1,414, the balance still moves ₹6,750, and the
later `settle_in` cancels the `settle_out` exactly. Declaring the type now means
that change is client-only, with no further migration. **One residual it does
not close**, worth knowing before building it: a net *debtor* who also fronted
something (Chris paying ₹140 of the autos) never gets that money back in cash —
it's netted into what he owes — so his leftover `settle_out` would sit on the
books un-recovered and his expense total would be short by it. The clean fix is
to convert any leftover `settle_out` into `expense` at **Close split**, which is
already a deliberate, well-defined moment. Not built.

**Verified live** (rolled-back `DO` block): constraint holds all six types and
still rejects a bogus one; `security_invoker=true` survived the view recreation;
inserting `settle_in 5336` + `settle_out 336` moved `in_hand_balance` by exactly
**+5000** while `total_income` and `total_expense` both moved **0**.

---

### 2.4 — the original "deferred" reasoning (superseded, kept for the record)

**Not decided, and not decided by accident.** The whole premise of putting this
question in Phase 2 was that there'd be real usage to judge it by. There isn't
yet — at the time Phase 2 shipped, the app had one split with no entries and no
settlements, so choosing between B, C and D would have been the same guess it
would have been during planning, just later.

What made deferring the right call rather than the lazy one:

- **Nothing is blocked by it.** Phase 2's actual value — log it once, not twice —
  is entirely independent. Balance correctness is already right in all three
  payer positions (see the Research table); only *categorisation* in the
  big-payer case is affected.
- **Option B is the largest-blast-radius change in the whole feature.** It
  widens `transactions_type_check` and then requires auditing every aggregation
  in the app: `v_global_summary`, `v_budgets_with_spent`, `v_plans_with_totals`,
  every function in `lib/analytics.js`, `lib/streak.js`, `lib/reports.js`,
  `lib/export.js`, `AmountText`, and `hooks/useTransactions.js` with all five
  of its call sites. Doing that speculatively, to fix a distortion the user has
  not yet hit, is exactly the kind of unrequested risk this doc's own phasing
  exists to avoid.
- **The distortion is self-announcing.** The first time the user fronts a big
  chunk of a trip and gets paid back, their income total and savings rate will
  visibly lie. That's a far better trigger than a prediction.

**Recommendation stands at option B** (a `settle_in`/`settle_out` type pair
mirroring `transfer_in`/`transfer_out`), for the reasons above. **Revisit
trigger**: the first time a settlement lands as income and looks wrong on the
Home hero, Analytics, or a report. Re-read
`10-account-self-transfer.md`'s implementation notes before starting — it is the
same sweep, already done once, with its lessons written down.

### 2.5 Phase 2 Checklist

- [x] `split_entry_transaction_link` applied; column is nullable and the FK is `ON DELETE SET NULL`, verified via `pg_constraint.confdeltype = 'n'`; the index exists.
- [x] **Deleting a linked transaction leaves the entry intact** with `transaction_id` NULL, its shares kept and its amount unchanged — verified live in a rolled-back `DO` block (`entry_survived=t · transaction_id_now=NULL · shares_kept=1 · amount_still=500.00`). This is the phase's load-bearing invariant.
- [x] The float/analytics decision is **recorded in this doc with its reasoning** — recorded as *deferred*, see 2.4 below.
- [x] `npx expo export --platform android` bundles cleanly.
- [x] No import cycle between `lib/splits.js` and `lib/splitMath.js` (splitMath imports nothing).

Needs a running app — **not** verified from this environment:

- [ ] `/split/<id>` still resolves after the route restructure (**needs `npx expo start -c`** — new route directory).
- [ ] Logging an expense with a split selected creates exactly one entry, payer = you, equal shares, and links back to the transaction.
- [ ] Add-from-history bulk-creates entries with correct amounts and dates, and already-linked transactions are not offered again.
- [ ] An entry created from a transaction, then edited in the split, does not write back to the transaction (Decision 9).
- [ ] A partial failure mid-bulk reports "added N of M" rather than implying all or nothing.
- [ ] The "I paid this from my pocket" toggle now links its entry, so the row reads "in your ledger".

### Phase 2 — Implementation Notes

**One migration**: `split_entry_transaction_link`. **Requires `npx expo start -c`**
— `app/split/[id]/` is a new route directory.

**Deviations from the plan, all deliberate:**

- **`linkEntryToTransaction` is a separate call, not a parameter on
  `save_split_entry`.** Adding an argument to that function would change its
  signature, and `create or replace` with a new argument list creates a **second**
  function rather than replacing the first — leaving PostgREST with two overloads
  to choose between and erroring on every call. Two round trips is far cheaper
  than that. The window between them is harmless: if the link fails the entry is
  still complete, just not cross-referenced.
- **`useSplitCandidates` takes `alreadyLinkedIds` from the caller** instead of
  filtering in SQL. `usePlanCandidates` can express "not already in this plan"
  as a filter because plan membership is a column on the transaction itself
  (`plan_id`); split membership lives on the other side of the relationship
  (`split_entries.transaction_id`), and PostgREST can't filter one table by the
  absence of a row in another. The detail screen already has the split
  hydrated, so it hands the ids down — cheaper than adding a view.
- **The history screen's date window opens as the split's day *minus 7*, not the
  day itself.** A split is a single-day event far more often than a plan is, and
  a train ticket booked three days earlier is still part of the trip.
- **Bulk creation is sequential, and reports partial success.** Each entry is an
  RPC that writes a row plus its shares, so a mid-run failure is real; the toast
  says "Added N of M, then stopped: …" rather than implying all or nothing.
  Fifteen sequential RPCs take a moment — acceptable, and noted in case it ever
  needs batching.
- **"Add to Split" appears on NEW EXPENSES ONLY.** Not on income: money coming
  back to you is a *settlement*, which belongs in `SettleUpSheet` where it can be
  matched to who paid you — an entry is a shared cost. Not on an edit: there's no
  way to tell whether an entry was already created, so offering it there would
  quietly create a second one every time the transaction was touched. Same
  reasoning as Phase 1's pocket toggle.
- **The transaction insert in `AddTransactionSheet` gained
  `.select('id').single()`.** The only behavioural change to that sheet's save
  path, needed to cross-reference the entry. Reading your own row straight back
  is already permitted by the table's `for all` RLS policy. A split-entry
  failure is reported on its own — "Transaction saved, but the split entry
  didn't" — because the transaction genuinely did save.
- **The link glyph is an indicator, not a nav target.** The plan said "tapping
  through to that transaction", but there is no transaction detail route in this
  app — transactions are edited through a sheet keyed by the row itself. The
  entry row shows a `Link2` glyph plus "in your ledger" in its sub-line, and
  tapping still opens the entry. Building a transaction-detail route for this
  would have been a new navigation surface nobody asked for.
- **`app/split/[id]/history.js` does something structurally different from its
  plan counterpart**, worth being explicit about: the plan version bulk-*updates*
  `transactions.plan_id` on rows that already exist; this one *creates* split
  entries **and never modifies the transactions at all**. A split entry is a
  separate object living beside the ledger, not a tag on it.

**2.4 was deferred by decision, not skipped** — see its own section above for
the reasoning, the standing recommendation (option B), and the revisit trigger.

**→ Phase 2 is code-complete and verified as far as this environment allows.
Restart Metro with `-c`, then confirm the unchecked items before Phase 3.**

---

## Phase 3 — The Shared Split 🚧 Foundation + sharing built; see 3.5 for what isn't

### Before Starting — Confirm Phase 2 is Approved, and Read This Whole Section First

This is the hardest phase in the FLO codebase and the one the design record
parked. **Do not start it as a continuation of Phase 2's momentum.** It changes
FLO's security model, which nothing else has ever done.

### Goal

Before or during the trip, one person creates the split and shares an invite
link. Friends who have FLO tap it and join. Each of them records their own
spending in their own FLO, and it surfaces in the shared split so everyone sees
who paid how much for what. At the end, the split says *"Maaz should pay
Abishek ₹1,414"* on everyone's phone. Friends without FLO stay as ghost
members, recorded by the organizer, exactly as in Phase 1.

### 3.1 Database

Migration name: **`split_shared_membership`**. Four parts, in this order.

**(a) Invites.**

```sql
create table public.split_invites (
  id         uuid primary key default gen_random_uuid(),
  split_id   uuid not null references public.splits (id) on delete cascade,
  code       text not null unique check (length(code) between 8 and 24),
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);
create index idx_split_invites_split_id on public.split_invites (split_id);
```

`code` is a random URL-safe string, not a uuid — it goes in a link a human
pastes into WhatsApp. Expiry is mandatory (an invite link that works forever is
an unrevocable grant to a money record).

**(b) The membership helper — the one new `SECURITY DEFINER` function.**

A policy on `split_members` that itself queries `split_members` recurses
infinitely. The standard fix is a definer function that bypasses RLS for the
membership lookup only:

```sql
create or replace function public.is_split_member(p_split_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from split_members
     where split_id = p_split_id
       and member_user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_split_member(uuid) from public, anon;
grant  execute on function public.is_split_member(uuid) to authenticated;
```

**This is FLO's third `SECURITY DEFINER` function and the widest.** The other
two (`delete_current_user`, `handle_user_delete`) are already advisor WARNs.
Keep it minimal: one `exists`, no side effects, `stable`, explicit
`search_path`, execute revoked from `public`/`anon`. Any growth in this function
is a security review, not a refactor.

**(c) Membership-based RLS.** The Phase 1 owner policies on `splits`,
`split_members`, `split_entries`, `split_entry_shares` and `split_settlements`
are **replaced**: read via `is_split_member(split_id)`, write via
`user_id = auth.uid()` **or** organizer role on that split. Full policy text is
written when this phase is actually planned — putting speculative policy SQL in
the doc now would be a fake migration record.

Two rules that must hold and must be tested by an actual second account, not
by reasoning:

1. **No policy on `transactions` changes. Ever.** Entries are projections
   (Decision 5).
2. `split_people` keeps its Phase 1 owner-only policy. Your private contact
   list — including phone numbers — is never shared by joining a split. A ghost
   member exposes only the projected display name.

**(d) Activity log.**

```sql
create table public.split_activity (
  id         uuid primary key default gen_random_uuid(),
  split_id   uuid not null references public.splits (id) on delete cascade,
  actor_id   uuid not null references auth.users (id) on delete cascade,
  kind       text not null,   -- entry_added | entry_edited | entry_deleted |
                              -- settled | member_added | member_removed |
                              -- split_closed | split_reopened | organizer_changed
  summary    text not null,   -- "changed Lunch from ₹1,600 to ₹1,900"
  created_at timestamptz not null default now()
);
create index idx_split_activity_split_id on public.split_activity (split_id, created_at desc);
```

Append-only: no UPDATE or DELETE policy at all. This is the visibility that
makes the permissive role model safe (Decision 6).

Also in this phase: `split_members.member_user_id` gets populated on join, and
`role` starts being enforced.

### 3.2 The Problems This Phase Must Solve

Each of these needs a decided answer written into the doc **before** any code:

| Problem | Shape of the answer |
|---|---|
| **Edit after others settled** | Projection updates, balances shift, affected members get the "changed after settling" state from Phase 1 plus a push. Never silent. |
| **Entry's owner deletes their transaction** | Entry survives (`ON DELETE SET NULL` from Phase 2). It must not vanish from four other people's math. |
| **Duplicate entries** — two people log the same lunch | Detect near-duplicates (same day, same amount ±, both payers members) and surface a "possible duplicate" prompt. Someone removes one. |
| **Two-sided settlement** | Recorded by one side, **confirmed** by the other. Each side's own transaction is written in their own ledger on confirmation. This is the one real state machine in the feature. |
| **Payer declares who owes** | Allowed — you logged the tickets, you tick who they covered. Visible to everyone, disputable via the activity log. First genuinely social surface in FLO. |
| **Member leaves / is removed with a non-zero balance** | Block removal, or require settling first. Do not silently redistribute someone's debt. |
| **Organizer goes inactive** | Transferable organizer role (Decision 6). |
| **Ghost becomes real** | A ghost member who later installs FLO and joins via link must be *merged* into their existing member row, not added as a sixth person. |

### 3.3 Client Work

- Deep link handling for `flo://split/join/<code>` plus an https fallback —
  read `app.json`'s existing scheme config and `expo-share-intent` setup before
  adding another link path.
- A join screen: which split, who's in it, what you're agreeing to see.
- Push on split activity via the existing `send-push` Edge Function (**the only
  Edge Function in this project — do not add another**).
- Role-aware UI: edit/delete affordances gated on entry ownership or organizer.
- Activity feed on the split detail screen.

### 3.5 What was actually built (2026-08-26), and what wasn't

Three migrations: **`split_shared_membership`**, **`split_member_display_name`**,
**`split_invite_preview`**.

**Built and verified:**

- `split_invites` (mandatory expiry, revocable) and `split_activity`
  (append-only — **no UPDATE or DELETE policy exists at all**).
- Membership RLS replacing the owner-only policies on `splits`,
  `split_members`, `split_entries`, `split_entry_shares`, `split_settlements`.
  **`split_people` and `transactions` were not touched.**
- Invite links, join-by-link, ghost-claiming, role-aware UI, and the resume path
  for a link tapped before the app was even installed.

**Corrections to this doc's own Phase 3 plan, all forced by the build:**

1. **Three new `SECURITY DEFINER` functions, not one.** 3.1(b) predicted only
   `is_split_member`. In practice: `split_role` (one function serving both the
   member and organizer checks, rather than two), `join_split` — **unavoidably**
   definer, because a joiner is by definition not yet a member so no membership
   policy can authorise their own INSERT, and RLS cannot take an invite code as
   a parameter — and `preview_split_invite`, so a link holder can see what
   they're joining before committing. The advisor now shows 6 WARNs: the 4
   pre-existing plus these 2 exposed RPCs (`split_role` is also listed).
2. **`is_self` was a single-user concept and had to be replaced.** It meant "the
   row that represents me on my device". Once member rows are read by several
   people, identity must be viewer-relative: I am the member whose
   `member_user_id` is my auth id. Backfilled on existing rows *before* the new
   policies landed, or the current owner would have lost access to their own
   split. `is_self` survives only as a fallback for pre-Phase-3 rows, and only
   when I'm the split's creator — otherwise the organizer's own row would read
   as "You" on everyone else's phone.
3. **The identity CHECK had to be relaxed.** `split_members_self_xor_person`
   required every non-self row to carry a `person_id`, which would have rejected
   a real user joining with no ghost to claim. Now `split_members_identity`:
   self, *or* a ghost with a person, *or* a joined user with a `member_user_id`.
4. **`split_members.display_name` is new, and is a projection.** A member who
   joins without claiming a ghost has no name any other member can read — their
   name lives in `profiles`, which is owner-only and must stay that way. So
   `join_split` (already definer) copies their own `full_name` onto their member
   row at join time. One whitelisted field, copied at a known moment. It goes
   stale on a later rename; that's the price of not opening up `profiles`.
5. **Account-scoping had to give way in the list query** — `useSplits` no longer
   filters `account_id` in SQL. A split shared *with* me lives in the
   organizer's account, a row I can't even read, so an account filter hid every
   shared split completely. RLS already limits the query to splits I'm in;
   filtering client-side keeps a split if it's in the account I'm viewing **or**
   it's someone else's shared with me. Decision 10 still holds where it was
   actually load-bearing — the account a settlement lands in.
6. **Settlements land in the VIEWER's active account**, not `splits.account_id`.
   For a shared split the latter belongs to someone else. My settlement is my
   own money moving.

**Verified with two real accounts, as the `authenticated` role** (testing as
postgres would prove nothing — superuser bypasses RLS), every fixture rolled
back:

| Assertion | Result |
|---|---|
| Organizer reads own split and members | 1 / 2 ✓ |
| **Non-member reads split / members / entries** | **0 / 0 / 0** ✓ |
| Joins by claiming a ghost — merged, not duplicated | 2 members, not 3 ✓ |
| Re-tapping the link | idempotent, no duplicate ✓ |
| **Member reads the owner's contacts (incl. phone)** | **0, before AND after joining** ✓ |
| Member adds their own entry | allowed ✓ |
| Member edits / deletes another's entry | blocked (100 unchanged, row survives) ✓ |
| **Organizer edits a member's entry** | allowed (→ 77) ✓ — this is what lets a split be finished |
| Member deletes the split | blocked ✓ |
| Activity rows survive a DELETE attempt | ✓ append-only |
| Expired invite | rejected ✓ |
| Invite preview leaks phone / amount / entry text | **false / false / false** ✓ (keys are exactly the whitelist) |
| **`transactions` policies before → after** | **4 → 4, unchanged** ✓ |

**Regression found on device and fixed — `splits_read_policy_owner_branch`:**

Creating a split failed for **every** account with
`42501 new row violates row-level security policy for table "splits"`.

`createSplit` does `.insert(...).select('id').single()` — an
`INSERT … RETURNING` — and **RETURNING requires the new row to satisfy the
SELECT policy as well**. `split_shared_membership` had replaced that policy with
`split_role(id) is not null`, and `split_role` is **`STABLE`**, so it reads the
statement's snapshot and **cannot see the row that same statement is
inserting**. Before Phase 3 the policy was a plain `auth.uid() = user_id`
column comparison, which RETURNING handles without trouble — so this was a
Phase 3 regression, not a new-account problem, despite being noticed on one.

Proven by isolating the two shapes: a plain `INSERT` **succeeded** while
`INSERT … RETURNING` **failed**, and `split_role` returned `'organizer'`
correctly for a row from any *prior* statement.

Fix — give the owner a direct column branch with no function call in it:

```sql
create policy splits_read on public.splits
  for select using (
    (select auth.uid()) = user_id
    or split_role(id) is not null
  );
```

Members still read via `split_role`; a non-member still reads **0** (verified
after the change). It also makes the creator's own access independent of the
definer function, which is the more robust arrangement regardless.

**`splits` was the only table affected**, and the reason is worth keeping: every
other insert in this feature either has no RETURNING (`split_entry_shares`,
`split_settlements`, `split_activity`), or its policy resolves against an
already-committed parent row (`split_entries`, `split_invites`), or it's a plain
column comparison (`split_people`, `transactions`). **Standing rule: an RLS
SELECT policy that calls a STABLE function cannot be satisfied by
`INSERT … RETURNING` on the row being inserted.**

**NOT built — do not assume these work:**

- **Settlement confirmation (3.2's state machine).** The sharpest gap: a
  settlement is still recorded one-sided, so both parties recording the same
  payment would double-count it in the split's balances. Until this lands, treat
  settling on a shared split as "one person records it".
- **Activity feed UI.** The table exists and `join_split` writes to it, but
  nothing displays it and no other mutation logs to it yet. The permissive role
  model was justified *by* this visibility — so this is the highest-priority
  remaining item, not a nicety.
- **Duplicate-entry detection** (two people logging the same lunch).
- **Push notifications** on split activity (via the existing `send-push` — and
  it must stay the only Edge Function).
- **Blocking removal of a member with a non-zero balance**, and **organizer
  transfer**.
- Edit-after-settled still works as Phase 1 built it (the warning and the
  "changed after settling" badge), but nobody is notified.

### 3.4 Phase 3 Checklist (outline — expand when planning this phase)

- [ ] Every RLS rule verified with **two real accounts**, including the negative cases: a non-member reads nothing; a member cannot write another member's entry unless organizer.
- [ ] `is_split_member` is the only new `SECURITY DEFINER` function, minimal, with execute revoked from `public`/`anon`.
- [ ] **No policy on `transactions` was added or modified** — verified by diffing `pg_policies` before and after.
- [ ] `split_people` rows (including phone numbers) are provably unreadable by other members.
- [ ] An expired or revoked invite code cannot join.
- [ ] Every problem in 3.2 has a decided, documented answer and a test.
- [ ] Advisor run shows exactly one new expected WARN (the definer function) and nothing else.

---

## Data Model Summary (Final State After All Phases)

```
auth.users
  └── profiles, accounts, categories, transactions, budgets, plans, bills …  (existing)

split_people                    (my private contacts — NEVER shared)
  id, user_id, name, phone?, color

splits                          (account-scoped)
  id, user_id, account_id → accounts
  name, icon?, occurred_on, plan_id? → plans, status, closed_at?

  └── split_members
        id, user_id, split_id
        person_id? → split_people      NULL = me
        is_self, member_user_id? → auth.users   [P3]
        role (organizer|member)                 [P3 enforcement]

  └── split_entries              (NOT transactions)
        id, user_id, split_id
        description, amount, occurred_on
        payer_member_id → split_members
        strategy (equal|exact)
        transaction_id? → transactions  [P2, ON DELETE SET NULL]
        updated_at?, deleted_at?        (sanctioned edit-history exception)

        └── split_entry_shares
              entry_id, member_id → split_members, amount
              Σ amount === entry.amount, enforced by save_split_entry()

  └── split_settlements          (money that actually moved)
        from_member_id, to_member_id, amount, occurred_on
        transaction_id? → transactions   (set when I'm a party)

  └── split_invites              [P3]
  └── split_activity             [P3, append-only]

No view. Derived numbers (paid / owed / net / payment list) are computed in
lib/splitMath.js — consistent with FLO's never-store-a-derived-number rule.
```

**The one stored-derived-looking number, and why it's fine:**
`split_entry_shares.amount` is not derived from other rows — it is the user's
*input about fairness*, resolved at entry time. Storing it also makes each entry
immune to later membership changes (Splitwise's own rule: adding someone to a
group does not re-split old expenses). The genuinely derived numbers — every
balance — remain computed, always.

### `save_split_entry` — the atomicity boundary

`supabase-js` has no multi-statement transaction, so entry + shares cannot be
written atomically from the client, and a deferred constraint trigger would
reject the entry before its shares existed. This RPC is the only writer of both
tables, and it enforces `Σ shares = amount` server-side. `SECURITY INVOKER`, so
RLS still governs every row it touches.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `transactions` | Phase 1: none (settlements are ordinary income/expense). Phase 2: one nullable FK column. Phase 3: **no RLS change, ever.** | Match `AddTransactionSheet`'s insert payload exactly in `lib/splits.js` |
| `plans` | New nullable FK *into* plans (`splits.plan_id`) | None — `ON DELETE SET NULL` |
| `accounts` | Splits are account-scoped, cascade on account delete | None |
| Budgets / analytics / reports / streak | Structurally none; a settlement counts as ordinary income/expense | The big-payer categorisation distortion — Phase 2 decision point |
| `MenuSheet.js` | One row + `snapPoints` bump | Check both `isPro` branches |
| `lib/pro.js` | `FREE_LIMITS.splits: 1` (one *open* split) + a `PRO_BENEFITS` entry | Verify `app/pro.js` and `ProUpsellSheet` pick it up |
| Gamification | Intentionally untouched | Confirm settlements don't fire `rewardsMutations` |
| Auto-detect | None | A detected notification cannot guess `split_id`, same as `plan_id` |
| `IDEAS.md` | Two parked entries superseded | Rewrite both when Phase 1 lands |

---

## Out of Scope (All Phases)

- **Multiple payers on one entry** — cut on the user's own correction; two
  payments for one thing are two entries (Decision 1).
- **Shares / percent / itemised strategies** — flatmate-shaped, and the
  two-vector primitive means they're later UI work with no schema change.
- **Recurring shared expenses** (monthly rent) — scenario 7. Needs the float
  problem solved properly first.
- **Cross-split netting** ("Rahul owes you ₹2,300 across everything") — needs a
  friend-ledger concept; per-split netting only.
- **Per-entry pairwise tracing view** — every payment mapped to the two people
  who actually transacted, instead of greedy netting. Only differs when there
  are 2+ creditors, which is rare.
- **Quick single-entry split** from `AddTransactionSheet` — scenario 3. Likely
  the most frequent real case, but it's a second UI surface; deliberately
  deferred to see if it's missed.
- **WhatsApp nudge + UPI deep links** — `split_people.phone` is captured from
  Phase 1 but unused. High value, India-native, no backend needed. First
  candidate for a Phase 4.
- **`expo-contacts` people picker** — real friction win, but a native
  permission needing a dev-client build, an `app.json` plugin and a Play data
  safety declaration. Given this repo's Play Protect / "Restricted settings"
  history (`00-index.md`), not worth it until the feature is proven.
- **`profiles.phone` and any phone-based user discovery** — Decision 4. If it
  ever ships, it must be optional, verified, and matched by hash.
- **Multi-currency splits** — `IDEAS.md` idea 9 stands: the app never sums
  across currencies.
- **Splitting a single purchase across categories** — the *other* thing called
  "split transactions" in `IDEAS.md`. Unrelated feature, same word.
- **Any AI** — standing rule, `00-index.md`. Nothing here needs it.

---

## Index Updates (after all phases — Step 5 of the skill)

1. Add row `31 | 31-split-expenses.md | Split — shared expenses between people`
   to the Feature Files table in `00-index.md`.
2. Add `split_people`, `splits`, `split_members`, `split_entries`,
   `split_entry_shares`, `split_settlements` (+ `split_invites`,
   `split_activity` if Phase 3 lands) to the Schema Reference tables section.
3. Add `split_expenses_phase1`, `split_entry_transaction_link` (+
   `split_shared_membership`) to Applied Migrations, with verification notes.
4. Note `save_split_entry` under Shared Infrastructure — it's the first RPC in
   this codebase used as a write path, and the pattern (RPC for atomicity where
   supabase-js can't transact) is reusable.
5. **Rewrite both `IDEAS.md` entries**: "Lending / IOU tracking" → built as
   `31` Phase 1; "Multi-user bill splitting" → no longer parked, see `31`
   Phase 3, with the ghost-members + invite-links reasoning that changed the
   call.
6. If Phase 2 adopts option B, add `settle_in`/`settle_out` to the
   `transactions` row in Schema Reference and extend the standing
   exact-type-discipline warning that `10-account-self-transfer.md` established.
