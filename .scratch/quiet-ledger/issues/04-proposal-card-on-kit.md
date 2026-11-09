# 04: Ask FLO proposal card on the new kit

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** The Ask FLO proposal card becomes the one `surface` card on the chat screen. It's rebuilt on the ledger kit, and its behaviour doesn't change.

- A surface card with a hairline border. Amounts go through `AmountText` and rows through `ListRow`.
- Review is the primary `Button` and Dismiss is a quiet one. A saved proposal shows "Saved ✓" as a positive caption.
- It respects `FLAGS.ai`. The rest of the Ask FLO screen is restyled in Phase 5.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Ask FLO proposals for an entry, a budget and a bill each render on the new card
- [ ] Review opens the pre-filled sheet, and saving it shows "Saved ✓"
- [ ] Dismiss hides the card
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
