# 08: Home body: Today strip, 7-day chart, recent rows, bills

Spec: .claude/features/38-home-insights-more.md

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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
