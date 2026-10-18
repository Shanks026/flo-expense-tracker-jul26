# Streak only: economy flagged off, automatic freezes, moment queue

Status: ready-for-agent
Source: v1-reset map — [Gamification scope](../../.scratch/v1-reset/issues/02-gamification-scope.md), [v1 scope (no-spend day)](../../.scratch/v1-reset/issues/07-v1-scope-plans-splits-currency.md)

## Problem Statement

FLO's game layer is about a quarter of the code: coins, XP, 9 ranks, trophies, a spin wheel, a shop, coin packs, about 50 card themes, a rewards hub and a welcome bundle. It competes with the money for attention.
- A new user gets a pile-up of full-screen celebrations (rank-up, rewards, streak, spin wheel, freeze prompts).
- A freeze costs 3,000 coins, which is about 120 days of logging.
- None of it makes logging faster or more informative.

People who stick with an expense tracker want a calm money app. The one mechanic with a proven habit link is the streak.

## Solution

Keep only the **streak**:
- **Streak freezes** are earned automatically (one per 7-day run, at most 2 held) and spent automatically on a missed day, with a "We saved your streak" toast.
- **Milestones** are celebrated at 7, 30, 100 and 365 days, plus a day-1 "streak started" moment.
- **A one-tap "No spend today"** counts as a streak day.

Everything else in the **economy** is **flagged off**: hidden, nothing new written, and all existing data kept. Every interruption goes through **one moment queue** that shows one moment at a time, with at most one full-screen takeover per session.

## User Stories

1. As a user, I want my streak to count every day I log anything, so that the habit is rewarded simply.
2. As a user who genuinely spent nothing today, I want to tap "No spend today", so that my streak continues without a fake expense.
3. As a user, I want a no-spend day to stop that evening's reminder, so that I'm not nagged after telling FLO.
4. As a user, I want to earn a streak freeze automatically for every 7-day run, so that I'm protected without buying anything.
5. As a user, I want to hold at most 2 freezes, so that protection stays meaningful.
6. As a user who misses a day, I want a freeze spent automatically, so that one slip doesn't wipe my streak.
7. As a user whose streak was saved, I want a quiet "We saved your streak" toast, so that I know what happened without a takeover.
8. As a user, I want a celebration when I start a streak (day 1), so that my first log feels good.
9. As a user, I want celebrations only on day 7, 30, 100 and 365, so that they stay special.
10. As a user, I want to never see coins, XP, ranks, trophies, the spin wheel, the shop or card themes, so that FLO feels like a money app.
11. As a user, I want to never get a rank-up, trophy toast or reward burst, so that saving an expense is quick and calm.
12. As a user, I want at most one full-screen moment per app session and two per day, so that I'm never stuck tapping through popups.
13. As a user with bills due and a milestone on the same day, I want the bills shown first, so that the actionable thing wins.
14. As a user, I want no celebration during onboarding or while the Add sheet is open, so that moments never interrupt what I'm doing.
15. As a user, I want moments that didn't fit to wait for my next session rather than stack up, so that nothing is lost and nothing piles on.
16. As a user, I want a simple streak screen (calendar, freezes held, next milestone), so that I can see my progress at a glance.
17. As the owner of my main personal account, I want my existing coins, themes, trophies and history kept in the database, so that nothing is lost if the economy returns.
18. As the person running FLO, I want the economy hidden by build-time flags in one place, so that bringing a piece back is a one-line change.
19. As the person running FLO, I want both builds (store and personal) to flag the economy off, so that there's one product.
20. As the person running FLO, I want `streak_milestone` and `freeze_used` events tracked, so that analytics can tell whether the streak alone holds D7.

## Implementation Decisions

**Flags:** the build-time flags module (introduced in spec 32) gains **`economy: false`**. It covers coins, XP and ranks, trophies, the spin wheel, the shop (including coin packs), card themes, Personalize, the rewards hub and history, RewardBurst, the welcome bundle and RankUp. When off:
- no UI renders (header chips, Shop/Trophy/Personalize routes and entries, rewards sheets, burst overlays);
- **no new `reward_events` rows are written;**
- the code stays.

**Streak storage (new table).** Because freezes and no-spend days were stored in the economy's `reward_events` ledger, a small **`streak_marks`** table is introduced:
- columns: `user_id` (`DEFAULT auth.uid()`, cascade), `day` (local date), `kind` (`no_spend` | `freeze_earned` | `freeze_used`), `created_at`;
- `UNIQUE (user_id, kind, day)`, owner-only RLS.

The streak reader **also reads legacy `reward_events` freeze rows and no-spend rows**, so existing history, including the main personal account's, still counts.

**Streak rule (one module, pure):**
- a streak day is a local date with ≥1 transaction created that day **or** a `no_spend` mark;
- missed days in a run are covered by `freeze_used` marks;
- **freeze earning:** each completed 7-day run (counted on consecutive covered days) grants one `freeze_earned`, unless the holder already has 2;
- **freeze spending:** when the app computes the streak and finds a single missed day with a freeze available, it writes `freeze_used` for that day and enqueues the toast. Two or more missed days in a row spend up to the freezes held; otherwise the streak resets;
- **milestones** become `[7, 30, 100, 365]`. The day-1 moment remains a separate state.

**Moment queue (new provider):**
- A queue provider sits beside the toast provider. Sources `enqueue({ kind, priority, payload })` instead of rendering their own modals.
- **Priority:** actionable (bills due) > celebration (day 1, milestones) > ambient (toasts).
- **Caps:** 1 full-screen takeover per session, 2 per day.
- **Suppressed** while onboarding is active or the Add sheet is open.
- **Deferral:** unshown takeovers persist and replay next session; they are never stacked.
- **The bills-due modal** moves onto the queue. **StreakCelebration** becomes a queue moment, with no chained spin wheel. **FreezePrompt** is removed from the flow, because spending is automatic.

**No-spend UI:** the Home Today strip's "No spend today" button (placed in spec 38) writes a `no_spend` mark and calls `notifyChanged()`. Server push reads the mark for evening suppression (spec 39).

**Streak screen:** simplified to a calendar of covered days (logged / no-spend / frozen), freezes held (0–2), the current streak and the next milestone. The badge grid and trophy links are removed.

**Analytics:** `streak_milestone {days}`, `freeze_used` and `no_spend_marked` via `track` (spec 33).

## Testing Decisions

- **A good test** checks the visible streak count, the freeze count, which moment appears and when, and the rows written. Not internal function calls.
- **Seam 1, the emulator:**
  - log on day 1 to see the day-1 moment once;
  - mark no-spend and confirm the streak continues;
  - confirm no coin, XP, rank, trophy, shop or burst UI anywhere;
  - open the app with bills due on a milestone day and confirm bills first, then the celebration next session;
  - confirm nothing shows during onboarding or with the Add sheet open.
- **Seam 2, Supabase via MCP:**
  - seed `streak_marks` and transactions for a test user to simulate a 7-day run (freeze earned), a missed day (freeze used) and a 2-day gap with 1 freeze (reset), then check the app's numbers;
  - confirm no `reward_events` rows are written after the flag lands;
  - confirm the personal account's legacy rows are untouched.
- **Prior art:** the existing streak calculation in the streak module and hook, and feature 18's on-device ritual checks.

## Out of Scope

- **Deleting** economy code or data: flagged off only.
- **Seasonal card skins and the Store:** the first post-launch feature, and a different system (real money, the hero only).
- **Streak push copy:** spec 39.
- **The Home layout:** spec 38.
- **The Koban drawings in moments:** spec 37 provides the component.

## Further Notes

- **The main personal account's data must not change.** No migration touches `reward_events` or the economy tables.
- Legacy freeze rows are read, not converted.
- If analytics later show weak D7 with the streak alone, pieces of the economy can return by flipping a flag. That's the trigger recorded on the map.
