# 02: Bill detail fixes and one due wording

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The two leftovers from spec 48's review, plus the shared due wording that ticket 03 reuses. Spec 49 §Bill detail fixes.

- The bill-detail hook reports `{ bill, payments, loading, error, missing }`. `missing` is true only when the fetch succeeded and found no row; only then does the screen go back. A fetch error shows a danger `Callout` "Couldn't load this bill" with Retry (refetch), keeping the header. No id in the route goes back at once.
- One pure function in the bill grouping module gives the date phrase ("Due 12 Nov", "Due today", "Overdue since 9 Nov"). The Bills list sub, the detail band's terms and the timeline's open step all use it, with their current outputs kept exactly.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The check script covers the shared due wording, and the existing bill grouping and timeline checks still pass unchanged
- [ ] With the emulator's network off, a bill detail shows the error and Retry; with it back on, Retry loads the bill
- [ ] A deleted bill's detail still goes back
- [ ] A bill link with no id goes back instead of loading forever
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
