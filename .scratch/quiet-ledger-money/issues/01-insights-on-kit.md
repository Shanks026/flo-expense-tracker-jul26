# 01: Insights on the kit

Spec: .claude/features/48-quiet-ledger-money-screens.md

**What to build:** Insights reads as one answer first: "You spent ₹X" with a comparison under it, then a spending line chart with y-axis numbers, then where the money went. Every Insights feature stays (periods, accounts, CSV, budgets, biggest transaction, Pro gates). Spec 48 §Insights, §Activity link, §New kit pieces (`SpendChart`).

- `SpendChart` joins the kit (and the kit gallery): line plus `accentSoft` fill, y-axis numbers inside the gutter, day initials (Week) or first and last day (Month, Custom), one ≥48 dp tap column per day showing that day's total above the chart.
- The headline and comparison come from a pure rule in `lib/` (less / more / about the same under 5 % / none when the prior period is zero; prior label per mode).
- Week | Month | Custom as `Segmented`, the inline period stepper, and the account `Chip` opening a `Sheet` replace the old period control and chip row.
- "Where it went": ranked `ListRow`s with a thin tinted bar, %, and the existing delta; tapping one opens Activity filtered to that category, period and account. Activity gains initial filters from route params, applied once.
- Received / Net saved / Savings rate as one row of stats; Budgets as rows with `ProgressBar` and "Frequently over"; Biggest transaction as one `TransactionRow`.
- Before starting: check whether the old analytics module imports anything React Native; move what the check script needs into a pure module if so.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The check script covers the headline: zero spend; less, more and about the same (the 5 % edge); prior zero → no comparison; the prior label for Week, Month and Custom; the paise rule
- [x] Week, Month and Custom each show the headline, the chart with y-axis numbers, and correct axis labels; forward is disabled past today
- [x] Tapping a chart day shows its total; an empty period shows the empty state, not a flat chart
- [x] Tapping a category opens Activity with that category, period and account applied; the chips then work as normal
- [x] Account sheet, mixed-currency callout, CSV export, Home's "Last 7 days" link (opens Week) and pull-to-refresh all still work
- [x] Skeletons while loading, never ₹0
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-12: built and checked on Pixel_API_36 with the shared test account (light and dark; put back to Light, Personal active). Check script 330 cases (new groups: insights headline, axis, category change, prior range, activity link).
  - **Built:** `SpendChart` (kit gallery has a week and a month sample); `lib/insights.js` (`spendHeadline`, `spendAxis`, `axisLabel`, `categoryChange`, `priorRange`); Activity applies `filtersFromLink` once per `at`; Insights on `LargeTitle` + `HeaderIconButton` like Activity (a tab, so no back button).
  - **Asked for by the person during the ticket:** empty-state `Illustration` small 72 → 48 dp (gap 16 → 12); new `ledgerRadius.field` (full capsule) on Segmented and single-line inputs (sign-in, Activity search, quick-add line, Add sheet Note, onboarding account name), redesign plan §2.4 amended; `Segmented` `plain` (text only, ink selected, muted others) for Spent / Received; in "Where it went" the share sits beside the amount and the change is the sub ("↑138 % vs October", "None in October", "None last week"); the account chip stays as it is.
  - **Found while checking, fixed:** future days in a week in progress get no line; no chart and no empty state when nothing was spent (the headline says it); bars use the category's deeper shade (lime was loud); stats at 16 dp so three fit; Received green and a negative savings rate as "−935 %" in danger; budget rows only use budget periods wholly inside the fetched span (a monthly budget in Week view counted one week as its month); "Frequently over" reads the period before too; the comparison period is calendar-aware (November vs all of October, it was 2–31 Oct) in `useAnalyticsData`; the chart clears its marked day when the period changes and TalkBack hears the exact amount; Uncategorized doesn't link (Activity has no uncategorized filter).
  - **Not checked / deviations:** custom date pickers not driven (the chips open them; the default 7-day range was checked); "Frequently over" not seen live (the test budgets were created in November, so no October period); the account sheet shows no crown on locked rows (billing is off, every row is open); the chart is one tap target picking the nearest day, so Month columns are ~10 dp wide rather than 48; the fill is an `accent` gradient rather than flat `accentSoft`; the y-axis takes 40 dp inside the content, not the 20 gutter. Review: two agents (standards, spec); the findings above were fixed, the rest are judgement calls (a shared period descriptor, magic sizes in Segmented plain).
