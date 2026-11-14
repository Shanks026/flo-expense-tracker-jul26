# Handoff: Quiet Ledger Phase 5 (Moments and the rest)

Spec: `.claude/features/49-quiet-ledger-moments-and-the-rest.md`. Every decision in the spec 46–48 handoffs still holds (`.scratch/quiet-ledger/`, `.scratch/quiet-ledger-onboarding/`, `.scratch/quiet-ledger-money/`).

| Ticket | Blocked by | State | Commit |
|---|---|---|---|
| 01 Streak mark and milestone celebration | — | done (real queue path not seen on device) | see git log |
| 02 Bill detail fixes and one due wording | — | ready | |
| 03 Bills-due sheet | 02 | ready | |
| 04 Share-usage ask and toast | — | ready | |
| 05 Alerts grouped | — | ready | |
| 06 Streak screen | 01 | ready | |
| 07 Ask FLO chat and Past chats | — | ready | |
| 08 Cards (was Personalize) | — | ready | |
| 09 You tab | 08 | ready | |
| 10 Pro and upsell (flag off) | — | ready | |
| 11 Cleanup | 01–10 | ready | |

**Decided while planning (2026-11-14):** the same two test seams (the check script plus an emulator check per ticket); the economy screens are left as they are, and the cleanup keeps the old tokens, theme context and Manrope while they import them. No migration in this phase.

**Suggested order:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, then 11.
