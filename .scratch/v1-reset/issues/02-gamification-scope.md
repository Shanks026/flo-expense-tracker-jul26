# Gamification scope: streak-only vs keep some economy

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 

## Question

What survives of the game layer in v1?

The audit proposes keeping only a streak plus auto-earned freezes. Everything else goes behind a flag set to off: coins, XP/ranks, trophies, the spin wheel, the shop, coin packs, card themes, Personalize, and the welcome bundle.

Grill:
- Is streak-only right, given Duolingo is a reference app?
- Are freezes auto-earned, or dropped entirely?
- Does any reward remain?
- What is the **moment queue** rule? The audit proposes at most one full-screen takeover per session. Which moments, and in what priority?

Refs: audit §1 (economy, moment queue), §4 P0 gamification chrome, §5 retention mechanics.

## Answer

Grilled with the user on 2026-10-18.

**1. What survives: the streak only.** It comes with automatic freezes and a few milestone moments. Everything else in the **economy** is **flagged off**: coins, XP/ranks, trophies, the spin wheel, the Shop, card themes, coin packs, the rewards hub, the welcome bundle, RewardBurst and rewards history. Duolingo is a reference for the streak's pull, not for its economy.

**2. Streak freezes:**
- one is earned automatically per 7-day run, with at most 2 held;
- they are spent automatically on a missed day, with a "We saved your streak" note;
- no purchase, no prompt. `FreezePrompt` and the 3,000-coin price go.

**3. Milestones are 7, 30, 100 and 365.** Day 1 keeps its own "streak started" celebration. The streak screen's count and calendar are unaffected.

**4. "Flagged off"** means a static build-time switch in one `lib/features.js`:
- the UI is hidden and nothing new is written;
- existing rows stay, and nothing is deleted;
- no remote flags.

**5. Existing data:**
- The main personal account (chrisaustin2001) must not lose or change any data.
- Test accounts and the docs may be altered freely.
- No migration, and no refunds.

**6. Moments and their priority:**
- **Full-screen moments:** only day 1 and the milestones.
- **Bills-due modal:** wins over a celebration, because it asks for action.
- **"We saved your streak":** a toast, never a takeover.

**7. The moment queue:**
- one queue that shows one moment at a time;
- at most 1 full-screen takeover per app session, and at most 2 per day;
- never during onboarding, and never while the Add sheet is open;
- anything not shown waits for the next session rather than stacking.

The weekly recap (ticket 06) plugs into this queue.

**8. A streak day** is a day the user logged anything, counted by when the entry was created, not its transaction date. That keeps today's rule: backfills count for the day they're entered.

**9. Both builds flag the economy off,** personal included. It's one product, and the data stays either way.

**Inputs to other tickets:**
- **Home (05):** one quiet streak indicator, no economy chrome.
- **Onboarding (03):** no welcome bundle, no RankUp "Saver".
- **Design language (04):** card themes are gone.
- **Notifications (06):** nudge copy may reference the streak, and the milestone tier follows the new 4-item milestone list.

Glossary: flagged off, streak, streak freeze, milestone, moment, economy.
