# 07: Splits list and detail on the kit

Spec: .claude/features/archive/48-quiet-ledger-money-screens.md

**What to build:** Splits as flat rows with stacked member initials and "You're owed ₹600" / "You owe ₹200", and a split detail that leads with the person's balance, lists who owes whom with Settle up on each pair, and pins Settle up and Add entry. Spec 48 §Splits (list and detail).

- `AvatarStack` joins the kit (and the gallery).
- The net text is a pure rule in `lib/` (owed / owe / settled up, with a sub-paisa residue reading as square).
- List: open splits, then a muted Closed group; `PinnedFooter` New split with the free gate unchanged; ledger `EmptyState`. Before starting, check how the splits hook exposes each split's net, so the list doesn't add a query per split.
- Detail: `ScreenHeader` with export and the ⋯ `OverflowMenu` (Close/Reopen, Edit split, invites only with `FLAGS.splitInvites`); the sunk balance band with the `AvatarStack`; "Who owes whom" rows with compact Settle up; the collapsible "how this was worked out"; `Segmented` Entries · People · Settled with counts; "Add from my transactions" as the first Entries row; `PinnedFooter` Settle up + Add entry (Add entry alone when square; none when closed).
- The sheets this screen opens are unchanged here (ticket 08 restyles them).

**Blocked by:** 06 (`OverflowMenu`)

**Status:** resolved

- [x] The check script covers the net text: owed, owe, square, sub-paisa residue
- [x] The list shows each split's net and the Closed group
- [x] On the detail: settle a pair, add an entry, remove a member (with its confirm), close and reopen, export
- [x] A closed split is read-only with no footer
- [x] Emulator check in light and dark. The test account has no splits: ask the person before creating one (it's lasting test data)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments
- 2026-11-13 (resolved): built `AvatarStack` (kit + gallery), `lib/splitNet.js` (`splitNetText`, checked: owed, owe, square, sub-paisa residue, empty), the Splits list and the split detail on the kit. `useSplits` now also returns each split's members, so the list adds no query. Checked on Pixel_API_36 with a test split (created and deleted with the person's yes): list net and Closed group; settle a pair (partial ₹200, Also record off); add entry; add and remove members with the confirm; close (read-only, no footer) and reopen from ⋯; Share opens its text/PDF choice (the share itself not sent); light and dark. Decisions: the position leads with what the person pays, as before ("You owe ₹200" even when they're owed back overall), so the list and the band say the same; Settle up is the primary footer button while a pair involving the person is open; "Export as a spreadsheet" stays a row (Share's Alert only fits two formats); the old "Who is owed" cards are folded into the "Who owes whom" rows.
