# 08: Home goes live, with the new tab bar

Spec: .claude/features/archive/46-quiet-ledger-foundations-and-core-loop.md

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
- **Seasonal row (deferred, see Comments):** a one-time, dismissible "New: <skin> card" row appears when a seasonal skin is live and not equipped. Dismissing it is stored on the device, per skin.
- **Prompts:** the Today prompt replaces the nothing-logged card. The + coach mark stays, and the streak-chip coach mark is dropped.
- **Date labels:** a pure function produces the date-group labels ("Today", "Yesterday", "Sat 7 Nov", with the year only when it isn't the current one), with check-script cases.
- **Tab bar:** an ink +, and the labels Home, Activity, Insights and You. The routes and long-press + don't change.
- **Flags:** respects the economy, plans, billing, themes and ai flags.
- The Home preview dev route is deleted. It holds the last call site of the deprecated `upper` helper in the ledger tokens (carried over from ticket 01); remove the helper with it.

**Blocked by:** 01, 02, 03

**Status:** resolved

- [x] Check script: the today, yesterday, this-year and other-year labels
- [x] Home shows every block in order with the test account's real data. The bills block is hidden when nothing is due (order and data checked; the hidden-bills case is code-only, the test account has bills due)
- [x] Swiping between accounts and the chevron switcher both work
- [x] The Transfer tile shows only with 2+ accounts (shown with 4 accounts; the 1-account case is code-only)
- [ ] No spend marks the day and the prompt disappears; the flame fills (not run: today already counts on the test account, so the prompt is hidden; the flame shows filled)
- [x] Tapping a WeekLine day shows its total; the header opens Insights on Week
- [x] Pull-to-refresh works; the count-up runs once per day (count-up seen from ₹0 after clearing the stored date, and the date was stored again)
- [x] The tab labels read Activity and You; long-press + opens the sheet listening
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-10: **Seasonal row deferred** on the person's call: the catalog has no seasonal availability window yet (Christmas is always available while gating is off), so "live" has no meaning. Pick it up with seasonal skins (plan §6 open item 1).
- **"In · out" period:** the totals come from `useAllAccountSummaries`, which follows Settings → Summary period, so the line is labelled by that period ("this month" for the default Monthly, "this quarter", "this year", "since 3 Nov"). The spec line says "this calendar month"; for Monthly they match. The hook now returns the period with the totals so the label can't disagree with them. The person agreed on 2026-11-10, and spec 46's story 39 and Home data line were amended to match.
- Date groups use `lib/dateLabels.js` (8 check cases). `occurred_at` is a date-only string, parsed as that local day. This machine is IST and Node ignores `TZ` on Windows, so the west-of-UTC case couldn't be run red here.
- Count-up: `hooks/useDailyCountUp.js`, stored as `flo.balanceCountUpDay`; the day is used only when the count starts. Reduce motion skips it (not run on device).
- Deleted: `app/dev/home-preview.js`, the `upper` helper, the Settings → Developer → Home preview row, `NothingLoggedCard`, `AccountHeroCarousel`, `AccountDots`, `useDayState`. The streak coach mark went with the old Home; the + coach mark is unchanged in `TabBar`.
- Checked on Pixel_API_36 (light and dark): every block in order, swipe and switcher, WeekLine day tap and header to Insights on Week, pull-to-refresh, long-press + listening, the count-up. Not run: No spend (today already counts), one account, no bills due, TalkBack. Two-agent review done; its date, count-up and period-source findings were fixed. Test account is back on Light, Personal active.
