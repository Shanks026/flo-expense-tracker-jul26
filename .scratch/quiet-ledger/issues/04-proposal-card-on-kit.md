# 04: Ask FLO proposal card on the new kit

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** The Ask FLO proposal card becomes the one `surface` card on the chat screen. It's rebuilt on the ledger kit, and its behaviour doesn't change.

- A surface card with a hairline border. Amounts go through `AmountText` and rows through `ListRow`.
- Review is the primary `Button` and Dismiss is a quiet one. A saved proposal shows "Saved ✓" as a positive caption.
- It respects `FLAGS.ai`. The rest of the Ask FLO screen is restyled in Phase 5.

**Blocked by:** 01

**Status:** resolved

- [x] Ask FLO proposals for an entry, a budget and a bill each render on the new card
- [x] Review opens the pre-filled sheet, and saving it shows "Saved ✓"
- [x] Dismiss hides the card
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-10: done. `components/ProposalCard.js` is a surface card with a hairline (`c.surface`, `ledgerRadius.card`): kicker caption, a `ListRow` (kind icon, what as title, when / account / note as sub) with `AmountText` on the right, `Button` primary Review (compact) and quiet Dismiss. "Saved ✓" is `c.positive`. `describe()` and its id checks are unchanged. `Button` gained an `accessibilityLabel` prop so Review still reads "Review new expense".
- Checked on Pixel_API_36 with the test account's existing chats: bill and budget (saved), expense in light and dark. Review opened the sheet pre-filled (₹80, Snacks, Yesterday, "Tea") and saving turned the card "Saved ✓"; the test entry was then deleted through the sheet. Dismiss showed "Dismissed". The chat row is back to its original `dismissed` status.
- "Dismiss hides the card" in the checklist: the card stays and says "Dismissed", which is today's behaviour; the ticket says behaviour doesn't change, so it was kept.
- Not checked: an income proposal (signed "+" in green), and the rest of the Ask FLO screen is still old-token (Phase 5).
