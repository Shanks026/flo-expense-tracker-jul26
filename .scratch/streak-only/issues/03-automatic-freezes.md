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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- `lib/streak.js` → pure `planFreezes({ coveredKeys, earnedKeys, held, now })` returns `{ toUse, toEarn }`; `MAX_FREEZES = 2`, `FREEZE_EARN_RUN = 7`. A gap is covered only when the freezes held cover all of it; otherwise the streak resets and nothing is spent. Earning counts 7 covered days from the run's start or its last earn mark (so a run longer than the 90-day fetch window can't earn again every day as the window slides).
- `hooks/useStreak.js` reads freeze marks all-time, exposes `freezesHeld` (earned − used, 0–2; legacy reward_events freezes count as used) and `freezePlan`. The plan is empty if any coverage read failed, so a failed read can never spend a freeze on a covered day.
- `lib/streakMarks.js` → `applyFreezePlan` (idempotent upserts). New headless `components/StreakFreezeSync.js` (a Stack sibling in `app/_layout.js`, replacing `<FreezePrompt />`) writes the plan, tracks `freeze_used` per day covered, shows "We saved your streak" once, and runs `notifyChanged()`.
- Checked with a throwaway Node script, 11 scenarios, all passing: a 7-day run earns on day 7, a 6-day run doesn't, no repeat earn, 14 days earns a second, no third at 2 held, 1 missed day with 1 held spends it, a 2-day gap with 1 held resets, a 2-day gap with 2 held spends both, logged today after a missed yesterday, no history, and a spent freeze that completes a 7-day run.
- **Judgement call to confirm:** frozen days count as covered days for earning (the spec says "consecutive covered days"), so a freeze that fills day 7 of a run earns one straight back. Say if earning should need a real logged or no-spend 7th day.
- **Left for ticket 07:** the streak screen's manual "use a freeze" action (`useFreezeRecovery` → `useFreezeForDates`) still writes `reward_events` with legacy coin-bought freezes. It's rarely reachable now, and 07 removes it. `components/FreezePrompt.js` stays in the tree, unmounted.
- Open (emulator checks paused): the toast and the streak numbers on a seeded account.
