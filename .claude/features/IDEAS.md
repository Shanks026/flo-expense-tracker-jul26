# FLO — Ideas Backlog

**Not a plan. A reference.** Nothing here is scheduled, phased, or approved. When
one of these gets picked up, it graduates into a numbered feature doc
(`NN-slug.md`) with real phases — this file just records the thinking so it
doesn't have to be re-derived.

**Last updated**: 14 July 2026

---

## Verified gaps (checked against the codebase, not assumed)

These four were confirmed by grepping the actual source on 2026-07-14. They're
facts, not impressions:

| Gap | Reality |
|---|---|
| **No transfer concept** | Nothing anywhere in `app/`, `components/`, `hooks/`, `lib/` models moving money between accounts. |
| **No search** | `app/(tabs)/transactions.js` has no search input. Filtering is month/type/category only. |
| **No merchant/payee** | `lib/smsParser.js` and `TransactionParser.kt` extract **amount + direction only**. Who the money went to is discarded, even though it's sitting in the notification text. |
| **`profiles.currency` is dead** | The column exists and is never read. Settings renders a hardcoded `"₹ INR"`. |

---

## 1. Account transfers — the one that's actively wrong

**The idea**: a way to move money between accounts without it counting as income
or expense.

**Why it matters more than it sounds**: FLO shipped multiple accounts but no way
to move money between them. Today, paying a credit card from your bank, or
moving cash into savings, has to be logged as an expense in one account and an
income in the other — so **both totals are inflated by money that never entered
or left your possession**. Every derived number inherits that: in-hand balance,
the income/expense chart, savings rate, category breakdowns, and any budget that
catches the "expense" leg.

This is not a missing feature so much as a **correctness bug in the data model**,
and it compounds the more accounts get used. Everything else built on top sits on
numbers that are currently a bit of a lie.

**Shape**: either a third transaction `type` (`'transfer'`) with a
`counterpart_account_id`, or a linked pair excluded from aggregation. Whichever
is chosen, every aggregating view (`v_global_summary`, `v_budgets_with_spent`,
`v_plans_with_totals`) and every analytics compute function must exclude it.
That's the bulk of the work — the write side is trivial.

---

## 2. Merchant capture + remembered categories — the multiplier

**The idea**: extract *who* the money went to from the bank/UPI notification,
then remember what category that merchant maps to. Second time you buy from
Swiggy, it's already categorised.

**Why it's the highest-value thing on this list**: auto-detect (`06`) is the app's
best feature and it's currently doing **half the job** — it gives you the amount
and direction, then you hand-categorise every single transaction. The merchant is
right there in the notification text and gets thrown away.

With a `merchant → category` mapping, a detected transaction arrives **fully
pre-filled** and logging collapses to one confirming tap. That's the difference
between a tracker you maintain and one that maintains itself. It also:

- gives every transaction a payee, which makes **search** worth having,
- makes analytics far more interesting ("₹4,200 at Swiggy this month"),
- feeds the plan-collecting feature (`09`) with better candidates.

**Cost**: merchant extraction from messy real-world bank SMS is genuinely hard,
and needs a rules table plus a "remember this choice" prompt. Still the best
return per unit of effort of anything here.

---

## 3. AI: categorisation first, receipt scanning second

Recorded from the 2026-07-14 discussion, because the ordering here is
counter-intuitive and worth not re-litigating.

### 3a. AI categorisation of detected transactions — **the right first AI feature**

Zero friction, touches **every** transaction, needs no camera and no user action.
This is what makes auto-detect complete. Feed the model the user's *actual*
category list and constrain the output to it — never let it invent "Groceries"
when the user's category is called "Food".

### 3b. Receipt scanner — good, but narrower than it looks

**The trap**: auto-detect already logs UPI/card spend with *zero* effort. A
receipt scanner *requires taking a photo* — strictly **more** work than the path
that already exists. So its real value is confined to the one thing bank
notifications can never see: **cash**. That's a genuine blind spot and worth
closing, but it reframes the feature — it's not "the new way to log", it's "the
way to catch the spend the bank never told you about".

**Line items are the part to cut** (at least at first). Extracting item-level
data into a model that has nowhere to put it means a new table, new UI, and
**nothing in the app that reads it** — analytics, budgets, plans and streaks
would all be exactly as smart without it. Build it only when you can name the
screen that consumes it. Otherwise it's a schema maintained forever for a feature
used twice.

### Non-negotiables if any of this gets built

- **The API key can never live in the app.** `EXPO_PUBLIC_*` vars ship to the
  client in plain text and can be pulled straight out of the APK. This has to go
  through a **Supabase Edge Function** holding the key server-side. That proxy is
  the actual infrastructure this feature needs; the rest is UI.
- **Never auto-insert.** `06-transaction-auto-detect.md` already established the
  principle: *a detected transaction is never written to the database* without
  confirmation. A scanned receipt must open the Add Transaction sheet pre-filled,
  exactly like a detected notification. An AI silently writing to the ledger is
  how a user stops trusting the ledger.
- **Privacy is a real decision, not a footnote.** Receipt images and transaction
  text would leave the device to a model provider. For personal use that's
  usually a shrug — but it should be said out loud, not assumed.

**Free bonus**: the storage side is already solved. The private-bucket +
signed-URL pattern from avatars (see `00-index.md`) works as-is for receipt
images — so "attach a receipt to a transaction" comes along with it.

---

## 4. App lock (biometric / PIN)

A money app containing the user's entire financial life, with **no lock**. Anyone
holding the unlocked phone reads everything. `expo-local-authentication` makes
this small. Low effort, high felt-security, and it's table stakes for anything
people would call a finance app.

---

## 5. Export (CSV / JSON)

No way to get data out. This is what stops people trusting a tracker with years
of history — "what if I stop using this?" Cheap to build, and it doubles as a
backup story and a tax-time story.

---

## 6. Search in transactions

There is none today. Useful now for notes and amounts; becomes genuinely powerful
once merchants exist (idea 2). Worth sequencing *after* merchants for that reason.

---

## 7. Receipt photos (without the AI)

Attach an image to a transaction. Storage pattern already proven by avatars
(private bucket, signed URLs, path stored in the column — not a URL). Useful on
its own, and a prerequisite the receipt scanner would need anyway.

---

## 8. Insights, not just charts

Analytics currently shows **what happened** and never tells you anything.
"Food is 40% above your three-month average." "You spend 2× on weekends."
That's the difference between a dashboard and an advisor — and the pure compute
functions in `lib/analytics.js` already have everything needed to derive it. No
new data, no new queries. Mostly a copy and thresholds problem.

---

## 9. Currency / going global

`profiles.currency` exists, is never read, and Settings shows a hardcoded
`"₹ INR"`. The question isn't just "wire up the column" — it's whether FLO can
support users outside India. Worked through on 2026-07-14; the reasoning below is
the point of this entry, because it's counter-intuitive and would otherwise be
re-derived from scratch.

### The model: currency belongs to the ACCOUNT, not the user

Two problems get conflated into one "user's currency" setting, and that
conflation is what makes this look scary:

- **What currency is this money in?** A property of *where the money lives* — the
  account. Ground truth. Never changes.
- **What currency do I want totals shown in?** A display preference.

Put the currency on the **account**. Every transaction in it is denominated in
that currency. `profiles.currency` becomes merely the **default for new
accounts** — nothing depends on it, so changing it is a non-event.

### "What if the user changes their currency?" — three cases, one problem

1. **Change the profile default** → affects new accounts only. Past transactions
   never referenced it. **Safe.**
2. **Change an account's currency while it has no transactions** → nothing to
   invalidate. **Safe.** (Covers the realistic "picked wrong at onboarding".)
3. **Change an account's currency when it already has transactions** → **don't
   allow it.**

### Why case 3 must be forbidden

Only two things can be done and both are wrong:

- **Relabel without converting** → a ₹50,000 balance becomes $50,000. That isn't
  a currency change, it's inventing money.
- **Convert the numbers** → the trap, because it sounds correct:
  - **It destroys history.** ₹1,000 spent in 2024 was ~$12 *then*. Converting at
    today's rate asserts it was $11.60 — something that never happened. Doing it
    truthfully needs the rate *on each transaction's date*, which nobody has.
  - **It isn't just transactions.** Budget amounts, plan targets and bill amounts
    are money too. Convert some and not others and the budgets are nonsense.
  - **It's irreversible.** Per-row rounding means converting back doesn't restore
    the originals.

**Rule: an account's currency is immutable once it has transactions.** Not a
limitation — a guarantee. The same reason you can't change a real bank account's
currency; you open a different one.

**A relocating user creates a new account in the new currency.** The old account
keeps its true history in the currency those things actually happened in. That's
not a workaround — two accounts *is* the truthful model of "I used to hold
rupees, now I hold dollars".

### The international-trip worry mostly dissolves

Spend 500 THB in Thailand on an Indian card → **the bank debits your Indian
account ₹1,250**. The statement says ₹1,250. The balance drops ₹1,250. So the
transaction *is* ₹1,250 in an INR account, and budgets/balance/analytics all keep
working with **zero** special handling. The bank already did the conversion, and
its number is the true one.

The 500 THB is *trivia* — worth keeping as two optional **display-only** columns
(`original_amount`, `original_currency`) that are never aggregated: "₹1,250 (฿500)".

A second currency is only genuinely needed when the user **holds** foreign money
(a foreign bank account, or THB cash being spent down) — which is exactly what
"an account has a currency" already handles: make a THB account.

### The big simplification: FLO needs no exchange rates at all

Almost everything is **already account-scoped** — `v_global_summary` groups by
account; budgets, plans, analytics and transactions all filter to the active
account. **The app never sums across two currencies**, so it never needs a rate,
a rate history, an FX API, or cache-staleness handling. That is the single
largest cost avoided here.

Conversion is a **display** operation, never a **storage** one. A "show
everything in USD" reporting toggle would be legitimate (non-destructive,
recomputed) — but it isn't needed, so don't build it.

**The one exception**: `bills` are global per-user, not account-scoped. They need
a decision — give a bill a currency, or tie it to an account.

### The real cost isn't the schema — it's the ₹ sweep

The schema is small (`accounts.currency`, plus the two optional display columns).
The work is everywhere else:

- **`formatMoney` (`lib/money.js`)** hardcodes `₹` **and** `en-IN` grouping
  (lakh/crore: `12,34,567`). Needs `Intl.NumberFormat` with a real currency code.
- Hardcoded `₹` across `AmountText`, budgets, plans, alerts, and the Koban copy
  strings.
- **`PromptNotifier.kt` formats `₹` natively in Kotlin** (auto-detect's prompt).
- **The honest catch**: **auto-detect and the SMS parser are structurally
  India-specific** — the regexes match `Rs.`/`INR`/`₹` and Indian bank
  "debited/credited" phrasing. Going global means that feature becomes
  region-aware or quietly stops working outside India. **The currency model is
  easy; making auto-detect work in another country is not.**

---

## Lower priority / deliberately parked

- **Dark mode** — feasible (tokens are centralised, `theme/tokens.js`) but
  cosmetic. Won't change what the app is worth.
- **Home-screen widget** (balance + streak) — genuinely good for the streak loop,
  but real native work. Do it once the core model is right.
- **Budget rollover** (unspent amount carries to next period) — real, but it cuts
  against FLO's everything-is-derived principle and would need stored state.
  Needs a proper think, not a quick build.
- **Split transactions** (one purchase across categories) — real, not urgent.
- **Recurring income** (salary) — bills cover recurring *payments*; recurring
  income isn't modelled.
- **Lending / IOU tracking** — common need in India (splitting with friends), but
  it's a whole second ledger concept. The single-player version (I record
  who owes me what for a shared expense, entirely inside my own ledger — no
  other user accounts, no invites, no acceptance flow) stays true to FLO's
  single-user grain and is the buildable version of this idea.
- **Multi-user bill splitting** (raised 2026-07-18) — search for other FLO
  users, invite them to a split, money deducts from their account once they
  accept and pay (the "Splitwise-shaped" version, seen in a Play Store money
  tracker with a maneki-neko icon). **Deliberately parked, not rejected** —
  the blocker is timing, not the idea. Two reasons it's not now:
  (1) **architecture** — every table in FLO is `RLS auth.uid() = user_id`;
  every balance/budget/plan is derived from *only your own* `transactions`.
  A split needs shared mutable state one user's app can read/act on that
  another user wrote (a group/split/members model, an accept→pay→settle
  state machine) — that's a different RLS model and a real distributed-state
  problem (disputes, edited-after-accept, accepted-but-never-paid), not an
  incremental feature. (2) **network effect** — a social feature's entire
  value is other people using it; FLO has ~1 real user today, so there's no
  network to unlock yet. Building it now would be the single hardest feature
  in the codebase serving a user base that doesn't exist. Note this is
  *not* unlocked by the anonymous-percentile idea in `IDEAS-gamification.md`
  (leaderboards themselves were rejected outright there) — a percentile is a
  read-only server-side aggregate with zero cross-user visibility, so it
  shares no real infrastructure with splitting. **Revisit trigger**: real
  DAU, the same threshold the gamification doc uses for external ads —
  before that, there's no "friends who use FLO" to split with anyway.
- **Multi-currency** — see idea 9. Probably never.

---

## Open decisions blocking other work

Neither of these is a feature — they're **product decisions** that have to be
made before anything is built on top of them.

1. **Is a plan a spending envelope or a savings goal?** The code says envelope
   (`v_plans_with_totals` sums expenses only; the pace vocabulary is
   `over_pace`, not `behind`). The design's own onboarding copy says "save toward
   trips and goals". These are different features — savings needs *contributions*,
   not expenses. Blocks `09-plans-that-collect.md` from going further.
2. **Should a plan's spend be excluded from budgets?** Today a trip blows through
   your ordinary budgets, because `v_budgets_with_spent`'s lateral never looks at
   `plan_id`. Excluding it is a clean SQL change but redefines what a budget
   *means*.
