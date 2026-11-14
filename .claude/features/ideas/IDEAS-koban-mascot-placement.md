# Idea: Koban — Mascot Placement Across the App

**Not a plan. A reference.** Unscheduled, unphased. Graduates into a numbered
feature doc when picked up — most likely as **`05-koban-engagement.md` Phase 5+**,
since that doc already owns the mascot and its Phase 5 was explicitly blocked on
this exact art.

**Recorded**: 29 July 2026, after the mascot art landed and the onboarding intro
screens were wired up. The trigger was the question *"which screens need the
mascot image and where?"* — the answer turned out to be a different question,
recorded below.

---

## TL;DR — the two things that reframe the question

1. **Koban already has a fully designed voice that was deliberately built
   faceless.** `lib/koban.js` carries the comment *"No mascot references here (no
   emoji, no 'Koban' personification) — mascot art doesn't exist yet (Phase 5,
   blocked on user art)."* `05-koban-engagement.md`'s Phase 3 table contains the
   *intended* copy, written and then stripped at build time. Restoring the voice
   is worth more than any image placement, and needs **no new art**.
2. **Koban is a black cat. The app has a dark mode, and the two best
   placements are pinned-dark screens.** This is a hard blocker, not a polish
   item — see [The dark-surface collision](#the-dark-surface-collision).

---

## What already exists (verified 2026-07-29, not assumed)

### Art on disk

| Asset | Size | What it is |
|---|---|---|
| `assets/mascot/hey_screen.png` | 1024² RGBA | Koban **waving** — the maneki-neko beckoning paw |
| `assets/mascot/waht_would_screen.png` | 1024² RGBA | Koban with a **clipboard + pen** — the bookkeeper pose |
| `assets/icon.png` | 1024² | **App icon — already Koban**, lime background |
| `assets/notification-icon.png` | 96×96 RGBA | **Correct all-white Koban silhouette** |

> ⚠️ The clipboard asset's filename is misspelled **`waht_would_screen.png`**
> (not `what_`). Left as-is so the existing `require()` calls keep working —
> don't "fix" it without updating every import.

### The character, for whoever writes copy next

Koban is a **maneki-neko** (the Japanese beckoning cat). Two details worth
keeping straight because they're load-bearing for the voice:

- The raised paw is **beckoning/inviting**, not a greeting wave. That is exactly
  the register the app wants for a nudge.
- A *koban* is the **gold coin** the maneki-neko holds. The mascot's name is the
  money. This is a genuinely good pun and nothing in the app uses it yet.

The doc's already-written voice rules (`lib/koban.js` header, keep these):
sentence case, no exclamation marks, at most one emoji and only in a title,
**never shame the user for _spending_ — only for not _knowing_.** *"Koban is a
bookkeeper who misses you, not a scold."*

### Already built — do not redo

- **App icon** — shipped, is Koban.
- **Notification icon** — `assets/notification-icon.png` is 96×96 RGBA, **47.2%
  opaque coverage, zero non-white opaque pixels**, ears and eye-cutouts present
  (verified by decoding the alpha channel, not by eyeballing it). Already wired
  into `app.json`'s `expo-notifications` plugin with `color: "#BBDC12"`.
  **`05-koban-engagement.md`'s Phase 5 is effectively complete** — its checklist
  is simply unticked. Only the on-device confirmation remains.
- **Onboarding intro screens** (2026-07-29, this session) — `opener`, `problem`,
  `solution`, `name` use the waving art; `age`, `income`, `goal`, `leak`,
  `habit` use the clipboard art. All at **200px** via the new shared
  `components/OnboardingMascot.js`. `reflection` deliberately skipped (bespoke
  falling-cards layout, no hero slot). The green `OnboardingArrowMotif`
  watermark was removed from `problem`/`solution` as part of the same pass.

---

## The dark-surface collision

**The blocker for the single highest-value placement.** Koban is black
(`#101010`-ish) with a pale gray ellipse shadow, on transparency. These surfaces
are near-black:

| Surface | Background | Source |
|---|---|---|
| `StreakCelebration` | **#101010** (`colors.ink`, pinned static) | `components/StreakCelebration.js` |
| `RankUpCelebration` | **#101010** (`colors.ink`, pinned static) | `components/RankUpCelebration.js` |
| `MilestoneSpinWheel`, streak reward sheet | **#101010** | pinned dark by the same convention |
| Any screen in **Dark mode** | `bg` **#0B0B0B** / `surface` **#161616** / `chipBg` **#232323** | `theme/themes.js` |

Both celebration screens are *deliberately* pinned to the static palette (so they
always look the same regardless of the user's accent/mode) — that's a documented
decision, not an oversight, so "just make the background lighter" is the wrong
fix.

**Options, cheapest first:**
1. **A rim-lit / light-outline Koban variant** for dark surfaces. One extra
   asset, works everywhere, keeps the character recognisable.
2. **Place him on a lighter tinted tile** — reuses the existing `iconTile`
   pattern (`rgba(255,107,44,0.16)` is what the streak Flame sits on today).
   Zero new art, but a cat in a circle reads as an icon, not a character.
3. **A white/inverted Koban** — risks reading as a different character.

Recommendation: **(1)**, and treat it as the gating art request.

---

## Placement tiers

### Tier 1 — where Koban already speaks but has no face

**1. `StreakCelebration`, day 1 only — the best single placement in the app.**
Full-screen, fires on the user's first-ever transaction. Milestone days already
show real illustrated `STREAK_BADGE_ART`; **day 1 has no badge** (`MILESTONES`
starts at day 3) and falls back to an 88px lucide `Flame` in a tinted circle.

`05-koban-engagement.md` Phase 4's implementation notes **pre-authorise this
exact swap**: *"swapping it for a Koban-branded icon once Phase 5 art exists is a
one-line change, not a redesign."*

- Put waving Koban at **140px** — matching `badgeWrap`, the milestone badge size.
- **Day 1 only** (`isNewStreak`). Milestone days keep their earned badge art —
  never displace a reward the user earned with a mascot.
- **Needs the dark variant.**

**2. `TodayCard` — Koban's most frequent possible appearance.** The evening
close-the-day ritual on Home, currently a 44px `IconTile` with a lucide
`Wallet` (state `open`) / `CircleCheck` (state `nospend`).

- Swap the glyph for a **head-only Koban crop** at the same 44px. A full-body
  cat is illegible at 44px — this needs its own asset.
- Highest-frequency, lowest-cost placement in the app.

**3. Restore the personification in `lib/koban.js`.** Not an image. The copy is
already written in `05-koban-engagement.md`'s Phase 3 table:

| State | Intended copy |
|---|---|
| No streak | *"Start a streak"* — One entry today and **Koban's paw goes up.** |
| 7+ days silent | *"**The lucky cat is not feeling lucky**"* — A week in the dark. |
| Recap, milestone | *"30 days. **Koban is impressed.**"* |

Note the nudge/recap **notification** copy now lives in `lib/reminderCopy.js`
(server-sent, `17-server-push-notifications.md`) and is mirrored by hand into
`supabase/functions/send-push/reminderCopy.ts`. **Both must stay in sync** —
adding Koban's voice to notifications means editing two files, per that doc's
accepted-duplication note.

### Tier 2 — Home (the hero screen)

Home is **dense**: header chips → greeting + avatar → `AccountHeroCarousel` →
`ReportReadyCard` → `TodayCard` → chart → upcoming bills → recent transactions.

**Recommendation: no decorative mascot on a populated Home.** Home's job is the
money. Koban belongs in the moments *around* it — celebrations, the evening
ritual, empty states, notifications.

- ✅ **Do**: the Recent Transactions empty state
  (`app/(tabs)/index.js:363`, `"No transactions yet. Tap + to add one."`). A
  brand-new user's Home shows this, and it's the natural first place Koban
  should beckon. Costs a populated Home nothing.
- ❌ **Don't**: the greeting row. It would compete with the user's own avatar,
  which is also the Menu door.

### Tier 3 — empty states (the systematic win)

**The app already has a good empty-state pattern — extend it, don't fight it.**
Four surfaces do this properly today: a **48×48 circular tile + lucide glyph +
one line of copy**, centered, `paddingVertical: spacing.xxl` (~130px):

- `AlertsSheet` — *"You're all caught up."* (`CircleCheck`, brand)
- `RewardsHistorySheet` — *"Log a transaction to start earning coins."* (`PiggyBank`, coinGold)
- `AddTransactionSheet` Transfer tab — the fullest one: icon + title + body + CTA
- `AccountHeroCarousel` add-account slide

Against that, **11 surfaces are a single line of 14px muted text in a small
~50–70px Card**, all sharing an identical `emptyText` style, all with **zero
icons** — and they're on the most-visited screens:

| Surface | Copy |
|---|---|
| **Home** → Recent Transactions | `No transactions yet. Tap + to add one.` |
| **Transactions** tab | `No transactions this month.` |
| **Budgets** | `No budgets yet. Tap "New Budget" to set a spending limit.` |
| **Bills** | `No bills yet. Tap "New Bill" to add a recurring bill or subscription.` |
| **Plans** | `No plans yet. Tap "+" to start one.` |
| Budget detail → Transactions | `Nothing spent in this period yet.` |
| Plan detail → Expenses | `No expenses linked yet.` |
| Analytics → Categories | `No expense transactions in this period.` |
| Analytics → Budgets | `No budgets yet.` |
| Analytics → Plans | `No plans yet.` |
| Report → Budgets | `No budgets yet.` |

Plus 3 with **no Card at all** (naked text on the background): plan
`history.js` (*"No expenses in this range."* — ~38px of text in a full-screen
void, the weakest in the app) and `IncomeExpenseChart`'s two Analytics messages.

**The idea**: one shared `<KobanEmpty image title body cta />`, built on the
existing 48×48-tile grammar but scaled up where there's room. Different poses
per context later.

> ⚠️ **The nuance that must not be missed:** *"No transactions this month"* while
> the user is paging back to **March** is **not** *"you have no data yet."* A
> beckoning or sad Koban on a historical month someone is merely browsing reads
> as broken. **Gate the mascot on genuinely-zero-data, not on an empty filter
> result.** Same applies to every period-scoped empty state above (Analytics,
> Report, budget/plan detail).

### Tier 4 — the streak screen's zero state

`app/streak.js` on a 0-day streak currently shows a **muted literal "0" +
"day streak!"** with an unlit flame, and then still renders the Longest/Breaks
stat cards, the full 7-day grid (all cells empty) and all 12 milestone badges.
**There is no encouraging copy anywhere** — the zero state is conveyed by colour
alone.

- Candidate: Koban with the paw **down** replacing the unlit `StreakFlameIcon`
  (92px) when `!lit`, plus a real line of copy.
- ❌ **Never replace the _lit_ flame.** `theme/tokens.js` has a long comment on
  why streak orange (`#FF6B2C`) is a deliberate separate colour system from brand
  lime, and fire is the cross-app convention (Duolingo/Strava/Snapchat) that
  needs no learning. A black cat does not carry "streak."

---

## Do NOT place Koban here (recorded with reasoning)

| Surface | Why not |
|---|---|
| **`RankUpCelebration`** | 9 illustrated rank badges already carry this screen. A mascot would compete with the badge that **is** the reward. |
| **Milestone days** in `StreakCelebration` | Same — earned `STREAK_BADGE_ART` must not be displaced. |
| **Tour cards** (`app/onboarding/tour/[step].js`) | `TOUR_IMAGES` is reserved for **real app screenshots** (see `assets/tour/BRIEF.md`). Mixing in mascot art works against a live design decision. |
| **`app/sign-in.js`** | Uses `ArrowMark` (the brand logo) and is pinned to the static palette for a documented anti-flash reason. Brand mark ≠ mascot. |
| **The lit streak flame** | See Tier 4. |
| **Populated data screens** (Transactions, Analytics, Budgets, Plans, Bills lists) | Their job is the numbers. |
| **`app/onboarding/reminders.js`** | Already has an intentional bell-icon hero tied to the notification theme; a generic cat loses that meaning. Revisit only with a purpose-drawn "Koban with a bell." |
| **`app/onboarding/intro/reflection.js`** | Bespoke falling-cards layout on brand lime, no hero slot, already tight on short devices. |

---

## Art shopping list (in dependency order)

1. **Dark-surface Koban** (rim-lit / light outline) — *gates the best placement*
2. **Head-only crop** — for 44px slots (`TodayCard`, and any `IconTile` swap)
3. **Tighter-cropped body** — the current 1024² assets are mostly transparent
   padding, so the cat renders visually smaller than its box at every size
4. *Later, nice-to-have poses*: paw-down//sad (zero streak, empty states),
   celebrating (done screen, welcome bundle), with-a-bell (reminders step)

---

## Suggested sequence

1. **`lib/koban.js` voice restoration** — no art needed, highest character
   payoff per unit of work. (Remember `lib/reminderCopy.js` + its Deno twin.)
2. **Tick off `05-koban-engagement.md` Phase 5** — it's already built; just needs
   on-device confirmation of the status-bar silhouette.
3. **`StreakCelebration` day-1 swap** — once the dark variant exists.
4. **`TodayCard`** — once the head crop exists.
5. **`KobanEmpty` component** → roll out to Home + Transactions first (most
   visited, weakest treatment), then the rest.
6. **Streak zero state.**

---

## Adjacent gaps found during the sweep (not mascot work — worth their own fix)

Recording these here so they aren't lost; they surfaced while inventorying empty
states and are real bugs independent of any mascot decision:

- **`app/manage-categories.js:67-79`** — `renderSection` maps `categories` with
  **no length guard**. Delete every expense (or income) category and it renders a
  `<Card>` with no children: a hollow ~32px bordered box under a live header.
- **`app/(tabs)/index.js:287-293`** — Home passes `data={trendData}` to
  `IncomeExpenseChart` but **omits `emptyMessage`**, so the component's own empty
  branch is skipped and the chart Card renders header + range toggles over a
  **completely blank bar area**. Analytics passes the message; Home doesn't.
- **`components/DailySpendingChart.js:15-18`** — no empty branch and `maxValue`
  floors at 1, so zero data draws **7 flat zero-height bars** with day labels.
  Reads as broken rather than empty.
- **13 sections vanish silently** with zero data (Home's Upcoming Bills, most of
  `report.js`, several Analytics cards, and a budget that omits *itself* when
  `periods.length === 0`). Mostly correct — but worth one deliberate pass to
  decide which of them *should* say something instead.

---

## Open questions

- Does Koban ever **animate**? The user has mentioned wanting animation later.
  If so, the asset format question (Lottie vs. a sprite sequence vs. Reanimated
  on a static PNG) should be settled **before** many placements harden — the app
  currently has **no animation library beyond `react-native-reanimated`**, and
  `05`'s Phase 4 notes explicitly chose "no Lottie, no new library."
- Should the **empty-state Koban vary by pose per surface**, or is one pose
  reused everywhere the honest v1? (One pose is cheaper and reads as
  consistent; per-surface poses read as craft but multiply the art.)
- Is there a **Pro/paywall** role for Koban (`app/pro.js`, `ProUpsellSheet`)? Not
  examined in this pass. A mascot selling an upgrade is a different, riskier
  register than a mascot keeping you company — worth deciding deliberately
  rather than drifting into.
