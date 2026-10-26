# 03: Freezes are earned and spent automatically

Spec: .claude/features/34-streak-only.md

**What to build:** Users are protected from a single slip without buying or tapping anything.
- **Earning:** each completed 7-day run of consecutive covered days earns one freeze (`freeze_earned` mark), unless the user already holds 2.
- **Spending:** when the app computes the streak and finds a missed day with a freeze held, it writes `freeze_used` for that day. A gap of several days spends the freezes held, closest to today first. If they can't cover the whole gap, the streak resets and no freezes are spent.
- The earn and spend rules live in one pure streak module that takes the time as a parameter instead of reading the clock.
- A spent freeze shows a plain "We saved your streak" toast and tracks `freeze_used`. Ticket 06 later routes the toast through the moment queue.
- `FreezePrompt` and the manual coin-priced freeze are taken out of the flow.

Freezes held = `freeze_earned` marks minus `freeze_used` marks. Legacy `reward_events` freezes count as already used.

**Blocked by:** 01 (`streak_marks` table and a streak reader that reads both stores)

**Status:** ready-for-agent

- [ ] A seeded 7-day run writes one `freeze_earned` mark; a 14-day run with 2 held earns no third
- [ ] One missed day with 1 freeze held writes a `freeze_used` mark for that day, the streak continues, and the toast shows once
- [ ] A 2-day gap with 1 freeze held resets the streak and spends no freeze
- [ ] A `freeze_used` event is recorded (when analytics consent is on)
- [ ] `FreezePrompt` never appears, and no `reward_events` rows are written for freezes

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
