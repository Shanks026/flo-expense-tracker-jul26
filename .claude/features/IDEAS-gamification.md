# Idea: Gamification — Coins, Freezes, Trophies, Themes, Chests

**Not a plan. A reference.** Unscheduled, unphased. Graduates into a numbered
feature doc when picked up.

**Recorded**: 17 July 2026, from a brainstorm that started with "leaderboards,
mascot skins, gacha?" and ended somewhere more honest. Updated same day with
the follow-up rounds: purchasable coins (rejected again, mechanism recorded),
dual-track cosmetics, seasonal themes, where skins actually display, and the
promo-card/ads decision. The rejected ideas are recorded *with their
reasoning* so they aren't re-litigated.

**Updated 2026-07-19** with the reframe below — everything above rewards
*logging*; this round asks the harder question (why open the app at all) and
lands on the daily *ritual* as the missing retention primitive. User decision:
start the build here. The reframe reorders the suggested flow (the ritual +
ledger now come before the trophy room).

---

## The reframe that changes the goal: logging is a chore, closing the day is a ritual

Everything below this section rewards **logging harder** — more coins, more
milestones, more quests for the same act of recording a transaction. But
logging is a *chore*, and gamifying a chore harder yields a better chore, not a
hook. The uncomfortable asymmetry, stated plainly: Duolingo's core action **is**
the reward (you learn something); FLO's core action produces no intrinsic payoff
— nobody enjoys typing "₹40 chai." So the retention question the economy never
quite answers is: **why open FLO on a day you have nothing to log?**

The answer is a conscious end-of-day **close-the-day** moment. It doesn't
replace logging or drive the streak — the streak still measures the real
behavior (below) — it's the *wrapper* that gives the day a finish line (the way
Apple's rings close) and, crucially, turns a gap-day from a silent failure into
a *decision*: a no-spend win, or a freeze. The economy above doesn't change; it
gets a daily home and an honest way to handle the days you have nothing to log.

### The daily loop — four states, two currencies

The streak measures **engaging with your money today**, which is one of two
honest acts: you **logged a transaction**, or you consciously **declared a
no-spend day**. Doing nothing at all is the only thing that breaks it (recovered
by a freeze, below). Two currencies come off the day and do different jobs:

- **Coins** — spendable (shop fuel), earned **only by logging**. Flat, once per
  day (the doc's anti-fake-₹1 rule). **Never** earned by a no-spend day —
  otherwise not-logging pays the same as logging, and the app is paying you to
  stop tracking, which rots the one thing it exists to do.
- **XP** — permanent progress, feeds **Money Level** (below). Earned for
  *showing up* — a logged day OR a declared no-spend day. Fakeable, and that's
  fine: it's a vanity ladder; faking only inflates your own number, leaks no
  money data, and keeps people opening the app anyway.

The four states (**amounts illustrative — "ratios, not gospel"**; the invariants
under the table are what's actually fixed):

| Day | Streak | XP | Coins |
|---|---|---|---|
| **Logged** | +1 | full (e.g. 1000) | full (e.g. 100) |
| **No-spend (declared)** | +1 | partial (e.g. ~750) | **0** |
| **Freeze-covered miss** | held | one-time (e.g. 500) | one-time (e.g. 25) |
| **Start fresh (after a break)** | reset → 1 | full | full |

Invariants at any tuning: **(1)** a logged day out-earns every other state in
both currencies; **(2)** a no-spend day earns **zero coins**; **(3)** the freeze
comeback is one-time and below a logged day; **(4)** coins stay scarce against
shop sinks, XP inflates freely. Break (1) or (2) and not-logging becomes as good
as logging — the failure mode the whole design exists to prevent. "Start fresh"
is a normal logged day (full reward) that happens to be Day 1 — the penalty for
breaking is the lost streak *length*, never a withheld daily reward on the
comeback (that would double-punish the exact demoralized moment).

### The acknowledgement — a receipt, not a toll

An end-of-day notification brings the user back; what they see depends on the
day, and a dialog is only *forced* when there's a decision to make:

- **Logged day** — an **optional** recap ("₹450 across 3 logs · +100 coins · Day
  12"). Coins/XP were already earned **by the log itself**; the dialog only
  reveals them. A diligent logger who ignores the notification keeps everything
  — never gate earned coins behind a second tap, or you nag your best users.
- **No-spend day** — a **required** dialog ("Nothing logged — a no-spend day?").
  The tap is the *only* place a no-spend day can be recorded (no transaction to
  hang it on) → **+streak, +XP, 0 coins.**
- **Missed day(s), on return** — a **required** prompt ("You missed [day]. Use a
  freeze, or start over?"). Conscious, never silent auto-consume — hiding the
  decision is wrong for an app about awareness.

Every earn is an **idempotent `reward_events` row** keyed on the date (`UNIQUE
(user_id, source, ref)`) so nothing double-claims. The logged-day earn is
computed from the transaction; the no-spend and freeze earns are user-initiated
claims — the cheapest kind to build correctly, because the tap *is* the claim.
This makes `computeStreak` covered-dates-aware: it takes transaction days plus
declared-no-spend days plus frozen days as the covered set, and stays pure.

### Freezes — atomic, conscious, honest in the calendar

- **1 freeze = 1 day.** Covering 3 missed days costs 3 freezes; a user holding 5
  keeps 2. No "5-day mega-freeze" — a stack of single-day tokens is more legible
  and doesn't silently forgive a whole week of not logging.
- The **comeback reward is flat and one-time** (e.g. 500 XP / 25 coins) no
  matter how many days were patched, so gaps aren't worth hoarding. The day you
  return and actually log earns its normal logged-day reward *on top* — separate
  event.
- A frozen day renders as its **own ice tile** in the calendar, never a fake
  flame (already the doc's standing freeze rule — the calendar must not lie).
- Earned via achievements, which grant **quantity** (day-30 → 1, day-100 → 3),
  not a fatter token. Reviving an *already-dead* streak stays out of this — that
  is **repair**: rare, chest-exclusive per the shop section, never a routine
  token. The only "bigger" protection worth ever building is a planned
  **vacation/pause** declared *in advance* (honest because it can't be applied
  reactively to paper over a break) — not a second earned "ultra freeze."

### Money Level — the progress that never resets

Streaks break and coins get spent; neither gives a **permanent identity**, and
a broken 40-day streak is the exact demoralized moment that churns a user. So
add a lifetime **Money Level** that only ever goes up — the safety net under the
streak's tension. When the streak dies, "you're still Money Level 12" catches
the fall instead of "back to zero."

The elegant part: still **no new table.** XP is a second column on the same
`reward_events` rows as coins (a logged-day row = `coins:100, xp:1000`; a
no-spend row = `coins:0, xp:750`). Because XP is **only ever earned** — there is
no XP sink, it's not spendable — `Σxp` is monotonic *by construction*, so it can
never regress the way a spend-and-earn balance can. One ledger yields three
numbers: spendable **coins** (`Σcoins_earn − Σcoins_spend`), lifetime **XP**
(`Σxp`), and the **level** curve over it. The curve lives in `lib/rewards.js`,
pure and testable like `lib/streak.js`. Home already reserves the spot: the
`welcomeSubtitle` slot under the greeting is commented "will become dynamic
gamification content" — this is that content.

Because XP carries **no money data** — it's pure engagement — it's the one
metric that could feed a *future* leaderboard without leaking anything personal,
where a money ranking never could. It's still farmable (you can inflate it by
just showing up), so the leaderboard itself stays **parked** per the Rejected
section; XP is merely built leaderboard-*ready*, not leaderboard-*live*.

### Supporting ideas recorded (from the 2026-07-19 brainstorm, not yet scheduled)

These extend the ritual; parked here so they aren't lost, sequenced after the
ritual + ledger land:

- **Daily rings** — three tiny closable loops on Home (logged today · under
  today's pace · everything categorized). A glanceable daily state; closing the
  day is the master ring.
- **Sunday Wrapped** — elevate the existing weekly report into a swipeable,
  Koban-narrated, shareable recap. The *anticipation* of the weekly recap is a
  retention hook independent of daily logging; it also gives the promo-card and
  the parked anonymous-percentile idea a natural home.
- **Compete with past-you, never other people** — "12-day streak, your personal
  best"; "4 more logged days than last month." Self-comparison is safe under the
  self-reported-data constraint where leaderboards are not.
- **Home/lock-screen widget** — for a *habit* app the highest-frequency trigger
  there is; a streak flame + "close today" beats a push. Already parked in
  `IDEAS.md`; the ritual gives it its verb.
- **Surprise timing, not surprise contents** — occasional "Koban left you +5 for
  showing up" on a day you almost forgot. Variable-reward *delight* without a
  gambling loop (the chest stays deterministic; this varies *when*, never
  *what*).
- **Front-loaded first week** — a guided first-7-days quest ladder from the
  "one-time firsts," guaranteed early wins before the habit is real.
- **Calm gamification as brand** — deliberately the anti-Robinhood-confetti:
  celebrate discipline (a kept budget, a no-spend day), never manufacture money
  anxiety. A dial set to ~6, not Duolingo's 11 — real stakes, but never
  sold-back safety, never guilt.

---

## The constraint that decides everything: FLO's data is self-reported

Anyone can log a fake ₹1 transaction to keep a streak alive, and FLO can never
prove they didn't. That is **completely fine for single-player motivation** —
you're only cheating yourself — and it **hard-kills** anything competitive or
purchasable-advantage. Every design decision below follows from this:

- Gamification stays **single-player**. No opponent, no ranking, no comparison
  that makes faking rational.
- Rewards key off **behavior** (logged today, kept a budget, finished a plan) —
  **never off amounts**. "Earn coins per ₹ saved" rewards income, not
  discipline, and invites fake entries.
- Cheat-resistance is not a goal. The moment it would need to be (leaderboards,
  paid advantage), the feature is out of scope instead.

## Rejected outright (do not re-propose without new facts)

**Leaderboards.** "Based on what?" has no good answer. Money amounts can't be
compared across users (a "most saved" board is a wealth ranking; "least spent"
punishes whoever's rent was due). The only fair metric is behavior — which is
exactly the trivially-fakeable metric, and ranking makes faking rational. FLO
also has no social graph, no server-side aggregation, and (as of writing) one
user. The one soft version that could ever work: an anonymous percentile
("you logged more consistently than 84% of FLO users") — comparison without
competition. Parked indefinitely.

**Gacha / loot boxes / paid crates.** Brand contradiction: FLO exists to teach
money discipline; building a variable-reward gambling loop inside it is the
exact behavior the app nags users about. Practically it's also the most
expensive option (a gacha needs a deep item pool; every item is an art asset,
and the mascot itself is still blocked on art — `05` Phase 5), and purchasable
randomized rewards trigger Play's loot-box odds-disclosure rules. The
deterministic **milestone chest** (below) keeps the reveal dopamine with zero
gambling mechanics. **User decision 2026-07-17: no gacha, final.**

---

## The economy

### Currency: coins (one currency, not coins + gems)

A dual-currency system (soft + premium) exists to launder real-money pricing —
which FLO will never do (see IAP section). One currency, earned only.

All numbers below are **illustrative tuning targets, not commitments** — the
ratios matter more than the values. The anchor: a casual user (logs most days,
keeps a budget) should afford a streak freeze in ~2–3 weeks and a mid-tier
card theme in ~a month.

### Earning (all derivable from existing data)

| Source | Coins | Notes |
|---|---|---|
| First log of the day | +10 | **Flat per day, not per transaction** — else 20 fake ₹1 rows farm coins. Same `created_at`-based day-bucketing as the streak. |
| Streak milestone | 3→50, 7→100, 10→150, 30→400, 50→600, 100→1500 | Rides the existing `MILESTONES` list (`lib/streak.js`) — one milestone list, one answer, per that file's own comment. Ladder extension past 100 is an open decision below. |
| Weekly quest completed | +25 to +75 each | ~3 rotating quests/week (see Quests). |
| Budget kept for its full period | week +75, month +200 | From `v_budgets_with_spent`: period ended, `spent <= amount`. Flat — never scaled by the budget's size. |
| Plan completed at/under target | +200 | From `v_plans_with_totals`. |
| One-time firsts | +20 each | First budget, first plan, first report viewed, first transfer, first export. Onboarding-adjacent breadcrumbs. |

**Idempotency is the real engineering requirement**: every earn is claimable
exactly once, enforced by a unique key (see DB sketch), because all of this is
computed client-side from derived data — the claim, not the computation, is
what's recorded.

### Quests (weekly, rotating)

Deterministic rotation, no server: seed the week's quest set from
`(ISO week, userId)`, compute progress client-side from existing hooks, record
only the claim. Candidates:

- "Log on 5 of 7 days" (+50)
- "Categorize every transaction this week" (+30)
- "Stay under [specific budget] all week" (+75)
- "Open your weekly report" (+25)
- "Have a no-spend day" (+40) — **blocked on the no-spend wrinkle below**

### Spending (sinks, cheapest-to-build first)

| Item | Cost | Notes |
|---|---|---|
| **Streak freeze** | 300 | The anchor item — zero art, immediate felt value, protects the retention engine. Hold max 2. Auto-consumes on a missed day; the calendar shows that day as a distinct "frozen" tile (ice), never as a fake logged day — the calendar must not lie. One granted free at the day-7 milestone to teach the mechanic. |
| Hero card themes | 400–1,200 by rarity | See Themes section. |
| Confetti styles | 250 | `Confetti.js` piece shapes/palettes. |
| Streak calendar skins | 250 | Tile shapes/palettes for `StreakCalendar`. |
| App icon variants | 500 | Real native work (activity-alias on Android) — priced high, built late. |
| Mascot skins/outfits | 800–2,000 | **Future — blocked on Koban art existing at all** (`05` Phase 5). Design the slot now, fill later. |

**Streak repair** (un-break a dead streak): deliberately **not** in the shop.
Selling the undo cheapens the stakes that make the streak work; Duolingo
monetizes repair, FLO shouldn't. If it exists at all, it's a rare
chest-exclusive at big milestones.

**Trophies are free, not purchasable** — they're the recognition layer, not a
sink. Purchasable trophies are worthless trophies.

### Trophies (the free layer, cheapest thing in this doc)

A trophy room screen: earned = colored, unearned = grayscale silhouette + hint.
All derivable, no new data (except optionally a "seen" flag — AsyncStorage,
**user-scoped key** per the standing rule). Lucide icons, no art dependency.
Candidates:

- Streak: one per milestone (3/7/10/30/50/100…)
- Perfect Month: logged every day of a calendar month
- Budget-keeper: kept a budget 1 / 3 / 6 consecutive periods
- Planner: first plan completed; 5 plans completed
- Logger: 100 / 500 / 1,000 lifetime transactions
- Fresh start: first transaction ever (everyone gets one — the trophy room is
  never empty)

### Milestone chests (deterministic — the no-gacha reveal)

At big milestones (30, 50, 100, and any ladder extension) plus possibly
Perfect Month. A chest opens to show **three fixed items for that tier — the
user picks one**. No randomness anywhere: contents are the same for every user,
odds don't exist, nothing is purchasable. The dopamine is "I earned a choice I
didn't know the contents of," not "I might win."

Chest pool: coin bundles, streak freezes, **chest-exclusive** card themes
(Gold Card at 100 is the flagship — see Themes), confetti styles, app icon
variants, future mascot skins/poses. Chest-exclusivity is what makes chests
matter; if everything is also in the shop, a chest is just a discount.

---

## Hero card themes — what "theme" concretely means

The Home hero card (the dark "In Hand" card) is visually a **bank card**, and
users already read it that way — so themes are *card designs*, a metaphor
everyone gets instantly. A theme is a token object
(`{ bg | gradient, textTone, mutedTone, pattern?, sheen? }`) the hero card
reads instead of hardcoded ink — `theme/tokens.js` centralization plus
`AmountText`'s existing `muteCurrency` machinery make this genuinely cheap.
Later the same object can skin the account-switcher cards (accounts already
have a `color` column).

Example line-up:

| Theme | Look | Source |
|---|---|---|
| Ink | Current default — dark ink, lime accents | Free |
| Lime Flood | Inverted brand: lime card, ink text | Cheap shop |
| Blueprint | Deep navy + faint graph-paper grid — finance-native | Shop |
| Dusk | Violet→ink gradient | Shop |
| Ocean | Deep navy→teal gradient | Shop |
| Ember | Charcoal with warm orange accents | Shop |
| Graphite | Gunmetal, brushed-metal feel | Shop |
| Monsoon | Slate + subtle rain-streak texture | Shop / seasonal |
| Diwali | Indigo + gold spark accents | Seasonal |
| **Gold Card** | Gold foil + slow sheen sweep — the premium-credit-card look | **Day-100 chest exclusive** |
| **Platinum** | Pale metallic + sheen | **Day-365 exclusive** (if ladder extends) |

Rare themes get a reanimated foil-sheen sweep — reduce-motion aware,
animate-first/snap-on-reduce, per the existing `Skeleton`/`OnboardingReveal`
convention. Patterns are inline SVG (same no-Metro-SVG-loader pattern as
`Logo.js`/`ArrowMark.js`).

### Seasonal themes — free to equip, earn to keep

Christmas / Diwali / Holi etc. (settled 2026-07-17): during the season the
theme is **free for everyone to equip** — pure delight, zero friction, the app
feels alive and current. **Keeping it permanently** requires completing a
seasonal quest ("log 15 days in December") — earn-to-keep converts the freebie
into an engagement spike without selling FOMO. The theme **returns next year**
for anyone who missed it: gone-forever exclusivity is a mild dark pattern;
"come back next Diwali" is an honest re-activation hook.

---

## Where skins actually display — the "who's the audience?" answer

Raised 2026-07-17: FLO isn't a game — there are no other players to flex a
skin to. The answer: in a habit app, cosmetics are **self-expression +
investment, not signaling**, and that works with zero audience — see
phone-theming culture (people pay for icon packs nobody else sees) and
Duolingo's outfits for Duo. The mechanism is the **endowment effect**: an app
you've customized feels like yours, and an app that feels like yours doesn't
get uninstalled. The customization *is* the retention mechanic.

Concrete display surfaces (also the reason mascot skins are worth drawing at
all — Koban currently has a voice but no body):

- **Home** — the highest-frequency screen. A small state-reactive mascot
  (cheerful while the streak lives, concerned when a budget's tight); the
  equipped skin is what you see every day. Primary surface.
- **Streak screen + `StreakCelebration`** — the milestone moment is the
  mascot's stage; day 100 with Koban in the Gold outfit *is* the payoff.
- **Empty states** — transactions/budgets/plans empties get the mascot
  instead of plain text.
- **Report screen** — Koban presenting your week.
- **App icon variants** — the one genuinely semi-public surface.
- **Home-screen widget** (parked in `IDEAS.md`) — if ever built, a skinned
  mascot on the widget is FLO's most public real estate.

**Avatar + skin bundles**: Koban-artwork avatars (matching each skin's theme)
as an alternative to the photo avatar — displays today in the Home header,
`MenuSheet`, and `EditProfileSheet`, and becomes the display token if an
anonymous-percentile feature ever exists. A bundle = mascot skin + matching
avatar set + (sometimes) matching card theme: one art direction, three
surfaces.

---

## IAP — the permanent policy

**Can there ever be in-app purchases? Yes — cosmetics only, fixed price, zero
randomness, zero function.**

Allowed lanes (post-store-release only, RevenueCat + server-side entitlements
per `IDEAS-subscription-and-store.md`):

1. **Paid cosmetic packs** — card-theme bundles, mascot outfits. The
   Genshin-skin analogy holds with one correction: FLO has one character
   (Koban), not a roster — so it's **outfits for the one mascot**, not
   characters. Fixed price, you see exactly what you buy. Store-compliant, no
   odds disclosure, and pay-to-win is impossible because there's no "win."
2. **Pro subscription perks** — the AI-backed Pro tier (per the subscription
   doc) can include an exclusive cosmetic line and/or a monthly coin stipend.
   Gamification feeds retention; retention feeds Pro. It's the funnel, not the
   product.

**Cosmetics are dual-track** (clarified 2026-07-17): every theme/skin remains
earnable with earned coins; *select* packs are **also** directly buyable with
cash at a fixed price — skip-the-grind, for cosmetics only. Freezes and chests
are never dual-track.

Never (same register as "never gate the ledger"):

- **Selling coins for cash.** Re-examined 2026-07-17 ("real money → coins →
  freeze/themes/skins?") and rejected again, with the mechanism recorded:
  (1) **every coin price becomes a hidden cash price** — a 300-coin freeze
  *is* a ~₹25 freeze laundered through a conversion rate, which is precisely
  why games sell currency instead of items; (2) **it flips the earn-rate
  incentive** — today generous earning is good (it drives retention, the
  system's whole job), but once coins are sellable every free coin is lost
  revenue, and you're structurally pushed to make earning grindy so buying
  feels necessary; (3) **it transitively sells freezes for cash** — you can't
  have purchasable coins and a coin-priced freeze without breaking the
  habit-protection never below. Duolingo counterexample acknowledged: they
  sell gems and freezes profitably — at 500M-user scale, in a language app. A
  finance-discipline app selling impulse-priced currency undercuts its own
  premise, and FLO's revenue engine is Pro, not micro-spend. Coins stay
  earned-only, forever.
- **Selling streak freezes/repairs for cash.** Charging users to protect the
  habit you built for them is the predatory dark pattern this app's whole
  voice argues against.
- **Loot boxes / gacha / any randomized purchase.** See Rejected.
- **Anything functional.** The gamification layer must never gate or
  accelerate the actual product.

---

## The promo card — and the ads decision

Settled 2026-07-17. The user's instinct: one big card below the hero card (or
below the graph), never crowding the app with ads. The design that holds:

**Build the slot as fill-agnostic infrastructure.** One card-sized component,
one placement below the Home hero card. Dismissible, frequency-capped,
**never shown to Pro users** — that part is permanent regardless of fill.

**At launch it shows house content, not ads:**

- Pro upsell at the moment of proof ("We found something in your spending —
  see it with Pro" — the subscription doc's own best paywall placement,
  which needs a home; this is it)
- Seasonal event announcements ("Diwali theme is live — log 15 days to keep
  it") — the seasonal mechanic needs this surface anyway
- Feature discovery ("30 transactions by hand — did you know about
  share-import?")
- Insight teasers (free sees the headline, Pro sees the why)

**External ads (AdMob native unit) are approved for later, not launch** — a
sequencing decision, not a rejection. Why not at launch: (1) brand tension —
an ad is an impulse-purchase machine inside a spending-discipline app, and
users' unease about "is my financial data feeding these ads" doesn't require
the app to actually read anything; (2) the math — Indian native-ad eCPMs run
~$0.5–1.5, so one tasteful card below thousands of DAU earns pennies while
adding churn pressure on the exact habit loop the whole strategy depends on;
(3) at launch there's zero retention/conversion data, and ads poison both
measurements. **The revisit threshold: real DAU in the thousands + proven
week-4 retention.** At that point drop an AdMob native unit into the same
slot — no redesign — and "Pro removes ads" joins the Pro pitch.

Policy note: the notification-listener/ad-SDK conflict (Play prohibits
sensitive-permission data being used for ads) applies only to the `full`
variant — which ships by sideload, never through Play. The store build is
`lite`, so ads have **no policy blocker** there; the launch decision above is
purely product, not compliance.

---

## Data model sketch

Fits the everything-is-derived philosophy: an **append-only ledger with a
derived balance**, mirroring `transactions` → `v_global_summary`.

- **`reward_events`** — `id`, `user_id` (**`DEFAULT auth.uid()`**, per the
  standing rule), `kind` (`'earn'`|`'spend'`), `source`
  (`'daily_log'`|`'milestone'`|`'quest'`|`'budget_kept'`|`'chest'`|
  `'shop_freeze'`|`'shop_theme'`|…), `amount` (int, positive), `ref` (text —
  the idempotency key: `'2026-07-17'` for a daily log, `'milestone:30'`,
  `'quest:2026-W29:log5'`), `created_at`. **Unique `(user_id, source, ref)`**
  is what makes every earn claimable exactly once. RLS same as everywhere.
- **`v_coin_balance`** — earns minus spends, grouped by user.
  `security_invoker = true` (standing rule).
- **Inventory is derived** from spend/chest rows (`ref` names the item).
  Equipped state (which theme is active, which confetti) is a small
  `profiles.equipped` jsonb or tiny table — **DB, not AsyncStorage**:
  cosmetics must survive reinstall and follow the user across devices.
- **Freeze consumption** is an event row (`source: 'freeze_used'`,
  `ref: <date>`). `computeStreak` stays pure — the hook feeds it frozen dates
  as covered days alongside transaction days.
- Trophies: no storage, fully derived (plus the AsyncStorage "seen" flag).

---

## Open decisions before this graduates

1. **The no-spend wrinkle.** ~~The streak counts transaction rows by
   `created_at`; a frugal no-spend day breaks it.~~ **Resolved 2026-07-19** —
   see "The daily loop" above. A **declared** no-spend day (an explicit
   acknowledgement tap → `reward_events` row, `source: 'no_spend'`) covers the
   day for the streak and earns XP but **zero coins**; `computeStreak` stays
   pure and takes covered dates (transactions + declared no-spend + freezes) as
   a second input. No-spend quests are unblocked.
2. **Launch before or after mascot art?** Recommendation: **before** — the
   freeze + trophies + card themes are a real item pool without a single new
   art asset. Mascot skins slot in whenever art exists.
3. **Milestone ladder past 100** — 200 / 365 ("the year", the Platinum
   moment) / 500 / 1000. Cheap to extend; decide when the trophy room is
   designed so the ladder and the room agree.
4. **Coin-number tuning** — the table above is ratios, not gospel; tune once
   real usage exists.

## Suggested implementation flow — quick wins first

Not a phased feature doc (that comes when this graduates); this is the
*ordering*, chosen so every step ships something a user sees, the art-gated
work sits last, and nothing early gets thrown away later. Sequencing note
(**revised 2026-07-17** — supersedes the earlier "gamification before
subscription" lean): this whole track slots **after the store release**, and
the store release now ships **with the free/Pro split live from day one**
(see `IDEAS-subscription-and-store.md` Part 3 for the master sequence:
AI/Edge-Function → pricing → sub screens → launch → *then* this track).
Retention pays proportionally to user count — resist pulling the trophy room
earlier just because it's cheap.

0. **The ritual: "close the day" + `reward_events` + Money Level** — moved to
   the front 2026-07-19 (see the reframe section). This is the piece that turns
   FLO from a gamified chore into a daily ritual, and it builds the append-only
   ledger every later step rides on. Slice = the close-the-day acknowledgement
   (incl. the no-spend declaration), the ledger + `v_coin_balance` + XP column,
   covered-dates-aware `computeStreak`, a `lib/rewards.js` level curve, and Home
   wiring (real coin chip + Money Level in the reserved `welcomeSubtitle` slot).
   No art, no cosmetics yet. The streak freeze (originally step 3) now rides the
   *same* covered-dates pipe this builds, so it becomes a small follow-on rather
   than its own lift.
1. **Trophy room** — the highest selling-point-per-effort item in this doc.
   No economy, no new tables, no art (Lucide icons); everything derivable
   from existing streak/budget/plan data. A visible new screen in days, and
   it makes the existing milestones feel permanent.
2. **Promo card slot (house content)** — small component, needed anyway by
   the seasonal mechanic and the Pro upsell. Building it early gives every
   later step (seasonal events, Pro launch) its announcement surface.
3. **`reward_events` + coins + streak freeze** — the actual game loop: the
   append-only ledger, balance view, a simple shop sheet, and the
   freeze-aware streak. The freeze is the anchor item and needs zero art.
4. **Weekly quests** — rides the same ledger (claims are just earn rows);
   deterministic client-side rotation, no server.
5. **Card themes** — first real cosmetic sink; hero card reads a theme
   object from tokens. Ship a handful of shop themes + one chest-exclusive
   design ready for step 6.
6. **Milestone chests** — once chest-exclusive items exist to put in them
   (Gold Card at day 100 is the flagship).
7. **Seasonal theme events** — machinery from steps 2 + 5 (announcement card
   + theme system + an earn-to-keep quest from step 4). First real festival
   on the calendar after it's ready.
8. **Mascot skins + avatar bundles** — art-gated (same blocker as `05`
   Phase 5); everything above ships without a single new art asset. Slots in
   whenever Koban art lands.
9. **IAP (dual-track cosmetic packs, Pro cosmetic line)** — not until there
   are users (per the subscription doc), and then only the lanes above.
10. **External ads in the promo card** — data-driven, at the threshold in the
    ads section, if Pro alone isn't carrying monetisation.
