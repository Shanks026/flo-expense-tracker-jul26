# 05: Salary-day month

Spec: .claude/features/archive/47-quiet-ledger-onboarding.md

**What to build:** A summary period that restarts on the person's salary day every month.

- **Database** (apply only with the person's yes; record it in `00-index.md`'s migrations table): add `profiles.reset_month_day` (smallint, 1–31), and add `salary_day` to the `reset_period` check. The SQL is in spec 47 §Database.
- **The period rule** in `lib/` gains `salary_day`: the current period starts on the most recent salary day on or before today. A day past the month's end means its last day (31 → 30 Apr, Feb 28/29). The phrase reads "since 25 Oct".
- **Settings → Summary period** gains "Salary day" with a day picker; it writes `reset_period` and `reset_month_day` together.
- Home's "in · out" line and the account totals already follow the summary period, so they follow salary day with no further change. Only the client reads `reset_period` (checked 2026-11-11).

**Blocked by:** None (can start immediately; the migration needs the person's yes first)

**Status:** resolved

- [x] The check script covers the period start: mid-month, on the day, the day before, day 31 in a 30-day month, February (leap and non-leap), across a year boundary; and the phrase
- [x] The migration is applied with the person's yes and recorded in 00-index.md
- [x] Choosing Salary day 25 in Settings changes Home's line to "since 25 Oct" and the totals to match (confirm against SQL)
- [x] Switching back to Monthly restores the calendar month
- [x] Emulator check in light and dark (put the test account's period back afterwards)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: built and checked on Pixel_API_36 (account `FLO_ONB04_*`, light and dark). Migration `quiet_ledger_onboarding_salary_day_month` applied with the person's yes. Five periods no longer fit a Segmented, so Summary period is now a row that opens `SummaryPeriodSheet` (a choice list); picking Salary day with no day saved goes on to the day grid, so both columns are written together. `components/ledger/DayOfMonthPicker.js` (in the kit gallery) is there for ticket 06. Review (two agents): no hard violations or spec gaps; fixed the stale 00-index status, a raw padding value, and Home's phrase drifting from its totals past midnight (the phrase now uses the start the totals were fetched with). Left as judgement calls: a per-period map in `lib/periods.js`, and the local forwardRef sheet instead of a provider (as ActivityFilterSheet does). `resetPeriodStart`/`resetPeriodPhrase` now take one period object (`periodFromProfile`). Not checked: the totals at a real period boundary on the device (the account's only entry is today's, so every salary day includes it; the boundaries are covered by 25 cases in `ledger-check.mjs`, 250 in all). The account was put back to Monthly with `reset_month_day` null.
