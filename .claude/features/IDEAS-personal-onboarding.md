# Idea: Personal Onboarding (v2)

**Not a plan. A reference.** Unscheduled, unphased. Graduates into a numbered
feature doc if picked up. This is a substantial rework of `07-onboarding.md`
(built, shipped) — not a patch to it.

**Recorded**: 14 July 2026

---

## The idea

Replace the current functional onboarding (Welcome → Name account → First
transaction → Reminders → Auto-detect → Done) with a **conversational, personal**
one that makes the user *invested* before they ever reach Home.

Rough shape, as described by the user:

1. A warm, human opener. Just "Hey."
2. A screen that names their actual problem back to them — *"Do you lose track of
   where it goes, and wonder why your wallet has a hole in it by the end of the
   month?"*
3. **4–5 multiple-choice questions** about how they handle money today (how often
   they track, where it leaks, what they wish they knew).
4. A **reflection screen** — their answers played back, showing they were heard.
5. **A few commitment questions** — how determined are they, what will they
   actually do.
6. **Reassurance** — here's how FLO will help with exactly that.
7. *Then* create the account, and continue into the existing flow.

**The goal, in the user's own words**: make the user feel the app is personal, and
invested enough in the onboarding that they don't want to waste the time they've
already spent — which pushes them to log the first transaction. **The first
transaction is the hook.**

---

## Why it works (the mechanism is real)

- **Effort justification / the IKEA effect** — people value what they've invested
  effort in. Time spent in onboarding raises the perceived value of the app.
- **Commitment & consistency** — once someone states an intention, even to an app,
  they behave more consistently with it. The "how determined are you" question is
  a textbook **commitment device**.
- **Sign-up as progress-saving, not as a gate** — putting the questions *before*
  account creation is the sophisticated version of this. It's what Duolingo does
  (complete a lesson, then sign up): the account stops feeling like a toll booth
  and starts feeling like *saving what you've already built*.

Noom, Duolingo, Headspace and Rocket Money all run this playbook. It works.

---

## The one rule that decides whether this is great or gross

**Every question must change something real in the app.**

Ask seven thoughtful questions, show a warm "we heard you" screen, and then behave
exactly as if none of it happened → that is a **con**. It works for a week, then
the user notices nothing was personalised, and the trust that was borrowed gets
repaid with interest.

Make the answers *configure* things, and the identical flow becomes **honest**:

| Question | What it actually does |
|---|---|
| "How often do you track your spending today?" | Sets whether the nightly reminder is on, and at what time |
| "Where does your money quietly leak?" | **Pre-creates a budget** for that category — it's sitting on the Budgets tab when they land |
| "How determined are you to log every day?" | Sets the tone/aggression of Koban's nudge copy |
| "What do you most want to stop wondering about?" | Becomes the framing of the streak, and callback copy later |
| "Do your bank alerts already tell you when you spend?" | Decides whether to push auto-detect hard, or skip past it |

Now the reflection screen isn't a compliment — it's a **receipt**: *"Here's what we
set up for you."* Same emotional payoff, except true. And the user lands on Home
with a budget already there and a reminder already scheduled, which is *itself*
investment they won't want to throw away.

**Corollary: only ask what you will use.** Every question that changes nothing is
a small lie, and they accumulate.

---

## Suggestions / pushback

### Cut it to ~3 minutes, not 5–10

5–10 minutes is Noom's length, and Noom can afford it because it's *pre-qualifying
you for a $60/month subscription* — the length **is** the filter. FLO is a free
tracker: every extra screen is a drop-off point filtering for nothing. Target
**6–8 screens, 2–3 minutes**. The engagement comes from the questions being
*interactive*, not from there being *many*.

### Tease the mystery, never the spending

The "hole in your wallet" line is good — warm, recognisable, self-deprecating. But
**money shame causes avoidance**, which is the precise opposite of the behaviour
this is trying to create. FLO already has the right principle written into Koban's
voice rules (`lib/koban.js`): *never shame the user for spending — only for not
knowing.* Hold the onboarding copy to that same line.

### The completion rate is a vanity metric

The metric that matters is **not** "did they finish onboarding". It's:

> **Did they log transaction #1 — and #2 the next day?**

Optimise the flow to *hand them into logging*. Anything that adds warmth but
delays the first log is working against the stated goal.

### Store the answers and call back to them later

Persist the answers (a `jsonb` column on `profiles`, or a small table). Then
**reference them weeks later**:

> *"You said you wanted to stop wondering where it goes. Here's where it went."*

This is the single highest-leverage suggestion in this doc. It turns the
personalisation from a **one-time trick** into an actual relationship — the
difference between an app that felt personal once, and one that keeps proving it.
Cheap to store, compounding in value.

### Foreshadow, don't paywall

If subscriptions land (see the monetisation discussion), onboarding is the wrong
place for a paywall — the user has zero evidence yet. Onboarding can *foreshadow*
Pro; it must not gate the first transaction.

---

## Technical wrinkle to design for now (cheap now, expensive later)

FLO's current onboarding sits **behind auth**: `OnboardingGate` (`app/_layout.js`)
reads `profiles.onboarded_at`, and `RootNavigator` bounces any unauthenticated
user to `/sign-in`. There is no pre-auth surface at all.

Asking the questions **before** account creation therefore means:

- holding answers in **AsyncStorage** while unauthenticated,
- flushing them to `profiles` after signup completes,
- and letting the gate distinguish *"hasn't signed up"* from *"signed up, hasn't
  onboarded"* — which today collapse into the same redirect.

Not a huge change, but it inverts the current gate's assumption. Design for it
before building, not after.

---

## Risks

- **Length → abandonment.** Every screen is a chance to leave.
- **Questions that create expectations the app can't meet** (e.g. asking for an
  income goal the app never uses). See the one rule above.
- **Shame-driven avoidance** — the failure mode of money apps specifically.
- **It's a rework of a shipped, working flow** (`07`). The existing steps
  (name account, first expense, reminders, auto-detect) are all *useful* and must
  survive the rewrite — the personal layer goes *in front of* them, it doesn't
  replace them.
