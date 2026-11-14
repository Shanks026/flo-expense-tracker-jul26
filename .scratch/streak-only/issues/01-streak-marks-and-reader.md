# 01: `streak_marks` table and a streak reader that reads both stores

Spec: .claude/features/archive/34-streak-only.md

**What to build:** Streak days get their own small store, separate from the economy's ledger, without losing any history.
- A new `streak_marks` table: `user_id` (`DEFAULT auth.uid()`, cascade on user delete), `day` (local date), `kind` (`no_spend` | `freeze_earned` | `freeze_used`), `created_at`. `UNIQUE (user_id, kind, day)`, RLS on, owner-only.
- The streak reader counts a day as covered when it has a transaction created that day, a `no_spend` mark, or a `freeze_used` mark. It **also** reads the legacy `reward_events` no-spend and freeze rows, so existing history still counts.
- Milestones become `[7, 30, 100, 365]`. Day 1 ("streak started") stays its own state.

No migration touches `reward_events` or any economy table. Legacy rows are read, never converted.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] `streak_marks` exists with the columns, unique key and owner-only RLS above (checked via the Supabase MCP)
- [ ] Seeded `no_spend` and `freeze_used` marks for the test user cover their days in the streak count and calendar
- [ ] Legacy `reward_events` no-spend and freeze rows still cover their days
- [ ] The main personal account's streak number is unchanged, and its `reward_events` rows are untouched
- [ ] Only days 7, 30, 100 and 365 count as milestones; day 1 is still reported as a new streak

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- Migration `streak_marks` applied after the person approved it. Checked via the MCP in a rolled-back transaction: a duplicate (user, kind, day) is rejected, inserting for another user is blocked by RLS, and another user sees 0 rows. The security advisors show nothing new.
- `hooks/useStreak.js` reads `no_spend` and `freeze_used` marks from `streak_marks` as well as the legacy `reward_events` rows (same precedence: frozen wins over no-spend).
- `MILESTONES` is now `[7, 30, 100, 365]`. The old 12-step ladder lives on as `ECONOMY_MILESTONES` for `lib/rewards.js` and `lib/trophies.js`, so the flagged-off economy keeps its trophy tiers and rewards unchanged.
- Open (emulator checks paused): seeded marks showing in the streak count and calendar; milestone celebration on day 7 only.
- The person plans to wipe all users (including chrisaustin2001) and start fresh, so the "personal account unchanged" check no longer applies after that; the legacy read stays for any account that has old rows.
