# 02: Bill detail fixes and one due wording

Spec: .claude/features/archive/49-quiet-ledger-moments-and-the-rest.md

**What to build:** The two leftovers from spec 48's review, plus the shared due wording that ticket 03 reuses. Spec 49 §Bill detail fixes.

- The bill-detail hook reports `{ bill, payments, loading, error, missing }`. `missing` is true only when the fetch succeeded and found no row; only then does the screen go back. A fetch error shows a danger `Callout` "Couldn't load this bill" with Retry (refetch), keeping the header. No id in the route goes back at once.
- One pure function in the bill grouping module gives the date phrase ("Due 12 Nov", "Due today", "Overdue since 9 Nov"). The Bills list sub, the detail band's terms and the timeline's open step all use it, with their current outputs kept exactly.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The check script covers the shared due wording, and the existing bill grouping and timeline checks still pass unchanged
- [x] With the emulator's network off, a bill detail shows the error and Retry; with it back on, Retry loads the bill
- [x] A deleted bill's detail still goes back
- [x] A bill link with no id goes back instead of loading forever
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-14 (resolved): `dueWording(nextDueDate, today)` in the bill grouping module ("Due 14 Nov" / "Due today" / "Overdue since 7 Nov" in danger; 4 checks, 470 passing). The list's sub and the timeline's open step use its text; the band's terms keep "Next due 7 Nov" (spec 48's terms, and spec 49 says existing outputs stay exactly) and take only its tone. All the old bill and timeline checks pass unchanged.
- `useBillDetail` now returns `error` and `missing`: `missing` only when the read worked and found no bill, or there's no id; `error` when a read (bill or payments) failed and there's no bill on screen, with Retry. A failed refresh of a bill already shown keeps it. Review fixes: only the newest request writes (Retry or a refresh mid-read), a thrown fetch becomes an error instead of loading forever, and a new id resets the state.
- Checked on Pixel_API_36: with the network off, Netflix and Electricity show "Couldn't load this bill" (light and dark); with it back on, Retry loads them. A non-existent bill id goes back to Bills. Bill detail in dark mode, which spec 48 left unchecked, looks right. Not checked on device: a link with no id at all (expo-router's `[id]` route always carries a segment); the hook handles it by going back.

