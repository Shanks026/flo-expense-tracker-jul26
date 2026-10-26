# 07: Insights: Analytics with Reports folded in

Spec: .claude/features/38-home-insights-more.md

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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
