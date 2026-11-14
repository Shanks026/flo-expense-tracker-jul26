# 11: Cleanup: delete what nothing imports

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** Delete the old components the redesign retired, once nothing imports them. Spec 49 §Cleanup.

- Candidates (spec 49 lists them): the Insights pieces retired in spec 48, the old due-bills card, `Confetti`, `PersonalizePreview`, the old flame cells, and the old shared pieces (`Card`, `IconTile`, `Pill`, `BackButton`, the old `Button`, `EmptyState`, `ProgressBar`, `Row`/`RowGroup`, `SegmentedChoice`, `Screen`, `Skeleton`, `FadeIn`, `IconButton`), plus dead helpers (the day-one recap copy, the old budget status rule and save toast if unused).
- A file goes only when a project-wide import search finds no importer; re-check after each deletion, since one deletion can free another.
- `theme/tokens.js`, the old theme context, Manrope and anything the economy screens use stay (economy left as is, 2026-11-14). Manrope unloads only if nothing references its family names; otherwise a comment names the economy as the reason.

**Blocked by:** 01–10

**Status:** done

- [x] Each deleted file had no importer at deletion time; the list of deleted files is in the ticket's comments
- [x] The check script passes
- [x] The app cold-starts and Home, Activity, Insights, You, Settings, Ask FLO, Cards, Streak and a bill detail each open with no red screen
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

**2026-11-14, deleted (each had no importer when it went; found by an import search re-run after each round):**
- Round 1: `components/BackButton.js`, `CategoryBreakdownAccordion.js`, `DailySpendingChart.js`, `DonutChart.js`, `EmptyState.js` (the old one), `FadeIn.js`, `IncomeExpenseChart.js`, `InsightsPeriodControl.js`, `Pill.js`, `Screen.js`, `StreakDays.js`, `StreakFlameIcon.js`.
- Round 2 (freed by round 1): `components/ChartAxis.js`, `IconButton.js`.
- Earlier tickets: `BreakdownTable` (07), `PersonalizePreview` (08), `ProBenefits` (10).
- `lib/koban.js`: the day-one and ordinary-day recap pools, `recapEyebrow` and `recapCta` went; the milestone pool stays as `MILESTONE_LINES`, read by `pickMilestoneLine` (was `pickRecap`). `streakHeadline` and `streakHero` stay.

**Kept, still imported:** `Confetti` (RankUpCelebration), `Card` and `IconTile` (join, trophies), the old `Button`, the old `ProgressBar` (RewardsHistorySheet), `Row`/`RowGroup` and `SegmentedChoice` (dev AI test set), `Skeleton` (Settings). `budgetStatus` stays (Insights' "Frequently over"). Manrope stays while `theme/tokens.js` uses it; the comment in `app/_layout.js` says so.

**Not on the candidate list, so left even though nothing imports them:** `components/CountUp.js`, `FreezePrompt.js`, `Logo.js`, `MilestoneSpinWheel.js`, `OnboardingScreen.js`, `PartyPopper.js`, `lib/categoryBank.js`, `lib/greetings.js`, `lib/pendingLoginReward.js`, `lib/reminderCopy.js` (its Deno twin in `supabase/functions/send-push` is live). Some are economy code, which stays as is.
