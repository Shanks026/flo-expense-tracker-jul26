# Quiet Ledger Phase 4, Money screens (spec 48): handoff

Last updated 2026-11-12: tickets 01–03 done; the person asked to run 03–05 in one go (2026-11-12) and said not to wait for approval, which covers 04 and 05's migrations and the Edge Function deploy.

Read this, then the ticket you're starting. The spec is
`.claude/features/48-quiet-ledger-money-screens.md`; the design source is
`docs/redesign-plan.md` §4 (Insights, Budgets, Bills, Splits, Accounts,
Categories) and §2.6 (bill icons). **Also read
`.scratch/quiet-ledger/handoff.md`** ("Decisions made during spec 46" and
"How the work is done") and `.scratch/quiet-ledger-onboarding/handoff.md`:
the kit rules, the emulator recipe and the gotchas there all apply here.

## Where it stands

| Ticket | Blocked by | State | Commit |
|---|---|---|---|
| 01 Insights on the kit | — | done | see git log |
| 02 Budgets list, detail and sheet | — | done | see git log |
| 03 Bills list and the bill sheets | — | done | see git log |
| 04 Bill detail and payment history | 03 | ready | |
| 05 Bill icons from names | 03 | ready | |
| 06 Accounts with last 4 | — | ready | |
| 07 Splits list and detail | 06 | ready | |
| 08 Split sheets and "Add from my transactions" | — | ready | |
| 09 Categories | — | ready | |
| 10 Plans restyle (flag off) | 02, 07 | ready (droppable to Phase 5) | |

## Decisions (2026-11-11, with the person)

- **Spec 45 Phase 1 (last 4) is folded into ticket 06.** Spec 45 Phase 2 (SMS
  matching) stays unscheduled.
- **Bill payment history uses `transactions.bill_id`**, set by Mark paid from
  ticket 04 on. No backfill; older payments show as "Last paid".
- **Spec 48's one migration is split three ways**, each shipped with the
  ticket that reads it, each applied only with the person's yes and recorded
  in `00-index.md`'s migrations table: `accounts.last4` (06),
  `transactions.bill_id` + the WITH CHECK extension (04), `bills.icon` +
  `icon_picked` (05).
- **Testing keeps specs 46/47's two seams:** pure rules in `lib/` checked by
  `scripts/ledger-check.mjs`, plus a Pixel_API_36 emulator check in light and
  dark per ticket. No new test runner.
- New kit pieces and the ticket that builds each: `SpendChart` (01),
  `IconPicker` (05), `OverflowMenu` (06), `AvatarStack` (07). Add each to the
  kit gallery.

## Decisions made while building (2026-11-12, ticket 01)

- **Capsules:** `ledgerRadius.field` (full) for every single-line input and
  every Segmented; `input` (12) stays for small cards, tiles, skeletons and
  multi-line boxes. New sheets in tickets 02–10 use `field` for their inputs.
- **Segmented `plain`:** text only (ink selected, muted others) for a toggle
  beside a section title. The full Segmented is for page-level choices.
- **Empty states:** `Illustration` small is 48 dp until the 3D objects land.
- **Rows with a share or count:** one line each side. Context goes in the
  left sub, money (with any % beside it) on the right; no two-line right.
- **The period before** is `priorRange()` in `lib/insights.js` (a whole month
  vs the whole month before, else the same number of days). Budget detail
  (02) can reuse it.
- **Budget periods in a range:** only count periods wholly inside the
  fetched span (Insights does this; Budgets detail should too).
- **Money rows (ticket 02):** a row's money is a node (ledger rowTitle,
  semibold, tabular; danger when over), never a plain `right` string, which
  ListRow draws muted. "₹X over" needs no caption; captions are for
  "Almost out", "Used up", "Ended".
- **Bars on a sunk band** pass a canvas track (`style={{ backgroundColor:
  c.canvas }}`); icon circles there fall back to canvas too.
- The emulator was signed in as a fresh onboarding account; ticket 01 signed
  in as the shared test account and left it there (Light, Personal active).

## How the work is done

Same as `.scratch/quiet-ledger/handoff.md` "How the work is done", with this
effort's tracker ids: start a ticket with `mcp__flo-ticket-tracker__tickets`
start `quiet-ledger-money/NN`.

- The shared test account has **no splits**: tickets 07 and 08 need one
  created, which is lasting test data, so ask first.
- The test account's Electricity bill is due 2026-11-12 unpaid; put it back
  if a bills check pays it.
