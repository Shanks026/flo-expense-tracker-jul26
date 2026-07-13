# Idea: Subscription, and the Store-Readiness Problem It Exposes

**Not a plan. A reference.** Unscheduled, unphased.

**Recorded**: 14 July 2026

Two things that turned out to be the same conversation: *what should FLO charge
for*, and *what can FLO actually ship to a store*. The second constrains the
first far more than expected, which is why they're in one doc.

---

## Part 1 — The blocker: auto-detect cannot be the basis of a paid tier

This has to come first, because it invalidates the obvious monetisation plan.

### The three separate problems with auto-detect

**1. It is Android-only, and that is permanent.**
`modules/flo-notification-listener/` is built on Android's
`NotificationListenerService`. **iOS has no equivalent API and never will** — an
app cannot read other apps' notifications. This is not a "we haven't built it
yet"; it is architecturally impossible. Any iOS release of FLO ships with **zero**
auto-detection.

**2. The current allowlist is store-illegal.**
`lib/detect.js`'s `PERSONAL_USE_EXTRA_PACKAGES` includes the Messages app
(`com.google.android.apps.messaging`). Reading the notification a default SMS app
posts for a bank SMS is **functionally reading the SMS** — precisely the
workaround Google Play's SMS/Call Log policy targets. The file already says this
in a ⚠️ comment: *"must be removed before any store submission."* It was added
deliberately, for personal use, with eyes open (see `06-transaction-auto-detect.md`).

**3. Notification-listener access is itself a Play "sensitive permission".**
Even with the Messages package removed and only UPI/bank apps watched, this needs
a justified core-functionality declaration, prominent in-app disclosure, a privacy
policy, and an accurate Data Safety declaration. It is reviewable, and it can be
rejected. It also triggers Play Protect and Android's "Restricted settings"
friction on every non-Play install (already documented as a standing rule in
`00-index.md`).

### Why this wrecks the obvious pricing plan

The instinct is: *auto-detect is the magic → make it the paid tier.* That fails
three ways at once:

- **You cannot sell iOS users a feature that cannot exist on their device.** A
  single "Pro" SKU whose headline feature is Android-only is a refund queue and a
  one-star review generator.
- **You may not be able to ship it on Android either**, at least not in the form
  that currently makes it useful (the SMS-notification path is where most of this
  user's real transactions come from — that's *why* it was added).
- **Gating it would kill activation anyway** (see Part 2) — it's the habit-former.

**Conclusion: the paid tier must be built on features that work everywhere.**
Auto-detect is a *personal-use superpower and an Android bonus*, not a business
model.

### What automated capture looks like if FLO goes to a store

Options, roughly in order of realism:

| Path | Reality |
|---|---|
| **AI receipt scan** | Works on both platforms. Real marginal cost → naturally paid. Covers cash, which notifications never do. |
| **Share-sheet / SMS import** (`03`) | Already built, Android. User-initiated, so no sensitive permission. |
| **Email receipt parsing** (Gmail API) | Cross-platform, OAuth-scoped, no OS hack. Real work; real value. |
| **Account Aggregator (India, RBI framework)** — Setu, Finvu, etc. | The *legitimate* version of auto-detect. Regulated, consented, cross-platform. Costs money and needs compliance work. This is what a serious Indian fintech does. |
| **Plaid / Salt Edge** (global) | Same idea outside India. Expensive. |
| **Notification listener** | Android-only, policy-fraught, iOS-impossible. Keep as a *bonus*, never as the product. |

**Before any store submission** (checklist, not exhaustive):
- [ ] Delete `PERSONAL_USE_EXTRA_PACKAGES` from `lib/detect.js` **and** the
      matching `Messages` entry in `WATCHED_APP_LABELS`
- [ ] Prominent disclosure + consent screen for notification access (the
      onboarding detect step is most of this already)
- [ ] Privacy policy + Play Data Safety form, accurately declaring what is read
      and that nothing leaves the device
- [ ] Decide whether notification-listener is worth the review risk **at all**,
      versus shipping without it and leaning on receipt scan + share-sheet

---

## Part 2 — What to charge for

### The principle

**Never gate the ledger. Gate the leverage.**

A user's own financial data — entering it, seeing it, exporting it — stays free
forever. The moment someone feels their own money history is held hostage, a
finance app loses the one thing it cannot rebuild. What you *can* charge for
without anyone feeling cheated: **automation, intelligence, scale, depth** — things
that save time, or that cost you money to provide.

### Never gate

- **Logging transactions.** Unlimited, forever. "You've logged 50 this month,
  upgrade" kills the habit, and the habit is the funnel.
- **Viewing their own history.** Gating "see last year" is punitive in a way that
  gating "we *analysed* last year for you" is not.
- **Streaks, reminders, Koban.** These *are* the retention engine. Gating the
  habit loop is eating the seed corn.
- **The app lock.** Never paywall security in a money app.
- **Manual CSV export.** Contentious, but it's the "you're not trapped here"
  guarantee, and it makes people *more* willing to commit. Gate *scheduled/auto*
  export if something must live here.

### Gate-able, ranked by defensibility

1. **AI features — receipt scan, AI categorisation.** The most defensible gate
   available: **real marginal cost per use**. Users intuitively accept paying for
   what costs money to run. Must be metered server-side anyway, so enforcement is
   free. **And it's cross-platform — which, per Part 1, makes it the natural
   backbone of Pro.**
2. **Multiple accounts.** Free: 1. Pro: unlimited. Costs nothing to enforce, and
   the people who need three ledgers (personal + business + family) are exactly
   the people with a reason to pay.
3. **Insights, not analytics.** Charts stay free; the *advisor* layer is Pro —
   "Food is 40% above your 3-month average", anomalies, comparisons. You're
   charging for **conclusions**, not for access to their own numbers.
4. **Unlimited budgets & plans.** Free: ~2 budgets, 1 plan. Custom budget date
   ranges (the `custom` period type) is a natural Pro flag.
5. **Receipt storage quota.** Storage costs money. N free, unlimited on Pro.
6. **Widgets, dark mode, themes.** Cosmetic gating is the safest kind — nobody
   feels harmed.

### The hard one: auto-detect (where it exists)

Even on Android, **don't gate it outright.** It's what creates the logging habit,
and free users who never form the habit never become paying users. The middle
path: **detection is free; the intelligence on top is Pro.** Detection prefills
amount + direction for everyone; **AI categorisation** — the thing that makes it
one tap instead of three — is Pro. Same feature; the paid version is the magic one.

### Where the paywall goes

**Not in onboarding.** `IDEAS-personal-onboarding.md` is about building emotional
investment; spending it on a price tag before the user has logged a single
transaction wastes the whole thing. They have no evidence yet that FLO is worth
anything.

Put it **at the moment of desire**: adding a second account, creating the third
budget, tapping "scan receipt" — or best, a week in, when the first real insight
exists: *"We found something in your spending. See it with Pro."* A paywall that
arrives **after proof**.

A **7–14 day full-Pro trial, triggered after the first week of real usage** (not at
install) is the standard play, and it works.

### Pricing

- **Price for India, not San Francisco.** Real subscription fatigue in this market.
- **Offer a one-time "lifetime unlock"** alongside monthly/annual. Indie apps here
  routinely convert far better on lifetime, and for a personal tracker "buy the
  tool once" fits the mental model better than renting a service.
- Annual ≫ monthly for a finance app — people think about money in years.

### Two technical things people get wrong

- **Entitlements must be server-side.** A client-side `isPro` flag is defeated by
  anyone with a decompiler, and the AI calls have real cost attached. Entitlement
  checks belong in the Supabase **Edge Function** and in **RLS** — not in the React
  tree. **RevenueCat** is the standard for Expo/RN IAP and handles store plumbing.
- **The AI API key can never live in the client** (`EXPO_PUBLIC_*` ships in
  plaintext in the APK). Same Edge Function solves both problems — see `IDEAS.md`
  idea 3.

---

## The honest overall take

**Don't monetise yet.** There is one user (the author) and no retention data.
Ship the hook — personal onboarding, first transaction, the streak — and let real
usage say what people can't live without. *Those* are what you gate.

But **do** resolve Part 1 early, because it changes what gets built: if the paid
tier can't stand on auto-detect, then **AI (receipt scan + categorisation) isn't a
nice-to-have — it's the product's cross-platform reason to charge**, and it should
be sequenced accordingly.
