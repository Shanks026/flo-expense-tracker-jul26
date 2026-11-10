# 05: Salary-day month

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** A summary period that restarts on the person's salary day every month.

- **Database** (apply only with the person's yes; record it in `00-index.md`'s migrations table): add `profiles.reset_month_day` (smallint, 1–31), and add `salary_day` to the `reset_period` check. The SQL is in spec 47 §Database.
- **The period rule** in `lib/` gains `salary_day`: the current period starts on the most recent salary day on or before today. A day past the month's end means its last day (31 → 30 Apr, Feb 28/29). The phrase reads "since 25 Oct".
- **Settings → Summary period** gains "Salary day" with a day picker; it writes `reset_period` and `reset_month_day` together.
- Home's "in · out" line and the account totals already follow the summary period, so they follow salary day with no further change. Only the client reads `reset_period` (checked 2026-11-11).

**Blocked by:** None (can start immediately; the migration needs the person's yes first)

**Status:** ready-for-agent

- [ ] The check script covers the period start: mid-month, on the day, the day before, day 31 in a 30-day month, February (leap and non-leap), across a year boundary; and the phrase
- [ ] The migration is applied with the person's yes and recorded in 00-index.md
- [ ] Choosing Salary day 25 in Settings changes Home's line to "since 25 Oct" and the totals to match (confirm against SQL)
- [ ] Switching back to Monthly restores the calendar month
- [ ] Emulator check in light and dark (put the test account's period back afterwards)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
