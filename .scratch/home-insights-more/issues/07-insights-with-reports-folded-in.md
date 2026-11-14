# 07: Insights: Analytics with Reports folded in

Spec: .claude/features/archive/38-home-insights-more.md

**What to build:** Insights is the one place for analysis:
- a single **Week / Month / Custom** period control, which can be opened directly on Week (Home's chart uses this);
- category breakdown;
- trend chart;
- budget progress;
- CSV export.

The Report screen and its settings are retired, and their logic moves into Insights. The Pro gates on custom ranges, the all-accounts view and CSV follow the `billing` flag. The recap summary at the top comes in 10.

**Blocked by:** 03 (Five tabs and the More screen)

**Status:** ready-for-agent

- [ ] One period control with Week, Month and Custom; every section follows it
- [ ] Opening Insights with a Week target lands on Week
- [ ] CSV export works for the selected period
- [ ] With `billing` off, custom range, all accounts and CSV are open; with it on, they gate as before
- [ ] No Report screen or report settings reachable anywhere
- [ ] Checked in an empty and a populated account, in light and dark

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- **Period control:** the new `components/InsightsPeriodControl.js` replaces `AnalyticsFilterBar`.
  - Week (Monday to Sunday) and Month step with arrows, and can't step into the future.
  - Custom has From/To pickers.
  - `/insights?period=week&at=<ts>` opens on this week; `at` makes a repeat tap land again.
- **One scroll** replaces the segment tabs (`AnalyticsSegmentTabs` deleted):
  - summary (Spent, Received, Net saved with deltas, savings rate);
  - trend chart;
  - "Where it went" (Spent/Received toggle, donut, accordion);
  - budget progress, only when budgets exist;
  - biggest transaction, titled by its note when it has one.
  - The daily-spending card and the transaction-count stats are gone; Home keeps the 7-day chart.
- **From Reports:**
  - the account chips (All accounts + each account; only with 2+ accounts);
  - the multi-currency guard on sums in the all-accounts view;
  - CSV export of the scope on screen.
- **Pro gates:** Custom, all accounts / another account, and CSV go through `hasPro`, so all are open while `billing` is off.
- **Retired:**
  - `components/ReportReadyCard.js`, `ReportPeriodPicker.js`, `hooks/useReportDue.js` and `lib/reports.js`;
  - the "report ready" bell alert;
  - Settings' Reports section;
  - Home's ReportReadyCard (ahead of 08).
  - `app/report.js` is now a redirect to Insights, because `send-push` still sends "Your weekly report is ready" with `data.route: '/report'` to every profile whose `report_cadence` isn't off. New sign-ups default to weekly. **That push should be switched off or replaced by spec 39's recap push.**
- Open (emulator checks paused): the three modes, a Week target from Home, export, empty vs populated account, light and dark.
