# 08: Home body: Today strip, 7-day chart, recent rows, bills

Spec: .claude/features/archive/38-home-insights-more.md

**What to build:** Below the hero, Home shows in order:

1. **The Today strip.** It replaces TodayCard's receipt and XP framing, and shows:
   - logged today ✓ or not;
   - **+ Log**, which opens the Add sheet;
   - **No spend today**, which writes the spec 34 mark;
   - a small Koban.
2. **The 7-day chart.**
   - It has no range toggle, and its ticks are whole rupees.
   - Tapping it opens Insights on Week.
   - With no data, it shows "Log a few days to see your week" instead of axes.
3. **Recent transactions.** Five rows, each with:
   - the note or merchant as the title, falling back to the category;
   - category · date as the subtitle;
   - the amount with its sign and label.
4. **Upcoming bills.** Only bills due within the reminder window; nothing when none are due.

ReportReadyCard is removed. The recap card slots in after the chart in 10.

**Blocked by:** 06 (Home header and hero with skin slot), 07 (Insights: Analytics with Reports folded in)

**Status:** ready-for-agent

- [ ] Home order top to bottom: hero, Today strip, chart, recent transactions, bills, in an empty and a populated account
- [ ] + Log opens the Add sheet; No spend today writes the mark (MCP) and the strip shows ✓
- [ ] Empty account shows the chart's text empty state; tapping a populated chart opens Insights on Week
- [ ] A transaction with a note is titled by the note, with category · date underneath
- [ ] Bills section appears only with a bill due in the window
- [ ] No ReportReadyCard; checked in light and dark

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- **Home order:** header, hero, Today strip, 7-day chart, recent transactions, upcoming bills.
- **Today strip** (new `components/TodayStrip.js`, replacing `TodayCard`):
  - a 44px Koban whose mood follows the day (happy when logged, content when no-spend, neutral when open);
  - "Logged today" / "No spend today" with a check, or "Nothing logged yet today";
  - **+ Log** opens the Add sheet;
  - **No spend today** (with the same confirm dialog) shows only while the day is open, and writes the spec 34 mark.
  - Shown all day, not only after the evening reminder time.
  - `TodayCard.js` and `lib/koban.js`'s `todayCardCopy` are deleted.
- **7-day chart:**
  - fixed at `7d` with no range tabs;
  - the whole card opens `/insights?period=week`;
  - an all-zero week shows "Log a few days to see your week".
  - Axis ticks are whole rupees everywhere: `niceAxisMax` uses whole-number steps below 10, so no ₹1.5 or ₹4.5.
- **Recent transactions:**
  - 5 rows;
  - title is the note, falling back to the category. There's no merchant column, and a parsed share import doesn't save the merchant anywhere yet (spec 40's territory), so only a note can title a row today;
  - subtitle is category · date;
  - the signed amount is unchanged.
- **Upcoming bills** moved below recent transactions and still renders nothing when none are overdue or due soon.
- ReportReadyCard left in 07.
- Open (emulator checks paused): order in an empty and a populated account, the No spend mark (MCP), the chart empty state and its tap, a note-titled row, the bills section's appearance, light and dark.
