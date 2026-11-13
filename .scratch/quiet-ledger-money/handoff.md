# Quiet Ledger Phase 4, Money screens (spec 48): handoff

Last updated 2026-11-12 (end of session): tickets 01–04 done and committed; **ticket 05 is half built, uncommitted** (see "Ticket 05 in progress" below). The person asked to run 03–05 in one go and said not to wait for approval, which covers 04 and 05's migrations (both applied) and 05's Edge Function deploy.

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
| 01 Insights on the kit | — | done | `4b1ddbf` |
| 02 Budgets list, detail and sheet | — | done | `8942e20` |
| 03 Bills list and the bill sheets | — | done | `e5762d6` |
| 04 Bill detail and payment history | 03 | done (dark mode of bill detail not checked) | `7b55760` |
| **05 Bill icons from names** | 03 | done (`ai-assistant` deployed with `bill_icon`) | see git log |
| 06 Accounts with last 4 | — | done (`OverflowMenu` built; menu sheets use `stackBehavior="push"`) | see git log |
| 07 Splits list and detail | 06 | done | see git log |
| 08 Split sheets and "Add from my transactions" | — | done | see git log |
| 09 Categories | — | done | see git log |
| 10 Plans restyle (flag off) | 07 | done | see git log |

**Phase 4 is done (2026-11-13).** Next is spec 48's Phase 5 planning.

**Old note, suggested order:** 07, 08, 09, 10. All are unblocked (06 built `OverflowMenu` for 07).

**Review done (2026-11-12)** over `8942e20..` with 05. Left for later, from tickets 03–04: bill detail calls `router.back()` on any fetch error (a network blip looks like a deleted bill) and never leaves loading without an id; the due wording is worked out three times (`billLine`, `billTerms`, `billTimeline`); `billIcon.ts` copies quick_add's usage/cap/fetch scaffolding; the detail band shows no name (it's in the large title). **Old note:** tickets 03 and 04 were committed without the two-agent review (the person asked for speed); run `/mattpocock-skills:code-review` over `8942e20..HEAD` together with 05 before closing 05.

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

## Decisions made while building (2026-11-12, tickets 03–04)

- **Mark paid in the Bills list is a round check** (40 dp, `toneColors(c.positive)` wash, hitSlop to 48), not a text button (the person's ask). The quiet `Button` still has its underline; spec 46 meant to drop it, left for a kit decision (Ask FLO's Dismiss uses it).
- **Bill rows, Home's upcoming bills and bill alerts open bill detail** (`/bill/<id>`); the pay sheet opens from the check, the detail's pinned Mark paid, and the bills-due pop-up (Phase 5).
- **Bill detail's band shows the terms** ("Monthly · Next due 7 Nov", danger when overdue); the status ("Overdue since…") is only the timeline's first step. "Last paid" has no sub (it may predate history or be a deleted payment).
- Kit additions: `ListRow` `subColor`, `SectionHeader` `titleColor`, `Timeline` steps with `tone: 'danger'` and `onPress` (chevron). The None category in the bill sheet is a minus icon.
- Category circles in the budget and bill sheets copy the Add sheet's row; a shared picker could serve them and 05's `IconPicker`.

## Ticket 05 in progress (uncommitted in the working tree)

- **Done:** migration `quiet_ledger_money_bill_icons` applied (`bills.icon` with a shape check, `bills.icon_picked`, `ai_usage` kind check now allows `bill_icon`; 'Film!' rejected, verified). `lib/billIcons.js` (`BILL_ICON_KEYS`, `iconForBillName`, `billIconKey`). `components/CategoryIcon.js` draws `wifi`, `water`, `gas`, `tv` (the category sheet's icon grid shows them too). The check-script group "bill icons" is written in `scripts/ledger-check.mjs`.
- **The check script currently fails to load**: its bill-icons group reads `supabase/functions/ai-assistant/billIcon.ts`, which doesn't exist yet. Create it first; it must contain `export const BILL_ICON_KEYS = [...]` (single-quoted strings, same order as `lib/billIcons.js`), which the script parses with a regex.
- **To do:**
  - `billIcon.ts`: `{ mode: 'bill_icon', name }` → `{ icon }` or `{ icon: null }`; the quick model, a strict json_schema with an enum of the keys, the reply checked against the list, `ai_usage` kind `bill_icon` (latency and model only, never the name), a daily cap like quick_add. Route it in `index.ts` before the quick_add check, then deploy `ai-assistant` (the person's go-ahead covers it).
  - `IconPicker` kit component, added to the kit gallery.
  - Bill sheet: an icon row (preview from `iconForBillName` or the category; Change opens the picker; a pick sets `icon_picked`). On save write `icon` (picked, else the keyword match) and `icon_picked`. After a save with no pick and no match, with `FLAGS.ai`, call the function and update `icon` only if still not picked, then `notifyChanged()`. A rename re-runs the rules unless picked.
  - Show `billIconKey(bill)` in the Bills list, bill detail and Home's upcoming rows (`useBills` / `useBillDetail` select `*`, so `icon` is already there).
  - Emulator check in light and dark (bill detail's dark mode is owed from 04), then the review above.

## How the work is done

Same as `.scratch/quiet-ledger/handoff.md` "How the work is done", with this
effort's tracker ids: start a ticket with `mcp__flo-ticket-tracker__tickets`
start `quiet-ledger-money/NN`.

- The shared test account has **no splits**: tickets 07 and 08 need one
  created, which is lasting test data, so ask first.
- The test account's bills: Netflix due 2026-11-07 (overdue), Electricity due 2026-11-12, two Rent due 2026-12-01, all unpaid, `last_paid_date` null, no `icon` yet. Put them back by SQL `update` after a check (Netflix `bea4947a…`, Electricity `cbb318fb…`); delete test payments through Transaction detail's Delete.
- **Tap timing:** taps sent right after a navigation or a sheet opening often land on the old screen (they opened the wrong bill's sheet twice). Wait ~3 s after a deep link before `tap.sh`, and re-dump if a label isn't found.
- **A syntax error shows only a black screen** after a force-stop relaunch. Fetch the bundle to read it: `curl -s "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false"` returns a 500 with the message.
- Restoring data by SQL bypasses `notifyChanged`, so open lists stay stale until a pull-to-refresh.
- Long inline `python - <<'EOF'` heredocs sometimes fail in Git Bash with "unexpected EOF while looking for matching `'`"; write the script to the scratchpad and run it from there.

## Decisions made while building (2026-11-13, tickets 07–10)

- **Sheet:** `Sheet` passes `stackBehavior` through (menus and the person sheet use `push`), drops the keyboard before closing, cancels a pending close on `present()`, and presents once more if the sheet hasn't opened after 500 ms. Without this, a sheet closed with the keyboard up swallowed the next open.
- **ScreenHeader** takes a `trailing` node (the split detail's ⋯ menu).
- **Split position wording:** "You owe ₹X" leads with what the person pays (the old screen's rule), on the list and the band alike. Spec 48 says "net"; the person chose to keep what they pay (2026-11-13).
- **Category sheet** has an edit mode now; type is chosen only when creating.
- **Emulator taps:** half-size screenshots (450 wide) map ×2.4, not ×1.2. Dump bounds are in device pixels; prefer them.
