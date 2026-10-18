# FLO glossary

**v1** — the lean, retention-first release that goes to Google Play production. Defined by the v1-reset decisions, not by whatever happens to be on `master`.

**Lite build** — the store variant of FLO: never contains auto-detect. The only variant that is ever uploaded to Play.

**Personal build** — the variant that contains auto-detect. For the owner's own device only; never shipped, never hardened.

**Safe closed-test build** — the first lite build fit to start Play's closed test: auto-detect excluded and no price or Buy button shown. It need not contain the v1 reset; the reset reaches testers as later builds during the test.

**Koban** — FLO's mascot: a curious, helpful ginger tabby cat who stands on two legs.

**Money screen** — any screen whose job is showing the user's money (Home figures, transactions, budgets, reports). Ledger-calm: numbers first, no decoration.

**Character moment** — a screen or moment where Koban may appear: onboarding, empty states, coach marks, streak and milestones, the weekly recap. Never on top of a money figure.

**Daily nudge** — the one evening push (21:00 local by default), sent only on days with nothing logged; it backs off when ignored.

**Weekly recap** — Monday's rule-based summary of the previous week: total vs the week before, top categories, one observation, the streak.

**Flagged off** — a feature hidden from v1 by a build-time switch: its UI is not shown and it records nothing new, but its code and every row of existing data stay. Not the same as removed.

**Streak** — the run of consecutive days on which the user logged at least one entry or marked a no-spend day. The one game mechanic in v1.

**No-spend day** — a day the user explicitly marks as "nothing spent" with one tap. It counts as a streak day.

**Streak freeze** — protection for a single missed day. Earned automatically (one per 7-day run, at most 2 held) and spent automatically when a day is missed; never bought.

**Milestone** — a streak length worth a celebration: day 7, 30, 100 and 365. Day 1 ("streak started") is a celebration but not a milestone.

**Moment** — anything that interrupts the user unasked: a full-screen celebration, a modal or a toast. Moments go through one queue that shows one at a time, with at most one full-screen takeover per session.

**Onboarding** — the first-run flow from opener to Home: opener, Google, first expense, reminder ask. A user is *onboarded* once they reach Home; onboarded users never see onboarding again.

**Economy** — the flagged-off reward layer: coins, XP, ranks, trophies, spin wheel, shop, card themes, coin packs.

**Closed test** — Play's required pre-production track: at least 12 testers opted in for 14 consecutive days before production access can be requested.
