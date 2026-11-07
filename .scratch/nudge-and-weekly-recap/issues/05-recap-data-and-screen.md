# 05: Recap data and the recap screen

Spec: .claude/features/39-nudge-and-weekly-recap.md

**What to build:**
- **One pure recap module** for a closed week (Monday to Sunday, local time), and the same for a calendar month. It returns:
  - the total spent vs the period before;
  - the top 3 categories with their changes;
  - **one observation,** chosen by fixed rules in priority order:
    1. the largest category increase vs its 4-week average, above a threshold;
    2. otherwise the biggest decrease;
    3. otherwise "steady week";
  - the streak at the period's end.

  Keep it free of React Native imports so the recap push (06) can use it. Reuse the existing category breakdown and delta helpers where they fit.
- **The recap screen:** a route featuring Koban in the `report` pose (glasses and report), the numbers above, and a Week/Month switch. Monthly is in-app only.
- **Entry for now:** a link from Insights, so the screen can be checked before spec 38 ticket 10 adds the Home card.
- **Analytics:** opening the screen records `recap_viewed` (spec 33).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] For a seeded week, the totals, the top 3 and their changes match the transactions (MCP against the screen)
- [ ] Each observation rule is reached: an increase, a decrease, a steady week
- [ ] A week with no spending shows a sensible empty state, not zeros and NaN
- [ ] Month mode covers the last closed calendar month
- [ ] Koban's report pose plays, and nothing moves with Reduce motion on
- [ ] `recap_viewed` rows land with consent on
- [ ] Checked in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
