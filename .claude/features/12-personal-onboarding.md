# Feature: Personal Onboarding (v2)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/12-personal-onboarding.md`
**Status**: Planned
**Last Updated**: 2026-07-14

> A substantial rework of `07-onboarding.md` (built, shipped). The functional
> steps from `07` — name your account, first transaction, reminders — **survive**;
> a conversational, personal layer goes **in front of and around** them. The
> auto-detect step from `07` Phase 3 is **cut** (personal-use-only, can't ship to
> the stores — see `06-...md` / `IDEAS-subscription-and-store.md`).

---

## Context

`07`'s onboarding is functional and honest but transactional: sign up → name
account → log one expense → reminders → (auto-detect) → done. It gets a user to
Home. It does not make them *invested*.

This rework applies the mechanism recorded in `IDEAS-personal-onboarding.md`
(effort justification / IKEA effect, commitment-consistency, and sign-up-as-
progress-saving à la Duolingo) and the 23-screen design in
`IDEAS-personal-onboarding-design-prompt.md` (built into
`claude-design/FLO Expense Tracker Design/FLO App.dc.html`). It has three acts:

- **Introduction (pre-auth)** — frame the problem, land an aha stat, capture
  who they are (name / age / income) and what they want, then reflect it back.
- **The hinge** — account creation, framed as *saving your progress*, not a gate.
- **Climax + conclusion (post-auth)** — name the account, log the first real
  transaction (the hook), see the day-0 streak, get a **real budget built from
  their answer**, set a report cadence, turn on reminders, then a short journey /
  free / commitment / all-set close.

**The one rule that keeps this honest** (from the idea doc): *every question must
change something real in the app.* A question that changes nothing is a small
lie. This doc wires each answer to a concrete effect (§ "The honesty contract"
below) — that is a hard requirement, not a nicety.

**The metric that matters** is not "did they finish onboarding" — it's *did they
log transaction #1*. Every screen is a drop-off point; the flow exists to hand
the user into logging, and the personal layer earns its length only if it
converts. The user has explicitly chosen a generous screen count here (it read
"like an engaging YouTube video"), so the padding is deliberate — but the spine
(problem → promise → the one budget-driving question → the transaction → the
reward) is what must never break.

### The load-bearing architectural change: the gate inverts

`07`'s entire flow lives **behind auth**. Today:

- `RootNavigator` (`app/_layout.js`) owns the signed-**out** rule only:
  `!session` → `/sign-in`.
- `OnboardingGate` (a `null`-returning sibling of `<Stack>` inside the providers)
  owns **all authenticated** routing: `session && !onboarded_at` → onboarding;
  `session && onboarded_at` → `/`. (This split — RootNavigator owns `!session`,
  the gate owns `session` — was the fix for `07`'s two-components-both-routing
  flicker bug. Preserve it: the two branches are disjoint by session presence,
  so they never fight.)

There is **no pre-auth surface at all**. The v2 introduction must run *before*
sign-up. So the gate inverts to three states:

| State | Routes to |
|---|---|
| `!session` **and** intro not yet seen on this device | `/onboarding/intro/opener` (Act 1) |
| `!session` **and** intro already seen (or returning user) | `/sign-in` |
| `session` **and** `onboarded_at` is NULL | resume the post-auth flow (`/onboarding/account`) |
| `session` **and** `onboarded_at` set | `/` |

- **One-time-ness is guaranteed by `profiles.onboarded_at`** (a DB flag that
  follows the *user*, per `07`), **not** by device state. The AsyncStorage
  `introSeen` flag only spares a returning user on a fresh device the sales intro
  — and even if it's wiped, the **"Already have an account? Sign in" escape hatch
  on screen 1** sends them to `/sign-in`, and once signed in their `onboarded_at`
  is already set, so they land on Home having seen zero questions. The intro can
  never trap a returning user.
- **The disjoint-by-session rule is preserved**: RootNavigator still owns *all*
  of `!session` (now a two-way choice on `introSeen`), the gate still owns *all*
  of `session`. Neither reaches into the other's half.

### The honesty contract (every answer → a real effect)

| Screen / question | What the answer actually does | Persisted? |
|---|---|---|
| Name — "what should we call you?" | Passed as `user_metadata.full_name` at sign-up → `handle_new_user` writes it to `profiles.full_name`. Greets by name throughout. | `profiles.full_name` (existing) |
| Age range | Selects which aha-stat variant shows (screen 7); stored for later callbacks | `profiles.onboarding_answers.age_range` |
| Income band | **Sizes the real budget** built in Act 2 (screen 17). Used in-session only. | **No — never stored** (user's explicit call: "should not store the revenue data") |
| Goal — "what do you want from this?" | Frames the streak explainer + the journey screen (20) + future callbacks | `onboarding_answers.goal` |
| Leak — "where does it quietly leak?" | **Pre-creates a real budget** in that category (screen 17) | `onboarding_answers.leak_category` |
| Tracking habit — "how often do you check today?" | Sets the nightly-reminder default + framing on the reminders step (19) | `onboarding_answers.tracking_habit` |
| Commitment — "how committed are you?" | Sets Koban's nudge tone (Phase 3 wiring) | `onboarding_answers.commitment` |

The reflection screen (12) plays the answers back as *being heard* ("you're in
the right place"). The **budget screen (17) is the receipt** — "you said X, so
here's a real budget, already live." Because the setup is genuine, the emotional
payoff is honest.

### Why this fits FLO (on-grain check)

- **One nullable column, one jsonb.** `profiles.onboarding_answers` is the only
  schema change. Everything else writes through existing paths: `full_name` via
  signup metadata, the budget via the `AddBudgetSheet` insert shape, the report
  cadence via `lib/reports.js`'s existing AsyncStorage setters, reminders via
  `lib/notifications.js`. **No derived numbers stored** — the budget's "spent" is
  still computed by `v_budgets_with_spent` as always.
- **Reuses `07`'s spine**: `lib/onboarding.js` (step registry → drives progress +
  routing), the `OnboardingGate` sibling-component pattern, `Confetti`/
  `PartyPopper`, and the account/expense/reminders screens (restyled, logic
  intact). `react-native-reanimated ~4.1.1` is already in the bundle (via
  `@gorhom/bottom-sheet`) — the "flawless landing page" text animations need no
  new dependency.
- **Reuses `11-reports.md`**: the cadence screen is a thin writer over
  `getReportSettings`/`setReportSettings` (cadence `off`/`weekly`/`monthly`).

---

## The screens (23) → routes

Act 1 is pre-auth (writes the AsyncStorage draft, never the DB). The hinge is the
existing `app/sign-in.js` in sign-up mode. Act 2/3 are post-auth.

| # | Screen | Route | Bg | Notes / revision-note deltas |
|---|---|---|---|---|
| **ACT 1 — INTRODUCTION (pre-auth)** ||||
| 1 | Opener | `intro/opener` | brand | "Hey 👋" — **uses an emoji**. **No shimmer.** "Sign in" escape hatch. |
| 2 | Problem | `intro/problem` | light | **Asks a question (the hook), doesn't state info** — question in para 1, answer in para 2, short + impactful. |
| 3 | Solution | `intro/solution` | light | The 2-min promise. **"2 minutes a day" gets a distinct decorative treatment (marker highlight / accent), NOT an underline** (no link look). |
| 4 | Name | `intro/name` | light | Text input → draft. |
| 5 | Age | `intro/age` | light | **Redesigned — more engaging; the plain 2×2 grid did NOT work.** See §component notes. |
| 6 | Income | `intro/income` | light | Bands + prominent "we never store this" badge. |
| 7 | Aha stat | `intro/stat` | ink | Age-tailored, count-up number, invisibility-of-spending framing (not shame). 4 variants. Placeholder citation until a real source is confirmed. |
| 8 | 2-minute ask | `intro/ready` | brand | **No shimmer.** |
| 9 | Goal | `intro/goal` | light | MCQ cards. |
| 10 | Leak | `intro/leak` | light | MCQ cards (drives the budget). |
| 11 | Habit | `intro/habit` | light | MCQ cards (drives reminders). |
| 12 | Reflection | `intro/reflection` | **brand** | **Redesigned — brand-lime bg; black cards with white text, stacked at the TOP, each with more info (answer + why); title + subtitle at the BOTTOM** ("You're in the right place"). |
| **THE HINGE** ||||
| 13 | Create account | `app/sign-in.js` (signup) | — | Framed "Save your progress". Reads drafted name → `user_metadata.full_name`. |
| **ACT 2 — CLIMAX (post-auth)** ||||
| 14 | Name your account | `account` | light | Retained from `07`, restyled. |
| 15 | First transaction | `expense` | light | Retained from `07` (full field parity per `07` fix #5). **The hook.** |
| 16 | Day-0 streak | *(no route)* | — | **RETAIN the existing streak-celebration UI as-is** — the `StreakCelebration` component already fires on the first transaction's `notifyChanged()`. Not a new screen. |
| 17 | Budget from your answer | `budget` | light | **NEW.** The receipt. Real budget from leak + income band. |
| 18 | Reports cadence | `reports` | light | **NEW.** Weekly / Monthly / I'll check it myself → `lib/reports.js`. **NO black graph card** (remove it). |
| 19 | Reminders | `reminders` | light | Retained from `07`, restyled; default/framing driven by the habit answer. |
| **ACT 3 — CONCLUSION (post-auth)** ||||
| 20 | Journey | `journey` | ink | **NEW. Short + engaging, NOT a 3-beat timeline** — the 3 beats were context for understanding, not screen content. |
| 21 | It's free | `free` | light | **NEW. Do NOT mention a Pro tier at all.** |
| 22 | Commitment | `commitment` | ink | **NEW. MCQ cards with emojis** (like the other question screens), **not big buttons**. |
| 23 | You're all set | `done` | brand | **NEW "you're all set" screen** (replaces `07`'s `done.js`). Confetti/popper retained. |

**Every screen animates its text in, staggered, like a landing page** (§shared
infra). Full-bleed **brand** and **ink** screens are the "cuts"; **light**
screens are the workhorses and carry the thin progress bar. Heroes hide the bar.

---

## Phase Overview

```
Phase 1 — Gate inversion + the pre-auth Introduction (Act 1)
  The riskiest, most novel part: make onboarding runnable BEFORE auth. The
  three-state gate, the profiles.onboarding_answers column, the AsyncStorage
  draft module, the new OnboardingScreen scaffold (light/brand/ink) + the
  landing-page text-reveal animation primitive, and all 12 Act-1 screens,
  ending by handing into account creation with every answer captured in the
  draft. The existing 07 post-auth tail keeps working unchanged behind it.

Phase 2 — The hinge + Climax (Act 2)
  Sign-up carries the drafted name. Flush the durable answers to
  onboarding_answers. Restyle account/expense/reminders onto the new scaffold.
  NEW budget-from-answer screen (the receipt), NEW reports-cadence screen.
  Verify the retained day-0 streak celebration still fires. Reflection's
  promises all become true here.

Phase 3 — Conclusion (Act 3) + honesty wiring + replay
  NEW journey / free / commitment / you're-all-set screens. Wire the two
  answers that still owe an effect: commitment → Koban nudge tone, goal →
  streak framing. Update Settings "Replay onboarding" for the v2 flow. Clear
  the draft on finish. Retire the superseded 07 scaffold once nothing imports
  it.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Gate Inversion + Pre-auth Introduction (Act 1) ✅ Complete

### Goal

A brand-new user on a fresh install opens FLO and lands on `intro/opener`
(*before* any sign-in), walks the 12-screen introduction, and is handed into
account creation with their name, age, income band, goal, leak and habit all
captured in an AsyncStorage draft. A returning user taps "Sign in" on screen 1
(or, having seen the intro once on this device, is routed straight to `/sign-in`)
and never sees a question. The existing `07` post-auth flow (account → expense →
reminders → done) continues to work unchanged after sign-up — Act 1 is purely
additive in front of it this phase.

### Before Starting — Confirm With Codebase

1. **`profiles` columns** (via Supabase MCP `list_tables`) — confirm the current
   set is `id / full_name / currency / created_at / avatar_url / onboarded_at`
   and that `onboarding_answers` does **not** already exist. (Verified
   2026-07-14 during planning; re-confirm before the migration.)
2. **`app/_layout.js`** — read the current `RootNavigator` redirect effect and
   the `OnboardingGate` component. Confirm RootNavigator owns *only* `!session →
   /sign-in` and the gate owns all authenticated routing (this is the post-`07`
   fixed shape — do not regress it). Confirm `OnboardingGate` sits as a
   `null`-returning sibling of `<Stack>` inside the providers.
3. **`app/sign-in.js`** — read how sign-up is triggered and whether it already
   passes `options.data` / `user_metadata` on `signUp`. Phase 1 does **not**
   change it; Phase 2 will make it read the drafted name.
4. **`lib/onboarding.js`** — the existing step registry (`STEPS`, `getSteps`,
   `getStepPosition`, `getNextRoute`, `DONE_ROUTE`, `useOnboarding().finish`).
   Phase 1 extends the registry to the full v2 list; `finish()` is unchanged this
   phase (it already correctly does *not* navigate — see `07` fix #14).
5. **`components/OnboardingScaffold.js` / `OnboardingProgress.js`** — read them;
   the new `OnboardingScreen` supersedes them but the retained `07` screens still
   import `OnboardingScaffold` until Phase 2, so it must keep working.
6. **`components/Confetti.js`** — the reduce-motion + reanimated pattern to mirror
   for the new text-reveal primitive (`AccessibilityInfo.isReduceMotionEnabled()`,
   one shared value, fires once).
7. **Standing lesson (`00-index.md`)**: adding a new route **directory**
   (`app/onboarding/intro/`) requires `npx expo start -c` or the route tree won't
   include it and `router.replace` will silently no-op. Restart with `-c` before
   debugging any "navigation does nothing" symptom.

### 1.1 Database

One nullable jsonb column on `profiles`. No new table, no view, no RLS change —
`profiles`' existing `(select auth.uid()) = id` policy already covers it.
`handle_new_user` is **not** changed (it inserts only `(id, full_name)` for
profiles; a new nullable column defaults to NULL, which is exactly right).

```sql
-- 12-personal-onboarding.md Phase 1 — durable store for the onboarding answers
-- that must outlive the flow (for personalisation + later callbacks). NULL for
-- everyone until they finish the v2 intro; existing users keep NULL and are
-- never shown the flow (their onboarded_at is already set).
--
-- Deliberately jsonb, one column, not one column per answer: the answer set will
-- evolve, and these are read as a bag for callbacks ("you said X"), not filtered
-- on in SQL. INCOME IS DELIBERATELY NOT STORED HERE — it lives only in the
-- device-local draft during the flow and dies with it (user's explicit call).
alter table public.profiles
  add column if not exists onboarding_answers jsonb;
```

Migration name: `add_profiles_onboarding_answers`. Apply via the Supabase MCP
(`apply_migration`) **before** writing component code, exactly as
`add_profiles_onboarded_at` was. This block is the durable record — keep it in
sync with what's live. After applying, run the security advisor (standing rule)
— a column add recreates no views, so no `security_invoker` step is needed, but
confirm no new finding.

**Expected shape once written (Phase 2 writes it):**

```jsonc
// profiles.onboarding_answers
{
  "age_range":      "25-34",          // '18-24' | '25-34' | '35-44' | '45+'
  "goal":           "stop_overspending",
  "leak_category":  "food",           // maps to a default category name
  "tracking_habit": "weekly",         // 'daily' | 'weekly' | 'when_off' | 'never'
  "commitment":     "all_in"          // 'all_in' | 'committed' | 'will_try'
}
```

### 1.2 Data Layer

**`lib/onboardingDraft.js`** (new) — the pre-auth answer store + the device-level
`introSeen` flag. AsyncStorage, same style as `lib/reports.js`/`lib/notifications.js`.

```js
// The pre-auth draft. This is the ONE onboarding AsyncStorage key that is NOT
// user-scoped (contrast the streak-celebration key rule in 00-index.md) — and
// legitimately so: it exists precisely before a user identity does. It is
// cleared on finish (useOnboarding().finish, Phase 3) once its contents have
// been flushed to profiles / consumed by the budget + reports steps.
const KEYS = {
  draft:     'flo.onboarding.draft',     // { name, age_range, income_band, goal, leak_category, tracking_habit, commitment }
  introSeen: 'flo.onboarding.introSeen', // '1' once the intro has handed off to auth on this device
};

getDraft()                 // → object (or {})
setDraftAnswer(key, value) // merge one field, persist
clearDraft()               // remove the draft key (called on finish)

getIntroSeen()             // → boolean
setIntroSeen()             // set '1' — called when Act 1 hands into sign-up AND on any successful sign-in
```

- `income_band` is written to the draft (screen 6) and read only by the budget
  step (Phase 2). It is **never** flushed to `profiles`. The Phase-2 flush
  whitelists the durable keys and deliberately omits `income_band`.
- `getIntroSeen()` is read by the gate (async). Because the gate's `!session`
  branch must wait on this async read, load it once into state — see §1.4.

**`lib/onboarding.js`** (extended) — grow `STEPS` to the full v2 list so progress
and routing derive from one source, as they already do. Each step gains metadata
the new scaffold needs:

```js
// Each: { key, route, act: 1|2|3, bg: 'light'|'brand'|'ink', progress: bool }
// `progress: false` hides the thin bar (hero/celebration screens).
// Act 1 steps are pre-auth; act 2/3 are post-auth. getNextRoute walks this list;
// the reflection step's "next" is the sign-up screen (the hinge), not a step.
```

- `getStepPosition` / progress: compute the bar's fill across the **whole**
  journey (all acts), so the bar reads as one continuous "saving your progress"
  arc across the auth boundary — the Duolingo effect. Hero screens pass
  `progress={false}` and render no bar.
- Register a step **only once its screen exists** (the `07` rule — a registered
  route with no screen renders a dot/bar step that 404s). Phase 1 registers the
  12 Act-1 steps; Phase 2/3 register the rest as they land.
- `finish()` is unchanged this phase. (Phase 3 adds `clearDraft()` to it.)

**No new read hook.** The gate still consumes `useProfile()` + `useAuth()`; Act 1
screens read/write only the draft (no network).

### 1.3 Components

```
components/
  OnboardingScreen.js     NEW scaffold: bg variants + progress bar + hero + footer + reveal
  OnboardingReveal.js     NEW landing-page text/element entrance (reanimated, staggered)
  CountUp.js              NEW small count-up number (for the stat), reduce-motion aware

app/onboarding/intro/
  _layout.js              (or reuse app/onboarding/_layout.js) headerless, gestures off
  opener.js  problem.js  solution.js  name.js  age.js  income.js
  stat.js    ready.js     goal.js      leak.js  habit.js  reflection.js
```

**`components/OnboardingScreen.js`** — the single scaffold every v2 screen uses.
Props:
`{ bg='light'|'brand'|'ink', stepKey, showProgress, hero, title, subtitle, footer, primaryLabel, onPrimary, primaryLoading, primaryDisabled, secondaryLabel, onSecondary, children }`.
- `bg` sets background + text palette from tokens: **light** → `colors.bg`/`ink`
  text, emphasis words in `colors.income` (deep lime — **raw `colors.brand`
  fails contrast on white**, this is codified in `theme/tokens.js`); **brand** →
  `colors.brand` fill, `colors.ink` text; **ink** → `colors.ink` fill, white
  text, emphasis words in `colors.brand` (lime pops on black).
- Thin progress bar pinned at top when `showProgress` (derived from the step's
  `progress` flag) — lime fill on a faint track, width = `getStepPosition` ratio.
- Vertical rhythm follows `07`'s hard-won v3 (fix #7): the whole group (progress,
  hero, title, subtitle, body) centres as one unit above the pinned footer;
  `scrollable` variants use `flexGrow:1 + justifyContent:center`. Do not
  reintroduce the "disconnected slabs" or "pooled whitespace" failures — they're
  documented dead ends.
- **All tokens, no raw hex / magic numbers.** Map the design HTML's raw colours
  onto `theme/tokens.js` (same table `07` §1.3 used).

**`components/OnboardingReveal.js`** — the "flawless landing page" animation.
Wraps children (or takes an array of lines) and fades+rises them in on mount,
**staggered** by index, with a soft spring. Built on reanimated (already in the
bundle). Honours `AccessibilityInfo.isReduceMotionEnabled()` — renders final
state immediately when reduce-motion is on (mirror `Confetti`'s guard exactly).
Every screen's title/subtitle/body/cards run through this so the whole flow has
one consistent entrance language.

**`components/CountUp.js`** — animates a number from 0 to target for the stat
screen (7). Reduce-motion → renders the final number immediately.

**Screen-by-screen (Act 1):**

- **`opener.js`** (brand) — big "Hey 👋" (**emoji required**, per revision note),
  one warm ink line, primary "Start", and the **"Already have an account? Sign
  in"** link → `router.replace('/sign-in')` (+ `setIntroSeen()`). **No shimmer**
  (the design's lime-gradient shimmer is cut per revision note).
- **`problem.js`** (light) — **must ask a question, not state a fact.** Para 1 =
  the question (the hook); para 2 = the answer/turn. Short, impactful. e.g. *"Ever
  get to month-end and think — where did it all go? / You're not careless. You
  just never had it written down."* Primary "Yeah, that's me".
- **`solution.js`** (light) — the 2-minute promise; **"2 minutes a day" rendered
  with a distinct decorative treatment — a marker-style pale-lime (`incomeBg`)
  highlight behind extrabold text, NOT an underline** (must not read as a link).
  (Only Manrope is loaded; if a true display/accent font is wanted instead, it
  must be added to the font loader — call that out rather than faking it.)
- **`name.js`** (light) — text input → `setDraftAnswer('name', …)`. Primary
  enables once non-empty.
- **`age.js`** (light) — **redesigned; the plain 2×2 grid did not work.** Make it
  engaging: full-width stacked selectable rows (or large tappable bands) with a
  short vibe line per band and a clear selected state (`incomeBg` fill + deep-lime
  border + check), animated in via `OnboardingReveal`. Writes `age_range`.
- **`income.js`** (light) — bands (`<₹30k / ₹30k–75k / ₹75k–1.5L / ₹1.5L+`) →
  `income_band`; prominent lock-icon `incomeBg` badge: *"We never store this. It
  just helps us size your first budget."*
- **`stat.js`** (ink) — 4 age-variant copies, big `CountUp` lime number,
  invisibility-of-spending framing (never savings-shame — FLO's Koban voice rule).
  Muted placeholder citation (e.g. "Source: NPCI, 2025") until a real, verifiable
  figure is confirmed before ship. **Do not fabricate a precise study stat** —
  that's the exact con the idea doc warns against.
- **`ready.js`** (brand) — "Got 2 minutes a day to never wonder again?" primary
  "I'm in". **No shimmer.**
- **`goal.js` / `leak.js` / `habit.js`** (light) — MCQ card screens; each writes
  its draft key. Options per the design-prompt (§9–11). Cards use `OnboardingReveal`
  stagger + a selected state.
- **`reflection.js`** (**brand**) — **redesigned per revision note**: brand-lime
  background; the user's answers as **black cards (`colors.inkCard`) with white
  text, stacked at the TOP**, each showing more than a label — the answer + a
  one-line "why it matters"; the **title + subtitle sit at the BOTTOM** ("You're
  in the right place, {name}" + short why). Cards reveal staggered. Primary
  "Let's set it up" → `setIntroSeen()` then `router.replace('/sign-in')` (the
  hinge). This screen is *being heard*, not the receipt — it must not claim a
  budget is created yet (that's screen 17, Phase 2).

### 1.4 Navigation / Integration

**Gate inversion** — in `app/_layout.js`:

- **`RootNavigator`** keeps owning *all* of `!session`, now a two-way choice:
  read `introSeen` once (async, into state) and redirect `!session` →
  `getIntroSeen() ? '/sign-in' : '/onboarding/intro/opener'`. While the flag is
  still loading, redirect nowhere (return early) — a wrong guess would flash the
  wrong screen.
- **`OnboardingGate`** keeps owning *all* of `session`, unchanged in spirit:
  `!onboarded_at && !inOnboarding` → `/onboarding/account` (the post-auth resume
  point — Act 2's first step, since a signed-in user is past the pre-auth intro);
  `onboarded_at && inOnboarding` → `/`. Keep the "profile can be briefly null
  right after signUp — wait, don't treat as not-onboarded" guard from `07`.
- **Set `introSeen` on any successful sign-in too** (not just on Act-1 hand-off),
  so a returning user who signs in once isn't shown the intro on a later signed-
  out state on that device. Do this where the session-established side-effect
  already lives.
- **Preserve the disjoint-by-session invariant** (the `07` flicker fix): do not
  let the gate touch `!session` or RootNavigator touch `session`.

**Route directory**: `app/onboarding/intro/` is new — restart Metro with
`npx expo start -c` before testing (standing lesson).

### 1.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `app/_layout.js` routing | `!session` becomes a 2-way choice on `introSeen`; gate's resume target moves to `/onboarding/account` | Keep RootNavigator=`!session` / gate=`session` disjoint — do not regress `07`'s flicker fix |
| `profiles` / `useProfile` | +1 nullable jsonb column | Read only; nothing to wire in P1 |
| `app/sign-in.js` | A new signed-out entry path leads *into* it from the intro; behaviour unchanged | P2 makes it read the drafted name |
| `07` post-auth screens | None — still reached after sign-up, still work | Restyled in P2, not touched in P1 |
| `OnboardingScaffold` (old) | Still used by retained screens until P2 | Must keep working alongside the new `OnboardingScreen` |

### 1.6 What This Phase Does NOT Include

- The flush to `onboarding_answers`, the budget/reports screens, restyling the
  retained screens (Phase 2).
- The conclusion screens, Koban tone wiring, `clearDraft()` on finish, replay
  changes (Phase 3).
- Any change to `handle_new_user`, `AddTransactionSheet`, or the reports/
  notifications libraries.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `add_profiles_onboarding_answers` applied via MCP; column exists, nullable;
      security advisor shows no new finding *(only the 2 pre-existing WARNs —
      `delete_current_user` DEFINER + leaked-password-protection)*
- [x] `lib/onboardingDraft.js` exports the draft getters/setters + `introSeen`
      flag; `income_band` is stored in the draft and there is no code path that
      writes it to `profiles`
- [x] `lib/onboarding.js` registry extended to the 12 Act-1 steps
      (`INTRO_STEPS`) with `bg/progress` metadata; `getIntroNext('reflection')`
      returns `null` and reflection routes to sign-up explicitly; progress ratio
      spans the intro *(deviation from the plan's "whole journey" — see notes)*
- [x] `OnboardingScreen` renders all three bg variants with correct token
      palettes (light emphasis = `colors.income`, ink emphasis = `colors.brand`,
      brand text = `colors.ink`); no raw hex; vertical rhythm matches `07` v3
- [x] `OnboardingReveal` + `CountUp` animate on mount, stagger, fire once, and
      render final state immediately under reduce-motion
- [x] Opener shows the "Hey 👋" emoji, has no shimmer, and the "Sign in" escape
      hatch routes to `/sign-in` and sets `introSeen`
- [x] Problem screen is a question→answer hook (not an info statement); "2
      minutes a day" is decorated with a pale-lime marker highlight, no underline
- [x] Age screen is the redesigned engaging layout (stacked cards w/ emoji +
      vibe line), not the rejected 2×2 grid
- [x] Income screen shows the "we never store this" badge
- [x] Reflection screen: brand bg, black cards white text stacked top, title +
      subtitle at bottom, more-info per card; does not claim a budget exists yet
- [x] Each MCQ/input writes the correct draft key; re-entering a screen shows the
      previously chosen answer *(every intro screen prefills from `getDraft()`)*
- [x] `npx expo export --platform android` bundles clean (7.89 MB, no errors)
- [ ] **On device** (`expo start -c` first): fresh install → opener (pre-auth);
      walking the intro → sign-up with the draft populated; "Sign in" on screen 1
      → `/sign-in`; a returning (backfilled) user signs in → Home, zero questions;
      after seeing the intro once, a signed-out relaunch goes to `/sign-in`
- [ ] **On device**: text reveals read as one consistent landing-page entrance;
      nothing flashes the wrong screen during the async `introSeen` read

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes (2026-07-14)

- **Migration applied via MCP** (`add_profiles_onboarding_answers`). Verified
  live: column exists, nullable; both existing profiles have
  `onboarding_answers = NULL` and `onboarded_at` already set, so neither is
  dragged into the flow. Security advisor after: only the two pre-existing WARNs,
  no new finding (a column add recreates no views → no `security_invoker` step).
- **Progress bar spans the pre-auth Introduction only, not the whole journey —
  a deliberate deviation from §1.2.** Rationale: (1) it's stable as Act 2/3 grow
  in later phases (a whole-journey ratio would shift the intro's fill every
  phase); (2) filling the bar and *then* signing up is the exact Duolingo
  "save your progress" beat, landing right at the hinge; (3) it sidesteps a
  transitional inconsistency — the retained `07` post-auth screens still use the
  old dot scaffold this phase, so a shared cross-act bar would have had nothing
  to attach to on those screens. Post-auth screens get their own progress
  treatment when they move onto `OnboardingScreen` in Phase 2. `INTRO_STEPS` is
  therefore its own list in `lib/onboarding.js`, separate from the post-auth
  `STEPS`.
- **The gate stays disjoint-by-session** (07's flicker-fix invariant preserved).
  `RootNavigator` now makes a two-way signed-out choice — `getIntroSeen()` (async,
  read into state; the redirect waits while it's `null` so nothing flashes the
  wrong screen) picks intro-opener vs sign-in — and sets `introSeen` whenever a
  session appears (covers sign-in, sign-up, and restored sessions in one place).
  `OnboardingGate` is unchanged except its post-auth resume target moved from
  `/onboarding/welcome` to `/onboarding/account`.
- **`STEPS` trimmed**: `welcome` removed (the intro replaces it) and `detect`
  removed (auto-detect cut from onboarding). The `isSupported` import from
  `lib/detect` went with it. `app/onboarding/welcome.js` and `detect.js` are left
  orphaned (unreachable routes) — flagged for deletion in Phase 3 cleanup rather
  than removed mid-phase.
- **Shared infra built**: `components/OnboardingScreen.js` (light/brand/ink
  scaffold + thin progress bar + hero/footer, all `theme/tokens.js`),
  `components/OnboardingReveal.js` (staggered landing-page entrance, reduce-motion
  aware — mirrors `Confetti`'s guard, inverted so revealed content still
  appears), `components/CountUp.js` (rAF count-up, reduce-motion → final value),
  `components/OnboardingChoice.js` (`ChoiceList`, the one shared MCQ card list for
  age/income/goal/leak/habit so the five never drift).
- **"2 minutes a day" decoration**: rendered as a nested `<Text>` with
  `colors.income` on a `colors.incomeBg` background — a marker highlight, no
  underline, no link affordance. Only Manrope is loaded; a true second typeface
  would be a font-loader change (flagged in Out of Scope), not faked.
- **Reflection holds its reveal until the draft loads** (`loaded` flag) so the
  entrance — whose stagger timing depends on the card count — runs exactly once
  instead of re-triggering when the answers land a tick after mount.
- **Not verified on device** (no Android SDK/device here, same as every prior
  feature). What's verified: the migration live, the whole thing bundling clean,
  and every draft/route/token reference read against real source. The runtime
  behaviour of the inverted gate — especially the async `introSeen` read and the
  fresh-install → opener path — is the first thing to exercise on device, after
  `npx expo start -c` (standing rule: a new route *directory*, `intro/`, needs a
  cache-clear or the tree won't include it and `router.replace` silently no-ops).

### Post-Phase-1 Polish Round (2026-07-14, before Phase 2)

User feedback after reading through the built screens. All addressed:

- **`OnboardingReveal` switched from `withTiming`/linear-ish easing to
  `withSpring`** (`damping:15, stiffness:160, mass:0.7`), plus a scale
  (0.92→1) added alongside the existing translateY/opacity. A fixed-duration
  ease reads as mechanical once several items stagger in sequence; a spring's
  slight overshoot-then-settle is what actually reads as "smooth" / "popping"
  rather than a slideshow advancing one frame at a time. Stagger tightened
  70ms→was 90ms for a snappier feel.
- **Screen-to-screen transition**: `app/onboarding/_layout.js`'s `Stack` gained
  `animation: 'fade'`. The native-stack default (a slide/push) was competing
  visually with each screen's own content-entrance animation; a cross-fade
  underneath the reveal reads as one continuous motion instead of two.
- **`OnboardingScreen` gained a `subtitleEmphasis` prop** — the problem screen
  (2) pairs a question (title) with its answer (subtitle), and the answer was
  reading as fine print under the question rather than completing it.
  `subtitleEmphasis` renders the subtitle at `fontSize.display` (22, was `lg`
  15), bold, in the title's own color instead of muted. Opt-in per screen
  (only `problem.js` uses it) rather than a global subtitle-size change, since
  every other screen's subtitle is genuinely secondary copy.
- **Opener (1)**: emoji removed ("Hey." not "Hey 👋"); hero text bumped from
  `fontSize.amountXl` (56, the largest existing token) to an explicit `72` —
  intentionally past the token scale's top, since this is the flow's one
  loudest word and the design brief calls for it to dominate the screen.
  Documented inline as a deliberate one-off, not a drive-by magic number.
- **Stat screen (7) rewritten to be speculative, not a flat prediction** — "You
  will make 320 payments" became "You're likely to make close to 320+ small
  payments," and every age-variant line was reworded with hedge language
  ("tend to," "usually," "typically") instead of declarative statements. It's a
  study estimate about people in general, not a claim about this specific
  user.
- **Grammar/copy pass, em dashes removed from all visible text**: opener's
  subtitle, the name screen's title ("First — what should we call you?" →
  "First, what should we call you?"), the stat screen's age-copy and citation
  line, and one reflection card (`habit.never`) all had em dashes rewritten as
  two sentences or a comma. Grepped the whole `intro/` directory afterward —
  every remaining `—` is inside a `//` code comment (not user-facing), matching
  this codebase's own established comment style elsewhere.
- `npx expo export --platform android` re-verified clean (7.89 MB) after all of
  the above.

---

## Phase 2 — The Hinge + Climax (Act 2) ✅ Complete

### Goal

Sign-up carries the drafted name into `profiles.full_name`. The durable answers
flush to `profiles.onboarding_answers`. The user names their account, logs their
first real transaction (the hook — the existing day-0 streak celebration fires),
then sees a **real budget built from their leak answer** (sized by their income
band) and picks a **report cadence** — both genuinely configured, so the
reflection screen's promise is now true. The account/expense/reminders screens
are restyled onto `OnboardingScreen`, logic intact.

### Before Starting — Confirm Phase 1 is Approved

1. **`app/sign-in.js`** — the `supabase.auth.signUp` call; confirm whether it
   passes `options: { data: { full_name } }`. This phase makes it read
   `getDraft().name` and pass it so `handle_new_user` writes `full_name`.
2. **`components/AddBudgetSheet.js`** — the insert payload (verified 2026-07-14):
   `{ name, amount, period_type, category_id }` + `account_id: activeAccountId`,
   via `supabase.from('budgets').insert(...)` then `notifyChanged()`. The budget
   step mirrors this exactly (calendar_month, so no `start_date`/`end_date`).
3. **`useCategories()`** — how to resolve the default category id from a name
   (leak answer → category). Categories are **global** (not account-scoped) and
   seeded by `handle_new_user`: Food / Travel / Shopping / Bills / Coffee /
   Groceries / Other (expense). Confirm the session-dependency-fixed version.
4. **`lib/reports.js`** — `getReportSettings`/`setReportSettings` (cadence
   `off`/`weekly`/`monthly`, `weekday` 0=Sun JS convention, `dayOfMonth`, `hour`,
   `minute`). The cadence screen writes only `{ cadence, ... }`.
5. **`app/onboarding/expense.js`** — confirm the first-transaction insert still
   fires `notifyChanged()` (that's what makes the streak celebration fire).
   Confirm `StreakCelebration` still triggers for a new account (`07` fix #10
   user-scoped the celebration key — verify it's intact).
6. **`app/onboarding/account.js` / `reminders.js`** — current structure, so the
   restyle preserves the account UPDATE-not-INSERT rule and the persist-then-
   `rescheduleAll` ordering.

### 2.1 Database

No schema change. Phase 1's `onboarding_answers` column is written here for the
first time.

### 2.2 Data Layer

**Name via signup metadata** (`app/sign-in.js`): on sign-up, read
`getDraft().name` and pass `options: { data: { full_name: name } }` to
`signUp`. `handle_new_user` already writes `raw_user_meta_data->>'full_name'`
into `profiles.full_name` — so the drafted name arrives with zero extra writes.
If the user reached sign-up without the intro (returning-user path), the draft is
empty and nothing changes.

**The flush** — `flushOnboardingDraft()` in `lib/onboarding.js` (or
`onboardingDraft.js`): reads the draft, writes the **whitelisted** durable keys to
`profiles.onboarding_answers` via `useProfile().updateProfile({ onboarding_answers })`
(which calls `notifyChanged()`), and leaves the draft in place (the budget step
still needs `income_band`; `clearDraft()` runs at `finish()` in Phase 3).
- **Whitelist**: `age_range, goal, leak_category, tracking_habit, commitment`.
  `income_band` and `name` are **not** written here (name already went via
  metadata; income is never persisted).
- **Where it runs**: once, on entry to Act 2 — mount of `account.js` — guarded so
  it writes only when a draft exists and `onboarding_answers` is still null.
  `commitment` isn't collected until Phase 3's screen 22; until then it's simply
  absent from the object (a later `updateProfile` merge adds it — see Phase 3).

**Budget from the answer** (`budget.js`, inline insert mirroring `AddBudgetSheet`):

```js
// leak_category → default category name → id (categories are global)
const LEAK_TO_CATEGORY = {
  food:          'Food',
  shopping:      'Shopping',
  subscriptions: 'Bills',   // no "Subscriptions" default category — Bills is the closest
  // 'dont_know' → no budget created (see below)
};

// income_band → a suggested monthly cap for the leak category (a documented
// heuristic, not a stored number). Rounded, calendar_month.
const BAND_TO_BUDGET = {
  'lt_30k':   2000,
  '30_75k':   5000,
  '75_150k':  9000,
  'gt_150k':  15000,
};

await supabase.from('budgets').insert({
  name: `${categoryName} budget`,
  amount: BAND_TO_BUDGET[income_band] ?? 5000,
  period_type: 'calendar_month',
  category_id: resolvedCategoryId,
  account_id: activeAccountId,
});
notifyChanged();
```

- **"I don't know" (`dont_know`)** → create **no** budget; show the gentle variant
  ("We'll help you find it — here's where we'll start looking") and continue. Do
  not invent a budget the answer didn't ask for.
- Insert **once** — guard against re-creating on a screen revisit (e.g. a
  `created` flag in local state / the draft), since Act 2 steps `router.replace`
  forward but a back-gesture or re-mount must not double-insert.

**Reports cadence** (`reports.js`): `await setReportSettings({ cadence })` where
cadence ∈ `weekly` (defaults `weekday:1` Mon, `hour:9`), `monthly` (`dayOfMonth:1`,
`hour:9`), `off`. Nothing else. **No preview graph card** (revision note — the
design's black graph card is removed).

### 2.3 Components

```
app/onboarding/
  account.js    restyled onto OnboardingScreen (logic unchanged: UPDATE the default account)
  expense.js    restyled onto OnboardingScreen (logic unchanged: insert → notifyChanged → streak fires)
  budget.js     NEW — the receipt (real budget from leak + income)
  reports.js    NEW — cadence MCQ (weekly / monthly / I'll check it myself), NO graph card
  reminders.js  restyled; default nudge state + framing driven by tracking_habit
```

- **`budget.js`** — "You said **{leak}** was the leak" (deep-lime emphasis), a
  live budget card (reuse the Budgets-tab card styling / `ProgressBar`) reading
  "already on your Budgets tab", primary "Nice". The `dont_know` variant shows no
  card. Reveal-animated.
- **`reports.js`** — 3 MCQ cards matching the other question screens' card style,
  each with subcopy (Weekly → "A recap of your week"; Monthly → "The big picture,
  first of each month"; Off → "No schedule — open it anytime from the menu").
  Selected state + reveal. Writes `setReportSettings`.
- **`reminders.js`** — retain the existing bill + nightly-nudge logic and the
  persist-then-`rescheduleAll` ordering; drive the nudge's default on/off + the
  framing line from `tracking_habit` (e.g. `never` → nudge on, framed as the fix;
  `daily` → on, framed as "keep it up"). Restyle onto `OnboardingScreen`.
- **`account.js`** — retain the UPDATE-not-INSERT rule and `CATEGORY_COLORS`
  swatches; restyle only.
- **Day-0 streak (screen 16)** — **retain the existing `StreakCelebration` UI**.
  It fires off the expense insert's `notifyChanged()`; verify it still appears for
  a fresh account (the user-scoped key fix, `07` #10) and reads well between the
  expense and budget screens. No new component.

### 2.4 Navigation / Integration

Register `account`, `expense`, `budget`, `reports`, `reminders` as Act-2 steps in
the registry (they mostly already exist; `budget`/`reports` are new routes — same
`expo start -c` caveat). Order: `account → expense → budget → reports → reminders
→ (Act 3, Phase 3 / for now → done)`. Until Phase 3 lands, `reminders`'s next is
the existing `07` `done.js`.

### 2.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `app/sign-in.js` | Reads drafted name → signup `user_metadata` | Empty draft (returning user) must be a no-op |
| `profiles.onboarding_answers` | First writes here (the flush) | Whitelist only; never write `income_band`; guard against overwriting a set value |
| `budgets` | +1 real row from onboarding | Mirror `AddBudgetSheet` shape exactly; insert once; `dont_know` inserts nothing |
| `lib/reports.js` | New caller of `setReportSettings` | Cadence values only; no schedule wiring here (that's `11`'s Phase 2, already built) |
| `StreakCelebration` | Must still fire post-expense | Verify the user-scoped key from `07` #10 is intact |
| `AddTransactionSheet` | None | Do not refactor to share with the composer (`07` already has two impls; a third → extract, but not here) |

### 2.6 What This Phase Does NOT Include

- Conclusion screens, Koban tone, `clearDraft()`, replay (Phase 3).
- A user-editable budget amount in the flow (the heuristic is fixed; they can
  edit it later on the Budgets tab).
- Re-scheduling report notifications differently — `11`'s existing schedule wiring
  already reacts to `setReportSettings` via `persistReportSettings`/`sync`.

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] Sign-up passes the drafted name as `user_metadata.full_name`;
      `profiles.full_name` is set for a user who came through the intro; empty
      draft is a clean no-op *(the drafted-name row is hidden entirely when no
      draft exists — falls back to the original first/last name fields)*
- [x] The flush writes only the whitelisted keys to `onboarding_answers`;
      `income_band` and `name` are never written there; a re-mount doesn't
      clobber an already-set value *(`account.js` guards on `profile.onboarding_answers`
      already being non-null before writing)*
- [x] Budget step creates one real `calendar_month` budget in the mapped category
      sized by the income band; `dont_know` creates none and shows the gentle
      variant; no double-insert on revisit *(`budgetCreated` draft flag guards
      the insert; category + amount are always re-derived deterministically
      from `leak_category`/`income_band`, never cached redundantly)*
- [x] The created budget appears on the Budgets tab with a correct current-period
      `spent`/`remaining` from `v_budgets_with_spent` *(insert shape verified
      byte-for-byte against `AddBudgetSheet`'s payload; `v_budgets_with_spent`
      computes `spent` the same way for any budget regardless of how it was
      created)*
- [x] Reports step writes the chosen cadence via `setReportSettings`; **no graph
      card** is present *(three plain `ChoiceList` cards, matching the other
      question screens — no chart/preview element at all)*
- [x] The day-0 streak celebration still fires after the first transaction for a
      brand-new account *(untouched — `StreakCelebration` is a globally-mounted,
      user-scoped listener on `notifyChanged()`; `expense.js`'s insert path and
      its `notifyChanged()` call are unchanged from `07`)*
- [x] account/expense/reminders are restyled onto `OnboardingScreen` with logic
      unchanged (account UPDATEs, reminders keeps persist-then-reschedule)
- [x] `npx expo export --platform android` bundles clean (7.9 MB, no errors)
- [ ] **On device**: full sign-up → account → transaction (streak fires) → budget
      created → cadence set → reminders; Home/Budgets reflect the real budget;
      Settings → Reports shows the chosen cadence

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes (2026-07-14)

- **The hinge reuses `app/sign-in.js` rather than a new screen**, exactly as
  scoped — but it now reads the drafted name (`getDraft().name`) on mount and,
  when present, **hides** the first/last-name fields entirely in favor of a
  single "Signing up as {name}" row, with the title switching to "Save your
  progress, {name}." This is the honesty-contract payoff for the name question:
  a user who already told the intro their name is never asked again. A user who
  reaches sign-up with no draft (e.g. testing sign-up directly) gets the
  original two-field form, unchanged. Arriving from the intro's reflection
  screen now passes `?mode=signup` (`useLocalSearchParams`) so the screen opens
  straight into sign-up instead of defaulting to sign-in.
- **The flush lives in `account.js`'s mount effect**, per the plan — guarded on
  `profile.onboarding_answers` still being null, so Settings' future "Replay
  onboarding" (Phase 3 retarget) can re-enter here without clobbering answers
  already captured on a first run.
- **The budget step never persists redundant state.** Rather than caching the
  created budget's name/amount separately (as the doc's SQL sketch implied), it
  re-derives both deterministically from `leak_category` + `income_band` every
  time — both still live in the draft until Phase 3's `finish()` clears it. Only
  a `budgetCreated` boolean guards against a double insert. Simpler than
  planned, same guarantee.
- **Budget category mapping resolved against the live seed data**: `food` →
  "Food", `shopping` → "Shopping", `subscriptions` → "Bills" (no dedicated
  "Subscriptions" default category exists — confirmed against `handle_new_user`'s
  actual seed list read during planning). If a category is unexpectedly missing
  (defensive only — shouldn't happen against the real seed set), the screen
  falls back to the "we'll help you find it" variant rather than erroring.
- **Reports screen has no live preview**, per the revision note — just the three
  cadence cards. `getReportSettings()` seeds the initial selection so revisiting
  (in principle) reflects whatever's already configured, matching every other
  intro/Act-2 screen's "prefill from existing state" pattern.
- **`app/onboarding/welcome.js` and `detect.js` remain orphaned** (unreachable —
  no route in `STEPS` or `INTRO_STEPS` points to them). Left in place rather
  than deleted mid-phase, per the Phase 1 note; both are flagged for Phase 3
  cleanup, at which point `OnboardingScaffold`/`OnboardingProgress` also retire.
- **Not verified on device** (no Android SDK here, same constraint as every
  prior phase). What's verified: the bundle exporting clean, the security
  advisor showing no new finding (no schema change this phase), and every
  insert payload / hook shape read against live source before being used.

---

## Phase 3 — Conclusion (Act 3) + Honesty Wiring + Replay ✅ Complete

### Goal

Close the flow: a short, punchy journey screen tied to their goal; a "it's all
free" screen (no Pro tier mentioned); a commitment MCQ (cards with emojis) that
genuinely sets Koban's nudge tone; and the new "you're all set" screen that
finishes onboarding. Wire the last two answers that still owe an effect
(commitment → Koban tone, goal → streak framing) so the honesty contract is
fully paid. Clear the draft on finish and update Settings' "Replay onboarding".

### Before Starting — Confirm Phase 2 is Approved

1. **`lib/koban.js`** — the copy engine (`pickRecap`, `buildReminderPlan`,
   nudge/recap pools). Confirm how nudge copy is selected and where a `tone`
   input could steer aggression without breaking the `05` recap-notification
   correctness rules (no per-schedule stored data; copy that quotes numbers must
   be generated at show time — see `07` #16). The tone read must be a pure
   copy-selection input, not stored derived data.
2. **`hooks/useProfile.js`** — `onboarding_answers` is already selected (it's
   `select('*')`-style) or needs adding; confirm koban's consumer can read
   `onboarding_answers.commitment`.
3. **`app/settings.js`** — the existing "Replay onboarding" row (`07` Phase 3):
   it nulls `onboarded_at` → gate redirects. Confirm its current target and row
   shape.
4. **`app/onboarding/done.js`** (old) + **`Confetti`/`PartyPopper`** — the
   celebration to carry into the new "you're all set" screen.
5. **`lib/onboarding.js` `finish()`** — unchanged since `07`; this phase adds
   `clearDraft()` to it.

### 3.1 Database

No schema change. `commitment` is merged into the existing
`onboarding_answers` via `updateProfile` (a jsonb merge on the client side — read
current, spread, write back).

### 3.2 Data Layer

- **`commitment.js`** merges `{ commitment }` into `onboarding_answers`
  (read-modify-write through `updateProfile`, since it's one jsonb column).
- **Koban tone** — `lib/koban.js` gains a `tone` selection input derived from
  `onboarding_answers.commitment` (`all_in` → more push / higher-energy pool;
  `will_try` → gentler, lower-pressure pool; `committed` → current default). This
  is **pure copy selection** — no new stored/scheduled data, and it must not
  reintroduce numbers into recap copy (`07` #16). If threading `commitment` into
  `buildReminderPlan` is more than a copy-pool switch, stop and raise it rather
  than expanding scope silently.
- **Goal → streak framing** — the streak explainer / eyebrow copy references the
  goal (`onboarding_answers.goal`) where it already has a natural slot (the
  reminders framing and/or the streak celebration eyebrow). Keep it a copy input,
  not a structural change to `05`'s surfaces.
- **`finish()`** now also calls `clearDraft()` after the `onboarded_at` write
  succeeds (the draft has served its purpose; income dies here).

### 3.3 Components

```
app/onboarding/
  journey.js     NEW (ink) — short + engaging, NOT a 3-beat timeline
  free.js        NEW (light) — "it's all free", NO Pro mention
  commitment.js  NEW (ink) — MCQ cards WITH emojis (not big buttons)
  done.js        REPLACED — the new "you're all set" screen (brand), confetti/popper
```

- **`journey.js`** — **short, punchy, no timeline, no where-you-are/where-you-go/
  how-3-beats** (that structure was context for understanding, not screen
  content, per revision note). One strong forward-looking statement tied to their
  goal (e.g. *"You're about to know exactly where every rupee goes, {name}."*),
  reveal-animated. Primary "Almost there".
- **`free.js`** — "And all of this? **Free.**" (deep-lime "Free"), reassurance, no
  card/trial. **Absolutely no mention of a Pro tier / future paid plan** (revision
  note overrides the design-prompt's foreshadow line — drop it entirely).
- **`commitment.js`** — "How committed are you?" as **MCQ cards, each with an
  emoji**, styled like the goal/leak/habit screens — **not** the design's big
  stacked buttons. Options e.g. 🔥 All in / 👍 Pretty committed / 🌱 I'll give it a
  shot. Writes `commitment` (→ Koban tone). Reveal-animated.
- **`done.js`** — the **new "you're all set" screen**: brand bg, "You're set,
  {name} 🎉", the retained `Confetti`/`PartyPopper`, primary "Go to my money" →
  `useOnboarding().finish()` (writes `onboarded_at`, clears draft; does **not**
  navigate — the gate moves the user, per `07` #14). Do not reintroduce imperative
  navigation here.

### 3.4 Navigation / Integration

- Register `journey`, `free`, `commitment` as Act-3 steps; `reminders`'s next
  becomes `journey`; `commitment`'s next is `done`. `done` stays the terminal
  non-step (`DONE_ROUTE`).
- **Settings → "Replay onboarding"** — replaying while signed in can't re-run the
  pre-auth intro (there's a session). Point replay at the **post-auth start**
  (`/onboarding/account`) by nulling `onboarded_at` (gate redirects) — the intro
  (Act 1) is for genuinely new, signed-out users only. Note this explicitly in
  the row's behaviour so it isn't "fixed" later to also replay the intro.
- **Retire the superseded `07` scaffold** (`OnboardingScaffold`,
  `OnboardingProgress`) once every screen imports `OnboardingScreen` and nothing
  references the old ones — grep to confirm zero importers before deleting.

### 3.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `lib/koban.js` | +`tone` copy-selection input from `commitment` | Pure copy selection; no stored/scheduled data; no numbers in recap copy (`07` #16) |
| `05` streak surfaces | Goal referenced in framing copy | Copy input only — no structural change |
| `profiles.onboarding_answers` | `commitment` merged in | Read-modify-write the jsonb (don't drop the P2 keys) |
| `app/settings.js` | "Replay onboarding" targets post-auth start | Don't try to replay the pre-auth intro while signed in |
| `useOnboarding().finish` | +`clearDraft()` | Only after the `onboarded_at` write succeeds |
| Old `OnboardingScaffold`/`Progress` | Deleted once unused | Grep for importers first |

### 3.6 What This Phase Does NOT Include

- Actually *sending* callback messages ("you said X weeks ago, here's where it
  went") — this phase only guarantees the **data** to power them
  (`onboarding_answers`) is stored and read. The callback surfaces themselves are
  a separate future feature (flagged as the idea doc's highest-leverage follow-on).
- A Pro tier / paywall / foreshadow of one (explicitly excluded from `free.js`).
- Re-running the pre-auth intro for an existing signed-in user.

### 3.7 Phase 3 Checklist — Before Marking Complete

- [x] Journey screen is short + engaging, references the goal, and has no
      timeline / 3-beat structure *(one forward-looking sentence, goal-tailored
      via `GOAL_PHRASE`, ink bg with the phrase in brand lime)*
- [x] Free screen makes no mention of a Pro tier or any future paid plan
      *(grepped the file — "Free", "subscription", "trial", "card" only)*
- [x] Commitment screen shows MCQ cards **with emojis** (not big buttons) and
      writes `commitment`; `onboarding_answers` retains the Phase-2 keys after the
      merge *(read-modify-write: `{...profile.onboarding_answers, commitment}`,
      never a bare overwrite)*
- [x] Koban's nudge tone visibly differs by `commitment` *(verified by reading
      the selected pool for each value — `all_in`/`will_try` draw from
      `TONE_NUDGE_POOLS`, everything else including a missing/legacy profile
      falls through to the original, byte-for-byte-unchanged `NUDGE_POOLS`)*;
      no numbers leak into recap copy *(recap functions untouched this phase —
      tone wiring is scoped to `pickNudge`/`buildReminderPlan` only)*
- [x] The new "you're all set" screen fires confetti/popper once, calls
      `finish()`, does not navigate imperatively, and the gate takes the user to
      Home
- [x] `finish()` clears the draft (income and all) after the `onboarded_at` write
- [x] Settings → "Replay onboarding" re-enters at the post-auth start, not the
      pre-auth intro *(needed no code change — Phase 1's gate retarget to
      `/onboarding/account` already covers it; confirmed the row's copy has no
      stale reference)*
- [x] Old `OnboardingScaffold`/`OnboardingProgress` deleted with zero remaining
      importers (grep-confirmed — only comments in `lib/onboarding.js` and
      `components/OnboardingScreen.js` mentioned the names, both reworded)
- [x] `npx expo export --platform android` bundles clean (7.9 MB, no errors)
- [ ] **On device**: full flow end-to-end (fresh install → intro → sign-up →
      account → transaction → budget → cadence → reminders → journey → free →
      commitment → all-set → Home); replay from Settings works; a `will_try` vs
      `all_in` user gets visibly different nudge copy

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes (2026-07-14)

- **Koban tone wiring, scoped tighter than the doc's sketch, deliberately.**
  `toneFromCommitment()` + `TONE_NUDGE_POOLS` in `lib/koban.js` only override
  the tiers where pressure genuinely varies: `at_risk` and the three `silent_*`
  gap tiers. `never_started` and `silent_1` stay tone-invariant — there's
  nothing to push harder on for a user who hasn't begun, and a same-day
  check-in is already the gentlest register that pool has. The recap functions
  (`pickRecap`/`pickRecapNotification`, the celebration screen and its
  notification) are **untouched** — tone only reaches `pickNudge` and
  `buildReminderPlan` (both gained an optional `tone` param defaulting to
  `'default'`, so every existing caller is byte-for-byte unchanged). This
  satisfies the doc's own caution ("if threading commitment is more than a
  copy-pool switch, stop and raise it") by keeping it exactly that: a pool
  switch, nothing structural.
- **Goal → streak framing scoped to the journey screen only**, not threaded
  into `StreakCelebration`'s eyebrow/recap copy. The doc flagged the streak
  celebration as one *candidate* natural slot alongside the journey screen;
  reaching into `05-koban-engagement.md`'s already on-device-tested recap
  system for a cosmetic copy tweak risked exactly the kind of scope creep the
  doc warns against elsewhere ("keep it a copy input, not a structural change
  to 05's surfaces"). The journey screen alone fully pays off the honesty
  contract's "frames... the journey screen" line for the goal answer.
- **`lib/notifications.js` gained `fetchCommitmentTone(userId)`**, mirroring
  `fetchStreak`'s own null-userId guard exactly (`hooks/useStreak.js`) — a
  small, additive Supabase read alongside the existing streak fetch in
  `doRescheduleAll`, feeding `buildReminderPlan`'s new `tone` param.
- **Cleanup executed as scoped**: `app/onboarding/welcome.js` and `detect.js`
  (unreachable since Phase 1's `STEPS` trim) deleted, then
  `components/OnboardingScaffold.js`/`OnboardingProgress.js` deleted once a
  repo-wide grep confirmed zero remaining importers. `lib/detect.js` (the
  actual detection *logic* module, still used by `app/settings.js`'s
  Transaction Detection card) was **not** touched — only the onboarding *step
  screen* was in scope here.
- **The all-set screen (`done.js`) rebuilt on `OnboardingScreen`** (brand bg,
  no progress bar — it's a hero, not a stage of setup), keeping the exact
  Confetti-after-not-before render order from `07`'s fix #3 (its
  `SafeAreaView` is opaque; Confetti rendered first would again paint hidden
  underneath it). `finish()` still does not navigate — the gate owns the exit,
  per `07` fix #14; re-adding a `router.replace` here would reopen that bug.
- **Settings' "Replay onboarding" needed zero code changes** — it already nulls
  `onboarded_at`, and Phase 1's gate already resolves a null flag to
  `/onboarding/account` (the post-auth start), not the old `/onboarding/welcome`.
  The doc anticipated this as a Phase 3 task; it was actually already done.
- **Not verified on device** (no Android SDK here, same constraint as every
  prior phase in this feature and nearly every feature in this codebase). What
  IS verified: the bundle exporting clean after every addition/deletion, the
  security advisor showing no new finding, every insert/merge payload read
  against live source, and the tone-selection logic traced by hand for every
  `(tier, tone)` combination it can reach.

### Post-Phase-3 Polish Round (2026-07-14) — no dark background anywhere, font sizes matched to the design mock

User feedback after reviewing the built flow, checked against
`claude-design/FLO Expense Tracker Design/FLO App.dc.html` directly:

- **`ink` (dark/black) background removed from `OnboardingScreen` entirely** —
  not just unused, deleted from the `PALETTES` map so it can't be
  reintroduced by accident. Three screens used it (`stat.js`, `journey.js`,
  `commitment.js`); the design mock itself specifies dark for the equivalent
  screens, but the user's explicit call overrides the mock here. Reassigned:
  `stat` → `light` (the big number carries the drama instead, in deep lime, at
  a near-design-matching 100px — was `fontSize.amountXl`/56); `journey` →
  `light` (emphasis word recolored from raw `brand` — invisible as text
  outside a dark screen — to `income`); `commitment` → `brand` (pairs with
  the other MCQ screens' white `ChoiceList` cards popping against a colored
  fill, the same visual move `reflection.js` already makes in reverse).
- **`OnboardingScreen` gained a `titleSize` prop** — an optional numeric
  override (scaling `lineHeight` proportionally) for hero-statement screens
  where the default question-sized title (`fontSize.hero`, 30) reads small for
  a single big declarative sentence. Applied to `ready.js` (38), `journey.js`
  (34), `commitment.js` (32), `done.js` (52).
- **`opener.js`'s "Hey." bumped from 72 to 100** (design mock: 104) — the
  flow's one loudest word, now near-matching the mock instead of just "bigger
  than before."
- **`free.js` rebuilt to match the mock's actual two-line hierarchy** — "And
  all of this?" at 34px followed by a much bigger standalone "Free." at 76px
  (was one line with an inline colored word at the default 30px title size).
  Rendered via `children`, not `title`, since a single wrapping `<Text>` can't
  carry two different font sizes on two lines — `children` renders inside a
  plain `View`, so two independently-styled `<Text>` siblings work. The
  no-Pro-tier override from the prior round stands; only the mock's sizing was
  adopted, not its paywall-foreshadow copy.
- **`done.js` rebuilt to match the mock**: a stacked two-line 52px headline
  ("You're set,\n{name}.", using `titleSize` + a literal `\n` — same size on
  both lines, so no `children`-splitting was needed here unlike `free.js`),
  and **`PartyPopper` removed entirely** — it was never part of the design
  (which specifies only a confetti burst + a shimmer sweep), and the user
  flagged the screen as "different from the design" specifically because of
  it. `Confetti` is retained, same render-order-after-not-before rule as
  always (`07` fix #3).
- `npx expo export --platform android` re-verified clean (7.9 MB) after all of
  the above.

### Post-Phase-3 Polish Round 2 (2026-07-15) — matched against `claude-design/.../screen-design-changes/`, opener clipping fix

User supplied five updated reference screenshots
(`Screen2.png`/`Screen3.png`/`Screen7.png`/`Screen11.png`/`Screen19.png`,
matched by content to `problem`/`solution`/`ready`/`reflection`/`journey`
respectively — filenames don't correspond to this doc's own screen numbering).

- **Opener's "Hey." was visibly clipped at the bottom** — the explicit
  `lineHeight: 96` was *smaller* than `fontSize: 100`, cutting off the
  descender on "y". `lineHeight` must exceed `fontSize` for a custom size this
  far outside the token scale; fixed to `118`.
- **Uniform `titleSize={32}`** now applied to every "text + subtitle only"
  hero screen in the intro — `problem`, `solution`, `ready`, `journey` — replacing
  each screen's previously-independent size (default 30, custom 38, custom 34).
  `OnboardingScreen`'s `subtitleEmphasis` style also recalibrated down (was
  `fontSize.display`/22/bold, now 18/semibold) to match the design's visibly
  smaller, less-heavy secondary line.
- **`problem.js`, `solution.js`, `ready.js`** rewritten to match the new
  screenshots' exact partial-color title treatment (some words ink, the
  turn/emphasis phrase in deep lime) instead of a single flat-colored
  subtitle or bespoke headline. `solution.js` moved its marker-highlighted
  headline from a bespoke `children` block into the `title` prop specifically
  so it could share the uniform `titleSize` — this is now the pattern for any
  future screen needing inline color runs in its title.
- **`ready.js` rewritten with new copy and moved off the brand-lime hero to
  light** — the old "Got 2 minutes a day to never wonder again?" repeated
  screen 3's "2 minutes a day" almost verbatim; replaced with "The **2
  minutes** that you're gonna spend a day is gonna *change how you see
  money*." (marker-highlight on "2 minutes", plain deep-lime color on the
  closing phrase), matching the new reference design's background and copy.
- **`journey.js`**: `titleSize` brought down from 34 to the shared 32;
  subtitle copy changed to "Just a couple more steps and you're in." to match
  the reference screenshot exactly.
- **`reflection.js`**: each card's Lucide icon (never actually built — the
  original implementation had no icon at all, just title/body) becomes an
  **emoji**, and deliberately reuses the *exact same* emoji already chosen for
  that answer on its own question screen (`goal.js`/`leak.js`/`habit.js`) —
  one emoji vocabulary per answer, not a second one invented for this screen.
  Cards gained an **alternating ±1° rotation** (index-even tilts left,
  index-odd tilts right) so the stack reads as a loose fanned pile rather than
  three identical aligned rectangles. Title/subtitle copy changed to "We heard
  you, {name}!" / "You're in the right place. Now, let's make it real." to
  match the reference design.
- **`commitment.js` reverted from `bg="brand"` back to `bg="light"`** — the
  prior round's brand-bg decision is superseded; the user wants it visually
  identical in weight to the other MCQ screens (goal/leak/habit), so the
  `titleSize` override was also dropped (back to the shared default). Title
  copy changed to **"One last question: how committed are you?"** — an
  explicit signal that this is the final question of onboarding, not just
  another unlabelled one in the middle of the flow.
- `npx expo export --platform android` re-verified clean (7.9 MB).

### Post-Phase-3 Polish Round 4 (2026-07-15) — the size bump was scoped too broadly

Round 3's default-title enlargement (30→34) applied globally, which
inadvertently enlarged every **question page** (age/income/goal/leak/habit/
commitment — all MCQ/`ChoiceList` screens — plus `name.js`) along with the
intended standalone hero screens. The user's actual ask was narrower: only the
standalone "title + subtitle only, no body content" screens
(problem/solution/ready/journey) should be big; question pages should stay at
the original, smaller, question-appropriate size.

- **`OnboardingScreen`'s default `title` style reverted to `fontSize.hero`
  (30)**, `lineHeight` set to 38 (still a safe ≥1.25× ratio, just scaled to the
  smaller size) — this is now the size for every question page.
  Problem/solution/ready/journey are unaffected, since they already opt into
  the bigger size explicitly via `titleSize={36}` — the enlargement was always
  meant to be scoped that way, and now actually is.
- **`goal.js`'s question softened**: "What do you want from this?" → **"What
  would feel like a win for you?"** — warmer and more personal, and it still
  reads naturally into all four existing answers (see where it goes / stop
  overspending / save for something / feel in control).
- `npx expo export --platform android` re-verified clean (7.9 MB).

### Post-Phase-3 Polish Round 6 (2026-07-15) — the arrow-flow watermark

User leveled up the real logo (a two-arrow "flow" mark — one arrow up-right,
one down-right, representing money in/out) and asked for the same shape,
horizontal (0°), at 10% brand-lime opacity, to fill the genuinely empty
space on the four "text + subtitle only" hero screens, alternating top/bottom,
tilted so its implied motion leads into the title from whichever edge it's on.

- **`assets/LogoVector.svg`** — the raw vector, provided by the user: a single
  path, 683×370 viewBox, horizontal, exported with a close-but-not-exact fill
  (`#B3DC00` vs. the token `colors.brand` = `#BBDC12`).
- **`components/OnboardingArrowMotif.js`** (new) — mirrors the vector inline
  (same reasoning as `components/Logo.js`: no Metro SVG-file-loader
  configured, so a `.svg` can't be `import`ed directly), recolored to the
  exact `colors.brand` token rather than the export's approximate hex.
  Rotation is computed in code, not pre-baked into two assets — `-165°` and
  `15°` are the same tilt 180° apart (a straight point-flip), so
  `position="top"` → `15deg`, `position="bottom"` → `195deg`
  (≡ `-165deg`). Oversized (1.3× screen width) and edge-bled (negative
  top/bottom offset) so it reads as part of a larger pattern continuing past
  the frame, not a sticker placed on the screen. `pointerEvents="none"`, 10%
  opacity by default (both tunable via props).
- **`OnboardingScreen` gained an `arrowMotif` prop** (`'top'|'bottom'`,
  omit for none) — renders the motif as the first child inside the
  `SafeAreaView` (so it sits behind the progress bar and content in render
  order) when set.
- **Wired into all four hero screens**, alternating, matching the reference
  screenshots exactly: `problem` → top, `solution` → bottom, `ready` → top,
  `journey` → bottom. No other screens (question/MCQ pages, the brand-hero
  screens) got it — deliberately scoped to just these four, per the
  discussion that overusing it would turn a deliberate touch into wallpaper.
- `npx expo export --platform android` re-verified clean (7.9 MB).
- **Not yet verified on device** — the exact visual read (does the flip
  genuinely look like "pointing into the text" vs. away from it, does the
  status-bar-area bleed look right) needs an on-device look before calling
  this final; the angle/opacity/edge-offset are all cheap to retune in code
  if not.

**Correction, same day**: the first pass got the actual layout wrong. The
motif rendered as a pure decorative overlay while the title/subtitle stayed
vertically centred across the whole screen, unchanged from every other
screen — a plain watermark-behind-centred-text, not the top/bottom SPLIT
that was actually asked for (vector owns one half, text owns the other,
reversed per screen). Root cause: treating "fill the empty space" as "add a
faint background layer" without re-checking that the original reference
screenshots show the title clearly living in the *opposite* half from the
vector, not centred through it.

Fixed by deriving the content's vertical alignment directly from the
`arrowMotif` prop in `OnboardingScreen.js`: `arrowMotif="top"` sets
`justifyContent: 'flex-end'` (text pushed into the lower half),
`arrowMotif="bottom"` sets `'flex-start'` (text pushed into the upper half),
no motif keeps the existing `'center'`. Applies to both the static and
`scrollable` content paths. No changes needed to the four screen files
themselves — the split falls out automatically from the same `arrowMotif`
prop they already pass.

**Second correction, same day**: two more real problems, both from the same
"look at the reference images that were already provided" miss.

- **The motif was scaled far too large** (1.3× screen width) — big enough
  that the two-arrow shape cropped into an unrecognizable zigzag rather than
  reading as the actual logo mark. Reduced to **0.85× screen width**
  (still bleeds slightly past the edges, but the whole two-arrow shape stays
  legible), and the edge offset shrunk proportionally (0.22× → 0.12× of the
  now-smaller motif height).
- **`justifyContent: 'flex-end'`/`'flex-start'` pushed text flush against the
  footer/progress-bar edge** — not what "somewhere between centre and the
  edge" means. Replaced with **asymmetric flex spacers** around the content
  (`[1.6, 0.7]` for text-toward-bottom, `[0.7, 1.6]` for text-toward-top,
  `[1, 1]` — exactly centred — with no motif), giving the text real breathing
  room on both sides instead of butting against one edge.
- **Bottom rotation literal changed from `195deg` to `-165deg`** — both
  produce an identical transform matrix (195 = -165 + 360), so this is a
  readability fix only: the code now says the exact number the user asked
  for, rather than its mathematically-equivalent but less obviously-matching
  twin.
- `npx expo export --platform android` re-verified clean (7.9 MB).

### Post-Phase-3 Addition (2026-07-15) — gender question + gender-tailored empowerment on the stat screen

User wanted to capture gender and hit the user with an empowering, gender-specific
money note. Decided against a SECOND big-number stat screen (two number screens
close together = stat fatigue / preachy). Instead:

- **New `app/onboarding/intro/gender.js`** — an MCQ (Male / Female / Transgender /
  Prefer not to say), inserted in the intro registry right after `age`
  (identity cluster: name → age → gender → income). No emojis (gendered emoji
  read clinical / risk mis-rendering). Intro is now 13 screens.
- **Used in-session only, NEVER persisted** — same precedent as income
  (`pickDurableAnswers` does not include it), and consistent with the "we don't
  store this" reassurance. A sensitive attribute used once shouldn't be stored.
  The gender screen says so explicitly ("We don't store this").
- **One stat screen, gender drives an empowering titled CALLOUT, not a second
  number.** `stat.js`'s big number stays age-based; when a gender was given, a
  distinct pale-lime callout card appears below the spending stat with its own
  eyebrow label (male "Good to know", female "Did you know", trans "A note for
  you" — a per-line label because a "fun fact" framing fits the female
  historical fact but reads wrong on the male insight / trans affirmation).
  Prefer-not-to-say / missing shows the neutral age line instead, no card. The
  citation sits above the card so it only ever scopes the number, never the
  (uncited, statement-not-stat) gender note. Screen made `scrollable` so the
  extra card can't clip on short screens.
- **The number is PER-DAY, not per-month** — reverted a monthly "300+" (read
  as exaggerated) back to the design mock's daily 7–14/age framing, which is
  believable. Still a flagged placeholder: NPCI publishes aggregate national
  UPI volume, not per-user-by-age daily counts, so a real figure needs a
  third-party study or a derived per-capita estimate — citation stays "to be
  confirmed" until then.
- **Copy, corrected from the user's drafts** (they asked for correction):
  - *Male*: their "we have a history of lavish spending, break the stereotype"
    was rejected — it shames spending (violates Koban's core voice rule) and
    restates the stereotype it claims to break. Reframed to the aspirational,
    non-shaming version: the quiet tracker wins, not the flashy earner/spender.
  - *Female*: kept the user's strong historical-agency angle almost intact,
    tightened, with the historical claim kept GENERAL (true across cultures,
    not a specific unverified year) and the "some homes still don't let women"
    beat softened to solidarity rather than finger-pointing at her own home.
  - *Transgender*: the user couldn't decide and asked me to. Chose warmth +
    agency + belonging, with **no statistic** (real trans-finance data is about
    hardship — the opposite of empowering, and a fabricated stat would break
    the honesty rule), no tokenizing, no politics — same register as the others.
  - These are empowering STATEMENTS, not fabricated numeric stats, so they
    carry no citation (the only hard number on the screen is still the
    age-based UPI count, source pending). This sidesteps the earlier-flagged
    "need a real verifiable per-gender stat" problem honestly.
- `npx expo export --platform android` clean (7.91 MB).

### Post-Phase-3 Bug Fixes (2026-07-15) — sign-in flash, subscriptions budget

- **Sign-in flashes for a split second before the intro opener** (on-device).
  `RootNavigator` already waited for `loading` before mounting `<Stack>`, but not
  for `introSeen` (the async AsyncStorage read deciding sign-in vs. the intro
  opener for a signed-out user) — so the Stack could paint its default/stale
  route for one frame before the redirect effect fired. Fixed with the same
  technique already used for `loading`: `if (!session && introSeen === null)
  return null;` — don't mount the Stack at all until the signed-out destination
  is actually known. Same class of bug as `07`'s original signed-in flicker fix,
  now closed for the signed-out half too.
- **Selecting "Subscriptions" as the leak created no budget.** The category
  mapping (`subscriptions → 'Bills'`) and the seeded "Bills" category were both
  confirmed correct directly against the live DB — the real bug was
  `budget.js`'s `budgetCreated` guard, a bare boolean not tied to *which*
  category it was created for. Testing one leak answer (e.g. "Food"), then
  going back and picking a different one (e.g. "Subscriptions") left the stale
  flag set, so the screen silently skipped the insert for the new category and
  displayed a fake "created" card with nothing behind it in the database.
  Fixed by keying the guard to the actual category name
  (`draft.budgetCreatedFor === categoryName`) instead of a bare flag — only
  skips the insert when it was created for *this exact* category; a changed
  leak answer now correctly creates a new budget for the new category.
- `npx expo export --platform android` clean (7.91 MB).

### Real stat wired in (2026-07-15) — the last flagged placeholder, resolved

The age-based "N small payments a day" number was flagged as a placeholder from
Phase 1 onward and never actually sourceable — NPCI does not publish per-user,
per-age daily transaction counts. Researched via web search (npci.org.in's own
statistics page blocks automated fetches with a 403; used secondary reporting
of NPCI's own released figures instead):

- **Real number found**: 23.2 billion UPI transactions in India in May 2026
  (₹29.9 trillion) — NPCI's own reported figure via
  [ANI](https://www.aninews.in/news/business/upi-hits-new-high-in-may-2026-with-232-billion-transactions-worth-rs-299-trillion-npci-data-shows20260602155337/)
  / [IBEF](https://www.ibef.org/news/upi-transactions-soar-to-record-us-312-21-billion-in-may).
- **The honest per-user derivation was rejected**: 23.2B ÷ an estimated
  450–500M active UPI users ÷ days in the month lands around **1.5–3
  transactions per person per day** — nowhere near the invented 7–14/day (or
  the even-further-invented monthly "300+") placeholders that preceded this.
  Real, but too small to be the "aha," and any age-segmented split on top of
  that derived number would have been pure invention layered on an already-soft
  estimate.
  - **User's call**: given three honest framings (use the small real per-user
    average / lead with the national aggregate instead / drop the number
    entirely and stay qualitative), told me to "decide the dramatic one." Chose
    the **national-scale aggregate** — it's genuinely dramatic on its own,
    needs no shaky per-user division, and sidesteps the estimation-error
    problem entirely by not making a personal numeric claim.
- **`stat.js` rewritten**: the big number is now the real, shared (not
  age-varying) national figure — "23.2 Billion" UPI payments last month,
  cited to NPCI/May 2026 directly beneath it. The hook changed from a
  (fabricated) personal count to a personal QUESTION: *"How many of yours
  could you actually list from memory?"* — same emotional target (you don't
  actually track the small stuff), no numeric claim about the individual user
  at all. Age still tailors the qualitative line below (unchanged mechanism —
  it was never a numeric claim, so it never had a sourcing problem).
  `STAT_BY_AGE`/`FALLBACK` renamed to `AGE_LINE`/`FALLBACK_LINE` to reflect
  that it's line-only now; `NATIONAL_STAT` is the one shared number.
- **Not independently re-verified against the primary npci.org.in page** — that
  fetch was blocked (403, likely bot protection, not something fixable from
  here). The figure is NPCI's own data as reported by two secondary outlets;
  worth a manual spot-check against npci.org.in/product/upi/product-statistics
  from an actual browser before this ships, and worth refreshing periodically
  since UPI volume grows every month (this was the *most recent available*
  month at write time, not a fixed constant).
- `npx expo export --platform android` clean (7.91 MB).

### Screen cut (2026-07-15) — `ready.js` removed, felt like stalling

User's call: the "2-minute ask" screen ("The 2 minutes that you're gonna spend
a day is gonna change how you see money.") sat right after the stat screen with
no function of its own — it wasn't wired to anything (no draft write, purely a
commitment-tap beat) — and reads as an extra stall between the emotional stat
and the next real question. Cut entirely:

- Removed the `ready` entry from `INTRO_STEPS` in `lib/onboarding.js` — the
  registry-driven routing (`getIntroNext`/`getIntroPosition`) automatically
  renumbers and re-routes around the gap, exactly the design intent from
  Phase 1 ("a step added/removed renumbers everything automatically"). `stat`'s
  "Okay, that's a lot" button now goes straight to `goal`.
- Deleted the now-orphaned `app/onboarding/intro/ready.js`.
- Fixed `stat`'s registry `bg` label while in there — it said `'ink'`, stale
  since `stat.js` moved to a light background several polish rounds ago. Worth
  noting: `INTRO_STEPS`' `bg`/`progress` fields are reference metadata only,
  not read by any routing/rendering code (confirmed via grep) — only `.route`
  actually matters functionally, so a drifted label here is a documentation
  smell, not a live bug.
- Intro is now **12 screens** (was 13).
- `npx expo export --platform android` clean (7.91 MB).

### Post-onboarding follow-ups (2026-07-15) — reports default, reports anchored to signup, Home loading states

Three requests after the onboarding review, spanning onboarding, `11-reports.md`,
and the main app's Home screen:

- **Reports cadence now actually defaults to "Every week" in onboarding.**
  `app/onboarding/reports.js` initialized local state to `'weekly'` but then
  immediately overwrote it with `getReportSettings()`'s result — for a brand-new
  user that resolves to `DEFAULT_REPORT_SETTINGS.cadence` (`'off'`), silently
  clobbering the intended pre-selection a beat after mount. Removed that
  effect entirely — onboarding is inherently first-run, so there's nothing
  meaningful to read back yet; the user still picks explicitly before Continue.
- **Reports no longer fire immediately after signup.** `lib/reports.js`'s
  `reportDueMoment()` finds the most recent PAST occurrence of the configured
  schedule regardless of when the schedule was set — so a Wednesday signup
  choosing weekly reports would see "your report is ready" almost immediately
  (last Monday's boundary had already passed), covering a period with one
  onboarding transaction in it. Fixed by adding `cadenceStartedAt` to the
  settings object: `setReportSettings()` stamps it the first time cadence
  turns on (never overwritten while active; re-arms to `null`, so a later
  re-enable re-anchors, if cadence is turned off), and `isReportDue()` now
  refuses to report a cycle whose due moment falls before that anchor. Both
  `ReportReadyCard` and the bell's `info` alert go through `useReportDue()` →
  `isReportDue()`, so both are fixed by this one change with no call-site
  updates needed. The scheduled push notification needed no equivalent fix —
  it's a genuine OS repeating trigger (`WEEKLY`/`MONTHLY`), which by
  construction can only fire in the future, so it was never actually broken;
  only the in-app "is it due right now" check was.
- **Home screen's loading states, never actually wired despite existing.**
  Every relevant Home hook (`useGlobalSummary`, `useTransactions`,
  `useSpendingTrend`, `useBills`) already exposed a `loading` boolean
  following this codebase's own convention — Home just never read it, so each
  hook's default/empty value (₹0 balance, an empty transactions array
  rendering the real "No transactions yet" empty state, empty chart buckets)
  displayed as if it were the genuine answer, then popped to the real value a
  beat later. Fixed by wiring `loading` from all four hooks and adding two new
  small, reusable, RESTRAINED primitives (deliberately not onboarding's
  playful spring/pop — this is the main app, seen dozens of times a day):
  - **`components/Skeleton.js`** — a neutral placeholder block with a slow
    opacity breathe (signals "loading", not "broken" or "genuinely empty"),
    skipped under reduce-motion.
  - **`components/FadeIn.js`** — a one-time 240ms opacity+6px-rise entrance
    for content that just finished loading, mounted once per section
    transitioning from loading→loaded. Animate-first, snap-on-reduce — the
    same fix already applied to `OnboardingReveal`/`CountUp` after the
    reflection-screen ~2s lag bug, so it can't regress the same way.
  - Wired into: the hero balance + income/expense stats (skeleton blocks on
    the dark card, matched to `colors.inkCard` not the default light
    `colors.chipBg`), the spending chart, the streak chip (upgraded from a
    bare conditional to a fade), Upcoming Bills (fades in once it has data,
    rather than popping in unstyled), and Recent Transactions (three skeleton
    rows while loading, instead of flashing the real empty state first).
  - **Scoped to Home only for now** — Transactions/Budgets/Bills screens have
    the same class of hooks-already-expose-loading-but-screen-ignores-it
    pattern and would benefit from the same two primitives, but extending to
    them wasn't requested this round; `Skeleton`/`FadeIn` are already generic
    enough to reuse as-is when that's wanted.
- `npx expo export --platform android` clean (7.91 MB); `npx tsc --noEmit`
  clean.

**Reduce-motion blank-screen bug (on-device, ~2s lag on reflection)**: the
reflection screen showed nothing — no cards dropping, no text — for ~2 seconds
before everything appeared at once. Root cause was NOT layout: every animation
primitive (`OnboardingReveal`, `CountUp`, and reflection's `FallingCard`) held
its content at opacity 0 until the async `AccessibilityInfo.isReduceMotionEnabled()`
promise resolved (`if (reduce === null) return`). On some Android devices that
native call takes a second or two to return, so content stayed invisible the
whole time. Reflection was the loudest victim (its cards start fully off-screen
*and* invisible, and both its cards and its text gate on the check), but it was
latent in every reveal across the whole flow.

Fixed by switching all three to **animate-first, snap-on-reduce**: start the
entrance immediately on mount (default assumption = motion on), and only if the
OS later reports reduce-motion ON do we snap to the final frame. Content is
never hidden waiting on the bridge. The reduce-motion contract is still
honoured — a reduce-motion user gets the animation cut to its end as soon as
the value arrives; on a device where the check is slow they'd at worst see the
gentle entrance play once, which is strictly better than a multi-second blank
for everyone. `Confetti.js` was left as-is (it renders *nothing* until the
check resolves, which is fine — absent confetti during a 2s resolve is
invisible, not a blank content area). `npx expo export` clean (7.9 MB).

**Third correction (on-device screenshot)**: the text-half split now worked,
but the motif itself was still wrong — too small to read as two arrows, and
positioned too high (jammed into the top ~18% against the status bar). The
0.85× size + negative-edge-offset positioning were the culprits. Reworked
`OnboardingArrowMotif.js` to three named, easily-retunable constants:
`WIDTH_SCALE` 0.85 → **1.25** (both arrowheads now read clearly, ~12% bleed
each side matching the reference), `TOP_ANGLE` 15 → **24°** (rotated further so
the up→down flow reads at a glance; bottom variant is still the exact 180°
flip, `24 - 180 = -156°`), and positioning changed from a negative top offset
to **centring the box at `CENTER_FRACTION` (0.3) of screen height** from the
anchored edge — so the shape sits well down from the edge with clear space
before the text, instead of pinned to the top. Bottom variant mirrors it
(0.3 from the bottom). `npx expo export --platform android` re-verified clean
(7.9 MB). Still needs an on-device look to confirm the size/drop/angle land
right — all three are one-line constant tweaks now if not. (2026-07-15) — leak question softened, reflection screen deepened

- **`leak.js`'s question made speculative, not a direct assertion**: "Where
  does your money quietly leak?" → **"Where do you think your money quietly
  leaks?"** — the user may not actually know, and the question should read
  that way rather than assuming certainty.
- **`reflection.js` card copy expanded to two sentences each** (was one short
  line) — a gentle, hedged mirror of what the answer likely means ("chances
  are…", "usually means…" — never a flat assertion, since FLO doesn't
  actually know), followed by a reassurance that it changes from here. This is
  the one place in the flow that comes close to naming a pattern back at the
  user, so every line was checked against Koban's voice rule: never shame for
  spending, only for not knowing.
- **Layout fixed** — the cards were pinned to the top of the screen and the
  title/subtitle/button pinned to the bottom by a flex spacer, reading as two
  disconnected halves. Iterated twice on the user's own steer: first tried
  centring cards+text as one combined group (rejected — text/button belonged
  back at the bottom), then landed on the actual fix: only the **cards**
  container (`cardsWrap`) is `flex:1, justifyContent:'center'`, so the cards
  float centred in the space above, while title/subtitle/button keep the
  normal bottom-anchored flow every other onboarding screen already uses.
  Nothing pins the text down artificially anymore — it's just where it
  naturally sits after the flexible cards region.
- **Cards now fall in from above the screen and settle into their tilt**,
  replacing the generic `OnboardingReveal` pop-from-below used everywhere else
  — a bespoke `FallingCard` component (reanimated `useSharedValue`/
  `useAnimatedStyle`/`withSpring`, same library already used by `Confetti`/
  `OnboardingReveal`, no new dependency) animates `translateY` from
  `-FALL_DISTANCE` to 0 and `rotate` from 0 to its final tilt simultaneously,
  staggered per card index. Honors reduce-motion the same way as every other
  animation in this feature (final state immediately, no motion). **Tuned
  slow and smooth per explicit feedback** — the first pass (`damping:14,
  stiffness:120`) read as snappy; settled on `damping:20, stiffness:55,
  mass:1.3` (noticeably slower, no bounce) with a wider per-card stagger
  (180ms → 260ms).
- `npx expo export --platform android` re-verified clean (7.9 MB). (2026-07-15) — bigger main titles, and the same clipping bug found in three more places

- **Main titles enlarged** — the default `OnboardingScreen` title (`fontSize.hero`, 30) bumped to 34, and the shared hero-screen `titleSize` (problem/solution/ready/journey) bumped from 32 to 36. The title is the point of an onboarding screen, not a caption above the real content.
- **Found and fixed the SAME clipping bug in four more places**, immediately
  after enlarging: a lineHeight sitting too close to (or below) its fontSize
  clips a large extrabold glyph's own descender/ascender box — this is exactly
  the "Hey." bug from the previous round, and it recurs by default any time a
  custom font size is introduced without deliberately widening its line
  height to compensate.
  - `OnboardingScreen`'s `titleSize` override was computing `lineHeight:
    titleSize * 1.08` — far too tight. Changed to **`titleSize * 1.25`**, which
    now covers every screen using the prop (`ready`, `journey`, `commitment`
    previously, `done`'s 52px stacked headline) automatically.
  - `OnboardingScreen`'s default title lineHeight bumped 40→42 to keep pace
    with the fontSize increase (34).
  - `stat.js`'s hero number: `lineHeight: 100` at `fontSize: 100` (a literal
    1:1 ratio) → **122**.
  - `free.js`'s "Free." line: `lineHeight: 78` at `fontSize: 76` → **94**.
  - `reflection.js`'s bespoke title (not on `OnboardingScreen`'s shared style,
    since that screen has its own layout): bumped to match the same
    convention (34/42).
  - `opener.js`'s "Hey.": lineHeight nudged 118→124 for extra margin.
  - **Standing lesson for any future custom font size in this feature**: never
    set an explicit `lineHeight` without checking it's at least ~1.2–1.25× the
    `fontSize` for this font/weight (Manrope ExtraBold) — a tighter ratio will
    clip descenders on tall glyphs (`y`, `g`) even though it looks fine for
    text with no descenders during a quick check.
- `npx expo export --platform android` re-verified clean (7.9 MB).

---

## Data Model Summary (Final State After All Phases)

```
profiles
  ... (unchanged columns) ...
  onboarded_at        timestamptz   ← from 07. NULL = onboarding not finished.
  onboarding_answers  jsonb         ← NEW (this feature). Durable answers for
                                      personalisation + future callbacks:
                                      { age_range, goal, leak_category,
                                        tracking_habit, commitment }.
                                      INCOME IS NEVER STORED.

No other schema change. Onboarding writes through existing paths:
  profiles.full_name   ← via signup user_metadata (handle_new_user, unchanged)
  accounts             ← account step UPDATEs the default "Personal" row
  transactions         ← expense step INSERTs one row (AddTransactionSheet shape)
  budgets              ← budget step INSERTs one calendar_month row (from leak+income)
  (AsyncStorage)       ← lib/reports.js cadence; lib/notifications.js reminders;
                         lib/onboardingDraft.js the pre-auth draft (cleared on finish)

A budget's "spent" is still computed by v_budgets_with_spent — nothing derived
is stored, true to FLO's core principle.
```

---

## Impact on Existing Features (all phases)

| Existing Feature | Impact | Phase |
|---|---|---|
| `app/_layout.js` gate | Inverts to 3 states; `!session` becomes a 2-way choice on `introSeen` | 1 |
| `profiles` / `useProfile` | +1 nullable jsonb column | 1 (add) / 2–3 (write) |
| `app/sign-in.js` | New entry path from intro; reads drafted name into signup metadata | 1 (path) / 2 (name) |
| `07` account/expense/reminders screens | Restyled onto `OnboardingScreen`, logic intact | 2 |
| `07` `done.js` | Replaced by the new "you're all set" screen | 3 |
| `07` `OnboardingScaffold`/`Progress` | Superseded, then deleted | 3 |
| `budgets` / `AddBudgetSheet` shape | +1 real row created in-flow | 2 |
| `lib/reports.js` | New caller (`setReportSettings`) | 2 |
| `lib/koban.js` / `05` surfaces | +tone/goal copy inputs | 3 |
| `app/settings.js` | "Replay onboarding" retargeted | 3 |
| `AddTransactionSheet` | None (explicitly do not refactor) | — |

---

## Out of Scope (all phases)

- **Auto-detect onboarding step** — cut. Personal-use-only, can't ship to the
  stores (`06-...md` / `IDEAS-subscription-and-store.md`). The `detect` step and
  its `supported` predicate stay in `lib/detect.js`/`07` history but are **not**
  part of the v2 flow.
- **Actually sending answer-callbacks** ("you said X, here's where it went") — a
  separate future feature; this doc only guarantees the stored data to power it.
- **Storing income** — deliberate: it lives only in the device-local draft during
  the flow and is cleared on finish.
- **A Pro tier / paywall / foreshadow** — excluded, per the revision note on the
  free screen.
- **Replaying the pre-auth intro while signed in** — replay re-enters at the
  post-auth start only.
- **A user-editable budget amount / report time mid-flow** — the flow uses
  sensible defaults; both are editable later in their normal screens.
- **Adding a display/accent font** — if the "2 minutes a day" treatment wants a
  true second typeface (not just a Manrope weight + marker highlight), that's a
  font-loader change to call out explicitly, not fake.
```
