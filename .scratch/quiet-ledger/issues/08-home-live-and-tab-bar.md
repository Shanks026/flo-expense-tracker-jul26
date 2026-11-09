# 08: Home goes live, with the new tab bar

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** The real Home switches to the Quiet Ledger layout already tried out in the Home preview, and the tab bar is restyled to match.

- **Order:**
  1. the greeting header, with three circle icons: streak, Ask FLO and the bell;
  2. the account card carousel;
  3. the balance block: "In hand", a display amount, and "in · out this month";
  4. quick actions;
  5. the Today prompt;
  6. This week (WeekLine);
  7. Upcoming bills: at most 2, shown only when something is due;
  8. Recent activity: date-grouped, with See all opening Activity.
- **Loading:** existing read hooks only. The balance never shows ₹0 while loading, and the skeleton has the card's shape.
- **Count-up:** the balance counts up only on the first Home load of the local day. Reduce motion skips it.
- **Seasonal row:** a one-time, dismissible "New: <skin> card" row appears when a seasonal skin is live and not equipped. Dismissing it is stored on the device, per skin.
- **Prompts:** the Today prompt replaces the nothing-logged card. The + coach mark stays, and the streak-chip coach mark is dropped.
- **Date labels:** a pure function produces the date-group labels ("Today", "Yesterday", "Sat 7 Nov", with the year only when it isn't the current one), with check-script cases.
- **Tab bar:** an ink +, and the labels Home, Activity, Insights and You. The routes and long-press + don't change.
- **Flags:** respects the economy, plans, billing, themes and ai flags.
- The Home preview dev route is deleted. It holds the last call site of the deprecated `upper` helper in the ledger tokens (carried over from ticket 01); remove the helper with it.

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] Check script: the today, yesterday, this-year and other-year labels
- [ ] Home shows every block in order with the test account's real data. The bills block is hidden when nothing is due
- [ ] Swiping between accounts and the chevron switcher both work
- [ ] The Transfer tile shows only with 2+ accounts
- [ ] No spend marks the day and the prompt disappears; the flame fills
- [ ] Tapping a WeekLine day shows its total; the header opens Insights on Week
- [ ] Pull-to-refresh works; the count-up runs once per day
- [ ] The tab labels read Activity and You; long-press + opens the sheet listening
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
