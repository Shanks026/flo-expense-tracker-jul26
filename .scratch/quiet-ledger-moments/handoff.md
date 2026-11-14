# Handoff: Quiet Ledger Phase 5 (Moments and the rest)

Spec: `.claude/features/49-quiet-ledger-moments-and-the-rest.md`. Every decision in the spec 46–48 handoffs still holds (`.scratch/quiet-ledger/`, `.scratch/quiet-ledger-onboarding/`, `.scratch/quiet-ledger-money/`).

| Ticket | Blocked by | State | Commit |
|---|---|---|---|
| 01 Streak mark and milestone celebration | — | done (real queue path not seen on device) | see git log |
| 02 Bill detail fixes and one due wording | — | done | see git log |
| 03 Bills-due sheet | 02 | done (real queue path not seen on device) | see git log |
| 04 Share-usage ask and toast | — | done | see git log |
| 05 Alerts grouped | — | done (empty state and Due soon not seen on device) | see git log |
| 06 Streak screen | 01 | done (a lit count not seen on device) | see git log |
| 07 Ask FLO chat and Past chats | — | done (voice not checked) | see git log |
| 08 Cards (was Personalize) | — | ready | |
| 09 You tab | 08 | ready | |
| 10 Pro and upsell (flag off) | — | ready | |
| 11 Cleanup | 01–10 | ready | |

**Decided while planning (2026-11-14):** the same two test seams (the check script plus an emulator check per ticket); the economy screens are left as they are, and the cleanup keeps the old tokens, theme context and Manrope while they import them. No migration in this phase.

**Suggested order:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, then 11.

**Decided 2026-11-14 (ticket 01):** the celebration's seven-day row runs oldest → today, like the Streak calendar (the person kept it).

**Kit previews (Settings → Developer → Kit):** "Show the 7-day celebration" (ticket 01) and "Show the bills-due sheet" (ticket 03, over the account's real bills) and "Show the share-usage ask" (ticket 04; its answers are real, and it skips itself while sharing is on) check the moments without the queue, which shows each at most once. The Toast row fires a success, an error and a plain toast.

**For ticket 11:** keep `budgetStatus` in `hooks/useBudgets.js`; Insights' "Frequently over" (`lib/analytics.js`) still uses it.

**Decided 2026-11-14 (ticket 07):** the person's question bubbles in Ask FLO are fully rounded (all corners), not with a tight corner. `BreakdownTable` is already deleted.
