# Idea: AI in FLO — the gate-able Pro backbone

**Not a plan. A reference.** Unscheduled, unphased. When a piece gets picked up
it graduates into a numbered feature doc.

**Recorded**: 17 July 2026

This doc records *what* AI does in FLO and *in what order to build it*. The
**why AI at all** is settled elsewhere and not re-argued here: auto-detect is
personal-use-only and can never ship to a store (see `00-index.md`'s standing
note and `IDEAS-subscription-and-store.md` Part 1), so the cross-platform paid
tier has to rest on something that works everywhere — **AI is that something.**

Read alongside:
- `IDEAS-subscription-and-store.md` — the monetisation model and the **master
  build sequence** this doc's order nests into. Subscription is the short-term
  goal; the store release follows once subscription is solid.
- `IDEAS.md` §2 (merchant capture), §3 (AI ordering), §6 (search), §8
  (insights) — the original thinking these features build on.

---

## The one architectural insight everything rests on

Every AI feature below is the **same shape**: take something unstructured,
produce a **structured transaction draft**, open `AddTransactionSheet`
prefilled, and let the user confirm. FLO already prefills that sheet three ways
(manual, the personal-only native detect parse, the SMS-share regex parse); AI
just adds more input adapters onto the same target.

So **do not build "a receipt feature" and "a categorisation feature" as separate
backends.** Build **one Edge Function endpoint** — the proxy that is step 1 of
the subscription master sequence anyway — that accepts `{ image | text }` plus
the user's real category list and account context, and returns a validated
draft:

```
{ amount, occurred_at, category_id, merchant, note, confidence }
```

Receipt is the image adapter; category-suggestion is the text adapter. One key,
one metering point, one entitlement check, one output schema the sheet already
knows how to consume. Each new capability is a thin adapter, not a new service.

### Non-negotiables (inherited from `06` and `IDEAS.md` §3 — do not relitigate)

- **The API key never lives in the client.** `EXPO_PUBLIC_*` ships in plaintext
  in the APK. Everything routes through the Supabase Edge Function holding the
  key server-side. That proxy *is* the infrastructure; the rest is UI.
- **Never auto-insert.** A scan/suggestion opens the prefilled sheet; it never
  writes to the ledger without a confirming tap. An AI silently writing to the
  ledger is how a user stops trusting the ledger.
- **Category output is constrained to the user's real categories.** Never let
  the model invent "Groceries" when the user's category is "Food." Feed it the
  actual `categories` list (global per user, `type` income/expense) and reject
  anything off-list.
- **AI is the one gate needing hard server enforcement**, because it costs real
  money per call — metered in the same Edge Function that holds the key
  (`IDEAS-subscription-and-store.md` Part 3, "enforcement shape"). The
  create-time limit gates are client-side; AI is not.
- **Privacy is stated, not assumed.** Receipt images and transaction text leave
  the device to a model provider. Say so — the Data Safety form gains this
  disclosure (master sequence step 4).

---

## The features

### 1. AI categorisation — the cheap backbone (build first)

**Reframed now that auto-detect is personal-only.** `IDEAS.md` §3a framed this
around auto-detect; strip that framing. Categorisation is the **text adapter of
the proxy**, and it applies to *every* transaction being created — manual,
receipt, share — by suggesting a `category_id` from the note/merchant text.

- Tiny, cheap text call. **But high-frequency**, so it's the one AI feature that
  can quietly run up cost. Guard it with the merchant lookup below so repeat
  merchants never hit the model.
- Touches everything, zero extra user action → the natural first AI feature and
  the thing that makes the whole proxy earn its keep.

### 2. Merchant → category memory (pairs with #1 — mostly NOT AI)

`IDEAS.md` §2. A `merchant → category` mapping so the *second* purchase from a
shop is already categorised. **Better as a deterministic lookup table than an AI
call** — cheaper, instant, and it's what keeps categorisation's per-call cost
down (repeat merchants resolve from the table, never the model). AI's role is
only to *seed* the merchant string and the first suggestion; the memory itself
is a plain table + a "remember this choice" confirm.

### 3. Receipt scanning — the headline Pro AI feature (build second)

The cross-platform, real-marginal-cost feature that anchors Pro. Its job is the
one blind spot nothing else sees: **cash.** Card/UPI spend is easier through
other paths — don't sell receipts as "the new way to log," sell them as "catch
the spend nothing told you about."

**The flow:**
1. Camera / gallery import → image to the Edge Function (never a client key).
2. Model returns `amount`, `occurred_at`, a **category_id constrained to the
   user's list**, `merchant`, and per-field `confidence`.
3. `AddTransactionSheet` opens prefilled, into an explicit account (currency is
   account-scoped — `IDEAS.md` §9). Low-confidence fields are flagged.
4. On confirm, the transaction is written **and the image is attached** via a
   new `transactions.receipt_path` column — private bucket + signed URL, the
   exact `avatars` pattern (`00-index.md` Storage; the storage side is already
   solved, `IDEAS.md` §7).

**Additions worth building with it:**
- **Merchant extraction feeding #2** — the biggest multiplier; second receipt
  from the same shop is a one-tap confirm.
- **Soft duplicate check** — "possible duplicate of ₹450 on 15 Jul?" so a
  scanned card receipt doesn't double up with something logged another way.
  (Cash won't collide — which reinforces cash as the target.)
- **Stash the full model JSON** in a nullable `transactions.receipt_data`
  (jsonb) at scan time. Costs nothing, no table, no UI — future-proofs itemised
  search. **Still cut the line-items table/UI** until a screen reads it
  (`IDEAS.md` §3b — agreed).
- **Storage quota** as a second natural gate (N free images, unlimited on Pro —
  `IDEAS-subscription-and-store.md` Part 2 §5).

**Receipts are an attribute of a transaction, not a new entity.** No separate
"Receipts" tab/ledger — that would compete with the single-source-of-truth
`transactions` table. "Receipt history" is the transaction list filtered to
those with an image, and the camera is a capture *entry point* into the Add
sheet, not a destination.

### 4. The advisor layer — insights & the AI report summary (post-launch, additive Pro)

`IDEAS.md` §8. Charts show *what happened*; the advisor tells you something:
"Food is 40% above your 3-month average," "you spend 2× on weekends," anomaly
flags. Charging for **conclusions**, never for access to your own numbers
(`IDEAS-subscription-and-store.md` Part 2 §3).

- Cheap per user (batch, e.g. monthly), high felt-value.
- The pure compute in `lib/analytics.js` already has the raw numbers — mostly a
  prompt-and-thresholds problem.
- Includes the **AI-written report summary** already earmarked as a Pro report
  extra "when it exists" (`11-reports.md`, `IDEAS-subscription-and-store.md`
  Part 3 tier split).

### 5. Bill / subscription detection from history (post-launch, additive)

"You've paid Netflix three months running — track it as a recurring bill?" The
**legitimate, cross-platform** version of the value auto-detect reached for,
using data already in `transactions`, with no sensitive permission. Feeds the
existing bills feature (`04-notifications-and-recurring-bills.md`).

### 6. Budget suggestions (post-launch, additive)

"Based on your last three months, a realistic Food budget is ₹X." Fires exactly
at the paywall's "moment of desire" (creating a budget —
`IDEAS-subscription-and-store.md` Part 2, "where the paywall goes").

### 7. Natural-language search (later)

`IDEAS.md` §6. "How much on coffee last month." Genuinely nice, but **sequence
after plain search exists** — there is no search in `transactions` today, so an
NL query layer would have nothing to query. Build plain search first, then this.

---

## Parked

- **Voice input** ("350 rupees for shopping today" → prefilled sheet). **Held
  2026-07-17.** It's a clean idea and it's *literally the text adapter of the
  same proxy* — once "text → draft" exists, voice is just "get text, then call
  that." The reason it's parked, not scheduled: **the real cost is speech-to-text,
  not the LLM.** The cheap validation path is the OS keyboard's built-in
  dictation mic in the note field (free, no STT integration); a true
  tap-and-speak button/widget needs real STT (a device lib or a transcription
  model — added cost, latency, and a privacy line). Revisit **when widgets land**
  — that's where quick voice-add earns its place; until then there's no surface
  that justifies the STT work. Same confirm-before-write rule would apply.

---

## Cost & gating profiles (this is what pricing depends on)

Pricing (master sequence step 3) can't be set until AI unit cost per user is
measured — model, tokens/call, calls/month. The profiles that drive it:

| Feature | Cost shape | Gate |
|---|---|---|
| Categorisation (#1) | Tiny per call, **high frequency** | Cost-controlled by the merchant lookup (#2), not gated hard on its own |
| Merchant memory (#2) | ~Zero (table lookup) | Not gated |
| Receipt scan (#3) | **Highest per call** (image input) | Hard Pro gate + storage quota |
| Advisor / report summary (#4) | Cheap (batch, monthly) | Pro (the "conclusions" tier) |
| Bill detection (#5) | Cheap (periodic batch over history) | Pro |
| Budget suggestions (#6) | Cheap (on-demand) | Pro |
| NL search (#7) | Per query | Pro (later) |

All of it routes through the **single Edge Function proxy**, which is where the
key lives, usage is metered, and the `entitlements` check gates it.

---

## Build order (nested into the subscription master sequence)

Subscription is the short-term goal; the store release follows once it's solid.
The subscription doc's master sequence already interleaves AI with subscription
infra — this is that order, with the AI pieces made explicit:

**Foundation (shared with subscription):**
1. **Edge Function proxy + `entitlements` table.** The shared foundation for
   *all* AI and *all* entitlement/metering. Small, unblocks everything.

**The gate-able AI core — build before launch, so Pro has real substance and
AI unit cost is measurable for pricing:**
2. **AI categorisation (#1) + merchant→category lookup (#2)** — through the
   proxy, cheapest, touches everything, and the cost-control pairing.
3. **Receipt scan (#3)** — image adapter + `receipt_path` attach + storage
   quota. The headline Pro AI feature and the cash blind-spot closer.

**Then subscription proper (subscription doc steps 3–5):**
4. **Pricing research from the now-measured AI costs** → Play Console products +
   RevenueCat.
5. **Sub screens** — paywall sheet, the three create-time limit gates,
   report-extras gating; Data Safety form gains the AI disclosure.
6. **Store-readiness checklist (Part 1) → launch with the free/Pro split live.**

**Additive Pro intelligence — post-launch, purely additive (nobody loses
anything that never existed — the grandfathering doctrine):**
7. **Advisor layer + AI report summary (#4).**
8. **Bill/subscription detection (#5).**
9. **Budget suggestions (#6).**

**Later:**
10. **Plain search, then natural-language search (#7).**

> The AI core (steps 2–3) deliberately comes **before** pricing and the paywall,
> not after — because Pro without AI is just "remove limits" (a thin pitch, and
> the subscription doc expects low launch conversion precisely for that reason),
> and because pricing can't be set until real AI cost is measured. Building AI
> first solves both.
