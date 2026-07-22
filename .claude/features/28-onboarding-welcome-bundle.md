# Feature: Welcome Bundle + "Know Your Space" Tour
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/28-onboarding-welcome-bundle.md`
**Status**: 🚧 Both phases built (2026-07-22) — welcome bundle + celebration
sequencing (Phase 1) and the "Know your space" tour (Phase 2). On-device
verification pending; tour images are placeholders awaiting real screenshots.
**Last Updated**: 2026-07-22

---

## Context

Two problems, one feature:

1. **The early economy feels stingy.** Direct feedback: *"gating the users with
   just 25 coins and card themes worth 1000 is a turn off and possible churn."*
   A new user earns 25 coins for a first log with nothing to spend it on for a
   long time. → A one-time **welcome bundle** (3,000 coins, 2 freezes, the
   Glitch card theme), granted at onboarding completion and revealed on the
   "You're set" done screen.
2. **New users don't know where things are.** Onboarding never shows them
   *around* the app. → A **"Know your space" tour** — a short set of cards at
   the end of onboarding (before the done screen) walking through Home /
   Transactions / ⊕ / Analytics / Menu, ending on "make it yours"
   (Personalize + categories).

**The bundle is a DELIBERATE, bounded exception** to two standing rules —
"coins stay scarce" (`lib/rewards.js` invariant 4) and "ranks never pay"
(`27-rank-ladder-rework.md`). It fires exactly once per account, at signup,
keyed `welcome_bundle`. It is NOT a rank reward and NOT a general faucet. See
`WELCOME_BUNDLE`'s comment in `lib/rewards.js`.

### The design path (recorded so it isn't re-litigated)

This feature went through several rejected shapes before landing:

- **Bundle folded into the Saver rank celebration** → rejected; bundle is its
  own thing, granted by onboarding, not by `claimRank`.
- **Tour as a root-mounted overlay after onboarding** (dimmed scrim; then a
  live-screen tooltip; then a dialog carousel) → all rejected as
  cramped/confusing and fragile without a device. The overlay component
  (`components/AppTour.js`) and its data (`lib/tour.js`) were built and then
  **deleted**. A separate `profiles.tour_seen_at` flag was added for it and is
  now **unused** (left in the DB, harmless — see Data Model).
- **Final decision:** the tour becomes the last *onboarding steps* (reusing
  `OnboardingScreen`), so `profiles.onboarded_at` alone gates everything — no
  overlay, no second flag, no transparent-modal fragility.

### Celebration sequencing (the rule that ties it together)

A brand-new user must never see stacked full-screen celebrations. Settled
order:

```
ONBOARDING  …expense step ──(if they log)──▶ ① day-1 STREAK celebration (immediate, contextual)
            …tour cards (Phase 2)…
            welcome-bundle screen           ──▶ ② WELCOME BUNDLE reveal + Confetti
            done ("You're set!")            ──▶ send-off; finish() grants the bundle
HOME        first real view                 ──▶ ③ Saver RANK celebration (Ocean Deep)
            (if they skipped logging) first Add ▶ ① day-1 STREAK celebration
            later: Keeper+ rank-ups         ──▶ normal RankUpCelebration
```

- **Day-1 streak** fires **immediately** on the first transaction — during
  onboarding if they log there, else on Home. NOT gated on onboarding (direct
  decision). Fires once (AsyncStorage "already celebrated today" guard).
- **Welcome bundle** reveals on its **own dedicated screen** after the tour
  (`app/onboarding/welcome-bundle.js`); the actual grant runs in `done`'s
  `finish()` (amounts shown from the `WELCOME_BUNDLE` constant).
- **Saver rank** celebrates on **Home** (`RankUpCelebration`, gated on
  `onboarded_at`) — a separate beat from the bundle (user chose separate
  screens + Saver-on-Home over combining them).

---

## Phase 1 — Welcome Bundle + Celebration Sequencing ✅ Built (2026-07-22, on-device pending)

### Goal

A user who finishes (or skips through) onboarding is granted the welcome
bundle once, sees it revealed on a redesigned "You're set" screen, and the
day-1 streak / Saver rank celebrations are sequenced so nothing stacks.

### 1.1 Database

**No schema changes for the bundle** — it reuses `reward_events` with a new
`source` value `'welcome_bundle'` (ref also `'welcome_bundle'`, one-time) plus
the existing `theme_grant` source for Glitch.

(`profiles.tour_seen_at` was added earlier this session via migration
`add_profiles_tour_seen_at` for the abandoned overlay tour and is now unused —
see Data Model. Not dropped; harmless.)

### 1.2 Data Layer — built

- **`WELCOME_BUNDLE`** (`lib/rewards.js`) — `{ coins: 3000, freezes: 2,
  themeId: 'glitch' }`, the single source for both the grant and the done
  screen's display, with the full "why this bounded exception exists" comment.
- **`claimWelcomeBundle()`** (`lib/rewardsMutations.js`) — idempotent upsert on
  `(user_id,'welcome_bundle','welcome_bundle')`; freezes route through
  `clampFreezeGrant`; Glitch granted as a separate `theme_grant` row (same
  shape every other claim uses). Returns `{ error, isNewClaim, coins, freezes,
  themeId }`.
- **`useOnboarding().finish()`** (`lib/onboarding.js`) — now calls
  `claimWelcomeBundle()` **before** writing `onboarded_at`, wrapped in
  try/catch (best-effort; a failed grant never blocks finishing). Order is
  deliberate: `updateProfile({ onboarded_at })` is non-silent → bumps
  `useDataRefresh` → balances refetch; granting first means that refetch
  already includes the bundle rather than showing a stale balance. Runs on
  skip too (skip === completion).

### 1.3 Components — built

- **`app/onboarding/done.js`** — redesigned per direct feedback: **white
  background, ink text** (was full-bleed brand lime), the **welcome bundle
  revealed at the bottom by the CTA** (a chip-bg card: `+3,000` coins, `+2
  freezes`, a Glitch `CardThemeSurface` swatch), **Confetti kept**. Pinned to
  the static default palette (like `sign-in.js`), and still does NOT navigate
  on `finish()` (the gate owns the exit — preserving the 07 flicker fix).
- **`components/StreakCelebration.js`** — the `onboarded_at`/`tour_seen_at`
  gate added earlier this session was **removed**: the day-1 streak now fires
  immediately, including during onboarding (the AsyncStorage guard still
  prevents re-showing). `useProfile` import dropped (no longer used).
- **`components/RankUpCelebration.js`** — gate simplified from
  `!onboarded_at || !tour_seen_at` back to just **`!onboarded_at`**, so the
  Saver celebration lands on Home after the done screen.

### 1.4 Removed this phase

- `components/AppTour.js` (abandoned overlay) — **deleted**.
- `lib/tour.js` (its step data) — **deleted**; content preserved in Phase 2's
  step table below.
- `<AppTour />` mount + import in `app/_layout.js` — removed.

### 1.5 Phase 1 Checklist

- [x] `WELCOME_BUNDLE` constant + `claimWelcomeBundle()` (idempotent, freezes
      via `clampFreezeGrant`, Glitch `theme_grant`). *Built, Babel-verified.*
- [x] `finish()` grants it before `onboarded_at`, best-effort, on finish AND
      skip. *Built.*
- [x] `done.js` redesigned: white bg, ink text, confetti, no navigation.
      *Built. (The bundle block that briefly lived here moved to its own
      screen in Phase 2 — `welcome-bundle.js`.)*
- [x] Streak fires immediately (onboarding gate removed); rank gated on
      `onboarded_at` only. *Built.*
- [x] Overlay tour + `lib/tour.js` removed; no dangling refs. *Verified via
      grep.*
- [ ] A new signup finishing onboarding sees the bundle on the welcome-bundle
      screen, lands on Home with the coins/freezes/Glitch actually credited,
      then the Saver celebration. **On-device.**
- [ ] Skipping the tour still shows the welcome-bundle screen and grants the
      bundle at `done`. **On-device.**
- [ ] Day-1 streak fires immediately after logging in the onboarding
      expense step (not deferred), and only once. **On-device.**
- [ ] Nothing stacks: streak, then done(bundle), then Home(Saver) — never two
      modals at once. **On-device.**

---

## Phase 2 — The "Know Your Space" Tour ✅ Built (2026-07-22, on-device pending)

### Goal

Insert a short guided tour as the final onboarding steps (after `commitment`,
before `done`), so a new user learns where things are *before* the done-screen
reward. No overlay, no new flag — its own sub-flow like `INTRO_STEPS`.

### As built (expanded 2026-07-22 per follow-up feedback)

- **`lib/onboarding.js`** — `TOUR_STEPS` (its own sub-flow, separate from
  `STEPS`, so it keeps its own "N of N" progress and doesn't dilute the main
  10-step bar) plus `TOUR_START_ROUTE`, `BUNDLE_ROUTE`, `getTourStep`,
  `getTourPosition`, `getTourNext`. **Ten cards**: Home, Transactions, Add,
  Analytics, Menu, **Budgets, Plans, Bills** (each its own card, per feedback),
  **Coins/freezes/XP** (one segmented card), Make-it-yours. `commitment.js`
  routes to `TOUR_START_ROUTE`; the last card + any "Skip tour" route to
  `BUNDLE_ROUTE`.
- **`components/TourScreen.js`** — card layout: image placeholder in the top
  ~2/3 (`chipBg` box, section icon + "Preview" until real screenshots drop in —
  pass a `require()`'d `image` later), then a **"Quick Tour" eyebrow** + title +
  subtitle + optional segmented body, then CTA. Own progress bar + "N of N".
  Static palette, white bg.
- **`app/onboarding/tour/[step].js`** — one dynamic route for all ten cards.
  The `currency` card renders three segments (coins/freezes/XP, one screen);
  the `hub` card ('personalize') renders deep-link rows to the **real**
  `/personalize` and `/manage-categories`.
- **`app/onboarding/welcome-bundle.js`** — NEW dedicated reward screen
  ("Here's your welcome bundle") with Confetti + the three rewards, reached
  from the last tour card AND from "Skip tour" (skippers still get it).
  Continue → `done`. Shows amounts from the `WELCOME_BUNDLE` constant; the
  actual grant still happens at `done`'s `finish()`.
- **`app/onboarding/done.js`** — the bundle block was **removed** (it has its
  own screen now); back to a clean "You're set" send-off (white bg, confetti,
  `finish()`).
- **`app/_layout.js` `OnboardingGate`** — allowlisted `personalize` /
  `manage-categories` as tour "detour" routes.

**Full new-user flow now:** `…commitment → tour (Home · Transactions · Add ·
Analytics · Menu · Budgets · Plans · Bills · Coins/Freezes/XP · Make-it-yours)
→ welcome-bundle reveal → done → Home (Saver celebration)`. Skipping the tour
jumps to the welcome-bundle reveal (never skips the reward), then done.

**Currency screen / individual-vs-segmented decision:** coins, freezes and XP
are ONE segmented card (three rows), not three screens — chosen to keep an
already-longer tour from ballooning. Budgets/Plans/Bills ARE separate cards
(explicit feedback).

**⚠️ Needs `npx expo start -c`** — new `app/onboarding/tour/` route directory;
Expo Router won't see it on a dev server started before the dir existed
(00-index.md standing note).

### Shape (as designed)

- Full-screen `OnboardingScreen`-style cards: a **screen image placeholder
  occupying the top ~2/3**, then title + subtitle + CTA below (the layout the
  user described). Images are **placeholders** to be supplied later (like the
  badge art); they'll need re-capturing when a screen's UI changes (accepted).
- One card per area, matching the real tab bar
  (`[Home] [Transactions] [⊕ Add] [Analytics] [Menu]`) plus a closing
  "make it yours" card:

  | Card | Title | Gist |
  |---|---|---|
  | Home | Home | Money at a glance — balance, streak, rewards. |
  | Transactions | Transactions | Every expense/income, searchable. |
  | Add | Add anything | The ⊕ logs anything in seconds, from any screen. |
  | Analytics | Analytics | Where your money actually goes. |
  | Menu | Everything else | Budgets, Bills, Plans, Reports, Shop, Settings live in the Menu. |
  | Make it yours | Make it yours | Optional: Personalize + set up categories (deep-link to the real screens), or skip. |

- Added to `lib/onboarding.js`'s `STEPS` (after `commitment`), so the progress
  bar + routing renumber automatically. Each card is a route under
  `app/onboarding/` using `OnboardingScreen`.
- Skippable; skipping still completes onboarding (→ `done` → bundle), so a
  skipping user still gets the bundle.
- `onboarded_at` (set at `done`) is the only gate — no `tour_seen_at`.

### Open before building
- Exact placeholder-image treatment in `OnboardingScreen`'s `hero` slot (does
  it need a new prop for a 2/3-height image region, or reuse `hero`?).
- Whether "make it yours" deep-links out to `/personalize` + `/manage-categories`
  and returns, or just points to them (the earlier deep-link/return logic is
  gone with the overlay — reassess against the onboarding-step model).

---

## Data Model Summary

```
profiles (existing)
  └─ tour_seen_at timestamptz  → added (migration add_profiles_tour_seen_at),
        backfilled to now() for existing rows, but NOW UNUSED — it was for the
        abandoned overlay tour. Left in place (harmless); the tour is gated by
        onboarded_at instead. Drop later if desired.

reward_events (existing, no schema change)
  ├─ source 'welcome_bundle', ref 'welcome_bundle' → one-time bundle grant
  │     coins 3000 (+ freeze overflow), freezes 2 (clamped)
  └─ source 'theme_grant', ref 'glitch' → the bundle's card theme
        │  granted once in lib/onboarding.js finish() (on finish OR skip)
        ▼  revealed on app/onboarding/done.js; balance/ownership refetch via
           finish()'s non-silent onboarded_at write
```

---

## Out of Scope (All Phases)

- **Rank-based coin/XP payouts in general** — still rejected per `27`. The
  bundle is structurally separate (granted in onboarding, not `claimRank`).
- **A "Getting Started" checklist** — onboarding's own Act 2 steps already do
  most of it; the tour covers the real gap (where things are).
- **Removing Glitch from the Shop** — stays buyable at 1,300 coins; owning it
  both ways is harmless.
- **A retry path for a failed bundle grant** — accepted risk for v1 (idempotent,
  low failure rate; a failure just means no bundle, onboarding still completes).
- **Dropping the unused `tour_seen_at` column** — left in place; not worth a
  migration now.
