# 01: `streak_marks` table and a streak reader that reads both stores

Spec: .claude/features/34-streak-only.md

**What to build:** Streak days get their own small store, separate from the economy's ledger, without losing any history.
- A new `streak_marks` table: `user_id` (`DEFAULT auth.uid()`, cascade on user delete), `day` (local date), `kind` (`no_spend` | `freeze_earned` | `freeze_used`), `created_at`. `UNIQUE (user_id, kind, day)`, RLS on, owner-only.
- The streak reader counts a day as covered when it has a transaction created that day, a `no_spend` mark, or a `freeze_used` mark. It **also** reads the legacy `reward_events` no-spend and freeze rows, so existing history still counts.
- Milestones become `[7, 30, 100, 365]`. Day 1 ("streak started") stays its own state.

No migration touches `reward_events` or any economy table. Legacy rows are read, never converted.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `streak_marks` exists with the columns, unique key and owner-only RLS above (checked via the Supabase MCP)
- [ ] Seeded `no_spend` and `freeze_used` marks for the test user cover their days in the streak count and calendar
- [ ] Legacy `reward_events` no-spend and freeze rows still cover their days
- [ ] The main personal account's streak number is unchanged, and its `reward_events` rows are untouched
- [ ] Only days 7, 30, 100 and 365 count as milestones; day 1 is still reported as a new streak

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
